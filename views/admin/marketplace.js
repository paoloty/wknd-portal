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

const MARKETPLACE_MAX_PHOTOS = 10;

// Existing photos as a removable thumbnail grid, plus one bulk add tile (multi-file picker)
// that appends new uploads to the end of the array in a single request — replaces the old
// fixed-4-slot-index model now that the player-facing gallery is an open masonry grid rather
// than a max-4 carousel. Same FileReader → dataUrl → fetch POST pattern as the Papawis court
// photo upload (views/admin/papawis-courts.js), batched into one array instead of one call
// per file.
function photoManager(listingId, photos) {
  const thumbs = photos.map((_, i) => `<div class="mkt-photo-slot" data-index="${i}" draggable="true">
      <img src="/api/marketplace/${escHtml(listingId)}/photo/${i}?t=${Date.now()}" alt="">
      <button type="button" class="mkt-photo-remove" data-remove-index="${i}">&times;</button>
    </div>`).join('');
  const room = MARKETPLACE_MAX_PHOTOS - photos.length;
  const addTile = room > 0
    ? `<label class="mkt-photo-add">
         ${ICON_PLUS}
         <input type="file" accept="image/*" id="mkt-photo-input" multiple hidden>
       </label>`
    : `<div class="mkt-photo-add mkt-photo-add--full">Limit reached</div>`;

  return `
<div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-5">
  <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Photos <span class="font-normal normal-case text-slate-600">(${photos.length}/${MARKETPLACE_MAX_PHOTOS} — select multiple at once, drag to reorder)</span></div>
  <div class="mkt-photo-grid" id="mkt-photo-grid">${thumbs}${addTile}</div>
  <p class="agm-modal-err" id="mkt-photo-err" style="margin-top:8px" hidden></p>
</div>
<style>
.mkt-photo-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.mkt-photo-slot { position: relative; width: 90px; height: 90px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,.08); cursor: grab; transition: opacity .12s, border-color .12s; }
.mkt-photo-slot:active { cursor: grabbing; }
.mkt-photo-slot.is-dragging { opacity: .35; }
.mkt-photo-slot.is-dragover { border-color: rgba(245,147,50,.6); }
.mkt-photo-slot:first-child::after {
  content: 'Cover'; position: absolute; bottom: 0; left: 0; right: 0; text-align: center;
  font-size: 9px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  padding: 2px 0; background: rgba(0,0,0,.6); color: rgba(255,255,255,.85); pointer-events: none;
}
.mkt-photo-slot img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.mkt-photo-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,.65); color: #fff; font-size: 13px; line-height: 1; cursor: pointer; }
.mkt-photo-add { width: 90px; height: 90px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: rgba(255,255,255,.35); background: rgba(255,255,255,.02); border: 1px dashed rgba(255,255,255,.14); text-align: center; font-size: 10.5px; padding: 6px; }
.mkt-photo-add:hover { background: rgba(255,255,255,.05); color: rgba(255,255,255,.5); }
.mkt-photo-add--full { cursor: default; opacity: .5; }
.mkt-photo-add--full:hover { background: rgba(255,255,255,.02); color: rgba(255,255,255,.35); }
</style>
<script>
(function() {
  var grid = document.getElementById('mkt-photo-grid');
  var err  = document.getElementById('mkt-photo-err');
  var listingId = ${JSON.stringify(listingId)};

  function readAsDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(ev) { resolve(ev.target.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  var input = document.getElementById('mkt-photo-input');
  if (input) {
    input.addEventListener('change', function() {
      var files = Array.prototype.slice.call(input.files);
      if (!files.length) return;
      err.hidden = true;
      Promise.all(files.map(readAsDataUrl))
        .then(function(dataUrls) {
          return fetch('/admin/marketplace/' + listingId + '/photos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrls: dataUrls }),
          });
        })
        .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
        .then(function(res) {
          if (!res.ok) throw new Error(res.j.error || 'Upload failed.');
          window.location.reload();
        })
        .catch(function(ex) { err.textContent = ex.message; err.hidden = false; });
    });
  }

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

  // Drag-drop reorder — dragging repositions the DOM node live (drop target's left/right
  // half decides before-vs-after), dragend reads the resulting DOM order back out as a
  // permutation of original indices and persists it in one small request. Index 0 becomes
  // the browse-card cover photo, so this is also how an admin picks the cover.
  var dragEl = null;
  grid.addEventListener('dragstart', function(e) {
    var slot = e.target.closest('.mkt-photo-slot');
    if (!slot) { e.preventDefault(); return; }
    dragEl = slot;
    slot.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  grid.addEventListener('dragover', function(e) {
    if (!dragEl) return;
    e.preventDefault();
    var target = e.target.closest('.mkt-photo-slot');
    if (!target || target === dragEl) return;
    var rect = target.getBoundingClientRect();
    var before = (e.clientX - rect.left) < rect.width / 2;
    grid.insertBefore(dragEl, before ? target : target.nextSibling);
  });
  grid.addEventListener('dragend', function() {
    if (!dragEl) return;
    dragEl.classList.remove('is-dragging');
    dragEl = null;
    var order = Array.prototype.map.call(grid.querySelectorAll('.mkt-photo-slot'), function(el) { return Number(el.dataset.index); });
    var unchanged = order.every(function(v, i) { return v === i; });
    if (unchanged) return;
    err.hidden = true;
    fetch('/admin/marketplace/' + listingId + '/photos/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: order }),
    })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
      .then(function(res) {
        if (!res.ok) throw new Error(res.j.error || 'Failed to reorder.');
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

// Shared by New and Edit — identical fields either way, just pre-filled + a different
// submit target/success redirect. mode: 'new' | 'edit'.
function marketplaceListingForm({ mode, listing = null, jerseySizes = [] }) {
  const isEdit = mode === 'edit';
  const initialGroups = isEdit ? (() => { try { return JSON.parse(listing.variant_options || '[]'); } catch { return []; } })() : [];
  const submitUrl = isEdit ? `/admin/marketplace/${listing.id}` : '/admin/marketplace';
  const successUrl = isEdit ? `/admin/marketplace/${listing.id}` : null;

  return `
<form id="mkt-form" class="bg-admin-surface border border-admin-border rounded-lg p-5 max-w-lg">
  <div class="mb-4">
    <label class="admin-field-label">Title</label>
    <input type="text" name="title" class="admin-input mt-1" placeholder="e.g. Season 4 Away Jersey" value="${isEdit ? escHtml(listing.title) : ''}" required>
  </div>
  <div class="mb-4">
    <label class="admin-field-label">Description</label>
    <textarea name="description" class="admin-input mt-1" rows="3" placeholder="Optional details">${isEdit ? escHtml(listing.description || '') : ''}</textarea>
  </div>
  <div class="grid grid-cols-2 gap-3 mb-4">
    <div>
      <label class="admin-field-label">Price per buyer</label>
      <input type="number" name="price" class="admin-input mt-1" min="1" step="1" value="${isEdit ? escHtml(String(listing.price)) : ''}" required>
    </div>
    <div>
      <label class="admin-field-label">Minimum buyers</label>
      <input type="number" name="min_buyers" class="admin-input mt-1" min="1" step="1" value="${isEdit ? escHtml(String(listing.min_buyers)) : '15'}" required>
    </div>
  </div>
  <div class="mb-4">
    <label class="admin-field-label">Variants <span class="font-normal text-slate-500">(optional — add one group per thing a buyer needs to pick, e.g. Jersey Size and Shorts Size separately)</span></label>
    <div id="mkt-variant-groups" class="mt-2" style="display:flex;flex-direction:column;gap:10px"></div>
    <div class="flex items-center gap-2 mt-2">
      <button type="button" id="mkt-add-jersey-size" class="text-[11px] text-brand hover:underline">+ Jersey Size</button>
      <button type="button" id="mkt-add-shorts-size" class="text-[11px] text-brand hover:underline">+ Shorts Size</button>
      <button type="button" id="mkt-add-custom-variant" class="text-[11px] text-brand hover:underline">+ Custom variant</button>
    </div>
  </div>
  <p class="agm-modal-err" id="mkt-err" hidden></p>
  <button type="submit" class="admin-btn">${isEdit ? 'Save Changes' : 'Create Listing'}</button>
  ${isEdit ? `<a href="/admin/marketplace/${escHtml(listing.id)}" class="admin-btn admin-btn--sm admin-btn--muted ml-2">Cancel</a>` : ''}
</form>

<script>
(function() {
  var sizes = ${JSON.stringify(jerseySizes)};
  var initialGroups = ${JSON.stringify(initialGroups)};
  var groupsWrap = document.getElementById('mkt-variant-groups');

  function addGroup(label, optionsText, sizeChartKind, surchargeStep) {
    var row = document.createElement('div');
    row.className = 'mkt-variant-group-row';
    row.style.cssText = 'border:1px solid var(--admin-border,#243044);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px';
    row.innerHTML =
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input type="text" class="admin-input mkt-variant-label" placeholder="Group name — e.g. Jersey Size" style="flex:1" value="' + (label || '').replace(/"/g, '&quot;') + '">' +
        '<button type="button" class="mkt-variant-remove" style="color:#f87171;background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:4px 6px">&times;</button>' +
      '</div>' +
      '<textarea class="admin-input mkt-variant-options-text" rows="3" placeholder="One option per line — e.g. Small / Medium / Large">' + (optionsText || '') + '</textarea>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<label style="font-size:11px;color:var(--admin-muted,#7c8aa5);white-space:nowrap">Size chart:</label>' +
        '<select class="admin-input mkt-variant-chart" style="flex:0 0 auto;width:auto">' +
          '<option value=""' + (sizeChartKind ? '' : ' selected') + '>None</option>' +
          '<option value="top"' + (sizeChartKind === 'top' ? ' selected' : '') + '>Top (chest/length)</option>' +
          '<option value="shorts"' + (sizeChartKind === 'shorts' ? ' selected' : '') + '>Shorts (hips/length)</option>' +
        '</select>' +
        '<label style="font-size:11px;color:var(--admin-muted,#7c8aa5);white-space:nowrap;margin-left:6px">Surcharge/tier (2XL+):</label>' +
        '<input type="number" class="admin-input mkt-variant-surcharge" min="0" step="1" placeholder="0" style="flex:0 0 auto;width:80px" value="' + (surchargeStep || '') + '">' +
      '</div>';
    row.querySelector('.mkt-variant-remove').addEventListener('click', function() { row.remove(); });
    groupsWrap.appendChild(row);
  }

  initialGroups.forEach(function(g) { addGroup(g.label, (g.options || []).join('\\n'), g.sizeChartKind || '', g.surchargeStep || 0); });

  document.getElementById('mkt-add-jersey-size').addEventListener('click', function() { addGroup('Jersey Size', sizes.join('\\n'), 'top', 0); });
  document.getElementById('mkt-add-shorts-size').addEventListener('click', function() { addGroup('Shorts Size', sizes.join('\\n'), 'shorts', 0); });
  document.getElementById('mkt-add-custom-variant').addEventListener('click', function() { addGroup('', '', '', 0); });

  document.getElementById('mkt-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var f = e.target;
    var err = document.getElementById('mkt-err');
    var variantGroups = [];
    groupsWrap.querySelectorAll('.mkt-variant-group-row').forEach(function(row) {
      var label = row.querySelector('.mkt-variant-label').value.trim();
      var options = row.querySelector('.mkt-variant-options-text').value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
      var sizeChartKind = row.querySelector('.mkt-variant-chart').value;
      var surchargeStep = Number(row.querySelector('.mkt-variant-surcharge').value) || 0;
      if (label && options.length) variantGroups.push({ label: label, options: options, sizeChartKind: sizeChartKind, surchargeStep: surchargeStep });
    });
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      var r = await fetch(${JSON.stringify(submitUrl)}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.value.trim(), description: f.description.value.trim(),
          price: f.price.value, min_buyers: f.min_buyers.value, variant_options: variantGroups,
        }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to save.');
      window.location.href = ${isEdit ? JSON.stringify(successUrl) : "'/admin/marketplace/' + j.id"};
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false; btn.disabled = false;
    }
  });
})();
</script>`;
}

export function adminMarketplaceNewBody({ jerseySizes = [] } = {}) {
  return `
