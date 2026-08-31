import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor, PAYMENT_CATEGORIES as CATEGORIES } from '../utils.js';

const METHOD_LABELS = { cash: 'Cash', gcash: 'GCash', bank: 'Bank Transfer', other: 'Other' };

const fmt     = n => `PHP ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_EYE       = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 7c0 0 2.2-4 6-4s6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.6"/></svg>`;
const ICON_PLUS      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>`;
const ICON_CHECK     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_COPY      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M1 9V2.5A1.5 1.5 0 0 1 2.5 1H9"/></svg>`;
const ICON_VOID      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="5"/><path d="M3.5 9.5l6-6"/></svg>`;
const ICON_TRASH     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.7 7a.5.5 0 0 1-.5.5H4.2a.5.5 0 0 1-.5-.5L3 3.5"/></svg>`;

function statusBadge(status) {
  if (status === 'confirmed') return `<span class="agm-badge agm-badge--green">confirmed</span>`;
  if (status === 'voided')    return `<span class="agm-badge agm-badge--gray">voided</span>`;
  return `<span class="agm-badge agm-badge--amber">pending</span>`;
}

function balanceColor(bal) {
  if (bal > 0) return '#ef4444';
  if (bal < 0) return '#22c55e';
  return '#64748b';
}

function statTile(label, value, color = '#e2e8f0') {
  return `<div class="bg-admin-surface border border-admin-border rounded-lg px-5 py-4">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">${escHtml(label)}</div>
    <div class="text-xl font-bold font-saira" style="color:${color}">${value}</div>
  </div>`;
}

function quotaBar(paid, quota) {
  if (!quota) return '';
  const pct = Math.min(100, Math.round((paid / quota) * 100));
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#ef4444';
  return `<div class="mt-1 flex items-center gap-1.5">
    <div class="flex-1 h-1 bg-admin-border rounded-full overflow-hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
    </div>
    <span class="text-[10px] font-bold whitespace-nowrap" style="color:${color}">${pct}%</span>
  </div>`;
}

