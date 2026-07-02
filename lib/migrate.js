#!/usr/bin/env node
// One-time migration: copy all basketball data from wknd-stats.db into portal.db
// Usage:  node lib/migrate.js
// Safe to re-run: exits early when teams already exist.
// Use --force to wipe basketball tables and re-run.

import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WKND_PATH   = path.resolve(__dirname, '../../wknd-stats/data/wknd-stats.db');
const PORTAL_PATH = path.resolve(__dirname, '../data/portal.db');

const wknd   = new Database(WKND_PATH, { readonly: true });
const portal = new Database(PORTAL_PATH);

// ── Ensure new tables exist (mirrors portal-db.js schema) ────────────────────
portal.exec(`
  CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, name TEXT NOT NULL,
    year INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, team_id TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
    name TEXT GENERATED ALWAYS AS (last_name || ', ' || first_name) STORED,
    number TEXT NOT NULL DEFAULT '', positions TEXT NOT NULL DEFAULT '[]',
    picture_url TEXT NOT NULL DEFAULT '',
    birthday TEXT NOT NULL DEFAULT '', writeup TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active', sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS player_details (
    player_id TEXT PRIMARY KEY,
    height TEXT NOT NULL DEFAULT '', weight TEXT NOT NULL DEFAULT '',
    hometown TEXT NOT NULL DEFAULT '', school TEXT NOT NULL DEFAULT '',
    nickname TEXT NOT NULL DEFAULT '', wingspan TEXT NOT NULL DEFAULT '',
    dominant_hand TEXT NOT NULL DEFAULT '', years_playing TEXT NOT NULL DEFAULT '',
    social_instagram TEXT NOT NULL DEFAULT '', social_twitter TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS player_totals (
    player_id TEXT NOT NULL, season INTEGER NOT NULL DEFAULT 3,
    games_played INTEGER NOT NULL DEFAULT 0,
    pts INTEGER NOT NULL DEFAULT 0, ast INTEGER NOT NULL DEFAULT 0,
    reb INTEGER NOT NULL DEFAULT 0, stl INTEGER NOT NULL DEFAULT 0,
    blk INTEGER NOT NULL DEFAULT 0, turnover INTEGER NOT NULL DEFAULT 0,
    pf INTEGER NOT NULL DEFAULT 0, fg2m INTEGER NOT NULL DEFAULT 0,
    fg3m INTEGER NOT NULL DEFAULT 0, fg2m_miss INTEGER NOT NULL DEFAULT 0,
    fg3m_miss INTEGER NOT NULL DEFAULT 0, ftm INTEGER NOT NULL DEFAULT 0,
    ft_miss INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (player_id, season)
  );
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY, season INTEGER NOT NULL DEFAULT 3,
    date TEXT NOT NULL DEFAULT '', game_type TEXT NOT NULL DEFAULT 'regular',
    playoff_round TEXT NOT NULL DEFAULT '', series_id TEXT NOT NULL DEFAULT '',
    team_a_id TEXT NOT NULL DEFAULT '', team_b_id TEXT NOT NULL DEFAULT '',
    team_a_name TEXT NOT NULL DEFAULT '', team_b_name TEXT NOT NULL DEFAULT '',
    team_a_score INTEGER NOT NULL DEFAULT 0, team_b_score INTEGER NOT NULL DEFAULT 0,
    scheduled INTEGER NOT NULL DEFAULT 0, under_review INTEGER NOT NULL DEFAULT 0,
    game_writeup TEXT NOT NULL DEFAULT '', potg_writeup TEXT NOT NULL DEFAULT '',
    manual_potg_player_id TEXT NOT NULL DEFAULT '', youtube_url TEXT NOT NULL DEFAULT '',
    period_snapshots_json TEXT NOT NULL DEFAULT '[]',
    dnp_players_json TEXT NOT NULL DEFAULT '[]',
    game_log_json TEXT NOT NULL DEFAULT '[]',
    social_cover_data_url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS game_player_stats (
    game_id TEXT NOT NULL, player_id TEXT NOT NULL,
    team_id TEXT NOT NULL DEFAULT '',
    pts INTEGER NOT NULL DEFAULT 0, ast INTEGER NOT NULL DEFAULT 0,
    reb INTEGER NOT NULL DEFAULT 0, stl INTEGER NOT NULL DEFAULT 0,
    blk INTEGER NOT NULL DEFAULT 0, turnover INTEGER NOT NULL DEFAULT 0,
    pf INTEGER NOT NULL DEFAULT 0, fg2m INTEGER NOT NULL DEFAULT 0,
    fg3m INTEGER NOT NULL DEFAULT 0, fg2m_miss INTEGER NOT NULL DEFAULT 0,
    fg3m_miss INTEGER NOT NULL DEFAULT 0, ftm INTEGER NOT NULL DEFAULT 0,
    ft_miss INTEGER NOT NULL DEFAULT 0, minutes TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (game_id, player_id)
  );
  CREATE TABLE IF NOT EXISTS awards (
    id TEXT PRIMARY KEY, season INTEGER NOT NULL DEFAULT 3,
    award_type TEXT NOT NULL, player_id TEXT NOT NULL DEFAULT '',
    team_id TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS player_positions (
    player_id  TEXT NOT NULL,
    position   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, position)
  );
  CREATE TABLE IF NOT EXISTS game_dnp (
    game_id   TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (game_id, player_id)
  );
`);

