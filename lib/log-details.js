// What may go in admin_logs.details. Every write passes through here (insertAdminLog), so a
// route posting a photo or a long writeup can't bloat the table: by 2026-11 uploaded photos
// were 122 MB of the 158 MB in admin_logs. No database in here: scripts/scrub-admin-logs.js
// runs the same cleaning over old rows.

const SECRET_KEY = /^(password|new_password|current_password|confirm|token|secret|otp|code)$/i;
const MAX_TEXT = 500;
const MAX_ITEMS = 20;
const MAX_TOTAL = 4000;
const MAX_KEYS = 200; // no form has this many fields: it's a file's bytes (below)

const sizeLabel = bytes => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
const isBytes = v => ArrayBuffer.isView(v) || v instanceof ArrayBuffer;
// An uploaded file (a raw request body), or the same file once it has been through JSON as
// { "0": 137, "1": 80, … }: one key per byte, millions of them, so never walk its keys.
const fileLabel = v => `[file, ${sizeLabel(v.byteLength ?? Object.keys(v).length)}]`;
const isByteDump = v => {
  if (Array.isArray(v)) return false;
  let n = 0;
  for (const k in v) { if (++n > MAX_KEYS) return true; if (n === 1 && k !== '0') return false; }
  return false;
};

function cleanValue(v, depth) {
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return `[file, ${sizeLabel(v.length * 0.75)}]`;
    return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  }
  if (v === null || typeof v !== 'object') return v;
  if (isBytes(v) || isByteDump(v)) return fileLabel(v);
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
  if (isBytes(details) || isByteDump(details)) return { upload: fileLabel(details) };
  const clean = cleanObject(details, 0);
  if (JSON.stringify(clean).length <= MAX_TOTAL) return clean;
  // Still too long (a big form): keep the short values, name the rest.
  const short = {};
  const dropped = [];
  let kept = 2;
  for (const [k, v] of Object.entries(clean)) {
    const size = JSON.stringify(v).length;
    if (size <= 120 && kept < MAX_TOTAL / 2) { short[k] = v; kept += size + k.length + 4; }
    else dropped.push(k);
  }
  return dropped.length ? { ...short, not_kept: dropped.join(', ').slice(0, 300) } : short;
}
