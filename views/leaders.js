import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, playerAvatar } from './utils.js';

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


// ═══════════════════════════════════════════════════════════════════════════════
// Leaders v2 (ld- prefix; mockup: claude.ai/artifact/SzJV3LrfyKT6aVukN3wp2G).
// One model drives the page, the AI section writeups' facts and their fallbacks, so
// what's on screen and what the writer is told can't drift apart. /roast reuses every
// piece below (views/roast.js).
// ═══════════════════════════════════════════════════════════════════════════════

const SHARE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>`;
const DL_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

// Share/download buttons keep the data-* contract /api/leaders/share reads.
function shareBtn(cat, mode, season, best, color, fmt) {
  return `<button type="button" class="ld-act" onclick="shareLeader(this)" aria-label="Share this board" title="Share"
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
    data-stat-fmt="${escHtml(fmt(best.v))}">${SHARE_ICON}</button>`;
}

function recShareBtn(cat, scope, first, color, fmt, mode = 'rec') {
  const ctx    = recordContext(first.r);
  const teamId = first.r.player_team_id || first.r.team_id || '';
  return `<button type="button" class="ld-act" onclick="shareLeader(this)" aria-label="Share this record" title="Share"
    data-season="${escHtml(String(scope))}"
    data-cat-id="${escHtml(cat.id)}"
    data-mode="${escHtml(mode)}"
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
    data-is-playoff="${ctx.isPO ? '1' : '0'}">${SHARE_ICON}</button>`;
}

function downloadBtn(cat, mode, showDownload) {
  if (!showDownload) return '';
  return `<button type="button" class="ld-act" onclick="downloadLeader(this)" aria-label="Download image" title="Download image"
    data-label="${escHtml(cat.label)}" data-mode="${escHtml(mode)}">${DL_ICON}</button>`;
}

// ── Names: "LAST, First" → two lines (first name truncates, last name never does) ──
export function nameParts(raw) {
  const s = String(raw || '').trim();
  const i = s.indexOf(',');
  if (i < 0) return { first: '', last: s.toUpperCase() };
  return { first: s.slice(i + 1).trim(), last: s.slice(0, i).trim().toUpperCase() };
}
// "Vin Salenga" — how the AI writer is told to write names (normal case, not shouty).
export function plainName(raw) {
  const { first, last } = nameParts(raw);
  const cap = w => w.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return [first, cap(last)].filter(Boolean).join(' ');
}
const profileUrl = id => `/players/${encodeURIComponent(String(id || ''))}`;
const teamOf = x => String(x || '').toUpperCase();
const titleTeam = t => teamOf(t).charAt(0) + teamOf(t).slice(1).toLowerCase();

function nameHtml(raw) {
  const n = nameParts(raw);
  return `<span class="ld-name">${n.first ? `<span class="ld-name__first">${escHtml(n.first)}</span>` : ''}<span class="ld-name__last">${escHtml(n.last)}</span></span>`;
}

// Gap to #1, worked out from the DISPLAYED values so it always matches what's on screen.
// Higher-is-better boards read "−1.5"; lowest-is-worst roast boards read "+0.3".
const shownNum = s => parseFloat(String(s).replace('−', '-'));
const decimals = s => ((String(s).match(/\.(\d+)/) || [])[1] || '').length;
function deltaLabel(leadStr, str) {
  const a = shownNum(leadStr), b = shownNum(str);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const r = Math.abs(b - a).toFixed(Math.max(decimals(leadStr), decimals(str)));
  if (Number(r) === 0) return 'TIE';
  return (b < a ? '−' : '+') + r;
}

// ── Board model (top N of one category) ──────────────────────────────────────
// valid: which values count (default: positive). asc: lowest first (roast boards).
export function boardModel(cat, players, { mode, season, fmt, asc = false, valid, take = 5, size = 'sm', title } = {}) {
  const ok = valid || (v => v > 0);
  const ranked = players
    .map(p => ({ p, v: cat.fn(p) }))
    .filter(x => x.v !== null && x.v !== undefined && Number.isFinite(x.v) && ok(x.v))
    .sort((a, b) => (asc ? a.v - b.v : b.v - a.v) || b.p.games_played - a.p.games_played || (b.p.team_wins || 0) - (a.p.team_wins || 0));
  if (!ranked.length) return null;
  const f = cat.fmt || fmt;
  const top = ranked.slice(0, take).map(x => ({ ...x, s: f(x.v) }));
  top.slice(1).forEach(x => { x.delta = deltaLabel(top[0].s, x.s); });
  return { kind: 'board', cat, mode, season, fmt: f, asc, size, title: title || cat.title, sub: cat.sub || '', lead: top[0], rest: top.slice(1) };
}

// ── Record model (single-game bests; also the roast's disasters) ─────────────
const seasonTag = r => {
  const ctx = recordContext(r);
  return `S${r.season}${ctx.isFinals ? ' Finals' : ctx.isPO ? ' Playoffs' : ''}`;
};
export function recordModel(cat, rows, { scope, currentSeason, mode = 'rec' } = {}) {
  const top = buildRecordTop5(rows, cat);
  if (!top.length) return null;
  const f = cat.fmt || (v => String(Math.round(v)));
  top.forEach(x => { x.s = cat.show ? cat.show(x.r) : f(x.v); x.ctx = recordContext(x.r); });
  const [a, b] = top;
  const tied = !!b && b.v === a.v;
  let badge = '', badgeOn = false;
  if (String(a.r.season) === String(currentSeason)) { badge = tied ? 'Tied this season' : 'This season'; badgeOn = true; }
  else if (a.ctx.isFinals) badge = 'Finals';
  else if (a.ctx.isPO) badge = 'Playoffs';
  const foot = !b ? '' : tied
    ? `Also ${b.s}: ${displayPlayerName(b.r.name)} (${seasonTag(b.r)})`
    : `Next ${cat.worst ? 'worst' : 'best'}: ${b.s} — ${displayPlayerName(b.r.name)} (${seasonTag(b.r)})`;
  return { kind: 'record', cat, mode, scope, fmt: f, top, badge, badgeOn, foot, unit: cat.unit ? cat.unit(a.r) : '' };
}

// ── Rendering ────────────────────────────────────────────────────────────────
function avatarHtml(id, raw, color) {
  return playerAvatar(id, displayPlayerName(raw), color, { className: 'ld-av' });
}

function rowHtml(x, rank) {
  const n = nameParts(x.p.name);
  return `<a class="ld-row" href="${profileUrl(x.p.id)}">
        <span class="ld-row__rank font-condensed">${rank}</span>
        <span class="team-dot" style="background:${teamColor(teamOf(x.p.team_name))}"></span>
        <span class="ld-row__name">${n.first ? `<span class="ld-row__first">${escHtml(n.first)}</span>` : ''}<span class="ld-row__last">${escHtml(n.last)}</span></span>
        <span class="ld-row__delta font-condensed">${escHtml(x.delta || '')}</span>
        <b class="ld-row__val font-condensed">${escHtml(x.s)}</b>
      </a>`;
}

function boardCard(b, showDownload) {
  const { cat, lead } = b;
  const team = teamOf(lead.p.team_name);
  const color = teamColor(team);
  const meta = [team, lead.p.games_played ? `${lead.p.games_played} GP` : ''].filter(Boolean).join(' · ');
  return `<article class="ld-card${b.size === 'lg' ? ' ld-card--lg' : ''}" style="--team:${color}">
    <div class="ld-card__top">
      <div class="ld-card__head">
        <span class="ld-card__title">${escHtml(b.title)}${b.sub ? `<small>${escHtml(b.sub)}</small>` : ''}</span>
        <span class="ld-card__side">
          <span class="ld-card__key">${escHtml(cat.min || cat.label)}</span>
          <span class="ld-card__acts">${shareBtn(cat, b.mode, b.season, lead, color, b.fmt)}${downloadBtn(cat, b.mode, showDownload)}</span>
        </span>
      </div>
      <div class="ld-card__lead">
        ${avatarHtml(lead.p.id, lead.p.name, color)}
        <a class="ld-card__who" href="${profileUrl(lead.p.id)}">${nameHtml(lead.p.name)}<span class="ld-meta"><span class="team-dot" style="background:${color}"></span>${escHtml(meta)}</span></a>
        <b class="ld-card__val font-condensed">${escHtml(lead.s)}</b>
      </div>
    </div>
    ${b.rest.length ? `<div class="ld-card__rest">${b.rest.map((x, i) => rowHtml(x, i + 2)).join('')}</div>` : ''}
  </article>`;
}

function fmtDay(d) {
  if (!d) return '';
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function recordTile(t) {
  const first = t.top[0];
  const team = teamOf(first.r.team_name);
  const color = teamColor(team);
  const ctx = first.ctx;
  const when = [fmtDay(first.r.date), `Season ${first.r.season}`, ctx.isFinals ? 'Finals' : ctx.isPO ? 'Playoffs' : ''].filter(Boolean).join(' · ');
  return `<article class="ld-tile" style="--team:${color}">
    <div class="ld-card__head">
      <span class="ld-card__title">${escHtml(t.cat.tileTitle || t.cat.title)}</span>
      <span class="ld-card__side">
        ${t.badge ? `<span class="ld-badge${t.badgeOn ? ' is-on' : ''}">${escHtml(t.badge)}</span>` : ''}
        <span class="ld-card__acts">${recShareBtn(t.cat, t.scope, first, color, t.fmt, t.mode)}</span>
      </span>
    </div>
    <div class="ld-tile__val font-condensed">${escHtml(first.s)}${t.unit ? `<small>${escHtml(t.unit)}</small>` : ''}</div>
    <div class="ld-card__lead">
      ${avatarHtml(first.r.player_id, first.r.name, color)}
      <a class="ld-card__who" href="${profileUrl(first.r.player_id)}">${nameHtml(first.r.name)}<span class="ld-meta"><span class="team-dot" style="background:${color}"></span>${escHtml(team)}</span></a>
    </div>
    <a class="ld-tile__game" href="/games/${encodeURIComponent(String(first.r.game_id || ''))}"><b>vs ${escHtml(teamOf(ctx.opp))} · ${escHtml(ctx.result)}</b><span>${escHtml(when)}</span></a>
    ${t.foot ? `<p class="ld-tile__foot">${escHtml(t.foot)}</p>` : ''}
  </article>`;
}

// section: { id, nav, title, sub, link?, writeup, items: [board|record models], cols }
function sectionHtml(sec, showDownload) {
  const items = sec.items.filter(Boolean);
  if (!items.length) return '';
  return `<section class="ld-sec" id="ld-${escHtml(sec.id)}" data-ld-sec>
  <div class="section-header"><h2>${escHtml(sec.title)}${sec.sub ? ` <span class="section-header__sub">${escHtml(sec.sub)}</span>` : ''}</h2>${sec.link ? `<a href="${escHtml(sec.link.href)}" class="section-header__link">${escHtml(sec.link.label)} <span>&rarr;</span></a>` : ''}</div>
  ${sec.writeup ? `<p class="ld-desc">${escHtml(sec.writeup)}</p>` : ''}
  <div class="ld-grid ld-grid--${sec.cols || 4}">
    ${items.map(m => m.kind === 'record' ? recordTile(m) : boardCard(m, showDownload)).join('\n    ')}
  </div>
