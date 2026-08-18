import {
  getPapawisSignupsDueForReminder, markPapawisReminderSent, getPapawisSignups,
  getPapawisConfirmedCount, getPapawisSignupsWithEmail, getNextOpenPapawisGame, getPapawisGame,
  logPapawisActivity, createNotification, getPapawisSignupWithEmail, markPapawisTeamNotified,
  getPapawisCourtByName,
} from './portal-db.js';
import {
  sendMail, papawisConfirmedTeamEmail, papawisConfirmedEmail, papawisWaitlistEmail, papawisCancelledEmail,
  papawisCompletedEmail,
} from './mailer.js';
import { displayPlayerName, formatTimeRange, papawisSignupOpensAtMs } from '../views/utils.js';
import { estimatedPapawisPrice } from '../views/admin/papawis.js';

function fmtDate(dateStr) {
  return dateStr
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';
}

function gameLine(game) {
  const time = formatTimeRange(game.start_time, game.end_time);
  return [fmtDate(game.date), time, game.location].filter(Boolean).join(' · ');
}

// Same convention as the DB export link (server.js) — LIVE_URL is the deployed site's
// own base URL, not the admin app's. Deep-links to a game's card via the id="pw-game-{id}"
// anchor on /papawis (views/papawis.js) rather than a dedicated per-game route, since the
// public page has always listed every game on one page instead of per-game URLs.
const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');
function gameUrl(gameId) { return `${LIVE_URL}/papawis#pw-game-${gameId}`; }

function nextGameLines(afterDate, excludeGameId) {
  const next = getNextOpenPapawisGame(afterDate, excludeGameId);
  if (!next) return { nextGameLine: '', nextGameOpensLine: '', nextGameUrl: '' };
  const opensAt = papawisSignupOpensAtMs(next);
  return {
    nextGameLine: `${next.title || 'Papawis'} — ${gameLine(next)}`,
    nextGameOpensLine: opensAt
      ? `Signups open ${new Date(opensAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at 8:00 AM.`
      : 'Signups are already open.',
    nextGameUrl: gameUrl(next.id),
  };
}

// Names shown to a confirmed player: teammates (or whole roster, pre-teams) including
// guests, since a sponsor's guest is a real body on the court even without their own
// account/email. Excludes the recipient themselves — nobody needs their own name in
// "who's playing".
function rosterNames(signups, { team = null, excludeSignupId = '' } = {}) {
  return signups
    .filter(s => s.status === 'confirmed' && s.id !== excludeSignupId && (team === null || s.team === team))
    .map(s => s.guest_name || displayPlayerName(s.player_name));
}

