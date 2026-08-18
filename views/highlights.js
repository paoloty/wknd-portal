import { escHtml, pageHeader } from './layout.js';
import { teamColor, displayPlayerName, formatDate, truncate, playerAvatar } from './utils.js';

// Same POTG data shape buildHighlights() produces in server.js: { game, stat, player, team }.
// Visually this is the sidebar's highlight-card content reworked into a standalone bordered
// grid card (same language as Papawis/Polls/Fines cards) rather than a stacked list row —
// the sidebar version stays narrow and row-based since it's still a teaser, not this page.
function highlightCard({ game, stat, player, team }) {
  const displayName = displayPlayerName(player?.name || '').toUpperCase();
  const teamName = String(team?.name || '').toUpperCase();
  const color = teamColor(teamName);
  const isLight = teamName === 'WHITE';
  const writeup = String(game.potg_writeup || '').replace(/\*\*/g, '').trim();

  return `<a href="/games/${escHtml(game.id)}#potg-anchor" class="hl-card">
  <div class="hl-card-top">
    ${playerAvatar(player?.id, player?.name, color, { className: 'hl-card-avatar' })}
    <div class="hl-card-info">
      <span class="hl-card-name">${escHtml(displayName)}</span>
      <span class="hl-card-stat-line">${stat.pts} PTS &middot; ${stat.reb} REB &middot; ${stat.ast} AST</span>
    </div>
    <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
  </div>
  ${writeup ? `<p class="hl-card-body">${escHtml(truncate(writeup, 200))}</p>` : ''}
  <div class="hl-card-footer">
    <span class="hl-card-date">${escHtml(formatDate(game.date))}</span>
    <span class="hl-card-cta">Full recap <span>&rarr;</span></span>
  </div>
</a>`;
}

export function highlightsPage({ highlights = [] } = {}) {
  const cards = highlights.map(highlightCard).join('');

  return `<div class="page-content">
  ${pageHeader({ title: 'Player Highlights', description: 'Player of the Game spotlights from every recap this season — one standout performance per game.' })}

  ${highlights.length ? `<div class="hl-grid">${cards}</div>` : `<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">No highlights yet. Check back after the next game!</div>`}
</div>

<style>
.hl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
@media (max-width: 640px) {
  .hl-grid { grid-template-columns: 1fr; }
}
.hl-card { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 15px; padding: 16px 18px; color: inherit; text-decoration: none; transition: border-color .12s, background .12s; }
.hl-card:hover { border-color: var(--text-muted); background: rgba(255,255,255,.02); }
.hl-card-top { display: flex; align-items: center; gap: 10px; }
.hl-card-avatar { width: 40px; height: 40px; border-radius: 50%; background: #181d28; border: 2px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative; overflow: hidden; }
.hl-card-avatar .font-condensed { font-size: 13px; color: #cdd3de; }
.hl-card-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hl-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hl-card-name { font-size: 14px; font-weight: 700; letter-spacing: .02em; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hl-card-stat-line { font-size: 11.5px; font-weight: 700; letter-spacing: .03em; color: var(--amber); }
.hl-card-body { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--text-muted); flex: 1; }
.hl-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 4px; }
.hl-card-date { font-size: 11px; color: var(--text-muted); }
.hl-card-cta { font-size: 11.5px; font-weight: 700; letter-spacing: .03em; color: var(--amber); }
.hl-card-cta span { transition: transform .12s; display: inline-block; }
.hl-card:hover .hl-card-cta span { transform: translateX(2px); }
</style>`;
}
