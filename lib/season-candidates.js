// Next-season candidates (draft criteria, Paolo + Fable review, 2026-10-29): every active
// player ranked by who should get a spot. Admin-only (/admin/season/candidates); nothing here
// is shown to players or changes a signup.
//
// Must have: an approved account, not banned, owes nothing (balance under ₱100).
// Groups: 1 = played at least half of last season, in good standing; 2 = Papawis regular (4+
// runs in a year); 3 = everyone else (new members, players coming back).
// Inside a group: fewest marks first, then most pluses, then most active weeks, games, runs.
// Marks: not active online (6 of the last 12 weeks; new members exempt), pay first, low
// attendance (under two thirds), conduct (an approved fine or 2+ technicals in a season), late
// cancellations (2+ Papawis cancels in the last 24 hours before a run, in a year).
// Pluses: plays both league and Papawis (knows almost everyone), contributed (scored games,
// setup, refereeing). "Discuss" (2+ fines, a disqualification or a suspension) needs an admin
// decision before a spot.
// Payment record, each of the last two seasons: on time / chased / still owing / after season.
// "Pay first" = any after-season, or chased (or still owing) in both: they'd pay in full before
// the first game, no installment plan.
import { db, CONTRIBUTION_KINDS } from './portal-db.js';
import { AWARD_SHARE } from './qualification.js';
import { foldGame } from '../public/score-engine.js';

export const RULES = {
  onlineWeeksNeeded: 6,     // of the last onlineWindowWeeks
  onlineWindowWeeks: 12,
  papawisRegularRuns: 4,    // confirmed, own slot, completed run, last 365 days
  maxGapDays: 30,           // longest gap between payments while owing before it counts as chased
  billGraceDays: 14,        // never due sooner than this after the bill
  owingToleranceAmt: 100,   // a balance under this doesn't count as owing
  newMemberDays: 84,        // approved this recently and never played a league game
  attendanceShare: AWARD_SHARE, // of their team's games last season: under this is a mark
  attendanceMinShare: 0.5,  // under this, last season doesn't count for Group 1
  lateCancelHours: 24,      // a Papawis cancel this close to the run is late (admin removals too)
  lateCancelsForMark: 2,    // in the last 365 days
  techsForMark: 2,          // technicals + unsportsmanlike in one season (the ejection count)
  // Admins Paolo approved (2026-10-29) to get no marks: their records carry admin work and
  // testing (removals, test signups, scorer runs). Pluses and the must-haves still apply.
  noMarksPlayerIds: [
    'cf7fccd4-b88c-4f26-abab-fba22084c2e5', // Jose Paolo Ty
    '84d9430f-c78f-4c4d-9cef-9beee02ccf47', // Joel Rey Cuardo
    'aacfa7ee-d059-4c00-a0b6-de7ae776e43a', // Paul Erickson Sarmiento
    'c63167f4-5545-4cfa-a2ef-74167a0dc418', // Mejari Garganta
    'c7f1c4e5-d25d-42c0-bd59-6a127c2c17ba', // Carl Gaspar
    '6fabae8d-f7fe-4023-b01b-29144cacb53e', // JM Angeles
  ],
};
export { CONTRIBUTION_KINDS };

export const MARK_LABELS = {
  inactive: 'Not active online', payFirst: 'Pay first', attendance: 'Low attendance',
  conduct: 'Conduct', lateCancels: 'Late cancellations',
};
export const PLUS_LABELS = { both: 'League + Papawis', contributed: 'Contributed' };

const DAY = 86400000;
// Ledger and game dates are Manila calendar days.
const dayMs = s => (s ? Date.parse(`${String(s).slice(0, 10)}T00:00:00+08:00`) : NaN);
const isoDay = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
// Only season-fee rows are graded: Papawis, equipment and other charges carry a season tag
// too, and would otherwise give a grade for a season the player wasn't in. ('Season Fee' is
// the payment spelling, 'season_fee' the bulk charge's; one Season 4 payment is 'Game Fee'.)
export const isSeasonFee = t => ['season fee', 'season_fee', 'game fee'].includes(String(t.category || '').trim().toLowerCase());
const toMs = v => (typeof v === 'number' ? (v > 0 && v < 1e12 ? v * 1000 : v) : (v ? Date.parse(v) || 0 : 0));

