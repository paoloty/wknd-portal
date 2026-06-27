import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, truncate, playerAvatar } from './utils.js';

function avg(val, gp) {
  if (!gp || val == null) return '—';
  return (val / gp).toFixed(1);
}

function pct(made, miss) {
  const att = (made || 0) + (miss || 0);
  if (!att) return '—';
  return Math.round((made || 0) / att * 100) + '%';
}

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function heroSection(player, totals) {
  const teamName  = String(player.team_name || '').toUpperCase();
  const color     = teamColor(teamName);
  const isLight   = teamName === 'WHITE';
  const positions = parsePositions(player.positions);
  const bio       = String(player.writeup || '').trim();

  // ── Left column: identity ──────────────────────────────────────────────────
  const metaParts = [
    player.number ? `<span class="player-hero__number">#${escHtml(String(player.number))}</span>` : '',
    positions.length ? `<span class="player-hero__pos">${escHtml(positions.join(' · '))}</span>` : '',
    `<span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>`,
  ].filter(Boolean).join('');

  const leftCol = `<div class="player-hero__left">
    ${playerAvatar(player.id, player.name, color, { className: 'player-hero__avatar' })}
    <div class="player-hero__info">
      <h1 class="player-hero__name">${escHtml(displayPlayerName(player.name))}</h1>
      <div class="player-hero__meta">${metaParts}</div>
      ${bio ? `<p class="player-hero__bio">${escHtml(bio)}</p>` : ''}
    </div>
  </div>`;

  // ── Right column: career averages ──────────────────────────────────────────
  const gp = totals?.games_played || 0;
  const fga  = (totals.fg2m || 0) + (totals.fg3m || 0) + (totals.fg2m_miss || 0) + (totals.fg3m_miss || 0);
  const tpa  = (totals.fg3m || 0) + (totals.fg3m_miss || 0);
  const fta  = (totals.ftm || 0) + (totals.ft_miss || 0);
  const caStats = gp ? [
    { lbl: 'PPG', val: avg(totals.pts, gp) },
    { lbl: 'RPG', val: avg(totals.reb, gp) },
    { lbl: 'APG', val: avg(totals.ast, gp) },
    { lbl: 'SPG', val: avg(totals.stl, gp) },
    { lbl: 'BPG', val: avg(totals.blk, gp) },
    ...(fga  >= 10 ? [{ lbl: 'FG%', val: pct((totals.fg2m || 0) + (totals.fg3m || 0), (totals.fg2m_miss || 0) + (totals.fg3m_miss || 0)) }] : []),
    ...(tpa  >= 5  ? [{ lbl: '3P%', val: pct(totals.fg3m, totals.fg3m_miss) }] : []),
    ...(fta  >= 5  ? [{ lbl: 'FT%', val: pct(totals.ftm, totals.ft_miss) }] : []),
  ].filter(s => s.val !== '0.0' && s.val !== '0%' && s.val !== '—').slice(0, 8) : [];

  const rightCol = `<div class="player-hero__right">
    ${player.number ? `<span class="player-hero__num-bg" aria-hidden="true">${escHtml(String(player.number))}</span>` : ''}
    <div class="ca-label">CAREER AVERAGES</div>
    ${caStats.length
      ? `<div class="ca-grid" style="--ca-count:${caStats.length}">
          ${caStats.map(s => `<div class="ca-item">
            <span class="font-condensed ca-item__val">${escHtml(String(s.val))}</span>
            <span class="ca-item__lbl">${s.lbl}</span>
          </div>`).join('')}
        </div>`
      : `<p class="player-hero__no-stats">No games recorded yet.</p>`}
  </div>`;

  return `<div class="card player-hero" style="--ph-color:${color}">
  <div class="player-hero__grid">
    ${leftCol}
    ${rightCol}
  </div>
</div>`;
}

