// Shared "who can we reach" filter for any feature that broadcasts to players (Papawis
// announcements and slot alerts, pick reminders; posts etc. can use it too). Each feature
// picks its own pool of player ids and adds its own rules through `exclude`; the account
// gates come from checkActivePlayer() in portal-db.js so every broadcast (and Papawis
// Autofill) shares one definition of an active player.
//
// Gates, in order:
//   1. checkActivePlayer: valid email (well-formed, not hard-bounced since its last
//      delivery), active player record, approved registration, a working way to log in
//      (not an expired set-password link), and logged in within the last 90 days.
//      Fails → skipped entirely, bell included.
//   2. The feature's own exclude(playerId) rule, if any.
// Survivors always get the bell. Email is held back (bellOnly says why) when they opted
// out via the feature's opt-out column, once marked one of our emails as spam, or share
// an address with an account already on the list, so one inbox gets one email.
import { checkActivePlayer, getActivePlayers } from './portal-db.js';

export { isWellFormedEmail } from './portal-db.js';

const SKIP_KEY = {
  no_valid_email: 'noValidEmail', bounced: 'noValidEmail', inactive: 'inactive',
  not_approved: 'notApproved', link_expired: 'linkExpired', dormant: 'dormant',
};

// playerIds: the feature's pool; defaults to every active player.
// optOutColumn: the registrations column holding this feature's email opt-out, e.g.
// 'papawis_email_optout' or 'picks_email_optout'.
export function selectBroadcastRecipients(playerIds = getActivePlayers().map(p => p.id), { optOutColumn = '', exclude = null } = {}) {
  const recipients = [];
  const skipped = { noValidEmail: 0, bounced: 0, inactive: 0, notApproved: 0, linkExpired: 0, dormant: 0, excluded: 0 };
  const seenEmails = new Set();
  for (const playerId of new Set(playerIds)) {
    const check = checkActivePlayer(playerId);
    if (!check.ok) {
      skipped[SKIP_KEY[check.reason]]++;
      if (check.reason === 'bounced') skipped.bounced++;
      continue;
    }
    if (exclude?.(playerId)) { skipped.excluded++; continue; }

    const { player, reg, email, health } = check;
    const duplicate = seenEmails.has(email);
    seenEmails.add(email);
    const bellOnly = optOutColumn && reg[optOutColumn] ? 'opted out of emails'
      : health.complained ? 'marked a past email as spam'
      : duplicate ? 'email shared with another account, sent once' : '';
    recipients.push({ player, reg, email, bellOnly, emailable: !bellOnly });
  }
  return { recipients, skipped };
}
