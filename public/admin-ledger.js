// Admin Ledger pages (views/admin/ledger.js, 2026-10-15). Generic actions (Confirm/Void/
// Delete buttons, JSON forms, toasts, in-place refresh) come from public/admin-ui.js; this
// file only adds what's specific to the ledger:
//   • opening a player in the drawer (?player=<id>, loaded in place) and closing it
//   • the season switch, loaded in place
//   • the "Charge or record payment" drawer: who it's for (ticked rows, one player, or the
//     picker), Charge/Payment wording, Papawis Deposit → pending
//   • Copy summary
(function () {
  'use strict';
  var ui = function () { return window.adminUi; };
  var page = function () { return document.querySelector('[data-alg-page]'); };

  function load(url, push) {
    if (ui() && ui().softLoad) ui().softLoad(url, { push: !!push });
    else location.href = url;
  }

  // ── Player drawer ────────────────────────────────────────────────────────────────────
  function dropPlayerParam() {
    var u = new URL(location.href);
    if (!u.searchParams.has('player')) return;
    u.searchParams.delete('player');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  // ── Charge / payment drawer ──────────────────────────────────────────────────────────
  function chargeForm(dr) { return dr && dr.querySelector('form[data-alg-txform]'); }
  function chosenCount(form) {
    var picked = form.querySelector('[data-alg-picked-fs]');
    if (picked && !picked.disabled) return picked.querySelectorAll('input[name="player_ids[]"]').length;
    var pickerFs = form.querySelector('[data-alg-picker-fs]');
    if (pickerFs) return pickerFs.querySelectorAll('[data-picker-values] input').length;
    return 1; // the player page: always one player
  }
  function sync(dr) {
    var form = chargeForm(dr);
    if (!form) return;
    var typeEl = form.querySelector('input[name="type"]:checked');
    var type = typeEl ? typeEl.value : 'charge';
    var n = chosenCount(form);
    var cat = form.querySelector('[data-alg-category]');
    var deposit = cat && cat.value === 'Papawis Deposit';
    var title = dr.querySelector('.aui-drawer__title');
    if (title) title.textContent = type === 'charge' ? 'Add a charge' : 'Record a payment';
    var go = dr.querySelector('[data-alg-go]');
    if (go) {
      var many = n > 1;
      go.textContent = form.querySelector('[data-alg-picker-fs], [data-alg-picked-fs]')
        ? (type === 'charge' ? 'Charge ' + Math.max(n, 1) + ' player' + (many ? 's' : '') : 'Record ' + Math.max(n, 1) + ' payment' + (many ? 's' : ''))
        : (type === 'charge' ? 'Add charge' : 'Record payment');
    }
    var note = form.querySelector('[data-alg-note]');
    if (note) note.textContent = deposit
      ? 'A Papawis deposit is always saved as pending. Confirming it later is what gives the player their spot.'
      : (type === 'charge'
        ? 'Confirmed charges notify the player and show on their balance right away.'
        : 'Confirmed payments notify the player. Pending ones wait in To confirm.');
  }

  // mode: 'picker' (choose players) or a list of [{ id, name }] already chosen.
  function openCharge(id, chosen) {
    var dr = document.getElementById(id);
    if (!dr) return;
    var form = chargeForm(dr);
    var pickedFs = form.querySelector('[data-alg-picked-fs]');
    var pickerFs = form.querySelector('[data-alg-picker-fs]');
    if (pickedFs && pickerFs) {
      var list = pickedFs.querySelector('[data-alg-picked]');
      list.innerHTML = '';
      var usePicked = !!(chosen && chosen.length);
      (chosen || []).forEach(function (p) {
        var chip = document.createElement('span');
        chip.className = 'alg-picked__chip';
        chip.textContent = p.name;
        var h = document.createElement('input');
        h.type = 'hidden'; h.name = 'player_ids[]'; h.value = p.id;
        chip.appendChild(h);
        list.appendChild(chip);
      });
      // A disabled fieldset leaves its fields out of the post.
      pickedFs.disabled = !usePicked; pickedFs.hidden = !usePicked;
      pickerFs.disabled = usePicked; pickerFs.hidden = usePicked;
    }
    sync(dr);
    dr.hidden = false;
    var first = form.querySelector('[data-alg-amount]');
    if (first) first.focus();
  }

  function selectedRows() {
    var grid = document.getElementById('alg-balances');
    if (!grid) return [];
    return [].map.call(grid.querySelectorAll('[data-bulk-row]:checked'), function (c) {
      var tr = c.closest('tr');
      var t = tr && tr.querySelector('.aui-cell__title');
      return { id: c.value, name: t ? t.textContent : c.value };
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error()); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  // Capture phase: runs before public/admin-ui.js so the grid's bulk button opens our drawer
  // instead of posting once per row.
  document.addEventListener('click', function (e) {
    if (!page()) return;
    var t = e.target;
    var bulk = t.closest && t.closest('[data-bulk-each="#alg-charge"]');
    if (bulk) {
      e.preventDefault(); e.stopImmediatePropagation();
      var rows = selectedRows();
      if (rows.length) openCharge('alg-charge', rows);
    }
  }, true);

  document.addEventListener('click', function (e) {
    if (!page() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    if (!t.closest) return;

    // Season switch: in place.
    var s = t.closest('.alg-seasons a');
    if (s) { e.preventDefault(); load(s.href, true); return; }

    // Header "+ Charge or payment": choose players in the drawer.
    if (t.closest('[data-alg-charge]')) { e.preventDefault(); openCharge('alg-charge', null); return; }
    // Player drawer "+ Add transaction": that one player.
    var add = t.closest('[data-alg-add]');
    if (add) { e.preventDefault(); openCharge('alg-charge', [{ id: add.getAttribute('data-alg-add'), name: add.getAttribute('data-alg-add-name') }]); return; }
    // Player page "+ Add transaction".
    if (t.closest('[data-alg-add-one]')) { e.preventDefault(); openCharge('alg-add', null); return; }

    // Copy summary.
    var cp = t.closest('[data-alg-copy]');
    if (cp) {
      e.preventDefault();
      copyText(cp.getAttribute('data-alg-copy')).then(function () { ui().toast('Summary copied.'); })
        .catch(function () { ui().toast('Couldn’t copy. Your browser blocked the clipboard.', { tone: 'error' }); });
      return;
    }

    // Closing the player drawer drops ?player= so a later refresh doesn't reopen it.
    if (t.closest('#alg-player [data-drawer-close]')) { dropPlayerParam(); return; }

    // A balances row opens that player in the drawer, in place.
    var grid = t.closest('#alg-balances');
    if (grid) {
      if (t.closest('input, button, select, label, details, .aui-grid__check')) return;
      var a = t.closest('a');
      if (a && !a.classList.contains('aui-grid__link')) return;
      var row = t.closest('.aui-grid__row');
      var link = row && row.querySelector('.aui-grid__link');
      if (link) { e.preventDefault(); load(link.href, true); }
    }
    // The player names in To confirm open the drawer the same way.
    var qn = t.closest('.alg-q__name');
    if (qn) { e.preventDefault(); load(qn.href, true); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && page() && document.getElementById('alg-player')) dropPlayerParam();
  });

  document.addEventListener('change', function (e) {
    var dr = e.target.closest && e.target.closest('[data-drawer]');
    if (!dr || !chargeForm(dr)) return;
    var form = chargeForm(dr);
    if (e.target.matches('[data-alg-category]') && e.target.value === 'Papawis Deposit') {
      var st = form.querySelector('[data-alg-status]');
      if (st) st.value = 'pending';
    }
    sync(dr);
  });

  // Nobody chosen: say so here rather than round-tripping to the server.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('form[data-alg-txform]')) return;
    if (chosenCount(form) < 1) {
      e.preventDefault(); e.stopImmediatePropagation();
      ui().toast('Pick at least one player.', { tone: 'error' });
    }
  }, true);

  // Wiring that has to run per render: on load and after every in-place update.
  function init() {
    ['alg-charge', 'alg-add'].forEach(function (id) { var dr = document.getElementById(id); if (dr) sync(dr); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('admin:updated', init);
})();
