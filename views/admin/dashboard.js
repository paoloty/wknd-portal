import { escHtml } from '../layout.js';
import { formatTimeRange } from '../utils.js';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5L9 7l-4 4.5"/></svg>`;

const fmt     = n => `PHP ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

// "5m ago" / "3h ago" / "2d ago" / falls back to a short date past a week — same
// relative-time shape readers already expect from the notification bell on the public site.
function timeAgo(ts) {
  const diffMs = Date.now() - Number(ts || 0);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function actorBadge(type) {
  if (type === 'super') return `<span class="text-[9px] font-bold uppercase tracking-wide text-brand bg-brand/10 px-1.5 py-0.5 rounded">Super</span>`;
  if (type === 'player') return `<span class="text-[9px] font-bold uppercase tracking-wide text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">Player</span>`;
  return `<span class="text-[9px] font-bold uppercase tracking-wide text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">Admin</span>`;
}

function kpi(label, value, sub = '', accent = false, href = '') {
  const inner = `
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(label)}</div>
    <div class="mt-2 font-saira text-3xl font-extrabold leading-none ${accent ? 'text-brand' : 'text-slate-100'}">${value}</div>
    ${sub ? `<div class="mt-1.5 text-xs text-slate-500">${escHtml(sub)}</div>` : ''}`;
  const card = 'block bg-admin-surface border border-admin-border rounded-lg p-5';
  return href
    ? `<a href="${href}" class="${card} transition-colors hover:border-admin-border2 no-underline">${inner}</a>`
    : `<div class="${card}">${inner}</div>`;
}

function gameRow(g) {
  const aWon = g.team_a_score > g.team_b_score;
  const bWon = g.team_b_score > g.team_a_score;
  const isPO = g.game_type === 'playoff';
  return `<div class="flex items-center gap-3 px-4 py-3 border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
    <span class="w-16 shrink-0 text-xs text-slate-500 whitespace-nowrap">${fmtDate(g.date)}${isPO ? `<span class="ml-1.5 text-[9px] font-bold text-brand">PO</span>` : ''}</span>
    <span class="flex-1 min-w-0 flex items-center gap-2 text-sm truncate">
      <span class="truncate ${aWon ? 'font-bold text-slate-100' : 'text-slate-400'}">${escHtml(g.team_a_name)}</span>
      <span class="font-saira font-bold text-slate-500 shrink-0">${g.team_a_score}–${g.team_b_score}</span>
      <span class="truncate ${bWon ? 'font-bold text-slate-100' : 'text-slate-400'}">${escHtml(g.team_b_name)}</span>
    </span>
    <a href="/admin/games/${escHtml(g.id)}" class="agm-edit-link shrink-0">Edit ${ICON_CHEVRON_R}</a>
  </div>`;
}

function upcomingRow(g) {
  return `<div class="flex items-center gap-3 px-4 py-3 border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
    <span class="w-16 shrink-0 text-xs text-slate-500 whitespace-nowrap">${fmtDate(g.date)}</span>
    <span class="flex-1 min-w-0 flex items-center gap-2 text-sm truncate text-slate-300">
      <span class="truncate">${escHtml(g.team_a_name)}</span>
      <span class="text-xs text-slate-500 shrink-0">vs</span>
      <span class="truncate">${escHtml(g.team_b_name)}</span>
    </span>
    <a href="/admin/games/${escHtml(g.id)}" class="agm-edit-link shrink-0">Edit ${ICON_CHEVRON_R}</a>
  </div>`;
}

function quickLink(href, label, sub) {
  return `<a href="${href}" class="flex flex-col justify-center gap-1 bg-admin-surface2 border border-admin-border2 rounded-lg px-4 py-3.5 transition-colors hover:border-brand/50 no-underline">
    <span class="text-sm font-semibold text-slate-100">${escHtml(label)}</span>
    <span class="text-xs text-slate-500">${escHtml(sub)}</span>
  </a>`;
}

function alertPill(href, color, count, label) {
  const cls = color === 'error'
    ? { wrap: 'border-error/30 bg-error/[.07] hover:bg-error/[.12]', dot: 'bg-error', text: 'text-error' }
    : { wrap: 'border-brand/30 bg-brand/[.07] hover:bg-brand/[.12]', dot: 'bg-brand', text: 'text-brand' };
  return `<a href="${href}" class="flex items-center gap-3 rounded-lg border ${cls.wrap} px-4 py-3 text-sm text-slate-200 transition-colors no-underline">
    <span class="h-2 w-2 shrink-0 rounded-full ${cls.dot}"></span>
    <span><strong class="font-bold ${cls.text}">${count} ${label}</strong></span>
    <span class="ml-auto ${cls.text}">→</span>
  </a>`;
}

function panelHeader(label, linkHref, linkLabel) {
  return `<div class="flex items-center justify-between px-4 py-3 border-b border-admin-border">
    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(label)}</span>
    ${linkHref ? `<a href="${linkHref}" class="text-xs font-semibold text-slate-500 hover:text-brand transition-colors no-underline">${escHtml(linkLabel)} →</a>` : ''}
  </div>`;
}

function papawisSnapshot(game) {
  if (!game) {
    return `<p class="px-4 py-8 text-center text-sm text-slate-500">No upcoming Papawis game.</p>`;
  }
  const timeRange = formatTimeRange(game.start_time, game.end_time);
  const slotsLeft = Math.max(0, Number(game.max_slots || 0) - Number(game.confirmed_count || 0));
  return `<div class="px-4 py-3.5">
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-sm font-semibold text-slate-100 truncate">${escHtml(game.title || fmtDate(game.date))}</span>
      <span class="text-xs text-slate-500 shrink-0">${fmtDate(game.date)}</span>
    </div>
    ${timeRange || game.location ? `<div class="mt-1 text-xs text-slate-500">${[timeRange, game.location].filter(Boolean).map(escHtml).join(' · ')}</div>` : ''}
    <div class="mt-3 flex items-center gap-4 text-xs">
      <span class="text-slate-300"><strong class="font-saira text-sm text-brand">${game.confirmed_count || 0}</strong>/${game.max_slots || 0} confirmed</span>
      ${game.waitlist_count > 0 ? `<span class="text-slate-500">${game.waitlist_count} waitlisted</span>` : ''}
      ${slotsLeft > 0 ? `<span class="text-slate-500 ml-auto">${slotsLeft} open</span>` : `<span class="text-error ml-auto">full</span>`}
    </div>
  </div>`;
}

function activityRow(l) {
  let detailBit = '';
  try {
    const d = JSON.parse(l.details || '{}');
    const entries = Object.entries(d).filter(([k]) => k !== 'password' && k !== 'confirm');
    if (entries.length) detailBit = escHtml(String(entries[0][1])).slice(0, 40);
  } catch {}
  return `<div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-admin-border/50 last:border-b-0 text-sm">
    ${actorBadge(l.actor_type)}
    <span class="text-slate-300 truncate">${escHtml(l.actor)}</span>
    <span class="text-slate-600 font-mono text-xs truncate">${escHtml(l.path)}</span>
    ${detailBit ? `<span class="text-slate-500 text-xs truncate hidden sm:inline">${detailBit}</span>` : ''}
    <span class="ml-auto shrink-0 text-xs text-slate-600 whitespace-nowrap">${timeAgo(l.created_at)}</span>
  </div>`;
}

export function adminDashboardBody({
  players = [], teams = [], recentGames = [], upcoming = [],
  financeSummary = {}, pendingTx = [], underReview = 0, activePlayers = 0, gamesPlayed = 0,
  pendingUsers = 0, openFineCases = [], nextPapawis = null, isSuperAdmin = false, recentActivity = [],
} = {}) {
  const totalOutstanding = Number(financeSummary.total_outstanding ?? 0);
  const pendingCount     = pendingTx.length;
  const inactivePlayers  = players.length - activePlayers;
  const openFineCount    = openFineCases.length;

  const alerts = [];
  if (pendingUsers > 0) alerts.push(alertPill('/admin/users', 'brand', pendingUsers, `pending approval${pendingUsers === 1 ? '' : 's'}`));
  if (openFineCount > 0) alerts.push(alertPill('/admin/fines', 'error', openFineCount, `open fine case${openFineCount === 1 ? '' : 's'} awaiting a decision`));
  if (pendingCount > 0) alerts.push(alertPill('/admin/ledger', 'brand', pendingCount, `pending transaction${pendingCount === 1 ? '' : 's'} awaiting confirmation`));
  if (underReview > 0) alerts.push(alertPill('/admin/games', 'error', underReview, `game${underReview === 1 ? '' : 's'} under review`));

  return `
