// Google Search Console API, read-only, as a service account (no googleapis dependency: the
// login is a JWT signed with Node's crypto). Setup, once, by a person:
//   1. Google Cloud console → a project → enable "Google Search Console API".
//   2. IAM → Service accounts → create one → Keys → Add key → JSON. Save the file on the server.
//   3. Search Console → wkndbasketball.com → Settings → Users and permissions → Add user:
//      the service account's email, permission "Restricted" (read is all this needs).
//   4. .env: GSC_SERVICE_ACCOUNT_FILE=/path/to/key.json (or GSC_SERVICE_ACCOUNT_JSON='{...}')
//      and GSC_SITE_URL=sc-domain:wkndbasketball.com (a Domain property) or
//      https://wkndbasketball.com/ (a URL-prefix property), exactly as Search Console names it.
import { createSign } from 'crypto';
import { readFileSync } from 'fs';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
let cached = null; // { token, exp }

function credentials() {
  try {
    const raw = process.env.GSC_SERVICE_ACCOUNT_JSON || (process.env.GSC_SERVICE_ACCOUNT_FILE ? readFileSync(process.env.GSC_SERVICE_ACCOUNT_FILE, 'utf8') : '');
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c.client_email && c.private_key ? c : null;
  } catch { return null; }
}
export const gscSiteUrl = () => String(process.env.GSC_SITE_URL || '').trim();
export const gscConfigured = () => !!(credentials() && gscSiteUrl());

const b64url = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const c = credentials();
  if (!c) throw new Error('Search Console is not set up (GSC_SERVICE_ACCOUNT_FILE / GSC_SERVICE_ACCOUNT_JSON).');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: c.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(c.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google login failed: ${j.error_description || j.error || res.status}`);
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cached.token;
}

async function api(url, body) {
  const res = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${j.error?.message || 'request failed'}`);
  return j;
}

// Search analytics rows for one day range. dimensions e.g. ['date', 'page', 'query'].
// Returns [{ keys: [...], clicks, impressions, ctr, position }], paging past 25,000 rows.
export async function gscSearchAnalytics({ startDate, endDate, dimensions, rowLimit = 25000 }) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl())}/searchAnalytics/query`;
  const out = [];
  for (let startRow = 0; startRow < 200000; startRow += rowLimit) {
    const j = await api(url, { startDate, endDate, dimensions, rowLimit, startRow, dataState: 'final' });
    const rows = j.rows || [];
    out.push(...rows);
    if (rows.length < rowLimit) break;
  }
  return out;
}

// URL Inspection: is this URL indexed, when Google last crawled it, the canonical it chose.
export async function gscInspectUrl(inspectionUrl) {
  const j = await api('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl, siteUrl: gscSiteUrl() });
  const r = j.inspectionResult?.indexStatusResult || {};
  return {
    verdict: r.verdict || '', coverage: r.coverageState || '', indexing: r.indexingState || '', robots: r.robotsTxtState || '',
    lastCrawl: r.lastCrawlTime || '', googleCanonical: r.googleCanonical || '', userCanonical: r.userCanonical || '',
    pageFetch: r.pageFetchState || '',
  };
}
