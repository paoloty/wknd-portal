import { escHtml } from './layout.js';
import { SIZES } from '../lib/season-pricing.js';
import { TIERS, TIER_LABELS } from '../lib/assessment-scoring.js';

const STATUS_LABEL = { waitlisted: 'Waitlisted', confirmed: 'Confirmed', rejected: 'Not Selected' };
const STATUS_COLOR = { waitlisted: '#f59332', confirmed: '#22c55e', rejected: '#64748b' };

// Chest/length (top) and hips/length (shorts), in inches, per size.
const SIZE_CHART = {
  top:    { XS: [19, 27], S: [20, 28], M: [21, 29], L: [22, 30], XL: [23, 31], '2XL': [24, 32], '3XL': [25, 33], '4XL': [26, 34], '5XL': [27, 36] },
  shorts: { XS: [21, 19], S: [22, 20], M: [23, 21], L: [24, 22], XL: [25, 23], '2XL': [26, 24], '3XL': [27, 25], '4XL': [28, 26], '5XL': [29, 27] },
};

const fmtMoney = v => (v ? `₱${Number(v).toLocaleString()}` : '');

// Shared shell — back link, brand, subhead, and static context panels. Identical
// across every branch (form / not-approved / not-open / existing-status), same
// convention register.js uses for its own shell-left.
// season_format is admin free text (e.g. "Double Round Robin · Top 4 Twice-to-Beat (1v4, 2v3) · Finals Best of 3").
// Split on the middle-dot separator into a bulleted writeup; a single segment with no
// separator just renders as a plain sentence.
function formatPanel(seasonFormat) {
  if (!seasonFormat) return '';
  const items = seasonFormat.split(/[·•]/).map(s => s.trim()).filter(Boolean);
  const body = items.length > 1
    ? `<div class="format-list">${items.map(i => `<div class="format-item"><span class="format-dot"></span><span>${escHtml(i)}</span></div>`).join('')}</div>`
    : `<p class="format-text">${escHtml(seasonFormat)}</p>`;
  return `<div class="next-panel">
    <div class="next-panel__label">League Format</div>
    ${body}
  </div>`;
}

