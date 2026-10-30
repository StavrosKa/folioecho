import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { guard, json } from '../../server/http.ts';
import { get } from '../../server/store.ts';
import { currentOrPreloadedRun } from '../../server/preloaded-run.ts';
import { measuredComparison, type Baseline } from '../../lib/comparison.ts';
export const prerender = false;
export const GET: APIRoute = async ({ request, url }) => {
  const blocked = guard(request, url); if (blocked) return blocked;
  try {
    const run = await currentOrPreloadedRun(); if (!run) return json({ run: null, baseline: null, comparison: null });
    const saved = await get<Baseline>('baseline', `${run.id}:${run.revision}`);
    const comparison = measuredComparison(run, saved);
    const workspace = await get<{ books: unknown }>('workspace', 'local');
    return json({ run, baseline: comparison.comparable ? saved : null, comparison,
      snapshot: createHash('sha256').update(JSON.stringify(run.input)).digest('hex').slice(0, 16),
      catalogueChanged: !!workspace && JSON.stringify(workspace.books) !== JSON.stringify(run.input.catalogue) });
  } catch { return json({ error: 'Saved comparison is unavailable.' }, 503); }
};
