import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, boldTitle, excerpt, truncate, playerAvatar, avatarStack, playerLink, manilaTodayStr, commentSnippet, playerPhotoUrl } from './utils.js';
import { moveBadge, lockBars } from './mvp.js';
export { scoreTicker } from './ticker.js';
import { scoreTicker } from './ticker.js';
import { gameCard, gameCardScript, swipeScript } from './games.js';


// ── Hero Carousel ─────────────────────────────────────────────────────────────
// Game-recap slides (score, recap excerpt, full recap CTA) followed by any Season
// Award slides (MVP/Finals MVP graphics — already have badge/name/stats baked into
// the image itself, so no title/excerpt overlay is added; a top eyebrow link is
// the only HTML text, kept clear of the baked-in bottom text).
// The next Papawis run leads the carousel while one is posted: court photo (or its map),
// date/status chips, the /papawis AI headline and a CTA. Roster and price stay on
// /papawis itself.
function papawisHeroSlide(p) {
  const utcDay = (ms, opts) => new Date(ms).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  const dateMs = Date.parse(`${p.date}T00:00:00Z`);
  const day = utcDay(dateMs, { weekday: 'short', month: 'short', day: 'numeric' });
  const full = p.signupsOpen && p.maxSlots && p.confirmed >= p.maxSlots;
  const open = Math.max(0, p.maxSlots - p.confirmed);
  const status = !p.signupsOpen ? `Opens ${utcDay(p.opensAt + 8 * 3600e3, { weekday: 'short' })}`
    : full ? (p.waitlist ? `Full · +${p.waitlist} waitlist` : 'Full') : `${open} open`;
  const cta = !p.signupsOpen ? 'See the run' : full ? 'Join the waitlist' : 'Claim a slot';
  const title = String(p.headline || '').replace(/\*\*/g, '').trim()
    || `${utcDay(dateMs, { weekday: 'long' })} run${p.location ? ` at ${p.location}` : ''}`;
  const body = String(p.body || '').replace(/\*\*/g, '').trim() || p.location;

  return `<div class="hero-slide hero-slide--active">
  ${p.imgUrl ? `<div class="hero-bg${p.isMap ? ' hero-bg--map' : ''}"><img src="${escHtml(p.imgUrl)}" alt="" fetchpriority="high"></div>` : '<div class="hero-bg"></div>'}
  <div class="hero-flare" style="background:radial-gradient(90% 70% at 0% 0%,#f593322e 0%,transparent 60%)"></div>
  <div class="hero-overlay"></div>
  <div class="hero-chips"><span class="hero-chip hero-chip--season"><span class="pill-label">Papawis</span></span><span class="hero-chip"><span class="pill-label">${escHtml(day)}${p.time ? ` · ${escHtml(p.time)}` : ''}</span></span><span class="hero-chip"><span class="pill-label">${escHtml(status)}</span></span></div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(title.slice(0, 120))}</h2>
    ${body ? `<p class="hero-excerpt">${escHtml(body.slice(0, 280))}</p>` : ''}
    <a href="/papawis#pw-game-${encodeURIComponent(p.id)}" class="hero-cta">${cta} <span>&rarr;</span></a>
  </div>
</div>`;
}

