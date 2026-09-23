// ── Badge catalog & computation ─────────────────────────────────────────────
// Pure functions only — no DB access here (matches lib/player-analysis.js). Callers in
// server.js fetch the season stat row (getPlayerStatsByType), the game log
// (getPlayerGameLog) and the team's regular-season game count (getTeamGamesCount), then
// pass plain data in.
//
// v1 scope, agreed with Paolo: season-scoped and re-earnable every season, on-court stats
// only, computed at render time (no stored `badges` table yet — that + a per-badge earner
// leaderboard are follow-ups). BADGE_CATALOG below is the single source of truth for name/
// icon/description/thresholds — computeSeasonBadges reads off it rather than duplicating
// those strings, so the /badges specs page can never drift from what actually gets awarded.
//
// Dropped from the original brainstorm for v1: Deep Sniper (2+ four-pointers in a game —
// redundant with 4-Point Play while fg4m is at 0 league-wide), Iron Man Streak (needs
// multi-season data we don't have a clean model for yet), Two-Way (a combined-stat badge
// that needs real percentile data, not just fixed thresholds). The three single-game
// scoring tiers (20/25/30 pts) were consolidated into one tiered "Big Night" badge rather
// than three separate always-stacking ones, to match the medallion tier UI everywhere else.

export const TIERS = ['bronze', 'silver', 'gold'];

function tierFor(value, thresholds) {
  if (value >= thresholds.gold) return 'gold';
  if (value >= thresholds.silver) return 'silver';
  if (value >= thresholds.bronze) return 'bronze';
  return null;
}

// ── Catalog ──────────────────────────────────────────────────────────────────
// category: 'milestone' (season-cumulative, tiered) | 'rate' (season per-game average) |
// 'feat' (single-game or season flag, no tier) | 'durability' | 'legendary'.

const MILESTONE_BADGES = [
  { id: 'century-club',  name: 'Century Club',  icon: 'basketball', category: 'milestone', statKey: 'pts',  unit: 'PTS', thresholds: { bronze: 50, silver: 80,  gold: 110 }, description: 'Score enough points across the season to reach a tier.' },
  { id: 'boards',        name: 'Boards',        icon: 'board',      category: 'milestone', statKey: 'reb',  unit: 'REB', thresholds: { bronze: 30, silver: 50,  gold: 65  }, description: 'Grab enough rebounds across the season to reach a tier.' },
  { id: 'dimer',         name: 'Dimer',         icon: 'pass',       category: 'milestone', statKey: 'ast',  unit: 'AST', thresholds: { bronze: 15, silver: 22,  gold: 30  }, description: 'Rack up enough assists across the season to reach a tier.' },
  { id: 'lockdown',      name: 'Lockdown',      icon: 'shield',     category: 'milestone', statKey: 'stl',  unit: 'STL', thresholds: { bronze: 6,  silver: 9,   gold: 12  }, description: 'Come up with enough steals across the season to reach a tier.' },
  { id: 'rim-protector', name: 'Rim Protector', icon: 'block',      category: 'milestone', statKey: 'blk',  unit: 'BLK', thresholds: { bronze: 4,  silver: 7,   gold: 10  }, description: 'Reject enough shots across the season to reach a tier.' },
  { id: 'deep-range',    name: 'Deep Range',    icon: 'target',     category: 'milestone', statKey: 'fg3m', unit: '3PM', thresholds: { bronze: 6,  silver: 10,  gold: 14  }, description: 'Make enough three-pointers across the season to reach a tier.' },
  { id: 'big-night',     name: 'Big Night',     icon: 'basketball', category: 'milestone', statKey: null,   unit: 'PTS', thresholds: { bronze: 20, silver: 25,  gold: 30  }, description: 'Score enough points in a single game to reach a tier — your best game of the season sets it.' },
];

const RATE_BADGES = [
  { id: 'facilitator',   name: 'Facilitator',   icon: 'pass',  category: 'rate', statKey: 'ast', unit: 'AST', threshold: 4.0, minGp: 3, description: 'Average 4.0+ assists per game across the season (minimum 3 games played).' },
  { id: 'glass-cleaner', name: 'Glass Cleaner', icon: 'board', category: 'rate', statKey: 'reb', unit: 'REB', threshold: 6.0, minGp: 3, description: 'Average 6.0+ rebounds per game across the season (minimum 3 games played).' },
];

