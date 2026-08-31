// One-off + rerunnable data fix: players.team_id represents a player's CURRENT team, but
// nothing ever cleared it for players who didn't make the current season's confirmed
// roster (never signed up, waitlisted, rejected, withdrew). They kept showing up as "on"
// whatever team they were on last season — e.g. the team-head /team page (getPlayersByTeam)
// has no season-signup filtering at all, so a departed player just kept appearing on their
// old team's live roster indefinitely.
//
// POST /admin/season/teams/start now clears team_id for anyone not in that season's
// confirmed set as part of the same sync step that assigns it for players who ARE
// confirmed (see server.js) — this script backfills anyone who went stale before that
// existed, using signup_target_season as "the current season" the same way Start Season
// itself does.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/clear-unconfirmed-player-teams.js            — dry run, prints what would change
//   node scripts/clear-unconfirmed-player-teams.js --apply    — actually clears team_id
//
// Uses lib/portal-db.js's own DB connection, so it operates on whichever data/portal.db
// sits next to wherever you run it from — same file this app itself reads and writes.
// Safe to re-run any time: once nobody's mismatched, it's a no-op.

import { db, getAllPlayers, getSeasonSignupsWithStats, getSetting, setPlayerTeam } from '../lib/portal-db.js';

const apply  = process.argv.includes('--apply');
const season = getSetting('signup_target_season', '');

if (!season) {
  console.log('No signup_target_season set — nothing to compare against. Nothing to do.');
  process.exit(0);
}

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually clear anything)'}  |  season: ${season}\n`);

const teams = new Map(db.prepare('SELECT id, name FROM teams').all().map(t => [t.id, t.name]));
const confirmedPlayerIds = new Set(
  getSeasonSignupsWithStats(season)
    .filter(s => s.status === 'confirmed' && s.player_id)
    .map(s => s.player_id)
);

const stale = getAllPlayers().filter(p => p.team_id && !confirmedPlayerIds.has(p.id));

if (!stale.length) {
  console.log('No players with a stale team assignment found. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${stale.length} player(s) still on a team without being confirmed for season ${season}:\n`);
for (const p of stale) {
  console.log(`  ${p.name}  |  team: ${teams.get(p.team_id) || p.team_id}`);
}

if (apply) {
  console.log('');
  for (const p of stale) setPlayerTeam(p.id, '');
  console.log(`Applied. ${stale.length} player(s) cleared.`);
} else {
  console.log('\nDry run only — re-run with --apply to actually clear these.');
}
