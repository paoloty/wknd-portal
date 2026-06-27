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

// ── 1. Team Stat Charts (returns two grid HTML strings for pg/tot) ───────────
function teamStatCharts(rows, teamStats) {
  const empty    = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0, fgm: 0, fga: 0, fg3a: 0, ftm: 0, ft_miss: 0, turnover: 0, pf: 0 };
  const statsMap = Object.fromEntries(teamStats.map(t => [t.team_id, t]));
  const pct      = fn => v => (fn(v) * 100).toFixed(1) + '%';

  const PER_GAME = [
    { label: 'PPG', title: 'Points Per Game',       fn: t => t.gp > 0 ? t.pts      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'RPG', title: 'Rebounds Per Game',     fn: t => t.gp > 0 ? t.reb      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'APG', title: 'Assists Per Game',      fn: t => t.gp > 0 ? t.ast      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'SPG', title: 'Steals Per Game',       fn: t => t.gp > 0 ? t.stl      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'BPG', title: 'Blocks Per Game',       fn: t => t.gp > 0 ? t.blk      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: '3PM', title: '3-Pointers Per Game',   fn: t => t.gp > 0 ? t.fg3m     / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'FG%', title: 'Field Goal %',          fn: t => t.fga  > 0 ? t.fgm  / t.fga  : 0, fmt: pct(v => v) },
    { label: '3P%', title: '3-Point %',             fn: t => t.fg3a > 0 ? t.fg3m / t.fg3a : 0, fmt: pct(v => v) },
    { label: 'FT%', title: 'Free Throw %',          fn: t => (t.ftm + t.ft_miss) > 0 ? t.ftm / (t.ftm + t.ft_miss) : 0, fmt: pct(v => v) },
    { label: 'FTM', title: 'FT Made Per Game',      fn: t => t.gp > 0 ? t.ftm      / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'TO',  title: 'Turnovers Per Game',    fn: t => t.gp > 0 ? t.turnover / t.gp : 0, fmt: v => v.toFixed(1) },
    { label: 'PF',  title: 'Fouls Per Game',        fn: t => t.gp > 0 ? t.pf       / t.gp : 0, fmt: v => v.toFixed(1) },
  ];
  const TOTALS = [
    { label: 'PTS', title: 'Points',          fn: t => t.pts,      fmt: v => String(Math.round(v)) },
    { label: 'REB', title: 'Rebounds',        fn: t => t.reb,      fmt: v => String(Math.round(v)) },
    { label: 'AST', title: 'Assists',         fn: t => t.ast,      fmt: v => String(Math.round(v)) },
    { label: 'STL', title: 'Steals',          fn: t => t.stl,      fmt: v => String(Math.round(v)) },
    { label: 'BLK', title: 'Blocks',          fn: t => t.blk,      fmt: v => String(Math.round(v)) },
    { label: '3PM', title: '3-Pointers',      fn: t => t.fg3m,     fmt: v => String(Math.round(v)) },
    { label: 'FG%', title: 'Field Goal %',    fn: t => t.fga  > 0 ? t.fgm  / t.fga  : 0, fmt: pct(v => v) },
    { label: '3P%', title: '3-Point %',       fn: t => t.fg3a > 0 ? t.fg3m / t.fg3a : 0, fmt: pct(v => v) },
    { label: 'FT%', title: 'Free Throw %',    fn: t => (t.ftm + t.ft_miss) > 0 ? t.ftm / (t.ftm + t.ft_miss) : 0, fmt: pct(v => v) },
    { label: 'FTM', title: 'FT Made',         fn: t => t.ftm,      fmt: v => String(Math.round(v)) },
    { label: 'TO',  title: 'Turnovers',       fn: t => t.turnover, fmt: v => String(Math.round(v)) },
    { label: 'PF',  title: 'Fouls',           fn: t => t.pf,       fmt: v => String(Math.round(v)) },
  ];

  function renderGrid(cats) {
    return `<div class="sc-grid">` + cats.map(cat => {
      const ranked = rows
        .map(r => ({ r, v: cat.fn(statsMap[r.team.id] || empty) }))
        .sort((a, b) => b.v - a.v);
      const maxV = ranked[0]?.v || 1;

      const bars = ranked.map(({ r, v }) => {
        const tc = teamColor(r.team.name.toUpperCase());
        const w  = maxV > 0 ? Math.round(v / maxV * 100) : 0;
        return `<div class="sc-row">
          <span class="sc-dot" style="background:${tc}"></span>
          <div class="sc-track"><div class="sc-fill" style="width:${w}%;background:${tc}"></div></div>
          <span class="sc-val">${escHtml(cat.fmt(v))}</span>
        </div>`;
      }).join('');

      return `<div class="sc-card">
        <div class="sc-head">
          <span class="sc-label">${escHtml(cat.label)}</span>
          <span class="sc-title">${escHtml(cat.title)}</span>
        </div>
        ${bars}
      </div>`;
    }).join('') + `</div>`;
  }

  return { pg: renderGrid(PER_GAME), tot: renderGrid(TOTALS) };
}


