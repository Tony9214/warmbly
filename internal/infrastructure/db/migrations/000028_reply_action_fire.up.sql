-- Instant reply-triggered action chains: when an inbound reply is classified, a
-- matching reply_* branch on the contact's current step fires that branch's
-- action chain IMMEDIATELY (targeted at that one contact) instead of waiting for
-- the contact's next scheduled step boundary.
--
-- reply_actions_fired_at is the exactly-once idempotency gate for that instant
-- fire. It is stamped the first time a reply event fires the chain for a given
-- (campaign, contact, step) progress row, and the firing path claims it with a
-- conditional `WHERE reply_actions_fired_at IS NULL` UPDATE so a redelivered /
-- duplicated reply event (or an auto-reply followed by a human reply on the same
-- step) can never run the chain twice. Nullable: NULL means "not yet fired".
ALTER TABLE campaign_contact_progress
    ADD COLUMN IF NOT EXISTS reply_actions_fired_at timestamptz;
