// The WKND conduct rules (published at /rules/conduct; Fable audit 2026-11-05, Paolo said yes to
// every recommendation 2026-11-06). The case pipeline itself (report → escalation vote → head
// vote → admin decision → ledger) lives in lib/portal-db.js; this is what the rules add on top:
//   - the player is told the day a case opens and has RESPOND_HOURS to answer before anyone decides;
//   - nobody votes on or decides a case they're the accused or the reporter in, and the accused's
//     own team head doesn't vote; a case against an elevated admin is the super admin's call;
//   - a fine needs evidence beyond one player's word, and a late report is a warning at most;
//   - warnings (₱0, 0 points, on record): every WARNINGS_FOR_L1th in a season opens a Level 1 case;
//   - a second case at the same level in a season is charged one level up;
//   - suspensions are real: served by missing your own team's league games, Papawis is off meanwhile;
//   - one appeal within APPEAL_DAYS, heard by the super admin after two uninvolved heads weigh in;
//   - a fine is due PAY_DAYS after the decision, then the player can't play until it's paid.
// Every notice to a player goes through createNotification (bell + push).
import {
  db, getFineCase, getFineCategory, getAllFineCategories, createFineCase, createNotification, recordTransaction, voidTransaction,
  resolveFineCase, getPlayerById, getHeadTeamIds, getPortalCurrentSeason, getRegistrationByPlayerId, setPlayerBanned,
  getBannedPlayers, getFineVotesForCase, getAllTeamHeads,
} from './portal-db.js';
import { seasonOnDate } from './papawis-season.js';
import { randomBytes } from 'crypto';

export const RESPOND_HOURS = 72;
export const DECIDE_DAYS = 14;
export const APPEAL_DAYS = 7;
export const APPEAL_HEADS = 2;
export const PAY_DAYS = 14;
export const REPORT_DAYS = 7;
export const REPORT_DAYS_ONLINE = 14;
export const WARNINGS_FOR_L1 = 3;
export const REVIEW_POINTS = 6;
export const REMOVAL_POINTS = 10;
const DAY = 86400000;

export const CONTEXTS = { league: 'League game', papawis: 'Papawis run', online: 'Online', other: 'Elsewhere' };
// What the decider relied on (rule 7). 'one_player' supports a warning, never a fine.
export const EVIDENCE = { video: 'Video', official: "A referee's or scorer's account", witnesses: 'Two people not both on the reporter’s team', one_player: 'One player’s word' };

const manilaYmd = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const dayLabel = ms => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function seasonStarts() {
  return db.prepare("SELECT season, MIN(date) AS start FROM games WHERE season IS NOT NULL AND date != '' GROUP BY season").all();
}
// The season an incident belongs to: the latest one started on its day (so the off-season counts
// for the season just played, and a case filed after the next season starts still counts for the
// season it happened in).
export function caseSeasonFor(incidentAt) {
  return seasonOnDate(manilaYmd(incidentAt), seasonStarts()) || getPortalCurrentSeason();
}

function logCase(id, by, what) {
  const k = getFineCase(id);
  let log = [];
  try { log = JSON.parse(k?.case_log || '[]'); } catch {}
  log.push({ at: Date.now(), by, what });
  db.prepare('UPDATE fine_cases SET case_log = ? WHERE id = ?').run(JSON.stringify(log), id);
}
export function caseLog(k) { try { return JSON.parse(k?.case_log || '[]'); } catch { return []; } }

// ── Who may act ──────────────────────────────────────────────────────────────────
const teamOf = playerId => getPlayerById(playerId)?.team_id || '';
const isElevatedAdmin = playerId => !!getRegistrationByPlayerId(playerId)?.is_admin;

// A head's vote on an open case: not the accused, not the reporter, not the accused's own head.
export function headVoteBlock(headId, k) {
  if (headId === k.player_id) return 'You can’t vote on a case about you.';
  if (headId === k.reported_by_id) return 'You filed this case, so you don’t vote on it.';
  const team = teamOf(k.player_id);
  if (team && getHeadTeamIds(headId).includes(team)) return 'You’re the head of their team, so you don’t vote on this one.';
  return '';
}
// An admin's vote or decision. isSuperAdmin: the shared login.
export function adminActBlock(actorId, k, { isSuperAdmin = false, deciding = false } = {}) {
  if (actorId === k.player_id) return 'You can’t vote on or decide a case about you.';
  if (actorId === k.reported_by_id) return deciding ? 'You filed this case, so another admin decides it.' : 'You filed this case, so you don’t vote on it.';
  if (deciding && !isSuperAdmin && isElevatedAdmin(k.player_id)) return 'This case is about an admin, so the super admin decides it.';
  return '';
}
// Heads who may weigh in on an appeal: neither the accused's team nor the reporter's.
export function appealHeadBlock(headId, k) {
  if (headId === k.player_id || headId === k.reported_by_id) return 'You’re part of this case.';
  const teams = [teamOf(k.player_id), k.reported_by_type !== 'system' ? teamOf(k.reported_by_id) : ''].filter(Boolean);
  if (getHeadTeamIds(headId).some(t => teams.includes(t))) return 'Your team is part of this case.';
  return '';
}

