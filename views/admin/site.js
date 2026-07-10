import { escHtml } from '../layout.js';

export function adminSiteBody({ seasons = [], quotas = {}, settings = {} } = {}) {
  const fmt = v => v ? Number(v).toFixed(2) : '';
  const mvpEnabled = settings.mvp_race_enabled !== '0';

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

<div class="card agm-editor-card" style="max-width:560px;margin-bottom:20px">
  <div class="agm-editor-card__title">Features</div>
  <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Toggle public-facing pages on or off. Disabled pages are removed from the nav and return 404.</p>

  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
    <div>
      <div style="font-size:13px;font-weight:600;color:var(--text-primary)">MVP Race</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Season MVP ladder with AI-written player cases (<code>/mvp</code>)</div>
    </div>
    <label class="site-toggle" title="Toggle MVP Race">
      <input type="checkbox" id="toggle-mvp-race" ${mvpEnabled ? 'checked' : ''}>
      <span class="site-toggle__track"></span>
    </label>
  </div>
  <span id="features-msg" style="font-size:12px;display:block;margin-top:10px;min-height:16px"></span>
</div>

<div class="card agm-editor-card" style="max-width:560px">
  <div class="agm-editor-card__title">Season Quotas</div>
  <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Set the payment quota per player for each season. Used in the Ledger to track progress.</p>
  ${quotaRows}
  ${seasons.length ? `<button id="site-quota-save" class="agm-edit-bar__save" style="margin-top:16px">Save Quotas</button>
  <span id="site-quota-msg" style="font-size:12px;margin-left:12px"></span>` : ''}
</div>

<style>
.site-toggle { position:relative; display:inline-flex; cursor:pointer; }
.site-toggle input { opacity:0; width:0; height:0; position:absolute; }
.site-toggle__track {
  width:40px; height:22px; background:var(--border); border-radius:11px;
  transition:background .2s; position:relative;
}
.site-toggle__track::after {
  content:''; position:absolute; top:3px; left:3px;
  width:16px; height:16px; border-radius:50%; background:#fff;
  transition:transform .2s;
}
.site-toggle input:checked + .site-toggle__track { background:var(--amber); }
.site-toggle input:checked + .site-toggle__track::after { transform:translateX(18px); }
</style>

<script>
  // Feature toggles
  document.getElementById('toggle-mvp-race').addEventListener('change', async function() {
    var msg = document.getElementById('features-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/site/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mvp_race_enabled: this.checked ? '1' : '0' })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e';
      msg.textContent = 'Saved.';
    } catch(e) {
      msg.style.color = '#f87171';
      msg.textContent = 'Error saving.';
      this.checked = !this.checked;
    }
    setTimeout(function() { msg.textContent = ''; }, 2000);
  });

  // Quota save
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
