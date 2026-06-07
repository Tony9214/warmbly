package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// actionHTTP is the shared client for outbound provider action calls. Short
// timeout — a slow third party shouldn't pin a dispatch goroutine for long.
var actionHTTP = &http.Client{Timeout: 15 * time.Second}

// slackPostMessage posts to a channel using a bot token from the OAuth connect.
// Slack returns HTTP 200 with {ok:false,error:...} on failure, so we inspect
// the body rather than the status code.
func slackPostMessage(ctx context.Context, token, channel string, msg eventMessage) error {
	if channel == "" {
		return fmt.Errorf("no slack channel configured")
	}
	body, _ := json.Marshal(map[string]any{
		"channel": channel,
		"text":    msg.plainText(),
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://slack.com/api/chat.postMessage", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var out struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	_ = json.Unmarshal(raw, &out)
	if !out.OK {
		if out.Error == "" {
			out.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return fmt.Errorf("slack chat.postMessage: %s", out.Error)
	}
	return nil
}

// webhookPost delivers a Discord-compatible payload (and works for any generic
// JSON webhook): Discord requires a top-level "content" string.
func webhookPost(ctx context.Context, url string, msg eventMessage) error {
	body, _ := json.Marshal(map[string]any{
		"content": msg.plainText(),
		"email":   msg.Email,
		"subject": msg.Subject,
		"title":   msg.Title,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook POST: HTTP %d", resp.StatusCode)
	}
	return nil
}

// hubspotUpsertContact creates or updates a HubSpot contact keyed by email and
// logs the event as a note on the contact timeline (best-effort).
func hubspotUpsertContact(ctx context.Context, token string, data map[string]any, msg eventMessage) error {
	email := msg.Email
	if email == "" {
		// Nothing to key on; treat as a no-op success.
		return nil
	}
	firstName := stringFromMap(data, "first_name", "contact_first_name")
	lastName := stringFromMap(data, "last_name", "contact_last_name")

	props := map[string]any{"email": email}
	if firstName != "" {
		props["firstname"] = firstName
	}
	if lastName != "" {
		props["lastname"] = lastName
	}
	if company := stringFromMap(data, "company"); company != "" {
		props["company"] = company
	}
	if phone := stringFromMap(data, "phone"); phone != "" {
		props["phone"] = phone
	}

	// Find existing contact by email.
	searchBody, _ := json.Marshal(map[string]any{
		"filterGroups": []map[string]any{{
			"filters": []map[string]any{{
				"propertyName": "email", "operator": "EQ", "value": email,
			}},
		}},
		"properties": []string{"email"},
		"limit":      1,
	})
	var search struct {
		Results []struct {
			ID string `json:"id"`
		} `json:"results"`
	}
	if err := hubspotJSON(ctx, http.MethodPost, "https://api.hubapi.com/crm/v3/objects/contacts/search", token, searchBody, &search); err != nil {
		return err
	}

	contactID := ""
	if len(search.Results) > 0 {
		contactID = search.Results[0].ID
		upd, _ := json.Marshal(map[string]any{"properties": props})
		if err := hubspotJSON(ctx, http.MethodPatch, "https://api.hubapi.com/crm/v3/objects/contacts/"+contactID, token, upd, nil); err != nil {
			return err
		}
	} else {
		create, _ := json.Marshal(map[string]any{"properties": props})
		var created struct {
			ID string `json:"id"`
		}
		if err := hubspotJSON(ctx, http.MethodPost, "https://api.hubapi.com/crm/v3/objects/contacts", token, create, &created); err != nil {
			return err
		}
		contactID = created.ID
	}

	// Best-effort note on the timeline.
	if contactID != "" {
		note, _ := json.Marshal(map[string]any{
			"properties": map[string]any{
				"hs_note_body": msg.plainText(),
				"hs_timestamp": time.Now().UTC().Format(time.RFC3339),
			},
			"associations": []map[string]any{{
				"to": map[string]any{"id": contactID},
				"types": []map[string]any{{
					"associationCategory": "HUBSPOT_DEFINED",
					"associationTypeId":   202,
				}},
			}},
		})
		_ = hubspotJSON(ctx, http.MethodPost, "https://api.hubapi.com/crm/v3/objects/notes", token, note, nil)
	}
	return nil
}

func hubspotJSON(ctx context.Context, method, url, token string, body []byte, dst any) error {
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("hubspot %s %s: HTTP %d", method, shortURL(url), resp.StatusCode)
	}
	if dst != nil && len(raw) > 0 {
		return json.Unmarshal(raw, dst)
	}
	return nil
}

// pipedriveUpsertPerson creates a Pipedrive person keyed by email. Pipedrive's
// REST API does not offer a true upsert, so we search first.
func pipedriveUpsertPerson(ctx context.Context, token string, data map[string]any) error {
	email := stringFromMap(data, "contact_email", "invitee_email", "email")
	if email == "" {
		return nil
	}
	name := stringFromMap(data, "contact_name", "invitee_name", "name")
	if name == "" {
		name = email
	}

	// Search for an existing person by email.
	searchURL := "https://api.pipedrive.com/v1/persons/search?term=" + url.QueryEscape(email) + "&fields=email&exact_match=true"
	var search struct {
		Data struct {
			Items []struct {
				Item struct {
					ID int64 `json:"id"`
				} `json:"item"`
			} `json:"items"`
		} `json:"data"`
	}
	if err := pipedriveJSON(ctx, http.MethodGet, searchURL, token, nil, &search); err != nil {
		return err
	}
	if len(search.Data.Items) > 0 {
		return nil // already present; nothing to do
	}

	payload := map[string]any{
		"name":  name,
		"email": []string{email},
	}
	if phone := stringFromMap(data, "phone"); phone != "" {
		payload["phone"] = []string{phone}
	}
	create, _ := json.Marshal(payload)
	return pipedriveJSON(ctx, http.MethodPost, "https://api.pipedrive.com/v1/persons", token, create, nil)
}

func pipedriveJSON(ctx context.Context, method, url, token string, body []byte, dst any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("pipedrive %s: HTTP %d", method, resp.StatusCode)
	}
	if dst != nil && len(raw) > 0 {
		return json.Unmarshal(raw, dst)
	}
	return nil
}

func shortURL(u string) string {
	if i := len("https://api.hubapi.com"); len(u) > i {
		return u[i:]
	}
	return u
}

// closeUpsertLead creates a Close lead (with an embedded contact) keyed by
// email. Close has no native upsert, so we search by email first and skip when
// a lead already carries the address — this keeps the action idempotent so
// retries and repeated pushes don't fan out duplicate leads. Auth is HTTP Basic
// with the API key as the username and a blank password.
func closeUpsertLead(ctx context.Context, apiKey string, data map[string]any) error {
	email := stringFromMap(data, "contact_email", "invitee_email", "email")
	if email == "" {
		return nil
	}

	// Idempotency guard: skip if a lead already has this email address.
	searchURL := "https://api.close.com/api/v1/lead/?_fields=id&query=" +
		url.QueryEscape("email_address:\""+email+"\"")
	var search struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := closeJSON(ctx, http.MethodGet, searchURL, apiKey, nil, &search); err != nil {
		return err
	}
	if len(search.Data) > 0 {
		return nil
	}

	name := stringFromMap(data, "contact_name", "first_name")
	if last := stringFromMap(data, "last_name"); last != "" {
		name = strings.TrimSpace(name + " " + last)
	}
	if name == "" {
		name = email
	}
	leadName := stringFromMap(data, "company")
	if leadName == "" {
		leadName = name
	}

	contact := map[string]any{
		"name":   name,
		"emails": []map[string]any{{"email": email, "type": "office"}},
	}
	if phone := stringFromMap(data, "phone"); phone != "" {
		contact["phones"] = []map[string]any{{"phone": phone, "type": "office"}}
	}
	body, _ := json.Marshal(map[string]any{
		"name":     leadName,
		"contacts": []map[string]any{contact},
	})
	return closeJSON(ctx, http.MethodPost, "https://api.close.com/api/v1/lead/", apiKey, body, nil)
}

func closeJSON(ctx context.Context, method, reqURL, apiKey string, body []byte, dst any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, reqURL, reader)
	if err != nil {
		return err
	}
	req.SetBasicAuth(apiKey, "")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("close %s: HTTP %d", method, resp.StatusCode)
	}
	if dst != nil && len(raw) > 0 {
		return json.Unmarshal(raw, dst)
	}
	return nil
}

