import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'portal.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');

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

db.exec(`
  CREATE TABLE IF NOT EXISTS compare_cache (
    pair_key      TEXT PRIMARY KEY,
    stats_key     TEXT NOT NULL,
    writeup       TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    view_count    INTEGER NOT NULL DEFAULT 0,
    last_viewed_at INTEGER
  )
`);
const _cmpCols = db.prepare('PRAGMA table_info(compare_cache)').all().map(c => c.name);
if (!_cmpCols.includes('view_count'))     db.exec(`ALTER TABLE compare_cache ADD COLUMN view_count     INTEGER NOT NULL DEFAULT 0`);
if (!_cmpCols.includes('last_viewed_at')) db.exec(`ALTER TABLE compare_cache ADD COLUMN last_viewed_at INTEGER`);
if (!_cmpCols.includes('model'))          db.exec(`ALTER TABLE compare_cache ADD COLUMN model TEXT`);

// Migrate existing tables that predate these columns
const cols = db.prepare('PRAGMA table_info(leader_shares)').all().map(c => c.name);
if (!cols.includes('top10_json'))         db.exec(`ALTER TABLE leader_shares ADD COLUMN top10_json TEXT NOT NULL DEFAULT '[]'`);
if (!cols.includes('player_picture_url')) db.exec(`ALTER TABLE leader_shares ADD COLUMN player_picture_url TEXT NOT NULL DEFAULT ''`);

// Migrate player_ratings: add usage/usage_ovr columns (replacing athleticism)
const ratingCols = db.prepare('PRAGMA table_info(player_ratings)').all().map(c => c.name);
if (!ratingCols.includes('usage'))     db.exec(`ALTER TABLE player_ratings ADD COLUMN usage     INTEGER`);
if (!ratingCols.includes('usage_ovr')) db.exec(`ALTER TABLE player_ratings ADD COLUMN usage_ovr INTEGER`);

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
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN season     TEXT NOT NULL DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN category   TEXT NOT NULL DEFAULT ''`); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS season_quotas (
    season     TEXT PRIMARY KEY,
    amount     REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  )
`);

const stmtGetSetting = db.prepare('SELECT value FROM site_settings WHERE key=?');
const stmtSetSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,?)');

