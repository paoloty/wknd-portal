// ── Code-side checks for AI storylines ───────────────────────────────────────
// The number guard only proves each number exists in the facts; it can't see a comparison
// that runs the wrong way ("Black out-rebounds Blue with 50.0 versus 55.6"), and the
// temperature-0 fact check has missed exactly that. This reads each clause, finds the team
// it's about and the stat numbers it quotes, and checks the direction word against the real
// values. Pure function — no AI, no DB.

// Direction words. "more" style = the subject's raw number is bigger; "fewer" style = it's
// smaller; "better" style = it's better for that stat (bigger, or smaller when fewer is better,
// e.g. turnovers).
const MORE = /\b(out-?\w+|outscor\w*|outshoot\w*|outrebound\w*|more|higher|greater|tops?|leads?|leading)\b/gi;
const FEWER = /\b(fewer|lower|less)\b/gi;
const BETTER = /\b(edge|advantage|better|ahead|superior|wins? the)\b/gi;

// Sentence ends (a "." followed by a space — never a decimal point), then clause breaks inside
// a sentence: commas and the joins a writer uses to switch subject mid-sentence. A clause with
// no team of its own ("…the advantage in turnovers, 21.6 to 15.2") carries the previous
// clause's team and direction word.
const SENTENCE_SPLIT = /\.(?=\s|$)|[;!?]/;
// Captures the separator so a contrast join ("but", "while"…) can stop a direction word from
// carrying over — only a plain comma continues the same comparison.
const CLAUSE_SPLIT = /(\s(?:while|whereas|but|offset by|though)\s|,)/i;
const CONTRAST = /^\s(?:while|whereas|but|offset by|though)\s$/i;

// A team named right after one of these is the other side of the comparison, not its subject.
const OBJECT_BEFORE = /\b(?:against|versus|vs\.?|to|than|over|compared (?:with|to)|for)\s+(?:the\s+)?$/i;

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} text  headline + body
 * @param {{ teams: [string, string], rows: { label: string, a: number, b: number, hi: boolean }[] }} f
 *   teams = [team A, team B] as written in the copy (e.g. 'Black'); rows = per-game stats
 *   with A's and B's values; hi = bigger is better.
 * @returns {string[]} problems, empty when every checkable comparison holds
 */
