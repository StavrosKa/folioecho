# AI settings, personal keys and usage

## Explicit modes and providers

**Demo** uses only the host's Gemini credential. Set server-only `GEMINI_API_KEY`
(or `GOOGLE_API_KEY`), `GEMINI_MODEL` and `GEMINI_BILLING_TIER`. The default model is
`gemini-3.5-flash-lite`; `gemini-2.5-flash-lite` is also supported. Both have a Google
Free tier, subject to project eligibility, quotas and terms. A key alone does not
prove free billing. `free` must be explicitly declared by the project owner;
`paid` and `unknown` use published paid rates for estimates. No inference from the
key, and no automatic fallback to OpenAI, occurs.

Locally, `node scripts/setup-gemini.mjs` reads a hidden credential and saves it
outside the repository in `~/.folioecho/gemini.json`. Runtime variables override
that configuration; hosted deployments never read local user configuration.
The previous OpenAI setup script remains available for legacy private configuration,
but it no longer selects the demo provider. Connect OpenAI through Usage & Billing.

Each visitor gets ten demo AI attempts per UTC day. The global sponsored cap is
`FOLIOECHO_GEMINI_DAILY_LIMIT` (20 by default). The host covers any charges. Each
visitor's estimated cost allowance is `FOLIOECHO_DEMO_DAILY_USD` (default $0.05).
Existing demo accounting is retained through the provider transition.

**Personal** connections may use OpenAI or Google Gemini. Usage & Billing offers provider
and model selection, an explicit Gemini project tier, consent and a daily app
allowance from $0.01 to $100. Both keys may be retained temporarily; users explicitly
select one. Each provider has its own personal ledger and allowance of 100 attempts
per UTC day. Switching modes, keys, models or billing tiers does not reset usage.
Previously recorded costs are not retroactively repriced. Personal connections
never silently fall back to another provider or sponsored billing after an error
or expiry. Deleting the active key explicitly selects demo; deleting an inactive
key leaves the active provider unchanged.

Anonymous visitors can create fresh sessions. The independent shared demo counter
and Qloo caps are therefore essential; these controls are not account-based billing.

## Credential handling

The Usage & Billing password field requires consent. It sends the key over HTTPS to
`/api/ai-settings`; it is never written to localStorage, returned in status, added
to prompts/reports, or logged by the app. The field clears on submission and on
provider changes. AES-256-GCM encrypts each key with a fresh IV. HKDF derives a
provider-specific encryption key from the private session secret. Authenticated
data binds the ciphertext to its visitor, provider and expiry. Legacy OpenAI
records remain readable without weakening Gemini's provider binding.

Keys expire after 24 hours. Reads remove expired keys; the hourly cleanup Function
removes old OpenAI and Gemini ciphertext rows. Delete removes the live key row and
connection metadata. Encrypted historical rows may remain in platform backups for
the provider's backup retention period. Local encryption material is in the ignored
private data directory. Rotating `FOLIOECHO_SESSION_SECRET` invalidates connections.
This temporary anonymous workspace is intended for one's own device, not shared
computers or a replacement for authenticated business accounts and key revocation.

The server sends keys only in headers to fixed HTTPS destinations: OpenAI's
`Authorization: Bearer` or Google's `x-goog-api-key`. No URL query credentials,
arbitrary endpoints, redirects, tools or automatic retries are used. The API model
must belong to the supported provider list. A saved key is not claimed to be valid
until an explicitly started AI operation succeeds. Saving/refreshing Usage & Billing makes
no provider request. Host credentials remain exclusively on the server.

Gemini keys are treated as opaque credentials, including newer Google auth keys.
Both Usage & Billing and the terminal share a bounded, transport-safe syntax check rather
than requiring the legacy `AIza` prefix. Authenticity is checked by Google only
when an AI operation is explicitly requested.

Only supplied public book records and cultural evidence enter model prompts.
Google's project tier and data terms apply; review them before choosing a tier.

## What Usage & Billing measures

- Requests: attempts / the active mode/provider's daily app allowance.
- Qloo: planning attempts / six per visitor per UTC day online.
- Tokens: provider-reported input and output; Gemini output includes thinking.
- Cost: reported tokens multiplied by published standard text rates, including
  cached input. Free-tier Gemini requests use zero rates only after an explicit
  tier declaration. Unknown or missing usage remains unknown, even on Free tier.
- Cost percentage: accumulated app cost / the chosen daily USD allowance.

These are **app estimates, not a provider balance, quota meter or invoice**. Google
rate limits, other applications, taxes, billing adjustments, pricing changes and
unverified tier declarations can change the actual bill. Use the provider's billing
dashboard for final totals. Prices were checked on 2026-10-29. Unknown models are
rejected rather than assigned invented prices. Paid Gemini text rates per million:
3.5 Flash-Lite input $0.30, cached $0.03, output/thinking $2.50; 2.5 Flash-Lite input
$0.10, cached $0.01, output/thinking $0.40. No search, explicit caching or storage
charges are introduced by the adapter.

Database billing leases serialize requests and credential changes for each visitor.
Before a priced call, UTF-8 payload bytes plus schema overhead and the bounded output
reserve estimated cost. Reported cost replaces the reservation even if output is
incomplete. Timeouts or missing usage keep the reservation until the UTC reset and
mark costs incomplete. Explicit HTTP rejections can clear reservations while still
counting attempts. Provider response bodies and transport error details are not
shown to users. Existing same-origin and concurrency guards remain in place.

## Verification and deployment boundary

Automated tests use synthetic keys, disposable local storage and mocked responses.
They cover OpenAI compatibility, fixed Gemini requests, thinking/cache accounting,
free-tier consent, missing usage, partial output, encrypted owner/provider binding,
legacy ciphertext, expiry/deletion, CSRF, separate ledgers, preserved quotas and no
fallback. A successful build is not a live model authentication test.

This update is local until the requested final upload. A local live smoke test on 2026-10-29 authenticated successfully and completed one minimal structured request through the Gemini backend with the configured `gemini-3.5-flash-lite` model. The private configuration was repaired after an exact double paste; repeated credential input is now rejected. A subsequent local test successfully returned validated genres/themes for all 12 catalogue books. No credentials were printed or added to this repository. Hosted authentication, editorial output, usage and a what-if flow still require verification after the final deployment.

References:

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/terms
- https://developers.openai.com/api/docs/pricing

## Gemini structured-output compatibility

Gemini REST requests use the documented `generationConfig.responseFormat.text` JSON schema configuration. Nested array bounds are described in the decoding schema to reduce grammar complexity. Every result is then checked against the original schema, including list bounds, required fields, IDs, enums and extra fields, before it can count as completed or reach the UI. OpenAI keeps its existing strict schema request. A full 12-book local enrichment request returned HTTP 200 after this change.

## Catalogue categories

The catalogue displays up to eight broad themes rather than a separate card for every AI-enriched tag. Deterministic semantic rules give immediate coverage; original detailed tags remain unchanged. Each category counts distinct book IDs, so multiple related tags on one book never inflate its count. Counts update from current catalogue data and filters select actual member IDs.

**Refine with Gemini** uses the explicitly selected Gemini connection and the existing accounting/billing lease. It sends only up to 150 distinct tags (80 characters each), eight fixed category definitions and a whitelist of local artwork IDs. Every tag must be returned exactly once; category IDs, artwork IDs and output structure are validated before replacing the visitor-scoped saved mapping. Errors preserve the previous mapping. No model-generated SVG, image URLs, new categories or invented tags are accepted. The local rule-based groups cover newly added tags until the next explicit refinement. A successful local live test assigned all 99 supplied tags and returned eight illustrated categories.
