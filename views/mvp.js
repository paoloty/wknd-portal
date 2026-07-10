import { escHtml } from './layout.js';
import { displayPlayerName, teamColor, initials } from './utils.js';
import { highlightsSidebar } from './home.js';

const RANK_LABELS = ['', 'FRONTRUNNER', 'CLOSE SECOND', 'IN THE MIX', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE'];

const BADGE_COLORS = [
  null,
  { bg: '#f59332', text: '#10141d' }, // 1 — FRONTRUNNER  (amber)
  { bg: '#3b82f6', text: '#fff' },    // 2 — CLOSE SECOND (blue)
  { bg: '#8b5cf6', text: '#fff' },    // 3 — IN THE MIX   (purple)
  { bg: '#374151', text: '#9ca3af' }, // 4+ — DARK HORSE  (slate)
];

function tsPct(r) {
  const d = 2 * (r.fga + 0.44 * r.fta);
  return d > 0 ? r.pts / d : 0;
}

function standingsSidebar(teams, games, season) {
  const regularGames = (games || []).filter(g =>
    g.game_type === 'regular' && !g.under_review && g.season === season &&
    (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const rows = (teams || []).map(team => {
    let w = 0, l = 0, pf = 0, pa = 0;
    for (const g of regularGames) {
      const isA = g.team_a_id === team.id;
      const isB = g.team_b_id === team.id;
      if (!isA && !isB) continue;
      const tf = isA ? Number(g.team_a_score) : Number(g.team_b_score);
      const ta = isA ? Number(g.team_b_score) : Number(g.team_a_score);
      pf += tf; pa += ta;
      if (tf > ta) w++; else l++;
    }
    return { team, wins: w, losses: l, quo: pa > 0 ? pf / pa : 0 };
  });

  rows.sort((a, b) => b.wins - a.wins || b.quo - a.quo);

  const head = `<div class="standings-row standings-row--head">
  <div class="standings-cell standings-cell--seed"></div>
  <div class="standings-cell standings-cell--team">TEAM</div>
  <div class="standings-cell standings-cell--num standings-cell--w st-std">W</div>
  <div class="standings-cell standings-cell--num standings-cell--l st-std">L</div>
</div>`;

  const rowsHtml = rows.map((r, i) => {
    const color = teamColor(r.team.name);
    const seed  = i + 1;
    const seedClass = seed <= 2 ? 'seed--top' : 'seed--mid';
    return `<div class="standings-row${i === 0 ? ' standings-row--first' : ''}" style="--tc-color:${color}">
  <div class="standings-cell standings-cell--seed">
    <span class="standings-seed ${seedClass}">${seed}</span>
  </div>
  <div class="standings-cell standings-cell--team">
    <span class="team-dot" style="background:${color}"></span>
    <span class="standings-team-name">${escHtml(r.team.name.toUpperCase())}</span>
  </div>
  <div class="standings-cell standings-cell--num standings-cell--w st-std">${r.wins}</div>
  <div class="standings-cell standings-cell--num standings-cell--l st-std">${r.losses}</div>
</div>`;
  }).join('');

  return `<div class="card sidebar mvp-standings-sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">STANDINGS <a href="/standings" class="card-label__more">Full table</a></div>
  <div class="standings-scroll">
    ${head}
    ${rowsHtml}
  </div>
</div>`;
}

function mvpLadderSidebar(candidates) {
  const top = candidates.slice(0, 10);

  const head = `<div class="mvp-sb-row mvp-sb-row--head">
  <span class="mvp-sb-rank"></span>
  <span class="mvp-sb-name" style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--text-muted)">PLAYER</span>
  <span class="mvp-sb-num">PER</span>
  <span class="mvp-sb-num">TS%</span>
  <span class="mvp-sb-score" style="color:var(--text-muted);font-weight:700">SCR</span>
</div>`;

  const rowsHtml = top.map((c, i) => {
    const rank   = i + 1;
    const name   = displayPlayerName(c.player.name);
    const color  = teamColor(c.stats.team_name);
    const href   = `/players/${encodeURIComponent(String(c.player.id))}`;
    const gp     = c.stats.gp || 1;
    const s      = c.stats;
    const per    = (s.pts + 0.4*s.fgm - 0.7*s.fga - 0.4*s.ftmiss + 0.7*s.reb + s.stl + 0.7*s.ast + 0.7*s.blk - s.tov) / gp;
    const tsDenom = 2 * (s.fga + 0.44 * s.fta);
    const ts     = tsDenom > 0 ? Math.round(s.pts / tsDenom * 100) + '%' : '—';
    const score  = c.mvpScore.toFixed(1);
    const badge  = BADGE_COLORS[rank] || BADGE_COLORS[4];
    return `<a href="${href}" class="mvp-sb-row${rank === 1 ? ' mvp-sb-row--first' : ''}" style="--bc:${badge.bg}">
  <span class="mvp-sb-rank">${rank}</span>
  <span class="mvp-sb-name">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="mvp-sb-name-text">${escHtml(name)}</span>
  </span>
  <span class="mvp-sb-num mvp-sb-cell--r">${per.toFixed(1)}</span>
  <span class="mvp-sb-num mvp-sb-cell--r">${ts}</span>
  <span class="mvp-sb-score mvp-sb-cell--r">${score}</span>
</a>`;
  }).join('\n');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">MVP LADDER</div>
  <div class="mvp-sb-table">
    ${head}
    ${rowsHtml}
  </div>
</div>`;
}

function categoryLeadersSidebar(leagueStats) {
  if (!leagueStats || !leagueStats.length) return '';

  const calcPer = s => (s.pts + 0.4*s.fgm - 0.7*s.fga - 0.4*s.ftmiss + 0.7*s.reb + s.stl + 0.7*s.ast + 0.7*s.blk - s.tov) / (s.gp || 1);

  const cats = [
    { label: 'PTS', fn: s => s.pts / (s.gp||1), fmt: v => v.toFixed(1) },
    { label: 'REB', fn: s => s.reb / (s.gp||1), fmt: v => v.toFixed(1) },
    { label: 'AST', fn: s => s.ast / (s.gp||1), fmt: v => v.toFixed(1) },
    { label: 'STL', fn: s => s.stl / (s.gp||1), fmt: v => v.toFixed(1) },
    { label: 'TS%', fn: s => { const d = 2*(s.fga + 0.44*s.fta); return d > 0 ? s.pts/d : 0; }, fmt: v => Math.round(v*100)+'%' },
    { label: 'PER', fn: calcPer, fmt: v => v.toFixed(1) },
  ];

  const rows = cats.map(cat => {
    const best = [...leagueStats].sort((a, b) => cat.fn(b.stats) - cat.fn(a.stats))[0];
    if (!best) return '';
    const name  = displayPlayerName(best.player.name);
    const color = teamColor(best.stats.team_name);
    const val   = cat.fmt(cat.fn(best.stats));
    return `<div class="mvp-cl-row">
  <span class="mvp-cl-cat">${cat.label}</span>
  <span class="mvp-cl-player">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="mvp-cl-name">${escHtml(name)}</span>
  </span>
  <span class="mvp-cl-val">${escHtml(val)}</span>
</div>`;
  }).join('');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">STAT LEADERS</div>
  ${rows}
</div>`;
}

function top3ComparisonSidebar(candidates) {
  const seen = new Set();
  const top3 = [];
  for (const c of candidates) {
    const team = c.stats.team_name;
    if (!seen.has(team)) { seen.add(team); top3.push(c); }
    if (top3.length === 3) break;
  }
  if (top3.length < 2) return '';

  const lastName = fullName => {
    const parts = displayPlayerName(fullName).split(' ');
    return parts[parts.length - 1];
  };

  const cats = [
    { label: 'PPG', fn: (s) => (s.pts/(s.gp||1)).toFixed(1) },
    { label: 'RPG', fn: (s) => (s.reb/(s.gp||1)).toFixed(1) },
    { label: 'APG', fn: (s) => (s.ast/(s.gp||1)).toFixed(1) },
    { label: 'TS%', fn: (s) => { const d = 2*(s.fga + 0.44*s.fta); return d > 0 ? Math.round(s.pts/d*100)+'%' : '—'; } },
    { label: 'SCR', fn: (s, c) => c.mvpScore.toFixed(1) },
  ];

  const head = `<div class="mvp-cmp-row mvp-cmp-row--head">
  <span class="mvp-cmp-label"></span>
  ${top3.map((c, i) => `<span class="mvp-cmp-name${i===0?' mvp-cmp-name--gold':''}">${escHtml(lastName(c.player.name))}</span>`).join('')}
</div>`;

  const dataRows = cats.map(cat => {
    const vals = top3.map(c => cat.fn(c.stats, c));
    const nums = vals.map(v => parseFloat(v));
    const max  = Math.max(...nums.filter(n => !isNaN(n)));
    return `<div class="mvp-cmp-row">
  <span class="mvp-cmp-label">${cat.label}</span>
  ${vals.map((v, i) => `<span class="mvp-cmp-val${parseFloat(v) === max ? ' mvp-cmp-val--hi' : ''}">${v}</span>`).join('')}
</div>`;
  }).join('');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">TEAM FRONTRUNNERS</div>
  ${head}
  ${dataRows}
</div>`;
}

function mvpRow(c, rank) {
  const { player, stats, mvpScore, writeup } = c;
  const name  = displayPlayerName(player.name);
  const color = teamColor(stats.team_name);
  const label = RANK_LABELS[rank] || 'CONTENDER';
  const badge = BADGE_COLORS[rank] || BADGE_COLORS[4];
  const rankStr = String(rank).padStart(2, '0');
  const init  = initials(player.name);
  const href  = `/players/${encodeURIComponent(String(player.id))}`;

  return `<a href="${href}" class="mvp-row" style="--tc:${color};--bc:${badge.bg};--bt:${badge.text}">
  <div class="mvp-row__pills">
    <span class="mvp-row__score" style="color:${badge.bg}">${mvpScore.toFixed(1)}</span>
    <span class="mvp-row__badge" style="background:${badge.bg};color:${badge.text}">${label}</span>
  </div>
  <div class="mvp-row__thumb">
    <div class="mvp-row__thumb-placeholder"><span class="font-condensed">${escHtml(init)}</span></div>
    <img src="/api/player/${encodeURIComponent(String(player.id))}/photo" alt="" loading="lazy" class="mvp-row__thumb-img" onerror="this.style.display='none'">
    <div class="mvp-row__thumb-flare" style="background:linear-gradient(135deg,${color}44 0%,transparent 55%)"></div>
    <span class="mvp-row__rank">${rankStr}</span>
  </div>
  <div class="mvp-row__body">
    <div class="mvp-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</div>
    ${writeup
      ? `<p class="mvp-row__article">${escHtml(writeup)}</p>`
      : `<p class="mvp-row__article mvp-row__article--pending">Analysis generating…</p>`}
    <span class="mvp-row__cta">FULL STATS <span>→</span></span>
  </div>
</a>`;
}

export function mvpPage({ candidates = [], season, totalGames, seasonGames, highlights = [], teams = [], games = [], leagueStats = [] }) {
  const ladderSidebar  = candidates.length ? mvpLadderSidebar(candidates) : '';
  const catLeaders     = categoryLeadersSidebar(leagueStats);
  const top3           = top3ComparisonSidebar(candidates);
  const recentStandouts = highlights.length ? highlightsSidebar(highlights, { limit: 3, seeAllLink: false }) : '';
  // const standingsSide = standingsSidebar(teams, games, season);
  const sidebarHtml    = `<div style="display:flex;flex-direction:column;gap:24px;min-width:0">${ladderSidebar}${catLeaders}${top3}${recentStandouts}</div>`;

  if (!candidates.length) {
    return `<div class="games-layout">
  <div class="games-main">
    <div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No games played yet this season.</div>
  </div>
  ${sidebarHtml}
</div>`;
  }

  const hasAllWriteups = candidates.every(c => c.writeup);

  return `<div class="games-layout">
  <div class="games-main">
    <div class="card mvp-list">
      <div class="card-label">MVP LADDER &nbsp;·&nbsp; Season ${escHtml(String(season))} &nbsp;·&nbsp; ${escHtml(String(totalGames))}/${escHtml(String(seasonGames * 2))} games</div>
      ${candidates.map((c, i) => mvpRow(c, i + 1)).join('\n      ')}
    </div>
  </div>
  ${sidebarHtml}
</div>

${!hasAllWriteups ? `<script>setTimeout(function(){ location.reload(); }, 8000);</script>` : ''}`;
}
