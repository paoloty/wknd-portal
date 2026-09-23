import { escHtml, pageHeader } from './layout.js';
import { teamColor } from './utils.js';

// Last-5-results pills — same win/loss pill treatment as the team detail page's hero
// (views/team-detail.js formPill), duplicated under this page's own tm- prefix rather
// than shared, following this codebase's convention of each view owning its own <style>.
function formPill(game, teamId) {
  const isA = game.team_a_id === teamId;
  const my = Number(isA ? game.team_a_score : game.team_b_score);
  const opp = Number(isA ? game.team_b_score : game.team_a_score);
  const won = my > opp;
  return `<span class="tm-form__pill tm-form__pill--${won ? 'w' : 'l'}" title="${won ? 'W' : 'L'} ${my}-${opp} vs ${escHtml(isA ? game.team_b_name : game.team_a_name)}">${won ? 'W' : 'L'}</span>`;
}

// Same glare/gradient treatment as the team detail page's header (top color accent + radial
// wash from the left), stacked vertically to fit a 4-across desktop grid rather than the
// team detail page's full-width horizontal bar.
function teamCard(t) {
  const color = teamColor(t.name);
  const wins = t.wins != null ? t.wins : '—';
  const losses = t.losses != null ? t.losses : '—';
  const recentForm = (t.recentGames || []).map(g => formPill(g, t.id)).join('');
  const streakHtml = t.streak
    ? `<span class="tm-card__streak tm-card__streak--${t.streak.won ? 'w' : 'l'}">${t.streak.won ? 'W' : 'L'}${t.streak.count}</span>`
    : '';

  const stat = (label, val, highlight = false) => `
    <div class="tm-stat">
      <span class="tm-stat__val font-condensed"${highlight ? ` style="color:var(--amber)"` : ''}>${val ?? '—'}</span>
      <span class="tm-stat__lbl">${label}</span>
    </div>`;

  return `<a href="/teams/${encodeURIComponent(t.id)}" class="tm-card" style="--tm-color:${color}">
  ${t.rank ? `<span class="tm-card__rank">#${t.rank}</span>` : ''}
  <div class="tm-card__info">
    <span class="tm-card__name">${escHtml(t.name)}</span>
    <div class="tm-card__meta">
      <span class="tm-card__record">${escHtml(String(wins))}-${escHtml(String(losses))}</span>
      ${streakHtml}
    </div>
    ${recentForm ? `<div class="tm-form">${recentForm}</div>` : ''}
  </div>
  <div class="tm-card__stats">
    ${stat('OFF', t.avgOff)}
    ${stat('DEF', t.avgDef)}
    ${stat('OVR', t.avgOvr, true)}
  </div>
</a>`;
}

export function teamsBody({ teams = [] } = {}) {
  const cards = teams.map(teamCard).join('');

  return `<div class="page-content">
${pageHeader({ title: 'Teams', description: 'Every roster in the league — records, ratings, and full rosters for each team.' })}

  ${teams.length ? `<div class="tm-grid">${cards}</div>` : `<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">No teams found.</div>`}
</div>

<style>
.tm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1100px) { .tm-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .tm-grid { grid-template-columns: 1fr; } }

.tm-card {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  padding: 22px 20px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 15px;
  color: inherit; text-decoration: none;
  transition: border-color .12s, background .12s;
}
.tm-card:hover { border-color: var(--text-muted); background: rgba(255,255,255,.02); }
.tm-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(to right, var(--tm-color, var(--amber)) 0%, transparent 65%);
  z-index: 2;
}
.tm-card::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 120% 55% at 0% 0%, var(--tm-color, transparent), transparent);
  opacity: 0.1;
  pointer-events: none;
}
.tm-card__rank {
  position: absolute; top: 16px; right: 18px; z-index: 1;
  font-size: 12px; font-weight: 800; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.tm-card__info { position: relative; z-index: 1; padding-right: 30px; }
.tm-card__name { display: block; font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--text); line-height: 1.1; margin-bottom: 8px; }
.tm-card__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.tm-card__record { font-size: 14px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
.tm-card__streak { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; }
.tm-card__streak--w { background: rgba(34,197,94,.15); color: #22c55e; }
.tm-card__streak--l { background: rgba(239,68,68,.15); color: #f87171; }
.tm-form { display: flex; gap: 4px; }
.tm-form__pill { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; font-size: 10.5px; font-weight: 800; }
.tm-form__pill--w { background: rgba(34,197,94,.15); color: #22c55e; }
.tm-form__pill--l { background: rgba(239,68,68,.15); color: #f87171; }

.tm-card__stats { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.tm-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.tm-stat__val { font-size: 22px; font-weight: 700; line-height: 1; color: var(--text); }
.tm-stat__lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; color: var(--text-muted); text-transform: uppercase; }
</style>
`;
}
