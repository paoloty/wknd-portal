import { escHtml } from './layout.js';
import { SIZES, SIZE_CHART, computeJerseyTotal } from '../lib/season-pricing.js';

function sizeCell(kind, size, name, currentValue) {
  const [meas1, meas2] = SIZE_CHART[kind][size];
  return `<label class="pick-cell">
    <input type="radio" name="${name}" value="${size}" ${currentValue === size ? 'checked' : ''}>
    <span class="pick-cell__meas">${meas1}&Prime; / ${meas2}&Prime;</span>
    <span class="pick-cell__size">${size}</span>
  </label>`;
}

// Horizontally-scrolling row with edge fades that appear/disappear as you scroll — same
// wrapper for every size picker on the page (currently top + shorts).
function pickScroll(cellsHtml, id) {
  return `<div class="pick-scroll">
    <div class="pick-grid" id="${id}">${cellsHtml}</div>
    <div class="pick-fade pick-fade--l"></div>
    <div class="pick-fade pick-fade--r"></div>
  </div>`;
}

export function jerseyRequestPage({ token = '', error = '', invalid = false, submitted = false, name = '', teamName = '', prefill = {}, jerseyPricing = {} } = {}) {
  if (invalid) {
    return `<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">This link is invalid or has expired. Contact your league admin for a new one.</p>
  </div>
</div>`;
  }

  if (submitted) {
    return `<div class="login-page">
  <div class="login-box">
    <div class="login-brand">
      <div class="login-brand__badge" style="background:#22c55e">✓</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">Thanks — your jersey details are in.</p>
    <p style="font-size:14px;color:var(--text-muted);margin:0;line-height:1.6">
      Your team head or league admin will reach out if anything needs to change before jerseys are ordered.
    </p>
  </div>
</div>`;
  }

  const topCells    = SIZES.map(s => sizeCell('top', s, 'jersey_top', prefill.jersey_top)).join('');
  const shortsCells = `<label class="pick-cell">
      <input type="radio" name="jersey_shorts" value="" ${!prefill.jersey_shorts ? 'checked' : ''}>
      <span class="pick-cell__size">None</span>
    </label>` + SIZES.map(s => sizeCell('shorts', s, 'jersey_shorts', prefill.jersey_shorts)).join('');

  const { topPrice = 0, shortPrice = 0, surchargeStep = 0, pocketsPrice = 0 } = jerseyPricing;
  const initialTotal = computeJerseyTotal({
    topPrice, shortPrice, surchargeStep, pocketsPrice,
    jerseyTop: prefill.jersey_top || '', jerseyShorts: prefill.jersey_shorts || '', pockets: !!prefill.pockets,
  });

  return `<div class="login-page">
  <div class="login-box" style="max-width:480px">
    <div class="login-brand">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">${name ? `Hey ${escHtml(name)} — ` : ''}${teamName ? `you're on <strong>${escHtml(teamName)}</strong> next season. ` : ''}Fill in your jersey details below.</p>
    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}
    <form class="login-form jr-form" method="POST" action="/jersey-request">
      <input type="hidden" name="token" value="${escHtml(token)}">

      <div class="login-field">
        <label for="jr-name">Name on Jersey <span class="req">*</span></label>
        <input id="jr-name" name="jersey_name" type="text" maxlength="20" placeholder="e.g. TY" value="${escHtml(prefill.jersey_name || '')}" required>
      </div>

      <div class="login-field">
        <label for="jr-number">Jersey Number <span class="req">*</span></label>
        <input id="jr-number" name="jersey_number" type="text" inputmode="numeric" maxlength="2" placeholder="0-99" value="${escHtml(prefill.jersey_number || '')}" required>
      </div>

      <div class="jr-field">
        <label>Jersey Top Size <span class="req">*</span></label>
        ${pickScroll(topCells, 'pick-top')}
      </div>

      <div class="jr-field">
        <label>Shorts Size</label>
        ${pickScroll(shortsCells, 'pick-shorts')}
      </div>

      <label class="jr-pockets" style="margin:4px 0 12px">
        <input type="checkbox" name="pockets" value="1" ${prefill.pockets ? 'checked' : ''}> Add pockets to shorts
      </label>

      <div class="jr-field jr-shorts-notes" id="jr-shorts-notes-field" style="${prefill.jersey_shorts ? '' : 'display:none'}">
        <label for="jr-shorts-notes">Shorts Notes <span style="color:var(--text-muted);font-weight:500">(optional)</span></label>
        <textarea id="jr-shorts-notes" name="jersey_shorts_notes" rows="2" maxlength="200" placeholder="e.g. run long, prefer one size down">${escHtml(prefill.jersey_shorts_notes || '')}</textarea>
      </div>

      <div class="jr-total">
        <div>
          <div class="jr-total__label">Estimated Jersey Cost</div>
          <div class="jr-total__note">Billed separately — not part of your season quota.</div>
        </div>
        <div class="jr-total__amount" id="jr-total-amount">₱${initialTotal.toLocaleString()}</div>
      </div>

      <button class="login-submit" type="submit">SUBMIT JERSEY DETAILS</button>
    </form>
  </div>
