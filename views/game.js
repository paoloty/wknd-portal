import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials, playerAvatar, playerLink, stripEmptyParagraphs } from './utils.js';
import { parseWriteup } from '../lib/writeup.js';
import { gameSlug } from '../lib/slugs.js';
import { pickBox, pickBoxScript, talkLink } from './pick-box.js';
import { pickAvatar, dot, tc, shortDayLabel, matchupScript, edgeRow, oddsLine, scorerCard, meetingTile, storyHtml } from './games.js';
import { flowChart, teamTotals, castLine, shortName } from '../lib/game-detail.js';


function youtubeEmbedUrl(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

// ── "Share My Stats" banner + modal ──────────────────────────────────────────
// Only rendered when the viewer's own player_id has a stat row in this game
// (gamePage computes myStat from currentPlayerId) — the PNG endpoint re-checks
// the session server-side too, so this is a UI gate, not the real one.
function shareStatsBanner(game, stat) {
  const pts   = Number(stat.pts) || 0;
  const reb   = Number(stat.reb) || 0;
  const ast   = Number(stat.ast) || 0;
  const stl   = Number(stat.stl) || 0;
  const blk   = Number(stat.blk) || 0;
  const fg3m  = Number(stat.fg3m) || 0;
  const color = escHtml(stat.team_color || '#f59332');
  const gameId = escHtml(game.id);

  // Personalizes the default "Focus" pick to this player's own box score
  // instead of always opening on All-Around — a rough offense-vs-defense
  // signal (ast+3PM vs stl+blk), not a precise ranking, just enough that a
  // defensive night doesn't default to a PTS/REB/AST row nobody asked for.
  const offenseScore = ast + fg3m;
  const defenseScore = stl + blk;
  let defaultFocus = 'all';
  if (defenseScore >= 4 && defenseScore > offenseScore) defaultFocus = 'defense';
  else if (offenseScore >= 6) defaultFocus = 'offense';

  // All six are public now — no per-template release gating (there used to
  // be a template_<key>_public site_settings flag per template, toggled on
  // /admin/visibility, with an admin-only bypass; removed in favor of
  // shipping everything live). Keys ('left'/'bottom'/etc.) are unchanged —
  // only the labels shown here are new — since they're load-bearing:
  // server.js's route dispatch, the PNG cache key, and stat-card-action
  // logging all match on the key, not the label.
  //
  // Premium respects Hide Zeros just like Lower Third/Box Score, but ignores
  // Focus (it ranks all 6 count stats by value instead of picking 3 by
  // category), the Gauges toggle, and alignment — same "controls stay
  // visible but some have nothing to affect" pattern as Box Score already
  // ignoring alignment. See generateGameStatPremiumPng's own comment for why
  // it's a different visual language entirely from the other templates.
  //
  // Hero/Card/Scoreboard each ignore Focus/Gauges/Hide Zeros the same way
  // Premium does (see generateGameStatPremiumPng's own comment) — each picks
  // its own fixed stat set (Hero: single highest count stat; Card/Scoreboard:
  // top 4/3 by value) rather than anything Focus-driven.
  const TEMPLATE_OPTIONS = [
    { key: 'left',       label: 'Marquee Left' },
    { key: 'center',     label: 'Marquee Center' },
    { key: 'right',      label: 'Marquee Right' },
    { key: 'bottom',     label: 'Lower Third' },
    { key: 'stacked',    label: 'Box Score' },
    { key: 'premium',    label: 'Premium' },
    { key: 'hero',       label: 'Hero' },
    { key: 'card',       label: 'Card' },
    { key: 'scoreboard', label: 'Scoreboard' },
  ];
  const FOCUS_OPTIONS = [
    { key: 'all',     label: 'All-Around' },
    { key: 'offense', label: 'Offense' },
    { key: 'defense', label: 'Defense' },
  ];
  // Chip list shared by the Template and Focus sheet panels — a flat row of
  // pill buttons instead of a dropdown menu, since these now live inside an
  // already-open sheet rather than needing their own floating popover.
  function chipList(options, activeKey) {
    const active = options.find(o => o.key === activeKey) || options[0];
    return options.map(o => `<button type="button" class="ssc-chip${o.key === active.key ? ' is-active' : ''}" data-value="${o.key}">${escHtml(o.label)}</button>`).join('\n');
  }

  const iconTemplate = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>`;
  const iconFocus    = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`;
  // Mirrors iconSave's shape (below) but flipped — an up-arrow into a top bar
  // instead of a down-arrow into a bottom one — so the two read as visual
  // opposites (send out vs. bring in) despite living in different panels now.
  const iconPublish  = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></svg>`;

  const iconSave  =`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
  const iconCopy  = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
  const iconShare = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`;

  return `<div class="share-stats-banner card" style="--ssb-color:${color}">
  <div class="share-stats-banner__info">
    <span class="share-stats-banner__eyebrow">YOUR LINE</span>
    <span class="share-stats-banner__stats">${pts} PTS · ${reb} REB · ${ast} AST</span>
  </div>
  <button type="button" class="share-stats-banner__btn" id="ssc-open-btn">Share My Stats</button>
</div>

<div class="pcp-backdrop ssc-backdrop" id="ssc-backdrop" hidden>
  <div class="pcp-modal ssc-modal">
    <div class="pcp-modal__header ssc-header">
      <span class="pcp-modal__title">Share My Stats</span>
      <button class="pcp-modal__close" id="ssc-close">&#x2715;</button>
    </div>
    <div class="ssc-preview">
      <div class="ssc-spinner" id="ssc-spinner"></div>
      <img id="ssc-img" alt="Your stat card" hidden>
    </div>
    <div class="ssc-controls">
      <!-- Compact, CapCut/Instagram-style toolbar: icon buttons instead of
           always-visible dropdowns/swatches/action row, so the preview above
           gets most of the modal's height by default. Tapping one slides the
           matching panel up from directly below the toolbar (see .ssc-sheet's
           grid-rows transition in the <style> below); tapping it again,
           picking a Template/Focus chip, or tapping the preview all collapse
           it back down — see the script for exactly which of those
           auto-close. Save/Copy/Share live in Publish's panel rather than
           floating over the art — that used to still sit on top of Bottom's
           and Premium's own bottom-anchored content no matter which edge it
           floated against; a sheet panel like every other tool doesn't have
           that problem, since it only ever covers the (otherwise empty)
           controls area, never the art itself. -->
      <div class="ssc-toolbar">
        <button type="button" class="ssc-tool-btn" id="ssc-tool-template" data-target="template">
          ${iconTemplate}<span>Template</span>
        </button>
        <button type="button" class="ssc-tool-btn" id="ssc-tool-focus" data-target="focus">
          ${iconFocus}<span>Focus</span>
        </button>
        <button type="button" class="ssc-tool-btn" id="ssc-tool-accent" data-target="accent">
          <span class="ssc-tool-btn__dot" id="ssc-tool-accent-dot" style="--swatch:#f59332"></span><span>Style</span>
        </button>
        <button type="button" class="ssc-tool-btn" id="ssc-tool-publish" data-target="publish">
          ${iconPublish}<span>Publish</span>
        </button>
      </div>
      <div class="ssc-sheet" id="ssc-sheet">
        <div class="ssc-sheet__inner">
          <!-- max-height + overflow-y:auto on each panel (not just this one) is
               deliberate headroom for Template/Focus growing past what fits in
               one unscrolled chip row — the sheet's own height still animates
               smoothly via .ssc-sheet's grid-rows transition either way, since
               that trick only cares about the panel's natural (possibly now
               scrollable) content height, not each individual chip. -->
          <div class="ssc-sheet__panel" id="ssc-panel-template">
            <div class="ssc-chip-row">${chipList(TEMPLATE_OPTIONS, 'center')}</div>
          </div>
          <div class="ssc-sheet__panel" id="ssc-panel-focus" hidden>
            <div class="ssc-chip-row">${chipList(FOCUS_OPTIONS, defaultFocus)}</div>
          </div>
          <div class="ssc-sheet__panel" id="ssc-panel-accent" hidden>
            <!-- Toggles ride along with the swatches (not their own panel) — same
                 "Style" grouping as before, just inside a sheet now instead of its
                 own always-visible row. -->
            <div class="ssc-accent-row">
              <div class="ssc-swatches" role="tablist" aria-label="Accent color">
                <button type="button" class="ssc-swatch-btn is-active" data-accent="amber" title="Amber" style="--swatch:#f59332"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="red" title="Red" style="--swatch:#ef4444"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="blue" title="Blue" style="--swatch:#3b82f6"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="green" title="Green" style="--swatch:#22c55e"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="purple" title="Purple" style="--swatch:#a78bfa"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="pink" title="Pink" style="--swatch:#f472b6"></button>
                <button type="button" class="ssc-swatch-btn" data-accent="cyan" title="Cyan" style="--swatch:#22d3ee"></button>
              </div>
              <div class="ssc-toggle-group">
                <button type="button" class="ssc-toggle" id="ssc-gauges-toggle" aria-pressed="true" title="Show shooting gauges">
                  <span class="ssc-toggle__switch"></span>
                  Gauges
                </button>
                <button type="button" class="ssc-toggle" id="ssc-hidezeros-toggle" aria-pressed="false" title="Hide stats with no attempts or a zero value">
                  <span class="ssc-toggle__switch"></span>
                  Hide Zeros
                </button>
                <!-- Add-on overlay, not a template of its own — composited onto
                     whichever Template is picked (see composeStravagantBadgeOverlay
                     in server.js). Off by default: it renders nothing at all for a
                     game with no double-double/triple-double/career-high, so an
                     "on" state that visibly does nothing most games would be a
                     confusing default. -->
                <button type="button" class="ssc-toggle" id="ssc-badge-toggle" aria-pressed="false" title="Add an achievement badge (double-double, triple-double, or career high) when this game earned one">
                  <span class="ssc-toggle__switch"></span>
                  Badge
                </button>
              </div>
            </div>
          </div>
          <div class="ssc-sheet__panel" id="ssc-panel-publish" hidden>
            <div class="ssc-actions">
              <button type="button" class="ssc-action-btn" id="ssc-save">${iconSave}<span>Save</span></button>
              <button type="button" class="ssc-action-btn" id="ssc-copy">${iconCopy}<span>Copy</span></button>
              <button type="button" class="ssc-action-btn ssc-action-btn--primary" id="ssc-share">${iconShare}<span>Share</span></button>
            </div>
          </div>
        </div>
      </div>
      <div id="ssc-msg" class="ssc-msg" hidden></div>
    </div>
  </div>
</div>

<style>
.share-stats-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-top: 3px solid var(--ssb-color); }
.share-stats-banner__info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.share-stats-banner__eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--text-muted); }
.share-stats-banner__stats { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; }
.share-stats-banner__btn { flex-shrink: 0; padding: 10px 18px; border-radius: var(--radius-sm); background: var(--amber); border: none; color: #0a0e16; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity .12s; }
.share-stats-banner__btn:hover { opacity: .88; }

/* overflow-y: auto (not the shared .pcp-modal's overflow: hidden) is a safety net for
   short viewports — the height-driven sizing below should make the whole modal fit
   without scrolling on virtually any phone, but a tall system font size or unusual
   browser chrome shouldn't be able to strand the action row off-screen. */
.ssc-modal { max-width: 360px; overflow-y: auto; }
.ssc-preview {
  position: relative; aspect-ratio: 1080 / 1920; display: flex; align-items: center; justify-content: center;
  /* Sized from height, not width: 100% — a 9:16 box that always fills the modal's width
     runs 600px+ tall on a narrow phone, which used to push the Save/Copy/Share row past
     the modal's max-height and get clipped. Driving size from height (capped to a share
     of the viewport) and letting width follow the aspect ratio keeps the whole modal,
     buttons included, on-screen. align-self: center overrides the modal's own
     align-items: stretch (its default, from the shared .pcp-modal class) — without it
     this box silently stretches to the modal's full width instead of the narrow,
     aspect-ratio-driven shape these values are trying to produce. */
  height: min(46dvh, 400px); max-width: 100%; width: auto; margin: 0 auto; align-self: center;
  /* Transparency checkerboard — the gauges card (like the other templates) is
     a transparent overlay meant to sit over a photo/video the player picks
     themselves, so this honestly represents what's see-through vs. drawn. */
  background-color: #1a1a1a;
  background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 24px 24px; background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}
.ssc-preview img { width: 100%; height: 100%; object-fit: contain; }
/* Desktop/tablet gets a bigger ceiling than the mobile-safe defaults above — a
   phone viewport's dvh is scarce and shared with browser chrome, but a desktop
   window has plenty of both width and height to spare, so the fixed 400px cap
   above (sized for the tightest phones) left it looking tiny. Gated on width,
   not just height, so a short phone in landscape doesn't get the bigger cap. */
@media (min-width: 640px) {
  .ssc-modal { max-width: 460px; }
  .ssc-preview { height: min(70dvh, 760px); }
}
/* Below 640px, the modal takes over the whole screen instead of floating as a
   small card. Previously the preview filled the entire viewport with the
   header/controls floating on top of it (gradient-backed, story-editor style)
   — but this preview is just a checkerboard, not a real photo, so a taller
   controls panel (more rows added since) just ate into that overlap with no
   way for the art to know its available space had shrunk, leaving the art
   sitting too close to the controls or too far from them depending on how
   much content the controls row happened to have. A real stacked flex column
   — header, then art, then controls, each getting genuine layout space —
   keeps the art centered in whatever room is actually left over, and (via
   overflow:hidden on the modal) means the sheet never scrolls either. */
@media (max-width: 639px) {
  .ssc-backdrop { padding: 0; }
  /* max-height: none overrides the shared .pcp-modal class's own max-height:
     90dvh (public/styles.css) — every OTHER modal on the site wants that cap
     (so it never touches the screen edges), but this one is deliberately going
     full-screen, and that inherited 90dvh cap was exactly the bug: it left a
     10%-of-screen gap at the bottom with the page peeking through beneath the
     action row. inset: 0 alone (no explicit width/height) is also the more
     robust way to size a fixed full-screen element than 100vw/100dvh, which can
     lose to inset by a hair depending on how a given browser resolves dvh. */
  /* overflow: hidden overrides this file's own base .ssc-modal rule above
     (overflow-y: auto) — flex-direction/display themselves already come from
     the shared .pcp-modal class (public/styles.css), no need to restate them. */
  .ssc-modal { position: fixed; inset: 0; max-width: none; max-height: none; border-radius: 0; overflow: hidden; }
  /* flex: 1 + min-height: 0 — takes exactly whatever room is left after the
     header and controls claim their own (content-driven) heights, instead of
     assuming a fixed viewport share. min-height: 0 is the part that's easy to
     forget: without it a flex child won't shrink below its content size, and
     an aspect-ratio'd/large image would blow the column out and force a
     scrollbar right back in. */
  .ssc-preview { position: relative; flex: 1; min-height: 0; height: auto; max-width: none; width: 100%; margin: 0; overflow: hidden; }
  /* object-fit: cover (not contain) here — these templates aren't full-bleed,
     their content sits in one portion of the 1080x1920 canvas with
     transparent space above/below by design (an overlay sticker, not a
     poster), so "contain" just letterboxes the preview with empty margins on
     whichever side the box's aspect ratio doesn't match. "cover" scales up
     until the box is completely filled and crops the excess (equally off top
     +bottom or left+right, centered) — this is a display-only crop, the
     underlying image is untouched, so Save/Copy/Share still send the full,
     uncropped PNG. */
  .ssc-preview img { object-fit: cover; }
  /* Safe-area padding so the edge-to-edge header/controls don't sit under a
     notch/Dynamic Island or the home-indicator gesture bar on iPhones — a no-op
     (env() resolves to 0) on devices without either. */
  .ssc-header { flex-shrink: 0; padding-top: env(safe-area-inset-top); }
  .ssc-controls { flex-shrink: 0; padding-bottom: env(safe-area-inset-bottom); }
}
/* Absolutely positioned against .ssc-preview (position: relative/absolute in every
   mode) rather than relying on the preview's flex centering — keeps it dead-center
   regardless of how that box ends up sized/stretched. */
.ssc-spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); border-top-color: var(--amber); animation: ssc-spin .8s linear infinite; }
@keyframes ssc-spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
/* Compact icon-row + slide-up sheet, replacing the old always-visible
   dropdowns/swatches row — CapCut/Instagram-editor style, so the preview
   above keeps most of the modal's height until a control is actually opened.
   .ssc-sheet's grid-template-rows 0fr→1fr transition is what gives the "slide
   up" feel without any JS height math: a 0fr row genuinely takes no space
   (unlike max-height:0, it doesn't need a guessed cap), and animating to 1fr
   lets it grow to its content's natural height. .ssc-sheet__inner's
   overflow:hidden is required for that trick — a grid row can't clip its own
   overflow during the transition otherwise. */
