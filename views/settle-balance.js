import { escHtml } from './layout.js';
import { PAYMENT_CATEGORIES } from './utils.js';

const PAYMENT_METHODS = ['GCash', 'Bank Transfer', 'Cash', 'Other'];

// Shared by both the success branch and the form branch below — each returns its own
// complete fragment early, so the styles have to travel with whichever one renders.
const SB_STYLES = `<style>
.sb-page { max-width: 900px; margin: 0 auto; padding-bottom: 60px; }
.sb-head { margin-bottom: 20px; }
.sb-head__title { font-size: 1.6rem; font-weight: 800; letter-spacing: -.02em; color: var(--text); margin: 0 0 4px; }
.sb-head__sub { font-size: 13.5px; color: var(--text-muted); margin: 0; }

.sb-balance-strip { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(248,113,113,.06); border: 1px solid rgba(248,113,113,.25); border-top: 2px solid #f2b263; border-radius: var(--radius); margin-bottom: 24px; }
.sb-balance-strip__label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #f2b263; }
.sb-balance-strip__amount { font-size: 22px; font-weight: 800; color: #fbbf77; font-variant-numeric: tabular-nums; }

.sb-layout { display: grid; gap: 24px; align-items: start; }
.sb-layout--split { grid-template-columns: 1fr 340px; }
.sb-layout--full { grid-template-columns: 1fr; }
.sb-layout--split .sb-gcash-card { grid-column: 2; grid-row: 1; position: sticky; top: 24px; }
.sb-layout--split .sb-form-card { grid-column: 1; grid-row: 1; }

.sb-gcash-card__body { padding: 18px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
.sb-gcash-card__qr { width: 100%; max-width: 220px; aspect-ratio: 1 / 1; height: auto; border-radius: 8px; background: #fff; padding: 10px; box-sizing: border-box; }
.sb-gcash-card__details { display: flex; flex-direction: column; gap: 2px; }
.sb-gcash-card__name { font-size: 14px; font-weight: 700; color: var(--text); }
.sb-gcash-card__number { font-size: 13px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.sb-steps { width: 100%; text-align: left; margin: 4px 0 0; padding: 14px 16px 14px 34px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }
.sb-steps li::marker { color: var(--amber); font-weight: 700; }

.sb-form-card__body { padding: 22px; }
.sb-form .login-field { margin-bottom: 16px; }
.sb-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sb-season-hint { margin: -6px 0 16px; font-size: 12px; color: var(--amber); }
.sb-season-hint strong { color: var(--text); }
/* Fixed height regardless of the uploaded image's own dimensions — the form's layout
   shouldn't jump around based on whatever screenshot someone picks. */
.sb-preview-wrap { margin-top: 10px; height: 180px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.sb-preview-wrap__img { max-width: 100%; max-height: 100%; object-fit: contain; }

.sb-success { max-width: 420px; margin: 60px auto 0; text-align: center; padding: 48px 32px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.sb-success__icon { font-size: 44px; margin-bottom: 16px; }
.sb-success__title { font-size: 1.25rem; font-weight: 800; color: var(--text); margin: 0 0 10px; }
.sb-success__body { color: var(--text-muted); font-size: 13px; line-height: 1.75; margin: 0 0 28px; }
.sb-success__cta { display: block; background: var(--amber); color: #0a0e16; font-weight: 800; font-size: 13px; letter-spacing: .06em; text-decoration: none; text-align: center; padding: 12px; border-radius: 8px; }

@media (max-width: 900px) {
  .sb-layout--split { grid-template-columns: 1fr; }
  .sb-layout--split .sb-gcash-card { grid-column: 1; grid-row: 1; position: static; }
  .sb-layout--split .sb-form-card { grid-column: 1; grid-row: 2; }
}
@media (max-width: 560px) {
  .sb-field-row { grid-template-columns: 1fr; gap: 0; }
  .sb-form-card__body { padding: 18px; }
}
</style>`;

