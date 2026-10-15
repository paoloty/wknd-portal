// Group sends (admin redesign, 2026-10-15): the one path every auto-nudge, and later the
// Message players composer, goes through.
//
//   sendBroadcast({
//     kind, dedupeKey, title, body, link, segment, createdBy,
//     recipients,          // from selectBroadcastRecipients (lib/broadcast-recipients.js)
//     bell: { type, title, body, link } | false,
//     email: async (recipient, broadcastId) => ({ subject, html, kind, headers }) | null,
//   })
//
// What it guarantees:
//   • at most once per dedupeKey: the broadcasts row is written before anything is sent, so
//     a crash or a second job tick can't repeat it
//   • a bell for every recipient, tagged with the broadcast (notifications.broadcast_id)
//   • email only for recipients marked emailable (valid, not bounced, not opted out), and
//     only if they've had fewer than 1 group email in 24 h and 3 in 7 days (the caps)
//   • emails paced 600 ms apart (Resend allows about 2 a second); outside production only
//     the first email goes, and lib/mailer.js redirects it to the admin inbox
//   • email_log.broadcast_id on every email, and bell/email counts on the broadcasts row
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  createNotification, insertBroadcast, getBroadcastByDedupe, setBroadcastCounts, countBroadcastEmailsSince,
  getSetting, setSetting,
} from './portal-db.js';
import { sendMail } from './mailer.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');
export const CAP_PER_DAY = 1;
export const CAP_PER_WEEK = 3;
const DAY = 86400000;

// ── League-emails unsubscribe link (registrations.league_email_optout) ──────────────────
function linkSecret() {
  let secret = getSetting('email_link_secret', '');
  if (!secret) { secret = randomBytes(32).toString('hex'); setSetting('email_link_secret', secret); }
  return secret;
}
const leagueToken = regId => createHmac('sha256', linkSecret()).update(`league-unsub:${regId}`).digest('hex').slice(0, 32);
export function leagueUnsubscribeUrl(regId) {
  return `${LIVE_URL}/emails/unsubscribe?r=${encodeURIComponent(regId)}&t=${leagueToken(regId)}`;
}
export function verifyLeagueUnsubscribe(regId, token) {
  const want = Buffer.from(leagueToken(String(regId || '')));
  const got = Buffer.from(String(token || ''));
  return got.length === want.length && timingSafeEqual(got, want);
}
export const unsubscribeHeaders = url => ({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

// Whether this address can take another group email right now.
export function underEmailCaps(email, now = Date.now()) {
  return countBroadcastEmailsSince(email, now - DAY) < CAP_PER_DAY && countBroadcastEmailsSince(email, now - 7 * DAY) < CAP_PER_WEEK;
}

const newBroadcastId = () => `bc_${Date.now()}_${randomBytes(3).toString('hex')}`;

// A campaign row for a group send that doesn't go through sendBroadcast (an admin-fired
// pick/podium reminder, Papawis announcement, season results): tag its bells
// (createNotification broadcastId) and emails (sendMail broadcastId) with the returned id,
// then finishCampaign() with the counts. Outside the per-player caps unless countsTowardCap.
export function startCampaign({ kind, title = '', body = '', link = '', segment = '', channels = 'email', createdBy = 'admin', countsTowardCap = false }) {
  const id = newBroadcastId();
  insertBroadcast({ id, kind, title, body, link, segment, channels, created_by: createdBy, counts_toward_cap: countsTowardCap ? 1 : 0 });
  return id;
}
export function finishCampaign(id, { bells = 0, emails = 0 } = {}) {
  if (id) setBroadcastCounts(id, bells, emails);
}

export async function sendBroadcast({
  kind, dedupeKey = '', title = '', body = '', link = '', segment = '', createdBy = 'auto',
  recipients = [], bell = null, email = null,
}) {
  if (dedupeKey && getBroadcastByDedupe(dedupeKey)) return { skipped: 'already sent', bell: 0, email: 0 };
  const id = newBroadcastId();
  const channels = [bell !== false ? 'bell' : '', email ? 'email' : ''].filter(Boolean).join('+') || 'bell';
  insertBroadcast({ id, kind, title, body, link, segment, channels, dedupe_key: dedupeKey, created_by: createdBy });

  let bells = 0;
  if (bell !== false) {
    const b = { type: kind, title, body, link, ...(bell || {}) };
    for (const r of recipients) {
      try { createNotification({ playerId: r.player.id, type: b.type, title: b.title, body: b.body, link: b.link, broadcastId: id }); bells++; }
      catch (e) { console.error(`[broadcast ${kind}] bell ${r.player.id}: ${e.message}`); }
    }
  }

  let emails = 0, capped = 0, failed = 0;
  if (email) {
    let list = recipients.filter(r => r.emailable && r.email);
    const before = list.length;
    list = list.filter(r => underEmailCaps(r.email));
    capped = before - list.length;
    if (!IS_PROD) list = list.slice(0, 1);
    let first = true;
    for (const r of list) {
      if (!first) await new Promise(res => setTimeout(res, 600));
      first = false;
      try {
        const msg = await email(r, id);
        if (!msg) continue;
        const ok = await sendMail({ to: r.email, ref: r.reg?.id || '', broadcastId: id, ...msg });
        if (ok) emails++;
      } catch (e) {
        failed++;
        console.error(`[broadcast ${kind}] email ${r.email}: ${e.message}`);
      }
    }
  }
  setBroadcastCounts(id, bells, emails);
  return { id, bell: bells, email: emails, capped, failed };
}
