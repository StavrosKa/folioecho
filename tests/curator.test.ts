import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConstraints, percentile, validateAndScore, diverseSelection, type Evidence, type PlanningInput } from '../src/lib/curator.ts';
import { createRun, parseInput, repairRun } from '../src/server/planner.ts';
import { parseCatalogueCSV } from '../src/lib/csv.ts';

// Synthetic test-only entities; never used by the product or as Qloo evidence.
function input(): PlanningInput {
  return { catalogue: ['a', 'b', 'c'].map(id => ({ id, title: `Book ${id}`, author: `Author ${id}`, stock: 5, tags: [id], hiddenGem: true })), selectedGenres: [], matches: {}, preferences: { curatorTypes: ['listening'] }, constraints: { ...defaultConstraints } };
}
let calls: string[] = [];
const provider = {
  async resolveBook(book: PlanningInput['catalogue'][number]) { return { resolution: { bookId: book.id, status: 'confirmed' as const, entityId: `test-${book.id}`, candidates: [] }, tags: [] }; },
  async recommend(bookId: string, _entityId: string, type: Evidence['type'], take = 10) {
    calls.push(`${bookId}:${type}:${take}`);
    const edges: Evidence[] = [.6, .7, .8, ...(take === 20 ? [.95] : [])].map((affinity, index) => ({ id: `${bookId}:${type}:${index}`, bookId, entityId: `test-${bookId}-${type}-${index}`, name: `Test candidate ${index}`, type, affinity, popularity: .5, context: `${bookId}:${type}`, retrievedAt: '2026-01-01T00:00:00Z', active: true, request: { endpoint: '/v2/insights', query: { 'filter.type': type } } }));
    return { edges };
  },
};

test('context normalization handles ties, constant pools and out-of-reference values', () => {
  const reference = { values: [.1, .3, .3, .8], capturedAt: '', method: 'empirical-percentile' as const };
  assert.equal(percentile(.1, reference), 0);
  assert.equal(percentile(.3, reference), .5);
  assert.equal(percentile(.8, reference), 1);
  assert.equal(percentile(.95, reference), 1);
  assert.equal(percentile(.2, { ...reference, values: [.2, .2] }), .5);
});
test('weighted score, hard constraints and unverified evidence are enforced', async () => {
  const run = await createRun(input(), provider);
  const event = run.proposals[0];
  assert.equal(event.status, 'valid');
  assert.ok(event.score! >= 0 && event.score! <= 100);
  const { R, N, U, F } = event.factors!;
  assert.equal(event.score, 100 * (.4 * R + .25 * N + .25 * U + .1 * F));
  const unavailable = structuredClone(run); unavailable.input.catalogue[0].stock = 0;
  assert.equal(validateAndScore(event, unavailable).status, 'rejected');
  const overCapacity = structuredClone(run); overCapacity.input.constraints.attendance = 100;
  assert.equal(validateAndScore(event, overCapacity).status, 'rejected');
  const noMetadata = structuredClone(run); delete noMetadata.edges.find(e => e.id === event.edgeIds[0])!.popularity;
  assert.equal(validateAndScore(event, noMetadata).status, 'unverified');
  const cinema = input(); cinema.preferences.curatorTypes = ['cinema'];
  const films = await createRun(cinema, provider);
  assert.ok(films.proposals.every(p => p.status === 'unverified' && p.score === null));
  assert.equal(films.selected.length, 0);
});
test('node repair fetches only affected contexts and freezes reference pools', async () => {
  calls = [];
  const run = await createRun(input(), provider);
  const before = run.proposals[0];
  const edge = run.edges.find(e => e.id === before.edgeIds[0])!;
  calls = [];
  const repaired = await repairRun(run.id, edge.entityId, run.revision, undefined, provider);
  assert.deepEqual(calls, ['a:artist:20']);
  assert.deepEqual(repaired.references, run.references);
  assert.equal(repaired.edges.find(e => e.id === edge.id)!.active, false);
  assert.ok(repaired.proposals.every(p => p.status !== 'valid' || !p.edgeIds.includes(edge.id)));
  assert.deepEqual(repaired.proposals.find(p => p.bookIds[0] === 'b'), run.proposals.find(p => p.bookIds[0] === 'b'));
  assert.equal(repaired.changes.length, 1);
  assert.equal(repaired.changes[0].before.score, before.score);
  await assert.rejects(repairRun(run.id, edge.entityId, run.revision, undefined, provider), /stale/);
});
test('stock repair invalidates affected edges without unrelated score drift', async () => {
  const run = await createRun(input(), provider);
  calls = [];
  const repaired = await repairRun(run.id, '', run.revision, { a: 0 }, provider);
  assert.equal(repaired.proposals.find(p => p.bookIds.includes('a'))!.status, 'rejected');
  assert.ok(repaired.edges.filter(e => e.bookId === 'a').every(e => !e.active));
  assert.deepEqual(repaired.proposals.find(p => p.bookIds[0] === 'b'), run.proposals.find(p => p.bookIds[0] === 'b'));
  assert.deepEqual(calls, []);
  const restored = await repairRun(run.id, '', repaired.revision, { a: 5 }, provider);
  assert.equal(restored.proposals.find(p => p.id === run.proposals[0].id)!.status, 'valid');
});
test('diverse selection covers new books before duplicate themes', async () => {
  const run = await createRun(input(), provider);
  const high = { ...run.proposals[0], id: 'another-a', score: 100 };
  const result = diverseSelection([high, ...run.proposals], 3);
  assert.equal(result.length, 3);
  assert.ok(result.some(id => run.proposals.find(p => p.id === id)?.bookIds.includes('b')));
  assert.ok(result.some(id => run.proposals.find(p => p.id === id)?.bookIds.includes('c')));
});
test('CSV handles quoted delimiters, multiline fields and atomic validation', () => {
  const books = parseCatalogueCSV('title,author,stock,tags,hiddenGem\r\n"A, book","An ""author""",2,cities;memory,true\r\n"Two\nlines",B,0,,false');
  assert.equal(books[0].title, 'A, book');
  assert.equal(books[0].author, 'An "author"');
  assert.deepEqual(books[0].tags, ['cities', 'memory']);
  assert.equal(books[1].stock, 0);
  assert.throws(() => parseCatalogueCSV('title,author,stock\nA,B,-1'));
  assert.throws(() => parseCatalogueCSV('title,author,stock\n"unclosed,B,1'));
  assert.throws(() => parseCatalogueCSV('title,author,stock\nA,B,1.5'));
});
test('planner rejects unknown hard constraints, bad quantities and missing gems', () => {
  assert.throws(() => parseInput({ ...input(), constraints: { ...defaultConstraints, budget: 10 } }), /Unsupported/);
  assert.throws(() => parseInput({ ...input(), constraints: { ...defaultConstraints, maxBooks: 0 } }), /Invalid/);
  assert.throws(() => parseInput({ ...input(), catalogue: [] }), /Invalid catalogue/);
  assert.equal(parseInput(input()).catalogue.length, 3);
});