<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Dashboard</h2>
</div>

${alerts.length ? `<div class="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">${alerts.join('')}</div>` : ''}

<div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
  ${kpi('Active Players', String(activePlayers), inactivePlayers > 0 ? `${inactivePlayers} inactive` : 'all active', false, '/admin/players')}
  ${kpi('Teams', String(teams.length), '', false)}
  ${kpi('Games Played', String(gamesPlayed), 'all time', false, '/admin/games')}
  ${kpi('Outstanding', fmt(totalOutstanding), 'all time', totalOutstanding > 0, '/admin/finance')}
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <div class="lg:col-span-2 bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    ${panelHeader('Recent Results', '/admin/games', 'All games')}
    <div>
      ${recentGames.length
        ? recentGames.map(gameRow).join('')
        : `<p class="px-4 py-8 text-center text-sm text-slate-500">No games recorded yet.</p>`}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      ${panelHeader('Upcoming', '/admin/games', 'Schedule')}
      <div>
        ${upcoming.length
          ? upcoming.slice(0, 4).map(upcomingRow).join('')
          : `<p class="px-4 py-8 text-center text-sm text-slate-500">No upcoming games.</p>`}
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      ${panelHeader('Papawis', '/admin/papawis', 'Manage')}
      ${papawisSnapshot(nextPapawis)}
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quick Access</span>
      </div>
      <div class="grid grid-cols-2 gap-2.5 p-3">
        ${quickLink('/admin/players',  'Players',       `${players.length} total`)}
        ${quickLink('/admin/games',    'Games',         upcoming.length ? `${upcoming.length} scheduled` : 'manage')}
        ${quickLink('/admin/users',    'Users',         pendingUsers ? `${pendingUsers} pending` : 'view all')}
        ${quickLink('/admin/papawis',  'Papawis',       'manage games')}
        ${quickLink('/admin/ledger',   'Ledger',        pendingCount ? `${pendingCount} pending` : 'view all')}
        ${quickLink('/admin/finance',  'Finance',       'overview & payouts')}
      </div>
    </div>
  </div>
</div>

${isSuperAdmin && recentActivity.length ? `
<div class="mt-4 bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  ${panelHeader('Recent Activity', '/admin/logs', 'All logs')}
  <div>${recentActivity.map(activityRow).join('')}</div>
</div>` : ''}`;
}
