// 새김AI Atelier · 로컬 API 서버
// 내 PC에서만 돌고, Cloudflare Tunnel이 이 서버를 바깥으로 이어 줍니다.
// 외부 의존성 없음 — Node 표준 라이브러리만 씁니다.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { listWorks, getWork, getSettings, countWorks, openDb, paths } from './db.mjs';

const PORT = Number(process.env.ATELIER_PORT ?? 8787);
const HOST = process.env.ATELIER_HOST ?? '127.0.0.1';
const ALLOWED = (process.env.ATELIER_ALLOWED_ORIGINS ??
  'https://saegimai.com,https://www.saegimai.com,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

const startedAt = new Date().toISOString();

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

// 경로 조작 차단: 파일 이름만 받고, 위험한 글자는 아예 거부합니다.
function safeMediaName(raw) {
  let name;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (name !== basename(name)) return null;
  if (!/^[A-Za-z0-9가-힣._-]+$/u.test(name)) return null;
  if (!Object.hasOwn(MIME, extname(name).toLowerCase())) return null;
  return name;
}

function serveMedia(req, res, rawName) {
  const name = safeMediaName(rawName);
  if (!name) return sendJson(res, 400, { error: 'bad_filename' });

  const file = join(paths.mediaDir, name);
  let st;
  try {
    st = statSync(file);
  } catch {
    return sendJson(res, 404, { error: 'not_found' });
  }
  if (!st.isFile()) return sendJson(res, 404, { error: 'not_found' });

  const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=31536000, immutable' });
    return res.end();
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(name).toLowerCase()],
    'Content-Length': st.size,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'Last-Modified': st.mtime.toUTCString(),
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // 헬스체크 — 웹이 "내 PC가 켜져 있나"를 이걸로 판단합니다. 캐시 금지.
    if (path === '/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'atelier-local-api',
        startedAt,
        now: new Date().toISOString(),
        works: countWorks(),
      }, { 'Cache-Control': 'no-store' });
    }

    if (path === '/api/site') {
      const s = getSettings();
      return sendJson(res, 200, {
        title: s.site_title ?? '새김AI',
        tagline: s.site_tagline ?? 'Atelier',
        intro: s.site_intro ?? '',
      }, { 'Cache-Control': 'no-store' });
    }

    if (path === '/api/works') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 60) || 60, 1), 200);
      const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
      return sendJson(res, 200, listWorks({ limit, offset }), { 'Cache-Control': 'no-store' });
    }

    const detail = path.match(/^\/api\/works\/([^/]+)$/);
    if (detail) {
      const work = getWork(decodeURIComponent(detail[1]));
      if (!work) return sendJson(res, 404, { error: 'not_found' });
      return sendJson(res, 200, work, { 'Cache-Control': 'no-store' });
    }

    const media = path.match(/^\/media\/(.+)$/);
    if (media) return serveMedia(req, res, media[1]);

    return sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('[atelier] 요청 처리 실패:', req.method, path, err);
    return sendJson(res, 500, { error: 'internal_error' });
  }
});

openDb();
server.listen(PORT, HOST, () => {
  console.log('새김AI Atelier 로컬 API');
  console.log(`  주소   http://${HOST}:${PORT}`);
  console.log(`  DB     ${paths.dbFile}`);
  console.log(`  이미지 ${paths.mediaDir}`);
  console.log(`  작품 수 ${countWorks()}개`);
  console.log('  종료는 Ctrl+C');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n[atelier] 서버를 닫습니다.');
    server.close(() => process.exit(0));
  });
}
