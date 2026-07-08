const WEIGHTS = {
  scoring:     0.25,
  shooting:    0.15,
  playmaking:  0.15,
  rebounding:  0.15,
  defense:     0.15,
  iq:          0.10,
  athleticism: 0.05,
};

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Math.round(val)));
}

export function computeRatings(stats) {
  const gp  = Math.max(1, stats.games_played || 1);
  const ppg = (stats.pts      || 0) / gp;
  const apg = (stats.ast      || 0) / gp;
  const rpg = (stats.reb      || 0) / gp;
  const spg = (stats.stl      || 0) / gp;
  const bpg = (stats.blk      || 0) / gp;
  const tpg = (stats.turnover || 0) / gp;
  const fpg = (stats.pf       || 0) / gp;

  const fg3m   = stats.fg3m      || 0;
  const fg3a   = fg3m + (stats.fg3m_miss || 0);
  const fg3pct = fg3a > 0 ? fg3m / fg3a : 0;
  const fg3apg = fg3a / gp;

  // Scoring: 0→50, 10→70, 20→89, 25+→99
  const scoring = clamp(50 + (ppg / 25) * 49, 50, 99);

  // Shooting: 3P% × volume. No attempts → 55 (neutral).
  // 33% on 4 att/g → 68, 40% on 5 att/g → 73, 50% on 6+ att/g → 78
  const volFactor = Math.min(1, fg3apg / 4);
  const shooting = fg3a < 1
    ? 55
    : clamp(50 + fg3pct * 55 * (0.3 + 0.7 * volFactor), 50, 99);

  // Rebounding: 0→50, 4→66, 8→83, 12+→99
  const rebounding = clamp(50 + (rpg / 12) * 49, 50, 99);

  // Playmaking: 3 APG→71, 6 APG→88. TOV capped at −15
  const astBase    = 50 + (apg / 7) * 44;
  const playmaking = clamp(astBase - Math.min(tpg * 2, 15), 50, 99);

  // Defense: steals×1.5 + blocks. 1 spg+0.5 blk→67, 2 spg+1 blk→86, 3.5→99
  const defRaw = spg * 1.5 + bpg;
  const defense = clamp(50 + (defRaw / 3.5) * 49, 50, 99);

  // IQ: AST/TOV ratio baseline + foul penalty (kicks in above 3 PF/g)
  let iq = 62;
  if (tpg > 0)      iq = clamp(52 + (apg / tpg) * 18, 52, 90);
  else if (apg > 0) iq = clamp(65 + apg * 3, 65, 90);
  iq = clamp(iq - Math.max(0, fpg - 3) * 4, 50, 92);

  // Athleticism: derived from scoring burst + defensive footwork
  const athleticism = clamp(scoring * 0.45 + defense * 0.40 + spg * 6 + bpg * 3, 50, 99);

  // Overall: weighted average, floor 50
  const overall = clamp(
    scoring     * WEIGHTS.scoring     +
    shooting    * WEIGHTS.shooting    +
    playmaking  * WEIGHTS.playmaking  +
    rebounding  * WEIGHTS.rebounding  +
    defense     * WEIGHTS.defense     +
    iq          * WEIGHTS.iq          +
    athleticism * WEIGHTS.athleticism,
    50, 99
  );

  return { scoring, shooting, rebounding, playmaking, defense, iq, athleticism, overall };
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
