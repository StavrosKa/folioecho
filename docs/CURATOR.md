# Event Studio implementation

## Persistent local workspace (v2)

Optional OpenAI integration uses the Responses API with strict JSON schemas,
`store:false`, bounded output and a 60-second timeout, without automatic retries.
Run `node scripts/setup-openai.mjs` to enter an API model ID and a hidden key in a
terminal. The key is stored outside the repository in `~/.folioecho/openai.json`;
server environment variables `OPENAI_API_KEY` and `OPENAI_MODEL` override it. The
browser receives only a configured flag, never the key or private configuration.
The provider is fixed to `https://api.openai.com/v1/responses`.

The owner can review/apply genre suggestions, request grounded event titles/ideas,
or run a real LLM-only baseline. Profiles and photos are excluded from all model
prompts. Narration cannot change stock, constraints, Qloo edges, references or
scores. Baseline prompts contain the identical catalogue/constraints and exclude
Qloo matching IDs and evidence. Returned baseline IDs and hard constraints are
validated; cultural references remain unverified. Metrics are computed from the
actual response, and are not a claim of superior event quality. No live OpenAI
result exists until the private key/model have been configured and a user starts
one of these operations.

Implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs

Node 24's built-in SQLite stores the workspace, bookshop photo, confirmed entity
choices, runs, revision history, job state and private Qloo query cache under the
ignored `.folioecho/` directory. `FOLIOECHO_DATA_DIR` can override this directory.
The catalogue, profile, drafts and latest completed run are restored after refresh.
Matching decisions are rechecked against returned candidates before reuse.

The UI starts jobs at `POST /api/jobs`, polls `GET /api/jobs?id=...` for actual step
progress and can cancel a job. Cancellation is cooperative: the current bounded
Qloo request finishes before the next checkpoint stops work. After an interruption,
starting again reuses completed cached requests rather than fabricating results.
Book searches cache for seven days; recommendation pools cache for 30 minutes.

Each group/curator generates up to three cultural combinations for ranking.
Selection deduplicates identical combinations. Runs carry `curator-v2.0` as their
algorithm version, with immutable saved revision snapshots for auditability.

The bookshop photo accepts JPEG/PNG/WebP up to 2 MiB, validates format and size on
both client/server, and creates a compact WebP preview before saving. It is never
sent to Qloo. A small SVG illustration is the example owner's avatar.

All report exports are real PDFs from `POST /api/export`, using embedded system
fonts, the app palette, stock quantities, page numbers and evidence explanations.
Configure `FOLIOECHO_FONT_REGULAR` / `FOLIOECHO_FONT_BOLD` on systems without Arial
or DejaVu Sans. Live reports read the authoritative saved run rather than trusting
client-supplied evidence. No credentials are embedded in a report.

## Input and execution

The local `POST /api/curate` endpoint accepts a catalogue (stock is a field on each
book), selected catalogue genres/tags, curator preferences, explicit constraints,
and optional user-confirmed entity selections. The pilot limits each catalogue to
25 titles and 3–5 selected hidden gems. It rejects unsupported hard constraints
rather than ignoring them. CSV imports support quoted fields, escaped quotes,
embedded newlines, and semicolon-separated tags. Imports validate atomically.

1. Resolve each catalogue title through `qloo api search`. Exact title and author
   matches can be confirmed; ambiguous and missing matches remain visible. User
   selections are checked against the actual returned candidates.
2. Group books by shared supplied tags; if a book has none, use returned Qloo tag
   names. Unmatched singleton books retain their own group. This is deterministic
   thematic grouping, not an LLM-generated genre classification.
3. For eligible gems, run `qloo exec recommend` for artists and/or movies according
   to the curator types. Fetch ten candidates per book/type and validate records.
4. Build graph edges with book ID, cultural entity ID, raw affinity, popularity,
   context, timestamp and `/v2/insights` request provenance.
