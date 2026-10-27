// Push notifications for the players app (Web Push, the `web-push` library). On iPhone they
// work for the installed app only (iOS 16.4+), which the app requires anyway.
//
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from the environment, else a pair made once and
// kept in site_settings (vapid_public / vapid_private), so a deploy needs no setup. Changing
// keys orphans every existing subscription (phones re-subscribe from Settings).
//
// What gets pushed: every bell notification (createNotification → server.js listener →
// pushForNotification), sorted into kinds the player can switch off in Settings. Kinds not
// listed (account messages, balance, Rate & Win) always come through.
import webpush from 'web-push';
import {
  getSetting, setSetting, getPushSubscriptionsForPlayer, deletePushSubscription, markPushOk, markPushFailed, getPushPrefs,
  getLastAppOpenAt, getRegistration,
} from './portal-db.js';

// Outside production (a laptop, the staging tunnel) pushes only reach the developer's own
// phones, like sendMail's redirect (lib/mailer.js): a test copy of the database carries real
// players' phone subscriptions, and a test must never buzz them. DEV_PUSH_EMAILS (comma list)
// overrides who counts as the developer; default CONTACT_EMAIL.
const IS_PROD = process.env.NODE_ENV === 'production';
const DEV_PUSH_TO = new Set(String(process.env.DEV_PUSH_EMAILS || process.env.CONTACT_EMAIL || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
const devMayPush = s => { const e = String(getRegistration(s.reg_id)?.email || '').toLowerCase(); return DEV_PUSH_TO.has(e); };

// Whether the app reaches this player well enough that an ask can skip the email (a bell's
// push goes to their phone instead): they opened the app within app_active_days (default
// 14, app_events 'open'), a phone of theirs has push on and isn't failing, and `kind` isn't
// switched off. { ok, why }: why is 'app' when ok, else no_app, app_idle, push_off, kind_off.
export const appActiveDays = () => Math.max(1, Number(getSetting('app_active_days', '14')) || 14);
export function appReach(playerId, kind = '') {
  const opened = getLastAppOpenAt(playerId);
  if (!opened) return { ok: false, why: 'no_app' };
  if (opened < Date.now() - appActiveDays() * 86400000) return { ok: false, why: 'app_idle' };
  const subs = getPushSubscriptionsForPlayer(playerId).filter(s => (s.failures || 0) < 3);
  if (!subs.length) return { ok: false, why: 'push_off' };
  if (kind && subs.every(s => getPushPrefs(s.reg_id)[kind] === false)) return { ok: false, why: 'kind_off' };
  return { ok: true, why: 'app' };
}

export const PUSH_KINDS = [
  { key: 'picks', label: 'Picks & MVP', sub: 'Picks closing, your results, the MVP race' },
  { key: 'papawis', label: 'Papawis', sub: 'New runs, open slots, moved off the waitlist' },
  { key: 'games', label: 'Games', sub: 'Your stat card, rate the game' },
  { key: 'comments', label: 'Comments', sub: 'Replies and mentions' },
  { key: 'announcements', label: 'Announcements', sub: 'News from the league' },
];

// A notification type → its kind ('' = always sent).
export function pushKindOf(type = '') {
  // A run's bill ("Sunday run is done, you're in for ₱280") is an account message: it comes
  // through even with Papawis notifications off.
  if (type === 'papawis_completed') return '';
  if (/^(pick_|mvp_|app_pick)/.test(type)) return 'picks';
  if (/^(papawis_|court_)/.test(type)) return 'papawis';
  if (/^(stat_card|game_rate|potg|game_live)/.test(type)) return 'games';
  if (/(comment|mention|reaction)/.test(type) || /^barkadahan_/.test(type)) return 'comments';
  if (/^app_announcement/.test(type)) return 'announcements';
  return '';
}

let keys = null;
export function vapidKeys() {
  if (keys) return keys;
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    pub = getSetting('vapid_public', ''); priv = getSetting('vapid_private', '');
    if (!pub || !priv) {
      const k = webpush.generateVAPIDKeys();
      pub = k.publicKey; priv = k.privateKey;
      setSetting('vapid_public', pub); setSetting('vapid_private', priv);
      console.log('[push] made a VAPID key pair (kept in site_settings)');
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@wkndbasketball.com', pub, priv);
  keys = { publicKey: pub };
  return keys;
}

// Send one push to every phone of this player that wants this kind. payload: { title, body,
// url, tag, badge, icon, face } (icon: the sender's photo; face: for the open app's banner). Gone subscriptions (404/410) are removed; others count failures.
export async function pushToPlayer(playerId, payload, { kind = '', regId = '' } = {}) {
  vapidKeys();
  let subs = getPushSubscriptionsForPlayer(playerId);
  if (!IS_PROD) {
    const kept = subs.filter(devMayPush);
    if (kept.length < subs.length) console.log(`[push] not production: held ${subs.length - kept.length} push(es) to player ${playerId} (only ${[...DEV_PUSH_TO].join(', ') || 'nobody'} gets pushes here)`);
    subs = kept;
  }
  if (!subs.length) return 0;
  let sent = 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async s => {
    if (kind && getPushPrefs(regId || s.reg_id)[kind] === false) return;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: 'normal' });
      markPushOk(s.endpoint); sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) deletePushSubscription(s.endpoint);
      else { markPushFailed(s.endpoint); console.error('[push]', e.statusCode || '', e.body || e.message); }
    }
  }));
  return sent;
}
