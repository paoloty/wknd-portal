import { escHtml } from '../layout.js';

const ICON_TEAM = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5L2 4v4c0 2.5 2 4.5 5 5 3-.5 5-2.5 5-5V4L7 1.5z"/></svg>`;

const STATUS_BADGE = {
  waitlisted: `<span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WAITLISTED</span>`,
  confirmed:  `<span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">CONFIRMED</span>`,
  rejected:   `<span style="background:#64748b22;color:#64748b;border:1px solid #64748b44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">REJECTED</span>`,
};

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function adminWaitlistBody({ sigSeason = '', signups = [], count = 0, confirmedCount = 0 } = {}) {
  const byStatus = { waitlisted: 0, confirmed: 0, rejected: 0 };
  for (const s of signups) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

  const statsBar = `
<div class="flex items-center gap-6 mb-6">
  <div class="text-center">
    <div class="text-2xl font-bold text-slate-100">${signups.length}</div>
    <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Total</div>
  </div>
  <div class="w-px h-8 bg-admin-border"></div>
  <div class="text-center">
    <div class="text-2xl font-bold text-amber-400">${byStatus.waitlisted}</div>
    <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Waitlisted</div>
  </div>
  <div class="w-px h-8 bg-admin-border"></div>
  <div class="text-center">
    <div class="text-2xl font-bold text-green-400">${byStatus.confirmed}</div>
    <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Confirmed</div>
  </div>
  <div class="w-px h-8 bg-admin-border"></div>
  <div class="text-center">
    <div class="text-2xl font-bold text-slate-500">${byStatus.rejected}</div>
    <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Rejected</div>
  </div>
</div>`;

  const table = signups.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500">No signups yet for Season ${escHtml(sigSeason)}.</div>`
    : `
<div class="px-5 py-2.5 border-b border-admin-border/40 flex items-center gap-3">
  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
    <input type="checkbox" id="select-all" class="accent-amber-400"> Select all
  </label>
  <div class="ml-auto flex gap-3 items-center">
    <span class="text-[10px] text-slate-600 uppercase tracking-wider">Filter:</span>
    <select id="status-filter" class="admin-input text-xs" style="font-size:11px;padding:3px 8px">
      <option value="">All</option>
      <option value="waitlisted">Waitlisted</option>
      <option value="confirmed">Confirmed</option>
      <option value="rejected">Rejected</option>
    </select>
    <span class="text-slate-700">|</span>
    <button id="bulk-confirm-btn" class="text-[11px] font-semibold text-green-400 hover:text-green-300 disabled:opacity-30" disabled>Confirm Selected</button>
    <span class="text-slate-700">·</span>
    <button id="bulk-reject-btn" class="text-[11px] font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-30" disabled>Reject Selected</button>
  </div>
</div>
<div class="overflow-x-auto">
  <table class="w-full text-xs">
    <thead>
      <tr class="border-b border-admin-border text-slate-500 uppercase tracking-wider text-[10px]">
        <th class="px-5 py-2.5 text-left w-8"></th>
        <th class="px-4 py-2.5 text-left font-semibold">Member</th>
        <th class="px-4 py-2.5 text-left font-semibold">Jersey</th>
        <th class="px-4 py-2.5 text-left font-semibold">Signed Up</th>
        <th class="px-4 py-2.5 text-left font-semibold">Balance</th>
        <th class="px-4 py-2.5 text-left font-semibold">Status</th>
        <th class="px-4 py-2.5 text-right font-semibold">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${signups.map(s => `<tr class="waitlist-row border-b border-admin-border/40 last:border-0" data-id="${escHtml(s.id)}" data-status="${escHtml(s.status)}">
        <td class="px-5 py-3"><input type="checkbox" class="row-check accent-amber-400" data-id="${escHtml(s.id)}"></td>
        <td class="px-4 py-3">
          <div class="font-semibold text-slate-200">${escHtml(s.full_name || '—')}</div>
          <div class="text-slate-500">${escHtml(s.email || '')}</div>
          ${s.phone ? `<div class="text-slate-600 text-[10px] mt-0.5">${escHtml(s.phone)}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          ${s.jersey_top    ? `<div class="text-slate-400">Top: <span class="text-slate-200 font-medium">${escHtml(s.jersey_top)}</span></div>` : '<div class="text-slate-600">—</div>'}
          ${s.jersey_shorts ? `<div class="text-slate-400">Shorts: <span class="text-slate-200 font-medium">${escHtml(s.jersey_shorts)}</span></div>` : ''}
        </td>
        <td class="px-4 py-3 text-slate-400 whitespace-nowrap">${escHtml(fmtDate(s.created_at))}</td>
        <td class="px-4 py-3">
          ${s.has_balance
            ? `<span class="text-amber-400 font-medium">⚠ ₱${Number(s.balance_amt).toLocaleString()}</span>`
            : `<span class="text-slate-600">—</span>`}
        </td>
        <td class="px-4 py-3">${STATUS_BADGE[s.status] ?? escHtml(s.status)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          ${s.status !== 'confirmed' ? `<button class="signup-confirm-btn text-[11px] font-semibold text-green-400 hover:text-green-300 mr-3 transition-colors" data-id="${escHtml(s.id)}">Confirm</button>` : ''}
          ${s.status !== 'rejected'  ? `<button class="signup-reject-btn text-[11px] font-semibold text-slate-500 hover:text-rose-400 transition-colors" data-id="${escHtml(s.id)}">Reject</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;

  return `
<div style="max-width:960px">
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <a href="/admin/season" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Season Management</a>
      <h1 class="text-xl font-bold text-slate-100">Waitlist <span class="text-amber-400">Season ${escHtml(String(sigSeason))}</span></h1>
    </div>
    ${confirmedCount > 0 ? `<a href="/admin/season/teams" class="agm-new-btn inline-flex items-center gap-1.5">${ICON_TEAM} Build Teams (${confirmedCount})</a>` : ''}
  </div>

  ${statsBar}

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    ${table}
  </div>
</div>

<script>
(function() {
  // Status filter
  var filter = document.getElementById('status-filter');
  if (filter) filter.addEventListener('change', function() {
    var val = this.value;
    document.querySelectorAll('.waitlist-row').forEach(function(row) {
      row.style.display = (!val || row.dataset.status === val) ? '' : 'none';
    });
    // Uncheck hidden rows
    document.querySelectorAll('.waitlist-row[style*="none"] .row-check').forEach(function(c) { c.checked = false; });
    updateBulkBtns();
  });

  // Select all
  var selectAll   = document.getElementById('select-all');
  var confirmBtn  = document.getElementById('bulk-confirm-btn');
  var rejectBtn   = document.getElementById('bulk-reject-btn');

  function visibleChecks() {
    return Array.from(document.querySelectorAll('.waitlist-row:not([style*="none"]) .row-check'));
  }
  function updateBulkBtns() {
    var checked = document.querySelectorAll('.row-check:checked').length;
    if (confirmBtn) confirmBtn.disabled = checked === 0;
    if (rejectBtn)  rejectBtn.disabled  = checked === 0;
  }

  if (selectAll) {
    selectAll.addEventListener('change', function() {
      visibleChecks().forEach(function(c) { c.checked = selectAll.checked; });
      updateBulkBtns();
    });
  }
  document.querySelectorAll('.row-check').forEach(function(c) {
    c.addEventListener('change', function() {
      updateBulkBtns();
      if (selectAll) {
        var vis = visibleChecks();
        selectAll.checked = vis.length > 0 && vis.every(function(c) { return c.checked; });
      }
    });
  });

  async function bulkAction(action) {
    var ids = Array.from(document.querySelectorAll('.row-check:checked')).map(function(c) { return c.dataset.id; });
    if (!ids.length) return;
    var label = action === 'confirm' ? confirmBtn : rejectBtn;
    var orig = label.textContent; label.disabled = true; label.textContent = 'Saving…';
    await Promise.all(ids.map(function(id) {
      return fetch('/admin/season/signups/' + id + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }));
    location.reload();
  }
  if (confirmBtn) confirmBtn.addEventListener('click', function() { bulkAction('confirm'); });
  if (rejectBtn)  rejectBtn.addEventListener('click',  function() { bulkAction('reject'); });

  // Individual confirm/reject
  document.querySelectorAll('.signup-confirm-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
  document.querySelectorAll('.signup-reject-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
})();
</script>`;
}
