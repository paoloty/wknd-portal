// MVP reveal lock: the Season MVP order stays secret from the moment the season has a
// playoff/finals game on the schedule until Finals Game 2 is complete (the award is handed
// out there). Every MVP surface asks isMvpLocked(season) so they can't disagree: /mvp,
// the homepage sidebar, the mega menu, share cards, OG tags/images and the AI writeups.
//
// Admin override (site_settings.mvp_reveal_mode, /admin/visibility): 'auto' (default),
// 'locked' or 'revealed'. It only applies to the current portal season; past seasons
// always follow the automatic rule.
import { getAllGames, getSetting, getPortalCurrentSeason } from './portal-db.js';
import { finalsGame2Id } from './picks.js';

export const MVP_REVEAL_MODES = ['auto', 'locked', 'revealed'];

export function mvpRevealMode() {
  const m = getSetting('mvp_reveal_mode', 'auto');
  return MVP_REVEAL_MODES.includes(m) ? m : 'auto';
}

// The automatic rule alone. The lock starts on any non-regular game being scheduled, not on
// "all regular games played": the last regular-season games may not be on the schedule yet.
// Under-review games count here, so a game pulled for review can't unlock the race early.
// Done = 'complete' or 'final' (the admin app writes both; Season 3's Game 2 is 'final').
export function mvpAutoLock(season) {
  const s = String(season);
  const games = getAllGames().filter(g => String(g.season) === s);
  if (!games.some(g => (g.game_type || 'regular') !== 'regular')) {
    return { locked: false, note: 'Not locked: no playoff games on the schedule yet' };
  }
  const pickShaped = games.map(g => ({ id: g.id, season: s, type: g.game_type, ymd: String(g.date || '').slice(0, 10) }));
  const g2 = games.find(g => g.id === finalsGame2Id(pickShaped, s));
  const done = g2 && !g2.under_review && (g2.status === 'complete' || g2.status === 'final');
  return done
    ? { locked: false, note: 'Revealed: Finals Game 2 is complete' }
    : { locked: true, note: 'Locked: playoffs scheduled, reveals after Finals Game 2' };
}

// { season, mode, locked, auto } — mode is the override in force for this season.
export function mvpLockState(season = getPortalCurrentSeason()) {
  const s = String(season);
  const auto = mvpAutoLock(s);
  const mode = s === String(getPortalCurrentSeason()) ? mvpRevealMode() : 'auto';
  const locked = mode === 'locked' ? true : mode === 'revealed' ? false : auto.locked;
  return { season: s, mode, locked, auto };
}

export function isMvpLocked(season = getPortalCurrentSeason()) {
  return mvpLockState(season).locked;
}

// Finalists while locked: the top 3 by `score`, re-sorted alphabetically (by LASTNAME, the
// stored "LASTNAME, Firstname" order) so the list order says nothing about the vote.
export function mvpFinalists(candidates, score, nameOf = c => c.name) {
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b))));
}
