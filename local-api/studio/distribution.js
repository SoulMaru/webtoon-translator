// 배포 오케스트레이터 화면. 프레임워크 없이 씁니다.

const $ = (id) => document.getElementById(id);

const state = {
  meta: null,
  slug: null,
  list: null,
  epNo: null, // 숫자 또는 'new'
  detail: null,
  tab: 'episodes',
  cp: '24h',
};

// ── 작은 도구 ──────────────────────────────────────

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? `요청 실패 (${res.status})`);
  return d;
}

const enc = encodeURIComponent;
const seriesUrl = () => `/api/dist/series/${enc(state.slug)}`;
const epUrl = (n = state.epNo) => `${seriesUrl()}/episodes/${n}`;

function flash(kind, msg) {
  const err = $('err');
  const ok = $('ok');
  err.hidden = ok.hidden = true;
  if (!msg) return;
  const el = kind === 'err' ? err : ok;
  el.textContent = msg;
  el.hidden = false;
  if (kind === 'ok') setTimeout(() => (ok.hidden = true), 4000);
}

async function guard(btn, label, fn) {
  const old = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = label;
  }
  flash();
  try {
    return await fn();
  } catch (e) {
    flash('err', String(e.message ?? e));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = old;
    }
  }
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '복사됨';
      setTimeout(() => (btn.textContent = old), 1500);
    }
  } catch {
    flash('err', '복사하지 못했습니다. 직접 선택해서 복사해 주십시오.');
  }
}

const copyBtn = (text) => h('button', { type: 'button', class: 'copy', onclick: (e) => copyText(text, e.target) }, '복사');
const pname = (id) => state.meta.platforms.find((p) => p.id === id)?.name ?? id;
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('ko-KR') : '–');
const vclass = (v) => (v ? `v-${v.split(' ')[0]}` : '');
const badge = (v) => h('span', { class: `badge ${vclass(v)}` }, v ?? '판정 없음');

function kv(label, value, { copy = false } = {}) {
  const dd = Array.isArray(value)
    ? h('dd', {}, value.length ? h('ul', {}, value.map((x) => h('li', {}, x))) : '–')
    : h('dd', {}, value || '–');
  return h('div', { class: 'kv' }, h('dt', {}, label, copy && value ? copyBtn(Array.isArray(value) ? value.join(' ') : value) : null), dd);
}

function card(title, sub, ...rows) {
  return h('div', { class: 'card' }, h('h3', {}, title, sub ? h('small', {}, sub) : null), ...rows);
}

function pane(tag, title, body, { done = false, stateText = '' } = {}) {
  return h(
    'section',
    { class: `pane step${done ? ' is-done' : ''}` },
    h('div', { class: 'pane-head' }, h('span', { class: 'pane-tag' }, tag), h('h2', {}, title), stateText ? h('span', { class: 'pane-state' }, stateText) : null),
    h('div', { class: 'pane-body' }, body)
  );
}

// ── 처음 ───────────────────────────────────────────

async function loadMeta() {
  state.meta = await api('GET', '/api/dist/meta');
  const engine = $('engine');
  if (state.meta.api.available) {
    engine.className = 'status up';
    $('engine-title').textContent = 'Claude API 연결됨';
    $('engine-note').textContent = state.meta.api.model;
  } else {
    engine.className = 'status down';
    $('engine-title').textContent = 'API 키 없음';
    $('engine-note').textContent = '지시문 복사 → 결과 붙여넣기로 씁니다';
  }
  $('prompt-version').textContent = state.meta.promptVersion;
}

async function loadSeriesList() {
  const { series } = await api('GET', '/api/dist/series');
  const nav = $('series-list');
  nav.innerHTML = '';
  for (const s of series) {
    nav.append(
      h(
        'a',
        { class: 'rail-item' + (s.slug === state.slug ? ' is-on' : ''), href: `#${enc(s.slug)}` },
        s.title,
        h('small', {}, `${s.episodes}화`)
      )
    );
  }
  if (!series.length) nav.append(h('span', { class: 'rail-item' }, '아직 없습니다'));
  return series;
}

// ── 작품 ───────────────────────────────────────────

