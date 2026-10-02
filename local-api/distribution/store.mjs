// 배포 오케스트레이터의 저장소. 갤러리와 같은 atelier.db 를 씁니다.

import { openDb } from '../db.mjs';
import { PLATFORM_IDS, CHECKPOINTS } from './constants.mjs';
import { parseBaselineText, summarizeBaseline, buildNumericForecast } from './forecast.mjs';
import { evaluateCheckpoint, diagnoseMiss } from './evaluate.mjs';
import { buildLearningRecord, renderProductionBlock } from './learning.mjs';

const now = () => new Date().toISOString();
const parse = (s, fallback = null) => {
  if (s == null) return fallback;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function slugify(text) {
  const s = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'series';
}

// ── 작품 ───────────────────────────────────────────

export function listSeries() {
  return openDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM dist_episodes e WHERE e.series_id = s.id) AS episodes
       FROM dist_series s ORDER BY s.id DESC`
    )
    .all();
}

export function getSeries(slug) {
  const row = openDb().prepare('SELECT * FROM dist_series WHERE slug = ?').get(slug);
  if (!row) throw new UserError(`그런 작품이 없습니다: ${slug}`, 404);
  return row;
}

export function createSeries({ title, slug, logline = '', carryIn = '' }) {
  if (!String(title ?? '').trim()) throw new UserError('작품 제목을 적어 주십시오');
  const db = openDb();
  const s = slugify(slug || title);
  if (db.prepare('SELECT 1 FROM dist_series WHERE slug = ?').get(s)) {
    throw new UserError(`같은 주소의 작품이 이미 있습니다: ${s}`, 409);
  }
  db.prepare(
    'INSERT INTO dist_series (slug, title, logline, carry_in, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(s, title.trim(), logline, carryIn, now());
  return getSeries(s);
}

export function updateSeries(slug, { logline, carryIn }) {
  const s = getSeries(slug);
  openDb()
    .prepare('UPDATE dist_series SET logline = ?, carry_in = ? WHERE id = ?')
    .run(logline ?? s.logline, carryIn ?? s.carry_in, s.id);
  return getSeries(slug);
}

// ── 회차 ───────────────────────────────────────────

/** 1화부터 가장 큰 번호까지 빠진 번호. 번호를 새로 매기기 전에 늘 확인합니다. */
export function numberingGaps(seriesId) {
  const nos = openDb()
    .prepare('SELECT ep_no FROM dist_episodes WHERE series_id = ? ORDER BY ep_no')
    .all(seriesId)
    .map((r) => r.ep_no);
  const have = new Set(nos);
  const max = nos.at(-1) ?? 0;
  const gaps = [];
  for (let i = 1; i <= max; i++) if (!have.has(i)) gaps.push(i);
  return { max, gaps, next: max + 1 };
}

export function listEpisodes(slug) {
  const s = getSeries(slug);
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT e.id, e.ep_no, e.title, e.duration_sec, e.updated_at,
         (SELECT MAX(version) FROM dist_packages p WHERE p.episode_id = e.id) AS package_version,
         (SELECT locked_at FROM dist_forecasts f WHERE f.episode_id = e.id) AS locked_at,
         (SELECT record FROM dist_learnings l WHERE l.episode_id = e.id) AS learning
       FROM dist_episodes e WHERE e.series_id = ? ORDER BY e.ep_no`
    )
    .all(s.id);
  const cps = db.prepare(
    'SELECT DISTINCT checkpoint FROM dist_actuals WHERE episode_id = ?'
  );
  return {
    series: s,
    numbering: numberingGaps(s.id),
    episodes: rows.map((r) => ({
      ep_no: r.ep_no,
      title: r.title,
      duration_sec: r.duration_sec,
      package_version: r.package_version,
      locked_at: r.locked_at,
      checkpoints: cps.all(r.id).map((c) => c.checkpoint),
      final_verdict: parse(r.learning)?.final_verdict ?? null,
    })),
  };
}

function episodeRow(seriesId, epNo) {
  const row = openDb()
    .prepare('SELECT * FROM dist_episodes WHERE series_id = ? AND ep_no = ?')
    .get(seriesId, epNo);
  if (!row) throw new UserError(`${epNo}화가 없습니다`, 404);
  return row;
}

const isLocked = (episodeId) =>
  Boolean(openDb().prepare('SELECT 1 FROM dist_forecasts WHERE episode_id = ?').get(episodeId));