export function comparisonProblems(text, f) {
  const [ta, tb] = f.teams;
  // "Black", "Black's", "the Blacks" all count as a mention.
  const teamRe = new RegExp(`\\b(${escapeRe(ta)}|${escapeRe(tb)})(?:s|'s|’s)?\\b`, 'gi');
  // number (as the facts print it, 1 decimal) → the stat rows and side it belongs to.
  const byNum = new Map();
  for (const r of f.rows) {
    for (const [side, v] of [['a', r.a], ['b', r.b]]) {
      const k = Number(v).toFixed(1);
      if (!byNum.has(k)) byNum.set(k, []);
      byNum.get(k).push({ r, side });
    }
  }
  const problems = [];
  const clauses = [];
  for (const sentence of String(text).split(SENTENCE_SPLIT)) {
    let carry = null;
    const parts = sentence.split(CLAUSE_SPLIT); // [clause, separator, clause, separator, …]
    for (let i = 0; i < parts.length; i += 2) {
      const clause = parts[i];
      if (i > 0 && CONTRAST.test(parts[i - 1]) && carry) carry = { ...carry, words: [] };
      // The subject is the first team named that isn't the far side of a comparison: in
      // "Their free-throw edge sits at 50.0% against Black's 39.1", Black follows "against",
      // so the clause is about the other team.
      let subj = null, objectOnly = null;
      for (const mm of clause.matchAll(teamRe)) {
        const side = mm[1].toLowerCase() === ta.toLowerCase() ? 'a' : 'b';
        if (OBJECT_BEFORE.test(clause.slice(0, mm.index))) { objectOnly ??= side; continue; }
        subj = side; break;
      }
      if (!subj && objectOnly) subj = objectOnly === 'a' ? 'b' : 'a';
      // Direction words in this clause, with positions.
      const own = [];
      for (const [re, kind] of [[MORE, 'more'], [FEWER, 'fewer'], [BETTER, 'better']]) {
        for (const mm of clause.matchAll(re)) own.push({ kind, at: mm.index, word: mm[0] });
      }
      subj ??= carry?.subj ?? null;
      // A clause with no direction word of its own continues the sentence's last one
      // ("knocked down more threes, averaging 5.0 made compared with Black's 3.7");
      // inherited words sit "before" everything in the clause.
      const words = own.length ? own : (carry ? carry.words.map(w => ({ ...w, at: -1 })) : []);
      if (subj) carry = { subj, words };
      clauses.push({ clause, subj, words });
    }
  }
  for (const { clause, subj, words } of clauses) {
    if (!subj || !words.length) continue;
    // Each stat row quoted here (only numbers that belong to exactly one row — an ambiguous
    // number can't be pinned to a stat, so it's skipped rather than guessed).
    const seen = new Set();
    for (const nm of clause.matchAll(/\d+(?:\.\d+)?/g)) {
      const hits = byNum.get(Number(nm[0]).toFixed(1));
      if (!hits || new Set(hits.map(h => h.r)).size !== 1) continue;
      const r = hits[0].r;
      if (seen.has(r)) continue;
      seen.add(r);
      // The direction word that governs this number: the closest one before it, else after.
      const before = words.filter(w => w.at < nm.index).sort((x, y) => y.at - x.at)[0];
      const w = before || words.sort((x, y) => x.at - y.at)[0];
      const mine = subj === 'a' ? r.a : r.b, theirs = subj === 'a' ? r.b : r.a;
      if (mine === theirs) continue;
      const ok = w.kind === 'more' ? mine > theirs
        : w.kind === 'fewer' ? mine < theirs
        : (r.hi ? mine > theirs : mine < theirs);
      if (!ok) {
        const name = subj === 'a' ? ta : tb, other = subj === 'a' ? tb : ta;
        problems.push(`"${w.word}" is wrong for ${r.label}: ${name} averages ${Number(mine).toFixed(1)} to ${other}'s ${Number(theirs).toFixed(1)}${r.hi ? '' : ' (fewer is better)'}`);
      }
    }
  }
  return problems;
}

// A player's number passed off as a team's edge — the Oct 11 White–Maroon headline said
// "White holds a 20.8 point edge", but 20.8 was Lance Torres' points per game against Maroon.
// Flags a clause that quotes a player's number next to an edge/lead/margin word without
// naming the player.
const TEAM_EDGE = /\b(edge|advantage|lead|leads|margin|gap|ahead|cushion|holds?)\b/i;
/**
 * @param {string} text  headline + body
 * @param {{ name: string, ppg: number }[]} scorers  name as "Firstname LASTNAME"
 * @returns {string[]} problems
 */
export function playerNumberProblems(text, scorers = []) {
  const problems = [];
  for (const sentence of String(text).split(SENTENCE_SPLIT)) {
    for (const clause of sentence.split(CLAUSE_SPLIT)) {
      if (!TEAM_EDGE.test(clause)) continue;
      for (const s of scorers) {
        const v = Number(s.ppg).toFixed(1);
        if (!new RegExp(`(^|[^\\d.])${escapeRe(v)}(?![\\d])`).test(clause)) continue;
        const parts = String(s.name || '').split(/\s+/).filter(p => p.length > 2);
        if (parts.some(p => new RegExp(`\\b${escapeRe(p)}\\b`, 'i').test(clause))) continue;
        problems.push(`${v} is ${s.name}'s points per game in this matchup, not a team's edge or lead`);
      }
    }
  }
  return problems;
}
