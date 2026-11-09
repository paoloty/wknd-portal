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
  allSeasons = [], jerseyCutPrice = '50', payments = null, volunteers = [], gameFace = null,
  noPhoto = [], saidNo = [], deadlineReads = null,
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
    gameFace?.entries.some(e => e.state === 'waiting') && gameFace.phase === 'entries' ? { title: 'Game Face entries to check', sub: 'Approve each photo before it goes public.', href: '#season-gameface', label: 'Check' } : null,
    gameFace && gameFace.phase === 'entries' && !gameFace.signupsOpen && gameFace.live ? { title: 'Open Game Face voting', sub: 'Sign-ups are closed, so voting can start.', href: '#season-gameface', label: 'Open', hot: true } : null,
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
      ${field({ label: 'Sign-up deadline', name: 'season_signup_deadline', value: deadline, placeholder: 'e.g. February 14, 2027',
        help: !deadline ? 'Optional.' : deadlineReads ? `Reads as ${deadlineReads}. The countdown and reminders run to the end of that day.` : '',
        error: deadline && !deadlineReads ? 'Can’t read this as a date, so there’s no countdown or reminders. Write it like “December 15, 2026”.' : '' })}
      ${field({ label: 'Season shown on the site', name: 'portal_season', type: 'select', value: portalSeason, options: [['', `Automatic (Season ${autoSeason})`], ...known.map(s => [s, `Season ${s}`])] })}
    `)}
    <div class="aset-form__save">${button('Save', { kind: 'primary', type: 'submit' })}</div>
  </form>`;

  const signupsBlock = sigSeason && !started ? section({
    id: 'season-signups', title: 'Sign-ups',
    bodyHtml: `<div class="aui-panel">${toggleRow({ label: 'Open to members', help: 'Sign-ups happen in the app. Active members are told by bell, push and email within the hour, and see the popup, Home card and site banners until they sign up.', name: 'season_signup_open', on: sigOpen, post: '/admin/season/settings', setting: true, reload: true })}</div>`,
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
    ${volunteersBlock(volunteers)}
    ${noPhotoBlock(noPhoto)}
    ${saidNoBlock(saidNo)}
    ${gameFaceBlock(gameFace)}
    ${section({ id: 'season-details', title: 'Details', note: sigSeason ? `· Season ${sigSeason}` : '', bodyHtml: details })}
    ${nextBlock}
  </div>`;
}

// Who offered to help on their sign-up (Step 4), by role. Saying yes isn't a plus by itself:
// the Contributed plus comes from actually helping (Candidates' row menu).
// volunteers: [{ label, people: [{ name, note }] }]
function volunteersBlock(groups) {
  if (!groups.length) return '';
  return section({
    id: 'season-volunteers', title: 'Volunteers', note: '· from sign-ups',
    bodyHtml: `<div class="aui-panel">${groups.map(g => `<div class="aset-next"><div class="aset-next__text"><div class="aui-cell__title">${escHtml(g.label)} <span class="aui-muted">${g.people.length}</span></div><div class="aui-cell__sub">${g.people.map(p => escHtml(p.note ? `${p.name} (“${p.note}”)` : p.name)).join(', ')}</div></div></div>`).join('')}</div>`,
  });
}

// The Game Face contest (server.js gameFaceAdmin): approve or hide each entry while sign-ups
// run, open voting once they close, then the winners. Only approved photos go public.
// g: { phase, signupsOpen, opens, closes, voters, live, entries: [{ id, name, pose, state, photo, winner }] }
const GF_BADGE = { waiting: ['Waiting', 'amber'], approved: ['In', 'green'], hidden: ['Hidden', 'gray'] };
function gameFaceBlock(g) {
  if (!g) return '';
  const act = (e, what, kind) => `<form data-json-action="/admin/season/game-face/${attr(e.id)}/${what}">${button(what === 'approve' ? 'Approve' : 'Hide', { kind, type: 'submit' })}</form>`;
  const rows = g.entries.map(e => `<div class="aset-next"><span class="aui-photo aui-photo--sm"><img src="${attr(e.photo)}" alt="" loading="lazy"></span>
    <div class="aset-next__text"><div class="aui-cell__title">${escHtml(e.name)} ${e.winner ? badge('Winner', 'amber') : g.phase === 'over' && e.state === 'approved' ? badge('Entered') : badge(...GF_BADGE[e.state])}</div><div class="aui-cell__sub">${escHtml(e.pose)}</div></div>
    ${g.phase === 'over' ? '' : `<div class="aset-next__go">${e.state !== 'approved' ? act(e, 'approve', e.state === 'waiting' ? 'primary' : 'secondary') : ''}${e.state !== 'hidden' ? act(e, 'hide', 'secondary') : ''}</div>`}</div>`).join('');
  const head = g.phase === 'entries'
    ? `<form class="aset-next" data-json-action="/admin/season/game-face/open" data-confirm data-confirm-title="Open voting?" data-confirm-body="Voting runs for 3 days. A post goes on top of the app's Home and everyone is told." data-confirm-send="Open voting">
        <div class="aset-next__text"><div class="aui-cell__title">${g.live} in the contest</div><div class="aui-cell__sub">${g.signupsOpen ? 'Voting opens once sign-ups close.' : 'Sign-ups are closed. Open voting for 3 days.'}</div></div>
        <div class="aset-next__go">${button('Open voting', { kind: g.signupsOpen ? 'secondary' : 'primary', type: 'submit', attrs: g.signupsOpen || !g.live ? 'disabled' : '' })}</div></form>`
    : g.phase === 'voting'
      ? `<div class="aset-next"><div class="aset-next__text"><div class="aui-cell__title">Voting until ${escHtml(g.closes)}</div><div class="aui-cell__sub">${g.voters} member${g.voters === 1 ? '' : 's'} voted so far. Results stay hidden until it closes.</div></div></div>`
      : `<form class="aset-next" data-json-action="/admin/season/game-face/finish"><div class="aset-next__text"><div class="aui-cell__title">Voting closed ${escHtml(g.closes)}</div><div class="aui-cell__sub">${g.voters} member${g.voters === 1 ? '' : 's'} voted. Winners get a free Papawis run; only their photos stay up.</div></div>${g.entries.some(e => e.winner) ? '' : `<div class="aset-next__go">${button('Name the winners', { kind: 'primary', type: 'submit' })}</div>`}</form>`;
  return section({
    id: 'season-gameface', title: 'Game Face contest', note: `· ${g.entries.length} entr${g.entries.length === 1 ? 'y' : 'ies'}`,
    bodyHtml: `<div class="aui-panel">${head}${rows}</div>`,
  });
}

// Sign-ups sent without a game face ("Add it later"): ask each player (a bell and a push that opens
// their photo screen), or all of them. list: [{ id, name, sent, asked }] (server.js seasonNoPhotoAdmin)
const shortWhen = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
function noPhotoBlock(list) {
  if (!list?.length) return '';
  const rows = list.map(x => `<div class="aset-next"><div class="aset-next__text"><div class="aui-cell__title">${escHtml(x.name)} ${badge('No game face', 'amber')}</div>
      <div class="aui-cell__sub">Sent ${shortWhen(x.sent)}${x.asked ? ` · asked ${shortWhen(x.asked)}` : ''}</div></div>
    <div class="aset-next__go"><form data-json-action="/admin/season/game-face-ask"><input type="hidden" name="id" value="${attr(x.id)}">${button(x.asked ? 'Ask again' : 'Ask for it', { kind: x.asked ? 'secondary' : 'primary', type: 'submit' })}</form></div></div>`).join('');
  const all = list.length > 1 ? `<form class="aset-next" data-json-action="/admin/season/game-face-ask" data-confirm data-confirm-title="Ask all ${list.length}?" data-confirm-body="Each gets a bell and a push asking for their game face." data-confirm-send="Ask all"><div class="aset-next__text"><div class="aui-cell__sub">Each gets a bell and a push that opens their photo screen.</div></div><div class="aset-next__go">${button(`Ask all ${list.length}`, { kind: 'secondary', type: 'submit' })}</div></form>` : '';
  return section({ id: 'season-nophoto', title: 'Sign-ups without a game face', note: `· ${list.length}`, bodyHtml: `<div class="aui-panel">${rows}${all}</div>` });
}

// Tapped "Not this season" on the sign-up popup (and not signed up since): they get no more
// popups, banners or reminders, so here admins can see who to follow up with. list: [{ name, at }]
function saidNoBlock(list) {
  if (!list?.length) return '';
  const rows = list.map(x => `<div class="aset-next"><div class="aset-next__text"><div class="aui-cell__title">${escHtml(x.name)}</div><div class="aui-cell__sub">Said so ${shortWhen(x.at)}</div></div></div>`).join('');
  return section({ id: 'season-saidno', title: 'Said not this season', note: `· ${list.length} · no more reminders`, bodyHtml: `<div class="aui-panel">${rows}</div>` });
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
