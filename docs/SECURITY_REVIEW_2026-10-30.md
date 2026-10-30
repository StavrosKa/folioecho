# Local security and functional review — 2026-10-30

Scope: current working tree, local HTTP runtime, automated tests, browser navigation,
production builds and npm production dependency advisories. This is an engineering
review, not a penetration-test certification. No push, deploy, release, package
publication or hosted configuration changes were performed. No new live model
requests were made for this review. Tests use synthetic credentials and mocked
provider responses; existing real Qloo runs were inspected.

## Confirmed issues fixed

| Finding | Impact | Change |
| --- | --- | --- |
| Workspace accepted drafts after checking little more than the title | Missing/non-string dates, duplicate IDs and malformed source references could be saved and break the Planner/Overview | Validate complete draft shape, calendar dates, clock times, capacity, status, programme and source structure before persistence. Regression tests prove invalid saves preserve previous data. Source validation is structural; it does not certify user-supplied provenance. Canonical Plan this event still validates the owned Qloo run. |
| Catalogue fields had no individual size limits | Large strings/tag arrays could inflate processing, layout, prompts and reports despite the overall request limit | Bound IDs, titles, authors, tag counts/lengths and stock. Existing sample and ordinary imports pass. |
| Qloo HTTP client followed redirects | An unexpected upstream redirect could forward its custom API-key header | Reject redirects, matching the existing AI transport policy. |
| Missing explicit anti-framing policy | The hosted UI could be embedded in another site's frame | Add Netlify X-Frame-Options DENY and CSP frame-ancestors/object-src/base-uri directives. These are local configuration changes until deployed. |
| Overview links opened Event Studio without selecting the advertised section | See agent trace / Inspect evidence could open event ideas instead | Route these buttons to the trace / graph tabs without calling providers. |
| Removed Overview status UI still fetched unused status | Unnecessary request and three unused-symbol hints | Remove the obsolete effect and import. The read-only status endpoint remains available. |

## Security checks

- Reviewed signed anonymous cookies (HttpOnly, Secure, SameSite=Lax), signature
  timing comparison, expiry and allowed hosted origin checks.
- Reviewed same-origin writes, visitor-bound storage queries, parameterized SQL,
  owner-specific billing/planning leases, worker HMAC/expiry and job redelivery.
- Existing tests cover parallel visitor isolation for workspaces, runs, jobs,
  entity choices and temporary keys, and token-safe lease/counter operations.
- Reviewed AES-256-GCM temporary personal-key storage, HKDF provider separation,
  owner/provider/expiry AAD, 24-hour expiry and explicit provider selection.
  Personal failures do not fall back to the demo key. API status responses omit keys.
- Reviewed fixed provider destinations, AI redirect rejection, model-output
  validation, key-echo suppression, reservation/usage accounting and request limits.
- Reviewed Excel ZIP limits, dangerous XML rejection, coordinates/rows/cells,
  catalogue validation and raster-only profile-photo checks.
- Reviewed PDF font paths and output filename sanitization; report content is
  text, not executable HTML. The existing automated PDF test generates temporary
  verification output; no PDF deliverable was created for this task.
- Scanned 132 source/public/script/function files for common credential and
  private-key patterns: no suspected credential files. This is pattern detection,
  not proof that arbitrary-format secrets cannot exist. Ignored private local
  configuration and databases were not printed or copied into documentation.
- `git diff --check` passed (only platform line-ending notices).

## Functional verification

- 78 automated tests passed. Coverage includes invalid inventory, unavailable
  stock, hard constraints, rights gates, ranking, repair, fixed normalization,
  canonical event-to-draft transfer, programme timing, PDF pagination, imports,
  AI metering/failures, key expiry/isolation, comparison snapshot matching,
  bounded concurrency, preloaded-run isolation and the new validation regressions.
- Local HTTP: health, workspace, Qloo status, comparison and AI settings returned
  200. Workspace POSTs with an attacker origin or no Origin returned 403.
- Browser: Overview plus Catalogue, Discovery Studio, Event Studio, Event Planner,
  Cultural Map, Compare Results, Settings, Usage & Billing, Reports and Help
  rendered headings without a visible error alert during navigation. This smoke
  check is not an exhaustive visual/accessibility or every-button test.
