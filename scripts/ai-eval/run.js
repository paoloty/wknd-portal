// Runs the test set against the eval copy (setup.js first):
//   node scripts/ai-eval/run.js --scratch <dir> --name <run-name> [--full] [--only <id-prefix,...>]
// Starts the copy's server on its port, logs in with the copy's PORTAL_ADMIN_USER/PASS, posts
// to the real admin routes, and writes <scratch>/results/<name>/cases.json (+ digest.md): every
// draft, the facts/prompt it was given, every attempt's check results, and the AI call count.
// Stops the server when done. Never prints secrets.
import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import Database from 'better-sqlite3';
import { CASES } from './cases.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean));
const scratch = path.resolve(String(args.scratch || process.env.AI_EVAL_SCRATCH || ''));
const setup = JSON.parse(fs.readFileSync(path.join(scratch, 'setup.json'), 'utf8'));
const copy = setup.copy, port = setup.port;
const name = String(args.name || new Date().toISOString().replace(/[:.]/g, '-'));
const outDir = path.join(scratch, 'results', name);
fs.mkdirSync(outDir, { recursive: true });
const writerLog = path.join(scratch, 'writer.log.jsonl'), callLog = path.join(scratch, 'calls.log.jsonl');

const only = args.only ? String(args.only).split(',') : null;
const cases = CASES.filter(c => (only ? only.some(p => c.id.startsWith(p)) : args.full || c.tier === 'core'));

const env = Object.fromEntries(fs.readFileSync(path.join(copy, '.env'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const base = `http://127.0.0.1:${port}`;
const lineCount = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0);
const readLines = (f, from) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(from).map(l => JSON.parse(l)) : []);

// ── server ──
const server = spawn(process.execPath, ['server.js'], { cwd: copy, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog = fs.createWriteStream(path.join(outDir, 'server.log'));
server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
// Synchronous, so process.exit can't leave the copy's server running on the port.
const stop = () => { try { process.platform === 'win32' ? execFileSync('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' }) : server.kill(); } catch {} };
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(1); });
for (let i = 0; i < 60; i++) {
  try { await fetch(base + '/robots.txt'); break; } catch { await new Promise(r => setTimeout(r, 500)); }
  if (i === 59) { stop(); throw new Error('server did not start — see server.log'); }
}

// ── login ──
const login = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: env.PORTAL_ADMIN_USER || 'admin', password: env.PORTAL_ADMIN_PASS || '' }) });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie || login.headers.get('location') !== '/admin') { stop(); throw new Error(`admin login failed (status ${login.status})`); }
const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body || {}) });

// ── cases ──
const db = () => new Database(path.join(copy, 'data', 'portal.db'), { readonly: true });
const setting = key => { const d = db(); try { return d.prepare('SELECT value FROM site_settings WHERE key = ?').get(key)?.value ?? null; } finally { d.close(); } };
const results = [];
const callsBefore = lineCount(callLog);
for (const c of cases) {
  const w0 = lineCount(writerLog), c0 = lineCount(callLog), t0 = Date.now();
  let status = 0, json = null, stored = null;
  try {
    const r = c.kind === 'recap' ? await post(`/admin/games/${c.game}/generate-recap`, c.body)
      : c.kind === 'potg' ? await post(`/admin/games/${c.game}/generate-potg`, c.body)
      : c.kind === 'section' ? await post('/admin/section-summary/regenerate', { block: c.block })
      : c.kind === 'home' ? await post('/admin/home-summary/regenerate', { block: c.block })
      : await post('/admin/games/matchup-story/regenerate', { gameId: c.game });
    status = r.status;
    try { json = await r.json(); } catch { json = null; }
  } catch (e) { json = { error: String(e.message || e) }; }
  if (c.kind === 'section') stored = JSON.parse(setting(`section_summary_${c.block}`) || 'null');
  if (c.kind === 'home') stored = JSON.parse(setting(`home_summary_${c.block}`) || 'null');
  if (c.kind === 'story') stored = JSON.parse(setting(`games_matchup_story_${c.game}`) || 'null');
  const attempts = readLines(writerLog, w0);
  const calls = readLines(callLog, c0);
  const first = attempts.find(a => a.prompt);
  const facts = first ? (first.prompt.match(/FACTS \(the only things you may state\):\n([\s\S]*?)\n\n(?:HOW TO SAY IT|Rules:|[A-Z][^\n]*\n)/) || [])[1] || null : null;
  const final = attempts.find(a => a.final) || attempts.filter(a => !a.final).sort((x, y) => x.problems.length - y.problems.length)[0] || null;
  results.push({
    id: c.id, kind: c.kind, status, ms: Date.now() - t0,
    output: json?.writeup ?? stored ?? json,
    final: final ? { copy: final.copy, problems: final.problems, attempts: final.attempts || final.attempt } : null,
    attempts: attempts.filter(a => !a.final).map(a => ({ attempt: a.attempt, copy: a.copy, problems: a.problems })),
    prompt: first?.prompt || null, facts,
    calls: calls.length, models: [...new Set(calls.map(k => `${k.provider}:${k.model}`))],
    tokens: { in: calls.reduce((t, k) => t + (k.in || 0), 0), out: calls.reduce((t, k) => t + (k.out || 0), 0) },
  });
  const r = results[results.length - 1];
  console.log(`${c.id}: status ${status}, ${r.calls} calls, ${r.attempts.length} attempts, ${r.final?.problems.length ?? '?'} problems left (${Math.round(r.ms / 1000)}s)`);
}
stop();
const totalCalls = lineCount(callLog) - callsBefore;
fs.writeFileSync(path.join(outDir, 'cases.json'), JSON.stringify({ name, setup, at: new Date().toISOString(), totalCalls, results }, null, 2));

// ── digest ──
const text = r => (typeof r.output === 'string' ? r.output : r.output?.headline ? `${r.output.headline}\n${r.output.body}${r.output.notes ? '\n' + Object.entries(r.output.notes).map(([t, n]) => `${t}: ${n}`).join('\n') : ''}` : JSON.stringify(r.output));
const md = [`# AI eval run: ${name}`, `${new Date().toISOString()} — ${setup.providerOrder} / ${setup.models || setup.openaiModel} — ${totalCalls} AI calls, ${results.reduce((t, r) => t + r.tokens.in, 0)} in / ${results.reduce((t, r) => t + r.tokens.out, 0)} out tokens`, ''];
for (const r of results) {
  md.push(`## ${r.id}`, `status ${r.status} · ${r.calls} calls · ${r.attempts.length} attempts · models ${r.models.join(', ')}`, '');
  md.push('```', text(r), '```', '');
  for (const a of r.attempts) if (a.problems.length) md.push(`- attempt ${a.attempt} rejected: ${a.problems.join(' | ')}`);
  if (r.final?.problems.length) md.push(`- **left unfixed**: ${r.final.problems.join(' | ')}`);
  md.push('');
}
fs.writeFileSync(path.join(outDir, 'digest.md'), md.join('\n'));
console.log(`\n${results.length} cases, ${totalCalls} AI calls → ${outDir}`);
process.exit(0);
