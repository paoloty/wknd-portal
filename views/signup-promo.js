// The Season sign-up, promoted (server.js signupPromo; mockup claude.ai/artifact/MJgoq4yqoP2qsCHgmvK4mH).
// Sign-ups happen in the app only: the app gets a full-screen popup and a card on Home, the
// site a popup (a sheet on phones, a dialog with a QR code on computers). Later and "Not this
// season" post to /season-signup/promo (public/app.js and the site popup's own script).
// p: { season, deadline, spots, fee, popup }
import { escHtml as esc } from './layout.js';

const peso = n => `₱${Number(n).toLocaleString('en-PH')}`;
// "December 15, 2026" → "Dec 15"; anything that doesn't read as a date stays as typed.
function shortDay(s) {
  const t = Date.parse(s || '');
  return Number.isNaN(t) ? String(s || 'Soon') : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const facts = p => `<div class="sp-facts">
    <div><b>${esc(shortDay(p.deadline))}</b><span>Closes</span></div>
    <div><b>${esc(String(p.spots))}</b><span>Spots</span></div>
    <div><b>${esc(peso(p.fee))}+</b><span>Fee + jersey</span></div>
  </div>`;

// App, over Home: once, then again every few days until they sign up.
export function appSignupPopup(p) {
  return `<div class="sp-take" data-sp data-sp-season="${esc(String(p.season))}" role="dialog" aria-modal="true" aria-labelledby="sp-h">
  <button type="button" class="sp-take__x" data-sp-act="later" aria-label="Close, remind me later">&times;</button>
  <div class="sp-take__in">
    <div class="sp-ball" aria-hidden="true"></div>
    <div class="kick sp-kick">Season ${esc(String(p.season))} · Sign-ups open</div>
    <h2 class="sp-take__h" id="sp-h">Count me in for Season ${esc(String(p.season))}</h2>
    <p class="sp-take__p">${esc(String(p.spots))} spots, picked after sign-ups close. About 5 minutes, and you can stop and finish later.</p>
    ${facts(p)}
    <div class="sp-take__grow"></div>
    <a class="btn" href="/app/signup" data-sp-act="later" data-sp-go>Sign up now</a>
    <button type="button" class="btn btn--plain" data-sp-act="later">Later</button>
    <button type="button" class="sp-never" data-sp-act="never">Not this season</button>
  </div>
</div>`;
}

// App Home, at the top (it stands in for the To do row while it shows).
export function appSignupCard(p) {
  return `<div class="card sp-card" data-sp-season="${esc(String(p.season))}">
  <span class="sp-chip">Season ${esc(String(p.season))}</span>
  <b class="sp-card__h">Season ${esc(String(p.season))} sign-ups are open</b>
  <p class="sp-card__p">${esc(String(p.spots))} spots.${p.deadline ? ` Sign up by ${esc(p.deadline)}.` : ''} Takes about 5 minutes.</p>
  <a class="btn" href="/app/signup">Sign up</a>
</div>`;
}

// The site: a sheet on phones, a dialog with a QR code on computers. qr: a data URL (or '').
export function siteSignupPopup(p, qr = '') {
  return `<div class="spp" data-spp hidden>
  <div class="spp-scrim" data-spp-act="later"></div>
  <div class="spp-card" role="dialog" aria-modal="true" aria-labelledby="spp-h" tabindex="-1">
    <span class="spp-grab" aria-hidden="true"></span>
    <button type="button" class="spp-x" data-spp-act="later" aria-label="Close, remind me later">&times;</button>
    <div class="spp-main">
      <div class="spp-kick">Season ${esc(String(p.season))} · Sign-ups open</div>
      <h2 class="spp-h" id="spp-h">Sign up in the WKND app</h2>
      <p class="spp-p">Season ${esc(String(p.season))} sign-ups happen in the app only. ${esc(String(p.spots))} spots${p.deadline ? `, closes ${esc(p.deadline)}` : ''}.</p>
      <div class="spp-app"><span class="spp-logo" aria-hidden="true"><img src="/app-icon-180.png?v=2" alt="" width="34" height="34"></span><span><b>WKND Basketball</b><small>Not on your phone yet? It takes 30 seconds.</small></span></div>
      <div class="spp-btns">
        <a class="spp-btn" href="/app/signup" data-spp-act="later" data-spp-go>Open the app</a>
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
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-spp-act]'); if (!b) return;
    var go = b.hasAttribute('data-spp-go');
    if (!go) e.preventDefault();
    try { fetch('/season-signup/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ act: b.getAttribute('data-spp-act') }), keepalive: true }); } catch (err) {}
    if (!go) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.isConnected) { root.querySelector('[data-spp-act="later"]').click(); } });
  var c = root.querySelector('.spp-card'); if (c) c.focus();
})();
</script>`;
}
