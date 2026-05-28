-- Admin outreach log. Every mail sent from the admin composer is
-- recorded here for audit. The send itself goes through the platform
-- transactional mailer (SES in prod, mailpit in dev) with a configurable
-- Reply-To so customer replies route to a real Warmbly inbox instead of
-- the noreply alias.
--
-- to_user_id / to_org_id are the resolved targets when the admin picks
-- a known account; to_email is always populated (the actual recipient).
-- Pick-by-email sends leave both *_id columns nil but still record the
-- raw address.

CREATE TYPE admin_outreach_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE admin_outreach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_by UUID NOT NULL REFERENCES users(id),

    to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_org_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
    to_email   VARCHAR(320) NOT NULL,

    reply_to VARCHAR(320),
    subject  TEXT NOT NULL,
    body     TEXT NOT NULL,

    status admin_outreach_status NOT NULL DEFAULT 'queued',
    error  TEXT,

    sent_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_outreach_sent_by ON admin_outreach_messages(sent_by, created_at DESC);
CREATE INDEX idx_admin_outreach_status ON admin_outreach_messages(status, created_at DESC);
CREATE INDEX idx_admin_outreach_to_user ON admin_outreach_messages(to_user_id) WHERE to_user_id IS NOT NULL;
CREATE INDEX idx_admin_outreach_to_org ON admin_outreach_messages(to_org_id) WHERE to_org_id IS NOT NULL;
