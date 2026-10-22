// Processing list (/admin/media), browser side: while anything is queued or rendering, re-fetch
// the list every 3 s (the server sends the rows' HTML, views/admin/potg-video.js mediaJobRow);
// Retry / Delete buttons.
(function () {
  'use strict';
  var list = document.querySelector('[data-mj-list]');
  if (!list) return;
  var ui = function () { return window.adminUi || { toast: function () {}, confirm: function () { return Promise.resolve(window.confirm('Sure?')); } }; };
  function active() { return !!list.querySelector('[data-mj-status="queued"],[data-mj-status="processing"]'); }
  function refresh() {
    return fetch('/admin/media.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); })
      .then(function (d) { if (typeof d.html === 'string') list.innerHTML = d.html; }).catch(function () {});
  }
  function tick() { (active() ? refresh() : Promise.resolve()).then(function () { setTimeout(tick, 3000); }); }
  setTimeout(tick, 1500);
  list.addEventListener('click', function (e) {
    var r = e.target.closest('[data-mj-retry]'), d = e.target.closest('[data-mj-delete]');
    if (!r && !d) return;
    var id = (r || d).getAttribute(r ? 'data-mj-retry' : 'data-mj-delete');
    (d ? ui().confirm({ title: 'Delete this video?', body: 'Its files are removed from the server.', sendLabel: 'Delete' }) : Promise.resolve(true)).then(function (ok) {
      if (!ok) return;
      fetch('/admin/media/' + encodeURIComponent(id) + (r ? '/retry' : '/delete'), { method: 'POST' })
        .then(function (res) { if (!res.ok) throw new Error(); return refresh(); })
        .catch(function () { ui().toast('That didn’t work. Try again.', { tone: 'error' }); });
    });
  });
})();
