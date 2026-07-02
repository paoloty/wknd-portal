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
    created_at            INTEGER NOT NULL DEFAULT 0
  )
`);

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
    AND t.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
  LEFT JOIN teams tm ON tm.id = p.team_id
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetGames = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, series_id, youtube_url, scheduled,
         (COALESCE(LENGTH(social_cover_data_url), 0) > 0) AS has_cover
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
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
    AND g.game_type = 'regular' AND g.under_review = 0
  GROUP BY gps.team_id, t.name
  ORDER BY t.sort_order ASC
`);

const stmtGetTeamRecords = db.prepare(`
  SELECT team_id,
         SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
  FROM (
    SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
      AND game_type = 'regular' AND under_review = 0
    UNION ALL
    SELECT team_b_id, team_b_score, team_a_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
      AND game_type = 'regular' AND under_review = 0
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
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
    AND g.game_type = 'regular'
    AND g.under_review = 0
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
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, youtube_url, period_snapshots_json, dnp_players_json, game_log_json,
         (COALESCE(LENGTH(social_cover_data_url), 0) > 0) AS has_cover
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
  `SELECT MAX(season) AS season FROM games WHERE game_type = 'regular' AND under_review = 0`
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
  WHERE g.under_review = 0
    AND (gps.player_id IS NOT NULL OR d.player_id IS NOT NULL)
  ORDER BY g.sort_order DESC
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
  WHERE g.under_review = 0
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
const stmtUpdateGameCover   = db.prepare('UPDATE games SET social_cover_data_url = ? WHERE id = ?');

export function updateGameRecap(id, writeup)   { stmtUpdateGameRecap.run(writeup, id); }
export function updateGameYoutube(id, url)     { stmtUpdateGameYoutube.run(url, id); }
export function updateGameCover(id, dataUrl)   { stmtUpdateGameCover.run(dataUrl, id); }

const stmtGetTickerGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, team_a_score, team_b_score, game_type, scheduled
  FROM games
  WHERE under_review = 0
  ORDER BY date DESC, id DESC
  LIMIT 14
`);

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
export function getCurrentSeason()                  { return stmtGetCurrentSeason.get(); }

export function recomputePlayerTotals(season) {
  const s = season ?? db.prepare(`SELECT MAX(season) AS s FROM games WHERE under_review = 0`).get()?.s ?? 3;
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
    WHERE g.season = ? AND g.under_review = 0
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
