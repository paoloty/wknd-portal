// ── Major highlights for the AI writers (preview storyline, recap, POTG spotlight) ──────────
// server.js detects what happened (gameHighlights / previewHighlights) as a list of
// highlights; this file is the pure part: ranking them, the MUST MENTION prompt block, and the
// code check that a draft actually covered them. A draft that misses one is rewritten with the
// miss named (the writer's own retry loop), so a 10-three league record can't go unmentioned.
//
// A highlight: { tier: 'major' | 'notable', rank, subject, text, must }
//   rank    — higher first when there are more majors than a piece has room for
//   subject — a player id or team name, so one piece gets at most one MUST per subject
//   text    — the verified line handed to the writer ("LEAGUE RECORD: …")
//   must    — what the copy has to contain: a list of groups, every group must match, any
//             alternative within a group will do, e.g. [['salenga', 'vin'], ['10', 'ten']].
//             Alternatives are plain words/numbers (matched whole, case-insensitive) or
//             RegExp objects.

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ORDINAL_WORDS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordinalOf = v => `${v}${(v % 100 >= 11 && v % 100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][v % 10] || 'th')}`;

// A number a writer may spell out: "10", "ten", and the ordinal ("10th", "tenth" — a
// "fourth straight win" covers a 4-game streak). Up to twenty in words.
export function numberAlts(n) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0) return [String(n)];
  return v <= 20 ? [String(v), NUMBER_WORDS[v], ordinalOf(v), ORDINAL_WORDS[v]] : [String(v), ordinalOf(v)];
}

// A player's name a writer may use: last name or first name ("SALENGA, Vin" → salenga, vin).
// Multi-word last names match on any of their words longer than 2 letters.
export function nameAlts(raw) {
  const s = String(raw || '');
  const i = s.indexOf(',');
  const parts = (i === -1 ? s : `${s.slice(0, i)} ${s.slice(i + 1)}`).split(/\s+/).map(w => w.trim()).filter(w => w.length > 2);
  return [...new Set(parts.map(w => w.toLowerCase()))];
}

function matches(text, alt) {
  if (alt instanceof RegExp) return alt.test(text);
  return new RegExp(`(^|[^\\w])${escapeRe(String(alt).toLowerCase())}(?=$|[^\\w])`, 'i').test(text);
}

// Records (rank 90+: league and team records, triple-doubles, titles) are always a MUST, even a
// second one for the same player — 36 points AND 10 threes both get said.
export const ALWAYS_RANK = 90;

// The majors one piece must cover: best rank first, one per subject (records excepted), at most
// `max`.
export function mustMentions(highlights, max) {
  const seen = new Set();
  const out = [];
  for (const h of [...highlights].filter(h => h.tier === 'major').sort((x, y) => y.rank - x.rank)) {
    if (seen.has(h.subject) && h.rank < ALWAYS_RANK) continue;
    seen.add(h.subject);
    out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

// The prompt block: the must-mentions, then everything else as optional hooks.
// maxRest caps the optional list (a recap given 12 career highs wrote all 12 as a list).
export function highlightsBlock(highlights, musts, { maxRest = Infinity } = {}) {
  const rest = highlights.filter(h => !musts.includes(h)).sort((x, y) => y.rank - x.rank).slice(0, maxRest);
  return [
    musts.length ? `MAJOR HIGHLIGHTS (verified) — the copy MUST mention every one of these, with the player or team named and the number exactly as given. They outrank everything else; lead with the biggest one:\n${musts.map(h => `- ${h.text}`).join('\n')}` : '',
    rest.length ? `OTHER HIGHLIGHTS (verified, use if they fit):\n${rest.map(h => `- ${h.text}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

// The musts a draft left out, as short lines for the retry note ([] = all covered). Every
// group has to match inside one sentence (or a sentence and the next), so "from three"
// elsewhere can't stand in for a 3-game streak, nor "10 rebounds" for a 10-point comeback.
export function missingHighlights(text, musts) {
  const t = String(text || '').replace(/\*\*/g, '');
  const sentences = t.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const windows = sentences.map((s, i) => (sentences[i + 1] ? `${s} ${sentences[i + 1]}` : s));
  const covered = h => windows.some(w => h.must.every(group => group.some(alt => matches(w, alt))));
  return musts.filter(h => !covered(h)).map(h => h.text);
}

// The retry note added to the prompt after a draft that missed some.
export function missedNote(missed) {
  return `\n\nA previous draft was rejected because it left out these MAJOR HIGHLIGHTS — the new one must mention each, naming the player or team and using the exact number:\n${missed.map(m => `- ${m}`).join('\n')}`;
}
