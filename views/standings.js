import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// ── /standings ────────────────────────────────────────────────────────────────
// Race summary → league table (grouped columns) + playoff picture → head to head
// (matchup cards, team filter, 3-team loop callout) → the road so far (one card per week)
// → team stats. `rows` arrives already in seeding order (server.js: computeSeeds, the same
// order as the /playoffs bracket); everything else is derived here from the season's
// completed regular-season games.

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const ord = n => ORD[n - 1] || `${n}th`;

function rgba(hex, a) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return `rgba(255,255,255,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

const winnerOf = g => Number(g.team_a_score) > Number(g.team_b_score)
  ? { id: g.team_a_id, name: g.team_a_name, pts: Number(g.team_a_score), oppId: g.team_b_id, opp: g.team_b_name, oppPts: Number(g.team_b_score) }
  : { id: g.team_b_id, name: g.team_b_name, pts: Number(g.team_b_score), oppId: g.team_a_id, opp: g.team_a_name, oppPts: Number(g.team_a_score) };

const fmtDay = d => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Table order for a set of games: wins, then a two-team tie goes to head-to-head within
// those games, then point quotient — the same rule as computeSeeds. Used for the
// week-by-week tables; the final week is overridden with the real seeding order.
function rankAfter(teams, games) {
  const rec = Object.fromEntries(teams.map(t => [t.id, { id: t.id, w: 0, l: 0, pf: 0, pa: 0 }]));
  for (const g of games) {
    const w = winnerOf(g);
    if (!rec[w.id] || !rec[w.oppId]) continue;
    rec[w.id].w++; rec[w.oppId].l++;
    rec[w.id].pf += w.pts; rec[w.id].pa += w.oppPts;
    rec[w.oppId].pf += w.oppPts; rec[w.oppId].pa += w.pts;
  }
  const q = r => r.pa > 0 ? r.pf / r.pa : 0;
  const order = Object.values(rec).sort((a, b) => b.w - a.w || q(b) - q(a));
  for (let i = 0; i < order.length;) {
    let j = i + 1;
    while (j < order.length && order[j].w === order[i].w) j++;
    if (j - i === 2) {
      const a = order[i], b = order[i + 1];
      let aw = 0, bw = 0;
      for (const g of games) {
        const w = winnerOf(g);
        if (w.id === a.id && w.oppId === b.id) aw++;
        if (w.id === b.id && w.oppId === a.id) bw++;
      }
      if (bw > aw) { order[i] = b; order[i + 1] = a; }
    }
    i = j;
  }
  return order;
}

// One-line story per team: long streaks first, then record vs point differential, then a
// streak that just ended. Same wording as the homepage race tiles where they overlap.
function teamFlag(results, wins, losses, diff) {
  const last = results[results.length - 1];
  let streak = 0;
  for (let k = results.length - 1; k >= 0 && results[k] === last; k--) streak++;
  const prevRun = (() => {
    const before = results.slice(0, results.length - streak);
    const p = before[before.length - 1];
    let n = 0;
    for (let k = before.length - 1; k >= 0 && before[k] === p; k--) n++;
    return { type: p, n };
  })();
  if (streak >= 3) return last === 'W' ? `Won ${streak} straight` : `Lost ${streak} straight`;
  if (wins < losses && diff > 0) return 'Better than their record';
  if (wins > losses && diff < 0) return 'Winning the close ones';
  if (streak === 2) return last === 'W' ? 'Won 2 straight' : 'Lost 2 straight';
  if (streak === 1 && prevRun.n >= 2) return last === 'W' ? `Snapped a ${prevRun.n}-game skid` : `${prevRun.n}-game win streak ended`;
  return '';
}

function weekHeadline(n, wkGames, before, after) {
  if (n === 1) {
    const winners = wkGames.map(g => winnerOf(g).name);
    return winners.length === 2 ? `${winners[0]} and ${winners[1]} open 1-0` : `${winners.join(', ')} open${winners.length === 1 ? 's' : ''} 1-0`;
  }
  const pos = (list, id) => list.findIndex(r => r.id === id) + 1;
  const name = id => after.find(r => r.id === id)?.name || '';
  let move = null;
  for (const r of after) {
    const d = pos(before, r.id) - pos(after, r.id);
    if (Math.abs(d) >= 2 && (!move || Math.abs(d) > Math.abs(move.d))) move = { id: r.id, d };
  }
  if (move) {
    const from = ord(pos(before, move.id)), to = ord(pos(after, move.id));
    return move.d > 0 ? `${name(move.id)} climbs from ${from} to ${to}` : `${name(move.id)} slides from ${from} to ${to}`;
  }
  if (before[0] && after[0] && before[0].id !== after[0].id) return `${name(after[0].id)} takes over first`;
  const byMargin = wkGames.map(winnerOf).sort((a, b) => (b.pts - b.oppPts) - (a.pts - a.oppPts));
  const big = byMargin[0];
  if (big && big.pts - big.oppPts >= 15) return `${big.name} beats ${big.opp} by ${big.pts - big.oppPts}`;
  const close = byMargin[byMargin.length - 1];
  if (close && close.pts - close.oppPts <= 5) return `${close.name} edges ${close.opp} by ${close.pts - close.oppPts}`;
  return big ? `${big.name} beats ${big.opp} by ${big.pts - big.oppPts}` : '';
}

// A 3-team loop where each team won its season series against the next (A>B, B>C, C>A).
function findTriangle(teams, games) {
  const net = {};
  for (const g of games) {
    const w = winnerOf(g);
    const k = `${w.id}|${w.oppId}`, rk = `${w.oppId}|${w.id}`;
    net[k] = (net[k] || 0) + 1; net[rk] = (net[rk] || 0) - 1;
  }
  const beat = (a, b) => (net[`${a}|${b}`] || 0) > 0;
  for (const a of teams) for (const b of teams) for (const c of teams) {
    if (a.id === b.id || b.id === c.id || a.id === c.id) continue;
    if (beat(a.id, b.id) && beat(b.id, c.id) && beat(c.id, a.id)) {
      const score = (x, y) => {
        const g = [...games].reverse().find(g => { const w = winnerOf(g); return w.id === x.id && w.oppId === y.id; });
        return g ? `${winnerOf(g).pts}-${winnerOf(g).oppPts}` : '';
      };
      return { a, b, c, ab: score(a, b), bc: score(b, c), ca: score(c, a) };
    }
  }
  return null;
}

// ── Sections ──────────────────────────────────────────────────────────────────

function pageHead({ season, seasons, isCurrent, week, played, expected }) {
  const pills = seasons.map(s => `<a href="/standings${String(s) === String(seasons[0]) ? '' : `?season=${encodeURIComponent(s)}`}" class="stp-pill${String(s) === String(season) ? ' is-on' : ''}"${String(s) === String(season) ? ' aria-current="page"' : ''}><span class="pill-label">S${escHtml(String(s))}</span></a>`).join('');
  const pct = expected ? Math.min(100, Math.round(played / expected * 100)) : 0;
  return `<div class="stp-head">
  <div class="stp-head__title">
    <span class="stp-kicker">Season ${escHtml(String(season))} · Regular season</span>
    <h1>Standings</h1>
  </div>
  <div class="stp-head__side">
    ${isCurrent && expected ? `<div class="stp-progress">
      <div class="stp-progress__label"><span>After week ${week}</span><span><b class="font-condensed">${played}</b> of ${expected} games</span></div>
      <div class="stp-progress__bar"><span style="width:${pct}%"></span></div>
    </div>` : `<span class="stp-progress__label"><span>${played} games played</span></span>`}
    ${seasons.length > 1 ? `<nav class="stp-pills" aria-label="Season">${pills}</nav>` : ''}
  </div>
