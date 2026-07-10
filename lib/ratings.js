const WEIGHTS = {
  scoring:    0.25,
  playmaking: 0.15,
  rebounding: 0.15,
  defense:    0.15,
  shooting:   0.12,
  iq:         0.10,
  usage:      0.08,
};

const MIN_GP_FULL_TRUST = 5;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Math.round(val)));
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Blend season per-game avg with recent per-game avg (50/50)
function blendStats(season, recent) {
  if (!recent || !recent.games_played) return season;
  const sgp = Math.max(1, season.games_played);
  const rgp = Math.max(1, recent.games_played);
  const blend = (field) => 0.5 * ((season[field] || 0) / sgp) + 0.5 * ((recent[field] || 0) / rgp);
  return {
    _blended: true,
    games_played: season.games_played,
    // per-game values (already divided)
    _ppg: blend('pts'),
    _apg: blend('ast'),
    _rpg: blend('reb'),
    _spg: blend('stl'),
    _bpg: blend('blk'),
    _tpg: blend('turnover'),
    _fpg: blend('pf'),
    // shooting — blended totals for TS%
    _pts:       0.5 * (season.pts       || 0) / sgp + 0.5 * (recent.pts       || 0) / rgp,
    _fg2m:      0.5 * (season.fg2m      || 0) / sgp + 0.5 * (recent.fg2m      || 0) / rgp,
    _fg3m:      0.5 * (season.fg3m      || 0) / sgp + 0.5 * (recent.fg3m      || 0) / rgp,
    _fg2m_miss: 0.5 * (season.fg2m_miss || 0) / sgp + 0.5 * (recent.fg2m_miss || 0) / rgp,
    _fg3m_miss: 0.5 * (season.fg3m_miss || 0) / sgp + 0.5 * (recent.fg3m_miss || 0) / rgp,
    _ftm:       0.5 * (season.ftm       || 0) / sgp + 0.5 * (recent.ftm       || 0) / rgp,
    _ft_miss:   0.5 * (season.ft_miss   || 0) / sgp + 0.5 * (recent.ft_miss   || 0) / rgp,
  };
}

