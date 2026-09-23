import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials, formatDate } from './utils.js';
import { gameRow, gameListScript } from './games.js';
import { leagueLeaders } from './home.js';

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ── Roster row ────────────────────────────────────────────────────────────────
// A raw box-score number means little on its own in a small rec league — coloring is
// relative to this roster's own average for that stat, not a fixed benchmark: notably
// above average is green ("outstanding"), notably below is red, in between stays neutral.
// Turnovers flip the direction, since fewer is the good outcome there.
const POS_COLOR = '#22c55e';
const NEG_COLOR = '#f87171';
const HIGH_RATIO = 1.15;
const LOW_RATIO  = 0.7;

function computePlayerStatValues(p) {
  const s = p.seasonStats;
  const gp = s?.games_played || 0;
  if (!gp) return null;
  const pg = total => (total || 0) / gp;
  const pct = (made, miss) => {
    const att = (made || 0) + (miss || 0);
    return att > 0 ? (made / att) * 100 : null;
  };
  return {
    ppg: pg(s.pts), rpg: pg(s.reb), apg: pg(s.ast), spg: pg(s.stl), bpg: pg(s.blk), to: pg(s.turnover),
    fgp: pct((s.fg2m || 0) + (s.fg3m || 0) + (s.fg4m || 0), (s.fg2m_miss || 0) + (s.fg3m_miss || 0) + (s.fg4m_miss || 0)),
    tpp: pct(s.fg3m, s.fg3m_miss),
    ftp: pct(s.ftm, s.ft_miss),
  };
}

function statTd(value, avg, { negative = false, fmt = v => v.toFixed(1) } = {}) {
  if (value == null) return `<td class="pt-stat">—</td>`;
  let color = null;
  if (avg != null && avg > 0) {
    const ratio = value / avg;
    if (negative) color = ratio <= LOW_RATIO ? POS_COLOR : ratio >= HIGH_RATIO ? NEG_COLOR : null;
    else           color = ratio >= HIGH_RATIO ? POS_COLOR : ratio <= LOW_RATIO ? NEG_COLOR : null;
  }
  return `<td class="pt-stat"${color ? ` style="color:${color}"` : ''}>${fmt(value)}</td>`;
}

function rosterRow(p, v, avgs) {
  const name = displayPlayerName(p.name);
  const parts = name.trim().split(' ');
  const firstName = escHtml(parts[0] || '');
  const lastName = escHtml(parts.slice(1).join(' ') || '');
  const positions = parsePositions(p.positions);
  const gp = p.seasonStats?.games_played || 0;
  const pctFmt = v => Math.round(v) + '%';

  return `<tr>
  <td class="pt-player">
    <a href="/players/${encodeURIComponent(p.id)}" class="pt-player-link">
      <div class="pt-avatar" style="border-color:${teamColor(p.team_name)}">
        <span>${escHtml(initials(p.name))}</span>
        <img src="/api/player/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="pt-player-info">
        <span class="pt-first">${firstName}</span>
        <span class="pt-last">${lastName}</span>
      </div>
    </a>
  </td>
  <td class="pt-num">${p.number ? escHtml(String(p.number)) : '—'}</td>
  <td class="pt-pos">${positions.length ? escHtml(positions.slice(0, 2).join(' · ')) : '—'}</td>
  <td class="pt-stat">${gp || '—'}</td>
  ${statTd(v?.ppg, avgs.ppg)}
  ${statTd(v?.rpg, avgs.rpg)}
  ${statTd(v?.apg, avgs.apg)}
  ${statTd(v?.spg, avgs.spg)}
  ${statTd(v?.bpg, avgs.bpg)}
  ${statTd(v?.to, avgs.to, { negative: true })}
  ${statTd(v?.fgp, avgs.fgp, { fmt: pctFmt })}
  ${statTd(v?.tpp, avgs.tpp, { fmt: pctFmt })}
  ${statTd(v?.ftp, avgs.ftp, { fmt: pctFmt })}
</tr>`;
}

// ── Recent form (last 5 completed results) ─────────────────────────────────────
function formPill(game, teamId) {
  const isA = game.team_a_id === teamId;
  const my = Number(isA ? game.team_a_score : game.team_b_score);
  const opp = Number(isA ? game.team_b_score : game.team_a_score);
  const won = my > opp;
  return `<span class="td-form__pill td-form__pill--${won ? 'w' : 'l'}" title="${won ? 'W' : 'L'} ${my}-${opp} vs ${escHtml(isA ? game.team_b_name : game.team_a_name)}">${won ? 'W' : 'L'}</span>`;
}