// Scans for confirmed/waitlist signups whose reminder hasn't gone out yet and whose game
// falls inside the reminder window (see getPapawisSignupsDueForReminder). Safe to call
// repeatedly/concurrently-ish — each signup is stamped right after its own email send, so
// a slow run overlapping the next tick just re-scans a shorter list.
export async function sendPapawisReminders(reminderDays) {
  const due = getPapawisSignupsDueForReminder(reminderDays);
  const rosterCache = new Map(); // game_id -> full signups list, fetched once per game
  const gameCache = new Map();   // game_id -> game row, fetched once per game (for a saved estimate, if any)
  let sent = 0;
  const errors = [];
  for (const signup of due) {
    if (!signup.player_email) { markPapawisReminderSent(signup.id); continue; }
    try {
      if (!rosterCache.has(signup.game_id)) rosterCache.set(signup.game_id, getPapawisSignups(signup.game_id));
      if (!gameCache.has(signup.game_id)) gameCache.set(signup.game_id, getPapawisGame(signup.game_id));
      const allSignups = rosterCache.get(signup.game_id);
      const line = gameLine(signup);
      const game = gameCache.get(signup.game_id);
      const courtRateFallback = game?.court_rate_per_hour ? null : getPapawisCourtByName(game?.location)?.price_per_hour || null;
      const price = estimatedPapawisPrice(game, getPapawisConfirmedCount(signup.game_id), courtRateFallback);
      const priceLine = price
        ? `Fee: ~₱${price}+ (estimate based on current headcount — final amount confirmed after the game)`
        : 'Fee: TBD — final amount confirmed after the game.';

      let email, logNote;
      if (signup.status === 'waitlist') {
        const { nextGameLine, nextGameOpensLine, nextGameUrl } = nextGameLines(signup.game_date, signup.game_id);
        const waitlistPosition = allSignups.filter(s => s.status === 'waitlist').findIndex(s => s.id === signup.id) + 1;
        email = papawisWaitlistEmail({
          name: signup.player_name, gameTitle: signup.game_title || 'Papawis', gameLine: line,
          waitlistPosition: waitlistPosition || null, url: gameUrl(signup.game_id), nextGameLine, nextGameOpensLine, nextGameUrl,
        });
        logNote = `waitlist${waitlistPosition ? ` #${waitlistPosition}` : ''}`;
      } else if (signup.team) {
        email = papawisConfirmedTeamEmail({
          name: signup.player_name, gameTitle: signup.game_title || 'Papawis', gameLine: line, priceLine,
          teamLabel: signup.team === 'dark' ? 'Dark' : 'Light',
          teamRoster: rosterNames(allSignups, { team: signup.team, excludeSignupId: signup.id }),
          url: gameUrl(signup.game_id),
        });
        logNote = `confirmed — Team ${signup.team === 'dark' ? 'Dark' : 'Light'}`;
      } else {
        email = papawisConfirmedEmail({
          name: signup.player_name, gameTitle: signup.game_title || 'Papawis', gameLine: line, priceLine,
          confirmedRoster: rosterNames(allSignups, { excludeSignupId: signup.id }),
          url: gameUrl(signup.game_id),
        });
        logNote = 'confirmed — no team yet';
      }
      await sendMail({ to: signup.player_email, ...email });
      markPapawisReminderSent(signup.id);
      logPapawisActivity({ gameId: signup.game_id, eventType: 'reminded', playerId: signup.player_id, playerName: signup.player_name, notes: logNote });
      createNotification({
        playerId: signup.player_id,
        type: 'papawis_reminder',
        title: signup.status === 'waitlist'
          ? `You're on the waitlist for ${signup.game_title || 'Papawis'}`
          : `You're confirmed for ${signup.game_title || 'Papawis'}`,
        body: line,
        link: `/papawis#pw-game-${signup.game_id}`,
      });
      sent++;
    } catch (e) {
      errors.push({ signupId: signup.id, error: e.message });
    }
  }
  return { sent, errors };
}

// Manual, admin-triggered, exactly-once catch-up email for the gap the automatic reminder
// can't cover: it already went out with no team (signup.team was still '' when the scan
// ran), a team got arranged afterward, and nothing re-scans an already-reminded signup —
// see team_notified_at's comment in lib/portal-db.js. Guarded by team_notified_at both here
// (skip the send entirely if already sent) and at the DB layer (markPapawisTeamNotified's
// UPDATE only flips on a NULL row), so a double-click can send twice at worst only if both
// requests race past this pre-check in the same instant — the follow-up admin-btn disable
// on click (views/admin/papawis.js) is what actually prevents that in practice.
export async function sendPapawisTeamAssignedEmail(signupId) {
  const signup = getPapawisSignupWithEmail(signupId);
  if (!signup || signup.status !== 'confirmed' || !signup.team || signup.team_notified_at) {
    return { error: 'not_eligible' };
  }
  if (!signup.player_email) return { error: 'no_email' };
  const game = getPapawisGame(signup.game_id);
  if (!game) return { error: 'not_eligible' };

  const allSignups = getPapawisSignups(signup.game_id);
  const line = gameLine({ date: game.date, start_time: game.start_time, end_time: game.end_time, location: game.location });
  const courtRateFallback = game.court_rate_per_hour ? null : getPapawisCourtByName(game.location)?.price_per_hour || null;
  const price = estimatedPapawisPrice(game, getPapawisConfirmedCount(signup.game_id), courtRateFallback);
  const priceLine = price
    ? `Fee: ~₱${price}+ (estimate based on current headcount — final amount confirmed after the game)`
    : 'Fee: TBD — final amount confirmed after the game.';
  const teamLabel = signup.team === 'dark' ? 'Dark' : 'Light';

  await sendMail({
    to: signup.player_email,
    ...papawisConfirmedTeamEmail({
      name: signup.player_name, gameTitle: game.title || 'Papawis', gameLine: line, priceLine,
      teamLabel, teamRoster: rosterNames(allSignups, { team: signup.team, excludeSignupId: signup.id }),
      url: gameUrl(signup.game_id),
    }),
  });
  markPapawisTeamNotified(signup.id);
  logPapawisActivity({ gameId: signup.game_id, eventType: 'team_notified', playerId: signup.player_id, playerName: signup.player_name, notes: `Team ${teamLabel}` });
  createNotification({
    playerId: signup.player_id,
    type: 'papawis_team_assigned',
    title: `You're on Team ${teamLabel} for ${game.title || 'Papawis'}`,
    body: line,
    link: `/papawis#pw-game-${signup.game_id}`,
  });
  return { ok: true };
}

