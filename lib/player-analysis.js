import { generateJson } from './ai.js';

// ── Focus tags ────────────────────────────────────────────────────────────────
// Fixed, enum-constrained set. The model only ever picks one of these — it never
// outputs a URL itself (LLMs hallucinate video links), so each tag maps to a
// video we picked and verified by hand.
export const FOCUS_TAGS = [
  'REBOUNDING', 'THREE_POINT_SHOOTING', 'FREE_THROW_SHOOTING', 'BALL_HANDLING',
  'PASSING_VISION', 'ON_BALL_DEFENSE', 'FINISHING_AT_RIM',
];

export const FOCUS_LABELS = {
  REBOUNDING:            'Rebounding',
  THREE_POINT_SHOOTING:  'Three-Point Shooting',
  FREE_THROW_SHOOTING:   'Free-Throw Shooting',
  BALL_HANDLING:         'Ball Handling',
  PASSING_VISION:        'Passing & Vision',
  ON_BALL_DEFENSE:       'On-Ball Defense',
  FINISHING_AT_RIM:      'Finishing at the Rim',
};

export const FOCUS_VIDEOS = {
  REBOUNDING:           { title: '3 Best Basketball Rebounding Drills that WIN GAMES!', url: 'https://www.youtube.com/watch?v=pFRlEOeWpKY' },
  THREE_POINT_SHOOTING: { title: '5 TIPS Guaranteed To Improve Your 3 Point Shot!', url: 'https://www.youtube.com/watch?v=Fw9Km_MpDsU' },
  FREE_THROW_SHOOTING:  { title: 'Basketball Tips | Free Throw Shooting', url: 'https://www.youtube.com/watch?v=8Ul28lp87Xc' },
  BALL_HANDLING:        { title: '5 Dribbling Drills EVERY Player Should Do', url: 'https://www.youtube.com/watch?v=a6rPVGkGpds' },
  PASSING_VISION:       { title: 'EVERY Point Guard NEEDS This Passing Drill to Improve', url: 'https://www.youtube.com/watch?v=6iWIsqyqQ5E' },
  ON_BALL_DEFENSE:      { title: 'Basketball Defense: Stance and Slides', url: 'https://www.youtube.com/watch?v=QaYwcS00vSA' },
  FINISHING_AT_RIM:     { title: '5 Finishing Drills to Score More at the Rim', url: 'https://www.youtube.com/watch?v=Ukp5LuouV5s' },
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    analysis:  { type: 'string' },
    focus_tag: { type: 'string', enum: FOCUS_TAGS },
  },
  required: ['analysis', 'focus_tag'],
  additionalProperties: false,
};

const PERIMETER_POSITIONS = new Set(['PG', 'SG', 'SF']);

export function classifyPositionGroup(positions) {
  const arr = Array.isArray(positions) ? positions : [];
  return arr.some(p => PERIMETER_POSITIONS.has(p)) ? 'perimeter' : 'big';
}

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function safeDiv(n, d) { return d ? n / d : 0; }
function pct(made, miss) { const att = (made || 0) + (miss || 0); return att ? (100 * (made || 0) / att) : null; }

// peerRows: rows from getAllPlayerCareerTotals() — { player_id, positions, games_played, pts, ast, reb, stl, blk, turnover, fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss }
export function aggregatePeerAverages(peerRows, group) {
  const peers = peerRows.filter(r => r.games_played > 0 && classifyPositionGroup(parsePositions(r.positions)) === group);
  if (!peers.length) return null;

  const perGameAvg = (key) => peers.reduce((s, p) => s + safeDiv(p[key] || 0, p.games_played), 0) / peers.length;

  let fgm = 0, fga = 0, tpm = 0, tpa = 0, ftm = 0, fta = 0;
  for (const p of peers) {
    fgm += (p.fg2m || 0) + (p.fg3m || 0);
    fga += (p.fg2m || 0) + (p.fg2m_miss || 0) + (p.fg3m || 0) + (p.fg3m_miss || 0);
    tpm += p.fg3m || 0;
    tpa += (p.fg3m || 0) + (p.fg3m_miss || 0);
    ftm += p.ftm || 0;
    fta += (p.ftm || 0) + (p.ft_miss || 0);
  }

  return {
    count: peers.length,
    pts: perGameAvg('pts'), ast: perGameAvg('ast'), reb: perGameAvg('reb'),
    stl: perGameAvg('stl'), blk: perGameAvg('blk'), turnover: perGameAvg('turnover'),
    fgPct: fga ? 100 * fgm / fga : null,
    tpPct: tpa ? 100 * tpm / tpa : null,
    ftPct: fta ? 100 * ftm / fta : null,
  };
}

export function myPerGameStats(totals) {
  const gp = totals?.games_played || 0;
  return {
    gp,
    pts: safeDiv(totals.pts, gp), ast: safeDiv(totals.ast, gp), reb: safeDiv(totals.reb, gp),
    stl: safeDiv(totals.stl, gp), blk: safeDiv(totals.blk, gp), turnover: safeDiv(totals.turnover, gp),
    fg2Made: totals.fg2m || 0, fg2Att: (totals.fg2m || 0) + (totals.fg2m_miss || 0),
    fg3Made: totals.fg3m || 0, fg3Att: (totals.fg3m || 0) + (totals.fg3m_miss || 0),
    ftMade: totals.ftm || 0, ftAtt: (totals.ftm || 0) + (totals.ft_miss || 0),
  };
}

