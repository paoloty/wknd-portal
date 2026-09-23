// ── Team category rank cards ─────────────────────────────────────────────────
// Pure functions only — no DB access (matches lib/badges.js / lib/player-analysis.js).
// server.js fetches every team's season totals (getTeamSeasonStats + getTeamPointsForAgainst,
// merged by team_id) and hands the whole array in; this just ranks and picks.
//
// 4 "major" categories always show, in a fixed order. The other 2 slots are NOT fixed —
// they're whichever 2 remaining categories this specific team ranks worst in, so the callout
// is actually about this team, not the same 6 stats repeated on every team's page.
const RANK_CATEGORIES = [
  { id: 'scoring',    label: 'Scoring',    unit: 'PPG', major: true,  direction: 'high', value: s => s.gp ? s.pts / s.gp : 0 },
  { id: 'rebounding', label: 'Rebounding', unit: 'RPG', major: true,  direction: 'high', value: s => s.gp ? s.reb / s.gp : 0 },
  { id: 'assists',    label: 'Assists',    unit: 'APG', major: true,  direction: 'high', value: s => s.gp ? s.ast / s.gp : 0 },
  // Lower is better — points allowed per game.
  { id: 'defense',    label: 'Defense',    unit: 'PAPG', major: true,  direction: 'low',  value: s => s.gp ? (s.points_against || 0) / s.gp : 0 },
  { id: 'steals',     label: 'Steals',     unit: 'SPG',  major: false, direction: 'high', value: s => s.gp ? s.stl / s.gp : 0 },
  { id: 'blocks',     label: 'Blocks',     unit: 'BPG',  major: false, direction: 'high', value: s => s.gp ? s.blk / s.gp : 0 },
  // Lower is better — turnovers per game.
  { id: 'turnovers',  label: 'Turnovers',  unit: 'TOPG', major: false, direction: 'low',  value: s => s.gp ? s.turnover / s.gp : 0 },
  { id: 'fg-pct',     label: 'FG%',        unit: '%',    major: false, direction: 'high', value: s => s.fga ? (s.fgm / s.fga) * 100 : 0 },
  { id: 'three-pct',  label: '3P%',        unit: '%',    major: false, direction: 'high', value: s => s.fg3a ? (s.fg3m / s.fg3a) * 100 : 0 },
  { id: 'ft-pct',     label: 'FT%',        unit: '%',    major: false, direction: 'high', value: s => { const a = s.ftm + s.ft_miss; return a ? (s.ftm / a) * 100 : 0; } },
];

// Competition ranking (1,2,2,4) — ties share the better rank, same convention a standings
// table would use, not dense/ordinal ranking that pretends ties didn't happen.
function rankTeams(allStats, category) {
  const withValues = allStats.map(s => ({ teamId: s.team_id, value: category.value(s) }));
  const sorted = [...withValues].sort((a, b) => category.direction === 'high' ? b.value - a.value : a.value - b.value);
  const ranks = {};
  sorted.forEach((row, i) => {
    ranks[row.teamId] = (i > 0 && row.value === sorted[i - 1].value) ? ranks[sorted[i - 1].teamId] : i + 1;
  });
  return { ranks, values: Object.fromEntries(withValues.map(r => [r.teamId, r.value])) };
}

function fmtValue(category, value) {
  return category.unit === '%' ? `${value.toFixed(1)}%` : value.toFixed(1);
}

/**
 * @param {string} teamId
 * @param {object[]} allTeamsStats - getTeamSeasonStats(season) rows, each merged with its
 *   matching getTeamPointsForAgainst(season) row (points_for/points_against)
 * @returns {object[]} 6 cards — the 4 majors in fixed order, then this team's 2 worst
 *   remaining ranks. Empty if there's nobody to rank against (e.g. a season with 1 team).
 */
export function computeTeamRankCards(teamId, allTeamsStats) {
  const totalTeams = allTeamsStats.length;
  if (totalTeams < 2 || !allTeamsStats.some(s => s.team_id === teamId)) return [];

  const ranked = RANK_CATEGORIES.map(cat => {
    const { ranks, values } = rankTeams(allTeamsStats, cat);
    return { ...cat, rank: ranks[teamId], value: values[teamId] };
  });

  const major = ranked.filter(c => c.major);
  // The 2 dynamic slots — this team's worst remaining ranks, so the pair varies by team
  // instead of repeating the same 6 stats on every page.
  const rest = ranked.filter(c => !c.major).sort((a, b) => b.rank - a.rank).slice(0, 2);

  // unit is shown separately from valueDisplay (never baked into it) so the view can style
  // it smaller than the number — % categories already carry their unit in the number itself
  // (fmtValue appends it), so they get none here to avoid showing it twice.
  const toCard = c => ({ id: c.id, label: c.label, valueDisplay: fmtValue(c, c.value), unit: c.unit === '%' ? '' : c.unit, rank: c.rank, totalTeams });
  return [...major.map(toCard), ...rest.map(toCard)];
}
