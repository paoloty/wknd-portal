import { escHtml } from '../layout.js';

export function adminSiteBody({ seasons = [], quotas = {}, settings = {} } = {}) {
  const fmt = v => v ? Number(v).toFixed(2) : '';
  const mvpEnabled = settings.mvp_race_enabled !== '0';

  const quotaRows = seasons.length
    ? seasons.map(s => `
  <div class="flex items-center gap-3 py-3 border-b border-admin-border/70 last:border-b-0">
    <span class="text-[13px] font-semibold text-slate-200 w-20 shrink-0">Season ${escHtml(String(s))}</span>
    <input type="number" class="admin-input site-quota-input" data-season="${escHtml(String(s))}"
      min="0" step="0.01" placeholder="0.00"
      value="${escHtml(fmt(quotas[s]))}"
      style="width:140px">
    <span class="site-quota-msg text-xs"></span>
  </div>`).join('')
    : `<p class="text-sm text-slate-500 py-3">No seasons found. Games must exist before setting quotas.</p>`;

  return `
<div class="mb-6 flex items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Site Settings</h2>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg mb-4">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Features</div>
  <div class="p-5">
    <p class="text-xs text-slate-500 mb-4 leading-relaxed">Toggle public-facing pages on or off. Disabled pages are removed from the nav and return 404.</p>

    <div class="flex items-center justify-between py-3 border-b border-admin-border/50">
      <div>
        <div class="text-[13px] font-semibold text-slate-200">MVP Race</div>
        <div class="text-xs text-slate-500 mt-0.5">Season MVP ladder with AI-written player cases (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/mvp</code>)</div>
      </div>
      <label class="site-toggle" title="Toggle MVP Race">
        <input type="checkbox" id="toggle-mvp-race" ${mvpEnabled ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>
    <span id="features-msg" class="text-xs block mt-2.5 min-h-[16px]"></span>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Season Quotas</div>
  <div class="p-5">
    <p class="text-xs text-slate-500 mb-4 leading-relaxed">Set the payment quota per player for each season. Used in the Ledger to track progress.</p>
    ${quotaRows}
    ${seasons.length ? `<div class="flex items-center gap-3 mt-4">
      <button id="site-quota-save" class="agm-edit-bar__save">Save Quotas</button>
      <span id="site-quota-msg" class="text-xs"></span>
    </div>` : ''}
  </div>
</div>

<script>
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
