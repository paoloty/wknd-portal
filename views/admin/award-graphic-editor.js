import { escHtml } from '../layout.js';

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_CHECK      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;

// Fixed layout constants shared with buildOgStripPng()/buildTeamAwardOgSvg()/buildStatLeadersOgSvg()
// in server.js. H must stay in sync so pan/zoom offsets computed here mean the same
// thing as the ones the real PNG generator applies.
const CANVAS_W = 1200, CANVAS_H = 630, BANNER_H = 72;

// Mirrors AWARD_ICON_PATH in server.js — MVP/DPOY badge icons.
const PILL_ICON_SVG = {
  crown:  `<svg viewBox="0 0 24 20" class="agr-strip__pill-icon"><path d="M2 6l4 4 6-8 6 8 4-4-2 11H4L2 6z"/></svg>`,
  shield: `<svg viewBox="0 0 24 26" class="agr-strip__pill-icon"><path d="M12 1l10 4v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13V5l10-4z"/></svg>`,
};

// A bare photo-only strip — no text, no pill, no bottom bar (hero mode's text/bar are
// canvas-level overlays rendered once, not per-photo). Used for MVP/DPOY's image slots.
function photoStripHtml(opts) {
  const { leftPct, widthPct, dataAttrs, photoUrl, shadeCss } = opts;
  return `
    <div class="agr-strip" style="left:${leftPct}%;width:${widthPct}%" ${dataAttrs}>
      <div class="agr-strip__frame">
        <img class="agr-strip__img" src="${escHtml(photoUrl)}" alt="" draggable="false">
      </div>
      <div class="agr-strip__shade" style="background:${escHtml(shadeCss)}" aria-hidden="true"></div>
      <div class="agr-strip__vline" aria-hidden="true"></div>
      <div class="agr-strip__ctl">
        <button type="button" class="agr-ctl-btn" data-action="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="agr-ctl-btn" data-action="zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="agr-ctl-btn" data-action="replace" title="Replace this photo" aria-label="Replace photo">⤒</button>
        <button type="button" class="agr-ctl-btn" data-action="reset" title="Reset to default" aria-label="Reset">&#8635;</button>
      </div>
      <input type="file" class="agr-strip__file" accept="image/*" hidden>
    </div>`;
}