</div>`;
}

function raceSummary(summary) {
  if (!summary) return '';
  return `<div class="stp-summary">
  <span class="stp-kicker">${escHtml(summary.kicker)}</span>
  <p class="stp-summary__headline">${summary.headlineHtml}</p>
  ${summary.body ? `<p class="stp-summary__body">${escHtml(summary.body)}</p>` : ''}
</div>`;
}

function leagueTable(table, season, week, isCurrent, notes) {
  const showLine = table.length >= 4;
  const rowsHtml = table.map((t, i) => {
    const form = [...t.form, ...Array(5 - t.form.length).fill('')].map(r => r
      ? `<span class="stp-fd stp-fd--${r}"><span class="pill-label">${r}</span></span>`
      : '<span class="stp-fd stp-fd--none"></span>').join('');
    const formInline = t.form.map(r => `<span class="stp-fd stp-fd--${r}"><span class="pill-label">${r}</span></span>`).join('');
    const diff = t.diff > 0 ? `+${t.diff}` : String(t.diff);
    const leadGlare = i === 0 ? ` style="--glare:${rgba(t.color, 0.1)}"` : '';
    return `<div class="stp-tr">
    <a href="/teams/${encodeURIComponent(t.id)}" class="stp-row${i === 0 ? ' is-leader' : ''}"${leadGlare}>
      <span class="stp-seed font-condensed${i < 2 && showLine ? ' is-top' : ''}">${i + 1}</span>
      <span class="stp-team">
        <span class="stp-team__name"><span class="team-dot" style="background:${t.color}"></span>${escHtml(t.name)}</span>
        <span class="stp-team__flag">${escHtml(t.flag)}</span>
        <span class="stp-team__form" aria-hidden="true">${formInline}<span>${escHtml(t.flag)}</span></span>
      </span>
      <span class="stp-n stp-n--big font-condensed">${t.wins}</span>
      <span class="stp-n stp-n--big stp-n--dim font-condensed">${t.losses}</span>
      <span class="stp-n stp-x font-condensed">${t.pct}</span>
      <span class="stp-n stp-n--dim font-condensed">${t.gb}</span>
      <span class="stp-sep stp-x"></span>
      <span class="stp-n stp-x font-condensed">${t.pfg}</span>
      <span class="stp-n stp-n--dim stp-x font-condensed">${t.pag}</span>
      <span class="stp-n stp-diff font-condensed${t.diff > 0 ? ' is-pos' : t.diff < 0 ? ' is-neg' : ''}">${diff}</span>
      <span class="stp-sep stp-x"></span>
      <span class="stp-form stp-x" aria-label="Last ${t.form.length}: ${t.form.join(' ')}">${form}</span>
      <span class="stp-n stp-strk stp-x font-condensed${t.streak.startsWith('W') ? ' is-w' : ''}">${t.streak || '—'}</span>
    </a>
    ${showLine && i === 1 ? '<div class="stp-line"><span>Twice-to-beat line</span></div>' : ''}
  </div>`;
  }).join('');

  return `<section class="stp-table card" aria-label="League table">
  <div class="stp-scroll">
    <div class="stp-grid">
      <div class="stp-row stp-row--groups" aria-hidden="true">
        <span class="stp-groups__ctx">Season ${escHtml(String(season))} · ${isCurrent && week ? `After week ${week}` : 'Final'}</span>
        <span class="stp-group" style="grid-column:3/7">Record</span>
        <span class="stp-group" style="grid-column:8/11">Scoring</span>
        <span class="stp-group" style="grid-column:12/14">Recent</span>
      </div>
      <div class="stp-row stp-row--head">
        <span class="stp-th stp-c">#</span><span class="stp-th">Team</span>
        <span class="stp-th stp-c">W</span><span class="stp-th stp-c">L</span>
        <abbr class="stp-th stp-c stp-x" title="Win percentage">PCT</abbr>
        <abbr class="stp-th stp-c" title="Games behind the leader">GB</abbr>
        <span class="stp-sep stp-x"></span>
        <abbr class="stp-th stp-c stp-x" title="Points scored per game">PF/G</abbr>
        <abbr class="stp-th stp-c stp-x" title="Points allowed per game">PA/G</abbr>
        <abbr class="stp-th stp-c" title="Total points scored minus allowed">Diff</abbr>
        <span class="stp-sep stp-x"></span>
        <span class="stp-th stp-x">Form</span>
        <abbr class="stp-th stp-c stp-x" title="Current win or loss streak">Strk</abbr>
      </div>
      ${rowsHtml}
    </div>
  </div>
  ${notes.length ? `<div class="stp-table__notes">${notes.map(n => `<span>${escHtml(n)}</span>`).join('')}</div>` : ''}
