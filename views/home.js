import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, initials, boldTitle, excerpt, truncate, playerAvatar, playerLink } from './utils.js';

// ── Score Ticker ─────────────────────────────────────────────────────────────
export function scoreTicker(games) {
  const cards = games.map(g => {
    const scoreA    = Number(g.team_a_score);
    const scoreB    = Number(g.team_b_score);
    const hasScores = scoreA + scoreB > 0;
    const colorA    = teamColor(g.team_a_name);
    const colorB    = teamColor(g.team_b_name);

    if (!hasScores) {
      // Upcoming game — no scores, natural team order
      return `<a href="/games/${encodeURIComponent(g.id)}" class="card score-ticker__card ticker-card--upcoming" style="--tc-a:${colorA};--tc-b:${colorB}">
  <div class="ticker-header">
    <span class="ticker-date">${escHtml(formatDate(g.date))}</span>
    <span class="ticker-status ticker-status--upcoming">UPCOMING</span>
  </div>
  <div class="ticker-team-row">
    <div class="ticker-team"><span class="team-dot" style="background:${colorA}"></span><span class="ticker-team-name">${escHtml(g.team_a_name)}</span></div>
  </div>
  <div class="ticker-team-row">
    <div class="ticker-team"><span class="team-dot" style="background:${colorB}"></span><span class="ticker-team-name">${escHtml(g.team_b_name)}</span></div>
  </div>
</a>`;
    }

    // Completed game — winner on top
    const winA = scoreA > scoreB;
    const top  = winA
      ? { name: g.team_a_name, score: scoreA, color: colorA, win: true }
      : { name: g.team_b_name, score: scoreB, color: colorB, win: scoreB > scoreA };
    const bot  = winA
      ? { name: g.team_b_name, score: scoreB, color: colorB, win: false }
      : { name: g.team_a_name, score: scoreA, color: colorA, win: false };

    const row = t => `<div class="ticker-team-row${t.win ? ' ticker-row--win' : ''}">
    <div class="ticker-team"><span class="team-dot" style="background:${t.color}"></span><span class="ticker-team-name">${escHtml(t.name)}</span></div>
    <span class="font-condensed ticker-score">${t.score}</span>
  </div>`;

    return `<a href="/games/${encodeURIComponent(g.id)}" class="card score-ticker__card" style="--tc-a:${top.color};--tc-b:${bot.color}">
  <div class="ticker-header">
    <span class="ticker-date">${escHtml(formatDate(g.date))}</span>
    <span class="ticker-status ticker-status--final">FINAL</span>
  </div>
  ${row(top)}
  ${row(bot)}
</a>`;
  });

  return `<div class="score-ticker">
  ${cards.join('\n  ')}
</div>`;
}

