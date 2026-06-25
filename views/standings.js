import { escHtml } from './layout.js';
import { teamColor } from './utils.js';
import { scoreTicker } from './home.js';

function buildStandings(teams, games) {
  const currentSeason = games
    .filter(g => g.game_type === 'regular' && !g.under_review)
    .reduce((max, g) => (g.season > max ? g.season : max), null);

  const regularGames = games.filter(g =>
    g.game_type === 'regular' && !g.under_review && g.season === currentSeason &&
    (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const rows = teams.map(team => {
    const record = { gp: 0, w: 0, l: 0, pf: 0, pa: 0 };
    for (const g of regularGames) {
      const isA = g.team_a_id === team.id;
      const isB = g.team_b_id === team.id;
      if (!isA && !isB) continue;
      const tf = isA ? Number(g.team_a_score) : Number(g.team_b_score);
      const ta = isA ? Number(g.team_b_score) : Number(g.team_a_score);
      record.gp++;
      record.pf += tf;
      record.pa += ta;
      if (tf > ta) record.w++; else record.l++;
    }
    return { team, ...record };
  });

  rows.sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    const qA = a.pa > 0 ? a.pf / a.pa : 0;
    const qB = b.pa > 0 ? b.pf / b.pa : 0;
    return qB - qA;
  });

  const leader = rows[0];
  rows.forEach(r => {
    r.pct  = r.gp > 0 ? r.w / r.gp : 0;
    r.gb   = leader ? ((leader.w - r.w) + (r.l - leader.l)) / 2 : 0;
    r.quo  = r.pa > 0 ? r.pf / r.pa : 0;
    r.diff = r.pf - r.pa;
  });

  return { rows, currentSeason };
}

