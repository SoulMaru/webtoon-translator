import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { samplePackage } from './fixtures.mjs';

let store;
let openDb;

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dist-test-'));
  process.env.ATELIER_DB = join(dir, 'atelier.db');
  process.env.ATELIER_MEDIA = join(dir, 'media');
  store = await import('../store.mjs');
  ({ openDb } = await import('../../db.mjs'));
});

test('작품 → 회차 → 패키지 → 잠금 → 실적 → 판정 → 리뷰 → 학습기록', () => {
  const s = store.createSeries({ title: '차기작 테스트', logline: '한 줄', carryIn: '50화 작품 교훈' });
  assert.equal(s.slug, '차기작-테스트');

  // 번호: 중복 막기, 결번 알리기
  store.saveEpisode(s.slug, { epNo: 1, title: '1화', script: '대본', create: true });
  assert.throws(() => store.saveEpisode(s.slug, { epNo: 1, create: true }), /중복 번호/);
  const r3 = store.saveEpisode(s.slug, { epNo: 3, title: '3화', create: true });
  assert.deepEqual(r3.numbering.gaps, [2]);
  assert.match(r3.warnings[0], /2화/);

  // 기준 데이터
  const yt = Array.from({ length: 10 }, () => '- 1000 - - 20').join('\n');
  assert.equal(store.saveBaseline('youtube_shorts', yt).posts, 10);

  // 실적은 잠금 전에는 못 받음
  assert.throws(() => store.saveActuals(s.slug, 1, '24h', { youtube_shorts: { views: 1 } }), /잠그지 않은/);
  assert.throws(() => store.lockForecast(s.slug, 1), /패키지를 먼저/);

  const out = samplePackage();
  store.savePackage(s.slug, 1, { output: out, fixes: [], model: 'm', promptVersion: 'v', source: 'paste' });
  const locked = store.lockForecast(s.slug, 1);
  assert.equal(locked.ranges.youtube_shorts.metrics.views_24h.low, 1100);
  assert.equal(locked.ranges.youtube_shorts.metrics.views_24h.high, 1800);

  // 잠근 뒤에는 패키지·대본·예측 모두 못 바꿈 — DB 트리거까지 확인
  assert.throws(() => store.savePackage(s.slug, 1, { output: out, promptVersion: 'v', source: 'paste' }), /다시 만들 수 없습니다/);
  assert.throws(() => store.saveEpisode(s.slug, { epNo: 1, script: 'x' }), /고칠 수 없습니다/);
  assert.throws(() => store.lockForecast(s.slug, 1), /다시 만들 수 없습니다/);
  assert.throws(() => openDb().prepare("UPDATE dist_forecasts SET ranges = '{}'").run(), /잠긴 예측은 수정할 수 없습니다/);
  assert.throws(() => openDb().prepare('DELETE FROM dist_forecasts').run(), /잠긴 예측은 지울 수 없습니다/);

  // 기준이 바뀌어도 잠근 예측은 그대로
  store.saveBaseline('youtube_shorts', Array.from({ length: 10 }, () => '- 9999').join('\n'));
  assert.equal(store.getEpisodeDetail(s.slug, 1).forecast.ranges.youtube_shorts.metrics.views_24h.low, 1100);

  const { evaluation } = store.saveActuals(s.slug, 1, '24h', {
    youtube_shorts: { views: '1,500', comments: 25 },
    threads: { views: 100 },
  });
  assert.equal(evaluation.platforms.youtube_shorts.views.verdict, 'HIT');
  assert.equal(evaluation.verdict, 'HIT');

  const record = store.saveReview(s.slug, 1, '24h', {
    summary: '적중',
    causes: [],
    keep: ['사건형 제목'],
    next_changes: [{ variable: '게시 시각', change: '21시→18시', reason: '시험', platforms: ['tiktok'] }],
  }, 'manual');
  assert.equal(record.final_verdict, 'HIT');
  assert.equal(record.next_changes.length, 1);

  const { block } = store.seriesLearnings(s.slug);
  assert.match(block, /1화/);
  // 3화 패키지를 만들 때는 1화 학습이 들어감
  assert.equal(store.seriesLearnings(s.slug, { beforeEp: 3 }).records.length, 1);
  assert.equal(store.seriesLearnings(s.slug, { beforeEp: 1 }).records.length, 0);

  const list = store.listEpisodes(s.slug);
  assert.equal(list.episodes[0].final_verdict, 'HIT');
  assert.deepEqual(list.episodes[0].checkpoints, ['24h']);
});
