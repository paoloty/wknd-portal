import { escHtml } from '../layout.js';

const fmt    = n => `PHP ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

function kpi(label, value, sub = '', color = 'var(--text-primary)', href = '') {
  const inner = `
    <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">${escHtml(label)}</div>
    <div style="font-size:26px;font-weight:800;color:${color};line-height:1;font-family:'Saira Condensed',sans-serif">${value}</div>
    ${sub ? `<div style="font-size:12px;color:var(--text-muted);margin-top:5px">${sub}</div>` : ''}`;
  return href
    ? `<a href="${href}" class="card" style="padding:18px 20px;text-decoration:none;display:block">${inner}</a>`
    : `<div class="card" style="padding:18px 20px">${inner}</div>`;
}

function gameRow(g) {
  const aWon = g.team_a_score > g.team_b_score;
  const bWon = g.team_b_score > g.team_a_score;
  const gameTypeBadge = g.game_type === 'playoff'
    ? `<span style="font-size:10px;font-weight:700;letter-spacing:.06em;color:#f59332;text-transform:uppercase;margin-left:6px">PO</span>`
    : '';
  return `<tr>
    <td style="padding:9px 0;color:var(--text-muted);font-size:12px;white-space:nowrap">${fmtDate(g.date)}${gameTypeBadge}</td>
    <td style="padding:9px 0 9px 12px">
      <span style="font-size:13px;font-weight:${aWon ? '700' : '400'};color:${aWon ? 'var(--text-primary)' : 'var(--text-muted)'}">${escHtml(g.team_a_name)}</span>
      <span style="font-size:13px;font-weight:800;color:var(--text-primary);margin:0 8px;font-family:'Saira Condensed',sans-serif">${g.team_a_score}–${g.team_b_score}</span>
      <span style="font-size:13px;font-weight:${bWon ? '700' : '400'};color:${bWon ? 'var(--text-primary)' : 'var(--text-muted)'}">${escHtml(g.team_b_name)}</span>
    </td>
    <td style="padding:9px 0;text-align:right">
      <a href="/admin/games/${escHtml(g.id)}" style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:2px 8px;text-decoration:none">Edit</a>
    </td>
  </tr>`;
}

function upcomingRow(g) {
  return `<tr>
    <td style="padding:9px 0;color:var(--text-muted);font-size:12px;white-space:nowrap">${fmtDate(g.date)}</td>
    <td style="padding:9px 0 9px 12px;font-size:13px;color:var(--text-primary)">${escHtml(g.team_a_name)} <span style="color:var(--text-muted)">vs</span> ${escHtml(g.team_b_name)}</td>
    <td style="padding:9px 0;text-align:right">
      <a href="/admin/games/${escHtml(g.id)}" style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);border-radius:4px;padding:2px 8px;text-decoration:none">Edit</a>
    </td>
  </tr>`;
}

export function adminDashboardBody({
  players = [], teams = [], recentGames = [], upcoming = [],
  financeSummary = {}, pendingTx = [], underReview = 0, activePlayers = 0, gamesPlayed = 0,
} = {}) {
  const totalOutstanding = Number(financeSummary.total_outstanding ?? 0);
  const pendingCount     = pendingTx.length;
  const inactivePlayers  = players.length - activePlayers;

  const alerts = [];
  if (pendingCount > 0) alerts.push(`<a href="/admin/ledger" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;background:#f5933210;border:1px solid #f5933230;text-decoration:none;font-size:13px;color:#f59332"><span style="font-weight:600">${pendingCount} pending transaction${pendingCount === 1 ? '' : 's'}</span> <span style="color:var(--text-muted)">awaiting confirmation →</span></a>`);
  if (underReview > 0)  alerts.push(`<a href="/admin/games" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:8px;background:#ef444410;border:1px solid #ef444430;text-decoration:none;font-size:13px;color:#ef4444"><span style="font-weight:600">${underReview} game${underReview === 1 ? '' : 's'} under review</span> <span style="color:var(--text-muted)">needs attention →</span></a>`);

  const recentGamesHtml = recentGames.length
    ? `<table style="width:100%;border-collapse:collapse">${recentGames.map(gameRow).join('')}</table>`
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">No games recorded yet.</p>`;

  const upcomingHtml = upcoming.length
    ? `<table style="width:100%;border-collapse:collapse">${upcoming.map(upcomingRow).join('')}</table>`
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">No upcoming games.</p>`;

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Dashboard</h2>
</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
  ${kpi('Players', activePlayers, inactivePlayers > 0 ? `${inactivePlayers} inactive` : 'all active', 'var(--text-primary)', '/admin/players')}
  ${kpi('Teams', teams.length, '&nbsp;', 'var(--text-primary)')}
  ${kpi('Games Played', String(gamesPlayed), 'all time', 'var(--text-primary)', '/admin/games')}
  ${kpi('Outstanding', fmt(totalOutstanding), 'all time', totalOutstanding > 0 ? '#ef4444' : '#22c55e', '/admin/finance')}
</div>

${alerts.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">${alerts.join('')}</div>` : ''}

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
  <div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Recent Results</span>
        <a href="/admin/games" style="font-size:12px;color:var(--text-muted)">All games →</a>
      </div>
      <div style="padding:4px 16px 12px">${recentGamesHtml}</div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Upcoming</span>
        <a href="/admin/games" style="font-size:12px;color:var(--text-muted)">View →</a>
      </div>
      <div style="padding:4px 16px 12px">${upcomingHtml}</div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <span style="font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Quick Access</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:8px">
        ${[
          { href: '/admin/players',  label: 'Players',       sub: `${players.length} total` },
          { href: '/admin/games',    label: 'Games',         sub: upcoming.length ? `${upcoming.length} scheduled` : 'manage schedule' },
          { href: '/admin/ledger',   label: 'Ledger',        sub: pendingCount ? `${pendingCount} pending` : 'view all' },
          { href: '/admin/site',     label: 'Site Settings', sub: 'quotas & config' },
        ].map(({ href, label, sub }) => `
          <a href="${href}" style="display:flex;flex-direction:column;gap:3px;padding:12px;border-radius:8px;text-decoration:none;transition:background .15s" onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${escHtml(label)}</span>
            <span style="font-size:11px;color:var(--text-muted)">${escHtml(sub)}</span>
          </a>`).join('')}
      </div>
    </div>
  </div>
</div>`;
}
