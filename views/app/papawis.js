// The Papawis tab (/app/papawis): each upcoming run as one card (cover, live countdown, a
// seat per slot, the facts, one action), the "Papawis this week" write-up, later runs whose
// sign-ups aren't open yet, then every past run (a lazy list) under the player's totals.
// A past run opens its own screen (/app/papawis/:id): who played, the teams, the price and
// the player's own result. Data and rules: server.js appPapawisRuns / appPapawisPast
// (mirror views/papawis.js). The buttons post to the site's own /papawis/:id/join | cancel |
// voucher (public/app.js initPapawis).
import { esc, appAvatar, backChev, chev, icons, lazyList } from './layout.js';
import { papawisAdminStrip } from './admin-papawis.js';
import { appSocialBar } from './comments.js';

const lt = title => `<header class="lt"><h1>${esc(title)}</h1></header>`;
// "**Blue** is …" → bold names (the stored write-up marks them that way).
const marked = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const peso = n => `₱${Math.round(Number(n) || 0).toLocaleString('en-PH')}`;

// One seat. f: { ini, first, color, me, photoUrl, playerId, pending } · ring: '' = neutral
// (teams: Light / Dark say the side, so the league ring stays out of it).
function seat(f, { ring = f.color } = {}) {
  return `<div class="pw-seat${f.me ? ' is-me' : ''}"${f.playerId ? ` data-pid="${esc(f.playerId)}"` : ''}>${appAvatar({ playerId: f.playerId, initials: f.ini, ring: f.me ? 'var(--amber)' : ring, photoUrl: f.photoUrl })}<span class="pw-seat__n">${esc(f.me ? 'You' : f.first)}</span></div>`;
}
const emptySeat = n => `<div class="pw-seat is-empty"><span class="pw-seat__av" aria-hidden="true"></span><span class="pw-seat__n">${n}</span></div>`;
const youSeat = () => `<div class="pw-seat is-you"><span class="pw-seat__av" aria-hidden="true">${icons.plus}</span><span class="pw-seat__n">You?</span></div>`;

// Who's in: a seat per slot (open seats dashed, the next one "You?" when the player can
// claim it), or Light / Dark blocks once the teams are out.
function seats(r, { you = false } = {}) {
  if (r.teamsOut) {
    const side = (key, label) => {
      const list = r.faces.filter(f => f.team === key);
      return `<div class="pw-team"><div class="pw-team__h"><span class="pw-shirt pw-shirt--${key}" aria-hidden="true"></span>${label}<small>${list.length}</small></div>
        <div class="pw-seats">${list.map(f => seat(f, { ring: '' })).join('')}</div></div>`;
    };
    const unsorted = r.faces.filter(f => f.team !== 'light' && f.team !== 'dark');
    return `${side('light', 'Light')}${side('dark', 'Dark')}${unsorted.length ? `<div class="pw-team"><div class="pw-team__h">No side yet<small>${unsorted.length}</small></div><div class="pw-seats">${unsorted.map(f => seat(f, { ring: '' })).join('')}</div></div>` : ''}`;
  }
  const out = r.faces.map(f => seat(f));
  for (let i = r.faces.length; i < r.max; i++) out.push(you && i === r.faces.length ? youSeat() : emptySeat(i + 1));
  return `<div class="pw-seats${r.scheduled ? ' is-locked' : ''}">${out.join('')}</div>`;
}

function waitRow(r) {
  if (!r.waitFaces.length) return '';
  const names = r.waitFaces.map(f => (f.me ? 'you' : f.first));
  const mine = r.waitFaces.findIndex(f => f.me);
  const line = mine > 0 ? `${names.slice(0, mine).join(', ')}, then you` : names.join(', ');
  return `<div class="pw-wait">
      <span class="pw-wait__faces" aria-hidden="true">${r.waitFaces.slice(0, 4).map(f => appAvatar({ playerId: f.playerId, initials: f.ini, ring: f.me ? 'var(--amber)' : f.color, photoUrl: f.photoUrl })).join('')}</span>
      <span class="pw-wait__t">Waitlist · ${r.waitFaces.length}<small>${esc(line)}${r.waitFaces.some(f => f.pending) ? ' · deposits pending count here' : ''}</small></span>
    </div>`;
}