async function openSeries(slug, keepEp = false) {
  state.slug = slug;
  state.list = await api('GET', seriesUrl());
  const { series, numbering, episodes } = state.list;
  $('new-series').hidden = true;
  $('series-view').hidden = false;
  $('crumb-here').textContent = series.title;
  $('sv-title').textContent = series.title;
  $('sv-logline').textContent = series.logline || '';
  $('sv-count').textContent = `${episodes.length}화`;
  $('sv-numbering').innerHTML = '';
  $('sv-numbering').append(
    h('strong', {}, `다음 번호 ${numbering.next}화`),
    numbering.gaps.length ? `결번: ${numbering.gaps.map((g) => `${g}화`).join(', ')}` : '결번 없음'
  );
  $('ss-logline').value = series.logline;
  $('ss-carry').value = series.carry_in;
  await loadSeriesList();

  if (!keepEp || state.epNo === null) {
    state.epNo = episodes.length ? episodes.at(-1).ep_no : 'new';
  }
  renderStrip();
  await showTab(state.tab);
}

function renderStrip() {
  const strip = $('ep-strip');
  strip.innerHTML = '';
  for (const e of state.list.episodes) {
    const dotClass = e.final_verdict ? `dot ${vclass(e.final_verdict)}` : e.locked_at ? 'dot locked' : 'dot';
    strip.append(
      h(
        'button',
        {
          type: 'button',
          class: 'ep-chip' + (e.ep_no === state.epNo ? ' on' : ''),
          title: [e.title, e.locked_at ? '예측 잠김' : '', e.final_verdict ?? ''].filter(Boolean).join(' · '),
          onclick: () => selectEpisode(e.ep_no),
        },
        h('span', { class: dotClass }),
        `${e.ep_no}화`
      )
    );
  }
  strip.append(
    h('button', { type: 'button', class: 'ep-chip new' + (state.epNo === 'new' ? ' on' : ''), onclick: () => selectEpisode('new') }, '+ 새 회차')
  );
}

async function selectEpisode(n) {
  state.epNo = n;
  renderStrip();
  await renderEpisode();
}

async function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.dist-tabs .pill').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === 'episodes') await renderEpisode();
  if (tab === 'baselines') await renderBaselines();
  if (tab === 'learning') await renderLearning();
}

// ── 회차 ───────────────────────────────────────────

async function renderEpisode() {
  const root = $('episode');
  root.innerHTML = '';
  if (state.epNo === 'new') {
    state.detail = null;
    root.append(newEpisodeForm());
    return;
  }
  state.detail = await api('GET', epUrl());
  const d = state.detail;
  root.append(
    h('div', { class: 'steps' }, stepScript(d), stepPackage(d), stepForecast(d), stepActuals(d), stepReview(d))
  );
}

function episodeFields(e = {}, disabled = false) {
  return [
    h(
      'div',
      { class: 'field-row' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, '회차 제목'), h('input', { id: 'ep-title', type: 'text', value: e.title ?? '', disabled })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, '길이 (초)'), h('input', { id: 'ep-dur', type: 'number', min: 1, value: e.duration_sec ?? '', disabled }))
    ),
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'field-label' }, '영상 메모'),
      h('textarea', {
        id: 'ep-notes',
        rows: 6,
        disabled,
        placeholder: '0:00~0:03 문이 열리고 … / 자막 / 효과음 / 컷 전환. 첫 3초 화면은 꼭 적어 주십시오.',
        value: e.video_notes ?? '',
      }),
      h('span', { class: 'field-hint' }, '✳ 모델은 영상을 직접 보지 못합니다. 화면에서만 보이는 것은 여기 적어야 분석에 들어갑니다.')
    ),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '대본'), h('textarea', { id: 'ep-script', rows: 10, disabled, value: e.script ?? '' })),
  ];
}

function readEpisodeFields() {
  return {
    title: $('ep-title').value.trim(),
    durationSec: $('ep-dur').value,
    videoNotes: $('ep-notes').value,
    script: $('ep-script').value,
  };
}

function newEpisodeForm() {
  const { next, gaps } = state.list.numbering;
  const btn = h('button', { type: 'submit', class: 'primary' }, '회차 만들기');
  const form = h(
    'form',
    { class: 'pane-body' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '회차 번호 ', h('b', { class: 'req' }, '필수')), h('input', { id: 'ep-no', type: 'number', min: 1, value: next, required: true }),
      h('span', { class: 'field-hint' }, gaps.length ? `✳ 다음 번호는 ${next}화입니다. 결번 ${gaps.map((g) => `${g}화`).join(', ')} 이 있습니다.` : `✳ 기존 기록을 확인했습니다. 다음 번호는 ${next}화입니다.`)),
    ...episodeFields(),
    h('div', { class: 'make-foot' }, h('span'), btn)
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    guard(btn, '만드는 중…', async () => {
      const epNo = Number($('ep-no').value);
      const r = await api('POST', `${seriesUrl()}/episodes`, { epNo, ...readEpisodeFields() });
      state.epNo = r.episode.ep_no;
      await openSeries(state.slug, true);
      flash('ok', `${epNo}화를 만들었습니다.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`);
    });
  });
  return h('section', { class: 'pane' }, h('div', { class: 'pane-head' }, h('span', { class: 'pane-tag' }, '+'), h('h2', {}, '새 회차')), form);
}

