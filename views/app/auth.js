// App sign-in screens: password, 6-digit email code, and the players-only gates.
// The code is typed into the app (not a link), so it works inside the installed app on
// iPhone, where a link in an email would open Safari instead.
import { esc, appLogo, backChev, icons } from './layout.js';

const msg = (error, info) => (error ? `<div class="msg msg--err" role="alert">${esc(error)}</div>` : '')
  + (info ? `<div class="msg msg--info">${esc(info)}</div>` : '');

export function appLoginPage({ error = '', info = '', email = '', phase = null } = {}) {
  return `
  <div class="auth-hero">${appLogo(phase)}</div>
  <h1 class="auth-title">Sign in</h1>
  <p class="auth-sub">Same login as wkndbasketball.com</p>
  ${msg(error, info)}
  <form method="post" action="/app/login" data-busy>
    <div class="group form-group" style="margin-top:14px">
      <div class="cell"><label class="cell__lbl" for="email">Email</label>
        <input id="email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@email.com" value="${esc(email)}" required></div>
      <div class="cell"><label class="cell__lbl" for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Required" required></div>
    </div>
    <div class="auth-row"><span>You'll stay signed in</span><a href="/app/login/code${email ? `?email=${encodeURIComponent(email)}` : ''}">Forgot?</a></div>
    <div class="pad stack">
      <button class="btn" type="submit">Sign in</button>
      <a class="btn btn--plain" href="/app/login/code${email ? `?email=${encodeURIComponent(email)}` : ''}">Email me a sign-in code instead</a>
    </div>
  </form>
  <p class="auth-foot">Not in the league yet? <a class="link" href="/join">Join on the full site</a></p>`;
}

// Step 1 of the code sign-in: ask for the email.
export function appCodeRequestPage({ error = '', email = '' } = {}) {
  return `
  <div class="navbar"><a class="navbar__back" href="/app/login">${backChev}Sign in</a><span></span><span></span></div>
  <h1 class="auth-title" style="margin-top:10px">Get a code</h1>
  <p class="auth-sub">We'll email you a 6-digit code. Type it in here to sign in. It also works if you never set a password or forgot it.</p>
  ${msg(error)}
  <form method="post" action="/app/login/code" data-busy>
    <div class="group form-group">
      <div class="cell"><label class="cell__lbl" for="email">Email</label>
        <input id="email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@email.com" value="${esc(email)}" required autofocus></div>
    </div>
    <div class="pad" style="margin-top:18px"><button class="btn" type="submit">${icons.mail}Email me a code</button></div>
  </form>`;
}

// Step 2: the six boxes. One real input underneath (autocomplete=one-time-code) so iOS and
// Android offer the code from Mail / Messages above the keyboard; app.js draws the boxes.
export function appCodeVerifyPage({ error = '', email = '', masked = '' } = {}) {
  return `
  <div class="navbar"><a class="navbar__back" href="/app/login/code?email=${encodeURIComponent(email)}">${backChev}Back</a><span></span><span></span></div>
  <h1 class="auth-title" style="margin-top:10px">Enter code</h1>
  <p class="auth-sub">If <b>${esc(masked || email)}</b> has a WKND account, a code is on its way. It works for 10 minutes.</p>
  ${msg(error)}
  <form method="post" action="/app/login/code/verify" data-busy data-code-form>
    <input type="hidden" name="email" value="${esc(email)}">
    <div class="code-boxes" data-code-boxes>
      <span></span><span></span><span></span><span></span><span></span><span></span>
      <input name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" aria-label="6-digit code" required autofocus>
    </div>
    <div class="pad stack" style="margin-top:18px">
      <button class="btn" type="submit">Sign in</button>
    </div>
  </form>
  <form method="post" action="/app/login/code" class="pad" style="margin-top:6px">
    <input type="hidden" name="email" value="${esc(email)}"><input type="hidden" name="resend" value="1">
    <button class="btn btn--plain" type="submit">Didn't get it? Send a new code</button>
  </form>`;
}

// Signed in (or tried to) but there's no player behind the account, or the sign-up is
// still waiting for approval.
export function appNotPlayerPage({ reason = 'no-player', phase = null } = {}) {
  const copy = reason === 'pending'
    ? 'Your sign-up is still waiting for approval. Once it\'s approved you can sign in here.'
    : reason === 'admin'
      ? 'The admin login has no player behind it. Sign in with your own player account to use the app.'
      : 'Your account isn\'t linked to a player yet. Scores, standings and the rest of the league are on the full site.';
  return `
  <div class="gate">
    ${appLogo(phase)}
    <h1>This app is for<br>WKND players</h1>
    <p>${esc(copy)}</p>
  </div>
  <div class="pad stack" style="margin-top:auto;padding-top:28px">
    <a class="btn" href="/">Open wkndbasketball.com</a>
    <form method="post" action="/app/logout"><button class="btn btn--ghost" type="submit">Sign in with another account</button></form>
  </div>`;
}

// The app is hidden while it's being tried out: everyone not on the list gets this.
export function appNotYetPage({ phase = null } = {}) {
  return `
  <div class="gate">
    ${appLogo(phase)}
    <h1>The players app<br>is almost here</h1>
    <p>It's being tested with a few players first. You'll hear from us when it opens.</p>
  </div>
  <div class="pad stack" style="margin-top:auto;padding-top:28px">
    <a class="btn" href="/">Open wkndbasketball.com</a>
    <form method="post" action="/app/logout"><button class="btn btn--ghost" type="submit">Sign out</button></form>
  </div>`;
}

export function appOfflinePage() {
  return `
  <div class="gate">
    ${appLogo()}
    <h1>You're offline</h1>
    <p>Check your connection and try again. Anything you were doing hasn't been sent.</p>
  </div>
  <div class="pad" style="margin-top:28px"><button class="btn" type="button" onclick="location.reload()">Try again</button></div>`;
}
