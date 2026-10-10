import { escHtml } from './layout.js';
import { authShell } from './auth-shell.js';

const MAIL_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>';

export function forgotPasswordPage({ error = '', email = '' } = {}) {
  return authShell({
    topLink: { href: '/', html: 'Back to site →' },
    body: `<form class="au-card" method="POST" action="/forgot-password">
      <div>
        <div class="au-k au-k--amber">FORGOT PASSWORD</div>
        <h1 class="au-h1">Locked out? Happens to the best ballers.</h1>
        <p class="au-sub">Enter the email you registered with and we'll send a link to choose a new password.</p>
      </div>
      ${error ? `<div class="au-error" role="alert">${escHtml(error)}</div>` : ''}
      <div class="au-field">
        <label class="au-lbl" for="fp-email">Email</label>
        <input class="au-input" id="fp-email" name="email" type="email" autocomplete="email" required placeholder="you@email.com" value="${escHtml(email)}" autofocus>
      </div>
      <button class="au-btn au-btn--amber au-btn--block" type="submit">Send reset link</button>
      <div style="display:flex;justify-content:center"><a href="/login" class="au-back">← Back to sign in</a></div>
      <p class="au-note" style="padding-top:14px;border-top:1px solid var(--border)">Never got your setup email? Ask an admin to resend your invite.</p>
    </form>`,
  });
}

// Deliberately identical whether or not the email actually matched an approved account —
// confirming/denying that would let anyone probe which emails are registered. The resend
// button re-posts the same email; the server's own 60s per-email cooldown (POST
// /forgot-password) is what actually limits it, the countdown just mirrors that.
export function forgotPasswordSentPage({ email = '' } = {}) {
  return authShell({
    topLink: { href: '/', html: 'Back to site →' },
    body: `<section class="au-card" aria-labelledby="fp2-h">
      <div class="au-icon">${MAIL_ICON}</div>
      <div>
        <h1 class="au-h1" id="fp2-h">Check your email</h1>
        <p class="au-sub">If an account exists for ${email ? `<b style="color:var(--text)">${escHtml(email)}</b>` : 'that email'}, a reset link is on its way. It works once and expires in 48 hours.</p>
      </div>
      <ol class="au-tips">
        <li><b>1</b><span>Give it a minute, then check <b>Spam</b> or <b>Promotions</b>.</span></li>
        <li><b>2</b><span>Use the email you registered with — a different one won't get anything.</span></li>
        <li><b>3</b><span>Only approved players can reset. Still waiting on approval? Hang tight.</span></li>
      </ol>
      ${email ? `<form method="POST" action="/forgot-password">
        <input type="hidden" name="email" value="${escHtml(email)}">
        <button class="au-btn au-btn--ghost au-btn--block" type="submit" id="fp-resend" disabled>Resend in 1:00</button>
      </form>` : ''}
      <div class="au-row">
        <a href="/login" class="au-back">← Back to sign in</a>
        <a href="/forgot-password" style="font-size:14px;font-weight:700">Use a different email</a>
      </div>
    </section>
    ${email ? `<script>
(function () {
  var btn = document.getElementById('fp-resend');
  if (!btn) return;
  var left = 60;
  function tick() {
    if (left <= 0) { btn.disabled = false; btn.textContent = 'Resend the link'; return; }
    var s = left % 60;
    btn.textContent = 'Resend in ' + Math.floor(left / 60) + ':' + (s < 10 ? '0' : '') + s;
    left -= 1;
    setTimeout(tick, 1000);
  }
  tick();
})();
</script>` : ''}`,
  });
}
