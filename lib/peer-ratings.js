// Shared constants for the roast-style peer rating feature (players rating players).
// Distinct from the unrelated `player_ratings` table in portal-db.js, which holds
// admin/computed scouting ratings (usage, athleticism, etc).

export const RATING_CATEGORIES = [
  { key: 'clutch',        kind: 'positive', emoji: '⚡', label: 'Clutch Factor',  desc: 'Shows up when it matters' },
  { key: 'hustle',        kind: 'positive', emoji: '🔥', label: 'Hustle',        desc: 'Dives, boxouts, effort plays' },
  { key: 'sportsmanship', kind: 'positive', emoji: '🤝', label: 'Sportsmanship', desc: 'How they carry themselves' },
  { key: 'ball_hog',      kind: 'roast',    emoji: '🏀', label: 'Ball Hog',      desc: 'Passing is a rumor' },
  { key: 'flopper',       kind: 'roast',    emoji: '🤡', label: 'Flopper',       desc: 'Sells every bit of contact' },
];

export const RATING_CATEGORY_KEYS = RATING_CATEGORIES.map(c => c.key);

// A rater can update their rating for a given player once per week — checked against
// the row's updated_at, enforced in upsertPeerRating() itself (see portal-db.js) so
// there's no read-then-write race between the check and the write.
export const RATING_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Used only if the AI-written alias pool is empty/exhausted (e.g. first boot before the
// pool has generated, or the AI call is failing) — a submission should never be blocked
// on a pseudonym. Cosmetic only; duplicates across players are a non-issue.
export const ALIAS_FALLBACK_POOL = [
  'Sneaky Badger', 'Silent Hawk', 'Masked Mongoose', 'Shadow Otter', 'Quiet Falcon',
  'Sly Panther', 'Hidden Heron', 'Stealthy Boar', 'Cryptic Crane', 'Phantom Civet',
  'Whisper Wolf', 'Undercover Owl', 'Secret Stingray', 'Lowkey Lynx', 'Mystery Marlin',
  'Incognito Ibis', 'Ghost Gecko', 'Nameless Newt', 'Elusive Egret', 'Anonymous Anteater',
];

// One row per rater→ratee pair per season (see peer_ratings table) — averages are a
// straight mean over every row, since a submission always sets all five categories at
// once (no partial/skipped categories), so the rating count is shared across categories.
export function summarizePeerRatings(rows) {
  const count = rows.length;
  const averages = Object.fromEntries(RATING_CATEGORY_KEYS.map(key => {
    if (!count) return [key, 0];
    const sum = rows.reduce((t, r) => t + Number(r[key] || 0), 0);
    return [key, sum / count];
  }));
  const composite = count
    ? RATING_CATEGORIES.filter(c => c.kind === 'positive').reduce((t, c) => t + averages[c.key], 0)
      / RATING_CATEGORIES.filter(c => c.kind === 'positive').length
    : 0;

  let topPositive = null, topRoast = null;
  for (const cat of RATING_CATEGORIES) {
    const avg = averages[cat.key];
    if (cat.kind === 'positive' && (!topPositive || avg > topPositive.avg)) topPositive = { ...cat, avg };
    if (cat.kind === 'roast'    && (!topRoast    || avg > topRoast.avg))    topRoast    = { ...cat, avg };
  }

  return { count, averages, composite, topPositive, topRoast };
}
