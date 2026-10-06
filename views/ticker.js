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

// Every cell is the same compact width, so a ribbon has to fit ~20 characters: the stage
// goes on the left ("S3 FINALS · G2", "S3 PLAYOFFS") and the state on the right, where
// the team is a coloured dot instead of a name ("●1–0", "●ADVANCES", "TIED 1–1", "OT").
// → { kind, left, right, dot, trophy } for one game's ribbon.
function ribbon(g, scheduled) {
  const s = `S${g.season}`;
  const ot = Number(g.overtime) || 0;
  const otLabel = ot === 0 ? '' : ot === 1 ? 'OT' : `${ot}OT`;
  const rec = g.seriesRecord;
  const withOt = text => [text, otLabel].filter(Boolean).join(' · ');

  if (g.game_type === 'finals' || g.game_type === 'playoff') {
    const finals = g.game_type === 'finals';
    const stage = finals ? `${s} FINALS` : `${s} PLAYOFFS`;
    if (!rec) return { kind: finals ? 'finals' : 'playoff', left: stage, right: scheduled ? 'NEXT' : withOt('FINAL') };
    const { teamAWins: a, teamBWins: b, decided, winnerName } = rec;
    const played = a + b;
    const gameNo = scheduled ? played + 1 : played;
    const leaderColor = a === b ? null : teamColor(a > b ? g.team_a_name : g.team_b_name);
    const score = `${Math.max(a, b)}–${Math.min(a, b)}`;
    if (!scheduled && decided && winnerName) {
      return finals
        ? { kind: 'champion', left: `${s} CHAMPIONS`, right: withOt(score), dot: teamColor(winnerName), trophy: true }
        : { kind: 'playoff', left: stage, right: withOt('ADVANCES'), dot: teamColor(winnerName) };
    }
    const left = finals && gameNo ? `${stage} · G${gameNo}` : stage;
    if (scheduled) return { kind: finals ? 'finals' : 'playoff', left, right: played ? (a === b ? `TIED ${score}` : score) : 'NEXT', dot: leaderColor };
    return { kind: finals ? 'finals' : 'playoff', left, right: withOt(a === b ? `TIED ${score}` : score), dot: leaderColor };
  }
  return { kind: scheduled ? 'next' : 'regular', left: `${s} · ${shortDay(g.date)}`, right: scheduled ? 'NEXT' : (otLabel ? `FINAL/${otLabel}` : 'FINAL') };
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
    <span class="tk-ribbon" title="${escHtml([r.left, r.right].filter(Boolean).join(' · '))}"><span class="tk-ribbon__left">${r.trophy ? TROPHY : ''}${escHtml(r.left)}</span>${r.right ? `<span class="tk-ribbon__right">${r.dot ? `<span class="tk-dot" style="background:${r.dot}"></span>` : ''}${escHtml(r.right)}</span>` : ''}</span>
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
