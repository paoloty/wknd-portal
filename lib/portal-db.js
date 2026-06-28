import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'portal.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS leader_shares (
    id                 TEXT PRIMARY KEY,
    season             TEXT NOT NULL,
    category_id        TEXT NOT NULL,
    mode               TEXT NOT NULL,
    player_id          TEXT NOT NULL,
    player_name        TEXT NOT NULL,
    team_id            TEXT NOT NULL,
    team_name          TEXT NOT NULL,
    team_color         TEXT NOT NULL,
    stat_label         TEXT NOT NULL,
    stat_title         TEXT NOT NULL,
    stat_value         REAL NOT NULL,
    stat_fmt           TEXT NOT NULL,
    top10_json         TEXT NOT NULL DEFAULT '[]',
    player_picture_url TEXT NOT NULL DEFAULT '',
    created_at         INTEGER NOT NULL,
    UNIQUE(season, category_id, mode, player_id)
  )
`);

// Migrate existing tables that predate these columns
const cols = db.prepare('PRAGMA table_info(leader_shares)').all().map(c => c.name);
if (!cols.includes('top10_json'))         db.exec(`ALTER TABLE leader_shares ADD COLUMN top10_json TEXT NOT NULL DEFAULT '[]'`);
if (!cols.includes('player_picture_url')) db.exec(`ALTER TABLE leader_shares ADD COLUMN player_picture_url TEXT NOT NULL DEFAULT ''`);

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id           TEXT PRIMARY KEY,
    full_name    TEXT NOT NULL,
    email        TEXT NOT NULL,
    phone        TEXT NOT NULL DEFAULT '',
    player_id    TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending',
    notes        TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS entity_slugs (
    type       TEXT NOT NULL,
    entity_id  TEXT NOT NULL,
    slug       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (type, entity_id),
    UNIQUE (type, slug)
  )
`);

const stmtGetSlugForEntity = db.prepare('SELECT slug       FROM entity_slugs WHERE type=? AND entity_id=?');
const stmtGetEntityForSlug = db.prepare('SELECT entity_id  FROM entity_slugs WHERE type=? AND slug=?');
const stmtSaveSlug         = db.prepare('INSERT OR REPLACE INTO entity_slugs (type,entity_id,slug,created_at) VALUES (?,?,?,?)');

export function getSlugForEntity(type, entityId) {
  return stmtGetSlugForEntity.get(type, String(entityId))?.slug ?? null;
}

export function getEntityForSlug(type, slug) {
  return stmtGetEntityForSlug.get(type, slug)?.entity_id ?? null;
}

export function saveSlug(type, entityId, slug) {
  stmtSaveSlug.run(type, String(entityId), slug, Date.now());
}

const stmtByKey = db.prepare(
  'SELECT id FROM leader_shares WHERE season=? AND category_id=? AND mode=? AND player_id=?'
);
const stmtUpdate = db.prepare(`
  UPDATE leader_shares
  SET stat_value=?,stat_fmt=?,player_name=?,team_name=?,team_color=?,top10_json=?,player_picture_url=?
  WHERE id=?
`);
const stmtInsert = db.prepare(`
  INSERT INTO leader_shares
    (id,season,category_id,mode,player_id,player_name,team_id,team_name,team_color,
     stat_label,stat_title,stat_value,stat_fmt,top10_json,player_picture_url,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const stmtById = db.prepare('SELECT * FROM leader_shares WHERE id=?');

export function upsertShare(data) {
  const top10Json = JSON.stringify(data.top10 || []);
  const picUrl    = data.player_picture_url || '';
  const existing  = stmtByKey.get(data.season, data.category_id, data.mode, data.player_id);
  if (existing) {
    stmtUpdate.run(
      data.stat_value, data.stat_fmt, data.player_name,
      data.team_name, data.team_color, top10Json, picUrl,
      existing.id
    );
    return existing.id;
  }
  stmtInsert.run(
    data.id, data.season, data.category_id, data.mode, data.player_id,
    data.player_name, data.team_id, data.team_name, data.team_color,
    data.stat_label, data.stat_title, data.stat_value, data.stat_fmt,
    top10Json, picUrl, data.created_at
  );
  return data.id;
}

export function getShare(id) {
  return stmtById.get(id);
}

const stmtInsertReg = db.prepare(`
  INSERT INTO registrations (id, full_name, email, phone, player_id, status, notes, created_at)
  VALUES (?, ?, ?, ?, ?, 'pending', '', ?)
`);
const stmtAllRegs   = db.prepare('SELECT * FROM registrations ORDER BY created_at DESC');
const stmtUpdateReg = db.prepare('UPDATE registrations SET status=?, player_id=?, notes=? WHERE id=?');

export function insertRegistration({ id, full_name, email, phone = '', player_id = '' }) {
  stmtInsertReg.run(id, full_name, email, phone, player_id, Date.now());
}

export function getAllRegistrations() {
  return stmtAllRegs.all();
}

export function updateRegistration(id, { status, player_id = '', notes = '' }) {
  stmtUpdateReg.run(status, player_id, notes, id);
}
