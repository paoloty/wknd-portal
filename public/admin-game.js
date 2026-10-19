// Game page (views/admin/game.js), browser side. Generic actions (JSON forms, confirms,
// switches, save bar, in-place re-render, toasts) come from public/admin-ui.js; this adds:
//   • the box score's team switch (remembered per game, so a correction on the second team
//     comes back to that team) and ✎ corrections: one POST per changed field to
//     /admin/games/:id/stats/:playerId, so each lands in the correction history
//   • importing the game file, with upload and processing progress
//   • the recap editor (Quill, loaded on demand) mirrored into the form's game_writeup
//   • ✦ Write with AI for the recap and the player of the game
//   • cover upload (resized in the browser first) and the pick window
// Click and change handlers are delegated once; init() re-runs after every in-place
// re-render (admin:updated), since #admin-main is replaced.
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function (t) { console.log(t); }, refresh: function () { location.reload(); } }; };
  var root = function () { return document.getElementById('agd'); };
  var gameId = function () { var r = root(); return r ? r.getAttribute('data-game') : ''; };
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function post(url, data, method) {
    return fetch(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong.'); return d; }); });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ── Team switch ───────────────────────────────────────────────────────────────────
  function showTeam(side) {
    document.querySelectorAll('[data-team-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-team-panel') !== side; });
    var r = document.querySelector('[data-team-pick][value="' + side + '"]');
    if (r) r.checked = true;
  }

  // ── Box score corrections ───────────────────────────────────────────────────────────
  var SHOT = { fg2: ['fg2m', 'fg2m_miss'], fg3: ['fg3m', 'fg3m_miss'], fg4: ['fg4m', 'fg4m_miss'], ft: ['ftm', 'ft_miss'] };
  function setEditing(tr, on) {
    tr.classList.toggle('is-editing', on);
    tr.querySelectorAll('.agd-v').forEach(function (el) { el.hidden = on; });
    tr.querySelectorAll('.agd-e').forEach(function (el) { el.hidden = !on; });
    tr.querySelector('.agd-act__view').hidden = on;
    tr.querySelector('.agd-act__edit').hidden = !on;
    if (on) { var f = tr.querySelector('.agd-in'); if (f) f.focus(); }
  }
  function resetRow(tr) {
    var o = JSON.parse(tr.getAttribute('data-orig'));
    tr.querySelectorAll('[data-shot]').forEach(function (inp) {
      var k = SHOT[inp.getAttribute('data-shot')];
      inp.value = inp.getAttribute('data-role') === 'made' ? o[k[0]] : o[k[0]] + o[k[1]];
    });
    tr.querySelectorAll('[data-field]').forEach(function (inp) { inp.value = o[inp.getAttribute('data-field')]; });
  }
  function changes(tr) {
    var o = JSON.parse(tr.getAttribute('data-orig')), out = {}, bad = '';
    var num = function (el) { return Math.max(0, parseInt(el.value, 10) || 0); };
    Object.keys(SHOT).forEach(function (s) {
      var m = tr.querySelector('[data-shot="' + s + '"][data-role="made"]');
      var a = tr.querySelector('[data-shot="' + s + '"][data-role="att"]');
      if (!m || !a) return;
      var made = num(m), att = num(a);
      if (att < made) bad = 'Attempts can’t be fewer than makes.';
      var miss = Math.max(0, att - made);
      if (made !== o[SHOT[s][0]]) out[SHOT[s][0]] = made;
      if (miss !== o[SHOT[s][1]]) out[SHOT[s][1]] = miss;
    });
    tr.querySelectorAll('[data-field]').forEach(function (inp) {
      var k = inp.getAttribute('data-field'), v = num(inp);
      if (v !== o[k]) out[k] = v;
    });
    return { out: out, bad: bad };
  }
  function saveRow(tr, btn) {
    var c = changes(tr);
    if (c.bad) { ui().toast(c.bad, { tone: 'error' }); return; }
    var fields = Object.keys(c.out);
    if (!fields.length) { setEditing(tr, false); return; }
    btn.disabled = true;
    var url = '/admin/games/' + encodeURIComponent(gameId()) + '/stats/' + encodeURIComponent(tr.getAttribute('data-player'));
    var chain = Promise.resolve();
    fields.forEach(function (f) { chain = chain.then(function () { return post(url, { field: f, value: c.out[f] }); }); });
    chain.then(function () {
      ui().refresh(fields.length === 1 ? 'Line corrected. The change is logged.' : fields.length + ' changes saved and logged.');
    }).catch(function (err) {
      btn.disabled = false;
      ui().toast(err.message, { tone: 'error' });
    });
  }

  // ── Import the game file ────────────────────────────────────────────────────────────
  function runImport(box) {
    var file = box.querySelector('[data-import-file]').files[0];
    if (!file) return;
    var go = box.querySelector('[data-import-go]');
    var wrap = box.querySelector('[data-import-progress]');
    var fill = wrap.querySelector('.aui-progress__fill');
    var label = wrap.querySelector('.aui-progress__label');
    var set = function (pct, text) { if (fill) fill.style.width = Math.max(1, pct) + '%'; if (label) label.textContent = text; };
    go.disabled = true; go.textContent = 'Importing…';
    wrap.hidden = false; set(0, 'Reading the file…');
    file.text().then(function (text) {
      var payload;
      try { payload = JSON.parse(text); } catch (e) { throw new Error('That file isn’t a game file (not valid JSON).'); }
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest(), start = 0, ticker = null;
        xhr.open('POST', box.getAttribute('data-import'));
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.upload.onprogress = function (e) { if (e.lengthComputable) set(Math.round(e.loaded / e.total * 100), 'Uploading… ' + Math.round(e.loaded / e.total * 100) + '%'); };
        xhr.upload.onload = function () {
          start = Date.now(); set(100, 'Processing… 0s');
          ticker = setInterval(function () { set(100, 'Processing… ' + Math.round((Date.now() - start) / 1000) + 's'); }, 1000);
        };
        xhr.onload = function () {
          clearInterval(ticker);
          var d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) { /* not JSON */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(d); else reject(new Error(d.error || 'The import failed.'));
        };
        xhr.onerror = function () { clearInterval(ticker); reject(new Error('Couldn’t reach the server.')); };
        xhr.send(JSON.stringify(payload));
      });
    }).then(function (d) {
      var dr = box.closest('[data-drawer]'); if (dr) dr.hidden = true;
      ui().refresh(d && d.swapped ? 'Imported. The file had the teams reversed, so they were swapped to match.' : 'Imported: score, box score and player stats.');
    }).catch(function (err) {
      wrap.hidden = true; go.disabled = false; go.textContent = 'Import results';
      ui().toast(err.message, { tone: 'error' });
    });
  }

  // ── Recap editor (Quill 2, loaded once) ────────────────────────────────────────────
  var quill = null, quillLoading = null;
  function loadQuill() {
    if (window.Quill) return Promise.resolve();
    if (quillLoading) return quillLoading;
    quillLoading = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
      s.onload = resolve; s.onerror = function () { quillLoading = null; reject(new Error('The editor didn’t load.')); };
      document.head.appendChild(s);
    });
    return quillLoading;
  }
  // Quill keeps a trailing empty paragraph for the cursor; drop leading/trailing empty ones
  // so they don't ship as a blank gap on the public page. Interior ones stay.
  function cleanHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var empty = function (el) { return !!el && (el.tagName === 'P' || el.tagName === 'DIV') && !el.textContent.trim() && !el.querySelector('img, video, iframe'); };
    while (empty(div.firstElementChild)) div.firstElementChild.remove();
    while (empty(div.lastElementChild)) div.lastElementChild.remove();
    return div.innerHTML.trim();
  }
  function syncRecap(dirty) {
    var ta = document.querySelector('[data-recap-html]');
    if (!quill || !ta) return;
    ta.value = cleanHtml(quill.root.innerHTML);
    var words = quill.getText().trim().split(/\s+/).filter(Boolean).length;
    document.querySelectorAll('[data-recap-words]').forEach(function (el) { el.textContent = String(words); });
    if (dirty) ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function initRecap() {
    var host = document.querySelector('[data-recap-editor]');
    quill = null;
    if (!host) return;
    loadQuill().then(function () {
      if (!document.body.contains(host)) return;
      quill = new window.Quill(host, {
        theme: 'snow', placeholder: 'Write the game recap here…',
        modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'clean']] },
      });
      var ta = document.querySelector('[data-recap-html]');
      quill.clipboard.dangerouslyPasteHTML(ta ? ta.value : '', 'silent');
      quill.on('text-change', function (d, o, source) { syncRecap(source === 'user'); });
      // Discard resets the form's textarea; put the editor back too.
      var form = host.closest('form');
      if (form) form.addEventListener('reset', function () { setTimeout(function () { if (quill && ta) quill.clipboard.dangerouslyPasteHTML(ta.value, 'silent'); syncRecap(false); }, 0); });
    }).catch(function (err) { host.textContent = err.message; });
  }

  // ── ✦ Write with AI ────────────────────────────────────────────────────────────────
  function writeWithAi(btn) {
    var target = btn.getAttribute('data-ai-target');
    var status = document.querySelector('[data-ai-status="' + target + '"]');
    var potg = document.querySelector('input[name="potg_player_id"]:checked');
    var coPick = document.querySelector('[data-copotg-pick]');
    var potgId = potg ? potg.value : null, coId = coPick ? coPick.value : '';
    // Each Player of the Game gets their own spotlight; the other one is passed as shared_with.
    var body = target === 'copotg'
      ? { player_id: coId, shared_with: potgId }
      : { player_id: potgId, shared_with: coId, co_player_id: coId };
    if (target === 'copotg' && !coId) { ui().toast('Pick the co-player of the game first.', { tone: 'error' }); return; }
    if (target === 'recap') { var ctx = document.querySelector('[data-recap-context]'); body.context = ctx ? ctx.value : ''; }
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Writing…';
    if (status) status.textContent = '';
    post(btn.getAttribute('data-ai'), body).then(function (d) {
      var text = String(d.writeup || '');
      if (target === 'recap') {
        if (!quill) throw new Error('The editor isn’t ready yet.');
        quill.clipboard.dangerouslyPasteHTML('<p>' + esc(text).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>', 'silent');
        syncRecap(true);
      } else {
        var ta = document.querySelector(target === 'copotg' ? '[data-copotg-text]' : '[data-potg-text]');
        if (ta) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      }
      if (status) status.textContent = 'Written. Read it over, then Save content.';
    }).catch(function (err) {
      ui().toast(err.message, { tone: 'error' });
    }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  // ── Cover ────────────────────────────────────────────────────────────────────────────
  function uploadCover(input) {
    var file = input.files[0];
    if (!file) return;
    var box = input.closest('[data-cover-game]');
    var status = box.querySelector('[data-cover-status]');
    status.textContent = 'Resizing…';
    new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var r = Math.min(1200 / img.naturalWidth, 900 / img.naturalHeight, 1);
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { reject(new Error('That image couldn’t be read.')); };
      img.src = url;
    }).then(function (dataUrl) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/admin/games/' + encodeURIComponent(box.getAttribute('data-cover-game')) + '/cover');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.upload.onprogress = function (e) { if (e.lengthComputable) status.textContent = 'Uploading… ' + Math.round(e.loaded / e.total * 100) + '%'; };
        xhr.onload = function () { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('The upload failed.')); };
        xhr.onerror = function () { reject(new Error('Couldn’t reach the server.')); };
        xhr.send(JSON.stringify({ dataUrl: dataUrl }));
      });
    }).then(function () {
      if (ui().hasUnsaved && ui().hasUnsaved()) {
        var img = box.querySelector('.agd-cover__img');
        var src = '/admin/games/' + encodeURIComponent(box.getAttribute('data-cover-game')) + '/cover-img?v=' + Date.now();
        if (img) img.src = src; else { var e = box.querySelector('.agd-cover__empty'); if (e) { var n = document.createElement('img'); n.className = 'agd-cover__img'; n.alt = 'Cover'; n.src = src; e.replaceWith(n); } }
        status.textContent = 'Cover saved. Your other edits are still unsaved.';
        ui().toast('Cover saved.');
      } else ui().refresh('Cover saved.');
    })
      .catch(function (err) { status.textContent = 'Shown on the game page and share cards'; ui().toast(err.message, { tone: 'error' }); input.value = ''; });
  }

  // ── Delegated handlers (bound once) ─────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest || !root()) return;
    var ed = t.closest('[data-row-edit]');
    if (ed) { setEditing(ed.closest('tr'), true); return; }
    var cancel = t.closest('[data-row-cancel]');
    if (cancel) { var tr = cancel.closest('tr'); resetRow(tr); setEditing(tr, false); return; }
    var save = t.closest('[data-row-save]');
    if (save) { saveRow(save.closest('tr'), save); return; }
    var go = t.closest('[data-import-go]');
    if (go) { runImport(go.closest('[data-import]')); return; }
    var ai = t.closest('[data-ai]');
    if (ai) { e.preventDefault(); writeWithAi(ai); return; }
    var imp = t.closest('a[href$="#import"]');
    if (imp && document.getElementById('import')) { e.preventDefault(); document.getElementById('import').hidden = false; }
  });
  document.addEventListener('keydown', function (e) {
    var tr = e.target.closest && e.target.closest('tr.is-editing');
    if (!tr) return;
    if (e.key === 'Enter') { e.preventDefault(); saveRow(tr, tr.querySelector('[data-row-save]')); }
    if (e.key === 'Escape') { e.stopPropagation(); resetRow(tr); setEditing(tr, false); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.matches || !root()) return;
    if (t.matches('[data-team-pick]')) { showTeam(t.value); store('agd-team-' + gameId(), t.value); return; }
    if (t.matches('[data-import-file]')) {
      var box = t.closest('[data-import]');
      box.querySelector('[data-import-name]').textContent = t.files[0] ? t.files[0].name : 'Choose the exported file (.json)…';
      box.querySelector('[data-import-go]').disabled = !t.files[0];
      return;
    }
    if (t.matches('[data-cover-file]')) { uploadCover(t); return; }
    if (t.matches('[data-copotg-pick]')) { syncCoPotg(); return; }
    var win = t.closest('[data-pick-window]');
    if (win && t.name === 'closed') {
      post(win.getAttribute('data-pick-window'), { closed: t.value })
        .then(function () { ui().refresh({ auto: 'Picks follow the game-day cut-off.', closed: 'Picks closed.', open: 'Picks kept open.' }[t.value] || 'Saved.'); })
        .catch(function (err) { ui().toast(err.message, { tone: 'error' }); });
    }
  });

  // The co-POTG write-up shows only once a co-player is picked.
  function syncCoPotg() {
    var pick = document.querySelector('[data-copotg-pick]');
    var box = document.querySelector('[data-copotg-fields]');
    if (pick && box) box.hidden = !pick.value;
  }

  function init() {
    if (!root()) return;
    syncCoPotg();
    var form = document.getElementById('game-content');
    if (form) form.addEventListener('reset', function () { setTimeout(syncCoPotg, 0); });
    var side = store('agd-team-' + gameId());
    if (side === 'b' && document.querySelector('[data-team-panel="b"]')) showTeam('b');
    initRecap();
    if (location.hash === '#import' && document.getElementById('import')) document.getElementById('import').hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('admin:updated', init);
})();
