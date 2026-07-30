// Self-Assessment (season-signup Group 04) scoring. A self-rated tier is compared
// against the player's actual rating to produce an alignment flag — a self-awareness
// signal, not a pass/fail. Deliberately not stored: ratings change over time, so this
// is computed fresh whenever admin looks at it, never snapshotted at submission time.

export const TIERS = ['below_average', 'average', 'above_average', 'best'];

export const TIER_LABELS = {
  below_average: 'Below average',
  average: 'Average',
  above_average: 'Above average',
  best: 'One of the best',
};

// New proposal, not pulled from existing code — lib/portal-db.js's player_ratings
// only computes a raw 50–99 percentile rank, no named tiers exist yet to reuse.
export const TIER_BANDS = {
  below_average: [50, 61],
  average: [62, 74],
  above_average: [75, 87],
  best: [88, 99],
};

// null actualRating (player has no rating yet, e.g. first season) -> 'not_ratable'.
// Otherwise: inside the self-picked band -> 'aligned'; one band below -> 'optimistic';
// two+ bands below -> 'gap'. Only ever flags overestimating, not underestimating —
// an open question noted in the outline, not yet resolved either way.
export function alignmentFlag(selfTier, actualRating) {
  if (actualRating === null || actualRating === undefined) return 'not_ratable';
  const selfIndex = TIERS.indexOf(selfTier);
  if (selfIndex === -1) return 'not_ratable';

  let actualIndex = TIERS.findIndex(t => {
    const [lo, hi] = TIER_BANDS[t];
    return actualRating >= lo && actualRating <= hi;
  });
  if (actualIndex === -1) actualIndex = actualRating < 50 ? 0 : TIERS.length - 1;

  const gap = selfIndex - actualIndex;
  if (gap <= 0) return 'aligned';
  if (gap === 1) return 'optimistic';
  return 'gap';
}

export const ALIGNMENT_LABELS = {
  aligned: 'Aligned',
  optimistic: 'Slightly Optimistic',
  gap: 'Significant Gap',
  not_ratable: 'Not yet ratable',
};
