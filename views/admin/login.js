import { escHtml } from '../layout.js';
import { authShell, passwordField, googleSoonButton } from '../auth-shell.js';

// The one sign-in page for players and admins (despite the folder). Login direction C:
// the form over a blurred glimpse of the profile it unlocks. The field is labelled Email
// for players, but it still accepts the admin username — POST /login checks both.
export function adminLoginBody({ error = '', ref = '', next = '', email = '' } = {}) {
  const registerHref = ref ? `/register?ref=${encodeURIComponent(ref)}` : '/register';
  return authShell({
    topLink: { href: '/', html: 'Back to site →' },
    body: `<form class="au-card" method="POST" action="/login">
      ${next ? `<input type="hidden" name="next" value="${escHtml(next)}">` : ''}
      ${ref ? `<input type="hidden" name="ref" value="${escHtml(ref)}">` : ''}
      <div>
        <div class="au-k au-k--amber">MY PROFILE</div>
        <h1 class="au-h1">Your profile is one step away</h1>
        <p class="au-sub">Picks, Papawis and your stats — all in one place.</p>
      </div>
      ${error ? `<div class="au-error" role="alert">${escHtml(error)}</div>` : ''}
      <div class="au-field">
        <label class="au-lbl" for="username">Email</label>
        <input class="au-input" id="username" name="username" type="text" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${escHtml(email)}" placeholder="you@email.com"${error ? '' : ' autofocus'}>
      </div>
      ${passwordField({ id: 'password', name: 'password', label: 'Password', placeholder: 'Your password', end: '<a href="/forgot-password">Forgot?</a>' })}
      <label class="au-check"><input type="checkbox" name="remember" value="1"><span>Keep me signed in for 30 days</span></label>
      <button class="au-btn au-btn--amber au-btn--block" type="submit">Sign in</button>
      ${googleSoonButton()}
      <p class="au-note">First time? Your password-setup link is in your email.</p>
      <p class="au-note" style="font-size:14px;color:#c9cfda">New here? <a href="${escHtml(registerHref)}" style="font-weight:700">Join the community →</a></p>
    </form>`,
  });
}
