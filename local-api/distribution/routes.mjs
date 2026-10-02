// /api/dist/* — 배포 오케스트레이터 HTTP 경로. studio-server.mjs 가 로그인 검사 뒤에 넘겨 줍니다.

import {
  PLATFORMS,
  CHECKPOINTS,
  OUTLOOK_LABELS,
  DIAGNOSTIC_METRICS,
  MISS_CAUSES,
  MAX_NEXT_CHANGES,
  NAVER_MAX_HASHTAGS,
  BASELINE_SIZE,
} from './constants.mjs';
import { BASELINE_COLUMNS } from './forecast.mjs';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  PACKAGE_SCHEMA,
  REVIEW_SYSTEM_PROMPT,
  REVIEW_SCHEMA,
  buildPackageMessage,
  buildReviewMessage,
  validate,
  enforcePackageRules,
  enforceReviewRules,
} from './prompt.mjs';
import * as claude from './claude.mjs';
import * as store from './store.mjs';

const enc = encodeURIComponent;

function packageRequest(slug, epNo) {
  const { series, episode } = store.assertUnlocked(slug, epNo);
  const { records, block } = store.seriesLearnings(slug, { beforeEp: episode.ep_no });
  const user = buildPackageMessage({
    series,
    episode,
    baselineSummary: store.getBaselines().summary,
    learningBlock: records.length ? block : '',
  });
  return { system: SYSTEM_PROMPT, user, schema: PACKAGE_SCHEMA };
}

function reviewRequest(slug, epNo, checkpoint) {
  const d = store.getEpisodeDetail(slug, epNo);
  const r = d.reviews[checkpoint];
  if (!r) throw new store.UserError(`${checkpoint} 판정이 아직 없습니다. 실적부터 넣어 주십시오.`);
  const user = buildReviewMessage({
    series: d.series,
    episode: d.episode,
    pkg: d.package,
    locked: d.forecast,
    evaluation: r.evaluation,
    diagnosis: r.diagnosis,
    actuals: d.actuals[checkpoint],
  });
  return { system: REVIEW_SYSTEM_PROMPT, user, schema: REVIEW_SCHEMA };
}

function parsePasted(raw, schema) {
  let json = raw;
  if (typeof raw === 'string') {
    // 코드 울타리로 감싸 붙여넣어도 받아 줍니다.
    const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      json = JSON.parse(body);
    } catch (e) {
      throw new store.UserError(`붙여넣은 내용이 JSON 이 아닙니다: ${e.message}`);
    }
  }
  const errors = validate(schema, json);
  if (errors.length) throw new store.UserError(`모양이 맞지 않습니다:\n${errors.slice(0, 12).join('\n')}`);
  return json;
}

/**
 * @returns true 면 처리함, false 면 이 모듈 경로가 아님
 */
