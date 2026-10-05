import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, initials, boldTitle, excerpt, truncate, playerAvatar, playerLink, manilaTodayStr } from './utils.js';
import { moveBadge } from './mvp.js';
export { scoreTicker } from './ticker.js';
import { scoreTicker } from './ticker.js';


// ── Hero Carousel ─────────────────────────────────────────────────────────────
// Game-recap slides (score, recap excerpt, full recap CTA) followed by any Season
// Award slides (MVP/Finals MVP graphics — already have badge/name/stats baked into
// the image itself, so no title/excerpt overlay is added; a top eyebrow link is
// the only HTML text, kept clear of the baked-in bottom text).
function heroCarousel(games, awardItems = []) {
  if (!games.length && !awardItems.length) {
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
    const title = boldTitle(game.game_writeup) || `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;
    const body = excerpt(game.game_writeup);

    const bg = `<div class="hero-bg"><img src="/api/photo/${encodeURIComponent(game.id)}" alt=""></div>`
    const flareOpacity = game.has_cover ? '44' : 'cc';

    return `<div class="hero-slide${i === 0 ? ' hero-slide--active' : ''}">
  ${bg}
  <div class="hero-flare" style="background:linear-gradient(135deg,${colorA}${flareOpacity} 0%,transparent 50%,${colorB}${flareOpacity} 100%)"></div>
  <div class="hero-overlay"></div>
  <div class="hero-date">${escHtml(formatDate(game.date))}</div>
  <div class="hero-scoreboard">
    <div class="hero-team">
      <div class="hero-team__name${winA ? ' hero-team__name--winner' : ''}">${escHtml(game.team_a_name)}</div>
      <div class="font-condensed hero-team__score${winA ? ' hero-team__score--winner' : ''}">${scoreA}</div>
    </div>
    <div class="hero-divider">
      <div class="hero-divider__line"></div>
      <span class="hero-divider__label">FINAL</span>
      <div class="hero-divider__line"></div>
    </div>
    <div class="hero-team">
      <div class="hero-team__name${winB ? ' hero-team__name--winner' : ''}">${escHtml(game.team_b_name)}</div>
      <div class="font-condensed hero-team__score${winB ? ' hero-team__score--winner' : ''}">${scoreB}</div>
    </div>
  </div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(title.slice(0, 120))}</h2>
    ${body ? `<p class="hero-excerpt">${escHtml(body.slice(0, 280))}</p>` : ''}
    <a href="/games/${encodeURIComponent(game.id)}" class="hero-cta">FULL GAME RECAP <span>→</span></a>
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
    const isActive = games.length === 0 && i === 0;

    if (it.kind === 'team') {
      return `<div class="hero-slide${isActive ? ' hero-slide--active' : ''}">
  <div class="hero-bg"><img src="${escHtml(it.imgUrl)}" alt=""></div>
  <div class="hero-overlay"></div>
  <div class="hero-date">${escHtml(it.label)}</div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(it.title.toUpperCase())}</h2>
    <a href="/awards" class="hero-cta">VIEW SEASON AWARDS <span>→</span></a>
  </div>
</div>`;
    }

    const name    = displayPlayerName(it.playerName || '').toUpperCase();
    const writeup = String(it.writeup || '').replace(/\*\*/g, '').trim();

    return `<div class="hero-slide${isActive ? ' hero-slide--active' : ''}">
  <div class="hero-bg"><img src="${escHtml(it.imgUrl)}" alt=""></div>
  <div class="hero-overlay"></div>
  <div class="hero-date">${escHtml(it.label)}</div>
  <div class="hero-content">
    <h2 class="hero-title">${escHtml(name)}</h2>
    ${writeup ? `<p class="hero-excerpt">${escHtml(writeup.slice(0, 280))}</p>` : ''}
    <a href="/awards" class="hero-cta">VIEW SEASON AWARDS <span>→</span></a>
  </div>
</div>`;
  });

  const slides = [...gameSlides, ...awardSlides];

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

  schedule(AUTO_MS);
})();
</script>`;
}

// ── MVP Race Sidebar ──────────────────────────────────────────────────────────
// Takes the Player Highlights slot next to the hero while the MVP Race is switched on
// (buildHomeMvpRace in server.js). The leader gets a spotlight (photo, score, stat line,
// start of the cached AI writeup); 2–5 are a compact ladder with week-over-week movement.
// Movement badges reuse the /mvp page's .mvp-move styles so both read the same.
function mvpRaceSidebar({ season, week, final, candidates }) {
  const [lead, ...rest] = candidates;
  const ls    = lead.stats;
  const gp    = ls.gp || 1;
  const color = teamColor(ls.team_name);
  const href  = id => `/players/${encodeURIComponent(String(id))}`;
  const when  = final ? `S${season} · FINAL` : week ? `S${season} · AFTER WEEK ${week}` : `S${season}`;
  const writeup = String(lead.writeup || '').replace(/\*\*/g, '').trim();

  const rowMove = (rank, prev) => {
    if (prev === undefined) return '';
    if (prev === null) return `<span class="mvp-move mvp-move--new" title="New this week">NEW</span>`;
    const d = prev - rank;
    if (d > 0) return `<span class="mvp-move mvp-move--up" title="Last week #${prev}">▲${d}</span>`;
    if (d < 0) return `<span class="mvp-move mvp-move--down" title="Last week #${prev}">▼${-d}</span>`;
    return `<span class="mvp-move mvp-move--same" title="Last week #${prev}">–</span>`;
  };

  const rows = rest.map((c, i) => {
    const rank = i + 2;
    return `<a href="${href(c.player.id)}" class="hmvp-row">
    <span class="hmvp-row__rank font-condensed">${rank}</span>
    <span class="hmvp-row__name"><span class="team-dot" style="background:${teamColor(c.stats.team_name)}"></span><span>${escHtml(displayPlayerName(c.player.name))}</span></span>
    ${rowMove(rank, c.prevRank)}
    <span class="hmvp-row__score font-condensed">${c.mvpScore.toFixed(1)}</span>
  </a>`;
  }).join('\n  ');

  return `<div class="card sidebar hmvp-card">
  <div class="card-label">MVP RACE <span class="hmvp-when">${escHtml(when)}</span></div>
  <a href="${href(lead.player.id)}" class="hmvp-lead" style="background:linear-gradient(135deg,${color}12 0%,transparent 55%)">
    <div class="hmvp-lead__head">
      ${playerAvatar(lead.player.id, lead.player.name, color, { className: 'hmvp-avatar' })}
      <div class="hmvp-lead__id">
        <span class="hmvp-badge">FRONTRUNNER</span>
        <span class="hmvp-lead__name"><span class="team-dot" style="background:${color}"></span>${escHtml(displayPlayerName(lead.player.name).toUpperCase())}</span>
        <span class="hmvp-lead__move">${moveBadge(1, lead.prevRank)}</span>
      </div>
      <div class="hmvp-lead__score"><b class="font-condensed">${lead.mvpScore.toFixed(1)}</b><span>SCORE</span></div>
    </div>
    <div class="hmvp-lead__stats"><b>${(ls.pts / gp).toFixed(1)}</b> PPG · <b>${(ls.reb / gp).toFixed(1)}</b> RPG · <b>${(ls.ast / gp).toFixed(1)}</b> APG · <b>${(ls.stl / gp).toFixed(1)}</b> SPG</div>
    ${writeup ? `<div class="hmvp-lead__body"><p>${escHtml(writeup)}</p></div>` : ''}
  </a>
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
    p.style.webkitLineClamp = String(Math.max(4, Math.floor(box.clientHeight / lh)));
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
export function leagueLeaders(players, { showTeamChip = true, skip = 0, limit = null, carousel = true, prominent = false } = {}) {
  const active = players.filter(p => p.games_played > 0);
  if (!active.length) return '';

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
    const loc  = d.location ? `${escHtml(d.location)}${d.hasReferee ? ' · with ref' : ''}` : '';
    const body = `${d.image
        ? `<div class="nu-court${d.image.kind === 'map' ? ' nu-court--map' : ''}"><img src="${escHtml(d.image.src)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('nu-court--noimg')">${loc ? `<span class="nu-court__loc">${loc}</span>` : ''}</div>`
        : loc ? `<p class="nu-card__text nu-card__text--loc">${loc}</p>` : ''}
      ${d.maxSlots ? `<div class="nu-slots"><div class="nu-slots__bar"><i style="width:${pct}%"></i></div>
      <div class="nu-slots__row"><span><b>${d.confirmed}/${d.maxSlots}</b> ${full ? 'full' : 'slots filled'}</span>${d.waitlist ? `<span class="nu-slots__wait">+${d.waitlist} waitlist</span>` : ''}</div></div>` : ''}
      ${d.faces && d.faces.length ? `<div class="nu-faces" aria-label="${d.confirmed} players confirmed">${d.faces.map(f => playerAvatar(f.id, f.name, teamColor(f.team), { className: 'nu-face' })).join('')}${d.confirmed > d.faces.length ? `<span class="nu-face nu-face--more">+${d.confirmed - d.faces.length}</span>` : ''}</div>` : ''}
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

// League Leaders carousel (or the admin-picked New/Traded one) under its own section
// header, so it reads as its own block rather than trailing off the "Coming up" cards.
function leadersSection(leaderPlayers, rosterMovers, season) {
  const leaders = leagueLeaders(leaderPlayers);
  if (leaders) {
    return `<section class="home-leaders" aria-labelledby="leaders-heading">
  <div class="section-header"><h2 id="leaders-heading">League leaders${season ? ` <span class="section-header__sub">Season ${escHtml(String(season))}</span>` : ''}</h2><a href="/leaders" class="section-header__link">All leaders <span>&rarr;</span></a></div>
  ${leaders}
</section>`;
  }
  const movers = rosterMoversCarousel(rosterMovers);
  return movers ? `<section class="home-leaders" aria-labelledby="movers-heading">
  <div class="section-header"><h2 id="movers-heading">New &amp; traded players</h2><a href="/players" class="section-header__link">All players <span>&rarr;</span></a></div>
  ${movers}
</section>` : '';
}

function nextUpSection(nextUp) {
  if (!nextUp || !nextUp.cards.length) return '';
  const cards = nextUp.cards.map(c => NU_RENDER[c.kind] ? NU_RENDER[c.kind](c.data, nextUp) : '').join('\n  ');
  return `<section class="nu-section" aria-labelledby="nu-heading">
  <div class="section-header"><h2 id="nu-heading">Coming up</h2></div>
  <div class="nu-grid" style="--nu-cards:${nextUp.cards.length}">
  ${cards}
  </div>
</section>`;
}

function latestPosts(posts) {
  if (!posts.length) return '';
  const rows = posts.slice(0, 3).map(p => {
    const body = excerpt(p.body_html.replace(/<[^>]+>/g, ' '));
    return `<a href="/posts/${encodeURIComponent(p.slug)}" class="home-post-row">
  <span class="home-post-row__meta">${p.publish_at ? escHtml(formatDate(new Date(p.publish_at).toISOString())) : ''}</span>
  <h3 class="home-post-row__title">${escHtml(p.title)}</h3>
  ${body ? `<p class="home-post-row__excerpt">${escHtml(body.length > 120 ? body.slice(0, 120) + '…' : body)}</p>` : ''}
</a>`;
  }).join('');

  return `<div class="card" style="margin-top:24px">
  <div class="card-label">LATEST POSTS<a href="/posts" class="card-label__more">See all</a></div>
  <div class="home-posts">${rows}</div>
</div>
<style>
  .home-posts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .home-post-row { display: block; padding: 18px; text-decoration: none; border-right: 1px solid var(--border); }
  .home-post-row:last-child { border-right: none; }
  .home-post-row__meta { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); }
  .home-post-row__title { font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 6px 0 4px; }
  .home-post-row__excerpt { font-size: 12.5px; color: var(--text-muted); margin: 0; line-height: 1.45; }
</style>`;
}

export function homePage({ teams, players, games, highlights = [], mvpRace = null, nextUp = null, leaderSeason = '', leaderPlayers = [], rosterMovers = [], regBanner = null, signupBanner = null, posts = [], awardsGallery = [] }) {
  const completedGames = games
    .filter(g => !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = games
    .filter(g => g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score)) === 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return `<div class="home-grid">
  ${heroCarousel(completedGames.slice(0, 4), awardsGallery)}
  ${mvpRace ? mvpRaceSidebar(mvpRace) : highlightsSidebar(highlights)}
</div>

${regBanner ? registrationBanner(regBanner) : signupBanner ? memberSignupBannerBig(signupBanner) : ''}

${nextUpSection(nextUp)}

${leadersSection(leaderPlayers, rosterMovers, leaderSeason)}

${latestPosts(posts)}`;
}
