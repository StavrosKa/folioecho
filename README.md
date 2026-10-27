# FolioEcho

**Where books find their audience.**

FolioEcho helps independent bookshops turn their existing inventory into cultural
event ideas. It combines catalogue constraints with real Qloo music/film affinities,
an explainable ranking pipeline, and an editable evening programme. Optional OpenAI
features provide owner-reviewed tags, editorial copy, and an LLM-only baseline.

This is a **local, single-workspace pilot**, built with Astro, TypeScript, React,
React Flow and Node.js SQLite. It is not a public multi-user deployment.

## Quick start

Use **Node.js 24** and run commands from this project directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4321/. The default screen is **Event Studio**.
Local catalogue/profile editing does not require provider credentials. Live Qloo
and OpenAI actions require their respective private server configuration.

## What is implemented

| Area | Current behaviour |
| --- | --- |
| Catalogue | Validated CSV/JSON import, title/author/tag search, stock editing, 3–5 hidden-gem selections, distinct-title and total-copy counts. |
| Category cards | Counts from catalogue tags, with local category-specific SVG backgrounds. These counts are not autonomous metadata enrichment. |
| Event Studio | Qloo entity matching, owner review of uncertain matches, thematic groups, music/film candidates and an evidence-backed graph. |
| Ranking | Hard-constraint validation, fixed-context affinity normalization, R/N/U/F scoring and diverse selection of eligible proposals. |
| What-if | Exclude a cultural node or change stock, repair affected proposals, keep normalization references fixed and explain before/after changes. |
| Evening programme | Five editable segments with clock times, durations, linked books, several activity suggestions and host preparation notes. Add/remove segments, detect gaps/overlaps and arrange consecutively. |
| Settings | Saved bookshop profile, replaceable JPEG/PNG/WebP photo up to 2 MiB, compact illustrative owner avatar and private OpenAI setup status. |
| Reports | Branded PDF downloads for catalogue snapshots, event drafts/programmes and live Event Studio evidence. PDF reports are not re-importable backups. |
| Help | Five concise practical steps in styled cards, plus expandable troubleshooting notes. |
| Storage | Private local SQLite persistence for catalogue, profile, drafts, completed runs, revision history and query caches. |

The Event Planner places **Your event drafts** and **Shape your evening** in the
left column, with **Evening programme** on the right on desktop. Narrow layouts
stack the sections. Programme edits are saved locally and included when the owner
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

## Optional private OpenAI setup

Open **Settings → Connected services → OpenAI** for setup instructions and
**Check configuration**. This button checks configuration presence; it does not
validate credentials through a paid model request.

```sh
node scripts/setup-openai.mjs
```

The terminal prompts for an API model ID and a hidden API key. Configuration is
stored **outside the repository**, at `~/.folioecho/openai.json`. Server variables
`OPENAI_API_KEY` and `OPENAI_MODEL` can override it. Never paste credentials into
chat, a catalogue, a profile, screenshots, PDFs or `.env.example`.

After configuration, Event Studio offers:

- Genre/theme suggestions that the owner reviews before accepting.
- Grounded event titles and ideas, without changing stock, scores or Qloo evidence.
- An LLM-only baseline using the same catalogue and constraints without Qloo
  matching IDs or results. Returned book IDs and hard constraints are validated;
  cultural references remain unverified.

The Responses API adapter uses strict structured output, `store:false`, bounded
output, a timeout and no automatic retries. Model prompts exclude owner profile
details and photos. These operations run only when explicitly started. The optional
OpenAI flow requires live validation with the owner's configured key/model; no
successful live OpenAI result is claimed merely because the adapter is implemented.

## Catalogue formats and limits

For CSV, use **Import CSV inside Event Studio**. Required columns:

```csv
title,author,stock
Invisible Cities,Italo Calvino,4
The Book of Disquiet,Fernando Pessoa,3
The Waves,Virginia Woolf,2
```

Optional columns: `id`, `tags` (semicolon separated), and `hiddenGem` (`true` or
`false`). Quoted fields, escaped quotes and embedded newlines are supported.
See [the sample CSV](public/sample-catalogue.csv).

The top-bar import retains the JSON format from the original MVP. Every row has a
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

- Private data is stored in `.folioecho/workspace.sqlite` (including SQLite sidecar
  files), excluded from Git. Set `FOLIOECHO_DATA_DIR` to override the directory.
- Qloo book searches cache for seven days; recommendation results cache for
  30 minutes. Confirmed entity choices are rechecked before reuse.
- Background planning jobs expose progress and cooperative cancellation. A current
  bounded Qloo request may finish before cancellation reaches its checkpoint.
- After an interrupted job, a new run can reuse completed cached queries. Completed
  runs, programme edits and other saved workspace data survive restart.
- The API requires local hostnames and same-origin writes. Keep the server bound
  to loopback. Authentication, per-user isolation and operational quotas are still
  required before public hosting.
- Keys, local databases, API responses, uploaded photos, PDF exports and temporary
  review files are not source assets and must never be committed.

## PDF export requirements

Reports use PDFKit and embed server-installed fonts: Arial on Windows or DejaVu Sans
on Linux. On other systems set `FOLIOECHO_FONT_REGULAR` and `FOLIOECHO_FONT_BOLD` to
suitable font files. Exports contain readable reports rather than raw JSON.

## Validation and server build

```sh
npm run check
npm test
npm run build
```

The automated tests cover inventory/CSV validation, normalization, scoring,
constraint enforcement, scoped repair, SQLite persistence, photo limits, private
OpenAI request construction, PDF pagination and programme timing. Ordinary tests
use synthetic provider responses and do not make live provider calls. The PDF
regression test creates a buffer in memory, not a downloadable report file.

Start the built server from the project root:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "4321"
node dist/server/entry.mjs
```

The existing GitHub workflow runs installation, checks, tests and a server build;
it does not deploy the app or require provider credentials.

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

Live-validate optional OpenAI features with owner credentials, evaluate ranking
quality with booksellers, extend comparison metrics, review dependency security,
and add authentication/deployment hardening before any public release.
