import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fbCopyable, fbErrorText, encodeArgs, feedVideoLine } from '../lib/feed-video.js';

test('copyable links name a video or a post', () => {
  for (const u of ['https://www.facebook.com/reel/1111705071529441/', 'https://www.facebook.com/story.php?story_fbid=111&id=100', 'https://www.facebook.com/wknd/videos/881234', 'https://www.facebook.com/watch/?v=123', 'https://fb.watch/abc/', 'https://www.facebook.com/share/v/abc/']) assert.ok(fbCopyable(u), u);
  for (const u of ['https://www.facebook.com/story.php', 'https://fb.watch/', 'https://example.com/reel/1', '', 'not a link']) assert.ok(!fbCopyable(u), u);
});

test('720p H.264 + AAC with fast start, either way up', () => {
  const a = encodeArgs('in.mp4', 'out.mp4').join(' ');
  for (const s of ['libx264', '-crf 26', 'aac', '-b:a 128k', '+faststart', 'min(720,iw)', 'min(720,ih)']) assert.ok(a.includes(s), s);
  assert.equal(encodeArgs('in.mp4', 'out.mp4').at(-1), 'out.mp4');
});

test('a login wall gets its own message', () => {
  assert.match(fbErrorText('This video is only available for registered users. Use --cookies'), /login/);
  assert.match(fbErrorText('Cannot parse data'), /wouldn/);
});

test('the status line', () => {
  const reel = { type: 'highlight', fb_url: 'https://www.facebook.com/reel/1/', video: '' };
  assert.equal(feedVideoLine(reel).canCopy, true);
  assert.equal(feedVideoLine(reel, 0, { status: 'queued' }).running, true);
  assert.match(feedVideoLine(reel, 0, { status: 'processing', stage: 'Compressing', progress: 0.4 }).label, /Compressing…\s40%/);
  assert.equal(feedVideoLine(reel, 0, { status: 'failed', error: 'No' }).canCopy, true);
  assert.equal(feedVideoLine({ ...reel, video: 'video/mp4' }, 6.2 * 1024 * 1024).label, 'On our server · 6.2 MB');
  assert.equal(feedVideoLine({ ...reel, video: 'video/mp4' }, 1, { status: 'done' }).canCopy, false);
  assert.equal(feedVideoLine({ type: 'facebook', fb_url: 'https://www.facebook.com/story.php', video: '' }).tone, 'bad');
  assert.equal(feedVideoLine({ type: 'announcement', fb_url: '', video: '' }), null);
  assert.equal(feedVideoLine({ type: 'facebook', fb_url: 'https://www.facebook.com/story.php?story_fbid=1&id=2', video: '' }), null, 'may be a photo post');
});
