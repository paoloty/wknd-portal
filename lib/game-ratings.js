// Per-game conduct ratings ("Rate your game", docs/plans/ratings-and-raffle.md, Phase 1).
// Players who shared a Papawis run or a league game answer one question about each other,
// "Would you play with them again?", plus optional tags. This is about conduct, not skill:
// skill already comes from box scores (lib/ratings.js). Replaces the roast-style
// lib/peer-ratings.js when the game_ratings_enabled switch is on; its rows stay as an
// archive. Pure constants and summaries, no DB, so views and server can share them.

export const RATE_ANSWERS = [
  { key: 'yes',   label: 'Yes' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'no',    label: 'No' },
  { key: 'skip',  label: 'Skip' },
];
export const RATE_ANSWER_KEYS = RATE_ANSWERS.map(a => a.key);

// Good tags show to the rated player (and, with enough raters, on their public profile).
// Bad tags are admin-only, and a "No" needs at least one so the reason is on record.
export const GOOD_TAGS = [
  ['good_sport', 'Good sport'], ['kept_cool', 'Kept cool'], ['team_first', 'Team-first'],
  ['played_safe', 'Played safe'], ['on_time', 'On time'],
];
export const BAD_TAGS = [
  ['lost_temper', 'Lost temper'], ['dirty_play', 'Dirty play'], ['blamed_teammates', 'Blamed teammates'],
  ['late_no_show', 'Late / no-show'],
];
export const TAG_LABEL = Object.fromEntries([...GOOD_TAGS, ...BAD_TAGS]);
const GOOD_KEYS = new Set(GOOD_TAGS.map(([k]) => k));
const BAD_KEYS = new Set(BAD_TAGS.map(([k]) => k));
export const isGoodTag = k => GOOD_KEYS.has(k);
export const isBadTag = k => BAD_KEYS.has(k);

// Ratings stay open this many days after the game (or after the first ask, if that came later).
export const RATE_WINDOW_DAYS = 3;
// Public highlights only once this many different players have rated someone.
export const PUBLIC_MIN_RATERS = 5;
// Conduct watch: this many different players said "No", and the player has ratings from
// this many different games. A nudge for admins, never a decision.
export const WATCH_MIN_NO_RATERS = 3;
export const WATCH_MIN_GAMES = 3;
export const NOTE_MAX = 300;

// Clean a submitted answer for one player. Returns { answer, tags, note } or { error }.
export function cleanRating({ answer, tags, note }) {
  const a = String(answer || '');
  if (!RATE_ANSWER_KEYS.includes(a)) return { error: 'Pick Yes, Maybe, No or Skip.' };
  if (a === 'skip') return { answer: a, tags: [], note: '' };
  const t = [...new Set([].concat(tags || []).map(String).filter(k => GOOD_KEYS.has(k) || BAD_KEYS.has(k)))];
  if (a === 'no' && !t.some(k => BAD_KEYS.has(k))) return { error: 'Pick what went wrong for a "No".' };
  return { answer: a, tags: t, note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) };
}

const parseTags = json => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// Ratings about one player (rows from game_ratings, ignored ones already left out).
// Skips count toward nothing.
export function summarizeConduct(rows) {
  const live = rows.filter(r => r.answer !== 'skip');
  const count = k => live.filter(r => r.answer === k).length;
  const raters = new Set(live.map(r => r.rater_player_id));
  const games = new Set(live.map(r => `${r.kind}:${r.ref}`));
  const noRows = live.filter(r => r.answer === 'no');
  const tagCounts = {};
  for (const r of live) for (const t of parseTags(r.tags_json)) tagCounts[t] = (tagCounts[t] || 0) + 1;
  const byCount = list => list.map(([k, label]) => ({ k, label, n: tagCounts[k] || 0 })).filter(t => t.n).sort((a, b) => b.n - a.n);
  const noRaters = new Set(noRows.map(r => r.rater_player_id)).size;
  return {
    total: live.length, yes: count('yes'), maybe: count('maybe'), no: count('no'),
    raters: raters.size, games: games.size, noRaters,
    good: byCount(GOOD_TAGS), bad: byCount(BAD_TAGS),
    watch: noRaters >= WATCH_MIN_NO_RATERS && games.size >= WATCH_MIN_GAMES,
    showPublic: raters.size >= PUBLIC_MIN_RATERS,
  };
}

// Raters worth a second look: 5+ answers and at least 60% of them "No".
export function raterFlags(rows) {
  const by = {};
  for (const r of rows) {
    if (r.answer === 'skip') continue;
    const x = (by[r.rater_player_id] ??= { raterId: r.rater_player_id, raterName: r.rater_name || '', total: 0, no: 0 });
    x.total++; if (r.answer === 'no') x.no++;
  }
  return Object.values(by).filter(x => x.total >= 5 && x.no / x.total >= 0.6).sort((a, b) => b.no / b.total - a.no / a.total);
}
