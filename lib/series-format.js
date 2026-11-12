// The playoff series format, read from the Season format text on /admin/season (Paolo,
// 2026-11-13: writers should detect the format, not have it typed into every prompt), e.g.
//   "Regular Season: Double Round Robin, Semis: Top 2 Twice to Beat, Finals: Best of 3"
//   "Double Round Robin · Top 4 Twice-to-Beat · Finals Best of 3"
// Each round is one of:
//   twice  — the higher seed advances with 1 win, the lower seed needs 2 ("twice to beat")
//   bestof — best of N, first to ceil(N/2) wins, seeds don't matter
//   single — one game, winner advances
// A round the text doesn't name (or a blank text) keeps the league's rules: semis twice to
// beat, Finals best of 3. Pure: no DB, so tests and views can call it.

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
const num = s => (/^\d+$/.test(s) ? Number(s) : WORDS[String(s).toLowerCase()] || 0);

export const DEFAULT_SEASON_FORMAT = 'Semis: Top 2 Twice to Beat · Finals: Best of 3';

function round(kind, n = 0) {
  if (kind === 'twice') return { kind, high: 1, low: 2, label: 'twice to beat' };
  if (kind === 'single') return { kind, high: 1, low: 1, label: 'one game' };
  const w = Math.ceil(n / 2);
  return { kind: 'bestof', n, high: w, low: w, label: `best of ${n}` };
}

// One part of the text ("Semis: Top 2 Twice to Beat") → a round, or null when it names none.
function roundIn(part) {
  if (/twice[- ]to[- ](beat|win)/i.test(part)) return round('twice');
  const bo = part.match(/best[- ]of[- ](\d+|three|five|seven)/i);
  if (bo && num(bo[1]) > 1) return round('bestof', num(bo[1]));
  const ft = part.match(/first to (\d+|two|three|four) wins?/i);
  if (ft && num(ft[1]) > 0) return round('bestof', num(ft[1]) * 2 - 1);
  if (/\b(one|single)[- ]game\b|\bknockout\b|\bsudden[- ]death\b|\bwinner[- ]takes?[- ]all\b/i.test(part)) return round('single');
  return null;
}

export function parseSeasonFormat(text) {
  let semis = null, finals = null;
  for (const part of String(text || '').split(/[·•,;|\n]+/)) {
    const r = roundIn(part);
    if (!r) continue;
    // "Finals: Best of 3" is the Finals; anything else that names a format is the semis
    // ("Semis: …", "Top 2 Twice to Beat", "Top 4 Twice-to-Beat").
    if (/final/i.test(part) && !/semi/i.test(part)) finals = finals || r;
    else semis = semis || r;
  }
  return {
    semis: semis || round('twice'),
    // Twice to beat needs seeds on both sides; in the Finals it's read as best of 3.
    finals: finals && finals.kind !== 'twice' ? finals : round('bestof', 3),
  };
}

// The rule in words, for a writer's facts.
export function roundRule(r, finals = false) {
  if (r.kind === 'twice') return 'twice to beat: the higher seed advances with 1 win, the lower seed needs 2';
  if (r.kind === 'single') return `one game: the winner ${finals ? 'is champion' : 'advances'}`;
  return `best of ${r.n}: first to ${r.high} wins ${finals ? 'is champion' : 'advances'}`;
}

// The whole bracket in one line (standings / playoffs writers).
export function formatFactLine(f) {
  return `Format: the top 4 teams make the semifinals, 1st vs 4th and 2nd vs 3rd. Semifinals: ${roundRule(f.semis)}. Finals: ${roundRule(f.finals, true)}.`;
}

// Short label for a kicker or card ("Best of 3", "Twice to beat", "One game").
export const roundLabel = r => r.label.replace(/^./, c => c.toUpperCase());