// ── Game log ──────────────────────────────────────────────────────────────────
function gameLog(allRows, player, potgGameIds) {
  if (!allRows.length) {
    return `<div class="card game-log-card">
  <div class="card-label">GAME LOG</div>
  <p style="padding:16px 18px;color:var(--text-muted);font-size:13px">No games recorded yet.</p>
</div>`;
  }

  const bySeason = {};
  const seasonOrder = [];
  for (const g of allRows) {
    const s = String(g.season || 'Unknown');
    if (!bySeason[s]) { bySeason[s] = []; seasonOrder.push(s); }
    bySeason[s].push(g);
  }

  function gameRow(g) {
    const isA     = g.player_team_id === g.team_a_id;
    const myScore = Number(isA ? g.team_a_score : g.team_b_score);
    const opScore = Number(isA ? g.team_b_score : g.team_a_score);
    const oppName = (isA ? g.team_b_name : g.team_a_name) || '';
    const myName  = (isA ? g.team_a_name : g.team_b_name) || '';
    const won     = myScore > opScore;
    const isPotg  = potgGameIds.has(g.id);
    const isPO    = g.game_type === 'playoff';

    const oppCell = `<div class="gl-opp">
      <span class="team-dot" style="background:${teamColor(oppName)}"></span>
      <a href="/games/${encodeURIComponent(g.id)}" class="gl-opp__link">${escHtml(String(oppName).toUpperCase())}</a>
      ${isPO ? '<span class="gl-badge gl-badge--po">PO</span>' : ''}
    </div>`;

    if (g.isDnp) {
      return `<tr class="gl-row gl-row--dnp">
      <td class="gl-date">${escHtml(formatDate(g.date))} <span class="dnp-pill">DNP</span></td>
      <td>${oppCell}</td>
      <td class="gl-result ${won ? 'gl-result--w' : 'gl-result--l'}">${won ? 'W' : 'L'} ${myScore}–${opScore}</td>
      <td colspan="17" class="gl-stat">–</td>
    </tr>`;
    }

    const fgm  = (g.fg2m || 0) + (g.fg3m || 0);
    const fgMs = (g.fg2m_miss || 0) + (g.fg3m_miss || 0);
    const fga  = fgm + fgMs;
    const tpm  = g.fg3m || 0;
    const tpMs = g.fg3m_miss || 0;
    const tpa  = tpm + tpMs;
    const ftm  = g.ftm || 0;
    const ftMs = g.ft_miss || 0;
    const fta  = ftm + ftMs;
    const per  = (
      Number(g.pts) + 0.4*fgm - 0.7*fga - 0.4*ftMs +
      0.7*Number(g.reb) + Number(g.stl) + 0.7*Number(g.ast) +
      0.7*Number(g.blk) - Number(g.turnover)
    ).toFixed(1);

    return `<tr class="gl-row">
      <td class="gl-date">${escHtml(formatDate(g.date))}${isPotg ? ' <span class="gl-star" title="Player of the Game">★</span>' : ''}</td>
      <td>${oppCell}</td>
      <td class="gl-result ${won ? 'gl-result--w' : 'gl-result--l'}">${won ? 'W' : 'L'} ${myScore}–${opScore}</td>
      <td class="gl-stat gl-group-start">${fgm}</td>
      <td class="gl-stat">${fga}</td>
      <td class="gl-stat gl-pct">${pct(fgm, fgMs)}</td>
      <td class="gl-stat gl-group-start">${tpm}</td>
      <td class="gl-stat">${tpa}</td>
      <td class="gl-stat gl-pct">${pct(tpm, tpMs)}</td>
      <td class="gl-stat gl-group-start">${ftm}</td>
      <td class="gl-stat">${fta}</td>
      <td class="gl-stat gl-pct">${pct(ftm, ftMs)}</td>
      <td class="gl-stat gl-group-start">${g.reb ?? '—'}</td>
      <td class="gl-stat">${g.ast ?? '—'}</td>
      <td class="gl-stat">${g.stl ?? '—'}</td>
      <td class="gl-stat">${g.blk ?? '—'}</td>
      <td class="gl-stat">${g.turnover ?? '—'}</td>
      <td class="gl-stat">${g.pf ?? '—'}</td>
      <td class="gl-stat gl-pts">${g.pts ?? '—'}</td>
      <td class="gl-stat gl-per">${per}</td>
    </tr>`;
  }

  function seasonAvgRow(games, season) {
    const played = games.filter(g => !g.isDnp);
    if (!played.length) return '';
    const sum  = k => played.reduce((t, g) => t + Number(g[k] || 0), 0);
    const gp   = played.length;
    const a    = k => (sum(k) / gp).toFixed(1);
    const fgm  = sum('fg2m') + sum('fg3m');
    const fgMs = sum('fg2m_miss') + sum('fg3m_miss');
    const fga  = fgm + fgMs;
    const tpm  = sum('fg3m');
    const tpMs = sum('fg3m_miss');
    const tpa  = tpm + tpMs;
    const ftm  = sum('ftm');
    const ftMs = sum('ft_miss');
    const fta  = ftm + ftMs;
    return `<tr class="gl-avg-row">
      <td class="gl-avg-label" colspan="3">${escHtml(String(season))} · ${gp} GP — AVERAGES</td>
      <td class="gl-stat gl-group-start">${(fgm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(fga/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(fgm, fgMs)}</td>
      <td class="gl-stat gl-group-start">${(tpm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(tpa/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(tpm, tpMs)}</td>
      <td class="gl-stat gl-group-start">${(ftm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(fta/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(ftm, ftMs)}</td>
      <td class="gl-stat gl-group-start">${a('reb')}</td>
      <td class="gl-stat">${a('ast')}</td>
      <td class="gl-stat">${a('stl')}</td>
      <td class="gl-stat">${a('blk')}</td>
      <td class="gl-stat">${a('turnover')}</td>
      <td class="gl-stat">${a('pf')}</td>
      <td class="gl-stat">${a('pts')}</td>
      <td class="gl-stat gl-per">${(played.reduce((t, g) => {
        const fgm = (g.fg2m||0)+(g.fg3m||0), fga = fgm+(g.fg2m_miss||0)+(g.fg3m_miss||0);
        const ftMs = g.ft_miss||0;
        return t + Number(g.pts)+0.4*fgm-0.7*fga-0.4*ftMs+0.7*Number(g.reb)+Number(g.stl)+0.7*Number(g.ast)+0.7*Number(g.blk)-Number(g.turnover);
      }, 0) / played.length).toFixed(1)}</td>
    </tr>`;
  }

  const rows = seasonOrder.map(season =>
    bySeason[season].map(gameRow).join('\n      ')
    + '\n      '
    + seasonAvgRow(bySeason[season], season)
  ).join('\n      ');

  return `<div class="card game-log-card">
  <div class="card-label">GAME LOG</div>
  <div class="gl-wrap">
    <table class="gl-table">
      <thead>
        <tr>
          <th rowspan="2" class="gl-date">DATE</th>
          <th rowspan="2" class="gl-opp-col">OPP</th>
          <th rowspan="2" class="gl-result">SCORE</th>
          <th colspan="3" class="gl-group">FIELD GOALS</th>
          <th colspan="3" class="gl-group">3-POINTERS</th>
          <th colspan="3" class="gl-group">FREE THROWS</th>
          <th rowspan="2" class="gl-stat">REB</th>
          <th rowspan="2" class="gl-stat">AST</th>
          <th rowspan="2" class="gl-stat">STL</th>
          <th rowspan="2" class="gl-stat">BLK</th>
          <th rowspan="2" class="gl-stat">TO</th>
          <th rowspan="2" class="gl-stat">PF</th>
          <th rowspan="2" class="gl-stat gl-pts">PTS</th>
          <th rowspan="2" class="gl-stat gl-per">PER</th>
        </tr>
        <tr class="gl-subhead">
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
        </tr>
      </thead>
      <tbody>
      ${rows}
      </tbody>
    </table>
  </div>
</div>`;
}

