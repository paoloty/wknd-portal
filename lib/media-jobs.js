// Media jobs: videos the admin asked for that render in the background (the Processing list,
// /admin/media). One row per video. The web server only queues jobs and shows their state; the
// actual render runs in a child process (scripts/render-potg.js) started by startMediaWorker(),
// one job at a time, so a render never blocks the site.
//
// Files live under data/media/jobs/<id>/: the uploaded photos (photo-1.jpg … photo-6.jpg) and,
// once rendered, out/ with the deliverables (see OUTPUT_FILES).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { db } from './portal-db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MEDIA_ROOT = path.join(__dirname, '..', 'data', 'media');
export const UPLOAD_DIR = path.join(MEDIA_ROOT, 'uploads');
export const jobDir = id => path.join(MEDIA_ROOT, 'jobs', String(id));

db.exec(`
  CREATE TABLE IF NOT EXISTS media_jobs (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,              -- 'potg_video'
    title        TEXT NOT NULL DEFAULT '',
    game_id      TEXT,
    player_id    TEXT,
    config_json  TEXT NOT NULL DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'queued',  -- queued | processing | done | failed
    progress     REAL NOT NULL DEFAULT 0,          -- 0..1 while processing
    stage        TEXT NOT NULL DEFAULT '',
    error        TEXT NOT NULL DEFAULT '',
    created_by   TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL,
    started_at   INTEGER,
    finished_at  INTEGER
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS media_jobs_status ON media_jobs(status, created_at)`);

// What a finished POTG job produces, in the order the Processing page lists them.
export const OUTPUT_FILES = [
  { name: 'potg.mp4',          label: 'Video with sound' },
  { name: 'potg-no-audio.mp4', label: 'Video, no audio' },
  { name: 'sfx.wav',           label: 'Stem: intro/outro sounds' },
  { name: 'ambience.wav',      label: 'Stem: court ambience' },
];