function stepScript(d) {
  const locked = Boolean(d.forecast);
  const btn = h('button', { type: 'button', class: 'ghost', disabled: locked }, '저장');
  btn.onclick = () =>
    guard(btn, '저장 중…', async () => {
      await api('POST', epUrl(), readEpisodeFields());
      await openSeries(state.slug, true);
      flash('ok', '저장했습니다.');
    });
  return pane(
    '1',
    `${d.episode.ep_no}화 · 대본과 영상 메모`,
    [...episodeFields(d.episode, locked), h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, locked ? '예측이 잠겨 고칠 수 없습니다.' : ''), btn)],
    { done: Boolean(d.episode.script || d.episode.video_notes) }
  );
}

// ── 2. 패키지 ──────────────────────────────────────

function stepPackage(d) {
  const locked = Boolean(d.forecast);
  const body = [];
  const actions = h('div', { class: 'step-actions' });

  if (!locked) {
    actions.append(h('span', { class: 'hint' }, d.package ? `${d.package.version}판 · ${d.package.source === 'api' ? d.package.model : '붙여넣음'}` : '아직 없습니다'));
    const promptBtn = h('button', { type: 'button', class: 'ghost' }, '지시문 복사');
    promptBtn.onclick = () =>
      guard(promptBtn, '불러오는 중…', async () => {
        const p = await api('GET', `${epUrl()}/prompt`);
        const text = `${p.system}\n\n---\n\n${p.user}\n\n---\n\n아래 JSON 스키마를 정확히 따르는 JSON 하나만 출력하십시오.\n${JSON.stringify(p.schema)}`;
        await copyText(text, promptBtn);
      });
    actions.append(promptBtn);
    if (state.meta.api.available) {
      const gen = h('button', { type: 'button', class: 'primary' }, d.package ? '다시 만들기' : '패키지 만들기');
      gen.onclick = () =>
        guard(gen, '만드는 중… (1~3분)', async () => {
          await api('POST', `${epUrl()}/package`, { mode: 'api' });
          await renderEpisode();
          flash('ok', '패키지를 만들었습니다.');
        });
      actions.append(gen);
    }
    body.push(actions);

    const paste = h('textarea', { class: 'mono', rows: 5, placeholder: '다른 곳에서 받은 결과 JSON 을 여기에 붙여넣으십시오.' });
    const pasteBtn = h('button', { type: 'button', class: 'ghost' }, '붙여넣은 결과 저장');
    pasteBtn.onclick = () =>
      guard(pasteBtn, '검사 중…', async () => {
        await api('POST', `${epUrl()}/package`, { mode: 'paste', json: paste.value });
        await renderEpisode();
        flash('ok', '붙여넣은 패키지를 저장했습니다.');
      });
    body.push(h('details', { class: 'more', open: !state.meta.api.available && !d.package }, h('summary', {}, '결과 붙여넣기'), paste, h('div', { class: 'step-actions' }, pasteBtn)));
  }

  if (d.package) {
    if (d.package.fixes.length) body.push(h('ul', { class: 'fixes' }, d.package.fixes.map((f) => h('li', {}, f))));
    body.push(renderPackage(d.package.output));
  }
  return pane('2', '플랫폼별 배포 패키지', body, {
    done: Boolean(d.package),
    stateText: locked ? `잠김 · ${d.package.version}판` : '',
  });
}

