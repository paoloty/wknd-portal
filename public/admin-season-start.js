// Review and start (views/admin/season-review.js): each row saves itself as it changes, and the total
// and the Start season dialog follow. Listens on the document once, so an in-place swap needs nothing.
(function () {
  if (window.__adminSeasonStart) return;
  window.__adminSeasonStart = true;

  var timers = {};
  var money = function (n) { return '₱' + Number(n || 0).toLocaleString(); };
  var rowOf = function (el) { return el.closest && el.closest('tr[data-key]'); };
  var dataOf = function (tr) { return tr.querySelector('[data-asr-row]'); };
  var toast = function (text, opts) { window.adminUi.toast(text, opts); };

  function ticked(tr, cls) {
    var box = tr.querySelector(cls);
    return !!box && box.checked;
  }

  function amounts(tr) {
    var d = dataOf(tr).dataset;
    var total = (Number(d.fee) || 0)
      + (ticked(tr, '.asr-top') ? Number(d.top) || 0 : 0)
      + (ticked(tr, '.asr-shorts') ? Number(d.shorts) || 0 : 0)
      + (Number(tr.querySelector('.asr-extra__amount').value) || 0);
    // Same rule as billedAmount (lib/season-start.js).
    return { total: total, billed: d.account === '1' && total > 0 ? total : 0 };
  }

  function showTotal(next) {
    var start = document.querySelector('[data-asr-start]');
    if (!start) return;
    start.dataset.total = next;
    start.setAttribute('data-confirm-body', start.dataset.bodyTpl.replace('{total}', money(next)));
    var value = document.querySelector('[data-stat="total"] .aui-stats__value');
    if (value) value.textContent = money(next);
  }

  function recompute(tr) {
    var data = dataOf(tr);
    var now = amounts(tr);
    tr.querySelector('[data-asr-total]').textContent = money(now.total);
    var start = document.querySelector('[data-asr-start]');
    if (start) showTotal((Number(start.dataset.total) || 0) + now.billed - (Number(data.dataset.billed) || 0));
    data.dataset.billed = now.billed;
  }

  function save(tr) {
    var id = tr.dataset.key;
    clearTimeout(timers[id] && timers[id].t);
    delete timers[id];
    var top = tr.querySelector('.asr-top'), shorts = tr.querySelector('.asr-shorts');
    return fetch('/admin/season-signups/' + encodeURIComponent(id) + '/charge-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        top_excluded: top ? !top.checked : false,
        shorts_excluded: shorts ? !shorts.checked : false,
        extra_amount: Number(tr.querySelector('.asr-extra__amount').value) || 0,
        extra_label: tr.querySelector('.asr-extra__label').value,
      }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Not saved.'); });
    }).catch(function (e) {
      // What's on screen is no longer what would be charged, so don't let that pass quietly.
      toast('Not saved: ' + e.message + ' Reload before starting.', { tone: 'error' });
    });
  }

  function saveSoon(tr) {
    var id = tr.dataset.key;
    if (timers[id]) clearTimeout(timers[id].t);
    timers[id] = { tr: tr, t: setTimeout(function () { save(tr); }, 500) };
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.matches || !t.matches('.asr-top, .asr-shorts')) return;
    var tr = rowOf(t);
    if (tr) { recompute(tr); save(tr); }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.matches || !t.matches('.asr-extra__amount, .asr-extra__label')) return;
    var tr = rowOf(t);
    if (!tr) return;
    if (t.matches('.asr-extra__amount')) recompute(tr);
    saveSoon(tr);
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    // Anything still waiting to save goes now, before the dialog opens.
    if (t.closest('[data-asr-start]')) {
      Object.keys(timers).forEach(function (id) { save(timers[id].tr); });
      return;
    }
    if (!t.closest('[data-asr-bulk-apply]')) return;
    var drawer = t.closest('[data-drawer]');
    var label = drawer.querySelector('[name=bulk_label]').value.trim();
    var amount = drawer.querySelector('[name=bulk_amount]').value.trim();
    if (!amount || !Number(amount)) { toast('Enter an amount.', { tone: 'error' }); return; }
    var picked = [].slice.call(document.querySelectorAll('[data-bulk-row]:checked'));
    picked.forEach(function (box) {
      var tr = rowOf(box);
      tr.querySelector('.asr-extra__label').value = label;
      tr.querySelector('.asr-extra__amount').value = amount;
      recompute(tr);
      save(tr);
    });
    drawer.querySelector('[data-drawer-close]').click();
    toast('Applied to ' + picked.length + (picked.length === 1 ? ' player.' : ' players.'));
  }, true);
})();
