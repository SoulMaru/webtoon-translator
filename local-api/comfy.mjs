// ComfyUI 와 이야기하는 부분.
// ComfyUI 는 127.0.0.1:8188 에서만 듣습니다. 바깥으로 열리지 않습니다.

const COMFY = process.env.ATELIER_COMFY ?? 'http://127.0.0.1:8188';

async function call(path, init = {}, timeoutMs = 15000) {
  const res = await fetch(`${COMFY}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ComfyUI ${res.status} ${path} ${body.slice(0, 300)}`);
  }
  return res;
}

/** ComfyUI 가 켜져 있는지, 어떤 그래픽카드를 쓰는지. */
export async function systemStats() {
  try {
    const d = await (await call('/system_stats', {}, 4000)).json();
    const dev = d.devices?.[0] ?? {};
    return {
      up: true,
      version: d.system?.comfyui_version ?? null,
      device: dev.name ?? null,
      vramTotal: dev.vram_total ?? 0,
      vramFree: dev.vram_free ?? 0,
    };
  } catch {
    return { up: false, version: null, device: null, vramTotal: 0, vramFree: 0 };
  }
}

/** 고를 수 있는 모델·샘플러 목록을 ComfyUI 에게 직접 물어봅니다. */
export async function options() {
  const [ckpt, ks] = await Promise.all([
    (await call('/object_info/CheckpointLoaderSimple')).json(),
    (await call('/object_info/KSampler')).json(),
  ]);
  const req = ks.KSampler.input.required;
  return {
    models: ckpt.CheckpointLoaderSimple.input.required.ckpt_name[0] ?? [],
    samplers: req.sampler_name[0] ?? [],
    schedulers: req.scheduler[0] ?? [],
  };
}

/** SDXL 은 1메가픽셀 언저리, SD1.5 는 512 언저리가 제 크기입니다. */
export const RATIOS = {
  '1:1': { xl: [1024, 1024], sd: [512, 512] },
  '2:3': { xl: [832, 1216], sd: [512, 768] },
  '3:2': { xl: [1216, 832], sd: [768, 512] },
  '9:16': { xl: [768, 1344], sd: [512, 896] },
  '16:9': { xl: [1344, 768], sd: [896, 512] },
};

const isSdxl = (model) => !/v1-5|sd15|sd-1/i.test(model);

export function sizeFor(model, ratio) {
  const entry = RATIOS[ratio] ?? RATIOS['1:1'];
  return isSdxl(model) ? entry.xl : entry.sd;
}

/**
 * ComfyUI 가 받는 형태(API 형식)의 작업 그래프를 만듭니다.
 * 체크포인트 → 글 인코딩 → 잠재이미지 → 표본추출 → VAE 디코드 → 저장.
 */
export function buildWorkflow({
  model,
  positive,
  negative = '',
  ratio = '1:1',
  steps = 24,
  cfg = 7,
  seed,
  batch = 1,
  sampler = 'euler',
  scheduler = 'normal',
}) {
  const [width, height] = sizeFor(model, ratio);
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: model },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: positive, clip: ['1', 1] },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: negative, clip: ['1', 1] },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: batch },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'atelier/studio', images: ['6', 0] },
    },
  };
}

/** 작업을 줄에 세웁니다. 돌려주는 prompt_id 로 나중에 상태를 봅니다. */
export async function enqueue(workflow, clientId) {
  const res = await call('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  const d = await res.json();
  if (!d.prompt_id) throw new Error('ComfyUI 가 prompt_id 를 주지 않았습니다');
  return d.prompt_id;
}

/** 지금 무엇이 돌고 무엇이 기다리는지. */
export async function queueState() {
  const d = await (await call('/queue', {}, 5000)).json();
  return {
    running: (d.queue_running ?? []).map((x) => x[1]),
    pending: (d.queue_pending ?? []).map((x) => x[1]),
  };
}

/** 끝난 작업의 결과. 아직이면 null. */
export async function result(promptId) {
  const d = await (await call(`/history/${promptId}`, {}, 8000)).json();
  const entry = d[promptId];
  if (!entry) return null;

  const status = entry.status ?? {};
  if (status.status_str === 'error') {
    const msg = (status.messages ?? [])
      .filter((m) => m[0] === 'execution_error')
      .map((m) => m[1]?.exception_message ?? '')
      .join(' / ');
    return { done: true, failed: true, error: msg || '까닭을 알 수 없는 실패', images: [] };
  }
  if (!status.completed) return null;

  const images = [];
  for (const out of Object.values(entry.outputs ?? {})) {
    for (const img of out.images ?? []) images.push(img);
  }
  return { done: true, failed: false, error: null, images };
}

/** ComfyUI 가 만든 이미지를 그대로 흘려보냅니다. */
export async function view({ filename, subfolder = '', type = 'output' }) {
  const q = new URLSearchParams({ filename, subfolder, type });
  return call(`/view?${q}`, {}, 30000);
}

/** 작업을 중간에 멈춥니다. */
export async function interrupt() {
  await call('/interrupt', { method: 'POST' }, 5000);
}