export function getSetting(key, defaultValue = null)   { return stmtGetSetting.get(key)?.value ?? defaultValue; }
export function setSetting(key, value)                 { stmtSetSetting.run(key, String(value), Date.now()); }

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
  INSERT INTO transaction_ledger (id, player_id, amount, type, payment_method, date, status, notes, reference_no, season, category, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtTxByPlayer       = db.prepare('SELECT * FROM transaction_ledger WHERE player_id = ? ORDER BY date DESC, created_at DESC');
const stmtTxByPlayerSeason = db.prepare('SELECT * FROM transaction_ledger WHERE player_id = ? AND season = ? ORDER BY date DESC, created_at DESC');
const stmtAllTx            = db.prepare('SELECT * FROM transaction_ledger ORDER BY date DESC, created_at DESC');
const stmtAllTxBySeason    = db.prepare('SELECT * FROM transaction_ledger WHERE season = ? ORDER BY date DESC, created_at DESC');
const stmtTxById           = db.prepare('SELECT * FROM transaction_ledger WHERE id = ?');
const stmtVoidTx           = db.prepare(`UPDATE transaction_ledger SET status = 'voided' WHERE id = ?`);
const stmtConfirmTx        = db.prepare(`UPDATE transaction_ledger SET status = 'confirmed' WHERE id = ? AND status = 'pending'`);
const stmtDeleteTx         = db.prepare(`DELETE FROM transaction_ledger WHERE id = ?`);
const stmtSeasonBalances   = db.prepare(`
  SELECT player_id,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS balance,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  WHERE season = ?
  GROUP BY player_id
`);
const stmtSeasonSummary    = db.prepare(`
  SELECT
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS total_charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_outstanding,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  WHERE season = ?
`);
const stmtAllBalances      = db.prepare(`
  SELECT player_id,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS balance,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  GROUP BY player_id
`);
const stmtAllSummary       = db.prepare(`
  SELECT
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS total_charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_outstanding,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
`);
const stmtGetQuota         = db.prepare('SELECT amount FROM season_quotas WHERE season = ?');
const stmtSetQuota         = db.prepare('INSERT OR REPLACE INTO season_quotas (season, amount, created_at) VALUES (?, ?, ?)');
const stmtAllSeasons       = db.prepare(`SELECT DISTINCT season FROM transaction_ledger WHERE season != '' ORDER BY season DESC`);
const stmtPendingTx        = db.prepare(`
  SELECT tl.*, p.name AS player_name, p.team_id
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  WHERE tl.status = 'pending'
  ORDER BY tl.date DESC, tl.created_at DESC
`);
const stmtCategoryTotals   = db.prepare(`
  SELECT category,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged
  FROM transaction_ledger
  WHERE season = ?
  GROUP BY category
  ORDER BY charged DESC
`);
const stmtTeamTotals       = db.prepare(`
  SELECT t.name AS team_name, t.color AS team_color,
    SUM(CASE WHEN tl.type='charge'  AND tl.status='confirmed' THEN tl.amount ELSE 0 END) -
    SUM(CASE WHEN tl.type='payment' AND tl.status='confirmed' THEN tl.amount ELSE 0 END) AS outstanding
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE tl.season = ?
  GROUP BY t.id
  ORDER BY outstanding DESC
`);
const stmtRecentTx         = db.prepare(`
  SELECT tl.*, p.name AS player_name
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  ORDER BY tl.created_at DESC
  LIMIT 10
`);

const recordTxTransaction = db.transaction(({ id, player_id, amount, type, payment_method, date, status, notes, reference_no = '', season = '', category = '' }) => {
  const now = Date.now();
  stmtUpsertFinancials.run(player_id, now);
  stmtInsertTx.run(id, player_id, amount, type, payment_method, date, status, notes, reference_no, season, category, now);
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

export function getAllTransactions()                    { return stmtAllTx.all(); }
export function getPendingTransactions()               { return stmtPendingTx.all(); }
export function getCategoryTotals(season)              { return stmtCategoryTotals.all(season); }
export function getTeamTotals(season)                  { return stmtTeamTotals.all(season); }
export function getRecentTransactions()                { return stmtRecentTx.all(); }
export function getAllTransactionsBySeason(season)      { return stmtAllTxBySeason.all(season); }
export function getPlayerTransactions(playerId)        { return stmtTxByPlayer.all(playerId); }
export function getPlayerTransactionsBySeason(playerId, season) { return stmtTxByPlayerSeason.all(playerId, season); }
export function getSeasonBalances(season)              { return stmtSeasonBalances.all(season); }
export function getSeasonSummary(season)               { return stmtSeasonSummary.get(season) ?? {}; }
export function getAllBalances()                        { return stmtAllBalances.all(); }
export function getAllSummary()                         { return stmtAllSummary.get() ?? {}; }
export function getLedgerSeasons()                     { return stmtAllSeasons.all().map(r => r.season); }
export function getSeasonQuota(season)                 { return stmtGetQuota.get(season)?.amount ?? 0; }
export function setSeasonQuota(season, amount)         { stmtSetQuota.run(season, amount, Date.now()); }
export function recordTransaction(data)                { recordTxTransaction(data); }
export function voidTransaction(id)                    { return voidTxTransaction(id); }
export function confirmTransaction(id)                 { return confirmTxTransaction(id); }

export function deleteTransaction(id) {
  const tx = stmtTxById.get(id);
  if (!tx) return false;
  db.transaction(() => {
    if (tx.status === 'confirmed') {
      const now = Date.now();
      const balanceDelta     = tx.type === 'payment' ?  tx.amount : -tx.amount;
      const paidDelta        = tx.type === 'payment' ? -tx.amount : 0;
      const outstandingDelta = tx.type === 'charge'  ? -tx.amount : 0;
      stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
    }
    stmtDeleteTx.run(id);
  })();
  return true;
}

// ── Basketball data tables (migrated from wknd-stats.db) ─────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS seasons (
    id         TEXT PRIMARY KEY,
    number     INTEGER NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    year       INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL DEFAULT '',
    end_date   TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL DEFAULT '',
    first_name  TEXT NOT NULL DEFAULT '',
    last_name   TEXT NOT NULL DEFAULT '',
    name        TEXT GENERATED ALWAYS AS (last_name || ', ' || first_name) STORED,
    number      TEXT NOT NULL DEFAULT '',
    positions   TEXT NOT NULL DEFAULT '[]',
    picture_url TEXT NOT NULL DEFAULT '',
    birthday    TEXT NOT NULL DEFAULT '',
    writeup     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    sort_order  INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_details (
    player_id        TEXT PRIMARY KEY,
    height            TEXT NOT NULL DEFAULT '',
    weight            TEXT NOT NULL DEFAULT '',
    hometown          TEXT NOT NULL DEFAULT '',
    school            TEXT NOT NULL DEFAULT '',
    nickname          TEXT NOT NULL DEFAULT '',
    wingspan          TEXT NOT NULL DEFAULT '',
    dominant_hand     TEXT NOT NULL DEFAULT '',
    years_playing     TEXT NOT NULL DEFAULT '',
    social_instagram  TEXT NOT NULL DEFAULT '',
    social_twitter    TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_positions (
    player_id  TEXT NOT NULL,
    position   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, position)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS game_dnp (
    game_id   TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (game_id, player_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_totals (
    player_id    TEXT NOT NULL,
    season       INTEGER NOT NULL DEFAULT 3,
    games_played INTEGER NOT NULL DEFAULT 0,
    pts          INTEGER NOT NULL DEFAULT 0,
    ast          INTEGER NOT NULL DEFAULT 0,
    reb          INTEGER NOT NULL DEFAULT 0,
    stl          INTEGER NOT NULL DEFAULT 0,
    blk          INTEGER NOT NULL DEFAULT 0,
    turnover     INTEGER NOT NULL DEFAULT 0,
    pf           INTEGER NOT NULL DEFAULT 0,
    fg2m         INTEGER NOT NULL DEFAULT 0,
    fg3m         INTEGER NOT NULL DEFAULT 0,
    fg2m_miss    INTEGER NOT NULL DEFAULT 0,
    fg3m_miss    INTEGER NOT NULL DEFAULT 0,
    ftm          INTEGER NOT NULL DEFAULT 0,
    ft_miss      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, season)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_ratings (
    player_id       TEXT NOT NULL,
    season          TEXT NOT NULL,
    scoring         INTEGER,
    shooting        INTEGER,
    rebounding      INTEGER,
    playmaking      INTEGER,
    defense         INTEGER,
    iq              INTEGER,
    athleticism     INTEGER,
    overall         INTEGER,
    scoring_ovr     INTEGER,
    shooting_ovr    INTEGER,
    rebounding_ovr  INTEGER,
    playmaking_ovr  INTEGER,
    defense_ovr     INTEGER,
    iq_ovr          INTEGER,
    athleticism_ovr INTEGER,
    overall_ovr     INTEGER,
    locked          INTEGER NOT NULL DEFAULT 0,
    computed_at     INTEGER,
    updated_at      INTEGER,
    PRIMARY KEY (player_id, season)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id                    TEXT PRIMARY KEY,
    season                INTEGER NOT NULL DEFAULT 3,
    date                  TEXT NOT NULL DEFAULT '',
    game_type             TEXT NOT NULL DEFAULT 'regular',
    playoff_round         TEXT NOT NULL DEFAULT '',
    series_id             TEXT NOT NULL DEFAULT '',
    team_a_id             TEXT NOT NULL DEFAULT '',
    team_b_id             TEXT NOT NULL DEFAULT '',
    team_a_name           TEXT NOT NULL DEFAULT '',
    team_b_name           TEXT NOT NULL DEFAULT '',
    team_a_score          INTEGER NOT NULL DEFAULT 0,
    team_b_score          INTEGER NOT NULL DEFAULT 0,
    scheduled             INTEGER NOT NULL DEFAULT 0,
    under_review          INTEGER NOT NULL DEFAULT 0,
    game_writeup          TEXT NOT NULL DEFAULT '',
    potg_writeup          TEXT NOT NULL DEFAULT '',
    manual_potg_player_id TEXT NOT NULL DEFAULT '',
    youtube_url           TEXT NOT NULL DEFAULT '',
    period_snapshots_json TEXT NOT NULL DEFAULT '[]',
    dnp_players_json      TEXT NOT NULL DEFAULT '[]',
    game_log_json         TEXT NOT NULL DEFAULT '[]',
    social_cover_data_url TEXT NOT NULL DEFAULT '',
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'complete',
    overtime              INTEGER NOT NULL DEFAULT 0
  )
`);

// Migrate pre-status / pre-has_cover games
const _gamesCols = db.prepare('PRAGMA table_info(games)').all().map(c => c.name);
if (!_gamesCols.includes('overtime')) db.exec(`ALTER TABLE games ADD COLUMN overtime INTEGER NOT NULL DEFAULT 0`);
if (!_gamesCols.includes('status')) {
  db.exec(`ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'`);
  db.exec(`UPDATE games SET status = 'scheduled' WHERE scheduled = 1`);
  // under_review=1 games are drafts (have box scores) — keep status='complete'
  // only existing regular complete games keep default 'complete'
}
// Fix incorrect migration: under_review=1 games should be 'complete', not 'final'
db.exec(`UPDATE games SET status = 'complete' WHERE status = 'final' AND under_review = 1`);
if (!_gamesCols.includes('has_cover')) {
  db.exec(`ALTER TABLE games ADD COLUMN has_cover INTEGER NOT NULL DEFAULT 0`);
  db.exec(`UPDATE games SET has_cover = 1 WHERE LENGTH(social_cover_data_url) > 0`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS game_player_stats (
    game_id   TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team_id   TEXT NOT NULL DEFAULT '',
    pts       INTEGER NOT NULL DEFAULT 0,
    ast       INTEGER NOT NULL DEFAULT 0,
    reb       INTEGER NOT NULL DEFAULT 0,
    stl       INTEGER NOT NULL DEFAULT 0,
    blk       INTEGER NOT NULL DEFAULT 0,
    turnover  INTEGER NOT NULL DEFAULT 0,
    pf        INTEGER NOT NULL DEFAULT 0,
    fg2m      INTEGER NOT NULL DEFAULT 0,
    fg3m      INTEGER NOT NULL DEFAULT 0,
    fg2m_miss INTEGER NOT NULL DEFAULT 0,
    fg3m_miss INTEGER NOT NULL DEFAULT 0,
    ftm       INTEGER NOT NULL DEFAULT 0,
    ft_miss   INTEGER NOT NULL DEFAULT 0,
    minutes   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (game_id, player_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS awards (
    id         TEXT PRIMARY KEY,
    season     INTEGER NOT NULL DEFAULT 3,
    award_type TEXT NOT NULL,
    player_id  TEXT NOT NULL DEFAULT '',
    team_id    TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

// ── Basketball query functions ────────────────────────────────────────────────

const stmtGetTeams = db.prepare(
  'SELECT id, name, color FROM teams ORDER BY sort_order ASC, id ASC'
);

const stmtGetPlayers = db.prepare(`
  SELECT p.id, p.team_id, p.first_name, p.last_name, p.name, p.number,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions,
         p.picture_url, p.birthday, p.writeup, p.status, p.sort_order,
         COALESCE(t.games_played, 0) AS games_played,
         COALESCE(t.pts, 0) AS pts,
         COALESCE(t.ast, 0) AS ast,
         COALESCE(t.reb, 0) AS reb,
         COALESCE(t.stl, 0) AS stl,
         COALESCE(t.blk, 0) AS blk,
         COALESCE(t.fg2m, 0) AS fg2m,
         COALESCE(t.fg3m, 0) AS fg3m,
         COALESCE(t.fg2m_miss, 0) AS fg2m_miss,
         COALESCE(t.fg3m_miss, 0) AS fg3m_miss,
         COALESCE(t.ftm, 0) AS ftm,
         COALESCE(t.ft_miss, 0) AS ft_miss,
         COALESCE(t.turnover, 0) AS turnover,
         COALESCE(t.pf, 0) AS pf,
         tm.name AS team_name, tm.color AS team_color
  FROM players p
  LEFT JOIN player_totals t ON t.player_id = p.id
    AND t.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
  LEFT JOIN teams tm ON tm.id = p.team_id
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetGames = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, series_id, youtube_url, scheduled, status, overtime,
         has_cover
  FROM games
  ORDER BY date DESC, id DESC
`);

const stmtGetGameCover = db.prepare(
  'SELECT social_cover_data_url FROM games WHERE id = ?'
);

const stmtGetTeamSeasonStats = db.prepare(`
  SELECT gps.team_id, t.name AS team_name,
         COUNT(DISTINCT gps.game_id)                                             AS gp,
         COALESCE(SUM(gps.pts), 0)                                               AS pts,
         COALESCE(SUM(gps.reb), 0)                                               AS reb,
         COALESCE(SUM(gps.ast), 0)                                               AS ast,
         COALESCE(SUM(gps.stl), 0)                                               AS stl,
         COALESCE(SUM(gps.blk), 0)                                               AS blk,
         COALESCE(SUM(gps.fg3m), 0)                                              AS fg3m,
         COALESCE(SUM(gps.fg2m + gps.fg3m), 0)                                  AS fgm,
         COALESCE(SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss), 0) AS fga,
         COALESCE(SUM(gps.fg3m + gps.fg3m_miss), 0)                             AS fg3a,
         COALESCE(SUM(gps.ftm), 0)                                               AS ftm,
         COALESCE(SUM(gps.ft_miss), 0)                                           AS ft_miss,
         COALESCE(SUM(gps.turnover), 0)                                          AS turnover,
         COALESCE(SUM(gps.pf), 0)                                                AS pf
  FROM game_player_stats gps
  JOIN teams t ON t.id = gps.team_id
  JOIN games g  ON g.id = gps.game_id
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
    AND g.game_type = 'regular' AND g.status = 'complete'
  GROUP BY gps.team_id, t.name
  ORDER BY t.sort_order ASC
`);

const stmtGetTeamRecords = db.prepare(`
  SELECT team_id,
         SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
  FROM (
    SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status = 'complete' AND under_review = 0)
      AND game_type = 'regular' AND status = 'complete' AND under_review = 0
    UNION ALL
    SELECT team_b_id, team_b_score, team_a_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status = 'complete' AND under_review = 0)
      AND game_type = 'regular' AND status = 'complete' AND under_review = 0
  )
  GROUP BY team_id
`);

const stmtGetLeaders = db.prepare(`
  SELECT p.id, p.name, p.team_id, p.picture_url,
         tm.name AS team_name,
         COUNT(DISTINCT gps.game_id)       AS games_played,
         COALESCE(SUM(gps.pts), 0)         AS pts,
         COALESCE(SUM(gps.ast), 0)         AS ast,
         COALESCE(SUM(gps.reb), 0)         AS reb,
         COALESCE(SUM(gps.stl), 0)         AS stl,
         COALESCE(SUM(gps.blk), 0)         AS blk,
         COALESCE(SUM(gps.turnover), 0)    AS turnover,
         COALESCE(SUM(gps.pf), 0)          AS pf,
         COALESCE(SUM(gps.fg2m), 0)        AS fg2m,
         COALESCE(SUM(gps.fg3m), 0)        AS fg3m,
         COALESCE(SUM(gps.fg2m_miss), 0)   AS fg2m_miss,
         COALESCE(SUM(gps.fg3m_miss), 0)   AS fg3m_miss,
         COALESCE(SUM(gps.ftm), 0)         AS ftm,
         COALESCE(SUM(gps.ft_miss), 0)     AS ft_miss
  FROM players p
  JOIN teams tm ON tm.id = p.team_id
  JOIN game_player_stats gps ON gps.player_id = p.id
  JOIN games g ON g.id = gps.game_id
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
    AND g.game_type = 'regular'
    AND g.status = 'complete'
  GROUP BY p.id, p.name, p.team_id, tm.name
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetGameRecords = db.prepare(`
  SELECT
    p.id AS player_id, p.name, p.team_id, p.picture_url,
    t.name AS team_name,
    gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
    gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss,
    gps.ftm, gps.ft_miss, gps.turnover, gps.pf,
    g.id AS game_id, g.date, g.season, g.game_type,
    g.team_a_id, g.team_a_name, g.team_a_score,
    g.team_b_id, g.team_b_name, g.team_b_score
  FROM game_player_stats gps
  JOIN players p ON p.id = gps.player_id
  JOIN teams t ON t.id = p.team_id
  JOIN games g ON g.id = gps.game_id
  WHERE g.under_review = 0
  ORDER BY g.sort_order DESC, g.id DESC
`);

const stmtGetGameById = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, scheduled, season, game_type,
         playoff_round, youtube_url, period_snapshots_json, dnp_players_json, game_log_json,
         status, overtime,
         has_cover
  FROM games WHERE id = ?
`);

const stmtGetGameDetailStats = db.prepare(`
  SELECT gps.player_id, gps.team_id,
         gps.pts, gps.ast, gps.reb, gps.stl, gps.blk, gps.turnover, gps.pf,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss, gps.minutes,
         p.name, p.number, p.picture_url,
         t.name AS team_name, t.color AS team_color
  FROM game_player_stats gps
  JOIN players p ON p.id = gps.player_id
  JOIN teams t ON t.id = gps.team_id
  WHERE gps.game_id = ?
  ORDER BY gps.pts DESC
`);

const stmtGetGameStats = db.prepare(`
  SELECT player_id, team_id, pts, ast, reb, stl, blk, turnover,
         fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes
  FROM game_player_stats
  WHERE game_id = ?
  ORDER BY pts DESC
`);

const stmtGetPlayerWithTeam = db.prepare(`
  SELECT p.*, t.name AS team_name,
         d.height, d.weight, d.hometown, d.school, d.nickname,
         d.wingspan, d.dominant_hand, d.years_playing,
         d.social_instagram, d.social_twitter
  FROM players p
  LEFT JOIN teams t ON t.id = p.team_id
  LEFT JOIN player_details d ON d.player_id = p.id
  WHERE p.id = ?
`);

const stmtGetPlayerById    = db.prepare('SELECT * FROM players WHERE id = ?');
const stmtGetTeamById      = db.prepare('SELECT * FROM teams WHERE id = ?');
const stmtGetPlayerPhoto   = db.prepare('SELECT picture_url FROM players WHERE id = ?');
const stmtUpdatePlayerPhoto = db.prepare('UPDATE players SET picture_url = ? WHERE id = ?');
const stmtGetCurrentSeason = db.prepare(
  `SELECT MAX(season) AS season FROM games WHERE game_type = 'regular' AND status IN ('final','complete')`
);

const stmtGetSeasonLatestWeek = db.prepare(
  `SELECT (COUNT(*) + 1) / 2 AS week FROM games WHERE season = ? AND game_type = 'regular' AND status IN ('final','complete') AND date <= date('now')`
);

const stmtGetPlayerTotals = db.prepare(
  'SELECT * FROM player_totals WHERE player_id = ? ORDER BY season DESC LIMIT 1'
);

const stmtGetPlayerGameLog = db.prepare(`
  SELECT g.id, g.date, g.season, g.game_type,
         g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score,
         g.manual_potg_player_id,
         CASE WHEN gps.player_id IS NOT NULL THEN 'played' ELSE 'dnp' END AS status,
         COALESCE(gps.team_id, p.team_id) AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss,
         gps.ftm, gps.ft_miss, gps.turnover, gps.pf
  FROM games g
  JOIN players p ON p.id = ?
  LEFT JOIN game_player_stats gps ON gps.game_id = g.id AND gps.player_id = p.id
  LEFT JOIN game_dnp d ON d.game_id = g.id AND d.player_id = p.id
  WHERE g.status = 'complete'
    AND (gps.player_id IS NOT NULL OR d.player_id IS NOT NULL)
  ORDER BY g.date DESC, g.id DESC
`);

const stmtGetPlayerPotgCandidates = db.prepare(`
  SELECT g.id, g.date, g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score, g.potg_writeup,
         g.manual_potg_player_id,
         gps.team_id AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss
  FROM games g
  JOIN game_player_stats gps ON gps.game_id = g.id AND gps.player_id = @id
  WHERE g.status = 'complete'
    AND g.potg_writeup IS NOT NULL AND g.potg_writeup != ''
  ORDER BY g.id DESC
`);

const stmtGetPlayerCareerHighs = db.prepare(`
  SELECT MAX(pts) AS pts, MAX(reb) AS reb, MAX(ast) AS ast,
         MAX(stl) AS stl, MAX(blk) AS blk, MAX(fg3m) AS fg3m
  FROM game_player_stats WHERE player_id = ?
`);

const stmtGetPlayerAwards = db.prepare(
  'SELECT * FROM awards WHERE player_id = ? ORDER BY season DESC'
);

const stmtGetGameDnpPlayers = db.prepare(`
  SELECT p.id, p.name, p.team_id, t.name AS team_name
  FROM game_dnp d
  JOIN players p ON p.id = d.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE d.game_id = ?
  ORDER BY t.sort_order, p.sort_order
`);

const stmtUpdateGameRecap   = db.prepare('UPDATE games SET game_writeup = ? WHERE id = ?');
const stmtUpdateGameYoutube = db.prepare('UPDATE games SET youtube_url = ? WHERE id = ?');
const stmtUpdateGameCover   = db.prepare('UPDATE games SET social_cover_data_url = ?, has_cover = (CASE WHEN LENGTH(?) > 0 THEN 1 ELSE 0 END) WHERE id = ?');
const stmtUpdateGamePotg    = db.prepare('UPDATE games SET potg_writeup = ?, manual_potg_player_id = ? WHERE id = ?');
const stmtUpdateGameReview  = db.prepare('UPDATE games SET under_review = ? WHERE id = ?');
const stmtUpdateGameAll     = db.prepare(`
  UPDATE games
  SET game_writeup=?, potg_writeup=?, manual_potg_player_id=?, youtube_url=?, under_review=?, date=?
  WHERE id=?
`);

export function updateGameRecap(id, writeup)        { stmtUpdateGameRecap.run(writeup, id); }
export function updateGameYoutube(id, url)          { stmtUpdateGameYoutube.run(url, id); }
export function updateGameCover(id, dataUrl)        { stmtUpdateGameCover.run(dataUrl, dataUrl, id); }
export function updateGamePotg(id, writeup, player) { stmtUpdateGamePotg.run(String(writeup || ''), String(player || ''), id); }
export function updateGameReview(id, flag)          { stmtUpdateGameReview.run(flag ? 1 : 0, id); }
const stmtDeleteGameStats = db.prepare('DELETE FROM game_player_stats WHERE game_id = ?');
const stmtDeleteGameDnp   = db.prepare('DELETE FROM game_dnp WHERE game_id = ?');
const stmtDeleteGame      = db.prepare('DELETE FROM games WHERE id = ?');

export function deleteGame(id) {
  const game = db.prepare('SELECT season FROM games WHERE id = ?').get(id);
  stmtDeleteGameStats.run(id);
  stmtDeleteGameDnp.run(id);
  stmtDeleteGame.run(id);
  recomputePlayerTotals(game?.season ?? null);
}

const stmtCreateGame = db.prepare(`
  INSERT INTO games (id, date, team_a_id, team_b_id, team_a_name, team_b_name,
    team_a_score, team_b_score, season, game_type, scheduled, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, 0)
`);
export function createGame({ date, teamAId, teamBId, season, gameType }) {
  const teamA = stmtGetTeamById.get(teamAId);
  const teamB = stmtGetTeamById.get(teamBId);
  if (!teamA || !teamB) throw new Error('Invalid team IDs');
  if (teamAId === teamBId) throw new Error('Teams must be different');
  const id = `game_sched_${Date.now()}`;
  stmtCreateGame.run(id, date, teamAId, teamBId, teamA.name, teamB.name, Number(season), gameType || 'regular');
  return id;
}

const stmtMarkFinal = db.prepare(`
  UPDATE games
  SET team_a_score=?, team_b_score=?, scheduled=0, under_review=0,
      status='final', overtime=?
  WHERE id=?
`);
const stmtSetOvertime = db.prepare(`UPDATE games SET overtime=? WHERE id=?`);

const stmtImportScores = db.prepare(`
  UPDATE games
  SET team_a_score=?, team_b_score=?, scheduled=0, under_review=0,
      status='complete', overtime=?,
      period_snapshots_json=?, game_log_json=?
  WHERE id=?
`);
const stmtInsertGameStat = db.prepare(`
  INSERT OR REPLACE INTO game_player_stats
    (game_id, player_id, team_id, pts, ast, reb, stl, blk, turnover, pf,
     fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes)
  VALUES
    (@game_id,@player_id,@team_id,@pts,@ast,@reb,@stl,@blk,@turnover,@pf,
     @fg2m,@fg3m,@fg2m_miss,@fg3m_miss,@ftm,@ft_miss,@minutes)
`);
const stmtInsertDnp      = db.prepare('INSERT OR IGNORE INTO game_dnp (game_id, player_id) VALUES (?,?)');
const stmtGetPlayerTeam  = db.prepare('SELECT team_id FROM players WHERE id = ?');

export function markGameFinal(gameId, { teamAScore, teamBScore, overtime = 0 }) {
  stmtMarkFinal.run(Number(teamAScore), Number(teamBScore), Number(overtime) || 0, gameId);
}
export function setGameOvertime(gameId, overtime) {
  stmtSetOvertime.run(Number(overtime) || 0, gameId);
}

export function importGameResults(gameId, { teamAScore, teamBScore, periodSnapshots, gameLog, dnpPlayerIds, playerStats, season }) {
  const otCount = Math.max(0, (periodSnapshots || []).length - 4);
  const t1 = Date.now();
  db.transaction(() => {
    stmtDeleteGameStats.run(gameId);
    stmtDeleteGameDnp.run(gameId);
    stmtImportScores.run(
      Number(teamAScore), Number(teamBScore),
      otCount,
      JSON.stringify(periodSnapshots || []),
      JSON.stringify(Array.isArray(gameLog) ? gameLog : []),
      gameId
    );
    for (const [playerId, s] of Object.entries(playerStats || {})) {
      const row = stmtGetPlayerTeam.get(playerId);
      stmtInsertGameStat.run({
        game_id: gameId, player_id: playerId, team_id: row?.team_id || '',
        pts: s.pts|0, ast: s.ast|0, reb: s.reb|0, stl: s.stl|0, blk: s.blk|0,
        turnover: s.to|0, pf: s.pf|0,
        fg2m: s.fg2m|0, fg3m: s.fg3m|0,
        fg2m_miss: s.fg2m_miss|0, fg3m_miss: s.fg3m_miss|0,
        ftm: s.ftm|0, ft_miss: s.ft_miss|0,
        minutes: String(s.min || ''),
      });
    }
    for (const pid of (dnpPlayerIds || [])) {
      if (pid) stmtInsertDnp.run(gameId, pid);
    }
  })();
  console.log(`[importGameResults] transaction=${Date.now() - t1}ms`);
  const t2 = Date.now();
  recomputePlayerTotals(season);
  console.log(`[importGameResults] recomputePlayerTotals=${Date.now() - t2}ms`);
}

export function updateGameAll(id, { game_writeup, potg_writeup, manual_potg_player_id, youtube_url, under_review, date }) {
  stmtUpdateGameAll.run(
    String(game_writeup || ''),
    String(potg_writeup || ''),
    String(manual_potg_player_id || ''),
    String(youtube_url || ''),
    under_review ? 1 : 0,
    String(date || ''),
    id
  );
}

const stmtGetTickerGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, team_a_score, team_b_score, game_type, scheduled,
         period_snapshots_json, overtime, status
  FROM games
  WHERE status IN ('scheduled','final','complete')
  ORDER BY date DESC, id DESC
  LIMIT 14
`);

const stmtRecentPlayedGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, team_a_score, team_b_score,
         game_type, season, under_review, status
  FROM games
  WHERE status IN ('final','complete')
  ORDER BY date DESC, id DESC
  LIMIT 5
`);
const stmtScheduledGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, game_type, season
  FROM games
  WHERE scheduled = 1
  ORDER BY date ASC, id ASC
  LIMIT 3
`);
const stmtGamesUnderReview = db.prepare(
  `SELECT COUNT(*) AS n FROM games WHERE under_review = 1`
);
const stmtCountActivePlayers = db.prepare(
  `SELECT COUNT(*) AS n FROM players WHERE status != 'inactive'`
);
const stmtCountPlayedGames = db.prepare(
  `SELECT COUNT(*) AS n FROM games WHERE status IN ('final','complete')`
);

export function getRecentPlayedGames()               { return stmtRecentPlayedGames.all(); }
export function getScheduledGames()                  { return stmtScheduledGames.all(); }
export function getGamesUnderReviewCount()           { return stmtGamesUnderReview.get()?.n ?? 0; }
// markGameFinal and setGameOvertime are exported alongside importGameResults above
export function getActivePlayerCount()               { return stmtCountActivePlayers.get()?.n ?? 0; }
export function getPlayedGamesCount()                { return stmtCountPlayedGames.get()?.n ?? 0; }
export function getTickerGames()                     { return stmtGetTickerGames.all(); }
export function getGameRecords()                     { return stmtGetGameRecords.all(); }
export function getAllTeams()                        { return stmtGetTeams.all(); }
export function getAllPlayers()                      { return stmtGetPlayers.all(); }
export function getAllGames()                        { return stmtGetGames.all(); }
export function getGameCover(id)                    { return stmtGetGameCover.get(id); }
export function getTeamSeasonStats()                { return stmtGetTeamSeasonStats.all(); }
export function getTeamRecords()                    { return stmtGetTeamRecords.all(); }
export function getLeaders()                        { return stmtGetLeaders.all(); }
export function getGameById(id)                     { return stmtGetGameById.get(id); }
export function getGameDetailStats(gameId)          { return stmtGetGameDetailStats.all(gameId); }
export function getGameStats(gameId)                { return stmtGetGameStats.all(gameId); }
export function getPlayerWithTeam(id)               { return stmtGetPlayerWithTeam.get(id); }
export function getPlayerById(id)                   { return stmtGetPlayerById.get(id); }
export function getTeamById(id)                     { return stmtGetTeamById.get(id); }
export function getPlayerTotals(playerId)           { return stmtGetPlayerTotals.get(playerId); }
export function getPlayerGameLog(playerId)          { return stmtGetPlayerGameLog.all(playerId); }
export function getPlayerPotgCandidates(id)         { return stmtGetPlayerPotgCandidates.all({ id }); }
export function getPlayerCareerHighs(playerId)      { return stmtGetPlayerCareerHighs.get(playerId); }
export function getPlayerAwards(playerId)           { return stmtGetPlayerAwards.all(playerId); }
export function getGameDnpPlayers(gameId)           { return stmtGetGameDnpPlayers.all(gameId); }
export function getPlayerPhoto(id)                  { return stmtGetPlayerPhoto.get(id); }
export function updatePlayerPhoto(id, dataUrl)      { stmtUpdatePlayerPhoto.run(dataUrl, id); }

const stmtUpdatePlayer = db.prepare(
  `UPDATE players SET first_name=?, last_name=?, number=?, positions=?, status=? WHERE id=?`
);
export function updatePlayer(id, { first_name, last_name, number, positions, status }) {
  stmtUpdatePlayer.run(
    String(first_name || '').trim(),
    String(last_name || '').trim(),
    String(number || '').trim(),
    JSON.stringify(Array.isArray(positions) ? positions : []),
    ['active','inactive'].includes(status) ? status : 'active',
    id
  );
}
export function getCurrentSeason()                  { return stmtGetCurrentSeason.get(); }
export function getSeasonLatestWeek(season)         { return stmtGetSeasonLatestWeek.get(season); }

// ── Player ratings ────────────────────────────────────────────────────────────
const stmtGetGameSeasons = db.prepare(
  `SELECT DISTINCT CAST(season AS TEXT) AS season FROM games WHERE season IS NOT NULL ORDER BY season DESC`
);
export function getGameSeasons() { return stmtGetGameSeasons.all().map(r => r.season); }

const stmtGetPlayersWithRatings = db.prepare(`
  SELECT p.id, p.name, p.number, p.status, p.sort_order,
         t.name AS team_name, t.color AS team_color,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions,
         r.scoring, r.shooting, r.rebounding, r.playmaking, r.defense, r.iq, r.usage, r.overall,
         r.scoring_ovr, r.shooting_ovr, r.rebounding_ovr, r.playmaking_ovr,
         r.defense_ovr, r.iq_ovr, r.usage_ovr, r.overall_ovr,
         r.locked, r.computed_at,
         COALESCE(r.overall_ovr, r.overall)       AS eff_overall,
         COALESCE(r.scoring_ovr, r.scoring)       AS eff_scoring,
         COALESCE(r.shooting_ovr, r.shooting)     AS eff_shooting,
         COALESCE(r.rebounding_ovr, r.rebounding) AS eff_rebounding,
         COALESCE(r.playmaking_ovr, r.playmaking) AS eff_playmaking,
         COALESCE(r.defense_ovr, r.defense)       AS eff_defense,
         COALESCE(r.iq_ovr, r.iq)                 AS eff_iq,
         COALESCE(r.usage_ovr, r.usage)           AS eff_usage
  FROM players p
  LEFT JOIN teams t ON t.id = p.team_id
  LEFT JOIN player_ratings r ON r.player_id = p.id AND r.season = ?
  ORDER BY p.status ASC, COALESCE(r.overall_ovr, r.overall) DESC, p.sort_order ASC
`);
export function getPlayersWithRatings(season) { return stmtGetPlayersWithRatings.all(String(season ?? '')); }

const stmtSetPlayerNumber = db.prepare(`UPDATE players SET number = ? WHERE id = ?`);
export function setPlayerNumber(id, number) { stmtSetPlayerNumber.run(String(number ?? '').trim(), id); }

const stmtSetPlayerStatus = db.prepare(`UPDATE players SET status = ? WHERE id = ?`);
export function setPlayerStatus(id, status) {
  stmtSetPlayerStatus.run(['active','inactive'].includes(status) ? status : 'active', id);
}

const stmtSetPlayerTeam = db.prepare(`UPDATE players SET team_id = ? WHERE id = ?`);
export function setPlayerTeam(id, teamId) { stmtSetPlayerTeam.run(String(teamId ?? ''), id); }

const stmtGetPlayerRating = db.prepare('SELECT * FROM player_ratings WHERE player_id = ? AND season = ?');
export function getPlayerRating(playerId, season) { return stmtGetPlayerRating.get(playerId, String(season ?? '')); }

const stmtDeleteUnlockedRating = db.prepare(
  `DELETE FROM player_ratings WHERE player_id = ? AND season = ? AND locked = 0`
);
export function deleteUnlockedRating(playerId, season) {
  stmtDeleteUnlockedRating.run(playerId, String(season ?? ''));
}

const stmtUpsertComputedRating = db.prepare(`
  INSERT INTO player_ratings
    (player_id, season, scoring, shooting, rebounding, playmaking, defense, iq, usage, overall, computed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id, season) DO UPDATE SET
    scoring=excluded.scoring, shooting=excluded.shooting, rebounding=excluded.rebounding,
    playmaking=excluded.playmaking, defense=excluded.defense, iq=excluded.iq,
    usage=excluded.usage, overall=excluded.overall, computed_at=excluded.computed_at
  WHERE locked = 0
`);
export function upsertComputedRating(playerId, season, r) {
  stmtUpsertComputedRating.run(
    playerId, String(season ?? ''),
    r.scoring, r.shooting, r.rebounding, r.playmaking, r.defense, r.iq, r.usage, r.overall,
    Date.now()
  );
}

const stmtSaveRatingOverrides = db.prepare(`
  INSERT INTO player_ratings
    (player_id, season, scoring_ovr, shooting_ovr, rebounding_ovr, playmaking_ovr,
     defense_ovr, iq_ovr, usage_ovr, overall_ovr, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id, season) DO UPDATE SET
    scoring_ovr=excluded.scoring_ovr, shooting_ovr=excluded.shooting_ovr,
    rebounding_ovr=excluded.rebounding_ovr, playmaking_ovr=excluded.playmaking_ovr,
    defense_ovr=excluded.defense_ovr, iq_ovr=excluded.iq_ovr,
    usage_ovr=excluded.usage_ovr, overall_ovr=excluded.overall_ovr,
    updated_at=excluded.updated_at
`);
export function saveRatingOverrides(playerId, season, ovr) {
  const n = v => (v !== '' && v != null && !isNaN(Number(v))) ? Number(v) : null;
  stmtSaveRatingOverrides.run(
    playerId, String(season ?? ''),
    n(ovr.scoring), n(ovr.shooting), n(ovr.rebounding), n(ovr.playmaking),
    n(ovr.defense), n(ovr.iq), n(ovr.usage), n(ovr.overall),
    Date.now()
  );
}

const stmtGetStatsBySeason = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE CAST(g.season AS TEXT) = ? AND g.status = 'complete'
  GROUP BY gps.player_id
`);
const stmtGetStatsAllTime = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE g.status = 'complete'
  GROUP BY gps.player_id
`);
export function getStatsBySeason(season) {
  return season ? stmtGetStatsBySeason.all(String(season)) : stmtGetStatsAllTime.all();
}

const stmtGetOnePlayerStatsBySeason = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND CAST(g.season AS TEXT) = ? AND g.status = 'complete'
`);
const stmtGetOnePlayerStatsAllTime = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND g.status = 'complete'
`);
export function getOnePlayerStats(playerId, season) {
  return season
    ? stmtGetOnePlayerStatsBySeason.get(playerId, String(season))
    : stmtGetOnePlayerStatsAllTime.get(playerId);
}

const stmtUpsertPlayerDetails = db.prepare(`
  INSERT INTO player_details
    (player_id, height, weight, hometown, school, nickname, wingspan, dominant_hand, years_playing, social_instagram, social_twitter)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id) DO UPDATE SET
    height=excluded.height, weight=excluded.weight, hometown=excluded.hometown,
    school=excluded.school, nickname=excluded.nickname, wingspan=excluded.wingspan,
    dominant_hand=excluded.dominant_hand, years_playing=excluded.years_playing,
    social_instagram=excluded.social_instagram, social_twitter=excluded.social_twitter
`);
export function upsertPlayerDetails(playerId, d) {
  const s = v => String(v || '').trim();
  stmtUpsertPlayerDetails.run(
    playerId, s(d.height), s(d.weight), s(d.hometown), s(d.school),
    s(d.nickname), s(d.wingspan), s(d.dominant_hand), s(d.years_playing),
    s(d.social_instagram), s(d.social_twitter)
  );
}

const stmtUpdateWriteup = db.prepare(`UPDATE players SET writeup = ? WHERE id = ?`);
export function updatePlayerWriteup(id, writeup) { stmtUpdateWriteup.run(String(writeup || '').trim(), id); }

const stmtPrevMatchup = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name, team_a_score, team_b_score
  FROM games
  WHERE status IN ('final','complete') AND id != ?
    AND ((team_a_id = ? AND team_b_id = ?) OR (team_a_id = ? AND team_b_id = ?))
    AND team_a_score + team_b_score > 0
  ORDER BY date DESC, id DESC
  LIMIT 1
`);
export function getPrevMatchup(gameId, teamAId, teamBId) {
  return stmtPrevMatchup.get(gameId, teamAId, teamBId, teamBId, teamAId) ?? null;
}

export function getTeamStreak(teamId, currentGameId) {
  const games = db.prepare(`
    SELECT team_a_id, team_a_score, team_b_score
    FROM games
    WHERE status IN ('final','complete') AND id != ?
      AND (team_a_id = ? OR team_b_id = ?)
      AND team_a_score + team_b_score > 0
    ORDER BY date DESC, id DESC
    LIMIT 10
  `).all(currentGameId, teamId, teamId);
  if (!games.length) return { streak: 0, type: null };
  let streak = 0, type = null;
  for (const g of games) {
    const teamScore = g.team_a_id === teamId ? g.team_a_score : g.team_b_score;
    const oppScore  = g.team_a_id === teamId ? g.team_b_score : g.team_a_score;
    const won = teamScore > oppScore;
    if (type === null) { type = won ? 'W' : 'L'; streak = 1; }
    else if ((type === 'W') === won) streak++;
    else break;
  }
  return { streak, type };
}

export function getPlayerLeagueRank(playerId, season) {
  const rows = db.prepare(`
    SELECT player_id, pts * 1.0 / NULLIF(games_played, 0) AS ppg
    FROM player_totals WHERE season = ? AND games_played > 0
    ORDER BY ppg DESC
  `).all(season);
  const idx = rows.findIndex(r => r.player_id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

export function getPlayerSeasonStats(playerId, season) {
  return db.prepare('SELECT * FROM player_totals WHERE player_id = ? AND season = ?').get(playerId, season) ?? null;
}

export function recomputePlayerTotals(season) {
  const s = season ?? db.prepare(`SELECT MAX(season) AS s FROM games WHERE status = 'complete'`).get()?.s ?? 3;
  const rows = db.prepare(`
    SELECT player_id,
      COUNT(DISTINCT game_id) AS games_played,
      SUM(pts) AS pts, SUM(ast) AS ast, SUM(reb) AS reb,
      SUM(stl) AS stl, SUM(blk) AS blk, SUM(turnover) AS turnover, SUM(pf) AS pf,
      SUM(fg2m) AS fg2m, SUM(fg3m) AS fg3m,
      SUM(fg2m_miss) AS fg2m_miss, SUM(fg3m_miss) AS fg3m_miss,
      SUM(ftm) AS ftm, SUM(ft_miss) AS ft_miss
    FROM game_player_stats gps
    JOIN games g ON g.id = gps.game_id
    WHERE g.season = ? AND g.status = 'complete'
    GROUP BY player_id
  `).all(s);
  const upsert = db.prepare(`
    INSERT INTO player_totals
      (player_id, season, games_played, pts, ast, reb, stl, blk, turnover, pf,
       fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, season) DO UPDATE SET
      games_played=excluded.games_played, pts=excluded.pts, ast=excluded.ast,
      reb=excluded.reb, stl=excluded.stl, blk=excluded.blk,
      turnover=excluded.turnover, pf=excluded.pf, fg2m=excluded.fg2m,
      fg3m=excluded.fg3m, fg2m_miss=excluded.fg2m_miss,
      fg3m_miss=excluded.fg3m_miss, ftm=excluded.ftm, ft_miss=excluded.ft_miss
  `);
  const run = db.transaction(() => {
    for (const r of rows) {
      upsert.run(r.player_id, s, r.games_played, r.pts, r.ast, r.reb, r.stl, r.blk,
        r.turnover, r.pf, r.fg2m, r.fg3m, r.fg2m_miss, r.fg3m_miss, r.ftm, r.ft_miss);
    }
  });
  run();
  return rows.length;
}

// ── Rating context queries ────────────────────────────────────────────────────

// Team-level FGA/FTA/TOV totals for USG% calculation
const stmtGetTeamRatingTotals = db.prepare(`
  SELECT gps.team_id,
    SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss) AS fga,
    SUM(gps.ftm  + gps.ft_miss)                               AS fta,
    SUM(gps.turnover)                                          AS tov
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE CAST(g.season AS TEXT) = ? AND g.status = 'complete' AND g.under_review = 0
  GROUP BY gps.team_id
`);
export function getTeamRatingTotals(season) {
  const rows = stmtGetTeamRatingTotals.all(String(season ?? ''));
  return Object.fromEntries(rows.map(r => [r.team_id, { fga: r.fga || 0, fta: r.fta || 0, tov: r.tov || 0 }]));
}

// Last N games stats for a player (for recency blend)
const stmtGetPlayerRecentStats = db.prepare(`
  SELECT
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts)       AS pts,  SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl)       AS stl,  SUM(gps.blk) AS blk,
    SUM(gps.turnover)  AS turnover, SUM(gps.pf) AS pf,
    SUM(gps.fg2m)      AS fg2m, SUM(gps.fg3m) AS fg3m,
    SUM(gps.fg2m_miss) AS fg2m_miss, SUM(gps.fg3m_miss) AS fg3m_miss,
    SUM(gps.ftm)       AS ftm,  SUM(gps.ft_miss) AS ft_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
    AND gps.game_id IN (
      SELECT gps2.game_id FROM game_player_stats gps2
      JOIN games g2 ON g2.id = gps2.game_id
      WHERE gps2.player_id = ?
        AND CAST(g2.season AS TEXT) = ?
        AND g2.status = 'complete' AND g2.under_review = 0
      ORDER BY g2.date DESC, g2.id DESC
      LIMIT 5
    )
`);
export function getPlayerRecentStats(playerId, season) {
  return stmtGetPlayerRecentStats.get(playerId, String(season ?? ''), playerId, String(season ?? ''));
}

// Per-game pts array for consistency calculation
const stmtGetPlayerGamePts = db.prepare(`
  SELECT gps.pts
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
  ORDER BY g.date DESC, g.id DESC
`);
export function getPlayerGamePts(playerId, season) {
  return stmtGetPlayerGamePts.all(playerId, String(season ?? '')).map(r => r.pts || 0);
}

// Win rate for games a player appeared in
const stmtGetPlayerWinRate = db.prepare(`
  SELECT
    COUNT(*) AS gp,
    SUM(CASE
      WHEN gps.team_id = g.team_a_id AND g.team_a_score > g.team_b_score THEN 1
      WHEN gps.team_id = g.team_b_id AND g.team_b_score > g.team_a_score THEN 1
      ELSE 0
    END) AS wins
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
`);
export function getPlayerWinRate(playerId, season) {
  const row = stmtGetPlayerWinRate.get(playerId, String(season ?? ''));
  if (!row || !row.gp) return null;
  return row.wins / row.gp;
}

// Total completed games in a season (for availability)
const stmtGetTotalSeasonGames = db.prepare(`
  SELECT COUNT(*) AS n FROM games
  WHERE CAST(season AS TEXT) = ? AND status = 'complete' AND under_review = 0
`);
export function getTotalSeasonGames(season) {
  return stmtGetTotalSeasonGames.get(String(season ?? ''))?.n ?? 0;
}

// ── Compare cache ─────────────────────────────────────────────────────────────
const stmtGetCompareCache = db.prepare(
  `SELECT writeup FROM compare_cache WHERE pair_key = ? AND stats_key = ?`
);
const stmtSetCompareCache = db.prepare(
  `INSERT OR REPLACE INTO compare_cache (pair_key, stats_key, writeup, created_at, view_count, last_viewed_at, model)
   VALUES (?, ?, ?, ?, 1, ?, ?)`
);
const stmtIncrementCompareViews = db.prepare(
  `UPDATE compare_cache SET view_count = view_count + 1, last_viewed_at = ? WHERE pair_key = ?`
);
const stmtGetCompareAnalytics = db.prepare(`
  SELECT
    cc.pair_key,
    cc.writeup,
    cc.view_count,
    cc.last_viewed_at,
    cc.created_at,
    cc.model,
    p1.id   AS player_a_id,
    p1.name AS player_a_name,
    p2.id   AS player_b_id,
    p2.name AS player_b_name
  FROM compare_cache cc
  LEFT JOIN players p1 ON p1.id = substr(cc.pair_key, 1, instr(cc.pair_key, '|') - 1)
  LEFT JOIN players p2 ON p2.id = substr(cc.pair_key, instr(cc.pair_key, '|') + 1)
  ORDER BY cc.view_count DESC, cc.last_viewed_at DESC
`);

function comparePairKey(idA, idB) { return [idA, idB].sort().join('|'); }
function compareStatsKey(idA, idB, tA, tB) {
  // Always encode stats in sorted-ID order so A vs B == B vs A
  const [first, second] = idA < idB ? [tA, tB] : [tB, tA];
  return `${first?.games_played|0}_${first?.pts|0}_${first?.reb|0}_${first?.ast|0}_${second?.games_played|0}_${second?.pts|0}_${second?.reb|0}_${second?.ast|0}`;
}

export function getCompareCache(idA, idB, tA, tB) {
  const pair = comparePairKey(idA, idB);
  const stats = compareStatsKey(idA, idB, tA, tB);
  const row = stmtGetCompareCache.get(pair, stats);
  return row ? row.writeup : null;
}

export function setCompareCache(idA, idB, tA, tB, writeup, model = null) {
  const pair = comparePairKey(idA, idB);
  const stats = compareStatsKey(idA, idB, tA, tB);
  const now = Date.now();
  stmtSetCompareCache.run(pair, stats, writeup, now, now, model);
}

export function incrementCompareViews(idA, idB) {
  stmtIncrementCompareViews.run(Date.now(), comparePairKey(idA, idB));
}

export function getCompareAnalytics() {
  return stmtGetCompareAnalytics.all();
}

// ── MVP cache ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS mvp_cache (
    player_id  TEXT NOT NULL,
    season     TEXT NOT NULL,
    stats_key  TEXT NOT NULL,
    writeup    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, season)
  )
`);

const stmtGetMvpWriteup = db.prepare(
  `SELECT writeup FROM mvp_cache WHERE player_id=? AND season=? AND stats_key=?`
);
const stmtSetMvpWriteup = db.prepare(
  `INSERT OR REPLACE INTO mvp_cache (player_id, season, stats_key, writeup, created_at)
   VALUES (?, ?, ?, ?, ?)`
);
const stmtGetMvpCandidates = db.prepare(`
  SELECT
    p.id, p.name, p.picture_url,
    t.name  AS team_name,
    t.color AS team_color,
    COUNT(gps.game_id)                                         AS gp,
    SUM(gps.pts)                                               AS pts,
    SUM(gps.reb)                                               AS reb,
    SUM(gps.ast)                                               AS ast,
    SUM(gps.stl)                                               AS stl,
    SUM(gps.blk)                                               AS blk,
    SUM(gps.turnover)                                          AS tov,
    SUM(gps.fg2m + gps.fg3m)                                  AS fgm,
    SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss) AS fga,
    SUM(gps.fg3m)                                              AS fg3m,
    SUM(gps.fg3m + gps.fg3m_miss)                             AS fg3a,
    SUM(gps.ftm)                                               AS ftm,
    SUM(gps.ftm + gps.ft_miss)                                AS fta,
    SUM(gps.fg2m_miss + gps.fg3m_miss)                        AS fgmiss,
    SUM(gps.ft_miss)                                           AS ftmiss,
    SUM(CASE WHEN (gps.team_id = g.team_a_id AND g.team_a_score > g.team_b_score)
              OR  (gps.team_id = g.team_b_id AND g.team_b_score > g.team_a_score)
             THEN 1 ELSE 0 END)                                AS wins,
    SUM(CASE WHEN (gps.team_id = g.team_a_id AND g.team_a_score < g.team_b_score)
              OR  (gps.team_id = g.team_b_id AND g.team_b_score < g.team_a_score)
             THEN 1 ELSE 0 END)                                AS losses
  FROM game_player_stats gps
  JOIN games   g ON g.id  = gps.game_id
  JOIN players p ON p.id  = gps.player_id
  JOIN teams   t ON t.id  = p.team_id
  WHERE g.season = ? AND g.under_review = 0 AND g.game_type = 'regular'
    AND g.status = 'complete'
  GROUP BY p.id
`);
const stmtGetTotalSeasonGamesForMvp = db.prepare(`
  SELECT COUNT(*) AS cnt FROM games
  WHERE season=? AND under_review=0 AND game_type='regular' AND status='complete'
`);

export function getMvpWriteup(playerId, season, statsKey) {
  const row = stmtGetMvpWriteup.get(playerId, String(season), statsKey);
  return row ? row.writeup : null;
}
export function setMvpWriteup(playerId, season, statsKey, writeup) {
  stmtSetMvpWriteup.run(playerId, String(season), statsKey, writeup, Date.now());
}
export function getMvpCandidates(season) {
  return stmtGetMvpCandidates.all(String(season));
}
export function getTotalSeasonGamesForMvp(season) {
  return stmtGetTotalSeasonGamesForMvp.get(String(season))?.cnt ?? 0;
}
