import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual, createHash } from 'crypto';
import { statSync, existsSync } from 'fs';
import express from 'express';
import session from 'express-session';
import { parseWriteup } from './lib/writeup.js';
import sharp from 'sharp';
import { layout, escHtml } from './views/layout.js';
import { homePage } from './views/home.js';
import { gamesPage } from './views/games.js';
import { gamePage } from './views/game.js';
import { leadersPage, PER_GAME, TOTALS, fmtPerGame, fmtTotals, RECORD_CATS, recordContext } from './views/leaders.js';
import { standingsPage } from './views/standings.js';
import { comingSoonPage } from './views/coming-soon.js';
import { leaderSharePage } from './views/leader-share.js';
import { playerPage } from './views/player.js';
import { playersPage } from './views/players.js';
import { scoreTicker } from './views/ticker.js';
import { privacyPage, termsPage } from './views/legal.js';
import { teamColor, displayPlayerName } from './views/utils.js';
import {
  upsertShare, getShare, getSlugForEntity, getEntityForSlug, saveSlug,
  getAllFinancials, getAllTransactions, recordTransaction,
  getPlayerFinancials, getPlayerTransactions, confirmTransaction,
  getAllTeams, getAllPlayers, getAllGames, getGameCover,
  getTeamSeasonStats, getTeamRecords, getLeaders,
  getGameById, getGameDetailStats, getGameStats,
  getPlayerWithTeam, getPlayerById, getTeamById,
  getPlayerTotals, getPlayerGameLog, getPlayerPotgCandidates,
  getPlayerCareerHighs, getPlayerAwards, getGameDnpPlayers, getGameRecords,
  getPlayerPhoto, getCurrentSeason, getTickerGames,
  updateGameRecap, updateGameYoutube, updateGameCover, updatePlayerPhoto,
} from './lib/portal-db.js';
import { playerSlug, teamSlug, gameSlug } from './lib/slugs.js';
import { adminLoginBody } from './views/admin/login.js';
import { adminLedgerBody, playerFinancialSection } from './views/admin/ledger.js';

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

function buildTicker() {
  const games = getTickerGames();
  if (!games.length) return '';
  return scoreTicker(games);
}

