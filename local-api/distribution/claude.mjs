// Claude API 부르기.
// local-api 는 외부 의존성 없이 Node 표준 라이브러리만 쓰는 것이 원칙이라
// SDK 대신 fetch 로 Messages API 를 직접 부릅니다.
// 키가 없으면 이 파일은 쓰이지 않고, 콘솔이 "지시문 복사 → 결과 붙여넣기" 방식으로 돌아갑니다.

const API = 'https://api.anthropic.com/v1/messages';

export const MODEL = process.env.DIST_MODEL ?? 'claude-opus-5-5';
export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * 구조화 출력(JSON 스키마)으로 한 번 부릅니다. 길어질 수 있어 스트리밍으로 받습니다.
 * 거절되면 서버 쪽 대체 모델(fallbacks: "default")이 이어받습니다.
 */
export async function structuredCall({ system, user, schema, effort = 'high', maxTokens = 64000 }) {
  if (!hasKey()) throw new Error('ANTHROPIC_API_KEY 가 없습니다');

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      fallbacks: 'default',
      // 지시문은 바뀌지 않으므로 캐시해 둡니다. 바뀌는 회차 내용은 messages 쪽에 있습니다.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { effort, format: { type: 'json_schema', schema } },
    }),
    signal: AbortSignal.timeout(15 * 60 * 1000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status} ${body.slice(0, 400)}`);
  }

  let text = '';
  let model = MODEL;
  let stopReason = null;
  let stopDetails = null;
  const usage = {};

  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data) continue;
      const ev = JSON.parse(data);
      switch (ev.type) {
        case 'message_start':
          model = ev.message?.model ?? model;
          Object.assign(usage, ev.message?.usage ?? {});
          break;
        case 'content_block_start':
          // 앞 모델이 거절하고 대체 모델로 넘어가면, 앞서 받은 글은 버립니다.
          if (ev.content_block?.type === 'fallback') {
            text = '';
            model = ev.content_block.to?.model ?? model;
          }
          break;
        case 'content_block_delta':
          if (ev.delta?.type === 'text_delta') text += ev.delta.text;
          break;
        case 'message_delta':
          stopReason = ev.delta?.stop_reason ?? stopReason;
          stopDetails = ev.delta?.stop_details ?? stopDetails;
          Object.assign(usage, ev.usage ?? {});
          break;
        case 'error':
          throw new Error(`Claude API 스트림 오류: ${ev.error?.message ?? data.slice(0, 300)}`);
      }
    }
  }

  if (stopReason === 'refusal') {
    throw new Error(`모델이 거절했습니다 (${stopDetails?.category ?? '분류 없음'}) ${stopDetails?.explanation ?? ''}`);
  }
  if (stopReason === 'max_tokens') {
    throw new Error('출력이 길이 한도에서 잘렸습니다. 대본을 줄이거나 다시 시도해 주십시오.');
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`모델 출력이 JSON 이 아닙니다: ${text.slice(0, 200)}`);
  }
  return { json, model, usage, stopReason };
}