5. Generate solo-book and thematic-group proposals for listening, cinema, and
   mixed curators. The editorial time allocations are 45, 120 and 150 minutes;
   these are discussions/listening/excerpt sessions, not verified full screenings.
6. Reject inventory, stock, genre, capacity, duration, book-count or evidence
   violations. Mark film proposals unverified without screening-rights confirmation.
   Missing popularity/reference data also prevents ranking.
7. Score only validated proposals, then select diverse top events.

## Score

`score = 100 * (0.40*R + 0.25*N + 0.25*U + 0.10*F)`

All factors are bounded in [0,1]. They are transparent pilot heuristics, not
validated commercial-performance measures.

- **R:** mean empirical percentile of each supporting affinity against the initial
  result pool for that exact book/type query. Use midranks for ties, 0.5 for a
  constant/empty reference, and clamp out-of-reference values to [0,1]. Scores
  express relative rank within the retrieved pool, not a universal Qloo scale.
- **N:** mean `1 - popularity` of supporting cultural entities. This is a discovery
  proxy; it does not establish novelty for a particular person.
- **U:** `0.5 * eventBookCount / selectedGenreMatchingGemCount +
  0.5 * eventBookCount / maxBooks`. The denominator includes selected stock-outs,
  so unrelated proposals do not drift under a stock what-if.
- **F:** `0.5 * minimum(min(1, stock / max(minStock, attendance))) +
  0.5 * (1 - duration / maxDuration)`. Stock-to-attendance headroom is a planning
  preference, not a requirement for one purchase per attendee.

Diversity does not change the published score. Starting in descending score order,
prefer a proposal introducing an uncovered book or curator type; fill remaining
slots in score order. Ties use stable proposal IDs.

## What-if

Sessions store the authoritative snapshot and a revision in private local SQLite.
Repair requests identify the run/revision and an excluded cultural entity or stock
changes. No client-provided score, evidence or normalization reference is trusted.

- Exclude the entity across all of its graph edges.
- Find affected proposals and query contexts.
- Fetch an expanded pool of up to twenty candidates only for affected contexts.
- Rebuild affected event proposals, revalidate and rescore. Preserve unrelated
  proposals unchanged, then run the diversity selection again.
- Retain the initial normalization references; never normalize against a shrinking
  or expanded replacement pool. A newly eligible stock-restored context receives
  its first reference only if it did not exist before.
- Show the before/after entities, scores, statuses and the repair reason.

No automatic retries are made after a Qloo failure. A failed repair does not commit
partial changes to the authoritative run. Matching, candidate retrieval and repair lookups use a bounded pool of three
concurrent operations. Phase barriers keep matching ahead of recommendation
retrieval; results retain deterministic ordering. Progress writes are serialized.
A failure stops queued work and drains in-flight calls before the job lock is
released. Cancellation is cooperative; already-started calls may still finish.
The preloaded real Qloo snapshot is the default. Live execution requires the
Run live confirmation dialog, which displays a workload-based estimate (typically
~1–3 min for 12 titles/3 selected books), quota use and cold-run warnings. This
estimate assumes 10 seconds per lookup plus a two-minute margin; it is not a
measured provider SLA. Cold or slow requests can exceed it. Private query caches expire after
30 minutes; recommendation timestamps retain their original retrieval time.

## Boundaries

The backend fixes the official hackathon URL and its exact trust setting, reads
credentials only through the server environment/private harness config, drains CLI
diagnostics without returning them to browsers, and stores no API responses in the
public repository. Raw search/experiment outputs are ignored by Git. UI rendering
treats returned names as text. The API requires a same-origin JSON POST and a local
hostname. Keep the server bound to loopback; public hosting needs authentication,
authorization, quotas and operational hardening first.

The pilot uses bounded hot in-memory sessions and persistent private SQLite records.
OpenAI enrichment, editorial narratives and a real LLM-only baseline are optional
and require the private configuration described above. They are not claimed to be
live-validated until the owner's key/model is configured. Public deployment is not
enabled. The original demo screens remain independent and clearly labeled.
