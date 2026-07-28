import { escHtml } from './layout.js';
import { playerAvatar } from './utils.js';

// left/top are % positions on the court diagram (viewBox 0 0 300 280, hoop at the bottom)
const POSITIONS = [
  { id: 'PG', desc: 'running the group chat',        left: 50, top: 13 },
  { id: 'SG', desc: 'shoots their shot. everywhere.', left: 84, top: 38 },
  { id: 'SF', desc: 'versatile. very versatile. 👀',  left: 16, top: 38 },
  { id: 'PF', desc: 'muscles &amp; issues',           left: 68, top: 76 },
  { id: 'C',  desc: 'tall and in the way',            left: 50, top: 79 },
];

export function registerPage({ error = null, success = false, prefill = {}, hypeAvatars = [], ref = '' } = {}) {
  const refValue = ref || prefill.ref || '';

  // Pre-rendered as full HTML (via the same playerAvatar() helper papawis/etc. use,
  // initials-fallback + onerror-hide baked in) — the runtime-fit script below just
  // shuffles and slices this array, it never has to know how an avatar is built.
  // Shared by both the form and success states — the sidebar's hype box stays
  // mounted across the whole flow, not just while filling out the form.
  const hypeAvatarsHtml = JSON.stringify(
    hypeAvatars.map(p => playerAvatar(p.id, p.name, p.color, { className: 'hype__avatar' }))
  );

  // Shared across form + success states so the sidebar (brand, back link, "what
  // happens next") never disappears mid-flow — only .shell-right's contents swap.
  const shellLeftHtml = `<div class="shell-left">
    <div class="shell-back-row">
      <a href="/" class="shell-back">&larr; Back to Home Court</a>
    </div>
    <div class="shell-brand-row">
      <a href="/" class="site-header__logo-text shell-logo">WKND Basketball</a>
      <button class="site-nav__hamburger shell-hamburger" id="nav-toggle-sidebar" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
        <span class="site-nav__hamburger-line"></span>
        <span class="site-nav__hamburger-line"></span>
        <span class="site-nav__hamburger-line"></span>
      </button>
    </div>
    <p class="login-brand__sub">Open to all genders, all skill levels, and at least two people per team who think they're the main character.* We promise good runs, real community, and one group chat that will absolutely ruin your sleep schedule.** <em>(*you know who you are) (**we will also judge your form &mdash; lovingly)</em></p>

    <div class="next-panel">
      <div class="next-panel__label">What happens next, bestie</div>
      <div class="next-list">
        <div class="next-item"><span class="next-num">1</span><span class="next-text">Your application <strong>slides into the admin team's DMs</strong> for a thorough vibe check.</span></div>
        <div class="next-item"><span class="next-num">2</span><span class="next-text">They give it a proper once-over &mdash; takes a few days, we promise we're not just vibing.</span></div>
        <div class="next-item"><span class="next-num">3</span><span class="next-text">You get <strong>The Email&trade;</strong> once you're in &mdash; screenshot it, it's basically a certificate. 📩</span></div>
        <div class="next-item"><span class="next-num">4</span><span class="next-text">You're in, bestie &mdash; basically famous now, and ready for the next season signup.</span></div>
      </div>
    </div>
  </div>`;

  const hypeHtml = `<div class="hype">
    <div class="hype__count">50+</div>
    <div class="hype__label">certified ballers already on the roster, ready to judge your jump shot (lovingly, mostly) 💅</div>
    <div class="hype__avatars" id="hype-avatars"></div>
  </div>`;

  // Fits/shuffles the sidebar's avatar stack at runtime. Independent of the
  // form's own accordion script below, so it's safe to include on the
  // success state too (which has no #reg-form for that script to attach to).
  const hypeAvatarsScript = `<script>
(function () {
  var pool = ${hypeAvatarsHtml};
  var AVATAR_SIZE = 32; // matches .hype__avatar width/height
  var OVERLAP     = 13; // matches .hype__avatar margin-left
  var STEP = AVATAR_SIZE - OVERLAP;

  var wrap = document.getElementById('hype-avatars');
  if (!wrap || !pool.length) return;
  // Measured at runtime instead of assumed, so this always exactly fills
  // whatever width the sidebar actually has — no hardcoded viewport guess.
  var available = wrap.clientWidth;
  var maxFit = Math.max(1, Math.floor((available - AVATAR_SIZE) / STEP) + 1);
  var count = Math.min(maxFit, pool.length);

  var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });
  wrap.innerHTML = shuffled.slice(0, count).join('');
})();
</script>`;

  // Shared by both states — success only ever adds .success-panel rules on top,
  // never removes anything the form needs (form markup isn't in the DOM at all
  // on the success page, so its unused selectors are harmless).
  const stylesBlock = `<style>
:root { --surface-2: #151b26; --border-solid: #1e2530; }

.login-brand__sub em { font-style: normal; opacity: .55; font-size: 11.5px; }

/* Explicit escape hatch for returning members — the sidebar's logo is
   clickable too, but that's not an obvious affordance on its own, and the
   header no longer has a visible "Home" link now that it's just a hamburger.
   Its own row above the brand row (not crammed inline with the logo) so it
   reads as a distinct, secondary action rather than competing with the mark. */
.shell-back-row { margin-bottom: 14px; }
.shell-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  transition: color .15s;
}
.shell-back:hover { color: var(--amber); }
.shell-brand-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
/* .site-header__logo-text (shared with the main site header, for consistency —
   same wordmark returning members already recognize) has no margin of its own
   since the real header sizes it via flex gap instead — shell-brand-row's own
   gap/align-items handles spacing/vertical-centering against .shell-back here. */
.shell-logo { display: block; }

/* ── shell ────────────────────────────────────────────────────────────── */
.shell { width: 100%; }
/* Truly fixed to the viewport — always exactly one screen tall, never
   stretches with content and never scrolls. z-index above the header/footer
   so the sidebar is the top layer, overlapping THEM at the shared corners
   (rather than being cut off above/below by them) — it owns the one clickable
   brand mark now, header/footer no longer duplicate a logo. */
.shell-left {
  position: fixed; top: 0; left: 0; z-index: 50;
  width: clamp(320px, 30vw, 420px);
  height: 100vh;
  padding: 48px 44px 40px;
  display: flex; flex-direction: column;
  overflow-y: auto;
  background:
    radial-gradient(600px circle at 20% 15%, rgba(245,147,50,.10), transparent 60%),
    var(--surface);
  border-right: 1px solid var(--border-solid);
}
/* width:calc(...) + margin-left (not width:100%+margin:auto — that shorthand
   was clobbering margin-left and centering the 720px column across the WHOLE
   viewport instead of the space actually free beside the fixed sidebar, since
   .shell-right's containing block (.shell) spans full page width regardless
   of the sidebar sitting on top of part of it). This way .shell-right's own
   box IS exactly the free space next to the sidebar, and align-items:center
   centers the max-width column correctly within just that space. */
.shell-right {
  width: calc(100% - clamp(320px, 30vw, 420px));
  margin-left: clamp(320px, 30vw, 420px);
  padding: 48px 56px 80px;
  display: flex; flex-direction: column; align-items: center;
}
.shell-right > .login-error,
.shell-right > form {
  width: 100%;
  max-width: 720px;
}
/* Success state has no long form to fill the column, so it centers vertically
   within one sidebar-height (100vh) instead of sitting pinned to the top with
   a huge dead gap below it — reset back to normal flow on mobile below, where
   the sidebar itself drops out of fixed positioning. */
.shell-right--success { justify-content: center; min-height: 100vh; }
.success-panel { width: 100%; max-width: 480px; text-align: center; }
.success-panel__icon { font-size: 48px; margin-bottom: 18px; }
.success-panel__title { font-size: 1.3rem; font-weight: 800; color: var(--text); margin: 0 0 10px; }
.success-panel__body { color: var(--text-muted); font-size: 13px; line-height: 1.75; margin: 0 0 32px; }

.next-panel {
  background: var(--bg); border: 1px solid var(--border-solid); border-radius: var(--radius);
  padding: 18px 20px; margin-bottom: 24px;
}
.next-panel__label { font-size: 10px; font-weight: 700; color: var(--text-subtle); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 14px; }
.next-list { display: flex; flex-direction: column; gap: 14px; }
.next-item { display: flex; align-items: center; gap: 14px; }
.next-num {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  background: var(--surface-2); border: 1px solid var(--border-solid); color: var(--text-muted);
  display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; font-weight: 700;
  padding-top: 1px;
}
.next-item:last-child .next-num { background: var(--amber-dim); border-color: rgba(245,147,50,.4); color: var(--amber); }
.next-text { font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }
.next-text strong { color: var(--text); font-weight: 600; }

/* A .shell-level sibling now (not nested in .shell-left) — on mobile this
   needs to render AFTER the whole form so the form is visible without
   scrolling past it first, which only pure DOM order (not CSS order/flex
   tricks) can guarantee once the sidebar drops out of fixed positioning.
   On desktop it's pulled back out of flow (position:fixed) to visually
   dock at the bottom-left, replicating where it used to sit as a flex
   child of the sidebar pushed down via margin-top:auto — left/bottom/width
   here reproduce that same spot (44px side inset, 40px from the bottom,
   matching .shell-left's own padding) without needing to nest inside it. */
.hype {
  position: fixed;
  left: 44px;
  bottom: 40px;
  width: calc(clamp(320px, 30vw, 420px) - 88px);
  z-index: 50;
  background: linear-gradient(160deg, rgba(245,147,50,.10), rgba(245,147,50,.02));
  border: 1px solid rgba(245,147,50,.25);
  border-radius: var(--radius);
  padding: 18px 20px;
}
.hype__count { font-family: 'Saira Condensed'; font-weight: 800; font-size: 30px; color: var(--amber); line-height: 1; font-variant-numeric: tabular-nums; }
.hype__label { font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.5; }
/* Overlapping stack, same convention as the papawis roster avatars: initials
   behind, photo on top via playerAvatar(), onerror hides a broken photo to
   reveal the initials. Sized to fit the sidebar's measured width at runtime. */
.hype__avatars { display: flex; margin-top: 14px; }
.hype__avatar {
  width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--surface);
  flex-shrink: 0; position: relative; overflow: hidden; margin-left: -13px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,.7); background: var(--bg);
}
.hype__avatar:first-child { margin-left: 0; }
.hype__avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* ── accordion ────────────────────────────────────────────────────────── */
.acc-item {
  border: 1px solid var(--border-solid); border-radius: var(--radius); background: var(--surface);
  margin-bottom: 14px; overflow: hidden; transition: border-color .15s;
}
.acc-item.is-open { border-color: rgba(245,147,50,.35); }
.acc-header {
  width: 100%; display: flex; align-items: center; gap: 16px;
  padding: 20px 26px; background: none; border: none; color: inherit; font: inherit;
  cursor: pointer; text-align: left;
}
.acc-item.is-pending .acc-header { cursor: not-allowed; }
.acc-num {
  width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border-solid); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; font-weight: 700; color: var(--text-muted);
  /* Archivo's digits reserve descender space (for g/y/p) they never use, so a
     geometrically-centered line-box still reads as visually high — nudge down. */
  padding-top: 1px;
  transition: background .2s, border-color .2s, color .2s;
}
.acc-item.is-open .acc-num { background: var(--amber); border-color: var(--amber); color: #0a0e16; }
.acc-item.is-done .acc-num { background: transparent; border-color: var(--amber); color: var(--amber); }
.acc-header-text { flex: 1; min-width: 0; }
.acc-header-label { font-size: 15px; font-weight: 700; color: var(--text); }
.acc-item.is-pending .acc-header-label { color: var(--text-muted); }
.acc-header-summary {
  font-size: 12px; color: var(--text-muted); margin-top: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.acc-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform .2s ease; }
.acc-item.is-open .acc-chevron { transform: rotate(180deg); }
.acc-item.is-pending .acc-chevron { opacity: .3; }
.acc-body { max-height: 0; overflow: hidden; transition: max-height .35s ease; }
.acc-item.is-open .acc-body { max-height: 2400px; }
/* One flex gap spaces every direct child block (each grid row, standalone field,
   checkbox, and the nav button) equally — the single source of vertical rhythm
   inside a panel, instead of per-element margins that have to be hand-matched
   whenever a panel's last (or middle) element changes shape. */
.acc-body-inner { padding: 2px 26px 30px; display: flex; flex-direction: column; gap: 22px; }

/* ── form fields (shared) ─────────────────────────────────────────────── */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
/* No margin on fields — spacing between blocks comes from acc-body-inner's gap
   (or grid-2's own gap for rows within one grid), never both at once. */
.field { margin-bottom: 0; }
.field label { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 7px; }
.req { color: var(--amber); font-style: normal; }
.field__input {
  display: block; width: 100%; background: var(--bg); border: 1px solid var(--border-solid); border-radius: 8px;
  padding: 11px 13px; font-size: 14px; color: var(--text); font-family: inherit; outline: none;
  transition: border-color .15s; box-sizing: border-box; resize: vertical;
}
.field__input:focus { border-color: var(--amber); }
.field__input::placeholder { color: var(--text-muted); opacity: .5; }
.field__input option { background: var(--surface); }
.field__input.reg-invalid { border-color: #f87171; }
.reg-field-error { font-size: 11px; color: #f87171; margin-top: 5px; }

/* ── court position picker ────────────────────────────────────────────── */
.court-row { display: flex; align-items: center; gap: 30px; margin-top: 10px; }
.court-wrap { position: relative; width: 100%; max-width: 400px; flex: 1 1 0%; }
.court-svg { display: block; width: 100%; height: auto; }
.court-pin {
  position: absolute; transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--surface-2); border: 2px solid var(--border-solid);
  display: flex; align-items: center; justify-content: center; padding-top: 1px;
  cursor: pointer; user-select: none; transition: border-color .15s, background .15s, box-shadow .15s;
}
.court-pin input { display: none; }
.court-pin__abbr { font-weight: 700; font-size: 13px; line-height: 1; letter-spacing: .02em; color: var(--text); transition: color .15s; }
.court-pin:hover { border-color: var(--amber); }
.court-pin:has(input:checked) { background: var(--amber); border-color: var(--amber); box-shadow: 0 0 0 5px rgba(245,147,50,.18); }
.court-pin:has(input:checked) .court-pin__abbr { color: #0a0e16; }

.court-legend { flex: 0 0 auto; width: 180px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.court-legend-item { display: flex; align-items: baseline; gap: 10px; font-size: 12px; color: var(--text-muted); line-height: 1.4; }
.court-legend-item strong { font-weight: 700; font-size: 12.5px; color: var(--text); min-width: 22px; flex-shrink: 0; }

.nav { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
.btn-next { background: var(--amber); border: none; border-radius: 8px; color: #0a0e16; font-size: 14px; font-weight: 700; padding: 12px 26px; cursor: pointer; letter-spacing: .04em; transition: opacity .15s; width: 100%; font-family: inherit; }
.btn-next:hover { opacity: .88; }
.check { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; font-size: 12.5px; color: var(--text-muted); line-height: 1.6; }
.check input { accent-color: var(--amber); width: 15px; height: 15px; cursor: pointer; flex-shrink: 0; margin-top: 2px; }

@media (max-width: 900px) {
  /* Fixed/overlapping treatment only makes sense side-by-side with the form —
     stacked single-column, the sidebar just becomes a normal block up top.
     Top/side padding (26px/20px) intentionally matches the default site
     header's own mobile spacing (.site-header's 26px top padding + .container's
     20px side padding) so the logo+hamburger row lands in the exact same spot
     navigating here from any other page — no visual jump between headers. */
  .shell-left { position: static; width: auto; height: auto; border-right: none; border-bottom: 1px solid var(--border-solid); padding: 26px 20px 40px; }
  /* No room (or need) for a text back-link once the brand row also has to fit
     the hamburger — the hamburger's own nav overlay covers getting back home too. */
  .shell-back-row { display: none; }
  /* next-panel is .shell-left's last child now that .hype moved out — its own
     margin-bottom was only ever meant to space it from .hype when that was
     still nested here, and was stacking on top of .shell-left's own bottom
     padding + .shell-right's top padding for a redundant, oversized gap. */
  .next-panel { margin-bottom: 0; }
  /* The header disappears entirely on mobile (public/styles.css) — this takes
     over as the way to reach the rest of the site. Sits in the same row as
     the logo (shell-brand-row's align-items:center), pushed to the row's end. */
  .shell-hamburger { display: flex; margin-left: auto; }
  /* width must be overridden too, not just margin-left/max-width — the desktop
     rule's width:calc(100% - sidebar-width) otherwise survives onto mobile,
     leaving .shell-right narrower than the viewport with a stray gap on the
     right, even though the sidebar isn't fixed/carving out space anymore. */
  /* Top padding bumped up (was 40px) for clearer breathing room below the
     sidebar's steps panel before the first accordion card. Bottom padding
     trimmed down (was 60px) since .hype's own top margin below now owns that
     gap explicitly instead of the two stacking unpredictably on top of each
     other. */
  .shell-right { width: 100%; margin-left: 0; padding: 48px 24px 24px; max-width: none; }
  /* Sidebar is no longer fixed/one-viewport-tall at this breakpoint, so
     vertical centering against 100vh would just strand the success message
     mid-screen with dead space both above and below it. */
  .shell-right--success { min-height: 0; padding-top: 64px; }
  /* Back to normal block flow (was position:fixed on desktop) — since it's
     the next sibling AFTER .shell-right in the markup, this naturally lands
     below the entire form instead of above it, so the form is the first
     substantial thing visible on load instead of steps+avatars pushing it
     down. Explicit top margin (not just relying on .shell-right's own bottom
     padding) gives a clear, predictable gap from the form regardless of that
     other value; generous bottom margin keeps it from crowding the footer. */
  .hype { position: static; left: auto; bottom: auto; width: auto; margin: 32px 24px 48px; }
  .grid-2 { grid-template-columns: 1fr; }
  .court-row { flex-direction: column; align-items: stretch; }
  .court-wrap { max-width: 260px; flex-basis: auto; margin: 0 auto; }
  .court-legend { width: auto; }
  .acc-header { padding: 16px 18px; }
  .acc-body-inner { padding: 2px 18px 24px; }
}
</style>`;

  if (success) {
    return `<div class="shell">

  ${shellLeftHtml}

  <div class="shell-right shell-right--success">
    <div class="success-panel">
      <div class="success-panel__icon">🏀</div>
      <h2 class="success-panel__title">You Better Werk — You're In the Queue!</h2>
      <p class="success-panel__body">
        Your application is officially served.<br>An admin will read it (probably while judging your Villain Arc Intro) and slide into your inbox once you're approved.
      </p>
      <a href="/" class="btn-next" style="display:block;text-decoration:none;text-align:center">Back to Home</a>
    </div>
  </div>

  ${hypeHtml}
</div>
${stylesBlock}
${hypeAvatarsScript}`;
  }

  const v   = name => escHtml(prefill[name] || '');
  const sel = (name, val) => prefill[name] === val ? 'selected' : '';

  // If server-side validation error, figure out which accordion step it belongs to
  // so we can restore the right step (and mark earlier ones "done") on re-render.
  const errorStep = (() => {
    if (!error) return 1;
    if (/position|height|weight|hand/i.test(error)) return 2;
    if (/agree|emergency|experience|bio/i.test(error)) return 3;
    return 1;
  })();

  const courtMarkers = POSITIONS.map(pos => `
              <label class="court-pin" style="left:${pos.left}%;top:${pos.top}%">
                <input type="checkbox" name="positions" value="${pos.id}">
                <span class="court-pin__abbr">${pos.id}</span>
              </label>`).join('');

  const courtLegend = POSITIONS.map(pos => `
              <div class="court-legend-item"><strong>${pos.id}</strong><span>${pos.desc}</span></div>`).join('');

  return `<div class="shell">

  ${shellLeftHtml}

  <div class="shell-right">

    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}

    <form id="reg-form" method="POST" action="/register" novalidate>
      ${refValue ? `<input type="hidden" name="ref" value="${escHtml(refValue)}">` : ''}

      <div class="acc-item" data-item="1">
        <button type="button" class="acc-header" data-toggle="1">
          <span class="acc-num">1</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Who Are You</span>
            <span class="acc-header-summary" data-summary="1"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="grid-2">
              <div class="field">
                <label for="first_name">First Slay Name <span class="req">*</span></label>
                <input id="first_name" class="field__input" type="text" name="first_name" value="${v('first_name')}" autocomplete="given-name" placeholder="Juan" data-required="1" data-step="1">
              </div>
              <div class="field">
                <label for="last_name">Government Name (the sequel) <span class="req">*</span></label>
                <input id="last_name" class="field__input" type="text" name="last_name" value="${v('last_name')}" autocomplete="family-name" placeholder="dela Cruz" data-required="1" data-step="1">
              </div>
            </div>
            <div class="field">
              <label for="email">Slide Into Our DMs <span class="req">*</span></label>
              <input id="email" class="field__input" type="email" name="email" value="${v('email')}" autocomplete="email" placeholder="juan@example.com" data-required="1" data-step="1">
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="phone">Your Digits 👀 <span class="req">*</span></label>
                <input id="phone" class="field__input" type="tel" name="phone" value="${v('phone')}" autocomplete="tel" placeholder="+63 917 123 4567" data-required="1" data-step="1">
              </div>
              <div class="field">
                <label for="birthday">Birthday &mdash; No Cap <span class="req">*</span></label>
                <input id="birthday" class="field__input" type="date" name="birthday" value="${v('birthday')}" data-required="1" data-step="1">
              </div>
            </div>
            <div class="nav">
              <button type="button" class="btn-next" data-continue="1">Yes, that's me &rarr;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="2">
        <button type="button" class="acc-header" data-toggle="2">
          <span class="acc-num">2</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Body Check</span>
            <span class="acc-header-summary" data-summary="2"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="field">
              <label>Where Do You Like to Play <span style="opacity:.5;font-size:11px;text-transform:none;letter-spacing:normal">(on the court, focus)</span> <span class="req">*</span></label>
              <div class="court-row">
                <div class="court-wrap" data-field="positions">
                  <svg class="court-svg" viewBox="0 0 300 280" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="4" width="292" height="272" rx="8" fill="none" stroke="var(--border-solid)" stroke-width="2"/>
                    <line x1="4" y1="24" x2="296" y2="24" stroke="var(--border-solid)" stroke-width="1.5" stroke-dasharray="3 4"/>
                    <path d="M 20 272 L 20 195 A 130 130 0 0 1 280 195 L 280 272" fill="none" stroke="var(--border-solid)" stroke-width="2"/>
                    <rect x="100" y="160" width="100" height="112" fill="none" stroke="var(--border-solid)" stroke-width="2"/>
                    <circle cx="150" cy="160" r="42" fill="none" stroke="var(--border-solid)" stroke-width="2" stroke-dasharray="4 4"/>
                    <rect x="132" y="266" width="36" height="4" rx="1" fill="var(--border-solid)"/>
                    <circle cx="150" cy="257" r="7" fill="none" stroke="var(--amber)" stroke-width="2.2"/>
                  </svg>
                  ${courtMarkers}
                </div>
                <div class="court-legend">${courtLegend}</div>
              </div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="height">Height &mdash; No Cap (cm) <span class="req">*</span></label><input id="height" class="field__input" type="number" name="height" value="${v('height')}" placeholder="175" min="100" max="250" data-required="1" data-step="2"></div>
              <div class="field"><label for="weight">Weight &mdash; No Shade (kg) <span class="req">*</span></label><input id="weight" class="field__input" type="number" name="weight" value="${v('weight')}" placeholder="75" min="30" max="200" data-required="1" data-step="2"></div>
              <div class="field">
                <label for="dominant_hand">Working Hand 💅 <span class="req">*</span></label>
                <select id="dominant_hand" class="field__input" name="dominant_hand" data-required="1" data-step="2">
                  <option value="">&mdash;</option>
                  <option value="right" ${sel('dominant_hand', 'right')}>Right (allegedly)</option>
                  <option value="left"  ${sel('dominant_hand', 'left')}>Left (dangerous)</option>
                  <option value="both"  ${sel('dominant_hand', 'both')}>Both (show-off)</option>
                </select>
              </div>
              <div class="field">
                <label for="gender">Vibe <span class="req">*</span></label>
                <select id="gender" class="field__input" name="gender" data-required="1" data-step="2">
                  <option value="">&mdash;</option>
                  <option value="male"       ${sel('gender', 'male')}>Male (allegedly)</option>
                  <option value="female"     ${sel('gender', 'female')}>Female (wrong group chat)</option>
                  <option value="sigma"      ${sel('gender', 'sigma')}>Sigma Male 🐺</option>
                  <option value="fabulous"   ${sel('gender', 'fabulous')}>Fabulous 💅</option>
                  <option value="classified" ${sel('gender', 'classified')}>Classified (ask my bestie)</option>
                </select>
              </div>
            </div>
            <div class="nav">
              <button type="button" class="btn-next" data-continue="2">This body slays &rarr;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="acc-item" data-item="3">
        <button type="button" class="acc-header" data-toggle="3">
          <span class="acc-num">3</span>
          <span class="acc-header-text">
            <span class="acc-header-label">Final Boss</span>
            <span class="acc-header-summary" data-summary="3"></span>
          </span>
          <svg class="acc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="acc-body">
          <div class="acc-body-inner">
            <div class="grid-2">
              <div class="field">
                <label for="experience">Basketball Resume (No Cap)</label>
                <select id="experience" class="field__input" name="experience">
                  <option value="">&mdash; be honest &mdash;</option>
                  <option value="beginner"     ${sel('experience', 'beginner')}>New but make it fashion</option>
                  <option value="intermediate" ${sel('experience', 'intermediate')}>I've watched enough NBA</option>
                  <option value="advanced"     ${sel('experience', 'advanced')}>Built different. Trust.</option>
                </select>
              </div>
              <div class="field"><label for="referred_by">Who Dragged You Here</label><input id="referred_by" class="field__input" type="text" name="referred_by" value="${v('referred_by')}" placeholder="We'll shade them privately"></div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="emergency_name">Who to Call If Cooked</label><input id="emergency_name" class="field__input" type="text" name="emergency_name" value="${v('emergency_name')}" placeholder="Full name"></div>
              <div class="field"><label for="emergency_phone">Their Digits (answers calls)</label><input id="emergency_phone" class="field__input" type="tel" name="emergency_phone" value="${v('emergency_phone')}" placeholder="+63 917 000 0000"></div>
            </div>
            <div class="field">
              <label for="social_handle">Insta or FB <span style="opacity:.5;font-size:11px;text-transform:none;letter-spacing:normal">(so we can hype you up)</span></label>
              <input id="social_handle" class="field__input" type="text" name="social_handle" value="${v('social_handle')}" placeholder="@yourhandle or fb.com/you">
            </div>
            <div class="field">
              <label for="motto">Your Villain Arc Intro</label>
              <textarea id="motto" class="field__input" name="motto" rows="3" placeholder="Your origin story &mdash; this shows on your player profile.">${escHtml(prefill.motto || '')}</textarea>
            </div>
            <label class="check">
              <input type="checkbox" name="agree" data-required="1" data-step="3">
              <span>I swear on my crossover that everything above is accurate, and I understand my application needs admin approval before I can ball. 🏀</span>
            </label>
            <div class="nav">
              <button type="submit" class="btn-next" id="submit-btn">SEND IT BESTIE 💅</button>
            </div>
          </div>
        </div>
      </div>

    </form>
  </div>

  ${hypeHtml}
</div>
${stylesBlock}

<script>
(function () {
  var form  = document.getElementById('reg-form');
  var items = Array.prototype.slice.call(form.querySelectorAll('.acc-item'));
  var errorStep = ${errorStep};
  var state = {};
  items.forEach(function (el) {
    var n = parseInt(el.dataset.item, 10);
    state[n] = n < errorStep ? 'done' : (n === errorStep ? 'open' : 'pending');
  });

  function render() {
    items.forEach(function (el) {
      var n = el.dataset.item;
      el.classList.remove('is-open', 'is-done', 'is-pending');
      el.classList.add('is-' + state[n]);
    });
  }

  function openOnly(n) {
    Object.keys(state).forEach(function (k) {
      if (state[k] === 'open') state[k] = 'done';
    });
    state[n] = 'open';
    render();
  }

  function summarize(n) {
    var el = document.querySelector('[data-summary="' + n + '"]');
    if (!el) return;
    if (n === '1') {
      var first = form.querySelector('#first_name').value.trim();
      var last  = form.querySelector('#last_name').value.trim();
      var email = form.querySelector('#email').value.trim();
      el.textContent = [[first, last].filter(Boolean).join(' '), email].filter(Boolean).join(' \\u00b7 ');
    }
    if (n === '2') {
      var checked = Array.prototype.slice.call(form.querySelectorAll('[data-field="positions"] input:checked')).map(function (c) { return c.value; });
      el.textContent = checked.length ? checked.join(' / ') + ' \\u00b7 details saved' : 'Details saved';
    }
  }

  function validateStep(n) {
    var fields = form.querySelectorAll('[data-step="' + n + '"][data-required]');
    var ok = true;
    fields.forEach(function (f) {
      var err = f.parentElement.querySelector('.reg-field-error');
      if (!err) {
        err = document.createElement('div');
        err.className = 'reg-field-error';
        f.parentElement.appendChild(err);
      }
      var val = f.type === 'checkbox' ? f.checked : f.value.trim();
      if (!val) {
        err.textContent = 'Sis, this one is not optional.';
        f.classList.add('reg-invalid');
        ok = false;
      } else {
        err.textContent = '';
        f.classList.remove('reg-invalid');
      }
    });
    // age check on step 1
    if (n === 1) {
      var bdayInput = form.querySelector('#birthday');
      if (bdayInput && bdayInput.value) {
        var dob   = new Date(bdayInput.value);
        var age18 = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
        if (new Date() < age18) {
          var bdayErr = bdayInput.parentElement.querySelector('.reg-field-error');
          if (!bdayErr) { bdayErr = document.createElement('div'); bdayErr.className = 'reg-field-error'; bdayInput.parentElement.appendChild(bdayErr); }
          bdayErr.textContent = "Bestie, you're not 18 yet. The league will still be here when you're legal.";
          bdayInput.classList.add('reg-invalid');
          ok = false;
        }
      }
    }
    // position check on step 2
    if (n === 2) {
      var boxes = form.querySelectorAll('[name="positions"]');
      var any   = Array.prototype.slice.call(boxes).some(function (b) { return b.checked; });
      var posErr = form.querySelector('.reg-pos-err');
      if (!posErr) {
        posErr = document.createElement('div');
        posErr.className = 'reg-field-error reg-pos-err';
        form.querySelector('.court-row').after(posErr);
      }
      posErr.textContent = any ? '' : "Pick a position, sis. You can't just vibe on the sideline.";
      if (!any) ok = false;
    }
    return ok;
  }

  form.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = btn.dataset.toggle;
      if (state[n] === 'pending' || state[n] === 'open') return;
      openOnly(n);
    });
  });

  form.querySelectorAll('[data-continue]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = btn.dataset.continue;
      if (!validateStep(parseInt(n, 10))) return;
      summarize(n);
      state[n] = 'done';
      var next = String(parseInt(n, 10) + 1);
      if (state[next] !== undefined) { state[next] = 'open'; render(); }
    });
  });

  form.addEventListener('submit', function (e) {
    if (!validateStep(3)) e.preventDefault();
  });

  // clear inline errors on input
  form.addEventListener('input', function (e) {
    var err = e.target.parentElement && e.target.parentElement.querySelector('.reg-field-error');
    if (err) err.textContent = '';
    e.target.classList.remove('reg-invalid');
  });

  render();
  Object.keys(state).forEach(function (n) { if (state[n] === 'done') summarize(n); });
})();
</script>

${hypeAvatarsScript}`;
}
