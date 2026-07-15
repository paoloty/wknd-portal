import { escHtml } from './layout.js';

export function setPasswordPage({ token = '', error = '', name = '' } = {}) {
  return `
<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">${name ? `Welcome, ${escHtml(name)} — set your password to get started` : 'Create a password for your account'}</p>
    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}
    <form class="login-form" method="POST" action="/set-password">
      <input type="hidden" name="token" value="${escHtml(token)}">
      <div class="login-field">
        <label for="sp-password">New Password</label>
        <input id="sp-password" name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters" autofocus>
      </div>
      <div class="login-field" style="margin-bottom:20px">
        <label for="sp-confirm">Confirm Password</label>
        <input id="sp-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8" placeholder="Repeat password">
      </div>
      <button class="login-submit" type="submit">SET PASSWORD</button>
    </form>
  </div>
</div>`;
}

export function setPasswordDonePage() {
  return `
<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge" style="background:#22c55e">✓</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">Your password has been saved</p>
    <form class="login-form">
      <p style="font-size:14px;color:var(--text-muted);margin:0 0 20px;line-height:1.6">
        You're all set! Use your email and new password to sign in to the portal.
      </p>
      <a href="/login" class="login-submit" style="text-decoration:none;text-align:center">SIGN IN</a>
    </form>
  </div>
</div>`;
}