// Jersey prices intentionally aren't shown here — this signup round only collects sizes,
// jerseys aren't being charged yet (see initialTotal in the form below).
function shellLeft({ sigSeason, deadline, seasonFormat, quotaAmount, capacityPct }) {
  const infoRows = [
    quotaAmount   ? `<div class="info-row"><span class="info-row__label">Season Fee</span><span class="info-row__val">${escHtml(fmtMoney(quotaAmount))}</span></div>` : '',
    deadline ? `<div class="info-row"><span class="info-row__label">Deadline</span><span class="info-row__val">${escHtml(deadline)}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<div class="shell-left">
    <div class="shell-back-row">
      <a href="/me" class="shell-back">&larr; Back to My Profile</a>
    </div>
    <div class="shell-brand-row">
      <a href="/" class="site-header__logo-text shell-logo">WKND Basketball</a>
      <button class="site-nav__hamburger shell-hamburger" id="nav-toggle-sidebar" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
        <span class="site-nav__hamburger-line"></span>
        <span class="site-nav__hamburger-line"></span>
        <span class="site-nav__hamburger-line"></span>
      </button>
    </div>
    <p class="login-brand__sub">Lock in your spot for Season ${escHtml(String(sigSeason || ''))}. Same league, same crew &mdash; just don't ghost the form this time.</p>

    ${infoRows ? `<div class="next-panel">
      <div class="next-panel__label">Season ${escHtml(String(sigSeason))} Info</div>
      <div class="info-list">${infoRows}</div>
      ${capacityPct !== null ? `<div class="capacity-bar">
        <div class="capacity-bar__track"><div class="capacity-bar__fill" style="width:${capacityPct}%"></div></div>
        <div class="capacity-bar__label">Spots are filling up</div>
      </div>` : ''}
    </div>` : ''}

    ${formatPanel(seasonFormat)}

    <div class="next-panel">
      <div class="next-panel__label">What happens next</div>
      <div class="next-list">
        <div class="next-item"><span class="next-num">1</span><span class="next-text">You submit the form below &mdash; sizes, prefs, the whole thing.</span></div>
        <div class="next-item"><span class="next-num">2</span><span class="next-text">Admin reviews the waitlist and builds out the rosters.</span></div>
        <div class="next-item"><span class="next-num">3</span><span class="next-text">You'll hear back either way once spots are confirmed.</span></div>
        <div class="next-item"><span class="next-num">4</span><span class="next-text">Season fee + jersey charges apply once the season actually starts &mdash; nothing is charged today.</span></div>
      </div>
    </div>
  </div>`;
}

const stylesBlock = `<style>
:root { --surface-2: #151b26; --border-solid: #1e2530; }

.login-brand__sub em { font-style: normal; opacity: .55; font-size: 11.5px; }

.shell-back-row { margin-bottom: 14px; }
.shell-back { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-muted); transition: color .15s; }
.shell-back:hover { color: var(--amber); }
.shell-brand-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.shell-logo { display: block; }

.shell { width: 100%; }
.shell-left {
  position: fixed; top: 0; left: 0; z-index: 50;
  width: clamp(320px, 30vw, 420px);
  height: 100vh;
  padding: 48px 44px 40px;
  display: flex; flex-direction: column;
  overflow-y: auto;
  background: radial-gradient(600px circle at 20% 15%, rgba(245,147,50,.10), transparent 60%), var(--surface);
  border-right: 1px solid var(--border-solid);
}
.shell-right {
  width: calc(100% - clamp(320px, 30vw, 420px));
  margin-left: clamp(320px, 30vw, 420px);
  padding: 48px 56px 80px;
  display: flex; flex-direction: column; align-items: center;
}
.shell-right > .login-error,
.shell-right > form,
.shell-right > .status-panel { width: 100%; max-width: 720px; }
.shell-right--status { justify-content: center; min-height: 100vh; }
.status-panel { width: 100%; max-width: 480px; text-align: center; }
.status-panel__icon { font-size: 42px; margin-bottom: 16px; }
.status-panel__title { font-size: 1.25rem; font-weight: 800; color: var(--text); margin: 0 0 10px; }
.status-panel__body { color: var(--text-muted); font-size: 13px; line-height: 1.75; margin: 0 0 24px; }
.status-pill { display: inline-block; border-radius: 20px; padding: 3px 14px; font-size: 12px; font-weight: 700; letter-spacing: .04em; margin-bottom: 20px; }
.status-recap { background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; text-align: left; font-size: 12px; }
.status-recap__label { font-weight: 700; color: var(--text); margin-bottom: 6px; }
.status-recap__row { color: var(--text-muted); }
.status-recap__row strong { color: var(--text); }
.balance-warn { background: rgba(245,147,50,.08); border: 1px solid rgba(245,147,50,.25); border-radius: 8px; padding: 12px 16px; text-align: left; margin-bottom: 20px; font-size: 12px; color: #f59332; }

.next-panel { background: var(--bg); border: 1px solid var(--border-solid); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 24px; }
.next-panel__label { font-size: 10px; font-weight: 700; color: var(--text-subtle); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px; }
.next-list { display: flex; flex-direction: column; gap: 14px; }
.next-item { display: flex; align-items: center; gap: 14px; }
.next-num {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  background: var(--surface-2); border: 1px solid var(--border-solid); color: var(--text-muted);
  display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; font-weight: 700; padding-top: 1px;
}
.next-item:last-child .next-num { background: var(--amber-dim); border-color: rgba(245,147,50,.4); color: var(--amber); }
.next-text { font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }
.next-text strong { color: var(--text); font-weight: 600; }

/* Desktop never shows this — the sidebar's fixed side-by-side layout already makes
   it obvious the form is a separate column. Only needed once the sidebar (Season
   Info + League Format + What Happens Next, all stacked) sits on top of the form
   on mobile — see the mobile media query below. */
.form-start-anchor { display: none; }

.info-list { display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12.5px; }
.info-row__label { color: var(--text-muted); }
.info-row__val { color: var(--text); font-weight: 600; text-align: right; }

.format-list { display: flex; flex-direction: column; gap: 10px; }
.format-item { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }
.format-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); flex-shrink: 0; margin-top: 6px; }
.format-text { font-size: 12.5px; color: var(--text-muted); line-height: 1.6; margin: 0; }

.capacity-bar { margin-top: 16px; }
.capacity-bar__track { height: 7px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border-solid); overflow: hidden; }
.capacity-bar__fill { height: 100%; border-radius: 5px 0 0 5px; background: var(--amber); }
.capacity-bar__label { margin-top: 6px; font-size: 10.5px; color: var(--text-subtle); }

/* ── accordion (shared with register.js's pattern) ───────────────────── */
.acc-item { border: 1px solid var(--border-solid); border-radius: var(--radius); background: var(--surface); margin-bottom: 14px; overflow: hidden; transition: border-color .15s; }
.acc-item.is-open { border-color: rgba(245,147,50,.35); }
.acc-header { width: 100%; display: flex; align-items: center; gap: 16px; padding: 20px 26px; background: none; border: none; color: inherit; font: inherit; cursor: pointer; text-align: left; }
.acc-item.is-pending .acc-header { cursor: not-allowed; }
.acc-num {
  width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border-solid); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; font-weight: 700; color: var(--text-muted);
  padding-top: 1px; transition: background .2s, border-color .2s, color .2s;
}
.acc-item.is-open .acc-num { background: var(--amber); border-color: var(--amber); color: #0a0e16; }
.acc-item.is-done .acc-num { background: transparent; border-color: var(--amber); color: var(--amber); }
.acc-header-text { flex: 1; min-width: 0; }
.acc-header-label { font-size: 15px; font-weight: 700; color: var(--text); }
.acc-item.is-pending .acc-header-label { color: var(--text-muted); }
.acc-header-summary { font-size: 12px; color: var(--text-muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acc-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform .2s ease; }
.acc-item.is-open .acc-chevron { transform: rotate(180deg); }
.acc-item.is-pending .acc-chevron { opacity: .3; }
.acc-body { max-height: 0; overflow: hidden; transition: max-height .35s ease; }
.acc-item.is-open .acc-body { max-height: 2400px; }
.acc-body-inner { padding: 2px 26px 30px; display: flex; flex-direction: column; gap: 22px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field { margin-bottom: 0; }
.field label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 7px; }
.req { color: var(--amber); font-style: normal; }
.field__input {
  display: block; width: 100%; background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px;
  padding: 11px 13px; font-size: 14px; color: var(--text); font-family: inherit; outline: none;
  transition: border-color .15s; box-sizing: border-box; resize: vertical;
}
.field__input:focus { border-color: var(--amber); }
.field__input::placeholder { color: var(--text-muted); opacity: .5; }
.field__input.reg-invalid { border-color: #f87171; }
.reg-field-error { font-size: 11px; color: #f87171; margin-top: 5px; }

/* ── size picker ──────────────────────────────────────────────────────── */
.pick-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.pick-cell {
  flex: 1 1 0; min-width: 58px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 6px 9px; border: 1px solid var(--border-solid); border-radius: 10px;
  background: var(--surface-2); cursor: pointer; user-select: none;
  transition: border-color .15s, background .15s;
}
.pick-cell input { display: none; }
.pick-cell:hover { border-color: var(--amber); }
.pick-cell:has(input:checked) { border-color: var(--amber); background: rgba(245,147,50,.12); }
.pick-cell__meas { font-size: 9px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pick-cell__size { font-family: 'Saira Condensed'; font-weight: 700; font-size: 15px; color: var(--text); line-height: 1; }
.pick-cell:has(input:checked) .pick-cell__size { color: var(--amber); }
.pick-axis { margin-top: 6px; font-size: 10.5px; color: var(--text-subtle); }

.pockets-check.is-disabled { opacity: .4; pointer-events: none; }
.pick-grid--scale { width: 100%; }
.pick-grid--scale .pick-cell { min-width: 0; padding: 12px 6px; }

.fee-total { background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px; padding: 14px 16px; display: flex; align-items: baseline; justify-content: space-between; }
.fee-total__label { font-size: 12px; color: var(--text-muted); }
.fee-total__amt { font-family: 'Saira Condensed'; font-weight: 800; font-size: 22px; color: var(--amber); font-variant-numeric: tabular-nums; }

.hidden { display: none !important; }

/* ── liveness check (Group 00) ────────────────────────────────────────── */
#lv-idle { width: 100%; margin: 0 auto; }
@media (min-width: 901px) {
  #lv-idle { max-width: 360px; }
}
.lv-cam-wrap {
  margin-top: 10px; width: 100%;
  aspect-ratio: 3/4; background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px;
  overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;
}
.lv-cam-wrap video, .lv-cam-wrap canvas, .lv-cam-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lv-placeholder { font-size: 12px; color: var(--text-subtle); text-align: center; padding: 0 16px; }
.lv-qr-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 16px; text-align: center; background: var(--bg);
}
.lv-action-row {
  position: absolute; left: 0; right: 0; bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px 8px; justify-content: center; padding: 0 12px;
}
.lv-icon-btn {
  display: flex; align-items: center; gap: 6px; background: var(--amber); color: #0a0e16; border: none; border-radius: 18px;
  padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,.35); letter-spacing: .02em;
}
.lv-icon-btn svg { flex-shrink: 0; }
.lv-icon-btn--ghost { background: rgba(15,23,42,.78); color: #e2e8f0; border: 1px solid rgba(255,255,255,.15); }
.lv-icon-btn:disabled { opacity: .5; cursor: default; }
#lv-capture-btn { margin-top: 10px; }
#lv-error { min-height: 0; }
/* Pinned to the top of the camera view itself (not just above it) so it's still
   in view at the moment of framing/capture, not just something read once before
   the camera even opened. Dark gradient backdrop keeps it legible over any feed. */
.lv-prompt {
  position: absolute; top: 0; left: 0; right: 0; margin: 0; padding: 10px 14px 16px;
  font-size: 12px; line-height: 1.4; color: #fff; text-align: center;
  background: linear-gradient(180deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.4) 65%, transparent 100%);
}
.lv-prompt strong { color: var(--amber); }

/* ── waiver text (Group 08) ───────────────────────────────────────────── */
.waiver-box {
  max-height: 220px; overflow-y: auto; margin-top: 8px;
  padding: 14px 16px; background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px;
}
.waiver-box p { margin: 0 0 10px; font-size: 12px; line-height: 1.6; color: var(--text-muted); }
.waiver-box p:last-child { margin-bottom: 0; }
.waiver-box strong { color: var(--text); font-weight: 700; }

.nav { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
.btn-next { background: var(--amber); border: none; border-radius: 8px; color: #0a0e16; font-size: 14px; font-weight: 700; padding: 12px 26px; cursor: pointer; letter-spacing: .04em; transition: opacity .15s; width: 100%; font-family: inherit; }
.btn-next:hover { opacity: .88; }
.check { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; font-size: 12.5px; color: var(--text-muted); line-height: 1.6; }
.check input { accent-color: var(--amber); width: 15px; height: 15px; cursor: pointer; flex-shrink: 0; margin-top: 2px; }
.check--radio { display: flex; }

@media (max-width: 900px) {
  .shell-left { position: static; width: auto; height: auto; border-right: none; border-bottom: 1px solid var(--border-solid); padding: 26px 20px 40px; }
  .shell-back-row { display: none; }
  .shell-hamburger { display: flex; margin-left: auto; }
  .shell-right { width: 100%; margin-left: 0; padding: 48px 24px 24px; max-width: none; }
  .shell-right--status { min-height: 0; padding-top: 64px; }
  /* Same circular numbered badge as the form's own .acc-num made this list easy to
     mistake for the form itself when three stacked panels (Season Info, League
     Format, What Happens Next) are the first thing in the mobile fold — square it
     off and shrink it so these read as status lists, not step 1 of a wizard. */
  .next-num { border-radius: 6px; width: 24px; height: 24px; font-size: 11px; }
  /* Unambiguous handoff point right where the real form starts, so scrolling past
     all that sidebar content doesn't leave it looking like the whole page. */
  .form-start-anchor { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--amber); letter-spacing: .02em; margin-bottom: 18px; }
  .form-start-anchor span { font-size: 16px; }
  .grid-2 { grid-template-columns: 1fr; }
  .acc-header { padding: 16px 18px; }
  .acc-body-inner { padding: 2px 18px 24px; }
  .pick-grid { flex-wrap: wrap; }
  .pick-cell { flex: 1 1 30%; }
}
</style>`;

function statusPanel({ icon, title, body, extra = '', cta = true }) {
  return `<div class="shell-right shell-right--status">
    <div class="status-panel">
      <div class="status-panel__icon">${icon}</div>
      <h2 class="status-panel__title">${title}</h2>
      <p class="status-panel__body">${body}</p>
      ${extra}
      ${cta ? `<a href="/me" class="btn-next" style="display:block;text-decoration:none;text-align:center">Back to My Profile</a>` : ''}
    </div>
  </div>`;
}

export function seasonSignupPage({
  state,
  sigSeason = '',
  sigOpen = false,
  deadline = '',
  existing = null,
  reg = null,
  name = '',
  hasBalance = false,
  balanceAmt = 0,
  quotaAmount = '',
  seasonFormat = '',
  capacityPct = null,
  returning = null,
  error = null,
  prefill = {},
  existingLivenessCapture = null,
  livenessPrompt = '',
} = {}) {
  const wrap = right => `<div class="shell">
  ${shellLeft({ sigSeason, deadline, seasonFormat, quotaAmount, capacityPct })}
  ${right}
</div>
${stylesBlock}`;

  if (state === 'not-approved') {
    return wrap(statusPanel({
      icon: '⏳',
      title: 'Application Pending',
      body: "Your membership application hasn't been approved yet. Season signup opens up once an admin approves your account.",
    }));
  }

  if (existing) {
    const statusLabel = STATUS_LABEL[existing.status] ?? existing.status;
    const statusColor = STATUS_COLOR[existing.status] ?? '#64748b';
    const jerseyInfo = (existing.jersey_top || existing.jersey_shorts) ? `
      <div class="status-recap">
        <div class="status-recap__label">Jersey Selection</div>
        ${existing.jersey_top    ? `<div class="status-recap__row">Top: <strong>${escHtml(existing.jersey_top)}</strong></div>` : ''}
        ${existing.jersey_shorts ? `<div class="status-recap__row">Shorts: <strong>${escHtml(existing.jersey_shorts)}</strong>${existing.pockets ? ' (with pockets)' : ''}</div>` : ''}
      </div>` : '';
    const teamPrefInfo = existing.team_pref ? `
      <div class="status-recap">
        <div class="status-recap__label">Team Preference</div>
        <div class="status-recap__row">${existing.team_pref === 'stick' ? `Sticking with <strong>${escHtml(existing.prev_team_name || 'your team')}</strong>` : 'Open to a shuffle'}</div>
      </div>` : '';

    const body = existing.status === 'confirmed'
      ? "You're confirmed for the upcoming season. We'll reach out with next steps."
      : existing.status === 'rejected'
        ? "Unfortunately you weren't selected for this season. Keep an eye out for future seasons."
        : "You're on the waitlist. An admin will review and confirm your spot soon.";

    const extra = `
      ${jerseyInfo}${teamPrefInfo}
      ${existing.has_balance ? `<div class="balance-warn">⚠️ You have an outstanding balance of <strong>₱${Number(existing.balance_amt).toLocaleString()}</strong>. An admin will follow up about settlement before your spot is confirmed.</div>` : ''}
    `;

    return wrap(`<div class="shell-right shell-right--status">
      <div class="status-panel">
        <div class="status-panel__icon">${existing.status === 'confirmed' ? '✅' : existing.status === 'rejected' ? '😔' : '🏀'}</div>
        <h2 class="status-panel__title">Season ${escHtml(String(sigSeason))} Signup</h2>
        <p style="margin:0 0 20px"><span class="status-pill" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55">${escHtml(statusLabel)}</span></p>
        <p class="status-panel__body">${body}</p>
        ${extra}
        <a href="/me" class="btn-next" style="display:block;text-decoration:none;text-align:center">Back to My Profile</a>
      </div>
    </div>`);
  }

  if (!sigSeason || !sigOpen) {
    return wrap(statusPanel({
      icon: '🔒',
      title: 'Not Open Yet',
      body: "Season signup isn't open right now. Check back soon or watch for an announcement.",
    }));
  }

  // ── The actual form ──────────────────────────────────────────────────────
  const v = name => escHtml(prefill[name] || '');
  const checked = (name, val) => prefill[name] === val ? 'checked' : '';
  // Registrants who signed up before the /register waiver existed have no
  // waiver_agreed_at on file yet — Group 08 shows them the full waiver + signature
  // instead of the lightweight reconfirm-only version, backfilling it on submit
  // (see setWaiverAgreement in the POST /season-signup handler).
  const hasWaiverOnFile = !!reg?.waiver_agreed_at;

  const stepDefs = [
    { key: 'liveness' },
    { key: 'jersey' },
    { key: 'mindset' },
    { key: 'selfAssess' },
    ...(returning ? [{ key: 'teamPref' }] : []),
    { key: 'reshuffle' },
    { key: 'fee' },
    { key: 'waiver' },
    { key: 'contact' },
    { key: 'comments' },
  ];
  stepDefs.forEach((s, i) => { s.num = i + 1; });
  const STEP = Object.fromEntries(stepDefs.map(s => [s.key, s.num]));
  const totalSteps = stepDefs.length;

  const errorStep = (() => {
    if (!error) return STEP.liveness;
    if (/liveness|photo/i.test(error)) return STEP.liveness;
    if (/jersey|shorts|pocket/i.test(error)) return STEP.jersey;
    if (/mindset|playing this season|losing badly|ref call|teammate|feedback|benched|work on/i.test(error)) return STEP.mindset;
    if (/self-rat|scoring vs|defense vs|overall game/i.test(error)) return STEP.selfAssess;
    if (/team|reshuffle your team|stick/i.test(error)) return STEP.teamPref || STEP.jersey;
    if (/shuffle/i.test(error)) return STEP.reshuffle;
    if (/fee|payment plan/i.test(error)) return STEP.fee;
    if (/waiver|signature|fine print/i.test(error)) return STEP.waiver;
    if (/emergency|birthday|18/i.test(error)) return STEP.contact;
    return STEP.jersey;
  })();

  const sizeCell = (kind, size, name) => {
    const [meas1, meas2] = SIZE_CHART[kind][size];
    return `<label class="pick-cell">
      <input type="radio" name="${name}" value="${size}" ${checked(name, size)}>
      <span class="pick-cell__meas">${meas1}&Prime; / ${meas2}&Prime;</span>
      <span class="pick-cell__size">${size}</span>
    </label>`;
  };

  const topCells    = SIZES.map(s => sizeCell('top', s, 'jersey_top')).join('');
  const shortsCells = `<label class="pick-cell">
      <input type="radio" name="jersey_shorts" value="" ${prefill.jersey_shorts === undefined || prefill.jersey_shorts === '' ? 'checked' : ''}>
      <span class="pick-cell__meas">&nbsp;</span>
      <span class="pick-cell__size">None</span>
    </label>` + SIZES.map(s => sizeCell('shorts', s, 'jersey_shorts')).join('');

  // Jerseys aren't being charged this signup round — just collecting sizes. Total only
  // reflects the season fee; jersey cost gets added at charge time later (see teams-start).
  const initialTotal = Number(quotaAmount || 0);

  const scaleCells = (name, loLabel, hiLabel) => `<div class="pick-grid pick-grid--scale" data-field="${name}">
      ${[1, 2, 3, 4, 5].map(n => `<label class="pick-cell"><input type="radio" name="${name}" value="${n}" ${checked(name, String(n))}><span class="pick-cell__size">${n}</span></label>`).join('')}
    </div>
    <div class="pick-axis" style="display:flex;justify-content:space-between"><span>${loLabel}</span><span>${hiLabel}</span></div>`;

  const tierCells = name => `<div class="pick-grid" data-field="${name}">
      ${TIERS.map(t => `<label class="pick-cell"><input type="radio" name="${name}" value="${t}" ${checked(name, t)}><span class="pick-cell__size" style="font-size:12px">${TIER_LABELS[t]}</span></label>`).join('')}
    </div>`;

  const mindsetStep = `
      <div class="acc-item" data-item="${STEP.mindset}">
        <button type="button" class="acc-header" data-toggle="${STEP.mindset}">
          <span class="acc-num">${STEP.mindset}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Mindset &amp; Team Fit</span>
            <span class="acc-header-summary" data-summary="${STEP.mindset}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label for="q1_why_playing">Why are you playing this season? <span class="req">*</span></label>
              <textarea id="q1_why_playing" class="field__input" name="q1_why_playing" rows="2" data-required="1" data-step="${STEP.mindset}" data-minlen="10">${escHtml(prefill.q1_why_playing || '')}</textarea>
            </div>
            <div class="field">
              <label>How do you handle it when the team is losing badly? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="q2_losing_badly" value="stay_engaged" ${checked('q2_losing_badly', 'stay_engaged')}> Stay engaged</label>
              <label class="check check--radio"><input type="radio" name="q2_losing_badly" value="go_quiet" ${checked('q2_losing_badly', 'go_quiet')}> Go quiet</label>
              <label class="check check--radio"><input type="radio" name="q2_losing_badly" value="frustrated_vocal" ${checked('q2_losing_badly', 'frustrated_vocal')}> Get frustrated and vocal</label>
              <label class="check check--radio"><input type="radio" name="q2_losing_badly" value="take_over" ${checked('q2_losing_badly', 'take_over')}> Try to take over</label>
            </div>
            <div class="field">
              <label>How do you usually react to a bad call from the ref? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="q3_bad_ref_call" value="let_it_go" ${checked('q3_bad_ref_call', 'let_it_go')}> Let it go</label>
              <label class="check check--radio"><input type="radio" name="q3_bad_ref_call" value="voice_briefly" ${checked('q3_bad_ref_call', 'voice_briefly')}> Voice it briefly, then move on</label>
              <label class="check check--radio"><input type="radio" name="q3_bad_ref_call" value="argue_it" ${checked('q3_bad_ref_call', 'argue_it')}> Argue it</label>
              <label class="check check--radio"><input type="radio" name="q3_bad_ref_call" value="carry_into_plays" ${checked('q3_bad_ref_call', 'carry_into_plays')}> Carry it into the next few plays</label>
            </div>
            <div class="field">
              <label>Rate how you handle a heated moment with a teammate mid-game <span class="req">*</span></label>
              ${scaleCells('q4_heated_teammate', 'Handle it poorly', 'Handle it well')}
            </div>
            <div class="field">
              <label>When you disagree with a team decision (a rotation, a tactical call, playing time), what do you actually do? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="q8_disagreement_style" value="raise_with_group" ${checked('q8_disagreement_style', 'raise_with_group')}> Raise it right there with the group</label>
              <label class="check check--radio"><input type="radio" name="q8_disagreement_style" value="private_after" ${checked('q8_disagreement_style', 'private_after')}> Pull the coach or captain aside privately after</label>
              <label class="check check--radio"><input type="radio" name="q8_disagreement_style" value="vent_no_address" ${checked('q8_disagreement_style', 'vent_no_address')}> Vent to teammates without addressing it directly</label>
              <label class="check check--radio"><input type="radio" name="q8_disagreement_style" value="put_in_writing" ${checked('q8_disagreement_style', 'put_in_writing')}> Put it in writing — text, group chat — so there's a record</label>
              <label class="check check--radio"><input type="radio" name="q8_disagreement_style" value="sit_on_it" ${checked('q8_disagreement_style', 'sit_on_it')}> Sit on it and let it build</label>
            </div>
            <div class="field">
              <label>How do you prefer to receive feedback from a coach/captain? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="q5_feedback_style" value="direct" ${checked('q5_feedback_style', 'direct')}> Direct, in the moment</label>
              <label class="check check--radio"><input type="radio" name="q5_feedback_style" value="private" ${checked('q5_feedback_style', 'private')}> Private, after the game</label>
              <label class="check check--radio"><input type="radio" name="q5_feedback_style" value="written" ${checked('q5_feedback_style', 'written')}> Written</label>
            </div>
            <div class="field">
              <label>If a coach or captain told you a specific part of your game (shooting, defense, IQ, etc.) needs real work, how would you react? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="q9_reaction_to_criticism" value="welcome_specifics" ${checked('q9_reaction_to_criticism', 'welcome_specifics')}> Welcome it and ask for specifics</label>
              <label class="check check--radio"><input type="radio" name="q9_reaction_to_criticism" value="listen_disagree" ${checked('q9_reaction_to_criticism', 'listen_disagree')}> Listen but privately disagree</label>
              <label class="check check--radio"><input type="radio" name="q9_reaction_to_criticism" value="defensive_argue" ${checked('q9_reaction_to_criticism', 'defensive_argue')}> Get defensive or argue</label>
              <label class="check check--radio"><input type="radio" name="q9_reaction_to_criticism" value="brush_off" ${checked('q9_reaction_to_criticism', 'brush_off')}> Brush it off — I know my game</label>
            </div>
            <div class="field">
              <label>Rate how comfortable you are being benched for a rotation you don't agree with <span class="req">*</span></label>
              ${scaleCells('q6_benched_comfort', 'Uncomfortable', 'Comfortable')}
            </div>
            <div class="field">
              <label for="q7_work_on">What's one thing a past teammate would say you need to work on? <span class="req">*</span></label>
              <textarea id="q7_work_on" class="field__input" name="q7_work_on" rows="2" data-required="1" data-step="${STEP.mindset}" data-minlen="10">${escHtml(prefill.q7_work_on || '')}</textarea>
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.mindset}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>`;

  const selfAssessStep = `
      <div class="acc-item" data-item="${STEP.selfAssess}">
        <button type="button" class="acc-header" data-toggle="${STEP.selfAssess}">
          <span class="acc-num">${STEP.selfAssess}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Self-Assessment</span>
            <span class="acc-header-summary" data-summary="${STEP.selfAssess}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label>Rate your Scoring/Shooting vs. other players in the league <span class="req">*</span></label>
              ${tierCells('self_scoring')}
            </div>
            <div class="field">
              <label>Rate your Defense vs. other players in the league <span class="req">*</span></label>
              ${tierCells('self_defense')}
            </div>
            <div class="field">
              <label>Rate your Overall game vs. other players in the league <span class="req">*</span></label>
              ${tierCells('self_overall')}
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.selfAssess}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>`;

  const teamPrefStep = returning ? `
      <div class="acc-item" data-item="${STEP.teamPref}">
        <button type="button" class="acc-header" data-toggle="${STEP.teamPref}">
          <span class="acc-num">${STEP.teamPref}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Team Preference</span>
            <span class="acc-header-summary" data-summary="${STEP.teamPref}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label>You played for <strong>${escHtml(returning.team.name)}</strong> last season (Season ${escHtml(String(returning.prevSeason))}) <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="team_pref" value="stick" ${checked('team_pref', 'stick')}> Stick with ${escHtml(returning.team.name)} for Season ${escHtml(String(sigSeason))}</label>
              <label class="check check--radio"><input type="radio" name="team_pref" value="reshuffle" ${checked('team_pref', 'reshuffle')}> I'm open to being shuffled onto a different team</label>
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.teamPref}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>` : '';

  return `<div class="shell">
  ${shellLeft({ sigSeason, deadline, seasonFormat, quotaAmount, capacityPct })}

  <div class="shell-right">
    <div class="form-start-anchor" aria-hidden="true"><span>&#128071;</span> Fill Out Your Sign-Up</div>

    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}

    <form id="signup-form" method="POST" action="/season-signup" novalidate>

      <div class="acc-item" data-item="${STEP.liveness}">
        <button type="button" class="acc-header" data-toggle="${STEP.liveness}">
          <span class="acc-num">${STEP.liveness}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Liveness Check</span>
            <span class="acc-header-summary" data-summary="${STEP.liveness}">${existingLivenessCapture ? 'Already captured' : ''}</span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <p style="margin:0;font-size:13px;color:var(--text-muted);line-height:1.6">A quick photo helps admin confirm it's really you signing up &mdash; not an ID check, just a reference photo they can glance at next to your profile picture. <strong style="color:var(--text)">No automated matching, no pass/fail.</strong></p>
            <label class="check">
              <input type="checkbox" id="lv-consent">
              <span>I understand a photo will be captured for admin's reference only &mdash; stored securely, never shown publicly, never sent anywhere else, and replaced if I do this again in a future season.</span>
            </label>
            <p style="font-size:11px;color:var(--text-subtle);margin:-4px 0 0">Separate from the liability waiver above &mdash; this consent covers the photo specifically.</p>

            <div id="lv-idle" ${existingLivenessCapture ? 'class="hidden"' : ''}>
              <div class="lv-cam-wrap" id="lv-cam-wrap">
                ${livenessPrompt ? `<p class="lv-prompt">📸 <strong>${escHtml(livenessPrompt)}</strong></p>` : ''}
                <video id="lv-video" autoplay playsinline muted class="hidden"></video>
                <canvas id="lv-canvas" class="hidden"></canvas>
                <img id="lv-preview" class="hidden" alt="Captured photo preview">
                <span id="lv-placeholder" class="lv-placeholder">Check the box above to continue</span>
                <div id="lv-qr-panel" class="hidden lv-qr-overlay">
                  <img id="lv-qr-img" alt="QR code" style="width:180px;height:180px;border-radius:8px;background:#fff;padding:8px">
                  <p style="font-size:12px;color:var(--text-muted);margin:0">Scan with your phone's camera, take the photo there &mdash; this page updates automatically once it's in.</p>
                </div>
                <div class="lv-action-row" id="lv-action-row">
                  <button type="button" class="lv-icon-btn" id="lv-start-btn" disabled title="Enable Camera">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span>Camera</span>
                  </button>
                  <button type="button" class="lv-icon-btn lv-icon-btn--ghost" id="lv-qr-btn" disabled title="Use My Phone Instead">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                    <span>Phone</span>
                  </button>
                </div>
              </div>
              <button type="button" class="btn-next hidden" id="lv-capture-btn">Capture</button>
              <div class="row hidden" id="lv-confirm-row" style="display:flex;gap:10px">
                <button type="button" class="btn-next" id="lv-retake-btn" style="flex:1;background:var(--surface-2);color:var(--text)">Retake</button>
                <button type="button" class="btn-next" id="lv-use-btn" style="flex:1">Use This Photo</button>
              </div>
              <div class="reg-field-error" id="lv-error"></div>
            </div>
            <div id="lv-done" class="${existingLivenessCapture ? '' : 'hidden'}" style="display:flex;align-items:center;gap:8px;padding:10px 0;color:#22c55e;font-size:13px;font-weight:600">
              <span>&#10003;</span><span id="lv-done-text">Photo captured.</span>
            </div>

            <input type="hidden" name="liveness_captured" id="liveness_captured_input" value="${existingLivenessCapture ? 'on' : ''}">
            <div class="nav">
              <button type="button" class="btn-next" data-continue="${STEP.liveness}">Continue &rarr;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="${STEP.jersey}">
        <button type="button" class="acc-header" data-toggle="${STEP.jersey}">
          <span class="acc-num">${STEP.jersey}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Jersey Selection</span>
            <span class="acc-header-summary" data-summary="${STEP.jersey}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label>Jersey Top <span class="req">*</span></label>
              <div class="pick-grid" data-field="jersey_top">${topCells}</div>
              <div class="pick-axis">Chest / Length, inches</div>
            </div>
            <div class="field">
              <label>Shorts <span style="opacity:.5;font-size:11px;text-transform:none;letter-spacing:normal">(optional)</span></label>
              <div class="pick-grid" data-field="jersey_shorts">${shortsCells}</div>
              <div class="pick-axis">Hips / Length, inches</div>
            </div>
            <label class="check pockets-check is-disabled" id="pockets-check">
              <input type="checkbox" name="pockets" value="1" ${prefill.pockets === '1' ? 'checked' : ''} id="pockets-input">
              <span>Add pockets to shorts</span>
            </label>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.jersey}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>

      ${mindsetStep}
      ${selfAssessStep}
      ${teamPrefStep}

      <div class="acc-item" data-item="${STEP.reshuffle}">
        <button type="button" class="acc-header" data-toggle="${STEP.reshuffle}">
          <span class="acc-num">${STEP.reshuffle}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">League Shuffle Poll</span>
            <span class="acc-header-summary" data-summary="${STEP.reshuffle}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label>Would you support a full league shuffle for Season ${escHtml(String(sigSeason))}? <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="reshuffle_vote" value="yes" ${checked('reshuffle_vote', 'yes')}> Yes, I'm open to a full shuffle</label>
              <label class="check check--radio"><input type="radio" name="reshuffle_vote" value="no" ${checked('reshuffle_vote', 'no')}> No, keep teams mostly as-is</label>
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.reshuffle}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="${STEP.fee}">
        <button type="button" class="acc-header" data-toggle="${STEP.fee}">
          <span class="acc-num">${STEP.fee}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Fee Acknowledgment &amp; Payment Plan</span>
            <span class="acc-header-summary" data-summary="${STEP.fee}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="fee-total">
              <span class="fee-total__label">Total due at season start</span>
              <span class="fee-total__amt" id="fee-total">${fmtMoney(initialTotal)}</span>
            </div>
            ${hasBalance ? `<div class="balance-warn">⚠️ You have an unpaid balance of <strong>₱${Number(balanceAmt).toLocaleString()}</strong> from a previous season. You can still sign up &mdash; an admin will follow up about settling this before your spot is confirmed.</div>` : ''}
            <label class="check">
              <input type="checkbox" name="quota_ack" value="1" ${prefill.quota_ack === '1' ? 'checked' : ''}>
              <span>I understand the season fee shown above will be charged to my account once my spot is confirmed and the season starts. <span class="req">*</span></span>
            </label>
            <div class="field">
              <label>Payment Plan <span class="req">*</span></label>
              <label class="check check--radio"><input type="radio" name="payment_plan" value="full" ${checked('payment_plan', 'full')}> Pay in full upfront</label>
              <label class="check check--radio"><input type="radio" name="payment_plan" value="installment" ${checked('payment_plan', 'installment')}> Request an installment plan</label>
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.fee}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="${STEP.waiver}">
        <button type="button" class="acc-header" data-toggle="${STEP.waiver}">
          <span class="acc-num">${STEP.waiver}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Waiver Reconfirmation</span>
            <span class="acc-header-summary" data-summary="${STEP.waiver}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            ${hasWaiverOnFile ? `
            <p style="margin:0;font-size:13px;color:var(--text-muted);line-height:1.6">You agreed to the League's Liability Waiver &amp; Assumption of Risk when you registered. It stays in effect for as long as you're an active member &mdash; we just ask you to reconfirm it each season.</p>
            <label class="check">
              <input type="checkbox" name="waiver_agree">
              <span>I reconfirm that the Liability Waiver &amp; Assumption of Risk I agreed to at registration still applies for Season ${escHtml(String(sigSeason))}.</span>
            </label>
            ` : `
            <p style="margin:0 0 8px;font-size:13px;color:var(--text-muted);line-height:1.6">We don't have a signed waiver on file for you yet &mdash; please read and agree below before continuing.</p>
            <div class="field">
              <label>Liability Waiver &amp; Assumption of Risk <span class="req">*</span></label>
              <div class="waiver-box">
                <p><strong>1. Assumption of Risk.</strong> Basketball is a physical contact sport that carries inherent risks of injury, including but not limited to sprains, fractures, collisions, and other physical harm. By participating in WKND Basketball League ("the League") activities &mdash; games, practices, and Papawis pickup sessions &mdash; I voluntarily assume all such risks, foreseeable or not.</p>
                <p><strong>2. Release of Liability.</strong> To the fullest extent permitted by law, I release and hold harmless the League, its organizers, coaches, and fellow participants from claims, damages, or liability arising from my participation, except where caused by gross negligence or willful misconduct.</p>
                <p><strong>3. Medical Fitness.</strong> I confirm I am physically fit to participate and am not aware of any medical condition that would make participation unsafe. I am responsible for my own health insurance and any medical costs arising from participation.</p>
                <p><strong>4. Photo/Video.</strong> Games and events may be photographed or recorded for the League's social media and promotional use. By participating, I consent to this unless I notify admin otherwise in writing.</p>
                <p><strong>5. Code of Conduct.</strong> I agree to follow the League's conduct policies and understand that violations may result in fines or removal from the League, per its published rules.</p>
                <p>This waiver applies to all League activities for as long as I remain an active member, reconfirmed each season.</p>
              </div>
              <p style="font-size:11px;color:var(--text-subtle);margin:8px 0 0">This is a template, not a substitute for real legal advice specific to your jurisdiction.</p>
            </div>
            <label class="check">
              <input type="checkbox" name="waiver_agree">
              <span>I have read and agree to the Liability Waiver &amp; Assumption of Risk above.</span>
            </label>
            <div class="field">
              <label for="waiver_signature">Type Your Full Legal Name as Your Signature <span class="req">*</span></label>
              <input id="waiver_signature" class="field__input" type="text" name="waiver_signature" value="${v('waiver_signature')}" placeholder="Juan Miguel dela Cruz" data-required="1" data-step="${STEP.waiver}">
            </div>
            `}
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.waiver}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="${STEP.contact}">
        <button type="button" class="acc-header" data-toggle="${STEP.contact}">
          <span class="acc-num">${STEP.contact}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Contact &amp; Eligibility Reconfirmation</span>
            <span class="acc-header-summary" data-summary="${STEP.contact}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="grid-2">
              <div class="field">
                <label for="emergency_name">Emergency Contact Name <span class="req">*</span></label>
                <input id="emergency_name" class="field__input" type="text" name="emergency_name" value="${prefill.emergency_name !== undefined ? v('emergency_name') : escHtml(reg?.emergency_name || '')}" placeholder="Full name" data-required="1" data-step="${STEP.contact}">
              </div>
              <div class="field">
                <label for="emergency_phone">Emergency Contact Number <span class="req">*</span></label>
                <input id="emergency_phone" class="field__input" type="tel" name="emergency_phone" value="${prefill.emergency_phone !== undefined ? v('emergency_phone') : escHtml(reg?.emergency_phone || '')}" placeholder="09XX XXX XXXX" data-required="1" data-step="${STEP.contact}">
              </div>
            </div>
            <div class="field">
              <label for="birthday">Confirm Your Birthday <span class="req">*</span></label>
              <input id="birthday" class="field__input" type="date" name="birthday" value="${prefill.birthday !== undefined ? v('birthday') : escHtml(reg?.birthday || '')}" data-required="1" data-step="${STEP.contact}">
            </div>
            <div class="nav"><button type="button" class="btn-next" data-continue="${STEP.contact}">Continue &rarr;</button></div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="${STEP.comments}">
        <button type="button" class="acc-header" data-toggle="${STEP.comments}">
          <span class="acc-num">${STEP.comments}</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Comments or Suggestions</span>
            <span class="acc-header-summary" data-summary="${STEP.comments}"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label for="comments">Anything else you'd like us to know? <span style="opacity:.5;font-size:11px;text-transform:none;letter-spacing:normal">(optional)</span></label>
              <textarea id="comments" class="field__input" name="comments" rows="3" placeholder="Format ideas, scheduling gripes, shout-outs — whatever.">${escHtml(prefill.comments || '')}</textarea>
            </div>
            <div class="nav"><button type="submit" class="btn-next" id="submit-btn">Count Me In for Season ${escHtml(String(sigSeason))} &rarr;</button></div>
            <p style="text-align:center;font-size:11px;color:var(--text-subtle);margin:0">Signing up puts you on the waitlist &mdash; not a guarantee of a spot.</p>
          </div>
        </div>
      </div>

    </form>
  </div>
</div>
${stylesBlock}

<script>
(function () {
  var form  = document.getElementById('signup-form');
  var items = Array.prototype.slice.call(form.querySelectorAll('.acc-item'));
  var totalSteps = ${totalSteps};
  var errorStep = ${errorStep};
  var STEP = ${JSON.stringify(STEP)};
  var state = {};
  items.forEach(function (el) {
    var n = parseInt(el.dataset.item, 10);
    state[n] = n < errorStep ? 'done' : (n === errorStep ? 'open' : 'pending');
  });

  // ── Liveness Check (Group 00) — fully discretionary, never blocks Continue. Inline
  // capture posts straight to /season-signup/liveness-capture as soon as confirmed, and
  // the QR path opens a WebSocket to /ws/liveness/:token and waits for the phone's capture
  // to land — same shared infra as the mobile page at views/liveness-mobile.js. Required —
  // Continue is gated on liveness_captured (see validateStep) via either path.
  (function () {
    var consent      = document.getElementById('lv-consent');
    var startBtn     = document.getElementById('lv-start-btn');
    var qrBtn        = document.getElementById('lv-qr-btn');
    var captureBtn   = document.getElementById('lv-capture-btn');
    var confirmRow   = document.getElementById('lv-confirm-row');
    var retakeBtn    = document.getElementById('lv-retake-btn');
    var useBtn       = document.getElementById('lv-use-btn');
    var video        = document.getElementById('lv-video');
    var canvas       = document.getElementById('lv-canvas');
    var preview      = document.getElementById('lv-preview');
    var placeholder  = document.getElementById('lv-placeholder');
    var qrPanel      = document.getElementById('lv-qr-panel');
    var qrImg        = document.getElementById('lv-qr-img');
    var errorEl      = document.getElementById('lv-error');
    var idleWrap     = document.getElementById('lv-idle');
    var doneWrap     = document.getElementById('lv-done');
    var doneText     = document.getElementById('lv-done-text');
    var capturedInput = document.getElementById('liveness_captured_input');
    if (!consent) return;

    var stream = null, dataUrl = null, ws = null;

    function setError(msg) { errorEl.textContent = msg || ''; }

    // getUserMedia on an insecure origin (http://, and not literally "localhost") throws
    // SYNCHRONOUSLY because navigator.mediaDevices itself is undefined there — that throw
    // happens before any promise exists, so a plain .then()/.catch() never runs and the UI
    // was silently stuck with no error shown. This wraps the call so that failure mode (and
    // a hung permission prompt) both surface as a real, visible error instead of a freeze.
    function requestCamera(constraints, onResult) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onResult(null, 'insecure-context');
        return;
      }
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        onResult(null, 'timeout');
      }, 12000);
      navigator.mediaDevices.getUserMedia(constraints).then(function (s) {
        clearTimeout(timer);
        if (settled) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        settled = true;
        onResult(s, null);
      }).catch(function (err) {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        onResult(null, (err && err.name) || 'error');
      });
    }

    function cameraErrorMessage(reason) {
      if (reason === 'insecure-context') return 'Camera access needs a secure connection — try the phone option below instead.';
      if (reason === 'timeout') return 'The camera permission prompt took too long to respond. Try again, or use the phone option below.';
      if (reason === 'NotAllowedError') return "Camera access was denied — check your browser's permission settings, or try the phone option below.";
      if (reason === 'NotFoundError') return 'No camera was found on this device — try the phone option below.';
      return "Couldn't access the camera — try the phone option below.";
    }

    function markDone(text) {
      idleWrap.classList.add('hidden');
      doneWrap.classList.remove('hidden');
      doneText.textContent = text;
      capturedInput.value = 'on';
      setError('');
      var summary = document.querySelector('[data-summary="' + STEP.liveness + '"]');
      if (summary) summary.textContent = 'Captured';
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    }

    consent.addEventListener('change', function () {
      startBtn.disabled = !consent.checked;
      qrBtn.disabled = !consent.checked;
      placeholder.textContent = consent.checked ? 'Ready when you are' : 'Check the box above to continue';
    });

    startBtn.addEventListener('click', function () {
      setError('');
      requestCamera({ video: { facingMode: 'user' }, audio: false }, function (s, reason) {
        if (!s) {
          setError(cameraErrorMessage(reason));
          return;
        }
        stream = s;
        video.srcObject = s;
        placeholder.classList.add('hidden');
        video.classList.remove('hidden');
        startBtn.classList.add('hidden');
        qrBtn.classList.add('hidden');
        captureBtn.classList.remove('hidden');
      });
    });

    captureBtn.addEventListener('click', function () {
      // Capturing at the camera's native resolution (some phone rear cameras report several
      // thousand px wide) produced base64 payloads that occasionally blew past the server's
      // upload size limit — Express rejected the request before the route handler ever ran,
      // so the client saw a non-JSON error response and just reported "Network error", hiding
      // the real cause. This is a casual reference photo, not something that needs full
      // camera resolution, so cap the longest side instead of shipping the raw frame.
      var LV_MAX_DIM = 900;
      var lvScale = Math.min(1, LV_MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * lvScale);
      canvas.height = Math.round(video.videoHeight * lvScale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      preview.src = dataUrl;
      preview.classList.remove('hidden');
      video.classList.add('hidden');
      captureBtn.classList.add('hidden');
      confirmRow.classList.remove('hidden');
    });

    retakeBtn.addEventListener('click', function () {
      dataUrl = null;
      preview.classList.add('hidden');
      video.classList.remove('hidden');
      confirmRow.classList.add('hidden');
      captureBtn.classList.remove('hidden');
    });

    useBtn.addEventListener('click', function () {
      if (!dataUrl) return;
      useBtn.disabled = true; retakeBtn.disabled = true;
      setError('');
      fetch('/season-signup/liveness-capture', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          useBtn.disabled = false; retakeBtn.disabled = false;
          if (!res.ok) { setError(res.d.error || 'Could not save photo.'); return; }
          markDone('Photo captured.');
        })
        .catch(function () {
          useBtn.disabled = false; retakeBtn.disabled = false;
          setError('Network error — try again.');
        });
    });

    qrBtn.addEventListener('click', function () {
      setError('');
      qrBtn.disabled = true;
      fetch('/season-signup/liveness-token', { method: 'POST' })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          qrBtn.disabled = false;
          if (!res.ok) { setError(res.d.error || 'Could not generate QR code.'); return; }
          qrImg.src = res.d.qrDataUrl;
          qrPanel.classList.remove('hidden');
          startBtn.classList.add('hidden');
          qrBtn.classList.add('hidden');
          placeholder.classList.add('hidden');

          var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
          ws = new WebSocket(proto + '//' + location.host + '/ws/liveness/' + encodeURIComponent(res.d.token));
          ws.onmessage = function (ev) {
            try {
              var msg = JSON.parse(ev.data);
              if (msg.type === 'captured') markDone('Photo received from your phone.');
            } catch (e) {}
          };
        })
        .catch(function () {
          qrBtn.disabled = false;
          setError('Network error — try again.');
        });
    });

  })();

  function render() {
    items.forEach(function (el) {
      var n = el.dataset.item;
      el.classList.remove('is-open', 'is-done', 'is-pending');
      el.classList.add('is-' + state[n]);
    });
  }

  function openOnly(n) {
    Object.keys(state).forEach(function (k) { if (state[k] === 'open') state[k] = 'done'; });
    state[n] = 'open';
    render();
  }

  function checkedVal(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function updatePocketsGate() {
    var shorts = checkedVal('jersey_shorts');
    var wrap = document.getElementById('pockets-check');
    var input = document.getElementById('pockets-input');
    var enabled = !!shorts;
    wrap.classList.toggle('is-disabled', !enabled);
    if (!enabled) input.checked = false;
  }

  function summarize(n) {
    var el = document.querySelector('[data-summary="' + n + '"]');
    if (!el) return;
    if (n == STEP.jersey) {
      var top = checkedVal('jersey_top'), shorts = checkedVal('jersey_shorts');
      var parts = [];
      if (top) parts.push(top + ' top');
      if (shorts) parts.push(shorts + ' shorts');
      el.textContent = parts.length ? parts.join(' · ') : 'No jersey selected';
    }
    if (n == STEP.mindset) {
      el.textContent = 'Saved';
    }
    if (n == STEP.selfAssess) {
      el.textContent = 'Saved';
    }
    if (STEP.teamPref && n == STEP.teamPref) {
      var pref = checkedVal('team_pref');
      el.textContent = pref === 'stick' ? 'Sticking with your team' : pref === 'reshuffle' ? 'Open to shuffle' : '';
    }
    if (n == STEP.reshuffle) {
      var vote = checkedVal('reshuffle_vote');
      el.textContent = vote === 'yes' ? 'Voted yes' : vote === 'no' ? 'Voted no' : '';
    }
    if (n == STEP.fee) {
      var plan = checkedVal('payment_plan');
      el.textContent = plan === 'full' ? 'Paying in full' : plan === 'installment' ? 'Installment plan' : '';
    }
    if (n == STEP.waiver) {
      el.textContent = 'Reconfirmed';
    }
    if (n == STEP.contact) {
      var nm = form.querySelector('#emergency_name').value.trim();
      el.textContent = nm ? 'Saved · ' + nm : 'Saved';
    }
  }

  function fieldError(f, msg) {
    var err = f.parentElement.querySelector('.reg-field-error');
    if (!err) { err = document.createElement('div'); err.className = 'reg-field-error'; f.parentElement.appendChild(err); }
    if (msg) { err.textContent = msg; f.classList.add('reg-invalid'); }
    else { err.textContent = ''; f.classList.remove('reg-invalid'); }
  }

  function radioGroupError(container, name, msg) {
    var wrap = container.querySelector('[data-field="' + name + '"]') || container;
    var err = wrap.parentElement.querySelector('.reg-field-error.rg-' + name) || (function () {
      var e = document.createElement('div');
      e.className = 'reg-field-error rg-' + name;
      wrap.after(e);
      return e;
    })();
    err.textContent = msg || '';
  }

  function validateStep(n) {
    var ok = true;
    var textFields = form.querySelectorAll('[data-step="' + n + '"][data-required]');
    textFields.forEach(function (f) {
      var val = f.value.trim();
      var minlen = parseInt(f.dataset.minlen || '0', 10);
      if (!val) { fieldError(f, 'This one is not optional.'); ok = false; }
      else if (minlen && val.length < minlen) { fieldError(f, 'A real answer, please — a couple sentences is plenty.'); ok = false; }
      else { fieldError(f, ''); }
    });

    if (n == STEP.liveness) {
      var capturedEl = form.querySelector('[name="liveness_captured"]');
      var captured = !!(capturedEl && capturedEl.value === 'on');
      var lvErrEl = document.getElementById('lv-error');
      if (lvErrEl) lvErrEl.textContent = captured ? '' : 'Take a photo (or use your phone) before continuing.';
      if (!captured) ok = false;
    }
    if (n == STEP.jersey) {
      var hasTop = !!checkedVal('jersey_top');
      radioGroupError(form, 'jersey_top', hasTop ? '' : 'Pick a jersey top size.');
      if (!hasTop) ok = false;
    }
    if (n == STEP.mindset) {
      ['q2_losing_badly', 'q3_bad_ref_call', 'q4_heated_teammate', 'q8_disagreement_style', 'q5_feedback_style', 'q9_reaction_to_criticism', 'q6_benched_comfort'].forEach(function (name) {
        if (!checkedVal(name)) ok = false;
      });
    }
    if (n == STEP.selfAssess) {
      ['self_scoring', 'self_defense', 'self_overall'].forEach(function (name) {
        if (!checkedVal(name)) ok = false;
      });
    }
    if (STEP.teamPref && n == STEP.teamPref) {
      if (!checkedVal('team_pref')) ok = false;
    }
    if (n == STEP.reshuffle) {
      if (!checkedVal('reshuffle_vote')) ok = false;
    }
    if (n == STEP.fee) {
      var ackEl = form.querySelector('[name="quota_ack"]');
      if (!ackEl.checked) ok = false;
      if (!checkedVal('payment_plan')) ok = false;
    }
    if (n == STEP.waiver) {
      var waiverAgreeEl = form.querySelector('[name="waiver_agree"]');
      if (!waiverAgreeEl.checked) ok = false;
    }
    if (n == STEP.contact) {
      var phoneEl = form.querySelector('#emergency_phone');
      var phone = phoneEl.value.replace(/[\\s-]/g, '');
      if (phone && !/^(?:\\+63|0)9\\d{9}$/.test(phone)) {
        fieldError(phoneEl, 'Enter a valid PH mobile number.');
        ok = false;
      }
      var bdayEl = form.querySelector('#birthday');
      if (bdayEl.value) {
        var dob = new Date(bdayEl.value);
        var age18 = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
        if (new Date() < age18) {
          fieldError(bdayEl, 'You must be 18+ to sign up.');
          ok = false;
        }
      }
    }
    return ok;
  }

  form.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = btn.dataset.toggle;
      if (state[n] === 'pending' || state[n] === 'open') return;
      openOnly(n);
    });
  });

  form.querySelectorAll('[data-continue]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = btn.dataset.continue;
      if (!validateStep(parseInt(n, 10))) return;
      summarize(n);
      state[n] = 'done';
      var next = String(parseInt(n, 10) + 1);
      if (state[next] !== undefined) { state[next] = 'open'; render(); }
    });
  });

  // Every step lives in the same <form> (just hidden via .is-pending), so a plain text
  // input anywhere in it would otherwise trigger the browser's native "Enter submits the
  // form" behavior straight through to the final submit button, skipping every step in
  // between. Redirect Enter to whichever step is actually open instead.
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    var openStep = Object.keys(state).filter(function (k) { return state[k] === 'open'; })[0];
    var btn = openStep && form.querySelector('[data-continue="' + openStep + '"]');
    if (btn) btn.click();
  });

  form.addEventListener('submit', function (e) {
    if (!validateStep(totalSteps)) e.preventDefault();
  });

  form.addEventListener('change', function (e) {
    if (e.target.name === 'jersey_top' || e.target.name === 'jersey_shorts' || e.target.name === 'pockets') {
      updatePocketsGate();
    }
  });

  form.addEventListener('input', function (e) {
    var err = e.target.parentElement && e.target.parentElement.querySelector('.reg-field-error');
    if (err) err.textContent = '';
    e.target.classList.remove('reg-invalid');
  });

  render();
  updatePocketsGate();
  Object.keys(state).forEach(function (n) { if (state[n] === 'done') summarize(n); });
})();
</script>`;
}
