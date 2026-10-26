# FolioEcho
Where books find their audience.

Smart Catalogue Intelligence MVP for independent bookshops. Built with Astro, strict TypeScript, React and React Flow.

## Run
Requires Node.js 22.12+ (Node 24 recommended).
```sh
npm ci
npm run dev
```
Open http://localhost:4321. Check with `npm run check`, `npm test`, and `npm run build`.

## Current MVP
- Discovery Studio follows the approved mockup: grouped sidebar, detailed bookshop profile, book cards, illustrated cultural map, evidence inspector, and a slim status strip immediately above the event draft.
- Every navigation section has sample content: Overview, Catalogue, Discovery Studio, Event Planner, Cultural Map, Compare Results, Reports & Exports, Settings, and Help.
- The sample collection contains 12 titles and two editable event drafts. Counts derive from the actual sample inventory rather than fabricated dashboard totals.
- Profile edits, event draft editing, catalogue filters, alternative music directions, and JSON report downloads work within the current browser session.
- Import validated JSON inventory; search title, author and tags; edit stock; export catalogue.
- Derive category counts from supplied tags. These are reviewable signals, not autonomous metadata enrichment.
- Select 3–5 hidden gems. Only in-stock selections enter the demo plan.
- Explore a React Flow graph with shared-tag evidence separated from editorial interpretation.
- Reject music directions or change inventory to recalculate affected matches deterministically.
- No persistence: refresh resets the workspace. Imports remain in browser memory.

## Import format
Download the demo from the app using Export JSON, or use `public/sample-catalogue.json`.
Each row requires a unique string id, title, author, non-negative integer stock, string tags array and boolean hiddenGem.
Import is atomic: invalid input leaves the previous catalogue intact. Limit: 1,000 books / 2 MB.

## Evidence and ranking
All cultural references are explicitly demo fixtures. No Qloo API or LLM request is made. No affinity or baseline result is fabricated.
Demo ranking uses bounded [0,1] factors:
`0.40 relevance + 0.25 novelty + 0.25 catalogueUtilization + 0.10 feasibility`.
Relevance is tag-set Jaccard similarity; novelty is its complement. Utilization and feasibility equal 1 for eligible selected books. Candidates require a shared tag. These placeholders are not a validated cultural ranking or Qloo affinity.
Repair is deterministic and recomputes derived state; unaffected results remain equal. It is not yet an autonomous Qloo agent.

## Next integration milestones
1. Server-side Qloo adapter with runtime secret, validated responses, request provenance and entity IDs.
2. Catalogue enrichment with owner review and uncertain-match handling.
3. Qloo-supported cultural bridges and scoped autonomous repair.
4. Real LLM-only baseline using the identical inventory snapshot and constraints. Report coverage, validity and evidence separately; do not prefill comparison metrics.
The optional `.env.example` documents the future server secret only; this static MVP never reads it.

## Branding
The chosen FolioEcho logo is preserved unchanged in `public/folioecho-logo.png`, recovered from the prior project conversation attachment.
The original illustrative cover and music artwork atlas is `public/discovery-artwork.png`. It was generated with the built-in image generation tool for this design; these are concept illustrations, not official publisher covers. No remote image service is required at runtime.

Artwork generation prompt: create a four-panel editorial atlas with illustrated Mediterranean cities for Invisible Cities, Lisbon rooftops for The Book of Disquiet, ocean waves for The Waves, and a geometric forest-green/ochre jazz composition. Use flat front-facing artwork, elegant book-title typography, print textures, no gaps or outer margins, and no text in the music panel.

## Visual review
The default view is Discovery Studio. Use the grouped left navigation to inspect all sample screens. On shorter desktop windows the navigation scrolls independently while the profile stays anchored below it. Narrow screens use a horizontal navigation bar; account details remain editable from Settings.
All external evidence states remain explicitly pending. Compare Results shows the evaluation layout without fabricated performance measurements. The application is still an Astro static build; this update does not deploy it to any hosting service.
