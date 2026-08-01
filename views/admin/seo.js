import { escHtml } from '../layout.js';

const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h10M5 4V2.5A1 1 0 0 1 6 1.5h2a1 1 0 0 1 1 1V4m1.5 0-.6 8a1 1 0 0 1-1 .9H4.1a1 1 0 0 1-1-.9L2.5 4"/></svg>`;
const ICON_CAMERA = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

export function adminSeoListBody({ overrides = [] } = {}) {
  const rows = overrides.map(o => `
    <tr class="admin-table-row">
      <td class="admin-td"><a href="/admin/seo/edit?slug=${encodeURIComponent(o.slug)}" style="color:var(--text-primary);text-decoration:none;font-weight:600;font-family:monospace">${escHtml(o.slug)}</a></td>
      <td class="admin-td">${escHtml(o.title || '—')}</td>
      <td class="admin-td">${o.image_url ? '✓' : '—'}</td>
      <td class="admin-td" style="text-align:right">
        <a href="/admin/seo/edit?slug=${encodeURIComponent(o.slug)}" class="admin-btn admin-btn--sm">Edit</a>
        <button class="admin-btn admin-btn--sm admin-btn--danger aso-del" data-slug="${escHtml(o.slug)}">${ICON_TRASH}</button>
      </td>
    </tr>`).join('');

  return `
<div class="agm-edit-bar">
  <a href="/admin/visibility" class="admin-btn">Visibility</a>
  <a href="/admin/seo/new" class="agm-new-btn">+ New Override</a>
</div>

<p style="color:var(--text-muted);font-size:13px;margin:0 0 16px">Manual per-page overrides for the title, description, and share image search engines and social platforms (Facebook, Messenger, X) show for a given URL. Enter the exact page path — e.g. <code>/</code>, <code>/standings</code>, <code>/games/&lt;id&gt;</code>. Pages without an override keep their normal defaults.</p>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr>
        <th class="admin-th">Slug</th>
        <th class="admin-th">Title override</th>
        <th class="admin-th">Cover image</th>
        <th class="admin-th" style="text-align:right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td class="admin-td" colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No overrides yet.</td></tr>`}
    </tbody>
  </table>
</div>

<script>
(function(){
  document.querySelectorAll('.aso-del').forEach(function(btn){
    btn.addEventListener('click', async function(){
      if (!confirm('Delete this SEO override?')) return;
      var r = await fetch('/admin/seo/delete', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ slug: btn.dataset.slug })
      });
      if (r.ok) location.reload();
    });
  });
})();
</script>`;
}

export function adminSeoEditorBody({ override } = {}) {
  const isNew = !override;
  const slug = override?.slug || '';
  const title = override?.title || '';
  const description = override?.description || '';
  const imageUrl = override?.image_url || '';

  return `
<div class="agm-edit-bar">
  <a href="/admin/seo" class="agm-edit-bar__back">← All Overrides</a>
  <div class="agm-edit-bar__right">
    <span id="save-msg" class="agm-save-msg"></span>
    <button id="aso-save" class="agm-edit-bar__save">${isNew ? 'Create Override' : 'Save Changes'}</button>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_300px] items-start">

  <div class="flex flex-col gap-4 min-w-0">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Page slug</div>
      <div class="p-4">
        <input id="aso-slug" type="text" class="admin-input" style="font-family:monospace" value="${escHtml(slug)}" placeholder="/games/some-game-id" ${isNew ? '' : 'readonly'}>
        <p style="color:var(--text-muted);font-size:12px;margin:6px 0 0">${isNew ? 'The exact page path this override applies to, e.g. / or /standings.' : 'Slug can’t be changed after creation — delete and re-create instead.'}</p>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Title override</div>
      <div class="p-4">
        <input id="aso-title" type="text" class="admin-input" value="${escHtml(title)}" placeholder="Leave blank to keep the page's default title">
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Description override</div>
      <div class="p-4">
        <textarea id="aso-description" class="admin-input agm-textarea" rows="3" placeholder="Leave blank to keep the page's default description">${escHtml(description)}</textarea>
      </div>
    </div>

  </div>

  <div class="flex flex-col gap-4">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Cover image</div>
      <div class="p-4">
        <div id="aso-cover-preview" style="position:relative;aspect-ratio:1200/630;border-radius:8px;overflow:hidden;background:var(--admin-surface2,#131d2e);border:1px solid var(--admin-border,#1e293b);display:flex;align-items:center;justify-content:center">
          ${imageUrl
            ? `<img src="${escHtml(imageUrl)}" style="width:100%;height:100%;object-fit:cover" id="aso-cover-img">
               <label class="agm-cover-btn" for="aso-cover-file" style="position:absolute;bottom:8px;right:8px" title="Change image">${ICON_CAMERA}</label>`
            : `<label class="agm-cover-canvas" for="aso-cover-file" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--text-muted)">
                 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                 <span class="agm-cover-canvas__label">Upload cover image</span>
               </label>`
          }
        </div>
        <input type="file" id="aso-cover-file" accept="image/jpeg,image/png,image/webp" style="display:none">
        <div id="aso-cover-progress" style="display:none;margin-top:8px">
          <div class="agm-cover-progress">
            <div class="agm-cover-progress-track"><div class="agm-cover-progress-fill" id="aso-cover-bar"></div></div>
            <span class="text-xs text-slate-500 whitespace-nowrap" id="aso-cover-status"></span>
          </div>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin:8px 0 0">Leave empty to keep the site's default share image.</p>
        ${imageUrl ? `<button type="button" id="aso-cover-remove" class="admin-btn admin-btn--sm admin-btn--danger" style="margin-top:8px">Remove image</button>` : ''}
      </div>
    </div>

    ${!isNew ? `
    <div class="pt-1">
      <button id="aso-delete-btn" class="admin-btn admin-btn--danger">${ICON_TRASH} Delete override</button>
    </div>
    ` : ''}

  </div>
