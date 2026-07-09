import { escHtml } from '../layout.js';

export function adminSiteBody({ seasons = [], quotas = {} } = {}) {
  const fmt = v => v ? Number(v).toFixed(2) : '';

  const quotaRows = seasons.length
    ? seasons.map(s => `
  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:13px;font-weight:600;color:var(--text-primary);width:80px">Season ${escHtml(String(s))}</span>
    <input type="number" class="admin-input site-quota-input" data-season="${escHtml(String(s))}"
      min="0" step="0.01" placeholder="0.00"
      value="${escHtml(fmt(quotas[s]))}"
      style="width:140px;padding:6px 10px;font-size:13px">
    <span class="site-quota-msg" style="font-size:12px"></span>
  </div>`).join('')
    : `<p style="color:var(--text-muted);font-size:13px;padding:12px 0">No seasons found. Games must exist before setting quotas.</p>`;

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Site Settings</h2>
</div>

<div class="card agm-editor-card" style="max-width:560px">
  <div class="agm-editor-card__title">Season Quotas</div>
  <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Set the payment quota per player for each season. Used in the Ledger to track progress.</p>
  ${quotaRows}
  ${seasons.length ? `<button id="site-quota-save" class="agm-edit-bar__save" style="margin-top:16px">Save Quotas</button>
  <span id="site-quota-msg" style="font-size:12px;margin-left:12px"></span>` : ''}
</div>

<script>
  var saveBtn = document.getElementById('site-quota-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      var btn = this;
      var globalMsg = document.getElementById('site-quota-msg');
      btn.disabled = true; btn.textContent = 'Saving…';
      globalMsg.textContent = '';

      var inputs = document.querySelectorAll('.site-quota-input');
      var errors = 0;

      await Promise.all(Array.from(inputs).map(async function(input) {
        var season = input.dataset.season;
        var amount = parseFloat(input.value);
        var msg = input.nextElementSibling;
        if (input.value === '') { msg.textContent = ''; return; }
        if (isNaN(amount) || amount < 0) { msg.style.color = '#f87171'; msg.textContent = 'Invalid'; errors++; return; }
        try {
          var r = await fetch('/admin/ledger/quota/' + encodeURIComponent(season), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
          });
          if (!r.ok) throw new Error('Failed');
          msg.style.color = '#22c55e'; msg.textContent = 'Saved';
        } catch(e) {
          msg.style.color = '#f87171'; msg.textContent = 'Error';
          errors++;
        }
      }));

      btn.disabled = false; btn.textContent = 'Save Quotas';
      if (!errors) {
        globalMsg.style.color = '#22c55e';
        globalMsg.textContent = 'All quotas saved.';
      }
    });
  }
</script>`;
}
