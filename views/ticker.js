import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// One slim strip of the latest games, newest first. Regular-season games are compact cells
// (season + date on top, two team rows, winner in white). A playoff or finals series folds
// into a single card, placed where its latest game falls: the result up front (who won or
// leads, by how much) and every game of the series as a chip, oldest to newest, with the
// score filling the chip. The strip ends with a "See all games" cell.
//
// Semifinals are "twice to beat" (see getSeriesRecordForGame's highTeamId) — the higher
// seed can clinch on a single win, so the record alone can look unfinished when the series
// is already over; `decided` from the record is what says it's done.
const TICKER_LIMIT = 30;

const TROPHY = `<svg class="tk-trophy" width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2.5h8v4a4 4 0 0 1-8 0z"/><path d="M5 4H2.5v1.5A2.5 2.5 0 0 0 5 8M13 4h2.5v1.5A2.5 2.5 0 0 1 13 8M9 10.5V13M6 15.5h6"/></svg>`;
const ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

const shortDay = (date) => new Date(`${String(date).slice(0, 10)}T00:00:00`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
const dot = (name) => `<span class="tk-dot" style="background:${teamColor(name)}"></span>`;
const isScheduled = (g) => g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score) === 0);
const otLabel = (g) => { const ot = Number(g.overtime) || 0; return ot === 0 ? '' : ot === 1 ? 'OT' : `${ot}OT`; };
const seriesKey = (g) => `${g.season}|${g.game_type}|${g.series_id || [g.team_a_id, g.team_b_id].sort().join('_')}`;

// Regular-season cell. Rows keep the order games were entered in (team A on top) — winner
// styling follows whichever row actually won, it doesn't reorder them.
function gameCell(g) {
  const scheduled = isScheduled(g);
  const sa = Number(g.team_a_score), sb = Number(g.team_b_score);
  const row = (name, score, win) => `<span class="tk-row${win ? ' is-win' : ''}">
      <span class="tk-team">${dot(name)}${escHtml(name)}</span>
      <b class="tk-score font-condensed">${scheduled ? '–' : score}</b>
    </span>`;
  const ot = otLabel(g);
  const meta = scheduled
    ? `<span class="tk-meta tk-meta--next"><span>NEXT</span><span>${shortDay(g.date)}</span></span>`
    : `<span class="tk-meta"><span>S${g.season} · ${shortDay(g.date)}</span><span>${ot ? `FINAL/${ot}` : 'FINAL'}</span></span>`;
  const tag = scheduled ? 'div' : 'a';
  const href = scheduled ? '' : ` href="/games/${encodeURIComponent(g.id)}"`;
  return `<${tag}${href} class="tk-cell">
    ${meta}
    ${row(g.team_a_name, sa, !scheduled && sa > sb)}
    ${row(g.team_b_name, sb, !scheduled && sb > sa)}
  </${tag}>`;
}

// One playoff/finals series. `games` arrive newest first; chips show oldest first.
function seriesCard(games) {
  const finals = games[0].game_type === 'finals';
  const stage = `S${games[0].season} ${finals ? 'FINALS' : 'SEMIS'}`;
  const chronological = [...games].reverse();
  // The latest completed game's record covers every game before it, even ones the ticker cut off.
  const latestDone = games.find(g => !isScheduled(g));
  const rec = latestDone?.seriesRecord;

  let who = '', status = '', champion = false;
  if (rec?.decided && rec.winnerName) {
    const other = rec.winnerName === latestDone.team_a_name ? latestDone.team_b_name : latestDone.team_a_name;
    const score = `${Math.max(rec.teamAWins, rec.teamBWins)}–${Math.min(rec.teamAWins, rec.teamBWins)}`;
    champion = finals;
    who = `${dot(rec.winnerName)}${escHtml(rec.winnerName)}`;
    status = finals ? `CHAMPIONS · <b>${score}</b>` : `ADVANCES · VS ${escHtml(other)}`;
  } else if (rec && rec.teamAWins !== rec.teamBWins) {
    const leader = rec.teamAWins > rec.teamBWins ? latestDone.team_a_name : latestDone.team_b_name;
    who = `${dot(leader)}${escHtml(leader)}`;
    status = `LEADS · <b>${Math.max(rec.teamAWins, rec.teamBWins)}–${Math.min(rec.teamAWins, rec.teamBWins)}</b>`;
  } else {
    const g = games[0];
    who = `${dot(g.team_a_name)}${dot(g.team_b_name)}<span class="tk-series__vs">${escHtml(g.team_a_name)} V ${escHtml(g.team_b_name)}</span>`;
    status = rec ? `TIED · <b>${rec.teamAWins}–${rec.teamBWins}</b>` : 'SERIES STARTS';
  }

  const chips = chronological.map(g => {
    const r = g.seriesRecord;
    if (isScheduled(g)) {
      const no = r ? r.teamAWins + r.teamBWins + 1 : '';
      return `<div class="tk-chip tk-chip--next">
      <span class="tk-chip__label"><span>${no ? `G${no}` : 'NEXT'}</span><span>NEXT</span></span>
      <span class="tk-chip__date font-condensed">${shortDay(g.date)}</span>
    </div>`;
    }
    const sa = Number(g.team_a_score), sb = Number(g.team_b_score);
    const winner = sa > sb ? g.team_a_name : g.team_b_name;
    const hi = Math.max(sa, sb), lo = Math.min(sa, sb);
    const no = r ? r.teamAWins + r.teamBWins : '';
    const ot = otLabel(g);
    const label = [no ? `G${no}` : '', ot].filter(Boolean).join(' · ');
    return `<a class="tk-chip" href="/games/${encodeURIComponent(g.id)}" aria-label="${escHtml(`${label}: ${g.team_a_name} ${sa}, ${g.team_b_name} ${sb}`)}">
      <span class="tk-chip__label"><span>${label}</span>${dot(winner)}</span>
      <span class="tk-chip__score font-condensed"><span class="tk-chip__hi">${hi}</span><span class="tk-chip__dash">–</span><span class="tk-chip__lo">${lo}</span></span>
    </a>`;
  }).join('\n    ');

  return `<div class="tk-series${champion ? ' tk-series--champion' : ''}">
    <div class="tk-series__sum">
      <span class="tk-series__stage">${champion ? TROPHY : ''}${stage}</span>
      <span class="tk-series__who">${who}</span>
      <span class="tk-series__status">${status}</span>
    </div>
    <div class="tk-series__games">
    ${chips}
    </div>
  </div>`;
}

export function scoreTicker(games) {
  // Group postseason games into their series (placed at the series' newest game), stop
  // after TICKER_LIMIT games — except that games of a series already on the strip still
  // join it, so a series is never shown half-cut.
  const items = [];
  const seriesByKey = new Map();
  let count = 0;
  for (const g of games) {
    const post = g.game_type === 'playoff' || g.game_type === 'finals';
    const series = post ? seriesByKey.get(seriesKey(g)) : null;
    if (series) { series.games.push(g); count++; continue; }
    if (count >= TICKER_LIMIT) continue;
    count++;
    if (post) {
      const item = { games: [g] };
      seriesByKey.set(seriesKey(g), item);
      items.push(item);
    } else {
      items.push({ game: g });
    }
  }

  const cells = items.map(it => it.game ? gameCell(it.game) : seriesCard(it.games));
  cells.push(`<a href="/games" class="tk-all">
    <span class="tk-all__icon">${ARROW}</span>
    <span>See all games</span>
  </a>`);

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
