#!/usr/bin/env node
// Renders one Player of the Game video job (lib/media-jobs.js). Started by the media worker as
//   node scripts/render-potg.js <jobId>
// and can be run by hand the same way to re-render a job.
//
// 1. Opens assets/media/potg/template.html in headless Chrome, passes it the job's data and
//    photos, then captures every frame at 1080x1350 / 24 fps by calling setT(t) (frame-exact,
//    never real-time) and pipes the frames into ffmpeg.
// 2. Builds the sound from the template's own hit list (window.SFX): a real ball bounce at each
//    hit, plus a low court-ambience bed under the photos (window.AMBIENCE).
// 3. Writes data/media/jobs/<id>/out/: potg.mp4, potg-no-audio.mp4, sfx.wav, ambience.wav.
//
// Needs Chrome/Chromium (CHROME_PATH, or a usual install path) and ffmpeg (FFMPEG_PATH or PATH).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import puppeteer from 'puppeteer-core';
import { getMediaJob, updateMediaJob, jobDir } from '../lib/media-jobs.js';

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
  const dir = jobDir(id), out = path.join(dir, 'out'), tmp = path.join(dir, 'tmp');
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
  const stage = (s, progress) => updateMediaJob(id, progress == null ? { stage: s } : { stage: s, progress });

  stage('Loading', 0.01);
  const data = {
    ...cfg.data,
    avatar: cfg.avatar && fs.existsSync(cfg.avatar) ? pathToFileURL(cfg.avatar).href : '',
    photos: cfg.photos.map(p => ({ url: pathToFileURL(path.join(dir, p.file)).href, fx: +p.fx, fy: +p.fy, zoom: +p.zoom })),
  };

  const browser = await puppeteer.launch({
    executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-gpu', '--font-render-hinting=none', '--disable-dev-shm-usage'],
  });
  let tl, sfx, amb;
  const video = path.join(tmp, 'video.mp4');
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: 'load' });
    await page.evaluate(d => window.build(d), data);
    await page.waitForFunction('window.READY === true', { timeout: 60000 });
    ({ tl, sfx, amb } = await page.evaluate(() => ({ tl: window.TIMELINE, sfx: window.SFX, amb: window.AMBIENCE })));
    const N = Math.round(tl.DUR * FPS);
    stage('Rendering frames', 0.02);
    await run(['-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], async stdin => {
      for (let k = 0; k < N; k++) {
        await page.evaluate(t => window.setT(t), k / FPS);
        const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
        if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
        if (k % 24 === 0) stage(`Rendering frames ${k}/${N}`, 0.02 + 0.85 * k / N);
      }
      stdin.end();
    });
  } finally {
    await browser.close();
  }

  // ── sound ──
  stage('Mixing sound', 0.9);
  const dur = tl.DUR.toFixed(3);
  const bounces = [1, 2, 3, 4].map(i => path.join(SFX_DIR, `bounce${i}.wav`));
  const sfxWav = path.join(out, 'sfx.wav'), ambWav = path.join(out, 'ambience.wav');
  const inputs = [], parts = [];
  sfx.forEach((h, i) => {
    inputs.push('-i', bounces[i % bounces.length]);
    const ms = Math.max(0, Math.round(h.t * 1000));
    parts.push(`[${i}:a]volume=${(+h.g).toFixed(3)},adelay=${ms}|${ms}[s${i}]`);
  });
  const mixIn = sfx.map((_, i) => `[s${i}]`).join('');
  await run([...inputs, '-filter_complex', `${parts.join(';')};${mixIn}amix=inputs=${sfx.length}:normalize=0,apad,atrim=0:${dur},aformat=sample_rates=48000:channel_layouts=stereo[a]`,
    '-map', '[a]', '-c:a', 'pcm_s16le', sfxWav]);
  const aFrom = amb.from, aLen = (amb.to - amb.from);
  await run(['-stream_loop', '-1', '-i', path.join(SFX_DIR, 'ambience.wav'), '-filter_complex',
    `[0:a]atrim=0:${aLen.toFixed(3)},afade=t=in:d=0.8,afade=t=out:st=${(aLen - 1.2).toFixed(3)}:d=1.2,adelay=${Math.round(aFrom * 1000)}|${Math.round(aFrom * 1000)},apad,atrim=0:${dur},aformat=sample_rates=48000:channel_layouts=stereo[a]`,
    '-map', '[a]', '-c:a', 'pcm_s16le', ambWav]);

  stage('Packaging', 0.96);
  await run(['-i', video, '-i', sfxWav, '-i', ambWav, '-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0,alimiter=limit=0.89[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', path.join(out, 'potg.mp4')]);
  fs.copyFileSync(video, path.join(out, 'potg-no-audio.mp4'));
  fs.rmSync(tmp, { recursive: true, force: true });
  updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err?.stack || String(err));
  try { updateMediaJob(process.argv[2], { status: 'failed', error: String(err?.message || err).slice(0, 2000), finished_at: Date.now() }); } catch {}
  process.exit(1);
});