// salesforceAPIVersion is the REST API version actions target. Salesforce keeps
// old versions live for years, so pinning one keeps request shapes stable.
const salesforceAPIVersion = "v59.0"

// salesforceUpsertContact creates or updates a Salesforce Contact keyed by
// email. instanceURL is the connected org's API host, captured at OAuth time
// and stored in the connection's display fields. LastName is mandatory on the
// Contact object, so we fall back to the email when no surname is known.
func salesforceUpsertContact(ctx context.Context, token, instanceURL string, data map[string]any) error {
	instanceURL = strings.TrimRight(strings.TrimSpace(instanceURL), "/")
	if instanceURL == "" {
		return fmt.Errorf("salesforce instance url unavailable; reconnect the integration")
	}
	email := stringFromMap(data, "contact_email", "invitee_email", "email")
	if email == "" {
		return nil
	}

	lastName := stringFromMap(data, "last_name", "contact_last_name")
	if lastName == "" {
		lastName = email // LastName is a required Contact field.
	}
	fields := map[string]any{"LastName": lastName, "Email": email}
	if firstName := stringFromMap(data, "first_name", "contact_first_name"); firstName != "" {
		fields["FirstName"] = firstName
	}
	if phone := stringFromMap(data, "phone"); phone != "" {
		fields["Phone"] = phone
	}

	// Find an existing contact by email (SOQL — escape embedded single quotes).
	soql := "SELECT Id FROM Contact WHERE Email = '" + strings.ReplaceAll(email, "'", "\\'") + "' LIMIT 1"
	queryURL := instanceURL + "/services/data/" + salesforceAPIVersion + "/query?q=" + url.QueryEscape(soql)
	var q struct {
		Records []struct {
			ID string `json:"Id"`
		} `json:"records"`
	}
	if err := salesforceJSON(ctx, http.MethodGet, queryURL, token, nil, &q); err != nil {
		return err
	}

	base := instanceURL + "/services/data/" + salesforceAPIVersion + "/sobjects/Contact"
	body, _ := json.Marshal(fields)
	if len(q.Records) > 0 {
		// PATCH returns 204 No Content on success.
		return salesforceJSON(ctx, http.MethodPatch, base+"/"+q.Records[0].ID, token, body, nil)
	}
	return salesforceJSON(ctx, http.MethodPost, base+"/", token, body, nil)
}

func salesforceJSON(ctx context.Context, method, reqURL, token string, body []byte, dst any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, reqURL, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := actionHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("salesforce %s: HTTP %d", method, resp.StatusCode)
	}
	if dst != nil && len(raw) > 0 {
		return json.Unmarshal(raw, dst)
	}
	return nil
}
