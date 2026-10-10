import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials, playerAvatar, playerLink } from './utils.js';

let _showDownload = false;

// ── Shared PER formula — matches box score (game.js calcPer) ─────────────────
// pts + 0.4×FGM - 0.7×FGA - 0.4×missedFT + 0.7×REB + STL + 0.7×AST + 0.7×BLK - TO
const calcPer = (pts, fg2m, fg3m, fg2m_miss, fg3m_miss, ft_miss, reb, ast, stl, blk, to, fg4m = 0, fg4m_miss = 0) => {
  const fgm = fg2m + fg3m + fg4m;
  const fga = fgm + fg2m_miss + fg3m_miss + fg4m_miss;
  return pts + 0.4*fgm - 0.7*fga - 0.4*ft_miss + 0.7*reb + stl + 0.7*ast + 0.7*blk - to;
};

// ── Record categories ─────────────────────────────────────────────────────────
export const RECORD_CATS = [
  { id: 'pts',      label: 'PTS', title: 'Most Points',     fn: r => r.pts },
  {
    id: 'per', label: 'PER', title: 'Best PER',
    fn: r => calcPer(r.pts||0, r.fg2m||0, r.fg3m||0, r.fg2m_miss||0, r.fg3m_miss||0, r.ft_miss||0, r.reb||0, r.ast||0, r.stl||0, r.blk||0, r.turnover||0, r.fg4m||0, r.fg4m_miss||0),
    fmt: v => v.toFixed(1),
  },
  { id: 'reb',      label: 'REB', title: 'Most Rebounds',   fn: r => r.reb },
  { id: 'ast',      label: 'AST', title: 'Most Assists',    fn: r => r.ast },
  { id: 'stl',      label: 'STL', title: 'Most Steals',     fn: r => r.stl },
  { id: 'blk',      label: 'BLK', title: 'Most Blocks',     fn: r => r.blk },
  { id: 'fg3m',     label: '3PM', title: 'Most 3-Pointers', fn: r => r.fg3m },
  { id: 'fg4m',     label: '4PM', title: 'Most 4-Pointers', fn: r => r.fg4m },
  { id: 'ftm',      label: 'FTM', title: 'Most FT Made',    fn: r => r.ftm },
  {
    id: 'fgp', label: 'FG%', title: 'Best FG%',
    fn: r => { const a = (r.fg2m||0)+(r.fg3m||0)+(r.fg4m||0)+(r.fg2m_miss||0)+(r.fg3m_miss||0)+(r.fg4m_miss||0); return a >= 4 ? ((r.fg2m||0)+(r.fg3m||0)+(r.fg4m||0)) / a : -1; },
    fmt: v => Math.round(v * 100) + '%', min: '4+ FGA',
  },
  {
    id: 'tsp', label: 'TS%', title: 'Best True Shooting',
    fn: r => {
      const fga = (r.fg2m||0)+(r.fg3m||0)+(r.fg4m||0)+(r.fg2m_miss||0)+(r.fg3m_miss||0)+(r.fg4m_miss||0);
      const fta = (r.ftm||0)+(r.ft_miss||0);
      const d = 2 * (fga + 0.44 * fta);
      return fga >= 4 ? (r.pts||0) / d : -1;
    },
    fmt: v => Math.round(v * 100) + '%', min: '4+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: 'Best 3PT%',
    fn: r => { const a = (r.fg3m||0)+(r.fg3m_miss||0); return a >= 2 ? (r.fg3m||0) / a : -1; },
    fmt: v => Math.round(v * 100) + '%', min: '2+ 3PA',
  },
  {
    id: 'fg4p', label: '4P%', title: 'Best 4PT%',
    fn: r => { const a = (r.fg4m||0)+(r.fg4m_miss||0); return a >= 1 ? (r.fg4m||0) / a : -1; },
    fmt: v => Math.round(v * 100) + '%', min: '1+ 4PA',
  },
  {
    id: 'ftp', label: 'FT%', title: 'Best FT%',
    fn: r => { const a = (r.ftm||0)+(r.ft_miss||0); return a >= 3 ? (r.ftm||0) / a : -1; },
    fmt: v => Math.round(v * 100) + '%', min: '3+ FTA',
  },
  { id: 'turnover', label: 'TO',  title: 'Most Turnovers',  fn: r => r.turnover },
  { id: 'pf',       label: 'PF',  title: 'Most Fouls',      fn: r => r.pf },
];

function fmtRecordDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function recordContext(row) {
  const isA     = row.player_team_id ? row.player_team_id === row.team_a_id
                                     : row.team_id === row.team_a_id;
  const myScore = Number(isA ? row.team_a_score : row.team_b_score);
  const opScore = Number(isA ? row.team_b_score : row.team_a_score);
  const opp     = (isA ? row.team_b_name : row.team_a_name) || '';
  const won     = myScore > opScore;
  const isPO      = row.game_type === 'playoff';
  const isFinals  = row.game_type === 'finals';
  return {
    opp, myScore, opScore, won, isPO, isFinals,
    result: `${won ? 'W' : 'L'} ${myScore}–${opScore}`,
  };
}

function gamePerScore(r) {
  const fgm = (r.fg2m||0) + (r.fg3m||0) + (r.fg4m||0);
  const fga = fgm + (r.fg2m_miss||0) + (r.fg3m_miss||0) + (r.fg4m_miss||0);
  return (r.pts||0) + 0.4*fgm - 0.7*fga - 0.4*(r.ft_miss||0)
    + 0.7*(r.reb||0) + (r.stl||0) + 0.7*(r.ast||0)
    + 0.7*(r.blk||0) - (r.turnover||0);
}

function buildRecordTop5(rows, cat) {
  return rows
    .map(r => ({ r, v: Number(cat.fn(r) || 0), won: recordContext(r).won, per: gamePerScore(r) }))
    .filter(x => x.v > 0)
    .sort((a, b) => {
      if (b.v !== a.v) return b.v - a.v;
      // 1. Win over loss
      if (b.won !== a.won) return (b.won ? 1 : 0) - (a.won ? 1 : 0);
      // 2. Higher PER in that game
      if (Math.abs(b.per - a.per) > 0.0001) return b.per - a.per;
      // 3. More points
      if ((b.r.pts||0) !== (a.r.pts||0)) return (b.r.pts||0) - (a.r.pts||0);
      // 4. Fewer turnovers
      if ((a.r.turnover||0) !== (b.r.turnover||0)) return (a.r.turnover||0) - (b.r.turnover||0);
      // 5. More recent game
      return String(b.r.date || '').localeCompare(String(a.r.date || ''));
    })
    .slice(0, 5);
}

function recordPanel(cat, top5, scope = 'alltime') {
  if (!top5.length) return '';
  const first   = top5[0];
  const fmt     = cat.fmt || (v => String(Math.round(v)));
  const color   = teamColor(String(first.r.team_name || '').toUpperCase());
  const isLight = String(first.r.team_name || '').toUpperCase() === 'WHITE';
  const ctx     = recordContext(first.r);

  const rows = top5.slice(1).map((x, i) => {
    const tc   = teamColor(String(x.r.team_name || '').toUpperCase());
    const xctx = recordContext(x.r);
    return `<div class="record-panel__row">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="record-panel__row-name">
        ${playerLink(x.r.player_id, x.r.name, { upper: true })} <a href="/games/${encodeURIComponent(x.r.game_id)}" class="record-panel__row-game">${escHtml(fmtRecordDate(x.r.date))} · vs ${escHtml(xctx.opp)}</a>
      </span>
      <span class="record-panel__row-val font-condensed">${escHtml(fmt(x.v))}</span>
    </div>`;
  }).join('');

  return `<div class="card leader-panel record-panel" style="--lp-color:${color}">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${escHtml(cat.label)}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
    ${cat.min ? `<span class="leader-panel__min">${escHtml(cat.min)}</span>` : ''}
    <div class="leader-panel__actions">${recShareBtn(cat, scope, first, color, fmt)}${recDownloadBtn(cat)}</div>
  </div>
  <div class="leader-panel__top" style="background:linear-gradient(135deg,${color}1a 0%,transparent 65%)">
    ${playerAvatar(first.r.player_id, first.r.name, color, { className: 'leader-avatar', link: true })}
    <div class="leader-panel__info">
      <div class="leader-panel__name">${playerLink(first.r.player_id, first.r.name, { upper: true })}</div>
      <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(String(first.r.team_name || '').toUpperCase())}</span>
      <a href="/games/${encodeURIComponent(first.r.game_id)}" class="record-panel__ctx">${escHtml(fmtRecordDate(first.r.date))} · vs ${escHtml(ctx.opp)} · <span class="${ctx.won ? 'record-ctx--w' : 'record-ctx--l'}">${escHtml(ctx.result)}</span>${ctx.isPO ? ' <span class="gl-badge gl-badge--po">PO</span>' : ''}${ctx.isFinals ? ' <span class="gl-badge gl-badge--finals">F</span>' : ''}</a>
    </div>
    <div class="leader-panel__stat font-condensed">${escHtml(fmt(first.v))}</div>
  </div>
  ${rows ? `<div class="leader-panel__list">${rows}</div>` : ''}
</div>`;
}

