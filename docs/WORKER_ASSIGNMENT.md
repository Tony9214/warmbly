# Worker Assignment, Tiers, and Risk Pools

How the control plane decides which worker a mailbox lands on. All of this is
backend/consumer logic — workers never make placement decisions and never
touch Postgres. The hot path is `internal/app/worker/assignment.go`
(`AssignWorkerToEmail`); the steady-state corrector is the hourly risk
rebalancer (`internal/app/consumer/risk_rebalancer.go`).

## Tier model

Three capacities, encoded on the `workers` row as `(worker_type, free_tier)`:

| Tier             | `worker_type` | `free_tier` | Who picks it                  |
| ---------------- | ------------- | ----------- | ----------------------------- |
| shared free      | `shared`      | `true`      | free-trial orgs               |
| shared premium   | `shared`      | `false`     | paying orgs (no dedicated)    |
| dedicated        | `dedicated`   | `false`     | **control plane only**        |

Tier separation is strict: a free-tier mailbox never lands on a premium
worker and vice versa.

### Dedicated is auto-allocated, never hand-picked

Admins and customers only ever choose **free or premium**. Dedicated capacity
is created by the control plane:

- `dedicated` is rejected server-side at every request boundary — the worker
  heartbeat (`InternalWorkerHeartbeat`) and admin provisioning
  template/job creation/update (`admin_provisioning.go`). The reject carries a
  stable `tier_not_allowed` code. The single authority for this rule is
  `repository.IsClientRequestableTier` (next to `tierToColumns`). A blank tier
  is still allowed and maps to the shared-premium default, so existing workers
  that don't set `WORKER_TIER` keep auto-registering.
- The admin provisioning UI only offers the two shared tiers
  (`admin/.../ProvisioningTemplateForm.tsx`).

When an org needs a dedicated worker — on a plan upgrade
(`MigrateOrgToDedicated`, fired from the Stripe webhook) or when a mailbox is
added for a dedicated-plan org that has none bound yet — `AssignDedicatedWorker`:

1. tries `GetAvailableDedicatedWorker` (a pre-provisioned, unbound dedicated box);
2. if none is free, **promotes a spare** idle premium shared worker to
   dedicated (`PromoteIdlePremiumWorkerToDedicated`: `worker_type = 'shared'`,
   `free_tier = false`, `account_count = 0`, selected `FOR UPDATE SKIP LOCKED`
   so concurrent promotions can't collide). Only idle workers are eligible, so
   a promotion never strands existing mailboxes on a box that suddenly belongs
   to one org;
3. binds it via `CreateDedicatedAssignmentIfNotExists`. If the bind race is
   lost (the org was bound concurrently) and we had just promoted a worker, the
   promotion is reverted back to `shared` so it isn't stranded as an unbound
   dedicated box;
4. only if there's nothing to promote either does it surface
   `ErrNoDedicatedWorkers` — in the hot path that degrades gracefully to shared
   premium placement (the rebalancer / next onboarding retries).

## Risk-band placement (health segregation)

Shared workers are bucketed into risk pools (`workers.risk_pool`:
`clean` / `risky` / `quarantine`); mailboxes carry a matching
`email_accounts.risk_band` derived from warmup health by the rebalancer
(`RiskBandFromHealth`). The invariant is
`email.risk_band.MatchingRiskPool() == worker.risk_pool`.

**Initial placement is strict.** `AssignWorkerToEmail` reads the mailbox's band
(`GetEmailAccountRiskBand`) and places via `selectSharedWorkerForBandWeight`:

- **clean band** → the capacity-aware path (`selectSharedWorkerForWeight`),
  unchanged: honours per-mailbox weight and worker headroom. A fresh mailbox is
  `clean` (column default until the warmup sweep classifies it), so onboarding
  takes this path.
- **risky / quarantine band** → placed **only** on a worker whose `risk_pool`
  matches. If that pool has no worker, an idle clean worker is **promoted** into
  the pool (`PromoteWorkerToPool`, idle-only + `FOR UPDATE SKIP LOCKED`) rather
  than diluting the clean pool. If there's nothing to promote, placement
  **refuses** (`ErrNoAvailableWorkers`) — a risky/quarantine inbox is never
  co-located with trusted ones. Onboarding treats the refusal as non-fatal and
  the rebalancer retries next tick.

`SelectSharedWorkerForBand` (used by the rebalancer, which has no per-mailbox
weight) now delegates to the same strict logic with the default weight, so
**initial placement and rebalancing share identical rules** and cannot fight.
Existing risky mailboxes already sitting on a clean worker are left for the
rebalancer to migrate; `AssignWorkerToEmail` only governs new placement.

Promotions (shared→dedicated, clean→risk-pool) are logged at info level for ops
visibility; the rebalancer additionally writes an admin audit log per mailbox
migration.

## Backwards compatibility

Installs that never enable risk pools leave every worker in `risk_pool =
'clean'` and every mailbox in `risk_band = 'clean'`, so placement always takes
the clean capacity-aware path — behaviour is unchanged. Dedicated workers carry
no risk-pool semantics (one customer per worker, no cross-tenant contamination).
