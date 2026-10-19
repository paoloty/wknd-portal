import 'dotenv/config';
import { appendFileSync } from 'fs';

// Opt-in call log for the eval harness (scripts/ai-eval): with AI_CALL_LOG=<file> every
// provider call is appended as a JSON line (provider, model, kind, token usage, ms, ok).
// Off by default; never throws.
function callLog(entry) {
  const file = process.env.AI_CALL_LOG;
  if (!file) return;
  try { appendFileSync(file, JSON.stringify({ ts: Date.now(), ...entry }) + '\n'); } catch {}
}
const usageOf = data => ({ in: data?.usage?.prompt_tokens ?? data?.usageMetadata?.promptTokenCount ?? null, out: data?.usage?.completion_tokens ?? data?.usageMetadata?.candidatesTokenCount ?? null });

const listEnv = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL   = process.env.GEMINI_MODEL   || 'gemini-2.5-flash-lite';
// GEMINI_MODELS / OPENAI_MODELS (comma lists) replace the whole fallback chain when set — the
// eval harness uses them to pin one model; unset keeps the usual chain.
const GEMINI_FALLBACK_MODELS = listEnv(process.env.GEMINI_MODELS).length ? listEnv(process.env.GEMINI_MODELS) : [GEMINI_MODEL, 'gemini-2.5-flash'];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const OPENAI_FALLBACK_MODELS = listEnv(process.env.OPENAI_MODELS).length ? listEnv(process.env.OPENAI_MODELS) : [OPENAI_MODEL, 'gpt-4.1-mini', 'gpt-4o-mini'];