// ── Filing ───────────────────────────────────────────────────────────────────────
// One case per incident: the same player and category reported again within REPORT_DAYS while the
// first is still live joins the first. Returns the existing case id or null.
function sameIncident(playerId, categoryId, incidentAt) {
  return db.prepare(`SELECT id FROM fine_cases WHERE player_id = ? AND category_id = ? AND status IN ('pending_admin', 'open')
    AND ABS(COALESCE(incident_at, created_at) - ?) <= ? ORDER BY created_at LIMIT 1`).get(playerId, categoryId, incidentAt, REPORT_DAYS * DAY)?.id || null;
}

// incidentDate: 'YYYY-MM-DD' (Manila). Returns { ok, id, joined? } or { error }.
export function fileCase({ playerId, categoryId, description = '', incidentDate = '', context = 'league', gameId = '', reportedByType, reportedById, reportedByName, status = 'open', autoKey = '' }) {
  if (!getPlayerById(playerId) || !getFineCategory(categoryId)) return { error: 'Pick a player and a category.' };
  if (reportedById && reportedById === playerId) return { error: 'You can’t file a report about yourself.' };
  const ctx = CONTEXTS[context] ? context : 'league';
  const today = manilaYmd(Date.now());
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(incidentDate) ? incidentDate : today;
  if (ymd > today) return { error: 'The incident date can’t be in the future.' };
  const incidentAt = Date.parse(`${ymd}T12:00:00+08:00`);
  const window = ctx === 'online' ? REPORT_DAYS_ONLINE : REPORT_DAYS;
  const late = Date.parse(`${today}T12:00:00+08:00`) - incidentAt > window * DAY;
  const existing = sameIncident(playerId, categoryId, incidentAt);
  if (existing) {
    if (description.trim()) logCase(existing, reportedByName || 'Someone', `Another report of this incident: ${description.trim().slice(0, 500)}`);
    return { ok: true, id: existing, joined: true };
  }
  const r = createFineCase({
    playerId, gameId, categoryId, description, reportedByType, reportedById, reportedByName, status,
    season: caseSeasonFor(incidentAt), incidentAt, incidentContext: ctx, late, autoKey,
  });
  if (r.error) return { error: 'Could not file the report.' };
  if (status === 'open') openCase(r.id);
  return { ok: true, id: r.id };
}

// The case goes in front of the heads, and the player is told the same day (rule 8).
export function openCase(id) {
  const k = getFineCase(id);
  if (!k || k.status !== 'open' || k.opened_at) return;
  const now = Date.now();
  db.prepare('UPDATE fine_cases SET opened_at = ?, respond_by = ? WHERE id = ?').run(now, now + RESPOND_HOURS * 3600000, id);
  const by = k.reported_by_type === 'player' ? 'a player' : k.reported_by_type === 'system' ? 'the scorebook' : k.reported_by_name || 'an admin';
  createNotification({
    playerId: k.player_id, type: 'case_opened',
    title: `A conduct case about you: ${k.category_label}`,
    body: `Filed by ${by}. You have ${RESPOND_HOURS} hours, until ${dayLabel(now + RESPOND_HOURS * 3600000)}, to give your side before an admin decides.`,
    link: '/me/conduct',
  });
}