// Stable string of the exact totals used to generate an analysis — compared against
// the player's current totals to decide whether a regeneration is warranted.
export function statSnapshotFromTotals(totals) {
  const fields = ['games_played', 'pts', 'ast', 'reb', 'stl', 'blk', 'turnover', 'fg2m', 'fg3m', 'fg2m_miss', 'fg3m_miss', 'ftm', 'ft_miss'];
  return JSON.stringify(Object.fromEntries(fields.map(f => [f, totals?.[f] || 0])));
}

function fmtPct(v) { return v == null ? 'n/a' : `${v.toFixed(1)}%`; }
function fmt1(v) { return v.toFixed(1); }

export function buildAnalysisPrompt({ displayName, positions, totals, peerAverages, groupLabel, recentGames = [] }) {
  const me = myPerGameStats(totals);

  const shootingLines = [
    `- 2-point FG: ${me.fg2Made}-for-${me.fg2Att} (${fmtPct(pct(me.fg2Made, me.fg2Att - me.fg2Made))})`,
    me.fg3Att ? `- 3-point FG: ${me.fg3Made}-for-${me.fg3Att} (${fmtPct(pct(me.fg3Made, me.fg3Att - me.fg3Made))})${peerAverages?.tpPct != null ? ` — position-peer average is ${fmtPct(peerAverages.tpPct)}` : ''}` : '',
    me.ftAtt ? `- Free throws: ${me.ftMade}-for-${me.ftAtt} (${fmtPct(pct(me.ftMade, me.ftAtt - me.ftMade))})${peerAverages?.ftPct != null ? ` — position-peer average is ${fmtPct(peerAverages.ftPct)}` : ''}` : '',
  ].filter(Boolean).join('\n');

  const recentLines = recentGames.slice(0, 4).map((g, i) =>
    `- Game ${i === 0 ? '1 (most recent)' : i + 1}: ${g.pts || 0} pts, ${g.ast || 0} ast, ${g.reb || 0} reb, ${g.stl || 0} stl, ${g.turnover || 0} TO`
  ).join('\n');

  const peerLines = peerAverages ? `
Per-game averages vs. position-peer averages (${groupLabel} players in the league, n=${peerAverages.count}):
- Points: ${fmt1(me.pts)} per game (peer avg ${fmt1(peerAverages.pts)})
- Assists: ${fmt1(me.ast)} per game (peer avg ${fmt1(peerAverages.ast)})
- Rebounds: ${fmt1(me.reb)} per game (peer avg ${fmt1(peerAverages.reb)})
- Steals: ${fmt1(me.stl)} per game (peer avg ${fmt1(peerAverages.stl)})
- Blocks: ${fmt1(me.blk)} per game (peer avg ${fmt1(peerAverages.blk)})
- Turnovers: ${fmt1(me.turnover)} per game (peer avg ${fmt1(peerAverages.turnover)}, lower is better)` : '\n(No position-peer data available yet — judge purely on the numbers below.)';

  return `You are a basketball coach giving a short, personal performance note to one of your own players, based on their season stats so far. Write like a coach talking to the player, not like a stats report.

Rules:
- Second person throughout ("You...", "Your...").
- Open with ONE genuine strength drawn from the actual numbers below.
- Then name exactly ONE focus area to improve: the stat where the player lags furthest behind their position peers (or, if no peer data, their weakest real area). Explain it in on-court terms, not just by naming the number.
- Give one concrete, actionable suggestion tied to that focus area (an on-court behavior or habit, not vague advice like "work harder").
- If a stat is based on a small number of attempts or games, do not state conclusions from it with full confidence — soften it ("early on...", "small sample, but...").
- No advanced metric names (no PER, no percentiles as raw numbers, no "TS%").
- 3-5 sentences total for the analysis. No headers, no bullet points, just a short coaching paragraph.
- Do not mention that this is AI-generated.
- Classify the ONE focus area into exactly one tag from this fixed list, matching the skill the analysis tells them to work on: ${FOCUS_TAGS.join(', ')}

Respond as JSON: { "analysis": "<3-5 sentence coaching paragraph>", "focus_tag": "<one of the fixed tags>" }

Player: ${displayName}
Position(s): ${positions.join(', ') || 'unlisted'}
Games played this season: ${me.gp}
${peerLines}

Shooting:
${shootingLines || '(no shot attempts logged yet)'}
${recentLines ? `\nRecent games (most recent first):\n${recentLines}` : ''}`;
}

// primaryProvider: this feature runs Gemini-primary/OpenAI-fallback (opposite of
// game recap/POTG, which stay OpenAI-primary via the AI_PRIMARY_PROVIDER env default).
export async function generateCoachAnalysis(promptInputs, { primaryProvider = 'gemini' } = {}) {
  const prompt = buildAnalysisPrompt(promptInputs);
  const { data, provider, model } = await generateJson(prompt, ANALYSIS_SCHEMA, { primaryProvider, temperature: 0.7, maxTokens: 400 });
  if (!data || typeof data.analysis !== 'string' || !data.analysis.trim() || !FOCUS_TAGS.includes(data.focus_tag)) {
    throw new Error('Model returned an invalid analysis shape.');
  }
  return { analysis: data.analysis.trim(), focus_tag: data.focus_tag, provider, model };
}