function heroCarousel(games, awardItems = [], papawis = null) {
  if (!games.length && !awardItems.length && !papawis) {
    return `<div class="card hero-carousel hero-carousel--empty">
  <span class="hero-carousel--empty__label">No games yet</span>
</div>`;
  }

  const gameSlides = games.map((game, i) => {
    const scoreA = Number(game.team_a_score);
    const scoreB = Number(game.team_b_score);
    const winA = scoreA > scoreB;
    const winB = scoreB > scoreA;
    const colorA = teamColor(game.team_a_name);
    const colorB = teamColor(game.team_b_name);
    const winColor = winB ? colorB : colorA;
    const title = boldTitle(game.game_writeup) || `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;
    const body = excerpt(game.game_writeup);
    const day = new Date(`${String(game.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const bg = `<div class="hero-bg"><img src="/api/photo/${encodeURIComponent(game.id)}" alt="" fetchpriority="${!papawis && i === 0 ? 'high' : 'low'}"></div>`
    // Without a cover photo the winner's glare carries the slide, so it's stronger.
    const flareOpacity = game.has_cover ? '2e' : '66';
    const team = (name, score, win) => `<div class="hero-score__team${win ? ' is-win' : ''}">
      <span class="hero-score__name"><span class="team-dot" style="background:${teamColor(name)}"></span>${escHtml(name)}</span>
      <span class="hero-score__num font-condensed">${score}</span>
    </div>`;

    // Chips match the Game headlines cards; the scoreboard sits bottom-left above the
    // headline (hidden on phones, where the 4:5 slide keeps just chips + headline).
    const isActive = !papawis && i === 0;
    return `<div class="hero-slide${isActive ? ' hero-slide--active' : ''}">
  ${bg}
  <div class="hero-flare" style="background:radial-gradient(90% 70% at 0% 0%,${winColor}${flareOpacity} 0%,transparent 60%)"></div>
  <div class="hero-overlay"></div>
  <div class="hero-chips">${game.season ? `<span class="hero-chip hero-chip--season"><span class="pill-label">S${escHtml(String(game.season))}</span></span>` : ''}<span class="hero-chip"><span class="pill-label">${escHtml(day)}</span></span><span class="hero-chip hero-chip--final"><span class="pill-label">Final</span></span></div>
  <div class="hero-content">
    <div class="hero-score">
      ${team(game.team_a_name, scoreA, winA)}
      <span class="hero-score__dash font-condensed">–</span>
      ${team(game.team_b_name, scoreB, winB)}
    </div>
    <h2 class="hero-title">${escHtml(title.slice(0, 120))}</h2>
    ${body ? `<p class="hero-excerpt">${escHtml(body.slice(0, 280))}</p>` : ''}
    <a href="/games/${encodeURIComponent(game.id)}" class="hero-cta">Read recap <span>&rarr;</span></a>
  </div>
</div>`;
  });

  // Slide background is the award graphic itself (photo(s) + admin's crop/zoom override +
  // its own team-glow/edge gradients, text stripped via gallery-image.png) — no hero-flare
  // needed here since the graphic already carries that color treatment. Solo awards (one
  // player) get a name + writeup excerpt; team/roster awards have no single player or
  // shared writeup, so their slide is just the strip graphic + award (and for Champions,
  // team) name as the title.
  const awardSlides = awardItems.map((it, i) => {
    const isActive = !papawis && games.length === 0 && i === 0;

    if (it.kind === 'team') {
      return `<div class="hero-slide${isActive ? ' hero-slide--active' : ''}">
  <div class="hero-bg"><img src="${escHtml(it.imgUrl)}" alt="" fetchpriority="${isActive ? 'high' : 'low'}"></div>
  <div class="hero-overlay"></div>
  <div class="hero-chips"><span class="hero-chip hero-chip--season"><span class="pill-label">${escHtml(it.label)}</span></span></div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(it.title.toUpperCase())}</h2>
    <a href="/awards" class="hero-cta">View season awards <span>&rarr;</span></a>
  </div>
</div>`;
    }

    const name    = displayPlayerName(it.playerName || '').toUpperCase();
    const writeup = String(it.writeup || '').replace(/\*\*/g, '').trim();

    return `<div class="hero-slide${isActive ? ' hero-slide--active' : ''}">
  <div class="hero-bg"><img src="${escHtml(it.imgUrl)}" alt="" fetchpriority="${isActive ? 'high' : 'low'}"></div>
  <div class="hero-overlay"></div>
  <div class="hero-chips"><span class="hero-chip hero-chip--season"><span class="pill-label">${escHtml(it.label)}</span></span></div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(name)}</h2>
    ${writeup ? `<p class="hero-excerpt">${escHtml(writeup.slice(0, 280))}</p>` : ''}
    <a href="/awards" class="hero-cta">View season awards <span>&rarr;</span></a>
  </div>
</div>`;
  });

  const slides = [...(papawis ? [papawisHeroSlide(papawis)] : []), ...gameSlides, ...awardSlides];

  const dots = slides.map((_, i) =>
    `<span class="hero-dot" style="width:${i === 0 ? '22px' : '8px'};background:${i === 0 ? '#f59332' : 'rgba(255,255,255,0.25)'}"></span>`
  ).join('');

  const arrows = slides.length > 1 ? `
  <button id="hero-prev" class="hero-arrow hero-arrow--prev">&#8249;</button>
  <button id="hero-next" class="hero-arrow hero-arrow--next">&#8250;</button>` : '';

  return `<div id="hero-carousel" class="hero-carousel">
  ${slides.join('\n  ')}
  <div class="hero-dots">${dots}</div>
  ${arrows}
  <div class="hero-progress"><div class="hero-progress__bar" id="hero-progress-bar"></div></div>
</div>
<script>
(function(){
  var wrap = document.getElementById('hero-carousel');
  var slides = Array.from(wrap.querySelectorAll('.hero-slide'));
  var dots = Array.from(wrap.querySelectorAll('.hero-dot'));
  var bar = document.getElementById('hero-progress-bar');
  var n = slides.length;
  if (n < 2) return;
  var cur = 0;
  var AUTO_MS = 5000;
  var MANUAL_MS = 8000;
  var timer;

  function startProgress(ms) {
    bar.style.animation = 'none';
    bar.offsetHeight;
    bar.style.animation = 'hero-progress-fill ' + ms + 'ms linear forwards';
  }

  function resetKenBurns(slide) {
    var img = slide.querySelector('.hero-bg img');
    if (!img) return;
    img.style.animation = 'none';
    img.offsetHeight;
    img.style.animation = '';
  }

  function go(next) {
    slides[cur].classList.remove('hero-slide--active');
    dots[cur].style.width = '8px';
    dots[cur].style.background = 'rgba(255,255,255,0.25)';
    cur = ((next % n) + n) % n;
    slides[cur].classList.add('hero-slide--active');
    dots[cur].style.width = '22px';
    dots[cur].style.background = '#f59332';
    resetKenBurns(slides[cur]);
  }

  function schedule(delay) {
    clearTimeout(timer);
    startProgress(delay);
    timer = setTimeout(function(){ go(cur + 1); schedule(AUTO_MS); }, delay);
  }

  function manual(next) {
    go(next);
    schedule(MANUAL_MS);
  }

  document.getElementById('hero-prev').onclick = function(){ manual(cur - 1); };
  document.getElementById('hero-next').onclick = function(){ manual(cur + 1); };
  dots.forEach(function(d, i){ d.onclick = function(){ manual(i); }; });
  // Phones hide the arrows — a horizontal swipe changes slide instead.
  var sx = null, sy = null;
  wrap.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', function(e){
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) manual(cur + (dx < 0 ? 1 : -1));
  });

  schedule(AUTO_MS);
})();
</script>`;
}

// ── MVP Race Sidebar ──────────────────────────────────────────────────────────
// Takes the Player Highlights slot next to the hero while the MVP Race is switched on
// (buildHomeMvpRace in server.js).
// The /mvp #1 card, sidebar-sized (the shared .mv-card pieces in styles.css: gold podium
// glow, faded photo, avatar ring, first over LASTNAME), then #2–6 as rows with faces, the
// #2/#3 ranks in silver and bronze. The writeup takes the height left beside the hero.
// MVP reveal lock (lib/mvp-lock.js): the ten cases, one at a time (server.js mvpLockTen,
// shuffled per view, cached forecasts only). Every player gets a turn: all ten faces stay on
// the card as a picker, the case auto-advances, and each visit picks up where the visitor's
// last one stopped (localStorage; a first visit starts at a random case). Every case uses the
// same template and fixed text heights. Then the viewer's podium, linking to /mvp#ballot.
// Nothing here may hint at the order: no ranks, scores, movement or medal colours.
function mvpLockSidebar({ season, ten, ballot }) {
  const split = raw => {
    const s = String(raw || ''), i = s.indexOf(',');
    return i === -1 ? { first: '', last: s.toUpperCase() } : { first: s.slice(i + 1).trim(), last: s.slice(0, i).trim().toUpperCase() };
  };
  const av = (c, cls = '') => `<span class="pl-av${cls}" style="--team:${teamColor(c.team)}"><span>${escHtml(split(c.player.name).first.charAt(0) + split(c.player.name).last.charAt(0))}</span><img src="${playerPhotoUrl(String(c.player.id), 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  const faces = ten.map((c, i) => `<button type="button" class="hml-face" data-hml-go="${i}" aria-label="${escHtml(displayPlayerName(c.player.name))}'s case" aria-pressed="false">${av(c)}</button>`).join('');
  const cases = ten.map((c, i) => {
    const { first, last } = split(c.player.name);
    const num = c.player.number !== '' && c.player.number != null ? ` · #${escHtml(String(c.player.number))}` : '';
    return `<div class="hml-case" data-hml-case="${i}" style="--team:${teamColor(c.team)}"${i ? ' hidden' : ''}>
      <span class="hml-case__top"><span>${c.mode === 'forecast' ? `${escHtml(c.nextDay)} · vs ${escHtml(c.opp)}` : 'Regular season done'}</span></span>
      <a class="hml-case__who" href="/players/${encodeURIComponent(String(c.player.id))}">${av(c, ' hml-case__av')}<span><small>${escHtml(first)}</small><b>${escHtml(last)}</b><span class="pl-team"><i style="background:${teamColor(c.team)}"></i>${escHtml(c.team)}${num}</span></span></a>
      ${lockBars(c, { keys: ['pts', 'reb', 'ast'], compact: true })}
      <p class="hml-case__q">${escHtml(c.question)}</p>
    </div>`;
  }).join('');
  const byId = Object.fromEntries(ten.map(c => [String(c.player.id), c]));
  const picks = ballot?.picks || [null, null, null];
  const n = picks.filter(Boolean).length;
  const slots = picks.map((p, i) => {
    const c = p && byId[p];
    return `<span class="hml-slot${c ? '' : ' is-empty'}"><b class="font-condensed">${i + 1}</b>${c ? `${av(c, ' hml-slot__av')}<span>${escHtml(split(c.player.name).last)}</span>` : '<span>Pick</span>'}</span>`;
  }).join('');
  const show = ballot && ballot.enabled;
  const cta = !show ? '' : ballot.closed ? ''
    : !ballot.loggedIn ? `<a class="hml-cta" href="/login?next=${encodeURIComponent('/mvp#ballot')}">Log in to call the podium</a>`
    : n === 3 ? `<a class="hml-cta hml-cta--quiet" href="/mvp#ballot">${ballot.bonusOpen ? '✓ Locked in for the bonus · change it' : '✓ Saved · change it'}</a>`
    : `<a class="hml-cta" href="/mvp#ballot">${n ? `Pick your ${['1st', '2nd', '3rd'][picks.indexOf(null)]}` : 'Call the podium'}${ballot.bonusOpen ? ' · up to +3' : ''}</a>`;
  return `<div class="card sidebar hmvp-card hml" data-hml>
  <div class="hmvp-head"><span>MVP Race</span><span class="hml-lock">Locked</span></div>
  <div class="hml-body">
    <div class="hml-faces" role="group" aria-label="The ten">${faces}</div>
    <div class="hml-stage">
      <span class="hml-nav">
        <button type="button" class="hml-nav__btn" data-hml-step="-1" aria-label="Previous case"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
        <span class="font-condensed"><b data-hml-n>1</b> / ${ten.length}</span>
        <button type="button" class="hml-nav__btn" data-hml-step="1" aria-label="Next case"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
      </span>
      ${cases}
      <span class="hml-timer" aria-hidden="true"><span data-hml-timer></span></span>
    </div>
    ${show ? `<div class="hml-slots">${slots}</div>${cta}` : ''}
  </div>
  <a href="/mvp" class="hmvp-foot">All ten cases <span>&rarr;</span>${show && ballot.bonusOpen && ballot.bonusAt ? `<small class="hml-foot__cut">Bonus closes ${escHtml(ballot.bonusAt.split(' · ')[0])}</small>` : ''}</a>
</div>
<script>
(function () {
  var box = document.querySelector('[data-hml]');
  if (!box || box.dataset.on) return;
  box.dataset.on = '1';
  var cases = box.querySelectorAll('[data-hml-case]'), faces = box.querySelectorAll('[data-hml-go]');
  var nEl = box.querySelector('[data-hml-n]'), bar = box.querySelector('[data-hml-timer]');
  var N = cases.length, KEY = 'wknd-mvp-case-${escHtml(String(season))}', MS = 7000;
  var ids = Array.prototype.map.call(cases, function (c) { return c.querySelector('a').getAttribute('href'); });
  var at = Math.floor(Math.random() * N);
  try { var last = localStorage.getItem(KEY); var k = ids.indexOf(last); if (k !== -1) at = (k + 1) % N; } catch (e) {}
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still) box.classList.add('hml-anim');
  function show(i) {
    at = (i + N) % N;
    Array.prototype.forEach.call(cases, function (c, j) { c.hidden = j !== at; c.classList.remove('is-in'); });
    // Replay the bar grow for the case that just came in.
    void cases[at].offsetWidth; cases[at].classList.add('is-in');
    Array.prototype.forEach.call(faces, function (f, j) { f.classList.toggle('is-on', j === at); f.setAttribute('aria-pressed', j === at ? 'true' : 'false'); });
    nEl.textContent = at + 1;
    try { localStorage.setItem(KEY, ids[at]); } catch (e) {}
    restart();
  }
  var t = 0, paused = false;
  function restart() {
    clearTimeout(t);
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
    if (still || paused) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (bar) { bar.style.transition = 'width ' + MS + 'ms linear'; bar.style.width = '100%'; } }); });
    t = setTimeout(function () { show(at + 1); }, MS);
  }
  box.addEventListener('click', function (e) {
    var g = e.target.closest('[data-hml-go]'), s = e.target.closest('[data-hml-step]');
    if (g) show(Number(g.dataset.hmlGo)); else if (s) show(at + Number(s.dataset.hmlStep));
  });
  var stage = box.querySelector('.hml-stage');
  function pause(on) { paused = on; restart(); }
  stage.addEventListener('mouseenter', function () { pause(true); });
  stage.addEventListener('mouseleave', function () { pause(false); });
  stage.addEventListener('touchstart', function () { pause(true); }, { passive: true });
  document.addEventListener('visibilitychange', function () { pause(document.hidden); });
  show(at);
})();
</script>`;
}

