import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeSeries(games, highSeedId, format) {
  let highWins = 0, lowWins = 0;
  for (const g of games) {
    if (g.status !== 'complete') continue;
    const isHighA = g.team_a_id === highSeedId;
    const highWon = isHighA ? g.team_a_score > g.team_b_score : g.team_b_score > g.team_a_score;
    if (highWon) highWins++; else lowWins++;
  }
  const highNeeds = format === 'finals' ? 2 : 1;
  const winner    = highWins >= highNeeds ? 'high' : lowWins >= 2 ? 'low' : null;
  const maxGames  = format === 'finals' ? 3 : 2;
  return { highWins, lowWins, winner, maxGames };
}

function gameChips(games, highSeedId, maxGames) {
  const chips = [];
  const played = games.filter(g => g.status === 'complete').length;
  for (let i = 0; i < maxGames; i++) {
    const g = games[i];
    if (!g) {
      if (i === played) {
        chips.push(`<span class="pm-chip pm-chip--pending">G${i + 1} · TBD</span>`);
      }
      break;
    }
    const isHighA  = g.team_a_id === highSeedId;
    const highScore = isHighA ? g.team_a_score : g.team_b_score;
    const lowScore  = isHighA ? g.team_b_score : g.team_a_score;
    const highWon   = highScore > lowScore;
    chips.push(`<a href="/games/${escHtml(g.id)}" class="pm-chip ${highWon ? 'pm-chip--win' : 'pm-chip--loss'}">${escHtml(fmtDate(g.date))} &middot; ${highScore}&ndash;${lowScore}</a>`);
  }
  return chips.join('');
}

function matchupCard({ highSeed, highNum, lowSeed, lowNum, games, format, isFinals }) {
  const hasBoth = highSeed && lowSeed;
  const { highWins, lowWins, winner, maxGames } = hasBoth
    ? computeSeries(games, highSeed.id, format)
    : { highWins: 0, lowWins: 0, winner: null, maxGames: format === 'finals' ? 3 : 2 };

  const highName  = highSeed ? String(highSeed.name).toUpperCase() : 'TBD';
  const lowName   = lowSeed  ? String(lowSeed.name).toUpperCase()  : 'TBD';
  const highColor = highSeed ? teamColor(highName) : '#334155';
  const lowColor  = lowSeed  ? teamColor(lowName)  : '#334155';

  const highWon    = winner === 'high';
  const lowWon     = winner === 'low';
  const highLeads  = !winner && highWins > lowWins;
  const lowLeads   = !winner && lowWins > highWins;

  const highNameCls  = lowWon   ? 'pm-team__name--dim' : '';
  const lowNameCls   = highWon  ? 'pm-team__name--dim' : '';
  const highScoreCls = highWon  ? 'pm-team__score--gold' : lowWon ? 'pm-team__score--dim' : highLeads ? 'pm-team__score--active' : '';
  const lowScoreCls  = lowWon   ? 'pm-team__score--gold' : highWon ? 'pm-team__score--dim' : lowLeads  ? 'pm-team__score--active' : '';

  const chips = hasBoth && games.length ? gameChips(games, highSeed.id, maxGames) : '';

  const seedEl = (n) => n ? `<span class="pm-team__seed">${n}</span>` : '';
  const badgeEl = (!isFinals && highSeed) ? `<span class="pm-team__badge">2&times;</span>` : '';
  const scoreEl = (n, cls) => hasBoth ? `<span class="pm-team__score ${cls}">${n}</span>` : '';

  return `<div class="pm-card${isFinals ? ' pm-card--finals' : ''}">
  <div class="pm-card__header">
    <span class="pm-label${isFinals ? ' pm-label--finals' : ''}">${isFinals ? '&#127942; Championship Finals' : 'Semifinals'}</span>
    <span class="pm-sublabel">${isFinals ? 'Best of 3 &middot; First to 2 wins' : 'Twice to beat &middot; Higher seed'}</span>
  </div>
  <div class="pm-team" style="--tc:${escHtml(highColor)}">
    ${seedEl(highNum)}
    <span class="pm-team__name ${highNameCls}">${escHtml(highName)}</span>
    ${badgeEl}
    ${scoreEl(highWins, highScoreCls)}
  </div>
  <div class="pm-divider"></div>
  <div class="pm-team" style="--tc:${escHtml(lowColor)}">
    ${seedEl(lowNum)}
    <span class="pm-team__name ${lowNameCls}">${escHtml(lowName)}</span>
    ${scoreEl(lowWins, lowScoreCls)}
  </div>
  ${chips
    ? `<div class="pm-chips">${chips}</div>`
    : (!hasBoth ? `<div class="pm-awaiting">Awaiting semifinal results</div>` : `<div class="pm-awaiting">Not yet started</div>`)
  }
  ${winner ? `<div class="pm-footer${isFinals ? ' pm-footer--finals' : ''}">
    <span class="pm-winner">${escHtml(highWon ? highName : lowName)}${isFinals ? ' &mdash; Champion &#127942;' : ' advances'}</span>
  </div>` : ''}
</div>`;
}

