import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual, createHash, scrypt, scryptSync } from 'crypto';
import { statSync, existsSync } from 'fs';
import express from 'express';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import { parseWriteup } from './lib/writeup.js';
import { sendMail, approvedEmail, rejectedEmail } from './lib/mailer.js';
import { setPasswordPage, setPasswordDonePage } from './views/set-password.js';
import sharp from 'sharp';
import { layout, escHtml } from './views/layout.js';
import { homePage } from './views/home.js';
import { gamesPage } from './views/games.js';
import { gamePage } from './views/game.js';
import { leadersPage, PER_GAME, TOTALS, fmtPerGame, fmtTotals, RECORD_CATS, recordContext } from './views/leaders.js';
import { roastPage, ROAST_CATS } from './views/roast.js';
import { standingsPage } from './views/standings.js';
import { playoffsPage } from './views/playoffs.js';
import { comingSoonPage } from './views/coming-soon.js';
import { leaderSharePage } from './views/leader-share.js';
import { playerPage } from './views/player.js';
import { playersPage } from './views/players.js';
import { scoreTicker } from './views/ticker.js';
import { privacyPage, termsPage } from './views/legal.js';
import { registerPage } from './views/register.js';
import { frontOfficePage } from './views/front-office.js';
import { teamsBody } from './views/teams.js';
import { teamColor, displayPlayerName } from './views/utils.js';
import {
  upsertShare, getShare, getSlugForEntity, getEntityForSlug, saveSlug,
  getAllFinancials, getAllTransactions, getAllTransactionsBySeason,
  recordTransaction, confirmTransaction, deleteTransaction,
  getPlayerFinancials, getPlayerTransactions, getPlayerTransactionsBySeason,
  getSeasonBalances, getSeasonSummary, getAllBalances, getAllSummary, getLedgerSeasons,
  getSeasonQuota, setSeasonQuota, voidTransaction,
  getPendingTransactions, getCategoryTotals, getTeamTotals, getRecentTransactions,
  getAllTeams, getAllPlayers, getAllGames, getGameCover,
  getTeamSeasonStats, getTeamRecords, getTeamRecordsAsOf, getLeaders,
  getGameById, getGameDetailStats, getGameStats,
  getPlayerWithTeam, getPlayerById, getTeamById,
  getPlayerTotals, getPlayerGameLog, getPlayerPotgCandidates,
  getPlayerCareerHighs, getPlayerAwards, getSeasonAwards, getAwardSeasons, getGameDnpPlayers, getGameRecords,
  getPlayerStatsByType,
  upsertAward, deleteAward, clearAwardType, getActivePlayers, getSeasonPlayerStats,
  getPlayerPhoto, getCurrentSeason, getSeasonLatestWeek, getTickerGames,
  getRecentPlayedGames, getScheduledGames, getGamesUnderReviewCount, getActivePlayerCount, getPlayedGamesCount,
  updateGameRecap, updateGameYoutube, updateGameCover, updateGamePotg, updateGameReview, updateGameAll, deleteGame,
  importGameResults, markGameFinal, setGameOvertime, createGame,
  updatePlayerPhoto, updatePlayer,
  getPrevMatchup, getTeamStreak, getPlayerLeagueRank, getPlayerSeasonStats,
  getPlayersWithRatings, getPlayerRating, upsertComputedRating, saveRatingOverrides,
  getStatsBySeason, getOnePlayerStats, upsertPlayerDetails, updatePlayerWriteup,
  getGameSeasons, setPlayerStatus, setPlayerTeam, setPlayerNumber,
  getCompareCache, setCompareCache, incrementCompareViews, getCompareAnalytics,
  getTeamRatingTotals, getPlayerRecentStats, getPlayerGamePts, getPlayerWinRate, getTotalSeasonGames,
  deleteUnlockedRating,
  getMvpWriteup, setMvpWriteup, deleteMvpWriteupForPlayer, clearMvpWriteupSeason,
  getMvpCandidates, getTotalSeasonGamesForMvp,
  getSetting, setSetting,
  insertRegistration, getAllRegistrations, getRegistration, getRegistrationByEmail, updateRegistration,
  setPasswordToken, getRegByPasswordToken, setRegistrationPassword,
  setRegistrationAdmin, insertAdminLog, getAdminLogs,
  createPlayer, mergeRegistrationIntoPlayer,
  getSeasonStandings, getPlayoffGames,
  db as portalDb,
} from './lib/portal-db.js';
import { playerSlug, teamSlug, gameSlug } from './lib/slugs.js';
import { generateText, generateWithGemini, filterPbpForRecap, aiAvailable } from './lib/ai.js';
import { adminLoginBody } from './views/admin/login.js';
import { adminLedgerBody, adminLedgerPlayerBody, playerFinancialSection } from './views/admin/ledger.js';
import { adminSiteBody } from './views/admin/site.js';
import { adminAwardsBody } from './views/admin/awards.js';
import { adminUsersBody }       from './views/admin/users.js';
import { adminUserDetailBody }  from './views/admin/user-detail.js';
import { adminLogsPage }        from './views/admin/logs.js';
import { adminFinanceDashBody } from './views/admin/finance-dash.js';
import { adminDashboardBody } from './views/admin/dashboard.js';
import { adminGamesListBody, adminGameDetailBody } from './views/admin/games.js';
import { adminPlayersBody } from './views/admin/players.js';
import { adminPlayerDetailBody } from './views/admin/player-detail.js';
import { adminComparePage } from './views/admin/compare.js';
import { adminLayout } from './views/admin/layout.js';
import { computeRatings, computeRawValues } from './lib/ratings.js';
import { mvpPage } from './views/mvp.js';
import { awardsPage } from './views/awards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSS_VER = (() => { try { return statSync(path.join(__dirname, 'public/styles.css')).mtimeMs | 0; } catch { return Date.now(); } })();

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

