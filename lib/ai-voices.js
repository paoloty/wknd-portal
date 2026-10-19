// Writing voices for the AI writers (game recaps, POTG spotlights, MVP race writeups,
// award articles), configurable from /admin/ai-writing. Everything lives in site_settings
// so an admin can edit voices, pin one, or change creativity without a deploy.
import { getSetting, setSetting } from './portal-db.js';

export const DEFAULT_VOICES = [
  { id: 'columnist', enabled: true, name: 'Sports columnist', guide: 'Write like an opinionated newspaper sports columnist. Have a clear take on what this game meant and argue it. Punchy sentences, a strong lede, a closing line with some bite.', sample: 'Forget the scoreboard for a second — this game was decided the moment White stopped settling for jumpers.' },
  { id: 'stat-nerd', enabled: true, name: 'Stat nerd', guide: 'Write like a stats-obsessed analyst who loves the one number that explains a game. Build the story around the runs, margins, and efficiency that decided it — but keep it readable, not a spreadsheet.', sample: 'Fifteen lead changes, thirteen ties, and exactly one stretch that mattered: a 12-0 burst in the third.' },
  { id: 'barbershop', enabled: true, name: 'Barbershop banter', guide: 'Write like friends breaking down the game afterwards — casual, playful, a little teasing. Light ribbing is fine; never mean, never mocking anyone personally.', sample: 'Somebody check on Maroon\'s first quarter, because it never showed up — eight points, total.' },
  // Rewritten 2026-10-20 after an audit: the old guide asked for a kid who "cannot really
  // speak Tagalog" and "8 or more" touches, so every piece bolted the same 7 words
  // ("literally", "diba", "super", "kasi", "nakakaloka", "made agaw/bawi") onto English.
  // Real conyo is fluent code-switching: English frame, Tagalog in the hinges.
  { id: 'conyo', enabled: true, name: 'Conyo hoops writer', guide: 'Write as a Makati/BGC private-school kid who grew up on Taglish and loves this league. Natural conyo, not English with Tagalog stickers: English is the frame, the Tagalog sits in the hinges. Use (a few per piece, never all): second-position particles right after the first word of a clause (naman, nga, pala, kasi, daw); sentence-final na / pa / lang / eh / ha / no? / \'di ba; connectors pero, tapos, kaso, kahit, kaya; "si" before a first name; "ang + adjective" (ang lupit, ang hirap, sayang); "nag-" on an English verb (nag-explode, nag-cool down, nag-foul out); "make + Tagalog root" ONLY for an action with an object (made sayang the lead, made bawi after the 0-for-5 start, made tambak Maroon), never on a stat ("made agaw 2 steals") or an English verb ("made secure"). Hoops Tagalog is welcome: tulog, lutang, dikit, tambak, lamang, habol, bawi, sablay, walang palag, todo, pasabog. Rhythm: at most one Tagalog hinge per sentence, leave some sentences fully English, and now and then drop a 2-4 word aside (Grabe lang. Sayang talaga. Wala, hands down.) - in 2-sentence formats attach the aside with a comma or dash, not a new sentence. Don\'ts: no particle or filler twice in one piece; "literally", "super", "like,", "\'di ba", "nakakaloka", "grabe", "I mean" at most once each and skip most of them; never end a statement with "diba" as if it were a period; no all-Tagalog sentences; no slurs, no jokes about class, looks, money or anyone\'s background; never say or explain "conyo". Names, scores, stat words and every number stay in English digits exactly as the facts give them (36 points, 10-of-18, 4-1): no Tagalog number words, no spelled-out numbers. Friendly, a little dramatic, never mean.', sample: 'Grabe si Vin, 10 threes. Not attempts ha, made. Maroon naman was tulog the whole first half, then they nag-wake up in the fourth with a 15-2 run. Too late na though, sayang talaga.' },
];

