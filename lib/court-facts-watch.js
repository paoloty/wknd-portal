// Venue fact watcher (SEO plan, Fable audit 2026-11-20). Once a week the server reads the
// venue's OWN pages on file (website, booking link: never a directory) and pulls out the court
// rental and the phone number with plain parsers, no AI. server.js seoWatchFacts compares them
// with the court's info:
//   - the rate on the page matches ours → the "checked" date moves to today by itself (keeps
//     "Checked Nov 2026" and the title year honest; that's the real win);
//   - something differs or is missing on our side → a pending change in Admin → SEO report
//     (Venue facts) with the source line, applied with one tap. A wrong price in a Google title
//     is public, and rates change once or twice a year, so changes always wait for a person.
// Parsers, in order: the page's structured data (Sparrk booking pages carry "price"), then a ₱
// amount right after the court's name in the text (activatesports.ph lists every venue's price
// on one page, so "lowest ₱ on the page" would pick another venue's). Pages that build their
// prices in the browser (Gameville's managesports) give no rate, only the phone.

export const RATE_MIN = 500;
export const RATE_MAX = 10000;
// A change bigger than this is still offered, with a "double-check" note.
export const RATE_JUMP = 0.4;

const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', '#8369': '₱', '#x20B1': '₱', '#x20b1': '₱', ndash: '–', mdash: '—' };
export function htmlToText(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, k) => ENTITIES[k] ?? (/^#\d+$/.test(k) ? String.fromCodePoint(Number(k.slice(1))) : m))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const PESO = /(?:₱|\bPHP\s?|\bPhp\s?)\s?(\d{1,3}(?:,\d{3})+|\d{3,6})(?:\.\d{2})?/g;
const toNum = s => Number(String(s).replace(/,/g, ''));
const okRate = n => Number.isFinite(n) && n >= RATE_MIN && n <= RATE_MAX;

// Prices in the page's JSON-LD (Product / Offer / Place): "price", "lowPrice", "priceRange".
function ldPrices(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const p of m[1].matchAll(/"(?:price|lowPrice)"\s*:\s*"?(\d{3,6}(?:\.\d+)?)"?/g)) out.push(Math.round(Number(p[1])));
    for (const p of m[1].matchAll(/"priceRange"\s*:\s*"([^"]*)"/g)) for (const q of p[1].matchAll(/(\d{1,3}(?:,\d{3})+|\d{3,6})/g)) out.push(toNum(q[1]));
  }
  return out.filter(okRate);
}

// A ₱ amount within ~140 characters after one of the court's names. Returns the line it came from.
function ratesNearNames(text, names) {
  const low = text.toLowerCase();
  const out = [];
  for (const name of names) {
    const n = String(name || '').toLowerCase().trim();
    if (n.length < 5) continue;
    let i = low.indexOf(n);
    while (i !== -1) {
      const win = text.slice(i, i + n.length + 140);
      const m = [...win.matchAll(PESO)][0];
      if (m && okRate(toNum(m[1]))) out.push({ rate: toNum(m[1]), quote: win.slice(0, (m.index || 0) + m[0].length).replace(/\s+/g, ' ').trim() });
      i = low.indexOf(n, i + n.length);
    }
  }
  return out;
}

// Philippine numbers, national form digits ("09616407823", "0288904488").
export function phoneDigits(s) {
  let d = String(s || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+63')) d = `0${d.slice(3)}`;
  else if (d.startsWith('63') && d.length === 12) d = `0${d.slice(2)}`;
  return d.replace(/\+/g, '');
}
function phonesIn(html, text) {
  const found = new Map();
  const add = (raw, quote) => { const d = phoneDigits(raw); if (/^0\d{9,10}$/.test(d) && !found.has(d)) found.set(d, { digits: d, raw: raw.trim(), quote }); };
  for (const m of String(html || '').matchAll(/href=["']tel:([^"']+)["']/gi)) add(decodeURIComponent(m[1]), `tel: ${m[1]}`);
  for (const m of String(html || '').matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) add(m[1], `telephone: ${m[1]}`);
  for (const m of text.matchAll(/(?:\+63|\b0)\s?(?:\(\d{1,3}\)\s?)?\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g)) add(m[0], m[0]);
  return [...found.values()];
}

// What one venue page says. names: the court's name and alternate names (for the "near the
// name" rule). Structured data wins when it holds exactly one price.
export function readVenueFacts(html, { names = [] } = {}) {
  const text = htmlToText(html);
  const ld = [...new Set(ldPrices(html))];
  let rate = null, rateQuote = '';
  if (ld.length === 1) { rate = ld[0]; rateQuote = `structured data: price ${ld[0]}`; }
  else {
    const near = ratesNearNames(text, names);
    const distinct = [...new Set(near.map(r => r.rate))];
    if (distinct.length === 1) { rate = distinct[0]; rateQuote = near[0].quote; }
    else if (ld.length > 1 && distinct.length > 1) { /* several prices, none tied to the name: no rate */ }
  }
  return { rate, rateQuote: rateQuote.slice(0, 200), phones: phonesIn(html, text) };
}

// Compare what the pages say with what we show. ours: { rate (number|null), phone (digits|'') }.
// reads: [{ source, ok, rate, rateQuote, phones }]. Returns { confirmRate, changes: [...] }.
export function compareVenueFacts(ours, reads) {
  const good = reads.filter(r => r.ok);
  const rates = good.filter(r => r.rate != null);
  const changes = [];
  const confirmRate = ours.rate != null && rates.some(r => r.rate === ours.rate) && !rates.some(r => r.rate !== ours.rate);
  if (rates.length && !confirmRate) {
    const differing = rates.find(r => r.rate !== ours.rate);
    if (differing && rates.every(r => r.rate === differing.rate)) {
      const big = ours.rate ? Math.abs(differing.rate - ours.rate) / ours.rate > RATE_JUMP : false;
      changes.push({ field: 'rate', before: ours.rate, after: differing.rate, source: differing.source, quote: differing.rateQuote, big });
    }
  }
  const phones = good.flatMap(r => r.phones.map(p => ({ ...p, source: r.source })));
  // A phone only fills a gap: venue pages often list several numbers (other branches, sales),
  // so a page number that differs from ours isn't proof ours is wrong.
  if (!ours.phone && phones.length) {
    changes.push({ field: 'phone', before: '', after: phones[0].raw, source: phones[0].source, quote: phones[0].quote });
  }
  return { confirmRate, changes };
}
