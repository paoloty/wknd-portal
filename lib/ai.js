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
const usageOf = data => ({ in: data?.usage?.prompt_tokens ?? data?.usage?.input_tokens ?? data?.usageMetadata?.promptTokenCount ?? null, out: data?.usage?.completion_tokens ?? data?.usage?.output_tokens ?? data?.usageMetadata?.candidatesTokenCount ?? null });

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

// Anthropic (Claude): Messages API. JSON comes back through a forced tool call whose input
// schema is ours. Temperature tops out at 1.0 there, and Claude 5 models take none.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
// A key not scoped to a workspace needs the workspace id on every request.
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID || '';
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL   || 'claude-haiku-5-5';
const ANTHROPIC_MODELS  = listEnv(process.env.ANTHROPIC_MODELS).length ? listEnv(process.env.ANTHROPIC_MODELS) : [ANTHROPIC_MODEL];

// Providers are tried in this order; one without a key is skipped. Free first, then paid
// cheapest first. AI_PRIMARY_PROVIDER is the older single-provider setting, still honored
// when AI_PROVIDER_ORDER isn't set.
const ALL_PROVIDERS = ['groq', 'gemini', 'openai', 'anthropic'];
const AI_PROVIDER_ORDER = (() => {
  const raw = String(process.env.AI_PROVIDER_ORDER || '').toLowerCase().split(',').map(s => s.trim()).filter(p => ALL_PROVIDERS.includes(p));
  if (raw.length) return Array.from(new Set(raw));
  const legacy = String(process.env.AI_PRIMARY_PROVIDER || '').trim().toLowerCase();
  return ALL_PROVIDERS.includes(legacy) ? [legacy, ...ALL_PROVIDERS.filter(p => p !== legacy)] : ALL_PROVIDERS;
})();

export const aiAvailable = () => !!(GROQ_API_KEY || OPENAI_API_KEY || GEMINI_API_KEY || ANTHROPIC_API_KEY);

// ── Tiers (2026-10-20, Paolo) ──
// Callers say how big a piece is (opts.tier) and the tier picks the provider order:
//   short  — 1-2 sentence blocks, headlines, notes: free first (Groq → Gemini), then paid
//   medium — a paragraph (POTG, race writeups, previews): OpenAI → Claude
//   long   — recaps, award articles, posts: Claude → OpenAI (the voice shows most here)
//   check  — fact checks: Groq gpt-oss (reasons, free) → OpenAI; never the writer judging itself
// AI_ORDER_SHORT / _MEDIUM / _LONG / _CHECK override one tier. Until ANTHROPIC_CREDIT_UNTIL
// (YYYY-MM-DD, the promo credit's expiry) Claude goes first for every writing tier; after it
// the orders above apply with nothing to change. No tier → AI_PROVIDER_ORDER as before.
const TIER_ORDERS = {
  short:  ['groq', 'gemini', 'openai', 'anthropic'],
  medium: ['openai', 'anthropic', 'groq', 'gemini'],
  long:   ['anthropic', 'openai', 'groq', 'gemini'],
  check:  ['groq', 'openai', 'anthropic', 'gemini'],
};
const parseOrder = v => Array.from(new Set(String(v || '').toLowerCase().split(',').map(s => s.trim()).filter(p => ALL_PROVIDERS.includes(p))));
function anthropicCreditActive() {
  const until = String(process.env.ANTHROPIC_CREDIT_UNTIL || '').trim();
  return !!(ANTHROPIC_API_KEY && /^\d{4}-\d{2}-\d{2}$/.test(until) && new Date().toISOString().slice(0, 10) <= until);
}
export function tierOrder(tier) {
  if (!TIER_ORDERS[tier]) return null;
  const env = parseOrder(process.env[`AI_ORDER_${tier.toUpperCase()}`]);
  const order = env.length ? env : TIER_ORDERS[tier];
  return tier !== 'check' && anthropicCreditActive() ? ['anthropic', ...order.filter(p => p !== 'anthropic')] : order;
}

// Gemini 2.5 models "think" by default and those hidden tokens count against
// maxOutputTokens — at our small budgets 2.5-flash burns the whole limit thinking and
// returns a few words cut off mid-sentence. None of our prompts need reasoning, so turn it off.
function geminiGenConfig(model, base) {
  // Gemini 3.x accepts thinkingBudget: 0 as well (checked 2026-10-20); 2.0 and older don't.
  return /^gemini-(2\.5|[3-9])/.test(model) ? { ...base, thinkingConfig: { thinkingBudget: 0 } } : base;
}