function renderPackage(o) {
  const a = o.analysis;
  const yt = o.youtube_shorts;
  const tt = o.tiktok;
  const ig = o.instagram_reels;
  const fb = o.facebook_reels;
  const th = o.threads;
  const nv = o.naver_clip;
  const threadsLabel = {
    ab_choice: 'A/B 선택',
    character_judgment: '인물 판단',
    culprit_guess: '범인 추측',
    moral_judgment: '도덕적 판단',
    hidden_clue: '숨은 단서',
  };
  return h(
    'div',
    { class: 'pkg-grid' },
    card(
      '분석',
      a.source_note,
      kv('첫 3초 핵심 사건', a.first3s_event),
      kv('가장 강한 감정', a.strongest_emotion),
      kv('가장 궁금한 미스터리', a.core_mystery),
      kv('댓글 논쟁거리', a.debate_trigger),
      kv('다음 화로 끄는 미회수 정보', a.unresolved_hook),
      kv('스포일러 금지', a.spoiler_guard),
      kv('검색 주제', a.search_topics),
      kv('핵심 갈등', a.core_conflict),
      kv('이탈 위험 구간', a.dropoff_risks.map((r) => `${r.segment} — ${r.reason}`))
    ),
    card(
      'YOUTUBE SHORTS',
      '시작률 · 지속 · 다음 화',
      kv('제목 후보', yt.title_candidates),
      kv('최종 제목', yt.final_title, { copy: true }),
      kv('설명', yt.description, { copy: true }),
      kv('고정댓글', yt.pinned_comment, { copy: true }),
      kv('다음 회차 CTA', yt.next_episode_cta, { copy: true })
    ),
    card(
      'TIKTOK',
      'For You · 검색 · 댓글',
      kv('캡션', tt.caption, { copy: true }),
      kv('해시태그', tt.hashtags.join(' '), { copy: true }),
      kv('추리 질문', tt.deduction_question, { copy: true }),
      kv('양자택일', tt.either_or_question, { copy: true })
    ),
    card(
      'INSTAGRAM REELS',
      '비팔로워 · 공유 · 팔로우',
      kv('캡션', ig.caption, { copy: true }),
      kv('질문형 CTA', ig.question_cta, { copy: true }),
      kv('Story 공유 문구', ig.story_share_text, { copy: true }),
      kv('Trial Reel', `${ig.trial_reel.recommend ? '시험 권장' : '시험 불필요'} — ${ig.trial_reel.reason}`)
    ),
    card(
      'FACEBOOK REELS',
      '이해 · 몰입 · 댓글',
      kv('캡션', fb.caption, { copy: true }),
      kv('선택 질문', fb.choice_question, { copy: true }),
      kv('댓글 유도문', fb.comment_prompt, { copy: true })
    ),
    card('THREADS', threadsLabel[th.format] ?? th.format, kv('주제', th.topic), kv('게시물', th.post, { copy: true })),
    card(
      'NAVER CLIP',
      `본문 ${[...nv.body].length}자 / ${300}`,
      kv('본문', nv.body, { copy: true }),
      kv('카테고리', nv.category),
      kv('정보태그 후보', nv.info_tag_candidates),
      kv(`해시태그 (최대 ${state.meta.naverMaxHashtags}개)`, nv.hashtags.join(' '), { copy: true }),
      kv('AI 활용 설정', `${nv.ai_disclosure.setting === 'on' ? '켬' : '확인 필요'} — ${nv.ai_disclosure.note}`)
    )
  );
}

// ── 3. 예측 ────────────────────────────────────────

function stepForecast(d) {
  const f = d.forecast?.qualitative ?? d.package?.output?.forecast;
  if (!f) return pane('3', '게시 전 예측', [h('p', { class: 'hint' }, '패키지를 만들면 예측이 함께 나옵니다.')]);

  const outlookOf = Object.fromEntries(f.platform_outlook.map((o) => [o.platform, o]));
  const body = [
    h(
      'div',
      { class: 'pkg-grid' },
      card(
        '흐름 예측',
        null,
        kv('가장 강할 플랫폼', `${pname(f.strongest_platform)} — ${f.strongest_reason}`),
        kv('가장 약할 플랫폼', `${pname(f.weakest_platform)} — ${f.weakest_reason}`),
        kv('첫 3초 성공 가능성', `${{ high: '높음', medium: '보통', low: '낮음' }[f.first3s_success.level]} — ${f.first3s_success.reason}`),
        kv('완주율 위험 구간', f.completion_risk_segments.map((r) => `${r.segment} — ${r.reason}`)),
        kv('댓글을 가장 많이 부를 요소', f.top_comment_driver),
        kv('다음 화 이동을 부를 요소', f.next_episode_driver)
      ),
      forecastTable(d, outlookOf)
    ),
  ];

  if (d.forecast) {
    body.push(h('p', { class: 'lock-note' }, `잠금 ${new Date(d.forecast.locked_at).toLocaleString('ko-KR')} · 지시문 ${d.forecast.prompt_version}. 이 예측은 바꿀 수 없습니다.`));
  } else {
    const lockBtn = h('button', { type: 'button', class: 'primary' }, '예측 잠그기');
    lockBtn.onclick = () => {
      if (!confirm('잠그면 이 회차의 패키지·대본·예측을 다시 고칠 수 없습니다.\n지금 기준 데이터로 숫자 범위를 계산해 잠급니다. 계속할까요?')) return;
      guard(lockBtn, '잠그는 중…', async () => {
        await api('POST', `${epUrl()}/lock`);
        await openSeries(state.slug, true);
        flash('ok', '예측을 잠갔습니다. 이제 게시하십시오.');
      });
    };
    body.push(
      h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, '숫자 범위는 잠그는 순간의 기준 데이터(최근 게시물 중앙값)로 계산됩니다.'), lockBtn)
    );
  }
  return pane('3', '게시 전 예측', body, { done: Boolean(d.forecast), stateText: d.forecast ? '잠김' : '잠그기 전' });
}

