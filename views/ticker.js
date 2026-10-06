import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// One slim strip of games. Every cell has the same body (two team rows, winner in white);
// all the context lives in the thin ribbon across its top — season + date for regular
// games, the playoff/finals state and game number for postseason ones, OT on the right —
// and the ribbon's colour says how big the game is: grey (regular) → soft amber (next /
// playoffs) → stronger amber (finals) → solid amber with a trophy (title-clinching game).
//
// Semifinals are "twice to beat" (see getSeriesRecordForGame's highTeamId) — the higher
// seed can clinch on a single win, so the record alone can look unfinished when the series
// is already over; `decided` from the record is what says it's done.
const TROPHY = `<svg class="tk-trophy" width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2.5h8v4a4 4 0 0 1-8 0z"/><path d="M5 4H2.5v1.5A2.5 2.5 0 0 0 5 8M13 4h2.5v1.5A2.5 2.5 0 0 1 13 8M9 10.5V13M6 15.5h6"/></svg>`;

const shortDay = (date) => new Date(`${String(date).slice(0, 10)}T00:00:00`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

// Series state for the ribbon: "TIED 1–1" / "WHITE 2–1" / "WHITE ADVANCES" / "BEST OF 3".
function seriesState(g, rec, scheduled) {
  const { teamAWins, teamBWins, decided, winnerName } = rec;
  if (decided && winnerName && !scheduled) {
    return g.game_type === 'finals' ? null : `${String(winnerName).toUpperCase()} ADVANCES`;
  }
  if (teamAWins === 0 && teamBWins === 0) return g.game_type === 'finals' ? 'BEST OF 3' : '';
  if (teamAWins === teamBWins) return `TIED ${teamAWins}–${teamBWins}`;
  const leader = teamAWins > teamBWins ? g.team_a_name : g.team_b_name;
  return `${String(leader).toUpperCase()} ${Math.max(teamAWins, teamBWins)}–${Math.min(teamAWins, teamBWins)}`;
}

// → { kind, left, right, trophy } for one game's ribbon.
function ribbon(g, scheduled) {
  const s = `S${g.season}`;
  const ot = Number(g.overtime) || 0;
  const otLabel = ot === 0 ? '' : ot === 1 ? 'OT' : `${ot}OT`;
  // Postseason ribbons already say what the game was, so their right side only flags OT —
  // the room goes to the series state on the left.
  const post = g.game_type === 'finals' || g.game_type === 'playoff';
  const right = scheduled ? 'NEXT' : post ? otLabel : (otLabel ? `FINAL/${otLabel}` : 'FINAL');
  const rec = g.seriesRecord;

  if (g.game_type === 'finals') {
    if (!rec) return { kind: 'finals', left: `${s} FINALS · ${shortDay(g.date)}`, right };
    const played = rec.teamAWins + rec.teamBWins;
    const gameNo = scheduled ? played + 1 : played;
    if (!scheduled && rec.decided && rec.winnerName) {
      const w = Math.max(rec.teamAWins, rec.teamBWins), l = Math.min(rec.teamAWins, rec.teamBWins);
      return { kind: 'champion', left: `${s} CHAMPIONS · ${String(rec.winnerName).toUpperCase()} ${w}–${l}`, right, trophy: true };
    }
    const state = seriesState(g, rec, scheduled);
    return { kind: 'finals', left: [`${s} FINALS`, gameNo ? `G${gameNo}` : '', state].filter(Boolean).join(' · '), right };
  }
  if (g.game_type === 'playoff') {
    const state = rec ? seriesState(g, rec, scheduled) : '';
    return { kind: 'playoff', left: [`${s} PLAYOFFS`, state || shortDay(g.date)].join(' · '), right };
  }
  return { kind: scheduled ? 'next' : 'regular', left: `${s} · ${shortDay(g.date)}`, right };
}

export function scoreTicker(games) {
  const cells = games.map(g => {
    const scheduled = g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score) === 0);
    const sa = Number(g.team_a_score), sb = Number(g.team_b_score);
    const winA = !scheduled && sa > sb, winB = !scheduled && sb > sa;
    const r = ribbon(g, scheduled);
    // Rows keep the order games were entered in (team A on top) — winner styling follows
    // whichever row actually won, it doesn't reorder them.
    const row = (name, score, win) => `<span class="tk-row${win ? ' is-win' : ''}">
      <span class="tk-team"><span class="team-dot" style="background:${teamColor(name)}"></span>${escHtml(name)}</span>
      <b class="tk-score font-condensed">${scheduled ? '–' : score}</b>
    </span>`;
    const tag = scheduled ? 'div' : 'a';
    const href = scheduled ? '' : ` href="/games/${encodeURIComponent(g.id)}"`;
    return `<${tag}${href} class="tk-cell tk-cell--${r.kind}">
    <span class="tk-ribbon" title="${escHtml([r.left, r.right].filter(Boolean).join(' · '))}"><span class="tk-ribbon__left">${r.trophy ? TROPHY : ''}${escHtml(r.left)}</span>${r.right ? `<span class="tk-ribbon__right">${escHtml(r.right)}</span>` : ''}</span>
    <span class="tk-body">
      ${row(g.team_a_name, sa, winA)}
      ${row(g.team_b_name, sb, winB)}
    </span>
  </${tag}>`;
  });

  const CHEVRON_L = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  return `<div class="ticker-wrap">
  <button class="ticker-nav ticker-nav--prev" aria-label="Previous games">${CHEVRON_L}</button>
  <div class="score-ticker">
  ${cells.join('\n  ')}
  </div>
  <button class="ticker-nav ticker-nav--next" aria-label="Next games">${CHEVRON_R}</button>
</div>
<script>(function(){
  var wrap = document.currentScript.previousElementSibling;
  var track = wrap.querySelector('.score-ticker');
  var btnP = wrap.querySelector('.ticker-nav--prev');
  var btnN = wrap.querySelector('.ticker-nav--next');
  var STEP = 380;
  function update() {
    var s = track.scrollLeft, max = track.scrollWidth - track.clientWidth;
    wrap.classList.toggle('at-start', s < 4);
    wrap.classList.toggle('at-end',   s > max - 4);
  }
  track.addEventListener('scroll', update, { passive: true });
  btnP.addEventListener('click', function(){ track.scrollBy({ left: -STEP, behavior: 'smooth' }); });
  btnN.addEventListener('click', function(){ track.scrollBy({ left:  STEP, behavior: 'smooth' }); });
  update();
})()</script>`;
}