// One season's fee record from its season-tagged ledger rows (confirmed, date order).
// season: { firstGame, lastRegular, lastGame, over } as day strings + bool. plan: 'full' |
// 'installment' (full payers are due by the first game, installments by the last regular game).
export function gradeSeason(tx, season, { plan = 'installment', now = Date.now(), rules = RULES } = {}) {
  const charges = tx.filter(t => t.type === 'charge');
  const charged = charges.reduce((s, t) => s + t.amount, 0);
  if (charged <= 0) return null;
  const billed = Math.min(...charges.map(t => dayMs(t.date)));
  let paid = 0, settledAt = null, prev = billed, longestGap = 0;
  for (const t of tx.filter(t => t.type === 'payment')) {
    const d = Math.max(dayMs(t.date), billed); // a deposit before the bill counts from the bill
    if (settledAt == null) longestGap = Math.max(longestGap, (d - prev) / DAY);
    prev = d; paid += t.amount;
    if (settledAt == null && paid > charged - rules.owingToleranceAmt) settledAt = d;
  }
  if (settledAt == null) longestGap = Math.max(longestGap, (now - prev) / DAY);
  const due = Math.max(dayMs(plan === 'full' ? season.firstGame : season.lastRegular), billed + rules.billGraceDays * DAY);
  let grade;
  if (settledAt == null) grade = season.over ? 'after' : 'owing';
  else if (season.over && settledAt > dayMs(season.lastGame)) grade = 'after';
  else if (settledAt > due || longestGap > rules.maxGapDays) grade = 'chased';
  else grade = 'ontime';
  return {
    grade, plan, charged, paid, owing: Math.max(0, charged - paid),
    billed: isoDay(billed), due: isoDay(due), settled: settledAt == null ? '' : isoDay(settledAt),
    daysToSettle: settledAt == null ? null : Math.round((settledAt - billed) / DAY),
    longestGap: Math.round(longestGap),
  };
}