// A 429 that says how long to wait is waited out (up to 3 waits per model, AI_RETRY_WAIT_MAX_MS
// in total, default 20s) before the next model is tried. Without this a free-tier burst (Groq's 8k
// tokens/minute, Gemini's requests/minute) pushed every attempt of one write-up onto a
// different, weaker model. A daily quota ("retry in 9h") is skipped at once.
const RETRY_WAIT_MAX_MS = Number(process.env.AI_RETRY_WAIT_MAX_MS || 20000);
function retryAfterMs(r, body) {
  const h = Number(r.headers.get('retry-after'));
  if (h > 0) return h * 1000;
  // Gemini: "Please retry in 9h18m9.69s" / retryDelay "5s"; Groq: "try again in 2.5s".
  const m = String(body || '').match(/(?:retry in|try again in|"retryDelay":\s*")\s*(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
  if (!m) return r.status === 429 ? 3000 : 0;
  return ((Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)) * 1000;
}
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Groq: free tier, OpenAI-compatible chat completions API. Both models reason by default
// and, like Gemini 2.5, spend max_tokens on it — gpt-oss-120b at default effort stopped
// mid-word at our 220-token writeup budget. Keep reasoning minimal (see groqExtraBody).
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL   = process.env.GROQ_MODEL   || 'openai/gpt-oss-120b';
// Each Groq model has its own free-tier 8k tokens/minute bucket, so a third model buys headroom.
const GROQ_FALLBACK_MODELS = listEnv(process.env.GROQ_MODELS).length ? listEnv(process.env.GROQ_MODELS) : [GROQ_MODEL, 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
function groqExtraBody(model) {
  if (/^openai\/gpt-oss/.test(model)) return { reasoning_effort: 'low' }; // gpt-oss has no "none"
  if (/^qwen\/qwen3/.test(model))     return { reasoning_effort: 'none' };
  return {};
}

// Providers are tried in this order; one without a key is skipped. Free first, then paid
// cheapest first. AI_PRIMARY_PROVIDER is the older single-provider setting, still honored
// when AI_PROVIDER_ORDER isn't set.
const ALL_PROVIDERS = ['groq', 'gemini', 'openai'];
const AI_PROVIDER_ORDER = (() => {
  const raw = String(process.env.AI_PROVIDER_ORDER || '').toLowerCase().split(',').map(s => s.trim()).filter(p => ALL_PROVIDERS.includes(p));
  if (raw.length) return Array.from(new Set(raw));
  const legacy = String(process.env.AI_PRIMARY_PROVIDER || '').trim().toLowerCase();
  return ALL_PROVIDERS.includes(legacy) ? [legacy, ...ALL_PROVIDERS.filter(p => p !== legacy)] : ALL_PROVIDERS;
})();

export const aiAvailable = () => !!(GROQ_API_KEY || OPENAI_API_KEY || GEMINI_API_KEY);

// Gemini 2.5 models "think" by default and those hidden tokens count against
// maxOutputTokens — at our small budgets 2.5-flash burns the whole limit thinking and
// returns a few words cut off mid-sentence. None of our prompts need reasoning, so turn it off.
function geminiGenConfig(model, base) {
  // Gemini 3.x accepts thinkingBudget: 0 as well (checked 2026-10-20); 2.0 and older don't.
  return /^gemini-(2\.5|[3-9])/.test(model) ? { ...base, thinkingConfig: { thinkingBudget: 0 } } : base;
}

// primaryOverride lets a specific feature move one provider to the front (e.g. player
// analysis runs Gemini-first) while the rest of the configured order stays as fallback.
function getProviderOrder(primaryOverride) {
  const primary = String(primaryOverride || '').trim().toLowerCase();
  return ALL_PROVIDERS.includes(primary)
    ? [primary, ...AI_PROVIDER_ORDER.filter(p => p !== primary)]
    : AI_PROVIDER_ORDER;
}

const CHAT_COMPLETION_PROVIDERS = {
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions',      key: OPENAI_API_KEY, models: OPENAI_FALLBACK_MODELS },
  groq:   { label: 'Groq',   url: 'https://api.groq.com/openai/v1/chat/completions', key: GROQ_API_KEY,   models: GROQ_FALLBACK_MODELS, extraBody: groqExtraBody },
};

// OpenAI and Groq share the chat-completions request/response shape.
async function generateWithChatCompletions(cfg, prompt, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!cfg.key) return { text: '', attemptedModels: [], lastErrorStatus: 0, lastErrorText: `No ${cfg.label} key.` };
  const models = Array.from(new Set(cfg.models.filter(Boolean)));
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      for (let retry = 0, waited = 0; retry < 4; retry++) {
        const t0 = Date.now();
        const r = await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens, ...(cfg.extraBody?.(model) || {}) }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const data = await r.json();
          callLog({ provider: cfg.label.toLowerCase(), model, kind: 'text', ok: true, ms: Date.now() - t0, ...usageOf(data) });
          const text = String(data?.choices?.[0]?.message?.content || '').trim();
          // A response cut off by max_tokens is unusable prose — try the next model.
          if (data?.choices?.[0]?.finish_reason === 'length') { lastErrorText = 'Truncated (max_tokens).'; break; }
          if (text) return { text, model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
          lastErrorText = 'Empty response.';
          break;
        }
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        callLog({ provider: cfg.label.toLowerCase(), model, kind: 'text', ok: false, status: r.status, ms: Date.now() - t0 });
        const wait = r.status === 429 ? retryAfterMs(r, lastErrorText) : 0;
        if (wait && waited + wait <= RETRY_WAIT_MAX_MS) { waited += wait; await sleep(wait); continue; }
        if (r.status === 404 || r.status === 429 || r.status >= 500) break;
        return { text: '', attemptedModels, lastErrorStatus, lastErrorText };
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
      for (let retry = 0, waited = 0; retry < 4; retry++) {
        const t0 = Date.now();
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: geminiGenConfig(model, { temperature, maxOutputTokens: maxTokens }) }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const data = await r.json();
          callLog({ provider: 'gemini', model, kind: 'text', ok: true, ms: Date.now() - t0, ...usageOf(data) });
          const text = (data?.candidates || []).flatMap(c => c?.content?.parts || []).map(p => String(p?.text || '')).join('\n').trim();
          if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') { lastErrorText = 'Truncated (MAX_TOKENS).'; break; }
          if (text) return { text, model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
          lastErrorText = 'Empty response.';
          break;
        }
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        callLog({ provider: 'gemini', model, kind: 'text', ok: false, status: r.status, ms: Date.now() - t0 });
        const wait = r.status === 429 ? retryAfterMs(r, lastErrorText) : 0;
        if (wait && waited + wait <= RETRY_WAIT_MAX_MS) { waited += wait; await sleep(wait); continue; }
        if (r.status === 404 || r.status === 429 || r.status >= 500) break;
        return { text: '', model: null, attemptedModels, lastErrorStatus, lastErrorText };
      }
    } catch (e) {
      lastErrorText = String(e?.message || e);
      break;
    }
  }
  return { text: '', model: null, attemptedModels, lastErrorStatus, lastErrorText };
}

export async function generateText(prompt, opts = {}) {
  const errors = [];
  for (const provider of getProviderOrder(opts.primaryProvider)) {
    const result = provider === 'gemini'
      ? await generateWithGemini(prompt, opts)
      : await generateWithChatCompletions(CHAT_COMPLETION_PROVIDERS[provider], prompt, opts);
    if (result.text) return { text: result.text, provider, model: result.model };
    const label = provider === 'gemini' ? 'Gemini' : CHAT_COMPLETION_PROVIDERS[provider].label;
    errors.push(result.attemptedModels.length
      ? `${label} (${result.attemptedModels.join(',')}): ${String(result.lastErrorText).slice(0, 120)}`
      : `${label}: ${result.lastErrorText}`);
  }
  throw new Error(errors.join(' '));
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

// Strict json_schema mode (OpenAI and Groq) rejects any object schema that doesn't set
// additionalProperties:false and list every property as required. Callers write plain
// schemas (Gemini doesn't care), so tighten them here rather than at every call site.
function toStrictSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, toStrictSchema(v)]));
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