// Scorebook cases (rule 5): an ejection (technicals + unsportsmanlike reaching the game's limit)
// opens a Level 2 case, a disqualifying foul a Level 3; an admin still decides. state: foldGame's.
export function fileScorebookCases(game, state, { context = 'league' } = {}) {
  const byLevel = Object.fromEntries(getAllFineCategories().filter(c => c.level > 0).map(c => [c.level, c]));
  const out = [];
  for (const [pid, L] of Object.entries(state.players || {})) {
    if (state.flags?.[pid] !== 'ejected' || !getPlayerById(pid)) continue;
    const level = L.dq > 0 ? 3 : 2;
    const cat = byLevel[level];
    const autoKey = `${game.id}:${pid}`;
    if (!cat || db.prepare('SELECT 1 FROM fine_cases WHERE auto_key = ?').get(autoKey)) continue;
    const what = L.dq > 0 ? 'a disqualifying foul' : `${plural(L.tech + L.unsp, 'technical or unsportsmanlike foul')}`;
    const vs = game.team_a_name && game.team_b_name ? ` in ${game.team_a_name} vs ${game.team_b_name}` : '';
    const r = fileCase({
      playerId: pid, categoryId: cat.id, gameId: context === 'league' ? game.id : '', context,
      incidentDate: String(game.date || '').slice(0, 10), description: `Ejected from the game by the scorebook: ${what}${vs}. Opened automatically; an admin decides.`,
      reportedByType: 'system', reportedById: 'scorebook', reportedByName: 'Scorebook', autoKey,
    });
    if (r.ok) out.push(r.id);
  }
  return out;
}

// ── The player's side ────────────────────────────────────────────────────────────
export function respondToCase(id, playerId, text) {
  const k = getFineCase(id);
  if (!k || k.player_id !== playerId || k.status !== 'open') return { error: 'This case isn’t open.' };
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return { error: 'Write your side first.' };
  db.prepare('UPDATE fine_cases SET response = ?, response_at = ? WHERE id = ?').run(t, Date.now(), id);
  return { ok: true };
}
// Decide opens once they've answered or their time is up.
export const decideOpensAt = k => (k.response_at ? 0 : Number(k.respond_by) || 0);
export const canDecideNow = k => k.status === 'open' && Date.now() >= decideOpensAt(k);

// ── Points and sitting out ───────────────────────────────────────────────────────
export function tierGames(points) {
  const p = Number(points) || 0;
  if (p >= REMOVAL_POINTS) return -1;
  if (p >= 8) return 3;
  if (p >= 6) return 2;
  if (p >= 4) return 1;
  return 0;
}
const seasonPoints = (playerId, season, exceptId = '') => db.prepare(`SELECT COALESCE(SUM(points), 0) AS n FROM fine_cases WHERE player_id = ? AND season = ? AND status = 'approved' AND kind = 'fine' AND id != ?`).get(playerId, String(season), exceptId).n;