// ── Guard ─────────────────────────────────────────────────────────────────────
const existing = portal.prepare('SELECT COUNT(*) AS n FROM teams').get();
if (existing.n > 0) {
  if (!process.argv.includes('--force')) {
    console.log('portal.db already has team data — migration already done.');
    console.log('Run with --force to wipe and re-migrate.');
    process.exit(0);
  }
  console.log('--force: clearing basketball tables...');
  portal.exec(`
    DELETE FROM game_dnp;
    DELETE FROM player_positions;
    DELETE FROM game_player_stats;
    DELETE FROM player_totals;
    DELETE FROM awards;
    DELETE FROM games;
    DELETE FROM player_details;
    DELETE FROM players;
    DELETE FROM teams;
    DELETE FROM seasons;
  `);
}

// ── Read source data ──────────────────────────────────────────────────────────
const srcTeams   = wknd.prepare('SELECT * FROM teams ORDER BY sort_order ASC').all();
const srcPlayers = wknd.prepare('SELECT * FROM players ORDER BY sort_order ASC, id ASC').all();
const srcGames   = wknd.prepare('SELECT * FROM games ORDER BY sort_order ASC, id ASC').all();
const srcStats   = wknd.prepare('SELECT * FROM game_player_stats').all();
const srcTotals  = wknd.prepare('SELECT * FROM player_totals').all();
const srcAwards  = wknd.prepare('SELECT * FROM awards').all();

// ── Build UUID maps ───────────────────────────────────────────────────────────
const teamMap   = {};
const playerMap = {};
const gameMap   = {};

srcTeams.forEach(t   => { teamMap[t.id]   = randomUUID(); });
srcPlayers.forEach(p => { playerMap[p.id] = randomUUID(); });
srcGames.forEach(g   => { gameMap[g.id]   = randomUUID(); });

