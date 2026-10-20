// Builds the isolated copy the AI eval runs against (see README.md):
//   node scripts/ai-eval/setup.js --scratch <dir> [--port 4100] [--provider-order openai]
//        [--openai-model gpt-4o-mini] [--gemini-model gemini-2.5-flash] [--clean]
// - copies the project (no .git, node_modules, data, assets) into <scratch>/portal
// - junctions node_modules and assets from the repo (removed with `rmdir`, never rm -rf)
// - snapshots data/portal.db with better-sqlite3 .backup() from a READONLY handle
// - writes a .env with every outbound secret except the AI keys removed, the eval port and
//   the AI_WRITER_LOG / AI_CALL_LOG trace files
// --clean removes the junctions first, then the copy (keeps <scratch>/results).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean));
const scratch = path.resolve(String(args.scratch || process.env.AI_EVAL_SCRATCH || path.join(REPO, '..', 'wknd-portal-ai-eval')));
const copy = path.join(scratch, 'portal');
const JUNCTIONS = ['node_modules', 'assets'];
const STRIP_ENV = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FACEBOOK_APP_SECRET', 'DB_EXPORT_KEY', 'ROSTER_API_KEY'];

function removeJunctions() {
  for (const j of JUNCTIONS) {
    const p = path.join(copy, j);
    if (!fs.existsSync(p)) continue;
    // rmdir on a junction removes the link only; never rm -rf through it.
    if (process.platform === 'win32') execFileSync('cmd', ['/c', 'rmdir', p], { stdio: 'inherit' });
    else fs.unlinkSync(p);
  }
}

if (args.clean) {
  if (fs.existsSync(copy)) {
    removeJunctions();
    for (const j of JUNCTIONS) if (fs.existsSync(path.join(copy, j))) throw new Error(`${j} still present in the copy — refusing to delete`);
    fs.rmSync(copy, { recursive: true, force: true });
  }
  console.log(`cleaned ${copy} (results kept)`);
  process.exit(0);
}

if (fs.existsSync(copy)) { removeJunctions(); fs.rmSync(copy, { recursive: true, force: true }); }
fs.mkdirSync(path.join(scratch, 'results'), { recursive: true });
const SKIP = new Set(['.git', 'node_modules', 'data', 'assets', 'portal.db', '.env']);
fs.cpSync(REPO, copy, { recursive: true, filter: src => !SKIP.has(path.basename(src)) || path.dirname(src) !== REPO });
for (const j of JUNCTIONS) {
  const target = path.join(REPO, j), link = path.join(copy, j);
  if (!fs.existsSync(target)) continue;
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'mklink', '/J', link, target], { stdio: 'ignore' });
  else fs.symlinkSync(target, link, 'dir');
}

// DB snapshot from a readonly handle: the owner's dev server may hold the real file open.
fs.mkdirSync(path.join(copy, 'data'), { recursive: true });
const src = new Database(path.join(REPO, 'data', 'portal.db'), { readonly: true });
await src.backup(path.join(copy, 'data', 'portal.db'));
src.close();
// Fresh, non-empty banner pools, so the copy's startup doesn't spend AI calls refilling them
// (server.js createBannerMessagePool refreshes an empty or day-old pool at boot).
const db = new Database(path.join(copy, 'data', 'portal.db'));
const put = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
for (const [k, row] of [['signup_banner_msgs_v2', { pill: 'eval', headline: 'eval', message: 'eval', cta: 'eval' }], ['registration_banner_msgs_v2', { pill: 'eval', headline: 'eval', message: 'eval', cta: 'eval', note: 'eval' }], ['peer_rating_aliases', { alias: 'Eval Fox' }]]) {
  const cur = (() => { try { return JSON.parse(db.prepare('SELECT value FROM site_settings WHERE key = ?').get(k)?.value || '[]'); } catch { return []; } })();
  if (!Array.isArray(cur) || !cur.length) put.run(k, JSON.stringify([row]));
  put.run(`${k}_at`, String(Date.now()));
}
db.close();

