import { escHtml, pageHeader } from './layout.js';
import { SIZE_CHART, sizeSurcharge } from '../lib/season-pricing.js';
import { playerAvatar, playerLink, teamColor } from './utils.js';

const ICON_CHEVRON_L = `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_CHEVRON_R = `<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.5l4 4.5-4 4.5"/></svg>`;
const ICON_BAG = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`;

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function parseJsonArray(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Visual language borrowed from Papawis's card treatment (views/papawis.js): status badge
// top-right, SLOTS-style meter row + bar. Marketplace's badge is about listing lifecycle
// (open/closed/cancelled) plus the viewer's own commitment, not slot occupancy, so the
// states differ from Papawis's Open/Full/Cancelled/Scheduled/Closed/Played set.
function statusBadge(listing, committed) {
  if (listing.status === 'cancelled') return `<span class="mkt-badge mkt-badge--cancelled">Cancelled</span>`;
  if (listing.status === 'charged') return `<span class="mkt-badge mkt-badge--muted">Closed</span>`;
  if (committed) return `<span class="mkt-badge mkt-badge--joined">You&rsquo;re In</span>`;
  return `<span class="mkt-badge mkt-badge--open">Open</span>`;
}

// Same red/amber/green-at-threshold convention as the admin Ledger's quotaBar and the
// team-head quota progress bar — visually capped at 100% even though committedCount can
// keep climbing past min_buyers (the threshold is a floor, not a cap). Container styling
// mirrors Papawis's pw-meter-row/pw-meter (views/papawis.js), but keeps this threshold
// coloring on the fill itself — min_buyers is a "will this actually happen" signal, unlike
// Papawis's flat slot-fill meter.
function meterBlock(count, min) {
  if (!min) return '';
  const pct = Math.min(100, Math.round((count / min) * 100));
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#f87171';
  return `<div class="mkt-meter-row">
      <span class="mkt-meter-label">COMMITTED</span>
      <span class="mkt-meter-count">${count}<small>/${min}</small></span>
    </div>
    <div class="mkt-meter"><span style="width:${pct}%;background:${color}"></span></div>`;
}

// Cell renderer for one variant group's picker — visually modeled on the jersey-request
// size grid (views/jersey-request.js's sizeCell/pickScroll). When the group carries a
// sizeChartKind ('top' or 'shorts'), each cell gets the same chest/length or hips/length
// measurement subtitle as the season-signup jersey picker. When it carries a surchargeStep,
// each cell's radio gets a data-surcharge amount (via sizeSurcharge()) so the commit form's
// live total can add it up client-side — the same tiered 2XL+ pricing used at charge time.
// The radio `name` is namespaced per group (variant__<label>) so multiple independent
// groups on the same form (e.g. Jersey Size + Shorts Size) never collide.
function variantPicker(options, groupLabel, selected = '', sizeChartKind = '', surchargeStep = 0) {
  const cells = options.map(opt => {
    const meas = sizeChartKind && SIZE_CHART[sizeChartKind]?.[opt];
    const surcharge = surchargeStep ? sizeSurcharge(opt, surchargeStep) : 0;
    return `
    <label class="mkt-pick-cell${selected === opt ? ' is-selected' : ''}">
      <input type="radio" name="${escHtml('variant__' + groupLabel)}" value="${escHtml(opt)}" data-surcharge="${surcharge}" ${selected === opt ? 'checked' : ''}>
      ${meas ? `<span class="mkt-pick-cell__meas">${meas[0]}&Prime; / ${meas[1]}&Prime;</span>` : ''}
      <span class="mkt-pick-cell__label">${escHtml(opt)}</span>
      ${surcharge ? `<span class="mkt-pick-cell__surcharge">+${fmtPeso(surcharge)}</span>` : ''}
    </label>`;
  }).join('');
  return `<div class="mkt-pick-scroll">${cells}</div>`;
}

// One heading + picker per group — a jersey group-buy might need both a Jersey Size and a
// Shorts Size selected independently, or a merch listing might need a Color and a
// Condition. groups: [{ label, options, sizeChartKind, surchargeStep }]. selections: { [label]: currentValue }.
function variantGroupsHtml(groups, selections = {}) {
  if (!groups.length) return '';
  return groups.map(g => `
    <div class="mkt-variant-group">
      <div class="mkt-variant-group__label">${escHtml(g.label)}</div>
      ${variantPicker(g.options, g.label, selections[g.label] || '', g.sizeChartKind || '', g.surchargeStep || 0)}
    </div>`).join('');
}

// ── Listing card — mirrors Papawis's pw-card (views/papawis.js): photo banner with scrim +
// overlaid status badge, titlebar, body with price + meter, footer CTA. Unlike Papawis
// (which just omits the photo banner when there's nothing uploaded — fine for courts, where
// no photo is the common case), a merch listing with no photo reads as broken, so this
// always renders the banner — a generic bag icon on the same gradient when there's no real
// cover — and always keeps the badge on it. The badge gets its own solid dark backdrop
// (mkt-photo-status) independent of the badge's own state color, since a translucent
// amber/green badge can wash out against a light-colored product photo.
function listingCard(listing, { committedCount = 0, committed = false, commentCount = 0, reactionCount = 0 } = {}) {
  const photos = parseJsonArray(listing.photos);
  const hasCover = !!photos[0];
  const cleanTitle = listing.title.slice(0, 120);
  const badge = statusBadge(listing, committed);

  const photoBanner = `<div class="mkt-photo">
        ${hasCover
          ? `<img src="/api/marketplace/${escHtml(listing.id)}/photo/0" alt="" loading="lazy">`
          : `<div class="mkt-photo-placeholder">${ICON_BAG}</div>`}
        <div class="mkt-photo-scrim"></div>
        <span class="mkt-photo-status">${badge}</span>
      </div>`;

  const social = (commentCount || reactionCount)
    ? `<div class="mkt-card-social">${commentCount ? `<span>💬 ${commentCount}</span>` : ''}${reactionCount ? `<span>🔥 ${reactionCount}</span>` : ''}</div>`
    : '';

  return `<article class="mkt-card">
  <a href="/marketplace/${escHtml(listing.id)}" class="mkt-card__link" aria-label="${escHtml(cleanTitle)}"></a>
  ${photoBanner}
  <div class="mkt-card-titlebar">
    <div class="mkt-card-name">${escHtml(cleanTitle)}</div>
  </div>
  <div class="mkt-card-body">
    <div class="mkt-card-price">${fmtPeso(listing.price)}</div>
    ${meterBlock(committedCount, listing.min_buyers)}
    <div class="mkt-foot">
      ${social}
      <span class="mkt-btn mkt-btn--ghost">View listing <span aria-hidden="true">&rarr;</span></span>
    </div>
  </div>