function categoryOpts(selected = '') {
  return CATEGORIES.map(c => `<option value="${escHtml(c)}"${selected === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
}

// Dropdown of known season values only — no free-text entry, so a manually
// added transaction can never end up with a malformed season like "Season 3"
// instead of "3" (which is what broke the Awards page season tabs before).
// Always includes `selected` even if it's not otherwise in `seasons`, so the
// currently-filtered season stays choosable even before it has any
// transactions of its own yet.
function seasonOpts(seasons, selected = '') {
  const all = selected && !seasons.includes(selected) ? [selected, ...seasons] : seasons;
  return all.map(s => `<option value="${escHtml(s)}"${String(s) === String(selected) ? ' selected' : ''}>Season ${escHtml(String(s))}</option>`).join('');
}

function addTransactionForm(playerId, today, season, seasons = []) {
  return `<div id="lgr-msg" hidden class="rounded-lg text-[13px] px-3.5 py-2.5 mb-3.5"></div>
  <form id="lgr-form">
    <input type="hidden" name="player_id" value="${escHtml(playerId)}">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="admin-field-label">Type</label>
        <select name="type" class="admin-input mt-1">
          <option value="charge">Charge</option>
          <option value="payment">Payment</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Amount (PHP)</label>
        <input type="number" name="amount" class="admin-input mt-1" min="0.01" step="0.01" placeholder="0.00" required>
      </div>
      <div>
        <label class="admin-field-label">Category</label>
        <select name="category" class="admin-input mt-1"><option value="">— None —</option>${categoryOpts()}</select>
      </div>
      <div>
        <label class="admin-field-label">Status</label>
        <select name="status" class="admin-input mt-1">
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Method</label>
        <select name="payment_method" class="admin-input mt-1">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="bank">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Date</label>
        <input type="date" name="date" class="admin-input mt-1" value="${today}" required>
      </div>
      <div>
        <label class="admin-field-label">Season</label>
        <select name="season" class="admin-input mt-1">${seasonOpts(seasons, season)}</select>
      </div>
      <div>
        <label class="admin-field-label">Notes</label>
        <input type="text" name="notes" class="admin-input mt-1" placeholder="e.g. Season 3 Quota">
      </div>
      <div class="col-span-2">
        <label class="admin-field-label">Reference No. <span class="font-normal text-slate-500">(optional)</span></label>
        <input type="text" name="reference_no" class="admin-input mt-1" placeholder="GCash ref, bank ref…">
      </div>
      <div class="col-span-2" style="display:flex">
        <button type="submit" id="lgr-submit" class="admin-btn">${ICON_PLUS} Add Transaction</button>
      </div>
    </div>
  </form>`;
}

const TH = `px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap`;

// ── Player profile financial card (used on player admin page) ─────────────────
export function playerFinancialSection(fin, transactions, playerName, playerId) {
  const bal = Number(fin?.current_balance ?? 0);

  const txRows = transactions.length
    ? transactions.slice(0, 5).map(tx => `
    <tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(tx.date)}</td>
      <td class="px-4 py-3 text-xs" style="color:${tx.type==='charge'?'#ef4444':'#22c55e'}">${tx.type === 'charge' ? 'Charge' : 'Payment'}</td>
      <td class="px-4 py-3 text-sm font-semibold" style="color:${tx.type === 'charge' ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</td>
      <td class="px-4 py-3 text-sm text-slate-300">${escHtml(tx.notes || '—')}${tx.reference_no ? `<div class="text-[10px] text-slate-500 mt-0.5">Ref: ${escHtml(tx.reference_no)}</div>` : ''}</td>
      <td class="px-4 py-3">${statusBadge(tx.status)}</td>
    </tr>`).join('')
    : `<tr><td colspan="5" class="px-4 py-6 text-center text-xs text-slate-500">No transactions yet.</td></tr>`;

  return `<div class="bg-admin-surface border border-admin-border rounded-lg mt-5 overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b border-admin-border">
    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Account Balance</span>
    <a href="/admin/ledger/${escHtml(playerId)}" class="agm-edit-link">${ICON_EYE} Full ledger</a>
  </div>
  <div class="grid grid-cols-3 border-b border-admin-border">
    <div class="px-4 py-3 border-r border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Balance</div>
      <div class="text-base font-bold font-saira" style="color:${balanceColor(bal)}">${fmt(bal)}</div>
    </div>
    <div class="px-4 py-3 border-r border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Paid</div>
      <div class="text-base font-semibold font-saira text-success">${fmt(fin?.total_paid ?? 0)}</div>
    </div>
    <div class="px-4 py-3">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Charged</div>
      <div class="text-base font-semibold font-saira text-error">${fmt(fin?.total_outstanding ?? 0)}</div>
    </div>
  </div>
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="${TH}">Date</th>
        <th class="${TH}">Type</th>
        <th class="${TH}">Amount</th>
        <th class="${TH}">For</th>
        <th class="${TH}">Status</th>
      </tr>
    </thead>
    <tbody>${txRows}</tbody>
  </table>
</div>`;
}

// ── Ledger list page ──────────────────────────────────────────────────────────
export function adminLedgerBody({ players = [], txByPlayer = {}, seasons = [], season = '', quota = 0, summary = {}, balMap = {}, lastActivityMap = {} } = {}) {
  const teams = [...new Set(players.map(p => p.team_name).filter(Boolean))];

  // balMap is always the all-time balance now (see server.js) regardless of the season
  // filter, so sorting by it is meaningful in both "All Time" and season-filtered views —
  // no more only-sorts-when-a-season-is-picked.
  const sorted = [...players].sort((a, b) => {
    const bA = Number(balMap[a.id]?.balance ?? 0);
    const bB = Number(balMap[b.id]?.balance ?? 0);
    return bB - bA;
  });

  const seasonPills = seasons.map(s =>
    `<button class="agm-pill${s === season ? ' is-active' : ''}" data-season="${escHtml(s)}">${escHtml(s)}</button>`
  ).join('');

  const teamPills = teams.map(t =>
    `<button class="agm-pill" data-fteam="${escHtml(t.toLowerCase())}">${escHtml(t)}</button>`
  ).join('');

  const rows = sorted.map(p => {
    const name    = displayPlayerName(p.name);
    const color   = teamColor(p.team_name);
    const sbal    = balMap[p.id];
    const bal     = Number(sbal?.balance ?? 0);
    const paid    = Number(sbal?.paid ?? 0);
    const pendingTx = (txByPlayer[p.id] || []).filter(t => t.status === 'pending');
    const pending = Number(sbal?.pending_count ?? pendingTx.length ?? 0);
    // The single most recent pending transaction's own reference number (not just any
    // pending one) — the thing admin actually needs to eyeball right here to match a
    // payment against a bank/GCash statement, without opening the full per-player ledger.
    const pendingRef = pendingTx[0]?.reference_no || '';
    const balKey  = bal > 0 ? 'owed' : 'settled';
    const balLabel = bal === 0 ? 'Settled' : fmt(Math.abs(bal));
    const lastActivity = lastActivityMap[p.id] || '';

    return `<tr class="agm-row border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors"
      data-q="${escHtml(name.toLowerCase() + ' ' + (p.team_name || '').toLowerCase())}"
      data-team="${escHtml((p.team_name || '').toLowerCase())}"
      data-bal="${balKey}"
      data-pid="${escHtml(p.id)}"
      data-name="${escHtml(name.toLowerCase())}"
      data-balnum="${bal}"
      data-pending="${pending}"
      data-lastactivity="${escHtml(lastActivity)}">
      <td class="px-4 py-3">
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" class="lgr-check accent-brand" value="${escHtml(p.id)}">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
          <span class="text-xs text-slate-200">${escHtml(name)}</span>
        </label>
      </td>
      <td class="px-4 py-3 font-semibold text-sm" style="color:${balanceColor(bal)}">
        ${escHtml(balLabel)}
        ${quota ? quotaBar(paid, quota) : ''}
      </td>
      <td class="px-4 py-3">
        ${pending > 0
          ? `<span class="agm-badge agm-badge--amber">${pending} pending</span>${pendingRef ? `<div class="text-[10px] text-slate-500 mt-0.5">Ref: ${escHtml(pendingRef)}</div>` : ''}`
          : `<span class="text-slate-600 text-xs">–</span>`}
      </td>
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(lastActivity)}</td>
      <td class="px-4 py-3 text-right">
        <a href="/admin/ledger/${escHtml(p.id)}${season ? `?season=${encodeURIComponent(season)}` : ''}" class="agm-edit-link">View ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  const visibleCount = players.length;
  const visibleTotal = sorted.reduce((s, p) => s + Number(balMap[p.id]?.balance ?? 0), 0);

  const today = new Date().toISOString().split('T')[0];

  const summaryStrip = season ? `
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
  ${statTile('Total Outstanding', fmt(summary.total_outstanding ?? 0), '#ef4444')}
  ${statTile('Total Collected', fmt(summary.total_paid ?? 0), '#22c55e')}
  ${statTile('Pending Transactions', String(summary.pending_count ?? 0), '#f59332')}
  ${statTile('Quota', quota ? fmt(quota) : 'Not set')}
</div>` : '';

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Ledger</h2>
  <div class="flex items-center gap-2">
    <button id="lgr-export-btn" class="admin-btn admin-btn--inline-action" style="align-self:center">${ICON_COPY} Copy</button>
    <button id="lgr-bulk-btn" class="agm-new-btn">${ICON_PLUS} Bulk Charge</button>
    <input type="search" id="lgr-search" class="agm-search" placeholder="Search players…">
  </div>