// Fires once, immediately, on cancel — not part of the reminder scan, so it isn't gated
// by reminder_sent_at (a cancelled game's signups may or may not have already been
// reminded; either way everyone still confirmed/waitlisted needs to hear it cancelled).
export async function sendPapawisCancellationEmails(gameId) {
  const game = getPapawisGame(gameId);
  if (!game) return { sent: 0, errors: [] };
  const recipients = getPapawisSignupsWithEmail(gameId);
  const { nextGameLine, nextGameOpensLine, nextGameUrl } = nextGameLines(game.date, gameId);
  const line = gameLine(game);
  let sent = 0;
  const errors = [];
  for (const signup of recipients) {
    if (!signup.player_email) continue;
    try {
      await sendMail({
        to: signup.player_email,
        ...papawisCancelledEmail({ name: signup.player_name, gameTitle: game.title || 'Papawis', gameLine: line, nextGameLine, nextGameOpensLine, nextGameUrl }),
      });
      logPapawisActivity({ gameId, eventType: 'cancel_notified', playerId: signup.player_id, playerName: signup.player_name, notes: signup.status === 'waitlist' ? 'was waitlisted' : 'was confirmed' });
      createNotification({
        playerId: signup.player_id,
        type: 'papawis_cancelled',
        title: `${game.title || 'Papawis'} was cancelled`,
        body: line,
        link: '/papawis',
      });
      sent++;
    } catch (e) {
      errors.push({ signupId: signup.id, error: e.message });
    }
  }
  return { sent, errors };
}

// Fires when an admin marks a game complete, or later on demand via "Send payment emails" —
// same "who to email" list as cancellation (real signups only, guest_name = ''). The amount
// is a per-player total of what they still OWE, not a flat re-statement of the charge: a
// sponsor who also brought a guest gets charged once per slot (lib/portal-db.js
// recordTransaction, called once per signup row), so this sums both — and any slot already
// marked paid (see the /signups/:signupId/paid route) is excluded from that sum. A player
// whose every slot for this game is already paid gets no email at all; someone who paid for
// themselves but not a guest they sponsored gets emailed for just the guest's share.
export async function sendPapawisCompletionEmails(gameId, pricePerPlayer) {
  const game = getPapawisGame(gameId);
  if (!game) return { sent: 0, errors: [] };
  const price = Number(pricePerPlayer) || 0;
  if (!price) return { sent: 0, errors: [] };

  const allConfirmed = getPapawisSignups(gameId).filter(s => s.status === 'confirmed');
  const unpaidTotalsByPlayer = {};
  for (const s of allConfirmed) {
    if (s.paid_at) continue;
    unpaidTotalsByPlayer[s.player_id] = (unpaidTotalsByPlayer[s.player_id] || 0) + price;
  }

  const recipients = getPapawisSignupsWithEmail(gameId).filter(s => s.status === 'confirmed');
  const line = gameLine(game);
  const settleUrl = `${LIVE_URL}/settle-balance`;
  let sent = 0;
  const errors = [];
  for (const signup of recipients) {
    const amount = unpaidTotalsByPlayer[signup.player_id];
    if (!signup.player_email || !amount) continue;
    try {
      await sendMail({
        to: signup.player_email,
        ...papawisCompletedEmail({ name: signup.player_name, gameTitle: game.title || 'Papawis', gameLine: line, amount, url: settleUrl }),
      });
      logPapawisActivity({ gameId, eventType: 'completion_notified', playerId: signup.player_id, playerName: signup.player_name, notes: `charged ₱${amount}` });
      createNotification({
        playerId: signup.player_id,
        type: 'papawis_completed',
        title: `${game.title || 'Papawis'} is done — you're in for ₱${amount}`,
        body: line,
        link: '/settle-balance',
      });
      sent++;
    } catch (e) {
      errors.push({ signupId: signup.id, error: e.message });
    }
  }
  return { sent, errors };
}
