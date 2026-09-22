import { escHtml } from './layout.js';

export function forgotPasswordPage({ error = '', email = '' } = {}) {
  return `
<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">Enter your email and we'll send you a link to set a new password</p>
    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}
    <form class="login-form" method="POST" action="/forgot-password">
      <div class="login-field" style="margin-bottom:20px">
        <label for="fp-email">Email</label>
        <input id="fp-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com" value="${escHtml(email)}" autofocus>
      </div>
      <button class="login-submit" type="submit">SEND RESET LINK</button>
    </form>
    <p class="login-register"><a href="/login">&larr; Back to sign in</a></p>
  </div>
</div>`;
}

// Deliberately identical whether or not the email actually matched an approved account —
// confirming/denying that would let anyone probe which emails are registered.
export function forgotPasswordSentPage() {
  return `
<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge" style="background:#22c55e">✓</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">If an account exists with that email, we've sent a reset link</p>
    <form class="login-form">
      <p style="font-size:14px;color:var(--text-muted);margin:0 0 20px;line-height:1.6">
        Check your inbox (and spam folder) for a link to set a new password. It expires in 48 hours.
      </p>
      <a href="/login" class="login-submit" style="text-decoration:none;text-align:center">BACK TO SIGN IN</a>
    </form>
  </div>
</div>`;
}