</section>`;
}

function playoffPicture(table, isCurrent) {
  if (table.length < 4) return '';
  const semi = (label, hi, hiN, lo, loN) => `<div class="stp-semi card">
    <div class="stp-semi__top"><span class="stp-th">${label}</span><span class="stp-semi__adv">Twice to beat</span></div>
    <a href="/teams/${encodeURIComponent(hi.id)}" class="stp-semi__team is-high"><span class="font-condensed stp-semi__seed">${hiN}</span><span class="team-dot" style="background:${hi.color}"></span><span>${escHtml(hi.name)}</span><span class="font-condensed stp-semi__rec">${hi.wins}-${hi.losses}</span></a>
    <a href="/teams/${encodeURIComponent(lo.id)}" class="stp-semi__team"><span class="font-condensed stp-semi__seed">${loN}</span><span class="team-dot" style="background:${lo.color}"></span><span>${escHtml(lo.name)}</span><span class="font-condensed stp-semi__rec">${lo.wins}-${lo.losses}</span></a>
  </div>`;
  return `<section class="stp-playoffs" aria-labelledby="stp-po-h">
  <div class="section-header"><h2 id="stp-po-h">Playoff picture</h2>${isCurrent ? '<a href="/playoffs" class="section-header__link">Bracket <span>&rarr;</span></a>' : ''}</div>
  <p class="stp-desc">${isCurrent ? 'If the season ended today.' : 'Final regular-season seeding.'}</p>
  <div class="stp-playoffs__list">
    ${semi('Semi A', table[0], 1, table[3], 4)}
    ${semi('Semi B', table[1], 2, table[2], 3)}
    <div class="stp-finals"><span>Finals</span><span>Best of 3</span></div>
  </div>
