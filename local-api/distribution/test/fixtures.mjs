// 시험용 모델 출력 — PACKAGE_SCHEMA 를 만족하는 최소 예시.
export function samplePackage(overrides = {}) {
  const base = {
    analysis: {
      first3s_event: '결혼식장 문이 열리고 신랑이 다른 여자의 손을 잡고 들어온다',
      strongest_emotion: '배신감',
      core_mystery: '신부의 언니는 왜 웃고 있었나',
      debate_trigger: '신부가 반지를 던진 것이 옳았나',
      unresolved_hook: '하객석의 검은 장갑',
      spoiler_guard: ['언니가 계약서를 썼다는 사실'],
      search_topics: ['결혼식 파혼', '숏드라마'],
      core_conflict: '신부 대 언니',
      dropoff_risks: [{ segment: '0:22~0:30', reason: '설명 대사가 길다' }],
      source_note: '영상 메모와 대본 기반',
    },
    youtube_shorts: {
      title_candidates: ['신랑이 다른 여자 손을 잡고 입장했다', '결혼식장에서 반지를 던진 이유', '언니는 왜 웃었을까'],
      final_title: '신랑이 다른 여자 손을 잡고 입장했다',
      description: '결혼식 당일, 모든 게 뒤집혔다.',
      pinned_comment: '언니의 웃음, 눈치채셨나요?',
      next_episode_cta: '검은 장갑의 주인은 다음 화에서',
    },
    tiktok: {
      caption: '결혼식 파혼 숏드라마 3화 — 신랑 옆의 그 여자',
      hashtags: ['숏드라마', '#결혼식파혼', '숏드라마'],
      deduction_question: '검은 장갑은 누구 것일까?',
      either_or_question: '반지 던진다 vs 참는다',
    },
    instagram_reels: {
      caption: '가장 행복해야 할 날, 가장 믿었던 사람이.',
      question_cta: '당신이라면?',
      story_share_text: '이 장면 친구한테 보내기',
      trial_reel: { recommend: true, reason: '첫 장면이 강함' },
    },
    facebook_reels: {
      caption: '10년을 함께한 신랑이 결혼식 당일 다른 여자와 입장합니다. 신부의 언니는 그 모습을 보고 웃습니다.',
      choice_question: '가족이라도 용서할 수 있나요?',
      comment_prompt: '댓글로 알려 주세요',
    },
    threads: { format: 'moral_judgment', topic: '반지를 던진 신부', post: '결혼식장에서 반지를 던지는 건 과한가?' },
    naver_clip: {
      body: '결혼식 당일 벌어진 반전.',
      category: '드라마',
      info_tag_candidates: ['드라마'],
      hashtags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      ai_disclosure: { setting: 'on', note: '업로드 화면에서 확인' },
    },
    forecast: {
      strongest_platform: 'youtube_shorts',
      strongest_reason: '사건형 제목',
      weakest_platform: 'threads',
      weakest_reason: '텍스트 반응 적음',
      first3s_success: { level: 'high', reason: '입장 장면' },
      completion_risk_segments: [{ segment: '0:22~0:30', reason: '설명 대사' }],
      top_comment_driver: '반지 던지기',
      next_episode_driver: '검은 장갑',
      platform_outlook: [
        { platform: 'youtube_shorts', outlook: 'above', reason: '' },
        { platform: 'tiktok', outlook: 'at', reason: '' },
        { platform: 'threads', outlook: 'below', reason: '' },
      ],
    },
  };
  return { ...base, ...overrides };
}
