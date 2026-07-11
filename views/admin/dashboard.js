import { escHtml } from '../layout.js';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5L9 7l-4 4.5"/></svg>`;

const fmt     = n => `PHP ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

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

export function adminDashboardBody({
  players = [], teams = [], recentGames = [], upcoming = [],
  financeSummary = {}, pendingTx = [], underReview = 0, activePlayers = 0, gamesPlayed = 0,
} = {}) {
  const totalOutstanding = Number(financeSummary.total_outstanding ?? 0);
  const pendingCount     = pendingTx.length;
  const inactivePlayers  = players.length - activePlayers;

  const alerts = [];
  if (pendingCount > 0) alerts.push(
    `<a href="/admin/ledger" class="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/[.07] px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-brand/[.12] no-underline">
      <span class="h-2 w-2 shrink-0 rounded-full bg-brand"></span>
      <span><strong class="font-bold text-brand">${pendingCount} pending transaction${pendingCount === 1 ? '' : 's'}</strong> awaiting confirmation</span>
      <span class="ml-auto text-brand">→</span>
    </a>`
  );
  if (underReview > 0) alerts.push(
    `<a href="/admin/games" class="flex items-center gap-3 rounded-lg border border-error/30 bg-error/[.07] px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-error/[.12] no-underline">
      <span class="h-2 w-2 shrink-0 rounded-full bg-error"></span>
      <span><strong class="font-bold text-error">${underReview} game${underReview === 1 ? '' : 's'} under review</strong> needs attention</span>
      <span class="ml-auto text-error">→</span>
    </a>`
  );

  return `
<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Dashboard</h2>
</div>

${alerts.length ? `<div class="mb-6 flex flex-col gap-2.5">${alerts.join('')}</div>` : ''}

<div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
  ${kpi('Active Players', String(activePlayers), inactivePlayers > 0 ? `${inactivePlayers} inactive` : 'all active', false, '/admin/players')}
  ${kpi('Teams', String(teams.length), '', false)}
  ${kpi('Games Played', String(gamesPlayed), 'all time', false, '/admin/games')}
  ${kpi('Outstanding', fmt(totalOutstanding), 'all time', totalOutstanding > 0, '/admin/finance')}
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  <div class="lg:col-span-2 bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-admin-border">
      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recent Results</span>
      <a href="/admin/games" class="text-xs font-semibold text-slate-500 hover:text-brand transition-colors no-underline">All games →</a>
    </div>
    <div>
      ${recentGames.length
        ? recentGames.map(gameRow).join('')
        : `<p class="px-4 py-8 text-center text-sm text-slate-500">No games recorded yet.</p>`}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-admin-border">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Upcoming</span>
        <a href="/admin/games" class="text-xs font-semibold text-slate-500 hover:text-brand transition-colors no-underline">Schedule →</a>
      </div>
      <div>
        ${upcoming.length
          ? upcoming.map(upcomingRow).join('')
          : `<p class="px-4 py-8 text-center text-sm text-slate-500">No upcoming games.</p>`}
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quick Access</span>
      </div>
      <div class="grid grid-cols-2 gap-2.5 p-3">
        ${quickLink('/admin/players',  'Players',       `${players.length} total`)}
        ${quickLink('/admin/games',    'Games',         upcoming.length ? `${upcoming.length} scheduled` : 'manage')}
        ${quickLink('/admin/ledger',   'Ledger',        pendingCount ? `${pendingCount} pending` : 'view all')}
        ${quickLink('/admin/site',     'Site Settings', 'quotas & features')}
      </div>
    </div>
  </div>
</div>`;
}