export async function handleDist(req, res, path, { json, readBody }) {
  if (!path.startsWith('/api/dist/')) return false;
  const m = req.method;
  const seg = path.slice('/api/dist/'.length).split('/').map(decodeURIComponent);
  const send = (status, body) => {
    json(res, status, body);
    return true;
  };

  try {
    // 고정 정보
    if (m === 'GET' && seg[0] === 'meta') {
      return send(200, {
        platforms: PLATFORMS,
        checkpoints: CHECKPOINTS,
        outlooks: OUTLOOK_LABELS,
        diagnosticMetrics: DIAGNOSTIC_METRICS,
        missCauses: MISS_CAUSES,
        maxNextChanges: MAX_NEXT_CHANGES,
        naverMaxHashtags: NAVER_MAX_HASHTAGS,
        baselineSize: BASELINE_SIZE,
        baselineColumns: BASELINE_COLUMNS,
        promptVersion: PROMPT_VERSION,
        api: { available: claude.hasKey(), model: claude.MODEL },
      });
    }

    // 기준 데이터
    if (seg[0] === 'baselines') {
      if (m === 'GET' && seg.length === 1) return send(200, store.getBaselines());
      if (m === 'POST' && seg.length === 2) {
        const b = await readBody(req, 256 * 1024);
        return send(200, store.saveBaseline(seg[1], String(b.text ?? '')));
      }
    }

    if (seg[0] !== 'series') return send(404, { error: 'not_found' });

    if (seg.length === 1) {
      if (m === 'GET') return send(200, { series: store.listSeries() });
      if (m === 'POST') {
        const b = await readBody(req, 256 * 1024);
        return send(200, store.createSeries(b));
      }
    }

    const slug = seg[1];
    if (seg.length === 2) {
      if (m === 'GET') return send(200, store.listEpisodes(slug));
      if (m === 'POST') {
        const b = await readBody(req, 256 * 1024);
        return send(200, store.updateSeries(slug, b));
      }
    }

    if (seg[2] === 'learning' && m === 'GET') {
      return send(200, store.seriesLearnings(slug));
    }

    if (seg[2] !== 'episodes') return send(404, { error: 'not_found' });

    if (seg.length === 3 && m === 'POST') {
      const b = await readBody(req, 1024 * 1024);
      return send(200, store.saveEpisode(slug, { ...b, create: true }));
    }

    const epNo = Number(seg[3]);
    const action = seg[4];

    if (!action) {
      if (m === 'GET') return send(200, store.getEpisodeDetail(slug, epNo));
      if (m === 'POST') {
        const b = await readBody(req, 1024 * 1024);
        return send(200, store.saveEpisode(slug, { ...b, epNo, create: false }));
      }
    }

    // 지시문 보기 (키 없이 손으로 돌릴 때)
    if (action === 'prompt' && m === 'GET') {
      return send(200, packageRequest(slug, epNo));
    }

    // 패키지 만들기 / 붙여넣기
    if (action === 'package' && m === 'POST') {
      const b = await readBody(req, 1024 * 1024);
      let output;
      let model = null;
      let source;
      if (b.mode === 'paste') {
        store.assertUnlocked(slug, epNo);
        output = parsePasted(b.json, PACKAGE_SCHEMA);
        source = 'paste';
      } else {
        const r = packageRequest(slug, epNo);
        const out = await claude.structuredCall({ system: r.system, user: r.user, schema: r.schema });
        const errors = validate(PACKAGE_SCHEMA, out.json);
        if (errors.length) throw new Error(`모델 출력 모양이 맞지 않습니다: ${errors.slice(0, 5).join(' / ')}`);
        output = out.json;
        model = out.model;
        source = 'api';
      }
      const fixes = enforcePackageRules(output);
      const saved = store.savePackage(slug, epNo, {
        output,
        fixes,
        model,
        promptVersion: PROMPT_VERSION,
        source,
      });
      return send(200, saved);
    }

    // 예측 잠그기
    if (action === 'lock' && m === 'POST') {
      return send(200, store.lockForecast(slug, epNo));
    }

    // 실적 넣기 → 판정
    if (action === 'actuals' && m === 'POST' && seg[5]) {
      const b = await readBody(req, 256 * 1024);
      return send(200, store.saveActuals(slug, epNo, seg[5], b.platforms));
    }

    // 리뷰 (원인 · 유지 · 다음 변경)
    if (action === 'review' && seg[5]) {
      const cp = seg[5];
      if (m === 'GET' && seg[6] === 'prompt') return send(200, reviewRequest(slug, epNo, cp));
      if (m === 'POST') {
        const b = await readBody(req, 256 * 1024);
        let review;
        let source = b.mode;
        if (b.mode === 'api') {
          const r = reviewRequest(slug, epNo, cp);
          const out = await claude.structuredCall({ ...r, effort: 'high', maxTokens: 32000 });
          review = parsePasted(out.json, REVIEW_SCHEMA);
        } else {
          review = parsePasted(b.json, REVIEW_SCHEMA);
          source = b.mode === 'manual' ? 'manual' : 'paste';
        }
        const fixes = enforceReviewRules(review);
        const record = store.saveReview(slug, epNo, cp, review, source);
        return send(200, { record, fixes });
      }
    }

    return send(404, { error: 'not_found', path: `/api/dist/${seg.map(enc).join('/')}` });
  } catch (err) {
    if (err instanceof store.UserError) return send(err.status, { error: err.message });
    // SQLite 트리거가 막은 경우 (잠긴 예측 수정 시도)
    if (/잠긴 예측/.test(String(err?.message))) return send(409, { error: err.message });
    throw err;
  }
}
