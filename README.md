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
and Background Functions. See [Netlify deployment](docs/NETLIFY.md) for runtime
secrets, database provisioning, usage limits and the required online smoke test.
The public deployment has been checked for Qloo planning, what-if repair,
persistence and visitor isolation. The current update adds Gemini demo support and optional personal-provider settings. Hosted Gemini availability requires the server environment variables described below. Local Gemini authentication, a minimal structured-output test and full validated genre/theme suggestions for 12 books have passed with a privately configured key; the hosted update still requires its own runtime configuration and live verification.

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
| Discovery Studio | Compact, proportionate cover cards, an internally scrolling hidden-gem shelf, a sticky connection explainer, session-level kept directions and clear links to Cultural Map and real Qloo Event Studio. Demo directions remain explicitly labelled. |
| Category cards | At most 8 broad thematic groups, distinct-book counts, category filtering and a local SVG for every group. Refine with Gemini explicitly updates tag assignments and artwork choices, saved per visitor. Detailed book tags remain intact. |
| Overview | Stock-first totals and a Qloo indicator based on server credential configuration and saved evidence; no connectivity probe or quota usage on page load. |
| Event Studio | Focused tabs for setup, book matches, cultural graph, event ideas, AI editorial and what-if changes. Bounded scroll areas, compact event cards, centred graph filters and an evidence dialog; no model calls just to browse. |
| Ranking | Hard-constraint validation, fixed-context affinity normalization, R/N/U/F scoring and diverse selection of eligible proposals. |
| What-if | Exclude a cultural node or change stock, repair affected proposals, keep normalization references fixed and explain before/after changes. |
| Evening programme | Plan this event transfers a selected, validated Event Studio proposal into an editable draft with the exact books, cultural evidence snapshot and total duration. Larger readable text. Five editable segments with clock times, durations, linked books, several activity suggestions and host preparation notes. Add/remove segments, detect gaps/overlaps and arrange consecutively. |
| Settings | Saved bookshop profile, compact 96 × 96 photo editor, replaceable JPEG/PNG/WebP photo up to 2 MiB and a small locally bundled sample portrait. Separate persistent notification and sound mute controls. |
| Usage & Billing | Connected Qloo/AI services, sponsored Gemini demo, optional personal OpenAI/Gemini keys, usage percentages and estimated app costs. |
| Reports | Branded PDF downloads for catalogue snapshots, event drafts/programmes and live Event Studio evidence. PDF reports are not re-importable backups. |
| Help | Five concise practical steps in styled cards, plus expandable troubleshooting notes. |
| Storage | SQLite locally; Postgres with isolated visitor workspaces on Netlify. Catalogue, profile, drafts, runs, revisions and query caches persist server-side. |

The app uses the Planner’s readable typography scale across screens: 16 px body text, 14 px secondary text and 13 px minimum helper labels, with larger section headings. Cover artwork keeps its own miniature lettering.

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
See [AI settings and accounting](docs/AI_SETTINGS.md) for estimates, quota limits
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
See [the sample CSV](public/sample-catalogue.csv).

The top-bar import also retains the JSON format from the original MVP. Every row has a
unique string `id`, `title`, `author`, non-negative integer `stock`, string `tags`
array and boolean `hiddenGem`. See [the sample JSON](public/sample-catalogue.json).

Imports validate atomically and replace the collection only on success. The JSON
catalogue parser accepts up to 1,000 titles / 2 MB; the **live Event Studio pilot is
limited to 25 titles per run** and 3–5 selected hidden gems. Only eligible, in-stock
books enter live proposals.

## Evidence, scoring and programme suggestions

The live pipeline is documented in [the implementation guide](docs/CURATOR.md).

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

The original Discovery Studio and Cultural Map retain labeled demo connections.
Event Planner sample drafts are editable, but their presence does not establish
live Qloo provenance. Use Event Studio exports for actual API-backed evidence.
Compare Results still contains demonstration layout; measured optional baseline
results appear only after an actual baseline execution. No metrics are prefilled.

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

Manual experiments are documented in [the experiment guide](experiments/qloo/README.md).
`node scripts/qloo/smoke-planner.mjs` makes **live, quota-consuming Qloo calls**.
Its private outputs stay under the ignored `experiments/qloo/results/` folder.
Do not run it as part of ordinary CI or publish its raw results.

## Artwork and licensing

The selected logo in `public/folioecho-logo.png` is preserved. The book/music atlas
in `public/discovery-artwork.png` consists of illustrative concept artwork, not
official publisher covers. The sample owner avatar is a small SVG illustration.

Category backgrounds use locally stored **Tabler Icons under the MIT license**.
The required copyright/license and pinned source revision are included in
[public/category-art](public/category-art/SOURCES.md). No runtime CDN or remote
image service is needed.

## Remaining work

Live-validate Gemini demo and optional personal-provider features with owner credentials, evaluate ranking
quality with booksellers, extend comparison metrics, review dependency security,
and add authenticated business accounts before using the app for sensitive
production bookshop data. The existing public site is a bounded anonymous demo.

## Netlify demo target

Run `FOLIOECHO_NETLIFY_BUILD=1 npm run build` in a shell that supports this syntax
(or set the environment variable in PowerShell before running the build). The
Netlify platform selects its adapter automatically. See [the deployment guide](docs/NETLIFY.md).
No private local database or API credential is deployed. The repository includes
an ISC license; bundled category art and fonts retain their own license notices.

Excel import uses the MIT-licensed read-excel-file, fflate and saxen libraries.
Their notices are included in [Excel import licenses](public/licenses/excel-import.txt).

## Releases and packages

The current packaged release is **v1.1.0**. See the [release notes](docs/releases/v1.1.0.md)
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