</div>

<style>
.jr-field { margin-bottom: 18px; }
.jr-field > label { display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.req { color: #f87171; }
.jr-pockets { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); cursor: pointer; }
.pick-scroll { position: relative; margin-top: 10px; }
.pick-grid {
  display: flex; gap: 10px; padding-bottom: 8px;
  overflow-x: auto; touch-action: pan-x; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity;
}
.pick-grid::-webkit-scrollbar { height: 6px; }
.pick-grid::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
.pick-fade {
  position: absolute; top: 0; bottom: 8px; width: 32px; pointer-events: none;
  opacity: 0; transition: opacity .15s;
}
.pick-fade--l { left: 0; background: linear-gradient(to right, var(--bg) 0%, transparent 100%); }
.pick-fade--r { right: 0; background: linear-gradient(to left, var(--bg) 0%, transparent 100%); }
.pick-fade.is-visible { opacity: 1; }
.pick-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  flex: 0 0 auto; scroll-snap-align: start;
  min-width: 76px; padding: 16px 10px; border: 1px solid var(--border); border-radius: 12px;
  cursor: pointer; transition: border-color .15s, background .15s;
}
.pick-cell input { display: none; }
.pick-cell:hover { border-color: var(--amber); }
.pick-cell:has(input:checked) { border-color: var(--amber); background: rgba(245,147,50,.12); }
.pick-cell__meas { display: block; height: 13px; line-height: 13px; font-size: 10.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pick-cell__size { font-family: 'Saira Condensed'; font-weight: 700; font-size: 20px; color: var(--text); line-height: 1; }
.pick-cell:has(input:checked) .pick-cell__size { color: var(--amber); }
.jr-shorts-notes textarea {
  width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px 12px; font: inherit; font-size: 13px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); resize: vertical;
}
.jr-shorts-notes textarea:focus { outline: none; border-color: var(--amber); }
.jr-total {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 4px 0 20px; padding: 14px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
}
.jr-total__label { font-size: 12.5px; font-weight: 700; color: var(--text); }
.jr-total__note { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }
.jr-total__amount { font-weight: 700; font-size: 20px; color: var(--amber); white-space: nowrap; }
</style>

<script>
// Live total — mirrors computeJerseyTotal()/sizeSurcharge() in lib/season-pricing.js exactly,
// so what the player sees here never drifts from what actually gets charged later.
(function() {
  var PRICING = ${JSON.stringify({ topPrice, shortPrice, surchargeStep, pocketsPrice })};
  var SURCHARGE_TIERS = ['2XL', '3XL', '4XL', '5XL'];
  function surcharge(size) {
    var i = SURCHARGE_TIERS.indexOf(size);
    return i === -1 ? 0 : (i + 1) * PRICING.surchargeStep;
  }
  function recompute() {
    var top     = document.querySelector('input[name="jersey_top"]:checked');
    var shorts  = document.querySelector('input[name="jersey_shorts"]:checked');
    var pockets = document.querySelector('input[name="pockets"]');
    var total = 0;
    if (top && top.value) total += PRICING.topPrice + surcharge(top.value);
    if (shorts && shorts.value) {
      total += PRICING.shortPrice + surcharge(shorts.value);
      if (pockets && pockets.checked) total += PRICING.pocketsPrice;
    }
    var el = document.getElementById('jr-total-amount');
    if (el) el.textContent = '₱' + total.toLocaleString();
  }
  document.querySelectorAll('input[name="jersey_top"], input[name="jersey_shorts"], input[name="pockets"]').forEach(function(input) {
    input.addEventListener('change', recompute);
  });
})();

// Edge fades: right fade shows whenever there's more to scroll to, left fade shows once
// you've scrolled away from the start — so it always reads as "more this way", never both
// sides on a row that fits entirely on screen.
document.querySelectorAll('.pick-scroll').forEach(function(wrap) {
  var grid  = wrap.querySelector('.pick-grid');
  var left  = wrap.querySelector('.pick-fade--l');
  var right = wrap.querySelector('.pick-fade--r');
  if (!grid) return;
  function update() {
    var max = grid.scrollWidth - grid.clientWidth;
    left.classList.toggle('is-visible', grid.scrollLeft > 4);
    right.classList.toggle('is-visible', grid.scrollLeft < max - 4);
  }
  grid.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});

document.querySelectorAll('input[name="jersey_shorts"]').forEach(function(input) {
  input.addEventListener('change', function() {
    var field = document.getElementById('jr-shorts-notes-field');
    if (field) field.style.display = this.value ? '' : 'none';
  });
});

document.querySelector('.jr-form')?.addEventListener('submit', function(e) {
  var num = document.getElementById('jr-number').value.trim();
  if (num && !/^\\d{1,2}$/.test(num)) {
    e.preventDefault();
    alert('Jersey number must be 0-99.');
  }
});
</script>`;
}