// The conyo guide as it shipped before 2026-10-20. A stored copy still equal to it (never
// edited at /admin/ai-writing) is upgraded to the new default on startup; an edited one is
// left alone.
const OLD_CONYO_GUIDE = 'Write as a conyo rich kid from a Makati/BGC private school who is obsessed with this league but cannot really speak Tagalog. Mostly English, with Tagalog words dropped in a little awkwardly, the conyo way: "make + verb" constructions ("they made bawi," "he made agaw the ball"), particles like "naman," "kasi," "talaga," "diba," "pa," and fillers like "like," "literally," "super," "so," "I mean," "grabe," "nakakaloka." Most sentences should carry at least one conyo touch — aim for 8 or more across the piece, never just one or two. Keep the actual basketball facts precise. Never say the word "conyo" or describe the voice — just write in it. Playful and self-unaware, never mean, and never mocking anyone\'s background or class.';

// ── What a voice brings beyond its guide (code, not the admin page; keyed by voice id) ──
// bank:  phrase groups; voiceFlavor() hands the writer one from each, varied per piece, so
//        drafts stop reusing the same five words
// check: 'taglish' → voiceProblems() checks the draft is really in the voice
// hot:   the voice needs some heat: short summary blocks capped at 0.6 get 0.85 instead
const VOICE_TRAITS = {
  conyo: {
    hot: true,
    check: 'taglish',
    bank: {
      openers: ['Grabe si [first name]', 'Okay, real talk', 'Hala', 'Anyare, [team]?', 'Uy', 'Not gonna lie', 'Sabi ko na nga ba'],
      intensifiers: ['sobrang', 'ang lupit', 'ang hirap', 'todo', 'pasabog', 'walang palag', 'grabe'],
      hinges: ['naman', 'nga', 'pala', 'kaya', 'kaso', 'tapos', 'pero', 'kahit'],
      asides: ['Sayang talaga.', 'Wala, hands down.', 'Chill lang.', 'Too late na.', 'Sana all.', 'Casual lang daw.', 'Dikit na dikit.'],
      hoops: ['made bawi', 'made habol', 'made tambak', 'made sayang', 'nag-explode', 'nag-cool down', 'nag-foul out', 'nagising', 'tulog', 'lutang', 'sablay'],
      tags: ["'di ba?", 'no?', 'ha', 'eh'],
    },
  },
};
export const voiceTraits = voice => VOICE_TRAITS[voice?.id] || {};

