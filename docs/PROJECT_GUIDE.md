# Detailed implementation notes

Expanded technical notes and historical verification records. Start with the root README for the current quick guide; dated sections describe the state when they were written.

# FolioEcho

**Where books find their audience.**

**[Open the live demo](https://folioecho.netlify.app/)** ·
[Releases](https://github.com/StavrosKa/folioecho/releases)

FolioEcho helps independent bookshops turn their existing inventory into cultural
event ideas. It combines catalogue constraints with real Qloo music/film affinities,
an explainable ranking pipeline, and an editable evening programme. Gemini demo and optional personal OpenAI/Gemini
features provide owner-reviewed tags, editorial copy, and an LLM-only baseline.

Built with Astro, TypeScript, React and React Flow. Local development uses Node.js
SQLite; the Netlify demo target uses Postgres, isolated anonymous visitor workspaces
and Background Functions. See [Netlify deployment](NETLIFY.md) for runtime
secrets, database provisioning, usage limits and the required online smoke test.
This release includes the redesigned Overview and Cultural Map, real preloaded
Qloo music/film evidence, measured comparisons and reviewed Planner transfers.
Deployment verification is a separate step from the local checks. Local verification is recorded in
[Security and functional review](SECURITY_REVIEW_2026-10-30.md).


## Quick start

Use **Node.js 24** and run commands from this project directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4321/. The default screen is **Overview**.
Local catalogue/profile editing does not require provider credentials. Live Qloo
and AI actions require their respective private server configuration or an explicit personal connection.

## What is implemented

| Area | Current behaviour |
| --- | --- |
| Catalogue | Validated Excel (.xlsx), CSV and JSON import, title/author/tag search, stock editing, 3–5 hidden-gem selections, distinct-title and total-copy counts. Desktop layout gives 80% to the collection and 20% to categories; larger covers/text, wrapped tags, manual tag removal and Undo. |
| Cultural Map | Real cover nodes, music/film reference cards, book/type filters, top 2 active links per book/type, affinity labels and selectable request provenance. Filters recenter the graph. |
| Category cards | At most 8 broad thematic groups, distinct-book counts, category filtering and a local SVG for every group. Refine with Gemini explicitly updates tag assignments and artwork choices, saved per visitor. Detailed book tags remain intact. |
| Overview | Original hero plus an editorial evening showcase with covers, snapshot counts, music/cinema candidates and a branching cultural thread. Compact stock and Qloo/LLM summaries use pale yellow backgrounds. Film candidates are not automatically part of the selected listening event. No provider calls on page load. |
| Event Studio | Focused tabs for setup, book matches, cultural graph, event ideas, AI editorial, agent trace and what-if changes. Music & reading and Cinema & books use selection cards; Mixed is removed from the UI but historical mixed runs remain readable. Bounded scroll areas, compact event cards, centred graph filters and an evidence dialog; no model calls just to browse. |
| Compare Results | Saved, measured Qloo-vs-LLM-only table on the exact same run/revision/input, with matched proposal counts. Distinct references, supporting links, stock errors and common constraint checks. Stale or legacy baselines stay unmeasured. |
| Ranking | Hard-constraint validation, fixed-context affinity normalization, R/N/U/F scoring and diverse selection of eligible proposals. |
| What-if | Exclude a cultural node or change stock, repair affected proposals, keep normalization references fixed and explain before/after changes. |
| Evening programme | Plan this event transfers a selected, validated Event Studio proposal into an editable draft with the exact books, cultural evidence snapshot and total duration. Larger readable text. Five editable segments with clock times, durations, linked books, several activity suggestions and host preparation notes. Add/remove segments, detect gaps/overlaps and arrange consecutively. |
| Settings | Saved bookshop profile, compact 96 × 96 photo editor, replaceable JPEG/PNG/WebP photo up to 2 MiB and a small locally bundled sample portrait. Separate persistent notification and sound mute controls. |
| Usage & Billing | Connected Qloo/AI services, sponsored Gemini demo, optional personal OpenAI/Gemini keys, usage percentages and estimated app costs. |
| Reports | Branded PDF downloads for catalogue snapshots, event drafts/programmes and live Event Studio evidence. PDF reports are not re-importable backups. |
| Help | Five concise practical steps in styled cards, plus expandable troubleshooting notes. |
| Storage | SQLite locally; Postgres with isolated visitor workspaces on Netlify. Catalogue, profile, drafts, runs, revisions and query caches persist server-side. |

The app uses the Planner’s readable typography scale across screens: 16 px body text, 14 px secondary text and compact helper labels, with larger section headings. The Overview editorial showcase uses smaller labels for reference types and provenance. Cover artwork keeps its own miniature lettering.

The Event Planner places **Your event drafts** and **Shape your evening** in the
left column, with **Evening programme** on the right on desktop. Narrow layouts
stack the sections. The draft list keeps two fixed-height slots and scrolls for additional drafts. On desktop the programme matches the combined sidebar height and scrolls internally. Programme edits are saved server-side and included when the owner
explicitly exports a draft; routine UI edits do not generate PDFs or screenshots.

## Private Qloo setup

The bundled harness is `@qloo/qloo-harness` (minimum version 0.1.26). Configure the
event credential in its private user configuration, not in project source:

```powershell
$env:QLOO_BASE_URL = "https://hackathon.api.qloo.com"
$env:QLOO_TRUSTED_BASE_URL = "https://hackathon.api.qloo.com"
npx --no-install qloo setup --qloo
```

Once the key has been stored, cancel the optional model-provider prompt with
Ctrl+C. Qloo CLI workflows do not require model-provider login.

```powershell
npx --no-install qloo setup --status
npx --no-install qloo doctor --network
```

The network doctor performs a live request. The server fixes both endpoint
variables to the official hackathon host and uses the server environment or the
harness's private configuration. No API key is sent to the browser.

## Gemini demo and personal AI providers

Open **Usage & Billing → Connected services → AI services** to choose sponsored demo usage or
connect an optional personal key for this browser workspace. Usage & Billing shows daily
request and cost allowance percentages, reported token counts and estimated app
costs. Refreshing settings makes no paid model request. A saved key is not claimed
to be valid until an actual AI operation succeeds.

The demo uses only the host’s private Gemini key, with ten AI attempts per visitor per UTC
day and the shared server cap. A personal key is encrypted with AES-256-GCM, bound
to its signed visitor workspace and provider, expires after 24 hours and can be deleted from
Usage & Billing. It is never returned to the browser or stored in localStorage. Personal
usage has its own allowance and never silently falls back to the host’s key.
See [AI settings and accounting](AI_SETTINGS.md) for estimates, quota limits
and temporary-key storage boundaries.

For the **local Gemini demo host**, run this privately:

```sh
node scripts/setup-gemini.mjs
```

The terminal prompts for a supported Gemini model, Google project billing tier and a hidden API key. Configuration is stored **outside the repository**, at `~/.folioecho/gemini.json`. Server-only `GEMINI_API_KEY`, `GEMINI_MODEL` and `GEMINI_BILLING_TIER` override it. The default model is `gemini-3.5-flash-lite`. Declare `free` only after checking the project tier in Google AI Studio; `unknown` estimates paid rates. Hosted deployments never read local user files.

Bookshops can connect **OpenAI** or **Google Gemini** in Usage & Billing, keep both encrypted temporary connections, explicitly select one, and delete either. Each provider has a separate personal usage ledger. The existing `node scripts/setup-openai.mjs` still stores private legacy OpenAI configuration, but the demo no longer uses it; use Usage & Billing to select a personal OpenAI connection. Never paste credentials into chat, catalogue files, profiles, screenshots, PDFs or `.env.example`.

After configuration, Event Studio offers:

- A catalogue-level **Refine with Gemini** action groups up to 150 distinct supplied tags into eight fixed themes and chooses safe local SVG backgrounds. It uses one metered Gemini request; browsing makes no model calls. A local live run successfully mapped all 99 current tags to 8 groups.
- Genre/theme suggestions that the owner reviews before accepting. A compact, scrollable review panel offers individual actions and Accept all, merging tags without replacing existing catalogue tags.
- Grounded event titles and ideas, without changing stock, scores or Qloo evidence.
- An LLM-only baseline using the same catalogue and constraints without Qloo
  matching IDs or results. Returned book IDs and hard constraints are validated;
  cultural references remain unverified.

OpenAI uses Responses strict structured output and `store:false`; Gemini uses `generateContent` with a JSON response schema. Both have bounded output, fixed HTTPS destinations, header-only credentials, a timeout, no redirects and no automatic retry or provider/billing fallback. Model prompts exclude profile details and photos. Gemini token accounting includes thinking tokens. Output provenance records the actual provider/model. Live validation requires a privately configured key; mocked tests do not establish live authentication or final provider charges.

## Catalogue formats and limits

Use the gold **Import catalogue** button for Excel (.xlsx), CSV or JSON. Open
**Import guide** beside it for a practical field reference, an example and a CSV
template that opens in Excel. The same formats are supported inside Event Studio.

Excel reads the first worksheet and converts it to validated catalogue JSON in the
browser; the original workbook is not uploaded. Use a plain values-only table,
headers in row 1, and at most 1,000 book rows. Files are limited to 2 MB. Older
.xls files must be saved as .xlsx. The Qloo run limit remains 25 titles.

Required Excel/CSV columns:

```csv
title,author,stock
Invisible Cities,Italo Calvino,4
The Book of Disquiet,Fernando Pessoa,3
The Waves,Virginia Woolf,2
```

Optional columns: `id`, `tags` (semicolon separated), and `hiddenGem` (`true` or
`false`). Quoted fields, escaped quotes and embedded newlines are supported.
See [the sample CSV](../public/sample-catalogue.csv).

The top-bar import also retains the JSON format from the original MVP. Every row has a
unique string `id`, `title`, `author`, non-negative integer `stock`, string `tags`
array and boolean `hiddenGem`. See [the sample JSON](../public/sample-catalogue.json).

Imports validate atomically and replace the collection only on success. The JSON
catalogue parser accepts up to 1,000 titles / 2 MB; the **live Event Studio pilot is
limited to 25 titles per run** and 3–5 selected hidden gems. Only eligible, in-stock
books enter live proposals.

## Evidence, scoring and programme suggestions

The live pipeline is documented in [the implementation guide](CURATOR.md).

```text
score = 100 × (0.40R + 0.25N + 0.25U + 0.10F)
```

- **R:** relative affinity within the initial book/type query's candidate pool.
- **N:** a discovery proxy derived from returned cultural-entity popularity.
- **U:** selected-catalogue coverage and use of the book allowance.
- **F:** stock and time headroom after hard constraints pass.

These are explicit pilot heuristics, not validated attendance or sales predictions.
Qloo affinities describe aggregate cultural relationships, not individual liking
probabilities or proof of thematic suitability. Missing evidence and permissions
are shown as unverified instead of being fabricated.

The evening programme's activity ideas are deterministic editorial suggestions
based on selected books and supplied tags. They are not additional Qloo evidence
or claims about passages the system has read. Owners choose excerpts, cultural
references, permissions and operational arrangements themselves.

Discovery Studio is available as a separate sidebar destination again. Its map,
and the maps in Overview and Cultural Map, use recorded Qloo edges.
Event Planner sample drafts are editable, but their presence does not establish
live Qloo provenance. Use Event Studio exports for actual API-backed evidence.
Compare Results reads real saved measurements; no metrics are prefilled. A missing,
stale or incompatible baseline remains unmeasured until explicitly run.

## Storage, jobs and privacy

- Local data is stored in `.folioecho/workspace.sqlite` (including SQLite sidecar
  files), excluded from Git. Set `FOLIOECHO_DATA_DIR` to override the directory.
  Online, the equivalent records are stored in Netlify Postgres and scoped to a
  signed visitor cookie; existing local records are not uploaded.
- Qloo book searches cache for seven days; recommendation results cache for
  30 minutes. Confirmed entity choices are rechecked before reuse.
- Background planning jobs expose progress and cooperative cancellation. A current
  bounded Qloo request may finish before cancellation reaches its checkpoint.
- After an interrupted job, a new run can reuse completed cached queries. Completed
  runs, programme edits and other saved workspace data survive restart.
- Local mode requires loopback hostnames and same-origin writes. Hosted mode
  checks the configured deployment origin, isolates anonymous visitors, and uses
  atomic provider quotas and worker leases. This is a demo, not account-based
  authentication; do not use it for sensitive business data.
- Keys, local databases, API responses, uploaded photos, PDF exports and temporary
  review files are not source assets and must never be committed.

## PDF export requirements

Reports use PDFKit and bundle openly licensed Noto Sans fonts for portable exports.
Set `FOLIOECHO_FONT_REGULAR` and `FOLIOECHO_FONT_BOLD` to use alternative fonts. Exports contain readable reports rather than raw JSON.

## Validation and server build

```sh
npm run check
npm test
npm run build
```

The automated tests cover inventory/CSV validation, normalization, scoring,
constraint enforcement, scoped repair, SQLite persistence, photo limits, private
OpenAI/Gemini request construction and accounting, PDF pagination and programme timing. Ordinary tests
use synthetic provider responses and do not make live provider calls. The PDF
regression test creates a buffer in memory, not a downloadable report file.

Start the built server from the project root:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "4321"
node dist/server/entry.mjs
```

The validation workflow runs installation, checks, tests and both Node and Netlify
builds without provider credentials. The separate release workflow validates and
smoke-tests the container before publishing it to GitHub Packages and creating a
versioned GitHub release.

The dependency overrides pin patched `brace-expansion` and `undici` versions used
by the harness dependency tree. Run `npm audit` when reviewing future dependency
updates; keep provider dependencies and their lockfile in sync.

Manual experiments are documented in [the experiment guide](../experiments/qloo/README.md).
`node scripts/qloo/smoke-planner.mjs` makes **live, quota-consuming Qloo calls**.
Its private outputs stay under the ignored `experiments/qloo/results/` folder.
Do not run it as part of ordinary CI or publish its raw results.

## Artwork and licensing

The selected logo in `public/folioecho-logo.png` is preserved. All 12 current
sample books and the 3 additional legacy demo titles use real published covers,
cached locally in `public/book-covers/` (about 143 KB total). Gemini suggested
edition ISBNs; Open Library title/author records independently verified matches,
including cases where Gemini suggested an incorrect ISBN. Cover lookup uses
title and author, never a reusable book ID. Images preserve their aspect ratio
and fall back to a neutral title/author card if unavailable. Browsing makes no
model calls or external image requests. Sources and rights attribution are in
[public/book-covers/SOURCES.md](../public/book-covers/SOURCES.md).

The remaining music artwork in `public/discovery-artwork.png` is illustrative.
To refresh covers locally, run `node --experimental-strip-types scripts/fetch-book-covers.mjs`.
On its first run this maintenance command uses the configured Gemini credential
for one metered metadata request, followed by rate-limited Open Library lookups.
Its ignored suggestion cache prevents repeated AI calls; public assets contain
no credentials.

Category backgrounds use locally stored **Tabler Icons under the MIT license**.
The required copyright/license and pinned source revision are included in
[public/category-art](../public/category-art/SOURCES.md). No runtime CDN or remote
image service is needed.

## Remaining work

Live-validate Gemini demo and optional personal-provider features with owner credentials, evaluate ranking
quality with booksellers, extend comparison metrics, review dependency security,
and add authenticated business accounts before using the app for sensitive
production bookshop data. The existing public site is a bounded anonymous demo.

## Netlify demo target

Run `FOLIOECHO_NETLIFY_BUILD=1 npm run build` in a shell that supports this syntax
(or set the environment variable in PowerShell before running the build). The
Netlify platform selects its adapter automatically. See [the deployment guide](NETLIFY.md).
No private local database or API credential is deployed. The repository includes
an ISC license; bundled category art and fonts retain their own license notices.

Excel import uses the MIT-licensed read-excel-file, fflate and saxen libraries.
Their notices are included in [Excel import licenses](../public/licenses/excel-import.txt).

## Releases and packages

The current packaged release is **v1.1.0**. See the [release notes](releases/v1.1.0.md)
and [GitHub Releases](https://github.com/StavrosKa/folioecho/releases).
GitHub provides source ZIP/tar archives for each published release. The executable
package is a container image, not an npm library:

```sh
docker pull ghcr.io/stavroska/folioecho:1.1.0
docker run --rm -p 127.0.0.1:4321:4321 -v folioecho-data:/app/.folioecho ghcr.io/stavroska/folioecho:1.1.0
```

Open http://127.0.0.1:4321/. The image uses **single-workspace Node/SQLite mode**,
with no preinstalled API credentials or user data. It is intended for local use;
the public multi-visitor app uses Netlify/Postgres. To configure optional providers,
supply an ignored private environment file with `--env-file .env.local` at runtime.
Never put keys into Docker build arguments or source. Keep the named volume private.

Package page: https://github.com/StavrosKa/folioecho/pkgs/container/folioecho
If GitHub initially marks the package Private, the repository owner must change
its visibility to Public in Package settings before anonymous pulls work.
The release workflow uses the repository-scoped automatic GITHUB_TOKEN, not a new
personal access token or any Qloo/OpenAI/Gemini key.

To publish a later version, update package.json and package-lock.json, add matching
release notes under docs/releases/vX.Y.Z.md and push to main. Existing published
release versions are skipped; they are not overwritten.

Recent UI updates include Delete/Undo on event drafts, the Overview landing page,
gold Excel/CSV/JSON import with an adjacent guide, and live sidebar badges for total
copies and selected hidden gems. The automated suite contains 38 tests.

Workspace notifications show completed saves, imports, AI results, Event Studio results and PDF downloads in a session-only feed. The bell shows unread activity and plays a short chime after browser interaction. Sound can be muted; only the mute preference persists. No additional provider requests are made for notifications.

Settings includes separate browser-persisted controls to mute new bell notifications or only their sound. The sound toggle stays synchronized with the notification menu. Existing history and inline workspace messages remain available.

The app uses a compact horizontal SVG wordmark, tagline and favicon. The browser title is FolioEcho. Container publishing automation has been removed; the existing v1.1.0 release remains available.

## Local comparison update (not deployed)

The original eleven sidebar destinations are restored: Overview, Catalogue,
Discovery Studio, Event Studio, Event Planner, Cultural Map, Compare Results,
Reports & Exports, Settings, Usage & Billing and Help. Discovery Studio and
Cultural Map use saved real Qloo evidence; illustrative matches are not restored. Reports use the latest saved Qloo evidence.

`GET /api/comparison` is owner-scoped and makes no provider calls. It uses the latest
saved run and only accepts a baseline with the exact same input/revision and
`cultural-events-v2` protocol. The baseline gets the same output count, catalogue,
genres, curator preferences and constraints, with no Qloo IDs, affinities, evidence
or competing proposals. Both results pass through the same structural validator.
Running a baseline is explicit and consumes one AI request. The previous legacy
baseline protocol is intentionally not presented as a matched comparison.

A live local Gemini measurement on 2026-10-30 used run `7da852c3`, revision 1,
snapshot `f87fe4bd82a1aaef`: 12 titles, 44 copies, 5 proposals per method. Qloo's
selected proposals used 6 distinct references and 6 recorded supporting links;
the baseline suggested 10 distinct names with zero externally verified links.
Both had zero stock errors and zero other constraint violations. The complete
saved graph had 30 active links; the table counts only links supporting selected
events. This single measurement demonstrates a provenance difference, not superior
event quality. Zero baseline evidence is a consequence of its no-lookup design;
zero stock errors are also influenced by structured catalogue IDs. Current
catalogue edits are labelled separately from the frozen comparison snapshot.
The raw local measurement is retained in ignored `artifacts/evaluation/` and is
not bundled into public source or shared between visitors.

## Agent execution trace (local update)

FolioEcho is a bounded, tool-using cultural planning agent. Its constraint-guided
orchestration calls Qloo search and insights tools, confirms or defers book
entities, validates proposals, ranks eligible results and selects diverse events.
Owner-triggered what-if actions invalidate affected evidence, retrieve alternatives
only where necessary and repair/rerank proposals against fixed reference pools.
It does not book events or independently grant screening rights. Gemini remains
optional editorial assistance, not a substitute for Qloo evidence.

Event Studio has an Agent trace tab. New jobs persist timestamped structured
execution events on the run; partial events also appear in job progress and remain
available on failures. Entries distinguish app-cache hits from Qloo tool invocations,
record uncertain matches, actual rejections and repair decisions, and exclude
credentials, raw provider diagnostics and hidden model reasoning. A cache miss
records an application-level Qloo invocation, not an assertion about every
internal network operation performed by the CLI transport. Up to 1,000 recent
steps are retained. Legacy runs display a labelled snapshot summary rather than
fabricated execution history. Adding tracing does not rewrite the saved baseline
or change the comparison snapshot.

## Preloaded real Qloo sample (local update)

A real run generated on 2026-10-30 is bundled server-side in
`src/data/sample-qloo-run.json`: 12 sample titles, 5 selected event ideas, 60
recorded evidence links (30 artist and 30 film links), 6 new Qloo tool invocations
and 12 cached book searches. Screening rights remain unconfirmed, so cinema
proposals are unverified and do not enter the ranked eligible selection.
The snapshot includes original retrieval timestamps, query provenance and the
recorded agent trace. It contains only the public sample catalogue and Qloo data.

Untouched visitor workspaces receive independent, owner-scoped copies with new
run IDs under a bootstrap lease. Existing workspaces/catalogues/runs are never
overwritten. Page loads never regenerate the snapshot or call a provider.
Overview shows an event showcase and recorded cultural candidates; Event Studio opens its
Event ideas tab with the preloaded results. A visible label identifies this as a
saved real sample, with generation date and an explicit regenerate option.
Comparison baselines are not invented or copied into new visitors' accounts.
To deliberately refresh the bundled seed, run
`node --experimental-strip-types scripts/generate-sample-run.mjs` locally; this
calls Qloo and writes the snapshot only after evidence-backed proposals exist.

## Bounded Qloo concurrency and live-run warning (local update)

Qloo matching, recommendation retrieval and repair use a pool of three concurrent
operations. Progress/checkpoint writes are serialized, search results retain input
order and evidence edges have deterministic order. On failure the pool stops
scheduling and drains in-flight work before releasing the planner lock. Existing
provider timeouts, caching, quotas and no-retry behavior remain in force.

Saved sample evidence remains the default. Starting a live run requires a separate
confirmation dialog with a workload-based estimate, Qloo allowance warning and
explicit cold-run/slow-provider caveat. The 12-title/3-gem listening example shows
`Run live (~1–3 min)`. This is a planning estimate, not a measured benchmark or
latency guarantee; cache hits can make it faster and provider delays can make it
slower. Dismissing the warning makes no provider request.

## Selected sample hidden gems

The default sample now promotes **Fair Play — Tove Jansson**, **The Tanners —
Robert Walser**, and **The Peregrine — J. A. Baker**, replacing the earlier
Invisible Cities / Book of Disquiet / The Waves selection. This is an editorial
choice of less obvious titles, not a quantitative claim about book popularity.
Real Qloo searches confirmed each exact title/author match before the change.
The real preloaded run and downloadable CSV/JSON samples have been regenerated
and agree with the new catalogue. Verified title/author cover matching avoids
reusing the previous books' illustrations. [Match IDs and publisher sources](SAMPLE_CATALOGUE.md)
are recorded for review. Existing visitor workspaces and earlier measured
comparison snapshots are preserved, not silently migrated.

Overview count tooltips distinguish distinct titles, in-stock titles, physical copies, thematic groups, saved Planner drafts and Qloo-selected event ideas. Explanations use current counts, support pointer/keyboard focus, and clarify that calendar drafts are not bookings or generated-idea counts.

Navigation design restored at the owner’s request: all eleven destinations are visible in the sidebar again. The measured comparison, real preloaded sample, agent trace, bounded concurrency and count tooltips are retained.

## Per-context Qloo failures and layout alignment (local update)

The City & the City was confirmed by Qloo search, but its entity was rejected by
insights as an invalid signal. A direct diagnostic returned HTTP 400 with an
invalid `signal.interests.entities` validation error. Such search-to-insights
mismatches are now isolated as unverified recommendation contexts instead of
aborting every other book. No fabricated links or automatic retries are added;
credential, quota and network errors still fail normally. CLI QLOO_CONTRACT
rejections are labelled as rejected contexts without claiming a specific cause.
A real isolated verification completed with 40 music links, 40 film links and
5 selected proposals; the two rejected contexts remained explicitly warned.
Film ranking still requires owner confirmation of screening rights.
Book matching now uses fixed status columns and the header metrics use aligned
number/label rows with inline tooltips. The report destination is named Reports and appears below Usage & Billing in the sidebar.

Sidebar label: Reports, placed immediately below Usage & Billing.

## Local security and functional review — 2026-10-30

See [the review report](SECURITY_REVIEW_2026-10-30.md) for verified checks,
fixes and remaining limits. Workspace writes now validate complete event drafts,
unique IDs, dates/times, capacity, programme and source structure before saving;
invalid writes preserve the previous workspace. Catalogue fields are bounded
(id 200, title 300, author 200, at most 64 tags of 80 characters, stock 100000).
The Qloo HTTP client rejects redirects. Netlify headers deny framing and object
embedding and restrict the document base URL; they take effect only after a
future deployment. This review does not publish or certify the hosted app.

Final local recheck on **2026-10-31** includes the smaller Overview typography,
12 cached Qloo artist/film thumbnails (about 57 KB), and Planner source-freshness
indicators. Reopening the same Studio proposal keeps edits and moves its draft
to the top without duplicating it. Older run IDs cannot create drafts after a
newer run exists. Existing independent drafts remain explicitly labelled.
See the final-check addendum in the review report.
