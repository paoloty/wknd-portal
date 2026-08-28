// One-off + rerunnable data fix: a papawis_signups row can end up pointing at a player_id
// that no longer exists in `players` — a player's browser session outlived their account
// deletion (deletePlayer() never touches the session store) and they joined a game after
// being deleted, since POST /papawis/:id/join never re-checked the player still existed
// (now fixed in server.js). These rows are invisible everywhere in the app — every
// roster/list query inner-joins to players — but still count toward games.confirmed_count,
// silently eating a real slot without showing up in any list.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/fix-orphaned-papawis-signups.js            — dry run, prints what would change
//   node scripts/fix-orphaned-papawis-signups.js --apply    — actually cancels the orphaned signups
//
// Uses lib/portal-db.js's own DB connection, so it operates on whichever data/portal.db
// sits next to wherever you run it from — same file this app itself reads and writes.
// Safe to re-run any time: once there are no orphans left, it's a no-op. Cancels through
// the app's real cancelPapawisSignup() (not a raw UPDATE), so a freed confirmed slot still
// promotes the earliest waitlisted signup exactly like a normal admin cancel would.

import { db, getPapawisGame, cancelPapawisSignup } from '../lib/portal-db.js';

const apply = process.argv.includes('--apply');

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually cancel anything)'}\n`);

const orphans = db.prepare(`
  SELECT s.id, s.game_id, s.player_id, s.status, s.guest_name, s.signed_up_at
  FROM papawis_signups s
  LEFT JOIN players p ON p.id = s.player_id
  WHERE p.id IS NULL AND s.status != 'cancelled'
`).all();

if (!orphans.length) {
  console.log('No orphaned papawis signups found. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${orphans.length} orphaned signup(s):\n`);
for (const o of orphans) {
  const game = getPapawisGame(o.game_id);
  console.log(`  id=${o.id}  game="${game?.title || o.game_id}" (${game?.date || '?'})  status=${o.status}  player_id=${o.player_id}  guest_name="${o.guest_name}"  signed_up_at=${new Date(o.signed_up_at).toString()}`);
}

if (apply) {
  console.log('');
  for (const o of orphans) {
    const result = cancelPapawisSignup(o.id, 'admin');
    console.log(`  cancelled ${o.id}${result.promoted ? ` — promoted ${result.promoted.id} off the waitlist` : ''}`);
  }
  console.log(`\nApplied. ${orphans.length} row(s) cancelled.`);
} else {
  console.log('\nDry run only — re-run with --apply to actually cancel these.');
}
