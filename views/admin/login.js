import { escHtml } from '../layout.js';

export function adminLoginBody({ error = '' } = {}) {
  return `<div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
  <div style="width:100%;max-width:360px">
    <div class="section-header" style="margin-bottom:24px">
      <h2>Sign In</h2>
    </div>
    ${error ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#f87171;font-size:13px;padding:10px 14px;margin-bottom:16px">${escHtml(error)}</div>` : ''}
    <div class="card" style="padding:28px">
      <form method="POST" action="/login">
        <label class="admin-field-label" for="username">Username</label>
        <input class="admin-input" id="username" name="username" type="text" autocomplete="username" required>
        <label class="admin-field-label" for="password">Password</label>
        <input class="admin-input" id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="admin-btn" type="submit">SIGN IN</button>
      </form>
    </div>
  </div>
</div>`;
}
