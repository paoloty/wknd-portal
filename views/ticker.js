import { escHtml } from './layout.js';
import { teamColor, formatDate } from './utils.js';

// "TEAM LEADS 2–1" / "SERIES TIED 1–1" / "VS" (no games played yet) / '' (not a series game
// at all) / "TEAM ADVANCES" / "TEAM — CHAMPIONS 🏆" (series clinched). Renders into a
// reserved-height slot on every card (see .ticker-series in styles.css) so postseason cards
// never grow an extra line relative to regular ones.
//
// Semifinals are "twice to beat" (see getSeriesRecordForGame's highTeamId) — the higher
// seed can clinch on a single win, so "LEADS 1–0" would be misleading once decided: the
// series is already over even though the raw count still looks like it's continuing.
function seriesLabel(g) {
  const rec = g.seriesRecord;
  if (!rec) return '';
  const { teamAWins, teamBWins, decided, winnerName } = rec;
  if (decided && winnerName) {
    return g.game_type === 'finals'
      ? `${String(winnerName).toUpperCase()} — CHAMPIONS \u{1F3C6}`
      : `${String(winnerName).toUpperCase()} ADVANCES`;
  }
  if (teamAWins === 0 && teamBWins === 0) return 'VS';
  if (teamAWins === teamBWins) return `SERIES TIED ${teamAWins}–${teamBWins}`;
  const leader = teamAWins > teamBWins ? g.team_a_name : g.team_b_name;
  const lead = Math.max(teamAWins, teamBWins), trail = Math.min(teamAWins, teamBWins);
  return `${String(leader).toUpperCase()} LEADS ${lead}–${trail}`;
}

export function scoreTicker(games) {
  const cards = games.map(g => {
    const isScheduled = g.scheduled === 1 || (Number(g.team_a_score) + Number(g.team_b_score) === 0);
    const scoreA      = Number(g.team_a_score);
    const scoreB      = Number(g.team_b_score);
    const colorA      = teamColor(g.team_a_name);
    const colorB      = teamColor(g.team_b_name);
    const tier        = g.game_type === 'finals' ? 'finals' : g.game_type === 'playoff' ? 'playoff' : null;
    const series      = `<div class="ticker-series">${seriesLabel(g) || '&nbsp;'}</div>`;

    if (isScheduled) {
      const badge = tier === 'finals' ? '\u{1F3C6} FINALS' : tier === 'playoff' ? 'PLAYOFF' : 'UPCOMING';
      const cardCls = tier ? `ticker-card--${tier}` : 'ticker-card--upcoming';
      const row = (name, color) => `<div class="ticker-team-row">
    <div class="ticker-team"><span class="team-dot" style="background:${color}"></span><span class="ticker-team-name">${escHtml(name)}</span></div>
    <span class="font-condensed ticker-score ticker-score--tbd">–</span>
  </div>`;
      return `<div class="card score-ticker__card ${cardCls}" style="--tc-a:${colorA};--tc-b:${colorB}">
  <div class="ticker-header">
    <span class="ticker-date">${escHtml(formatDate(g.date))}</span>
    <span class="ticker-status ticker-status--upcoming">${badge}</span>
  </div>
  ${series}
  ${row(g.team_a_name, colorA)}
  ${row(g.team_b_name, colorB)}
</div>`;
    }

    const otCount = Number(g.overtime) || 0;
    const finalLabel = otCount === 0 ? 'FINAL' : otCount === 1 ? 'FINAL/OT' : `FINAL/OT${otCount}`;
    const badge = tier === 'finals' ? `\u{1F3C6} ${finalLabel}` : finalLabel;
    const cardCls = tier ? `ticker-card--${tier}` : '';

    // Rows keep the order games were entered in (team A on top, team B below) — winner
    // styling still applies to whichever row actually won, it just doesn't reorder them.
    const winA = scoreA > scoreB;
    const rowA = { name: g.team_a_name, score: scoreA, color: colorA, win: winA };
    const rowB = { name: g.team_b_name, score: scoreB, color: colorB, win: !winA && scoreB > scoreA };

    const row = t => `<div class="ticker-team-row${t.win ? ' ticker-row--win' : ''}">
    <div class="ticker-team"><span class="team-dot" style="background:${t.color}"></span><span class="ticker-team-name">${escHtml(t.name)}</span></div>
    <span class="font-condensed ticker-score">${t.score}</span>
  </div>`;

    return `<a href="/games/${encodeURIComponent(g.id)}" class="card score-ticker__card ${cardCls}" style="--tc-a:${colorA};--tc-b:${colorB}">
  <div class="ticker-header">
    <span class="ticker-date">${escHtml(formatDate(g.date))}</span>
    <span class="ticker-status ticker-status--final">${badge}</span>
  </div>
  ${series}
  ${row(rowA)}
  ${row(rowB)}
</a>`;
  });

  const CHEVRON_L = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  return `<div class="ticker-wrap">
  <button class="ticker-nav ticker-nav--prev" aria-label="Previous games">${CHEVRON_L}</button>
  <div class="score-ticker">
  ${cards.join('\n  ')}
  </div>
  <button class="ticker-nav ticker-nav--next" aria-label="Next games">${CHEVRON_R}</button>
</div>
<script>(function(){
  var wrap = document.currentScript.previousElementSibling;
  var track = wrap.querySelector('.score-ticker');
  var btnP = wrap.querySelector('.ticker-nav--prev');
  var btnN = wrap.querySelector('.ticker-nav--next');
  var STEP = 174;
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
