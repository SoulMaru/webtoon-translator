-- 새김AI Atelier · 로컬 데이터베이스 스키마
-- 이 파일은 서버가 뜰 때마다 실행됩니다. 반드시 여러 번 실행해도 안전해야 합니다.

CREATE TABLE IF NOT EXISTS works (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  media_file  TEXT    NOT NULL,
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  orientation TEXT    NOT NULL DEFAULT 'landscape',
  tags        TEXT    NOT NULL DEFAULT '[]',
  published   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_feed
  ON works (published, sort_order DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('site_title',   '새김AI'),
  ('site_tagline', 'Atelier'),
  ('site_intro',   '한 장씩 새겨 둔 것들입니다.');

-- 이미 가져온 원본을 기억해 둡니다. 같은 파일을 두 번 등록하지 않기 위한 표입니다.
CREATE TABLE IF NOT EXISTS ingested (
  source_path TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);
