import { escHtml, pageHeader } from './layout.js';
import { teamColor, formatDate, boldTitle, excerpt } from './utils.js';
import { scoreTicker } from './ticker.js';
import { highlightsSidebar } from './home.js';

// Comment/react/share for this row — same actions as the game page's tabActionsBar, just
// reachable from the list. The row itself is a "stretched link" card (see .game-row__link
// in styles.css), not a wrapping <a>, specifically so these can be real interactive
// elements without nesting them inside another link (invalid HTML, unreliable clicks).
function gameRowActions(game, commentsEnabled, social) {
  const gameId = encodeURIComponent(game.id);
  const commentItem = commentsEnabled
    ? `<a href="/games/${gameId}#comments" class="game-row__action" aria-label="Comments">💬<span>${social.commentsCount || 0}</span></a>`
    : '';
  const reactItem = commentsEnabled
    ? `<button type="button" class="game-row__action${social.reacted ? ' is-active' : ''}" data-action="react-game" data-game-id="${escHtml(game.id)}" aria-label="React to this game">🔥<span>${social.reactCount || 0}</span></button>`
    : '';
  return `<div class="game-row__actions">
    ${commentItem}
    ${reactItem}
    <button type="button" class="game-row__action" data-action="share-game" data-url="/games/${gameId}" aria-label="Share">↗</button>
  </div>`;
}

// ── Game row (article-list style) ─────────────────────────────────────────────
function gameRow(game, { commentsEnabled = false, social = { commentsCount: 0, reactCount: 0, reacted: false } } = {}) {
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
  const isFinals  = game.game_type === 'finals';

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

  const cleanTitle = title.slice(0, 120);

  return `<article class="game-row" data-game-id="${escHtml(game.id)}">
  <a href="/games/${encodeURIComponent(game.id)}" class="game-row__link" aria-label="${escHtml(cleanTitle)}"></a>
  <div class="game-row__thumb">${thumb}</div>
  <div class="game-row__body">
    <div class="game-row__meta">
      ${escHtml(formatDate(game.date))}${isPlayoff ? ' <span class="badge-playoff">PLAYOFF</span>' : ''}${isFinals ? ' <span class="badge-playoff" style="background:var(--amber);color:#0a0e16;border-color:var(--amber)">FINALS</span>' : ''}${isFinal ? ' <span class="badge-playoff" style="background:rgba(59,130,246,.15);color:#60a5fa;border-color:#3b82f6">STATS PENDING</span>' : ''}
      ${scoreInline}
    </div>
    <h3 class="game-row__title">${escHtml(cleanTitle)}</h3>
    ${body && !isFinal ? `<p class="game-row__excerpt">${escHtml(body.length > 110 ? body.slice(0, 110) + '…' : body)}</p>` : ''}
    <div class="game-row__footer">
      ${cta}
      ${gameRowActions(game, commentsEnabled, social)}
    </div>
  </div>
</article>`;
}

// One delegated listener for the whole list rather than one per row — mirrors the
// react/share handlers in views/game.js (gameTabsScript), just scoped to .games-grid and
// keyed off data-game-id instead of a single page-level gameId.
function gameListScript() {
  return `<script>
(function() {
  var list = document.querySelector('.games-grid');
  if (!list) return;

  list.addEventListener('click', function(e) {
    var reactBtn = e.target.closest('[data-action="react-game"]');
    if (reactBtn) {
      var gameId = reactBtn.dataset.gameId;
      reactBtn.disabled = true;
      fetch('/games/' + encodeURIComponent(gameId) + '/react', { method: 'POST', headers: {'Content-Type':'application/json'} })
        .then(function(r) {
          if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return null; }
          return r.json();
        })
        .then(function(d) {
          if (!d) return;
          reactBtn.disabled = false;
          if (!d.ok) return;
          reactBtn.classList.toggle('is-active', d.reacted);
          reactBtn.querySelector('span').textContent = d.count;
        })
        .catch(function() { reactBtn.disabled = false; });
      return;
    }

    var shareBtn = e.target.closest('[data-action="share-game"]');
    if (shareBtn) {
      var url = window.location.origin + shareBtn.dataset.url;
      if (navigator.share) {
        navigator.share({ url: url }).catch(function() {});
        return;
      }
      navigator.clipboard.writeText(url).then(function() {
        var orig = shareBtn.innerHTML;
        shareBtn.innerHTML = '✓';
        setTimeout(function() { shareBtn.innerHTML = orig; }, 1500);
      }).catch(function() {});
    }
  });
})();
<\/script>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function gamesPage({ games, highlights = [], commentsEnabled = false, socialByGame = {} }) {
  const completedGames = games
    .filter(g => g.status === 'final' || g.status === 'complete')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const upcomingGames = games
    .filter(g => g.status === 'scheduled')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  const cards = completedGames.length
    ? completedGames.map(g => gameRow(g, {
        commentsEnabled,
        social: socialByGame[g.id] || { commentsCount: 0, reactCount: 0, reacted: false },
      })).join('\n    ')
    : `<div class="card game-list__empty">No games yet.</div>`;

  return `<div class="page-content">
${pageHeader({ title: 'Games', description: 'Every result this season — box scores, recaps, and Player of the Game spotlights.' })}

<div class="games-layout">
  <div class="games-main">
    ${completedGames.length ? `<div class="games-grid">${cards}</div>` : cards}
  </div>
  ${highlightsSidebar(highlights, { limit: 4, seeAllLink: true })}
</div>
</div>
${completedGames.length ? gameListScript() : ''}`;
}
