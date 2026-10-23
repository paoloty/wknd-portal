// Settle a balance (/app/settle): what's owed, how to pay with GCash (copy the number, save
// the QR with the amount in it, open GCash), then send the receipt. The form posts to the
// site's own /settle-balance (public/app.js initSettle); an admin confirms it in the ledger.
import { esc, backChev } from './layout.js';

const peso = n => `₱${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// back: { href, label } · runs: [{ day, amount }] unpaid Papawis runs · pending: payments
// waiting for an admin · gcash: { name, number, hasQr, amountInQr } · deposit: a Papawis
// deposit (no balance yet), presets: [{ amount, detail }]
export function appSettlePage({ back, balance = 0, runs = [], pending = [], deposit = false, amount = '', presets = [], category, categories = [], gcash = {} }) {
  const owe = balance > 0;
  const head = deposit
    ? `<div class="card glow st__head"><div class="kick">Papawis deposit</div><b class="num">${amount ? peso(amount) : '—'}</b><p>Held against your next runs, so your spot is confirmed straight away.</p></div>`
    : `<div class="card glow st__head"><div class="kick">${owe ? 'You owe' : 'Your balance'}</div><b class="num${owe ? '' : ' st__ok'}">${owe ? peso(balance) : 'All settled'}</b>
        ${runs.length ? `<div class="st__runs">${runs.map(r => `<div class="pv__line"><span>Papawis · ${esc(r.day)}</span><b>${peso(r.amount)}</b></div>`).join('')}</div>` : ''}</div>`;
  const pend = pending.length ? `<div class="msg msg--info st__pending">⏳ ${pending.map(p => `${peso(p.amount)} sent ${esc(p.when)}`).join(' · ')} · waiting for an admin to confirm. Your balance updates once it's confirmed.</div>` : '';
  if (!owe && !deposit) {
    return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Settle</span><span></span></div>
      <div style="margin-top:6px">${head}</div>${pend}
      <p class="foot-note">Nothing to pay. Papawis charges show up here after a run is closed out.</p>`;
  }
  const pay = `<div class="sec">1 · Pay with GCash</div>
  <div class="card st__gcash">
    ${gcash.hasQr ? `<img class="st__qr" src="/app/settle/qr.png?amount=${encodeURIComponent(amount || '')}" alt="GCash QR code" data-st-qr>
      <p class="st__hint">${gcash.amountInQr && amount ? `The amount (${peso(amount)}) is in the QR.` : ''} Save it, then in GCash: <b>Pay QR → Upload QR</b> and pick it.</p>
      <div class="st__btns"><button type="button" class="btn" data-st-save>Save QR</button><a class="btn btn--ghost" href="gcash://" data-st-gcash>Open GCash</a></div>` : ''}
    ${gcash.number ? `<div class="pv__line st__num"><span>${esc(gcash.name || 'GCash')}</span><b class="num" data-st-number>${esc(gcash.number)}</b><button type="button" class="pill" data-st-copy>Copy number</button></div>` : ''}
    ${!gcash.hasQr && !gcash.number ? '<p class="st__hint">GCash details aren\'t set up yet. Message an admin for where to send it.</p>' : ''}
  </div>`;
  const form = `<div class="sec">2 · Send the receipt</div>
  <form class="card st__form" data-st-form novalidate>
    ${presets.length ? `<div class="st__presets">${presets.map(p => `<button type="button" class="chip${Number(p.amount) === Number(amount) ? ' is-on' : ''}" data-st-preset="${p.amount}"><span>${peso(p.amount)}${p.detail ? ` · ${esc(p.detail)}` : ''}</span></button>`).join('')}</div>` : ''}
    <label class="st__field"><span>Amount paid</span><input name="amount" type="number" inputmode="decimal" min="1" step="0.01" value="${esc(amount)}" required></label>
    <label class="st__field"><span>For</span><select name="category">${categories.map(c => `<option${c === category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="st__field"><span>Paid with</span><select name="payment_method">${['GCash', 'Bank Transfer', 'Cash', 'Other'].map(m => `<option>${m}</option>`).join('')}</select></label>
    <label class="st__field"><span>Reference no. <i>optional</i></span><input name="reference_no" type="text" inputmode="numeric" autocomplete="off" placeholder="From the GCash receipt"></label>
    <label class="st__file"><input type="file" accept="image/*" data-st-file hidden><span class="st__pick" data-st-pick>📎 Add the receipt screenshot</span><img data-st-preview hidden alt=""></label>
    <p class="msg msg--err" data-st-msg hidden></p>
    <button type="submit" class="btn" data-st-send>Send receipt</button>
    <p class="st__hint" style="text-align:center">An admin checks it against GCash, then your balance updates.</p>
  </form>`;
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">${deposit ? 'Deposit' : 'Settle'}</span><span></span></div>
  <div style="margin-top:6px">${head}</div>
  ${pend}
  ${pay}
  ${form}
  <div style="height:12px"></div>`;
}
