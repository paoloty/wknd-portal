import { escHtml } from './layout.js';
import { teamColor, formatPlayerName, initials, boldTitle } from './utils.js';
import { scoreTicker } from './home.js';

function youtubeEmbedUrl(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

// ── Left-column media (YouTube → cover fallback → nothing) ───────────────────
function leftMedia(game, colorA, colorB) {
  const embedUrl = youtubeEmbedUrl(game.youtube_url);
  if (embedUrl) {
    return `<div class="sidebar-hero sidebar-hero--video">
  <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="sidebar-hero__iframe"></iframe>
</div>`;
  }
  if (game.has_cover) {
    return `<div class="sidebar-hero">
  <div class="sidebar-hero__bg"><img src="/api/cover/${encodeURIComponent(game.id)}" alt=""></div>
  <div class="sidebar-hero__flare" style="background:linear-gradient(135deg,${colorA}44 0%,transparent 50%,${colorB}44 100%)"></div>
</div>`;
  }
  return '';
}

// ── Score card ────────────────────────────────────────────────────────────────
function scoreCard(game, colorA, colorB) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winA = scoreA > scoreB;
  const winB = scoreB > scoreA;

  return `<div class="game-score-card" style="background:linear-gradient(135deg,${colorA}55 0%,var(--surface) 50%,${colorB}55 100%)">
  <div class="game-score-card__board">
    <div class="game-score-card__team">
      <div class="game-score-card__team-name${winA ? ' game-score-card__team-name--winner' : ''}">${escHtml(game.team_a_name)}</div>
      <div class="font-condensed game-score-card__pts${winA ? ' game-score-card__pts--winner' : ''}">${scoreA}</div>
    </div>
    <div class="game-score-card__divider">
      <div class="game-score-card__divider-line"></div>
      <span class="game-score-card__divider-label">FINAL</span>
      <div class="game-score-card__divider-line"></div>
    </div>
    <div class="game-score-card__team">
      <div class="game-score-card__team-name${winB ? ' game-score-card__team-name--winner' : ''}">${escHtml(game.team_b_name)}</div>
      <div class="font-condensed game-score-card__pts${winB ? ' game-score-card__pts--winner' : ''}">${scoreB}</div>
    </div>
  </div>
</div>`;
}

// ── Game Recap tab ────────────────────────────────────────────────────────────
function recapTab(game) {
  const title = boldTitle(game.game_writeup);
  const body = String(game.game_writeup || '').replace(/\*\*[^*]+\*\*/, '').trim();
  if (!title && !body) {
    return `<p class="tabs-empty">No recap available yet.</p>`;
  }
  return `<div class="recap-tab">
  ${title ? `<h2 class="recap-tab__title">${escHtml(title)}</h2>` : ''}
  ${body ? `<p class="recap-tab__body">${escHtml(body)}</p>` : ''}
</div>`;
}

// ── Box Score tab ─────────────────────────────────────────────────────────────
function minToSecs(m) {
  const p = String(m || '0:00').split(':');
  return Number(p[0]) * 60 + Number(p[1] || 0);
}

function fgStr(made, miss) { return made + miss === 0 ? '-' : `${made}/${made + miss}`; }
function statOrDash(val) { return Number(val) > 0 ? val : '-'; }
function calcPer(p) {
  const fgm = Number(p.fg2m) + Number(p.fg3m);
  const fga = fgm + Number(p.fg2m_miss) + Number(p.fg3m_miss);
  const ftm = Number(p.ftm), fta = ftm + Number(p.ft_miss);
  return (
    Number(p.pts) + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
    0.7 * Number(p.reb) + Number(p.stl) + 0.7 * Number(p.ast) +
    0.7 * Number(p.blk) - Number(p.turnover)
  ).toFixed(1);
}

