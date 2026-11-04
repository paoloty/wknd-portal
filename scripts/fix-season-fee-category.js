// One-off data fix: the charges made by "Start season" for Season 4 were saved under the
// category 'season_fee', while every payment uses 'Season Fee' (views/utils.js), so Finance →
// By category showed them as two rows. The route now saves 'Season Fee'; this renames the
// old rows. Amounts, dates and statuses don't change, so balances don't either.
//
//   node scripts/fix-season-fee-category.js           reports what would change, writes nothing
//   node scripts/fix-season-fee-category.js --apply   backs up the database, then renames them
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.PORTAL_DB_FILE || path.join(__dirname, '..', 'data', 'portal.db');
const apply = process.argv.includes('--apply');

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });
const summary = () => db.prepare(`
  SELECT category, season, type, status, COUNT(*) AS n, SUM(amount) AS amount
  FROM transaction_ledger WHERE category IN ('season_fee', 'Season Fee')
  GROUP BY category, season, type, status ORDER BY season, category, type, status
`).all();
const balance = () => db.prepare(`
  SELECT SUM(CASE WHEN status = 'confirmed' AND type = 'charge' THEN amount WHEN status = 'confirmed' AND type = 'payment' THEN -amount ELSE 0 END) AS owed
  FROM transaction_ledger
`).get().owed;

const rows = db.prepare("SELECT COUNT(*) AS n FROM transaction_ledger WHERE category = 'season_fee'").get().n;
console.log(`${dbPath}\n${rows} rows to rename from 'season_fee' to 'Season Fee'.`);
console.table(summary());
if (!apply) { console.log('Nothing written. Run again with --apply.'); process.exit(0); }
if (!rows) { console.log('Nothing to do.'); process.exit(0); }

const backup = `${dbPath}.before-season-fee-fix-${new Date().toISOString().slice(0, 10)}`;
await db.backup(backup);
console.log(`Backup: ${backup}`);
const before = balance();
const changed = db.prepare("UPDATE transaction_ledger SET category = 'Season Fee' WHERE category = 'season_fee'").run().changes;
const after = balance();
console.log(`Renamed ${changed} rows. Net owed across the ledger: ${before} before, ${after} after.`);
console.table(summary());
