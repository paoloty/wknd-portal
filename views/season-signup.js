import { escHtml } from './layout.js';

const STATUS_LABEL = { waitlisted: 'Waitlisted', confirmed: 'Confirmed', rejected: 'Not Selected' };
const STATUS_COLOR = { waitlisted: '#f59332', confirmed: '#22c55e', rejected: '#64748b' };

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const SIZE_CHART_TOPS = [
  { size: 'XS',  chest: '84–88', length: '68' },
  { size: 'S',   chest: '88–92', length: '70' },
  { size: 'M',   chest: '92–96', length: '72' },
  { size: 'L',   chest: '96–100', length: '74' },
  { size: 'XL',  chest: '100–104', length: '76' },
  { size: '2XL', chest: '104–110', length: '78' },
  { size: '3XL', chest: '110–118', length: '80' },
];

const SIZE_CHART_SHORTS = [
  { size: 'XS',  waist: '64–68',   hip: '84–88' },
  { size: 'S',   waist: '68–72',   hip: '88–92' },
  { size: 'M',   waist: '72–76',   hip: '92–96' },
  { size: 'L',   waist: '76–80',   hip: '96–100' },
  { size: 'XL',  waist: '80–84',   hip: '100–104' },
  { size: '2XL', waist: '84–90',   hip: '104–110' },
  { size: '3XL', waist: '90–98',   hip: '110–118' },
];

function sizeChart() {
  const topRows  = SIZE_CHART_TOPS.map(r   => `<tr><td>${r.size}</td><td>${r.chest} cm</td><td>${r.length} cm</td></tr>`).join('');
  const shortRows = SIZE_CHART_SHORTS.map(r => `<tr><td>${r.size}</td><td>${r.waist} cm</td><td>${r.hip} cm</td></tr>`).join('');
  return `
<div id="size-chart-wrap" style="display:none;margin-top:12px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Jersey Top</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:3px 6px">Size</th><th style="text-align:left;padding:3px 6px">Chest</th><th style="text-align:left;padding:3px 6px">Length</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Shorts</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:3px 6px">Size</th><th style="text-align:left;padding:3px 6px">Waist</th><th style="text-align:left;padding:3px 6px">Hip</th></tr></thead>
        <tbody>${shortRows}</tbody>
      </table>
    </div>
  </div>
</div>
<style>
  #size-chart-wrap td { padding:3px 6px; color:var(--text-muted); border-bottom:1px solid var(--border); }
  #size-chart-wrap tr:last-child td { border-bottom:none; }
</style>
<script>
  document.getElementById('size-chart-toggle')?.addEventListener('click', function() {
    var w = document.getElementById('size-chart-wrap');
    var open = w.style.display === 'block';
    w.style.display = open ? 'none' : 'block';
    this.textContent = open ? 'View Size Chart ↓' : 'Hide Size Chart ↑';
  });
</script>`;
}

