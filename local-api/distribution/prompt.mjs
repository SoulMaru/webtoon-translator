// 배포 오케스트레이터의 지시문과 출력 모양.
// 지시문을 고치면 PROMPT_VERSION 을 올리십시오. 학습기록에 어떤 판으로 만들었는지 남습니다.

import {
  PLATFORM_IDS,
  MISS_CAUSES,
  NAVER_MAX_HASHTAGS,
  NAVER_MAX_BODY,
  MAX_NEXT_CHANGES,
  OUTLOOK_MULTIPLIERS,
} from './constants.mjs';

export const PROMPT_VERSION = 'dist-orchestrator/2026-10-02.1';

const OUTLOOKS = Object.keys(OUTLOOK_MULTIPLIERS);
const THREADS_FORMATS = ['ab_choice', 'character_judgment', 'culprit_guess', 'moral_judgment', 'hidden_clue'];

export const SYSTEM_PROMPT = `너는 연재형 AI 1분 숏드라마의 총괄 콘텐츠 오케스트레이터이자 성장 마케터다.
한 회차의 대본과 영상 메모를 분석해 YouTube Shorts, TikTok, Instagram Reels, Facebook Reels, Threads, Naver Clip 에 각각 다른 배포 패키지를 만든다.

# 절대 규칙
- 같은 문구를 여러 플랫폼에 복사하지 않는다. 같은 사건을 다뤄도 각 플랫폼의 추천·검색·커뮤니티 특성에 맞춰 말투와 각도를 바꾼다.
- 제목·캡션·게시물 어디에서도 스포일러 금지 목록에 있는 정보를 드러내지 않는다.
- 너는 영상을 직접 보지 못한다. 대본과 영상 메모에 없는 화면 정보를 지어내지 않는다. 메모가 없어 대본에서 추정한 항목은 analysis.source_note 에 그렇게 밝힌다.
- 유행어를 억지로 쓰지 않는다. 해시태그 수를 늘리는 것을 노출 전략으로 쓰지 않는다.
- 숫자 예측(조회수 등)은 쓰지 않는다. 숫자는 시스템이 최근 게시물 중앙값으로 계산한다. 너는 플랫폼별로 "자기 기준 대비" 전망 단계만 고른다.
- 플랫폼 정책(예: AI 표시 의무, 카테고리 목록)은 확실하지 않으면 단정하지 말고 "업로드 화면에서 확인"이라고 적는다.
- 학습기록이 주어지면 반드시 반영한다. "다음에 바꿀 변수"는 이번 패키지에서 실제로 바꾸고, "유지"는 지킨다.

# 1. 분석 (analysis)
- first3s_event: 첫 3초의 핵심 사건
- strongest_emotion: 가장 강한 감정
- core_mystery: 가장 궁금한 미스터리
- debate_trigger: 댓글 논쟁거리가 될 사건
- unresolved_hook: 다음 회차를 보게 만드는 미회수 정보
- spoiler_guard: 스포일러하면 안 되는 정보 목록
- search_topics: 검색 가능한 핵심 주제 (사람들이 실제로 검색할 법한 말)
- core_conflict: 캐릭터 간 핵심 갈등
- dropoff_risks: 영상 중 이탈 가능성이 높은 구간 (구간과 이유)

# 2. 플랫폼별 패키지
YOUTUBE SHORTS — 목표: 시청 시작률, 시청 지속, 다음 회차 이동.
 사건 중심 제목 3개, 최종 추천 제목 1개, 짧은 설명, 고정댓글, 다음회차 CTA.
 에피소드 번호보다 사건을 먼저 쓴다. 제목으로 결말을 공개하지 않는다. 해시태그는 과하게 쓰지 않는다.

TIKTOK — 목표: For You 발견, 시청시간, 검색 발견, 댓글.
 검색어가 자연스럽게 들어간 캡션, 관련 핵심 해시태그, 시청자 추리 질문, 댓글을 부르는 양자택일 질문.
 영상 내용과 검색어의 관련성을 우선한다.

INSTAGRAM REELS — 목표: 비팔로워 발견, 공유, 댓글, 팔로우.
 감정 중심 캡션, 짧은 질문형 CTA, Story 공유 문구, Trial Reel 로 시험할 가치가 있는지 판단(이유 포함).
 원본 콘텐츠의 개성을 강조한다.

FACEBOOK REELS — 목표: 스토리 이해, 감정 몰입, 댓글.
 상황을 조금 더 설명하는 캡션, 도덕적 또는 관계적 선택 질문, 댓글 유도문.
 Instagram 캡션을 그대로 옮기지 않는다.

THREADS — 목표: 영상 조회보다 대화와 커뮤니티.
 동영상 광고문을 쓰지 않는다. 이번 회차에서 사람들이 다투거나 토론할 주제 하나를 골라 독립적인 텍스트 게시물을 쓴다.
 형식은 A/B 선택(ab_choice), 인물 판단(character_judgment), 범인 추측(culprit_guess), 도덕적 판단(moral_judgment), 숨은 단서(hidden_clue) 중 하나.

NAVER CLIP — 목표: 국내 발견, 콘텐츠 관련성.
 ${NAVER_MAX_BODY}자 이내 본문, 가장 알맞은 카테고리, 정보태그 후보, 관련 해시태그 최대 ${NAVER_MAX_HASHTAGS}개, AI 활용 설정 필요 여부.
 이 작품은 AI 로 제작되었다. AI 활용 표시는 켜는 것을 기본으로 하고, 실제 설정 항목 이름은 업로드 화면에서 확인하라고 적는다.

# 3. 게시 전 예측 (forecast)
- strongest_platform / weakest_platform 과 이유
- first3s_success: 첫 3초 성공 가능성 (high/medium/low) 과 이유
- completion_risk_segments: 완주율 위험 구간
- top_comment_driver: 댓글을 가장 많이 부를 요소
- next_episode_driver: 다음 화 이동을 부를 요소
- platform_outlook: 여섯 플랫폼 모두에 대해 자기 최근 게시물 대비 전망 단계 하나 (${OUTLOOKS.join(' / ')}) 와 이유.
  기준 데이터가 없는 플랫폼도 단계는 고른다. 숫자는 쓰지 않는다.
이 예측은 잠긴 뒤 수정되지 않는다. 듣기 좋은 쪽이 아니라 맞을 쪽으로 고른다.`;

