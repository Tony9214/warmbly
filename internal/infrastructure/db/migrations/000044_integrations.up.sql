-- Third-party integration connection state. Each row is one org's link to
-- one provider (calendly, google_sheets, cloudflare, etc). Per-provider
-- configuration (sheet IDs, zone IDs, OAuth tokens) lives in the encrypted
-- config JSON blob — never serialized back to the API in plaintext.
--
-- This is the control-plane table the dashboard reads to render the
-- integrations page. Per-provider operational data (DMARC report rows,
-- Postmaster snapshots) lives in the dedicated tables below.

CREATE TABLE integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Provider key (e.g. 'calendly', 'cal_com', 'google_sheets',
    -- 'google_postmaster', 'microsoft_snds', 'dmarc', 'cloudflare',
    -- 'godaddy', 'namecheap'). Validated in app code, not the DB, so a new
    -- provider does not require an enum migration.
    provider TEXT NOT NULL,

    -- Human-readable label set by the user (e.g. "Main Cloudflare account").
    -- Defaults to the provider key if not set.
    label TEXT NOT NULL DEFAULT '',

    -- Operational state — drives the badge on the dashboard.
    --   pending     : record exists but connection not finished (e.g. OAuth
    --                 mid-flight, or DNS verification still pending)
    --   connected   : healthy, last interaction succeeded
    --   degraded    : connected but last poll/dispatch errored
    --   disconnected: token revoked or auth failure
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'connected', 'degraded', 'disconnected')),

    -- Inbound webhook secret. For providers that POST to us
    -- (Calendly, Cal.com, DMARC mail forwarder). Per-org-per-provider so
    -- a leaked secret only affects one customer.
    inbound_secret TEXT,

    -- Encrypted provider-specific config. Shape is per-provider — keys
    -- like { "api_token": "...", "zone_id": "...", "sheet_id": "..." }.
    -- The encryption envelope lives in the existing KMS/DEK system; we
    -- only store the sealed blob here. Plaintext is never returned to the
    -- API consumer — only the dashboard sees redacted display fields.
    config_encrypted BYTEA,

    -- Public display fields — what the UI shows next to "connected" state.
    -- Never includes secrets. Examples: connected account email, sheet
    -- title, DNS zone name.
    display_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, provider, label)
);

CREATE INDEX idx_integration_connections_org
    ON integration_connections (organization_id, provider);

-- DMARC aggregate (RUA) report ingestion. Each XML report from a mailbox
-- provider becomes one row; per-source-IP records get split into
-- dmarc_record_rows so the dashboard can show "sender X.X.X.X passed SPF
-- but failed DKIM on N messages."

CREATE TABLE dmarc_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Domain the report was generated for (the `<policy_published><domain>`
    -- field in the RUA XML).
    domain TEXT NOT NULL,

    -- Reporting org (e.g. "google.com", "Yahoo! Inc.") and external report
    -- ID — used to dedupe re-submissions.
    reporter_org TEXT NOT NULL,
    report_id TEXT NOT NULL,

    range_start TIMESTAMPTZ NOT NULL,
    range_end TIMESTAMPTZ NOT NULL,

    total_messages BIGINT NOT NULL DEFAULT 0,
    pass_messages BIGINT NOT NULL DEFAULT 0,
    fail_messages BIGINT NOT NULL DEFAULT 0,

    -- Raw XML for re-parse / debugging.
    raw_xml TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, reporter_org, report_id)
);

CREATE INDEX idx_dmarc_reports_domain ON dmarc_reports (organization_id, domain, range_end DESC);

-- One row per <record> in the DMARC XML. Stores the per-IP failure detail
-- so the dashboard can flag specific senders ("a forwarder at X.X.X.X is
-- breaking your SPF alignment").
CREATE TABLE dmarc_record_rows (
    id BIGSERIAL PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES dmarc_reports(id) ON DELETE CASCADE,
    source_ip INET NOT NULL,
    message_count BIGINT NOT NULL,
    disposition TEXT NOT NULL,  -- 'none' | 'quarantine' | 'reject'
    spf_result TEXT NOT NULL,   -- 'pass' | 'fail' | 'softfail' | 'neutral'
    dkim_result TEXT NOT NULL,
    spf_domain TEXT,
    dkim_domain TEXT,
    header_from TEXT
);

CREATE INDEX idx_dmarc_record_rows_report ON dmarc_record_rows (report_id);

-- Google Postmaster Tools + Microsoft SNDS snapshots. One row per daily
-- pull per (domain or IP). The dashboard reads the latest N rows to draw
-- the deliverability trend graph.
CREATE TABLE postmaster_snapshots (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 'google_postmaster' or 'microsoft_snds'.
    source TEXT NOT NULL,

    -- For Google: domain. For SNDS: IP address (string).
    target TEXT NOT NULL,

    snapshot_date DATE NOT NULL,

    -- 0-100 percentage scales. nullable when the provider does not report
    -- the metric for that date / target.
    spam_rate_pct NUMERIC(5, 2),
    inbox_placement_pct NUMERIC(5, 2),
    domain_reputation TEXT,      -- 'high' | 'medium' | 'low' | 'bad'
    ip_reputation TEXT,
    dkim_success_pct NUMERIC(5, 2),
    spf_success_pct NUMERIC(5, 2),
    dmarc_success_pct NUMERIC(5, 2),

    raw_payload JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, source, target, snapshot_date)
);

CREATE INDEX idx_postmaster_snapshots_recent
    ON postmaster_snapshots (organization_id, source, target, snapshot_date DESC);

-- DNS verification snapshots. Each call to /integrations/dns/check writes
-- a row with the resolved SPF, DKIM, DMARC, and tracking-domain records.
-- The dashboard renders the latest row per domain.
CREATE TABLE dns_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,

    spf_record TEXT,
    spf_ok BOOLEAN NOT NULL DEFAULT FALSE,

    dkim_selector TEXT,
    dkim_record TEXT,
    dkim_ok BOOLEAN NOT NULL DEFAULT FALSE,

    dmarc_record TEXT,
    dmarc_ok BOOLEAN NOT NULL DEFAULT FALSE,

    tracking_cname TEXT,
    tracking_ok BOOLEAN NOT NULL DEFAULT FALSE,

    notes JSONB NOT NULL DEFAULT '{}'::jsonb,

    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dns_verifications_recent
    ON dns_verifications (organization_id, domain, checked_at DESC);

-- Calendly + Cal.com bookings. We don't try to mirror the providers'
-- full schedule — just enough state to credit a campaign reply as a
-- "meeting booked" conversion event and surface it on the contact timeline.
CREATE TABLE meeting_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    source TEXT NOT NULL,  -- 'calendly' | 'cal_com'

    -- Provider's event identifier — used to dedupe replays of the
    -- "invitee.created" webhook.
    external_event_id TEXT NOT NULL,

    invitee_email TEXT NOT NULL,
    invitee_name TEXT NOT NULL DEFAULT '',
    event_name TEXT NOT NULL DEFAULT '',

    scheduled_for TIMESTAMPTZ,

    -- Joined to a Warmbly contact + campaign if we can match the email.
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    raw_payload JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, source, external_event_id)
);

CREATE INDEX idx_meeting_bookings_contact ON meeting_bookings (contact_id);
CREATE INDEX idx_meeting_bookings_recent ON meeting_bookings (organization_id, created_at DESC);
