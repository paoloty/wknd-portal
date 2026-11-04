// /admin/finance: Money → Summary (rewrite, 2026-11; mockup: claude.ai/artifact/Xv7BddznLYqJzLYUzPy9VS).
// What needs you first (payments to confirm), then the numbers, then who and what the money is.
// Balances are all-time, same rule as the Ledger; collected, fee progress and categories follow
// the season pick.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, section, kpi, progress, avatar, emptyState } from './ui.js';
import { confirmQueue, seasonSwitch, peso, canonCategory, fmtDate, plural, EPS } from './ledger.js';

const attr = s => escHtml(String(s ?? ''));
const seasonQs = season => encodeURIComponent(season ? String(season) : 'all');

function statusLine(pendingCount, owed) {
  const parts = [
    pendingCount ? `${plural(pendingCount, 'payment')} to confirm.` : 'Nothing to confirm.',
    owed > EPS ? `${peso(owed)} still owed.` : 'Nobody owes anything.',
  ];
  return parts.join(' ');
}

function feeProgress(quota, count, paid) {
  const target = quota * count;
  if (!target) return '';
  const pct = (paid / target) * 100;
  return section({
    title: 'Season fee collected',
    note: `· ${count} players × ${peso(quota)}`,
    bodyHtml: `<div class="aui-panel amny-fee">${progress(pct, { label: `${peso(paid)} of ${peso(target)} · ${Math.min(Math.round(pct), 100)}%` })}</div>`,
  });
}

function tableCard(headHtml, rowsHtml) {
  return `<div class="aui-table-wrap"><table class="aui-table"><thead><tr>${headHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function owesMost(top, colorById, season) {
  if (!top.length) return emptyState({ title: 'Nobody owes anything', done: true });
  return tableCard('<th>Player</th><th class="amny-num">Owes</th>', top.map(({ player, bal }) => {
    const name = displayPlayerName(player.name);
    const href = `/admin/ledger?season=${seasonQs(season)}&player=${encodeURIComponent(player.id)}`;
    return `<tr><td><a class="aui-who amny-link" href="${attr(href)}">${avatar(name, colorById[player.id] || '', { size: 26, playerId: player.id })}<span>${escHtml(name)}</span></a></td><td class="amny-num">${peso(bal)}</td></tr>`;
  }).join(''));
}

function byTeam(teams) {
  if (!teams.length) return emptyState({ title: 'No team balances yet' });
  return tableCard('<th>Team</th><th class="amny-num">Owes</th>', teams.map(t => {
    const owed = Number(t.outstanding) || 0;
    return `<tr><td><span class="aui-who"><span class="amny-dot" style="background:${attr(t.team_color || 'var(--text-muted)')}" aria-hidden="true"></span>${escHtml(t.team_name)}</span></td><td class="amny-num">${owed > EPS ? peso(owed) : 'Settled'}</td></tr>`;
  }).join(''));
}

// The same category can be stored in more than one spelling, so rows merge on the ledger's
// names. Paying more than a category's charges (Papawis is often paid with no charge row) isn't
// "owing a negative": it shows as nothing owed.
function byCategory(totals) {
  const merged = new Map();
  for (const c of totals) {
    const label = canonCategory(c.category) || c.category || 'No category';
    const row = merged.get(label) || { label, charged: 0, paid: 0 };
    row.charged += Number(c.charged) || 0;
    row.paid += Number(c.paid) || 0;
    merged.set(label, row);
  }
  const rows = [...merged.values()].filter(r => r.charged > EPS || r.paid > EPS).sort((a, b) => (b.charged + b.paid) - (a.charged + a.paid));
  if (!rows.length) return emptyState({ title: 'No payments or charges this season' });
  return tableCard('<th>Category</th><th class="amny-num">Charged</th><th class="amny-num">Paid</th><th class="amny-num">Owed</th>', rows.map(r => {
    const owed = r.charged - r.paid;
    return `<tr><td class="aui-cell__title">${escHtml(r.label)}</td><td class="amny-num">${peso(r.charged)}</td><td class="amny-num">${peso(r.paid)}</td><td class="amny-num">${owed > EPS ? peso(owed) : '₱0'}</td></tr>`;
  }).join(''));
}

function recentActivity(list, season) {
  if (!list.length) return emptyState({ title: 'No activity yet' });
  return tableCard('<th>Date</th><th>Player</th><th class="amny-desk">For</th><th class="amny-num">Amount</th>', list.map(tx => {
    const name = displayPlayerName(tx.player_name || '');
    const charge = tx.type === 'charge';
    const href = `/admin/ledger?season=${seasonQs(season)}&player=${encodeURIComponent(tx.player_id)}`;
    return `<tr><td class="amny-nowrap">${escHtml(fmtDate(tx.date))}</td><td><a class="amny-link" href="${attr(href)}">${escHtml(name)}</a></td><td class="amny-desk">${escHtml(tx.notes || canonCategory(tx.category) || tx.category || '')}</td><td class="amny-num ${charge ? '' : 'aui-pos'}">${charge ? '' : '+'}${peso(tx.amount)}</td></tr>`;
  }).join(''));
}

export function adminFinanceDashBody({ seasons = [], season = '', summary = {}, quota = 0, quotaPlayerCount = 0, quotaPaid = 0, balMap = {}, players = [], allPlayers = [], pending = [], categoryTotals = [], teamTotals = [], recentTx = [], colorById = {} }) {
  const owing = allPlayers.map(p => ({ player: p, bal: Number(balMap[p.id]?.balance) || 0 })).filter(x => x.bal > EPS).sort((a, b) => b.bal - a.bal);
  const owed = owing.reduce((t, x) => t + x.bal, 0);
  const paid = Number(summary.total_paid) || 0;
  const charged = Number(summary.total_charged) || 0;
  const settled = players.filter(p => {
    const b = balMap[p.id];
    return b && Number(b.balance) <= EPS && (Number(b.charged) > 0 || Number(b.paid) > 0);
  }).length;

  const kpis = [
    kpi({ label: 'Still owed', value: peso(owed), delta: `${plural(owing.length, 'player')} · all time` }),
    season ? kpi({ label: 'Collected', value: peso(paid), delta: charged > 0 ? `${Math.round((paid / charged) * 100)}% of what was charged` : `Season ${season}` }) : '',
    season && players.length ? kpi({ label: 'Fully paid', value: String(settled), of: `/ ${players.length}`, delta: `Season ${season}` }) : '',
  ].join('');

  return `<div class="aui-page amny">
    ${pageHeader({
      title: 'Money',
      sub: statusLine(pending.length, owed),
      actionsHtml: seasonSwitch(s => `/admin/finance?season=${encodeURIComponent(s)}`, seasons, season),
    })}
    ${section({ title: 'To confirm', note: '· payments players sent in, oldest first', bodyHtml: confirmQueue(pending, colorById, { season }) })}
    <div class="aui-kpis">${kpis}</div>
    ${season ? feeProgress(quota, quotaPlayerCount, quotaPaid) : ''}
    <div class="amny-two">
      ${section({ title: 'Owes the most', note: `· top ${Math.min(owing.length, 5)} of ${owing.length}`, bodyHtml: owesMost(owing.slice(0, 5), colorById, season) })}
      ${section({ title: 'By team', bodyHtml: byTeam(teamTotals) })}
    </div>
    ${season ? section({ title: 'By category', note: `· Season ${season}`, bodyHtml: byCategory(categoryTotals) }) : ''}
    ${section({ title: 'Recent activity', bodyHtml: recentActivity(recentTx, season) })}
  </div>`;
}