const FEAT_BADGES = [
  { id: 'double-double',      name: 'Double-Double',      icon: 'spark',  category: 'feat',       description: 'Reach double digits in two of pts/reb/ast/stl/blk in one game.' },
  { id: 'five-steal-game',    name: '5-Steal Game',       icon: 'shield', category: 'feat',       description: 'Record 5 or more steals in a single game.' },
  { id: 'five-block-game',    name: '5-Block Game',       icon: 'block',  category: 'feat',       description: 'Record 5 or more blocks in a single game.' },
  { id: 'sharpshooter-night', name: 'Sharpshooter Night', icon: 'target', category: 'feat',       description: 'Make 4 or more three-pointers in a single game.' },
  { id: 'iron-man',           name: 'Iron Man',           icon: 'shield', category: 'durability', description: "Play every one of your team's regular-season games this season." },
];

const LEGENDARY_BADGES = [
  { id: 'four-point-play', name: '4-Point Play', icon: 'target', category: 'legendary', description: "Make a 4-pointer — the league's own deep-range rule. Nobody's done it league-wide yet." },
  { id: 'triple-double',   name: 'Triple-Double', icon: 'spark',  category: 'legendary', description: 'Reach double digits in three of pts/reb/ast/stl/blk in one game. Never recorded league-wide.' },
];

// Full catalog, for the /badges specs page — every badge that computeSeasonBadges can award,
// in one flat list.
export const BADGE_CATALOG = [...MILESTONE_BADGES, ...RATE_BADGES, ...FEAT_BADGES, ...LEGENDARY_BADGES];

const BY_ID = Object.fromEntries(BADGE_CATALOG.map(b => [b.id, b]));

const DOUBLE_DIGIT_CATS = [
  ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'],
];

function qualifyingCats(g) {
  return DOUBLE_DIGIT_CATS.filter(([key]) => (g[key] || 0) >= 10);
}

function statCatCount(g) {
  return qualifyingCats(g).length;
}

// e.g. "22 PTS · 11 REB" — only the categories that actually hit double digits, so it never
// misrepresents which stats made the double/triple-double (could be stl+blk, not reb+ast).
function qualifyingStatLine(g) {
  return qualifyingCats(g).map(([key, label]) => `${g[key]} ${label}`).join(' · ');
}

function bestBy(games, key) {
  return games.reduce((best, g) => (!best || (g[key] || 0) > (best[key] || 0)) ? g : best, null);
}

/**
 * @param {object} seasonRow - one row from getPlayerStatsByType(id).seasons, already
 *   filtered by caller to { season, game_type: 'regular' } (or null if the player has no
 *   regular-season stats this season)
 * @param {object[]} seasonGames - getPlayerGameLog(id) rows, already filtered by caller to
 *   this season, game_type === 'regular', status === 'played'
 * @param {number} teamGamesPlayed - getTeamGamesCount(teamId, season) — the Iron Man denominator
 * @returns {{ earned: object[], pending: object[] }}
 */
