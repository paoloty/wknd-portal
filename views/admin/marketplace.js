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

// Mirrors the customer-facing strikethrough + savings treatment (views/marketplace.js's
// comparePriceHtml) so admin sees the same "is this listing actually discounted" read —
// only renders when compare_at_price is actually set and higher than the real price.
function compareAmountHtml(listing) {
  const compareAt = Number(listing.compare_at_price) || 0;
  if (!compareAt || compareAt <= listing.price) return '';
  const savings = compareAt - listing.price;
  const pct = Math.round((savings / compareAt) * 100);
  return ` <span class="line-through text-slate-500 font-normal">${fmtPeso(compareAt)}</span> <span class="text-[10px] text-green-400 font-semibold">Save ${fmtPeso(savings)} (${pct}%)</span>`;
}

// Existing photos as a removable thumbnail grid, plus one bulk add tile (multi-file picker)
// that appends new uploads to the end of the array in a single request — replaces the old
// fixed-4-slot-index model now that the player-facing gallery is an open masonry grid rather
// than a max-4 carousel. Same FileReader → dataUrl → fetch POST pattern as the Papawis court
// photo upload (views/admin/papawis-courts.js), batched into one array instead of one call
// per file. No count cap — a photo-backed variant group can reasonably need more than a handful.
function photoManager(listingId, photos) {
  const thumbs = photos.map((_, i) => `<div class="mkt-photo-slot" data-index="${i}" draggable="true">
      <img src="/api/marketplace/${escHtml(listingId)}/photo/${i}?t=${Date.now()}" alt="">
      <button type="button" class="mkt-photo-remove" data-remove-index="${i}">&times;</button>
    </div>`).join('');
  const addTile = `<label class="mkt-photo-add">
         ${ICON_PLUS}
         <input type="file" accept="image/*" id="mkt-photo-input" multiple hidden>
       </label>`;

  return `
<div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-5">
  <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Photos <span class="font-normal normal-case text-slate-600">(${photos.length} — select multiple at once, drag to reorder)</span></div>
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
    return `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors" data-id="${escHtml(l.id)}">
      <td class="px-4 py-3"><input type="checkbox" class="mkt-row-check accent-amber-400" data-id="${escHtml(l.id)}"></td>
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(l.title)}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${fmtPeso(l.price)}${compareAmountHtml(l)}</td>
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
  ${listings.length ? `<div class="px-4 py-2.5 border-b border-admin-border/40 flex items-center gap-3">
    <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
      <input type="checkbox" id="mkt-select-all" class="accent-amber-400"> Select all
    </label>
    <div class="ml-auto">
      <button id="mkt-bulk-delete-btn" class="text-[11px] font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-30" disabled>Delete Selected</button>
    </div>
  </div>` : ''}
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Title</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Price</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Committed</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Status</th>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">No listings yet.</td></tr>'}
    </tbody>
  </table>