// ── Deciding ─────────────────────────────────────────────────────────────────────
// outcome: 'fine' | 'warning' | 'reject'. evidence: an EVIDENCE key (a fine needs one that isn't
// one player's word). Returns { ok, message } or { error }.
export function decideCase(id, { outcome, note = '', evidence = '', actorName }) {
  const k = getFineCase(id);
  if (!k || k.status !== 'open') return { error: 'This case isn’t open.' };
  if (!canDecideNow(k)) return { error: `They have until ${dayLabel(decideOpensAt(k))} to give their side.` };
  const why = String(note || '').trim();
  if (outcome !== 'reject' && !why) return { error: 'Write the reason. The player reads it.' };
  if (outcome === 'fine') {
    if (!EVIDENCE[evidence]) return { error: 'Say what the decision rests on.' };
    if (evidence === 'one_player') return { error: 'One player’s word is enough for a warning, not a fine.' };
    if (k.late) return { error: 'This was reported late, so it’s a warning at most.' };
  }
  if (outcome === 'warning') return issueWarning(k, { why, evidence, actorName });
  if (outcome === 'reject') {
    resolveFineCase(k.id, { approved: false, resolvedByName: actorName, note: why });
    db.prepare('UPDATE fine_cases SET evidence = ? WHERE id = ?').run(evidence || '', k.id);
    createNotification({ playerId: k.player_id, type: 'fine_rejected', title: 'The conduct case about you was closed', body: `No fine, no points.${why ? ` ${why}` : ''}`, link: '/me/conduct' });
    return { ok: true, message: 'Case rejected.' };
  }
  if (outcome !== 'fine') return { error: 'Pick an outcome.' };

  // A second case at the same level in a season goes one level up (rule 4).
  let cat = getFineCategory(k.category_id);
  let bumped = '';
  if (k.level > 0 && k.level < 4) {
    const repeat = db.prepare(`SELECT 1 FROM fine_cases WHERE player_id = ? AND season = ? AND status = 'approved' AND kind = 'fine' AND level = ? AND id != ?`).get(k.player_id, k.season, k.level, k.id);
    const up = repeat && getAllFineCategories().find(c => c.level === k.level + 1 && c.active);
    if (up) {
      cat = up;
      bumped = `Second Level ${k.level} this season, so charged as ${up.label}.`;
      db.prepare('UPDATE fine_cases SET category_id = ?, category_label = ?, amount = ?, points = ?, min_suspension_games = ?, level = ? WHERE id = ?')
        .run(up.id, up.label, up.amount, up.points || 0, up.min_suspension_games || 0, up.level, k.id);
    }
  }
  const kase = getFineCase(k.id);
  const before = seasonPoints(kase.player_id, kase.season, kase.id);
  const after = before + Number(kase.points || 0);
  const tierUp = tierGames(after) !== tierGames(before) ? tierGames(after) : 0;
  const games = tierUp === -1 ? -1 : Math.max(tierUp, Number(kase.min_suspension_games) || 0);

  const txId = Number(kase.amount) > 0 ? randomBytes(6).toString('hex') : '';
  if (txId) {
    recordTransaction({
      id: txId, player_id: kase.player_id, amount: kase.amount, type: 'charge', payment_method: '', date: manilaYmd(Date.now()), status: 'confirmed',
      notes: `Fine — ${kase.category_label}${kase.description ? `: ${kase.description}` : ''}`.slice(0, 500), reference_no: kase.id, season: '', category: 'Penalty',
    });
  }
  const fullNote = [bumped, why].filter(Boolean).join(' ');
  resolveFineCase(kase.id, { approved: true, resolvedByName: actorName, note: fullNote, transactionId: txId });
  const due = Date.now() + PAY_DAYS * DAY;
  db.prepare('UPDATE fine_cases SET evidence = ?, due_at = ?, suspension_games = ? WHERE id = ?').run(evidence, txId ? due : null, games, kase.id);
  createNotification({
    playerId: kase.player_id, type: 'fine_approved',
    title: `You've been fined ${peso(kase.amount)}: ${kase.category_label}`,
    body: `${plural(Number(kase.points) || 0, 'conduct point')} (${after} this season).${txId ? ` Due by ${dayLabel(due)}.` : ''} You can appeal until ${dayLabel(Date.now() + APPEAL_DAYS * DAY)}.`,
    link: '/me/conduct',
  });
  if (games) {
    createNotification({
      playerId: kase.player_id, type: 'suspended',
      title: games === -1 ? 'You’re suspended for the rest of the season' : `You’re suspended for ${plural(games, 'league game')}`,
      body: `${games === -1 ? `${after} conduct points this season. A league review decides next season.` : 'You sit out your team’s next league games.'} No Papawis runs until it’s served.`,
      link: '/me/conduct',
    });
  }
  return { ok: true, message: `Fine approved${bumped ? ' one level up' : ''}${games ? `, ${games === -1 ? 'suspended for the rest of the season' : `${plural(games, 'game')} suspension`}` : ''}.` };
}

// A warning: on record, ₱0, 0 points. Every WARNINGS_FOR_L1th one in a season opens a Level 1 case.
function issueWarning(k, { why, evidence, actorName }) {
  resolveFineCase(k.id, { approved: true, resolvedByName: actorName, note: why });
  db.prepare(`UPDATE fine_cases SET kind = 'warning', amount = 0, points = 0, min_suspension_games = 0, evidence = ? WHERE id = ?`).run(evidence || '', k.id);
  const n = db.prepare(`SELECT COUNT(*) AS n FROM fine_cases WHERE player_id = ? AND season = ? AND kind = 'warning' AND status = 'approved'`).get(k.player_id, k.season).n;
  createNotification({
    playerId: k.player_id, type: 'fine_warning', title: `A warning on your record: ${k.category_label}`,
    body: `No fine, no points. ${why} This is warning ${n} this season; warning ${WARNINGS_FOR_L1} becomes a Level 1 case.`, link: '/me/conduct',
  });
  let extra = '';
  if (n % WARNINGS_FOR_L1 === 0) {
    const l1 = getAllFineCategories().find(c => c.level === 1 && c.active);
    if (l1) {
      fileCase({
        playerId: k.player_id, categoryId: l1.id, context: k.incident_context, incidentDate: manilaYmd(Date.now()),
        description: `${plural(n, 'warning')} this season, so this opens a Level 1 case automatically (rule 3). An admin still decides it.`,
        reportedByType: 'system', reportedById: 'warnings', reportedByName: 'Warnings',
      });
      extra = ' That was their third this season, so a Level 1 case is open.';
    }
  }
  return { ok: true, message: `Warning given.${extra}` };
}

