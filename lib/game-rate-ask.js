// "Rate your game" (docs/plans/ratings-and-raffle.md, Phase 1): who played a game, the rating
// window, the signed one-tap email links, and the post-game ask (a bell for everyone who
// played, plus one email). Called when a Papawis run is closed out (lib/papawis-notify.js,
// where players who owe money get the rating block inside their tab email) and when a
// league game goes final (server.js askLeagueCourtRatings). With game ratings off, the
// older court-only ask (lib/court-rate-ask.js) runs instead.
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import {
  getSetting, setSetting, getPapawisGame, getPapawisSignups, getGameById, getLeagueAppearancesForGames,
  getPapawisCourtById, findCourtForLocation, getMyCourtRating, getPlayerById, createNotification,
  checkActivePlayer, markGameRateAsked, markGameRateEmailed, getFirstGameAskAt,
} from './portal-db.js';
import { sendMail, gameRateBlock, gameRateEmail } from './mailer.js';
import { courtDisplayName } from './court-page.js';
import { RATE_WINDOW_DAYS } from './game-ratings.js';
import { raffleOn, ensureRateAndWin, getOpenRound, ticketsFor } from './raffle.js';
import { formatTimeRange, displayPlayerName } from '../views/utils.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');
const DAY = 86400000;
export const RATE_KINDS = ['papawis', 'league'];

export const gameRatingsOn = () => getSetting('game_ratings_enabled', '0') === '1';
export const gameRateEmailOn = () => getSetting('game_rate_email_enabled', '1') === '1';
const courtRatingsOn = () => getSetting('papawis_court_ratings_enabled', '0') === '1';
// How long a court rating counts as fresh: within it the court isn't asked about again.
export const courtReaskDays = () => Math.max(1, Number(getSetting('game_rate_court_reask_days', '30')) || 30);

const ymdLabel = ymd => ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// A game players can rate, or null: { kind, ref, title, line, ymd, court, playerIds, windowEndsAt, open }.
// Papawis: a completed run; its players are the confirmed signups (guests ride on their
// sponsor's account and don't count). League: a published game with a score; its players
// are the box score. court: the court with a visible page, only with court ratings on.
export function resolveRateGame(kind, ref) {
  let g, title, line, ymd, court = null, playerIds = [];
  if (kind === 'papawis') {
    g = getPapawisGame(ref);
    if (!g || g.status !== 'completed') return null;
    ymd = String(g.date).slice(0, 10);
    title = g.title || 'Papawis run';
    line = [ymdLabel(ymd), formatTimeRange(g.start_time, g.end_time), g.location].filter(Boolean).join(' · ');
    playerIds = getPapawisSignups(g.id).filter(s => s.status === 'confirmed' && !s.guest_name && s.player_id).map(s => s.player_id);
    court = findCourtForLocation(g.location);
  } else if (kind === 'league') {
    g = getGameById(ref);
    const a = Number(g?.team_a_score), b = Number(g?.team_b_score);
    if (!g || g.under_review || !(a + b > 0)) return null;
    ymd = String(g.date).slice(0, 10);
    title = a >= b ? `${titleCase(g.team_a_name)} ${a}–${b} ${titleCase(g.team_b_name)}` : `${titleCase(g.team_b_name)} ${b}–${a} ${titleCase(g.team_a_name)}`;
    line = ymdLabel(ymd);
    playerIds = getLeagueAppearancesForGames([g.id]).map(r => r.player_id);
    court = g.court_id ? getPapawisCourtById(g.court_id) : null;
  } else return null;
  if (court && (court.page_hidden || !court.slug || !courtRatingsOn())) court = null;
  playerIds = [...new Set(playerIds.filter(Boolean))];
  // Open through the end of the game day + RATE_WINDOW_DAYS (Manila), or that long after the
  // first ask when the close-out or box score came in late.
  const gameEnd = Date.parse(`${ymd}T23:59:59+08:00`) || 0;
  const firstAsk = getFirstGameAskAt(kind, ref);
  const windowEndsAt = Math.max(gameEnd, firstAsk) + RATE_WINDOW_DAYS * DAY;
  return { kind, ref: String(ref), title, line, ymd, court, courtName: court ? courtDisplayName(court) : '', playerIds, windowEndsAt, open: Date.now() <= windowEndsAt };
}

// Whether a player's court rating still counts as fresh (so the ask leaves the court out).
export function courtRatingFresh(courtId, playerId) {
  const r = getMyCourtRating(courtId, playerId);
  return !!r && r.updated_at >= Date.now() - courtReaskDays() * DAY;
}

