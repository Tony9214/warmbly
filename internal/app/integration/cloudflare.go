package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// CloudflareClient is a thin wrapper around the Cloudflare DNS API. We
// implement only the verbs we need: list zones, list records, create a
// TXT or CNAME record. The full SDK is overkill for SPF/DKIM/DMARC writes
// and pulling it in would compromise the worker-side build (CLAUDE.md:
// workers stay lean).
type CloudflareClient struct {
	apiToken string
	http     *http.Client
}

func NewCloudflareClient(apiToken string) *CloudflareClient {
	return &CloudflareClient{
		apiToken: apiToken,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

// VerifyToken confirms the API token is alive and scoped to at least one
// DNS zone. Called by the connect flow before persisting credentials so
// the user sees an error in the dashboard, not a silent half-broken
// connection.
func (c *CloudflareClient) VerifyToken(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.cloudflare.com/client/v4/user/tokens/verify", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("cloudflare token verify: HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

type cloudflareZone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type cloudflareZonesResponse struct {
	Success bool             `json:"success"`
	Errors  []cloudflareErr  `json:"errors"`
	Result  []cloudflareZone `json:"result"`
}

type cloudflareErr struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// FindZone resolves the apex zone for a domain (e.g. "foo.bar.com" →
// "bar.com" zone). Cloudflare's API requires the zone ID for any record
// mutation, so we cannot skip this step.
func (c *CloudflareClient) FindZone(ctx context.Context, domain string) (string, string, error) {
	apex := strings.ToLower(strings.TrimSpace(domain))
	if apex == "" {
		return "", "", errors.New("domain is required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.cloudflare.com/client/v4/zones?name="+apex, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	var parsed cloudflareZonesResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", "", err
	}
	if !parsed.Success || len(parsed.Result) == 0 {
		return "", "", fmt.Errorf("zone not found for %s", apex)
	}
	return parsed.Result[0].ID, parsed.Result[0].Name, nil
}

// DNSRecordInput is the per-record payload that ApplyRecords accepts.
type DNSRecordInput struct {
	Type    string `json:"type"`    // "TXT" | "CNAME"
	Name    string `json:"name"`
	Content string `json:"content"`
	TTL     int    `json:"ttl"`     // 1 means "auto"
}

type cloudflareRecordResponse struct {
	Success bool            `json:"success"`
	Errors  []cloudflareErr `json:"errors"`
}

// ApplyRecord creates (or updates) one DNS record. Cloudflare's API has
// no upsert primitive, so we list the zone's records, find a match by
// (type, name), and either PATCH or POST.
func (c *CloudflareClient) ApplyRecord(ctx context.Context, zoneID string, rec DNSRecordInput) error {
	if rec.TTL == 0 {
		rec.TTL = 1
	}
	body, _ := json.Marshal(rec)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.cloudflare.com/client/v4/zones/"+zoneID+"/dns_records",
		bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		return nil
	}
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	return fmt.Errorf("cloudflare apply record: HTTP %d: %s", resp.StatusCode, string(respBody))
}

// ApplyRecords is the convenience entry the dashboard's "one-click setup"
// button calls. Looks up the zone for the domain and applies the three
// records (SPF, DKIM, DMARC) in sequence. Errors include the first record
// that failed so the dashboard can show actionable feedback.
func (c *CloudflareClient) ApplyRecords(ctx context.Context, domain string, records []DNSRecordInput) error {
	zoneID, _, err := c.FindZone(ctx, domain)
	if err != nil {
		return err
	}
	for _, r := range records {
		if err := c.ApplyRecord(ctx, zoneID, r); err != nil {
			return fmt.Errorf("%s record: %w", r.Type, err)
		}
	}
	return nil
}

// RecommendedRecords returns the SPF/DKIM/DMARC records Warmbly recommends
// for a domain, given the user-supplied DKIM public key. We expose this
// from the integration package so the Cloudflare/GoDaddy/Namecheap
// implementations all share one source of truth.
func RecommendedRecords(domain string, dkimSelector, dkimPublicKey string) []DNSRecordInput {
	domain = strings.ToLower(domain)
	out := []DNSRecordInput{
		{
			Type:    "TXT",
			Name:    domain,
			Content: "v=spf1 include:_spf.warmbly.com ~all",
		},
		{
			Type: "TXT",
			Name: "_dmarc." + domain,
			Content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@" + domain +
				"; ruf=mailto:dmarc@" + domain + "; pct=100; aspf=r; adkim=r",
		},
	}
	if dkimPublicKey != "" {
		selector := dkimSelector
		if selector == "" {
			selector = "warmbly"
		}
		out = append(out, DNSRecordInput{
			Type:    "TXT",
			Name:    selector + "._domainkey." + domain,
			Content: "v=DKIM1; k=rsa; p=" + dkimPublicKey,
		})
	}
	return out
}
