import { escHtml } from '../layout.js';
import { maskEmail, maskPhone } from '../../lib/sensitive-mask.js';

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

// 'set' isn't surfaced as a badge in the list (it's the steady state) — only the
// states that need admin attention are.
function passwordStatus(r) {
  if (r.status !== 'approved') return null;
  if (r.password_hash) return 'set';
  if (r.pw_token && r.pw_token_exp) return r.pw_token_exp > Date.now() ? 'pending' : 'expired';
  return 'none';
}

const PW_BADGE = {
  pending: { label: '⚠ Awaiting Password', cls: 'bg-amber-500/15 text-amber-400' },
  expired: { label: '⏱ Link Expired',      cls: 'bg-red-500/15 text-red-400'    },
  none:    { label: 'No Link Sent',        cls: 'bg-slate-500/15 text-slate-400' },
};

function passwordBadge(status) {
  if (!status || status === 'set') return '';
  const b = PW_BADGE[status];
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${b.cls}">${b.label}</span>`;
}

export function adminUsersBody({ registrations = [], canViewSensitive = true } = {}) {
  const rowsData = registrations.map(r => ({ r, pwStatus: passwordStatus(r), flags: r.bogusFlags || [] }));

  const counts = {
    all:              registrations.length,
    pending:          registrations.filter(r => r.status === 'pending').length,
    approved:         registrations.filter(r => r.status === 'approved').length,
    rejected:         registrations.filter(r => r.status === 'rejected').length,
    awaiting_password: rowsData.filter(x => x.pwStatus === 'pending').length,
    link_expired:      rowsData.filter(x => x.pwStatus === 'expired').length,
    flagged:           rowsData.filter(x => x.flags.length).length,
  };

  const rows = rowsData.map(({ r, pwStatus, flags }) => {
    const filters = [r.status];
    if (pwStatus === 'pending') filters.push('awaiting_password');
    if (pwStatus === 'expired') filters.push('link_expired');
    if (flags.length) filters.push('flagged');
    const flaggedBadge = flags.length
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 whitespace-nowrap" title="${escHtml(flags.join('; '))}">⚑ Flagged</span>`
      : '';
    const q = [r.full_name, r.email, r.phone].filter(Boolean).join(' ').toLowerCase();
    return `
<tr class="border-b border-admin-border/50 last:border-0 hover:bg-white/[.015] transition-colors" data-filters="${escHtml(filters.join(' '))}" data-q="${escHtml(q)}">
  <td class="px-4 py-3">
    <div class="text-xs font-semibold text-slate-200 whitespace-nowrap">${escHtml(r.full_name)}</div>
    <div class="text-xs text-slate-500 mt-0.5">${escHtml(canViewSensitive ? r.email : maskEmail(r.email))}</div>
  </td>
  <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">${r.phone ? escHtml(canViewSensitive ? r.phone : maskPhone(r.phone)) : '—'}</td>
  <td class="px-4 py-3"><div class="flex gap-1 flex-wrap">${posChips(r.positions)}</div></td>
  <td class="px-4 py-3"><div class="flex gap-1 flex-wrap items-center">${badge(r.status)}${passwordBadge(pwStatus)}${flaggedBadge}</div></td>
  <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(r.created_at)}</td>
  <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${r.approved_at ? fmtDate(r.approved_at) : '—'}</td>
  <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(r.last_login_at)}</td>
  <td class="px-4 py-3 text-right">
    <a href="/admin/users/${escHtml(r.id)}" class="admin-btn admin-btn--sm no-underline whitespace-nowrap">Review ${ICON_CHEVRON_R}</a>
  </td>
</tr>`;
  }).join('');

  return `
<div class="mb-6 flex items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Users</h2>
    <p class="text-sm text-slate-500 mt-0.5">${counts.all} total · ${counts.pending} pending · ${counts.approved} approved</p>
  </div>
  <input type="search" id="usr-search" class="agm-search" placeholder="Search name, email, phone…">
</div>

<div class="flex items-center gap-1.5 mb-4 flex-wrap">
  <button onclick="filterUsers('all')"      id="f-all"      class="agm-pill is-active">All (${counts.all})</button>
  <button onclick="filterUsers('pending')"  id="f-pending"  class="agm-pill">Pending (${counts.pending})</button>
  <button onclick="filterUsers('approved')" id="f-approved" class="agm-pill">Approved (${counts.approved})</button>
  <button onclick="filterUsers('rejected')" id="f-rejected" class="agm-pill">Rejected (${counts.rejected})</button>
  <button onclick="filterUsers('awaiting_password')" id="f-awaiting_password" class="agm-pill">Awaiting Password (${counts.awaiting_password})</button>
  <button onclick="filterUsers('link_expired')" id="f-link_expired" class="agm-pill">Link Expired (${counts.link_expired})</button>
  <button onclick="filterUsers('flagged')" id="f-flagged" class="agm-pill">Flagged (${counts.flagged})</button>
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
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Last Login</th>
          <th class="px-4 py-2.5 border-b border-admin-border"></th>
        </tr>
      </thead>
      <tbody id="users-tbody">${rows}</tbody>
    </table>
  </div>
</div>`}

<script>
(function() {
  var FILTER_IDS = ['f-all','f-pending','f-approved','f-rejected','f-awaiting_password','f-link_expired','f-flagged'];
  var status = 'all';
  var search = document.getElementById('usr-search');

  function applyFilters() {
    var q = (search.value || '').toLowerCase().trim();
    document.querySelectorAll('#users-tbody tr').forEach(function(tr) {
      var filters = (' ' + tr.dataset.filters + ' ');
      var statusOk = status === 'all' || filters.indexOf(' ' + status + ' ') !== -1;
      var searchOk = !q || tr.dataset.q.indexOf(q) !== -1;
      tr.style.display = (statusOk && searchOk) ? '' : 'none';
    });
  }

  window.filterUsers = function(s) {
    status = s;
    FILTER_IDS.forEach(function(id) { document.getElementById(id).classList.remove('is-active'); });
    document.getElementById('f-' + s).classList.add('is-active');
    applyFilters();
  };

  if (search) search.addEventListener('input', applyFilters);
})();
</script>`;
}
