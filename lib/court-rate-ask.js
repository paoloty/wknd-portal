// "How was the court?" after a game: a bell notification plus a short email with five
// tap-to-rate stars (lib/mailer.js courtRateEmail). Called when a Papawis run is closed out
// (lib/papawis-notify.js, where players who owe money get the stars inside their tab email
// instead) and when a league game at a court goes final (server.js).
// Only with court ratings on, only for a court with a visible page, once per player per
// court (court_rate_asks), never to someone who has already rated it. Emails follow the
// broadcast rules (checkActivePlayer: a valid, unbounced email and a recent login) and the
// player's Papawis or league email opt-out; the bell notification goes either way.
import {
  getSetting, getMyCourtRating, wasAskedToRateCourt, markAskedToRateCourt, createNotification, checkActivePlayer,
} from './portal-db.js';
import { sendMail, courtRateEmail } from './mailer.js';
import { courtDisplayName } from './court-page.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');

export function courtRatingsOn() { return getSetting('papawis_court_ratings_enabled', '0') === '1'; }
export function courtRateLink(court) { return `${LIVE_URL}/courts/${encodeURIComponent(court.slug)}`; }
// Who still needs asking at this court.
export function shouldAskToRate(court, playerId) {
  return !!(court?.slug && !court.page_hidden && playerId && courtRatingsOn()
    && !getMyCourtRating(court.id, playerId) && !wasAskedToRateCourt(court.id, playerId));
}

// playerIds: everyone who played. alreadyEmailed: ids whose email already carried the stars
// (the Papawis tab email); they get the bell only. ref: the run or game id, for the log.
// kind: 'papawis' | 'league'. gameLine: shown in the email ("Sat, Oct 17 · 6:00–8:00 AM").
export async function askToRateCourt({ court, playerIds, kind = 'papawis', gameLine = '', ref = '', alreadyEmailed = new Set() }) {
  if (!court?.slug || court.page_hidden || !courtRatingsOn()) return { asked: 0, emailed: 0 };
  const name = courtDisplayName(court);
  const url = courtRateLink(court);
  let asked = 0, emailed = 0;
  for (const pid of new Set(playerIds)) {
    if (!pid || getMyCourtRating(court.id, pid)) continue;
    if (!markAskedToRateCourt(court.id, pid, ref)) continue; // asked before
    asked++;
    createNotification({ playerId: pid, type: 'court_rate', title: `How was ${name}?`, body: 'Tap to rate the court. It takes a second.', link: `/courts/${encodeURIComponent(court.slug)}#crt-rate` });
    if (alreadyEmailed.has(pid)) continue;
    const check = checkActivePlayer(pid);
    if (!check.ok) continue;
    if (check.reg?.[kind === 'league' ? 'league_email_optout' : 'papawis_email_optout']) continue;
    try {
      await sendMail({ to: check.email, ref: pid, ...courtRateEmail({ name: check.player?.name || '', courtName: name, url, gameLine, kind }) });
      emailed++;
    } catch (e) { console.error('[court rate ask]', e.message); }
  }
  return { asked, emailed };
}
