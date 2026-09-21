-- zPopcorn 001 — initial desktop schema
-- Media identity model (spec 11/12/14): Work -> Editions -> MediaFiles, all in
-- relational tables; legacy document stores preserved as SQLite tables so every
-- existing record/semantic survives migration (spec 72). No destructive ops.

PRAGMA foreign_keys = ON;

-- ============ settings (canonical app configuration) ============
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                -- JSON encoded
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- ============ generic document stores (legacy IndexedDB parity) ============
-- One table for all legacy stores; ref1/ref2 mirror IndexedDB index lookups.
CREATE TABLE IF NOT EXISTS doc_store (
  store      TEXT NOT NULL,
  key        TEXT NOT NULL,                -- stringified keyPath value
  num        REAL,                          -- numeric mirror of key (ordering)
  media_type TEXT,
  ref1       TEXT,
  ref2       TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  payload    TEXT NOT NULL,                 -- full record JSON
  PRIMARY KEY (store, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_doc_store_ref1 ON doc_store(store, ref1);
CREATE INDEX IF NOT EXISTS idx_doc_store_ref2 ON doc_store(store, ref2);
CREATE INDEX IF NOT EXISTS idx_doc_store_mtype ON doc_store(store, media_type);
CREATE INDEX IF NOT EXISTS idx_doc_store_num  ON doc_store(store, num);

-- ============ media identity: editions & local files per work ============
CREATE TABLE IF NOT EXISTS editions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  store      TEXT NOT NULL DEFAULT 'movies',   -- owning work store ('movies'|'tvshows')
  work_key   TEXT NOT NULL,                    -- doc_store key of the work
  name       TEXT NOT NULL,                    -- "4K", "Director's Cut", ...
  kind       TEXT,                             -- quality|cut|language|alternative
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(store, work_key, name)
);

CREATE TABLE IF NOT EXISTS media_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store       TEXT NOT NULL,
  work_key    TEXT NOT NULL,                   -- doc_store key of work/episode
  edition_id  INTEGER REFERENCES editions(id) ON DELETE SET NULL,
  path        TEXT NOT NULL,
  norm_path   TEXT NOT NULL,                   -- lowercase for dedupe/lookup
  filename    TEXT NOT NULL,
  size_bytes  INTEGER,
  mtime_ms    INTEGER,
  quality     TEXT,
  source_kind TEXT,
  languages   TEXT,                             -- JSON array
  status      TEXT NOT NULL DEFAULT 'ok',       -- ok|missing|unlinked
  missing_since INTEGER,
  added_at    INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(norm_path)
);
CREATE INDEX IF NOT EXISTS idx_files_work ON media_files(store, work_key);
CREATE INDEX IF NOT EXISTS idx_files_status ON media_files(status);

CREATE TABLE IF NOT EXISTS library_sources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT NOT NULL UNIQUE,
  norm_path  TEXT NOT NULL UNIQUE,
  label      TEXT,
  kind       TEXT NOT NULL DEFAULT 'mixed',     -- movies|tv|anime|docs|mixed
  enabled    INTEGER NOT NULL DEFAULT 1,
  last_scan_at INTEGER,
  stats      TEXT                                -- JSON {files,added,ignored,errors}
);

CREATE TABLE IF NOT EXISTS import_candidates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL,
  norm_path    TEXT NOT NULL,
  filename     TEXT NOT NULL,
  size_bytes   INTEGER,
  parsed       TEXT NOT NULL,                    -- parser output JSON
  media_type   TEXT NOT NULL,                    -- movie|tv|anime|documentary|special
  tmdb_id      INTEGER,
  tmdb_match   TEXT,                             -- {title,year,poster,overview}
  confidence   REAL NOT NULL DEFAULT 0,          -- 0..100
  season       INTEGER,
  episode      INTEGER,
  duplicate_of TEXT,                             -- existing work_key or null
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|ignored|deferred|staged
  notes        TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  resolved_at  INTEGER,
  UNIQUE(norm_path)
);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON import_candidates(status, confidence);

-- ============ TMDB cache-first store (spec 20) ============
CREATE TABLE IF NOT EXISTS tmdb_cache (
  key        TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  payload    TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  ttl_ms     INTEGER NOT NULL,
  hits       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tmdb_cache_cat ON tmdb_cache(category, fetched_at);

CREATE TABLE IF NOT EXISTS tmdb_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS image_cache_index (
  path       TEXT PRIMARY KEY,   -- normalized tmdb image path
  category   TEXT NOT NULL,
  size_token TEXT NOT NULL,
  file_rel   TEXT NOT NULL,      -- relative to userData/images
  bytes      INTEGER,
  cached_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- ============ behavioral events (aggregated, local-first — spec 75) ============
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  type      TEXT NOT NULL,
  subject   TEXT,                 -- "movie:123" style ref
  payload   TEXT,
  ts        INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);

-- ============ duplicate decisions (keep-both / merge audit trail) ============
CREATE TABLE IF NOT EXISTS duplicate_decisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_key    TEXT NOT NULL UNIQUE,
  action      TEXT NOT NULL,       -- merge|keep_both|ignore
  detail      TEXT,
  decided_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- ============ health issue ledger ============
CREATE TABLE IF NOT EXISTS health_issues (
  id         TEXT PRIMARY KEY,      -- stable hash(type|ref)
  type       TEXT NOT NULL,          -- missing_file|broken_link|no_poster|no_metadata|stale|source_down|duplicate|inbox_backlog
  severity   TEXT NOT NULL,          -- info|warning|error
  ref_store  TEXT,
  ref_key    TEXT,
  message    TEXT NOT NULL,
  detail     TEXT,
  status     TEXT NOT NULL DEFAULT 'open', -- open|dismissed|fixed
  found_at   INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  fixed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_health_status ON health_issues(status, severity);

-- ============ library snapshots (spec 14 / existing SnapshotsPage) ============
CREATE TABLE IF NOT EXISTS snapshots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT,
  counts     TEXT NOT NULL,          -- JSON
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- Full-text local search table (work_fts) is created by the migration runner
-- when the SQLite build supports FTS5 (native driver). The WASM fallback build
-- does not; the library search then uses its normalized-title scan instead.

-- ============ kv for app-owned documents (taste profile, custom types, eras…) ============
CREATE TABLE IF NOT EXISTS app_kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('region', '"SA"'),
  ('language', '"ar-SA"'),
  ('autoConfirmThreshold', '92'),
  ('dbSchemaVersion', '1');
