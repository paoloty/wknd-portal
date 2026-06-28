import { escHtml } from './layout.js';
import { teamColor, formatDate, boldTitle, excerpt } from './utils.js';
import { scoreTicker } from './ticker.js';
import { highlightsSidebar } from './home.js';

// ── Game row (article-list style) ─────────────────────────────────────────────
function gameRow(game) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winA = scoreA > scoreB;
  const winB = scoreB > scoreA;
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const title = boldTitle(game.game_writeup)
    || `${game.team_a_name} vs ${game.team_b_name}`;
  const body = excerpt(game.game_writeup);
  const isPlayoff = game.game_type === 'playoff';

  const flareOpacity = game.has_cover ? '55' : 'bb';
  const thumb = `${game.has_cover
    ? `<img src="/api/photo/${encodeURIComponent(game.id)}" alt="" class="game-row__thumb-img">`
    : `<div class="game-row__thumb-placeholder"><span class="game-row__thumb-vs">VS</span></div>`}
  <div class="game-row__thumb-flare" style="background:linear-gradient(135deg,${colorA}${flareOpacity} 0%,transparent 55%,${colorB}${flareOpacity} 100%)"></div>`;

  const scoreInline = `<span class="game-row__score-inline">
    <span class="team-dot" style="background:${colorA}"></span>
    <span class="game-row__score-team-name${winA ? ' game-row__score-team-name--win' : ''}">${escHtml(game.team_a_name)}</span>
    <span class="game-row__score-num font-condensed${winA ? ' game-row__score-num--win' : ''}">${scoreA}</span>
    <span class="game-row__score-sep">–</span>
    <span class="game-row__score-num font-condensed${winB ? ' game-row__score-num--win' : ''}">${scoreB}</span>
    <span class="game-row__score-team-name${winB ? ' game-row__score-team-name--win' : ''}">${escHtml(game.team_b_name)}</span>
    <span class="team-dot" style="background:${colorB}"></span>
  </span>`;

  return `<a href="/games/${encodeURIComponent(game.id)}" class="game-row">
  <div class="game-row__thumb">${thumb}</div>
  <div class="game-row__body">
    <div class="game-row__meta">
      ${escHtml(formatDate(game.date))}${isPlayoff ? ' <span class="badge-playoff">PLAYOFF</span>' : ''}
      ${scoreInline}
    </div>
    <h3 class="game-row__title">${escHtml(title.slice(0, 120))}</h3>
    ${body ? `<p class="game-row__excerpt">${escHtml(body.length > 160 ? body.slice(0, 160) + '…' : body)}</p>` : ''}
    <span class="game-row__cta">FULL GAME RECAP <span>→</span></span>
  </div>
</a>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function gamesPage({ games, highlights = [] }) {
  const completedGames = games
    .filter(g => !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = games
    .filter(g => g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score)) === 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  const rows = completedGames.length
    ? completedGames.map(gameRow).join('\n    ')
    : `<div class="card game-list__empty">No games yet.</div>`;

  return `${scoreTicker(tickerGames)}

<div class="games-layout">
  <div class="games-main">
    <div class="card game-list">
      <div class="card-label">GAME LOG</div>
      ${rows}
    </div>
  </div>
  ${highlightsSidebar(highlights, { limit: 10, seeAllLink: false })}
</div>`;
}
