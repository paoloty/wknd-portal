import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';

const fmt     = n => `PHP ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l3.5 3.5L11 3"/></svg>`;

const TH = `px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap`;
const CARD = `bg-admin-surface border border-admin-border rounded-lg overflow-hidden`;
const SECTION_LABEL = `px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500`;

function kpiTile(label, value, sub = '', color = '#e2e8f0') {
  return `<div class="bg-admin-surface border border-admin-border rounded-lg px-5 py-4">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">${escHtml(label)}</div>
    <div class="text-2xl font-extrabold font-saira leading-tight" style="color:${color}">${value}</div>
    ${sub ? `<div class="text-xs text-slate-500 mt-1">${sub}</div>` : ''}
  </div>`;
}

function progressBar(value, max) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#ef4444';
  return `<div class="flex items-center gap-2 mt-1.5">
    <div class="flex-1 h-1.5 bg-admin-border rounded-full overflow-hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px;transition:width .3s"></div>
    </div>
    <span class="text-[11px] font-bold min-w-[32px] text-right" style="color:${color}">${pct}%</span>
  </div>`;
}

export function adminFinanceDashBody({ seasons = [], season = '', summary = {}, quota = 0, balMap = {}, players = [], pending = [], categoryTotals = [], teamTotals = [], recentTx = [] } = {}) {
  const seasonPills = seasons.map(s =>
    `<a href="/admin/finance?season=${encodeURIComponent(s)}" class="agm-pill${s === season ? ' is-active' : ''}">${escHtml(s)}</a>`
  ).join('');

  const totalOutstanding = Number(summary.total_outstanding ?? 0);
  const totalPaid        = Number(summary.total_paid ?? 0);
  const totalCharged     = Number(summary.total_charged ?? 0);
  const pendingCount     = Number(summary.pending_count ?? 0);

  const settledCount = season
    ? players.filter(p => {
        const b = balMap[p.id];
        return b && Number(b.balance) <= 0 && (Number(b.charged) > 0 || Number(b.paid) > 0);
      }).length
    : 0;
  const totalPlayers = players.length;
  const collectionRate = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 100) : 0;

  const topOwing = season
    ? players
        .map(p => ({ player: p, bal: Number(balMap[p.id]?.balance ?? 0) }))
        .filter(x => x.bal > 0)
        .sort((a, b) => b.bal - a.bal)
        .slice(0, 5)
    : [];

  const kpiHtml = season ? `
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
  ${kpiTile('Total Outstanding', fmt(totalOutstanding), `${players.filter(p => Number(balMap[p.id]?.balance ?? 0) > 0).length} players owe`, '#ef4444')}
  ${kpiTile('Total Collected', fmt(totalPaid), `${collectionRate}% collection rate`, '#22c55e')}
  ${kpiTile('Players Settled', `${settledCount} / ${totalPlayers}`, season, '#f59332')}
  ${kpiTile('Pending Transactions', String(pendingCount), 'awaiting confirmation', pendingCount > 0 ? '#f59332' : '#64748b')}
</div>
${quota ? `
<div class="${CARD} px-5 py-4 mb-5">
  <div class="flex items-center justify-between mb-1">
    <span class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Season Quota Progress</span>
    <span class="text-xs text-slate-500">${fmt(totalPaid)} of ${fmt(quota * totalPlayers)} target (${totalPlayers} × ${fmt(quota)})</span>
  </div>
  ${progressBar(totalPaid, quota * totalPlayers)}
