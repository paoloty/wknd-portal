// One-off data fix (Paolo, 2026-11-05). Papawis ledger rows were saved with no season, so:
//   1. every Papawis row with a blank season gets one (lib/papawis-season.js: the latest season
//      that had started on the run's date, or the row's own date if it isn't linked to a run)
//   2. the old lowercase 'papawis' category becomes 'Papawis'
//   3. the one Season 4 fee payment filed as Game Fee moves to Season Fee (it stops if it doesn't
//      find exactly one, rather than guess)
// Amounts, dates and statuses never change, so nobody's balance does; it checks that and stops.
//
//   node scripts/fix-papawis-seasons.js           reports what would change, writes nothing
//   node scripts/fix-papawis-seasons.js --apply   backs up the database, then applies it
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { seasonOnDate } from '../lib/papawis-season.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.PORTAL_DB_FILE || path.join(__dirname, '..', 'data', 'portal.db');
const apply = process.argv.includes('--apply');
const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });

const starts = db.prepare("SELECT season, MIN(date) AS start FROM games WHERE season IS NOT NULL AND date != '' GROUP BY season").all();
console.log(dbPath);
console.log('Seasons start:', starts.map(s => `S${s.season} ${s.start}`).join(', '));

const rows = db.prepare(`
  SELECT t.id, t.date, t.type, t.status, t.amount, t.category, g.date AS run_date
  FROM transaction_ledger t LEFT JOIN papawis_games g ON g.id = t.reference_no
  WHERE lower(t.category) IN ('papawis', 'papawis deposit') AND (t.season IS NULL OR t.season = '')
`).all();
const plan = rows.map(r => ({ ...r, season: seasonOnDate(r.run_date || r.date, starts) }));
const summary = {};
for (const r of plan) {
  const s = (summary[r.season ? `Season ${r.season}` : '(no season: before the first)'] ??= { rows: 0, charged: 0, paid: 0, notConfirmed: 0 });
  s.rows++;
  if (r.status !== 'confirmed') s.notConfirmed++;
  else if (r.type === 'charge') s.charged += r.amount;
  else s.paid += r.amount;
}
console.log(`${plan.length} Papawis rows to tag:`);
console.table(summary);
const lower = db.prepare("SELECT COUNT(*) AS n FROM transaction_ledger WHERE category = 'papawis'").get().n;
console.log(`${lower} rows spelled 'papawis' become 'Papawis'.`);

const fee = db.prepare("SELECT id, amount, status, notes FROM transaction_ledger WHERE category = 'Game Fee' AND season = '4' AND type = 'payment' AND amount = 3750 AND notes LIKE '%Quota%'").all();
console.log(`Game Fee payments to move to Season Fee: ${fee.length}`, fee.map(f => `₱${f.amount} ${f.status} "${f.notes}"`).join('; '));
if (fee.length !== 1) { console.log('Expected exactly 1. Nothing written.'); process.exit(1); }

const owed = () => db.prepare(`SELECT COUNT(*) AS n, SUM(amount) AS amt,
  SUM(CASE WHEN status='confirmed' AND type='charge' THEN amount WHEN status='confirmed' AND type='payment' THEN -amount ELSE 0 END) AS owed
  FROM transaction_ledger`).get();
if (!apply) { console.log('Ledger now:', owed()); console.log('Nothing written. Run again with --apply.'); process.exit(0); }

const backup = `${dbPath}.before-papawis-seasons-${new Date().toISOString().slice(0, 10)}`;
await db.backup(backup);
console.log(`Backup: ${backup}`);
const before = owed();
const setSeason = db.prepare('UPDATE transaction_ledger SET season = ? WHERE id = ?');
db.transaction(() => {
  for (const r of plan) if (r.season) setSeason.run(r.season, r.id);
  db.prepare("UPDATE transaction_ledger SET category = 'Papawis' WHERE category = 'papawis'").run();
  db.prepare("UPDATE transaction_ledger SET category = 'Season Fee' WHERE id = ?").run(fee[0].id);
  const after = owed();
  if (after.n !== before.n || after.amt !== before.amt || after.owed !== before.owed) throw new Error('Totals moved: rolled back.');
})();
console.log('Ledger before:', before, 'after:', owed());
console.log('Blank-season Papawis rows left:', db.prepare("SELECT COUNT(*) AS n FROM transaction_ledger WHERE lower(category) IN ('papawis', 'papawis deposit') AND (season IS NULL OR season = '')").get().n);