</div>

${season ? `
<div class="flex items-center gap-2 py-2 mb-2">
  <span class="text-xs text-slate-500">Season quota:</span>
  <span class="text-sm font-semibold text-slate-200">${quota ? fmt(quota) : 'Not set'}</span>
  ${!quota ? `<a href="/admin/season" class="text-[11px] text-slate-500 border border-admin-border rounded px-2 py-0.5 no-underline hover:border-brand/50 transition-colors">Set season fee</a>` : ''}
</div>` : ''}

<div class="mb-4 flex flex-wrap gap-3">
  ${seasons.length ? `<div class="flex flex-wrap items-center gap-1.5" id="lgr-season-pills">
    <button class="agm-pill${!season ? ' is-active' : ''}" data-season="">All Time</button>
    ${seasonPills}
  </div>` : ''}
  <div class="flex flex-wrap items-center gap-1.5">
    <button class="agm-pill is-active" data-fteam="">All Teams</button>
    ${teamPills}
  </div>
  <div class="flex flex-wrap items-center gap-1.5">
    <button class="agm-pill is-active" data-fbal="">All</button>
    <button class="agm-pill" data-fbal="owed">Owed</button>
    <button class="agm-pill" data-fbal="settled">Settled</button>
  </div>
  <div class="flex flex-wrap items-center gap-1.5">
    <button class="agm-pill" id="lgr-pending-toggle">⏳ Pending only</button>
  </div>
