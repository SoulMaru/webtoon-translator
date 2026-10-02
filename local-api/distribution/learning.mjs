// 회차 하나가 끝날 때마다 남기는 구조화된 학습기록.
// 이 기록은 (1) 다음 화 배포 패키지를 만들 때 모델에게 다시 들어가고
//          (2) 다음 작품 제작 프롬프트에 그대로 붙일 수 있는 글로 뽑힙니다.

import { CHECKPOINTS, MAX_NEXT_CHANGES, platformName } from './constants.mjs';

export const LEARNING_SCHEMA = 'saegim.dist.learning/v1';

/** 가장 늦은 시점의 판정을 최종으로 봅니다 (7d > 72h > 24h > 2h). */
export function finalVerdict(evaluations) {
  for (const cp of [...CHECKPOINTS].reverse()) {
    const e = evaluations.find((x) => x.checkpoint === cp && x.verdict);
    if (e) return { checkpoint: cp, verdict: e.verdict };
  }
  return { checkpoint: null, verdict: null };
}

export function buildLearningRecord({ series, episode, pkg, locked, evaluations, review }) {
  const out = pkg?.output ?? {};
  const final = finalVerdict(evaluations);
  return {
    schema: LEARNING_SCHEMA,
    created_at: new Date().toISOString(),
    series: { slug: series.slug, title: series.title },
    episode: { no: episode.ep_no, title: episode.title },
    orchestrator: { prompt_version: pkg?.prompt_version ?? null, model: pkg?.model ?? null },
    packaging: {
      first3s_event: out.analysis?.first3s_event ?? null,
      core_mystery: out.analysis?.core_mystery ?? null,
      youtube_title: out.youtube_shorts?.final_title ?? null,
      threads_format: out.threads?.format ?? null,
      threads_topic: out.threads?.topic ?? null,
      trial_reel: out.instagram_reels?.trial_reel?.recommend ?? null,
    },
    forecast: {
      locked_at: locked?.locked_at ?? null,
      strongest: locked?.qualitative?.strongest_platform ?? null,
      weakest: locked?.qualitative?.weakest_platform ?? null,
      first3s: locked?.qualitative?.first3s_success?.level ?? null,
    },
    results: evaluations.map((e) => ({
      checkpoint: e.checkpoint,
      verdict: e.verdict,
      score: e.score,
      strongest_correct: e.calls?.strongest?.correct ?? null,
      weakest_correct: e.calls?.weakest?.correct ?? null,
      actual_strongest: e.calls?.strongest?.actual ?? null,
    })),
    final_verdict: final.verdict,
    final_checkpoint: final.checkpoint,
    miss_causes: review?.causes ?? [],
    keep: review?.keep ?? [],
    next_changes: (review?.next_changes ?? []).slice(0, MAX_NEXT_CHANGES),
  };
}

/** 작품 전체를 한데 모읍니다. */
export function rollup(records) {
  const verdicts = { HIT: 0, 'PARTIAL HIT': 0, MISS: 0 };
  const causes = { CONTENT: 0, PACKAGING: 0, DISTRIBUTION: 0 };
  const strongestActual = {};
  let callsRight = 0;
  let callsTotal = 0;

  for (const r of records) {
    if (r.final_verdict in verdicts) verdicts[r.final_verdict]++;
    for (const c of r.miss_causes ?? []) if (c.category in causes) causes[c.category]++;
    const last = r.results.find((x) => x.checkpoint === r.final_checkpoint);
    if (last?.actual_strongest) {
      strongestActual[last.actual_strongest] = (strongestActual[last.actual_strongest] ?? 0) + 1;
    }
    if (last && last.strongest_correct !== null) {
      callsTotal++;
      if (last.strongest_correct) callsRight++;
    }
  }

  return {
    episodes: records.length,
    verdicts,
    causes,
    strongestActual,
    strongestCallAccuracy: callsTotal ? callsRight / callsTotal : null,
  };
}

/**
 * 다음 작품(또는 다음 화) 제작 프롬프트에 붙일 학습 블록.
 * 사실(집계)과 제안(다음 변경)을 섞지 않도록 칸을 나눕니다.
 */
export function renderProductionBlock(series, records) {
  const sorted = [...records].sort((a, b) => a.episode.no - b.episode.no);
  const sum = rollup(sorted);
  const lines = [];
  lines.push(`## 배포 학습기록 · ${series.title} (${LEARNING_SCHEMA})`);
  lines.push('');
  if (!sorted.length) {
    lines.push('- 아직 평가를 마친 회차가 없습니다. 이 블록은 비어 있는 것이 맞습니다.');
    return lines.join('\n');
  }

  const first = sorted[0].episode.no;
  const last = sorted.at(-1).episode.no;
  lines.push(`### 집계 (실측 · ${sum.episodes}개 회차, ${first}화~${last}화 중 평가 완료분)`);
  lines.push(
    `- 판정: HIT ${sum.verdicts.HIT} · PARTIAL HIT ${sum.verdicts['PARTIAL HIT']} · MISS ${sum.verdicts.MISS}`
  );
  const strong = Object.entries(sum.strongestActual).sort((a, b) => b[1] - a[1]);
  if (strong.length) {
    lines.push(
      `- 실제로 가장 강했던 플랫폼: ${strong.map(([p, n]) => `${platformName(p)} ${n}회`).join(', ')}`
    );
  }
  if (sum.strongestCallAccuracy !== null) {
    lines.push(`- "가장 강할 플랫폼" 예측 적중률: ${Math.round(sum.strongestCallAccuracy * 100)}%`);
  }
  const causeLine = Object.entries(sum.causes).filter(([, n]) => n > 0);
  if (causeLine.length) {
    lines.push(`- MISS 원인 누적: ${causeLine.map(([c, n]) => `${c} ${n}`).join(' · ')}`);
  }

  const keeps = sorted.flatMap((r) => r.keep.map((k) => `${r.episode.no}화: ${k}`));
  if (keeps.length) {
    lines.push('');
    lines.push('### 효과가 확인된 것 (유지)');
    for (const k of keeps.slice(-8)) lines.push(`- ${k}`);
  }

  const latest = sorted.at(-1);
  if (latest.next_changes.length) {
    lines.push('');
    lines.push(`### 다음에 바꿀 변수 (제안 · ${latest.episode.no}화 평가에서 나옴, 최대 ${MAX_NEXT_CHANGES}개)`);
    for (const c of latest.next_changes) {
      const where = c.platforms?.length ? ` [${c.platforms.map(platformName).join(', ')}]` : '';
      lines.push(`- ${c.variable}${where}: ${c.change} — ${c.reason}`);
    }
  }

  lines.push('');
  lines.push('### 회차별');
  for (const r of sorted) {
    const causes = r.miss_causes.map((c) => c.category).join('/');
    lines.push(
      `- ${r.episode.no}화 ${r.episode.title ?? ''} · ${r.final_verdict ?? '판정 없음'}` +
        (r.final_checkpoint ? ` (${r.final_checkpoint})` : '') +
        (causes ? ` · 원인 ${causes}` : '') +
        (r.packaging.first3s_event ? ` · 첫 3초: ${r.packaging.first3s_event}` : '')
    );
  }
  return lines.join('\n');
}
