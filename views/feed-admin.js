// Feed posts (2026-11-01, mockup claude.ai/artifact/PoEMwcjVXJxHchuAPdaj5r): the one screen for
// the app's feed posts, shown on the site (Admin → Players app → Feed posts,
// views/admin/app-announcements.js) and in the app (Me → Feed posts, server.js /app/admin/feed).
// Three tabs: New post (a type, its fields, date, pin, notify), Bulk add (past Facebook and
// YouTube links, one per line with a date) and Posted (each post: date, edit, pin, hide,
// delete). Its own small stylesheet (works on both); the browser side is public/feed-admin.js,
// posting to the server.js /admin/app/announcements routes.
import { escHtml as esc } from './layout.js';
import { manilaFormat } from './utils.js';

const TYPES = [
  ['announcement', '📣', 'Announcement', 'Need-to-know news. Notifies players.'],
  ['highlight', '▶', 'Highlight', 'A Facebook video or reel, or a YouTube clip, playing in the card.'],
  ['photos', '📷', 'Photos', 'Photos you pick (e.g. from a Facebook album), as a swipe gallery.'],
  ['throwback', '⟲', 'Throwback', 'Older content: a video link or photos, at its original date.'],
  ['facebook', 'f', 'Facebook', 'Any other post from our Facebook page, as Facebook shows it.'],
];
const LABEL = Object.fromEntries(TYPES.map(([k, , l]) => [k, l]));
// ms → "2026-11-01T18:30" in Manila, for <input type="datetime-local">.
const toInput = ms => new Date(ms + 8 * 3600e3).toISOString().slice(0, 16);
const fmt = ms => manilaFormat(ms, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// list: getAppAnnouncements() rows · refOptions: [[value, label]] (server.js feedRefOptions)
export function feedAdminBody({ list = [], refOptions = [], now = Date.now(), thumb = id => '' }) {
  const refSelect = (name, value = '') => `<select class="fa-in" name="${name}"><option value="">Not linked</option>${refOptions.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const typeSelect = value => `<select class="fa-in" name="type">${TYPES.map(([k, , l]) => `<option value="${k}"${k === value ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const row = a => {
    const at = a.shown_at || a.created_at, pinned = a.pinned_until > now;
    const what = [LABEL[a.type] || 'Announcement', a.photos ? `${a.photos} photo${a.photos === 1 ? '' : 's'}` : '', a.fb_url && a.type !== 'facebook' ? 'Facebook' : '', a.youtube_url ? 'YouTube' : ''].filter(Boolean).join(' · ');
    const img = a.photos || a.has_image ? thumb(a) : '';
    return `<div class="fa-post${a.hidden_at ? ' is-hidden' : ''}" data-fa-post="${esc(a.id)}">
      <div class="fa-post__top">
        ${img ? `<img class="fa-post__th" src="${esc(img)}" alt="">` : `<span class="fa-post__th fa-post__th--none">${esc((TYPES.find(t => t[0] === a.type) || TYPES[0])[1])}</span>`}
        <span class="fa-post__t"><b>${esc(a.title || (a.body ? String(a.body).slice(0, 60) : `${LABEL[a.type] || 'Announcement'} (no caption)`))}</b><small>${esc(what)} · ${esc(fmt(at))}${a.hidden_at ? ' · Hidden' : ''}${pinned ? ' · Pinned' : ''}</small></span>
      </div>
      <div class="fa-post__acts">
        <input class="fa-in fa-in--date" type="datetime-local" value="${esc(toInput(at))}" data-fa-date-in aria-label="Date in the feed">
        <button type="button" class="fa-btn" data-fa-act="date">Set date</button>
        <button type="button" class="fa-btn" data-fa-act="pin" data-days="${pinned ? 0 : 7}">${pinned ? 'Unpin' : 'Pin 7 days'}</button>
        <button type="button" class="fa-btn" data-fa-act="hide" data-hidden="${a.hidden_at ? '0' : '1'}">${a.hidden_at ? 'Show' : 'Hide'}</button>
        <button type="button" class="fa-btn fa-btn--danger" data-fa-act="delete">Delete</button>
      </div>
      <details class="fa-edit"><summary>Edit</summary>
        <div class="fa-grid">
          <label class="fa-f"><span>Type</span>${typeSelect(a.type || 'announcement')}</label>
          <label class="fa-f"><span>From a game or run</span>${refSelect('ref', a.ref || '')}</label>
          <label class="fa-f fa-f--wide"><span>Title or caption</span><input class="fa-in" name="title" value="${esc(a.title || '')}" maxlength="120"></label>
          <label class="fa-f fa-f--wide"><span>Message</span><textarea class="fa-in" name="body" rows="3" maxlength="2000">${esc(a.body || '')}</textarea></label>
          <label class="fa-f fa-f--wide"><span>${a.video ? 'Replace the video' : 'Video file'}</span><input class="fa-in" type="file" accept="video/mp4,video/quicktime,video/*" data-fa-editvideo><small>Plays in the card, iPhone too, instead of the Facebook player. Up to 150 MB.</small></label>
          <label class="fa-f fa-f--wide"><span>Extra link (e.g. the Facebook album)</span><input class="fa-in" name="link" value="${esc(a.link_url || '')}" placeholder="https://www.facebook.com/media/set/…"></label>
        </div>
        <button type="button" class="fa-btn fa-btn--primary" data-fa-act="edit">Save changes</button>
      </details>
    </div>`;
  };
  return `<div class="fa" data-fa>
  ${FA_CSS}
  <div class="fa-tabs" role="tablist"><button type="button" class="is-on" data-fa-tab="new">New post</button><button type="button" data-fa-tab="bulk">Bulk add</button><button type="button" data-fa-tab="posted">Posted · ${list.length}</button></div>

  <form class="fa-pane" data-fa-pane="new" data-fa-new autocomplete="off">
    <div class="fa-types" role="radiogroup" aria-label="Type">${TYPES.map(([k, ico, l], i) => `<label class="fa-type"><input type="radio" name="type" value="${k}"${i ? '' : ' checked'}><span><i>${ico}</i>${l}</span></label>`).join('')}</div>
    <p class="fa-help" data-fa-typehelp>${esc(TYPES[0][3])}</p>
    <div class="fa-grid">
      <label class="fa-f fa-f--wide" data-fa-for="highlight throwback"><span>Video file</span><input class="fa-in" type="file" accept="video/mp4,video/quicktime,video/*" data-fa-video><small>Plays right in the card, iPhone too (a Facebook link opens full screen there). Up to 150 MB, about 2 minutes. To use one of our Facebook videos or reels, download it from Meta Business Suite (Content → the video → ⋯ → Download), then pick it here.</small></label>
      <label class="fa-f fa-f--wide" data-fa-for="highlight throwback facebook"><span>Facebook link</span><input class="fa-in" name="facebook" placeholder="https://www.facebook.com/wkndbasketball/videos/…"><small>A public post, video or reel on our page.</small></label>
      <label class="fa-f fa-f--wide" data-fa-for="highlight throwback announcement"><span>YouTube link</span><input class="fa-in" name="youtube" placeholder="https://youtu.be/…"></label>
      <label class="fa-f fa-f--wide" data-fa-for="photos throwback"><span>Photos (up to 30)</span><input class="fa-in" type="file" accept="image/*" multiple data-fa-photos><small>From a Facebook album: download the photos you want, then pick them here.</small></label>
      <label class="fa-f fa-f--wide" data-fa-for="announcement"><span>Photo (optional)</span><input class="fa-in" type="file" accept="image/*" data-fa-photo></label>
      <label class="fa-f fa-f--wide"><span data-fa-titlelabel>Title</span><input class="fa-in" name="title" maxlength="120"></label>
      <label class="fa-f fa-f--wide"><span>Message</span><textarea class="fa-in" name="body" rows="3" maxlength="2000"></textarea></label>
      <label class="fa-f" data-fa-for="highlight photos throwback"><span>From a game or run</span>${refSelect('ref')}</label>
      <label class="fa-f" data-fa-for="photos throwback"><span>Facebook album link (optional)</span><input class="fa-in" name="link" placeholder="https://www.facebook.com/media/set/…"></label>
      <label class="fa-f"><span>Date in the feed</span><input class="fa-in" type="datetime-local" name="date" data-fa-newdate><small>Empty = now. An earlier date puts it lower in the feed.</small></label>
      <label class="fa-f"><span>Pin to the top of Home</span><select class="fa-in" name="pinDays"><option value="0">Don’t pin</option><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option></select></label>
      <label class="fa-check fa-f--wide"><input type="checkbox" name="notify" checked data-fa-notify> <span>Notify players (bell and phone)</span></label>
    </div>
    <div class="fa-row"><button type="submit" class="fa-btn fa-btn--primary">Post</button><span class="fa-msg" data-fa-msg role="status"></span></div>
  </form>

  <div class="fa-pane" data-fa-pane="bulk" hidden>
    <p class="fa-help">Past Facebook or YouTube links, one per line: <code>link, 2025-08-14</code>, and a type if you want one (<code>highlight</code>, <code>throwback</code>, <code>facebook</code>). With no type: older than 6 months is a Throwback, a video a Highlight, anything else a Facebook post. They go in at their dates and nobody is notified.</p>
    <textarea class="fa-in fa-bulk" rows="8" data-fa-bulk placeholder="https://www.facebook.com/wkndbasketball/videos/881234, 2025-08-14, throwback&#10;https://www.facebook.com/wkndbasketball/posts/55102, 2025-09-02"></textarea>
    <div class="fa-row"><button type="button" class="fa-btn" data-fa-act="bulk-check">Check</button><button type="button" class="fa-btn fa-btn--primary" data-fa-act="bulk-add" disabled>Add</button><span class="fa-msg" data-fa-bulkmsg role="status"></span></div>
    <div class="fa-prev" data-fa-prev></div>
  </div>

  <div class="fa-pane" data-fa-pane="posted" hidden>
    ${list.length ? list.map(row).join('') : '<p class="fa-help">Nothing posted yet.</p>'}
  </div>
  <script src="/feed-admin.js" defer></script>
</div>`;
}

const FA_CSS = `<style>
.fa { --fa-line: rgba(127,127,127,.22); --fa-soft: rgba(127,127,127,.1); --fa-amber: #f59332; display: grid; gap: 14px; max-width: 760px; }
.fa-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--fa-soft); }
.fa-tabs button { flex: 1; height: 36px; border: 0; border-radius: 9px; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 600; opacity: .65; cursor: pointer; }
.fa-tabs button.is-on { opacity: 1; background: var(--card-bg, var(--surface, #fff)); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.fa-pane { display: grid; gap: 12px; }
.fa-pane[hidden] { display: none; }
.fa-types { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.fa-type input { position: absolute; opacity: 0; pointer-events: none; }
.fa-type span { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 60px; padding: 6px 4px; border-radius: 12px; border: 1px solid var(--fa-line); font-size: 12px; font-weight: 600; text-align: center; cursor: pointer; }
.fa-type span i { font-style: normal; font-size: 18px; line-height: 1; }
.fa-type input:checked + span { border-color: var(--fa-amber); box-shadow: inset 0 0 0 1px var(--fa-amber); background: rgba(245,147,50,.12); }
.fa-type input:focus-visible + span { outline: 2px solid var(--fa-amber); outline-offset: 2px; }
.fa-help { margin: 0; font-size: 13px; opacity: .75; }
.fa-help code { font-size: 12px; }
.fa-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.fa-f { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 13px; }
.fa-f[hidden] { display: none; }
.fa-f > span { font-weight: 600; opacity: .8; }
.fa-f small { font-size: 12px; opacity: .65; }
.fa-f--wide, .fa-check { grid-column: 1 / -1; }
.fa-in { width: 100%; min-height: 36px; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--fa-line); background: var(--card-bg, var(--surface, #fff)); color: inherit; font: inherit; font-size: 14px; box-sizing: border-box; }
textarea.fa-in { min-height: 72px; resize: vertical; }
/* iPhone gives date fields their own minimum width and centred text: keep them to the column, text on the left. */
.fa-in[type="datetime-local"] { -webkit-appearance: none; appearance: none; min-width: 0; max-width: 100%; text-align: left; }
.fa-in[type="datetime-local"]::-webkit-date-and-time-value { text-align: left; }
.fa-bulk { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px; }
.fa-check { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.fa-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fa-btn { min-height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--fa-line); background: transparent; color: inherit; font: inherit; font-size: 13.5px; font-weight: 600; line-height: 1; cursor: pointer; }
.fa-btn--primary { background: var(--fa-amber); border-color: var(--fa-amber); color: #111; }
.fa-btn--danger { color: #dc2626; }
.fa-btn:disabled { opacity: .45; cursor: default; }
.fa-msg { font-size: 13px; opacity: .8; }
.fa-prev { display: grid; border-radius: 12px; border: 1px solid var(--fa-line); overflow: hidden; }
.fa-prev:empty { display: none; }
.fa-prev div { display: flex; gap: 8px; padding: 8px 12px; font-size: 13px; }
.fa-prev div + div { border-top: 1px solid var(--fa-line); }
.fa-prev .ok { color: #16a34a; font-weight: 700; } .fa-prev .bad { color: #dc2626; font-weight: 700; }
.fa-prev small { margin-left: auto; opacity: .7; white-space: nowrap; }
.fa-post { display: grid; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--fa-line); }
.fa-post.is-hidden { opacity: .6; }
.fa-post__top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.fa-post__th { flex: none; width: 48px; height: 48px; border-radius: 9px; object-fit: cover; }
.fa-post__th--none { display: flex; align-items: center; justify-content: center; background: var(--fa-soft); font-size: 18px; line-height: 1; }
.fa-post__t { flex: 1; min-width: 0; }
.fa-post__t b { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fa-post__t small { display: block; font-size: 12px; opacity: .7; }
.fa-post__acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.fa-in--date { width: auto; flex: 1 1 190px; }
.fa-edit summary { cursor: pointer; font-size: 13px; font-weight: 600; opacity: .8; }
.fa-edit[open] { display: grid; gap: 10px; }
@media (max-width: 560px) { .fa-types { grid-template-columns: repeat(3, minmax(0, 1fr)); } .fa-grid { grid-template-columns: minmax(0, 1fr); } }
</style>`;