function buildRecordsGrid(rows, scope = 'alltime') {
  return RECORD_CATS.map(cat => recordPanel(cat, buildRecordTop5(rows, cat), scope)).filter(Boolean).join('\n');
}

export const PER_GAME = [
  { id: 'pts',      label: 'PPG', title: 'Scoring',        fn: p => p.pts      / p.games_played },
  {
    id: 'per', label: 'PER', title: 'Efficiency Rating',
    fn: p => calcPer(p.pts, p.fg2m||0, p.fg3m||0, p.fg2m_miss||0, p.fg3m_miss||0, p.ft_miss||0, p.reb, p.ast, p.stl, p.blk, p.turnover, p.fg4m||0, p.fg4m_miss||0) / p.games_played,
    fmt: v => v.toFixed(1),
  },
  { id: 'reb',      label: 'RPG', title: 'Rebounds',       fn: p => p.reb      / p.games_played },
  { id: 'ast',      label: 'APG', title: 'Assists',        fn: p => p.ast      / p.games_played },
  { id: 'stl',      label: 'SPG', title: 'Steals',         fn: p => p.stl      / p.games_played },
  { id: 'blk',      label: 'BPG', title: 'Blocks',         fn: p => p.blk      / p.games_played },
  {
    id: 'fgp', label: 'FG%', title: 'FG Efficiency',
    fn: p => { const a = p.fg2m + p.fg3m + (p.fg4m||0) + p.fg2m_miss + p.fg3m_miss + (p.fg4m_miss||0); return a >= 10 ? (p.fg2m + p.fg3m + (p.fg4m||0)) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'tsp', label: 'TS%', title: 'True Shooting',
    fn: p => {
      const fga = p.fg2m + p.fg3m + (p.fg4m||0) + p.fg2m_miss + p.fg3m_miss + (p.fg4m_miss||0);
      const fta = (p.ftm || 0) + (p.ft_miss || 0);
      const d = 2 * (fga + 0.44 * fta);
      return fga >= 10 ? p.pts / d : -1;
    },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: '3PT Efficiency',
    fn: p => { const a = p.fg3m + p.fg3m_miss; return a >= 5 ? p.fg3m / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ 3PA',
  },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m     / p.games_played },
  {
    id: 'fg4p', label: '4P%', title: '4PT Efficiency',
    fn: p => { const a = (p.fg4m||0) + (p.fg4m_miss||0); return a >= 1 ? (p.fg4m||0) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '1+ 4PA',
  },
  { id: 'fg4m',     label: '4PM', title: '4-Pointers',     fn: p => (p.fg4m||0) / p.games_played },
  {
    id: 'ftp', label: 'FT%', title: 'Free Throws',
    fn: p => { const a = p.ftm + p.ft_miss; return a >= 5 ? p.ftm / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ FTA',
  },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm      / p.games_played },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover / p.games_played },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf       / p.games_played },
];

