# Qloo book-resolution experiment

Goal: check Qloo coverage for Invisible Cities (Italo Calvino), The Book of
Disquiet (Fernando Pessoa), and The Waves (Virginia Woolf), before changing the UI.

## Local setup

Requires Node.js >=22.19 and @qloo/qloo-harness >=0.1.26.

```powershell
npm install
npm install --save-dev @qloo/qloo-harness
npx --no-install qloo setup --qloo
npx --no-install qloo setup --status
node scripts/qloo/resolve-books.mjs
```

Enter the event key only in the interactive setup prompt. Do not paste it into
chat, command arguments, repository files or screenshots. Confirm the quota and
expiry in the organizer's access email before live requests.

The experiment explicitly uses `https://hackathon.api.qloo.com` through
`QLOO_BASE_URL`, overriding any production default. API responses must remain
private and must not be committed to the public repository.

The script makes three sequential book searches, requesting up to three matches
each. It does not retry failures automatically. Local responses go in the ignored
`results/` folder. Review files before sharing; they are raw API results.

## Manual review gate

For each book, compare title, author and available metadata. Record a confirmed
entity ID only when the match is clear. Mark missing or ambiguous matches instead
of forcing a selection. The script does not treat our catalogue tags as Qloo tags.

After reviewing matches, inspect the installed recommendation workflow schema and
request a small set of music results using confirmed IDs. Preserve returned IDs,
request context and actual evidence fields. Keep the proposed bookshop event text
separate as editorial interpretation. Do not invent affinity scores or interpret
them as an individual's probability of liking a recommendation.

For each reviewed search file, set `reviewStatus` to `confirmed` and add
`confirmedEntityId` with the reviewed candidate's ID. Then run:

```powershell
node scripts/qloo/resolve-books.mjs --music
```

This requests up to five artists per confirmed book, without rerunning search.
The script sets both `QLOO_BASE_URL` and `QLOO_TRUSTED_BASE_URL` to the official
hackathon host. The harness workflow accepts `artist` and maps it to the API URN.

Success: confirmed book matches and at least one useful, traceable music result.
Missing coverage is a valid experiment outcome. No frontend/backend integration
or change to demo ranking is part of this first step.