.ssc-toolbar { display: flex; gap: 4px; padding: 10px 16px 0; }
.ssc-tool-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: var(--radius-sm); background: none; border: 1px solid transparent; color: var(--text-muted); font-size: 11px; font-weight: 700; cursor: pointer; transition: background .12s, color .12s, border-color .12s; }
.ssc-tool-btn:hover { color: var(--text); }
.ssc-tool-btn.is-active { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.16); color: var(--text); }
.ssc-tool-btn__dot { width: 18px; height: 18px; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3); }
.ssc-sheet { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .22s ease; }
.ssc-sheet.is-open { grid-template-rows: 1fr; }
.ssc-sheet__inner { overflow: hidden; min-height: 0; }
/* max-height + overflow-y:auto is headroom for Template/Focus growing past
   what fits in one unscrolled chip row — the panel's own scrollbar handles
   the overflow instead of the whole modal growing (and, on desktop, instead
   of .ssc-modal's own overflow-y:auto scrolling the toolbar/preview out of
   view along with it). The grid-rows trick above still works the same either
   way: it just animates to this capped height rather than an ever-growing
   one once a panel has more content than fits. */
.ssc-sheet__panel { padding: 12px 16px 2px; max-height: 200px; overflow-y: auto; }
.ssc-sheet__panel[hidden] { display: none; }
.ssc-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ssc-chip { padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); color: var(--text-muted); font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.ssc-chip:hover { color: var(--text); }
.ssc-chip.is-active { background: var(--amber); border-color: transparent; color: #0a0e16; }
/* Single row, deliberately — swatches and toggles used to wrap onto their own
   line on narrower phones once both were at full size. flex-wrap: nowrap
   forces one line always; overflow-x: auto is the safety valve for whatever
   width that still doesn't fit on (a scrollable row still reads as "one
   line" — it just isn't all in view at once — whereas wrapping visibly
   becomes two). Tightened swatch/toggle sizing (below) means that scroll
   only actually kicks in on the narrowest phones; most widths show the whole
   row without any cropping or scrolling at all. */
.ssc-accent-row { display: flex; align-items: center; gap: 14px; flex-wrap: nowrap; overflow-x: auto; }
.ssc-swatches { display: flex; gap: 7px; flex-shrink: 0; }
.ssc-toggle-group { display: flex; gap: 10px; flex-shrink: 0; }
.ssc-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; padding: 4px 0; color: var(--text-muted); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.ssc-toggle:hover { color: var(--text); }
.ssc-toggle__switch { position: relative; width: 30px; height: 18px; border-radius: 999px; background: rgba(255,255,255,0.16); transition: background .12s; flex-shrink: 0; }
.ssc-toggle__switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .12s; }
.ssc-toggle[aria-pressed="true"] .ssc-toggle__switch { background: var(--amber); }
.ssc-toggle[aria-pressed="true"] .ssc-toggle__switch::after { transform: translateX(12px); }
.ssc-toggle[aria-pressed="true"] { color: var(--text); }
.ssc-swatch-btn { width: 22px; height: 22px; border-radius: 50%; background: var(--swatch); border: 2px solid transparent; padding: 0; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25); transition: transform .12s, border-color .12s; flex-shrink: 0; }
.ssc-swatch-btn:hover { transform: scale(1.1); }
.ssc-swatch-btn.is-active { border-color: #fff; }
.ssc-msg { padding: 8px 16px 0; font-size: 12px; color: var(--text-muted); text-align: center; }
.ssc-msg--retry { color: var(--amber); font-weight: 700; text-decoration: underline; cursor: pointer; }
.ssc-actions { display: flex; gap: 8px; }
.ssc-action-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; border-radius: var(--radius-sm); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .12s; }
.ssc-action-btn:hover { background: rgba(255,255,255,0.18); }
.ssc-action-btn--primary { background: var(--amber); border-color: transparent; color: #0a0e16; }
.ssc-action-btn--primary:hover { opacity: .88; background: var(--amber); }
</style>

<script>
(function() {
  var GAME_ID  = '${gameId}';
  var openBtn  = document.getElementById('ssc-open-btn');
  var backdrop = document.getElementById('ssc-backdrop');
  var closeBtn = document.getElementById('ssc-close');
  var img      = document.getElementById('ssc-img');
  var spinner  = document.getElementById('ssc-spinner');
  var msg      = document.getElementById('ssc-msg');
  var saveBtn  = document.getElementById('ssc-save');
  var copyBtn  = document.getElementById('ssc-copy');
  var shareBtn = document.getElementById('ssc-share');
  var swatchBtns   = Array.prototype.slice.call(document.querySelectorAll('.ssc-swatch-btn'));
  var gaugesToggle = document.getElementById('ssc-gauges-toggle');
  var hideZerosToggle = document.getElementById('ssc-hidezeros-toggle');
  var badgeToggle = document.getElementById('ssc-badge-toggle');
  var accentDot    = document.getElementById('ssc-tool-accent-dot');
  var cache = {};
  var pending = {};
  var align = 'center';
  var accent = 'amber';
  var gaugesOn = true;
  var hideZerosOn = false;
  var badgeOn = false;
  // The server already picked and marked the best opening Focus chip
  // (personalized to this player's own box score — see shareStatsBanner in
  // game.js) — read whichever chip it marked active instead of recomputing.
  function activeChipValue(panelId) {
    var chip = document.querySelector('#' + panelId + ' .ssc-chip.is-active') || document.querySelector('#' + panelId + ' .ssc-chip');
    return chip.getAttribute('data-value');
  }
  var focus = activeChipValue('ssc-panel-focus');

  // Compact icon toolbar + slide-up sheet (CapCut/Instagram-editor style,
  // replacing the old always-visible dropdowns/swatches) — only one panel
  // shown at a time, sheet fully collapsed when nothing's open so the
  // preview above keeps as much of the modal's height as possible.
  var toolBtns = Array.prototype.slice.call(document.querySelectorAll('.ssc-tool-btn'));
  var sheet    = document.getElementById('ssc-sheet');
  var panels   = {
    template: document.getElementById('ssc-panel-template'),
    focus:    document.getElementById('ssc-panel-focus'),
    accent:   document.getElementById('ssc-panel-accent'),
    publish:  document.getElementById('ssc-panel-publish'),
  };
  var openTarget = null;
  function closeSheet() {
    sheet.classList.remove('is-open');
    toolBtns.forEach(function(b) { b.classList.remove('is-active'); });
    openTarget = null;
  }
  function openSheet(target) {
    Object.keys(panels).forEach(function(k) { panels[k].hidden = k !== target; });
    sheet.classList.add('is-open');
    toolBtns.forEach(function(b) { b.classList.toggle('is-active', b.getAttribute('data-target') === target); });
    openTarget = target;
  }
  toolBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = btn.getAttribute('data-target');
      if (openTarget === target) closeSheet(); else openSheet(target);
    });
  });
  // Tapping the preview itself (not just the toolbar) is the other way to
  // dismiss an open panel — the same "tap outside to close" instinct the old
  // dropdown's document-click listener gave, scoped to the one place in this
  // modal that isn't already an interactive control.
  document.querySelector('.ssc-preview').addEventListener('click', function() {
    if (openTarget) closeSheet();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && openTarget) closeSheet();
  });

  // Chip controller shared by the Template and Focus panels — Template/Focus
  // auto-close the sheet on pick (single choice, quick in-and-out), but
  // Accent's swatches/toggles don't (see their own listeners below) since
  // trying a few colors in a row is the whole point of that panel.
  function setupChips(panelId, onChange) {
    var panel = panels[panelId];
    var chips = Array.prototype.slice.call(panel.querySelectorAll('.ssc-chip'));
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        chips.forEach(function(c) { c.classList.toggle('is-active', c === chip); });
        clearMsg();
        onChange(chip.getAttribute('data-value'));
        closeSheet();
      });
    });
  }
  // The mobile full-screen preview crops to fill (object-fit: cover, set in
  // this file's <style>) since these cards aren't full-bleed — their content
  // sits in one region of the 1080x1920 canvas, not spread edge-to-edge. A
  // symmetric center-crop is correct for every vertically-centered template,
  // but Bottom's and Premium's content both hug the bottom edge (see
  // generateGameStatPremiumPng's own comments), so centering the crop there
  // would risk shaving into it from below while leaving untouched transparent
  // space at the top. Anchoring the crop to the bottom for those two
  // templates guarantees only the (empty) top gets cropped instead.
  var BOTTOM_ANCHORED_TEMPLATES = ['bottom', 'premium', 'hero', 'scoreboard'];
  function applyPreviewCropAnchor() {
    img.style.objectPosition = BOTTOM_ANCHORED_TEMPLATES.indexOf(align) !== -1 ? 'center bottom' : 'center center';
  }
  applyPreviewCropAnchor();

  setupChips('template', function(v) { align = v; applyPreviewCropAnchor(); render(); });
  setupChips('focus', function(v) { focus = v; render(); });

  function cacheKey(a, f, c, g, hz, b) { return [a, f, c, g, hz, b].join('|'); }
  function buildUrl(a, f, c, g, hz, b) {
    var params = ['layout=gauges', 'align=' + encodeURIComponent(a), 'focus=' + encodeURIComponent(f), 'accent=' + encodeURIComponent(c), 'gauges=' + (g ? '1' : '0'), 'hidezeros=' + (hz ? '1' : '0'), 'badge=' + (b ? '1' : '0')];
    return '/api/games/' + GAME_ID + '/my-stat-card.png?' + params.join('&');
  }
  function currentKey() { return cacheKey(align, focus, accent, gaugesOn, hideZerosOn, badgeOn); }

  // retry: true marks this message as tappable-to-retry (load failures only —
  // "Copied to clipboard" etc. shouldn't be clickable). Re-clicking an
  // already-active control is the "obvious" retry, but a control that's
  // already selected doesn't look clickable to re-try — making the error
  // message itself the retry action means there's always a guaranteed,
  // discoverable way to re-fire the request for whatever's currently picked.
  function showMsg(text, retry) {
    msg.textContent = text;
    msg.hidden = false;
    msg.classList.toggle('ssc-msg--retry', !!retry);
  }
  function clearMsg() { msg.hidden = true; msg.textContent = ''; msg.classList.remove('ssc-msg--retry'); }
  msg.addEventListener('click', function() {
    if (!msg.classList.contains('ssc-msg--retry')) return;
    clearMsg();
    render();
  });

  // Tracks in-flight requests per combo (not one shared flag) so switching
  // controls while a fetch is still pending doesn't strand the newly-picked
  // combo waiting on a "loading" flag that belongs to another one.
  function ensureLoaded(a, f, c, g, hz, b) {
    var key = cacheKey(a, f, c, g, hz, b);
    if (cache[key] || pending[key]) return;
    pending[key] = true;
    // A request that just hangs (flaky mobile network, a stalled response)
    // used to leave pending[key] stuck true forever with nothing to catch
    // or reject it — the spinner never cleared, and closing/reopening the
    // modal or re-picking the same control silently no-op'd instead of
    // retrying, since both checks above still saw pending===true. Aborting
    // after 20s (generous headroom over the ~200-250ms this normally takes)
    // forces the promise chain to settle either way, so pending[key] always
    // gets reset and a retry can actually go out.
    var timedOut = false;
    var controller = new AbortController();
    var timer = setTimeout(function() { timedOut = true; controller.abort(); }, 20000);
    fetch(buildUrl(a, f, c, g, hz, b), { signal: controller.signal })
      .then(function(r) { if (!r.ok) throw new Error('failed'); return r.blob(); })
      .then(function(res) {
        cache[key] = { blob: res, url: URL.createObjectURL(res) };
        if (key === currentKey()) render();
      })
      .catch(function() {
        if (key === currentKey()) {
          spinner.hidden = true;
          showMsg(timedOut ? 'Taking too long to load. Tap to retry.' : 'Could not load your stat card. Tap to retry.', true);
        }
      })
      .then(function() { clearTimeout(timer); pending[key] = false; }, function() { clearTimeout(timer); pending[key] = false; });
  }

  // Each render is only ~200-250ms server-side, but every swatch click still
  // paid a full fetch since nothing was pre-warmed — quietly loads the other
  // accent colors for the combo just shown, in the background, so a follow-up
  // color click resolves from cache instead of waiting on the network again.
  var ACCENT_KEYS = ['amber', 'red', 'blue', 'green', 'purple', 'pink', 'cyan'];
  function prefetchOtherAccents(a, f, current, g, hz, b) {
    ACCENT_KEYS.forEach(function(c) {
      if (c !== current) ensureLoaded(a, f, c, g, hz, b);
    });
  }

  function render() {
    var entry = cache[currentKey()];
    if (!entry) { spinner.hidden = false; img.hidden = true; ensureLoaded(align, focus, accent, gaugesOn, hideZerosOn, badgeOn); return; }
    img.src = entry.url;
    img.hidden = false;
    spinner.hidden = true;
    prefetchOtherAccents(align, focus, accent, gaugesOn, hideZerosOn, badgeOn);
  }

  function open() {
    backdrop.hidden = false;
    closeSheet();
    clearMsg();
    render();
  }
  function close() { backdrop.hidden = true; }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(); });

  swatchBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      accent = btn.getAttribute('data-accent');
      swatchBtns.forEach(function(b) { b.classList.toggle('is-active', b === btn); });
      accentDot.style.setProperty('--swatch', btn.style.getPropertyValue('--swatch'));
      clearMsg();
      render();
    });
  });

  gaugesToggle.addEventListener('click', function() {
    gaugesOn = !gaugesOn;
    gaugesToggle.setAttribute('aria-pressed', gaugesOn ? 'true' : 'false');
    clearMsg();
    render();
  });

  hideZerosToggle.addEventListener('click', function() {
    hideZerosOn = !hideZerosOn;
    hideZerosToggle.setAttribute('aria-pressed', hideZerosOn ? 'true' : 'false');
    clearMsg();
    render();
  });

  badgeToggle.addEventListener('click', function() {
    badgeOn = !badgeOn;
    badgeToggle.setAttribute('aria-pressed', badgeOn ? 'true' : 'false');
    clearMsg();
    render();
  });

  // Save/Copy/Share all happen entirely client-side against an
  // already-fetched blob — without this ping, the server (and admin) would
  // never know a player did anything past opening the editor. Fire-and-forget
  // on purpose: a logging failure shouldn't surface an error for an action
  // the player already completed successfully.
  function logCardAction(action) {
    fetch('/api/games/' + GAME_ID + '/stat-card-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, template: align, focus: focus, accent: accent }),
    }).catch(function() {});
  }

  saveBtn.addEventListener('click', function() {
    var entry = cache[currentKey()];
    if (!entry) return;
    var a = document.createElement('a');
    a.href = entry.url;
    a.download = 'wknd-game-' + GAME_ID + '-stats.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    logCardAction('save');
  });

  copyBtn.addEventListener('click', function() {
    var entry = cache[currentKey()];
    if (!entry) return;
    clearMsg();
    if (!navigator.clipboard || !window.ClipboardItem) {
      showMsg('Copy is not supported in this browser. Use Save instead.');
      return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': entry.blob })])
      .then(function() { showMsg('Copied to clipboard.'); logCardAction('copy'); })
      .catch(function() { showMsg('Could not copy. Try Save instead.'); });
  });

  shareBtn.addEventListener('click', function() {
    var entry = cache[currentKey()];
    if (!entry) return;
    clearMsg();
    var file = new File([entry.blob], 'wknd-game-stats.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Resolves on a completed share, but also on some browsers when the
      // user just dismisses the share sheet — a false positive here is a
      // much smaller problem than never counting a real share, so this
      // isn't worth trying to distinguish.
      navigator.share({ files: [file], title: 'My Stats — WKND Basketball' })
        .then(function() { logCardAction('share'); })
        .catch(function() {});
    } else {
      showMsg('Sharing is not supported in this browser. Use Save instead.');
    }
  });
})();
</script>`;
}

// ── Game Recap tab ────────────────────────────────────────────────────────────
function renderWriteup(writeup) {
  const s = String(writeup || '').trim();
  if (!s) return '';

  const isHtml = /<[a-z][\s\S]*>/i.test(s);

  if (isHtml) {
    // Split on first block break to separate title from body. Strip empty <p>
    // tags first — a leading one (Quill leftover) would otherwise get matched
    // as the "title" and push the real headline into the body instead.
    const cleaned = stripEmptyParagraphs(s);
    const m = cleaned.match(/^([\s\S]*?)(<br\s*\/?>|<\/(?:p|div|h[1-6])>)([\s\S]*)$/i);
    const titleHtml = m ? m[1] : cleaned;
    const bodyHtml  = m ? m[3].trim() : '';
    const titleText = titleHtml.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
    return [
      titleText ? `<h2 class="recap-tab__title">${escHtml(titleText)}</h2>` : '',
      bodyHtml  ? `<div class="recap-tab__body">${bodyHtml}</div>` : '',
    ].filter(Boolean).join('\n');
  }

  // Legacy ** format or plain text
  const { title } = parseWriteup(s);
  const bodyRaw = title
    ? s.replace(/^\*\*[^*]+\*\*\s*/, '').replace(/^[^\n]+\n?/, '').trim()
    : s;

  const bodyHtml = bodyRaw
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(para => `<p class="recap-tab__body">${escHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return [
    title   ? `<h2 class="recap-tab__title">${escHtml(title)}</h2>` : '',
    bodyHtml || '',
  ].filter(Boolean).join('\n');
}

// ── Box Score tab ─────────────────────────────────────────────────────────────
function minToSecs(m) {
  const p = String(m || '0:00').split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}

