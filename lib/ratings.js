const WEIGHTS = {
  scoring:    0.40,
  playmaking: 0.12,
  rebounding: 0.10,
  defense:    0.12,
  shooting:   0.12,
  iq:         0.09,
  usage:      0.05,
};

// Absolute PPG ceiling: at this value a player maxes out the absolute component.
// Chosen to reflect what "elite scoring" looks like in this specific league.
const ABS_PPG_CEILING = 24;

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

function blendStats(season, recent) {
  if (!recent || !recent.games_played) return season;
  const sgp = Math.max(1, season.games_played);
  const rgp = Math.max(1, recent.games_played);
  const blend = (field) => 0.5 * ((season[field] || 0) / sgp) + 0.5 * ((recent[field] || 0) / rgp);
  return {
    _blended: true,
    games_played: season.games_played,
    _ppg: blend('pts'),
    _apg: blend('ast'),
    _rpg: blend('reb'),
    _spg: blend('stl'),
    _bpg: blend('blk'),
    _tpg: blend('turnover'),
    _fpg: blend('pf'),
    _pts:       0.5 * (season.pts       || 0) / sgp + 0.5 * (recent.pts       || 0) / rgp,
    _fg2m:      0.5 * (season.fg2m      || 0) / sgp + 0.5 * (recent.fg2m      || 0) / rgp,
    _fg3m:      0.5 * (season.fg3m      || 0) / sgp + 0.5 * (recent.fg3m      || 0) / rgp,
    _fg2m_miss: 0.5 * (season.fg2m_miss || 0) / sgp + 0.5 * (recent.fg2m_miss || 0) / rgp,
    _fg3m_miss: 0.5 * (season.fg3m_miss || 0) / sgp + 0.5 * (recent.fg3m_miss || 0) / rgp,
    _ftm:       0.5 * (season.ftm       || 0) / sgp + 0.5 * (recent.ftm       || 0) / rgp,
    _ft_miss:   0.5 * (season.ft_miss   || 0) / sgp + 0.5 * (recent.ft_miss   || 0) / rgp,
  };
}

// Map a player's raw value to 50–99 using their rank within the league.
// sortedAsc: sorted-ascending array of all qualified players' values for this dimension.
// Higher raw value = better (true for all our dimensions).
function percentileScore(sortedAsc, playerValue, fallback = 62) {
  if (!sortedAsc || sortedAsc.length <= 1 || playerValue == null) return fallback;
  const n = sortedAsc.length;
  const below = sortedAsc.filter(v => v < playerValue).length;
  const tied  = sortedAsc.filter(v => v === playerValue).length;
  const pos   = below + (tied - 1) / 2; // 0 = worst, n-1 = best
  return clamp(50 + (pos / Math.max(1, n - 1)) * 49, 50, 99);
}

// Compute the raw dimension values for one player.
// These are shared between league-wide percentile pre-computation and per-player rating.
export function computeRawValues(stats, context = {}) {
  const { teamTotals = null, recentStats = null } = context;
  const gp = Math.max(1, stats.games_played || 1);

  const useBlend = recentStats && recentStats.games_played >= 1 && gp >= MIN_GP_FULL_TRUST;
  const blended  = useBlend ? blendStats(stats, recentStats) : null;

  const ppg = blended ? blended._ppg : (stats.pts      || 0) / gp;
  const rpg = blended ? blended._rpg : (stats.reb      || 0) / gp;
  const apg = blended ? blended._apg : (stats.ast      || 0) / gp;
  const spg = blended ? blended._spg : (stats.stl      || 0) / gp;
  const bpg = blended ? blended._bpg : (stats.blk      || 0) / gp;
  const tpg = blended ? blended._tpg : (stats.turnover || 0) / gp;
  const fpg = blended ? blended._fpg : (stats.pf       || 0) / gp;

  const b_pts       = blended ? blended._pts       : (stats.pts       || 0) / gp;
  const b_fg2m      = blended ? blended._fg2m      : (stats.fg2m      || 0) / gp;
  const b_fg3m      = blended ? blended._fg3m      : (stats.fg3m      || 0) / gp;
  const b_fg2m_miss = blended ? blended._fg2m_miss : (stats.fg2m_miss || 0) / gp;
  const b_fg3m_miss = blended ? blended._fg3m_miss : (stats.fg3m_miss || 0) / gp;
  const b_ftm       = blended ? blended._ftm       : (stats.ftm       || 0) / gp;
  const b_ft_miss   = blended ? blended._ft_miss   : (stats.ft_miss   || 0) / gp;

  const b_fga    = b_fg2m + b_fg3m + b_fg2m_miss + b_fg3m_miss;
  const b_fta    = b_ftm + b_ft_miss;
  const ts_denom = 2 * (b_fga + 0.44 * b_fta);
  const ts_pct   = ts_denom > 0 ? b_pts / ts_denom : null;

  // Composite defensive value
  const def_raw  = spg * 1.5 + bpg;

  // Playmaking: assists with light turnover penalty
  const play_raw = Math.max(0, apg * 1.2 - tpg * 0.4);

  // IQ: assist/turnover ratio — only meaningful if player handles the ball enough.
  // Requiring 1+ APG prevents passive role players from gaming the metric via low TOV.
  const iq_raw = apg >= 1.0
    ? (tpg > 0 ? apg / tpg : apg * 2)
    : null;

  // Usage rate
  let usg = null;
  if (teamTotals && (teamTotals.fga + teamTotals.fta + teamTotals.tov) > 0) {
    const p_fga = (stats.fg2m || 0) + (stats.fg3m || 0) + (stats.fg2m_miss || 0) + (stats.fg3m_miss || 0);
    const p_fta = (stats.ftm  || 0) + (stats.ft_miss || 0);
    const p_tov = stats.turnover || 0;
    usg = (p_fga + 0.44 * p_fta + p_tov) / (teamTotals.fga + 0.44 * teamTotals.fta + teamTotals.tov);
  }

  return { ppg, rpg, apg, tpg, fpg, ts_pct, ts_denom, def_raw, play_raw, iq_raw, usg };
}

