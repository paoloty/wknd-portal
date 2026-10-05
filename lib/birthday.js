// Birthday emails: who has a birthday when, the facts the message is written from, the
// fixed default copy, the AI writer, sending, and the hourly automation (drafts ahead of
// time, sends on the day). Belated emails are only ever sent by an admin.
import {
  getAllPlayers, getAllTeams, getPlayerGameLog, getPlayerAwards, getRegistrationByPlayerId, getPlayerLastActivity,
  getBirthdayEmail, saveAutoBirthdayDraft, claimBirthdaySend, finishBirthdaySend, releaseBirthdaySend,
  logBirthdayEvent, getSetting,
} from './portal-db.js';
import { generateJson, aiAvailable } from './ai.js';
import { sendMail, birthdayEmail } from './mailer.js';
import { manilaHourNow } from '../views/utils.js';
import { AWARD_LABELS } from '../views/admin/awards.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');

const titleCase = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const firstNameOf = p => String(p.first_name || '').trim() || String(p.name || '').split(',').pop().trim();

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// Feb 29 birthdays land on Feb 28 in non-leap years.
function occurrence(year, m, d) {
  if (m === 2 && d === 29 && !isLeap(year)) d = 28;
  return { year, ms: Date.UTC(year, m - 1, d), date: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

export const ACTIVITY_WINDOW_DAYS = 90;

// A player only gets a birthday email if they've shown up in the last 3 months: logged in,
// signed up for Papawis, or played a league game. Returns each signal's latest date
// (YYYY-MM-DD, '' if never) so the admin page can show why someone qualifies or doesn't.
export function birthdayActivity(playerId, reg, todayStr) {
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const cutoff = new Date(Date.UTC(ty, tm - 1, td) - ACTIVITY_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  // Timestamps → Manila calendar dates, to compare like-for-like with game dates.
  const toDate = ms => ms ? new Date(ms + 8 * 3600000).toISOString().slice(0, 10) : '';
  const { lastPapawisAt, lastGameDate } = getPlayerLastActivity(playerId);
  const signals = [
    { key: 'login',   label: 'Logged in', date: toDate(Number(reg?.last_login_at) || 0) },
    { key: 'papawis', label: 'Papawis',   date: toDate(Number(lastPapawisAt) || 0) },
    { key: 'game',    label: 'Played',    date: String(lastGameDate || '').slice(0, 10) },
  ];
  const latest = signals.filter(s => s.date).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  return { active: signals.some(s => s.date && s.date >= cutoff), latest, signals, cutoff };
}

// Active players whose birthday falls from `back` days before todayStr (Manila date,
// YYYY-MM-DD) to `forward` days after it, today included. inDays is negative for birthdays
// already past. `year` is the year of that occurrence (the birthday_emails key). `age` is
// what they turn on that day; it's for the admin pages only and never goes into the email
// or the AI facts.
export function birthdaysAround(todayStr, { back = 0, forward = 7 } = {}) {
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const base = Date.UTC(ty, tm - 1, td);
  const out = [];
  for (const p of getAllPlayers()) {
    if (p.status === 'inactive' || !/^\d{4}-\d{2}-\d{2}/.test(String(p.birthday || ''))) continue;
    const [by, m, d] = String(p.birthday).slice(0, 10).split('-').map(Number);
    // The nearest occurrence to today: last year's, this year's or next year's.
    const occ = [ty - 1, ty, ty + 1].map(y => occurrence(y, m, d))
      .reduce((a, b) => Math.abs(b.ms - base) < Math.abs(a.ms - base) ? b : a);
    const inDays = Math.round((occ.ms - base) / 86400000);
    if (inDays < -back || inDays >= forward) continue;
    const reg = getRegistrationByPlayerId(p.id);
    out.push({
      player: p,
      firstName: firstNameOf(p),
      fullName: `${firstNameOf(p)} ${String(p.last_name || '').trim()}`.trim(),
      teamName: titleCase(p.team_name),
      inDays,
      date: occ.date,
      year: occ.year,
      age: by > 1900 && by < occ.year ? occ.year - by : null,
      email: reg?.status === 'approved' ? String(reg.email || '').trim() : '',
      activity: birthdayActivity(p.id, reg, todayStr),
    });
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.fullName.localeCompare(b.fullName));
}

// Everything the message may mention. The AI only ever sees this object, and the number
// check below only allows numbers that appear in it.
export function birthdayFacts(entry) {
  const { player } = entry;
  const games = getPlayerGameLog(player.id).filter(g => g.status === 'played');
  const sum = k => games.reduce((n, g) => n + (Number(g[k]) || 0), 0);

  let best = null;
  for (const g of games) {
    if (!best || (g.pts | 0) > (best.pts | 0) || ((g.pts | 0) === (best.pts | 0) && (g.reb | 0) > (best.reb | 0))) best = g;
  }
  const describeGame = g => {
    if (!g) return null;
    const onA = g.player_team_id === g.team_a_id;
    const own = onA ? g.team_a_score : g.team_b_score;
    const opp = onA ? g.team_b_score : g.team_a_score;
    return {
      // Readable form, so the model doesn't echo "2026-09-20" into the email.
      date: new Date(`${g.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
      season: g.season,
      playoff: g.game_type === 'playoff',
      opponent: titleCase(onA ? g.team_b_name : g.team_a_name),
      result: Number(own) > Number(opp) ? 'win' : 'loss',
      score: `${own}-${opp}`,
      pts: g.pts | 0, reb: g.reb | 0, ast: g.ast | 0, stl: g.stl | 0, blk: g.blk | 0,
      player_of_the_game: g.manual_potg_player_id === player.id,
    };
  };

  const latestSeason = games.length ? Math.max(...games.map(g => Number(g.season) || 0)) : null;
  const seasonGames = games.filter(g => Number(g.season) === latestSeason);

  let positions = [];
  try { positions = JSON.parse(player.positions || '[]'); } catch {}

  return {
    first_name: entry.firstName,
    ...(entry.inDays < 0 ? { birthday_was_days_ago: -entry.inDays } : {}),
    jersey_number: String(player.number || '').trim(),
    team: entry.teamName,
    positions,
    intro_they_wrote: String(player.writeup || '').trim().slice(0, 500),
    career: games.length ? {
      games: games.length, pts: sum('pts'), reb: sum('reb'), ast: sum('ast'), stl: sum('stl'), blk: sum('blk'),
    } : null,
    best_game: describeGame(best),
    latest_season: latestSeason ? {
      season: latestSeason, games: seasonGames.length,
      pts: seasonGames.reduce((n, g) => n + (g.pts | 0), 0),
      reb: seasonGames.reduce((n, g) => n + (g.reb | 0), 0),
    } : null,
    awards: getPlayerAwards(player.id)
      .map(a => ({ season: a.season, award: AWARD_LABELS[a.award_type] || (a.award_type === 'champion' ? 'Champion' : '') }))
      .filter(a => a.award),
  };
}

// Stat row values for the email, or null for a player with no games yet.
export function birthdayStatRow(facts) {
  return facts.career ? { games: facts.career.games, pts: facts.career.pts, best: facts.best_game?.pts ?? 0 } : null;
}

// The fixed copy used whenever the AI isn't used or isn't trusted. Must read fine for
// anyone, so it only references the team.
export function defaultBirthdayMessage(facts) {
  if (facts.birthday_was_days_ago) {
    return facts.career
      ? {
        opening: `We're a few days late, but the whole WKND Basketball family hopes your birthday was a good one. Here's what you've put on the board with us so far:`,
        closing: facts.team ? `Here's to another year of buckets. See you on Sunday, Team ${facts.team}.` : `Here's to another year of buckets. See you on Sunday.`,
      }
      : {
        opening: `We're a few days late, but the whole WKND Basketball family hopes your birthday was a good one. You're new here, so your stat line is still blank. That changes the first time you check in.`,
        closing: '',
      };
  }
  if (!facts.career) {
    return {
      opening: `Everyone in the WKND Basketball family hopes today's a good one. You're new here, so your stat line is still blank. That changes the first time you check in.`,
      closing: '',
    };
  }
  return {
    opening: `Everyone in the WKND Basketball family hopes today's a good one. Take the day off from defense. Here's what you've put on the board with us so far:`,
    closing: facts.team ? `Here's to another year of buckets. See you on Sunday, Team ${facts.team}.` : `Here's to another year of buckets. See you on Sunday.`,
  };
}

// Every number in the text must appear somewhere in the facts (scores like "91-89" are
// split into their parts). Anything else is a number the model made up.
function allowedNumbers(facts) {
  const set = new Set();
  const walk = v => {
    if (v == null) return;
    if (typeof v === 'number') { set.add(String(v)); return; }
    if (typeof v === 'string') { (v.match(/\d+(?:\.\d+)?/g) || []).forEach(n => set.add(String(Number(n)))); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(facts);
  return set;
}

export function checkBirthdayText(text, facts) {
  const allowed = allowedNumbers(facts);
  const bad = (String(text).match(/\d+(?:\.\d+)?/g) || []).filter(n => !allowed.has(String(Number(n))));
  if (bad.length) return `Used numbers not in the stats: ${[...new Set(bad)].join(', ')}`;
  if (/\b(years? old|turning \d|\d+(st|nd|rd|th) birthday)\b/i.test(text)) return 'Mentioned age.';
  if (/#\s*[^\d\s]/.test(text)) return 'Used a placeholder jersey number.';
  // The league is always "WKND Basketball" (or "the WKND Basketball family"), never bare
  // "WKND". Award names ("All-WKND Defensive Team") are the exception.
  if (/(?<!All[- ])\bWKND\b(?!\s+Basketball)/i.test(text)) return 'Called the league just "WKND".';
  // The facts carry no league rankings, so any ranking claim is made up.
  if (/\b(league[- ]leading|led the league|leads the league|best in the league|top (scorer|rebounder|defender)|#1 in|number one in|record[- ]setting|franchise)\b/i.test(text)) return 'Claimed a league ranking that isn\'t in their stats.';
  // Team names: only their own team and the opponent from their best game.
  const allowedTeams = new Set([facts.team, facts.best_game?.opponent].filter(Boolean).map(t => t.toLowerCase()));
  const strayTeam = getAllTeams().map(t => titleCase(t.name)).filter(Boolean)
    .find(t => !allowedTeams.has(t.toLowerCase()) && new RegExp(`\\b${t}\\b`, 'i').test(text));
  if (strayTeam) return `Mentioned a team not in their stats: ${strayTeam}`;
  return '';
}

const SCHEMA = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
    closing: { type: 'string' },
  },
  required: ['opening', 'closing'],
};

function buildPrompt(facts) {
  return `You are writing the personal part of a birthday email from WKND Basketball, a weekend basketball league in Manila, to one of its players.

Write two pieces of plain text:
- "opening": 2 to 3 sentences, at most 60 words. Wish them a happy birthday and point to one or two specific things from their stats below (their best game, an award, this season's numbers, their position). Make it feel written for this player only.
- "closing": 1 sentence, at most 25 words. A short, warm sign-off${facts.team ? ` that can mention their team (${facts.team})` : ''}${facts.jersey_number ? ` or jersey (#${facts.jersey_number})` : ''}.

Tone: warm and a little playful, like a teammate who keeps track of the box scores talking to them directly. Plain, natural sentences, not a press release. Light teasing is fine; never mean.
Write as the league ("we", "the WKND Basketball family", "everyone in the WKND Basketball family"), never "I". Never call the league just "WKND" on its own; always "WKND Basketball" or "the WKND Basketball family" (award names like "All WKND Defensive Team" are fine as written). The league plays games on Sundays and runs Papawis pickup games; it has no practices.
${facts.team ? `Their team is ${facts.team}; call it "${facts.team}" or "Team ${facts.team}".` : 'They are not on a team yet: do not name or invent a team.'}
${facts.jersey_number ? `Their jersey is #${facts.jersey_number}.` : 'They have no jersey number yet: do not mention one.'}
Don't repeat "happy birthday" in the closing line.

Hard rules:
- Use ONLY the facts below. Do not invent games, plays, opponents' reactions, quotes, nicknames, rankings ("league-leading", "top scorer") or anything else not listed.
- Every number you write must appear in the facts exactly. Do not round, average or calculate new numbers (no per-game averages, no percentages).
- Never mention their age, birth year or how old they are.
- Do not mention losses unless the facts show nothing else to talk about.
- Don't use em dashes. No hashtags, no emojis.
- Avoid clichés: "GOAT", "legend", "trip around the sun", "level up", "baller", "beast mode".
${facts.career ? '' : '- This player has not played a league game yet. Welcome them and keep it about the season ahead; do not mention stats.\n'}${facts.birthday_was_days_ago ? `- This is a BELATED message: their birthday was ${facts.birthday_was_days_ago} day(s) ago. Say "happy belated birthday" (never "happy birthday today") and own being late once, lightly. Do not over-apologize.\n` : ''}
The email already shows their career games, points and best-game points in a stat row under the opening, so you can refer to it without repeating all three numbers.

Facts (JSON):
${JSON.stringify(facts, null, 2)}

Return JSON: { "opening": "...", "closing": "..." }`;
}

// Always resolves: AI text when it's available and passes the checks, otherwise the
// default with `note` saying why.
export async function writeBirthdayMessage(facts) {
  const fallback = note => ({ ...defaultBirthdayMessage(facts), source: 'default', note });
  if (!aiAvailable()) return fallback('No AI key configured.');
  let result;
  try {
    result = await generateJson(buildPrompt(facts), SCHEMA, { temperature: 0.9, maxTokens: 400 });
  } catch (e) {
    return fallback(`AI failed: ${String(e?.message || e).slice(0, 200)}`);
  }
  // Models like typographic punctuation (non-breaking hyphens, curly quotes) that renders
  // oddly in some mail clients; flatten it to plain ASCII.
  const clean = s => String(s || '')
    .replace(/[\u2010-\u2013]/g, '-').replace(/\s*\u2014\s*/g, ', ')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ').trim();
  const opening = clean(result.data?.opening);
  const closing = clean(result.data?.closing);
  if (!opening || opening.length > 600 || closing.length > 300) return fallback('AI returned an empty or overlong message.');
  const problem = checkBirthdayText(`${opening} ${closing}`, facts);
  if (problem) return fallback(`AI text rejected. ${problem}`);
  return { opening, closing, source: 'ai', note: `${result.provider} / ${result.model}` };
}

export function birthdayLinks(player) {
  return {
    profileUrl: `${LIVE_URL}/players/${encodeURIComponent(player.id)}`,
    papawisUrl: `${LIVE_URL}/papawis`,
  };
}

// ── Building and sending ──────────────────────────────────────────────────────

export function buildBirthdayEmail(entry, draft) {
  return birthdayEmail({
    firstName: entry.firstName,
    belated: entry.inDays < 0,
    number: entry.player.number || '',
    stats: birthdayStatRow(birthdayFacts(entry)),
    opening: draft.opening,
    closing: draft.closing,
    ...birthdayLinks(entry.player),
  });
}

const logFor = (entry, event, detail = '', actor = 'auto') =>
  logBirthdayEvent({ playerId: entry.player.id, playerName: entry.fullName, year: entry.year, event, actor, detail });
export { logFor as logBirthdayEventFor };

// The one place a real birthday email is sent, for both the automatic job and the admin's
// belated send. The claim is an atomic draft→sending flip, so nothing can send twice; a
// failed send is released back to draft (nothing went out) and logged.
export async function sendBirthdayEmail(entry, { actor = 'auto' } = {}) {
  if (!claimBirthdaySend(entry.player.id, entry.year)) return { ok: false, error: 'Already sent (or being sent) this year.' };
  const draft = getBirthdayEmail(entry.player.id, entry.year);
  try {
    const { subject, html } = buildBirthdayEmail(entry, draft);
    // sendMail quietly skips (returns nothing) when email isn't configured; that must not
    // be recorded as sent.
    if (!await sendMail({ to: entry.email, subject, html })) throw new Error("Email isn't configured (RESEND_API_KEY missing).");
    finishBirthdaySend(entry.player.id, entry.year, entry.email);
    logFor(entry, 'sent', `${entry.inDays < 0 ? 'Belated · ' : ''}${entry.email} · ${draft.source === 'ai' ? 'AI message' : draft.source === 'edited' ? 'edited message' : 'default message'}`, actor);
    return { ok: true };
  } catch (e) {
    releaseBirthdaySend(entry.player.id, entry.year);
    logFor(entry, 'send_failed', e.message, actor);
    return { ok: false, error: e.message };
  }
}

// ── Automation ───────────────────────────────────────────────────────────────
// Runs hourly from server.js. Two steps, in order:
//
// 1. Drafts: an AI draft (or the default, if the AI fails) for every upcoming birthday that
//    qualifies (today through the next AUTO_DRAFT_DAYS - 1 days, active in the last 3
//    months, email on file). Never touches a draft an admin wrote or edited; auto drafts
//    are marked by their note ("Auto-written…"). An auto draft is rewritten when the player
//    has played a league game since it was written, or when the AI itself failed last time.
//
// 2. Sends: on the birthday itself, from AUTO_SEND_FROM_HOUR Manila time. A failed send is
//    retried every hour until AUTO_SEND_UNTIL_HOUR; after that (or for anything missed),
//    it shows on /admin/birthdays as belated for an admin to send by hand. Belated emails
//    are never sent automatically.
//
// Automatic sending only happens on the production server (NODE_ENV=production) and can be
// paused from /admin/birthdays (site setting birthday_auto_send, on unless set to '0').
export const AUTO_DRAFT_DAYS = 7;
export const AUTO_SEND_FROM_HOUR = 8;   // 8:00 AM Manila
export const AUTO_SEND_UNTIL_HOUR = 20; // 8:00 PM Manila
const AUTO_NOTE = 'Auto-written';

export function autoSendState() {
  const production = process.env.NODE_ENV === 'production';
  const enabled = getSetting('birthday_auto_send', '1') !== '0';
  const hour = manilaHourNow();
  return {
    production, enabled, on: production && enabled,
    windowOpen: hour >= AUTO_SEND_FROM_HOUR && hour < AUTO_SEND_UNTIL_HOUR,
    windowPassed: hour >= AUTO_SEND_UNTIL_HOUR,
  };
}

const isAutoDraft = d => d?.status === 'draft' && String(d.note || '').startsWith(AUTO_NOTE);
const manilaDate = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);

function autoDraftReason(entry, draft) {
  if (!draft) return 'new';
  if (!isAutoDraft(draft)) return null;
  const lastGame = entry.activity?.signals.find(s => s.key === 'game')?.date || '';
  // Strictly after the day it was written, or a game-day draft would be redone every hour.
  if (lastGame && lastGame > manilaDate(draft.updated_at)) return 'new game';
  if (draft.source === 'default' && /AI failed/.test(draft.note)) return 'retry';
  return null;
}

async function autoDraft(entry) {
  const draft = getBirthdayEmail(entry.player.id, entry.year);
  const reason = autoDraftReason(entry, draft);
  if (!reason) return false;
  const m = await writeBirthdayMessage(birthdayFacts(entry));
  const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  const note = `${AUTO_NOTE} ${stamp}${reason === 'new' ? '' : ` (${reason})`} · ${m.note}`;
  const saved = saveAutoBirthdayDraft({ playerId: entry.player.id, year: entry.year, opening: m.opening, closing: m.closing, source: m.source, note, expectedUpdatedAt: draft?.updated_at ?? null });
  if (saved) logFor(entry, reason === 'new' ? 'drafted' : 'redrafted', `${m.source === 'ai' ? 'AI message' : 'Default message'}${reason === 'new' ? '' : ` (${reason})`} · ${m.note}`);
  return saved;
}

let automationRunning = false;
export async function runBirthdayAutomation(todayStr) {
  if (automationRunning) return { drafted: 0, sent: 0, failed: 0, skipped: 'already running' };
  automationRunning = true;
  let drafted = 0, sent = 0, failed = 0;
  try {
    const due = birthdaysAround(todayStr, { forward: AUTO_DRAFT_DAYS }).filter(e => e.activity?.active && e.email);
    for (const entry of due) if (await autoDraft(entry)) drafted++;

    const state = autoSendState();
    if (state.on && state.windowOpen) {
      for (const entry of due.filter(e => e.inDays === 0)) {
        if (getBirthdayEmail(entry.player.id, entry.year)?.status !== 'draft') continue;
        const r = await sendBirthdayEmail(entry, { actor: 'auto' });
        r.ok ? sent++ : failed++;
      }
    }
  } finally {
    automationRunning = false;
  }
  return { drafted, sent, failed };
}
