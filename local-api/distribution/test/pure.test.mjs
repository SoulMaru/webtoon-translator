import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, parseBaselineText, summarizeBaseline, buildNumericForecast, describeRange } from '../forecast.mjs';
import { judgeValue, evaluateCheckpoint, diagnoseMiss } from '../evaluate.mjs';
import { buildLearningRecord, renderProductionBlock } from '../learning.mjs';
import { PACKAGE_SCHEMA, REVIEW_SCHEMA, validate, enforcePackageRules, enforceReviewRules } from '../prompt.mjs';
import { samplePackage } from './fixtures.mjs';

test('중앙값', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test('기준 데이터 붙여넣기: 머리줄·단위·빈칸', () => {
  const r = parseBaselineText('2h,24h,72h,7d,댓글\n100, 1.2만, -, -, 30\n200\t5천\t\t\t10\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.posts.length, 2);
  assert.deepEqual(r.posts[0], { views_2h: 100, views_24h: 12000, comments_24h: 30 });
  assert.equal(r.posts[1].views_24h, 5000);
});

test('기준 데이터: 10개 넘으면 위에서 10개만', () => {
  const text = Array.from({ length: 13 }, (_, i) => `- ${i + 1}`).join('\n');
  const r = parseBaselineText(text);
  assert.equal(r.posts.length, 10);
  assert.equal(r.dropped, 3);
  assert.equal(r.posts[0].views_24h, 1);
});

test('기준 데이터: 못 읽는 칸은 오류', () => {
  const r = parseBaselineText('10 abc');
  assert.equal(r.errors.length, 1);
});

test('숫자 예측 = 중앙값 × 전망 배수, 기준 없으면 비움', () => {
  const posts = { youtube_shorts: Array.from({ length: 10 }, (_, i) => ({ views_24h: (i + 1) * 1000 })) };
  const summary = summarizeBaseline(posts);
  assert.equal(summary.youtube_shorts.stats.views_24h.median, 5500);
  const ranges = buildNumericForecast(samplePackage().forecast, summary);
  const yt = ranges.youtube_shorts.metrics.views_24h;
  assert.equal(yt.low, Math.round(5500 * 1.1));
  assert.equal(yt.high, Math.round(5500 * 1.8));
  assert.equal(yt.reliable, true);
  assert.deepEqual(ranges.tiktok.metrics, {});
  assert.match(describeRange(undefined), /숫자 예측 생략/);
});

test('표본이 10개보다 적으면 참고값', () => {
  const summary = summarizeBaseline({ tiktok: [{ views_24h: 100 }, { views_24h: 300 }] });
  const r = buildNumericForecast({ platform_outlook: [] }, summary).tiktok.metrics.views_24h;
  assert.equal(r.reliable, false);
  assert.match(describeRange(r), /참고값 · 표본 2\/10/);
});

test('판정: 안 HIT, 가장자리 25% 안 PARTIAL, 밖 MISS', () => {
  const range = { low: 100, high: 200 };
  assert.equal(judgeValue(150, range).verdict, 'HIT');
  assert.equal(judgeValue(80, range).verdict, 'PARTIAL HIT');
  assert.equal(judgeValue(70, range).verdict, 'MISS');
  assert.equal(judgeValue(70, range).direction, 'under');
  assert.equal(judgeValue(240, range).verdict, 'PARTIAL HIT');
  assert.equal(judgeValue(260, range).verdict, 'MISS');
  assert.equal(judgeValue(300, range).direction, 'over');
  assert.equal(judgeValue(10, null), null);
});

function lockedWith(medians, outlooks = {}) {
  const posts = Object.fromEntries(
    Object.entries(medians).map(([p, m]) => [p, Array.from({ length: 10 }, () => ({ views_24h: m }))])
  );
  const qualitative = {
    ...samplePackage().forecast,
    platform_outlook: Object.entries(outlooks).map(([platform, outlook]) => ({ platform, outlook, reason: '' })),
  };
  return { qualitative, ranges: buildNumericForecast(qualitative, summarizeBaseline(posts)) };
}

test('종합 판정 HIT: 범위 적중 + 가장 강할 플랫폼 적중', () => {
  const locked = lockedWith({ youtube_shorts: 1000, tiktok: 1000, threads: 1000 }, { youtube_shorts: 'above', tiktok: 'at', threads: 'below' });
  const e = evaluateCheckpoint(locked, { youtube_shorts: { views: 1500 }, tiktok: { views: 1000 }, threads: { views: 800 } }, '24h');
  assert.equal(e.verdict, 'HIT');
  assert.equal(e.calls.strongest.correct, true);
  assert.equal(e.calls.weakest.correct, true);
});

test('종합 판정: 범위는 맞아도 가장 강할 플랫폼이 틀리면 PARTIAL HIT', () => {
  const locked = lockedWith({ youtube_shorts: 1000, tiktok: 1000 }, { youtube_shorts: 'at', tiktok: 'at' });
  const e = evaluateCheckpoint(locked, { youtube_shorts: { views: 900 }, tiktok: { views: 1200 } }, '24h');
  assert.equal(e.score, 1);
  assert.equal(e.calls.strongest.correct, false);
  assert.equal(e.verdict, 'PARTIAL HIT');
});

test('종합 판정 MISS + 원인 후보', () => {
  const locked = lockedWith({ youtube_shorts: 1000, tiktok: 1000 }, { youtube_shorts: 'above', tiktok: 'above' });
  const actual = {
    youtube_shorts: { views: 300, start_rate: 50, avg_view_pct: 70 },
    tiktok: { views: 400, reach: 2000 },
  };
  const e = evaluateCheckpoint(locked, actual, '24h');
  assert.equal(e.verdict, 'MISS');
  const history = [
    { youtube_shorts: { start_rate: 70, avg_view_pct: 72 }, tiktok: { reach: 9000 } },
    { youtube_shorts: { start_rate: 72, avg_view_pct: 70 }, tiktok: { reach: 11000 } },
  ];
  const d = diagnoseMiss(e, actual, history);
  assert.deepEqual(d.categories.sort(), ['DISTRIBUTION', 'PACKAGING']);
  assert.equal(d.insufficient, false);
  const none = diagnoseMiss(e, actual, []);
  assert.equal(none.insufficient, true);
});

test('기준 없는 플랫폼을 약하다고 예측했으면 채점하지 않음', () => {
  const locked = lockedWith({ youtube_shorts: 1000, tiktok: 1000 }, { youtube_shorts: 'above', tiktok: 'at' });
  const e = evaluateCheckpoint(locked, { youtube_shorts: { views: 1500 }, tiktok: { views: 1000 }, threads: { views: 5 } }, '24h');
  assert.equal(e.calls.basis, 'ratio_to_baseline');
  assert.equal(e.calls.weakest.predicted, 'threads');
  assert.equal(e.calls.weakest.correct, null);
  assert.equal(e.verdict, 'HIT');
});

test('기준이 없으면 강·약 예측만으로 판정', () => {
  const locked = { qualitative: samplePackage().forecast, ranges: {} };
  const e = evaluateCheckpoint(locked, { youtube_shorts: { views: 900 }, threads: { views: 10 } }, '24h');
  assert.equal(e.calls.basis, 'absolute_views');
  assert.equal(e.verdict, 'HIT');
});

test('출력 검사와 규칙 맞추기', () => {
  const out = samplePackage();
  assert.deepEqual(validate(PACKAGE_SCHEMA, out), []);
  const fixes = enforcePackageRules(out);
  assert.equal(out.naver_clip.hashtags.length, 5);
  assert.ok(out.naver_clip.hashtags.every((h) => h.startsWith('#')));
  assert.deepEqual(out.tiktok.hashtags, ['#숏드라마', '#결혼식파혼']);
  assert.equal(out.forecast.platform_outlook.length, 6);
  assert.ok(fixes.some((f) => f.includes('해시태그')));

  const bad = samplePackage({ threads: { format: 'ad', topic: '', post: '' } });
  assert.ok(validate(PACKAGE_SCHEMA, bad).some((e) => e.includes('허용 값')));
});

test('복사한 캡션을 잡아냄', () => {
  const out = samplePackage();
  out.facebook_reels.caption = out.instagram_reels.caption;
  assert.ok(enforcePackageRules(out).some((f) => f.includes('똑같습니다')));
});

test('다음 변경 변수는 최대 2개', () => {
  const review = {
    summary: '',
    causes: [],
    keep: [],
    next_changes: [1, 2, 3].map((i) => ({ variable: `v${i}`, change: '', reason: '', platforms: [] })),
  };
  assert.deepEqual(validate(REVIEW_SCHEMA, review), []);
  enforceReviewRules(review);
  assert.equal(review.next_changes.length, 2);
});

test('학습기록과 제작 프롬프트 블록', () => {
  const locked = lockedWith({ youtube_shorts: 1000, tiktok: 1000 }, { youtube_shorts: 'above', tiktok: 'at' });
  const e24 = evaluateCheckpoint(locked, { youtube_shorts: { views: 1500 }, tiktok: { views: 1000 } }, '24h');
  const rec = buildLearningRecord({
    series: { slug: 's', title: '차기작' },
    episode: { ep_no: 1, title: '첫 화' },
    pkg: { output: samplePackage(), prompt_version: 'v', model: 'm' },
    locked,
    evaluations: [e24],
    review: { causes: [], keep: ['사건형 제목'], next_changes: [{ variable: '게시 시각', change: '21시→18시', reason: '시험', platforms: ['tiktok'] }] },
  });
  assert.equal(rec.final_verdict, 'HIT');
  assert.equal(rec.final_checkpoint, '24h');
  const block = renderProductionBlock({ title: '차기작' }, [rec]);
  assert.match(block, /HIT 1/);
  assert.match(block, /사건형 제목/);
  assert.match(block, /제안 · 1화 평가/);
  assert.match(renderProductionBlock({ title: 'x' }, []), /비어 있는 것이 맞습니다/);
});