// primaryOverride lets a specific feature move one provider to the front (e.g. player
// analysis runs Gemini-first) while the rest of the configured order stays as fallback.
// tier: see TIER_ORDERS; without one the configured AI_PROVIDER_ORDER applies.
function getProviderOrder(primaryOverride, tier) {
  const base = tierOrder(tier) || AI_PROVIDER_ORDER;
  const primary = String(primaryOverride || '').trim().toLowerCase();
  return ALL_PROVIDERS.includes(primary)
    ? [primary, ...base.filter(p => p !== primary)]
    : base;
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

// Claude via the Messages API. With `schema`, the answer comes back as a forced tool call
// whose input_schema is ours (→ { data }); without, as text (→ { text }).
async function generateWithAnthropic(prompt, { temperature = 0.7, maxTokens = 512, schema = null } = {}) {
  const empty = { text: '', data: null, model: null };
  if (!ANTHROPIC_API_KEY) return { ...empty, attemptedModels: [], lastErrorStatus: 0, lastErrorText: 'No Anthropic key.' };
  const kind = schema ? 'json' : 'text';
  const attemptedModels = [];
  let lastErrorStatus = 0, lastErrorText = '';
  for (const model of ANTHROPIC_MODELS) {
    attemptedModels.push(model);
    try {
      for (let retry = 0, waited = 0; retry < 4; retry++) {
        const t0 = Date.now();
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', ...(ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': ANTHROPIC_WORKSPACE_ID } : {}) },
          body: JSON.stringify({
            // Claude 5 models reject temperature (400 "deprecated for this model"); older ones take 0-1.
            // ...and think by default, which spent a recap's whole 1200-token budget before any text.
            model, max_tokens: maxTokens, ...(/^claude-[a-z]+-5/.test(model) ? { thinking: { type: 'disabled' } } : { temperature: Math.min(1, temperature) }),
            messages: [{ role: 'user', content: prompt }],
            ...(schema ? { tools: [{ name: 'respond', description: 'Give the answer.', input_schema: schema }], tool_choice: { type: 'tool', name: 'respond' } } : {}),
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (r.ok) {
          const data = await r.json();
          callLog({ provider: 'anthropic', model, kind, ok: true, ms: Date.now() - t0, ...usageOf(data) });
          if (data?.stop_reason === 'max_tokens') { lastErrorText = 'Truncated (max_tokens).'; break; }
          if (schema) {
            const input = (data?.content || []).find(c => c.type === 'tool_use')?.input;
            if (input && typeof input === 'object') return { ...empty, data: input, model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
          } else {
            const text = (data?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
            if (text) return { ...empty, text, model, attemptedModels, lastErrorStatus: 0, lastErrorText: '' };
          }
          lastErrorText = 'Empty response.';
          break;
        }
        lastErrorStatus = r.status;
        lastErrorText = await r.text();
        callLog({ provider: 'anthropic', model, kind, ok: false, status: r.status, ms: Date.now() - t0 });
        // 529 = overloaded: worth a short wait like a 429.
        const wait = r.status === 429 || r.status === 529 ? retryAfterMs(r, lastErrorText) || 3000 : 0;
        if (wait && waited + wait <= RETRY_WAIT_MAX_MS) { waited += wait; await sleep(wait); continue; }
        // A bad key or no credit (400 "credit balance is too low") won't work on another model.
        if (r.status === 401 || r.status === 403 || /credit balance/i.test(lastErrorText)) return { ...empty, attemptedModels, lastErrorStatus, lastErrorText };
        break;
      }
    } catch (e) {
      lastErrorText = String(e?.message || e);
      break;
    }
  }
  return { ...empty, attemptedModels, lastErrorStatus, lastErrorText };
}

const PROVIDER_LABELS = { gemini: 'Gemini', anthropic: 'Claude' };
const labelOf = p => PROVIDER_LABELS[p] || CHAT_COMPLETION_PROVIDERS[p].label;

export async function generateText(prompt, opts = {}) {
  const errors = [];
  for (const provider of getProviderOrder(opts.primaryProvider, opts.tier)) {
    const result = provider === 'gemini' ? await generateWithGemini(prompt, opts)
      : provider === 'anthropic' ? await generateWithAnthropic(prompt, opts)
      : await generateWithChatCompletions(CHAT_COMPLETION_PROVIDERS[provider], prompt, opts);
    if (result.text) return { text: result.text, provider, model: result.model };
    const label = labelOf(provider);
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
// openaiModel: one OpenAI model to try first for this call (the fact checks use a stronger
// one than the writers: gpt-4o-mini judging its own drafts flagged correct statements).
async function generateJsonWithChatCompletions(cfg, prompt, schema, { temperature = 0.7, maxTokens = 512, openaiModel = '' } = {}) {
  if (!cfg.key) return { data: null, attemptedModels: [], lastErrorStatus: 0, lastErrorText: `No ${cfg.label} key.` };
  const models = Array.from(new Set([cfg.label === 'OpenAI' ? openaiModel : '', ...cfg.models].filter(Boolean)));
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
  for (const provider of getProviderOrder(opts.primaryProvider, opts.tier)) {
    const result = provider === 'gemini' ? await generateJsonWithGemini(prompt, schema, opts)
      : provider === 'anthropic' ? await generateWithAnthropic(prompt, { ...opts, schema })
      : await generateJsonWithChatCompletions(CHAT_COMPLETION_PROVIDERS[provider], prompt, schema, opts);
    if (result.data) return { data: result.data, provider, model: result.model };
    const label = labelOf(provider);
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
