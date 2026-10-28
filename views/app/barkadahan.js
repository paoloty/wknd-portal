// Barkadahan (2026-10-27): the app's one chat room, and who's online. mockup
// claude.ai/artifact/Jgcp866jfgbxtXMz3JWAyU. The room is drawn by public/barkadahan.js from the
// bundle (server.js /app/barkadahan): the last messages, me, the online count, the reactions and
// the people for @mentions. Full screen (no tab bar), like a chat app, so the keyboard has room.
import { esc, backChev, appAvatar, icons, chev } from './layout.js';
import { pickOption } from './picks.js';

export function appBarkadahanPage({ bundle }) {
  const json = JSON.stringify(bundle).replace(/</g, '\\u003c');
  const cant = bundle.me.cant;
  return `<div class="bk" data-bk>
    <div class="navbar bk__nav"><a class="navbar__back" href="/app">${backChev}Home</a><span class="navbar__title">Barkadahan</span>
      <a class="bk__online" href="/app/barkadahan/online" aria-label="${bundle.online} online. Who's online"><i aria-hidden="true"></i><span data-bk-online>${bundle.online}</span> online</a></div>
    <div class="bk__list" data-bk-list role="log" aria-live="polite" aria-label="Messages"></div>
    <p class="bk__typing" data-bk-typing aria-live="polite"></p>
    <div class="bk__reply" data-bk-reply hidden></div>
    <div class="bk__mention" data-bk-mention hidden role="listbox" aria-label="Mention someone"></div>
    <div class="bk__reply bk__attach" data-bk-attach hidden></div>
    ${cant ? `<p class="bk__cant">${esc(cant)}</p>` : `<form class="bk__bar" data-bk-form autocomplete="off">
      ${bundle.me.mod ? `<button type="button" class="bk__emo bk__plus" data-bk-share aria-label="Share a Papawis run or a game">${icons.plus}</button>` : ''}
      <button type="button" class="bk__emo" data-bk-emoji aria-label="Emoji">🙂</button>
      <textarea class="bk__in" rows="1" maxlength="500" placeholder="Message the barkada" enterkeyhint="send" aria-label="Message" data-bk-input></textarea>
      <button type="submit" class="bk__send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </form>`}
    <script type="application/json" data-bk-bundle>${json}</script>
  </div>`;
}

const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };
const row = (p, right, rightCls = '') => `<div class="cell"><span class="bk-av${right === 'Now' ? ' is-on' : ''}">${appAvatar({ playerId: p.pid, initials: p.initials, ring: p.ring, photoUrl: p.photo })}</span>
  <span class="cell__t">${esc(p.full)}<small>${esc(p.team || 'No team')}</small></span><span class="cell__v ${rightCls}">${esc(right)}</span></div>`;

// now / earlier: bkPerson rows (earlier with seen ms). hiddenMe: this player hides themselves.
export function appBarkadahanOnlinePage({ now, earlier, hiddenMe }) {
  return `<div class="navbar"><a class="navbar__back" href="/app/barkadahan">${backChev}Barkadahan</a><span class="navbar__title">Online</span><span></span></div>
  <div class="sec">Online now · ${now.length}</div>
  ${now.length ? `<div class="group">${now.map(p => row(p, 'Now', 'bk-now')).join('')}</div>` : '<div class="empty">Nobody else has the app open right now.</div>'}
  ${earlier.length ? `<div class="sec">Earlier today</div><div class="group">${earlier.map(p => row(p, ago(p.seen))).join('')}</div>` : ''}
  <p class="foot-note">Online means the app is open on their phone. ${hiddenMe ? 'You’re hidden: ' : ''}<a class="link" href="/app/settings">${hiddenMe ? 'show yourself' : 'Hide yourself'}</a> in Settings → Privacy.</p>`;
}

// ── Cards an admin shares into the room (2026-10-28, mockup claude.ai/artifact/4XcqkzEiEoLdspw4M1NdmP):
// a Papawis run or a Who wins? game, drawn fresh for the player looking (server.js bkCards), so
// seats, picks and results are always current. The buttons post to the site's own routes
// (public/barkadahan.js), so every rule stays in one place.
const cardIcon = { pw: icons.ball, pick: icons.picks };
const more = (href, label = 'Details') => `<a class="bkc__more" href="${esc(href)}">${label}${chev}</a>`;
function seatDots(c) {
  if (!c.max || c.max > 24) return `<small>${c.filled} of ${c.max || '?'} in</small>`;
  const dots = Array.from({ length: c.max }, (_, i) => `<i${i < c.filled ? '' : ' class="is-open"'}></i>`).join('');
  return `<span class="bkc__seats" aria-label="${c.filled} of ${c.max} in">${dots}${c.open ? `<em class="num">${c.open} left</em>` : '<em class="num">Full</em>'}</span>`;
}
function pwAction(c) {
  const s = c.state || {}, id = esc(c.id);
  const btn = (label, act, extra = '') => `<button type="button" class="btn bkc__btn" data-bk-pw="${act}" data-bk-run="${id}"${extra}>${label}</button>`;
  switch (s.kind) {
    case 'join': return btn('I’m in', 'join', s.confirmFirst ? ` data-bk-ask="Claim a slot for ${esc(c.when)}? This close to the run it can’t be cancelled from the app."` : '');
    case 'join-waitlist': return btn('Join the waitlist', 'join');
    case 'in': return `<span class="bkc__done">${icons.check}You’re in${c.myTeam ? ` · ${c.myTeam === 'light' ? 'Light' : 'Dark'}` : ''}</span>${s.cancellable ? `<button type="button" class="bkc__link" data-bk-pw="cancel" data-bk-run="${id}" data-bk-ask="Cancel your spot for ${esc(c.when)}?">Can’t make it</button>` : ''}`;
    case 'waitlist': return `<span class="bkc__note">#${s.pos} on the waitlist</span><button type="button" class="bkc__link" data-bk-pw="cancel" data-bk-run="${id}" data-bk-ask="Leave the waitlist?">Leave</button>`;
    case 'pending': return '<span class="bkc__note">Listed · deposit pending</span>';
    case 'banned': return '<span class="bkc__note">Your account is on hold</span>';
    case 'unpaid': return '<span class="bkc__note">Settle your unpaid run to join</span>';
    case 'scheduled': return `<span class="bkc__note">${esc(s.note)}</span>`;
    default: return '';
  }
}
export function bkCardHtml(c) {
  if (!c || c.gone) return `<div class="bkc is-gone">${c?.goneText ? esc(c.goneText) : 'No longer available'}</div>`;
  if (c.kind === 'pw') {
    return `<div class="bkc">
      <div class="bkc__top"><span class="bkc__ic" aria-hidden="true">${cardIcon.pw}</span>
        <span class="bkc__t"><span class="bkc__k">Papawis · ${esc(c.day)}</span><b>${esc(c.title)}</b>${c.closed ? `<small>${esc(c.closed)}</small>` : seatDots(c)}</span></div>
      <div class="bkc__act">${c.closed ? '' : pwAction(c)}${more(c.href)}</div>
    </div>`;
  }
  const g = c.game;
  const clock = c.closed ? `<span class="bkc__state">${esc(c.closed)}</span>` : c.closeAt ? `<span class="bkc__state is-open" data-bk-close-at="${c.closeAt}"></span>` : '';
  const total = g.counts.a + g.counts.b;
  const foot = c.result
    ? `<span class="${c.result.got === true ? 'bkc__win' : ''}">${esc(c.result.text)}</span>`
    : `<span><b class="num">${total}</b> pick${total === 1 ? '' : 's'}${!c.closed && g.myPick ? ' · tap the other side to switch' : ''}</span>`;
  return `<div class="bkc bkc--pick" data-bk-pick="${esc(g.id)}" data-pick-a="${esc(g.a.name)}" data-pick-b="${esc(g.b.name)}">
    <div class="bkc__top bkc__top--pick"><span class="bkc__k"><span class="bkc__ww">Who wins?</span> · ${esc(c.label)}</span>${clock}</div>
    ${c.score ? `<div class="bkc__score num">${esc(c.score)}</div>` : ''}
    <div class="pick__opts bkc__opts">${pickOption(c.marginGuess ? { ...g, closed: true } : g, 'a')}${pickOption(c.marginGuess ? { ...g, closed: true } : g, 'b')}</div>
    <div class="bkc__foot">${c.marginGuess && !c.closed ? '<span>Finals Game 1: pick with your margin guess</span>' : foot}${more(c.href, c.marginGuess && !c.closed ? 'Pick' : c.result ? 'Recap' : 'Details')}</div>
  </div>`;
}

// The admin's share list: what's open right now.
export function bkShareHtml(items) {
  if (!items.length) return '<p class="bk-sheet__empty">Nothing open right now. Upcoming Papawis runs and games still taking picks show up here.</p>';
  const groups = [['pw', 'Papawis'], ['pick', 'Who wins? · open']];
  return groups.map(([k, label]) => {
    const list = items.filter(i => i.kind === k);
    return list.length ? `<div class="bk-sheet__l">${label}</div><div class="bk-sheet__list">${list.map(i => `<button type="button" class="bk-row" data-bk-share-pick="${esc(i.key)}" data-title="${esc(i.title)}" data-sub="${esc(i.sub)}">
      <span class="bkc__ic" aria-hidden="true">${cardIcon[k]}</span><span class="bk-row__t">${esc(i.title)}<small>${esc(i.sub)}</small></span>${chev}</button>`).join('')}</div>` : '';
  }).join('');
}
