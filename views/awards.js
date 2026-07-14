import { escHtml } from './layout.js';
import { displayPlayerName, teamColor, initials } from './utils.js';

// ── Award badge config ────────────────────────────────────────────────────────
const AWARD_BADGE = {
  mvp:             { label: 'SEASON MVP',       bg: '#f59332', text: '#10141d' },
  dpoy:            { label: 'BEST DEFENDER',    bg: '#3b82f6', text: '#fff'    },
  all_wknd_1:      { label: '1ST TEAM',         bg: '#22c55e', text: '#000'    },
  all_wknd_2:      { label: '2ND TEAM',         bg: '#64748b', text: '#fff'    },
  all_wknd_def:    { label: 'DEF TEAM',         bg: '#3b82f6', text: '#fff'    },
  scoring_champ:   { label: 'SCORING CHAMP',    bg: '#f59332', text: '#10141d' },
  assists_leader:  { label: 'ASSISTS LEADER',   bg: '#f59332', text: '#10141d' },
  rebounds_leader: { label: 'REBOUNDS LEADER',  bg: '#f59332', text: '#10141d' },
  steals_leader:   { label: 'STEALS LEADER',    bg: '#f59332', text: '#10141d' },
  blocks_leader:   { label: 'BLOCKS LEADER',    bg: '#f59332', text: '#10141d' },
  three_pm_leader: { label: '3-PT LEADER',      bg: '#f59332', text: '#10141d' },
};

const GROUPS = [
  { label: 'Season Awards',            types: ['mvp', 'dpoy'] },
  { label: 'All WKND 1st Team',       types: ['all_wknd_1']  },
  { label: 'All WKND 2nd Team',       types: ['all_wknd_2']  },
  { label: 'All WKND Defensive Team', types: ['all_wknd_def'] },
  { label: 'Statistical Leaders',     types: ['scoring_champ', 'assists_leader', 'rebounds_leader', 'steals_leader', 'blocks_leader', 'three_pm_leader'] },
];

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POSITION_ORDER = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

// ── Stat helpers ──────────────────────────────────────────────────────────────
function norm(p) {
  const gp     = p.games_played || 1;
  const fgm    = (p.fg2m || 0) + (p.fg3m || 0);
  const fga    = fgm + (p.fg2m_miss || 0) + (p.fg3m_miss || 0);
  const fta    = (p.ftm || 0) + (p.ft_miss || 0);
  const ftmiss = p.ft_miss || 0;
  const tov    = p.turnover || 0;
  const per    = (p.pts + 0.4*fgm - 0.7*fga - 0.4*ftmiss + 0.7*p.reb + p.stl + 0.7*p.ast + 0.7*p.blk - tov) / gp;
  const tsDenom = 2 * (fga + 0.44 * fta);
  const ts      = tsDenom > 0 ? p.pts / tsDenom : 0;
  const base    = p.pts/gp + (p.reb/gp)*0.8 + (p.ast/gp)*0.9 + (p.stl/gp)*1.5 + (p.blk/gp)*2 - (tov/gp);
  let effMult = 1.00;
  if (tsDenom > 0) {
    if      (ts >= 0.70) effMult = 1.20;
    else if (ts >= 0.60) effMult = 1.10;
    else if (ts >= 0.50) effMult = 1.00;
    else if (ts >= 0.40) effMult = 0.85;
    else                 effMult = 0.70;
  }
  const mvpScore = base * effMult;
  return { ...p, gp, fgm, fga, fta, ftmiss, tov, per, ts, mvpScore };
}

