#!/usr/bin/env node
// Renders one Player of the Game video job (lib/media-jobs.js). Started by the media worker as
//   node scripts/render-potg.js <jobId>
// and can be run by hand the same way to re-render a job.
//
// 0. Colour-matches the 6 photos to each other and grades them (lib/photo-match.js).
// 1. Opens assets/media/potg/template.html in headless Chrome, passes it the job's data and
//    photos, then captures every frame at 24 fps (preview 544x680, final 1080x1350) by calling setT(t) (frame-exact,
//    never real-time) and pipes the frames into ffmpeg.
// 2. Builds the sound from the template's own hit list (window.SFX): a real ball bounce at each
//    hit (intro, transitions, outro) and nothing else; deep, roomy gym bounces like the 3D intro.
// 3. Writes data/media/jobs/<id>/out/potg.mp4 (video with sound) and cleans up the rest.
//
// Needs Chrome/Chromium (CHROME_PATH, or a usual install path) and ffmpeg (FFMPEG_PATH or PATH).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import puppeteer from 'puppeteer-core';
import { getMediaJob, updateMediaJob, jobDir } from '../lib/media-jobs.js';
import { matchPhotos } from '../lib/photo-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'assets', 'media', 'potg', 'template.html');
const SFX_DIR = path.join(ROOT, 'assets', 'media', 'potg', 'sfx');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FPS = 24;

function findChrome() {
  const c = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  // chrome-headless-shell installed with @puppeteer/browsers into /opt/chrome (see docs/agents/features/media-jobs.md)
  try {
    const base = '/opt/chrome/chrome-headless-shell';
    for (const v of fs.readdirSync(base).sort().reverse()) c.push(path.join(base, v, 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
  } catch {}
  const hit = c.find(p => fs.existsSync(p));
  if (!hit) throw new Error('Chrome/Chromium not found. Install chromium or set CHROME_PATH.');
  return hit;
}

function run(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', ...args], { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.slice(-800)}`)));
    if (input) input(p.stdin);
  });
}

async function main() {
  const id = process.argv[2];
  const job = getMediaJob(id);
  if (!job) throw new Error(`No media job ${id}`);
  const cfg = job.config;
  // preview: 544x680 (even sizes for H.264), lighter encode; final: 1080x1350
  const preview = job.quality === 'preview';
  const scale = preview ? 544 / 1080 : 1;
  const dir = jobDir(id), out = path.join(dir, 'out'), tmp = path.join(dir, 'tmp');
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  const stage = (s, progress) => updateMediaJob(id, progress == null ? { stage: s } : { stage: s, progress });

  stage('Matching photo colours', 0.01);
  // Match the 6 photos to each other, then grade. Jobs from before render-time matching were
  // already graded on upload, so (e.g. on a Re-render) they're matched but not graded twice.
  const photoFiles = cfg.photos.map(p => path.join(dir, p.file));
  const usePhotos = await matchPhotos(photoFiles, cfg.photos.map((_, i) => path.join(tmp, `matched-${i + 1}.jpg`)), { grade: !!cfg.photosRaw });
  const data = {
    ...cfg.data,
    avatar: cfg.avatar && fs.existsSync(cfg.avatar) ? pathToFileURL(cfg.avatar).href : '',
    photos: cfg.photos.map((p, i) => ({ url: pathToFileURL(usePhotos[i]).href, fx: +p.fx, fy: +p.fy, zoom: +p.zoom, rot: +p.rot || 0 })),
  };

  const browser = await puppeteer.launch({
    executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu', '--font-render-hinting=none', '--disable-dev-shm-usage'],
  });
  let tl, sfx;
  const video = path.join(tmp, 'video.mp4');
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: 'load' });
    await page.evaluate(d => window.build(d), data);
    await page.waitForFunction('window.READY === true', { timeout: 60000 });
    ({ tl, sfx } = await page.evaluate(() => ({ tl: window.TIMELINE, sfx: window.SFX })));
    const N = Math.round(tl.DUR * FPS);
    stage(preview ? 'Rendering preview' : 'Rendering hi-res', 0.02);
    await run(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'medium', '-crf', preview ? '24' : '16',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], async stdin => {
      for (let k = 0; k < N; k++) {
        await page.evaluate(t => window.setT(t), k / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: preview ? 85 : 92 });
        if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
        if (k % 24 === 0) stage(`${preview ? 'Rendering preview' : 'Rendering hi-res'} ${k}/${N}`, 0.02 + 0.85 * k / N);
      }
      stdin.end();
    });
  } finally {
    await browser.close();
  }

  // ── sound ──
  stage('Mixing sound', 0.9);
  const dur = tl.DUR.toFixed(3);
  // Pre-mastered stereo hits (deep gym bounces with a hall tail, same recipe as the 3D court intro);
  // each file starts its hit LEAD seconds in.
  const LEAD = 0.06;
  const bank = { big: ['big1', 'big2'], b: ['bounce1', 'bounce2', 'bounce3', 'bounce4'], soft: ['soft'] };
  const used = { big: 0, b: 0, soft: 0 };
  const fileFor = k => { const list = bank[k] || bank.b; const name = list[used[k in bank ? k : 'b']++ % list.length]; return path.join(SFX_DIR, `${name}.wav`); };
  const sfxWav = path.join(tmp, 'sfx.wav');
  const inputs = [], parts = [];
  sfx.forEach((h, i) => {
    inputs.push('-i', fileFor(h.k));
    const ms = Math.max(0, Math.round((h.t - LEAD) * 1000));
    parts.push(`[${i}:a]volume=${(+h.g).toFixed(3)},adelay=${ms}|${ms}[s${i}]`);
  });
  const mixIn = sfx.map((_, i) => `[s${i}]`).join('');
  await run([...inputs, '-filter_complex', `${parts.join(';')};${mixIn}amix=inputs=${sfx.length}:normalize=0,apad,atrim=0:${dur},aformat=sample_rates=48000:channel_layouts=stereo[a]`,
    '-map', '[a]', '-c:a', 'pcm_s16le', sfxWav]);
  stage('Packaging', 0.96);
  await run(['-i', video, '-i', sfxWav, '-filter_complex', '[1:a]alimiter=limit=0.89[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', preview ? '128k' : '256k', '-shortest', '-movflags', '+faststart', path.join(out, 'potg.mp4')]);
  fs.rmSync(tmp, { recursive: true, force: true });
  updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err?.stack || String(err));
  try { updateMediaJob(process.argv[2], { status: 'failed', error: String(err?.message || err).slice(0, 2000), finished_at: Date.now() }); } catch {}
  process.exit(1);
});