export const TOTALS = [
  { id: 'pts',      label: 'PTS', title: 'Points',         fn: p => p.pts },
  {
    id: 'per', label: 'PER', title: 'Efficiency Rating',
    fn: p => calcPer(p.pts, p.fg2m||0, p.fg3m||0, p.fg2m_miss||0, p.fg3m_miss||0, p.ft_miss||0, p.reb, p.ast, p.stl, p.blk, p.turnover, p.fg4m||0, p.fg4m_miss||0),
    fmt: v => v.toFixed(1),
  },
  {
    id: 'tsp', label: 'TS%', title: 'True Shooting',
    fn: p => {
      const fga = (p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0)+(p.fg4m_miss||0);
      const fta = (p.ftm||0)+(p.ft_miss||0);
      const d = 2 * (fga + 0.44 * fta);
      return fga >= 10 ? p.pts / d : -1;
    },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  { id: 'reb',      label: 'REB', title: 'Rebounds',       fn: p => p.reb },
  { id: 'ast',      label: 'AST', title: 'Assists',        fn: p => p.ast },
  { id: 'stl',      label: 'STL', title: 'Steals',         fn: p => p.stl },
  { id: 'blk',      label: 'BLK', title: 'Blocks',         fn: p => p.blk },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m },
  { id: 'fg4m',     label: '4PM', title: '4-Pointers',     fn: p => p.fg4m || 0 },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf },
];

export function fmtPerGame(v) { return v.toFixed(1); }
export function fmtTotals(v)  { return String(Math.round(v)); }

function shareBtn(cat, mode, season, best, color, fmt) {
  return `<button class="leader-panel__share" onclick="shareLeader(this)" title="Share"
    data-season="${escHtml(String(season))}"
    data-cat-id="${escHtml(cat.id)}"
    data-mode="${escHtml(mode)}"
    data-player-id="${escHtml(best.p.id)}"
    data-player-name="${escHtml(best.p.name)}"
    data-team-id="${escHtml(best.p.team_id)}"
    data-team-name="${escHtml(String(best.p.team_name || ''))}"
    data-team-color="${escHtml(color)}"
    data-stat-label="${escHtml(cat.label)}"
    data-stat-title="${escHtml(cat.title)}"
    data-stat-value="${best.v}"
    data-stat-fmt="${escHtml(fmt(best.v))}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>`;
}

const DL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

function downloadBtn(cat, mode) {
  if (!_showDownload) return '';
  return `<button class="leader-panel__share" onclick="downloadLeader(this)" title="Download image"
    data-label="${escHtml(cat.label)}"
    data-mode="${escHtml(mode)}">${DL_ICON}</button>`;
}

function recShareBtn(cat, scope, first, color, fmt) {
  const ctx    = recordContext(first.r);
  const teamId = first.r.player_team_id || first.r.team_id || '';
  return `<button class="leader-panel__share" onclick="shareLeader(this)" title="Share"
    data-season="${escHtml(String(scope))}"
    data-cat-id="${escHtml(cat.id)}"
    data-mode="rec"
    data-player-id="${escHtml(String(first.r.player_id || ''))}"
    data-player-name="${escHtml(String(first.r.name || ''))}"
    data-team-id="${escHtml(String(teamId))}"
    data-team-name="${escHtml(String(first.r.team_name || ''))}"
    data-team-color="${escHtml(color)}"
    data-stat-label="${escHtml(cat.label)}"
    data-stat-title="${escHtml(cat.title)}"
    data-stat-value="${first.v}"
    data-stat-fmt="${escHtml(fmt(first.v))}"
    data-game-id="${escHtml(String(first.r.game_id || ''))}"
    data-game-date="${escHtml(String(first.r.date || ''))}"
    data-game-opp="${escHtml(ctx.opp)}"
    data-game-result="${escHtml(ctx.result)}"
    data-is-playoff="${ctx.isPO ? '1' : '0'}"
  ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>`;
}

function recDownloadBtn(cat) {
  if (!_showDownload) return '';
  return `<button class="leader-panel__share" onclick="downloadLeader(this)" title="Download image"
    data-label="${escHtml(cat.label)}"
    data-mode="rec">${DL_ICON}</button>`;
}