function mvpRaceSidebar({ season, week, final, candidates, locked = false, ten, ballot }) {
  if (locked) return mvpLockSidebar({ season, ten, ballot });
  const [lead, ...rest] = candidates;
  const ls    = lead.stats;
  const gp    = ls.gp || 1;
  const color = teamColor(ls.team_name);
  const href  = id => `/players/${encodeURIComponent(String(id))}`;
  const when  = final ? `S${season} · FINAL` : week ? `S${season} · AFTER WEEK ${week}` : `S${season}`;
  const writeup = String(lead.writeup || '').replace(/\*\*/g, '').trim();
  const nameOf = raw => {
    const s = String(raw || ''), i = s.indexOf(',');
    return i === -1 ? { first: '', last: s.toUpperCase() } : { first: s.slice(i + 1).trim(), last: s.slice(0, i).trim().toUpperCase() };
  };
  const ln = nameOf(lead.player.name);
  const leadNote = lead.prevRank === 1 ? 'Held #1' : lead.prevRank === null ? 'New this week'
    : lead.prevRank > 1 ? `Up from #${lead.prevRank}` : '';
  const num = lead.player.number !== '' && lead.player.number != null ? ` · #${escHtml(String(lead.player.number))}` : '';
  const rec = (ls.wins || ls.losses) ? ` · ${ls.wins}–${ls.losses}` : '';
  const clear = rest[0] ? Math.max(0, lead.mvpScore - rest[0].mvpScore).toFixed(1) : '';
  const initialsOf = n => `${n.first[0] || ''}${n.last[0] || ''}`;
  const av = (id, n, cls = '') => `<span class="pl-av${cls}"><span>${escHtml(initialsOf(n))}</span><img src="${playerPhotoUrl(String(id), 192)}" alt="" loading="lazy" onerror="this.remove()"></span>`;

  const rowMove = (rank, prev) => {
    if (prev === undefined) return '<span></span>';
    if (prev === null) return `<span class="hmvp-move is-up" title="New this week">NEW</span>`;
    const d = prev - rank;
    if (d > 0) return `<span class="hmvp-move is-up" title="Last week #${prev}">▲${d}</span>`;
    if (d < 0) return `<span class="hmvp-move is-down" title="Last week #${prev}">▼${-d}</span>`;
    return `<span class="hmvp-move" title="Last week #${prev}">–</span>`;
  };

  const rows = rest.map((c, i) => {
    const rank = i + 2;
    const n = nameOf(c.player.name);
    return `<a href="${href(c.player.id)}" class="hmvp-row${rank <= 3 ? ` hmvp-row--r${rank}` : ''}" style="--team:${teamColor(c.stats.team_name)}">
    <span class="hmvp-row__rank font-condensed">${rank}</span>
    ${av(c.player.id, n, ' pl-av--sm')}
    <span class="hmvp-row__name">${n.first ? `<span>${escHtml(n.first)}</span>` : ''}<b>${escHtml(n.last)}</b></span>
    ${rowMove(rank, c.prevRank)}
    <span class="hmvp-row__score font-condensed">${c.mvpScore.toFixed(1)}</span>
  </a>`;
  }).join('\n  ');

  const tiles = [['PPG', ls.pts], ['RPG', ls.reb], ['APG', ls.ast], ['SPG', ls.stl]]
    .map(([k, v]) => `<span class="mv-tile"><b class="font-condensed">${(v / gp).toFixed(1)}</b><small>${k}</small></span>`).join('');

  return `<div class="card sidebar hmvp-card">
  <div class="hmvp-head"><span>MVP Race</span><span class="hmvp-when">${escHtml(when)}</span></div>
  <article class="mv-card mv-card--r1 hmvp-lead" style="--team:${color}">
    <span class="mv-card__bg" aria-hidden="true"><img class="mvpx-img" src="${playerPhotoUrl(String(lead.player.id))}" alt="" loading="lazy" onerror="this.remove()"></span>
    <span class="mv-card__ghost font-condensed" aria-hidden="true">1</span>
    <span class="mv-card__tags"><span class="mvpx-badge mvpx-badge--solid">FRONTRUNNER</span>${leadNote ? `<span class="mvpx-move is-same">${escHtml(leadNote)}</span>` : ''}</span>
    <span class="mv-card__id">
      ${av(lead.player.id, ln)}
      <span class="pl-card__who">
        ${ln.first ? `<span class="pl-card__first">${escHtml(ln.first)}</span>` : ''}
        <span class="pl-card__last">${escHtml(ln.last)}</span>
        <span class="pl-card__meta"><span class="pl-team"><i style="background:${color}"></i>${escHtml(String(ls.team_name || '').toUpperCase())}${num}${rec}</span></span>
      </span>
      <span class="mv-card__score hmvp-lead__score"><b class="font-condensed">${lead.mvpScore.toFixed(1)}</b><small>${clear ? `+${clear} clear` : 'MVP score'}</small></span>
    </span>
    <span class="mv-tiles hmvp-tiles">${tiles}</span>
    ${writeup ? `<div class="hmvp-lead__body"><p>${escHtml(writeup)}</p></div>` : ''}
    <a href="${href(lead.player.id)}" class="mv-card__link" aria-label="${escHtml(displayPlayerName(lead.player.name))}’s profile"></a>
  </article>
  ${rows ? `<div class="hmvp-ladder">${rows}</div>` : ''}
  <a href="/mvp" class="hmvp-foot">Full MVP race <span>&rarr;</span></a>
</div>
<script>
// The writeup takes whatever height the card has left beside the hero, so the line clamp
// is fitted to that space (whole lines + ellipsis) instead of a fixed count. The clamp sits
// on the inner <p>: as a flex item the outer box can't be display:-webkit-box itself.
(function(){
  var box = document.querySelector('.hmvp-lead__body');
  var p = box && box.querySelector('p');
  if (!p) return;
  function fit(){
    var lh = parseFloat(getComputedStyle(p).lineHeight) || 18;
    p.style.webkitLineClamp = String(Math.max(3, Math.floor(box.clientHeight / lh)));
  }
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
</script>`;
}

// ── Player Highlights Sidebar ─────────────────────────────────────────────────
export function highlightsSidebar(highlights, { limit = 4, seeAllLink = true } = {}) {
  if (!highlights.length) {
    return `<div class="card sidebar">
  <div class="card-label">PLAYER HIGHLIGHTS</div>
  <p class="hc-empty">No player highlights yet. Check back after the next game!</p>
</div>`;
  }

  const rows = highlights.slice(0, limit).map(({ game, stat, player, team }) => {
    const displayName = displayPlayerName(player?.name || '').toUpperCase();
    const teamName = String(team?.name || '').toUpperCase();
    const color = teamColor(teamName);
    const isLight = teamName === 'WHITE';
    const writeup = String(game.potg_writeup || '').replace(/\*\*/g, '').trim();

    return `<a href="/games/${escHtml(game.id)}#potg-anchor" class="highlight-card">
  <div class="hc-top">
    <div class="hc-info">
      <span class="hc-name">${escHtml(displayName)}</span>
      <div class="hc-stat-line">${stat.pts} PTS · ${stat.reb} REB · ${stat.ast} AST</div>
    </div>
    <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
  </div>
  ${writeup ? `<p class="hc-body">${escHtml(truncate(writeup, 150))}</p>` : ''}
</a>`;
  });

  return `<div class="card sidebar">
  <div class="card-label">PLAYER HIGHLIGHTS${seeAllLink && highlights.length > limit ? ' <a href="/highlights" class="card-label__more">See all</a>' : ''}</div>
  ${rows.join('\n  ')}
</div>`;
}

