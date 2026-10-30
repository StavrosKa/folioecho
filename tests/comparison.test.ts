import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultConstraints, type Run } from '../src/lib/curator.ts';
import { comparisonProtocol, constraintIssues, evidenceEdges, measuredComparison, type Baseline } from '../src/lib/comparison.ts';
import { withOwner } from '../src/server/context.ts';
import { put, saveRun } from '../src/server/store.ts';
import { GET } from '../src/pages/api/comparison.ts';

function fixture(): { run: Run; baseline: Baseline } {
  const run: Run = { id: randomUUID(), revision: 1, createdAt: new Date().toISOString(), input: { catalogue: ['a', 'b'].map(id => ({ id, title: id, author: 'Author', stock: 2, hiddenGem: true, tags: ['art'] })), selectedGenres: [], preferences: { curatorTypes: ['listening'] }, constraints: { ...defaultConstraints }, matches: {} }, resolutions: ['a', 'b'].map(bookId => ({ bookId, status: 'confirmed', entityId: `book-${bookId}`, candidates: [] })), clusters: [], edges: ['a', 'b'].map(bookId => ({ id: `edge-${bookId}`, bookId, entityId: 'artist-1', name: 'One artist', type: 'artist', affinity: .7, popularity: .5, context: `${bookId}:artist`, active: true, retrievedAt: new Date().toISOString(), request: { endpoint: '/v2/insights', query: { 'filter.type': 'urn:entity:artist' } } })), references: {}, proposals: [{ id: 'event', title: 'Event', curator: 'listening', bookIds: ['a', 'b'], edgeIds: ['edge-a', 'edge-b'], duration: 45, status: 'valid', reasons: [], factors: null, score: null, interpretation: '' }], selected: ['event'], excluded: [], warnings: [], changes: [] };
  return { run, baseline: { protocolVersion: comparisonProtocol, targetCount: 1, runId: run.id, revision: 1, input: structuredClone(run.input), createdAt: run.createdAt, provider: 'Gemini', model: 'test-model', events: [{ title: 'LLM event', idea: 'Read and listen', bookIds: ['a'], curator: 'listening', duration: 45, culturalReferences: ['A suggested artist'] }] } };
}

test('comparison counts distinct references separately from actual book-evidence links without inventing baseline verification', () => {
  const { run, baseline } = fixture(), measured = measuredComparison(run, baseline);
  assert.equal(measured.comparable, true); assert.equal(measured.qloo.verifiedReferences, 1); assert.equal(measured.qloo.evidenceLinks, 2);
  assert.equal(measured.llm!.culturalReferences, 1); assert.equal(measured.llm!.verifiedReferences, 0); assert.equal(measured.llm!.evidenceLinks, 0);
  assert.equal(measured.qloo.stockErrors, 0); assert.equal(measured.llm!.constraintErrors, 0);
});
test('old protocols, mismatched revisions, changed snapshots and different output budgets remain unmeasured, not zero', () => {
  const { run, baseline } = fixture();
  for (const edit of [(b: Baseline) => { b.revision++; }, (b: Baseline) => { b.input.catalogue[0].stock = 0; }, (b: Baseline) => { delete b.protocolVersion; }, (b: Baseline) => { b.targetCount = 2; }, (b: Baseline) => { b.events = []; }]) {
    const changed = structuredClone(baseline); edit(changed); assert.equal(measuredComparison(run, changed).llm, null);
  }
  assert.equal(measuredComparison(run).llm, null);
});
test('invalidated edges, excluded nodes and missing provenance never count as evidence; constraints use the frozen stock', () => {
  const { run, baseline } = fixture(); run.edges[0].active = false; run.edges[1].request.endpoint = '/illustrative';
  assert.equal(evidenceEdges(run).length, 0); assert.equal(measuredComparison(run, baseline).qloo.evidenceLinks, 0); assert.equal(measuredComparison(run, baseline).qloo.unsupportedEvents, 1);
  const clean = fixture().run; clean.excluded = ['artist-1']; assert.equal(evidenceEdges(clean).length, 0);
  baseline.events[0].bookIds = ['missing']; baseline.events[0].duration = 999;
  const result = measuredComparison(run, baseline); assert.equal(result.llm!.stockErrors, 1); assert.equal(result.llm!.constraintErrors, 2);
  assert.ok(constraintIssues({ bookIds: ['a'], curator: 'cinema', duration: 45 }, run.input).includes('screening-rights'));
});
test('comparison API scopes runs and baselines to their owner and reports a changed catalogue without calling providers', async () => {
  const { run, baseline } = fixture(), ownerA = randomUUID(), ownerB = randomUUID();
  const request = () => GET({ request: new Request('http://localhost/api/comparison'), url: new URL('http://localhost/api/comparison') } as any);
  await withOwner(ownerA, async () => { await saveRun(run); await put('baseline', `${run.id}:1`, baseline); const books = structuredClone(run.input.catalogue); books[0].stock = 0; await put('workspace', 'local', { books }); const result = await (await request()).json(); assert.equal(result.comparison.comparable, true); assert.equal(result.catalogueChanged, true); assert.match(result.snapshot, /^[a-f0-9]{16}$/); });
  await withOwner(ownerB, async () => { const result = await (await request()).json(); assert.notEqual(result.run.id, run.id); assert.ok(result.run.preloaded); assert.equal(result.baseline, null); });
});
