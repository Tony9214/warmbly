package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/warmbly/warmbly/internal/models"
)

// IntegrationRepository owns persistence for third-party integrations.
//
// One repo covers connections, DMARC reports, Postmaster snapshots, DNS
// verifications, and meeting bookings — these are all sibling slices of
// "integration data" and they share lifecycle (delete when an org is
// deleted via the FK cascade). Splitting by domain noun didn't pay off
// because handlers and the dashboard read across all five.
type IntegrationRepository interface {
	// Connections
	UpsertConnection(ctx context.Context, c *models.IntegrationConnection, configEncrypted []byte, inboundSecret string) error
	ListConnections(ctx context.Context, orgID uuid.UUID) ([]models.IntegrationConnection, error)
	GetConnection(ctx context.Context, orgID uuid.UUID, provider models.IntegrationProvider, label string) (*models.IntegrationConnection, error)
	GetConnectionByInboundSecret(ctx context.Context, provider models.IntegrationProvider, secret string) (*models.IntegrationConnection, error)
	DeleteConnection(ctx context.Context, orgID, id uuid.UUID) error
	MarkConnectionSynced(ctx context.Context, id uuid.UUID, status models.IntegrationStatus, displayFields json.RawMessage, errMsg string) error

	// DMARC
	UpsertDMARCReport(ctx context.Context, report *models.DMARCReport) error
	ListDMARCReports(ctx context.Context, orgID uuid.UUID, domain string, limit int) ([]models.DMARCReport, error)

	// Postmaster
	UpsertPostmasterSnapshot(ctx context.Context, snap *models.PostmasterSnapshot) error
	ListPostmasterSnapshots(ctx context.Context, orgID uuid.UUID, source, target string, sinceDays int) ([]models.PostmasterSnapshot, error)

	// DNS
	InsertDNSVerification(ctx context.Context, v *models.DNSVerification) error
	ListDNSVerifications(ctx context.Context, orgID uuid.UUID, limit int) ([]models.DNSVerification, error)

	// Bookings
	UpsertMeetingBooking(ctx context.Context, b *models.MeetingBooking) error
	ListMeetingBookings(ctx context.Context, orgID uuid.UUID, limit int) ([]models.MeetingBooking, error)
}

type integrationRepository struct {
	db *pgxpool.Pool
}

func NewIntegrationRepository(db *pgxpool.Pool) IntegrationRepository {
	return &integrationRepository{db: db}
}

// UpsertConnection inserts a new connection or updates an existing
// (org, provider, label) tuple. The encrypted config and inbound secret
// are only written when non-nil/non-empty, so partial updates (e.g. the
// DMARC ingest flow rotating just the inbound secret) don't blow away
// the rest of the config.
func (r *integrationRepository) UpsertConnection(ctx context.Context, c *models.IntegrationConnection, configEncrypted []byte, inboundSecret string) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now

	display := c.DisplayFields
	if len(display) == 0 {
		display = json.RawMessage("{}")
	}

	_, err := r.db.Exec(ctx, `
		INSERT INTO integration_connections (
			id, organization_id, provider, label, status,
			inbound_secret, config_encrypted, display_fields,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		ON CONFLICT (organization_id, provider, label) DO UPDATE SET
			status = EXCLUDED.status,
			inbound_secret = COALESCE(EXCLUDED.inbound_secret, integration_connections.inbound_secret),
			config_encrypted = COALESCE(EXCLUDED.config_encrypted, integration_connections.config_encrypted),
			display_fields = EXCLUDED.display_fields,
			updated_at = EXCLUDED.updated_at
	`,
		c.ID, c.OrganizationID, string(c.Provider), c.Label, string(c.Status),
		nullIfEmptyStr(inboundSecret), nullIfEmptyStrBytes(configEncrypted), display, now,
	)
	return err
}

func nullIfEmptyStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullIfEmptyStrBytes(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	return b
}