// ── League Leaders ────────────────────────────────────────────────────────────
// Exported so other pages (e.g. team detail) can reuse the exact same card design
// and carousel against a pre-filtered player pool. showTeamChip is dropped for
// single-team pools, where every card would repeat the same identical chip. skip/limit
// slice the (priority-ordered) categories — team-detail.js calls this twice: once with
// limit:6 for a fixed, non-scrolling top row (.leader-card's own width math is already "6
// across" for exactly this), and again with skip:6 for a carousel of everything else, so
// the two don't repeat the same 6 categories. carousel:false skips the auto-advancing
// carousel chrome for a static wrap-friendly grid. prominent:true is the same card, just
// bigger (avatar/stat) with a team-color glare — used for that fixed top row only, so it
// doesn't compete with the plainer carousel cards.
// Stat categories shared by leagueLeaders (team pages) and the homepage leader boards —
// one place for the formulas and minimum-attempt filters.
function leaderCategoryDefs() {
  const fga = p => (p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0)+(p.fg4m_miss||0);
  const tpa = p => (p.fg3m||0)+(p.fg3m_miss||0);
  const qpa = p => (p.fg4m||0)+(p.fg4m_miss||0);
  const fta = p => (p.ftm||0)+(p.ft_miss||0);
  const per = p => { const fgm = (p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0), fga = fgm+(p.fg2m_miss||0)+(p.fg3m_miss||0)+(p.fg4m_miss||0); return ((p.pts||0) + 0.4*fgm - 0.7*fga - 0.4*(p.ft_miss||0) + 0.7*(p.reb||0) + (p.stl||0) + 0.7*(p.ast||0) + 0.7*(p.blk||0) - (p.turnover||0)) / p.games_played; };
  const categories = [
    { label: 'PPG', title: 'Points',            sort: p => p.pts / p.games_played,                      fn: p => (p.pts / p.games_played).toFixed(1) },
    { label: 'PER', title: 'Efficiency Rating', sort: p => per(p),                                      fn: p => per(p).toFixed(1) },
    { label: 'RPG', title: 'Rebounds',          sort: p => p.reb / p.games_played,                      fn: p => (p.reb / p.games_played).toFixed(1) },
    { label: 'APG', title: 'Assists',           sort: p => p.ast / p.games_played,                      fn: p => (p.ast / p.games_played).toFixed(1) },
    { label: 'SPG', title: 'Steals',            sort: p => p.stl / p.games_played,                      fn: p => (p.stl / p.games_played).toFixed(1) },
    { label: 'BPG', title: 'Blocks',            sort: p => p.blk / p.games_played,                      fn: p => (p.blk / p.games_played).toFixed(1) },
    { label: 'FG%', title: 'Field Goal %',      sort: p => fga(p) >= 10 ? (p.fg2m+p.fg3m+(p.fg4m||0))/fga(p) : -1, fn: p => Math.round((p.fg2m+p.fg3m+(p.fg4m||0))/fga(p)*100)+'%', minFilter: p => fga(p) >= 10 },
    { label: '3P%', title: '3-Point %',         sort: p => tpa(p) >= 5  ? p.fg3m/tpa(p) : -1,          fn: p => Math.round(p.fg3m/tpa(p)*100)+'%',           minFilter: p => tpa(p) >= 5 },
    { label: '3PM', title: '3-Pointers',        sort: p => p.fg3m / p.games_played,                     fn: p => (p.fg3m / p.games_played).toFixed(1) },
    { label: '4P%', title: '4-Point %',         sort: p => qpa(p) >= 1  ? (p.fg4m||0)/qpa(p) : -1,     fn: p => Math.round((p.fg4m||0)/qpa(p)*100)+'%',      minFilter: p => qpa(p) >= 1 },
    { label: '4PM', title: '4-Pointers',        sort: p => (p.fg4m||0) / p.games_played,                fn: p => ((p.fg4m||0) / p.games_played).toFixed(1) },
    { label: 'FTM', title: 'Free Throws',       sort: p => p.ftm  / p.games_played,                     fn: p => (p.ftm  / p.games_played).toFixed(1) },
    { label: 'TO',  title: 'Turnovers',         sort: p => p.turnover / p.games_played,                 fn: p => (p.turnover / p.games_played).toFixed(1) },
    { label: 'FT%', title: 'Free Throw %',      sort: p => fta(p) >= 5  ? p.ftm/fta(p) : -1,           fn: p => Math.round(p.ftm/fta(p)*100)+'%',            minFilter: p => fta(p) >= 5 },
  ];
  return categories;
}

// Homepage leader boards: top 3 in each of the given categories (by label). Also fed to the
// AI summary in server.js, so the summary only ever talks about what the cards show.
const HOME_LEADER_CATS = [
  ['PPG', 'Points'], ['RPG', 'Rebounds'], ['APG', 'Assists'], ['SPG', 'Steals'],
  ['BPG', 'Blocks'], ['3PM', 'Threes made'], ['PER', 'Efficiency'], ['FG%', 'Field goal %'],
];
export function leaderBoards(players) {
  const active = players.filter(p => p.games_played > 0);
  if (!active.length) return [];
  const defs = Object.fromEntries(leaderCategoryDefs().map(c => [c.label, c]));
  return HOME_LEADER_CATS.map(([label, title]) => {
    const cat = defs[label];
    const pool = cat.minFilter ? active.filter(cat.minFilter) : active;
    const top = pool.filter(p => cat.sort(p) > 0)
      .sort((a, b) => cat.sort(b) - cat.sort(a) || b.games_played - a.games_played)
      .slice(0, 3)
      .map(p => ({ id: p.id, name: p.name, team: String(p.team_name || '').toUpperCase(), value: cat.fn(p), gp: p.games_played, photo: !!p.picture_url, number: p.number }));
    if (!top.length) return null;
    // Gap to #1 on each chasing row ("−1.5", "TIE") — from the displayed values, so it
    // always matches what's on the card (same layout as the /leaders boards).
    const decimals = (top[0].value.split('.')[1] || '').replace('%', '').length;
    for (const p of top.slice(1)) {
      const gap = parseFloat(top[0].value) - parseFloat(p.value);
      p.delta = gap > 0.001 ? `−${gap.toFixed(decimals)}` : 'TIE';
    }
    return { label, title, top };
  }).filter(Boolean);
}

