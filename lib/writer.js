// ── The sitewide writer pipeline: analyse → brief → write → check → rewrite ─────────────────
// Every AI writer builds its facts in code first (the analysis: highlights, ranked angles,
// every number it may use), then runs the draft through runWriter: the same code checks for
// every writer, cheapest first, and a rewrite naming what was wrong. Pure apart from the
// generate() call each writer passes in — no DB, no prompt wording of its own beyond the
// rejection notes.
//
// Checks (each returns a list of short problem lines, [] = fine):
//   numberProblems     — every number (digits, spelled-out, "N points" pairs, scores) is in the facts
//   claimProblems      — "record", "career high", "first place", "streak", "leads the league"…
//                        only when the facts say so; "ever"/"in league history" never
//   bannedProblems     — the one banned-word list (the site's clichés and filler)
//   lib/highlights.js  — missingHighlights (the MAJOR highlights all mentioned)
//   lib/story-checks.js — comparisonProblems / playerNumberProblems where a writer has rows

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = { thirty: 30, forty: 40, fifty: 50, sixty: 60 };
// Tagalog number words (the conyo voice): from four up, like the English ones ("isa",
// "dalawa", "tatlo" read as words too often). Numbers belong in digits.
const TAGALOG_NUMS = { apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10, dalawampu: 20, tatlumpu: 30, apatnapu: 40 };

// Models write "5‑of‑19" with odd hyphens; normalise before comparing.
const dashes = s => String(s).replace(/[‐-―−]/g, '-');

// Facts as the checks read them: "36pts/17reb" style shorthand expanded, so "36 points" in the
// copy finds its pair.
const STAT_WORDS = { pts: 'points', reb: 'rebounds', ast: 'assists', stl: 'steals', blk: 'blocks', to: 'turnovers', pf: 'fouls' };
function expandFacts(facts) {
  return dashes(facts).toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(pts|reb|ast|stl|blk|to|pf)\b/g, (_, n, k) => `${n} ${STAT_WORDS[k]}`)
    .replace(/(\d+(?:\.\d+)?)\s*(ppg|rpg|apg|spg|bpg)\b/g, (_, n, k) => `${n} ${({ ppg: 'points', rpg: 'rebounds', apg: 'assists', spg: 'steals', bpg: 'blocks' })[k]}`)
    // "PPG: 22.3" and "Steals per game: 2.1" (the race writeups' rank lines).
    .replace(/\b(ppg|rpg|apg|spg|bpg):\s*(\d+(?:\.\d+)?)/g, (m, k, n) => `${m} ${n} ${({ ppg: 'points', rpg: 'rebounds', apg: 'assists', spg: 'steals', bpg: 'blocks' })[k]}`)
    .replace(/\b(points|rebounds|assists|steals|blocks|fouls) per game:\s*(\d+(?:\.\d+)?)/g, (m, k, n) => `${m} ${n} ${k}`);
}
const COPY_STAT = { point: 'points', points: 'points', rebound: 'rebounds', rebounds: 'rebounds', board: 'rebounds', boards: 'rebounds',
  assist: 'assists', assists: 'assists', dime: 'assists', dimes: 'assists', steal: 'steals', steals: 'steals', block: 'blocks', blocks: 'blocks',
  turnover: 'turnovers', turnovers: 'turnovers', foul: 'fouls', fouls: 'fouls' };

/**
 * Every number in the copy must come from the facts.
 * @param {string} text  the copy (headline + body)
 * @param {string} facts every line the writer was given (the brief's facts, not the rules)
 * @param {{ pairs?: boolean, spelled?: boolean }} opts pairs: "13 points" must match a fact pair
 *   (off for copy that rounds or abbreviates); spelled: check "nine" etc. too (default on)
 */
