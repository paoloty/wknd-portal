// Feed posts, the browser side (views/feed-admin.js; on the site and in the app). Tabs; the
// fields each type uses; Notify off for an earlier date; photos shrunk here (1600px JPEG) and
// sent one at a time to a post made hidden, then Publish; the bulk add's Check then Add; and
// each posted item's Set date, Pin, Hide, Delete and Edit. Server: /admin/app/announcements.
(function () {
  var root = document.querySelector('[data-fa]');
  if (!root || root._fa) return;
  root._fa = true;
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var post = function (url, data) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.error) throw new Error(j.error || 'Couldn’t save. Try again.'); return j; }); });
  };
  var HELP = {
    announcement: 'Need-to-know news. Notifies players.',
    highlight: 'A Facebook video or reel, or a YouTube clip, playing in the card.',
    photos: 'Photos you pick (e.g. from a Facebook album), as a swipe gallery.',
    throwback: 'Older content: a video link or photos, at its original date.',
    facebook: 'Any other post from our Facebook page, as Facebook shows it.',
  };

  // Tabs
  $$('[data-fa-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-fa-tab]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      $$('[data-fa-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-fa-pane') !== b.getAttribute('data-fa-tab'); });
    });
  });

  // New post: the type's fields; Notify on for announcements, off for the rest and for an earlier date.
  var form = $('[data-fa-new]'), msg = $('[data-fa-msg]'), notify = $('[data-fa-notify]'), dateIn = $('[data-fa-newdate]');
  var say = function (t) { msg.textContent = t || ''; };
  var type = function () { return (form.querySelector('input[name="type"]:checked') || {}).value || 'announcement'; };
  var isPast = function () { var v = dateIn.value; return !!v && Date.parse(v + ':00+08:00') < Date.now() - 12 * 3600e3; };
  var applyType = function () {
    var t = type();
    $$('[data-fa-for]', form).forEach(function (f) { f.hidden = f.getAttribute('data-fa-for').split(' ').indexOf(t) < 0; });
    $('[data-fa-typehelp]').textContent = HELP[t] || '';
    $('[data-fa-titlelabel]').textContent = t === 'announcement' ? 'Title' : 'Caption';
    notify.checked = t === 'announcement' && !isPast();
  };
  form.addEventListener('change', function (e) { if (e.target.name === 'type') applyType(); if (e.target === dateIn && isPast()) notify.checked = false; });
  applyType();

  // Shrink a photo: 1600px on the long side, JPEG.
  var shrink = function (file) {
    return new Promise(function (ok, fail) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('One of the files isn’t a photo we can read.')); };
      img.src = url;
    });
  };
  // A still from about a second in, as the video's cover (720px JPEG); none if the browser can't.
  var frameOf = function (file) {
    return new Promise(function (ok) {
      var v = document.createElement('video'), url = URL.createObjectURL(file), finished = false;
      var end = function (d) { if (finished) return; finished = true; URL.revokeObjectURL(url); ok(d || ''); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = function () { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (x) { end(''); } };
      v.onseeked = function () {
        try {
          var k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
          c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          end(c.toDataURL('image/jpeg', 0.8));
        } catch (x) { end(''); }
      };
      v.onerror = function () { end(''); };
      setTimeout(function () { end(''); }, 8000);
    });
  };
  // Send a video in 4 MB pieces, then its cover still (Server: …/video, …/video/done).
  var sendVideo = function (id, video, tell) {
    var base = '/admin/app/announcements/' + encodeURIComponent(id) + '/video', CH = 4 * 1024 * 1024, off = 0;
    var next = function () {
      if (off >= video.size) return frameOf(video).then(function (poster) { return post(base + '/done', { type: video.type || 'video/mp4', poster: poster }); });
      (tell || say)('Uploading the video… ' + Math.round(off / video.size * 100) + '%');
      return fetch(base + '?offset=' + off, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body: video.slice(off, off + CH) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok) throw new Error(j.error || 'The upload stopped. Try again.'); off = j.size; return next(); }); });
    };
    return next();
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, t = type(), btn = form.querySelector('button[type=submit]');
    var many = $('[data-fa-photos]').files, one = $('[data-fa-photo]').files[0];
    var video = (t === 'highlight' || t === 'throwback') ? $('[data-fa-video]').files[0] : null;
    if (video && video.size > 150 * 1024 * 1024) return say('Videos can be up to 150 MB.');
    var photos = (t === 'photos' || t === 'throwback') ? Array.prototype.slice.call(many || []) : [];
    if (photos.length > 30) return say('Up to 30 photos a post.');
    var data = { type: t, title: f.title.value, body: f.body.value, facebook: f.facebook.value, youtube: f.youtube.value, ref: f.ref.value, link: f.link.value, date: f.date.value, pinDays: f.pinDays.value, notify: f.notify.checked };
    btn.disabled = true; say('Posting…');
    var done = function () { say('Posted.'); location.reload(); };
    var fail = function (err) { btn.disabled = false; say(err.message); };
    if (video) {
      data.draft = true; data.video = true;
      post('/admin/app/announcements', data).then(function (r) {
        return sendVideo(r.id, video).then(function () { return post('/admin/app/announcements/' + encodeURIComponent(r.id) + '/publish', { notify: data.notify }); });
      }).then(done, fail);
      return;
    }
    if (photos.length) {
      data.draft = true;
      post('/admin/app/announcements', data).then(function (r) {
        var i = 0;
        var next = function () {
          if (i >= photos.length) return post('/admin/app/announcements/' + encodeURIComponent(r.id) + '/publish', { notify: data.notify });
          say('Uploading photo ' + (i + 1) + ' of ' + photos.length + '…');
          return shrink(photos[i++]).then(function (image) { return post('/admin/app/announcements/' + encodeURIComponent(r.id) + '/photos', { image: image }); }).then(next);
        };
        return next();
      }).then(done, fail);
      return;
    }
    (t === 'announcement' && one ? shrink(one) : Promise.resolve('')).then(function (image) { data.image = image; return post('/admin/app/announcements', data); }).then(done, fail);
  });

  // Bulk add: Check (a preview of every line), then Add.
  var bulk = $('[data-fa-bulk]'), prev = $('[data-fa-prev]'), bmsg = $('[data-fa-bulkmsg]'), addBtn = root.querySelector('[data-fa-act="bulk-add"]');
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  bulk.addEventListener('input', function () { addBtn.disabled = true; });

  // Every button: bulk Check/Add, and each posted item's actions.
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fa-act]'); if (!b) return;
    var act = b.getAttribute('data-fa-act');
    if (act === 'bulk-check' || act === 'bulk-add') {
      b.disabled = true; bmsg.textContent = act === 'bulk-add' ? 'Adding…' : 'Checking…';
      post('/admin/app/announcements/bulk', { lines: bulk.value, dry: act === 'bulk-check' }).then(function (r) {
        if (r.added) { bmsg.textContent = 'Added ' + r.added + '.'; return location.reload(); }
        prev.innerHTML = (r.rows || []).map(function (x) { return x.error ? '<div><span class="bad">!</span>Line ' + x.line + ': ' + esc(x.error) + '</div>' : '<div><span class="ok">✓</span>' + esc(x.label) + '<small>' + esc(x.date) + '</small></div>'; }).join('');
        var ok = r.ok && (r.rows || []).length;
        addBtn.disabled = !ok;
        addBtn.textContent = ok ? 'Add ' + r.rows.length + ' post' + (r.rows.length === 1 ? '' : 's') + ' · no notifications' : 'Add';
        bmsg.textContent = ok ? '' : 'Fix the lines marked !';
        b.disabled = false;
      }, function (err) { b.disabled = false; bmsg.textContent = err.message; });
      return;
    }
    var item = b.closest('[data-fa-post]'); if (!item) return;
    var id = encodeURIComponent(item.getAttribute('data-fa-post')), base = '/admin/app/announcements/' + id;
    var go = function (p) { b.disabled = true; p.then(function () { location.reload(); }, function (err) { b.disabled = false; alert(err.message); }); };
    if (act === 'date') go(post(base + '/date', { date: item.querySelector('[data-fa-date-in]').value }));
    else if (act === 'pin') go(post(base + '/pin', { days: Number(b.getAttribute('data-days')) }));
    else if (act === 'hide') go(post(base + '/hide', { hidden: b.getAttribute('data-hidden') === '1' }));
    else if (act === 'delete') { if (confirm('Delete this post? It disappears from the app.')) go(post(base + '/delete')); }
    else if (act === 'edit') {
      var g = function (n) { var el = item.querySelector('.fa-edit [name="' + n + '"]'); return el ? el.value : ''; };
      var vid = (item.querySelector('[data-fa-editvideo]') || {}).files;
      vid = vid && vid[0];
      if (vid && vid.size > 150 * 1024 * 1024) return alert('Videos can be up to 150 MB.');
      // The video goes first, so a post switched to Highlight already has its video when it's checked.
      go((vid ? sendVideo(item.getAttribute('data-fa-post'), vid, function (t) { b.textContent = t; }) : Promise.resolve()).then(function () {
        return post(base + '/edit', { type: g('type'), title: g('title'), body: g('body'), ref: g('ref'), link: g('link') });
      }));
    }
  });
})();
