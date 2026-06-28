import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual } from 'crypto';
import { statSync } from 'fs';
import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { layout } from './views/layout.js';
import { homePage } from './views/home.js';
import { gamesPage } from './views/games.js';
import { gamePage } from './views/game.js';
import { leadersPage, PER_GAME, TOTALS, fmtPerGame, fmtTotals } from './views/leaders.js';
import { standingsPage } from './views/standings.js';
import { comingSoonPage } from './views/coming-soon.js';
import { leaderSharePage } from './views/leader-share.js';
import { playerPage } from './views/player.js';
import { privacyPage, termsPage } from './views/legal.js';
import { teamColor, displayPlayerName } from './views/utils.js';
import { upsertShare, getShare, getSlugForEntity, getEntityForSlug, saveSlug } from './lib/portal-db.js';
import { playerSlug, teamSlug, gameSlug } from './lib/slugs.js';
import { adminLoginBody } from './views/admin/login.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSS_VER = (() => { try { return statSync(path.join(__dirname, 'public/styles.css')).mtimeMs | 0; } catch { return Date.now(); } })();

const PORT = process.env.PORT || 4000;
const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || '../wknd-stats/data/wknd-stats.db');
const GA_MEASUREMENT_ID = String(process.env.GA_MEASUREMENT_ID || '').trim();
const ADMIN_URL = String(process.env.ADMIN_URL || 'http://localhost:3000').replace(/\/$/, '');
const PORTAL_ADMIN_USER = process.env.PORTAL_ADMIN_USER || 'admin';
const PORTAL_ADMIN_PASS = process.env.PORTAL_ADMIN_PASS || '';
const SESSION_SECRET    = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

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
  const m = String(text || '').match(/\*\*(.+?)\*\*/);
  return m ? m[1].trim() : null;
}