function lineScore(game, quarterScores = []) {
  const totalA = Number(game.team_a_score);
  const totalB = Number(game.team_b_score);

  // Index provided scores by quarter
  const byQ = {};
  for (const s of quarterScores) {
    if (s.a !== null) byQ[s.quarter] = { a: s.a, b: s.b };
  }

  const maxQ = Math.max(4, ...quarterScores.map(s => s.quarter), 0);

  const cols = Array.from({ length: maxQ }, (_, i) => {
    const q = i + 1;
    const label = q <= 4 ? `Q${q}` : `OT${q - 4}`;
    return { label, a: byQ[q]?.a ?? '–', b: byQ[q]?.b ?? '–' };
  });

  const qHeaders = cols.map(c => `<th>${c.label}</th>`).join('');
  const qA = cols.map(c => `<td>${c.a}</td>`).join('');
  const qB = cols.map(c => `<td>${c.b}</td>`).join('');

  return `<div class="ls-wrap">
  <table class="ls-table">
    <thead><tr><th class="ls-name"></th>${qHeaders}<th class="ls-total">T</th></tr></thead>
    <tbody>
      <tr><td class="ls-name">${escHtml(game.team_a_name)}</td>${qA}<td class="ls-total">${totalA}</td></tr>
      <tr><td class="ls-name">${escHtml(game.team_b_name)}</td>${qB}<td class="ls-total">${totalB}</td></tr>
    </tbody>
  </table>
</div>`;
}

