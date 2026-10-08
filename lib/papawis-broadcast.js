// Papawis announcements and slot-opened alerts: the two "come play" emails that go to
// people who aren't on a game's roster (lib/papawis-notify.js covers emails to people who
// are).
//
// Announcement: an admin presses "Announce to players" on a game. It goes to the Papawis
// regulars, right away, or at the game's 8 AM sign-up open if sign-ups are delayed.
//
// Slot alert: a confirmed player cancels (or an admin removes them) on a game that was full,
// and nobody's on the waitlist to take the spot (cancelPapawisSignup already promotes the
// first waitlisted player when there is one). Regulars get it first; non-regulars who viewed
// this game's player list get it SLOT_ALERT_GROUP2_DELAY_MS later, only if a slot is still
// open. Several cancellations close together share one alert.
//
// Nobody without a valid email (well-formed, not bounced) is reached at all. Everyone else
// gets a bell notification; email skips anyone who opted out. A player with an
// unpaid finished game gets a "settle first" line, and one on probation a "deposit needed"
// line, since both would otherwise hit a wall when they try to join.
//
// Scheduled sends (delayed announcements, slot alerts) only run on the production server.
// Slot alerts also need the papawis_slot_alerts_enabled setting (off by default).
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  getSetting, setSetting, getPapawisGame, getPapawisConfirmedCount, getPapawisWaitlistCount,
  getFrequentPapawisPlayers, getPapawisRosterViewerIds, getPapawisCancelledPlayerIds, isPlayerListedForPapawis,
  getRegistration, getUnpaidPapawisForPlayer, papawisProbationHold,
  logPapawisActivity, createNotification,
  requestPapawisAnnounce, claimPapawisAnnounce, finishPapawisAnnounce, getDuePapawisAnnouncements,
  getLatestPapawisSlotAlert, insertPapawisSlotAlert, getDuePapawisSlotAlerts,
  claimPapawisSlotGroup1, finishPapawisSlotGroup1, claimPapawisSlotGroup2, finishPapawisSlotGroup2,
} from './portal-db.js';
import { selectBroadcastRecipients } from './broadcast-recipients.js';
import { sendMail, papawisAnnouncementEmail, papawisSlotOpenEmail } from './mailer.js';
import { formatTimeRange, manilaTodayStr, papawisSignupOpensAtMs } from '../views/utils.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');

// "Regulars": confirmed in REGULAR_MIN_GAMES of the last REGULAR_WINDOW non-cancelled games,
// the same definition as the admin's Autofill and Activity page.
export const REGULAR_WINDOW = 10;
export const REGULAR_MIN_GAMES = 5;
// Wait this long after the first cancellation before alerting, so near-simultaneous
// cancellations go out as one "2 slots opened" email.
export const SLOT_ALERT_DEBOUNCE_MS = 2 * 60 * 1000;
export const SLOT_ALERT_GROUP2_DELAY_MS = 30 * 60 * 1000;
// After an alert goes out, further cancellations on the same game within this window don't
// start a new one (group 2, if still pending, reports the up-to-date slot count anyway).
export const SLOT_ALERT_COOLDOWN_MS = 3 * 60 * 60 * 1000;

export function papawisBroadcastState() {
  return {
    production: process.env.NODE_ENV === 'production',
    slotAlertsEnabled: getSetting('papawis_slot_alerts_enabled', '0') === '1',
  };
}

