// Admin → Players app → Announcements (/admin/app/announcements). Short posts for the top of
// the app's feed: text, optionally one photo or one YouTube link, optionally pinned to the top
// of Home for a few days. The photo is shrunk in the browser (1600px JPEG) and posted as a
// data URL with the rest (server.js POST /admin/app/announcements).
import { escHtml } from '../layout.js';
import { pageHeader, section, badge, button, emptyState, formCard, formSection, field, ago } from './ui.js';
import { manilaFormat } from '../utils.js';

const fmtTime = ms => manilaFormat(ms, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// list: getAppAnnouncements() rows
export function adminAnnouncementsBody({ list, now = Date.now() }) {
  const rows = list.length ? `<div class="aui-panel aui-panel--flush">${list.map(a => {
    const pinned = a.pinned_until > now;
    return `<div class="aui-action" style="cursor:default;align-items:flex-start;gap:12px">
      ${a.has_image ? `<img src="/admin/app/announcements/${escHtml(a.id)}/image?v=${a.updated_at}&w=160" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex:none">` : ''}
      <span class="aui-cell__stack" style="flex:1;min-width:0">
        <span class="aui-action__label"><b>${escHtml(a.title || '(no title)')}</b></span>
        <span class="aui-cell__sub" style="white-space:pre-line">${escHtml(String(a.body || '').slice(0, 240))}${String(a.body || '').length > 240 ? '…' : ''}</span>
        <span class="aui-cell__sub">${escHtml(fmtTime(a.created_at))} · ${escHtml(a.created_by || 'admin')}${a.youtube_url ? ' · ▶ video' : ''}</span>
      </span>
      <span style="display:flex;gap:6px;align-items:center;flex:none">
        ${pinned ? badge(`Pinned · ${ago(now, a.pinned_until)} left`, 'amber') : ''}
        ${pinned
          ? button('Unpin', { size: 'sm', attrs: `data-ann-pin="${escHtml(a.id)}" data-days="0"` })
          : button('Pin 7 days', { size: 'sm', attrs: `data-ann-pin="${escHtml(a.id)}" data-days="7"` })}
        ${button('Delete', { size: 'sm', kind: 'ghost', attrs: `data-ann-delete="${escHtml(a.id)}"` })}
      </span>
    </div>`;
  }).join('')}</div>` : emptyState({ title: 'No announcements yet', sub: 'Post one above. It shows in the app\'s feed right away.' });

  const form = `<form id="ann-form" autocomplete="off">${formCard(
    formSection({ title: 'New announcement', sub: 'Shows at the top of the players app\'s feed, newest first.', bodyHtml: `
      ${field({ label: 'Title', name: 'title', placeholder: 'Saturday tip-off moves to 6:00 AM', attrs: 'maxlength="120"' })}
      ${field({ label: 'Message', name: 'body', type: 'textarea', rows: 5, placeholder: 'What players need to know', attrs: 'maxlength="2000"' })}
      ${field({ label: 'YouTube link (optional)', name: 'youtube', placeholder: 'https://youtu.be/…' })}
      <label class="aui-field" for="ann-photo"><span class="aui-field__label">Photo (optional)</span><input class="aui-input" id="ann-photo" type="file" accept="image/*"><span class="aui-field__help">Shown above the message. With a YouTube link too, it becomes the video's cover.</span></label>
      ${field({ label: 'Pin to the top of Home', name: 'pinDays', type: 'select', value: '0', options: [['0', 'Don\'t pin'], ['1', '1 day'], ['3', '3 days'], ['7', '7 days']] })}
      <div style="display:flex;gap:10px;align-items:center">${button('Post to the app', { kind: 'primary', type: 'submit' })}<span class="aui-muted" data-ann-msg></span></div>
    ` }),
  )}</form>`;

  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Players app', title: 'Announcements', sub: 'Posts for every player in the app. Results, news and open Papawis runs show in the feed on their own.', actionsHtml: button('Back to Players app', { href: '/admin/app' }) })}
    ${form}
    ${section({ title: 'Posted', note: `· ${list.length}`, bodyHtml: rows })}
  </div>
  <script>
  (function () {
    var form = document.getElementById('ann-form'), msg = form.querySelector('[data-ann-msg]');
    var say = function (t) { msg.textContent = t || ''; };
    // Shrink the photo before upload: 1600px on the long side, JPEG.
    var shrink = function (file) {
      return new Promise(function (ok, fail) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('That file isn\\'t a photo we can read.')); };
        img.src = url;
      });
    };
    var post = function (url, data) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data || {}) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Couldn\\'t save. Try again.'); return j; }); });
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]'), f = form.elements, file = document.getElementById('ann-photo').files[0];
      if (!f.title.value.trim() && !f.body.value.trim()) return say('Add a title or a message.');
      btn.disabled = true; say('Posting…');
      (file ? shrink(file) : Promise.resolve('')).then(function (image) {
        return post('/admin/app/announcements', { title: f.title.value, body: f.body.value, youtube: f.youtube.value, pinDays: f.pinDays.value, image: image });
      }).then(function () { location.reload(); }, function (err) { btn.disabled = false; say(err.message); });
    });
    document.addEventListener('click', function (e) {
      var pin = e.target.closest('[data-ann-pin]'), del = e.target.closest('[data-ann-delete]');
      if (pin) post('/admin/app/announcements/' + encodeURIComponent(pin.getAttribute('data-ann-pin')) + '/pin', { days: pin.getAttribute('data-days') }).then(function () { location.reload(); }, function (err) { alert(err.message); });
      if (del && confirm('Delete this announcement? It disappears from the app.')) post('/admin/app/announcements/' + encodeURIComponent(del.getAttribute('data-ann-delete')) + '/delete').then(function () { location.reload(); }, function (err) { alert(err.message); });
    });
  })();
  </script>`;
}
