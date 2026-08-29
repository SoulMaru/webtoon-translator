// ComfyUI 출력 폴더를 훑어서 새 이미지를 작품으로 등록합니다.
//   node ingest.mjs                 등록
//   node ingest.mjs --dry-run       무엇이 등록될지 보기만
//   node ingest.mjs --source "경로"  다른 폴더에서 가져오기
import { readdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';
import { openDb, paths } from './db.mjs';
import { imageSize } from './imagesize.mjs';

const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sourceArg = args[args.indexOf('--source') + 1];

const source = resolve(
  (args.includes('--source') && sourceArg) ||
  process.env.ATELIER_SOURCE ||
  join(paths.root, '..', '..', 'ComfyUI', 'output')
);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXT.has(extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

// 서버가 내보낼 수 있는 글자만 남깁니다. (server.mjs 의 safeMediaName 과 같은 규칙)
function safeName(name) {
  const cleaned = name.replace(/[^A-Za-z0-9가-힣._-]/gu, '_').replace(/_+/g, '_');
  return cleaned.replace(/^[._-]+/, '') || 'image';
}

function slugify(name) {
  const base = basename(name, extname(name));
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'work';
}

function uniqueBy(db, column, table, value) {
  const stmt = db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ?`);
  let candidate = value;
  let n = 2;
  while (stmt.get(candidate)) candidate = `${value}-${n++}`;
  return candidate;
}

const db = openDb();

if (!existsSync(source)) {
  console.error(`가져올 폴더가 없습니다: ${source}`);
  console.error('--source 로 경로를 지정하거나 .env 의 ATELIER_SOURCE 를 고쳐 주십시오.');
  process.exit(1);
}

const files = walk(source);
console.log(`훑은 폴더 : ${source}`);
console.log(`찾은 이미지: ${files.length}개`);

const known = new Set(
  db.prepare('SELECT source_path FROM ingested').all().map((r) => r.source_path)
);

let added = 0;
let skipped = 0;

for (const file of files) {
  if (known.has(file)) { skipped += 1; continue; }

  const st = statSync(file);
  const { width, height, orientation } = imageSize(file);
  const target = uniqueBy(db, 'media_file', 'works', safeName(basename(file)));
  const slug = uniqueBy(db, 'slug', 'works', slugify(basename(file)));
  const now = new Date().toISOString();
  const createdAt = st.mtime.toISOString();

  if (dryRun) {
    console.log(`  [예정] ${basename(file)} -> ${slug} (${width}x${height} ${orientation})`);
    added += 1;
    continue;
  }

  copyFileSync(file, join(paths.mediaDir, target));
  db.prepare(
    `INSERT INTO works
       (slug, title, description, media_file, width, height, orientation, tags,
        published, sort_order, created_at, updated_at)
     VALUES (?, ?, '', ?, ?, ?, ?, '[]', 0, 0, ?, ?)`
  ).run(slug, basename(file, extname(file)), target, width, height, orientation, createdAt, now);
  db.prepare('INSERT INTO ingested (source_path, slug, ingested_at) VALUES (?, ?, ?)')
    .run(file, slug, now);

  console.log(`  [등록] ${basename(file)} -> ${slug} (${width}x${height} ${orientation})`);
  added += 1;
}

console.log('');
console.log(`새로 등록 ${added}개 · 이미 있던 것 ${skipped}개`);
if (!dryRun && added > 0) {
  console.log('');
  console.log('등록된 작품은 아직 "숨김" 상태입니다. 공개하려면:');
  console.log('  node admin.mjs list');
  console.log('  node admin.mjs title <슬러그> "작품 이름"');
  console.log('  node admin.mjs show <슬러그>');
}