// One line of flavour for this piece: one phrase from each bank group, picked by a hash of
// `seed` (a game, player or block id) so regenerations of different pieces differ. '' for a
// voice without a bank.
export function voiceFlavor(voice, seed = '') {
  const bank = voiceTraits(voice).bank;
  if (!bank) return '';
  let h = 2166136261;
  for (const ch of `${voice.id}|${seed}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (list, i) => list[(h >>> (i * 3)) % list.length];
  const picks = Object.values(bank).map((list, i) => pick(list, i));
  return `Flavour you may use this time (pick 2-3, don't force them, never reuse one): ${picks.map(p => `"${p}"`).join(', ')}.`;
}

// The cheap code check that a draft is really in the voice (runWriter check, no AI call).
// conyo: a few different Tagalog hinges (more for longer pieces), none used 3+ times, the
// fillers at most once, not mostly Tagalog, and none of the old misuses ("made agaw 2.4
// steals", "made secure", a floating ", pa,", "diba." as a full stop). Returns problem lines.
const TAGLISH = /\b(naman|nga|pala|kasi|daw|raw|lang|pero|tapos|kaso|kahit|kaya|parang|sobrang|sayang|grabe|hala|wala|tulog|lutang|dikit|tambak|lamang|habol|bawi|sablay|todo|pasabog|nakakaloka|talaga|di ba|diba|ang (?:lupit|galing|hirap|sakit)|nag-\w+|nagising|walang palag)\b/gi;
const FILLERS = /\b(literally|super|i mean|diba|di ba|nakakaloka)\b|\blike,/gi;
export function voiceProblems(text, voice) {
  if (voiceTraits(voice).check !== 'taglish') return [];
  const t = String(text || '').replace(/\*\*/g, '');
  const words = t.split(/\s+/).filter(Boolean).length;
  const found = (t.match(TAGLISH) || []).map(m => m.toLowerCase().replace(/^'?di ba$/, 'diba'));
  // "si Vin": the name marker (case-sensitive: si + a capital).
  const si = (t.match(/\bsi [A-Z][a-z]/g) || []).length;
  const distinct = new Set(found).size + (si ? 1 : 0);
  const need = words > 60 ? 3 : words > 25 ? 2 : 1;
  const out = [];
  if (distinct < need) out.push(`it reads as plain English: write it in the voice (${need} or more different Tagalog hinges like naman, pala, tapos, si [name], sayang, plus one short aside)`);
  // Stock words alone are the "English with stickers" pattern the old guide produced: each
  // used once still reads as stickers. A piece needs real hinges beyond them.
  const STOCK = new Set(['grabe', 'nakakaloka', 'diba', 'talaga', 'kasi']);
  const real = new Set(found.filter(w => !STOCK.has(w))).size + (si ? 1 : 0);
  const needReal = words > 60 ? 2 : words > 25 ? 1 : 0;
  if (distinct >= need && real < needReal) out.push(`it only uses the stock words (${[...new Set(found.filter(w => STOCK.has(w)))].join(', ') || 'none'}) bolted onto English: put the Tagalog in the hinges instead (naman, pala, tapos, pero, si [name], sayang, nag- verbs, hoops words like tulog or tambak)`);
  const counts = {};
  for (const w of found) counts[w] = (counts[w] || 0) + 1;
  const over = Object.entries(counts).filter(([, n]) => n >= 3).map(([w, n]) => `"${w}" ${n} times`);
  if (over.length) out.push(`it repeats ${over.join(', ')} — use each at most twice`);
  const fill = {};
  for (const m of t.match(FILLERS) || []) { const k = m.toLowerCase().replace(/^di ba$/, 'diba'); fill[k] = (fill[k] || 0) + 1; }
  const fillOver = Object.entries(fill).filter(([, n]) => n > 1).map(([w, n]) => `"${w}" ${n} times`);
  if (fillOver.length) out.push(`it leans on fillers (${fillOver.join(', ')}) — once each at most`);
  if (words >= 20 && found.length / words > 0.25) out.push('it is mostly Tagalog: keep English as the frame, Tagalog only in the hinges');
  if (/\bma(?:de|ke)s? (?:agaw|bawi|takbo|habol)\s+\d/i.test(t) || /\bma(?:de|ke)s? (?:agaw|takbo) (?:the|a|an|his|her|their) (?:ball|rebound|boards?|steals?|shots?)\b.*\d/i.test(t)) out.push('it puts "made + Tagalog word" on a stat ("made agaw 2 steals"): use it only for an action with an object, like "made tambak Maroon"');
  if (/\bma(?:de|ke)s? (?:secure|slip|comeback|sure|score|shoot|win)\b/i.test(t)) out.push('it puts "made" on an English verb ("made secure"): use "nag-" for English verbs (nag-secure) or plain English');
  if (/,\s*pa,/i.test(t)) out.push('it uses a floating ", pa," — put "pa" at the end of a clause ("and 12 boards pa")');
  if (/\bdiba\.\s/i.test(t)) out.push('it ends a statement with "diba." — "di ba" is a question tag');
  return out;
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
      if (v.id === 'conyo' && v.guide === OLD_CONYO_GUIDE) { v.guide = fresh.guide; v.sample = fresh.sample; changed = true; }
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

export const VOICE_LIMITS = { maxVoices: 12, name: 40, guide: 2000, sample: 400 };

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
    voices.push({ id, enabled: v?.enabled !== false, name, guide, sample });
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