// ── Player highlights (POTG games) ────────────────────────────────────────────
function potgWriteups(potgGames, player) {
  if (!potgGames.length) return '';

  const rows = potgGames.map(g => {
    const isA      = g.player_team_id === g.team_a_id;
    const oppName  = String(isA ? g.team_b_name : g.team_a_name).toUpperCase();
    const oppColor = teamColor(oppName);
    const isLight  = oppName === 'WHITE';
    const writeup  = String(g.potg_writeup || '').replace(/\*\*/g, '').trim();

    return `<a href="/games/${encodeURIComponent(g.id)}#potg-anchor" class="highlight-card">
  <div class="hc-top">
    <div class="hc-info">
      <span class="hc-name">${escHtml(formatDate(g.date))}</span>
      <div class="hc-stat-line">${g.pts} PTS · ${g.reb} REB · ${g.ast} AST</div>
    </div>
    <span class="team-chip" style="background:${oppColor};color:${isLight ? '#10141d' : '#fff'}">vs ${escHtml(oppName)}</span>
  </div>
  ${writeup ? `<p class="hc-body">${escHtml(truncate(writeup, 150))}</p>` : ''}
</a>`;
  });

  return `<div class="card sidebar">
  <div class="card-label">PLAYER HIGHLIGHTS</div>
  ${rows.join('\n  ')}
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function playerPage({ player, totals, gameLogs, potgGames, careerHighs, awards, dnpGames = [] }) {
  const potgGameIds = new Set(potgGames.map(g => g.id));

  // Merge played games + DNPs and sort by actual date DESC
  const allRows = [
    ...gameLogs.map(g => ({ ...g, isDnp: false })),
    ...dnpGames.map(g => ({ ...g, isDnp: true, player_team_id: player.team_id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return `${heroSection(player, totals)}
<div class="game-detail-layout">
  <div class="game-detail-left">
    ${gameLog(allRows, player, potgGameIds)}
  </div>
  <div class="game-detail-right">
    ${potgWriteups(potgGames, player)}
  </div>
</div>`;
}
