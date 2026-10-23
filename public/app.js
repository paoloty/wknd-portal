// WKND Players app (/app) — the small amount of script the server-rendered screens need.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // ── Appearance: Automatic (follow the phone) / Light / Dark, remembered on this phone ──
  var sw = $('[data-theme-switch]');
  if (sw) {
    var cur = 'auto';
    try { cur = localStorage.getItem('wknd-theme') || 'auto'; } catch (e) {}
    var input = $('input[value="' + cur + '"]', sw); if (input) input.checked = true;
    sw.addEventListener('change', function (e) {
      var v = e.target.value;
      try { if (v === 'auto') localStorage.removeItem('wknd-theme'); else localStorage.setItem('wknd-theme', v); } catch (x) {}
      if (v === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v);
    });
  }

  // ── Up next countdown: data-countdown = epoch ms; ticks every 30s ──
  var cd = $('[data-countdown]');
  if (cd) {
    var to = Number(cd.getAttribute('data-countdown'));
    var tick = function () {
      var ms = Math.max(0, to - Date.now());
      $('[data-cd-d]', cd).textContent = Math.floor(ms / 864e5);
      $('[data-cd-h]', cd).textContent = Math.floor(ms / 36e5) % 24;
      $('[data-cd-m]', cd).textContent = Math.floor(ms / 6e4) % 60;
    };
    tick(); setInterval(tick, 30000);
  }

  // ── Forms: one submit at a time ──
  $$('form[data-busy]').forEach(function (f) {
    f.addEventListener('submit', function () {
      var b = $('button[type="submit"]', f); if (b) { b.classList.add('is-busy'); }
      f.setAttribute('data-dirty', '');
    });
  });
  $$('form input, form textarea').forEach(function (el) {
    el.addEventListener('input', function () { var f = el.form; if (f) f.setAttribute('data-dirty', '1'); });
  });

  // ── 6-digit code: one hidden-looking input, six boxes drawn from its value ──
  var boxes = $('[data-code-boxes]');
  if (boxes) {
    var codeIn = $('input', boxes), spans = $$('span', boxes);
    var draw = function () {
      var v = codeIn.value.replace(/\D/g, '').slice(0, 6);
      if (v !== codeIn.value) codeIn.value = v;
      spans.forEach(function (s, i) { s.textContent = v[i] || ''; s.classList.toggle('is-active', document.activeElement === codeIn && i === Math.min(v.length, 5)); });
      if (v.length === 6) { var f = codeIn.form; if (f && !f.getAttribute('data-sent')) { f.setAttribute('data-sent', '1'); f.requestSubmit ? f.requestSubmit() : f.submit(); } }
    };
    codeIn.addEventListener('input', draw); codeIn.addEventListener('focus', draw); codeIn.addEventListener('blur', draw);
    boxes.addEventListener('click', function () { codeIn.focus(); });
    draw();
  }

  // ── Setup photo: shrink on the phone, send to the same /me/photo the site uses ──
  var pIn = $('[data-photo-input]');
  if (pIn) {
    var pMsg = $('[data-photo-msg]');
    var say = function (t, kind) { pMsg.hidden = !t; pMsg.className = 'msg msg--' + (kind || 'info'); pMsg.textContent = t || ''; };
    var shrink = function (img, max) {
      var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    };
    pIn.addEventListener('change', function () {
      var file = pIn.files && pIn.files[0]; if (!file) return;
      say('Uploading…');
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var body = JSON.stringify({ dataUrl: shrink(img, 900), originalDataUrl: shrink(img, 2000) });
        fetch('/me/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin' })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok) throw new Error(res.j && res.j.error || 'Upload failed');
            var av = $('[data-photo-preview] .avatar');
            if (av) { var old = $('img', av); if (old) old.remove(); var i2 = new Image(); i2.src = url; av.appendChild(i2); }
            say('Saved. Looking good.', 'ok');
            var next = $('[data-photo-next]'); if (next) next.textContent = 'Looks good';
          })
          .catch(function (e) { say(e.message || 'Upload failed. Try another photo.', 'err'); });
      };
      img.onerror = function () { say('That file isn\'t a photo we can read. Try a JPG or PNG.', 'err'); };
      img.src = url;
    });
  }

  // ── Install hint (Home): iPhone gets the Share steps, Android the real prompt ──
  var card = $('[data-install-card]');
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (card && !standalone) { card.hidden = false; $('[data-install-ios]', card).hidden = true; $('[data-install-android]', card).hidden = false; }
  });
  if (card && !standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) card.hidden = false;
  var ib = $('[data-install-btn]');
  if (ib) ib.addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred = null; card.hidden = true; } });

  // ── Usage for /admin/app: the first open of the day on this phone, and whether it came
  // from the home screen (that's how "installed" is known on iPhone). ──
  var ping = function (body) {
    if (!navigator.onLine || !document.querySelector('.tabbar')) return; // signed-in screens only
    fetch('/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin', keepalive: true }).catch(function () {});
  };
  try {
    var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) + (standalone ? '|hs' : '|web');
    if (localStorage.getItem('wknd-ping') !== day) { ping({ standalone: standalone }); localStorage.setItem('wknd-ping', day); }
  } catch (e) { ping({ standalone: standalone }); }
  window.addEventListener('appinstalled', function () { ping({ installed: true }); });

  // ── Offline shell ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app' }).catch(function () {});
  }
  var offlineBar = null;
  var net = function () {
    if (navigator.onLine) { if (offlineBar) { offlineBar.remove(); offlineBar = null; } return; }
    if (offlineBar) return;
    offlineBar = document.createElement('div'); offlineBar.className = 'offline-bar'; offlineBar.textContent = 'You\'re offline · showing what was last loaded';
    document.body.insertBefore(offlineBar, document.body.firstChild);
  };
  window.addEventListener('online', net); window.addEventListener('offline', net); net();

  // ── Updates: iPhone resumes the old screen without reloading, so on coming back to the
  // app check the deployed version; reload when it changed or the screen is >30 min old.
  // A half-filled form gets a "tap to refresh" bar instead of losing what was typed. ──
  var ver = ($('meta[name="app-ver"]') || {}).content || '';
  var loadedAt = Date.now(), checking = false;
  var dirty = function () { return !!$('form[data-dirty="1"]'); };
  var showBar = function () {
    if ($('.update-bar')) return;
    var b = document.createElement('div'); b.className = 'update-bar';
    b.innerHTML = 'New version ready <button type="button">Refresh</button>';
    $('button', b).addEventListener('click', function () { location.reload(); });
    document.body.appendChild(b);
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || checking || !navigator.onLine) return;
    checking = true;
    fetch('/app/version', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      var stale = Date.now() - loadedAt > 30 * 60 * 1000;
      if ((j.ver && j.ver !== ver) || stale) { if (dirty()) showBar(); else location.reload(); }
    }).catch(function () {}).then(function () { checking = false; });
  });
})();
