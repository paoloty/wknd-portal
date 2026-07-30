import { escHtml } from '../layout.js';

const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l3.5 3.5L11 3"/></svg>`;

export function adminFinanceGcashBody({ gcash = {} } = {}) {
  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">GCash Settlement</h2>
  <p class="text-xs text-slate-500 mt-0.5">Shown to players on the Settle Balance page so they can pay you directly via GCash.</p>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg">
  <div class="p-5">
    <div class="mb-3">
      <label class="admin-field-label">Account name</label>
      <input type="text" id="fn-gcash-name" class="admin-input" placeholder="e.g. Paolo T." value="${escHtml(gcash.name || '')}">
    </div>
    <div class="mb-3">
      <label class="admin-field-label">Mobile number</label>
      <input type="text" id="fn-gcash-number" class="admin-input" placeholder="09XX XXX XXXX" value="${escHtml(gcash.number || '')}">
    </div>
    <div class="mb-3">
      <label class="admin-field-label">QR code content <span class="normal-case font-normal text-slate-600">— paste the exact code/payload from your GCash QR</span></label>
      <textarea id="fn-gcash-qr-payload" class="admin-input" rows="3" placeholder="Paste your GCash QR payload here">${escHtml(gcash.qr_payload || '')}</textarea>
    </div>
    <div class="flex items-center gap-4">
      <button id="fn-gcash-save" class="agm-new-btn">${ICON_CHECK} Save</button>
      <span id="fn-gcash-msg" class="text-xs"></span>
    </div>
    ${gcash.qr_payload ? `<div class="mt-4 pt-4 border-t border-admin-border/50">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Preview</div>
      <img src="/api/gcash-qr.png?v=${Date.now()}" alt="GCash QR preview" style="width:160px;height:160px;border-radius:8px;border:1px solid var(--admin-border-color,#1e293b)">
    </div>` : ''}
  </div>
</div>

<script>
(function(){
  var gcashSaveBtn = document.getElementById('fn-gcash-save');
  gcashSaveBtn.addEventListener('click', async function() {
    var btn = this;
    var msg = document.getElementById('fn-gcash-msg');
    btn.disabled = true;
    msg.style.color = 'var(--text-muted)'; msg.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/site/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcash_name: document.getElementById('fn-gcash-name').value.trim(),
          gcash_number: document.getElementById('fn-gcash-number').value.trim(),
          gcash_qr_payload: document.getElementById('fn-gcash-qr-payload').value.trim(),
        })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      setTimeout(function() { location.reload(); }, 500);
    } catch (e) {
      msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
      btn.disabled = false;
    }
  });
})();
</script>`;
}
