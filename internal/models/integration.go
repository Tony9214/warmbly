package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// IntegrationProvider identifies one third-party system Warmbly can connect
// to. Adding a new provider here is enough to make it visible in the
// dashboard's catalog — the actual connect/disconnect logic is handled in
// the integration service's per-provider switch.
type IntegrationProvider string

const (
	IntegrationCalendly         IntegrationProvider = "calendly"
	IntegrationCalCom           IntegrationProvider = "cal_com"
	IntegrationGoogleSheets     IntegrationProvider = "google_sheets"
	IntegrationGooglePostmaster IntegrationProvider = "google_postmaster"
	IntegrationMicrosoftSNDS    IntegrationProvider = "microsoft_snds"
	IntegrationDMARC            IntegrationProvider = "dmarc"
	IntegrationCloudflare       IntegrationProvider = "cloudflare"
	IntegrationGoDaddy          IntegrationProvider = "godaddy"
	IntegrationNamecheap        IntegrationProvider = "namecheap"
)

// AllIntegrationProviders lists every provider the dashboard exposes. The
// order here is the catalog order users see.
var AllIntegrationProviders = []IntegrationProvider{
	IntegrationCalendly,
	IntegrationCalCom,
	IntegrationGoogleSheets,
	IntegrationGooglePostmaster,
	IntegrationMicrosoftSNDS,
	IntegrationDMARC,
	IntegrationCloudflare,
	IntegrationGoDaddy,
	IntegrationNamecheap,
}

func IsValidIntegrationProvider(s string) bool {
	for _, p := range AllIntegrationProviders {
		if string(p) == s {
			return true
		}
	}
	return false
}

// IntegrationStatus is the operational health of a connection. See the
// CHECK constraint on integration_connections.status.
type IntegrationStatus string

const (
	IntegrationStatusPending      IntegrationStatus = "pending"
	IntegrationStatusConnected    IntegrationStatus = "connected"
	IntegrationStatusDegraded     IntegrationStatus = "degraded"
	IntegrationStatusDisconnected IntegrationStatus = "disconnected"
)

// IntegrationCategory groups providers in the dashboard. This is metadata
// for the UI — the persistence layer does not store it.
type IntegrationCategory string

const (
	IntegrationCategoryMeetings       IntegrationCategory = "meetings"
	IntegrationCategoryData           IntegrationCategory = "data"
	IntegrationCategoryDeliverability IntegrationCategory = "deliverability"
	IntegrationCategoryDNS            IntegrationCategory = "dns"
)

// IntegrationCatalogEntry is the static metadata for one provider that the
// dashboard renders even when no connection exists yet — so the catalog
// shows every available integration, not just the ones the user already
// connected. The integration service exposes Catalog() to deliver these.
type IntegrationCatalogEntry struct {
	Provider    IntegrationProvider `json:"provider"`
	Name        string              `json:"name"`
	Tagline     string              `json:"tagline"`
	Category    IntegrationCategory `json:"category"`
	DocsURL     string              `json:"docs_url,omitempty"`
	AuthMethod  string              `json:"auth_method"` // 'oauth' | 'api_key' | 'webhook'
	BadgeColor  string              `json:"badge_color,omitempty"`
	BetaFlag    bool                `json:"beta"`
	WebhookHint string              `json:"webhook_hint,omitempty"`
}

// IntegrationConnection is one org's link to one provider.
type IntegrationConnection struct {
	ID             uuid.UUID           `json:"id"`
	OrganizationID uuid.UUID           `json:"organization_id"`
	Provider       IntegrationProvider `json:"provider"`
	Label          string              `json:"label"`
	Status         IntegrationStatus   `json:"status"`
	DisplayFields  json.RawMessage     `json:"display_fields"`
	LastSyncedAt   *time.Time          `json:"last_synced_at,omitempty"`
	LastError      *string             `json:"last_error,omitempty"`
	LastErrorAt    *time.Time          `json:"last_error_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`

	// Returned only at create time for providers that POST inbound
	// (Calendly, Cal.com). The dashboard surfaces the resulting URL once.
	InboundWebhookURL string `json:"inbound_webhook_url,omitempty"`
}

