import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.5-flash-lite';
const GEMINI_FALLBACK_MODELS = [GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const OPENAI_FALLBACK_MODELS = [OPENAI_MODEL, 'gpt-4.1-mini', 'gpt-4o-mini'];

const AI_PRIMARY_PROVIDER = String(process.env.AI_PRIMARY_PROVIDER || 'openai').trim().toLowerCase();

export const aiAvailable = () => !!(OPENAI_API_KEY || GEMINI_API_KEY);

function getProviderOrder() {
  return AI_PRIMARY_PROVIDER === 'openai'
    ? ['openai', 'gemini']
    : ['gemini', 'openai'];
}

async function generateWithOpenAi(prompt, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!OPENAI_API_KEY) return { text: '', attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'No OpenAI key.' };
  const models = Array.from(new Set(OPENAI_FALLBACK_MODELS.filter(Boolean)));
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const data = await r.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (text) return { text, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
        lastErrorText = 'Empty response.';
      } else {
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        if (r.status === 404 || r.status === 429 || r.status >= 500) continue;
        break;
      }
    } catch (e) {
      lastErrorText = String(e?.message || e);
      break;
    }
  }
  return { text: '', attemptedModels, lastErrorStatus, lastErrorText };
}

async function generateWithGemini(prompt, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!GEMINI_API_KEY) return { text: '', attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'No Gemini key.' };
  const models = Array.from(new Set(GEMINI_FALLBACK_MODELS.filter(Boolean)));
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const data = await r.json();
        const text = (data?.candidates || []).flatMap(c => c?.content?.parts || []).map(p => String(p?.text || '')).join('\n').trim();
        if (text) return { text, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
        lastErrorText = 'Empty response.';
      } else {
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        if (r.status === 404 || r.status === 429 || r.status >= 500) continue;
        break;
      }
    } catch (e) {
      lastErrorText = String(e?.message || e);
      break;
    }
  }
  return { text: '', attemptedModels, lastErrorStatus, lastErrorText };
}

export async function generateText(prompt, opts = {}) {
  const order = getProviderOrder();
  let openAiResult = { text: '', attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'Not attempted.' };
  let geminiResult = { text: '', attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'Not attempted.' };
  for (const provider of order) {
    if (provider === 'openai') {
      openAiResult = await generateWithOpenAi(prompt, opts);
      if (openAiResult.text) return { text: openAiResult.text, provider: 'openai' };
    } else {
      geminiResult = await generateWithGemini(prompt, opts);
      if (geminiResult.text) return { text: geminiResult.text, provider: 'gemini' };
    }
  }
  const errMsg = [
    openAiResult.attemptedModels.length ? `OpenAI (${openAiResult.attemptedModels.join(',')}): ${String(openAiResult.lastErrorText).slice(0, 120)}` : 'OpenAI: not attempted.',
    geminiResult.attemptedModels.length ? `Gemini (${geminiResult.attemptedModels.join(',')}): ${String(geminiResult.lastErrorText).slice(0, 120)}` : 'Gemini: not attempted.',
  ].join(' ');
  throw new Error(errMsg);
}

// ── PBP filter for AI recap input ────────────────────────────────────────────

const BLACKLIST_META = new Set([
  'periodCheckpoint', 'clockAdjust', 'adminFocusSet', 'rolePresence', 'manualPause',
]);

export function filterPbpForRecap(log) {
  if (!Array.isArray(log)) return [];
  // Reverse to chronological order (Q1→Q4) for AI consumption
  const chrono = [...log].reverse();
  const result = [];
  let prevMetaType = '';
  for (const e of chrono) {
    if (!e) continue;
    if (e.hiddenFromLog) continue;
    if (e.isUndoCompensation) continue;
    if (e.undoOfId) continue;
    const mt = e.metaType || '';
    if (BLACKLIST_META.has(mt)) { prevMetaType = mt; continue; }
    if (mt === 'playResume' && prevMetaType === 'manualPause') { prevMetaType = mt; continue; }
    prevMetaType = mt;
    result.push(e);
  }
  return result;
}
