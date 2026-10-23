// Face ID / fingerprint sign-in (passkeys): the one-time offer after a password or code
// sign-in, and More → Face ID & passkeys. public/app.js does the browser side (it says
// "Face ID" on iPhone, "fingerprint" on Android, "passkey" elsewhere: data-bio).
import { esc, backChev, icons } from './layout.js';

// Shown right after signing in. app.js moves straight on to `next` where the phone can't
// do it, or the player already said "Not now" on this phone.
export function appFaceIdOfferPage({ next }) {
  return `
  <div data-faceid-offer data-next="${esc(next)}" hidden style="display:flex;flex-direction:column;flex:1">
    <div class="gate" style="padding-top:64px">
      <span class="bio-badge">${icons.faceid}</span>
      <h1>Sign in with <span data-bio>Face ID</span><br>next time?</h1>
      <p>No password to type. Your face or fingerprint never leaves your phone; WKND only gets a yes from it.</p>
    </div>
    <p class="msg msg--err" data-passkey-msg hidden></p>
    <div class="pad stack" style="margin-top:auto;padding-top:28px">
      <button class="btn" type="button" data-passkey-add><span>Use <span data-bio>Face ID</span></span></button>
      <a class="btn btn--plain" href="${esc(next)}" data-faceid-skip style="color:var(--muted)">Not now</a>
    </div>
  </div>`;
}

// keys: [{ id, device, added, used }]
export function appPasskeysPage({ keys, removed = false }) {
  return `
  <div class="navbar"><a class="navbar__back" href="/app/settings">${backChev}Settings</a><span class="navbar__title">Face ID &amp; passkeys</span><span></span></div>
  <p class="foot-note" style="margin:10px 20px 0;font-size:14px">Sign in with your face or fingerprint instead of a password. Each phone keeps its own.</p>
  ${removed ? '<div class="msg msg--ok">Removed. That phone signs in with a password or a code now.</div>' : ''}
  <p class="msg msg--err" data-passkey-msg hidden></p>
  <div class="sec">Your devices</div>
  ${keys.length ? `<div class="group group--icons">${keys.map(k => `
    <div class="cell">
      <span class="ico ico--amber">${icons.faceid}</span>
      <span class="cell__t">${esc(k.device)}<small>Added ${esc(k.added)}${k.used ? ` · last used ${esc(k.used)}` : ''}</small></span>
      <form method="post" action="/app/passkeys/${encodeURIComponent(k.id)}/remove" onsubmit="return confirm('Remove this? That phone will sign in with a password or a code.')">
        <button class="pill" type="submit" style="background:var(--surface-2);color:var(--danger)">Remove</button>
      </form>
    </div>`).join('')}</div>` : '<div class="empty">None yet.</div>'}
  <div class="pad" style="margin-top:16px"><button class="btn" type="button" data-passkey-add>${icons.faceid}<span>Add <span data-bio>Face ID</span> on this phone</span></button></div>
  <p class="foot-note">Resetting your password removes all of these, in case a phone was lost.</p>`;
}