export function leagueLeaders(players, { showTeamChip = true, skip = 0, limit = null, carousel = true, prominent = false } = {}) {
  const active = players.filter(p => p.games_played > 0);
  if (!active.length) return '';
  const categories = leaderCategoryDefs();

  const useCategories = categories.slice(skip, limit != null ? skip + limit : undefined);
  const cards = useCategories.map((cat, i) => {
    const pool = cat.minFilter ? active.filter(cat.minFilter) : active;
    const leader = pool.filter(p => cat.sort(p) > 0)
      .sort((a, b) => cat.sort(b) - cat.sort(a) || b.games_played - a.games_played)[0];
    if (!leader) return null;

    const teamName = String(leader.team_name || '').toUpperCase();
    const color = teamColor(teamName);
    const isLight = teamName === 'WHITE';

    return `<div class="card leader-card${prominent ? ' leader-card--prominent' : ''}" data-index="${i}"${prominent ? ` style="--lc-color:${color}"` : ''}>
  <span class="leader-cat">${cat.label}</span>
  <span class="leader-title">${escHtml(cat.title)}</span>
  ${playerAvatar(leader.id, leader.name, color, { className: 'leader-avatar', link: true })}
  <span class="leader-name">${playerLink(leader.id, leader.name, { upper: true })}</span>
  ${showTeamChip ? `<span class="team-chip leader-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>` : ''}
  <span class="font-condensed leader-stat">${escHtml(cat.fn(leader))}</span>
</div>`;
  }).filter(Boolean);

  if (!carousel) return cards.length ? `<div class="leaders-grid">${cards.join('\n')}</div>` : '';
  return cardCarousel(cards);
}

// Shared by leagueLeaders and rosterMoversCarousel — both just build a list of cards (each
// carrying its own data-index) and hand them to this wrapper for the actual carousel chrome
// (prev/next buttons, auto-advance, infinite-loop scroll). The card markup itself is free to
// differ between the two (see .mover-card below) — this only cares that each top-level child
// of the track has a data-index attribute.
function cardCarousel(cards) {
  if (!cards.length) return '';

  const CHEVRON_L = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  return `<div class="leaders-carousel">
  <button class="lc-nav lc-nav--prev" aria-label="Previous">${CHEVRON_L}</button>
  <div class="lc-track">
    ${cards.join('\n    ')}
  </div>
  <button class="lc-nav lc-nav--next" aria-label="Next">${CHEVRON_R}</button>
</div>
<script>(function(){
  var wrap = document.currentScript.previousElementSibling;
  var track = wrap.querySelector('.lc-track');
  var btnP = wrap.querySelector('.lc-nav--prev');
  var btnN = wrap.querySelector('.lc-nav--next');
  var origCards = Array.from(track.querySelectorAll('[data-index]'));
  var n = origCards.length;
  origCards.forEach(function(c){ track.appendChild(c.cloneNode(true)); });
  var current = 0;
  var timer;

  function cardW() { return origCards[0] ? origCards[0].offsetWidth + 14 : 204; }

  function advance() {
    current++;
    if (current >= n) {
      track.scrollTo({ left: cardW() * n, behavior: 'smooth' });
      setTimeout(function(){ track.scrollTo({ left: 0, behavior: 'instant' }); current = 0; }, 450);
    } else {
      track.scrollTo({ left: cardW() * current, behavior: 'smooth' });
    }
  }

  function resetTimer() { clearInterval(timer); timer = setInterval(advance, 3000); }

  btnP.addEventListener('click', function(){
    if (current > 0) { current--; } else { current = n - 1; }
    track.scrollTo({ left: cardW() * current, behavior: 'smooth' });
    resetTimer();
  });
  btnN.addEventListener('click', function(){ advance(); resetTimer(); });

  resetTimer();
})()</script>`;
}

// ── New / Traded Players ────────────────────────────────────────────────────────
// Shown in League Leaders' place (see the admin Visibility switch) — its own card design
// rather than a reskin of .leader-card, since the interesting fact here is a status (new to
// the league / moved teams) and a team change, not a single stat number. The NEW/TRADED
// badge is the same green/blue used for the same two states on /my-team's roster rows, and
// a traded player's card shows the actual old-team → new-team transition rather than just
// prose. movers come from server.js's buildRosterMovers(): { id, name, position, teamName,
// fromTeamName } — fromTeamName is '' for a player genuinely new to the league.
function teamPill(teamName) {
  const upper = String(teamName || '').toUpperCase();
  const color = teamColor(upper);
  const isLight = upper === 'WHITE';
  return `<span class="team-chip mover-pill" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(upper)}</span>`;
}

function rosterMoversCarousel(movers) {
  if (!movers.length) return '';
  const DOT = `<svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`;
  const ARROW = `<svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 5h11M8 1l4 4-4 4"/></svg>`;

  const cards = movers.map((m, i) => {
    const isNew = !m.fromTeamName;
    const avatarColor = teamColor(String(m.teamName || '').toUpperCase());

    return `<div class="card mover-card" data-index="${i}">
  <span class="mover-badge mover-badge--${isNew ? 'new' : 'traded'}">${DOT} ${isNew ? 'New' : 'Traded'}</span>
  ${playerAvatar(m.id, m.name, avatarColor, { className: 'mover-avatar', link: true })}
  <span class="mover-name">${playerLink(m.id, m.name, { upper: true })}</span>
  <div class="mover-transition">
    ${isNew ? '' : `${teamPill(m.fromTeamName)}<span class="mover-arrow">${ARROW}</span>`}
    ${teamPill(m.teamName)}
  </div>
  <span class="font-condensed mover-pos">${escHtml(m.position || '—')}</span>
</div>`;
  });

  return cardCarousel(cards) + `<style>
.mover-card { scroll-snap-align: start; flex-shrink: 0; width: calc((100% - 5 * 14px) / 6); padding: 20px 16px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.mover-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; margin-bottom: 14px; }
.mover-badge--new { background: rgba(34,197,94,.1); color: #22c55e; border: 1px solid rgba(34,197,94,.3); }
.mover-badge--traded { background: rgba(59,130,246,.1); color: #3b82f6; border: 1px solid rgba(59,130,246,.3); }
.mover-avatar { width: 64px; height: 64px; border-radius: 50%; background: #181d28; border: 2px solid; display: flex; align-items: center; justify-content: center; margin-bottom: 13px; position: relative; overflow: hidden; }
.mover-avatar .font-condensed { font-size: 26px; color: #cdd3de; }
.mover-name { font-size: 13px; font-weight: 700; color: #f4f6fa; margin-bottom: 12px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mover-transition { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
.mover-pill { align-self: center; }
.mover-arrow { color: var(--text-subtle); display: flex; flex-shrink: 0; }
.mover-pos { font-size: 34px; font-weight: 800; line-height: 1; color: var(--amber); }
@media (max-width: 1100px) { .mover-card { width: calc((100% - 3 * 14px) / 4); } }
@media (max-width: 640px) {
  .mover-card { width: calc((100% - 2 * 14px) / 3); }
  .mover-transition { flex-wrap: wrap; justify-content: center; }
}
</style>`;
}

// ── Registration Banner ───────────────────────────────────────────────────────
// Logged-out "Join the community" band (shown while reg_open is on). Top row: rotating
// AI-written copy from the registration message pool, CTA + note on the right. Bottom row:
// a full-width strip of 6 real numbers, a random pick per page view so repeat visitors see
// the league from different angles, counting up from 0 when the strip scrolls into view. Each tile is tag / number / label, and labels are kept
// short enough to stay on one line down to phone width — the "since Season N" qualifier
// for league totals lives in the tag, not the label, so the totals never claim to be
// all-time when the DB doesn't start at Season 1.
function registrationBanner({ pill, headline, message, cta, note, stats = {} }) {
  const fmt    = n => `<span class="js-count" data-count="${Number(n)}">${Number(n).toLocaleString('en-US')}</span>`;
  const sinceS = stats.firstSeason > 1 ? `League · since S${stats.firstSeason}` : 'League';
  const lp     = stats.lastPapawis;
  const tile   = (kind, tag, n, label) => ({ kind, tag, n, label });
  const pool   = [
    stats.leaguePlayers  ? tile('league', 'League', fmt(stats.leaguePlayers), 'league players') : null,
    stats.points         ? tile('league', sinceS, fmt(stats.points), 'points scored') : null,
    stats.threes         ? tile('league', sinceS, fmt(stats.threes), 'threes made') : null,
    stats.fours          ? tile('league', sinceS, fmt(stats.fours), '4-pointers made') : null,
    stats.rebounds       ? tile('league', sinceS, fmt(stats.rebounds), 'rebounds grabbed') : null,
    stats.assists        ? tile('league', sinceS, fmt(stats.assists), 'assists dished') : null,
    stats.steals         ? tile('league', sinceS, fmt(stats.steals), 'steals') : null,
    stats.gamesTracked   ? tile('league', 'League', fmt(stats.gamesTracked), 'games stat-tracked') : null,
    stats.gamesOnYoutube ? tile('league', 'League', fmt(stats.gamesOnYoutube), 'games on YouTube') : null,
    stats.members        ? tile('community', 'Community', fmt(stats.members), 'members') : null,
    stats.papawisRuns    ? tile('papawis', 'Papawis', fmt(stats.papawisRuns), 'open runs played') : null,
    stats.papawisSpots   ? tile('papawis', 'Papawis', fmt(stats.papawisSpots), 'spots played') : null,
    stats.papawisPlayers ? tile('papawis', 'Papawis', fmt(stats.papawisPlayers), 'different players') : null,
    stats.papawisCourts > 1 ? tile('papawis', 'Papawis', fmt(stats.papawisCourts), 'courts played at') : null,
    lp && lp.max_slots && lp.confirmed
      ? tile('papawis', lp.waitlist ? `Papawis · +${lp.waitlist} waitlist` : 'Papawis', `${fmt(lp.confirmed)}<small>/${lp.max_slots}</small>`, 'filled last run')
      : null,
  ].filter(Boolean);
  // Fisher–Yates, then take 6
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const tiles = pool.slice(0, 6);

  return `<section class="join-band" aria-label="Join the WKND community">
  <div class="join-band__top">
    <div class="join-band__copy">
      <span class="join-band__pill">${escHtml(pill || 'Bagong Dating? 👀')}</span>
      <h2 class="join-band__headline">${escHtml(headline || 'Join the community.')}</h2>
      <p class="join-band__message">${escHtml(message || 'All skill levels welcome. Register to join Papawis runs and get your own stats page.')}</p>
    </div>
    <div class="join-band__actions">
      <a href="/register" class="join-band__cta">${escHtml(cta || 'Join the community')}</a>
      <span class="join-band__fine">${escHtml(note || 'Takes a few minutes.')}</span>
    </div>
  </div>
  ${tiles.length ? `<div class="join-band__stats" style="--tiles:${tiles.length}">
    ${tiles.map(t => `<div class="join-band__stat"><span class="join-band__stat-tag join-band__stat-tag--${t.kind}">${escHtml(t.tag)}</span><span class="join-band__stat-n font-condensed">${t.n}</span><span class="join-band__stat-l">${escHtml(t.label)}</span></div>`).join('\n    ')}
  </div>` : ''}
</section>
<script>
// Count-up: each number runs 0 → its real value the first time the strip scrolls into
// view. The real values are already in the HTML, so no-JS and reduced-motion visitors
// just see the final numbers.
(function(){
  var strip = document.querySelector('.join-band__stats');
  if (!strip || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = Array.prototype.slice.call(strip.querySelectorAll('.js-count'));
  var DURATION = 1400;
  els.forEach(function(el){ el.textContent = '0'; });
  function show(eased){
    els.forEach(function(el){
      var target = Number(el.getAttribute('data-count')) || 0;
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
    });
  }
  function run(){
    var start = performance.now(), done = false;
    function frame(now){
      if (done) return;
      var t = Math.min(1, (now - start) / DURATION);
      show(1 - Math.pow(1 - t, 3)); // easeOutCubic
      if (t < 1) requestAnimationFrame(frame); else done = true;
    }
    requestAnimationFrame(frame);
    // Safety net: if animation frames get throttled (background tab, power saving), still
    // land on the real values when the animation should have finished.
    setTimeout(function(){ if (!done) { done = true; show(1); } }, DURATION + 150);
  }
  var io = new IntersectionObserver(function(entries){
    if (entries.some(function(e){ return e.isIntersecting; })) { io.disconnect(); run(); }
  }, { threshold: 0.4 });
  io.observe(strip);
})();
</script>`;
}

function memberSignupBannerBig({ season, headline, message, cta }) {
  return `<section class="reg-banner" aria-label="Season Signup">
  <div class="reg-banner__glow" aria-hidden="true"></div>
  <div class="reg-banner__arc" aria-hidden="true"></div>
  <div class="reg-banner__inner">
    <div class="reg-banner__copy">
      <div class="reg-banner__eyebrow">
        <span class="reg-banner__pill">
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
          Season ${escHtml(String(season))} Signup Open
        </span>
      </div>
      <h2 class="reg-banner__headline">${escHtml(headline || 'Lock In Your Spot.')}</h2>
      <p class="reg-banner__deadline">${escHtml(message || 'Confirm your spot for the upcoming season before signup closes.')}</p>
    </div>
    <a href="/season-signup" class="reg-banner__cta">
      ${escHtml(cta || 'Sign Me Up')} <span aria-hidden="true">→</span>
    </a>
  </div>
</section>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
// ── Coming up (buildHomeNextUp in server.js) ──────────────────────────────────
// Up to four cards: League + Papawis are fixed, the rest are admin-picked on
// /admin/visibility. Each renderer gets that card's data and returns one <article>.
function nuDayLabel(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function nuDaysAway(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = manilaTodayStr().split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  return n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}
const nuPeso = n => `₱${Number(n).toLocaleString('en-US')}`;
// "LASTNAME, Firstname" (how names are stored) → "Firstname L." — first name + last initial only.
const nuShortName = raw => {
  const parts = displayPlayerName(String(raw || '')).trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || '';
};
function nuCard(kind, kicker, title, meta, body, foot) {
  return `<article class="card nu-card nu-card--${kind}">
    <div class="nu-card__head">
      <span class="nu-card__kicker">${kicker}</span>
      <h3 class="nu-card__title">${title}</h3>
      ${meta ? `<span class="nu-card__meta">${meta}</span>` : ''}
    </div>
    <div class="nu-card__body">${body}</div>
    ${foot ? `<div class="nu-card__foot">${foot}</div>` : ''}
  </article>`;
}

const NU_RENDER = {
  league(d) {
    if (d.mode === 'upcoming') {
      const rows = d.games.map(g => `<div class="nu-match">
        <span class="nu-match__team"><span class="team-dot" style="background:${teamColor(g.a)}"></span>${escHtml(g.a)}${g.recA ? ` <em>${escHtml(g.recA)}</em>` : ''}</span>
        <span class="nu-match__vs">vs</span>
        <span class="nu-match__team nu-match__team--r">${g.recB ? `<em>${escHtml(g.recB)}</em> ` : ''}${escHtml(g.b)}<span class="team-dot" style="background:${teamColor(g.b)}"></span></span>
      </div>`).join('');
      return nuCard('league', `League · Season ${escHtml(String(d.season))}`, escHtml(nuDayLabel(d.date)),
        `${escHtml(nuDaysAway(d.date))} · ${d.games.length} game${d.games.length === 1 ? '' : 's'}`,
        rows, `<a href="/games" class="nu-card__link">All games <span>&rarr;</span></a>`);
    }
    const rows = d.games.map(g => {
      const winA = g.scoreA > g.scoreB, winB = g.scoreB > g.scoreA;
      return `<a href="/games/${encodeURIComponent(g.id)}" class="nu-match nu-match--result">
        <span class="nu-match__team${winA ? ' is-win' : ''}"><span class="team-dot" style="background:${teamColor(g.a)}"></span>${escHtml(g.a)}</span>
        <span class="nu-match__score font-condensed"><b${winA ? ' class="is-win"' : ''}>${g.scoreA}</b>–<b${winB ? ' class="is-win"' : ''}>${g.scoreB}</b></span>
        <span class="nu-match__team nu-match__team--r${winB ? ' is-win' : ''}">${escHtml(g.b)}<span class="team-dot" style="background:${teamColor(g.b)}"></span></span>
      </a>`;
    }).join('');
    return nuCard('league', `League · Latest results`, escHtml(nuDayLabel(d.date)),
      'Next game day to be announced', rows, `<a href="/games" class="nu-card__link">All games <span>&rarr;</span></a>`);
  },

  papawis(d, { isLoggedIn }) {
    if (d.empty) {
      return nuCard('papawis', 'Papawis · Open run', 'Next run TBA',
        'Weekend pickup games, all levels',
        `<p class="nu-card__text">The next open run hasn't been posted yet. Check back soon.</p>`,
        `<a href="/papawis" class="nu-card__link">See past runs <span>&rarr;</span></a>`);
    }
    const pct  = d.maxSlots ? Math.min(100, Math.round(d.confirmed / d.maxSlots * 100)) : 0;
    const full = d.maxSlots && d.confirmed >= d.maxSlots;
    const meta = [escHtml(nuDaysAway(d.date)), d.time && escHtml(d.time)].filter(Boolean).join(' · ');
    const body = `${d.location ? `<p class="nu-card__text nu-card__text--loc">${escHtml(d.location)}${d.hasReferee ? ' · with ref' : ''}</p>` : ''}
      ${d.maxSlots ? `<div class="nu-slots"><div class="nu-slots__bar"><i style="width:${pct}%"></i></div>
      <div class="nu-slots__row"><span><b>${d.confirmed}/${d.maxSlots}</b> ${full ? 'full' : 'slots filled'}</span>${d.waitlist ? `<span class="nu-slots__wait">+${d.waitlist} waitlist</span>` : ''}</div></div>` : ''}
      ${avatarStack(d.faces, { size: 32, max: 7, total: d.confirmed, className: 'nu-faces', label: `${d.confirmed} players confirmed` })}
      ${d.price != null ? `<p class="nu-card__price"><b>${nuPeso(d.price)}</b> per player</p>` : ''}`;
    const foot = isLoggedIn
      ? `<a href="/papawis" class="nu-card__link">${full ? 'Join the waitlist' : 'Grab a slot'} <span>&rarr;</span></a>`
      : `<a href="/register" class="nu-card__link">Join to play <span>&rarr;</span></a>`;
    return nuCard('papawis', 'Papawis · Open run', escHtml(nuDayLabel(d.date)), meta, body, foot);
  },

  marketplace(d) {
    const rows = d.listings.map(l => `<a href="/marketplace/${encodeURIComponent(l.id)}" class="nu-item">
      <span class="nu-item__thumb">${l.hasPhoto ? `<img src="/api/marketplace/${encodeURIComponent(l.id)}/photo/0" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <span class="nu-item__body"><span class="nu-item__title">${escHtml(l.title)}</span>
      <span class="nu-item__price">${nuPeso(l.price)}${l.compareAt > l.price ? ` <s>${nuPeso(l.compareAt)}</s>` : ''}</span></span>
    </a>`).join('');
    return nuCard('marketplace', 'Marketplace', 'Fresh drops', 'Jerseys and gear from the community',
      rows, `<a href="/marketplace" class="nu-card__link">Shop all <span>&rarr;</span></a>`);
  },

  birthdays(d) {
    if (d.locked) {
      return nuCard('birthdays', 'Birthdays', 'This week', '',
        `<div class="nu-big"><span class="nu-big__n font-condensed">${d.total}</span><span class="nu-big__l">${d.total === 1 ? 'player celebrates' : 'players celebrate'} a birthday this week 🎂</span></div>`,
        `<a href="/login" class="nu-card__link">Log in to see who <span>&rarr;</span></a>`);
    }
    const when = n => n === 0 ? 'Today 🎂' : n === 1 ? 'Tomorrow' : `In ${n} days`;
    const rows = d.people.map(p => `<a href="/players/${encodeURIComponent(p.id)}" class="nu-person">
      ${playerAvatar(p.id, p.name, teamColor(p.team), { className: 'nu-person__avatar' })}
      <span class="nu-person__name">${escHtml(displayPlayerName(p.name))}</span>
      <span class="nu-person__when${p.inDays === 0 ? ' is-today' : ''}">${when(p.inDays)}</span>
    </a>`).join('');
    return nuCard('birthdays', 'Birthdays', 'This week',
      d.total > d.people.length ? `${d.total} players` : '', rows, '');
  },

  new_members(d, { isLoggedIn }) {
    const chips = d.members.map(m => `<span class="nu-chip">${escHtml(nuShortName(m.name))}</span>`).join('');
    return nuCard('new_members', 'Community', 'New this month',
      `${d.total} new member${d.total === 1 ? '' : 's'} in the last 30 days`,
      `<div class="nu-chips">${chips}</div>`,
      isLoggedIn ? '' : `<a href="/register" class="nu-card__link">Join them <span>&rarr;</span></a>`);
  },

  poll(d) {
    if (d.locked) {
      return nuCard('poll', 'Players are voting', 'A league poll is open', '',
        `<div class="nu-big"><span class="nu-big__n font-condensed">${d.votes}</span><span class="nu-big__l">vote${d.votes === 1 ? '' : 's'} cast so far</span></div>`,
        `<a href="/login" class="nu-card__link">Log in to vote <span>&rarr;</span></a>`);
    }
    const opts = (d.options || []).slice(0, 4).map(o => `<li>${escHtml(o)}</li>`).join('');
    return nuCard('poll', 'Players are voting', escHtml(d.question), `${d.votes} vote${d.votes === 1 ? '' : 's'} so far`,
      `<ul class="nu-poll">${opts}</ul>`, `<a href="/polls" class="nu-card__link">Cast your vote <span>&rarr;</span></a>`);
  },

  video(d) {
    return nuCard('video', 'Watch', `${escHtml(d.a)} ${d.scoreA}–${d.scoreB} ${escHtml(d.b)}`, escHtml(nuDayLabel(d.date)),
      `<a href="/games/${encodeURIComponent(d.gameId)}" class="nu-video"><img src="https://img.youtube.com/vi/${encodeURIComponent(d.videoId)}/hqdefault.jpg" alt="" loading="lazy"><span class="nu-video__play" aria-hidden="true"></span></a>`,
      `<a href="/games/${encodeURIComponent(d.gameId)}" class="nu-card__link">Full game <span>&rarr;</span></a>`);
  },
};

// ── Standings block (buildHomeStandings in server.js) ─────────────────────────
// One tile per team in standings order, each linking to its team page: rank, W-L, games
// back, win rate, point differential, last-5 form, an avatar stack of the team's top five
// (desktop only) and an optional one-line story flag. The tile carries a faint glare in
// the team's colour — a deliberate exception (Paolo's call) to team colours being for
// dots/chips only; amber still marks the leader. The headline is server-built HTML (team
// names escaped there are plain team names from the DB, wrapped in <em> for the amber highlight).
function standingsSection(standings, summary = null, isAdmin = false) {
  if (!standings || !standings.teams.length) return '';
  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const tiles = standings.teams.map(t => {
    const color = teamColor(t.name);
    const form = t.form.map(r => `<b class="${r === 'W' ? 'is-w' : 'is-l'}">${r}</b>`).join('');
    const diff = t.diff > 0 ? `+${t.diff}` : t.diff < 0 ? `−${Math.abs(t.diff)}` : '0';
    const pctLabel = t.pct.toFixed(3).replace(/^0/, '');
    return `<a href="/teams/${encodeURIComponent(String(t.id))}" class="st-team${t.rank === 1 ? ' is-leader' : ''}" style="--team:${color}">
      <span class="st-team__top">
        <span class="st-team__name"><span class="team-dot" style="background:${color}"></span>${escHtml(t.name)}</span>
        <span class="st-team__rank">${ORD[t.rank - 1] || `#${t.rank}`}</span>
      </span>
      <span class="st-team__mid">
        <span class="st-team__wl font-condensed">${t.wins}-${t.losses}</span>
        <span class="st-team__gb"><b class="font-condensed">${t.gb > 0 ? t.gb : '—'}</b><span class="st-team__gb-long">Games back</span><span class="st-team__gb-short">GB</span></span>
      </span>
      <span class="st-team__rate">
        <span class="st-team__bar"><span style="width:${Math.round(t.pct * 100)}%"></span></span>
        <span class="st-team__meta"><span>Win rate ${pctLabel}</span><span>Diff <b class="${t.diff > 0 ? 'is-pos' : t.diff < 0 ? 'is-neg' : ''}">${diff}</b></span></span>
      </span>
      ${form ? `<span class="st-team__form" aria-label="Last ${t.form.length}: ${t.form.join(' ')}">${form}<i>last ${t.form.length}</i></span>` : ''}
      ${t.rosterCount ? `<span class="st-team__roster">
        ${avatarStack(t.roster.map(p => ({ id: p.id, name: p.name, color })), { size: 32, max: t.roster.length, total: t.rosterCount })}
        <span class="st-team__count">${t.rosterCount} players</span>
      </span>` : ''}
      ${(() => {
        // AI note from the Season race summary when there is one; otherwise the automatic label.
        const note = summary?.notes?.[String(t.name).toUpperCase()];
        return note
          ? `<span class="st-team__foot st-team__foot--note">
        <span class="st-team__note">${escHtml(note)}</span>
        <span class="st-team__cta">Team page &rarr;</span>
      </span>`
          : `<span class="st-team__foot">
        <span class="st-team__flag">${t.flag ? escHtml(t.flag) : ''}</span>
        <span class="st-team__cta">Team page &rarr;</span>
      </span>`;
      })()}
    </a>`;
  }).join('\n    ');
  // The AI summary replaces the rule-based headline when there is one; the rule-based
  // headline stays as the fallback (and admins also see the regenerate control).
  const head = summary
    ? summaryPanel(summary, 'standings', isAdmin)
    : `<p class="st-card__headline">${standings.headline}</p>${isAdmin ? summaryPanel(null, 'standings', true) : ''}`;
  return `<section class="home-section home-standings" aria-labelledby="standings-heading">
  <div class="section-header"><h2 id="standings-heading">Season ${escHtml(String(standings.season))} race</h2><a href="/standings" class="section-header__link">Full standings <span>&rarr;</span></a></div>
  <div class="st-card">
    ${head}
    <div class="st-grid" style="--st-teams:${standings.teams.length}">
    ${tiles}
    </div>
  </div>
</section>`;
}

// ── "What you get" + closing CTA (guests only, while registration is open) ──────
// Every card is something a newly approved member really gets — registering makes you a
// community member with a player profile, not a league player, so league stats are framed
// as "once you play". Cards for switched-off features (Papawis, marketplace, comments) drop out.
const LOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

function memberPerksSection(perks) {
  if (!perks) return '';
  const social = [perks.comments && 'comment on games', 'vote in polls', perks.marketplace && 'shop group-buy jerseys'].filter(Boolean);
  const cards = [
    {
      title: 'Your own player profile',
      text: 'Photo, intro and positions. Your stats fill in once you play in the league.',
      preview: `<div class="mp-prev mp-prev--profile"><span class="mp-prev__avatar"></span><span class="mp-prev__lines"><i style="width:70%"></i><i style="width:45%"></i></span><span class="mp-prev__bars"><i style="height:45%"></i><i style="height:75%"></i><i style="height:60%"></i><i style="height:90%"></i><i style="height:70%"></i></span></div>`,
    },
    perks.papawis && {
      title: 'Papawis open runs',
      text: 'Grab a slot in weekend pickup games, or join the waitlist when it fills up.',
      preview: `<div class="mp-prev mp-prev--slots">${'<i></i>'.repeat(12)}</div>`,
    },
    {
      title: 'League season signups',
      text: 'Members can sign up for the next league season as soon as it opens.',
      preview: `<div class="mp-prev mp-prev--season"><span class="mp-prev__jersey"></span><span class="mp-prev__lines"><i style="width:60%"></i><i style="width:80%"></i></span></div>`,
    },
    {
      title: 'Join the conversation',
      text: `${social.join(', ').replace(/^./, c => c.toUpperCase())}, and get notified when it's about you.`,
      preview: `<div class="mp-prev mp-prev--chat"><i style="width:75%"></i><i class="is-me" style="width:55%"></i><i style="width:65%"></i></div>`,
    },
  ].filter(Boolean);

  // Fixed copy in the same panel as the AI blocks (no Regenerate: nothing here changes week to week).
  const writeup = {
    kicker: 'Membership · Register once',
    headline: perks.papawis ? 'One account for **Papawis** runs, season signups and your own profile' : 'One account for season signups and your own profile',
    body: `Register and an admin approves you. From then on you can ${[perks.papawis && 'grab pickup slots', 'sign up the moment a new league season opens', perks.comments ? 'join the talk around every game' : 'vote in polls'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`,
  };

  return `<section class="home-section home-perks" aria-labelledby="perks-heading">
  <div class="section-header"><h2 id="perks-heading">What you get when you join</h2></div>
  ${summaryPanel(writeup, 'perks', false)}
  <div class="mp-grid" style="--mp-cards:${cards.length}">
    ${cards.map(c => `<a href="/register" class="card mp-card">
      <div class="mp-card__preview">${c.preview}<span class="mp-card__lock">${LOCK_ICON}</span></div>
      <h3 class="mp-card__title">${escHtml(c.title)}</h3>
      <p class="mp-card__text">${escHtml(c.text)}</p>
    </a>`).join('\n    ')}
  </div>
</section>`;
}