function statOrDash(val) { return Number(val) > 0 ? val : '–'; }
function shotPct(made, miss) {
  const att = made + miss;
  if (!att) return '–';
  return Math.round(made / att * 100) + '%';
}
function calcPer(p) {
  const fgm = Number(p.fg2m) + Number(p.fg3m) + Number(p.fg4m || 0);
  const fga = fgm + Number(p.fg2m_miss) + Number(p.fg3m_miss) + Number(p.fg4m_miss || 0);
  const ftm = Number(p.ftm), fta = ftm + Number(p.ft_miss);
  return (
    Number(p.pts) + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
    0.7 * Number(p.reb) + Number(p.stl) + 0.7 * Number(p.ast) +
    0.7 * Number(p.blk) - Number(p.turnover)
  ).toFixed(1);
}

function lineScore(game, quarterScores = []) {
  const totalA = Number(game.team_a_score);
  const totalB = Number(game.team_b_score);

  // Index provided scores by quarter
  const byQ = {};
  for (const s of quarterScores) {
    if (s.a !== null) byQ[s.quarter] = { a: s.a, b: s.b };
  }

  const maxQ = Math.max(4, ...quarterScores.map(s => s.quarter), 0);

  const cols = Array.from({ length: maxQ }, (_, i) => {
    const q = i + 1;
    const label = q <= 4 ? `Q${q}` : `OT${q - 4}`;
    return { label, a: byQ[q]?.a ?? '–', b: byQ[q]?.b ?? '–' };
  });

  const qHeaders = cols.map(c => `<th>${c.label}</th>`).join('');
  const qA = cols.map(c => `<td>${c.a}</td>`).join('');
  const qB = cols.map(c => `<td>${c.b}</td>`).join('');

  return `<div class="ls-wrap">
  <table class="ls-table">
    <thead><tr><th class="ls-name"></th>${qHeaders}<th class="ls-total">T</th></tr></thead>
    <tbody>
      <tr><td class="ls-name">${escHtml(game.team_a_name)}</td>${qA}<td class="ls-total">${totalA}</td></tr>
      <tr><td class="ls-name">${escHtml(game.team_b_name)}</td>${qB}<td class="ls-total">${totalB}</td></tr>
    </tbody>
  </table>
</div>`;
}

export function teamBoxScore(players, teamName, isWinner, dnpPlayers = [], teamTurnovers = 0) {
  const color = teamColor(teamName);
  const sorted = [...players].sort((a, b) => Number(calcPer(b)) - Number(calcPer(a)));

  const sum = (key) => sorted.reduce((s, p) => s + Number(p[key] || 0), 0);
  const tot = {
    pts: sum('pts'), reb: sum('reb'), ast: sum('ast'),
    stl: sum('stl'), blk: sum('blk'), turnover: sum('turnover'),
    fg2m: sum('fg2m'), fg3m: sum('fg3m'), fg4m: sum('fg4m'),
    fg2m_miss: sum('fg2m_miss'), fg3m_miss: sum('fg3m_miss'), fg4m_miss: sum('fg4m_miss'),
    ftm: sum('ftm'), ft_miss: sum('ft_miss'),
  };
  const teamTotalTurnovers = tot.turnover + (Number(teamTurnovers) || 0);

  const playerRow = (p) => {
    const fgm  = Number(p.fg2m) + Number(p.fg3m) + Number(p.fg4m || 0);
    const fgMs = Number(p.fg2m_miss) + Number(p.fg3m_miss) + Number(p.fg4m_miss || 0);
    const tpm  = Number(p.fg3m);
    const tpMs = Number(p.fg3m_miss);
    const qpm  = Number(p.fg4m || 0);
    const qpMs = Number(p.fg4m_miss || 0);
    const ftm  = Number(p.ftm);
    const ftMs = Number(p.ft_miss);
    return `<tr>
      <td class="bs-name">${playerLink(p.player_id, p.name || '')}</td>
      <td class="bs-stat">${fgm + fgMs ? fgm : '–'}</td>
      <td class="bs-stat">${fgm + fgMs ? fgm + fgMs : '–'}</td>
      <td class="bs-stat bs-pct">${shotPct(fgm, fgMs)}</td>
      <td class="bs-stat">${tpm + tpMs ? tpm : '–'}</td>
      <td class="bs-stat">${tpm + tpMs ? tpm + tpMs : '–'}</td>
      <td class="bs-stat bs-pct">${shotPct(tpm, tpMs)}</td>
      <td class="bs-stat">${qpm + qpMs ? qpm : '–'}</td>
      <td class="bs-stat">${qpm + qpMs ? qpm + qpMs : '–'}</td>
      <td class="bs-stat bs-pct">${shotPct(qpm, qpMs)}</td>
      <td class="bs-stat">${ftm + ftMs ? ftm : '–'}</td>
      <td class="bs-stat">${ftm + ftMs ? ftm + ftMs : '–'}</td>
      <td class="bs-stat bs-pct">${shotPct(ftm, ftMs)}</td>
      <td class="bs-stat">${Number(p.reb) || 0}</td>
      <td class="bs-stat">${Number(p.ast) || 0}</td>
      <td class="bs-stat">${Number(p.stl) || 0}</td>
      <td class="bs-stat">${Number(p.blk) || 0}</td>
      <td class="bs-stat">${Number(p.turnover) || 0}</td>
      <td class="bs-stat bs-pts">${Number(p.pts) || 0}</td>
      <td class="bs-stat bs-per">${calcPer(p)}</td>
    </tr>`;
  };

  const totFgm  = tot.fg2m + tot.fg3m + tot.fg4m;
  const totFgMs = tot.fg2m_miss + tot.fg3m_miss + tot.fg4m_miss;
  const totTpMs = tot.fg3m_miss;
  const totQpMs = tot.fg4m_miss;
  const totFtMs = tot.ft_miss;

  return `<div class="bs-block">
  <div class="bs-scroll">
    <table class="bs-table">
      <thead>
        <tr>
          <th class="bs-name" rowspan="2">PLAYER</th>
          <th colspan="3" class="bs-group">FIELD GOALS</th>
          <th colspan="3" class="bs-group">3-POINTERS</th>
          <th colspan="3" class="bs-group">4-POINTERS</th>
          <th colspan="3" class="bs-group">FREE THROWS</th>
          <th class="bs-stat" rowspan="2">REB</th>
          <th class="bs-stat" rowspan="2">AST</th>
          <th class="bs-stat" rowspan="2">STL</th>
          <th class="bs-stat" rowspan="2">BLK</th>
          <th class="bs-stat" rowspan="2">TO</th>
          <th class="bs-stat bs-pts" rowspan="2">PTS</th>
          <th class="bs-stat bs-per" rowspan="2">PER</th>
        </tr>
        <tr class="bs-subhead">
          <th class="bs-stat">M</th>
          <th class="bs-stat">A</th>
          <th class="bs-stat bs-pct">%</th>
          <th class="bs-stat">M</th>
          <th class="bs-stat">A</th>
          <th class="bs-stat bs-pct">%</th>
          <th class="bs-stat">M</th>
          <th class="bs-stat">A</th>
          <th class="bs-stat bs-pct">%</th>
          <th class="bs-stat">M</th>
          <th class="bs-stat">A</th>
          <th class="bs-stat bs-pct">%</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(playerRow).join('')}
        ${dnpPlayers.map(p => `<tr class="bs-dnp">
          <td class="bs-dnp__cell" colspan="20">
            ${playerLink(p.id, p.name)} <span class="dnp-pill">DNP</span>
          </td>
        </tr>`).join('')}
        <tr class="bs-totals">
          <td class="bs-name">TEAM</td>
          <td class="bs-stat">${totFgm}</td>
          <td class="bs-stat">${totFgm + totFgMs}</td>
          <td class="bs-stat bs-pct">${shotPct(totFgm, totFgMs)}</td>
          <td class="bs-stat">${tot.fg3m}</td>
          <td class="bs-stat">${tot.fg3m + totTpMs}</td>
          <td class="bs-stat bs-pct">${shotPct(tot.fg3m, totTpMs)}</td>
          <td class="bs-stat">${tot.fg4m}</td>
          <td class="bs-stat">${tot.fg4m + totQpMs}</td>
          <td class="bs-stat bs-pct">${shotPct(tot.fg4m, totQpMs)}</td>
          <td class="bs-stat">${tot.ftm}</td>
          <td class="bs-stat">${tot.ftm + totFtMs}</td>
          <td class="bs-stat bs-pct">${shotPct(tot.ftm, totFtMs)}</td>
          <td class="bs-stat">${tot.reb}</td>
          <td class="bs-stat">${tot.ast}</td>
          <td class="bs-stat">${tot.stl}</td>
          <td class="bs-stat">${tot.blk}</td>
          <td class="bs-stat">${teamTotalTurnovers}</td>
          <td class="bs-stat bs-pts">${tot.pts}</td>
          <td class="bs-stat bs-per">–</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${teamTurnovers > 0 ? `<div class="bs-team-to-note">Includes ${teamTurnovers} team turnover${teamTurnovers === 1 ? '' : 's'} (shot clock, etc.) not charged to a player.</div>` : ''}
</div>`;
}

export function buildBoxScoreData(game, stats, dnpPlayers = []) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winnerName = scoreA >= scoreB ? game.team_a_name : game.team_b_name;

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const dnpByTeam = {};
  for (const p of dnpPlayers) {
    const teamName = String(p.team_name || '').toUpperCase();
    if (!dnpByTeam[teamName]) dnpByTeam[teamName] = [];
    dnpByTeam[teamName].push({ id: p.id, name: displayPlayerName(p.name || '') });
  }

  // Turnovers charged to the team as a whole (shot clock violations, etc.),
  // not to any player — kept separate from per-player stats.
  const teamTurnovers = {
    [String(game.team_a_name || '').toUpperCase()]: Number(game.team_a_to_team) || 0,
    [String(game.team_b_name || '').toUpperCase()]: Number(game.team_b_to_team) || 0,
  };

  const winner = winnerName.toUpperCase();
  return { byTeam, dnpByTeam, winner, teamTurnovers };
}

export function teamBoxScoreTab(teamName, byTeam, dnpByTeam, winner, teamTurnovers = {}) {
  const n = teamName.toUpperCase();
  const players = byTeam[n] || [];
  return `<div class="boxscore-tab">
  ${teamBoxScore(players, n, n === winner, dnpByTeam[n] || [], teamTurnovers[n] || 0)}
</div>`;
}

// ── Line scores tab ───────────────────────────────────────────────────────────
export function lineScoreTab(game, quarterScores) {
  return lineScore(game, quarterScores) || `<p class="tabs-empty">No quarter data available.</p>`;
}

// ── Game Leaders tab ──────────────────────────────────────────────────────────
export function gameLeadersTab(game, stats) {
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const top = (teamName, key) => {
    const pl = byTeam[teamName] || [];
    if (!pl.length) return { value: 0, players: [] };
    const maxVal = Math.max(...pl.map(p => Number(p[key] || 0)));
    if (maxVal === 0) return { value: 0, players: [] };
    const tied = pl.filter(p => Number(p[key] || 0) === maxVal).slice(0, 3);
    return { value: maxVal, players: tied };
  };

  const avatar = (p, color) => playerAvatar(p.player_id, p.name, color, { className: 'ldr-avatar', link: true });

  const playerGroup = (leader, color, isA) => {
    if (!leader.players.length) return '';
    const avGroup = `<div class="ldr-avatars">${leader.players.map(p => avatar(p, color)).join('')}</div>`;
    const nameEl = `<span class="ldr-name">${leader.players.map(p => playerLink(p.player_id, p.name || '', { upper: true })).join(', ')}</span>`;
    return `<div class="ldr-player">${isA ? nameEl + avGroup : avGroup + nameEl}</div>`;
  };

  const CATS = [
    { label: 'PTS', key: 'pts' },
    { label: 'REB', key: 'reb' },
    { label: 'AST', key: 'ast' },
    { label: 'STL', key: 'stl' },
    { label: 'BLK', key: 'blk' },
    { label: 'TO',  key: 'turnover' },
  ];

  const rows = CATS.map(cat => {
    const lA = top(nameA, cat.key);
    const lB = top(nameB, cat.key);
    if (!lA.value && !lB.value) return '';
    const total = lA.value + lB.value;
    const wA = total > 0 ? (lA.value / total * 100).toFixed(1) : 50;
    const wB = total > 0 ? (lB.value / total * 100).toFixed(1) : 50;
    const bg = `linear-gradient(to right, ${colorA}0d ${wA}%, ${colorB}0d ${wA}%)`;
    return `<div class="ldr-row">
  <div class="ldr-col ldr-col--a">
    ${playerGroup(lA, colorA, true)}
  </div>
  <div class="ldr-center">
    <span class="ldr-val${!lA.players.length ? ' ldr-val--empty' : ''}">${lA.value || '–'}</span>
    <span class="ldr-cat">${escHtml(cat.label)}</span>
    <span class="ldr-val${!lB.players.length ? ' ldr-val--empty' : ''}">${lB.value || '–'}</span>
  </div>
  <div class="ldr-col ldr-col--b">
    ${playerGroup(lB, colorB, false)}
  </div>
  <div class="comp-bars">
    <div class="comp-bars__half comp-bars__half--a"><div class="comp-bar" style="width:${wA}%;background:${colorA}"></div></div>
    <div class="comp-bars__half comp-bars__half--b"><div class="comp-bar" style="width:${wB}%;background:${colorB}"></div></div>
  </div>
</div>`;
  }).filter(Boolean).join('');

  return `<div class="ldr-tab">
  <div class="comp-head">
    <span class="comp-head__label">GAME LEADERS</span>
    <span class="comp-head__sub">Top performer per team</span>
  </div>
  <div class="comp-teams">
    <div class="comp-team-name" style="color:${colorA}">${escHtml(nameA)}</div>
    <div class="comp-team-label">STAT</div>
    <div class="comp-team-name comp-team-name--b" style="color:${colorB}">${escHtml(nameB)}</div>
  </div>
  ${rows}
</div>`;
}

// ── Team Comparison tab ───────────────────────────────────────────────────────
export function teamComparisonTab(game, stats) {
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const sum = (players, key) => players.reduce((t, p) => t + Number(p[key] || 0), 0);
  const pct = (made, att) => att > 0 ? (made / att * 100).toFixed(1) + '%' : '—';
  const ma = (made, att) => att > 0 ? `${made}/${att}` : '—';

  const totals = (name) => {
    const pl = byTeam[name] || [];
    const fg2m = sum(pl,'fg2m'), fg3m = sum(pl,'fg3m'), fg4m = sum(pl,'fg4m');
    const fg2miss = sum(pl,'fg2m_miss'), fg3miss = sum(pl,'fg3m_miss'), fg4miss = sum(pl,'fg4m_miss');
    const fgm = fg2m+fg3m+fg4m, fgatt = fgm+fg2miss+fg3miss+fg4miss;
    const ftm = sum(pl,'ftm'), ftatt = ftm+sum(pl,'ft_miss');
    const threeatt = fg3m+fg3miss;
    const fouratt = fg4m+fg4miss;
    return { pts: sum(pl,'pts'), reb: sum(pl,'reb'), ast: sum(pl,'ast'), stl: sum(pl,'stl'),
             blk: sum(pl,'blk'), to: sum(pl,'turnover'), pf: sum(pl,'pf'),
             fgm, fgatt, fg3m, threeatt, fg4m, fouratt, ftm, ftatt };
  };

  const tA = totals(nameA), tB = totals(nameB);

  const rows = [
    { label: 'PTS',  dA: tA.pts,                    dB: tB.pts,                    cA: tA.pts,  cB: tB.pts },
    { label: 'FG',   dA: ma(tA.fgm,tA.fgatt),       dB: ma(tB.fgm,tB.fgatt),       cA: tA.fgm,  cB: tB.fgm },
    { label: 'FG%',  dA: pct(tA.fgm,tA.fgatt),      dB: pct(tB.fgm,tB.fgatt),      cA: tA.fgatt>0?tA.fgm/tA.fgatt*100:0, cB: tB.fgatt>0?tB.fgm/tB.fgatt*100:0 },
    { label: '3PT',  dA: ma(tA.fg3m,tA.threeatt),   dB: ma(tB.fg3m,tB.threeatt),   cA: tA.fg3m, cB: tB.fg3m },
    { label: '3P%',  dA: pct(tA.fg3m,tA.threeatt),  dB: pct(tB.fg3m,tB.threeatt),  cA: tA.threeatt>0?tA.fg3m/tA.threeatt*100:0, cB: tB.threeatt>0?tB.fg3m/tB.threeatt*100:0 },
    { label: '4PT',  dA: ma(tA.fg4m,tA.fouratt),    dB: ma(tB.fg4m,tB.fouratt),    cA: tA.fg4m, cB: tB.fg4m },
    { label: '4P%',  dA: pct(tA.fg4m,tA.fouratt),   dB: pct(tB.fg4m,tB.fouratt),   cA: tA.fouratt>0?tA.fg4m/tA.fouratt*100:0, cB: tB.fouratt>0?tB.fg4m/tB.fouratt*100:0 },
    { label: 'FT',   dA: ma(tA.ftm,tA.ftatt),       dB: ma(tB.ftm,tB.ftatt),       cA: tA.ftm,  cB: tB.ftm },
    { label: 'REB',  dA: tA.reb,                    dB: tB.reb,                    cA: tA.reb,  cB: tB.reb },
    { label: 'AST',  dA: tA.ast,                    dB: tB.ast,                    cA: tA.ast,  cB: tB.ast },
    { label: 'STL',  dA: tA.stl,                    dB: tB.stl,                    cA: tA.stl,  cB: tB.stl },
    { label: 'BLK',  dA: tA.blk,                    dB: tB.blk,                    cA: tA.blk,  cB: tB.blk },
    { label: 'TO',   dA: tA.to,                     dB: tB.to,                     cA: tA.to,   cB: tB.to },
    { label: 'PF',   dA: tA.pf,                     dB: tB.pf,                     cA: tA.pf,   cB: tB.pf },
  ];

  const rowsHtml = rows.map(r => {
    const total = r.cA + r.cB;
    const wA = total > 0 ? (r.cA / total * 100).toFixed(1) : 50;
    const wB = total > 0 ? (r.cB / total * 100).toFixed(1) : 50;
    const bg = `linear-gradient(to right, ${colorA}0d ${wA}%, ${colorB}0d ${wA}%)`;
    return `<div class="comp-row">
  <div class="comp-val">${r.dA}</div>
  <div class="comp-label">${escHtml(r.label)}</div>
  <div class="comp-val comp-val--b">${r.dB}</div>
  <div class="comp-bars">
    <div class="comp-bars__half comp-bars__half--a"><div class="comp-bar" style="width:${wA}%;background:${colorA}"></div></div>
    <div class="comp-bars__half comp-bars__half--b"><div class="comp-bar" style="width:${wB}%;background:${colorB}"></div></div>
  </div>
</div>`;
  }).join('');

  return `<div class="comp-tab">
  <div class="comp-head">
    <span class="comp-head__label">TEAM TOTAL COMPARISON</span>
    <span class="comp-head__sub">All totals for this game</span>
  </div>
  <div class="comp-teams">
    <div class="comp-team-name" style="color:${colorA}">${escHtml(nameA)}</div>
    <div class="comp-team-label">STAT</div>
    <div class="comp-team-name comp-team-name--b" style="color:${colorB}">${escHtml(nameB)}</div>
  </div>
  ${rowsHtml}
</div>`;
}

