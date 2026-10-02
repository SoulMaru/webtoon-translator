// 게시 전 숫자 예측.
// 규칙: 숫자는 모델이 지어내지 않습니다. 최근 게시물의 중앙값 × 전망 배수로만 냅니다.
// 기준 데이터가 없으면 숫자를 내지 않고 "없음"이라고 적습니다.

import {
  PLATFORM_IDS,
  CHECKPOINTS,
  METRICS,
  OUTLOOK_MULTIPLIERS,
  BASELINE_SIZE,
} from './constants.mjs';

/** 기준 데이터 붙여넣기 칸의 열 순서. 한 줄이 게시물 하나입니다. */
export const BASELINE_COLUMNS = [
  'views_2h',
  'views_24h',
  'views_72h',
  'views_7d',
  'comments_24h',
];

export function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function parseNumber(raw) {
  const s = String(raw ?? '').trim().replace(/,/g, '');
  if (s === '' || s === '-') return null;
  // 1.2만 / 3천 / 1.5k 같은 표기를 받아 줍니다.
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(만|천|k|K|m|M)?$/);
  if (!m) return NaN;
  const unit = { 만: 1e4, 천: 1e3, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]] ?? 1;
  return Math.round(Number(m[1]) * unit);
}

/**
 * 붙여넣은 글을 게시물 목록으로 바꿉니다.
 * 한 줄 = 게시물 하나, 칸은 쉼표·탭·공백 어느 것으로 나눠도 됩니다 (스프레드시트에서 복사하면 탭).
 * 칸 순서: 2h조회, 24h조회, 72h조회, 7d조회, 24h댓글 (모르는 칸은 - )
 * 숫자로 시작하지 않는 줄(메모)과 숫자 칸이 하나도 없는 줄(머리줄)은 건너뜁니다.
 */
export function parseBaselineText(text) {
  const posts = [];
  const errors = [];
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || !/^[\d-]/.test(trimmed)) return;
    // 탭·쉼표로 나눴으면 빈 칸도 자리로 셉니다. 공백으로만 나눴으면 빈 칸은 - 로 적어야 합니다.
    const cells = /[\t,]/.test(trimmed)
      ? trimmed.split(/[\t,]/).map((c) => c.trim())
      : trimmed.split(/\s+/);
    const values = BASELINE_COLUMNS.map((_, j) => parseNumber(cells[j]));
    // 숫자로 읽히는 칸이 하나도 없으면 머리줄(예: "2h, 24h, …")로 보고 건너뜁니다.
    if (values.every((v) => v === null || Number.isNaN(v))) return;
    const post = {};
    BASELINE_COLUMNS.forEach((col, j) => {
      const v = values[j];
      if (Number.isNaN(v)) errors.push(`${i + 1}번째 줄 ${j + 1}번째 칸을 숫자로 읽지 못했습니다: "${cells[j]}"`);
      else if (v !== null) post[col] = v;
    });
    if (Object.keys(post).length) posts.push(post);
  });
  // 최근 것이 위에 있다고 보고 앞에서부터 BASELINE_SIZE 개만 씁니다.
  const extra = Math.max(0, posts.length - BASELINE_SIZE);
  return { posts: posts.slice(0, BASELINE_SIZE), errors, dropped: extra };
}

/** 플랫폼별 게시물 목록 → 시점·지표별 중앙값과 표본 수. */
export function summarizeBaseline(postsByPlatform) {
  const out = {};
  for (const platform of PLATFORM_IDS) {
    const posts = postsByPlatform?.[platform] ?? [];
    const stats = {};
    for (const cp of CHECKPOINTS) {
      for (const metric of METRICS) {
        const values = posts.map((p) => p[`${metric}_${cp}`]).filter(Number.isFinite);
        if (!values.length) continue;
        stats[`${metric}_${cp}`] = { median: median(values), n: values.length };
      }
    }
    out[platform] = { posts: posts.length, stats };
  }
  return out;
}

/**
 * 잠글 예측을 만듭니다.
 * @param qualitative 모델이 낸 forecast 블록 (platform_outlook 포함)
 * @param baseline    summarizeBaseline 결과
 */
export function buildNumericForecast(qualitative, baseline) {
  const outlookOf = Object.fromEntries(
    (qualitative?.platform_outlook ?? []).map((o) => [o.platform, o.outlook])
  );
  const ranges = {};
  for (const platform of PLATFORM_IDS) {
    const outlook = outlookOf[platform] ?? 'at';
    const [lo, hi] = OUTLOOK_MULTIPLIERS[outlook] ?? OUTLOOK_MULTIPLIERS.at;
    const stats = baseline?.[platform]?.stats ?? {};
    const byKey = {};
    for (const [key, { median: m, n }] of Object.entries(stats)) {
      byKey[key] = {
        median: m,
        n,
        low: Math.round(m * lo),
        high: Math.round(m * hi),
        reliable: n >= BASELINE_SIZE,
      };
    }
    ranges[platform] = { outlook, multiplier: [lo, hi], metrics: byKey };
  }
  return ranges;
}

/** 사람이 읽을 한 줄. 기준이 없으면 숫자 대신 이유를 씁니다. */
export function describeRange(r) {
  if (!r) return '기준 데이터 없음 — 숫자 예측 생략';
  const fmt = (v) => v.toLocaleString('ko-KR');
  const tag = r.reliable ? `중앙값 ${fmt(r.median)}` : `참고값 · 표본 ${r.n}/${BASELINE_SIZE}`;
  return `${fmt(r.low)} ~ ${fmt(r.high)} (${tag})`;
}
