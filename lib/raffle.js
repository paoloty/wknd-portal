// Raffles (docs/plans/ratings-and-raffle.md, Phase 2: "Rate & Win"). An open model so later
// event raffles (Phase 3) are more rows, not a rebuild:
//   raffles          one per raffle: schedule, ticket rules, minimum players, status
//   raffle_rounds    one per draw: when it opens and draws, the committed seed, the result
//   raffle_tickets   who earned what, from which game or review (unique per source + ref)
//   raffle_prizes    what a round's winner gets (Phase 2: a free Papawis run)
//   raffle_winners   who won which round
//   raffle_vouchers  a won free run: used at a Papawis signup, never a ledger entry (a
//                    Papawis% credit would waive the probation deposit hold)
// Draws run on their own (runRaffleJobs, every minute from server.js): when a round's draw
// time passes, it draws (or rolls over below the minimum) inside one transaction and opens
// the next round, so a missed tick or a restart just draws on the next one.
import { createHash, createHmac, randomBytes } from 'crypto';
import {
  db, getSetting, getPlayerById, getRegistrationByPlayerId, hasUnpaidCompletedPapawis, getPortalCurrentSeason,
  createNotification, checkActivePlayer,
} from './portal-db.js';
import { displayPlayerName } from '../views/utils.js';

const DAY = 86400000;
export const RATE_AND_WIN = 'rate-and-win';
export const raffleOn = () => getSetting('raffle_enabled', '0') === '1';

