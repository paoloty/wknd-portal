import { escHtml } from './layout.js';
import { teamColor, playerPhotoUrl } from './utils.js';

// ── /playoffs ─────────────────────────────────────────────────────────────────
// Champion hero (once there is one) → bracket (semis → finals → champion, with win rings)
// → every playoff game. Before the playoffs start the same bracket shows today's seeds as
// a projection. Semis: the higher seed is twice to beat (needs 1 win, the lower seed 2);
// finals: best of 3.

// Canonical, order-independent key for a team pair — used to look a pair up in an h2h map
// regardless of which order the two teams were passed in when the map was built.
export function pairKey(teamAId, teamBId) { return [teamAId, teamBId].sort().join('|'); }

// Wins first, point-differential quotient (pf/pa) as tiebreak, top 4 make the bracket.
// Exported so anything needing to know seeding (e.g. the ticker's "twice to beat"
// clinch detection) uses the exact same order as the bracket itself.
//
// h2h (optional): a plain { [pairKey]: { teamAId, teamBId, teamAWins, teamBWins } } map,
// built by the caller (this file has no DB access) via getHeadToHeadRecordForSeason for
// every pair in `standings`. Same rule as getSeasonStandings' own point-diff tiebreak: a
// two-team tie on wins is broken by who won their season series before falling back to the
// quotient the sort below already applied; three-or-more-team ties skip head-to-head
// entirely (can be circular/incomplete) and keep the quotient order.
export function computeSeeds(standings, h2h = {}) {
  const sorted = [...standings].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const qA = Number(a.pa) > 0 ? Number(a.pf) / Number(a.pa) : 0;
    const qB = Number(b.pa) > 0 ? Number(b.pf) / Number(b.pa) : 0;
    return qB - qA;
  });
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].wins === sorted[i].wins) j++;
    if (j - i === 2) {
      const a = sorted[i], b = sorted[j - 1];
      const rec = h2h[pairKey(a.id, b.id)];
      if (rec) {
        const aWins = rec.teamAId === a.id ? rec.teamAWins : rec.teamBWins;
        const bWins = rec.teamAId === b.id ? rec.teamAWins : rec.teamBWins;
        if (bWins > aWins) { sorted[i] = b; sorted[j - 1] = a; }
      }
    }
    i = j;
  }
  return sorted.slice(0, 4);
}

