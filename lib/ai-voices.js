// Writing voices for the AI writers (game recaps, POTG spotlights, MVP race writeups,
// award articles), configurable from /admin/ai-writing. Everything lives in site_settings
// so an admin can edit voices, pin one, or change creativity without a deploy.
import { getSetting, setSetting } from './portal-db.js';

export const DEFAULT_VOICES = [
  { id: 'columnist', enabled: true, name: 'Sports columnist', guide: 'Write like an opinionated newspaper sports columnist. Have a clear take on what this game meant and argue it. Punchy sentences, a strong lede, a closing line with some bite.', sample: 'Forget the scoreboard for a second — this game was decided the moment White stopped settling for jumpers.' },
  { id: 'stat-nerd', enabled: true, name: 'Stat nerd', guide: 'Write like a stats-obsessed analyst who loves the one number that explains a game. Build the story around the runs, margins, and efficiency that decided it — but keep it readable, not a spreadsheet.', sample: 'Fifteen lead changes, thirteen ties, and exactly one stretch that mattered: a 12-0 burst in the third.' },
  { id: 'barbershop', enabled: true, name: 'Barbershop banter', guide: 'Write like friends breaking down the game afterwards — casual, playful, a little teasing. Light ribbing is fine; never mean, never mocking anyone personally.', sample: 'Somebody check on Maroon\'s first quarter, because it never showed up — eight points, total.' },
  { id: 'conyo', enabled: true, name: 'Conyo hoops writer', guide: 'Write as a conyo rich kid from a Makati/BGC private school who is obsessed with this league but cannot really speak Tagalog. Mostly English, with Tagalog words dropped in a little awkwardly, the conyo way: "make + verb" constructions ("they made bawi," "he made agaw the ball"), particles like "naman," "kasi," "talaga," "diba," "pa," and fillers like "like," "literally," "super," "so," "I mean," "grabe," "nakakaloka." Most sentences should carry at least one conyo touch — aim for 8 or more across the piece, never just one or two. Keep the actual basketball facts precise. Never say the word "conyo" or describe the voice — just write in it. Playful and self-unaware, never mean, and never mocking anyone\'s background or class.', sample: 'Okay so like, Blue literally made takbo with a 21-0 run, diba? Maroon was so lost talaga, I can\'t even. And Vin? Grabe, he made agaw every loose ball pa, super nakakaloka. I mean, Maroon tried to make habol naman in the fourth, pero it was so late na kasi.' },
];

export const AI_WRITING_FEATURES = [
  { key: 'recap', label: 'Game recaps' },
  { key: 'potg',  label: 'Player of the Game' },
  { key: 'mvp',   label: 'MVP Race writeups' },
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

export const VOICE_LIMITS = { maxVoices: 12, name: 40, guide: 1200, sample: 400 };

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

