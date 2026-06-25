import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import Database from 'better-sqlite3';
import { layout } from './views/layout.js';
import { homePage } from './views/home.js';
import { gamesPage } from './views/games.js';
import { gamePage } from './views/game.js';
import { leadersPage } from './views/leaders.js';
import { standingsPage } from './views/standings.js';
import { comingSoonPage } from './views/coming-soon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;
const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || '../wknd-stats/data/wknd-stats.db');
const GA_MEASUREMENT_ID = String(process.env.GA_MEASUREMENT_ID || '').trim();
const ADMIN_URL = String(process.env.ADMIN_URL || 'http://localhost:3000').replace(/\/$/, '');

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
  const url        = `${origin}/games/${encodeURIComponent(game.id)}`;
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

function renderPage(req, opts) {
  return layout({ ...opts, gaSnippet: buildGaSnippet(req) });
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
         playoff_round, series_id, youtube_url,
         (COALESCE(LENGTH(social_cover_data_url), 0) > 0) AS has_cover
  FROM games
  ORDER BY sort_order ASC, id DESC
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
  SELECT p.id, p.name, p.team_id,
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

function buildHighlights(completedGames, playerMap, teamMap, count = 4) {
  return completedGames.slice(0, count).map(g => {
    const stats = selectGameStatsStmt.all(g.id);
    const potgPlayerId = g.manual_potg_player_id || derivePotgPlayerId(g, stats);
    if (!potgPlayerId) return null;
    const potgStat = stats.find(s => s.player_id === potgPlayerId);
    if (!potgStat) return null;
    return { game: g, stat: potgStat, player: playerMap[potgPlayerId] || null, team: teamMap[potgStat.team_id] || null };
  }).filter(Boolean);
}

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/', (req, res) => {
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = selectGamesStmt.all();

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const highlights = buildHighlights(completedGames, playerMap, teamMap);
  const leaderPlayers = buildLeaderPlayers();

  res.send(renderPage(req, {
    title: 'WKND Basketball League',
    currentPath: req.path,
    body: homePage({ teams, players, games, highlights, leaderPlayers })
  }));
});

app.get('/games/:id', (req, res) => {
  const game = selectGameByIdStmt.get(req.params.id);
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
  const completedGames = allGames.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const title = `${game.team_a_name} ${scoreA}–${scoreB} ${game.team_b_name}`;

  res.send(renderPage(req, {
    title: `${title} — WKND Basketball League`,
    currentPath: req.path,
    metaTags: buildGameOgTags(req, game),
    body: gamePage({ game, stats, potgPlayerId, quarterScores, completedGames, playerMap, teamMap })
  }));
});

app.get('/games', (req, res) => {
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = selectGamesStmt.all();

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );

  const highlights = buildHighlights(completedGames, playerMap, teamMap);

  res.send(renderPage(req, {
    title: 'Games — WKND Basketball League',
    currentPath: req.path,
    body: gamesPage({ games, highlights })
  }));
});

app.get('/standings', (req, res) => {
  const teams = selectTeamsStmt.all();
  const players = selectPlayersStmt.all();
  const games = selectGamesStmt.all();
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const completedGames = games.filter(g =>
    !g.under_review && (Number(g.team_a_score) + Number(g.team_b_score)) > 0
  );
  const highlights = buildHighlights(completedGames, playerMap, teamMap);
  const teamStats = selectTeamSeasonStatsStmt.all();
  res.send(renderPage(req, {
    title: 'Standings — WKND Basketball League',
    currentPath: req.path,
    body: standingsPage({ teams, games, highlights, teamStats })
  }));
});

app.get('/leaders', (req, res) => {
  const players = buildLeaderPlayers();
  res.send(renderPage(req, {
    title: 'League Leaders — WKND Basketball League',
    currentPath: req.path,
    body: leadersPage({ players })
  }));
});

app.get('/teams', (req, res) => {
  res.send(renderPage(req, {
    title: 'Teams — WKND Basketball League',
    currentPath: req.path,
    body: comingSoonPage({ label: 'Teams', description: 'Team rosters, stats, and season averages are on their way.' })
  }));
});

app.get('/teams/:id', (req, res) => {
  res.send(renderPage(req, {
    title: 'Team — WKND Basketball League',
    currentPath: '/teams',
    body: comingSoonPage({ label: 'Team Profile', description: 'Team rosters, stats, and season averages are on their way.' })
  }));
});

app.get('/players', (req, res) => {
  res.send(renderPage(req, {
    title: 'Players — WKND Basketball League',
    currentPath: req.path,
    body: comingSoonPage({ label: 'Players', description: 'Full player profiles and career stats are on their way.' })
  }));
});

app.get('/players/:id', (req, res) => {
  res.send(renderPage(req, {
    title: 'Player — WKND Basketball League',
    currentPath: '/players',
    body: comingSoonPage({ label: 'Player Profile', description: 'Full player profiles and career stats are on their way.' })
  }));
});

app.listen(PORT, () => {
  console.log(`WKND Portal → http://localhost:${PORT}`);
  console.log(`DB: ${DB_PATH}`);
});
