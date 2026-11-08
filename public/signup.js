// Season sign-up behaviour (views/season-signup-flow.js), the same on the site and in the app.
// Every step works without this (plain forms, the server checks everything); this adds the
// answered counter, the live jersey price, the player picker, the month chips and the game
// face camera. The site runs it on load; the app calls window.wkndSignupInit() from initPage
// (public/app.js) after each screen swap, so it only wires a screen once.
(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function peso(n) { return '₱' + Math.round(n).toLocaleString('en-US'); }

  function postJson(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  // Step 3: "4 of 6 answered", and the Next button says how many are left.
  function counter(root) {
    var next = $('[data-sgn-next]', root), label = $('[data-sgn-count-label]', root);
    if (!$('[data-sgn-count]', root) || !next) return;
    var nextText = next.textContent, ta = $('textarea[data-sgn-min]', root), chars = $('[data-sgn-chars]', root);
    var min = ta ? Number(ta.getAttribute('data-sgn-min')) : 0;
    function update() {
      var n = 0;
      ['role_playoffs', 'role_bench', 'role_chat', 'role_coach'].forEach(function (k) { if ($('input[name="' + k + '"]:checked', root)) n++; });
      var len = ta ? ta.value.trim().length : 0;
      if (len >= min) n++;
      if ($$('input[data-sgn-count-self]:checked', root).length === 3) n++;
      var left = 6 - n;
      if (label) label.textContent = n + ' of 6 answered';
      next.textContent = left ? 'Answer ' + left + ' more' : nextText;
      next.classList.toggle('is-off', left > 0);
      if (chars) { chars.textContent = len >= min ? 'Good' : (min - len) + ' more characters'; chars.classList.toggle('is-ok', len >= min); }
    }
    root.addEventListener('change', update); if (ta) ta.addEventListener('input', update); update();
  }

  // Step 1 and 6: the main button looks off until the box is ticked (the server still checks).
  function gate(root) {
    var box = $('[data-sgn-gate]', root), btn = $('[data-sgn-next]', root) || $('[data-sgn-send]', root);
    if (!box || !btn) return;
    function update() { btn.classList.toggle('is-off', !box.checked); }
    box.addEventListener('change', update); update();
  }

  // Step 2: each ticked plan asks "roughly when?".
  function away(root) {
    $$('[data-sgn-away]', root).forEach(function (c) {
      c.addEventListener('change', function () {
        var w = $('[data-sgn-when="' + c.getAttribute('data-sgn-away') + '"]', root);
        if (w) w.hidden = !c.checked;
      });
    });
  }

  // Step 5: the jersey price for the sizes picked, as the server works it out (lib/season-pricing.js).
  function kit(root) {
    var k = $('[data-sgn-kit]', root), brk = $('[data-sgn-brk]', root);
    if (!k || !brk) return;
    var num = function (a) { return Number(k.getAttribute(a)) || 0; };
    var BIG = ['2XL', '3XL', '4XL', '5XL'];
    var extra = function (s) { var i = BIG.indexOf(s); return i < 0 ? 0 : (i + 1) * num('data-step'); };
    var pockets = $('[data-sgn-pockets]', root);
    function val(name) { var i = $('input[name="' + name + '"]:checked', root); return i ? i.value : ''; }
    function update() {
      var top = val('jersey_top'), cut = val('jersey_cut'), shorts = val('jersey_shorts');
      var pk = pockets && $('input', pockets).checked;
      if (pockets) pockets.classList.toggle('is-off', !shorts);
      var t = top ? num('data-top') + extra(top) + (cut === 'nba' ? num('data-cut') : 0) : 0;
      var s = shorts ? num('data-short') + extra(shorts) + (pk ? num('data-pockets') : 0) : 0;
      if (!t) { brk.innerHTML = '<div class="sgn-brk__row"><span>Pick a top size to see your jersey price</span><span></span></div>'; return; }
      brk.innerHTML = '<div class="sgn-brk__row"><span>Top ' + top + ', ' + (cut === 'nba' ? 'NBA' : 'regular') + ' cut</span><span class="sgn-num">' + peso(t) + '</span></div>'
        + (s ? '<div class="sgn-brk__row"><span>Shorts ' + shorts + (pk ? ' + pockets' : '') + '</span><span class="sgn-num">' + peso(s) + '</span></div>' : '')
        + '<div class="sgn-brk__row sgn-brk__tot"><span>Your jersey, paid first</span><span class="sgn-num">' + peso(t + s) + '</span></div>';
    }
    root.addEventListener('change', function (e) { if (/^(jersey_|pockets)/.test(e.target.name || '')) update(); });
    update();
  }

  // Rather not / click with: search, filter by how they know them, at most data-max ticked.
  function pickers(root) {
    $$('[data-sgn-picker]', root).forEach(function (p) {
      var max = Number(p.getAttribute('data-max')) || 2;
      var rows = $$('[data-sgn-person]', p), search = $('[data-sgn-search]', p), none = $('[data-sgn-none]', p), chosen = $('[data-sgn-chosen]', p);
      function filter() {
        var q = (search && search.value || '').trim().toLowerCase();
        var rel = ($('input[data-sgn-rel]:checked', p) || {}).value || '';
        var shown = 0;
        rows.forEach(function (r) {
          var ok = (!q || r.getAttribute('data-name').indexOf(q) >= 0) && (!rel || (' ' + r.getAttribute('data-rel') + ' ').indexOf(' ' + rel + ' ') >= 0);
          r.hidden = !ok; if (ok) shown++;
        });
        if (none) none.hidden = shown > 0;
      }
      function limit() {
        var on = rows.filter(function (r) { return $('input', r).checked; });
        rows.forEach(function (r) { var i = $('input', r); var full = !i.checked && on.length >= max; i.disabled = full; r.classList.toggle('is-full', full); });
        if (chosen) chosen.innerHTML = on.length ? on.map(function (r) { return '<span class="sgn-tag">' + $('.sgn-ct', r).firstChild.textContent + '</span>'; }).join('') : '<span class="sgn-fine">No one picked.</span>';
      }
      if (search) search.addEventListener('input', filter);
      p.addEventListener('change', function (e) { if (e.target.hasAttribute('data-sgn-rel')) filter(); else limit(); });
      // Enter in the search box shouldn't send the step.
      if (search) search.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
      limit();
    });
  }

  // Step 6: the game face. The app opens the phone's camera with a file input; the site uses
  // this device's camera or hands off to a phone with a QR code. Saved at once, for this season.
  function gameFace(root) {
    var gf = $('[data-sgn-gf]', root);
    if (!gf) return;
    var shot = $('[data-sgn-shot]', gf), errEl = $('[data-sgn-cam-err]', gf);
    function err(t) { errEl.textContent = t || ''; errEl.hidden = !t; }
    function done(src) {
      gf.setAttribute('data-photo', '1');
      shot.classList.add('sgn-shot--done');
      shot.innerHTML = (src ? '<img src="' + src + '" alt="Your game face" width="120" height="160">' : '') + '<span class="sgn-shot__ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';
      err('');
    }
    function save(dataUrl, btn) {
      if (btn) btn.disabled = true;
      return postJson('/season-signup/liveness-capture', { dataUrl: dataUrl }).then(function (r) {
        if (btn) btn.disabled = false;
        if (!r.ok) { err(r.d.error || 'Couldn’t save the photo. Try again.'); return; }
        done(dataUrl);
      }, function () { if (btn) btn.disabled = false; err('No connection. The photo wasn’t saved. Try again.'); });
    }
    // Long side 900px: plenty for a reference photo, small enough to send.
    function shrink(source, w, h) {
      var s = Math.min(1, 900 / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    }

    var camBtn = $('[data-sgn-cam]', gf), camInput = $('[data-sgn-cam-input]', gf);
    if (camBtn && camInput) {
      camBtn.addEventListener('click', function () { camInput.click(); });
      camInput.addEventListener('change', function () {
        var f = camInput.files && camInput.files[0];
        if (!f) return;
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () { URL.revokeObjectURL(url); save(shrink(img, img.naturalWidth, img.naturalHeight), camBtn); camInput.value = ''; };
        img.onerror = function () { URL.revokeObjectURL(url); err('That photo couldn’t be read. Try again.'); };
        img.src = url;
      });
    }

    var live = $('[data-sgn-live]', gf), snap = $('[data-sgn-snap]', gf), box = $('[data-sgn-livecam]', gf), qr = $('[data-sgn-qr]', gf), qrBox = $('[data-sgn-qr-box]', gf);
    var stream = null;
    function stop() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } box.hidden = true; snap.hidden = true; }
    if (live) live.addEventListener('click', function () {
      err('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err('This browser can’t open the camera here. Use your phone instead.'); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (s) {
        stream = s; var v = $('video', box); v.srcObject = s; box.hidden = false; snap.hidden = false; qrBox.hidden = true;
      }, function (e) {
        var n = e && e.name;
        err(n === 'NotAllowedError' ? 'Camera access is blocked. Allow it in your browser’s settings, or use your phone instead.'
          : n === 'NotFoundError' ? 'No camera found on this device. Use your phone instead.' : 'Couldn’t open the camera. Use your phone instead.');
      });
    });
    if (snap) snap.addEventListener('click', function () {
      var v = $('video', box);
      if (!v.videoWidth) return;
      var data = shrink(v, v.videoWidth, v.videoHeight);
      stop(); save(data, snap);
    });
    if (qr) qr.addEventListener('click', function () {
      err(''); qr.disabled = true; stop();
      postJson('/season-signup/liveness-token', {}).then(function (r) {
        qr.disabled = false;
        if (!r.ok) { err(r.d.error || 'Couldn’t make the code. Try again.'); return; }
        $('img', qrBox).src = r.d.qrDataUrl; qrBox.hidden = false;
        var ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws/liveness/' + encodeURIComponent(r.d.token));
        ws.onmessage = function (ev) { try { if (JSON.parse(ev.data).type === 'captured') { qrBox.hidden = true; done(''); ws.close(); } } catch (x) {} };
      }, function () { qr.disabled = false; err('No connection. Try again.'); });
    });
  }

  // Send: no game face yet is the one thing worth stopping for here (the server checks the rest).
  function guardSend(root) {
    var form = $('#sgn-form', root), gf = $('[data-sgn-gf]', root);
    if (!form || !gf) return;
    form.addEventListener('submit', function (e) {
      var b = e.submitter;
      if (!b || b.value !== 'send' || gf.getAttribute('data-photo')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var errEl = $('[data-sgn-cam-err]', gf); errEl.textContent = 'Take your game face first.'; errEl.hidden = false;
      gf.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, true);
  }

  function init() {
    $$('[data-sgn]').forEach(function (root) {
      if (root.getAttribute('data-sgn-ready')) return;
      root.setAttribute('data-sgn-ready', '1');
      counter(root); gate(root); away(root); kit(root); pickers(root); gameFace(root); guardSend(root);
      var e = $('[aria-invalid="true"]', root);
      if (e && e.scrollIntoView) e.scrollIntoView({ block: 'center' });
    });
  }
  window.wkndSignupInit = init;
  if (!document.querySelector('main.app')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