/** 회차 저장. 새 번호면 만들고, 있는 번호면 고칩니다 (예측을 잠근 뒤에는 못 고칩니다). */
export function saveEpisode(slug, { epNo, title = '', durationSec = null, script = '', videoNotes = '', create }) {
  const s = getSeries(slug);
  const n = Number(epNo);
  if (!Number.isInteger(n) || n < 1) throw new UserError('회차 번호는 1 이상의 정수여야 합니다');
  const db = openDb();
  const existing = db
    .prepare('SELECT * FROM dist_episodes WHERE series_id = ? AND ep_no = ?')
    .get(s.id, n);

  if (create && existing) {
    throw new UserError(`${n}화는 이미 있습니다 (중복 번호). 다음 번호는 ${numberingGaps(s.id).next}화입니다.`, 409);
  }
  const t = now();
  const dur = Number.isFinite(Number(durationSec)) && durationSec !== '' && durationSec !== null ? Math.round(Number(durationSec)) : null;

  if (existing) {
    if (isLocked(existing.id)) throw new UserError('예측을 잠근 회차는 대본·메모를 고칠 수 없습니다', 409);
    db.prepare(
      `UPDATE dist_episodes SET title = ?, duration_sec = ?, script = ?, video_notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(title, dur, script, videoNotes, t, existing.id);
  } else {
    db.prepare(
      `INSERT INTO dist_episodes (series_id, ep_no, title, duration_sec, script, video_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(s.id, n, title, dur, script, videoNotes, t, t);
  }
  const numbering = numberingGaps(s.id);
  const warnings = numbering.gaps.length
    ? [`결번이 있습니다: ${numbering.gaps.map((g) => `${g}화`).join(', ')}`]
    : [];
  return { episode: episodeRow(s.id, n), numbering, warnings };
}

export function getEpisodeDetail(slug, epNo) {
  const s = getSeries(slug);
  const e = episodeRow(s.id, Number(epNo));
  const db = openDb();
  const pkgRow = db
    .prepare('SELECT * FROM dist_packages WHERE episode_id = ? ORDER BY version DESC LIMIT 1')
    .get(e.id);
  const fc = db.prepare('SELECT * FROM dist_forecasts WHERE episode_id = ?').get(e.id);
  const actuals = db.prepare('SELECT * FROM dist_actuals WHERE episode_id = ?').all(e.id);
  const reviews = db.prepare('SELECT * FROM dist_reviews WHERE episode_id = ?').all(e.id);
  const learning = db.prepare('SELECT record FROM dist_learnings WHERE episode_id = ?').get(e.id);

  const byCp = {};
  for (const a of actuals) (byCp[a.checkpoint] ??= {})[a.platform] = parse(a.metrics, {});

  return {
    series: s,
    episode: e,
    package: pkgRow ? packageFromRow(pkgRow) : null,
    forecast: fc ? forecastFromRow(fc) : null,
    actuals: byCp,
    reviews: Object.fromEntries(
      reviews.map((r) => [
        r.checkpoint,
        {
          evaluation: parse(r.evaluation),
          diagnosis: parse(r.diagnosis),
          review: parse(r.review),
          source: r.source,
          updated_at: r.updated_at,
        },
      ])
    ),
    learning: parse(learning?.record),
  };
}

const packageFromRow = (r) => ({
  id: r.id,
  version: r.version,
  output: parse(r.output),
  fixes: parse(r.fixes, []),
  model: r.model,
  prompt_version: r.prompt_version,
  source: r.source,
  created_at: r.created_at,
});

const forecastFromRow = (r) => ({
  package_id: r.package_id,
  qualitative: parse(r.qualitative),
  ranges: parse(r.ranges),
  baseline: parse(r.baseline),
  prompt_version: r.prompt_version,
  locked_at: r.locked_at,
});

// ── 패키지 ─────────────────────────────────────────

export function assertUnlocked(slug, epNo) {
  const s = getSeries(slug);
  const e = episodeRow(s.id, Number(epNo));
  if (isLocked(e.id)) throw new UserError('예측을 잠근 회차는 패키지를 다시 만들 수 없습니다', 409);
  return { series: s, episode: e };
}

export function savePackage(slug, epNo, { output, fixes, model, promptVersion, source }) {
  const { episode } = assertUnlocked(slug, epNo);
  const db = openDb();
  const { v } = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS v FROM dist_packages WHERE episode_id = ?')
    .get(episode.id);
  db.prepare(
    `INSERT INTO dist_packages (episode_id, version, output, fixes, model, prompt_version, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(episode.id, v + 1, JSON.stringify(output), JSON.stringify(fixes ?? []), model ?? null, promptVersion, source, now());
  return getEpisodeDetail(slug, epNo).package;
}

// ── 기준 데이터 ────────────────────────────────────

export function getBaselines() {
  const rows = openDb().prepare('SELECT * FROM dist_baselines').all();
  const byPlatform = Object.fromEntries(rows.map((r) => [r.platform, r]));
  const posts = Object.fromEntries(
    PLATFORM_IDS.map((p) => [p, parse(byPlatform[p]?.posts, [])])
  );
  return {
    raw: Object.fromEntries(PLATFORM_IDS.map((p) => [p, byPlatform[p]?.raw_text ?? ''])),
    updatedAt: Object.fromEntries(PLATFORM_IDS.map((p) => [p, byPlatform[p]?.updated_at ?? null])),
    summary: summarizeBaseline(posts),
  };
}

export function saveBaseline(platform, rawText) {
  if (!PLATFORM_IDS.includes(platform)) throw new UserError(`모르는 플랫폼: ${platform}`);
  const parsed = parseBaselineText(rawText);
  if (parsed.errors.length) throw new UserError(parsed.errors.join('\n'));
  openDb()
    .prepare(
      `INSERT INTO dist_baselines (platform, raw_text, posts, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(platform) DO UPDATE SET raw_text = excluded.raw_text, posts = excluded.posts,
         updated_at = excluded.updated_at`
    )
    .run(platform, rawText, JSON.stringify(parsed.posts), now());
  return { platform, posts: parsed.posts.length, dropped: parsed.dropped };
}

// ── 예측 잠그기 ────────────────────────────────────

export function lockForecast(slug, epNo) {
  const { episode } = assertUnlocked(slug, epNo);
  const db = openDb();
  const pkg = db
    .prepare('SELECT * FROM dist_packages WHERE episode_id = ? ORDER BY version DESC LIMIT 1')
    .get(episode.id);
  if (!pkg) throw new UserError('패키지를 먼저 만들어야 예측을 잠글 수 있습니다');
  const qualitative = parse(pkg.output).forecast;
  const baseline = getBaselines().summary;
  const ranges = buildNumericForecast(qualitative, baseline);
  db.prepare(
    `INSERT INTO dist_forecasts (episode_id, package_id, qualitative, ranges, baseline, prompt_version, locked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    episode.id,
    pkg.id,
    JSON.stringify(qualitative),
    JSON.stringify(ranges),
    JSON.stringify(baseline),
    pkg.prompt_version,
    now()
  );
  return getEpisodeDetail(slug, epNo).forecast;
}

// ── 실적 · 판정 ────────────────────────────────────

const NUMERIC_KEYS = new Set([
  'views', 'comments', 'likes', 'reach', 'start_rate', 'avg_view_pct',
  'completion_pct', 'shares', 'saves', 'follows', 'next_ep_clicks',
]);

export function saveActuals(slug, epNo, checkpoint, byPlatform) {
  if (!CHECKPOINTS.includes(checkpoint)) throw new UserError(`모르는 시점: ${checkpoint}`);
  const s = getSeries(slug);
  const e = episodeRow(s.id, Number(epNo));
  if (!isLocked(e.id)) {
    throw new UserError('예측을 잠그지 않은 회차입니다. 게시 전에 예측을 잠가야 실적을 받을 수 있습니다.', 409);
  }
  const stmt = openDb().prepare(
    `INSERT INTO dist_actuals (episode_id, platform, checkpoint, metrics, recorded_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(episode_id, platform, checkpoint) DO UPDATE SET metrics = excluded.metrics,
       recorded_at = excluded.recorded_at`
  );
  let saved = 0;
  for (const [platform, metrics] of Object.entries(byPlatform ?? {})) {
    if (!PLATFORM_IDS.includes(platform)) throw new UserError(`모르는 플랫폼: ${platform}`);
    const clean = {};
    for (const [k, v] of Object.entries(metrics ?? {})) {
      if (!NUMERIC_KEYS.has(k) || v === '' || v === null) continue;
      const n = Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) throw new UserError(`${platform} ${k} 값이 숫자가 아닙니다: ${v}`);
      clean[k] = n;
    }
    if (!Object.keys(clean).length) continue;
    stmt.run(e.id, platform, checkpoint, JSON.stringify(clean), now());
    saved++;
  }
  if (!saved) throw new UserError('저장할 숫자가 없습니다');
  return evaluate(slug, epNo, checkpoint);
}

/** 이전 회차들의 같은 시점 실적 — 원인 후보를 가를 때 기준으로 씁니다. */
function history(seriesId, epNo, checkpoint) {
  const rows = openDb()
    .prepare(
      `SELECT e.ep_no, a.platform, a.metrics FROM dist_actuals a
       JOIN dist_episodes e ON e.id = a.episode_id
       WHERE e.series_id = ? AND e.ep_no < ? AND a.checkpoint = ?`
    )
    .all(seriesId, epNo, checkpoint);
  const byEp = {};
  for (const r of rows) (byEp[r.ep_no] ??= {})[r.platform] = parse(r.metrics, {});
  return Object.values(byEp);
}

export function evaluate(slug, epNo, checkpoint) {
  const d = getEpisodeDetail(slug, epNo);
  if (!d.forecast) throw new UserError('잠긴 예측이 없습니다', 409);
  const actuals = d.actuals[checkpoint];
  if (!actuals) throw new UserError(`${checkpoint} 실적이 없습니다`);
  const evaluation = evaluateCheckpoint(d.forecast, actuals, checkpoint);
  const diagnosis = diagnoseMiss(evaluation, actuals, history(d.series.id, d.episode.ep_no, checkpoint));
  const prev = d.reviews[checkpoint];
  openDb()
    .prepare(
      `INSERT INTO dist_reviews (episode_id, checkpoint, evaluation, diagnosis, review, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(episode_id, checkpoint) DO UPDATE SET evaluation = excluded.evaluation,
         diagnosis = excluded.diagnosis, updated_at = excluded.updated_at`
    )
    .run(
      d.episode.id,
      checkpoint,
      JSON.stringify(evaluation),
      JSON.stringify(diagnosis),
      prev?.review ? JSON.stringify(prev.review) : null,
      prev?.source ?? null,
      now()
    );
  rebuildLearning(slug, epNo);
  return { evaluation, diagnosis };
}

export function saveReview(slug, epNo, checkpoint, review, source) {
  const d = getEpisodeDetail(slug, epNo);
  if (!d.reviews[checkpoint]) throw new UserError(`${checkpoint} 판정이 아직 없습니다`);
  openDb()
    .prepare('UPDATE dist_reviews SET review = ?, source = ?, updated_at = ? WHERE episode_id = ? AND checkpoint = ?')
    .run(JSON.stringify(review), source, now(), d.episode.id, checkpoint);
  return rebuildLearning(slug, epNo);
}

// ── 학습기록 ───────────────────────────────────────

export function rebuildLearning(slug, epNo) {
  const d = getEpisodeDetail(slug, epNo);
  const evaluations = CHECKPOINTS.map((cp) => d.reviews[cp]?.evaluation).filter(Boolean);
  // 원인·유지·다음 변경은 가장 늦은 시점의 리뷰를 씁니다.
  const latestReview = [...CHECKPOINTS].reverse().map((cp) => d.reviews[cp]?.review).find(Boolean);
  const record = buildLearningRecord({
    series: d.series,
    episode: d.episode,
    pkg: d.package,
    locked: d.forecast,
    evaluations,
    review: latestReview,
  });
  openDb()
    .prepare(
      `INSERT INTO dist_learnings (episode_id, record, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(episode_id) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at`
    )
    .run(d.episode.id, JSON.stringify(record), now());
  return record;
}

export function seriesLearnings(slug, { beforeEp } = {}) {
  const s = getSeries(slug);
  const rows = openDb()
    .prepare(
      `SELECT l.record FROM dist_learnings l JOIN dist_episodes e ON e.id = l.episode_id
       WHERE e.series_id = ? ${beforeEp ? 'AND e.ep_no < ?' : ''} ORDER BY e.ep_no`
    )
    .all(...(beforeEp ? [s.id, beforeEp] : [s.id]));
  const records = rows.map((r) => parse(r.record)).filter(Boolean);
  return { series: s, records, block: renderProductionBlock(s, records) };
}