const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const obj = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const platformEnum = { type: 'string', enum: PLATFORM_IDS };
const segment = obj({ segment: str, reason: str });

export const PACKAGE_SCHEMA = obj({
  analysis: obj({
    first3s_event: str,
    strongest_emotion: str,
    core_mystery: str,
    debate_trigger: str,
    unresolved_hook: str,
    spoiler_guard: strArr,
    search_topics: strArr,
    core_conflict: str,
    dropoff_risks: { type: 'array', items: segment },
    source_note: str,
  }),
  youtube_shorts: obj({
    title_candidates: strArr,
    final_title: str,
    description: str,
    pinned_comment: str,
    next_episode_cta: str,
  }),
  tiktok: obj({
    caption: str,
    hashtags: strArr,
    deduction_question: str,
    either_or_question: str,
  }),
  instagram_reels: obj({
    caption: str,
    question_cta: str,
    story_share_text: str,
    trial_reel: obj({ recommend: { type: 'boolean' }, reason: str }),
  }),
  facebook_reels: obj({
    caption: str,
    choice_question: str,
    comment_prompt: str,
  }),
  threads: obj({
    format: { type: 'string', enum: THREADS_FORMATS },
    topic: str,
    post: str,
  }),
  naver_clip: obj({
    body: str,
    category: str,
    info_tag_candidates: strArr,
    hashtags: strArr,
    ai_disclosure: obj({ setting: { type: 'string', enum: ['on', 'check'] }, note: str }),
  }),
  forecast: obj({
    strongest_platform: platformEnum,
    strongest_reason: str,
    weakest_platform: platformEnum,
    weakest_reason: str,
    first3s_success: obj({ level: { type: 'string', enum: ['high', 'medium', 'low'] }, reason: str }),
    completion_risk_segments: { type: 'array', items: segment },
    top_comment_driver: str,
    next_episode_driver: str,
    platform_outlook: {
      type: 'array',
      items: obj({ platform: platformEnum, outlook: { type: 'string', enum: OUTLOOKS }, reason: str }),
    },
  }),
});

