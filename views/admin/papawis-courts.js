import { escHtml } from '../layout.js';

function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function courtRow(c) {
  return `<tr class="border-b border-admin-border/40 last:border-0" data-id="${escHtml(c.id)}">
    <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(c.name)}</td>
    <td class="px-4 py-3 text-sm font-saira text-brand">${c.price_per_hour > 0 ? peso(c.price_per_hour) + '/hr' : `<span class="text-slate-600 font-sans">Not set</span>`}</td>
    <td class="px-4 py-3">${c.active ? `<span class="agm-badge agm-badge--amber">Active</span>` : `<span class="agm-badge agm-badge--gray">Inactive</span>`}</td>
    <td class="px-4 py-3 text-right whitespace-nowrap">
      <button class="admin-btn admin-btn--sm" onclick='openCourtModal(${JSON.stringify({ id: c.id, name: c.name, price: c.price_per_hour }).replace(/'/g, '&#39;')})'>Edit</button>
      <button class="admin-btn admin-btn--sm ${c.active ? 'admin-btn--danger' : 'admin-btn--success'}" onclick="toggleCourt('${escHtml(c.id)}', ${c.active ? 'false' : 'true'})">${c.active ? 'Deactivate' : 'Activate'}</button>
    </td>
  </tr>`;
}

// courts: all papawis_courts rows (active and inactive) — inactive ones drop out of the New
// Papawis location dropdown and the "Close out" price-default lookup, but stay listed here
// (editable/reactivatable) since past sessions may still reference their name in free text.
export function adminPapawisCourtsBody({ courts = [] } = {}) {
  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Courts</h2>
    <p class="text-sm text-slate-500 mt-0.5">Backs the location picker on New Papawis, and pre-fills the "Close out" calculator's court rate when a session's location matches a court by name.</p>
  </div>
  <div class="flex items-center gap-2">
    <a href="/admin/papawis" class="admin-btn">&larr; Back to Papawis</a>
    <button class="agm-new-btn" onclick="openCourtModal(null)">Add Court</button>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden overflow-x-auto">
  ${courts.length === 0
    ? `<div class="p-8 text-center text-sm text-slate-500">No courts yet.</div>`
    : `<table class="w-full border-collapse">
        <thead><tr class="border-b border-admin-border">
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Court</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Rate / hour</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
          <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
        </tr></thead>
        <tbody>${courts.map(courtRow).join('')}</tbody>
      </table>`}
</div>

<div class="agm-modal-backdrop" id="court-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title" id="court-modal-title">Add Court</h3>
      <button class="agm-modal-close" id="court-modal-close">&times;</button>
    </div>
    <div class="agm-modal-body" style="display:flex;flex-direction:column;gap:12px">
      <input type="hidden" id="court-id">
      <div>
        <label class="admin-field-label">Name</label>
        <input id="court-name" type="text" class="admin-input" placeholder="e.g. Cloverleaf Basketball Court, Makati">
      </div>
      <div>
        <label class="admin-field-label">Rate per hour (₱)</label>
        <input id="court-price" type="number" min="0" step="1" class="admin-input" placeholder="e.g. 700">
      </div>
      <div id="court-modal-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="court-submit-btn">Save</button>
    </div>
  </div>
</div>

<script>
document.getElementById('court-modal-close').addEventListener('click', function() { document.getElementById('court-modal-backdrop').hidden = true; });
window.openCourtModal = function(court) {
  document.getElementById('court-modal-title').textContent = court ? 'Edit Court' : 'Add Court';
  document.getElementById('court-id').value = court ? court.id : '';
  document.getElementById('court-name').value = court ? court.name : '';
  document.getElementById('court-price').value = court && court.price ? court.price : '';
  document.getElementById('court-modal-msg').style.display = 'none';
  document.getElementById('court-modal-backdrop').hidden = false;
};
document.getElementById('court-submit-btn').addEventListener('click', async function() {
  var msg = document.getElementById('court-modal-msg');
  msg.style.display = 'none';
  var id = document.getElementById('court-id').value;
  var body = {
    name: document.getElementById('court-name').value.trim(),
    price: Number(document.getElementById('court-price').value) || 0,
  };
  if (!body.name) { msg.textContent = 'Court name is required.'; msg.style.display = 'block'; return; }
  var btn = this; btn.disabled = true;
  try {
    var r = await fetch(id ? '/admin/papawis/courts/' + id : '/admin/papawis/courts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false; }
});
window.toggleCourt = async function(id, active) {
  try {
    var r = await fetch('/admin/papawis/courts/' + id + '/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: active }),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
}