export function settleBalancePage({ balance = 0, gcashName = '', gcashNumber = '', hasQr = false, activeSeason = '', success = false, error = '' } = {}) {
  if (success) {
    return `<div class="page-content sb-page">
  <div class="sb-success">
    <div class="sb-success__icon">✅</div>
    <h1 class="sb-success__title">Payment submitted</h1>
    <p class="sb-success__body">
      Thanks! Your admin has been notified and will confirm it once verified.<br>
      You'll see it reflected on your balance once it's approved.
    </p>
    <a href="/me" class="sb-success__cta">Back to My Profile</a>
  </div>
</div>
${SB_STYLES}`;
  }

  const hasPaymentInfo = !!(gcashName || gcashNumber || hasQr);

  const gcashCard = hasPaymentInfo ? `
    <div class="card sb-gcash-card">
      <div class="card-label">PAY VIA GCASH</div>
      <div class="sb-gcash-card__body">
        ${hasQr ? `<img src="/api/gcash-qr.png" alt="GCash QR code" class="sb-gcash-card__qr">` : ''}
        ${(gcashName || gcashNumber) ? `<div class="sb-gcash-card__details">
          ${gcashName ? `<div class="sb-gcash-card__name">${escHtml(gcashName)}</div>` : ''}
          ${gcashNumber ? `<div class="sb-gcash-card__number">${escHtml(gcashNumber)}</div>` : ''}
        </div>` : ''}
        <ol class="sb-steps">
          <li>Scan the QR, or send to the number above</li>
          <li>Screenshot the payment confirmation</li>
          <li>Fill in the form and attach it — we'll confirm it and update your balance</li>
        </ol>
      </div>
    </div>` : '';

  return `<div class="page-content sb-page">

  <div class="sb-head">
    <h1 class="sb-head__title">Settle Balance</h1>
    <p class="sb-head__sub">Pay via GCash below, then submit proof so your admin can confirm it.</p>
  </div>

  <div class="sb-balance-strip">
    <span class="sb-balance-strip__label">Current balance</span>
    <span class="sb-balance-strip__amount">₱${Number(balance).toLocaleString()}</span>
  </div>

  <div class="sb-layout ${hasPaymentInfo ? 'sb-layout--split' : 'sb-layout--full'}">
    ${gcashCard}

    <div class="card sb-form-card">
      <div class="card-label">PAYMENT DETAILS</div>
      <div class="sb-form-card__body">
        ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}
        <form id="sb-form" class="sb-form">
          <div class="sb-field-row">
            <div class="login-field">
              <label for="sb-amount">Amount Paid (₱) <span class="reg-req">*</span></label>
              <input id="sb-amount" class="login-field__input" type="number" name="amount" min="1" step="0.01" value="${balance > 0 ? escHtml(String(balance)) : ''}" required>
            </div>
            <div class="login-field">
              <label for="sb-category">What's this for <span class="reg-req">*</span></label>
              <select id="sb-category" class="login-field__input" name="category" required>
                <option value="">— select —</option>
                ${PAYMENT_CATEGORIES.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
              </select>
            </div>
          </div>
          <p id="sb-season-hint" class="sb-season-hint" style="display:none">This will be recorded under the active season${activeSeason ? ` — <strong>Season ${escHtml(String(activeSeason))}</strong>` : ''}.</p>

          <div class="sb-field-row">
            <div class="login-field">
              <label for="sb-method">Mode of Payment <span class="reg-req">*</span></label>
              <select id="sb-method" class="login-field__input" name="payment_method" required>
                <option value="">— select —</option>
                ${PAYMENT_METHODS.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
              </select>
            </div>
            <div class="login-field">
              <label for="sb-reference">Reference Number <span style="opacity:.5;font-size:11px">(optional)</span></label>
              <input id="sb-reference" class="login-field__input" type="text" name="reference_no" placeholder="e.g. GCash reference number">
            </div>
          </div>

          <div class="login-field" style="margin-bottom:24px">
            <label for="sb-screenshot">Screenshot of Payment <span class="reg-req">*</span></label>
            <input id="sb-screenshot" type="file" accept="image/*" required>
            <div id="sb-screenshot-preview-wrap" class="sb-preview-wrap" style="display:none">
              <img id="sb-screenshot-preview" class="sb-preview-wrap__img">
            </div>
          </div>
          <button type="submit" class="login-submit" id="sb-submit">SUBMIT PAYMENT</button>
        </form>
      </div>
    </div>
  </div>
</div>
${SB_STYLES}

<script>
(function() {
  var categorySelect = document.getElementById('sb-category');
  var seasonHint = document.getElementById('sb-season-hint');
  categorySelect.addEventListener('change', function() {
    seasonHint.style.display = categorySelect.value === 'Season Fee' ? 'block' : 'none';
  });

  var fileInput = document.getElementById('sb-screenshot');
  var preview = document.getElementById('sb-screenshot-preview');
  var previewWrap = document.getElementById('sb-screenshot-preview-wrap');
  var screenshotDataUrl = '';

  fileInput.addEventListener('change', function() {
    var file = fileInput.files[0];
    if (!file) { screenshotDataUrl = ''; previewWrap.style.display = 'none'; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      screenshotDataUrl = e.target.result;
      preview.src = screenshotDataUrl;
      previewWrap.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('sb-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = document.getElementById('sb-submit');
    var amount = document.getElementById('sb-amount').value;
    var category = categorySelect.value;
    var method = document.getElementById('sb-method').value;
    var referenceNo = document.getElementById('sb-reference').value;

    if (!amount || Number(amount) <= 0) { alert('Enter a valid amount.'); return; }
    if (!category) { alert("Select what this payment is for."); return; }
    if (!method) { alert('Select a mode of payment.'); return; }
    if (!screenshotDataUrl) { alert('Attach a screenshot of the payment.'); return; }

    btn.disabled = true; btn.textContent = 'SUBMITTING…';
    fetch('/settle-balance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), category: category, payment_method: method, reference_no: referenceNo, screenshot: screenshotDataUrl })
    })
    .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
      window.location.href = '/settle-balance?submitted=1';
    })
    .catch(function(err) {
      alert(err.message);
      btn.disabled = false; btn.textContent = 'SUBMIT PAYMENT';
    });
  });
})();
</script>`;
}
