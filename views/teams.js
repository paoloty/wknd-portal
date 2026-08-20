import { escHtml, pageHeader } from './layout.js';
import { teamColor } from './utils.js';

// Plain bordered-card grid, matching the Games/Papawis/Polls/Highlights visual language —
// team color is used the way the design system elsewhere restricts it to (a small dot),
// not a full gradient wash/watermark like the previous "2K-style" card design.
function teamCard(t) {
  const color = teamColor(t.name);
  const wins = t.wins != null ? t.wins : '—';
  const losses = t.losses != null ? t.losses : '—';

  const stat = (label, val, highlight = false) => `
    <div class="tm-stat">
      <span class="tm-stat__val font-condensed"${highlight ? ` style="color:var(--amber)"` : ''}>${val ?? '—'}</span>
      <span class="tm-stat__lbl">${label}</span>
    </div>`;

  return `<a href="/teams/${encodeURIComponent(t.id)}" class="tm-card">
  <div class="tm-card__top">
    <span class="team-dot" style="background:${escHtml(color)}"></span>
    <span class="tm-card__name">${escHtml(t.name)}</span>
    <span class="tm-card__record">${escHtml(String(wins))}-${escHtml(String(losses))}</span>
  </div>
  <div class="tm-card__stats">
    ${stat('OFF', t.avgOff)}
    ${stat('DEF', t.avgDef)}
    ${stat('OVR', t.avgOvr, true)}
  </div>
  <div class="tm-card__footer">
    <span class="tm-card__roster">${t.rosterCount} player${t.rosterCount === 1 ? '' : 's'}</span>
    <span class="tm-card__cta">View roster <span>&rarr;</span></span>
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
.tm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
@media (max-width: 640px) {
  .tm-grid { grid-template-columns: 1fr; }
}
/* No padding on the card itself — each section carries its own, so .tm-card__stats'
   border-top/bottom span the full card width edge to edge, same as .pw-card-titlebar's
   border-bottom does in views/papawis.js, instead of stopping short at an outer inset. */
.tm-card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 15px; overflow: hidden; color: inherit; text-decoration: none; transition: border-color .12s, background .12s; }
.tm-card:hover { border-color: var(--text-muted); background: rgba(255,255,255,.02); }
.tm-card__top { display: flex; align-items: center; gap: 8px; padding: 16px 20px 0; }
.tm-card__name { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tm-card__record { font-size: 13px; font-weight: 700; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.tm-card__stats { display: flex; align-items: center; gap: 18px; margin-top: 14px; padding: 14px 20px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.tm-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.tm-stat__val { font-size: 24px; font-weight: 700; line-height: 1; color: var(--text); }
.tm-stat__lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; color: var(--text-muted); text-transform: uppercase; }
.tm-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px 16px; }
.tm-card__roster { font-size: 11.5px; color: var(--text-muted); }
.tm-card__cta { font-size: 11.5px; font-weight: 700; letter-spacing: .03em; color: var(--amber); }
.tm-card__cta span { display: inline-block; transition: transform .12s; }
.tm-card:hover .tm-card__cta span { transform: translateX(2px); }
</style>
`;
}
