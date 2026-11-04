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
  const row = (r, i) => r.type === 'html' ? r.html : `<div class="aset-row"${r.id ? ` id="${escHtml(r.id)}"` : ''}${r.hidden ? ' hidden' : ''}>
      <div class="aset-row__text">
        <div class="aui-cell__title">${escHtml(r.label)}</div>
        ${r.sub ? `<div class="aui-cell__sub">${r.sub}</div>` : ''}
      </div>
      <div class="aset-row__control">${control(r)}<span class="aset-row__msg" data-setting-msg></span></div>
    </div>`;
  return `<section class="aui-section aset"${id ? ` id="${escHtml(id)}"` : ''}>
  <div class="aui-section__head"><h2 class="aui-section__title">${escHtml(title)}${note ? ` <span class="aui-section__note">${note}</span>` : ''}</h2></div>
  <div class="aui-panel aui-panel--flush aset__rows">${rows.map(row).join('')}</div>
</section>`;
}

// Saves the switches: public/admin-settings.js. Safe to add more than once, the browser loads
// it once and the tab code (admin-ui.js) won't add it again.
export function settingsScript() { return '<script src="/admin-settings.js" defer></script>'; }

// A page's Settings tab.
export function settingsView(panels) {
  return `<div class="aui-page">${panels}</div>${settingsScript()}`;
}
