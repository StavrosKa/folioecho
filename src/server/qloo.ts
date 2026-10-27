import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Evidence, Resolution } from '../lib/curator.ts';
import type { Book } from '../lib/catalogue.ts';
import { get, put } from './store.ts';

const endpoint = 'https://hackathon.api.qloo.com';
const cache = new Map<string, { expires: number; data: unknown }>();
export class QlooFailure extends Error {}
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
const tidy = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function cli(args: string[], input?: unknown): Promise<any> {
  // The harness exports ESM only; its CLI is not a require.resolve export.
  // Start the standalone server from the project root, as npm run dev does.
  const bin = path.resolve(process.cwd(), 'node_modules/@qloo/qloo-harness/dist/bin.js');
  let temp: string | undefined;
  try {
    if (input) {
      temp = await mkdtemp(path.join(tmpdir(), 'folioecho-'));
      const file = path.join(temp, 'request.json');
      await writeFile(file, JSON.stringify(input), { mode: 0o600 });
      args = [...args, '--input-file', file];
    }
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bin, ...args], {
        shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, QLOO_BASE_URL: endpoint, QLOO_TRUSTED_BASE_URL: endpoint },
      });
      let stdout = ''; let oversized = false;
      const timer = setTimeout(() => child.kill(), 45_000);
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (stdout.length > 4_000_000) { oversized = true; child.kill(); }
      });
      child.stderr.resume(); // Never return CLI diagnostics or credentials to browsers.
      child.on('error', () => { clearTimeout(timer); reject(new QlooFailure('Qloo CLI could not start. Check the server installation.')); });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0 || oversized) return reject(new QlooFailure('Qloo request failed or timed out. Check credentials, quota and network. No automatic retry was made.'));
        try {
          const data = JSON.parse(stdout);
          if (data.status === 'error' || data.error) return reject(new QlooFailure('Qloo returned an error. Check server access and quota.'));
          resolve(data);
        } catch { reject(new QlooFailure('Qloo returned an unreadable response.')); }
      });
    });
  } finally {
    if (temp) {
      const resolved = path.resolve(temp);
      if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('folioecho-')) throw new QlooFailure('Temporary request path failed validation.');
      await rm(resolved, { recursive: true, force: true });
    }
  }
}
async function cached(key: string, work: () => Promise<unknown>): Promise<any> {
  const prior = cache.get(key) ?? get<{ expires: number; data: unknown }>('qloo-cache', key);
  if (prior && prior.expires > Date.now()) return structuredClone(prior.data);
  const data = await work();
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  const record = { expires: Date.now() + (key.startsWith('search:') ? 7 * 24 * 60 : 30) * 60_000, data };
  cache.set(key, record); put('qloo-cache', key, record);
  return structuredClone(data);
}
export async function resolveBook(book: Book, chosen?: string): Promise<{ resolution: Resolution; tags: string[] }> {
  const raw = await cached(`search:${book.title}:${book.author}`, () => cli(['api', 'search', '--query', `${book.title}`, '--type', 'book', '--take', '3', '--json']));
  if (!Array.isArray(raw)) throw new QlooFailure('Unexpected Qloo search response.');
  const candidates = raw.filter(value => {
    const row = object(value);
    return typeof row.entity_id === 'string' && typeof row.name === 'string' && Array.isArray(row.types) && row.types.includes('urn:entity:book');
  }).map(value => ({ id: value.entity_id as string, name: value.name as string, detail: typeof value.disambiguation === 'string' ? value.disambiguation : '' }));
  const exact = candidates.filter(c => tidy(c.name) === tidy(book.title) && tidy(c.detail).includes(tidy(book.author)));
  const savedChoice = get<string>('entity-choice', `${book.title}:${book.author}`);
  const match = chosen ? candidates.find(c => c.id === chosen) : candidates.find(c => c.id === savedChoice) ?? (exact.length === 1 ? exact[0] : undefined);
  if (chosen && !match) throw new QlooFailure('The selected book match is not one of the returned Qloo candidates.');
  if (chosen && match) put('entity-choice', `${book.title}:${book.author}`, match.id);
  const matched = match ? raw.find(row => row.entity_id === match.id) : undefined;
  const tags = Array.isArray(matched?.tags) ? matched.tags.flatMap((t: any) => typeof t?.name === 'string' ? [t.name.toLowerCase()] : []) : [];
  return { resolution: { bookId: book.id, status: match ? 'confirmed' : candidates.length ? 'needs_input' : 'missing', candidates, ...(match ? { entityId: match.id } : {}) }, tags };
}
export async function recommend(bookId: string, entityId: string, type: Evidence['type'], take = 10): Promise<{ edges: Evidence[]; warning?: string }> {
  const cachedResult = await cached(`recommend:${entityId}:${type}:${take}`, async () => ({ data: await cli(['exec', 'recommend'], { target_type: type, signals: [entityId], limit: take, explain: true }), retrievedAt: new Date().toISOString() }));
  const data = cachedResult.data;
  if (data.status === 'needs_input') return { edges: [], warning: 'Qloo requires clarification for the supplied entity.' };
  if (!['ok', 'empty', 'partial', 'degraded'].includes(data.status) || !Array.isArray(data.results)) throw new QlooFailure('Unexpected Qloo recommendation response.');
  const request = data.provenance?.requests?.find((r: any) => r.path === '/v2/insights');
  if (!request || !request.query || typeof request.query !== 'object') throw new QlooFailure('Qloo recommendation provenance is unavailable.');
  const now = cachedResult.retrievedAt;
  const edges: Evidence[] = data.results.flatMap((value: unknown) => {
    const row = object(value);
    if (typeof row.entity_id !== 'string' || typeof row.name !== 'string' || row.subtype !== `urn:entity:${type}` ||
      !Number.isFinite(row.affinity) || row.affinity < 0 || row.affinity > 1) return [];
    return [{ id: `${bookId}:${type}:${row.entity_id}`, bookId, entityId: row.entity_id, name: row.name, type,
      affinity: row.affinity, ...(Number.isFinite(row.popularity) && row.popularity >= 0 && row.popularity <= 1 ? { popularity: row.popularity } : {}),
      context: `${bookId}:${type}`, retrievedAt: now, active: true, request: { endpoint: '/v2/insights', query: Object.fromEntries(Object.entries(request.query).filter(([key]) => ['filter.type', 'take', 'signal.interests.entities', 'feature.explainability'].includes(key))) } }];
  });
  return { edges, ...(data.status === 'partial' || data.status === 'degraded' || edges.length !== data.results.length ? { warning: 'Qloo returned partial/degraded data or unsupported records; review the evidence.' } : {}) };
}