</section>`;
}

function triangleCard(tri) {
  if (!tri) return '';
  const chip = (t, cls) => `<span class="stp-tri__chip ${cls}"><span class="team-dot" style="background:${t.color}"></span><span class="pill-label">${escHtml(t.name)}</span></span>`;
  return `<div class="stp-tri">
    <span class="stp-kicker">The triangle</span>
    <p class="stp-tri__title">Three teams, three different winners.</p>
    <div class="stp-tri__fig" role="img" aria-label="${escHtml(`${tri.a.name} beat ${tri.b.name} ${tri.ab}, ${tri.b.name} beat ${tri.c.name} ${tri.bc}, ${tri.c.name} beat ${tri.a.name} ${tri.ca}`)}">
      <svg viewBox="0 0 240 196" width="240" height="196" aria-hidden="true">
        <defs><marker id="stp-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f59332"/></marker></defs>
        <g stroke="#f59332" stroke-width="2" fill="none" marker-end="url(#stp-ah)" opacity=".85">
          <line x1="140" y1="44" x2="190" y2="140"/><line x1="170" y1="168" x2="72" y2="168"/><line x1="48" y1="140" x2="98" y2="44"/>
        </g>
        <g font-family="Saira Condensed, sans-serif" font-size="14" font-weight="600" fill="#e7eaf0" text-anchor="middle">
          <text x="190" y="88">${escHtml(tri.ab)}</text><text x="120" y="188">${escHtml(tri.bc)}</text><text x="50" y="88">${escHtml(tri.ca)}</text>
        </g>
      </svg>
      ${chip(tri.a, 'is-top')}${chip(tri.b, 'is-right')}${chip(tri.c, 'is-left')}
    </div>
    <p class="stp-tri__note">Arrows point from winner to loser. Each of the three has beaten one of the others and lost to the other.</p>
  </div>`;
}

function headToHead(table, games, colorOf) {
  if (!games.length) return '';
  const margins = games.map(g => { const w = winnerOf(g); return w.pts - w.oppPts; });
  const maxM = Math.max(...margins), minM = Math.min(...margins);
  const series = {};
  for (const g of games) {
    const w = winnerOf(g);
    const k = [w.id, w.oppId].sort().join('|');
    (series[k] ||= {})[w.id] = (series[k][w.id] || 0) + 1;
  }
  const seriesLine = (aId, aName, bId, bName) => {
    const s = series[[aId, bId].sort().join('|')] || {};
    const a = s[aId] || 0, b = s[bId] || 0;
    if (a === b) return `Series tied ${a}-${b}`;
    return a > b ? `${aName} lead the series ${a}-${b}` : `${bName} lead the series ${b}-${a}`;
  };
  const cards = games.map((g, i) => {
    const w = winnerOf(g);
    const m = w.pts - w.oppPts;
    const note = games.length >= 3 && m === maxM ? 'Biggest margin' : games.length >= 3 && m === minM ? 'Closest game' : '';
    return `<a href="/games/${encodeURIComponent(g.id)}" class="stp-mu" data-teams="${escHtml(`${w.id} ${w.oppId}`)}" style="--glare:${rgba(colorOf(w.id), 0.16)}">
      <span class="stp-mu__top"><span class="stp-th">Wk ${g.week} · ${fmtDay(g.date)}</span>${note ? `<span class="stp-mu__note">${note}</span>` : ''}</span>
      <span class="stp-mu__team is-w"><span class="team-dot" style="background:${colorOf(w.id)}"></span><span>${escHtml(w.name)}</span><b class="font-condensed">${w.pts}</b></span>
      <span class="stp-mu__team"><span class="team-dot" style="background:${colorOf(w.oppId)}"></span><span>${escHtml(w.opp)}</span><b class="font-condensed">${w.oppPts}</b></span>
      <span class="stp-mu__foot"><span>${escHtml(seriesLine(w.id, w.name, w.oppId, w.opp))}</span><span class="stp-mu__link">Box score &rarr;</span></span>
    </a>`;
  }).join('');
  const tri = findTriangle(table, games);
  const records = Object.fromEntries(table.map(t => [t.id, `${t.wins}-${t.losses}`]));
  const chips = [`<button type="button" class="stp-chip is-on" data-team="" aria-pressed="true"><span class="pill-label">All</span></button>`]
    .concat(table.map(t => `<button type="button" class="stp-chip" data-team="${escHtml(t.id)}" data-label="${escHtml(`${t.name} vs the field: ${records[t.id]}`)}" aria-pressed="false"><span class="team-dot" style="background:${t.color}"></span><span class="pill-label">${escHtml(t.name)}</span></button>`)).join('');
  const defaultLine = 'Every game this season, newest last. Pick a team to see only its games.';
  return `<section class="stp-h2h" aria-labelledby="stp-h2h-h">
  <div class="section-header"><h2 id="stp-h2h-h">Head to head</h2><a href="/games" class="section-header__link">All games <span>&rarr;</span></a></div>
  <div class="stp-bar">
    <p class="stp-desc" id="stp-h2h-line" data-default="${escHtml(defaultLine)}">${escHtml(defaultLine)}</p>
    <div class="stp-chips" role="group" aria-label="Show games for">${chips}</div>
  </div>
  <div class="stp-h2h__body${tri ? ' has-tri' : ''}">
    ${triangleCard(tri)}
    <div class="stp-mu-grid">${cards}</div>
  </div>