function closingCta(msg) {
  if (!msg) return '';
  return `<section class="home-closer" aria-label="Join the WKND community">
  <div class="home-closer__copy">
    <h2 class="home-closer__headline">${escHtml(msg.headline || 'Ready na? The court is waiting.')}</h2>
    <p class="home-closer__message">${escHtml(msg.message || 'Register now and join the next Papawis run.')}</p>
  </div>
  <div class="home-closer__actions">
    <a href="/register" class="join-band__cta">${escHtml(msg.cta || 'Join the community')}</a>
    ${msg.note ? `<span class="join-band__fine">${escHtml(msg.note)}</span>` : ''}
  </div>
</section>`;
}

// League Leaders carousel (or the admin-picked New/Traded one) under its own section
// header, so it reads as its own block rather than trailing off the "Coming up" cards.
// ── AI summary panel (server.js buildHomeSummaries) ───────────────────────────
// One per block: a kicker ("THE RACE · AFTER WEEK 4"), a generated headline where
// **name** markers become amber highlights, and a sentence or two. Admins get a
// regenerate button (and see a placeholder when nothing has been generated yet).
// attr: the button's data attribute — 'section-block' for the section writeups
// (server.js SECTION_SUMMARIES), which sectionRegenScript() picks up.
export function summaryPanel(s, block, isAdmin, attr = 'block') {
  if (!s && !isAdmin) return '';
  const headline = s ? escHtml(s.headline).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>') : '';
  const body = s?.body ? escHtml(s.body.replace(/\*\*/g, '')) : '';
  return `<div class="hs-summary">
    <div class="hs-summary__copy">
      ${s
        ? `<span class="hs-summary__kicker">${escHtml(s.kicker)}</span>
      <p class="hs-summary__headline">${headline}</p>
      ${body ? `<p class="hs-summary__body">${body}</p>` : ''}`
        : `<span class="hs-summary__kicker">No summary yet — it's written after the next result, or regenerate it now</span>`}
    </div>
    ${isAdmin ? `<button type="button" class="hs-summary__regen" data-${attr}="${escHtml(block)}">↺ Regenerate</button>` : ''}
  </div>`;
}

// A section writeup under a section header (/standings, /playoffs, /picks, game pages).
// Kickers read "<Section name> · <as of>"; the header right above already names the section,
// so only the "as of" part shows here.
export const sectionPanel = (s, block, isAdmin) => summaryPanel(
  s && { ...s, kicker: String(s.kicker || '').split(' · ').slice(1).join(' · ') }, block, isAdmin, 'section-block');

// Admin "Regenerate" for every sectionPanel on the page.
export function sectionRegenScript() {
  return `<script>
(function () {
  document.querySelectorAll('.hs-summary__regen[data-section-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Writing…';
      fetch('/admin/section-summary/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block: btn.dataset.sectionBlock }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
        .then(function () { location.reload(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(e.message); });
    });
  });
})();
</script>`;
}

// Admin "Regenerate" for a homepage summary block shown on another page (/picks shows the
// "Who wins?" one). The homepage has its own copy of this inside homePage().
export function homeSummaryRegenScript() {
  return `<script>
