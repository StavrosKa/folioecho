CREATE TABLE IF NOT EXISTS folioecho_records (
  owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
  value TEXT NOT NULL, updated BIGINT NOT NULL,
  PRIMARY KEY(owner,kind,id)
);
CREATE INDEX IF NOT EXISTS folioecho_recent ON folioecho_records(owner,kind,updated DESC);
CREATE TABLE IF NOT EXISTS folioecho_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS folioecho_leases (id TEXT PRIMARY KEY, token TEXT NOT NULL, expires BIGINT NOT NULL);
