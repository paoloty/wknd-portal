import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials, boldTitle, playerAvatar, playerLink, stripEmptyParagraphs } from './utils.js';
import { parseWriteup } from '../lib/writeup.js';
import { scoreTicker } from './ticker.js';

function youtubeEmbedUrl(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

// ── Left-column media (YouTube → cover fallback → nothing) ───────────────────
function leftMedia(game, colorA, colorB) {
  const embedUrl = youtubeEmbedUrl(game.youtube_url);
  if (embedUrl) {
    return `<div class="sidebar-hero sidebar-hero--video">
  <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="sidebar-hero__iframe"></iframe>
</div>`;
  }
  if (game.has_cover) {
    return `<div class="sidebar-hero">
  <div class="sidebar-hero__bg"><img src="/api/photo/${encodeURIComponent(game.id)}" alt=""></div>
  <div class="sidebar-hero__flare" style="background:linear-gradient(135deg,${colorA}44 0%,transparent 50%,${colorB}44 100%)"></div>
</div>`;
  }
  return '';
}

// ── Score card ────────────────────────────────────────────────────────────────
function scoreCard(game, colorA, colorB) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winA = scoreA > scoreB;
  const winB = scoreB > scoreA;

  const ot = Number(game.overtime) || 0;
  const finalLabel = ot === 0 ? 'FINAL' : ot === 1 ? 'FINAL/OT' : `FINAL/OT${ot}`;

  return `<div class="game-score-card" id="potg-anchor" style="background:linear-gradient(135deg,${colorA}55 0%,var(--surface) 50%,${colorB}55 100%)">
  <div class="game-score-card__board">
    <div class="game-score-card__team">
      <div class="game-score-card__team-name${winA ? ' game-score-card__team-name--winner' : ''}">${escHtml(game.team_a_name)}</div>
      <div class="font-condensed game-score-card__pts${winA ? ' game-score-card__pts--winner' : ''}">${scoreA}</div>
    </div>
    <div class="game-score-card__divider">
      <div class="game-score-card__divider-line"></div>
      <span class="game-score-card__divider-label">${finalLabel}</span>
      <div class="game-score-card__divider-line"></div>
    </div>
    <div class="game-score-card__team">
      <div class="game-score-card__team-name${winB ? ' game-score-card__team-name--winner' : ''}">${escHtml(game.team_b_name)}</div>
      <div class="font-condensed game-score-card__pts${winB ? ' game-score-card__pts--winner' : ''}">${scoreB}</div>
    </div>
  </div>
</div>`;
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
  const color = escHtml(stat.team_color || '#f59332');
  const gameId = escHtml(game.id);

  // Personalizes the "Highlight" dropdown to this player's own box score rather
  // than always offering the same fixed list — only the categories they actually
  // did something in show up, ranked best-first, so a big rebounding night leads
  // with REB instead of burying it under an untouched PTS/AST/STL/BLK menu.
  // Falls back to the standard 5 (even at zero) if nothing stood out at all, so
  // the menu is never empty or oddly short for a quiet game.
  const CORE = [
    { key: 'pts', label: 'Points',   val: pts },
    { key: 'reb', label: 'Rebounds', val: reb },
    { key: 'ast', label: 'Assists',  val: ast },
    { key: 'stl', label: 'Steals',   val: stl },
    { key: 'blk', label: 'Blocks',   val: blk },
  ];
  const coreNonZero = CORE.filter(c => c.val > 0).sort((a, b) => b.val - a.val);
  const statList = coreNonZero.length ? coreNonZero.slice() : CORE.slice();

  const fg3m = Number(stat.fg3m) || 0;
  if (fg3m > 0) statList.push({ key: 'fg3m', label: '3-Pointers Made', val: fg3m });

  const fgm = (Number(stat.fg2m) || 0) + (Number(stat.fg3m) || 0);
  const fga = fgm + (Number(stat.fg2m_miss) || 0) + (Number(stat.fg3m_miss) || 0);
  if (fga > 0) {
    const fgpct = Math.round((fgm / fga) * 100);
    // Only worth flexing a decent shooting night — a 20% night isn't a "highlight".
    if (fgpct >= 40) statList.push({ key: 'fgpct', label: 'Field Goal %', val: fgpct });
  }

  const statOptionsHtml = statList.map((s, i) => `<li role="option" class="ssc-stat-option${i === 0 ? ' is-active' : ''}" data-stat="${s.key}" aria-selected="${i === 0 ? 'true' : 'false'}">Highlight: ${escHtml(s.label)}</li>`).join('\n');
  const initialStatLabel = `Highlight: ${escHtml(statList[0].label)}`;

  const alignIcon = (kind) => {
    const lines = kind === 'left'
      ? ['3 4 21 4', '3 10 15 10', '3 16 19 16']
      : kind === 'right'
        ? ['3 4 21 4', '9 10 21 10', '5 16 21 16']
        : ['3 4 21 4', '6 10 18 10', '4 16 20 16'];
    return `<svg viewBox="0 0 24 20" width="20" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${lines.map(pts => {
      const [x1, y1, x2, y2] = pts.split(' ');
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }).join('')}</svg>`;
  };
  const iconSave  = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
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
      <div class="ssc-controls__row">
        <div class="ssc-aligns" role="tablist" aria-label="Card position">
          <button type="button" class="ssc-align-btn" data-align="left" title="Left">${alignIcon('left')}</button>
          <button type="button" class="ssc-align-btn is-active" data-align="center" title="Center">${alignIcon('center')}</button>
          <button type="button" class="ssc-align-btn" data-align="right" title="Right">${alignIcon('right')}</button>
        </div>
        <div class="ssc-stat-dropdown" id="ssc-stat-dropdown">
          <button type="button" class="ssc-stat-trigger" id="ssc-stat-trigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="ssc-stat-trigger-label">${initialStatLabel}</span>
            <svg class="ssc-stat-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <ul class="ssc-stat-menu" id="ssc-stat-menu" role="listbox" aria-label="Highlighted stat" hidden>
            ${statOptionsHtml}
          </ul>
        </div>
      </div>
      <div id="ssc-msg" class="ssc-msg" hidden></div>
      <div class="ssc-actions">
        <button type="button" class="ssc-action-btn" id="ssc-save">${iconSave}<span>Save</span></button>
        <button type="button" class="ssc-action-btn" id="ssc-copy">${iconCopy}<span>Copy</span></button>
        <button type="button" class="ssc-action-btn ssc-action-btn--primary" id="ssc-share">${iconShare}<span>Share</span></button>
      </div>
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
   small card — the preview fills the viewport and the header/controls float on
   top of it (gradient-backed for legibility over an arbitrary photo), the way a
   real story editor works, instead of squeezing everything into a ~400px box. */
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
  .ssc-modal { position: fixed; inset: 0; max-width: none; max-height: none; border-radius: 0; }
  .ssc-preview { position: absolute; inset: 0; height: auto; max-width: none; width: auto; margin: 0; }
  .ssc-preview img { object-fit: contain; }
  /* Safe-area padding so the edge-to-edge header/controls don't sit under a
     notch/Dynamic Island or the home-indicator gesture bar on iPhones — a no-op
     (env() resolves to 0) on devices without either. */
  .ssc-header { position: relative; z-index: 2; padding-top: env(safe-area-inset-top); background: linear-gradient(to bottom, rgba(0,0,0,.7), transparent); border-bottom: none; }
  .ssc-controls { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding-top: 32px; padding-bottom: env(safe-area-inset-bottom); background: linear-gradient(to top, rgba(0,0,0,.82) 40%, transparent); }
}
/* Absolutely positioned against .ssc-preview (position: relative/absolute in every
   mode) rather than relying on the preview's flex centering — keeps it dead-center
   regardless of how that box ends up sized/stretched. */