function writeupDescription(text) {
  return String(text || '')
    .replace(/^\s*\*\*.*?\*\*\s*\n?/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function buildGameOgTags(req, game) {
  const origin = getRequestOrigin(req);
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const isCompleted = scoreA + scoreB > 0;
  const recapTitle = writeupTitle(game.game_writeup);
  const title      = recapTitle || `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name} · Game Recap`;
  const url        = `${origin}/games/${encodeURIComponent(gameSlug(game))}`;
  const desc       = writeupDescription(game.game_writeup) || 'Game recap, box score, and player stats from WKND Basketball League.';
  const scoreLabel = `${game.team_a_name} ${scoreA} – ${scoreB} ${game.team_b_name}`;
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
      `<meta property="og:image:alt" content="${escAttr(scoreLabel + ' · WKND Basketball')}">`,
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
      `<meta name="twitter:image:alt" content="${escAttr(scoreLabel)}">`,
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
  const img     = hasPhoto ? `${origin}/api/player/${encodeURIComponent(player.id)}/photo` : null;

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

function renderPage(req, opts) {
  return layout({ ...opts, gaSnippet: buildGaSnippet(req), cssVer: CSS_VER, isAdmin: !!req.session?.isAdmin });
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
  const modeLabel    = share.mode === 'pg' ? 'PER GAME' : 'TOTALS';

  const livePlayer = db.prepare('SELECT picture_url FROM players WHERE id = ?').get(share.player_id);
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

const db = new Database(DB_PATH, { readonly: true });

const selectTeamsStmt = db.prepare('SELECT id, name, color FROM teams ORDER BY sort_order ASC, id ASC');

const selectPlayersStmt = db.prepare(`
  SELECT p.id, p.team_id, p.name, p.number, p.positions, p.picture_url,
         COALESCE(t.games_played, 0) AS games_played,
         COALESCE(t.pts, 0) AS pts,
         COALESCE(t.ast, 0) AS ast,
         COALESCE(t.reb, 0) AS reb,
         COALESCE(t.stl, 0) AS stl,
         COALESCE(t.blk, 0) AS blk,
         COALESCE(t.fg2m, 0) AS fg2m,
         COALESCE(t.fg3m, 0) AS fg3m,
         COALESCE(t.fg2m_miss, 0) AS fg2m_miss,
         COALESCE(t.fg3m_miss, 0) AS fg3m_miss,
         COALESCE(t.ftm, 0) AS ftm,
         COALESCE(t.ft_miss, 0) AS ft_miss,
         COALESCE(t.turnover, 0) AS turnover,
         COALESCE(t.pf, 0) AS pf
  FROM players p
  LEFT JOIN player_totals t ON t.player_id = p.id
  ORDER BY p.sort_order ASC, p.id ASC
`);

const selectGamesStmt = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, series_id, youtube_url, scheduled,
         (COALESCE(LENGTH(social_cover_data_url), 0) > 0) AS has_cover
  FROM games
  ORDER BY date DESC, id DESC
`);

const selectGameCoverStmt = db.prepare('SELECT social_cover_data_url FROM games WHERE id = ?');

const selectTeamSeasonStatsStmt = db.prepare(`
  SELECT gps.team_id, t.name AS team_name,
         COUNT(DISTINCT gps.game_id)                                    AS gp,
         COALESCE(SUM(gps.pts), 0)                                      AS pts,
         COALESCE(SUM(gps.reb), 0)                                      AS reb,
         COALESCE(SUM(gps.ast), 0)                                      AS ast,
         COALESCE(SUM(gps.stl), 0)                                      AS stl,
         COALESCE(SUM(gps.blk), 0)                                      AS blk,
         COALESCE(SUM(gps.fg3m), 0)                                     AS fg3m,
         COALESCE(SUM(gps.fg2m + gps.fg3m), 0)                         AS fgm,
         COALESCE(SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss), 0) AS fga,
         COALESCE(SUM(gps.fg3m + gps.fg3m_miss), 0)                   AS fg3a,
         COALESCE(SUM(gps.ftm), 0)                                     AS ftm,
         COALESCE(SUM(gps.ft_miss), 0)                                 AS ft_miss,
         COALESCE(SUM(gps.turnover), 0)                                AS turnover,
         COALESCE(SUM(gps.pf), 0)                                      AS pf
  FROM game_player_stats gps
  JOIN teams t ON t.id = gps.team_id
  JOIN games g  ON g.id = gps.game_id
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
    AND g.game_type = 'regular' AND g.under_review = 0
  GROUP BY gps.team_id, t.name
  ORDER BY t.sort_order ASC
`);

const selectCurrentSeasonTeamRecordsStmt = db.prepare(`
  SELECT team_id,
         SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
  FROM (
    SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
      AND game_type = 'regular' AND under_review = 0
    UNION ALL
    SELECT team_b_id, team_b_score, team_a_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
      AND game_type = 'regular' AND under_review = 0
  )
  GROUP BY team_id
`);

const selectLeadersStmt = db.prepare(`
  SELECT p.id, p.name, p.team_id, p.picture_url,
         tm.name AS team_name,
         COUNT(DISTINCT gps.game_id) AS games_played,
         COALESCE(SUM(gps.pts), 0)         AS pts,
         COALESCE(SUM(gps.ast), 0)         AS ast,
         COALESCE(SUM(gps.reb), 0)         AS reb,
         COALESCE(SUM(gps.stl), 0)         AS stl,
         COALESCE(SUM(gps.blk), 0)         AS blk,
         COALESCE(SUM(gps.turnover), 0)    AS turnover,
         COALESCE(SUM(gps.pf), 0)          AS pf,
         COALESCE(SUM(gps.fg2m), 0)        AS fg2m,
         COALESCE(SUM(gps.fg3m), 0)        AS fg3m,
         COALESCE(SUM(gps.fg2m_miss), 0)   AS fg2m_miss,
         COALESCE(SUM(gps.fg3m_miss), 0)   AS fg3m_miss,
         COALESCE(SUM(gps.ftm), 0)         AS ftm,
         COALESCE(SUM(gps.ft_miss), 0)     AS ft_miss
  FROM players p
  JOIN teams tm ON tm.id = p.team_id
  JOIN game_player_stats gps ON gps.player_id = p.id
  JOIN games g ON g.id = gps.game_id
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND under_review = 0)
    AND g.game_type = 'regular'
    AND g.under_review = 0
  GROUP BY p.id, p.name, p.team_id, tm.name
  ORDER BY p.sort_order ASC, p.id ASC
`);

const selectGameByIdStmt = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, youtube_url, period_snapshots_json, dnp_players_json, game_log_json,
         (COALESCE(LENGTH(social_cover_data_url), 0) > 0) AS has_cover
  FROM games WHERE id = ?
`);

const selectGameDetailStatsStmt = db.prepare(`
  SELECT gps.player_id, gps.team_id,
         gps.pts, gps.ast, gps.reb, gps.stl, gps.blk, gps.turnover, gps.pf,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss, gps.minutes,
         p.name, p.number,
         t.name AS team_name
  FROM game_player_stats gps
  JOIN players p ON p.id = gps.player_id
  JOIN teams t ON t.id = gps.team_id
  WHERE gps.game_id = ?
  ORDER BY gps.pts DESC
`);

const selectGameStatsStmt = db.prepare(`
  SELECT player_id, team_id, pts, ast, reb, stl, blk, turnover,
         fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes
  FROM game_player_stats
  WHERE game_id = ?
  ORDER BY pts DESC
`);

const selectPlayerWithTeamStmt = db.prepare(`
  SELECT p.*, t.name AS team_name
  FROM players p JOIN teams t ON t.id = p.team_id
  WHERE p.id = ?
`);

const selectPlayerTotalsStmt = db.prepare(
  'SELECT * FROM player_totals WHERE player_id = ?'
);

const selectPlayerGameLogStmt = db.prepare(`
  SELECT g.id, g.date, g.season, g.game_type,
         g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score,
         g.manual_potg_player_id,
         gps.team_id AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss,
         gps.ftm, gps.ft_miss, gps.turnover, gps.pf
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND g.under_review = 0
  ORDER BY g.id DESC
`);

// All games with a potg_writeup that this player participated in.
// Filtered in JS via derivePotgPlayerId to avoid SQL approximation.
const selectPlayerPotgCandidatesStmt = db.prepare(`
  SELECT g.id, g.date, g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score, g.potg_writeup,
         g.manual_potg_player_id,
         gps.team_id AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss
  FROM games g
  JOIN game_player_stats gps ON gps.game_id = g.id AND gps.player_id = @id
  WHERE g.under_review = 0
    AND g.potg_writeup IS NOT NULL AND g.potg_writeup != ''
  ORDER BY g.id DESC
`);

const selectPlayerCareerHighsStmt = db.prepare(`
  SELECT MAX(pts) AS pts, MAX(reb) AS reb, MAX(ast) AS ast,
         MAX(stl) AS stl, MAX(blk) AS blk, MAX(fg3m) AS fg3m
  FROM game_player_stats WHERE player_id = ?
`);

const selectPlayerAwardsStmt = db.prepare(
  'SELECT * FROM awards WHERE player_id = ? ORDER BY season DESC'
);

const selectPlayerDnpGamesStmt = db.prepare(`
  SELECT g.id, g.date, g.season, g.game_type,
         g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score
  FROM games g
  WHERE g.under_review = 0
    AND (g.team_a_id = :teamId OR g.team_b_id = :teamId)
    AND NOT EXISTS (
      SELECT 1 FROM game_player_stats gps
      WHERE gps.game_id = g.id AND gps.player_id = :playerId
    )
  ORDER BY g.id DESC
`);

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
  const players = selectLeadersStmt.all();
  const records = selectCurrentSeasonTeamRecordsStmt.all();
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
    const stats = selectGameStatsStmt.all(g.id);
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

async function serveCover(req, res) {
  const gameId = req.params.gameId;
  try {
    const upstream = await fetch(
      `${ADMIN_URL}/api/social-cover/${encodeURIComponent(gameId)}.png`,
      { headers: { 'User-Agent': 'wknd-portal/cover-proxy' }, signal: AbortSignal.timeout(10000) }
    );
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.end(buf);
  } catch {
    res.status(502).end();
  }
}

app.get('/api/cover/:gameId.png', serveCover);
app.get('/api/cover/:gameId',     serveCover);

app.get('/api/photo/:gameId', async (req, res) => {
  try {
    const upstream = await fetch(
      `${ADMIN_URL}/api/social-cover/${encodeURIComponent(req.params.gameId)}/photo.jpg`,
      { headers: { 'User-Agent': 'wknd-portal/photo-proxy' }, signal: AbortSignal.timeout(10000) }
    );
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.end(buf);
  } catch {
    res.status(502).end();
  }
});

const selectPlayerPhotoStmt = db.prepare('SELECT picture_url FROM players WHERE id = ?');

app.get('/api/player/:id/photo', async (req, res) => {
  const row = selectPlayerPhotoStmt.get(req.params.id);
  const url = row?.picture_url;
  if (!url) return res.status(404).end();
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    const mime  = (url.slice(0, comma).match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
    const buf   = Buffer.from(url.slice(comma + 1), 'base64');
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=3600');
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

// ── Public routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = byDate(selectGamesStmt.all());

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
    ref => selectGameByIdStmt.get(ref),
    g   => gameSlug(g)
  );
  if (!resolved) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: req.path, body: '<p style="padding:40px;color:var(--text-muted)">Game not found.</p>' })
  );
  if (resolved.slug) return res.redirect(302, `/games/${resolved.slug}`);

  const game = selectGameByIdStmt.get(resolved.id);
  if (!game || game.under_review) return res.status(404).send(
    layout({ title: 'Not Found', currentPath: req.path, body: '<p style="padding:40px;color:var(--text-muted)">Game not found.</p>' })
  );

  const stats = selectGameDetailStatsStmt.all(game.id);
  const potgPlayerId = game.manual_potg_player_id || derivePotgPlayerId(game, stats);
  const quarterScores = extractQuarterScores(game);

  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const allGames = selectGamesStmt.all();
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const title = `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;

  res.send(renderPage(req, {
    title: `${title} — WKND Basketball League`,
    currentPath: req.path,
    metaTags: buildGameOgTags(req, game),
    body: gamePage({ game, stats, potgPlayerId, quarterScores, allGames, playerMap, teamMap })
  }));
});

app.get('/games', (req, res) => {
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = byDate(selectGamesStmt.all());

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
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = byDate(selectGamesStmt.all());
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const completedGames = games.filter(g =>
    !g.scheduled && !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const highlights = buildHighlights(completedGames, playerMap, teamMap);
  const teamStats = selectTeamSeasonStatsStmt.all();
  res.send(renderPage(req, {
    title: 'Standings — WKND Basketball League',
    currentPath: req.path,
    body: standingsPage({ teams, games, highlights, teamStats })
  }));
});

const selectCurrentSeasonStmt = db.prepare(
  `SELECT MAX(season) AS season FROM games WHERE game_type = 'regular' AND under_review = 0`
);

app.use(express.json());

app.post('/api/leaders/share', (req, res) => {
  const { season, category_id, mode, player_id, player_name, team_id,
          team_name, team_color, stat_label, stat_title, stat_value, stat_fmt } = req.body || {};
  if (!season || !category_id || !mode || !player_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Compute top 10 + leader photo server-side for the share image
  const allCats    = mode === 'pg' ? PER_GAME : TOTALS;
  const cat        = allCats.find(c => c.id === category_id);
  const defaultFmt = mode === 'pg' ? fmtPerGame : fmtTotals;
  const fmt        = cat?.fmt || defaultFmt;
  const allPlayers = buildLeaderPlayers();
  const top10 = cat
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

  const leaderPlayer = allPlayers.find(p => p.id === player_id);

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
  const players = buildLeaderPlayers();
  const { season } = selectCurrentSeasonStmt.get() || {};
  res.send(renderPage(req, {
    title: 'League Leaders — WKND Basketball League',
    currentPath: req.path,
    body: leadersPage({ players, season: String(season || '') })
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
    ref => db.prepare('SELECT * FROM teams WHERE id = ?').get(ref),
    t   => teamSlug(t)
  );
  if (!resolved) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/teams',
    body: comingSoonPage({ label: 'Team Not Found', description: 'This team could not be found.' })
  }));
  if (resolved.slug) return res.redirect(302, `/teams/${resolved.slug}`);

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(resolved.id);
  res.send(renderPage(req, {
    title: `${String(team.name).toUpperCase()} — WKND Basketball`,
    currentPath: '/teams',
    metaTags: buildTeamOgTags(req, team),
    body: comingSoonPage({ label: team.name, description: 'Team rosters, stats, and season averages are on their way.' })
  }));
});

app.get('/players', (req, res) => {
  res.send(renderPage(req, {
    title: 'Players — WKND Basketball League',
    currentPath: req.path,
    body: comingSoonPage({ label: 'Players', description: 'Full player profiles and career stats are on their way.' })
  }));
});

app.get('/players/:ref', (req, res) => {
  const resolved = resolveRef('player', req.params.ref,
    ref => db.prepare('SELECT * FROM players WHERE id = ?').get(ref),
    p   => playerSlug(p)
  );
  if (!resolved) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/players',
    body: comingSoonPage({ label: 'Player Not Found', description: 'This player could not be found.' })
  }));
  if (resolved.slug) return res.redirect(302, `/players/${resolved.slug}`);

  const player      = selectPlayerWithTeamStmt.get(resolved.id);
  if (!player) return res.status(404).send(renderPage(req, {
    title: 'Not Found', currentPath: '/players',
    body: comingSoonPage({ label: 'Player Not Found', description: 'This player could not be found.' })
  }));
  const totals      = selectPlayerTotalsStmt.get(resolved.id);
  const gameLogs    = byDate(selectPlayerGameLogStmt.all(resolved.id));
  const potgCandidates = selectPlayerPotgCandidatesStmt.all({ id: resolved.id });
  const potgGames = potgCandidates.filter(g => {
    if (g.manual_potg_player_id === resolved.id) return true;
    if (g.manual_potg_player_id) return false;
    return derivePotgPlayerId(g, selectGameStatsStmt.all(g.id)) === resolved.id;
  });
  const careerHighs = selectPlayerCareerHighsStmt.get(resolved.id);
  const awards      = selectPlayerAwardsStmt.all(resolved.id);
  const dnpGames    = byDate(selectPlayerDnpGamesStmt.all({ teamId: player.team_id, playerId: resolved.id }));
  const displayName = displayPlayerName(player.name);

  res.send(renderPage(req, {
    title: `${displayName} — WKND Basketball`,
    currentPath: '/players',
    metaTags: buildPlayerOgTags(req, player, totals),
    body: playerPage({ player, totals, gameLogs, potgGames, careerHighs, awards, dnpGames })
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
  console.log(`DB: ${DB_PATH}`);
});
