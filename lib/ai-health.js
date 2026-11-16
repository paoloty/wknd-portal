// AI provider health (2026-11-16): one row per provider attempt (lib/ai.js hands each one to
// recordAiCall), so Admin → AI writing can show which provider actually answered and the daily
// email can say when Claude stopped answering. Kept 30 days. Its own file so the table doesn't
// grow lib/portal-db.js.
import { db } from './portal-db.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, provider TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'call', ok INTEGER NOT NULL DEFAULT 0,
    model TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', status INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_ai_calls_provider ON ai_calls (provider, at);
`);

const stmtAdd = db.prepare('INSERT INTO ai_calls (at, provider, tier, kind, ok, model, error, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
let lastPrune = 0;
export function recordAiCall({ provider, tier = '', kind = 'call', ok, model = '', error = '', status = 0 }) {
  stmtAdd.run(Date.now(), String(provider), String(tier), kind === 'ping' ? 'ping' : 'call', ok ? 1 : 0, String(model).slice(0, 80), String(error).slice(0, 200), Number(status) || 0);
  if (Date.now() - lastPrune > 864e5) {
    lastPrune = Date.now();
    db.prepare('DELETE FROM ai_calls WHERE at < ?').run(Date.now() - 30 * 864e5);
  }
}

// Per provider since `since` (ms): real calls answered / failed, the newest success and the
// newest failure (with its reason), and the newest test from the admin button.
export function aiCallStats({ since = Date.now() - 7 * 864e5 } = {}) {
  const rows = db.prepare(`SELECT provider,
      SUM(CASE WHEN kind = 'call' AND ok = 1 THEN 1 ELSE 0 END) AS answered,
      SUM(CASE WHEN kind = 'call' AND ok = 0 THEN 1 ELSE 0 END) AS failed
    FROM ai_calls WHERE at >= ? GROUP BY provider`).all(since);
  const out = {};
  for (const r of rows) out[r.provider] = { answered: r.answered || 0, failed: r.failed || 0 };
  const lastOk = db.prepare('SELECT provider, MAX(at) AS at FROM ai_calls WHERE ok = 1 GROUP BY provider').all();
  const lastFail = db.prepare(`SELECT c.provider, c.at, c.error, c.kind FROM ai_calls c
    JOIN (SELECT provider, MAX(id) AS id FROM ai_calls WHERE ok = 0 GROUP BY provider) m ON m.id = c.id`).all();
  const lastPing = db.prepare(`SELECT c.* FROM ai_calls c
    JOIN (SELECT provider, MAX(id) AS id FROM ai_calls WHERE kind = 'ping' GROUP BY provider) m ON m.id = c.id`).all();
  const get = p => (out[p] ??= { answered: 0, failed: 0 });
  for (const r of lastOk) get(r.provider).lastOkAt = r.at;
  for (const r of lastFail) Object.assign(get(r.provider), { lastFailAt: r.at, lastError: r.error });
  for (const r of lastPing) get(r.provider).ping = { at: r.at, ok: !!r.ok, model: r.model, error: r.error };
  return out;
}

// When did this provider last answer anything (a real call or a test)? 0 = never on record.
export function aiLastAnswered(provider) {
  return db.prepare('SELECT MAX(at) AS at FROM ai_calls WHERE provider = ? AND ok = 1').get(provider)?.at || 0;
}
