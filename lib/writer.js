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

import { appendFileSync } from 'fs';

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
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function expandFacts(facts) {
  return dashes(facts).toLowerCase()
    // Dates whitelist digits by accident ("2026-09-27" let a made-up 27 through): only the day
    // survives, as "sep 27" (a recap may say "back on September 27").
    .replace(/\b\d{4}-(\d{2})-(\d{2})\b/g, (_, mo, d) => `${MONTHS[Number(mo) - 1] || ''} ${Number(d)}`)
    // "MAROON 9 – 25 BLUE" is the pair "9-25"; a play-by-play "[BLU 89 - BLA 89]" too.
    .replace(/(\d)\s+-\s+(\d)/g, '$1-$2')
    .replace(/\b([a-z]{3}) (\d+) - ([a-z]{3}) (\d+)\b/g, (m, a, x, b, y) => `${m} ${x}-${y}`)
    // "11 unanswered points" may be written "11-0 run".
    .replace(/\b(\d+) unanswered points\b/g, '$1 unanswered points $1-0')
    // "33 points (previous best 23)" / "33 points … (previous record 30 …": the earlier number
    // is the same stat ("his 23-point previous best").
    .replace(/(\d+) (points|rebounds|assists|steals|blocks|threes)([^()\n]{0,80})\(previous (?:best|record) (\d+)/g, (m, n, k, mid, prev) => `${n} ${k}${mid}(previous ${prev} ${k} ${prev}`)
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
  // "10-of-18", "0-for-5", "95-90": both numbers must sit together in the facts, in any of the
  // ways they write a pair ("10/18", "10 of 18", "10-of-18", "95-90").
  // A plain score may be written winner-first ("25-9" for the facts' "MAROON 9-25 BLUE"): the
  // reversed pair counts too; which side it belongs to is the fact check's job.
  const badPairs = [...new Set((t.match(/\b\d+-(?:of|for)-\d+\b|\b\d+-\d+\b/g) || []).filter(p => {
    const [a, b] = p.split(/-(?:of|for)-|-/);
    const forms = [`${a}-${b}`, `${a}/${b}`, `${a} of ${b}`, `${a}-of-${b}`, `${a} for ${b}`];
    if (!/-(?:of|for)-/.test(p)) forms.push(`${b}-${a}`);
    return !forms.some(form => f.includes(form));
  }))];
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
  // "10 threes — also a Season 3 record": records here are the most SINCE Season 3.
  { re: /\ba season \d+ record\b|\bseason \d+'s record\b|\brecord (?:from|in) season \d+\b/i, unless: null, why: 'calls it "a Season N record" — say "the most since Season 3" (records cover every season since then)' },
  // Not "team record": that's a win-loss record in the MVP/DPOY facts ("team record 4-2").
  { re: /\b(league|wknd|all-time|single-game|scoring) (record|rekord)\b|\brekord\b|\bteam scoring record\b|\brecord[- ](setting|breaking|tying|night|performance)\b|\b(set|broke|tied|matched|equall?ed) (a|the|a new|his|her|their) (\w+ )?record\b|\bnew (\w+ )?record\b/i,
    // Case-sensitive on purpose: the highlight labels, not "TEAM RECORDS (entering this game)".
    // Also the leaders page's own record tiles ("Single-game record across all seasons").
    unless: /\b(LEAGUE|TEAM) RECORD[:( ]|TIED LEAGUE RECORD|[Ss]ingle-game record/, why: 'calls something a record, but no fact says it is one' },
  { re: /\bcareer[- ](high|best)\b|\bpersonal best\b/i, unless: /career[- ]high|CAREER HIGH|MILESTONE: .*Career-high/i, why: 'calls something a career high, but no fact says it is one' },
  { re: /\bseason[- ](high|best)\b/i, unless: /season[- ]high|SEASON HIGH/i, why: 'calls something a season high, but no fact says it is one' },
  { re: /(?<!\b(?:flirted with|near|shy of|close to|short of|almost|nearly|missed|chasing|chase) (?:a|the) )\btriple[- ]double\b/i, unless: /triple[- ]double/i, why: 'mentions a triple-double that no fact gives' },
  // Standings tables print "1. Blue 5-1"; the road section says "Blue takes over first".
  { re: /\b(first|1st) place\b|\bsole possession\b|\btop of the (standings|table|league)\b|\bin first\b|\b(takes?|took) over first\b/i, unless: /first place|FIRST PLACE|first and second|over first|tied for first|1st\b|rank 1\b|#1\b|(^|[:;,]\s*|-\s)1\.\s/im, why: 'puts a team in first place, but no fact says so' },
  // The facts word streaks several ways: "3-game winning streak", "won its last 3 games",
  // "3 runs in a row".
  { re: /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)[- ]game (winning |losing |win |losing )?streak\b|\b(winning|losing) streak\b|\bstraight (wins|losses|games)\b|\bin a row\b|\bsunod[- ]sunod\b/i, unless: /streak|straight|in a row|(won|lost) (its|their|his|her) last \d+/i, why: 'mentions a streak that no fact gives' },
  // Leaderboard facts rank as "1. Name" (homepage leaders, /leaders boards) or "#1 scoring".
  { re: /\b(leads?|leading) the league\b|\bleague[- ]lead(ing|er)?\b|\bbest in the league\b|\btops the league\b/i, unless: /leads the league|league lead|1st in the league|league rank #1\b|rank(ed)?:? 1\b|#1\b|(^|[:;,]\s*|-\s)1\.\s/im, why: 'says someone leads the league, but no fact says so' },
  { re: /\bin (league|wknd|franchise) history\b|\bsa (league |wknd )?history\b|\bof all time\b|\ball[- ]time (high|best|great|record|list|mark|single[- ]game)\b|\bever recorded\b|\bthe most ever\b/i, unless: null, why: 'claims something "in league history" or "of all time" — records here are only "since Season 3"' },
  // "their lowest since the opening game", "their best of the season": season highs and lows
  // only exist where the facts give one.
  { re: /\b(lowest|highest|fewest|most|best|worst)( \w+){0,3} (since(?! season 3)|of the season|this season|all season|of the year)\b/i, unless: /season[- ](high|low|best|worst)|SEASON (HIGH|LOW)/i, why: 'calls something the lowest/highest of the season or since some game, but no fact says so' },
];
export function claimProblems(text, facts) {
  // Odd hyphens normalised first: "all‑time" with U+2011 slipped past "all[- ]time" once.
  const t = dashes(String(text).replace(/\*\*/g, ''));
  return CLAIMS.filter(c => c.re.test(t) && !(c.unless && c.unless.test(facts))).map(c => `it ${c.why} ("${t.match(c.re)[0]}")`);
}

// Story slips the fact check let through in a live recap (2026-10-20), checked in code:
// - a streak the facts say ENDED ("MAROON's 2-game winning streak ENDED with this loss")
//   described as still going ("Maroon, already on a two-game winning streak");
// - an "N-point run" where N isn't a run in the facts ("a 30-point run" was the margin; the
//   facts give runs as "scored 14 unanswered points").
// Sentences for the checks: a headline has no full stop, so a newline ends a sentence too
// (the headline merged with the first sentence once and tripped two checks at once).
export const splitSentences = text => String(text || '').split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
const NUM_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const numOf = w => (NUM_WORDS[String(w).toLowerCase()] ?? Number(w));

export function storyProblems(text, facts, { dated = false } = {}) {
  // Odd hyphens normalised ("3‑game" with U+2011 slipped past "[- ]game" once).
  const t = dashes(String(text || '').replace(/\*\*/g, ''));
  const F = String(facts || '');
  const out = [];
  const sentences = splitSentences(t);
  // An instruction echoed as copy ("kaya the spotlight stays mostly on Vin, no?").
  const meta = t.match(/\b(the|this|our|his|her) spotlight (stays|is|remains|goes)\b|\bkeep(s|ing)? the focus\b|\bthe focus (stays|is|remains)\b|\bthis (write-?up|piece|recap|article|spotlight)\b|\bin this (write-?up|piece|recap)\b|\b(the|this) (facts|brief|prompt|highlights? (list|block))\b|\bas (instructed|requested)\b/i);
  if (meta) out.push(`it talks about the write-up itself ("${meta[0]}") — write about the game, never about the piece or its focus`);
  // Read days later: "today", "tonight" and "yesterday" are wrong in a recap or spotlight.
  if (dated) {
    const d = t.match(/\b(today|tonight|yesterday|this (morning|afternoon|evening)|earlier today|last night)\b/i);
    if (d) out.push(`it says "${d[0]}" — the piece is read days later; never date it`);
  }
  for (const m of F.matchAll(/\b([A-Za-z][\w ]*?)'s (\d+)-game (winning|losing) streak ENDED/g)) {
    const team = m[1].trim().split(/\s+/).pop().toLowerCase();
    // The team has to be the subject: within 60 characters before the streak word ("Blue fell
    // to 1-4 with their second straight loss … to Black" is about Blue).
    const about = new RegExp(`\\b${team}\\b[^.!?\\n]{0,60}\\b(streak|straight|in a row)\\b`, 'i');
    const bad = sentences.find(s => about.test(s)
      // Headlines use the present tense ("Maroon Breaks White's Streak" was flagged once).
      && !/\b(end|ended|ends|ending|snap|snapped|snaps|snapping|broke|broken|break|breaks|breaking|over|stops?|stopp?ed|stopping|halt|halts|halted|no more|lost|done|finished|is history|gone|tapos na)\b/i.test(s));
    if (bad) out.push(`it describes ${m[1].trim()}'s ${m[2]}-game ${m[3]} streak as still going, but it ENDED in this game ("${bad.trim().slice(0, 90)}")`);
  }
  // A streak's length must be one the facts give ("3-game winning streak snapped" for a
  // 2-game one). The facts word them "2-game winning streak", "won 3 straight", "on a
  // 4-game losing streak".
  const streakNs = new Set([...F.matchAll(/\b(\d+)-game (?:winning|losing|win|loss) streak|\b(?:won|lost|win|loss)[^.\n]{0,20}?\b(\d+) (?:straight|in a row)|\b(\d+) (?:straight|consecutive) (?:wins|losses|games)|\bstreak (?:of|to) (\d+)/gi)].flatMap(m => m.slice(1).filter(Boolean)));
  for (const m of t.matchAll(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)[- ]game (?:winning|losing|win|loss)? ?streak\b|\b(\d+|two|three|four|five|six|seven|eight|nine|ten) (?:straight|consecutive) (?:wins|losses|games)\b|\b(?:won|lost|win|loss)[^.\n]{0,20}?\b(\d+|two|three|four|five|six|seven|eight|nine|ten) (?:straight|in a row)\b/gi)) {
    const n = String(numOf(m[1] || m[2] || m[3]));
    if (!streakNs.has(n)) out.push(`it gives a streak of ${n} games ("${m[0]}"), but the facts' streaks are ${streakNs.size ? [...streakNs].join(', ') : 'none'} games long`);
  }
  // Settled standings (server.js standingsLockLine): no race left to talk about.
  if (/FINAL REGULAR-SEASON STANDINGS|STANDINGS LOCKED/.test(F)) {
    const race = t.match(/\b(hopes?|still alive|still in (it|the hunt|the race)|in the hunt|could (still )?(climb|move up|catch|overtake|pass)|chance to (climb|move up|catch|finish)|(race|fight) (is|remains|stays) (open|alive|tight|on)|keep (the|their) (playoff |seeding )?hopes|jump into first|climb(ing)? to first|(can|could) still (take|grab|reach|finish))\b/i);
    if (race) out.push(`it talks about a race that is over ("${race[0]}") — the facts say the standings are settled; nobody can climb or catch up any more`);
  }
  // "a career high, matching his best": a NEW career high never matches anything. Only a
  // "TIED CAREER HIGH" in the facts can be described as matching. The match word has to sit
  // next to the career high ("6 threes matched a league record… that's a career high" is two
  // true things in one sentence).
  const near = /\bcareer[- ]?(high|best)[^.;\n]{0,25}\b(match|tie|tied|equal)|\b(match|tie|tied|equal)\w*[^.;\n]{0,25}\bcareer[- ]?(high|best)/i;
  const ch = t.match(near);
  if (ch && !/TIED CAREER HIGH/.test(F)) out.push(`it calls a career high a match of an earlier best, but the facts give a NEW career high ("${ch[0].slice(0, 90)}")`);
  const runs = new Set([...F.matchAll(/(\d+) unanswered points/g)].map(m => m[1]));
  for (const m of t.matchAll(/\b(\d+)[-\s‑](?:point|pt)[-\s‑](?:run|burst|spurt)\b|\b(\d+)-0 (?:run|burst|spurt)\b|\brun of (\d+)\b|\b(\d+) (?:unanswered|straight|consecutive) points\b/gi)) {
    const n = m[1] || m[2] || m[3] || m[4];
    if (!runs.has(n)) out.push(`it calls ${n} points a run, but the facts' runs are ${runs.size ? [...runs].map(r => `${r} unanswered`).join(', ') : 'not given'} — a margin or a total is not a run`);
  }
  // A lead at a checkpoint ("up 30 at the half", "led by 30 after the first quarter") must be
  // that checkpoint's margin in the facts (the quarter lines "Q1: A 9 – 25 B (B +16)" and
  // "HALFTIME: A 25–49 B").
  const marginAt = {};
  for (const m of F.matchAll(/^(Q[1-4]|OT\d?):[^\n]*\(\s*[A-Z]+ \+(\d+)\)/gm)) marginAt[m[1]] = Number(m[2]);
  const half = F.match(/HALFTIME: [A-Z]+ (\d+)\s*[–-]\s*(\d+) [A-Z]+/);
  if (half) marginAt.HALF = Math.abs(Number(half[1]) - Number(half[2]));
  if (!marginAt.HALF && marginAt.Q2 !== undefined) marginAt.HALF = marginAt.Q2;
  // A number inside a score ("up 25-9") isn't a lead figure: (?!-\d).
  const CP = /\b(half(?:time)?|first quarter|opening quarter|q1|third quarter|q3)\b/gi;
  const LEAD = /\b(?:led|lead|leading|up|ahead|cushion|margin|advantage|edge)(?: (?:of|by|was|at|to))? (\d+)\b(?!-\d)|\b(\d+)(?!-\d)[- ]points? (?:lead|cushion|margin|advantage|edge|ahead|up|clear|in front)\b/gi;
  const cpKey = w => (/half/i.test(w) ? 'HALF' : /first|opening|q1/i.test(w) ? 'Q1' : 'Q3');
  for (const s of sentences) {
    if (/\bas (many|much) as\b|\bat one point\b|\bbiggest\b|\bpeak/i.test(s)) continue;
    const cps = [...s.matchAll(CP)].map(m => ({ key: cpKey(m[1]), i: m.index }));
    for (const lead of s.matchAll(LEAD)) {
      // The checkpoint nearest the lead figure, within 45 characters.
      const cp = cps.map(c => ({ ...c, d: Math.abs(c.i - lead.index) })).filter(c => c.d <= 45).sort((x, y) => x.d - y.d)[0];
      if (!cp || marginAt[cp.key] === undefined) continue;
      const n = Number(lead[1] || lead[2]);
      if (n !== marginAt[cp.key]) out.push(`it says the lead was ${n} at ${cp.key === 'HALF' ? 'halftime' : cp.key}, but the facts' margin there is ${marginAt[cp.key]} ("${s.trim().slice(0, 90)}")`);
    }
  }
  return out;
}

// The one banned list: filler, hype and crowd talk every writer is told to avoid. Writers that
// allow a word (the Barbershop roast voice) pass `allow`.
export const BANNED_WORDS = /\b(clash\w*|showdown|impressive|stellar|remarkable|domina(nt|nce|te[sd]?|ting|tion)|showcase\w*|intrigu\w*|epic|electrifying|dazzling|jaw-dropping|heart-pounding|crowd|fans|spectators|key contributor|filled the stat sheet|put on a show|lights out|on fire|did not disappoint|stepped up|came to play|showed up big|nothing short of|hard-fought|gritty|statement win)\b/i;
// The same list, readable, for the prompts (so writers are told every word the check rejects).
export const BANNED_HINT = '"clash", "showdown", "impressive", "stellar", "remarkable", "dominant/dominated", "showcase", "intriguing", "epic", "electrifying", "dazzling", "jaw-dropping", "heart-pounding", "key contributor", "filled the stat sheet", "put on a show", "lights out", "on fire", "did not disappoint", "stepped up", "came to play", "showed up big", "nothing short of", "hard-fought", "gritty", "statement win", and any mention of the crowd, fans or spectators';
// Box-score shorthand copied into prose ("7reb and 1stl pa"): stats are words in copy.
export function shorthandProblems(text) {
  const m = String(text).replace(/\*\*/g, '').match(/\b\d+ ?(?:pts|reb|ast|stl|blk)\b/i);
  return m ? [`it copies box-score shorthand into the prose ("${m[0]}") — write the stat as a word (7 rebounds, 1 steal)`] : [];
}
// A zero stat in prose ("0 steals", "zero assists") is padding, not a story.
export function zeroStatProblems(text) {
  const m = String(text).match(/\b(?:0|zero|no) (?:points|rebounds|assists|steals|blocks|threes|turnovers)\b/i);
  return m ? [`it pads the piece with a zero stat ("${m[0]}") — leave out what didn't happen`] : [];
}
export function bannedProblems(text, { allow = null } = {}) {
  const m = String(text).match(BANNED_WORDS);
  return m && !(allow && allow.test(m[0])) ? [`it uses the banned phrase "${m[0]}"`] : [];
}

// Sentences as a reader counts them: a short aside of 3 words or fewer ("Grabe lang.",
// "Sayang talaga.") rides along with the sentence before it instead of using up a slot,
// so a sentence budget doesn't flatten a voice. countSentences / keepSentences(text, n).
function realSentences(text) {
  const parts = splitSentences(text);
  const out = [];
  for (const s of parts) {
    // An aside of up to 4 words ("Too late na though.") rides along.
    if (out.length && s.split(/\s+/).length <= 4) out[out.length - 1] += ` ${s}`;
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
  // Checks are fatal (facts, highlights, format) or { style } (voice, banned words). A
  // fatal problem is a reason to rewrite; a style one is too, but it never outranks the
  // facts: the costly fact check still runs on a draft whose only slips are style, and the
  // draft kept is the one with the fewest fatal problems (a live recap once kept the one with
  // the fewest problems overall — three invented facts and no voice complaint — over one that
  // was true but a bit flat).
  const fatalCount = problems => problems.filter(p => !p.startsWith('[style] ')).length;
  let best = null;
  const seen = new Set();
  for (let attempt = 1; attempt <= tries; attempt++) {
    // One rejection note, with everything seen so far (not a note per attempt stacking up).
    const p = seen.size ? prompt + rejectionNote([...seen]) : prompt;
    // A provider error (quota, outage) is thrown straight out, never retried here: the
    // callers' cooldowns handle it, and it must not be mistaken for a draft that failed checks.
    const draft = await generate(p);
    const copy = text(draft);
    if (!copy.trim()) continue;
    const problems = [];
    for (const check of checks) {
      const costly = typeof check === 'object' && check.costly;
      const style = typeof check === 'object' && check.style;
      if (costly && fatalCount(problems)) continue;
      const found = (await (costly || style ? check.fn : check)(copy, draft)) || [];
      // A style check can still flag something fatal with a "[fatal] " prefix (voiceProblems:
      // an example line copied word for word may state an event that never happened).
      problems.push(...(style ? found.map(f => f.startsWith('[fatal] ') ? f.slice(8) : `[style] ${f}`) : found));
    }
    writerLog({ label, attempt, prompt: attempt === 1 ? prompt : undefined, copy, problems });
    const better = !best || fatalCount(problems) < fatalCount(best.problems) || (fatalCount(problems) === fatalCount(best.problems) && problems.length < best.problems.length);
    if (better) best = { draft, problems, attempts: attempt };
    if (!problems.length) return best;
    console.warn(`${label} attempt ${attempt} rejected: ${problems.join(' | ')}`);
    for (const q of problems) seen.add(q.replace(/^\[style\] /, ''));
  }
  if (!best) throw new Error(`${label}: no draft came back`);
  // fatal: how many of the leftover problems are not style (callers may keep a style-only draft).
  best.fatal = fatalCount(best.problems);
  best.problems = best.problems.map(q => q.replace(/^\[style\] /, ''));
  writerLog({ label, final: true, attempts: best.attempts, copy: text(best.draft), problems: best.problems });
  return best;
}

// Opt-in trace for the eval harness (scripts/ai-eval): with AI_WRITER_LOG=<file> every attempt
// (the full prompt on the first one, the copy and every check's problems) and the final pick
// are appended as JSON lines. Off by default; never throws.
function writerLog(entry) {
  const file = process.env.AI_WRITER_LOG;
  if (!file) return;
  try { appendFileSync(file, JSON.stringify({ ts: Date.now(), ...entry }) + '\n'); } catch {}
}
