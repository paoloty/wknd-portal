// One-off data fix: some transaction_ledger rows have season stored as a full
// label ("Season 3") instead of the bare value ("3") the rest of the app
// expects (Awards tabs, Season Setup, etc.) — caused by a misleading
// placeholder on the Ledger's manual Add Transaction / Bulk Charge forms
// ("e.g. Season 3"), now fixed at views/admin/ledger.js.
//
// Usage (run from the project root, same place server.js lives):
//   node scripts/fix-season-labels.js            — dry run, prints what would change
//   node scripts/fix-season-labels.js --apply     — actually applies the fix
//
// Uses the exact same DB path resolution as lib/portal-db.js, so it operates
// on whichever data/portal.db sits next to wherever you run it from.

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'portal.db');
const apply = process.argv.includes('--apply');

console.log(`DB: ${dbPath}`);
console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to actually change anything)'}\n`);

const db = new Database(dbPath);

function cleaned(season) {
  return String(season).replace(/^season\s*/i, '').trim();
}

// ── transaction_ledger — the one actually causing the Awards page bug ───────
const rows = db.prepare(`SELECT id, player_id, season FROM transaction_ledger WHERE season LIKE 'Season%' OR season LIKE 'season%'`).all();

if (!rows.length) {
  console.log('transaction_ledger: no bad season labels found. Nothing to do here.');
} else {
  console.log(`transaction_ledger: ${rows.length} row(s) with a bad season label:\n`);
  for (const r of rows) {
    console.log(`  id=${r.id}  player_id=${r.player_id}  "${r.season}" -> "${cleaned(r.season)}"`);
  }
  if (apply) {
    const update = db.prepare('UPDATE transaction_ledger SET season = ? WHERE id = ?');
    const tx = db.transaction(() => {
      for (const r of rows) update.run(cleaned(r.season), r.id);
    });
    tx();
    console.log(`\nApplied. ${rows.length} row(s) updated.`);
  } else {
    console.log('\nDry run only — re-run with --apply to make this change.');
  }
}

// ── season_quotas — informational only, not auto-fixed (season is the PK,
// so "fixing" a label here could collide with an existing correct row and
// needs a human decision on which value wins, not a blind overwrite) ────────
const quotaRows = db.prepare(`SELECT season, amount FROM season_quotas WHERE season LIKE 'Season%' OR season LIKE 'season%'`).all();
if (quotaRows.length) {
  console.log(`\nseason_quotas: ${quotaRows.length} row(s) also look affected (NOT auto-fixed, needs a manual look):`);
  for (const r of quotaRows) console.log(`  season="${r.season}"  amount=${r.amount}`);
} else {
  console.log('\nseason_quotas: clean, no bad labels found.');
}

db.close();