</div>

<script>
(function(){
  var slugInput = document.getElementById('aso-slug');
  var isNew = ${JSON.stringify(isNew)};
  var origSlug = ${JSON.stringify(slug)};
  var pendingImageDataUrl = null;
  var imageRemoved = false;

  var coverFile = document.getElementById('aso-cover-file');
  coverFile.addEventListener('change', function(){
    var file = this.files[0];
    if (!file) return;
    var statusText = document.getElementById('aso-cover-status');
    var progressWrap = document.getElementById('aso-cover-progress');
    progressWrap.style.display = 'block';
    statusText.textContent = 'Compressing…';
    var img = new Image();
    var objUrl = URL.createObjectURL(file);
    img.onload = function(){
      URL.revokeObjectURL(objUrl);
      var MAX_W = 1200, MAX_H = 630;
      var w = img.naturalWidth, h = img.naturalHeight;
      var ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingImageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      imageRemoved = false;
      var preview = document.getElementById('aso-cover-preview');
      preview.innerHTML = '<img src="' + pendingImageDataUrl + '" style="width:100%;height:100%;object-fit:cover">';
      progressWrap.style.display = 'none';
      statusText.textContent = '';
    };
    img.onerror = function(){
      progressWrap.style.display = 'none';
      statusText.textContent = 'Could not read image';
    };
    img.src = objUrl;
  });

  var removeBtn = document.getElementById('aso-cover-remove');
  if (removeBtn) removeBtn.addEventListener('click', function(){
    pendingImageDataUrl = null;
    imageRemoved = true;
    var preview = document.getElementById('aso-cover-preview');
    preview.innerHTML = '<label class="agm-cover-canvas" for="aso-cover-file" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--text-muted)">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      '<span class="agm-cover-canvas__label">Upload cover image</span></label>';
    removeBtn.remove();
  });

  async function doSave() {
    var btn = document.getElementById('aso-save');
    var msg = document.getElementById('save-msg');
    var slugVal = slugInput.value.trim();
    if (!slugVal || slugVal.charAt(0) !== '/') {
      msg.textContent = 'Slug must start with /'; msg.style.color = '#ef4444';
      return;
    }
    btn.disabled = true; btn.textContent = 'Saving…';
    var body = {
      slug: slugVal,
      title: document.getElementById('aso-title').value,
      description: document.getElementById('aso-description').value,
    };
    if (pendingImageDataUrl) body.image_url = pendingImageDataUrl;
    else if (imageRemoved) body.image_url = '';
    try {
      var url = isNew ? '/admin/seo' : '/admin/seo/update';
      if (!isNew) body.slug = origSlug;
      var r = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      msg.textContent = 'Saved'; msg.style.color = 'var(--amber)';
      if (isNew) { window.location.href = '/admin/seo/edit?slug=' + encodeURIComponent(slugVal); return; }
    } catch(e) {
      msg.textContent = e.message; msg.style.color = '#ef4444';
    } finally {
      btn.disabled = false; btn.textContent = isNew ? 'Create Override' : 'Save Changes';
    }
  }
  document.getElementById('aso-save').addEventListener('click', doSave);

  var delBtn = document.getElementById('aso-delete-btn');
  if (delBtn) delBtn.addEventListener('click', async function(){
    if (!confirm('Delete this SEO override?')) return;
    var r = await fetch('/admin/seo/delete', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ slug: origSlug })
    });
    if (r.ok) window.location.href = '/admin/seo';
  });
})();
</script>`;
}