</section>`;
}

// ── Facts for the AI writer (built from the same models the page renders) ────
function boardFacts(b, scopeLabel) {
  const all = [b.lead, ...b.rest];
  const lines = all.map((x, i) => {
    const tie = i > 0 && x.delta === 'TIE' ? ' (tied with #1)' : '';
    return `${i + 1}. ${plainName(x.p.name)} (${titleTeam(x.p.team_name)}, ${x.p.games_played} games) ${x.s}${tie}`;
  }).join('; ');
  const gap = b.rest[0] && b.rest[0].delta && b.rest[0].delta !== 'TIE'
    ? ` Gap from #1 to #2: ${b.rest[0].delta.replace(/^[−+]/, '')}.` : '';
  const dir = b.asc ? 'lowest is "worst", ranked first' : 'highest first';
  return `- ${b.title} (${b.cat.label}${b.cat.min ? `, minimum ${b.cat.min}` : ''}, ${scopeLabel}, ${dir}): ${lines}.${gap}`;
}
function recordFacts(t, currentSeason) {
  const line = x => {
    const c = x.ctx;
    const stage = c.isFinals ? 'Finals' : c.isPO ? 'playoffs' : 'regular season';
    return `${x.s} — ${plainName(x.r.name)} (${titleTeam(x.r.team_name)}) vs ${titleTeam(c.opp)}, ${fmtDay(x.r.date)}, Season ${x.r.season} ${stage}, ${c.won ? 'won' : 'lost'} ${c.myScore}–${c.opScore}`;
  };
  const [a, ...others] = t.top;
  const scope = t.scope === 'alltime' ? 'across all seasons' : `in Season ${t.scope}`;
  const label = t.cat.worst ? `Worst single game ${scope}` : `Single-game record ${scope}`;
  const thisSeason = String(a.r.season) === String(currentSeason)
    ? ' (set this season)'
    : ` (set in Season ${a.r.season}, an earlier season; the current season is Season ${currentSeason})`;
  return `- ${label}, ${t.cat.tileTitle || t.cat.title}${t.unit ? ` (${t.unit})` : ''}: ${line(a)}${thisSeason}. Next: ${others.slice(0, 2).map(line).join('; ') || 'none'}.`;
}
export function sectionFacts(sec, { scopeLabel, currentSeason }) {
  const items = sec.items.filter(Boolean);
  if (!items.length) return '';
  return `${sec.title}:\n${items.map(m => m.kind === 'record' ? recordFacts(m, currentSeason) : boardFacts(m, scopeLabel)).join('\n')}`;
}