// OpenAI and Groq both take OpenAI-style json_schema structured output.
async function generateJsonWithChatCompletions(cfg, prompt, schema, { temperature = 0.7, maxTokens = 512 } = {}) {
  if (!cfg.key) return { data: null, attemptedModels: [], lastErrorStatus: 0, lastErrorText: `No ${cfg.label} key.` };
  const models = Array.from(new Set(cfg.models.filter(Boolean)));
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of models) {
    attemptedModels.push(model);
    try {
      for (let retry = 0, waited = 0; retry < 4; retry++) {
        const t0 = Date.now();
        const r = await fetch(cfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({
            model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens,
            response_format: { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: toStrictSchema(schema) } },
            ...(cfg.extraBody?.(model) || {}),
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const data = await r.json();
          callLog({ provider: cfg.label.toLowerCase(), model, kind: 'json', ok: true, ms: Date.now() - t0, ...usageOf(data) });
          const text = String(data?.choices?.[0]?.message?.content || '').trim();
          if (data?.choices?.[0]?.finish_reason === 'length') { lastErrorText = 'Truncated (max_tokens).'; break; }
          if (text) {
            try { return { data: JSON.parse(text), model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' }; }
            catch { lastErrorText = 'Malformed JSON from model.'; break; }
          }
          lastErrorText = 'Empty response.';
          break;
        }
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        callLog({ provider: cfg.label.toLowerCase(), model, kind: 'json', ok: false, status: r.status, ms: Date.now() - t0 });
        const wait = r.status === 429 ? retryAfterMs(r, lastErrorText) : 0;
        if (wait && waited + wait <= RETRY_WAIT_MAX_MS) { waited += wait; await sleep(wait); continue; }
        // A bad key won't work on the next model either; anything else (incl. a model
        // that doesn't support json_schema → 400) is worth trying the next model.
        if (r.status === 401 || r.status === 403) return { data: null, model: null, attemptedModels, lastErrorStatus, lastErrorText };
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
      for (let retry = 0, waited = 0; retry < 4; retry++) {
        const t0 = Date.now();
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: geminiGenConfig(model, { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', responseSchema: geminiSchema }),
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const data = await r.json();
          callLog({ provider: 'gemini', model, kind: 'json', ok: true, ms: Date.now() - t0, ...usageOf(data) });
          const text = (data?.candidates || []).flatMap(c => c?.content?.parts || []).map(p => String(p?.text || '')).join('').trim();
          if (text) {
            try { return { data: JSON.parse(text), model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' }; }
            catch { lastErrorText = 'Malformed JSON from model.'; break; }
          }
          lastErrorText = 'Empty response.';
          break;
        }
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        callLog({ provider: 'gemini', model, kind: 'json', ok: false, status: r.status, ms: Date.now() - t0 });
        const wait = r.status === 429 ? retryAfterMs(r, lastErrorText) : 0;
        if (wait && waited + wait <= RETRY_WAIT_MAX_MS) { waited += wait; await sleep(wait); continue; }
        if (r.status === 404 || r.status === 429 || r.status >= 500) break;
        return { data: null, model: null, attemptedModels, lastErrorStatus, lastErrorText };
      }
    } catch (e) {
      lastErrorText = String(e?.message || e);
      break;
    }
  }
  return { data: null, model: null, attemptedModels, lastErrorStatus, lastErrorText };
}

// Like generateText, but constrains the response to `schema` (standard JSON Schema)
// and returns the parsed object. opts.primaryProvider moves that provider to the front
// for this call only.
export async function generateJson(prompt, schema, opts = {}) {
  const errors = [];
  for (const provider of getProviderOrder(opts.primaryProvider)) {
    const result = provider === 'gemini'
      ? await generateJsonWithGemini(prompt, schema, opts)
      : await generateJsonWithChatCompletions(CHAT_COMPLETION_PROVIDERS[provider], prompt, schema, opts);
    if (result.data) return { data: result.data, provider, model: result.model };
    const label = provider === 'gemini' ? 'Gemini' : CHAT_COMPLETION_PROVIDERS[provider].label;
    errors.push(result.attemptedModels.length
      ? `${label} (${result.attemptedModels.join(',')}): ${String(result.lastErrorText).slice(0, 120)}`
      : `${label}: ${result.lastErrorText}`);
  }
  throw new Error(errors.join(' '));
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