</div>` : ''}` : '';

  // ── Pending rows
  const pendingRows = pending.length
    ? pending.map(tx => {
        const isCharge = tx.type === 'charge';
        const pName = displayPlayerName(tx.player_name || '');
        return `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
          <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(tx.date)}</td>
          <td class="px-4 py-3">
            <a href="/admin/ledger/${escHtml(tx.player_id)}" class="text-sm font-medium text-slate-200 no-underline hover:text-brand transition-colors">${escHtml(pName)}</a>
          </td>
          <td class="px-4 py-3 text-xs" style="color:${isCharge ? '#ef4444' : '#22c55e'}">${isCharge ? 'Charge' : 'Payment'}</td>
          <td class="px-4 py-3 text-sm font-semibold font-saira" style="color:${isCharge ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</td>
          <td class="px-4 py-3 text-sm text-slate-400">${escHtml(tx.notes || '—')}</td>
          <td class="px-4 py-3 text-xs text-slate-500">${escHtml(tx.season || '—')}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="fnConfirm('${escHtml(tx.id)}')" class="agm-icon-btn agm-icon-btn--success" title="Confirm">${ICON_CHECK}</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No pending transactions.</td></tr>`;

  // ── Top outstanding
  const topOwingHtml = topOwing.length
    ? topOwing.map(({ player, bal }) => {
        const name  = displayPlayerName(player.name);
        const color = teamColor(player.team_name);
        return `<div class="admin-data-row flex items-center gap-3 py-2.5 border-b border-admin-border/50 last:border-b-0">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
          <a href="/admin/ledger/${escHtml(player.id)}${season ? '?season='+encodeURIComponent(season) : ''}" class="flex-1 font-medium text-slate-200 no-underline hover:text-brand transition-colors">${escHtml(name)}</a>
          <span class="font-bold text-error font-saira">${fmt(bal)}</span>
        </div>`;
      }).join('')
    : `<p class="text-xs text-slate-500 py-3">No outstanding balances.</p>`;

  // ── Category breakdown
  const categoryHtml = categoryTotals.length
    ? categoryTotals.map(c => {
        const label = c.category || 'Uncategorized';
        const outstanding = Number(c.charged) - Number(c.paid);
        return `<div class="admin-data-row flex items-center gap-3 py-2.5 border-b border-admin-border/50 last:border-b-0">
          <span class="flex-1 text-slate-300">${escHtml(label)}</span>
          <span class="text-success min-w-[90px] text-right">${fmt(c.paid)} paid</span>
          <span class="min-w-[90px] text-right" style="color:${outstanding > 0 ? '#ef4444' : '#64748b'}">${fmt(outstanding)} owed</span>
        </div>`;
      }).join('')
    : `<p class="text-xs text-slate-500 py-3">${season ? 'No transactions yet.' : 'Select a season to see breakdown.'}</p>`;

  // ── Team breakdown
  const teamHtml = teamTotals.length
    ? teamTotals.map(t => {
        const outstanding = Number(t.outstanding);
        const color = t.team_color || '#64748b';
        return `<div class="admin-data-row flex items-center gap-3 py-2.5 border-b border-admin-border/50 last:border-b-0">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${escHtml(color)}"></span>
          <span class="flex-1 font-medium text-slate-200">${escHtml(t.team_name)}</span>
          <span class="font-bold font-saira" style="color:${outstanding > 0 ? '#ef4444' : '#22c55e'}">${fmt(outstanding)}</span>
        </div>`;
      }).join('')
    : `<p class="text-xs text-slate-500 py-3">${season ? 'No data.' : 'Select a season to see breakdown.'}</p>`;

  // ── Recent activity
  const recentHtml = recentTx.length
    ? recentTx.map(tx => {
        const isCharge = tx.type === 'charge';
        const pName = displayPlayerName(tx.player_name || '');
        return `<div class="admin-data-row flex items-center gap-2.5 py-2.5 border-b border-admin-border/50 last:border-b-0">
          <span class="text-slate-500 min-w-[72px] shrink-0">${fmtDate(tx.date)}</span>
          <a href="/admin/ledger/${escHtml(tx.player_id)}" class="flex-1 text-slate-200 no-underline hover:text-brand transition-colors truncate">${escHtml(pName)}</a>
          ${tx.notes ? `<span class="text-slate-500 truncate max-w-[120px]">${escHtml(tx.notes)}</span>` : ''}
          <span class="font-semibold font-saira min-w-[90px] text-right" style="color:${isCharge ? '#ef4444' : '#22c55e'}">${isCharge ? '+' : '−'}${fmt(tx.amount)}</span>
        </div>`;
      }).join('')
    : `<p class="text-xs text-slate-500 py-3">No transactions yet.</p>`;

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Finance Overview</h2>
  <a href="/admin/ledger${season ? '?season='+encodeURIComponent(season) : ''}" class="agm-pill">Open Ledger →</a>
</div>

${seasons.length ? `<div class="mb-5 flex flex-wrap items-center gap-1.5">
  <a href="/admin/finance" class="agm-pill${!season ? ' is-active' : ''}">All Time</a>
  ${seasonPills}
</div>` : ''}

${kpiHtml}

<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
  <div class="${CARD}">
    <div class="${SECTION_LABEL}">Top Outstanding</div>
    <div class="admin-data-list px-4 py-1">${topOwingHtml}</div>
  </div>
  <div class="${CARD}">
    <div class="${SECTION_LABEL}">By Team</div>
    <div class="admin-data-list px-4 py-1">${teamHtml}</div>
  </div>
</div>

<div class="${CARD} mb-4">
  <div class="${SECTION_LABEL}">By Category${season ? ' — ' + escHtml(season) : ''}</div>
  <div class="admin-data-list px-4 py-1">${categoryHtml}</div>
</div>

<div class="${CARD} mb-4">
  <div class="${SECTION_LABEL} flex items-center gap-2">
    Pending Confirmations
    ${pending.length ? `<span class="agm-badge agm-badge--amber">${pending.length}</span>` : ''}
  </div>
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="${TH}">Date</th>
        <th class="${TH}">Player</th>
        <th class="${TH}">Type</th>
        <th class="${TH}">Amount</th>
        <th class="${TH}">Notes</th>
        <th class="${TH}">Season</th>
        <th class="${TH}"></th>
      </tr>
    </thead>
    <tbody id="fn-pending-tbody">${pendingRows}</tbody>
  </table>
</div>

<div class="${CARD}">
  <div class="${SECTION_LABEL}">Recent Activity</div>
  <div class="admin-data-list px-4 py-1">${recentHtml}</div>
</div>

<script>
(function(){
  window.fnConfirm = async function(id) {
    if (!confirm('Mark this transaction as confirmed?')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id + '/confirm', { method: 'POST' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch(e) { alert(e.message); }
  };
})();
</script>`;
}
