import { escHtml } from '../layout.js';

// ── Settings panels: a feature's public switches on that feature's own admin page ────────
// (the 2026-10 admin reorganisation moved them off the old Visibility grab-bag). Same look
// as the Papawis "Notifications" box. Every control saves itself through POST
// /admin/site/settings, which checks each key against the admin's sections
// (server.js siteSettingSection).
//
// rows: [{ type: 'toggle'|'select'|'text'|'time'|'html', key, label, sub, value,
//          options: [[value, label]], placeholder, width, reload, controls, html }]
//   reload: reload the page after saving (for a status line that follows the value)
//   controls: a CSS selector shown only while this toggle is on
export function settingsPanel(rows, { title = 'Settings', note = '', id = '' } = {}) {
  const control = r => {
    const attrs = `data-setting="${escHtml(r.key)}"${r.reload ? ' data-reload' : ''}${r.controls ? ` data-controls="${escHtml(r.controls)}"` : ''}`;
    if (r.type === 'toggle') {
      return `<label class="site-toggle" title="${escHtml(r.label)}"><input type="checkbox" ${attrs}${r.value ? ' checked' : ''}><span class="site-toggle__track"></span></label>`;
    }
    if (r.type === 'select') {
      return `<select class="admin-input" style="width:${r.width || 'auto'}" ${attrs}>${r.options.map(([v, l]) => `<option value="${escHtml(v)}"${String(r.value) === String(v) ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select>`;
    }
    const type = r.type === 'time' ? 'time' : 'text';
    return `<input type="${type}" class="admin-input" style="width:${r.width || '170px'}" value="${escHtml(r.value ?? '')}"${r.placeholder ? ` placeholder="${escHtml(r.placeholder)}"` : ''} ${attrs}>`;
  };
  const row = (r, i) => r.type === 'html' ? r.html : `<div class="flex items-start justify-between gap-4 py-2.5${i ? ' border-t border-admin-border' : ''}"${r.id ? ` id="${escHtml(r.id)}"` : ''}${r.hidden ? ' hidden' : ''}>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold text-slate-200">${escHtml(r.label)}</div>
        ${r.sub ? `<div class="text-xs text-slate-500 mt-0.5">${r.sub}</div>` : ''}
      </div>
      <div class="shrink-0 text-right">${control(r)}<span class="text-xs block mt-1 min-h-[14px]" data-setting-msg></span></div>
    </div>`;
  return `<section class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-5"${id ? ` id="${escHtml(id)}"` : ''}>
  <div class="px-5 py-3 border-b border-admin-border flex items-center justify-between gap-3">
    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(title)}</span>
    ${note ? `<span class="text-[11px] text-slate-500">${note}</span>` : ''}
  </div>
  <div class="px-5 py-2">${rows.map(row).join('')}</div>
</section>`;
}

// One script per page, however many panels it has.
export function settingsScript() {
  return `<script>
(function () {
  if (window.__adminSettings) return;
  window.__adminSettings = true;
  function msgOf(el) { var row = el.closest('div.shrink-0, span.text-right'); return row && row.querySelector('[data-setting-msg]'); }
  function sync(el) {
    if (!el.dataset.controls) return;
    // style.display, not [hidden]: Tailwind's flex/grid classes would win over the attribute.
    document.querySelectorAll(el.dataset.controls).forEach(function (t) { t.style.display = el.checked ? '' : 'none'; });
  }
  document.querySelectorAll('[data-setting]').forEach(function (el) {
    var prev = el.type === 'checkbox' ? el.checked : el.value;
    sync(el);
    el.addEventListener('change', function () {
      var value = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value.trim();
      var msg = msgOf(el);
      if (msg) { msg.style.color = '#64748b'; msg.textContent = 'Saving…'; }
      var body = {}; body[el.dataset.setting] = value;
      fetch('/admin/site/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Error saving.'); }); })
        .then(function () {
          prev = el.type === 'checkbox' ? el.checked : el.value;
          sync(el);
          if (el.hasAttribute('data-reload')) { location.reload(); return; }
          if (msg) { msg.style.color = '#22c55e'; msg.textContent = 'Saved.'; setTimeout(function () { msg.textContent = ''; }, 2000); }
        })
        .catch(function (e) {
          if (el.type === 'checkbox') el.checked = prev; else el.value = prev;
          sync(el);
          if (msg) { msg.style.color = '#f87171'; msg.textContent = e.message; }
        });
    });
  });
})();
</script>`;
}

// Put a settings panel right under a page's header block (the first "mb-5 flex" header the
// admin views open with); a page without one gets it at the top.
export function withSettings(body, panel) {
  if (!panel) return body;
  const h = body.indexOf('<h2');
  const end = h === -1 ? -1 : body.indexOf('\n</div>', h);
  if (end === -1) return panel + body + settingsScript();
  const at = end + '\n</div>'.length;
  return body.slice(0, at) + '\n' + panel + body.slice(at) + settingsScript();
}
