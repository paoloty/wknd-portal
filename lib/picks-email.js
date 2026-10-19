// ── "Who wins?" reminder email ───────────────────────────────────────────────
// The copy for the pick reminder email: one AI draft per game day (subject, a short intro,
// a 1–2 sentence preview per matchup), written from the same facts as the matchup
// storylines and held to the same guards (numbers must be in the facts, banned words,
// wrong-way comparisons, then the temperature-0 fact check the caller passes in). Falls
// back to plain template copy when AI isn't available or nothing passes. The per-player
// parts (name, which games they still owe, their record, the leaderboard, the prize line)
// are filled in by the template in lib/mailer.js, never by the AI.
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getSetting, setSetting, getRegistration } from './portal-db.js';
import { generateJson, aiAvailable } from './ai.js';
import { pickVoice, aiTemperature, voiceFlavor, voiceProblems, voiceTraits } from './ai-voices.js';
import { comparisonProblems } from './story-checks.js';
import { runWriter, numberProblems, claimProblems, bannedProblems, BANNED_HINT } from './writer.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');

// Shown in every reminder under the leaderboard. Deliberately vague — the prize is a
// surprise; the AI is told not to mention it at all so it can't invent details.
export const PICKS_PRIZE_LINE = 'The Pickmaster, the player with the most points when the season ends, takes home a mystery prize.';

// ── Unsubscribe links ────────────────────────────────────────────────────────
// Same signing secret as the Papawis links (site setting email_link_secret, created on
// first use), different message prefix so one link can't unsubscribe from the other list.
function linkSecret() {
  let secret = getSetting('email_link_secret', '');
  if (!secret) { secret = randomBytes(32).toString('hex'); setSetting('email_link_secret', secret); }
  return secret;
}
const unsubToken = regId => createHmac('sha256', linkSecret()).update(`picks-unsub:${regId}`).digest('hex').slice(0, 32);
export function picksUnsubscribeUrl(regId) {
  return `${LIVE_URL}/picks/emails/unsubscribe?r=${encodeURIComponent(regId)}&t=${unsubToken(regId)}`;
}
export function verifyPicksUnsubscribe(regId, token) {
  if (!regId || !token || !getRegistration(regId)) return false;
  const a = Buffer.from(String(token)), b = Buffer.from(unsubToken(regId));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Copy ─────────────────────────────────────────────────────────────────────
const tc = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const BANNED = /\b(clash|showdown|impressive|stellar|remarkable|dominant|dominates|showcase|intriguing|intrigues|epic|crowd|fans|spectators|prize|reward|win big)\b/i;

// games: [{ id, a, b, odds: {fav, pctA, pctB}|null, story: matchupStoryFacts() result }]
// Returns the facts text and a key that changes whenever any fact does (stale drafts are
// rewritten rather than sent).
export function picksEmailFacts({ games, dayLabel, closeLabel }) {
  const blocks = games.map((g, i) => {
    const odds = g.odds?.fav ? `\nOdds: ${tc(g.odds.fav === 'a' ? g.a : g.b)} ${g.odds.fav === 'a' ? g.odds.pctA : g.odds.pctB}% to win.` : '';
    // baseFacts: the storyline's facts without its MUST-MENTION instruction block.
    return `GAME ${i + 1} (id ${g.id}): ${tc(g.a)} vs ${tc(g.b)}\n${g.story.baseFacts ?? g.story.facts}${odds}`;
  });
  const facts = `"Who wins?" is the league's pick-em: players pick the winner of each game on the site. Picks close at ${closeLabel} on game day, ${dayLabel}.\n\n${blocks.join('\n\n')}`;
  const key = `v1|${games.map(g => `${g.story.key}:${g.odds?.pctA ?? '-'}`).join(',')}|${closeLabel}`;
  return { facts, key };
}

export function defaultPicksCopy({ games, dayLabel }) {
  const matchups = games.map(g => `${tc(g.a)} vs ${tc(g.b)}`).join(' and ');
  return {
    subject: `Who wins on ${dayLabel}? ${matchups}`,
    intro: `${games.length === 1 ? 'One game' : `${games.length} games`} on ${dayLabel}, and your picks are still open. Lock them in before the cut-off.`,
    blurbs: Object.fromEntries(games.map(g => [g.id, g.odds?.fav
      ? `The odds lean ${tc(g.odds.fav === 'a' ? g.a : g.b)}. Do you agree?`
      : 'No odds yet, so this one is all your call.'])),
    source: 'default',
  };
}

const clean = s => String(s || '')
  .replace(/\*\*/g, '')
  .replace(/[‐-–]/g, '-').replace(/\s*—\s*/g, ', ')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s+/g, ' ').trim();

/**
 * One AI draft for a game day. Always resolves: AI copy that passed every check, or the
 * default copy with `note` saying why.
 * @param factCheck async (f, headline, body) => string[] — server.js's factCheckHomeSummary
 */