/** 패키지 요청의 사용자 메시지. 바뀌는 내용만 여기에 둡니다 (지시문은 캐시되도록 고정). */
export function buildPackageMessage({ series, episode, baselineSummary, learningBlock }) {
  const parts = [];
  parts.push(`# 작품\n제목: ${series.title}\n${series.logline ? `한 줄 소개: ${series.logline}\n` : ''}`);
  if (series.carry_in?.trim()) {
    parts.push(`# 이전 작품에서 넘어온 교훈 (사용자가 직접 적은 것)\n${series.carry_in.trim()}`);
  }
  if (learningBlock?.trim()) {
    parts.push(`# 이 작품의 지난 회차 학습기록 (시스템 집계)\n${learningBlock.trim()}`);
  }
  parts.push(
    `# 이번 회차\n${episode.ep_no}화${episode.title ? ` · ${episode.title}` : ''}` +
      (episode.duration_sec ? ` · 길이 ${episode.duration_sec}초` : '')
  );
  parts.push(
    `## 영상 메모 (화면·컷·자막·소리)\n${episode.video_notes?.trim() || '(없음 — 대본만으로 분석하고 source_note 에 밝힐 것)'}`
  );
  parts.push(`## 대본\n${episode.script?.trim() || '(없음)'}`);

  const have = Object.entries(baselineSummary ?? {})
    .filter(([, v]) => v.posts > 0)
    .map(([p, v]) => `${p} ${v.posts}개`);
  parts.push(
    `# 기준 데이터\n${have.length ? `최근 게시물 실적이 있는 플랫폼: ${have.join(', ')}` : '최근 게시물 실적이 아직 없습니다.'}\n숫자는 시스템이 계산하므로 전망 단계만 고르십시오.`
  );
  return parts.join('\n\n');
}

// ── 게시 후 리뷰 ───────────────────────────────────

export const REVIEW_SYSTEM_PROMPT = `너는 숏드라마 배포 성과를 리뷰하는 분석가다.
잠긴 예측과 실제 실적, 시스템이 판정한 HIT / PARTIAL HIT / MISS, 지표 근거 후보가 주어진다.

규칙:
- 판정을 바꾸지 않는다. 판정은 시스템 규칙으로 이미 정해졌다.
- 변명하지 않는다. "알고리즘 탓", "운" 같은 말로 넘기지 않는다.
- MISS 원인은 CONTENT(이야기·연출·완주), PACKAGING(제목·캡션·첫 화면·해시태그·질문), DISTRIBUTION(게시 시각·노출·플랫폼 배포) 세 범주로만 나눈다.
  근거 지표가 있는 원인과 추정인 원인을 evidence 에서 구분해 적는다. 근거가 없으면 없다고 적는다.
- 판정이 MISS 가 아니면 causes 는 비워도 된다.
- 다음 화에서 바꿀 변수는 최대 ${MAX_NEXT_CHANGES}개. 하나만 바꿔야 원인을 알 수 있으면 하나만 제안한다.
  변수는 측정 가능한 하나의 손잡이여야 한다 (예: "유튜브 제목 첫 단어를 인물명→사건명", "게시 시각 21시→18시").
- keep 에는 이번에 효과가 확인되어 유지할 것을 적는다. 확인되지 않았으면 비운다.`;

export const REVIEW_SCHEMA = obj({
  summary: str,
  causes: {
    type: 'array',
    items: obj({
      category: { type: 'string', enum: MISS_CAUSES },
      evidence: str,
      backed_by_metric: { type: 'boolean' },
    }),
  },
  keep: strArr,
  next_changes: {
    type: 'array',
    items: obj({
      variable: str,
      change: str,
      reason: str,
      platforms: { type: 'array', items: platformEnum },
    }),
  },
});

export function buildReviewMessage({ series, episode, pkg, locked, evaluation, diagnosis, actuals }) {
  return [
    `# 작품 · 회차\n${series.title} ${episode.ep_no}화${episode.title ? ` · ${episode.title}` : ''}`,
    `# 사용한 패키지 (요약)\n${JSON.stringify(
      {
        first3s_event: pkg.output.analysis.first3s_event,
        youtube_title: pkg.output.youtube_shorts.final_title,
        tiktok_caption: pkg.output.tiktok.caption,
        threads: pkg.output.threads,
      },
      null,
      1
    )}`,
    `# 잠긴 예측\n${JSON.stringify(locked.qualitative, null, 1)}\n\n## 숫자 범위\n${JSON.stringify(locked.ranges, null, 1)}`,
    `# ${evaluation.checkpoint} 실적\n${JSON.stringify(actuals, null, 1)}`,
    `# 시스템 판정\n${JSON.stringify(evaluation, null, 1)}`,
    `# 지표 근거 후보 (이전 회차 ${diagnosis.historyEpisodes}개와 비교)\n${JSON.stringify(diagnosis, null, 1)}`,
  ].join('\n\n');
}

