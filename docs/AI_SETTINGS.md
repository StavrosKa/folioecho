# AI settings, personal keys and usage

## Two explicit billing modes

- **Demo** uses the operator's server-only `OPENAI_API_KEY` and `OPENAI_MODEL`.
  Each visitor gets five AI attempts per UTC day. The global demo cap remains
  `FOLIOECHO_OPENAI_DAILY_LIMIT` (20 by default). The host covers these costs.
- **Personal** uses only the visitor's encrypted key and chosen supported model.
  Each visitor gets up to 100 AI attempts per UTC day and chooses a daily app
  allowance from $0.01 to $100. It does not consume the sponsored demo's allowance.
  Errors, expiry and invalid keys never silently switch back to host billing.

Switching modes, replacing a key or deleting it does not reset either usage ledger.
The modes are measured separately for the same signed visitor ID and UTC day.
Anonymous visitors can create fresh sessions, so the independent global demo
counter and shared Qloo limits remain essential. This is not account-based billing.

## Personal-key handling

The password field appears only in Settings and requires explicit consent. The key
is sent over the site's HTTPS connection to `/api/ai-settings`. It is encrypted
using AES-256-GCM with a fresh random IV. HKDF derives an encryption-only key from
the private session secret; authenticated data binds the ciphertext to its owner
and expiry. Changing `FOLIOECHO_SESSION_SECRET` invalidates existing connections.
Locally, an ignored private encryption key is created under `FOLIOECHO_DATA_DIR`.

The server never sends the key, a reusable fragment or its ciphertext to clients.
It is not written to localStorage, prompts, reports, source, analytics or logs by
the app. The React password value is cleared when submitted. No API key is sent to
a model except in the Authorization header to the fixed OpenAI HTTPS endpoint.
Organization Admin keys are not requested or supported.

Keys expire after 24 hours. Reading an expired key deletes its live database row.
An hourly Netlify Scheduled Function also deletes expired ciphertext records.
Delete personal key removes the live row immediately and selects demo mode.
Platform database backups may retain encrypted historical records until the
provider's backup retention expires. This is temporary storage for one browser
workspace: do not use shared devices. It does not replace authenticated accounts,
a production secrets manager or the ability to revoke a key in OpenAI's dashboard.

Saving a key does not make a paid verification call or claim successful provider
authentication. Its validity and model access are checked when the user explicitly
starts an AI operation. The host key remains exclusively in server configuration.

## What Settings measures

- AI requests: attempts / the active mode's daily request allowance.
- Qloo planning: planning attempts / six per visitor per day on the hosted demo.
- Tokens: input and output counts returned by OpenAI for this app's requests.
- Cost: an estimate from those reported counts and the supported model's published
  standard short-context rates, including cached input when the response supplies it.
- Cost percentage: estimated app cost / the active mode's daily USD allowance.

The displayed cost is **not an invoice, account balance, remaining OpenAI credits,
or usage across other applications**. Only FolioEcho traffic since this accounting
feature was deployed is recorded. Taxes, regional uplifts, pricing changes and
provider adjustments can change the final charge. Consult OpenAI billing for the
final total. Price references are dated 2026-10-29 and must be reviewed when models
or prices change. Unknown models do not receive invented prices. Existing host
configuration can still use such models, but cost tracking displays unavailable.

`FOLIOECHO_DEMO_DAILY_USD` optionally sets the per-visitor demo cost allowance
(default $0.05), separately from the site's global call cap. Set it privately in
Netlify's runtime environment if needed. It is not an OpenAI account spending limit.

Each model operation acquires a database-backed billing lease for its visitor.
Before a priced request, a conservative reservation uses serialized UTF-8 input
size, format overhead and maximum output tokens. The app declines the request if
this reservation would exceed the remaining estimated daily allowance. Reported
cost then replaces the reservation, even if the result is incomplete or invalid.
If a timeout, transport failure or missing usage prevents reconciliation, the
cost is marked unknown and the reservation remains until the UTC daily reset.
Unknown consumption is never displayed as a confirmed zero charge. Some explicitly
rejected HTTP requests clear the reservation but still count as attempts.

These are application guardrails, not a contractual billing cap or protection for
requests made elsewhere with the same key. Shared demo counters remain atomic
across serverless instances. Existing concurrency and same-origin guards remain.

## Verification

`npm test` covers encryption and ciphertext tampering across visitors, expiry,
deletion, CSRF, consent, response redaction, separate ledgers, mode-switch quota
preservation, cached-token pricing, incomplete results, unknown charges and
pre-request reservations. Tests use synthetic keys and mocked provider responses.
No real OpenAI key is currently available for the deployed demo, so successful
live OpenAI billing or output is not claimed. Complete that smoke test after the
operator configures the demo key/model privately.

References:

- https://developers.openai.com/api/docs/guides/token-counting
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/reference/administration/overview