// A Barkadahan mute is a warning (rule 3): on their record at once, no 72 hours (the mute
// already happened), and it counts toward the third-warning Level 1 like any other.
export function muteWarning(playerId, { days, byId, byName }) {
  const l1 = getAllFineCategories().find(c => c.level === 1) || getAllFineCategories()[0];
  if (!l1 || !getPlayerById(playerId)) return null;
  const now = Date.now();
  const r = createFineCase({
    playerId, categoryId: l1.id, description: `Muted in the Barkadahan for ${days === 1 ? 'a day' : 'a week'}.`,
    reportedByType: 'admin', reportedById: byId, reportedByName: byName, season: caseSeasonFor(now), incidentAt: now, incidentContext: 'online',
  });
  if (r.error) return null;
  db.prepare(`UPDATE fine_cases SET category_label = 'Muted in the Barkadahan', opened_at = ? WHERE id = ?`).run(now, r.id);
  issueWarning(getFineCase(r.id), { why: `An admin muted you in the Barkadahan for ${days === 1 ? 'a day' : 'a week'}.`, evidence: '', actorName: byName });
  return r.id;
}

// Cancel a decided case: the charge comes off their ledger (a payment already made stays as
// credit), the points and any suspension go. super admin only (server.js).
export function voidCase(id, { actorName, note = '' }) {
  const k = getFineCase(id);
  if (!k || k.status !== 'approved') return { error: 'Only a decided fine or warning can be cancelled.' };
  if (k.transaction_id) voidTransaction(k.transaction_id);
  db.prepare(`UPDATE fine_cases SET status = 'voided', voided_at = ?, voided_by = ?, suspension_games = 0 WHERE id = ?`).run(Date.now(), actorName, id);
  logCase(id, actorName, `Cancelled${note ? `: ${note}` : ''}${k.paid_at ? ' (their payment stays on their balance as credit)' : ''}`);
  createNotification({ playerId: k.player_id, type: 'fine_voided', title: `Your ${k.kind === 'warning' ? 'warning' : 'fine'} was cancelled: ${k.category_label}`, body: `It's off your record${k.transaction_id ? ' and your balance' : ''}.${note ? ` ${note}` : ''}`, link: '/me/conduct' });
  return { ok: true };
}

// Re-categorise while the case is still open or waiting for escalation (the "Something else"
// category promised this; Fable audit 2.13).
export function changeCaseCategory(id, categoryId, actorName) {
  const k = getFineCase(id);
  const c = getFineCategory(categoryId);
  if (!k || !['open', 'pending_admin'].includes(k.status)) return { error: 'Only an open case can change category.' };
  if (!c) return { error: 'Pick a category.' };
  if (c.id === k.category_id) return { ok: true };
  db.prepare('UPDATE fine_cases SET category_id = ?, category_label = ?, amount = ?, points = ?, min_suspension_games = ?, level = ? WHERE id = ?')
    .run(c.id, c.label, c.amount, c.points || 0, c.min_suspension_games || 0, c.level || 0, id);
  logCase(id, actorName, `Category changed from ${k.category_label} to ${c.label}`);
  return { ok: true };
}

// ── Appeal (rule 9) ──────────────────────────────────────────────────────────────
export const appealOpenUntil = k => (Number(k.resolved_at) || 0) + APPEAL_DAYS * DAY;
export const canAppeal = k => k.status === 'approved' && !k.appeal_at && Date.now() <= appealOpenUntil(k);
export function appealCase(id, playerId, text) {
  const k = getFineCase(id);
  if (!k || k.player_id !== playerId) return { error: 'Not found.' };
  if (!canAppeal(k)) return { error: k.appeal_at ? 'You’ve already appealed this one.' : 'The appeal window has closed.' };
  const t = String(text || '').trim().slice(0, 3000);
  if (t.length < 20) return { error: 'Say what the decision got wrong.' };
  db.prepare(`UPDATE fine_cases SET appeal_text = ?, appeal_at = ?, appeal_status = 'pending' WHERE id = ?`).run(t, Date.now(), id);
  return { ok: true };
}
export const appealVotes = id => getFineVotesForCase(id).filter(v => v.voter_type === 'appeal');
// The super admin decides after APPEAL_HEADS uninvolved heads have weighed in, or once
// APPEAL_DAYS have passed without them (a stalled appeal shouldn't hang over the player).
export const appealReady = k => appealVotes(k.id).length >= APPEAL_HEADS || Date.now() >= (Number(k.appeal_at) || 0) + APPEAL_DAYS * DAY;
export function eligibleAppealHeads(k) {
  return [...new Set(getAllTeamHeads().map(h => h.player_id))].filter(h => !appealHeadBlock(h, k));
}