export function computeSeasonBadges(seasonRow, seasonGames, teamGamesPlayed) {
  const earned = [];
  const pending = [];
  const gp = seasonRow?.games_played || 0;

  if (!gp) return { earned, pending };

  // Season-cumulative milestones
  for (const b of MILESTONE_BADGES) {
    if (!b.statKey) continue; // Big Night is handled separately below (per-game, not season row)
    const value = seasonRow[b.statKey] || 0;
    const tier = tierFor(value, b.thresholds);
    if (tier) earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'tiered', tier, meta: `${value} ${b.unit}` });
  }

  // Big Night — best single-game scoring tier this season
  const bigNight = BY_ID['big-night'];
  const topScoring = bestBy(seasonGames, 'pts');
  if (topScoring) {
    const tier = tierFor(topScoring.pts || 0, bigNight.thresholds);
    if (tier) earned.push({ id: bigNight.id, name: bigNight.name, icon: bigNight.icon, kind: 'tiered', tier, meta: `${topScoring.pts} PTS` });
  }

  // Single-game feats (flat, no tier)
  // >= 2, not exactly 2 — a triple-double is trivially also a double-double (standard
  // basketball convention), so it should still count toward this one.
  const doubleDoubles = seasonGames.filter(g => statCatCount(g) >= 2);
  if (doubleDoubles.length) {
    const best = bestBy(doubleDoubles, 'pts');
    const times = doubleDoubles.length > 1 ? ` · ${doubleDoubles.length}x` : '';
    const b = BY_ID['double-double'];
    earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${qualifyingStatLine(best)}${times}` });
  }
  const fiveSteal = seasonGames.filter(g => (g.stl || 0) >= 5);
  if (fiveSteal.length) {
    const best = bestBy(fiveSteal, 'stl');
    const b = BY_ID['five-steal-game'];
    earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${best.stl} STL` });
  }
  const fiveBlock = seasonGames.filter(g => (g.blk || 0) >= 5);
  if (fiveBlock.length) {
    const best = bestBy(fiveBlock, 'blk');
    const b = BY_ID['five-block-game'];
    earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${best.blk} BLK` });
  }
  const sharpshooterNights = seasonGames.filter(g => (g.fg3m || 0) >= 4);
  if (sharpshooterNights.length) {
    const best = bestBy(sharpshooterNights, 'fg3m');
    const b = BY_ID['sharpshooter-night'];
    earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${best.fg3m} 3PM` });
  }

  // Durability
  const isIronMan = teamGamesPlayed > 0 && gp === teamGamesPlayed;
  if (isIronMan) {
    const b = BY_ID['iron-man'];
    earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${gp}/${teamGamesPlayed} games` });
  }

  // Rate badges — earned or queued as a "next up" progress teaser
  for (const b of RATE_BADGES) {
    const avg = gp ? (seasonRow[b.statKey] || 0) / gp : 0;
    if (gp >= b.minGp && avg >= b.threshold) {
      earned.push({ id: b.id, name: b.name, icon: b.icon, kind: 'feat', meta: `${avg.toFixed(1)} ${b.unit}/G` });
    } else {
      pending.push({
        id: b.id, name: b.name, icon: b.icon, kind: 'rate',
        meta: `${avg.toFixed(1)} / ${b.threshold.toFixed(1)} ${b.unit} per game`,
        progress: Math.max(0, Math.min(1, avg / b.threshold)),
      });
    }
  }

  // Legendary
  const fourPointPlay = BY_ID['four-point-play'];
  const fg4m = seasonRow.fg4m || 0;
  if (fg4m > 0) {
    earned.push({ id: fourPointPlay.id, name: fourPointPlay.name, icon: fourPointPlay.icon, kind: 'legendary', meta: `${fg4m} made` });
  } else {
    pending.push({ id: fourPointPlay.id, name: fourPointPlay.name, icon: fourPointPlay.icon, kind: 'legendary', meta: 'Make a 4-pointer to unlock' });
  }
  const tripleDouble = BY_ID['triple-double'];
  const tripleDoubles = seasonGames.filter(g => statCatCount(g) >= 3);
  if (tripleDoubles.length) {
    earned.push({ id: tripleDouble.id, name: tripleDouble.name, icon: tripleDouble.icon, kind: 'legendary', meta: qualifyingStatLine(tripleDoubles[0]) });
  } else {
    pending.push({ id: tripleDouble.id, name: tripleDouble.name, icon: tripleDouble.icon, kind: 'legendary', meta: 'Post a triple-double to unlock' });
  }

  return { earned, pending };
}

// Inner SVG markup (no wrapping <svg> tag) — views/player.js and views/badges.js wrap these
// in <svg viewBox="0 0 24 24">...</svg> at render time. Small deliberately-reused set (7
// glyphs across 16 badges) rather than one icon per badge, grouped by theme: scoring,
// rebounding, playmaking, on-ball defense/durability, shot-blocking, shooting range,
// stat-stuffing.
export const BADGE_ICONS = {
  basketball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3v18"/><path d="M5.8 5.8c2.6 2.9 2.6 9.5 0 12.4"/><path d="M18.2 5.8c-2.6 2.9-2.6 9.5 0 12.4"/>',
  board: '<rect x="4" y="4" width="16" height="10" rx="1"/><path d="M9 14v3M15 14v3"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none"/>',
  pass: '<path d="M4 8c4-3 12-3 16 0"/><path d="M17 5l3 3-3 3"/><path d="M20 16c-4 3-12 3-16 0"/><path d="M7 19l-3-3 3-3"/>',
  shield: '<path d="M12 2.5l7 2.8v6c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10v-6l7-2.8z"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  spark: '<path d="M12 2c.6 3.8 2 6.4 5.5 8-3.5 1.6-4.9 4.2-5.5 8-.6-3.8-2-6.4-5.5-8 3.5-1.6 4.9-4.2 5.5-8z" fill="currentColor" stroke="none"/><path d="M19.5 3c.3 1.6.9 2.6 2.5 3.2-1.6.6-2.2 1.6-2.5 3.2-.3-1.6-.9-2.6-2.5-3.2 1.6-.6 2.2-1.6 2.5-3.2z" fill="currentColor" stroke="none"/>',
};