// ── Leaders page model ───────────────────────────────────────────────────────
const cat = (list, id) => list.find(c => c.id === id);
const NOUN = { pts: 'scoring', reb: 'rebounding', ast: 'assists', per: 'efficiency', stl: 'steals', blk: 'blocks', fg3m: 'threes', ftm: 'free throws made' };
function leadersLine(items) {
  const parts = items.filter(Boolean).map(b => `${plainName(b.lead.p.name)} in ${NOUN[b.cat.id] || b.cat.title.toLowerCase()} (${b.lead.s})`);
  return parts.length ? `Leaders: ${parts.join(', ')}.` : '';
}

// Record tiles chosen for the per-game view (the full 16 live under Stats → Records).
const RECORD_TILE_IDS = ['pts', 'reb', 'ast', 'stl', 'blk', 'fg3m'];
const RECORD_TITLES = { pts: 'Points', per: 'PER', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks', fg3m: '3-pointers', fg4m: '4-pointers', ftm: 'Free throws made', fgp: 'FG %', tsp: 'True shooting', fg3p: '3PT %', fg4p: '4PT %', ftp: 'FT %' };
const recCat = id => { const c = cat(RECORD_CATS, id); return c && { ...c, tileTitle: RECORD_TITLES[id] || c.title }; };

// stats: 'pg' | 'tot' | 'rec' | 'po'; season: number | 'alltime'
export function buildLeadersModel({ stats, season, currentSeason, players = [], careerPlayers = [], gameRecords = [], seasons = [] }) {
  const isAll = season === 'alltime';
  const shareSeason = isAll ? 'alltime' : String(season);
  const sections = [];

  if (stats === 'rec') {
    const rows = isAll ? gameRecords : gameRecords.filter(r => String(r.season) === String(season));
    const tiles = ids => ids.map(id => recordModel(recCat(id), rows, { scope: shareSeason, currentSeason }));
    const where = isAll ? 'across all seasons' : `in Season ${season}`;
    sections.push({ id: 'big-nights', nav: 'Big nights', title: 'Big nights', sub: isAll ? 'all seasons' : `Season ${season}`, cols: 3,
      items: tiles(['pts', 'per', 'reb', 'ast', 'stl', 'blk']), fallback: `The best single-game lines ${where}, regular season and playoffs.` });
    sections.push({ id: 'shooting-nights', nav: 'Shooting', title: 'Shooting nights', sub: 'minimum attempts noted', cols: 3,
      items: tiles(['fg3m', 'fg4m', 'ftm', 'fgp', 'tsp', 'fg3p', 'fg4p', 'ftp']), fallback: `The best shooting games ${where}. Percentages need a minimum number of attempts in that game.` });
    return { stats, season, sections, also: [] };
  }

  const isTot = stats === 'tot';
  const list = isTot ? TOTALS : PER_GAME;
  const fmt = isTot ? fmtTotals : fmtPerGame;
  const mode = stats === 'po' ? 'po-pg' : stats;
  const board = (id, size, title) => boardModel(cat(list, id), players, { mode, season: shareSeason, fmt, size, title });
  const unit = isTot ? 'season totals' : stats === 'po' ? 'playoffs · per game' : 'per game';

  const races = ['pts', 'reb', 'ast', 'per'].map(id => board(id, 'lg', { pts: 'Scoring', reb: 'Rebounds', ast: 'Assists', per: 'Efficiency' }[id]));
  sections.push({ id: 'races', nav: 'Races', title: 'Headline races', sub: `${unit} · gap to #1`, items: races, fallback: leadersLine(races) });

  if (stats === 'pg') {
    sections.push({ id: 'shooting', nav: 'Shooting', title: 'Shooting', sub: 'qualified shooters only',
      items: [board('fgp', 'sm', 'FG %'), board('tsp', 'sm', 'True shooting'), board('fg3p', 'sm', '3PT %'), board('ftp', 'sm', 'Free throws')],
      fallback: 'Qualified shooters only: 10+ field-goal attempts for FG% and true shooting, 5+ attempts for 3PT% and free throws.' });
  }
  const spec = [board('stl', 'sm', 'Steals'), board('blk', 'sm', 'Blocks'), board('fg3m', 'sm', '3-pointers'), board('ftm', 'sm', 'Free throws made')];
  sections.push({ id: 'specialists', nav: 'Defense', title: 'Defense & specialists', sub: unit, items: spec, fallback: leadersLine(spec) });

  if (stats === 'pg') {
    sections.push({ id: 'records', nav: 'Records', title: 'Single-game records', sub: 'all seasons', cols: 3,
      link: { href: `/leaders?stats=rec&season=alltime`, label: 'All records' },
      items: RECORD_TILE_IDS.map(id => recordModel(recCat(id), gameRecords, { scope: 'alltime', currentSeason })),
      fallback: 'The best single-game marks across all seasons, regular season and playoffs.' });
    if (!isAll && careerPlayers.length) {
      const span = seasons.length > 1 ? `Seasons ${Math.min(...seasons)}–${Math.max(...seasons)}` : 'all seasons';
      const career = ['pts', 'per', 'reb', 'ast'].map(id => boardModel(cat(PER_GAME, id), careerPlayers,
        { mode: 'pg', season: 'alltime', fmt: fmtPerGame, take: 3, title: { pts: 'Scoring', per: 'Efficiency', reb: 'Rebounds', ast: 'Assists' }[id] }));
      sections.push({ id: 'career', nav: 'Career', title: 'Career leaders', sub: `per game, ${span}`,
        link: { href: `/leaders?stats=pg&season=alltime`, label: 'All-time boards' },
        items: career, fallback: `Per-game averages across every season played, ${span}.` });
    }
  }

  // Thin categories: one line each instead of a card.
  const also = [];
  if (stats !== 'tot') {
    for (const id of ['fg4m', 'fg4p']) {
      const b = boardModel(cat(PER_GAME, id), players, { mode, season: shareSeason, fmt: fmtPerGame, take: 1 });
      if (b) also.push({ label: id === 'fg4m' ? '4-pointers' : '4PT %', name: displayPlayerName(b.lead.p.name), value: b.lead.s, id: b.lead.p.id });
    }
  } else {
    const b = boardModel(cat(TOTALS, 'fg4m'), players, { mode, season: shareSeason, fmt: fmtTotals, take: 1 });
    if (b) also.push({ label: '4-pointers', name: displayPlayerName(b.lead.p.name), value: b.lead.s, id: b.lead.p.id });
  }
  return { stats, season, sections, also };
}

// ── Page chrome shared with /roast ───────────────────────────────────────────
// Sticky controls: real GET form (works without JS); the page script swaps the content
// in place on change. fields: [{ name, label, value, options: [{ value, label }] }]
export function controlsBar({ action, title, fields, sections }) {
  const field = f => `<label class="ld-field">
      <span class="ld-field__k">${escHtml(f.label)}</span>
      <select name="${escHtml(f.name)}" class="ld-field__select">
        ${f.options.map(o => `<option value="${escHtml(String(o.value))}"${String(o.value) === String(f.value) ? ' selected' : ''}>${escHtml(o.label)}</option>`).join('')}
      </select>
    </label>`;
  const nav = sections.filter(s => s.items.some(Boolean));
  return `<form class="ld-bar" action="${escHtml(action)}" method="get" data-ld-bar>
    <span class="ld-bar__mini">${escHtml(title)}</span>
    <div class="ld-bar__fields">${fields.map(field).join('')}</div>
    <noscript><button type="submit" class="ld-bar__go">Go</button></noscript>
    ${nav.length > 1 ? `<nav class="ld-bar__nav" aria-label="Sections">${nav.map(s => `<a href="#ld-${escHtml(s.id)}" data-spy="ld-${escHtml(s.id)}">${escHtml(s.nav)}</a>`).join('')}</nav>` : ''}
  </form>`;
}

export function pageHead({ kicker, title, meta }) {
  return `<div class="ld-head">
    <span class="ld-kicker">${escHtml(kicker)}</span>
    <h1>${escHtml(title)}</h1>
    ${meta ? `<p class="ld-head__meta">${meta}</p>` : ''}
  </div>`;
}

export function sectionsHtml(sections, writeups, showDownload) {
  return sections.map(s => sectionHtml({ ...s, writeup: (writeups && writeups[s.id]) || s.fallback }, showDownload)).join('\n');
}

const STATS_OPTIONS = [
  { value: 'pg', label: 'Per game' }, { value: 'tot', label: 'Totals' },
  { value: 'rec', label: 'Single-game records' }, { value: 'po', label: 'Playoffs' },
];

// v: { model, seasons, currentSeason, kicker, meta, summaryHtml, writeups, showDownload, emptyMsg }
export function leadersPage(v) {
  const { model } = v;
  const seasonOpts = [...v.seasons.map(s => ({ value: s, label: `Season ${s}` })), { value: 'alltime', label: 'All-time' }];
  const bar = controlsBar({
    action: '/leaders', title: 'Leaders', sections: model.sections,
    fields: [
      { name: 'stats', label: 'Stats', value: model.stats, options: STATS_OPTIONS },
      { name: 'season', label: 'Season', value: model.season, options: seasonOpts },
    ],
  });
  const body = model.sections.some(s => s.items.some(Boolean))
    ? sectionsHtml(model.sections, v.writeups, v.showDownload)
    : `<div class="ld-empty">${escHtml(v.emptyMsg || 'Nothing to show for this selection yet.')}</div>`;
  const also = model.also.length ? `<div class="ld-also">
    <span class="ld-also__k">Also tracked</span>
    ${model.also.map(a => `<span>${escHtml(a.label)} <a href="${profileUrl(a.id)}">${escHtml(a.name)}</a> <b class="font-condensed">${escHtml(a.value)}</b></span>`).join('')}
    <a href="/roast" class="ld-also__roast">Most turnovers &amp; fouls live on The Roast <span>&rarr;</span></a>
  </div>` : '';
  return `<div class="ld-page" data-ld-page data-as-of="${escHtml(v.asOfLabel || '')}">
  ${pageHead({ kicker: v.kicker, title: 'League leaders', meta: v.meta })}
  ${v.summaryHtml || ''}
  ${bar}
  <div class="ld-body">
    ${body}
    ${also}
  </div>
</div>`;
}

// ── Page script (once per full page load; survives in-place content swaps) ───
export function leadersScript({ isAdmin = false, regen = null } = {}) {
  return `<script>
(function () {
  var root = document.documentElement;
  function setTop() {
    var h = document.querySelector('.site-header');
    root.style.setProperty('--ld-top', (h ? h.getBoundingClientRect().height : 0) + 'px');
  }
  setTop(); window.addEventListener('resize', setTop);

  // Sticky bar: .is-stuck once it pins (shows the mini title, adds the backdrop).
  var observer = null;
  function watchBar() {
    var bar = document.querySelector('[data-ld-bar]');
    if (!bar || !('IntersectionObserver' in window)) return;
    if (observer) observer.disconnect();
    var top = parseFloat(getComputedStyle(bar).top) || 0;
    observer = new IntersectionObserver(function (es) {
      es.forEach(function (e) { bar.classList.toggle('is-stuck', e.intersectionRatio < 1 && e.boundingClientRect.top <= top + 1); });
    }, { rootMargin: '-' + (top + 1) + 'px 0px 0px 0px', threshold: [1] });
    observer.observe(bar);
  }

  // Where the bar's bottom edge sits once pinned: its sticky top (header + gap) plus its height.
  function stuckBottom() {
    var bar = document.querySelector('[data-ld-bar]');
    return bar ? (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 0;
  }
  function setOn(on) {
    document.querySelectorAll('.ld-bar__nav [data-spy]').forEach(function (a) { a.classList.toggle('is-on', a === on); });
  }

  // Scroll-spy: the last section whose top has passed just under the pinned bar lights its
  // link. At the very bottom of the page the last section can't scroll up that far, so it
  // wins as soon as its top is on screen. Paused while a nav click is animating.
  var ticking = false, lock = null;
  function spy() {
    ticking = false;
    if (lock) return;
    var links = [].slice.call(document.querySelectorAll('.ld-bar__nav [data-spy]'));
    if (!links.length) return;
    var line = stuckBottom() + 40;
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    var on = links[0];
    links.forEach(function (a) {
      var s = document.getElementById(a.dataset.spy); if (!s) return;
      var top = s.getBoundingClientRect().top;
      if (top <= line || (atEnd && top < window.innerHeight)) on = a;
    });
    setOn(on);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });

  // Nav click: light the clicked link right away and glide the section up to just under the
  // pinned bar. Done in JS because the site-wide html scroll-padding-top would otherwise
  // stack on top of the bar's offset and park the section ~100px too low.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.ld-bar__nav [data-spy]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var sec = document.getElementById(a.dataset.spy);
    if (!sec) return;
    e.preventDefault();
    setOn(a);
    a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    var y = Math.max(0, window.scrollY + sec.getBoundingClientRect().top - stuckBottom());
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(lock);
    // Hold the spy until the glide settles (scrollend where supported, a timer as backstop).
    lock = setTimeout(function () { lock = null; }, 1200);
    window.addEventListener('scrollend', function () { clearTimeout(lock); lock = null; }, { once: true });
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + sec.id);
  });

  // Dropdown change: fetch the same URL with partial=1 and swap the page content in place.
  document.addEventListener('change', function (e) {
    var form = e.target.closest && e.target.closest('[data-ld-bar]');
    if (!form) return;
    var params = new URLSearchParams(new FormData(form));
    var url = form.getAttribute('action') + '?' + params.toString();
    var page = document.querySelector('[data-ld-page]');
    page.classList.add('is-loading');
    params.set('partial', '1');
    fetch(form.getAttribute('action') + '?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var keepY = window.scrollY, barTop = form.getBoundingClientRect().top;
        page.outerHTML = html;
        history.replaceState(null, '', url);
        var bar = document.querySelector('[data-ld-bar]');
        // Keep the bar where it was on screen so the change doesn't jump the page.
        if (bar) window.scrollTo(0, Math.max(0, keepY + bar.getBoundingClientRect().top - barTop));
        watchBar(); spy();
      })
      .catch(function () { location.href = url; });
  });

  watchBar(); spy();
${isAdmin && regen ? `
  // Admin: the summary's Regenerate rewrites the page summary and the section writeups.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ld-page .hs-summary__regen');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Writing…';
    var post = function (url, body) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); });
    };
    Promise.all(${JSON.stringify(regen)}.map(function (x) { return post(x.url, x.body); }))
      .then(function () { location.reload(); })
      .catch(function (err) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(err.message); });
  });` : ''}
})();

async function downloadLeader(btn) {
  if (btn._busy) return;
  btn._busy = true;
  var icon = btn.innerHTML;
  btn.innerHTML = '&hellip;';
  var panel = btn.closest('.ld-card, .ld-tile');
  var asOf = (document.querySelector('[data-ld-page]') || {}).dataset ? document.querySelector('[data-ld-page]').dataset.asOf : '';
  try {
    if (!window._h2cPro) {
      await new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro/dist/html2canvas-pro.min.js';
        s.onload = function () { window._h2cPro = window.html2canvasPro || window.html2canvas; resolve(); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    var captured = await window._h2cPro(panel, {
      backgroundColor: null, scale: 2, useCORS: true, logging: false,
      scrollX: -window.scrollX, scrollY: -window.scrollY,
      onclone: function (clonedDoc, clonedEl) {
        var acts = clonedEl.querySelector('.ld-card__acts');
        if (acts) acts.style.display = 'none';
      },
    });
    var PAD = 32, FOOTER_H = 56;
    var W = captured.width + PAD * 2, H = captured.height + PAD * 2 + FOOTER_H;
    var out = document.createElement('canvas');
    out.width = W; out.height = H;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#0a0e16'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(captured, PAD, PAD);
    ctx.fillStyle = '#475569'; ctx.font = '600 20px Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WKNDBASKETBALL.COM' + (asOf ? '   \\xB7   ' + asOf : ''), W / 2, captured.height + PAD + Math.round((PAD + FOOTER_H) / 2));
    out.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'wknd-' + (btn.dataset.label || 'stat').toLowerCase() + '-' + btn.dataset.mode + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
    btn.innerHTML = '&#10003;';
    setTimeout(function () { btn.innerHTML = icon; btn._busy = false; }, 1500);
  } catch (e) {
    btn.innerHTML = icon; btn._busy = false;
  }
}

async function shareLeader(btn) {
  if (btn._busy) return;
  btn._busy = true;
  var icon = btn.innerHTML;
  btn.innerHTML = '&hellip;';
  try {
    var d = btn.dataset;
    var r = await fetch('/api/leaders/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season: d.season, category_id: d.catId, mode: d.mode,
        player_id: d.playerId, player_name: d.playerName, team_id: d.teamId, team_name: d.teamName, team_color: d.teamColor,
        stat_label: d.statLabel, stat_title: d.statTitle, stat_value: parseFloat(d.statValue), stat_fmt: d.statFmt,
        game_id: d.gameId, game_date: d.gameDate, game_opp: d.gameOpp, game_result: d.gameResult, is_playoff: d.isPlayoff,
      })
    });
    var url = (await r.json()).url;
    await navigator.clipboard.writeText(url);
    btn.innerHTML = '&#10003;';
    btn.classList.add('is-copied');
    btn.setAttribute('aria-label', 'Link copied');
    setTimeout(function () { btn.innerHTML = icon; btn.classList.remove('is-copied'); btn.setAttribute('aria-label', 'Share this board'); btn._busy = false; }, 2000);
  } catch (e) {
    btn.innerHTML = icon; btn._busy = false;
  }
}
</script>`;
}