db.exec(`
  CREATE TABLE IF NOT EXISTS raffles (
    id                TEXT PRIMARY KEY,
    slug              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    kind              TEXT NOT NULL DEFAULT 'recurring',
    status            TEXT NOT NULL DEFAULT 'active',
    schedule_json     TEXT NOT NULL DEFAULT '{}',
    rules_json        TEXT NOT NULL DEFAULT '{}',
    min_players       INTEGER NOT NULL DEFAULT 10,
    win_cooldown_days INTEGER NOT NULL DEFAULT 90,
    created_at        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS raffle_rounds (
    id            TEXT PRIMARY KEY,
    raffle_id     TEXT NOT NULL,
    number        INTEGER NOT NULL,
    opens_at      INTEGER NOT NULL,
    draws_at      INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',
    seed          TEXT NOT NULL,
    seed_hash     TEXT NOT NULL,
    entrants_json TEXT NOT NULL DEFAULT '[]',
    players       INTEGER NOT NULL DEFAULT 0,
    tickets       INTEGER NOT NULL DEFAULT 0,
    winner_player_id TEXT NOT NULL DEFAULT '',
    drawn_at      INTEGER NOT NULL DEFAULT 0,
    note          TEXT NOT NULL DEFAULT '',
    reminded_day  INTEGER NOT NULL DEFAULT 0,
    reminded_soon INTEGER NOT NULL DEFAULT 0,
    UNIQUE (raffle_id, number)
  );
  CREATE TABLE IF NOT EXISTS raffle_tickets (
    id         TEXT PRIMARY KEY,
    raffle_id  TEXT NOT NULL,
    round_id   TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    source     TEXT NOT NULL,
    ref        TEXT NOT NULL,
    amount     INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    UNIQUE (raffle_id, source, ref, player_id)
  );
  CREATE INDEX IF NOT EXISTS idx_raffle_tickets_round ON raffle_tickets(round_id, player_id);
  CREATE TABLE IF NOT EXISTS raffle_prizes (
    id          TEXT PRIMARY KEY,
    raffle_id   TEXT NOT NULL,
    type        TEXT NOT NULL,
    label       TEXT NOT NULL,
    qty         INTEGER NOT NULL DEFAULT 1,
    expiry      TEXT NOT NULL DEFAULT 'end_next_season',
    sort_order  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS raffle_winners (
    id         TEXT PRIMARY KEY,
    raffle_id  TEXT NOT NULL,
    round_id   TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    prize_id   TEXT NOT NULL DEFAULT '',
    voucher_id TEXT NOT NULL DEFAULT '',
    hide_name  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS raffle_vouchers (
    id             TEXT PRIMARY KEY,
    player_id      TEXT NOT NULL,
    type           TEXT NOT NULL DEFAULT 'free_run',
    label          TEXT NOT NULL,
    round_id       TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'active',
    expires_season TEXT NOT NULL DEFAULT '',
    signup_id      TEXT NOT NULL DEFAULT '',
    game_id        TEXT NOT NULL DEFAULT '',
    created_at     INTEGER NOT NULL,
    used_at        INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_raffle_vouchers_player ON raffle_vouchers(player_id, status);
`);
const rid = p => `${p}_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
const parse = (s, d) => { try { return JSON.parse(s || ''); } catch { return d; } };

// ── Schedule ──────────────────────────────────────────────────────────────────────────
// schedule: { first_draw: 'YYYY-MM-DD', time: 'HH:MM' (Manila), every_days }. Draw slots are
// first_draw + k × every_days at that time.
export const drawInstant = (ymd, time) => Date.parse(`${ymd}T${time || '20:00'}:00+08:00`);
export function nextDrawAfter(raffle, t) {
  const s = parse(raffle.schedule_json, {});
  const first = drawInstant(s.first_draw, s.time);
  const step = Math.max(1, Number(s.every_days) || 14) * DAY;
  if (!first) return 0;
  if (t < first) return first;
  return first + (Math.floor((t - first) / step) + 1) * step;
}
// The first Sunday at least 10 days out: "two weeks after launch" without a hard date.
function defaultFirstDraw(now = Date.now()) {
  const d = new Date(now + 8 * 3600000 + 10 * DAY);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

// ── Raffles and rounds ────────────────────────────────────────────────────────────────
export const getRaffleBySlug = slug => db.prepare('SELECT * FROM raffles WHERE slug = ?').get(slug) || null;
export const getRaffle = id => db.prepare('SELECT * FROM raffles WHERE id = ?').get(id) || null;
// Rate & Win, created the first time it's needed.
export function ensureRateAndWin() {
  let r = getRaffleBySlug(RATE_AND_WIN);
  if (r) return r;
  const id = rid('rf');
  db.prepare(`INSERT INTO raffles (id, slug, name, description, kind, status, schedule_json, rules_json, min_players, win_cooldown_days, created_at)
    VALUES (?, ?, ?, ?, 'recurring', 'active', ?, ?, 10, 90, ?)`).run(id, RATE_AND_WIN, 'Rate & Win',
    'Rate your games, win a free Papawis run. Drawn every other Sunday at 8 PM.',
    JSON.stringify({ first_draw: defaultFirstDraw(), time: '20:00', every_days: 14 }),
    JSON.stringify({ game_rated: 1, first_court_review: 2, review_min_chars: 50 }), Date.now());
  db.prepare("INSERT INTO raffle_prizes (id, raffle_id, type, label, qty, expiry) VALUES (?, ?, 'free_run', 'Free Papawis run', 1, 'end_next_season')").run(rid('rp'), id);
  return getRaffle(id);
}
export function updateRaffle(id, { status, minPlayers, firstDraw, time }) {
  const r = getRaffle(id); if (!r) return;
  if (status) db.prepare('UPDATE raffles SET status = ? WHERE id = ?').run(status, id);
  // Back from a pause: a draw time that passed meanwhile moves to the next slot instead of
  // firing the moment it's resumed.
  if (status === 'active') {
    const open = getOpenRound(id);
    if (open && open.draws_at < Date.now()) db.prepare('UPDATE raffle_rounds SET draws_at = ? WHERE id = ?').run(nextDrawAfter(getRaffle(id), Date.now()), open.id);
  }
  if (minPlayers) db.prepare('UPDATE raffles SET min_players = ? WHERE id = ?').run(minPlayers, id);
  if (firstDraw || time) {
    const s = { ...parse(r.schedule_json, {}), ...(firstDraw ? { first_draw: firstDraw } : {}), ...(time ? { time } : {}) };
    db.prepare('UPDATE raffles SET schedule_json = ? WHERE id = ?').run(JSON.stringify(s), id);
    // The open round follows the new schedule.
    const open = getOpenRound(id);
    if (open) db.prepare('UPDATE raffle_rounds SET draws_at = ? WHERE id = ?').run(nextDrawAfter(getRaffle(id), Math.max(Date.now(), open.opens_at)), open.id);
  }
}
export const getPrizes = raffleId => db.prepare('SELECT * FROM raffle_prizes WHERE raffle_id = ? ORDER BY sort_order').all(raffleId);
export const getOpenRound = raffleId => db.prepare("SELECT * FROM raffle_rounds WHERE raffle_id = ? AND status = 'open' ORDER BY number DESC LIMIT 1").get(raffleId) || null;
export const getRound = id => db.prepare('SELECT * FROM raffle_rounds WHERE id = ?').get(id) || null;
export const getRounds = (raffleId, limit = 50) => db.prepare('SELECT * FROM raffle_rounds WHERE raffle_id = ? ORDER BY number DESC LIMIT ?').all(raffleId, limit);
export function openRound(raffle, now = Date.now()) {
  const n = (db.prepare('SELECT MAX(number) AS n FROM raffle_rounds WHERE raffle_id = ?').get(raffle.id)?.n || 0) + 1;
  const seed = randomBytes(32).toString('hex');
  const id = rid('rr');
  db.prepare(`INSERT INTO raffle_rounds (id, raffle_id, number, opens_at, draws_at, seed, seed_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, raffle.id, n, now, nextDrawAfter(raffle, now + 60000), seed, createHash('sha256').update(seed).digest('hex'));
  return getRound(id);
}
export function currentRound(raffle) { return getOpenRound(raffle.id) || openRound(raffle); }

