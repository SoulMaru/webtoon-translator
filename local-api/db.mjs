import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const paths = {
  root: here,
  dbFile: process.env.ATELIER_DB ?? join(here, 'data', 'atelier.db'),
  mediaDir: process.env.ATELIER_MEDIA ?? join(here, 'media'),
};

let db = null;

export function openDb() {
  if (db) return db;
  mkdirSync(dirname(paths.dbFile), { recursive: true });
  mkdirSync(paths.mediaDir, { recursive: true });
  db = new DatabaseSync(paths.dbFile);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

const rowToWork = (r) => ({
  slug: r.slug,
  title: r.title,
  description: r.description,
  mediaFile: r.media_file,
  width: r.width,
  height: r.height,
  orientation: r.orientation,
  tags: safeTags(r.tags),
  createdAt: r.created_at,
});

function safeTags(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listWorks({ limit = 60, offset = 0 } = {}) {
  const d = openDb();
  const rows = d.prepare(
    `SELECT * FROM works WHERE published = 1
     ORDER BY sort_order DESC, created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).all(limit, offset);
  const { total } = d.prepare('SELECT COUNT(*) AS total FROM works WHERE published = 1').get();
  return { items: rows.map(rowToWork), total, limit, offset };
}

export function getWork(slug) {
  const row = openDb()
    .prepare('SELECT * FROM works WHERE slug = ? AND published = 1')
    .get(slug);
  return row ? rowToWork(row) : null;
}

export function getSettings() {
  const rows = openDb().prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function countWorks() {
  return openDb().prepare('SELECT COUNT(*) AS n FROM works').get().n;
}
