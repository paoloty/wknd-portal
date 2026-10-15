// Player admin pages (admin redesign, 2026-10-15): views/admin/players.js and
// views/admin/player-detail.js. Generic actions (buttons, forms, confirms, toasts, tabs)
// are handled by public/admin-ui.js; this file only adds what's specific to players:
//   • the photo: pick a file (HEIC converted in the browser), crop it, save it
//   • Team and Status selects that save as you change them
//   • the Papawis probation switch and reason (saved as { on, note })
//   • the season picker on Ratings and stats
//   • Recompute ratings on the list (reports how many players)
// Cropper.js and heic2any load only when someone actually changes a photo.
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function (t) { alert(t); }, confirm: function (o) { return Promise.resolve(window.confirm(o.title)); } }; };

  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong.'); return d; }); });
  }
  // Re-render this page in place with a toast (public/admin-ui.js), or reload.
  function reloadWith(msg) {
    if (window.adminUi && window.adminUi.refresh) { window.adminUi.refresh(msg); return; }
    var u = new URL(location.href);
    u.searchParams.set('toast', msg);
    location.href = u.pathname + u.search;
  }
  function playerId() {
    var el = document.querySelector('[data-apl-player]');
    return el ? el.getAttribute('data-apl-player') : '';
  }

  // ── Lazy loaders ─────────────────────────────────────────────────────────────────────
  var loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { delete loaded[src]; reject(new Error('Couldn’t load the photo tools. Check the connection.')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function loadCropper() {
    if (!document.querySelector('link[data-apl-cropper-css]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css';
      l.setAttribute('data-apl-cropper-css', '');
      document.head.appendChild(l);
    }
    return window.Cropper ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js');
  }
  function loadHeic() {
    return window.heic2any ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
  }

  // ── Photo crop ───────────────────────────────────────────────────────────────────────
  var cropper = null, pendingOriginal = null;

  // Neither sharp (server) nor Chrome/Firefox can decode HEIC, the iPhone default, so it is
  // converted to JPEG in the browser first; everything after that sees a normal JPEG.
  function isHeic(file) {
    var type = (file.type || '').toLowerCase();
    return type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(file.name || '');
  }
  function readAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) { resolve(e.target.result); };
      r.onerror = function () { reject(new Error('Couldn’t read this file. Try a different photo.')); };
      r.readAsDataURL(blob);
    });
  }

  function cropEls() {
    var back = document.querySelector('[data-apl-crop]');
    return back ? { back: back, img: back.querySelector('[data-apl-crop-img]'), save: back.querySelector('[data-apl-crop-save]') } : null;
  }

  function openCrop(src) {
    var c = cropEls();
    if (!c) return;
    loadCropper().then(function () {
      c.img.src = src;
      c.back.hidden = false;
      document.body.style.overflow = 'hidden';
      if (cropper) cropper.destroy();
      cropper = new window.Cropper(c.img, {
        aspectRatio: 1, viewMode: 1, dragMode: 'move', autoCropArea: 0.6, guides: true, highlight: false,
        cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
        ready: function () {
          // The head guide (oval + eye line) and zoom buttons, the same as the public profile.
          var box = c.back.querySelector('.cropper-crop-box');
          if (box && !box.querySelector('.pcp-head-guide')) {
            var g = document.createElement('div');
            g.className = 'pcp-head-guide';
            g.innerHTML = '<div class="pcp-head-guide__oval"></div><div class="pcp-head-guide__eyeline"></div>';
            box.appendChild(g);
          }
          var body = c.back.querySelector('.pcp-modal__body');
          if (body && !body.querySelector('.pcp-zoom-ctrl')) {
            var ctrl = document.createElement('div');
            ctrl.className = 'pcp-zoom-ctrl';
            ctrl.innerHTML = '<button type="button" class="pcp-zoom-btn" data-zoom="reset" aria-label="Reset crop" title="Reset crop">&#8635;</button>' +
              '<button type="button" class="pcp-zoom-btn" data-zoom="-0.1" aria-label="Zoom out">−</button>' +
              '<button type="button" class="pcp-zoom-btn" data-zoom="0.1" aria-label="Zoom in">+</button>';
            ctrl.addEventListener('click', function (e) {
              var b = e.target.closest('[data-zoom]');
              if (!b || !cropper) return;
              var z = b.getAttribute('data-zoom');
              if (z === 'reset') cropper.reset(); else cropper.zoom(parseFloat(z));
            });
            body.appendChild(ctrl);
          }
        },
      });
      c.save.focus();
    }).catch(function (err) { ui().toast(err.message, { tone: 'error' }); });
  }

  function closeCrop() {
    var c = cropEls();
    if (c) { c.back.hidden = true; c.save.disabled = false; c.save.textContent = 'Crop and save'; }
    document.body.style.overflow = '';
    if (cropper) { cropper.destroy(); cropper = null; }
    var input = document.querySelector('[data-apl-photo-input]');
    if (input) input.value = '';
    pendingOriginal = null;
  }

  function saveCrop() {
    var c = cropEls();
    if (!cropper || !c) return;
    c.save.disabled = true;
    c.save.textContent = 'Saving…';
    var dataUrl = cropper.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' }).toDataURL('image/jpeg', 0.88);
    post('/admin/players/' + encodeURIComponent(playerId()) + '/photo', { dataUrl: dataUrl, originalDataUrl: pendingOriginal || '' })
      .then(function () {
        // Show the new face right away; the in-place refresh brings the versioned URL.
        document.querySelectorAll('.apl-photo .aui-avatar__img').forEach(function (img) { img.src = dataUrl; });
        closeCrop();
        reloadWith('Photo saved.');
      })
      .catch(function (err) {
        c.save.disabled = false;
        c.save.textContent = 'Crop and save';
        ui().toast(err.message || 'Upload failed.', { tone: 'error' });
      });
  }

  function onPhotoFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var heic = isHeic(file);
    var prep = heic
      ? (ui().toast('Converting the HEIC photo…'), loadHeic().then(function () { return window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }); }).then(function (r) { return Array.isArray(r) ? r[0] : r; }))
      : Promise.resolve(file);
    prep.then(readAsDataUrl).then(function (dataUrl) {
      pendingOriginal = dataUrl;
      openCrop(dataUrl);
    }).catch(function (err) {
      input.value = '';
      ui().toast(heic ? 'Couldn’t convert this HEIC photo. Export it as JPEG first.' : (err.message || 'Couldn’t read this file.'), { tone: 'error' });
    });
  }

  // ── Delegated handlers (set once; they work on whatever content is on the page) ─────
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('[data-apl-photo-pick]')) {
      var input = document.querySelector('[data-apl-photo-input]');
      if (input) input.click();
      return;
    }
    var face = t.closest('[data-apl-recrop]');
    if (face && !face.disabled) {
      pendingOriginal = null;
      openCrop('/api/player/' + encodeURIComponent(playerId()) + '/photo-source?t=' + Date.now());
      return;
    }
    if (t.closest('[data-apl-crop-close]')) { closeCrop(); return; }
    if (t.closest('[data-apl-crop-save]')) { saveCrop(); return; }
    var back = t.closest('[data-apl-crop]');
    if (back && t === back) { closeCrop(); return; }

    // Recompute ratings for every player (list page).
    var all = t.closest('[data-apl-recompute-all]');
    if (all) {
      e.preventDefault();
      if (all.disabled) return;
      ui().confirm({ title: all.getAttribute('data-title'), body: all.getAttribute('data-body'), sendLabel: 'Recompute' }).then(function (ok) {
        if (!ok) return;
        var label = all.textContent;
        all.disabled = true;
        all.textContent = 'Recomputing…';
        post('/admin/players/recompute-all', { season: all.getAttribute('data-season') || '' })
          .then(function (d) { reloadWith('Recomputed ratings for ' + (d.count || 0) + ' player' + (d.count === 1 ? '' : 's') + '.'); })
          .catch(function (err) { all.disabled = false; all.textContent = label; ui().toast(err.message, { tone: 'error' }); });
      });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cropper) closeCrop();
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.matches) return;
    if (t.matches('[data-apl-photo-input]')) { onPhotoFile(t); return; }

    // Team / Status: save as you change them.
    if (t.matches('select[data-apl-autosave]')) {
      var body = {};
      body[t.name] = t.value;
      var label = t.options[t.selectedIndex] ? t.options[t.selectedIndex].text : t.value;
      t.disabled = true;
      post(t.getAttribute('data-apl-autosave'), body)
        .then(function () { reloadWith(t.name === 'status' ? 'Status set to ' + label + '.' : 'Team changed to ' + label + '.'); })
        .catch(function (err) { t.disabled = false; ui().toast(err.message, { tone: 'error' }); if (window.adminUi) window.adminUi.softLoad(location.href); });
      return;
    }

    // Ratings and stats: the season picker loads that season in place.
    var season = t.closest && t.closest('[data-apl-season]');
    if (season && t.name === 'season') {
      var url = season.getAttribute('data-base') + (t.value && t.value !== 'all' ? '&season=' + encodeURIComponent(t.value) : '');
      if (window.adminUi && window.adminUi.softLoad) window.adminUi.softLoad(url, { push: true }); else location.href = url;
    }
  });

  // ── Per-element wiring (runs on load and after every in-place update) ──────────────
  function init() {
    // Papawis probation: the switch saves right away, the reason when you click away.
    document.querySelectorAll('form[data-apl-probation]').forEach(function (form) {
      if (form.__aplInit) return; form.__aplInit = true;
      var url = form.getAttribute('data-apl-probation');
      var on = form.querySelector('input[type=hidden][name="probation"]');
      var note = form.querySelector('[name="note"]');
      var save = function (msg, refresh) {
        return post(url, { on: on.value === '1', note: note.value })
          .then(function () { if (refresh) reloadWith(msg); else ui().toast(msg); })
          .catch(function (err) { ui().toast(err.message, { tone: 'error' }); if (window.adminUi) window.adminUi.softLoad(location.href); });
      };
      on.addEventListener('input', function () { save(on.value === '1' ? 'Probation on: their sign-ups wait for a deposit.' : 'Probation off.', true); });
      note.addEventListener('change', function () { save('Reason saved.', false); });
      form.addEventListener('submit', function (e) { e.preventDefault(); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('admin:updated', function () { if (cropper) closeCrop(); init(); });
})();