function forecastTable(d, outlookOf) {
  const ranges = d.forecast?.ranges;
  const rows = state.meta.platforms.map((p) => {
    const o = outlookOf[p.id];
    const r = ranges?.[p.id]?.metrics ?? {};
    const cell = (key) => {
      const x = r[key];
      if (!ranges) return '잠글 때 계산';
      if (!x) return '기준 없음';
      return h('span', { title: `중앙값 ${fmt(x.median)} · 표본 ${x.n}` }, `${fmt(x.low)}~${fmt(x.high)}${x.reliable ? '' : ' *'}`);
    };
    return h(
      'tr',
      {},
      h('td', {}, p.name),
      h('td', { title: o?.reason ?? '' }, state.meta.outlooks[o?.outlook] ?? '–'),
      h('td', {}, cell('views_24h')),
      h('td', {}, cell('comments_24h'))
    );
  });
  return card(
    '24시간 예상 범위',
    ranges ? '* 표본 10개 미만 = 참고값' : '',
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '플랫폼'), h('th', {}, '자기 기준 대비'), h('th', {}, '조회수'), h('th', {}, '댓글'))), h('tbody', {}, rows)))
  );
}

// ── 4. 실적 · 판정 ─────────────────────────────────

function cpTabs(d) {
  return h(
    'div',
    { class: 'cp-tabs pills' },
    state.meta.checkpoints.map((cp) =>
      h(
        'button',
        {
          type: 'button',
          class: 'pill' + (cp === state.cp ? ' on' : ''),
          onclick: () => {
            state.cp = cp;
            renderEpisode();
          },
        },
        cp,
        d.reviews[cp]?.evaluation?.verdict ? ` · ${d.reviews[cp].evaluation.verdict}` : d.actuals[cp] ? ' · 입력됨' : ''
      )
    )
  );
}

function stepActuals(d) {
  if (!d.forecast) return pane('4', '게시 후 실적', [h('p', { class: 'hint' }, '예측을 잠근 뒤에 실적을 받습니다.')]);
  const cp = state.cp;
  const have = d.actuals[cp] ?? {};
  const main = [
    ['views', '조회수'],
    ['comments', '댓글'],
    ['likes', '좋아요'],
  ];
  const diag = state.meta.diagnosticMetrics;
  const input = (p, key) => h('input', { type: 'text', inputMode: 'decimal', 'data-p': p, 'data-k': key, value: have[p]?.[key] ?? '' });

  const table = h(
    'table',
    { class: 'tbl', id: 'actuals' },
    h('thead', {}, h('tr', {}, h('th', {}, '플랫폼'), main.map(([, l]) => h('th', {}, l)), diag.map((m) => h('th', { title: m.cause ? `${m.cause} 근거` : '' }, m.label)))),
    h('tbody', {}, state.meta.platforms.map((p) => h('tr', {}, h('td', {}, p.name), main.map(([k]) => h('td', {}, input(p.id, k))), diag.map((m) => h('td', {}, input(p.id, m.key))))))
  );

  const save = h('button', { type: 'button', class: 'primary' }, `${cp} 실적 저장 · 판정`);
  save.onclick = () =>
    guard(save, '판정 중…', async () => {
      const platforms = {};
      for (const el of document.querySelectorAll('#actuals input')) {
        if (el.value.trim() === '') continue;
        (platforms[el.dataset.p] ??= {})[el.dataset.k] = el.value.trim();
      }
      await api('POST', `${epUrl()}/actuals/${cp}`, { platforms });
      await openSeries(state.slug, true);
      flash('ok', `${cp} 실적을 저장하고 판정했습니다.`);
    });

  const body = [cpTabs(d), h('div', { class: 'tbl-wrap' }, table), h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, '빈 칸은 저장하지 않습니다. 오른쪽 지표는 MISS 원인을 가르는 근거로만 씁니다.'), save)];

  const r = d.reviews[cp];
  if (r) body.push(renderEvaluation(r.evaluation, r.diagnosis));
  return pane('4', '게시 후 실적 · 판정', body, { done: Boolean(r), stateText: r?.evaluation?.verdict ?? '' });
}

