import { escHtml } from './layout.js';
import { teamColor, formatPlayerName, initials } from './utils.js';

const PER_GAME = [
  { id: 'pts',      label: 'PPG', title: 'Scoring',        fn: p => p.pts      / p.games_played },
  { id: 'reb',      label: 'RPG', title: 'Rebounds',       fn: p => p.reb      / p.games_played },
  { id: 'ast',      label: 'APG', title: 'Assists',        fn: p => p.ast      / p.games_played },
  { id: 'stl',      label: 'SPG', title: 'Steals',         fn: p => p.stl      / p.games_played },
  { id: 'blk',      label: 'BPG', title: 'Blocks',         fn: p => p.blk      / p.games_played },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m     / p.games_played },
  {
    id: 'fgp', label: 'FG%', title: 'FG Efficiency',
    fn: p => { const a = p.fg2m + p.fg3m + p.fg2m_miss + p.fg3m_miss; return a >= 10 ? (p.fg2m + p.fg3m) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: '3PT Efficiency',
    fn: p => { const a = p.fg3m + p.fg3m_miss; return a >= 5 ? p.fg3m / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ 3PA',
  },
  {
    id: 'ftp', label: 'FT%', title: 'Free Throws',
    fn: p => { const a = p.ftm + p.ft_miss; return a >= 5 ? p.ftm / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ FTA',
  },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm      / p.games_played },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover / p.games_played },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf       / p.games_played },
];

const TOTALS = [
  { id: 'pts',      label: 'PTS', title: 'Points',         fn: p => p.pts },
  { id: 'reb',      label: 'REB', title: 'Rebounds',       fn: p => p.reb },
  { id: 'ast',      label: 'AST', title: 'Assists',        fn: p => p.ast },
  { id: 'stl',      label: 'STL', title: 'Steals',         fn: p => p.stl },
  { id: 'blk',      label: 'BLK', title: 'Blocks',         fn: p => p.blk },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m },
  {
    id: 'fgp', label: 'FG%', title: 'FG Efficiency',
    fn: p => { const a = p.fg2m + p.fg3m + p.fg2m_miss + p.fg3m_miss; return a >= 10 ? (p.fg2m + p.fg3m) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: '3PT Efficiency',
    fn: p => { const a = p.fg3m + p.fg3m_miss; return a >= 5 ? p.fg3m / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ 3PA',
  },
  {
    id: 'ftp', label: 'FT%', title: 'Free Throws',
    fn: p => { const a = p.ftm + p.ft_miss; return a >= 5 ? p.ftm / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ FTA',
  },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf },
];

function fmtPerGame(v) { return v.toFixed(1); }
function fmtTotals(v)  { return String(Math.round(v)); }

function leaderPanel(cat, players, defaultFmt) {
  const scored = players
    .map(p => ({ p, v: cat.fn(p) }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v || b.p.games_played - a.p.games_played || (b.p.team_wins || 0) - (a.p.team_wins || 0));

  if (!scored.length) return '';

  const top10 = scored.slice(0, 10);
  const best = top10[0];
  const fmt = cat.fmt || defaultFmt;
  const maxV = best.v;

  const teamName = String(best.p.team_name || '').toUpperCase();
  const color = teamColor(teamName);
  const isLight = teamName === 'WHITE';

  return `<div class="card leader-panel">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${escHtml(cat.label)}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
    ${cat.min ? `<span class="leader-panel__min">${escHtml(cat.min)}</span>` : ''}
  </div>
  <div class="leader-panel__top">
    <div class="leader-avatar" style="border-color:${color}">
      <span class="font-condensed">${escHtml(initials(best.p.name))}</span>
    </div>
    <div class="leader-panel__info">
      <div class="leader-panel__name">${escHtml(formatPlayerName(best.p.name).toUpperCase())}</div>
      <span class="team-chip" style="background:${color};color:${isLight?'#10141d':'#fff'}">${escHtml(teamName)}</span>
    </div>
    <div class="leader-panel__stat font-condensed">${escHtml(fmt(best.v))}</div>
  </div>
  <div class="leader-panel__list">
    ${top10.slice(1).map((x, i) => {
      const tc = teamColor(String(x.p.team_name || '').toUpperCase());
      const barW = maxV > 0 ? Math.round(x.v / maxV * 100) : 0;
      return `<div class="leader-panel__row">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="leader-panel__row-name">${escHtml(formatPlayerName(x.p.name).toUpperCase())}</span>
      <div class="leader-panel__bar-wrap">
        <div class="leader-panel__bar" style="width:${barW}%;background:${tc}33;border-right:2px solid ${tc}"></div>
      </div>
      <span class="leader-panel__row-stat">${escHtml(fmt(x.v))}</span>
    </div>`;
    }).join('')}
  </div>
</div>`;
}

export function leadersPage({ players }) {
  const pgPanels  = PER_GAME.map(cat => leaderPanel(cat, players, fmtPerGame)).filter(Boolean).join('\n');
  const totPanels = TOTALS.map(cat => leaderPanel(cat, players, fmtTotals)).filter(Boolean).join('\n');

  return `<div class="page-content">
    <div class="section-divider">
      <span class="section-divider__label">LEAGUE LEADERS</span>
      <span class="section-divider__line"></span>
      <div class="leaders-toggle">
        <button class="leaders-toggle__btn leaders-toggle__btn--active" id="leaders-btn-pg" onclick="leadersSwitch('pg')">Per Game</button>
        <button class="leaders-toggle__btn" id="leaders-btn-tot" onclick="leadersSwitch('tot')">Totals</button>
      </div>
    </div>
    <div class="leaders-page-grid" id="leaders-grid-pg">${pgPanels}</div>
    <div class="leaders-page-grid" id="leaders-grid-tot" style="display:none">${totPanels}</div>
    <script>
    function leadersSwitch(mode) {
      document.getElementById('leaders-grid-pg').style.display  = mode === 'pg'  ? '' : 'none';
      document.getElementById('leaders-grid-tot').style.display = mode === 'tot' ? '' : 'none';
      document.getElementById('leaders-btn-pg').classList.toggle('leaders-toggle__btn--active',  mode === 'pg');
      document.getElementById('leaders-btn-tot').classList.toggle('leaders-toggle__btn--active', mode === 'tot');
    }
    </script>
  </div>`;
}