function renderPage(req, opts) {
  return layout({ ...opts, ticker: buildTicker(), gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isAdmin: !!req.session?.isAdmin });
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

async function generateLeaderSvg(share) {
  const displayName  = formatName(share.player_name).toUpperCase();
  const teamName     = String(share.team_name || '').toUpperCase();
  const color        = share.team_color || '#f59332';
  const isLight      = teamName === 'WHITE';
  const chipTextCol  = isLight ? '#10141d' : '#fff';
  const statStr      = String(share.stat_fmt);
  const season       = escXml(String(share.season || ''));
  const modeLabel    = share.mode === 'pg' ? 'PER GAME' : share.mode === 'rec' ? 'SINGLE GAME' : 'TOTALS';

  const livePlayer = getPlayerPhoto(share.player_id);
  const photoUrl = await resolveAvatar(livePlayer?.picture_url);

  // ── Left pane: photo or stylized bg ───────────────────────────────────────
  const leftContent = photoUrl
    ? `<image x="0" y="0" width="600" height="630" href="${photoUrl}" clip-path="url(#lClip)" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="600" height="630" fill="${color}" opacity="0.05"/>
  <rect x="0" y="0" width="600" height="630" fill="url(#fadeR)"/>
  <rect x="0" y="0" width="600" height="630" fill="url(#fadeB)"/>`
    : `<rect x="0" y="0" width="600" height="630" fill="${color}" opacity="0.07"/>
  <circle cx="300" cy="295" r="270" fill="${color}" opacity="0.06"/>
  <circle cx="300" cy="295" r="180" fill="${color}" opacity="0.06"/>
  <text x="300" y="400" font-family="Arial,sans-serif" font-size="200" font-weight="800" fill="${color}" opacity="0.1" text-anchor="middle">${escXml(svgInitials(share.player_name))}</text>
  <rect x="0" y="0" width="600" height="630" fill="url(#fadeR)"/>
  <rect x="0" y="0" width="600" height="630" fill="url(#fadeB)"/>`;

  // ── Player name sizing ─────────────────────────────────────────────────────
  const nameFontSz = displayName.length > 20 ? 28 : displayName.length > 14 ? 34 : 40;
  const chipW      = Math.max(70, teamName.length * 9 + 36);
  const chipCx     = 40 + chipW / 2;

  // ── Stat sizing & dynamic Y positions ─────────────────────────────────────
  const statFontSz = statStr.length <= 4 ? 168 : statStr.length <= 6 ? 128 : 100;
  const statY      = 108 + Math.round(statFontSz * 0.82) + 22;
  const subtitleY  = statY + 22;
  const dividerY   = statY + 40;
  const top10LabelY = dividerY + 22;
  const rowStartY  = top10LabelY + 22;
  const ROW_H      = 26;

  // ── Top 10 rows ────────────────────────────────────────────────────────────
  let top10 = [];
  try { top10 = JSON.parse(share.top10_json || '[]'); } catch {}
  const maxVal  = top10[0]?.stat_value || 1;
  const BAR_X   = 888;
  const BAR_MAX = 248;
  const VAL_X   = 1162;

  const rowSvg = top10.map((p, i) => {
    const ry      = rowStartY + i * ROW_H;
    const isFirst = i === 0;
    const tc      = p.team_color || '#64748b';
    const barW    = maxVal > 0 ? Math.round(p.stat_value / maxVal * BAR_MAX) : 0;
    return `
  <text x="650" y="${ry}" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="${isFirst ? color : '#334155'}" text-anchor="end">${i + 1}</text>
  <circle cx="661" cy="${ry - 4}" r="4" fill="${tc}"/>
  <text x="674" y="${ry}" font-family="Arial,sans-serif" font-size="11" font-weight="${isFirst ? '700' : '400'}" fill="${isFirst ? '#e2e8f0' : '#64748b'}">${escXml(shortName(p.player_name).toUpperCase())}</text>
  <rect x="${BAR_X}" y="${ry - 9}" width="${barW}" height="5" rx="2" fill="${tc}" opacity="0.28"/>
  ${barW > 2 ? `<rect x="${BAR_X + barW - 2}" y="${ry - 9}" width="2" height="5" rx="1" fill="${tc}"/>` : ''}
  <text x="${VAL_X}" y="${ry}" font-family="Arial,sans-serif" font-size="${isFirst ? 12 : 11}" font-weight="${isFirst ? '700' : '400'}" fill="${isFirst ? '#e2e8f0' : '#475569'}" text-anchor="end">${escXml(p.stat_fmt)}</text>`;
  }).join('');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${photoUrl ? `<clipPath id="lClip"><rect width="600" height="630"/></clipPath>` : ''}
    <linearGradient id="fadeR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%"   stop-color="#020817" stop-opacity="1"/>
      <stop offset="25%"  stop-color="#020817" stop-opacity="0.92"/>
      <stop offset="55%"  stop-color="#020817" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#020817" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fadeB" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%"   stop-color="#020817" stop-opacity="0.96"/>
      <stop offset="35%"  stop-color="#020817" stop-opacity="0.55"/>
      <stop offset="65%"  stop-color="#020817" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%"   stop-color="${color}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#0d1424"/>
      <stop offset="100%" stop-color="#020817"/>
    </linearGradient>
  </defs>

  <!-- BG -->
  <rect width="1200" height="630" fill="#020817"/>

  <!-- LEFT SECTION -->
  ${leftContent}
  <rect x="0" y="0" width="5" height="630" fill="${color}"/>

  <!-- Player name + chip (bottom-left) -->
  <text x="36" y="566" font-family="Arial,sans-serif" font-size="${nameFontSz}" font-weight="800" fill="#ffffff">${escXml(displayName)}</text>
  <rect x="36" y="580" width="${chipW}" height="26" rx="13" fill="${color}" opacity="0.22"/>
  <rect x="36" y="580" width="${chipW}" height="26" rx="13" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
  <text x="${chipCx}" y="598" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="2">${escXml(teamName)}</text>

  <!-- RIGHT SECTION bg -->
  <rect x="596" y="0" width="604" height="630" fill="url(#rBg)"/>
  <!-- Color glow -->
  <ellipse cx="900" cy="200" rx="320" ry="240" fill="url(#glow)"/>
  <!-- Top accent bar -->
  <rect x="630" y="0" width="540" height="4" fill="${color}"/>
  <!-- Subtle color wash under the bar -->
  <rect x="630" y="4" width="540" height="50" fill="${color}" opacity="0.04"/>

  <!-- League + season -->
  <text x="644" y="44" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#475569" letter-spacing="3">WKND BASKETBALL LEAGUE</text>
  <text x="644" y="63" font-family="Arial,sans-serif" font-size="10" fill="#1e293b" letter-spacing="3">SEASON ${season} · ${escXml(modeLabel)}</text>

  <!-- Category label -->
  <text x="644" y="108" font-family="Arial,sans-serif" font-size="13" font-weight="800" fill="${color}" letter-spacing="5">${escXml(share.stat_label)} LEADER</text>

  <!-- GIANT stat -->
  <text x="630" y="${statY}" font-family="Arial,sans-serif" font-size="${statFontSz}" font-weight="800" fill="#ffffff" letter-spacing="-2">${escXml(statStr)}</text>

  <!-- Stat subtitle -->
  <text x="644" y="${subtitleY}" font-family="Arial,sans-serif" font-size="11" fill="#334155" letter-spacing="4">${escXml(share.stat_title.toUpperCase())}</text>

  <!-- Divider -->
  <line x1="644" y1="${dividerY}" x2="1162" y2="${dividerY}" stroke="#1e293b" stroke-width="1"/>

  <!-- TOP 10 label -->
  <text x="644" y="${top10LabelY}" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#1e293b" letter-spacing="5">TOP 10 RANKINGS</text>

  <!-- Rows -->
  ${rowSvg}

  <!-- Watermark -->
  <text x="1162" y="618" font-family="Arial,sans-serif" font-size="11" fill="#1e293b" text-anchor="end" letter-spacing="1">wkndbasketball.com</text>
</svg>`;
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

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.redirect('/login');
}

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

  const layers = [{ input: overlaySvg, top: 0, left: 0 }];
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
    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
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
  if (req.session?.isAdmin) return res.redirect('/');
  res.send(renderPage(req, { title: 'Sign In — WKND Portal', currentPath: '/login', body: adminLoginBody() }));
});

app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body;
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    return res.redirect('/');
  }
  res.send(renderPage(req, { title: 'Sign In — WKND Portal', currentPath: '/login', body: adminLoginBody({ error: 'Invalid username or password.' }) }));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/admin/ledger', requireAuth, (req, res) => {
  const players = getAllPlayers();
  const financials = getAllFinancials();
  const allTx = getAllTransactions();
  const txByPlayer = {};
  for (const tx of allTx) {
    (txByPlayer[tx.player_id] ??= []).push(tx);
  }
  res.send(renderPage(req, {
    title: 'Player Ledger — WKND Admin',
    currentPath: '/admin/ledger',
    body: adminLedgerBody({ players, financials, txByPlayer }),
  }));
});

app.post('/admin/ledger/transaction', requireAuth, express.json(), (req, res) => {
  const { player_id, amount, type, payment_method, date, status, notes, reference_no } = req.body;
  if (!player_id || !amount || !date) {
    return res.status(400).json({ error: 'player_id, amount, and date are required.' });
  }
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }
  if (!['payment', 'charge'].includes(type)) {
    return res.status(400).json({ error: 'Invalid transaction type.' });
  }
  if (!['confirmed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const id = randomBytes(6).toString('hex');
  recordTransaction({ id, player_id, amount: parsed, type, payment_method: payment_method || '', date, status, notes: notes || '', reference_no: reference_no || '' });
  res.json({ ok: true, id });
});

app.post('/admin/ledger/transaction/:id/confirm', requireAuth, (req, res) => {
  const ok = confirmTransaction(req.params.id);
  if (!ok) return res.status(400).json({ error: 'Transaction not found or not pending.' });
  res.json({ ok: true });
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

  res.send(renderPage(req, {
    title: 'WKND Basketball League',
    currentPath: req.path,
    body: homePage({ teams, players, games, highlights, leaderPlayers })
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
    body: gamePage({ game, stats, dnpPlayers, potgPlayerId, quarterScores, allGames, playerMap, teamMap, isAdmin: !!req.session?.isAdmin })
  }));
});

// ── Admin game endpoints ──────────────────────────────────────────────────────
const jsonSmall = express.json();
const jsonLarge = express.json({ limit: '8mb' });

app.post('/admin/games/:id/recap', requireAuth, jsonSmall, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  updateGameRecap(game.id, String(req.body.writeup || ''));
  res.json({ ok: true });
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
  const title       = `${displayName} · ${share.stat_label} Leader — WKND Basketball`;
  const desc        = `${displayName} leads the league in ${share.stat_title} with ${share.stat_fmt} this season.`;
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
    const svg = await generateLeaderSvg(share);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.end(png);
  } catch (err) {
    console.error('Leader share image error:', err);
    res.status(500).end();
  }
});

app.get('/leaders', (req, res) => {
  const players     = buildLeaderPlayers();
  const { season }  = getCurrentSeason() || {};
  const gameRecords = getGameRecords();
  res.send(renderPage(req, {
    title: 'League Leaders — WKND Basketball League',
    currentPath: req.path,
    body: leadersPage({ players, season: String(season || ''), gameRecords, currentSeason: season || 3 })
  }));
});

app.get('/teams', (req, res) => {
  res.send(renderPage(req, {
    title: 'Teams — WKND Basketball League',
    currentPath: req.path,
    body: comingSoonPage({ label: 'Teams', description: 'Team rosters, stats, and season averages are on their way.' })
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
    body: playersPage({ players })
  }));
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
    body: playerPage({ player, totals, gameLogs, potgGames, careerHighs, awards, financialSection, isAdmin: !!req.session?.isAdmin })
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

app.listen(PORT, () => {
  console.log(`WKND Portal → http://localhost:${PORT}`);
  console.log(`DB: portal.db (self-hosted)`);
});