.ssc-spinner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 28px; height: 28px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); border-top-color: var(--amber); animation: ssc-spin .8s linear infinite; }
@keyframes ssc-spin { to { transform: rotate(360deg); } }
.ssc-controls__row { display: flex; align-items: center; gap: 10px; padding: 12px 16px 0; }
.ssc-aligns { display: flex; gap: 8px; flex-shrink: 0; }
.ssc-align-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 36px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); color: var(--text-muted); cursor: pointer; transition: background .12s, color .12s; }
.ssc-align-btn:hover { color: var(--text); }
.ssc-align-btn.is-active { background: var(--amber); border-color: transparent; color: #0a0e16; }
.ssc-stat-dropdown { position: relative; flex: 1; min-width: 0; }
.ssc-stat-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; height: 36px; padding: 0 10px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; }
.ssc-stat-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ssc-stat-chevron { flex-shrink: 0; transition: transform .12s; }
.ssc-stat-trigger[aria-expanded="true"] .ssc-stat-chevron { transform: rotate(180deg); }
.ssc-stat-menu {
  position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 5;
  margin: 0; padding: 6px; list-style: none; max-height: 240px; overflow-y: auto;
  background: #12182a; border: 1px solid rgba(255,255,255,0.16); border-radius: var(--radius-sm);
  box-shadow: 0 12px 32px rgba(0,0,0,0.55);
}
.ssc-stat-menu[hidden] { display: none; }
.ssc-stat-option { padding: 9px 10px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; white-space: nowrap; }
.ssc-stat-option:hover { background: rgba(255,255,255,0.08); color: var(--text); }
.ssc-stat-option.is-active { background: var(--amber); color: #0a0e16; }
.ssc-msg { padding: 8px 16px 0; font-size: 12px; color: var(--text-muted); text-align: center; }
.ssc-actions { display: flex; gap: 8px; padding: 14px 16px; }
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
  var alignBtns    = Array.prototype.slice.call(document.querySelectorAll('.ssc-align-btn'));
  var statDropdown = document.getElementById('ssc-stat-dropdown');
  var statTrigger  = document.getElementById('ssc-stat-trigger');
  var statTriggerLabel = document.getElementById('ssc-stat-trigger-label');
  var statMenu     = document.getElementById('ssc-stat-menu');
  var statOptions  = Array.prototype.slice.call(document.querySelectorAll('.ssc-stat-option'));
  var cache = {};
  var pending = {};
  var align = 'center';
  // The server already picked and marked the best opening option (personalized
  // to this player's own box score — see shareStatsBanner in game.js) — just
  // read whichever option it marked active instead of recomputing a default.
  var heroStat = (statOptions.filter(function(o) { return o.classList.contains('is-active'); })[0] || statOptions[0]).getAttribute('data-stat');

  function selectStatOption(key) {
    var opt = statOptions.filter(function(o) { return o.getAttribute('data-stat') === key; })[0];
    if (!opt) return;
    statOptions.forEach(function(o) {
      var active = o === opt;
      o.classList.toggle('is-active', active);
      o.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    statTriggerLabel.textContent = opt.textContent;
  }

  function closeStatMenu() {
    statMenu.hidden = true;
    statTrigger.setAttribute('aria-expanded', 'false');
  }
  function openStatMenu() {
    statMenu.hidden = false;
    statTrigger.setAttribute('aria-expanded', 'true');
  }
  statTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    if (statMenu.hidden) openStatMenu(); else closeStatMenu();
  });
  statOptions.forEach(function(opt) {
    opt.addEventListener('click', function() {
      heroStat = opt.getAttribute('data-stat');
      selectStatOption(heroStat);
      closeStatMenu();
      clearMsg();
      render();
    });
  });
  document.addEventListener('click', function(e) {
    if (!statDropdown.contains(e.target)) closeStatMenu();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeStatMenu();
  });

  function cacheKey(a, s) { return a + '|' + s; }

  function showMsg(text) { msg.textContent = text; msg.hidden = false; }
  function clearMsg() { msg.hidden = true; msg.textContent = ''; }

  // Tracks in-flight requests per align+stat combo (not one shared flag) so
  // switching tabs while a fetch is still pending doesn't strand the
  // newly-picked combo waiting on a "loading" flag that belongs to another one.
  function ensureLoaded(a, s) {
    var key = cacheKey(a, s);
    if (cache[key] || pending[key]) return;
    pending[key] = true;
    fetch('/api/games/' + GAME_ID + '/my-stat-card.png?align=' + a + '&stat=' + s)
      .then(function(r) { if (!r.ok) throw new Error('failed'); return r.blob(); })
      .then(function(b) {
        cache[key] = { blob: b, url: URL.createObjectURL(b) };
        if (key === cacheKey(align, heroStat)) render();
      })
      .catch(function() {
        if (key === cacheKey(align, heroStat)) { spinner.hidden = true; showMsg('Could not load your stat card. Please try again.'); }
      })
      .then(function() { pending[key] = false; }, function() { pending[key] = false; });
  }

  function render() {
    var entry = cache[cacheKey(align, heroStat)];
    if (!entry) { spinner.hidden = false; img.hidden = true; ensureLoaded(align, heroStat); return; }
    img.src = entry.url;
    img.hidden = false;
    spinner.hidden = true;
  }

  function open() {
    backdrop.hidden = false;
    clearMsg();
    render();
  }
  function close() { backdrop.hidden = true; }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(); });

  alignBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      align = btn.getAttribute('data-align');
      alignBtns.forEach(function(b) { b.classList.toggle('is-active', b === btn); });
      clearMsg();
      render();
    });
  });

  saveBtn.addEventListener('click', function() {
    var entry = cache[cacheKey(align, heroStat)];
    if (!entry) return;
    var a = document.createElement('a');
    a.href = entry.url;
    a.download = 'wknd-game-' + GAME_ID + '-stats.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  copyBtn.addEventListener('click', function() {
    var entry = cache[cacheKey(align, heroStat)];
    if (!entry) return;
    clearMsg();
    if (!navigator.clipboard || !window.ClipboardItem) {
      showMsg('Copy is not supported in this browser. Use Save instead.');
      return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': entry.blob })])
      .then(function() { showMsg('Copied to clipboard.'); })
      .catch(function() { showMsg('Could not copy. Try Save instead.'); });
  });

  shareBtn.addEventListener('click', function() {
    var entry = cache[cacheKey(align, heroStat)];
    if (!entry) return;
    clearMsg();
    var file = new File([entry.blob], 'wknd-game-stats.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'My Stats — WKND Basketball' }).catch(function() {});
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

function writeupToEditorHtml(writeup) {
  if (!writeup) return '';
  if (/<[a-z][\s\S]*>/i.test(writeup)) return writeup;
  // Convert legacy ** to <b>
  return escHtml(writeup).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

function recapTab(game) {
  const rendered = renderWriteup(game.game_writeup);
  const statsPending = game.status === 'final'
    ? `<p class="tabs-empty" style="margin-top:${rendered ? '16px' : '0'};border-top:${rendered ? '1px solid var(--border)' : 'none'};padding-top:${rendered ? '16px' : '0'}">Full box scores will be available once stats are imported.</p>`
    : '';
  if (!rendered) return `<p class="tabs-empty">No recap available yet.</p>${statsPending}`;
  return `<div class="recap-tab">${rendered}</div>${statsPending}`;
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

// ── Tabs ──────────────────────────────────────────────────────────────────────
// React (page-level "liked the game") + Share, pinned to the right end of the tab nav —
// separate from the tab-switching buttons since they're actions, not views to switch to.
function tabActionsBar({ commentsEnabled, gameReaction }) {
  const reactBtn = commentsEnabled
    ? `<button type="button" id="game-react-btn" class="game-tabs__icon-btn${gameReaction.reacted ? ' is-active' : ''}" title="React to this game">
        🔥 <span id="game-react-count">${gameReaction.count || 0}</span>
      </button>`
    : '';
  return `<div class="game-tabs__actions">
    ${reactBtn}
    <button type="button" id="game-share-btn" class="game-tabs__icon-btn" title="Share">↗</button>
  </div>`;
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

function commentsTabButton(comments, isActive) {
  return `<button class="game-tabs__tab${isActive ? ' game-tabs__tab--active' : ''}" data-tab="comments">💬<span class="game-tabs__tab-label"> Comments</span><span id="comments-count">${comments.length ? ` · ${comments.length}` : ''}</span></button>`;
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

function commentsTabPanel({ game, comments, reactedIds, isPlayer, isAdmin, mentionablePlayers, isActive }) {
  return `<div id="tab-comments" class="game-tabs__body${isActive ? '' : ' game-tabs__body--hidden'}">${commentsTabBody({ gameId: game.id, comments, reactedIds, isPlayer, isAdmin, mentionablePlayers })}</div>`;
}

// One shared script for tab switching + comments (post/react/delete) + page-level react/share
// — all game-tabs concerns live in this one block regardless of which branch built the markup.
function gameTabsScript({ gameId, isAdmin = false, mentionablePlayers = [] }) {
  return `<script>
(function(){
  var nav = document.querySelector('.game-tabs__nav');
  nav.addEventListener('click', function(e){
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    document.querySelectorAll('.game-tabs__tab').forEach(function(b){ b.classList.remove('game-tabs__tab--active'); });
    document.querySelectorAll('.game-tabs__body').forEach(function(b){ b.classList.add('game-tabs__body--hidden'); });
    btn.classList.add('game-tabs__tab--active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('game-tabs__body--hidden');
  });

  // Deep link from elsewhere (e.g. the comment icon on /games) straight into the
  // comments tab, rather than landing on Recap and making the visitor find it themselves.
  if (window.location.hash === '#comments') {
    var commentsTabBtn = document.querySelector('.game-tabs__tab[data-tab="comments"]');
    if (commentsTabBtn) {
      commentsTabBtn.click();
      document.querySelector('.game-tabs').scrollIntoView({ block: 'start' });
    }
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
    el.textContent = next ? ' · ' + next : '';
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

  var tabComments = document.getElementById('tab-comments');
  if (tabComments) {
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
        var tabBtn = document.querySelector('.game-tabs__tab[data-tab="comments"]');
        if (tabBtn) {
          tabBtn.click();
          document.querySelector('.game-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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

function gameTabs({ game, stats, dnpPlayers, quarterScores, commentsEnabled = false, comments = [], reactedIds = new Set(), gameReaction = { count: 0, reacted: false }, mentionablePlayers: rawMentionablePlayers = [], isPlayer = false, isAdmin = false }) {
  const actions = tabActionsBar({ commentsEnabled, gameReaction });
  const floater = gameSocialFloater({ commentsEnabled, gameReaction, commentsCount: comments.length });
  // getPlayersWithAccounts() (server.js) returns names in raw "LASTNAME, Firstname"
  // storage form — format for display/matching the same way comment authorship already is.
  // initials/photoUrl are precomputed here so the dropdown can show a real avatar without
  // duplicating name-initial logic client-side.
  const mentionablePlayers = rawMentionablePlayers.map(p => {
    const name = displayPlayerName(p.name);
    return { id: p.id, name, initials: initials(name), photoUrl: `/api/player/${encodeURIComponent(p.id)}/photo` };
  });
  // Comments leads the tab bar, but only actually opens by default once there's a
  // conversation already happening there — an empty comments tab isn't a useful landing
  // page, so a game with no comments yet still lands on Recap like before.
  const commentsIsDefault = commentsEnabled && comments.length > 0;

  if (game.status === 'final') {
    return `<div class="card game-tabs">
  <div class="game-tabs__nav">
    ${commentsEnabled ? commentsTabButton(comments, commentsIsDefault) : ''}
    <button class="game-tabs__tab${commentsIsDefault ? '' : ' game-tabs__tab--active'}" data-tab="recap">Recap</button>
    ${actions}
  </div>
  <div id="tab-recap" class="game-tabs__body${commentsIsDefault ? ' game-tabs__body--hidden' : ''}">${recapTab(game)}</div>
  ${commentsEnabled ? commentsTabPanel({ game, comments, reactedIds, isPlayer, isAdmin, mentionablePlayers, isActive: commentsIsDefault }) : ''}
</div>
${floater}
${gameTabsStyles()}
${gameTabsScript({ gameId: game.id, isAdmin, mentionablePlayers })}`;
  }

  const { byTeam, dnpByTeam, winner, teamTurnovers } = buildBoxScoreData(game, stats, dnpPlayers);
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const tabIdA = 'bs-' + nameA.replace(/\s+/g, '-');
  const tabIdB = 'bs-' + nameB.replace(/\s+/g, '-');

  let log = [];
  try { log = JSON.parse(game.game_log_json || '[]'); } catch {}
  const hasLog = log.length > 0;

  return `<div class="card game-tabs">
  <div class="game-tabs__nav">
    ${commentsEnabled ? commentsTabButton(comments, commentsIsDefault) : ''}
    <button class="game-tabs__tab${commentsIsDefault ? '' : ' game-tabs__tab--active'}" data-tab="recap">Recap</button>
    <button class="game-tabs__tab" data-tab="${tabIdA}">${escHtml(nameA)}${nameA === winner ? ' <span class="tab-win-dot"></span>' : ''}</button>
    <button class="game-tabs__tab" data-tab="${tabIdB}">${escHtml(nameB)}${nameB === winner ? ' <span class="tab-win-dot"></span>' : ''}</button>
    <button class="game-tabs__tab" data-tab="leaders">Leaders</button>
    <button class="game-tabs__tab" data-tab="comparison">Team Comparison</button>
    <button class="game-tabs__tab" data-tab="linescore">Line Score</button>
    ${hasLog ? `<button class="game-tabs__tab" data-tab="pbp">Play by Play</button>` : ''}
    ${actions}
  </div>
  <div id="tab-recap" class="game-tabs__body${commentsIsDefault ? ' game-tabs__body--hidden' : ''}">${recapTab(game)}</div>
  <div id="tab-${tabIdA}" class="game-tabs__body game-tabs__body--hidden">${teamBoxScoreTab(nameA, byTeam, dnpByTeam, winner, teamTurnovers)}</div>
  <div id="tab-${tabIdB}" class="game-tabs__body game-tabs__body--hidden">${teamBoxScoreTab(nameB, byTeam, dnpByTeam, winner, teamTurnovers)}</div>
  <div id="tab-leaders" class="game-tabs__body game-tabs__body--hidden">${gameLeadersTab(game, stats)}</div>
  <div id="tab-comparison" class="game-tabs__body game-tabs__body--hidden">${teamComparisonTab(game, stats)}</div>
  <div id="tab-linescore" class="game-tabs__body game-tabs__body--hidden">${lineScoreTab(game, quarterScores)}</div>
  ${hasLog ? `<div id="tab-pbp" class="game-tabs__body game-tabs__body--hidden">${playByPlayTab(game)}</div>` : ''}
  ${commentsEnabled ? commentsTabPanel({ game, comments, reactedIds, isPlayer, isAdmin, mentionablePlayers, isActive: commentsIsDefault }) : ''}
</div>
${floater}
${gameTabsStyles()}
${gameTabsScript({ gameId: game.id, isAdmin, mentionablePlayers })}`;
}

// ── POTG card ─────────────────────────────────────────────────────────────────
function potgCard(stat, writeup) {
  if (!stat) return '';
  const teamName = String(stat.team_name || '').toUpperCase();
  const color = teamColor(teamName);
  const isLight = teamName === 'WHITE';
  const displayName = displayPlayerName(stat.name || '').toUpperCase();
  const cleanWriteup = String(writeup || '').replace(/\*\*/g, '').trim();

  const statDefs = [
    { val: Number(stat.pts), lbl: 'PTS' },
    { val: Number(stat.reb), lbl: 'REB' },
    { val: Number(stat.ast), lbl: 'AST' },
    { val: Number(stat.stl), lbl: 'STL' },
    { val: Number(stat.blk), lbl: 'BLK' },
  ].filter(s => s.val > 0);

  const statCells = statDefs.map(s => `<div class="potg-card__stat">
      <span class="font-condensed potg-card__stat-val">${s.val}</span>
      <span class="potg-card__stat-lbl">${s.lbl}</span>
    </div>`).join('');

  return `<div class="card potg-card">
  <div class="card-label card-label--accent">PLAYER OF THE GAME</div>
  <div class="potg-card__player">
    ${playerAvatar(stat.player_id, stat.name, color, { className: 'potg-card__avatar', link: true })}
    <div class="potg-card__info">
      <div class="potg-card__name">${playerLink(stat.player_id, stat.name, { upper: true })}</div>
      <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
    </div>
  </div>
  <div class="potg-card__statline">${statCells}</div>
  ${cleanWriteup ? `<p class="potg-card__writeup">${escHtml(cleanWriteup)}</p>` : ''}
</div>`;
}

// ── Top performers ────────────────────────────────────────────────────────────
function topPerformers(stats, potgPlayerId) {
  const others = stats.filter(s => s.player_id !== potgPlayerId && Number(calcPer(s)) >= 10);
  if (!others.length) return '';

  const rows = others.map(s => {
    const teamName = String(s.team_name || '').toUpperCase();
    const color = teamColor(teamName);

    const extras = [
      { val: Number(s.reb), lbl: 'REB' },
      { val: Number(s.ast), lbl: 'AST' },
      { val: Number(s.stl), lbl: 'STL' },
      { val: Number(s.blk), lbl: 'BLK' },
    ].filter(x => x.val > 0).slice(0, 2);
    const statLine = [{ val: Number(s.pts), lbl: 'PTS' }, ...extras]
      .map(x => `${x.val} ${x.lbl}`).join(' · ');

    return `<div class="performer-row">
  <div class="performer-row__left">
    <span class="team-dot" style="background:${color}"></span>
    <span class="performer-row__name">${playerLink(s.player_id, s.name || '', { upper: true })}</span>
  </div>
  <span class="performer-row__line">${escHtml(statLine)}</span>
</div>`;
  });

  return `<div class="card top-performers">
  <div class="card-label">TOP PERFORMERS</div>
  <div class="top-performers__list">
    ${rows.join('\n    ')}
  </div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
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

export function gamePage({ game, stats, dnpPlayers = [], potgPlayerId, quarterScores = [], allGames = [], playerMap = {}, teamMap = {}, commentsEnabled = false, comments = [], reactedIds = new Set(), gameReaction = { count: 0, reacted: false }, mentionablePlayers = [], currentPlayerId = null, isPlayer = false, isAdmin = false }) {
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);
  const potgStat = potgPlayerId ? stats.find(s => s.player_id === potgPlayerId) : null;
  const myStat = currentPlayerId ? stats.find(s => s.player_id === currentPlayerId) : null;

  const completedGames = allGames
    .filter(g => g.status === 'final' || g.status === 'complete')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = allGames
    .filter(g => g.status === 'scheduled')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  return `<div class="game-detail-layout">
  <div class="game-detail-left">
    ${leftMedia(game, colorA, colorB)}
    ${gameTabs({ game, stats, dnpPlayers, quarterScores, commentsEnabled, comments, reactedIds, gameReaction, mentionablePlayers, isPlayer, isAdmin })}
  </div>
  <div class="game-detail-right">
    ${myStat ? shareStatsBanner(game, myStat) : ''}
    ${scoreCard(game, colorA, colorB)}
    ${potgCard(potgStat, game.potg_writeup)}
    ${topPerformers(stats, potgPlayerId)}
  </div>
</div>`;
}
