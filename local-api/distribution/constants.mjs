// 배포 오케스트레이터에서 함께 쓰는 이름표들.
// 숫자 규칙은 여기 한 곳에만 둡니다. 바꾸면 docs/08 의 표도 같이 고치십시오.

export const PLATFORMS = [
  { id: 'youtube_shorts', name: 'YouTube Shorts' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram_reels', name: 'Instagram Reels' },
  { id: 'facebook_reels', name: 'Facebook Reels' },
  { id: 'threads', name: 'Threads' },
  { id: 'naver_clip', name: 'Naver Clip' },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);
export const platformName = (id) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/** 게시 후 실적을 받는 시점. 순서가 곧 시간 순서입니다. */
export const CHECKPOINTS = ['2h', '24h', '72h', '7d'];

/** 숫자 예측을 내는 지표. 기준 데이터의 열 이름은 `${metric}_${checkpoint}` 입니다. */
export const METRICS = ['views', 'comments'];

/**
 * 모델이 고른 "기준 대비 전망"을 기준 중앙값에 곱할 범위로 바꿉니다.
 * 모델은 숫자를 직접 쓰지 않습니다. 숫자는 언제나 실제 중앙값 × 이 배수입니다.
 */
export const OUTLOOK_MULTIPLIERS = {
  well_below: [0.4, 0.7],
  below: [0.6, 0.95],
  at: [0.8, 1.25],
  above: [1.1, 1.8],
  well_above: [1.5, 3.0],
};

export const OUTLOOK_LABELS = {
  well_below: '크게 밑돎',
  below: '밑돎',
  at: '비슷함',
  above: '웃돎',
  well_above: '크게 웃돎',
};

/** 최근 게시물 몇 개를 기준으로 삼는가. 이보다 적으면 "참고값"으로 표시합니다. */
export const BASELINE_SIZE = 10;

/** 범위 바깥이어도 가장자리에서 이 비율 안이면 PARTIAL HIT 입니다. */
export const PARTIAL_TOLERANCE = 0.25;

export const VERDICTS = ['HIT', 'PARTIAL HIT', 'MISS'];
export const MISS_CAUSES = ['CONTENT', 'PACKAGING', 'DISTRIBUTION'];

/** 다음 화에서 바꿀 변수는 최대 이만큼. */
export const MAX_NEXT_CHANGES = 2;

/** 네이버 클립 해시태그 상한. 늘리는 것을 노출 전략으로 쓰지 않습니다. */
export const NAVER_MAX_HASHTAGS = 5;
export const NAVER_MAX_BODY = 300;

/** 실적 입력에서 받는 선택 지표 — 실패 원인을 가를 때 근거로 씁니다. */
export const DIAGNOSTIC_METRICS = [
  { key: 'reach', label: '노출(도달) 수', cause: 'DISTRIBUTION' },
  { key: 'start_rate', label: '시청 시작률 %', cause: 'PACKAGING' },
  { key: 'avg_view_pct', label: '평균 시청 비율 %', cause: 'CONTENT' },
  { key: 'completion_pct', label: '완주율 %', cause: 'CONTENT' },
  { key: 'shares', label: '공유', cause: null },
  { key: 'follows', label: '팔로우 증가', cause: null },
  { key: 'next_ep_clicks', label: '다음 화 이동', cause: null },
];
