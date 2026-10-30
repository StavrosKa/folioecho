import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { currentOrPreloadedRun } from '../src/server/preloaded-run.ts';
import { withOwner } from '../src/server/context.ts';
import { get, put, saveRun } from '../src/server/store.ts';
import { sampleBooks } from '../src/lib/workspace.ts';
import { validateAndScore } from '../src/lib/curator.ts';

test('fresh visitors receive isolated real Qloo sample runs once, with no provider request and valid evidence-backed events', async () => {
  const a = randomUUID(), b = randomUUID();
  const original = globalThis.fetch; globalThis.fetch = (async () => { throw new Error('No provider requests allowed during bootstrap'); }) as typeof fetch;
  try {
    const first = await withOwner(a, () => currentOrPreloadedRun());
    assert.ok(first?.preloaded); assert.equal(first.selected.length, 5); assert.equal(first.edges.length, 60); assert.deepEqual(first.input.catalogue, sampleBooks);
    assert.ok(first.selected.every(id => validateAndScore(first.proposals.find(event => event.id === id)!, first).status === 'valid'));
    await withOwner(a, async () => { assert.equal((await currentOrPreloadedRun())!.id, first.id); assert.deepEqual((await get<any>('workspace', 'local'))!.books, sampleBooks); });
    const second = await withOwner(b, () => currentOrPreloadedRun()); assert.notEqual(second!.id, first.id);
    first.edges[0].active = false; await withOwner(a, () => saveRun(first));
    await withOwner(b, async () => { assert.equal((await currentOrPreloadedRun())!.edges[0].active, true); });
  } finally { globalThis.fetch = original; }
});
test('an imported or edited workspace without a run is never replaced with the sample catalogue', async () => withOwner(randomUUID(), async () => {
  const workspace = { books: [{ id: 'mine', title: 'My catalogue' }], events: [], profile: { shop: 'My shop' } };
  await put('workspace', 'local', workspace); assert.equal(await currentOrPreloadedRun(), undefined); assert.deepEqual(await get('workspace', 'local'), workspace);
}));
test('concurrent initial requests converge on the same copied run', async () => withOwner(randomUUID(), async () => {
  const results = await Promise.all([currentOrPreloadedRun(), currentOrPreloadedRun(), currentOrPreloadedRun()]);
  assert.equal(new Set(results.map(run => run!.id)).size, 1);
}));
