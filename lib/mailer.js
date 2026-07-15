const {
  RESEND_API_KEY,
  SMTP_FROM = 'WKND Basketball <noreply@wkndbasketball.com>',
} = process.env;

const enabled = !!RESEND_API_KEY;

export async function sendMail({ to, subject, html }) {
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
    body: JSON.stringify({ from: SMTP_FROM, to, subject, html }),
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