// The run's status line, one action and the note under it (also on the feed's Papawis card).
export function papawisAction(r) {
  const s = r.state, id = esc(r.id);
  const btn = (label, act, extra = '') => `<button type="button" class="btn${act === 'cancel' ? ' btn--ghost' : ''}" data-pw-act="${act}" data-pw-run="${id}"${extra}>${label}</button>`;
  const note = (lead, rest = '') => `<p class="pwr__note"><b>${lead}</b>${rest}</p>`;
  const status = (icon, title, sub) => `<div class="pw-status" role="status"><i>${icon}</i><span><b>${title}</b><small>${sub}</small></span></div>`;
  switch (s.kind) {
    case 'scheduled': return `<button type="button" class="btn" disabled>Sign-ups not open yet</button>${note(esc(s.note))}`;
    case 'in': return `${status(icons.check, r.myTeam ? `You're on ${r.myTeam === 'light' ? 'Light' : 'Dark'} · slot ${s.slot}` : `You're in · slot ${s.slot}`,
        r.myTeam ? `Bring a ${r.myTeam} shirt${s.cancellable ? '' : ' · teams are set'}` : s.cancellable ? `Free to cancel until ${esc(r.cancelBy)}` : 'Cancellation closed · message an admin')}
      ${s.cancellable ? btn('Cancel my spot', 'cancel') : '<button type="button" class="btn btn--ghost" disabled>Cancel my spot</button>'}
      ${s.freeApplied ? `<p class="pwr__note pwr__free"><b>Free run applied</b> · this run is on us · <button type="button" class="link" data-pw-act="voucher" data-pw-use="0" data-pw-run="${id}">Undo</button></p>`
        : s.freeAvailable ? `<button type="button" class="btn btn--plain" data-pw-act="voucher" data-pw-use="1" data-pw-run="${id}">Use my free run here</button>` : ''}`;
    case 'pending': return `${status(icons.clock, 'You\'re listed', 'Held until an admin confirms your deposit')}<a class="btn" href="/app/settle?category=Papawis%20Deposit&amp;from=papawis">Pay deposit</a>${btn('Cancel my request', 'cancel')}`;
    case 'waitlist': return `${status(icons.clock, `You're #${s.pos} on the waitlist`, 'You move up on your own if someone drops')}${btn('Leave the waitlist', 'cancel')}`;
    case 'banned': return `<a class="btn" href="/app/settle?from=papawis">Pay my balance</a>${note('Your account is banned', ' · settle your balance and message us to get it lifted')}`;
    case 'unpaid': return `<a class="btn" href="/app/settle?from=papawis">Pay my balance</a>${note('You have an unpaid Papawis game', ' · settle it to join')}`;
    case 'join-waitlist': return `${btn('Join the waitlist', 'join')}${s.waiting ? note(`${s.waiting} waiting`, ' · you move up if a slot opens') : note('Be first in line', ' · you move up if a slot opens')}`;
    default: return `${btn(`${r.today ? 'Grab' : 'Claim'} slot ${r.filled + 1}`, 'join', s.confirmFirst ? ` data-pw-confirm="Claim slot ${r.filled + 1} of ${r.max} for ${esc(r.day)}${r.startClock ? ` · ${esc(r.startClock)}` : ''}? This close to the run it can't be cancelled from the app." ` : '')}
      ${note(`${s.open} slot${s.open === 1 ? '' : 's'} left`, s.confirmFirst ? ' · claims this close to the run can\'t be cancelled' : ` · cancel free until ${esc(r.cancelBy)}`)}`;
  }
}

// The cover with the date, the live countdown, the time and the court.
function hero(r, { chip = '', cd = true } = {}) {
  return `<div class="pw-hero">
      ${r.photo ? `<img class="pw-hero__img" src="${esc(r.photo)}" alt="" decoding="async">` : ''}
      <div class="pw-hero__top"><span class="pw-glass">${esc(r.today ? 'Today' : r.day)}</span>${chip || (cd ? `<span class="pw-glass" data-pw-cd="${r.scheduled ? r.opensAt : r.tipAt}"><span class="pw-glass__k">${r.scheduled ? 'Opens in' : 'Tip-off in'}</span><b></b></span>` : '')}</div>
      <div class="pw-hero__body">
        <span class="kick">${esc(r.title)}</span>
        ${r.time ? `<b class="pw-hero__time">${esc(r.time)}</b>` : ''}
        <span class="pw-hero__place">${icons.pin}${esc(r.place)}</span>
      </div>
    </div>`;
}

