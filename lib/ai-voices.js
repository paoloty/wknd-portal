// Writing voices for the AI writers (game recaps, POTG spotlights, MVP race writeups,
// award articles), configurable from /admin/ai-writing. Everything lives in site_settings
// so an admin can edit voices, pin one, or change creativity without a deploy.
import { createHash } from 'crypto';
import { getSetting, setSetting } from './portal-db.js';
import { splitSentences } from './writer.js';

export const DEFAULT_VOICES = [
  { id: 'columnist', enabled: true, name: 'Sports columnist', guide: 'Write like an opinionated newspaper sports columnist. Have a clear take on what this game meant and argue it. Punchy sentences, a strong lede, a closing line with some bite.', sample: 'Forget the scoreboard for a second — this game was decided the moment White stopped settling for jumpers.' },
  { id: 'stat-nerd', enabled: true, name: 'Stat nerd', guide: 'Write like a stats-obsessed analyst who loves the one number that explains a game. Build the story around the runs, margins, and efficiency that decided it — but keep it readable, not a spreadsheet.', sample: 'Fifteen lead changes, thirteen ties, and exactly one stretch that mattered: a 12-0 burst in the third.' },
  { id: 'barbershop', enabled: true, name: 'Barbershop banter', guide: 'Write like friends breaking down the game afterwards — casual, playful, a little teasing. Light ribbing is fine; never mean, never mocking anyone personally.', sample: 'Somebody check on Maroon\'s first quarter, because it never showed up — eight points, total.' },
  // Rewritten 2026-10-20 after an audit: the old guide asked for a kid who "cannot really
  // speak Tagalog" and "8 or more" touches, so every piece bolted the same 7 words
  // ("literally", "diba", "super", "kasi", "nakakaloka", "made agaw/bawi") onto English.
  // Real conyo is fluent code-switching: English frame, Tagalog in the hinges.
  // Rewritten again 2026-10-20 (eval): the previous guide's examples still carried events
  // ("he made bawi after a slow start", "tulog the whole first half") that drafts copied as
  // facts, it demanded 3+ different hinges in a 2-sentence piece (stuffing), and its "at most
  // one hinge per sentence" fought the density target. Now: no events in the examples, one
  // rhythm rule, placeholders in the sample.
  // Rewritten 2026-10-20 (Paolo): hinges alone read as English with seasoning. Real conyo
  // (kami.com.ph reference) keeps English grammar and puts Tagalog in the content slots:
  // "so" + Tagalog adjective, "make" + Tagalog verb. `examples` are Paolo's approved lines,
  // editable at /admin/ai-writing; voiceFlavor() hands a few to each piece.
  { id: 'conyo', enabled: true, name: 'Conyo hoops writer', guide: "You are a Makati/BGC kid who grew up on Taglish and loves this league, telling a friend what happened. English is the frame of every sentence; Tagalog words take the important slots. The patterns: \"so\" + a Tagalog adjective (so dikit, so bitin, so sablay, so sarap, so nakakainis); \"make/made\" + a Tagalog verb, always active (they made bawi, tried to make habol; never \"was made\", never on a stat, never on an English verb); Tagalog verbs and nouns dropped into English like English words (couldn't even habol na, the lead was too big na); tags and particles (na, naman, pa, lang, talaga, no?, eh); connectors (pero, tapos, kaso, kaya); \"si\" + a person's first name as the subject once or twice a piece (never a team, never a possessive like \"si Vin's\"); emphasis like \"like,\" \"I can't even\" \"Not gonna lie\" or a short aside (Sayang talaga. Grabe lang.). Hoops words only when the facts say that happened: dikit, tambak, bawi, habol, sablay, lutang, tulog, lamang, gigil, bitin, walang palag, pasabog. Rhythm: one or two Tagalog words in most sentences, spread through every paragraph; a few sentences stay fully English. Don'ts: no all-Tagalog sentences or Tagalog grammar runs (ang/ng/sa/mga chains); no off-topic or dated slang (bes, jowa, mumshie, petmalu, lodi, werpa, charot); never say \"conyo\"; no jokes about class, looks, money or background. Names, scores, stat words and every number stay in English digits exactly as the facts give them. The example lines show the sound only, never facts about this game. Friendly, a little dramatic, never mean.", sample: "The fourth quarter was so dikit, like, every possession felt like the whole season na.", examples: ["Okay, [team] made bawi talaga tonight. After last week's tambak, they came out so gigil.", "The fourth quarter was so dikit, like, every possession felt like the whole season na.", "[team] tried to make habol in the last two minutes, pero wala na, the lead was too big.", "[number] threes? I can't even. Si [first name] was so mainit, the rim was basically his na.", "[team]'s offense was so sablay in the first half, pero they made ayos naman after the break.", "Not gonna lie, [team]'s defense was so nakakainis to play against, in a good way.", "[team] locks No. 1, and [team]'s season ends so bitin."] },
];