</div>
<script>
(function() {
  var selectAll = document.getElementById('mkt-select-all');
  var deleteBtn = document.getElementById('mkt-bulk-delete-btn');
  if (!deleteBtn) return;
  var checks = Array.prototype.slice.call(document.querySelectorAll('.mkt-row-check'));

  function updateBtn() {
    deleteBtn.disabled = document.querySelectorAll('.mkt-row-check:checked').length === 0;
  }
  if (selectAll) selectAll.addEventListener('change', function() {
    checks.forEach(function(c) { c.checked = selectAll.checked; });
    updateBtn();
  });
  checks.forEach(function(c) {
    c.addEventListener('change', function() {
      updateBtn();
      if (selectAll) selectAll.checked = checks.every(function(x) { return x.checked; });
    });
  });

  deleteBtn.addEventListener('click', async function() {
    var ids = Array.prototype.filter.call(checks, function(c) { return c.checked; }).map(function(c) { return c.dataset.id; });
    if (!ids.length) return;
    if (!confirm('Delete ' + ids.length + ' listing' + (ids.length > 1 ? 's' : '') + '? This cannot be undone.')) return;
    deleteBtn.disabled = true;
    var origText = deleteBtn.textContent;
    deleteBtn.textContent = 'Deleting…';
    var results = await Promise.all(ids.map(function(id) {
      return fetch('/admin/marketplace/' + id, { method: 'DELETE' })
        .then(function(r) { return r.json().then(function(j) { return { id: id, ok: r.ok, error: j.error }; }); });
    }));
    var failed = results.filter(function(r) { return !r.ok; });
    if (failed.length) {
      alert('Could not delete ' + failed.length + ' listing' + (failed.length > 1 ? 's' : '') + ' (likely already charged): ' + failed.map(function(f) { return f.error || f.id; }).join(', '));
    }
    window.location.reload();
  });
})();
</script>`;
}

// Shared by New and Edit — identical fields either way, just pre-filled + a different
// submit target/success redirect. mode: 'new' | 'edit'.
function marketplaceListingForm({ mode, listing = null, jerseySizes = [] }) {
  const isEdit = mode === 'edit';
  const initialGroups = isEdit ? (() => { try { return JSON.parse(listing.variant_options || '[]'); } catch { return []; } })() : [];
  const submitUrl = isEdit ? `/admin/marketplace/${listing.id}` : '/admin/marketplace';
  const successUrl = isEdit ? `/admin/marketplace/${listing.id}` : null;
  const listingId = isEdit ? listing.id : '';
  const photoCount = isEdit ? (() => { try { return JSON.parse(listing.photos || '[]').length; } catch { return 0; } })() : 0;

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
    <label class="admin-field-label">Compare-at price <span class="font-normal text-slate-500">(optional — shown struck through with the savings, e.g. the retail price this group buy undercuts. Leave blank or 0 if there's nothing to compare against.)</span></label>
    <input type="number" name="compare_at_price" class="admin-input mt-1" min="0" step="1" value="${isEdit && listing.compare_at_price > 0 ? escHtml(String(listing.compare_at_price)) : ''}">
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
<style>
.mkt-photo-assign { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.mkt-photo-assign-row { display: flex; align-items: center; gap: 8px; }
.mkt-photo-assign-label { font-size: 11px; color: var(--admin-muted,#7c8aa5); width: 90px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mkt-photo-assign-thumbs { display: flex; gap: 6px; flex-wrap: wrap; }
.mkt-photo-pick { padding: 0; width: 36px; height: 36px; border-radius: 6px; overflow: hidden; border: 2px solid transparent; cursor: pointer; background: none; opacity: .55; transition: opacity .12s, border-color .12s; }
.mkt-photo-pick img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mkt-photo-pick:hover { opacity: .85; }
.mkt-photo-pick.is-selected { border-color: var(--brand, #f59332); opacity: 1; }
</style>

<script>
(function() {
  var sizes = ${JSON.stringify(jerseySizes)};
  var initialGroups = ${JSON.stringify(initialGroups)};
  var listingId = ${JSON.stringify(listingId)};
  var photoCount = ${JSON.stringify(photoCount)};
  var groupsWrap = document.getElementById('mkt-variant-groups');

  // Rebuilds the per-option photo-assignment strip from whatever's currently in the
  // options textarea, preserving any assignments already made for options that are still
  // present (keyed by the option's own text, same as the server-side normalization).
  // Rebuilds the per-option surcharge inputs from whatever's currently in the options
  // textarea, preserving amounts already set for options that are still present — same
  // keyed-by-value approach as renderPhotoAssign, just a number input instead of a thumbnail.
  function renderSurchargeAssign(row) {
    var wrap = row.querySelector('.mkt-variant-surcharge-assign');
    var checked = row.querySelector('.mkt-variant-per-option-surcharge').checked;
    wrap.hidden = !checked;
    if (!checked) return;
    var options = row.querySelector('.mkt-variant-options-text').value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
    var existing = row._optionSurcharges || {};
    wrap.innerHTML = options.map(function(opt) {
      var esc = opt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g, '&quot;');
      var val = existing[opt] || '';
      return '<div class="mkt-photo-assign-row">' +
        '<span class="mkt-photo-assign-label">' + esc + '</span>' +
        '<input type="number" class="admin-input mkt-option-surcharge-input" data-opt="' + esc + '" min="0" step="1" placeholder="0" style="width:80px" value="' + val + '">' +
      '</div>';
    }).join('');
  }

  function renderPhotoAssign(row) {
    var wrap = row.querySelector('.mkt-variant-photo-assign');
    var checked = row.querySelector('.mkt-variant-photobacked').checked;
    wrap.hidden = !checked;
    if (!checked) return;
    var options = row.querySelector('.mkt-variant-options-text').value.split('\\n').map(function(s){ return s.trim(); }).filter(Boolean);
    var existing = row._optionPhotos || {};
    if (!photoCount) {
      wrap.innerHTML = '<p style="font-size:11px;color:var(--admin-muted,#7c8aa5)">Upload photos first (below), then come back here to assign them.</p>';
      return;
    }
    wrap.innerHTML = options.map(function(opt) {
      var thumbs = '';
      for (var i = 0; i < photoCount; i++) {
        var sel = existing[opt] === i ? ' is-selected' : '';
        thumbs += '<button type="button" class="mkt-photo-pick' + sel + '" data-opt="' + opt.replace(/"/g, '&quot;') + '" data-photo-index="' + i + '">' +
          '<img src="/api/marketplace/' + listingId + '/photo/' + i + '" alt="">' +
        '</button>';
      }
      return '<div class="mkt-photo-assign-row"><span class="mkt-photo-assign-label">' + opt.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span><div class="mkt-photo-assign-thumbs">' + thumbs + '</div></div>';
    }).join('');
  }

  function addGroup(label, optionsText, sizeChartKind, surchargeStep, photoBacked, optionPhotos, multiSelect, optionSurcharges) {
    var row = document.createElement('div');
    row.className = 'mkt-variant-group-row';
    row._optionPhotos = optionPhotos || {};
    row._optionSurcharges = optionSurcharges || {};
    var perOptionSurcharge = !!(optionSurcharges && Object.keys(optionSurcharges).length);
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
      '</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--admin-muted,#7c8aa5)">' +
        '<input type="checkbox" class="mkt-variant-photobacked"' + (photoBacked ? ' checked' : '') + '> Show as a photo picker (each option is one of the uploaded photos)' +
      '</label>' +
      '<div class="mkt-variant-photo-extra"' + (photoBacked ? '' : ' hidden') + '>' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--admin-muted,#7c8aa5);margin-bottom:8px">' +
          '<input type="checkbox" class="mkt-variant-multiselect"' + (multiSelect ? ' checked' : '') + '> Let buyers pick multiple (up to 3) — price multiplies by however many they pick' +
        '</label>' +
        '<div class="mkt-variant-photo-assign"></div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--admin-muted,#7c8aa5)">' +
        '<input type="checkbox" class="mkt-variant-per-option-surcharge"' + (perOptionSurcharge ? ' checked' : '') + '> Per-option surcharge (e.g. Regular +0, NBA Cut +50)' +
      '</label>' +
      '<div class="mkt-variant-surcharge-assign"' + (perOptionSurcharge ? '' : ' hidden') + '></div>';
    row.querySelector('.mkt-variant-remove').addEventListener('click', function() { row.remove(); });
    row.querySelector('.mkt-variant-photobacked').addEventListener('change', function() {
      row.querySelector('.mkt-variant-photo-extra').hidden = !row.querySelector('.mkt-variant-photobacked').checked;
      renderPhotoAssign(row);
    });
    row.querySelector('.mkt-variant-per-option-surcharge').addEventListener('change', function() { renderSurchargeAssign(row); });
    row.querySelector('.mkt-variant-options-text').addEventListener('input', function() { renderPhotoAssign(row); renderSurchargeAssign(row); });
    row.querySelector('.mkt-variant-photo-assign').addEventListener('click', function(e) {
      var btn = e.target.closest('.mkt-photo-pick');
      if (!btn) return;
      row._optionPhotos[btn.dataset.opt] = Number(btn.dataset.photoIndex);
      renderPhotoAssign(row);
    });
    row.querySelector('.mkt-variant-surcharge-assign').addEventListener('input', function(e) {
      var input = e.target.closest('.mkt-option-surcharge-input');
      if (!input) return;
      row._optionSurcharges[input.dataset.opt] = Number(input.value) || 0;
    });
    groupsWrap.appendChild(row);
    if (photoBacked) renderPhotoAssign(row);
    if (perOptionSurcharge) renderSurchargeAssign(row);
  }

  initialGroups.forEach(function(g) { addGroup(g.label, (g.options || []).join('\\n'), g.sizeChartKind || '', g.surchargeStep || 0, g.photoBacked || false, g.optionPhotos || {}, g.multiSelect || false, g.optionSurcharges || {}); });

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
      var photoBacked = row.querySelector('.mkt-variant-photobacked').checked;
      var multiSelect = row.querySelector('.mkt-variant-multiselect').checked;
      if (label && options.length) variantGroups.push({ label: label, options: options, sizeChartKind: sizeChartKind, surchargeStep: surchargeStep, photoBacked: photoBacked, optionPhotos: row._optionPhotos || {}, multiSelect: multiSelect, optionSurcharges: row._optionSurcharges || {} });
    });
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      var r = await fetch(${JSON.stringify(submitUrl)}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.value.trim(), description: f.description.value.trim(),
          price: f.price.value, min_buyers: f.min_buyers.value, compare_at_price: f.compare_at_price.value, variant_options: variantGroups,
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
  const hasSurcharge = variantGroups.some(g => g.surchargeStep > 0 || (g.optionSurcharges && Object.keys(g.optionSurcharges).length));
  const hasMultiSelect = variantGroups.some(g => g.multiSelect);
  const showAmount = hasSurcharge || hasMultiSelect;
  const hasJersey = variantGroups.some(g => g.sizeChartKind === 'top');
  const photoGroup = variantGroups.find(g => g.photoBacked);

  // Which exact photo(s) a commitment's photo-backed pick refers to — plural for a
  // multi-select group (pick up to 3), so admin can see exactly which items were tagged to
  // this buyer, not just an option label or a bare count.
  function commitmentPhotoIndexes(c) {
    if (!photoGroup) return [];
    let selections = {};
    try { selections = JSON.parse(c.variant || '{}'); } catch { selections = {}; }
    const picked = selections[photoGroup.label];
    const values = Array.isArray(picked) ? picked : [picked];
    return values.map(v => photoGroup.optionPhotos?.[v]).filter(idx => Number.isInteger(idx));
  }

  const rows = commitments.map(c => {
    const photoIdxs = commitmentPhotoIndexes(c);
    const qty = Number(c.quantity) || 1;
    return `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
    ${photoGroup ? `<td class="px-4 py-2.5"><div style="display:flex;gap:4px">${photoIdxs.length ? photoIdxs.map(idx => `<img src="/api/marketplace/${escHtml(listing.id)}/photo/${idx}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;display:block">`).join('') : '—'}</div></td>` : ''}
    <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.variantLabel || '—')}${qty > 1 ? ` <span class="text-slate-400 font-semibold">×${qty}</span>` : ''}</td>
    ${hasJersey ? `<td class="px-4 py-2.5 text-xs text-slate-300"${c.notes ? ` title="${escHtml(c.notes)}"` : ''}>${c.custom_name ? `${escHtml(c.custom_name)} #${escHtml(c.custom_number)}` : '—'}${c.notes ? ' <span class="text-slate-500">📝</span>' : ''}</td>` : ''}
    ${showAmount ? `<td class="px-4 py-2.5 text-xs text-slate-300 font-semibold">${fmtPeso(c.amount)}${c.surcharge ? `<span class="text-slate-500 font-normal"> (+${fmtPeso(c.surcharge)} ea.)</span>` : ''}</td>` : ''}
    <td class="px-4 py-2.5 text-xs text-slate-500">${new Date(c.committed_at).toLocaleDateString()}</td>
  </tr>`;
  }).join('');

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
<p class="text-sm text-slate-400 mb-5">${fmtPeso(listing.price)}${compareAmountHtml(listing)} per buyer &middot; min ${listing.min_buyers} buyers</p>

${photoManager(listing.id, parseJsonArray(listing.photos))}

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player</th>
        ${photoGroup ? `<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Photo</th>` : ''}
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Variant</th>
        ${hasJersey ? `<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Name / Number</th>` : ''}
        ${showAmount ? `<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Amount</th>` : ''}
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Committed</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${2 + (photoGroup ? 1 : 0) + (hasJersey ? 1 : 0) + (showAmount ? 1 : 0) + 1}" class="px-4 py-8 text-center text-sm text-slate-500">No commitments yet.</td></tr>`}
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