</article>`;
}

export function marketplacePage({ listings = [], countsById = {}, committedById = {}, commentCountsById = {}, reactionCountsById = {}, isLoggedIn = false } = {}) {
  const cards = listings.length
    ? listings.map(l => listingCard(l, {
        committedCount: countsById[l.id] || 0, committed: !!committedById[l.id],
        commentCount: commentCountsById[l.id] || 0, reactionCount: reactionCountsById[l.id] || 0,
      })).join('\n    ')
    : `<div class="mkt-card mkt-empty">No group buys open right now.</div>`;

  return `<div class="page-content">
${pageHeader({ title: 'Marketplace', description: 'Group buys for jerseys and merch — commit to join, admin charges everyone once enough players are in.' })}

<div class="mkt-main">
  ${listings.length ? `<div class="mkt-grid">${cards}</div>` : cards}
</div>
</div>
${STYLE}`;
}

// ── Comments + reactions — parallel of views/game.js's comment thread, minus @mentions
// (marketplace listings don't have a "who played" pool to mention). Live updates arrive via
// the same WebSocket-room pattern as game comments (see server.js's marketplaceCommentRooms).
function fmtCommentTime(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function commentRow(c, { reacted = false, isAdmin = false } = {}) {
  const color = teamColor(c.team_name || '');
  return `<li class="mkt-comment" data-id="${escHtml(c.id)}">
    ${playerAvatar(c.player_id, c.player_name, color, { className: 'mkt-comment__avatar', link: true })}
    <div class="mkt-comment__body">
      <div class="mkt-comment__head">
        ${playerLink(c.player_id, c.player_name, { className: 'mkt-comment__name' })}
        <span class="mkt-comment__time">${fmtCommentTime(c.created_at)}</span>
        ${isAdmin ? `<button type="button" class="mkt-comment__delete" data-delete-id="${escHtml(c.id)}" title="Delete comment" aria-label="Delete comment">✕</button>` : ''}
      </div>
      <p class="mkt-comment__text">${escHtml(c.body)}</p>
      <button type="button" class="mkt-comment__react${reacted ? ' is-active' : ''}" data-react-id="${escHtml(c.id)}">
        🔥 <span class="mkt-comment__react-count">${c.reaction_count || 0}</span>
      </button>
    </div>
  </li>`;
}

function commentsSection({ listingId, comments = [], reactedIds = new Set(), isPlayer = false, isAdmin = false }) {
  const list = comments.length
    ? `<ul class="mkt-comments-list" id="mkt-comments-list">${comments.map(c => commentRow(c, { reacted: reactedIds.has(c.id), isAdmin })).join('')}</ul>`
    : `<p class="mkt-comments-empty" id="mkt-comments-empty">No comments yet — be the first to say something.</p>`;

  const composer = isPlayer
    ? `<div class="mkt-comments-composer">
        <div class="mkt-comments-composer__box">
          <textarea id="mc-input" maxlength="500" rows="1" placeholder="Write a comment…"></textarea>
          <button type="button" id="mc-submit" class="mkt-comments-composer__send" aria-label="Post comment" disabled><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 1.5L10 6L2 10.5Z" fill="currentColor"/></svg></button>
        </div>
        <span id="mc-msg" class="mkt-comments-composer__msg"></span>
      </div>`
    : `<div class="mkt-comments-cta"><a href="/login?next=${encodeURIComponent('/marketplace/' + listingId)}">Login</a> to join the conversation.</div>`;

  return `<div class="mkt-card mkt-comments-card" id="mkt-comments-section">
    <div class="mkt-card-titlebar"><div class="mkt-card-name">Comments<span id="mkt-comments-count-label">${comments.length ? ` · ${comments.length}` : ''}</span></div></div>
    <div class="mkt-comments-panel">
      <div id="mkt-comments-container">${list}</div>
      ${composer}
    </div>
  </div>`;
}

// Mobile-only floating menu — mirrors views/game.js's gameSocialFloater. Desktop keeps the
// like button inline (see marketplaceListingPage) and the comments section is always in the
// document flow either way (no tab system to swap into here, unlike games), so the floater's
// comment item just scrolls/focuses down to it instead of switching tabs.
function mobileFloater({ commentsCount, listingReaction }) {
  const reactCount = listingReaction.count || 0;
  const badgeTotal = commentsCount + reactCount;
  return `<div class="mkt-floater" id="mkt-floater">
    <div class="mkt-floater__menu" id="mkt-floater-menu" hidden>
      <button type="button" class="mkt-floater__item" id="floater-comment-btn" aria-label="Comments">💬<span class="mkt-floater__count" id="floater-comments-count">${commentsCount}</span></button>
      <button type="button" class="mkt-floater__item${listingReaction.reacted ? ' is-active' : ''}" id="floater-like-btn" aria-label="Like this listing">🔥<span class="mkt-floater__count" id="floater-like-count">${reactCount}</span></button>
    </div>
    <button type="button" class="mkt-floater__bubble" id="mkt-floater-toggle" aria-label="Comments & like" aria-expanded="false">
      <span class="mkt-floater__bubble-icon" id="mkt-floater-icon" aria-hidden="true">💬</span>
      <span class="mkt-floater__badge" id="mkt-floater-badge"${badgeTotal ? '' : ' hidden'}>${badgeTotal}</span>
    </button>
  </div>`;
}

// ── Listing detail (games-detail-layout style: left = media/content, right = info stack) ──
export function marketplaceListingPage({
  listing, committedCount = 0, commitment = null, isLoggedIn = false,
  comments = [], reactedIds = new Set(), listingReaction = { count: 0, reacted: false },
  isPlayer = false, isAdmin = false,
} = {}) {
  const photos = parseJsonArray(listing.photos);
  const variantGroups = parseJsonArray(listing.variant_options);
  const isOpen = listing.status === 'open' || listing.status === 'active';
  const badge = statusBadge(listing, !!commitment);

  // Once committed, the headline price should reflect what this player actually locked in
  // (base + any surcharge from their selection), not just the listing's base price — same
  // number the admin's charge preview will show for them.
  let displayPrice = listing.price;
  if (commitment) {
    let selections = {};
    try { selections = JSON.parse(commitment.variant || '{}'); } catch { selections = {}; }
    const committedSurcharge = variantGroups.reduce((sum, g) => sum + (g.surchargeStep ? sizeSurcharge(selections[g.label] || '', g.surchargeStep) : 0), 0);
    displayPrice = listing.price + committedSurcharge;
  }

  // Desktop: masonry grid (up to 10 photos) filling the full left column, each tile at its
  // own natural aspect ratio rather than cropped into a uniform square — click any tile to
  // zoom into a full-screen lightbox. Mobile swaps to a simpler big-preview-on-top layout
  // instead (masonry's several-small-tiles reads cramped at phone width) — a large preview
  // with a horizontally-scrollable thumbnail strip below it, tapping a thumbnail swaps the
  // preview, tapping the preview itself opens the same lightbox. Both structures render
  // unconditionally and a CSS breakpoint shows only one — no resize listener needed, and the
  // browser dedupes the shared photo URLs so this costs no extra network traffic.
  const gallery = photos.length
    ? `<div class="mkt-masonry" id="mkt-masonry">
        ${photos.map((_, i) => `<div class="mkt-tile" data-index="${i}"><img src="/api/marketplace/${escHtml(listing.id)}/photo/${i}" alt="" loading="lazy"></div>`).join('')}
      </div>
      <div class="mkt-mobile-gallery" id="mkt-mobile-gallery">
        <button type="button" class="mkt-mobile-preview" id="mkt-mobile-preview" aria-label="Zoom photo">
          <div class="mkt-mobile-preview-strip" id="mkt-mobile-preview-strip">
            <img id="mkt-mobile-preview-img" src="/api/marketplace/${escHtml(listing.id)}/photo/0" alt="">
          </div>
        </button>
        ${photos.length > 1 ? `<div class="mkt-mobile-thumbs">
          ${photos.map((_, i) => `<button type="button" class="mkt-mobile-thumb${i === 0 ? ' is-active' : ''}" data-thumb-index="${i}"><img src="/api/marketplace/${escHtml(listing.id)}/photo/${i}" alt="" loading="lazy"></button>`).join('')}
        </div>` : ''}
      </div>`
    : `<div class="mkt-gallery-empty"><div class="mkt-photo-placeholder">${ICON_BAG}</div><span>No photos yet</span></div>`;

  const lightbox = photos.length ? `
  <div class="mkt-lightbox" id="mkt-lightbox" hidden>
    <button type="button" class="mkt-lightbox-close" id="mkt-lightbox-close" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    ${photos.length > 1 ? `
    <button type="button" class="mkt-lightbox-arrow mkt-lightbox-arrow--l" id="mkt-lightbox-prev" aria-label="Previous photo">${ICON_CHEVRON_L}</button>
    <button type="button" class="mkt-lightbox-arrow mkt-lightbox-arrow--r" id="mkt-lightbox-next" aria-label="Next photo">${ICON_CHEVRON_R}</button>` : ''}
    <img class="mkt-lightbox-img" id="mkt-lightbox-img" src="" alt="">
    ${photos.length > 1 ? `<span class="mkt-lightbox-counter" id="mkt-lightbox-counter"></span>` : ''}
  </div>` : '';

  const descCard = listing.description
    ? `<div class="mkt-card mkt-desc-card"><div class="mkt-desc-label">Details</div><p class="mkt-desc">${escHtml(listing.description)}</p></div>`
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
      <div class="mkt-hint mkt-hint--in">You're committed${commitment.variantLabel ? ` — ${escHtml(commitment.variantLabel)}` : ''}.</div>
      <button type="button" class="mkt-btn mkt-btn--ghost" id="mkt-cancel-btn">Cancel commitment</button>`;
  } else if (isOpen) {
    actionHtml = `
      <form id="mkt-commit-form" data-base-price="${listing.price}">
        ${variantGroupsHtml(variantGroups)}
        <button type="submit" class="mkt-btn mkt-btn--primary">Commit — <span id="mkt-commit-total">${fmtPeso(listing.price)}</span></button>
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
    <div class="mkt-card mkt-info-card">
      <div class="mkt-card-titlebar">
        <div class="mkt-card-name">${escHtml(listing.title)}</div>
        ${badge}
      </div>
      <div class="mkt-card-body">
        <div class="mkt-card-price" id="mkt-price-display">${fmtPeso(displayPrice)}</div>
        ${meterBlock(committedCount, listing.min_buyers)}
        <button type="button" id="mkt-listing-react-btn" class="mkt-like-btn${listingReaction.reacted ? ' is-active' : ''}" title="Like this listing">
          🔥 <span id="mkt-listing-react-count">${listingReaction.count || 0}</span>
        </button>
        <div class="mkt-detail__action">${actionHtml}</div>
        <p class="mkt-err" id="mkt-err" hidden></p>
      </div>
    </div>
    ${descCard}
  </div>
</div>
${commentsSection({ listingId: listing.id, comments, reactedIds, isPlayer, isAdmin })}
</div>
${lightbox}
${mobileFloater({ commentsCount: comments.length, listingReaction })}
${STYLE}
<script>
(function() {
  var form = document.getElementById('mkt-commit-form');
  var err  = document.getElementById('mkt-err');
  if (form) {
    var totalEl = document.getElementById('mkt-commit-total');
    var priceDisplay = document.getElementById('mkt-price-display');
    var basePrice = Number(form.dataset.basePrice) || 0;
    function recomputeTotal() {
      var total = basePrice;
      form.querySelectorAll('input[name^="variant__"]:checked').forEach(function(input) {
        total += Number(input.dataset.surcharge) || 0;
      });
      var formatted = '₱' + total.toLocaleString();
      if (totalEl) totalEl.textContent = formatted;
      if (priceDisplay) priceDisplay.textContent = formatted;
    }
    form.addEventListener('change', recomputeTotal);
    recomputeTotal();
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var variants = {};
      form.querySelectorAll('input[name^="variant__"]:checked').forEach(function(input) {
        variants[input.name.slice('variant__'.length)] = input.value;
      });
      try {
        var r = await fetch(${JSON.stringify('/marketplace/' + listing.id + '/commit')}, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variants: variants }),
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

  // Masonry tiles (desktop) and the big preview (mobile) both open the same full-screen
  // lightbox on click — prev/next cycle, Escape or a click on the backdrop closes it.
  // photoUrls mirrors the photo order 1:1 so any index (tile, thumb, or lightbox) lines up.
  var masonry = document.getElementById('mkt-masonry');
  var lightboxEl = document.getElementById('mkt-lightbox');
  if (lightboxEl) {
    var lbImg = document.getElementById('mkt-lightbox-img');
    var lbCounter = document.getElementById('mkt-lightbox-counter');
    var photoUrls = ${JSON.stringify(photos.map((_, i) => `/api/marketplace/${listing.id}/photo/${i}`))};
    var current = 0;

    // Swaps an <img>'s src with a directional slide instead of an instant pop — the new
    // photo is placed just off-screen in the direction it's "arriving from" (no transition),
    // then animated to translateX(0) on the next frame. direction: 1 = arriving from the
    // right (advancing), -1 = arriving from the left (going back), 0/omitted = no animation
    // (e.g. opening the lightbox fresh, where there's no "from" side to animate out of).
    function slideTo(img, src, direction) {
      if (!direction) { img.src = src; return; }
      img.style.transition = 'none';
      img.style.transform = 'translateX(' + (direction * 100) + '%)';
      img.src = src;
      void img.offsetWidth; // force a reflow so the transition below actually animates
      requestAnimationFrame(function() {
        img.style.transition = 'transform .22s ease-out';
        img.style.transform = 'translateX(0)';
      });
    }
    function render(direction) {
      slideTo(lbImg, photoUrls[current], direction);
      if (lbCounter) lbCounter.textContent = (current + 1) + ' / ' + photoUrls.length;
    }
    function openLightbox(index) { current = index; render(); lightboxEl.hidden = false; }
    function closeLightbox() { lightboxEl.hidden = true; }
    function step(delta) { current = (current + delta + photoUrls.length) % photoUrls.length; render(delta > 0 ? 1 : -1); }

    if (masonry) {
      masonry.querySelectorAll('.mkt-tile').forEach(function(tile) {
        tile.addEventListener('click', function() { openLightbox(Number(tile.dataset.index)); });
      });
    }
    document.getElementById('mkt-lightbox-close').addEventListener('click', closeLightbox);
    lightboxEl.addEventListener('click', function(e) { if (e.target === lightboxEl) closeLightbox(); });
    var lbPrev = document.getElementById('mkt-lightbox-prev');
    var lbNext = document.getElementById('mkt-lightbox-next');
    if (lbPrev) lbPrev.addEventListener('click', function(e) { e.stopPropagation(); step(-1); });
    if (lbNext) lbNext.addEventListener('click', function(e) { e.stopPropagation(); step(1); });
    document.addEventListener('keydown', function(e) {
      if (lightboxEl.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });

    // Horizontal swipe-to-navigate — a plain touchstart/touchend delta, no library. Ignored
    // if the gesture is more vertical than horizontal (that's a page scroll, not a swipe) or
    // under the threshold (an accidental drag/tap). passive:true throughout since nothing
    // here needs to block the browser's own scroll/tap handling.
    function addSwipe(el, onSwipeLeft, onSwipeRight) {
      var startX = 0, startY = 0, tracking = false;
      el.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
      }, { passive: true });
      el.addEventListener('touchend', function(e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) onSwipeLeft(); else onSwipeRight();
      }, { passive: true });
    }
    addSwipe(lightboxEl, function() { step(1); }, function() { step(-1); });

    // Mobile simple gallery — thumbnail click swaps the big preview with a canned slide;
    // tapping the preview opens the lightbox at whichever photo is currently shown.
    var mobilePreview = document.getElementById('mkt-mobile-preview');
    var mobileStrip = document.getElementById('mkt-mobile-preview-strip');
    var mobilePreviewImg = document.getElementById('mkt-mobile-preview-img');
    var mobileThumbs = document.querySelectorAll('.mkt-mobile-thumb');
    var previewIndex = 0;
    function showPreview(index, direction) {
      previewIndex = index;
      slideTo(mobilePreviewImg, photoUrls[previewIndex], direction);
      mobileThumbs.forEach(function(t) { t.classList.toggle('is-active', Number(t.dataset.thumbIndex) === previewIndex); });
    }
    mobileThumbs.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        var index = Number(thumb.dataset.thumbIndex);
        showPreview(index, index > previewIndex ? 1 : index < previewIndex ? -1 : 0);
      });
    });

    // Live-drag swipe on the preview itself — unlike the canned slide above, this tracks the
    // finger directly: a second "peek" photo is inserted into the strip edge-to-edge with the
    // current one, and both move together under one shared transform for the whole gesture,
    // so they read as a single connected filmstrip rather than the photo popping to a new one
    // once you lift your finger. Releasing past the commit threshold finishes the slide the
    // rest of the way (and swaps which photo is "current"); releasing short of it springs both
    // back to where they started.
    if (mobilePreview && mobileStrip) {
      var dragStartX = 0, dragStartY = 0, dragging = false, dragIsSwipe = false, justDragged = false;
      var peekImg = null, peekSide = 0; // peekSide: 1 = peek sits to the right (next), -1 = left (prev)

      function removePeek() {
        if (peekImg && peekImg.parentNode) peekImg.parentNode.removeChild(peekImg);
        peekImg = null; peekSide = 0;
      }

      mobilePreview.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1 || photoUrls.length < 2) return;
        dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
        dragging = true; dragIsSwipe = false;
        mobilePreviewImg.style.transition = 'none';
      }, { passive: true });

      mobilePreview.addEventListener('touchmove', function(e) {
        if (!dragging) return;
        var dx = e.touches[0].clientX - dragStartX;
        var dy = e.touches[0].clientY - dragStartY;
        if (!dragIsSwipe) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // vertical — let the page scroll instead
          dragIsSwipe = true;
        }
        var side = dx < 0 ? 1 : -1;
        var width = mobilePreview.clientWidth || 1;
        if (!peekImg || peekSide !== side) {
          removePeek();
          peekSide = side;
          peekImg = document.createElement('img');
          peekImg.alt = '';
          peekImg.src = photoUrls[(previewIndex + side + photoUrls.length) % photoUrls.length];
          mobileStrip.appendChild(peekImg);
        }
        mobilePreviewImg.style.transform = 'translateX(' + dx + 'px)';
        peekImg.style.transform = 'translateX(' + (dx + side * width) + 'px)';
      }, { passive: true });

      mobilePreview.addEventListener('touchend', function(e) {
        if (!dragging) return;
        dragging = false;
        if (!dragIsSwipe || !peekImg) { removePeek(); return; }
        justDragged = true;
        var dx = e.changedTouches[0].clientX - dragStartX;
        var width = mobilePreview.clientWidth || 1;
        var side = peekSide;
        var commit = Math.abs(dx) > Math.min(80, width * 0.25);
        mobilePreviewImg.style.transition = 'transform .2s ease-out';
        peekImg.style.transition = 'transform .2s ease-out';
        if (commit) {
          mobilePreviewImg.style.transform = 'translateX(' + (-side * width) + 'px)';
          peekImg.style.transform = 'translateX(0px)';
          setTimeout(function() {
            previewIndex = (previewIndex + side + photoUrls.length) % photoUrls.length;
            mobilePreviewImg.style.transition = 'none';
            mobilePreviewImg.style.transform = 'none';
            mobilePreviewImg.src = photoUrls[previewIndex];
            mobileThumbs.forEach(function(t) { t.classList.toggle('is-active', Number(t.dataset.thumbIndex) === previewIndex); });
            removePeek();
          }, 200);
        } else {
          mobilePreviewImg.style.transform = 'translateX(0px)';
          peekImg.style.transform = 'translateX(' + (side * width) + 'px)';
          setTimeout(function() { mobilePreviewImg.style.transition = 'none'; removePeek(); }, 200);
        }
      }, { passive: true });

      mobilePreview.addEventListener('click', function() {
        if (justDragged) { justDragged = false; return; }
        openLightbox(previewIndex);
      });
    } else if (mobilePreview) {
      mobilePreview.addEventListener('click', function() { openLightbox(previewIndex); });
    }
  }

  // ── Comments + reactions — parallel of views/game.js's gameTabsScript comments/react
  // wiring, minus the @mention dropdown (marketplace has no "who played" pool to mention).
  var listingId = ${JSON.stringify(listing.id)};
  var isAdminViewer = ${JSON.stringify(isAdmin)};
  var wsReady = false;

  var mcInput = document.getElementById('mc-input');
  var mcSubmit = document.getElementById('mc-submit');
  if (mcInput && mcSubmit) {
    mcInput.addEventListener('input', function() {
      mcInput.style.height = 'auto';
      mcInput.style.height = mcInput.scrollHeight + 'px';
      mcSubmit.disabled = !mcInput.value.trim();
    });
    mcInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
    });
    mcSubmit.addEventListener('click', postComment);
  }

  function postComment() {
    var msg = document.getElementById('mc-msg');
    var body = mcInput.value.trim();
    if (!body) { msg.textContent = 'Write something first.'; return; }
    mcSubmit.disabled = true; msg.textContent = '';
    fetch('/marketplace/' + listingId + '/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok) { msg.textContent = res.d.error || 'Failed to post.'; mcSubmit.disabled = false; return; }
        if (wsReady) {
          mcInput.value = ''; mcInput.style.height = 'auto'; mcSubmit.disabled = true;
        } else {
          window.location.reload();
        }
      })
      .catch(function() { msg.textContent = 'Network error.'; mcSubmit.disabled = false; });
  }

  // Delegated (not per-button) — comments added later by the WebSocket handler below need
  // working react/delete clicks without re-binding anything.
  var commentsPanel = document.querySelector('.mkt-comments-panel');
  if (commentsPanel) {
    commentsPanel.addEventListener('click', function(e) {
      var reactBtnEl = e.target.closest('[data-react-id]');
      if (reactBtnEl) {
        var rid = reactBtnEl.dataset.reactId;
        reactBtnEl.disabled = true;
        fetch('/marketplace/' + listingId + '/comments/' + rid + '/react', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            reactBtnEl.disabled = false;
            if (!d.ok) return;
            reactBtnEl.classList.toggle('is-active', d.reacted);
            reactBtnEl.querySelector('.mkt-comment__react-count').textContent = d.count;
          })
          .catch(function() { reactBtnEl.disabled = false; });
        return;
      }
      var delBtnEl = e.target.closest('[data-delete-id]');
      if (delBtnEl) {
        if (!confirm('Delete this comment?')) return;
        var did = delBtnEl.dataset.deleteId;
        fetch('/marketplace/' + listingId + '/comments/' + did, { method: 'DELETE' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.ok) { alert(d.error || 'Failed'); return; }
            var li = commentsPanel.querySelector('.mkt-comment[data-id="' + did + '"]');
            if (li) li.remove();
          })
          .catch(function() { alert('Network error'); });
      }
    });
  }

  function escLive(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtLiveTime(ms) {
    return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function bumpCommentsCount(delta) {
    var el = document.getElementById('mkt-comments-count-label');
    if (!el) return;
    var current = parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
    var next = Math.max(0, current + delta);
    el.textContent = next ? ' · ' + next : '';
    updateFloaterState();
  }
  function buildCommentLi(c) {
    var li = document.createElement('li');
    li.className = 'mkt-comment';
    li.setAttribute('data-id', c.id);
    var playerHref = '/players/' + encodeURIComponent(c.player_id);
    li.innerHTML =
      '<a href="' + playerHref + '" class="mkt-comment__avatar" style="border-color:' + escLive(c.color) + '">' +
        '<span class="font-condensed">' + escLive(c.initials) + '</span>' +
        '<img src="' + escLive(c.photoUrl) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\'">' +
      '</a>' +
      '<div class="mkt-comment__body">' +
        '<div class="mkt-comment__head">' +
          '<a href="' + playerHref + '" class="mkt-comment__name">' + escLive(c.displayName) + '</a>' +
          '<span class="mkt-comment__time">' + fmtLiveTime(c.created_at) + '</span>' +
          (isAdminViewer ? '<button type="button" class="mkt-comment__delete" data-delete-id="' + c.id + '" title="Delete comment" aria-label="Delete comment">✕</button>' : '') +
        '</div>' +
        '<p class="mkt-comment__text">' + escLive(c.body) + '</p>' +
        '<button type="button" class="mkt-comment__react" data-react-id="' + c.id + '">🔥 <span class="mkt-comment__react-count">0</span></button>' +
      '</div>';
    return li;
  }

  function connectCommentsSocket() {
    var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws;
    try { ws = new WebSocket(proto + '//' + window.location.host + '/ws/marketplace/' + encodeURIComponent(listingId) + '/comments'); }
    catch (e) { return; }

    ws.addEventListener('open', function() { wsReady = true; });
    ws.addEventListener('close', function() {
      wsReady = false;
      setTimeout(connectCommentsSocket, 4000);
    });
    ws.addEventListener('error', function() { wsReady = false; });

    ws.addEventListener('message', function(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }

      if (msg.type === 'comment:new') {
        var container = document.getElementById('mkt-comments-container');
        var list = document.getElementById('mkt-comments-list');
        if (!list) {
          var empty = document.getElementById('mkt-comments-empty');
          if (empty) empty.remove();
          list = document.createElement('ul');
          list.className = 'mkt-comments-list';
          list.id = 'mkt-comments-list';
          container.appendChild(list);
        }
        list.appendChild(buildCommentLi(msg.comment));
        bumpCommentsCount(1);
        return;
      }
      if (msg.type === 'comment:delete') {
        var row = document.querySelector('.mkt-comment[data-id="' + msg.id + '"]');
        if (row) row.remove();
        bumpCommentsCount(-1);
        return;
      }
      if (msg.type === 'comment:react') {
        var reactRow = document.querySelector('.mkt-comment[data-id="' + msg.id + '"] .mkt-comment__react-count');
        if (reactRow) reactRow.textContent = msg.count;
        return;
      }
      if (msg.type === 'listing:react') {
        var lc = document.getElementById('mkt-listing-react-count');
        if (lc) lc.textContent = msg.count;
        updateFloaterState();
        return;
      }
    });
  }
  connectCommentsSocket();

  var listingReactBtn = document.getElementById('mkt-listing-react-btn');
  if (listingReactBtn) {
    listingReactBtn.addEventListener('click', function() {
      listingReactBtn.disabled = true;
      fetch('/marketplace/' + listingId + '/react', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(function(r) {
          if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return null; }
          return r.json();
        })
        .then(function(d) {
          if (!d) return;
          listingReactBtn.disabled = false;
          if (!d.ok) return;
          listingReactBtn.classList.toggle('is-active', d.reacted);
          document.getElementById('mkt-listing-react-count').textContent = d.count;
          var floaterLikeBtn = document.getElementById('floater-like-btn');
          if (floaterLikeBtn) floaterLikeBtn.classList.toggle('is-active', d.reacted);
          updateFloaterState();
        })
        .catch(function() { listingReactBtn.disabled = false; });
    });
  }

  // Mobile floater — mirrors the like/comment buttons above rather than duplicating their
  // logic: each item just clicks the real button (or scrolls to the real section) and reads
  // counts back off the same source-of-truth elements those buttons update.
  function updateFloaterState() {
    var floaterBadge = document.getElementById('mkt-floater-badge');
    if (!floaterBadge) return;
    var commentsLabelEl = document.getElementById('mkt-comments-count-label');
    var commentsCount = commentsLabelEl ? (parseInt((commentsLabelEl.textContent || '').replace(/[^0-9]/g, ''), 10) || 0) : 0;
    var reactCountEl = document.getElementById('mkt-listing-react-count');
    var reactCount = reactCountEl ? (parseInt(reactCountEl.textContent, 10) || 0) : 0;
    var floaterCommentsCount = document.getElementById('floater-comments-count');
    if (floaterCommentsCount) floaterCommentsCount.textContent = commentsCount;
    var floaterLikeCount = document.getElementById('floater-like-count');
    if (floaterLikeCount) floaterLikeCount.textContent = reactCount;
    var total = commentsCount + reactCount;
    floaterBadge.textContent = total;
    floaterBadge.hidden = !total;
  }

  var floaterToggle = document.getElementById('mkt-floater-toggle');
  var floaterMenu = document.getElementById('mkt-floater-menu');
  var floaterIcon = document.getElementById('mkt-floater-icon');
  if (floaterToggle && floaterMenu) {
    var setFloaterOpen = function(open) {
      floaterMenu.hidden = !open;
      floaterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      floaterToggle.classList.toggle('is-open', open);
      if (floaterIcon) floaterIcon.textContent = open ? '✕' : '💬';
    };
    floaterToggle.addEventListener('click', function() { setFloaterOpen(floaterMenu.hidden); });

    var floaterCommentBtn = document.getElementById('floater-comment-btn');
    if (floaterCommentBtn) {
      floaterCommentBtn.addEventListener('click', function() {
        var section = document.getElementById('mkt-comments-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (mcInput) setTimeout(function() { mcInput.focus(); }, 300);
        }
        setFloaterOpen(false);
      });
    }
    var floaterLikeBtn2 = document.getElementById('floater-like-btn');
    if (floaterLikeBtn2) {
      floaterLikeBtn2.addEventListener('click', function() { if (listingReactBtn) listingReactBtn.click(); });
    }
  }
})();
</script>`;
}