</div>

${summaryStrip}

<div id="lgr-totals" class="text-xs text-slate-500 mb-2">${visibleCount} player${visibleCount === 1 ? '' : 's'} · ${fmt(visibleTotal)} outstanding</div>

<div id="lgr-bulk-panel" hidden class="mb-4">
  <div class="bg-admin-surface border border-admin-border rounded-lg p-5">
    <div class="flex items-center justify-between mb-4">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bulk Charge / Payment</div>
      <button id="lgr-bulk-close" class="agm-icon-btn" title="Close">&times;</button>
    </div>
    <div id="lgr-bulk-msg" hidden class="rounded-lg text-[13px] px-3.5 py-2.5 mb-3.5"></div>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="admin-field-label">Type</label>
        <select id="blk-type" class="admin-input mt-1">
          <option value="charge">Charge</option>
          <option value="payment">Payment</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Amount (PHP)</label>
        <input type="number" id="blk-amount" class="admin-input mt-1" min="0.01" step="0.01" placeholder="0.00">
      </div>
      <div>
        <label class="admin-field-label">Category</label>
        <select id="blk-category" class="admin-input mt-1"><option value="">— None —</option>${categoryOpts()}</select>
      </div>
      <div>
        <label class="admin-field-label">Status</label>
        <select id="blk-status" class="admin-input mt-1">
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Date</label>
        <input type="date" id="blk-date" class="admin-input mt-1" value="${today}">
      </div>
      <div>
        <label class="admin-field-label">Season</label>
        <select id="blk-season" class="admin-input mt-1">${seasonOpts(seasons, season)}</select>
      </div>
      <div class="col-span-3">
        <label class="admin-field-label">Notes</label>
        <input type="text" id="blk-notes" class="admin-input mt-1" placeholder="e.g. Season 3 Quota">
      </div>
    </div>
    <div class="mt-4 flex items-center gap-2">
      <button id="blk-select-all" class="admin-btn">${ICON_CHECK} Select All</button>
      <span id="blk-count" class="text-xs text-slate-500">0 players selected</span>
      <button id="blk-submit" class="admin-btn" style="margin-left:auto">${ICON_CHECK} Apply to Selected</button>
    </div>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="${TH} lgr-sortable" data-sort="name" style="cursor:pointer;user-select:none">Player <span class="lgr-sort-arrow"></span></th>
        <th class="${TH} lgr-sortable" data-sort="balnum" style="cursor:pointer;user-select:none">Balance <span class="lgr-sort-arrow"></span></th>
        <th class="${TH} lgr-sortable" data-sort="pending" style="cursor:pointer;user-select:none">Pending <span class="lgr-sort-arrow"></span></th>
        <th class="${TH} lgr-sortable" data-sort="lastactivity" style="cursor:pointer;user-select:none">Last Activity <span class="lgr-sort-arrow"></span></th>
        <th class="${TH}"></th>
      </tr>
    </thead>
    <tbody id="lgr-tbody">
      ${rows || '<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No players found.</td></tr>'}
    </tbody>
  </table>