// Earlier default conyo guides (sha1 of the text). A stored copy equal to one of them (never
// edited at /admin/ai-writing) is upgraded to the current default on startup; an edited one
// is left alone. Add the old hash here whenever the default guide changes.
//   dafa5626… — the original (≤ 2026-10-19): "cannot really speak Tagalog", "8 or more"
//   dccd2014… — 1e4808e (2026-10-20): its examples carried facts ("made bawi after the 0-for-5
//               start", "made tambak Maroon") that a recap copied as if they happened
//   b39c8b8e… — 61264fd (2026-10-20, until the eval): "he made bawi after a slow start" and
//               "tulog the whole first half" examples copied as facts; 3+ hinges forced into
//               2-sentence pieces
//   ff03ca5b… — an in-between version stored on the live site, never hashed
//   fb636514… — 3075fa9 (2026-10-20): Tagalog in the hinges only, read as thin
const PREVIOUS_CONYO_GUIDES = new Set(['dafa5626704f0dc5396b1bf76a7bb604bdad1fe8', 'dccd201424e6bb8cdcad2ff299f7a1041c430df8', 'b39c8b8e592426314a3e507f8d4ad41611fc92fb', 'ff03ca5b58697bbfb0e04952141b0e83bf3c94c7', 'fb636514f028396b4258cd715ed9c3c13e50b1c4']);

// ── What a voice brings beyond its guide (code, not the admin page; keyed by voice id) ──
// bank:  phrase groups; voiceFlavor() hands the writer one from each, varied per piece, so
//        drafts stop reusing the same five words
// check: 'taglish' → voiceProblems() checks the draft is really in the voice
// hot:   the voice needs some heat: short summary blocks capped at 0.6 get 0.85 instead
const VOICE_TRAITS = {
  conyo: {
    hot: true,
    check: 'taglish',
    // No event words here (2026-10-20 eval): a "made bawi" / "Too late na." handed to the
    // writer became "made bawi after a slow start" in a game with no slow start. Hinges,
    // openers, asides and tags only — the guide lists the hoops words.
    bank: {
      openers: ['Grabe si [first name]', 'Okay, real talk', 'Hala', 'Anyare, [losing team]?', 'Uy', 'Not gonna lie', 'Sabi ko na nga ba'],
      patterns: ['so + a Tagalog adjective', 'made + a Tagalog verb', 'a Tagalog verb used like an English one'],
      emphasis: ['like,', "I can't even", 'sobrang', 'ang lupit', 'talaga'],
      hinges: ['naman', 'pala', 'kaya', 'kaso', 'tapos', 'pero'],
      tags: ['na', 'pa', 'lang', 'no?', 'eh'],
    },
  },
};
export const voiceTraits = voice => VOICE_TRAITS[voice?.id] || {};

