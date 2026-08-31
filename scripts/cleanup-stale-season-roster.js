// One-off + rerunnable data fix: a season_roster row (a player's drag-and-drop team
// assignment on the Team Builder board) was never cleared when the underlying
// season_signups row moved away from 'confirmed' (withdrawn, rejected). Those players
// kept showing up on their assigned team's column on Team Builder, /my-team, and the
// admin Head View, despite no longer being part of the season. withdrawSeasonSignup()
// and the reject route now clear the roster slot at the moment status changes (see
// lib/portal-db.js's removeFromSeasonRoster) — this script cleans up any rows that
// already went stale before that fix existed.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/cleanup-stale-season-roster.js            — dry run, prints what would change
//   node scripts/cleanup-stale-season-roster.js --apply    — actually deletes the stale rows
//
// Uses lib/portal-db.js's own DB connection, so it operates on whichever data/portal.db
// sits next to wherever you run it from — same file this app itself reads and writes.
// Safe to re-run any time: once there's no stale roster row left, it's a no-op.

import { db } from '../lib/portal-db.js';

const apply = process.argv.includes('--apply');

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually delete anything)'}\n`);

const stale = db.prepare(`
  SELECT sr.id, sr.season, sr.team_id, ss.id AS signup_id, ss.status, r.full_name
  FROM season_roster sr
  JOIN season_signups ss ON ss.id = sr.signup_id
  JOIN registrations r ON r.id = ss.reg_id
  WHERE ss.status != 'confirmed'
`).all();

if (!stale.length) {
  console.log('No stale season_roster rows found. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${stale.length} stale roster row(s):\n`);
for (const s of stale) {
  console.log(`  signup=${s.signup_id}  name="${s.full_name}"  season=${s.season}  team_id=${s.team_id}  status=${s.status}`);
}

if (apply) {
  console.log('');
  const del = db.prepare('DELETE FROM season_roster WHERE id = ?');
  for (const s of stale) del.run(s.id);
  console.log(`Applied. ${stale.length} row(s) removed.`);
} else {
  console.log('\nDry run only — re-run with --apply to actually delete these.');
}
