import { escHtml } from '../layout.js';

function courtRow(c) {
  return `
  <tr class="border-b border-admin-border/40 last:border-0 court-row" data-id="${escHtml(c.id)}">
    <td class="px-4 py-3">
      <input type="text" class="admin-input court-name-input" value="${escHtml(c.name)}" style="min-width:260px">
    </td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-1">
        <span class="text-slate-500 text-sm">₱</span>
        <input type="number" min="0" step="1" class="admin-input court-price-input" value="${c.price_per_player || ''}" placeholder="0" style="width:100px">
      </div>
    </td>
    <td class="px-4 py-3">
      <label class="site-toggle" title="Active — shows up in the New Papawis location picker">
        <input type="checkbox" class="court-active-toggle" ${c.active ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </td>
    <td class="px-4 py-3 text-right">
      <button class="admin-btn admin-btn--sm court-save-btn">Save</button>
      <span class="court-row-msg text-[11px] text-slate-500 ml-2"></span>
    </td>
  </tr>`;
}

// courts: all papawis_courts rows (active and inactive) — inactive ones drop out of the New
// Papawis location dropdown and the "Close out" price-default lookup, but stay listed here
// (editable/reactivatable) since past sessions may still reference their name in free text.
export function adminPapawisCourtsBody({ courts = [] } = {}) {
  const rows = courts.length === 0
    ? `<tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">No courts yet — add one below.</td></tr>`
    : courts.map(courtRow).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <a href="/admin/papawis" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">&larr; Papawis</a>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Courts</h2>
    <p class="text-sm text-slate-500 mt-0.5">Backs the location picker on New Papawis, and pre-fills the "Close out" price when a session's location matches a court by name.</p>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-5">
  <table class="w-full border-collapse">
    <thead>
      <tr class="border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <th class="px-4 py-2.5 text-left">Court</th>
        <th class="px-4 py-2.5 text-left">Price / player</th>
        <th class="px-4 py-2.5 text-left">Active</th>
        <th class="px-4 py-2.5"></th>
      </tr>
    </thead>
    <tbody id="courts-tbody">${rows}</tbody>
  </table>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Add Court</div>
  <div class="p-5 flex flex-col gap-3">
    <div>
      <label class="admin-field-label">Name</label>
      <input type="text" id="new-court-name" class="admin-input w-full" placeholder="e.g. Cloverleaf Basketball Court, Makati">
    </div>
    <div>
      <label class="admin-field-label">Price per player (₱)</label>
      <input type="number" id="new-court-price" class="admin-input w-full" min="0" step="1" placeholder="e.g. 250">
    </div>
    <div id="new-court-msg" class="text-xs text-error" style="display:none"></div>
    <button class="agm-new-btn" id="new-court-btn" style="align-self:start">Add Court</button>
  </div>
</div>

<script>
(function() {
  function wireRow(row) {
    var id = row.dataset.id;
    var saveBtn = row.querySelector('.court-save-btn');
    var msg = row.querySelector('.court-row-msg');
    saveBtn.addEventListener('click', async function() {
      var name = row.querySelector('.court-name-input').value.trim();
      var price = row.querySelector('.court-price-input').value;
      var active = row.querySelector('.court-active-toggle').checked;
      if (!name) { msg.textContent = 'Name required.'; msg.style.color = '#f87171'; return; }
      saveBtn.disabled = true; msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r1 = await fetch('/admin/papawis/courts/' + id, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, price: price })
        });
        var r2 = await fetch('/admin/papawis/courts/' + id + '/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: active })
        });
        if (!r1.ok || !r2.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch (e) { msg.style.color = '#f87171'; msg.textContent = 'Error.'; }
      saveBtn.disabled = false;
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  }
  document.querySelectorAll('.court-row').forEach(wireRow);

  document.getElementById('new-court-btn').addEventListener('click', async function() {
    var btn = this;
    var msg = document.getElementById('new-court-msg');
    var name = document.getElementById('new-court-name').value.trim();
    var price = document.getElementById('new-court-price').value;
    msg.style.display = 'none';
    if (!name) { msg.textContent = 'Court name is required.'; msg.style.display = 'block'; return; }
    btn.disabled = true;
    try {
      var r = await fetch('/admin/papawis/courts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, price: price })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) { msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false; }
  });
})();
</script>`;
}
