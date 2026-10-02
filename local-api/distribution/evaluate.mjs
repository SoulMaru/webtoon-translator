// 게시 후 실적과 잠근 예측을 견줍니다.
// 판정 규칙은 docs/08-배포-오케스트레이터.md 의 "판정 규칙" 표와 같습니다.

import {
  PLATFORM_IDS,
  PARTIAL_TOLERANCE,
  DIAGNOSTIC_METRICS,
  platformName,
} from './constants.mjs';
import { median } from './forecast.mjs';

/** 실제 값 하나를 예측 범위와 견줍니다. */
export function judgeValue(actual, range) {
  if (!range || !Number.isFinite(actual)) return null;
  const { low, high } = range;
  if (actual >= low && actual <= high) {
    return { actual, low, high, verdict: 'HIT', direction: 'inside', distance: 0 };
  }
  const under = actual < low;
  const edge = under ? low : high;
  const distance = edge > 0 ? Math.abs(actual - edge) / edge : Infinity;
  return {
    actual,
    low,
    high,
    verdict: distance <= PARTIAL_TOLERANCE ? 'PARTIAL HIT' : 'MISS',
    direction: under ? 'under' : 'over',
    distance: Number.isFinite(distance) ? Math.round(distance * 1000) / 1000 : null,
  };
}

const SCORE = { HIT: 1, 'PARTIAL HIT': 0.5, MISS: 0 };

/**
 * 실제로 가장 강했던/약했던 플랫폼.
 * 플랫폼마다 규모가 다르므로 가능한 한 "자기 기준 중앙값 대비 배수"로 견줍니다.
 * 기준이 하나도 없을 때만 조회수 절대값으로 견줍니다.
 */
export function rankPlatforms(actualsByPlatform, ranges, checkpoint) {
  const key = `views_${checkpoint}`;
  const rows = [];
  for (const p of PLATFORM_IDS) {
    const views = actualsByPlatform?.[p]?.views;
    if (!Number.isFinite(views)) continue;
    const m = ranges?.[p]?.metrics?.[key]?.median;
    rows.push({ platform: p, views, ratio: Number.isFinite(m) && m > 0 ? views / m : null });
  }
  if (rows.length < 2) return { basis: null, order: rows.map((r) => r.platform) };
  const withRatio = rows.filter((r) => r.ratio !== null);
  const useRatio = withRatio.length >= 2;
  const pool = useRatio ? withRatio : rows;
  pool.sort((a, b) => (useRatio ? b.ratio - a.ratio : b.views - a.views));
  return { basis: useRatio ? 'ratio_to_baseline' : 'absolute_views', order: pool.map((r) => r.platform) };
}

/**
 * 한 시점의 판정.
 * @param locked { qualitative, ranges } — 잠근 예측
 * @param actualsByPlatform { [platform]: { views, comments, ...선택 지표 } }
 */
export function evaluateCheckpoint(locked, actualsByPlatform, checkpoint) {
  const platforms = {};
  const notes = [];

  for (const p of PLATFORM_IDS) {
    const actual = actualsByPlatform?.[p];
    if (!actual) continue;
    const metrics = locked?.ranges?.[p]?.metrics ?? {};
    platforms[p] = {
      views: judgeValue(actual.views, metrics[`views_${checkpoint}`]),
      comments: judgeValue(actual.comments, metrics[`comments_${checkpoint}`]),
    };
  }

  const ranking = rankPlatforms(actualsByPlatform, locked?.ranges, checkpoint);
  // 예측한 플랫폼이 비교 대상(기준이 있는 플랫폼)에 없으면 맞고 틀림을 매기지 않습니다.
  const call = (predicted, actual) => ({
    predicted: predicted ?? null,
    actual: actual ?? null,
    correct: predicted && actual && ranking.order.includes(predicted) ? predicted === actual : null,
  });
  const calls = {
    basis: ranking.basis,
    strongest: call(locked?.qualitative?.strongest_platform, ranking.basis ? ranking.order[0] : null),
    weakest: call(locked?.qualitative?.weakest_platform, ranking.basis ? ranking.order.at(-1) : null),
  };

  const judged = Object.values(platforms)
    .map((x) => x.views?.verdict)
    .filter((v) => v in SCORE);
  let score = null;
  let verdict = null;

  if (judged.length) {
    score = judged.reduce((s, v) => s + SCORE[v], 0) / judged.length;
    if (score >= 0.75) verdict = calls.strongest.correct === false ? 'PARTIAL HIT' : 'HIT';
    else if (score >= 0.4) verdict = 'PARTIAL HIT';
    else verdict = 'MISS';
    notes.push(`숫자 범위가 있는 ${judged.length}개 플랫폼 조회수 기준 점수 ${score.toFixed(2)}`);
    if (score >= 0.75 && calls.strongest.correct === false) {
      notes.push('범위는 대체로 맞았으나 가장 강할 플랫폼 예측이 틀려 PARTIAL HIT 로 낮춤');
    }
  } else {
    const hits = [calls.strongest.correct, calls.weakest.correct].filter((c) => c !== null);
    if (hits.length) {
      const right = hits.filter(Boolean).length;
      verdict = right === hits.length ? 'HIT' : right > 0 ? 'PARTIAL HIT' : 'MISS';
      notes.push('숫자 기준이 없어 강·약 플랫폼 예측만으로 판정');
    } else {
      notes.push('판정 불가 — 숫자 기준도, 견줄 실적(2개 플랫폼 이상)도 없습니다');
    }
  }

  return { checkpoint, verdict, score, platforms, calls, notes };
}

/**
 * MISS 원인 후보를 지표로 찾습니다. 이전 화들의 같은 시점 실적 중앙값과 견줍니다.
 * 결론이 아니라 "근거 있는 후보"입니다. 근거가 없으면 없다고 돌려줍니다.
 *
 * @param evaluation evaluateCheckpoint 결과
 * @param actualsByPlatform 이번 화 실적
 * @param history [{ [platform]: metrics }] 이전 화들의 같은 시점 실적
 */
export function diagnoseMiss(evaluation, actualsByPlatform, history = []) {
  const candidates = [];
  const missed = Object.entries(evaluation.platforms).filter(
    ([, r]) => r.views?.verdict === 'MISS'
  );

  for (const [platform, r] of missed) {
    const now = actualsByPlatform?.[platform] ?? {};
    const under = r.views.direction === 'under';
    for (const { key, label, cause } of DIAGNOSTIC_METRICS) {
      if (!cause || !Number.isFinite(now[key])) continue;
      const ref = median(history.map((h) => h?.[platform]?.[key]).filter(Number.isFinite));
      if (ref === null || ref <= 0) continue;
      const ratio = now[key] / ref;
      // 노출은 30% 이상, 비율 지표는 15% 이상 벗어나야 근거로 칩니다.
      const gap = key === 'reach' ? 0.3 : 0.15;
      const moved = under ? ratio <= 1 - gap : ratio >= 1 + gap;
      if (!moved) continue;
      candidates.push({
        cause,
        platform,
        metric: key,
        actual: now[key],
        reference: ref,
        note: `${platformName(platform)} ${label} ${now[key]} — 이전 화 중앙값 ${ref} 대비 ${Math.round(ratio * 100)}%`,
      });
    }
  }

  return {
    missedPlatforms: missed.map(([p]) => p),
    candidates,
    categories: [...new Set(candidates.map((c) => c.cause))],
    insufficient: missed.length > 0 && candidates.length === 0,
    historyEpisodes: history.length,
  };
}
