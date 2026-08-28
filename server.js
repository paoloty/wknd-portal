import 'dotenv/config';
const IS_DEV = process.env.NODE_ENV !== 'production';
import path from 'path';
import os from 'os';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual, createHash, scrypt, scryptSync } from 'crypto';
import { statSync, existsSync, unlinkSync, readFileSync } from 'fs';
import express from 'express';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import CleanCSS from 'clean-css';
import { parseWriteup } from './lib/writeup.js';
import { sendMail, approvedEmail, rejectedEmail, resetPasswordEmail, seasonQualifiedEmail, seasonNotSelectedEmail, paymentSubmittedEmail, jerseyRequestEmail } from './lib/mailer.js';
import { detectBogusFlags } from './lib/registration-flags.js';
import { setPasswordPage, setPasswordDonePage } from './views/set-password.js';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { layout, escHtml } from './views/layout.js';
import { homePage } from './views/home.js';
import { gamesPage } from './views/games.js';
import { highlightsPage } from './views/highlights.js';
import { gamePage } from './views/game.js';
import { leadersPage, PER_GAME, TOTALS, fmtPerGame, fmtTotals, RECORD_CATS, recordContext } from './views/leaders.js';
import { roastPage, ROAST_CATS } from './views/roast.js';
import { standingsPage } from './views/standings.js';
import { playoffsPage, computeSeeds } from './views/playoffs.js';
import { comingSoonPage } from './views/coming-soon.js';
import { leaderSharePage } from './views/leader-share.js';
import { playerPage } from './views/player.js';
import { playersPage } from './views/players.js';
import { scoreTicker } from './views/ticker.js';
import { privacyPage, termsPage } from './views/legal.js';
import { registerPage } from './views/register.js';
import { frontOfficePage } from './views/front-office.js';
import { teamsBody } from './views/teams.js';
import { teamColor, displayPlayerName, manilaTodayStr, initials, signupDisplayName, PAYMENT_CATEGORIES } from './views/utils.js';
import {
  upsertShare, getShare, getSlugForEntity, getEntityForSlug, saveSlug,
  getAllFinancials, getAllTransactions, getAllTransactionsBySeason,
  recordTransaction, confirmTransaction, deleteTransaction, setTransactionCategory,
  getPlayerFinancials, getPlayerTransactions, getPlayerTransactionsBySeason,
  getSeasonBalances, getSeasonSummary, getAllBalances, getAllSummary, getLedgerSeasons, getLastTransactionDates,
  getSeasonQuota, setSeasonQuota, voidTransaction,
  getPendingTransactions, getCategoryTotals, getTeamTotals, getRecentTransactions,
  getAllTeams, getAllPlayers, getAllGames, getGameCover,
  getTeamSeasonStats, getTeamRecords, getTeamRecordsAsOf, getLeaders, getPlayoffLeaders,
  getGameById, getGameDetailStats, getGameStats,
  getPlayerWithTeam, getPlayerById, getTeamById, getPlayersByTeam,
  getPlayerTotals, getPlayerGameLog, getPlayerPotgCandidates,
  getPlayerCareerHighs, getPlayerAwards, getSeasonAwards, getAwardSeasons, getGameDnpPlayers, getGameRecords,
  getPlayerStatsByType,
  upsertAward, deleteAward, clearAwardType, getActivePlayers, getSeasonPlayerStats,
  getPlayerPhoto, getCurrentSeason, getSeasonLatestWeek, getTickerGames, getSeriesRecordForGame,
  getRecentPlayedGames, getScheduledGames, getGamesUnderReviewCount, getActivePlayerCount, getPlayedGamesCount,
  updateGameRecap, updateGameYoutube, updateGameCover, updateGamePotg, updateGameReview, updateGameAll, deleteGame,
  importGameResults, markGameFinal, setGameOvertime, createGame,
  updatePlayerPhoto, updatePlayer,
  getPlayerPhotoOriginal, updatePlayerPhotoOriginal,
  getAwardPhotoOverrides, upsertAwardPhotoOverride, deleteAwardPhotoOverride,
  getAwardPhotoOverridesForPlayer, deleteAwardPhotoOverridesFromSlot,
  getPrevMatchup, getTeamStreak, getPlayerLeagueRank, getPlayerSeasonStats,
  getPlayersWithRatings, getPlayerRating, upsertComputedRating, saveRatingOverrides,
  getStatsBySeason, getOnePlayerStats, upsertPlayerDetails, updatePlayerWriteup,
  getGameSeasons, setPlayerStatus, setPlayerTeam, setPlayerNumber, setPlayerPapawisProbation,
  getCompareCache, setCompareCache, incrementCompareViews, getCompareAnalytics,
  getTeamRatingTotals, getPlayerRecentStats, getPlayerGamePts, getPlayerWinRate, getTotalSeasonGames,
  deleteUnlockedRating,
  getMvpWriteup, setMvpWriteup, deleteMvpWriteupForPlayer, clearMvpWriteupSeason,
  getMvpCandidates, getFinalsMvpCandidates, getTotalSeasonGamesForMvp, getFinalsSeriesResult,
  getSetting, setSetting,
  insertSeasonSignup, getSeasonSignup, getSeasonSignupById, getSeasonSignups, updateSeasonSignupStatus, updateSignupTeamPref, countSeasonSignups, countConfirmedSeasonSignups, withdrawSeasonSignup,
  upsertLivenessCapture, getLivenessCaptureByRegId, getLivenessCaptureById, getAllLivenessCaptures, deleteLivenessCapture,
  updateRegistrationContact,
  insertPlayerAssessment, getPlayerAssessment, getPlayerAssessmentById, getPlayerAssessmentHistory, getAssessmentsBySeason, getLatestPlayerRating,
  upsertAssessmentReview, getAssessmentReviews, getAssessmentReviewsBySeason, deleteAssessmentReview,
  playerPlayedSeason, getPlayerCurrentTeam,
  getSeasonTeams, upsertSeasonTeam, deleteSeasonTeam, clearSeasonTeams,
  getSeasonRoster, saveSeasonRoster, clearSeasonRoster, getSeasonSignupsWithStats, setSeasonSignupJerseyNumber,
  setJerseyRequestToken, getSeasonSignupByJerseyToken, submitJerseyDetails,
  getGameCountsBySeason, getSignupStatsBySeason, getAllSeasonQuotas,
  getPortalCurrentSeason,
  insertRegistration, getAllRegistrations, getRegistration, getRegistrationByEmail, getRegistrationByPlayerId, updateRegistration, relinkRegistrationPlayer, setWaiverAgreement,
  setRegistrationAdminSections, getRegistrationAdminSections,
  setPasswordToken, getRegByPasswordToken, setRegistrationPassword,
  getRegByFacebookId, setFacebookId, clearFacebookId,
  setRegistrationAdmin, insertAdminLog, getAdminLogs, getAdminLogsForUser, updateRegBirthday,
  setRegistrationLastLogin, setRegistrationSensitiveAccess,
  createPlayer, mergeRegistrationIntoPlayer, playerHasActivity, deletePlayer,
  getSeasonStandings, getPlayoffGames,
  getPapawisGames, getPapawisGame, getPapawisSignups, getPapawisActiveSignupForPlayer, isPapawisSignupOpen,
  createPapawisGame, joinPapawisGame, cancelPapawisSignup, promotePapawisPendingSignup, getMaxPapawisPrice,
  getPendingPapawisSignupsForPlayer, getUnconfirmedPapawisDeposit,
  adminAddPapawisSignup, adminRemovePapawisSignup, setPapawisSignupStatus, reorderPapawisSignups,
  completePapawisGame, cancelPapawisGame, deletePapawisGame, savePapawisEstimate, setPapawisGameLocation,
  logPapawisActivity, getPapawisActivityForGame, getAllPapawisActivity, getFrequentPapawisCancellers, getFrequentPapawisPlayers,
  getPapawisGamesForPlayer,
  getPapawisConfirmedForTeams, setPapawisSignupTeam, setPapawisTeams, reorderPapawisTeam,
  lockPapawisSignups, unlockPapawisSignups,
  addPapawisCourt, updatePapawisCourt, setPapawisCourtActive, getAllPapawisCourts, getActivePapawisCourts, getPapawisCourtByName,
  getPapawisCourtById, updatePapawisCourtImage,
  getAllPlayerCareerTotals, getCoachAnalysis, saveCoachAnalysis, getAllCoachAnalyses,
  createPost, updatePost, deletePost, getPostById, getPostBySlug, isPostSlugTaken,
  getAllPostsAdmin, getPublicPosts, getHeadToHeadRecord,
  getSeoOverride, getAllSeoOverrides, upsertSeoOverride, deleteSeoOverride,
  getGameComments, getCommentById, getCommentWithMeta, addGameComment, deleteGameComment,
  toggleCommentReaction, getReactedCommentIdsForPlayer,
  toggleGameReaction, getGameReactionState, getPlayersWithAccounts,
  getGameCommentCounts, getGameReactionCounts, getReactedGameIdsForPlayer,
  getPapawisSignupById, markPapawisSignupPaid, markPapawisSignupUnpaid, getUnlinkedPapawisPayments,
  createNotification, getNotificationsForPlayer, getUnreadNotificationCount, markNotificationsRead,
  getTransactionById,
  addTeamHead, removeTeamHead, getAllTeamHeads, getHeadTeamIds,
  createLeaguePoll, getAllLeaguePolls, getLeaguePollById, setLeaguePollStatus, getLeaguePollVotes, getMyLeaguePollVote, castLeaguePollVote,
  getActiveFineCategories, getAllFineCategories, getFineCategory, createFineCategory, updateFineCategory, setFineCategoryActive,
  getReportableFineCategories, getOtherFineCategory,
  createFineCase, getFineCase, getFineCasesByStatus, getAllFineCases, getFineCasesForPlayer, hasOpenPlayerReport,
  getFineVotesForCase, castFineVote, resolveFineCase,
  getEscalationVotesForCase, castEscalationVote, getTotalAdminCount, recomputeEscalation, forceEscalationDecision,
  getPeerRating, getPeerRatingsForRatee, upsertPeerRating, getOrAssignPlayerAlias,
  getAllPeerRatings, getPeerRatingSeasons,
  db as portalDb,
} from './lib/portal-db.js';
import { RATING_CATEGORY_KEYS, RATING_COOLDOWN_MS, ALIAS_FALLBACK_POOL, summarizePeerRatings } from './lib/peer-ratings.js';
import { playerSlug, teamSlug, gameSlug, slugify } from './lib/slugs.js';
import { generateText, generateJson, generateWithGemini, filterPbpForRecap, aiAvailable } from './lib/ai.js';
import { classifyPositionGroup, aggregatePeerAverages, statSnapshotFromTotals, generateCoachAnalysis, FOCUS_LABELS, FOCUS_VIDEOS } from './lib/player-analysis.js';
import { adminLoginBody } from './views/admin/login.js';
import { adminLedgerBody, adminLedgerPlayerBody, playerFinancialSection } from './views/admin/ledger.js';
import { adminAwardsBody } from './views/admin/awards.js';
import { adminVisibilityBody } from './views/admin/visibility.js';
import { awardGraphicEditorBody } from './views/admin/award-graphic-editor.js';
import { adminUsersBody }       from './views/admin/users.js';
import { adminUserDetailBody }  from './views/admin/user-detail.js';
import { adminPrivilegesBody }  from './views/admin/privileges.js';
import { adminLogsPage }        from './views/admin/logs.js';
import { adminFinanceDashBody } from './views/admin/finance-dash.js';
import { adminFinanceGcashBody } from './views/admin/finance-gcash.js';
import { adminDashboardBody } from './views/admin/dashboard.js';
import { adminGamesListBody, adminGameDetailBody } from './views/admin/games.js';
import { adminPlayersBody } from './views/admin/players.js';
import { adminPlayerDetailBody } from './views/admin/player-detail.js';
import { adminComparePage } from './views/admin/compare.js';
import { adminCoachNotesBody } from './views/admin/coach-notes.js';
import { adminLayout, ADMIN_SECTIONS, sectionForPath, firstAllowedAdminUrl } from './views/admin/layout.js';
import { computeRatings, computeRawValues } from './lib/ratings.js';
import { alignmentFlag, summarizeReviews } from './lib/assessment-scoring.js';
import { mvpPage } from './views/mvp.js';
import { awardsPage } from './views/awards.js';
import { papawisPage, CUTOFF_DAYS as PAPAWIS_CUTOFF_DAYS } from './views/papawis.js';
import { adminPapawisListBody, adminPapawisDetailBody, adminPapawisActivityBody, adminPapawisTeamsBody } from './views/admin/papawis.js';
import { adminPapawisCourtsBody } from './views/admin/papawis-courts.js';
import { buildBalancedTeams } from './lib/papawis-teams.js';
import { sendPapawisReminders, sendPapawisCancellationEmails, sendPapawisCompletionEmails, sendPapawisTeamAssignedEmail } from './lib/papawis-notify.js';
import { postsListPage, postDetailPage } from './views/posts.js';
import { adminPostsListBody, adminPostEditorBody } from './views/admin/posts.js';
import { adminSeoListBody, adminSeoEditorBody } from './views/admin/seo.js';
import { adminFinesListBody, adminFineCaseBody, adminFineCategoriesBody } from './views/admin/fines.js';
import { adminTeamHeadsBody } from './views/admin/team-heads.js';
import { adminRatingsBody } from './views/admin/ratings.js';
import { finesPage } from './views/fines.js';
import { teamHeadPage } from './views/team-head.js';
import { myTeamPage } from './views/my-team.js';
import { jerseyRequestPage } from './views/jersey-request.js';
import { pollsPage } from './views/polls.js';
import { adminPollsBody } from './views/admin/polls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// mtimeMs is ~1.7 trillion for a modern timestamp — the old `| 0` truncated it to a 32-bit
// signed int, which silently overflows into an arbitrary-looking negative number. Doesn't
// break caching (this only runs once at process start, so the value is still stable across
// every request in a given run), but it's not the clean version string it looks like it
// should be. Math.floor just keeps it an integer without the overflow.
const CSS_VER = (() => { try { return Math.floor(statSync(path.join(__dirname, 'public/styles.css')).mtimeMs); } catch { return Date.now(); } })();

// Minified once at process start (same lifecycle as CSS_VER — both only change on a
// restart, which is also the only time the underlying file can change anyway) rather than
// per-request. null means minification failed for some reason; the route below falls back
// to serving the original file as-is instead of a broken empty response.
const MINIFIED_CSS = (() => {
  const cache = {};
  for (const file of ['styles.css', 'admin.css']) {
    try {
      const raw = readFileSync(path.join(__dirname, 'public', file), 'utf8');
      const out = new CleanCSS({}).minify(raw);
      cache[file] = out.errors.length ? null : out.styles;
    } catch { cache[file] = null; }
  }
  return cache;
})();

const PORT = process.env.PORT || 4000;
const GA_MEASUREMENT_ID = String(process.env.GA_MEASUREMENT_ID || '').trim();
const ADMIN_URL = String(process.env.ADMIN_URL || 'http://localhost:3000').replace(/\/$/, '');
const PORTAL_ADMIN_USER = process.env.PORTAL_ADMIN_USER || 'admin';
const PORTAL_ADMIN_PASS = process.env.PORTAL_ADMIN_PASS || '';
const SESSION_SECRET    = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const ROSTER_API_KEY    = process.env.ROSTER_API_KEY || '';
const COVER_LOGO_PATH   = path.join(__dirname, 'wknd-logo.png');
const COVER_SVG_FONT    = 'Noto Sans, DejaVu Sans, Liberation Sans, Arial, sans-serif';

function checkCredentials(user, pass) {
  try {
    const uOk = timingSafeEqual(Buffer.from(user), Buffer.from(PORTAL_ADMIN_USER));
    const pOk = timingSafeEqual(Buffer.from(pass), Buffer.from(PORTAL_ADMIN_PASS));
    return uOk && pOk;
  } catch { return false; }
}

function checkPlayerPassword(password, storedHash) {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(keyHex, 'hex'));
  } catch { return false; }
}

function buildGaSnippet(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
  if (!GA_MEASUREMENT_ID || host !== 'wkndbasketball.com') return '';
  const safeId = GA_MEASUREMENT_ID.replace(/'/g, "\\'");
  return [
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}"></script>`,
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    `  gtag('config', '${safeId}');`,
    '</script>',
  ].join('\n  ');
}

function getRequestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '');
  return `${proto}://${host}`;
}

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function firstParagraph(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\n\n|\r\n/)[0].trim().slice(0, 200);
}

function writeupTitle(text) {
  const { title } = parseWriteup(text);
  return title || null;
}

function writeupDescription(text) {
  const { body } = parseWriteup(text);
  return body.slice(0, 200);
}

export function gamePageTitle(game) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  return writeupTitle(game.game_writeup)
    || `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;
}

function buildGameOgTags(req, game) {
  const origin = getRequestOrigin(req);
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const isCompleted = scoreA + scoreB > 0;
  const title      = gamePageTitle(game);
  const scoreLabel = `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;
  const url        = `${origin}/games/${encodeURIComponent(gameSlug(game))}`;
  const desc       = writeupDescription(game.game_writeup) || 'Game recap, box score, and player stats from WKND Basketball League.';
  const img        = isCompleted ? `${origin}/api/cover/${encodeURIComponent(game.id)}.png` : null;

  const publishedIso = game.date ? (() => { try { return new Date(game.date).toISOString(); } catch { return null; } })() : null;

  const tags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
  ];

  if (img) {
    tags.push(
      `<meta property="og:image" content="${escAttr(img)}">`,
      `<meta property="og:image:secure_url" content="${escAttr(img)}">`,
      `<meta property="og:image:type" content="image/png">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="${escAttr(title)}">`,
    );
  }

  if (publishedIso) {
    tags.push(
      `<meta property="article:published_time" content="${escAttr(publishedIso)}">`,
      `<meta property="article:section" content="Basketball">`,
      `<meta property="article:tag" content="WKND Basketball">`,
      `<meta property="article:tag" content="${escAttr(game.team_a_name)}">`,
      `<meta property="article:tag" content="${escAttr(game.team_b_name)}">`,
    );
  }

  tags.push(
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escAttr(title)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
    `<meta name="twitter:label1" content="Final Score">`,
    `<meta name="twitter:data1" content="${escAttr(scoreLabel)}">`,
  );

  if (img) {
    tags.push(
      `<meta name="twitter:image" content="${escAttr(img)}">`,
      `<meta name="twitter:image:alt" content="${escAttr(title)}">`,
    );
  }

  return tags.join('\n  ');
}

function buildPostOgTags(req, post) {
  const origin = getRequestOrigin(req);
  const url    = `${origin}/posts/${encodeURIComponent(post.slug)}`;
  const desc   = firstParagraph(post.body_html) || 'League news from WKND Basketball League.';
  const img    = `${origin}/og-image.png`;
  const publishedIso = post.publish_at ? new Date(post.publish_at).toISOString() : null;

  const tags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:title" content="${escAttr(post.title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    `<meta property="og:image" content="${escAttr(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escAttr(post.title)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
    `<meta name="twitter:image" content="${escAttr(img)}">`,
  ];
  if (publishedIso) tags.push(`<meta property="article:published_time" content="${escAttr(publishedIso)}">`);

  return tags.join('\n  ');
}

function buildPlayerOgTags(req, player, totals) {
  const origin  = getRequestOrigin(req);
  const name    = displayPlayerName(player.name);
  const team    = String(player.team_name || '').toUpperCase();
  const url     = `${origin}/players/${encodeURIComponent(playerSlug(player))}`;
  const hasPhoto = !!player.picture_url;
  // Version hash: short fingerprint of the stored photo so the og:image URL
  // changes whenever the photo is replaced, bypassing social-crawler caches.
  const photoVer = hasPhoto
    ? createHash('sha1').update(player.picture_url.slice(0, 256)).digest('hex').slice(0, 8)
    : '0';
  const img = hasPhoto ? `${origin}/api/player/${encodeURIComponent(player.id)}/photo?v=${photoVer}` : null;

  let positions = [];
  try { positions = JSON.parse(player.positions || '[]'); } catch {}
  const posStr = positions.join(' / ');

  let desc = `${name}`;
  if (posStr)  desc += ` · ${posStr}`;
  if (team)    desc += ` · ${team}`;
  if (totals?.games_played) {
    const gp = totals.games_played;
    const ppg = (totals.pts / gp).toFixed(1);
    const rpg = (totals.reb / gp).toFixed(1);
    const apg = (totals.ast / gp).toFixed(1);
    desc += ` · ${ppg} PPG, ${rpg} RPG, ${apg} APG`;
  }
  desc += ' · WKND Basketball League';

  const nameParts = String(player.name || '').split(',');
  const lastName  = nameParts[0]?.trim() || '';
  const firstName = nameParts[1]?.trim() || '';

  const tags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${escAttr(name + ' — WKND Basketball')}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    `<meta property="profile:first_name" content="${escAttr(firstName)}">`,
    `<meta property="profile:last_name" content="${escAttr(lastName)}">`,
  ];

  if (img) {
    tags.push(
      `<meta property="og:image" content="${escAttr(img)}">`,
      `<meta property="og:image:secure_url" content="${escAttr(img)}">`,
      `<meta property="og:image:alt" content="${escAttr(name)}">`,
    );
  }

  tags.push(
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escAttr(name + ' — WKND Basketball')}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
  );

  if (img) tags.push(`<meta name="twitter:image" content="${escAttr(img)}">`);

  return tags.join('\n  ');
}

function buildTeamOgTags(req, team) {
  const origin   = getRequestOrigin(req);
  const teamName = String(team.name || '').toUpperCase();
  const url      = `${origin}/teams/${encodeURIComponent(teamSlug(team))}`;
  const title    = `${teamName} — WKND Basketball`;
  const desc     = `${teamName} team — roster, stats, and standings on WKND Basketball League.`;

  const tags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escAttr(title)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
  ];

  return tags.join('\n  ');
}

function buildMvpOgTags(req, candidates, season) {
  const origin  = getRequestOrigin(req);
  const url     = `${origin}/mvp`;
  const img     = `${origin}/og-mvp.png`;
  const title   = `MVP Race — WKND Basketball League`;
  const leader  = candidates[0];
  let desc;
  if (leader) {
    const name = displayPlayerName(leader.player.name);
    const team = String(leader.stats.team_name || '').toUpperCase();
    const gp   = leader.stats.gp;
    const ppg  = gp > 0 ? (leader.stats.pts / gp).toFixed(1) : '0.0';
    const rpg  = gp > 0 ? (leader.stats.reb / gp).toFixed(1) : '0.0';
    const apg  = gp > 0 ? (leader.stats.ast / gp).toFixed(1) : '0.0';
    desc = `${name} (${team}) leads the Season ${season} MVP Race — ${ppg} PPG, ${rpg} RPG, ${apg} APG. Follow the updated rankings and AI-written MVP cases.`;
  } else {
    desc = `Follow the Season ${season} MVP Race — live rankings, efficiency stats, and AI-written MVP cases for every top candidate.`;
  }
  const tags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    `<meta property="og:image" content="${escAttr(img)}">`,
    `<meta property="og:image:secure_url" content="${escAttr(img)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escAttr(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escAttr(title)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
    `<meta name="twitter:image" content="${escAttr(img)}">`,
  ];
  return tags.join('\n  ');
}

function buildDefaultOgSvg() {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#020817"/>
  <circle cx="960" cy="315" r="310" fill="none" stroke="#0c1525" stroke-width="3"/>
  <circle cx="960" cy="315" r="230" fill="none" stroke="#0c1525" stroke-width="2"/>
  <circle cx="960" cy="315" r="145" fill="none" stroke="#121f35" stroke-width="2"/>
  <path d="M960 5 Q810 315 960 625" stroke="#0c1525" stroke-width="2" fill="none"/>
  <path d="M960 5 Q1110 315 960 625" stroke="#0c1525" stroke-width="2" fill="none"/>
  <line x1="650" y1="315" x2="1200" y2="315" stroke="#0c1525" stroke-width="2"/>
  <rect x="0" y="0" width="1200" height="5" fill="#f59332"/>
  <text x="80" y="118" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" letter-spacing="6" fill="#f59332">WKND BASKETBALL LEAGUE</text>
  <text x="72" y="305" font-family="Impact,Arial Black,Arial,sans-serif" font-size="148" font-weight="900" fill="#e2e8f0" letter-spacing="4">WKND</text>
  <text x="80" y="388" font-family="Impact,Arial Black,Arial,sans-serif" font-size="58" font-weight="900" fill="#1e293b" letter-spacing="10">BASKETBALL</text>
  <text x="80" y="458" font-family="Arial,Helvetica,sans-serif" font-size="17" fill="#475569" letter-spacing="2">STATS  \xB7  MVP RACE  \xB7  STANDINGS  \xB7  GAME RECAPS</text>
  <rect x="80" y="548" width="44" height="3" fill="#f59332"/>
  <text x="80" y="596" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#2d3d54" letter-spacing="3">WKNDBASKETBALL.COM</text>
</svg>`;
}

function buildPapawisOgSvg() {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#020817"/>
  <circle cx="960" cy="315" r="310" fill="none" stroke="#0c1525" stroke-width="3"/>
  <circle cx="960" cy="315" r="230" fill="none" stroke="#0c1525" stroke-width="2"/>
  <circle cx="960" cy="315" r="145" fill="none" stroke="#121f35" stroke-width="2"/>
  <path d="M960 5 Q810 315 960 625" stroke="#0c1525" stroke-width="2" fill="none"/>
  <path d="M960 5 Q1110 315 960 625" stroke="#0c1525" stroke-width="2" fill="none"/>
  <line x1="650" y1="315" x2="1200" y2="315" stroke="#0c1525" stroke-width="2"/>
  <rect x="0" y="0" width="1200" height="5" fill="#f59332"/>
  <text x="80" y="118" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" letter-spacing="6" fill="#f59332">WKND BASKETBALL LEAGUE</text>
  <text x="72" y="290" font-family="Impact,Arial Black,Arial,sans-serif" font-size="118" font-weight="900" fill="#e2e8f0" letter-spacing="2">PAPAWIS</text>
  <text x="80" y="358" font-family="Impact,Arial Black,Arial,sans-serif" font-size="38" font-weight="900" fill="#1e293b" letter-spacing="6">PICKUP GAMES</text>
  <text x="80" y="420" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#475569" letter-spacing="1.5">LIMITED SLOTS &#183; FIRST COME, FIRST SERVED</text>
  <text x="80" y="450" font-family="Arial,Helvetica,sans-serif" font-size="16" fill="#475569" letter-spacing="1.5">WAITLIST AUTO-FILLS WHEN A SPOT OPENS</text>
  <rect x="80" y="548" width="44" height="3" fill="#f59332"/>
  <text x="80" y="596" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#2d3d54" letter-spacing="3">WKNDBASKETBALL.COM/PAPAWIS</text>
</svg>`;
}

// SVG overlay for the MVP social image. No full-background rect so it renders with
// transparent pixels — sharp will composite it on top of the player photo layer.
function buildMvpOgSvg(leader, season, hasPhoto = false) {
  const name     = leader ? displayPlayerName(leader.player.name) : 'TBD';
  const initials = leader ? svgInitials(leader.player.name) : '?';
  const teamName = leader ? String(leader.stats.team_name || '').toUpperCase() : '';
  const tc       = leader ? (leader.stats.team_color || '#f59332') : '#334155';
  const gp       = Math.max(1, leader?.stats?.gp || 1);
  const ppg      = leader ? (leader.stats.pts / gp).toFixed(1) : '—';
  const rpg      = leader ? (leader.stats.reb / gp).toFixed(1) : '—';
  const apg      = leader ? (leader.stats.ast / gp).toFixed(1) : '—';
  const scr      = leader ? leader.mvpScore.toFixed(1) : '—';

  const len  = name.length;
  const disp = len > 26 ? name.slice(0, 25) + '…' : name;
  const fs   = len <= 10 ? 96 : len <= 14 ? 82 : len <= 18 ? 68 : len <= 22 ? 56 : 46;

  const tcS   = escXml(tc);
  const teamS = escXml(teamName);
  const nameS = escXml(disp);
  const initS = escXml(initials);
  const ppgS  = escXml(ppg);
  const rpgS  = escXml(rpg);
  const apgS  = escXml(apg);
  const scrS  = escXml(scr);
  const seasS = escXml(String(season || ''));

  // When no photo: show basketball watermark + team-colored initials circle
  const thumbFallback = hasPhoto ? '' : `
  <circle cx="175" cy="288" r="205" fill="none" stroke="#0c1525" stroke-width="2"/>
  <circle cx="175" cy="288" r="140" fill="none" stroke="#0c1525" stroke-width="1.5"/>
  <circle cx="175" cy="288" r="72" fill="none" stroke="#0c1525" stroke-width="1.5"/>
  <path d="M175 83 Q68 288 175 493" stroke="#0c1525" stroke-width="1.5" fill="none"/>
  <path d="M175 83 Q282 288 175 493" stroke="#0c1525" stroke-width="1.5" fill="none"/>
  <line x1="0" y1="288" x2="350" y2="288" stroke="#0c1525" stroke-width="1.5"/>
  <circle cx="175" cy="288" r="122" fill="url(#circleGrad)" stroke="${tcS}" stroke-opacity="0.22" stroke-width="1.5"/>
  <text x="175" y="330" font-family="Impact,Arial Black,Arial,sans-serif" font-size="90" font-weight="900" text-anchor="middle" fill="${tcS}" fill-opacity="0.5">${initS}</text>`;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#f59332" stop-opacity="0.11"/>
      <stop offset="55%" stop-color="#f59332" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="circleGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${tcS}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${tcS}" stop-opacity="0.04"/>
    </radialGradient>
  </defs>

  <!-- Top amber accent bar -->
  <rect x="0" y="0" width="1200" height="5" fill="#f59332"/>

  <!-- ── Left thumb panel (0–350): fallback only when no photo ── -->
  ${thumbFallback}

  <!-- Rank pill at bottom-left (always on top of photo) -->
  <rect x="22" y="557" width="84" height="48" rx="6" fill="#f59332"/>
  <text x="64" y="591" font-family="Impact,Arial Black,Arial,sans-serif" font-size="30" font-weight="900" text-anchor="middle" fill="#020817">01</text>

  <!-- Vertical divider -->
  <line x1="350" y1="5" x2="350" y2="630" stroke="#1e293b" stroke-width="1"/>

  <!-- ── Right body panel (351–1200) ── -->
  <rect x="351" y="0" width="849" height="630" fill="#0d1424"/>
  <rect x="351" y="0" width="849" height="630" fill="url(#bodyGrad)"/>

  <!-- Season label (top-right, logo composited at top-left by sharp) -->
  <text x="1180" y="42" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="4" fill="#2d3d54" text-anchor="end">SEASON ${seasS}</text>

  <!-- Horizontal rule below header -->
  <line x1="392" y1="72" x2="1180" y2="72" stroke="#1e293b" stroke-width="1"/>

  <!-- ── Badges ── -->
  <rect x="1028" y="84" width="152" height="34" rx="4" fill="#f59332"/>
  <text x="1104" y="106" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="3" fill="#020817" text-anchor="middle">FRONTRUNNER</text>
  <rect x="920" y="84" width="100" height="34" rx="4" fill="#020817" stroke="#1e293b" stroke-width="1"/>
  <text x="970" y="97" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" letter-spacing="2" fill="#64748b" text-anchor="middle">MVP SCORE</text>
  <text x="970" y="112" font-family="Impact,Arial Black,Arial,sans-serif" font-size="15" fill="#f59332" text-anchor="middle">${scrS}</text>

  <!-- "#1 FRONTRUNNER" label -->
  <text x="392" y="148" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" letter-spacing="7" fill="#f59332">#1  FRONTRUNNER</text>

  <!-- Player name -->
  <text x="388" y="270" font-family="Impact,Arial Black,Arial,sans-serif" font-size="${fs}" font-weight="900" fill="#e2e8f0">${nameS}</text>

  <!-- Team indicator -->
  <circle cx="396" cy="299" r="5" fill="${tcS}"/>
  <text x="410" y="305" font-family="Arial,Helvetica,sans-serif" font-size="13" letter-spacing="5" fill="#64748b">${teamS}</text>

  <!-- Separator line -->
  <line x1="388" y1="342" x2="1162" y2="342" stroke="#1e293b" stroke-width="1"/>

  <!-- ── Stats row ── -->
  <text x="388" y="420" font-family="Impact,Arial Black,Arial,sans-serif" font-size="56" fill="#f59332">${ppgS}</text>
  <text x="388" y="445" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="3" fill="#334155">PPG</text>
  <text x="556" y="420" font-family="Impact,Arial Black,Arial,sans-serif" font-size="56" fill="#e2e8f0">${rpgS}</text>
  <text x="556" y="445" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="3" fill="#334155">RPG</text>
  <text x="724" y="420" font-family="Impact,Arial Black,Arial,sans-serif" font-size="56" fill="#e2e8f0">${apgS}</text>
  <text x="724" y="445" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="3" fill="#334155">APG</text>
  <line x1="872" y1="374" x2="872" y2="454" stroke="#1e293b" stroke-width="1"/>
  <text x="894" y="420" font-family="Impact,Arial Black,Arial,sans-serif" font-size="56" fill="#f59332">${scrS}</text>
  <text x="894" y="445" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" letter-spacing="3" fill="#334155">MVP SCORE</text>

  <!-- ── Footer ── -->
  <line x1="388" y1="570" x2="1162" y2="570" stroke="#0f1d30" stroke-width="1"/>
  <text x="392" y="596" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="3" fill="#1a2d46">WKNDBASKETBALL.COM</text>
</svg>`;
}

// Cached WKND logo buffer (scaled to 36px tall for header compositing)
let _wkndLogoBuf;
async function getWkndLogoBuf() {
  if (_wkndLogoBuf === undefined) {
    try {
      _wkndLogoBuf = await sharp(path.join(__dirname, 'wknd-logo.png'))
        .resize(null, 36).png().toBuffer();
    } catch { _wkndLogoBuf = null; }
  }
  return _wkndLogoBuf || null;
}

async function buildMvpOgPng(leader, season) {
  const W = 1200, H = 630, THUMB_W = 350;

  // Fetch player photo (left thumb panel) — try admin URL
  let thumbBuf = null;
  const picUrl = leader?.stats?.picture_url;
  if (picUrl) {
    try {
      const src = await fetchCoverImageBuffer(picUrl);
      if (src) {
        thumbBuf = await sharp(src)
          .rotate()
          .resize(THUMB_W, H, { fit: 'cover', position: 'top' })
          .png()
          .toBuffer();
      }
    } catch {}
  }

  // SVG overlay (transparent background, rank pill, body panel, all text)
  const svgBuf = await sharp(Buffer.from(buildMvpOgSvg(leader, season, !!thumbBuf)), { density: 96 })
    .resize(W, H).png().toBuffer();

  // Flat dark base
  const base = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 2, g: 8, b: 23 } }
  }).png().toBuffer();

  const layers = [];
  if (thumbBuf) layers.push({ input: thumbBuf, top: 0, left: 0 });
  layers.push({ input: svgBuf, top: 0, left: 0 });

  const logoBuf = await getWkndLogoBuf();
  if (logoBuf) layers.push({ input: logoBuf, top: 18, left: 392 });

  return sharp(base).composite(layers).png({ compressionLevel: 7 }).toBuffer();
}

// ── Award share image generation ─────────────────────────────────────────────

const AWARD_OG_BADGE = {
  all_wknd_1:      { label: 'ALL WKND 1ST TEAM',       bg: '#22c55e', text: '#000'    },
  all_wknd_2:      { label: 'ALL WKND 2ND TEAM',       bg: '#64748b', text: '#fff'    },
  all_wknd_def:    { label: 'ALL WKND DEFENSIVE TEAM', bg: '#3b82f6', text: '#fff'    },
  mvp:             { label: 'SEASON MVP',               bg: '#f59332', text: '#10141d' },
  dpoy:            { label: 'BEST DEFENDER',            bg: '#3b82f6', text: '#fff'    },
  scoring_champ:   { label: 'SCORING CHAMP',            bg: '#f59332', text: '#10141d' },
  assists_leader:  { label: 'ASSISTS LEADER',           bg: '#f59332', text: '#10141d' },
  rebounds_leader: { label: 'REBOUNDS LEADER',          bg: '#f59332', text: '#10141d' },
  steals_leader:   { label: 'STEALS LEADER',            bg: '#f59332', text: '#10141d' },
  blocks_leader:   { label: 'BLOCKS LEADER',            bg: '#f59332', text: '#10141d' },
  three_pm_leader: { label: '3-PT LEADER',              bg: '#f59332', text: '#10141d' },
  champion:        { label: 'CHAMPION',                 bg: '#facc15', text: '#10141d' },
  finals_mvp:      { label: 'FINALS MVP',                bg: '#ef4444', text: '#fff'    },
};
const TEAM_AWARD_TYPES_OG = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def']);
const SINGLE_PHOTO_AWARD_TYPES = new Set(['mvp', 'dpoy', 'finals_mvp']);
// Roster-wide team award: every player on the winning finals team gets an individual
// row (unlike all_wknd_*, which is capped at one player per position) — keyed by
// player id like a solo award, not by position slot.
const ROSTER_AWARD_TYPES = new Set(['champion']);
// Single source of truth for which award types have a public visibility toggle,
// an admin/site/settings allowlist entry, and an article-generation key — kept in
// one place because the same list is otherwise easy to update inconsistently
// across the admin, public, and settings routes.
const AWARD_SECTION_KEYS = [
  'mvp', 'dpoy', 'all_wknd_1', 'all_wknd_2', 'all_wknd_def',
  'scoring_champ', 'assists_leader', 'rebounds_leader', 'steals_leader', 'blocks_leader', 'three_pm_leader',
  'champion', 'finals_mvp',
];
// MVP/DPOY normally show one hero photo; an admin can opt into a multi-column layout
// (2..MAX side by side) instead. Stored per (season, type) since it's a display choice,
// not season data — reuses the generic site_settings key/value store.
const MAX_AWARD_COLUMNS = 8;
function getAwardColumnCount(season, type) {
  const n = parseInt(getSetting(`award_cols_${season}_${type}`, '1'), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_AWARD_COLUMNS) : 1;
}
function setAwardColumnCount(season, type, n) {
  const clamped = Math.min(MAX_AWARD_COLUMNS, Math.max(1, parseInt(n, 10) || 1));
  setSetting(`award_cols_${season}_${type}`, clamped);
  return clamped;
}
const POSITIONS_OG_ORDER  = ['PG', 'SG', 'SF', 'PF', 'C'];
const POS_FULL_OG = { PG: 'POINT GUARD', SG: 'SHOOTING GUARD', SF: 'SMALL FORWARD', PF: 'POWER FORWARD', C: 'CENTER' };
const POSITION_ORDER_OG_MAP = Object.fromEntries(POSITIONS_OG_ORDER.map((p, i) => [p, i]));

function ogStatLine(row, type) {
  const gp  = row.games_played || 1;
  const avg = v => (v != null ? (v / gp).toFixed(1) : null);
  const parts =
    (['mvp', 'all_wknd_1', 'all_wknd_2'].includes(type))
      ? [avg(row.pts) && `${avg(row.pts)} PPG`, avg(row.reb) && `${avg(row.reb)} RPG`, avg(row.ast) && `${avg(row.ast)} APG`]
    : type === 'dpoy'
      // Individual DPOY share leads with rebounds too — the team defensive grid (all_wknd_def)
      // stays SPG/BPG-only since that redesign was scoped to the single-player awards.
      ? [avg(row.reb) && `${avg(row.reb)} RPG`, avg(row.stl) && `${avg(row.stl)} SPG`, avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'all_wknd_def'
      ? [avg(row.stl) && `${avg(row.stl)} SPG`, avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'scoring_champ'   ? [avg(row.pts)  && `${avg(row.pts)} PPG`]
    : type === 'assists_leader'  ? [avg(row.ast)  && `${avg(row.ast)} APG`]
    : type === 'rebounds_leader' ? [avg(row.reb)  && `${avg(row.reb)} RPG`]
    : type === 'steals_leader'   ? [avg(row.stl)  && `${avg(row.stl)} SPG`]
    : type === 'blocks_leader'   ? [avg(row.blk)  && `${avg(row.blk)} BPG`]
    : type === 'three_pm_leader' ? [row.fg3m != null && `${avg(row.fg3m)} 3PM`]
    : [];
  return parts.filter(Boolean).join('  ·  ');
}

function buildTeamAwardOgSvg(rows, badge, season, { text: showText = true } = {}) {
  const W = 1200, H = 630, N = rows.length;
  const STRIP_W = Math.floor(W / N);
  const isDefTeam = badge._type === 'all_wknd_def';
  const badgeBg   = escXml(badge.bg);
  const badgeTxt  = escXml(badge.text);
  const badgeLbl  = escXml(badge.label);

  // Per-strip: dark cinematic gradient + team-color bottom glow
  const gradDefs = rows.map((row, i) => {
    const tc = row.team_color || '#4a5263';
    return `
    <linearGradient id="sgd${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#020817" stop-opacity="0"/>
      <stop offset="42%"  stop-color="#020817" stop-opacity="0"/>
      <stop offset="72%"  stop-color="#020817" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="sgc${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${tc}" stop-opacity="0"/>
      <stop offset="65%"  stop-color="${tc}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${tc}" stop-opacity="0.28"/>
    </linearGradient>`;
  }).join('');

  const strips = rows.map((row, i) => {
    const x  = i * STRIP_W;
    const cx = x + STRIP_W / 2;
    const name  = formatName(row.player_name || '');
    const parts = name.split(' ');
    const last  = (parts.length > 1 ? parts[parts.length - 1] : name).toUpperCase();
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const tc    = escXml(row.team_color || '#4a5263');
    const posKey = POSITIONS_OG_ORDER.includes(row.notes) ? row.notes : '';
    const posLbl = posKey ? escXml(POS_FULL_OG[posKey] || posKey) : '';
    const posPillW = posKey ? Math.min(Math.round((POS_FULL_OG[posKey] || posKey).length * 6.4 + 36), STRIP_W - 16) : 0;
    const posPillX = posKey ? Math.round(cx - posPillW / 2) : 0;
    const gp    = row.games_played || 1;
    const avg   = v => (v / gp).toFixed(1);
    const stats = isDefTeam
      ? escXml(`${avg(row.stl)} SPG  ·  ${avg(row.blk)} BPG`)
      : escXml(`${avg(row.pts)} PPG  ·  ${avg(row.reb)} RPG  ·  ${avg(row.ast)} APG`);

    const PILL_H = 24, PILL_RY = H - 126;
    const pillTextY = PILL_RY + Math.round(PILL_H / 2 + 10 * 0.35);

    return `
  <!-- strip ${i} -->
  <rect x="${x}" y="0" width="${STRIP_W}" height="${H}" fill="url(#sgd${i})"/>
  <rect x="${x}" y="0" width="${STRIP_W}" height="${H}" fill="url(#sgc${i})"/>
  ${i > 0 ? `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#0d1424" stroke-width="2"/>` : ''}

  <!-- position pill (above stats) -->
  ${showText && posKey ? `<rect x="${posPillX}" y="${PILL_RY}" width="${posPillW}" height="${PILL_H}" rx="${PILL_H / 2}" fill="none" stroke="${badgeBg}" stroke-width="1.5"/>
  <text x="${cx}" y="${pillTextY}" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="800" fill="${badgeBg}" text-anchor="middle" letter-spacing="0.8">${posLbl}</text>` : ''}

  <!-- bottom content -->
  ${showText ? `<text x="${cx}" y="${H - 78}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#f59332" text-anchor="middle" letter-spacing="1">${stats}</text>
  <text x="${cx}" y="${H - 54}" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="400" fill="#64748b" text-anchor="middle" letter-spacing="0.5">${escXml(first)}</text>
  <text x="${cx}" y="${H - 26}" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="800" fill="#f1f5f9" text-anchor="middle" letter-spacing="1">${escXml(last)}</text>` : ''}

  <!-- bottom accent bar -->
  <rect x="${x}" y="${H - 5}" width="${STRIP_W}" height="5" fill="${tc}"/>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    ${gradDefs}
    <linearGradient id="banner-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020817" stop-opacity="1"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  ${strips}

  ${showText ? `<!-- header banner -->
  <rect x="0" y="0" width="${W}" height="72" fill="url(#banner-bg)"/>
  <!-- left accent bar -->
  <rect x="0" y="0" width="5" height="72" fill="${badgeBg}"/>
  <!-- bottom rule of banner -->
  <rect x="0" y="69" width="${W}" height="3" fill="${badgeBg}" opacity="0.35"/>

  <!-- supertitle + award label -->
  <text x="22" y="26" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="${badgeBg}" letter-spacing="3" opacity="0.8">WKND BASKETBALL</text>
  <text x="22" y="55" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#f1f5f9" letter-spacing="1.5">${badgeLbl}</text>

  <!-- season (right) -->
  <text x="${W - 22}" y="27" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#475569" text-anchor="end" letter-spacing="3">SEASON</text>
  <text x="${W - 22}" y="55" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" fill="#64748b" text-anchor="end" letter-spacing="1">${escXml(String(season))}</text>

  <!-- watermark -->
  <text x="${W - 22}" y="${H - 13}" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#1e293b" text-anchor="end" letter-spacing="3">WKNDBASKETBALL.COM</text>` : ''}
</svg>`;
}

// Renders one player's photo into a STRIP_W x H tile. With no override, behaves
// exactly like the original blind fit:cover/position:top crop. With an override
// (admin-adjusted pan/zoom from the award-graphic editor), scales the source by
// zoom * the minimum "cover" scale, then extracts a STRIP_W x H window positioned
// by offset_x/offset_y (0-100%, fraction of the available pan range).
async function renderPhotoStrip(url, stripW, h, override) {
  const src = await fetchCoverImageBuffer(url);
  if (!src) return null;
  const defaultFit = () => sharp(src).rotate().resize(stripW, h, { fit: 'cover', position: 'top' }).png().toBuffer();
  if (!override) {
    try { return await defaultFit(); } catch { return null; }
  }
  try {
    const meta = await sharp(src).rotate().metadata();
    const srcW = meta.width, srcH = meta.height;
    if (!srcW || !srcH) return await defaultFit();

    const baseScale = Math.max(stripW / srcW, h / srcH);
    const zoom   = Math.min(3, Math.max(1, Number(override.zoom) || 1));
    const scale  = baseScale * zoom;
    const scaledW = Math.max(stripW, Math.round(srcW * scale));
    const scaledH = Math.max(h, Math.round(srcH * scale));

    const clampPct = v => { const n = Number(v); return (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50) / 100; };
    const left = Math.round((scaledW - stripW) * clampPct(override.offset_x));
    const top  = Math.round((scaledH - h)      * clampPct(override.offset_y));

    return await sharp(src).rotate().resize(scaledW, scaledH).extract({ left, top, width: stripW, height: h }).png().toBuffer();
  } catch {
    try { return await defaultFit(); } catch { return null; }
  }
}

// Generic "N equal-width photo strips + fixed SVG overlay" template shared by every
// award share graphic. `awardType` is the key used to look up per-player photo
// overrides saved via the award-graphic editor (a synthetic id like 'stat-leaders'
// for graphics that combine multiple award rows into one image).
async function buildOgStripPng({ rows, season, awardType, svg, W = 1200, H = 630, text = true }) {
  const N = rows.length;
  const STRIP_W = Math.floor(W / N);
  const overrides = getAwardPhotoOverrides(season, awardType);
  // See buildPlayerAwardOgPng's photoTop for why this needs to track `text`: with no
  // banner drawn there's nothing reserving the top 72px, so the photo should fill it.
  const photoTop = text ? 72 : 0;

  const base = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 2, g: 8, b: 23 } } })
    .png().toBuffer();

  const photoLayers = await Promise.all(rows.map(async (row, i) => {
    const override = overrides[row.player_id];
    const url = (override && override.photo_url) || row.picture_url;
    const buf = await renderPhotoStrip(url, STRIP_W, H, override);
    return buf ? { input: buf, top: photoTop, left: i * STRIP_W } : null;
  }));

  const layers = photoLayers.filter(Boolean);

  const svgBuf = await sharp(Buffer.from(svg), { density: 96 }).resize(W, H).png().toBuffer();
  layers.push({ input: svgBuf, top: 0, left: 0 });

  if (text) {
    const logoBuf = await getWkndLogoBuf();
    if (logoBuf) layers.push({ input: logoBuf, top: 17, left: W - 148 });
  }

  return sharp(base).composite(layers).png({ compressionLevel: 7 }).toBuffer();
}

async function buildTeamAwardOgPng(rows, badge, season, { text = true } = {}) {
  const N = Math.min(rows.length, 5);
  const sorted = [...rows]
    .sort((a, b) => (POSITION_ORDER_OG_MAP[a.notes] ?? 99) - (POSITION_ORDER_OG_MAP[b.notes] ?? 99))
    .slice(0, N);
  const svg = buildTeamAwardOgSvg(sorted, badge, season, { text });
  return buildOgStripPng({ rows: sorted, season, awardType: badge._type, svg, text });
}

// crown (MVP) / shield (DPOY) — filled, drawn in the badge's own text color so they sit
// correctly against either badge fill.
const AWARD_ICON_PATH = {
  mvp:  { viewBox: '0 0 24 20', d: 'M2 6l4 4 6-8 6 8 4-4-2 11H4L2 6z' },
  dpoy: { viewBox: '0 0 24 26', d: 'M12 1l10 4v7c0 6.5-4.3 11-10 13-5.7-2-10-6.5-10-13V5l10-4z' },
};

function buildPlayerAwardOgSvg(row, type, badge, season, hasPhoto, { text: showText = true } = {}) {
  const W = 1200, H = 630;
  const cx = W / 2;

  const badgeBg  = escXml(badge.bg);
  const badgeTxt = escXml(badge.text);
  const badgeLbl = escXml(badge.label);
  const tc  = escXml(row.team_color || '#4a5263');
  const tn  = escXml(String(row.team_name || '').toUpperCase());

  const name  = formatName(row.player_name || '');
  const parts = name.split(' ');
  const last  = (parts.length > 1 ? parts[parts.length - 1] : name).toUpperCase();
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
  const stats = escXml(ogStatLine(row, type));

  // MVP/DPOY get the bigger "hero" treatment (solid badge + icon); every other single-player
  // share (individual stat-leader shares) keeps the original smaller outline-pill layout.
  const isPrestige = type === 'mvp' || type === 'dpoy';
  const icon = AWARD_ICON_PATH[type] || null;

  const lastFs = isPrestige
    ? (last.length > 12 ? 64 : last.length > 9 ? 74 : 90)
    : (last.length > 12 ? 48 : last.length > 9 ? 56 : 68);

  const teamY = isPrestige ? 388 : 400;
  const teamFs = isPrestige ? 18 : 12;
  const pillY = isPrestige ? 402 : 414;
  const pillH = isPrestige ? 32 : 26;
  const pillFs = isPrestige ? 13 : 10;
  const firstY = isPrestige ? 468 : 476;
  const firstFs = isPrestige ? 28 : 22;
  const lastY = isPrestige ? 552 : 548;
  const statsY = isPrestige ? 598 : 584;
  const statsFs = isPrestige ? 19 : 15;

  let badgeSvg = '';
  if (showText && isPrestige && icon) {
    const iconSize = 18, gap = 8, padX = 20;
    const textW  = badge.label.length * 8.3;
    const iconW  = iconSize * (icon.viewBox.split(' ')[2] / icon.viewBox.split(' ')[3]);
    const contentW = iconW + gap + textW;
    const pillW  = Math.min(Math.round(contentW + padX * 2), W - 100);
    const pillX  = Math.round(cx - pillW / 2);
    const iconX  = pillX + padX;
    const iconY  = pillY + (pillH - iconSize) / 2;
    const textX  = iconX + iconW + gap + textW / 2;
    const textY  = pillY + pillH / 2 + pillFs * 0.35;
    badgeSvg = `
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${badgeBg}"/>
  <svg x="${iconX}" y="${iconY}" width="${iconW}" height="${iconSize}" viewBox="${icon.viewBox}" fill="${badgeTxt}"><path d="${icon.d}"/></svg>
  <text x="${textX}" y="${textY}" font-family="Arial,Helvetica,sans-serif" font-size="${pillFs}" font-weight="800" fill="${badgeTxt}" text-anchor="middle" letter-spacing="1.2">${badgeLbl}</text>`;
  } else if (showText) {
    const pillW = Math.min(Math.round(badge.label.length * 6.4 + 36), W - 100);
    const pillX = Math.round(cx - pillW / 2);
    badgeSvg = `
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="none" stroke="${badgeBg}" stroke-width="1.5"/>
  <text x="${cx}" y="${pillY + pillH / 2 + pillFs * 0.35}" font-family="Arial,Helvetica,sans-serif" font-size="${pillFs}" font-weight="800" fill="${badgeBg}" text-anchor="middle" letter-spacing="1.2">${badgeLbl}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bot-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="42%"  stop-color="#020817" stop-opacity="0"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="team-glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="70%"  stop-color="${tc}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${tc}" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="edge-l" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#020817" stop-opacity="0.55"/>
      <stop offset="22%"  stop-color="#020817" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="edge-r" x1="0" y1="0" x2="1" y2="0">
      <stop offset="78%"  stop-color="#020817" stop-opacity="0"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="banner-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#020817" stop-opacity="1"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  ${!hasPhoto ? `<rect x="0" y="0" width="${W}" height="${H}" fill="#020817"/>` : ''}

  <!-- Photo overlays -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bot-fade)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#team-glow)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#edge-l)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#edge-r)"/>

  <!-- Team name -->
  ${showText ? `<text x="${cx}" y="${teamY}" font-family="Arial,Helvetica,sans-serif" font-size="${teamFs}" font-weight="700" fill="${tc}" text-anchor="middle" letter-spacing="4">${tn}</text>` : ''}

  <!-- Award badge -->
  ${badgeSvg}

  <!-- Player name -->
  ${showText ? `<text x="${cx}" y="${firstY}" font-family="Arial,Helvetica,sans-serif" font-size="${firstFs}" font-weight="400" fill="#64748b" text-anchor="middle" letter-spacing="1">${escXml(first)}</text>
  <text x="${cx}" y="${lastY}" font-family="Arial,Helvetica,sans-serif" font-size="${lastFs}" font-weight="800" fill="#f1f5f9" text-anchor="middle" letter-spacing="-1">${escXml(last)}</text>` : ''}

  <!-- Stats -->
  ${showText && stats ? `<text x="${cx}" y="${statsY}" font-family="Arial,Helvetica,sans-serif" font-size="${statsFs}" font-weight="700" fill="#f59332" text-anchor="middle" letter-spacing="1">${stats}</text>` : ''}

  <!-- Banner -->
  ${showText ? `<rect x="0" y="0" width="${W}" height="72" fill="url(#banner-bg)"/>
  <rect x="0" y="0" width="5" height="72" fill="${badgeBg}"/>
  <rect x="0" y="69" width="${W}" height="3" fill="${badgeBg}" opacity="0.35"/>
  <text x="22" y="26" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="${badgeBg}" letter-spacing="3" opacity="0.8">WKND BASKETBALL</text>
  <text x="22" y="55" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#f1f5f9" letter-spacing="1.5">${badgeLbl}</text>
  <text x="${W - 22}" y="27" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#475569" text-anchor="end" letter-spacing="3">SEASON</text>
  <text x="${W - 22}" y="55" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" fill="#64748b" text-anchor="end" letter-spacing="1">${escXml(String(season))}</text>` : ''}

  <!-- Bottom accent + watermark -->
  <rect x="0" y="${H - 5}" width="${W}" height="5" fill="${tc}"/>
  ${showText ? `<text x="${W - 22}" y="${H - 13}" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#1e293b" text-anchor="end" letter-spacing="3">WKNDBASKETBALL.COM</text>` : ''}
</svg>`;
}

async function buildPlayerAwardOgPng(row, type, badge, season, { text = true } = {}) {
  const W = 1200, H = 630;

  // MVP/DPOY can show a multi-image cover (several photos of this same confirmed player
  // tiled side by side) instead of one full-canvas photo. The name/badge/stats overlay
  // below is unchanged either way — only the photo compositing splits into columns.
  const n = SINGLE_PHOTO_AWARD_TYPES.has(type) ? getAwardColumnCount(season, type) : 1;
  const overridesBySlot = SINGLE_PHOTO_AWARD_TYPES.has(type)
    ? getAwardPhotoOverridesForPlayer(season, type, row.player_id)
    : {};

  const base = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 2, g: 8, b: 23 } } })
    .png().toBuffer();

  const layers = [];
  let hasPhoto = false;
  const stripW = n > 1 ? Math.floor(W / n) : W;
  // Photos are normally pushed down 72px so the banner has a background to sit on;
  // with no banner drawn there's nothing reserving that space, so let the photo fill
  // the full canvas instead of leaving the bare navy base color exposed at the top.
  const photoTop = text ? 72 : 0;
  for (let i = 0; i < Math.max(n, 1); i++) {
    const override = overridesBySlot[i] || null;
    const photoUrl = (override && override.photo_url) || row.picture_url;
    if (!photoUrl) continue;
    const buf = await renderPhotoStrip(photoUrl, stripW, H, override);
    if (buf) { layers.push({ input: buf, top: photoTop, left: i * stripW }); hasPhoto = true; }
  }

  const svgBuf = await sharp(Buffer.from(buildPlayerAwardOgSvg(row, type, badge, season, hasPhoto, { text })), { density: 96 })
    .resize(W, H).png().toBuffer();
  layers.push({ input: svgBuf, top: 0, left: 0 });

  if (text) {
    const logoBuf = await getWkndLogoBuf();
    if (logoBuf) layers.push({ input: logoBuf, top: 17, left: W - 148 });
  }

  return sharp(base).composite(layers).png({ compressionLevel: 7 }).toBuffer();
}

const STAT_LEADER_TYPES = ['scoring_champ', 'assists_leader', 'rebounds_leader', 'steals_leader', 'blocks_leader', 'three_pm_leader'];
// All solo (one-player) award types vs. the team/roster ones — used to pick which hero-slide
// shape (single photo + writeup vs. team strip graphic + no writeup) a homepage gallery
// entry gets. Champion isn't in TEAM_AWARD_TYPES_OG (no public og-image route exists for it
// yet — the graphic editor was never wired up for it), but it still gets the team-strip
// treatment here since it's roster-wide, not single-player.
const HOME_GALLERY_SOLO_TYPES = [...SINGLE_PHOTO_AWARD_TYPES, ...STAT_LEADER_TYPES];
const HOME_GALLERY_TEAM_TYPES = [...TEAM_AWARD_TYPES_OG, 'champion'];

function statLeaderValueUnit(row) {
  const gp = row.games_played || 1;
  switch (row.award_type) {
    case 'scoring_champ':   return { val: (row.pts  / gp).toFixed(1), unit: 'PPG' };
    case 'assists_leader':  return { val: (row.ast  / gp).toFixed(1), unit: 'APG' };
    case 'rebounds_leader': return { val: (row.reb  / gp).toFixed(1), unit: 'RPG' };
    case 'steals_leader':   return { val: (row.stl  / gp).toFixed(1), unit: 'SPG' };
    case 'blocks_leader':   return { val: (row.blk  / gp).toFixed(1), unit: 'BPG' };
    case 'three_pm_leader': return { val: (row.fg3m / gp).toFixed(1), unit: '3PM' };
    default: return { val: '', unit: '' };
  }
}

function buildStatLeadersOgSvg(rows, season) {
  const W = 1200, H = 630, N = rows.length;
  const STRIP_W = Math.floor(W / N);

  // Per-strip: cinematic dark + accent-color bottom glow
  const gradDefs = rows.map((row, i) => {
    const b  = AWARD_OG_BADGE[row.award_type] || { bg: '#f59332' };
    const tc = row.team_color || '#4a5263';
    return `
    <linearGradient id="sld${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#020817" stop-opacity="0.6"/>
      <stop offset="28%"  stop-color="#020817" stop-opacity="0"/>
      <stop offset="52%"  stop-color="#020817" stop-opacity="0"/>
      <stop offset="75%"  stop-color="#020817" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="slc${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${tc}" stop-opacity="0"/>
      <stop offset="62%"  stop-color="${tc}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${tc}" stop-opacity="0.22"/>
    </linearGradient>`;
  }).join('');

  const strips = rows.map((row, i) => {
    const x  = i * STRIP_W;
    const cx = x + STRIP_W / 2;
    const badge      = AWARD_OG_BADGE[row.award_type] || { label: row.award_type.toUpperCase(), bg: '#f59332', text: '#10141d' };
    const badgeBg    = escXml(badge.bg);
    const badgeTxt   = escXml(badge.text);
    const badgeLbl   = escXml(badge.label);
    const pillW      = Math.min(Math.round(badge.label.length * 6.4 + 36), STRIP_W - 16);
    const pillX      = Math.round(cx - pillW / 2);
    const tc         = escXml(row.team_color || '#4a5263');
    const name  = formatName(row.player_name || '');
    const parts = name.split(' ');
    const last  = (parts.length > 1 ? parts[parts.length - 1] : name).toUpperCase();
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const { val: statVal, unit: statUnit } = statLeaderValueUnit(row);

    return `
  <!-- strip ${i}: ${badge.label} -->
  <rect x="${x}" y="0" width="${STRIP_W}" height="${H}" fill="url(#sld${i})"/>
  <rect x="${x}" y="0" width="${STRIP_W}" height="${H}" fill="url(#slc${i})"/>
  ${i > 0 ? `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#0d1424" stroke-width="2"/>` : ''}

  <!-- award category pill (above stat) -->
  <rect x="${pillX}" y="${H - 146}" width="${pillW}" height="24" rx="12" fill="none" stroke="${badgeBg}" stroke-width="1.5"/>
  <text x="${cx}" y="${H - 146 + 12 + 3}" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="800" fill="${badgeBg}" text-anchor="middle" letter-spacing="1.2">${badgeLbl}</text>

  <!-- stat + name (bottom) -->
  <text x="${cx}" y="${H - 90}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800" fill="#f59332" text-anchor="middle">${escXml(statVal)}</text>
  <text x="${cx}" y="${H - 66}" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="${badgeBg}" text-anchor="middle" letter-spacing="2">${escXml(statUnit)}</text>
  <text x="${cx}" y="${H - 46}" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="400" fill="#64748b" text-anchor="middle" letter-spacing="0.3">${escXml(first)}</text>
  <text x="${cx}" y="${H - 24}" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="800" fill="#f1f5f9" text-anchor="middle" letter-spacing="0.5">${escXml(last)}</text>

  <!-- bottom accent -->
  <rect x="${x}" y="${H - 5}" width="${STRIP_W}" height="5" fill="${tc}"/>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    ${gradDefs}
    <linearGradient id="banner-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020817" stop-opacity="1"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  ${strips}

  <!-- header banner -->
  <rect x="0" y="0" width="${W}" height="72" fill="url(#banner-bg)"/>
  <rect x="0" y="0" width="5" height="72" fill="#f59332"/>
  <rect x="0" y="69" width="${W}" height="3" fill="#f59332" opacity="0.35"/>
  <text x="22" y="26" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#f59332" letter-spacing="3" opacity="0.8">WKND BASKETBALL</text>
  <text x="22" y="55" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#f1f5f9" letter-spacing="1.5">STATISTICAL LEADERS</text>
  <text x="${W - 22}" y="27" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#475569" text-anchor="end" letter-spacing="3">SEASON</text>
  <text x="${W - 22}" y="55" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" fill="#64748b" text-anchor="end" letter-spacing="1">${escXml(String(season))}</text>

  <text x="${W - 22}" y="${H - 13}" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#1e293b" text-anchor="end" letter-spacing="3">WKNDBASKETBALL.COM</text>
</svg>`;
}

async function buildStatLeadersOgPng(rows, season) {
  const svg = buildStatLeadersOgSvg(rows, season);
  return buildOgStripPng({ rows, season, awardType: 'stat-leaders', svg });
}

const _awardOgCache = new Map();

function buildTicker() {
  const games = getTickerGames();
  if (!games.length) return '';

  // Semifinal series are "twice to beat" — need each game's higher seed to detect a clinch
  // (see getSeriesRecordForGame's highTeamId param). Seeds only depend on regular-season
  // standings, so compute them once per season actually needed instead of per game.
  const seedsBySeason = new Map();
  const seedsFor = (season) => {
    if (!seedsBySeason.has(season)) seedsBySeason.set(season, computeSeeds(getSeasonStandings(season)));
    return seedsBySeason.get(season);
  };

  for (const g of games) {
    if (g.game_type !== 'playoff' && g.game_type !== 'finals') continue;

    let highTeamId = null;
    if (g.game_type === 'playoff') {
      const seeds = seedsFor(g.season);
      const idxA = seeds.findIndex(s => s.id === g.team_a_id);
      const idxB = seeds.findIndex(s => s.id === g.team_b_id);
      if (idxA !== -1 && idxB !== -1) highTeamId = idxA < idxB ? g.team_a_id : g.team_b_id;
    }

    const rec = getSeriesRecordForGame(g, highTeamId);
    if (rec) {
      g.seriesRecord = {
        ...rec,
        winnerName: rec.winnerTeamId === g.team_a_id ? g.team_a_name
          : rec.winnerTeamId === g.team_b_id ? g.team_b_name
          : null,
      };
    }
  }

  return scoreTicker(games);
}

function getFeatureFlags() {
  return {
    awards:  getSetting('awards_enabled',   '1') !== '0',
    mvpRace: getSetting('mvp_race_enabled', '1') !== '0',
    regOpen: getSetting('reg_open',         '0') === '1',
    papawis: getSetting('papawis_enabled',  '0') === '1',
    posts:   getSetting('posts_enabled',    '0') === '1',
    comments: getSetting('comments_enabled', '0') === '1',
    peerRatings: getSetting('peer_ratings_enabled', '0') === '1',
    playerReports: getSetting('player_reports_enabled', '0') === '1',
  };
}

const BANNER_POOL_REFRESH_MS = 24 * 60 * 60 * 1000; // once a day per pool — a batch, not one call per pageview
const BANNER_POOL_BATCH_SIZE = 15;

// Generic "AI-written banner copy" pool: one Gemini call writes a day's worth of rows
// (shape given by `fields`) and appends them to a growing, deduped pool stored in
// site_settings, so traffic never costs more than ~1 API call per pool per day. Returns a
// pick() function that each banner calls to grab a random row at render time.
function createBannerMessagePool({ settingKey, fields, buildPrompt, fallbackPool }) {
  function getPool() {
    try {
      const stored = JSON.parse(getSetting(settingKey, '') || '[]');
      return Array.isArray(stored) && stored.length && fields.every(f => stored[0][f] != null) ? stored : [];
    } catch { return []; }
  }

  async function refresh() {
    const existing = getPool();
    const prompt = buildPrompt(existing);
    try {
      const { text } = await generateWithGemini(prompt, { maxTokens: 1200, temperature: 1.05 });
      const minSlashes = fields.length - 1;
      const fresh = text
        .split('\n')
        .map(line => line.replace(/^[\s\d.\-)*]+/, '').trim())
        .filter(line => (line.match(/\//g) || []).length >= minSlashes)
        .map(line => {
          const parts = line.split('/').map(s => s.trim().replace(/^["']|["']$/g, ''));
          return Object.fromEntries(fields.map((f, i) => [f, parts[i]]));
        })
        .filter(p => fields.every(f => p[f]));
      if (fresh.length) {
        const dedupeKey = p => fields.map(f => p[f]).join('|').toLowerCase();
        const seen = new Set(existing.map(dedupeKey));
        const newOnes = fresh.filter(p => !seen.has(dedupeKey(p)));
        setSetting(settingKey, JSON.stringify([...existing, ...newOnes]));
        setSetting(`${settingKey}_at`, String(Date.now()));
      }
    } catch (e) {
      console.error(`${settingKey} message generation failed:`, e.message);
    }
  }

  // Refresh at boot only if the cached pool is missing or already a day old (fire-and-forget
  // — never block server startup on an AI call), then regenerate once every 24 hours.
  const age = Date.now() - Number(getSetting(`${settingKey}_at`, '0'));
  if (!getSetting(settingKey) || age > BANNER_POOL_REFRESH_MS) refresh();
  setInterval(refresh, BANNER_POOL_REFRESH_MS);

  return function pick() {
    const stored = getPool();
    const pool = stored.length ? stored : fallbackPool;
    return pool[Math.floor(Math.random() * pool.length)];
  };
}

const SIGNUP_BANNER_FALLBACK_POOL = [
  { headline: 'Your Roster Spot Is Waiting.', message: "We already saved you a spot on the roster. It's in the storage room. Come claim it bestie.", cta: 'Claim My Spot' },
  { headline: 'No Bench Warmers This Season.', message: "You're already one of us — now make it official for this season, no gatekeeping.", cta: 'Confirm My Season' },
  { headline: 'Main Character Season Only.', message: "Confirm before your bestie takes your usual spot on the court — we all know they're already thinking about it.", cta: 'Lock In My Spot 🔒' },
  { headline: "You're Either On the Roster or Watching.", message: "Stop watching others play and start being the player everyone talks about in the group chat at 2am.", cta: 'This Is My Sign' },
  { headline: 'The Best Decision This Season.', message: "The friendships, the runs, the drama, the wins — this season will give you stories you'll tell for years.", cta: 'Manifest It' },
];

const pickSignupBannerMessage = createBannerMessagePool({
  settingKey: 'signup_banner_msgs',
  fields: ['headline', 'message', 'cta'],
  fallbackPool: SIGNUP_BANNER_FALLBACK_POOL,
  buildPrompt: (existing) => {
    const avoidSample = existing.slice(-20).map(p => `- "${p.headline}" / "${p.message}"`).join('\n');
    return `Write ${BANNER_POOL_BATCH_SIZE} rows for a promo banner shown to EXISTING MEMBERS of a recreational weekend basketball league in the Philippines, prompting them to confirm their spot for the upcoming SEASON. These are already-registered members, not newcomers — the ask is "lock in your roster spot this season," not "join the league" or "register." Never use the words "register" or "sign up for the league" — this is season-specific, and season signup is exclusive to members who've already registered.

Voice: mix English with Taglish (natural Filipino-English code-switching, not forced). Channel cheeky, campy Filipino gay humor (bekimon/swardspeak-flavored — words like "bes," "chika," "keri," "werpa," "the audacity," "promise," "charot" are welcome where natural) — playful teasing, gossip/chismis energy, dramatic camp sass, backhanded-but-loving compliments. Do NOT use romantic framing (no "love story," "date," couple-talk) and do NOT use sexual or sensual innuendo — keep it about friendly shade and hype, not romance or anything suggestive. Still genuinely enticing, not just jokes for jokes' sake.

Each row has three parts: a short punchy headline (4-8 words, title case), a longer supporting sentence (max 20 words), and a catchy 2-5 word call-to-action button label. A fitting emoji is welcome on any part.
- "The Audacity To Ghost Us?" / "Alam namin gustong-gusto mo bumalik, wag ka nang mag-pa-cute pa. Chika, confirm ka na." / Keri Ko 'To 💅
- "Sis, We See You Scrolling." / "Oo na, alam namin sinusundan mo kami sa group chat. Tara na, confirm ka na rin." / Caught In 4K
- "No Bench Warmers This Season." / "You're already one of us — now make it official, walang gatekeeping dito." / Confirm My Season

Do NOT mention any specific date, deadline, or time limit. Every row must be distinct — no near-duplicates.${avoidSample ? `\n\nROWS ALREADY IN ROTATION (do NOT repeat these or close variations):\n${avoidSample}` : ''}

Output exactly one "headline / sentence / button label" row per line, no numbering, no bullets, no quotes around the whole row, no blank lines, no preamble.`;
  },
});

const REGISTRATION_BANNER_FALLBACK_POOL = [
  { pill: 'Main Character Era 🔥', headline: 'Your Villain Arc Starts Here.', message: "All genders. All skill levels. All unresolved competitive trauma. We have a jersey for that.", cta: 'Let Me Cook 🔥' },
  { pill: 'No Gatekeeping ✨', headline: "We Don't Discriminate.", message: "Except against ball hogs. And even then — only a little. Lovingly. Register now.", cta: 'Sign Me Up Sis' },
  { pill: 'Court Is In Session 💁', headline: 'We Have a Spot With Your Name On It.', message: "It's literally sitting in the storage room. Come register and get it bestie.", cta: "That's My Jersey" },
  { pill: 'Bestie Alert 👀', headline: "Don't Let Your Bestie Play Without You.", message: "Imagine watching your best friend get a trophy while you sat at home. Haunting. Register now.", cta: 'Not On My Watch' },
  { pill: 'Manifesting Your Bag 💰', headline: 'The Best Decision You Will Make.', message: "The friendships, the runs, the drama, the wins — join the league and get stories you'll tell for years.", cta: 'Manifest It' },
];

const pickRegistrationBannerMessage = createBannerMessagePool({
  settingKey: 'registration_banner_msgs',
  fields: ['pill', 'headline', 'message', 'cta'],
  fallbackPool: REGISTRATION_BANNER_FALLBACK_POOL,
  buildPrompt: (existing) => {
    const avoidSample = existing.slice(-20).map(p => `- "${p.headline}"`).join('\n');
    return `Write ${BANNER_POOL_BATCH_SIZE} rows for a promo banner recruiting BRAND NEW, PROSPECTIVE members to a recreational weekend basketball league in the Philippines — people who have never joined before. This is the opposite of a returning-member message: the whole point is getting a stranger to register and become a member for the first time. Freely use words like "register," "join," and "sign up."

Voice: mix English with Taglish (natural Filipino-English code-switching, not forced). Channel cheeky, campy Filipino gay humor (bekimon/swardspeak-flavored — words like "bes," "chika," "keri," "werpa," "the audacity," "promise," "charot," "anak" are welcome where natural) — playful teasing, gossip/chismis energy, dramatic camp sass, backhanded-but-loving compliments. Do NOT use romantic framing (no "love story," "date," couple-talk) and do NOT use sexual or sensual innuendo — keep it about friendly shade and hype, not romance or anything suggestive. Still genuinely enticing, not just jokes for jokes' sake.

Each row has FOUR parts: a punchy 2-4 word eyebrow badge (with emoji), a short punchy headline (4-8 words, title case), a longer supporting sentence (max 20 words) that sells the vibe (inclusive, all skill levels, social, funny), and a catchy 2-4 word call-to-action button label.
- "Bagong Dating? 👀" / "Wag Ka Nang Mahiya." / "Lahat type meron dito — laki man ng tiwala mo sa sarili o sa laban, may lugar ka. Register na, keri na 'yan." / Sige Na Nga
- "The Chismis Is True 👀" / "Everyone's Talking About This League." / "Sabi nila ang saya raw dito, kaya siguradong may FOMO ka na. Sumali ka na, sis." / Tara Na, Bes!
- "No Gatekeeping ✨" / "We Don't Discriminate." / "Except against ball hogs. And even then — only a little. Lovingly. Register now, promise." / Sign Me Up Sis

Do NOT mention any specific date, deadline, or time limit. Every row must be distinct — no near-duplicates.${avoidSample ? `\n\nHEADLINES ALREADY IN ROTATION (do NOT repeat these or close variations):\n${avoidSample}` : ''}

Output exactly one "pill / headline / sentence / button label" row per line, no numbering, no bullets, no quotes around the whole row, no blank lines, no preamble.`;
  },
});

// Masked identities for anonymous peer ratings (see lib/peer-ratings.js). Kept
// deliberately simple/PG (adjective + animal) rather than the Taglish/camp voice used
// for marketing banners above — this alias sits right next to potentially spicy roast
// content, so the name itself shouldn't add another layer of edge. Assigned once per
// player and reused for every anonymous rating they submit (see getOrAssignPlayerAlias).
const pickPeerRatingAlias = createBannerMessagePool({
  settingKey: 'peer_rating_aliases',
  fields: ['alias'],
  fallbackPool: ALIAS_FALLBACK_POOL.map(alias => ({ alias })),
  buildPrompt: (existing) => {
    const avoidSample = existing.slice(-40).map(p => `- ${p.alias}`).join('\n');
    return `Write 30 two-word pseudonyms in the form "Adjective Animal" (e.g. "Sneaky Badger", "Silent Hawk"), title case, for masking a user's identity in an anonymous feedback feed on a recreational basketball league site. Keep it light, playful, PG — no offensive, dark, or aggressive words. Every entry must be distinct — no near-duplicates or repeated animals back to back.${avoidSample ? `\n\nALREADY IN ROTATION (do NOT repeat these or close variations):\n${avoidSample}` : ''}

Output exactly one "Adjective Animal" pair per line, no numbering, no bullets, no quotes, no blank lines, no preamble.`;
  },
});

function memberSignupBanner(season) {
  const { message, cta } = pickSignupBannerMessage();
  return `<div class="member-signup-banner">
  <div class="member-signup-banner__copy">
    <span class="member-signup-banner__pill">
      <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
      Season ${escHtml(String(season))} Signup Open
    </span>
    <span class="member-signup-banner__msg">${escHtml(message)}</span>
  </div>
  <a href="/season-signup" class="member-signup-banner__cta">${escHtml(cta)} →</a>
</div>`;
}

function draftTeamBanner(season) {
  return `<div class="member-signup-banner">
  <div class="member-signup-banner__copy">
    <span class="member-signup-banner__pill">
      <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
      Season ${escHtml(String(season))} Teams
    </span>
    <span class="member-signup-banner__msg">Next season's team rosters are up.</span>
  </div>
  <a href="/my-team" class="member-signup-banner__cta">See your team →</a>
</div>`;
}

function jerseyRequestBanner() {
  return `<div class="member-signup-banner">
  <div class="member-signup-banner__copy">
    <span class="member-signup-banner__pill">
      <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
      Jersey Details Needed
    </span>
    <span class="member-signup-banner__msg">Fill in your jersey size and number before jerseys are ordered.</span>
  </div>
  <a href="/jersey-request/mine" class="member-signup-banner__cta">Fill it in →</a>
</div>`;
}

function regMiniBanner() {
  const { pill, message, cta } = pickRegistrationBannerMessage();
  return `<div class="reg-mini">
  <span class="reg-mini__pill">
    <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
    ${escHtml(pill)}
  </span>
  <span class="reg-mini__text">${escHtml(message)}</span>
  <a href="/register" class="reg-mini__cta">${escHtml(cta)} <span aria-hidden="true">→</span></a>
</div>`;
}

// Dismissal lives in the server session (not localStorage) so it clears itself on
// logout — session.destroy() wipes it — and reappears on the next fresh login even at
// the same balance, rather than staying silenced forever once closed once.
function balanceReminderBar(amount) {
  return `<div class="balance-bar" id="balance-bar" data-amount="${amount}">
  <div class="balance-bar__inner">
    <span class="balance-bar__text"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 4.2v3.3"/><circle cx="7" cy="9.8" r=".2" fill="currentColor"/></svg> You have an outstanding balance of <strong>₱${Number(amount).toLocaleString()}</strong>.</span>
    <a href="/settle-balance" class="balance-bar__cta">Settle now</a>
    <button class="balance-bar__close" id="balance-bar-close" type="button" aria-label="Dismiss">✕</button>
  </div>
</div>
<script>
(function() {
  var bar = document.getElementById('balance-bar');
  var closeBtn = document.getElementById('balance-bar-close');
  if (!bar || !closeBtn) return;
  closeBtn.addEventListener('click', function() {
    fetch('/balance-bar/dismiss', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(bar.dataset.amount) })
    }).catch(function() {});
    bar.style.display = 'none';
  });
})();
</script>`;
}

// Same dismiss-in-session pattern as balanceReminderBar — reappears on the next fresh
// login rather than being silenced forever. This is deliberately a *separate* bar/dismiss
// key from the balance one (not folded into it) since a player can be on probation with
// zero outstanding balance, and dismissing one shouldn't dismiss the other.
function probationReminderBar() {
  return `<div class="balance-bar" id="probation-bar" style="background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.3)">
  <div class="balance-bar__inner">
    <span class="balance-bar__text"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 4.2v3.3"/><circle cx="7" cy="9.8" r=".2" fill="currentColor"/></svg> Your account is on <strong>Papawis probation</strong> — you'll be held on a waiting list until a deposit is confirmed.</span>
    <a href="/settle-balance?category=${encodeURIComponent('Papawis Deposit')}" class="balance-bar__cta">Submit deposit</a>
    <button class="balance-bar__close" id="probation-bar-close" type="button" aria-label="Dismiss">✕</button>
  </div>
</div>
<script>
(function() {
  var bar = document.getElementById('probation-bar');
  var closeBtn = document.getElementById('probation-bar-close');
  if (!bar || !closeBtn) return;
  closeBtn.addEventListener('click', function() {
    fetch('/probation-bar/dismiss', { method: 'POST' }).catch(function() {});
    bar.style.display = 'none';
  });
})();
</script>`;
}

// Shown site-wide (even on minimal-header pages — unlike the other banners, this one
// exists for safety/clarity, not conversion, so it should never be able to disappear)
// whenever a super admin is viewing the site through /admin/impersonate/:playerId. No
// dismiss button — the only way out is actually returning to admin.
function impersonationBanner(playerName) {
  return `<div class="balance-bar" style="background:#7c2d12;border-color:#9a3412">
  <div class="balance-bar__inner">
    <span class="balance-bar__text">👁 Viewing as <strong>${escHtml(playerName)}</strong> — read-only.</span>
    <button class="balance-bar__cta" id="stop-impersonating-btn" type="button" style="border:0;cursor:pointer">Return to Admin</button>
  </div>
</div>
<script>
(function() {
  var btn = document.getElementById('stop-impersonating-btn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    btn.disabled = true;
    fetch('/admin/stop-impersonating', { method: 'POST' })
      .then(function() { window.location.href = '/admin'; })
      .catch(function() { btn.disabled = false; });
  });
})();
</script>`;
}

function renderPage(req, opts) {
  const origin = getRequestOrigin(req);
  const fallbackImg = `${origin}/og-image.png`;
  const fallbackMeta = [
    `<meta property="og:image" content="${escAttr(fallbackImg)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escAttr(fallbackImg)}">`,
  ].join('\n  ');
  const existing = opts.metaTags || '';
  let metaTags = existing.includes('og:image') ? existing : (existing ? existing + '\n  ' + fallbackMeta : fallbackMeta);
  let title = opts.title;
  const seoOverride = getSeoOverride(req.path);
  if (seoOverride) {
    if (seoOverride.title) title = seoOverride.title;
    metaTags = applySeoOverrideTags(metaTags, seoOverride, title, origin);
  }
  const isPlayer   = !!req.session?.playerRegId;
  const isLoggedIn = !!req.session?.isAdmin || isPlayer;
  const isHead     = isPlayer && !!req.session?.playerPlayerId && getHeadTeamIds(req.session.playerPlayerId).length > 0;

  // Reg mini banner — shown on every non-home page for guests when reg is enabled
  const showMini = getSetting('reg_open', '0') === '1' && opts.currentPath !== '/' && !isLoggedIn;

  // Season signup banner — shown to approved members who haven't yet signed up. Not on the
  // homepage, which gets the bigger mid-page banner (registrationBanner/memberSignupBannerBig
  // in views/home.js) instead of this thin top strip.
  let showSignupBanner = false, signupBannerSeason = '';
  if (isPlayer && !req.session?.isAdmin) {
    const sigSeason   = getSetting('signup_target_season', '');
    const sigOpen     = getSetting('season_signup_open', '0') === '1';
    const onSignupPg  = opts.currentPath === '/season-signup';
    const onHomePg    = opts.currentPath === '/';
    if (sigSeason && sigOpen && !onSignupPg && !onHomePg) {
      const existing = getSeasonSignup(req.session.playerRegId, sigSeason);
      if (!existing) {
        showSignupBanner   = true;
        signupBannerSeason = sigSeason;
      }
    }
  }

  // Draft team preview banner — shown to any signed-up player once admin has published
  // next season's draft rosters (see /admin/season/teams/publish), so they don't have to
  // stumble onto /my-team's URL by luck. Mutually exclusive with showSignupBanner: you can
  // only have a roster assignment if you already have a signup.
  let showDraftTeamBanner = false, draftTeamSeason = '';
  if (isPlayer && !req.session?.isAdmin && opts.currentPath !== '/my-team') {
    const sigSeason = getSetting('signup_target_season', '');
    if (sigSeason && getSetting('season_roster_published', '') === sigSeason) {
      const signup = getSeasonSignup(req.session.playerRegId, sigSeason);
      if (signup && getSeasonRoster(sigSeason).some(r => r.signup_id === signup.id)) {
        showDraftTeamBanner = true;
        draftTeamSeason = sigSeason;
      }
    }
  }

  // Jersey-request reminder — shown to any player admin has sent a jersey request to
  // (see /admin/season-signups/:id/request-jersey) who hasn't submitted yet, so a missed
  // email or dismissed notification isn't the only way to rediscover it. Outranks the draft
  // team banner below: it's an explicit ask from admin, not a general "come look" nudge.
  let showJerseyRequestBanner = false;
  if (isPlayer && !req.session?.isAdmin && !opts.currentPath?.startsWith('/jersey-request')) {
    const sigSeason = getSetting('signup_target_season', '');
    if (sigSeason) {
      const signup = getSeasonSignup(req.session.playerRegId, sigSeason);
      if (signup?.jersey_requested_at && !signup.jersey_submitted_at) showJerseyRequestBanner = true;
    }
  }

  // Focused auth-style pages (register, login, season-signup, set-password) skip
  // every site-wide banner/ticker/balance-reminder — none of it is relevant on the
  // page that IS the CTA those banners would otherwise point at.
  const bannerHtml = opts.minimalHeader ? '' : (showSignupBanner ? memberSignupBanner(signupBannerSeason) : (showJerseyRequestBanner ? jerseyRequestBanner() : (showDraftTeamBanner ? draftTeamBanner(draftTeamSeason) : (showMini ? regMiniBanner() : ''))));

  // Balance reminder — shown site-wide to a player with an outstanding balance, on top of
  // whatever other banner is already showing. Dismissal is per-amount and lives in the
  // session (see balanceReminderBar), so it comes back if the balance changes, and always
  // comes back on the next fresh login regardless of amount. Skipped on your own profile
  // (already has its own non-dismissable balance card) and on the settle-balance page
  // itself (redundant — you're already there doing exactly what the strip asks).
  const onOwnBalanceSurface = opts.currentPath === '/settle-balance' || (opts.currentPath === '/players' && opts.isOwnProfile);
  let balanceBarHtml = '';
  if (!opts.minimalHeader && isPlayer && req.session?.playerPlayerId && !onOwnBalanceSurface) {
    const fin = getPlayerFinancials(req.session.playerPlayerId);
    const balance = fin?.current_balance ?? 0;
    if (balance > 0 && req.session.balanceBarDismissedAmount !== balance) {
      balanceBarHtml = balanceReminderBar(balance);
    }
  }

  // Probation reminder — same skip conditions as the balance bar (own profile already has
  // the non-dismissable probation card, /settle-balance is already the destination it'd
  // point at) plus its own independent session-dismiss flag, plus suppressed entirely once
  // existing credit already covers the floor — same hasCoveringCredit check the join route
  // uses to skip the hold itself (server.js /papawis/:id/join), so the bar can't nag them to
  // deposit when they've already effectively done so.
  let probationBarHtml = '';
  if (!opts.minimalHeader && isPlayer && req.session?.playerPlayerId && !onOwnBalanceSurface && !req.session.probationBarDismissed) {
    if (getPlayerById(req.session.playerPlayerId)?.papawis_probation) {
      const minDep = getMaxPapawisPrice();
      const covered = minDep != null && (getPlayerFinancials(req.session.playerPlayerId)?.current_balance ?? 0) <= -minDep;
      if (!covered) probationBarHtml = probationReminderBar();
    }
  }

  const impersonatingHtml = req.session?.impersonating ? impersonationBanner(req.session.impersonatingPlayerName || 'this player') : '';

  const body = impersonatingHtml + balanceBarHtml + probationBarHtml + bannerHtml + (opts.body || '');

  // Notification bell data — computed per request like everything else here (no client
  // fetch needed for the initial render). Only relevant for a logged-in player; admin-only
  // sessions and guests never see the bell at all (see the isPlayer gate in views/layout.js).
  let notifications = [], unreadNotificationCount = 0;
  if (isPlayer && req.session?.playerPlayerId) {
    notifications = getNotificationsForPlayer(req.session.playerPlayerId, 20);
    unreadNotificationCount = getUnreadNotificationCount(req.session.playerPlayerId);
  }

  return layout({ ticker: opts.minimalHeader ? '' : buildTicker(), gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isAdmin: !!req.session?.isAdmin, isPlayer, isHead, features: getFeatureFlags(), origin, notifications, unreadNotificationCount, ...opts, title, body, metaTags });
}

// Applies a manual per-slug SEO override (views/admin/seo.js) on top of a page's
// normal meta tags — only the fields the admin actually set are touched, so a page's
// existing og:image (or the sitewide fallback added just above) survives untouched
// when an override only sets e.g. a title.
function applySeoOverrideTags(metaTags, override, effectiveTitle, origin) {
  let mt = metaTags;
  if (override.title) {
    mt = mt.replace(/<meta property="og:title"[^>]*>\n?\s*/g, '')
           .replace(/<meta name="twitter:title"[^>]*>\n?\s*/g, '');
    mt += `\n  <meta property="og:title" content="${escAttr(effectiveTitle)}">`;
    mt += `\n  <meta name="twitter:title" content="${escAttr(effectiveTitle)}">`;
  }
  if (override.description) {
    mt = mt.replace(/<meta name="description"[^>]*>\n?\s*/g, '')
           .replace(/<meta property="og:description"[^>]*>\n?\s*/g, '')
           .replace(/<meta name="twitter:description"[^>]*>\n?\s*/g, '');
    mt += `\n  <meta name="description" content="${escAttr(override.description)}">`;
    mt += `\n  <meta property="og:description" content="${escAttr(override.description)}">`;
    mt += `\n  <meta name="twitter:description" content="${escAttr(override.description)}">`;
  }
  if (override.image_url) {
    // Stored as a base64 data: URI (see compressSeoImage) — og:image must be a real
    // fetchable URL since social crawlers never resolve data: URIs, so this points at
    // /api/seo-cover which decodes and serves the stored image as bytes.
    const imgUrl = override.image_url.startsWith('data:')
      ? `${origin}/api/seo-cover?slug=${encodeURIComponent(override.slug)}`
      : override.image_url;
    mt = mt.replace(/<meta property="og:image[^"]*"[^>]*>\n?\s*/g, '')
           .replace(/<meta name="twitter:image"[^>]*>\n?\s*/g, '')
           .replace(/<meta name="twitter:card"[^>]*>\n?\s*/g, '');
    mt += [
      `\n  <meta property="og:image" content="${escAttr(imgUrl)}">`,
      `\n  <meta property="og:image:secure_url" content="${escAttr(imgUrl)}">`,
      `\n  <meta property="og:image:type" content="image/jpeg">`,
      `\n  <meta property="og:image:width" content="1200">`,
      `\n  <meta property="og:image:height" content="630">`,
      `\n  <meta name="twitter:card" content="summary_large_image">`,
      `\n  <meta name="twitter:image" content="${escAttr(imgUrl)}">`,
    ].join('');
  }
  return mt;
}

function renderAdminPage(req, opts) {
  return adminLayout({ gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isSuperAdmin: !req.session?.isElevatedPlayer, currentPath: req.path, allowedSections: getAdminAllowedSections(req), ...opts });
}

function formatName(raw) {
  const parts = String(raw || '').split(',');
  return parts.length >= 2 ? `${parts[1].trim()} ${parts[0].trim()}` : String(raw || '');
}

function escXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgInitials(raw) {
  const parts = String(raw || '').split(',');
  const last  = (parts[0]?.trim() || '')[0] || '';
  const first = (parts[1]?.trim() || '')[0] || '';
  return (first + last).toUpperCase() || '?';
}

function shortName(raw) {
  const parts = String(raw || '').split(',');
  const last  = parts[0]?.trim() || '';
  const first = parts[1]?.trim() || '';
  return first ? `${first[0]}. ${last}` : last;
}

async function resolveAvatar(pictureUrl) {
  if (!pictureUrl) return null;
  if (String(pictureUrl).startsWith('data:')) return pictureUrl;
  try {
    const url = String(pictureUrl).startsWith('http')
      ? pictureUrl
      : `${ADMIN_URL}${pictureUrl}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`;
  } catch { return null; }
}

function buildShareAsOfLabel(share) {
  const targetSeason = (share.season === 'alltime' || !share.season)
    ? (getCurrentSeason()?.season ?? null)
    : share.season;
  if (!targetSeason) return { asOfLabel: '', asOfSeason: null, asOfWeek: null };
  const week = getSeasonLatestWeek(targetSeason)?.week ?? null;
  if (!week) return { asOfLabel: '', asOfSeason: targetSeason, asOfWeek: null };
  return {
    asOfLabel:  share.season === 'alltime' ? `THRU S${targetSeason} WK ${week}` : `THRU WK ${week}`,
    asOfSeason: targetSeason,
    asOfWeek:   week,
  };
}

async function generateLeaderSvg(share) {
  const W = 1200, H = 630;
  const displayName = formatName(share.player_name).toUpperCase();
  const teamName    = String(share.team_name || '').toUpperCase();
  const color       = share.team_color || '#f59332';
  const statStr     = String(share.stat_fmt);
  const isRec       = share.mode === 'rec';
  const modeLabel   = share.mode === 'pg' ? 'PER GAME' : isRec ? 'SINGLE GAME' : 'TOTALS';
  const scopeLabel  = (isRec && share.season === 'alltime') ? 'ALL TIME' : `SEASON ${share.season}`;
  const chipTextColor = teamName === 'WHITE' ? '#10141d' : '#fff';

  const { asOfLabel } = buildShareAsOfLabel(share);

  // Parse top5
  let top5 = [];
  try { top5 = JSON.parse(share.top10_json || '[]'); } catch {}
  top5 = top5.slice(0, 5);
  const maxVal = top5[0]?.stat_value || 1;

  // ── Card geometry — mirrors .leader-panel structure ───────────────────────
  const CX = 32, CY = 32, CW = W - 64, CH = H - 64;  // 1136 × 566
  const HEAD_H   = 72;
  const HEAD_BOT = CY + HEAD_H;                        // 104
  const TOP_H    = 168;
  const TOP_BOT  = HEAD_BOT + TOP_H;                   // 272
  const ROW_H     = Math.floor((CY + CH - TOP_BOT) / 4); // (598-272)/4 = 81
  const ROW_AV_R   = 20;
  const ROW_AV_CX  = CX + 76;                             // row avatar centre x = 108
  const ROW_RANK_X = ROW_AV_CX - ROW_AV_R - 20;          // rank right-anchor x = 68  (20px gap to avatar)
  const ROW_NAME_X = ROW_AV_CX + ROW_AV_R + 22;          // name start x = 150        (22px gap from avatar)

  // ── Avatar — larger for visual prominence ────────────────────────────────
  const AV_R  = 64;
  const AV_CX = CX + 22 + AV_R;                       // 118
  const AV_CY = HEAD_BOT + Math.round(TOP_H / 2);     // 178

  // ── Info column (right of avatar) ────────────────────────────────────────
  const INFO_X     = AV_CX + AV_R + 18;               // 200
  const nameFontSz = displayName.length > 22 ? 20 : displayName.length > 16 ? 24 : 28;
  const chipW      = Math.max(70, teamName.length * 10 + 32);
  const NAME_Y     = isRec
    ? HEAD_BOT + Math.round(TOP_H * 0.38)   // 168 — centres 3-line block (name+chip+ctx) at AV_CY
    : HEAD_BOT + Math.round(TOP_H * 0.45);  // 180 — centres 2-line block (name+chip) at AV_CY
  const CHIP_TOP   = NAME_Y + 14;                      // 187 — more breathing room below name
  const CHIP_TEXT  = CHIP_TOP + 15;                    // 202 — properly centred in 22px chip height

  // ── Stat — amber, right-anchored ─────────────────────────────────────────
  const STAT_X     = CX + CW - 20;                    // 1148
  const statFontSz = statStr.length <= 2 ? 96 : statStr.length <= 4 ? 82 : statStr.length <= 6 ? 66 : 54;
  const STAT_Y     = HEAD_BOT + Math.round(TOP_H / 2) + Math.round(statFontSz * 0.70 / 2); // baseline to visually centre in TOP zone

  const rowEntries = top5.slice(1);

  // ── Hero avatar crop ──────────────────────────────────────────────────────
  let avatarBuf = null;
  {
    const livePlayer = getPlayerPhoto(share.player_id);
    const photoUrl   = await resolveAvatar(livePlayer?.picture_url);
    if (photoUrl) {
      try {
        const src  = await fetchCoverImageBuffer(photoUrl);
        const size = AV_R * 2;
        if (src) {
          const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${AV_R}" cy="${AV_R}" r="${AV_R}" fill="#fff"/></svg>`);
          avatarBuf = await sharp(src)
            .rotate()
            .resize(size, size, { fit: 'cover', position: 'top' })
            .composite([{ input: mask, blend: 'dest-in' }])
            .png()
            .toBuffer();
        }
      } catch {}
    }
  }

  // ── Row avatar crops (parallel fetch) ────────────────────────────────────
  const rowAvatarBufs = await Promise.all(rowEntries.map(async (p) => {
    const livePlayer = getPlayerPhoto(p.player_id);
    const photoUrl   = await resolveAvatar(livePlayer?.picture_url);
    if (!photoUrl) return null;
    try {
      const src  = await fetchCoverImageBuffer(photoUrl);
      if (!src) return null;
      const size = ROW_AV_R * 2;
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${ROW_AV_R}" cy="${ROW_AV_R}" r="${ROW_AV_R}" fill="#fff"/></svg>`);
      return await sharp(src)
        .rotate()
        .resize(size, size, { fit: 'cover', position: 'top' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer();
    } catch { return null; }
  }));

  // ── Records hero context ──────────────────────────────────────────────────
  let heroCtxSvg = '';
  if (isRec && top5[0]) {
    const f        = top5[0];
    const dateStr  = f.game_date ? new Date(f.game_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const resColor = String(f.game_result || '').startsWith('W') ? '#22c55e' : '#ef4444';
    const isPO     = f.is_playoff === true || f.is_playoff === 1 || f.is_playoff === '1';
    const isFinals = f.is_finals === true || f.is_finals === 1 || f.is_finals === '1';
    heroCtxSvg = `<text x="${INFO_X}" y="${CHIP_TEXT + 30}" font-family="${COVER_SVG_FONT}" font-size="12" fill="#475569">${escXml(dateStr)} · VS ${escXml(String(f.game_opp || '').toUpperCase())} · <tspan font-weight="700" fill="${resColor}">${escXml(String(f.game_result || ''))}</tspan>${isPO ? ` <tspan font-weight="700" fill="#f59332">PO</tspan>` : ''}${isFinals ? ` <tspan font-weight="700" fill="#f59332">F</tspan>` : ''}</text>`;
  }

  // ── Row builder ───────────────────────────────────────────────────────────
  const ROW_STAT_X = CX + CW - 28;

  function makeRow(p, i) {
    const rank = i + 2;
    const rowY = TOP_BOT + i * ROW_H;
    const midY = rowY + Math.round(ROW_H / 2);
    const tc   = escXml(p.team_color || '#64748b');
    const nm   = escXml(formatName(p.player_name).toUpperCase());
    const val  = escXml(p.stat_fmt);

    const barW   = maxVal > 0 ? Math.min(Math.round(p.stat_value / maxVal * CW), Math.round(CW * 0.85)) : 0;
    const barBg  = `<rect x="${CX}" y="${rowY + 1}" width="${barW}" height="${ROW_H - 2}" fill="${tc}" opacity="0.025"/>`;
    const divider = i < 3 ? `<line x1="${CX}" y1="${rowY + ROW_H}" x2="${CX + CW}" y2="${rowY + ROW_H}" stroke="#1e293b" stroke-width="1"/>` : '';

    // Avatar placeholder — photo composited as PNG layer on top of the SVG
    const avBg   = `<circle cx="${ROW_AV_CX}" cy="${midY}" r="${ROW_AV_R}" fill="#060c19"/>`;
    const avInit = !rowAvatarBufs[i] ? `<text x="${ROW_AV_CX}" y="${midY + 7}" text-anchor="middle" font-family="${COVER_SVG_FONT}" font-size="18" font-weight="800" fill="${tc}" opacity="0.5">${escXml(svgInitials(p.player_name))}</text>` : '';
    const avRing = `<circle cx="${ROW_AV_CX}" cy="${midY}" r="${ROW_AV_R}" fill="none" stroke="${tc}" stroke-width="1.5"/>`;

    if (isRec) {
      const nameY    = midY + 1;  // two-line block centred: nameTop≈midY-12, ctxBase=midY+19
      const ctxY     = midY + 19;
      const dateStr  = escXml(p.game_date ? new Date(p.game_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
      const oppStr   = escXml(String(p.game_opp || '').toUpperCase());
      const resStr   = escXml(String(p.game_result || ''));
      const resColor = String(p.game_result || '').startsWith('W') ? '#22c55e' : '#ef4444';
      return `${barBg}${avBg}${avInit}${avRing}
  <text x="${ROW_RANK_X}" y="${midY + 9}" font-family="${COVER_SVG_FONT}" font-size="11" font-weight="700" fill="#475569" text-anchor="end">${rank}</text>
  <text x="${ROW_NAME_X}" y="${nameY}" font-family="${COVER_SVG_FONT}" font-size="15" font-weight="700" fill="#e2e8f0">${nm}</text>
  <text x="${ROW_NAME_X}" y="${ctxY}" font-family="${COVER_SVG_FONT}" font-size="11" fill="#475569">${dateStr} · VS ${oppStr} · <tspan font-weight="700" fill="${resColor}">${resStr}</tspan></text>
  <text x="${ROW_STAT_X}" y="${midY + 10}" font-family="${COVER_SVG_FONT}" font-size="16" font-weight="700" fill="#e2e8f0" text-anchor="end">${val}</text>
  ${divider}`;
    }

    return `${barBg}${avBg}${avInit}${avRing}
  <text x="${ROW_RANK_X}" y="${midY + 5}" font-family="${COVER_SVG_FONT}" font-size="11" font-weight="700" fill="#475569" text-anchor="end">${rank}</text>
  <text x="${ROW_NAME_X}" y="${midY + 5}" font-family="${COVER_SVG_FONT}" font-size="15" font-weight="700" fill="#e2e8f0">${nm}</text>
  <text x="${ROW_STAT_X}" y="${midY + 5}" font-family="${COVER_SVG_FONT}" font-size="16" font-weight="700" fill="#e2e8f0" text-anchor="end">${val}</text>
  ${divider}`;
  }

  const rowsSvg = rowEntries.map((p, i) => makeRow(p, i)).join('\n');

  // ── SVG ───────────────────────────────────────────────────────────────────
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <clipPath id="card-clip">
      <rect x="${CX}" y="${CY}" width="${CW}" height="${CH}" rx="16"/>
    </clipPath>
    <linearGradient id="topGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${escXml(color)}" stop-opacity="0.10"/>
      <stop offset="65%" stop-color="${escXml(color)}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="stripGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="${escXml(color)}"/>
      <stop offset="70%" stop-color="${escXml(color)}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Outer bg -->
  <rect width="${W}" height="${H}" fill="#0a0e16"/>

  <!-- Card base (#0d1424 surface, rx=16, 1px border) -->
  <rect x="${CX}" y="${CY}" width="${CW}" height="${CH}" rx="16" fill="#0d1424"/>

  <g clip-path="url(#card-clip)">
    <!-- ::before color strip — 3px gradient from team color, like CSS -->
    <rect x="${CX}" y="${CY}" width="${CW}" height="3" fill="url(#stripGrad)"/>

    <!-- HEAD: full category name in amber on line 1, abbreviation + scope/mode on line 2 -->
    <text x="${CX + 20}" y="${CY + 34}" font-family="${COVER_SVG_FONT}" font-size="14" font-weight="800" fill="#f59332" letter-spacing="2">${escXml(share.stat_title.toUpperCase())} ${isRec ? 'RECORD' : 'LEADER'}</text>
    <text x="${CX + 20}" y="${CY + 54}" font-family="${COVER_SVG_FONT}" font-size="11" fill="#334155" letter-spacing="2">${escXml(share.stat_label)} · ${escXml(scopeLabel)}${isRec ? '' : ` · ${escXml(modeLabel)}`}${asOfLabel ? ` · ${escXml(asOfLabel)}` : ''}</text>
    <line x1="${CX}" y1="${HEAD_BOT}" x2="${CX + CW}" y2="${HEAD_BOT}" stroke="#1e293b" stroke-width="1"/>

    <!-- TOP gradient overlay -->
    <rect x="${CX}" y="${HEAD_BOT}" width="${CW}" height="${TOP_H}" fill="url(#topGrad)"/>

    <!-- Avatar: plain circle with color ring -->
    <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}" fill="#060c19"/>
    ${!avatarBuf ? `<text x="${AV_CX}" y="${AV_CY + 20}" text-anchor="middle" font-family="${COVER_SVG_FONT}" font-size="52" font-weight="800" fill="${escXml(color)}" opacity="0.4">${escXml(svgInitials(share.player_name))}</text>` : ''}
    <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R}" fill="none" stroke="${escXml(color)}" stroke-width="3"/>

    <!-- Info: player name + team chip -->
    <text x="${INFO_X}" y="${NAME_Y}" font-family="${COVER_SVG_FONT}" font-size="${nameFontSz}" font-weight="700" fill="#e2e8f0">${escXml(displayName)}</text>
    <rect x="${INFO_X}" y="${CHIP_TOP}" width="${chipW}" height="22" rx="11" fill="${escXml(color)}"/>
    <text x="${INFO_X + Math.round(chipW / 2)}" y="${CHIP_TEXT}" text-anchor="middle" font-family="${COVER_SVG_FONT}" font-size="10" font-weight="800" fill="${chipTextColor}" letter-spacing="2">${escXml(teamName)}</text>
    ${heroCtxSvg}

    <!-- Stat: amber, right-anchored — no redundant label, header already identifies it -->
    <text x="${STAT_X}" y="${STAT_Y}" font-family="${COVER_SVG_FONT}" font-size="${statFontSz}" font-weight="800" fill="#f59332" text-anchor="end">${escXml(statStr)}</text>

    <!-- TOP bottom border -->
    <line x1="${CX}" y1="${TOP_BOT}" x2="${CX + CW}" y2="${TOP_BOT}" stroke="#1e293b" stroke-width="1"/>

    <!-- LIST rows -->
    ${rowsSvg}

  </g>

  <!-- Card border -->
  <rect x="${CX}" y="${CY}" width="${CW}" height="${CH}" rx="16" fill="none" stroke="#1e293b" stroke-width="1.5"/>

  <!-- Footer — outside card, centred in the gap below -->
  <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="${COVER_SVG_FONT}" font-size="9" fill="#334155" letter-spacing="3">WKNDBASKETBALL.COM</text>
</svg>`;

  // ── Compose PNG ───────────────────────────────────────────────────────────
  // Render SVG at 2× density then resize down — produces much crisper text
  // when Facebook recompresses the PNG to JPEG for display
  const svgLayer = await sharp(Buffer.from(svg), { density: 144 })
    .resize(W, H)
    .png()
    .toBuffer();
  const base   = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 10, g: 14, b: 22 } } }).png().toBuffer();
  const layers = [{ input: svgLayer, top: 0, left: 0 }];

  if (avatarBuf) {
    layers.push({ input: avatarBuf, left: AV_CX - AV_R, top: AV_CY - AV_R });
  }

  // Composite row avatars on top of their SVG placeholder circles
  rowEntries.forEach((_, i) => {
    if (rowAvatarBufs[i]) {
      const rowY = TOP_BOT + i * ROW_H;
      const midY = rowY + Math.round(ROW_H / 2);
      layers.push({ input: rowAvatarBufs[i], left: ROW_AV_CX - ROW_AV_R, top: midY - ROW_AV_R });
    }
  });

  try {
    if (existsSync(COVER_LOGO_PATH)) {
      const logo = await sharp(COVER_LOGO_PATH)
        .ensureAlpha()
        .resize({ width: 130, height: 34, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      // Right side of head zone, vertically centered
      layers.push({ input: logo, left: CX + CW - 20 - 130, top: CY + Math.round((HEAD_H - 34) / 2) });
    }
  } catch {}

  return sharp(base).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

// Mirrors derivePlayerOfTheGameFromState from the admin app.
// Operates on game_player_stats rows (snake_case, `turnover` not `to`).
function derivePotgPlayerId(game, gameStats) {
  if (!gameStats.length) return null;

  const scoreA = Number(game.team_a_score || 0);
  const scoreB = Number(game.team_b_score || 0);
  const winnerTeamId = scoreA === scoreB
    ? null
    : (scoreA > scoreB ? game.team_a_id : game.team_b_id);

  const eligible = gameStats.filter(s => !winnerTeamId || s.team_id === winnerTeamId);
  if (!eligible.length) return null;

  const perScore = (s) => {
    const fgMade = Number(s.fg2m || 0) + Number(s.fg3m || 0);
    const fgAtt  = fgMade + Number(s.fg2m_miss || 0) + Number(s.fg3m_miss || 0);
    const ftMade = Number(s.ftm || 0);
    const ftAtt  = ftMade + Number(s.ft_miss || 0);
    return (
      Number(s.pts || 0) +
      (0.4 * fgMade) - (0.7 * fgAtt) - (0.4 * (ftAtt - ftMade)) +
      (0.7 * Number(s.reb || 0)) +
      Number(s.stl || 0) +
      (0.7 * Number(s.ast || 0)) +
      (0.7 * Number(s.blk || 0)) -
      (0.4 * Number(s.pf || 0)) -
      Number(s.turnover || 0)
    );
  };

  const maxPts = eligible.reduce((m, s) => Math.max(m, Number(s.pts || 0)), 0);

  let best = null;
  for (const s of eligible) {
    const score = perScore(s) + (Number(s.pts || 0) === maxPts && maxPts > 0 ? 1.25 : 0);
    if (!best || score > best.score || (score === best.score && Number(s.pts || 0) > Number(best.s.pts || 0))) {
      best = { s, score };
    }
  }
  return best?.s.player_id || null;
}

function extractQuarterScores(game) {
  // Source 1: derive per-quarter pts from consecutive periodCheckpoint cumulative totals
  let log;
  try { log = JSON.parse(game.game_log_json || '[]'); } catch { log = []; }
  const checkpoints = log
    .filter(e => e.metaType === 'periodCheckpoint' && e.checkpointSnapshot)
    .sort((a, b) => Number(a.quarter) - Number(b.quarter));

  const fromLog = {};
  let prevCumA = 0, prevCumB = 0, prevQ = 0;
  for (const cp of checkpoints) {
    const q = Number(cp.quarter);
    const cumA = Number(cp.checkpointSnapshot.teamAScore || 0);
    const cumB = Number(cp.checkpointSnapshot.teamBScore || 0);
    if (q === prevQ + 1) fromLog[q] = { a: cumA - prevCumA, b: cumB - prevCumB };
    prevCumA = cumA;
    prevCumB = cumB;
    prevQ = q;
  }

  // Source 2: period_snapshots_json locked by admin (fill quarters missing from log)
  let snapshots;
  try { snapshots = JSON.parse(game.period_snapshots_json || '[]'); } catch { snapshots = []; }
  const fromSnaps = {};
  for (const s of snapshots) {
    const q = Number(s.quarter);
    fromSnaps[q] = {
      a: Number(s.quarterStats?.teamA?.pts ?? 0),
      b: Number(s.quarterStats?.teamB?.pts ?? 0),
    };
  }

  const allQs = new Set([...Object.keys(fromLog), ...Object.keys(fromSnaps)].map(Number));
  const maxQ = Math.max(4, ...allQs, 0);

  const scores = [];
  for (let q = 1; q <= maxQ; q++) {
    const src = fromLog[q] ?? fromSnaps[q] ?? null;
    scores.push({ quarter: q, a: src?.a ?? null, b: src?.b ?? null });
  }
  return scores;
}

function buildLeaderPlayers() {
  const players = getLeaders();
  const records = getTeamRecords();
  const recordMap = Object.fromEntries(records.map(r => [r.team_id, r]));
  return players.map(p => ({ ...p, team_wins: recordMap[p.team_id]?.wins ?? 0, team_losses: recordMap[p.team_id]?.losses ?? 0 }));
}

// Resolves a URL ref (pretty slug OR raw entity ID) to a canonical entity ID.
// Returns { id } if the ref was already a slug, or { id, slug } to signal a redirect.
// Returns null if nothing matches.
function resolveRef(type, ref, lookupById, genSlug) {
  const idFromSlug = getEntityForSlug(type, ref);
  if (idFromSlug) return { id: idFromSlug };
  const entity = lookupById(ref);
  if (!entity) return null;
  const slug = genSlug(entity);
  saveSlug(type, entity.id, slug);
  return { id: entity.id, slug };
}

// Date field is stored as "M/D/YYYY h:mm AM" — not lexicographically sortable.
// Always sort with this helper before displaying games or scanning for highlights.
function byDate(games) {
  return [...games].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildHighlights(completedGames, playerMap, teamMap, count = 4) {
  // completedGames must already be in date DESC order (caller calls byDate first).
  const results = [];
  for (const g of completedGames) {
    if (results.length >= count) break;
    if (!g.potg_writeup) continue;
    const stats = getGameStats(g.id);
    const potgPlayerId = g.manual_potg_player_id || derivePotgPlayerId(g, stats);
    if (!potgPlayerId) continue;
    const potgStat = stats.find(s => s.player_id === potgPlayerId);
    if (!potgStat) continue;
    results.push({ game: g, stat: potgStat, player: playerMap[potgPlayerId] || null, team: teamMap[potgStat.team_id] || null });
  }
  return results;
}

const app = express();

const SessionStore = SqliteStore(session);
app.use(session({
  store: new SessionStore({ client: portalDb, expired: { clear: true, intervalMs: 15 * 60 * 1000 } }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.urlencoded({ extended: false }));

// Registered ahead of express.static so these two paths hit the minified, cached-in-memory
// version instead of the raw source file — everything else in public/ still goes through
// express.static unchanged. Safe to cache for a full year: the URL is always requested
// with ?v=CSS_VER (mtime-derived), so any real content change gets a new URL rather than
// invalidating this one.
app.get(['/styles.css', '/admin.css'], (req, res) => {
  const file = req.path.slice(1);
  const minified = MINIFIED_CSS[file];
  if (!minified) return res.sendFile(path.join(__dirname, 'public', file));
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('text/css').send(minified);
});

app.use(express.static(path.join(__dirname, 'public')));

// Bounces a logged-out visitor to /login with a next= pointing back at whatever page
// they actually asked for, so signing in lands them where they meant to go.
function loginUrl(req) {
  return '/login?next=' + encodeURIComponent(req.originalUrl);
}

// null = unrestricted (the true super-admin login always, plus every elevated player-admin
// before this feature existed / with nothing explicitly set). Otherwise an array of
// ADMIN_SECTIONS keys — see registrations.admin_sections in lib/portal-db.js.
function getAdminAllowedSections(req) {
  if (!req.session?.isAdmin || !req.session?.isElevatedPlayer) return null;
  return getRegistrationAdminSections(getRegistration(req.session.playerRegId));
}

function requireAuth(req, res, next) {
  if (!req.session?.isAdmin) {
    if (req.session?.playerRegId) return res.redirect('/me');
    return res.redirect(loginUrl(req));
  }
  const allowed = getAdminAllowedSections(req);
  if (allowed) {
    const section = sectionForPath(req.path);
    // A path outside every defined section (shared/cross-cutting routes like
    // /admin/site/settings, /admin/impersonate/:id) is left ungated — trying to reclassify
    // every such route per-section risks breaking something a restricted admin legitimately
    // needs inside a section they DO have (e.g. the Papawis reminders toggle posts to the
    // generic /admin/site/settings, not /admin/papawis/...).
    if (section && !allowed.includes(section.key)) {
      const target = firstAllowedAdminUrl(allowed);
      if (target && target !== req.path) return res.redirect(target);
    }
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.session?.isAdmin && !req.session?.isElevatedPlayer) return next();
  res.status(403).send(renderAdminPage(req, { title: 'Forbidden', currentPath: '', body: '<p style="padding:40px;color:var(--text-muted)">Super admin access required.</p>' }));
}

// Team heads/coaches are just registered players granted one extra privilege (see
// team_heads in lib/portal-db.js) — they authenticate through the normal player session,
// not the admin one, so this is a third, separate gate from requireAuth/requireSuperAdmin.
// A logged-in player who isn't a head gets a 403 (not redirected to /login — they're
// already logged in, bouncing them there would just loop); a logged-out visitor still
// gets sent to log in first.
function requireHead(req, res, next) {
  if (req.session?.playerPlayerId && getHeadTeamIds(req.session.playerPlayerId).length) return next();
  if (req.session?.playerRegId) {
    return res.status(403).send(renderPage(req, { title: 'Not Authorized', currentPath: '/fines', body: '<div class="container"><div class="page-content"><p style="padding:40px 0;color:var(--text-muted)">This page is only available to team heads/coaches.</p></div></div>' }));
  }
  res.redirect(loginUrl(req));
}

// Who cast a vote / filed a report, for both admin surfaces. A true super admin (the
// shared PORTAL_ADMIN_USER/PASS login) has no individual identity, so votes from that
// login collapse into one 'super_admin' bucket — an elevated player-admin (admin-core.md)
// already has their own player identity, so their votes/reports are individually
// attributed for free, no extra auth work needed.
function currentAdminActor(req) {
  if (req.session?.isElevatedPlayer) {
    return { type: 'admin', id: req.session.playerPlayerId, name: req.session.playerName || 'Admin' };
  }
  return { type: 'admin', id: 'super_admin', name: 'Super Admin' };
}
function currentHeadActor(req) {
  return { type: 'head', id: req.session.playerPlayerId, name: req.session.playerName || 'Team Head' };
}

// One identity resolver for League Polls, used from both /admin/polls (reachable by the
// shared super-admin login, which has no player identity at all) and /polls (reachable only
// by an actual logged-in player). Looks up the real player name via getPlayerById rather than
// trusting req.session.playerName, which (see currentHeadActor above) is only ever set for
// elevated player-admins — a plain head or regular player would otherwise show up as blank.
function currentPollVoterIdentity(req) {
  if (req.session?.playerPlayerId) {
    const player = getPlayerById(req.session.playerPlayerId);
    return {
      id: req.session.playerPlayerId,
      name: player ? displayPlayerName(player.name) : (req.session.playerName || 'Player'),
      isAdmin: !!req.session.isAdmin,
      isHead: getHeadTeamIds(req.session.playerPlayerId).length > 0,
    };
  }
  if (req.session?.isAdmin) return { id: 'super_admin', name: 'Super Admin', isAdmin: true, isHead: false };
  return null;
}
// Tiers cascade upward: admins qualify for every tier, heads qualify for 'heads' and
// 'players', a plain player only qualifies for 'players'. Same rule used for both the
// visibility check (can this viewer see the poll) and the eligibility check (can they vote).
function pollTierQualifies(tier, identity) {
  if (!identity) return false;
  if (identity.isAdmin) return true;
  if (tier === 'players') return true;
  if (tier === 'heads') return identity.isHead;
  return false; // tier === 'admins', and identity isn't one
}
// /polls is open to any logged-in player or admin — a wider gate than requireHead, since
// the whole point of the 'players' visibility tier is "everyone with an account," not just
// heads/admins.
function requirePollAccess(req, res, next) {
  if (currentPollVoterIdentity(req)) return next();
  res.redirect(loginUrl(req));
}

// Looked up fresh per request (not session-cached) so a super admin revoking this flag
// takes effect immediately, not on the elevated admin's next login.
function canViewSensitiveData(req) {
  if (!req.session?.isElevatedPlayer) return true;
  const self = getRegistration(req.session.playerRegId);
  return !!self?.can_view_sensitive;
}

// Log all mutating admin actions (skip GETs and file uploads)
app.use('/admin', (req, res, next) => {
  if (req.method === 'GET' || !req.session?.isAdmin) return next();
  res.on('finish', () => {
    if (res.statusCode >= 500) return;
    const actor     = req.session.isElevatedPlayer ? (req.session.playerName || 'player-admin') : 'super';
    const actorType = req.session.isElevatedPlayer ? 'admin' : 'super';
    const body      = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    delete body.password; delete body.confirm;
    insertAdminLog({ actor, actorType, method: req.method, path: req.path, details: body });
  });
  next();
});

// "View as" — lets a true super admin (never an elevated player-admin — team heads/coaches
// promoted to admin already have their own identity and don't need this) see the site
// exactly as a given player does. Swaps the admin session for that player's session,
// stashing enough to restore it on /admin/stop-impersonating. Read-only is enforced by
// the write-blocking middleware below, not by anything on these two routes themselves.
app.post('/admin/impersonate/:playerId', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistrationByPlayerId(req.params.playerId);
  if (!reg || reg.status !== 'approved') return res.status(400).json({ error: 'This player has no active account to view as.' });
  const player = getPlayerWithTeam(req.params.playerId);
  req.session.impersonating           = true;
  req.session.impersonatingPlayerName = displayPlayerName(player?.name || reg.full_name || '');
  req.session.playerRegId             = reg.id;
  req.session.playerPlayerId          = reg.player_id;
  delete req.session.isAdmin;
  delete req.session.isElevatedPlayer;
  res.json({ ok: true });
});

app.post('/admin/stop-impersonating', (req, res) => {
  if (!req.session?.impersonating) return res.status(400).json({ error: 'Not currently viewing as another player.' });
  const playerId = req.session.playerPlayerId;
  delete req.session.impersonating;
  delete req.session.impersonatingPlayerName;
  delete req.session.playerRegId;
  delete req.session.playerPlayerId;
  req.session.isAdmin = true;
  insertAdminLog({ actor: 'Super Admin', actorType: 'super', method: 'POST', path: req.path, details: { event: 'impersonate_stop', playerId } });
  res.json({ ok: true });
});

// While viewing as another player, every non-GET request is blocked — this is a read-only
// window into their account, not a way to act as them (comment, react, settle balance,
// etc. as someone else with zero attribution). /logout is unaffected since it's a GET.
app.use((req, res, next) => {
  if (!req.session?.impersonating || req.method === 'GET') return next();
  if (req.path === '/admin/stop-impersonating') return next();
  res.status(403).json({ error: 'Read-only while viewing as another player.' });
});

async function fetchCoverImageBuffer(url) {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      return Buffer.from(url.slice(comma + 1), 'base64');
    }
    const fetchUrl = url.startsWith('/') ? `${ADMIN_URL}${url}` : url;
    const r = await fetch(fetchUrl, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  } catch {}
  return null;
}

// Downscale + re-encode an arbitrary source photo (e.g. a pre-crop upload) so it's
// cheap to keep around for future re-crops, without needing full original resolution.
async function compressSourceImage(buffer) {
  const out = await sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, progressive: true })
    .toBuffer();
  return 'data:image/jpeg;base64,' + out.toString('base64');
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  return match ? Buffer.from(match[2], 'base64') : null;
}

async function generateGameCoverPng(game, potgStat, bgDataUrl) {
  const W = 1200, H = 630;

  // Background
  let base;
  const bgBuf = await fetchCoverImageBuffer(bgDataUrl);
  if (bgBuf) {
    base = await sharp(bgBuf)
      .rotate()
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } else {
    base = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 2, g: 8, b: 23 } } })
      .png()
      .toBuffer();
  }

  // Team colors from DB
  const teams  = getAllTeams();
  const teamAR = teams.find(t => t.id === game.team_a_id);
  const teamBR = teams.find(t => t.id === game.team_b_id);
  const colorA = escXml(teamAR?.color || '#4a5263');
  const colorB = escXml(teamBR?.color || '#4a5263');

  const scoreA   = Number(game.team_a_score);
  const scoreB   = Number(game.team_b_score);
  const winA     = scoreA > scoreB;
  const winB     = scoreB > scoreA;
  const teamAName = escXml(String(game.team_a_name || '').toUpperCase());
  const teamBName = escXml(String(game.team_b_name || '').toUpperCase());

  // POTG
  let potgSvgEl   = '';
  let avatarR     = 60;
  const avatarCx  = 88;
  let avatarCy    = 514;
  let avatarOverlay = null;

  if (potgStat) {
    const pts          = Number(potgStat.pts || 0);
    const reb          = Number(potgStat.reb || 0);
    const ast          = Number(potgStat.ast || 0);
    const potgName     = escXml(String(potgStat.name || 'PLAYER').toUpperCase());
    const potgStats    = escXml(`${pts} PTS - ${reb} REB - ${ast} AST`);
    const potgMeta     = escXml(`#${potgStat.number || '–'}  ·  ${potgStat.team_name || ''}`);
    const potgInitials = escXml(svgInitials(potgStat.name || '?'));
    const potgTeamR    = teams.find(t => t.id === potgStat.team_id);
    const potgColor    = escXml(potgStat.team_color || potgTeamR?.color || '#f97316');
    const potgNameSize = potgName.length <= 18 ? 40 : potgName.length <= 24 ? 34 : 28;
    avatarCy           = Math.round(484 + potgNameSize / 2);
    const avatarSize   = avatarR * 2;
    const nameY        = 452 + potgNameSize + 8;

    // Circular avatar from player photo
    if (potgStat.picture_url) {
      try {
        const src = await fetchCoverImageBuffer(potgStat.picture_url);
        if (src) {
          const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarR}" cy="${avatarR}" r="${avatarR}" fill="#fff"/></svg>`);
          avatarOverlay = await sharp(src)
            .rotate()
            .resize(avatarSize, avatarSize, { fit: 'cover', position: 'centre' })
            .composite([{ input: mask, blend: 'dest-in' }])
            .png({ compressionLevel: 9 })
            .toBuffer();
        }
      } catch {}
    }

    potgSvgEl = `
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 12}" fill="${potgColor}" fill-opacity="0.08"/>
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 5}" fill="${potgColor}" fill-opacity="0.12"/>
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="#020817" fill-opacity="0.7"/>
  ${!avatarOverlay ? `<text x="${avatarCx}" y="${avatarCy + 12}" text-anchor="middle" fill="#475569" font-size="34" font-weight="800" font-family="${COVER_SVG_FONT}" filter="url(#txt)">${potgInitials}</text>` : ''}
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 2}" fill="none" stroke="${potgColor}" stroke-width="2" stroke-opacity="0.9"/>
  <text x="180" y="452" fill="#f97316" font-size="13" font-weight="700" font-family="${COVER_SVG_FONT}" filter="url(#txt)">PLAYER OF THE GAME</text>
  <text x="180" y="${nameY}" fill="#ffffff" font-size="${potgNameSize}" font-weight="800" font-family="${COVER_SVG_FONT}" filter="url(#txt)">${potgName}</text>
  <text x="180" y="${nameY + 32}" fill="#e2e8f0" font-size="22" font-weight="700" font-family="${COVER_SVG_FONT}" filter="url(#txt)">${potgStats}</text>
  <text x="180" y="${nameY + 56}" fill="#94a3b8" font-size="15" font-family="${COVER_SVG_FONT}" filter="url(#txt)">${potgMeta}</text>`;
  }

  const overlaySvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="txt" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="1" stdDeviation="4" flood-color="#000000" flood-opacity="0.9"/>
    </filter>
    <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020817" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="botFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020817" stop-opacity="0"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0.94"/>
    </linearGradient>
    <filter id="card" x="-40%" y="-30%" width="180%" height="200%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.72"/>
    </filter>
    <linearGradient id="cardSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="scoreClip"><rect x="955" y="474" width="200" height="96" rx="12"/></clipPath>
  </defs>
  <rect x="0" y="0" width="${W}" height="160" fill="url(#topFade)"/>
  <rect x="0" y="400" width="${W}" height="230" fill="url(#botFade)"/>
  <rect x="0" y="0" width="600" height="6" fill="${colorA}"/>
  <rect x="600" y="0" width="600" height="6" fill="${colorB}"/>
  <rect x="0" y="6" width="5" height="${H - 12}" fill="${colorA}" opacity="0.65"/>
  <rect x="${W - 5}" y="6" width="5" height="${H - 12}" fill="${colorB}" opacity="0.65"/>
  <rect x="0" y="${H - 6}" width="600" height="6" fill="${colorA}" opacity="0.5"/>
  <rect x="600" y="${H - 6}" width="600" height="6" fill="${colorB}" opacity="0.5"/>
  <text x="129" y="24" text-anchor="middle" fill="${colorA}" font-size="9" font-weight="700" font-family="${COVER_SVG_FONT}" filter="url(#txt)" textLength="155" lengthAdjust="spacingAndGlyphs">SEASON ${escXml(String(game.season || ''))}  ·  ${escXml(game.game_type === 'playoff' ? 'PLAYOFFS' : game.game_type === 'finals' ? 'FINALS' : 'REGULAR SEASON')}</text>
  <rect x="955" y="474" width="200" height="96" rx="12" fill="#040c18" fill-opacity="0.80" filter="url(#card)" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1"/>
  <rect x="955" y="474" width="100" height="96" fill="${colorA}" fill-opacity="${winA ? '0.38' : '0.10'}" clip-path="url(#scoreClip)"/>
  <rect x="1055" y="474" width="100" height="96" fill="${colorB}" fill-opacity="${winB ? '0.38' : '0.10'}" clip-path="url(#scoreClip)"/>
  <rect x="956" y="475" width="198" height="26" rx="11" fill="url(#cardSheen)"/>
  <line x1="963" y1="500" x2="1147" y2="500" stroke="#ffffff" stroke-width="1" stroke-opacity="0.08"/>
  <line x1="1055" y1="482" x2="1055" y2="562" stroke="#ffffff" stroke-width="1" stroke-opacity="0.08"/>
  <text x="1005" y="493" fill="#ffffff" text-anchor="middle" font-size="12" font-weight="700" font-family="${COVER_SVG_FONT}" clip-path="url(#scoreClip)" filter="url(#txt)" opacity="${winA ? '1' : '0.45'}">${teamAName}</text>
  <text x="1105" y="493" fill="#ffffff" text-anchor="middle" font-size="12" font-weight="700" font-family="${COVER_SVG_FONT}" clip-path="url(#scoreClip)" filter="url(#txt)" opacity="${winB ? '1' : '0.45'}">${teamBName}</text>
  <text x="1005" y="548" fill="#ffffff" text-anchor="middle" font-size="48" font-weight="900" font-family="${COVER_SVG_FONT}" clip-path="url(#scoreClip)" filter="url(#txt)" opacity="${winA ? '1' : '0.38'}">${scoreA}</text>
  <text x="1105" y="548" fill="#ffffff" text-anchor="middle" font-size="48" font-weight="900" font-family="${COVER_SVG_FONT}" clip-path="url(#scoreClip)" filter="url(#txt)" opacity="${winB ? '1' : '0.38'}">${scoreB}</text>
  ${potgSvgEl}
  <text x="${W / 2}" y="617" fill="#334155" text-anchor="middle" font-size="11" font-weight="600" font-family="${COVER_SVG_FONT}" filter="url(#txt)">WKNDBASKETBALL.COM</text>
</svg>`);

  // Render SVG at 2× density then resize down — produces much crisper text
  const overlaySvgPng = await sharp(overlaySvg, { density: 144 })
    .resize(W, H)
    .png()
    .toBuffer();

  const layers = [{ input: overlaySvgPng, top: 0, left: 0 }];
  if (avatarOverlay) {
    layers.push({ input: avatarOverlay, left: avatarCx - avatarR, top: avatarCy - avatarR });
  }
  try {
    if (existsSync(COVER_LOGO_PATH)) {
      const logoOverlay = await sharp(COVER_LOGO_PATH)
        .ensureAlpha()
        .resize({ width: 155, height: 44, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      layers.push({ input: logoOverlay, left: 52, top: 34 });
    }
  } catch {}

  return sharp(base).composite(layers).png({ compressionLevel: 9 }).toBuffer();
}

async function serveCover(req, res) {
  const gameId = req.params.gameId;
  const game = getGameById(gameId);
  if (!game) return res.status(404).end();
  try {
    const stats       = getGameDetailStats(gameId);
    const potgId      = game.manual_potg_player_id || derivePotgPlayerId(game, stats);
    const potgStat    = potgId ? stats.find(s => s.player_id === potgId) : null;
    const coverRow    = game.has_cover ? getGameCover(gameId) : null;
    const png = await generateGameCoverPng(game, potgStat, coverRow?.social_cover_data_url || null);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.end(png);
  } catch (err) {
    console.error('serveCover error:', err);
    res.status(500).end();
  }
}

app.get('/api/cover/:gameId.png', serveCover);
app.get('/api/cover/:gameId',     serveCover);

// ── Generic + MVP social OG images ───────────────────────────────────────────
let _ogDefaultPng = null;
app.get('/og-image.png', async (req, res) => {
  try {
    if (!_ogDefaultPng) {
      _ogDefaultPng = await sharp(Buffer.from(buildDefaultOgSvg()), { density: 96 })
        .resize(1200, 630).png({ compressionLevel: 9 }).toBuffer();
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.end(_ogDefaultPng);
  } catch (err) { console.error('og-image error:', err); res.status(500).end(); }
});

let _ogPapawisPng = null;
app.get('/api/papawis/og-image.png', async (req, res) => {
  try {
    if (!_ogPapawisPng) {
      _ogPapawisPng = await sharp(Buffer.from(buildPapawisOgSvg()), { density: 96 })
        .resize(1200, 630).png({ compressionLevel: 9 }).toBuffer();
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.end(_ogPapawisPng);
  } catch (err) { console.error('papawis og-image error:', err); res.status(500).end(); }
});

// Keyed by the payload string itself — changing the setting naturally invalidates the
// cache (new key, cache miss) without needing an explicit "clear on save" step.
const _gcashQrCache = { payload: null, buf: null };
app.get('/api/gcash-qr.png', async (req, res) => {
  const payload = getSetting('gcash_qr_payload', '');
  if (!payload) return res.status(404).end();
  try {
    if (_gcashQrCache.payload !== payload) {
      _gcashQrCache.buf = await QRCode.toBuffer(payload, { type: 'png', width: 500, margin: 1 });
      _gcashQrCache.payload = payload;
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.end(_gcashQrCache.buf);
  } catch (err) { console.error('gcash-qr error:', err); res.status(500).end(); }
});

const _ogMvpCache = { buf: null, ts: 0 };
app.get('/og-mvp.png', async (req, res) => {
  try {
    if (!_ogMvpCache.buf || Date.now() - _ogMvpCache.ts > 3_600_000) {
      const season = getPortalCurrentSeason();
      const raw = season ? getMvpCandidates(season) : [];
      const candidates = raw
        .map(s => ({ player: s, stats: s, mvpScore: computeMvpScore(s) }))
        .filter(c => c.stats.gp >= 1)
        .sort((a, b) => b.mvpScore - a.mvpScore);
      _ogMvpCache.buf = await buildMvpOgPng(candidates[0] || null, season || '');
      _ogMvpCache.ts = Date.now();
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(_ogMvpCache.buf);
  } catch (err) { console.error('og-mvp error:', err); res.status(500).end(); }
});

app.get('/api/photo/:gameId', (req, res) => {
  const row    = getGameCover(req.params.gameId);
  const dataUrl = row?.social_cover_data_url;
  if (!dataUrl) return res.status(404).end();
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const buf = Buffer.from(match[2], 'base64');
  res.set('Content-Type', match[1]);
  res.set('Cache-Control', 'public, max-age=86400');
  res.end(buf);
});

// SEO override cover images are stored as base64 data: URIs (see compressSeoImage),
// but og:image/twitter:image must be a real fetchable URL — social crawlers don't
// resolve data: URIs — so this decodes and serves the stored image as bytes.
app.get('/api/seo-cover', (req, res) => {
  const override = getSeoOverride(String(req.query.slug || ''));
  const dataUrl = override?.image_url;
  if (!dataUrl) return res.status(404).end();
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const buf = Buffer.from(match[2], 'base64');
  res.set('Content-Type', match[1]);
  res.set('Cache-Control', 'public, max-age=86400');
  res.end(buf);
});

async function sendPlayerPhotoUrl(res, url) {
  if (!url) return res.status(404).end();
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const mime  = (url.slice(0, comma).match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
    const buf   = Buffer.from(url.slice(comma + 1), 'base64');
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'no-cache');
    return res.end(buf);
  }
  // Relative paths are served by the admin server, not the portal
  const fetchUrl = url.startsWith('/') ? `${ADMIN_URL}${url}` : url;
  try {
    const upstream = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(buf);
  } catch {
    res.status(502).end();
  }
}

app.get('/api/player/:id/photo', async (req, res) => {
  const row = getPlayerPhoto(req.params.id);
  await sendPlayerPhotoUrl(res, row?.picture_url);
});

// Best available source to re-crop from: the retained pre-crop original if we have
// one, otherwise the already-cropped square (older photos uploaded before originals
// were retained).
app.get('/api/player/:id/photo-source', async (req, res) => {
  const original = getPlayerPhotoOriginal(req.params.id);
  if (original) return sendPlayerPhotoUrl(res, original);
  const row = getPlayerPhoto(req.params.id);
  await sendPlayerPhotoUrl(res, row?.picture_url);
});

app.get('/api/compare', async (req, res) => {
  const { a, b, force } = req.query;
  if (!a || !b) return res.status(400).json({ error: 'Missing player IDs' });
  try {
    const pA = getPlayerWithTeam(a), pB = getPlayerWithTeam(b);
    if (!pA || !pB) return res.status(404).json({ error: 'Player not found' });
    const tA = getPlayerTotals(a), tB = getPlayerTotals(b);

    const playerData = (p, t) => ({
      name: displayPlayerName(p.name),
      team: p.team_name || '',
      totals: {
        gp: t?.games_played || 0, pts: t?.pts || 0, reb: t?.reb || 0,
        ast: t?.ast || 0, stl: t?.stl || 0, blk: t?.blk || 0, tov: t?.turnover || 0,
        fg2m: t?.fg2m || 0, fg3m: t?.fg3m || 0, fg2m_miss: t?.fg2m_miss || 0,
        fg3m_miss: t?.fg3m_miss || 0, ftm: t?.ftm || 0, ft_miss: t?.ft_miss || 0,
      },
    });

    const cached = force !== '1' && getCompareCache(a, b, tA, tB);
    if (cached) {
      incrementCompareViews(a, b);
      return res.json({ writeup: cached, cached: true, playerA: playerData(pA, tA), playerB: playerData(pB, tB) });
    }

    const pg = (t, field) => {
      const gp = t?.games_played || 0;
      return gp > 0 ? ((t?.[field] || 0) / gp).toFixed(1) : '0.0';
    };
    const fgPct = (t) => {
      if (!t) return null;
      const made = (t.fg2m || 0) + (t.fg3m || 0);
      const att  = made + (t.fg2m_miss || 0) + (t.fg3m_miss || 0);
      return att > 0 ? Math.round(made / att * 100) + '%' : null;
    };
    const line = (p, t) => {
      const name = displayPlayerName(p.name);
      const team = p.team_name || p.team_id || '';
      const gp   = t?.games_played || 0;
      const fg   = fgPct(t);
      return `${name} (${team}): ${pg(t,'pts')} PPG, ${pg(t,'reb')} RPG, ${pg(t,'ast')} APG, ${pg(t,'stl')} SPG, ${pg(t,'blk')} BPG${fg ? ', ' + fg + ' FG%' : ''}, ${gp} GP`;
    };

    // Gather recent roast openers to keep intros unique across comparisons
    const currentPair = [a, b].sort().join('|');
    const recentOpeners = getCompareAnalytics()
      .filter(r => r.writeup && r.pair_key !== currentPair)
      .sort((x, y) => (y.created_at || 0) - (x.created_at || 0))
      .slice(0, 10)
      .map(r => r.writeup.split(/(?<=[.!?])\s/)[0])
      .filter(Boolean);

    const prompt = `You are a ruthless roast comic doing a comedy roast of two players in the WKND Basketball League, a recreational league. Write 2-3 sentences roasting both players by comparing their stats. The roast is the main event — dig into weaknesses, bad shooting splits, low numbers, whatever the stats hand you, and make it sting a little. You can land a backhanded compliment if it sets up a better joke, but do not go soft or turn it into a celebration. Be specific with the numbers. Use first names only. No emojis. Start the roast immediately — no preamble, no "Alright" or "Let's" opener, no labels or headers. Output only the paragraph.

Vary your opening line every time — do not fall back on the same sentence structure or stock setup across different roasts.${recentOpeners.length ? `

OPENING LINES ALREADY USED IN RECENT ROASTS (do NOT reuse these words, structures, or patterns for your opening line):
${recentOpeners.map(o => `- "${o}"`).join('\n')}` : ''}

${line(pA, tA)}
${line(pB, tB)}`;

    const { text, model } = await generateWithGemini(prompt, { maxTokens: 280, temperature: 0.92 });
    if (text && text.length >= 40) setCompareCache(a, b, tA, tB, text, model);
    res.json({ writeup: text, playerA: playerData(pA, tA), playerB: playerData(pB, tB) });
  } catch (err) {
    console.error('compare writeup error:', err.message);
    res.status(503).json({ error: 'AI unavailable' });
  }
});

app.get('/history/game/:id', (req, res) => {
  res.redirect(301, `/games/${req.params.id}`);
});

app.get('*', (req, res, next) => {
  const gameId = req.query.gameId;
  if (req.query.view === 'game' && gameId) {
    return res.redirect(301, `/games/${encodeURIComponent(gameId)}`);
  }
  next();
});

// ── Admin routes ──────────────────────────────────────────────────────────────
// Only ever redirect somewhere internal — a bare "/" path, never "//host" (protocol-
// relative) or back to /login itself (which would just loop).
function safeNextPath(next) {
  if (typeof next !== 'string' || !next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/login')) return null;
  return next;
}

app.get('/login', (req, res) => {
  const next = req.query.next;
  if (req.session?.isAdmin && !req.session?.isElevatedPlayer) return res.redirect('/admin');
  if (req.session?.playerRegId) return res.redirect(safeNextPath(next) || '/me');
  res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ ref: req.query.ref, next }) }));
});

app.post('/login', (req, res) => {
  const { username = '', password = '', remember = '', next, ref } = req.body;
  const dest = safeNextPath(next);

  // Admin check
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    if (remember === '1') req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    insertAdminLog({ actor: username, actorType: 'super', method: 'POST', path: '/login', details: { event: 'login' } });
    return res.redirect(dest || '/admin');
  }

  // Player check (username field used as email)
  const reg = getRegistrationByEmail(username.trim());
  if (reg) {
    if (reg.status !== 'approved') {
      return res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'Your registration is not yet approved.', ref, next }) }));
    }
    if (!reg.password_hash) {
      return res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'No password set yet — check your email for the setup link.', ref, next }) }));
    }
    if (checkPlayerPassword(password, reg.password_hash)) {
      setRegistrationLastLogin(reg.id);
      req.session.playerRegId    = reg.id;
      req.session.playerPlayerId = reg.player_id;
      if (reg.is_admin) {
        req.session.isAdmin          = true;
        req.session.isElevatedPlayer = true;
        req.session.playerName       = (reg.full_name || '').split(',').reverse().map(s => s.trim()).join(' ');
      }
      if (remember === '1') req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      insertAdminLog({
        actor: reg.full_name || reg.email, actorType: reg.is_admin ? 'admin' : 'player',
        method: 'POST', path: '/login', details: { event: 'login', email: reg.email },
      });
      // Elevated player-admins (reg.is_admin) aren't true super admins — see
      // isSuperAdmin checks elsewhere (isAdmin && !isElevatedPlayer) — so they land on
      // their own profile like any other player, not the admin dashboard.
      return res.redirect(dest || '/me');
    }
  }

  res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'Invalid email or password.', ref, next }) }));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.post('/balance-bar/dismiss', express.json(), (req, res) => {
  if (!req.session?.playerRegId) return res.status(401).end();
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount)) return res.status(400).end();
  req.session.balanceBarDismissedAmount = amount;
  res.json({ ok: true });
});

app.post('/probation-bar/dismiss', (req, res) => {
  if (!req.session?.playerRegId) return res.status(401).end();
  req.session.probationBarDismissed = true;
  res.json({ ok: true });
});

// Marks every notification as read the moment the bell panel is opened (not per-item) —
// matches how most notification bells behave, and avoids extra click-tracking machinery.
app.post('/notifications/mark-read', express.json(), (req, res) => {
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) return res.status(401).end();
  markNotificationsRead(req.session.playerPlayerId);
  res.json({ ok: true });
});

app.get('/me', (req, res) => {
  if (!req.session?.playerRegId) return res.redirect('/login');
  const playerId = req.session.playerPlayerId;
  if (!playerId) return res.redirect('/login');
  const slug = getSlugForEntity('player', playerId);
  return res.redirect(slug ? `/players/${slug}` : `/players/${playerId}`);
});

// Self-service intro edit — a player editing their own profile, not the admin bio route
// at /admin/players/:id/bio. Keyed entirely off the session, no :id param — there's no
// ownership check to get wrong when the target is always "whoever's logged in."
app.post('/me/writeup', express.json(), (req, res) => {
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) {
    return res.status(401).json({ error: 'Log in to edit your profile.' });
  }
  const writeup = String(req.body?.writeup || '').trim().slice(0, 500);
  updatePlayerWriteup(req.session.playerPlayerId, writeup);
  res.json({ ok: true });
});

app.get('/set-password', (req, res) => {
  const { token = '' } = req.query;
  const reg = token ? getRegByPasswordToken(token) : null;
  if (!reg) {
    return res.status(400).send(renderPage(req, {
      title: 'Invalid Link — WKND Basketball', currentPath: '', ticker: '',
      body: setPasswordPage({ error: 'This link is invalid or has expired. Contact your league admin.' }),
    }));
  }
  const name = (reg.full_name || '').split(',')[1]?.trim() || reg.full_name || '';
  insertAdminLog({
    actor: reg.full_name || reg.email, actorType: reg.is_admin ? 'admin' : 'player',
    method: 'GET', path: '/set-password', details: { event: 'email_opened', email: reg.email },
  });
  res.send(renderPage(req, { title: 'Set Your Password — WKND Basketball', currentPath: '', ticker: '', body: setPasswordPage({ token, name }) }));
});

app.post('/set-password', express.urlencoded({ extended: false }), async (req, res) => {
  const { token = '', password = '', confirm = '' } = req.body;
  const renderErr = (error) => res.status(400).send(renderPage(req, {
    title: 'Set Your Password — WKND Basketball', currentPath: '', ticker: '',
    body: setPasswordPage({ token, error }),
  }));
  const reg = token ? getRegByPasswordToken(token) : null;
  if (!reg) return renderErr('This link is invalid or has expired.');
  if (password.length < 8) return renderErr('Password must be at least 8 characters.');
  if (password !== confirm) return renderErr('Passwords do not match.');

  const salt = randomBytes(16).toString('hex');
  const hash = await new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(`${salt}:${key.toString('hex')}`));
  });
  setRegistrationPassword(reg.id, hash);
  insertAdminLog({
    actor: reg.full_name || reg.email, actorType: reg.is_admin ? 'admin' : 'player',
    method: 'POST', path: '/set-password', details: { event: 'password_set', email: reg.email },
  });
  res.send(renderPage(req, { title: 'Password Set — WKND Basketball', currentPath: '', ticker: '', body: setPasswordDonePage() }));
});

// ── Facebook OAuth ────────────────────────────────────────────────────────────
const FB_APP_ID     = process.env.FACEBOOK_APP_ID     || '';
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const APP_URL       = process.env.APP_URL || 'http://localhost:4000';
const FB_CALLBACK   = `${APP_URL}/auth/facebook/callback`;
const FB_ENABLED    = false; // flip to true once requirements are resolved

app.get('/auth/facebook', (req, res) => {
  if (!FB_ENABLED || !FB_APP_ID) return res.status(404).send('Not found.');
  const state = req.session?.playerRegId ? 'connect' : 'login';
  if (state === 'connect') req.session.fbConnectRegId = req.session.playerRegId;
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', FB_APP_ID);
  url.searchParams.set('redirect_uri', FB_CALLBACK);
  url.searchParams.set('scope', 'public_profile,email');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/auth/facebook/callback', async (req, res) => {
  if (!FB_ENABLED) return res.status(404).send('Not found.');
  const { code, state, error } = req.query;
  if (error || !code) return res.redirect('/login?error=fb_denied');

  try {
    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FB_APP_ID);
    tokenUrl.searchParams.set('client_secret', FB_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', FB_CALLBACK);
    tokenUrl.searchParams.set('code', code);
    const tokenRes  = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token from Facebook');

    // Fetch user profile
    const meUrl = new URL('https://graph.facebook.com/me');
    meUrl.searchParams.set('fields', 'id,name,email,picture.width(400)');
    meUrl.searchParams.set('access_token', tokenData.access_token);
    const meRes  = await fetch(meUrl.toString());
    const fbUser = await meRes.json();
    if (!fbUser.id) throw new Error('Could not get Facebook user info');

    // Helper: grab FB profile photo and save to player
    async function grabFbPhoto(playerId, pictureUrl) {
      if (!playerId || !pictureUrl) return;
      const player = getPlayerById(playerId);
      if (!player || player.picture_url) return; // already has a photo
      try {
        const imgRes = await fetch(pictureUrl);
        if (!imgRes.ok) return;
        const buf  = Buffer.from(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get('content-type') || 'image/jpeg';
        updatePlayerPhoto(playerId, `data:${mime};base64,${buf.toString('base64')}`);
      } catch (e) {
        console.error('[fb photo]', e.message);
      }
    }

    const fbPicUrl = fbUser.picture?.data?.url || null;

    if (state === 'connect') {
      // Connect mode: link Facebook to the currently logged-in account
      const regId = req.session.fbConnectRegId;
      delete req.session.fbConnectRegId;
      if (!regId) return res.redirect('/login');

      // Check if another account already has this FB id
      const existing = getRegByFacebookId(fbUser.id);
      if (existing && existing.id !== regId) {
        return res.redirect('/me?fb_error=already_linked');
      }

      setFacebookId(regId, fbUser.id);
      const reg = getRegistration(regId);
      await grabFbPhoto(reg?.player_id, fbPicUrl);
      return res.redirect('/me?fb_success=connected');

    } else {
      // Login mode: sign in via Facebook
      const existing = getRegByFacebookId(fbUser.id);
      if (existing) {
        if (existing.status !== 'approved') return res.redirect('/login?error=not_approved');
        req.session.playerRegId    = existing.id;
        req.session.playerPlayerId = existing.player_id;
        if (existing.is_admin) {
          req.session.isAdmin          = true;
          req.session.isElevatedPlayer = true;
          req.session.playerName       = (existing.full_name || '').split(',').reverse().map(s => s.trim()).join(' ');
        }
        await grabFbPhoto(existing.player_id, fbPicUrl);
        return res.redirect(existing.is_admin ? '/admin' : '/me');
      }

      // No account linked — redirect to register with FB info pre-filled
      req.session.fbPending = { id: fbUser.id, name: fbUser.name, email: fbUser.email || '', picture: fbPicUrl };
      return res.redirect('/register?fb=1');
    }
  } catch (err) {
    console.error('[fb callback]', err.message);
    return res.redirect('/login?error=fb_failed');
  }
});

app.post('/auth/facebook/disconnect', express.json(), (req, res) => {
  if (!FB_ENABLED) return res.status(404).json({ error: 'Not found' });
  if (!req.session?.playerRegId) return res.status(401).json({ error: 'Not logged in' });
  clearFacebookId(req.session.playerRegId);
  res.json({ ok: true });
});

app.get('/admin', requireAuth, (req, res) => {
  const players        = getAllPlayers();
  const teams          = getAllTeams();
  const recentGames    = getRecentPlayedGames();
  const upcoming       = getScheduledGames();
  const financeSummary = getAllSummary();
  const pendingTx      = getPendingTransactions();
  const underReview    = getGamesUnderReviewCount();
  const activePlayers  = getActivePlayerCount();
  const gamesPlayed    = getPlayedGamesCount();
  const pendingUsers   = getAllRegistrations().filter(r => r.status === 'pending').length;
  const openFineCases  = getFineCasesByStatus('open');
  const today          = manilaTodayStr();
  const nextPapawis    = getPapawisGames()
    .filter(g => g.date >= today && g.status !== 'cancelled' && g.status !== 'completed')
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)[0] || null;
  const isSuperAdmin   = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  const recentActivity = isSuperAdmin ? getAdminLogs(8) : [];
  res.send(renderAdminPage(req, {
    title: 'Dashboard',
    currentPath: '/admin',
    body: adminDashboardBody({
      players, teams, recentGames, upcoming, financeSummary, pendingTx, underReview, activePlayers, gamesPlayed,
      pendingUsers, openFineCases, nextPapawis, isSuperAdmin, recentActivity,
    }),
  }));
});

// ── Admin: Registrations ──────────────────────────────────────────────────────
app.get('/admin/registrations', requireAuth, (req, res) => res.redirect('/admin/users'));

app.get('/admin/users', requireAuth, (req, res) => {
  const registrations = getAllRegistrations();
  const withFlags = registrations.map(r => ({ ...r, bogusFlags: detectBogusFlags(r, registrations) }));
  res.send(renderAdminPage(req, {
    title: 'Users',
    currentPath: '/admin/users',
    body: adminUsersBody({ registrations: withFlags, canViewSensitive: canViewSensitiveData(req) }),
  }));
});

// Compares only the fields a linked registration would actually push into the player
// record (mirrors mergeRegistrationIntoPlayer's own skip-if-blank behavior) — an empty
// registration field is never a "mismatch", it just means that field was never collected.
function computeSyncDiff(reg, player) {
  if (!player) return { inSync: true, mismatches: [] };
  const mismatches = [];
  const parts     = (reg.full_name || '').split(',');
  const regLast   = (parts[0] || '').trim();
  const regFirst  = (parts[1] || '').trim();
  if ((regFirst || regLast) && (regFirst !== (player.first_name || '') || regLast !== (player.last_name || ''))) mismatches.push('name');
  if (reg.birthday && reg.birthday !== (player.birthday || '')) mismatches.push('birthday');
  if (reg.motto && reg.motto.trim() !== (player.writeup || '')) mismatches.push('bio');
  let regPositions = [];
  try { regPositions = JSON.parse(reg.positions || '[]'); } catch {}
  let playerPositions = [];
  try { playerPositions = JSON.parse(player.positions || '[]'); } catch {}
  if (regPositions.length && JSON.stringify([...regPositions].sort()) !== JSON.stringify([...playerPositions].sort())) mismatches.push('positions');
  if (reg.height && reg.height !== (player.height || '')) mismatches.push('height');
  if (reg.weight && reg.weight !== (player.weight || '')) mismatches.push('weight');
  if (reg.dominant_hand && reg.dominant_hand !== (player.dominant_hand || '')) mismatches.push('dominant hand');
  return { inSync: mismatches.length === 0, mismatches };
}

app.get('/admin/users/:id', requireAuth, (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/users', body: '<p class="text-slate-500">Registration not found.</p>' }));
  const players      = getAllPlayers();
  const linkedPlayer = reg.player_id ? players.find(p => p.id === reg.player_id) : null;
  const isSuperAdmin = !req.session?.isElevatedPlayer;
  const { inSync }   = reg.player_id ? computeSyncDiff(reg, getPlayerWithTeam(reg.player_id)) : { inSync: true };
  const bogusFlags    = detectBogusFlags(reg, getAllRegistrations());
  const canViewSensitive = canViewSensitiveData(req);
  res.send(renderAdminPage(req, {
    title: reg.full_name,
    currentPath: '/admin/users',
    body: adminUserDetailBody({ reg, players, linkedPlayer, isSuperAdmin, inSync, bogusFlags, canViewSensitive }),
  }));
});

function makeSetPasswordUrl(req, regId) {
  const token = randomBytes(32).toString('hex');
  setPasswordToken(regId, token, Date.now() + 48 * 60 * 60 * 1000);
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return { token, url: `${proto}://${host}/set-password?token=${token}` };
}

app.post('/admin/users/:id/approve', requireAuth, express.json(), async (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  const player_id = req.body?.player_id || '';
  updateRegistration(reg.id, { status: 'approved', player_id, notes: reg.notes || '', approved_at: Date.now() });
  if (player_id) mergeRegistrationIntoPlayer(player_id, reg);
  if (reg.email) {
    const name = (reg.full_name || reg.email).split(',')[1]?.trim() || reg.full_name || 'Player';
    const { url: setPasswordUrl } = makeSetPasswordUrl(req, reg.id);
    sendMail({ to: reg.email, ...approvedEmail({ name, setPasswordUrl }) }).catch(e => console.error('[mailer]', e.message));
  }
  res.json({ ok: true });
});

app.post('/admin/users/:id/create', requireAuth, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });

  const parts     = (reg.full_name || '').split(',');
  const last_name  = (parts[0] || '').trim();
  const first_name = (parts[1] || '').trim();
  let positions = [];
  try { positions = JSON.parse(reg.positions || '[]'); } catch {}

  const newPlayerId = crypto.randomUUID();
  createPlayer({
    id:         newPlayerId,
    first_name,
    last_name,
    birthday:   reg.birthday || '',
    positions,
    number:     reg.jersey_pref || '',
    status:     'active',
  });

  updateRegistration(reg.id, { status: 'approved', player_id: newPlayerId, notes: 'Player record created from registration.', approved_at: Date.now() });
  mergeRegistrationIntoPlayer(newPlayerId, reg);
  if (reg.email) {
    const name = (reg.full_name || reg.email).split(',')[1]?.trim() || reg.full_name || 'Player';
    const { url: setPasswordUrl } = makeSetPasswordUrl(req, reg.id);
    sendMail({ to: reg.email, ...approvedEmail({ name, setPasswordUrl }) }).catch(e => console.error('[mailer]', e.message));
  }
  res.json({ ok: true, player_id: newPlayerId });
});

app.post('/admin/users/:id/sync', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (!reg.player_id) return res.status(400).json({ error: 'No player linked to this registration.' });
  mergeRegistrationIntoPlayer(reg.player_id, reg);
  res.json({ ok: true });
});

// Fixes a mislinked/mistakenly-created player after approval without touching status or
// re-sending the approval email (unlike reset-to-pending + re-approve, which does both).
app.post('/admin/users/:id/relink', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (reg.status !== 'approved') return res.status(400).json({ error: 'Only approved registrations can be relinked.' });
  const player_id = req.body?.player_id || '';
  if (!player_id) return res.status(400).json({ error: 'Select a player to link to.' });
  const player = getPlayerWithTeam(player_id);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  relinkRegistrationPlayer(reg.id, player_id);
  mergeRegistrationIntoPlayer(player_id, reg);
  res.json({ ok: true });
});

app.post('/admin/users/:id/reset', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  updateRegistration(reg.id, { status: 'pending', player_id: '', notes: '', approved_at: 0 });
  res.json({ ok: true });
});

app.post('/admin/users/:id/send-reset', requireAuth, express.json(), async (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (reg.status !== 'approved') return res.status(400).json({ error: 'User must be approved first.' });
  if (!reg.email) return res.status(400).json({ error: 'This user has no email on file.' });
  const name = (reg.full_name || reg.email).split(',')[1]?.trim() || reg.full_name || 'Player';
  const { url: setPasswordUrl } = makeSetPasswordUrl(req, reg.id);
  try {
    await sendMail({ to: reg.email, ...resetPasswordEmail({ name, setPasswordUrl, isReset: !!reg.password_hash }) });
  } catch (e) {
    console.error('[mailer]', e.message);
    return res.status(500).json({ error: 'Failed to send email.' });
  }
  res.json({ ok: true });
});

app.post('/admin/users/:id/reject', requireAuth, express.json(), async (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  const notes = req.body?.notes || '';
  updateRegistration(reg.id, { status: 'rejected', player_id: reg.player_id || '', notes });
  if (reg.email) {
    const name = (reg.full_name || reg.email).split(',')[1]?.trim() || reg.full_name || 'Player';
    sendMail({ to: reg.email, ...rejectedEmail({ name, reason: notes }) }).catch(e => console.error('[mailer]', e.message));
  }
  res.json({ ok: true });
});

app.post('/admin/users/:id/birthday', requireAuth, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  const birthday = String(req.body?.birthday || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return res.status(400).json({ error: 'Invalid date format.' });
  updateRegBirthday(reg.id, birthday, reg.player_id || null);
  res.json({ ok: true, birthday });
});

app.post('/admin/users/:id/toggle-admin', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (reg.status !== 'approved') return res.status(400).json({ error: 'User must be approved first.' });
  setRegistrationAdmin(reg.id, !reg.is_admin);
  res.json({ ok: true, is_admin: !reg.is_admin });
});

app.post('/admin/users/:id/toggle-sensitive', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (!reg.is_admin) return res.status(400).json({ error: 'User must be an admin first.' });
  setRegistrationSensitiveAccess(reg.id, !reg.can_view_sensitive);
  res.json({ ok: true, can_view_sensitive: !reg.can_view_sensitive });
});

// Restricts an elevated player-admin to only the given admin-nav sections (e.g. Papawis
// only) — empty/omitted sections clears the restriction back to full access. Superadmin-only
// (an admin can't touch their own scope), and only meaningful for an is_admin user — the
// true super-admin login has no registrations row here to restrict in the first place.
app.post('/admin/users/:id/sections', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (!reg.is_admin) return res.status(400).json({ error: 'User must be an admin first.' });
  const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
  const validKeys = new Set(ADMIN_SECTIONS.map(s => s.key));
  if (sections.some(s => !validKeys.has(s))) return res.status(400).json({ error: 'Unknown section.' });
  setRegistrationAdminSections(reg.id, sections);
  res.json({ ok: true, sections });
});

app.get('/admin/coach-notes', requireAuth, (req, res) => {
  const analyses = getAllCoachAnalyses();
  res.send(renderAdminPage(req, {
    title: 'Coach Notes',
    currentPath: '/admin/coach-notes',
    body: adminCoachNotesBody({ analyses, focusLabels: FOCUS_LABELS, focusVideos: FOCUS_VIDEOS }),
  }));
});

app.get('/admin/privileges', requireSuperAdmin, (req, res) => {
  const registrations = getAllRegistrations();
  const admins     = registrations.filter(r => r.is_admin).map(r => ({ ...r, adminSections: getRegistrationAdminSections(r) }));
  const candidates = registrations.filter(r => r.status === 'approved' && !r.is_admin);
  res.send(renderAdminPage(req, {
    title: 'Admin Privileges',
    currentPath: '/admin/privileges',
    body: adminPrivilegesBody({ admins, candidates, sections: ADMIN_SECTIONS }),
  }));
});

app.get('/admin/logs', requireSuperAdmin, (req, res) => {
  const userId = req.query.user;
  const filterReg = userId ? getRegistration(userId) : null;
  const logs = filterReg ? getAdminLogsForUser(filterReg.id, filterReg.email, 500) : getAdminLogs(500);
  res.send(renderAdminPage(req, {
    title: 'Admin Logs',
    currentPath: '/admin/logs',
    body: adminLogsPage({ logs, filterLabel: filterReg ? filterReg.full_name : null }),
  }));
});

// ── DB sync (local-only UI + production export endpoint) ──────────────────

// Production-side: exports DB to any caller with the correct key.
// Key never leaves the server on the local side (proxied below).
app.get('/api/db/export', async (req, res) => {
  const key = process.env.DB_EXPORT_KEY;
  if (!key || req.headers['x-export-key'] !== key) return res.status(401).end();
  const backupPath = path.join(os.tmpdir(), `portal-export-${Date.now()}.db`);
  try {
    await portalDb.backup(backupPath);
    res.download(backupPath, 'portal.db', () => { try { unlinkSync(backupPath); } catch {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local-only page — hidden in production
app.get('/admin/db', requireSuperAdmin, (req, res) => {
  if (!IS_DEV) return res.status(404).end();
  const configured = !!(process.env.LIVE_URL && process.env.DB_EXPORT_KEY);
  const liveUrl    = process.env.LIVE_URL || '';
  const body = `
<div class="mb-6">
  <h2 class="text-xl font-bold text-slate-100 m-0 mb-1">Sync DB from Live</h2>
  <p class="text-sm text-slate-500 m-0">Pull the production database into your local environment.</p>
</div>
${!configured ? `
<div class="bg-admin-surface border border-amber-500/30 rounded-xl p-5 max-w-lg text-sm">
  <p class="m-0 mb-2 font-semibold text-amber-400">Setup required</p>
  <p class="m-0 mb-3 text-slate-400">Add these to your <strong>local</strong> <code class="text-xs bg-admin-bg px-1.5 py-0.5 rounded">.env</code>:</p>
  <pre class="text-xs bg-admin-bg rounded-lg p-3 m-0 text-slate-300 overflow-x-auto">LIVE_URL=https://your-production-domain.com
DB_EXPORT_KEY=some-long-random-secret</pre>
  <p class="m-0 mt-3 text-xs text-slate-500">Also add <code>DB_EXPORT_KEY</code> to your <strong>production</strong> <code>.env</code> with the same value, then restart the production server.</p>
</div>` : `
<div class="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-md">
  <div class="mb-5 text-sm">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Source</div>
    <div class="text-slate-300 font-mono text-xs">${escHtml(liveUrl)}</div>
  </div>
  <button id="sync-btn" class="agm-new-btn">↓ Sync DB from Live</button>
  <p id="sync-msg" class="text-[11px] mt-3 mb-0 text-slate-500"></p>
  <p class="text-[11px] text-slate-600 mt-2 mb-0">After downloading, replace your local <code class="text-xs bg-admin-bg px-1 rounded">data/portal.db</code> and restart the server.</p>
</div>
<script>
document.getElementById('sync-btn').addEventListener('click', async function() {
  var btn = this, msg = document.getElementById('sync-msg');
  btn.textContent = 'Syncing…'; btn.disabled = true;
  msg.textContent = ''; msg.className = 'text-[11px] mt-3 mb-0 text-slate-500';
  try {
    var r = await fetch('/admin/db/sync', { method: 'POST' });
    if (!r.ok) { var d = await r.json(); throw new Error(d.error || 'Sync failed'); }
    var blob = await r.blob();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'portal.db'; a.click();
    btn.textContent = '✓ Downloaded';
    msg.textContent = 'Replace data/portal.db with the downloaded file, then restart the server.';
    msg.className = 'text-[11px] mt-3 mb-0 text-green-400';
  } catch(err) {
    btn.textContent = '↓ Sync DB from Live'; btn.disabled = false;
    msg.textContent = 'Error: ' + err.message;
    msg.className = 'text-[11px] mt-3 mb-0 text-red-400';
  }
});
</script>`}`;
  res.send(renderAdminPage(req, { title: 'Sync DB', body }));
});

// Local-only proxy — fetches production DB server-side so the key never hits the browser
app.post('/admin/db/sync', requireSuperAdmin, async (req, res) => {
  if (!IS_DEV) return res.status(404).end();
  const liveUrl = (process.env.LIVE_URL || '').replace(/\/$/, '');
  const key     = process.env.DB_EXPORT_KEY;
  if (!liveUrl || !key) return res.status(500).json({ error: 'LIVE_URL and DB_EXPORT_KEY not configured' });
  try {
    const upstream = await fetch(`${liveUrl}/api/db/export`, { headers: { 'x-export-key': key } });
    if (!upstream.ok) throw new Error(`Production returned HTTP ${upstream.status}`);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="portal.db"');
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const TEAM_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function playerPositions(p) {
  try { return JSON.parse(p.positions || '[]'); } catch { return []; }
}

function computeAwardSuggestions(stats, { mvpCandidates = null, finals = null } = {}) {
  if (!stats.length) return {};
  const f   = (v, gp) => gp > 0 ? v / gp : 0;
  const ppg = p => f(p.pts, p.games_played);
  const apg = p => f(p.ast, p.games_played);
  const rpg = p => f(p.reb, p.games_played);
  const dpg = p => f((p.stl ?? 0) * 1.5 + (p.blk ?? 0) * 2, p.games_played);

  // Shooting efficiency multiplier — mirrors computeMvpScore so suggestions stay consistent.
  const tsMult = p => {
    const fga   = (p.fg2m ?? 0) + (p.fg3m ?? 0) + (p.fg2m_miss ?? 0) + (p.fg3m_miss ?? 0);
    const fta   = (p.ftm ?? 0) + (p.ft_miss ?? 0);
    const denom = 2 * (fga + 0.44 * fta);
    const ts    = denom > 0 ? (p.pts ?? 0) / denom : 0;
    if (ts >= 0.70) return 1.20;
    if (ts >= 0.60) return 1.10;
    if (ts >= 0.50) return 1.00;
    if (ts >= 0.40) return 0.85;
    return 0.70;
  };

  // Same base coefficients as computeMvpScore so all three MVP surfaces rank consistently.
  const impact = p => f(
    (p.pts ?? 0) + (p.reb ?? 0) * 0.8 + (p.ast ?? 0) * 0.9 + (p.stl ?? 0) * 1.5 + (p.blk ?? 0) * 2.0
    - (p.turnover ?? 0),
    p.games_played
  ) * tsMult(p);

  // Use the pre-computed overall_ovr rating when available; fall back to impact score.
  const ovr = p => p.overall_ovr != null ? p.overall_ovr : impact(p) * 3;

  const sorted   = fn => [...stats].sort((a, b) => fn(b) - fn(a));
  const fmt1     = n  => n.toFixed(1);
  const top      = fn => { const p = sorted(fn)[0]; return p ? { player: p, statLine: '' } : null; };
  const addLine  = (entry, label) => entry ? { ...entry, statLine: label } : null;

  const byOvr    = sorted(ovr);

  const pickByPosition = (pool, usedIds) => TEAM_POSITIONS.map(pos => {
    const candidate = pool.find(p => !usedIds.has(p.id) && playerPositions(p).includes(pos))
                   ?? pool.find(p => !usedIds.has(p.id));
    if (!candidate) return null;
    usedIds.add(candidate.id);
    return {
      player:   candidate,
      position: pos,
      statLine: `${fmt1(ppg(candidate))} PPG · ${fmt1(rpg(candidate))} RPG · ${fmt1(apg(candidate))} APG`,
      ovr:      candidate.overall_ovr ?? Math.round(impact(candidate) * 3),
      ppg:      fmt1(ppg(candidate)),
      rpg:      fmt1(rpg(candidate)),
      apg:      fmt1(apg(candidate)),
    };
  }).filter(Boolean);

  const usedTeam = new Set();
  const team1    = pickByPosition(byOvr, usedTeam);
  const team2    = pickByPosition(byOvr, usedTeam);

  const tpm  = p => f(p.fg3m ?? 0, p.games_played);
  const spg  = p => f(p.stl ?? 0, p.games_played);
  const bpg  = p => f(p.blk ?? 0, p.games_played);

  const scorers    = sorted(ppg);
  const assisters  = sorted(apg);
  const rebounders = sorted(rpg);
  const defenders  = sorted(dpg);
  const stealers   = sorted(spg);
  const blockers   = sorted(bpg);
  const threeShooters = sorted(tpm);
  const mvpPlayer  = byOvr[0];

  // Defensive team: same position-based selection but ranked by dpg score.
  const pickDefByPosition = (pool, usedIds) => TEAM_POSITIONS.map(pos => {
    const candidate = pool.find(p => !usedIds.has(p.id) && playerPositions(p).includes(pos))
                   ?? pool.find(p => !usedIds.has(p.id));
    if (!candidate) return null;
    usedIds.add(candidate.id);
    const spg = f(candidate.stl ?? 0, candidate.games_played);
    const bpg = f(candidate.blk ?? 0, candidate.games_played);
    return {
      player:   candidate,
      position: pos,
      statLine: `${fmt1(spg)} SPG · ${fmt1(bpg)} BPG`,
      ovr:      candidate.overall_ovr ?? Math.round(impact(candidate) * 3),
      ppg:      fmt1(ppg(candidate)),
      rpg:      fmt1(rpg(candidate)),
      apg:      fmt1(apg(candidate)),
      spg:      fmt1(spg),
      bpg:      fmt1(bpg),
    };
  }).filter(Boolean);
  const usedDefTeam = new Set();
  const defTeam = pickDefByPosition(defenders, usedDefTeam);

  return {
    scoring_champ:   addLine(top(ppg), scorers[0]      ? `${fmt1(ppg(scorers[0]))} PPG`          : ''),
    assists_leader:  addLine(top(apg), assisters[0]    ? `${fmt1(apg(assisters[0]))} APG`         : ''),
    rebounds_leader: addLine(top(rpg), rebounders[0]   ? `${fmt1(rpg(rebounders[0]))} RPG`        : ''),
    steals_leader:   addLine(top(spg), stealers[0]     ? `${fmt1(spg(stealers[0]))} SPG`          : ''),
    blocks_leader:   addLine(top(bpg), blockers[0]     ? `${fmt1(bpg(blockers[0]))} BPG`          : ''),
    three_pm_leader: addLine(top(tpm), threeShooters[0]? `${fmt1(tpm(threeShooters[0]))} 3PM`     : ''),
    dpoy:            addLine(top(dpg), defenders[0]
      ? `${fmt1(f(defenders[0].stl, defenders[0].games_played))} SPG · ${fmt1(f(defenders[0].blk, defenders[0].games_played))} BPG` : ''),
    mvp: (() => {
      if (mvpCandidates && mvpCandidates.length) {
        const top = [...mvpCandidates]
          .map(s => ({ ...s, mvpScore: computeMvpScore(s) }))
          .filter(s => s.gp >= 1)
          .sort((a, b) => b.mvpScore - a.mvpScore)[0];
        if (top) {
          const gp = top.gp;
          return {
            player:   { ...top, games_played: gp },
            statLine: `${(top.pts / gp).toFixed(1)} PPG · ${(top.reb / gp).toFixed(1)} RPG · ${(top.ast / gp).toFixed(1)} APG`,
          };
        }
      }
      return mvpPlayer ? {
        player:   mvpPlayer,
        statLine: `${fmt1(ppg(mvpPlayer))} PPG · ${fmt1(rpg(mvpPlayer))} RPG · ${fmt1(apg(mvpPlayer))} APG`,
      } : null;
    })(),
    all_wknd_1:   team1,
    all_wknd_2:   team2,
    all_wknd_def: defTeam,
    champion: finals?.winnerTeamId
      ? finals.roster.map(p => ({ player: { ...p, team_name: finals.winnerTeamName }, statLine: '', provisional: !finals.decided }))
      : null,
    finals_mvp: (() => {
      if (!finals?.candidates?.length) return null;
      const top = [...finals.candidates]
        .map(s => ({ ...s, mvpScore: computeMvpScore(s) }))
        .filter(s => s.gp >= 1)
        .sort((a, b) => b.mvpScore - a.mvpScore)[0];
      if (!top) return null;
      const gp = top.gp;
      return {
        player:      { ...top, games_played: gp },
        statLine:    `${(top.pts / gp).toFixed(1)} PPG · ${(top.reb / gp).toFixed(1)} RPG · ${(top.ast / gp).toFixed(1)} APG`,
        provisional: !finals.decided,
      };
    })(),
  };
}

// Finals series context for the Champion/Finals MVP suggestions. Once the series has
// a leader (someone's won at least one game), suggest that team's roster/MVP candidate
// as a provisional pick — `decided` tells the caller whether it's official yet or just
// "leading so far." Returns null only when finals games haven't started or are tied 0-0,
// i.e. there's no leader to suggest anything from.
function getFinalsSuggestionContext(season) {
  const result = getFinalsSeriesResult(season);
  if (!result) return null;
  const leadTeamId = result.winnerTeamId
    ?? (result.teamAWins > result.teamBWins ? result.teamAId
      : result.teamBWins > result.teamAWins ? result.teamBId
      : null);
  if (!leadTeamId) return null;
  const leadTeamName = leadTeamId === result.teamAId ? result.teamAName : result.teamBName;
  return {
    decided:        result.decided,
    winnerTeamId:   leadTeamId,
    winnerTeamName: leadTeamName,
    roster:         getActivePlayers().filter(p => p.team_id === leadTeamId),
    candidates:     getFinalsMvpCandidates(season).filter(c => c.team_id === leadTeamId),
  };
}

app.get('/admin/awards', requireAuth, (req, res) => {
  const { season: currentSeason } = getCurrentSeason() || {};
  const season = Number(req.query.season) || currentSeason || 3;
  const seasons = [...new Set(getLedgerSeasons())];
  const awards      = getSeasonAwards(season);
  const players     = getActivePlayers();
  const seasonStats = getSeasonPlayerStats(season);
  const suggestions = computeAwardSuggestions(seasonStats, {
    mvpCandidates: getMvpCandidates(season),
    finals: getFinalsSuggestionContext(season),
  });
  const articles = Object.fromEntries(AWARD_SECTION_KEYS.map(k => [k, getSetting(`award_article_${k}_${season}`, '')]));
  // Also load per-player articles for confirmed team award entries (stored under <type>_<player_id> keys).
  for (const award of awards) {
    if (['all_wknd_1', 'all_wknd_2', 'all_wknd_def', 'champion'].includes(award.award_type)) {
      const key = `${award.award_type}_${award.player_id}`;
      articles[key] = getSetting(`award_article_${key}_${season}`, '');
    }
  }
  const homeGallery = Object.fromEntries(
    AWARD_SECTION_KEYS.map(k => [k, getSetting(`award_home_${k}_${season}`, '0') === '1'])
  );
  res.send(renderAdminPage(req, {
    title: 'Season Awards',
    currentPath: '/admin/awards',
    body: adminAwardsBody({ season, seasons, awards, suggestions, players, articles, seasonStats, homeGallery }),
  }));
});

const AWARD_TEAM_TYPES = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def']);

app.post('/admin/awards', requireAuth, express.json(), (req, res) => {
  const { season, award_type, player_id, position, clear_first, from_suggestion } = req.body || {};
  if (!season || !award_type) return res.status(400).json({ error: 'Missing fields' });

  if (from_suggestion) {
    const stats = getSeasonPlayerStats(season);
    const sugg  = computeAwardSuggestions(stats, {
      mvpCandidates: getMvpCandidates(season),
      finals: getFinalsSuggestionContext(season),
    })[award_type];
    const list  = Array.isArray(sugg) ? sugg : (sugg ? [sugg] : []);
    if (list.some(e => e.provisional)) return res.status(400).json({ error: 'Finals series not decided yet' });
    clearAwardType(season, award_type);
    for (const entry of list) {
      if (!entry.player) continue;
      const pid  = entry.player.id;
      const pos  = entry.position || '';
      const id   = AWARD_TEAM_TYPES.has(award_type) ? `${season}_${award_type}_${pos}` : `${season}_${award_type}_${pid}`;
      upsertAward({ id, season, award_type, player_id: pid, notes: pos });
    }
    return res.json({ ok: true });
  }

  const { clear_only } = req.body || {};
  if (clear_only) {
    clearAwardType(season, award_type);
    return res.json({ ok: true });
  }

  if (clear_first && !AWARD_TEAM_TYPES.has(award_type) && !ROSTER_AWARD_TYPES.has(award_type)) clearAwardType(season, award_type);

  if (player_id) {
    const notes = position || '';
    const id    = AWARD_TEAM_TYPES.has(award_type) && position
      ? `${season}_${award_type}_${position}`
      : `${season}_${award_type}_${player_id}`;
    upsertAward({ id, season, award_type, player_id, notes });
    if (SINGLE_PHOTO_AWARD_TYPES.has(award_type)) clearAwardOgCache(season, award_type, player_id);
  }
  res.json({ ok: true });
});

app.delete('/admin/awards/:id', requireAuth, (req, res) => {
  deleteAward(req.params.id);
  res.json({ ok: true });
});

function getAwardGraphicRows(season, type) {
  if (type === 'stat-leaders') {
    const all = getSeasonAwards(season);
    return STAT_LEADER_TYPES.map(t => all.find(a => a.award_type === t)).filter(Boolean);
  }
  if (SINGLE_PHOTO_AWARD_TYPES.has(type)) {
    const row = getSeasonAwards(season).find(a => a.award_type === type);
    return row ? [row] : [];
  }
  if (!AWARD_OG_BADGE[type] || !TEAM_AWARD_TYPES_OG.has(type)) return null;
  return getSeasonAwards(season)
    .filter(a => a.award_type === type)
    .sort((a, b) => (POSITION_ORDER_OG_MAP[a.notes] ?? 99) - (POSITION_ORDER_OG_MAP[b.notes] ?? 99))
    .slice(0, 5);
}

function clearAwardOgCache(season, type, playerId) {
  if (SINGLE_PHOTO_AWARD_TYPES.has(type)) {
    if (playerId) _awardOgCache.delete(`player-${season}-${type}-${playerId}`);
    return;
  }
  const cacheKey = type === 'stat-leaders' ? `stat-leaders-${season}`
    : `team-${season}-${type}`;
  _awardOgCache.delete(cacheKey);
}

const px2cqw = px => +(px / 1200 * 100).toFixed(3);
const OG_NAVY = '#020817';
const hexA = (hex, opacity) => hex + Math.round(opacity * 255).toString(16).padStart(2, '0');

// Vertical fade + team-color glow, matching buildTeamAwardOgSvg's per-strip gradient stops
// exactly. Used for every strip-style photo panel (team grids, and MVP/DPOY's photo slots
// when it has more than one).
function stripShadeGradient(teamColor) {
  const tc = teamColor || '#4a5263';
  return `linear-gradient(to bottom, ${hexA(OG_NAVY,0)} 0%, ${hexA(OG_NAVY,0)} 42%, ${hexA(OG_NAVY,.72)} 72%, ${hexA(OG_NAVY,.96)} 100%),` +
         `linear-gradient(to bottom, ${hexA(tc,0)} 0%, ${hexA(tc,0)} 65%, ${hexA(tc,.28)} 100%)`;
}
// Full-bleed single-photo vignette, matching buildPlayerAwardOgSvg's 4-layer gradient
// (bot-fade, team-glow, edge-l, edge-r — painted in that order, so the CSS list is reversed).
function heroShadeGradient(teamColor) {
  const tc = teamColor || '#4a5263';
  return `linear-gradient(to right, ${hexA(OG_NAVY,0)} 78%, ${hexA(OG_NAVY,.55)} 100%),` +
         `linear-gradient(to right, ${hexA(OG_NAVY,.55)} 0%, ${hexA(OG_NAVY,0)} 22%),` +
         `linear-gradient(to bottom, ${hexA(tc,0)} 70%, ${hexA(tc,.28)} 100%),` +
         `linear-gradient(to bottom, ${hexA(OG_NAVY,0)} 42%, ${hexA(OG_NAVY,.97)} 100%)`;
}

app.get('/admin/awards/:season/:type/graphic', requireAuth, (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  const rows = season ? getAwardGraphicRows(season, type) : null;
  if (!rows || !rows.length) {
    return res.status(404).send(renderAdminPage(req, {
      title: 'Not Found', currentPath: '/admin/awards',
      body: '<p style="padding:40px;color:var(--text-muted)">No players found for this award graphic.</p>',
    }));
  }

  const isSingle = SINGLE_PHOTO_AWARD_TYPES.has(type);
  const badgeLabel = type === 'stat-leaders' ? 'Statistical Leaders' : AWARD_OG_BADGE[type].label;
  const badgeColor = type === 'stat-leaders' ? '#f59332' : AWARD_OG_BADGE[type].bg;
  const bannerFs = { eyebrow: px2cqw(9), title: px2cqw(22), season: px2cqw(18) };

  // ── MVP/DPOY: one confirmed player, 1..MAX photo slots for a multi-image cover ──────────
  if (isSingle) {
    const row = rows[0];
    const columnCount = getAwardColumnCount(season, type);
    const overridesBySlot = getAwardPhotoOverridesForPlayer(season, type, row.player_id);

    const name  = formatName(row.player_name || '');
    const parts = name.split(' ');
    const last  = (parts.length > 1 ? parts[parts.length - 1] : name).toUpperCase();
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const lastPx = last.length > 12 ? 64 : last.length > 9 ? 74 : 90;

    const hero = {
      _playerId: row.player_id,
      teamName: String(row.team_name || '').toUpperCase(),
      teamColor: row.team_color || '#4a5263',
      pillLabel: badgeLabel,
      pillColor: badgeColor,
      pillIcon: type === 'mvp' ? 'crown' : type === 'dpoy' ? 'shield' : null,
      pillTextColor: AWARD_OG_BADGE[type]?.text || '#10141d',
      first, last,
      statLine: ogStatLine(row, type),
      teamFs: px2cqw(18), pillFs: px2cqw(13), pillHFs: px2cqw(32), statsFs: px2cqw(19), firstFs: px2cqw(28), lastFs: px2cqw(lastPx),
      pillGap: px2cqw(10), firstGap: px2cqw(12),
      lastGap:  px2cqw(Math.round(78.4 - 0.8 * lastPx)),
      statsGap: px2cqw(Math.round(30.8 - 0.2 * lastPx)),
    };

    const photoSlots = Array.from({ length: columnCount }, (_, slot) => {
      const override = overridesBySlot[slot] || null;
      return {
        slot,
        teamColor: row.team_color || '#4a5263',
        shadeCss: columnCount > 1 ? stripShadeGradient(row.team_color) : heroShadeGradient(row.team_color),
        photoUrl: (override && override.photo_url) || `/api/player/${encodeURIComponent(row.player_id)}/photo`,
        offsetX: override ? override.offset_x : 50,
        offsetY: override ? override.offset_y : 50,
        zoom: override ? override.zoom : 1,
      };
    });

    const ogImagePath = `/api/awards/${season}/${type}/${encodeURIComponent(row.player_id)}/og-image.png`;

    return res.send(renderAdminPage(req, {
      title: 'Edit Award Graphic',
      currentPath: '/admin/awards',
      body: awardGraphicEditorBody({
        season, type, badgeLabel, badgeColor, ogImagePath, bannerFs,
        mode: 'hero', hero, photoSlots, columnCount, maxColumns: MAX_AWARD_COLUMNS,
      }),
    }));
  }

  // ── Team grids / stat leaders: unchanged N-different-players strip layout ───────────────
  const kind = type === 'stat-leaders' ? 'stat' : 'strip';
  const overrides = getAwardPhotoOverrides(season, type);
  const FS_PX = {
    strip: { pill: 10, pillH: 24, stats: 13, first: 13, last: 21 },
    stat:  { pill: 9,  pillH: 24, statVal: 30, statUnit: 10, first: 10, last: 14 },
  }[kind];
  const GAP_PX = {
    strip: { stats: 14, first: 11, last: 9 },
    stat:  { statVal: 8, statUnit: 10, first: 10, last: 9 },
  }[kind];

  const columns = rows.map(row => {
    const name  = formatName(row.player_name || '');
    const parts = name.split(' ');
    const last  = (parts.length > 1 ? parts[parts.length - 1] : name).toUpperCase();
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const b = kind === 'stat' ? (AWARD_OG_BADGE[row.award_type] || null) : null;
    const pillLabel = kind === 'stat'
      ? (b?.label || row.award_type.toUpperCase())
      : (row.notes && POS_FULL_OG[row.notes] ? POS_FULL_OG[row.notes] : '');
    const pillColor = kind === 'stat' ? (b?.bg || badgeColor) : badgeColor;
    const lastPx = FS_PX.last;
    const statSplit = kind === 'stat' ? statLeaderValueUnit(row) : null;
    const override = overrides[row.player_id] || null;
    return {
      player_id: row.player_id,
      first, last,
      pillLabel, pillColor, pillIcon: null, pillTextColor: null,
      teamName: '',
      statLine: statSplit ? '' : ogStatLine(row, type),
      statVal: statSplit ? statSplit.val : '',
      statUnit: statSplit ? statSplit.unit : '',
      teamColor: row.team_color || '#4a5263',
      shadeCss: stripShadeGradient(row.team_color),
      photoUrl: (override && override.photo_url) || `/api/player/${encodeURIComponent(row.player_id)}/photo`,
      offsetX: override ? override.offset_x : 50,
      offsetY: override ? override.offset_y : 50,
      zoom: override ? override.zoom : 1,
      hasCustomPhoto: !!(override && override.photo_url),
      teamFs: px2cqw(12),
      pillFs: px2cqw(FS_PX.pill),
      pillHFs: px2cqw(FS_PX.pillH),
      statsFs: px2cqw(FS_PX.stats || 13),
      statValFs: px2cqw(FS_PX.statVal || 30),
      statUnitFs: px2cqw(FS_PX.statUnit || 10),
      firstFs: px2cqw(FS_PX.first),
      lastFs: px2cqw(lastPx),
      pillGap:  px2cqw(GAP_PX.pill ?? 0),
      statsGap: px2cqw(GAP_PX.stats ?? 0),
      statValGap: px2cqw(GAP_PX.statVal ?? 0),
      statUnitGap: px2cqw(GAP_PX.statUnit ?? 0),
      firstGap: px2cqw(GAP_PX.first ?? 0),
      lastGap:  px2cqw(GAP_PX.last ?? 0),
    };
  });

  const ogImagePath = `/api/awards/${season}/${type}/og-image.png`;

  res.send(renderAdminPage(req, {
    title: 'Edit Award Graphic',
    currentPath: '/admin/awards',
    body: awardGraphicEditorBody({ season, type, badgeLabel, badgeColor, columns, ogImagePath, bannerFs, mode: 'grid' }),
  }));
});

app.post('/admin/awards/:season/:type/columns', requireAuth, express.json(), (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  if (!season || !SINGLE_PHOTO_AWARD_TYPES.has(type)) return res.status(400).json({ error: 'Not applicable' });
  const count = setAwardColumnCount(season, type, req.body?.count);
  const row = getSeasonAwards(season).find(a => a.award_type === type);
  if (row) {
    // Drop any saved slots beyond the new count so they don't linger and reappear if the
    // count is raised again later.
    deleteAwardPhotoOverridesFromSlot(season, type, row.player_id, count);
    clearAwardOgCache(season, type, row.player_id);
  }
  res.json({ ok: true, count });
});

app.post('/admin/awards/:season/:type/graphic', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  if (!season || !type) return res.status(400).json({ error: 'Missing fields' });

  const items    = Array.isArray(req.body?.overrides) ? req.body.overrides : [];
  const isSingle = SINGLE_PHOTO_AWARD_TYPES.has(type);
  const existing = getAwardPhotoOverrides(season, type);

  for (const item of items) {
    const player_id = String(item.player_id || '');
    if (!player_id) continue;
    const slot = isSingle && Number.isFinite(Number(item.slot)) ? Number(item.slot) : 0;

    if (item.clear) {
      deleteAwardPhotoOverride(season, type, player_id, slot);
      continue;
    }

    const offset_x = Number(item.offset_x);
    const offset_y = Number(item.offset_y);
    const zoom     = Number(item.zoom);

    const existingRow = isSingle
      ? getAwardPhotoOverridesForPlayer(season, type, player_id)[slot]
      : existing[player_id];
    let photo_url = existingRow?.photo_url || '';
    if (item.newPhotoDataUrl) {
      const buf = parseDataUrl(item.newPhotoDataUrl);
      if (buf) { try { photo_url = await compressSourceImage(buf); } catch (err) { console.error('override photo compress error:', err); } }
    }

    const isDefault =
      Math.abs((Number.isFinite(offset_x) ? offset_x : 50) - 50) < 0.5 &&
      Math.abs((Number.isFinite(offset_y) ? offset_y : 50) - 50) < 0.5 &&
      Math.abs((Number.isFinite(zoom) ? zoom : 1) - 1) < 0.01 &&
      !photo_url;

    if (isDefault) {
      deleteAwardPhotoOverride(season, type, player_id, slot);
    } else {
      upsertAwardPhotoOverride({
        season, award_type: type, player_id, slot,
        offset_x: Number.isFinite(offset_x) ? offset_x : 50,
        offset_y: Number.isFinite(offset_y) ? offset_y : 50,
        zoom: Number.isFinite(zoom) ? zoom : 1,
        photo_url,
      });
    }
  }

  clearAwardOgCache(season, type, items[0]?.player_id);
  res.json({ ok: true });
});

app.post('/admin/awards/generate-article', requireAuth, express.json(), async (req, res) => {
  const { season, award_type, player_id } = req.body || {};
  if (!award_type) return res.status(400).json({ error: 'Missing award_type' });

  const LABELS = {
    mvp: 'Season MVP', dpoy: 'Defensive Player of the Season',
    all_wknd_1: 'All WKND 1st Team', all_wknd_2: 'All WKND 2nd Team', all_wknd_def: 'All WKND Defensive Team',
    scoring_champ: 'Scoring Champion', assists_leader: 'Assists Leader', rebounds_leader: 'Rebounds Leader',
    steals_leader: 'Steals Leader', blocks_leader: 'Blocks Leader', three_pm_leader: '3-Pointers Leader',
    champion: 'Champion', finals_mvp: 'Finals MVP',
  };
  const TEAM_AWARD_TYPES = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def', 'champion']);

  const awards = getSeasonAwards(season);
  const byType = {};
  for (const r of awards) (byType[r.award_type] ??= []).push(r);
  const entries = byType[award_type] || [];

  // Build a full season stat line from an awards entry row
  function buildStatLine(e) {
    const gp   = e.games_played || 1;
    const avg  = (v) => v != null ? (v / gp).toFixed(1) : null;
    const fgm  = (e.fg2m || 0) + (e.fg3m || 0);
    const fga  = fgm + (e.fg2m_miss || 0) + (e.fg3m_miss || 0);
    const tpm  = e.fg3m || 0;
    const tpa  = tpm + (e.fg3m_miss || 0);
    const ftm  = e.ftm  || 0;
    const fta  = ftm + (e.ft_miss || 0);
    const fgPct = fga  > 0 ? Math.round(fgm / fga * 100)  + '%' : null;
    const tpPct = tpa  > 0 ? Math.round(tpm / tpa * 100)  + '%' : null;
    const ftPct = fta  > 0 ? Math.round(ftm / fta * 100)  + '%' : null;
    return {
      gp,
      ppg: avg(e.pts),  rpg: avg(e.reb),  apg: avg(e.ast),
      spg: avg(e.stl),  bpg: avg(e.blk),  topg: avg(e.turnover),
      totalPts: e.pts || 0, totalAst: e.ast || 0, totalReb: e.reb || 0,
      totalStl: e.stl || 0, totalBlk: e.blk || 0, totalTpm: tpm,
      fgPct, tpPct, ftPct,
    };
  }

  // Per-award-type stat emphasis for the prompt
  function buildContextLine(e, type) {
    const s = buildStatLine(e);
    const base = `${s.ppg} PPG, ${s.rpg} RPG, ${s.apg} APG`;
    const shooting = [
      s.fgPct  ? `${s.fgPct} FG%`  : null,
      s.tpPct  ? `${s.tpPct} 3P%`  : null,
      s.ftPct  ? `${s.ftPct} FT%`  : null,
    ].filter(Boolean).join(', ');
    switch (type) {
      case 'mvp':
        return `${base}, ${s.spg} SPG, ${s.bpg} BPG${shooting ? ` | ${shooting}` : ''} over ${s.gp} regular-season games`;
      case 'dpoy':
        return `${s.spg} SPG, ${s.bpg} BPG, ${base} over ${s.gp} regular-season games (${s.totalStl} total steals, ${s.totalBlk} total blocks)`;
      case 'scoring_champ':
        return `${s.ppg} PPG (${s.totalPts} total points)${shooting ? `, ${shooting}` : ''} over ${s.gp} regular-season games`;
      case 'assists_leader':
        return `${s.apg} APG (${s.totalAst} total assists), ${s.ppg} PPG, ${s.topg} TOV/G over ${s.gp} regular-season games`;
      case 'rebounds_leader':
        return `${s.rpg} RPG (${s.totalReb} total rebounds), ${s.ppg} PPG over ${s.gp} regular-season games`;
      case 'steals_leader':
        return `${s.spg} SPG (${s.totalStl} total steals), ${base} over ${s.gp} regular-season games`;
      case 'blocks_leader':
        return `${s.bpg} BPG (${s.totalBlk} total blocks), ${base} over ${s.gp} regular-season games`;
      case 'three_pm_leader':
        return `${s.totalTpm} 3-pointers made (${(s.totalTpm / s.gp).toFixed(1)}/game)${s.tpPct ? `, ${s.tpPct} from three` : ''} over ${s.gp} regular-season games`;
      default:
        return `${base}${shooting ? `, ${shooting}` : ''} over ${s.gp} regular-season games`;
    }
  }

  let prompt;

  if (TEAM_AWARD_TYPES.has(award_type) && player_id) {
    const entry = entries.find(e => e.player_id === player_id);
    if (!entry) return res.status(400).json({ error: 'Player not found in team award entries' });
    const statLine = buildContextLine(entry, award_type);
    const posNote  = entry.notes ? ` Selected as ${entry.notes}.` : '';
    prompt = `Write a 2-3 sentence spotlight on ${entry.player_name} (${entry.team_name}) being named to the Season ${season} ${LABELS[award_type]} in the WKND Basketball League.${posNote} Season stats: ${statLine}. Focus solely on what this player did to earn the honor — be vivid and specific, not generic. Do not mention teammates, other award recipients, or any other player. Write like a sports broadcaster. Each article should feel distinct from others on the same award page. Do not open with "Ladies and gentlemen", "Congratulations", or any ceremonial greeting — jump straight into the content.`;
  } else {
    let context = '';
    if (entries.length === 1) {
      const e = entries[0];
      context = `Winner: ${e.player_name} (${e.team_name}). Season stats: ${buildContextLine(e, award_type)}.`;
    } else if (entries.length > 1) {
      context = `Winners: ${entries.map(e => `${e.player_name} (${e.team_name})`).join(', ')}.`;
    }
    prompt = `Write a 2-3 sentence award announcement for the Season ${season} ${LABELS[award_type]} award in the WKND Basketball League. ${context} Write it like a sports broadcaster presenting the award — exciting, specific, and confident. No generic filler. Focus solely on the winner — do not mention other players, runners-up, or comparisons. Each article should feel distinct — vary the opening angle and tone from other award articles. Do not open with "Ladies and gentlemen", "Congratulations", or any ceremonial greeting — jump straight into the content.`;
  }

  try {
    const result = await generateText(prompt, { max_tokens: 200 });
    if (!result?.text) throw new Error('No response');
    res.json({ text: result.text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Generation failed' });
  }
});

// Feature toggles and payment config used to live on one catch-all Site Settings
// page; visibility toggles now live on /admin/visibility, payment config on Finance.
app.get('/admin/site', requireAuth, (req, res) => res.redirect('/admin/visibility'));

app.get('/admin/visibility', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'Visibility',
    currentPath: '/admin/visibility',
    body: adminVisibilityBody({
      papawisEnabled:  getSetting('papawis_enabled', '0') === '1',
      postsEnabled:    getSetting('posts_enabled', '0') === '1',
      commentsEnabled: getSetting('comments_enabled', '0') === '1',
      peerRatingsEnabled: getSetting('peer_ratings_enabled', '0') === '1',
      playerReportsEnabled: getSetting('player_reports_enabled', '0') === '1',
      awardsEnabled:   getSetting('awards_enabled', '1') !== '0',
      mvpEnabled:      getSetting('mvp_race_enabled', '1') !== '0',
      sectionSettings: Object.fromEntries(AWARD_SECTION_KEYS.map(k => [`award_show_${k}`, getSetting(`award_show_${k}`, '0')])),
    }),
  }));
});

app.post('/admin/site/settings', requireAuth, express.json(), (req, res) => {
  const staticAllowed = new Set([
    'mvp_race_enabled', 'awards_enabled', 'papawis_enabled', 'papawis_reminders_enabled', 'posts_enabled', 'comments_enabled', 'peer_ratings_enabled', 'player_reports_enabled',
    ...AWARD_SECTION_KEYS.map(k => `award_show_${k}`),
    'reg_open', 'reg_deadline', 'reg_venue', 'reg_schedule', 'reg_fee',
    'gcash_name', 'gcash_number', 'gcash_qr_payload',
  ]);
  const articleKeyRe = new RegExp(`^award_article_(${AWARD_SECTION_KEYS.join('|')})(_[\\w-]+)?_\\d+$`);
  const homeGalleryKeyRe = new RegExp(`^award_home_(${AWARD_SECTION_KEYS.join('|')})_\\d+$`);
  for (const [key, value] of Object.entries(req.body || {})) {
    if (staticAllowed.has(key) || articleKeyRe.test(key) || homeGalleryKeyRe.test(key)) setSetting(key, String(value));
  }
  res.json({ ok: true });
});

app.get('/admin/ledger', requireAuth, (req, res) => {
  const players  = getAllPlayers();
  const seasons  = getLedgerSeasons();
  const season   = req.query.season ?? '';
  const quota    = season ? getSeasonQuota(season) : 0;
  // Charged/paid/pending are legitimate season-scoped reporting ("how much came in this
  // season") — total_outstanding is not, and always comes from the all-time figure even
  // when a season is selected. A debt doesn't reset when a new season starts; a
  // season-scoped "Total Outstanding" was undercounting anything not tagged with that
  // season (which is most charge types — only Season Fee auto-tags a season), making it
  // look like less was owed than actually was.
  const allSummary = getAllSummary();
  const summary  = season ? { ...getSeasonSummary(season), total_outstanding: allSummary.total_outstanding } : allSummary;
  // Balance is never season-scoped, for the same reason — always the true running balance
  // (player_financials, via getAllBalances) regardless of which season pill is active. The
  // season pills below only filter which transactions are listed, not what "balance" means.
  const balMap   = Object.fromEntries(getAllBalances().map(r => [r.player_id, r]));
  // Same "never season-scoped" reasoning as balance — see getLastTransactionDates.
  const lastActivityMap = getLastTransactionDates();
  const allTx    = season ? getAllTransactionsBySeason(season) : getAllTransactions();
  const txByPlayer = {};
  for (const tx of allTx) (txByPlayer[tx.player_id] ??= []).push(tx);
  res.send(renderAdminPage(req, {
    title: 'Player Ledger',
    currentPath: '/admin/ledger',
    body: adminLedgerBody({ players, txByPlayer, seasons, season, quota, summary, balMap, lastActivityMap }),
  }));
});

app.get('/admin/ledger/:id', requireAuth, (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).send(renderAdminPage(req, {
    title: 'Not Found', currentPath: '/admin/ledger',
    body: '<p style="padding:40px;color:var(--text-muted)">Player not found.</p>',
  }));
  const seasons = getLedgerSeasons();
  const season  = 'season' in req.query ? req.query.season : (seasons[0] || '');
  const fin     = getPlayerFinancials(player.id) ?? {};
  const txs     = season ? getPlayerTransactionsBySeason(player.id, season) : getPlayerTransactions(player.id);
  const quota   = season ? getSeasonQuota(season) : 0;
  res.send(renderAdminPage(req, {
    title: `${displayPlayerName(player.name)} — Ledger`,
    currentPath: '/admin/ledger',
    body: adminLedgerPlayerBody({ player, fin, transactions: txs, seasons, season, quota }),
  }));
});

// Shared by every real "money moved" event below — a confirmed charge or a confirmed
// payment, never a pending one (pending isn't a real event from the player's side yet).
function notifyLedgerEvent({ playerId, type, amount, notes }) {
  const amt = `₱${Number(amount).toLocaleString()}`;
  createNotification({
    playerId,
    type: type === 'charge' ? 'ledger_charge' : 'ledger_payment_confirmed',
    title: type === 'charge' ? `You were charged ${amt}` : `Payment confirmed: ${amt}`,
    body: notes || '',
    link: '/settle-balance',
  });
}

app.post('/admin/ledger/transaction', requireAuth, express.json(), (req, res) => {
  const { player_id, amount, type, payment_method, date, status, notes, reference_no, season, category } = req.body;
  if (!player_id || !amount || !date) return res.status(400).json({ error: 'player_id, amount, and date are required.' });
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Amount must be a positive number.' });
  if (!['payment', 'charge'].includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' });
  if (!['confirmed', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const id = randomBytes(6).toString('hex');
  recordTransaction({ id, player_id, amount: parsed, type, payment_method: payment_method || '', date, status, notes: notes || '', reference_no: reference_no || '', season: season || '', category: category || '' });
  if (status === 'confirmed') notifyLedgerEvent({ playerId: player_id, type, amount: parsed, notes });
  res.json({ ok: true, id });
});


app.post('/admin/ledger/transaction/:id/confirm', requireAuth, express.json(), (req, res) => {
  const category = req.body?.category;
  if (category) setTransactionCategory(req.params.id, String(category).trim());
  const tx = getTransactionById(req.params.id);
  const ok = confirmTransaction(req.params.id);
  if (!ok) return res.status(400).json({ error: 'Transaction not found or not pending.' });
  if (tx) notifyLedgerEvent({ playerId: tx.player_id, type: tx.type, amount: tx.amount, notes: tx.notes });
  // A probation deposit can be confirmed from here instead of the Papawis admin page (which
  // scopes to one signup) — this route only knows the player, so promote every signup of
  // theirs still held on 'pending', not just one.
  if (tx && tx.category === 'Papawis Deposit' && tx.type === 'payment') {
    for (const signup of getPendingPapawisSignupsForPlayer(tx.player_id)) {
      const result = promotePapawisPendingSignup(signup.id);
      if (result.status === 'confirmed') {
        const game = getPapawisGame(signup.game_id);
        if (game) createNotification({
          playerId: signup.player_id, type: 'papawis_promoted',
          title: `You're confirmed for ${game.title || 'Papawis'}!`,
          body: 'Your deposit was confirmed and you have a spot.',
          link: `/papawis#pw-game-${game.id}`,
        });
      }
    }
  }
  res.json({ ok: true });
});

app.post('/admin/ledger/transaction/:id/void', requireAuth, (req, res) => {
  const ok = voidTransaction(req.params.id);
  if (!ok) return res.status(400).json({ error: 'Transaction not found or not confirmed.' });
  res.json({ ok: true });
});

app.delete('/admin/ledger/transaction/:id', requireAuth, (req, res) => {
  const ok = deleteTransaction(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Transaction not found.' });
  res.json({ ok: true });
});

app.post('/admin/ledger/bulk-charge', requireAuth, express.json(), (req, res) => {
  const { player_ids, amount, type, payment_method, date, status, notes, season, category } = req.body;
  if (!player_ids?.length || !amount || !date) return res.status(400).json({ error: 'player_ids, amount, and date are required.' });
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Amount must be a positive number.' });
  const finalStatus = status || 'confirmed';
  for (const pid of player_ids) {
    const id = randomBytes(6).toString('hex');
    recordTransaction({ id, player_id: pid, amount: parsed, type: type || 'charge', payment_method: payment_method || '', date, status: finalStatus, notes: notes || '', reference_no: '', season: season || '', category: category || '' });
    if (finalStatus === 'confirmed') notifyLedgerEvent({ playerId: pid, type: type || 'charge', amount: parsed, notes });
  }
  res.json({ ok: true, count: player_ids.length });
});

app.get('/admin/finance', requireAuth, (req, res) => {
  const seasons = getLedgerSeasons();
  const season  = req.query.season || seasons[0] || '';
  const summary = season ? getSeasonSummary(season) : {};
  const quota   = season ? getSeasonQuota(season) : 0;
  const balMap  = season ? Object.fromEntries(getSeasonBalances(season).map(r => [r.player_id, r])) : {};
  const players = getAllPlayers();
  const pending = getPendingTransactions();
  const categoryTotals = season ? getCategoryTotals(season) : [];
  const teamTotals     = season ? getTeamTotals(season) : [];
  const recentTx       = getRecentTransactions();
  res.send(renderAdminPage(req, {
    title: 'Finance',
    currentPath: '/admin/finance',
    body: adminFinanceDashBody({ seasons, season, summary, quota, balMap, players, pending, categoryTotals, teamTotals, recentTx }),
  }));
});

app.get('/admin/finance/gcash', requireAuth, (req, res) => {
  const gcash = {
    name:       getSetting('gcash_name', ''),
    number:     getSetting('gcash_number', ''),
    qr_payload: getSetting('gcash_qr_payload', ''),
  };
  res.send(renderAdminPage(req, {
    title: 'GCash Settlement',
    currentPath: '/admin/finance/gcash',
    body: adminFinanceGcashBody({ gcash }),
  }));
});

// ── Admin players routes ──────────────────────────────────────────────────────
app.get('/admin/players', requireAuth, (req, res) => {
  const seasons = getGameSeasons();
  const season  = req.query.season || '';
  const players = getPlayersWithRatings(season || null);
  const teams   = getAllTeams();
  res.send(renderAdminPage(req, {
    title: 'Players',
    currentPath: '/admin/players',
    body: adminPlayersBody({ players, seasons, season, teams }),
  }));
});

app.get('/admin/players/:id', requireAuth, (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).send(renderAdminPage(req, {
    title: 'Not Found', currentPath: '/admin/players',
    body: '<p style="padding:40px;color:var(--text-muted)">Player not found.</p>',
  }));
  const seasons    = getGameSeasons();
  const season     = req.query.season || '';
  const rating     = getPlayerRating(player.id, season || null);
  const stats      = getOnePlayerStats(player.id, season || null);
  const teams      = getAllTeams();
  const currentSlug = getSlugForEntity('player', player.id);
  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  const canDelete = !playerHasActivity(player.id);
  const linkedReg = getRegistrationByPlayerId(player.id);
  const canImpersonate = isSuperAdmin && !!linkedReg && linkedReg.status === 'approved';
  res.send(renderAdminPage(req, {
    title: displayPlayerName(player.name),
    currentPath: '/admin/players',
    body: adminPlayerDetailBody({ player, rating, stats, seasons, season, teams, currentSlug, isSuperAdmin, canDelete, canImpersonate }),
  }));
});

app.delete('/admin/players/:id', requireAuth, (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const result = deletePlayer(req.params.id);
  if (result.error) return res.status(400).json({ error: 'This player has games, payments, papawis history, or an award on record — cannot delete.' });
  res.json({ ok: true });
});

app.post('/admin/players/:id/slug', requireSuperAdmin, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const slug = String(req.body?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ error: 'Slug cannot be empty.' });
  const existing = getEntityForSlug('player', slug);
  if (existing && existing !== player.id) return res.status(409).json({ error: 'That slug is already taken by another player.' });
  saveSlug('player', player.id, slug);
  res.json({ ok: true, slug });
});

app.post('/admin/players/:id/bio', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const { writeup, positions, number, status, team_id, first_name, last_name, ...details } = req.body;
  if (writeup !== undefined) updatePlayerWriteup(player.id, String(writeup));
  if (number  !== undefined) setPlayerNumber(player.id, number);
  if (status  !== undefined) setPlayerStatus(player.id, status);
  if (team_id !== undefined) setPlayerTeam(player.id, team_id);
  upsertPlayerDetails(player.id, {
    nickname:       details.nickname       || null,
    hometown:       details.hometown       || null,
    school:         details.school         || null,
    height:         details.height         || null,
    weight:         details.weight         || null,
    wingspan:       details.wingspan       || null,
    dominant_hand:  details.dominant_hand  || null,
    years_playing:  details.years_playing  || null,
    social_instagram: details.social_instagram || null,
    social_twitter: details.social_twitter || null,
  });
  updatePlayer(player.id, {
    first_name: first_name !== undefined ? first_name : player.first_name,
    last_name:  last_name  !== undefined ? last_name  : player.last_name,
    number:     number     !== undefined ? number     : player.number,
    positions:  Array.isArray(positions) ? positions : (() => { try { return JSON.parse(player.positions || '[]'); } catch { return []; } })(),
    status:     status     !== undefined ? status     : player.status,
  });
  res.json({ ok: true });
});

app.post('/admin/players/:id/photo', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const dataUrl = String(req.body.dataUrl || '');
  if (!dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  updatePlayerPhoto(player.id, dataUrl);
  const originalDataUrl = String(req.body.originalDataUrl || '');
  const originalBuf = originalDataUrl ? parseDataUrl(originalDataUrl) : null;
  if (originalBuf) {
    try { updatePlayerPhotoOriginal(player.id, await compressSourceImage(originalBuf)); }
    catch (err) { console.error('photo_original compress error:', err); }
  }
  res.json({ ok: true });
});

app.post('/admin/players/:id/status', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const status = req.body?.status;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  setPlayerStatus(player.id, status);
  res.json({ ok: true, status });
});

app.post('/admin/players/:id/team', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  setPlayerTeam(player.id, req.body?.team_id ?? '');
  res.json({ ok: true });
});

app.post('/admin/players/:id/papawis-probation', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  setPlayerPapawisProbation(player.id, !!req.body?.on, req.body?.note || '');
  res.json({ ok: true });
});

app.post('/admin/players/:id/ratings', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const { season, ...fields } = req.body;
  const ovr = {};
  for (const key of ['scoring','shooting','rebounding','playmaking','defense','iq','usage','overall']) {
    const val = fields[key + '_ovr'];
    ovr[key + '_ovr'] = val !== '' && val !== undefined && val !== null ? parseInt(val, 10) : null;
  }
  saveRatingOverrides(player.id, season || '', ovr);
  res.json({ ok: true });
});

function computeAndSave(playerId, season, sharedContext = null) {
  const stats = getOnePlayerStats(playerId, season || null);
  if (!stats || !(stats.games_played > 0)) {
    deleteUnlockedRating(playerId, season || '');
    return null;
  }

  const resolvedSeason   = season || String(stats.season ?? '');
  const totalSeasonGames = sharedContext?.totalSeasonGames ?? getTotalSeasonGames(resolvedSeason);
  const teamTotalsMap    = sharedContext?.teamTotalsMap    ?? getTeamRatingTotals(resolvedSeason);
  const player           = sharedContext?.playerTeamMap?.[playerId] ?? getPlayerWithTeam(playerId);
  const teamTotals       = player?.team_id ? (teamTotalsMap[player.team_id] ?? null) : null;
  const recentStats      = getPlayerRecentStats(playerId, resolvedSeason);
  const gamePts          = getPlayerGamePts(playerId, resolvedSeason);
  const winRate          = getPlayerWinRate(playerId, resolvedSeason);
  const leagueRaws       = sharedContext?.leagueRaws ?? null;

  const r = computeRatings(stats, { totalSeasonGames, teamTotals, recentStats, gamePts, winRate, leagueRaws });
  upsertComputedRating(playerId, season || '', r);
  return r;
}

function buildSharedContext(season) {
  const resolvedSeason   = season || '';
  const totalSeasonGames = getTotalSeasonGames(resolvedSeason);
  const teamTotalsMap    = getTeamRatingTotals(resolvedSeason);
  const players          = getAllPlayers();
  const playerTeamMap    = Object.fromEntries(players.map(p => [p.id, p]));

  // Pre-compute raw values for all qualified players to enable percentile ranking
  const allRaws = [];
  for (const p of players) {
    const stats = getOnePlayerStats(p.id, resolvedSeason || null);
    if (!stats || !(stats.games_played > 0)) continue;
    const teamTotals  = p.team_id ? (teamTotalsMap[p.team_id] ?? null) : null;
    const recentStats = getPlayerRecentStats(p.id, resolvedSeason);
    allRaws.push(computeRawValues(stats, { teamTotals, recentStats }));
  }

  function sortedVals(field) {
    return allRaws.map(r => r[field]).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
  }

  const leagueRaws = {
    ppg:      sortedVals('ppg'),
    rpg:      sortedVals('rpg'),
    def_raw:  sortedVals('def_raw'),
    play_raw: sortedVals('play_raw'),
    ts_pct:   sortedVals('ts_pct'),
    iq_raw:   sortedVals('iq_raw'),
    usg:      sortedVals('usg'),
  };

  return { totalSeasonGames, teamTotalsMap, playerTeamMap, leagueRaws };
}

app.post('/admin/players/:id/recompute', requireAuth, express.json(), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const season = req.body?.season || '';
  const ctx = buildSharedContext(season);
  const r = computeAndSave(player.id, season, ctx);
  res.json({ ok: true, rating: r });
});

app.post('/admin/players/recompute-all', requireAuth, express.json(), (req, res) => {
  const season  = req.body?.season || '';
  const players = getAllPlayers();
  const ctx     = buildSharedContext(season);
  let count = 0;
  for (const p of players) {
    const r = computeAndSave(p.id, season, ctx);
    if (r) count++;
  }
  res.json({ ok: true, count });
});

// ── Public routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const teams = getAllTeams();
  const players = getAllPlayers();
  const games = byDate(getAllGames());

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const completedGames = games.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const highlights = buildHighlights(completedGames, playerMap, teamMap);
  const leaderPlayers = buildLeaderPlayers();

  const isHomepageLoggedIn = !!req.session?.isAdmin || !!req.session?.playerRegId;
  const regBanner = !isHomepageLoggedIn && getSetting('reg_open', '0') === '1'
    ? pickRegistrationBannerMessage()
    : null;

  let signupBanner = null;
  if (req.session?.playerRegId && !req.session?.isAdmin) {
    const sigSeason = getSetting('signup_target_season', '');
    const sigOpen   = getSetting('season_signup_open', '0') === '1';
    if (sigSeason && sigOpen && !getSeasonSignup(req.session.playerRegId, sigSeason)) {
      signupBanner = { season: sigSeason, ...pickSignupBannerMessage() };
    }
  }

  const homePosts = getSetting('posts_enabled', '0') === '1' ? getPublicPosts() : [];

  let awardsGallery = [];
  if (getSetting('awards_enabled', '1') !== '0') {
    const awardSeason = getPortalCurrentSeason();
    if (awardSeason) {
      const seasonAwards = getSeasonAwards(awardSeason);

      const soloItems = HOME_GALLERY_SOLO_TYPES
        .filter(type => getSetting(`award_home_${type}_${awardSeason}`, '0') === '1')
        .map(type => {
          const row = seasonAwards.find(a => a.award_type === type);
          if (!row) return null;
          return {
            kind: 'solo',
            type,
            label: AWARD_OG_BADGE[type].label,
            playerId: row.player_id,
            playerName: row.player_name,
            teamName: row.team_name,
            writeup: getSetting(`award_article_${type}_${awardSeason}`, ''),
            imgUrl: `/api/awards/${awardSeason}/${type}/${encodeURIComponent(row.player_id)}/gallery-image.png`,
          };
        })
        .filter(Boolean);

      // Team/roster awards have no single confirmed player or shared writeup — the hero
      // slide just shows the strip graphic with the award (and for Champions, the winning
      // team) as the title, no excerpt.
      const teamItems = HOME_GALLERY_TEAM_TYPES
        .filter(type => getSetting(`award_home_${type}_${awardSeason}`, '0') === '1')
        .map(type => {
          const rows = seasonAwards.filter(a => a.award_type === type);
          if (!rows.length) return null;
          const label = AWARD_OG_BADGE[type].label;
          const title = type === 'champion' && rows[0].team_name
            ? `${rows[0].team_name} — ${label}`
            : label;
          return {
            kind: 'team',
            type,
            label,
            title,
            imgUrl: `/api/awards/${awardSeason}/${type}/gallery-image.png`,
          };
        })
        .filter(Boolean);

      awardsGallery = [...soloItems, ...teamItems];
    }
  }

  res.send(renderPage(req, {
    title: 'WKND Basketball League',
    currentPath: req.path,
    body: homePage({ teams, players, games, highlights, leaderPlayers, regBanner, signupBanner, posts: homePosts, awardsGallery })
  }));
});

app.get('/robots.txt', (req, res) => {
  const origin = getRequestOrigin(req);
  res.type('text/plain').send(
`User-agent: *
Disallow: /admin/
Disallow: /login
Disallow: /logout
Disallow: /set-password
Disallow: /me
Disallow: /settle-balance
Disallow: /balance-bar/
Disallow: /auth/

Sitemap: ${origin}/sitemap.xml
`);
});

// Regenerated fresh on every request from live DB rows — new games, players, teams,
// and posts show up here automatically the moment they exist, with no separate build
// or regeneration step needed.
app.get('/sitemap.xml', (req, res) => {
  const origin = getRequestOrigin(req);
  const flags  = getFeatureFlags();
  const isoDate = ms => ms ? new Date(ms).toISOString().slice(0, 10) : undefined;

  const urls = [
    { loc: '/',           priority: '1.0', changefreq: 'daily' },
    { loc: '/games',      priority: '0.8', changefreq: 'daily' },
    { loc: '/standings',  priority: '0.8', changefreq: 'daily' },
    { loc: '/playoffs',   priority: '0.6', changefreq: 'weekly' },
    { loc: '/teams',      priority: '0.7', changefreq: 'weekly' },
    { loc: '/players',    priority: '0.7', changefreq: 'weekly' },
    { loc: '/leaders',    priority: '0.7', changefreq: 'daily' },
    { loc: '/roast',      priority: '0.5', changefreq: 'weekly' },
  ];
  if (flags.awards)  urls.push({ loc: '/awards', priority: '0.5', changefreq: 'monthly' });
  if (flags.mvpRace) urls.push({ loc: '/mvp',    priority: '0.5', changefreq: 'weekly' });
  if (flags.papawis) urls.push({ loc: '/papawis', priority: '0.5', changefreq: 'weekly' });
  if (flags.posts)   urls.push({ loc: '/posts',   priority: '0.6', changefreq: 'daily' });

  for (const t of getAllTeams())   urls.push({ loc: `/teams/${teamSlug(t)}`,     priority: '0.6', changefreq: 'weekly' });
  for (const p of getAllPlayers()) urls.push({ loc: `/players/${playerSlug(p)}`, priority: '0.5', changefreq: 'weekly' });
  for (const g of getAllGames()) {
    if (g.under_review) continue;
    urls.push({ loc: `/games/${gameSlug(g)}`, priority: '0.5', changefreq: 'monthly', lastmod: isoDate(Date.parse(g.date)) });
  }
  if (flags.posts) {
    for (const post of getPublicPosts()) {
      urls.push({ loc: `/posts/${post.slug}`, priority: '0.5', changefreq: 'monthly', lastmod: isoDate(post.updated_at) });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${origin}${u.loc}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  res.type('application/xml').send(xml);
});

app.get('/games/:ref', (req, res) => {
  const resolved = resolveRef('game', req.params.ref,
    ref => getGameById(ref),
    g   => gameSlug(g)
  );
  if (!resolved) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: req.path, body: '<p style="padding:40px;color:var(--text-muted)">Game not found.</p>' })
  );
  if (resolved.slug) return res.redirect(302, `/games/${resolved.slug}`);

  const game = getGameById(resolved.id);
  if (!game || game.under_review) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: req.path, body: '<p style="padding:40px;color:var(--text-muted)">Game not found.</p>' })
  );

  const stats = getGameDetailStats(game.id);
  const dnpPlayers = getGameDnpPlayers(game.id);
  const potgPlayerId = game.manual_potg_player_id || derivePotgPlayerId(game, stats);
  const quarterScores = extractQuarterScores(game);

  const teams = getAllTeams();
  const players = getAllPlayers();
  const allGames = getAllGames();
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const pageTitle = gamePageTitle(game);

  const commentsEnabled = getSetting('comments_enabled', '0') === '1';
  const currentPlayerId = req.session?.playerPlayerId || null;
  let comments = [], reactedIds = new Set(), gameReaction = { count: 0, reacted: false }, mentionablePlayers = [];
  if (commentsEnabled) {
    comments = getGameComments(game.id);
    reactedIds = getReactedCommentIdsForPlayer(comments.map(c => c.id), currentPlayerId);
    gameReaction = getGameReactionState(game.id, currentPlayerId);
    // Anyone with a real, working login — not just players in this specific game — so a
    // comment can pull in someone unrelated to the game just to get them talking.
    mentionablePlayers = getPlayersWithAccounts();
  }

  res.send(renderPage(req, {
    title: `${pageTitle} — WKND Basketball League`,
    currentPath: req.path,
    metaTags: buildGameOgTags(req, game),
    body: gamePage({
      game, stats, dnpPlayers, potgPlayerId, quarterScores, allGames, playerMap, teamMap,
      commentsEnabled, comments, reactedIds, gameReaction, mentionablePlayers,
      currentPlayerId, isPlayer: !!req.session?.playerRegId, isAdmin: !!req.session?.isAdmin,
    })
  }));
});

// ── Game comments + reactions ───────────────────────────────────────────────────
// Mirrors linkifyMentions()'s matching logic in views/game.js, but returns matched player
// ids instead of HTML — used to decide who gets a "you were mentioned" notification.
// Kept in sync manually with the view-layer version, same as the client-side port.
function extractMentionedPlayerIds(body, players) {
  if (!players.length) return [];
  const sorted = [...players].sort((a, b) => b.name.length - a.name.length);
  const pattern = sorted.map(p => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return [];
  const byName = new Map(sorted.map(p => [p.name, p.id]));
  const re = new RegExp('@(' + pattern + ')(?![A-Za-z0-9])', 'g');
  const found = new Set();
  let m;
  while ((m = re.exec(body))) {
    const id = byName.get(m[1]);
    if (id) found.add(id);
  }
  return [...found];
}

app.post('/games/:id/comments', express.json(), (req, res) => {
  if (getSetting('comments_enabled', '0') !== '1') return res.status(404).json({ error: 'Not found.' });
  const playerId = req.session?.playerPlayerId;
  if (!req.session?.playerRegId || !playerId) return res.status(401).json({ error: 'Log in to comment.' });
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  const body = String(req.body?.body || '').trim().slice(0, 500);
  if (!body) return res.status(400).json({ error: 'Comment can\'t be empty.' });
  const id = addGameComment({ gameId: game.id, playerId, body });
  const saved = getCommentWithMeta(id);
  broadcastToGame(game.id, {
    type: 'comment:new',
    comment: {
      id: saved.id,
      player_id: saved.player_id,
      body: saved.body,
      created_at: saved.created_at,
      displayName: displayPlayerName(saved.player_name),
      initials: initials(saved.player_name),
      photoUrl: `/api/player/${encodeURIComponent(saved.player_id)}/photo`,
      color: teamColor(saved.team_name || ''),
    },
  });

  // Notifications: an @mentioned player gets a specific callout; everyone else who
  // actually played in this game gets a general "new comment" one. Never both for the
  // same person, and never for the commenter's own comment.
  const gameLink = `/games/${gameSlug(game)}`;
  const commenterName = displayPlayerName(saved.player_name);
  const accountedPlayers = getPlayersWithAccounts().map(p => ({ id: p.id, name: displayPlayerName(p.name) }));
  const mentionedIds = new Set(extractMentionedPlayerIds(body, accountedPlayers));

  mentionedIds.forEach(mentionedId => {
    if (mentionedId === playerId) return;
    createNotification({
      playerId: mentionedId,
      type: 'comment_mention',
      title: `${commenterName} mentioned you`,
      body: body.length > 140 ? body.slice(0, 140) + '…' : body,
      link: gameLink,
    });
  });

  const gameStats = getGameDetailStats(game.id);
  const participantIds = new Set(gameStats.map(s => s.player_id));
  participantIds.forEach(pid => {
    if (pid === playerId || mentionedIds.has(pid)) return;
    createNotification({
      playerId: pid,
      type: 'comment_new',
      title: `New comment on ${game.team_a_name} vs ${game.team_b_name}`,
      body: `${commenterName}: ${body.length > 100 ? body.slice(0, 100) + '…' : body}`,
      link: gameLink,
    });
  });

  res.json({ ok: true, id });
});

app.post('/games/:id/comments/:commentId/react', express.json(), (req, res) => {
  if (getSetting('comments_enabled', '0') !== '1') return res.status(404).json({ error: 'Not found.' });
  const playerId = req.session?.playerPlayerId;
  if (!req.session?.playerRegId || !playerId) return res.status(401).json({ error: 'Log in to react.' });
  const comment = getCommentById(req.params.commentId);
  if (!comment || comment.game_id !== req.params.id) return res.status(404).json({ error: 'Not found.' });
  const result = toggleCommentReaction(comment.id, playerId);
  broadcastToGame(comment.game_id, { type: 'comment:react', id: comment.id, count: result.count });
  res.json({ ok: true, ...result });
});

// Page-level reaction — "liked the game itself," gated behind the same comments_enabled
// flag since it shipped as part of the same social-engagement launch, not a separate toggle.
app.post('/games/:id/react', express.json(), (req, res) => {
  if (getSetting('comments_enabled', '0') !== '1') return res.status(404).json({ error: 'Not found.' });
  const playerId = req.session?.playerPlayerId;
  if (!req.session?.playerRegId || !playerId) return res.status(401).json({ error: 'Log in to react.' });
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  const result = toggleGameReaction(game.id, playerId);
  broadcastToGame(game.id, { type: 'game:react', count: result.count });
  res.json({ ok: true, ...result });
});

app.delete('/games/:id/comments/:commentId', (req, res) => {
  if (!req.session?.isAdmin) return res.status(403).json({ error: 'Admins only.' });
  const comment = getCommentById(req.params.commentId);
  if (!comment || comment.game_id !== req.params.id) return res.status(404).json({ error: 'Not found.' });
  deleteGameComment(comment.id);
  broadcastToGame(comment.game_id, { type: 'comment:delete', id: comment.id });
  res.json({ ok: true });
});

// ── Posts ──────────────────────────────────────────────────────────────────────
// posts_enabled only controls the nav link (views/layout.js) and the homepage
// "Latest Posts" teaser — these pages themselves stay reachable by direct URL
// either way, so a post can be shared/linked without being generally advertised.
app.get('/posts', (req, res) => {
  const posts = getPublicPosts();
  res.send(renderPage(req, {
    title: 'Posts — WKND Basketball League',
    currentPath: req.path,
    body: postsListPage({ posts })
  }));
});

app.get('/posts/:slug', (req, res) => {
  const post = getPostBySlug(req.params.slug);
  const now = Date.now();
  const isVisible = post && (post.status === 'published' || (post.status === 'scheduled' && post.publish_at <= now));
  if (!isVisible) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: req.path, body: '<p style="padding:40px;color:var(--text-muted)">Post not found.</p>' })
  );
  res.send(renderPage(req, {
    title: `${post.title} — WKND Basketball League`,
    currentPath: req.path,
    metaTags: buildPostOgTags(req, post),
    body: postDetailPage({ post })
  }));
});

function uniquePostSlug(base, excludeId = '') {
  let slug = base || 'post';
  let n = 2;
  while (isPostSlugTaken(slug, excludeId)) { slug = `${base}-${n}`; n++; }
  return slug;
}

app.get('/admin/posts', requireAuth, (req, res) => {
  const posts = getAllPostsAdmin();
  res.send(renderAdminPage(req, {
    title: 'Posts',
    currentPath: '/admin/posts',
    body: adminPostsListBody({ posts }),
  }));
});

app.get('/admin/posts/new', requireAuth, (req, res) => {
  const teams = getAllTeams();
  res.send(renderAdminPage(req, {
    title: 'New Post',
    currentPath: '/admin/posts',
    body: adminPostEditorBody({ post: null, teams }),
  }));
});

app.get('/admin/posts/:id/edit', requireAuth, (req, res) => {
  const post = getPostById(req.params.id);
  if (!post) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/posts', body: '<p style="color:var(--text-muted);padding:40px">Post not found.</p>' }));
  const teams = getAllTeams();
  res.send(renderAdminPage(req, {
    title: `Edit — ${post.title || 'Untitled'}`,
    currentPath: '/admin/posts',
    body: adminPostEditorBody({ post, teams }),
  }));
});

app.post('/admin/posts', requireAuth, express.json(), (req, res) => {
  const { title, body_html, status, publish_at } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const slug = uniquePostSlug(slugify(req.body.slug || title));
  const id = crypto.randomUUID();
  createPost({ id, title, slug, body_html: body_html || '', status: status || 'draft', publish_at: publish_at || null });
  res.json({ ok: true, id, slug });
});

app.post('/admin/posts/generate-preview', requireAuth, express.json(), async (req, res) => {
  if (!aiAvailable()) return res.status(400).json({ error: 'No AI API key configured.' });
  const { teamAId, teamBId, steer } = req.body || {};
  const teamA = getTeamById(teamAId);
  const teamB = getTeamById(teamBId);
  if (!teamA || !teamB) return res.status(400).json({ error: 'Pick two valid teams.' });

  const season = getCurrentSeason()?.season ?? 1;
  const standings = getSeasonStandings(season);
  const standA = standings.find(s => s.id === teamA.id);
  const standB = standings.find(s => s.id === teamB.id);
  const h2h = getHeadToHeadRecord(teamA.id, teamB.id);

  const topPlayers = teamId => getLeaders()
    .filter(p => p.team_id === teamId && p.games_played > 0)
    .map(p => ({ ...p, ppg: p.pts / p.games_played }))
    .sort((a, b) => b.ppg - a.ppg)
    .slice(0, 3)
    .map(p => `${displayPlayerName(p.name)} (${p.ppg.toFixed(1)} PPG)`)
    .join(', ');

  const recordLine = s => s ? `${s.wins}-${s.losses} (point diff ${s.point_diff >= 0 ? '+' : ''}${s.point_diff})` : 'record unavailable';
  const h2hLine = h2h.games.length
    ? `${teamA.name} ${h2h.teamAWins} – ${h2h.teamBWins} ${teamB.name} across ${h2h.games.length} meeting(s) all-time. Games: ${h2h.games.map(g => `${g.team_a_name} ${g.team_a_score}–${g.team_b_score} ${g.team_b_name} (${g.date})`).join('; ')}`
    : `${teamA.name} and ${teamB.name} have not played each other yet.`;

  const prompt = [
    `You are a local recreational basketball league writer previewing an upcoming playoff/finals matchup — a community observer, not a broadcaster.`,
    `Write a matchup preview post for the WKND Basketball League. Tone: grounded, conversational, builds anticipation without hype-speak.`,
    `Use ONLY the numbers provided below. Do NOT invent, estimate, or round any statistic, record, or head-to-head result not explicitly given.`,
    `Do NOT reference the crowd, audience, or spectators. The league has limited attendance.`,
    `Output as JSON: a short headline (max 10 words, must name both teams) and 3-4 body paragraphs (plain text, no markdown).`,
    ``,
    `MATCHUP: ${teamA.name} vs ${teamB.name}`,
    `Season ${season} records: ${teamA.name} ${recordLine(standA)} | ${teamB.name} ${recordLine(standB)}`,
    `Head-to-head: ${h2hLine}`,
    `${teamA.name} top scorers: ${topPlayers(teamA.id) || 'no data'}`,
    `${teamB.name} top scorers: ${topPlayers(teamB.id) || 'no data'}`,
    steer ? `` : '',
    steer ? `ANGLE/STEER FROM EDITOR: ${steer}` : '',
  ].filter(s => s !== '').join('\n');

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      paragraphs: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'paragraphs'],
  };

  try {
    const { data } = await generateJson(prompt, schema, { temperature: 0.72, maxTokens: 700 });
    const body_html = (data.paragraphs || []).map(p => `<p>${escHtml(p)}</p>`).join('');
    res.json({ title: data.title || '', body_html, ai_generated: true });
  } catch (err) {
    console.error('generate-preview error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/admin/posts/:id', requireAuth, express.json(), (req, res) => {
  const post = getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const { title, body_html, status, publish_at } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const rawSlug = slugify(req.body.slug || title);
  const slug = rawSlug === post.slug ? post.slug : uniquePostSlug(rawSlug, post.id);
  updatePost(post.id, {
    title, slug, body_html: body_html || '', status: status || 'draft',
    publish_at: publish_at || null, stat_check_json: post.stat_check_json,
  });
  res.json({ ok: true, slug });
});

app.delete('/admin/posts/:id', requireAuth, (req, res) => {
  const post = getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  deletePost(post.id);
  res.json({ ok: true });
});

// SEO Overrides — manual, per-slug title/description/cover overrides (Yoast-style).
// Routes take the slug in the request body/query (never the URL path) since slugs
// are full page paths like "/games/<id>" and would otherwise collide with Express's
// own route matching.
async function compressSeoImage(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return '';
  const inputBuffer = Buffer.from(match[2], 'base64');
  const compressed = await sharp(inputBuffer)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
  return 'data:image/jpeg;base64,' + compressed.toString('base64');
}

app.get('/admin/seo', requireAuth, (req, res) => {
  const overrides = getAllSeoOverrides();
  res.send(renderAdminPage(req, {
    title: 'SEO Overrides',
    currentPath: '/admin/seo',
    body: adminSeoListBody({ overrides }),
  }));
});

app.get('/admin/seo/new', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'New SEO Override',
    currentPath: '/admin/seo',
    body: adminSeoEditorBody({ override: null }),
  }));
});

app.get('/admin/seo/edit', requireAuth, (req, res) => {
  const slug = String(req.query.slug || '');
  const override = getSeoOverride(slug);
  if (!override) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/seo', body: '<p style="color:var(--text-muted);padding:40px">Override not found.</p>' }));
  res.send(renderAdminPage(req, {
    title: `Edit — ${override.slug}`,
    currentPath: '/admin/seo',
    body: adminSeoEditorBody({ override }),
  }));
});

app.post('/admin/seo', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  const slug = String(req.body.slug || '').trim();
  if (!slug || !slug.startsWith('/')) return res.status(400).json({ error: 'Slug must start with /' });
  if (getSeoOverride(slug)) return res.status(400).json({ error: 'An override for this slug already exists.' });
  let imageUrl = req.body.image_url || '';
  if (imageUrl.startsWith('data:')) imageUrl = await compressSeoImage(imageUrl);
  upsertSeoOverride({ slug, title: req.body.title || '', description: req.body.description || '', image_url: imageUrl });
  res.json({ ok: true, slug });
});

app.post('/admin/seo/update', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  const slug = String(req.body.slug || '').trim();
  const existing = getSeoOverride(slug);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  let imageUrl = req.body.image_url;
  if (imageUrl === undefined) imageUrl = existing.image_url;
  else if (imageUrl.startsWith('data:')) imageUrl = await compressSeoImage(imageUrl);
  upsertSeoOverride({ slug, title: req.body.title || '', description: req.body.description || '', image_url: imageUrl || '' });
  res.json({ ok: true });
});

app.post('/admin/seo/delete', requireAuth, express.json(), (req, res) => {
  const slug = String(req.body.slug || '').trim();
  if (!getSeoOverride(slug)) return res.status(404).json({ error: 'Not found' });
  deleteSeoOverride(slug);
  res.json({ ok: true });
});

app.post('/admin/posts/:id/verify-stats', requireAuth, express.json(), async (req, res) => {
  const post = getPostById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (!aiAvailable()) return res.status(400).json({ error: 'No AI API key configured.' });

  const plainText = post.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const extractSchema = {
    type: 'object',
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            claim_text: { type: 'string' },
            team_name:  { type: 'string', description: 'the team this claim is about — resolve from surrounding context/pronouns, never leave blank' },
            stat_type:  { type: 'string', description: 'one of: record, head_to_head, ppg, other' },
            claimed_value: { type: 'string' },
          },
          required: ['claim_text', 'team_name', 'stat_type', 'claimed_value'],
        },
      },
    },
    required: ['claims'],
  };
  const extractPrompt = `Extract every concrete numeric claim (records like "10-2", head-to-head results, scoring averages, streaks) from this basketball post text. Every claim MUST include which team it's about, resolved from context even if the sentence uses a pronoun or implied subject. If there are none, return an empty array.\n\nTEXT:\n${plainText}`;

  try {
    const { data } = await generateJson(extractPrompt, extractSchema, { temperature: 0, maxTokens: 500 });
    const teams = getAllTeams();
    const season = getCurrentSeason()?.season ?? 1;
    const standings = getSeasonStandings(season);

    const mismatches = [];
    for (const claim of data.claims || []) {
      const team = teams.find(t => claim.team_name && t.name.toLowerCase() === claim.team_name.toLowerCase());
      if (!team) continue; // can't verify without a matched team, skip rather than false-flag
      if (claim.stat_type === 'record') {
        const stand = standings.find(s => s.id === team.id);
        if (stand) {
          const expected = `${stand.wins}-${stand.losses}`;
          if (!claim.claimed_value.includes(expected)) {
            mismatches.push({ claim: claim.claim_text, expected, found: claim.claimed_value });
          }
        }
      }
    }
    updatePost(post.id, {
      title: post.title, slug: post.slug, body_html: post.body_html, status: post.status,
      publish_at: post.publish_at, stat_check_json: JSON.stringify(mismatches),
    });
    res.json({ mismatches });
  } catch (err) {
    console.error('verify-stats error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Admin compare analytics ───────────────────────────────────────────────────
app.get('/admin/compare', requireAuth, (req, res) => {
  const rows    = getCompareAnalytics();
  const players = getAllPlayers();
  res.send(renderAdminPage(req, {
    title: 'Compare Analytics',
    currentPath: '/admin/compare',
    body: adminComparePage({ rows, players }),
  }));
});

// ── Admin game endpoints ──────────────────────────────────────────────────────
const jsonSmall = express.json();
const jsonLarge = express.json({ limit: '20mb' });

app.get('/admin/games', requireAuth, (req, res) => {
  const games = getAllGames();
  const teams = getAllTeams();
  const seasons = [...new Set(games.map(g => g.season).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const currentSeason = getCurrentSeason()?.season ?? 1;
  res.send(renderAdminPage(req, {
    title: 'Games',
    currentPath: '/admin/games',
    body: adminGamesListBody({ games, seasons, teams, currentSeason }),
  }));
});

app.post('/admin/games', requireAuth, jsonSmall, (req, res) => {
  const { date, team_a_id, team_b_id, season, game_type, series_id } = req.body;
  if (!date || !team_a_id || !team_b_id || !season) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const id = createGame({ date, teamAId: team_a_id, teamBId: team_b_id, season, gameType: game_type || 'regular', seriesId: series_id || '' });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/admin/games/:id/cover-img', requireAuth, (req, res) => {
  const cover = getGameCover(req.params.id);
  if (!cover?.social_cover_data_url) return res.status(404).end();
  const match = cover.social_cover_data_url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  res.setHeader('Content-Type', match[1]);
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(match[2], 'base64'));
});

app.get('/admin/games/:id', requireAuth, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/games', body: '<p style="color:var(--text-muted);padding:40px">Game not found.</p>' }));
  const players = getAllPlayers();
  const stats = getGameDetailStats(game.id);
  const dnpPlayers = getGameDnpPlayers(game.id);
  const quarterScores = extractQuarterScores(game);
  res.send(renderAdminPage(req, {
    title: `${game.team_a_name} vs ${game.team_b_name}`,
    currentPath: '/admin/games',
    body: adminGameDetailBody({ game, players, stats, dnpPlayers, quarterScores }),
  }));
});

app.delete('/admin/games/:id', requireAuth, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  deleteGame(game.id);
  res.json({ ok: true });
});

app.post('/admin/games/:id/final', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  const scoreA = parseInt(req.body.team_a_score, 10);
  const scoreB = parseInt(req.body.team_b_score, 10);
  if (isNaN(scoreA) || isNaN(scoreB)) return res.status(400).json({ error: 'Invalid scores' });
  markGameFinal(game.id, { teamAScore: scoreA, teamBScore: scoreB, overtime: Number(req.body.overtime) || 0 });
  res.json({ ok: true });
});

app.post('/admin/games/:id/overtime', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  setGameOvertime(game.id, Number(req.body.overtime) || 0);
  res.json({ ok: true });
});

app.post('/admin/games/:id/potg', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGamePotg(game.id, String(req.body.writeup || ''), String(req.body.player_id || ''));
  res.json({ ok: true });
});

app.post('/admin/games/:id/review', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGameReview(game.id, req.body.under_review);
  res.json({ ok: true });
});

app.post('/admin/games/:id/save', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  updateGameAll(game.id, {
    game_writeup:         b.game_writeup     !== undefined ? String(b.game_writeup)     : game.game_writeup,
    potg_writeup:         b.potg_writeup     !== undefined ? String(b.potg_writeup)     : game.potg_writeup,
    manual_potg_player_id: b.potg_player_id  !== undefined ? String(b.potg_player_id)   : game.manual_potg_player_id,
    youtube_url:          b.youtube_url      !== undefined ? String(b.youtube_url)       : game.youtube_url,
    under_review:         b.status           !== undefined ? (b.status === 'draft' ? 1 : 0) : game.under_review,
    date:                 b.date             !== undefined ? String(b.date)              : game.date,
  });
  res.json({ ok: true });
});

app.post('/admin/games/:id/recap', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGameRecap(game.id, String(req.body.writeup || ''));
  res.json({ ok: true });
});

app.post('/admin/games/:id/generate-recap', requireAuth, express.json(), async (req, res) => {
  if (!aiAvailable()) return res.status(400).json({ error: 'No AI API key configured.' });
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (game.scheduled) return res.status(400).json({ error: 'Game not yet imported.' });

  const stats      = getGameDetailStats(game.id);
  const potgId     = req.body?.player_id || game.manual_potg_player_id || derivePotgPlayerId(game, stats);
  const dnpPlayers = getGameDnpPlayers(game.id);
  const qScores    = extractQuarterScores(game);
  const records    = getTeamRecordsAsOf(game.season, game.date);
  const recMap     = Object.fromEntries(records.map(r => [r.team_id, r]));
  const prevMatch  = getPrevMatchup(game.id, game.team_a_id, game.team_b_id);
  const streakA    = getTeamStreak(game.team_a_id, game.id);
  const streakB    = getTeamStreak(game.team_b_id, game.id);

  // Filter PBP
  let log;
  try { log = JSON.parse(game.game_log_json || '[]'); } catch { log = []; }
  const pbpFiltered = filterPbpForRecap(log); // chronological order Q1→Q4

  // Derive notable DNPs: gp >= 3 AND (ppg >= 8 OR top-2 scorer on team)
  const allLeaders = getLeaders();
  const teamTopScorers = {};
  for (const p of allLeaders) {
    if (!teamTopScorers[p.team_id]) teamTopScorers[p.team_id] = [];
    if (teamTopScorers[p.team_id].length < 2) {
      teamTopScorers[p.team_id].push(p.id);
    }
  }
  const notableDnps = dnpPlayers
    .map(d => {
      const totals = getPlayerSeasonStats(d.id, game.season);
      if (!totals || totals.games_played < 3) return null;
      const ppg = totals.games_played > 0 ? totals.pts / totals.games_played : 0;
      const isTopScorer = (teamTopScorers[d.team_id] || []).includes(d.id);
      if (ppg < 8 && !isTopScorer) return null;
      return { name: displayPlayerName(d.name), team: d.team_name, ppg: ppg.toFixed(1), gp: totals.games_played };
    })
    .filter(Boolean);

  // Quarter lines
  const scoreA = Number(game.team_a_score), scoreB = Number(game.team_b_score);
  let cumA = 0, cumB = 0;
  const qLines = qScores.map(q => {
    if (q.a === null && q.b === null) return null;
    cumA += q.a ?? 0; cumB += q.b ?? 0;
    const lbl = q.quarter > 4 ? `OT${q.quarter - 4}` : `Q${q.quarter}`;
    const diff = cumA - cumB;
    const leader = diff > 0 ? game.team_a_name : diff < 0 ? game.team_b_name : 'TIE';
    return `${lbl}: ${game.team_a_name} ${cumA} – ${cumB} ${game.team_b_name} (${diff !== 0 ? `${leader} +${Math.abs(diff)}` : 'TIE'})`;
  }).filter(Boolean);
  const isOT = qScores.some(q => q.quarter > 4 && (q.a ?? 0) + (q.b ?? 0) > 0);

  const recA = recMap[game.team_a_id];
  const recB = recMap[game.team_b_id];
  const recordLineA = recA ? `${game.team_a_name}: ${recA.wins}-${recA.losses}` : null;
  const recordLineB = recB ? `${game.team_b_name}: ${recB.wins}-${recB.losses}` : null;

  const streakLine = (team, s) =>
    s.streak >= 2 ? `${team} is on a ${s.streak}-game ${s.type === 'W' ? 'winning' : 'losing'} streak.` : null;

  const pbpText = pbpFiltered.slice(-200).map(e => {
    const q = e.quarter ? (e.quarter > 4 ? `OT${e.quarter - 4}` : `Q${e.quarter}`) : '?';
    const clk = e.clockRemaining ?? '';
    const txt = String(e.text || '').replace(/⚡/g, '').trim();
    return txt ? `[${q} ${clk}] ${txt}` : null;
  }).filter(Boolean).join('\n');

  const topPerformers = [...stats].sort((a, b) => b.pts - a.pts).slice(0, 6).map(p => {
    const fgm = (p.fg2m|0) + (p.fg3m|0);
    const fga = fgm + (p.fg2m_miss|0) + (p.fg3m_miss|0);
    const pct = fga > 0 ? ` (${Math.round(fgm/fga*100)}% FG)` : '';
    return `${displayPlayerName(p.name)} (${p.team_name}): ${p.pts}pts/${p.reb}reb/${p.ast}ast/${p.stl}stl/${p.blk}blk${pct}`;
  }).join('\n');

  const potgStat = potgId ? stats.find(s => s.player_id === potgId) : null;
  const potgLine = potgStat
    ? (() => {
        const fgm = (potgStat.fg2m|0) + (potgStat.fg3m|0);
        const fga = fgm + (potgStat.fg2m_miss|0) + (potgStat.fg3m_miss|0);
        const pct = fga > 0 ? ` (${Math.round(fgm/fga*100)}% FG)` : '';
        return `${displayPlayerName(potgStat.name)} (${potgStat.team_name}): ${potgStat.pts}pts/${potgStat.reb}reb/${potgStat.ast}ast${pct}`;
      })()
    : null;

  const CLICHE_BAN = '"electrifying," "dazzling," "put on a show," "lights out," "on fire," "clutch performance," "stepped up," "did not disappoint," "fired on all cylinders," "gave it their all," "showed up big," "came to play," "heart-pounding," "jaw-dropping," "nothing short of spectacular," "competitive matchup," "hard-fought," "gritty," "intense battle," "back-and-forth affair," "close contest," "dominant performance," "statement win," "impressive outing," "strong showing"';

  // Gather recent recap headlines to prevent repetition
  const recentTitles = getAllGames()
    .filter(g => g.game_writeup && g.id !== game.id)
    .slice(0, 10)
    .map(g => parseWriteup(g.game_writeup).title)
    .filter(Boolean);

  const prompt = [
    `You are a local recreational basketball league writer — a community observer, not a broadcaster.`,
    `Write a game recap for a WKND Basketball League game. Tone: grounded, conversational, direct. Not hype.`,
    `Use ONLY the provided data. Do not invent quotes, events, or statistics.`,
    `Write plain text only. No markdown.`,
    ``,
    `STRICT RULES:`,
    `- Do NOT reference the crowd, audience, or spectators. The league has limited attendance.`,
    `- Stats shorthand: say "17 and 8" not "17 points and 8 rebounds." Use "pts/reb/ast" only when listing multiple players.`,
    `- Rotation/substitutions: mention only if directly relevant to a momentum shift. Do NOT describe lineup depth or patterns.`,
    `- Output format: a one-line headline, then exactly 3 paragraphs minimum. Close games or playoff games get 4. Structure: (1) game flow/result, (2) key performers, (3) context/implications.`,
    `- HEADLINE RULES: Must name the winning team. Must reference something specific and factual from THIS game — a player's stat line, the winning margin, a lead that was blown, an OT finish, a streak broken. Max 10 words. Do NOT use a generic description of the game type. Do NOT start with "In a," "A," or the date.`,
    `- Banned words/phrases: ${CLICHE_BAN}`,
    recentTitles.length
      ? `- HEADLINES ALREADY USED IN RECENT RECAPS (do NOT repeat these patterns or use similar phrasing):\n${recentTitles.map(t => `  "${t}"`).join('\n')}`
      : '',
    ``,
    `GAME: ${game.team_a_name} ${scoreA} – ${scoreB} ${game.team_b_name}`,
    `Date: ${game.date}  |  Season ${game.season}  |  ${game.game_type === 'playoff' ? `PLAYOFF${game.playoff_round ? ' – ' + game.playoff_round : ''}` : game.game_type === 'finals' ? 'FINALS' : 'Regular Season'}${isOT ? '  |  OVERTIME' : ''}`,
    `Final margin: ${Math.abs(scoreA - scoreB)} pts${Math.abs(scoreA - scoreB) <= 6 ? ' (CLOSE GAME — emphasize late-game events)' : ''}`,
    ``,
    `TEAM RECORDS (entering this game):`,
    recordLineA || `${game.team_a_name}: record unavailable`,
    recordLineB || `${game.team_b_name}: record unavailable`,
    [streakLine(game.team_a_name, streakA), streakLine(game.team_b_name, streakB)].filter(Boolean).join('\n') || '(no notable streaks)',
    ``,
    prevMatch
      ? `PREVIOUS MATCHUP: ${prevMatch.team_a_name} ${prevMatch.team_a_score} – ${prevMatch.team_b_score} ${prevMatch.team_b_name} on ${prevMatch.date}`
      : 'PREVIOUS MATCHUP: First meeting or no prior matchup found.',
    ``,
    `QUARTER-BY-QUARTER (running score):`,
    qLines.length ? qLines.join('\n') : '(quarter scores unavailable)',
    ``,
    potgLine ? `PLAYER OF THE GAME: ${potgLine}` : '',
    potgLine ? `(This player must be featured prominently in the recap — reference their specific stats in paragraphs 2 and/or 3.)` : '',
    ``,
    `TOP PERFORMERS:`,
    topPerformers || '(no stats)',
    ``,
    notableDnps.length
      ? `NOTABLE ABSENCES (DNP this game):\n${notableDnps.map(d => `${d.name} (${d.team}): ${d.ppg} PPG avg over ${d.gp} games this season`).join('\n')}`
      : '',
    ``,
    `PLAY-BY-PLAY (chronological Q1→Q4, ${pbpFiltered.length} events):`,
    pbpText || '(no play-by-play data)',
  ].filter(s => s !== null).join('\n');

  try {
    const { text } = await generateText(prompt, { temperature: 0.72, maxTokens: 900 });
    res.json({ writeup: text });
  } catch (err) {
    console.error('generate-recap error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/admin/games/:id/generate-potg', requireAuth, express.json(), async (req, res) => {
  if (!aiAvailable()) return res.status(400).json({ error: 'No AI API key configured.' });
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (game.scheduled) return res.status(400).json({ error: 'Game not yet imported.' });

  const stats = getGameDetailStats(game.id);
  const potgId = req.body?.player_id || game.manual_potg_player_id || derivePotgPlayerId(game, stats);
  if (!potgId) return res.status(400).json({ error: 'Cannot determine player of the game.' });

  const potgStat = stats.find(s => s.player_id === potgId);
  if (!potgStat) return res.status(400).json({ error: 'POTG player stats not found.' });

  const scoreA = Number(game.team_a_score), scoreB = Number(game.team_b_score);
  const playerTeamWon = potgStat.team_id === game.team_a_id
    ? scoreA > scoreB
    : scoreB > scoreA;

  const careerHighs = getPlayerCareerHighs(potgId);
  const seasonStats = getPlayerSeasonStats(potgId, game.season);
  const leagueRank  = getPlayerLeagueRank(potgId, game.season);
  const gameLogs    = getPlayerGameLog(potgId).slice(1, 7); // exclude current game

  const fgm = (potgStat.fg2m|0) + (potgStat.fg3m|0);
  const fga = fgm + (potgStat.fg2m_miss|0) + (potgStat.fg3m_miss|0);
  const fgPct = fga > 0 ? `${Math.round(fgm/fga*100)}%FG` : '';

  const careerHighFlags = [];
  if (careerHighs) {
    if (potgStat.pts >= careerHighs.pts && potgStat.pts > 0) careerHighFlags.push('PTS');
    if (potgStat.reb >= careerHighs.reb && potgStat.reb > 0) careerHighFlags.push('REB');
    if (potgStat.ast >= careerHighs.ast && potgStat.ast > 0) careerHighFlags.push('AST');
  }

  const seasonLine = seasonStats
    ? `Season averages (${seasonStats.games_played}GP): ${(seasonStats.pts/seasonStats.games_played).toFixed(1)}pts / ${(seasonStats.reb/seasonStats.games_played).toFixed(1)}reb / ${(seasonStats.ast/seasonStats.games_played).toFixed(1)}ast`
    : 'Season averages: unavailable';

  const prevLines = gameLogs.map(g => {
    const isTeamA = g.player_team_id === g.team_a_id;
    const opp = isTeamA ? g.team_b_name : g.team_a_name;
    return `${g.date} vs ${opp}: ${g.pts}pts/${g.reb}reb/${g.ast}ast`;
  });

  const CLICHE_BAN = '"electrifying," "dazzling," "put on a show," "lights out," "on fire," "clutch performance," "stepped up," "did not disappoint," "showed up big," "came to play," "heart-pounding," "jaw-dropping"';

  const prompt = [
    `You are writing a short player-of-the-game spotlight for a local recreational basketball league.`,
    `Write exactly 2–3 sentences. Plain text only. No markdown.`,
    `Lead with what the player DID, not their name. (e.g., "A 22-point, 9-rebound effort..." not "John Smith had...")`,
    `Scale the tone to performance magnitude: a 10-pt game gets a plain sentence; a 30-pt game gets more energy.`,
    `Do NOT mention PER, advanced metrics, or formula names.`,
    `Do NOT reference the crowd or atmosphere.`,
    `Banned phrases: ${CLICHE_BAN}`,
    ``,
    `GAME: ${game.team_a_name} ${scoreA} – ${scoreB} ${game.team_b_name}  |  ${game.date}  |  Season ${game.season}`,
    `Game type: ${game.game_type === 'playoff' ? `PLAYOFF${game.playoff_round ? ' – ' + game.playoff_round : ''}` : game.game_type === 'finals' ? 'FINALS' : 'Regular Season'}`,
    ``,
    `PLAYER: ${displayPlayerName(potgStat.name)} (${potgStat.team_name})`,
    `This game: ${potgStat.pts}pts / ${potgStat.reb}reb / ${potgStat.ast}ast / ${potgStat.stl}stl / ${potgStat.blk}blk${fgPct ? ' / ' + fgPct : ''}`,
    `Player's team ${playerTeamWon ? 'WON' : 'LOST'} this game.`,
    careerHighFlags.length ? `Career highs set this game: ${careerHighFlags.join(', ')}` : '',
    leagueRank ? `League rank in scoring: ${leagueRank}${leagueRank === 1 ? 'st' : leagueRank === 2 ? 'nd' : leagueRank === 3 ? 'rd' : 'th'} in the league` : '',
    seasonLine,
    ``,
    prevLines.length ? `Recent games:\n${prevLines.join('\n')}` : 'Recent games: none on record.',
  ].filter(Boolean).join('\n');

  try {
    const { text } = await generateText(prompt, { temperature: 0.6, maxTokens: 160 });
    // Trim to max 3 sentences
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
    res.json({ writeup: sentences.join(' ') });
  } catch (err) {
    console.error('generate-potg error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/admin/games/:id/youtube', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGameYoutube(game.id, String(req.body.url || ''));
  res.json({ ok: true });
});

app.post('/admin/games/:id/cover', requireAuth, jsonLarge, async (req, res) => {
  try {
    const game = getGameById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Not found' });

    const dataUrl = String(req.body.dataUrl || '');
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const inputBuffer = Buffer.from(match[2], 'base64');
    const compressed  = await sharp(inputBuffer)
      .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    const before = Math.round(inputBuffer.length / 1024);
    const after  = Math.round(compressed.length / 1024);
    console.log(`Cover upload: ${before}KB → ${after}KB`);

    updateGameCover(game.id, 'data:image/jpeg;base64,' + compressed.toString('base64'));
    res.json({ ok: true, before, after });
  } catch (err) {
    console.error('Cover upload error:', err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

app.delete('/admin/games/:id/cover', requireAuth, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGameCover(game.id, '');
  res.json({ ok: true });
});

app.post('/admin/games/:id/import', requireAuth, jsonLarge, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });

  const payload = req.body;
  if (payload?.type !== 'wknd-game-log') {
    return res.status(400).json({ error: 'Invalid file. Export the game from the wknd-stats admin app.' });
  }

  const g = payload.game;
  if (!g) return res.status(400).json({ error: 'Missing game data in export file.' });

  const nameA = String(g.teamAName || '').toUpperCase();
  const nameB = String(g.teamBName || '').toUpperCase();
  if (nameA !== game.team_a_name.toUpperCase() || nameB !== game.team_b_name.toUpperCase()) {
    return res.status(400).json({
      error: `Team mismatch: export is ${g.teamAName} vs ${g.teamBName}, this game is ${game.team_a_name} vs ${game.team_b_name}.`
    });
  }

  const rawDnp = Array.isArray(payload.dnpPlayers) ? payload.dnpPlayers : [];
  const dnpPlayerIds = rawDnp.map(p => (typeof p === 'string' ? p : String(p?.id || p?.player_id || ''))).filter(Boolean);

  const logJson   = Array.isArray(payload.gameLog) ? payload.gameLog : [];
  const snapshots = Array.isArray(payload.periodSnapshots) ? payload.periodSnapshots : [];
  console.log(`[import] game=${game.id} log_events=${logJson.length} snapshots=${snapshots.length} log_json_kb=${Math.round(JSON.stringify(logJson).length/1024)}`);
  const t0 = Date.now();
  try {
    importGameResults(game.id, {
      teamAScore:      Number(g.teamAScore || 0),
      teamBScore:      Number(g.teamBScore || 0),
      periodSnapshots: snapshots,
      gameLog:         logJson,
      dnpPlayerIds,
      playerStats:     (typeof g.playerStats === 'object' && g.playerStats) ? g.playerStats : {},
      season:          game.season,
    });
    console.log(`[import] done in ${Date.now() - t0}ms`);
    res.json({ ok: true, teamAScore: Number(g.teamAScore), teamBScore: Number(g.teamBScore) });

    // Auto-recompute ratings for all players in this game (non-blocking, after response)
    setImmediate(() => {
      try {
        const season = String(game.season ?? '');
        const ctx    = buildSharedContext(season);
        const playerIds = Object.keys(
          (typeof g.playerStats === 'object' && g.playerStats) ? g.playerStats : {}
        );
        for (const pid of playerIds) computeAndSave(pid, season, ctx);
      } catch (e) {
        console.error('[import] auto-recompute error:', e.message);
      }
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

app.post('/admin/player/:id/photo', requireAuth, jsonLarge, async (req, res) => {
  try {
    const player = getPlayerById(req.params.id);
    if (!player) return res.status(404).json({ error: 'Not found' });

    const dataUrl = String(req.body.dataUrl || '');
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const inputBuffer = Buffer.from(match[2], 'base64');
    const compressed  = await sharp(inputBuffer)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    updatePlayerPhoto(player.id, 'data:image/jpeg;base64,' + compressed.toString('base64'));

    const originalBuf = parseDataUrl(req.body.originalDataUrl);
    if (originalBuf) {
      try { updatePlayerPhotoOriginal(player.id, await compressSourceImage(originalBuf)); }
      catch (err) { console.error('photo_original compress error:', err); }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Player photo upload error:', err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

// Self-service counterpart — same crop/compress pipeline, keyed off the session instead of
// a trusted :id param (same reasoning as /me/writeup) so a plain player can update their own
// photo without an admin session. Admins editing their own profile still go through the
// route above, since isAdmin already satisfies its requireAuth gate.
app.post('/me/photo', jsonLarge, async (req, res) => {
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) {
    return res.status(401).json({ error: 'Log in to edit your profile.' });
  }
  try {
    const playerId = req.session.playerPlayerId;
    const dataUrl = String(req.body.dataUrl || '');
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data' });

    const inputBuffer = Buffer.from(match[2], 'base64');
    const compressed  = await sharp(inputBuffer)
      .rotate()
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    updatePlayerPhoto(playerId, 'data:image/jpeg;base64,' + compressed.toString('base64'));

    const originalBuf = parseDataUrl(req.body.originalDataUrl);
    if (originalBuf) {
      try { updatePlayerPhotoOriginal(playerId, await compressSourceImage(originalBuf)); }
      catch (err) { console.error('photo_original compress error:', err); }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Player photo upload error:', err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

app.get('/games', (req, res) => {
  const teams = getAllTeams();
  const players = getAllPlayers();
  const games = byDate(getAllGames());

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const completedGames = games.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  // Trimmed to a teaser now that /highlights is the full browsing destination — the "See
  // all" link on this widget points there, not back at this page.
  const highlights = buildHighlights(completedGames, playerMap, teamMap, 4);

  const commentsEnabled = getSetting('comments_enabled', '0') === '1';
  let socialByGame = {};
  if (commentsEnabled) {
    const ids = completedGames.map(g => g.id);
    const commentCounts = getGameCommentCounts(ids);
    const reactionCounts = getGameReactionCounts(ids);
    const reactedIds = getReactedGameIdsForPlayer(ids, req.session?.playerPlayerId || null);
    socialByGame = Object.fromEntries(ids.map(id => [id, {
      commentsCount: commentCounts[id] || 0,
      reactCount: reactionCounts[id] || 0,
      reacted: reactedIds.has(id),
    }]));
  }

  res.send(renderPage(req, {
    title: 'Games — WKND Basketball League',
    currentPath: req.path,
    body: gamesPage({ games, highlights, commentsEnabled, socialByGame })
  }));
});

app.get('/highlights', (req, res) => {
  const players = getAllPlayers();
  const teams = getAllTeams();
  const games = byDate(getAllGames());
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const completedGames = games.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  // Uncapped (bounded only by how many completed games have a POTG writeup) — this page
  // is the full browsing destination, unlike the small teaser count used elsewhere.
  const highlights = buildHighlights(completedGames, playerMap, teamMap, completedGames.length);

  res.send(renderPage(req, {
    title: 'Player Highlights — WKND Basketball League',
    currentPath: req.path,
    body: highlightsPage({ highlights })
  }));
});

app.get('/standings', (req, res) => {
  const teams = getAllTeams();
  const players = getAllPlayers();
  const games = byDate(getAllGames());
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const completedGames = games.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const highlights = buildHighlights(completedGames, playerMap, teamMap);
  const teamStats = getTeamSeasonStats();
  res.send(renderPage(req, {
    title: 'Standings — WKND Basketball League',
    currentPath: req.path,
    body: standingsPage({ teams, games, highlights, teamStats })
  }));
});

app.get('/playoffs', (req, res) => {
  const season = getPortalCurrentSeason();
  const standings = getSeasonStandings(season);
  const games = getPlayoffGames(season);
  res.send(renderPage(req, {
    title: 'Playoffs — WKND Basketball League',
    currentPath: req.path,
    body: playoffsPage({ standings, games, season })
  }));
});

// Applies to every request from here on, ahead of any route's own express.json() — a
// route-level limit override (e.g. /settle-balance's 20mb) never actually took effect
// while this ran first with Express's 100kb default and rejected the request before the
// route-specific parser ever got a chance to run.
app.use(express.json({ limit: '20mb' }));

// ── Roster endpoint (consumed by wknd-stats before each live game) ────────────
app.get('/api/roster', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (ROSTER_API_KEY && key !== ROSTER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const teams   = getAllTeams();
  const players = getAllPlayers();
  const season  = getPortalCurrentSeason();

  const heightRows = portalDb.prepare(
    `SELECT player_id, height FROM registrations WHERE player_id IS NOT NULL AND height IS NOT NULL AND height != '' ORDER BY created_at DESC`
  ).all();
  const heightMap = {};
  for (const r of heightRows) if (!heightMap[r.player_id]) heightMap[r.player_id] = r.height;

  const fmtHeight = h => {
    const n = parseInt(h, 10);
    return isNaN(n) ? null : `${n}cm`;
  };

  const roster = {
    season,
    gameTypes: ['regular', 'playoff', 'finals'],
    teams: teams.map(t => ({
      id:    t.id,
      name:  t.name,
      color: t.color,
    })),
    players: players.map(p => ({
      id:         p.id,
      name:       p.name,
      firstName:  p.first_name,
      lastName:   p.last_name,
      number:     p.number,
      teamId:     p.team_id,
      positions:  (() => { try { return JSON.parse(p.positions || '[]'); } catch { return []; } })(),
      pictureUrl: p.picture_url || '',
      status:     p.status,
      height:     fmtHeight(heightMap[p.id]) ?? null,
    })),
  };

  res.json(roster);
});

app.post('/api/leaders/share', (req, res) => {
  const { season, category_id, mode, player_id, player_name, team_id,
          team_name, team_color, stat_label, stat_title, stat_value, stat_fmt } = req.body || {};
  if (!season || !category_id || !mode || !player_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Compute top entries + leader photo server-side for the share image
  let top10 = [];
  let leaderPlayer = null;

  if (mode === 'rec') {
    const recCat       = RECORD_CATS.find(c => c.id === category_id);
    const recFmt       = recCat?.fmt || (v => String(Math.round(v)));
    const allRecs      = getGameRecords();
    const filteredRecs = season === 'alltime' ? allRecs : allRecs.filter(r => String(r.season) === String(season));
    if (recCat) {
      top10 = filteredRecs
        .map(r => ({ r, v: Number(recCat.fn(r) || 0) }))
        .filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 5)
        .map(x => {
          const ctx = recordContext(x.r);
          return {
            player_id:   x.r.player_id,
            player_name: x.r.name,
            team_name:   String(x.r.team_name || '').toUpperCase(),
            team_color:  teamColor(String(x.r.team_name || '').toUpperCase()),
            stat_value:  x.v,
            stat_fmt:    recFmt(x.v),
            game_id:     String(x.r.game_id || ''),
            game_date:   String(x.r.date || ''),
            game_opp:    ctx.opp,
            game_result: ctx.result,
            is_playoff:  ctx.isPO,
            is_finals:   ctx.isFinals,
          };
        });
    }
    leaderPlayer = getPlayerPhoto(player_id);
  } else if (mode === 'roast') {
    const cat        = ROAST_CATS.find(c => c.id === category_id);
    const fmt        = cat?.fmt || (v => v.toFixed(1));
    const allPlayers = buildLeaderPlayers();
    leaderPlayer     = allPlayers.find(p => p.id === player_id);
    top10 = cat
      ? allPlayers
          .map(p => ({ p, v: cat.fn(p) }))
          .filter(x => x.v !== null && x.v !== undefined && !isNaN(x.v))
          .sort((a, b) => cat.asc ? a.v - b.v : b.v - a.v)
          .slice(0, 10)
          .map(x => ({
            player_id:   x.p.id,
            player_name: x.p.name,
            team_name:   x.p.team_name,
            team_color:  teamColor(String(x.p.team_name || '').toUpperCase()),
            stat_value:  x.v,
            stat_fmt:    fmt(x.v),
          }))
      : [];
  } else {
    const allCats    = mode === 'pg' ? PER_GAME : TOTALS;
    const cat        = allCats.find(c => c.id === category_id);
    const defaultFmt = mode === 'pg' ? fmtPerGame : fmtTotals;
    const fmt        = cat?.fmt || defaultFmt;
    const allPlayers = buildLeaderPlayers();
    leaderPlayer     = allPlayers.find(p => p.id === player_id);
    top10 = cat
      ? allPlayers
          .map(p => ({ p, v: cat.fn(p) }))
          .filter(x => x.v > 0)
          .sort((a, b) => b.v - a.v || b.p.games_played - a.p.games_played || (b.p.team_wins || 0) - (a.p.team_wins || 0))
          .slice(0, 10)
          .map(x => ({
            player_id:   x.p.id,
            player_name: x.p.name,
            team_name:   x.p.team_name,
            team_color:  teamColor(String(x.p.team_name || '').toUpperCase()),
            stat_value:  x.v,
            stat_fmt:    fmt(x.v),
          }))
      : [];
  }

  const id = upsertShare({
    id: randomBytes(4).toString('hex'),
    season, category_id, mode, player_id, player_name, team_id,
    team_name, team_color, stat_label, stat_title,
    stat_value: Number(stat_value), stat_fmt,
    top10,
    player_picture_url: leaderPlayer?.picture_url || '',
    created_at: Date.now(),
  });
  const url = `${getRequestOrigin(req)}/leaders/share/${id}`;
  res.json({ id, url });
});

app.get('/leaders/share/:id', (req, res) => {
  const share = getShare(req.params.id);
  if (!share) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: '/leaders', body: '<p style="padding:40px;color:var(--text-muted)">Share link not found.</p>' })
  );
  const origin      = getRequestOrigin(req);
  const displayName = formatName(share.player_name);
  const teamName    = String(share.team_name || '').toUpperCase();
  const color       = share.team_color;
  const isLight     = teamName === 'WHITE';
  const isRecShare  = share.mode === 'rec';
  const isAlltime   = share.season === 'alltime';
  const scopeText   = isAlltime ? 'All-Time' : `Season ${share.season}`;
  const { asOfSeason, asOfWeek } = buildShareAsOfLabel(share);
  const asOfDesc    = asOfWeek
    ? (isAlltime ? ` Updated through Season ${asOfSeason}, Week ${asOfWeek}.` : ` Updated through Week ${asOfWeek}.`)
    : '';
  const isRoastShare = share.mode === 'roast';
  const title       = isRecShare
    ? `${displayName} · ${share.stat_label} ${scopeText} Record — WKND Basketball`
    : isRoastShare
      ? `${displayName} · ${share.stat_title} — The Roast · WKND Basketball`
      : `${displayName} · ${share.stat_label} Leader (${scopeText}) — WKND Basketball`;
  const desc        = isRecShare
    ? `${displayName} holds the ${isAlltime ? 'all-time' : `Season ${share.season}`} ${share.stat_title} record with ${share.stat_fmt}.${asOfDesc}`
    : isRoastShare
      ? `${displayName} earned the "${share.stat_title}" award — ${share.stat_fmt} ${share.stat_label}.${asOfDesc}`
      : `${displayName} leads the WKND League in ${share.stat_title} with ${share.stat_fmt}${share.mode === 'pg' ? ' per game' : ' total'}.${asOfDesc}`;
  const imageUrl    = `${origin}/api/leaders/share/${share.id}/image.png`;
  const pageUrl     = `${origin}/leaders/share/${share.id}`;
  const metaTags = [
    `<meta name="description" content="${escAttr(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:url" content="${escAttr(pageUrl)}">`,
    `<meta property="og:image" content="${escAttr(imageUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escAttr(title)}">`,
    `<meta name="twitter:description" content="${escAttr(desc)}">`,
    `<meta name="twitter:image" content="${escAttr(imageUrl)}">`,
  ].join('\n  ');
  res.send(renderPage(req, {
    title,
    currentPath: '/leaders',
    metaTags,
    body: leaderSharePage({ share, displayName, teamName, color, isLight }),
  }));
});

app.get('/api/leaders/share/:id/image.png', async (req, res) => {
  const share = getShare(req.params.id);
  if (!share) return res.status(404).end();
  try {
    const png = await generateLeaderSvg(share);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.end(png);
  } catch (err) {
    console.error('Leader share image error:', err);
    res.status(500).end();
  }
});

app.get('/api/leaders/share/:id/card.png', async (req, res) => {
  const share = getShare(req.params.id);
  if (!share) return res.status(404).end();
  try {
    const fullPng  = await generateLeaderSvg(share);
    const cardOnly = await sharp(fullPng).extract({ left: 32, top: 32, width: 1136, height: 566 }).toBuffer();
    const { asOfLabel } = buildShareAsOfLabel(share);
    const footerText = asOfLabel ? `WKNDBASKETBALL.COM   ·   ${asOfLabel}` : 'WKNDBASKETBALL.COM';
    const FOOTER_H   = 44;
    const footerSvg  = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1136" height="${FOOTER_H}">` +
      `<text x="568" y="28" text-anchor="middle" font-family="${COVER_SVG_FONT}" font-size="11" fill="#334155" letter-spacing="3">${escXml(footerText)}</text>` +
      `</svg>`
    );
    const result = await sharp({
      create: { width: 1136, height: 566 + FOOTER_H, channels: 3, background: { r: 10, g: 14, b: 22 } }
    })
      .composite([{ input: cardOnly, top: 0, left: 0 }, { input: footerSvg, top: 566, left: 0 }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.end(result);
  } catch (err) {
    console.error('Leader card download error:', err);
    res.status(500).end();
  }
});

// ── MVP Race ──────────────────────────────────────────────────────────────────
const SEASON_GAMES_PER_TEAM = 6; // double round robin

function computeMvpScore(s) {
  const gp  = s.gp;
  const ppg = s.pts / gp, rpg = s.reb / gp, apg = s.ast / gp;
  const spg = s.stl / gp, bpg = s.blk / gp, tpg = s.tov / gp;
  const base = ppg + rpg*0.8 + apg*0.9 + spg*1.5 + bpg*2.0 - tpg*1.0;

  const tsDenom = 2 * (s.fga + 0.44 * s.fta);
  const tsPct   = tsDenom > 0 ? s.pts / tsDenom : 0;
  let effMult = 1.00;
  if (tsDenom > 0) {
    if      (tsPct >= 0.70) effMult = 1.20;
    else if (tsPct >= 0.60) effMult = 1.10;
    else if (tsPct >= 0.50) effMult = 1.00;
    else if (tsPct >= 0.40) effMult = 0.85;
    else                    effMult = 0.70;
  }
  const winRate = (s.wins + s.losses) > 0 ? s.wins / (s.wins + s.losses) : 0.5;
  const winMult = 0.80 + winRate * 0.40;
  const gpRatio = Math.min(1, gp / SEASON_GAMES_PER_TEAM);
  return base * effMult * winMult * gpRatio;
}

function mvpStatsKey(s) {
  return `v2_${s.gp}_${s.pts}_${s.reb}_${s.ast}_${s.fgm}_${s.fga}_${s.ftm}_${s.fta}_${s.wins}_${s.losses}`;
}

function isPlayoffStarted(season) {
  return getPlayoffGames(String(season)).length > 0;
}

app.get('/awards', (req, res) => {
  if (getSetting('awards_enabled', '1') === '0') return res.status(404).send(
    renderPage(req, { title: 'Not Found', currentPath: '/awards', body: '<div class="container"><p style="padding:40px;color:var(--text-muted)">Page not found.</p></div>' })
  );
  const currentSeason = getPortalCurrentSeason();
  const season = Number(req.query.season) || Number(currentSeason) || 3;
  const awards = getSeasonAwards(season);
  const availableSeasons = getAwardSeasons();
  const visibleSections = new Set(AWARD_SECTION_KEYS.filter(k => getSetting(`award_show_${k}`, '0') !== '0'));
  const articles = Object.fromEntries(AWARD_SECTION_KEYS.map(k => [k, getSetting(`award_article_${k}_${season}`, '')]));
  for (const award of awards) {
    if (['all_wknd_1', 'all_wknd_2', 'all_wknd_def', 'champion'].includes(award.award_type)) {
      const key = `${award.award_type}_${award.player_id}`;
      articles[key] = getSetting(`award_article_${key}_${season}`, '');
    }
  }
  res.send(renderPage(req, {
    title: `Season ${season} Awards — WKND Basketball`,
    currentPath: '/awards',
    body: awardsPage({ awards, season, availableSeasons, visibleSections, articles }),
  }));
});

// ── Award share image routes ──────────────────────────────────────────────────

app.get('/api/awards/:season/stat-leaders/og-image.png', async (req, res) => {
  const season = Number(req.params.season);
  if (!season) return res.status(404).end();
  const cacheKey = `stat-leaders-${season}`;
  try {
    let entry = _awardOgCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > 3_600_000) {
      const all  = getSeasonAwards(season);
      const rows = STAT_LEADER_TYPES.map(t => all.find(a => a.award_type === t)).filter(Boolean);
      if (!rows.length) return res.status(404).end();
      const buf = await buildStatLeadersOgPng(rows, season);
      entry = { buf, ts: Date.now() };
      _awardOgCache.set(cacheKey, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(entry.buf);
  } catch (err) { console.error('stat-leaders-og error:', err); res.status(500).end(); }
});

app.get('/api/awards/:season/:type/og-image.png', async (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  if (!season) return res.status(404).end();

  // MVP/DPOY are always single-player — even in multi-image cover mode — so they're
  // served from the existing :playerId route/URL, not here.
  if (!AWARD_OG_BADGE[type] || !TEAM_AWARD_TYPES_OG.has(type)) return res.status(404).end();
  const badge    = { ...AWARD_OG_BADGE[type], _type: type };
  const cacheKey = `team-${season}-${type}`;
  try {
    let entry = _awardOgCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > 3_600_000) {
      const rows = getSeasonAwards(season).filter(a => a.award_type === type);
      if (!rows.length) return res.status(404).end();
      const buf = await buildTeamAwardOgPng(rows, badge, season);
      entry = { buf, ts: Date.now() };
      _awardOgCache.set(cacheKey, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(entry.buf);
  } catch (err) { console.error('award-team-og error:', err); res.status(500).end(); }
});

// Text-stripped variant for the homepage hero carousel — same team-strip graphic (photos,
// crop overrides, gradients) without the banner/pill/watermark, since the hero slide draws
// its own title/CTA as HTML. Also serves 'champion' (roster-wide, capped at 5 for the strip),
// which the regular og-image route above doesn't support.
app.get('/api/awards/:season/:type/gallery-image.png', async (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  if (!season) return res.status(404).end();
  if (!AWARD_OG_BADGE[type] || !HOME_GALLERY_TEAM_TYPES.includes(type)) return res.status(404).end();
  const badge    = { ...AWARD_OG_BADGE[type], _type: type };
  const cacheKey = `team-gallery-${season}-${type}`;
  try {
    let entry = _awardOgCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > 3_600_000) {
      const rows = getSeasonAwards(season).filter(a => a.award_type === type);
      if (!rows.length) return res.status(404).end();
      const buf = await buildTeamAwardOgPng(rows, badge, season, { text: false });
      entry = { buf, ts: Date.now() };
      _awardOgCache.set(cacheKey, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(entry.buf);
  } catch (err) { console.error('award-team-gallery error:', err); res.status(500).end(); }
});

app.get('/api/awards/:season/:type/:playerId/og-image.png', async (req, res) => {
  const season = Number(req.params.season);
  const { type, playerId } = req.params;
  if (!season || !AWARD_OG_BADGE[type]) return res.status(404).end();
  const badge    = AWARD_OG_BADGE[type];
  const cacheKey = `player-${season}-${type}-${playerId}`;
  try {
    let entry = _awardOgCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > 3_600_000) {
      const row = getSeasonAwards(season).find(a => a.award_type === type && a.player_id === playerId);
      if (!row) return res.status(404).end();
      const buf = await buildPlayerAwardOgPng(row, type, badge, season);
      entry = { buf, ts: Date.now() };
      _awardOgCache.set(cacheKey, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(entry.buf);
  } catch (err) { console.error('award-player-og error:', err); res.status(500).end(); }
});

// Same graphic as the og-image route above (photo, crop/zoom overrides, gradient/team-glow
// treatment) with every text overlay stripped — used for the homepage hero carousel, which
// draws its own title/writeup/CTA as HTML on top and doesn't want the baked-in labels
// colliding with that.
app.get('/api/awards/:season/:type/:playerId/gallery-image.png', async (req, res) => {
  const season = Number(req.params.season);
  const { type, playerId } = req.params;
  if (!season || !AWARD_OG_BADGE[type]) return res.status(404).end();
  const badge    = AWARD_OG_BADGE[type];
  const cacheKey = `player-gallery-${season}-${type}-${playerId}`;
  try {
    let entry = _awardOgCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > 3_600_000) {
      const row = getSeasonAwards(season).find(a => a.award_type === type && a.player_id === playerId);
      if (!row) return res.status(404).end();
      const buf = await buildPlayerAwardOgPng(row, type, badge, season, { text: false });
      entry = { buf, ts: Date.now() };
      _awardOgCache.set(cacheKey, entry);
    }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(entry.buf);
  } catch (err) { console.error('award-player-gallery error:', err); res.status(500).end(); }
});

app.get('/awards/share/:season/stat-leaders', (req, res) => {
  const season = Number(req.params.season);
  if (!season) return res.status(404).end();
  const origin  = getRequestOrigin(req);
  const pageUrl = `${origin}/awards/share/${season}/stat-leaders`;
  const imgUrl  = `${origin}/api/awards/${season}/stat-leaders/og-image.png`;
  const title   = `Statistical Leaders — Season ${season} — WKND Basketball`;
  const desc    = `Check out the WKND Basketball Season ${season} Statistical Leaders!`;
  const metaTags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escAttr(pageUrl)}">`,
    `<meta property="og:site_name" content="WKND Basketball">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:image" content="${escAttr(imgUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escAttr(imgUrl)}">`,
  ].join('\n  ');
  res.send(renderPage(req, {
    title, currentPath: '/awards', metaTags,
    body: `<div class="container"><div class="page-content" style="padding:60px 0;text-align:center">
      <p style="color:var(--text-muted);margin-bottom:16px">Redirecting to awards...</p>
      <a href="/awards?season=${season}" style="color:var(--amber);font-weight:600">View Awards →</a>
    </div></div>
    <script>setTimeout(function(){ location.replace("/awards?season=${season}"); }, 500);</script>`,
  }));
});

app.get('/awards/share/:season/:type', (req, res) => {
  const season = Number(req.params.season);
  const { type } = req.params;
  if (!season || !AWARD_OG_BADGE[type] || !TEAM_AWARD_TYPES_OG.has(type)) return res.status(404).end();
  const badge      = AWARD_OG_BADGE[type];
  const origin     = getRequestOrigin(req);
  const pageUrl    = `${origin}/awards/share/${season}/${type}`;
  const imgUrl     = `${origin}/api/awards/${season}/${type}/og-image.png`;
  const title      = `${badge.label} — Season ${season} — WKND Basketball`;
  const desc       = `Check out the WKND Basketball Season ${season} ${badge.label}!`;
  const metaTags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escAttr(pageUrl)}">`,
    `<meta property="og:site_name" content="WKND Basketball">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:image" content="${escAttr(imgUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escAttr(imgUrl)}">`,
  ].join('\n  ');
  res.send(renderPage(req, {
    title, currentPath: '/awards', metaTags,
    body: `<div class="container"><div class="page-content" style="padding:60px 0;text-align:center">
      <p style="color:var(--text-muted);margin-bottom:16px">Redirecting to awards...</p>
      <a href="/awards?season=${season}" style="color:var(--amber);font-weight:600">View Awards →</a>
    </div></div>
    <script>setTimeout(function(){ location.replace("/awards?season=${season}"); }, 500);</script>`,
  }));
});

app.get('/awards/share/:season/:type/:playerId', (req, res) => {
  const season = Number(req.params.season);
  const { type, playerId } = req.params;
  if (!season || !AWARD_OG_BADGE[type]) return res.status(404).end();
  const badge  = AWARD_OG_BADGE[type];
  const awards = getSeasonAwards(season);
  const row    = awards.find(a => a.award_type === type && a.player_id === playerId);
  if (!row) return res.status(404).end();
  const displayName = formatName(row.player_name || '');
  const origin      = getRequestOrigin(req);
  const pageUrl     = `${origin}/awards/share/${season}/${type}/${encodeURIComponent(playerId)}`;
  const imgUrl      = `${origin}/api/awards/${season}/${type}/${encodeURIComponent(playerId)}/og-image.png`;
  const title       = `${displayName} — ${badge.label} — Season ${season} — WKND Basketball`;
  const desc        = `${displayName} has been named to the WKND Basketball Season ${season} ${badge.label}!`;
  const metaTags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escAttr(pageUrl)}">`,
    `<meta property="og:site_name" content="WKND Basketball">`,
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(desc)}">`,
    `<meta property="og:image" content="${escAttr(imgUrl)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escAttr(imgUrl)}">`,
  ].join('\n  ');
  const redirect = `/awards?season=${season}`;
  res.send(renderPage(req, {
    title, currentPath: '/awards', metaTags,
    body: `<div class="container"><div class="page-content" style="padding:60px 0;text-align:center">
      <p style="color:var(--text-muted);margin-bottom:16px">Redirecting to awards...</p>
      <a href="${redirect}" style="color:var(--amber);font-weight:600">View Awards →</a>
    </div></div>
    <script>setTimeout(function(){ location.replace("${redirect}"); }, 500);</script>`,
  }));
});

app.post('/admin/mvp/regenerate', requireAuth, express.json(), (req, res) => {
  const { player_id, season } = req.body || {};
  const targetSeason = season || getCurrentSeason()?.season;
  if (isPlayoffStarted(targetSeason)) {
    return res.status(403).json({ error: 'Season locked — playoffs have started' });
  }
  if (player_id) deleteMvpWriteupForPlayer(player_id, season);
  else           clearMvpWriteupSeason(season);
  res.json({ ok: true });
});

app.get('/mvp', async (req, res) => {
  if (getSetting('mvp_race_enabled', '1') === '0') return res.status(404).send(
    renderPage(req, { title: 'Not Found', currentPath: '/mvp', body: '<div class="container"><p style="padding:40px;color:var(--text-muted)">Page not found.</p></div>' })
  );
  const currentSeason = getPortalCurrentSeason();
  const playoffsStarted = isPlayoffStarted(currentSeason);
  const raw = getMvpCandidates(currentSeason);
  const totalGames = getTotalSeasonGamesForMvp(currentSeason);

  const allGames   = byDate(getAllGames());
  const completedGames = allGames.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  // Team records from regular complete games — used in AI writeups so the W-L is the team's
  // actual record, not the individual player's personal participation record.
  const teamRecords = {};
  for (const g of completedGames.filter(g => g.game_type === 'regular')) {
    const a = g.team_a_id, b = g.team_b_id;
    if (!teamRecords[a]) teamRecords[a] = { w: 0, l: 0 };
    if (!teamRecords[b]) teamRecords[b] = { w: 0, l: 0 };
    if (Number(g.team_a_score) > Number(g.team_b_score)) { teamRecords[a].w++; teamRecords[b].l++; }
    else if (Number(g.team_b_score) > Number(g.team_a_score)) { teamRecords[b].w++; teamRecords[a].l++; }
  }

  const allQualified = raw
    .map(s => ({ player: s, stats: s, mvpScore: computeMvpScore(s) }))
    .filter(c => c.stats.gp >= 1);

  // Pre-compute per-game league ranks for key stats
  function leagueRank(arr, fn) {
    const sorted = [...arr].sort((a, b) => fn(b) - fn(a));
    return Object.fromEntries(sorted.map((c, i) => [c.player.id, i + 1]));
  }
  const rankPpg = leagueRank(allQualified, c => c.stats.pts / c.stats.gp);
  const rankRpg = leagueRank(allQualified, c => c.stats.reb / c.stats.gp);
  const rankApg = leagueRank(allQualified, c => c.stats.ast / c.stats.gp);
  const rankSpg = leagueRank(allQualified, c => c.stats.stl / c.stats.gp);
  const rankTs  = leagueRank(allQualified, c => {
    const d = 2 * (c.stats.fga + 0.44 * c.stats.fta);
    return d > 0 ? c.stats.pts / d : 0;
  });
  const total = allQualified.length;

  const scored = allQualified
    .sort((a, b) => b.mvpScore - a.mvpScore)
    .slice(0, 10);

  // Fetch or generate writeups for top candidates (locked once playoffs begin)
  const withWriteups = await Promise.all(scored.map(async c => {
    const statsKey = mvpStatsKey(c.stats);
    const cached   = getMvpWriteup(c.player.id, currentSeason, statsKey);
    if (cached) return { ...c, writeup: cached };
    if (playoffsStarted) return { ...c, writeup: null };

    try {
      const gp  = c.stats.gp;
      const ppg = (c.stats.pts / gp).toFixed(1);
      const rpg = (c.stats.reb / gp).toFixed(1);
      const apg = (c.stats.ast / gp).toFixed(1);
      const spg = (c.stats.stl / gp).toFixed(1);
      const tsDenom = 2 * (c.stats.fga + 0.44 * c.stats.fta);
      const ts  = tsDenom > 0 ? Math.round(c.stats.pts / tsDenom * 100) + '%' : '—';
      const fg  = c.stats.fga > 0 ? Math.round(c.stats.fgm / c.stats.fga * 100) + '%' : '—';
      const teamRec = teamRecords[c.stats.team_id] ?? { w: c.stats.wins, l: c.stats.losses };
      const wl  = `${teamRec.w}W-${teamRec.l}L`;
      const name = displayPlayerName(c.player.name);
      const pid  = c.player.id;

      const rankLines = [
        `PPG: ${ppg} (league rank #${rankPpg[pid]} of ${total})`,
        `RPG: ${rpg} (league rank #${rankRpg[pid]} of ${total})`,
        `APG: ${apg} (league rank #${rankApg[pid]} of ${total})`,
        `SPG: ${spg} (league rank #${rankSpg[pid]} of ${total})`,
        `TS%: ${ts} (league rank #${rankTs[pid]} of ${total})`,
        `FG%: ${fg}, Record: ${wl}, GP: ${gp}, MVP Score: ${c.mvpScore.toFixed(1)}`,
      ].join('\n');

      const prompt = `You are a sharp basketball analyst covering WKND Basketball League, a recreational league. Write a 2-3 sentence MVP case for ${name} (${String(c.stats.team_name).toUpperCase()}) in the style of an ESPN MVP ladder entry. Be specific with numbers. Focus solely on what makes THIS player a real MVP candidate — production, efficiency, winning.

Rules:
- Do NOT mention any other player by name or by comparison (no "unlike X", "while others", "leads over").
- Do NOT start with their name.
- Do NOT open with "With a" or "With an" — vary the sentence structure completely.
- Lead with the most interesting or unusual thing about this player's case.
- No filler phrases like "impressive", "stellar", "remarkable", or "dominant".
- ONLY make league-ranking claims (e.g. "leads the league in X", "top-3 in Y") if the rank data below supports it. Do not invent or assume rankings.

${name} stats:\n${rankLines}`;

      const { text } = await generateText(prompt, { maxTokens: 220, temperature: 0.75 });
      setMvpWriteup(c.player.id, currentSeason, statsKey, text);
      return { ...c, writeup: text };
    } catch {
      return { ...c, writeup: null };
    }
  }));

  res.send(renderPage(req, {
    title: playoffsStarted
      ? `Season ${currentSeason} MVP Race — Final — WKND Basketball League`
      : 'MVP Race — WKND Basketball League',
    currentPath: req.path,
    metaTags: buildMvpOgTags(req, withWriteups, currentSeason),
    body: mvpPage({
      candidates: withWriteups,
      season: currentSeason,
      totalGames,
      seasonGames: SEASON_GAMES_PER_TEAM,
      isAdmin: !!req.session?.isAdmin,
      playoffsStarted,
    }),
  }));
});

app.get('/leaders', (req, res) => {
  const players        = buildLeaderPlayers();
  const playoffPlayers = getPlayoffLeaders();
  const season         = getPortalCurrentSeason();
  const gameRecords    = getGameRecords();
  const weekNum        = season ? (getSeasonLatestWeek(season)?.week ?? null) : null;
  const asOfLabel      = weekNum ? `S${season} · WK ${weekNum}` : '';
  res.send(renderPage(req, {
    title: 'League Leaders — WKND Basketball League',
    currentPath: req.path,
    body: leadersPage({ players, playoffPlayers, season: String(season || ''), gameRecords, currentSeason: season || 3, asOfLabel, isLoggedIn: !!(req.session?.isAdmin || req.session?.playerRegId) })
  }));
});

app.get('/roast', (req, res) => {
  const players  = buildLeaderPlayers();
  const season   = getPortalCurrentSeason();
  const origin           = getRequestOrigin(req);
  const roastUrl         = `${origin}/roast`;
  const roastDesc        = `The flip side of the leaders board. Season ${season || ''} worst performers, funniest stat disasters, and dubious awards — only on WKND Basketball.`;
  const roastMetaTags    = [
    `<meta name="description" content="${escAttr(roastDesc)}">`,
    `<link rel="canonical" href="${escAttr(roastUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="The Roast — WKND Basketball League">`,
    `<meta property="og:description" content="${escAttr(roastDesc)}">`,
    `<meta property="og:url" content="${escAttr(roastUrl)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="The Roast — WKND Basketball League">`,
    `<meta name="twitter:description" content="${escAttr(roastDesc)}">`,
  ].join('\n  ');
  res.send(renderPage(req, {
    title: 'The Roast — WKND Basketball League',
    currentPath: req.path,
    metaTags: roastMetaTags,
    body: roastPage({ players, season: String(season || ''), isLoggedIn: !!(req.session?.isAdmin || req.session?.playerRegId) }),
  }));
});

app.get('/teams', (req, res) => {
  const teams   = getAllTeams();
  const records = getTeamRecords();
  const players = getPlayersWithRatings('');

  const recordMap    = Object.fromEntries(records.map(r => [r.team_id, r]));
  const teamIdByName = Object.fromEntries(teams.map(t => [t.name.toUpperCase(), t.id]));

  const playersByTeam = {};
  for (const p of players) {
    if (!p.team_name || p.status !== 'active') continue;
    const tid = teamIdByName[String(p.team_name).toUpperCase()];
    if (!tid) continue;
    if (!playersByTeam[tid]) playersByTeam[tid] = [];
    playersByTeam[tid].push(p);
  }

  const avgOf = (arr, fn) => arr.length ? Math.round(arr.reduce((s, p) => s + fn(p), 0) / arr.length) : null;

  const teamData = teams.map(t => {
    const plrs  = playersByTeam[t.id] || [];
    const rated = plrs.filter(p => p.eff_overall != null);
    const avgOvr = avgOf(rated, p => p.eff_overall);
    const avgOff = avgOf(rated, p => Math.round(((p.eff_scoring ?? 0) + (p.eff_shooting ?? 0)) / 2));
    const avgDef = avgOf(rated, p => p.eff_defense);
    const rec    = recordMap[t.id] ?? null;
    return { ...t, wins: rec?.wins ?? null, losses: rec?.losses ?? null, avgOvr, avgOff, avgDef, rosterCount: plrs.length };
  });

  res.send(renderPage(req, {
    title: 'Teams — WKND Basketball League',
    currentPath: req.path,
    body: teamsBody({ teams: teamData }),
  }));
});

app.get('/teams/:ref', (req, res) => {
  const resolved = resolveRef('team', req.params.ref,
    ref => getTeamById(ref),
    t   => teamSlug(t)
  );
  if (!resolved) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/teams',
    body: comingSoonPage({ label: 'Team Not Found', description: 'This team could not be found.' })
  }));
  if (resolved.slug) return res.redirect(302, `/teams/${resolved.slug}`);

  const team = getTeamById(resolved.id);
  res.send(renderPage(req, {
    title: `${String(team.name).toUpperCase()} — WKND Basketball`,
    currentPath: '/teams',
    metaTags: buildTeamOgTags(req, team),
    body: comingSoonPage({ label: team.name, description: 'Team rosters, stats, and season averages are on their way.' })
  }));
});

app.get('/players', (req, res) => {
  const players = getAllPlayers();
  res.send(renderPage(req, {
    title: 'Players — WKND Basketball League',
    currentPath: req.path,
    body: playersPage({ players, isAdmin: !!req.session?.isAdmin })
  }));
});

app.post('/admin/player/:id/edit', requireAuth, express.json(), (req, res) => {
  const { first_name, last_name, number, positions, status } = req.body;
  if (!first_name && !last_name) return res.status(400).json({ error: 'Name is required.' });
  updatePlayer(req.params.id, { first_name, last_name, number, positions, status });
  res.json({ ok: true });
});

app.get('/players/:ref', async (req, res) => {
  const resolved = resolveRef('player', req.params.ref,
    ref => getPlayerById(ref),
    p   => playerSlug(p)
  );
  if (!resolved) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/players',
    body: comingSoonPage({ label: 'Player Not Found', description: 'This player could not be found.' })
  }));
  if (resolved.slug) return res.redirect(302, `/players/${resolved.slug}`);

  const player      = getPlayerWithTeam(resolved.id);
  if (!player) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/players',
    body: comingSoonPage({ label: 'Player Not Found', description: 'This player could not be found.' })
  }));
  const totals      = getPlayerTotals(resolved.id);
  const statsByType = getPlayerStatsByType(resolved.id);
  const gameLogs    = getPlayerGameLog(resolved.id);
  const potgCandidates = getPlayerPotgCandidates(resolved.id);
  const potgGames = potgCandidates.filter(g => {
    if (g.manual_potg_player_id === resolved.id) return true;
    if (g.manual_potg_player_id) return false;
    return derivePotgPlayerId(g, getGameStats(g.id)) === resolved.id;
  });
  const careerHighs = getPlayerCareerHighs(resolved.id);
  const awards      = getPlayerAwards(resolved.id);
  const displayName = displayPlayerName(player.name);

  let financialSection = '';
  if (req.session?.isAdmin) {
    const fin = getPlayerFinancials(resolved.id);
    const txs = getPlayerTransactions(resolved.id);
    const allPlayers = getAllPlayers();
    const allPlayerOptions = allPlayers.map(p =>
      `<option value="${p.id}"${p.id === resolved.id ? ' selected' : ''}>${displayPlayerName(p.name)} — ${p.team_name || ''}</option>`
    ).join('');
    financialSection = playerFinancialSection(fin, txs, displayName, resolved.id, allPlayerOptions);
  }

  const isOwnProfile = !!req.session?.playerPlayerId && resolved.id === req.session.playerPlayerId;
  let balanceAmount = 0, balanceTransactions = [], papawisGames = [];
  let coachNote = null;
  let latestPoll = null;
  if (isOwnProfile) {
    balanceAmount = getPlayerFinancials(resolved.id)?.current_balance ?? 0;
    // Own-profile breakdown is intentionally the same read-only transaction list admin sees
    // (getPlayerTransactions) — no separate query, no separate source of truth to drift.
    balanceTransactions = balanceAmount > 0 ? getPlayerTransactions(resolved.id) : [];
    papawisGames  = getPapawisGamesForPlayer(resolved.id);
    coachNote     = await getOrGenerateCoachNote(resolved.id, player, totals, gameLogs);

    // getAllLeaguePolls() is already ORDER BY created_at DESC, so the first one this
    // viewer's visibility tier qualifies for is the latest appropriate one.
    const pollIdentity = currentPollVoterIdentity(req);
    const qualifyingPoll = pollIdentity ? getAllLeaguePolls().find(p => pollTierQualifies(p.visibility, pollIdentity)) : null;
    if (qualifyingPoll) {
      const votes = getLeaguePollVotes(qualifyingPoll.id);
      const myVote = getMyLeaguePollVote(qualifyingPoll.id, pollIdentity.id);
      latestPoll = { ...qualifyingPoll, votes, myVote, canVote: pollTierQualifies(qualifyingPoll.voter_eligibility, pollIdentity) };
    }
  }

  const peerSeason = getPortalCurrentSeason();
  const peerRatingRows = getFeatureFlags().peerRatings ? getPeerRatingsForRatee(peerSeason, resolved.id) : [];
  const peerRatingSummary = summarizePeerRatings(peerRatingRows);
  const viewerPlayerId = req.session?.playerPlayerId || null;
  const viewerPlayer = viewerPlayerId ? getPlayerById(viewerPlayerId) : null;
  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  const viewerExistingRating = viewerPlayerId ? getPeerRating(peerSeason, viewerPlayerId, resolved.id) : null;
  const viewerCooldownUntil = viewerExistingRating ? viewerExistingRating.updated_at + RATING_COOLDOWN_MS : 0;
  // Eligibility is just "both players are active" — the earlier season_signups-confirmed
  // check was too strict in practice (nobody gets marked confirmed until an admin processes
  // signups, which lags well behind when players actually want to use this).
  const canRate = !!viewerPlayerId && viewerPlayerId !== resolved.id
    && viewerPlayer?.status === 'active' && player.status === 'active';
  // Same eligibility shape as canRate — mirrors it deliberately rather than sharing the
  // variable, since these are two independent features that happen to have the same rule.
  const canReport = getFeatureFlags().playerReports && !!viewerPlayerId && viewerPlayerId !== resolved.id
    && viewerPlayer?.status === 'active' && player.status === 'active';
  const peerRatingsFeed = peerRatingRows.map(r => {
    const isAnon = !!r.is_anonymous;
    const raterPlayer = getPlayerById(r.rater_player_id);
    const raterName = isAnon
      ? (raterPlayer?.anon_alias || 'Anonymous')
      : displayPlayerName(raterPlayer?.name || 'Unknown');
    return {
      raterName,
      isAnonymous: isAnon,
      realName: isSuperAdmin && isAnon ? displayPlayerName(raterPlayer?.name || 'Unknown') : null,
      updatedAt: r.updated_at,
      scores: Object.fromEntries(RATING_CATEGORY_KEYS.map(k => [k, r[k]])),
    };
  });

  res.send(renderPage(req, {
    title: `${displayName} — WKND Basketball`,
    currentPath: '/players',
    isOwnProfile,
    metaTags: buildPlayerOgTags(req, player, totals),
    body: playerPage({
      player, totals, statsByType, gameLogs, potgGames, careerHighs, awards, financialSection,
      isAdmin: !!req.session?.isAdmin, isOwnProfile, balanceAmount, balanceTransactions, papawisGames, coachNote, latestPoll,
      minDeposit: isOwnProfile && player.papawis_probation ? getMaxPapawisPrice() : null,
      peerRatingsEnabled: getFeatureFlags().peerRatings,
      peerRatingSummary, peerRatingsFeed, canRate,
      viewerExistingRating, viewerCooldownActive: viewerCooldownUntil > Date.now(), viewerCooldownUntil,
      canReport, reportCategories: canReport ? getReportableFineCategories() : [],
      reportOtherCategoryId: canReport ? (getOtherFineCategory()?.id || '') : '',
    })
  }));
});

app.post('/players/:id/rate', express.json(), (req, res) => {
  if (!getFeatureFlags().peerRatings) return res.status(404).json({ error: 'Not found.' });
  const raterPlayerId = req.session?.playerPlayerId;
  if (!req.session?.playerRegId || !raterPlayerId) return res.status(401).json({ error: 'Log in to rate players.' });

  const rateePlayerId = req.params.id;
  const rateePlayer = getPlayerById(rateePlayerId);
  if (!rateePlayer) return res.status(404).json({ error: 'Player not found.' });
  if (rateePlayerId === raterPlayerId) return res.status(400).json({ error: "You can't rate yourself." });

  const raterPlayer = getPlayerById(raterPlayerId);
  if (raterPlayer?.status !== 'active' || rateePlayer.status !== 'active') {
    return res.status(403).json({ error: 'Both players need to be active to rate each other.' });
  }

  const season = getPortalCurrentSeason();

  const scores = {};
  for (const key of RATING_CATEGORY_KEYS) {
    const val = Number(req.body?.scores?.[key]);
    if (!Number.isInteger(val) || val < 1 || val > 5) return res.status(400).json({ error: `Invalid score for ${key}.` });
    scores[key] = val;
  }
  const isAnonymous = !!req.body?.isAnonymous;

  if (isAnonymous) getOrAssignPlayerAlias(raterPlayerId, () => pickPeerRatingAlias().alias);

  const result = upsertPeerRating({ season, raterPlayerId, rateePlayerId, scores, isAnonymous });
  if (result.error === 'cooldown') {
    return res.status(429).json({ error: 'You can update your rating for this player once a week.', retryAt: result.retryAt });
  }
  if (result.error) return res.status(400).json({ error: 'Could not save rating.' });

  const summary = summarizePeerRatings(getPeerRatingsForRatee(season, rateePlayerId));
  res.json({ ok: true, summary });
});

// Any logged-in player reporting another — distinct from the head-only /fines "Report
// Incident" flow (which skips straight to head-voting). A player-submitted report starts
// at 'pending_admin' and needs a majority admin escalation vote before any head ever sees
// it — see the admin escalation routes below and lib/portal-db.js's recomputeEscalation.
app.post('/players/:id/report', express.json(), (req, res) => {
  if (!getFeatureFlags().playerReports) return res.status(404).json({ error: 'Not found.' });
  const reporterPlayerId = req.session?.playerPlayerId;
  if (!req.session?.playerRegId || !reporterPlayerId) return res.status(401).json({ error: 'Log in to report a player.' });

  const targetPlayerId = req.params.id;
  const targetPlayer = getPlayerById(targetPlayerId);
  if (!targetPlayer) return res.status(404).json({ error: 'Player not found.' });
  if (targetPlayerId === reporterPlayerId) return res.status(400).json({ error: "You can't report yourself." });

  const reporterPlayer = getPlayerById(reporterPlayerId);
  if (reporterPlayer?.status !== 'active' || targetPlayer.status !== 'active') {
    return res.status(403).json({ error: 'Both players need to be active to file a report.' });
  }

  if (hasOpenPlayerReport(targetPlayerId, reporterPlayerId)) {
    return res.status(400).json({ error: 'You already have an open report against this player.' });
  }

  const { categoryId, description = '' } = req.body || {};
  if (!categoryId) return res.status(400).json({ error: 'Category is required.' });

  const reporterName = displayPlayerName(reporterPlayer?.name || '') || 'A player';
  const result = createFineCase({
    playerId: targetPlayerId, categoryId, description,
    reportedByType: 'player', reportedById: reporterPlayerId, reportedByName: reporterName,
    status: 'pending_admin',
  });
  if (result.error) return res.status(400).json({ error: 'Could not file the report.' });
  res.json({ ok: true, id: result.id });
});

// Fixed/cached per player — only calls the AI when the player's career totals have
// actually changed since the last generation. Falls back to serving the last good
// analysis (rather than nothing) if a fresh generation attempt fails.
async function getOrGenerateCoachNote(playerId, player, totals) {
  if (!totals?.games_played) return null;
  const snapshot = statSnapshotFromTotals(totals);
  const stored = getCoachAnalysis(playerId);
  if (stored && stored.stat_snapshot === snapshot) {
    return { analysis: stored.analysis, focus_tag: stored.focus_tag, generated_at: stored.generated_at };
  }
  try {
    const positions = (() => { try { return JSON.parse(player.positions || '[]'); } catch { return []; } })();
    const group = classifyPositionGroup(positions);
    const peerRows = getAllPlayerCareerTotals().filter(r => r.player_id !== playerId);
    const peerAverages = aggregatePeerAverages(peerRows, group);
    const recentGames = (getPlayerGameLog(playerId) || []).filter(g => g.status === 'played').slice(0, 4);
    const displayName = displayPlayerName(player.name);
    const result = await generateCoachAnalysis({
      displayName, positions, totals, peerAverages,
      groupLabel: group === 'perimeter' ? 'PG/SG/SF' : 'PF/C',
      recentGames,
    }, { primaryProvider: 'gemini' });
    saveCoachAnalysis({
      player_id: playerId, model: result.model || '', provider: result.provider || '',
      stat_snapshot: snapshot, analysis: result.analysis, focus_tag: result.focus_tag,
    });
    return { analysis: result.analysis, focus_tag: result.focus_tag, generated_at: Date.now() };
  } catch (err) {
    console.error('coach-analysis generation error:', err.message);
    // Serve the last good analysis rather than nothing if regeneration fails.
    return stored ? { analysis: stored.analysis, focus_tag: stored.focus_tag, generated_at: stored.generated_at } : null;
  }
}

app.get('/front-office', (req, res) => {
  res.send(renderPage(req, {
    title: 'The Front Office — WKND Basketball',
    currentPath: '/front-office',
    body: frontOfficePage(),
  }));
});

app.get('/privacy', (req, res) => {
  res.send(renderPage(req, {
    title: 'Privacy Policy — WKND Basketball',
    currentPath: '/privacy',
    body: privacyPage(),
  }));
});

app.get('/terms', (req, res) => {
  res.send(renderPage(req, {
    title: 'Terms of Service — WKND Basketball',
    currentPath: '/terms',
    body: termsPage(),
  }));
});

// ── Registration ──────────────────────────────────────────────────────────────
app.get('/register', (req, res) => {
  // Sidebar "hype" avatar pool — any active player with a real photo. The page
  // measures its own available width client-side and picks a random subset that
  // fits, so this can just be the full eligible list, not a pre-trimmed sample.
  const hypeAvatars = getAllPlayers()
    .filter(p => p.status !== 'inactive' && p.picture_url)
    .map(p => ({ id: p.id, name: p.name, color: teamColor(p.team_name) }));
  res.send(renderPage(req, {
    title: 'Join WKND Basketball',
    currentPath: '/register',
    minimalHeader: true,
    body: registerPage({ hypeAvatars, ref: req.query.ref }),
  }));
});

app.post('/register', (req, res) => {
  const { first_name, last_name, email, phone, birthday, positions, height, weight,
          jersey_pref, dominant_hand, experience, referred_by,
          emergency_name, emergency_phone, motto, gender, social_handle, agree,
          waiver_agree, waiver_signature, ref } = req.body;

  const prefill = { first_name, last_name, email, phone, birthday, height, weight,
                    jersey_pref, dominant_hand, experience, referred_by,
                    emergency_name, emergency_phone, motto, gender, social_handle,
                    waiver_signature, ref };

  // Same pool the initial GET renders — needed again here since every error
  // branch below re-renders the full page (sidebar included), not just a redirect.
  const hypeAvatars = getAllPlayers()
    .filter(p => p.status !== 'inactive' && p.picture_url)
    .map(p => ({ id: p.id, name: p.name, color: teamColor(p.team_name) }));

  // Validate required fields
  if (!first_name?.trim() || !last_name?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'We need your name, bestie. Both of them.', prefill, hypeAvatars }) }));
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'That email is giving nothing. Drop a real one.', prefill, hypeAvatars }) }));
  }
  if (!phone?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'No digits, no ball. Drop your phone number.', prefill, hypeAvatars }) }));
  }
  if (!birthday?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'We need your birthday. The real one, not your alter ego\'s.', prefill, hypeAvatars }) }));
  }
  const _dob   = new Date(birthday);
  const _age18 = new Date(_dob.getFullYear() + 18, _dob.getMonth(), _dob.getDate());
  if (new Date() < _age18) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Bestie, you\'re not 18 yet. The league will still be here when you\'re legal.', prefill, hypeAvatars }) }));
  }
  const posArr = Array.isArray(positions) ? positions : (positions ? [positions] : []);
  if (posArr.length === 0) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Pick a position, sis. You can\'t just vibe on the sideline.', prefill, hypeAvatars }) }));
  }
  if (!height?.toString().trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Height? Be honest. The court doesn\'t care about your feelings.', prefill, hypeAvatars }) }));
  }
  if (!weight?.toString().trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'We need your weight. This is a safe space, babe.', prefill, hypeAvatars }) }));
  }
  if (!dominant_hand?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Which hand runs the show? We need to know.', prefill, hypeAvatars }) }));
  }
  if (!agree) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'You gotta swear on your crossover first, babe.', prefill, hypeAvatars }) }));
  }
  if (!waiver_agree) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Read the fine print and check the waiver box, bestie — non-negotiable.', prefill, hypeAvatars }) }));
  }
  if (!waiver_signature?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'Type your full legal name as your signature on the waiver.', prefill, hypeAvatars }) }));
  }

  // Check for duplicate email
  const existing = getRegistrationByEmail(email.trim().toLowerCase());
  if (existing) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register', minimalHeader: true,
      body: registerPage({ error: 'That email\'s already in the chat. Are you trying to have two accounts, sis?', prefill, hypeAvatars }) }));
  }

  const full_name = `${last_name.trim().toUpperCase()}, ${first_name.trim()}`;
  const regId = crypto.randomUUID();

  insertRegistration({
    id: regId,
    full_name,
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    birthday: birthday.trim(),
    positions: JSON.stringify(posArr),
    height: (height || '').trim(),
    weight: (weight || '').trim(),
    jersey_pref: (jersey_pref || '').trim(),
    dominant_hand: dominant_hand || '',
    experience: experience || '',
    referred_by: (referred_by || '').trim(),
    emergency_name: (emergency_name || '').trim(),
    emergency_phone: (emergency_phone || '').trim(),
    motto: (motto || '').trim(),
    gender: (gender || '').trim(),
    social_handle: (social_handle || '').trim(),
  });
  setWaiverAgreement(regId, waiver_signature.trim());

  // Not tied to any specific game — the shared papawis page lists every game rather
  // than linking to one, so this is a global (game_id: '') activity entry.
  if (ref === 'papawis') {
    logPapawisActivity({ gameId: '', eventType: 'registered', playerId: regId, playerName: full_name, notes: 'via papawis link' });
  }

  res.send(layout({ title: 'Registration Received', currentPath: '/register', minimalHeader: true,
    body: registerPage({ success: true, hypeAvatars }) }));
});

// ── Season Signup (member-facing) ─────────────────────────────────────────────
import { seasonSignupPage } from './views/season-signup.js';
import { SIZES as JERSEY_SIZES, computeJerseyTotal } from './lib/season-pricing.js';

// Capacity bar shown on the public signup form — still driven by real confirmed-signup
// counts, just padded so it reads as "filling up" from the start instead of looking dead
// at low fill. Floors the display at 55% and compresses the real 0-100 range into the
// remaining 45 points, so it's still monotonic with actual signups and genuinely hits
// 100% only once the season is actually full.
const CAPACITY_BAR_FLOOR = 55;
function padCapacityPct(rawPct) {
  if (rawPct === null) return null;
  return Math.round(CAPACITY_BAR_FLOOR + (rawPct / 100) * (100 - CAPACITY_BAR_FLOOR));
}

// Returning-player team poll: only shown if they actually played the prior season and
// still have a team on record.
function getReturningTeamInfo(reg, sigSeason) {
  const prevSeason = Number(sigSeason) - 1;
  if (!reg.player_id || !prevSeason || !playerPlayedSeason(reg.player_id, prevSeason)) return null;
  const team = getPlayerCurrentTeam(reg.player_id);
  return team ? { prevSeason, team } : null;
}

app.get('/season-signup', (req, res) => {
  const regId = req.session?.playerRegId;
  if (!regId) return res.redirect(loginUrl(req));

  const reg = getRegistration(regId);
  if (!reg || reg.status !== 'approved') {
    return res.send(renderPage(req, {
      title: 'Season Signup — WKND Basketball',
      currentPath: '/season-signup',
      body: seasonSignupPage({ state: 'not-approved' }),
    }));
  }

  const sigSeason        = getSetting('signup_target_season', '');
  const sigOpen          = getSetting('season_signup_open', '0') === '1';
  const deadline         = getSetting('season_signup_deadline', '');
  const seasonFormat     = getSetting('season_format', '');
  const quotaAmount      = getSetting('season_quota_amount', '');
  const capacity         = Number(getSetting('season_roster_capacity', '0')) || 0;
  const capacityPct      = (capacity && sigSeason) ? padCapacityPct(Math.min(100, Math.round(countConfirmedSeasonSignups(sigSeason) / capacity * 100))) : null;
  const existing         = sigSeason ? getSeasonSignup(regId, sigSeason) : null;
  const returning        = sigSeason ? getReturningTeamInfo(reg, sigSeason) : null;
  const existingLivenessCapture = getLivenessCaptureByRegId(regId);
  // Re-rolled on every page load (not once per session) — session-held so the capture POST
  // below can trust it without the client ever having to send the prompt text itself.
  req.session.livenessPrompt = randomLivenessPrompt();

  res.send(renderPage(req, {
    title: 'Season Signup — WKND Basketball',
    currentPath: '/season-signup',
    minimalHeader: true,
    body: seasonSignupPage({
      state: 'form', sigSeason, sigOpen, deadline, existing, reg, name: reg.full_name,
      seasonFormat, quotaAmount, capacityPct, returning, existingLivenessCapture,
      livenessPrompt: req.session.livenessPrompt,
    }),
  }));
});

app.post('/season-signup', express.urlencoded({ extended: false }), (req, res) => {
  const regId = req.session?.playerRegId;
  if (!regId) return res.redirect(loginUrl(req));

  const reg = getRegistration(regId);
  if (!reg || reg.status !== 'approved') return res.redirect('/season-signup');

  const sigSeason = getSetting('signup_target_season', '');
  const sigOpen   = getSetting('season_signup_open', '0') === '1';
  if (!sigSeason || !sigOpen) return res.redirect('/season-signup');

  const existingSignup = getSeasonSignup(regId, sigSeason);
  if (existingSignup) return res.redirect('/season-signup');

  const deadline         = getSetting('season_signup_deadline', '');
  const seasonFormat     = getSetting('season_format', '');
  const quotaAmount      = getSetting('season_quota_amount', '');
  const capacity         = Number(getSetting('season_roster_capacity', '0')) || 0;
  const capacityPct      = capacity ? padCapacityPct(Math.min(100, Math.round(countConfirmedSeasonSignups(sigSeason) / capacity * 100))) : null;
  const returning        = getReturningTeamInfo(reg, sigSeason);

  const rerender = (error) => res.send(renderPage(req, {
    title: 'Season Signup — WKND Basketball',
    currentPath: '/season-signup',
    minimalHeader: true,
    body: seasonSignupPage({
      state: 'form', sigSeason, sigOpen: true, deadline, reg, name: reg.full_name,
      seasonFormat, quotaAmount, capacityPct, returning, error, prefill: req.body,
      existingLivenessCapture: getLivenessCaptureByRegId(regId),
    }),
  }));

  const jerseyTop     = (req.body.jersey_top     || '').trim();
  const jerseyShorts  = (req.body.jersey_shorts  || '').trim();
  const pockets       = req.body.pockets === '1' ? 1 : 0;
  const quotaAck      = req.body.quota_ack === '1' ? 1 : 0;
  const paymentPlan   = (req.body.payment_plan   || '').trim();
  const reshuffleVote = (req.body.reshuffle_vote || '').trim();
  const comments        = (req.body.comments        || '').trim();
  const emergencyName   = (req.body.emergency_name   || '').trim();
  const emergencyPhone  = (req.body.emergency_phone  || '').trim();
  const birthday         = (req.body.birthday         || '').trim();
  const teamPref       = (req.body.team_pref     || '').trim();
  const waiverAgree     = req.body.waiver_agree === 'on' || req.body.waiver_agree === '1';
  const waiverSignature = (req.body.waiver_signature || '').trim();
  // Group 00 is now required (see the getLivenessCaptureByRegId gate below) — the capture
  // itself already saved via /season-signup/liveness-capture well before this final submit.
  // liveness_skip is no longer offered in the UI; this stays only to keep displaying the
  // "Skipped" badge on pre-existing rows from before the step became mandatory.
  const livenessSkipped = req.body.liveness_skip === 'on' || req.body.liveness_skip === '1';

  const q1WhyPlaying     = (req.body.q1_why_playing     || '').trim();
  const q2LosingBadly    = (req.body.q2_losing_badly    || '').trim();
  const q3BadRefCall     = (req.body.q3_bad_ref_call     || '').trim();
  const q4HeatedTeammate = (req.body.q4_heated_teammate || '').trim();
  const q5FeedbackStyle  = (req.body.q5_feedback_style  || '').trim();
  const q6BenchedComfort = (req.body.q6_benched_comfort || '').trim();
  const q7WorkOn         = (req.body.q7_work_on         || '').trim();
  const q8DisagreementStyle    = (req.body.q8_disagreement_style    || '').trim();
  const q9ReactionToCriticism  = (req.body.q9_reaction_to_criticism || '').trim();
  const selfScoring      = (req.body.self_scoring       || '').trim();
  const selfDefense      = (req.body.self_defense       || '').trim();
  const selfOverall      = (req.body.self_overall       || '').trim();

  if (!getLivenessCaptureByRegId(regId)) return rerender('Take a liveness photo (camera or phone) before continuing.');

  if (!JERSEY_SIZES.includes(jerseyTop)) return rerender('Pick a jersey top size.');
  if (jerseyShorts && !JERSEY_SIZES.includes(jerseyShorts)) return rerender('Pick a valid shorts size.');

  if (q1WhyPlaying.length < 10) return rerender('Tell us a bit more about why you\'re playing this season.');
  if (!['stay_engaged', 'go_quiet', 'frustrated_vocal', 'take_over'].includes(q2LosingBadly)) return rerender('Answer how you handle the team losing badly.');
  if (!['let_it_go', 'voice_briefly', 'argue_it', 'carry_into_plays'].includes(q3BadRefCall)) return rerender('Answer how you react to a bad ref call.');
  if (!['1','2','3','4','5'].includes(q4HeatedTeammate)) return rerender('Rate how you handle a heated moment with a teammate.');
  if (!['raise_with_group', 'private_after', 'vent_no_address', 'put_in_writing', 'sit_on_it'].includes(q8DisagreementStyle)) return rerender('Answer how you handle disagreeing with a team decision.');
  if (!['direct', 'private', 'written'].includes(q5FeedbackStyle)) return rerender('Answer how you prefer to receive feedback.');
  if (!['welcome_specifics', 'listen_disagree', 'defensive_argue', 'brush_off'].includes(q9ReactionToCriticism)) return rerender('Answer how you\'d react to being told a part of your game needs work.');
  if (!['1','2','3','4','5'].includes(q6BenchedComfort)) return rerender('Rate your comfort being benched.');
  if (q7WorkOn.length < 10) return rerender('Tell us a bit more about what a past teammate would say you need to work on.');
  if (!['below_average','average','above_average','best'].includes(selfScoring)) return rerender('Rate your scoring/shooting vs. the league.');
  if (!['below_average','average','above_average','best'].includes(selfDefense)) return rerender('Rate your defense vs. the league.');
  if (!['below_average','average','above_average','best'].includes(selfOverall)) return rerender('Rate your overall game vs. the league.');

  // Returning players get asked whether to stick with their team or reshuffle — required
  // when applicable, recomputed server-side rather than trusting a hidden form field.
  if (returning && !['stick', 'reshuffle'].includes(teamPref)) {
    return rerender("Let us know: stick with your team or open to a shuffle?");
  }

  if (!['yes', 'no'].includes(reshuffleVote)) return rerender('Vote yes or no on the league shuffle.');
  if (!quotaAck) return rerender('You need to acknowledge the season fee.');
  if (!['full', 'installment'].includes(paymentPlan)) return rerender('Pick a payment plan.');

  // Registrants with no waiver on file yet (predates /register's waiver step) get the
  // full text + a typed signature here instead of the lightweight reconfirm-only
  // checkbox — see hasWaiverOnFile in views/season-signup.js.
  if (!waiverAgree) return rerender('Read the fine print and check the waiver box before continuing.');
  if (!reg.waiver_agreed_at && !waiverSignature) return rerender('Type your full legal name as your signature on the waiver.');

  if (!emergencyName) return rerender('Emergency contact name is required.');
  const emergencyPhoneDigits = emergencyPhone.replace(/[\s-]/g, '');
  if (!/^(?:\+63|0)9\d{9}$/.test(emergencyPhoneDigits)) return rerender('Enter a valid PH mobile number for your emergency contact.');
  if (emergencyPhoneDigits === (reg.phone || '').replace(/[\s-]/g, '')) return rerender("Emergency contact number can't be your own number.");
  if (!birthday) return rerender('Birthday is required.');
  {
    const dob = new Date(birthday);
    const age18 = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
    if (Number.isNaN(dob.getTime()) || new Date() < age18) return rerender('You must be 18+ to sign up.');
  }

  // Flag (don't block) if the resubmitted contact details differ from what's on file.
  const changes = [];
  if (reg.emergency_name  && reg.emergency_name  !== emergencyName)  changes.push(`Emergency name: "${reg.emergency_name}" -> "${emergencyName}"`);
  if (reg.emergency_phone && reg.emergency_phone !== emergencyPhone) changes.push(`Emergency phone: "${reg.emergency_phone}" -> "${emergencyPhone}"`);
  if (reg.birthday        && reg.birthday        !== birthday)       changes.push(`Birthday: "${reg.birthday}" -> "${birthday}"`);

  updateRegistrationContact(regId, { emergency_name: emergencyName, emergency_phone: emergencyPhone });
  updateRegBirthday(regId, birthday, reg.player_id || null);

  // Legacy registrant (no waiver on file) — this submission's checkbox + typed name IS
  // their first real agreement, not just a reconfirmation. Someone who already had one
  // just reconfirms it; setWaiverAgreement is never called again for them.
  if (!reg.waiver_agreed_at) setWaiverAgreement(regId, waiverSignature);

  let hasBalance = false, balanceAmt = 0;
  if (reg.player_id) {
    const fin = getPlayerFinancials(reg.player_id);
    if ((fin?.current_balance ?? 0) > 0) {
      hasBalance = true;
      balanceAmt = fin.current_balance;
    }
  }

  insertSeasonSignup(regId, sigSeason, hasBalance, balanceAmt, jerseyTop, jerseyShorts, quotaAck, returning ? teamPref : '', {
    pockets, reshuffleVote, paymentPlan, comments,
    contactChangedAt: changes.length ? Date.now() : 0,
    contactChangeNote: changes.join('; '),
    waiverReconfirmedAt: Date.now(),
    livenessSkippedAt: livenessSkipped ? Date.now() : 0,
  });
  insertPlayerAssessment(reg.player_id || '', regId, sigSeason, {
    q1WhyPlaying, q2LosingBadly, q3BadRefCall, q4HeatedTeammate, q5FeedbackStyle,
    q6BenchedComfort, q7WorkOn, q8DisagreementStyle, q9ReactionToCriticism,
    selfScoring, selfDefense, selfOverall,
  });
  const created = getSeasonSignup(regId, sigSeason);

  res.send(renderPage(req, {
    title: 'Season Signup — WKND Basketball',
    currentPath: '/season-signup',
    minimalHeader: true,
    body: seasonSignupPage({ sigSeason, deadline, existing: created, reg, name: reg.full_name, hasBalance, balanceAmt, seasonFormat, quotaAmount, capacityPct }),
  }));
});

// ── Season Signup Group 00 — Liveness Check ─────────────────────────────────────
// Admin-reference-only photo, not identity verification (no matching, no pass/fail — see
// liveness_captures' comment in lib/portal-db.js). Two capture paths: inline on the same
// device (this route), or via a QR code scanned by a phone when the desktop browser has no
// webcam (the token/WebSocket routes further down). Either way the capture itself saves
// immediately, independent of the main multi-step form's own POST — Group 00 never blocks
// final submission either way (see livenessSkipped in POST /season-signup above).
import { livenessMobilePage } from './views/liveness-mobile.js';

// Purely decorative — makes the capture moment less awkward, never validated against what's
// actually in the photo (see liveness_captures.prompt in lib/portal-db.js). Scoped to things
// that are basically always already on/near a person at home — no kitchen trips, no specific
// ownership required — so it's genuinely doable regardless of what someone's house has in it.
const LIVENESS_PROMPTS = [
  'Grab your tsinelas and hold it up — the universal Filipino weapon',
  'Hold up your barya — pamasahe money, no excuses',
  "Grab the TV remote and guard it like it's the last two minutes of the game",
  'Hold up a plastic tingi bag from that one drawer every house has',
  "Show us your GCash balance... or don't, we don't want any drama",
  'Grab your phone charger — nobody knows whose it actually is',
  'Hold up a random receipt from your wallet or pocket',
  'Grab any rubber band, hair tie, or twistie within reach',
  "Hold up whatever's currently in your pocket — no peeking beforehand",
];
function randomLivenessPrompt() {
  return LIVENESS_PROMPTS[Math.floor(Math.random() * LIVENESS_PROMPTS.length)];
}

function resolveSeasonSignupContext(req) {
  const regId = req.session?.playerRegId;
  if (!regId) return null;
  const reg = getRegistration(regId);
  if (!reg || reg.status !== 'approved') return null;
  const sigSeason = getSetting('signup_target_season', '');
  const sigOpen = getSetting('season_signup_open', '0') === '1';
  if (!sigSeason || !sigOpen) return null;
  return { regId, reg, sigSeason };
}

app.post('/season-signup/liveness-capture', express.json({ limit: '8mb' }), (req, res) => {
  const ctx = resolveSeasonSignupContext(req);
  if (!ctx) return res.status(401).json({ error: 'Not eligible to sign up right now.' });
  const dataUrl = String(req.body?.dataUrl || '');
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(dataUrl)) return res.status(400).json({ error: 'Invalid image.' });
  upsertLivenessCapture({ regId: ctx.regId, playerId: ctx.reg.player_id || '', season: ctx.sigSeason, photoData: dataUrl, via: 'inline', prompt: req.session.livenessPrompt || '' });
  res.json({ ok: true });
});

// In-memory only — short-lived, single-use, never needs to survive a restart. token ->
// { regId, playerId, season, expiresAt, consumed }. Pruned opportunistically on issue
// rather than a dedicated interval, since traffic through this is inherently low (one
// token per desktop user without a webcam, once per signup).
const livenessTokens = new Map();
const LIVENESS_TOKEN_TTL_MS = 10 * 60 * 1000;
function pruneLivenessTokens() {
  const now = Date.now();
  for (const [token, info] of livenessTokens) if (info.expiresAt < now) livenessTokens.delete(token);
}

app.post('/season-signup/liveness-token', async (req, res) => {
  const ctx = resolveSeasonSignupContext(req);
  if (!ctx) return res.status(401).json({ error: 'Not eligible to sign up right now.' });
  pruneLivenessTokens();
  const token = randomBytes(16).toString('hex');
  // Reuse the prompt already shown on the desktop page (session-scoped, set once at GET
  // /season-signup) rather than drawing a fresh random one — this used to call
  // randomLivenessPrompt() again here, so the phone would almost always ask for something
  // different from what the user just read on the desktop screen. Stored on the token
  // (not re-read from session on GET) so a slow-connection reload of the mobile page still
  // shows the same prompt instead of re-rolling mid-attempt.
  const prompt = req.session.livenessPrompt || randomLivenessPrompt();
  livenessTokens.set(token, { regId: ctx.regId, playerId: ctx.reg.player_id || '', season: ctx.sigSeason, expiresAt: Date.now() + LIVENESS_TOKEN_TTL_MS, consumed: false, prompt });
  const url = `${getRequestOrigin(req)}/season-signup/liveness/${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
  res.json({ ok: true, token, url, qrDataUrl });
});

app.get('/season-signup/liveness/:token', (req, res) => {
  pruneLivenessTokens();
  const info = livenessTokens.get(req.params.token);
  const expired = !info || info.consumed || info.expiresAt < Date.now();
  res.type('html').send(livenessMobilePage({ token: req.params.token, expired, prompt: info?.prompt || '' }));
});

app.post('/season-signup/liveness/:token/capture', express.json({ limit: '8mb' }), (req, res) => {
  pruneLivenessTokens();
  const token = req.params.token;
  const info = livenessTokens.get(token);
  if (!info || info.consumed || info.expiresAt < Date.now()) return res.status(410).json({ error: 'This link has expired.' });
  const dataUrl = String(req.body?.dataUrl || '');
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(dataUrl)) return res.status(400).json({ error: 'Invalid image.' });
  info.consumed = true;
  upsertLivenessCapture({ regId: info.regId, playerId: info.playerId, season: info.season, photoData: dataUrl, via: 'qr', prompt: info.prompt || '' });
  broadcastLivenessCaptured(token);
  res.json({ ok: true });
});

// ── Settle Balance (member-facing) ─────────────────────────────────────────────
import { settleBalancePage } from './views/settle-balance.js';

app.get('/settle-balance', (req, res) => {
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) return res.redirect(loginUrl(req));
  const fin = getPlayerFinancials(req.session.playerPlayerId);
  // Only trust an exact PAYMENT_CATEGORIES match — anything else falls through to the
  // plain "— select —" default rather than silently pre-selecting nothing useful.
  const presetCategory = PAYMENT_CATEGORIES.includes(req.query.category) ? req.query.category : '';
  // Deposit deep-link (see the probation notice / balance bar) arrives with no balance to
  // fall back on — probationary players usually owe nothing yet — so default the amount to
  // the current papawis deposit floor instead of leaving it blank.
  const presetAmount = presetCategory === 'Papawis Deposit' && !(fin?.current_balance > 0)
    ? getMaxPapawisPrice()
    : null;
  res.send(renderPage(req, {
    title: 'Settle Balance — WKND Basketball',
    currentPath: '/settle-balance',
    body: settleBalancePage({
      balance: fin?.current_balance ?? 0,
      gcashName: getSetting('gcash_name', ''),
      gcashNumber: getSetting('gcash_number', ''),
      hasQr: !!getSetting('gcash_qr_payload', ''),
      activeSeason: getPortalCurrentSeason(),
      success: req.query.submitted === '1',
      presetCategory,
      presetAmount,
      minDeposit: getMaxPapawisPrice(),
    }),
  }));
});

app.post('/settle-balance', express.json({ limit: '20mb' }), async (req, res) => {
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) return res.status(401).json({ error: 'Please log in.' });
  const { amount, category, payment_method, reference_no = '', screenshot } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
  if (!category?.trim()) return res.status(400).json({ error: "Select what this payment is for." });
  if (!payment_method?.trim()) return res.status(400).json({ error: 'Select a mode of payment.' });
  const screenshotBuf = parseDataUrl(screenshot);
  if (!screenshotBuf) return res.status(400).json({ error: 'Attach a screenshot of the payment.' });

  const playerId = req.session.playerPlayerId;
  const player = getPlayerById(playerId);
  const displayName = displayPlayerName(player?.name || '');
  const categoryTrimmed = category.trim();
  // "Season Fee" is the one category tied to a specific season — auto-tag it with
  // whatever season is currently active rather than asking the player to know/pick it.
  const season = categoryTrimmed === 'Season Fee' ? getPortalCurrentSeason() : '';

  let screenshotDataUrl = '';
  try {
    screenshotDataUrl = await compressSourceImage(screenshotBuf);
  } catch (err) {
    console.error('settle-balance screenshot compress error:', err);
    return res.status(400).json({ error: 'Could not process that screenshot — try a different image.' });
  }

  const txId = randomBytes(6).toString('hex');
  const today = manilaTodayStr();
  recordTransaction({
    id: txId, player_id: playerId, amount: amt, type: 'payment',
    payment_method: payment_method.trim(), date: today, status: 'pending',
    notes: '', reference_no: reference_no.trim(), season, category: categoryTrimmed,
    screenshot_url: screenshotDataUrl,
  });

  const origin = getRequestOrigin(req);
  sendMail({
    to: 'paolo.ty@gmail.com',
    attachments: [{ filename: 'payment-screenshot.jpg', content: screenshotDataUrl.split(',')[1] }],
    ...paymentSubmittedEmail({
      playerName: displayName, amount: amt, paymentMethod: payment_method.trim(),
      category: categoryTrimmed, referenceNo: reference_no.trim(), hasScreenshot: true,
      adminUrl: `${origin}/admin/ledger/${encodeURIComponent(playerId)}`,
    }),
  }).catch(err => console.error('settle-balance email error:', err));

  res.json({ ok: true });
});

// ── Admin: Season Management ───────────────────────────────────────────────────
import { adminSeasonsBody }    from './views/admin/seasons.js';
import { adminSeasonBody }     from './views/admin/season.js';
import { adminWaitlistBody }   from './views/admin/season-waitlist.js';
import { adminSignupDetailBody } from './views/admin/season-signup-detail.js';
import { adminReturningBody }  from './views/admin/season-returning.js';
import { adminCommentsBody }   from './views/admin/season-comments.js';
import { adminAssessmentReviewsListBody } from './views/admin/season-assessment-reviews.js';
import { adminAssessmentReviewBody } from './views/admin/assessment-review.js';
import { adminLivenessReviewBody } from './views/admin/liveness-review.js';
import { adminLivenessListBody } from './views/admin/liveness-list.js';
import { adminSeasonTeamsBody } from './views/admin/season-teams.js';
import { adminSeasonTeamsPreviewBody } from './views/admin/season-teams-preview.js';

app.get('/admin/seasons', requireAuth, (req, res) => {
  const gameCounts   = getGameCountsBySeason();
  const signupStats  = getSignupStatsBySeason();
  const quotas       = getAllSeasonQuotas();
  const currentSeason = getSetting('portal_season', '') || getSetting('auto_season', '');
  const signupSeason  = getSetting('signup_target_season', '');
  const signupOpen    = getSetting('season_signup_open', '0') === '1';

  // Merge all data by season
  const signupMap = Object.fromEntries(signupStats.map(s => [String(s.season), s]));
  const quotaMap  = Object.fromEntries(quotas.map(q => [String(q.season), q.amount]));

  // Union of all seasons across game counts and signups
  const allSeasons = [...new Set([
    ...gameCounts.map(g => String(g.season)),
    ...signupStats.map(s => String(s.season)),
  ])].sort((a, b) => Number(b) - Number(a));

  const rows = allSeasons.map(season => {
    const gc = gameCounts.find(g => String(g.season) === season) || {};
    const ss = signupMap[season] || {};
    return {
      season,
      regular_games:    gc.regular_games   ?? 0,
      playoff_games:    gc.playoff_games   ?? 0,
      scheduled_games:  gc.scheduled_games ?? 0,
      quota_amount:     quotaMap[season]   ?? null,
      signup_total:     ss.total           ?? 0,
      signup_confirmed: ss.confirmed       ?? 0,
      signup_waitlisted: ss.waitlisted     ?? 0,
      signup_rejected:  ss.rejected        ?? 0,
    };
  });

  res.send(renderAdminPage(req, {
    title: 'Seasons',
    currentPath: '/admin/seasons',
    body: adminSeasonsBody({ rows, currentSeason, signupSeason, signupOpen }),
  }));
});

app.get('/admin/season', requireAuth, (req, res) => {
  const sigSeason        = getSetting('signup_target_season', '');
  const sigOpen          = getSetting('season_signup_open', '0') === '1';
  const deadline         = getSetting('season_signup_deadline', '');
  const portalSeason     = getSetting('portal_season', '');
  const autoSeason       = getCurrentSeason()?.season ?? 3;
  const signups          = sigSeason ? getSeasonSignups(sigSeason) : [];
  const count            = signups.filter(s => s.status !== 'rejected').length;
  const confirmedCount   = signups.filter(s => s.status === 'confirmed').length;
  const seasonFormat     = getSetting('season_format', '');
  const quotaAmount      = getSetting('season_quota_amount', '');
  const jerseyTopPrice   = getSetting('jersey_top_price', '');
  const jerseyShortPrice = getSetting('jersey_short_price', '');
  const teamCount        = getSetting('season_team_count', '4');
  const jerseySurchargeStep  = getSetting('jersey_surcharge_step', '50');
  const jerseyPocketsPrice   = getSetting('jersey_pockets_price', '100');
  const seasonRosterCapacity = getSetting('season_roster_capacity', '');
  const allSeasons       = getGameCountsBySeason().map(g => String(g.season));

  res.send(renderAdminPage(req, {
    title: 'Season Management',
    currentPath: '/admin/season',
    body: adminSeasonBody({ sigSeason, sigOpen, deadline, portalSeason, autoSeason, count, confirmedCount, seasonFormat, quotaAmount, jerseyTopPrice, jerseyShortPrice, teamCount, jerseySurchargeStep, jerseyPocketsPrice, seasonRosterCapacity, allSeasons }),
  }));
});

// Shared by the waitlist list and the per-signup detail page — assessment/alignment/
// liveness are looked up in JS rather than joined into stmtGetSeasonSignups since they're
// small per-page lookups, not something that needs to scale past one season.
function enrichSignup(s, sigSeason) {
  s.assessment = s.player_id ? getPlayerAssessment(s.player_id, sigSeason) : null;
  // "Overall game vs. the league" is the same headline comparison the assessment detail
  // page leads with (adminAssessmentReviewBody's sectionB) — good enough as the one
  // glance-level signal for the list; admin still clicks through for the full scoring/
  // defense/overall breakdown. Not computed at all when there's no assessment to compare.
  s.alignmentFlag = s.assessment && s.player_id
    ? alignmentFlag(s.assessment.self_overall, getLatestPlayerRating(s.player_id)?.overall ?? null)
    : null;
  s.reviewSummary = s.assessment ? summarizeReviews(getAssessmentReviews(s.assessment.id)) : null;
  s.liveness = getLivenessCaptureByRegId(s.reg_id);
  return s;
}

// A logged-in player-admin (their own account, own registration) is attributed by name; the
// shared super-admin login has no per-person identity at all, so every review left through it
// collapses onto one fixed 'super' reviewer — a second admin using that login overwrites the
// first's review rather than creating a phantom duplicate.
function reviewerIdentity(req) {
  if (req.session?.isElevatedPlayer && req.session?.playerRegId) {
    return { reviewer_reg_id: req.session.playerRegId, reviewer_name: req.session.playerName || 'Admin' };
  }
  return { reviewer_reg_id: 'super', reviewer_name: 'Admin' };
}

app.get('/admin/season/waitlist', requireAuth, (req, res) => {
  const sigSeason = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const signups        = getSeasonSignups(sigSeason);
  const count          = signups.filter(s => s.status !== 'rejected').length;
  const confirmedCount = signups.filter(s => s.status === 'confirmed').length;
  for (const s of signups) enrichSignup(s, sigSeason);

  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  res.send(renderAdminPage(req, {
    title: 'Waitlist',
    currentPath: '/admin/season/waitlist',
    body: adminWaitlistBody({ sigSeason, signups, count, confirmedCount, isSuperAdmin }),
  }));
});

// Cross-references last season's actual roster (from game participation, the most reliable
// "who was really playing" signal) against this season's signups so an admin doing outreach
// can see at a glance who from last time hasn't re-registered yet. player_id is only present
// on a signup when the registrant is linked to an existing player account, which is exactly
// how a returning player's signup connects back to their prior-season row here.
app.get('/admin/season/returning', requireAuth, (req, res) => {
  const sigSeason  = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const prevSeason = getCurrentSeason()?.season ?? null;
  const prevPlayers = prevSeason ? getSeasonPlayerStats(prevSeason) : [];

  const signupByPlayerId = new Map();
  for (const s of getSeasonSignups(sigSeason)) {
    if (s.player_id) signupByPlayerId.set(s.player_id, s);
  }

  const players = prevPlayers.map(p => ({
    id: p.id, name: p.name, team_id: p.team_id, team_name: p.team_name, team_color: p.team_color,
    picture_url: p.picture_url,
    signup: signupByPlayerId.get(p.id) || null,
  }));

  res.send(renderAdminPage(req, {
    title: 'Returning Players',
    currentPath: '/admin/season/returning',
    body: adminReturningBody({ prevSeason, sigSeason, players }),
  }));
});

app.get('/admin/season/assessment-reviews', requireAuth, (req, res) => {
  const sigSeason = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const assessments = getAssessmentsBySeason(sigSeason);
  const signups = getSeasonSignups(sigSeason);
  const signupByPlayerId = new Map(signups.filter(s => s.player_id).map(s => [s.player_id, s]));

  const reviewsByAssessment = new Map();
  for (const r of getAssessmentReviewsBySeason(sigSeason)) {
    if (!reviewsByAssessment.has(r.assessment_id)) reviewsByAssessment.set(r.assessment_id, []);
    reviewsByAssessment.get(r.assessment_id).push(r);
  }

  const rows = assessments.map(a => {
    const signup = signupByPlayerId.get(a.player_id) || null;
    const reviews = reviewsByAssessment.get(a.id) || [];
    return { assessmentId: a.id, playerId: a.player_id, signup, reviews, summary: summarizeReviews(reviews) };
  });

  res.send(renderAdminPage(req, {
    title: 'Assessment Reviews',
    currentPath: '/admin/season/assessment-reviews',
    body: adminAssessmentReviewsListBody({ sigSeason, rows }),
  }));
});

app.get('/admin/season/comments', requireAuth, (req, res) => {
  const sigSeason = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const signups = getSeasonSignups(sigSeason)
    .filter(s => s.comments && s.comments.trim())
    .sort((a, b) => b.created_at - a.created_at);

  res.send(renderAdminPage(req, {
    title: 'Signup Comments',
    currentPath: '/admin/season/comments',
    body: adminCommentsBody({ sigSeason, signups }),
  }));
});

app.get('/admin/season/signups/:id', requireAuth, (req, res) => {
  const bare = getSeasonSignupById(req.params.id);
  if (!bare) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/season/waitlist', body: '<p style="padding:40px;color:var(--text-muted)">Signup not found.</p>' }));
  const signup = getSeasonSignups(bare.season).find(s => s.id === bare.id);
  enrichSignup(signup, bare.season);

  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  res.send(renderAdminPage(req, {
    title: displayPlayerName(signup.full_name || 'Signup'),
    currentPath: '/admin/season/waitlist',
    body: adminSignupDetailBody({ signup, isSuperAdmin }),
  }));
});

app.get('/admin/season/assessments/:id', requireAuth, (req, res) => {
  const a = getPlayerAssessmentById(req.params.id);
  if (!a) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '', body: '<p style="padding:40px;color:var(--text-muted)">Assessment not found.</p>' }));
  const signup = getSeasonSignups(a.season).find(s => s.player_id === a.player_id) || null;
  const rating = a.player_id ? getLatestPlayerRating(a.player_id) : null;
  const reviews = getAssessmentReviews(a.id);
  const me = reviewerIdentity(req);
  const myReview = reviews.find(r => r.reviewer_reg_id === me.reviewer_reg_id) || null;
  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  res.send(renderAdminPage(req, {
    title: 'Mindset & Self-Assessment',
    currentPath: '/admin/season/waitlist',
    body: adminAssessmentReviewBody({ assessment: a, signup, rating, reviews, myReview, isSuperAdmin }),
  }));
});

// Super-admin-only — an individual admin can already fix their own review by re-saving the
// form (upsertAssessmentReview overwrites in place), so a delete button is only for removing
// someone else's (a test entry, something posted in error, etc.).
app.delete('/admin/season/assessments/:assessmentId/review/:reviewId', requireSuperAdmin, (req, res) => {
  const a = getPlayerAssessmentById(req.params.assessmentId);
  if (!a) return res.status(404).json({ error: 'not found' });
  deleteAssessmentReview(req.params.reviewId);
  res.json({ ok: true });
});

app.post('/admin/season/assessments/:id/review', requireAuth, express.json(), (req, res) => {
  const a = getPlayerAssessmentById(req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  const tag = String(req.body?.tag || '');
  if (!['', 'no_concerns', 'worth_conversation', 'discuss_admin'].includes(tag)) return res.status(400).json({ error: 'invalid tag' });
  const vote = String(req.body?.vote || '');
  if (!['', 'yes', 'no'].includes(vote)) return res.status(400).json({ error: 'invalid vote' });
  const me = reviewerIdentity(req);
  upsertAssessmentReview(a.id, me.reviewer_reg_id, me.reviewer_name, tag, String(req.body?.note || ''), vote);
  res.json({ ok: true });
});

// Super-admin-only, both to view and to purge — liveness captures are the most sensitive
// thing this app stores (raw webcam photos), so this is one notch tighter than the rest of
// the season-signup admin surface (requireAuth), which any elevated player-admin can reach.
app.get('/admin/season/liveness', requireSuperAdmin, (req, res) => {
  const captures = getAllLivenessCaptures();
  const seasonSignups = new Map(); // season -> reg_id -> signup, fetched once per season present
  for (const c of captures) {
    if (!seasonSignups.has(c.season)) {
      const byRegId = new Map();
      for (const s of getSeasonSignups(c.season)) byRegId.set(s.reg_id, s);
      seasonSignups.set(c.season, byRegId);
    }
    const signup = seasonSignups.get(c.season).get(c.reg_id);
    if (signup) {
      c.signupName = signup.full_name || '';
    } else {
      // The liveness photo saves as soon as it's captured — well before the season-signup
      // form is actually submitted (see /season-signup/liveness-capture) — so someone who
      // took the photo and then abandoned the form has no season_signups row at all. Fall
      // back to the registration itself, which always exists once they're this far.
      const reg = getRegistration(c.reg_id);
      c.signupName = reg?.full_name || '';
      if (!c.player_id && reg?.player_id) c.player_id = reg.player_id;
    }
  }
  res.send(renderAdminPage(req, {
    title: 'Liveness Check Photos',
    currentPath: '/admin/season/waitlist',
    body: adminLivenessListBody({ captures }),
  }));
});

app.delete('/admin/season/liveness/:id', requireSuperAdmin, (req, res) => {
  const capture = getLivenessCaptureById(req.params.id);
  if (!capture) return res.status(404).json({ error: 'not found' });
  deleteLivenessCapture(req.params.id);
  res.json({ ok: true });
});

// "Nothing goes out" — this decode-and-serve route is the ONLY place liveness_captures'
// photo_data ever leaves the database. Never a public/CDN URL, never attached to an email
// or export.
app.get('/admin/season/liveness/:id/photo', requireSuperAdmin, (req, res) => {
  const capture = getLivenessCaptureById(req.params.id);
  if (!capture) return res.status(404).end();
  const match = capture.photo_data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  res.set('Content-Type', match[1]);
  res.set('Cache-Control', 'private, no-store');
  res.end(Buffer.from(match[2], 'base64'));
});

app.get('/admin/season/liveness/:id', requireSuperAdmin, (req, res) => {
  const capture = getLivenessCaptureById(req.params.id);
  if (!capture) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/season/waitlist', body: '<p style="padding:40px;color:var(--text-muted)">Capture not found.</p>' }));
  const signup = getSeasonSignups(capture.season).find(s => s.reg_id === capture.reg_id) || null;
  // Same fallback as the list route — an abandoned (never-submitted) signup has no
  // season_signups row, but the registration itself always exists.
  const registration = getRegistration(capture.reg_id);
  res.send(renderAdminPage(req, {
    title: 'Liveness Check',
    currentPath: '/admin/season/waitlist',
    body: adminLivenessReviewBody({ capture, signup, registration }),
  }));
});

app.post('/admin/season/start', requireAuth, express.json(), (req, res) => {
  const { season } = req.body || {};
  if (!season) return res.status(400).json({ error: 'season required' });
  setSetting('signup_target_season', String(season));
  setSetting('season_signup_open', '0');
  setSetting('season_signup_deadline', '');
  setSetting('season_draft_status', '');
  res.json({ ok: true });
});

app.post('/admin/season/settings', requireAuth, express.json(), (req, res) => {
  const allowed = [
    'season_signup_open', 'season_signup_deadline', 'portal_season',
    'season_format', 'season_quota_amount', 'season_team_count',
    'jersey_top_price', 'jersey_short_price',
    'jersey_surcharge_step', 'jersey_pockets_price', 'season_roster_capacity',
  ];
  for (const key of allowed) {
    if (key in (req.body || {})) setSetting(key, String(req.body[key]));
  }
  res.json({ ok: true });
});

app.post('/admin/season/signups/:id/confirm', requireAuth, express.json(), (req, res) => {
  const signup = getSeasonSignupById(req.params.id);
  if (!signup) return res.status(404).json({ error: 'Not found' });
  updateSeasonSignupStatus(signup.id, 'confirmed', req.body?.notes ?? '');
  res.json({ ok: true });
});

app.post('/admin/season/signups/:id/reject', requireAuth, express.json(), (req, res) => {
  const signup = getSeasonSignupById(req.params.id);
  if (!signup) return res.status(404).json({ error: 'Not found' });
  updateSeasonSignupStatus(signup.id, 'rejected', req.body?.notes ?? '');
  res.json({ ok: true });
});

// Admin-only — see withdrawSeasonSignup's comment in lib/portal-db.js for why this isn't
// self-service and doesn't touch the ledger. Atomically flips to 'withdrawn' and promotes
// the earliest waitlisted signup for the same season, if one exists.
app.post('/admin/season/signups/:id/withdraw', requireAuth, express.json(), (req, res) => {
  const result = withdrawSeasonSignup(req.params.id);
  if (result.error) return res.status(400).json({ error: 'Only a confirmed signup can be withdrawn.' });
  res.json({ ok: true, promotedId: result.promoted?.id || null });
});

app.post('/admin/season/signups/:id/team-pref', requireSuperAdmin, express.json(), (req, res) => {
  const signup = getSeasonSignupById(req.params.id);
  if (!signup) return res.status(404).json({ error: 'Not found' });
  const teamPref = req.body?.team_pref ?? '';
  if (!['', 'stick', 'reshuffle'].includes(teamPref)) return res.status(400).json({ error: 'Invalid value.' });
  updateSignupTeamPref(signup.id, teamPref);
  res.json({ ok: true });
});

// ── Admin: Team Builder ────────────────────────────────────────────────────────
app.get('/admin/season/teams', requireAuth, (req, res) => {
  const sigSeason   = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const players     = getSeasonSignupsWithStats(sigSeason);
  const teams       = getSeasonTeams(sigSeason);
  const rosterRows  = getSeasonRoster(sigSeason);
  const draftStatus = getSetting('season_draft_status', '');
  const leagueTeams = getAllTeams();
  const rosterPublished = getSetting('season_roster_published', '') === sigSeason;

  // Build rosterMap: teamId → [player objects]
  const signupById = Object.fromEntries(players.map(p => [p.id, p]));
  const rosterMap  = {};
  for (const row of rosterRows) {
    const player = signupById[row.signup_id];
    if (!player) continue;
    if (!rosterMap[row.team_id]) rosterMap[row.team_id] = [];
    rosterMap[row.team_id].push(player);
  }

  res.send(renderAdminPage(req, {
    title: 'Team Builder',
    currentPath: '/admin/season/teams',
    body: adminSeasonTeamsBody({ sigSeason, players, teams, rosterMap, draftStatus, leagueTeams, rosterPublished }),
  }));
});

// Lets rosters (and, for team heads, jersey-number entry) show up on the public /my-team
// page before the season officially starts — independent of "Start Season", which locks
// the draft and charges fees. Toggle only, no other side effects.
app.post('/admin/season/teams/publish', requireAuth, express.json(), (req, res) => {
  const { season, published } = req.body || {};
  if (!season) return res.status(400).json({ error: 'season required' });
  setSetting('season_roster_published', published ? String(season) : '');
  res.json({ ok: true });
});

// Read-only mirror of what a team head sees on /my-team, for every team at once — lets
// admin check progress (sizes/numbers filled in, who's still missing one) without having
// to impersonate each head individually.
app.get('/admin/season/teams/preview', requireAuth, (req, res) => {
  const sigSeason = getSetting('signup_target_season', '');
  if (!sigSeason) return res.redirect('/admin/season');

  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(sigSeason);
  const rosterPublished  = getSetting('season_roster_published', '') === sigSeason;
  const teamsWithRosters = seasonTeams.map(team => ({
    team,
    roster: buildTeamRosterView(team, rosterRows, liveTeams, allHeads),
  }));

  res.send(renderAdminPage(req, {
    title: 'Team Preview — Head View',
    currentPath: '/admin/season/teams',
    body: adminSeasonTeamsPreviewBody({ sigSeason, teamsWithRosters, rosterPublished }),
  }));
});

app.post('/admin/season/teams/create', requireAuth, express.json(), (req, res) => {
  const { season, name, color } = req.body || {};
  if (!season || !name) return res.status(400).json({ error: 'season and name required' });
  const id = `st_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const teams = getSeasonTeams(season);
  upsertSeasonTeam(id, season, name.trim(), color || '#f59332', teams.length);
  res.json({ ok: true, id });
});

// Seeds season_teams from the live league teams (Blue/Maroon/White/Black) as a starting
// template — only offered while the draft has no teams yet, so it can't clobber an
// in-progress build.
app.post('/admin/season/teams/seed-from-league', requireAuth, express.json(), (req, res) => {
  const { season } = req.body || {};
  if (!season) return res.status(400).json({ error: 'season required' });
  if (getSeasonTeams(season).length) return res.status(400).json({ error: 'This season already has teams.' });
  getAllTeams().forEach((t, i) => {
    const id = `st_${Date.now()}_${randomBytes(4).toString('hex')}`;
    upsertSeasonTeam(id, season, t.name, t.color, i);
  });
  res.json({ ok: true });
});

app.post('/admin/season/teams/:id/delete', requireAuth, express.json(), (req, res) => {
  deleteSeasonTeam(req.params.id);
  res.json({ ok: true });
});

app.post('/admin/season/teams/save', requireAuth, express.json(), (req, res) => {
  const { season, teams = [], assignments = [] } = req.body || {};
  if (!season) return res.status(400).json({ error: 'season required' });
  // Update team names/colors
  for (const t of teams) {
    if (t.id && t.name) upsertSeasonTeam(t.id, season, t.name.trim(), t.color || '#f59332', t.sort_order ?? 0);
  }
  // Save roster assignments
  saveSeasonRoster(season, assignments.filter(a => a.team_id));
  setSetting('season_draft_status', 'draft');
  res.json({ ok: true });
});

app.get('/admin/season/teams/sandbox', requireAuth, (req, res) => {
  const currentSeason = getPortalCurrentSeason();
  const source        = req.query.source === 'waitlist' ? 'waitlist' : 'players';
  const season        = req.query.season || currentSeason;

  let players;
  if (source === 'waitlist') {
    players = getSeasonSignupsWithStats(season)
      // Sandbox is scratch space for experimenting with team splits before anyone's actually
      // confirmed — waitlisted signups are fair game here even though the real Team Builder
      // (season-teams.js's confirmedPlayers filter) only pools confirmed ones. Rejected/
      // withdrawn stay excluded since those are explicitly out of consideration.
      .filter(s => s.status === 'confirmed' || s.status === 'waitlisted')
      .map(s => ({
        id:           s.id,
        full_name:    signupDisplayName(s) || s.email || s.id,
        positions:    s.positions || '[]',
        height:       s.height    || '',
        rating:       s.rating    ?? null,
        off_rating:   s.off_rating ?? null,
        def_rating:   s.def_rating ?? null,
        picture_url:  s.picture_url || '',
        career_games: s.career_games ?? 0,
        status:       'confirmed',
        jersey_top:   s.jersey_top    || null,
        jersey_shorts: s.jersey_shorts || null,
        _sandbox:     true,
      }));
  } else {
    players = getPlayersWithRatings(season)
      .filter(p => p.status === 'active')
      .map(p => {
        const parts    = String(p.name || '').split(',');
        const fullName = parts.length >= 2 ? `${parts[1].trim()} ${parts[0].trim()}` : p.name;
        return {
          id:           p.id,
          full_name:    fullName,
          positions:    p.positions || '[]',
          height:       '',
          rating:       p.eff_overall ?? null,
          off_rating:   p.eff_scoring  ?? null,
          def_rating:   p.eff_defense  ?? null,
          picture_url:  p.picture_url || '',
          career_games: p.career_games ?? 0,
          status:       'confirmed',
          jersey_top:   null,
          jersey_shorts: null,
          _sandbox:     true,
        };
      });
  }

  // Build source option lists
  const gameSeasons    = getGameSeasons();   // ['3','2','1'] newest-first
  const signupSeasons  = getSignupStatsBySeason()
    .filter(s => s.confirmed > 0 || s.waitlisted > 0)
    .map(s => s.season);

  const teams      = getSeasonTeams('sandbox');
  const rosterRows = getSeasonRoster('sandbox');
  const rosterMap  = {};
  for (const row of rosterRows) {
    const player = players.find(p => p.id === row.signup_id);
    if (player) {
      if (!rosterMap[row.team_id]) rosterMap[row.team_id] = [];
      rosterMap[row.team_id].push(player);
    }
  }

  res.send(renderAdminPage(req, {
    title: 'Team Builder — Sandbox',
    body: adminSeasonTeamsBody({
      sigSeason: 'sandbox',
      players,
      teams,
      rosterMap,
      isSandbox:    true,
      sandboxSource: { source, season: String(season), gameSeasons, signupSeasons },
    }),
  }));
});

app.post('/admin/season/teams/sandbox/clear', requireAuth, express.json(), (req, res) => {
  clearSeasonTeams('sandbox');
  clearSeasonRoster('sandbox');
  res.json({ ok: true });
});

app.get('/admin/season/teams/charge-preview', requireAuth, (req, res) => {
  const season         = req.query.season || getSetting('signup_target_season', '');
  const quotaAmount    = Number(getSetting('season_quota_amount', '0')) || 0;
  const topPrice       = Number(getSetting('jersey_top_price', '0')) || 0;
  const shortPrice     = Number(getSetting('jersey_short_price', '0')) || 0;
  const surchargeStep  = Number(getSetting('jersey_surcharge_step', '50')) || 0;
  const pocketsPrice   = Number(getSetting('jersey_pockets_price', '100')) || 0;
  const players        = getSeasonSignupsWithStats(season).filter(p => p.status === 'confirmed');

  let grandTotal = 0;
  const lines = players.map(p => {
    const total = quotaAmount + computeJerseyTotal({
      topPrice, shortPrice, jerseyTop: p.jersey_top, jerseyShorts: p.jersey_shorts,
      pockets: !!p.pockets, pocketsPrice, surchargeStep,
    });
    grandTotal += total;
    return { name: p.full_name || '—', total: `₱${total.toLocaleString()}` };
  });

  // Non-blocking heads-up for the Start Season modal — how many new/traded players
  // (see buildTeamRosterView) haven't submitted jersey details yet, across every team.
  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(season);
  const jerseyPending = seasonTeams.reduce((sum, team) => {
    const roster = buildTeamRosterView(team, rosterRows, liveTeams, allHeads);
    return sum + roster.filter(p => p.needsJersey && !p.jerseySubmittedAt).length;
  }, 0);

  res.json({ lines, grand_total: `₱${grandTotal.toLocaleString()}`, jersey_pending: jerseyPending });
});

app.post('/admin/season/teams/start', requireAuth, express.json(), async (req, res) => {
  const season = (req.body?.season || getSetting('signup_target_season', '')).toString();
  if (!season) return res.status(400).json({ error: 'season required' });

  const quotaAmount    = Number(getSetting('season_quota_amount', '0')) || 0;
  const topPrice       = Number(getSetting('jersey_top_price', '0')) || 0;
  const shortPrice     = Number(getSetting('jersey_short_price', '0')) || 0;
  const surchargeStep  = Number(getSetting('jersey_surcharge_step', '50')) || 0;
  const pocketsPrice   = Number(getSetting('jersey_pockets_price', '100')) || 0;
  // Snapshot the fee into season_quotas so Ledger/Finance collection-rate reporting
  // for this season tracks against what players were actually charged, without a
  // separate manual entry step.
  setSeasonQuota(season, quotaAmount);
  const teams        = getSeasonTeams(season);
  const teamById     = Object.fromEntries(teams.map(t => [t.id, t]));
  const rosterRows   = getSeasonRoster(season);
  const teamBySignup = Object.fromEntries(rosterRows.map(r => [r.signup_id, r.team_id]));

  const allSignups   = getSeasonSignupsWithStats(season);
  const confirmed    = allSignups.filter(p => p.status === 'confirmed');
  const notSelected  = allSignups.filter(p => p.status !== 'confirmed');

  const today = new Date().toISOString().split('T')[0];

  // Charge confirmed players
  for (const p of confirmed) {
    if (!p.player_id) continue;
    const charge = quotaAmount + computeJerseyTotal({
      topPrice, shortPrice, jerseyTop: p.jersey_top, jerseyShorts: p.jersey_shorts,
      pockets: !!p.pockets, pocketsPrice, surchargeStep,
    });
    if (charge > 0) {
      const txId = randomBytes(6).toString('hex');
      const chargeNotes = `Season ${season} fee (jersey top${p.jersey_shorts ? ' + shorts' : ''})`;
      recordTransaction({
        id: txId, player_id: p.player_id, amount: charge, type: 'charge',
        payment_method: '', date: today, status: 'confirmed',
        notes: chargeNotes,
        reference_no: '', season, category: 'season_fee',
      });
      notifyLedgerEvent({ playerId: p.player_id, type: 'charge', amount: charge, notes: chargeNotes });
    }
  }

  // Email confirmed players
  const emailErrors = [];
  for (const p of confirmed) {
    if (!p.email) continue;
    const teamName = teamById[teamBySignup[p.id] || '']?.name || '';
    try {
      await sendMail({ to: p.email, ...seasonQualifiedEmail({ name: p.full_name, season, teamName }) });
    } catch(e) { emailErrors.push(p.email); }
  }

  // Email not-selected players
  for (const p of notSelected) {
    if (!p.email) continue;
    try {
      await sendMail({ to: p.email, ...seasonNotSelectedEmail({ name: p.full_name, season }) });
    } catch(e) { emailErrors.push(p.email); }
  }

  setSetting('season_draft_status', 'started');
  setSetting('season_signup_open', '0');

  res.json({ ok: true, charged: confirmed.filter(p => p.player_id).length, emails_sent: confirmed.length + notSelected.length, email_errors: emailErrors });
});

// ── Papawis (pickup games) ─────────────────────────────────────────────────────
app.get('/papawis', (req, res) => {
  if (getSetting('papawis_enabled', '0') !== '1') return res.status(404).send(
    renderPage(req, { title: 'Not Found', currentPath: '/papawis', body: '<div class="container"><p style="padding:40px;color:var(--text-muted)">Page not found.</p></div>' })
  );
  const games = getPapawisGames();
  // Location is free text on the game, matched to a court by name — same lookup the admin
  // "Close out" calculator uses for its rate default. No match, or a matched court with no
  // photo on file, both just mean the card falls back to its plain (no-banner) layout.
  for (const g of games) {
    const court = getPapawisCourtByName(g.location);
    g.court_image_id = court?.image_url ? court.id : null;
  }
  const signupsByGame = Object.fromEntries(games.map(g => [g.id, getPapawisSignups(g.id)]));
  const viewerPlayerId = req.session?.playerPlayerId || null;
  const isLoggedIn = !!req.session?.playerRegId;
  let hasBalance = false;
  if (viewerPlayerId) {
    const fin = getPlayerFinancials(viewerPlayerId);
    hasBalance = (fin?.current_balance ?? 0) > 0;
  }

  const origin = getRequestOrigin(req);
  const papawisUrl  = `${origin}/papawis`;
  const papawisDesc = 'Pickup games with limited slots. First come, first served — see the schedule, who\'s in, and join the waitlist.';
  const papawisImg  = `${origin}/api/papawis/og-image.png`;
  const papawisMetaTags = [
    `<meta name="description" content="${escAttr(papawisDesc)}">`,
    `<link rel="canonical" href="${escAttr(papawisUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="WKND Basketball League">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="Papawis — WKND Basketball League">`,
    `<meta property="og:description" content="${escAttr(papawisDesc)}">`,
    `<meta property="og:url" content="${escAttr(papawisUrl)}">`,
    `<meta property="og:image" content="${escAttr(papawisImg)}">`,
    `<meta property="og:image:secure_url" content="${escAttr(papawisImg)}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Papawis — WKND Basketball League">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="Papawis — WKND Basketball League">`,
    `<meta name="twitter:description" content="${escAttr(papawisDesc)}">`,
    `<meta name="twitter:image" content="${escAttr(papawisImg)}">`,
  ].join('\n  ');

  res.send(renderPage(req, {
    title: 'Papawis — WKND Basketball',
    currentPath: '/papawis',
    metaTags: papawisMetaTags,
    body: papawisPage({ games, signupsByGame, viewerPlayerId, isLoggedIn, hasBalance }),
  }));
});

app.post('/papawis/:id/join', (req, res) => {
  if (getSetting('papawis_enabled', '0') !== '1') return res.status(404).json({ error: 'Not available.' });
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) {
    return res.status(401).json({ error: 'Please log in to join.' });
  }
  const playerId = req.session.playerPlayerId;
  const fin = getPlayerFinancials(playerId);
  if ((fin?.current_balance ?? 0) > 0) {
    return res.status(403).json({ error: "You have an outstanding balance — clear it with an admin before joining." });
  }
  // A probationary player with enough standing credit already on file (from a previous
  // deposit) skips the hold entirely — the floor is already covered, so there's nothing
  // left to wait on. Re-checked fresh on every join: once that credit's spent on a game's
  // charge, the next join goes back to pending until they top up again. No floor yet
  // (getMaxPapawisPrice() null — nothing completed to base one on) means nothing's proven
  // safe yet, so it falls back to still holding them rather than treating any credit as enough.
  const minDeposit = getMaxPapawisPrice();
  const hasCoveringCredit = minDeposit != null && (fin?.current_balance ?? 0) <= -minDeposit;
  const isProbation = !!getPlayerById(playerId)?.papawis_probation && !hasCoveringCredit;
  const signupId = randomBytes(6).toString('hex');
  const result = joinPapawisGame(req.params.id, playerId, signupId, isProbation);
  if (result.error === 'not_found')      return res.status(404).json({ error: 'Game not found.' });
  if (result.error === 'not_open')       return res.status(400).json({ error: 'Sign-ups for this game are not open yet.' });
  if (result.error === 'passed')         return res.status(400).json({ error: 'This game has already happened — sign-ups are closed.' });
  if (result.error === 'already_listed') return res.status(400).json({ error: "You're already listed for this game." });
  res.json({ ok: true, status: result.status });
});

// Shared by both cancel paths (player self-cancel and admin remove) — cancelPapawisSignup
// already tells the caller who (if anyone) got auto-promoted off the waitlist; this just
// turns that into the player-facing notification. A guest promotion has no player_id of
// its own to notify (guest signups are billed to but not "owned" by any one account beyond
// the sponsor, who already knows), so those are silently skipped.
function notifyPapawisPromotion(game, promoted) {
  if (!promoted || !promoted.player_id || promoted.guest_name) return;
  createNotification({
    playerId: promoted.player_id,
    type: 'papawis_promoted',
    title: `You're confirmed for ${game.title || 'Papawis'}!`,
    body: 'A spot opened up and you were moved off the waitlist.',
    link: `/papawis#pw-game-${game.id}`,
  });
}

app.post('/papawis/:id/cancel', (req, res) => {
  if (getSetting('papawis_enabled', '0') !== '1') return res.status(404).json({ error: 'Not available.' });
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  const playerId = req.session.playerPlayerId;
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  const signup = getPapawisActiveSignupForPlayer(req.params.id, playerId);
  if (!signup) return res.status(404).json({ error: 'You are not listed for this game.' });
  if (signup.status === 'confirmed') {
    const today = new Date(manilaTodayStr() + 'T00:00:00');
    const gameDate = new Date(game.date + 'T00:00:00');
    const daysLeft = Math.round((gameDate - today) / 86400000);
    if (daysLeft < PAPAWIS_CUTOFF_DAYS) {
      return res.status(403).json({ error: `Cancellation window closed ${PAPAWIS_CUTOFF_DAYS} days before game day — message an admin.` });
    }
  }
  const result = cancelPapawisSignup(signup.id);
  if (result.error) return res.status(400).json({ error: 'Could not cancel.' });
  notifyPapawisPromotion(game, result.promoted);
  res.json({ ok: true });
});

// Fire-and-forget beacon from the "See all players" / "See who was listed" / "See who
// played" button — logs that a specific logged-in member looked at the roster.
app.post('/papawis/:id/viewed', (req, res) => {
  if (getSetting('papawis_enabled', '0') !== '1') return res.status(404).end();
  if (!req.session?.playerRegId || !req.session?.playerPlayerId) return res.status(401).end();
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).end();
  const playerId = req.session.playerPlayerId;
  const player = getPlayerById(playerId);
  logPapawisActivity({ gameId: game.id, eventType: 'viewed_roster', playerId, playerName: player?.name || '' });
  res.json({ ok: true });
});

// ── Fines: team head/coach surface ──────────────────────────────────────────────
// Outside /admin — heads authenticate via the player session (requireHead), not the
// admin one. Deliberately minimal: case queue + voting + a report form, nothing else.
app.get('/fines', requireHead, (req, res) => {
  const open     = getFineCasesByStatus('open');
  const resolved = [...getFineCasesByStatus('approved'), ...getFineCasesByStatus('rejected')]
    .sort((a, b) => (b.resolved_at || 0) - (a.resolved_at || 0)).slice(0, 30);
  const votesByCase = Object.fromEntries(open.map(c => [c.id, getFineVotesForCase(c.id)]));
  const categories = getActiveFineCategories();
  const players = getAllPlayers();
  const actor = currentHeadActor(req);
  res.send(renderPage(req, {
    title: 'Fines — WKND Basketball',
    currentPath: '/fines',
    body: finesPage({ open, resolved, votesByCase, categories, players, viewerId: actor.id }),
  }));
});

app.post('/fines', requireHead, express.json(), (req, res) => {
  const actor = currentHeadActor(req);
  const { playerId, gameId = '', categoryId, description = '' } = req.body || {};
  if (!playerId || !categoryId) return res.status(400).json({ error: 'Player and category are required.' });
  const result = createFineCase({ playerId, gameId, categoryId, description, reportedByType: actor.type, reportedById: actor.id, reportedByName: actor.name });
  if (result.error) return res.status(400).json({ error: 'Could not file the report.' });
  res.json({ ok: true, id: result.id });
});

app.post('/fines/:id/vote', requireHead, express.json(), (req, res) => {
  const actor = currentHeadActor(req);
  const { vote, comment = '' } = req.body || {};
  if (vote !== 'approve' && vote !== 'reject') return res.status(400).json({ error: 'Invalid vote.' });
  const result = castFineVote({ caseId: req.params.id, voterType: actor.type, voterId: actor.id, voterName: actor.name, vote, comment });
  if (result.error) return res.status(400).json({ error: 'This case is no longer open for voting.' });
  res.json({ ok: true });
});

// Read-only — deliberately no write actions (no recording payments, no editing balances).
// Season fee status is derived from the same transaction_ledger the admin Ledger reads, just
// collapsed to a 3-state summary (paid/partial/owing) rather than exposing peso amounts or
// transaction history to a non-admin account.
app.get('/team', requireHead, (req, res) => {
  const season = getPortalCurrentSeason();
  const balances = new Map(getSeasonBalances(season).map(r => [r.player_id, r]));

  const teams = getHeadTeamIds(req.session.playerPlayerId).map(teamId => {
    const team = getTeamById(teamId);
    const roster = getPlayersByTeam(teamId).map(player => {
      const bal = balances.get(player.id);
      let status = 'not_charged';
      if (bal && bal.charged > 0) {
        if (bal.balance <= 0) status = 'paid';
        else if (bal.paid > 0) status = 'partial';
        else status = 'owing';
      }
      return { player, status };
    });
    return { team, roster };
  }).filter(t => t.team);

  res.send(renderPage(req, {
    title: 'My Team — WKND Basketball',
    currentPath: '/team',
    body: teamHeadPage({ teams, season }),
  }));
});

// ── Pre-season "My Team" preview ─────────────────────────────────────────────────
// Draft rosters (season_teams/season_roster) are portal-only and independent of both the
// live teams/players tables and of "Start Season" — this just surfaces them to registrants
// once an admin publishes them from the Team Builder, ahead of the season officially
// starting. Team heads additionally get to fill in jersey numbers for brand-new players
// (no player_id yet) — see POST /my-team/number below.
function resolveMyTeamContext(season) {
  const seasonTeams = getSeasonTeams(season);
  const rosterRows  = getSeasonRoster(season);
  const liveTeams   = getAllTeams();
  const allHeads    = getAllTeamHeads();
  return { seasonTeams, rosterRows, liveTeams, allHeads };
}

function liveTeamForSeasonTeam(team, liveTeams) {
  if (!team) return null;
  return liveTeams.find(t => t.name.trim().toUpperCase() === team.name.trim().toUpperCase()) || null;
}

function headPlayerIdsForSeasonTeam(team, liveTeams, allHeads) {
  const liveTeam = liveTeamForSeasonTeam(team, liveTeams);
  if (!liveTeam) return new Set();
  return new Set(allHeads.filter(h => h.team_id === liveTeam.id).map(h => h.player_id));
}

// Shared by /my-team (a single team, for the logged-in viewer), POST /my-team/number
// (validating a write), and the admin preview at /admin/season/teams/preview (every team
// at once) — same shape everywhere so none of them can drift out of sync with each other.
//
// Three kinds of roster member, in order of how "locked" their number is:
//   - stayed:  has a live player_id, same live team as this draft team    → number fixed
//   - traded:  has a live player_id, but a DIFFERENT live team            → number fixed
//              UNLESS it collides with a "stayed" (or already-resolved) teammate's number,
//              in which case *they* (not the incumbent) need a new one — being traded alone
//              doesn't require a new jersey, only an actual conflict does
//   - new:     no live player_id at all                                  → always needs one
// A number is only ever "needed" (editable) for new/traded members, and only when it
// actually collides with someone else on the same team.
function buildTeamRosterView(team, rosterRows, liveTeams, allHeads) {
  const teammates     = rosterRows.filter(r => r.team_id === team.id);
  const liveTeam      = liveTeamForSeasonTeam(team, liveTeams);
  const headPlayerIds = headPlayerIdsForSeasonTeam(team, liveTeams, allHeads);

  const raw = teammates.map(r => {
    const isNew      = !r.player_id;
    const livePlayer = !isNew ? getPlayerById(r.player_id) : null;
    const isTraded   = !isNew && !!liveTeam && livePlayer?.team_id !== liveTeam.id;
    return {
      signupId:     r.signup_id,
      name:         displayPlayerName(r.full_name),
      positions:    r.positions,
      isNew,
      isTraded,
      isHead:       !isNew && headPlayerIds.has(r.player_id),
      jerseyTop:    r.jersey_top,
      jerseyShorts: r.jersey_shorts,
      jerseyName:   r.jersey_name,
      pockets:      !!r.pockets,
      shortsNotes:  r.jersey_shorts_notes || '',
      pictureUrl:   livePlayer?.picture_url || '',
      requestedAt:  r.jersey_requested_at || 0,
      submittedAt:  r.jersey_submitted_at || 0,
      // A head-entered replacement (for a new player, or a traded one resolving a
      // conflict) always wins once set; otherwise fall back to whatever's already on file.
      currentNumber: r.jersey_number || livePlayer?.number || '',
    };
  });

  const counts = {};
  raw.forEach(p => { if (p.currentNumber) counts[p.currentNumber] = (counts[p.currentNumber] || 0) + 1; });

  return raw.map(p => {
    const isFlexible     = p.isNew || p.isTraded;
    const needsNewNumber = isFlexible && !!p.currentNumber && counts[p.currentNumber] > 1;
    return {
      signupId:     p.signupId,
      name:         p.name,
      positions:    p.positions,
      isNew:        p.isNew,
      isTraded:     p.isTraded,
      isHead:       p.isHead,
      jerseyTop:    p.jerseyTop,
      jerseyShorts: p.jerseyShorts,
      jerseyName:   p.jerseyName,
      pockets:      p.pockets,
      shortsNotes:  p.shortsNotes,
      pictureUrl:   p.pictureUrl,
      needsNewNumber,
      number:       needsNewNumber ? '' : p.currentNumber,
      // "Needs jersey" (size + number + printed name) applies to anyone who isn't a
      // simple stayed-and-unchanged player — new to the league, or moved teams — regardless
      // of whether their number happens to conflict. Drives the admin "Request Jersey
      // Details" button and the (non-blocking) Start Season warning.
      needsJersey:      isFlexible,
      jerseyRequestedAt: p.requestedAt,
      jerseySubmittedAt: p.submittedAt,
    };
  });
}

app.get('/my-team', (req, res) => {
  if (!req.session?.playerRegId) return res.redirect('/login?next=' + encodeURIComponent('/my-team'));

  const season    = getSetting('signup_target_season', '');
  const published = season && getSetting('season_roster_published', '') === season;
  if (!published) {
    return res.send(renderPage(req, {
      title: 'My Team — WKND Basketball', currentPath: '/my-team',
      body: myTeamPage({ notPublished: true }),
    }));
  }

  const signup = getSeasonSignup(req.session.playerRegId, season);
  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(season);
  const myRow = signup ? rosterRows.find(r => r.reg_id === req.session.playerRegId) : null;

  if (!signup || !myRow) {
    return res.send(renderPage(req, {
      title: 'My Team — WKND Basketball', currentPath: '/my-team',
      body: myTeamPage({ notAssigned: true, season }),
    }));
  }

  const team          = seasonTeams.find(t => t.id === myRow.team_id);
  const headPlayerIds = headPlayerIdsForSeasonTeam(team, liveTeams, allHeads);
  const viewerIsHead  = !!req.session.playerPlayerId && headPlayerIds.has(req.session.playerPlayerId);
  const roster        = buildTeamRosterView(team, rosterRows, liveTeams, allHeads);

  res.send(renderPage(req, {
    title: 'My Team — WKND Basketball', currentPath: '/my-team',
    body: myTeamPage({ team, roster, season, viewerIsHead }),
  }));
});

app.post('/my-team/number', express.json(), (req, res) => {
  if (!req.session?.playerRegId) return res.status(401).json({ error: 'Not logged in.' });

  const num = String(req.body?.number || '').trim();
  if (!/^\d{1,2}$/.test(num)) return res.status(400).json({ error: 'Enter a number from 0-99.' });

  const season = getSetting('signup_target_season', '');
  if (!season || getSetting('season_roster_published', '') !== season) {
    return res.status(400).json({ error: 'Rosters are not published yet.' });
  }

  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(season);
  const target = rosterRows.find(r => r.signup_id === req.body?.signupId);
  if (!target) return res.status(404).json({ error: 'Player not found on any roster.' });

  const team = seasonTeams.find(t => t.id === target.team_id);
  const headPlayerIds = headPlayerIdsForSeasonTeam(team, liveTeams, allHeads);
  if (!req.session.playerPlayerId || !headPlayerIds.has(req.session.playerPlayerId)) {
    return res.status(403).json({ error: "Only this team's head can set jersey numbers." });
  }

  // Recompute the same view a head actually sees — only a new player or a traded player
  // with a genuine conflict is allowed to get a number written here; anyone already
  // resolved (a stayed player, or a traded player whose old number is still free) is
  // rejected even if someone tampers with the request directly.
  const computed   = buildTeamRosterView(team, rosterRows, liveTeams, allHeads);
  const targetView = computed.find(p => p.signupId === target.signup_id);
  if (!targetView?.needsNewNumber) {
    return res.status(400).json({ error: 'This player does not need a new number.' });
  }

  const taken = computed.some(p => p.signupId !== target.signup_id && p.number && Number(p.number) === Number(num));
  if (taken) return res.status(400).json({ error: `#${Number(num)} is already taken on this team.` });

  setSeasonSignupJerseyNumber(target.signup_id, num);
  res.json({ ok: true, number: num });
});

// ── Jersey-request flow: admin sends, player self-serves ─────────────────────────
// Manually triggered by admin per player (see /admin/season/teams/preview) — a second
// path onto the same jersey_number/jersey_top/jersey_shorts/pockets columns /my-team's
// head flow writes, this time filled in by the player themselves via an emailed,
// unauthenticated tokenized link (same pattern as /set-password's pw_token).
app.post('/admin/season-signups/:id/request-jersey', requireAuth, express.json(), (req, res) => {
  const signup = getSeasonSignupById(req.params.id);
  if (!signup) return res.status(404).json({ error: 'Signup not found.' });
  const reg = getRegistration(signup.reg_id);
  if (!reg?.email) return res.status(400).json({ error: 'No email on file for this registrant.' });

  const token = randomBytes(32).toString('hex');
  setJerseyRequestToken(signup.id, token, Date.now() + 60 * 24 * 60 * 60 * 1000);

  const proto   = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host    = req.headers['x-forwarded-host'] || req.headers.host;
  const formUrl = `${proto}://${host}/jersey-request?token=${token}`;
  const name    = displayPlayerName(reg.full_name) || reg.email;

  // Season-4 team name for display context in the email/notification, if assigned yet.
  const rosterRows = getSeasonRoster(signup.season);
  const myRow      = rosterRows.find(r => r.signup_id === signup.id);
  const teamName   = myRow ? (getSeasonTeams(signup.season).find(t => t.id === myRow.team_id)?.name || '') : '';

  if (reg.player_id) {
    createNotification({
      playerId: reg.player_id,
      type:     'jersey_request',
      title:    'Jersey details needed',
      body:     'Fill in your jersey size, number, and printed name before jerseys are ordered.',
      link:     `/jersey-request?token=${token}`,
    });
  }
  sendMail({ to: reg.email, ...jerseyRequestEmail({ name, formUrl, teamName }) }).catch(e => console.error('[mailer]', e.message));

  res.json({ ok: true });
});

// Lets admin fill in or correct jersey details directly, for a player who can't be reached
// or whose submission needs a fix — same write path and validation as the player's own
// /jersey-request form, just triggered from the admin session instead of a mailed token.
app.post('/admin/season-signups/:id/jersey-details', requireAuth, express.json(), (req, res) => {
  const signup = getSeasonSignupById(req.params.id);
  if (!signup) return res.status(404).json({ error: 'Signup not found.' });

  const { jersey_name = '', jersey_number = '', jersey_top = '', jersey_shorts = '', pockets = false, jersey_shorts_notes = '' } = req.body || {};
  const num = String(jersey_number).trim();
  if (!jersey_name.trim())                return res.status(400).json({ error: 'Enter the name to print on the jersey.' });
  if (!num)                                return res.status(400).json({ error: 'Enter a jersey number.' });
  if (!/^\d{1,2}$/.test(num))              return res.status(400).json({ error: 'Jersey number must be 0-99.' });
  if (!JERSEY_SIZES.includes(jersey_top))  return res.status(400).json({ error: 'Pick a valid jersey top size.' });
  if (jersey_shorts && !JERSEY_SIZES.includes(jersey_shorts)) return res.status(400).json({ error: 'Pick a valid shorts size.' });

  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(signup.season);
  const myRow = rosterRows.find(r => r.signup_id === signup.id);
  const team  = myRow ? seasonTeams.find(t => t.id === myRow.team_id) : null;
  if (team) {
    const computed = buildTeamRosterView(team, rosterRows, liveTeams, allHeads);
    const taken = computed.some(p => p.signupId !== signup.id && p.number && Number(p.number) === Number(num));
    if (taken) return res.status(400).json({ error: `#${Number(num)} is already taken on this team.` });
  }

  submitJerseyDetails(signup.id, {
    number: num, top: jersey_top, shorts: jersey_shorts, pockets: !!pockets,
    jerseyName: jersey_name.trim().slice(0, 20), shortsNotes: jersey_shorts_notes.trim().slice(0, 200),
  });
  res.json({ ok: true });
});

app.get('/jersey-request', (req, res) => {
  const { token = '' } = req.query;
  const signup = token ? getSeasonSignupByJerseyToken(token) : null;
  if (!signup) {
    return res.status(400).send(renderPage(req, {
      title: 'Invalid Link — WKND Basketball', currentPath: '', ticker: '',
      body: jerseyRequestPage({ invalid: true }),
    }));
  }

  const rosterRows = getSeasonRoster(signup.season);
  const myRow      = rosterRows.find(r => r.signup_id === signup.id);
  const teamName   = myRow ? (getSeasonTeams(signup.season).find(t => t.id === myRow.team_id)?.name || '') : '';
  const name       = displayPlayerName(signup.full_name) || '';

  // Jersey cost is billed separately from the season quota (see Start Season's charge
  // step) — shown here purely so the player knows what they're about to be on the hook
  // for, computed with the exact same function that does the real charging later.
  const jerseyPricing = {
    topPrice:      Number(getSetting('jersey_top_price', '0')) || 0,
    shortPrice:    Number(getSetting('jersey_short_price', '0')) || 0,
    surchargeStep: Number(getSetting('jersey_surcharge_step', '50')) || 0,
    pocketsPrice:  Number(getSetting('jersey_pockets_price', '100')) || 0,
  };

  res.send(renderPage(req, {
    title: 'Jersey Details — WKND Basketball', currentPath: '', ticker: '',
    body: jerseyRequestPage({
      token, name, teamName, jerseyPricing,
      prefill: {
        jersey_name:   signup.jersey_name,
        jersey_number: signup.jersey_number,
        jersey_top:    signup.jersey_top,
        jersey_shorts: signup.jersey_shorts,
        pockets:       !!signup.pockets,
        jersey_shorts_notes: signup.jersey_shorts_notes,
      },
    }),
  }));
});

app.post('/jersey-request', express.urlencoded({ extended: false }), (req, res) => {
  const { token = '', jersey_name = '', jersey_number = '', jersey_top = '', jersey_shorts = '', pockets = '', jersey_shorts_notes = '' } = req.body;
  const signup = token ? getSeasonSignupByJerseyToken(token) : null;

  const jerseyPricing = {
    topPrice:      Number(getSetting('jersey_top_price', '0')) || 0,
    shortPrice:    Number(getSetting('jersey_short_price', '0')) || 0,
    surchargeStep: Number(getSetting('jersey_surcharge_step', '50')) || 0,
    pocketsPrice:  Number(getSetting('jersey_pockets_price', '100')) || 0,
  };
  const renderErr = (error, prefill) => res.status(400).send(renderPage(req, {
    title: 'Jersey Details — WKND Basketball', currentPath: '', ticker: '',
    body: jerseyRequestPage({ token, error, prefill, jerseyPricing }),
  }));

  if (!signup) {
    return res.status(400).send(renderPage(req, {
      title: 'Invalid Link — WKND Basketball', currentPath: '', ticker: '',
      body: jerseyRequestPage({ invalid: true }),
    }));
  }

  const prefill = { jersey_name, jersey_number, jersey_top, jersey_shorts, pockets: !!pockets, jersey_shorts_notes };
  const num = jersey_number.trim();
  if (!jersey_name.trim())            return renderErr('Enter the name to print on the jersey.', prefill);
  if (!num)                            return renderErr('Enter a jersey number.', prefill);
  if (!/^\d{1,2}$/.test(num))          return renderErr('Jersey number must be 0-99.', prefill);
  if (!JERSEY_SIZES.includes(jersey_top)) return renderErr('Pick a jersey top size.', prefill);
  if (jersey_shorts && !JERSEY_SIZES.includes(jersey_shorts)) return renderErr('Pick a valid shorts size.', prefill);

  // Same team-scoped duplicate check /my-team/number uses for the head-edit path — a
  // player can pick any number here too, but not one already spoken for on their team.
  {
    const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(signup.season);
    const myRow = rosterRows.find(r => r.signup_id === signup.id);
    const team  = myRow ? seasonTeams.find(t => t.id === myRow.team_id) : null;
    if (team) {
      const computed = buildTeamRosterView(team, rosterRows, liveTeams, allHeads);
      const taken = computed.some(p => p.signupId !== signup.id && p.number && Number(p.number) === Number(num));
      if (taken) return renderErr(`#${Number(num)} is already taken on your team.`, prefill);
    }
  }

  submitJerseyDetails(signup.id, {
    number: num, top: jersey_top, shorts: jersey_shorts, pockets: !!pockets,
    jerseyName: jersey_name.trim().slice(0, 20), shortsNotes: jersey_shorts_notes.trim().slice(0, 200),
  });

  res.send(renderPage(req, {
    title: 'Jersey Details — WKND Basketball', currentPath: '', ticker: '',
    body: jerseyRequestPage({ submitted: true }),
  }));
});

// Stable authenticated link for the site-wide reminder banner (see jerseyRequestBanner in
// renderPage) — resolves to whatever token is currently valid for this player's season
// signup, so the banner never points at a token that's gone stale after a Resend.
app.get('/jersey-request/mine', (req, res) => {
  if (!req.session?.playerRegId) return res.redirect('/login?next=' + encodeURIComponent('/jersey-request/mine'));
  const season = getSetting('signup_target_season', '');
  const signup = season ? getSeasonSignup(req.session.playerRegId, season) : null;
  if (!signup?.jersey_request_token || signup.jersey_request_token_exp <= Date.now()) return res.redirect('/me');
  res.redirect(`/jersey-request?token=${signup.jersey_request_token}`);
});

// CSV export for handing off to whoever prints the jerseys — sorted by team, then name.
// Defaults to only rows this flow has actually touched (requested or submitted), since
// stayed players who never asked for a resize already have a jersey and don't need a
// re-order; pass ?all=1 to include everyone on the roster regardless.
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
app.get('/admin/season/teams/export-jerseys', requireAuth, (req, res) => {
  const season = req.query.season || getSetting('signup_target_season', '');
  if (!season) return res.status(400).send('No active season.');
  const includeAll = req.query.all === '1';

  const { seasonTeams, rosterRows, liveTeams, allHeads } = resolveMyTeamContext(season);
  const rows = [['Team', 'Player', 'Jersey Name', 'Number', 'Top Size', 'Shorts Size', 'Pockets', 'Shorts Notes', 'Status', 'Jersey Request']];
  seasonTeams.forEach(team => {
    const roster = buildTeamRosterView(team, rosterRows, liveTeams, allHeads)
      .sort((a, b) => a.name.localeCompare(b.name));
    roster.forEach(p => {
      const touched = p.jerseyRequestedAt || p.jerseySubmittedAt;
      if (!includeAll && !touched) return;
      rows.push([
        team.name, p.name, p.jerseyName || '', p.number || '', p.jerseyTop || '', p.jerseyShorts || '',
        p.pockets ? 'Yes' : 'No', p.shortsNotes || '',
        p.isNew ? 'New' : (p.isTraded ? 'Traded' : 'Stayed'),
        p.jerseySubmittedAt ? 'Submitted' : (p.jerseyRequestedAt ? 'Requested' : ''),
      ]);
    });
  });

  const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="jersey-orders-season-${season}${includeAll ? '-all' : ''}.csv"`);
  res.send(csv);
});

// ── League Polls: player-facing surface ──────────────────────────────────────────
// Same identity split as Fines/Team — reachable by any logged-in player (requirePollAccess),
// not the admin session. Polls are filtered to whatever this viewer's tier can see; voting is
// gated separately by voter_eligibility, which can be a narrower tier than visibility.
app.get('/polls', requirePollAccess, (req, res) => {
  const identity = currentPollVoterIdentity(req);
  const polls = getAllLeaguePolls()
    .filter(p => pollTierQualifies(p.visibility, identity))
    .map(p => {
      const votes = getLeaguePollVotes(p.id);
      const myVote = getMyLeaguePollVote(p.id, identity.id);
      return { ...p, votes, myVote, canVote: pollTierQualifies(p.voter_eligibility, identity) };
    });
  res.send(renderPage(req, {
    title: 'League Polls — WKND Basketball',
    currentPath: '/polls',
    body: pollsPage({ polls }),
  }));
});

// Returns the fresh tally so the client can update the fill bars/checkmark in place — see
// pollsPage's script (views/polls.js), which never does a full page reload after voting.
function pollTally(poll, votes) {
  const counts = poll.options.map(() => 0);
  for (const v of votes) if (counts[v.option_index] !== undefined) counts[v.option_index]++;
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

app.post('/polls/:id/vote', requirePollAccess, express.json(), (req, res) => {
  const identity = currentPollVoterIdentity(req);
  const poll = getLeaguePollById(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Not found.' });
  if (poll.status !== 'open') return res.status(400).json({ error: 'This poll is closed.' });
  if (!pollTierQualifies(poll.voter_eligibility, identity)) return res.status(403).json({ error: 'You\'re not eligible to vote in this poll.' });
  const optionIndex = Number(req.body?.option_index);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
    return res.status(400).json({ error: 'Invalid option.' });
  }
  castLeaguePollVote(poll.id, identity.id, identity.name, optionIndex);
  const { counts, total } = pollTally(poll, getLeaguePollVotes(poll.id));
  res.json({ ok: true, counts, total, myOption: optionIndex });
});

// ── Admin: League Polls ───────────────────────────────────────────────────────────
// Also reachable by the shared super-admin login (no player identity at all), which is why
// admin-tier voting has to happen here rather than only on /polls.
app.get('/admin/polls', requireAuth, (req, res) => {
  const polls = getAllLeaguePolls().map(p => ({ ...p, votes: getLeaguePollVotes(p.id) }));
  res.send(renderAdminPage(req, {
    title: 'League Polls',
    currentPath: '/admin/polls',
    body: adminPollsBody({ polls }),
  }));
});
app.post('/admin/polls', requireAuth, express.json(), (req, res) => {
  const { question, description, options, visibility, voter_eligibility } = req.body || {};
  const cleanOptions = Array.isArray(options) ? options.map(o => String(o || '').trim()).filter(Boolean) : [];
  if (!String(question || '').trim()) return res.status(400).json({ error: 'Question is required.' });
  if (cleanOptions.length < 2) return res.status(400).json({ error: 'At least 2 options are required.' });
  if (!['admins', 'heads', 'players'].includes(visibility)) return res.status(400).json({ error: 'Invalid visibility.' });
  if (!['admins', 'heads', 'players'].includes(voter_eligibility)) return res.status(400).json({ error: 'Invalid voter eligibility.' });
  const actor = currentAdminActor(req);
  const id = createLeaguePoll({ question, description, options: cleanOptions, visibility, voterEligibility: voter_eligibility, createdBy: actor.name });
  res.json({ ok: true, id });
});
app.post('/admin/polls/:id/status', requireAuth, express.json(), (req, res) => {
  const poll = getLeaguePollById(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Not found.' });
  const status = req.body?.status;
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  setLeaguePollStatus(poll.id, status);
  res.json({ ok: true });
});
app.post('/admin/polls/:id/vote', requireAuth, express.json(), (req, res) => {
  const poll = getLeaguePollById(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Not found.' });
  if (poll.status !== 'open') return res.status(400).json({ error: 'This poll is closed.' });
  const actor = currentAdminActor(req);
  const optionIndex = Number(req.body?.option_index);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
    return res.status(400).json({ error: 'Invalid option.' });
  }
  castLeaguePollVote(poll.id, actor.id, actor.name, optionIndex);
  res.json({ ok: true });
});

// ── Admin: Papawis ──────────────────────────────────────────────────────────────
app.get('/admin/papawis', requireAuth, (req, res) => {
  const games = getPapawisGames();
  const papawisRemindersEnabled = getSetting('papawis_reminders_enabled', '0') === '1';
  res.send(renderAdminPage(req, {
    title: 'Papawis',
    currentPath: '/admin/papawis',
    body: adminPapawisListBody({ games, papawisRemindersEnabled, courts: getActivePapawisCourts() }),
  }));
});

app.get('/admin/papawis/courts', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'Papawis Courts',
    currentPath: '/admin/papawis/courts',
    body: adminPapawisCourtsBody({ courts: getAllPapawisCourts() }),
  }));
});
app.post('/admin/papawis/courts', requireAuth, express.json(), (req, res) => {
  const { name, price } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Court name is required.' });
  const id = addPapawisCourt(name, price);
  res.json({ ok: true, id });
});
app.post('/admin/papawis/courts/:id', requireAuth, express.json(), (req, res) => {
  const { name, price } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Court name is required.' });
  updatePapawisCourt(req.params.id, name, price);
  res.json({ ok: true });
});
app.post('/admin/papawis/courts/:id/toggle', requireAuth, express.json(), (req, res) => {
  const { active } = req.body || {};
  setPapawisCourtActive(req.params.id, !!active);
  res.json({ ok: true });
});
// Landscape banner crop (not the square "fit inside" players.picture_url gets from
// compressSourceImage) — this is what renders behind the title bar on a Papawis session card.
app.post('/admin/papawis/courts/:id/photo', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  const court = getPapawisCourtById(req.params.id);
  if (!court) return res.status(404).json({ error: 'Not found' });
  const dataUrl = String(req.body.dataUrl || '');
  if (!dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  const buf = parseDataUrl(dataUrl);
  if (!buf) return res.status(400).json({ error: 'Invalid image data' });
  try {
    const out = await sharp(buf).rotate().resize(800, 400, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, progressive: true }).toBuffer();
    updatePapawisCourtImage(court.id, 'data:image/jpeg;base64,' + out.toString('base64'));
    res.json({ ok: true });
  } catch (e) {
    console.error('[papawis court photo]', e.message);
    res.status(500).json({ error: 'Could not process image.' });
  }
});
// Same data:-URI-in-a-column storage as player photos — sendPlayerPhotoUrl is generic over
// the url string, no player-specific logic, so it's reused as-is here.
app.get('/api/papawis-court/:id/photo', async (req, res) => {
  const court = getPapawisCourtById(req.params.id);
  await sendPlayerPhotoUrl(res, court?.image_url);
});

app.post('/admin/papawis', requireAuth, express.json(), (req, res) => {
  const { title, date, start_time, end_time, location, max_slots, open_days_before } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required.' });
  const defaultTitle = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
    + ' (' + new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ')';
  const id = randomBytes(6).toString('hex');
  const created = createPapawisGame({
    id,
    title: (title || '').trim() || defaultTitle,
    date,
    start_time: (start_time || '').trim(),
    end_time: (end_time || '').trim(),
    location: (location || '').trim(),
    max_slots: Number(max_slots) || 10,
    open_days_before: open_days_before ? Number(open_days_before) : null,
    created_by: req.session.playerName || 'admin',
  });
  res.json({ ok: true, id: created.id });
});

// Declared before the /:id route below so "activity" isn't swallowed as a game id.
app.get('/admin/papawis/activity', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'Papawis Activity',
    currentPath: '/admin/papawis/activity',
    body: adminPapawisActivityBody({
      activity: getAllPapawisActivity(200),
      cancellers: getFrequentPapawisCancellers(),
      regulars: getFrequentPapawisPlayers(),
    }),
  }));
});

// Defense-in-depth for the mutation routes below — the admin UI hides the interactive
// controls once a game's roster is locked, but a locked game's signups/teams shouldn't be
// mutable via a direct request either. Returns null (and has already sent a response) if
// the game doesn't exist or is locked, so callers can just `if (!game) return;`.
function papawisLockCheck(gameId, res) {
  const game = getPapawisGame(gameId);
  if (!game) { res.status(404).json({ error: 'Not found.' }); return null; }
  if (game.signups_locked_at) { res.status(400).json({ error: 'Roster is locked. Unlock it first.' }); return null; }
  return game;
}

app.post('/admin/papawis/:id/lock', requireAuth, (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  lockPapawisSignups(game.id);
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/unlock', requireAuth, (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  unlockPapawisSignups(game.id);
  res.json({ ok: true });
});

app.get('/admin/papawis/:id', requireAuth, (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).send('Not found');
  const signups = getPapawisSignups(req.params.id);
  const players = getAllPlayers();
  const activity = getPapawisActivityForGame(req.params.id);
  const today = new Date(manilaTodayStr() + 'T00:00:00');
  const gameDate = new Date(game.date + 'T00:00:00');
  const daysLeft = Math.round((gameDate - today) / 86400000);

  // "Possible match" suggestions for still-unpaid players — only worth checking once the
  // game is completed (paid tracking doesn't mean anything before that). One lookup per
  // distinct unpaid player rather than per signup row, since a sponsor + their guest slot
  // share the same player_id and would otherwise re-run the same query twice.
  let unlinkedByPlayer = {};
  if (game.status === 'completed') {
    const unpaidPlayerIds = [...new Set(signups.filter(s => s.status === 'confirmed' && !s.paid_at).map(s => s.player_id))];
    for (const pid of unpaidPlayerIds) {
      const candidates = getUnlinkedPapawisPayments(pid);
      if (candidates.length) unlinkedByPlayer[pid] = candidates;
    }
  }

  // Feeds the "Close out" calculator when the game's (free-text) location happens to match a
  // known court by name — its hourly rate becomes the calculator's starting point instead of
  // an empty field.
  const courtRate = getPapawisCourtByName(game.location)?.price_per_hour || null;
  const minDeposit = getMaxPapawisPrice();

  // A pending (probationary) signup's player may have already submitted a deposit through
  // /settle-balance — surfaced here so "Confirm & list" can reuse that exact transaction
  // instead of recording a second, duplicate payment.
  let unconfirmedDepositByPlayer = {};
  for (const pid of [...new Set(signups.filter(s => s.status === 'pending').map(s => s.player_id))]) {
    const tx = getUnconfirmedPapawisDeposit(pid);
    if (tx) unconfirmedDepositByPlayer[pid] = tx;
  }

  res.send(renderAdminPage(req, {
    title: game.title || 'Papawis',
    currentPath: '/admin/papawis',
    body: adminPapawisDetailBody({ game, signups, players, activity, daysLeft, unlinkedByPlayer, courtRate, minDeposit, unconfirmedDepositByPlayer, courts: getActivePapawisCourts() }),
  }));
});

// Team-builder page: auto-arranges the confirmed roster into LIGHT/DARK the first time
// it's opened for a game (persisted immediately so a refresh doesn't reshuffle), then just
// renders whatever's stored — see buildBalancedTeams() in lib/papawis-teams.js for the
// position/height balancing logic. Re-arranging after that is an explicit action (the
// Re-shuffle button below), not something that happens on every page load.
app.get('/admin/papawis/:id/teams', requireAuth, (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).send('Not found');
  if (game.signups_locked_at) return res.redirect(`/admin/papawis/${game.id}`);
  let roster = getPapawisConfirmedForTeams(req.params.id);
  if (roster.length && roster.every(r => !r.team)) {
    setPapawisTeams(buildBalancedTeams(roster));
    roster = getPapawisConfirmedForTeams(req.params.id);
    // Only on this first-ever build, not on later manual reshuffles/drag-assigns — those
    // are the admin still fine-tuning, not the "here's your final team" moment. This is
    // exactly the parked "confirmed-no-team-yet reminder, then team assigned later, no
    // follow-up" gap noted in the Papawis notifications memory.
    roster.forEach(r => {
      if (!r.player_id || r.guest_name) return;
      createNotification({
        playerId: r.player_id,
        type: 'papawis_team_assigned',
        title: `Your team is set for ${game.title || 'Papawis'}`,
        body: `You're on Team ${r.team === 'dark' ? 'Dark' : 'Light'}.`,
        link: `/papawis#pw-game-${game.id}`,
      });
    });
  }
  res.send(renderAdminPage(req, {
    title: `Teams — ${game.title || 'Papawis'}`,
    currentPath: '/admin/papawis',
    body: adminPapawisTeamsBody({ game, roster }),
  }));
});

app.post('/admin/papawis/:id/teams/reshuffle', requireAuth, (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const roster = getPapawisConfirmedForTeams(req.params.id);
  setPapawisTeams(buildBalancedTeams(roster));
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/teams/assign', requireAuth, express.json(), (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const { signup_id, team } = req.body;
  const result = setPapawisSignupTeam(signup_id, team);
  if (result.error) return res.status(400).json({ error: 'Could not move.' });
  res.json({ ok: true });
});

// Manual, exactly-once catch-up email — see sendPapawisTeamAssignedEmail's comment in
// lib/papawis-notify.js for the gap this covers (reminder already sent with no team,
// team arranged afterward, nothing re-scans an already-reminded signup automatically).
app.post('/admin/papawis/:id/signups/:signupId/notify-team', requireAuth, async (req, res) => {
  const result = await sendPapawisTeamAssignedEmail(req.params.signupId);
  if (result.error === 'not_eligible') return res.status(400).json({ error: 'This signup is not eligible for a team-assigned email (no team, not confirmed, or already sent).' });
  if (result.error === 'no_email') return res.status(400).json({ error: 'No email on file for this player.' });
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/teams/reorder', requireAuth, express.json(), (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const team = req.body.team === 'dark' ? 'dark' : 'light';
  const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(id => typeof id === 'string') : [];
  reorderPapawisTeam(req.params.id, team, ids);
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/add', requireAuth, express.json(), (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const { player_id, status, guest_names } = req.body;
  if (!player_id) return res.status(400).json({ error: 'Select a player.' });
  const st = status === 'waitlist' ? 'waitlist' : 'confirmed';
  const names = String(guest_names || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);

  if (!names.length) {
    const id = randomBytes(6).toString('hex');
    const result = adminAddPapawisSignup({ id, gameId: req.params.id, playerId: player_id, status: st });
    if (result.error) return res.status(400).json({ error: 'That player is already listed.' });
    return res.json({ ok: true, added: 1 });
  }

  let added = 0;
  for (const guestName of names) {
    const id = randomBytes(6).toString('hex');
    const result = adminAddPapawisSignup({ id, gameId: req.params.id, playerId: player_id, status: st, guestName });
    if (!result.error) added++;
  }
  res.json({ ok: true, added });
});

app.post('/admin/papawis/:id/remove/:signupId', requireAuth, (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const result = adminRemovePapawisSignup(req.params.signupId);
  if (result.error) return res.status(400).json({ error: 'Could not remove.' });
  if (result.promoted) {
    const game = getPapawisGame(req.params.id);
    if (game) notifyPapawisPromotion(game, result.promoted);
  }
  res.json({ ok: true });
});

// Admin confirms a probationary player's deposit, either (a) one they submitted themselves
// through /settle-balance — tx_id given, reuses that exact pending transaction so it isn't
// double-recorded — or (b) one arranged outside the app (Messenger, cash) — amount given,
// records a fresh confirmed transaction, same recordTransaction() shape the "Mark Paid"
// route already uses. Either way, promotes the held 'pending' signup into confirmed/
// waitlist per current capacity. Deliberately not gated by papawisLockCheck: like Mark
// Paid, this is a financial confirmation, not a roster-shape edit.
app.post('/admin/papawis/:id/signups/:signupId/confirm-deposit', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  const signup = getPapawisSignupById(req.params.signupId);
  if (!signup || signup.game_id !== req.params.id) return res.status(404).json({ error: 'Not found.' });
  if (signup.status !== 'pending') return res.status(400).json({ error: 'Not pending.' });
  // Never trust the client's floor — re-derive it here so a stale page (or a direct API
  // call) can't slip a deposit in under the real historical minimum.
  const minDeposit = getMaxPapawisPrice();

  const txId = req.body?.tx_id ? String(req.body.tx_id) : '';
  if (txId) {
    const tx = getTransactionById(txId);
    if (!tx || tx.player_id !== signup.player_id || tx.status !== 'pending' || tx.category !== 'Papawis Deposit') {
      return res.status(400).json({ error: 'That submitted deposit is no longer available — refresh and try again.' });
    }
    if (minDeposit && tx.amount < minDeposit) {
      return res.status(400).json({ error: `Their submitted amount (₱${tx.amount.toLocaleString()}) is below the ₱${minDeposit.toLocaleString()} minimum — ask them to top up, or confirm a different amount manually.` });
    }
    if (!confirmTransaction(txId)) return res.status(400).json({ error: 'Could not confirm that payment.' });
    notifyLedgerEvent({ playerId: tx.player_id, type: 'payment', amount: tx.amount, notes: tx.notes });
  } else {
    const amount = Number(req.body?.amount) || 0;
    if (minDeposit && amount < minDeposit) {
      return res.status(400).json({ error: `Deposit must be at least ₱${minDeposit.toLocaleString()} — the highest papawis price on record.` });
    }
    if (amount > 0) {
      recordTransaction({
        id: randomBytes(6).toString('hex'), player_id: signup.player_id, amount, type: 'payment',
        payment_method: '', date: manilaTodayStr(), status: 'confirmed',
        notes: `Papawis deposit — ${game.title || 'Pickup game'} (${game.date})`,
        reference_no: game.id, season: '', category: 'Papawis Deposit',
      });
    }
  }
  const result = promotePapawisPendingSignup(signup.id);
  if (result.error) return res.status(400).json({ error: 'Could not confirm.' });
  if (result.status === 'confirmed') {
    createNotification({
      playerId: signup.player_id,
      type: 'papawis_promoted',
      title: `You're confirmed for ${game.title || 'Papawis'}!`,
      body: 'Your deposit was confirmed and you have a spot.',
      link: `/papawis#pw-game-${game.id}`,
    });
  }
  res.json({ ok: true, status: result.status });
});

app.post('/admin/papawis/:id/signups/:signupId/status', requireAuth, express.json(), (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const status = req.body.status === 'confirmed' ? 'confirmed' : 'waitlist';
  const result = setPapawisSignupStatus(req.params.signupId, status);
  if (result.error === 'full') return res.status(400).json({ error: 'Confirmed list is full.' });
  if (result.error) return res.status(400).json({ error: 'Could not move.' });
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/signups/reorder', requireAuth, express.json(), (req, res) => {
  if (!papawisLockCheck(req.params.id, res)) return;
  const status = req.body.status === 'confirmed' ? 'confirmed' : 'waitlist';
  const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(id => typeof id === 'string') : [];
  reorderPapawisSignups(req.params.id, status, ids);
  res.json({ ok: true });
});

// Changes the court/venue on an already-created game — only offered while it's still open
// (a completed/cancelled game's location is historical record, not something to correct).
// Free text either way, same as creation: picking a known court just fills in its name,
// "Others" (or anything typed) is stored as-is.
app.post('/admin/papawis/:id/location', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  if (game.status !== 'open') return res.status(400).json({ error: 'Only an open papawis can have its location changed.' });
  setPapawisGameLocation(req.params.id, req.body?.location);
  res.json({ ok: true });
});

// Saves the "Close out" calculator's breakdown without completing/charging — lets an admin
// lock in a court-rate/referee estimate as soon as they know it (e.g. right after booking the
// court), well before the game happens. That saved actual_total is what estimatedPapawisPrice()
// then quotes in the pre-game reminder/team-assigned emails instead of the generic guess.
app.post('/admin/papawis/:id/estimate', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  if (game.status !== 'open') return res.status(400).json({ error: 'Only open sessions can be updated here.' });
  savePapawisEstimate(req.params.id, {
    courtRate:    req.body.court_rate != null ? Number(req.body.court_rate) : null,
    hours:        req.body.hours != null ? Number(req.body.hours) : null,
    hasReferee:   !!req.body.has_referee,
    refereeRate:  req.body.referee_rate != null ? Number(req.body.referee_rate) : null,
    actualTotal:  req.body.actual_total != null ? Number(req.body.actual_total) : null,
    minPerPlayer: req.body.min_per_player != null ? Number(req.body.min_per_player) : null,
  });
  res.json({ ok: true });
});

app.post('/admin/papawis/:id/complete', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  const price = Number(req.body.price_per_player);
  if (!price || price <= 0) return res.status(400).json({ error: 'Enter a valid price per player.' });
  // Calculator breakdown — record-keeping only (see completePapawisGame), doesn't affect the
  // actual charge below, which always uses the (admin-confirmed, possibly hand-edited) price.
  const breakdown = {
    courtRate:    req.body.court_rate != null ? Number(req.body.court_rate) : null,
    hours:        req.body.hours != null ? Number(req.body.hours) : null,
    hasReferee:   !!req.body.has_referee,
    refereeRate:  req.body.referee_rate != null ? Number(req.body.referee_rate) : null,
    actualTotal:  req.body.actual_total != null ? Number(req.body.actual_total) : null,
    minPerPlayer: req.body.min_per_player != null ? Number(req.body.min_per_player) : null,
  };
  const confirmed = getPapawisSignups(req.params.id).filter(s => s.status === 'confirmed');
  const today = manilaTodayStr();
  for (const s of confirmed) {
    const txId = randomBytes(6).toString('hex');
    const chargeNotes = s.guest_name
      ? `Papawis — ${game.title || 'Pickup game'} (${game.date}) — guest: ${s.guest_name}`
      : `Papawis — ${game.title || 'Pickup game'} (${game.date})`;
    recordTransaction({
      id: txId, player_id: s.player_id, amount: price, type: 'charge',
      payment_method: '', date: today, status: 'confirmed',
      notes: chargeNotes,
      // 'Papawis', matching the player-facing PAYMENT_CATEGORIES value (views/utils.js) —
      // was previously lowercase 'papawis', which split ledger category reports in two and
      // meant a settle-balance payment could never string-match a papawis charge.
      reference_no: game.id, season: '', category: 'Papawis',
    });
    notifyLedgerEvent({ playerId: s.player_id, type: 'charge', amount: price, notes: chargeNotes });
    // Auto-settle from existing credit — if this player (or a guest's sponsor) already had
    // enough credit on file to absorb the charge, that money already covers it; no separate
    // payment to collect, so there's nothing for "Mark Paid" to wait on. A charge that only
    // partially draws down credit leaves a real balance owed, same as today — this only
    // fires when the charge is fully covered.
    const finAfterCharge = getPlayerFinancials(s.player_id);
    if ((finAfterCharge?.current_balance ?? 0) <= 0) {
      markPapawisSignupPaid(s.id, '');
    }
  }
  completePapawisGame(req.params.id, price, breakdown);
  res.json({ ok: true, charged: confirmed.length });
  if (getSetting('papawis_reminders_enabled', '0') === '1') {
    sendPapawisCompletionEmails(req.params.id, price).then(({ sent, errors }) => {
      if (errors.length) console.error(`[papawis] completion emails: ${sent} sent, ${errors.length} failed`, errors);
    }).catch(e => console.error('[papawis] completion email send failed:', e.message));
  }
});

// Paid tracking is only meaningful once a game is completed (that's when the charge
// transactions actually exist) — mirrors the charge loop above but per-signup and using
// type:'payment' instead of 'charge', same reference_no/category convention so it shows
// up correctly in the ledger. Un-marking voids the exact transaction this created rather
// than searching for one, so it can't accidentally void an unrelated payment.
app.post('/admin/papawis/:id/signups/:signupId/paid', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  if (game.status !== 'completed') return res.status(400).json({ error: 'Game must be completed first.' });
  const signup = getPapawisSignupById(req.params.signupId);
  if (!signup || signup.game_id !== req.params.id) return res.status(404).json({ error: 'Not found.' });

  const markPaid = req.body.paid !== false;
  if (markPaid) {
    if (!signup.paid_at) {
      const price = Number(game.price_per_player) || 0;
      let txId = '';
      if (price > 0) {
        txId = randomBytes(6).toString('hex');
        const notes = signup.guest_name
          ? `Papawis payment — ${game.title || 'Pickup game'} (${game.date}) — guest: ${signup.guest_name}`
          : `Papawis payment — ${game.title || 'Pickup game'} (${game.date})`;
        recordTransaction({
          id: txId, player_id: signup.player_id, amount: price, type: 'payment',
          payment_method: '', date: manilaTodayStr(), status: 'confirmed',
          notes, reference_no: game.id, season: '', category: 'Papawis',
        });
        notifyLedgerEvent({ playerId: signup.player_id, type: 'payment', amount: price, notes });
      }
      markPapawisSignupPaid(signup.id, txId);
    }
  } else {
    if (signup.paid_tx_id) voidTransaction(signup.paid_tx_id);
    markPapawisSignupUnpaid(signup.id);
  }
  res.json({ ok: true });
});

// Adopts an *existing* confirmed payment (e.g. one the player submitted through
// /settle-balance, or an admin entered directly in the ledger) as this signup's paid
// evidence — unlike the /paid route above, this never creates a new transaction. tx_id
// comes from the client rather than re-deriving "the" candidate server-side, but is
// re-validated against the live unlinked-candidates list right before accepting it, so a
// stale suggestion (e.g. two browser tabs, or someone else already linked it) can't slip
// through between when the page rendered and when this fires.
app.post('/admin/papawis/:id/signups/:signupId/link-payment', requireAuth, express.json(), (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  if (game.status !== 'completed') return res.status(400).json({ error: 'Game must be completed first.' });
  const signup = getPapawisSignupById(req.params.signupId);
  if (!signup || signup.game_id !== req.params.id) return res.status(404).json({ error: 'Not found.' });
  if (signup.paid_at) return res.status(400).json({ error: 'Already marked paid.' });

  const txId = String(req.body.tx_id || '');
  const stillValid = getUnlinkedPapawisPayments(signup.player_id).some(c => c.id === txId);
  if (!stillValid) return res.status(400).json({ error: 'That payment is no longer available to link — refresh and try again.' });

  markPapawisSignupPaid(signup.id, txId);
  res.json({ ok: true });
});

// Manual, on-demand send — deliberately NOT gated behind papawis_reminders_enabled like the
// automatic sends in /complete and /cancel are. That flag exists to stop an automated
// trigger from firing unexpectedly; an admin explicitly clicking this button is already the
// human-in-the-loop check the flag is there to provide. Mainly for games completed before
// this email existed (or a resend after fixing a bad email address) — doesn't touch
// charges, only re-reads the game's current price/roster and sends.
app.post('/admin/papawis/:id/send-payment-emails', requireAuth, async (req, res) => {
  const game = getPapawisGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found.' });
  if (game.status !== 'completed') return res.status(400).json({ error: 'Game must be completed first.' });
  try {
    const { sent, errors } = await sendPapawisCompletionEmails(game.id, game.price_per_player);
    res.json({ ok: true, sent, errors });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send.' });
  }
});

app.post('/admin/papawis/:id/cancel', requireAuth, (req, res) => {
  cancelPapawisGame(req.params.id);
  res.json({ ok: true });
  if (getSetting('papawis_reminders_enabled', '0') === '1') {
    sendPapawisCancellationEmails(req.params.id).then(({ sent, errors }) => {
      if (errors.length) console.error(`[papawis] cancellation emails: ${sent} sent, ${errors.length} failed`, errors);
    }).catch(e => console.error('[papawis] cancellation email send failed:', e.message));
  }
});

app.delete('/admin/papawis/:id', requireAuth, (req, res) => {
  deletePapawisGame(req.params.id);
  res.json({ ok: true });
});

// ── Admin: Fines & Conduct ───────────────────────────────────────────────────────
// Literal sub-paths (categories, heads) registered before the /:id case-detail route,
// same ordering reason as /admin/papawis/activity above /admin/papawis/:id — otherwise
// Express would match "categories"/"heads" as a case id.
app.get('/admin/fines/categories', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'Fine Categories', currentPath: '/admin/fines/categories',
    body: adminFineCategoriesBody({ categories: getAllFineCategories() }),
  }));
});
app.post('/admin/fines/categories', requireAuth, express.json(), (req, res) => {
  const { label, amount, description = '', examples = [] } = req.body || {};
  const amt = Number(amount);
  if (!label || Number.isNaN(amt) || amt < 0) return res.status(400).json({ error: 'Label and an amount of 0 or more are required.' });
  const id = createFineCategory({ label, amount: amt, description, examples: Array.isArray(examples) ? examples : [] });
  res.json({ ok: true, id });
});
app.post('/admin/fines/categories/:id', requireAuth, express.json(), (req, res) => {
  const { label, amount, description = '', examples = [] } = req.body || {};
  const amt = Number(amount);
  if (!label || Number.isNaN(amt) || amt < 0) return res.status(400).json({ error: 'Label and an amount of 0 or more are required.' });
  updateFineCategory(req.params.id, { label, amount: amt, description, examples: Array.isArray(examples) ? examples : [] });
  res.json({ ok: true });
});
app.post('/admin/fines/categories/:id/toggle', requireAuth, express.json(), (req, res) => {
  const category = getFineCategory(req.params.id);
  if (!category) return res.status(404).json({ error: 'Not found.' });
  setFineCategoryActive(req.params.id, !category.active);
  res.json({ ok: true, active: !category.active });
});

// Moved out of /admin/fines/* now that a head also gates /team (payments status) — kept a
// GET redirect from the old path since it was linked from nav/bookmarks for a while.
app.get('/admin/fines/heads', requireAuth, (req, res) => res.redirect('/admin/team-heads'));

app.get('/admin/team-heads', requireAuth, (req, res) => {
  res.send(renderAdminPage(req, {
    title: 'Team Heads', currentPath: '/admin/team-heads',
    body: adminTeamHeadsBody({ heads: getAllTeamHeads(), teams: getAllTeams(), players: getAllPlayers() }),
  }));
});
app.post('/admin/team-heads', requireAuth, express.json(), (req, res) => {
  const { teamId, playerId } = req.body || {};
  if (!teamId || !playerId) return res.status(400).json({ error: 'Team and player are required.' });
  addTeamHead(teamId, playerId);
  res.json({ ok: true });
});
app.post('/admin/team-heads/:id/revoke', requireAuth, (req, res) => {
  removeTeamHead(req.params.id);
  res.json({ ok: true });
});

app.get('/admin/ratings', requireSuperAdmin, (req, res) => {
  const seasons = getPeerRatingSeasons();
  const season  = req.query.season || seasons[0] || getPortalCurrentSeason() || '';
  const ratings = season ? getAllPeerRatings(season) : [];
  res.send(renderAdminPage(req, {
    title: 'Community Ratings',
    currentPath: '/admin/ratings',
    body: adminRatingsBody({ season, seasons, ratings }),
  }));
});

app.get('/admin/fines', requireAuth, (req, res) => {
  const pendingAdmin = getFineCasesByStatus('pending_admin');
  const open     = getFineCasesByStatus('open');
  const resolved = [...getFineCasesByStatus('approved'), ...getFineCasesByStatus('rejected'), ...getFineCasesByStatus('dismissed')]
    .sort((a, b) => (b.resolved_at || 0) - (a.resolved_at || 0));
  res.send(renderAdminPage(req, {
    title: 'Fines', currentPath: '/admin/fines',
    body: adminFinesListBody({ pendingAdmin, open, resolved, players: getAllPlayers(), categories: getActiveFineCategories() }),
  }));
});
app.post('/admin/fines', requireAuth, express.json(), (req, res) => {
  const actor = currentAdminActor(req);
  const { playerId, gameId = '', categoryId, description = '' } = req.body || {};
  if (!playerId || !categoryId) return res.status(400).json({ error: 'Player and category are required.' });
  const result = createFineCase({ playerId, gameId, categoryId, description, reportedByType: actor.type, reportedById: actor.id, reportedByName: actor.name });
  if (result.error) return res.status(400).json({ error: 'Could not file the report.' });
  res.json({ ok: true, id: result.id });
});
app.get('/admin/fines/:id', requireAuth, (req, res) => {
  const kase = getFineCase(req.params.id);
  if (!kase) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/fines', body: '<p style="padding:40px;color:var(--text-muted)">Case not found.</p>' }));
  const isSuperAdmin = !!req.session?.isAdmin && !req.session?.isElevatedPlayer;
  res.send(renderAdminPage(req, {
    title: 'Fine Case', currentPath: '/admin/fines',
    body: adminFineCaseBody({
      case: kase, votes: getFineVotesForCase(kase.id), player: getPlayerWithTeam(kase.player_id),
      escalationVotes: getEscalationVotesForCase(kase.id), totalAdmins: getTotalAdminCount(),
      viewerAdminId: currentAdminActor(req).id, isSuperAdmin,
    }),
  }));
});
app.post('/admin/fines/:id/vote', requireAuth, express.json(), (req, res) => {
  const actor = currentAdminActor(req);
  const { vote, comment = '' } = req.body || {};
  if (vote !== 'approve' && vote !== 'reject') return res.status(400).json({ error: 'Invalid vote.' });
  const result = castFineVote({ caseId: req.params.id, voterType: actor.type, voterId: actor.id, voterName: actor.name, vote, comment });
  if (result.error) return res.status(400).json({ error: 'This case is no longer open for voting.' });
  res.json({ ok: true });
});
// Resolution is always a deliberate admin action (see lib/portal-db.js comment on
// resolveFineCase) — the vote tally informs this, it doesn't auto-decide it. Approving
// charges the ledger (category 'Penalty', same mechanism as season fees/Papawis) and
// notifies the player only now, on resolution — never while the case is still open, so a
// player never sees an in-progress accusation, only the outcome.
app.post('/admin/fines/:id/resolve', requireAuth, express.json(), (req, res) => {
  const kase = getFineCase(req.params.id);
  if (!kase || kase.status !== 'open') return res.status(400).json({ error: 'Case is not open.' });
  const actor = currentAdminActor(req);
  const { approved, note = '' } = req.body || {};
  let transactionId = '';
  if (approved) {
    transactionId = randomBytes(6).toString('hex');
    recordTransaction({
      id: transactionId, player_id: kase.player_id, amount: kase.amount, type: 'charge',
      payment_method: '', date: manilaTodayStr(), status: 'confirmed',
      notes: `Fine — ${kase.category_label}${kase.description ? `: ${kase.description}` : ''}`,
      reference_no: kase.id, season: '', category: 'Penalty',
    });
  }
  resolveFineCase(kase.id, { approved: !!approved, resolvedByName: actor.name, note, transactionId });
  createNotification({
    playerId: kase.player_id,
    type: approved ? 'fine_approved' : 'fine_rejected',
    title: approved ? `You've been fined ₱${Number(kase.amount).toLocaleString()}` : 'A conduct report about you was reviewed',
    body: approved ? kase.category_label : 'No fine was issued.',
    link: '/me',
  });
  res.json({ ok: true, approved: !!approved });
});

// Notifies the reporting player their report didn't move forward — the accused is never
// told a pending_admin/dismissed case existed at all (same "outcome only, never
// in-progress" principle as /admin/fines/:id/resolve above).
function notifyReporterOfDismissal(kase) {
  if (kase.reported_by_type !== 'player' || !kase.reported_by_id) return;
  createNotification({
    playerId: kase.reported_by_id,
    type: 'report_dismissed',
    title: 'Your report was reviewed',
    body: `Admins reviewed your report and it was not escalated further.`,
    link: '/me',
  });
}

// Admin escalation vote — only meaningful on a pending_admin (player-submitted) case.
// Majority math + auto-transition lives in recomputeEscalation (lib/portal-db.js); this
// route just records the vote and lets that run, then notifies the reporter if the
// case just went terminal without ever reaching a head.
app.post('/admin/fines/:id/escalate-vote', requireAuth, express.json(), (req, res) => {
  const kase = getFineCase(req.params.id);
  if (!kase || kase.status !== 'pending_admin') return res.status(400).json({ error: 'This case is not awaiting escalation.' });
  const actor = currentAdminActor(req);
  const { vote, comment = '' } = req.body || {};
  if (vote !== 'escalate' && vote !== 'dismiss') return res.status(400).json({ error: 'Invalid vote.' });
  const result = castEscalationVote({ caseId: kase.id, adminId: actor.id, adminName: actor.name, vote, comment });
  if (result.error) return res.status(400).json({ error: 'This case is no longer awaiting escalation.' });
  recomputeEscalation(kase.id);
  const after = getFineCase(kase.id);
  if (after.status === 'dismissed') notifyReporterOfDismissal(after);
  res.json({ ok: true, status: after.status });
});

// Super-admin-only escape hatch for a pending_admin case whose vote count has stalled —
// see forceEscalationDecision's comment in lib/portal-db.js.
app.post('/admin/fines/:id/force-escalation', requireSuperAdmin, express.json(), (req, res) => {
  const kase = getFineCase(req.params.id);
  if (!kase || kase.status !== 'pending_admin') return res.status(400).json({ error: 'This case is not awaiting escalation.' });
  const actor = currentAdminActor(req);
  const { escalate } = req.body || {};
  const result = forceEscalationDecision(kase.id, { escalate: !!escalate, decidedByName: actor.name });
  if (!result.ok) return res.status(400).json({ error: 'Could not update this case.' });
  if (!escalate) notifyReporterOfDismissal(getFineCase(kase.id));
  res.json({ ok: true });
});

// Papawis pre-game reminders — see lib/papawis-notify.js. "Due" is decided per-signup
// (reminder_sent_at IS NULL + game within PAPAWIS_CUTOFF_DAYS), not per-job-run, so an
// hourly cadence is plenty and this also self-heals: a game already sitting inside the
// window when this job first ships gets caught up on its very first tick.
// Gated behind papawis_reminders_enabled (off by default, admin toggle in /admin/papawis) —
// this runs unconditionally at every boot, so without the gate a plain server restart
// with real credentials loaded would silently mass-email everyone currently due.
const PAPAWIS_REMINDER_CHECK_MS = 60 * 60 * 1000;
function runPapawisReminders() {
  if (getSetting('papawis_reminders_enabled', '0') !== '1') return;
  sendPapawisReminders(PAPAWIS_CUTOFF_DAYS).then(({ sent, errors }) => {
    if (sent || errors.length) console.log(`[papawis] reminders: ${sent} sent, ${errors.length} failed`);
  }).catch(e => console.error('[papawis] reminder scan failed:', e.message));
}
runPapawisReminders();
setInterval(runPapawisReminders, PAPAWIS_REMINDER_CHECK_MS);

// ── Live game-comments WebSocket ────────────────────────────────────────────────
// Scoped to one room per game (not a site-wide socket) — a client on /games/:id only
// gets that game's comment/reaction events. Receive-only for clients: comments are
// already public-read (see commentsTabBody), so no session auth on the socket itself —
// the actual writes still go through the existing authenticated HTTP routes below; this
// channel purely pushes "something changed, here's the update" to open tabs. Purely
// additive — if the socket never connects, every route above still works exactly the
// same via a manual refresh, same as before this existed.
const gameCommentRooms = new Map(); // gameId -> Set<WebSocket>
const wss = new WebSocketServer({ noServer: true });

function broadcastToGame(gameId, payload) {
  const room = gameCommentRooms.get(gameId);
  if (!room || !room.size) return;
  const msg = JSON.stringify(payload);
  for (const ws of room) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

// One room per liveness-check token — the desktop browser that generated the QR code
// connects here and waits; the phone that scanned it never connects to this socket at all,
// it just POSTs the capture over plain HTTP (see /season-signup/liveness/:token/capture)
// and this is what tells the waiting desktop tab it arrived. Rooms are single-listener in
// practice (one token = one desktop tab) but built as a Set for the same reason
// gameCommentRooms is — a stray duplicate connection is a no-op, not a bug.
const livenessRooms = new Map(); // token -> Set<WebSocket>
function broadcastLivenessCaptured(token) {
  const room = livenessRooms.get(token);
  if (!room || !room.size) return;
  const msg = JSON.stringify({ type: 'captured' });
  for (const ws of room) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  const commentsMatch = pathname.match(/^\/ws\/games\/([^/]+)\/comments$/);
  if (commentsMatch) {
    if (getSetting('comments_enabled', '0') !== '1') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const gameId = decodeURIComponent(commentsMatch[1]);
      if (!gameCommentRooms.has(gameId)) gameCommentRooms.set(gameId, new Set());
      gameCommentRooms.get(gameId).add(ws);
      ws.on('close', () => {
        const room = gameCommentRooms.get(gameId);
        if (room) { room.delete(ws); if (!room.size) gameCommentRooms.delete(gameId); }
      });
    });
    return;
  }

  const livenessMatch = pathname.match(/^\/ws\/liveness\/([^/]+)$/);
  if (livenessMatch) {
    const token = decodeURIComponent(livenessMatch[1]);
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!livenessRooms.has(token)) livenessRooms.set(token, new Set());
      livenessRooms.get(token).add(ws);
      ws.on('close', () => {
        const room = livenessRooms.get(token);
        if (room) { room.delete(ws); if (!room.size) livenessRooms.delete(token); }
      });
    });
    return;
  }

  socket.destroy();
});

server.listen(PORT, () => {
  console.log(`WKND Portal → http://localhost:${PORT}`);
  console.log(`DB: portal.db (self-hosted)`);
});
