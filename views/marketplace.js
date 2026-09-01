import { escHtml, pageHeader } from './layout.js';

const ICON_CHEVRON_L = `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_CHEVRON_R = `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5l4 4.5-4 4.5"/></svg>`;

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function parseJsonArray(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Same red/amber/green-at-threshold convention as the admin Ledger's quotaBar and the
// team-head quota progress bar — visually capped at 100% even though committedCount can
// keep climbing past min_buyers (the threshold is a floor, not a cap).
function progressBar(count, min) {
  if (!min) return '';
  const pct = Math.min(100, Math.round((count / min) * 100));
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#f87171';
  return `<div class="mkt-progress-bar"><div style="width:${pct}%;background:${color}"></div></div>`;
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

// ── Listing card (games-list-row style: thumbnail on top, body below, stretched-link) ──
function listingCard(listing, { committedCount = 0, committed = false } = {}) {
  const photos = parseJsonArray(listing.photos);
  const hasCover = !!photos[0];
  const meetsFloor = committedCount >= listing.min_buyers;
  const cleanTitle = listing.title.slice(0, 120);

  return `<article class="mkt-row">
  <a href="/marketplace/${escHtml(listing.id)}" class="mkt-row__link" aria-label="${escHtml(cleanTitle)}"></a>
  <div class="mkt-row__thumb">
    ${hasCover
      ? `<img src="/api/marketplace/${escHtml(listing.id)}/photo/0" alt="" class="mkt-row__thumb-img">`
      : `<div class="mkt-row__thumb-placeholder">No photo</div>`}
  </div>
  <div class="mkt-row__body">
    <div class="mkt-row__meta">
      GROUP BUY
      ${committed ? '<span class="badge-playoff" style="background:#22c55e26;color:#22c55e;border-color:#22c55e55">YOU’RE IN</span>' : ''}
    </div>
    <h3 class="mkt-row__title">${escHtml(cleanTitle)}</h3>
    <div class="mkt-row__price">${fmtPeso(listing.price)}</div>
    ${progressBar(committedCount, listing.min_buyers)}
    <div class="mkt-row__footer">
      <span class="mkt-row__count${meetsFloor ? ' is-met' : ''}">${committedCount} committed <span class="mkt-row__count-min">&middot; min ${listing.min_buyers}</span></span>
      <span class="mkt-row__cta">VIEW <span>&rarr;</span></span>
    </div>
  </div>
</article>`;
}

export function marketplacePage({ listings = [], countsById = {}, committedById = {}, isLoggedIn = false } = {}) {
  const cards = listings.length
    ? listings.map(l => listingCard(l, { committedCount: countsById[l.id] || 0, committed: !!committedById[l.id] })).join('\n    ')
    : `<div class="card mkt-empty">No group buys open right now.</div>`;

  return `<div class="page-content">
${pageHeader({ title: 'Marketplace', description: 'Group buys for jerseys and merch — commit to join, admin charges everyone once enough players are in.' })}

<div class="mkt-main">
  ${listings.length ? `<div class="mkt-grid">${cards}</div>` : cards}
</div>
</div>
${STYLE}`;
}

// ── Listing detail (games-detail-layout style: left = media/content, right = info stack) ──
export function marketplaceListingPage({ listing, committedCount = 0, commitment = null, isLoggedIn = false } = {}) {
  const photos = parseJsonArray(listing.photos);
  const variantOptions = parseJsonArray(listing.variant_options);
  const meetsFloor = committedCount >= listing.min_buyers;
  const isOpen = listing.status === 'open' || listing.status === 'active';

  // Horizontal scroll-snap carousel (swipeable) with edge fades — same wrapper pattern as
  // the jersey-request size picker (views/jersey-request.js's pickScroll) — plus a
  // thumbnail strip below that jumps the carousel to that photo and tracks which one's active.
  const gallery = photos.length
    ? `<div class="mkt-gallery card">
        <div class="mkt-gallery__scroll-wrap">
          <div class="mkt-gallery__main" id="mkt-gallery-main">
            ${photos.map((_, i) => `<div class="mkt-gallery__slide" data-index="${i}"><img src="/api/marketplace/${escHtml(listing.id)}/photo/${i}" alt=""></div>`).join('')}
          </div>
          <div class="mkt-fade mkt-fade--l"></div>
          <div class="mkt-fade mkt-fade--r"></div>
          ${photos.length > 1 ? `
          <button type="button" class="mkt-gallery__arrow mkt-gallery__arrow--l" id="mkt-gallery-prev" aria-label="Previous photo">${ICON_CHEVRON_L}</button>
          <button type="button" class="mkt-gallery__arrow mkt-gallery__arrow--r" id="mkt-gallery-next" aria-label="Next photo">${ICON_CHEVRON_R}</button>` : ''}
        </div>
        ${photos.length > 1 ? `<div class="mkt-gallery__thumbs">${photos.map((_, i) => `<button type="button" class="mkt-gallery__thumb${i === 0 ? ' is-active' : ''}" data-thumb-index="${i}"><img src="/api/marketplace/${escHtml(listing.id)}/photo/${i}" alt=""></button>`).join('')}</div>` : ''}
      </div>`
    : `<div class="mkt-gallery mkt-gallery--empty card">No photos yet</div>`;

  const descCard = listing.description
    ? `<div class="card mkt-desc-card"><div class="mkt-desc-label">Details</div><p class="mkt-desc">${escHtml(listing.description)}</p></div>`
    : '';

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

  return `<div class="page-content">
<div class="mkt-detail-layout">
  <div class="mkt-detail-left">
    ${gallery}
  </div>
  <div class="mkt-detail-right">
    <div class="card mkt-info-card">
      <h1 class="mkt-detail__title">${escHtml(listing.title)}</h1>
      <div class="mkt-detail__price">${fmtPeso(listing.price)}</div>
      <div class="mkt-detail__progress">
        <span class="mkt-detail__count${meetsFloor ? ' is-met' : ''}">${committedCount} committed</span>
        <span class="mkt-detail__min">needs at least ${listing.min_buyers} to proceed</span>
        ${progressBar(committedCount, listing.min_buyers)}
      </div>
      <div class="mkt-detail__action">${actionHtml}</div>
      <p class="mkt-err" id="mkt-err" hidden></p>
    </div>
    ${descCard}
  </div>
</div>
</div>
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

  // Gallery carousel: swipe/scroll through slides, thumbnail click jumps + highlights,
  // edge fades track scroll position — same show-only-when-there's-more-that-way logic as
  // the jersey-request size picker.
  var main = document.getElementById('mkt-gallery-main');
  if (main) {
    var wrap  = main.closest('.mkt-gallery__scroll-wrap');
    var left  = wrap.querySelector('.mkt-fade--l');
    var right = wrap.querySelector('.mkt-fade--r');
    var prevBtn = document.getElementById('mkt-gallery-prev');
    var nextBtn = document.getElementById('mkt-gallery-next');
    var thumbs = document.querySelectorAll('.mkt-gallery__thumb');
    var slideCount = document.querySelectorAll('.mkt-gallery__slide').length;

    function currentIndex() { return Math.round(main.scrollLeft / main.clientWidth); }
    function goTo(index) {
      index = Math.max(0, Math.min(slideCount - 1, index));
      main.scrollTo({ left: index * main.clientWidth, behavior: 'smooth' });
    }
    function updateFades() {
      var max = main.scrollWidth - main.clientWidth;
      var hasMoreLeft  = main.scrollLeft > 4;
      var hasMoreRight = main.scrollLeft < max - 4;
      left.classList.toggle('is-visible', hasMoreLeft);
      right.classList.toggle('is-visible', hasMoreRight);
      if (prevBtn) prevBtn.classList.toggle('is-visible', hasMoreLeft);
      if (nextBtn) nextBtn.classList.toggle('is-visible', hasMoreRight);
    }
    function updateActiveThumb() {
      var index = currentIndex();
      thumbs.forEach(function(t) { t.classList.toggle('is-active', Number(t.dataset.thumbIndex) === index); });
    }
    main.addEventListener('scroll', function() { updateFades(); updateActiveThumb(); }, { passive: true });
    window.addEventListener('resize', updateFades);
    updateFades();

    if (prevBtn) prevBtn.addEventListener('click', function() { goTo(currentIndex() - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { goTo(currentIndex() + 1); });

    thumbs.forEach(function(t) {
      t.addEventListener('click', function() { goTo(Number(t.dataset.thumbIndex)); });
    });
  }
})();
</script>`;
}

const STYLE = `<style>
/* ── List page — mirrors .games-grid / .game-row ─────────────────────────── */
.mkt-main { display: flex; flex-direction: column; }
.mkt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
@media (max-width: 640px) { .mkt-grid { grid-template-columns: 1fr; } }
.mkt-empty { padding: 20px; color: var(--text-subtle); font-size: 13px; }

.mkt-row {
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--surface); border: 1px solid var(--border); border-radius: 15px;
  transition: border-color 0.15s, background 0.15s; position: relative;
}
.mkt-row:hover { border-color: var(--text-muted); background: rgba(255,255,255,0.02); }
.mkt-row__link { position: absolute; inset: 0; z-index: 1; }
.mkt-row__thumb { width: 100%; height: 180px; flex-shrink: 0; overflow: hidden; background: var(--bg); }
.mkt-row__thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mkt-row__thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-subtle); font-size: 11px; }
.mkt-row__body { flex: 1; padding: 16px 18px; min-width: 0; display: flex; flex-direction: column; }
.mkt-row__meta { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; color: var(--text-subtle); margin-bottom: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mkt-row__title { font-size: 15px; font-weight: 700; margin-bottom: 6px; color: var(--text); }
.mkt-row__price { font-family: 'Saira Condensed', sans-serif; font-size: 22px; color: var(--amber); font-weight: 700; }
.mkt-progress-bar { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; margin: 8px 0; }
.mkt-progress-bar div { height: 100%; border-radius: 99px; transition: width .2s; }
.mkt-row__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; }
.mkt-row__count { font-size: 11.5px; color: var(--text-muted); }
.mkt-row__count.is-met { color: #22c55e; font-weight: 700; }
.mkt-row__count-min { color: var(--text-subtle); }
.mkt-row__cta { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: var(--amber); }

/* ── Detail page — mirrors .game-detail-layout ───────────────────────────── */
.mkt-detail-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; margin-bottom: 40px; }
.mkt-detail-left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.mkt-detail-right { display: flex; flex-direction: column; gap: 14px; }
@media (max-width: 860px) { .mkt-detail-layout { grid-template-columns: 1fr; } }

.mkt-gallery { padding: 0; overflow: hidden; }
.mkt-gallery--empty { padding: 40px; text-align: center; color: var(--text-subtle); font-size: 13px; }
.mkt-gallery__scroll-wrap { position: relative; }
.mkt-gallery__main {
  display: flex; width: 100%; aspect-ratio: 1; background: var(--bg);
  overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; touch-action: pan-x;
  scrollbar-width: none;
}
.mkt-gallery__main::-webkit-scrollbar { display: none; }
.mkt-gallery__slide { flex: 0 0 100%; scroll-snap-align: start; }
.mkt-gallery__slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mkt-fade { position: absolute; top: 0; bottom: 0; width: 40px; pointer-events: none; opacity: 0; transition: opacity .15s; }
.mkt-fade--l { left: 0; background: linear-gradient(to right, rgba(0,0,0,.35) 0%, transparent 100%); }
.mkt-fade--r { right: 0; background: linear-gradient(to left, rgba(0,0,0,.35) 0%, transparent 100%); }
.mkt-fade.is-visible { opacity: 1; }
.mkt-gallery__arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(0,0,0,.5); color: #fff; display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none; transition: opacity .15s, background .15s;
}
.mkt-gallery__arrow.is-visible { opacity: 1; pointer-events: auto; }
.mkt-gallery__arrow:hover { background: rgba(0,0,0,.75); }
.mkt-gallery__arrow--l { left: 10px; }
.mkt-gallery__arrow--r { right: 10px; }
.mkt-gallery__thumbs { display: flex; gap: 8px; padding: 10px; overflow-x: auto; }
.mkt-gallery__thumb { flex-shrink: 0; padding: 0; border: 2px solid transparent; border-radius: 8px; cursor: pointer; background: none; line-height: 0; opacity: .55; transition: opacity .15s, border-color .15s; }
.mkt-gallery__thumb:hover { opacity: .85; }
.mkt-gallery__thumb.is-active { opacity: 1; border-color: var(--amber); }
.mkt-gallery__thumb img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; display: block; }
.mkt-desc-card { padding: 18px 20px; }
.mkt-desc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: var(--text-subtle); margin-bottom: 8px; text-transform: uppercase; }
.mkt-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.mkt-info-card { position: sticky; top: 90px; padding: 20px; }
.mkt-detail__title { font-size: 19px; margin: 0 0 4px; color: var(--text); }
.mkt-detail__price { font-family: 'Saira Condensed', sans-serif; font-size: 26px; color: var(--amber); font-weight: 700; margin-bottom: 12px; }
.mkt-detail__progress { font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin: 14px 0; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.mkt-detail__count { font-weight: 700; color: var(--text); }
.mkt-detail__count.is-met { color: #22c55e; }
.mkt-detail__min { color: var(--text-subtle); }
.mkt-detail__action { margin-top: 4px; }
.mkt-btn { display: inline-block; border-radius: 10px; padding: 11px 18px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; text-decoration: none; text-align: center; width: 100%; box-sizing: border-box; }
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
