# Publish the FolioEcho demo on Netlify

The source supports two targets: local Node + SQLite and hosted Netlify Functions
+ Netlify Database (Postgres). The public demo needs no visitor account. Each browser
receives an unguessable, signed, HttpOnly session cookie and its own workspace.
This is a disposable demo workspace, not an authenticated business account.

## Create the project

1. In Netlify, add a new project from Git and select `StavrosKa/folioecho`.
2. Use `main`, the repository root, and the settings in `netlify.toml`.
3. Set the variables below in **Project configuration > Environment variables**.
   On Free, keep their default scopes. These must reach Functions at runtime:
   values declared only in `netlify.toml` are build-time variables.
4. Deploy. Installing `@netlify/database` enables automatic database provisioning;
   the SQL migration in `netlify/database/migrations/` is applied before publication.
   Confirm the database in **Data & Storage > Database**. Do not deploy a static
   `dist` folder by drag and drop: this app needs the Functions and database.

| Variable | Value |
| --- | --- |
| `FOLIOECHO_HOSTED` | `1` |
| `FOLIOECHO_SESSION_SECRET` | A private, random value of at least 32 characters |
| `QLOO_API_KEY` | Your private hackathon API key |
| `OPENAI_API_KEY` | Your own private OpenAI API key |
| `OPENAI_MODEL` | A model available to your API account that supports Responses structured outputs |
| `FOLIOECHO_QLOO_DAILY_LIMIT` | Optional; defaults to `300` actual Qloo requests for the whole site |
| `FOLIOECHO_OPENAI_DAILY_LIMIT` | Optional; defaults to `20` OpenAI requests for the whole site |

Netlify supplies `URL`, `SITE_ID` and the database connection. Do not expose
credentials through `PUBLIC_` or `VITE_` variables, Git, browser input, or chat.
Generate the session secret privately in your terminal, for example with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Do not post that output in issues, screenshots, or chat. Changing this secret
invalidates visitor cookies and pending worker signatures. Redeploy after changing
environment variables. Keep the same secret across deploys to preserve sessions.

## What changes online

- Catalogue, profile, entity choices, runs, revisions, baselines and jobs are scoped
  to the signed visitor ID in Postgres. Only public Qloo response caches are shared.
- Qloo uses the fixed hackathon HTTPS endpoint directly; local use retains the CLI
  and its private configuration. Native HTTP matches the same search/insights
  queries and preserves returned affinities and provenance, without subprocesses.
- Planning dispatches a signed request to a Background Function. Progress and
  cancellation are stored in the database; the browser polls every four seconds.
- Atomic database leases prevent duplicate execution and simultaneous edits to the
  same visitor's run. One planner uses the shared Qloo allowance at a time. A busy
  visitor receives a retry message rather than waiting in an unbounded queue.
- Each visitor can start six plans and five AI operations per UTC day. Global
  provider counters limit actual paid calls even if someone creates fresh cookies.
  Writes are limited to 30 per visitor per minute. These are demo guardrails, not
  a guarantee against credit exhaustion from arbitrary HTTP traffic.
- Worker time is capped at 13 minutes, within Netlify's 15-minute background limit.
  Qloo calls time out after 15 seconds and OpenAI calls after 25 seconds online.
  Uncertain/failed operations do not silently retry or fabricate recommendations.
- PDF fonts are bundled, including Greek characters. Downloads only happen when
  the visitor requests them. No image generation service is involved.

The settings panel reports provider configuration without exposing keys. It is
not a live provider connectivity test. API spend is separate from Netlify credits
when using your own OpenAI key. Monitor the team's shared Netlify usage during
judging; the Free account's sites pause when its credits are exhausted.

## Verify before submitting the URL

1. Open the published HTTPS URL. The sample catalogue should load without login.
2. Open it in a separate private browser session: catalogue edits, saved runs and
   jobs from the first browser must not appear in the second.
3. Import the sample CSV, choose 3–5 hidden gems and generate a live Qloo plan.
   Resolve any ambiguous books explicitly; inspect the supporting evidence.
4. Exclude one cultural node and inspect repaired events and fixed references.
5. Run an OpenAI editorial operation and verify its output is labelled correctly.
6. Refresh during a job; progress must resume. Cancel a job and verify its state.
7. Edit the evening programme and explicitly download one PDF to check the hosted
   font bundle. Do this only when you want an export.
8. Check `/api/health` for database readiness and provider configuration flags.
   It returns no credentials and does not spend provider quota.

`npm test` uses isolated local SQLite fixtures, not production data. A successful
build does not verify hosted Postgres, worker delivery, or live provider credentials;
the published smoke test above is still required. Local records are not uploaded.
Cookies expire after seven days; database records are not automatically purged in
this pilot. Use sample, non-sensitive data and clear the demo database after judging.

## References

- https://docs.netlify.com/build/frameworks/framework-setup-guides/astro/
- https://docs.netlify.com/build/data-and-storage/netlify-database/
- https://docs.netlify.com/build/functions/background-functions/
- https://docs.netlify.com/build/functions/environment-variables/
