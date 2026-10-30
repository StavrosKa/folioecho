import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRun, repairRun } from '../src/server/planner.ts';
import { defaultConstraints, type PlanningInput, type Evidence } from '../src/lib/curator.ts';
import { put } from '../src/server/store.ts';
import { withOwner } from '../src/server/context.ts';
import { resolveBook, recommend } from '../src/server/qloo.ts';

test('agent trace records actual validation, provider outcomes and stock repair in order without invented Qloo network claims', async () => withOwner(randomUUID(), async () => {
  const input: PlanningInput = { catalogue: ['a', 'b', 'c'].map((id, i) => ({ id, title: `Book ${id}`, author: 'Writer', stock: i === 2 ? 0 : 3, hiddenGem: true, tags: ['art'] })), selectedGenres: [], matches: {}, preferences: { curatorTypes: ['listening'] }, constraints: { ...defaultConstraints } };
  let recommends = 0;
  const provider = {
    async resolveBook(book: PlanningInput['catalogue'][number]) { return { resolution: { bookId: book.id, status: 'confirmed' as const, entityId: `entity-${book.id}`, candidates: [] }, tags: [] }; },
    async recommend(bookId: string, _entityId: string, type: Evidence['type']) { recommends++; return { edges: [.6, .8].map((affinity, i): Evidence => ({ id: `${bookId}:${i}`, bookId, entityId: `artist-${bookId}-${i}`, name: `Artist ${i}`, type, affinity, popularity: .5, context: `${bookId}:${type}`, active: true, retrievedAt: new Date().toISOString(), request: { endpoint: '/v2/insights', query: {} } })) }; },
  };
  const checkpoints: number[] = [];
  const run = await createRun(input, provider, (_message, _completed, _total, trace) => { if (trace) checkpoints.push(trace.length); });
  assert.equal(recommends, 2); assert.ok(run.trace!.some(event => event.status === 'rejected' && event.bookId === 'c' && /stock/.test(event.summary)));
  assert.equal(run.trace!.filter(event => event.phase === 'tool').length, 5); assert.ok(run.trace!.filter(event => event.phase === 'tool').every(event => event.source === 'provider'));
  assert.ok(checkpoints.length > 5); assert.equal(run.trace!.at(-1)!.phase, 'selection');
  const references = structuredClone(run.references), before = run.trace!.length;
  const repaired = await repairRun(run.id, '', run.revision, { a: 0 }, provider);
  assert.equal(recommends, 2); assert.deepEqual(repaired.references, references); assert.deepEqual(repaired.trace!.slice(0, before), run.trace);
  const added = repaired.trace!.slice(before); assert.ok(added.every(event => event.revision === 2));
  assert.ok(added.some(event => event.phase === 'repair')); assert.ok(added.some(event => event.phase === 'validation' && event.status === 'rejected' && /stock/.test(event.summary)));
  assert.ok(added.findIndex(event => event.phase === 'repair') < added.findIndex(event => event.phase === 'ranking')); assert.equal(added.at(-1)!.phase, 'selection');
}));

test('partial job progress retains a safe failed tool outcome rather than inventing a successful entity match', async () => withOwner(randomUUID(), async () => {
  const input: PlanningInput = { catalogue: ['a', 'b', 'c'].map(id => ({ id, title: id, author: 'Writer', stock: 3, hiddenGem: true, tags: [] })), selectedGenres: [], matches: {}, preferences: { curatorTypes: ['listening'] }, constraints: { ...defaultConstraints } };
  let last: any[] = [];
  await assert.rejects(createRun(input, { async resolveBook() { throw new Error('sensitive diagnostic'); }, async recommend() { throw new Error('must not run'); } }, (_m, _c, _t, trace) => { if (trace) last = structuredClone(trace); }));
  assert.equal(last.at(-1).status, 'error'); assert.equal(last.at(-1).phase, 'tool'); assert.ok(!JSON.stringify(last).includes('sensitive diagnostic'));
  assert.ok(!last.some(event => event.phase === 'resolution'));
}));

test('Qloo adapters identify cached responses and preserve original retrieval time instead of claiming fresh HTTP calls', async () => withOwner(randomUUID(), async () => {
  const name = `Trace book ${randomUUID()}`, author = 'Writer', entityId = randomUUID();
  await put('qloo-cache', `search:${name}:${author}`, { expires: Date.now() + 60000, data: [{ entity_id: entityId, name, disambiguation: author, types: ['urn:entity:book'] }] });
  const match = await resolveBook({ id: 'a', title: name, author, stock: 2, hiddenGem: true, tags: [] });
  assert.deepEqual(match.tool, { name: 'qloo.search', endpoint: '/search', cacheHit: true });
  const retrievedAt = '2026-10-01T12:00:00.000Z';
  await put('qloo-cache', `recommend:${entityId}:artist:10`, { expires: Date.now() + 60000, data: { retrievedAt, data: { status: 'ok', results: [{ entity_id: randomUUID(), name: 'Artist', subtype: 'urn:entity:artist', affinity: .7, popularity: .5 }], provenance: { requests: [{ path: '/v2/insights', query: { 'signal.interests.entities': entityId } }] } } } });
  const result = await recommend('a', entityId, 'artist'); assert.equal(result.tool!.cacheHit, true); assert.equal(result.edges[0].retrievedAt, retrievedAt);
}));
