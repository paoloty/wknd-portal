import { escHtml } from './layout.js';
import { authShell, passwordField, playerCard } from './auth-shell.js';

// One route, two jobs (POST /set-password decides which by whether the account already had
// a password):
//   activation — first time, from the approval email: "Welcome to WKND" + the player card,
//                step 1 of 2 (step 2 is the game face, views/activate.js)
//   reset      — from a forgot-password email: just "New password, <name>", no game face
// card: { name, initials, positions, intro } for the activation player card.
export function setPasswordPage({ token = '', error = '', name = '', isReset = false, card = null } = {}) {
  if (!token) {
    return authShell({
      topLink: { href: '/', html: 'Back to site →' },
      body: `<section class="au-card" aria-labelledby="sp-x">
        <div class="au-k au-k--amber">LINK EXPIRED</div>
        <h1 class="au-h1" id="sp-x">This link doesn't work anymore</h1>
        <div class="au-error" role="alert">${escHtml(error || 'This link is invalid or has expired.')}</div>
        <p class="au-sub">Links work once and expire after 48 hours. Request a fresh one — or if this was your approval email, ask an admin to resend your invite.</p>
        <a class="au-btn au-btn--amber au-btn--block" href="/forgot-password">Send me a new link</a>
        <div style="display:flex;justify-content:center"><a href="/login" class="au-back">← Back to sign in</a></div>
      </section>`,
    });
  }

  const fields = `
      <input type="hidden" name="token" value="${escHtml(token)}">
      ${error ? `<div class="au-error" role="alert">${escHtml(error)}</div>` : ''}
      ${passwordField({ id: 'sp-password', name: 'password', label: 'New password', hint: 'at least 8 characters', autocomplete: 'new-password', meter: true })}
      ${passwordField({ id: 'sp-confirm', name: 'confirm', label: 'Confirm password', autocomplete: 'new-password', match: 'sp-password' })}`;

  if (isReset) {
    return authShell({
      topLink: { href: '/', html: 'Back to site →' },
      body: `<form class="au-card" method="POST" action="/set-password">
        <div>
          <div class="au-k au-k--amber">RESET PASSWORD</div>
          <h1 class="au-h1">${name ? `New password, ${escHtml(name)}` : 'Choose a new password'}</h1>
          <p class="au-sub">Pick one you'll remember this time. No pressure.</p>
        </div>
        ${fields}
        <button class="au-btn au-btn--amber au-btn--block" type="submit">Save new password</button>
      </form>`,
    });
  }

  return authShell({
    split: true,
    body: `<form class="au-card au-card--mid" method="POST" action="/set-password" style="flex-basis:460px;max-width:520px">
        <div>
          <div class="au-k au-k--ok">YOU'RE APPROVED ✓</div>
          <h1 class="au-h1">${name ? `Welcome to WKND, ${escHtml(name)}` : 'Welcome to WKND'}</h1>
          <p class="au-sub">Two quick things and your profile goes live.</p>
        </div>
        <ol class="au-steps" aria-label="Step 1 of 2"><li class="is-on">1 · Password</li><li>2 · Game face</li></ol>
        ${fields}
        <button class="au-btn au-btn--amber au-btn--block" type="submit">Set password →</button>
        <p class="au-note" style="font-size:12px;color:var(--text-subtle)">You'll be signed in right after this.</p>
      </form>
      ${card ? `<aside class="au-aside" aria-label="Your player card">
        <div class="au-k">YOUR PLAYER CARD</div>
        ${playerCard({ name: card.name, initials: card.initials, chips: card.positions ? [{ text: card.positions }] : [], intro: card.intro, status: { text: 'Approved ✓', kind: 'ok' } })}
      </aside>` : ''}`,
  });
}

// After a reset. signedIn: the POST also signed them in (approved accounts) — otherwise they
// get a plain "sign in" button.
export function setPasswordDonePage({ signedIn = false } = {}) {
  return authShell({
    topLink: { href: '/', html: 'Back to site →' },
    body: `<section class="au-card" aria-labelledby="sp-done">
      <div class="au-icon au-icon--ok"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div>
        <h1 class="au-h1" id="sp-done">${signedIn ? "You're back in" : 'Password saved'}</h1>
        <p class="au-sub">${signedIn ? 'Password saved. Any other devices signed in to your account were signed out.' : 'Use your email and new password to sign in.'}</p>
      </div>
      <a class="au-btn au-btn--amber au-btn--block" href="${signedIn ? '/me' : '/login'}">${signedIn ? 'Go to My Profile →' : 'Sign in'}</a>
    </section>`,
  });
}