export function computeRatings(stats, context = {}) {
  const { totalSeasonGames = 0, teamTotals = null, recentStats = null, gamePts = [] } = context;

  const gp = Math.max(1, stats.games_played || 1);
  const confidence = Math.min(1, gp / MIN_GP_FULL_TRUST);

  // Blend season vs last-5 when enough games played
  const useBlend = recentStats && recentStats.games_played >= 1 && gp >= MIN_GP_FULL_TRUST;
  const blended  = useBlend ? blendStats(stats, recentStats) : null;

  // Per-game rates — blended when available, else season
  const ppg = blended ? blended._ppg : (stats.pts      || 0) / gp;
  const apg = blended ? blended._apg : (stats.ast      || 0) / gp;
  const rpg = blended ? blended._rpg : (stats.reb      || 0) / gp;
  const spg = blended ? blended._spg : (stats.stl      || 0) / gp;
  const bpg = blended ? blended._bpg : (stats.blk      || 0) / gp;
  const tpg = blended ? blended._tpg : (stats.turnover || 0) / gp;
  const fpg = blended ? blended._fpg : (stats.pf       || 0) / gp;

  // Shooting inputs — per-game blended or season totals / gp
  const b_pts       = blended ? blended._pts       : (stats.pts       || 0) / gp;
  const b_fg2m      = blended ? blended._fg2m      : (stats.fg2m      || 0) / gp;
  const b_fg3m      = blended ? blended._fg3m      : (stats.fg3m      || 0) / gp;
  const b_fg2m_miss = blended ? blended._fg2m_miss : (stats.fg2m_miss || 0) / gp;
  const b_fg3m_miss = blended ? blended._fg3m_miss : (stats.fg3m_miss || 0) / gp;
  const b_ftm       = blended ? blended._ftm       : (stats.ftm       || 0) / gp;
  const b_ft_miss   = blended ? blended._ft_miss   : (stats.ft_miss   || 0) / gp;

  // ── Dimensions ───────────────────────────────────────────────────────────────

  // Scoring: 0→50, 10→70, 20→89, 25+→99
  const scoring = clamp(50 + (ppg / 25) * 49, 50, 99);

  // Shooting: True Shooting % instead of 3P%-only
  // TS% = pts / (2 × (FGA + 0.44×FTA)); 40%→50, 55%→75, 70%+→99
  const b_fga = b_fg2m + b_fg3m + b_fg2m_miss + b_fg3m_miss;
  const b_fta = b_ftm + b_ft_miss;
  const ts_denom = 2 * (b_fga + 0.44 * b_fta);
  const ts_pct   = ts_denom > 0 ? b_pts / ts_denom : 0;
  const shooting  = ts_denom < 1
    ? 55
    : clamp(50 + (ts_pct - 0.40) / 0.30 * 49, 50, 99);

  // Rebounding: 0→50, 4→66, 8→83, 12+→99
  const rebounding = clamp(50 + (rpg / 12) * 49, 50, 99);

  // Playmaking: AST base − TOV penalty
  const astBase    = 50 + (apg / 7) * 44;
  const playmaking = clamp(astBase - Math.min(tpg * 2, 15), 50, 99);

  // Defense: steals×1.5 + blocks
  const defRaw  = spg * 1.5 + bpg;
  const defense = clamp(50 + (defRaw / 3.5) * 49, 50, 99);

  // IQ: AST/TOV ratio + foul penalty
  // AST/TOV already captures turnover discipline; no separate TOV% penalty to avoid
  // double-penalizing pass-first players with low FGA (which inflates TOV rate)
  let iq = 62;
  if (tpg > 0)      iq = clamp(52 + (apg / tpg) * 18, 52, 90);
  else if (apg > 0) iq = clamp(65 + apg * 3, 65, 90);
  iq = clamp(iq - Math.max(0, fpg - 3) * 4, 50, 92);

  // Usage: Court Presence via USG%
  // USG% = (FGA + 0.44×FTA + TOV) / (team_FGA + 0.44×team_FTA + team_TOV)
  // 10%→50, 20% (avg)→70, 35%+→99
  let usage = 62; // neutral default
  if (teamTotals && (teamTotals.fga + teamTotals.fta + teamTotals.tov) > 0) {
    const player_fga = (stats.fg2m || 0) + (stats.fg3m || 0) + (stats.fg2m_miss || 0) + (stats.fg3m_miss || 0);
    const player_fta = (stats.ftm  || 0) + (stats.ft_miss || 0);
    const player_tov = stats.turnover || 0;
    const usg = (player_fga + 0.44 * player_fta + player_tov) /
                (teamTotals.fga + 0.44 * teamTotals.fta + teamTotals.tov);
    usage = clamp(50 + (usg - 0.10) / 0.25 * 49, 50, 99);
  }

  // ── Sample size confidence: pull each dim toward 62 ──────────────────────────
  const applyConfidence = (dim) => Math.round(62 + confidence * (dim - 62));
  const c_scoring    = applyConfidence(scoring);
  const c_shooting   = applyConfidence(shooting);
  const c_rebounding = applyConfidence(rebounding);
  const c_playmaking = applyConfidence(playmaking);
  const c_defense    = applyConfidence(defense);
  const c_iq         = applyConfidence(iq);
  const c_usage      = applyConfidence(usage);

  // ── Weighted overall ─────────────────────────────────────────────────────────
  let overall = clamp(
    c_scoring    * WEIGHTS.scoring    +
    c_playmaking * WEIGHTS.playmaking +
    c_rebounding * WEIGHTS.rebounding +
    c_defense    * WEIGHTS.defense    +
    c_shooting   * WEIGHTS.shooting   +
    c_iq         * WEIGHTS.iq         +
    c_usage      * WEIGHTS.usage,
    50, 99
  );

  // ── Post-overall modifiers ───────────────────────────────────────────────────

  // 1. Availability: penalizes players who miss a lot of games
  if (totalSeasonGames > 0) {
    const availability = Math.min(1, gp / totalSeasonGames);
    overall = clamp(overall * (0.80 + 0.20 * availability), 50, 99);
  }

  // 2. Consistency: reward low variance, penalize streakiness
  if (gamePts.length >= 3) {
    const mean = gamePts.reduce((a, b) => a + b, 0) / gamePts.length;
    const cv   = mean > 0 ? stdDev(gamePts) / mean : 0;
    const consistency_mod = clamp(Math.round((0.50 - cv) * 8), -3, 3);
    overall = clamp(overall + consistency_mod, 50, 99);
  }

  // 3. Win contribution: ±3 for players with gp ≥ 5
  if (context.winRate != null && gp >= MIN_GP_FULL_TRUST) {
    const win_mod = Math.round((context.winRate - 0.50) * 6);
    overall = clamp(overall + clamp(win_mod, -3, 3), 50, 99);
  }

  // 4. Two-way bonus: rewards players who contribute on both ends
  if (c_scoring > 68 && c_defense > 68) {
    const two_way = Math.min(4, Math.round((c_scoring - 68 + c_defense - 68) / 25));
    overall = clamp(overall + two_way, 50, 99);
  }

  return {
    scoring:    c_scoring,
    shooting:   c_shooting,
    rebounding: c_rebounding,
    playmaking: c_playmaking,
    defense:    c_defense,
    iq:         c_iq,
    usage:      c_usage,
    overall,
  };
}

export function ovrColor(ovr) {
  if (ovr == null) return 'var(--text-muted)';
  if (ovr >= 90)   return '#f59332';
  if (ovr >= 80)   return '#06b6d4';
  if (ovr >= 70)   return '#22c55e';
  if (ovr >= 60)   return '#94a3b8';
  return '#cd7c2f';
}

export function ovrTier(ovr) {
  if (ovr == null) return 'unrated';
  if (ovr >= 90)   return 'gold';
  if (ovr >= 80)   return 'teal';
  if (ovr >= 70)   return 'green';
  if (ovr >= 60)   return 'silver';
  return 'bronze';
}
