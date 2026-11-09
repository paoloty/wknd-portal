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

  // The Game Face contest page: a photo opens the viewer (swipe or arrows through the category;
  // on a wide screen the category's faces as thumbnails, ← → V Esc), and Vote saves in place
  // through the same form route, asking for JSON. Voting for your vote again takes it back.
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ARROW = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function firstName(n) { return String(n).split(' ')[0]; }
  function gfToast(text, tone) {
    if (window.wkndToast) return window.wkndToast(text, tone || 'ok');
    $$('.sgn-toast').forEach(function (t) { t.remove(); });
    var t = document.createElement('div'); t.className = 'sgn-toast' + (tone === 'err' ? ' sgn-toast--err' : ''); t.setAttribute('role', 'status');
    t.innerHTML = (tone === 'err' ? '' : CHECK) + '<span></span>'; $('span', t).textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function gfViewer(root) {
    if (!root.hasAttribute('data-gf')) return;
    var voteUrl = root.getAttribute('data-gf-vote'), phase = root.getAttribute('data-gf-phase');
    var v = null, opener = null, x0 = null, busy = false;
    var box = document.createElement('div');
    box.className = 'sgn-gfv'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    document.body.appendChild(box);

    function tiles(cat) { return $$('[data-gf-entry]', cat); }
    function myVote(cat) { var on = $('.sgn-gf__tile.is-on', cat); return on ? on.getAttribute('data-gf-entry') : ''; }
    function paint() {
      var list = tiles(v.cat), t = list[v.i], name = t.getAttribute('data-gf-name'), mine = t.hasAttribute('data-gf-mine');
      var voted = myVote(v.cat), on = voted === t.getAttribute('data-gf-entry'), label = v.cat.getAttribute('data-gf-label');
      var other = voted && !on && !mine ? $('[data-gf-entry="' + voted + '"]', v.cat) : null;
      var action = phase !== 'voting' ? '<p class="sgn-gfv__note">' + (phase === 'over' ? 'Winner' : 'Voting opens when sign-ups close.') + '</p>'
        : !voteUrl ? '<p class="sgn-gfv__note">Log in to vote.</p>'
        : mine ? '<button type="button" class="sgn-gfv__big" disabled>This is you</button>'
        : on ? '<button type="button" class="sgn-gfv__big is-on" data-gfv-vote>' + CHECK + 'Your vote · tap to undo</button>'
        : '<button type="button" class="sgn-gfv__big" data-gfv-vote>Vote for ' + esc(firstName(name)) + '</button>';
      box.setAttribute('aria-label', label);
      box.innerHTML = '<div class="sgn-gfv__card">' +
        '<div class="sgn-gfv__top"><span class="sgn-gfv__count">' + (v.i + 1) + ' of ' + list.length + '</span><button type="button" class="sgn-gfv__ib" data-gfv-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="sgn-gfv__lbl sgn-lbl">' + esc(label) + '</div>' +
        '<div class="sgn-gfv__stage" data-gfv-swipe><img src="' + esc(t.getAttribute('data-gf-big')) + '" alt="' + esc(name) + '’s game face">' +
          '<button type="button" class="sgn-gfv__ib sgn-gfv__nav sgn-gfv__prev" data-gfv-step="-1" aria-label="Previous"' + (v.i ? '' : ' disabled') + '>' + ARROW('M15 6l-6 6 6 6') + '</button>' +
          '<button type="button" class="sgn-gfv__ib sgn-gfv__nav sgn-gfv__next" data-gfv-step="1" aria-label="Next"' + (v.i < list.length - 1 ? '' : ' disabled') + '>' + ARROW('M9 6l6 6-6 6') + '</button></div>' +
        '<div class="sgn-gfv__thumbs">' + list.map(function (x, j) { return '<button type="button" data-gfv-jump="' + j + '" class="' + (j === v.i ? 'on' : '') + (x.classList.contains('is-on') ? ' voted' : '') + '" aria-label="' + esc(x.getAttribute('data-gf-name')) + '"><img src="' + esc($('img', x).getAttribute('src')) + '" alt=""></button>'; }).join('') + '</div>' +
        '<div class="sgn-gfv__dots">' + list.map(function (_, j) { return '<i' + (j === v.i ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' +
        '<div class="sgn-gfv__foot"><div class="sgn-gfv__who"><b>' + esc(name) + '</b><small>' + esc(label) + (other ? ' · you voted for ' + esc(firstName(other.getAttribute('data-gf-name'))) : '') + '</small></div>' + action +
          (phase === 'voting' && voteUrl ? '<span class="sgn-gfv__keys">← → to move · V to vote · Esc to close</span>' : '') + '</div></div>';
    }
    function open(cat, i, from) { v = { cat: cat, i: i }; opener = from; paint(); box.hidden = false; document.documentElement.style.overflow = 'hidden'; var c = $('[data-gfv-close]', box); if (c) c.focus(); }
    function close() { box.hidden = true; v = null; document.documentElement.style.overflow = ''; if (opener && opener.isConnected) opener.focus(); }
    function step(d) { if (!v) return; var n = tiles(v.cat).length, i = Math.max(0, Math.min(n - 1, v.i + d)); if (i !== v.i) { v.i = i; paint(); } }

    // Put a category's tiles, its "Voted" note and the progress bar in line with my votes.
    function apply(votes) {
      $$('[data-gf-cat]', root).forEach(function (cat) {
        var mine = votes[cat.getAttribute('data-gf-cat')] || '';
        tiles(cat).forEach(function (t) {
          if (t.hasAttribute('data-gf-mine')) return;
          var on = t.getAttribute('data-gf-entry') === mine, b = $('.sgn-gf__vote', t), ph = $('.sgn-gf__ph', t), tag = $('.sgn-gf__tag', ph);
          t.classList.toggle('is-on', on);
          if (b) { b.innerHTML = on ? CHECK + 'Voted' : 'Vote'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
          if (on && !tag) { tag = document.createElement('span'); tag.className = 'sgn-gf__tag'; ph.insertBefore(tag, $('.sgn-gf__zoom', ph)); }
          if (tag) { if (on) tag.innerHTML = CHECK + 'Your vote'; else tag.remove(); }
        });
        var st = $('[data-gf-state]', cat);
        if (st) { st.classList.toggle('is-done', !!mine); st.textContent = mine ? '✓ Voted' : tiles(cat).length + ' face' + (tiles(cat).length === 1 ? '' : 's'); }
      });
      var cats = $$('[data-gf-cat]', root), done = cats.filter(function (c) { return !!votes[c.getAttribute('data-gf-cat')]; }).length;
      $$('.sgn-gfp__dots i', root).forEach(function (d, i) { d.classList.toggle('on', !!votes[cats[i] && cats[i].getAttribute('data-gf-cat')]); });
      var cnt = $('[data-gf-count]', root); if (cnt) cnt.textContent = done + ' of ' + cats.length;
    }
    function vote(entry) {
      if (busy || !voteUrl) return;
      busy = true;
      var t = $('[data-gf-entry="' + entry + '"]', root), name = t ? firstName(t.getAttribute('data-gf-name')) : '';
      fetch(voteUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'entry=' + encodeURIComponent(entry) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) { gfToast(res.d.error || 'That vote didn’t save. Try again.', 'err'); return; }
          apply(res.d.votes || {});
          if (v) paint();
          gfToast(res.d.undo ? 'Vote taken back' : 'Vote saved for ' + name);
        })
        .catch(function () { gfToast('You’re offline. Your vote didn’t save.', 'err'); })
        .then(function () { busy = false; });
    }

    root.addEventListener('click', function (e) {
      var o = e.target.closest('[data-gf-open]');
      if (o) { var cat = o.closest('[data-gf-cat]'); open(cat, tiles(cat).indexOf(o.closest('[data-gf-entry]')), o); return; }
      var b = e.target.closest('button.sgn-gf__vote');
      if (b && !b.disabled && b.value) { e.preventDefault(); vote(b.value); }
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) { if (e.target === box) close(); return; }
      if (b.disabled) return;
      if (b.hasAttribute('data-gfv-close')) close();
      else if (b.hasAttribute('data-gfv-step')) step(Number(b.getAttribute('data-gfv-step')));
      else if (b.hasAttribute('data-gfv-jump')) { v.i = Number(b.getAttribute('data-gfv-jump')); paint(); }
      else if (b.hasAttribute('data-gfv-vote')) vote(tiles(v.cat)[v.i].getAttribute('data-gf-entry'));
    });
    box.addEventListener('pointerdown', function (e) { if (e.target.closest('[data-gfv-swipe]') && !e.target.closest('button')) x0 = e.clientX; });
    box.addEventListener('pointerup', function (e) { if (x0 === null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); });
    document.addEventListener('keydown', function (e) {
      if (!v || box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if ((e.key === 'v' || e.key === 'V') && voteUrl && phase === 'voting') { var t = tiles(v.cat)[v.i]; if (!t.hasAttribute('data-gf-mine')) vote(t.getAttribute('data-gf-entry')); }
    });
    // The app swaps screens in place: a viewer left open goes with its page.
    var gone = new MutationObserver(function () { if (!root.isConnected) { box.remove(); document.documentElement.style.overflow = ''; gone.disconnect(); } });
    gone.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    $$('[data-sgn]').forEach(function (root) {
      if (root.getAttribute('data-sgn-ready')) return;
      root.setAttribute('data-sgn-ready', '1');
      counter(root); gate(root); away(root); kit(root); pickers(root); gameFace(root); guardSend(root); gfViewer(root);
      var e = $('[aria-invalid="true"]', root);
      if (e && e.scrollIntoView) e.scrollIntoView({ block: 'center' });
    });
  }
  window.wkndSignupInit = init;
  if (!document.querySelector('main.app')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
