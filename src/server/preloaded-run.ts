import { randomUUID } from 'node:crypto';
import sampleRun from '../data/sample-qloo-run.json' with { type: 'json' };
import { sampleBooks, initialEvents } from '../lib/workspace.ts';
import { demoBooks, type Book } from '../lib/catalogue.ts';
import type { Run } from '../lib/curator.ts';
import { owner } from './context.ts';
import { acquire, release, latest, get, put, saveRun } from './store.ts';

// Older demo workspaces may have been saved before sample runs were introduced.
// Recognize their book identities; never use this recovery for imported catalogues.
function isSampleWorkspace(workspace: { books?: Book[] } | undefined) {
  if (!workspace) return true;
  if (!Array.isArray(workspace.books)) return false;
  const legacy = [...demoBooks.slice(0, 3), ...sampleBooks.filter(book => !book.id.startsWith('hg-'))];
  return [sampleBooks, legacy].some(example => workspace.books!.length === example.length &&
    example.every(book => workspace.books!.some(saved => saved.id === book.id && saved.title === book.title && saved.author === book.author)));
}

/** Recover recorded demo evidence without changing an existing workspace or calling Qloo. */
export async function currentOrPreloadedRun(): Promise<Run | undefined> {
  const existing = await latest<Run>('run'); if (existing) return existing;
  if (!isSampleWorkspace(await get('workspace', 'local'))) return undefined;
  const key = `sample-bootstrap:${owner()}`, token = randomUUID();
  let locked = false;
  for (let i = 0; i < 40 && !locked; i++) { locked = await acquire(key, token, 15000); if (!locked) await new Promise(resolve => setTimeout(resolve, 50)); }
  if (!locked) throw new Error('Sample workspace initialization is busy.');
  try {
    const prior = await latest<Run>('run'); if (prior) return prior;
    const workspace = await get<{ books?: Book[] }>('workspace', 'local');
    if (!isSampleWorkspace(workspace)) return undefined;
    const run = structuredClone(sampleRun) as Run;
    if (!run.selected.length || !run.edges.length || JSON.stringify(run.input.catalogue) !== JSON.stringify(sampleBooks)) throw new Error('Sample evidence snapshot is unavailable.');
    run.preloaded = { generatedAt: run.createdAt, sourceRunId: run.id }; run.id = randomUUID();
    await saveRun(run);
    if (!workspace) await put('workspace', 'local', { books: structuredClone(sampleBooks), events: structuredClone(initialEvents), profile: { name: 'Anna Papadopoulou', shop: 'The Reading Room', city: 'Athens, Greece', email: 'anna@example.com', photo: '' } });
    return run;
  } finally { await release(key, token); }
}
