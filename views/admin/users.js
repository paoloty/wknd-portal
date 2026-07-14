import { escHtml } from '../layout.js';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;

const STATUS_BADGE = {
  pending:  { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-green-500/15 text-green-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15  text-red-400'   },
};

function badge(status) {
  const b = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}">${b.label}</span>`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function posChips(positions) {
  try {
    const arr = typeof positions === 'string' ? JSON.parse(positions) : (positions || []);
    return arr.map(p => `<span class="text-[10px] bg-admin-border/60 text-slate-400 px-1.5 py-0.5 rounded">${escHtml(p)}</span>`).join(' ');
  } catch { return '—'; }
}

export function adminUsersBody({ registrations = [] } = {}) {
  const counts = {
    all:      registrations.length,
    pending:  registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
  };

  const rows = registrations.map(r => `
<tr class="border-b border-admin-border/50 last:border-0 hover:bg-white/[.015] transition-colors" data-status="${escHtml(r.status)}">
  <td class="px-4 py-3">
    <div class="text-sm font-semibold text-slate-200 whitespace-nowrap">${escHtml(r.full_name)}</div>
    <div class="text-xs text-slate-500 mt-0.5">${escHtml(r.email)}</div>
  </td>
  <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">${escHtml(r.phone || '—')}</td>
  <td class="px-4 py-3"><div class="flex gap-1 flex-wrap">${posChips(r.positions)}</div></td>
  <td class="px-4 py-3">${badge(r.status)}</td>
  <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(r.created_at)}</td>
  <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${r.approved_at ? fmtDate(r.approved_at) : '—'}</td>
  <td class="px-4 py-3 text-right">
    <a href="/admin/users/${escHtml(r.id)}" class="admin-btn admin-btn--sm no-underline whitespace-nowrap">Review ${ICON_CHEVRON_R}</a>
  </td>
</tr>`).join('');

  return `
<div class="mb-6 flex items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Users</h2>
    <p class="text-sm text-slate-500 mt-0.5">${counts.all} total · ${counts.pending} pending · ${counts.approved} approved</p>
  </div>
</div>

<div class="flex items-center gap-1.5 mb-4 flex-wrap">
  <button onclick="filterUsers('all')"      id="f-all"      class="agm-pill is-active">All (${counts.all})</button>
  <button onclick="filterUsers('pending')"  id="f-pending"  class="agm-pill">Pending (${counts.pending})</button>
  <button onclick="filterUsers('approved')" id="f-approved" class="agm-pill">Approved (${counts.approved})</button>
  <button onclick="filterUsers('rejected')" id="f-rejected" class="agm-pill">Rejected (${counts.rejected})</button>
</div>

${registrations.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No users yet. Share the link: <a href="/register" class="text-brand hover:underline">/register</a></div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="overflow-x-auto">
    <table class="w-full border-collapse has-col-dividers has-freeze-col" id="users-table">
      <thead>
        <tr>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Name</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Phone</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Positions</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Status</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Joined</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Approved</th>
          <th class="px-4 py-2.5 border-b border-admin-border"></th>
        </tr>
      </thead>
      <tbody id="users-tbody">${rows}</tbody>
    </table>
  </div>
</div>`}

<script>
(function() {
  window.filterUsers = function(status) {
    document.querySelectorAll('#f-all,#f-pending,#f-approved,#f-rejected').forEach(function(b) { b.classList.remove('is-active'); });
    document.getElementById('f-' + status).classList.add('is-active');
    document.querySelectorAll('#users-tbody tr').forEach(function(tr) {
      tr.style.display = (status === 'all' || tr.dataset.status === status) ? '' : 'none';
    });
  };
})();
</script>`;
}