function renderEvaluation(e, diag) {
  const dir = { inside: '범위 안', under: '밑돎', over: '웃돎' };
  const rows = Object.entries(e.platforms).map(([p, r]) => {
    const v = r.views;
    return h(
      'tr',
      {},
      h('td', {}, pname(p)),
      h('td', {}, v ? fmt(v.actual) : '–'),
      h('td', {}, v ? `${fmt(v.low)}~${fmt(v.high)}` : '범위 없음'),
      h('td', {}, v ? badge(v.verdict) : '–'),
      h('td', {}, v ? `${dir[v.direction]}${v.distance ? ` ${Math.round(v.distance * 100)}%` : ''}` : '')
    );
  });
  const call = (c, label) => `${label}: 예측 ${c.predicted ? pname(c.predicted) : '–'} / 실제 ${c.actual ? pname(c.actual) : '판단 불가'}${c.correct === null ? '' : c.correct ? ' ✓' : ' ✗'}`;
  const parts = [
    h('div', { class: 'big-verdict' }, badge(e.verdict), h('span', { class: 'hint' }, e.score !== null ? `점수 ${e.score.toFixed(2)}` : '')),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, h('th', {}, '플랫폼'), h('th', {}, '실제 조회수'), h('th', {}, '예측 범위'), h('th', {}, '판정'), h('th', {}, '차이'))), h('tbody', {}, rows))),
    h('ul', { class: 'lock-note' }, h('li', {}, call(e.calls.strongest, '가장 강할 플랫폼')), h('li', {}, call(e.calls.weakest, '가장 약할 플랫폼')), e.notes.map((n) => h('li', {}, n))),
  ];
  if (diag?.missedPlatforms?.length) {
    parts.push(
      card(
        'MISS 원인 후보 (지표 근거)',
        `이전 회차 ${diag.historyEpisodes}개와 비교`,
        diag.candidates.length
          ? h('ul', { class: 'lock-note' }, diag.candidates.map((c) => h('li', {}, h('b', {}, c.cause), ' ', c.note)))
          : h('p', { class: 'hint' }, '근거가 되는 지표가 없습니다. 노출·시작률·시청 비율을 넣거나, 리뷰에서 근거 없음으로 적으십시오.')
      )
    );
  }
  return h('div', { class: 'steps' }, parts);
}

// ── 5. 리뷰 · 학습기록 ─────────────────────────────

