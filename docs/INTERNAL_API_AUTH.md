# Internal API Auth

The backend exposes a set of internal endpoints under `/api/v1/internal/*` that
workers and other backend processes call. These are not user-facing — they sit
behind a dedicated bearer-token middleware so workers can fetch encrypted DEKs,
their runtime config, and report heartbeats without ever opening a Postgres
connection of their own.

## Endpoints

| Method  | Path                              | Caller            | Purpose                              |
|---------|-----------------------------------|-------------------|--------------------------------------|
| GET     | `/api/v1/internal/dek/:orgID`    | worker            | Fetch an organization encrypted DEK         |
| PUT     | `/api/v1/internal/dek/:orgID`    | worker (rarely)   | Store a new encrypted DEK            |
| DELETE  | `/api/v1/internal/dek/:orgID`    | admin / cleanup   | Delete an encrypted DEK              |
| GET     | `/api/v1/internal/worker/config`  | worker            | Fetch runtime config for the worker  |
| POST    | `/api/v1/internal/worker/heartbeat` | worker          | Liveness report                      |

## How auth works

A single static bearer token, sourced from the `INTERNAL_API_TOKEN` environment
variable on the backend, gates every endpoint in the group. Workers send the
same token in `Authorization: Bearer …`.

```
Worker                              Backend
------                              -------
GET /api/v1/internal/dek/<uuid>
Authorization: Bearer <token>  --->
                                    middleware.InternalAuthMiddleware
                                      └─ subtle.ConstantTimeCompare token
                                    if OK -> handler runs
                                    if NOT -> 401 Unauthorized
                              <---  200 OK { "encrypted_data_key": "..." }
                                or  401 Unauthorized
                                or  404 Not Found (no DEK)
```

### Fail-closed

If `INTERNAL_API_TOKEN` is unset on the backend, the middleware rejects every
request with `401`. This is deliberate: workers must not be able to read DEKs
from a misconfigured server that silently accepts unauthenticated calls.

### Timing-safe compare

The token check uses `crypto/subtle.ConstantTimeCompare` so that an attacker
can't recover the token byte-by-byte via timing differences.

### Where the token lives

| Process     | Env var                              | Used for                              |
|-------------|--------------------------------------|---------------------------------------|
| Backend     | `INTERNAL_API_TOKEN`                 | Validates incoming worker requests    |
| Worker      | `ENCRYPTED_KEYS_WORKER_TOKEN`        | Sends in `Authorization` header       |

Both must hold the same string. In the self-hostable installer, the operator
sets `INTERNAL_API_TOKEN` once on the backend and passes the same value as
`ENCRYPTED_KEYS_WORKER_TOKEN` to each worker via the install script.

A reasonable token is 32 bytes of base64:

```bash
openssl rand -base64 32
```

Treat it like a password. Rotate by:

1. Set the new token as a secondary value the backend will also accept (not yet
   implemented — for now, plan a short coordinated swap window).
2. Roll the workers (`install-worker.sh --update` after updating the env).
3. Remove the old token from the backend.

## Why a shared token (for now)

It's the simplest primitive that satisfies the constraint: workers reach
backend endpoints without touching the user-facing session/cookie auth. Workers
are not "users" — they don't have a UI session, OAuth flow, or refresh token
cycle. A shared bearer satisfies the "internal service identity" use case
without overbuilding.

## Planned: per-worker JWTs

The shared bearer is convenient but coarse. The follow-up plan, tracked
alongside the worker config endpoint:

1. Each worker registers once via `POST /api/v1/worker/register` with the
   shared bootstrap token.
2. The backend mints a per-worker JWT signed with a backend-private key. The
   JWT carries the worker ID and tier in its claims.
3. Workers send the JWT instead of the bootstrap token on all subsequent
   calls. The middleware verifies the signature and reads claims.
4. The bootstrap token becomes a one-shot used only on first install.

Benefits: ability to revoke a single worker without rotating the whole fleet,
audit-log a specific worker's actions, and tier-gate DEK access (e.g., a
free-tier worker can only request DEKs for free-tier organizations).

Implementation lives behind Task #9 in the project tracker.

## Where it lives in the code

- Middleware: `internal/api/middleware/internal_auth.go`
- Handlers: `internal/api/handler/internal_dek.go`,
  `internal/api/handler/internal_worker_config.go`
- Routes: `internal/api/routes.go` (search for `/api/v1/internal`)
- Worker-side client: `internal/infrastructure/encryptedkeys/http.go`
- Tests: `internal/api/middleware/internal_auth_test.go`,
  `internal/api/handler/internal_dek_test.go`