function buildTicker() {
  const games = getTickerGames();
  if (!games.length) return '';
  return scoreTicker(games);
}

function getFeatureFlags() {
  return {
    awards:  getSetting('awards_enabled',   '1') !== '0',
    mvpRace: getSetting('mvp_race_enabled', '1') !== '0',
  };
}

function regMiniBanner() {
  const deadline = getSetting('reg_deadline', '');
  return `<div class="reg-mini">
  <span class="reg-mini__pill">
    <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
    Registration Open
  </span>
  <span class="reg-mini__text">${deadline
    ? `Register before <strong>${escHtml(deadline)}</strong> to be eligible for upcoming seasons, playoffs, and league events.`
    : `Register now to join upcoming seasons, playoffs, and exclusive league events — spots are limited.`
  }</span>
  <a href="/register" class="reg-mini__cta">Register Now <span aria-hidden="true">→</span></a>
</div>`;
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
  const metaTags = existing.includes('og:image') ? existing : (existing ? existing + '\n  ' + fallbackMeta : fallbackMeta);
  const isPlayer = !!req.session?.playerRegId;
  const isLoggedIn = !!req.session?.isAdmin || isPlayer;
  const showMini = getSetting('reg_open', '0') === '1' && opts.currentPath !== '/' && !isLoggedIn;
  const body = showMini ? regMiniBanner() + (opts.body || '') : (opts.body || '');
  return layout({ ticker: buildTicker(), gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isAdmin: !!req.session?.isAdmin, isPlayer, features: getFeatureFlags(), ...opts, body, metaTags });
}

function renderAdminPage(req, opts) {
  return adminLayout({ gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isSuperAdmin: !req.session?.isElevatedPlayer, ...opts });
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
    heroCtxSvg = `<text x="${INFO_X}" y="${CHIP_TEXT + 30}" font-family="${COVER_SVG_FONT}" font-size="12" fill="#475569">${escXml(dateStr)} · VS ${escXml(String(f.game_opp || '').toUpperCase())} · <tspan font-weight="700" fill="${resColor}">${escXml(String(f.game_result || ''))}</tspan>${isPO ? ` <tspan font-weight="700" fill="#f59332">PO</tspan>` : ''}</text>`;
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
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session?.isAdmin) return next();
  if (req.session?.playerRegId) return res.redirect('/me');
  res.redirect('/login');
}