</section>`;
}

function roadSoFar(weeks, next, isCurrent) {
  if (!weeks.length) return '';
  const cards = weeks.map((w, i) => `<div class="stp-wk${i === weeks.length - 1 ? ' is-latest' : ''}">
    <div class="stp-wk__top"><span class="stp-kicker">Week ${w.n}</span><span class="stp-th">${w.dates.length > 1 ? `${fmtDay(w.dates[0])} – ${fmtDay(w.dates[w.dates.length - 1])}` : fmtDay(w.dates[0])}</span></div>
    <p class="stp-wk__head">${escHtml(w.headline)}</p>
    <div class="stp-wk__games">${w.games.map(g => `<a href="/games/${encodeURIComponent(g.id)}" class="stp-wk__game">
      <span class="is-w"><span class="team-dot" style="background:${g.wc}"></span>${escHtml(g.w)}</span>
      <span class="font-condensed"><b>${g.ws}</b> – ${g.ls}</span>
      <span class="is-l">${escHtml(g.l)}<span class="team-dot" style="background:${g.lc}"></span></span>
    </a>`).join('')}</div>
    <span class="stp-th stp-wk__label">Table after week ${w.n}</span>
    <div class="stp-wk__table">${w.table.map((t, k) => `<div class="stp-wk__row">
      <span class="font-condensed stp-wk__rank">${k + 1}</span>
      <span class="stp-wk__name"><span class="team-dot" style="background:${t.color}"></span>${escHtml(t.name)}</span>
      <span class="font-condensed stp-wk__rec">${t.rec}</span>
      <span class="font-condensed stp-wk__mv${t.mv > 0 ? ' is-up' : t.mv < 0 ? ' is-down' : ''}">${w.n === 1 ? '' : t.mv > 0 ? `▲${t.mv}` : t.mv < 0 ? `▼${-t.mv}` : '='}</span>
    </div>`).join('')}</div>
  </div>`).join('');
  const nextCard = !isCurrent || !next ? '' : `<div class="stp-wk stp-wk--next">
    <div class="stp-wk__top"><span class="stp-th">Week ${next.n}</span><span class="stp-th">Up next</span></div>
    ${next.games.length
      ? `<p class="stp-wk__head">${fmtDay(next.date)}</p><div class="stp-wk__games">${next.games.map(g => `<a href="/games/${encodeURIComponent(g.id)}" class="stp-wk__game is-sched">
        <span><span class="team-dot" style="background:${g.ac}"></span>${escHtml(g.a)}</span><span class="stp-th">vs</span><span class="is-l">${escHtml(g.b)}<span class="team-dot" style="background:${g.bc}"></span></span>
      </a>`).join('')}</div>`
      : `<p class="stp-wk__head is-dim">Not scheduled yet</p><p class="stp-wk__note">The next results and table moves show up here.</p>`}
  </div>`;
  return `<section class="stp-road" aria-labelledby="stp-road-h">
  <div class="section-header"><h2 id="stp-road-h">The road so far</h2></div>
  <p class="stp-desc">What each week did to the table.</p>
  <div class="stp-road__grid" id="stp-road">${cards}${nextCard}</div>
