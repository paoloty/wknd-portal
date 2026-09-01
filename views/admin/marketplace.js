import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const ICON_PLUS = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>`;
const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function statusBadge(status) {
  if (status === 'charged')   return `<span class="agm-badge agm-badge--green">Charged</span>`;
  if (status === 'cancelled') return `<span class="agm-badge agm-badge--gray">Cancelled</span>`;
  return `<span class="agm-badge agm-badge--amber">Open</span>`;
}

function parseJsonArray(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Up to 4 slots — a filled slot shows the photo + Remove; an empty slot is a file-picker
// tile. Same FileReader → dataUrl → fetch POST pattern as the Papawis court photo upload
// (views/admin/papawis-courts.js), generalized with an index for multiple slots.
function photoManager(listingId, photos) {
  const slots = [0, 1, 2, 3].map(i => {
    const has = !!photos[i];
    return `<div class="mkt-photo-slot" data-index="${i}">
      ${has
        ? `<img src="/api/marketplace/${escHtml(listingId)}/photo/${i}?t=${Date.now()}" alt="">
           <button type="button" class="mkt-photo-remove" data-remove-index="${i}">&times;</button>`
        : `<label class="mkt-photo-add">
             ${ICON_PLUS}
             <input type="file" accept="image/*" data-upload-index="${i}" hidden>
           </label>`}
    </div>`;
  }).join('');
  return `
<div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-5">
  <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Photos <span class="font-normal normal-case text-slate-600">(up to 4)</span></div>
  <div class="mkt-photo-grid" id="mkt-photo-grid">${slots}</div>
  <p class="agm-modal-err" id="mkt-photo-err" style="margin-top:8px" hidden></p>
</div>
<style>
.mkt-photo-grid { display: grid; grid-template-columns: repeat(4, 90px); gap: 10px; }
.mkt-photo-slot { position: relative; width: 90px; height: 90px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); }
.mkt-photo-slot img { width: 100%; height: 100%; object-fit: cover; }
.mkt-photo-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,.65); color: #fff; font-size: 13px; line-height: 1; cursor: pointer; }
.mkt-photo-add { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: rgba(255,255,255,.35); background: rgba(255,255,255,.02); }
.mkt-photo-add:hover { background: rgba(255,255,255,.05); color: rgba(255,255,255,.5); }
</style>
<script>
(function() {
  var grid = document.getElementById('mkt-photo-grid');
  var err  = document.getElementById('mkt-photo-err');
  var listingId = ${JSON.stringify(listingId)};
  grid.addEventListener('change', function(e) {
    var input = e.target.closest('input[data-upload-index]');
    if (!input || !input.files[0]) return;
    var index = input.dataset.uploadIndex;
    var reader = new FileReader();
    reader.onload = function(ev) {
      fetch('/admin/marketplace/' + listingId + '/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: ev.target.result, index: index }),
      })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
      .then(function(res) {
        if (!res.ok) throw new Error(res.j.error || 'Upload failed.');
        window.location.reload();
      })
      .catch(function(ex) { err.textContent = ex.message; err.hidden = false; });
    };
    reader.readAsDataURL(input.files[0]);
  });
  grid.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-remove-index]');
    if (!btn) return;
    if (!confirm('Remove this photo?')) return;
    fetch('/admin/marketplace/' + listingId + '/photo/' + btn.dataset.removeIndex, { method: 'DELETE' })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
      .then(function(res) {
        if (!res.ok) throw new Error(res.j.error || 'Failed to remove.');
        window.location.reload();
      })
      .catch(function(ex) { err.textContent = ex.message; err.hidden = false; });
  });
})();
</script>`;
}

export function adminMarketplaceListBody({ listings = [], countsById = {} } = {}) {
  const rows = listings.map(l => {
    const count = countsById[l.id] || 0;
    const meets = count >= l.min_buyers;
    return `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(l.title)}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${fmtPeso(l.price)}</td>
      <td class="px-4 py-3 text-sm text-slate-300 font-saira">${count}<span class="text-slate-600">/${l.min_buyers} min</span>${meets ? ` <span class="text-[10px] text-green-400">✓ met</span>` : ''}</td>
      <td class="px-4 py-3">${statusBadge(l.status)}</td>
      <td class="px-4 py-3 text-right">
        <a href="/admin/marketplace/${escHtml(l.id)}" class="agm-edit-link">Manage ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Marketplace</h2>
  <a href="/admin/marketplace/new" class="agm-new-btn">${ICON_PLUS} New Group Buy</a>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Title</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Price</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Committed</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Status</th>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No listings yet.</td></tr>'}
    </tbody>
  </table>
</div>`;
}

export function adminMarketplaceNewBody({ jerseySizes = [] } = {}) {
  return `
<div class="mb-5">
  <a href="/admin/marketplace" class="text-xs text-slate-500 hover:text-slate-300">&larr; Back to Marketplace</a>
</div>
<h2 class="text-xl font-bold tracking-tight text-slate-100 mb-5">New Group Buy</h2>

