#!/usr/bin/env node
// One-time script: create player_positions and game_dnp tables and populate from existing portal.db data.
// Safe to re-run (uses INSERT OR IGNORE).

import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.resolve(__dirname, '../data/portal.db'));

db.exec(`
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

// ── Player positions ──────────────────────────────────────────────────────────
const players = db.prepare('SELECT id, positions FROM players').all();
const stmtPos = db.prepare(
  'INSERT OR IGNORE INTO player_positions (player_id, position, sort_order) VALUES (?, ?, ?)'
);
let posCount = 0;
for (const p of players) {
  let positions = [];
  try { positions = JSON.parse(p.positions || '[]'); } catch { positions = []; }
  if (!Array.isArray(positions)) positions = [];
  positions.forEach((pos, i) => {
    stmtPos.run(p.id, String(pos), i);
    posCount++;
  });
}
console.log(`player_positions: ${posCount} rows inserted`);

// ── Game DNP ──────────────────────────────────────────────────────────────────
// Build portal player ID set for validation
const playerIds = new Set(db.prepare('SELECT id FROM players').all().map(p => p.id));
const games = db.prepare('SELECT id, dnp_players_json FROM games').all();
const stmtDnp = db.prepare(
  'INSERT OR IGNORE INTO game_dnp (game_id, player_id) VALUES (?, ?)'
);
let dnpCount = 0;
let dnpSkipped = 0;
for (const g of games) {
  let ids = [];
  try { ids = JSON.parse(g.dnp_players_json || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  for (const pid of ids) {
    if (!playerIds.has(pid)) { dnpSkipped++; continue; }
    stmtDnp.run(g.id, pid);
    dnpCount++;
  }
}
console.log(`game_dnp: ${dnpCount} rows inserted${dnpSkipped ? `, ${dnpSkipped} skipped (unknown player IDs)` : ''}`);

// ── Verify ────────────────────────────────────────────────────────────────────
const posTotal = db.prepare('SELECT COUNT(*) AS n FROM player_positions').get().n;
const dnpTotal = db.prepare('SELECT COUNT(*) AS n FROM game_dnp').get().n;
console.log(`\nFinal counts: player_positions=${posTotal}, game_dnp=${dnpTotal}`);

// Show DNP breakdown per game
const dnpPerGame = db.prepare(`
  SELECT g.id, g.team_a_name || ' vs ' || g.team_b_name AS matchup, COUNT(d.player_id) AS cnt
  FROM games g
  LEFT JOIN game_dnp d ON d.game_id = g.id
  GROUP BY g.id
  HAVING cnt > 0
  ORDER BY g.sort_order
`).all();
if (dnpPerGame.length) {
  console.log('\nDNP records per game:');
  dnpPerGame.forEach(r => console.log(`  ${r.matchup}: ${r.cnt}`));
}
