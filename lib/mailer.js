const {
  RESEND_API_KEY,
  SMTP_FROM = 'WKND Basketball <noreply@wkndbasketball.com>',
} = process.env;

const enabled = !!RESEND_API_KEY;

// attachments: [{ filename, content }] — content is base64 WITHOUT the "data:...;base64,"
// prefix (Resend wants the raw base64 payload). Real attachments instead of an inline
// data: URI <img> — Gmail's webmail strips/refuses to render inline data: URIs in
// received mail even though the same markup renders fine in a plain browser.
export async function sendMail({ to, subject, html, attachments }) {
  if (!enabled) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: SMTP_FROM, to, subject, html, ...(attachments?.length ? { attachments } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Resend API error');
  return data;
}

// ── Email templates ───────────────────────────────────────────────────────────

export function approvedEmail({ name, setPasswordUrl }) {
  return {
    subject: "You're in — WKND Basketball",
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
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
    WKND Basketball League
  </div>
</div>`,
  };
}

export function seasonQualifiedEmail({ name, season, teamName = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    subject: `You're in for Season ${season} — WKND Basketball`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">You made the cut, ${firstName}! 🏀</h2>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">
      You've been confirmed for <strong style="color:#e2e8f0">Season ${season}</strong>${teamName ? ` on team <strong style="color:#f59332">${teamName}</strong>` : ''}.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b">
      Season fees have been charged to your account. Check your profile for the breakdown.
    </p>
    <a href="https://wkndbasketball.com/me" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Profile →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball League
  </div>
</div>`,
  };
}

export function seasonNotSelectedEmail({ name, season }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    subject: `WKND Basketball — Season ${season} update`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
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
    WKND Basketball League
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
    subject: `Payment submitted — ${playerName} (₱${Number(amount).toLocaleString()})`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
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
    WKND Basketball League
  </div>
</div>`,
  };
}

// Shared shell for the 4 papawis templates below — same card chrome as every other
// template in this file, just factored out since papawis has more variants than usual.
function papawisShell({ heading, bodyHtml }) {
  return `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Papawis</span>
  </div>
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#f1f5f9">${heading}</h2>
    ${bodyHtml}
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball League
  </div>
</div>`;
}

function papawisRosterList(names) {
  if (!names.length) return '';
  return `<ul style="margin:0 0 16px;padding:0 0 0 18px;font-size:14px;line-height:1.8;color:#e2e8f0">
    ${names.map(n => `<li>${escHtmlMail(n)}</li>`).join('')}
  </ul>`;
}

// gameLine/priceLine are pre-formatted strings from the caller (lib/papawis-notify.js) —
// date/timezone formatting and the default-price calc already live there and in
// views/admin/papawis.js, no reason to duplicate either here.
export function papawisConfirmedTeamEmail({ name, gameTitle, gameLine, priceLine, teamLabel, teamRoster = [] }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    subject: `You're in! ${gameTitle} — Team ${teamLabel}`,
    html: papawisShell({
      heading: `You're confirmed, ${firstName}!`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">You're confirmed for <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` — ${escHtmlMail(gameLine)}` : ''}. See you on the court!</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8">What to bring: wear <strong style="color:#f59332">${escHtmlMail(teamLabel)}</strong> — that's your team for this session.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#64748b">${escHtmlMail(priceLine)}</p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Your team</p>
        ${papawisRosterList(teamRoster)}
      `,
    }),
  };
}

export function papawisConfirmedEmail({ name, gameTitle, gameLine, priceLine, confirmedRoster = [] }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
    subject: `You're in! ${gameTitle}`,
    html: papawisShell({
      heading: `You're confirmed, ${firstName}!`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#94a3b8">You're confirmed for <strong style="color:#e2e8f0">${escHtmlMail(gameTitle)}</strong>${gameLine ? ` — ${escHtmlMail(gameLine)}` : ''}.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#64748b">${escHtmlMail(priceLine)}</p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">Who's playing</p>
        ${papawisRosterList(confirmedRoster)}
        <p style="margin:16px 0 0;font-size:13px;color:#64748b">Teams will be announced closer to game day.</p>
      `,
    }),
  };
}

export function papawisWaitlistEmail({ name, gameTitle, gameLine, waitlistPosition, nextGameLine = '', nextGameOpensLine = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
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
      `,
    }),
  };
}

export function papawisCancelledEmail({ name, gameTitle, gameLine, nextGameLine = '', nextGameOpensLine = '' }) {
  const firstName = (name || '').split(',').pop()?.trim() || name;
  return {
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
      `,
    }),
  };
}

export function rejectedEmail({ name, reason = '' }) {
  return {
    subject: 'WKND Basketball — Registration update',
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
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
    WKND Basketball League
  </div>
</div>`,
  };
}
