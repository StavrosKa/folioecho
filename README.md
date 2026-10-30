# FolioEcho

**Where books find their audience.**

[Live demo](https://folioecho.netlify.app/) · [Source](https://github.com/StavrosKa/folioecho)

FolioEcho helps independent bookshops turn overlooked books into cultural events.
It connects their catalogue with music and films through **Qloo**, validates stock
and event constraints, and turns selected ideas into editable evening programmes.
Optional **Gemini** or **OpenAI** features assist with editorial suggestions.

## Try it

Open the demo on **Overview**, explore the saved real Qloo results, then:

1. Review the catalogue and available copies; select 3–5 hidden gems.
2. Explore music/film connections and their evidence in Event Studio or Cultural Map.
3. Choose **Plan this event** to create an editable Planner draft.
4. Use Compare Results for a matched Qloo / LLM-only comparison, or export a PDF.

The preloaded sample has 12 titles, 44 copies and 60 recorded Qloo links.
Browsing the sample makes no live provider calls. Live planning and AI actions
consume limited allowances. Screening rights require separate confirmation.

## Run locally

Requires **Node.js 24**.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4321/**. Local editing works without API credentials.

For optional AI, run `node scripts/setup-gemini.mjs` privately in your terminal,
or connect a personal Gemini/OpenAI key in **Usage & Billing**. Never put keys
in Git, catalogue files, screenshots or chat. Qloo configuration is covered in
[the curator guide](docs/CURATOR.md).

```sh
npm run check
npm test
npm run build
```

## Main features

- Excel, CSV and JSON catalogue imports; stock management and hidden gems.
- Real Qloo entity matching, music/film discovery and inspectable cultural evidence.
- Hard constraints, explainable ranking, diverse selection and what-if repair.
- Agent trace of tool outcomes, validation and ranking decisions.
- Editable event programmes with books, references, timing and preparation notes.
- Matched Qloo / LLM-only measurements; unmeasured results stay explicitly labelled.
- PDF reports, profile photos and notification controls.

## Architecture and limits

Astro + React + TypeScript + React Flow. SQLite locally; Netlify Functions,
Background Functions and Postgres online. Anonymous visitor workspaces are
isolated by signed cookies; this demo is not an authenticated business account.
Personal AI keys are encrypted, expire after 24 hours and remain server-side.

Qloo affinities describe cultural associations, not a guarantee of event quality.
AI suggestions require review. Usage costs are app estimates, not provider balances.
A measured comparison describes its specific saved input and revision.

## Documentation

- [Qloo pipeline, scoring and configuration](docs/CURATOR.md)
- [Netlify deployment and runtime configuration](docs/NETLIFY.md)
- [Sample catalogue and verified matches](docs/SAMPLE_CATALOGUE.md)
- [Security review and known limitations](docs/SECURITY_REVIEW_2026-10-30.md)
- [Detailed implementation notes](docs/PROJECT_GUIDE.md)
- [Book-cover sources](public/book-covers/SOURCES.md) · [Cultural-image sources](public/cultural-images/SOURCES.md)

The compact typography uses 14 px body text, 12–13 px helper text and 17–18 px
card headings. The documented low-severity dependency advisory remains recorded
in the security review.
