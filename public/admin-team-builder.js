// Team builder + Sandbox board (views/admin/season-teams.js), 2026-10-15 rebuild. Generic
// bits (toasts, confirm dialog, drawers, ⋯ menus, in-place refresh) come from
// public/admin-ui.js; this file adds the board itself:
//   • drag a player with the mouse, or Move… / × on any player (keyboard and phones)
//   • live team meters, balance strip, pool search / position filter / sort
//   • save bar with an unsaved-move count, Discard, beforeunload warning
//   • Add / rename / remove team, use the league teams, publish switch, Auto-balance
//   • Sandbox: pool source switch (warns first), "Sandbox vs the real draft", Copy to the
//     real builder
// Handlers are delegated on document and bound once; init() re-reads the board after the
// content is swapped in place ('admin:updated').
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function () {}, confirm: function () { return Promise.resolve(false); }, refresh: function () { location.reload(); }, softLoad: function (u) { location.href = u; } }; };
  var cfg = null, root = null, snapshot = null, dragging = null, sortKey = 'ovr', sortDir = -1, posOn = {}, query = '';

  function post(url, data) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'Something went wrong.'); return d; }); });
  }
  function $$(sel, el) { return [].slice.call((el || root || document).querySelectorAll(sel)); }
  function n(v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); }
  function avgOf(items, k) {
    var v = items.map(function (li) { return n(li.getAttribute('data-' + k)); }).filter(function (x) { return x != null; });
    return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
  }
  function teams() { return $$('.atb-team'); }
  function teamOf(li) { var t = li.closest('.atb-team'); return t ? t.getAttribute('data-team-id') : ''; }
  function playersIn(el) { return $$('.atb-p', el); }
  function pool() { return root.querySelector('.atb-list--pool'); }

  // ── State ───────────────────────────────────────────────────────────────────────────
  function readState() {
    var at = {}, meta = {};
    $$('.atb-p').forEach(function (li) { at[li.getAttribute('data-id')] = teamOf(li); });
    teams().forEach(function (t) { meta[t.getAttribute('data-team-id')] = t.getAttribute('data-name') + '|' + t.getAttribute('data-color'); });
    return { at: at, meta: meta };
  }
  function changes() {
    if (!snapshot) return 0;
    var now = readState(), c = 0;
    Object.keys(now.at).forEach(function (id) { if ((snapshot.at[id] || '') !== now.at[id]) c++; });
    Object.keys(now.meta).forEach(function (id) { if (snapshot.meta[id] !== now.meta[id]) c++; });
    return c;
  }
  function isDirty() { return !!(cfg && !cfg.locked && changes() > 0); }

  // ── Render bits ─────────────────────────────────────────────────────────────────────
  // Very dark team colours (Black) get a light outline on dots and rings (same rule as
  // isDarkColor in views/admin/season-teams.js).
  function isDark(c) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim()); if (!m) return false;
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2;
  }
  function paintDot(el, color) { el.style.background = color; el.classList.toggle('is-dark', isDark(color)); }
  function ring(li, color) {
    var av = li.querySelector('.aui-avatar');
    var ok = /^#[0-9a-f]{3,8}$/i.test(color || '');
    if (av) av.style.boxShadow = '0 0 0 2px ' + (ok ? color : 'rgba(255,255,255,.18)') + (ok && isDark(color) ? ',0 0 0 3px rgba(255,255,255,.35)' : '');
  }
  var PUBLISHED_LINE = 'Published: players see changes as soon as you save.';
  // The publish switch changes what a save means for players: keep the copy honest.
  function paintPublished() {
    if (!root || cfg.sandbox) return;
    var note = root.querySelector('[data-atb-savenote]');
    if (note) note.textContent = cfg.published ? PUBLISHED_LINE : 'saved as a draft; players see nothing until you publish';
    var sub = root.querySelector('.aui-head__sub');
    if (sub && !cfg.locked) sub.textContent = sub.textContent.replace(/(Published: players see changes as soon as you save\.|Nothing changes for players until you publish\.)$/, cfg.published ? PUBLISHED_LINE : 'Nothing changes for players until you publish.');
  }
  function sortList(list, key, dir) {
    var drop = list.querySelector('.atb-drop');
    playersIn(list).sort(function (a, b) {
      if (key === 'name') return dir * a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      var x = n(a.getAttribute('data-' + key)), y = n(b.getAttribute('data-' + key));
      if (x == null && y == null) return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      if (x == null) return 1; if (y == null) return -1;
      return dir * (x - y) || a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
    }).forEach(function (li) { list.insertBefore(li, drop); });
  }
  function applyFilters() {
    var list = pool(); if (!list) return;
    var anyPos = Object.keys(posOn).some(function (k) { return posOn[k]; });
    var shown = 0, all = playersIn(list);
    all.forEach(function (li) {
      var ok = (!anyPos || posOn[li.getAttribute('data-pos')]) && (!query || li.getAttribute('data-name').indexOf(query) >= 0);
      li.hidden = !ok; if (ok) shown++;
    });
    var empty = root.querySelector('[data-atb-pool-empty]'), none = root.querySelector('[data-atb-pool-nomatch]');
    if (empty) empty.hidden = all.length > 0;
    if (none) none.hidden = !(all.length > 0 && shown === 0);
  }

  function refresh() {
    if (!root) return;
    var tlist = teams();
    var stats = tlist.map(function (t) {
      var items = playersIn(t.querySelector('.atb-list'));
      var s = { name: t.getAttribute('data-name'), color: t.getAttribute('data-color'), count: items.length, ovr: avgOf(items, 'ovr'), off: avgOf(items, 'off'), def: avgOf(items, 'def'), items: items };
      var c = t.querySelector('[data-count]'); if (c) c.textContent = items.length + (items.length === 1 ? ' player' : ' players');
      ['ovr', 'off', 'def'].forEach(function (k) {
        var m = t.querySelector('[data-meter="' + k + '"]'); if (!m) return;
        m.querySelector('.atb-meter__fill').style.width = (s[k] || 0) + '%';
        m.querySelector('b').textContent = s[k] == null ? '–' : s[k];
      });
      sortList(t.querySelector('.atb-list'), 'ovr', -1);
      return s;
    });
    var p = pool();
    if (p) {
      sortList(p, sortKey, sortDir);
      var pc = root.querySelector('[data-atb-pool-count]'); if (pc) pc.textContent = playersIn(p).length;
    }
    applyFilters();

    // Balance strip: the spread between team averages, and roster sizes.
    var strip = root.querySelector('[data-atb-balance-strip]');
    if (strip) {
      ['ovr', 'off', 'def', 'size'].forEach(function (k) {
        var cell = strip.querySelector('[data-spread="' + k + '"]');
        var val = '–', even = null;
        if (k === 'size') {
          if (stats.some(function (s) { return s.count; })) { var cs = stats.map(function (s) { return s.count; }); val = cs.join(' · '); even = Math.max.apply(null, cs) - Math.min.apply(null, cs) <= 1; }
        } else {
          var v = stats.map(function (s) { return s[k]; }).filter(function (x) { return x != null; });
          if (v.length > 1) { var sp = Math.max.apply(null, v) - Math.min.apply(null, v); val = sp + (sp === 1 ? ' pt' : ' pts'); even = sp <= 3; }
        }
        cell.querySelector('b').textContent = val;
        var note = cell.querySelector('.atb-balance__note');
        note.textContent = even == null ? '' : even ? 'Even' : 'Uneven';
        note.className = 'atb-balance__note' + (even == null ? '' : even ? ' aui-tone--green' : ' aui-tone--amber');
      });
    }

    // Sandbox vs the real draft
    var cmp = root.querySelector('[data-atb-compare]');
    if (cmp) {
      var real = {}; (cfg.real || []).forEach(function (t) { real[String(t.name).trim().toLowerCase()] = t; });
      cmp.innerHTML = '';
      if ((cfg.real || []).length) {
        var head = document.createElement('div'); head.className = 'atb-compare__row is-head';
        head.innerHTML = '<span>Team</span><span>Real</span><span>Sandbox</span><span>±</span>';
        cmp.appendChild(head);
        stats.forEach(function (s) {
          var r = real[String(s.name).trim().toLowerCase()];
          var row = document.createElement('div'); row.className = 'atb-compare__row';
          var nm = document.createElement('span'); nm.className = 'atb-compare__name';
          var dot = document.createElement('span'); dot.className = 'atb-dot'; paintDot(dot, s.color);
          nm.appendChild(dot); nm.appendChild(document.createTextNode(s.name));
          var rv = document.createElement('span'); rv.className = 'atb-num'; rv.textContent = r && r.ovr != null ? r.ovr : '–';
          var sv = document.createElement('b'); sv.className = 'atb-num is-amber'; sv.textContent = s.ovr == null ? '–' : s.ovr;
          var d = (r && r.ovr != null && s.ovr != null) ? s.ovr - r.ovr : null;
          var dv = document.createElement('span'); dv.className = 'atb-compare__d ' + (d == null || d === 0 ? 'aui-tone--gray' : d > 0 ? 'aui-tone--green' : 'aui-tone--red');
          dv.textContent = d == null ? (r ? '–' : 'new') : d > 0 ? '+' + d : String(d);
          row.appendChild(nm); row.appendChild(rv); row.appendChild(sv); row.appendChild(dv);
          cmp.appendChild(row);
        });
      }
      var foot = root.querySelector('[data-atb-compare-foot]');
      if (foot) {
        var moved = 0;
        stats.forEach(function (s) { s.items.forEach(function (li) { var rt = li.getAttribute('data-real-team'); if (rt && rt.trim().toLowerCase() !== String(s.name).trim().toLowerCase()) moved++; }); });
        foot.textContent = (cfg.real || []).length ? (moved === 1 ? '1 player is on a different team than the real draft.' : moved + ' players are on a different team than the real draft.') : '';
        foot.hidden = !(cfg.real || []).length;
      }
    }

    // Save bar
    var bar = root.querySelector('[data-atb-savebar]');
    if (bar) {
      var c2 = changes();
      bar.hidden = c2 === 0;
      var label = bar.querySelector('[data-atb-dirty]');
      if (label) label.textContent = c2 === 1 ? '1 unsaved change' : c2 + ' unsaved changes';
    }
  }

  // ── Moves ───────────────────────────────────────────────────────────────────────────
  function moveTo(li, teamId) {
    var list = teamId ? root.querySelector('.atb-team[data-team-id="' + CSS.escape(teamId) + '"] .atb-list') : pool();
    if (!list) return;
    list.insertBefore(li, list.querySelector('.atb-drop'));
    li.hidden = false;
    var t = li.closest('.atb-team');
    ring(li, t ? t.getAttribute('data-color') : '');
    refresh();
  }

  var menuEl = null, menuFor = null;
  function closeMoveMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    if (menuFor) { menuFor.setAttribute('aria-expanded', 'false'); menuFor = null; }
  }
  function openMoveMenu(btn) {
    var li = btn.closest('.atb-p');
    if (menuEl && menuFor === btn) { closeMoveMenu(); return; }
    closeMoveMenu();
    var here = teamOf(li);
    var box = document.createElement('div');
    box.className = 'aui-menu__list atb-movemenu';
    box.setAttribute('role', 'menu');
    var title = document.createElement('div'); title.className = 'atb-movemenu__title';
    title.textContent = 'Move ' + li.getAttribute('data-display') + ' to';
    box.appendChild(title);
    teams().forEach(function (t) {
      var id = t.getAttribute('data-team-id');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aui-menu__item'; b.setAttribute('role', 'menuitem');
      var dot = document.createElement('span'); dot.className = 'atb-dot'; paintDot(dot, t.getAttribute('data-color'));
      b.appendChild(dot); b.appendChild(document.createTextNode(t.getAttribute('data-name')));
      var cnt = document.createElement('small'); cnt.textContent = id === here ? 'here' : playersIn(t).length;
      b.appendChild(cnt);
      if (id === here) b.disabled = true;
      b.addEventListener('click', function () { closeMoveMenu(); moveTo(li, id); btn.focus(); });
      box.appendChild(b);
    });
    if (!teams().length) { var none = document.createElement('div'); none.className = 'atb-movemenu__none'; none.textContent = 'Add a team first.'; box.appendChild(none); }
    if (here) {
      var sep = document.createElement('div'); sep.className = 'aui-menu__sep'; box.appendChild(sep);
      var back = document.createElement('button'); back.type = 'button'; back.className = 'aui-menu__item'; back.setAttribute('role', 'menuitem');
      back.textContent = 'Back to the pool';
      back.addEventListener('click', function () { closeMoveMenu(); moveTo(li, ''); });
      box.appendChild(back);
    }
    document.body.appendChild(box);
    var r = btn.getBoundingClientRect();
    var w = box.offsetWidth, h = box.offsetHeight;
    var left = Math.min(Math.max(8, r.right - w), document.documentElement.clientWidth - w - 8);
    var top = r.bottom + 4;
    if (top + h > window.innerHeight - 8 && r.top - h - 4 > 8) top = r.top - h - 4;
    box.style.left = (left + window.scrollX) + 'px';
    box.style.top = (top + window.scrollY) + 'px';
    menuEl = box; menuFor = btn;
    btn.setAttribute('aria-expanded', 'true');
    var first = box.querySelector('button:not([disabled])'); if (first) first.focus();
  }

  // ── Auto-balance ──────────────────────────────────────────────────────────────────────
  // Round 1: one continuous snake through the position groups (C → PF → SF → SG → PG), so
  // the first team doesn't always pick first. Round 2: everyone left goes, best first, to
  // the team with the lowest OVR total.
  function autoBalance() {
    var tl = teams(); var nT = tl.length;
    var all = $$('.atb-p');
    var groups = { C: [], PF: [], SF: [], SG: [], PG: [], '': [] };
    all.forEach(function (li) { var p = li.getAttribute('data-pos'); (groups[p] || groups['']).push(li); });
    var byOvr = function (a, b) { return (n(b.getAttribute('data-ovr')) || 0) - (n(a.getAttribute('data-ovr')) || 0); };
    Object.keys(groups).forEach(function (k) { groups[k].sort(byOvr); });
    var out = tl.map(function () { return []; }), i = 0, dir = 1, over = [];
    ['C', 'PF', 'SF', 'SG', 'PG'].forEach(function (pos) {
      groups[pos].slice(0, nT).forEach(function (li) { out[i].push(li); i += dir; if (i >= nT) { dir = -1; i = nT - 1; } if (i < 0) { dir = 1; i = 0; } });
      over = over.concat(groups[pos].slice(nT));
    });
    var sum = function (k) { return out[k].reduce(function (a, li) { return a + (n(li.getAttribute('data-ovr')) || 0); }, 0); };
    over.concat(groups['']).sort(byOvr).forEach(function (li) {
      var best = 0; for (var k = 1; k < nT; k++) if (sum(k) < sum(best) || (sum(k) === sum(best) && out[k].length < out[best].length)) best = k;
      out[best].push(li);
    });
    tl.forEach(function (t, k) {
      var list = t.querySelector('.atb-list');
      out[k].forEach(function (li) { list.insertBefore(li, list.querySelector('.atb-drop')); li.hidden = false; ring(li, t.getAttribute('data-color')); });
    });
    refresh();
  }

  // ── Server actions ──────────────────────────────────────────────────────────────────
  function payload() {
    var out = [];
    teams().forEach(function (t) { playersIn(t).forEach(function (li) { out.push({ signup_id: li.getAttribute('data-id'), team_id: t.getAttribute('data-team-id') }); }); });
    playersIn(pool()).forEach(function (li) { out.push({ signup_id: li.getAttribute('data-id'), team_id: '' }); });
    return {
      season: cfg.season,
      teams: teams().map(function (t, i) { return { id: t.getAttribute('data-team-id'), name: t.getAttribute('data-name'), color: t.getAttribute('data-color'), sort_order: i }; }),
      assignments: out,
    };
  }
  function save(quiet) {
    var btn = root.querySelector('[data-atb-save]');
    if (btn) btn.disabled = true;
    return post('/admin/season/teams/save', payload()).then(function () {
      snapshot = readState();
      if (btn) btn.disabled = false;
      refresh();
      if (!quiet) ui().toast(cfg.sandbox ? 'Sandbox saved.' : 'Draft saved.');
      markDraftSaved();
    }).catch(function (e) { if (btn) btn.disabled = false; ui().toast(e.message, { tone: 'error' }); throw e; });
  }
  function markDraftSaved() {
    var st = root.querySelector('.atb-step');
    if (!st || cfg.sandbox) return;
    st.className = 'atb-step is-done';
    st.querySelector('.atb-step__mark').textContent = '✓';
    st.querySelector('.atb-step__text span').textContent = 'Teams saved as a draft';
    var pub = root.querySelector('[data-atb-step-pub]');
    if (pub && pub.classList.contains('is-next')) { pub.className = 'atb-step is-now'; pub.querySelector('.atb-step__mark').textContent = '•'; }
  }
  // For actions that re-render the page: offer to save unsaved moves first, so they're kept.
  function saveFirst(what) {
    var c = changes();
    if (!c) return Promise.resolve(true);
    return ui().confirm({
      title: 'Save your changes first?',
      body: (c === 1 ? 'You have 1 unsaved change' : 'You have ' + c + ' unsaved changes') + '. ' + what + ' saves the board first so nothing is lost' + (cfg.sandbox ? '.' : cfg.published ? '. ' + PUBLISHED_LINE : ' (as a draft).'),
      sendLabel: 'Save and continue',
    }).then(function (ok) { return ok ? save(true).then(function () { return true; }) : false; });
  }
  function rerender(msg) { snapshot = null; ui().refresh(msg); }

  // ── Team drawer (add / rename) ───────────────────────────────────────────────────────
  function openTeamDrawer(team) {
    var dr = document.getElementById('atb-team-drawer'); if (!dr) return;
    var form = dr.querySelector('form');
    form.reset();
    form.elements.team_id.value = team ? team.getAttribute('data-team-id') : '';
    dr.querySelector('.aui-drawer__title').textContent = team ? 'Rename or recolour' : 'Add a team';
    dr.querySelector('[data-atb-team-submit]').textContent = team ? 'Apply' : 'Add team';
    if (team) {
      form.elements.name.value = team.getAttribute('data-name');
      var col = team.getAttribute('data-color').toLowerCase();
      var radio = [].slice.call(form.querySelectorAll('input[name=color]')).find(function (r) { return r.value.toLowerCase() === col; });
      if (radio) radio.checked = true;
    }
    dr.hidden = false;
    setTimeout(function () { form.elements.name.focus(); form.elements.name.select(); }, 0);
  }

  // ── Delegated handlers (bound once) ──────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!root || !document.body.contains(root)) return;
    var t = e.target;
    if (menuEl && !menuEl.contains(t) && !(t.closest && t.closest('[data-atb-move]'))) closeMoveMenu();
    if (!t.closest) return;
    var b;
    if ((b = t.closest('[data-atb-move]'))) { openMoveMenu(b); return; }
    if ((b = t.closest('[data-atb-out]'))) { var li = b.closest('.atb-p'); moveTo(li, ''); var mv = li.querySelector('[data-atb-move]'); if (mv) mv.focus(); return; }
    if ((b = t.closest('[data-atb-pos]'))) {
      var p = b.getAttribute('data-atb-pos'); posOn[p] = !posOn[p];
      b.setAttribute('aria-pressed', String(!!posOn[p])); applyFilters(); return;
    }
    if ((b = t.closest('[data-atb-sort]'))) {
      var k = b.getAttribute('data-atb-sort');
      if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; }
      $$('[data-atb-sort]').forEach(function (x) {
        var on = x.getAttribute('data-atb-sort') === sortKey;
        x.classList.toggle('is-on', on);
        var label = x.getAttribute('data-atb-sort') === 'name' ? 'Player' : x.getAttribute('data-atb-sort').toUpperCase();
        x.innerHTML = '';
        x.appendChild(document.createTextNode(label));
        if (on) { var s = document.createElement('span'); s.setAttribute('aria-hidden', 'true'); s.textContent = sortDir > 0 ? ' ↑' : ' ↓'; x.appendChild(s); }
      });
      sortList(pool(), sortKey, sortDir); return;
    }
    if (t.closest('[data-atb-balance]')) {
      if (!teams().length) { ui().toast('Add at least one team first.', { tone: 'error' }); return; }
      ui().confirm({ title: 'Auto-balance the teams?', body: 'Reassigns every player by position and rating, starting from scratch. Nothing is saved until you press Save.', sendLabel: 'Auto-balance' })
        .then(function (ok) { if (ok) { autoBalance(); ui().toast('Balanced. Check it over, then save.'); } });
      return;
    }
    if ((b = t.closest('[data-atb-save]'))) { save(false).catch(function () {}); return; }
    if (t.closest('[data-atb-discard]')) {
      ui().confirm({ title: 'Discard your changes?', body: 'The board goes back to the last save.', sendLabel: 'Discard' })
        .then(function (ok) { if (ok) rerender('Changes discarded.'); });
      return;
    }
    if ((b = t.closest('[data-atb-review]'))) {
      b.disabled = true; b.textContent = 'Saving…';
      save(true).then(function () { location.href = '/admin/season/teams/review'; })
        .catch(function () { b.disabled = false; b.textContent = 'Review and start season →'; });
      return;
    }
    if ((b = t.closest('[data-atb-publish]'))) {
      var on = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(on));
      post('/admin/season/teams/publish', { season: cfg.season, published: on }).then(function () {
        var st = root.querySelector('[data-atb-step-pub]'), st2 = root.querySelector('[data-atb-step-start]');
        if (st) { st.className = 'atb-step is-' + (on ? 'done' : 'now'); st.querySelector('.atb-step__mark').textContent = on ? '✓' : '•'; }
        if (st2 && !cfg.locked) { st2.className = 'atb-step is-' + (on ? 'now' : 'next'); st2.querySelector('.atb-step__mark').textContent = on ? '•' : ''; }
        cfg.published = on; paintPublished();
        ui().toast(on ? 'Published: players can see their teams.' : 'Unpublished: players no longer see their teams.');
      }).catch(function (err) { b.setAttribute('aria-checked', String(!on)); ui().toast(err.message, { tone: 'error' }); });
      return;
    }
    if (t.closest('[data-atb-add]')) { openTeamDrawer(null); return; }
    if ((b = t.closest('[data-atb-edit]'))) { openTeamDrawer(b.closest('.atb-team')); return; }
    if ((b = t.closest('[data-atb-remove]'))) {
      var team = b.closest('.atb-team'), name = team.getAttribute('data-name'), cnt = playersIn(team).length;
      ui().confirm({ title: 'Remove ' + name + '?', body: (cnt ? 'Its ' + cnt + (cnt === 1 ? ' player goes' : ' players go') + ' back to “Not on a team”.' : 'It has no players.') + (changes() ? ' Your other unsaved changes are saved first.' : '') + (cfg.published ? ' ' + PUBLISHED_LINE : ''), sendLabel: 'Remove team' })
        .then(function (ok) {
          if (!ok) return;
          // Its players go to the pool first, so the save (if any) doesn't keep them on it.
          playersIn(team).forEach(function (li) { pool().appendChild(li); ring(li, ''); });
          var go = changes() ? save(true) : Promise.resolve();
          return go.then(function () { return post('/admin/season/teams/' + encodeURIComponent(team.getAttribute('data-team-id')) + '/delete', {}); })
            .then(function (d) { rerender(d.message || 'Team removed.'); });
        }).catch(function (err) { ui().toast(err.message, { tone: 'error' }); });
      return;
    }
    if ((b = t.closest('[data-atb-seed]'))) {
      b.disabled = true;
      post('/admin/season/teams/seed-from-league', { season: cfg.season }).then(function () { rerender('League teams added.'); })
        .catch(function (err) { b.disabled = false; ui().toast(err.message, { tone: 'error' }); });
      return;
    }
    if (t.closest('[data-atb-copy]')) {
      var tn = teams().length;
      if (!tn) { ui().toast('The sandbox has no teams to copy.', { tone: 'error' }); return; }
      ui().confirm({
        title: 'Copy to the real builder?',
        body: 'Replaces the Season ' + cfg.targetSeason + ' draft (its teams and who’s on them) with this sandbox split. Only confirmed Season ' + cfg.targetSeason + ' sign-ups carry over; everyone else lands in the pool. ' + (changes() ? 'Your unsaved sandbox changes are saved first. ' : '') + 'If the rosters are published, players will see the new teams.',
        typeToConfirm: tn, sendLabel: 'Copy ' + tn + ' teams',
      }).then(function (ok) {
        if (!ok) return;
        return (changes() ? save(true) : Promise.resolve()).then(function () { return post('/admin/season/teams/sandbox/copy', {}); })
          .then(function (d) { ui().toast(d.message || 'Copied.', { link: { label: 'Open the team builder', href: '/admin/season/teams' } }); });
      }).catch(function (err) { ui().toast(err.message, { tone: 'error' }); });
      return;
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('[data-atb-team-form]')) return;
    e.preventDefault();
    var name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); ui().toast('Give the team a name.', { tone: 'error' }); return; }
    var picked = form.querySelector('input[name=color]:checked');
    var color = picked ? picked.value : '#f59332';
    var id = form.elements.team_id.value;
    var dr = document.getElementById('atb-team-drawer');
    if (id) {
      var team = root.querySelector('.atb-team[data-team-id="' + CSS.escape(id) + '"]');
      if (team) {
        team.setAttribute('data-name', name); team.setAttribute('data-color', color);
        team.setAttribute('aria-label', name);
        team.querySelector('.atb-team__name').textContent = name;
        paintDot(team.querySelector('.atb-team__head .atb-dot'), color);
        var sum = team.querySelector('.aui-menu__btn'); if (sum) sum.setAttribute('aria-label', name + ' options');
        playersIn(team).forEach(function (li) { ring(li, color); });
      }
      dr.hidden = true;
      refresh();
      return;
    }
    saveFirst('Adding a team').then(function (ok) {
      if (!ok) return;
      return post('/admin/season/teams/create', { season: cfg.season, name: name, color: color })
        .then(function () { dr.hidden = true; rerender('Added ' + name + '.'); });
    }).catch(function (err) { ui().toast(err.message, { tone: 'error' }); });
  });

  document.addEventListener('input', function (e) {
    if (!e.target.matches || !e.target.matches('[data-atb-search]')) return;
    query = e.target.value.trim().toLowerCase(); applyFilters();
  });

  // Sandbox pool source: switching shows a different list of players, so the teams stay
  // but empty. Warn first when the board has anyone on a team.
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.matches || !(el.matches('[data-atb-source]') || el.matches('[data-atb-source-season]'))) return;
    var panel = el.closest('[data-atb-source-panel]');
    var src = (panel.querySelector('[data-atb-source]:checked') || {}).value || panel.getAttribute('data-source');
    var season;
    if (el.matches('[data-atb-source-season]')) season = el.value;
    else season = src === 'players' ? (panel.getAttribute('data-latest-game-season') || panel.getAttribute('data-season')) : (panel.getAttribute('data-target') || panel.getAttribute('data-season'));
    var url = '/admin/season/teams/sandbox?source=' + encodeURIComponent(src) + '&season=' + encodeURIComponent(season);
    var onTeams = teams().reduce(function (a, t) { return a + playersIn(t).length; }, 0);
    var go = function () { snapshot = null; ui().softLoad(url, { push: true }); };
    if (!onTeams) { go(); return; }
    ui().confirm({
      title: 'Switch the pool?',
      body: 'Your teams stay, but they’ll be empty: the ' + onTeams + (onTeams === 1 ? ' player on them isn’t' : ' players on them aren’t') + ' in the other list. ' + (changes() ? 'Your unsaved moves are lost. ' : '') + 'The saved split is only replaced if you save after switching.',
      sendLabel: 'Switch pool',
    }).then(function (ok) {
      if (ok) { go(); return; }
      // Put the controls back.
      var cur = panel.getAttribute('data-source');
      panel.querySelectorAll('[data-atb-source]').forEach(function (r) { r.checked = r.value === cur; });
      var sel = panel.querySelector('[data-atb-source-season]'); if (sel) sel.value = panel.getAttribute('data-season');
    });
  });

  // Mouse drag. (Phones and keyboards use Move… instead.)
  document.addEventListener('dragstart', function (e) {
    var li = e.target.closest && e.target.closest('.atb-p[draggable="true"]');
    if (!li) return;
    dragging = li; closeMoveMenu();
    li.classList.add('is-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', li.getAttribute('data-id')); } catch (err) { /* old browser */ } }
  });
  document.addEventListener('dragover', function (e) {
    if (!dragging) return;
    var zone = e.target.closest && e.target.closest('[data-atb-zone]');
    $$('.atb-list.is-over').forEach(function (z) { if (z !== zone) z.classList.remove('is-over'); });
    if (!zone) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    zone.classList.add('is-over');
  });
  document.addEventListener('drop', function (e) {
    if (!dragging) return;
    var zone = e.target.closest && e.target.closest('[data-atb-zone]');
    if (!zone) return;
    e.preventDefault();
    var li = dragging;
    moveTo(li, zone.getAttribute('data-atb-zone'));
  });
  document.addEventListener('dragend', function () {
    if (dragging) dragging.classList.remove('is-dragging');
    dragging = null;
    $$('.atb-list.is-over').forEach(function (z) { z.classList.remove('is-over'); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuEl) { var f = menuFor; closeMoveMenu(); if (f) f.focus(); return; }
    // The player itself (role="button") opens Move… from the keyboard.
    var mb = (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.atb-p__main[data-atb-move]');
    if (mb) { e.preventDefault(); openMoveMenu(e.target); }
  });
  window.addEventListener('resize', closeMoveMenu);
  window.addEventListener('beforeunload', function (e) {
    if (root && document.body.contains(root) && isDirty()) { e.preventDefault(); e.returnValue = ''; return ''; }
  });

  function init() {
    closeMoveMenu();
    root = document.getElementById('atb');
    if (!root) { cfg = null; return; }
    try { cfg = JSON.parse(root.getAttribute('data-config') || '{}'); } catch (err) { cfg = {}; }
    sortKey = 'ovr'; sortDir = -1; posOn = {}; query = '';
    snapshot = readState();
    refresh();
  }
  init();
  document.addEventListener('admin:updated', init);
})();