// Also map old short-form team IDs (team_white etc.) in case wknd-stats games still use them
const SHORT_TEAM_NAME = { team_white: 'WHITE', team_blue: 'BLUE', team_black: 'BLACK', team_maroon: 'MAROON' };
const nameToPortalTeamId = Object.fromEntries(srcTeams.map(t => [t.name, teamMap[t.id]]));
function resolveTeamId(id) { return teamMap[id] || nameToPortalTeamId[SHORT_TEAM_NAME[id]] || ''; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeDate(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function remapJsonIds(json, map) {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return '[]';
    return JSON.stringify(arr.map(id => map[id] || id).filter(Boolean));
  } catch { return '[]'; }
}

// Splits "LASTNAME, Firstname" into { firstName, lastName }.
function splitName(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  if (comma === -1) return { firstName: str, lastName: '' };
  return {
    lastName:  str.slice(0, comma).trim(),
    firstName: str.slice(comma + 1).trim(),
  };
}

const now = Date.now();

// ── Season ────────────────────────────────────────────────────────────────────
const seasonUUID = randomUUID();
portal.prepare(`
  INSERT INTO seasons (id, number, name, year, status, start_date, end_date, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(seasonUUID, 3, 'Season 3', 2026, 'active', '2026-06-08', '', now);
console.log('  Season 3 created');

// ── Teams ─────────────────────────────────────────────────────────────────────
const stmtTeam = portal.prepare(
  'INSERT INTO teams (id, name, color, sort_order) VALUES (?, ?, ?, ?)'
);
for (const t of srcTeams) {
  stmtTeam.run(teamMap[t.id], t.name, t.color || '', t.sort_order || 0);
}
console.log(`  ${srcTeams.length} teams migrated`);

// ── Players ───────────────────────────────────────────────────────────────────
const stmtPlayer = portal.prepare(`
  INSERT INTO players
    (id, team_id, first_name, last_name, number, positions, picture_url, birthday, writeup, status, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtPlayerDetails = portal.prepare(`
  INSERT INTO player_details (player_id, height) VALUES (?, ?)
`);
for (const p of srcPlayers) {
  const { firstName, lastName } = splitName(p.name);
  const newId = playerMap[p.id];
  stmtPlayer.run(
    newId,
    teamMap[p.team_id] || '',
    firstName,
    lastName,
    String(p.number ?? ''),
    p.positions || '[]',
    p.picture_url || '',
    p.birthday || '',
    p.writeup || '',
    p.released ? 'released' : 'active',
    p.sort_order || 0
  );
  stmtPlayerDetails.run(newId, p.height || '');
}
console.log(`  ${srcPlayers.length} players migrated`);

// ── Player totals ─────────────────────────────────────────────────────────────
const stmtTotals = portal.prepare(`
  INSERT INTO player_totals
    (player_id, season, games_played, pts, ast, reb, stl, blk, turnover, pf,
     fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss)
  VALUES (?, 3, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
let totalsCount = 0;
for (const t of srcTotals) {
  const newId = playerMap[t.player_id];
  if (!newId) continue;
  stmtTotals.run(newId, t.games_played, t.pts, t.ast, t.reb, t.stl, t.blk,
    t.turnover, t.pf, t.fg2m, t.fg3m, t.fg2m_miss, t.fg3m_miss, t.ftm, t.ft_miss);
  totalsCount++;
}
console.log(`  ${totalsCount} player totals migrated`);

// ── Games ─────────────────────────────────────────────────────────────────────
const stmtGame = portal.prepare(`
  INSERT INTO games
    (id, season, date, game_type, playoff_round, series_id,
     team_a_id, team_b_id, team_a_name, team_b_name,
     team_a_score, team_b_score, scheduled, under_review,
     game_writeup, potg_writeup, manual_potg_player_id, youtube_url,
     period_snapshots_json, dnp_players_json, game_log_json, social_cover_data_url,
     sort_order, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (let i = 0; i < srcGames.length; i++) {
  const g = srcGames[i];
  stmtGame.run(
    gameMap[g.id],
    g.season || 3,
    normalizeDate(g.date),
    g.game_type || 'regular',
    g.playoff_round || '',
    g.series_id || '',
    resolveTeamId(g.team_a_id),
    resolveTeamId(g.team_b_id),
    g.team_a_name || '',
    g.team_b_name || '',
    g.team_a_score || 0,
    g.team_b_score || 0,
    g.scheduled ? 1 : 0,
    g.under_review ? 1 : 0,
    g.game_writeup || '',
    g.potg_writeup || '',
    g.manual_potg_player_id ? (playerMap[g.manual_potg_player_id] || '') : '',
    g.youtube_url || '',
    g.period_snapshots_json || '[]',
    remapJsonIds(g.dnp_players_json, playerMap),
    g.game_log_json || '[]',
    g.social_cover_data_url || '',
    g.sort_order || i,
    now
  );
}
console.log(`  ${srcGames.length} games migrated`);

// ── Game player stats ─────────────────────────────────────────────────────────
const stmtStats = portal.prepare(`
  INSERT INTO game_player_stats
    (game_id, player_id, team_id, pts, ast, reb, stl, blk, turnover, pf,
     fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
let statsCount = 0;
for (const s of srcStats) {
  const newGameId   = gameMap[s.game_id];
  const newPlayerId = playerMap[s.player_id];
  if (!newGameId || !newPlayerId) continue;
  stmtStats.run(
    newGameId, newPlayerId, teamMap[s.team_id] || '',
    s.pts, s.ast, s.reb, s.stl, s.blk, s.turnover, s.pf,
    s.fg2m, s.fg3m, s.fg2m_miss, s.fg3m_miss, s.ftm, s.ft_miss,
    s.minutes || ''
  );
  statsCount++;
}
console.log(`  ${statsCount} game stats migrated`);

// ── Awards ────────────────────────────────────────────────────────────────────
const stmtAward = portal.prepare(`
  INSERT INTO awards (id, season, award_type, player_id, team_id, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const a of srcAwards) {
  stmtAward.run(
    randomUUID(), a.season || 3, a.award_type,
    playerMap[a.player_id] || '', teamMap[a.team_id] || '',
    a.notes || '', now
  );
}
if (srcAwards.length) console.log(`  ${srcAwards.length} awards migrated`);

// ── Player positions ──────────────────────────────────────────────────────────
const stmtPos = portal.prepare(
  'INSERT OR IGNORE INTO player_positions (player_id, position, sort_order) VALUES (?, ?, ?)'
);
let posCount = 0;
for (const p of srcPlayers) {
  const newId = playerMap[p.id];
  if (!newId) continue;
  let positions = [];
  try { positions = JSON.parse(p.positions || '[]'); } catch { positions = []; }
  if (!Array.isArray(positions)) positions = [];
  positions.forEach((pos, i) => {
    stmtPos.run(newId, String(pos), i);
    posCount++;
  });
}
console.log(`  ${posCount} player positions migrated`);

// ── Game DNP ──────────────────────────────────────────────────────────────────
// Build lookup: portal player name → portal UUID (for resolving legacy short IDs)
const portalNameToId = {};
for (const p of srcPlayers) {
  if (playerMap[p.id]) portalNameToId[String(p.name || '').trim()] = playerMap[p.id];
}
// Build wknd-stats player lookup by jersey number + team for resolving short IDs
const wkndPlayersByNumTeam = {};
for (const p of srcPlayers) {
  const key = `${resolveTeamId(p.team_id)}:${p.number}`;
  wkndPlayersByNumTeam[key] = playerMap[p.id];
}

const stmtDnp = portal.prepare(
  'INSERT OR IGNORE INTO game_dnp (game_id, player_id) VALUES (?, ?)'
);
let dnpCount = 0;
for (const g of srcGames) {
  const newGameId = gameMap[g.id];
  if (!newGameId) continue;
  let ids = [];
  try { ids = JSON.parse(g.dnp_players_json || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  for (const pid of ids) {
    // Try direct playerMap first (UUID or old wknd-stats UUID)
    let newPid = playerMap[pid];
    if (!newPid) continue;
    stmtDnp.run(newGameId, newPid);
    dnpCount++;
  }
}
console.log(`  ${dnpCount} game DNP records migrated`);

// ── Remap cross-references in portal.db ──────────────────────────────────────
console.log('\nRemapping cross-references...');

const updFinancials = portal.prepare('UPDATE player_financials SET player_id = ? WHERE player_id = ?');
const updLedger     = portal.prepare('UPDATE transaction_ledger SET player_id = ? WHERE player_id = ?');
const updRegs       = portal.prepare('UPDATE registrations SET player_id = ? WHERE player_id = ?');
const updSharesP    = portal.prepare('UPDATE leader_shares SET player_id = ? WHERE player_id = ?');
const updSharesT    = portal.prepare('UPDATE leader_shares SET team_id = ? WHERE team_id = ?');

for (const [oldId, newId] of Object.entries(playerMap)) {
  updFinancials.run(newId, oldId);
  updLedger.run(newId, oldId);
  updRegs.run(newId, oldId);
  updSharesP.run(newId, oldId);
}
for (const [oldId, newId] of Object.entries(teamMap)) {
  updSharesT.run(newId, oldId);
}

portal.prepare('DELETE FROM entity_slugs').run();
console.log('  entity_slugs cleared (will regenerate on first visit)');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n=== Migration complete ===');
console.log(`Teams: ${srcTeams.length} | Players: ${srcPlayers.length} | Games: ${srcGames.length} | Stats: ${statsCount}`);

console.log('\nTeam UUID map (save this for reference):');
for (const t of srcTeams) {
  console.log(`  ${t.id.padEnd(12)} -> ${teamMap[t.id]}  (${t.name})`);
}
