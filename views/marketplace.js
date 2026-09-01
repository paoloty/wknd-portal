import { escHtml } from './layout.js';

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function parseJsonArray(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Cell renderer for a variant/size picker — visually modeled on the jersey-request size
// grid (views/jersey-request.js), but label-only: no measurement subtitle, since that's
// jersey-chest/hip-specific and meaningless for a generic merch item.
function variantPicker(options, name, selected = '') {
  if (!options.length) return '';
  const cells = options.map(opt => `
    <label class="mkt-pick-cell${selected === opt ? ' is-selected' : ''}">
      <input type="radio" name="${escHtml(name)}" value="${escHtml(opt)}" ${selected === opt ? 'checked' : ''}>
      <span class="mkt-pick-cell__label">${escHtml(opt)}</span>
    </label>`).join('');
  return `<div class="mkt-pick-scroll">${cells}</div>`;
}

function listingCard(listing, { committedCount = 0, committed = false } = {}) {
  const photos = parseJsonArray(listing.photos);
  const cover = photos[0] || '';
  const meetsFloor = committedCount >= listing.min_buyers;
  return `
  <a href="/marketplace/${escHtml(listing.id)}" class="mkt-card">
    <div class="mkt-card__photo" style="${cover ? `background-image:url('/api/marketplace/${escHtml(listing.id)}/photo/0')` : ''}">
      ${cover ? '' : '<span class="mkt-card__photo-placeholder">No photo</span>'}
    </div>
    <div class="mkt-card__body">
      <div class="mkt-card__title">${escHtml(listing.title)}</div>
      <div class="mkt-card__price">${fmtPeso(listing.price)}</div>
      <div class="mkt-card__progress">
        <span class="mkt-card__count${meetsFloor ? ' is-met' : ''}">${committedCount} committed</span>
        <span class="mkt-card__min">min ${listing.min_buyers}</span>
      </div>
      ${committed ? '<span class="mkt-card__badge">You’re in</span>' : ''}
    </div>
  </a>`;
}

export function marketplacePage({ listings = [], countsById = {}, committedById = {}, isLoggedIn = false } = {}) {
  const cards = listings.map(l => listingCard(l, { committedCount: countsById[l.id] || 0, committed: !!committedById[l.id] })).join('');
  return `<div class="container"><div class="page-content">
    <div class="section-header">
      <h2>Marketplace</h2>
    </div>
    <p class="mkt-intro">Group buys for jerseys and merch — commit to join, admin charges everyone once enough players are in.</p>
    <div class="mkt-grid">
      ${cards || '<div class="mkt-empty">Nothing up for grabs right now.</div>'}
    </div>
  </div></div>
  ${STYLE}`;
}

export function marketplaceListingPage({ listing, committedCount = 0, commitment = null, isLoggedIn = false } = {}) {
  const photos = parseJsonArray(listing.photos);
  const variantOptions = parseJsonArray(listing.variant_options);
  const meetsFloor = committedCount >= listing.min_buyers;
  const isOpen = listing.status === 'open' || listing.status === 'active';

  let actionHtml;
  if (listing.status === 'charged') {
    actionHtml = `<div class="mkt-hint">This group buy has already been charged and closed.</div>`;
  } else if (listing.status === 'cancelled') {
    actionHtml = `<div class="mkt-hint">This listing was cancelled.</div>`;
  } else if (!isLoggedIn) {
    actionHtml = `<a href="/login?next=${encodeURIComponent('/marketplace/' + listing.id)}" class="mkt-btn mkt-btn--primary">Log in to commit</a>`;
  } else if (commitment) {
    actionHtml = `
      <div class="mkt-hint mkt-hint--in">You're committed${commitment.variant ? ` — ${escHtml(commitment.variant)}` : ''}.</div>
      <button type="button" class="mkt-btn mkt-btn--ghost" id="mkt-cancel-btn">Cancel commitment</button>`;
  } else if (isOpen) {
    actionHtml = `
      <form id="mkt-commit-form">
        ${variantPicker(variantOptions, 'variant')}
        <button type="submit" class="mkt-btn mkt-btn--primary">Commit — ${fmtPeso(listing.price)}</button>
      </form>`;
  } else {
    actionHtml = `<div class="mkt-hint">Not accepting commitments right now.</div>`;
  }

  const photoGallery = photos.length
    ? `<div class="mkt-gallery">${photos.map((_, i) => `<img src="/api/marketplace/${escHtml(listing.id)}/photo/${i}" alt="">`).join('')}</div>`
    : '';

  return `<div class="container"><div class="page-content">
    <div class="mkt-detail card card--lg">
      ${photoGallery}
      <h1 class="mkt-detail__title">${escHtml(listing.title)}</h1>
      <div class="mkt-detail__price">${fmtPeso(listing.price)}</div>
      ${listing.description ? `<p class="mkt-detail__desc">${escHtml(listing.description)}</p>` : ''}
      <div class="mkt-detail__progress">
        <span class="mkt-detail__count${meetsFloor ? ' is-met' : ''}">${committedCount} committed</span>
        <span class="mkt-detail__min">— needs at least ${listing.min_buyers} to proceed</span>
      </div>
      <div class="mkt-detail__action">${actionHtml}</div>
      <p class="mkt-err" id="mkt-err" hidden></p>
    </div>
  </div></div>
  ${STYLE}
  <script>
  (function() {
    var form = document.getElementById('mkt-commit-form');
    var err  = document.getElementById('mkt-err');
    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var variant = (form.querySelector('input[name=variant]:checked') || {}).value || '';
        try {
          var r = await fetch(${JSON.stringify('/marketplace/' + listing.id + '/commit')}, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variant: variant }),
          });
          var j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Failed to commit.');
          window.location.reload();
        } catch (ex) { err.textContent = ex.message; err.hidden = false; }
      });
    }
    var cancelBtn = document.getElementById('mkt-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async function() {
        if (!confirm('Cancel your commitment to this listing?')) return;
        try {
          var r = await fetch(${JSON.stringify('/marketplace/' + listing.id + '/cancel-commitment')}, { method: 'POST' });
          var j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Failed to cancel.');
          window.location.reload();
        } catch (ex) { err.textContent = ex.message; err.hidden = false; }
      });
    }
  })();
  </script>`;
}

const STYLE = `<style>
.mkt-intro { font-size: 12.5px; color: var(--text-muted); margin: 0 0 20px; line-height: 1.5; max-width: 560px; }
.mkt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.mkt-empty { font-size: 13px; color: var(--text-muted); font-style: italic; padding: 20px 0; grid-column: 1 / -1; }
.mkt-card { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; text-decoration: none; color: inherit; transition: border-color .15s; }
.mkt-card:hover { border-color: var(--amber); }
.mkt-card__photo { height: 130px; background: var(--bg) center/cover no-repeat; display: flex; align-items: center; justify-content: center; }
.mkt-card__photo-placeholder { font-size: 11px; color: var(--text-muted); }
.mkt-card__body { padding: 12px 14px; }
.mkt-card__title { font-weight: 700; font-size: 13.5px; margin-bottom: 3px; }
.mkt-card__price { font-family: 'Saira Condensed', sans-serif; font-size: 18px; color: var(--amber); font-weight: 700; }
.mkt-card__progress { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 10.5px; color: var(--text-muted); }
.mkt-card__count.is-met { color: #22c55e; font-weight: 700; }
.mkt-card__badge { display: inline-block; margin-top: 8px; font-size: 10px; font-weight: 700; color: #22c55e; background: #22c55e1a; border: 1px solid #22c55e44; border-radius: 10px; padding: 2px 8px; }
.mkt-detail { padding: 22px 24px; max-width: 560px; }
.mkt-detail__title { font-size: 20px; margin: 0 0 4px; }
.mkt-detail__price { font-family: 'Saira Condensed', sans-serif; font-size: 26px; color: var(--amber); font-weight: 700; margin-bottom: 10px; }
.mkt-detail__desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.mkt-detail__progress { font-size: 12px; color: var(--text-muted); margin: 14px 0; }
.mkt-detail__count.is-met { color: #22c55e; font-weight: 700; }
.mkt-detail__action { margin-top: 10px; }
.mkt-gallery { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 14px; }
.mkt-gallery img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); flex-shrink: 0; }
.mkt-btn { display: inline-block; border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; text-decoration: none; }
.mkt-btn--primary { background: var(--amber); color: #1a1000; }
.mkt-btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
.mkt-hint { font-size: 12.5px; color: var(--text-muted); margin-bottom: 10px; }
.mkt-hint--in { color: #22c55e; font-weight: 600; }
.mkt-err { color: #f87171; font-size: 12px; margin-top: 8px; }
.mkt-pick-scroll { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; }
.mkt-pick-cell { border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; cursor: pointer; flex-shrink: 0; }
.mkt-pick-cell input { position: absolute; opacity: 0; pointer-events: none; }
.mkt-pick-cell.is-selected, .mkt-pick-cell:has(input:checked) { border-color: var(--amber); background: #f5933214; }
.mkt-pick-cell__label { font-size: 12.5px; font-weight: 700; }
</style>`;