function requireSuperAdmin(req, res, next) {
  if (req.session?.isAdmin && !req.session?.isElevatedPlayer) return next();
  res.status(403).send(renderAdminPage(req, { title: 'Forbidden', currentPath: '', body: '<p style="padding:40px;color:var(--text-muted)">Super admin access required.</p>' }));
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
  <text x="129" y="24" text-anchor="middle" fill="${colorA}" font-size="9" font-weight="700" font-family="${COVER_SVG_FONT}" filter="url(#txt)" textLength="155" lengthAdjust="spacingAndGlyphs">SEASON ${escXml(String(game.season || ''))}  ·  ${escXml(game.game_type === 'playoff' ? 'PLAYOFFS' : 'REGULAR SEASON')}</text>
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

const _ogMvpCache = { buf: null, ts: 0 };
app.get('/og-mvp.png', async (req, res) => {
  try {
    if (!_ogMvpCache.buf || Date.now() - _ogMvpCache.ts > 3_600_000) {
      const { season } = getCurrentSeason() || {};
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

app.get('/api/player/:id/photo', async (req, res) => {
  const row = getPlayerPhoto(req.params.id);
  const url = row?.picture_url;
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

    const prompt = `You are a funny, slightly savage sports commentator for WKND Basketball League, a recreational league. Compare these two players in 2-3 sentences. Be playfully trash-talking — roast their weaknesses, celebrate their strengths — but keep it fun and good-natured, not cruel. Be specific with the numbers. Refer to each player by their first name only — no nicknames, no last names. No emojis. Output just the paragraph, no labels or titles.

${line(pA, tA)}
${line(pB, tB)}`;

    const { text, model } = await generateWithGemini(prompt, { maxTokens: 160, temperature: 0.92 });
    setCompareCache(a, b, tA, tB, text, model);
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
app.get('/login', (req, res) => {
  if (req.session?.isAdmin) return res.redirect('/admin');
  if (req.session?.playerRegId) return res.redirect('/me');
  res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody() }));
});

app.post('/login', (req, res) => {
  const { username = '', password = '', remember = '' } = req.body;

  // Admin check
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    if (remember === '1') req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    return res.redirect('/admin');
  }

  // Player check (username field used as email)
  const reg = getRegistrationByEmail(username.trim());
  if (reg) {
    if (reg.status !== 'approved') {
      return res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'Your registration is not yet approved.' }) }));
    }
    if (!reg.password_hash) {
      return res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'No password set yet — check your email for the setup link.' }) }));
    }
    if (checkPlayerPassword(password, reg.password_hash)) {
      req.session.playerRegId    = reg.id;
      req.session.playerPlayerId = reg.player_id;
      if (reg.is_admin) {
        req.session.isAdmin          = true;
        req.session.isElevatedPlayer = true;
        req.session.playerName       = (reg.full_name || '').split(',').reverse().map(s => s.trim()).join(' ');
      }
      if (remember === '1') req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      return res.redirect(reg.is_admin ? '/admin' : '/me');
    }
  }

  res.send(renderPage(req, { title: 'Sign In — WKND Basketball', currentPath: '/login', ticker: '', body: adminLoginBody({ error: 'Invalid email or password.' }) }));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/me', (req, res) => {
  if (!req.session?.playerRegId) return res.redirect('/login');
  const playerId = req.session.playerPlayerId;
  if (!playerId) return res.redirect('/login');
  const slug = getSlugForEntity('player', playerId);
  return res.redirect(slug ? `/players/${slug}` : `/players/${playerId}`);
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
  res.send(renderPage(req, { title: 'Password Set — WKND Basketball', currentPath: '', ticker: '', body: setPasswordDonePage() }));
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
  res.send(renderAdminPage(req, {
    title: 'Dashboard',
    currentPath: '/admin',
    body: adminDashboardBody({ players, teams, recentGames, upcoming, financeSummary, pendingTx, underReview, activePlayers, gamesPlayed }),
  }));
});

// ── Admin: Registrations ──────────────────────────────────────────────────────
app.get('/admin/registrations', requireAuth, (req, res) => res.redirect('/admin/users'));

app.get('/admin/users', requireAuth, (req, res) => {
  const registrations = getAllRegistrations();
  res.send(renderAdminPage(req, {
    title: 'Users',
    currentPath: '/admin/users',
    body: adminUsersBody({ registrations }),
  }));
});

