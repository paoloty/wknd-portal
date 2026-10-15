// Award graphic editor (views/admin/award-graphic-editor.js), browser side. Generic bits
// (toasts, ⋯ menus, in-place re-render) come from public/admin-ui.js; this adds:
//   • the live 1200×630 mock: drag a photo to pan it, zoom with the slider (or the wheel, but
//     only over the selected photo, so the page still scrolls), arrow keys nudge the
//     selected photo 1% while focus is in the editor. The pan/zoom maths is the same as
//     renderPhotoStrip() in server.js, so the mock matches the real crop.
//   • the photo count (MVP-style graphics), changed in place: edits to the other photos stay
//   • Replace photo… / Use profile photo / Centre it on the selected photo
//   • the save bar: lists what changed; Save graphic posts the count (…/columns) when it
//     changed, then only the changed photos (…/graphic), and refreshes the real PNG
// Handlers are delegated once; init() re-runs after an in-place re-render (admin:updated).
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function () {} }; };
  var GRID_KEY = 'agr-grid-visible'; // same key as the old editor, so the choice carries over
  var S = null;                        // this page's state, rebuilt by init()

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function store(v) { try { if (v === undefined) return localStorage.getItem(GRID_KEY); localStorage.setItem(GRID_KEY, v); } catch (e) { return null; } }
  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Couldn’t save the graphic.'); return d; }); });
  }
  var hero = function () { return S.cfg.mode === 'hero'; };
  var base = function () { return '/admin/awards/' + encodeURIComponent(S.cfg.season) + '/' + encodeURIComponent(S.cfg.type); };

  // ── One strip's photo state ─────────────────────────────────────────────────────────
  // orig: what's saved. cur: what the mock shows. cur.photo is 'keep' (the saved photo),
  // 'profile' (back to the profile photo) or 'new' (cur.data, a picked file).
  function isCustom(st) { return st.cur.photo === 'new' || (st.cur.photo === 'keep' && st.orig.custom); }
  function moved(st) { var c = st.cur, o = st.orig; return Math.abs(c.ox - o.ox) > 0.05 || Math.abs(c.oy - o.oy) > 0.05 || Math.abs(c.zoom - o.zoom) > 0.001; }
  function changed(st) { return moved(st) || st.cur.photo === 'new' || (st.cur.photo === 'profile' && st.orig.custom); }
  function live(st) { return !hero() || st.i < S.count; }
  // Only a non-default photo gets a badge: gray for Moved, amber for Replaced, none otherwise.
  function stateOf(st) {
    if (isCustom(st)) return ['Replaced', 'amber'];
    var c = st.cur;
    return Math.abs(c.ox - 50) >= 0.5 || Math.abs(c.oy - 50) >= 0.5 || Math.abs(c.zoom - 1) >= 0.01 ? ['Moved', 'gray'] : null;
  }
  // A saved number, or the default when it's missing: a saved 0 offset must stay 0.
  function numOr(v, def) { var x = parseFloat(v); return isFinite(x) ? x : def; }

  // Same maths as before (and as renderPhotoStrip): cover-fit × zoom, then offsets are the
  // fraction of the spare width/height panned past.
  function apply(st) {
    var img = st.img, fw = st.frame.clientWidth, fh = st.frame.clientHeight;
    if (!img.naturalWidth || !img.naturalHeight || !fw || !fh) return;
    var baseScale = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    var scale = baseScale * st.cur.zoom;
    var scaledW = img.naturalWidth * scale, scaledH = img.naturalHeight * scale;
    var maxLeft = Math.max(0, scaledW - fw), maxTop = Math.max(0, scaledH - fh);
    img.style.width = scaledW + 'px';
    img.style.height = scaledH + 'px';
    img.style.left = (-maxLeft * (st.cur.ox / 100)) + 'px';
    img.style.top = (-maxTop * (st.cur.oy / 100)) + 'px';
  }
  function applyAll() { if (S) S.strips.forEach(apply); }

  function setSrc(st, src) { if (st.img.getAttribute('src') !== src) st.img.src = src; else apply(st); }

  // Stat leaders: a player who leads two stats has ONE saved override (keyed by player), so
  // an edit to one of their columns is mirrored onto the other.
  function twinsOf(st) { return hero() ? [] : S.strips.filter(function (o) { return o !== st && o.playerId === st.playerId; }); }
  function edited(st) {
    twinsOf(st).forEach(function (t) {
      t.cur = { ox: st.cur.ox, oy: st.cur.oy, zoom: st.cur.zoom, photo: st.cur.photo, data: st.cur.data };
      setSrc(t, st.img.getAttribute('src'));
      apply(t);
    });
    apply(st);
    sync();
  }

  // ── Layout (photo count) and selection ──────────────────────────────────────────────
  function layout() {
    var n = hero() ? S.count : S.strips.length;
    S.strips.forEach(function (st) {
      var on = live(st);
      st.el.hidden = !on;
      if (st.item) st.item.hidden = !on;
      if (!on) return;
      st.el.style.left = (st.i * 100 / n).toFixed(4) + '%';
      st.el.style.width = (100 / n).toFixed(4) + '%';
      if (hero()) st.el.querySelector('.agx-shade').style.background = n > 1 ? S.cfg.shadeMany : S.cfg.shadeOne;
    });
    S.root.querySelectorAll('[data-count]').forEach(function (b) {
      var on = Number(b.getAttribute('data-count')) === S.count;
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-selected', String(on));
    });
    if (S.sel >= 0 && !live(S.strips[S.sel])) select(n - 1);
    applyAll();
  }

  function select(i) {
    S.sel = i;
    S.strips.forEach(function (st) {
      var on = st.i === i;
      st.el.classList.toggle('is-selected', on);
      if (!st.item) return;
      st.item.classList.toggle('is-open', on);
      st.item.querySelector('[data-item-body]').hidden = !on;
      st.item.querySelector('[data-pick]').setAttribute('aria-expanded', String(on));
    });
    syncControls();
  }

  // The open row's slider and buttons follow the selected photo.
  function syncControls() {
    var st = S.strips[S.sel];
    if (!st || !st.item) return;
    var r = st.item.querySelector('[data-zoom-range]');
    if (r && document.activeElement !== r) r.value = Math.round(st.cur.zoom * 100);
    st.item.querySelector('[data-zoom-label]').textContent = st.cur.zoom.toFixed(2) + '×';
    var prof = st.item.querySelector('[data-act="profile"]');
    if (prof) prof.hidden = !isCustom(st);
  }

  // Badges, "unsaved" notes and the save bar.
  function sync() {
    var notes = [];
    S.strips.forEach(function (st) {
      if (!st.item) return;
      var s = stateOf(st);
      st.item.querySelector('[data-state-badge]').innerHTML = s ? '<span class="aui-badge aui-badge--' + s[1] + '">' + s[0] + '</span>' : '';
      var dirty = live(st) && changed(st);
      st.item.querySelector('[data-dirty-note]').hidden = !dirty;
      if (!dirty || (!hero() && twinsOf(st).some(function (t) { return t.i < st.i; }))) return;
      var what = st.cur.photo === 'new' ? 'replaced' : st.cur.photo === 'profile' && st.orig.custom ? 'back to the profile photo' : 'moved';
      notes.push((hero() ? 'photo ' + (st.i + 1) : st.name) + ' ' + what);
    });
    if (hero() && S.count !== S.origCount) notes.unshift(S.count + (S.count === 1 ? ' photo' : ' photos') + ' instead of ' + S.origCount);
    S.dirty = notes.length > 0;
    var bar = S.root.querySelector('[data-savebar]');
    if (bar) {
      bar.hidden = !S.dirty;
      var label = bar.querySelector('span');
      if (label && S.dirty) label.innerHTML = '<b>' + notes.length + ' unsaved change' + (notes.length === 1 ? '' : 's') + '</b> · ' + esc(notes.join(', '));
    }
    syncControls();
  }

  // ── Init ────────────────────────────────────────────────────────────────────────────
  function init() {
    var root = document.getElementById('agx');
    if (!root) { S = null; return; }
    if (root.__agx) return;
    root.__agx = true;
    var cfg = {};
    try { cfg = JSON.parse(root.getAttribute('data-config') || '{}'); } catch (e) {}
    S = { root: root, cfg: cfg, canvas: root.querySelector('#agx-canvas'), strips: [], count: cfg.count, origCount: cfg.count, sel: -1, view: 'edit', realStale: true, dirty: false, saving: false, drag: null, fileFor: -1 };
    root.querySelectorAll('[data-strip]').forEach(function (el) {
      var i = Number(el.getAttribute('data-strip'));
      var d = el.dataset;
      var item = root.querySelector('[data-item="' + i + '"]');
      var st = {
        i: i, el: el, item: item, img: el.querySelector('.agx-img'), frame: el.querySelector('.agx-frame'),
        playerId: d.playerId, profileUrl: d.profile,
        name: item ? item.querySelector('.agx-item__title').textContent : 'Photo ' + (i + 1),
        orig: { ox: clamp(numOr(d.ox, 50), 0, 100), oy: clamp(numOr(d.oy, 50), 0, 100), zoom: clamp(numOr(d.zoom, 1), 1, 3), custom: d.custom === '1', src: d.src },
      };
      st.cur = { ox: st.orig.ox, oy: st.orig.oy, zoom: st.orig.zoom, photo: 'keep', data: null };
      st.img.addEventListener('load', function () { apply(st); });
      S.strips.push(st);
    });
    var gridOn = store() === '1';
    var gc = root.querySelector('[data-grid-toggle]');
    if (gc) gc.checked = gridOn;
    S.canvas.classList.toggle('is-grid', gridOn);
    layout();
    select(0);
    sync();
  }

  function stripOf(node) {
    var el = node && node.closest && node.closest('[data-strip]');
    return el && S ? S.strips[Number(el.getAttribute('data-strip'))] : null;
  }
  function selected() { return S && S.sel >= 0 ? S.strips[S.sel] : null; }

  // ── View switch ─────────────────────────────────────────────────────────────────────
  function showView(v) {
    S.view = v;
    S.root.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-view') === v)); });
    S.root.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== v; });
    S.root.querySelectorAll('[data-view-only]').forEach(function (n) { n.hidden = n.getAttribute('data-view-only') !== v; });
    if (v === 'site' && S.realStale) refreshReal();
    if (v === 'edit') applyAll();
  }
  function refreshReal() {
    var img = S.root.querySelector('[data-real]');
    if (!img) return;
    img.src = S.cfg.og + '?bust=' + Date.now();
    S.realStale = false;
  }

  // ── Save / discard ──────────────────────────────────────────────────────────────────
  function save() {
    if (!S || S.saving || !S.dirty) return;
    var bar = S.root.querySelector('[data-savebar]');
    var btns = bar ? bar.querySelectorAll('button') : [];
    S.saving = true;
    btns.forEach(function (b) { b.disabled = true; });
    var countChanged = hero() && S.count !== S.origCount;
    // Only the photos that changed go up (twins once: they share one saved override).
    var sent = S.strips.filter(function (st) { return live(st) && changed(st); });
    var seen = {}, items = [];
    sent.forEach(function (st) {
      var who = hero() ? S.cfg.playerId : st.playerId;
      if (!hero()) { if (seen[who]) return; seen[who] = true; }
      var item = { player_id: who, offset_x: st.cur.ox, offset_y: st.cur.oy, zoom: st.cur.zoom };
      if (hero()) item.slot = st.i;
      if (st.cur.photo === 'new') item.newPhotoDataUrl = st.cur.data;
      if (st.cur.photo === 'profile') item.profile_photo = true;
      items.push(item);
    });
    var chain = Promise.resolve();
    if (countChanged) {
      chain = chain.then(function () { return post(base() + '/columns', { count: S.count }); }).then(function () {
        // The server dropped the saved photos past the new count.
        S.origCount = S.count;
        S.strips.forEach(function (st) {
          if (st.i < S.count) return;
          st.orig = { ox: 50, oy: 50, zoom: 1, custom: false, src: st.profileUrl };
          st.cur = { ox: 50, oy: 50, zoom: 1, photo: 'keep', data: null };
          setSrc(st, st.profileUrl);
        });
      });
    }
    if (items.length) chain = chain.then(function () { return post(base() + '/graphic', { overrides: items }); });
    chain.then(function () {
      sent.forEach(function (st) {
        st.orig = { ox: st.cur.ox, oy: st.cur.oy, zoom: st.cur.zoom, custom: isCustom(st), src: st.img.getAttribute('src') };
        st.cur.photo = 'keep';
        st.cur.data = null;
      });
      S.realStale = true;
      if (S.view === 'site') refreshReal();
      sync();
      ui().toast('Graphic saved. The share image is updated.', { action: S.view === 'site' ? null : { label: 'See it', run: function () { if (S) showView('site'); } } });
    }).catch(function (err) {
      sync();
      ui().toast(err.message || 'Couldn’t save the graphic.', { tone: 'error' });
    }).then(function () {
      if (S) S.saving = false;
      btns.forEach(function (b) { b.disabled = false; });
    });
  }

  function discard() {
    S.count = S.origCount;
    S.strips.forEach(function (st) {
      st.cur = { ox: st.orig.ox, oy: st.orig.oy, zoom: st.orig.zoom, photo: 'keep', data: null };
      setSrc(st, st.orig.src);
    });
    layout();
    sync();
    ui().toast('Changes discarded.');
  }

  // ── Delegated handlers (bound once) ─────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!S || !S.root.contains(e.target)) return;
    var t = e.target;
    var v = t.closest('[data-view]');
    if (v) { showView(v.getAttribute('data-view')); return; }
    if (t.closest('[data-real-refresh]')) { refreshReal(); return; }
    var c = t.closest('[data-count]');
    if (c) { S.count = Number(c.getAttribute('data-count')); layout(); sync(); return; }
    var pk = t.closest('[data-pick]');
    if (pk) { var i = Number(pk.getAttribute('data-pick')); select(S.sel === i ? -1 : i); return; }
    var act = t.closest('[data-act]');
    var st = selected();
    if (act && st) {
      var a = act.getAttribute('data-act');
      if (a === 'replace') {
        S.fileFor = st.i;
        var f = S.root.querySelector('[data-file]');
        f.value = '';
        f.click();
      } else if (a === 'profile') {
        st.cur.photo = st.orig.custom ? 'profile' : 'keep';
        st.cur.data = null;
        setSrc(st, st.orig.custom ? st.profileUrl : st.orig.src);
        edited(st);
      } else if (a === 'centre') {
        st.cur.ox = 50; st.cur.oy = 50;
        edited(st);
      }
    }
  });

  document.addEventListener('change', function (e) {
    if (!S || !S.root.contains(e.target)) return;
    var t = e.target;
    if (t.matches('[data-grid-toggle]')) {
      S.canvas.classList.toggle('is-grid', t.checked);
      store(t.checked ? '1' : '0');
      return;
    }
    if (t.matches('[data-file]')) {
      var file = t.files && t.files[0];
      var st = S.strips[S.fileFor];
      if (!file || !st) return;
      if (!/^image\//.test(file.type)) { ui().toast('That isn’t an image.', { tone: 'error' }); return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        // A new photo starts centred at 1×: the old crop was for a different picture.
        st.cur = { ox: 50, oy: 50, zoom: 1, photo: 'new', data: ev.target.result };
        setSrc(st, ev.target.result);
        edited(st);
      };
      reader.onerror = function () { ui().toast('Couldn’t read that file.', { tone: 'error' }); };
      reader.readAsDataURL(file);
    }
  });

  document.addEventListener('input', function (e) {
    if (!S || !e.target.matches || !e.target.matches('#agx [data-zoom-range]')) return;
    var st = selected();
    if (!st) return;
    st.cur.zoom = clamp(Number(e.target.value) / 100, 1, 3);
    edited(st);
  });

  // The save bar's buttons belong to the empty #agx-form.
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'agx-form') return;
    e.preventDefault();
    save();
  });
  document.addEventListener('reset', function (e) {
    if (!e.target || e.target.id !== 'agx-form' || !S) return;
    discard();
  });

  // Drag to pan. Mouse: press any photo and drag. Touch: the first tap selects, then drag,
  // so swiping across the image doesn't move photos by accident.
  document.addEventListener('pointerdown', function (e) {
    if (!S || e.button !== 0) return;
    var frame = e.target.closest && e.target.closest('#agx .agx-frame');
    if (!frame) return;
    var st = stripOf(frame);
    if (!st) return;
    var wasSelected = S.sel === st.i;
    if (!wasSelected) select(st.i);
    try { S.canvas.focus({ preventScroll: true }); } catch (err) { /* old browser */ }
    if (e.pointerType === 'touch' && !wasSelected) return;
    S.drag = { st: st, x: e.clientX, y: e.clientY, ox: st.cur.ox, oy: st.cur.oy };
    frame.classList.add('is-dragging');
    e.preventDefault();
  });
  window.addEventListener('pointermove', function (e) {
    if (!S || !S.drag) return;
    var st = S.drag.st, img = st.img;
    var fw = st.frame.clientWidth, fh = st.frame.clientHeight;
    if (!img.naturalWidth || !fw || !fh) return;
    var baseScale = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    var scale = baseScale * st.cur.zoom;
    var maxLeft = Math.max(0, img.naturalWidth * scale - fw), maxTop = Math.max(0, img.naturalHeight * scale - fh);
    var dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
    st.cur.ox = maxLeft ? clamp(S.drag.ox - (dx / maxLeft) * 100, 0, 100) : 50;
    st.cur.oy = maxTop ? clamp(S.drag.oy - (dy / maxTop) * 100, 0, 100) : 50;
    apply(st);
  });
  function endDrag() {
    if (!S || !S.drag) return;
    var st = S.drag.st;
    st.frame.classList.remove('is-dragging');
    S.drag = null;
    edited(st);
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Wheel zoom only over the selected photo; anywhere else the page scrolls as normal.
  document.addEventListener('wheel', function (e) {
    var st = selected();
    if (!st || S.view !== 'edit') return;
    var frame = e.target.closest && e.target.closest('#agx .agx-frame');
    if (!frame || stripOf(frame) !== st) return;
    e.preventDefault();
    st.cur.zoom = clamp(Math.round((st.cur.zoom + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, 1, 3);
    edited(st);
  }, { passive: false });

  // Arrow keys nudge the selected photo 1%, only while focus is in the editor and not in a
  // field (the zoom slider keeps its own arrow keys).
  document.addEventListener('keydown', function (e) {
    var st = selected();
    if (!st || S.view !== 'edit' || e.altKey || e.ctrlKey || e.metaKey) return;
    var a = document.activeElement;
    if (!a || !S.root.contains(a) || a.matches('input, textarea, select, [contenteditable]')) return;
    var k = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!k) return;
    e.preventDefault();
    st.cur.ox = clamp(st.cur.ox + k[0], 0, 100);
    st.cur.oy = clamp(st.cur.oy + k[1], 0, 100);
    edited(st);
  });

  window.addEventListener('resize', applyAll);
  window.addEventListener('beforeunload', function (e) {
    if (S && S.dirty && !S.saving && document.getElementById('agx')) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('admin:updated', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