// ── Play-by-Play tab ──────────────────────────────────────────────────────────
function isDisplayablePbp(e) {
  if (!String(e.text || '').trim()) return false;
  if (e.hiddenFromLog) return false;
  if (e.isUndoCompensation) return false;
  if (e.kind === 'stat' && e.undoOfId) return false;
  if (e.kind === 'stat') return true;
  if (e.kind === 'sub') return true;
  if (e.kind === 'meta') {
    return e.metaType === 'timeout' || e.metaType === 'foulPause' || e.metaType === 'quarterEnd';
  }
  return false;
}

export function playByPlayTab(game) {
  let log = [];
  try { log = JSON.parse(game.game_log_json || '[]'); } catch { log = []; }

  // Log is stored newest-first; filter without reversing so newest stays at top
  const filtered = log.filter(isDisplayablePbp);
  if (!filtered.length) return `<p class="tabs-empty">No play-by-play data available.</p>`;

  const nameA = escHtml(game.team_a_name.toUpperCase());
  const nameB = escHtml(game.team_b_name.toUpperCase());

  const quarters = new Map();
  for (const e of filtered) {
    const q = Number(e.quarter || 1);
    if (!quarters.has(q)) quarters.set(q, []);
    quarters.get(q).push(e);
  }

  const qLabel = q => q <= 4 ? `Q${q}` : `OT${q - 4}`;

  const html = [...quarters.entries()]
    .sort(([a], [b]) => b - a)
    .map(([q, entries]) => {
      const rows = entries.map(e => {
        const isEnd = e.metaType === 'quarterEnd';
        const side  = e.isTeamA === true ? 'a' : e.isTeamA === false ? 'b' : '';
        const clock = escHtml(String(e.clockRemaining || '').trim());
        const text  = escHtml(String(e.text || '').trim());

        if (isEnd) {
          return `<div class="pbp-row pbp-row--end"><span class="pbp-full">${text}</span></div>`;
        }
        if (!side) {
          return `<div class="pbp-row pbp-row--neutral"><span class="pbp-full">${text}</span></div>`;
        }
        return `<div class="pbp-row pbp-row--${side}">
          <span class="pbp-cell pbp-cell--a">${side === 'a' ? text : ''}</span>
          <span class="pbp-clock font-condensed">${clock || '—'}</span>
          <span class="pbp-cell pbp-cell--b">${side === 'b' ? text : ''}</span>
        </div>`;
      }).join('');

      return `<div class="pbp-quarter">
        <div class="pbp-q-header">
          <span class="pbp-q-team">${nameA}</span>
          <span class="pbp-q-label">${qLabel(q)}</span>
          <span class="pbp-q-team pbp-q-team--b">${nameB}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');

  return `<div class="pbp-tab">${html}</div>`;
}

function gameTabsStyles() {
  return `<style>
    .game-tabs__actions { display: flex; align-items: center; gap: 6px; margin-left: auto; padding: 0 8px; flex-shrink: 0; }
    .game-tabs__icon-btn { display: inline-flex; align-items: center; gap: 5px; background: none; border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: 13px; color: var(--text-muted); cursor: pointer; }
    .game-floater { display: none; }
    @media (max-width: 900px) {
      /* React + share move into the floater on mobile; Comments stays in the tab
         row (still swipeable to) but drops its text label to save space. */
      .game-tabs__actions { display: none; }
      .game-tabs__tab-label { display: none; }
      .game-floater { display: block; position: fixed; right: 16px; bottom: 84px; z-index: 80; }
    }
    .game-floater__menu { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 10px; }
    .game-floater__menu[hidden] { display: none; }
    .game-floater__item {
      display: flex; align-items: center; justify-content: center; gap: 5px;
      min-width: 44px; height: 44px; padding: 0 12px; border-radius: 999px;
      background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
      font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.3);
      animation: game-floater-item-in .18s ease both;
    }
    .game-floater__item.is-active { border-color: var(--amber); color: var(--amber); }
    .game-floater__count { font-size: 12.5px; font-weight: 600; }
    .game-floater__bubble {
      position: relative; width: 52px; height: 52px; border-radius: 50%;
      background: var(--amber); border: none; color: #0a0e16; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 18px rgba(0,0,0,.35);
      animation: game-floater-bounce-in .5s ease both;
    }
    .game-floater__bubble-icon { display: block; font-size: 19px; line-height: 1; }
    .game-floater__bubble.is-open { background: var(--surface); color: var(--text); box-shadow: 0 4px 14px rgba(0,0,0,.3); }
    .game-floater__badge {
      position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; border: 2px solid var(--bg);
    }
    .game-floater__badge[hidden] { display: none; }
    @keyframes game-floater-bounce-in {
      0% { transform: scale(.4); opacity: 0; }
      60% { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes game-floater-item-in {
      from { transform: translateY(6px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .game-tabs__icon-btn.is-active { border-color: var(--amber); color: var(--amber); }
    .game-comments-panel { padding: 20px 24px 24px; }
    .game-comments-composer { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; }
    /* Flex row rather than an absolutely-positioned button over the textarea — the
       textarea's height changes as it auto-grows, which made a position:absolute button
       drift/overlap unpredictably. align-items:center keeps the send button vertically
       centered against the textarea regardless of how tall it gets. */
    .game-comments-composer__box { position: relative; display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 6px 6px 6px 14px; box-sizing: border-box; }
    .game-comments-composer textarea { flex: 1; min-width: 0; min-height: 22px; max-height: 160px; resize: none; overflow-y: auto; background: none; border: none; color: var(--text); font: inherit; padding: 6px 0; box-sizing: border-box; }
    .game-comments-composer textarea:focus { outline: none; }
    .game-comments-composer__send { flex-shrink: 0; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; background: var(--border); color: var(--text-muted); border: none; border-radius: 50%; cursor: pointer; transition: background .12s, color .12s; }
    .game-comments-composer__send svg { display: block; }
    .game-comments-composer__send:not(:disabled) { background: var(--amber); color: #020817; cursor: pointer; }
    .game-comments-composer__send:disabled { cursor: not-allowed; }
    .game-comments-composer__msg { font-size: 12px; color: var(--text-muted); padding-left: 4px; min-height: 14px; }
    .game-comments-cta { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 13px; color: var(--text-muted); margin-top: 16px; }
    .game-comments-cta a { color: var(--amber); font-weight: 600; }
    .game-comments-empty { color: var(--text-muted); font-size: 13px; }
    .game-comments-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
    .game-comments-more { display: flex; }
    .game-comments-more button { background: none; border: none; color: var(--amber); font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 0; }
    .game-comments-more button:hover { text-decoration: underline; }
    .game-comment { display: flex; gap: 12px; align-items: flex-start; }
    .game-comment__avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg); }
    .game-comment__avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .game-comment__body { flex: 1; min-width: 0; }
    .game-comment__head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .game-comment__name { font-weight: 700; color: var(--text); text-decoration: none; font-size: 13px; }
    .game-comment__time { font-size: 11px; color: var(--text-muted); }
    .game-comment__delete { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; padding: 2px 4px; }
    .game-comment__delete:hover { color: #ef4444; }
    .game-comment__text { margin: 4px 0 6px; font-size: 13.5px; color: var(--text); white-space: pre-wrap; word-break: break-word; }
    .game-comment__react { display: inline-flex; align-items: center; gap: 5px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
    .game-comment__react.is-active { border-color: var(--amber); color: var(--amber); }
    .game-comment__mention { color: var(--amber); font-weight: 600; text-decoration: none; }
    .game-comment__mention:hover { text-decoration: underline; }
    .game-comments-mention-dropdown { position: absolute; width: 220px; max-width: calc(100% - 20px); bottom: calc(100% + 6px); max-height: 190px; overflow-y: auto; background: var(--surface2, var(--surface)); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.35); z-index: 20; }
    .game-comments-mention-dropdown__item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 13px; color: var(--text); cursor: pointer; }
    .game-comments-mention-dropdown__item:hover, .game-comments-mention-dropdown__item.is-active { background: rgba(245,147,50,.12); }
    .game-comments-mention-dropdown__avatar { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: var(--text-muted); background: var(--bg); }
    .game-comments-mention-dropdown__avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  </style>`;
}

// Mobile-only floating menu — mirrors comment/react/share off the (cramped, horizontally
// scrolling) tab row into a fixed bottom-right bubble that expands on tap. Desktop is
// untouched; see the ≤900px rules in gameTabsStyles() for the actual swap.
function gameSocialFloater({ commentsEnabled, gameReaction, commentsCount }) {
  const reactCount = gameReaction.count || 0;
  const badgeTotal = commentsEnabled ? commentsCount + reactCount : 0;
  const commentItem = commentsEnabled
    ? `<button type="button" class="game-floater__item" id="floater-comment-btn" aria-label="Comments">💬<span class="game-floater__count" id="floater-comments-count">${commentsCount}</span></button>`
    : '';
  const reactItem = commentsEnabled
    ? `<button type="button" class="game-floater__item${gameReaction.reacted ? ' is-active' : ''}" id="floater-react-btn" aria-label="React to this game">🔥<span class="game-floater__count" id="floater-react-count">${reactCount}</span></button>`
    : '';
  return `<div class="game-floater" id="game-floater">
    <div class="game-floater__menu" id="game-floater-menu" hidden>
      ${commentItem}
      ${reactItem}
      <button type="button" class="game-floater__item" id="floater-share-btn" aria-label="Share">↗</button>
    </div>
    <button type="button" class="game-floater__bubble" id="game-floater-toggle" aria-label="Comments, reactions & share" aria-expanded="false">
      <span class="game-floater__bubble-icon" id="game-floater-icon" aria-hidden="true">💬</span>
      <span class="game-floater__badge" id="game-floater-badge"${badgeTotal ? '' : ' hidden'}>${badgeTotal}</span>
    </button>
  </div>`;
}

// One shared script for tab switching + comments (post/react/delete) + page-level react/share
// — all game-tabs concerns live in this one block regardless of which branch built the markup.
function gameTabsScript({ gameId, isAdmin = false, mentionablePlayers = [] }) {
  return `<script>
(function(){
  // Deep link from elsewhere (e.g. the comment icon on /games, notifications) straight to the
  // comments section — the old #comments tab anchor still works.
  function goToTalk(smooth) {
    var talk = document.getElementById('talk');
    if (talk) talk.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }
  if (window.location.hash === '#comments') goToTalk(false);

  // ?share=1 (from the profile's "Share my stats" buttons) opens the stat-card editor
  // straight away — only when this viewer has a line in the game (the button exists).
  if (/[?&]share=1(&|$)/.test(window.location.search)) {
    var sscBtn = document.getElementById('ssc-open-btn');
    if (sscBtn) setTimeout(function(){ sscBtn.click(); }, 0);
  }

  var gameId = ${JSON.stringify(gameId)};
  var isAdmin = ${JSON.stringify(isAdmin)};

  var seeMoreBtn = document.getElementById('gc-see-more');
  if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', function() {
      document.querySelectorAll('.game-comment[hidden]').forEach(function(li) { li.hidden = false; });
      seeMoreBtn.closest('.game-comments-more').remove();
    });
  }

  var mentionablePlayers = ${JSON.stringify(mentionablePlayers)};

  var submitBtn = document.getElementById('gc-submit');
  var gcInput   = document.getElementById('gc-input');
  var mentionDropdown = document.getElementById('gc-mention-dropdown');
  var mentionMatches = [];
  var mentionActiveIndex = -1;

  // Matches an in-progress "@partial name" run right up to the cursor — letters/spaces
  // only, capped at 30 chars so it can't run away across a whole long comment. Returns
  // the @'s own index too, not just the query text — the dropdown anchors to where the
  // @ sits, not wherever the cursor has since moved to as you keep typing the name.
  function activeMentionQuery() {
    var pos = gcInput.selectionStart;
    var head = gcInput.value.slice(0, pos);
    var m = head.match(/@([A-Za-z ]{0,30})$/);
    return m ? { query: m[1], atIndex: m.index } : null;
  }

  function closeMentionDropdown() {
    mentionDropdown.hidden = true;
    mentionDropdown.innerHTML = '';
    mentionMatches = []; mentionActiveIndex = -1;
  }

  function renderMentionDropdown() {
    mentionDropdown.innerHTML = mentionMatches.map(function(p, i) {
      return '<div class="game-comments-mention-dropdown__item' + (i === mentionActiveIndex ? ' is-active' : '') + '" data-idx="' + i + '">' +
        '<span class="game-comments-mention-dropdown__avatar">' +
          '<span class="font-condensed">' + (p.initials || '') + '</span>' +
          '<img src="' + p.photoUrl + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\'">' +
        '</span>' +
        '<span>' + p.name + '</span>' +
      '</div>';
    }).join('');
    mentionDropdown.hidden = false;
  }

  // Textareas have no native "give me the pixel position of the caret" API, so this
  // builds an invisible clone of the textarea (same font/padding/wrapping), stuffs the
  // text-up-to-the-caret into it, and reads where that text naturally wrapped to — the
  // standard technique for this (same approach the textarea-caret-position library uses).
  function getCaretCoordinates(textarea, position) {
    var mirror = document.createElement('div');
    var style = window.getComputedStyle(textarea);
    ['boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight',
     'textTransform', 'wordSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
     'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].forEach(function(p) {
      mirror.style[p] = style[p];
    });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    document.body.appendChild(mirror);
    mirror.textContent = textarea.value.slice(0, position);
    var marker = document.createElement('span');
    marker.textContent = textarea.value.slice(position)[0] || '.';
    mirror.appendChild(marker);
    var coords = { left: marker.offsetLeft, top: marker.offsetTop };
    document.body.removeChild(mirror);
    return coords;
  }

  function positionMentionDropdown(atIndex) {
    var coords = getCaretCoordinates(gcInput, atIndex);
    var box = gcInput.parentElement; // .game-comments-composer__box — the positioned ancestor
    var maxLeft = Math.max(0, box.clientWidth - mentionDropdown.offsetWidth - 4);
    mentionDropdown.style.left = Math.min(gcInput.offsetLeft + coords.left, maxLeft) + 'px';
  }

  function updateMentionDropdown() {
    var active = activeMentionQuery();
    if (active === null || !mentionablePlayers.length) { closeMentionDropdown(); return; }
    var ql = active.query.toLowerCase();
    mentionMatches = mentionablePlayers.filter(function(p) { return p.name.toLowerCase().indexOf(ql) !== -1; }).slice(0, 6);
    if (!mentionMatches.length) { closeMentionDropdown(); return; }
    mentionActiveIndex = 0;
    renderMentionDropdown();
    positionMentionDropdown(active.atIndex);
  }

  function selectMention(player) {
    var pos = gcInput.selectionStart;
    var head = gcInput.value.slice(0, pos);
    var tail = gcInput.value.slice(pos);
    var newHead = head.replace(/@([A-Za-z ]{0,30})$/, '@' + player.name + ' ');
    gcInput.value = newHead + tail;
    var caret = newHead.length;
    gcInput.focus();
    gcInput.setSelectionRange(caret, caret);
    gcInput.style.height = 'auto'; gcInput.style.height = gcInput.scrollHeight + 'px';
    submitBtn.disabled = !gcInput.value.trim();
    closeMentionDropdown();
  }

  if (mentionDropdown) {
    // mousedown (not click) fires before the textarea's blur, so a selection registers
    // before closeMentionDropdown()/blur handling could otherwise remove it first.
    mentionDropdown.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var item = e.target.closest('[data-idx]');
      if (!item) return;
      var p = mentionMatches[Number(item.dataset.idx)];
      if (p) selectMention(p);
    });
  }

  if (submitBtn && gcInput) {
    // Auto-grow — starts single-line (matches the Facebook-style box), expands as text
    // wraps rather than staying a fixed multi-line block from the start. Same listener
    // also grays the send button out while the box is empty/whitespace-only, and drives
    // the @mention dropdown.
    gcInput.addEventListener('input', function() {
      gcInput.style.height = 'auto';
      gcInput.style.height = gcInput.scrollHeight + 'px';
      submitBtn.disabled = !gcInput.value.trim();
      updateMentionDropdown();
    });
    gcInput.addEventListener('keydown', function(e) {
      if (!mentionDropdown.hidden && mentionMatches.length) {
        if (e.key === 'ArrowDown') { e.preventDefault(); mentionActiveIndex = (mentionActiveIndex + 1) % mentionMatches.length; renderMentionDropdown(); return; }
        if (e.key === 'ArrowUp')   { e.preventDefault(); mentionActiveIndex = (mentionActiveIndex - 1 + mentionMatches.length) % mentionMatches.length; renderMentionDropdown(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionMatches[mentionActiveIndex]); return; }
        if (e.key === 'Escape') { closeMentionDropdown(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
    });
    gcInput.addEventListener('blur', function() {
      // Slight delay so a mousedown-driven selectMention() (above) still gets to run
      // before the dropdown is torn down out from under it.
      setTimeout(closeMentionDropdown, 150);
    });
    submitBtn.addEventListener('click', postComment);
  }
  // wsReady tracks whether the live channel is actually up — if it never connects (or
  // drops), posting/deleting falls back to the old reload-based behavior instead of
  // silently leaving the page out of sync. Live updates are a bonus, not a dependency.
  var wsReady = false;

  function postComment() {
    var msg = document.getElementById('gc-msg');
    var body = gcInput.value.trim();
    if (!body) { msg.textContent = 'Write something first.'; return; }
    submitBtn.disabled = true; msg.textContent = '';
    fetch('/games/' + gameId + '/comments', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ body: body })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
    .then(function(res) {
      if (!res.ok) { msg.textContent = res.d.error || 'Failed to post.'; submitBtn.disabled = false; return; }
      if (wsReady) {
        // The broadcast (including our own new comment) does the actual rendering —
        // just reset the box rather than inserting it twice.
        gcInput.value = ''; gcInput.style.height = 'auto'; submitBtn.disabled = true;
      } else {
        location.reload();
      }
    })
    .catch(function() { msg.textContent = 'Network error.'; submitBtn.disabled = false; });
  }

  // Delegated (not per-button) — comments/buttons added later by the WebSocket handler
  // below need working react/delete clicks without re-binding anything.
  var commentsPanel = document.querySelector('.game-comments-panel');
  if (commentsPanel) {
    commentsPanel.addEventListener('click', function(e) {
      var reactBtnEl = e.target.closest('[data-react-id]');
      if (reactBtnEl) {
        var rid = reactBtnEl.dataset.reactId;
        reactBtnEl.disabled = true;
        fetch('/games/' + gameId + '/comments/' + rid + '/react', { method: 'POST', headers: {'Content-Type':'application/json'} })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            reactBtnEl.disabled = false;
            if (!d.ok) return;
            reactBtnEl.classList.toggle('is-active', d.reacted);
            reactBtnEl.querySelector('.game-comment__react-count').textContent = d.count;
          })
          .catch(function() { reactBtnEl.disabled = false; });
        return;
      }
      var delBtnEl = e.target.closest('[data-delete-id]');
      if (delBtnEl) {
        if (!confirm('Delete this comment?')) return;
        var did = delBtnEl.dataset.deleteId;
        fetch('/games/' + gameId + '/comments/' + did, { method: 'DELETE' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.ok) { alert(d.error || 'Failed'); return; }
            // Remove immediately for the admin who clicked — the broadcast (if connected)
            // separately handles removing it for everyone else viewing the page.
            var li = commentsPanel.querySelector('.game-comment[data-id="' + did + '"]');
            if (li) li.remove();
          })
          .catch(function() { alert('Network error'); });
      }
    });
  }

  // ── Live updates (WebSocket) ────────────────────────────────────────────────
  function escLive(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtLiveTime(ms) {
    return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function bumpCommentsCount(delta) {
    var el = document.getElementById('comments-count');
    if (!el) return;
    var current = parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
    var next = Math.max(0, current + delta);
    el.textContent = next || '';
    el.hidden = !next;
    updateFloaterState();
  }
  // Mirrors linkifyMentions() server-side (views/game.js) — kept in sync manually since
  // one runs in Node at render time and the other runs in the browser on live WS arrival.
  function linkifyMentionsLive(escapedBody) {
    if (!mentionablePlayers.length) return escapedBody;
    var withEsc = mentionablePlayers.map(function(p) { return { id: p.id, name: escLive(p.name) }; })
      .sort(function(a, b) { return b.name.length - a.name.length; });
    var byName = {};
    var pattern = withEsc.map(function(p) { byName[p.name] = p.id; return p.name.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'); }).join('|');
    if (!pattern) return escapedBody;
    var re = new RegExp('@(' + pattern + ')(?![A-Za-z0-9])', 'g');
    return escapedBody.replace(re, function(match, name) {
      var id = byName[name];
      return id ? '<a href="/players/' + encodeURIComponent(id) + '" class="game-comment__mention">@' + name + '</a>' : match;
    });
  }
  function buildCommentLi(c) {
    var li = document.createElement('li');
    li.className = 'game-comment';
    li.setAttribute('data-id', c.id);
    var playerHref = '/players/' + encodeURIComponent(c.player_id);
    li.innerHTML =
      '<a href="' + playerHref + '" class="game-comment__avatar" style="border-color:' + escLive(c.color) + '">' +
        '<span class="font-condensed">' + escLive(c.initials) + '</span>' +
        '<img src="' + escLive(c.photoUrl) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\'">' +
      '</a>' +
      '<div class="game-comment__body">' +
        '<div class="game-comment__head">' +
          '<a href="' + playerHref + '" class="game-comment__name">' + escLive(c.displayName) + '</a>' +
          '<span class="game-comment__time">' + fmtLiveTime(c.created_at) + '</span>' +
          (isAdmin ? '<button type="button" class="game-comment__delete" data-delete-id="' + c.id + '" title="Delete comment" aria-label="Delete comment">✕</button>' : '') +
        '</div>' +
        '<p class="game-comment__text">' + linkifyMentionsLive(escLive(c.body)) + '</p>' +
        '<button type="button" class="game-comment__react" data-react-id="' + c.id + '">🔥 <span class="game-comment__react-count">0</span></button>' +
      '</div>';
    return li;
  }

  if (document.getElementById('game-talk')) {
    connectCommentsSocket();
  }
  function connectCommentsSocket() {
    var proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws;
    try { ws = new WebSocket(proto + '//' + window.location.host + '/ws/games/' + encodeURIComponent(gameId) + '/comments'); }
    catch (e) { return; }

    ws.addEventListener('open', function() { wsReady = true; });
    ws.addEventListener('close', function() {
      wsReady = false;
      // One retry after a few seconds — covers a dropped connection without hammering
      // the server if comments_enabled is simply off (upgrade gets rejected instantly).
      setTimeout(connectCommentsSocket, 4000);
    });
    ws.addEventListener('error', function() { wsReady = false; });

    ws.addEventListener('message', function(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }

      if (msg.type === 'comment:new') {
        var container = document.getElementById('game-comments-container');
        var list = document.getElementById('game-comments-list');
        if (!list) {
          var empty = document.getElementById('game-comments-empty');
          if (empty) empty.remove();
          list = document.createElement('ul');
          list.className = 'game-comments-list';
          list.id = 'game-comments-list';
          container.appendChild(list);
        }
        list.appendChild(buildCommentLi(msg.comment));
        bumpCommentsCount(1);
        return;
      }
      if (msg.type === 'comment:delete') {
        var row = document.querySelector('.game-comment[data-id="' + msg.id + '"]');
        if (row) row.remove();
        bumpCommentsCount(-1);
        return;
      }
      if (msg.type === 'comment:react') {
        var reactRow = document.querySelector('.game-comment[data-id="' + msg.id + '"] .game-comment__react-count');
        if (reactRow) reactRow.textContent = msg.count;
        return;
      }
      if (msg.type === 'game:react') {
        var gc = document.getElementById('game-react-count');
        if (gc) gc.textContent = msg.count;
        updateFloaterState();
        return;
      }
    });
  }

  var reactBtn = document.getElementById('game-react-btn');
  if (reactBtn) {
    reactBtn.addEventListener('click', function() {
      reactBtn.disabled = true;
      fetch('/games/' + gameId + '/react', { method: 'POST', headers: {'Content-Type':'application/json'} })
        .then(function(r) {
          if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return null; }
          return r.json();
        })
        .then(function(d) {
          if (!d) return;
          reactBtn.disabled = false;
          if (!d.ok) return;
          reactBtn.classList.toggle('is-active', d.reacted);
          document.getElementById('game-react-count').textContent = d.count;
          var floaterReactBtn = document.getElementById('floater-react-btn');
          if (floaterReactBtn) floaterReactBtn.classList.toggle('is-active', d.reacted);
          updateFloaterState();
        })
        .catch(function() { reactBtn.disabled = false; });
    });
  }

  var shareBtn = document.getElementById('game-share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      var url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function() {});
        return;
      }
      navigator.clipboard.writeText(url).then(function() {
        var orig = shareBtn.innerHTML;
        shareBtn.innerHTML = '✓';
        setTimeout(function() { shareBtn.innerHTML = orig; }, 1500);
      }).catch(function() {});
    });
  }

  // Mobile floater — mirrors the react/comment/share buttons above rather than
  // duplicating their logic: each item just clicks the real button (or the real tab)
  // and reads counts back off the same source-of-truth elements those buttons update.
  function updateFloaterState() {
    var floaterBadge = document.getElementById('game-floater-badge');
    if (!floaterBadge) return;
    var commentsCountEl = document.getElementById('comments-count');
    var commentsCount = commentsCountEl ? (parseInt((commentsCountEl.textContent || '').replace(/[^0-9]/g, ''), 10) || 0) : 0;
    var reactCountEl = document.getElementById('game-react-count');
    var reactCount = reactCountEl ? (parseInt(reactCountEl.textContent, 10) || 0) : 0;
    var floaterCommentsCount = document.getElementById('floater-comments-count');
    if (floaterCommentsCount) floaterCommentsCount.textContent = commentsCount;
    var floaterReactCount = document.getElementById('floater-react-count');
    if (floaterReactCount) floaterReactCount.textContent = reactCount;
    var total = commentsCount + reactCount;
    floaterBadge.textContent = total;
    floaterBadge.hidden = !total;
  }

  var floaterToggle = document.getElementById('game-floater-toggle');
  var floaterMenu = document.getElementById('game-floater-menu');
  var floaterIcon = document.getElementById('game-floater-icon');
  if (floaterToggle && floaterMenu) {
    var setFloaterOpen = function(open) {
      floaterMenu.hidden = !open;
      floaterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      floaterToggle.classList.toggle('is-open', open);
      if (floaterIcon) floaterIcon.textContent = open ? '✕' : '💬';
    };
    floaterToggle.addEventListener('click', function() {
      setFloaterOpen(floaterMenu.hidden);
    });

    var floaterCommentBtn = document.getElementById('floater-comment-btn');
    if (floaterCommentBtn) {
      floaterCommentBtn.addEventListener('click', function() {
        goToTalk(true);
        setFloaterOpen(false);
      });
    }
    var floaterReactBtn = document.getElementById('floater-react-btn');
    if (floaterReactBtn) {
      floaterReactBtn.addEventListener('click', function() {
        if (reactBtn) reactBtn.click();
      });
    }
    var floaterShareBtn = document.getElementById('floater-share-btn');
    if (floaterShareBtn) {
      floaterShareBtn.addEventListener('click', function() {
        if (shareBtn) shareBtn.click();
      });
    }
  }
})();
</script>`;
}

function fmtCommentTime(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Real player avatar/name (team-colored ring, links to profile) rather than a generic
// commenter identity — the whole point of tying comments to player_id instead of a
// freeform display name.
// Runs against already-escaped HTML, only ever inserting a fixed <a> structure around
// text that's already safe — matches against a known finite player-name list (not
// generic input), so this can't be used to smuggle unescaped content back in. Names are
// escaped the same way the body was, so matching stays correct even if a name contains
// an HTML-special character (e.g. an apostrophe).
function linkifyMentions(escapedBody, mentionablePlayers) {
  if (!mentionablePlayers || !mentionablePlayers.length) return escapedBody;
  const withEsc = mentionablePlayers
    .map(p => ({ id: p.id, name: escHtml(p.name) }))
    .sort((a, b) => b.name.length - a.name.length); // longest name first, avoids a short name matching inside a longer one
  const pattern = withEsc.map(p => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return escapedBody;
  const byName = new Map(withEsc.map(p => [p.name, p.id]));
  const re = new RegExp('@(' + pattern + ')(?![A-Za-z0-9])', 'g');
  return escapedBody.replace(re, (match, name) => {
    const id = byName.get(name);
    return id ? `<a href="/players/${encodeURIComponent(id)}" class="game-comment__mention">@${name}</a>` : match;
  });
}

function commentRow(c, { reacted, isAdmin, collapsed = false, mentionablePlayers = [] } = {}) {
  const color = teamColor(c.team_name || '');
  return `<li class="game-comment" data-id="${escHtml(c.id)}"${collapsed ? ' hidden' : ''}>
    ${playerAvatar(c.player_id, c.player_name, color, { className: 'game-comment__avatar', link: true })}
    <div class="game-comment__body">
      <div class="game-comment__head">
        ${playerLink(c.player_id, c.player_name, { className: 'game-comment__name' })}
        <span class="game-comment__time">${fmtCommentTime(c.created_at)}</span>
        ${isAdmin ? `<button type="button" class="game-comment__delete" data-delete-id="${escHtml(c.id)}" title="Delete comment" aria-label="Delete comment">✕</button>` : ''}
      </div>
      <p class="game-comment__text">${linkifyMentions(escHtml(c.body), mentionablePlayers)}</p>
      <button type="button" class="game-comment__react${reacted ? ' is-active' : ''}" data-react-id="${escHtml(c.id)}">
        🔥 <span class="game-comment__react-count">${c.reaction_count || 0}</span>
      </button>
    </div>
  </li>`;
}

const COMMENTS_VISIBLE_COUNT = 5;

// List first, composer last — you scroll down through the thread and land on the box to
// add your own, same order as Facebook's comment thread. `comments` arrives oldest-first
// (see stmtGetGameComments), so the most recent COMMENTS_VISIBLE_COUNT stay visible and
// anything older sits behind a "See N more comments" reveal rather than a real paginated
// fetch — comment volume per game is small enough that rendering everything up front and
// just toggling `hidden` client-side is simpler than building cursor-based pagination for
// a scale problem this app doesn't have.
function commentsTabBody({ gameId, comments = [], reactedIds = new Set(), isPlayer = false, isAdmin = false, mentionablePlayers = [] }) {
  const older  = comments.slice(0, -COMMENTS_VISIBLE_COUNT);
  const recent = comments.slice(-COMMENTS_VISIBLE_COUNT);
  const row = c => commentRow(c, { reacted: reactedIds.has(c.id), isAdmin, mentionablePlayers });

  const list = comments.length
    ? `<ul class="game-comments-list" id="game-comments-list">
        ${older.length ? `<li class="game-comments-more"><button type="button" id="gc-see-more">See ${older.length} more comment${older.length === 1 ? '' : 's'}</button></li>` : ''}
        ${older.map(c => commentRow(c, { reacted: reactedIds.has(c.id), isAdmin, collapsed: true, mentionablePlayers })).join('')}
        ${recent.map(row).join('')}
      </ul>`
    : `<p class="game-comments-empty" id="game-comments-empty">No comments yet — be the first to say something.</p>`;

  const composer = isPlayer
    ? `<div class="game-comments-composer">
        <div class="game-comments-composer__box">
          <textarea id="gc-input" maxlength="500" rows="1" placeholder="Write a comment… (@ to mention a player)"></textarea>
          <div id="gc-mention-dropdown" class="game-comments-mention-dropdown" hidden></div>
          <button type="button" id="gc-submit" class="game-comments-composer__send" aria-label="Post comment" disabled><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 1.5L10 6L2 10.5Z" fill="currentColor"/></svg></button>
        </div>
        <span id="gc-msg" class="game-comments-composer__msg"></span>
      </div>`
    : `<div class="game-comments-cta"><a href="/login?next=${encodeURIComponent(`/games/${gameId}`)}">Login</a> to join the conversation.</div>`;

  return `<div class="game-comments-panel">
    <div id="game-comments-container">${list}</div>
    ${composer}
  </div>`;
}

// ══ Game detail page ═══════════════════════════════════════════════════════════════════
// One scrolling page with a sticky section nav (no tabs). Two states share the URL:
//   'upcoming' — the matchup preview: pick box with odds, storyline, head to head, go-to
//                scorers, last meetings, pre-game chatter (this used to be /picks/<game>).
//   'final'    — recap, game flow, top performers (duel + supporting cast), box score, key
//                plays, comments, "Who called it?" and the pre-game preview as it stood.
// Data comes from server.js (GET /games/:ref) and lib/game-detail.js.

const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_FLAME = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
const ICON_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CHAT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

const n0 = v => Number(v) || 0;
const typeLabel = g => ({ playoff: 'Playoffs', finals: 'Finals' }[g.game_type] || 'Regular season');
const longDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const recLine = r => `${r.w}–${r.l}${r.streak ? ` · ${r.streak}` : ''}`;
const sh = (id, title, { link = '', sub = '' } = {}) => `<div class="section-header gd-sh"><h2${id ? ` id="${id}-h"` : ''}>${title}</h2>${link}</div>${sub ? `<p class="gd-sd">${sub}</p>` : ''}`;

// ── Hero ─────────────────────────────────────────────────────────────────────────────────
function heroGlare(game, winner) {
  const a = teamColor(game.team_a_name), b = teamColor(game.team_b_name);
  const k = side => {
    const base = winner === side ? 0x70 : winner ? 0x38 : 0x55;
    const name = side === 'a' ? game.team_a_name : game.team_b_name;
    return Math.round(base * (String(name).toUpperCase() === 'WHITE' ? 0.8 : 1)).toString(16).padStart(2, '0');
  };
  return `radial-gradient(55% 120% at 0% 70%, ${a}${k('a')} 0%, transparent 60%), radial-gradient(55% 120% at 100% 70%, ${b}${k('b')} 0%, transparent 60%)`;
}

function miniLineScore(game, quarterScores) {
  const qs = quarterScores.filter(s => s.a != null && s.b != null);
  if (!qs.length) return '';
  const lbl = q => (q <= 4 ? `Q${q}` : `OT${q - 4}`);
  const cell = (v, other) => `<td${v > other ? ' class="is-w"' : ''}>${v}</td>`;
  const fa = n0(game.team_a_score), fb = n0(game.team_b_score);
  return `<table class="gd-ls" aria-label="Score by quarter">
      <thead><tr><th></th>${qs.map(s => `<th>${lbl(s.quarter)}</th>`).join('')}<th>T</th></tr></thead>
      <tbody>
        <tr><td class="gd-ls__n">${escHtml(String(game.team_a_name).slice(0, 3))}</td>${qs.map(s => cell(s.a, s.b)).join('')}<td class="gd-ls__t${fa > fb ? ' is-win' : ''}">${fa}</td></tr>
        <tr><td class="gd-ls__n">${escHtml(String(game.team_b_name).slice(0, 3))}</td>${qs.map(s => cell(s.b, s.a)).join('')}<td class="gd-ls__t${fb > fa ? ' is-win' : ''}">${fb}</td></tr>
      </tbody>
    </table>`;
}

function heroActions({ game, commentsEnabled, gameReaction, watch }) {
  return `<span class="gd-acts">
      ${watch ? `<a class="gd-btn gd-btn--amber" href="#watch">${ICON_PLAY}Watch the game</a>` : ''}
      ${commentsEnabled ? `<button type="button" id="game-react-btn" class="gd-btn${gameReaction.reacted ? ' is-active' : ''}" title="React to this game">${ICON_FLAME}<span>React</span><b id="game-react-count">${gameReaction.count || 0}</b></button>` : ''}
      <button type="button" id="game-share-btn" class="gd-btn" title="Share">${ICON_SHARE}<span>Share</span></button>
    </span>`;
}

function finalHero(d) {
  const { game, ctx, flow, called } = d;
  const fa = n0(game.team_a_score), fb = n0(game.team_b_score);
  const winner = fa > fb ? 'a' : fb > fa ? 'b' : null;
  const ot = n0(game.overtime);
  const finalLabel = ot === 0 ? 'FINAL' : ot === 1 ? 'FINAL/OT' : `FINAL/OT${ot}`;
  const odds = called?.odds;
  let oddsChip = '';
  if (odds?.fav && winner) {
    const favName = odds.fav === 'a' ? game.team_a_name : game.team_b_name;
    const winPct = winner === 'a' ? odds.pctA : odds.pctB;
    oddsChip = odds.fav === winner
      ? `<a href="#picks" class="gd-chip gd-chip--amber">Odds called it · ${escHtml(tc(favName))} ${winPct}%</a>`
      : `<a href="#picks" class="gd-chip gd-chip--amber">Upset · ${escHtml(tc(winner === 'a' ? game.team_a_name : game.team_b_name))} won with ${winPct}%</a>`;
  }
  const s = ctx.series;
  const meta = [
    longDay(d.ymd),
    flow && winner && flow.trailedBy >= 8 ? `Came back from ${flow.trailedBy} down` : flow && winner && !flow.forGood && flow.trailedBy === 0 ? 'Led wire to wire' : '',
    s.n <= 1 ? 'First meeting' : s.a === s.b ? `All-time series tied ${s.a}–${s.b}` : `${tc(s.a > s.b ? game.team_a_name : game.team_b_name)} lead the all-time series ${Math.max(s.a, s.b)}–${Math.min(s.a, s.b)}`,
  ].filter(Boolean);
  return `<section class="gd-hero" aria-label="Final score">
    ${game.has_cover ? `<img class="gd-hero__img" src="/api/photo/${encodeURIComponent(game.id)}" alt="">` : ''}
    <div class="gd-hero__shade"></div>
    <div class="gd-hero__glare" style="background:${heroGlare(game, winner)}"></div>
    <div class="gd-hero__in">
      <div class="gd-hero__top"><span class="gd-chip">Season ${escHtml(String(game.season))} · ${typeLabel(game)}${ctx.number ? ` · Game ${ctx.number}` : ''}</span>${oddsChip}</div>
      <div class="gd-board">
        <div class="gd-tm"><span class="gd-tm__nm">${dot(game.team_a_name, 13)}<a href="/teams/${encodeURIComponent(game.team_a_id)}">${escHtml(game.team_a_name)}</a></span><span class="gd-tm__rec">${recLine(ctx.recA)}</span></div>
        <div class="gd-score">
          <span class="gd-score__n${winner === 'a' ? ' is-win' : ''}">${fa}</span>
          <span class="gd-score__mid"><span class="gd-final">${finalLabel}</span>${miniLineScore(game, d.quarterScores)}</span>
          <span class="gd-score__n${winner === 'b' ? ' is-win' : ''}">${fb}</span>
        </div>
        <div class="gd-tm gd-tm--b"><span class="gd-tm__nm"><a href="/teams/${encodeURIComponent(game.team_b_id)}">${escHtml(game.team_b_name)}</a>${dot(game.team_b_name, 13)}</span><span class="gd-tm__rec">${recLine(ctx.recB)}</span></div>
      </div>
      <div class="gd-hero__bot"><span class="gd-meta">${meta.map(escHtml).join('<i>·</i>')}</span>${heroActions({ game, commentsEnabled: d.commentsEnabled, gameReaction: d.gameReaction, watch: !!youtubeEmbedUrl(game.youtube_url) })}</div>
    </div>
  </section>`;
}

function upcomingHero(d) {
  const { game, ctx, picks } = d;
  const ymd = d.ymd;
  const dt = ymd ? new Date(`${ymd}T00:00:00`) : null;
  const slide = picks?.m?.slides?.[0];
  const s = ctx.series;
  const state = picks?.state;
  const chip = state === 'open' ? 'Picks open' : state === 'closed' ? 'Picks closed' : 'Coming up';
  const closeAt = state === 'open' && picks.o?.closeHm && ymd ? `${ymd}T${picks.o.closeHm}:00+08:00` : '';
  return `<section class="gd-hero gd-hero--up" aria-label="Upcoming game">
    ${slide ? `<img class="gd-hero__img" src="/api/photo/${encodeURIComponent(slide)}" alt="">` : ''}
    <div class="gd-hero__shade"></div>
    <div class="gd-hero__glare" style="background:${heroGlare(game, null)}"></div>
    <div class="gd-hero__in">
      <div class="gd-hero__top"><span class="gd-chip">Season ${escHtml(String(game.season))} · ${typeLabel(game)}${ctx.number ? ` · Game ${ctx.number}` : ''}</span><a href="#picks" class="gd-chip${state === 'open' ? ' gd-chip--live' : ''}">${chip}</a></div>
      <div class="gd-board">
        <div class="gd-tm"><span class="gd-tm__nm">${dot(game.team_a_name, 13)}<a href="/teams/${encodeURIComponent(game.team_a_id)}">${escHtml(game.team_a_name)}</a></span><span class="gd-tm__rec">${recLine(ctx.recA)}</span></div>
        <div class="gd-when">
          ${dt ? `<span class="gd-when__k">${dt.toLocaleDateString('en-US', { weekday: 'long' })}</span><span class="gd-when__d">${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>` : '<span class="gd-when__d">TBD</span>'}
          ${s.n ? `<span class="gd-h2h"><span>All-time</span><b class="${s.a >= s.b ? 'is-lead' : ''}">${s.a}</b><i>–</i><b class="${s.b >= s.a ? 'is-lead' : ''}">${s.b}</b></span>` : '<span class="gd-h2h"><span>First meeting</span></span>'}
        </div>
        <div class="gd-tm gd-tm--b"><span class="gd-tm__nm"><a href="/teams/${encodeURIComponent(game.team_b_id)}">${escHtml(game.team_b_name)}</a>${dot(game.team_b_name, 13)}</span><span class="gd-tm__rec">${recLine(ctx.recB)}</span></div>
      </div>
      <div class="gd-hero__bot">
        ${closeAt ? `<div class="gd-cd" data-close="${escHtml(closeAt)}"><span class="gd-cd__k">Picks close in</span><span class="gd-cd__n"><span><b data-cd="d">–</b><i>DAYS</i></span><span><b data-cd="h">–</b><i>HRS</i></span><span><b data-cd="m">–</b><i>MIN</i></span></span></div>` : '<span></span>'}
        ${heroActions({ game, commentsEnabled: d.commentsEnabled, gameReaction: d.gameReaction, watch: false })}
      </div>
    </div>
  </section>`;
}

// ── Sticky section nav (replaces the tab bar) ────────────────────────────────────────────
function sectionNav(items, mini) {
  return `<nav class="gd-snav" aria-label="On this page" data-gd-snav>
    ${mini ? `<span class="gd-snav__mini">${mini}</span>` : ''}
    ${items.map((it, i) => `<a href="#${it.id}" class="${i === 0 ? 'is-on' : ''}" data-spy="${it.id}">${escHtml(it.label)}${it.badge != null ? `<em${it.badgeId ? ` id="${it.badgeId}"` : ''}${it.badge ? '' : ' hidden'}>${it.badge}</em>` : ''}</a>`).join('')}
  </nav>`;
}

// ── Final: recap, video, how it was won, game flow ───────────────────────────────────────
function recapCard(game) {
  const html = renderWriteup(game.game_writeup);
  if (!html) return '';
  return `<article id="recap" class="card gd-recap">
    <span class="gd-kick">Recap</span>
    <div class="gd-recap__body" data-gd-clamp>${html}</div>
    <button type="button" class="gd-more" data-gd-clamp-btn hidden aria-expanded="false">Read the full recap →</button>
  </article>`;
}

function videoCard(game) {
  const url = youtubeEmbedUrl(game.youtube_url);
  if (!url) return '';
  return `<section id="watch" class="gd-video card" aria-label="Game video">
    <iframe src="${escHtml(url)}" title="${escHtml(`${tc(game.team_a_name)} vs ${tc(game.team_b_name)} — full game`)}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
  </section>`;
}

function wonBlock(won) {
  if (!won.length) return '';
  return `<section aria-labelledby="won-h">
    ${sh('won', 'How it was won', { sub: 'The biggest gaps in the box score.' })}
    <div class="gd-won">${won.map(w => `<div class="gd-won__t">
      <span class="gd-kick">${escHtml(w.label)}</span>
      <div class="gd-won__v"><b class="font-condensed">+${w.n}</b><span>${dot(w.team, 9)}${escHtml(w.team.toUpperCase())}</span></div>
      <div class="gd-won__d">${escHtml(w.detail)}</div>
    </div>`).join('')}</div>
  </section>`;
}

function flowCard(game, flow) {
  if (!flow) return '';
  const c = flowChart(flow);
  const A = String(game.team_a_name).slice(0, 3).toUpperCase(), B = String(game.team_b_name).slice(0, 3).toUpperCase();
  const ca = teamColor(game.team_a_name), cb = teamColor(game.team_b_name);
  const best = [flow.bestA, flow.bestB].filter(Boolean).sort((x, y) => y.n - x.n)[0];
  const lead = side => flow.maxLead[side] ? `${flow.maxLead[side].n} <small>${side === 'a' ? A : B}</small>` : '';
  const pct = v => `${Math.min(96, Math.max(0, v / c.w * 100)).toFixed(1)}%`;
  // Annotations: the loser's biggest lead, the best run (shaded) and the go-ahead basket.
  const notes = [];
  const loser = flow.winner === 'a' ? 'b' : flow.winner === 'b' ? 'a' : null;
  const ml = loser && flow.maxLead[loser];
  if (ml && ml.n >= 6) {
    const yy = c.y(ml.p.a - ml.p.b);
    notes.push(`<circle cx="${c.x(ml.p.t)}" cy="${yy}" r="4" fill="${loser === 'a' ? ca : cb}" stroke="#0a0e16" stroke-width="2"/>`);
    notes.push({ html: `${escHtml(tc(loser === 'a' ? game.team_a_name : game.team_b_name))} up ${ml.n} · ${ml.p.a}–${ml.p.b}`, left: pct(c.x(ml.p.t) - 60), top: yy > c.mid ? 'calc(100% - 26px)' : '0' });
  }
  if (best && best.n >= 8) {
    notes.push({ html: `${best.n}–0 ${escHtml(tc(best.side === 'a' ? game.team_a_name : game.team_b_name))} run`, left: pct(c.x(best.end.t) - 90), top: best.side === 'a' ? '58%' : '28%', amber: true });
  }
  if (flow.forGood) {
    const gx = c.x(flow.forGood.t), gy = c.y(flow.forGood.a - flow.forGood.b);
    notes.push(`<line x1="${gx}" y1="${c.mid}" x2="${gx}" y2="12" stroke="#f59332" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="${gx}" cy="${gy}" r="4" fill="#f59332"/>`);
    notes.push({ html: `${escHtml(shortName(flow.forGood.who))} · ${flow.forGood.a}–${flow.forGood.b} · ahead for good`, left: pct(gx - 40), top: '0', amber: true, right: gx > c.w * 0.6 });
  }
  // Shade the best run between its first and last basket.
  let band = '';
  if (best && best.n >= 8) {
    const i = flow.points.indexOf(best.end);
    let j = i; while (j > 0) { const p = flow.points[j - 1]; const prev = flow.points[j - 2] || { a: 0, b: 0 }; const side = p.a > prev.a ? 'a' : 'b'; if (side !== best.side) break; j--; }
    const x1 = c.x(flow.points[Math.max(0, j - 1)].t), x2 = c.x(best.end.t);
    band = `<rect x="${x1}" y="0" width="${Math.max(2, x2 - x1).toFixed(1)}" height="${c.h}" fill="rgba(245,147,50,.08)"/>`;
  }
  const svgNotes = notes.filter(n => typeof n === 'string').join('');
  const labels = notes.filter(n => typeof n !== 'string')
    .map(n => `<span class="gd-ann${n.amber ? ' gd-ann--a' : ''}" style="${n.right ? `right:0;` : `left:${n.left};`}top:${n.top}">${n.html}</span>`).join('');
  return `<section id="flow" class="card gd-flow" aria-labelledby="flow-h">
    <div class="gd-flow__h"><h2 id="flow-h">Game flow</h2><span class="gd-legend"><span>${dot(game.team_a_name, 9)}${escHtml(tc(game.team_a_name))} ahead</span><span>${dot(game.team_b_name, 9)}${escHtml(tc(game.team_b_name))} ahead</span></span></div>
    <div class="gd-flow__stats">
      <div><span class="gd-kick">Lead changes</span><b class="font-condensed">${flow.leadChanges}</b></div>
      <div><span class="gd-kick">Ties</span><b class="font-condensed">${flow.ties}</b></div>
      <div><span class="gd-kick">Biggest lead</span><b class="font-condensed">${[lead('a'), lead('b')].filter(Boolean).join(' · ') || '–'}</b></div>
      ${best ? `<div><span class="gd-kick">Best run</span><b class="font-condensed">${best.n}–0 <small>${best.side === 'a' ? A : B}</small></b></div>` : ''}
    </div>
    <div class="gd-chart">
      <svg viewBox="0 0 ${c.w} ${c.h}" role="img" aria-label="Score margin through the game: ${escHtml(tc(game.team_a_name))} above the line, ${escHtml(tc(game.team_b_name))} below. ${flow.leadChanges} lead changes.">
        <defs><clipPath id="gdTop"><rect x="0" y="0" width="${c.w}" height="${c.mid}"/></clipPath><clipPath id="gdBot"><rect x="0" y="${c.mid}" width="${c.w}" height="${c.mid}"/></clipPath></defs>
        ${c.qLines.map(l => `<line x1="${l.x}" y1="0" x2="${l.x}" y2="${c.h}" stroke="rgba(255,255,255,${l.half ? '.12' : '.07'})"${l.half ? ' stroke-dasharray="3 4"' : ''}/>`).join('')}
        ${band}
        <path clip-path="url(#gdTop)" fill="${ca}" fill-opacity="${String(game.team_a_name).toUpperCase() === 'WHITE' ? '.3' : '.4'}" d="${c.area}"/>
        <path clip-path="url(#gdBot)" fill="${cb}" fill-opacity="${String(game.team_b_name).toUpperCase() === 'WHITE' ? '.3' : '.4'}" d="${c.area}"/>
        <path fill="none" stroke="#e7eaf0" stroke-width="1.4" stroke-linejoin="round" d="${c.line}"/>
        <line x1="0" y1="${c.mid}" x2="${c.w}" y2="${c.mid}" stroke="rgba(255,255,255,.25)"/>
        ${svgNotes}
        <text x="4" y="${c.tickY + 4}" class="gd-chart__tick">${A} +${c.tick}</text>
        <text x="4" y="${c.h - c.tickY + 4}" class="gd-chart__tick">${B} +${c.tick}</text>
      </svg>
      ${labels}
    </div>
    <div class="gd-qx">${c.qs.map(q => `<span style="width:${q.w}%">${q.label}</span>`).join('')}</div>
  </section>`;
}

// ── Rail: Who called it?, Up next ────────────────────────────────────────────────────────
function calledCard(game, called, isPlayer) {
  if (!called) return '';
  const { odds, result } = called;
  const fa = n0(game.team_a_score), fb = n0(game.team_b_score);
  const winner = fa > fb ? 'a' : 'b';
  const T = side => tc(side === 'a' ? game.team_a_name : game.team_b_name);
  const ok = v => (v ? '<span class="pk-ok">✓ Called it</span>' : '<span class="pk-miss">✕ Missed</span>');
  const rows = [];
  if (odds?.fav) {
    const proj = Math.max(1, Math.round(Math.abs(odds.margin)));
    rows.push(`<div class="gd-vr"><span class="gd-kick">Odds</span><span>${escHtml(T(odds.fav))} by <b>${proj}</b> · ${escHtml(T(winner))} won by <b>${Math.abs(fa - fb)}</b></span>${ok(odds.fav === winner)}</div>`);
  }
  if (result) {
    rows.push(result.total
      ? `<div class="gd-vr"><span class="gd-kick">Pickers</span><span><b>${result.pctWinner}%</b> picked ${escHtml(T(winner))} · ${result.total} pick${result.total === 1 ? '' : 's'}</span>${result.pctWinner === 50 ? '' : ok(result.fansCalled)}</div>`
      : '<div class="gd-vr"><span class="gd-kick">Pickers</span><span>Nobody picked this game</span><span></span></div>');
    if (isPlayer) rows.push(`<div class="gd-vr"><span class="gd-kick">You</span><span>${result.myPick ? `You picked <b>${escHtml(T(result.myPick))}</b>` : "You didn't pick"}</span>${result.myPick ? ok(result.myPick === winner) : '<span></span>'}</div>`);
  }
  const faces = result?.calledIt?.length ? `<div class="gd-faces">${result.calledIt.slice(0, 6).map(p => pickAvatar(p, 28)).join('')}<span><b>${result.calledIt.length}</b> called it</span></div>` : '';
  return `<section id="picks" class="card gd-called" aria-labelledby="picks-h">
    <div class="gd-card__h"><h2 id="picks-h">Who called it?</h2>${result?.upset ? '<span class="pk-upset">Upset</span>' : ''}</div>
    ${odds ? `<span class="gd-kick">Odds before tip-off</span>
    <div class="gd-oline">
      <span class="gd-oline__s${odds.fav === 'a' ? ' is-fav' : ''}">${dot(game.team_a_name, 8)}${escHtml(String(game.team_a_name).slice(0, 3))} <b class="font-condensed">${odds.pctA}%</b></span>
      <span class="gd-obar"><span style="width:${odds.pctA}%"></span></span>
      <span class="gd-oline__s${odds.fav === 'b' ? ' is-fav' : ''}"><b class="font-condensed">${odds.pctB}%</b> ${escHtml(String(game.team_b_name).slice(0, 3))}${dot(game.team_b_name, 8)}</span>
    </div>` : ''}
    ${rows.length ? `<div class="gd-vrd">${rows.join('')}</div>` : ''}
    ${faces}
    ${called.hasPreview ? '<a class="gd-lnk" href="#preview" data-gd-open-preview>Pre-game preview<small>Odds, storyline and matchup stats as they stood at tip-off</small><span>↓</span></a>' : ''}
  </section>`;
}

function upNextCard(list, ymdLabel) {
  if (!list.length) return '';
  return `<section class="card gd-next" aria-label="Up next">
    <div class="gd-card__h"><h2>Up next${ymdLabel ? ` · ${escHtml(ymdLabel)}` : ''}</h2><a href="/picks">All picks</a></div>
    ${list.map(o => {
      const fav = o.odds?.fav;
      const pct = fav ? (fav === 'a' ? o.odds.pctA : o.odds.pctB) : null;
      return `<div class="gd-nx">
        <div>
          <span class="gd-nx__t">${dot(o.a, 8)}${escHtml(o.a)} <i>vs</i> ${escHtml(o.b)}${dot(o.b, 8)}</span>
          ${o.odds ? `<span class="gd-nx__o"><span class="gd-obar"><span style="width:${o.odds.pctA}%"></span></span>${fav ? `${escHtml(tc(fav === 'a' ? o.a : o.b))} ${pct}%${Math.abs(o.odds.pctA - 50) <= 5 ? ' · a coin flip' : ''}` : 'Even'}</span>` : ''}
        </div>
        <a class="gd-pk" href="${escHtml(o.href)}#picks">${o.myPick ? 'Picked' : o.closed ? 'View' : 'Pick'}</a>
      </div>`;
    }).join('')}
  </section>`;
}

// ── Final: top performers (duel + supporting cast) ───────────────────────────────────────
function duelSide(s, side, potgId, say) {
  const color = teamColor(s.team_name);
  const tag = s.player_id === potgId ? '<span class="gd-dl__tag">PLAYER OF THE GAME</span>' : s.badge ? `<span class="gd-dl__tag gd-dl__tag--ghost">${escHtml(s.badge)}</span>` : '';
  return `<div class="gd-dl__p${side === 'b' ? ' gd-dl__p--r' : ''}">
      <a href="/players/${encodeURIComponent(s.player_id)}" class="gd-dl__ph" style="--team:${color}" tabindex="-1" aria-hidden="true">
        <span class="font-condensed">${escHtml(initials(displayPlayerName(s.name)))}</span>
        <img src="/api/player/${encodeURIComponent(s.player_id)}/photo" alt="" loading="lazy" onerror="this.remove()">
      </a>
      <div class="gd-dl__i">
        ${tag}
        <span class="gd-dl__nm">${playerLink(s.player_id, s.name || '', { upper: true })}<small>${dot(s.team_name, 8)}${escHtml(s.team_name)}${s.number !== '' && s.number != null ? ` · #${escHtml(String(s.number))}` : ''}</small></span>
        <span class="gd-dl__gs">Game score <b class="font-condensed">${s.gs.toFixed(1)}</b></span>
        ${say(s)}
      </div>
    </div>`;
}

function duelRows(a, b) {
  const fg = s => { const m = n0(s.fg2m) + n0(s.fg3m) + n0(s.fg4m); const at = m + n0(s.fg2m_miss) + n0(s.fg3m_miss) + n0(s.fg4m_miss); return at ? Math.round(m / at * 100) : null; };
  const defs = [
    ['PTS', n0(a.pts), n0(b.pts)], ['REB', n0(a.reb), n0(b.reb)], ['AST', n0(a.ast), n0(b.ast)],
    ['STL', n0(a.stl), n0(b.stl)], ['BLK', n0(a.blk), n0(b.blk)],
    ...(fg(a) != null && fg(b) != null ? [['FG%', fg(a), fg(b), '%']] : []),
    ['TO', n0(a.turnover), n0(b.turnover), '', true],
  ].filter(([k, x, y]) => k !== 'BLK' || x + y > 0);
  return defs.map(([k, x, y, suf = '', low = false]) => {
    const max = Math.max(x, y) || 1;
    const aw = x !== y && (low ? x < y : x > y), bw = x !== y && !aw;
    const w = v => (low ? (Math.min(x, y) === v ? 100 : Math.round(Math.min(x, y) / max * 100) || 8) : Math.round(v / max * 100));
    const wa = low ? (aw ? 100 : Math.max(8, Math.round(y / Math.max(x, 1) * 100))) : w(x);
    const wb = low ? (bw ? 100 : Math.max(8, Math.round(x / Math.max(y, 1) * 100))) : w(y);
    const tie = x === y;
    return `<div class="gd-dlr"><span class="gd-dlr__v${aw || tie ? ' is-w' : ''}">${x}${suf}</span><span class="gd-dlr__l"><i class="${aw || tie ? 'is-w' : ''}" style="width:${wa}%"></i></span><span class="gd-dlr__k">${k}</span><span class="gd-dlr__r"><i class="${bw || tie ? 'is-w' : ''}" style="width:${wb}%"></i></span><span class="gd-dlr__v${bw || tie ? ' is-w' : ''}">${y}${suf}</span></div>`;
  }).join('');
}

function castCol(game, side, list, say) {
  const name = side === 'a' ? game.team_a_name : game.team_b_name;
  if (!list.length) return `<div class="card gd-cast__col"><div class="gd-cast__h">${dot(name, 8)}${escHtml(name)} · SUPPORTING CAST</div><p class="gd-cast__none">Nobody else reached a game score of 10.</p></div>`;
  return `<div class="card gd-cast__col">
    <div class="gd-cast__h">${dot(name, 8)}${escHtml(name)} · SUPPORTING CAST</div>
    ${list.map(s => `<div class="gd-cr">
      ${playerAvatar(s.player_id, s.name, teamColor(s.team_name), { className: 'gd-cr__av', link: true })}
      <div><span class="gd-cr__nm">${playerLink(s.player_id, s.name || '')}</span><span class="gd-cr__ln">${s.badge ? `<span class="gd-hook">${escHtml(s.badge)}</span>` : ''}${escHtml(castLine(s))}</span>${say(s, true)}</div>
      <span class="gd-cr__p"><b class="font-condensed">${n0(s.pts)}</b><span>PTS</span></span>
    </div>`).join('')}
  </div>`;
}

// "Say something" for a performer: jumps to the comments with "@Name " already typed (plain
// "Name " when they have no login to be mentioned). Guests are sent to log in first.
function sayButton(mentionable) {
  const names = new Set(mentionable.map(p => p.name));
  return (s, small = false) => {
    const name = displayPlayerName(s.name || '');
    const text = names.has(name) ? `@${name} ` : `${name} `;
    return `<button type="button" class="gd-say${small ? ' gd-say--sm' : ''}" data-say="${escHtml(text)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Say something<span class="sr-only"> to ${escHtml(name)}</span></button>`;
  };
}

