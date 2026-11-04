// /admin/finance/gcash: Money → GCash (rewrite, 2026-11). What players see on Settle Balance.
import { pageHeader, section, field, fieldGrid, button } from './ui.js';

export function adminFinanceGcashBody({ gcash = {} } = {}) {
  const preview = gcash.qr_payload
    ? section({ title: 'QR preview', bodyHtml: `<div class="aui-panel"><img class="amny-qr" src="/api/gcash-qr.png?v=${Date.now()}" alt="Your GCash QR, as players see it" width="160" height="160"></div>` })
    : '';
  return `<div class="aui-page amny">
    ${pageHeader({ title: 'GCash', sub: 'Shown to players on the Settle Balance page, so they can pay you directly.' })}
    ${section({
      title: 'Your account',
      bodyHtml: `<form class="aui-panel amny-gcash" data-json-action="/admin/site/settings" data-done="GCash details saved.">
        ${fieldGrid(`
          ${field({ label: 'Account name', name: 'gcash_name', value: gcash.name || '', placeholder: 'e.g. Paolo T.' })}
          ${field({ label: 'Mobile number', name: 'gcash_number', value: gcash.number || '', placeholder: '09XX XXX XXXX' })}
          ${field({ label: 'QR code content', name: 'gcash_qr_payload', type: 'textarea', value: gcash.qr_payload || '', placeholder: 'Paste your GCash QR payload here', help: 'The exact code from your GCash QR.', wide: true })}
        `)}
        <div class="amny-gcash__save">${button('Save', { kind: 'primary', type: 'submit' })}</div>
      </form>`,
    })}
    ${preview}
  </div>`;
}
