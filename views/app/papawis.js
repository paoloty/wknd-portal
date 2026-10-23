// The Papawis tab (/app/papawis): the upcoming runs as cards in the app's one card look,
// each with who's in, the details and one action; then the player's own past runs. Data
// and rules: server.js appPapawisRuns (mirrors views/papawis.js). The buttons post to the
// site's own /papawis/:id/join | cancel | voucher (public/app.js initPapawis).
import { esc, appAvatar, backChev } from './layout.js';

const lt = title => `<header class="lt"><h1>${esc(title)}</h1></header>`;

// The run's one action, and the line under it (also on the feed's Papawis card).
export function papawisAction(r) {
  const s = r.state, id = esc(r.id);
  const btn = (label, act, extra = '') => `<button type="button" class="btn${act === 'cancel' ? ' btn--ghost' : ''}" data-pw-act="${act}" data-pw-run="${id}"${extra}>${label}</button>`;
  const note = (lead, rest = '') => `<p class="pwr__note"><b>${lead}</b>${rest}</p>`;
  switch (s.kind) {
    case 'scheduled': return `<button type="button" class="btn" disabled>Sign-ups not open yet</button>${note(esc(s.note))}`;
    case 'in': return `${r.state.cancellable ? btn('Cancel my spot', 'cancel') : '<button type="button" class="btn btn--ghost" disabled>Cancel my spot</button>'}
      ${note(`✓ You're in · slot ${s.slot}`, s.cancellable ? ` · free to cancel until ${esc(r.cancelBy)}` : ' · cancellation closed, message an admin')}
      ${s.freeApplied ? `<p class="pwr__note pwr__free"><b>Free run applied</b> · this run is on us · <button type="button" class="link" data-pw-act="voucher" data-pw-use="0" data-pw-run="${id}">Undo</button></p>`
        : s.freeAvailable ? `<p class="pwr__note pwr__free"><button type="button" class="link" data-pw-act="voucher" data-pw-use="1" data-pw-run="${id}">Use my free run here</button> · you won it in Rate &amp; Win</p>` : ''}`;
    case 'pending': return `<a class="btn" href="/app/settle?category=Papawis%20Deposit&amp;from=papawis">Pay deposit</a>${btn('Cancel my request', 'cancel')}${note('You\'re listed', ' · held until an admin confirms your deposit')}`;
    case 'waitlist': return `${btn('Leave the waitlist', 'cancel')}${note(`You're #${s.pos} on the waitlist`, ' · you move up on your own if someone drops')}`;
    case 'banned': return `<a class="btn" href="/app/settle?from=papawis">Pay my balance</a>${note('Your account is banned', ' · settle your balance and message us to get it lifted')}`;
    case 'unpaid': return `<a class="btn" href="/app/settle?from=papawis">Pay my balance</a>${note('You have an unpaid Papawis game', ' · settle it to join')}`;
    case 'join-waitlist': return `${btn('Join the waitlist', 'join')}${s.waiting ? note(`${s.waiting} waiting`, ' · you move up if a slot opens') : note('Be first in line', ' · you move up if a slot opens')}`;
    default: return `${btn(r.today ? 'Grab a last slot' : 'Claim a slot', 'join', s.confirmFirst ? ` data-pw-confirm="Claim slot ${r.filled + 1} of ${r.max} for ${esc(r.day)}${r.startClock ? ` · ${esc(r.startClock)}` : ''}? This close to the run it can't be cancelled from the app." ` : '')}
      ${note(`${s.open} slot${s.open === 1 ? '' : 's'} left`, s.confirmFirst ? ' · claims this close to the run can\'t be cancelled' : ` · cancel free until ${esc(r.cancelBy)}`)}`;
  }
}

function runCard(r) {
  const pct = r.max ? Math.min(100, Math.round((r.filled / r.max) * 100)) : 0;
  const pill = r.scheduled ? 'Opens soon' : r.full ? 'Full' : `${r.open} open`;
  const faces = r.faces.slice(0, 8); // overlapping; the rest are behind See all
  return `<section class="sx pwr" id="run-${esc(r.id)}" data-pw-card="${esc(r.id)}">
    <div class="pwr__hero">
      ${r.photo ? `<img class="pwr__img" src="${esc(r.photo)}" alt="" decoding="async">` : ''}
      <div class="gx__top"><span class="sx__chip sx__chip--glass">${r.today ? 'Today' : esc(r.day)}${r.time ? ` · ${esc(r.time)}` : ''}</span><span class="sx__chip sx__chip--glass${!r.scheduled && !r.full ? ' pwr__open' : ''}">${esc(pill)}</span></div>
      <div class="pwr__head">
        <h3>${esc(r.title)}</h3>
        <p>📍 ${esc(r.place)}</p>
        <p class="pwr__cd" data-countdown-to="${r.scheduled ? r.opensAt : r.tipAt}" data-countdown-label="${r.scheduled ? 'Sign-ups open in' : r.today ? 'Tip-off in' : 'Tip-off in'}"></p>
      </div>
    </div>
    <div class="sx__body">
      <div class="pwr__who"><span class="pwr__k">Who's in</span><b>${r.filled} of ${r.max}</b></div>
      <div class="px__bar"><i style="width:${pct}%"></i></div>
      ${faces.length ? `<a class="pwr__stack" href="/app/papawis/${encodeURIComponent(r.id)}/players">
          <span class="pwr__faces">${faces.map(f => `<span class="pwr__face${f.me ? ' is-me' : ''}">${appAvatar({ playerId: f.playerId, initials: f.ini, ring: f.color, photoUrl: f.photoUrl })}</span>`).join('')}${r.faces.length > faces.length ? `<span class="pwr__more">+${r.faces.length - faces.length}</span>` : ''}</span>
          <span class="pwr__see">See all ›</span></a>`
        : `<p class="pwr__note">${r.scheduled ? 'The list opens with sign-ups.' : 'Nobody yet. Be the first.'}</p>`}
      <div class="pwr__rows">
        ${r.price ? `<div class="pv__line"><span>Per head</span><b>${esc(r.price)}</b></div>` : ''}
        <div class="pv__line"><span>Cancel by</span><b>${r.cancelBy ? esc(r.cancelBy) : 'Closed · message an admin'}</b></div>
        <div class="pv__line"><span>Waitlist</span><b>${r.scheduled ? 'Opens with the list' : r.waiting ? `${r.waiting} waiting` : 'Empty'}</b></div>
      </div>
      ${r.price ? `<p class="pwr__fine">${esc(r.priceNote)}</p>` : ''}
      <div class="pwr__action">${papawisAction(r)}</div>
      <p class="msg msg--err" data-pw-msg hidden></p>
    </div>
  </section>`;
}

// runs: server.js appPapawisRuns · history: appPapawisHistory
export function appPapawisPage({ off = false, runs = [], history = [], cutoffDays = 3 }) {
  if (off) return `${lt('Papawis')}<div class="empty">Papawis is off right now.</div>`;
  return `${lt('Papawis')}
  ${runs.length ? `<div class="stack" style="--gap:0">${runs.map(runCard).join('')}</div>`
    : '<div class="empty" style="margin-bottom:12px">No runs on the schedule. New ones show up here (and on Home) as soon as they\'re posted.</div>'}
  <p class="foot-note" style="margin-top:0">First come, first served. Cancel free until ${cutoffDays} days before a run; after that, message an admin so your slot goes to the next in line.</p>
  ${history.length ? `<div class="sec">Your runs</div><div class="group">${history.map(h => `
    <div class="cell"><span class="date">${esc(h.day.split(', ')[1] || h.day)}</span><span class="cell__t">${esc(h.title)}<small>${esc(h.place)}</small></span><span class="cell__v${h.unpaid ? ' pwr__unpaid' : ''}">${esc(h.result)}</span></div>`).join('')}</div>` : ''}`;
}

// Everyone on one run (/app/papawis/:id/players). confirmed / waitlist: [{ slot, name, sub,
// initials, ring, playerId, photoUrl, me, pending }]
export function appPapawisPlayersPage({ missing = false, run = null, confirmed = [], waitlist = [] }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="/app/papawis">${backChev}Papawis</a><span class="navbar__title">Who's in</span><span></span></div>`;
  if (missing || !run) return `${nav}<div class="empty" style="margin-top:12px">This run isn't on the schedule any more.</div>`;
  const row = (p, numbered) => `<div class="cell${p.me ? ' pwp__me' : ''}">
      ${numbered ? `<span class="pwp__slot num">${p.slot}</span>` : ''}
      ${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}
      <span class="cell__t">${esc(p.name)}${p.me ? ' <span class="muted" style="font-weight:400">· You</span>' : ''}${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</span>
      ${p.pending ? '<span class="tag-muted">Deposit pending</span>' : ''}
    </div>`;
  return `${nav}
  <div class="card glow pwp__head">
    <b>${esc(run.title)}</b>
    <p>${esc([run.today ? 'Today' : run.day, run.time].filter(Boolean).join(' · '))}</p>
    <p>📍 ${esc(run.place)}</p>
    <div class="px__bar"><i style="width:${run.max ? Math.min(100, Math.round((run.filled / run.max) * 100)) : 0}%"></i></div>
    <p class="pwp__count"><b>${run.filled} of ${run.max} in</b>${run.full ? ' · full' : ` · ${run.open} open`}</p>
  </div>
  ${run.scheduled ? '<div class="empty">The list opens with sign-ups.</div>' : `
  <div class="sec">In · ${confirmed.length}</div>
  ${confirmed.length ? `<div class="group">${confirmed.map(p => row(p, true)).join('')}</div>` : '<div class="empty">Nobody yet. Be the first.</div>'}
  <div class="sec">Waitlist · ${waitlist.length}</div>
  ${waitlist.length ? `<div class="group">${waitlist.map((p, i) => row({ ...p, slot: i + 1 }, true)).join('')}</div>` : '<div class="empty">Nobody waiting.</div>'}
  <p class="foot-note">The waitlist moves up on its own when someone drops.</p>`}`;
}