<form id="mkt-new-form" class="bg-admin-surface border border-admin-border rounded-lg p-5 max-w-lg">
  <div class="mb-4">
    <label class="admin-field-label">Title</label>
    <input type="text" name="title" class="admin-input mt-1" placeholder="e.g. Season 4 Away Jersey" required>
  </div>
  <div class="mb-4">
    <label class="admin-field-label">Description</label>
    <textarea name="description" class="admin-input mt-1" rows="3" placeholder="Optional details"></textarea>
  </div>
  <div class="grid grid-cols-2 gap-3 mb-4">
    <div>
      <label class="admin-field-label">Price per buyer</label>
      <input type="number" name="price" class="admin-input mt-1" min="1" step="1" required>
    </div>
    <div>
      <label class="admin-field-label">Minimum buyers</label>
      <input type="number" name="min_buyers" class="admin-input mt-1" min="1" step="1" value="15" required>
    </div>
  </div>
  <div class="mb-4">
    <div class="flex items-center justify-between mb-1">
      <label class="admin-field-label">Size / variant options <span class="font-normal text-slate-500">(optional, one per line)</span></label>
      <button type="button" id="mkt-jersey-sizes-btn" class="text-[11px] text-brand hover:underline">Use standard jersey sizes</button>
    </div>
    <textarea name="variant_options" id="mkt-variant-options" class="admin-input mt-1" rows="4" placeholder="Small&#10;Medium&#10;Large"></textarea>
  </div>
  <p class="agm-modal-err" id="mkt-err" hidden></p>
  <button type="submit" class="admin-btn">Create Listing</button>
</form>

<script>
(function() {
  var sizes = ${JSON.stringify(jerseySizes)};
  document.getElementById('mkt-jersey-sizes-btn').addEventListener('click', function() {
    document.getElementById('mkt-variant-options').value = sizes.join('\\n');
  });
  document.getElementById('mkt-new-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var f = e.target;
    var err = document.getElementById('mkt-err');
    var variantRaw = f.variant_options.value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      var r = await fetch('/admin/marketplace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.value.trim(), description: f.description.value.trim(),
          price: f.price.value, min_buyers: f.min_buyers.value, variant_options: variantRaw,
        }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to create.');
      window.location.href = '/admin/marketplace/' + j.id;
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false; btn.disabled = false;
    }
  });
})();
</script>`;
}

export function adminMarketplaceDetailBody({ listing, commitments = [], canTrigger = false } = {}) {
  const meets = commitments.length >= listing.min_buyers;
  const isOpen = listing.status === 'open' || listing.status === 'active';

  const rows = commitments.map(c => `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.variant || '—')}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500">${new Date(c.committed_at).toLocaleDateString()}</td>
  </tr>`).join('');

  const triggerSection = isOpen ? `
<div class="bg-admin-surface border border-admin-border rounded-lg p-5 mt-5">
  <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Trigger Charge</div>
  <p class="text-xs text-slate-500 mb-3">
    ${meets
      ? `Threshold met (${commitments.length}/${listing.min_buyers}). You can trigger the charge now, or keep waiting for more commitments — the threshold is a floor, not a cap.`
      : `Needs at least ${listing.min_buyers} committed buyers before this can be triggered (currently ${commitments.length}).`}
  </p>
  ${canTrigger
    ? `<button type="button" id="mkt-trigger-btn" class="admin-btn" ${meets ? '' : 'disabled'}>Charge ${commitments.length} Player${commitments.length === 1 ? '' : 's'} — ${fmtPeso(listing.price)} each</button>`
    : `<span class="text-xs text-slate-500">You don't have permission to trigger marketplace charges. Ask a super-admin to grant it from Privileges.</span>`}
  <p class="agm-modal-err" id="mkt-trigger-err" style="margin-top:8px" hidden></p>
</div>` : '';

  return `
<div class="mb-5">
  <a href="/admin/marketplace" class="text-xs text-slate-500 hover:text-slate-300">&larr; Back to Marketplace</a>
</div>
<div class="flex items-center justify-between mb-1">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">${escHtml(listing.title)}</h2>
  ${listing.status === 'charged' ? '<span class="agm-badge agm-badge--green">Charged</span>' : listing.status === 'cancelled' ? '<span class="agm-badge agm-badge--gray">Cancelled</span>' : '<span class="agm-badge agm-badge--amber">Open</span>'}
</div>
<p class="text-sm text-slate-400 mb-5">${fmtPeso(listing.price)} per buyer &middot; min ${listing.min_buyers} buyers</p>

${photoManager(listing.id, parseJsonArray(listing.photos))}

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Variant</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Committed</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="3" class="px-4 py-8 text-center text-sm text-slate-500">No commitments yet.</td></tr>'}
    </tbody>
  </table>
</div>

${triggerSection}

<script>
(function() {
  var btn = document.getElementById('mkt-trigger-btn');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    if (!confirm('Charge ${commitments.length} committed player(s) ${fmtPeso(listing.price)} each? This cannot be undone.')) return;
    btn.disabled = true;
    var err = document.getElementById('mkt-trigger-err');
    try {
      var r = await fetch(${JSON.stringify('/admin/marketplace/' + listing.id + '/trigger-charge')}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed.');
      window.location.reload();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false; btn.disabled = false;
    }
  });
})();
</script>`;
}
