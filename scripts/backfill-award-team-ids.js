// One-off + rerunnable data fix: the awards table has always had a team_id column,
// but nothing ever actually wrote to it — every existing award row has team_id = ''.
// The season-awards display query used to paper over this by joining team name/color
// off the player's CURRENT live team_id instead, which looked fine until a player's
// live team_id actually changed after a real Start Season run (see the matching fix
// to stmtGetPlayerGameLog / stmtGetGameDnpPlayers in lib/portal-db.js — this is the
// same class of bug). upsertAward() now resolves and stores the real team_id going
// forward; this script backfills the existing rows using the same logic: the team the
// player actually played for in that award's season (their most recent played game
// that season), not whatever team they're on today.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/backfill-award-team-ids.js            — dry run, prints what would change
//   node scripts/backfill-award-team-ids.js --apply    — actually writes the resolved team_id
//
// Uses lib/portal-db.js's own DB connection, so it operates on whichever data/portal.db
// sits next to wherever you run it from — same file this app itself reads and writes.
// Safe to re-run any time: once every award has a team_id, it's a no-op.

import { db, getPlayerTeamIdForSeason } from '../lib/portal-db.js';

const apply = process.argv.includes('--apply');

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually write anything)'}\n`);

const teams = new Map(db.prepare('SELECT id, name FROM teams').all().map(t => [t.id, t.name]));
const blank = db.prepare(`SELECT id, season, player_id FROM awards WHERE team_id = '' AND player_id != ''`).all();

if (!blank.length) {
  console.log('No awards with a blank team_id found. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${blank.length} award(s) with no team_id:\n`);

const resolved = [];
for (const a of blank) {
  const teamId = getPlayerTeamIdForSeason(a.player_id, a.season);
  resolved.push({ ...a, teamId });
  console.log(`  ${a.id}  ->  ${teamId ? (teams.get(teamId) || teamId) : '(no team resolvable — player never played that season)'}`);
}

if (apply) {
  console.log('');
  const upd = db.prepare('UPDATE awards SET team_id = ? WHERE id = ?');
  let updated = 0, skipped = 0;
  for (const r of resolved) {
    if (!r.teamId) { skipped++; continue; }
    upd.run(r.teamId, r.id);
    updated++;
  }
  console.log(`Applied. ${updated} award(s) updated, ${skipped} skipped (no resolvable team).`);
} else {
  console.log('\nDry run only — re-run with --apply to actually write these.');
}