// say(s, small): the "Say something" button for a player (empty when comments are off).
function performersSection(game, dc, verdict, potgId, say = () => '') {
  if (!dc) return '';
  return `<section id="perf" class="gd-sec" aria-labelledby="perf-h">
    ${sh('perf', 'Top performers', { link: '<a href="#box" class="section-header__link">Full box score →</a>', sub: 'The best player on each side, head to head. Then the rest of each team’s standouts, ranked by game score.' })}
    <article class="card gd-dl" aria-label="The duel">
      <div class="gd-dl__top">
        <div class="gd-dl__bg gd-dl__bg--l" aria-hidden="true" style="--team:${teamColor(dc.a.team_name)}"><img src="/api/player/${encodeURIComponent(dc.a.player_id)}/photo" alt="" loading="lazy" onerror="this.remove()"></div>
        <div class="gd-dl__bg gd-dl__bg--r" aria-hidden="true" style="--team:${teamColor(dc.b.team_name)}"><img src="/api/player/${encodeURIComponent(dc.b.player_id)}/photo" alt="" loading="lazy" onerror="this.remove()"></div>
        ${duelSide(dc.a, 'a', potgId, say)}
        <div class="gd-dl__rows"><span class="gd-kick">Head to head</span>${duelRows(dc.a, dc.b)}</div>
        ${duelSide(dc.b, 'b', potgId, say)}
      </div>
      <div class="gd-dl__v">${verdict}</div>
    </article>
    <div class="gd-cast">${castCol(game, 'a', dc.castA, say)}${castCol(game, 'b', dc.castB, say)}</div>
    <p class="gd-sd gd-sd--foot">Up to 3 more per side with a game score of 10+. Each badge is picked by code: a career or season high, a double-double, 5+ threes, or double their season average.</p>
  </section>`;
}