export function computeRatings(stats, context = {}) {
  const {
    totalSeasonGames = 0, teamTotals = null, recentStats = null,
    gamePts = [], winRate = null,
    leagueRaws = null,   // pre-sorted league arrays for percentile scoring
  } = context;

  const gp         = Math.max(1, stats.games_played || 1);
  const confidence = Math.min(1, gp / MIN_GP_FULL_TRUST);
  const raw        = computeRawValues(stats, { teamTotals, recentStats });

  let scoring, rebounding, playmaking, defense, shooting, iq, usage;

  if (leagueRaws) {
    // ── Scoring: 60% percentile + 40% absolute scale ─────────────────────────
    // Pure percentile collapses the gap between 11 PPG and 25 PPG (both "above
    // median") — blending in an absolute component keeps elite scorers clearly
    // ahead of good-but-not-great scorers in this specific league.
    const pctScoring = percentileScore(leagueRaws.ppg, raw.ppg, 62);
    const absScoring = clamp(50 + (raw.ppg / ABS_PPG_CEILING) * 49, 50, 99);
    scoring    = Math.round(0.60 * pctScoring + 0.40 * absScoring);

    rebounding = percentileScore(leagueRaws.rpg,      raw.rpg,      62);
    playmaking = percentileScore(leagueRaws.play_raw, raw.play_raw, 62);
    defense    = percentileScore(leagueRaws.def_raw,  raw.def_raw,  62);
    shooting   = raw.ts_pct != null
      ? percentileScore(leagueRaws.ts_pct, raw.ts_pct, 62) : 62;
    iq         = raw.iq_raw != null
      ? percentileScore(leagueRaws.iq_raw, raw.iq_raw, 62) : 62;
    usage      = raw.usg != null
      ? percentileScore(leagueRaws.usg, raw.usg, 62) : 62;
  } else {
    // ── Fallback: absolute scales (used when no league context is available) ──
    const { ppg, rpg, apg, tpg, fpg } = raw;

    scoring    = clamp(50 + (ppg / 25) * 49, 50, 99);
    shooting   = raw.ts_denom < 1 ? 55 : clamp(50 + ((raw.ts_pct ?? 0) - 0.40) / 0.30 * 49, 50, 99);
    rebounding = clamp(50 + (rpg / 12) * 49, 50, 99);
    playmaking = clamp(50 + (apg / 7) * 44 - Math.min(tpg * 2, 15), 50, 99);
    defense    = clamp(50 + (raw.def_raw / 3.5) * 49, 50, 99);

    let iq_val = 62;
    if (tpg > 0)      iq_val = clamp(52 + (apg / tpg) * 18, 52, 90);
    else if (apg > 0) iq_val = clamp(65 + apg * 3, 65, 90);
    iq = clamp(iq_val - Math.max(0, fpg - 3) * 4, 50, 92);

    usage = 62;
    if (raw.usg != null) usage = clamp(50 + (raw.usg - 0.10) / 0.25 * 49, 50, 99);
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

  // 1. Availability: light penalty for missing games — range 0.92–1.00.
  // Deliberately shallow so 2–3 missed games don't completely tank a player.
  if (totalSeasonGames > 0) {
    const availability = Math.min(1, gp / totalSeasonGames);
    overall = clamp(overall * (0.92 + 0.08 * availability), 50, 99);
  }

  // 2. Consistency: reward low variance, penalize streakiness
  if (gamePts.length >= 3) {
    const mean = gamePts.reduce((a, b) => a + b, 0) / gamePts.length;
    const cv   = mean > 0 ? stdDev(gamePts) / mean : 0;
    const consistency_mod = clamp(Math.round((0.50 - cv) * 8), -3, 3);
    overall = clamp(overall + consistency_mod, 50, 99);
  }

  // 3. Win contribution: ±3 for players with gp ≥ 5
  if (winRate != null && gp >= MIN_GP_FULL_TRUST) {
    const win_mod = Math.round((winRate - 0.50) * 6);
    overall = clamp(overall + clamp(win_mod, -3, 3), 50, 99);
  }

  // 4. Two-way bonus: rewards players who contribute on both ends
  if (c_scoring > 68 && c_defense > 68) {
    const two_way = Math.min(4, Math.round((c_scoring - 68 + c_defense - 68) / 25));
    overall = clamp(overall + two_way, 50, 99);
  }

  // 5. Scoring floor: a non-scorer can't rank in elite tier regardless of other stats.
  // In rec basketball, scoring impact is the primary driver of a player's value.
  if      (raw.ppg < 5)  overall = Math.min(overall, 68);
  else if (raw.ppg < 10) overall = Math.min(overall, 76);
  else if (raw.ppg < 14) overall = Math.min(overall, 83);

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