export function createMediaJob({ kind, title, gameId, playerId, config, createdBy }) {
  const id = Date.now().toString(36) + randomBytes(3).toString('hex');
  db.prepare(`INSERT INTO media_jobs (id, kind, title, game_id, player_id, config_json, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, kind, title || '', gameId || null, playerId || null, JSON.stringify(config || {}), createdBy || '', Date.now());
  return id;
}

export function getMediaJob(id) {
  const row = db.prepare('SELECT * FROM media_jobs WHERE id = ?').get(String(id));
  return row ? { ...row, config: JSON.parse(row.config_json || '{}') } : null;
}

export function listMediaJobs(limit = 60) {
  return db.prepare('SELECT * FROM media_jobs ORDER BY created_at DESC LIMIT ?').all(limit)
    .map(r => ({ ...r, config: JSON.parse(r.config_json || '{}') }));
}

export function updateMediaJob(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE media_jobs SET ${keys.map(k => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...fields, id });
}

export function deleteMediaJob(id) {
  db.prepare('DELETE FROM media_jobs WHERE id = ?').run(String(id));
  fs.rmSync(jobDir(id), { recursive: true, force: true });
}

// Re-queue a failed job (keeps its photos and settings).
export function retryMediaJob(id) {
  updateMediaJob(id, { status: 'queued', progress: 0, stage: '', error: '', started_at: null, finished_at: null });
  kickMediaWorker();
}

export function outputPath(id, name) {
  if (!OUTPUT_FILES.some(f => f.name === name)) return null;
  const p = path.join(jobDir(id), 'out', name);
  return fs.existsSync(p) ? p : null;
}

// ── Auto-cleanup ─────────────────────────────────────────────────────────────────────────
// Finished videos keep their files for KEEP_DAYS (enough to download and post), then the
// files go and the row stays as 'expired' (so the list still shows what was made). Failed jobs
// are removed entirely after KEEP_DAYS, editor uploads that never made it into a job after
// UPLOAD_DAYS. Safety net: if finished videos pass MAX_BYTES in total, the oldest go first.
// Runs on boot and every 6 hours. Anything can still be deleted by hand from /admin/media.
export const KEEP_DAYS = 30;
const UPLOAD_DAYS = 2;
const MAX_BYTES = 5 * 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;

function dirBytes(dir) {
  let n = 0;
  try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); n += e.isDirectory() ? dirBytes(p) : fs.statSync(p).size; } } catch {}
  return n;
}

export function expireMediaJob(id) {
  fs.rmSync(jobDir(id), { recursive: true, force: true });
  updateMediaJob(id, { status: 'expired', progress: 0, stage: '' });
}

export function expiresAt(job) { return (job.finished_at || job.created_at) + KEEP_DAYS * DAY; }

export function cleanupMedia(now = Date.now()) {
  const done = db.prepare(`SELECT id, created_at, finished_at FROM media_jobs WHERE status = 'done' ORDER BY COALESCE(finished_at, created_at) ASC`).all();
  for (const j of done) if (now >= expiresAt(j)) expireMediaJob(j.id);
  for (const j of db.prepare(`SELECT id FROM media_jobs WHERE status = 'failed' AND COALESCE(finished_at, created_at) < ?`).all(now - KEEP_DAYS * DAY)) deleteMediaJob(j.id);
  // size cap, oldest finished first
  const left = db.prepare(`SELECT id FROM media_jobs WHERE status = 'done' ORDER BY COALESCE(finished_at, created_at) ASC`).all().map(j => ({ id: j.id, bytes: dirBytes(jobDir(j.id)) }));
  let total = left.reduce((a, j) => a + j.bytes, 0);
  for (const j of left) { if (total <= MAX_BYTES) break; expireMediaJob(j.id); total -= j.bytes; }
  // stray editor uploads
  try {
    for (const f of fs.readdirSync(UPLOAD_DIR)) { const p = path.join(UPLOAD_DIR, f); if (now - fs.statSync(p).mtimeMs > UPLOAD_DAYS * DAY) fs.rmSync(p, { force: true }); }
  } catch {}
}

// ── Worker ──────────────────────────────────────────────────────────────────────────────
// Polls for queued jobs and renders them one at a time in a child process. A job left
// 'processing' by a restart goes back to the queue on boot.
let running = null;
let timer = null;
const RENDERERS = { potg_video: path.join(__dirname, '..', 'scripts', 'render-potg.js') };

function nextJob() {
  if (running) return;
  const job = db.prepare(`SELECT id, kind FROM media_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`).get();
  if (!job) return;
  const script = RENDERERS[job.kind];
  if (!script) { updateMediaJob(job.id, { status: 'failed', error: `Unknown job type ${job.kind}`, finished_at: Date.now() }); return; }
  updateMediaJob(job.id, { status: 'processing', progress: 0, stage: 'Starting', started_at: Date.now(), error: '' });
  // nice: renders yield to the web server for CPU.
  const [cmd, args] = process.platform === 'win32' ? [process.execPath, [script, job.id]] : ['nice', ['-n', '15', process.execPath, script, job.id]];
  const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'pipe'], env: process.env });
  running = { id: job.id, child };
  let err = '';
  child.stderr.on('data', d => { err = (err + d.toString()).slice(-4000); process.stderr.write(d); });
  child.on('error', e => { err += String(e); });
  child.on('close', code => {
    const row = getMediaJob(job.id);
    if (row && row.status === 'processing') {
      if (code === 0) updateMediaJob(job.id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
      else updateMediaJob(job.id, { status: 'failed', error: (err.trim().split('\n').slice(-6).join('\n') || `Renderer exited with code ${code}`), finished_at: Date.now() });
    }
    running = null;
    setImmediate(nextJob);
  });
}

export function kickMediaWorker() { setImmediate(nextJob); }

export function startMediaWorker() {
  if (timer) return;
  db.prepare(`UPDATE media_jobs SET status = 'queued', progress = 0, stage = '' WHERE status = 'processing'`).run();
  timer = setInterval(nextJob, 5000);
  const clean = () => { try { cleanupMedia(); } catch (err) { console.error('Media cleanup failed:', err); } };
  clean(); setInterval(clean, 6 * 60 * 60 * 1000).unref?.();
  timer.unref?.();
  kickMediaWorker();
}
