// /admin/season/candidates: next season's candidates ranked by the draft criteria
// (lib/season-candidates.js). Read-only: one data grid grouped by priority group, each row
// opening to its payment record. Temporarily under Season in the admin nav.
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, badge, avatar, banner, statStrip, facts } from './ui.js';
import { RULES } from '../../lib/season-candidates.js';

const peso = n => `₱${Math.round(n).toLocaleString('en-US')}`;
const GROUPS = { 1: 'Group 1 · Returning, in good standing', 2: 'Group 2 · Papawis regulars', 3: 'Group 3 · New or coming back' };
const PAY = {
  ontime: ['On time', 'green'],
  chased: ['Chased', 'amber'],
  owing:  ['Still paying', 'blue'],
  after:  ['After season', 'red'],
};
const payBadge = g => (g ? badge(PAY[g.grade][0], PAY[g.grade][1]) : '<span class="aui-muted">—</span>');

function payFacts(g, season) {
  if (!g) return [`Season ${season}`, '<span class="aui-muted">No season fee</span>'];
  const parts = [
    `${payBadge(g)} ${escHtml(g.plan === 'full' ? 'Paid in full plan' : 'Installment plan')}`,
    `${escHtml(peso(g.paid))} of ${escHtml(peso(g.charged))}`,
    g.settled ? `settled ${escHtml(g.settled)} (${g.daysToSettle} days)` : `${escHtml(peso(g.owing))} left`,
    `due ${escHtml(g.due)}`,
    `longest gap ${g.longestGap} days${g.longestGap > RULES.maxGapDays ? ' (over 30)' : ''}`,
  ];
  return [`Season ${season}`, parts.join(' · ')];
}

