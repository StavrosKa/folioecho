import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const directory = process.env.FOLIOECHO_DATA_DIR ?? path.resolve('.folioecho');
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(path.join(directory, 'workspace.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(kind,id));');
export function put(kind: string, id: string, value: unknown) {
  db.prepare('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value, updated=excluded.updated').run(kind, id, JSON.stringify(value), Date.now());
}
export function get<T>(kind: string, id: string): T | undefined {
  const row = db.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind, id);
  return row ? JSON.parse(String(row.value)) : undefined;
}
export function latest<T>(kind: string): T | undefined {
  const row = db.prepare('SELECT value FROM records WHERE kind=? ORDER BY updated DESC LIMIT 1').get(kind);
  return row ? JSON.parse(String(row.value)) : undefined;
}
export function saveRun(run: import('../lib/curator.ts').Run) {
  put('run', run.id, run); put('revision', `${run.id}:${run.revision}`, run);
}
