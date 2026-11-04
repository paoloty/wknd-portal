#!/usr/bin/env node
// One feed post's video (lib/feed-video.js). Started by the media worker as
//   node scripts/feed-video.js <jobId>
// config: { postId, source: 'facebook' | 'upload' }. A Facebook job downloads the video first with
// yt-dlp; then ffmpeg compresses it and the checked result replaces the post's file. The original
// is deleted, and on any failure the post keeps what it had.
//
// Needs ffmpeg + ffprobe (FFMPEG_PATH, FFPROBE_PATH or PATH) and yt-dlp (YTDLP_PATH or PATH).
import fs from 'fs';
import { spawn } from 'child_process';
import { getMediaJob, updateMediaJob } from '../lib/media-jobs.js';
import { getAppAnnouncement, setAppAnnouncementVideo } from '../lib/portal-db.js';
import { FEED_VIDEO_DIR, FEED_COPY_MAX_SEC, feedVideoPath, encodeArgs, fbErrorText } from '../lib/feed-video.js';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

function run(cmd, args, onOut) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; onOut?.(String(d)); });
    p.stderr.on('data', d => { err = (err + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} failed: ${err.slice(-800)}`), { stderr: err }))));
  });
}

async function probe(file) {
  const j = JSON.parse(await run(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration,format_name', '-of', 'json', file]));
  const v = (j.streams || []).find(s => s.codec_type === 'video'), a = (j.streams || []).find(s => s.codec_type === 'audio');
  return { video: v?.codec_name || '', audio: a?.codec_name || '', width: v?.width || 0, height: v?.height || 0, duration: Number(j.format?.duration) || 0, mp4: /mp4/.test(j.format?.format_name || '') };
}

async function main() {
  const id = process.argv[2];
  const job = getMediaJob(id);
  if (!job) throw new Error(`No job ${id}`);
  const { postId, source } = job.config;
  const post = getAppAnnouncement(postId);
  if (!post) { updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() }); return; }
  const stage = (s, progress) => updateMediaJob(id, progress == null ? { stage: s } : { stage: s, progress });
  await fs.promises.mkdir(FEED_VIDEO_DIR, { recursive: true });
  const final = feedVideoPath(postId), base = `${final}.${id}`, dl = `${base}.dl.mp4`, out = `${base}.out.mp4`, thin = `${base}.thin.mp4`, still = `${base}.jpg`;
  try {
    let src = final;
    if (source === 'facebook') {
      stage('Downloading from Facebook', 0);
      try {
        await run(YTDLP, ['--no-warnings', '--no-playlist', '--no-progress', '-f', 'bv*[width<=1920][height<=1920]+ba/b', '--merge-output-format', 'mp4', '--match-filters', `duration<=${FEED_COPY_MAX_SEC}`, ...(process.env.FFMPEG_PATH ? ['--ffmpeg-location', process.env.FFMPEG_PATH] : []), '-o', dl, post.fb_url]);
      } catch (e) { if (e.code === 'ENOENT') throw new Error('yt-dlp isn’t installed on the server.'); throw new Error(fbErrorText(e.stderr)); }
      if (!fs.existsSync(dl)) throw new Error('This video is longer than 5 minutes, so it stays on Facebook’s player.');
      src = dl;
    }
    // A newer upload arriving meanwhile has its own job: this one must not overwrite it.
    const srcStat = fs.statSync(src);
    const was = await probe(src);
    if (!was.video) throw new Error('That file has no video we can read.');

    stage('Compressing', 0);
    const secs = was.duration || 1;
    await run(FFMPEG, encodeArgs(src, out), text => {
      const m = /out_time_us=(\d+)/.exec(text);
      if (m) stage('Compressing', Math.min(0.99, Number(m[1]) / 1e6 / secs));
    });
    const now = await probe(out);
    if (now.video !== 'h264' || Math.abs(now.duration - was.duration) > Math.max(2, was.duration * 0.02)) throw new Error('The compressed copy didn’t check out, so the video was left as it was.');

    // Never worse: a file that already plays everywhere and came out no bigger stays itself, with
    // only the fast start added.
    let result = out;
    const plays = was.video === 'h264' && (was.audio === 'aac' || !was.audio) && Math.min(was.width, was.height) <= 720 && was.mp4;
    if (plays && fs.statSync(out).size >= srcStat.size) {
      await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-c', 'copy', '-movflags', '+faststart', thin]);
      result = thin;
    }

    // A cover when the post has none: a still from about a second in.
    let poster = '';
    if (!post.has_image) {
      try {
        await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.min(1, secs / 2)), '-i', result, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-q:v', '4', still]);
        poster = `data:image/jpeg;base64,${fs.readFileSync(still).toString('base64')}`;
      } catch {}
    }

    if (!getAppAnnouncement(postId)) return updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
    if (source !== 'facebook' && fs.statSync(final).mtimeMs !== srcStat.mtimeMs) return updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
    await fs.promises.rename(result, final);
    setAppAnnouncementVideo(postId, 'video/mp4', poster);
    updateMediaJob(id, { status: 'done', progress: 1, stage: '', finished_at: Date.now() });
  } finally {
    for (const f of [dl, out, thin, still]) fs.rmSync(f, { force: true });
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  try { updateMediaJob(process.argv[2], { status: 'failed', stage: '', error: String(err?.message || err).slice(0, 500), finished_at: Date.now() }); } catch {}
  process.exit(1);
});
