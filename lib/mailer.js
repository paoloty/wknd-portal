import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
  SMTP_FROM = 'WKND Basketball <noreply@wkndbasketball.com>',
} = process.env;

const enabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 465,
      secure: (Number(SMTP_PORT) || 465) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendMail({ to, subject, html }) {
  if (!enabled) {
    console.log(`[mailer] SMTP not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  return transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}

// ── Email templates ───────────────────────────────────────────────────────────

export function approvedEmail({ name, loginUrl = 'https://wkndbasketball.com/login' }) {
  return {
    subject: "You're in — WKND Basketball",
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#020817;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#f59332;padding:20px 28px">
    <span style="font-size:20px;font-weight:800;color:#020817;letter-spacing:-.5px">WKND Basketball</span>
  </div>
  <div style="padding:32px 28px">
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">Welcome to the league, ${name}!</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#94a3b8">
      Your registration has been approved. You now have access to your player profile, stats, and everything else on the portal.
    </p>
    <a href="${loginUrl}" style="display:inline-block;background:#f59332;color:#020817;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
      Sign in to the Portal →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #1e293b;font-size:12px;color:#475569">
    WKND Basketball League
  </div>
</div>`,
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
