import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { logEmailAttempt, markEmailSent, markEmailFailed, markEmailRetrying, getEmailLogById, getFailedEmails } from './portal-db.js';

const {
  RESEND_API_KEY,
  // Backup provider over plain SMTP (Brevo, Gmail app password, SES…). Used when Resend
  // refuses a send for quota/outage reasons, or always when MAIL_PROVIDER=smtp.
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASS,
  // auto (default): Resend first, SMTP on quota/outage · resend: Resend only · smtp: SMTP only
  MAIL_PROVIDER = 'auto',
  CONTACT_EMAIL = 'pao@wkndbasketball.com',
  // Deliberately its own fixed address, not derived from CONTACT_EMAIL — this is the "from"
  // on automated transactional mail (payment confirmations, game notifications) that no one's
  // meant to reply to, while CONTACT_EMAIL is the address people actually read/reply to.
  SMTP_FROM = 'WKND Basketball <noreply@wkndbasketball.com>',
  NODE_ENV,
} = process.env;

const MODE = ['resend', 'smtp'].includes(MAIL_PROVIDER) ? MAIL_PROVIDER : 'auto';
const smtp = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;
const useResend = !!RESEND_API_KEY && MODE !== 'smtp';
const useSmtp   = !!smtp && MODE !== 'resend';
const enabled   = useResend || useSmtp;
const IS_DEV = NODE_ENV !== 'production';
const DEV_EMAIL_TO = CONTACT_EMAIL;
// Where admin "send a test to me" previews go (e.g. /admin/birthdays), in every environment.
export const ADMIN_TEST_EMAIL = CONTACT_EMAIL;