// ── Final: box score + team stats ────────────────────────────────────────────────────────
function teamStatsCard(game, A, B) {
  const pc = (m, a) => (a ? +(m / a * 100).toFixed(1) : null);
  const rows = [
    ['FG%', pc(A.fgm, A.fga), pc(B.fgm, B.fga)],
    ['3PT MADE', A.fg3m, B.fg3m], ['3PT%', pc(A.fg3m, A.fg3a), pc(B.fg3m, B.fg3a)],
    ...(A.fg4a + B.fg4a ? [['4PT MADE', A.fg4m, B.fg4m]] : []),
    ['FT%', pc(A.ftm, A.fta), pc(B.ftm, B.fta)],
    ['REBOUNDS', A.reb, B.reb], ['ASSISTS', A.ast, B.ast], ['STEALS', A.stl, B.stl], ['BLOCKS', A.blk, B.blk],
    ['TURNOVERS', A.to, B.to, true],
  ].filter(r => r[1] != null && r[2] != null);
  const fmt = (v, k) => (k.includes('%') ? v.toFixed(1) : v);
  return `<div class="card gd-cmp">
    <div class="gd-cmp__h"><span>${dot(game.team_a_name, 8)}${escHtml(String(game.team_a_name).slice(0, 3))}</span><span>${escHtml(String(game.team_b_name).slice(0, 3))}${dot(game.team_b_name, 8)}</span></div>
    ${rows.map(([k, a, b, low]) => {
      const max = Math.max(a, b) || 1;
      const aw = a !== b && (low ? a < b : a > b), bw = a !== b && !aw;
      return `<div class="gd-cr2"><span class="gd-cr2__v${aw ? ' is-w' : ''}">${fmt(a, k)}</span><span class="gd-cr2__m"><span>${k}</span><span class="gd-cr2__bars"><span class="gd-cr2__l"><i class="${aw ? 'is-w' : ''}" style="width:${Math.round(a / max * 100)}%"></i></span><span class="gd-cr2__r"><i class="${bw ? 'is-w' : ''}" style="width:${Math.round(b / max * 100)}%"></i></span></span></span><span class="gd-cr2__v${bw ? ' is-w' : ''}">${fmt(b, k)}</span></div>`;
    }).join('')}
  </div>`;
}