function stepReview(d) {
  const cp = state.cp;
  const r = d.reviews[cp];
  if (!r) return pane('5', '리뷰 · 다음 화 변수', [h('p', { class: 'hint' }, `${cp} 판정이 나오면 리뷰를 적습니다.`)]);

  const body = [cpTabs(d)];
  const actions = h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, `다음 화에서 바꿀 변수는 최대 ${state.meta.maxNextChanges}개입니다.`));
  if (state.meta.api.available) {
    const ai = h('button', { type: 'button', class: 'ghost' }, 'Claude 리뷰 받기');
    ai.onclick = () =>
      guard(ai, '리뷰 중…', async () => {
        await api('POST', `${epUrl()}/review/${cp}`, { mode: 'api' });
        await renderEpisode();
        flash('ok', '리뷰를 저장했습니다.');
      });
    actions.append(ai);
  }
  const promptBtn = h('button', { type: 'button', class: 'ghost' }, '리뷰 지시문 복사');
  promptBtn.onclick = () =>
    guard(promptBtn, '불러오는 중…', async () => {
      const p = await api('GET', `${epUrl()}/review/${cp}/prompt`);
      await copyText(`${p.system}\n\n---\n\n${p.user}\n\n---\n\n아래 JSON 스키마를 정확히 따르는 JSON 하나만 출력하십시오.\n${JSON.stringify(p.schema)}`, promptBtn);
    });
  actions.append(promptBtn);
  body.push(actions);

  // 손으로 적기
  const rv = r.review ?? { summary: '', causes: [], keep: [], next_changes: [] };
  const causeBoxes = state.meta.missCauses.map((c) => {
    const found = rv.causes.find((x) => x.category === c);
    return h(
      'div',
      { class: 'field-row' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-cause': c, checked: Boolean(found) }), h('span', {}, c)),
      h('input', { type: 'text', 'data-evidence': c, placeholder: '근거 (지표 근거가 없으면 "추정"이라고 적기)', value: found?.evidence ?? '' })
    );
  });
  const changeRows = [0, 1].map((i) => {
    const c = rv.next_changes[i] ?? {};
    return h(
      'div',
      { class: 'field-row' },
      h('input', { type: 'text', 'data-change': i, 'data-f': 'variable', placeholder: `변수 ${i + 1} (예: 유튜브 제목 첫 단어)`, value: c.variable ?? '' }),
      h('input', { type: 'text', 'data-change': i, 'data-f': 'change', placeholder: '어떻게 (예: 인물명 → 사건명)', value: c.change ?? '' }),
      h('input', { type: 'text', 'data-change': i, 'data-f': 'reason', placeholder: '왜', value: c.reason ?? '' }),
      h('input', { type: 'text', 'data-change': i, 'data-f': 'platforms', placeholder: '플랫폼 (쉼표, 예: tiktok)', value: (c.platforms ?? []).join(', ') })
    );
  });
  const form = h(
    'div',
    { class: 'steps', id: 'review-form' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '요약'), h('input', { type: 'text', id: 'rv-summary', value: rv.summary })),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'MISS 원인 (CONTENT · PACKAGING · DISTRIBUTION)'), causeBoxes),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '유지할 것 (한 줄에 하나)'), h('textarea', { id: 'rv-keep', rows: 3, value: rv.keep.join('\n') })),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, `다음 화에서 바꿀 변수 (최대 ${state.meta.maxNextChanges}개)`), changeRows)
  );
  const saveBtn = h('button', { type: 'button', class: 'primary' }, '리뷰 저장');
  saveBtn.onclick = () =>
    guard(saveBtn, '저장 중…', async () => {
      const review = {
        summary: $('rv-summary').value.trim(),
        causes: state.meta.missCauses
          .filter((c) => document.querySelector(`[data-cause="${c}"]`).checked)
          .map((c) => {
            const evidence = document.querySelector(`[data-evidence="${c}"]`).value.trim();
            return { category: c, evidence, backed_by_metric: !/추정/.test(evidence) && evidence !== '' };
          }),
        keep: $('rv-keep').value.split('\n').map((s) => s.trim()).filter(Boolean),
        next_changes: [0, 1]
          .map((i) => {
            const get = (f) => document.querySelector(`[data-change="${i}"][data-f="${f}"]`).value.trim();
            return {
              variable: get('variable'),
              change: get('change'),
              reason: get('reason'),
              platforms: get('platforms').split(',').map((s) => s.trim()).filter((p) => state.meta.platforms.some((x) => x.id === p)),
            };
          })
          .filter((c) => c.variable),
      };
      await api('POST', `${epUrl()}/review/${cp}`, { mode: 'manual', json: review });
      await openSeries(state.slug, true);
      flash('ok', '리뷰와 학습기록을 저장했습니다.');
    });
  body.push(form, h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, r.review ? `저장됨 · ${r.source === 'api' ? 'Claude' : r.source === 'paste' ? '붙여넣음' : '직접 적음'}` : ''), saveBtn));

  const paste = h('textarea', { class: 'mono', rows: 4, placeholder: '리뷰 JSON 붙여넣기' });
  const pasteBtn = h('button', { type: 'button', class: 'ghost' }, '붙여넣은 리뷰 저장');
  pasteBtn.onclick = () =>
    guard(pasteBtn, '검사 중…', async () => {
      await api('POST', `${epUrl()}/review/${cp}`, { mode: 'paste', json: paste.value });
      await openSeries(state.slug, true);
      flash('ok', '리뷰를 저장했습니다.');
    });
  body.push(h('details', { class: 'more' }, h('summary', {}, '리뷰 결과 붙여넣기'), paste, h('div', { class: 'step-actions' }, pasteBtn)));

  if (d.learning) {
    const text = JSON.stringify(d.learning, null, 2);
    body.push(h('details', { class: 'more' }, h('summary', {}, '이 회차 학습기록 (JSON)'), h('pre', { class: 'mono' }, text), h('div', { class: 'step-actions' }, copyBtn(text))));
  }
  return pane('5', '리뷰 · 다음 화 변수', body, { done: Boolean(r.review) });
}

