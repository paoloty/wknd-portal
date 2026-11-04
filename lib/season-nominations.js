// "Anyone you wouldn't want to play with again?" on the season sign-up (Paolo, 2026-11-05). Admins
// see it on Season → Candidates and use it, with everything else, to choose who plays next season.
// It never moves anyone's rank by itself. No reasons are asked for. Answers live in their own table
// (season_nominations) so they never travel with a sign-up row, and the sign-up's log entry holds
// the event only. No database in here.
export const MAX_NOMINATIONS = 2;
// From this many different people, Candidates points it out.
export const NOMINATION_FLAG_AT = 2;

// What a sign-up may save: real players, not yourself, no repeats, at most MAX_NOMINATIONS.
export function cleanNominations(raw, { selfId = '', validIds = new Set() } = {}) {
  const out = [];
  for (const id of [].concat(raw || []).map(v => String(v || '').trim())) {
    if (!id || id === selfId || !validIds.has(id) || out.includes(id)) continue;
    if (out.length < MAX_NOMINATIONS) out.push(id);
  }
  return out;
}

// rows: [{ nominee_player_id, nominator_name, nominator_player_id }] → { [playerId]: { count, names } }.
// An admin sees who named everyone except themselves: they're players too, and knowing who named
// them invites payback. They still see their own count.
export function summarizeNominations(rows, { viewerPlayerId = '' } = {}) {
  const out = {};
  for (const r of rows) {
    const s = (out[r.nominee_player_id] ??= { count: 0, names: [], hidden: false });
    s.count++;
    if (viewerPlayerId && r.nominee_player_id === viewerPlayerId) s.hidden = true;
    else s.names.push(r.nominator_name);
  }
  for (const s of Object.values(out)) s.names.sort((a, b) => a.localeCompare(b));
  return out;
}