</div>

<script>
(function(){
  var fteam = '', fbal = '', fpending = false, currentSeason = '${escHtml(season)}';

  // ── Filters ───────────────────────────────────────────────────────────────
  // "Pending only" is a separate on/off toggle rather than a third data-fbal option —
  // owed/settled and having a pending transaction are independent (a settled player can
  // still have a fresh pending charge, an owed one might have no pending activity at all),
  // so it needs to AND with the other filters rather than replace them.
  function apply() {
    var q = document.getElementById('lgr-search').value.toLowerCase().trim();
    var visibleCount = 0, visibleTotal = 0;
    document.querySelectorAll('#lgr-tbody .agm-row').forEach(function(r) {
      var show = (!fteam || r.dataset.team === fteam)
              && (!fbal  || r.dataset.bal  === fbal)
              && (!fpending || Number(r.dataset.pending) > 0)
              && (!q     || r.dataset.q.includes(q));
      r.style.display = show ? '' : 'none';
      if (show) { visibleCount++; visibleTotal += Number(r.dataset.balnum); }
    });
    var totalsEl = document.getElementById('lgr-totals');
    if (totalsEl) totalsEl.textContent = visibleCount + (visibleCount === 1 ? ' player · ' : ' players · ') + fmtPeso(visibleTotal) + ' outstanding';
  }
  // Mirrors fmt() server-side (views/admin/ledger.js) exactly, so the totals line reads
  // the same before and after any filter/search interaction touches it.
  function fmtPeso(n) {
    return 'PHP ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  document.querySelectorAll('[data-fteam]').forEach(function(b) {
    b.addEventListener('click', function() {
      fteam = this.dataset.fteam;
      document.querySelectorAll('[data-fteam]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fteam === fteam); });
      apply();
    });
  });
  document.querySelectorAll('[data-fbal]').forEach(function(b) {
    b.addEventListener('click', function() {
      fbal = this.dataset.fbal;
      document.querySelectorAll('[data-fbal]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fbal === fbal); });
      apply();
    });
  });
  document.getElementById('lgr-pending-toggle').addEventListener('click', function() {
    fpending = !fpending;
    this.classList.toggle('is-active', fpending);
    apply();
  });
  document.getElementById('lgr-search').addEventListener('input', apply);
  apply();

  // ── Sorting ───────────────────────────────────────────────────────────────
  // Client-side, like the filters above — reorders the existing rows rather than
  // reloading, and doesn't fight with the show/hide filtering since that only ever
  // touches display, never DOM order. Defaults to Balance descending, matching the
  // order the server already rendered, so the arrow is correct without an extra sort
  // on load actually changing anything.
  var sortKey = 'balnum', sortDir = -1;
  function applySort() {
    var tbody = document.getElementById('lgr-tbody');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('.agm-row'));
    rows.sort(function(a, b) {
      if (sortKey === 'name' || sortKey === 'lastactivity') {
        return sortDir * a.dataset[sortKey].localeCompare(b.dataset[sortKey]);
      }
      return sortDir * (Number(a.dataset[sortKey]) - Number(b.dataset[sortKey]));
    });
    rows.forEach(function(r) { tbody.appendChild(r); });
    document.querySelectorAll('.lgr-sortable').forEach(function(th) {
      var active = th.dataset.sort === sortKey;
      th.style.color = active ? '#f59332' : '';
      th.querySelector('.lgr-sort-arrow').textContent = active ? (sortDir === 1 ? '▲' : '▼') : '';
    });
  }
  document.querySelectorAll('.lgr-sortable').forEach(function(th) {
    th.addEventListener('click', function() {
      var key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === 'name' ? 1 : -1; }
      applySort();
    });
  });
  applySort();

  // ── Season pills (reload page) ────────────────────────────────────────────
  document.querySelectorAll('[data-season]').forEach(function(b) {
    b.addEventListener('click', function() {
      var s = this.dataset.season;
      window.location.href = '/admin/ledger' + (s ? '?season=' + encodeURIComponent(s) : '');
    });
  });

  // ── Bulk charge ───────────────────────────────────────────────────────────
  var bulkPanel = document.getElementById('lgr-bulk-panel');
  var bulkCount = document.getElementById('blk-count');
  document.getElementById('lgr-bulk-btn').addEventListener('click', function() { bulkPanel.hidden = false; });
  document.getElementById('lgr-bulk-close').addEventListener('click', function() { bulkPanel.hidden = true; });
  function updateCount() {
    var n = document.querySelectorAll('.lgr-check:checked').length;
    bulkCount.textContent = n + ' player' + (n === 1 ? '' : 's') + ' selected';
  }
  document.querySelectorAll('.lgr-check').forEach(function(c) { c.addEventListener('change', updateCount); });
  document.getElementById('blk-select-all').addEventListener('click', function() {
    var checks = document.querySelectorAll('#lgr-tbody .agm-row:not([style*="none"]) .lgr-check');
    var allChecked = [...checks].every(function(c){ return c.checked; });
    checks.forEach(function(c){ c.checked = !allChecked; });
    updateCount();
  });
  document.getElementById('blk-submit').addEventListener('click', async function() {
    var pids = [...document.querySelectorAll('.lgr-check:checked')].map(function(c){ return c.value; });
    if (!pids.length) return;
    var amount = parseFloat(document.getElementById('blk-amount').value);
    var date   = document.getElementById('blk-date').value;
    if (!amount || !date) { alert('Amount and date are required.'); return; }
    var msg = document.getElementById('lgr-bulk-msg');
    var btn = this;
    var origHtml = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Applying…';
    try {
      var r = await fetch('/admin/ledger/bulk-charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_ids: pids, amount,
          type:     document.getElementById('blk-type').value,
          status:   document.getElementById('blk-status').value,
          date,
          notes:    document.getElementById('blk-notes').value,
          season:   document.getElementById('blk-season').value,
          category: document.getElementById('blk-category').value,
        })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = 'Applied to ' + j.count + ' players. Reloading…';
      setTimeout(function(){ location.reload(); }, 900);
    } catch(err) {
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = err.message;
      btn.disabled = false; btn.innerHTML = origHtml;
    }
  });

  // ── Clipboard export ──────────────────────────────────────────────────────
  document.getElementById('lgr-export-btn').addEventListener('click', function() {
    var lines = ['WKND League — ' + (currentSeason || 'All Time') + ' Balance Summary', ''];
    document.querySelectorAll('#lgr-tbody .agm-row').forEach(function(r) {
      if (r.style.display === 'none') return;
      var name = r.querySelector('span.text-sm')?.textContent?.trim() || '';
      var bal  = r.querySelector('td:nth-child(2)')?.firstChild?.textContent?.trim() || '';
      if (name) lines.push(name + ' — ' + bal);
    });
    navigator.clipboard.writeText(lines.join('\\n')).then(function() {
      var btn = document.getElementById('lgr-export-btn');
      btn.textContent = '✓ Copied';
      setTimeout(function(){ btn.innerHTML = '${ICON_COPY} Copy Summary'; }, 2000);
    });
  });
})();
</script>`;
}

// ── Ledger player detail page ─────────────────────────────────────────────────
export function adminLedgerPlayerBody({ player, fin = {}, transactions = [], seasons = [], season = '', quota = 0 } = {}) {
  const name  = displayPlayerName(player.name);
  const color = teamColor(player.team_name);
  const bal   = Number(fin.current_balance ?? 0);
  const today = new Date().toISOString().split('T')[0];

  const seasonBal  = transactions.filter(t => t.status === 'confirmed' && t.type === 'charge').reduce((s, t) => s + t.amount, 0)
                   - transactions.filter(t => t.status === 'confirmed' && t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  const seasonPaid = transactions.filter(t => t.status === 'confirmed' && t.type === 'payment').reduce((s, t) => s + t.amount, 0);

  const seasonPills = seasons.map(s =>
    `<a href="/admin/ledger/${escHtml(player.id)}?season=${encodeURIComponent(s)}" class="agm-pill${s === season ? ' is-active' : ''}">${escHtml(s)}</a>`
  ).join('');

  const txRows = transactions.length
    ? transactions.map(tx => {
        const isCharge   = tx.type === 'charge';
        const canConfirm = tx.status === 'pending';
        const canVoid    = tx.status === 'confirmed';

        const refLine = tx.reference_no ? `<div class="text-[10px] text-slate-500 mt-0.5">Ref: ${escHtml(tx.reference_no)}</div>` : '';
        const notesCell = canConfirm
          ? `${escHtml(tx.notes || '—')}${refLine}
             ${tx.screenshot_url ? `<a href="${tx.screenshot_url}" target="_blank" class="ml-1.5 text-[10px] text-brand hover:underline">📷 screenshot</a>` : ''}
             <input type="text" id="cat-${escHtml(tx.id)}" class="admin-input mt-1.5" style="max-width:180px;height:26px;font-size:11px" placeholder="Category — e.g. papawis" value="${escHtml(tx.category || '')}">`
          : `${escHtml(tx.notes || '—')}${refLine}
             ${tx.screenshot_url ? `<a href="${tx.screenshot_url}" target="_blank" class="ml-1.5 text-[10px] text-brand hover:underline">📷 screenshot</a>` : ''}
             ${tx.category ? `<span class="ml-1.5 text-[10px] text-slate-500 bg-admin-border/50 px-1.5 py-0.5 rounded-full">${escHtml(tx.category)}</span>` : ''}`;

        const statusCell = canConfirm
          ? `<button onclick="lgrConfirm('${escHtml(tx.id)}')" id="status-${escHtml(tx.id)}" class="agm-badge agm-badge--amber cursor-pointer hover:opacity-80" title="Click to confirm">pending</button>`
          : statusBadge(tx.status);

        const actionBtns = `
          <button id="btn-void-${escHtml(tx.id)}"   onclick="lgrVoid('${escHtml(tx.id)}')"   class="agm-icon-btn" title="Void"   ${canVoid ? '' : 'style="display:none"'}>${ICON_VOID}</button>
          <button id="btn-delete-${escHtml(tx.id)}" onclick="lgrDelete('${escHtml(tx.id)}')" class="agm-icon-btn agm-icon-btn--danger" title="Delete">${ICON_TRASH}</button>`;

        return `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors" id="txrow-${escHtml(tx.id)}">
          <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(tx.date)}</td>
          <td class="px-4 py-3 text-xs" style="color:${isCharge ? '#ef4444' : '#22c55e'}">${isCharge ? 'Charge' : 'Payment'}</td>
          <td class="px-4 py-3 text-sm font-semibold font-saira" style="color:${isCharge ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</td>
          <td class="px-4 py-3 text-sm text-slate-300">${notesCell}</td>
          <td class="px-4 py-3 text-xs text-slate-500">${escHtml(tx.season || '—')}</td>
          <td class="px-4 py-3" id="status-cell-${escHtml(tx.id)}">${statusCell}</td>
          <td class="px-4 py-3 text-xs text-slate-500">${escHtml(METHOD_LABELS[tx.payment_method] || tx.payment_method || '—')}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1.5 justify-end">${actionBtns}</div>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">No transactions yet.</td></tr>`;

  return `