function statLine(row, type) {
  const gp  = row.games_played || 1;
  const avg = v => v != null ? (v / gp).toFixed(1) : null;
  const parts =
    (type === 'mvp' || type === 'all_wknd_1' || type === 'all_wknd_2')
      ? [avg(row.pts) && `${avg(row.pts)} PPG`, avg(row.reb) && `${avg(row.reb)} RPG`, avg(row.ast) && `${avg(row.ast)} APG`]
    : (type === 'dpoy' || type === 'all_wknd_def')
      ? [avg(row.stl) && `${avg(row.stl)} SPG`, avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'scoring_champ'   ? [avg(row.pts) && `${avg(row.pts)} PPG`]
    : type === 'assists_leader'  ? [avg(row.ast) && `${avg(row.ast)} APG`]
    : type === 'rebounds_leader' ? [avg(row.reb) && `${avg(row.reb)} RPG`]
    : type === 'steals_leader'   ? [avg(row.stl) && `${avg(row.stl)} SPG`]
    : type === 'blocks_leader'   ? [avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'three_pm_leader' ? [avg(row.fg3m) && `${avg(row.fg3m)} 3PM`]
    : [];
  return parts.filter(Boolean).join(' · ');
}

// ── Award row (main content) ──────────────────────────────────────────────────
function awardRow(row, type, article) {
  const name  = displayPlayerName(row.player_name || '');
  const color = teamColor(String(row.team_name || '').toUpperCase());
  const init  = initials(row.player_name || '');
  const badge = AWARD_BADGE[type] || { label: type.toUpperCase(), bg: '#f59332', text: '#10141d' };
  const href  = `/players/${encodeURIComponent(row.player_id)}`;
  const stats = statLine(row, type);
  const pos   = POSITIONS.includes(row.notes) ? row.notes : null;

  return `<a href="${href}" class="mvp-row" style="--tc:${color};--bc:${badge.bg};--bt:${badge.text}">
  <div class="mvp-row__pills">
    <span class="mvp-row__badge" style="background:${badge.bg};color:${badge.text}">${escHtml(badge.label)}</span>
  </div>
  <div class="mvp-row__thumb">
    <div class="mvp-row__thumb-placeholder"><span class="font-condensed">${escHtml(init)}</span></div>
    <img src="/api/player/${encodeURIComponent(row.player_id)}/photo" alt="${escHtml(name)}" loading="lazy" class="mvp-row__thumb-img" onerror="this.style.display='none'">
    <div class="mvp-row__thumb-flare" style="background:linear-gradient(135deg,${color}44 0%,transparent 55%)"></div>
    ${pos ? `<span class="mvp-row__rank" style="background:${badge.bg};color:${badge.text};font-size:13px">${escHtml(pos)}</span>` : ''}
  </div>
  <div class="mvp-row__body" style="background:linear-gradient(135deg,${color}12 0%,transparent 50%)">
    <div class="mvp-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</div>
    ${stats   ? `<p class="mvp-row__article">${escHtml(stats)}</p>` : ''}
    ${article ? `<p class="mvp-row__article" style="margin-top:6px;opacity:.75">${escHtml(article)}</p>` : ''}
    <span class="mvp-row__cta">FULL STATS <span>→</span></span>
  </div>
</a>`;
}

// ── Sidebars ──────────────────────────────────────────────────────────────────
function mvpLadderSidebar(mvpCandidates) {
  if (!mvpCandidates?.length) return '';
  // mvpCandidates are pre-scored and pre-sorted by server using computeMvpScore (same as /mvp page).
  const top = mvpCandidates.slice(0, 10).map(s => {
    const gp      = s.gp || 1;
    const fgm     = (s.fgm ?? 0);
    const fga     = (s.fga ?? 0);
    const fta     = (s.fta ?? 0);
    const ftmiss  = (s.ftmiss ?? 0);
    const tov     = (s.tov ?? 0);
    const per     = (s.pts + 0.4*fgm - 0.7*fga - 0.4*ftmiss + 0.7*s.reb + s.stl + 0.7*s.ast + 0.7*s.blk - tov) / gp;
    const tsDenom = 2 * (fga + 0.44 * fta);
    const ts      = tsDenom > 0 ? s.pts / tsDenom : 0;
    return { ...s, gp, per, ts };
  });

  const head = `<div class="mvp-sb-row mvp-sb-row--head">
  <span class="mvp-sb-rank"></span>
  <span class="mvp-sb-name" style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--text-muted)">PLAYER</span>
  <span class="mvp-sb-num">PER</span>
  <span class="mvp-sb-num">TS%</span>
  <span class="mvp-sb-score" style="color:var(--text-muted);font-weight:700">SCR</span>
</div>`;

  const rows = top.map((p, i) => {
    const rank  = i + 1;
    const name  = displayPlayerName(p.name);
    const color = teamColor(p.team_name);
    const href  = `/players/${encodeURIComponent(p.id)}`;
    const bc    = rank === 1 ? '#f59332' : rank <= 3 ? '#3b82f6' : '#374151';
    return `<a href="${href}" class="mvp-sb-row${rank === 1 ? ' mvp-sb-row--first' : ''}" style="--bc:${bc}">
  <span class="mvp-sb-rank">${rank}</span>
  <span class="mvp-sb-name">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="mvp-sb-name-text">${escHtml(name)}</span>
  </span>
  <span class="mvp-sb-num mvp-sb-cell--r">${p.per.toFixed(1)}</span>
  <span class="mvp-sb-num mvp-sb-cell--r">${Math.round(p.ts * 100)}%</span>
  <span class="mvp-sb-score mvp-sb-cell--r">${p.mvpScore.toFixed(1)}</span>
</a>`;
  }).join('\n');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">MVP LADDER <a href="/mvp" class="card-label__more">Full race</a></div>
  <div class="mvp-sb-table">${head}${rows}</div>
</div>`;
}

function defensiveSidebar(leagueStats) {
  if (!leagueStats?.length) return '';
  const top = leagueStats.map(norm)
    .sort((a, b) => (b.stl * 1.5 + b.blk * 2) / b.gp - (a.stl * 1.5 + a.blk * 2) / a.gp)
    .slice(0, 10);

  const head = `<div class="mvp-sb-row mvp-sb-row--head">
  <span class="mvp-sb-rank"></span>
  <span class="mvp-sb-name" style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--text-muted)">PLAYER</span>
  <span class="mvp-sb-num">SPG</span>
  <span class="mvp-sb-num">BPG</span>
  <span class="mvp-sb-score" style="color:var(--text-muted);font-weight:700">DEF</span>
</div>`;

  const rows = top.map((p, i) => {
    const rank  = i + 1;
    const name  = displayPlayerName(p.name);
    const color = teamColor(p.team_name);
    const href  = `/players/${encodeURIComponent(p.id)}`;
    const bc    = rank === 1 ? '#3b82f6' : rank <= 3 ? '#8b5cf6' : '#374151';
    return `<a href="${href}" class="mvp-sb-row${rank === 1 ? ' mvp-sb-row--first' : ''}" style="--bc:${bc}">
  <span class="mvp-sb-rank">${rank}</span>
  <span class="mvp-sb-name">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="mvp-sb-name-text">${escHtml(name)}</span>
  </span>
  <span class="mvp-sb-num mvp-sb-cell--r">${(p.stl/p.gp).toFixed(1)}</span>
  <span class="mvp-sb-num mvp-sb-cell--r">${(p.blk/p.gp).toFixed(1)}</span>
  <span class="mvp-sb-score mvp-sb-cell--r">${((p.stl*1.5+p.blk*2)/p.gp).toFixed(1)}</span>
</a>`;
  }).join('\n');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">DEFENSIVE LEADERS</div>
  <div class="mvp-sb-table">${head}${rows}</div>
</div>`;
}

function statTopTenSidebar(leagueStats, { title, sortFn, valLabel, valFn, valFmt, secLabel, secFn, secFmt }) {
  if (!leagueStats?.length) return '';
  const top = leagueStats.map(norm).sort((a, b) => sortFn(b) - sortFn(a)).slice(0, 10);

  const head = `<div class="mvp-sb-row mvp-sb-row--head">
  <span class="mvp-sb-rank"></span>
  <span class="mvp-sb-name" style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--text-muted)">PLAYER</span>
  ${secLabel ? `<span class="mvp-sb-num">${secLabel}</span>` : ''}
  <span class="mvp-sb-score" style="color:var(--text-muted);font-weight:700">${valLabel}</span>
</div>`;

  const rows = top.map((p, i) => {
    const rank  = i + 1;
    const name  = displayPlayerName(p.name);
    const color = teamColor(p.team_name);
    const href  = `/players/${encodeURIComponent(p.id)}`;
    const bc    = rank === 1 ? '#f59332' : rank <= 3 ? '#3b82f6' : '#374151';
    return `<a href="${href}" class="mvp-sb-row${rank === 1 ? ' mvp-sb-row--first' : ''}" style="--bc:${bc}">
  <span class="mvp-sb-rank">${rank}</span>
  <span class="mvp-sb-name">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="mvp-sb-name-text">${escHtml(name)}</span>
  </span>
  ${secLabel ? `<span class="mvp-sb-num mvp-sb-cell--r">${escHtml(secFmt(secFn(p)))}</span>` : ''}
  <span class="mvp-sb-score mvp-sb-cell--r">${escHtml(valFmt(valFn(p)))}</span>
</a>`;
  }).join('\n');

  return `<div class="card sidebar" style="padding:0;overflow:hidden">
  <div class="card-label">${escHtml(title)}</div>
  <div class="mvp-sb-table">${head}${rows}</div>
</div>`;
}

function statLeadersSidebars(leagueStats) {
  if (!leagueStats?.length) return '';
  const f1    = v => v.toFixed(1);
  const gp    = p => p.gp;
  const gpFmt = v => String(v);

  const cats = [
    { title: 'SCORING LEADERS',  valLabel: 'PPG', sortFn: p => p.pts/p.gp, valFn: p => p.pts/p.gp, valFmt: f1, secLabel: 'GP', secFn: gp, secFmt: gpFmt },
    { title: 'REBOUNDS LEADERS', valLabel: 'RPG', sortFn: p => p.reb/p.gp, valFn: p => p.reb/p.gp, valFmt: f1, secLabel: 'GP', secFn: gp, secFmt: gpFmt },
    { title: 'ASSISTS LEADERS',  valLabel: 'APG', sortFn: p => p.ast/p.gp, valFn: p => p.ast/p.gp, valFmt: f1, secLabel: 'GP', secFn: gp, secFmt: gpFmt },
  ];

  return cats.map(cat => statTopTenSidebar(leagueStats, cat)).join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────
export function awardsPage({ awards = [], season, availableSeasons = [], visibleSections = new Set(), articles = {}, leagueStats = [], mvpCandidates = [] }) {
  const byType = {};
  for (const row of awards) (byType[row.award_type] ??= []).push(row);

  for (const type of ['all_wknd_1', 'all_wknd_2', 'all_wknd_def']) {
    if (byType[type]) {
      byType[type].sort((a, b) => (POSITION_ORDER[a.notes] ?? 99) - (POSITION_ORDER[b.notes] ?? 99));
    }
  }

  const seasonSelector = availableSeasons.length > 1
    ? `<div class="awd-season-tabs">${availableSeasons.map(s =>
        `<a href="/awards?season=${encodeURIComponent(s)}" class="awd-season-tab${s === season ? ' is-active' : ''}">Season ${escHtml(String(s))}</a>`
      ).join('')}</div>`
    : '';

  const sidebarHtml = `<div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  ${mvpLadderSidebar(mvpCandidates)}
  ${defensiveSidebar(leagueStats)}
  ${statLeadersSidebars(leagueStats)}
</div>`;

  const hasAny = GROUPS.some(({ types }) =>
    types.some(t => visibleSections.has(t) && byType[t]?.length)
  );

  if (!hasAny) {
    return `<div class="games-layout">
  <div class="games-main">
    ${seasonSelector}
    <div class="card" style="padding:60px 24px;text-align:center;color:var(--text-muted)">
      Awards have not been announced yet. Check back soon.
    </div>
  </div>
  ${sidebarHtml}
</div>`;
  }

  const groupCards = GROUPS.map(({ label, types }) => {
    const rows = types.flatMap(type => {
      if (!visibleSections.has(type) || !byType[type]?.length) return [];
      const isSolo = !['all_wknd_1', 'all_wknd_2', 'all_wknd_def'].includes(type);
      const article = isSolo ? (articles[type] || '') : '';
      return byType[type].map((row, i) => awardRow(row, type, i === 0 ? article : ''));
    });
    if (!rows.length) return '';

    const teamArticles = types
      .filter(t => ['all_wknd_1', 'all_wknd_2', 'all_wknd_def'].includes(t) && articles[t] && visibleSections.has(t) && byType[t]?.length)
      .map(t => `<p class="mvp-row__article" style="padding:16px 24px;border-top:1px solid var(--border);margin:0;opacity:.8">${escHtml(articles[t])}</p>`)
      .join('');

    return `<div class="card mvp-list" style="margin-bottom:16px">
  <div class="card-label">${escHtml(label.toUpperCase())}</div>
  ${rows.join('\n')}${teamArticles}
</div>`;
  }).join('');

  return `<div class="games-layout">
  <div class="games-main">
    ${seasonSelector}
    ${groupCards}
  </div>
  ${sidebarHtml}
</div>`;
}