// ── 기준 데이터 ────────────────────────────────────

async function renderBaselines() {
  const b = await api('GET', '/api/dist/baselines');
  const cols = { views_2h: '2h 조회', views_24h: '24h 조회', views_72h: '72h 조회', views_7d: '7d 조회', comments_24h: '24h 댓글' };
  $('baseline-help').textContent =
    `플랫폼마다 최근 게시물 ${state.meta.baselineSize}개를 최근 것부터 한 줄에 하나씩 붙여넣으십시오. ` +
    `칸 순서: ${state.meta.baselineColumns.map((c) => cols[c]).join(', ')}. 모르는 칸은 - 로 두십시오. ` +
    '스프레드시트에서 그대로 복사해도 됩니다. 1.2만 · 3천 · 1.5k 표기도 읽습니다.';
  const grid = $('baseline-grid');
  grid.innerHTML = '';
  for (const p of state.meta.platforms) {
    const s = b.summary[p.id];
    const ta = h('textarea', { class: 'mono', rows: 8, value: b.raw[p.id], placeholder: '- 1200 - - 15\n- 980 - - 9' });
    const btn = h('button', { type: 'button', class: 'ghost' }, '저장');
    btn.onclick = () =>
      guard(btn, '저장 중…', async () => {
        const r = await api('POST', `/api/dist/baselines/${p.id}`, { text: ta.value });
        flash('ok', `${p.name} 기준 ${r.posts}개 저장${r.dropped ? ` (위에서 ${state.meta.baselineSize}개만 쓰고 ${r.dropped}개는 뺐습니다)` : ''}`);
        await renderBaselines();
      });
    const v24 = s.stats.views_24h;
    grid.append(
      card(
        p.name,
        `${s.posts}/${state.meta.baselineSize}개${b.updatedAt[p.id] ? ` · ${new Date(b.updatedAt[p.id]).toLocaleDateString('ko-KR')}` : ''}`,
        ta,
        h('div', { class: 'step-actions' }, h('span', { class: 'hint' }, v24 ? `24h 조회 중앙값 ${fmt(v24.median)} (표본 ${v24.n})` : '24h 조회 기준 없음'), btn)
      )
    );
  }
}

// ── 학습기록 ───────────────────────────────────────

async function renderLearning() {
  const l = await api('GET', `${seriesUrl()}/learning`);
  $('learning-block').textContent = l.block;
  $('learning-state').textContent = `평가 완료 ${l.records.length}개 회차`;
  $('learning-copy').onclick = (e) => copyText(l.block, e.target);
  $('learning-json').onclick = () => {
    const blob = new Blob([JSON.stringify({ series: l.series, records: l.records }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${l.series.slug}-learning.json` });
    document.body.append(a);
    a.click();
    a.remove();
  };
}

// ── 붙이기 ─────────────────────────────────────────

document.querySelectorAll('.dist-tabs .pill').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

$('new-series-toggle').addEventListener('click', () => {
  $('new-series').hidden = false;
  $('series-view').hidden = true;
  $('crumb-here').textContent = '새 작품';
  $('ns-title').focus();
});

$('new-series-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type=submit]');
  guard(btn, '만드는 중…', async () => {
    const s = await api('POST', '/api/dist/series', {
      title: $('ns-title').value.trim(),
      logline: $('ns-logline').value.trim(),
      carryIn: $('ns-carry').value,
    });
    ev.target.reset();
    location.hash = enc(s.slug);
  });
});

$('series-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type=submit]');
  guard(btn, '저장 중…', async () => {
    await api('POST', seriesUrl(), { logline: $('ss-logline').value.trim(), carryIn: $('ss-carry').value });
    await openSeries(state.slug, true);
    flash('ok', '작품 설정을 저장했습니다.');
  });
});

async function route() {
  const slug = decodeURIComponent(location.hash.slice(1));
  if (slug) {
    state.epNo = null;
    await guard(null, '', () => openSeries(slug));
  }
}

window.addEventListener('hashchange', route);

(async () => {
  try {
    await loadMeta();
    const series = await loadSeriesList();
    if (location.hash) await route();
    else if (series.length) location.hash = enc(series[0].slug);
    else $('new-series').hidden = false;
  } catch (e) {
    flash('err', String(e.message ?? e));
  }
})();