<div class="mb-5 flex flex-wrap items-center gap-2.5">
  <a href="/admin/ledger${season ? '?season='+encodeURIComponent(season) : ''}" class="text-sm text-slate-500 hover:text-slate-300 no-underline transition-colors">← Ledger</a>
  <span class="text-admin-border">/</span>
  <h2 class="text-xl font-bold tracking-tight text-slate-100">${escHtml(name)}</h2>
  <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
  <span class="text-sm text-slate-500">${escHtml(player.team_name || '')}</span>
</div>

${seasons.length ? `<div class="mb-4 flex flex-wrap items-center gap-1.5">
  <a href="/admin/ledger/${escHtml(player.id)}?season=" class="agm-pill${!season ? ' is-active' : ''}">All Time</a>
  ${seasonPills}
</div>` : ''}

<div class="grid grid-cols-3 gap-3 mb-5">
  ${statTile('All Time Balance', fmt(bal), balanceColor(bal))}
  ${statTile('All Time Paid', fmt(fin.total_paid ?? 0), '#22c55e')}
  ${quota && season
    ? `<div class="bg-admin-surface border border-admin-border rounded-lg px-5 py-4">
        <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Quota Progress</div>
        <div class="text-xl font-bold font-saira text-slate-100">${fmt(seasonPaid)} <span class="text-sm text-slate-500">/ ${fmt(quota)}</span></div>
        ${quotaBar(seasonPaid, quota)}
      </div>`
    : statTile(season ? 'Season Charged' : 'Total Charged', fmt(season ? (seasonBal + seasonPaid) : (fin.total_outstanding ?? 0)), '#ef4444')}
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto mb-5">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="${TH}">Date</th>
        <th class="${TH}">Type</th>
        <th class="${TH}">Amount</th>
        <th class="${TH}">Notes</th>
        <th class="${TH}">Season</th>
        <th class="${TH}">Status</th>
        <th class="${TH}">Method</th>
        <th class="${TH}"></th>
      </tr>
    </thead>
    <tbody id="lgr-tx-tbody">${txRows}</tbody>
  </table>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Add Transaction</div>
  <div class="p-5">
    ${addTransactionForm(player.id, today, season, seasons)}
  </div>
