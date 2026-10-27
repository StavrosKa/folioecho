// Explicit live smoke test: uses real Qloo quota; not included in npm test.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { demoBooks } from '../../src/lib/catalogue.ts';
import { createRun, parseInput, repairRun } from '../../src/server/planner.ts';
import { defaultConstraints } from '../../src/lib/curator.ts';

const input = parseInput({ catalogue: demoBooks.slice(0, 3), selectedGenres: [], preferences: { curatorTypes: ['listening', 'cinema', 'mixed'] }, constraints: defaultConstraints });
console.log('Running the live pilot on three books (artists and movies).');
const run = await createRun(input);
assert.equal(run.resolutions.filter(r => r.status === 'confirmed').length, 3);
assert.ok(run.edges.some(e => e.type === 'artist'));
assert.ok(run.edges.some(e => e.type === 'movie'));
assert.ok(run.selected.length > 0);
assert.ok(run.proposals.filter(p => p.curator !== 'listening').every(p => p.status !== 'valid'));
const first = run.proposals.find(p => p.status === 'valid');
const excluded = run.edges.find(e => e.id === first.edgeIds[0]);
const repaired = await repairRun(run.id, excluded.entityId, run.revision);
assert.deepEqual(repaired.references, run.references);
for (const proposal of run.proposals) {
  if (!proposal.edgeIds.some(id => run.edges.find(e => e.id === id)?.entityId === excluded.entityId))
    assert.deepEqual(repaired.proposals.find(p => p.id === proposal.id), proposal);
}
assert.ok(repaired.edges.filter(e => e.entityId === excluded.entityId).every(e => !e.active));
const output = new URL('../../experiments/qloo/results/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('planner-live.json', output), JSON.stringify(run, null, 2));
await writeFile(new URL('planner-repaired.json', output), JSON.stringify(repaired, null, 2));
console.log(JSON.stringify({ matched: run.resolutions.length, artistEdges: run.edges.filter(e => e.type === 'artist').length, movieEdges: run.edges.filter(e => e.type === 'movie').length, proposals: run.proposals.length, ranked: run.selected.length, repairChanges: repaired.changes.length, fixedReferences: true, unaffectedPreserved: true }));