// outcome: 'upheld' | 'lowered' (to categoryId, or a warning when toWarning) | 'cancelled'.
// An appeal only lowers or confirms, never raises.
export function decideAppeal(id, { outcome, categoryId = '', toWarning = false, note = '', actorName }) {
  const k = getFineCase(id);
  if (!k || k.appeal_status !== 'pending') return { error: 'There’s no appeal waiting on this case.' };
  if (!appealReady(k)) return { error: `Wait for ${APPEAL_HEADS} heads from teams not involved, or until ${dayLabel(Number(k.appeal_at) + APPEAL_DAYS * DAY)}.` };
  const why = String(note || '').trim();
  if (!why) return { error: 'Write the reason. The player reads it.' };
  const now = Date.now();
  const due = now + PAY_DAYS * DAY;
  const finish = status => db.prepare('UPDATE fine_cases SET appeal_status = ?, appeal_decided_at = ?, appeal_decided_by = ?, appeal_note = ? WHERE id = ?').run(status, now, actorName, why, id);
  if (outcome === 'upheld') {
    finish('upheld');
    if (k.transaction_id && !k.paid_at) db.prepare('UPDATE fine_cases SET due_at = ? WHERE id = ?').run(due, id);
    createNotification({ playerId: k.player_id, type: 'appeal_decided', title: 'Your appeal was decided: the decision stands', body: `${why}${k.transaction_id && !k.paid_at ? ` Your fine is due by ${dayLabel(due)}.` : ''}`, link: '/me/conduct' });
    return { ok: true, message: 'Decision upheld.' };
  }
  if (outcome === 'cancelled') {
    finish('cancelled');
    voidCase(id, { actorName, note: `Appeal won. ${why}` });
    return { ok: true, message: 'Appeal won: the case is cancelled.' };
  }
  if (outcome !== 'lowered') return { error: 'Pick an outcome.' };
  const c = toWarning ? null : getFineCategory(categoryId);
  if (!toWarning && (!c || !(c.level > 0) || c.level >= k.level)) return { error: 'Pick a lower level, or a warning.' };
  if (k.transaction_id) voidTransaction(k.transaction_id);
  let txId = '';
  if (c && Number(c.amount) > 0) {
    txId = randomBytes(6).toString('hex');
    recordTransaction({ id: txId, player_id: k.player_id, amount: c.amount, type: 'charge', payment_method: '', date: manilaYmd(now), status: 'confirmed', notes: `Fine — ${c.label} (lowered on appeal)`, reference_no: k.id, season: '', category: 'Penalty' });
  }
  if (toWarning) {
    db.prepare(`UPDATE fine_cases SET kind = 'warning', amount = 0, points = 0, min_suspension_games = 0, suspension_games = 0, transaction_id = '', due_at = NULL WHERE id = ?`).run(id);
  } else {
    // Games already sat out stay served; what's owed is recomputed from the lower level's floor.
    db.prepare('UPDATE fine_cases SET category_id = ?, category_label = ?, amount = ?, points = ?, min_suspension_games = ?, level = ?, transaction_id = ?, due_at = ?, suspension_games = MIN(suspension_games, ?) WHERE id = ?')
      .run(c.id, c.label, c.amount, c.points || 0, c.min_suspension_games || 0, c.level, txId, txId ? due : null, c.min_suspension_games || 0, id);
  }
  finish('lowered');
  logCase(id, actorName, `Lowered on appeal from ${k.category_label} to ${toWarning ? 'a warning' : c.label}${k.paid_at ? ' (the payment made stays on their balance)' : ''}`);
  createNotification({ playerId: k.player_id, type: 'appeal_decided', title: `Your appeal was decided: lowered to ${toWarning ? 'a warning' : c.label}`, body: `${why}${txId ? ` ${peso(c.amount)}, due by ${dayLabel(due)}.` : ''}`, link: '/me/conduct' });
  return { ok: true, message: 'Lowered.' };
}