- Previously completed real current-workspace run: 40 artist + 40 movie links,
  five eligible selected events; two invalid recommendation contexts were
  isolated. The Cinema filter visibly showed real film names and affinities.
- Bundled public sample now has 60 links (30 artist + 30 movie), five selected
  eligible events and unverified cinema proposals while rights are unconfirmed.
  Existing visitor workspaces are deliberately not overwritten by the sample.
- Final Astro check: 101 files, zero errors, warnings or hints. Both local Node
  and local Netlify-adapter production builds passed; the latter generated its
  SSR function without deploying. Public build output (50 files) was scanned
  for common credential/private-key patterns: no matches. No active key was
  available to that scan context, so this was pattern-based, not a comparison
  against every configured secret.
- The provider transport tests were repeated after adding an assertion that
  Qloo requests reject redirects: four hosting tests passed. The Overview
  Agent trace button was verified in the browser to select the Agent trace tab.

## Dependency advisory and remaining limits

`npm audit --omit=dev --json` reported **0 critical, 0 high, 0 moderate, 5 low**.
These five entries are one underlying deepmerge prototype-poisoning advisory
propagated through @netlify/config → @netlify/dev → @netlify/vite-plugin →
@astrojs/netlify, rather than five independent vulnerabilities.
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
The installed/latest published deepmerge version is 4.3.1 and falls in the
advisory range. npm proposes an incompatible adapter downgrade. No force fix or
dependency downgrade was applied. The apparent path is Netlify tooling/config
merging; exploitability through application requests was not demonstrated.

Other material limits:

- Hosted Postgres, deployed headers and live provider behaviour were not changed
  or reverified by a new deployment. Local tests cannot certify that runtime.
- Anonymous cookies are visitor isolation, not bookshop accounts. A user clearing
  cookies can receive a new visitor allowance; shared provider limits remain the
  backstop. Do not treat this demo as an authenticated multi-tenant production SaaS.
- Local mode deliberately shares the local owner and relies on loopback binding.
  It is not intended for public hosting without hosted mode/session configuration.
- API request limits are checked after reading the body. Hosting ingress limits
  provide an outer bound; streaming limits would further harden a standalone
  public Node deployment against oversized request allocation.
- Key expiry makes a stored key unavailable after 24 hours; purge jobs/on-access
  removal and backups have separate retention concerns. Encryption depends on
  protecting the server secret/private local encryption file.
- Usage is FolioEcho activity and estimated token cost, not provider account
  balance. Gemini Free tier is the owner's declaration. Playback/screening rights
  and cultural suitability are not established by Qloo affinity scores.
- No new spend-bearing Gemini/OpenAI calls, external penetration testing,
  exhaustive mobile/browser matrix or load test was performed in this review.

## Final local recheck — 2026-10-31

- Final Astro check: 103 files, zero errors/warnings/hints. Final Netlify-adapter
  build completed successfully and generated the SSR function. Public build
  credential-pattern scan: 63 files, no matches. All fifteen cover assets and
  twelve cultural thumbnails referenced by the manifests exist locally.
- Full automated suite: 78 tests passed, including the latest stale-run draft
  rejection check. Opening an existing transferred proposal preserves edits and
  does not duplicate it; current linked drafts are ordered first.
- Revisited all eleven destinations without a rendering error. Overview's four
  visible artist/film thumbnails loaded successfully from local files. The image
  manifest contains twelve entity-ID-matched cached thumbnails (~57 KB).
- Current/legacy draft status is labelled, with stock warnings and a link to the
  latest Studio ideas. Older snapshots are kept rather than silently overwritten.
- Source/public/script/function credential-pattern scan: 148 files, no matches.
  Git tracks no `.env`, private key, local database, `.folioecho`, `.netlify` or
  artifacts directory. This is not a scan of all historical Git objects.
- Bundled sample: 12 titles, five selected proposals, 30 artist + 30 film links.
  The LLM-only comparison is shown as unmeasured until run for the exact snapshot.
- Dependency advisory and hosted/runtime limitations above remain applicable.
  No push, deployment, release or external provider call was performed.