export function playoffsPage({ standings, games, season }) {
  const seeds = [...standings]
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const qA = Number(a.pa) > 0 ? Number(a.pf) / Number(a.pa) : 0;
      const qB = Number(b.pa) > 0 ? Number(b.pf) / Number(b.pa) : 0;
      return qB - qA;
    })
    .slice(0, 4);

  const semiGames   = games.filter(g => g.game_type === 'playoff');
  const finalsGames = games.filter(g => g.game_type === 'finals');

  const seriesMap = {};
  for (const g of semiGames) {
    const sid = g.series_id || `${[g.team_a_id, g.team_b_id].sort().join('_')}`;
    if (!seriesMap[sid]) seriesMap[sid] = { games: [], teamIds: new Set() };
    seriesMap[sid].games.push(g);
    seriesMap[sid].teamIds.add(g.team_a_id);
    seriesMap[sid].teamIds.add(g.team_b_id);
  }
  const seriesList = Object.values(seriesMap);

  let semi1Games = [], semi2Games = [];
  const seed1Id = seeds[0]?.id;
  for (const s of seriesList) {
    if (seed1Id && s.teamIds.has(seed1Id)) semi1Games = s.games;
    else semi2Games = s.games;
  }

  let finalist1 = null, finalist2 = null;
  if (seeds[0] && seeds[3] && semi1Games.length) {
    const { winner } = computeSeries(semi1Games, seeds[0].id, 'semi');
    if (winner) finalist1 = winner === 'high' ? seeds[0] : seeds[3];
  }
  if (seeds[1] && seeds[2] && semi2Games.length) {
    const { winner } = computeSeries(semi2Games, seeds[1].id, 'semi');
    if (winner) finalist2 = winner === 'high' ? seeds[1] : seeds[2];
  }
  if (finalsGames.length && (!finalist1 || !finalist2)) {
    const finTeamIds = new Set(finalsGames.flatMap(g => [g.team_a_id, g.team_b_id]));
    const fromSeeds  = seeds.filter(s => finTeamIds.has(s.id));
    if (!finalist1) finalist1 = fromSeeds[0] ?? null;
    if (!finalist2) finalist2 = fromSeeds[1] ?? null;
  }

  const f1Seed = finalist1 ? seeds.findIndex(s => s.id === finalist1.id) + 1 : null;
  const f2Seed = finalist2 ? seeds.findIndex(s => s.id === finalist2.id) + 1 : null;

  const semi1 = matchupCard({ highSeed: seeds[0], highNum: 1, lowSeed: seeds[3], lowNum: 4, games: semi1Games, format: 'semi', isFinals: false });
  const semi2 = matchupCard({ highSeed: seeds[1], highNum: 2, lowSeed: seeds[2], lowNum: 3, games: semi2Games, format: 'semi', isFinals: false });
  const finals = matchupCard({ highSeed: finalist1, highNum: f1Seed, lowSeed: finalist2, lowNum: f2Seed, games: finalsGames, format: 'finals', isFinals: true });

  return `
  <div class="page-content">
    <div style="margin-bottom:32px">
      <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-.02em;color:var(--text)">Season ${escHtml(String(season))} Playoffs</h1>
    </div>
    ${!seeds.length ? `<p style="color:var(--text-muted)">Season data not available.</p>` : `
    <div class="playoffs-bracket">
      <div class="playoffs-semi">${semi1}</div>
      <div class="playoffs-connector" aria-hidden="true"></div>
      <div class="playoffs-finals">${finals}</div>
      <div class="playoffs-connector" aria-hidden="true"></div>
      <div class="playoffs-semi">${semi2}</div>
    </div>`}
  </div>
`;
}