<div class="mb-5">
  <a href="/admin/marketplace" class="text-xs text-slate-500 hover:text-slate-300">&larr; Back to Marketplace</a>
</div>
<h2 class="text-xl font-bold tracking-tight text-slate-100 mb-5">New Group Buy</h2>
${marketplaceListingForm({ mode: 'new', jerseySizes })}`;
}

export function adminMarketplaceEditBody({ listing, jerseySizes = [] } = {}) {
  return `
<div class="mb-5">
  <a href="/admin/marketplace/${escHtml(listing.id)}" class="text-xs text-slate-500 hover:text-slate-300">&larr; Back to ${escHtml(listing.title)}</a>
</div>
<h2 class="text-xl font-bold tracking-tight text-slate-100 mb-5">Edit Group Buy</h2>
${marketplaceListingForm({ mode: 'edit', listing, jerseySizes })}`;
}

export function adminMarketplaceDetailBody({ listing, commitments = [], canTrigger = false, variantGroups = [] } = {}) {
  const meets = commitments.length >= listing.min_buyers;
  const isOpen = listing.status === 'open' || listing.status === 'active';
  const isCharged = listing.status === 'charged';
  const hasSurcharge = variantGroups.some(g => g.surchargeStep > 0);

  const rows = commitments.map(c => `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.variantLabel || '—')}</td>
    ${hasSurcharge ? `<td class="px-4 py-2.5 text-xs text-slate-300 font-semibold">${fmtPeso(c.amount)}${c.surcharge ? `<span class="text-slate-500 font-normal"> (+${fmtPeso(c.surcharge)})</span>` : ''}</td>` : ''}
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
  <div class="flex items-center gap-2">
    ${listing.status === 'charged' ? '<span class="agm-badge agm-badge--green">Charged</span>' : listing.status === 'cancelled' ? '<span class="agm-badge agm-badge--gray">Cancelled</span>' : '<span class="agm-badge agm-badge--amber">Open</span>'}
    ${isOpen ? `<a href="/admin/marketplace/${escHtml(listing.id)}/edit" class="admin-btn admin-btn--sm">Edit</a>` : ''}
    ${isCharged ? `<button type="button" id="mkt-relaunch-btn" class="admin-btn admin-btn--sm">Relaunch</button>` : ''}
  </div>
</div>
<p class="text-sm text-slate-400 mb-5">${fmtPeso(listing.price)} per buyer &middot; min ${listing.min_buyers} buyers</p>

${photoManager(listing.id, parseJsonArray(listing.photos))}

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Variant</th>
        ${hasSurcharge ? `<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Amount</th>` : ''}
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Committed</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${hasSurcharge ? 4 : 3}" class="px-4 py-8 text-center text-sm text-slate-500">No commitments yet.</td></tr>`}
    </tbody>
  </table>
</div>

${triggerSection}
<script>
(function() {
  var relaunchBtn = document.getElementById('mkt-relaunch-btn');
  if (!relaunchBtn) return;
  relaunchBtn.addEventListener('click', async function() {
    if (!confirm('Start a new round of this group buy? Same title, price, and variants — fresh listing, no commitments.')) return;
    relaunchBtn.disabled = true;
    try {
      var r = await fetch(${JSON.stringify('/admin/marketplace/' + listing.id + '/relaunch')}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to relaunch.');
      window.location.href = '/admin/marketplace/' + j.id;
    } catch (ex) {
      alert(ex.message); relaunchBtn.disabled = false;
    }
  });
})();
</script>

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