// ── Suspensions (rule 4) ─────────────────────────────────────────────────────────
// Served one game at a time by missing a league game your team played after the decision day;
// a game they played anyway doesn't count. Suspensions run one after another. -1 = the rest of
// the season: served once a later season has started. Returns
// { active, left, rest, cases: [{ id, games, served, rest, done, playedWhile: [gameIds] }] }.
export function suspensionStanding(playerId) {
  const rows = db.prepare(`SELECT id, season, resolved_at, suspension_games FROM fine_cases WHERE player_id = ? AND status = 'approved' AND suspension_games != 0 ORDER BY resolved_at`).all(playerId);
  if (!rows.length) return { active: false, left: 0, rest: false, cases: [] };
  const team = teamOf(playerId);
  const games = team ? db.prepare(`SELECT g.id, g.date, g.season, EXISTS (SELECT 1 FROM game_player_stats s WHERE s.game_id = g.id AND s.player_id = ?) AS played
    FROM games g WHERE (g.team_a_id = ? OR g.team_b_id = ?) AND g.under_review = 0 AND COALESCE(g.status, '') NOT IN ('scheduled', '') AND COALESCE(g.scheduled, 0) = 0 AND g.date != ''
    ORDER BY g.date, g.sort_order, g.id`).all(playerId, team, team) : [];
  const nowSeason = seasonOnDate(manilaYmd(Date.now()), seasonStarts());
  let cursor = '';
  let left = 0, rest = false;
  const cases = rows.map(r => {
    const from = [manilaYmd(r.resolved_at), cursor].sort().pop();
    if (r.suspension_games === -1) {
      const over = !!nowSeason && Number(nowSeason) > Number(r.season);
      if (!over) rest = true;
      return { id: r.id, games: -1, served: 0, rest: true, done: over, playedWhile: games.filter(g => g.date > from && String(g.season) === String(r.season) && g.played).map(g => g.id) };
    }
    let served = 0;
    const playedWhile = [];
    for (const g of games) {
      if (g.date <= from || served >= r.suspension_games) continue;
      if (g.played) { playedWhile.push(g.id); continue; }
      served++;
      cursor = g.date;
    }
    if (served < r.suspension_games) left += r.suspension_games - served;
    return { id: r.id, games: r.suspension_games, served, rest: false, done: served >= r.suspension_games, playedWhile };
  });
  return { active: rest || left > 0, left, rest, cases };
}

// After a game is saved and hourly: a suspension just served gets its bell, once.
export function syncSuspensions() {
  const ids = db.prepare(`SELECT DISTINCT player_id FROM fine_cases WHERE status = 'approved' AND suspension_games != 0 AND suspension_done_at IS NULL`).all().map(r => r.player_id);
  for (const pid of ids) {
    const st = suspensionStanding(pid);
    for (const c of st.cases) {
      if (!c.done || db.prepare('SELECT suspension_done_at FROM fine_cases WHERE id = ?').get(c.id).suspension_done_at) continue;
      db.prepare('UPDATE fine_cases SET suspension_done_at = ? WHERE id = ?').run(Date.now(), c.id);
      if (!st.active) createNotification({ playerId: pid, type: 'suspension_served', title: 'Your suspension is served', body: 'You can play league games and join Papawis runs again.', link: '/me/conduct' });
    }
  }
}

// ── Paying (rule 10) ─────────────────────────────────────────────────────────────
// Unpaid past due, not under appeal: they can't play until it's paid.
const stmtOverdue = () => db.prepare(`SELECT * FROM fine_cases WHERE status = 'approved' AND kind = 'fine' AND paid_at IS NULL AND transaction_id != '' AND due_at IS NOT NULL AND due_at < ? AND appeal_status != 'pending'`);
export function overdueFines(playerId) { return stmtOverdue().all(Date.now()).filter(k => !playerId || k.player_id === playerId); }

// Bans players with an overdue fine (ban_kind 'fine'), lifts it once nothing is overdue, and
// sends one reminder bell 3 days before a fine is due. Hourly, beside the balance sweep.
export function runFineSweep() {
  const now = Date.now();
  const overdue = overdueFines();
  const owing = new Set(overdue.map(k => k.player_id));
  const out = { banned: [], lifted: [] };
  for (const p of getBannedPlayers()) {
    if (p.ban_kind !== 'fine' || owing.has(p.id)) continue;
    setPlayerBanned(p.id, false, '', { byAdmin: false });
    createNotification({ playerId: p.id, type: 'ban_lifted', title: 'Your fine is settled', body: 'You can play again. See you on court!', link: '/me/conduct' });
    out.lifted.push(p.id);
  }
  const banned = new Set(getBannedPlayers().map(p => p.id));
  for (const pid of owing) {
    if (banned.has(pid)) continue;
    const ks = overdue.filter(k => k.player_id === pid);
    setPlayerBanned(pid, true, `Unpaid fine past its due date (automatic)`, { kind: 'fine' });
    createNotification({ playerId: pid, type: 'banned', title: 'You can’t play until your fine is paid', body: `${peso(ks.reduce((s, k) => s + Number(k.amount || 0), 0))} was due ${dayLabel(Math.min(...ks.map(k => k.due_at)))}. It lifts the moment we confirm the payment.`, link: '/settle-balance' });
    out.banned.push(pid);
  }
  for (const k of db.prepare(`SELECT * FROM fine_cases WHERE status = 'approved' AND kind = 'fine' AND paid_at IS NULL AND due_at BETWEEN ? AND ? AND due_reminded_at IS NULL AND appeal_status != 'pending'`).all(now, now + 3 * DAY)) {
    db.prepare('UPDATE fine_cases SET due_reminded_at = ? WHERE id = ?').run(now, k.id);
    createNotification({ playerId: k.player_id, type: 'fine_due', title: `Your ${peso(k.amount)} fine is due ${dayLabel(k.due_at)}`, body: 'After that you can’t play until it’s paid.', link: '/settle-balance' });
  }
  return out;
}

