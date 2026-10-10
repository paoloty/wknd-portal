import { escHtml, wkndLogo } from './layout.js';

// Shared frame for the sign-in family — login, register, activate, forgot/reset
// (styles: public/auth.css, "au-"). Rendered with layout({ bare: true }): no site header or
// footer, just a slim top bar with the logo and one escape link, over either the blurred
// "your profile is behind this" backdrop (login direction C) or a soft amber glow.

const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

export const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="opacity:.5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

// The disabled "Continue with Google — Coming soon" row (Facebook is gone for good).
export function googleSoonButton() {
  return `<button type="button" class="au-btn au-btn--block au-btn--soon" disabled>
      <span style="display:flex;align-items:center;gap:10px">${GOOGLE_ICON}Continue with Google</span>
      <span class="au-soon">COMING SOON</span>
    </button>`;
}

// The "your player card" preview used by register (live), activate and the game face step.
// ids: prefix for the hooks register's script fills in as you type (null = static card).
// avatar: inner HTML for the circle (initials, or an <img>). verified: green ring + stamp.
export function playerCard({ name = '', initials = '', chips = [], intro = '', meta = '', status = null, stats = false, ids = null, verified = false, avatar = '' }) {
  const id = k => (ids ? ` id="${ids}-${k}"` : '');
  return `<div class="au-pc">
    <div class="au-pc__head">
      <div class="au-pc__av${verified ? ' is-verified' : ''}"${id('av')}>${avatar || `<span${id('ini')}>${escHtml(initials || '··')}</span>`}${verified ? '<span class="au-stamp">VERIFIED HUMAN ✓</span>' : ''}</div>
      <div style="min-width:0">
        <div class="au-pc__name"${id('name')}>${escHtml(name || 'Your name')}</div>
        <div class="au-pc__chips"${id('chips')}>${chips.map(c => `<span class="au-chip${c.kind ? ` au-chip--${c.kind}` : ''}">${escHtml(c.text)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="au-pc__intro${intro ? '' : ' is-empty'}"${id('intro')}>${intro ? `“${escHtml(intro)}”` : 'Your intro shows here.'}</div>
    <div class="au-pc__meta"${id('meta')}>${escHtml(meta)}</div>
    ${stats ? '<div class="au-pc__stats"><div><b>0.0</b><span class="au-k">PPG</span></div><div><b>0.0</b><span class="au-k">RPG</span></div><div><b>0.0</b><span class="au-k">APG</span></div></div>' : ''}
    ${status ? `<div class="au-pc__status"><span class="au-k">STATUS</span><span class="au-chip au-chip--${status.kind}"${id('status')}>${escHtml(status.text)}</span></div>` : ''}
  </div>`;
}

// topLink: { href, html } for the right side of the top bar. backdrop: 'blur' | 'glow' | 'none'.
// before: markup that sits between the top bar and <main> (the phone player-card strip).
export function authShell({ body, topLink = null, backdrop = 'blur', split = false, before = '' }) {
  const bg = backdrop === 'blur'
    ? `<div class="au-backdrop" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i class="au-backdrop__wide"></i><i class="au-backdrop__wide"></i></div><div class="au-veil" aria-hidden="true"></div>`
    : backdrop === 'glow' ? '<div class="au-glow" aria-hidden="true"></div>' : '';
  return `<div class="au">
  ${bg}
  <header class="au-top">
    ${wkndLogo('au-top__logo')}
    ${topLink ? `<a href="${escHtml(topLink.href)}" class="au-top__link">${topLink.html}</a>` : ''}
  </header>
  ${before}
  <main class="au-main${split ? ' au-main--split' : ''}">
    ${body}
  </main>
</div>
${authScripts()}`;
}

// A password input with a show/hide eye. meter: strength bar under it. match: id of the
// field it must equal (shows "Matches ✓" and blocks submit on a mismatch).
export function passwordField({ id, name, label, hint = '', autocomplete = 'current-password', placeholder = '', end = '', meter = false, match = '' }) {
  return `<div class="au-field">
    <label class="au-lbl" for="${id}">${label}${hint ? ` <small>${hint}</small>` : ''}${end ? `<span class="au-lbl__end">${end}</span>` : ''}</label>
    <div class="au-pw">
      <input class="au-input" id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required${autocomplete === 'new-password' ? ' minlength="8"' : ''}${placeholder ? ` placeholder="${escHtml(placeholder)}"` : ''}${match ? ` data-match="${match}"` : ''}${meter ? ' data-meter' : ''}>
      ${match ? `<span class="au-match hidden" data-match-ok="${id}">Matches ✓</span>` : ''}
      <button type="button" class="au-pw__eye" data-eye="${id}" aria-label="Show password" aria-pressed="false">${EYE}</button>
    </div>
    ${meter ? `<div class="au-meter" data-meter-for="${id}" data-score="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="au-meter__txt" data-meter-txt="${id}" aria-live="polite"></div>` : ''}
  </div>`;
}

// Eye toggles, the strength meter and the "Matches ✓" check — one script for every page.
function authScripts() {
  return `<script>
(function () {
  var EYE = ${JSON.stringify(EYE)}, EYE_OFF = ${JSON.stringify(EYE_OFF)};
  document.querySelectorAll('[data-eye]').forEach(function (btn) {
    var input = document.getElementById(btn.getAttribute('data-eye'));
    if (!input) return;
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
  // Rough strength: length first (the server only requires 8), then variety.
  function score(v) {
    if (!v) return 0;
    if (v.length < 8) return 1;
    var kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(function (r) { return r.test(v); }).length;
    if (v.length >= 12 && kinds >= 3) return 4;
    if (v.length >= 10 || kinds >= 3) return 3;
    return 2;
  }
  var LABEL = ['', 'Too short — 8 characters at least', 'OK — longer is stronger', 'Good', 'Strong'];
  document.querySelectorAll('[data-meter]').forEach(function (input) {
    var bar = document.querySelector('[data-meter-for="' + input.id + '"]');
    var txt = document.querySelector('[data-meter-txt="' + input.id + '"]');
    input.addEventListener('input', function () {
      var s = score(input.value);
      bar.setAttribute('data-score', String(s));
      txt.textContent = LABEL[s];
    });
  });
  document.querySelectorAll('[data-match]').forEach(function (input) {
    var other = document.getElementById(input.getAttribute('data-match'));
    var ok = document.querySelector('[data-match-ok="' + input.id + '"]');
    if (!other || !ok) return;
    function check() {
      var same = input.value.length >= 8 && input.value === other.value;
      ok.classList.toggle('hidden', !same);
      input.setCustomValidity(input.value && input.value !== other.value ? 'Passwords don\\'t match' : '');
    }
    input.addEventListener('input', check);
    other.addEventListener('input', check);
  });
})();
</script>`;
}
