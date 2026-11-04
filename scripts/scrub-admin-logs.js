// Runs the log cleaning (lib/log-details.js) over the admin_logs rows written before it
// existed, which still hold uploaded photos. Not run automatically.
//
//   node scripts/scrub-admin-logs.js                 reports what would change, writes nothing
//   node scripts/scrub-admin-logs.js --apply         backs up the database, then cleans the rows
//   node scripts/scrub-admin-logs.js --apply --vacuum  also gives the space back to the disk
//                                                    (needs free space about the database's size)
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanLogDetails } from '../lib/log-details.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.PORTAL_DB_FILE || path.join(__dirname, '..', 'data', 'portal.db');
const apply = process.argv.includes('--apply');
const vacuum = process.argv.includes('--vacuum');
const mb = n => `${(n / 1e6).toFixed(1)} MB`;

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true });
const changes = [];
let before = 0, after = 0;
for (const r of db.prepare('SELECT id, details FROM admin_logs').iterate()) {
  before += r.details.length;
  // A file's bytes logged as { "0": 137, … }: about 3.6 characters per byte. Parsing 55 MB of
  // this takes 7 seconds a row and shows nothing more.
  if (r.details.startsWith('{"0":') && r.details.length > 100000) {
    const clean = JSON.stringify({ upload: `[file, ${(r.details.length / 3.6e6).toFixed(1)} MB]` });
    after += clean.length;
    changes.push([clean, r.id]);
    continue;
  }
  let parsed;
  try { parsed = JSON.parse(r.details); } catch { after += r.details.length; continue; }
  const clean = JSON.stringify(cleanLogDetails(parsed));
  after += clean.length;
  if (clean !== r.details) changes.push([clean, r.id]);
}
console.log(`${dbPath}\n${changes.length} rows to clean. Log details ${mb(before)} → ${mb(after)}.`);
if (!apply) { console.log('Nothing written. Run again with --apply.'); process.exit(0); }

const backup = `${dbPath}.before-log-scrub-${new Date().toISOString().slice(0, 10)}`;
await db.backup(backup);
console.log(`Backup: ${backup}`);
const update = db.prepare('UPDATE admin_logs SET details = ? WHERE id = ?');
db.transaction(() => { for (const c of changes) update.run(...c); })();
console.log(`Cleaned ${changes.length} rows.`);
if (vacuum) { db.exec('VACUUM'); console.log('Vacuumed.'); }