function runCard(r) {
  const canClaim = r.state.kind === 'join';
  const fact = (k, v, num = false) => `<div class="pw-fact"><span>${k}</span><b${num ? ' class="num"' : ''}>${v}</b></div>`;
  return `<section class="sx pw-run" id="run-${esc(r.id)}" data-pw-card="${esc(r.id)}"${r.scheduled ? '' : ' data-pw-roster'}>
    ${hero(r)}
    <div class="sx__body">
      <div class="pw-who"><span class="pw-who__t">${r.teamsOut ? 'Teams' : 'Who\'s in'}</span><span class="pw-who__n"><b>${r.filled}</b> of ${r.max}</span></div>
      ${seats(r, { you: canClaim })}
      ${r.scheduled ? '<p class="pwr__note">The list opens with sign-ups. First come, first served.</p>' : waitRow(r)}
      <div class="pw-facts">
        ${fact('Per head', r.price ? esc(r.price) : 'TBA', !!r.price)}
        ${r.scheduled ? fact('Sign-ups open', esc(r.opensLabel)) : fact(r.cancelBy ? 'Free cancel until' : 'Cancel', r.cancelBy ? esc(r.cancelBy) : 'Closed')}
        ${fact('Waitlist', r.scheduled ? '—' : r.waiting ? `${r.waiting} waiting` : 'Empty')}
      </div>
      ${r.price ? `<p class="pwr__fine">${esc(r.priceNote)}</p>` : ''}
      <div class="pw-act">${papawisAction(r)}</div>
      <p class="msg msg--err" data-pw-msg role="alert" hidden></p>
      ${scoreBar(r.score)}
    </div>
    ${r.admin ? papawisAdminStrip(r.admin) : ''}
    ${appSocialBar(r.social)}
  </section>`;
}

// On the run's day (server.js pwScoreLink): score its games with the league scorer, or, once
// saved, the results.
function scoreBar(s) {
  if (!s) return '';
  if (s.results) return `<a class="pw-scorebar" href="${esc(s.results)}"><span><b>Today's results are in</b><small>Scores, box score and the Player of the Day</small></span><span class="btn btn--ghost">See results</span></a>`;
  return `<div class="pw-scorebar"><span><b>${s.live ? 'Scoring now' : 'Score today\'s games'}</b><small>Same scorer as league games. Set the minutes and check who's here before each game.</small></span><a class="btn" href="${esc(s.href)}">${s.live ? 'Open the scorer' : 'Start scoring'}</a></div>`;
}

// A later run whose sign-ups aren't open yet: one line, nothing to do until they open.
// Admins (r.admin) get the row as a link to the run's Manage screen.
const laterRow = r => {
  const inner = `<span class="pw-cal"><b>${esc(r.dayNum)}</b><span>${esc(r.mon)}</span></span>
    <span class="cell__t">${esc(r.title)}<small>${esc([r.time, r.place].filter(Boolean).join(' · '))}</small></span>`;
  return r.admin
    ? `<a class="cell pw-later" href="/app/admin/papawis/${esc(r.id)}">${inner}<span class="cell__v pw-v--manage">Manage</span>${chev}</a>`
    : `<div class="cell pw-later">${inner}<span class="cell__v">Opens ${esc(r.opensShort)}</span></div>`;
};

// runs: server.js appPapawisRuns · totals: getPapawisTotalsForPlayer · summary: the stored
// "Papawis this week" write-up ({ kicker, headline, body }) or null
export function appPapawisPage({ off = false, runs = [], totals = null, summary = null, cutoffDays = 3 }) {
  if (off) return `${lt('Papawis')}<div class="empty">Papawis is off right now.</div>`;
  const cards = runs.filter((r, i) => i === 0 || !r.scheduled), later = runs.filter((r, i) => i > 0 && r.scheduled);
  const tally = totals && (totals.played || totals.paid || totals.owing)
    ? `<div class="group pw-tally">
        <div><b class="num">${totals.played}</b><span>Played</span></div>
        <div><b class="num">${peso(totals.paid)}</b><span>Paid</span></div>
        <div>${totals.owing ? `<a href="/app/settle?from=papawis"><b class="num pw-owing">${peso(totals.owing)}</b><span>Owing · settle</span></a>` : `<b class="num pw-clear">₱0</b><span>Owing</span>`}</div>
      </div>` : '';
  return `${lt('Papawis')}
  ${cards.length ? cards.map(runCard).join('') : '<div class="empty pw-gap">No runs on the schedule. New ones show up here (and on Home) as soon as they\'re posted.</div>'}
  ${summary ? `<div class="sec">This week</div><div class="card pw-week"><span class="kick">${esc(summary.kicker || 'Papawis this week')}</span>${summary.headline ? `<p class="pw-week__h">${marked(summary.headline)}</p>` : ''}${summary.body ? `<p>${marked(summary.body)}</p>` : ''}</div>` : ''}
  ${later.length ? `<div class="sec">Also coming up</div><div class="group">${later.map(laterRow).join('')}</div>` : ''}
  <div class="sec">Past runs</div>
  ${tally}
  ${lazyList({ src: '/app/papawis/past', empty: 'No past runs yet. They show up here once a run is played.' })}
  <p class="foot-note">First come, first served. Cancel free until ${cutoffDays} days before a run; after that, message an admin so your slot goes to the next in line.</p>`;
}