</section>`;
}

function teamStats(table, teamStatsRows) {
  if (!teamStatsRows.length) return '';
  const byId = Object.fromEntries(teamStatsRows.map(t => [t.team_id, t]));
  const teams = table.filter(t => byId[t.id]);
  if (!teams.length) return '';
  const CATS = [
    { k: 'PTS', title: 'Points', fn: s => s.pts },
    { k: 'REB', title: 'Rebounds', fn: s => s.reb },
    { k: 'AST', title: 'Assists', fn: s => s.ast },
    { k: 'STL', title: 'Steals', fn: s => s.stl },
    { k: 'BLK', title: 'Blocks', fn: s => s.blk },
    { k: '3PM', title: '3-pointers made', fn: s => s.fg3m },
    { k: 'FG%', title: 'Field goal %', fn: s => s.fga > 0 ? s.fgm / s.fga : 0, pct: true },
    { k: '3P%', title: '3-point %', fn: s => s.fg3a > 0 ? s.fg3m / s.fg3a : 0, pct: true },
    { k: 'FT%', title: 'Free throw %', fn: s => (s.ftm + s.ft_miss) > 0 ? s.ftm / (s.ftm + s.ft_miss) : 0, pct: true },
    { k: 'TO', title: 'Turnovers', fn: s => s.turnover, low: true },
  ];
  const val = (c, s, mode) => { const v = Number(c.fn(s)) || 0; return c.pct || mode === 'tot' ? v : (s.gp > 0 ? v / s.gp : 0); };
  const fmt = (c, v, mode) => c.pct ? `${(v * 100).toFixed(1)}%` : mode === 'tot' ? String(Math.round(v)) : v.toFixed(1);
  const best = (c, mode) => { const vs = teams.map(t => val(c, byId[t.id], mode)); return c.low ? Math.min(...vs) : Math.max(...vs); };
  const cell = (c, t, mode) => { const v = val(c, byId[t.id], mode); return `<span class="stp-ts__v stp-ts__v--${mode}${v === best(c, mode) ? ' is-best' : ''}">${fmt(c, v, mode)}</span>`; };

  const tableHtml = `<div class="stp-ts card"><div class="stp-scroll"><div class="stp-ts__grid">
    <div class="stp-ts__row stp-ts__row--head"><span class="stp-th">Team</span>${CATS.map(c => `<abbr class="stp-th stp-c" title="${escHtml(c.title)}">${c.k}</abbr>`).join('')}</div>
    ${teams.map(t => `<div class="stp-ts__row"><span class="stp-ts__team"><span class="team-dot" style="background:${t.color}"></span>${escHtml(t.name)}</span>${CATS.map(c => `<span class="stp-c font-condensed">${cell(c, t, 'pg')}${cell(c, t, 'tot')}</span>`).join('')}</div>`).join('')}
  </div></div></div>`;

  // Phone: one category at a time as bars, picked from a chip row.
  const barsHtml = `<div class="stp-tsm card">
    <div class="stp-chips stp-chips--scroll" role="group" aria-label="Stat category">${CATS.map((c, i) => `<button type="button" class="stp-chip${i === 0 ? ' is-on' : ''}" data-cat="${i}" aria-pressed="${i === 0}"><span class="pill-label">${c.k}</span></button>`).join('')}</div>
    ${CATS.map((c, i) => `<div class="stp-tsm__cat" data-cat="${i}"${i === 0 ? '' : ' hidden'}>
      ${['pg', 'tot'].map(mode => {
        const vals = teams.map(t => ({ t, v: val(c, byId[t.id], mode) })).sort((a, b) => c.low ? a.v - b.v : b.v - a.v);
        const max = Math.max(...vals.map(x => x.v)) || 1;
        const b = best(c, mode);
        return `<div class="stp-tsm__set stp-ts__v--${mode}">
          <span class="stp-tsm__title">${escHtml(c.title)}${c.pct ? '' : mode === 'pg' ? ' per game' : ', season total'}${c.low ? ' (fewest is best)' : ''}</span>
          ${vals.map(x => `<div class="stp-tsm__bar${x.v === b ? ' is-best' : ''}">
            <span class="stp-tsm__name"><span class="team-dot" style="background:${x.t.color}"></span>${escHtml(x.t.name)}</span>
            <span class="stp-tsm__track"><span style="width:${Math.round(x.v / max * 100)}%"></span></span>
            <span class="font-condensed stp-tsm__val">${fmt(c, x.v, mode)}</span>
          </div>`).join('')}
        </div>`;
      }).join('')}
    </div>`).join('')}
  </div>`;

  return `<section class="stp-stats" data-mode="pg" aria-labelledby="stp-ts-h">
  <div class="section-header"><h2 id="stp-ts-h">Team stats</h2><a href="/leaders" class="section-header__link">League leaders <span>&rarr;</span></a></div>
  <div class="stp-bar">
    <p class="stp-desc">League best in each column is in amber. For turnovers, fewest is best.</p>
    <div class="stp-chips" role="group" aria-label="Stat mode">
      <button type="button" class="stp-chip is-on" data-mode="pg" aria-pressed="true"><span class="pill-label">Per game</span></button>
      <button type="button" class="stp-chip" data-mode="tot" aria-pressed="false"><span class="pill-label">Totals</span></button>
    </div>
  </div>
  ${tableHtml}
  ${barsHtml}
