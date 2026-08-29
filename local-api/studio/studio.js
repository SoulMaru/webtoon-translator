// 만들기 콘솔의 움직임. 프레임워크 없이 씁니다.

const $ = (id) => document.getElementById(id);
const state = {
  ratio: '1:1',
  images: [],
  picked: 0,
  busy: false,
  lastRequest: null,
};

// ── 상태 표시 ──────────────────────────────────────

function setBoardState(text, kind = '') {
  const el = $('board-state');
  el.textContent = text;
  el.className = 'pane-state' + (kind ? ' ' + kind : '');
}

function showError(msg) {
  const el = $('err');
  if (!msg) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

// ── 처음 불러오기 ──────────────────────────────────

async function loadState() {
  try {
    const s = await (await fetch('/api/state')).json();

    const engine = $('engine');
    if (s.comfy.up) {
      engine.className = 'status up';
      $('engine-title').textContent = '로컬 엔진 연결됨';
      const gb = s.comfy.vramTotal
        ? ` · ${(s.comfy.vramTotal / 1073741824).toFixed(1)}GB`
        : '';
      $('engine-note').textContent = (s.comfy.device ?? 'ComfyUI').replace(/ :.*$/, '') + gb;
    } else {
      engine.className = 'status down';
      $('engine-title').textContent = '엔진이 꺼져 있습니다';
      $('engine-note').textContent = 'ComfyUI_실행.bat 을 눌러 주십시오';
      setBoardState('엔진 꺼짐', 'bad');
    }

    $('gallery-count').textContent = s.gallery.published;

    const q = s.queue.running + s.queue.pending;
    $('queue-note').textContent = q > 0 ? `줄 서 있는 작업 ${q}개` : '';

    // 모델
    const sel = $('model');
    sel.innerHTML = '';
    for (const m of s.options.models) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = prettyModel(m);
      sel.appendChild(o);
    }
    if (!s.options.models.length) {
      const o = document.createElement('option');
      o.textContent = '설치된 모델이 없습니다';
      sel.appendChild(o);
      sel.disabled = true;
    }

    // 비율
    const wrap = $('ratios');
    wrap.innerHTML = '';
    for (const r of s.options.ratios) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (r === state.ratio ? ' on' : '');
      b.textContent = r;
      b.onclick = () => {
        state.ratio = r;
        [...wrap.children].forEach((c) => c.classList.toggle('on', c === b));
        updateSizeHint();
      };
      wrap.appendChild(b);
    }

    $('go').disabled = !s.comfy.up || !s.options.models.length;
    updateSizeHint();
  } catch (e) {
    showError('상태를 읽지 못했습니다: ' + e.message);
  }
}

function prettyModel(name) {
  const base = name.replace(/\.(safetensors|ckpt)$/i, '');
  if (/realvis/i.test(base)) return '리얼비전 XL';
  if (/sd_xl_base/i.test(base)) return '기본 XL';
  if (/v1-5/i.test(base)) return '기본 1.5 (가볍고 빠름)';
  return base;
}

const SIZES = {
  '1:1': [1024, 1024],
  '2:3': [832, 1216],
  '3:2': [1216, 832],
  '9:16': [768, 1344],
  '16:9': [1344, 768],
};
const SIZES_15 = {
  '1:1': [512, 512],
  '2:3': [512, 768],
  '3:2': [768, 512],
  '9:16': [512, 896],
  '16:9': [896, 512],
};

function updateSizeHint() {
  const model = $('model').value ?? '';
  const table = /v1-5|sd15/i.test(model) ? SIZES_15 : SIZES;
  const [w, h] = table[state.ratio] ?? [0, 0];
  const n = Number($('batch').value);
  $('size-hint').textContent = `${w} × ${h}${n > 1 ? ` · ${n}장` : ''}`;
}

// ── 만들기 ─────────────────────────────────────────

