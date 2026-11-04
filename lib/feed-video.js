// Feed post videos on our own server (Paolo, 2026-11-04), for feed posts only, never game videos.
// Every video is compressed to one phone-friendly MP4 (720p H.264 + AAC, fast start), and a
// Facebook video can be copied here with yt-dlp. The work is a media job (lib/media-jobs.js,
// kind feed_video, scripts/feed-video.js); until it finishes a post plays what it had. This file
// is the plain rules: paths, the encoder's settings, which links can be copied and the admin's
// status line.
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FEED_VIDEO_DIR = path.join(__dirname, '..', 'data', 'feed-videos');
const safeId = id => String(id).replace(/[^\w-]/g, '');
export const feedVideoPath = id => path.join(FEED_VIDEO_DIR, `${safeId(id)}.mp4`);
// A video still arriving in pieces: moved over feedVideoPath when it's complete, so a post with a
// video keeps playing it during a replacement.
export const feedUploadPath = id => path.join(FEED_VIDEO_DIR, `${safeId(id)}.upload`);
// A Facebook copy longer than this stays on Facebook's player.
export const FEED_COPY_MAX_SEC = 300;

// 720 on the short side, whichever way up the video is, and never larger than it was.
const SCALE = "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'";
export const encodeArgs = (src, out) => ['-y', '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1', '-i', src,
  '-vf', SCALE, '-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-threads', '2', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out];

// A link that names a video or post: not facebook.com/story.php with its id lost.
export function fbCopyable(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return false; }
  if (!/(^|\.)facebook\.com$|(^|\.)fb\.watch$/i.test(u.hostname)) return false;
  if (/(^|\.)fb\.watch$/i.test(u.hostname)) return u.pathname.length > 1;
  return /\/(videos|reel|reels)\/[^/]+/i.test(u.pathname) || /^\/share\/[vr]\//i.test(u.pathname) || ['v', 'story_fbid', 'fbid'].some(k => u.searchParams.get(k));
}

// What yt-dlp's error means, for the admin.
export function fbErrorText(stderr) {
  const s = String(stderr || '');
  if (/registered users|log ?in|cookies/i.test(s)) return 'Facebook wants a login for this link. Download it from Meta Business Suite and upload it under Edit.';
  return 'Facebook wouldn’t give us this video: it may be deleted, private or blocked. It stays on Facebook’s player.';
}

const mb = n => `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
const VIDEO_TYPES = new Set(['highlight', 'throwback']);
// One post's line in Feed posts. post: { type, fb_url, video } · size: its file's bytes · job: its
// latest feed_video job, if any. { label, tone: ok | bad | work | '', running, canCopy, wrongLink }.
export function feedVideoLine(post, size = 0, job = null) {
  const running = job && (job.status === 'queued' || job.status === 'processing');
  const copyable = fbCopyable(post.fb_url);
  const isVideoPost = VIDEO_TYPES.has(post.type) || /\/(videos|watch|reel|reels)\b/i.test(String(post.fb_url || ''));
  if (running) {
    const pct = job.status === 'processing' && job.progress > 0 ? ` ${Math.round(job.progress * 100)}%` : '';
    return { label: job.status === 'queued' ? 'Waiting its turn…' : `${job.stage || 'Working'}…${pct}`, tone: 'work', running: true, canCopy: false };
  }
  if (job?.status === 'failed') return { label: job.error || 'That didn’t work.', tone: 'bad', running: false, canCopy: !post.video && copyable };
  if (post.video) return { label: `On our server${size ? ` · ${mb(size)}` : ''}`, tone: 'ok', running: false, canCopy: false };
  if (post.fb_url && !copyable) return { label: 'This Facebook link is incomplete. Paste the right one under Edit.', tone: 'bad', running: false, canCopy: false };
  if (post.fb_url && isVideoPost) return { label: 'Facebook’s player', tone: '', running: false, canCopy: true };
  return null;
}