</div>

<script>
  // ── Confirm (in-place via status badge click) ─────────────────────────────
  window.lgrConfirm = async function(id) {
    if (!confirm('Mark this transaction as confirmed?')) return;
    var catInput = document.getElementById('cat-' + id);
    try {
      var r = await fetch('/admin/ledger/transaction/' + id + '/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: catInput ? catInput.value.trim() : undefined })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      var statusCell = document.getElementById('status-cell-' + id);
      if (statusCell) statusCell.innerHTML = '<span class="agm-badge agm-badge--green">confirmed</span>';
      var voidBtn = document.getElementById('btn-void-' + id);
      if (voidBtn) voidBtn.style.display = '';
      var row = document.getElementById('txrow-' + id);
      if (row) { row.style.transition = 'background .15s'; row.style.background = 'rgba(34,197,94,.07)'; setTimeout(function(){ row.style.background = ''; }, 900); }
    } catch(err) { alert(err.message); }
  };

  // ── Void (in-place) ───────────────────────────────────────────────────────
  window.lgrVoid = async function(id) {
    if (!confirm('Void this transaction? It will be kept in history but reversed.')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id + '/void', { method: 'POST' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      var statusCell = document.getElementById('status-cell-' + id);
      if (statusCell) statusCell.innerHTML = '<span class="agm-badge agm-badge--gray">voided</span>';
      var voidBtn = document.getElementById('btn-void-' + id);
      if (voidBtn) voidBtn.style.display = 'none';
      var row = document.getElementById('txrow-' + id);
      if (row) row.style.opacity = '0.5';
    } catch(err) { alert(err.message); }
  };

  // ── Delete (fade out) ─────────────────────────────────────────────────────
  window.lgrDelete = async function(id) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id, { method: 'DELETE' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      var row = document.getElementById('txrow-' + id);
      if (row) {
        row.style.transition = 'opacity .25s, transform .25s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(6px)';
        setTimeout(function(){ row.remove(); }, 260);
      }
    } catch(err) { alert(err.message); }
  };

  // ── Add transaction ───────────────────────────────────────────────────────
  var lgrForm = document.getElementById('lgr-form');
  if (lgrForm) lgrForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('lgr-submit');
    var msg = document.getElementById('lgr-msg');
    btn.disabled = true; btn.textContent = 'SAVING...';
    try {
      var res = await fetch('/admin/ledger/transaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = 'Saved. Reloading...';
      setTimeout(function(){ location.reload(); }, 800);
    } catch(err) {
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = err.message;
      btn.disabled = false; btn.textContent = 'ADD TRANSACTION';
    }
  });
</script>`;
}
