// Cheap, no-schema-change heuristics that surface registrations worth a second look —
// not a hard block, just an "⚠ Flagged" badge for the admin reviewing the queue.

const PLACEHOLDER_NAME_RE = /^(test|asdf|qwerty|admin|xxx+|n\/?a|none|unknown|sample|foo|bar|abc)\b/i;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
  '10minutemail.com', 'yopmail.com', 'trashmail.com', 'discard.email',
  'throwawaymail.com', 'getnada.com', 'fakeinbox.com', 'sharklasers.com',
]);

function isRepeatedChar(s) {
  const compact = s.replace(/\s+/g, '');
  return compact.length > 0 && new Set(compact.toLowerCase()).size === 1;
}

function looksLikePlaceholderName(fullName) {
  const parts = (fullName || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return true;
  return parts.some(p => PLACEHOLDER_NAME_RE.test(p) || isRepeatedChar(p));
}

function looksLikeDisposableEmail(email) {
  const domain = (email || '').split('@')[1]?.toLowerCase().trim();
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function looksLikeFakePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return false;
  if (digits.length < 7) return true;
  return new Set(digits).size === 1;
}

function impliesImplausibleAge(birthday) {
  if (!birthday) return false;
  const dob = new Date(birthday);
  if (Number.isNaN(dob.getTime())) return false;
  const ageMs = Date.now() - dob.getTime();
  const age = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  return age < 10 || age > 80;
}

// allRegs is the full registrations list (already fetched by the caller) — used only
// to spot duplicate emails, not queried again here.
export function detectBogusFlags(reg, allRegs = []) {
  const reasons = [];

  if (looksLikePlaceholderName(reg.full_name)) reasons.push('Placeholder-looking name');
  if (looksLikeDisposableEmail(reg.email)) reasons.push('Disposable email domain');
  if (looksLikeFakePhone(reg.phone)) reasons.push('Suspicious phone number');
  if (impliesImplausibleAge(reg.birthday)) reasons.push('Implausible age from birthday');

  const email = (reg.email || '').toLowerCase().trim();
  if (email) {
    const dupeCount = allRegs.filter(r => (r.email || '').toLowerCase().trim() === email).length;
    if (dupeCount > 1) reasons.push('Duplicate email across multiple registrations');
  }

  return reasons;
}