// ── What the player sees (/me/conduct, /app/conduct) ─────────────────────────────
// Cases that reached them: open ones (they've been told), decided, cancelled. Never a report
// still behind the admin escalation gate, or one dismissed there.
export function conductRecord(playerId) {
  const season = getPortalCurrentSeason();
  const cases = db.prepare(`SELECT * FROM fine_cases WHERE player_id = ? AND status IN ('open', 'approved', 'rejected', 'voided') AND (status != 'open' OR opened_at IS NOT NULL) ORDER BY COALESCE(resolved_at, created_at) DESC`).all(playerId);
  const thisSeason = cases.filter(k => String(k.season) === String(season) && k.status === 'approved');
  return {
    season,
    points: thisSeason.filter(k => k.kind === 'fine').reduce((s, k) => s + Number(k.points || 0), 0),
    warnings: thisSeason.filter(k => k.kind === 'warning').length,
    suspension: suspensionStanding(playerId),
    owed: cases.filter(k => k.status === 'approved' && k.kind === 'fine' && k.transaction_id && !k.paid_at).reduce((s, k) => s + Number(k.amount || 0), 0),
    cases: cases.map(k => ({
      ...k,
      by: k.reported_by_type === 'player' ? 'A player' : k.reported_by_type === 'system' ? k.reported_by_name : k.reported_by_name || 'An admin',
      canRespond: k.status === 'open',
      canAppeal: canAppeal(k),
      appealUntil: appealOpenUntil(k),
    })),
  };
}

// Anonymous counts per season for /rules/conduct (rule 13): decided cases by level, warnings,
// appeals and how they went, suspensions.
export function seasonConductCounts() {
  const rows = db.prepare(`SELECT season, kind, level, status, appeal_status, suspension_games FROM fine_cases WHERE status IN ('approved', 'rejected', 'voided') AND season != ''`).all();
  const by = {};
  for (const r of rows) {
    const s = (by[r.season] ??= { season: r.season, warnings: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 }, rejected: 0, cancelled: 0, appeals: 0, appealsWon: 0, suspensions: 0 });
    if (r.status === 'rejected') s.rejected++;
    else if (r.status === 'voided') s.cancelled++;
    else if (r.kind === 'warning') s.warnings++;
    else s.levels[r.level || 0]++;
    if (r.appeal_status && r.appeal_status !== 'pending') { s.appeals++; if (r.appeal_status !== 'upheld') s.appealsWon++; }
    if (r.status === 'approved' && r.suspension_games !== 0) s.suspensions++;
  }
  return Object.values(by).sort((a, b) => Number(b.season) - Number(a.season));
}

// For the admin case page and season selection: a player's last two seasons at a glance.
export function conductSummary(playerId, seasons) {
  const list = seasons.map(String);
  const rows = db.prepare(`SELECT season, kind, level, points FROM fine_cases WHERE player_id = ? AND status = 'approved'`).all(playerId).filter(r => list.includes(String(r.season)));
  const pointsBySeason = {};
  for (const r of rows) if (r.kind === 'fine') pointsBySeason[r.season] = (pointsBySeason[r.season] || 0) + Number(r.points || 0);
  return {
    warnings: rows.filter(r => r.kind === 'warning').length,
    maxPoints: Math.max(0, ...Object.values(pointsBySeason)),
    serious: rows.filter(r => r.kind === 'fine' && r.level >= 3).length,
    level4: rows.filter(r => r.kind === 'fine' && r.level === 4).length,
  };
}
