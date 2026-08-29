// 작품을 손보는 명령들.
//   node admin.mjs list                    전체 목록
//   node admin.mjs title <슬러그> "이름"     제목 바꾸기
//   node admin.mjs desc  <슬러그> "설명"     설명 바꾸기
//   node admin.mjs tags  <슬러그> 태그1,태그2  태그 바꾸기
//   node admin.mjs show  <슬러그>            공개
//   node admin.mjs hide  <슬러그>            숨김
//   node admin.mjs order <슬러그> <숫자>      정렬 순서 (클수록 앞)
//   node admin.mjs site  <항목> "값"         site_title / site_tagline / site_intro
//   node admin.mjs remove <슬러그>           목록에서 지움 (이미지 파일은 그대로 둠)
import { openDb } from './db.mjs';

const db = openDb();
const [cmd, ...rest] = process.argv.slice(2);
const now = () => new Date().toISOString();

function requireWork(slug) {
  const row = db.prepare('SELECT * FROM works WHERE slug = ?').get(slug);
  if (!row) {
    console.error(`그런 슬러그가 없습니다: ${slug}`);
    process.exit(1);
  }
  return row;
}

function update(slug, column, value) {
  requireWork(slug);
  db.prepare(`UPDATE works SET ${column} = ?, updated_at = ? WHERE slug = ?`)
    .run(value, now(), slug);
  console.log(`고쳤습니다 · ${slug} · ${column} = ${value}`);
}

switch (cmd) {
  case 'list': {
    const rows = db.prepare(
      'SELECT slug, title, published, sort_order, width, height, orientation FROM works ORDER BY sort_order DESC, created_at DESC'
    ).all();
    if (rows.length === 0) {
      console.log('등록된 작품이 없습니다. 먼저 node ingest.mjs 를 돌리십시오.');
      break;
    }
    console.log('공개  순서  크기            슬러그 / 제목');
    for (const r of rows) {
      const mark = r.published ? ' O  ' : ' -  ';
      const order = String(r.sort_order).padStart(5);
      const size = `${r.width}x${r.height}`.padEnd(14);
      console.log(`${mark}${order}  ${size}  ${r.slug}  ·  ${r.title}`);
    }
    console.log(`\n총 ${rows.length}개 (O = 홈페이지에 보임)`);
    break;
  }
  case 'title': update(rest[0], 'title', rest[1] ?? ''); break;
  case 'desc':  update(rest[0], 'description', rest[1] ?? ''); break;
  case 'tags': {
    const tags = (rest[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    update(rest[0], 'tags', JSON.stringify(tags));
    break;
  }
  case 'show':  update(rest[0], 'published', 1); break;
  case 'hide':  update(rest[0], 'published', 0); break;
  case 'order': update(rest[0], 'sort_order', Number(rest[1]) || 0); break;
  case 'site': {
    const key = rest[0];
    if (!['site_title', 'site_tagline', 'site_intro'].includes(key)) {
      console.error('site 항목은 site_title / site_tagline / site_intro 중 하나입니다.');
      process.exit(1);
    }
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, rest[1] ?? '');
    console.log(`고쳤습니다 · ${key} = ${rest[1]}`);
    break;
  }
  case 'remove': {
    requireWork(rest[0]);
    db.prepare('DELETE FROM works WHERE slug = ?').run(rest[0]);
    db.prepare('DELETE FROM ingested WHERE slug = ?').run(rest[0]);
    console.log(`목록에서 지웠습니다 · ${rest[0]} (media 폴더의 이미지 파일은 그대로 있습니다)`);
    break;
  }
  default:
    console.log(`쓰는 법:
  node admin.mjs list
  node admin.mjs title <슬러그> "이름"
  node admin.mjs desc  <슬러그> "설명"
  node admin.mjs tags  <슬러그> 태그1,태그2
  node admin.mjs show  <슬러그>
  node admin.mjs hide  <슬러그>
  node admin.mjs order <슬러그> <숫자>
  node admin.mjs site  site_title "새김AI"
  node admin.mjs remove <슬러그>`);
}