const TROPHY = (size, width = 1.7) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>`;

const isPlayed = g => (g.status === 'complete' || g.status === 'final') && (Number(g.team_a_score) > 0 || Number(g.team_b_score) > 0);
const fmtDay = d => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function rgba(hex, a) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : `rgba(255,255,255,${a})`;
}

function winnerId(g) { return Number(g.team_a_score) > Number(g.team_b_score) ? g.team_a_id : g.team_b_id; }

// One series between `high` (top row) and `low`: wins, who (if anyone) has advanced.
// need = wins required by each side: semis { high: 1, low: 2 }, finals { high: 2, low: 2 }.
function seriesState(games, high, low, need) {
  const played = games.filter(isPlayed);
  let hw = 0, lw = 0;
  for (const g of played) { if (winnerId(g) === high?.id) hw++; else lw++; }
  const winner = high && hw >= need.high ? high : low && lw >= need.low ? low : null;
  return { played, hw, lw, winner };
}

const pips = (n, filled) => `<span class="po-pips">${Array.from({ length: n }, (_, i) => `<span class="po-pip${i < filled ? ' is-won' : ''}"></span>`).join('')}</span>`;

function teamRow(t, seed, wins, need, { out = false, showRec = false, big = false } = {}) {
  if (!t) return `<div class="po-trow is-tbd"><span class="po-trow__seed font-condensed"></span><span>TBD</span>${pips(need, 0)}</div>`;
  return `<a href="/teams/${encodeURIComponent(t.id)}" class="po-trow${out ? ' is-out' : ''}${big ? ' is-big' : ''}">
    <span class="po-trow__seed font-condensed${seed && seed <= 2 && !out ? ' is-top' : ''}">${seed || ''}</span>
    <span class="team-dot" style="background:${teamColor(t.name)}"></span>
    <span class="po-trow__name">${escHtml(t.name)}</span>
    ${showRec ? `<span class="po-trow__rec font-condensed">${t.wins}-${t.losses}</span>` : ''}
    ${big ? `<span class="po-trow__wins font-condensed">${wins}</span>` : ''}
    ${pips(need, wins)}
  </a>`;
}

// Played games as chips, then the next slot: a scheduled date, "date TBA", or "not needed".
function gameChips(games, state, max, decided) {
  const chips = state.played.map((g, i) => `<a href="/games/${encodeURIComponent(g.id)}" class="po-chip">G${i + 1} · ${fmtDay(g.date)} <span class="team-dot" style="background:${teamColor(winnerId(g) === g.team_a_id ? g.team_a_name : g.team_b_name)}"></span><b>${Math.max(g.team_a_score, g.team_b_score)}-${Math.min(g.team_a_score, g.team_b_score)}</b>${Number(g.overtime) ? '<span class="po-ot">OT</span>' : ''}</a>`);
  const n = state.played.length;
  if (n < max) {
    if (decided) chips.push(`<span class="po-chip is-slot">G${n + 1} · not needed</span>`);
    else {
      const next = games.find(g => !isPlayed(g));
      chips.push(next
        ? `<a href="/games/${encodeURIComponent(next.id)}" class="po-chip is-slot is-next">G${n + 1} · ${fmtDay(next.date)}</a>`
        : `<span class="po-chip is-slot">G${n + 1} · date TBA</span>`);
    }
  }
  return `<div class="po-chips">${chips.join('')}</div>`;
}

function semiCard(label, high, hs, low, ls, games, projected) {
  const st = seriesState(games, high, low, { high: 1, low: 2 });
  const note = projected ? 'Twice to beat'
    : st.winner ? (st.played.length >= 2 ? 'Went the distance' : 'Done in one')
    : st.played.length ? 'In progress' : 'Twice to beat';
  return `<div class="po-series card">
    <div class="po-series__top"><span class="stp-th">${label}</span><span class="stp-th">${note}</span></div>
    ${teamRow(high, hs, st.hw, 1, { out: st.winner && st.winner !== high, showRec: projected })}
    ${teamRow(low, ls, st.lw, 2, { out: st.winner && st.winner !== low, showRec: projected })}
    ${gameChips(games, st, 2, !!st.winner)}
  </div>`;
}

function heroSection(h) {
  const avatar = p => `<span class="po-av"><span class="font-condensed" aria-hidden="true">${escHtml(p.initials)}</span><img src="${playerPhotoUrl(p.id, 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  const person = (label, p, hot) => p ? `<a href="/players/${encodeURIComponent(p.id)}" class="po-hero__person">${avatar(p)}<span><span class="stp-th${hot ? ' is-hot' : ''}">${label}</span><span class="po-hero__pname">${escHtml(p.name)}${p.number !== '' && p.number != null ? ` <span class="font-condensed">#${escHtml(String(p.number))}</span>` : ''}</span></span></a>` : '';
  return `<section class="po-hero" aria-label="Champion" style="--glare:${rgba(teamColor(h.team.name), 0.13)}">
  <div class="po-hero__main">
    <span class="po-hero__kicker">${TROPHY(22, 1.8)}<span class="stp-kicker">Season ${escHtml(String(h.season))} champions</span></span>
    <h2 class="po-hero__team"><span class="team-dot" style="background:${teamColor(h.team.name)}"></span>${escHtml(h.team.name)}</h2>
    <p class="po-hero__line">${h.line}</p>
    <div class="po-hero__actions">
      ${h.clincherId ? `<a href="/games/${encodeURIComponent(h.clincherId)}" class="po-btn is-primary">Read the clincher recap</a>` : ''}
      <a href="/teams/${encodeURIComponent(h.team.id)}" class="po-btn">Team page</a>
    </div>
  </div>
  <div class="po-hero__side">
    ${person('Finals MVP', h.finalsMvp, true)}
    ${person('Season MVP', h.mvp, false)}
    ${h.team.wins != null ? `<div class="po-hero__stat"><span>Regular season</span><span><b class="font-condensed">${h.team.wins}-${h.team.losses}</b>${h.seed ? ` · ${['1st', '2nd', '3rd', '4th'][h.seed - 1]} seed` : ''}</span></div>` : ''}
  </div>
</section>`;
}

function gamesTable(rows) {
  if (!rows.length) return '';
  return `<section class="po-games" aria-labelledby="po-games-h">
  <div class="section-header"><h2 id="po-games-h">Every playoff game</h2><a href="/games" class="section-header__link">All games <span>&rarr;</span></a></div>
  <div class="po-gl card">
    <div class="po-gl__row is-head"><span class="stp-th">Round</span><span class="stp-th">Date</span><span class="stp-th">Result</span><span class="stp-th">Recap</span><span class="stp-th">Player of the game</span></div>
    ${rows.map(r => `<a href="/games/${encodeURIComponent(r.id)}" class="po-gl__row">
      <span class="stp-th${r.finals ? ' is-hot' : ''}">${escHtml(r.round)}</span>
      <span class="po-gl__date">${fmtDay(r.date)}</span>
      <span class="po-gl__result"><span class="team-dot" style="background:${teamColor(r.w)}"></span>${escHtml(r.w)}<b class="font-condensed">${r.ws}-${r.ls}</b><span class="po-gl__l">${escHtml(r.l)}</span>${r.ot ? '<span class="po-ot">OT</span>' : ''}</span>
      <span class="po-gl__recap${r.recap ? '' : ' is-none'}">${escHtml(r.recap || 'No recap yet')}</span>
      <span class="po-gl__potg">${escHtml(r.potg || '—')}</span>
    </a>`).join('')}
  </div>
</section>`;
}

