// Processing list (/admin/media), browser side: while anything is queued or rendering, re-fetch
// the list every 3 s (the server sends the rows' HTML, views/admin/potg-video.js mediaJobRow) and
// swap in only the rows that changed, so a preview you're watching keeps playing.
// Buttons: Approve & render hi-res, Re-render, Retry, Delete.
(function () {
  'use strict';
  var list = document.querySelector('[data-mj-list]');
  if (!list) return;
  var ui = function () { return window.adminUi || { toast: function () {}, confirm: function () { return Promise.resolve(window.confirm('Sure?')); } }; };
  var last = {}; // row id -> the HTML it was last drawn from
  function active() { return !!list.querySelector('[data-mj-status="queued"],[data-mj-status="processing"]'); }
  function merge(html) {
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var fresh = [].slice.call(tmp.querySelectorAll('[data-mj]'));
    if (!fresh.length) { list.innerHTML = html; last = {}; return; }
    var keep = {};
    fresh.forEach(function (row, i) {
      var id = row.getAttribute('data-mj'), cur = list.querySelector('[data-mj="' + id + '"]');
      keep[id] = true;
      if (cur && last[id] === row.outerHTML) { if (list.children[i] !== cur) list.insertBefore(cur, list.children[i] || null); return; }
      last[id] = row.outerHTML;
      if (cur) cur.replaceWith(row); else list.insertBefore(row, list.children[i] || null);
    });
    [].slice.call(list.children).forEach(function (el) { if (!el.hasAttribute('data-mj') || !keep[el.getAttribute('data-mj')]) el.remove(); });
  }
  [].slice.call(list.querySelectorAll('[data-mj]')).forEach(function (r) { last[r.getAttribute('data-mj')] = r.outerHTML; });
  function refresh() {
    return fetch('/admin/media.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); })
      .then(function (d) { if (typeof d.html === 'string') merge(d.html); }).catch(function () {});
  }
  function tick() { (active() ? refresh() : Promise.resolve()).then(function () { setTimeout(tick, 3000); }); }
  setTimeout(tick, 1500);
  list.addEventListener('click', function (e) {
    var f = e.target.closest('[data-mj-final]'), r = e.target.closest('[data-mj-retry]'), d = e.target.closest('[data-mj-delete]'), rr = e.target.closest('[data-mj-rerender]');
    var btn = f || r || d || rr; if (!btn) return;
    var id = btn.getAttribute(f ? 'data-mj-final' : r ? 'data-mj-retry' : d ? 'data-mj-delete' : 'data-mj-rerender');
    var path = f ? '/final' : r ? '/retry' : d ? '/delete' : '/rerender';
    (d ? ui().confirm({ title: 'Delete this video?', body: 'Its files are removed from the server.', sendLabel: 'Delete' })
      : rr ? ui().confirm({ title: 'Re-render this video?', body: 'It renders again with the latest look and sound, using the same photos and settings. The current file is replaced when it’s done.', sendLabel: 'Re-render' })
      : Promise.resolve(true)).then(function (ok) {
      if (!ok) return;
      btn.disabled = true;
      fetch('/admin/media/' + encodeURIComponent(id) + path, { method: 'POST' })
        .then(function (res) { if (!res.ok) throw new Error(); if (f) ui().toast('Rendering the hi-res version. It takes about 2½ minutes.', { tone: 'ok' }); return refresh(); })
        .catch(function () { btn.disabled = false; ui().toast('That didn’t work. Try again.', { tone: 'error' }); });
    });
  });
})();
