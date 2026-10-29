// /admin/season/candidates: next season's candidates ranked by the draft criteria
// (lib/season-candidates.js). Read-only: one data grid grouped by priority group, each row
// opening to its full record. The row menu ticks contributions (setup, refereeing, other);
// nothing else here changes data. Temporarily under Season in the admin nav.
import { escHtml } from '../layout.js';
import { pageHeader, pageTabs, dataGrid, badge, avatar, banner, statStrip, facts } from './ui.js';
import { RULES, MARK_LABELS, PLUS_LABELS, CONTRIBUTION_KINDS } from '../../lib/season-candidates.js';

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
  const { target, seasons, candidates, ignorePayment } = data;
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
  // Not active online already shows in the Online column, so it has no tag of its own.
  const flags = r => [
    spot(r),
    r.discuss ? badge('Discuss', 'red') : '',
    r.exempt ? badge('Admin · no marks', 'gray') : '',
    ...r.pluses.map(p => badge(PLUS_LABELS[p], 'green')),
    ...r.marks.filter(m => m !== 'inactive').map(m => badge(MARK_LABELS[m], m === 'conduct' ? 'red' : 'amber')),
    noFeeHistory(r) ? badge('No fee history', 'gray') : '',
    r.isNew ? badge('New member', 'gray') : '',
    r.blockers.includes('Owes') ? badge(`Owes ${peso(r.balance)}`, 'red') : '',
    ignorePayment && r.balance >= RULES.owingToleranceAmt ? badge(`Owes ${peso(r.balance)} · not counted`, 'gray') : '',
    r.blockers.includes('Banned') ? badge('Banned', 'red') : '',
    r.blockers.includes('No account') ? badge('No account', 'gray') : '',
  ].filter(Boolean).join('');

  const why = r => {
    if (!r.eligible) return `Not eligible yet: ${r.blockers.map(b => (b === 'Owes' ? `owes ${peso(r.balance)}` : b.toLowerCase())).join(', ')}`;
    const last = seasons[seasons.length - 1]?.season;
    if (r.group === 1) return `Played Season ${last} and owes nothing`;
    if (r.group === 2) return `${r.papawisRuns} Papawis runs in the last 12 months`;
    if (r.isNew) return 'New member';
    return r.playedLast ? `Played under half of Season ${last}, under 4 Papawis runs` : 'Not in last season, under 4 Papawis runs';
  };
  const pct = a => Math.round((a.played / a.teamGames) * 100);
  const attendanceFact = r => (r.attendance
    ? `${r.attendance.played} of ${r.attendance.teamGames} team games (${pct(r.attendance)}%)${r.marks.includes('attendance') ? ', under two thirds' : ''}`
    : 'Not on a roster last season');
  const conductFact = r => {
    const c = r.conduct, parts = [];
    if (c.fines) parts.push(`${c.fines} approved fine${c.fines > 1 ? 's' : ''} (${c.fineList.join('; ')})`);
    if (c.maxTechs) parts.push(`most technicals in a season: ${c.maxTechs}`);
    if (c.dq) parts.push(`${c.dq} disqualification${c.dq > 1 ? 's' : ''}`);
    if (c.suspended) parts.push('a fine with a suspension');
    return parts.length ? escHtml(parts.join(' · ')) + (r.discuss ? ' · admin decides before a spot' : '') : 'Clean';
  };
  const helpFact = r => {
    const h = r.helped, parts = [];
    if (h.scored) parts.push(`scored ${h.scored} game${h.scored > 1 ? 's' : ''}`);
    for (const [k, label] of Object.entries(CONTRIBUTION_KINDS)) if (h[k]) parts.push(`${label.toLowerCase()} ×${h[k]}`);
    return parts.length ? escHtml(parts.join(' · ')) : 'None recorded';
  };

  const seasonCols = seasons.map((s, i) => ({
    key: `pay${s.season}`, label: `S${s.season} pay`, bare: i === seasons.length - 1, cell: r => payBadge(r.pay[i]),
  }));

  const grid = dataGrid({
    id: 'candidates', baseUrl: '/admin/season/candidates', query, keep: ignorePayment ? { nopay: '1' } : {},
    rows, rowKey: r => r.id, noun: ['player', 'players'], perPage: 200, minimal: true,
    views: [
      { key: 'eligible', label: 'Eligible', test: r => r.eligible },
      { key: 'g1', label: 'Group 1', test: r => r.eligible && r.group === 1 },
      { key: 'g2', label: 'Group 2', test: r => r.eligible && r.group === 2 },
      { key: 'g3', label: 'Group 3', test: r => r.eligible && r.group === 3 },
      { key: 'discuss', label: 'Discuss', test: r => r.discuss },
      { key: 'marks', label: 'Has marks', test: r => r.eligible && r.marks.length > 0 },
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
      { key: 'online', label: 'Online', num: true, nowrap: true, cell: r => `<span class="aui-cell__stack"><span><span class="aui-num">${r.activeWeeks}</span><span class="aui-muted">/${W}</span>${r.active ? ` ${badge('Active', 'green')}` : ''}</span><span class="aui-cell__sub">Site ${r.online.site} · App ${r.online.app}</span></span>` },
      ...seasonCols,
      { key: 'runs', label: 'Papawis', num: true, phone: false, cell: r => `<span class="aui-num">${r.papawisRuns}</span>` },
      { key: 'games', label: 'Games', num: true, phone: false, cell: r => `<span class="aui-num">${totalGames(r)}</span>` },
      { key: 'flags', label: 'Flags', bare: true, cell: r => `<span class="aui-cell__badges">${flags(r)}</span>` },
    ],
    expand: r => facts([
      ['Why this group', escHtml(why(r))],
      ['Online', `${r.activeWeeks} of the last ${W} weeks${r.active ? '' : ` (needs ${RULES.onlineWeeksNeeded}${r.isNew ? '; new members are exempt' : ''})`}`],
      ['Site and app', `Site ${r.online.site} weeks · App ${r.online.app} weeks · Actions ${r.online.action} weeks · last seen ${escHtml(r.online.lastSeen || `over ${W} weeks ago`)}`],
      ['League games', seasons.map(s => `Season ${s.season}: ${r.games[s.season] || 0}`).join(' · ')],
      ['Papawis runs', `${r.papawisRuns} in the last 12 months`],
      ['Marks', r.marks.length ? escHtml(r.marks.map(m => MARK_LABELS[m]).join(', ')) : 'None'],
      ['Pluses', r.pluses.length ? escHtml(r.pluses.map(p => PLUS_LABELS[p]).join(', ')) : 'None'],
      ['Attendance', escHtml(attendanceFact(r))],
      ['Conduct', conductFact(r)],
      ['Late cancellations', `${r.lateCancels} Papawis cancel${r.lateCancels === 1 ? '' : 's'} within ${RULES.lateCancelHours} hours of a run, last 12 months (admin removals included)`],
      ['Contribution', helpFact(r)],
      ...seasons.map((s, i) => payFacts(r.pay[i], s.season)),
      r.untaggedFees.length ? ['Untagged fee payments', `${r.untaggedFees.map(t => escHtml(`${peso(t.amount)} on ${t.date} (${t.category}) → Season ${t.season}`)).join(' · ')}. Counted as the season fee; worth fixing the tag in the ledger.`] : null,
      ['Balance now', r.balance > 0 ? escHtml(peso(r.balance)) : 'Nothing owed'],
      r.payFirst ? ['Pay first', 'Late or long gaps in past seasons: pays in full before the first game, no installment plan'] : null,
    ]),
    rowMenu: r => [
      { label: 'Admin player page', href: `/admin/players/${enc(r.id)}` },
      { label: 'Public profile', href: `/players/${enc(r.id)}`, external: true },
      'sep',
      ...Object.entries(CONTRIBUTION_KINDS).map(([kind, label]) => ({
        label: `Add contribution: ${label.toLowerCase()}`, post: `/admin/season/candidates/${enc(r.id)}/contribution`, body: { kind }, done: `${label} added for ${r.name}.`,
      })),
      r.contributions > r.helped.scored ? { label: 'Undo last contribution', post: `/admin/season/candidates/${enc(r.id)}/contribution`, body: { undo: true }, done: 'Removed.' } : null,
    ],
    empty: { title: 'No candidates', sub: 'No active players found.' },
  });

  const ongoing = seasons.filter(s => !s.over).map(s => `Season ${s.season}`);
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Season', title: `Season ${target} candidates`, sub: 'Ranked by the draft criteria. Only admins see this page.' })}
    ${pageTabs([
      { label: 'All criteria', href: '/admin/season/candidates', active: !ignorePayment },
      { label: 'Without payment', href: '/admin/season/candidates?nopay=1', active: ignorePayment },
    ])}
    ${ignorePayment ? banner('warn', 'Payment left out: owing doesn’t block anyone and nobody is marked pay first. Payment grades still show, for reference only.') : ''}
    ${banner('info', `Draft ranking. ${ongoing.length ? `${ongoing.join(', ')} isn't finished, so "Still paying" there isn't late yet. ` : ''}Online counts site visits from Oct 15 on (picks, comments, polls, chat, Papawis signups and app opens from the start), so website-only players may show low until January.`)}
    ${statStrip([
      { label: 'Spots', value: capacity ? String(capacity) : '—' },
      { label: 'Group 1', value: String(count(1)) },
      { label: 'Group 2', value: String(count(2)) },
      { label: 'Group 3', value: String(count(3)) },
      { label: 'Discuss', value: String(rows.filter(r => r.discuss).length) },
      { label: 'Pay first', value: String(eligible.filter(r => r.payFirst).length) },
      { label: 'Not eligible yet', value: String(rows.length - eligible.length) },
    ])}
    ${grid}
  </div>`;
}