function boxSection(game, stats, dnpPlayers, A, B) {
  if (!stats.length) return '';
  const { byTeam, dnpByTeam, winner, teamTurnovers } = buildBoxScoreData(game, stats, dnpPlayers);
  const na = String(game.team_a_name).toUpperCase(), nb = String(game.team_b_name).toUpperCase();
  const first = winner === nb ? 'b' : 'a';
  const panel = (side, name) => `<div class="gd-box__panel" data-gd-box="${side}"${side === first ? '' : ' hidden'}>${teamBoxScoreTab(name, byTeam, dnpByTeam, winner, teamTurnovers)}</div>`;
  return `<div class="gd-cols gd-sec">
    <section id="box" class="gd-cols__main" aria-labelledby="box-h">
      <div class="section-header gd-sh gd-sh--row"><h2 id="box-h">Box score</h2>
        <span class="gd-seg" role="group" aria-label="Team">
          <button type="button" class="${first === 'a' ? 'is-on' : ''}" aria-pressed="${first === 'a'}" data-gd-box-btn="a">${dot(na, 8)}${escHtml(na)} · ${n0(game.team_a_score)}</button>
          <button type="button" class="${first === 'b' ? 'is-on' : ''}" aria-pressed="${first === 'b'}" data-gd-box-btn="b">${dot(nb, 8)}${escHtml(nb)} · ${n0(game.team_b_score)}</button>
        </span>
      </div>
      <div class="card gd-box">${panel('a', na)}${panel('b', nb)}</div>
    </section>
    <aside class="gd-cols__rail" aria-labelledby="ts-h">
      <div class="section-header gd-sh"><h2 id="ts-h">Team stats</h2></div>
      ${teamStatsCard(game, A, B)}
    </aside>
  </div>`;
}

