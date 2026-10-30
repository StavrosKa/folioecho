import { randomUUID } from 'node:crypto';
import sampleRun from '../data/sample-qloo-run.json' with { type: 'json' };
import { sampleBooks, initialEvents } from '../lib/workspace.ts';
import type { Run } from '../lib/curator.ts';
import { owner } from './context.ts';
import { acquire, release, latest, get, put, saveRun } from './store.ts';

/** Only untouched visitor workspaces receive an independent copy; never call Qloo. */
export async function currentOrPreloadedRun(): Promise<Run | undefined> {
  const existing = await latest<Run>('run'); if (existing) return existing;
  if (await get('workspace', 'local')) return undefined;
  const key = `sample-bootstrap:${owner()}`, token = randomUUID();
  let locked = false;
  for (let i = 0; i < 40 && !locked; i++) { locked = await acquire(key, token, 15000); if (!locked) await new Promise(resolve => setTimeout(resolve, 50)); }
  if (!locked) throw new Error('Sample workspace initialization is busy.');
  try {
    const prior = await latest<Run>('run'); if (prior) return prior;
    if (await get('workspace', 'local')) return undefined;
    const run = structuredClone(sampleRun) as Run;
    if (!run.selected.length || !run.edges.length || JSON.stringify(run.input.catalogue) !== JSON.stringify(sampleBooks)) throw new Error('Sample evidence snapshot is unavailable.');
    run.preloaded = { generatedAt: run.createdAt, sourceRunId: run.id }; run.id = randomUUID();
    await saveRun(run);
    await put('workspace', 'local', { books: structuredClone(sampleBooks), events: structuredClone(initialEvents), profile: { name: 'Anna Papadopoulou', shop: 'The Reading Room', city: 'Athens, Greece', email: 'anna@example.com', photo: '' } });
    return run;
  } finally { await release(key, token); }
}