// ── Tickets ───────────────────────────────────────────────────────────────────────────
// One row per (raffle, source, ref, player), so the same game or review never pays twice.
// Returns { added, total } (total: their tickets in the open round), or null when off.
export function awardTicket({ playerId, source, ref, amount }) {
  if (!raffleOn() || !playerId) return null;
  const raffle = ensureRateAndWin();
  if (raffle.status !== 'active') return null;
  const rules = parse(raffle.rules_json, {});
  const n = amount ?? rules[source] ?? 1;
  const round = currentRound(raffle);
  const added = db.prepare('INSERT OR IGNORE INTO raffle_tickets (id, raffle_id, round_id, player_id, source, ref, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(rid('rt'), raffle.id, round.id, playerId, source, String(ref), n, Date.now()).changes > 0;
  return { added, amount: n, total: ticketsFor(round.id, playerId), round };
}
export const ticketsFor = (roundId, playerId) => db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM raffle_tickets WHERE round_id = ? AND player_id = ?').get(roundId, playerId).n;
export const hasTicket = (raffleId, source, ref, playerId) => !!db.prepare('SELECT 1 FROM raffle_tickets WHERE raffle_id = ? AND source = ? AND ref = ? AND player_id = ?').get(raffleId, source, String(ref), playerId);
export const ticketHistory = (roundId, playerId) => db.prepare('SELECT * FROM raffle_tickets WHERE round_id = ? AND player_id = ? ORDER BY created_at DESC').all(roundId, playerId);
// { player_id, n } per player in a round, ordered by player id (the draw's fixed order).
export const roundTally = roundId => db.prepare('SELECT player_id, SUM(amount) AS n FROM raffle_tickets WHERE round_id = ? GROUP BY player_id ORDER BY player_id').all(roundId);

// Why a player can't win this draw, or '' (they can). Admin accounts, players not active,
// on Papawis probation or with an unpaid completed run, and anyone who won in the last
// win_cooldown_days.
export function exclusionReason(raffle, playerId, now = Date.now()) {
  const p = getPlayerById(playerId);
  if (!p || p.status === 'inactive') return 'inactive';
  if (getRegistrationByPlayerId(playerId)?.is_admin) return 'admin';
  if (p.papawis_probation) return 'probation';
  if (hasUnpaidCompletedPapawis(playerId)) return 'unpaid';
  const won = db.prepare('SELECT created_at FROM raffle_winners WHERE raffle_id = ? AND player_id = ? ORDER BY created_at DESC LIMIT 1').get(raffle.id, playerId);
  if (won && won.created_at > now - raffle.win_cooldown_days * DAY) return 'recent_winner';
  return '';
}
export const EXCLUSION_LABEL = {
  inactive: 'Account not active', admin: 'Admins can’t win', probation: 'On Papawis probation',
  unpaid: 'Has an unpaid Papawis run', recent_winner: 'Won in the last 3 months',
};

// ── The draw ──────────────────────────────────────────────────────────────────────────
// Deterministic from the committed seed and the final entrant list, so anyone given both
// can redo it: HMAC-SHA256(seed, "id:n|id:n|…") → first 8 bytes as a number → mod the total
// tickets → walk the list in order.
export function pickWinner(seed, entrants) {
  const total = entrants.reduce((t, e) => t + e.n, 0);
  if (!total) return null;
  const h = createHmac('sha256', seed).update(entrants.map(e => `${e.player_id}:${e.n}`).join('|')).digest();
  let pick = Number(h.readBigUInt64BE(0) % BigInt(total));
  for (const e of entrants) { if (pick < e.n) return e.player_id; pick -= e.n; }
  return null;
}
export const winnerName = (name, hide) => {
  if (hide) return 'A lucky player';
  const n = displayPlayerName(name || '');
  const [first, ...rest] = n.split(' ');
  const last = rest.join(' ');
  return last ? `${first} ${last[0]}.` : first;
};

function issueVoucher(prize, playerId, roundId) {
  const season = Number(getPortalCurrentSeason());
  const expires = prize.expiry === 'end_next_season' && Number.isFinite(season) ? String(season + 1) : '';
  const id = rid('rv');
  db.prepare('INSERT INTO raffle_vouchers (id, player_id, type, label, round_id, expires_season, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, playerId, prize.type, prize.label, roundId, expires, Date.now());
  return id;
}

// Draws (or rolls over) one due round and opens the next. Returns what happened, for the
// notifications the caller sends after the transaction.
const drawTx = db.transaction((roundId, now) => {
  const round = getRound(roundId);
  if (!round || round.status !== 'open' || round.draws_at > now) return null;
  const raffle = getRaffle(round.raffle_id);
  const tally = roundTally(round.id);
  const entrants = tally.filter(e => !exclusionReason(raffle, e.player_id, now));
  const total = entrants.reduce((t, e) => t + e.n, 0);
  const meta = JSON.stringify(entrants);
  let out;
  if (entrants.length < raffle.min_players) {
    // Rollover: tickets earned this round carry once (carried ones don't carry again).
    db.prepare(`UPDATE raffle_rounds SET status = 'rolled', entrants_json = ?, players = ?, tickets = ?, drawn_at = ?, note = ? WHERE id = ?`)
      .run(meta, entrants.length, total, now, `Fewer than ${raffle.min_players} players: tickets roll over once.`, round.id);
    const next = openRound(raffle, now);
    const carry = db.prepare("SELECT player_id, SUM(amount) AS n FROM raffle_tickets WHERE round_id = ? AND source != 'carried' GROUP BY player_id").all(round.id);
    for (const c of carry) db.prepare('INSERT OR IGNORE INTO raffle_tickets (id, raffle_id, round_id, player_id, source, ref, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(rid('rt'), raffle.id, next.id, c.player_id, 'carried', round.id, c.n, now);
    out = { kind: 'rolled', raffle, round: getRound(round.id), next, playerIds: tally.map(t => t.player_id) };
  } else {
    const winner = pickWinner(round.seed, entrants);
    const prize = getPrizes(raffle.id)[0];
    const voucherId = prize ? issueVoucher(prize, winner, round.id) : '';
    db.prepare('INSERT INTO raffle_winners (id, raffle_id, round_id, player_id, prize_id, voucher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(rid('rw'), raffle.id, round.id, winner, prize?.id || '', voucherId, now);
    db.prepare(`UPDATE raffle_rounds SET status = 'drawn', entrants_json = ?, players = ?, tickets = ?, winner_player_id = ?, drawn_at = ? WHERE id = ?`)
      .run(meta, entrants.length, total, winner, now, round.id);
    out = { kind: 'drawn', raffle, round: getRound(round.id), next: openRound(raffle, now), winner, prize, playerIds: tally.map(t => t.player_id) };
  }
  return out;
});

// Admin "Skip this round": no draw; every ticket in it moves to the next round.
export const skipRound = db.transaction((roundId, note = 'Skipped by an admin.') => {
  const round = getRound(roundId);
  if (!round || round.status !== 'open') return null;
  const raffle = getRaffle(round.raffle_id);
  const now = Date.now();
  db.prepare("UPDATE raffle_rounds SET status = 'skipped', drawn_at = ?, note = ? WHERE id = ?").run(now, note, round.id);
  const next = openRound(raffle, Math.max(now, round.draws_at));
  db.prepare('UPDATE raffle_tickets SET round_id = ? WHERE round_id = ?').run(next.id, round.id);
  return next;
});

// ── Vouchers ──────────────────────────────────────────────────────────────────────────
// A voucher past its season reads as expired (and is marked so) the first time it's looked at.
function freshVoucher(v) {
  if (!v) return null;
  if (v.status === 'active' && v.expires_season && Number(getPortalCurrentSeason()) > Number(v.expires_season)) {
    db.prepare("UPDATE raffle_vouchers SET status = 'expired' WHERE id = ?").run(v.id);
    return { ...v, status: 'expired' };
  }
  return v;
}
export const getVouchersForPlayer = playerId => db.prepare('SELECT * FROM raffle_vouchers WHERE player_id = ? ORDER BY created_at DESC').all(playerId).map(freshVoucher);
export const getActiveVoucher = playerId => getVouchersForPlayer(playerId).find(v => v.status === 'active') || null;
export const getVoucherForSignup = signupId => freshVoucher(db.prepare("SELECT * FROM raffle_vouchers WHERE signup_id = ? AND status IN ('reserved', 'used')").get(signupId)) || null;
export const getAllVouchers = () => db.prepare('SELECT v.*, p.name AS player_name FROM raffle_vouchers v LEFT JOIN players p ON p.id = v.player_id ORDER BY v.created_at DESC').all().map(freshVoucher);
export function reserveVoucher(voucherId, { signupId, gameId }) {
  return db.prepare("UPDATE raffle_vouchers SET status = 'reserved', signup_id = ?, game_id = ? WHERE id = ? AND status = 'active'").run(signupId, gameId, voucherId).changes > 0;
}
export function releaseVoucherForSignup(signupId) {
  return db.prepare("UPDATE raffle_vouchers SET status = 'active', signup_id = '', game_id = '' WHERE signup_id = ? AND status = 'reserved'").run(signupId).changes > 0;
}
export function useVoucherForSignup(signupId) {
  return db.prepare("UPDATE raffle_vouchers SET status = 'used', used_at = ? WHERE signup_id = ? AND status = 'reserved'").run(Date.now(), signupId).changes > 0;
}
export function setWinnerNameHidden(roundId, playerId, hide) {
  db.prepare('UPDATE raffle_winners SET hide_name = ? WHERE round_id = ? AND player_id = ?').run(hide ? 1 : 0, roundId, playerId);
}
export const getWinnerForRound = roundId => db.prepare('SELECT w.*, p.name AS player_name FROM raffle_winners w LEFT JOIN players p ON p.id = w.player_id WHERE w.round_id = ?').get(roundId) || null;
export const getLatestDrawnRound = raffleId => db.prepare("SELECT * FROM raffle_rounds WHERE raffle_id = ? AND status IN ('drawn', 'rolled') ORDER BY number DESC LIMIT 1").get(raffleId) || null;

// ── The job (server.js, every minute) ─────────────────────────────────────────────────
// sendWinnerEmail(winnerId, { raffle, round, prize }) is passed in (lib/mailer.js lives on
// the server side of this). gamesLeft(playerId) → how many open games they haven't rated.
export async function runRaffleJobs({ sendWinnerEmail = null, gamesLeft = () => 0, playersToRemind = () => [] } = {}) {
  if (!raffleOn()) return;
  const raffle = ensureRateAndWin();
  if (raffle.status !== 'active') return;
  const now = Date.now();
  let round = currentRound(raffle);
  // Reminders: the day before (players with games left to rate) and 15 minutes before (everyone in).
  if (!round.reminded_day && now >= round.draws_at - DAY && now < round.draws_at) {
    db.prepare('UPDATE raffle_rounds SET reminded_day = 1 WHERE id = ?').run(round.id);
    for (const pid of playersToRemind()) {
      const left = gamesLeft(pid);
      if (left) createNotification({ playerId: pid, type: 'raffle_remind', title: `Raffle draw ${new Date(round.draws_at).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}`, body: `${left} game${left === 1 ? '' : 's'} left to rate: each one is a ticket for a free run.`, link: '/raffle' });
    }
  }
  if (!round.reminded_soon && now >= round.draws_at - 15 * 60000 && now < round.draws_at) {
    db.prepare('UPDATE raffle_rounds SET reminded_soon = 1 WHERE id = ?').run(round.id);
    for (const t of roundTally(round.id)) createNotification({ playerId: t.player_id, type: 'raffle_soon', title: 'Raffle draw in 15 minutes', body: `You have ${t.n} ticket${t.n === 1 ? '' : 's'}. Watch it live.`, link: '/raffle' });
  }
  if (round.draws_at > now) return;
  const out = drawTx(round.id, now);
  if (!out) return;
  if (out.kind === 'drawn') {
    createNotification({ playerId: out.winner, type: 'raffle_won', title: `You won ${out.raffle.name}!`, body: `${out.prize?.label || 'Your prize'} is yours. Use it when you sign up for a run.`, link: '/raffle' });
    if (sendWinnerEmail) {
      const check = checkActivePlayer(out.winner);
      if (check.email && check.reason !== 'bounced' && check.reason !== 'no_valid_email') {
        try { await sendWinnerEmail({ to: check.email, name: check.player?.name || '', raffle: out.raffle, round: out.round, prize: out.prize }); } catch (e) { console.error('[raffle winner mail]', e.message); }
      }
    }
  } else {
    for (const pid of out.playerIds) createNotification({ playerId: pid, type: 'raffle_rolled', title: 'Raffle rolled over', body: `Fewer than ${out.raffle.min_players} players entered, so your tickets carry into the next draw.`, link: '/raffle' });
  }
}
