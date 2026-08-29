// 새김AI Atelier — 만들기 콘솔 (개인용)
//
// 이 서버는 공개 갤러리 API(8787)와 **다른 포트**에서 돕니다.
// api.saegimai.com 터널은 8787 만 보게 되어 있으므로,
// 공개 주소로는 이 콘솔에 어떤 경로로도 닿을 수 없습니다.
// 바깥에서는 studio.saegimai.com 으로만 들어오며 Cloudflare Access 가 막습니다.

import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDb, paths } from './db.mjs';
import { imageSize } from './imagesize.mjs';
import * as comfy from './comfy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const UI = join(here, 'studio');

const PORT = Number(process.env.ATELIER_STUDIO_PORT ?? 8788);
const HOST = process.env.ATELIER_STUDIO_HOST ?? '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const json = (res, status, body, headers = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
};

async function readBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('요청이 너무 큽니다');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// ── 갤러리에 걸기 ───────────────────────────────────

function slugify(text) {
  const s = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'work';
}

function uniqueValue(db, table, column, value) {
  const stmt = db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ?`);
  let candidate = value;
  let n = 2;
  while (stmt.get(candidate)) candidate = `${value}-${n++}`;
  return candidate;
}

function safeName(name) {
  return (
    name.replace(/[^A-Za-z0-9가-힣._-]/gu, '_').replace(/_+/g, '_').replace(/^[._-]+/, '') ||
    'image'
  );
}

/** ComfyUI 결과 한 장을 내려받아 갤러리 DB 와 media 폴더에 넣습니다. */
async function publish({ image, title, description, tags, publishNow }) {
  const res = await comfy.view(image);
  const bytes = Buffer.from(await res.arrayBuffer());

  const db = openDb();
  const now = new Date().toISOString();
  const base = safeName(basename(image.filename));
  const target = uniqueValue(db, 'works', 'media_file', base);
  const slug = uniqueValue(db, 'works', 'slug', slugify(title || basename(image.filename, extname(image.filename))));
  const file = join(paths.mediaDir, target);

  writeFileSync(file, bytes);
  const { width, height, orientation } = imageSize(file);

  db.prepare(
    `INSERT INTO works
       (slug, title, description, media_file, width, height, orientation, tags,
        published, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    slug,
    title || '이름 없는 작품',
    description || '',
    target,
    width,
    height,
    orientation,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    publishNow ? 1 : 0,
    now,
    now
  );

  return { slug, mediaFile: target, width, height, orientation, published: !!publishNow };
}

// ── 서버 ────────────────────────────────────────────

const clientId = randomUUID();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // 화면
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      const html = readFileSync(join(UI, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    const asset = path.match(/^\/assets\/([A-Za-z0-9._-]+)$/);
    if (req.method === 'GET' && asset) {
      const file = join(UI, asset[1]);
      if (!existsSync(file)) return json(res, 404, { error: 'not_found' });
      res.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      return res.end(readFileSync(file));
    }

    // 지금 상태 — ComfyUI, 그래픽카드, 고를 수 있는 모델
    if (req.method === 'GET' && path === '/api/state') {
      const stats = await comfy.systemStats();
      let opts = { models: [], samplers: [], schedulers: [] };
      let queue = { running: [], pending: [] };
      if (stats.up) {
        [opts, queue] = await Promise.all([
          comfy.options().catch(() => opts),
          comfy.queueState().catch(() => queue),
        ]);
      }
      const db = openDb();
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM works').get();
      const { p } = db.prepare('SELECT COUNT(*) AS p FROM works WHERE published = 1').get();
      return json(res, 200, {
        comfy: stats,
        options: { ...opts, ratios: Object.keys(comfy.RATIOS) },
        queue: { running: queue.running.length, pending: queue.pending.length },
        gallery: { total: n, published: p },
      });
    }

    // 만들기
    if (req.method === 'POST' && path === '/api/generate') {
      const b = await readBody(req);
      if (!b.prompt || !String(b.prompt).trim()) {
        return json(res, 400, { error: '무엇을 만들지 적어 주십시오' });
      }
      if (!b.model) return json(res, 400, { error: '모델을 고르십시오' });

      const seed =
        Number.isFinite(b.seed) && b.seed >= 0
          ? Math.floor(b.seed)
          : Math.floor(Math.random() * 2 ** 32);

      const workflow = comfy.buildWorkflow({
        model: b.model,
        positive: String(b.prompt).slice(0, 2000),
        negative: String(b.negative ?? '').slice(0, 2000),
        ratio: b.ratio,
        steps: Math.min(Math.max(Number(b.steps) || 24, 1), 60),
        cfg: Math.min(Math.max(Number(b.cfg) || 7, 1), 20),
        batch: Math.min(Math.max(Number(b.batch) || 1, 1), 4),
        seed,
      });

      const promptId = await comfy.enqueue(workflow, clientId);
      const [width, height] = comfy.sizeFor(b.model, b.ratio);
      return json(res, 200, { promptId, seed, width, height });
    }

    // 다 됐나
    const job = path.match(/^\/api\/job\/([a-z0-9-]+)$/i);
    if (req.method === 'GET' && job) {
      const r = await comfy.result(job[1]);
      if (!r) {
        const q = await comfy.queueState().catch(() => ({ running: [], pending: [] }));
        return json(res, 200, {
          done: false,
          running: q.running.includes(job[1]),
          ahead: q.pending.length,
        });
      }
      return json(res, 200, r);
    }

    // 결과 미리보기 — ComfyUI 이미지를 그대로 흘려보냅니다
    if (req.method === 'GET' && path === '/api/preview') {
      const filename = url.searchParams.get('filename');
      if (!filename) return json(res, 400, { error: 'filename 이 없습니다' });
      const upstream = await comfy.view({
        filename,
        subfolder: url.searchParams.get('subfolder') ?? '',
        type: url.searchParams.get('type') ?? 'output',
      });
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'no-store',
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.end(buf);
    }

    // 갤러리에 걸기
    if (req.method === 'POST' && path === '/api/publish') {
      const b = await readBody(req);
      if (!b.image?.filename) return json(res, 400, { error: '어떤 이미지인지 알 수 없습니다' });
      const saved = await publish({
        image: b.image,
        title: b.title,
        description: b.description,
        tags: b.tags,
        publishNow: b.publishNow !== false,
      });
      return json(res, 200, saved);
    }

    // 멈추기
    if (req.method === 'POST' && path === '/api/interrupt') {
      await comfy.interrupt();
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('[studio]', req.method, path, err);
    return json(res, 500, { error: String(err?.message ?? err).slice(0, 400) });
  }
});

openDb();
server.listen(PORT, HOST, () => {
  console.log('새김AI Atelier 만들기 콘솔');
  console.log(`  주소     http://${HOST}:${PORT}`);
  console.log(`  ComfyUI  ${process.env.ATELIER_COMFY ?? 'http://127.0.0.1:8188'}`);
  console.log('  이 포트는 공개 갤러리 API(8787)와 분리되어 있습니다.');
  console.log('  종료는 Ctrl+C');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n[studio] 콘솔을 닫습니다.');
    server.close(() => process.exit(0));
  });
}
