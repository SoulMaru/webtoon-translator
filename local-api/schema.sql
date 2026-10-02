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

-- ── 배포 오케스트레이터 (만들기 콘솔 · 개인용) ─────────────────────
-- 작품(시리즈) → 회차 → 배포 패키지 → 잠긴 예측 → 시점별 실적 → 리뷰 → 학습기록
-- 자세한 규칙은 docs/08-배포-오케스트레이터.md

CREATE TABLE IF NOT EXISTS dist_series (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  logline     TEXT    NOT NULL DEFAULT '',
  carry_in    TEXT    NOT NULL DEFAULT '',  -- 이전 작품에서 넘겨받은 교훈 (사람이 적음)
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS dist_episodes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id    INTEGER NOT NULL REFERENCES dist_series(id),
  ep_no        INTEGER NOT NULL,             -- 작품 안에서의 회차 번호 (1부터)
  title        TEXT    NOT NULL DEFAULT '',
  duration_sec INTEGER,
  script       TEXT    NOT NULL DEFAULT '',
  video_notes  TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  UNIQUE (series_id, ep_no)
);

-- 플랫폼별 최근 게시물 실적 (계정 단위). 예측을 잠글 때 이 시점 값이 예측 안에 복사됩니다.
CREATE TABLE IF NOT EXISTS dist_baselines (
  platform    TEXT PRIMARY KEY,
  raw_text    TEXT NOT NULL,
  posts       TEXT NOT NULL,   -- JSON
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dist_packages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id     INTEGER NOT NULL REFERENCES dist_episodes(id),
  version        INTEGER NOT NULL,
  output         TEXT    NOT NULL,   -- JSON (prompt.mjs PACKAGE_SCHEMA)
  fixes          TEXT    NOT NULL DEFAULT '[]',
  model          TEXT,
  prompt_version TEXT    NOT NULL,
  source         TEXT    NOT NULL,   -- api | paste
  created_at     TEXT    NOT NULL,
  UNIQUE (episode_id, version)
);

-- 게시 전 예측. 한 회차에 하나, 한 번 넣으면 고치지도 지우지도 못합니다.
CREATE TABLE IF NOT EXISTS dist_forecasts (
  episode_id     INTEGER PRIMARY KEY REFERENCES dist_episodes(id),
  package_id     INTEGER NOT NULL REFERENCES dist_packages(id),
  qualitative    TEXT    NOT NULL,   -- JSON
  ranges         TEXT    NOT NULL,   -- JSON
  baseline       TEXT    NOT NULL,   -- JSON (잠근 시점의 기준 요약)
  prompt_version TEXT    NOT NULL,
  locked_at      TEXT    NOT NULL
);

CREATE TRIGGER IF NOT EXISTS dist_forecasts_no_update
BEFORE UPDATE ON dist_forecasts
BEGIN
  SELECT RAISE(ABORT, '잠긴 예측은 수정할 수 없습니다');
END;

CREATE TRIGGER IF NOT EXISTS dist_forecasts_no_delete
BEFORE DELETE ON dist_forecasts
BEGIN
  SELECT RAISE(ABORT, '잠긴 예측은 지울 수 없습니다');
END;

CREATE TABLE IF NOT EXISTS dist_actuals (
  episode_id  INTEGER NOT NULL REFERENCES dist_episodes(id),
  platform    TEXT    NOT NULL,
  checkpoint  TEXT    NOT NULL,   -- 2h | 24h | 72h | 7d
  metrics     TEXT    NOT NULL,   -- JSON
  recorded_at TEXT    NOT NULL,
  PRIMARY KEY (episode_id, platform, checkpoint)
);

CREATE TABLE IF NOT EXISTS dist_reviews (
  episode_id  INTEGER NOT NULL REFERENCES dist_episodes(id),
  checkpoint  TEXT    NOT NULL,
  evaluation  TEXT    NOT NULL,   -- JSON (시스템 판정)
  diagnosis   TEXT    NOT NULL,   -- JSON (지표 근거 후보)
  review      TEXT,               -- JSON (원인 · 유지 · 다음 변경)
  source      TEXT,               -- api | paste | manual
  updated_at  TEXT    NOT NULL,
  PRIMARY KEY (episode_id, checkpoint)
);

CREATE TABLE IF NOT EXISTS dist_learnings (
  episode_id  INTEGER PRIMARY KEY REFERENCES dist_episodes(id),
  record      TEXT    NOT NULL,   -- JSON (learning.mjs)
  updated_at  TEXT    NOT NULL
);