</section>`;
}

const SCRIPT = `<script>
(function(){
  var h2h=document.querySelector('.stp-h2h');
  if(h2h){
    var line=document.getElementById('stp-h2h-line');
    h2h.querySelectorAll('.stp-chip[data-team]').forEach(function(b){
      b.addEventListener('click',function(){
        var id=b.getAttribute('data-team');
        h2h.querySelectorAll('.stp-chip[data-team]').forEach(function(x){var on=x===b;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});
        h2h.querySelectorAll('.stp-mu').forEach(function(m){m.classList.toggle('is-faded',!!id&&(' '+m.getAttribute('data-teams')+' ').indexOf(' '+id+' ')<0);});
        line.textContent=id?b.getAttribute('data-label'):line.getAttribute('data-default');
      });
    });
  }
  var st=document.querySelector('.stp-stats');
  if(st){
    st.querySelectorAll('.stp-chip[data-mode]').forEach(function(b){
      b.addEventListener('click',function(){
        st.setAttribute('data-mode',b.getAttribute('data-mode'));
        st.querySelectorAll('.stp-chip[data-mode]').forEach(function(x){var on=x===b;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});
      });
    });
    st.querySelectorAll('.stp-chip[data-cat]').forEach(function(b){
      b.addEventListener('click',function(){
        var c=b.getAttribute('data-cat');
        st.querySelectorAll('.stp-chip[data-cat]').forEach(function(x){var on=x===b;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});
        st.querySelectorAll('.stp-tsm__cat').forEach(function(x){x.hidden=x.getAttribute('data-cat')!==c;});
      });
    });
  }
  var road=document.getElementById('stp-road');
  var latest=road&&road.querySelector('.stp-wk.is-latest');
  if(latest&&road.scrollWidth>road.clientWidth)road.scrollLeft=latest.offsetLeft-road.offsetLeft-parseFloat(getComputedStyle(road).paddingLeft||0);
})();
</script>`;

// ── Main export ───────────────────────────────────────────────────────────────
// rows:       getSeasonStandings rows in seeding order ({ id, name, wins, losses, pf, pa, point_diff })
// games:      the season's completed regular-season games, not under review
// scheduled:  the season's scheduled (unplayed) regular-season games
// summary:    { kicker, headlineHtml, body } or null
export function standingsPage({ season, seasons = [], isCurrent = true, rows = [], games = [], scheduled = [], teamStats: teamStatsRows = [], summary = null }) {
  const played = [...games].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const colorOf = id => teamColor(rows.find(r => r.id === id)?.name);

  // Weeks = game weekends: a game more than 3 days after the current week's first game
  // day starts a new week (so a Sunday + Monday pair stays one week).
  const DAY = 86400000;
  const weekDates = [];
  for (const g of played) {
    const d = String(g.date).slice(0, 10);
    const cur = weekDates[weekDates.length - 1];
    if (!cur || (new Date(d) - new Date(cur[0])) / DAY > 3) weekDates.push([d]);
    else if (!cur.includes(d)) cur.push(d);
    g.week = weekDates.length;
  }
  const week = weekDates.length;

  const results = {};
  for (const g of played) {
    const w = winnerOf(g);
    (results[w.id] ||= []).push('W');
    (results[w.oppId] ||= []).push('L');
  }
  const leader = rows[0];
  const table = rows.map(r => {
    const gp = r.wins + r.losses;
    const res = results[r.id] || [];
    const last = res[res.length - 1];
    let streak = 0;
    for (let k = res.length - 1; k >= 0 && res[k] === last; k--) streak++;
    const gb = leader ? ((leader.wins - r.wins) + (r.losses - leader.losses)) / 2 : 0;
    return {
      id: r.id, name: r.name, color: teamColor(r.name), wins: r.wins, losses: r.losses,
      pct: gp ? (r.wins / gp).toFixed(3).replace(/^0/, '') : '.000',
      gb: gb === 0 ? '—' : gb.toFixed(1),
      pfg: gp ? (r.pf / gp).toFixed(1) : '0.0', pag: gp ? (r.pa / gp).toFixed(1) : '0.0',
      diff: Number(r.point_diff) || 0, quo: r.pa > 0 ? r.pf / r.pa : 0,
      form: res.slice(-5), streak: last ? `${last}${streak}` : '',
      flag: teamFlag(res, r.wins, r.losses, Number(r.point_diff) || 0),
    };
  });

  // Footnotes for ties: 3+ teams level → quotient; 2 teams level → head-to-head or quotient.
  const notes = [];
  for (let i = 0; i < table.length;) {
    let j = i + 1;
    while (j < table.length && table[j].wins === table[i].wins && table[j].losses === table[i].losses) j++;
    const group = table.slice(i, j);
    if (group.length >= 3 && group[0].wins + group[0].losses > 0) {
      notes.push(`${group.map(t => t.name).join(', ')}: ${group.length}-way tie at ${group[0].wins}-${group[0].losses}, ordered by quotient (${group.map(t => t.quo.toFixed(3).replace(/^0/, '')).join(' · ')})`);
    } else if (group.length === 2 && group[0].wins + group[0].losses > 0) {
      const [a, b] = group;
      let aw = 0, bw = 0;
      for (const g of played) { const w = winnerOf(g); if (w.id === a.id && w.oppId === b.id) aw++; if (w.id === b.id && w.oppId === a.id) bw++; }
      notes.push(aw !== bw ? `${a.name} ahead of ${b.name} on head-to-head (${aw}-${bw})` : `${a.name} ahead of ${b.name} on quotient (${a.quo.toFixed(4)} vs ${b.quo.toFixed(4)})`);
    }
    i = j;
  }

  // Week-by-week tables and headlines.
  const teamsBase = rows.map(r => ({ id: r.id, name: r.name }));
  let prev = null;
  const weeks = weekDates.map((dates, idx) => {
    const upTo = played.filter(g => g.week <= idx + 1);
    const wkGames = played.filter(g => g.week === idx + 1);
    let after = rankAfter(teamsBase, upTo).map(r => ({ ...r, name: rows.find(x => x.id === r.id)?.name || '' }));
    if (idx === weekDates.length - 1) after = rows.map(r => ({ id: r.id, name: r.name, w: r.wins, l: r.losses }));
    const wk = {
      n: idx + 1, dates,
      headline: weekHeadline(idx + 1, wkGames, prev || after, after),
      games: wkGames.map(g => { const w = winnerOf(g); return { id: g.id, w: w.name, wc: colorOf(w.id), ws: w.pts, l: w.opp, lc: colorOf(w.oppId), ls: w.oppPts }; }),
      table: after.map((r, k) => ({ name: r.name, color: teamColor(r.name), rec: `${r.w}-${r.l}`, mv: prev ? (prev.findIndex(p => p.id === r.id) + 1) - (k + 1) : 0 })),
    };
    prev = after;
    return wk;
  });

  const sched = [...scheduled].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const nextDay = sched[0] ? String(sched[0].date).slice(0, 10) : null;
  const expected = Math.max(played.length + sched.length, rows.length * (rows.length - 1));
  const next = played.length < expected ? {
    n: week + 1, date: nextDay,
    games: nextDay ? sched.filter(g => String(g.date).slice(0, 10) === nextDay).map(g => ({ id: g.id, a: g.team_a_name, ac: colorOf(g.team_a_id), b: g.team_b_name, bc: colorOf(g.team_b_id) })) : [],
  } : null;

  return `<div class="page-content stp">
  ${pageHead({ season, seasons, isCurrent, week, played: played.length, expected })}
  ${raceSummary(summary)}
  ${table.length ? `<div class="stp-top">
    ${leagueTable(table, season, week, isCurrent, notes)}
    ${playoffPicture(table, isCurrent)}
  </div>` : '<p class="stp-desc">No standings for this season yet.</p>'}
  ${headToHead(table, played, colorOf)}
  ${roadSoFar(weeks, next, isCurrent)}
  ${teamStats(table, teamStatsRows)}
</div>
${SCRIPT}`;
}