// ── Main export ───────────────────────────────────────────────────────────────
export function standingsPage({ teams, games, highlights = [], teamStats = [] }) {
  const { rows, currentSeason } = buildStandings(teams, games);
  const matrix = h2hMatrix(teams, games, currentSeason);

  const tableRows = rows.map((r, i) => {
    const color     = teamColor(r.team.name.toUpperCase());
    const seed      = i + 1;
    const seedClass = seed <= 2 ? 'seed--top' : 'seed--mid';
    const pctBarW   = Math.round(r.pct * 100);
    const diffStr   = r.diff === 0 ? '0' : (r.diff > 0 ? '+' : '') + r.diff;

    const h2hCells = rows.map(o => {
      if (r.team.id === o.team.id)
        return `<div class="standings-cell standings-cell--num st-h2h st-h2h--self">—</div>`;
      const rec = matrix[r.team.id][o.team.id];
      if (rec.w === 0 && rec.l === 0)
        return `<div class="standings-cell standings-cell--num st-h2h st-h2h--none">–</div>`;
      const cls = rec.w > rec.l ? ' st-h2h--win' : rec.l > rec.w ? ' st-h2h--loss' : '';
      return `<div class="standings-cell standings-cell--num st-h2h${cls}">${rec.w}–${rec.l}</div>`;
    }).join('');

    return `<div class="standings-row${i === 0 ? ' standings-row--first' : ''}" style="--tc-color:${color}">
  <div class="standings-cell standings-cell--seed">
    <span class="standings-seed ${seedClass}">${seed}</span>
  </div>
  <div class="standings-cell standings-cell--team">
    <span class="team-dot" style="background:${color}"></span>
    <span class="standings-team-name">${escHtml(r.team.name.toUpperCase())}</span>
    ${seed <= 2 ? '<span class="standings-badge">2×</span>' : ''}
  </div>
  <div class="standings-cell standings-cell--num standings-cell--w st-std">${r.w}</div>
  <div class="standings-cell standings-cell--num standings-cell--l st-std">${r.l}</div>
  <div class="standings-cell standings-cell--num standings-cell--pct st-std">${r.pct.toFixed(3).replace(/^0/, '')}</div>
  <div class="standings-cell standings-cell--num standings-cell--gb st-std">${r.gb === 0 ? '—' : r.gb % 1 === 0 ? r.gb : r.gb.toFixed(1)}</div>
  <div class="standings-cell standings-cell--num standings-cell--diff${r.diff > 0 ? ' diff--pos' : r.diff < 0 ? ' diff--neg' : ''} st-std">${diffStr}</div>
  <div class="standings-cell standings-cell--num standings-cell--quo st-std">${r.quo.toFixed(3)}</div>
  ${h2hCells}
</div>`;
  }).join('');

  // H2H header cells (opponent dots shown in h2h mode)
  const h2hHeadCells = rows.map(o => {
    const c = teamColor(o.team.name.toUpperCase());
    return `<div class="standings-cell standings-cell--num st-h2h st-h2h--head" title="${escHtml(o.team.name)}">
      <span class="team-dot" style="background:${c}"></span>
    </div>`;
  }).join('');

  // Team stat charts (standalone section)
  const charts = teamStats.length ? teamStatCharts(rows, teamStats) : null;
  const teamStatsSection = charts ? `
  <div class="section-divider" style="margin:28px 0 16px">
    <span class="section-divider__label">TEAM STATS</span>
    <span class="section-divider__line"></span>
    <div class="leaders-toggle">
      <button class="leaders-toggle__btn leaders-toggle__btn--active" id="sc-btn-pg"  onclick="scSwitch('pg')">Per Game</button>
      <button class="leaders-toggle__btn"                             id="sc-btn-tot" onclick="scSwitch('tot')">Totals</button>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <div id="sc-pg">${charts.pg}</div>
    <div id="sc-tot" style="display:none">${charts.tot}</div>
  </div>
  <script>
  window.scSwitch=function(mode){
    document.getElementById('sc-pg').style.display=mode==='pg'?'':'none';
    document.getElementById('sc-tot').style.display=mode==='tot'?'':'none';
    document.getElementById('sc-btn-pg').classList.toggle('leaders-toggle__btn--active',mode==='pg');
    document.getElementById('sc-btn-tot').classList.toggle('leaders-toggle__btn--active',mode==='tot');
  };
  </script>` : '';

  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const upcomingGames = games
    .filter(g => !g.under_review && Number(g.team_a_score) + Number(g.team_b_score) === 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const tickerGames = [...upcomingGames, ...completedGames];

  const mainContent = `<div class="standings-main">
    <div class="section-divider" style="margin-bottom:16px">
      <span class="section-divider__label">STANDINGS</span>
      <span class="section-divider__line"></span>
      <span class="standings-season">SEASON ${escHtml(String(currentSeason ?? ''))}</span>
    </div>
    <div class="card standings-table">
      <div class="h2h-tabs-bar">
        <nav class="h2h-tabs">
          <button class="h2h-tab h2h-tab--active" id="stab-standings" onclick="stabSwitch('standings')">Standings</button>
          <button class="h2h-tab" id="stab-h2h" onclick="stabSwitch('h2h')">Head to Head</button>
        </nav>
        <div id="stab-legend" class="h2h-legend" style="display:none">
          <span class="h2h-legend__item h2h-legend__win">W</span>
          <span class="h2h-legend__item h2h-legend__loss">L</span>
        </div>
      </div>
      <div class="standings-scroll" id="standings-scroll" style="--st-h2h-count:${rows.length}">
        <div class="standings-row standings-row--head">
          <div class="standings-cell standings-cell--seed"></div>
          <div class="standings-cell standings-cell--team">TEAM</div>
          <div class="standings-cell standings-cell--num standings-cell--w st-std">W</div>
          <div class="standings-cell standings-cell--num standings-cell--l st-std">L</div>
          <div class="standings-cell standings-cell--num st-std">PCT</div>
          <div class="standings-cell standings-cell--num standings-cell--gb st-std">GB</div>
          <div class="standings-cell standings-cell--num st-std">DIFF</div>
          <div class="standings-cell standings-cell--num standings-cell--quo st-std">QUO</div>
          ${h2hHeadCells}
        </div>
        ${tableRows}
      </div>
    </div>
    <script>
    (function(){
      var el=document.getElementById('standings-scroll');
      el.addEventListener('scroll',function(){el.classList.toggle('is-scrolled',el.scrollLeft>4);},{passive:true});
      window.stabSwitch=function(tab){
        var isS=tab==='standings';
        el.classList.toggle('mode-h2h',!isS);
        document.getElementById('stab-standings').classList.toggle('h2h-tab--active',isS);
        document.getElementById('stab-h2h').classList.toggle('h2h-tab--active',!isS);
        document.getElementById('stab-legend').style.display=isS?'none':'';
      };
    })();
    </script>
    ${teamStatsSection}
  </div>`;

  return `${scoreTicker(tickerGames)}
  <div class="page-content">
    ${mainContent}
  </div>`;
}