// .env: strip everything that can email or call out, except the AI providers.
const port = String(args.port || 4100);
const lines = fs.readFileSync(path.join(REPO, '.env'), 'utf8').split(/\r?\n/)
  .filter(l => !STRIP_ENV.some(k => l.startsWith(`${k}=`)))
  .filter(l => !((args['writer-order'] || args['check-order']) && /^(AI_ORDER_\w+|ANTHROPIC_CREDIT_UNTIL|ANTHROPIC_MODELS)=/.test(l)))
  .filter(l => !/^(PORT|AI_WRITER_LOG|AI_CALL_LOG|AI_PROVIDER_ORDER|AI_PRIMARY_PROVIDER|OPENAI_MODEL|OPENAI_MODELS|GEMINI_MODEL|GEMINI_MODELS|GROQ_MODEL|GROQ_MODELS|AI_RETRY_WAIT_MAX_MS|NODE_ENV)=/.test(l) || (!args['provider-order'] && /^(AI_PROVIDER_ORDER|AI_PRIMARY_PROVIDER)=/.test(l)) || (!args['openai-model'] && !args['openai-models'] && /^OPENAI_MODEL=/.test(l)) || (!args['gemini-model'] && !args['gemini-models'] && /^GEMINI_MODEL=/.test(l)));
lines.push(`PORT=${port}`);
lines.push(`AI_WRITER_LOG=${path.join(scratch, 'writer.log.jsonl')}`);
lines.push(`AI_CALL_LOG=${path.join(scratch, 'calls.log.jsonl')}`);
if (args['provider-order']) lines.push(`AI_PROVIDER_ORDER=${args['provider-order']}`);
// Tiered calls (lib/ai.js tierOrder) ignore AI_PROVIDER_ORDER. --writer-order pins the short,
// medium and long tiers; --check-order the fact checks. Either drops the credit date so the
// pin holds.
if (args['writer-order']) for (const t of ['SHORT', 'MEDIUM', 'LONG']) lines.push(`AI_ORDER_${t}=${args['writer-order']}`);
if (args['check-order']) lines.push(`AI_ORDER_CHECK=${args['check-order']}`);
if (args['anthropic-models']) lines.push(`ANTHROPIC_MODELS=${args['anthropic-models']}`);
if (args['openai-model']) lines.push(`OPENAI_MODEL=${args['openai-model']}`);
if (args['openai-models']) lines.push(`OPENAI_MODELS=${args['openai-models']}`);
if (args['gemini-model']) lines.push(`GEMINI_MODEL=${args['gemini-model']}`);
// --gemini-models / --openai-models: the whole fallback chain (comma list), to pin one model.
if (args['gemini-models']) lines.push(`GEMINI_MODELS=${args['gemini-models']}`);
if (args['groq-models']) lines.push(`GROQ_MODELS=${args['groq-models']}`);
// --retry-wait-ms: how long lib/ai.js may wait out a 429 (free tiers: Groq's tokens/minute reset is up to 60s).
if (args['retry-wait-ms']) lines.push(`AI_RETRY_WAIT_MAX_MS=${args['retry-wait-ms']}`);
fs.writeFileSync(path.join(copy, '.env'), lines.join('\n') + '\n');
const models = args['gemini-models'] || args['gemini-model'] || args['openai-models'] || args['openai-model'] || args['groq-models'] || '(repo .env)';
fs.writeFileSync(path.join(scratch, 'setup.json'), JSON.stringify({ copy, port, providerOrder: args['provider-order'] || '(repo .env)', openaiModel: args['openai-models'] || args['openai-model'] || '(repo .env)', geminiModel: args['gemini-models'] || args['gemini-model'] || '(repo .env)', models, at: new Date().toISOString() }, null, 2));
console.log(`copy ready at ${copy} (port ${port}, provider order ${args['provider-order'] || 'repo default'}, models ${models})`);
