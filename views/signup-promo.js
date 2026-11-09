// The Season sign-up, promoted (server.js signupPromo; mockup claude.ai/artifact/MJgoq4yqoP2qsCHgmvK4mH).
// Sign-ups happen in the app only: the app gets a full-screen popup and a card on Home, the
// site a popup (a sheet on phones, a dialog with a QR code on computers). Later and "Not this
// season" post to /season-signup/promo (public/app.js and the site popup's own script).
// p: { season, deadline, spots, fee, popup }
import { escHtml as esc } from './layout.js';

// "December 15, 2026" → "Dec 15"; anything that doesn't read as a date stays as typed.
function shortDay(s) {
  const t = Date.parse(s || '');
  return Number.isNaN(t) ? String(s || 'Soon') : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── The popup's pieces (mockup claude.ai/artifact/TezEmy2yyspWF51yKLMViW, A + B) ──
// p adds server.js signupPromoDetail: { first, photo, ring, leagueSeason, line: [{ v, l }] | null,
// daysLeft, count (null below the threshold), friends: [{ first, photo }], inTotal, photos[] }
// Game photos behind it all, panning and crossfading (one still photo with reduced motion), under
// a halftone pattern, a vignette and a scrim that darkens toward the buttons.
// The crossfade is timed for 4 (6s each): 2 or 3 photos repeat to make 4; 1 just pans.
const fourOf = list => (list.length > 1 && list.length < 4 ? [...list, ...list, ...list].slice(0, 4) : list);
const photoShow = p => (p.photos?.length ? `<div class="sp-photos" aria-hidden="true">${fourOf(p.photos).map((u, i) => `<i style="background-image:url('${esc(u)}');animation-delay:${i * 6}s,${i * 6}s"></i>`).join('')}</div>` : '');
// Started and not sent: "Almost there"; last season's league games: "Run it back"; else a fresh start.
const headline = p => (p.resume ? `Almost there, <em>${esc(p.first)}</em>.`
  : p.line && !p.papawisOnly ? `Run it back, <em>${esc(p.first)}</em>.` : `Your Season ${esc(String(p.season))} starts here, <em>${esc(p.first)}</em>.`);
// No photo: their initials on their team colour (amber with no team), like the player cards.
const face = p => (p.photo
  ? `<span class="sp-face" style="--ring:${esc(p.ring || 'var(--amber)')}"><img src="${esc(p.photo)}" alt="" width="64" height="64"></span>`
  : `<span class="sp-face sp-face--ini" style="--ring:${esc(p.ring || 'var(--amber)')}">${esc(p.initials || '')}</span>`);
const hero = (p, id) => `<div class="sp-hero">
    ${face(p)}
    <div><div class="sp-kick">Season ${esc(String(p.season))} · ${p.resume ? 'You started' : 'Sign-ups open'}</div><h2 class="sp-h" id="${id}">${headline(p)}</h2></div>
  </div>`;
const statLine = p => (p.line ? `<div class="sp-line">${p.line.map(s => `<div><b>${esc(s.v)}</b><span>${esc(s.l)}</span></div>`).join('')}</div>` : '');
// The price, so step 2 holds no surprise (not for someone already partway through).
const chips = p => (p.resume ? '' : `<div class="sp-chips"><span>Fee <b>₱${Number(p.fee).toLocaleString('en-PH')}</b></span>${p.jerseyFrom ? `<span>Jersey from <b>₱${Number(p.jerseyFrom).toLocaleString('en-PH')}</b></span>` : ''}<span>About <b>5 min</b></span></div>`);
// Where the button goes: straight to their step when they've started.
export const signupHref = (p, base = '/app/signup') => (p.resume ? `${base}/${p.resume.step}` : base);
function clock(p) {
  if (p.daysLeft == null && !p.resume) return '';
  const tone = p.daysLeft == null ? '' : p.daysLeft <= 2 ? ' is-red' : p.daysLeft <= 7 ? ' is-amber' : '';
  const days = p.daysLeft == null ? '' : `<div class="sp-days${tone}"><b>${p.daysLeft}</b><span>${p.daysLeft === 1 ? 'Day left' : 'Days left'}</span></div>`;
  if (p.resume) {
    const r = p.resume;
    return `<div class="sp-clock${days ? '' : ' sp-clock--one'}">${days}<div class="sp-fill">
       <div class="sp-fill__t"><span>Your sign-up</span><span><b>${r.done}</b> of ${r.of} steps</span></div>
       <div class="sp-bar"><i style="width:${Math.round((r.done / r.of) * 100)}%"></i></div>
       <small>Saved. Pick up at step ${r.step}: ${esc(r.title)}.</small></div></div>`;
  }
  const right = p.count != null
    ? `<div class="sp-fill__t"><span>Signed up</span><span><b>${p.count}</b> of ${esc(String(p.spots))} spots</span></div>
       <div class="sp-bar"><i style="width:${Math.min(100, Math.round((p.count / p.spots) * 100))}%"></i></div>
       <small>Picked after ${esc(shortDay(p.deadline))}, not first come.</small>`
    : `<div class="sp-fill__t"><span>Closes <b>${esc(shortDay(p.deadline))}</b></span></div>
       <small>${esc(String(p.spots))} spots, picked after sign-ups close, not first come.</small>`;
  return `<div class="sp-clock">${days}<div class="sp-fill">${right}</div></div>`;
}
function friendsLine(p) {
  const names = p.friends.slice(0, 2).map(f => f.first);
  const others = Math.max(0, p.inTotal - names.length);
  if (names.length) {
    const faces = p.friends.map(f => `<img src="${esc(f.photo)}" alt="" width="26" height="26">`).join('');
    return `<div class="sp-who"><span class="sp-faces">${faces}</span><span><b>${esc(names.join(', '))}</b>${others ? ` and ${others} other${others === 1 ? '' : 's'} are in` : names.length > 1 ? ' are in' : ' is in'}</span></div>`;
  }
  return p.count != null ? `<div class="sp-who"><span><b>${p.count}</b> members are in</span></div>` : '';
}

// App, over Home: once, then again every few days until they sign up.
export function appSignupPopup(p) {
  return `<div class="sp-take${p.photos?.length ? ' sp-take--photo' : ''}" data-sp data-sp-season="${esc(String(p.season))}"${p.testing ? ' data-sp-test' : ''} role="dialog" aria-modal="true" aria-labelledby="sp-h">
  ${photoShow(p)}
  <button type="button" class="sp-take__x" data-sp-act="later" aria-label="Close, remind me later">&times;</button>
  <div class="sp-take__in">
    <div class="sp-take__grow"></div>
    ${hero(p, 'sp-h')}
    ${statLine(p)}
    ${clock(p)}
    ${friendsLine(p)}
    ${chips(p)}
    <a class="btn" href="${esc(signupHref(p))}" data-sp-act="go" data-sp-go>${p.resume ? 'Finish my sign-up' : 'Sign up now'}</a>
    <button type="button" class="btn btn--plain" data-sp-act="later">Later</button>
    <button type="button" class="sp-never" data-sp-act="never">Not this season</button>
  </div>
</div>`;
}

// App Home, at the top (it stands in for the To do row while it shows).
export function appSignupCard(p) {
  const r = p.resume;
  return `<div class="card sp-card" data-sp-season="${esc(String(p.season))}"${p.testing ? ' data-sp-test' : ''}>
  <span class="sp-chip">Season ${esc(String(p.season))}</span>
  <b class="sp-card__h">${r ? `Your Season ${esc(String(p.season))} sign-up isn’t sent yet` : `Season ${esc(String(p.season))} sign-ups are open`}</b>
  <p class="sp-card__p">${r ? `${r.done} of ${r.of} steps done. Pick up at step ${r.step}: ${esc(r.title)}.` : `${esc(String(p.spots))} spots. Takes about 5 minutes.`}${p.deadline ? ` Sign up by ${esc(p.deadline)}.` : ''}</p>
  <a class="btn" href="${esc(signupHref(p))}">${r ? 'Finish my sign-up' : 'Sign up'}</a>
</div>`;
}

// The site: a sheet on phones, a dialog with a QR code on computers. qr: a data URL (or '').
export function siteSignupPopup(p, qr = '') {
  return `<div class="spp" data-spp hidden>
  <div class="spp-scrim" data-spp-act="later"></div>
  <div class="spp-card${p.photos?.length ? ' spp-card--photo' : ''}" role="dialog" aria-modal="true" aria-labelledby="spp-h" tabindex="-1">
    ${photoShow(p)}
    <span class="spp-grab" aria-hidden="true"></span>
    <button type="button" class="spp-x" data-spp-act="later" aria-label="Close, remind me later">&times;</button>
    <div class="spp-main">
      ${hero(p, 'spp-h')}
      ${statLine(p)}
      ${clock(p)}
      ${friendsLine(p)}
      ${chips(p)}
      <div class="spp-app"><span class="spp-logo" aria-hidden="true"><img src="/app-icon-180.png?v=2" alt="" width="34" height="34"></span><span><b>Sign-ups are in the WKND app</b><small>Not on your phone yet? It takes 30 seconds.</small></span></div>
      <div class="spp-btns">
        <a class="spp-btn" href="${esc(signupHref(p))}" data-spp-act="go" data-spp-go>${p.resume ? 'Finish in the app' : 'Open the app'}</a>
        <button type="button" class="spp-btn spp-btn--ghost" data-spp-act="later">Later</button>
      </div>
      <button type="button" class="spp-never" data-spp-act="never">Not this season</button>
    </div>
    ${qr ? `<div class="spp-qr"><img src="${qr}" alt="QR code that opens the app's sign-up" width="150" height="150"><small>Scan with your phone</small></div>` : ''}
  </div>
</div>
<script>
(function () {
  var root = document.querySelector('[data-spp]'); if (!root) return;
  root.hidden = false; document.documentElement.classList.add('spp-open');
  function close() { root.remove(); document.documentElement.classList.remove('spp-open'); }
  function post(act) { try { fetch('/season-signup/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ act: act }), keepalive: true }); } catch (err) {} }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-spp-act]'); if (!b) return;
    var go = b.hasAttribute('data-spp-go'), act = b.getAttribute('data-spp-act');
    if (!go) e.preventDefault();
    post(act);
    if (go) return;
    close();
    if (act !== 'never') return;
    // "Not this season", with a way back for a few seconds.
    var t = document.createElement('div'); t.className = 'spp-toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>No more reminders this season.</span><button type="button">Undo</button>';
    document.body.appendChild(t);
    var gone = setTimeout(function () { t.remove(); }, 6000);
    t.querySelector('button').addEventListener('click', function () { clearTimeout(gone); t.remove(); post('undo'); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.isConnected) { root.querySelector('[data-spp-act="later"]').click(); } });
  var c = root.querySelector('.spp-card'); if (c) c.focus();
})();
</script>`;
}
