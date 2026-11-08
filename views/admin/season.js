// /admin/season: Season → Set up (rewrite, 2026-11; mockup: claude.ai/artifact/Xv7BddznLYqJzLYUzPy9VS).
// The details for the season being set up, with one Save; opening sign-ups; moving on to the next
// season. Saves through /admin/season/settings and /admin/season/start.
import { escHtml } from '../layout.js';
import { pageHeader, section, field, fieldGrid, button, toggleRow, needsYou, badge } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

export function adminSeasonBody({
  sigSeason = '', sigOpen = false, deadline = '', portalSeason = '', autoSeason = 3, draftStatus = '',
  count = 0, confirmedCount = 0,
  seasonFormat = '', quotaAmount = '', jerseyTopPrice = '', jerseyShortPrice = '', teamCount = '4',
  jerseySurchargeStep = '50', jerseyPocketsPrice = '100', seasonRosterCapacity = '',
  allSeasons = [], jerseyCutPrice = '50', payments = null,
} = {}) {
  const started = draftStatus === 'started';
  const known = [...new Set(allSeasons.map(String))].sort((a, b) => Number(b) - Number(a));
  const newest = Math.max(Number(autoSeason) || 0, Number(sigSeason) || 0, ...known.map(Number));
  const nextSeason = String(newest + 1);

  const status = !sigSeason ? 'No season is being set up yet.'
    : started ? `Season ${sigSeason} has started. ${confirmedCount} players, teams locked.`
    : sigOpen ? `Sign-ups are open: ${count} in, ${confirmedCount} confirmed.`
    : count ? `Sign-ups are closed: ${count} in, ${confirmedCount} confirmed.`
    : 'Set up, not open yet.';

  const needs = [
    sigSeason && !started && !(Number(quotaAmount) > 0) ? { title: 'Set the season fee', sub: 'Players are charged this when the season starts.', href: '#season-details', label: 'Set it', hot: true } : null,
    sigSeason && !started && !sigOpen && !count && Number(quotaAmount) > 0 ? { title: 'Sign-ups aren’t open yet', sub: 'Members can’t sign up until you open them.', href: '#season-signups', label: 'Open', hot: true } : null,
  ];

  const details = `<form class="aui-panel aset-form" id="season-details-form" data-json-action="/admin/season/settings" data-done="Season details saved.">
    ${fieldGrid(`
      ${field({ label: 'Season format', name: 'season_format', type: 'textarea', rows: 2, value: seasonFormat, wide: true, placeholder: 'Double Round Robin · Top 4 Twice-to-Beat · Finals Best of 3', help: 'Shown to members when they sign up. Separate points with · for a list.' })}
      ${field({ label: 'Season fee', name: 'season_quota_amount', type: 'money', value: quotaAmount })}
      ${field({ label: 'Number of teams', name: 'season_team_count', type: 'number', value: teamCount || 4, attrs: 'min="2" max="8"' })}
      ${field({ label: 'Roster size', name: 'season_roster_capacity', type: 'number', value: seasonRosterCapacity, help: 'Optional.', attrs: 'min="0"' })}
      ${field({ label: 'Jersey top', name: 'jersey_top_price', type: 'money', value: jerseyTopPrice })}
      ${field({ label: 'Jersey shorts', name: 'jersey_short_price', type: 'money', value: jerseyShortPrice })}
      ${field({ label: 'Pockets add-on', name: 'jersey_pockets_price', type: 'money', value: jerseyPocketsPrice })}
      ${field({ label: 'NBA cut', name: 'jersey_nba_cut_price', type: 'money', value: jerseyCutPrice, help: 'On the top only.' })}
      ${field({ label: 'Size surcharge', name: 'jersey_surcharge_step', type: 'money', value: jerseySurchargeStep, help: 'Per size, from 2XL up.' })}
      ${field({ label: 'Sign-up deadline', name: 'season_signup_deadline', value: deadline, placeholder: 'e.g. February 14, 2027', help: 'Optional.' })}
      ${field({ label: 'Season shown on the site', name: 'portal_season', type: 'select', value: portalSeason, options: [['', `Automatic (Season ${autoSeason})`], ...known.map(s => [s, `Season ${s}`])] })}
    `)}
    <div class="aset-form__save">${button('Save', { kind: 'primary', type: 'submit' })}</div>
  </form>`;

  const signupsBlock = sigSeason && !started ? section({
    id: 'season-signups', title: 'Sign-ups',
    bodyHtml: `<div class="aui-panel">${toggleRow({ label: 'Open to members', help: 'Members see a sign-up banner on every page.', name: 'season_signup_open', on: sigOpen, post: '/admin/season/settings', setting: true, reload: true })}</div>`,
  }) : '';

  const options = [...new Set([nextSeason, ...known, sigSeason].filter(Boolean))].map(s => [s, `Season ${s}${s === nextSeason ? ' (next)' : ''}${s === sigSeason ? ' (current)' : ''}`]);
  const nextBlock = section({
    title: started || !sigSeason ? `Start setting up Season ${nextSeason}` : 'Switch to another season',
    bodyHtml: `<form class="aui-panel aset-next" data-json-action="/admin/season/start" data-done="Now setting up that season." data-confirm data-confirm-title="Set up this season?" data-confirm-body="Sign-ups close, the deadline clears and the team builder opens for the season you picked. Nobody is emailed or charged." data-confirm-send="Set it up">
      <div class="aset-next__text"><div class="aui-cell__title">${started ? 'When you’re ready for the next season' : 'Move the sign-up pages to a different season'}</div><div class="aui-cell__sub">Nothing goes out to players until you open sign-ups.</div></div>
      <div class="aset-next__go">${field({ label: 'Season', name: 'season', type: 'select', value: started || !sigSeason ? nextSeason : sigSeason, options })}${button('Set up', { kind: started || !sigSeason ? 'primary' : 'secondary', type: 'submit' })}</div>
    </form>`,
  });

  return `<div class="aui-page aset-page">
    ${pageHeader({ title: sigSeason ? `Season ${sigSeason}` : 'Season', sub: status })}
    ${needsYou(needs)}
    ${started ? '' : signupsBlock}
    ${paymentsBlock(payments)}
    ${section({ id: 'season-details', title: 'Details', note: sigSeason ? `· Season ${sigSeason}` : '', bodyHtml: details })}
    ${nextBlock}
  </div>`;
}