export function teamDetailPage({
  team, color, record, currentSeason, statsSeason,
  avgOvr, avgOff, avgDef, pointsFor = 0, pointsAgainst = 0,
  roster = [], leaders = [], games = [],
}) {
  const wins = record?.wins ?? 0;
  const losses = record?.losses ?? 0;
  const isLight = String(team.name).toUpperCase() === 'WHITE';

  const completed = games.filter(g => !g.scheduled && (Number(g.team_a_score) + Number(g.team_b_score)) > 0);
  const upcoming = games.filter(g => g.scheduled);
  const recentForm = completed.slice(0, 5).map(g => formPill(g, team.id)).join('');

  // Earliest-dated scheduled game, not upcoming[0] — `games` (and so `upcoming`) is sorted
  // newest-first for the completed list's sake, which for future dates puts the furthest-out
  // game first rather than the soonest one.
  const nextGame = upcoming.length
    ? [...upcoming].sort((a, b) => new Date(a.date) - new Date(b.date))[0]
    : null;
  const nextGameHtml = nextGame ? (() => {
    const isA = nextGame.team_a_id === team.id;
    const oppName = isA ? nextGame.team_b_name : nextGame.team_a_name;
    return `<div class="td-hero__next">NEXT <span class="td-hero__next-opp">vs ${escHtml(oppName)}</span> · ${escHtml(formatDate(nextGame.date))}</div>`;
  })() : '';

  const diff = pointsFor - pointsAgainst;
  const diffHtml = (pointsFor > 0 || pointsAgainst > 0)
    ? `<div class="td-hero__diff">${pointsFor} PF · ${pointsAgainst} PA · <span style="color:${diff >= 0 ? '#22c55e' : '#f87171'}">${diff >= 0 ? '+' : ''}${diff}</span></div>`
    : '';

  // Same card design + carousel as the homepage's League Leaders widget, just handed a
  // pool pre-filtered to this team's roster — team chip dropped since every card in a
  // single-team pool would repeat the identical chip.
  const leadersHtml = leagueLeaders(leaders, { showTeamChip: false })
    || `<div class="card" style="padding:24px;text-align:center;color:var(--text-muted)">No stats yet for Season ${escHtml(String(statsSeason))}.</div>`;

  const gamesHtml = completed.length
    ? completed.map(g => gameRow(g)).join('\n')
    : `<div class="card game-list__empty">No games played yet.</div>`;

  const upcomingHtml = upcoming.length
    ? `<div class="section-header"><h2>Upcoming</h2></div>
  <div class="games-grid">${upcoming.map(g => gameRow(g)).join('\n')}</div>` : '';

  const rosterEntries = roster.map(p => ({ p, v: computePlayerStatValues(p) }));
  const STAT_KEYS = ['ppg', 'rpg', 'apg', 'spg', 'bpg', 'to', 'fgp', 'tpp', 'ftp'];
  const avgs = Object.fromEntries(STAT_KEYS.map(key => {
    const vals = rosterEntries.map(e => e.v?.[key]).filter(x => x != null);
    return [key, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null];
  }));
  const rosterHtml = rosterEntries.length
    ? rosterEntries.map(({ p, v }) => rosterRow(p, v, avgs)).join('\n')
    : `<div style="padding:24px;text-align:center;color:var(--text-muted)">No players currently on this roster.</div>`;

  return `<div class="page-content">
  <div class="td-hero card" style="--td-color:${color}">
    <div class="td-hero__info">
      <h1 class="td-hero__name">${escHtml(team.name)}</h1>
      <div class="td-hero__meta">
        <span class="td-hero__record">${wins}-${losses}</span>
        <span class="td-hero__season">Season ${escHtml(String(currentSeason))}</span>
        ${recentForm ? `<div class="td-form">${recentForm}</div>` : ''}
      </div>
      ${diffHtml}
      ${nextGameHtml}
    </div>
    <div class="td-hero__stats">
      <div class="tm-stat"><span class="tm-stat__val font-condensed">${avgOff ?? '—'}</span><span class="tm-stat__lbl">OFF</span></div>
      <div class="tm-stat"><span class="tm-stat__val font-condensed">${avgDef ?? '—'}</span><span class="tm-stat__lbl">DEF</span></div>
      <div class="tm-stat"><span class="tm-stat__val font-condensed" style="color:var(--amber)">${avgOvr ?? '—'}</span><span class="tm-stat__lbl">OVR</span></div>
    </div>
  </div>

  <div class="section-header"><h2>Team Leaders</h2>${statsSeason !== String(currentSeason) ? `<span class="td-season-note">Season ${escHtml(String(statsSeason))}</span>` : ''}</div>
  ${leadersHtml}

  <div class="section-header"><h2>Roster</h2></div>
  <div class="card pt-card">
    <div class="pt-table-wrap">
      <table class="pt-table">
        <thead>
          <tr>
            <th class="pt-th-player pt-sticky">PLAYER</th>
            <th class="pt-th-sm">#</th>
            <th class="pt-th-pos">POS</th>
            <th class="pt-stat">GP</th>
            <th class="pt-stat">PPG</th>
            <th class="pt-stat">RPG</th>
            <th class="pt-stat">APG</th>
            <th class="pt-stat">SPG</th>
            <th class="pt-stat">BPG</th>
            <th class="pt-stat">TO</th>
            <th class="pt-stat pt-pct">FG%</th>
            <th class="pt-stat pt-pct">3P%</th>
            <th class="pt-stat pt-pct">FT%</th>
          </tr>
        </thead>
        <tbody>${rosterHtml}</tbody>
      </table>
    </div>
  </div>

  <div class="section-header"><h2>Games</h2></div>
  <div class="games-grid">${gamesHtml}</div>
  ${upcomingHtml}
</div>
${completed.length || upcoming.length ? gameListScript() : ''}

<style>
/* Same glare/gradient treatment as .player-hero in public/styles.css (top accent strip +
   a low-opacity color wash from the left) — reimplemented under its own td- prefix rather
   than sharing the .player-hero class name, since this page's <style> block is independent. */
.td-hero { position: relative; overflow: hidden; display: flex; align-items: center; gap: 18px; padding: 24px 26px; margin-top: 4px; margin-bottom: 24px; }
.td-hero::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(to right, var(--td-color, var(--amber)) 0%, transparent 65%);
  z-index: 2;
}
.td-hero::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 55% 120% at 0% 50%, var(--td-color, transparent), transparent);
  opacity: 0.1;
  pointer-events: none;
}
.td-hero__info { position: relative; z-index: 1; flex: 1; min-width: 0; }
.td-hero__name { font-size: clamp(24px, 3.2vw, 32px); font-weight: 800; letter-spacing: -.02em; color: var(--text); margin: 0 0 6px; line-height: 1.1; }
.td-hero__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.td-hero__record { font-size: 15px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
.td-hero__season { font-size: 12.5px; font-weight: 600; color: var(--text-muted); }
.td-hero__diff { margin-top: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.td-hero__next { margin-top: 6px; font-size: 12.5px; font-weight: 700; color: var(--amber); letter-spacing: .02em; }
.td-hero__next-opp { color: var(--text); font-weight: 700; }
.td-form { display: flex; gap: 4px; }
.td-form__pill { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; font-size: 10.5px; font-weight: 800; }
.td-form__pill--w { background: rgba(34,197,94,.15); color: #22c55e; }
.td-form__pill--l { background: rgba(239,68,68,.15); color: #f87171; }
.td-hero__stats { position: relative; z-index: 1; display: flex; align-items: center; gap: 18px; flex-shrink: 0; }
/* Matches .tm-stat in views/teams.js (OFF/DEF/OVR blocks on the team card) — duplicated
   here rather than shared since each page view embeds its own scoped <style> block. */
.td-hero__stats .tm-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.td-hero__stats .tm-stat__val { font-size: 22px; font-weight: 700; line-height: 1; color: var(--text); }
.td-hero__stats .tm-stat__lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; color: var(--text-muted); text-transform: uppercase; }

.td-season-note { font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

/* This page's own .section-header instances only — scoped to this template's own <style>
   block, not a global override — the base rule in public/styles.css carries no margin of
   its own since callers are expected to add it. */
.section-header { margin: 32px 0 14px; }
.section-header:first-of-type { margin-top: 28px; }

@media (max-width: 640px) {
  .td-hero { flex-wrap: wrap; }
  .td-hero__stats { width: 100%; justify-content: space-between; }
}
</style>
`;
}
