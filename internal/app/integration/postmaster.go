package integration

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// PostmasterClient calls Google's Gmail Postmaster Tools API. OAuth token
// management lives in the existing email-account OAuth path — workers
// (and this puller) consume short-lived access tokens minted by the
// backend's token service. This client takes a ready-to-use bearer.
type PostmasterClient struct {
	bearerToken string
	http        *http.Client
}

func NewPostmasterClient(bearerToken string) *PostmasterClient {
	return &PostmasterClient{
		bearerToken: bearerToken,
		http:        &http.Client{Timeout: 15 * time.Second},
	}
}

// PullDomainTrafficStats fetches Google Postmaster's daily traffic stats
// for a domain and persists one PostmasterSnapshot per day. Idempotent
// on (org, source='google_postmaster', target=domain, snapshot_date).
func (c *PostmasterClient) PullDomainTrafficStats(
	ctx context.Context,
	repo repository.IntegrationRepository,
	orgID uuid.UUID,
	domain string,
	daysBack int,
) (int, error) {
	if daysBack <= 0 || daysBack > 90 {
		daysBack = 30
	}
	endpoint := fmt.Sprintf(
		"https://gmailpostmastertools.googleapis.com/v1/domains/%s/trafficStats?pageSize=%d",
		domain, daysBack,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return 0, fmt.Errorf("postmaster trafficStats HTTP %d: %s", resp.StatusCode, string(body))
	}

	var parsed struct {
		TrafficStats []struct {
			Name              string  `json:"name"`
			UserReportedSpamRatio       float64 `json:"userReportedSpamRatio"`
			IPReputations               []struct {
				Reputation string `json:"reputation"`
			} `json:"ipReputations"`
			DomainReputation       string  `json:"domainReputation"`
			InboundEncryptionRatio float64 `json:"inboundEncryptionRatio"`
			SPFSuccessRatio        float64 `json:"spfSuccessRatio"`
			DKIMSuccessRatio       float64 `json:"dkimSuccessRatio"`
			DMARCSuccessRatio      float64 `json:"dmarcSuccessRatio"`
		} `json:"trafficStats"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return 0, err
	}

	count := 0
	for _, ts := range parsed.TrafficStats {
		date, ok := parsePostmasterDate(ts.Name)
		if !ok {
			continue
		}
		spfPct := ts.SPFSuccessRatio * 100
		dkimPct := ts.DKIMSuccessRatio * 100
		dmarcPct := ts.DMARCSuccessRatio * 100
		spamPct := ts.UserReportedSpamRatio * 100
		raw, _ := json.Marshal(ts)

		domainRep := ts.DomainReputation
		ipRep := ""
		if len(ts.IPReputations) > 0 {
			ipRep = ts.IPReputations[0].Reputation
		}
		snap := &models.PostmasterSnapshot{
			OrganizationID:   orgID,
			Source:           "google_postmaster",
			Target:           domain,
			SnapshotDate:     date,
			SpamRatePct:      &spamPct,
			DomainReputation: &domainRep,
			SPFSuccessPct:    &spfPct,
			DKIMSuccessPct:   &dkimPct,
			DMARCSuccessPct:  &dmarcPct,
			RawPayload:       raw,
		}
		if ipRep != "" {
			snap.IPReputation = &ipRep
		}
		if err := repo.UpsertPostmasterSnapshot(ctx, snap); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// parsePostmasterDate extracts the YYYYMMDD from a name like
// "domains/example.com/trafficStats/20260315".
func parsePostmasterDate(name string) (time.Time, bool) {
	parts := strings.Split(name, "/")
	if len(parts) == 0 {
		return time.Time{}, false
	}
	last := parts[len(parts)-1]
	if len(last) != 8 {
		return time.Time{}, false
	}
	t, err := time.Parse("20060102", last)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// SNDSClient pulls Microsoft Smart Network Data Services reports. SNDS
// uses a long-lived per-IP "data access key" rather than OAuth, so the
// shape is simpler than Postmaster: GET a CSV, parse, persist.
type SNDSClient struct {
	dataAccessKey string
	http          *http.Client
}

func NewSNDSClient(dataAccessKey string) *SNDSClient {
	return &SNDSClient{
		dataAccessKey: dataAccessKey,
		http:          &http.Client{Timeout: 15 * time.Second},
	}
}

// PullIPReputation fetches the SNDS automated-data CSV for the configured
// IP range and persists one PostmasterSnapshot per (IP, date). The SNDS
// CSV is documented at https://sendersupport.olc.protection.outlook.com/snds/auto.aspx
// — columns: IP, activity-start, activity-end, RCPT-commands, data-commands,
// message-recipients, filter-result, complaint-rate-bucket, trap-message-period,
// trap-hits, sample-HELO, sample-from.
func (c *SNDSClient) PullIPReputation(
	ctx context.Context,
	repo repository.IntegrationRepository,
	orgID uuid.UUID,
) (int, error) {
	if c.dataAccessKey == "" {
		return 0, errors.New("SNDS data access key is empty")
	}
	url := "https://sendersupport.olc.protection.outlook.com/snds/automated.aspx?key=" + c.dataAccessKey
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("SNDS HTTP %d", resp.StatusCode)
	}

	r := csv.NewReader(resp.Body)
	r.FieldsPerRecord = -1
	count := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return count, err
		}
		if len(row) < 8 {
			continue
		}
		ip := strings.TrimSpace(row[0])
		// Activity start: "M/D/YYYY h:mm AM/PM"
		startRaw := strings.TrimSpace(row[1])
		start, err := time.Parse("1/2/2006 3:04 PM", startRaw)
		if err != nil {
			continue
		}
		// Complaint-rate bucket: '<0.1%' | '0.1-0.9%' | '1-1.9%' | ...
		complaintBucket := strings.TrimSpace(row[7])
		complaintPct, _ := parseComplaintBucket(complaintBucket)

		ipRep := classifySNDSReputation(row)

		raw, _ := json.Marshal(map[string]any{
			"row":              row,
			"complaint_bucket": complaintBucket,
		})

		date := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
		snap := &models.PostmasterSnapshot{
			OrganizationID: orgID,
			Source:         "microsoft_snds",
			Target:         ip,
			SnapshotDate:   date,
			SpamRatePct:    &complaintPct,
			IPReputation:   &ipRep,
			RawPayload:     raw,
		}
		if err := repo.UpsertPostmasterSnapshot(ctx, snap); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// parseComplaintBucket interprets the SNDS bucket label as the bucket's
// lower bound (conservative). Returns 0 if the label is unparseable.
func parseComplaintBucket(label string) (float64, bool) {
	label = strings.TrimSpace(strings.ReplaceAll(label, "%", ""))
	if strings.HasPrefix(label, "<") {
		v, err := strconv.ParseFloat(strings.TrimPrefix(label, "<"), 64)
		if err != nil {
			return 0, false
		}
		return v, true
	}
	if i := strings.Index(label, "-"); i > 0 {
		v, err := strconv.ParseFloat(label[:i], 64)
		if err != nil {
			return 0, false
		}
		return v, true
	}
	v, err := strconv.ParseFloat(label, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// classifySNDSReputation maps the SNDS filter-result column to our 4-tier
// reputation label so Postmaster and SNDS rows share an enum the UI can
// render uniformly.
func classifySNDSReputation(row []string) string {
	if len(row) < 7 {
		return "unknown"
	}
	result := strings.ToLower(strings.TrimSpace(row[6]))
	switch result {
	case "green":
		return "high"
	case "yellow":
		return "medium"
	case "red":
		return "low"
	}
	return "unknown"
}
