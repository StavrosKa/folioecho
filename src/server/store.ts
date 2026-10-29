import { owner, hosted } from './context.ts';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
let local: DatabaseSync | undefined;
async function sqlite() {
  if (!local) {
    const { DatabaseSync } = await import('node:sqlite');
    const directory = process.env.FOLIOECHO_DATA_DIR ?? path.resolve('.folioecho');
    mkdirSync(directory, { recursive: true }); local = new DatabaseSync(path.join(directory, 'workspace.sqlite'));
    local.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS scoped_records (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(owner,kind,id)); CREATE TABLE IF NOT EXISTS demo_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS demo_leases (id TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL);');
    if (local.prepare("SELECT name FROM sqlite_master WHERE name='records'").get()) local.exec("INSERT OR IGNORE INTO scoped_records SELECT 'local',kind,id,value,updated FROM records");
  }
  return local;
}
async function query(sql: string, params: any[] = []) {
  try {
    const { getDatabase } = await import('@netlify/database');
    return await getDatabase().sql.unsafe(sql, params) as Record<string, any>[];
  } catch { throw new Error('Demo storage is unavailable. Check the server database configuration.'); }
}
const scope = (kind: string) => kind === 'qloo-cache' ? 'shared-cache' : owner();
export async function put(kind: string, id: string, value: unknown) {
  const args = [scope(kind), kind, id, JSON.stringify(value), Date.now()];
  if (hosted()) await query('INSERT INTO folioecho_records(owner,kind,id,value,updated) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner,kind,id) DO UPDATE SET value=EXCLUDED.value,updated=EXCLUDED.updated', args);
  else (await sqlite()).prepare('INSERT INTO scoped_records VALUES(?,?,?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET value=excluded.value,updated=excluded.updated').run(...args);
}
export async function get<T>(kind: string, id: string): Promise<T | undefined> {
  const args = [scope(kind),kind,id];
  const row = hosted() ? (await query('SELECT value FROM folioecho_records WHERE owner=$1 AND kind=$2 AND id=$3', args))[0] : (await sqlite()).prepare('SELECT value FROM scoped_records WHERE owner=? AND kind=? AND id=?').get(...args);
  return row ? JSON.parse(String(row.value)) : undefined;
}
export async function latest<T>(kind: string): Promise<T | undefined> {
  const args = [scope(kind),kind];
  const row = hosted() ? (await query('SELECT value FROM folioecho_records WHERE owner=$1 AND kind=$2 ORDER BY updated DESC LIMIT 1', args))[0] : (await sqlite()).prepare('SELECT value FROM scoped_records WHERE owner=? AND kind=? ORDER BY updated DESC LIMIT 1').get(...args);
  return row ? JSON.parse(String(row.value)) : undefined;
}
export async function saveRun(run: import('../lib/curator.ts').Run) { await put('revision', `${run.id}:${run.revision}`, run); await put('run', run.id, run); }
export async function consume(id: string, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) return false;
  if (hosted()) return (await query('INSERT INTO folioecho_limits(id,count) VALUES($1,1) ON CONFLICT(id) DO UPDATE SET count=folioecho_limits.count+1 WHERE folioecho_limits.count < $2 RETURNING count', [id,limit])).length > 0;
  return !!(await sqlite()).prepare('INSERT INTO demo_limits VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').get(id,limit);
}
export async function acquire(id: string, token: string, milliseconds = 14 * 60_000) {
  const now = Date.now();
  if (hosted()) return (await query('INSERT INTO folioecho_leases(id,token,expires) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET token=EXCLUDED.token,expires=EXCLUDED.expires WHERE folioecho_leases.expires < $4 RETURNING token',[id,token,now+milliseconds,now])).length > 0;
  return !!(await sqlite()).prepare('INSERT INTO demo_leases VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE expires < ? RETURNING token').get(id,token,now+milliseconds,now);
}
export async function release(id: string, token: string) { if (hosted()) await query('DELETE FROM folioecho_leases WHERE id=$1 AND token=$2',[id,token]); else (await sqlite()).prepare('DELETE FROM demo_leases WHERE id=? AND token=?').run(id,token); }
export async function remove(kind:string,id:string) {
  const args=[scope(kind),kind,id];
  if(hosted()) await query('DELETE FROM folioecho_records WHERE owner=$1 AND kind=$2 AND id=$3',args);
  else (await sqlite()).prepare('DELETE FROM scoped_records WHERE owner=? AND kind=? AND id=?').run(...args);
}
export async function counter(id:string) {
  const row=hosted()?(await query('SELECT count FROM folioecho_limits WHERE id=$1',[id]))[0]:(await sqlite()).prepare('SELECT count FROM demo_limits WHERE id=?').get(id);
  return Number(row?.count ?? 0);
}
export async function purgeExpiredKeys() {
  const cutoff=Date.now()-86400_000;
  if(hosted()) await query("DELETE FROM folioecho_records WHERE kind IN ('openai-key','gemini-key') AND updated < $1",[cutoff]);
  else (await sqlite()).prepare("DELETE FROM scoped_records WHERE kind IN ('openai-key','gemini-key') AND updated < ?").run(cutoff);
}