const peso = n => `₱${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtDay = d => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

// Season 5 payments (lib/season-signup.js): confirmations start everyone's payment clock at once
// (dates locked, jersey + fee charged, players told); a missed first payment frees the spot, with
// the top waitlisted player from Candidates suggested; 14+ days late is for an admin.
// payments: { toConfirm, onPlan, overdue: [{ signupId, name, due, amount, suggest }], late: [{ name, due, amount, daysLate }] }
function paymentsBlock(p) {
  if (!p || (!p.toConfirm && !p.onPlan)) return '';
  const send = p.toConfirm ? `<form class="aui-panel aset-next" data-json-action="/admin/season/confirmations/send" data-confirm data-confirm-title="Send ${p.toConfirm} confirmation${p.toConfirm === 1 ? '' : 's'}?" data-confirm-body="Each confirmed player's payment dates are set from today, their jersey and season fee are charged, and they're told by bell, push and email." data-confirm-send="Send">
      <div class="aset-next__text"><div class="aui-cell__title">${p.toConfirm} confirmed, not told yet</div><div class="aui-cell__sub">Sends their payment dates and starts the clock: first payment on the first 15th or 30th at least 5 days from today.</div></div>
      <div class="aset-next__go">${button('Send confirmations', { kind: 'primary', type: 'submit' })}</div>
    </form>` : '';
  const row = (title, sub, action = '') => `<div class="aset-next"><div class="aset-next__text"><div class="aui-cell__title">${title}</div><div class="aui-cell__sub">${sub}</div></div>${action ? `<div class="aset-next__go">${action}</div>` : ''}</div>`;
  const overdue = p.overdue.map(o => row(`${escHtml(o.name)} ${badge('Missed first payment', 'red')}`,
    `${peso(o.amount)} was due ${fmtDay(o.due)}. ${o.suggest ? `Next in line: ${escHtml(o.suggest.name)}.` : 'Nobody is waiting.'}`,
    o.suggest ? `<form data-json-action="/admin/season/signups/${attr(o.signupId)}/replace" data-confirm data-confirm-title="Give the spot to ${attr(o.suggest.name)}?" data-confirm-body="${attr(o.name)} is withdrawn. ${attr(o.suggest.name)} is confirmed and told their payment dates straight away." data-confirm-send="Give the spot"><input type="hidden" name="to" value="${attr(o.suggest.signupId)}">${button('Give the spot', { kind: 'primary', type: 'submit' })}</form>` : '')).join('');
  const late = p.late.map(l => row(`${escHtml(l.name)} ${badge(`${l.daysLate} days late`, 'amber')}`, `${peso(l.amount)} was due ${fmtDay(l.due)}. Reminders have gone out; this one needs you.`)).join('');
  return section({
    id: 'season-payments', title: 'Payments', note: p.onPlan ? `· ${p.onPlan} on a plan` : '',
    bodyHtml: `${send}${overdue || late ? `<div class="aui-panel">${overdue}${late}</div>` : (p.onPlan ? '<div class="aui-panel"><div class="aui-cell__sub">Everyone on a plan is up to date.</div></div>' : '')}`,
  });
}
