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
} from './portal-db.js';

export const PUSH_KINDS = [
  { key: 'picks', label: 'Picks & MVP', sub: 'Picks closing, your results, the MVP race' },
  { key: 'papawis', label: 'Papawis', sub: 'New runs, open slots, moved off the waitlist' },
  { key: 'games', label: 'Games', sub: 'Your stat card, rate the game' },
  { key: 'comments', label: 'Comments', sub: 'Replies and mentions' },
  { key: 'announcements', label: 'Announcements', sub: 'News from the league' },
];

// A notification type → its kind ('' = always sent).
export function pushKindOf(type = '') {
  if (/^(pick_|mvp_|app_pick)/.test(type)) return 'picks';
  if (/^(papawis_|court_)/.test(type)) return 'papawis';
  if (/^(stat_card|game_rate|potg)/.test(type)) return 'games';
  if (/(comment|mention|reaction)/.test(type)) return 'comments';
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
// url, tag, badge }. Gone subscriptions (404/410) are removed; others count failures.
export async function pushToPlayer(playerId, payload, { kind = '', regId = '' } = {}) {
  vapidKeys();
  const subs = getPushSubscriptionsForPlayer(playerId);
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