// ── Final: key plays ──────────────────────────────────────────────────────────────────────
function playsBlock(game, plays) {
  let hasLog = false;
  try { hasLog = JSON.parse(game.game_log_json || '[]').length > 0; } catch {}
  if (!plays.length && !hasLog) return '';
  const color = side => (side ? teamColor(side === 'a' ? game.team_a_name : game.team_b_name) : '#5b6475');
  return `<section id="plays" class="gd-plays-sec" aria-labelledby="plays-h">
    ${sh('plays', 'Key plays', { sub: plays.length ? 'Picked from the scoring log: runs, the biggest leads and the go-ahead basket.' : '' })}
    ${plays.length ? `<div class="card gd-plays">${plays.map(p => `<div class="gd-pl${p.big ? ' gd-pl--big' : ''}">
      <span class="gd-pl__t">${escHtml(p.qLabel)}${p.qLabel !== 'HALF' && p.qLabel !== 'FINAL' && p.clock ? `<b class="font-condensed">${escHtml(p.clock)}</b>` : ''}</span>
      <span class="gd-pl__dot" style="background:${p.big ? '#f59332' : color(p.side)}"></span>
      <span class="gd-pl__x"><b>${escHtml(p.strong)}</b>${p.rest ? ` ${escHtml(p.rest)}` : ''}</span>
      <span class="gd-pl__s font-condensed">${p.score.a}<i>–</i>${p.score.b}</span>
    </div>`).join('')}</div>` : ''}
    ${hasLog ? `<details class="gd-pbp"><summary>Full play-by-play</summary>${playByPlayTab(game)}</details>` : ''}
  </section>`;
}

// ── Comments ──────────────────────────────────────────────────────────────────────────────
function talkSection(d, title) {
  if (!d.commentsEnabled) return '';
  return `<section id="talk" class="gd-talk" aria-labelledby="talk-h">
    <div class="section-header gd-sh gd-sh--row"><h2 id="talk-h">${title}</h2><span class="gd-live">LIVE</span></div>
    <div class="card gd-talk__card" id="game-talk">${commentsTabBody({ gameId: d.game.id, comments: d.comments, reactedIds: d.reactedIds, isPlayer: d.isPlayer, isAdmin: d.isAdmin, mentionablePlayers: d.mentionable })}</div>
  </section>`;
}

// ── The matchup preview (upcoming page body, and the archived copy after the final) ─────────
function storyBlock(game, story, { isAdmin, regen }) {
  if (!story && !regen) return '';
  return `<article class="card gd-story" id="story">
    <span class="gd-kick gd-kick--amber">The storyline</span>
    ${story ? `<h3 class="gd-story__head">${storyHtml(story.headline)}</h3>
    <p class="gd-story__body">${escHtml(story.body)}</p>` : '<p class="gd-story__body">No storyline yet — it’s written in the background, or regenerate it now.</p>'}
    ${regen && isAdmin ? `<button type="button" class="hs-summary__regen gm-story__regen" data-matchup="${escHtml(game.id)}">↺ Regenerate</button>` : ''}
  </article>`;
}

function edgesBlock(m) {
  if (!m.rows?.length) return '';
  const gap = r => Math.abs(r.a - r.b) / (Math.max(r.a, r.b) || 1);
  const ranked = [...m.rows].sort((x, y) => gap(y) - gap(x));
  const top = new Set(ranked.slice(0, 5).map(r => r.key));
  const basis = m.firstMeeting ? `First meeting · Season ${escHtml(String(m.season))} per game` : `Per game in their ${m.meetings} meeting${m.meetings === 1 ? '' : 's'}${m.boxMeetings < m.meetings ? ` (${m.boxMeetings} with box scores)` : ''}, all seasons. Biggest edges first.`;
  return `<section id="h2h" aria-labelledby="h2h-h">
    ${sh('h2h', 'Head to head', { sub: basis })}
    <div class="card gd-edges-card">
      <div class="gm-edges">${ranked.map(r => `<div class="gm-st-wrap${top.has(r.key) ? '' : ' is-extra'}">${edgeRow(r)}</div>`).join('')}</div>
      ${m.rows.length > 5 ? `<button type="button" class="gm-more" data-more aria-expanded="false">Show all ${m.rows.length} stats</button>` : ''}
    </div>
  </section>`;
}

function scorersBlock(m) {
  if (m.scorers?.length !== 2 || !(m.scorers[0] || m.scorers[1])) return '';
  const [sa, sb] = m.scorers;
  if (sa && sb) { sa.lead = sa.ppg > sb.ppg; sb.lead = sb.ppg > sa.ppg; }
  return `<section id="watchlist" aria-labelledby="watchlist-h">
    ${sh('watchlist', 'Players to watch', { sub: 'Each side’s top scorer against this opponent.' })}
    <div class="gm-fo gd-fo">${scorerCard(sa, 'a')}${scorerCard(sb, 'b')}<span class="gm-fo__vs font-condensed" aria-hidden="true">VS</span></div>
  </section>`;
}

function meetingsBlock(m) {
  if (!m.lastMeetings?.length) return '';
  return `<section id="meetings" aria-labelledby="meetings-h">
    ${sh('meetings', m.lastMeetings.length === 1 ? 'Last meeting' : 'Last meetings', { sub: 'Tap one for its box score.' })}
    <div class="gm-mts gd-mts">${m.lastMeetings.map(x => meetingTile(m, x)).join('')}</div>
  </section>`;
}

function pickRail(d) {
  const { picks, game } = d;
  if (!picks?.pickable) return '';
  const { state, o, m } = picks;
  let body;
  if ((state === 'open' || state === 'closed') && o) {
    const total = n0(o.counts?.a) + n0(o.counts?.b);
    body = `<div class="gd-card__h"><h2 id="picks-h">Who wins?</h2><span class="gd-card__note" data-pick-total>${state === 'closed' ? `Picks closed · ${total} pick${total === 1 ? '' : 's'}` : total ? `${total} pick${total === 1 ? '' : 's'} so far` : 'Be the first to pick'}</span></div>
      ${pickBox(o, { isPlayer: d.isPlayer, next: `/games/${encodeURIComponent(gameSlug(game))}#picks`, oddsHtml: o.odds ? oddsLine(m, o.odds) : '', flag: true })}
      ${d.commentsEnabled && d.isPlayer && state === 'open' ? talkLink(o.id, '#talk', !!o.myPick) : ''}`;
  } else {
    body = `<div class="gd-card__h"><h2 id="picks-h">Who wins?</h2></div>
      ${picks.odds ? oddsLine(m, picks.odds) : ''}
      <p class="gd-later">${state === 'later' ? 'Picks open closer to game day.' : 'Picks are closed for this one.'}</p>`;
  }
  const also = picks.siblings?.length ? `<section class="card gd-next" aria-label="Same day">
      <div class="gd-card__h"><h2>Also on ${escHtml(shortDayLabel(m.ymd))}</h2></div>
      ${picks.siblings.map(x => `<div class="gd-nx"><div><span class="gd-nx__t">${dot(x.a, 8)}${escHtml(x.a)} <i>vs</i> ${escHtml(x.b)}${dot(x.b, 8)}</span>${x.odds ? `<span class="gd-nx__o"><span class="gd-obar"><span style="width:${x.odds.pctA}%"></span></span>${x.odds.fav ? `${escHtml(tc(x.odds.fav === 'a' ? x.a : x.b))} ${x.odds.fav === 'a' ? x.odds.pctA : x.odds.pctB}%` : 'Even'}</span>` : ''}</div><a class="gd-pk" href="${escHtml(x.href)}#picks">${state === 'open' ? 'Pick' : 'View'}</a></div>`).join('')}
    </section>` : '';
  return `<section id="picks" class="card gd-pick" aria-labelledby="picks-h">${body}</section>${also}`;
}

function previewArchive(d) {
  const p = d.preview;
  if (!p) return '';
  const { m, story, odds } = p;
  return `<details id="preview" class="gd-sec gd-prev">
    <summary><span class="gd-prev__t">Pre-game preview</span><span class="gd-prev__s">As it stood at tip-off: odds, storyline and matchup stats</span></summary>
    <div class="gd-prev__in">
      ${odds ? `<div class="card gd-prev__odds">${oddsLine(m, odds)}</div>` : ''}
      ${storyBlock(d.game, story, { isAdmin: false, regen: false })}
      ${edgesBlock(m)}
      ${scorersBlock(m)}
      ${meetingsBlock(m)}
    </div>
  </details>`;
}

// ── Page scripts: scroll-spy nav, recap clamp, box toggle, countdown, preview opener ──────
function pageScript() {
  return `<script>
(function () {
  var header = document.querySelector('.site-header');
  var nav = document.querySelector('[data-gd-snav]');
  function setTop() { if (header && nav) document.documentElement.style.setProperty('--gd-top', header.getBoundingClientRect().height + 'px'); }
  setTop(); window.addEventListener('resize', setTop);

  // Scroll-spy: the section nearest the top (under the sticky nav) lights its link.
  if (nav) {
    var links = [].slice.call(nav.querySelectorAll('[data-spy]'));
    var secs = links.map(function (a) { return document.getElementById(a.dataset.spy); });
    var ticking = false;
    function spy() {
      ticking = false;
      var line = (header ? header.getBoundingClientRect().height : 0) + nav.offsetHeight + 24;
      var on = 0;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top - line <= 0) on = i; });
      links.forEach(function (a, i) { a.classList.toggle('is-on', i === on); });
      nav.classList.toggle('is-stuck', nav.getBoundingClientRect().top <= (header ? header.getBoundingClientRect().height : 0) + 1);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('[data-spy]');
      if (!a) return;
      var target = document.getElementById(a.dataset.spy);
      if (target && target.tagName === 'DETAILS') target.open = true;
    });
  }

  // Recap: clamp long recaps, "Read the full recap" only when it actually overflows.
  document.querySelectorAll('[data-gd-clamp]').forEach(function (el) {
    var btn = el.parentNode.querySelector('[data-gd-clamp-btn]');
    if (!btn || el.scrollHeight <= el.clientHeight + 2) { el.classList.add('is-open'); return; }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = el.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Show less' : 'Read the full recap →';
    });
  });

  // Box score team switch.
  document.querySelectorAll('[data-gd-box-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      var side = b.dataset.gdBoxBtn;
      document.querySelectorAll('[data-gd-box-btn]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      document.querySelectorAll('[data-gd-box]').forEach(function (p) { p.hidden = p.dataset.gdBox !== side; });
    });
  });

  // Picks-close countdown.
  var cd = document.querySelector('[data-close]');
  if (cd) {
    var end = new Date(cd.dataset.close).getTime();
    var tick = function () {
      var ms = end - Date.now();
      if (ms <= 0) { cd.querySelector('.gd-cd__k').textContent = 'Picks closed'; cd.querySelector('.gd-cd__n').hidden = true; return; }
      var m = Math.floor(ms / 60000);
      cd.querySelector('[data-cd="d"]').textContent = Math.floor(m / 1440);
      cd.querySelector('[data-cd="h"]').textContent = Math.floor(m / 60) % 24;
      cd.querySelector('[data-cd="m"]').textContent = m % 60;
      setTimeout(tick, 30000);
    };
    tick();
  }

  // "Say something" on a performer: to the comments with "@Name " typed in. Guests log in first.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-say]');
    if (!b) return;
    var input = document.getElementById('gc-input');
    if (!input) { location.href = '/login?next=' + encodeURIComponent(location.pathname + '#talk'); return; }
    var talk = document.getElementById('talk');
    if (talk) talk.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var v = input.value.replace(/\\s+$/, '');
    input.value = (v ? v + ' ' : '') + b.dataset.say;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Links into the archived preview open it first; so does arriving with #preview.
  function openPrev() { var p = document.getElementById('preview'); if (p) p.open = true; }
  document.querySelectorAll('[data-gd-open-preview]').forEach(function (a) { a.addEventListener('click', openPrev); });
  if (location.hash === '#preview') { openPrev(); var p = document.getElementById('preview'); if (p) p.scrollIntoView(); }
})();
</script>`;
}

export function gamePage(d) {
  const { game, state } = d;
  const fa = n0(game.team_a_score), fb = n0(game.team_b_score);
  const mentionable = (d.mentionablePlayers || []).map(p => {
    const name = displayPlayerName(p.name);
    return { id: p.id, name, initials: initials(name), photoUrl: `/api/player/${encodeURIComponent(p.id)}/photo` };
  });
  const v = { ...d, mentionable };
  const floater = d.commentsEnabled ? gameSocialFloater({ commentsEnabled: true, gameReaction: d.gameReaction, commentsCount: d.comments.length }) : '';
  const comments = d.commentsEnabled ? { label: 'Comments', id: 'talk', badge: d.comments.length, badgeId: 'comments-count' } : null;
  const scripts = `${gameTabsStyles()}${gameTabsScript({ gameId: game.id, isAdmin: d.isAdmin, mentionablePlayers: mentionable })}${pageScript()}`;

  if (state === 'upcoming') {
    const p = d.picks;
    const m = p?.m;
    const items = [
      p?.pickable ? { id: 'picks', label: 'Who wins?' } : null,
      m && (p.story || d.isAdmin) ? { id: 'story', label: 'Storyline' } : null,
      m?.rows?.length ? { id: 'h2h', label: 'Head to head' } : null,
      m?.scorers?.some(Boolean) ? { id: 'watchlist', label: 'Players to watch' } : null,
      m?.lastMeetings?.length ? { id: 'meetings', label: 'Last meetings' } : null,
      comments ? { ...comments, label: 'Pre-game chatter' } : null,
    ].filter(Boolean);
    return `<div class="page-content gd-page">
  <p class="gd-crumb"><a href="/games">Games</a><span>›</span><span>Season ${escHtml(String(game.season))} · ${escHtml(tc(game.team_a_name))} vs ${escHtml(tc(game.team_b_name))}</span></p>
  ${upcomingHero(v)}
  ${sectionNav(items)}
  <div class="gd-cols">
    <div class="gd-cols__main">
      ${m ? storyBlock(game, p.story, { isAdmin: d.isAdmin, regen: p.state === 'open' || p.state === 'closed' }) : ''}
      ${m ? edgesBlock(m) : ''}
      ${m ? scorersBlock(m) : ''}
      ${m ? meetingsBlock(m) : ''}
      ${talkSection(v, 'Pre-game chatter')}
    </div>
    <aside class="gd-cols__rail gd-rail--sticky">${pickRail(v)}</aside>
  </div>
</div>
${floater}
${m ? matchupScript({ isAdmin: d.isAdmin }) : ''}
${p?.o ? pickBoxScript() : ''}
${scripts}`;
  }

  // Final.
  const A = teamTotals(d.stats, game.team_a_name, game.team_a_to_team);
  const B = teamTotals(d.stats, game.team_b_name, game.team_b_to_team);
  const myStat = d.currentPlayerId ? d.stats.find(s => s.player_id === d.currentPlayerId) : null;
  const recap = recapCard(game);
  const hasBox = d.stats.length > 0;
  const items = [
    recap ? { id: 'recap', label: 'Recap' } : null,
    d.called ? { id: 'picks', label: 'Who called it' } : null,
    d.flow ? { id: 'flow', label: 'Game flow' } : null,
    d.dc ? { id: 'perf', label: 'Top performers' } : null,
    hasBox ? { id: 'box', label: 'Box score' } : null,
    d.plays.length ? { id: 'plays', label: 'Key plays' } : null,
    comments,
    d.preview ? { id: 'preview', label: 'Pre-game preview' } : null,
  ].filter(Boolean);
  const mini = `${escHtml(String(game.team_a_name).slice(0, 3))} ${fa} <i>–</i> ${fb} ${escHtml(String(game.team_b_name).slice(0, 3))}`;
  const rail = [calledCard(game, d.called, d.isPlayer), myStat ? shareStatsBanner(game, myStat) : '', upNextCard(d.upNext, d.upNextLabel)].filter(Boolean).join('');
  const talk = talkSection(v, 'Comments');
  const plays = playsBlock(game, d.plays);
  return `<div class="page-content gd-page">
  <p class="gd-crumb"><a href="/games">Games</a><span>›</span><span>Season ${escHtml(String(game.season))} · ${escHtml(tc(game.team_a_name))} vs ${escHtml(tc(game.team_b_name))}</span></p>
  ${finalHero(v)}
  ${sectionNav(items, mini)}
  <div class="gd-cols">
    <div class="gd-cols__main">
      ${recap}
      ${videoCard(game)}
      ${hasBox ? wonBlock(d.won) : '<p class="gd-empty card">Full box scores will be available once stats are imported.</p>'}
      ${flowCard(game, d.flow)}
    </div>
    ${rail ? `<aside class="gd-cols__rail">${rail}</aside>` : ''}
  </div>
  ${performersSection(game, d.dc, d.verdict, d.potgPlayerId, d.commentsEnabled ? sayButton(mentionable) : undefined)}
  ${boxSection(game, d.stats, d.dnpPlayers, A, B)}
  ${plays || talk ? `<div class="gd-cols gd-sec">
    ${plays ? `<div class="gd-cols__main">${plays}</div>` : ''}
    ${talk ? `<div class="${plays ? 'gd-cols__rail' : 'gd-cols__main'}">${talk}</div>` : ''}
  </div>` : ''}
  ${previewArchive(v)}
</div>
${floater}
${d.preview ? matchupScript({ isAdmin: false }) : ''}
${scripts}`;
}