(function () {
  document.querySelectorAll('.hs-summary__regen[data-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Writing…';
      fetch('/admin/home-summary/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block: btn.dataset.block }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
        .then(function () { location.reload(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(e.message); });
    });
  });
})();
</script>`;
}

// ── Game headlines (the 4 games before the hero's): the standard game card (views/games.js
// gameCard), same as /games. server.js computes each card's extras for headlineGamesOf(games).
export function headlineGamesOf(games) {
  return games
    .filter(g => !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(4).filter(g => boldTitle(g.game_writeup)).slice(0, 4);
}

function headlinesSection(games, summary, isAdmin, cards = {}) {
  if (!games.length) return '';
  const { commentsEnabled = false, socialByGame = {}, topScorerByGame = {}, oddsByGame = {} } = cards;
  const html = games.map(g => gameCard(g, { commentsEnabled, social: socialByGame[g.id], topScorer: topScorerByGame[g.id], odds: oddsByGame[g.id] || null })).join('\n    ');
  return `<section class="home-section gh-section" aria-labelledby="gh-heading">
  <div class="section-header"><h2 id="gh-heading">Game headlines</h2><a href="/games" class="section-header__link">All games <span>&rarr;</span></a></div>
  ${summaryPanel(summary, 'headlines', isAdmin)}
  <div class="gh-grid swipe-row" data-swipe>
    ${html}
  </div>