async function generate(ev) {
  ev?.preventDefault();
  if (state.busy) return;

  const body = {
    prompt: $('prompt').value.trim(),
    negative: $('negative').value.trim(),
    model: $('model').value,
    ratio: state.ratio,
    steps: Number($('steps').value),
    cfg: Number($('cfg').value),
    batch: Number($('batch').value),
  };
  const seedRaw = $('seed').value.trim();
  if (seedRaw !== '') body.seed = Number(seedRaw);

  if (!body.prompt) {
    showError('무엇을 만들지 적어 주십시오.');
    return;
  }

  state.busy = true;
  state.lastRequest = body;
  showError('');
  $('go').disabled = true;
  $('go').textContent = '만드는 중…';
  $('bar').hidden = false;
  $('publish').hidden = true;
  setBoardState('만드는 중', 'busy');

  const started = Date.now();
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? '만들기를 시작하지 못했습니다');
    await waitFor(d.promptId, started);
  } catch (e) {
    showError(String(e.message ?? e));
    setBoardState('멈춤', 'bad');
  } finally {
    state.busy = false;
    $('go').disabled = false;
    $('go').textContent = '만들기';
    $('bar').hidden = true;
  }
}

async function waitFor(promptId, started) {
  for (let i = 0; i < 900; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let d;
    try {
      d = await (await fetch(`/api/job/${promptId}`)).json();
    } catch {
      continue;
    }

    if (!d.done) {
      const secs = Math.round((Date.now() - started) / 1000);
      setBoardState(d.running ? `만드는 중 ${secs}초` : `차례 기다리는 중 ${secs}초`, 'busy');
      continue;
    }
    if (d.failed) throw new Error('ComfyUI 가 실패했습니다.\n' + (d.error ?? ''));

    state.images = d.images ?? [];
    state.picked = 0;
    if (!state.images.length) throw new Error('결과 이미지가 없습니다.');

    const secs = Math.round((Date.now() - started) / 1000);
    setBoardState(`${state.images.length}장 완성 · ${secs}초`);
    renderResults();
    return;
  }
  throw new Error('너무 오래 걸립니다. ComfyUI 창을 확인해 주십시오.');
}

const previewUrl = (img) =>
  '/api/preview?' +
  new URLSearchParams({
    filename: img.filename,
    subfolder: img.subfolder ?? '',
    type: img.type ?? 'output',
  });

function renderResults() {
  $('board-empty').hidden = true;
  $('shot').hidden = false;
  $('shot-img').src = previewUrl(state.images[state.picked]);

  const wrap = $('thumbs');
  wrap.innerHTML = '';
  if (state.images.length > 1) {
    state.images.forEach((img, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb' + (i === state.picked ? ' on' : '');
      const im = document.createElement('img');
      im.src = previewUrl(img);
      im.alt = `결과 ${i + 1}`;
      b.appendChild(im);
      b.onclick = () => {
        state.picked = i;
        renderResults();
      };
      wrap.appendChild(b);
    });
  }

  $('publish').hidden = false;
  if (!$('p-title').value) {
    $('p-title').value = '';
    $('p-desc').value = state.lastRequest?.prompt?.slice(0, 60) ?? '';
  }
}

// ── 갤러리에 걸기 ──────────────────────────────────

async function publish() {
  const img = state.images[state.picked];
  if (!img) return;

  const btn = $('save');
  btn.disabled = true;
  btn.textContent = '거는 중…';
  showError('');
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: img,
        title: $('p-title').value.trim(),
        description: $('p-desc').value.trim(),
        tags: $('p-tags')
          .value.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        publishNow: $('p-now').checked,
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? '걸지 못했습니다');

    setBoardState(d.published ? '갤러리에 걸었습니다' : '보관함에 담았습니다');
    btn.textContent = d.published ? '걸었습니다' : '담았습니다';
    loadState();
    setTimeout(() => {
      btn.textContent = '갤러리에 걸기';
      btn.disabled = false;
    }, 2500);
  } catch (e) {
    showError(String(e.message ?? e));
    btn.textContent = '갤러리에 걸기';
    btn.disabled = false;
  }
}

// ── 붙이기 ─────────────────────────────────────────

$('make').addEventListener('submit', generate);
$('save').addEventListener('click', publish);
$('again').addEventListener('click', () => generate());
$('model').addEventListener('change', updateSizeHint);

$('toggle-tune').addEventListener('click', () => {
  const t = $('tune');
  t.hidden = !t.hidden;
  $('toggle-tune').textContent = t.hidden ? '더 세밀하게' : '접기';
});

for (const [id, out] of [
  ['steps', 'steps-v'],
  ['cfg', 'cfg-v'],
  ['batch', 'batch-v'],
]) {
  $(id).addEventListener('input', () => {
    $(out).textContent = $(id).value;
    if (id === 'batch') updateSizeHint();
  });
}

// Ctrl/Cmd + Enter 로 만들기
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
});

loadState();
setInterval(() => {
  if (!state.busy) loadState();
}, 20000);