// DMARCReport is the parsed envelope of one ingested RUA XML report.
type DMARCReport struct {
	ID             uuid.UUID         `json:"id"`
	OrganizationID uuid.UUID         `json:"organization_id"`
	Domain         string            `json:"domain"`
	ReporterOrg    string            `json:"reporter_org"`
	ReportID       string            `json:"report_id"`
	RangeStart     time.Time         `json:"range_start"`
	RangeEnd       time.Time         `json:"range_end"`
	TotalMessages  int64             `json:"total_messages"`
	PassMessages   int64             `json:"pass_messages"`
	FailMessages   int64             `json:"fail_messages"`
	CreatedAt      time.Time         `json:"created_at"`
	Rows           []DMARCRecordRow  `json:"rows,omitempty"`
}

// DMARCRecordRow is one per-source-IP record from a DMARC report.
type DMARCRecordRow struct {
	SourceIP     string `json:"source_ip"`
	MessageCount int64  `json:"message_count"`
	Disposition  string `json:"disposition"`
	SPFResult    string `json:"spf_result"`
	DKIMResult   string `json:"dkim_result"`
	SPFDomain    string `json:"spf_domain,omitempty"`
	DKIMDomain   string `json:"dkim_domain,omitempty"`
	HeaderFrom   string `json:"header_from,omitempty"`
}

// PostmasterSnapshot is one daily reading of provider-side reputation data.
type PostmasterSnapshot struct {
	ID                int64           `json:"id"`
	OrganizationID    uuid.UUID       `json:"organization_id"`
	Source            string          `json:"source"`
	Target            string          `json:"target"`
	SnapshotDate      time.Time       `json:"snapshot_date"`
	SpamRatePct       *float64        `json:"spam_rate_pct,omitempty"`
	InboxPlacementPct *float64        `json:"inbox_placement_pct,omitempty"`
	DomainReputation  *string         `json:"domain_reputation,omitempty"`
	IPReputation      *string         `json:"ip_reputation,omitempty"`
	DKIMSuccessPct    *float64        `json:"dkim_success_pct,omitempty"`
	SPFSuccessPct     *float64        `json:"spf_success_pct,omitempty"`
	DMARCSuccessPct   *float64        `json:"dmarc_success_pct,omitempty"`
	RawPayload        json.RawMessage `json:"raw_payload,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
}

// DNSVerification is a snapshot of resolved SPF/DKIM/DMARC records for one
// domain. The dashboard renders the latest verification per domain plus a
// recommended fix when a record is missing or malformed.
type DNSVerification struct {
	ID             uuid.UUID       `json:"id"`
	OrganizationID uuid.UUID       `json:"organization_id"`
	Domain         string          `json:"domain"`

	SPFRecord *string `json:"spf_record,omitempty"`
	SPFOK     bool    `json:"spf_ok"`

	DKIMSelector *string `json:"dkim_selector,omitempty"`
	DKIMRecord   *string `json:"dkim_record,omitempty"`
	DKIMOK       bool    `json:"dkim_ok"`

	DMARCRecord *string `json:"dmarc_record,omitempty"`
	DMARCOK     bool    `json:"dmarc_ok"`

	TrackingCNAME *string `json:"tracking_cname,omitempty"`
	TrackingOK    bool    `json:"tracking_ok"`

	Notes     json.RawMessage `json:"notes"`
	CheckedAt time.Time       `json:"checked_at"`
}

// MeetingBooking represents one booked meeting from Calendly/Cal.com.
type MeetingBooking struct {
	ID              uuid.UUID       `json:"id"`
	OrganizationID  uuid.UUID       `json:"organization_id"`
	Source          string          `json:"source"`
	ExternalEventID string          `json:"external_event_id"`
	InviteeEmail    string          `json:"invitee_email"`
	InviteeName     string          `json:"invitee_name"`
	EventName       string          `json:"event_name"`
	ScheduledFor    *time.Time      `json:"scheduled_for,omitempty"`
	ContactID       *uuid.UUID      `json:"contact_id,omitempty"`
	CampaignID      *uuid.UUID      `json:"campaign_id,omitempty"`
	RawPayload      json.RawMessage `json:"raw_payload,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}
