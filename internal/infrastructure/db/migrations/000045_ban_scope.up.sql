-- Ban scope. The existing users.banned_at boolean treats every ban as
-- "fully banned" — admins can't say "you can keep your account but no
-- new workspaces" or "no outbound sends until investigation completes".
-- A bitmask on the users row lets us describe the ban's effect without
-- adding new tables or losing the existing audit trail.
--
-- Flags (kept in sync with internal/models/admin.go BanScope constants):
--
--   1 = BanScopeLogin     — block authentication
--   2 = BanScopeOrgCreate — refuse new workspace creation
--   4 = BanScopeSend      — block outbound campaign sends
--
-- 0 = no flags, but banned_at IS NOT NULL still means "banned" for
-- backwards compatibility. New bans default to BanScopeLogin so the
-- pre-existing "fully banned" semantics are preserved. Admins can
-- granulate from there.

ALTER TABLE users ADD COLUMN ban_scope INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD CONSTRAINT ban_scope_non_negative CHECK (ban_scope >= 0);

-- Existing bans get the legacy "everything" scope so nothing changes
-- silently at deployment time.
UPDATE users SET ban_scope = 1 WHERE banned_at IS NOT NULL;