// data: loadSeasonCandidates() → { target, seasons, candidates }. capacity: season_roster_capacity.
export function adminSeasonCandidatesBody({ data, capacity = 0, query = {} } = {}) {
  const { target, seasons, candidates } = data;
  const rows = candidates;
  const eligible = rows.filter(r => r.eligible);
  const count = g => eligible.filter(r => r.group === g).length;
  const totalGames = r => seasons.reduce((s, x) => s + (r.games[x.season] || 0), 0);
  const enc = encodeURIComponent;
  const W = RULES.onlineWindowWeeks;

  const spot = r => {
    if (!r.eligible) return '';
    if (!capacity) return '';
    return r.rank <= capacity ? badge('In', 'green') : badge('Waitlist', 'blue');
  };
  // No season fee in either graded season (new, Papawis-only, or away): nothing for or against them.
  const noFeeHistory = r => !r.pay.some(Boolean);
  const flags = r => [
    spot(r),
    r.payFirst ? badge('Pay first', 'amber') : '',
    noFeeHistory(r) ? badge('No fee history', 'gray') : '',
    r.isNew ? badge('New member', 'gray') : '',
    r.blockers.includes('Owes') ? badge(`Owes ${peso(r.balance)}`, 'red') : '',
    r.blockers.includes('Banned') ? badge('Banned', 'red') : '',
    r.blockers.includes('No account') ? badge('No account', 'gray') : '',
  ].filter(Boolean).join('');

  const why = r => {
    if (!r.eligible) return `Not eligible yet: ${r.blockers.map(b => (b === 'Owes' ? `owes ${peso(r.balance)}` : b.toLowerCase())).join(', ')}`;
    if (r.group === 1) return `Played Season ${seasons[seasons.length - 1]?.season} and owes nothing`;
    if (r.group === 2) return `${r.papawisRuns} Papawis runs in the last 12 months`;
    return r.isNew ? 'New member' : 'Not in last season, under 4 Papawis runs';
  };

  const seasonCols = seasons.map((s, i) => ({
    key: `pay${s.season}`, label: `S${s.season} pay`, bare: i === seasons.length - 1, cell: r => payBadge(r.pay[i]),
  }));

  const grid = dataGrid({
    id: 'candidates', baseUrl: '/admin/season/candidates', query,
    rows, rowKey: r => r.id, noun: ['player', 'players'], perPage: 200, minimal: true,
    views: [
      { key: 'eligible', label: 'Eligible', test: r => r.eligible },
      { key: 'g1', label: 'Group 1', test: r => r.eligible && r.group === 1 },
      { key: 'g2', label: 'Group 2', test: r => r.eligible && r.group === 2 },
      { key: 'g3', label: 'Group 3', test: r => r.eligible && r.group === 3 },
      { key: 'payfirst', label: 'Pay first', test: r => r.payFirst },
      { key: 'nofee', label: 'No fee history', test: r => r.eligible && noFeeHistory(r) },
      { key: 'blocked', label: 'Not eligible yet', test: r => !r.eligible },
      { key: 'all', label: 'All', test: () => true },
    ],
    search: { placeholder: 'Search player', text: r => r.name },
    groupBy: r => (r.eligible ? GROUPS[r.group] : 'Not eligible yet'),
    columns: [
      { key: 'rank', label: '#', num: true, nowrap: true, cell: r => `<span class="aui-num">${r.rank}</span>` },
      { key: 'name', label: 'Player', primary: true, cell: r => `<span class="aui-who">${avatar(r.name, '', { size: 32, playerId: r.id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span><span class="aui-cell__sub">${escHtml(why(r))}</span></span></span>` },
      { key: 'online', label: 'Online', num: true, nowrap: true, cell: r => `<span class="aui-num">${r.activeWeeks}</span><span class="aui-muted">/${W}</span>${r.active ? ` ${badge('Active', 'green')}` : ''}` },
      ...seasonCols,
      { key: 'runs', label: 'Papawis', num: true, phone: false, cell: r => `<span class="aui-num">${r.papawisRuns}</span>` },
      { key: 'games', label: 'Games', num: true, phone: false, cell: r => `<span class="aui-num">${totalGames(r)}</span>` },
      { key: 'flags', label: 'Flags', bare: true, cell: r => `<span class="aui-cell__badges">${flags(r)}</span>` },
    ],
    expand: r => facts([
      ['Why this group', escHtml(why(r))],
      ['Online', `${r.activeWeeks} of the last ${W} weeks${r.active ? '' : ` (needs ${RULES.onlineWeeksNeeded}${r.isNew ? '; new members are exempt' : ''})`}`],
      ['League games', seasons.map(s => `Season ${s.season}: ${r.games[s.season] || 0}`).join(' · ')],
      ['Papawis runs', `${r.papawisRuns} in the last 12 months`],
      ...seasons.map((s, i) => payFacts(r.pay[i], s.season)),
      ['Balance now', r.balance > 0 ? escHtml(peso(r.balance)) : 'Nothing owed'],
      r.payFirst ? ['Pay first', 'Late or long gaps in past seasons: pays in full before the first game, no installment plan'] : null,
    ]),
    rowMenu: r => [
      { label: 'Admin player page', href: `/admin/players/${enc(r.id)}` },
      { label: 'Public profile', href: `/players/${enc(r.id)}`, external: true },
    ],
    empty: { title: 'No candidates', sub: 'No active players found.' },
  });

  const ongoing = seasons.filter(s => !s.over).map(s => `Season ${s.season}`);
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Season', title: `Season ${target} candidates`, sub: 'Ranked by the draft criteria. Only admins see this page.' })}
    ${banner('info', `Draft ranking. ${ongoing.length ? `${ongoing.join(', ')} isn't finished, so "Still paying" there isn't late yet. ` : ''}Online counts site visits from Oct 15 on (picks, comments, polls, chat, Papawis signups and app opens from the start), so website-only players may show low until January.`)}
    ${statStrip([
      { label: 'Spots', value: capacity ? String(capacity) : '—' },
      { label: 'Group 1', value: String(count(1)) },
      { label: 'Group 2', value: String(count(2)) },
      { label: 'Group 3', value: String(count(3)) },
      { label: 'Pay first', value: String(eligible.filter(r => r.payFirst).length) },
      { label: 'Not eligible yet', value: String(rows.length - eligible.length) },
    ])}
    ${grid}
  </div>`;
}