func (r *integrationRepository) ListConnections(ctx context.Context, orgID uuid.UUID) ([]models.IntegrationConnection, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organization_id, provider, label, status, display_fields,
		       last_synced_at, last_error, last_error_at, created_at, updated_at
		FROM integration_connections
		WHERE organization_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.IntegrationConnection{}
	for rows.Next() {
		c, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *integrationRepository) GetConnection(ctx context.Context, orgID uuid.UUID, provider models.IntegrationProvider, label string) (*models.IntegrationConnection, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, organization_id, provider, label, status, display_fields,
		       last_synced_at, last_error, last_error_at, created_at, updated_at
		FROM integration_connections
		WHERE organization_id = $1 AND provider = $2 AND label = $3
	`, orgID, string(provider), label)
	c, err := scanConnection(row)
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

// GetConnectionByInboundSecret resolves the connection an incoming webhook
// belongs to. Callers must validate the secret out-of-band (e.g. Calendly
// signature) — this lookup is the org-routing step, not the auth step.
func (r *integrationRepository) GetConnectionByInboundSecret(ctx context.Context, provider models.IntegrationProvider, secret string) (*models.IntegrationConnection, error) {
	if secret == "" {
		return nil, nil
	}
	row := r.db.QueryRow(ctx, `
		SELECT id, organization_id, provider, label, status, display_fields,
		       last_synced_at, last_error, last_error_at, created_at, updated_at
		FROM integration_connections
		WHERE provider = $1 AND inbound_secret = $2
		LIMIT 1
	`, string(provider), secret)
	c, err := scanConnection(row)
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *integrationRepository) DeleteConnection(ctx context.Context, orgID, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM integration_connections WHERE organization_id = $1 AND id = $2`,
		orgID, id,
	)
	return err
}

func (r *integrationRepository) MarkConnectionSynced(ctx context.Context, id uuid.UUID, status models.IntegrationStatus, displayFields json.RawMessage, errMsg string) error {
	now := time.Now().UTC()
	if len(displayFields) == 0 {
		displayFields = json.RawMessage("{}")
	}
	if errMsg == "" {
		_, err := r.db.Exec(ctx, `
			UPDATE integration_connections
			SET status = $1, display_fields = $2, last_synced_at = $3,
			    last_error = NULL, last_error_at = NULL, updated_at = $3
			WHERE id = $4
		`, string(status), displayFields, now, id)
		return err
	}
	_, err := r.db.Exec(ctx, `
		UPDATE integration_connections
		SET status = $1, display_fields = $2,
		    last_error = $3, last_error_at = $4, updated_at = $4
		WHERE id = $5
	`, string(status), displayFields, errMsg, now, id)
	return err
}

type scanner interface {
	Scan(dest ...any) error
}