const STYLE = `<style>
/* ── Card — mirrors Papawis's pw-card (views/papawis.js): photo banner w/ scrim + overlaid
   badge, titlebar, body. auto-fill (not auto-fit) keeps column width fixed across the grid
   so a lone trailing card doesn't stretch — same reasoning as .pw-grid. ─────────────────── */
.mkt-main { display: flex; flex-direction: column; }
.mkt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
@media (max-width: 640px) { .mkt-grid { grid-template-columns: 1fr; } .mkt-card { max-width: none; } }
.mkt-empty { padding: 20px; color: var(--text-subtle); font-size: 13px; }

.mkt-card { background: var(--surface); border: 1px solid var(--border); border-radius: 15px; overflow: hidden; position: relative; }
.mkt-grid .mkt-card { display: flex; flex-direction: column; max-width: 420px; transition: border-color .15s; }
.mkt-grid .mkt-card:hover { border-color: rgba(245,147,50,.35); }
.mkt-card__link { position: absolute; inset: 0; z-index: 1; }

.mkt-photo { position: relative; height: 140px; flex-shrink: 0; overflow: hidden; background: linear-gradient(155deg, #2a3346 0%, #171d29 46%, #0c0f16 100%); }
.mkt-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.mkt-photo-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.18); }
.mkt-photo-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,9,16,0) 45%, rgba(6,9,16,.55) 100%); }
/* Solid dark backdrop independent of the badge's own state color — a translucent
   amber/green badge (fine against the titlebar) can wash out against a light product
   photo, so the photo-overlaid badge always gets its own contrast-guaranteed background. */
.mkt-photo-status { position: absolute; top: 10px; right: 10px; }
.mkt-photo-status .mkt-badge { background: rgba(2,8,23,.72); backdrop-filter: blur(3px); border-color: rgba(255,255,255,.18); box-shadow: 0 1px 4px rgba(0,0,0,.35); }

.mkt-card-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 18px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border); }
.mkt-card-name { font-size: 15px; font-weight: 700; letter-spacing: -.005em; color: var(--text-primary); }
.mkt-card-body { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; }
.mkt-card-price { font-family: 'Saira Condensed', sans-serif; font-size: 22px; color: var(--amber); font-weight: 700; }

.mkt-badge { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
.mkt-badge--open { background: rgba(245,147,50,.12); color: var(--amber); border: 1px solid rgba(245,147,50,.3); }
.mkt-badge--joined { background: rgba(52,211,153,.12); color: #22c55e; border: 1px solid rgba(52,211,153,.3); }
.mkt-badge--muted { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border); }
.mkt-badge--cancelled { background: rgba(248,113,113,.12); color: #f87171; border: 1px solid rgba(248,113,113,.3); }

.mkt-meter-row { display: flex; align-items: baseline; justify-content: space-between; }
.mkt-meter-label { font-size: 10.5px; color: var(--text-muted); font-weight: 700; letter-spacing: .04em; }
.mkt-meter-count { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.mkt-meter-count small { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.mkt-meter { height: 6px; border-radius: 99px; background: var(--bg); border: 1px solid var(--border); overflow: hidden; }
.mkt-meter > span { display: block; height: 100%; border-radius: 99px; transition: width .2s; }

.mkt-foot { margin-top: auto; padding-top: 4px; }

/* ── Detail page — mirrors .game-detail-layout ───────────────────────────── */
.mkt-detail-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; margin-bottom: 40px; }
.mkt-detail-left { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.mkt-detail-right { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
/* 24px/40px above are column-gutter values, tuned for the two-column desktop grid — once
   everything stacks into one column on mobile they read as gaps between disconnected
   sections rather than a gutter, so this breakpoint tightens them specifically rather than
   just collapsing the grid to 1fr. */
@media (max-width: 860px) {
  .mkt-detail-layout { grid-template-columns: 1fr; gap: 14px; margin-bottom: 20px; }
  .mkt-detail-right { gap: 12px; }
}

/* Fills the full 1fr left column — three narrower columns instead of one giant square
   keeps individual tiles from ballooning as the track grows on a wide monitor. Below 700px
   several small masonry tiles read cramped, so the breakpoint swaps to .mkt-mobile-gallery
   (big preview + scrollable thumbnail strip) entirely rather than just narrowing columns. */
.mkt-masonry { column-count: 3; column-gap: 10px; }
.mkt-tile {
  break-inside: avoid; margin-bottom: 10px; border-radius: 12px; overflow: hidden;
  position: relative; cursor: zoom-in; border: 1px solid var(--border); background: var(--surface);
  transition: border-color .15s;
}
.mkt-tile:hover { border-color: rgba(245,147,50,.4); }
.mkt-tile img { display: block; width: 100%; }

.mkt-mobile-gallery { display: none; }
@media (max-width: 700px) {
  .mkt-masonry { display: none; }
  .mkt-mobile-gallery { display: block; }
}
.mkt-mobile-preview {
  display: block; width: 100%; aspect-ratio: 1; padding: 0; margin: 0; border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; background: var(--surface); cursor: zoom-in; touch-action: pan-y;
}
/* Strip holds the current photo plus, only while a drag is in progress, a second "peek"
   photo positioned edge-to-edge with it (see the drag JS below) — both move together under
   one shared transform so the two photos read as one continuous connected filmstrip instead
   of a canned "new photo slides in alone" transition. */
.mkt-mobile-preview-strip { position: relative; width: 100%; height: 100%; }
.mkt-mobile-preview-strip img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.mkt-mobile-thumbs { display: flex; gap: 8px; overflow-x: auto; margin-top: 10px; padding-bottom: 2px; }
.mkt-mobile-thumb {
  flex-shrink: 0; width: 56px; height: 56px; padding: 0; border-radius: 8px; overflow: hidden;
  border: 2px solid transparent; cursor: pointer; background: none; line-height: 0; opacity: .55;
  transition: opacity .15s, border-color .15s;
}
.mkt-mobile-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mkt-mobile-thumb:hover { opacity: .85; }
.mkt-mobile-thumb.is-active { opacity: 1; border-color: var(--amber); }

.mkt-gallery-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 50px 20px; text-align: center; color: var(--text-subtle); font-size: 13px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 15px;
}
.mkt-gallery-empty .mkt-photo-placeholder { position: static; color: rgba(255,255,255,.18); }

.mkt-lightbox {
  position: fixed; inset: 0; z-index: 1000; background: rgba(2,8,23,.88); backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center; padding: 40px;
}
.mkt-lightbox[hidden] { display: none; }
.mkt-lightbox-img { max-width: min(720px, 90vw); max-height: 84vh; border-radius: 12px; display: block; box-shadow: 0 30px 80px -20px rgba(0,0,0,.6); }
.mkt-lightbox-close, .mkt-lightbox-arrow {
  position: absolute; z-index: 2; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(10,14,22,.55); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,.14);
  color: #fff; display: flex; align-items: center; justify-content: center; transition: background .15s;
}
.mkt-lightbox-close:hover, .mkt-lightbox-arrow:hover { background: rgba(245,147,50,.35); }
.mkt-lightbox-close { top: 16px; right: 16px; }
.mkt-lightbox-arrow--l { top: 50%; left: 16px; transform: translateY(-50%); }
.mkt-lightbox-arrow--r { top: 50%; right: 16px; transform: translateY(-50%); }
.mkt-lightbox-counter {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  font-family: 'Saira Condensed', sans-serif; font-size: 13px; font-weight: 600; color: rgba(255,255,255,.85);
  background: rgba(10,14,22,.55); backdrop-filter: blur(4px); padding: 4px 12px; border-radius: 99px;
  border: 1px solid rgba(255,255,255,.12);
}

.mkt-desc-card { padding: 18px 20px; }
.mkt-desc-label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: var(--text-subtle); margin-bottom: 8px; text-transform: uppercase; }
.mkt-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

.mkt-info-card { position: sticky; top: 90px; }
.mkt-detail__action { margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
.mkt-btn { font-family: inherit; display: block; border-radius: 9px; padding: 10px 14px; font-size: 13.5px; font-weight: 700; cursor: pointer; border: 1px solid transparent; text-decoration: none; text-align: center; width: 100%; box-sizing: border-box; transition: opacity .12s, background .12s, border-color .12s; }
.mkt-btn--primary { background: var(--amber); color: #020817; }
.mkt-btn--primary:hover { opacity: .9; }
.mkt-btn--ghost { background: transparent; border-color: var(--border); color: var(--text-primary); }
.mkt-btn--ghost:hover { border-color: var(--text-muted); }
.mkt-hint { font-size: 12.5px; color: var(--text-muted); }
.mkt-hint--in { color: #22c55e; font-weight: 600; }
.mkt-err { color: #f87171; font-size: 12px; margin-top: 8px; }
.mkt-variant-group { margin-bottom: 4px; }
.mkt-variant-group__label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-subtle); margin-bottom: 6px; }
.mkt-pick-scroll { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; }
.mkt-pick-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; cursor: pointer; flex-shrink: 0; }
/* display:none (not opacity:0 + position:absolute) — matches jersey-request.js's pick-cell
   pattern. A hidden-but-still-focusable input stays in the browser's focus-triggered
   scrollIntoView path; clicking a cell would then focus it and the browser could yank the
   whole page sideways trying to bring an invisible, oddly-positioned element into view.
   display:none removes it from focus entirely — the label click still toggles it. */
.mkt-pick-cell input { display: none; }
.mkt-pick-cell.is-selected, .mkt-pick-cell:has(input:checked) { border-color: var(--amber); background: #f5933214; }
.mkt-pick-cell__meas { font-size: 10.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.mkt-pick-cell__label { font-size: 12.5px; font-weight: 700; }
.mkt-pick-cell__surcharge { font-size: 10px; color: var(--amber); font-weight: 700; }

.mkt-card-social { display: flex; gap: 10px; font-size: 11.5px; color: var(--text-muted); }

/* ── Like button — inline on desktop, mirrors games' tabActionsBar react button; hidden at
   the same breakpoint the mobile floater takes over at, so it's never shown twice. ────── */
.mkt-like-btn {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  background: none; border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px;
  font-size: 13px; color: var(--text-muted); cursor: pointer; font-family: inherit;
}
.mkt-like-btn.is-active { border-color: var(--amber); color: var(--amber); }
@media (max-width: 860px) { .mkt-like-btn { display: none; } }

/* ── Comments — parallel of views/game.js's .game-comment* rules, mkt- prefixed. ────────── */
.mkt-comments-card { margin-top: 24px; }
/* Same column-gutter-vs-vertical-stack reasoning as .mkt-detail-layout's own mobile
   override above — kept here (not bundled into that earlier media block) so this override
   sits after the rule it's overriding in source order and actually wins the cascade. */
@media (max-width: 860px) { .mkt-comments-card { margin-top: 20px; } }
.mkt-comments-panel { padding: 18px 20px 20px; }
.mkt-comments-panel { padding: 18px 20px 20px; }
.mkt-comments-composer { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; }
.mkt-comments-composer__box { position: relative; display: flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 6px 6px 6px 14px; box-sizing: border-box; }
.mkt-comments-composer textarea { flex: 1; min-width: 0; min-height: 22px; max-height: 160px; resize: none; overflow-y: auto; background: none; border: none; color: var(--text-primary); font: inherit; padding: 6px 0; box-sizing: border-box; }
.mkt-comments-composer textarea:focus { outline: none; }
.mkt-comments-composer__send { flex-shrink: 0; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--border); color: var(--text-muted); border: none; border-radius: 50%; cursor: pointer; transition: background .12s, color .12s; }
.mkt-comments-composer__send:not(:disabled) { background: var(--amber); color: #020817; cursor: pointer; }
.mkt-comments-composer__send:disabled { cursor: not-allowed; }
.mkt-comments-composer__msg { font-size: 12px; color: var(--text-muted); padding-left: 4px; min-height: 14px; }
.mkt-comments-cta { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 13px; color: var(--text-muted); margin-top: 16px; }
.mkt-comments-cta a { color: var(--amber); font-weight: 600; }
.mkt-comments-empty { color: var(--text-muted); font-size: 13px; margin: 0; }
.mkt-comments-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.mkt-comment { display: flex; gap: 12px; align-items: flex-start; }
.mkt-comment__avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg); }
.mkt-comment__avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.mkt-comment__body { flex: 1; min-width: 0; }
.mkt-comment__head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.mkt-comment__name { font-weight: 700; color: var(--text-primary); text-decoration: none; font-size: 13px; }
.mkt-comment__time { font-size: 11px; color: var(--text-muted); }
.mkt-comment__delete { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 2px 4px; }
.mkt-comment__delete:hover { color: #ef4444; }
.mkt-comment__text { margin: 4px 0 6px; font-size: 13.5px; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; }
.mkt-comment__react { display: inline-flex; align-items: center; gap: 5px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; font-family: inherit; }
.mkt-comment__react.is-active { border-color: var(--amber); color: var(--amber); }

/* ── Mobile floating menu — parallel of views/game.js's .game-floater* rules. Same
   breakpoint as .mkt-like-btn's hide so the like control never shows in two places. ───── */
.mkt-floater { display: none; }
@media (max-width: 860px) { .mkt-floater { display: block; position: fixed; right: 16px; bottom: 24px; z-index: 80; } }
.mkt-floater__menu { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 10px; }
.mkt-floater__menu[hidden] { display: none; }
.mkt-floater__item {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  min-width: 44px; height: 44px; padding: 0 12px; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
  font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.3);
}
.mkt-floater__item.is-active { border-color: var(--amber); color: var(--amber); }
.mkt-floater__count { font-size: 12.5px; font-weight: 600; }
.mkt-floater__bubble {
  position: relative; width: 52px; height: 52px; border-radius: 50%;
  background: var(--amber); border: none; color: #0a0e16; cursor: pointer;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0,0,0,.35);
}
.mkt-floater__bubble-icon { display: block; font-size: 19px; line-height: 1; }
.mkt-floater__bubble.is-open { background: var(--surface); color: var(--text-primary); box-shadow: 0 4px 14px rgba(0,0,0,.3); }
.mkt-floater__badge {
  position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.mkt-floater__badge[hidden] { display: none; }
</style>`;
