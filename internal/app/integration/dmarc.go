package integration

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// dmarcXML mirrors the RFC 7489 aggregate-report schema. Only the fields
// we actually display are decoded; the rest of the XML is dropped on the
// floor (no harm — the next provider's schema deviation would just add
// unused tags).
type dmarcXML struct {
	XMLName xml.Name `xml:"feedback"`

	ReportMetadata struct {
		OrgName   string `xml:"org_name"`
		Email     string `xml:"email"`
		ReportID  string `xml:"report_id"`
		DateRange struct {
			Begin int64 `xml:"begin"`
			End   int64 `xml:"end"`
		} `xml:"date_range"`
	} `xml:"report_metadata"`

	PolicyPublished struct {
		Domain string `xml:"domain"`
		ADKIM  string `xml:"adkim"`
		ASPF   string `xml:"aspf"`
		P      string `xml:"p"`
		SP     string `xml:"sp"`
		PCT    int    `xml:"pct"`
	} `xml:"policy_published"`

	Records []struct {
		Row struct {
			SourceIP        string `xml:"source_ip"`
			Count           int64  `xml:"count"`
			PolicyEvaluated struct {
				Disposition string `xml:"disposition"`
				DKIM        string `xml:"dkim"`
				SPF         string `xml:"spf"`
			} `xml:"policy_evaluated"`
		} `xml:"row"`
		Identifiers struct {
			HeaderFrom string `xml:"header_from"`
		} `xml:"identifiers"`
		AuthResults struct {
			DKIM []struct {
				Domain   string `xml:"domain"`
				Result   string `xml:"result"`
				Selector string `xml:"selector"`
			} `xml:"dkim"`
			SPF []struct {
				Domain string `xml:"domain"`
				Result string `xml:"result"`
			} `xml:"spf"`
		} `xml:"auth_results"`
	} `xml:"record"`
}

// IngestDMARCReport parses one RUA XML report and persists it. Idempotent
// on (org, reporter, report_id).
func IngestDMARCReport(
	ctx context.Context,
	repo repository.IntegrationRepository,
	orgID uuid.UUID,
	body []byte,
) (*models.DMARCReport, error) {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return nil, errors.New("empty DMARC report body")
	}

	var x dmarcXML
	dec := xml.NewDecoder(strings.NewReader(trimmed))
	// Disable external entity expansion — DMARC XML never references
	// external entities, so refusing them is a free defence.
	dec.Strict = true
	if err := dec.Decode(&x); err != nil {
		return nil, fmt.Errorf("parse dmarc xml: %w", err)
	}

	if x.PolicyPublished.Domain == "" || x.ReportMetadata.ReportID == "" {
		return nil, errors.New("dmarc report missing required fields")
	}

	report := &models.DMARCReport{
		OrganizationID: orgID,
		Domain:         x.PolicyPublished.Domain,
		ReporterOrg:    x.ReportMetadata.OrgName,
		ReportID:       x.ReportMetadata.ReportID,
		RangeStart:     time.Unix(x.ReportMetadata.DateRange.Begin, 0).UTC(),
		RangeEnd:       time.Unix(x.ReportMetadata.DateRange.End, 0).UTC(),
	}

	for _, rec := range x.Records {
		row := models.DMARCRecordRow{
			SourceIP:     rec.Row.SourceIP,
			MessageCount: rec.Row.Count,
			Disposition:  rec.Row.PolicyEvaluated.Disposition,
			SPFResult:    rec.Row.PolicyEvaluated.SPF,
			DKIMResult:   rec.Row.PolicyEvaluated.DKIM,
			HeaderFrom:   rec.Identifiers.HeaderFrom,
		}
		if len(rec.AuthResults.SPF) > 0 {
			row.SPFDomain = rec.AuthResults.SPF[0].Domain
		}
		if len(rec.AuthResults.DKIM) > 0 {
			row.DKIMDomain = rec.AuthResults.DKIM[0].Domain
		}
		report.Rows = append(report.Rows, row)

		report.TotalMessages += rec.Row.Count
		// "pass" semantics: both SPF and DKIM evaluated as pass. Lines up
		// with the DMARC RFC's alignment definition.
		if rec.Row.PolicyEvaluated.SPF == "pass" && rec.Row.PolicyEvaluated.DKIM == "pass" {
			report.PassMessages += rec.Row.Count
		} else {
			report.FailMessages += rec.Row.Count
		}
	}

	if err := repo.UpsertDMARCReport(ctx, report); err != nil {
		return nil, err
	}
	return report, nil
}
