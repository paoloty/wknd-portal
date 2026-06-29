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
  CREATE TABLE IF NOT EXISTS player_financials (
    player_id         TEXT PRIMARY KEY,
    current_balance   REAL NOT NULL DEFAULT 0,
    total_paid        REAL NOT NULL DEFAULT 0,
    total_outstanding REAL NOT NULL DEFAULT 0,
    updated_at        INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS transaction_ledger (
    id             TEXT PRIMARY KEY,
    player_id      TEXT NOT NULL,
    amount         REAL NOT NULL,
    type           TEXT NOT NULL DEFAULT 'payment',
    payment_method TEXT NOT NULL DEFAULT '',
    date           TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    notes          TEXT NOT NULL DEFAULT '',
    reference_no   TEXT NOT NULL DEFAULT '',
    created_at     INTEGER NOT NULL
  )
`);
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN reference_no TEXT NOT NULL DEFAULT ''`); } catch(e) {}

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

// ── Financial ledger ──────────────────────────────────────────────────────────

const stmtGetFinancials    = db.prepare('SELECT * FROM player_financials WHERE player_id = ?');
const stmtAllFinancials    = db.prepare('SELECT * FROM player_financials');
const stmtUpsertFinancials = db.prepare(`
  INSERT INTO player_financials (player_id, current_balance, total_paid, total_outstanding, updated_at)
    VALUES (?, 0, 0, 0, ?)
  ON CONFLICT(player_id) DO NOTHING
`);
const stmtUpdateFinancials = db.prepare(`
  UPDATE player_financials
  SET current_balance = current_balance + ?,
      total_paid      = total_paid      + ?,
      total_outstanding = total_outstanding + ?,
      updated_at      = ?
  WHERE player_id = ?
`);
const stmtInsertTx      = db.prepare(`
  INSERT INTO transaction_ledger (id, player_id, amount, type, payment_method, date, status, notes, reference_no, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtTxByPlayer    = db.prepare('SELECT * FROM transaction_ledger WHERE player_id = ? ORDER BY date DESC, created_at DESC');
const stmtAllTx         = db.prepare('SELECT * FROM transaction_ledger ORDER BY date DESC, created_at DESC');
const stmtTxById        = db.prepare('SELECT * FROM transaction_ledger WHERE id = ?');
const stmtVoidTx        = db.prepare(`UPDATE transaction_ledger SET status = 'voided' WHERE id = ?`);
const stmtConfirmTx     = db.prepare(`UPDATE transaction_ledger SET status = 'confirmed' WHERE id = ? AND status = 'pending'`);

const recordTxTransaction = db.transaction(({ id, player_id, amount, type, payment_method, date, status, notes, reference_no = '' }) => {
  const now = Date.now();
  stmtUpsertFinancials.run(player_id, now);
  stmtInsertTx.run(id, player_id, amount, type, payment_method, date, status, notes, reference_no, now);
  if (status === 'confirmed') {
    const balanceDelta      = type === 'payment' ? -amount : amount;
    const paidDelta         = type === 'payment' ?  amount : 0;
    const outstandingDelta  = type === 'charge'  ?  amount : 0;
    stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, player_id);
  }
});

const confirmTxTransaction = db.transaction((id) => {
  const tx = stmtTxById.get(id);
  if (!tx || tx.status !== 'pending') return false;
  const result = stmtConfirmTx.run(id);
  if (!result.changes) return false;
  const now = Date.now();
  const balanceDelta     = tx.type === 'payment' ? -tx.amount : tx.amount;
  const paidDelta        = tx.type === 'payment' ?  tx.amount : 0;
  const outstandingDelta = tx.type === 'charge'  ?  tx.amount : 0;
  stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
  return true;
});

const voidTxTransaction = db.transaction((id) => {
  const tx = stmtTxById.get(id);
  if (!tx || tx.status !== 'confirmed') return false;
  const now = Date.now();
  stmtVoidTx.run(id);
  const balanceDelta     = tx.type === 'payment' ?  tx.amount : -tx.amount;
  const paidDelta        = tx.type === 'payment' ? -tx.amount : 0;
  const outstandingDelta = tx.type === 'charge'  ? -tx.amount : 0;
  stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
  return true;
});

export function getAllFinancials() {
  return Object.fromEntries(stmtAllFinancials.all().map(r => [r.player_id, r]));
}

export function getPlayerFinancials(playerId) {
  return stmtGetFinancials.get(playerId) ?? { player_id: playerId, current_balance: 0, total_paid: 0, total_outstanding: 0 };
}

export function getAllTransactions() {
  return stmtAllTx.all();
}

export function getPlayerTransactions(playerId) {
  return stmtTxByPlayer.all(playerId);
}

export function recordTransaction(data) {
  recordTxTransaction(data);
}

export function voidTransaction(id) {
  return voidTxTransaction(id);
}

export function confirmTransaction(id) {
  return confirmTxTransaction(id);
}
