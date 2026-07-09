import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';

const fmt     = n => `PHP ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l3.5 3.5L11 3"/></svg>`;

function kpiTile(label, value, sub = '', color = 'var(--text-primary)') {
  return `<div class="card" style="padding:18px 20px">
    <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">${escHtml(label)}</div>
    <div style="font-size:22px;font-weight:700;color:${color};line-height:1.1">${value}</div>
    ${sub ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${sub}</div>` : ''}
  </div>`;
}

function progressBar(value, max, color = '#22c55e') {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#ef4444';
  return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px">
    <div style="flex:1;height:5px;background:var(--border);border-radius:99px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${barColor};border-radius:99px;transition:width .3s"></div>
    </div>
    <span style="font-size:11px;font-weight:700;color:${barColor};min-width:32px;text-align:right">${pct}%</span>
  </div>`;
}

export function adminFinanceDashBody({ seasons = [], season = '', summary = {}, quota = 0, balMap = {}, players = [], pending = [], categoryTotals = [], teamTotals = [], recentTx = [] } = {}) {
  const seasonPills = seasons.map(s =>
    `<a href="/admin/finance?season=${encodeURIComponent(s)}" class="agm-pill${s === season ? ' is-active' : ''}">${escHtml(s)}</a>`
  ).join('');

  // ── KPI calculations ────────────────────────────────────────────────────────
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

  // ── Top outstanding players ─────────────────────────────────────────────────
  const topOwing = season
    ? players
        .map(p => ({ player: p, bal: Number(balMap[p.id]?.balance ?? 0) }))
        .filter(x => x.bal > 0)
        .sort((a, b) => b.bal - a.bal)
        .slice(0, 5)
    : [];

  // ── KPI tiles ───────────────────────────────────────────────────────────────
  const kpiHtml = season ? `
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
  ${kpiTile('Total Outstanding', fmt(totalOutstanding), `${players.filter(p => Number(balMap[p.id]?.balance ?? 0) > 0).length} players owe`, '#ef4444')}
  ${kpiTile('Total Collected', fmt(totalPaid), `${collectionRate}% collection rate`, '#22c55e')}
  ${kpiTile('Players Settled', `${settledCount} / ${totalPlayers}`, season, '#f59332')}
  ${kpiTile('Pending Transactions', String(pendingCount), 'awaiting confirmation', pendingCount > 0 ? '#f59332' : 'var(--text-muted)')}
</div>
${quota ? `
<div class="card" style="padding:16px 20px;margin-bottom:24px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
    <span style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase">Season Quota Progress</span>
    <span style="font-size:12px;color:var(--text-muted)">${fmt(totalPaid)} collected of ${fmt(quota * totalPlayers)} target (${totalPlayers} players × ${fmt(quota)})</span>
  </div>
  ${progressBar(totalPaid, quota * totalPlayers)}
</div>` : ''}` : '';

  // ── Pending confirmations ───────────────────────────────────────────────────
  const pendingRows = pending.length
    ? pending.map(tx => {
        const isCharge = tx.type === 'charge';
        const pName = displayPlayerName(tx.player_name || '');
        return `<tr class="admin-table-row">
          <td class="admin-td" style="color:var(--text-muted);font-size:13px">${fmtDate(tx.date)}</td>
          <td class="admin-td">
            <a href="/admin/ledger/${escHtml(tx.player_id)}" style="color:var(--text-primary);text-decoration:none;font-weight:500">${escHtml(pName)}</a>
          </td>
          <td class="admin-td"><span style="font-size:12px;color:${isCharge ? '#ef4444' : '#22c55e'}">${isCharge ? 'Charge' : 'Payment'}</span></td>
          <td class="admin-td" style="font-weight:600;color:${isCharge ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</td>
          <td class="admin-td" style="font-size:13px;color:var(--text-muted)">${escHtml(tx.notes || '—')}</td>
          <td class="admin-td" style="font-size:12px;color:var(--text-muted)">${escHtml(tx.season || '—')}</td>
          <td class="admin-td agm-td--action">
            <button onclick="fnConfirm('${escHtml(tx.id)}')" class="ledger-icon-btn" title="Confirm" style="color:#22c55e;border-color:#22c55e44">${ICON_CHECK}</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No pending transactions.</td></tr>`;

  // ── Top outstanding ─────────────────────────────────────────────────────────
  const topOwingHtml = topOwing.length
    ? topOwing.map(({ player, bal }) => {
        const name  = displayPlayerName(player.name);
        const color = teamColor(player.team_name);
        const pct   = quota > 0 ? Math.min(100, Math.round(((quota - bal) / quota) * 100)) : null;
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span class="team-dot" style="background:${color};flex-shrink:0"></span>
          <a href="/admin/ledger/${escHtml(player.id)}${season ? '?season='+encodeURIComponent(season) : ''}" style="flex:1;color:var(--text-primary);text-decoration:none;font-size:13px;font-weight:500">${escHtml(name)}</a>
          <span style="font-size:13px;font-weight:700;color:#ef4444">${fmt(bal)}</span>
        </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">No outstanding balances.</p>`;

  // ── Category breakdown ──────────────────────────────────────────────────────
  const categoryHtml = categoryTotals.length
    ? categoryTotals.map(c => {
        const label = c.category || 'Uncategorized';
        const outstanding = Number(c.charged) - Number(c.paid);
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:13px;color:var(--text-primary)">${escHtml(label)}</span>
          <span style="font-size:12px;color:#22c55e;min-width:90px;text-align:right">${fmt(c.paid)} paid</span>
          <span style="font-size:12px;color:${outstanding > 0 ? '#ef4444' : 'var(--text-muted)'};min-width:90px;text-align:right">${fmt(outstanding)} owed</span>
        </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">${season ? 'No transactions yet.' : 'Select a season to see breakdown.'}</p>`;

  // ── Team breakdown ──────────────────────────────────────────────────────────
  const teamHtml = teamTotals.length
    ? teamTotals.map(t => {
        const outstanding = Number(t.outstanding);
        const color = t.team_color || '#64748b';
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span class="team-dot" style="background:${escHtml(color)};flex-shrink:0"></span>
          <span style="flex:1;font-size:13px;font-weight:500;color:var(--text-primary)">${escHtml(t.team_name)}</span>
          <span style="font-size:13px;font-weight:700;color:${outstanding > 0 ? '#ef4444' : '#22c55e'}">${fmt(outstanding)}</span>
        </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">${season ? 'No data.' : 'Select a season to see breakdown.'}</p>`;

  // ── Recent activity ─────────────────────────────────────────────────────────
  const recentHtml = recentTx.length
    ? recentTx.map(tx => {
        const isCharge = tx.type === 'charge';
        const pName = displayPlayerName(tx.player_name || '');
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:12px;color:var(--text-muted);min-width:80px">${fmtDate(tx.date)}</span>
          <a href="/admin/ledger/${escHtml(tx.player_id)}" style="flex:1;color:var(--text-primary);text-decoration:none;font-size:13px">${escHtml(pName)}</a>
          ${tx.notes ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(tx.notes)}</span>` : ''}
          <span style="font-size:13px;font-weight:600;color:${isCharge ? '#ef4444' : '#22c55e'};min-width:90px;text-align:right">${isCharge ? '+' : '−'}${fmt(tx.amount)}</span>
        </div>`;
      }).join('')
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">No transactions yet.</p>`;

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Finance Overview</h2>
  <div class="agm-toolbar__right">
    <a href="/admin/ledger${season ? '?season='+encodeURIComponent(season) : ''}" class="agm-pill">Open Ledger →</a>
  </div>
</div>

${seasons.length ? `<div class="agm-filters" style="margin-bottom:20px">
  <div class="agm-filter-group">
    <a href="/admin/finance" class="agm-pill${!season ? ' is-active' : ''}">All Time</a>
    ${seasonPills}
  </div>
</div>` : ''}

${kpiHtml}

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Top Outstanding</div>
    <div style="padding:4px 16px 8px">${topOwingHtml}</div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">By Team</div>
    <div style="padding:4px 16px 8px">${teamHtml}</div>
  </div>
</div>

<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
  <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">By Category${season ? ' — ' + escHtml(season) : ''}</div>
  <div style="padding:4px 16px 8px">${categoryHtml}</div>
</div>

<div class="card admin-table-scroll" style="padding:0;margin-bottom:16px">
  <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">
    Pending Confirmations
    ${pending.length ? `<span class="agm-badge agm-badge--amber" style="margin-left:8px">${pending.length}</span>` : ''}
  </div>
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Date</th>
        <th class="admin-th">Player</th>
        <th class="admin-th">Type</th>
        <th class="admin-th">Amount</th>
        <th class="admin-th">Notes</th>
        <th class="admin-th">Season</th>
        <th class="admin-th"></th>
      </tr>
    </thead>
    <tbody id="fn-pending-tbody">${pendingRows}</tbody>
  </table>
</div>

<div class="card" style="padding:0;overflow:hidden">
  <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Recent Activity</div>
  <div style="padding:4px 16px 8px">${recentHtml}</div>
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
