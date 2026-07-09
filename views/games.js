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
  const isFinal = game.status === 'final';

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

  const cta = isFinal
    ? `<span class="game-row__cta" style="color:var(--text-muted)">STATS PENDING</span>`
    : `<span class="game-row__cta">FULL GAME RECAP <span>→</span></span>`;

  return `<a href="/games/${encodeURIComponent(game.id)}" class="game-row">
  <div class="game-row__thumb">${thumb}</div>
  <div class="game-row__body">
    <div class="game-row__meta">
      ${escHtml(formatDate(game.date))}${isPlayoff ? ' <span class="badge-playoff">PLAYOFF</span>' : ''}${isFinal ? ' <span class="badge-playoff" style="background:rgba(59,130,246,.15);color:#60a5fa;border-color:#3b82f6">STATS PENDING</span>' : ''}
      ${scoreInline}
    </div>
    <h3 class="game-row__title">${escHtml(title.slice(0, 120))}</h3>
    ${body && !isFinal ? `<p class="game-row__excerpt">${escHtml(body.length > 160 ? body.slice(0, 160) + '…' : body)}</p>` : ''}
    ${cta}
  </div>
</a>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function gamesPage({ games, highlights = [] }) {
  const completedGames = games
    .filter(g => g.status === 'final' || g.status === 'complete')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = games
    .filter(g => g.status === 'scheduled')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  const rows = completedGames.length
    ? completedGames.map(gameRow).join('\n    ')
    : `<div class="card game-list__empty">No games yet.</div>`;

  return `<div class="games-layout">
  <div class="games-main">
    <div class="card game-list">
      <div class="card-label">GAME LOG</div>
      ${rows}
    </div>
  </div>
  ${highlightsSidebar(highlights, { limit: 10, seeAllLink: false })}
</div>`;
}
