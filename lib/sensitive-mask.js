// Garbles PII for admins who lack the can_view_sensitive flag — fields stay visible
// (labels, shape of the data) but the value is masked. Fixed-length garble segments
// on purpose: they don't leak the real string length.

export function maskEmail(email) {
  const at = (email || '').indexOf('@');
  if (at <= 0) return '••••••';
  const local  = email.slice(0, at);
  const domain = email.slice(at + 1);
  const parts  = domain.split('.');
  const tld    = parts.length > 1 ? parts.pop() : '';
  const maskedDomain = parts.map(p => (p[0] || '') + '••••').join('.') + (tld ? `.${tld}` : '');
  return `${local[0]}••••@${maskedDomain}`;
}

export function maskPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '••••••';
  return `${digits.slice(0, 4)}-••••-${digits.slice(-2)}`;
}

export function maskName(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).map(p => (p[0] || '') + '•••').join(' ');
}

export function maskBirthday(iso) {
  const parts = (iso || '').split('-');
  if (parts.length !== 3 || !parts[0]) return '••-••-••••';
  return `••-••-${parts[0]}`;
}