// attachments: [{ filename, content }] — content is base64 WITHOUT the "data:...;base64,"
// prefix (Resend wants the raw base64 payload). Real attachments instead of an inline
// data: URI <img> — Gmail's webmail strips/refuses to render inline data: URIs in
// received mail even though the same markup renders fine in a plain browser.
//
// Outside production, every email is redirected here instead of the real recipient —
// nothing should ever land in an actual player's inbox from a dev/test run — with the
// originally-intended address appended to the body so it's still visible for debugging.
// headers: optional extra email headers, e.g. List-Unsubscribe on bulk Papawis emails.
// kind/ref: optional tags stored in email_log, so webhook events (delivered/opened/
// bounced — POST /webhooks/resend) can be shown against the thing the email was about.
// Templates set kind themselves; callers pass ref (e.g. registration id).
// broadcastId: the campaign (broadcasts table, lib/broadcast.js) this email belongs to;
// recorded on email_log so the per-player caps and the Sent log can count it.
//
// Every attempt is logged under our own id (em_…) before it goes out, then marked sent or
// failed. A failed one keeps the full message so retryEmail() can send it later. Returns
// { id, provider, providerId }; throws on failure, as before.
export async function sendMail({ to, subject, html, attachments, headers, kind = '', ref = '', broadcastId = '' }) {
  if (!enabled) {
    console.log(`[mailer] no mail provider configured — skipping email to ${to}: ${subject}`);
    return;
  }
  const id = `em_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
  dbSafe(() => logEmailAttempt({ id, to, subject, kind, ref, broadcastId }));
  return deliverLogged(id, { to, subject, html, attachments, headers });
}

// Sends a failed email again under the same id. Throws if it isn't a failed email, or if
// this attempt fails too (the row is marked failed again with the new error).
export async function retryEmail(id) {
  const row = getEmailLogById(id);
  if (!row || row.status !== 'failed' || !row.payload) throw new Error('Not a failed email with a saved message.');
  if (!enabled) throw new Error('No mail provider configured.');
  if (!markEmailRetrying(id)) throw new Error('Already being retried.');
  return deliverLogged(id, JSON.parse(row.payload));
}

// Retries every failed email (optionally one campaign's), paced like the group sends.
export async function retryFailedEmails({ broadcastId = null } = {}) {
  let sent = 0, failed = 0;
  for (const [i, row] of getFailedEmails({ broadcastId }).entries()) {
    if (i) await new Promise(r => setTimeout(r, 600));
    try { await retryEmail(row.id); sent++; }
    catch (e) { failed++; console.error(`[mailer] retry ${row.id} to ${row.to_email}: ${e.message}`); }
  }
  return { sent, failed };
}

// Logging must never stop an email going out (or hide why it failed).
function dbSafe(fn) {
  try { fn(); } catch (e) { console.error('[mailer] email_log write failed:', e.message); }
}

async function deliverLogged(id, message) {
  try {
    const { provider, providerId } = await deliver(message);
    dbSafe(() => markEmailSent(id, { provider, providerId }));
    return { id, provider, providerId };
  } catch (e) {
    dbSafe(() => markEmailFailed(id, { error: e.message, payload: JSON.stringify(message) }));
    throw e;
  }
}

// message is what the caller asked for; the dev redirect is applied here, at send time, so
// a failed message saved in production and retried there still goes to the real recipient.
async function deliver({ to, subject, html, attachments, headers }) {
  const msg = {
    to: IS_DEV ? DEV_EMAIL_TO : to,
    subject,
    html: IS_DEV
      ? `${html}<p style="font:12px Arial,sans-serif;color:#f59332;margin:16px 0 0;padding-top:12px;border-top:1px solid #1e293b">[DEV MODE] Intended recipient: ${to}</p>`
      : html,
    attachments,
    headers,
  };
  if (useResend && !resendPaused()) {
    try {
      const data = await sendViaResend(msg);
      return { provider: 'resend', providerId: data.id };
    } catch (e) {
      if (!e.failover || !useSmtp) throw e;
      console.warn(`[mailer] Resend failed (${e.message}) — sending via SMTP instead`);
    }
  } else if (!useSmtp) {
    throw new Error(`Resend paused until ${new Date(resendPausedUntil).toISOString()} (quota) and no SMTP backup configured`);
  }
  return { provider: 'smtp', providerId: await sendViaSmtp(msg) };
}

// Once Resend says the quota is used up, skip it until the next UTC midnight (when its
// daily allowance resets) instead of spending a failed round-trip on every email.
let resendPausedUntil = 0;
const resendPaused = () => Date.now() < resendPausedUntil;

// Which provider handles mail right now, for logs/admin.
export function mailStatus() {
  return { mode: MODE, resend: useResend, smtp: useSmtp, resendPausedUntil: resendPaused() ? resendPausedUntil : 0 };
}

async function sendViaResend({ to, subject, html, attachments, headers }) {
  let res, data;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: SMTP_FROM, to, subject, html, ...(attachments?.length ? { attachments } : {}), ...(headers ? { headers } : {}) }),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    // Network error / Resend unreachable: worth trying the backup.
    throw Object.assign(new Error(e.message), { failover: true });
  }
  if (res.ok) return data;
  const err = new Error(data.message || `Resend API error (${res.status})`);
  // 429 = rate limit or daily/monthly quota; 5xx = Resend outage. A 4xx like a bad
  // address would fail on the backup too, so those are thrown as-is.
  if (res.status === 429 || res.status >= 500) err.failover = true;
  if (res.status === 429 && /quota/i.test(`${data.name} ${data.message}`)) {
    const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
    resendPausedUntil = midnight.getTime();
    console.warn(`[mailer] Resend quota reached — using SMTP until ${midnight.toISOString()}`);
  }
  throw err;
}

async function sendViaSmtp({ to, subject, html, attachments, headers }) {
  const info = await smtp.sendMail({
    from: SMTP_FROM, to, subject, html, headers,
    // Same { filename, content: base64 } shape the Resend path takes.
    attachments: attachments?.map(a => ({ filename: a.filename, content: a.content, encoding: 'base64' })),
  });
  return info.messageId;
}

// ── Email templates ───────────────────────────────────────────────────────────

// Shared header for every email: the WKND wordmark (public/email/wknd-logo.png, rendered
// from wkndLogo() in views/layout.js at 2x, since Gmail won't show SVG) on navy with an
// amber rule. Served from the live site, so a new logo only shows once it's deployed.
// The alt text is styled so the header still reads "WKND Basketball" with images off.
const EMAIL_LOGO_URL = `${(process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '')}/email/wknd-logo.png`;
// The amber rule under the header glows in the middle and fades into the navy at both edges
// (opaque stops, so the solid fallback color never shows through), with a
// faint amber haze rising from it into the header. Clients without CSS gradients (Outlook
// on Windows) fall back to the plain navy header and a solid amber line.
// The navy is also painted as a solid gradient layer under the haze: Gmail's dark-mode color
// inversion (iOS) flips background-color to near-white but leaves gradients alone, and the
// white logo PNG vanished on the flipped header. The gradient keeps the header navy there.
function emailHeader(label = '') {
  return `<div style="background-color:#0d1424;background-image:radial-gradient(ellipse 60% 90% at 50% 100%,rgba(245,147,50,.16) 0%,rgba(245,147,50,0) 100%),linear-gradient(#0d1424,#0d1424);padding:18px 28px">
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:middle"><img src="${EMAIL_LOGO_URL}" width="123" height="24" alt="WKND Basketball" style="display:block;border:0;width:123px;height:24px;color:#f1f5f9;font-family:Arial,sans-serif;font-size:16px;font-weight:800"></td>
      ${label ? `<td style="vertical-align:middle;text-align:right;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f59332">${label}</td>` : ''}
    </tr></table>
  </div>
  <div style="height:3px;line-height:3px;font-size:0;background-color:#f59332;background-image:linear-gradient(90deg,#0d1424 0%,#8c5a2c 22%,#ffb36b 50%,#8c5a2c 78%,#0d1424 100%)">&nbsp;</div>`;
}

export function approvedEmail({ name, setPasswordUrl }) {
  return {
    kind: 'approved',
    subject: "You're in — WKND Basketball",
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Welcome to the league, ${name}!</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8">
      Your registration has been approved. Click below to set your password and access your player profile, stats, and everything else on the portal.
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#64748b">This link expires in 48 hours.</p>
    <a href="${setPasswordUrl}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      Set Your Password →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

export function jerseyRequestEmail({ name, formUrl, teamName = '' }) {
  return {
    kind: 'jersey_request',
    subject: 'Jersey details needed — WKND Basketball',
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">We need your jersey details, ${name}</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8">
      ${teamName ? `You're on <strong style="color:#e2e8f0">${teamName}</strong> next season, and we ` : "We "}need your jersey size, number, and the name to print on the back before we can order it.
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#64748b">This link doesn't require logging in.</p>
    <a href="${formUrl}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      Fill In Jersey Details →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

export function resetPasswordEmail({ name, setPasswordUrl, isReset = false }) {
  return {
    kind: 'set_password',
    subject: isReset ? 'Reset your password — WKND Basketball' : 'Set your password — WKND Basketball',
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Hi ${name},</h2>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#94a3b8">
      ${isReset ? 'Use the link below to set a new password for your account.' : 'Use the link below to set your password and access your player profile, stats, and everything else on the portal.'}
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#64748b">This link expires in 48 hours.</p>
    <a href="${setPasswordUrl}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      ${isReset ? 'Reset Your Password →' : 'Set Your Password →'}
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

export function seasonQualifiedEmail({
  name, season, teamName = '',
  quotaAmount = 0, topAmount = 0, jerseyTop = '', shortsAmount = 0, jerseyShorts = '', pockets = false,
  extraAmount = 0, extraLabel = '', total = 0,
}) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  const money = (n) => `₱${Number(n || 0).toLocaleString()}`;

  // Itemized to match exactly what actually landed on their ledger — same numbers admin
  // reviewed on the Start Season screen, not a generic "check your profile" pointer.
  const lineRow = (label, amount) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#94a3b8">${label}</td>
      <td style="padding:4px 0;font-size:13px;color:#e2e8f0;text-align:right;white-space:nowrap">${amount < 0 ? '-' : ''}${money(Math.abs(amount))}</td>
    </tr>`;
  const lines = [lineRow('Season Fee', quotaAmount)];
  if (topAmount)    lines.push(lineRow(`Jersey Top${jerseyTop ? ` (${jerseyTop})` : ''}`, topAmount));
  if (shortsAmount) lines.push(lineRow(`Jersey Shorts${jerseyShorts ? ` (${jerseyShorts}${pockets ? ' + pockets' : ''})` : ''}`, shortsAmount));
  if (extraAmount)  lines.push(lineRow(extraLabel || (extraAmount < 0 ? 'Discount' : 'Additional charge'), extraAmount));

  return {
    kind: 'season_confirmed',
    subject: `You're in for Season ${season} — WKND Basketball`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">You made the cut, ${firstName}! 🏀</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#94a3b8">
      You've been confirmed for <strong style="color:#e2e8f0">Season ${season}</strong>${teamName ? ` on team <strong style="color:#f59332">${teamName}</strong>` : ''}.
    </p>
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Here's what was charged to your account</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      ${lines.join('')}
    </table>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #1e293b;margin-bottom:24px">
      <tr>
        <td style="padding:10px 0 0;font-size:14px;font-weight:700;color:#f1f5f9">Total</td>
        <td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#f59332;text-align:right">${money(total)}</td>
      </tr>
    </table>
    <a href="https://wkndbasketball.com/me" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Profile →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

export function seasonNotSelectedEmail({ name, season }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'season_not_selected',
    subject: `WKND Basketball — Season ${season} update`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Hi ${firstName},</h2>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">
      Unfortunately you weren't selected for Season ${season} this time. Roster spots were limited and it was a tough call.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">
      Keep an eye on your inbox for future seasons — we'd love to have you on the court.
    </p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

function escHtmlMail(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// category/referenceNo are player-submitted — escaped as-is, unlike name/reason elsewhere
// in this file which come from admin-trusted data entry. The screenshot is sent as a real
// email attachment (see sendMail's `attachments` param, set by the caller) rather than
// embedded inline here — Gmail's webmail strips/refuses to render inline data: URI
// <img> tags in received mail, so an embedded copy would just show as a broken image.
export function paymentSubmittedEmail({ playerName, amount, paymentMethod, category = '', referenceNo = '', hasScreenshot = false, adminUrl = '' }) {
  const detailRow = (label, value) => value
    ? `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#64748b;white-space:nowrap">${label}</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;font-weight:600">${value}</td></tr>`
    : '';
  return {
    kind: 'payment_submitted',
    subject: `Payment submitted — ${playerName} (₱${Number(amount).toLocaleString()})`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9">Payment submitted</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8">
      <strong style="color:#e2e8f0">${escHtmlMail(playerName)}</strong> says they paid <strong style="color:#f59332">₱${Number(amount).toLocaleString()}</strong> via <strong style="color:#e2e8f0">${escHtmlMail(paymentMethod)}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;padding:12px 16px;background:#0d1424;border-radius:4px;border-spacing:0">
      ${detailRow('For', escHtmlMail(category))}
      ${detailRow('Reference #', escHtmlMail(referenceNo))}
    </table>
    ${hasScreenshot ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b">📎 Payment screenshot attached to this email.</p>` : ''}
    <p style="margin:0 0 20px;font-size:13px;color:#64748b">This is sitting as a pending transaction — the category above is pre-filled from what they picked, adjust it if needed, then confirm once you've verified the payment.</p>
    ${adminUrl ? `<a href="${adminUrl}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">Review in Ledger →</a>` : ''}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

// Shared shell for the 4 papawis templates below — same card chrome as every other
// template in this file, just factored out since papawis has more variants than usual.
function papawisShell({ heading, bodyHtml, unsubscribeUrl = '' }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader('Papawis')}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9">${heading}</h2>
    ${bodyHtml}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball${unsubscribeUrl ? ` · Don't want Papawis game emails? <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>` : ''}
  </div>
</div>`;
}

function papawisRosterList(names) {
  if (!names.length) return '';
  return `<ul style="margin:0 0 16px;padding:0 0 0 18px;font-size:14px;line-height:1.8;color:#e2e8f0">
    ${names.map(n => `<li>${escHtmlMail(n)}</li>`).join('')}
  </ul>`;
}

function papawisCta(url, label) {
  return url
    ? `<a href="${url}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px">${label} →</a>`
    : '';
}

// gameLine/priceLine are pre-formatted strings from the caller (lib/papawis-notify.js) —
// date/timezone formatting and the default-price calc already live there and in
// views/admin/papawis.js, no reason to duplicate either here. url deep-links to that
// game's card on /papawis (see id="pw-game-{id}" in views/papawis.js).
export function papawisConfirmedTeamEmail({ name, gameTitle, gameLine, priceLine, teamLabel, teamRoster = [], url = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_confirmed_team',
    subject: `You're in! ${gameTitle} — Team ${teamLabel}`,
    html: papawisShell({
      heading: `You're confirmed, ${firstName}!`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">You're confirmed for <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` — ${escHtmlMail(gameLine)}` : ''}. See you on the court!</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8">What to bring: wear <strong style="color:#f59332">${escHtmlMail(teamLabel)}</strong> — that's your team for this session.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#64748b">${escHtmlMail(priceLine)}</p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Your team</p>
        ${papawisRosterList(teamRoster)}
        ${papawisCta(url, 'View on Papawis')}
      `,
    }),
  };
}

export function papawisConfirmedEmail({ name, gameTitle, gameLine, priceLine, confirmedRoster = [], url = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_confirmed',
    subject: `You're in! ${gameTitle}`,
    html: papawisShell({
      heading: `You're confirmed, ${firstName}!`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">You're confirmed for <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` — ${escHtmlMail(gameLine)}` : ''}.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#64748b">${escHtmlMail(priceLine)}</p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Who's playing</p>
        ${papawisRosterList(confirmedRoster)}
        <p style="margin:16px 0 0;font-size:13px;color:#64748b">Teams will be announced closer to game day.</p>
        ${papawisCta(url, 'View on Papawis')}
      `,
    }),
  };
}

export function papawisWaitlistEmail({ name, gameTitle, gameLine, waitlistPosition, url = '', nextGameLine = '', nextGameOpensLine = '', nextGameUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_waitlist',
    subject: `You're on the waitlist — ${gameTitle}`,
    html: papawisShell({
      heading: `Hi ${firstName},`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">
          <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''} is currently full, so you've been added to the <strong style="color:#f59332">waitlist</strong>${waitlistPosition ? ` (spot #${waitlistPosition})` : ''}.
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b">
          Sorry about that — if a confirmed player drops out, you'll be moved up automatically and we'll email you right away.
        </p>
        ${nextGameLine ? `
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Next Papawis</p>
        <p style="margin:0 0 4px;font-size:14px;color:#e2e8f0">${escHtmlMail(nextGameLine)}</p>
        ${nextGameOpensLine ? `<p style="margin:0;font-size:13px;color:#64748b">${escHtmlMail(nextGameOpensLine)}</p>` : ''}
        ` : `<p style="margin:0;font-size:14px;color:#64748b">No other Papawis scheduled yet — keep an eye on your inbox.</p>`}
        ${papawisCta(nextGameUrl || url, nextGameUrl ? 'View next Papawis' : 'View on Papawis')}
      `,
    }),
  };
}

export function papawisCancelledEmail({ name, gameTitle, gameLine, nextGameLine = '', nextGameOpensLine = '', nextGameUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_cancelled',
    subject: `${gameTitle} has been cancelled`,
    html: papawisShell({
      heading: `Hi ${firstName},`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">
          Sorry — <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''} has been <strong style="color:#f59332">cancelled</strong>. No charges were made, so there's nothing to settle on your end.
        </p>
        ${nextGameLine ? `
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Next Papawis</p>
        <p style="margin:0 0 4px;font-size:14px;color:#e2e8f0">${escHtmlMail(nextGameLine)}</p>
        ${nextGameOpensLine ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b">${escHtmlMail(nextGameOpensLine)}</p>` : ''}
        ` : ''}
        <p style="margin:0;font-size:14px;color:#64748b">Sorry for the trouble — hope to see you soon!</p>
        ${papawisCta(nextGameUrl, 'View next Papawis')}
      `,
    }),
  };
}

export function papawisUpdatedEmail({ name, gameTitle, gameLine, changeLines = [], url = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_updated',
    subject: `${gameTitle} details changed`,
    html: papawisShell({
      heading: `Hi ${firstName},`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">
          Heads up — some details for <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''} just changed.
        </p>
        ${changeLines.map(line => `<p style="margin:0 0 4px;font-size:14px;color:#e2e8f0">${escHtmlMail(line)}</p>`).join('')}
        <p style="margin:16px 0 0;font-size:14px;color:#64748b">Your spot is unaffected — just make sure the new details work for you.</p>
        ${papawisCta(url, 'View on Papawis')}
      `,
    }),
  };
}

// "How was the court?" — five tap-to-rate stars. Each star opens the court page with that
// many stars picked (/courts/<slug>?rate=N#crt-rate); the player adds court scores and a
// review there if they like. Only players who played at the court can rate, so this goes
// only to them. rate: { courtName, url } where url is the court page address (no query).
function courtRateBlock({ courtName, url }) {
  const star = n => `<a href="${url}?rate=${n}#crt-rate" title="${n} star${n === 1 ? '' : 's'}" style="display:inline-block;width:44px;height:44px;line-height:44px;margin:0 4px 0 0;text-align:center;font-size:24px;color:#f59332;text-decoration:none;background:#0d1424;border:1px solid #1e293b;border-radius:10px">&#9733;</a>`;
  return `
        <div style="margin:24px 0 0;padding:18px 18px 16px;background:#0a1120;border:1px solid #1e293b;border-radius:12px">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#f1f5f9">How was ${escHtmlMail(courtName)}?</p>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#94a3b8">Tap a star to rate the court. It takes a second, and it helps the next player pick a run.</p>
          <div>${[1, 2, 3, 4, 5].map(star).join('')}</div>
          <p style="margin:10px 0 0;font-size:12px;color:#64748b">1 = rough &nbsp;·&nbsp; 5 = great. Only players who played there can rate it.</p>
        </div>`;
}

// For players who played a run but get no tab email (already paid), and for league players
// once a game's final score is in. gameLine: "Sat, Oct 17 · 6:00–8:00 AM" or a final score
// ("White 99–90 Blue · Sun, Oct 4"). kind: 'papawis' | 'league' (header label and wording).
export function courtRateEmail({ name, courtName, url, gameLine = '', kind = 'papawis' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  const what = kind === 'league' ? 'your game' : 'your run';
  const bodyHtml = `
        <p style="margin:0;font-size:15px;line-height:1.6;color:#94a3b8">
          Thanks for playing ${what} at <strong style="color:#e2e8f0">${escHtmlMail(courtName)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''}. Got a second to rate the court?
        </p>
        ${courtRateBlock({ courtName, url })}`;
  return {
    kind: 'court_rate',
    subject: `How was ${courtName}?`,
    html: kind === 'league'
      ? `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader('League')}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9">Good game, ${escHtmlMail(firstName)}!</h2>
    ${bodyHtml}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">WKND Basketball</div>
</div>`
      : papawisShell({ heading: `Nice game, ${escHtmlMail(firstName)}!`, bodyHtml }),
  };
}

// amount is the player's total for this game — a sponsor who also brought a guest gets
// charged once per slot (their own + the guest's), so this is a sum, not always just the
// flat per-player price. url points at /settle-balance, not the game card — the action
// here is paying, not reviewing the roster.
// rate: { courtName, url } adds the "How was the court?" stars under the tab (court ratings
// on, and the run's court has a page); null leaves the email as it was.
export function papawisCompletedEmail({ name, gameTitle, gameLine, amount, url = '', rate = null }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_completed',
    subject: `${gameTitle} is done — here's your tab`,
    html: papawisShell({
      heading: `Nice game, ${firstName}!`,
      bodyHtml: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94a3b8">
          <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''} has wrapped up. You were charged <strong style="color:#f59332">₱${Number(amount).toLocaleString()}</strong> for this session.
        </p>
        ${papawisCta(url, 'Settle up')}
        ${rate ? courtRateBlock(rate) : ''}
      `,
    }),
  };
}

export function rejectedEmail({ name, reason = '' }) {
  return {
    kind: 'rejected',
    subject: 'WKND Basketball — Registration update',
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Hi ${name},</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94a3b8">
      We were unable to approve your registration at this time.
    </p>
    ${reason ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;padding:12px 16px;background:#0d1424;border-left:3px solid #1e293b;border-radius:4px">${reason}</p>` : ''}
    <p style="margin:0;font-size:14px;color:#64748b">
      If you have questions, reach out to your league admin.
    </p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball
  </div>
</div>`,
  };
}

// Birthday email (/admin/birthdays). opening/closing are plain text, AI-written or the
// fixed default from lib/birthday.js, and escaped here. stats is null for a player with no
// games yet, which swaps the stat row for a Papawis nudge. Never shows age or birth year.
// The condensed face falls back to Arial Narrow/Impact, since Gmail ignores web fonts.
// belated: sent after the day (up to a week late); changes the subject and headline only.
// photoUrl: the player's avatar (an absolute URL, since mail clients won't show data: images).
// Without one, the circle shows their jersey number instead; without either, no circle.
export function birthdayEmail({ firstName, number = '', photoUrl = '', stats = null, opening, closing, profileUrl = '', papawisUrl = '', belated = false }) {
  const CONDENSED = "'Saira Condensed','Arial Narrow',Impact,Arial,sans-serif";
  const first = escHtmlMail(firstName);
  const para = (text, mb) => `<p style="margin:0 0 ${mb}px;font-size:15px;line-height:1.6;color:#94a3b8">${escHtmlMail(text)}</p>`;
  const cta = (url, label) => url
    ? `<a href="${url}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">${label} →</a>`
    : '';
  const statCell = (value, label, last) => `<td style="width:33%;padding:14px 8px;text-align:center;${last ? '' : 'border-right:1px solid #1e293b'}">
        <div style="font-family:${CONDENSED};font-size:30px;line-height:1;font-weight:800;color:#f1f5f9">${value}</div>
        <div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${label}</div>
      </td>`;

  const numberRing = photoUrl
    ? `<td style="vertical-align:top;text-align:right;width:110px">
        <img src="${photoUrl}" width="96" height="96" alt="${first}" style="display:inline-block;width:96px;height:96px;border-radius:50%;border:2px solid #f59332;object-fit:cover;background:#0d1424;color:#f59332;font-family:Arial,sans-serif;font-size:14px">
      </td>`
    : String(number).trim()
    ? `<td style="vertical-align:top;text-align:right;width:110px">
        <div style="display:inline-block;width:96px;height:96px;border-radius:50%;border:2px solid #f59332;text-align:center;line-height:96px;font-family:${CONDENSED};font-size:44px;font-weight:800;color:#f59332">#${escHtmlMail(number)}</div>
      </td>`
    : '';

  const middle = stats
    ? `<div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px">Your career so far</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#0d1424;border:1px solid #1e293b;border-radius:12px;margin:0 0 24px">
      <tr>${statCell(stats.games, 'Games')}${statCell(stats.pts, 'Points')}${statCell(stats.best, 'Best game', true)}</tr>
    </table>`
    : `<div style="background:#0d1424;border:1px solid #1e293b;border-radius:12px;padding:16px 18px;margin:0 0 24px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f59332;margin:0 0 6px">Birthday run?</div>
      <div style="font-size:14px;line-height:1.6;color:#e2e8f0">Papawis runs every week. Grab a slot and get your first points on the board.</div>
    </div>`;

  return {
    kind: 'birthday',
    subject: `Happy ${belated ? 'belated ' : ''}birthday, ${firstName}! 🎂`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader()}
  <div style="padding:36px 28px 8px">
    <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
      <td style="vertical-align:top">
        <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f59332;margin:0 0 10px">${belated ? 'Better late than never' : 'Game day for you'}</div>
        <div style="font-family:${CONDENSED};font-size:46px;line-height:.95;font-weight:800;text-transform:uppercase;color:#f1f5f9;letter-spacing:.01em">Happy${belated ? '<br>belated' : ''}<br>birthday,<br><span style="color:#f59332">${first}!</span></div>
      </td>
      ${numberRing}
    </tr></table>
  </div>
  <div style="padding:16px 28px 32px">
    ${para(opening, 20)}
    ${middle}
    ${closing ? para(closing, 24) : ''}
    ${stats ? cta(profileUrl, 'See your profile') : cta(papawisUrl, 'Find a Papawis game')}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball · You're getting this because ${belated ? 'it was' : "it's"} your birthday.
  </div>
</div>`,
  };
}

// ── Papawis announcements + slot-opened alerts (lib/papawis-broadcast.js) ─────
// Both carry the same optional heads-up lines for a player who can't join straight away:
// settleLine (unpaid finished game, which blocks joining) and depositLine (on probation,
// so their spot is held until an admin confirms a deposit).
function papawisHeadsUp({ settleLine = '', settleUrl = '', depositLine = '' }) {
  const box = (title, text, extra = '') => `<div style="background:#0d1424;border:1px solid #1e293b;border-left:3px solid #f59332;border-radius:8px;padding:12px 14px;margin:0 0 16px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#f59332;margin:0 0 4px">${title}</div>
      <div style="font-size:14px;line-height:1.6;color:#e2e8f0">${escHtmlMail(text)}${extra}</div>
    </div>`;
  return [
    settleLine ? box('Settle first', settleLine, settleUrl ? ` <a href="${settleUrl}" style="color:#f59332;font-weight:700;text-decoration:none">Settle balance →</a>` : '') : '',
    depositLine ? box('Deposit needed', depositLine) : '',
  ].join('');
}

export function papawisAnnouncementEmail({ name, gameTitle, gameLine, maxSlots, url, settleLine = '', settleUrl = '', depositLine = '', unsubscribeUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    kind: 'papawis_announcement',
    subject: `New Papawis: ${gameTitle} — sign-ups are open`,
    html: papawisShell({
      heading: `New Papawis game, ${escHtmlMail(firstName)}!`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8"><strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` — ${escHtmlMail(gameLine)}` : ''}.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94a3b8">Sign-ups are open now${maxSlots ? ` for <strong style="color:#e2e8f0">${Number(maxSlots)} slots</strong>` : ''}. First come, first served.</p>
        ${papawisHeadsUp({ settleLine, settleUrl, depositLine })}
        ${papawisCta(url, 'Grab a slot')}
      `,
      unsubscribeUrl,
    }),
  };
}

export function papawisSlotOpenEmail({ name, gameTitle, gameLine, openSlots, url, settleLine = '', settleUrl = '', depositLine = '', unsubscribeUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  const slots = Number(openSlots) > 1 ? `${Number(openSlots)} slots` : 'A slot';
  return {
    kind: 'papawis_slot_open',
    subject: `${slots} just opened: ${gameTitle}`,
    html: papawisShell({
      heading: `${slots} just opened up, ${escHtmlMail(firstName)}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8"><strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` (${escHtmlMail(gameLine)})` : ''} was full, and ${Number(openSlots) > 1 ? `${Number(openSlots)} spots` : 'a spot'} just freed up.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94a3b8">First come, first served. If it's taken by the time you get there, you'll land on the waitlist.</p>
        ${papawisHeadsUp({ settleLine, settleUrl, depositLine })}
        ${papawisCta(url, Number(openSlots) > 1 ? 'Grab a slot' : 'Grab the slot')}
      `,
      unsubscribeUrl,
    }),
  };
}

// ── "Who wins?" pick reminder (lib/picks-email.js writes the copy) ─────────────
// copy: { subject, intro, blurbs: { [gameId]: line } } — the same for everyone that game day.
// games: [{ id, a, b, colA, colB, odds: { name, pct } | null, myPick: team name | null }]
// board: top of the Pickmaster race [{ rank, name, record }]; me: this player's line or null.
export function picksReminderEmail({ name, copy, games, dayLabel, closeLabel, board = [], me = '', prizeLine = '', url, unsubscribeUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  const owed = games.filter(g => !g.myPick).length;
  const dot = c => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin:0 6px 1px 0;vertical-align:middle"></span>`;
  // Odds bar in the two team colours, split by each side's win chance. A table, not a flex
  // div, so it holds up in Gmail and Outlook; the favourite's percentage is in amber.
  const oddsBar = g => {
    const a = Number(g.odds.pctA), b = Number(g.odds.pctB);
    const pct = (n, fav) => `<span style="font-size:20px;font-weight:800;color:${fav ? '#f59332' : '#94a3b8'}">${n}%</span>`;
    return `<div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Odds</div>
      <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
        <td style="padding:0 0 6px;text-align:left;white-space:nowrap">${pct(a, g.odds.fav === 'a')} <span style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#cbd5e1">${escHtmlMail(g.a)}</span></td>
        <td style="padding:0 0 6px;text-align:right;white-space:nowrap"><span style="font-size:12px;font-weight:700;letter-spacing:.06em;color:#cbd5e1">${escHtmlMail(g.b)}</span> ${pct(b, g.odds.fav === 'b')}</td>
      </tr></table>
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border-radius:5px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.08)"><tr>
        <td style="width:${a}%;height:10px;line-height:10px;font-size:0;background:${g.colA};border-right:2px solid #0d1424">&nbsp;</td>
        <td style="width:${b}%;height:10px;line-height:10px;font-size:0;background:${g.colB}">&nbsp;</td>
      </tr></table>
    </div>`;
  };
  const gameCard = g => `
    <div style="margin:0 0 12px;padding:16px;border-radius:10px;background:#0d1424;border:1px solid #1e293b">
      <div style="font-size:15px;font-weight:800;letter-spacing:.04em;color:#f1f5f9">${dot(g.colA)}${escHtmlMail(g.a)} <span style="color:#475569;font-weight:600">vs</span> ${dot(g.colB)}${escHtmlMail(g.b)}</div>
      ${g.odds ? oddsBar(g) : ''}
      <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#94a3b8">${escHtmlMail(copy.blurbs?.[g.id] || '')}</p>
      <div style="margin-top:10px;font-size:12.5px;font-weight:700;color:${g.myPick ? '#64748b' : '#f59332'}">${g.myPick ? `You picked ${escHtmlMail(g.myPick)}` : 'You haven’t picked this one yet'}</div>
    </div>`;
  const boardRows = board.length
    ? board.map(r => `<tr>
        <td style="padding:5px 10px 5px 0;font-size:14px;font-weight:800;color:${r.rank === 1 ? '#f59332' : '#64748b'};width:22px">${r.rank}</td>
        <td style="padding:5px 0;font-size:14px;color:#e2e8f0">${escHtmlMail(r.name)}</td>
        <td style="padding:5px 0;font-size:14px;font-weight:700;color:#e2e8f0;text-align:right;white-space:nowrap">${escHtmlMail(r.record)}</td>
      </tr>`).join('')
    : `<tr><td style="padding:4px 0;font-size:13px;color:#64748b">Nobody's ranked yet. Every pick counts from here.</td></tr>`;
  return {
    kind: 'picks_reminder',
    subject: copy.subject,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader('Who wins?')}
  <div style="padding:28px 28px 8px">
    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#f1f5f9">${escHtmlMail(firstName)}, who wins on ${escHtmlMail(dayLabel)}?</h2>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#94a3b8">${escHtmlMail(copy.intro)}</p>
    ${games.map(gameCard).join('')}
    <div style="margin:18px 0 6px">
      <a href="${url}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">${owed > 1 ? 'Make your picks' : 'Make your pick'} →</a>
    </div>
    <p style="margin:6px 0 22px;font-size:12.5px;color:#64748b">Picks close at ${escHtmlMail(closeLabel)} on ${escHtmlMail(dayLabel)}.</p>
    <div style="margin:0 0 20px;padding:16px;border-radius:10px;background:#0d1424;border:1px solid #1e293b">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f59332;margin-bottom:8px">Pickmaster race</div>
      <table role="presentation" style="width:100%;border-collapse:collapse">${boardRows}</table>
      ${me ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #1e293b;font-size:13px;color:#94a3b8">${escHtmlMail(me)}</div>` : ''}
      ${prizeLine ? `<div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:rgba(245,147,50,.12);border:1px dashed rgba(245,147,50,.45);font-size:13px;line-height:1.5;color:#fbd3a8"><strong style="color:#f59332">Mystery prize.</strong> ${escHtmlMail(prizeLine)}</div>` : ''}
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball${unsubscribeUrl ? ` · Don't want pick reminders by email? <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>` : ''}
  </div>
</div>`,
  };
}

// ── MVP podium reminder (server.js /admin/mvp-podium) ─────────────────────────
// Sent once, by the admin, to active players without a complete ballot. Same footer and
// unsubscribe as the pick reminders (it's a Pickmaster bonus).
// faces: [{ name, color }] of the ten (shuffled); closeLabel: "Sun, Oct 18 · 6:00 AM".
export function podiumReminderEmail({ name, faces = [], closeLabel = '', url, unsubscribeUrl = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  const chip = f => `<td style="padding:0 4px 6px 0"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#0d1424;border:1px solid ${f.color};font-size:12px;font-weight:700;color:#e2e8f0;white-space:nowrap">${escHtmlMail(f.name)}</span></td>`;
  const rows = [];
  for (let i = 0; i < faces.length; i += 3) rows.push(`<tr>${faces.slice(i, i + 3).map(chip).join('')}</tr>`);
  return {
    kind: 'podium_reminder',
    subject: `Who's your MVP? Call the podium${closeLabel ? ` before ${closeLabel.split(' · ')[0]}` : ''} (+3 Pickmaster points)`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader('Season pick')}
  <div style="padding:28px 28px 8px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f59332;margin-bottom:8px">Season pick · up to +3</div>
    <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#f1f5f9">${escHtmlMail(firstName)}, ten players still have an MVP case. Who finishes 1st, 2nd and 3rd?</h2>
    <table role="presentation" style="border-collapse:collapse;margin:6px 0 10px">${rows.join('')}</table>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#94a3b8">The MVP order is locked until the award at Finals Game 2. Call the podium now: every player in the exact spot is <strong style="color:#e2e8f0">+1 Pickmaster point</strong>, up to +3.${closeLabel ? ` Only ballots in before <strong style="color:#e2e8f0">${escHtmlMail(closeLabel)}</strong> count for the bonus.` : ''}</p>
    <div style="margin:18px 0 22px">
      <a href="${url}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">Call the podium →</a>
    </div>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball${unsubscribeUrl ? ` · Don't want pick reminders by email? <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>` : ''}
  </div>
</div>`,
  };
}

// League nudge (lib/broadcast.js auto-nudges, e.g. season sign-ups opening): a heading, one
// or two plain-text paragraphs and a button. All text is escaped here.
export function leagueNudgeEmail({ name, subject, heading, lines = [], cta = '', url = '', unsubscribeUrl = '', label = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name || '';
  return {
    kind: 'league_nudge',
    subject,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  ${emailHeader(escHtmlMail(label))}
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9">${escHtmlMail(heading.replace('{name}', firstName))}</h2>
    ${lines.map(l => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#94a3b8">${escHtmlMail(l)}</p>`).join('')}
    ${url && cta ? `<a href="${url}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px">${escHtmlMail(cta)} →</a>` : ''}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball${unsubscribeUrl ? ` · Don't want league update emails? <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe</a>` : ''}
  </div>
</div>`,
  };
}
