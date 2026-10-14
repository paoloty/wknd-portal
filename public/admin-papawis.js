// Papawis admin pages (admin redesign, 2026-10-15): views/admin/papawis-runs.js and
// views/admin/papawis-run.js. Generic actions (buttons, forms, confirms, toasts) are handled
// by public/admin-ui.js; this file only adds what's specific to Papawis:
//   • drag to reorder the roster (and move between Confirmed and the waitlist) and the teams
//   • the close-out price calculator, Save details, and Close out and charge
//   • Copy for Messenger
//   • cover upload / remove
//   • small form helpers: title from date, "Other…" court, deposit "Other amount"
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function (t) { alert(t); }, confirm: function (o) { return Promise.resolve(window.confirm(o.title)); } }; };
  var run = document.getElementById('pw-run');
  var cfg = {};
  try { cfg = JSON.parse(run ? run.getAttribute('data-config') : '{}') || {}; } catch (e) { cfg = {}; }

  function post(url, data, method) {
    return fetch(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong.'); return d; }); });
  }
  function reloadWith(msg) {
    var u = new URL(location.href);
    u.searchParams.set('toast', msg);
    location.href = u.pathname + u.search;
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────────────
  // "Other…" in a court list reveals the free-text field next to it.
  document.querySelectorAll('select[data-other-toggle]').forEach(function (sel) {
    var form = sel.form || document;
    var other = form.querySelector('[data-other-field]');
    var wrap = other && other.closest('.aui-field');
    function sync() { var on = sel.value === '__other__'; if (wrap) wrap.hidden = !on; if (other) other.hidden = !on; }
    if (other) { other.removeAttribute('hidden'); }
    sync();
    sel.addEventListener('change', sync);
  });
  // New run: the title follows the date ("Sunday (Oct 25)") until someone types their own.
  var titleEl = document.querySelector('[data-auto-title]');
  var dateEl = document.querySelector('[data-auto-title-source]');
  if (titleEl && dateEl) {
    var touched = false;
    titleEl.addEventListener('input', function () { touched = true; });
    dateEl.addEventListener('change', function () {
      if (touched || !dateEl.value) return;
      var d = new Date(dateEl.value + 'T00:00:00');
      titleEl.value = d.toLocaleDateString('en-US', { weekday: 'long' }) + ' (' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')';
    });
  }
  // Deposit picker: "Other amount" shows a number box with an "≈ N games" hint.
  document.querySelectorAll('select[data-deposit-select]').forEach(function (sel) {
    var form = sel.form, other = form.querySelector('[data-deposit-other]'), hint = form.querySelector('[data-deposit-detail]');
    var min = Number(sel.getAttribute('data-min')) || 0;
    sel.addEventListener('change', function () { other.hidden = sel.value !== '__other__'; if (!other.hidden) other.focus(); hint.textContent = ''; });
    other.addEventListener('input', function () {
      var n = Number(other.value) || 0;
      hint.textContent = min && n ? '≈ ' + (Math.round((n / min) * 10) / 10) + ' papawis games' + (n < min ? ' (below the ₱' + min + ' minimum)' : '') : '';
    });
  });

  // ── Drag to reorder: roster (two lists) and teams ───────────────────────────────────
  function rowAfter(list, y, sel) {
    var rows = [].slice.call(list.querySelectorAll(sel + ':not(.is-dragging)'));
    var best = null, bestOff = -Infinity;
    rows.forEach(function (r) { var b = r.getBoundingClientRect(); var off = y - b.top - b.height / 2; if (off < 0 && off > bestOff) { bestOff = off; best = r; } });
    return best;
  }

  // Roster: <tbody data-roster-list="confirmed|waitlist" data-dnd> rows <tr draggable>.
  var rosterLists = [].slice.call(document.querySelectorAll('tbody[data-roster-list][data-dnd]'));
  if (rosterLists.length && cfg.id) {
    var dragRow = null, dragFrom = null;
    var rowsOf = function (list) { return [].slice.call(list.querySelectorAll('tr[data-id]')); };
    var persist = function (status) {
      var list = document.querySelector('tbody[data-roster-list="' + status + '"]');
      var ids = rowsOf(list).map(function (r) { return r.getAttribute('data-id'); });
      return ids.length ? post('/admin/papawis/' + cfg.id + '/signups/reorder', { status: status, ids: ids }) : Promise.resolve();
    };
    var drop = function (list) {
      if (!dragRow) return;
      var to = list.getAttribute('data-roster-list');
      var id = dragRow.getAttribute('data-id');
      if (to === dragFrom) { persist(to).then(function () { renumber(); ui().toast('Order saved.'); }).catch(function (e) { ui().toast(e.message, { tone: 'error' }); }); return; }
      post('/admin/papawis/' + cfg.id + '/signups/' + id + '/status', { status: to })
        .then(function () { return persist(to); })
        .then(function () { reloadWith(to === 'confirmed' ? 'Moved to confirmed.' : 'Moved to the waitlist.'); })
        .catch(function (e) { ui().toast(e.message, { tone: 'error' }); setTimeout(function () { location.reload(); }, 1200); });
    };
    var renumber = function () {
      rosterLists.forEach(function (list) { rowsOf(list).forEach(function (r, i) { var n = r.querySelector('.pw-roster__n .aui-num'); if (n) n.textContent = i + 1; }); });
    };
    var canEnter = function (list) {
      return !(list.getAttribute('data-roster-list') === 'confirmed' && dragFrom !== 'confirmed' && rowsOf(list).filter(function (r) { return r !== dragRow; }).length >= cfg.max_slots);
    };
    var place = function (list, y) {
      var empty = list.querySelector('.pw-roster__empty'); if (empty) empty.remove();
      var after = rowAfter(list, y, 'tr[data-id]');
      if (after) list.insertBefore(dragRow, after); else list.appendChild(dragRow);
    };
    rowsOf(document).forEach(function (row) {
      if (!row.closest('tbody[data-dnd]')) return;
      row.addEventListener('dragstart', function (e) { dragRow = row; dragFrom = row.closest('tbody').getAttribute('data-roster-list'); row.classList.add('is-dragging'); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', function () { row.classList.remove('is-dragging'); rosterLists.forEach(function (l) { l.classList.remove('is-drag-over', 'is-drag-blocked'); }); dragRow = null; dragFrom = null; });
    });
    rosterLists.forEach(function (list) {
      list.addEventListener('dragover', function (e) {
        if (!dragRow) return;
        if (!canEnter(list)) { list.classList.add('is-drag-blocked'); return; }
        e.preventDefault();
        list.classList.add('is-drag-over');
        place(list, e.clientY);
      });
      list.addEventListener('dragleave', function (e) { if (e.target === list) list.classList.remove('is-drag-over', 'is-drag-blocked'); });
      list.addEventListener('drop', function (e) { e.preventDefault(); list.classList.remove('is-drag-over'); drop(list); });
    });
    // Touch: drag by the ⠿ handle with pointer events (native drag is mouse-only).
    document.querySelectorAll('tbody[data-dnd] .pw-handle').forEach(function (h) {
      h.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        var row = h.closest('tr'); e.preventDefault(); h.setPointerCapture(e.pointerId);
        dragRow = row; dragFrom = row.closest('tbody').getAttribute('data-roster-list'); row.classList.add('is-dragging');
        function move(ev) { var el = document.elementFromPoint(ev.clientX, ev.clientY); var list = el && el.closest('tbody[data-dnd]'); if (list && canEnter(list)) place(list, ev.clientY); }
        function up() { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); row.classList.remove('is-dragging'); drop(row.closest('tbody')); dragRow = null; dragFrom = null; }
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
    });
  }

  // Teams: <ul data-team-list="light|dark|"> items <li draggable data-team>.
  var teamLists = [].slice.call(document.querySelectorAll('ul[data-team-list]'));
  if (teamLists.length && cfg.id) {
    var tRow = null, tFrom = null;
    var tPersist = function (team) {
      var list = document.querySelector('ul[data-team-list="' + team + '"]');
      var ids = [].slice.call(list.querySelectorAll('li[data-id]')).map(function (li) { return li.getAttribute('data-id'); });
      return ids.length ? post('/admin/papawis/' + cfg.id + '/teams/reorder', { team: team, ids: ids }) : Promise.resolve();
    };
    var tCount = function () { teamLists.forEach(function (l) { var head = l.parentNode.querySelector('.pw-team__head .aui-num'); if (head) head.textContent = l.querySelectorAll('li[data-id]').length; }); };
    var tDrop = function (list) {
      if (!tRow) return;
      var to = list.getAttribute('data-team-list');
      tCount();
      if (to === tFrom) { if (to) tPersist(to).catch(function () {}); return; }
      tRow.setAttribute('data-team', to);
      if (!to) return; // "Unassigned" isn't a real side
      post('/admin/papawis/' + cfg.id + '/teams/assign', { signup_id: tRow.getAttribute('data-id'), team: to })
        .then(function () { return tPersist(to); })
        .then(function () { ui().toast('Moved to ' + (to === 'dark' ? 'Dark' : 'Light') + '.'); })
        .catch(function (e) { ui().toast(e.message, { tone: 'error' }); setTimeout(function () { location.reload(); }, 1200); });
    };
    var tPlace = function (list, y) {
      var empty = list.querySelector('.pw-team__empty'); if (empty) empty.remove();
      var after = rowAfter(list, y, 'li[data-id]');
      if (after) list.insertBefore(tRow, after); else list.appendChild(tRow);
    };
    document.querySelectorAll('li.pw-team__row').forEach(function (li) {
      li.addEventListener('dragstart', function () { tRow = li; tFrom = li.closest('ul').getAttribute('data-team-list'); li.classList.add('is-dragging'); });
      li.addEventListener('dragend', function () { li.classList.remove('is-dragging'); teamLists.forEach(function (l) { l.classList.remove('is-drag-over'); }); tRow = null; tFrom = null; });
    });
    teamLists.forEach(function (list) {
      list.addEventListener('dragover', function (e) { if (!tRow) return; e.preventDefault(); list.classList.add('is-drag-over'); tPlace(list, e.clientY); });
      list.addEventListener('dragleave', function (e) { if (e.target === list) list.classList.remove('is-drag-over'); });
      list.addEventListener('drop', function (e) { e.preventDefault(); list.classList.remove('is-drag-over'); tDrop(list); });
    });
    document.querySelectorAll('li.pw-team__row .pw-handle').forEach(function (h) {
      h.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        var li = h.closest('li'); e.preventDefault(); h.setPointerCapture(e.pointerId);
        tRow = li; tFrom = li.closest('ul').getAttribute('data-team-list'); li.classList.add('is-dragging');
        function move(ev) { var el = document.elementFromPoint(ev.clientX, ev.clientY); var list = el && el.closest('ul[data-team-list]'); if (list) tPlace(list, ev.clientY); }
        function up() { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); li.classList.remove('is-dragging'); tDrop(li.closest('ul')); tRow = null; tFrom = null; }
        h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
    });
  }

  // ── Close-out calculator (Money tab, open runs) ─────────────────────────────────────
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var $ = function (s) { return calc.querySelector(s); };
    var rateEl = $('[data-calc-rate]'), hoursEl = $('[data-calc-hours]'), refEl = $('[data-calc-ref]'), minEl = $('[data-calc-min]'), hasRefEl = $('[data-calc-hasref]');
    var priceEl = document.querySelector('[data-calc-price]');
    var count = Number(calc.getAttribute('data-count')) || 0;
    var r10 = function (n) { return Math.round(n / 10) * 10; };
    var peso = function (n) { return '₱' + Number(n || 0).toLocaleString(); };
    var nums = function () {
      var rate = Number(rateEl.value) || 0, hours = Number(hoursEl.value) || 0, hasRef = hasRefEl.checked;
      var ref = hasRef ? (Number(refEl.value) || 0) : 0, min = Number(minEl.value) || 0;
      var total = r10(rate * hours + ref * hours), raw = count ? r10(total / count) : 0;
      return { rate: rate, hours: hours, hasRef: hasRef, ref: ref, min: min, court: r10(rate * hours), refCost: r10(ref * hours), total: total, raw: raw, final: min > 0 ? r10(min) : raw };
    };
    var out = function (k, v) { var el = calc.querySelector('[data-calc-out="' + k + '"]'); if (el) el.textContent = v; };
    var recalc = function () {
      var n = nums();
      refEl.disabled = !n.hasRef;
      var refRow = calc.querySelector('[data-calc-refrow]'); if (refRow) refRow.hidden = !n.hasRef;
      out('court', peso(n.court)); out('ref', peso(n.refCost)); out('total', peso(n.total)); out('raw', peso(n.raw) + ' / player');
      if (priceEl && n.final > 0) priceEl.value = n.final;
    };
    [rateEl, hoursEl, refEl, minEl].forEach(function (el) { el.addEventListener('input', recalc); });
    hasRefEl.addEventListener('change', recalc);
    recalc();
    var payload = function () {
      var n = nums();
      return { court_rate: rateEl.value ? n.rate : null, hours: hoursEl.value ? n.hours : null, has_referee: n.hasRef, referee_rate: n.hasRef && refEl.value ? n.ref : null, actual_total: n.total, min_per_player: minEl.value ? n.min : null };
    };
    var save = calc.querySelector('[data-calc-save]');
    save.addEventListener('click', function () {
      save.disabled = true;
      post('/admin/papawis/' + cfg.id + '/estimate', payload())
        .then(function () { ui().toast('Price details saved.'); })
        .catch(function (e) { ui().toast(e.message, { tone: 'error' }); })
        .then(function () { save.disabled = false; });
    });
    var complete = document.querySelector('[data-calc-complete]');
    if (complete) complete.addEventListener('click', function () {
      var price = Number(priceEl.value) || 0;
      if (price <= 0) { ui().toast('Enter a price per player first.', { tone: 'error' }); priceEl.focus(); return; }
      ui().confirm({ title: 'Close out and charge ' + peso(price) + ' to ' + count + ' players?', body: 'Marks the run completed and adds the charge to every confirmed player. This can’t be undone from here.', sendLabel: 'Charge ' + count + ' players', typeToConfirm: count > 40 ? String(count) : '' })
        .then(function (ok) {
          if (!ok) return;
          complete.disabled = true; complete.textContent = 'Charging…';
          var p = payload(); p.price_per_player = price;
          post('/admin/papawis/' + cfg.id + '/complete', p)
            .then(function () { reloadWith('Run closed out: ' + count + ' players charged ' + peso(price) + '.'); })
            .catch(function (e) { ui().toast(e.message, { tone: 'error' }); complete.disabled = false; complete.textContent = 'Close out and charge…'; });
        });
    });
  }

  // ── Copy for Messenger ──────────────────────────────────────────────────────────────
  var copyBtn = document.querySelector('[data-copy-messenger]');
  if (copyBtn && cfg.id) {
    var clock = function (hhmm) { var p = String(hhmm).split(':'); var h = Number(p[0]), m = Number(p[1]); var h12 = h % 12 === 0 ? 12 : h % 12; return m === 0 ? h12 + (h >= 12 ? 'PM' : 'AM') : h12 + ':' + String(m).padStart(2, '0') + (h >= 12 ? 'PM' : 'AM'); };
    var text = function () {
      var d = new Date(cfg.date + 'T00:00:00');
      var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var lines = [];
      if (cfg.completed) {
        lines.push('🏀 PPWS : ' + monthDay + ' — Payment Status 🏀', '');
        cfg.confirmed.forEach(function (n, i) { lines.push((i + 1) + '. ' + n + ' ' + (cfg.paid[i] ? '✅' : '❌')); });
        lines.push('', '❌ = still unpaid — settle up through the Portal or send an admin your payment directly.');
        return lines.join('\n');
      }
      var day = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      var time = cfg.start_time && cfg.end_time ? clock(cfg.start_time) + '-' + clock(cfg.end_time) : '';
      lines.push('Papawis sign-ups are open! 🏀',
        'Head to the WKND Portal (https://wkndbasketball.com/papawis), log in, and tap Join to grab a slot. First come, first served — once we hit the slot limit, extra names go on the waitlist.', '',
        '⚠ Not able to make it? Cancel on the portal at least 3 days before game day. After that, message an admin directly — no-shows without notice may affect future priority. ⚠', '',
        '🏀 PPWS : ' + day + ' : ' + time + ' - ' + monthDay + ' 🏀');
      if (cfg.location) lines.push('📍 ' + cfg.location);
      lines.push('');
      for (var i = 0; i < cfg.max_slots; i++) lines.push((i + 1) + '. ' + (cfg.confirmed[i] || ''));
      if (cfg.waitlist.length) { lines.push('', 'Waitlist:'); cfg.waitlist.forEach(function (n, i) { lines.push((i + 1) + '. ' + n); }); }
      lines.push('', '💸 After the game, you can settle up anytime through your Portal account — totally optional, you can always just send payment straight to an admin instead.');
      return lines.join('\n');
    };
    copyBtn.addEventListener('click', function () {
      var t = text();
      navigator.clipboard.writeText(t).then(function () { ui().toast('Copied. Paste it into Messenger.'); })
        .catch(function () { window.prompt('Copy this text:', t); });
    });
  }

  // ── Cover upload ────────────────────────────────────────────────────────────────────
  var cover = document.querySelector('[data-cover]');
  if (cover) {
    var gid = cover.getAttribute('data-game');
    var input = cover.querySelector('[data-cover-input]'), frame = cover.querySelector('[data-cover-frame]'), img = cover.querySelector('[data-cover-img]');
    var rm = cover.querySelector('[data-cover-remove]'), msg = cover.querySelector('[data-cover-msg]');
    input.addEventListener('change', function () {
      var f = input.files && input.files[0]; if (!f) return;
      msg.textContent = 'Uploading…';
      var r = new FileReader();
      r.onload = function () {
        post('/admin/papawis/' + gid + '/cover', { dataUrl: r.result })
          .then(function () { img.src = '/api/papawis-cover/' + encodeURIComponent(gid) + '?v=' + Date.now(); frame.hidden = false; rm.hidden = false; msg.textContent = ''; ui().toast('Cover saved.'); })
          .catch(function (e) { msg.textContent = ''; ui().toast(e.message, { tone: 'error' }); })
          .then(function () { input.value = ''; });
      };
      r.readAsDataURL(f);
    });
    rm.addEventListener('click', function () {
      ui().confirm({ title: 'Remove this cover?', body: 'The court photo shows again.', sendLabel: 'Remove' }).then(function (ok) {
        if (!ok) return;
        fetch('/admin/papawis/' + gid + '/cover', { method: 'DELETE' })
          .then(function (res) { if (!res.ok) throw new Error('Couldn’t remove the cover.'); frame.hidden = true; rm.hidden = true; img.src = ''; ui().toast('Cover removed.'); })
          .catch(function (e) { ui().toast(e.message, { tone: 'error' }); });
      });
    });
  }
})();
