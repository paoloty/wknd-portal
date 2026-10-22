// POTG video editor (views/admin/potg-video.js), browser side.
//   • 6 photo slots per player: pick (several at once fills the next empty slots), the photo is
//     shrunk here, uploaded (/admin/media/potg-photo: graded + auto-framed on the server) and
//     shown framed exactly like the video's last frame of that photo.
//   • drag to move, slider (or wheel over the photo) to zoom, ←/→ to reorder, Auto to reset.
//   • the framing maths is frameOf() in assets/media/potg/template.html: keep them in sync.
//   • Render: posts everything, the server queues one job per player, then off to Processing.
(function () {
  'use strict';
  var page = document.querySelector('[data-pv-page]');
  if (!page) return;
  var GAME = page.getAttribute('data-game');
  var COUNT = +page.getAttribute('data-count') || 6;
  var FW = 1080, FH = 1350, TX = FW / 2, TY = FH * 0.40, KB = 1.10;
  var ui = function () { return window.adminUi || { toast: function (t) { alert(t); } }; };

  function frameOf(iw, ih, fx, fy, zoom, extra) {
    var s = Math.max(FW / iw, FH / ih) * Math.max(1, zoom) * extra, w = iw * s, h = ih * s;
    var x = TX - fx * w, y = TY - fy * h;
    x = Math.min(0, Math.max(FW - w, x)); y = Math.min(0, Math.max(FH - h, y));
    return { x: x, y: y, s: s, w: w, h: h };
  }

  var players = [].slice.call(page.querySelectorAll('[data-pv-player]')).map(function (el) {
    return { el: el, id: el.getAttribute('data-pv-player'), photos: new Array(COUNT).fill(null), slots: [].slice.call(el.querySelectorAll('[data-pv-slot]')) };
  });

  // ── drawing a slot ──
  function draw(P, i) {
    var slot = P.slots[i], ph = P.photos[i];
    var img = slot.querySelector('[data-pv-img]'), empty = slot.querySelector('[data-pv-empty]'), tools = slot.querySelector('[data-pv-tools]');
    if (!ph) { img.hidden = true; img.removeAttribute('src'); empty.hidden = false; tools.hidden = true; slot.classList.remove('is-filled'); return; }
    empty.hidden = true; tools.hidden = false; img.hidden = false; slot.classList.add('is-filled');
    if (img.getAttribute('src') !== ph.url) img.src = ph.url;
    var k = slot.querySelector('[data-pv-frame]').clientWidth / FW;
    var f = frameOf(ph.w, ph.h, ph.fx, ph.fy, ph.zoom, KB);
    img.style.width = (f.w * k) + 'px'; img.style.height = (f.h * k) + 'px';
    img.style.left = (f.x * k) + 'px'; img.style.top = (f.y * k) + 'px';
    slot.querySelector('[data-pv-zoom]').value = ph.zoom;
  }
  function drawAll() { players.forEach(function (P) { P.photos.forEach(function (_, i) { draw(P, i); }); }); status(); }

  function status() {
    var missing = players.reduce(function (n, P) { return n + P.photos.filter(function (p) { return !p; }).length; }, 0);
    var noStats = players.some(function (P) { return !P.el.querySelectorAll('[data-pv-stat]:checked').length; });
    var btn = page.querySelector('[data-pv-save]');
    btn.disabled = missing > 0 || noStats || busy > 0;
    page.querySelector('[data-pv-status]').textContent = busy > 0 ? 'Uploading…' : missing > 0 ? (missing + ' photo' + (missing === 1 ? '' : 's') + ' to go.') : noStats ? 'Pick at least one number for each player.' : 'Ready to render.';
  }

  // ── upload ──
  var busy = 0;
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var m = 2400 / Math.max(im.naturalWidth, im.naturalHeight), sc = Math.min(1, m);
        var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Couldn’t read that image.')); };
      im.src = url;
    });
  }
  function upload(P, i, file) {
    var slot = P.slots[i], b = slot.querySelector('[data-pv-busy]');
    busy++; b.hidden = false; status();
    return shrink(file).then(function (dataUrl) {
      return fetch('/admin/media/potg-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: dataUrl }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Upload failed'); return d; }); });
    }).then(function (d) {
      P.photos[i] = { id: d.id, w: d.w, h: d.h, fx: d.fx, fy: d.fy, ax: d.fx, ay: d.fy, zoom: 1, url: d.url };
    }).catch(function (e) { ui().toast(e.message || 'Upload failed', { tone: 'error' }); })
      .then(function () { busy--; b.hidden = true; draw(P, i); status(); });
  }
  function addFiles(P, start, files) {
    var list = [].slice.call(files || []); var i = start;
    list.forEach(function (f) {
      while (i < COUNT && P.photos[i] && i !== start) i++;
      if (i >= COUNT) return;
      upload(P, i, f); i++;
    });
  }

  players.forEach(function (P) {
    P.slots.forEach(function (slot, i) {
      slot.querySelector('[data-pv-file]').addEventListener('change', function (e) { addFiles(P, i, e.target.files); e.target.value = ''; });
      slot.querySelector('[data-pv-replace]').addEventListener('change', function (e) { if (e.target.files[0]) upload(P, i, e.target.files[0]); e.target.value = ''; });
      slot.querySelector('[data-pv-remove]').addEventListener('click', function () { P.photos[i] = null; draw(P, i); status(); });
      slot.querySelector('[data-pv-auto]').addEventListener('click', function () { var p = P.photos[i]; if (p) { p.fx = p.ax; p.fy = p.ay; p.zoom = 1; draw(P, i); } });
      [].slice.call(slot.querySelectorAll('[data-pv-move]')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var j = i + (+btn.getAttribute('data-pv-move')); if (j < 0 || j >= COUNT) return;
          var t = P.photos[i]; P.photos[i] = P.photos[j]; P.photos[j] = t; draw(P, i); draw(P, j);
        });
      });
      slot.querySelector('[data-pv-zoom]').addEventListener('input', function (e) { var p = P.photos[i]; if (p) { p.zoom = +e.target.value; draw(P, i); } });
      // drag to move
      var fr = slot.querySelector('[data-pv-frame]'), drag = null;
      fr.addEventListener('pointerdown', function (e) {
        var p = P.photos[i]; if (!p || e.target.closest('label')) return;
        var f = frameOf(p.w, p.h, p.fx, p.fy, p.zoom, KB);
        // start from where the photo really is (after clamping), so it never "sticks"
        p.fx = (TX - f.x) / f.w; p.fy = (TY - f.y) / f.h;
        drag = { x: e.clientX, y: e.clientY, fx: p.fx, fy: p.fy, w: f.w, h: f.h, k: fr.clientWidth / FW };
        fr.setPointerCapture(e.pointerId); fr.classList.add('is-drag'); e.preventDefault();
      });
      fr.addEventListener('pointermove', function (e) {
        var p = P.photos[i]; if (!drag || !p) return;
        p.fx = drag.fx - (e.clientX - drag.x) / drag.k / drag.w;
        p.fy = drag.fy - (e.clientY - drag.y) / drag.k / drag.h;
        draw(P, i);
      });
      function end() {
        var p = P.photos[i]; if (!drag) return; drag = null; fr.classList.remove('is-drag');
        if (p) { var f = frameOf(p.w, p.h, p.fx, p.fy, p.zoom, KB); p.fx = (TX - f.x) / f.w; p.fy = (TY - f.y) / f.h; }
      }
      fr.addEventListener('pointerup', end); fr.addEventListener('pointercancel', end);
      fr.addEventListener('wheel', function (e) {
        var p = P.photos[i]; if (!p) return; e.preventDefault();
        p.zoom = Math.min(2.5, Math.max(1, p.zoom - e.deltaY * 0.001)); draw(P, i);
      }, { passive: false });
    });
    // stat picks: max 3
    [].slice.call(P.el.querySelectorAll('[data-pv-stat]')).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var on = P.el.querySelectorAll('[data-pv-stat]:checked');
        if (on.length > 3) { cb.checked = false; ui().toast('Three numbers max.', { tone: 'error' }); }
        cb.closest('.pv-stat').classList.toggle('is-on', cb.checked); status();
      });
    });
  });

  // ── render ──
  page.querySelector('[data-pv-save]').addEventListener('click', function (e) {
    var btn = e.currentTarget; btn.disabled = true;
    var body = { players: players.map(function (P) {
      return {
        playerId: P.id,
        number: P.el.querySelector('[data-pv-number]').value,
        chip: P.el.querySelector('[data-pv-chip]').value,
        stats: [].slice.call(P.el.querySelectorAll('[data-pv-stat]:checked')).map(function (c) { return c.value; }),
        photos: P.photos.map(function (p) { return { id: p.id, fx: +p.fx.toFixed(4), fy: +p.fy.toFixed(4), zoom: +(+p.zoom).toFixed(3) }; }),
      };
    }) };
    fetch('/admin/games/' + encodeURIComponent(GAME) + '/potg-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Couldn’t queue the video.'); return d; }); })
      .then(function () { window.location.href = '/admin/media'; })
      .catch(function (err) { ui().toast(err.message, { tone: 'error' }); btn.disabled = false; });
  });

  window.addEventListener('resize', drawAll);
  drawAll();
})();
