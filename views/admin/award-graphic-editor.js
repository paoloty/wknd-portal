// /admin/awards/:season/:type/graphic: the award share-image editor (admin redesign,
// 2026-10-15; mockup: canvas "Award graphic"). Rebuilt from scratch on views/admin/ui.js.
// Left: a live 1200×630 mock of the share image (Edit) or the real PNG the site serves
// (What the site shows). Right: the photos (MVP / Best Defender / Finals MVP, one player
// across 1..8 photos) or the players (team grids and stat leaders, one column each); the
// selected one opens its zoom, Replace photo…, Use profile photo and Centre it. Nothing is
// saved until Save graphic in the sticky save bar.
// Browser side (drag, zoom, nudge, photo count, save): public/admin-award-graphic.js.
// Saves go to the same routes as before: POST …/columns (photo count, hero types only) then
// POST …/graphic with only the strips that changed.
import { escHtml } from '../layout.js';
import { outlineDarkRings } from './season-teams.js';
import { pageHeader, button, badge, avatar, saveBar } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

// Fixed layout constants shared with buildOgStripPng()/buildPlayerAwardOgPng() in server.js.
// The photo tile starts at row BANNER_H and is a full H tall, so pan/zoom offsets computed
// here mean the same thing as the ones the real PNG generator applies.
const CANVAS_W = 1200, CANVAS_H = 630, BANNER_H = 72;

// Mirrors AWARD_ICON_PATH in server.js: the MVP crown / Best Defender shield in the pill.
const PILL_ICON_SVG = {
  crown:  `<svg viewBox="0 0 24 20" class="agx-pill__icon" aria-hidden="true"><path d="M2 6l4 4 6-8 6 8 4-4-2 11H4L2 6z"/></svg>`,
  shield: `<svg viewBox="0 0 24 26" class="agx-pill__icon" aria-hidden="true"><path d="M12 1l10 4v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13V5l10-4z"/></svg>`,
};

const STATE_LABEL = { profile: 'Profile photo', moved: 'Moved', replaced: 'Replaced' };
// Only a non-default photo gets a badge: gray for Moved, amber for Replaced.
const stateBadge = state => (state === 'profile' ? '' : badge(STATE_LABEL[state], state === 'replaced' ? 'amber' : 'gray'));
const stateOf = (custom, x, y, zoom) => (custom ? 'replaced'
  : Math.abs(x - 50) >= 0.5 || Math.abs(y - 50) >= 0.5 || Math.abs(zoom - 1) >= 0.01 ? 'moved' : 'profile');

// One photo strip on the mock. Everything the browser needs to edit it rides on data-*:
// the saved crop, whether a replacement photo is saved, and the profile photo to fall back to.
function strip({ key, i, n, hidden, s, shadeCss, playerId, slot, innerHtml = '' }) {
  const w = 100 / n;
  return `<div class="agx-strip${i === 0 ? ' is-first' : ''}" data-strip="${key}" data-player-id="${attr(playerId)}"${slot != null ? ` data-slot="${slot}"` : ''}
      data-ox="${s.offsetX}" data-oy="${s.offsetY}" data-zoom="${s.zoom}" data-custom="${s.custom ? 1 : 0}"
      data-src="${attr(s.photoUrl)}" data-profile="${attr(s.profileUrl)}"
      style="left:${(i * w).toFixed(4)}%;width:${w.toFixed(4)}%"${hidden ? ' hidden' : ''}>
    <div class="agx-frame"><img class="agx-img" src="${attr(s.photoUrl)}" alt="" draggable="false"></div>
    <div class="agx-shade" style="background:${attr(shadeCss)}" aria-hidden="true"></div>
    ${innerHtml}
    <div class="agx-vline" aria-hidden="true"></div>
    <span class="agx-ring" aria-hidden="true"></span>
  </div>`;
}

// One row in the side list; the selected one opens its controls.
function item({ key, hidden, thumbHtml, title, sub, state }) {
  return `<div class="agx-item" data-item="${key}"${hidden ? ' hidden' : ''}>
    <div class="agx-item__row">
      <button type="button" class="agx-item__pick" data-pick="${key}" aria-expanded="false">
        ${thumbHtml}
        <span class="agx-item__text"><span class="agx-item__title">${escHtml(title)}</span><span class="agx-item__sub"><span>${escHtml(sub)}</span><span class="agx-item__dirty" data-dirty-note hidden> · unsaved</span></span></span>
      </button>
      <span data-state-badge>${stateBadge(state)}</span>
    </div>
    <div class="agx-item__body" data-item-body hidden>
      <div class="agx-zoom">
        <div class="aui-row-between"><label class="agx-zoom__label" for="agx-zoom-${key}">Zoom <b data-zoom-label>1.00×</b></label>${button('Centre it', { kind: 'ghost', size: 'sm', attrs: 'data-act="centre"' })}</div>
        <input type="range" class="agx-range" id="agx-zoom-${key}" min="100" max="300" step="5" value="100" data-zoom-range aria-label="Zoom ${attr(title)}">
      </div>
      <div class="aui-row">
        ${button('Replace photo…', { size: 'sm', attrs: 'data-act="replace"' })}
        ${button('Use profile photo', { size: 'sm', attrs: 'data-act="profile"' })}
      </div>
    </div>
  </div>`;
}

