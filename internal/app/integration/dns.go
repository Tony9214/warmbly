package integration

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// DNSVerifyRequest is the dashboard's "check my domain" call. The caller
// must provide the domain; the DKIM selector and tracking CNAME are
// optional (defaults applied below).
type DNSVerifyRequest struct {
	Domain        string `json:"domain"`
	DKIMSelector  string `json:"dkim_selector,omitempty"`
	TrackingCNAME string `json:"tracking_cname,omitempty"`
}

// VerifyDNS resolves SPF, DKIM, DMARC, and the optional tracking CNAME
// and writes a verification row. Returns the verification so the
// dashboard can render it immediately without a second round-trip.
//
// Verification rules — same shape as Postmark / Mailgun's checkers:
//   - SPF: TXT on the apex containing 'v=spf1'.
//   - DKIM: TXT on `<selector>._domainkey.<domain>` containing 'k=rsa' or
//     'p=' — required for DKIM signing to work at all.
//   - DMARC: TXT on `_dmarc.<domain>` starting 'v=DMARC1'.
//   - Tracking: CNAME on `<tracking>` resolves to one of our known
//     tracking hosts.
func VerifyDNS(
	ctx context.Context,
	repo repository.IntegrationRepository,
	orgID uuid.UUID,
	req DNSVerifyRequest,
) (*models.DNSVerification, error) {
	domain := strings.TrimSpace(strings.ToLower(req.Domain))
	if domain == "" {
		return nil, errors.New("domain is required")
	}

	resolver := &net.Resolver{}
	deadline, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	v := &models.DNSVerification{
		OrganizationID: orgID,
		Domain:         domain,
	}
	notes := map[string]string{}

	// SPF
	if records, err := resolver.LookupTXT(deadline, domain); err == nil {
		for _, rec := range records {
			if strings.HasPrefix(strings.ToLower(rec), "v=spf1") {
				v.SPFRecord = ptrStr(rec)
				v.SPFOK = true
				break
			}
		}
		if !v.SPFOK {
			notes["spf"] = "no v=spf1 TXT record found on " + domain
		}
	} else {
		notes["spf"] = "spf lookup failed: " + err.Error()
	}

	// DKIM
	selector := strings.TrimSpace(req.DKIMSelector)
	if selector == "" {
		// Try the common defaults; first one that resolves wins. This
		// matters because every provider uses its own selector convention.
		for _, candidate := range []string{"warmbly", "google", "selector1", "default"} {
			if records, err := resolver.LookupTXT(deadline, candidate+"._domainkey."+domain); err == nil && len(records) > 0 {
				selector = candidate
				v.DKIMRecord = ptrStr(joinTXT(records))
				v.DKIMSelector = ptrStr(candidate)
				v.DKIMOK = looksLikeDKIM(*v.DKIMRecord)
				break
			}
		}
		if v.DKIMSelector == nil {
			notes["dkim"] = "no DKIM selector resolves on common names; pass dkim_selector to override"
		}
	} else {
		v.DKIMSelector = ptrStr(selector)
		records, err := resolver.LookupTXT(deadline, selector+"._domainkey."+domain)
		if err != nil {
			notes["dkim"] = "dkim lookup failed: " + err.Error()
		} else if len(records) == 0 {
			notes["dkim"] = "dkim TXT empty on " + selector + "._domainkey." + domain
		} else {
			joined := joinTXT(records)
			v.DKIMRecord = &joined
			v.DKIMOK = looksLikeDKIM(joined)
		}
	}

	// DMARC
	if records, err := resolver.LookupTXT(deadline, "_dmarc."+domain); err == nil {
		for _, rec := range records {
			if strings.HasPrefix(strings.ToUpper(rec), "V=DMARC1") {
				v.DMARCRecord = ptrStr(rec)
				v.DMARCOK = true
				break
			}
		}
		if !v.DMARCOK {
			notes["dmarc"] = "no v=DMARC1 TXT record found at _dmarc." + domain
		}
	} else {
		notes["dmarc"] = "dmarc lookup failed: " + err.Error()
	}

	// Tracking domain CNAME (optional)
	if t := strings.TrimSpace(req.TrackingCNAME); t != "" {
		if cname, err := resolver.LookupCNAME(deadline, t); err == nil && cname != "" {
			v.TrackingCNAME = ptrStr(strings.TrimSuffix(cname, "."))
			cn := strings.TrimSuffix(cname, ".")
			v.TrackingOK = strings.HasSuffix(cn, "trk.warmbly.com") ||
				strings.HasSuffix(cn, "track.warmbly.com")
			if !v.TrackingOK {
				notes["tracking"] = "CNAME resolves to " + cn + " (expected *.warmbly.com)"
			}
		} else {
			notes["tracking"] = "tracking CNAME does not resolve"
		}
	}

	notesJSON, _ := json.Marshal(notes)
	v.Notes = notesJSON

	if err := repo.InsertDNSVerification(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func ptrStr(s string) *string { return &s }

func joinTXT(records []string) string {
	// Long TXT records arrive as multiple chunks; the DNS server joins
	// them without delimiters.
	return strings.Join(records, "")
}

func looksLikeDKIM(rec string) bool {
	lower := strings.ToLower(rec)
	return strings.Contains(lower, "k=rsa") || strings.Contains(lower, "p=")
}
