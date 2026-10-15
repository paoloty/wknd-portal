// Admin UI kit, browser side (admin redesign step 1, 2026-10-15). Loaded on every admin
// page by views/admin/layout.js. Replaces the browser's alert()/confirm() over time.
//
//   window.adminUi.toast(text, { tone: 'ok'|'error', action: { label, run }, link: { label, href } })
//   window.adminUi.confirm({ title, body, typeToConfirm, sendLabel }) → Promise<boolean>
//
// Markup hooks:
//   <form data-confirm data-confirm-title="…" data-confirm-body="…" data-confirm-type="47">
//     A submit opens the dialog first. data-confirm-type means "type this number to enable
//     Send" (used for big email sends).
//   <button data-post-json="/url" data-confirm …> POSTs JSON after the confirm, then goes to
//     data-then (default: reload) with ?toast=<message from the response or data-done>.
//   <button data-snooze="item-key"> hides the closest [data-item] till tomorrow, with Undo.
//   <div data-filter-group> <button data-filter="cat"> shows only [data-item][data-cat=cat].
//   ?toast=… on any admin URL shows that message once (then drops it from the address).
(function () {
  'use strict';

  var stack = null;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function toast(text, opts) {
    opts = opts || {};
    if (!stack) { stack = el('div', 'aui-toasts'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    var t = el('div', 'aui-toast' + (opts.tone === 'error' ? ' aui-toast--error' : ''));
    t.setAttribute('role', opts.tone === 'error' ? 'alert' : 'status');
    t.appendChild(el('span', 'aui-toast__mark', opts.tone === 'error' ? '!' : '✓'));
    t.appendChild(el('span', 'aui-toast__text', text));
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    if (opts.action) {
      var b = el('button', 'aui-link', opts.action.label);
      b.type = 'button';
      b.addEventListener('click', function () { close(); opts.action.run(); });
      t.appendChild(b);
    }
    if (opts.link) {
      var a = el('a', 'aui-link', opts.link.label);
      a.href = opts.link.href;
      t.appendChild(a);
    }
    var x = el('button', 'aui-toast__close', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', close);
    t.appendChild(x);
    stack.appendChild(t);
    setTimeout(close, opts.timeout || (opts.action ? 9000 : 6000));
    return close;
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var back = el('div', 'aui-dialog-backdrop');
      var box = el('div', 'aui-dialog');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      var h = el('h2', 'aui-dialog__title', o.title || 'Are you sure?');
      h.id = 'aui-dialog-title';
      box.setAttribute('aria-labelledby', h.id);
      box.appendChild(h);
      if (o.body) box.appendChild(el('p', 'aui-dialog__body', o.body));
      var input = null;
      var need = o.typeToConfirm ? String(o.typeToConfirm) : '';
      if (need) {
        var lab = el('label', 'aui-dialog__field', 'Type ' + need + ' to confirm');
        input = el('input');
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        lab.appendChild(input);
        box.appendChild(lab);
      }
      var row = el('div', 'aui-dialog__actions');
      var cancel = el('button', 'aui-btn aui-btn--ghost', 'Cancel');
      cancel.type = 'button';
      var send = el('button', 'aui-btn aui-btn--primary', o.sendLabel || 'Send');
      send.type = 'button';
      row.appendChild(cancel);
      row.appendChild(send);
      box.appendChild(row);
      back.appendChild(box);
      document.body.appendChild(back);
      var prevFocus = document.activeElement;

      function sync() { send.disabled = !!need && input.value.trim() !== need; }
      function done(ok) {
        document.removeEventListener('keydown', onKey, true);
        back.parentNode && back.parentNode.removeChild(back);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(ok);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Enter' && !send.disabled && (e.target === input || e.target === send)) { e.preventDefault(); done(true); }
      }
      if (input) input.addEventListener('input', sync);
      sync();
      cancel.addEventListener('click', function () { done(false); });
      send.addEventListener('click', function () { if (!send.disabled) done(true); });
      back.addEventListener('click', function (e) { if (e.target === back) done(false); });
      document.addEventListener('keydown', onKey, true);
      (input || send).focus();
    });
  }

  function askFor(node) {
    return node.hasAttribute('data-confirm')
      ? confirmDialog({
          title: node.getAttribute('data-confirm-title'),
          body: node.getAttribute('data-confirm-body'),
          typeToConfirm: node.getAttribute('data-confirm-type'),
          sendLabel: node.getAttribute('data-confirm-send'),
        })
      : Promise.resolve(true);
  }

  function withToast(url, msg) {
    var u = new URL(url || location.href, location.origin);
    u.searchParams.set('toast', msg);
    return u.pathname + u.search + u.hash;
  }

  // Forms that post JSON (drawers on grid pages): <form data-json-action="/url" data-done="…">.
  // Repeated names become arrays; a name ending in [] is always an array (even with one or
  // no values). data-confirm on the form asks first. On success: go to data-then (default:
  // this page) with a toast; on error: error toast.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('form[data-json-action]')) return;
    e.preventDefault();
    askFor(form).then(function (ok) { if (ok) sendJsonForm(form); });
  });
  function sendJsonForm(form) {
    var data = {};
    form.querySelectorAll('[name$="[]"]').forEach(function (el) { data[el.name.slice(0, -2)] = []; });
    new FormData(form).forEach(function (v, k) {
      if (k.slice(-2) === '[]') { data[k.slice(0, -2)].push(v); return; }
      if (k in data) data[k] = [].concat(data[k], v); else data[k] = v;
    });
    var submits = document.querySelectorAll('[type=submit][form="' + form.id + '"], form[data-json-action] [type=submit]');
    submits.forEach(function (b) { b.disabled = true; });
    fetch(form.getAttribute('data-json-action'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || res.d.error) throw new Error(res.d.error || 'Couldn’t save that.');
        // data-then may hold {id}: replaced by the id the server returns (e.g. a new record).
        var then = (form.getAttribute('data-then') || '').replace('{id}', encodeURIComponent(res.d.id || ''));
        after(then, res.d.message || form.getAttribute('data-done') || 'Saved.');
      })
      .catch(function (err) {
        submits.forEach(function (b) { b.disabled = false; });
        toast(err.message, { tone: 'error' });
      });
  }

  // Forms that need a confirm first.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('form[data-confirm]') || form.matches('[data-json-action]') || form.__auiOk) return;
    e.preventDefault();
    askFor(form).then(function (ok) {
      if (ok) ajaxSubmit(form); // in the background; lands wherever the server redirects
    });
  }, true);

  document.addEventListener('click', function (e) {
    // JSON actions (e.g. Papawis announce).
    var jb = e.target.closest && e.target.closest('[data-post-json]');
    if (jb) {
      e.preventDefault();
      if (jb.disabled) return;
      askFor(jb).then(function (ok) {
        if (!ok) return;
        var label = jb.textContent;
        jb.disabled = true;
        jb.textContent = 'Sending…';
        // data-body: the JSON to send (default {}); data-method: e.g. DELETE (default POST).
        fetch(jb.getAttribute('data-post-json'), { method: jb.getAttribute('data-method') || 'POST', headers: { 'Content-Type': 'application/json' }, body: jb.getAttribute('data-body') || '{}' })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
          .then(function (res) {
            if (!res.ok || res.d.error) throw new Error(res.d.error || 'Something went wrong.');
            var msg = res.d.message || jb.getAttribute('data-done') || 'Done.';
            after(jb.getAttribute('data-then'), msg);
          })
          .catch(function (err) {
            jb.disabled = false;
            jb.textContent = label;
            toast(err.message, { tone: 'error' });
          });
      });
      return;
    }

    // Snooze a Home item till tomorrow.
    var sb = e.target.closest && e.target.closest('[data-snooze]');
    if (sb) {
      e.preventDefault();
      var key = sb.getAttribute('data-snooze');
      var item = sb.closest('[data-item]');
      var post = function (url) {
        return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key }) })
          .then(function (r) { if (!r.ok) throw new Error('Could not save that.'); });
      };
      post('/admin/home/snooze').then(function () {
        if (item) { item.setAttribute('data-snoozed', '1'); refreshFilters(); }
        toast('Snoozed till tomorrow', {
          action: { label: 'Undo', run: function () {
            post('/admin/home/unsnooze').then(function () {
              if (item) { item.removeAttribute('data-snoozed'); refreshFilters(); }
            }).catch(function (err) { toast(err.message, { tone: 'error' }); });
          } },
        });
      }).catch(function (err) { toast(err.message, { tone: 'error' }); });
      return;
    }

    // Filter tabs.
    var fb = e.target.closest && e.target.closest('[data-filter]');
    if (fb) {
      var group = fb.closest('[data-filter-group]');
      if (!group) return;
      group.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-selected', String(b === fb)); });
      refreshFilters();
    }
  });

  // Show/hide items for the selected filter, skip snoozed ones, update the counts and the
  // empty state.
  function refreshFilters() {
    document.querySelectorAll('[data-filter-group]').forEach(function (group) {
      var scope = document.getElementById(group.getAttribute('data-filter-group')) || document;
      var sel = group.querySelector('[data-filter][aria-selected="true"]');
      var cat = sel ? sel.getAttribute('data-filter') : 'all';
      var items = scope.querySelectorAll('[data-item]');
      var counts = { all: 0 };
      var shown = 0;
      items.forEach(function (it) {
        var c = it.getAttribute('data-cat');
        var live = !it.hasAttribute('data-snoozed');
        var open = live && !it.classList.contains('is-done');
        if (open) { counts.all++; counts[c] = (counts[c] || 0) + 1; }
        var show = live && (cat === 'all' || c === cat);
        it.hidden = !show;
        if (show) shown++;
      });
      group.querySelectorAll('[data-filter]').forEach(function (b) {
        var n = b.querySelector('[data-count]');
        if (n) n.textContent = counts[b.getAttribute('data-filter')] || 0;
      });
      document.querySelectorAll('[data-count-total]').forEach(function (n) { n.textContent = counts.all; });
      var empty = scope.querySelector('[data-empty]');
      if (empty) empty.hidden = shown > 0;
    });
  }

  // ── Data grid ─────────────────────────────────────────────────────────────────────
  // Search submits after a pause; selects submit on change. The server does the rest.
  var searchTimer = null;
  document.addEventListener('input', function (e) {
    var s = e.target.closest && e.target.closest('[data-autosubmit-search]');
    if (!s) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { s.form.requestSubmit ? s.form.requestSubmit() : s.form.submit(); }, 450);
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-autosubmit]')) { t.form.requestSubmit ? t.form.requestSubmit() : t.form.submit(); return; }
    var grid = t.closest && t.closest('[data-grid]');
    if (grid && (t.matches('[data-bulk-row]') || t.matches('[data-bulk-all]'))) {
      if (t.matches('[data-bulk-all]')) grid.querySelectorAll('[data-bulk-row]').forEach(function (c) { c.checked = t.checked; });
      syncBulk(grid);
    }
  });
  function syncBulk(grid) {
    var rows = grid.querySelectorAll('[data-bulk-row]');
    var picked = [].filter.call(rows, function (c) { return c.checked; });
    rows.forEach(function (c) { var tr = c.closest('tr'); if (tr) tr.classList.toggle('is-selected', c.checked); });
    var all = grid.querySelector('[data-bulk-all]');
    if (all) { all.checked = picked.length > 0 && picked.length === rows.length; all.indeterminate = picked.length > 0 && picked.length < rows.length; }
    var bar = grid.querySelector('[data-grid-bulk]');
    var tools = grid.querySelector('[data-grid-toolbar]');
    if (bar) { bar.hidden = picked.length === 0; bar.querySelector('[data-bulk-count]').textContent = picked.length; }
    if (tools && bar) tools.hidden = picked.length > 0;
    return picked.map(function (c) { return c.value; });
  }

  // Run one POST per ticked row (sequentially, so mail sends are paced), then reload.
  function bulkEach(btn) {
    var grid = btn.closest('[data-grid]');
    var ids = syncBulk(grid);
    if (!ids.length) return;
    // {n} is the count, {s} an "s" unless the count is 1 ("Sent {n} email{s}.").
    var plural = function (s, n) { return s.replace('{n}', n).replace('{s}', n === 1 ? '' : 's'); };
    var title = plural(btn.getAttribute('data-bulk-title') || '', ids.length);
    var body = plural(btn.getAttribute('data-bulk-body') || '', ids.length);
    var ask = title ? confirmDialog({ title: title, body: body, sendLabel: btn.textContent }) : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      var tpl = btn.getAttribute('data-bulk-each');
      var done = 0, failed = 0, i = 0;
      btn.disabled = true;
      (function next() {
        if (i >= ids.length) {
          var msg = plural(btn.getAttribute('data-done') || 'Done.', done) + (failed ? ' ' + failed + ' failed.' : '');
          refreshWith(msg);
          return;
        }
        btn.textContent = 'Working… ' + (i + 1) + '/' + ids.length;
        var url = tpl.replace('{id}', encodeURIComponent(ids[i++]));
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function (r) { if (r.ok) done++; else failed++; })
          .catch(function () { failed++; })
          .then(function () { setTimeout(next, 600); });
      })();
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var be = t.closest && t.closest('[data-bulk-each]');
    if (be) { e.preventDefault(); bulkEach(be); return; }
    var bc = t.closest && t.closest('[data-bulk-clear]');
    if (bc) {
      var g = bc.closest('[data-grid]');
      g.querySelectorAll('[data-bulk-row],[data-bulk-all]').forEach(function (c) { c.checked = false; });
      syncBulk(g);
      return;
    }
    var ex = t.closest && t.closest('[data-grid-expand]');
    if (ex) {
      var tr = ex.closest('tr');
      var more = tr && tr.nextElementSibling;
      if (more && more.classList.contains('aui-grid__more')) {
        more.hidden = !more.hidden;
        ex.setAttribute('aria-expanded', String(!more.hidden));
      }
      return;
    }
    // Close open ⋯ menus when clicking elsewhere, or after choosing an item.
    document.querySelectorAll('details.aui-menu[open]').forEach(function (d) {
      if (!d.contains(t) || (t.closest && t.closest('.aui-menu__item'))) d.removeAttribute('open');
    });
    // Drawers
    var dopen = t.closest && t.closest('[data-drawer-open]');
    if (dopen) {
      var dr = document.getElementById(dopen.getAttribute('data-drawer-open'));
      if (dr) { dr.hidden = false; var f = dr.querySelector('input,select,textarea,button:not([data-drawer-close])'); if (f) f.focus(); }
      return;
    }
    var dclose = t.closest && t.closest('[data-drawer-close]');
    if (dclose) { var d2 = dclose.closest('[data-drawer]'); if (d2) d2.hidden = true; return; }
    // Switches
    var sw = t.closest && t.closest('[data-switch]');
    if (sw) {
      // data-confirm on a switch asks first; data-confirm-when="on"|"off" only in that direction.
      var want = sw.getAttribute('aria-checked') !== 'true';
      var when = sw.getAttribute('data-confirm-when');
      if (sw.hasAttribute('data-confirm') && (!when || when === (want ? 'on' : 'off'))) {
        askFor(sw).then(function (ok) { if (ok) flipSwitch(sw); });
      } else flipSwitch(sw);
    }
  });
  function flipSwitch(sw) {
      var on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      var post = sw.getAttribute('data-switch-post');
      if (post) {
        // data-switch-setting: a site setting, posted as { <key>: '1' | '0' } (/admin/site/settings).
        var payload = {};
        if (sw.hasAttribute('data-switch-setting')) payload[sw.getAttribute('data-switch')] = on ? '1' : '0';
        else payload = { key: sw.getAttribute('data-switch'), on: on };
        fetch(post, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) {
            if (!r.ok) throw new Error();
            var msg = (on ? 'Turned on: ' : 'Turned off: ') + sw.getAttribute('aria-label');
            if (sw.hasAttribute('data-switch-reload')) refreshWith(msg); else toast(msg);
          })
          .catch(function () { sw.setAttribute('aria-checked', String(!on)); toast('Couldn’t save that switch.', { tone: 'error' }); });
      } else {
        var hid = sw.parentNode.querySelector('input[type=hidden][name="' + sw.getAttribute('data-switch') + '"]');
        if (hid) { hid.value = on ? '1' : '0'; hid.dispatchEvent(new Event('input', { bubbles: true })); }
      }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('[data-drawer]:not([hidden])').forEach(function (d) { d.hidden = true; });
    document.querySelectorAll('details.aui-menu[open]').forEach(function (d) { d.removeAttribute('open'); });
  });

  // Set up the parts of a page that need per-element wiring. Runs on load and again after
  // the content area is swapped in place (see "In-place updates" below); each element is
  // only wired once.
  function initDynamic(root) {
    // A tab bar wider than a phone scrolls; keep the active tab in view.
    root.querySelectorAll('.aui-tabs, .aui-views').forEach(function (bar) {
      var on = bar.querySelector('.is-active');
      if (on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    });
    root = root || document;
    initSavebars(root);
    initPickers(root);
    refreshFilters();
  }

  // ── Save bar: shows once a watched form changes ───────────────────────────────────
  function initSavebars(root) {
  root.querySelectorAll('form[data-dirty-watch]').forEach(function (form) {
    if (form.__auiInit) return; form.__auiInit = true;
    var bar = document.querySelector('[data-savebar]');
    if (!bar) return;
    var show = function () { bar.hidden = false; };
    form.addEventListener('input', show);
    form.addEventListener('change', show);
    form.addEventListener('reset', function () { setTimeout(function () { bar.hidden = true; }, 0); });
  });
  }

  // ── Player picker ──────────────────────────────────────────────────────────────────
  function initPickers(root) {
  root.querySelectorAll('[data-picker]').forEach(function (pk) {
    if (pk.__auiInit) return; pk.__auiInit = true;
    var opts = [];
    try { opts = JSON.parse(pk.getAttribute('data-options') || '[]'); } catch (e) {}
    var sel = [];
    try { sel = JSON.parse(pk.getAttribute('data-selected') || '[]'); } catch (e) {}
    var multiple = pk.getAttribute('data-multiple') !== 'false';
    var name = pk.getAttribute('data-name');
    var input = pk.querySelector('[data-picker-input]');
    var list = pk.querySelector('[data-picker-list]');
    var chips = pk.querySelector('[data-picker-chips]');
    var values = pk.querySelector('[data-picker-values]');
    var active = 0;
    var byId = {};
    opts.forEach(function (o) { byId[o.id] = o; });
    function ring(o, size) {
      var a = el('span', 'aui-avatar');
      a.style.width = a.style.height = size + 'px';
      a.style.boxShadow = '0 0 0 2px ' + (/^#[0-9a-f]{3,8}$/i.test(o.color) ? o.color : 'rgba(255,255,255,.18)');
      a.style.fontSize = Math.max(9, Math.round(size * 0.36)) + 'px';
      a.appendChild(el('span', 'aui-avatar__text', o.name.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase()));
      if (o.photo) {
        var im = el('img', 'aui-avatar__img');
        im.alt = ''; im.loading = 'lazy'; im.src = o.photo;
        im.onerror = function () { im.remove(); };
        a.appendChild(im);
      }
      a.setAttribute('aria-hidden', 'true');
      return a;
    }
    function render() {
      chips.innerHTML = ''; values.innerHTML = '';
      sel.forEach(function (id) {
        var o = byId[id]; if (!o) return;
        var c = el('span', 'aui-picker__chip');
        c.appendChild(ring(o, 18)); c.appendChild(document.createTextNode(o.name));
        var x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + o.name);
        x.addEventListener('click', function () { sel = sel.filter(function (s) { return s !== id; }); render(); input.dispatchEvent(new Event('change', { bubbles: true })); });
        c.appendChild(x); chips.appendChild(c);
        var h = el('input'); h.type = 'hidden'; h.name = name; h.value = id; values.appendChild(h);
      });
    }
    function matches() {
      var q = input.value.trim().toLowerCase();
      return opts.filter(function (o) { return sel.indexOf(o.id) < 0 && (!q || o.name.toLowerCase().indexOf(q) >= 0); }).slice(0, 8);
    }
    function show() {
      var m = matches();
      list.innerHTML = '';
      if (!m.length) list.appendChild(el('div', 'aui-picker__none', input.value ? 'No player called “' + input.value + '”.' : 'Everyone is already picked.'));
      m.forEach(function (o, i) {
        var b = el('button', 'aui-picker__opt' + (i === active ? ' is-active' : ''));
        b.type = 'button'; b.setAttribute('role', 'option');
        b.appendChild(ring(o, 24)); b.appendChild(document.createTextNode(o.name));
        if (o.meta) b.appendChild(el('small', '', o.meta));
        b.addEventListener('mousedown', function (ev) { ev.preventDefault(); pick(o.id); });
        list.appendChild(b);
      });
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    function hide() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    function pick(id) {
      sel = multiple ? sel.concat([id]) : [id];
      input.value = ''; active = 0; render();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (multiple) show(); else hide();
    }
    input.addEventListener('focus', show);
    input.addEventListener('input', function () { active = 0; show(); });
    input.addEventListener('blur', function () { setTimeout(hide, 120); });
    input.addEventListener('keydown', function (e) {
      var m = matches();
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, m.length - 1); show(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); show(); }
      else if (e.key === 'Enter') { if (m[active]) { e.preventDefault(); pick(m[active].id); } }
      else if (e.key === 'Backspace' && !input.value && sel.length) { sel.pop(); render(); }
    });
    render();
  });
  }

  // ── In-place updates ────────────────────────────────────────────────────────────────
  // After an action succeeds, and when moving around a grid or between tabs, the page
  // fetches its own fresh HTML and swaps just the content area (#admin-main), instead of a
  // full reload: the sidebar, scroll position and focus stay put. Pages show the result of
  // the action exactly as a reload would, since the server renders them the same way.
  // Anything that goes to a different page still navigates normally.
  var samePage = function (url) { return new URL(url, location.origin).pathname === location.pathname; };

  // Show and drop a ?toast= message carried in a URL; returns the URL without it.
  function takeToast(url) {
    var u = new URL(url, location.origin);
    var msg = u.searchParams.get('toast');
    if (msg) toast(msg.slice(0, 300), u.searchParams.get('toastTone') === 'error' ? { tone: 'error' } : {});
    u.searchParams.delete('toast');
    u.searchParams.delete('toastTone');
    return u.pathname + u.search + u.hash;
  }

  function swapIn(html, url, opts) {
    opts = opts || {};
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var fresh = doc.getElementById('admin-main');
    var main = document.getElementById('admin-main');
    if (!fresh || !main) { location.href = url; return; }
    // Remember the focused field (e.g. the grid search box) so typing isn't interrupted.
    var active = document.activeElement;
    var focusName = active && main.contains(active) && active.name ? active.name : '';
    var caret = focusName && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    var y = window.scrollY;
    main.innerHTML = fresh.innerHTML;
    document.title = doc.title;
    // Sidebar counts (things waiting) may have changed.
    var oldRows = document.querySelectorAll('.admin-nav__row'), newRows = doc.querySelectorAll('.admin-nav__row');
    oldRows.forEach(function (row, i) {
      var nb = newRows[i] && newRows[i].querySelector('.admin-nav__badge');
      var ob = row.querySelector('.admin-nav__badge');
      if (nb && ob) ob.textContent = nb.textContent;
      else if (ob && !nb) ob.remove();
      else if (nb && !ob) { var end = row.querySelector('.admin-nav__end') || row; end.insertBefore(nb.cloneNode(true), end.firstChild); }
    });
    var clean = takeToast(url);
    if (opts.push) history.pushState(null, '', clean); else history.replaceState(null, '', clean);
    window.scrollTo(0, opts.top ? 0 : y);
    if (focusName) {
      var again = main.querySelector('[name="' + focusName + '"]');
      if (again) { again.focus(); if (caret !== null && again.setSelectionRange) try { again.setSelectionRange(caret, caret); } catch (e) {} }
    }
    initDynamic(main);
    document.dispatchEvent(new CustomEvent('admin:updated'));
  }

  // Fetch a page and swap it in (or navigate if it turns out to be a different page).
  function softLoad(url, opts) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok || !samePage(r.url)) { location.href = r.url || url; return; }
        return r.text().then(function (html) { swapIn(html, r.url, opts); });
      })
      .catch(function () { location.href = url; });
  }
  // A visible save bar means a watched form has unsaved edits.
  function hasUnsaved() { return !!document.querySelector('[data-savebar]:not([hidden])'); }
  window.addEventListener('beforeunload', function (e) { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });
  // Re-render the current page in place with a toast.
  function refreshWith(msg) {
    return softLoad(withToast(location.href, msg));
  }
  // After an action: stay here (in place) or go to `then` if it's another page.
  function after(then, msg) {
    if (!then || samePage(then)) refreshWith(msg);
    else location.href = withToast(then, msg);
  }

  // Submit an ordinary <form> in the background; the server's redirect decides where we land.
  function ajaxSubmit(form) {
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    var action = form.getAttribute('action') || location.pathname;
    var data = new URLSearchParams(new FormData(form));
    if (method === 'GET') [].slice.call(data.keys()).forEach(function (k) { if (!data.get(k)) data.delete(k); }); // keep the address tidy
    var url = method === 'GET' ? action + (action.indexOf('?') < 0 ? '?' : '&') + data.toString() : action;
    var btn = form.querySelector('[type=submit]');
    var label = btn && btn.textContent;
    if (btn && method !== 'GET') { btn.disabled = true; btn.textContent = 'Sending…'; }
    return fetch(url, method === 'GET' ? { credentials: 'same-origin' } : { method: method, credentials: 'same-origin', body: data })
      .then(function (r) {
        if (!r.ok || !samePage(r.url)) { location.href = r.url; return; }
        return r.text().then(function (html) { swapIn(html, r.url, { push: method === 'GET' }); });
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = label; } toast('Couldn’t reach the server.', { tone: 'error' }); });
  }

  // Grid toolbars (search and filters) load in place.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('[data-grid] form[role="search"]')) return;
    e.preventDefault();
    ajaxSubmit(form);
  });
  // Links within a grid (views, sorting, pages, density) and page tabs load in place.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    if (!a.closest('.aui-views, .aui-tabs, .aui-grid__sort, .aui-pager, .aui-density, .aui-chips, .aui-menu')) return;
    if (!samePage(a.href)) return;
    e.preventDefault();
    var go = function () { softLoad(a.href, { push: true, top: !!a.closest('.aui-tabs, .aui-menu') }); };
    if (!hasUnsaved()) { go(); return; }
    confirmDialog({ title: 'Discard your unsaved changes?', body: 'You haven’t saved them yet.', sendLabel: 'Discard' }).then(function (ok) { if (ok) go(); });
  });
  window.addEventListener('popstate', function () { softLoad(location.href); });

  // One-time message carried in the URL of a full page load.
  try {
    var cleanNow = takeToast(location.href);
    if (cleanNow !== location.pathname + location.search + location.hash) history.replaceState(null, '', cleanNow);
  } catch (e) { /* old browser: no toast */ }

  initDynamic(document);
  window.adminUi = { hasUnsaved: hasUnsaved, toast: toast, confirm: confirmDialog, refresh: refreshWith, softLoad: softLoad };
})();
