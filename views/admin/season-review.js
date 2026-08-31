import { escHtml } from '../layout.js';

const money = (n) => `₱${Number(n || 0).toLocaleString()}`;

function jerseyToggleCell(cls, size, amount, excluded, extra = '') {
  if (!size) return `<span class="text-slate-700">—</span>`;
  return `<label class="flex items-center gap-1.5 text-[12px] text-slate-300 cursor-pointer whitespace-nowrap">
    <input type="checkbox" class="${cls}" ${excluded ? '' : 'checked'}>
    ${escHtml(size)}${extra} <span class="amount-text text-slate-500">${money(amount)}</span>
  </label>`;
}

function rosterRow(r) {
  const shortsExtra = r.jerseyShorts && r.pockets ? ' +pockets' : '';
  return `<tr class="border-b border-admin-border/40 last:border-0" data-signup-id="${escHtml(r.signupId)}"
      data-quota="${r.quotaAmount}" data-top-amount="${r.topAmount || 0}" data-shorts-amount="${r.shortsAmount || 0}">
    <td class="px-3 py-3"><input type="checkbox" class="row-select accent-amber-400"></td>
    <td class="px-4 py-3">
      <div class="font-semibold text-slate-200 text-[12.5px] flex items-center gap-1.5">
        ${escHtml(r.name || '—')}
        ${!r.playerId ? `<span title="No live account yet — the charging step skips them, this total won't actually be billed until you run Create User for them." style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;cursor:help">NOT CHARGED</span>` : ''}
      </div>
      <div class="text-slate-500 text-[11px]">${escHtml(r.teamName || '—')}</div>
    </td>
    <td class="px-4 py-3 text-right text-slate-400 whitespace-nowrap">${money(r.quotaAmount)}</td>
    <td class="px-4 py-3">${jerseyToggleCell('top-toggle', r.jerseyTop, r.topAmount, r.topExcluded)}</td>
    <td class="px-4 py-3">${jerseyToggleCell('shorts-toggle', r.jerseyShorts, r.shortsAmount, r.shortsExcluded, shortsExtra)}</td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-1.5">
        <input type="text" class="extra-label admin-input text-[11px] w-24" placeholder="Label" value="${escHtml(r.extraLabel || '')}">
        <input type="number" class="extra-amount admin-input text-[11px] w-20" placeholder="0" value="${r.extraAmount ? r.extraAmount : ''}">
      </div>
    </td>
    <td class="px-4 py-3 text-right font-bold text-slate-100 total-cell whitespace-nowrap" data-total="${r.total}">${money(r.total)}</td>
  </tr>`;
}

// Full-page replacement for the old Start Season modal — every confirmed player gets a row
// with independent top/shorts charge toggles (not one combined "jersey" switch — a player
// might need a new top but already have shorts from last season, or vice versa) and an
// optional freeform extra charge/discount. Nothing here is destructive until the final
// "Start Season" button — everything above it just saves the adjustment, live, per row.
export function adminSeasonReviewBody({ sigSeason = '', rows = [], notSelected = [] } = {}) {
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return `
<div class="flex items-start justify-between gap-4 flex-wrap mb-5">
  <div>
    <a href="/admin/season/teams" class="text-[11px] text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Team Builder</a>
    <h1 class="m-0 text-xl font-extrabold text-slate-100">Review <span class="text-brand">— Season ${escHtml(String(sigSeason))}</span></h1>
    <p class="text-[11px] text-slate-500 mt-1 mb-0">${rows.length} confirmed player${rows.length === 1 ? '' : 's'} — adjust charges below, nothing is billed until you click Start Season.</p>
  </div>
  <div class="flex items-center gap-3 flex-wrap">
    <a href="/admin/season/teams/export-charges?season=${encodeURIComponent(sigSeason)}" class="text-[11px] font-semibold px-3 py-1.5 rounded-md no-underline bg-transparent border border-admin-border text-slate-400 hover:text-slate-200">⬇ Export CSV</a>
    <div class="text-right">
      <div class="text-[9.5px] font-bold tracking-widest uppercase text-slate-500">Grand Total</div>
      <div id="grand-total" class="text-xl font-extrabold text-brand font-saira" data-total="${grandTotal}">${money(grandTotal)}</div>
    </div>
    <button id="start-season-btn" class="text-[13px] font-bold px-4 py-2 rounded-md border-0 cursor-pointer bg-green-500 text-admin-bg" ${rows.length === 0 ? 'disabled' : ''}>Start Season →</button>
  </div>
</div>

<div id="result-banner" class="hidden mb-4 px-4 py-3 rounded-lg text-[12.5px]"></div>

${notSelected.length ? `
<details class="mb-5 bg-admin-surface border border-admin-border rounded-lg">
  <summary class="px-4 py-2.5 text-[11px] font-semibold text-slate-400 cursor-pointer select-none">Not selected (${notSelected.length}) — will get the "not this time" email</summary>
  <div class="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1">
    ${notSelected.map(p => `<span class="text-[11px] text-slate-500">${escHtml(p.name || '—')} <span class="text-slate-700">(${escHtml(p.status)})</span></span>`).join('')}
  </div>
</details>` : ''}

${rows.length === 0
  ? `<div class="border-2 border-dashed border-admin-border rounded-xl p-10 text-center text-slate-700 text-[13px]">No confirmed players yet.</div>`
  : `
<div class="flex items-center gap-3 mb-3 flex-wrap">
  <label class="flex items-center gap-2 text-[11px] text-slate-500 cursor-pointer">
    <input type="checkbox" id="select-all" class="accent-amber-400"> Select all
  </label>
  <button id="bulk-discount-btn" class="text-[11px] font-semibold px-3 py-1.5 rounded-md cursor-pointer bg-transparent border border-admin-border text-slate-400 hover:text-slate-200" disabled>Apply discount to selected</button>
  <span id="save-msg" class="text-[10.5px] text-slate-600"></span>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="overflow-x-auto"><table class="w-full text-xs">
    <thead>
      <tr class="border-b border-admin-border text-slate-500 uppercase tracking-wider text-[10px]">
        <th class="px-3 py-2.5"></th>
        <th class="px-4 py-2.5 text-left font-semibold">Player</th>
        <th class="px-4 py-2.5 text-right font-semibold">Quota</th>
        <th class="px-4 py-2.5 text-left font-semibold">Top</th>
        <th class="px-4 py-2.5 text-left font-semibold">Shorts</th>
        <th class="px-4 py-2.5 text-left font-semibold">Extra Charge / Discount</th>
        <th class="px-4 py-2.5 text-right font-semibold">Total</th>
      </tr>
    </thead>
    <tbody>${rows.map(rosterRow).join('')}</tbody>
  </table></div>
</div>`}

<!-- Bulk discount modal -->
<div id="bulk-discount-modal" class="hidden fixed inset-0 z-50 items-center justify-center" style="background:rgba(0,0,0,.75)">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-sm w-[90%] shadow-2xl">
    <h2 class="m-0 mb-4 text-[15px] font-extrabold text-slate-100">Apply Discount to <span id="bd-count" class="text-brand"></span> Player<span id="bd-plural"></span></h2>
    <div class="flex flex-col gap-3">
      <div>
        <label class="admin-field-label">Label</label>
        <input id="bd-label" class="admin-input" placeholder="e.g. Early bird discount">
      </div>
      <div>
        <label class="admin-field-label">Amount (negative for a discount)</label>
        <input id="bd-amount" type="number" class="admin-input" placeholder="-200">
      </div>
    </div>
    <div class="flex gap-2.5 justify-end mt-5">
      <button id="bd-cancel" class="bg-transparent border border-admin-border text-slate-400 text-[13px] font-semibold rounded-md px-4 py-2 cursor-pointer">Cancel</button>
      <button id="bd-apply" class="bg-green-500 text-admin-bg text-[13px] font-bold border-0 rounded-md px-4 py-2 cursor-pointer">Apply</button>
    </div>
  </div>
</div>

<script>
(function() {
  var SEASON = ${JSON.stringify(sigSeason)};

  function money(n) { return '₱' + Number(n || 0).toLocaleString(); }
  function escHtmlJs(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rowTotal(tr) {
    var quota = Number(tr.dataset.quota) || 0;
    var topChecked = tr.querySelector('.top-toggle');
    var shortsChecked = tr.querySelector('.shorts-toggle');
    var top = (topChecked && topChecked.checked) ? Number(tr.dataset.topAmount) || 0 : 0;
    var shorts = (shortsChecked && shortsChecked.checked) ? Number(tr.dataset.shortsAmount) || 0 : 0;
    var extra = Number(tr.querySelector('.extra-amount').value) || 0;
    return quota + top + shorts + extra;
  }

  function updateGrandTotal() {
    var sum = 0;
    document.querySelectorAll('tbody tr[data-signup-id]').forEach(function(tr) {
      sum += Number(tr.querySelector('.total-cell').dataset.total) || 0;
    });
    var el = document.getElementById('grand-total');
    el.dataset.total = sum;
    el.textContent = money(sum);
  }

  function recomputeRow(tr) {
    var total = rowTotal(tr);
    var cell = tr.querySelector('.total-cell');
    cell.dataset.total = total;
    cell.textContent = money(total);
    updateGrandTotal();
  }

  var saveTimers = {};
  function saveRow(tr, immediate) {
    var id = tr.dataset.signupId;
    var msg = document.getElementById('save-msg');
    function doSave() {
      var topToggle = tr.querySelector('.top-toggle');
      var shortsToggle = tr.querySelector('.shorts-toggle');
      var body = {
        top_excluded: topToggle ? !topToggle.checked : false,
        shorts_excluded: shortsToggle ? !shortsToggle.checked : false,
        extra_amount: Number(tr.querySelector('.extra-amount').value) || 0,
        extra_label: tr.querySelector('.extra-label').value,
      };
      msg.textContent = 'Saving…';
      fetch('/admin/season-signups/' + id + '/charge-adjustments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(function(r) {
        msg.textContent = r.ok ? 'Saved.' : 'Error saving.';
        setTimeout(function() { msg.textContent = ''; }, 1500);
      }).catch(function() { msg.textContent = 'Error saving.'; });
    }
    if (immediate) { doSave(); return; }
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(doSave, 500);
  }

  document.querySelectorAll('tbody tr[data-signup-id]').forEach(function(tr) {
    tr.querySelectorAll('.top-toggle, .shorts-toggle').forEach(function(cb) {
      cb.addEventListener('change', function() { recomputeRow(tr); saveRow(tr, true); });
    });
    tr.querySelector('.extra-amount').addEventListener('input', function() { recomputeRow(tr); saveRow(tr, false); });
    tr.querySelector('.extra-label').addEventListener('input', function() { saveRow(tr, false); });
  });

  // ── Bulk select ────────────────────────────────────────────────────────────
  var selectAll = document.getElementById('select-all');
  var bulkBtn = document.getElementById('bulk-discount-btn');
  function updateBulkBtn() {
    var checked = document.querySelectorAll('.row-select:checked').length;
    if (bulkBtn) bulkBtn.disabled = checked === 0;
  }
  if (selectAll) selectAll.addEventListener('change', function() {
    document.querySelectorAll('.row-select').forEach(function(c) { c.checked = selectAll.checked; });
    updateBulkBtn();
  });
  document.querySelectorAll('.row-select').forEach(function(c) {
    c.addEventListener('change', function() {
      updateBulkBtn();
      if (selectAll) {
        var all = document.querySelectorAll('.row-select');
        selectAll.checked = Array.prototype.every.call(all, function(x) { return x.checked; });
      }
    });
  });

  // ── Bulk discount modal ──────────────────────────────────────────────────────
  var bdModal = document.getElementById('bulk-discount-modal');
  if (bulkBtn) bulkBtn.addEventListener('click', function() {
    var n = document.querySelectorAll('.row-select:checked').length;
    document.getElementById('bd-count').textContent = n;
    document.getElementById('bd-plural').textContent = n === 1 ? '' : 's';
    document.getElementById('bd-label').value = '';
    document.getElementById('bd-amount').value = '';
    bdModal.classList.remove('hidden'); bdModal.classList.add('flex');
  });
  var bdCancel = document.getElementById('bd-cancel');
  if (bdCancel) bdCancel.addEventListener('click', function() { bdModal.classList.add('hidden'); bdModal.classList.remove('flex'); });
  bdModal.addEventListener('click', function(e) { if (e.target === bdModal) { bdModal.classList.add('hidden'); bdModal.classList.remove('flex'); } });

  var bdApply = document.getElementById('bd-apply');
  if (bdApply) bdApply.addEventListener('click', function() {
    var label = document.getElementById('bd-label').value;
    var amount = document.getElementById('bd-amount').value;
    document.querySelectorAll('.row-select:checked').forEach(function(cb) {
      var tr = cb.closest('tr');
      tr.querySelector('.extra-label').value = label;
      tr.querySelector('.extra-amount').value = amount;
      recomputeRow(tr);
      saveRow(tr, true);
    });
    bdModal.classList.add('hidden'); bdModal.classList.remove('flex');
  });

  // ── Start Season ──────────────────────────────────────────────────────────
  var startBtn = document.getElementById('start-season-btn');
  if (startBtn) startBtn.addEventListener('click', async function() {
    var total = document.getElementById('grand-total').dataset.total;
    if (!confirm(
      'Start Season ' + SEASON + '?\\n\\n' +
      'This will:\\n' +
      '• Charge every confirmed player exactly what\\'s shown here (grand total ' + money(total) + ')\\n' +
      '• Email confirmed players their itemized charge, and email unselected players\\n' +
      '• Sync each player\\'s current team to match this roster\\n' +
      '• Lock the team draft — rosters can\\'t be changed after this\\n\\n' +
      'This cannot be undone from here.'
    )) return;

    startBtn.disabled = true; startBtn.textContent = 'Starting…';
    var banner = document.getElementById('result-banner');
    try {
      var r = await fetch('/admin/season/teams/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to start season.');
      banner.className = 'mb-4 px-4 py-3 rounded-lg text-[12.5px]';
      banner.style.background = '#22c55e1a'; banner.style.color = '#22c55e'; banner.style.border = '1px solid #22c55e33';
      var summary = '✓ Season started — ' + d.charged + ' player' + (d.charged === 1 ? '' : 's') + ' charged, ' +
        d.teams_synced + ' team' + (d.teams_synced === 1 ? '' : 's') + ' synced, ' + d.emails_sent + ' email' + (d.emails_sent === 1 ? '' : 's') + ' sent.';
      var html = '<div>' + summary + '</div>';
      if (d.email_errors && d.email_errors.length) {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #22c55e33">' +
          d.email_errors.length + ' email' + (d.email_errors.length === 1 ? '' : 's') + ' failed to send:' +
          '<div style="margin-top:4px;display:flex;flex-direction:column;gap:4px">' +
          d.email_errors.map(function(err) {
            return '<div class="retry-row" style="display:flex;align-items:center;gap:8px">' +
              '<span>' + escHtmlJs(err.email) + '</span>' +
              '<button type="button" class="retry-email-btn" data-signup-id="' + escHtmlJs(err.signupId) + '" style="font-size:10px;padding:2px 8px;border-radius:6px;border:1px solid #22c55e44;background:transparent;color:#22c55e;cursor:pointer">Retry</button>' +
              '</div>';
          }).join('') +
          '</div></div>';
      }
      banner.innerHTML = html;
      banner.querySelectorAll('.retry-email-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          btn.disabled = true; btn.textContent = '…';
          try {
            var rr = await fetch('/admin/season-signups/' + btn.dataset.signupId + '/resend-season-email', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });
            var dd = await rr.json();
            if (!rr.ok) throw new Error(dd.error || 'Failed to resend.');
            btn.closest('.retry-row').innerHTML = '<span>✓ Resent</span>';
          } catch (err) {
            btn.disabled = false; btn.textContent = 'Retry';
            alert(err.message);
          }
        });
      });
      startBtn.textContent = 'Season Started';
    } catch (e) {
      banner.className = 'mb-4 px-4 py-3 rounded-lg text-[12.5px]';
      banner.style.background = '#f8717118'; banner.style.color = '#f87171'; banner.style.border = '1px solid #f8717133';
      banner.textContent = '✗ ' + e.message;
      startBtn.disabled = false; startBtn.textContent = 'Start Season →';
    }
  });
})();
</script>`;
}
