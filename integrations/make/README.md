# Warmbly for Make

The Warmbly [Make.com](https://www.make.com/) Custom App, built in the Make Apps SDK format (IML / `.iml.json`). It exposes Warmbly triggers, actions, and searches over the public API at `https://api.warmbly.com/v1`, authenticated with OAuth2. It is a 1:1 port of the [Zapier integration](../zapier/) and tracks the same API contract.

The customer-facing guide lives at [docs.warmbly.com/guides/make](https://docs.warmbly.com/guides/make/).

## What's inside

This is the [Make Apps "local development"](https://docs.integromat.com/apps/) layout: a single `makecomapp.json` manifest that references every component's code files. Each component lives in its own directory.

- **Connection** (`connections/warmbly/`): OAuth2 authorization-code with rotating refresh tokens. The connection test and label come from `GET /v1/me` (`{{organization_name}} ({{email}})`). Scopes are least-privilege: contacts, campaigns, mailboxes, the inbox, CRM, templates, and read-only analytics.
- **Base** (`general/base.iml.json`): sets the API base URL, the bearer `Authorization` header on every request, and the shared error handler (surfaces the API `code` and `request_id`). Module `api.iml.json` files use relative paths.
- **Modules** (`modules/`, 57 total):
  - **Triggers** (10, polling): New Contact, New or Updated Contact, New Email Received (Unibox), New Meeting Booked, New Deal, Deal Won, New CRM Task, New Campaign, Campaign Completed, New Mailbox Connected.
  - **Actions** (38): contacts (create-or-update, update, delete, add/remove campaign, note create/update/delete), email and inbox (send, reply, verify, mark seen), CRM (deal create/update/delete, task create/update/delete), campaigns (create, update, delete, start, stop), mailboxes (update, delete, warmup start/pause/resume/stop), templates (create, update, delete, render), meetings (log, delete), groups (create category/tag/folder).
  - **Searches** (9): Find Contact, Find Deal, Find CRM Task, Find Campaign, Find Mailbox, Find Meeting, Find Reply Template, Get Campaign Analytics, Get Dashboard Analytics.
- **RPCs** (`rpcs/`, 6): hidden remote procedure calls that power the dynamic dropdowns referenced from inputs as `rpc://<name>`: `campaignList`, `mailboxList`, `pipelineList`, `stageList` (depends on the selected pipeline), `templateList`, `contactList`.
- **Functions** (`functions/`, 1): `filterByStatus`, used by Campaign Completed to filter the campaign list client-side (the `/campaigns` endpoint has no status query param).

### Why triggers poll instead of using webhooks

Warmbly's webhook subscriptions created by an OAuth app must echo a verification challenge back on a server-to-server `webhook.test` POST (see `internal/app/webhook/service.go`). Make's mailhook/webhook URL returns `200` but cannot echo an arbitrary challenge token, so an OAuth-created webhook would never verify and never receive events. Polling is therefore the reliable mechanism: each trigger reads a list endpoint on the scenario's schedule and Make dedupes by the `trigger.id`.

Instant (webhook) triggers are possible with a small additive backend change: an authenticated `POST /v1/webhooks/:id/confirm` that lets the credential owner verify the endpoint without the async echo. See the integration design notes / PR description.

### Polling caveats

Each trigger reads the first ~100 rows of a list endpoint, newest-first. Triggers ordered by the same field as the event are fully reliable at any volume:

- newest-first by `created_at`: New Contact, New Deal, New CRM Task, New Campaign, New Mailbox, New Email Received (`internal_date`). New or Updated Contact sorts by `updated_at` so edits re-surface (its `trigger.id` combines the contact id with the update time).

Triggers where the event time differs from the list order are best-effort and can miss the tail only in high-volume workspaces:

- **New Meeting Booked** lists by `scheduled_for DESC`, not booking time.
- **Campaign Completed** and **Deal Won** poll creation-ordered lists and filter by status (`filterByStatus` and the `status=won` query, respectively), so a status change on a much older record can fall past the first 100.

The robust fix for all three is instant webhook triggers (see above). For typical workspaces polling catches everything.

## Prerequisites

1. Register an OAuth application in the Warmbly dashboard (`POST /v1/oauth/applications`, or Settings -> Developer -> OAuth apps). Set the redirect URI to Make's callback:
   ```
   https://www.make.com/oauth/cb/app
   ```
   (Make shows the exact value under your app's connection settings; self-hosted/white-label Make instances differ.)
2. Note the `client_id` (`wmcid_...`) and `client_secret` (`wmcs_...`, shown once).
3. Request these scopes on the app: `read_emails write_emails send_campaigns read_campaigns write_campaigns read_contacts write_contacts bulk_contacts read_unibox write_unibox read_crm write_crm read_templates write_templates read_analytics` (`write_emails` backs mailbox update/delete and warmup; `bulk_contacts` backs Remove Contact from Campaign; `read_analytics` backs the analytics searches).

## Credentials

The OAuth client id and secret are read from the `common` code files (`general/common.json` and `connections/warmbly/common.json`) as `{{common.clientId}}` / `{{common.clientSecret}}`. They are committed here as empty placeholders. Set the real values on the deployed app in the Make Apps editor (Common Data); never commit them.

## Layout

```
makecomapp.json          App manifest (lists every component + its code files)
general/
  base.iml.json          base URL, auth header, shared error handler
  common.json            clientId / clientSecret (placeholders)
  groups.json            module grouping for the UI
connections/warmbly/
  api.iml.json           OAuth authorize / token / refresh / info (GET /v1/me)
  scope.iml.json         default requested scopes
  scopes.iml.json        scope catalog (name -> description)
  common.json            clientId / clientSecret (placeholders)
  parameters.iml.json    connection parameters (none for the managed app)
modules/<moduleKey>/
  api.iml.json           communication (request + response)
  parameters.iml.json    mappable input fields
  interface.iml.json     output fields
  samples.iml.json       sample output
rpcs/<rpcName>/
  api.iml.json           dropdown source (label/value)
  parameters.iml.json    rpc parameters
functions/filterByStatus/
  code.js  test.js       IML helper used by Campaign Completed
```

## Develop and deploy

Use the [Make Apps Editor](https://marketplace.visualstudio.com/items?itemName=Integromat.apps-sdk) VS Code extension: open this folder, it reads `makecomapp.json`, and you can edit components locally and deploy to your Make organization. You can also build the app in the online Apps editor and paste each component's IML.

There is no compile step: IML files are interpreted by Make. The fastest local check is JSON validity of every `.iml.json` / `.json` file plus the JS in `functions/`:

```bash
# every .iml.json / .json must be valid JSON
find . -name '*.iml.json' -o -name '*.json' | grep -v node_modules
```