function teamBoxScore(players, teamName, isWinner, dnpPlayers = []) {
  const color = teamColor(teamName);
  const sorted = [...players].sort((a, b) => minToSecs(b.minutes) - minToSecs(a.minutes));

  const sum = (key) => sorted.reduce((s, p) => s + Number(p[key] || 0), 0);
  const tot = {
    pts: sum('pts'), reb: sum('reb'), ast: sum('ast'),
    stl: sum('stl'), blk: sum('blk'), turnover: sum('turnover'),
    fg2m: sum('fg2m'), fg3m: sum('fg3m'),
    fg2m_miss: sum('fg2m_miss'), fg3m_miss: sum('fg3m_miss'),
    ftm: sum('ftm'), ft_miss: sum('ft_miss'),
  };

  const playerRow = (p) => {
    const fgm = Number(p.fg2m) + Number(p.fg3m);
    const fgMiss = Number(p.fg2m_miss) + Number(p.fg3m_miss);
    return `<tr>
      <td class="bs-name">${escHtml(formatPlayerName(p.name || ''))}</td>
      <td>${fgStr(fgm, fgMiss)}</td>
      <td>${fgStr(Number(p.fg3m), Number(p.fg3m_miss))}</td>
      <td>${fgStr(Number(p.ftm), Number(p.ft_miss))}</td>
      <td>${statOrDash(p.reb)}</td>
      <td>${statOrDash(p.ast)}</td>
      <td>${statOrDash(p.stl)}</td>
      <td>${statOrDash(p.blk)}</td>
      <td>${statOrDash(p.turnover)}</td>
      <td class="bs-pts">${statOrDash(p.pts)}</td>
      <td class="bs-per">${calcPer(p)}</td>
    </tr>`;
  };

  const totFgm = tot.fg2m + tot.fg3m;
  const totFgMiss = tot.fg2m_miss + tot.fg3m_miss;

  return `<div class="bs-block">
  <div class="bs-team-header" style="border-left-color:${color}">
    ${escHtml(teamName)}${isWinner ? ' <span class="bs-win-badge">W</span>' : ''}
  </div>
  <div class="bs-scroll">
    <table class="bs-table">
      <thead>
        <tr>
          <th class="bs-name">PLAYER</th>
          <th>FG</th>
          <th>3PT</th>
          <th>FT</th>
          <th>REB</th>
          <th>AST</th>
          <th>STL</th>
          <th>BLK</th>
          <th>TO</th>
          <th class="bs-pts">PTS</th>
          <th class="bs-per">PER</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(playerRow).join('')}
        ${dnpPlayers.map(name => `<tr class="bs-dnp">
          <td class="bs-dnp__cell" colspan="11">
            ${escHtml(name)} <span class="dnp-pill">DNP</span>
          </td>
        </tr>`).join('')}
        <tr class="bs-totals">
          <td class="bs-name">TEAM</td>
          <td>${fgStr(totFgm, totFgMiss)}</td>
          <td>${fgStr(tot.fg3m, tot.fg3m_miss)}</td>
          <td>${fgStr(tot.ftm, tot.ft_miss)}</td>
          <td>${tot.reb}</td>
          <td>${tot.ast}</td>
          <td>${tot.stl}</td>
          <td>${tot.blk}</td>
          <td>${tot.turnover}</td>
          <td class="bs-pts">${tot.pts}</td>
          <td class="bs-per">-</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;
}

function buildBoxScoreData(game, stats, playerMap, teamMap) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winnerName = scoreA >= scoreB ? game.team_a_name : game.team_b_name;

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const dnpByTeam = {};
  let dnpIds;
  try { dnpIds = JSON.parse(String(game.dnp_players_json || '[]')); } catch { dnpIds = []; }
  for (const pid of dnpIds) {
    const p = playerMap[pid];
    if (!p) continue;
    const t = teamMap[p.team_id];
    const teamName = String(t?.name || '').toUpperCase();
    if (!dnpByTeam[teamName]) dnpByTeam[teamName] = [];
    dnpByTeam[teamName].push(formatPlayerName(p.name || ''));
  }

  const winner = winnerName.toUpperCase();
  return { byTeam, dnpByTeam, winner };
}

function teamBoxScoreTab(teamName, byTeam, dnpByTeam, winner) {
  const n = teamName.toUpperCase();
  const players = byTeam[n] || [];
  return `<div class="boxscore-tab">
  ${teamBoxScore(players, n, n === winner, dnpByTeam[n] || [])}
</div>`;
}

// ── Line scores tab ───────────────────────────────────────────────────────────
function lineScoreTab(game, quarterScores) {
  return lineScore(game, quarterScores) || `<p class="tabs-empty">No quarter data available.</p>`;
}

// ── Game Leaders tab ──────────────────────────────────────────────────────────
function gameLeadersTab(game, stats) {
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const top = (teamName, key) => {
    const pl = byTeam[teamName] || [];
    if (!pl.length) return { value: 0, players: [] };
    const maxVal = Math.max(...pl.map(p => Number(p[key] || 0)));
    if (maxVal === 0) return { value: 0, players: [] };
    const tied = pl.filter(p => Number(p[key] || 0) === maxVal).slice(0, 3);
    return { value: maxVal, players: tied };
  };

  const avatar = (p, color) =>
    `<div class="ldr-avatar" style="border-color:${color}"><span>${escHtml(initials(p.name || ''))}</span></div>`;

  const playerGroup = (leader, color, isA) => {
    if (!leader.players.length) return '';
    const avGroup = `<div class="ldr-avatars">${leader.players.map(p => avatar(p, color)).join('')}</div>`;
    const joined = leader.players.map(p => formatPlayerName(p.name || '').toUpperCase()).join(', ');
    const nameEl = `<span class="ldr-name">${escHtml(joined)}</span>`;
    return `<div class="ldr-player">${isA ? nameEl + avGroup : avGroup + nameEl}</div>`;
  };

  const CATS = [
    { label: 'PTS', key: 'pts' },
    { label: 'REB', key: 'reb' },
    { label: 'AST', key: 'ast' },
    { label: 'STL', key: 'stl' },
    { label: 'BLK', key: 'blk' },
    { label: 'TO',  key: 'turnover' },
  ];

  const rows = CATS.map(cat => {
    const lA = top(nameA, cat.key);
    const lB = top(nameB, cat.key);
    if (!lA.value && !lB.value) return '';
    const total = lA.value + lB.value;
    const wA = total > 0 ? (lA.value / total * 100).toFixed(1) : 50;
    const wB = total > 0 ? (lB.value / total * 100).toFixed(1) : 50;
    const bg = `linear-gradient(to right, ${colorA}0d ${wA}%, ${colorB}0d ${wA}%)`;
    return `<div class="ldr-row">
  <div class="ldr-col ldr-col--a">
    ${playerGroup(lA, colorA, true)}
  </div>
  <div class="ldr-center">
    <span class="ldr-val${!lA.players.length ? ' ldr-val--empty' : ''}">${lA.value || '–'}</span>
    <span class="ldr-cat">${escHtml(cat.label)}</span>
    <span class="ldr-val${!lB.players.length ? ' ldr-val--empty' : ''}">${lB.value || '–'}</span>
  </div>
  <div class="ldr-col ldr-col--b">
    ${playerGroup(lB, colorB, false)}
  </div>
  <div class="comp-bars">
    <div class="comp-bars__half comp-bars__half--a"><div class="comp-bar" style="width:${wA}%;background:${colorA}"></div></div>
    <div class="comp-bars__half comp-bars__half--b"><div class="comp-bar" style="width:${wB}%;background:${colorB}"></div></div>
  </div>
</div>`;
  }).filter(Boolean).join('');

  return `<div class="ldr-tab">
  <div class="comp-head">
    <span class="comp-head__label">GAME LEADERS</span>
    <span class="comp-head__sub">Top performer per team</span>
  </div>
  <div class="comp-teams">
    <div class="comp-team-name" style="color:${colorA}">${escHtml(nameA)}</div>
    <div class="comp-team-label">STAT</div>
    <div class="comp-team-name comp-team-name--b" style="color:${colorB}">${escHtml(nameB)}</div>
  </div>
  ${rows}
</div>`;
}

// ── Team Comparison tab ───────────────────────────────────────────────────────
function teamComparisonTab(game, stats) {
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const byTeam = {};
  for (const s of stats) {
    const n = String(s.team_name || '').toUpperCase();
    if (!byTeam[n]) byTeam[n] = [];
    byTeam[n].push(s);
  }

  const sum = (players, key) => players.reduce((t, p) => t + Number(p[key] || 0), 0);
  const pct = (made, att) => att > 0 ? (made / att * 100).toFixed(1) + '%' : '—';
  const ma = (made, att) => att > 0 ? `${made}/${att}` : '—';

  const totals = (name) => {
    const pl = byTeam[name] || [];
    const fg2m = sum(pl,'fg2m'), fg3m = sum(pl,'fg3m');
    const fg2miss = sum(pl,'fg2m_miss'), fg3miss = sum(pl,'fg3m_miss');
    const fgm = fg2m+fg3m, fgatt = fgm+fg2miss+fg3miss;
    const ftm = sum(pl,'ftm'), ftatt = ftm+sum(pl,'ft_miss');
    const threeatt = fg3m+fg3miss;
    return { pts: sum(pl,'pts'), reb: sum(pl,'reb'), ast: sum(pl,'ast'), stl: sum(pl,'stl'),
             blk: sum(pl,'blk'), to: sum(pl,'turnover'), pf: sum(pl,'pf'),
             fgm, fgatt, fg3m, threeatt, ftm, ftatt };
  };

  const tA = totals(nameA), tB = totals(nameB);

  const rows = [
    { label: 'PTS',  dA: tA.pts,                    dB: tB.pts,                    cA: tA.pts,  cB: tB.pts },
    { label: 'FG',   dA: ma(tA.fgm,tA.fgatt),       dB: ma(tB.fgm,tB.fgatt),       cA: tA.fgm,  cB: tB.fgm },
    { label: 'FG%',  dA: pct(tA.fgm,tA.fgatt),      dB: pct(tB.fgm,tB.fgatt),      cA: tA.fgatt>0?tA.fgm/tA.fgatt*100:0, cB: tB.fgatt>0?tB.fgm/tB.fgatt*100:0 },
    { label: '3PT',  dA: ma(tA.fg3m,tA.threeatt),   dB: ma(tB.fg3m,tB.threeatt),   cA: tA.fg3m, cB: tB.fg3m },
    { label: '3P%',  dA: pct(tA.fg3m,tA.threeatt),  dB: pct(tB.fg3m,tB.threeatt),  cA: tA.threeatt>0?tA.fg3m/tA.threeatt*100:0, cB: tB.threeatt>0?tB.fg3m/tB.threeatt*100:0 },
    { label: 'FT',   dA: ma(tA.ftm,tA.ftatt),       dB: ma(tB.ftm,tB.ftatt),       cA: tA.ftm,  cB: tB.ftm },
    { label: 'REB',  dA: tA.reb,                    dB: tB.reb,                    cA: tA.reb,  cB: tB.reb },
    { label: 'AST',  dA: tA.ast,                    dB: tB.ast,                    cA: tA.ast,  cB: tB.ast },
    { label: 'STL',  dA: tA.stl,                    dB: tB.stl,                    cA: tA.stl,  cB: tB.stl },
    { label: 'BLK',  dA: tA.blk,                    dB: tB.blk,                    cA: tA.blk,  cB: tB.blk },
    { label: 'TO',   dA: tA.to,                     dB: tB.to,                     cA: tA.to,   cB: tB.to },
    { label: 'PF',   dA: tA.pf,                     dB: tB.pf,                     cA: tA.pf,   cB: tB.pf },
  ];

  const rowsHtml = rows.map(r => {
    const total = r.cA + r.cB;
    const wA = total > 0 ? (r.cA / total * 100).toFixed(1) : 50;
    const wB = total > 0 ? (r.cB / total * 100).toFixed(1) : 50;
    const bg = `linear-gradient(to right, ${colorA}0d ${wA}%, ${colorB}0d ${wA}%)`;
    return `<div class="comp-row">
  <div class="comp-val">${r.dA}</div>
  <div class="comp-label">${escHtml(r.label)}</div>
  <div class="comp-val comp-val--b">${r.dB}</div>
  <div class="comp-bars">
    <div class="comp-bars__half comp-bars__half--a"><div class="comp-bar" style="width:${wA}%;background:${colorA}"></div></div>
    <div class="comp-bars__half comp-bars__half--b"><div class="comp-bar" style="width:${wB}%;background:${colorB}"></div></div>
  </div>
</div>`;
  }).join('');

  return `<div class="comp-tab">
  <div class="comp-head">
    <span class="comp-head__label">TEAM TOTAL COMPARISON</span>
    <span class="comp-head__sub">All totals for this game</span>
  </div>
  <div class="comp-teams">
    <div class="comp-team-name" style="color:${colorA}">${escHtml(nameA)}</div>
    <div class="comp-team-label">STAT</div>
    <div class="comp-team-name comp-team-name--b" style="color:${colorB}">${escHtml(nameB)}</div>
  </div>
  ${rowsHtml}
</div>`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function gameTabs(game, stats, quarterScores, playerMap, teamMap) {
  const { byTeam, dnpByTeam, winner } = buildBoxScoreData(game, stats, playerMap, teamMap);
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();
  const tabIdA = 'bs-' + nameA.replace(/\s+/g, '-');
  const tabIdB = 'bs-' + nameB.replace(/\s+/g, '-');

  return `<div class="card game-tabs">
  <div class="game-tabs__nav">
    <button class="game-tabs__tab game-tabs__tab--active" data-tab="recap">Recap</button>
    <button class="game-tabs__tab" data-tab="${tabIdA}">${escHtml(nameA)}${nameA === winner ? ' <span class="tab-win-dot"></span>' : ''}</button>
    <button class="game-tabs__tab" data-tab="${tabIdB}">${escHtml(nameB)}${nameB === winner ? ' <span class="tab-win-dot"></span>' : ''}</button>
    <button class="game-tabs__tab" data-tab="leaders">Leaders</button>
    <button class="game-tabs__tab" data-tab="comparison">Team Comparison</button>
    <button class="game-tabs__tab" data-tab="linescore">Line Score</button>
  </div>
  <div id="tab-recap" class="game-tabs__body">${recapTab(game)}</div>
  <div id="tab-${tabIdA}" class="game-tabs__body game-tabs__body--hidden">${teamBoxScoreTab(nameA, byTeam, dnpByTeam, winner)}</div>
  <div id="tab-${tabIdB}" class="game-tabs__body game-tabs__body--hidden">${teamBoxScoreTab(nameB, byTeam, dnpByTeam, winner)}</div>
  <div id="tab-leaders" class="game-tabs__body game-tabs__body--hidden">${gameLeadersTab(game, stats)}</div>
  <div id="tab-comparison" class="game-tabs__body game-tabs__body--hidden">${teamComparisonTab(game, stats)}</div>
  <div id="tab-linescore" class="game-tabs__body game-tabs__body--hidden">${lineScoreTab(game, quarterScores)}</div>
</div>
<script>
(function(){
  var nav = document.querySelector('.game-tabs__nav');
  nav.addEventListener('click', function(e){
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    document.querySelectorAll('.game-tabs__tab').forEach(function(b){ b.classList.remove('game-tabs__tab--active'); });
    document.querySelectorAll('.game-tabs__body').forEach(function(b){ b.classList.add('game-tabs__body--hidden'); });
    btn.classList.add('game-tabs__tab--active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('game-tabs__body--hidden');
  });
})();
</script>`;
}

// ── POTG card ─────────────────────────────────────────────────────────────────
function potgCard(stat, writeup) {
  if (!stat) return '';
  const teamName = String(stat.team_name || '').toUpperCase();
  const color = teamColor(teamName);
  const isLight = teamName === 'WHITE';
  const displayName = formatPlayerName(stat.name || '').toUpperCase();
  const cleanWriteup = String(writeup || '').replace(/\*\*/g, '').trim();

  const statDefs = [
    { val: Number(stat.pts), lbl: 'PTS' },
    { val: Number(stat.reb), lbl: 'REB' },
    { val: Number(stat.ast), lbl: 'AST' },
    { val: Number(stat.stl), lbl: 'STL' },
    { val: Number(stat.blk), lbl: 'BLK' },
  ].filter(s => s.val > 0);

  const statCells = statDefs.map(s => `<div class="potg-card__stat">
      <span class="font-condensed potg-card__stat-val">${s.val}</span>
      <span class="potg-card__stat-lbl">${s.lbl}</span>
    </div>`).join('');

  return `<div class="card potg-card">
  <div class="potg-card__label">PLAYER OF THE GAME</div>
  <div class="potg-card__player">
    <div class="potg-card__avatar" style="border-color:${color}">
      <span class="font-condensed">${escHtml(initials(stat.name))}</span>
    </div>
    <div class="potg-card__info">
      <div class="potg-card__name">${escHtml(displayName)}</div>
      <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
    </div>
  </div>
  <div class="potg-card__statline">${statCells}</div>
  ${cleanWriteup ? `<p class="potg-card__writeup">${escHtml(cleanWriteup)}</p>` : ''}
</div>`;
}

// ── Top performers ────────────────────────────────────────────────────────────
function topPerformers(stats, potgPlayerId) {
  const others = stats.filter(s => s.player_id !== potgPlayerId).slice(0, 6);
  if (!others.length) return '';

  const rows = others.map(s => {
    const teamName = String(s.team_name || '').toUpperCase();
    const color = teamColor(teamName);

    const extras = [
      { val: Number(s.reb), lbl: 'REB' },
      { val: Number(s.ast), lbl: 'AST' },
      { val: Number(s.stl), lbl: 'STL' },
      { val: Number(s.blk), lbl: 'BLK' },
    ].filter(x => x.val > 0).slice(0, 2);
    const statLine = [{ val: Number(s.pts), lbl: 'PTS' }, ...extras]
      .map(x => `${x.val} ${x.lbl}`).join(' · ');

    return `<div class="performer-row">
  <div class="performer-row__left">
    <span class="team-dot" style="background:${color}"></span>
    <span class="performer-row__name">${escHtml(formatPlayerName(s.name || '').toUpperCase())}</span>
  </div>
  <span class="performer-row__line">${escHtml(statLine)}</span>
</div>`;
  });

  return `<div class="card top-performers">
  <div class="top-performers__header">TOP PERFORMERS</div>
  <div class="top-performers__list">
    ${rows.join('\n    ')}
  </div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function gamePage({ game, stats, potgPlayerId, quarterScores = [], completedGames = [], playerMap = {}, teamMap = {} }) {
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);
  const potgStat = potgPlayerId ? stats.find(s => s.player_id === potgPlayerId) : null;

  return `${scoreTicker(completedGames)}
<div class="game-detail-layout">
  <div class="game-detail-left">
    ${leftMedia(game, colorA, colorB)}
    ${gameTabs(game, stats, quarterScores, playerMap, teamMap)}
  </div>
  <div class="game-detail-right">
    ${scoreCard(game, colorA, colorB)}
    ${potgCard(potgStat, game.potg_writeup)}
    ${topPerformers(stats, potgPlayerId)}
  </div>
</div>`;
}