export function numberProblems(text, facts, { pairs = true, spelled = true } = {}) {
  const t = dashes(text).replace(/\*\*/g, '').toLowerCase();
  const f = expandFacts(facts);
  const have = new Set(f.match(/\d+(?:\.\d+)?/g) || []);
  const out = [];
  const bad = [...new Set((t.match(/\d+(?:\.\d+)?/g) || []).filter(n => !have.has(n)))];
  if (bad.length) out.push(`it uses numbers that are not in the facts (${bad.join(', ')})`);
  // Scores and shooting lines ("95-90", "10-of-14") must appear exactly, both sides.
  const badPairs = [...new Set((t.match(/\b\d+-of-\d+\b|\b\d+-\d+\b/g) || []).filter(p => !f.includes(p) && !f.includes(p.replace('-of-', '/'))))];
  if (badPairs.length) out.push(`it writes ${badPairs.map(p => `"${p}"`).join(', ')}, which is not in the facts as written`);
  if (spelled) {
    // zero to three are everyday words ("one of", "the two teams", "from three"): skipped.
    // From four up a spelled number is a stat dodging the digit check.
    const words = [...new Set((t.match(/[a-z]+/g) || []).filter(w => {
      const n = SPELLED.indexOf(w);
      return n > 3 ? !have.has(String(n)) : TENS[w] ? !have.has(String(TENS[w])) : TAGALOG_NUMS[w] ? !have.has(String(TAGALOG_NUMS[w])) : false;
    }))];
    if (words.length) out.push(`it spells out numbers that are not in the facts (${words.join(', ')})`);
  }
  if (pairs) {
    const factPairs = new Set([...f.matchAll(/(\d+(?:\.\d+)?) (points|rebounds|assists|steals|blocks|turnovers|fouls)\b/g)].map(m => `${m[1]} ${m[2]}`));
    const wrong = [...t.matchAll(/(\d+(?:\.\d+)?)[- ](points?|rebounds?|boards?|assists?|dimes?|steals?|blocks?|turnovers?|fouls?)\b/g)]
      .map(m => `${m[1]} ${COPY_STAT[m[2]]}`).filter(p => !factPairs.has(p));
    if (wrong.length) out.push(`it pairs numbers with the wrong stat (${[...new Set(wrong)].join(', ')}) — copy each "N points"-style number with the stat it belongs to`);
  }
  return out;
}

