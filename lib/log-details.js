// What may go in admin_logs.details. Every write passes through here (insertAdminLog), so a
// route posting a photo or a long writeup can't bloat the table: by 2026-11 uploaded photos
// were 122 MB of the 158 MB in admin_logs. No database in here: scripts/scrub-admin-logs.js
// runs the same cleaning over old rows.

const SECRET_KEY = /^(password|new_password|current_password|confirm|token|secret|otp|code)$/i;
const MAX_TEXT = 500;
const MAX_ITEMS = 20;
const MAX_TOTAL = 4000;

const sizeLabel = bytes => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

function cleanValue(v, depth) {
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return `[file, ${sizeLabel(v.length * 0.75)}]`;
    return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  }
  if (v === null || typeof v !== 'object') return v;
  if (depth >= 3) return Array.isArray(v) ? `[${v.length} items]` : '[object]';
  if (Array.isArray(v)) {
    const items = v.slice(0, MAX_ITEMS).map(x => cleanValue(x, depth + 1));
    if (v.length > MAX_ITEMS) items.push(`… ${v.length - MAX_ITEMS} more`);
    return items;
  }
  return cleanObject(v, depth + 1);
}

function cleanObject(obj, depth) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!SECRET_KEY.test(k)) out[k] = cleanValue(v, depth);
  }
  return out;
}

export function cleanLogDetails(details) {
  if (!details || typeof details !== 'object') return {};
  const clean = cleanObject(details, 0);
  if (JSON.stringify(clean).length <= MAX_TOTAL) return clean;
  // Still too long (a big form): keep the short values, name the rest.
  const short = {};
  const dropped = [];
  for (const [k, v] of Object.entries(clean)) {
    if (JSON.stringify(v).length <= 120 && JSON.stringify(short).length < MAX_TOTAL / 2) short[k] = v;
    else dropped.push(k);
  }
  return dropped.length ? { ...short, not_kept: dropped.join(', ').slice(0, 300) } : short;
}
