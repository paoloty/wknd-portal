// One-off + rerunnable data fix: a player can end up with a game_player_stats row
// AND a game_dnp row for the same game at the same time — a contradiction, since
// DNP means they didn't play. Found via Carl Gaspar (season 3, MAROON vs BLACK,
// 2026-06-08): he's correctly listed in game_dnp for that game, but also has a
// zero-stat game_player_stats row for it, which inflates his player_totals
// games_played count for that season even though every stat on it is 0.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/fix-dnp-with-stat-row.js            — dry run, prints what would change
//   node scripts/fix-dnp-with-stat-row.js --apply    — actually deletes the bad rows
//
// Uses lib/portal-db.js's own DB connection, so it operates on whichever data/portal.db
// sits next to wherever you run it from — same file the app itself reads and writes.
// Safe to re-run any time: once there are no contradictions left, it's a no-op.
//
// For each match: deletes the game_player_stats row, then deletes the player's
// player_totals row for that game's season if that was their only game_player_stats
// row in the season (recomputePlayerTotals() only upserts players who still have at
// least one row — it won't zero out an now-orphaned total on its own). If other games
// remain that season, recomputes the total from what's left instead of deleting it.

import { db, recomputePlayerTotals } from '../lib/portal-db.js';

const apply = process.argv.includes('--apply');

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually delete anything)'}\n`);

const contradictions = db.prepare(`
  SELECT gps.game_id, gps.player_id, g.date, g.season, g.team_a_name, g.team_b_name,
         p.name AS player_name,
         gps.pts, gps.ast, gps.reb, gps.stl, gps.blk, gps.turnover, gps.pf,
         gps.fg2m, gps.fg3m, gps.fg4m, gps.ftm
  FROM game_player_stats gps
  JOIN game_dnp d ON d.game_id = gps.game_id AND d.player_id = gps.player_id
  JOIN games g ON g.id = gps.game_id
  LEFT JOIN players p ON p.id = gps.player_id
  ORDER BY g.date
`).all();

if (!contradictions.length) {
  console.log('No player has both a stat row and a DNP row for the same game. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${contradictions.length} contradiction(s):\n`);
for (const c of contradictions) {
  const statSum = c.pts + c.ast + c.reb + c.stl + c.blk + c.turnover + c.pf + c.fg2m + c.fg3m + c.fg4m + c.ftm;
  console.log(`  ${c.player_name || c.player_id}  season ${c.season}  ${c.date} ${c.team_a_name} vs ${c.team_b_name}  (non-zero stat fields: ${statSum})`);
}

if (!apply) {
  console.log('\nDry run only — re-run with --apply to actually fix these.');
  process.exit(0);
}

const deleteStat = db.prepare('DELETE FROM game_player_stats WHERE game_id = ? AND player_id = ?');
const deleteTotals = db.prepare('DELETE FROM player_totals WHERE player_id = ? AND season = ?');
const countOtherGamesThisSeason = db.prepare(`
  SELECT COUNT(*) AS n FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND g.season = ? AND gps.game_id != ?
`);

console.log('');
const run = db.transaction(() => {
  for (const c of contradictions) {
    deleteStat.run(c.game_id, c.player_id);
    const remaining = countOtherGamesThisSeason.get(c.player_id, c.season, c.game_id).n;
    if (remaining > 0) {
      recomputePlayerTotals(c.season);
      console.log(`  fixed ${c.player_name || c.player_id} — deleted stat row, recomputed season ${c.season} totals (${remaining} other game(s) remain)`);
    } else {
      deleteTotals.run(c.player_id, c.season);
      console.log(`  fixed ${c.player_name || c.player_id} — deleted stat row and season ${c.season} totals (no other games that season)`);
    }
  }
});
run();

console.log(`\nApplied. ${contradictions.length} row(s) fixed.`);
