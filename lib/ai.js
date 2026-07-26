import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.5-flash-lite';
const GEMINI_FALLBACK_MODELS = [GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const OPENAI_FALLBACK_MODELS = [OPENAI_MODEL, 'gpt-4.1-mini', 'gpt-4o-mini'];

const AI_PRIMARY_PROVIDER = String(process.env.AI_PRIMARY_PROVIDER || 'openai').trim().toLowerCase();

export const aiAvailable = () => !!(OPENAI_API_KEY || GEMINI_API_KEY);

// primaryOverride lets a specific feature invert the provider order (e.g. player
// analysis runs Gemini-primary/OpenAI-fallback while recap/POTG keep the env default).
function getProviderOrder(primaryOverride) {
  const primary = String(primaryOverride || AI_PRIMARY_PROVIDER).trim().toLowerCase();
  return primary === 'openai'
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

export async function generateWithGemini(prompt, { temperature = 0.7, maxTokens = 512 } = {}) {
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
        if (text) return { text, model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
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
  return { text: '', model: null, attemptedModels, lastErrorStatus, lastErrorText };
}

export async function generateText(prompt, opts = {}) {
  const order = getProviderOrder(opts.primaryProvider);
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

// ── Structured (JSON schema) generation ──────────────────────────────────────
// Schema is authored once in standard JSON Schema (lowercase types, e.g. for the
// player-analysis focus_tag enum) and adapted per-provider below — OpenAI takes it
// as-is, Gemini needs uppercase type names and doesn't understand additionalProperties.

const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set(['additionalProperties']);

function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(schema)) {
      if (GEMINI_UNSUPPORTED_SCHEMA_KEYS.has(k)) continue;
      out[k] = (k === 'type' && typeof v === 'string') ? v.toUpperCase() : toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

async function generateJsonWithOpenAi(prompt, schema, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!OPENAI_API_KEY) return { data: null, attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'No OpenAI key.' };
  const models = Array.from(new Set(OPENAI_FALLBACK_MODELS.filter(Boolean)));
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens,
          response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const data = await r.json();
        const text = String(data?.choices?.[0]?.message?.content || '').trim();
        if (text) {
          try { return { data: JSON.parse(text), model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' }; }
          catch { lastErrorText = 'Malformed JSON from model.'; continue; }
        }
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
  return { data: null, model: null, attemptedModels, lastErrorStatus, lastErrorText };
}

async function generateJsonWithGemini(prompt, schema, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!GEMINI_API_KEY) return { data: null, attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'No Gemini key.' };
  const models = Array.from(new Set(GEMINI_FALLBACK_MODELS.filter(Boolean)));
  const geminiSchema = toGeminiSchema(schema);
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', responseSchema: geminiSchema },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const data = await r.json();
        const text = (data?.candidates || []).flatMap(c => c?.content?.parts || []).map(p => String(p?.text || '')).join('').trim();
        if (text) {
          try { return { data: JSON.parse(text), model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' }; }
          catch { lastErrorText = 'Malformed JSON from model.'; continue; }
        }
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
  return { data: null, model: null, attemptedModels, lastErrorStatus, lastErrorText };
}

// Like generateText, but constrains the response to `schema` (standard JSON Schema)
// and returns the parsed object. opts.primaryProvider overrides AI_PRIMARY_PROVIDER
// for this call only.
export async function generateJson(prompt, schema, opts = {}) {
  const order = getProviderOrder(opts.primaryProvider);
  let openAiResult = { data: null, attemptedModels: [], lastErrorText: 'Not attempted.' };
  let geminiResult = { data: null, attemptedModels: [], lastErrorText: 'Not attempted.' };
  for (const provider of order) {
    if (provider === 'openai') {
      openAiResult = await generateJsonWithOpenAi(prompt, schema, opts);
      if (openAiResult.data) return { data: openAiResult.data, provider: 'openai', model: openAiResult.model };
    } else {
      geminiResult = await generateJsonWithGemini(prompt, schema, opts);
      if (geminiResult.data) return { data: geminiResult.data, provider: 'gemini', model: geminiResult.model };
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