app.get('/admin/users/:id', requireAuth, (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).send(renderAdminPage(req, { title: 'Not Found', currentPath: '/admin/users', body: '<p class="text-slate-500">Registration not found.</p>' }));
  const players      = getAllPlayers();
  const linkedPlayer = reg.player_id ? players.find(p => p.id === reg.player_id) : null;
  res.send(renderAdminPage(req, {
    title: reg.full_name,
    currentPath: '/admin/users',
    body: adminUserDetailBody({ reg, players, linkedPlayer, isSuperAdmin: !req.session?.isElevatedPlayer }),
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

app.post('/admin/users/:id/sync', requireAuth, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (!reg.player_id) return res.status(400).json({ error: 'No player linked to this registration.' });
  mergeRegistrationIntoPlayer(reg.player_id, reg);
  res.json({ ok: true });
});

app.post('/admin/users/:id/reset', requireAuth, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  updateRegistration(reg.id, { status: 'pending', player_id: '', notes: '', approved_at: 0 });
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

app.post('/admin/users/:id/toggle-admin', requireSuperAdmin, express.json(), (req, res) => {
  const reg = getRegistration(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Not found' });
  if (reg.status !== 'approved') return res.status(400).json({ error: 'User must be approved first.' });
  setRegistrationAdmin(reg.id, !reg.is_admin);
  res.json({ ok: true, is_admin: !reg.is_admin });
});

app.get('/admin/logs', requireSuperAdmin, (req, res) => {
  const logs = getAdminLogs(500);
  res.send(renderAdminPage(req, {
    title: 'Admin Logs',
    currentPath: '/admin/logs',
    body: adminLogsPage({ logs }),
  }));
});

const TEAM_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function playerPositions(p) {
  try { return JSON.parse(p.positions || '[]'); } catch { return []; }
}

function computeAwardSuggestions(stats, { mvpCandidates = null } = {}) {
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
  };
}

app.get('/admin/awards', requireAuth, (req, res) => {
  const { season: currentSeason } = getCurrentSeason() || {};
  const season = Number(req.query.season) || currentSeason || 3;
  const seasons = [...new Set(getLedgerSeasons())];
  const awards      = getSeasonAwards(season);
  const players     = getActivePlayers();
  const seasonStats = getSeasonPlayerStats(season);
  const suggestions = computeAwardSuggestions(seasonStats, { mvpCandidates: getMvpCandidates(season) });
  const SECTION_KEYS = ['mvp','dpoy','all_wknd_1','all_wknd_2','all_wknd_def','scoring_champ','assists_leader','rebounds_leader','steals_leader','blocks_leader','three_pm_leader'];
  const articles = Object.fromEntries(SECTION_KEYS.map(k => [k, getSetting(`award_article_${k}_${season}`, '')]));
  // Also load per-player articles for confirmed team award entries (stored under <type>_<player_id> keys).
  for (const award of awards) {
    if (['all_wknd_1', 'all_wknd_2', 'all_wknd_def'].includes(award.award_type)) {
      const key = `${award.award_type}_${award.player_id}`;
      articles[key] = getSetting(`award_article_${key}_${season}`, '');
    }
  }
  res.send(renderAdminPage(req, {
    title: 'Season Awards',
    currentPath: '/admin/awards',
    body: adminAwardsBody({ season, seasons, awards, suggestions, players, articles }),
  }));
});

const AWARD_TEAM_TYPES = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def']);

app.post('/admin/awards', requireAuth, express.json(), (req, res) => {
  const { season, award_type, player_id, position, clear_first, from_suggestion } = req.body || {};
  if (!season || !award_type) return res.status(400).json({ error: 'Missing fields' });

  if (from_suggestion) {
    const stats = getSeasonPlayerStats(season);
    const sugg  = computeAwardSuggestions(stats, { mvpCandidates: getMvpCandidates(season) })[award_type];
    const list  = Array.isArray(sugg) ? sugg : (sugg ? [sugg] : []);
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

  if (clear_first && !AWARD_TEAM_TYPES.has(award_type)) clearAwardType(season, award_type);

  if (player_id) {
    const notes = position || '';
    const id    = AWARD_TEAM_TYPES.has(award_type) && position
      ? `${season}_${award_type}_${position}`
      : `${season}_${award_type}_${player_id}`;
    upsertAward({ id, season, award_type, player_id, notes });
  }
  res.json({ ok: true });
});

app.delete('/admin/awards/:id', requireAuth, (req, res) => {
  deleteAward(req.params.id);
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
  };
  const TEAM_AWARD_TYPES = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def']);

  const awards = getSeasonAwards(season);
  const byType = {};
  for (const r of awards) (byType[r.award_type] ??= []).push(r);
  const entries = byType[award_type] || [];

  let prompt;

  if (TEAM_AWARD_TYPES.has(award_type) && player_id) {
    const entry = entries.find(e => e.player_id === player_id);
    if (!entry) return res.status(400).json({ error: 'Player not found in team award entries' });
    const gp  = entry.games_played || 1;
    const fmt = (v) => v != null ? (v / gp).toFixed(1) : '—';
    const statLine = `${fmt(entry.pts)} PPG, ${fmt(entry.reb)} RPG, ${fmt(entry.ast)} APG, ${fmt(entry.stl)} SPG, ${fmt(entry.blk)} BPG over ${gp} games`;
    const posNote  = entry.notes ? ` Selected as ${entry.notes}.` : '';
    const teammates = entries.filter(e => e.player_id !== player_id).map(e => e.player_name).join(', ');
    const teamCtx  = teammates ? ` Joins ${teammates} on the team.` : '';
    prompt = `Write a 2-3 sentence spotlight on ${entry.player_name} (${entry.team_name}) being named to the Season ${season} ${LABELS[award_type]} in the WKND Basketball League.${posNote} Stats this season: ${statLine}.${teamCtx} Focus on what specifically earned this player the honor — be vivid and specific, not generic. Write like a sports broadcaster. Each article should feel distinct from others on the same award page. Do not open with "Ladies and gentlemen", "Congratulations", or any ceremonial greeting — jump straight into the content.`;
  } else {
    let context = '';
    if (entries.length === 1) {
      const e = entries[0];
      const gp = e.games_played || 1;
      const fmt = (v) => v != null ? (v / gp).toFixed(1) : '—';
      context = `Winner: ${e.player_name} (${e.team_name}). Stats: ${fmt(e.pts)} PPG, ${fmt(e.reb)} RPG, ${fmt(e.ast)} APG, ${fmt(e.stl)} SPG, ${fmt(e.blk)} BPG over ${gp} games.`;
    } else if (entries.length > 1) {
      context = `Winners: ${entries.map(e => `${e.player_name} (${e.team_name})`).join(', ')}.`;
    }
    prompt = `Write a 2-3 sentence award announcement for the Season ${season} ${LABELS[award_type]} award in the WKND Basketball League. ${context} Write it like a sports broadcaster presenting the award — exciting, specific, and confident. No generic filler. Each article should feel distinct — vary the opening angle and tone from other award articles. Do not open with "Ladies and gentlemen", "Congratulations", or any ceremonial greeting — jump straight into the content.`;
  }

  try {
    const result = await generateText(prompt, { max_tokens: 200 });
    if (!result?.text) throw new Error('No response');
    res.json({ text: result.text });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Generation failed' });
  }
});

app.get('/admin/site', requireAuth, (req, res) => {
  const seasons  = getLedgerSeasons();
  const quotas   = Object.fromEntries(seasons.map(s => [s, getSeasonQuota(s)]));
  const SECTION_KEYS = ['mvp','dpoy','all_wknd_1','all_wknd_2','all_wknd_def','scoring_champ','assists_leader','rebounds_leader','steals_leader','blocks_leader','three_pm_leader'];
  const settings = {
    awards_enabled:   getSetting('awards_enabled',   '1'),
    mvp_race_enabled: getSetting('mvp_race_enabled', '1'),
    reg_open:         getSetting('reg_open',         '0'),
    reg_deadline:     getSetting('reg_deadline',     ''),
    ...Object.fromEntries(SECTION_KEYS.map(k => [`award_show_${k}`, getSetting(`award_show_${k}`, '0')])),
  };
  res.send(renderAdminPage(req, {
    title: 'Site Settings',
    currentPath: '/admin/site',
    body: adminSiteBody({ seasons, quotas, settings }),
  }));
});

app.post('/admin/site/settings', requireAuth, express.json(), (req, res) => {
  const staticAllowed = new Set([
    'mvp_race_enabled', 'awards_enabled',
    'award_show_mvp', 'award_show_dpoy',
    'award_show_all_wknd_1', 'award_show_all_wknd_2', 'award_show_all_wknd_def',
    'award_show_scoring_champ', 'award_show_assists_leader', 'award_show_rebounds_leader',
    'award_show_steals_leader', 'award_show_blocks_leader', 'award_show_three_pm_leader',
    'reg_open', 'reg_deadline',
  ]);
  const articleKeyRe = /^award_article_(mvp|dpoy|all_wknd_1|all_wknd_2|all_wknd_def|scoring_champ|assists_leader|rebounds_leader|steals_leader|blocks_leader|three_pm_leader)(_[\w-]+)?_\d+$/;
  for (const [key, value] of Object.entries(req.body || {})) {
    if (staticAllowed.has(key) || articleKeyRe.test(key)) setSetting(key, String(value));
  }
  res.json({ ok: true });
});

app.get('/admin/ledger', requireAuth, (req, res) => {
  const players  = getAllPlayers();
  const seasons  = getLedgerSeasons();
  const season   = req.query.season ?? '';
  const quota    = season ? getSeasonQuota(season) : 0;
  const summary  = season ? getSeasonSummary(season) : getAllSummary();
  const balMap   = Object.fromEntries(
    (season ? getSeasonBalances(season) : getAllBalances()).map(r => [r.player_id, r])
  );
  const allTx    = season ? getAllTransactionsBySeason(season) : getAllTransactions();
  const txByPlayer = {};
  for (const tx of allTx) (txByPlayer[tx.player_id] ??= []).push(tx);
  res.send(renderAdminPage(req, {
    title: 'Player Ledger',
    currentPath: '/admin/ledger',
    body: adminLedgerBody({ players, txByPlayer, seasons, season, quota, summary, balMap }),
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

app.post('/admin/ledger/transaction', requireAuth, express.json(), (req, res) => {
  const { player_id, amount, type, payment_method, date, status, notes, reference_no, season, category } = req.body;
  if (!player_id || !amount || !date) return res.status(400).json({ error: 'player_id, amount, and date are required.' });
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Amount must be a positive number.' });
  if (!['payment', 'charge'].includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' });
  if (!['confirmed', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const id = randomBytes(6).toString('hex');
  recordTransaction({ id, player_id, amount: parsed, type, payment_method: payment_method || '', date, status, notes: notes || '', reference_no: reference_no || '', season: season || '', category: category || '' });
  res.json({ ok: true, id });
});


app.post('/admin/ledger/transaction/:id/confirm', requireAuth, (req, res) => {
  const ok = confirmTransaction(req.params.id);
  if (!ok) return res.status(400).json({ error: 'Transaction not found or not pending.' });
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
  for (const pid of player_ids) {
    const id = randomBytes(6).toString('hex');
    recordTransaction({ id, player_id: pid, amount: parsed, type: type || 'charge', payment_method: payment_method || '', date, status: status || 'confirmed', notes: notes || '', reference_no: '', season: season || '', category: category || '' });
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

app.get('/admin/ledger/quota/:season', requireAuth, (req, res) => {
  res.json({ amount: getSeasonQuota(req.params.season) });
});

app.post('/admin/ledger/quota/:season', requireAuth, express.json(), (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'Invalid amount.' });
  setSeasonQuota(req.params.season, amount);
  res.json({ ok: true });
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
  const seasons = getGameSeasons();
  const season  = req.query.season || '';
  const rating  = getPlayerRating(player.id, season || null);
  const stats   = getOnePlayerStats(player.id, season || null);
  const teams   = getAllTeams();
  res.send(renderAdminPage(req, {
    title: displayPlayerName(player.name),
    currentPath: '/admin/players',
    body: adminPlayerDetailBody({ player, rating, stats, seasons, season, teams }),
  }));
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

app.post('/admin/players/:id/photo', requireAuth, express.json({ limit: '8mb' }), (req, res) => {
  const player = getPlayerWithTeam(req.params.id);
  if (!player) return res.status(404).json({ error: 'Not found' });
  const dataUrl = String(req.body.dataUrl || '');
  if (!dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  updatePlayerPhoto(player.id, dataUrl);
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

  const regBanner = getSetting('reg_open', '0') === '1'
    ? { deadline: getSetting('reg_deadline', '') }
    : null;

  res.send(renderPage(req, {
    title: 'WKND Basketball League',
    currentPath: req.path,
    body: homePage({ teams, players, games, highlights, leaderPlayers, regBanner })
  }));
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

  res.send(renderPage(req, {
    title: `${pageTitle} — WKND Basketball League`,
    currentPath: req.path,
    metaTags: buildGameOgTags(req, game),
    body: gamePage({ game, stats, dnpPlayers, potgPlayerId, quarterScores, allGames, playerMap, teamMap })
  }));
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
const jsonLarge = express.json({ limit: '8mb' });

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
    `Date: ${game.date}  |  Season ${game.season}  |  ${game.game_type === 'playoff' ? `PLAYOFF${game.playoff_round ? ' – ' + game.playoff_round : ''}` : 'Regular Season'}${isOT ? '  |  OVERTIME' : ''}`,
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
    `Game type: ${game.game_type === 'playoff' ? `PLAYOFF${game.playoff_round ? ' – ' + game.playoff_round : ''}` : 'Regular Season'}`,
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

  const highlights = buildHighlights(completedGames, playerMap, teamMap, 10);

  res.send(renderPage(req, {
    title: 'Games — WKND Basketball League',
    currentPath: req.path,
    body: gamesPage({ games, highlights })
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
  const season = getCurrentSeason()?.season ?? 1;
  const standings = getSeasonStandings(season);
  const games = getPlayoffGames(season);
  res.send(renderPage(req, {
    title: 'Playoffs — WKND Basketball League',
    currentPath: req.path,
    body: playoffsPage({ standings, games, season })
  }));
});

app.use(express.json());

// ── Roster endpoint (consumed by wknd-stats before each live game) ────────────
app.get('/api/roster', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.key;
  if (ROSTER_API_KEY && key !== ROSTER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const teams   = getAllTeams();
  const players = getAllPlayers();
  const { season } = getCurrentSeason() || { season: 3 };

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

app.get('/awards', (req, res) => {
  if (getSetting('awards_enabled', '1') === '0') return res.status(404).send(
    renderPage(req, { title: 'Not Found', currentPath: '/awards', body: '<div class="container"><p style="padding:40px;color:var(--text-muted)">Page not found.</p></div>' })
  );
  const { season: currentSeason } = getCurrentSeason() || {};
  const season = Number(req.query.season) || currentSeason || 3;
  const awards = getSeasonAwards(season);
  const availableSeasons = getAwardSeasons();
  const leagueStats = getSeasonPlayerStats(season);
  // Use same candidate source as /mvp so both ladders show identical players and scores.
  const mvpCandidates = getMvpCandidates(season)
    .map(s => ({ ...s, mvpScore: computeMvpScore(s) }))
    .filter(s => s.gp >= 1)
    .sort((a, b) => b.mvpScore - a.mvpScore);
  const SECTION_KEYS = ['mvp','dpoy','all_wknd_1','all_wknd_2','all_wknd_def','scoring_champ','assists_leader','rebounds_leader','steals_leader','blocks_leader','three_pm_leader'];
  const visibleSections = new Set(SECTION_KEYS.filter(k => getSetting(`award_show_${k}`, '0') !== '0'));
  const articles = Object.fromEntries(SECTION_KEYS.map(k => [k, getSetting(`award_article_${k}_${season}`, '')]));
  for (const award of awards) {
    if (['all_wknd_1', 'all_wknd_2', 'all_wknd_def'].includes(award.award_type)) {
      const key = `${award.award_type}_${award.player_id}`;
      articles[key] = getSetting(`award_article_${key}_${season}`, '');
    }
  }
  res.send(renderPage(req, {
    title: `Season ${season} Awards — WKND Basketball`,
    currentPath: '/awards',
    body: awardsPage({ awards, season, availableSeasons, visibleSections, articles, leagueStats, mvpCandidates }),
  }));
});

app.post('/admin/mvp/regenerate', requireAuth, express.json(), (req, res) => {
  const { player_id, season } = req.body || {};
  if (player_id) deleteMvpWriteupForPlayer(player_id, season);
  else           clearMvpWriteupSeason(season);
  res.json({ ok: true });
});

app.get('/mvp', async (req, res) => {
  if (getSetting('mvp_race_enabled', '1') === '0') return res.status(404).send(
    renderPage(req, { title: 'Not Found', currentPath: '/mvp', body: '<div class="container"><p style="padding:40px;color:var(--text-muted)">Page not found.</p></div>' })
  );
  const { season } = getCurrentSeason() || {};
  const currentSeason = season || 3;
  const raw = getMvpCandidates(currentSeason);
  const totalGames = getTotalSeasonGamesForMvp(currentSeason);

  const allPlayers = getAllPlayers();
  const allTeams   = getAllTeams();
  const allGames   = byDate(getAllGames());
  const playerMap  = Object.fromEntries(allPlayers.map(p => [p.id, p]));
  const teamMap    = Object.fromEntries(allTeams.map(t => [t.id, t]));
  const completedGames = allGames.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const highlights = buildHighlights(completedGames, playerMap, teamMap, 10);

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

  // Fetch or generate writeups for top candidates
  const withWriteups = await Promise.all(scored.map(async c => {
    const statsKey = mvpStatsKey(c.stats);
    const cached   = getMvpWriteup(c.player.id, currentSeason, statsKey);
    if (cached) return { ...c, writeup: cached };

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

      const prompt = `You are a sharp basketball analyst covering WKND Basketball League, a recreational league. Write a 2-3 sentence MVP case for ${name} (${String(c.stats.team_name).toUpperCase()}) in the style of an ESPN MVP ladder entry. Be specific with numbers. Focus on what makes them a real MVP candidate — production, efficiency, winning.

Rules:
- Do NOT start with their name.
- Do NOT open with "With a" or "With an" — vary the sentence structure completely.
- Each player's blurb must read differently from the others. Lead with the most interesting or unusual thing about this player's case.
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
    title: 'MVP Race — WKND Basketball League',
    currentPath: req.path,
    metaTags: buildMvpOgTags(req, withWriteups, currentSeason),
    body: mvpPage({
      candidates: withWriteups,
      season: currentSeason,
      totalGames,
      seasonGames: SEASON_GAMES_PER_TEAM,
      highlights,
      teams: allTeams,
      games: completedGames,
      leagueStats: allQualified,
      isAdmin: !!req.session?.isAdmin,
    }),
  }));
});

app.get('/leaders', (req, res) => {
  const players     = buildLeaderPlayers();
  const { season }  = getCurrentSeason() || {};
  const gameRecords = getGameRecords();
  const weekNum     = season ? (getSeasonLatestWeek(season)?.week ?? null) : null;
  const asOfLabel   = weekNum ? `S${season} · WK ${weekNum}` : '';
  res.send(renderPage(req, {
    title: 'League Leaders — WKND Basketball League',
    currentPath: req.path,
    body: leadersPage({ players, season: String(season || ''), gameRecords, currentSeason: season || 3, asOfLabel, isLoggedIn: !!(req.session?.isAdmin || req.session?.playerRegId) })
  }));
});

app.get('/roast', (req, res) => {
  const players          = buildLeaderPlayers();
  const { season }       = getCurrentSeason() || {};
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

app.get('/players/:ref', (req, res) => {
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

  res.send(renderPage(req, {
    title: `${displayName} — WKND Basketball`,
    currentPath: '/players',
    metaTags: buildPlayerOgTags(req, player, totals),
    body: playerPage({ player, totals, statsByType, gameLogs, potgGames, careerHighs, awards, financialSection, isAdmin: !!req.session?.isAdmin })
  }));
});

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
  res.send(layout({
    title: 'Join WKND Basketball',
    currentPath: '/register',
    body: registerPage(),
  }));
});

app.post('/register', (req, res) => {
  const { first_name, last_name, email, phone, birthday, positions, height, weight,
          jersey_pref, dominant_hand, experience, referred_by,
          emergency_name, emergency_phone, motto, gender, agree } = req.body;

  const prefill = { first_name, last_name, email, phone, birthday, height, weight,
                    jersey_pref, dominant_hand, experience, referred_by,
                    emergency_name, emergency_phone, motto, gender };

  // Validate required fields
  if (!first_name?.trim() || !last_name?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'First and last name are required.', prefill }) }));
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'A valid email address is required.', prefill }) }));
  }
  if (!phone?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Phone number is required.', prefill }) }));
  }
  if (!birthday?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Birthday is required.', prefill }) }));
  }
  const posArr = Array.isArray(positions) ? positions : (positions ? [positions] : []);
  if (posArr.length === 0) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Please select at least one position.', prefill }) }));
  }
  if (!height?.toString().trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Height is required.', prefill }) }));
  }
  if (!weight?.toString().trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Weight is required.', prefill }) }));
  }
  if (!dominant_hand?.trim()) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Dominant hand is required.', prefill }) }));
  }
  if (!agree) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'Please confirm the agreement to continue.', prefill }) }));
  }

  // Check for duplicate email
  const existing = getRegistrationByEmail(email.trim().toLowerCase());
  if (existing) {
    return res.send(layout({ title: 'Join WKND Basketball', currentPath: '/register',
      body: registerPage({ error: 'This email has already been registered. Contact an admin if you need help.', prefill }) }));
  }

  const full_name = `${last_name.trim().toUpperCase()}, ${first_name.trim()}`;

  insertRegistration({
    id: crypto.randomUUID(),
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
  });

  res.send(layout({ title: 'Registration Received', currentPath: '/register',
    body: registerPage({ success: true }) }));
});

app.listen(PORT, () => {
  console.log(`WKND Portal → http://localhost:${PORT}`);
  console.log(`DB: portal.db (self-hosted)`);
});