// ── Hero Carousel ─────────────────────────────────────────────────────────────
function heroCarousel(games) {
  if (!games.length) {
    return `<div class="card hero-carousel hero-carousel--empty">
  <span class="hero-carousel--empty__label">No games yet</span>
</div>`;
  }

  const slides = games.map((game, i) => {
    const scoreA = Number(game.team_a_score);
    const scoreB = Number(game.team_b_score);
    const winA = scoreA > scoreB;
    const winB = scoreB > scoreA;
    const colorA = teamColor(game.team_a_name);
    const colorB = teamColor(game.team_b_name);
    const title = boldTitle(game.game_writeup) || `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;
    const body = excerpt(game.game_writeup);

    const bg = game.has_cover
      ? `<div class="hero-bg"><img src="/api/photo/${encodeURIComponent(game.id)}" alt=""></div>`
      : `<div class="hero-bg"></div>`;
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

  const dots = games.map((_, i) =>
    `<span class="hero-dot" style="width:${i === 0 ? '22px' : '8px'};background:${i === 0 ? '#f59332' : 'rgba(255,255,255,0.25)'}"></span>`
  ).join('');

  const arrows = games.length > 1 ? `
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
  <div class="card-label">PLAYER HIGHLIGHTS${seeAllLink && highlights.length > limit ? ' <a href="/games" class="card-label__more">See all</a>' : ''}</div>
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

  const eff = p => ((p.pts||0)+(p.reb||0)+(p.ast||0)+(p.stl||0)+(p.blk||0)-(p.turnover||0)-((p.fg2m_miss||0)+(p.fg3m_miss||0))-(p.ft_miss||0)) / p.games_played;

  const categories = [
    { label: 'PPG', title: 'Points',       sort: p => p.pts / p.games_played,                      fn: p => (p.pts / p.games_played).toFixed(1) },
    { label: 'RPG', title: 'Rebounds',     sort: p => p.reb / p.games_played,                      fn: p => (p.reb / p.games_played).toFixed(1) },
    { label: 'APG', title: 'Assists',      sort: p => p.ast / p.games_played,                      fn: p => (p.ast / p.games_played).toFixed(1) },
    { label: 'SPG', title: 'Steals',       sort: p => p.stl / p.games_played,                      fn: p => (p.stl / p.games_played).toFixed(1) },
    { label: 'BPG', title: 'Blocks',       sort: p => p.blk / p.games_played,                      fn: p => (p.blk / p.games_played).toFixed(1) },
    { label: 'FG%', title: 'Field Goal %', sort: p => fga(p) >= 10 ? (p.fg2m+p.fg3m)/fga(p) : -1, fn: p => Math.round((p.fg2m+p.fg3m)/fga(p)*100)+'%', minFilter: p => fga(p) >= 10 },
    { label: '3P%', title: '3-Point %',    sort: p => tpa(p) >= 5  ? p.fg3m/tpa(p) : -1,          fn: p => Math.round(p.fg3m/tpa(p)*100)+'%',           minFilter: p => tpa(p) >= 5 },
    { label: 'FT%', title: 'Free Throw %', sort: p => fta(p) >= 5  ? p.ftm/fta(p) : -1,           fn: p => Math.round(p.ftm/fta(p)*100)+'%',            minFilter: p => fta(p) >= 5 },
    { label: '3PM', title: '3-Pointers',   sort: p => p.fg3m / p.games_played,                     fn: p => (p.fg3m / p.games_played).toFixed(1) },
    { label: 'FTM', title: 'Free Throws',  sort: p => p.ftm  / p.games_played,                     fn: p => (p.ftm  / p.games_played).toFixed(1) },
    { label: 'TO',  title: 'Turnovers',    sort: p => p.turnover / p.games_played,                 fn: p => (p.turnover / p.games_played).toFixed(1) },
    { label: 'EFF', title: 'Efficiency',   sort: p => eff(p),                                      fn: p => eff(p).toFixed(1) },
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

  return `<div class="leaders-carousel">
  <div class="lc-track" id="lc-track">
    ${cards.join('\n    ')}
  </div>
</div>
<script>
(function(){
  var track = document.getElementById('lc-track');
  var origCards = Array.from(track.querySelectorAll('.leader-card'));
  var n = origCards.length;

  // Clone cards for seamless loop
  origCards.forEach(function(c){ track.appendChild(c.cloneNode(true)); });

  var current = 0;

  function cardW() {
    return origCards[0] ? origCards[0].offsetWidth + 14 : 204;
  }

  function advance() {
    current++;
    if (current >= n) {
      // Scroll to clone of card 0 (visually same as card 0)
      track.scrollTo({ left: cardW() * n, behavior: 'smooth' });
      // After animation settles, silently reset to real card 0
      setTimeout(function(){
        track.scrollTo({ left: 0, behavior: 'instant' });
        current = 0;
      }, 450);
    } else {
      track.scrollTo({ left: cardW() * current, behavior: 'smooth' });
    }
  }

  setInterval(advance, 3000);
})();
</script>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function homePage({ teams, players, games, highlights = [], leaderPlayers = [] }) {
  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const upcomingGames = games
    .filter(g => !g.under_review && Number(g.team_a_score) + Number(g.team_b_score) === 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  return `${scoreTicker(tickerGames)}

<div class="home-grid">
  ${heroCarousel(completedGames.slice(0, 4))}
  ${highlightsSidebar(highlights)}
</div>

${leagueLeaders(leaderPlayers)}`;
}
