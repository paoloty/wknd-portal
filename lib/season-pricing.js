// Canonical jersey pricing for season signup. Both the member-facing signup form
// (live price display) and the admin charge-preview/teams-start routes import from
// here so the displayed price and the real charge can never drift apart.

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

// Chest/length (top) and hips/length (shorts), in inches, per size — shown to members
// on both the season-signup form and the jersey-request form so the two never drift.
export const SIZE_CHART = {
  top:    { XS: [19, 27], S: [20, 28], M: [21, 29], L: [22, 30], XL: [23, 31], '2XL': [24, 32], '3XL': [25, 33], '4XL': [26, 34], '5XL': [27, 36] },
  shorts: { XS: [21, 19], S: [22, 20], M: [23, 21], L: [24, 22], XL: [25, 23], '2XL': [26, 24], '3XL': [27, 25], '4XL': [28, 26], '5XL': [29, 27] },
};

// Sizes past XL, in ascending order — index+1 = number of surcharge "steps" applied.
const SURCHARGE_TIERS = ['2XL', '3XL', '4XL', '5XL'];

// Per-size surcharge over the base top/shorts price. XS–XL: 0. 2XL: 1×step, 3XL: 2×step, etc.
export function sizeSurcharge(size, stepAmount) {
  const tierIndex = SURCHARGE_TIERS.indexOf(size);
  if (tierIndex === -1) return 0;
  return (tierIndex + 1) * (Number(stepAmount) || 0);
}

// Total jersey cost for one signup (top + optional shorts + optional pockets).
// Pockets only ever apply when shorts are actually selected.
export function computeJerseyTotal({
  topPrice = 0, shortPrice = 0, jerseyTop = '', jerseyShorts = '',
  pockets = false, pocketsPrice = 0, surchargeStep = 0,
}) {
  let total = 0;
  if (jerseyTop) total += Number(topPrice) + sizeSurcharge(jerseyTop, surchargeStep);
  if (jerseyShorts) {
    total += Number(shortPrice) + sizeSurcharge(jerseyShorts, surchargeStep);
    if (pockets) total += Number(pocketsPrice) || 0;
  }
  return total;
}

// Same math as computeJerseyTotal, split into the top/shorts amounts individually — for
// anywhere a per-line breakdown is shown (Start Season review screen, the confirmation
// email) rather than just one combined number.
export function computeJerseyBreakdown({
  topPrice = 0, shortPrice = 0, jerseyTop = '', jerseyShorts = '',
  pockets = false, pocketsPrice = 0, surchargeStep = 0,
}) {
  const topAmount = jerseyTop ? Number(topPrice) + sizeSurcharge(jerseyTop, surchargeStep) : 0;
  let shortsAmount = 0;
  if (jerseyShorts) {
    shortsAmount = Number(shortPrice) + sizeSurcharge(jerseyShorts, surchargeStep);
    if (pockets) shortsAmount += Number(pocketsPrice) || 0;
  }
  return { topAmount, shortsAmount, total: topAmount + shortsAmount };
}