</section>
${gameCardScript()}
${swipeScript()}`;
}

// "LASTNAME, Firstname" → { first: 'Firstname', last: 'LASTNAME' } — split on the comma,
// never on case (some last names are stored mixed-case).
function lbNameParts(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  if (comma === -1) return { first: '', last: str.toUpperCase() };
  return { first: str.slice(comma + 1).trim(), last: str.slice(0, comma).trim().toUpperCase() };
}

// ── League leaders: top 3 in 8 categories, leader large with the team-colour glare ──
function leaderBoardsSection(boards, summary, season, isAdmin) {
  const cards = boards.map(c => {
    const lead = c.top[0];
    const color = teamColor(lead.team);
    const rest = c.top.slice(1).map((p, k) => {
      const n = lbNameParts(p.name);
      return `<a href="/players/${encodeURIComponent(String(p.id))}" class="lb-card__alt">
        <span class="lb-card__rank font-condensed">${k + 2}</span>
        <span class="team-dot" style="background:${teamColor(p.team)}"></span>
        <span class="lb-card__alt-name">${n.first ? `<span class="lb-card__alt-first">${escHtml(n.first)}</span>` : ''}<span class="lb-card__alt-last">${escHtml(n.last)}</span></span>
        <span class="lb-card__delta font-condensed">${escHtml(p.delta)}</span>
        <b class="lb-card__alt-val font-condensed">${escHtml(p.value)}</b>
      </a>`;
    }).join('');
    const n = lbNameParts(lead.name);
    const num = lead.number !== '' && lead.number != null ? `#${escHtml(String(lead.number))}` : '';
    // Leader block = the /players card: faded team-tinted photo behind, ghost jersey number
    return `<div class="lb-card" style="--team:${color}">
      <a href="/players/${encodeURIComponent(String(lead.id))}" class="lb-card__lead lb-card__lead--photo">
        <img class="lb-card__bg" src="${playerPhotoUrl(lead.id, 192)}" alt="" loading="lazy" onerror="this.remove()">
        ${num ? `<span class="lb-card__num font-condensed" aria-hidden="true">${num}</span>` : ''}
        <span class="lb-card__head"><span class="lb-card__title">${escHtml(c.title)}</span><span class="lb-card__key">${escHtml(c.label)}</span></span>
        <span class="lb-card__row">
          ${playerAvatar(lead.id, lead.name, color, { className: 'lb-card__av' })}
          <span class="lb-card__who">${n.first ? `<span class="lb-card__first">${escHtml(n.first)}</span>` : ''}<span class="lb-card__last">${escHtml(n.last)}</span><span class="lb-card__team"><span class="team-dot" style="background:${color}"></span>${escHtml(lead.team)}${lead.gp ? ` · ${lead.gp} GP` : ''}</span></span>
          <b class="lb-card__val font-condensed">${escHtml(lead.value)}</b>
        </span>
      </a>
      ${rest ? `<div class="lb-card__rest">${rest}</div>` : ''}
    </div>`;
  }).join('\n    ');
  return `<section class="home-section home-leaders" aria-labelledby="leaders-heading">
  <div class="section-header"><h2 id="leaders-heading">League leaders${season ? ` <span class="section-header__sub">Season ${escHtml(String(season))}<span class="lb-sub-extra"> · per game</span></span>` : ''}</h2><a href="/leaders" class="section-header__link">All leaders <span>&rarr;</span></a></div>
  ${summaryPanel(summary, 'leaders', isAdmin)}
  <div class="lb-grid swipe-row" data-swipe>
    ${cards}
  </div>
</section>
${swipeScript()}`;
}

function leadersSection(leaderPlayers, rosterMovers, season, summary = null, isAdmin = false) {
  const boards = leaderBoards(leaderPlayers);
  if (boards.length) return leaderBoardsSection(boards, summary, season, isAdmin);
  const movers = rosterMoversCarousel(rosterMovers);
  return movers ? `<section class="home-leaders" aria-labelledby="movers-heading">
  <div class="section-header"><h2 id="movers-heading">New &amp; traded players</h2><a href="/players" class="section-header__link">All players <span>&rarr;</span></a></div>
  ${movers}
</section>` : '';
}

function nextUpSection(nextUp, summary = null, isAdmin = false) {
  if (!nextUp || !nextUp.cards.length) return '';
  const cards = nextUp.cards.map(c => NU_RENDER[c.kind] ? NU_RENDER[c.kind](c.data, nextUp) : '').join('\n  ');
  return `<section class="home-section nu-section" aria-labelledby="nu-heading">
  <div class="section-header"><h2 id="nu-heading">Coming up</h2></div>
  ${summaryPanel(summary, 'comingup', isAdmin)}
  <div class="nu-grid" style="--nu-cards:${nextUp.cards.length}">
  ${cards}
  </div>
</section>`;
}

// Same section header + card language as the rest of the homepage (was a one-off
// "card-label" panel with its own inline styles).
function latestPosts(posts) {
  if (!posts.length) return '';
  const cards = posts.slice(0, 4).map(p => {
    const body = excerpt(p.body_html.replace(/<[^>]+>/g, ' '));
    return `<a href="/posts/${encodeURIComponent(p.slug)}" class="hp-card">
      <span class="hp-card__date">${p.publish_at ? escHtml(formatDate(new Date(p.publish_at).toISOString())) : ''}</span>
      <span class="hp-card__title">${escHtml(p.title)}</span>
      ${body ? `<span class="hp-card__excerpt">${escHtml(truncate(body, 120))}</span>` : ''}
      <span class="hp-card__cta">Read post &rarr;</span>
    </a>`;
  }).join('\n    ');
  return `<section class="home-section hp-section" aria-labelledby="posts-heading">
  <div class="section-header"><h2 id="posts-heading">Latest posts</h2><a href="/posts" class="section-header__link">All posts <span>&rarr;</span></a></div>
  <div class="hp-grid">
    ${cards}
  </div>
</section>`;
}

// Page order: hero → registration banner → game headlines → season race → league leaders
// → posts → coming up → (guests) what you get + closing CTA. Game headlines are the four
// recaps *before* the hero's four, so the two never show the same games.
export function homePage({ teams, players, games, highlights = [], mvpRace = null, nextUp = null, standings = null, papawisHero = null, regCloser = null, memberPerks = null, leaderSeason = '', leaderPlayers = [], rosterMovers = [], regBanner = null, signupBanner = null, posts = [], awardsGallery = [], summaries = {}, isAdmin = false, picksWidgetHtml = '', headlineCards = {} }) {
  const completedGames = games
    .filter(g => !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const headlineGames = headlineGamesOf(games);

  const regenScript = isAdmin ? `<script>
(function () {
  document.querySelectorAll('.hs-summary__regen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Writing…';
      fetch('/admin/home-summary/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block: btn.dataset.block }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
        .then(function () { location.reload(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(e.message); });
    });
  });
})();
</script>` : '';

  return `<div class="home-grid">
  ${heroCarousel(completedGames.slice(0, 4), awardsGallery, papawisHero)}
  ${mvpRace ? mvpRaceSidebar(mvpRace) : highlightsSidebar(highlights)}
</div>

${regBanner ? registrationBanner(regBanner) : signupBanner ? memberSignupBannerBig(signupBanner) : ''}

${picksWidgetHtml}

${headlinesSection(headlineGames, summaries.headlines, isAdmin, headlineCards)}

${standingsSection(standings, summaries.standings, isAdmin)}

${leadersSection(leaderPlayers, rosterMovers, leaderSeason, summaries.leaders, isAdmin)}

${latestPosts(posts)}

${nextUpSection(nextUp, summaries.comingup, isAdmin)}

${memberPerksSection(memberPerks)}

${closingCta(regCloser)}
${regenScript}`;
}