export async function writePicksEmail({ games, dayLabel, closeLabel }, factCheck) {
  const fallback = note => ({ ...defaultPicksCopy({ games, dayLabel }), note });
  if (!aiAvailable()) return fallback('No AI key configured.');
  const f = picksEmailFacts({ games, dayLabel, closeLabel });
  const voice = pickVoice('home', { date: new Date().toISOString().slice(0, 10) });
  let prompt = `You write the reminder email for "Who wins?", WKND Basketball's weekly pick-em, sent to players who haven't made their picks yet.

THIS WEEK'S VOICE — ${voice.name}: ${voice.guide}${voiceFlavor(voice, f.key, 150) ? `\n${voiceFlavor(voice, f.key, 150)}` : ''}

FACTS (the only things you may state):
${f.facts}

HOW TO SAY IT: numbers, names and stat words come from the facts in English digits; everything around them is in the voice. The voice is in the sentence shape, not in added words.

Write JSON with:
- "subject": the email subject, at most 70 characters. Name the matchups or the day; make people want to open it. No emoji.
- "intro": 1–2 sentences, at most 45 words, plain text. Set up the game day and nudge them to pick before the cut-off.
- "games": one entry per game, in the order above, each { "id": the game id exactly as given, "line": 1–2 sentences, at most 40 words, plain text }. Each line gives the reader ONE real reason to think about that pick: the head to head, the single most telling stat, a top scorer, or the odds. Use at most two numbers per line and write it like a sentence a friend would say, not a list of stats.

Rules:
- Every number must be copied exactly as written in the facts. Never calculate a difference, total or percentage of your own.
- Before writing "more", "fewer", "higher", "lower", "out-rebounds", "outscores", "edge" or "advantage" about a team, check that team's number really is the bigger (or smaller) one. For stats marked "fewer is better", the lower number is the advantage.
- Don't predict a winner as certain, invent stats, history, injuries or lineups, or call anything a record or a first unless a highlight in the facts says so.
- Don't mention prizes, rewards or the leaderboard (the email shows those itself). Don't mention fans, the crowd or spectators; the people picking are "pickers" or "you".
- Banned (rejected in code): ${BANNED_HINT}. No markdown, no emoji, no em dashes.

FINAL REMINDER — write it in the ${voice.name} voice.${voice.sample ? ` Example of the voice (style only — do not copy its words or facts): "${voice.sample}"` : ''}`;
  const schema = {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      intro: { type: 'string' },
      games: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, line: { type: 'string' } }, required: ['id', 'line'] } },
    },
    required: ['subject', 'intro', 'games'],
  };
  // Write → check → rewrite (lib/writer.js), 4 tries: the shared number, claim, banned-word
  // and voice checks, this email's own banned words and wrong-way comparisons, then the AI
  // fact check once the free ones pass. Always resolves (the default copy on failure).
  let out;
  try {
    out = await runWriter({
      prompt, label: 'Picks email', tries: 4,
      generate: async p => {
        const { data } = await generateJson(p, schema, { temperature: Math.min(aiTemperature(), voiceTraits(voice).hot ? 0.85 : 0.7), maxTokens: 700 });
        return {
          subject: clean(data?.subject).slice(0, 90),
          intro: clean(data?.intro),
          blurbs: Object.fromEntries((Array.isArray(data?.games) ? data.games : []).map(x => [String(x.id), clean(x.line)])),
        };
      },
      text: d => [d.subject, d.intro, ...games.map(g => d.blurbs[g.id] || '')].join(' '),
      checks: [
        (t, d) => (!d.subject || !d.intro || d.intro.length > 400 || games.some(g => !d.blurbs[g.id] || d.blurbs[g.id].length > 320) ? ['every field is required (one line per game id, short)'] : []),
        t => numberProblems(t, f.facts, { pairs: false }),
        t => claimProblems(t, f.facts),
        t => bannedProblems(t),
        t => { const m = t.match(BANNED); return m ? [`it used the word "${m[0]}"`] : []; },
        (t, d) => games.flatMap(g => comparisonProblems(d.blurbs[g.id] || '', g.story)).map(p => `a comparison runs the wrong way: ${p}`),
        t => voiceProblems(t, voice),
        ...(factCheck ? [{ costly: true, fn: async (t, d) => (await factCheck({ ...f, section: 'pick reminder email' }, d.subject, `${d.intro} ${games.map(g => d.blurbs[g.id]).join(' ')}`)).map(p => `fact check: ${p}`) }] : []),
      ],
    });
  } catch (e) {
    return fallback(`AI failed: ${String(e?.message || e).slice(0, 200)}`);
  }
  if (out.problems.length) return fallback(`No AI draft passed the checks (last: ${out.problems.join('; ')}).`);
  return { subject: out.draft.subject, intro: out.draft.intro, blurbs: out.draft.blurbs, source: 'ai', key: f.key };
}
