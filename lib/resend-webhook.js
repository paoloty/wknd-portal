// Resend webhooks (email.delivered / opened / clicked / bounced / complained ...), received
// at POST /webhooks/resend and applied to email_log. Resend signs every request with Svix:
// HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>", keyed with the base64 part of
// the endpoint's "whsec_..." signing secret (RESEND_WEBHOOK_SECRET). Verified by hand
// rather than pulling in the svix package for one function.
import { createHmac, timingSafeEqual } from 'crypto';
import { applyEmailEvent } from './portal-db.js';

const { RESEND_WEBHOOK_SECRET = '' } = process.env;
export const resendWebhookEnabled = !!RESEND_WEBHOOK_SECRET;

// Same 5-minute window Svix's own library uses, so a captured request can't be replayed later.
const TOLERANCE_MS = 5 * 60 * 1000;

export function verifyResendSignature(rawBody, headers) {
  if (!RESEND_WEBHOOK_SECRET) return false;
  const id        = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !timestamp || !sigHeader) return false;
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > TOLERANCE_MS) return false;

  const key      = Buffer.from(RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();
  // The header can carry several space-separated "v1,<base64>" signatures (during secret
  // rotation); any one matching is enough.
  return String(sigHeader).split(' ').some(part => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// Returns whether the event matched an email we logged (false for untracked event types,
// or emails sent before email_log existed — both still get a 200 so Resend doesn't retry).
export function handleResendEvent(event) {
  const emailId = event?.data?.email_id;
  const at      = Date.parse(event?.created_at || '') || Date.now();
  const reason  = event?.data?.bounce?.message || '';
  return applyEmailEvent({ type: event?.type, emailId, at, reason });
}