// season, seasons, isCurrent; standings (getSeasonStandings rows); h2h map; games: the
// season's playoff + finals games (not under review), each with recapTitle and potgName;
// awards: { finalsMvp, mvp } as { id, name, number, initials } or null; regular: { played, expected }.
export function playoffsPage({ standings = [], games = [], season, seasons = [], isCurrent = true, h2h = {}, awards = {}, regular = { played: 0, expected: 0 } }) {
  const seeds = computeSeeds(standings, h2h);
  const seedOf = t => t ? seeds.findIndex(s => s.id === t.id) + 1 : null;
  const sorted = [...games].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const semiGames = sorted.filter(g => g.game_type === 'playoff');
  const finalsGames = sorted.filter(g => g.game_type === 'finals');
  const started = sorted.some(isPlayed);
  const projected = !started && seeds.length === 4;

  const pairGames = (a, b) => a && b ? semiGames.filter(g => pairKey(g.team_a_id, g.team_b_id) === pairKey(a.id, b.id)) : [];
  const [s1, s2, s3, s4] = seeds;
  const semi1 = pairGames(s1, s4), semi2 = pairGames(s2, s3);
  const w1 = seriesState(semi1, s1, s4, { high: 1, low: 2 }).winner;
  const w2 = seriesState(semi2, s2, s3, { high: 1, low: 2 }).winner;

  // Finalists: the semi winners, else whoever is in the finals games.
  let f = [w1, w2];
  if (finalsGames.length && (!f[0] || !f[1])) {
    const ids = new Set(finalsGames.flatMap(g => [g.team_a_id, g.team_b_id]));
    const inFinals = seeds.filter(s => ids.has(s.id));
    f = [f[0] || inFinals.find(t => t !== f[1]) || null, f[1] || inFinals.find(t => t !== f[0]) || null];
  }
  if (f[0] && f[1] && seedOf(f[1]) < seedOf(f[0])) f = [f[1], f[0]];
  const [fHigh, fLow] = f;
  const fin = seriesState(finalsGames, fHigh, fLow, { high: 2, low: 2 });
  const champ = fin.winner;

  // Hero line: final result, then how the champion's semi went.
  let hero = '';
  if (champ) {
    const opp = champ === fHigh ? fLow : fHigh;
    const cw = champ === fHigh ? fin.hw : fin.lw, ow = champ === fHigh ? fin.lw : fin.hw;
    const champSemi = champ === w1 ? semi1 : semi2;
    const semiOpp = champ === w1 ? (champ === s1 ? s4 : s1) : (champ === s2 ? s3 : s2);
    const semiN = champSemi.filter(isPlayed).length;
    const line = `Beat <b>${escHtml(opp?.name || '')} ${cw}–${ow}</b> in the best-of-3 final${semiOpp && semiN ? `, after getting past ${escHtml(semiOpp.name)} in the semis ${semiN === 1 ? 'in one game' : `in ${semiN} games`}` : ''}.`;
    const clincher = fin.played[fin.played.length - 1];
    hero = heroSection({ season, team: champ, seed: seedOf(champ), line, clincherId: clincher?.id, finalsMvp: awards.finalsMvp, mvp: awards.mvp });
  }

  // Before the playoffs: who would have twice to beat today.
  const pct = regular.expected ? Math.min(100, Math.round(regular.played / regular.expected * 100)) : 0;
  const preSummary = projected ? `<div class="stp-summary">
    <span class="stp-kicker">The playoff race${isCurrent ? '' : ' · final seeding'}</span>
    <p class="stp-summary__headline">${isCurrent ? 'If the season ended today, ' : ''}<em>${escHtml(s1.name)}</em> and <em>${escHtml(s2.name)}</em> ${isCurrent ? 'would have' : 'have'} twice to beat.</p>
    <p class="stp-summary__body">${escHtml(s3.name)} and ${escHtml(s4.name)} would have to win twice to reach the final.</p>
  </div>` : '';

  const finalsCard = `<div class="po-series po-finals">
    <div class="po-series__top"><span class="stp-kicker">Finals</span><span class="stp-th">Best of 3</span></div>
    ${teamRow(fHigh, seedOf(fHigh), fin.hw, 2, { out: champ && champ !== fHigh, big: !!(fHigh && fLow) })}
    ${teamRow(fLow, seedOf(fLow), fin.lw, 2, { out: champ && champ !== fLow, big: !!(fHigh && fLow) })}
    ${fHigh && fLow ? gameChips(finalsGames, fin, 3, !!champ) : `<div class="po-chips"><span class="po-chip is-slot">${projected ? 'Semi winners' : 'Waiting on the semis'}</span></div>`}
  </div>`;

  const champCard = `<div class="po-champ${champ ? ' is-won' : ''}"${champ ? ` style="--glare:${rgba(teamColor(champ.name), 0.14)}"` : ''}>
    ${TROPHY(34, 1.6)}
    <span class="stp-th">Champion</span>
    ${champ ? `<a href="/teams/${encodeURIComponent(champ.id)}" class="po-champ__team"><span class="team-dot" style="background:${teamColor(champ.name)}"></span>${escHtml(champ.name)}</a>` : '<span class="po-champ__team is-tbd">TBD</span>'}
  </div>`;

  const bracket = seeds.length < 4 ? '<p class="stp-desc">Not enough teams for a bracket yet.</p>' : `<section class="po-bracket" aria-labelledby="po-br-h">
  <div class="section-header"><h2 id="po-br-h">${projected ? 'Projected bracket' : 'Bracket'}</h2><span class="po-legend"><span><span class="po-pip is-won"></span>win</span><span><span class="po-pip"></span>win needed</span></span></div>
  <p class="stp-desc">${projected ? 'Seeds as they stand today. Semis: the higher seed is twice to beat. Finals: best of 3.' : 'Semis: the higher seed is twice to beat. Finals: best of 3.'}</p>
  <div class="po-bracket__grid${projected ? ' is-projected' : ''}">
    <div class="po-bracket__semis">
      ${semiCard('Semi 1', s1, 1, s4, 4, semi1, projected)}
      ${semiCard('Semi 2', s2, 2, s3, 3, semi2, projected)}
    </div>
    <div class="po-link po-link--fork" aria-hidden="true"></div>
    ${finalsCard}
    <div class="po-link" aria-hidden="true"></div>
    ${champCard}
  </div>
</section>`;

  // Every playoff game, in order, with its round label.
  const rows = [];
  const label = (list, name) => list.filter(isPlayed).forEach((g, i) => rows.push({ g, round: `${name} · G${i + 1}` }));
  label(semi1, 'Semi 1'); label(semi2, 'Semi 2'); label(finalsGames, 'Finals');
  const extra = semiGames.filter(g => isPlayed(g) && !semi1.includes(g) && !semi2.includes(g));
  extra.forEach(g => rows.push({ g, round: 'Semis' }));
  rows.sort((a, b) => String(a.g.date).localeCompare(String(b.g.date)) || (a.round > b.round ? 1 : -1));
  const tableRows = rows.map(({ g, round }) => {
    const aw = Number(g.team_a_score) > Number(g.team_b_score);
    return {
      id: g.id, round, date: g.date, finals: g.game_type === 'finals',
      w: aw ? g.team_a_name : g.team_b_name, l: aw ? g.team_b_name : g.team_a_name,
      ws: Math.max(g.team_a_score, g.team_b_score), ls: Math.min(g.team_a_score, g.team_b_score),
      ot: !!Number(g.overtime), recap: g.recapTitle, potg: g.potgName,
    };
  });

  const pills = seasons.length > 1 ? `<nav class="stp-pills" aria-label="Season">${seasons.map(s => `<a href="/playoffs${String(s) === String(seasons[0]) ? '' : `?season=${encodeURIComponent(s)}`}" class="stp-pill${String(s) === String(season) ? ' is-on' : ''}"${String(s) === String(season) ? ' aria-current="page"' : ''}><span class="pill-label">S${escHtml(String(s))}</span></a>`).join('')}</nav>` : '';

  return `<div class="page-content stp po">
  <div class="stp-head">
    <div class="stp-head__title">
      <span class="stp-kicker">Season ${escHtml(String(season))} · Playoffs</span>
      <h1>Playoffs</h1>
    </div>
    <div class="stp-head__side">
      ${projected && isCurrent && regular.expected ? `<div class="stp-progress">
        <div class="stp-progress__label"><span>Regular season</span><span><b class="font-condensed">${regular.played}</b> of ${regular.expected} games</span></div>
        <div class="stp-progress__bar"><span style="width:${pct}%"></span></div>
      </div>` : ''}
      ${pills}
    </div>
  </div>
  ${hero}
  ${preSummary}
  ${bracket}
  ${gamesTable(tableRows)}
</div>`;
}
