import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { POST as saveWorkspace } from '../src/pages/api/workspace.ts';
import { createReport } from '../src/server/report.ts';
import { sampleBooks, initialEvents } from '../src/lib/workspace.ts';
import { put } from '../src/server/store.ts';
import { readJob, startJob } from '../src/server/jobs.ts';

const request = (body: unknown, origin = 'http://127.0.0.1:4321') => ({ request: new Request('http://127.0.0.1:4321/api/workspace', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), url: new URL('http://127.0.0.1:4321/api/workspace') });
const workspace = { books: sampleBooks, events: initialEvents, profile: { name: 'Test', shop: 'Shop', city: 'Athens', email: 'test@example.com', photo: '' } };

test('workspace rejects cross-origin writes, oversized photos and SVG content', async () => {
  const crossOrigin = await saveWorkspace(request(workspace, 'https://other.example') as any) as Response;
  assert.equal(crossOrigin.status, 403);
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1); oversized.set([137,80,78,71,13,10,26,10]);
  const invalid = await saveWorkspace(request({ ...workspace, profile: { ...workspace.profile, photo: 'data:image/png;base64,' + oversized.toString('base64') } }) as any) as Response;
  assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /2 MB/);
  const svg = await saveWorkspace(request({ ...workspace, profile: { ...workspace.profile, photo: 'data:image/svg+xml;base64,PHN2Zz4=' } }) as any) as Response;
  assert.equal(svg.status, 400);
});
test('SQLite survives a separate process and preserves revision objects', () => {
  const directory = path.resolve('.folioecho', 'tests', randomUUID());
  const options = { env: { ...process.env, FOLIOECHO_DATA_DIR: directory }, encoding: 'utf8' as const };
  execFileSync(process.execPath, ['--input-type=module', '-e', "import {put} from './src/server/store.ts'; await put('revision','run:2',{revision:2,references:{context:[.2,.5]}})"], options);
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', "import {get} from './src/server/store.ts'; console.log(JSON.stringify(await get('revision','run:2')))"], options);
  assert.deepEqual(JSON.parse(result), { revision: 2, references: { context: [.2,.5] } });
});
test('interrupted jobs report restart and malformed requests never call Qloo', async () => {
  const id = randomUUID(); await put('job', id, { id, status: 'running', completed: 2, total: 5 });
  const job = (await readJob(id))!;
  assert.equal(job.status, 'error'); assert.match(job.error!, /restarted/);
  await assert.rejects(() => startJob({ action: 'create', input: {} }), /Invalid catalogue/);
});
test('branded PDF paginates twelve titles without generating blank footer pages', async () => {
  const pdf = await createReport('folioecho-workspace.pdf', workspace, workspace);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 2);
  assert.ok(pdf.length < 250_000);
});
