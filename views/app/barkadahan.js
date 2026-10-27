// Barkadahan (2026-10-27): the app's one chat room, and who's online. mockup
// claude.ai/artifact/Jgcp866jfgbxtXMz3JWAyU. The room is drawn by public/barkadahan.js from the
// bundle (server.js /app/barkadahan): the last messages, me, the online count, the reactions and
// the people for @mentions. Full screen (no tab bar), like a chat app, so the keyboard has room.
import { esc, backChev, appAvatar } from './layout.js';

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
    ${cant ? `<p class="bk__cant">${esc(cant)}</p>` : `<form class="bk__bar" data-bk-form autocomplete="off">
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