function leaderPanel(cat, players, defaultFmt, { mode = 'pg', season = '' } = {}) {
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

  return `<div class="card leader-panel" style="--lp-color:${color}">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${escHtml(cat.label)}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
    ${cat.min ? `<span class="leader-panel__min">${escHtml(cat.min)}</span>` : ''}
    <div class="leader-panel__actions">${shareBtn(cat, mode, season, best, color, fmt)}${downloadBtn(cat, mode)}</div>
  </div>
  <div class="leader-panel__top" style="background:linear-gradient(135deg,${color}1a 0%,transparent 65%)">
    ${playerAvatar(best.p.id, best.p.name, color, { className: 'leader-avatar', link: true })}
    <div class="leader-panel__info">
      <div class="leader-panel__name">${playerLink(best.p.id, best.p.name, { upper: true })}</div>
      <span class="team-chip" style="background:${color};color:${isLight?'#10141d':'#fff'}">${escHtml(teamName)}</span>
    </div>
    <div class="leader-panel__stat font-condensed">${escHtml(fmt(best.v))}</div>
  </div>
  <div class="leader-panel__list">
    ${top10.slice(1).map((x, i) => {
      const tc = teamColor(String(x.p.team_name || '').toUpperCase());
      const barW = maxV > 0 ? Math.round(x.v / maxV * 100) : 0;
      return `<div class="leader-panel__row" style="--bar-w:${barW}%;--bar-color:${tc}">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="leader-panel__row-name">${playerLink(x.p.id, x.p.name, { upper: true })}</span>
      <span class="leader-panel__row-stat font-condensed">${escHtml(fmt(x.v))}</span>
    </div>`;
    }).join('')}
  </div>
</div>`;
}

// One grid's panels, by key: 'pg:alltime' | 'pg:s3' | 'tot:…' | 'po:pg' | 'po:tot' |
// 'rec:alltime' | 'rec:s3'. The page renders only its default grid; every other tab/scope
// is fetched from /leaders/grid?k=<key> the first time it's shown (the page used to ship
// all ~200 panels — 656 KB of HTML — to show ~16). `players` is that scope's leader rows
// (pg/tot/po), `gameRecords` the record rows (rec).
export const LEADERS_GRID_KEY = /^(?:(?:pg|tot|rec):(?:alltime|s\d+)|po:(?:pg|tot))$/;
export function leadersGridHtml(key, { players = [], gameRecords = [], currentSeason = 3, isLoggedIn = false } = {}) {
  _showDownload = isLoggedIn;
  const [tab, scope] = key.split(':');
  // season value baked into each panel's share button must match what /api/leaders/share expects
  const season = scope === 'alltime' ? 'alltime' : scope.slice(1);
  const panels = (cats, fmt, mode, seasonVal) => cats.map(cat => leaderPanel(cat, players, fmt, { mode, season: seasonVal })).filter(Boolean).join('\n');
  if (tab === 'pg')  return panels(PER_GAME, fmtPerGame, 'pg', season);
  if (tab === 'tot') return panels(TOTALS, fmtTotals, 'tot', season);
  if (tab === 'po')  return scope === 'pg'
    ? panels(PER_GAME, fmtPerGame, 'po-pg', String(currentSeason))
    : panels(TOTALS, fmtTotals, 'po-tot', String(currentSeason));
  if (tab === 'rec') return buildRecordsGrid(scope === 'alltime' ? gameRecords : gameRecords.filter(r => String(r.season) === season), season);
  return '';
}

function scopedPillsHtml(prefix, leaderSeasons, defaultScopeId, hidden) {
  const pillsHtml = leaderSeasons.map(s =>
    `<button class="season-pill${defaultScopeId === 's' + s ? ' season-pill--active' : ''}" id="${prefix}-btn-s${s}" onclick="${prefix}SeasonSwitch('s${s}')">S${escHtml(String(s))}</button>`
  ).join('');
  return `<div class="leaders-season-pills" id="${prefix}-season-pills"${hidden ? ' style="display:none"' : ''}>
        <button class="season-pill${defaultScopeId === 'alltime' ? ' season-pill--active' : ''}" id="${prefix}-btn-alltime" onclick="${prefix}SeasonSwitch('alltime')">All Time</button>
        ${pillsHtml}
      </div>`;
}