// ── Signed one-tap links ─────────────────────────────────────────────────────────
// The token binds one player to one game; it works while that game's rating window is open,
// and only for the Rate your game page (no general login). Same secret as the other email links.
function linkSecret() {
  let secret = getSetting('email_link_secret', '');
  if (!secret) { secret = randomBytes(32).toString('hex'); setSetting('email_link_secret', secret); }
  return secret;
}
const sign = s => createHmac('sha256', linkSecret()).update(s).digest('hex').slice(0, 32);
export const rateToken = (kind, ref, playerId) => sign(`game-rate:${kind}:${ref}:${playerId}`);
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };
export const verifyRateToken = (kind, ref, playerId, token) => !!playerId && same(token, rateToken(kind, ref, playerId));
export function rateLink(kind, ref, playerId, extra = '') {
  const player = getPlayerById(playerId);
  const base = `${LIVE_URL}/rate/${kind}/${encodeURIComponent(ref)}`;
  if (player?.rate_links_off) return `${base}${extra ? `?${extra}` : ''}`;
  return `${base}?u=${encodeURIComponent(playerId)}&t=${rateToken(kind, ref, playerId)}${extra ? `&${extra}` : ''}`;
}
// Rating-email unsubscribe (registrations.rating_email_optout).
const unsubToken = regId => sign(`rate-unsub:${regId}`);
export const ratingUnsubscribeUrl = regId => `${LIVE_URL}/emails/rating-unsubscribe?r=${encodeURIComponent(regId)}&t=${unsubToken(regId)}`;
export const verifyRatingUnsubscribe = (regId, token) => same(token, unsubToken(String(regId || '')));

// Who can get the email. The usual broadcast rules (checkActivePlayer), except that someone
// who just played counts as active even if they haven't logged in lately or their
// set-password link lapsed: the signed link gets them to the page without a login.
function emailable(playerId) {
  const check = checkActivePlayer(playerId);
  if (check.ok || check.reason === 'dormant' || check.reason === 'link_expired') {
    if (check.reg?.rating_email_optout) return null;
    return check;
  }
  return null;
}

// The rating block for one player's email (tab email or stand-alone). null when there's
// nothing to ask them (no other players and the court is fresh or absent).
export function rateBlockFor(game, playerId) {
  const others = game.playerIds.filter(id => id !== playerId);
  const askCourt = game.court && !courtRatingFresh(game.court.id, playerId);
  if (!others.length && !askCourt) return null;
  const shown = others.slice(0, 6).map(id => {
    const p = getPlayerById(id);
    return { name: displayPlayerName(p?.name || ''), photoUrl: `${LIVE_URL}/api/player/${encodeURIComponent(id)}/photo?w=96`, answerUrl: a => rateLink(game.kind, game.ref, playerId, `p=${encodeURIComponent(id)}&a=${a}`) };
  });
  return gameRateBlock({
    court: askCourt ? { name: game.courtName, starUrl: n => rateLink(game.kind, game.ref, playerId, `stars=${n}`) } : null,
    players: shown, more: others.length - shown.length, pageUrl: rateLink(game.kind, game.ref, playerId),
    ticketLine: ticketLineFor(playerId), ticketUrl: raffleOn() ? `${LIVE_URL}/raffle#rf-how` : '',
  });
}

// Rate & Win line in the email: finishing this game is a ticket.
function ticketLineFor(playerId) {
  if (!raffleOn()) return '';
  const round = getOpenRound(ensureRateAndWin().id);
  const n = round ? ticketsFor(round.id, playerId) : 0;
  return `Rate everyone for +1 raffle ticket: a free Papawis run is drawn every other Sunday.${n ? ` You have ${n} this round.` : ''}`;
}

// The ask: a bell for everyone who played (once per game), and an email unless
// `alreadyEmailed` has them (their tab email carried the block) or emails are off for them.
export async function askToRateGame({ kind, ref, alreadyEmailed = new Set() }) {
  const game = resolveRateGame(kind, ref);
  if (!game || !gameRatingsOn()) return { asked: 0, emailed: 0 };
  let asked = 0, emailed = 0;
  for (const pid of game.playerIds) {
    if (!markGameRateAsked(kind, game.ref, pid)) continue; // asked before
    asked++;
    createNotification({ playerId: pid, type: 'game_rate', title: `Rate ${game.title}`, body: 'The court and the players you ran with. Takes a few seconds.', link: `/rate/${kind}/${encodeURIComponent(game.ref)}` });
    if (alreadyEmailed.has(pid)) { markGameRateEmailed(kind, game.ref, pid); continue; }
    if (!gameRateEmailOn()) continue;
    const check = emailable(pid);
    if (!check) continue;
    const blockHtml = rateBlockFor(game, pid);
    if (!blockHtml) continue;
    try {
      await sendMail({ to: check.email, ref: pid, ...gameRateEmail({ name: check.player?.name || '', title: game.title, gameLine: game.line, kind, blockHtml, unsubscribeUrl: ratingUnsubscribeUrl(check.reg.id) }) });
      markGameRateEmailed(kind, game.ref, pid);
      emailed++;
    } catch (e) { console.error('[game rate ask]', e.message); }
  }
  return { asked, emailed };
}

// For the Papawis tab email: the block for this player if they'd be emailed at all, else ''.
export function tabRateHtml(game, playerId) {
  if (!game || !gameRatingsOn() || !gameRateEmailOn() || !emailable(playerId)) return '';
  return rateBlockFor(game, playerId) || '';
}