// Claims a writer may only make when a fact backs them. `unless` is tested against the facts.
const CLAIMS = [
  // Not "team record": that's a win-loss record in the MVP/DPOY facts ("team record 4-2").
  { re: /\b(league|wknd|all-time|single-game|scoring) (record|rekord)\b|\brekord\b|\bteam scoring record\b|\brecord[- ](setting|breaking|tying|night|performance)\b|\b(set|broke|tied|matched|equall?ed) (a|the|a new|his|her|their) (\w+ )?record\b|\bnew (\w+ )?record\b/i,
    // Case-sensitive on purpose: the highlight labels, not "TEAM RECORDS (entering this game)".
    // Also the leaders page's own record tiles ("Single-game record across all seasons").
    unless: /\b(LEAGUE|TEAM) RECORD[:( ]|TIED LEAGUE RECORD|[Ss]ingle-game record/, why: 'calls something a record, but no fact says it is one' },
  { re: /\bcareer[- ](high|best)\b|\bpersonal best\b/i, unless: /career[- ]high|CAREER HIGH|MILESTONE: .*Career-high/i, why: 'calls something a career high, but no fact says it is one' },
  { re: /\bseason[- ](high|best)\b/i, unless: /season[- ]high|SEASON HIGH/i, why: 'calls something a season high, but no fact says it is one' },
  { re: /\btriple[- ]double\b/i, unless: /triple[- ]double/i, why: 'mentions a triple-double that no fact gives' },
  // Standings tables print "1. Blue 5-1"; the road section says "Blue takes over first".
  { re: /\b(first|1st) place\b|\bsole possession\b|\btop of the (standings|table|league)\b|\bin first\b|\b(takes?|took) over first\b/i, unless: /first place|FIRST PLACE|first and second|over first|tied for first|1st\b|rank 1\b|#1\b|(^|[:;,]\s*|-\s)1\.\s/im, why: 'puts a team in first place, but no fact says so' },
  // The facts word streaks several ways: "3-game winning streak", "won its last 3 games",
  // "3 runs in a row".
  { re: /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)[- ]game (winning |losing |win |losing )?streak\b|\b(winning|losing) streak\b|\bstraight (wins|losses|games)\b|\bin a row\b|\bsunod[- ]sunod\b/i, unless: /streak|straight|in a row|(won|lost) (its|their|his|her) last \d+/i, why: 'mentions a streak that no fact gives' },
  // Leaderboard facts rank as "1. Name" (homepage leaders, /leaders boards) or "#1 scoring".
  { re: /\b(leads?|leading) the league\b|\bleague[- ]lead(ing|er)?\b|\bbest in the league\b|\btops the league\b/i, unless: /leads the league|league lead|1st in the league|league rank #1\b|rank(ed)?:? 1\b|#1\b|(^|[:;,]\s*|-\s)1\.\s/im, why: 'says someone leads the league, but no fact says so' },
  { re: /\bin (league|wknd|franchise) history\b|\bsa (league |wknd )?history\b|\bof all time\b|\ball[- ]time (high|best|great|record)\b|\bever recorded\b|\bthe most ever\b/i, unless: null, why: 'claims something "in league history" or "of all time" — records here are only "since Season 3"' },
];
export function claimProblems(text, facts) {
  const t = String(text).replace(/\*\*/g, '');
  return CLAIMS.filter(c => c.re.test(t) && !(c.unless && c.unless.test(facts))).map(c => `it ${c.why} ("${t.match(c.re)[0]}")`);
}

// The one banned list: filler, hype and crowd talk every writer is told to avoid. Writers that
// allow a word (the Barbershop roast voice) pass `allow`.
export const BANNED_WORDS = /\b(clash\w*|showdown|impressive|stellar|remarkable|domina(nt|nce|te[sd]?|ting|tion)|showcase\w*|intrigu\w*|epic|electrifying|dazzling|jaw-dropping|heart-pounding|crowd|fans|spectators|key contributor|filled the stat sheet|put on a show|lights out|on fire|did not disappoint|stepped up|came to play|showed up big|nothing short of|hard-fought|gritty|statement win)\b/i;
// The same list, readable, for the prompts (so writers are told every word the check rejects).
export const BANNED_HINT = '"clash", "showdown", "impressive", "stellar", "remarkable", "dominant/dominated", "showcase", "intriguing", "epic", "electrifying", "dazzling", "jaw-dropping", "heart-pounding", "key contributor", "filled the stat sheet", "put on a show", "lights out", "on fire", "did not disappoint", "stepped up", "came to play", "showed up big", "nothing short of", "hard-fought", "gritty", "statement win", and any mention of the crowd, fans or spectators';
export function bannedProblems(text, { allow = null } = {}) {
  const m = String(text).match(BANNED_WORDS);
  return m && !(allow && allow.test(m[0])) ? [`it uses the banned phrase "${m[0]}"`] : [];
}

// Sentences as a reader counts them: a short aside of 3 words or fewer ("Grabe lang.",
// "Sayang talaga.") rides along with the sentence before it instead of using up a slot,
// so a sentence budget doesn't flatten a voice. countSentences / keepSentences(text, n).
function realSentences(text) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const s of parts) {
    if (out.length && s.split(/\s+/).length <= 3) out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out;
}
export const countSentences = text => realSentences(text).length;
export const keepSentences = (text, n) => realSentences(text).slice(0, n).join(' ');

// The rejection note appended to the prompt before a rewrite.
export function rejectionNote(problems) {
  return `\n\nA previous draft was rejected — the new one must fix every point:\n${problems.map(p => `- ${p}`).join('\n')}\nKeep everything else that was right.`;
}

/**
 * The write → check → rewrite loop every writer shares.
 * @param {object} o
 * @param {string} o.prompt                 the brief (facts + rules + voice)
 * @param {(prompt: string) => Promise<any>} o.generate  one AI call; returns the draft
 * @param {(draft: any) => string} [o.text]  the draft as checkable copy (default String)
 * @param {Array<Function|{ fn: Function, costly: true }>} o.checks  each (text, draft) → problems;
 *   every code check runs and all problems go into one rejection note; a { costly } check (an AI
 *   fact check) only runs once the free ones pass
 * @param {number} [o.tries]                 attempts (default 3)
 * @param {string} [o.label]                 for the server log
 * @returns {Promise<{ draft: any, problems: string[], attempts: number }>} the first clean draft, or
 *   the one with the fewest problems (problems says what's still wrong)
 */
export async function runWriter({ prompt, generate, text = d => String(d ?? ''), checks = [], tries = 3, label = 'writer' }) {
  let best = null, p = prompt;
  for (let attempt = 1; attempt <= tries; attempt++) {
    // A provider error (quota, outage) is thrown straight out, never retried here: the
    // callers' cooldowns handle it, and it must not be mistaken for a draft that failed checks.
    const draft = await generate(p);
    const copy = text(draft);
    if (!copy.trim()) continue;
    const problems = [];
    for (const check of checks) {
      const costly = typeof check === 'object' && check.costly;
      if (costly && problems.length) continue;
      problems.push(...((await (costly ? check.fn : check)(copy, draft)) || []));
    }
    if (!best || problems.length < best.problems.length) best = { draft, problems, attempts: attempt };
    if (!problems.length) return best;
    console.warn(`${label} attempt ${attempt} rejected: ${problems.join(' | ')}`);
    p += rejectionNote(problems);
  }
  if (!best) throw new Error(`${label}: no draft came back`);
  return best;
}