// The default Per Game scope gets its panels inline; every other grid is an empty shell
// with data-lazy=<key>, filled by the page script the first time it's shown.
function lazyGrid(id, key, html, hidden) {
  const style = hidden ? ' style="display:none"' : '';
  return html != null
    ? `<div class="leaders-page-grid" id="${id}"${style}>${html}</div>`
    : `<div class="leaders-page-grid" id="${id}"${style} data-lazy="${escHtml(key)}"></div>`;
}

function scopedGridsBlock(prefix, leaderSeasons, defaultScopeId, defaultHtml) {
  const html = scope => (prefix === 'pg' && scope === defaultScopeId ? defaultHtml : null);
  const seasonGridsHtml = leaderSeasons.map(s => lazyGrid(`${prefix}-grid-s${s}`, `${prefix}:s${s}`, html('s' + s), defaultScopeId !== 's' + s)).join('\n');
  return `${lazyGrid(`${prefix}-grid-alltime`, `${prefix}:alltime`, html('alltime'), defaultScopeId !== 'alltime')}
    ${seasonGridsHtml}`;
}

// The scope Per Game opens on: the current season's if it has leaders yet, otherwise All Time.
export function leadersDefaultScope(leaderSeasons, currentSeason) {
  return leaderSeasons.map(String).includes(String(currentSeason)) ? 's' + currentSeason : 'alltime';
}