export function seasonSignupPage({
  state,
  sigSeason = '',
  sigOpen = false,
  deadline = '',
  existing = null,
  name = '',
  hasBalance = false,
  balanceAmt = 0,
  quotaAmount = '',
  seasonFormat = '',
  jerseyTopPrice = '',
  jerseyShortPrice = '',
} = {}) {
  const wrap = body => `<div class="login-page" style="padding:80px 16px">
  <div class="reg-box" style="max-width:560px">
    <div class="login-brand" style="margin-bottom:28px">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    ${body}
  </div>
</div>`;

  if (state === 'not-approved') {
    return wrap(`<div class="login-form" style="text-align:center;padding:40px 32px">
  <div style="font-size:36px;margin-bottom:16px">⏳</div>
  <h2 style="font-size:1.15rem;font-weight:800;color:var(--text);margin:0 0 10px">Application Pending</h2>
  <p style="color:var(--text-muted);font-size:13px;line-height:1.75;margin:0 0 24px">Your membership application hasn't been approved yet. Season signup will be available once an admin approves your account.</p>
  <a href="/" class="login-submit" style="display:block;text-decoration:none;text-align:center">Back to Home</a>
</div>`);
  }

  // Already signed up — show status
  if (existing) {
    const statusLabel = STATUS_LABEL[existing.status] ?? existing.status;
    const statusColor = STATUS_COLOR[existing.status] ?? '#64748b';
    const jerseyInfo  = (existing.jersey_top || existing.jersey_shorts) ? `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:12px">
    <div style="font-weight:700;color:var(--text);margin-bottom:6px">Jersey Selection</div>
    ${existing.jersey_top    ? `<div style="color:var(--text-muted)">Top: <strong style="color:var(--text)">${escHtml(existing.jersey_top)}</strong></div>` : ''}
    ${existing.jersey_shorts ? `<div style="color:var(--text-muted)">Shorts: <strong style="color:var(--text)">${escHtml(existing.jersey_shorts)}</strong></div>` : ''}
  </div>` : '';
    return wrap(`<div class="login-form" style="text-align:center;padding:48px 32px">
  <div style="font-size:42px;margin-bottom:16px">${existing.status === 'confirmed' ? '✅' : existing.status === 'rejected' ? '😔' : '🏀'}</div>
  <h2 style="font-size:1.2rem;font-weight:800;color:var(--text);margin:0 0 8px">Season ${escHtml(String(sigSeason))} Signup</h2>
  <p style="margin:0 0 20px"><span style="display:inline-block;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55;border-radius:20px;padding:3px 14px;font-size:12px;font-weight:700;letter-spacing:.04em">${escHtml(statusLabel)}</span></p>
  <p style="color:var(--text-muted);font-size:13px;line-height:1.75;margin:0 0 16px">
    ${existing.status === 'confirmed'
      ? "You're confirmed for the upcoming season. We'll reach out with next steps."
      : existing.status === 'rejected'
        ? "Unfortunately you weren't selected for this season. Keep an eye out for future seasons."
        : "You're on the waitlist. An admin will review and confirm your spot soon."}
  </p>
  ${jerseyInfo}
  ${existing.has_balance ? `<div style="background:rgba(245,147,50,.08);border:1px solid rgba(245,147,50,.25);border-radius:8px;padding:12px 16px;text-align:left;margin-bottom:20px;font-size:12px;color:#f59332">
    ⚠️ You have an outstanding balance of <strong>₱${Number(existing.balance_amt).toLocaleString()}</strong>. An admin will follow up about settlement before your spot is confirmed.
  </div>` : ''}
  <a href="/" class="login-submit" style="display:block;text-decoration:none;text-align:center">Back to Home</a>
</div>`);
  }

  // Signup not open / no season started
  if (!sigSeason || !sigOpen) {
    return wrap(`<div class="login-form" style="text-align:center;padding:48px 32px">
  <div style="font-size:36px;margin-bottom:16px">🔒</div>
  <h2 style="font-size:1.15rem;font-weight:800;color:var(--text);margin:0 0 10px">Not Open Yet</h2>
  <p style="color:var(--text-muted);font-size:13px;line-height:1.75;margin:0 0 24px">Season signup isn't open right now. Check back soon or watch for an announcement.</p>
  <a href="/" class="login-submit" style="display:block;text-decoration:none;text-align:center">Back to Home</a>
</div>`);
  }

  // Build season info section
  const fmtMoney = v => v ? `₱${Number(v).toLocaleString()}` : '';
  const quotaAmt  = quotaAmount  ? fmtMoney(quotaAmount)    : null;
  const topPrice  = jerseyTopPrice   ? fmtMoney(jerseyTopPrice)   : null;
  const shrtPrice = jerseyShortPrice ? fmtMoney(jerseyShortPrice) : null;

  const seasonInfoItems = [
    seasonFormat  ? `<div><span style="color:var(--text-muted)">Format:</span> <strong style="color:var(--text)">${escHtml(seasonFormat)}</strong></div>` : '',
    quotaAmt      ? `<div><span style="color:var(--text-muted)">Season Fee:</span> <strong style="color:var(--text)">${escHtml(quotaAmt)}</strong></div>` : '',
    topPrice      ? `<div><span style="color:var(--text-muted)">Jersey Top:</span> <strong style="color:var(--text)">${escHtml(topPrice)}</strong></div>` : '',
    shrtPrice     ? `<div><span style="color:var(--text-muted)">Jersey Shorts:</span> <strong style="color:var(--text)">${escHtml(shrtPrice)} (optional)</strong></div>` : '',
  ].filter(Boolean).join('');

  const sizeOptions = SIZES.map(s => `<option value="${s}">${s}</option>`).join('');

  const firstName = (name || '').split(',').pop()?.trim() || name;

  return wrap(`<div class="login-form">
  <h2 style="font-size:1.25rem;font-weight:800;color:var(--text);margin:0 0 6px">Season ${escHtml(String(sigSeason))} Signup</h2>
  <p style="color:var(--text-muted);font-size:13px;margin:0 0 20px">Hey ${escHtml(firstName)}! Lock in your spot for the upcoming season.${deadline ? ` Deadline: <strong style="color:var(--text)">${escHtml(deadline)}</strong>.` : ''}</p>

  ${hasBalance ? `<div style="background:rgba(245,147,50,.08);border:1px solid rgba(245,147,50,.3);border-radius:8px;padding:14px 16px;margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;color:#f59332;margin-bottom:4px">⚠️ Outstanding Balance</div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.6">You have an unpaid balance of <strong style="color:var(--text)">₱${Number(balanceAmt).toLocaleString()}</strong> from a previous season. You can still sign up — an admin will follow up about settling this before your spot is confirmed.</div>
  </div>` : ''}

  ${seasonInfoItems ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;flex-direction:column;gap:7px;font-size:13px">
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px">Season ${escHtml(String(sigSeason))} Info</div>
    ${seasonInfoItems}
  </div>` : ''}

  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:20px;display:flex;flex-direction:column;gap:8px">
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px">What happens next</div>
    <div style="font-size:12px;color:var(--text-muted);line-height:1.65">1. You're added to the Season ${escHtml(String(sigSeason))} waitlist.<br>2. Admin reviews and confirms your spot.<br>3. You'll be notified by email once confirmed.<br>4. Season fee and jersey charges are applied to your account.</div>
  </div>

  <form method="POST" action="/season-signup" id="signup-form">
    <div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <label style="font-size:13px;font-weight:700;color:var(--text)">Jersey Selection</label>
        <button type="button" id="size-chart-toggle" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">View Size Chart ↓</button>
      </div>
      ${sizeChart()}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Jersey Top <span style="color:#f87171">*</span></label>
          <select name="jersey_top" required style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px;outline:none">
            <option value="" disabled selected>Select size</option>
            ${sizeOptions}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em">Shorts <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <select name="jersey_shorts" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:8px 10px;font-size:13px;outline:none">
            <option value="">No shorts needed</option>
            ${sizeOptions}
          </select>
        </div>
      </div>
    </div>

    ${quotaAmt ? `<div style="background:rgba(245,147,50,.06);border:1px solid rgba(245,147,50,.2);border-radius:8px;padding:14px 16px;margin-bottom:18px">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
        <input type="checkbox" name="quota_ack" value="1" required style="margin-top:2px;width:15px;height:15px;flex-shrink:0;accent-color:#f59332">
        <span style="font-size:12px;color:var(--text-muted);line-height:1.6">I understand the season fee is <strong style="color:var(--text)">${escHtml(quotaAmt)}</strong>${topPrice ? ` + ${escHtml(topPrice)} jersey top` : ''}${shrtPrice ? ` (+ ${escHtml(shrtPrice)} if adding shorts)` : ''} and will be charged to my account when my spot is confirmed. <span style="color:#f87171">*</span></span>
      </label>
    </div>` : ''}

    <button type="submit" class="login-submit">Count Me In for Season ${escHtml(String(sigSeason))} →</button>
  </form>
  <p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:12px;opacity:.6">Signing up puts you on the waitlist — not a guarantee of a spot.</p>
</div>`);
}