// people: [{ id, name, hasAccount, banned, balance, playedLast, games: {season: n},
// papawisRuns, activeWeeks, isNew, pay: [grade|null, ...], attendance: { played, teamGames } |
// null, conduct: { fines, suspended, maxTechs, dq }, lateCancels, contributions }] → same rows
// plus group, active, payFirst, marks, pluses, discuss, blockers, eligible, rank, best first.
export function rankCandidates(people, { rules = RULES } = {}) {
  const rows = people.map(p => {
    const grades = (p.pay || []).filter(Boolean).map(g => g.grade);
    const payFirst = grades.includes('after') || grades.filter(g => g === 'chased' || g === 'owing').length >= 2;
    const owes = p.balance >= rules.owingToleranceAmt;
    const blockers = [
      !p.hasAccount && 'No account',
      p.banned && 'Banned',
      owes && 'Owes',
    ].filter(Boolean);
    const att = p.attendance;
    const share = att && att.teamGames ? att.played / att.teamGames : null;
    const fullSeason = p.playedLast && (share == null || share >= rules.attendanceMinShare);
    const regular = p.papawisRuns >= rules.papawisRegularRuns;
    const group = fullSeason && !owes && !p.banned ? 1 : regular ? 2 : 3;
    const active = p.activeWeeks >= rules.onlineWeeksNeeded;
    const c = p.conduct || {};
    const exempt = rules.noMarksPlayerIds.includes(p.id);
    const marks = exempt ? [] : [
      !active && !p.isNew && 'inactive',
      payFirst && 'payFirst',
      share != null && share < rules.attendanceShare && 'attendance',
      (c.fines > 0 || c.maxTechs >= rules.techsForMark) && 'conduct',
      p.lateCancels >= rules.lateCancelsForMark && 'lateCancels',
    ].filter(Boolean);
    const pluses = [
      p.playedLast && regular && 'both',
      p.contributions > 0 && 'contributed',
    ].filter(Boolean);
    const discuss = !exempt && (c.fines >= 2 || c.dq > 0 || !!c.suspended);
    return { ...p, group, active, payFirst: payFirst && !exempt, marks, pluses, discuss, exempt, blockers, eligible: blockers.length === 0 };
  });
  const totalGames = r => Object.values(r.games || {}).reduce((s, n) => s + n, 0);
  const key = r => [r.eligible ? 0 : 1, r.group, r.marks.length, -r.pluses.length, -r.activeWeeks, -totalGames(r), -r.papawisRuns];
  rows.sort((a, b) => {
    const x = key(a), y = key(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.name.localeCompare(b.name);
  });
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// Everything the page needs, read from the database. The last two seasons with games are
// graded; a season is over once it has a champion or a later season has games.
export function loadSeasonCandidates({ now = Date.now(), rules = RULES } = {}) {
  const seasonRows = db.prepare(`
    SELECT season, MIN(date) AS first, MAX(date) AS last, MAX(CASE WHEN game_type = 'regular' THEN date END) AS last_reg
    FROM games WHERE season IS NOT NULL GROUP BY season ORDER BY season DESC LIMIT 2`).all().reverse();
  const champs = new Set(db.prepare(`SELECT DISTINCT season FROM awards WHERE award_type = 'champion'`).all().map(r => String(r.season)));
  const latest = seasonRows.length ? seasonRows[seasonRows.length - 1].season : 0;
  const seasons = seasonRows.map(s => ({
    season: s.season, firstGame: s.first, lastRegular: s.last_reg || s.last, lastGame: s.last,
    over: s.season < latest || champs.has(String(s.season)),
  }));
  const lastSeason = seasons[seasons.length - 1]?.season;

  const players = db.prepare(`
    SELECT p.id, p.first_name, p.last_name, p.banned_at, p.ban_lifted_at, p.last_seen_at AS app_seen,
           r.id AS reg_id, r.approved_at, r.created_at AS reg_created, r.last_login_at, r.last_seen_at AS site_seen
    FROM players p
    LEFT JOIN registrations r ON r.id = (SELECT id FROM registrations WHERE player_id = p.id AND status = 'approved' ORDER BY approved_at DESC LIMIT 1)
    WHERE p.status = 'active'`).all();

  const games = {};
  for (const r of db.prepare(`
    SELECT gps.player_id, g.season, COUNT(*) AS n FROM game_player_stats gps JOIN games g ON g.id = gps.game_id
    WHERE COALESCE(gps.minutes, 0) + gps.pts + gps.reb + gps.ast + gps.stl + gps.blk + gps.pf > 0
    GROUP BY gps.player_id, g.season`).all()) (games[r.player_id] ??= {})[r.season] = r.n;

  const sinceYear = isoDay(now - 365 * DAY);
  const runs = Object.fromEntries(db.prepare(`
    SELECT s.player_id, COUNT(*) AS n FROM papawis_signups s JOIN papawis_games g ON g.id = s.game_id
    WHERE s.status = 'confirmed' AND COALESCE(s.guest_name, '') = '' AND g.status = 'completed' AND g.date >= ?
    GROUP BY s.player_id`).all(sinceYear).map(r => [r.player_id, r.n]));

  // Online: distinct weeks (counted back from today) with any sign of the player on the site
  // or app — a page visit, a pick, comment, poll vote, chat message, Papawis signup or app open.
  // Also kept apart by where it happened (site, app, actions) as extra context on the page.
  const since = now - rules.onlineWindowWeeks * 7 * DAY;
  const weeks = {}, byKind = {}, lastSeen = {};
  const seen = (pid, ms, kind) => {
    if (!pid || !(ms >= since) || ms > now) return;
    const w = Math.floor((now - ms) / (7 * DAY));
    (weeks[pid] ??= new Set()).add(w);
    ((byKind[pid] ??= { site: new Set(), app: new Set(), action: new Set() })[kind]).add(w);
    if (kind !== 'action' && ms > (lastSeen[pid] || 0)) lastSeen[pid] = ms;
  };
  const regToPlayer = Object.fromEntries(players.filter(p => p.reg_id).map(p => [p.reg_id, p.id]));
  // Admin work never counts as the player's own activity: admin pages a player-admin visited,
  // and Papawis slots an admin added for them (Add player, Autofill: logged "added by admin").
  // "View as" sessions are already left out where each of these is recorded.
  for (const r of db.prepare(`
    SELECT DISTINCT player_id, day, path LIKE '/app%' AS app FROM page_views
    WHERE player_id != '' AND day >= ? AND path NOT LIKE '/admin%' AND path NOT LIKE '/app/admin%'`).all(isoDay(since))) seen(r.player_id, dayMs(r.day) + 12 * 3600000, r.app ? 'app' : 'site');
  for (const r of db.prepare(`SELECT player_id AS pid, created_at AS t FROM app_events WHERE created_at >= ?`).all(since)) seen(r.pid, toMs(r.t), 'app');
  for (const sql of [
    `SELECT player_id AS pid, created_at AS t FROM game_picks WHERE created_at >= ?`,
    `SELECT player_id AS pid, created_at AS t FROM game_comments WHERE created_at >= ?`,
    `SELECT player_id AS pid, created_at AS t FROM barkadahan_messages WHERE created_at >= ?`,
    `SELECT s.player_id AS pid, s.signed_up_at AS t FROM papawis_signups s
     WHERE COALESCE(s.guest_name, '') = '' AND s.signed_up_at >= ?
       AND NOT EXISTS (SELECT 1 FROM papawis_activity_log l WHERE l.game_id = s.game_id AND l.player_id = s.player_id
                       AND l.event_type = 'joined' AND l.notes LIKE 'added by admin%')`,
  ]) for (const r of db.prepare(sql).all(since)) seen(r.pid, toMs(r.t), 'action');
  for (const r of db.prepare(`SELECT voter_id, created_at AS t FROM league_poll_votes WHERE created_at >= ?`).all(since)) seen(regToPlayer[r.voter_id] || r.voter_id, toMs(r.t), 'action');
  for (const p of players) {
    for (const t of [p.last_login_at, p.site_seen]) seen(p.id, toMs(t), 'site');
    seen(p.id, toMs(p.app_seen), 'app');
  }

  // Attendance last season: games played out of the team games they were on the roster for
  // (played + marked DNP).
  const teamGames = Object.fromEntries(db.prepare(`
    SELECT player_id, COUNT(DISTINCT game_id) AS n FROM (
      SELECT gps.player_id, gps.game_id FROM game_player_stats gps JOIN games g ON g.id = gps.game_id WHERE g.season = ?
      UNION SELECT d.player_id, d.game_id FROM game_dnp d JOIN games g ON g.id = d.game_id WHERE g.season = ?)
    GROUP BY player_id`).all(lastSeason, lastSeason).map(r => [r.player_id, r.n]));

  // Conduct, last two seasons: approved fines (rejected or dismissed never count), and
  // technicals / unsportsmanlike / disqualifications from scorer-published games.
  const gradedSeasons = seasons.map(s => String(s.season));
  const conduct = {};
  const cd = pid => (conduct[pid] ??= { fines: 0, suspended: false, techs: {}, maxTechs: 0, dq: 0, fineList: [] });
  for (const f of db.prepare(`SELECT player_id, season, category_label, min_suspension_games FROM fine_cases WHERE status = 'approved'`).all()) {
    if (!gradedSeasons.includes(String(f.season))) continue;
    const c = cd(f.player_id);
    c.fines++; c.fineList.push(`S${f.season} ${f.category_label}`);
    if (f.min_suspension_games > 0) c.suspended = true;
  }
  const scored = {};
  for (const sg of db.prepare(`
    SELECT sg.game_id, g.season, EXISTS (SELECT 1 FROM score_events e WHERE e.game_id = sg.game_id AND e.pass = 'video') AS has_video
    FROM score_games sg JOIN games g ON g.id = sg.game_id WHERE sg.status = 'published'`).all()) {
    const rows = db.prepare('SELECT * FROM score_events WHERE game_id = ? AND pass = ? ORDER BY pos, received_at').all(sg.game_id, sg.has_video ? 'video' : 'live');
    for (const a of new Set(rows.map(r => r.author_id).filter(Boolean))) scored[a] = (scored[a] || 0) + 1;
    if (!gradedSeasons.includes(String(sg.season))) continue;
    const { players: lines } = foldGame(rows.map(r => ({ ...JSON.parse(r.payload_json), id: r.id, pos: r.pos, type: r.type })));
    for (const [pid, L] of Object.entries(lines)) {
      if (!L.tech && !L.unsp && !L.dq) continue;
      const c = cd(pid);
      c.techs[sg.season] = (c.techs[sg.season] || 0) + L.tech + L.unsp;
      c.maxTechs = Math.max(c.maxTechs, c.techs[sg.season]);
      c.dq += L.dq;
    }
  }

  // Late Papawis cancellations in the last year: cancelled within lateCancelHours of the run's
  // start, admin removals included (players ask an admin to take them off); cancelled runs don't count.
  const lateCancels = {};
  for (const r of db.prepare(`
    SELECT s.player_id, s.cancelled_at, g.date, g.start_time FROM papawis_signups s JOIN papawis_games g ON g.id = s.game_id
    WHERE s.cancelled_at > 0 AND COALESCE(s.guest_name, '') = '' AND g.status != 'cancelled' AND g.date >= ?`).all(sinceYear)) {
    const start = Date.parse(`${r.date}T${/^\d\d:\d\d$/.test(r.start_time || '') ? r.start_time : '12:00'}:00+08:00`);
    if (r.cancelled_at <= start && start - r.cancelled_at <= rules.lateCancelHours * 3600000) lateCancels[r.player_id] = (lateCancels[r.player_id] || 0) + 1;
  }

  const helped = {};
  for (const r of db.prepare(`SELECT player_id, kind, COUNT(*) AS n FROM season_contributions GROUP BY player_id, kind`).all()) (helped[r.player_id] ??= {})[r.kind] = r.n;

  const ledger = {};
  for (const t of db.prepare(`SELECT player_id, type, amount, date, season, category FROM transaction_ledger WHERE status = 'confirmed' ORDER BY date, created_at`).all()) (ledger[t.player_id] ??= []).push(t);
  const plans = Object.fromEntries(db.prepare(`
    SELECT r.player_id, s.season, s.payment_plan FROM season_signups s JOIN registrations r ON r.id = s.reg_id
    WHERE r.player_id != ''`).all().map(r => [`${r.player_id}|${r.season}`, r.payment_plan]));

  const people = players.map(p => {
    const tx = ledger[p.id] || [];
    const approved = toMs(p.approved_at) || toMs(p.reg_created);
    const everPlayed = !!games[p.id];
    return {
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      hasAccount: !!p.reg_id,
      banned: !!p.banned_at && !p.ban_lifted_at,
      balance: Math.round(tx.reduce((s, t) => s + (t.type === 'charge' ? t.amount : -t.amount), 0)),
      playedLast: !!games[p.id]?.[lastSeason],
      games: games[p.id] || {},
      papawisRuns: runs[p.id] || 0,
      activeWeeks: weeks[p.id]?.size || 0,
      online: {
        site: byKind[p.id]?.site.size || 0,
        app: byKind[p.id]?.app.size || 0,
        action: byKind[p.id]?.action.size || 0,
        lastSeen: lastSeen[p.id] ? isoDay(lastSeen[p.id]) : '',
      },
      isNew: !everPlayed && approved > now - rules.newMemberDays * DAY,
      attendance: teamGames[p.id] ? { played: games[p.id]?.[lastSeason] || 0, teamGames: teamGames[p.id] } : null,
      conduct: conduct[p.id] || { fines: 0, suspended: false, techs: {}, maxTechs: 0, dq: 0, fineList: [] },
      lateCancels: lateCancels[p.id] || 0,
      helped: { scored: scored[p.id] || 0, ...(helped[p.id] || {}) },
      contributions: (scored[p.id] || 0) + Object.values(helped[p.id] || {}).reduce((s, n) => s + n, 0),
      pay: seasons.map(s => gradeSeason(tx.filter(t => t.season === String(s.season) && isSeasonFee(t)), s,
        { plan: plans[`${p.id}|${s.season}`] === 'full' ? 'full' : 'installment', now, rules })),
    };
  });

  return { target: latest + 1, seasons, candidates: rankCandidates(people, { rules }) };
}