// defaultGridHtml: leadersGridHtml(`pg:${leadersDefaultScope(…)}`, …), rendered by the route.
export function leadersPage({
  hasPlayoffs = false, recordSeasons = [], currentSeason = 3, asOfLabel = '',
  leaderSeasons = [], defaultGridHtml = '',
}) {
  const defaultScopeId = leadersDefaultScope(leaderSeasons, currentSeason);
  const seasonPillsHtml = recordSeasons.map(s =>
    `<button class="season-pill" id="rec-btn-s${s}" onclick="recordsSwitch('s${s}')">S${escHtml(String(s))}</button>`
  ).join('');

  return `<div class="page-content">
    <div class="leaders-header">
      <div class="leaders-toggle">
        <button class="leaders-toggle__btn leaders-toggle__btn--active" id="leaders-btn-pg" onclick="leadersSwitch('pg')">Per Game<span class="leaders-toggle__desc">Season averages</span></button>
        <button class="leaders-toggle__btn" id="leaders-btn-tot" onclick="leadersSwitch('tot')">Totals<span class="leaders-toggle__desc">Season totals</span></button>
        ${hasPlayoffs ? `<button class="leaders-toggle__btn" id="leaders-btn-po" onclick="leadersSwitch('po')">Playoffs<span class="leaders-toggle__desc">Per game</span></button>` : ''}
        <button class="leaders-toggle__btn" id="leaders-btn-rec" onclick="leadersSwitch('rec')">Records<span class="leaders-toggle__desc">Single-game bests</span></button>
      </div>
      <div class="leaders-season-pills" id="leaders-season-pills" style="display:none">
        <button class="season-pill season-pill--active" id="rec-btn-alltime" onclick="recordsSwitch('alltime')">All Time</button>
        ${seasonPillsHtml}
      </div>
      ${hasPlayoffs ? `<div class="leaders-season-pills" id="leaders-po-pills" style="display:none">
        <button class="season-pill season-pill--active" id="po-btn-pg" onclick="poSwitch('pg')">Per Game</button>
        <button class="season-pill" id="po-btn-tot" onclick="poSwitch('tot')">Totals</button>
      </div>` : ''}
      ${scopedPillsHtml('pg', leaderSeasons, defaultScopeId, false)}
      ${scopedPillsHtml('tot', leaderSeasons, defaultScopeId, true)}
    </div>
    <div id="leaders-grid-pg">
      ${scopedGridsBlock('pg', leaderSeasons, defaultScopeId, defaultGridHtml)}
    </div>
    <div id="leaders-grid-tot" style="display:none">
      ${scopedGridsBlock('tot', leaderSeasons, defaultScopeId, null)}
    </div>
    ${hasPlayoffs ? `<div id="leaders-grid-po" style="display:none">
      ${lazyGrid('leaders-grid-po-pg', 'po:pg', null, false)}
      ${lazyGrid('leaders-grid-po-tot', 'po:tot', null, true)}
    </div>` : ''}
    <div id="leaders-grid-rec" style="display:none">
      ${lazyGrid('rec-grid-alltime', 'rec:alltime', null, false)}
      ${recordSeasons.map(s => lazyGrid(`rec-grid-s${s}`, `rec:s${s}`, null, true)).join('\n')}
    </div>
    <script>
    var _recSeasons = ${JSON.stringify(recordSeasons)};
    var _allRecScopes = ['alltime'].concat(_recSeasons.map(function(s){ return 's'+s; }));
    var _leaderSeasons = ${JSON.stringify(leaderSeasons)};
    var _allLeaderScopes = ['alltime'].concat(_leaderSeasons.map(function(s){ return 's'+s; }));
    var _asOfLabel = '${escHtml(asOfLabel)}';
    var _hasPlayoffs = ${hasPlayoffs};
    // Lazy grids (data-lazy="<key>"): fetched from /leaders/grid the first time they're
    // shown. Each tab's opening grid is warmed in the background once the page has loaded,
    // so the usual first tap fills instantly instead of waiting on the network.
    var _gridReqs = {};
    function gridHtml(key) {
      if (!_gridReqs[key]) {
        _gridReqs[key] = fetch('/leaders/grid?k=' + encodeURIComponent(key), { credentials: 'same-origin' })
          .then(function(r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .catch(function(e) { delete _gridReqs[key]; throw e; });
      }
      return _gridReqs[key];
    }
    function lazyFill(el) {
      var key = el.getAttribute('data-lazy');
      if (!key || el.getAttribute('data-loading')) return;
      el.setAttribute('data-loading', '1');
      el.innerHTML = '<p class="leaders-lazy-msg">Loading…</p>';
      gridHtml(key).then(function(html) {
        el.innerHTML = html;
        el.removeAttribute('data-lazy');
        el.removeAttribute('data-loading');
      }).catch(function() {
        el.removeAttribute('data-loading');
        el.innerHTML = '<p class="leaders-lazy-msg">Could not load. <button type="button" class="leaders-lazy-retry">Try again</button></p>';
        el.querySelector('button').onclick = function() { lazyFill(el); };
      });
    }
    function fillVisible() {
      document.querySelectorAll('[data-lazy]').forEach(function(el) { if (el.offsetParent !== null) lazyFill(el); });
    }
    window.addEventListener('load', function() {
      setTimeout(function() {
        ['#leaders-grid-tot', '#leaders-grid-rec', '#leaders-grid-po'].forEach(function(sel) {
          var first = document.querySelector(sel + ' > [data-lazy]:not([style*="none"])');
          if (first) gridHtml(first.getAttribute('data-lazy')).catch(function() {});
        });
      }, 1500);
    });
    function leadersSwitch(mode) {
      var modes = ['pg','tot','rec'].concat(_hasPlayoffs ? ['po'] : []);
      modes.forEach(function(m) {
        var grid = document.getElementById('leaders-grid-' + m);
        var btn  = document.getElementById('leaders-btn-' + m);
        if (grid) grid.style.display = mode === m ? '' : 'none';
        if (btn)  btn.classList.toggle('leaders-toggle__btn--active', mode === m);
      });
      document.getElementById('leaders-season-pills').style.display = mode === 'rec' ? '' : 'none';
      var poPills = document.getElementById('leaders-po-pills');
      if (poPills) poPills.style.display = mode === 'po' ? '' : 'none';
      document.getElementById('pg-season-pills').style.display = mode === 'pg' ? '' : 'none';
      document.getElementById('tot-season-pills').style.display = mode === 'tot' ? '' : 'none';
      fillVisible();
    }
    function poSwitch(sub) {
      ['pg','tot'].forEach(function(s) {
        var grid = document.getElementById('leaders-grid-po-' + s);
        var btn  = document.getElementById('po-btn-' + s);
        if (grid) grid.style.display = s === sub ? '' : 'none';
        if (btn)  btn.classList.toggle('season-pill--active', s === sub);
      });
      fillVisible();
    }
    function recordsSwitch(scope) {
      _allRecScopes.forEach(function(s) {
        var grid = document.getElementById('rec-grid-' + s);
        var btn  = document.getElementById('rec-btn-' + s);
        if (grid) grid.style.display = s === scope ? '' : 'none';
        if (btn)  btn.classList.toggle('season-pill--active', s === scope);
      });
      fillVisible();
    }
    function pgSeasonSwitch(scope) {
      _allLeaderScopes.forEach(function(s) {
        var grid = document.getElementById('pg-grid-' + s);
        var btn  = document.getElementById('pg-btn-' + s);
        if (grid) grid.style.display = s === scope ? '' : 'none';
        if (btn)  btn.classList.toggle('season-pill--active', s === scope);
      });
      fillVisible();
    }
    function totSeasonSwitch(scope) {
      _allLeaderScopes.forEach(function(s) {
        var grid = document.getElementById('tot-grid-' + s);
        var btn  = document.getElementById('tot-btn-' + s);
        if (grid) grid.style.display = s === scope ? '' : 'none';
        if (btn)  btn.classList.toggle('season-pill--active', s === scope);
      });
      fillVisible();
    }
    async function downloadLeader(btn) {
      if (btn._busy) return;
      btn._busy = true;
      var icon = btn.innerHTML;
      btn.innerHTML = '&hellip;';
      var panel = btn.closest('.card.leader-panel');
      try {
        if (!window._h2cPro) {
          await new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro/dist/html2canvas-pro.min.js';
            s.onload = function() { window._h2cPro = window.html2canvasPro || window.html2canvas; resolve(); };
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        var captured = await window._h2cPro(panel, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          onclone: function(clonedDoc, clonedEl) {
            var acts = clonedEl.querySelector('.leader-panel__actions');
            if (acts) acts.style.display = 'none';
          },
        });
        var PAD = 32;
        var FOOTER_H = 56;
        var W = captured.width + PAD * 2;
        var H = captured.height + PAD * 2 + FOOTER_H;
        var out = document.createElement('canvas');
        out.width = W; out.height = H;
        var ctx = out.getContext('2d');
        ctx.fillStyle = '#0a0e16';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(captured, PAD, PAD);
        ctx.fillStyle = '#475569';
        ctx.font = '600 20px Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WKNDBASKETBALL.COM' + (_asOfLabel ? '   \xB7   ' + _asOfLabel : ''),
          W / 2, captured.height + PAD + Math.round((PAD + FOOTER_H) / 2));
        out.toBlob(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'wknd-' + (btn.dataset.label || 'stat').toLowerCase() + '-' + btn.dataset.mode + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');
        btn.innerHTML = '&#10003;';
        setTimeout(function() { btn.innerHTML = icon; btn._busy = false; }, 1500);
      } catch(e) {
        btn.innerHTML = icon;
        btn._busy = false;
      }
    }
    async function shareLeader(btn) {
      if (btn._busy) return;
      btn._busy = true;
      const icon = btn.innerHTML;
      btn.innerHTML = '&hellip;';
      try {
        const r = await fetch('/api/leaders/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            season:      btn.dataset.season,
            category_id: btn.dataset.catId,
            mode:        btn.dataset.mode,
            player_id:   btn.dataset.playerId,
            player_name: btn.dataset.playerName,
            team_id:     btn.dataset.teamId,
            team_name:   btn.dataset.teamName,
            team_color:  btn.dataset.teamColor,
            stat_label:  btn.dataset.statLabel,
            stat_title:  btn.dataset.statTitle,
            stat_value:  parseFloat(btn.dataset.statValue),
            stat_fmt:    btn.dataset.statFmt,
            game_id:     btn.dataset.gameId,
            game_date:   btn.dataset.gameDate,
            game_opp:    btn.dataset.gameOpp,
            game_result: btn.dataset.gameResult,
            is_playoff:  btn.dataset.isPlayoff,
          })
        });
        const { url } = await r.json();
        await navigator.clipboard.writeText(url);
        btn.innerHTML = '&#10003; Copied';
        btn.classList.add('leader-panel__share--copied');
        setTimeout(() => {
          btn.innerHTML = icon;
          btn.classList.remove('leader-panel__share--copied');
          btn._busy = false;
        }, 2000);
      } catch {
        btn.innerHTML = icon;
        btn._busy = false;
      }
    }
    </script>
  </div>`;
}