// One line of flavour for this piece: one phrase from each bank group, picked by a hash of
// `seed` (a game, player or block id) so regenerations of different pieces differ. '' for a
// voice without a bank.
// words: the piece's rough length, so the line also says how much voice it needs (voiceTarget).
// Also 2-3 of the voice's example lines (more for longer pieces), varied by the same hash: how
// it should sound, never facts. A voice with examples but no bank gets just those.
export function voiceFlavor(voice, seed = '', words = 0) {
  const bank = voiceTraits(voice).bank;
  const examples = voiceExamples(voice);
  if (!bank && !examples.length) return '';
  let h = 2166136261;
  for (const ch of `${voice.id}|${seed}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (list, i) => list[(h >>> (i * 3)) % list.length];
  const out = [];
  if (examples.length) {
    const n = Math.min(examples.length, words > 120 ? 3 : 2);
    const start = h % examples.length;
    const lines = Array.from({ length: n }, (_, i) => examples[(start + i) % examples.length]);
    out.push(`How this voice sounds (example lines with placeholders: copy the sound, never the words or the events): ${lines.map(l => `"${l}"`).join(' / ')}`);
  }
  if (bank) out.push(`Flavour for this piece (optional: 2-3 of these where they fit what the facts say, never all, each once): ${Object.values(bank).map((list, i) => `"${pick(list, i)}"`).join(', ')}.`);
  const target = words ? voiceTarget(voice, words) : '';
  return [...out, target].filter(Boolean).join('\n');
}

// A voice's example lines: the stored ones, else the default voice's with the same id.
export function voiceExamples(voice) {
  if (Array.isArray(voice?.examples)) return voice.examples.filter(Boolean);
  return DEFAULT_VOICES.find(v => v.id === voice?.id)?.examples || [];
}

// A draft that copies 5+ words in a row from an example line (placeholders break the run)
// took the example as content. Returns the copied words, or ''.
function copiedExample(text, voice) {
  const norm = s => String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\[\] ]+/g, ' ');
  const t = ` ${norm(text).replace(/\s+/g, ' ')} `;
  for (const ex of voiceExamples(voice)) {
    for (const run of norm(ex).split(/\[[^\]]*\]/)) {
      const w = run.split(/\s+/).filter(Boolean);
      for (let i = 0; i + 5 <= w.length; i++) {
        const gram = w.slice(i, i + 5).join(' ');
        if (t.includes(` ${gram} `)) return gram;
      }
    }
  }
  return '';
}

// The cheap code check that a draft is really in the voice (runWriter check, no AI call).
// conyo: a few different Tagalog hinges (more for longer pieces), none used 3+ times, the
// fillers at most once, not mostly Tagalog, and none of the old misuses ("made agaw 2.4
// steals", "made secure", a floating ", pa,", "diba." as a full stop). Returns problem lines.
// How much voice a piece of `words` words needs: { uses, distinct }.
function voiceTargets(words) {
  // 2026-10-20 (Paolo's approved lines run ~2 Tagalog words per 15): about one per 25 words,
  // one *different* one per 50 (cap 8). A 2-sentence block needs 2, a 350-word recap ~14.
  const base = words > 120 ? 4 : words > 60 ? 3 : words > 25 ? 2 : 1;
  return { uses: Math.max(1, Math.ceil(words / 25)), distinct: Math.max(base, Math.min(8, Math.ceil(words / 50))) };
}
// The density target said up front in a prompt, for a piece of about `words` words ('' for a
// voice without the Taglish check).
export function voiceTarget(voice, words) {
  if (voiceTraits(voice).check !== 'taglish') return '';
  const t = voiceTargets(words);
  return `VOICE DENSITY: about ${t.uses} Tagalog words across the piece (${t.distinct}+ different ones), one or two in most sentences, spread through every paragraph, not saved for a closing line. Use the patterns: so + Tagalog adjective, made + Tagalog verb, Tagalog verbs used like English ones. English stays the frame.`;
}
const TAGLISH = /\b(naman|nga|pala|kasi|daw|raw|lang|pero|tapos|kaso|kahit|kaya|parang|sobrang|sayang|grabe|hala|wala|tulog|lutang|dikit|tambak|lamang|habol|bawi|sablay|todo|pasabog|nakakaloka|talaga|di ba|diba|ang (?:lupit|galing|hirap|sakit)|nag-\w+|nagising|walang palag|na|pa|eh|sarap|masarap|bitin|gigil|nakakainis|nakakatawa|ayos|pasok|lakas|galing|panalo|talo|isip|sana|gulo)\b/gi;
const TAGS = new Set(['na', 'pa', 'lang', 'eh']);
const FILLERS = /\b(literally|super|i mean|diba|di ba|nakakaloka)\b|\blike,/gi;
export function voiceProblems(text, voice) {
  if (voiceTraits(voice).check !== 'taglish') return [];
  const t = String(text || '').replace(/\*\*/g, '');
  const words = t.split(/\s+/).filter(Boolean).length;
  const found = (t.match(TAGLISH) || []).map(m => m.toLowerCase().replace(/^'?di ba$/, 'diba'));
  // "si Vin": the name marker (case-sensitive: si + a capital).
  const si = (t.match(/\b[Ss]i [A-Z][a-z]/g) || []).length;
  const distinct = new Set(found).size + (si ? 1 : 0);
  // Density scales with length (2026-10-20: a 330-word recap passed with 3 Tagalog words and
  // read as straight English): about one hinge per 35 words, about one *different* hinge per
  // 60 words (cap 8), and every paragraph of 25+ words carries at least one.
  const target = voiceTargets(words);
  const uses = found.length + si;
  const need = target.distinct;
  const out = [];
  if (distinct < need || uses < target.uses - 1) out.push(`it reads as plain English: ${uses} Tagalog word${uses === 1 ? '' : 's'} (${distinct} different) in ${words} words — aim for about ${target.uses} (${need}+ different): so + a Tagalog adjective (so dikit, so bitin), made + a Tagalog verb (made bawi), tags like na/pa/lang, pero/tapos, si [name], spread through every paragraph`);
  const paras = t.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.split(/\s+/).length >= 25);
  const flat = paras.filter(p => !(p.match(TAGLISH) || []).length && !/\b[Ss]i [A-Z][a-z]/.test(p));
  if (paras.length >= 2 && flat.length) out.push(`${flat.length} paragraph${flat.length === 1 ? ' is' : 's are'} plain English ("${flat[0].slice(0, 60)}…") — every paragraph needs a Tagalog hinge, not just the closer`);
  // Stock words alone are the "English with stickers" pattern the old guide produced: each
  // used once still reads as stickers. A piece needs real hinges beyond them.
  const STOCK = new Set(['grabe', 'nakakaloka', 'diba', 'talaga', 'kasi']);
  const real = new Set(found.filter(w => !STOCK.has(w))).size + (si ? 1 : 0);
  const needReal = Math.max(words > 60 ? 2 : words > 25 ? 1 : 0, need - 2);
  if (distinct >= need && real < needReal) out.push(`it only uses the stock words (${[...new Set(found.filter(w => STOCK.has(w)))].join(', ') || 'none'}) bolted onto English: put the Tagalog in the hinges instead (naman, pala, tapos, pero, si [name], sayang, nag- verbs, hoops words like tulog or tambak)`);
  const counts = {};
  for (const w of found) counts[w] = (counts[w] || 0) + 1;
  // End tags (na, pa, lang, eh) recur in real Taglish: one per 30 words, at least 3. The rest twice.
  const cap = w => TAGS.has(w) ? Math.max(3, Math.ceil(words / 30)) : 2;
  const over = Object.entries(counts).filter(([w, n]) => n > cap(w)).map(([w, n]) => `"${w}" ${n} times`);
  if (over.length) out.push(`it repeats ${over.join(', ')} — vary it`);
  const fill = {};
  for (const m of t.match(FILLERS) || []) { const k = m.toLowerCase().replace(/^di ba$/, 'diba'); fill[k] = (fill[k] || 0) + 1; }
  const fillOver = Object.entries(fill).filter(([, n]) => n > 2).map(([w, n]) => `"${w}" ${n} times`);
  if (fillOver.length) out.push(`it leans on fillers (${fillOver.join(', ')}) — twice each at most`);
  // A third: short pieces run dense (the sample is ~28%); a mostly-Tagalog one is far above.
  if (words >= 20 && found.length / words > 0.33) out.push('it is mostly Tagalog: keep English as the frame, Tagalog only in the hinges');
  // Tagalog grammar words ("Sa laro, Black nahulog nang 8 points sa Q3") mean whole sentences
  // are Tagalog — the hinge list never sees them. More than one in twelve words is too many.
  const grammar = (t.match(/\b(ang|ng|sa|mga|ay|ni|nina|kay|kung|ito|iyan|siya|sila|nila|niya|nang|para|dahil|mula|noong|habang|laban|ngayon|dati|rin|din|ba)\b/gi) || []).length;
  if (words >= 20 && grammar / words > 1 / 12) out.push(`it writes whole sentences in Tagalog (${grammar} Tagalog grammar words in ${words}) — English carries every sentence; Tagalog only in the hinges`);
  if (/\bma(?:de|ke)s? (?:agaw|bawi|takbo|habol)\s+\d/i.test(t) || /\bma(?:de|ke)s? (?:agaw|takbo) (?:the|a|an|his|her|their) (?:ball|rebound|boards?|steals?|shots?)\b.*\d/i.test(t)) out.push('it puts "made + Tagalog word" on a stat ("made agaw 2 steals"): use it only for an action with an object, like "made tambak the other team"');
  if (/\bma(?:de|ke)s? (?:secure|slip|comeback|score|shoot|win)\b/i.test(t)) out.push('it puts "made" on an English verb ("made secure"): use "nag-" for English verbs (nag-secure) or plain English');
  if (/,\s*pa,/i.test(t)) out.push('it uses a floating ", pa," — put "pa" at the end of a clause ("and 12 boards pa")');
  if (/\bdiba\.\s/i.test(t)) out.push('it ends a statement with "diba." — "di ba" is a question tag');
  // Seen in a live recap (2026-10-20): "were made sayang the lead", "Si Vin's 36 points" four
  // times, and the guide's own examples pasted in as if they had happened.
  if (/\b(?:was|were|got|been|being|is|are) made (?:sayang|tambak|bawi|habol|agaw|takbo)\b/i.test(t)) out.push('it uses "made + Tagalog word" in the passive ("were made sayang"): it only works active, with an object ("they made tambak the other team")');
  if (/\b[Ss]i [A-Z][\w-]*['’]s\b/.test(t)) out.push('it uses "si" as a possessive ("Si Vin\'s 36 points"): "si" goes before a name as the subject ("Grabe si Vin"), never with \'s');
  if (si >= 3) out.push(`it uses "si [name]" ${si} times — once or twice a piece`);
  // "si" marks a person: "Si Blue opened the contest" is wrong.
  const siTeam = t.match(/\b[Ss]i (?:Blue|Maroon|White|Black|the|a|an)\b/);
  if (siTeam) out.push(`it puts "si" before a team or an article ("${siTeam[0]}") — "si" goes before a person's first name only`);
  // Crammed: 3+ hinges in a short sentence ("tapos ang lupit kasi he had…"), or 4+ in any,
  // reads as stuffing, not conyo. A long sentence carrying three ("Sayang for Maroon, …, pero
  // …, so walang palag") is fine. Sentences end at a newline too (the headline has no stop).
  const crammed = splitSentences(t).find(s => {
    // End tags don't count: "so sablay at -39, kaya talo na" is one clause doing its job.
    const n = (s.match(TAGLISH) || []).filter(m => !TAGS.has(m.toLowerCase())).length + (s.match(/\b[Ss]i [A-Z][a-z]/g) || []).length, w = s.split(/\s+/).length;
    return w > 4 && ((n >= 4 && w <= 18) || n >= 5);
  });
  if (crammed) out.push(`it crams ${(crammed.match(TAGLISH) || []).length}+ Tagalog hinges into one sentence ("${crammed.trim().slice(0, 70)}…") — about one per sentence, spread them out`);
  const copied = copiedExample(t, voice);
  if (copied) out.push(`[fatal] it copies an example line ("${copied}…") — the examples show the sound only; say it in new words about these facts`);
  if (/\b(?:after|from) (?:the|a) 0-for-5 start\b|\b15-2 run\b|\bmade bawi after a slow start\b|\btulog the whole first half\b|\bhad this one going the other way\b|\bnumbers pa will tell you\b/i.test(t)) out.push('it copies an example from the voice guide as if it happened — the examples are patterns only, use the facts');
  const stale = staleAsides(t);
  if (stale.length) out.push(`it reuses ${stale.map(a => `"${a}"`).join(', ')}, which the last few pieces already said — find a different way to say it`);
  return out;
}

// Stock asides repeat across pieces (2026-10-20 Haiku eval: "Sayang talaga" closed almost every
// piece). The last 8 different texts checked are remembered in memory; an aside already in 2 of
// them is flagged. Drafts count too, so a retry that keeps the same aside is nudged off it.
const STOCK_ASIDES = ['sayang talaga', 'grabe lang', 'walang palag', 'ang lupit', "i can't even", 'not gonna lie', 'real talk', 'hands down', 'sabi ko na nga ba'];
const recentAsides = [];
function staleAsides(text) {
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const used = STOCK_ASIDES.filter(a => lower.includes(a));
  const stale = used.filter(a => recentAsides.filter(r => r.used.includes(a)).length >= 2);
  if (!recentAsides.some(r => r.text === lower)) {
    recentAsides.push({ text: lower, used });
    if (recentAsides.length > 8) recentAsides.shift();
  }
  return stale;
}

// Stored voices written before 2026-10-20 still carry the old conyo guide; swap it for the
// new default unless an admin changed it. Runs once at startup.
function upgradeStoredVoices() {
  try {
    const stored = JSON.parse(getSetting('ai_voices', '') || 'null');
    if (!Array.isArray(stored)) return;
    const fresh = DEFAULT_VOICES.find(v => v.id === 'conyo');
    let changed = false;
    for (const v of stored) {
      if (v.id === 'conyo' && v.guide !== fresh.guide && PREVIOUS_CONYO_GUIDES.has(createHash('sha1').update(String(v.guide)).digest('hex'))) { v.guide = fresh.guide; v.sample = fresh.sample; changed = true; }
      // Example lines arrived 2026-10-20: a stored voice from before gets its default's.
      const def = DEFAULT_VOICES.find(d => d.id === v.id);
      if (!Array.isArray(v.examples) && def?.examples) { v.examples = def.examples; changed = true; }
    }
    if (changed) setSetting('ai_voices', JSON.stringify(stored));
  } catch {}
}
upgradeStoredVoices();

export const AI_WRITING_FEATURES = [
  { key: 'recap', label: 'Game recaps' },
  { key: 'potg',  label: 'Player of the Game' },
  { key: 'mvp',   label: 'MVP & Best Defender race writeups' },
  { key: 'award', label: 'Award articles' },
  { key: 'home',  label: 'Homepage summaries' },
  // Unset = Barbershop banter (server.js roastVoice), not the rotation: it ribs real players.
  { key: 'roast', label: 'The Roast writeups (default: Barbershop banter)' },
];

// Temperature per creativity level. "Wild" trades accuracy for variety — more invented
// details slip through, so admins should read before saving.
export const CREATIVITY_LEVELS = [
  { key: 'steady',   label: 'Steady',   temperature: 0.7,  hint: 'Predictable, fewest factual slips.' },
  { key: 'balanced', label: 'Balanced', temperature: 0.9,  hint: 'Default. Lively, occasional slips.' },
  { key: 'wild',     label: 'Wild',     temperature: 1.05, hint: 'Most varied, more likely to invent details.' },
];

export const VOICE_LIMITS = { maxVoices: 12, name: 40, guide: 2000, sample: 400, examples: 30, example: 200 };

export function getVoices() {
  try {
    const stored = JSON.parse(getSetting('ai_voices', '') || 'null');
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {}
  return DEFAULT_VOICES;
}

export function getVoiceConfig() {
  const voices = getVoices();
  const level = getSetting('ai_creativity', 'balanced');
  return {
    voices,
    mode: getSetting('ai_voice_mode', 'rotate') === 'fixed' ? 'fixed' : 'rotate',
    fixedVoice: getSetting('ai_voice_fixed', '') || '',
    overrides: Object.fromEntries(AI_WRITING_FEATURES.map(f => [f.key, getSetting(`ai_voice_override_${f.key}`, '') || ''])),
    creativity: CREATIVITY_LEVELS.some(l => l.key === level) ? level : 'balanced',
  };
}

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);

// Validates and stores a config posted from the admin page. Returns an error string, or null.
export function saveVoiceConfig(body) {
  const raw = Array.isArray(body?.voices) ? body.voices : [];
  if (!raw.length) return 'Keep at least one voice.';
  if (raw.length > VOICE_LIMITS.maxVoices) return `At most ${VOICE_LIMITS.maxVoices} voices.`;
  const seen = new Set();
  const voices = [];
  for (const v of raw) {
    const name   = String(v?.name || '').trim().slice(0, VOICE_LIMITS.name);
    const guide  = String(v?.guide || '').trim().slice(0, VOICE_LIMITS.guide);
    const sample = String(v?.sample || '').trim().slice(0, VOICE_LIMITS.sample);
    if (!name || !guide) return 'Every voice needs a name and instructions.';
    let id = slug(v?.id) || slug(name) || 'voice';
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    // One line per example (the admin box), or an array.
    const examples = (Array.isArray(v?.examples) ? v.examples : String(v?.examples || '').split(/\r?\n/))
      .map(l => String(l).trim().slice(0, VOICE_LIMITS.example)).filter(Boolean).slice(0, VOICE_LIMITS.examples);
    voices.push({ id, enabled: v?.enabled !== false, name, guide, sample, examples });
  }
  const mode = body?.mode === 'fixed' ? 'fixed' : 'rotate';
  const fixedVoice = String(body?.fixedVoice || '');
  if (mode === 'fixed' && !voices.some(v => v.id === fixedVoice)) return 'Pick which voice to always use.';
  if (mode === 'rotate' && !voices.some(v => v.enabled)) return 'Turn on at least one voice for the rotation.';
  const creativity = CREATIVITY_LEVELS.some(l => l.key === body?.creativity) ? body.creativity : 'balanced';

  setSetting('ai_voices', JSON.stringify(voices));
  setSetting('ai_voice_mode', mode);
  setSetting('ai_voice_fixed', mode === 'fixed' ? fixedVoice : '');
  setSetting('ai_creativity', creativity);
  for (const f of AI_WRITING_FEATURES) {
    const o = String(body?.overrides?.[f.key] || '');
    setSetting(`ai_voice_override_${f.key}`, voices.some(v => v.id === o) ? o : '');
  }
  return null;
}

export function resetVoiceConfig() {
  setSetting('ai_voices', '');
  setSetting('ai_voice_mode', 'rotate');
  setSetting('ai_voice_fixed', '');
  setSetting('ai_creativity', 'balanced');
  for (const f of AI_WRITING_FEATURES) setSetting(`ai_voice_override_${f.key}`, '');
}

function weekIndex(dateStr) {
  const d = new Date(String(dateStr || '').slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d)) return 0;
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday of that week
  return Math.floor(d.getTime() / (7 * 86400000));
}

// Which voice a feature should write in. Precedence: per-feature override → global fixed
// voice → rotation over enabled voices. The rotation is keyed by game week (so both games
// in a week share a voice) or, for award articles, by the article's slot on the page.
export function pickVoice(feature, { date, slot } = {}) {
  const cfg = getVoiceConfig();
  const byId = id => cfg.voices.find(v => v.id === id);
  const override = byId(cfg.overrides[feature]);
  if (override) return override;
  if (cfg.mode === 'fixed' && byId(cfg.fixedVoice)) return byId(cfg.fixedVoice);
  const pool = cfg.voices.filter(v => v.enabled);
  const list = pool.length ? pool : cfg.voices;
  const i = Number.isInteger(slot) ? slot : weekIndex(date);
  return list[((i % list.length) + list.length) % list.length];
}

export function aiTemperature() {
  const level = getSetting('ai_creativity', 'balanced');
  return (CREATIVITY_LEVELS.find(l => l.key === level) || CREATIVITY_LEVELS[1]).temperature;
}

