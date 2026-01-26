-- Track email status for each contact in each campaign sequence
CREATE TABLE campaign_contact_progress (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,

    PRIMARY KEY (campaign_id, contact_id, sequence_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_campaign_progress_campaign ON campaign_contact_progress(campaign_id);
CREATE INDEX idx_campaign_progress_contact ON campaign_contact_progress(contact_id);
CREATE INDEX idx_campaign_progress_sent ON campaign_contact_progress(campaign_id, sent_at) WHERE sent_at IS NOT NULL;