// Past runs, one page of rows for the lazy list. items: [{ id, title, place, dayNum, mon,
// kind: 'played'|'cancelled'|'pending', count, max, price, mine: null | 'paid'|'unpaid'|'played'|'listed' }]
export function appPapawisPastRows(items) {
  const tag = x => x.mine === 'unpaid' ? '<span class="cell__v pw-v--due">Unpaid</span>'
    : x.mine === 'paid' ? '<span class="cell__v pw-v--ok">Paid</span>'
    : x.mine === 'played' ? '<span class="cell__v pw-v--ok">You played</span>'
    : x.mine === 'listed' ? '<span class="cell__v">Listed</span>'
    : `<span class="cell__v">${x.kind === 'cancelled' ? 'Cancelled' : x.kind === 'pending' ? 'Price pending' : 'Played'}</span>`;
  return items.map(x => `<a class="cell" href="/app/papawis/${encodeURIComponent(x.id)}?from=papawis">
      <span class="pw-cal"><b>${esc(x.dayNum)}</b><span>${esc(x.mon)}</span></span>
      <span class="cell__t">${esc(x.title)}<small>${esc([x.place, x.kind === 'cancelled' ? 'Called off' : `${x.count} of ${x.max} played`, x.kind === 'played' && x.price ? `${peso(x.price)} a head` : ''].filter(Boolean).join(' · '))}</small></span>
      ${tag(x)}
    </a>`).join('');
}

// One past run (/app/papawis/:id). run: { id, title, day, time, place, photo, kind, count,
// max, price, faces, teamsOut, mine: null | { status: 'paid'|'unpaid'|'played'|'listed', team, amount } }
// admin: the Manage run strip (views/app/admin-papawis.js papawisAdminStrip) for admins, else null
export function appPapawisRunPage({ missing = false, run = null, back = { href: '/app/papawis', label: 'Papawis' }, admin = null, results = '', saved = false, finish = '' }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">${run ? esc(run.day) : 'Papawis'}</span><span></span></div>`;
  if (missing || !run) return `${nav}<div class="empty pw-gap">This run isn't on the list any more.</div>`;
  const label = { played: 'Played', cancelled: 'Cancelled', pending: 'Price pending' }[run.kind] || 'Played';
  const m = run.mine;
  const mine = !m ? '' : m.status === 'unpaid'
    ? `<div class="pw-status pw-status--due" role="status"><i>${icons.wallet}</i><span><b>You owe ${peso(m.amount)} for this run</b><small>Settle it to keep joining runs</small></span></div><a class="btn" href="/app/settle?from=papawis">Settle ${peso(m.amount)}</a>`
    : m.status === 'listed' ? `<div class="pw-status pw-status--plain" role="status"><i>${icons.check}</i><span><b>You were listed</b><small>Nobody was charged</small></span></div>`
    : `<div class="pw-status" role="status"><i>${icons.check}</i><span><b>You played${m.team ? ` on ${m.team === 'light' ? 'Light' : 'Dark'}` : ''}</b><small>${m.status === 'paid' ? `${peso(m.amount)} · paid` : run.kind === 'pending' ? 'Price being set' : 'Nothing owed'}</small></span></div>`;
  return `${nav}
  <section class="sx pw-run">
    ${hero({ ...run, scheduled: false, today: false }, { chip: `<span class="pw-glass">${esc(label)}</span>`, cd: false })}
    <div class="sx__body">
      <div class="pw-facts pw-facts--top">
        <div class="pw-fact"><span>${run.kind === 'cancelled' ? 'Were listed' : 'Played'}</span><b class="num">${run.count} of ${run.max}</b></div>
        <div class="pw-fact"><span>Per head</span><b${run.price ? ' class="num"' : ''}>${run.kind === 'cancelled' ? 'Nobody charged' : run.price ? peso(run.price) : 'Being set'}</b></div>
        <div class="pw-fact"><span>Time</span><b>${esc(run.time || '—')}</b></div>
      </div>
      ${mine ? `<div class="pw-act">${mine}</div>` : ''}
      ${saved ? '<p class="msg msg--ok" role="status">Stats saved. They count in Papawis careers now.</p>' : ''}
      ${results ? `<div class="pw-who pw-who--gap"><span class="pw-who__t">Results</span>${finish ? `<a class="pw-who__n" href="${esc(finish)}">Edit</a>` : ''}</div>${results}` : ''}
      <div class="pw-who pw-who--gap"><span class="pw-who__t">${run.teamsOut ? 'Teams' : run.kind === 'cancelled' ? 'Who was listed' : 'Who played'}</span><span class="pw-who__n"><b>${run.count}</b></span></div>
      ${run.faces.length ? seats({ ...run, max: run.faces.length, scheduled: false }) : '<p class="pwr__note">Nobody was listed.</p>'}
    </div>
    ${admin ? papawisAdminStrip(admin) : ''}
  </section>`;
}