function h2hMatrix(teams, games, currentSeason) {
  const regularGames = games.filter(g =>
    g.game_type === 'regular' && !g.under_review && g.season === currentSeason &&
    (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const matrix = {};
  for (const t of teams) {
    matrix[t.id] = {};
    for (const o of teams) matrix[t.id][o.id] = { w: 0, l: 0 };
  }
  for (const g of regularGames) {
    const sA = Number(g.team_a_score), sB = Number(g.team_b_score);
    if (sA > sB) { matrix[g.team_a_id][g.team_b_id].w++; matrix[g.team_b_id][g.team_a_id].l++; }
    else         { matrix[g.team_b_id][g.team_a_id].w++; matrix[g.team_a_id][g.team_b_id].l++; }
  }
  return matrix;
}

// ── 1. Team Stat Bars ────────────────────────────────────────────────────────
function teamStatBars(rows, teamStats) {
  if (!teamStats.length) return '';

  const empty = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0, fgm: 0, fga: 0, fg3a: 0, ftm: 0, ft_miss: 0, turnover: 0, pf: 0 };
  const statsMap = Object.fromEntries(teamStats.map(t => [t.team_id, t]));

  const pct  = fn => v => (fn(v) * 100).toFixed(1) + '%';
  const PER_GAME = [
    { label: 'PPG', title: 'Points',         fn: t => t.gp > 0 ? t.pts      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'RPG', title: 'Rebounds',       fn: t => t.gp > 0 ? t.reb      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'APG', title: 'Assists',        fn: t => t.gp > 0 ? t.ast      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'SPG', title: 'Steals',         fn: t => t.gp > 0 ? t.stl      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'BPG', title: 'Blocks',         fn: t => t.gp > 0 ? t.blk      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: '3PM', title: '3-Pointers',     fn: t => t.gp > 0 ? t.fg3m     / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'FG%', title: 'FG Efficiency',  fn: t => t.fga > 0 ? t.fgm / t.fga : 0,    fmt: pct(v => v) },
    { label: '3P%', title: '3PT Efficiency', fn: t => t.fg3a > 0 ? t.fg3m / t.fg3a : 0, fmt: pct(v => v) },
    { label: 'FT%', title: 'Free Throws',    fn: t => (t.ftm + t.ft_miss) > 0 ? t.ftm / (t.ftm + t.ft_miss) : 0, fmt: pct(v => v) },
    { label: 'FTM', title: 'FT Made',        fn: t => t.gp > 0 ? t.ftm      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'TO',  title: 'Turnovers',      fn: t => t.gp > 0 ? t.turnover / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'PF',  title: 'Fouls',          fn: t => t.gp > 0 ? t.pf       / t.gp : 0, fmt: v => v.toFixed(1) },
  ];
  const TOTALS = [
    { label: 'PTS', title: 'Points',         fn: t => t.pts,      fmt: v => String(Math.round(v)) },
    { label: 'REB', title: 'Rebounds',       fn: t => t.reb,      fmt: v => String(Math.round(v)) },
    { label: 'AST', title: 'Assists',        fn: t => t.ast,      fmt: v => String(Math.round(v)) },
    { label: 'STL', title: 'Steals',         fn: t => t.stl,      fmt: v => String(Math.round(v)) },
    { label: 'BLK', title: 'Blocks',         fn: t => t.blk,      fmt: v => String(Math.round(v)) },
    { label: '3PM', title: '3-Pointers',     fn: t => t.fg3m,     fmt: v => String(Math.round(v)) },
    { label: 'FG%', title: 'FG Efficiency',  fn: t => t.fga > 0 ? t.fgm / t.fga : 0,    fmt: pct(v => v) },
    { label: '3P%', title: '3PT Efficiency', fn: t => t.fg3a > 0 ? t.fg3m / t.fg3a : 0, fmt: pct(v => v) },
    { label: 'FT%', title: 'Free Throws',    fn: t => (t.ftm + t.ft_miss) > 0 ? t.ftm / (t.ftm + t.ft_miss) : 0, fmt: pct(v => v) },
    { label: 'FTM', title: 'FT Made',        fn: t => t.ftm,      fmt: v => String(Math.round(v)) },
    { label: 'TO',  title: 'Turnovers',      fn: t => t.turnover, fmt: v => String(Math.round(v)) },
    { label: 'PF',  title: 'Fouls',          fn: t => t.pf,       fmt: v => String(Math.round(v)) },
  ];

  function renderCards(cats) {
    return cats.map(cat => {
      const ranked = rows
        .map(r => ({ r, v: cat.fn(statsMap[r.team.id] || empty) }))
        .sort((a, b) => b.v - a.v);

      const best = ranked[0];
      const maxV = best?.v || 1;
      const color = teamColor(best.r.team.name.toUpperCase());

      const restRows = ranked.slice(1).map((item, i) => {
        const tc = teamColor(item.r.team.name.toUpperCase());
        const barW = maxV > 0 ? Math.round(item.v / maxV * 100) : 0;
        return `<div class="leader-panel__row">
  <span class="leader-panel__rank">${i + 2}</span>
  <span class="team-dot" style="background:${tc}"></span>
  <span class="leader-panel__row-name">${escHtml(item.r.team.name.toUpperCase())}</span>
  <div class="leader-panel__bar-wrap">
    <div class="leader-panel__bar" style="width:${barW}%;background:${tc}33;border-right:2px solid ${tc}"></div>
  </div>
  <span class="leader-panel__row-stat">${escHtml(cat.fmt(item.v))}</span>
</div>`;
      }).join('');

      return `<div class="card leader-panel">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${cat.label}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
  </div>
  <div class="leader-panel__top">
    <span class="team-dot" style="background:${color}"></span>
    <div class="leader-panel__info">
      <div class="leader-panel__name">${escHtml(best.r.team.name.toUpperCase())}</div>
    </div>
    <div class="leader-panel__stat font-condensed">${escHtml(cat.fmt(best.v))}</div>
  </div>
  <div class="leader-panel__list">${restRows}</div>
</div>`;
    }).join('\n');
  }

  return `<div class="section-divider" style="margin:28px 0 16px">
  <span class="section-divider__label">TEAM STATS</span>
  <span class="section-divider__line"></span>
  <div class="leaders-toggle">
    <button class="leaders-toggle__btn leaders-toggle__btn--active" id="tstat-btn-pg" onclick="tstatSwitch('pg')">Per Game</button>
    <button class="leaders-toggle__btn" id="tstat-btn-tot" onclick="tstatSwitch('tot')">Totals</button>
  </div>
</div>
<div class="tstat-grid" id="tstat-grid-pg">${renderCards(PER_GAME)}</div>
<div class="tstat-grid" id="tstat-grid-tot" style="display:none">${renderCards(TOTALS)}</div>
<script>
function tstatSwitch(mode) {
  document.getElementById('tstat-grid-pg').style.display  = mode === 'pg'  ? '' : 'none';
  document.getElementById('tstat-grid-tot').style.display = mode === 'tot' ? '' : 'none';
  document.getElementById('tstat-btn-pg').classList.toggle('leaders-toggle__btn--active',  mode === 'pg');
  document.getElementById('tstat-btn-tot').classList.toggle('leaders-toggle__btn--active', mode === 'tot');
}
</script>`;
}


// ── Main export ───────────────────────────────────────────────────────────────
export function standingsPage({ teams, games, highlights = [], teamStats = [] }) {
  const { rows, currentSeason } = buildStandings(teams, games);
  const matrix = h2hMatrix(teams, games, currentSeason);

  const h2hHeadCells = rows.map(r =>
    `<div class="standings-cell standings-cell--num standings-cell--h2h">
      <span class="team-dot" style="background:${teamColor(r.team.name.toUpperCase())}"></span>
    </div>`
  ).join('');

  const tableRows = rows.map((r, i) => {
    const color = teamColor(r.team.name.toUpperCase());
    const seed = i + 1;
    const seedClass = seed <= 2 ? 'seed--top' : 'seed--mid';

    const h2hCells = rows.map(o => {
      if (r.team.id === o.team.id) return `<div class="standings-cell standings-cell--num standings-cell--h2h standings-cell--self">—</div>`;
      const rec = matrix[r.team.id][o.team.id];
      const cls = rec.w > rec.l ? ' standings-cell--h2h-win' : rec.l > rec.w ? ' standings-cell--h2h-loss' : '';
      return `<div class="standings-cell standings-cell--num standings-cell--h2h${cls}">${rec.w}–${rec.l}</div>`;
    }).join('');

    return `<div class="standings-row">
  <div class="standings-cell standings-cell--seed">
    <span class="standings-seed ${seedClass}">${seed}</span>
  </div>
  <div class="standings-cell standings-cell--team">
    <span class="team-dot" style="background:${color}"></span>
    <span class="standings-team-name">${escHtml(r.team.name.toUpperCase())}</span>
    ${seed <= 2 ? '<span class="standings-badge">2×</span>' : ''}
  </div>
  <div class="standings-cell standings-cell--num standings-cell--w">${r.w}</div>
  <div class="standings-cell standings-cell--num standings-cell--l">${r.l}</div>
  <div class="standings-cell standings-cell--num">${r.pct.toFixed(3).replace(/^0/, '')}</div>
  <div class="standings-cell standings-cell--num">${r.gb === 0 ? '—' : r.gb % 1 === 0 ? r.gb : r.gb.toFixed(1)}</div>
  <div class="standings-cell standings-cell--num">${r.gp}</div>
  <div class="standings-cell standings-cell--num">${r.pf}</div>
  <div class="standings-cell standings-cell--num">${r.pa}</div>
  <div class="standings-cell standings-cell--num">${r.diff > 0 ? '+' : ''}${r.diff}</div>
  <div class="standings-cell standings-cell--num standings-cell--quo">${r.quo.toFixed(3)}</div>
  ${h2hCells}
</div>`;
  }).join('');

  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const mainContent = `<div class="standings-main">
    <div class="section-divider" style="margin-bottom:16px">
      <span class="section-divider__label">STANDINGS</span>
      <span class="section-divider__line"></span>
      <span class="standings-season">SEASON ${escHtml(String(currentSeason ?? ''))}</span>
    </div>
    <div class="card standings-table">
      <div class="standings-scroll">
        <div class="standings-row standings-row--head">
          <div class="standings-cell standings-cell--seed"></div>
          <div class="standings-cell standings-cell--team">TEAM</div>
          <div class="standings-cell standings-cell--num standings-cell--w">W</div>
          <div class="standings-cell standings-cell--num standings-cell--l">L</div>
          <div class="standings-cell standings-cell--num">PCT</div>
          <div class="standings-cell standings-cell--num">GB</div>
          <div class="standings-cell standings-cell--num">GP</div>
          <div class="standings-cell standings-cell--num">PF</div>
          <div class="standings-cell standings-cell--num">PA</div>
          <div class="standings-cell standings-cell--num">DIFF</div>
          <div class="standings-cell standings-cell--num standings-cell--quo">QUO</div>
          ${h2hHeadCells}
        </div>
        ${tableRows}
      </div>
    </div>

  </div>`;

  return `${scoreTicker(completedGames)}
  <div class="page-content">
    ${mainContent}
    ${teamStatBars(rows, teamStats)}
</div>`;
}