// ── Unsubscribe links ────────────────────────────────────────────────────────
// Signed with a secret kept in site_settings (created on first use), so links keep working
// across restarts and deploys without depending on any env var being set.
function linkSecret() {
  let secret = getSetting('email_link_secret', '');
  if (!secret) { secret = randomBytes(32).toString('hex'); setSetting('email_link_secret', secret); }
  return secret;
}
function unsubscribeToken(regId) {
  return createHmac('sha256', linkSecret()).update(`papawis-unsub:${regId}`).digest('hex').slice(0, 32);
}
export function papawisUnsubscribeUrl(regId) {
  return `${LIVE_URL}/papawis/emails/unsubscribe?r=${encodeURIComponent(regId)}&t=${unsubscribeToken(regId)}`;
}
export function verifyPapawisUnsubscribe(regId, token) {
  if (!regId || !token || !getRegistration(regId)) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(unsubscribeToken(regId));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Recipients ───────────────────────────────────────────────────────────────

function fmtShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function gameLine(game) {
  const date = new Date(game.date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return [date, formatTimeRange(game.start_time, game.end_time) || game.time_label, game.location].filter(Boolean).join(' · ');
}
const gameUrl = game => `${LIVE_URL}/papawis#pw-game-${game.id}`;

function settleLineFor(playerId) {
  const unpaid = getUnpaidPapawisForPlayer(playerId);
  if (!unpaid.length) return '';
  const total = unpaid.reduce((n, u) => n + (Number(u.price_per_player) || 0), 0);
  const dates = [...new Set(unpaid.map(u => fmtShortDate(u.game_date)))];
  const from = dates.length > 2 ? `${dates.length} games` : dates.join(' and ');
  return `${total ? `You have ₱${total.toLocaleString()} unpaid` : 'You have an unpaid Papawis game'} from ${from}. Settle it first, then you can join.`;
}
function depositLineFor(playerId) {
  const { hold, minDeposit } = papawisProbationHold(playerId);
  if (!hold) return '';
  return `Your spot will be held until an admin confirms a ${minDeposit ? `₱${Number(minDeposit).toLocaleString()} ` : ''}deposit. Send it early so you don't lose the slot.`;
}

// Who gets this game's broadcast from a list of player ids: the shared account gates in
// lib/broadcast-recipients.js (valid email first, then active + approved, bell-only for
// opt-outs, spam reports and shared inboxes), plus Papawis's own rules: not already on
// the roster, and (for slot alerts) not someone who cancelled this game.
function recipientsFor(game, playerIds, { excludeCancelled = false } = {}) {
  const cancelled = new Set(excludeCancelled ? getPapawisCancelledPlayerIds(game.id) : []);
  const { recipients, skipped } = selectBroadcastRecipients(playerIds, {
    optOutColumn: 'papawis_email_optout',
    exclude: playerId => cancelled.has(playerId) || isPlayerListedForPapawis(game.id, playerId),
  });
  return {
    skipped,
    recipients: recipients.map(r => ({
      ...r,
      optedOut: !r.emailable,
      settleLine: settleLineFor(r.player.id),
      depositLine: depositLineFor(r.player.id),
    })),
  };
}

const regularIds = () => getFrequentPapawisPlayers(REGULAR_WINDOW, REGULAR_MIN_GAMES).map(r => r.player_id);
const viewerNonRegularIds = gameId => {
  const regulars = new Set(regularIds());
  return getPapawisRosterViewerIds(gameId).filter(id => !regulars.has(id));
};

// For the admin game page: who an announcement would reach right now.
export function papawisAnnouncementPreview(game) {
  const { recipients: list, skipped } = recipientsFor(game, regularIds());
  return {
    total: list.length,
    emailable: list.filter(r => !r.optedOut).length,
    optedOut: list.filter(r => r.optedOut).length,
    noValidEmail: skipped.noValidEmail,
    bounced: skipped.bounced,
    dormant: skipped.dormant + skipped.linkExpired,
    settle: list.filter(r => r.settleLine).length,
    deposit: list.filter(r => r.depositLine).length,
  };
}

// ── Sending ──────────────────────────────────────────────────────────────────

async function deliver(game, recipients, { kind, openSlots = 0, group = '' }) {
  let emailed = 0;
  const title = game.title || 'Papawis';
  const line = gameLine(game);
  for (const r of recipients) {
    const bell = kind === 'announce'
      ? { title: `New Papawis: ${title}`, body: `${line} · sign-ups are open` }
      : { title: `${openSlots > 1 ? `${openSlots} slots` : 'A slot'} opened: ${title}`, body: line };
    createNotification({ playerId: r.player.id, type: kind === 'announce' ? 'papawis_announced' : 'papawis_slot_open', ...bell, link: `/papawis#pw-game-${game.id}` });

    let note = group;
    if (!r.optedOut) {
      const unsubscribeUrl = papawisUnsubscribeUrl(r.reg.id);
      const common = {
        name: r.player.name, gameTitle: title, gameLine: line, url: gameUrl(game),
        settleLine: r.settleLine, settleUrl: `${LIVE_URL}/settle-balance`, depositLine: r.depositLine, unsubscribeUrl,
      };
      const email = kind === 'announce'
        ? papawisAnnouncementEmail({ ...common, maxSlots: game.max_slots })
        : papawisSlotOpenEmail({ ...common, openSlots });
      try {
        // sendMail returns nothing when email isn't configured; count only real sends.
        const ok = await sendMail({
          to: r.email, ...email, kind: kind === 'announce' ? 'papawis_announce' : 'papawis_slot', ref: game.id,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        if (ok) emailed++;
        note = [group, ok ? '' : 'email not configured', r.settleLine ? 'settle-first line' : '', r.depositLine ? 'deposit line' : ''].filter(Boolean).join(', ');
      } catch (e) {
        note = [group, `email failed: ${e.message}`].filter(Boolean).join(', ');
      }
    } else {
      note = [group, `bell only, ${r.bellOnly}`].filter(Boolean).join(', ');
    }
    logPapawisActivity({
      gameId: game.id, eventType: kind === 'announce' ? 'announced' : 'slot_alerted',
      playerId: r.player.id, playerName: r.player.name, notes: note,
    });
  }
  return emailed;
}

function canBroadcast(game, { requireFuture }) {
  if (!game || game.status !== 'open' || game.signups_locked_at) return false;
  const today = manilaTodayStr();
  return requireFuture ? game.date > today : game.date >= today;
}

// Admin pressed "Announce to players". Sends now (any environment, since an admin chose
// to) unless sign-ups open later, in which case it's queued for the 8 AM open and the
// production job sends it then.
export async function announcePapawisGame(gameId) {
  const game = getPapawisGame(gameId);
  if (!canBroadcast(game, { requireFuture: false })) return { error: 'This game can\'t be announced (closed, locked or already played).' };
  const opensAt = papawisSignupOpensAtMs(game);
  const sendAt = opensAt && opensAt > Date.now() ? opensAt : Date.now();
  requestPapawisAnnounce(game.id, sendAt);
  if (sendAt > Date.now()) return { scheduled: sendAt };
  return { sent: await runAnnouncement(getPapawisGame(game.id)) };
}

async function runAnnouncement(game) {
  if (!canBroadcast(game, { requireFuture: false })) return 0;
  if (!claimPapawisAnnounce(game.id)) return 0;
  const emailed = await deliver(game, recipientsFor(game, regularIds()).recipients, { kind: 'announce' });
  finishPapawisAnnounce(game.id, emailed);
  return emailed;
}

function openSlotsFor(game) {
  if (getPapawisWaitlistCount(game.id) > 0) return 0;
  return Math.max(0, (game.max_slots || 0) - getPapawisConfirmedCount(game.id));
}

// Called after a confirmed player leaves a game (player cancel or admin removal). wasFull:
// the game was full just before they left. Queues (or folds into) a slot alert.
export function queuePapawisSlotAlert(gameId, { wasFull }) {
  if (!wasFull || !papawisBroadcastState().slotAlertsEnabled) return null;
  const game = getPapawisGame(gameId);
  if (!canBroadcast(game, { requireFuture: true }) || openSlotsFor(game) <= 0) return null;
  const latest = getLatestPapawisSlotAlert(game.id);
  // One combined alert: an alert still waiting to send already covers this cancellation,
  // and one sent recently is still in its cooldown.
  if (latest && (!latest.group1_sent_at || Date.now() - latest.group1_sent_at < SLOT_ALERT_COOLDOWN_MS)) return latest.id;
  return insertPapawisSlotAlert(game.id, Date.now() + SLOT_ALERT_DEBOUNCE_MS);
}

async function runSlotAlert(alert) {
  const game = getPapawisGame(alert.game_id);
  const stillOpen = canBroadcast(game, { requireFuture: true }) ? openSlotsFor(game) : 0;
  if (!alert.group1_sent_at) {
    if (!claimPapawisSlotGroup1(alert.id)) return;
    if (stillOpen <= 0) { finishPapawisSlotGroup1(alert.id, -1, 0, null); return; }
    const emailed = await deliver(game, recipientsFor(game, regularIds(), { excludeCancelled: true }).recipients, { kind: 'slot', openSlots: stillOpen, group: 'regulars' });
    finishPapawisSlotGroup1(alert.id, emailed, stillOpen, Date.now() + SLOT_ALERT_GROUP2_DELAY_MS);
    return;
  }
  if (!claimPapawisSlotGroup2(alert.id)) return;
  if (stillOpen <= 0) { finishPapawisSlotGroup2(alert.id, -1); return; }
  const emailed = await deliver(game, recipientsFor(game, viewerNonRegularIds(game.id), { excludeCancelled: true }).recipients, { kind: 'slot', openSlots: stillOpen, group: 'viewed the player list' });
  finishPapawisSlotGroup2(alert.id, emailed);
}

// Runs every minute from server.js: scheduled announcements and due slot-alert groups.
let running = false;
export async function runPapawisBroadcasts() {
  const state = papawisBroadcastState();
  if (!state.production || running) return { announced: 0, alerts: 0 };
  running = true;
  let announced = 0, alerts = 0;
  try {
    for (const game of getDuePapawisAnnouncements()) { await runAnnouncement(game); announced++; }
    if (state.slotAlertsEnabled) {
      for (const alert of getDuePapawisSlotAlerts()) { await runSlotAlert(alert); alerts++; }
    }
  } finally {
    running = false;
  }
  return { announced, alerts };
}