// ── 출력 검사 ──────────────────────────────────────

/** 위 스키마 정도를 검사하는 작은 검사기. 외부 의존성을 두지 않기 위해 직접 씁니다. */
export function validate(schema, value, path = '$') {
  const errors = [];
  const t = schema.type;
  if (t === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path}: 객체가 아닙니다`];
    for (const k of schema.required ?? []) if (!(k in value)) errors.push(`${path}.${k}: 빠졌습니다`);
    for (const [k, v] of Object.entries(value)) {
      if (!schema.properties[k]) {
        if (schema.additionalProperties === false) errors.push(`${path}.${k}: 모르는 칸입니다`);
        continue;
      }
      errors.push(...validate(schema.properties[k], v, `${path}.${k}`));
    }
  } else if (t === 'array') {
    if (!Array.isArray(value)) return [`${path}: 배열이 아닙니다`];
    value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}[${i}]`)));
  } else if (t === 'string') {
    if (typeof value !== 'string') return [`${path}: 글자가 아닙니다`];
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: "${value}" 는 허용 값이 아닙니다`);
  } else if (t === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${path}: 참/거짓이 아닙니다`);
  }
  return errors;
}

/**
 * 스키마로 막을 수 없는 개수·길이 규칙을 맞추고, 맞춘 내역을 돌려줍니다.
 * (구조화 출력은 maxItems·maxLength 를 받지 않으므로 여기서 지킵니다.)
 */
export function enforcePackageRules(output) {
  const fixes = [];
  const naver = output.naver_clip;
  const tagify = (t) => (t.startsWith('#') ? t : `#${t}`).replace(/\s+/g, '');

  naver.hashtags = [...new Set(naver.hashtags.map(tagify))];
  if (naver.hashtags.length > NAVER_MAX_HASHTAGS) {
    fixes.push(`네이버 클립 해시태그 ${naver.hashtags.length}개 → ${NAVER_MAX_HASHTAGS}개로 줄임`);
    naver.hashtags = naver.hashtags.slice(0, NAVER_MAX_HASHTAGS);
  }
  const bodyLen = [...naver.body].length;
  if (bodyLen > NAVER_MAX_BODY) {
    fixes.push(`네이버 클립 본문 ${bodyLen}자 — ${NAVER_MAX_BODY}자 넘음 (자르지 않았음, 직접 줄여 주십시오)`);
  }
  output.tiktok.hashtags = [...new Set(output.tiktok.hashtags.map(tagify))];

  const yt = output.youtube_shorts;
  if (yt.title_candidates.length !== 3) {
    fixes.push(`유튜브 제목 후보가 ${yt.title_candidates.length}개입니다 (3개 요청)`);
  }

  const seen = new Set(output.forecast.platform_outlook.map((o) => o.platform));
  for (const p of PLATFORM_IDS) {
    if (!seen.has(p)) {
      output.forecast.platform_outlook.push({ platform: p, outlook: 'at', reason: '모델이 빠뜨려 "비슷함"으로 채움' });
      fixes.push(`${p} 전망이 빠져 "비슷함"으로 채움`);
    }
  }

  // 같은 문구 복사 금지 — 캡션끼리 완전히 같으면 알립니다.
  const captions = [
    ['tiktok', output.tiktok.caption],
    ['instagram_reels', output.instagram_reels.caption],
    ['facebook_reels', output.facebook_reels.caption],
    ['naver_clip', naver.body],
    ['youtube_shorts', yt.description],
  ];
  for (let i = 0; i < captions.length; i++) {
    for (let j = i + 1; j < captions.length; j++) {
      if (captions[i][1].trim() && captions[i][1].trim() === captions[j][1].trim()) {
        fixes.push(`${captions[i][0]} 와 ${captions[j][0]} 문구가 똑같습니다 — 다시 만드십시오`);
      }
    }
  }
  return fixes;
}

export function enforceReviewRules(review) {
  const fixes = [];
  if (review.next_changes.length > MAX_NEXT_CHANGES) {
    fixes.push(`다음 변경 변수 ${review.next_changes.length}개 → ${MAX_NEXT_CHANGES}개로 줄임`);
    review.next_changes = review.next_changes.slice(0, MAX_NEXT_CHANGES);
  }
  return fixes;
}
