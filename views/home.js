import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, initials, boldTitle, excerpt, truncate, playerAvatar, playerLink } from './utils.js';
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
function leagueLeaders(players) {
  const active = players.filter(p => p.games_played > 0);
  if (!active.length) return '';

  const fga = p => (p.fg2m||0)+(p.fg3m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0);
  const tpa = p => (p.fg3m||0)+(p.fg3m_miss||0);
  const fta = p => (p.ftm||0)+(p.ft_miss||0);
  const per = p => { const fgm = (p.fg2m||0)+(p.fg3m||0), fga = fgm+(p.fg2m_miss||0)+(p.fg3m_miss||0); return ((p.pts||0) + 0.4*fgm - 0.7*fga - 0.4*(p.ft_miss||0) + 0.7*(p.reb||0) + (p.stl||0) + 0.7*(p.ast||0) + 0.7*(p.blk||0) - (p.turnover||0)) / p.games_played; };
  const categories = [
    { label: 'PPG', title: 'Points',            sort: p => p.pts / p.games_played,                      fn: p => (p.pts / p.games_played).toFixed(1) },
    { label: 'PER', title: 'Efficiency Rating', sort: p => per(p),                                      fn: p => per(p).toFixed(1) },
    { label: 'RPG', title: 'Rebounds',          sort: p => p.reb / p.games_played,                      fn: p => (p.reb / p.games_played).toFixed(1) },
    { label: 'APG', title: 'Assists',           sort: p => p.ast / p.games_played,                      fn: p => (p.ast / p.games_played).toFixed(1) },
    { label: 'SPG', title: 'Steals',            sort: p => p.stl / p.games_played,                      fn: p => (p.stl / p.games_played).toFixed(1) },
    { label: 'BPG', title: 'Blocks',            sort: p => p.blk / p.games_played,                      fn: p => (p.blk / p.games_played).toFixed(1) },
    { label: 'FG%', title: 'Field Goal %',      sort: p => fga(p) >= 10 ? (p.fg2m+p.fg3m)/fga(p) : -1, fn: p => Math.round((p.fg2m+p.fg3m)/fga(p)*100)+'%', minFilter: p => fga(p) >= 10 },
    { label: '3P%', title: '3-Point %',         sort: p => tpa(p) >= 5  ? p.fg3m/tpa(p) : -1,          fn: p => Math.round(p.fg3m/tpa(p)*100)+'%',           minFilter: p => tpa(p) >= 5 },
    { label: '3PM', title: '3-Pointers',        sort: p => p.fg3m / p.games_played,                     fn: p => (p.fg3m / p.games_played).toFixed(1) },
    { label: 'FTM', title: 'Free Throws',       sort: p => p.ftm  / p.games_played,                     fn: p => (p.ftm  / p.games_played).toFixed(1) },
    { label: 'TO',  title: 'Turnovers',         sort: p => p.turnover / p.games_played,                 fn: p => (p.turnover / p.games_played).toFixed(1) },
    { label: 'FT%', title: 'Free Throw %',      sort: p => fta(p) >= 5  ? p.ftm/fta(p) : -1,           fn: p => Math.round(p.ftm/fta(p)*100)+'%',            minFilter: p => fta(p) >= 5 },
  ];

  const cards = categories.map((cat, i) => {
    const pool = cat.minFilter ? active.filter(cat.minFilter) : active;
    const leader = pool.filter(p => cat.sort(p) > 0)
      .sort((a, b) => cat.sort(b) - cat.sort(a) || b.games_played - a.games_played)[0];
    if (!leader) return null;

    const teamName = String(leader.team_name || '').toUpperCase();
    const color = teamColor(teamName);
    const isLight = teamName === 'WHITE';

    return `<div class="card leader-card" data-index="${i}">
  <span class="leader-cat">${cat.label}</span>
  <span class="leader-title">${escHtml(cat.title)}</span>
  ${playerAvatar(leader.id, leader.name, color, { className: 'leader-avatar', link: true })}
  <span class="leader-name">${playerLink(leader.id, leader.name, { upper: true })}</span>
  <span class="team-chip leader-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
  <span class="font-condensed leader-stat">${escHtml(cat.fn(leader))}</span>
</div>`;
  }).filter(Boolean);

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
function registrationBanner({ pill, headline, message, cta }) {
  return `<section class="reg-banner" aria-label="Membership Registration">
  <div class="reg-banner__glow" aria-hidden="true"></div>
  <div class="reg-banner__arc" aria-hidden="true"></div>
  <div class="reg-banner__inner">
    <div class="reg-banner__copy">
      <div class="reg-banner__eyebrow">
        <span class="reg-banner__pill">
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
          ${escHtml(pill || 'Now Recruiting')}
        </span>
      </div>
      <h2 class="reg-banner__headline">${escHtml(headline || 'Join the League.')}</h2>
      <p class="reg-banner__deadline">${escHtml(message || 'Register now and claim your spot.')}</p>
    </div>
    <a href="/register" class="reg-banner__cta">
      ${escHtml(cta || 'Sign Me Up')} <span aria-hidden="true">→</span>
    </a>
  </div>
</section>`;
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

export function homePage({ teams, players, games, highlights = [], leaderPlayers = [], rosterMovers = [], regBanner = null, signupBanner = null, posts = [], awardsGallery = [] }) {
  const completedGames = games
    .filter(g => !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = games
    .filter(g => g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score)) === 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return `<div class="home-grid">
  ${heroCarousel(completedGames.slice(0, 4), awardsGallery)}
  ${highlightsSidebar(highlights)}
</div>

${regBanner ? registrationBanner(regBanner) : signupBanner ? memberSignupBannerBig(signupBanner) : ''}

${leagueLeaders(leaderPlayers) || rosterMoversCarousel(rosterMovers)}

${latestPosts(posts)}`;
}
