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

// Multiple admins can each leave their own tag/note/vote on the same assessment
// (assessment_admin_reviews, one row per (assessment, reviewer)) — replacing the old single
// shared admin_tag/admin_note pair. There's no one "official" tag to store anymore, so the
// at-a-glance badge is always derived live from whichever review is most severe.
export const REVIEW_TAG_LABELS = {
  '': 'Not reviewed',
  no_concerns: 'No concerns',
  worth_conversation: 'Worth a conversation',
  discuss_admin: 'Discuss w/ admin team',
};
const REVIEW_TAG_SEVERITY = { '': 0, no_concerns: 1, worth_conversation: 2, discuss_admin: 3 };

// Vote is purely advisory — it never gates the actual Confirm/Reject action on the signup,
// just a yes/no tally admins can glance at alongside the tag.
export function summarizeReviews(reviews) {
  let tag = '';
  let yes = 0, no = 0;
  for (const r of reviews) {
    if ((REVIEW_TAG_SEVERITY[r.tag] ?? 0) > REVIEW_TAG_SEVERITY[tag]) tag = r.tag;
    if (r.vote === 'yes') yes++;
    else if (r.vote === 'no') no++;
  }
  return { tag, yes, no, count: reviews.length };
}
