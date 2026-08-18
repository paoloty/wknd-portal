import { escHtml } from '../layout.js';

function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

const ICON_PHOTO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5.5-5.5L3 20"/></svg>`;

function courtThumb(c) {
  return c.image_url
    ? `<img src="/api/papawis-court/${escHtml(c.id)}/photo" alt="" class="court-thumb" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid var(--admin-border,#1e293b)">`
    : `<div class="court-thumb" style="width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.16);color:#475569">${ICON_PHOTO}</div>`;
}

function courtRow(c) {
  return `<tr class="border-b border-admin-border/40 last:border-0" data-id="${escHtml(c.id)}">
    <td class="px-4 py-3">
      <div class="flex items-center gap-3">
        ${courtThumb(c)}
        <span class="text-sm font-medium text-slate-200">${escHtml(c.name)}</span>
      </div>
    </td>
    <td class="px-4 py-3 text-sm font-saira text-brand">${c.price_per_hour > 0 ? peso(c.price_per_hour) + '/hr' : `<span class="text-slate-600 font-sans">Not set</span>`}</td>
    <td class="px-4 py-3">${c.active ? `<span class="agm-badge agm-badge--amber">Active</span>` : `<span class="agm-badge agm-badge--gray">Inactive</span>`}</td>
    <td class="px-4 py-3 text-right whitespace-nowrap">
      <button class="admin-btn admin-btn--sm" onclick='openCourtModal(${JSON.stringify({ id: c.id, name: c.name, price: c.price_per_hour, hasPhoto: !!c.image_url }).replace(/'/g, '&#39;')})'>Edit</button>
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
      <div id="court-photo-field" style="display:none">
        <label class="admin-field-label">Photo</label>
        <div id="court-photo-preview-wrap" style="display:none;position:relative;border-radius:10px;overflow:hidden;height:120px;background:linear-gradient(155deg,#303a50,#171d29 60%,#0c0f16)">
          <img id="court-photo-preview" src="" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
          <label for="court-photo-input" style="position:absolute;right:9px;bottom:9px;background:rgba(10,13,20,.72);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.18);color:#f4f6f9;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:7px;cursor:pointer">Replace</label>
        </div>
        <label id="court-photo-dropzone" for="court-photo-input" style="display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:22px 12px;border:1.5px dashed rgba(255,255,255,.18);border-radius:10px;background:var(--surface-2,#161c29);cursor:pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.55"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5.5-5.5L3 20"/></svg>
          <span style="font-size:12.5px;font-weight:600;color:#e2e8f0">Click to upload a photo</span>
          <span style="font-size:11px;color:#64748b">JPG or PNG</span>
        </label>
        <input type="file" id="court-photo-input" accept="image/*" class="hidden" style="display:none">
        <div id="court-photo-msg" class="text-xs text-slate-500 mt-1" style="display:none"></div>
      </div>
      <div id="court-modal-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="court-submit-btn">Save</button>
    </div>
  </div>
</div>

<script>
document.getElementById('court-modal-close').addEventListener('click', function() { document.getElementById('court-modal-backdrop').hidden = true; });

var courtPhotoField    = document.getElementById('court-photo-field');
var courtPhotoWrap     = document.getElementById('court-photo-preview-wrap');
var courtPhotoPreview  = document.getElementById('court-photo-preview');
var courtPhotoDropzone = document.getElementById('court-photo-dropzone');
var courtPhotoInput    = document.getElementById('court-photo-input');
var courtPhotoMsg      = document.getElementById('court-photo-msg');
var currentCourtId     = '';

function showCourtPhotoState(hasPhoto) {
  courtPhotoWrap.style.display = hasPhoto ? '' : 'none';
  courtPhotoDropzone.style.display = hasPhoto ? 'none' : 'flex';
}

window.openCourtModal = function(court) {
  document.getElementById('court-modal-title').textContent = court ? 'Edit Court' : 'Add Court';
  document.getElementById('court-id').value = court ? court.id : '';
  document.getElementById('court-name').value = court ? court.name : '';
  document.getElementById('court-price').value = court && court.price ? court.price : '';
  document.getElementById('court-modal-msg').style.display = 'none';
  courtPhotoMsg.style.display = 'none';
  courtPhotoInput.value = '';
  currentCourtId = court ? court.id : '';

  // Photo upload needs a court id to attach to — only shown once a court actually exists.
  if (court) {
    courtPhotoField.style.display = '';
    if (court.hasPhoto) courtPhotoPreview.src = '/api/papawis-court/' + court.id + '/photo?t=' + Date.now();
    showCourtPhotoState(!!court.hasPhoto);
  } else {
    courtPhotoField.style.display = 'none';
  }
  document.getElementById('court-modal-backdrop').hidden = false;
};

courtPhotoInput.addEventListener('change', function() {
  var file = this.files[0];
  if (!file || !currentCourtId) return;
  courtPhotoMsg.style.color = 'var(--text-muted)'; courtPhotoMsg.textContent = 'Uploading…'; courtPhotoMsg.style.display = 'block';
  var reader = new FileReader();
  reader.onload = function(e) {
    fetch('/admin/papawis/courts/' + currentCourtId + '/photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: e.target.result }),
    })
    .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.j.error || 'Upload failed.');
      courtPhotoPreview.src = '/api/papawis-court/' + currentCourtId + '/photo?t=' + Date.now();
      showCourtPhotoState(true);
      courtPhotoMsg.style.color = '#22c55e'; courtPhotoMsg.textContent = 'Saved.';
    })
    .catch(function(e) { courtPhotoMsg.style.color = '#f87171'; courtPhotoMsg.textContent = e.message; });
  };
  reader.readAsDataURL(file);
});

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