export function awardGraphicEditorBody(p) {
  const { season, type, mode, title, badgeLabel, badgeColor, ogImagePath, bannerFs, ver = '' } = p;
  const hero = mode === 'hero';
  const bannerPct = (BANNER_H / CANVAS_H) * 100;

  let stripsHtml, overlayHtml = '', itemsHtml, countHtml = '', config;

  if (hero) {
    const { hero: h, slots, columnCount, maxColumns, shadeOne, shadeMany } = p;
    stripsHtml = slots.map((s, i) => strip({
      key: i, i, n: columnCount, hidden: i >= columnCount, s, slot: i, playerId: h.playerId,
      shadeCss: columnCount > 1 ? shadeMany : shadeOne,
    })).join('');
    // The bottom bar and the name/pill/stats are drawn once across the whole image, on top
    // of every photo, exactly like the real SVG overlay.
    overlayHtml = `
    <div class="agx-bar" style="background:${attr(h.teamColor)}" aria-hidden="true"></div>
    <div class="agx-text agx-text--hero" aria-hidden="true">
      ${h.teamName ? `<div class="agx-t-team" style="color:${attr(h.teamColor)};font-size:${h.teamFs}cqw">${escHtml(h.teamName)}</div>` : ''}
      <div class="agx-pill" style="background:${attr(h.pillColor)};color:${attr(h.pillTextColor)};border-color:transparent;font-size:${h.pillFs}cqw;height:${h.pillHFs}cqw;margin-top:${h.pillGap}cqw">${h.pillIcon ? PILL_ICON_SVG[h.pillIcon] : ''}${escHtml(h.pillLabel)}</div>
      ${h.statLine ? `<div class="agx-t-stats" style="font-size:${h.statsFs}cqw;margin-top:${h.statsGap}cqw">${escHtml(h.statLine)}</div>` : ''}
      <div class="agx-t-first" style="font-size:${h.firstFs}cqw;margin-top:${h.firstGap}cqw">${escHtml(h.first)}</div>
      <div class="agx-t-last" style="font-size:${h.lastFs}cqw;margin-top:${h.lastGap}cqw">${escHtml(h.last)}</div>
    </div>`;
    itemsHtml = slots.map((s, i) => item({
      key: i, hidden: i >= columnCount,
      thumbHtml: `<span class="agx-num" aria-hidden="true">${i + 1}</span>`,
      title: `Photo ${i + 1}`, sub: h.displayName,
      state: stateOf(s.custom, s.offsetX, s.offsetY, s.zoom),
    })).join('');
    countHtml = `<div class="aui-panel agx-count-panel">
      <div class="agx-panel-title">Photos across the image</div>
      <div class="aui-seg agx-count" role="radiogroup" aria-label="Number of photos">${Array.from({ length: maxColumns }, (_, i) => i + 1).map(n =>
        `<button type="button" role="radio" data-count="${n}" aria-checked="${n === columnCount}" aria-selected="${n === columnCount}">${n}</button>`).join('')}</div>
      <p class="agx-note">Changing this keeps your other edits. Photos past the new count are dropped when you save.</p>
    </div>`;
    config = { season: String(season), type, mode, playerId: h.playerId, count: columnCount, shadeOne, shadeMany, og: ogImagePath };
  } else {
    const { columns } = p;
    stripsHtml = columns.map((c, i) => strip({
      key: i, i, n: columns.length, s: c, playerId: c.player_id, shadeCss: c.shadeCss,
      innerHtml: `<div class="agx-text" aria-hidden="true">
        ${c.pillLabel ? `<div class="agx-pill" style="border-color:${attr(c.pillColor)};color:${attr(c.pillColor)};font-size:${c.pillFs}cqw;height:${c.pillHFs}cqw;margin-top:${c.pillGap}cqw">${escHtml(c.pillLabel)}</div>` : ''}
        ${c.statLine ? `<div class="agx-t-stats" style="font-size:${c.statsFs}cqw;margin-top:${c.statsGap}cqw">${escHtml(c.statLine)}</div>` : ''}
        ${c.statVal ? `<div class="agx-t-val" style="font-size:${c.statValFs}cqw;margin-top:${c.statValGap}cqw">${escHtml(c.statVal)}</div>
        <div class="agx-t-unit" style="color:${attr(c.pillColor)};font-size:${c.statUnitFs}cqw;margin-top:${c.statUnitGap}cqw">${escHtml(c.statUnit)}</div>` : ''}
        <div class="agx-t-first" style="font-size:${c.firstFs}cqw;margin-top:${c.firstGap}cqw">${escHtml(c.first)}</div>
        <div class="agx-t-last" style="font-size:${c.lastFs}cqw;margin-top:${c.lastGap}cqw">${escHtml(c.last)}</div>
      </div>
      <div class="agx-bar" style="background:${attr(c.teamColor)}" aria-hidden="true"></div>`,
    })).join('');
    // Stat leaders: one player can lead two stats. Photo overrides are keyed by player
    // (award_photo_overrides: season, award_type, player_id, slot=0), so those two columns
    // share one crop/photo; the browser mirrors an edit onto both so the mock shows what
    // the real PNG will. Splitting them would need a per-column key (a schema change).
    const seen = {};
    itemsHtml = columns.map((c, i) => {
      const twin = seen[c.player_id];
      seen[c.player_id] = seen[c.player_id] || c.label;
      return item({
        key: i,
        thumbHtml: avatar(c.displayName, c.teamColor, { size: 36, playerId: c.player_id }),
        title: c.displayName,
        sub: twin ? `${c.label} · same photo as ${twin}` : c.label,
        state: stateOf(c.custom, c.offsetX, c.offsetY, c.zoom),
      });
    }).join('');
    config = { season: String(season), type, mode, count: columns.length, og: ogImagePath };
  }

  const hint = hero
    ? 'One player across up to 8 photos. The name, pill and stats are drawn once on top.'
    : type === 'stat-leaders'
      ? 'One column per stat leader, each with its own name and number.'
      : 'One column per player, each with its own name, position and stat line.';

  return outlineDarkRings(`<div class="aui-page agx" id="agx" data-config="${attr(JSON.stringify(config))}">
    <nav class="aui-crumbs" aria-label="Back"><a href="/admin/awards/season?season=${encodeURIComponent(season)}">← Season awards</a></nav>
    ${pageHeader({
      eyebrow: `Award graphic · Season ${season}`, title, sub: hint,
      actionsHtml: button('Open share image ↗', { href: ogImagePath, attrs: 'target="_blank" rel="noopener"' }),
    })}
    <div class="aui-cols">
      <section class="aui-cols__main agx-main" aria-label="Graphic">
        <div class="aui-row-between">
          <div class="aui-seg agx-views" role="tablist" aria-label="View">
            <button type="button" role="tab" data-view="edit" aria-selected="true">Edit</button>
            <button type="button" role="tab" data-view="site" aria-selected="false">What the site shows</button>
          </div>
          <label class="aui-check agx-gridcheck" data-view-only="edit"><input type="checkbox" data-grid-toggle>Alignment grid</label>
        </div>

        <div class="agx-pane" data-pane="edit">
          <div class="agx-canvas" id="agx-canvas" tabindex="0" aria-label="Live preview. Arrow keys nudge the selected photo." style="aspect-ratio:${CANVAS_W}/${CANVAS_H}">
            <div class="agx-banner" style="height:${bannerPct.toFixed(4)}%;border-bottom-color:${attr(badgeColor)}44" aria-hidden="true">
              <div class="agx-banner__bar" style="background:${attr(badgeColor)}"></div>
              <div class="agx-banner__side">
                <span class="agx-banner__eyebrow" style="color:${attr(badgeColor)};font-size:${bannerFs.eyebrow}cqw">WKND BASKETBALL</span>
                <span class="agx-banner__label" style="font-size:${bannerFs.title}cqw">${escHtml(badgeLabel)}</span>
              </div>
              <div class="agx-banner__side is-end">
                <span class="agx-banner__eyebrow" style="font-size:${bannerFs.eyebrow}cqw">SEASON</span>
                <span class="agx-banner__season" style="font-size:${bannerFs.season}cqw">${escHtml(String(season))}</span>
              </div>
            </div>
            ${stripsHtml}
            ${overlayHtml}
            <div class="agx-guides" aria-hidden="true"><i style="top:33.333%"></i><i style="top:50%"></i><i style="top:66.667%"></i></div>
          </div>
          <p class="agx-note">Drag a photo to move it · zoom with the slider, or scroll over the selected photo · arrow keys nudge it by 1%.</p>
        </div>

        <div class="agx-pane" data-pane="site" hidden>
          <img class="agx-real" data-real alt="The share image as the site serves it" width="${CANVAS_W}" height="${CANVAS_H}">
          <div class="aui-row-between agx-note"><span>This is the file the site shares. It updates when you save.</span>${button('Refresh', { size: 'sm', attrs: 'data-real-refresh' })}</div>
        </div>
      </section>

      <aside class="aui-cols__side agx-side" aria-label="Photos">
        ${countHtml}
        <div class="aui-panel agx-list">
          <div class="agx-list__title">${hero ? 'Photos' : 'Players'}</div>
          ${itemsHtml}
        </div>
      </aside>
    </div>

    <form id="agx-form" class="agx-form" novalidate></form>
    ${saveBar({ label: 'Save graphic', form: 'agx-form' })}
    <input type="file" accept="image/*" data-file hidden>
  </div>
  <script src="/admin-award-graphic.js${ver ? `?v=${ver}` : ''}" defer></script>`);
}
