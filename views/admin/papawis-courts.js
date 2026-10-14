// /admin/papawis/courts (admin redesign, 2026-10-15; rebuilt on views/admin/ui.js).
// Courts back the court picker on New run and Settings (in this order: drag to reorder) and
// pre-fill the price calculator's court rate when a run's location matches a court by name.
// Inactive courts drop out of both but stay listed here, since past runs may name them.
import { escHtml } from '../layout.js';
import { pageHeader, banner, badge, button, drawer, field, fieldGrid, menu, emptyState } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const peso = n => `₱${Number(n || 0).toLocaleString()}`;

function photoBlock(c) {
  const src = c.image_url ? `/api/papawis-court/${encodeURIComponent(c.id)}/photo?t=${Date.now()}` : '';
  return `<div class="pw-cover" data-cover data-upload="/admin/papawis/courts/${attr(c.id)}/photo" data-img="/api/papawis-court/${attr(encodeURIComponent(c.id))}/photo">
    <span class="aui-field__label">Photo</span>
    <div class="pw-cover__frame pw-cover__frame--court"${src ? '' : ' hidden'} data-cover-frame><img alt="" data-cover-img src="${attr(src)}"></div>
    <div class="aui-row">
      <label class="aui-btn aui-btn--secondary aui-btn--sm" for="court-photo-${attr(c.id)}">${src ? 'Replace photo' : 'Upload photo'}</label>
      <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-cover-remove${src ? '' : ' hidden'}>Remove</button>
      <span class="aui-muted" data-cover-msg></span>
    </div>
    <input type="file" id="court-photo-${attr(c.id)}" accept="image/*" hidden data-cover-input>
    <p class="aui-field__help" style="margin:0">Shown behind the title on Papawis cards. Cropped to 2:1.</p>
  </div>`;
}

function courtFields(c = {}) {
  return fieldGrid(`
    ${field({ label: 'Name', name: 'name', value: c.name || '', required: true, wide: true, placeholder: 'e.g. Cloverleaf Basketball Court, Makati' })}
    ${field({ label: 'Rate per hour', name: 'price', type: 'money', value: c.price_per_hour || '' })}
    ${field({ label: 'Address (optional)', name: 'address', value: c.address || '', wide: true, help: 'Used to find the map. Leave blank if the name alone pins the venue.' })}`);
}

export function adminPapawisCourtsBody({ courts = [] } = {}) {
  const rows = courts.map(c => `<tr class="aui-grid__row" draggable="true" data-id="${attr(c.id)}">
      <td class="pw-roster__n"><span class="pw-handle" aria-hidden="true" title="Drag to reorder">⠿</span></td>
      <td class="is-primary" data-label="Court"><span class="aui-who">${c.image_url
        ? `<img class="pw-court-thumb" src="/api/papawis-court/${attr(encodeURIComponent(c.id))}/photo" alt="" loading="lazy">`
        : '<span class="pw-court-thumb pw-court-thumb--empty" aria-hidden="true">—</span>'}
        <span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(c.name)}</span>${c.address ? `<span class="aui-cell__sub">${escHtml(c.address)}</span>` : ''}</span></span></td>
      <td class="is-num" data-label="Rate">${c.price_per_hour > 0 ? `${peso(c.price_per_hour)}<span class="aui-muted">/hr</span>` : '<span class="aui-muted">Not set</span>'}</td>
      <td class="is-bare" data-label="Status">${c.active ? badge('Active', 'green') : badge('Inactive', 'gray')}</td>
      <td class="pw-roster__actions">${button('Edit', { kind: 'secondary', size: 'sm', attrs: `data-drawer-open="court-${attr(c.id)}"` })}</td>
      <td class="aui-grid__menu">${menu([
        c.active
          ? { label: 'Deactivate…', danger: true, post: `/admin/papawis/courts/${c.id}/toggle`, body: { active: false }, done: `${c.name} deactivated.`, confirm: { title: `Deactivate ${c.name}?`, body: 'It leaves the court picker and the price calculator. Past runs keep their location.', send: 'Deactivate' } }
          : { label: 'Activate', post: `/admin/papawis/courts/${c.id}/toggle`, body: { active: true }, done: `${c.name} is active again.` },
      ])}</td>
    </tr>`).join('');

  const table = courts.length ? `<div class="aui-grid__card"><div class="aui-grid__scroll"><table class="aui-grid__table">
      <thead><tr><th class="pw-roster__n"></th><th>Court</th><th class="is-num">Rate</th><th>Status</th><th></th><th class="aui-grid__menu"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody data-court-list>${rows}</tbody>
    </table></div><div class="aui-grid__pager"><span>Drag ⠿ to reorder: the court picker lists them in this order.</span><span>${courts.length} courts</span></div></div>`
    : emptyState({ title: 'No courts yet', sub: 'Add one with “+ Add court”.' });

  const editors = courts.map(c => drawer({
    id: `court-${c.id}`, eyebrow: 'Court', title: c.name,
    bodyHtml: `<form id="court-form-${attr(c.id)}" data-json-action="/admin/papawis/courts/${attr(c.id)}" data-done="Court saved.">${courtFields(c)}</form>${photoBlock(c)}`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Save court', { kind: 'primary', type: 'submit', attrs: `form="court-form-${attr(c.id)}"` })}`,
  })).join('');
  const add = drawer({
    id: 'court-new', eyebrow: 'Courts', title: 'Add court',
    bodyHtml: `<form id="court-form-new" data-json-action="/admin/papawis/courts" data-done="Court added. Open it to upload a photo.">${courtFields()}</form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Add court', { kind: 'primary', type: 'submit', attrs: 'form="court-form-new"' })}`,
  });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Courts', sub: 'Where runs are played. The rate per hour pre-fills each run’s price calculator.', actionsHtml: button('+ Add court', { kind: 'primary', attrs: 'data-drawer-open="court-new"' }) })}
    ${banner('info', 'A run’s location matches a court by its exact name. Inactive courts stay here for old runs but leave the picker.')}
    ${table}
    ${editors}${add}
  </div>
  <script src="/admin-papawis.js" defer></script>`;
}