export function awardGraphicEditorBody(params) {
  const { season, type, badgeLabel, badgeColor, ogImagePath, bannerFs, mode } = params;
  const bannerPct = (BANNER_H / CANVAS_H) * 100;

  let stripsHtml, extraOverlayHtml, headerControlsHtml, saveKeyJs;

  if (mode === 'hero') {
    const { hero, photoSlots, columnCount, maxColumns } = params;
    const stripPct = 100 / photoSlots.length;

    stripsHtml = photoSlots.map((slot, i) => photoStripHtml({
      leftPct: (i * stripPct).toFixed(4), widthPct: stripPct.toFixed(4),
      dataAttrs: `data-slot="${slot.slot}" data-default-photo="/api/player/${encodeURIComponent(params.hero._playerId || '')}/photo" data-offset-x="${slot.offsetX}" data-offset-y="${slot.offsetY}" data-zoom="${slot.zoom}"`,
      photoUrl: slot.photoUrl, shadeCss: slot.shadeCss,
    })).join('');

    // Bottom accent bar spans the full canvas in the real SVG (one <rect>, not per-photo),
    // so it's a canvas-level overlay here too, not attached to any single photo slot.
    extraOverlayHtml = `
    <div class="agr-strip__bar" style="background:${escHtml(hero.teamColor)}" aria-hidden="true"></div>
    <div class="agr-hero-text" aria-hidden="true">
      ${hero.teamName ? `<div class="agr-strip__team" style="color:${escHtml(hero.teamColor)};font-size:${hero.teamFs}cqw">${escHtml(hero.teamName)}</div>` : ''}
      <div class="agr-strip__pill" style="background:${escHtml(hero.pillColor)};color:${escHtml(hero.pillTextColor)};border-color:transparent;font-size:${hero.pillFs}cqw;height:${hero.pillHFs}cqw;margin-top:${hero.pillGap}cqw">${hero.pillIcon ? PILL_ICON_SVG[hero.pillIcon] : ''}${escHtml(hero.pillLabel)}</div>
      ${hero.statLine ? `<div class="agr-strip__stats" style="font-size:${hero.statsFs}cqw;margin-top:${hero.statsGap}cqw">${escHtml(hero.statLine)}</div>` : ''}
      <div class="agr-strip__first" style="font-size:${hero.firstFs}cqw;margin-top:${hero.firstGap}cqw">${escHtml(hero.first)}</div>
      <div class="agr-strip__last" style="font-size:${hero.lastFs}cqw;margin-top:${hero.lastGap}cqw">${escHtml(hero.last)}</div>
    </div>`;

    headerControlsHtml = `<label class="agr-grid-toggle">
        Images
        <select id="agr-col-count" class="admin-input" style="height:26px;padding:0 8px;font-size:12px;width:56px">
          ${Array.from({ length: maxColumns }, (_, i) => i + 1).map(n =>
            `<option value="${n}"${n === columnCount ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>`;
    saveKeyJs = 'slot';
  } else {
    const { columns } = params;
    const stripPct = 100 / columns.length;

    stripsHtml = columns.map((col, i) => `
    <div class="agr-strip" style="left:${(i * stripPct).toFixed(4)}%;width:${stripPct.toFixed(4)}%"
         data-player-id="${escHtml(col.player_id)}"
         data-default-photo="/api/player/${encodeURIComponent(col.player_id)}/photo"
         data-offset-x="${col.offsetX}" data-offset-y="${col.offsetY}" data-zoom="${col.zoom}">
      <div class="agr-strip__frame">
        <img class="agr-strip__img" src="${escHtml(col.photoUrl)}" alt="" draggable="false">
      </div>
      <div class="agr-strip__shade" style="background:${escHtml(col.shadeCss)}" aria-hidden="true"></div>
      <div class="agr-strip__text" aria-hidden="true">
        ${col.pillLabel ? `<div class="agr-strip__pill" style="border-color:${escHtml(col.pillColor)};color:${escHtml(col.pillColor)};font-size:${col.pillFs}cqw;height:${col.pillHFs}cqw;margin-top:${col.pillGap}cqw">${escHtml(col.pillLabel)}</div>` : ''}
        ${col.statLine ? `<div class="agr-strip__stats" style="font-size:${col.statsFs}cqw;margin-top:${col.statsGap}cqw">${escHtml(col.statLine)}</div>` : ''}
        ${col.statVal ? `<div class="agr-strip__stat-val" style="font-size:${col.statValFs}cqw;margin-top:${col.statValGap}cqw">${escHtml(col.statVal)}</div>
        <div class="agr-strip__stat-unit" style="color:${escHtml(col.pillColor)};font-size:${col.statUnitFs}cqw;margin-top:${col.statUnitGap}cqw">${escHtml(col.statUnit)}</div>` : ''}
        <div class="agr-strip__first" style="font-size:${col.firstFs}cqw;margin-top:${col.firstGap}cqw">${escHtml(col.first)}</div>
        <div class="agr-strip__last" style="font-size:${col.lastFs}cqw;margin-top:${col.lastGap}cqw">${escHtml(col.last)}</div>
      </div>
      <div class="agr-strip__bar" style="background:${escHtml(col.teamColor)}" aria-hidden="true"></div>
      <div class="agr-strip__vline" aria-hidden="true"></div>
      <div class="agr-strip__ctl">
        <button type="button" class="agr-ctl-btn" data-action="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="agr-ctl-btn" data-action="zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="agr-ctl-btn" data-action="replace" title="Replace photo for this graphic" aria-label="Replace photo">⤒</button>
        <button type="button" class="agr-ctl-btn" data-action="reset" title="Reset to default" aria-label="Reset">&#8635;</button>
      </div>
      <input type="file" class="agr-strip__file" accept="image/*" hidden>
    </div>`).join('');

    extraOverlayHtml = '';
    headerControlsHtml = '';
    saveKeyJs = null;
  }

  return `
<div class="agm-edit-bar">
  <a href="/admin/awards?season=${escHtml(String(season))}" class="agm-edit-bar__back">${ICON_CHEVRON_L} Awards</a>
  <div class="agm-edit-bar__right">
    <span id="agr-msg" class="agm-save-msg"></span>
    <button id="agr-save" class="agm-edit-bar__save">${ICON_CHECK} Save Changes</button>
  </div>
</div>

<div class="agr-wrap">
  <div class="agr-title-row">
    <div>
      <h1 class="agr-title">${escHtml(badgeLabel)} <span class="agr-title__season">Season ${escHtml(String(season))}</span></h1>
      <p class="agr-hint">${mode === 'hero'
        ? 'Drag a photo to reposition it, scroll or use +/− to zoom, or replace it. The name/stats overlay is fixed — only the photo(s) behind it can be adjusted.'
        : 'Drag a photo to reposition it, scroll or use +/− to zoom. The grid and text are fixed — only the photo behind each column can be adjusted or replaced.'}</p>
    </div>
    <div style="display:flex;align-items:center;gap:16px">
      ${headerControlsHtml}
      <label class="agr-grid-toggle">
        <input type="checkbox" id="agr-grid-check">
        Alignment grid
      </label>
    </div>
  </div>

  <div class="agr-canvas" id="agr-canvas" style="aspect-ratio:${CANVAS_W}/${CANVAS_H}">
    <div class="agr-banner" style="height:${bannerPct.toFixed(4)}%;border-bottom-color:${escHtml(badgeColor)}44">
      <div class="agr-banner__bar" style="background:${escHtml(badgeColor)}" aria-hidden="true"></div>
      <div class="agr-banner__left">
        <span class="agr-banner__eyebrow" style="color:${escHtml(badgeColor)};font-size:${bannerFs.eyebrow}cqw">WKND BASKETBALL</span>
        <span class="agr-banner__label" style="font-size:${bannerFs.title}cqw">${escHtml(badgeLabel)}</span>
      </div>
      <div class="agr-banner__right">
        <span class="agr-banner__eyebrow" style="font-size:${bannerFs.eyebrow}cqw">SEASON</span>
        <span class="agr-banner__season" style="font-size:${bannerFs.season}cqw">${escHtml(String(season))}</span>
      </div>
    </div>
    ${stripsHtml}
    ${extraOverlayHtml}
    <div class="agr-grid-overlay" aria-hidden="true">
      <div class="agr-grid-overlay__h" style="top:33.333%"></div>
      <div class="agr-grid-overlay__h" style="top:50%"></div>
      <div class="agr-grid-overlay__h" style="top:66.667%"></div>
    </div>
  </div>

  <div class="agr-preview">
    <div class="agr-preview__head">
      <span>Actual rendered image (after saving)</span>
      <button type="button" id="agr-preview-refresh" class="admin-btn admin-btn--sm">Refresh</button>
    </div>
    <img id="agr-preview-img" class="agr-preview__img" src="${escHtml(ogImagePath)}?bust=${Date.now()}" alt="">
  </div>
</div>

<script>
(function() {
  var SEASON = ${JSON.stringify(String(season))};
  var TYPE   = ${JSON.stringify(type)};
  var OG_IMAGE_PATH = ${JSON.stringify(ogImagePath)};
  var SAVE_KEY = ${JSON.stringify(saveKeyJs)}; // 'slot' for hero mode, null for grid mode (uses player_id)
  var HERO_PLAYER_ID = ${JSON.stringify(mode === 'hero' ? params.hero._playerId : null)};

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── Column/image count (hero mode only) ─────────────────────────────────────
  var colSelect = document.getElementById('agr-col-count');
  if (colSelect) {
    colSelect.addEventListener('change', function() {
      colSelect.disabled = true;
      fetch('/admin/awards/' + encodeURIComponent(SEASON) + '/' + encodeURIComponent(TYPE) + '/columns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: colSelect.value }),
      }).then(function(r) {
        if (!r.ok) throw new Error('failed');
        location.reload();
      }).catch(function() {
        colSelect.disabled = false;
        alert('Could not update image count.');
      });
    });
  }

  var GRID_KEY = 'agr-grid-visible';
  var canvas     = document.getElementById('agr-canvas');
  var gridCheck  = document.getElementById('agr-grid-check');
  var gridWanted = localStorage.getItem(GRID_KEY) === '1';
  gridCheck.checked = gridWanted;
  canvas.classList.toggle('agr-canvas--grid', gridWanted);
  gridCheck.addEventListener('change', function() {
    canvas.classList.toggle('agr-canvas--grid', gridCheck.checked);
    localStorage.setItem(GRID_KEY, gridCheck.checked ? '1' : '0');
  });

  var strips = Array.prototype.slice.call(document.querySelectorAll('.agr-strip'));
  var state  = {};
  var msg    = document.getElementById('agr-msg');

  function clearMsg() { msg.className = 'agm-save-msg'; msg.textContent = ''; }

  strips.forEach(function(strip) {
    var key       = SAVE_KEY === 'slot' ? strip.dataset.slot : strip.dataset.playerId;
    var img       = strip.querySelector('.agr-strip__img');
    var frame     = strip.querySelector('.agr-strip__frame');
    var fileInput = strip.querySelector('.agr-strip__file');

    var st = {
      offsetX: parseFloat(strip.dataset.offsetX) || 50,
      offsetY: parseFloat(strip.dataset.offsetY) || 50,
      zoom: parseFloat(strip.dataset.zoom) || 1,
      newPhotoDataUrl: null,
      clear: false,
    };
    state[key] = st;

    function applyTransform() {
      var fw = frame.clientWidth, fh = frame.clientHeight;
      if (!img.naturalWidth || !img.naturalHeight || !fw || !fh) return;
      var baseScale = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      var scale     = baseScale * st.zoom;
      var scaledW   = img.naturalWidth  * scale;
      var scaledH   = img.naturalHeight * scale;
      var maxLeft   = Math.max(0, scaledW - fw);
      var maxTop    = Math.max(0, scaledH - fh);
      var left      = maxLeft * (st.offsetX / 100);
      var top       = maxTop  * (st.offsetY / 100);
      img.style.width  = scaledW + 'px';
      img.style.height = scaledH + 'px';
      img.style.left   = (-left) + 'px';
      img.style.top    = (-top) + 'px';
    }

    if (img.complete && img.naturalWidth) applyTransform();
    img.addEventListener('load', applyTransform);
    window.addEventListener('resize', applyTransform);

    var dragging = false, startX = 0, startY = 0, startOx = 50, startOy = 50;

    function pointFromEvent(e) {
      var t = e.touches && e.touches[0];
      return { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY };
    }

    function onDown(e) {
      dragging = true;
      var p = pointFromEvent(e);
      startX = p.x; startY = p.y;
      startOx = st.offsetX; startOy = st.offsetY;
      frame.classList.add('is-dragging');
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var fw = frame.clientWidth, fh = frame.clientHeight;
      var baseScale = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      var scale = baseScale * st.zoom;
      var scaledW = img.naturalWidth * scale, scaledH = img.naturalHeight * scale;
      var maxLeft = Math.max(0, scaledW - fw), maxTop = Math.max(0, scaledH - fh);
      var p = pointFromEvent(e);
      var dx = p.x - startX, dy = p.y - startY;
      st.offsetX = maxLeft ? clamp(startOx - (dx / maxLeft) * 100, 0, 100) : 50;
      st.offsetY = maxTop  ? clamp(startOy - (dy / maxTop)  * 100, 0, 100) : 50;
      applyTransform();
      clearMsg();
    }
    function onUp() { dragging = false; frame.classList.remove('is-dragging'); }

    frame.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    frame.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    frame.addEventListener('wheel', function(e) {
      e.preventDefault();
      st.zoom = clamp(st.zoom + (e.deltaY < 0 ? 0.08 : -0.08), 1, 3);
      applyTransform();
      clearMsg();
    }, { passive: false });

    strip.querySelector('[data-action="zoom-in"]').addEventListener('click', function() {
      st.zoom = clamp(st.zoom + 0.15, 1, 3); applyTransform(); clearMsg();
    });
    strip.querySelector('[data-action="zoom-out"]').addEventListener('click', function() {
      st.zoom = clamp(st.zoom - 0.15, 1, 3); applyTransform(); clearMsg();
    });
    strip.querySelector('[data-action="reset"]').addEventListener('click', function() {
      st.offsetX = 50; st.offsetY = 50; st.zoom = 1;
      st.newPhotoDataUrl = null; st.clear = true;
      img.src = strip.dataset.defaultPhoto + '?t=' + Date.now();
      applyTransform();
      clearMsg();
    });
    strip.querySelector('[data-action="replace"]').addEventListener('click', function() {
      fileInput.click();
    });
    fileInput.addEventListener('change', function() {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        st.newPhotoDataUrl = e.target.result;
        st.clear = false;
        img.src = e.target.result;
        applyTransform();
        clearMsg();
      };
      reader.readAsDataURL(file);
    });
  });

  document.getElementById('agr-preview-refresh').addEventListener('click', function() {
    document.getElementById('agr-preview-img').src =
      OG_IMAGE_PATH + '?bust=' + Date.now();
  });

  var saveBtn = document.getElementById('agr-save');
  var saveBtnOrigHtml = saveBtn.innerHTML;

  saveBtn.addEventListener('click', function() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    var overrides = Object.keys(state).map(function(key) {
      var st = state[key];
      var item = {
        player_id: SAVE_KEY === 'slot' ? HERO_PLAYER_ID : key,
        offset_x: st.offsetX, offset_y: st.offsetY, zoom: st.zoom,
        newPhotoDataUrl: st.newPhotoDataUrl,
        clear: st.clear,
      };
      if (SAVE_KEY === 'slot') item.slot = Number(key);
      return item;
    });
    fetch('/admin/awards/' + encodeURIComponent(SEASON) + '/' + encodeURIComponent(TYPE) + '/graphic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: overrides }),
    }).then(function(r) {
      if (!r.ok) throw new Error('failed');
      msg.className = 'agm-save-msg agm-save-msg--ok';
      msg.textContent = 'Saved.';
      document.getElementById('agr-preview-img').src =
        OG_IMAGE_PATH + '?bust=' + Date.now();
    }).catch(function() {
      msg.className = 'agm-save-msg agm-save-msg--err';
      msg.textContent = 'Save failed.';
    }).finally(function() {
      saveBtn.disabled = false;
      saveBtn.innerHTML = saveBtnOrigHtml;
    });
  });
})();
</script>`;
}