func scanConnection(row scanner) (*models.IntegrationConnection, error) {
	var c models.IntegrationConnection
	var provider, status string
	if err := row.Scan(
		&c.ID, &c.OrganizationID, &provider, &c.Label, &status, &c.DisplayFields,
		&c.LastSyncedAt, &c.LastError, &c.LastErrorAt, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	c.Provider = models.IntegrationProvider(provider)
	c.Status = models.IntegrationStatus(status)
	if len(c.DisplayFields) == 0 {
		c.DisplayFields = json.RawMessage("{}")
	}
	return &c, nil
}

// ─── DMARC ─────────────────────────────────────────────────────────────

func (r *integrationRepository) UpsertDMARCReport(ctx context.Context, report *models.DMARCReport) error {
	if report.ID == uuid.Nil {
		report.ID = uuid.New()
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Dedupe on (org, reporter, report_id). On conflict, return existing row.
	var existingID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO dmarc_reports (
			id, organization_id, domain, reporter_org, report_id,
			range_start, range_end, total_messages, pass_messages, fail_messages,
			raw_xml, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (organization_id, reporter_org, report_id) DO UPDATE
			SET total_messages = EXCLUDED.total_messages
		RETURNING id
	`,
		report.ID, report.OrganizationID, report.Domain, report.ReporterOrg, report.ReportID,
		report.RangeStart, report.RangeEnd, report.TotalMessages, report.PassMessages, report.FailMessages,
		"",
	).Scan(&existingID)
	if err != nil {
		return err
	}
	report.ID = existingID

	// Clear and re-insert rows (idempotent for re-submissions).
	if _, err := tx.Exec(ctx, `DELETE FROM dmarc_record_rows WHERE report_id = $1`, report.ID); err != nil {
		return err
	}
	for _, row := range report.Rows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dmarc_record_rows (
				report_id, source_ip, message_count, disposition,
				spf_result, dkim_result, spf_domain, dkim_domain, header_from
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`,
			report.ID, row.SourceIP, row.MessageCount, row.Disposition,
			row.SPFResult, row.DKIMResult, row.SPFDomain, row.DKIMDomain, row.HeaderFrom,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *integrationRepository) ListDMARCReports(ctx context.Context, orgID uuid.UUID, domain string, limit int) ([]models.DMARCReport, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows pgx.Rows
	var err error
	if domain == "" {
		rows, err = r.db.Query(ctx, `
			SELECT id, organization_id, domain, reporter_org, report_id,
			       range_start, range_end, total_messages, pass_messages, fail_messages, created_at
			FROM dmarc_reports
			WHERE organization_id = $1
			ORDER BY range_end DESC
			LIMIT $2
		`, orgID, limit)
	} else {
		rows, err = r.db.Query(ctx, `
			SELECT id, organization_id, domain, reporter_org, report_id,
			       range_start, range_end, total_messages, pass_messages, fail_messages, created_at
			FROM dmarc_reports
			WHERE organization_id = $1 AND domain = $2
			ORDER BY range_end DESC
			LIMIT $3
		`, orgID, domain, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.DMARCReport{}
	for rows.Next() {
		var rep models.DMARCReport
		if err := rows.Scan(
			&rep.ID, &rep.OrganizationID, &rep.Domain, &rep.ReporterOrg, &rep.ReportID,
			&rep.RangeStart, &rep.RangeEnd, &rep.TotalMessages, &rep.PassMessages, &rep.FailMessages, &rep.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, rep)
	}
	return out, rows.Err()
}

// ─── Postmaster ────────────────────────────────────────────────────────

func (r *integrationRepository) UpsertPostmasterSnapshot(ctx context.Context, s *models.PostmasterSnapshot) error {
	raw := s.RawPayload
	if len(raw) == 0 {
		raw = json.RawMessage("{}")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO postmaster_snapshots (
			organization_id, source, target, snapshot_date,
			spam_rate_pct, inbox_placement_pct, domain_reputation, ip_reputation,
			dkim_success_pct, spf_success_pct, dmarc_success_pct, raw_payload
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (organization_id, source, target, snapshot_date) DO UPDATE SET
			spam_rate_pct = EXCLUDED.spam_rate_pct,
			inbox_placement_pct = EXCLUDED.inbox_placement_pct,
			domain_reputation = EXCLUDED.domain_reputation,
			ip_reputation = EXCLUDED.ip_reputation,
			dkim_success_pct = EXCLUDED.dkim_success_pct,
			spf_success_pct = EXCLUDED.spf_success_pct,
			dmarc_success_pct = EXCLUDED.dmarc_success_pct,
			raw_payload = EXCLUDED.raw_payload
	`,
		s.OrganizationID, s.Source, s.Target, s.SnapshotDate,
		s.SpamRatePct, s.InboxPlacementPct, s.DomainReputation, s.IPReputation,
		s.DKIMSuccessPct, s.SPFSuccessPct, s.DMARCSuccessPct, raw,
	)
	return err
}

func (r *integrationRepository) ListPostmasterSnapshots(ctx context.Context, orgID uuid.UUID, source, target string, sinceDays int) ([]models.PostmasterSnapshot, error) {
	if sinceDays <= 0 {
		sinceDays = 30
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, organization_id, source, target, snapshot_date,
		       spam_rate_pct, inbox_placement_pct, domain_reputation, ip_reputation,
		       dkim_success_pct, spf_success_pct, dmarc_success_pct, created_at
		FROM postmaster_snapshots
		WHERE organization_id = $1
		  AND ($2 = '' OR source = $2)
		  AND ($3 = '' OR target = $3)
		  AND snapshot_date >= CURRENT_DATE - $4::int
		ORDER BY snapshot_date DESC
	`, orgID, source, target, sinceDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.PostmasterSnapshot{}
	for rows.Next() {
		var s models.PostmasterSnapshot
		if err := rows.Scan(
			&s.ID, &s.OrganizationID, &s.Source, &s.Target, &s.SnapshotDate,
			&s.SpamRatePct, &s.InboxPlacementPct, &s.DomainReputation, &s.IPReputation,
			&s.DKIMSuccessPct, &s.SPFSuccessPct, &s.DMARCSuccessPct, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ─── DNS verifications ─────────────────────────────────────────────────

func (r *integrationRepository) InsertDNSVerification(ctx context.Context, v *models.DNSVerification) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	notes := v.Notes
	if len(notes) == 0 {
		notes = json.RawMessage("{}")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO dns_verifications (
			id, organization_id, domain,
			spf_record, spf_ok,
			dkim_selector, dkim_record, dkim_ok,
			dmarc_record, dmarc_ok,
			tracking_cname, tracking_ok,
			notes, checked_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
	`,
		v.ID, v.OrganizationID, v.Domain,
		v.SPFRecord, v.SPFOK,
		v.DKIMSelector, v.DKIMRecord, v.DKIMOK,
		v.DMARCRecord, v.DMARCOK,
		v.TrackingCNAME, v.TrackingOK,
		notes,
	)
	return err
}

func (r *integrationRepository) ListDNSVerifications(ctx context.Context, orgID uuid.UUID, limit int) ([]models.DNSVerification, error) {
	if limit <= 0 {
		limit = 50
	}
	// Latest verification per domain. The window is a small enough N that
	// DISTINCT ON in a subquery is cheaper than a CTE.
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT ON (domain)
		       id, organization_id, domain,
		       spf_record, spf_ok,
		       dkim_selector, dkim_record, dkim_ok,
		       dmarc_record, dmarc_ok,
		       tracking_cname, tracking_ok,
		       notes, checked_at
		FROM dns_verifications
		WHERE organization_id = $1
		ORDER BY domain, checked_at DESC
		LIMIT $2
	`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.DNSVerification{}
	for rows.Next() {
		var v models.DNSVerification
		if err := rows.Scan(
			&v.ID, &v.OrganizationID, &v.Domain,
			&v.SPFRecord, &v.SPFOK,
			&v.DKIMSelector, &v.DKIMRecord, &v.DKIMOK,
			&v.DMARCRecord, &v.DMARCOK,
			&v.TrackingCNAME, &v.TrackingOK,
			&v.Notes, &v.CheckedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ─── Meeting bookings ──────────────────────────────────────────────────

func (r *integrationRepository) UpsertMeetingBooking(ctx context.Context, b *models.MeetingBooking) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	raw := b.RawPayload
	if len(raw) == 0 {
		raw = json.RawMessage("{}")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO meeting_bookings (
			id, organization_id, source, external_event_id,
			invitee_email, invitee_name, event_name, scheduled_for,
			contact_id, campaign_id, raw_payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (organization_id, source, external_event_id) DO UPDATE SET
			invitee_email = EXCLUDED.invitee_email,
			invitee_name = EXCLUDED.invitee_name,
			event_name = EXCLUDED.event_name,
			scheduled_for = EXCLUDED.scheduled_for,
			contact_id = COALESCE(EXCLUDED.contact_id, meeting_bookings.contact_id),
			campaign_id = COALESCE(EXCLUDED.campaign_id, meeting_bookings.campaign_id),
			raw_payload = EXCLUDED.raw_payload
	`,
		b.ID, b.OrganizationID, b.Source, b.ExternalEventID,
		b.InviteeEmail, b.InviteeName, b.EventName, b.ScheduledFor,
		b.ContactID, b.CampaignID, raw,
	)
	return err
}

func (r *integrationRepository) ListMeetingBookings(ctx context.Context, orgID uuid.UUID, limit int) ([]models.MeetingBooking, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, organization_id, source, external_event_id,
		       invitee_email, invitee_name, event_name, scheduled_for,
		       contact_id, campaign_id, created_at
		FROM meeting_bookings
		WHERE organization_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.MeetingBooking{}
	for rows.Next() {
		var b models.MeetingBooking
		if err := rows.Scan(
			&b.ID, &b.OrganizationID, &b.Source, &b.ExternalEventID,
			&b.InviteeEmail, &b.InviteeName, &b.EventName, &b.ScheduledFor,
			&b.ContactID, &b.CampaignID, &b.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
