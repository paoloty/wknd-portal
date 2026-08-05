import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { isPapawisSignupOpenNow, manilaTodayStr } from '../views/utils.js';
import { RATING_COOLDOWN_MS } from './peer-ratings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(path.join(__dirname, '..', 'data', 'portal.db'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');

db.exec(`
  CREATE TABLE IF NOT EXISTS leader_shares (
    id                 TEXT PRIMARY KEY,
    season             TEXT NOT NULL,
    category_id        TEXT NOT NULL,
    mode               TEXT NOT NULL,
    player_id          TEXT NOT NULL,
    player_name        TEXT NOT NULL,
    team_id            TEXT NOT NULL,
    team_name          TEXT NOT NULL,
    team_color         TEXT NOT NULL,
    stat_label         TEXT NOT NULL,
    stat_title         TEXT NOT NULL,
    stat_value         REAL NOT NULL,
    stat_fmt           TEXT NOT NULL,
    top10_json         TEXT NOT NULL DEFAULT '[]',
    player_picture_url TEXT NOT NULL DEFAULT '',
    created_at         INTEGER NOT NULL,
    UNIQUE(season, category_id, mode, player_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS compare_cache (
    pair_key      TEXT PRIMARY KEY,
    stats_key     TEXT NOT NULL,
    writeup       TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    view_count    INTEGER NOT NULL DEFAULT 0,
    last_viewed_at INTEGER
  )
`);
const _cmpCols = db.prepare('PRAGMA table_info(compare_cache)').all().map(c => c.name);
if (!_cmpCols.includes('view_count'))     db.exec(`ALTER TABLE compare_cache ADD COLUMN view_count     INTEGER NOT NULL DEFAULT 0`);
if (!_cmpCols.includes('last_viewed_at')) db.exec(`ALTER TABLE compare_cache ADD COLUMN last_viewed_at INTEGER`);
if (!_cmpCols.includes('model'))          db.exec(`ALTER TABLE compare_cache ADD COLUMN model TEXT`);

// Migrate existing tables that predate these columns
const cols = db.prepare('PRAGMA table_info(leader_shares)').all().map(c => c.name);
if (!cols.includes('top10_json'))         db.exec(`ALTER TABLE leader_shares ADD COLUMN top10_json TEXT NOT NULL DEFAULT '[]'`);
if (!cols.includes('player_picture_url')) db.exec(`ALTER TABLE leader_shares ADD COLUMN player_picture_url TEXT NOT NULL DEFAULT ''`);

// Migrate player_ratings: add usage/usage_ovr columns (replacing athleticism)
const ratingCols = db.prepare('PRAGMA table_info(player_ratings)').all().map(c => c.name);
if (!ratingCols.includes('usage'))     db.exec(`ALTER TABLE player_ratings ADD COLUMN usage     INTEGER`);
if (!ratingCols.includes('usage_ovr')) db.exec(`ALTER TABLE player_ratings ADD COLUMN usage_ovr INTEGER`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_financials (
    player_id         TEXT PRIMARY KEY,
    current_balance   REAL NOT NULL DEFAULT 0,
    total_paid        REAL NOT NULL DEFAULT 0,
    total_outstanding REAL NOT NULL DEFAULT 0,
    updated_at        INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS transaction_ledger (
    id             TEXT PRIMARY KEY,
    player_id      TEXT NOT NULL,
    amount         REAL NOT NULL,
    type           TEXT NOT NULL DEFAULT 'payment',
    payment_method TEXT NOT NULL DEFAULT '',
    date           TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    notes          TEXT NOT NULL DEFAULT '',
    reference_no   TEXT NOT NULL DEFAULT '',
    created_at     INTEGER NOT NULL
  )
`);
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN reference_no TEXT NOT NULL DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN season     TEXT NOT NULL DEFAULT ''`); } catch(e) {}
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN category   TEXT NOT NULL DEFAULT ''`); } catch(e) {}
// Base64 data URL of a player-submitted proof-of-payment screenshot — same
// buffer-to-base64-column pattern already used for player photos.
try { db.exec(`ALTER TABLE transaction_ledger ADD COLUMN screenshot_url TEXT NOT NULL DEFAULT ''`); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS season_quotas (
    season     TEXT PRIMARY KEY,
    amount     REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  )
`);

const stmtGetSetting = db.prepare('SELECT value FROM site_settings WHERE key=?');
const stmtSetSetting = db.prepare('INSERT OR REPLACE INTO site_settings (key,value,updated_at) VALUES (?,?,?)');

export function getSetting(key, defaultValue = null)   { return stmtGetSetting.get(key)?.value ?? defaultValue; }
export function setSetting(key, value)                 { stmtSetSetting.run(key, String(value), Date.now()); }

db.exec(`
  CREATE TABLE IF NOT EXISTS season_signups (
    id          TEXT    PRIMARY KEY,
    reg_id      TEXT    NOT NULL,
    season      TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'waitlisted',
    has_balance INTEGER NOT NULL DEFAULT 0,
    balance_amt REAL    NOT NULL DEFAULT 0,
    notes       TEXT    NOT NULL DEFAULT '',
    jersey_top  TEXT    NOT NULL DEFAULT '',
    jersey_shorts TEXT  NOT NULL DEFAULT '',
    quota_ack   INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    UNIQUE(reg_id, season)
  )
`);
{
  const _ssCols = db.prepare('PRAGMA table_info(season_signups)').all().map(c => c.name);
  if (!_ssCols.includes('jersey_top'))    db.exec(`ALTER TABLE season_signups ADD COLUMN jersey_top    TEXT NOT NULL DEFAULT ''`);
  if (!_ssCols.includes('jersey_shorts')) db.exec(`ALTER TABLE season_signups ADD COLUMN jersey_shorts TEXT NOT NULL DEFAULT ''`);
  if (!_ssCols.includes('quota_ack'))     db.exec(`ALTER TABLE season_signups ADD COLUMN quota_ack    INTEGER NOT NULL DEFAULT 0`);
  // 'stick' | 'reshuffle' | '' — only asked of returning players (see playerPlayedSeason()).
  if (!_ssCols.includes('team_pref'))     db.exec(`ALTER TABLE season_signups ADD COLUMN team_pref    TEXT NOT NULL DEFAULT ''`);
  if (!_ssCols.includes('pockets'))         db.exec(`ALTER TABLE season_signups ADD COLUMN pockets         INTEGER NOT NULL DEFAULT 0`);
  // 'yes' | 'no' | '' — league-wide reshuffle poll, asked of every registrant (unlike team_pref above).
  if (!_ssCols.includes('reshuffle_vote'))  db.exec(`ALTER TABLE season_signups ADD COLUMN reshuffle_vote  TEXT NOT NULL DEFAULT ''`);
  // 'full' | 'installment' | ''
  if (!_ssCols.includes('payment_plan'))    db.exec(`ALTER TABLE season_signups ADD COLUMN payment_plan    TEXT NOT NULL DEFAULT ''`);
  if (!_ssCols.includes('comments'))        db.exec(`ALTER TABLE season_signups ADD COLUMN comments        TEXT NOT NULL DEFAULT ''`);
  // Set only when the resubmitted emergency contact / birthday differs from what's already on
  // file in registrations — left at 0/'' otherwise. Flag for a future admin review panel.
  if (!_ssCols.includes('contact_changed_at'))  db.exec(`ALTER TABLE season_signups ADD COLUMN contact_changed_at  INTEGER NOT NULL DEFAULT 0`);
  if (!_ssCols.includes('contact_change_note')) db.exec(`ALTER TABLE season_signups ADD COLUMN contact_change_note TEXT NOT NULL DEFAULT ''`);
  // Group 08 (Waiver Reconfirmation) — set every time this season's signup includes a
  // checked reconfirmation, regardless of whether the registrant already had a full
  // /register waiver on file or this submission is what backfilled one for them.
  if (!_ssCols.includes('waiver_reconfirmed_at')) db.exec(`ALTER TABLE season_signups ADD COLUMN waiver_reconfirmed_at INTEGER NOT NULL DEFAULT 0`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS season_teams (
    id         TEXT PRIMARY KEY,
    season     TEXT NOT NULL,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#f59332',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS season_roster (
    id         TEXT PRIMARY KEY,
    season     TEXT NOT NULL,
    team_id    TEXT NOT NULL,
    signup_id  TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(signup_id, season)
  )
`);

const stmtInsertSeasonSignup = db.prepare(`
  INSERT OR IGNORE INTO season_signups
    (id, reg_id, season, status, has_balance, balance_amt, notes,
     jersey_top, jersey_shorts, quota_ack, team_pref,
     pockets, reshuffle_vote, payment_plan, comments, contact_changed_at, contact_change_note,
     waiver_reconfirmed_at, created_at)
  VALUES (?, ?, ?, 'waitlisted', ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetSeasonSignup         = db.prepare(`
  SELECT ss.*, r.full_name, r.email, r.phone, r.player_id,
         t.id AS prev_team_id, t.name AS prev_team_name, t.color AS prev_team_color
  FROM season_signups ss
  JOIN registrations r ON ss.reg_id = r.id
  LEFT JOIN players p ON p.id = r.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE ss.reg_id = ? AND ss.season = ?
`);
const stmtGetSeasonSignupById     = db.prepare('SELECT * FROM season_signups WHERE id = ?');
const stmtGetSeasonSignups        = db.prepare(`
  SELECT ss.*, r.full_name, r.email, r.phone, r.player_id,
         t.id AS prev_team_id, t.name AS prev_team_name, t.color AS prev_team_color
  FROM season_signups ss
  JOIN registrations r ON ss.reg_id = r.id
  LEFT JOIN players p ON p.id = r.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE ss.season = ?
  ORDER BY ss.created_at ASC
`);
// Did this player actually play in the given season? Used to decide whether to show the
// "stick with your team or reshuffle" poll on the signup form.
const stmtPlayerPlayedSeason = db.prepare(
  'SELECT 1 FROM player_totals WHERE player_id = ? AND season = ? AND games_played > 0 LIMIT 1'
);
const stmtPlayerLastTeam = db.prepare(
  'SELECT t.id, t.name, t.color FROM players p JOIN teams t ON t.id = p.team_id WHERE p.id = ?'
);
export function playerPlayedSeason(playerId, season) {
  if (!playerId) return false;
  return !!stmtPlayerPlayedSeason.get(playerId, Number(season));
}
export function getPlayerCurrentTeam(playerId) {
  if (!playerId) return null;
  return stmtPlayerLastTeam.get(playerId) || null;
}
const stmtUpdateSeasonSignupStatus = db.prepare('UPDATE season_signups SET status = ?, notes = ? WHERE id = ?');
const stmtCountSeasonSignups       = db.prepare(`SELECT COUNT(*) AS n FROM season_signups WHERE season = ? AND status != 'rejected'`);
const stmtCountConfirmedSeasonSignups = db.prepare(`SELECT COUNT(*) AS n FROM season_signups WHERE season = ? AND status = 'confirmed'`);

const stmtGetSeasonTeams    = db.prepare('SELECT * FROM season_teams WHERE season = ? ORDER BY sort_order ASC, created_at ASC');
const stmtUpsertSeasonTeam  = db.prepare(`
  INSERT INTO season_teams (id, season, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, sort_order=excluded.sort_order
`);
const stmtDeleteSeasonTeam  = db.prepare('DELETE FROM season_teams WHERE id = ?');
const stmtClearSeasonTeams  = db.prepare('DELETE FROM season_teams WHERE season = ?');

const stmtGetSeasonRoster   = db.prepare(`
  SELECT sr.*, ss.reg_id, ss.jersey_top, ss.jersey_shorts, r.full_name, r.positions, r.height, r.player_id
  FROM season_roster sr
  JOIN season_signups ss ON ss.id = sr.signup_id
  JOIN registrations r ON r.id = ss.reg_id
  WHERE sr.season = ?
  ORDER BY sr.team_id, sr.sort_order ASC
`);
const stmtSetRosterSlot     = db.prepare(`
  INSERT INTO season_roster (id, season, team_id, signup_id, sort_order)
  VALUES (?, ?, ?, ?, 0)
  ON CONFLICT(signup_id, season) DO UPDATE SET team_id=excluded.team_id
`);
const stmtClearSeasonRoster = db.prepare('DELETE FROM season_roster WHERE season = ?');

const stmtGetSignupsWithStats = db.prepare(`
  SELECT ss.*, r.full_name, r.email, r.player_id, r.positions, r.height,
         COALESCE(pr.overall_ovr, pr.overall)   AS rating,
         COALESCE(pr.scoring_ovr, pr.scoring)   AS off_rating,
         COALESCE(pr.defense_ovr, pr.defense)   AS def_rating,
         sr.team_id AS assigned_team_id,
         p.picture_url,
         COALESCE((SELECT pt.games_played FROM player_totals pt WHERE pt.player_id = r.player_id), 0) AS career_games
  FROM season_signups ss
  JOIN registrations r ON ss.reg_id = r.id
  LEFT JOIN player_ratings pr ON pr.player_id = r.player_id
    AND pr.season = (SELECT MAX(pr2.season) FROM player_ratings pr2 WHERE pr2.player_id = r.player_id)
  LEFT JOIN season_roster sr ON sr.signup_id = ss.id AND sr.season = ss.season
  LEFT JOIN players p ON p.id = r.player_id
  WHERE ss.season = ?
  ORDER BY ss.status ASC, ss.created_at ASC
`);

export function insertSeasonSignup(
  regId, season, hasBalance, balanceAmt, jerseyTop = '', jerseyShorts = '', quotaAck = 0, teamPref = '',
  {
    pockets = 0, reshuffleVote = '', paymentPlan = '', comments = '',
    contactChangedAt = 0, contactChangeNote = '', waiverReconfirmedAt = 0,
  } = {}
) {
  const id = `ss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertSeasonSignup.run(
    id, regId, String(season), hasBalance ? 1 : 0, balanceAmt ?? 0,
    jerseyTop, jerseyShorts, quotaAck ? 1 : 0, teamPref,
    pockets ? 1 : 0, reshuffleVote, paymentPlan, comments, contactChangedAt || 0, contactChangeNote,
    waiverReconfirmedAt || 0, Date.now()
  );
  return stmtGetSeasonSignup.get(regId, String(season));
}
export function getSeasonSignup(regId, season)           { return stmtGetSeasonSignup.get(regId, String(season)); }
export function getSeasonSignupById(id)                  { return stmtGetSeasonSignupById.get(id); }
export function getSeasonSignups(season)                 { return stmtGetSeasonSignups.all(String(season)); }
export function updateSeasonSignupStatus(id, status, notes = '') { stmtUpdateSeasonSignupStatus.run(status, notes, id); }
export function countSeasonSignups(season)               { return stmtCountSeasonSignups.get(String(season))?.n ?? 0; }
export function countConfirmedSeasonSignups(season)      { return stmtCountConfirmedSeasonSignups.get(String(season))?.n ?? 0; }

// Admin-only withdrawal, not self-service (a confirmed player contacts admin directly to
// drop out — matches Papawis's cancellation flow in spirit, but that one's player-triggered
// and this one deliberately isn't). Atomic: flips the signup to 'withdrawn' and, in the same
// transaction, promotes the earliest still-waitlisted signup for that season into the freed
// spot — same FIFO-by-signed-up-time pattern as cancelPapawisSignup's auto-promote, just
// season-scoped instead of game-scoped. Does NOT touch transaction_ledger — if the season's
// bulk charge (`/admin/season/teams/start`) already fired for this player, any refund/credit
// is a manual admin call in the Ledger, same "no automated reconciliation" stance already
// taken everywhere else in this codebase (see the withdraw route's confirm-dialog copy).
const stmtEarliestWaitlistedSeasonSignup = db.prepare(`
  SELECT * FROM season_signups WHERE season = ? AND status = 'waitlisted' ORDER BY created_at ASC LIMIT 1
`);
export const withdrawSeasonSignup = db.transaction((signupId) => {
  const signup = stmtGetSeasonSignupById.get(signupId);
  if (!signup || signup.status !== 'confirmed') return { error: 'not_confirmed' };
  stmtUpdateSeasonSignupStatus.run('withdrawn', signup.notes, signupId);
  const next = stmtEarliestWaitlistedSeasonSignup.get(signup.season);
  let promoted = null;
  if (next) {
    stmtUpdateSeasonSignupStatus.run('confirmed', next.notes, next.id);
    promoted = next;
  }
  return { ok: true, promoted };
});

// Mindset & Team Fit / Self-Assessment (season-signup Groups 03–04) — one row per
// (player, season), saved to the player's profile rather than the season_signups row
// so admin can see history across seasons. Admin-only, never surfaced to the player.
db.exec(`
  CREATE TABLE IF NOT EXISTS player_assessments (
    id                 TEXT    PRIMARY KEY,
    player_id          TEXT    NOT NULL,
    reg_id             TEXT    NOT NULL,
    season             TEXT    NOT NULL,
    q1_why_playing     TEXT    NOT NULL DEFAULT '',
    q2_losing_badly    TEXT    NOT NULL DEFAULT '',
    q3_bad_ref_call    TEXT    NOT NULL DEFAULT '',
    q4_heated_teammate INTEGER NOT NULL DEFAULT 0,
    q5_feedback_style  TEXT    NOT NULL DEFAULT '',
    q6_benched_comfort INTEGER NOT NULL DEFAULT 0,
    q7_work_on         TEXT    NOT NULL DEFAULT '',
    self_scoring       TEXT    NOT NULL DEFAULT '',
    self_defense       TEXT    NOT NULL DEFAULT '',
    self_overall       TEXT    NOT NULL DEFAULT '',
    admin_tag          TEXT    NOT NULL DEFAULT '',
    admin_note         TEXT    NOT NULL DEFAULT '',
    created_at         INTEGER NOT NULL,
    UNIQUE(player_id, season)
  )
`);
{
  // q8/q9 added 2026-08-03, after q1-q7 already had live rows — ALTER TABLE rather than
  // editing the CREATE TABLE string above, which only reaches fresh databases. Numbered
  // q8/q9 (next available) rather than renumbered into their visual form position (after
  // q4, after q5) to avoid renaming columns that already have data in them.
  const _paCols = db.prepare('PRAGMA table_info(player_assessments)').all().map(c => c.name);
  if (!_paCols.includes('q8_disagreement_style'))    db.exec(`ALTER TABLE player_assessments ADD COLUMN q8_disagreement_style    TEXT NOT NULL DEFAULT ''`);
  if (!_paCols.includes('q9_reaction_to_criticism')) db.exec(`ALTER TABLE player_assessments ADD COLUMN q9_reaction_to_criticism TEXT NOT NULL DEFAULT ''`);
}

const stmtInsertPlayerAssessment = db.prepare(`
  INSERT OR IGNORE INTO player_assessments
    (id, player_id, reg_id, season, q1_why_playing, q2_losing_badly, q3_bad_ref_call, q4_heated_teammate,
     q5_feedback_style, q6_benched_comfort, q7_work_on, q8_disagreement_style, q9_reaction_to_criticism,
     self_scoring, self_defense, self_overall, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtGetPlayerAssessment      = db.prepare('SELECT * FROM player_assessments WHERE player_id = ? AND season = ?');
const stmtGetPlayerAssessmentById  = db.prepare('SELECT * FROM player_assessments WHERE id = ?');
const stmtGetAssessmentHistory     = db.prepare('SELECT * FROM player_assessments WHERE player_id = ? ORDER BY season DESC');
const stmtSetAssessmentTag         = db.prepare('UPDATE player_assessments SET admin_tag = ?, admin_note = ? WHERE id = ?');

export function insertPlayerAssessment(playerId, regId, season, a = {}) {
  const id = `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertPlayerAssessment.run(
    id, playerId || '', regId, String(season),
    a.q1WhyPlaying || '', a.q2LosingBadly || '', a.q3BadRefCall || '', Number(a.q4HeatedTeammate) || 0,
    a.q5FeedbackStyle || '', Number(a.q6BenchedComfort) || 0, a.q7WorkOn || '',
    a.q8DisagreementStyle || '', a.q9ReactionToCriticism || '',
    a.selfScoring || '', a.selfDefense || '', a.selfOverall || '', Date.now()
  );
  return stmtGetPlayerAssessmentById.get(id);
}
export function getPlayerAssessment(playerId, season)     { return stmtGetPlayerAssessment.get(playerId, String(season)); }
export function getPlayerAssessmentById(id)                { return stmtGetPlayerAssessmentById.get(id); }
export function getPlayerAssessmentHistory(playerId)        { return stmtGetAssessmentHistory.all(playerId); }
export function setAssessmentTag(id, tag, note = '')         { stmtSetAssessmentTag.run(tag, note, id); }

const stmtLatestPlayerRating = db.prepare(`
  SELECT COALESCE(overall_ovr, overall) AS overall, COALESCE(scoring_ovr, scoring) AS scoring, COALESCE(defense_ovr, defense) AS defense
  FROM player_ratings WHERE player_id = ? AND season = (SELECT MAX(season) FROM player_ratings WHERE player_id = ?)
`);
export function getLatestPlayerRating(playerId) { return stmtLatestPlayerRating.get(playerId, playerId) || null; }

export function getSeasonTeams(season)                   { return stmtGetSeasonTeams.all(String(season)); }
export function upsertSeasonTeam(id, season, name, color, sortOrder) {
  stmtUpsertSeasonTeam.run(id, String(season), name, color, sortOrder, Date.now());
}
export function deleteSeasonTeam(id)                     { stmtDeleteSeasonTeam.run(id); }
export function clearSeasonTeams(season)                 { stmtClearSeasonTeams.run(String(season)); }

export function getSeasonRoster(season)                  { return stmtGetSeasonRoster.all(String(season)); }
export function saveSeasonRoster(season, assignments) {
  // assignments: [{ signup_id, team_id }]
  db.transaction(() => {
    stmtClearSeasonRoster.run(String(season));
    for (const { signup_id, team_id } of assignments) {
      if (!team_id) continue;
      const id = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      stmtSetRosterSlot.run(id, String(season), team_id, signup_id);
    }
  })();
}
export function clearSeasonRoster(season)                { stmtClearSeasonRoster.run(String(season)); }
export function getSeasonSignupsWithStats(season)        { return stmtGetSignupsWithStats.all(String(season)); }

export function getPortalCurrentSeason() {
  const override = getSetting('portal_season', '');
  if (override) return override;
  return String(getCurrentSeason()?.season ?? 3);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id                TEXT PRIMARY KEY,
    full_name         TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT NOT NULL DEFAULT '',
    player_id         TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pending',
    notes             TEXT NOT NULL DEFAULT '',
    created_at        INTEGER NOT NULL,
    birthday          TEXT NOT NULL DEFAULT '',
    positions         TEXT NOT NULL DEFAULT '[]',
    height            TEXT NOT NULL DEFAULT '',
    weight            TEXT NOT NULL DEFAULT '',
    jersey_pref       TEXT NOT NULL DEFAULT '',
    dominant_hand     TEXT NOT NULL DEFAULT '',
    experience        TEXT NOT NULL DEFAULT '',
    referred_by       TEXT NOT NULL DEFAULT '',
    emergency_name    TEXT NOT NULL DEFAULT '',
    emergency_phone   TEXT NOT NULL DEFAULT '',
    motto             TEXT NOT NULL DEFAULT '',
    user_id           TEXT NOT NULL DEFAULT '',
    approved_at       INTEGER NOT NULL DEFAULT 0,
    social_handle     TEXT NOT NULL DEFAULT ''
  )
`);

// Migrations for existing registrations table
{
  const _regCols = db.prepare("PRAGMA table_info(registrations)").all().map(c => c.name);
  if (!_regCols.includes('birthday'))        db.exec(`ALTER TABLE registrations ADD COLUMN birthday        TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('positions'))       db.exec(`ALTER TABLE registrations ADD COLUMN positions       TEXT NOT NULL DEFAULT '[]'`);
  if (!_regCols.includes('height'))          db.exec(`ALTER TABLE registrations ADD COLUMN height          TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('weight'))          db.exec(`ALTER TABLE registrations ADD COLUMN weight          TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('jersey_pref'))     db.exec(`ALTER TABLE registrations ADD COLUMN jersey_pref     TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('dominant_hand'))   db.exec(`ALTER TABLE registrations ADD COLUMN dominant_hand   TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('experience'))      db.exec(`ALTER TABLE registrations ADD COLUMN experience      TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('referred_by'))     db.exec(`ALTER TABLE registrations ADD COLUMN referred_by     TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('emergency_name'))  db.exec(`ALTER TABLE registrations ADD COLUMN emergency_name  TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('emergency_phone')) db.exec(`ALTER TABLE registrations ADD COLUMN emergency_phone TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('motto'))           db.exec(`ALTER TABLE registrations ADD COLUMN motto           TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('user_id'))         db.exec(`ALTER TABLE registrations ADD COLUMN user_id         TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('approved_at'))     db.exec(`ALTER TABLE registrations ADD COLUMN approved_at     INTEGER NOT NULL DEFAULT 0`);
  if (!_regCols.includes('password_hash'))   db.exec(`ALTER TABLE registrations ADD COLUMN password_hash   TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('pw_token'))        db.exec(`ALTER TABLE registrations ADD COLUMN pw_token        TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('pw_token_exp'))    db.exec(`ALTER TABLE registrations ADD COLUMN pw_token_exp    INTEGER NOT NULL DEFAULT 0`);
  if (!_regCols.includes('is_admin'))        db.exec(`ALTER TABLE registrations ADD COLUMN is_admin         INTEGER NOT NULL DEFAULT 0`);
  if (!_regCols.includes('gender'))          db.exec(`ALTER TABLE registrations ADD COLUMN gender            TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('facebook_id'))     db.exec(`ALTER TABLE registrations ADD COLUMN facebook_id       TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('social_handle'))   db.exec(`ALTER TABLE registrations ADD COLUMN social_handle     TEXT NOT NULL DEFAULT ''`);
  if (!_regCols.includes('last_login_at'))   db.exec(`ALTER TABLE registrations ADD COLUMN last_login_at    INTEGER NOT NULL DEFAULT 0`);
  if (!_regCols.includes('can_view_sensitive')) db.exec(`ALTER TABLE registrations ADD COLUMN can_view_sensitive INTEGER NOT NULL DEFAULT 0`);
  // Liability waiver — one-time at /register, typed full name as e-signature. NULL/0
  // waiver_agreed_at means a registrant predates this feature (or somehow slipped past
  // it) — season-signup's Group 08 shows them the full waiver instead of the lightweight
  // reconfirm-only version in that case, see setWaiverAgreement below.
  if (!_regCols.includes('waiver_agreed_at')) db.exec(`ALTER TABLE registrations ADD COLUMN waiver_agreed_at INTEGER NOT NULL DEFAULT 0`);
  if (!_regCols.includes('waiver_signature')) db.exec(`ALTER TABLE registrations ADD COLUMN waiver_signature TEXT NOT NULL DEFAULT ''`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'super',
    method     TEXT NOT NULL,
    path       TEXT NOT NULL,
    details    TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS entity_slugs (
    type       TEXT NOT NULL,
    entity_id  TEXT NOT NULL,
    slug       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (type, entity_id),
    UNIQUE (type, slug)
  )
`);

const stmtGetSlugForEntity = db.prepare('SELECT slug       FROM entity_slugs WHERE type=? AND entity_id=?');
const stmtGetEntityForSlug = db.prepare('SELECT entity_id  FROM entity_slugs WHERE type=? AND slug=?');
const stmtSaveSlug         = db.prepare('INSERT OR REPLACE INTO entity_slugs (type,entity_id,slug,created_at) VALUES (?,?,?,?)');

export function getSlugForEntity(type, entityId) {
  return stmtGetSlugForEntity.get(type, String(entityId))?.slug ?? null;
}

export function getEntityForSlug(type, slug) {
  return stmtGetEntityForSlug.get(type, slug)?.entity_id ?? null;
}

export function saveSlug(type, entityId, slug) {
  stmtSaveSlug.run(type, String(entityId), slug, Date.now());
}

const stmtByKey = db.prepare(
  'SELECT id FROM leader_shares WHERE season=? AND category_id=? AND mode=? AND player_id=?'
);
const stmtUpdate = db.prepare(`
  UPDATE leader_shares
  SET stat_value=?,stat_fmt=?,player_name=?,team_name=?,team_color=?,top10_json=?,player_picture_url=?
  WHERE id=?
`);
const stmtInsert = db.prepare(`
  INSERT INTO leader_shares
    (id,season,category_id,mode,player_id,player_name,team_id,team_name,team_color,
     stat_label,stat_title,stat_value,stat_fmt,top10_json,player_picture_url,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const stmtById = db.prepare('SELECT * FROM leader_shares WHERE id=?');

export function upsertShare(data) {
  const top10Json = JSON.stringify(data.top10 || []);
  const picUrl    = data.player_picture_url || '';
  const existing  = stmtByKey.get(data.season, data.category_id, data.mode, data.player_id);
  if (existing) {
    stmtUpdate.run(
      data.stat_value, data.stat_fmt, data.player_name,
      data.team_name, data.team_color, top10Json, picUrl,
      existing.id
    );
    return existing.id;
  }
  stmtInsert.run(
    data.id, data.season, data.category_id, data.mode, data.player_id,
    data.player_name, data.team_id, data.team_name, data.team_color,
    data.stat_label, data.stat_title, data.stat_value, data.stat_fmt,
    top10Json, picUrl, data.created_at
  );
  return data.id;
}

export function getShare(id) {
  return stmtById.get(id);
}

const stmtInsertReg = db.prepare(`
  INSERT INTO registrations (
    id, full_name, email, phone, player_id, status, notes, created_at,
    birthday, positions, height, weight, jersey_pref, dominant_hand, experience,
    referred_by, emergency_name, emergency_phone, motto, user_id, gender, social_handle
  ) VALUES (?, ?, ?, ?, '', 'pending', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
`);
const stmtAllRegs      = db.prepare('SELECT * FROM registrations ORDER BY created_at DESC');
const stmtRegById      = db.prepare('SELECT * FROM registrations WHERE id = ?');
const stmtRegByEmail   = db.prepare('SELECT * FROM registrations WHERE LOWER(email) = LOWER(?) ORDER BY created_at DESC LIMIT 1');
const stmtRegByPlayerId = db.prepare("SELECT * FROM registrations WHERE player_id = ? AND player_id != '' ORDER BY created_at DESC LIMIT 1");
const stmtUpdateReg    = db.prepare('UPDATE registrations SET status=?, player_id=?, notes=?, approved_at=? WHERE id=?');

export function insertRegistration({
  id, full_name, email, phone = '', birthday = '', positions = '[]',
  height = '', weight = '', jersey_pref = '', dominant_hand = '', experience = '',
  referred_by = '', emergency_name = '', emergency_phone = '', motto = '', gender = '',
  social_handle = '',
}) {
  stmtInsertReg.run(
    id, full_name, email, phone, Date.now(),
    birthday, positions, height, weight, jersey_pref, dominant_hand, experience,
    referred_by, emergency_name, emergency_phone, motto, gender, social_handle,
  );
}

export function getAllRegistrations() {
  return stmtAllRegs.all();
}

// Separate UPDATE rather than folding into stmtInsertReg's positional column list — avoids
// touching that statement's existing ?-ordering. Called right after insertRegistration on
// a fresh /register submission, and also from season-signup's Group 08 for a legacy
// registrant who signed up before this waiver existed (see waiver_agreed_at's comment
// above) — same setter either way, timestamp is always "now."
const stmtSetWaiverAgreement = db.prepare('UPDATE registrations SET waiver_agreed_at = ?, waiver_signature = ? WHERE id = ?');
export function setWaiverAgreement(regId, signature) {
  stmtSetWaiverAgreement.run(Date.now(), signature, regId);
}

const stmtInsertPlayer = db.prepare(`
  INSERT INTO players (id, team_id, first_name, last_name, number, birthday, status, sort_order)
  VALUES (?, '', ?, ?, ?, ?, 'active', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM players))
`);
const stmtInsertPlayerPos = db.prepare(`
  INSERT INTO player_positions (player_id, position, sort_order) VALUES (?, ?, ?)
`);

export function createPlayer({ id, first_name, last_name, birthday = '', positions = [], number = '' }) {
  db.transaction(() => {
    stmtInsertPlayer.run(id, first_name, last_name, number, birthday);
    positions.forEach((pos, i) => stmtInsertPlayerPos.run(id, pos, i));
  })();
}

// "Has this player actually done anything yet" — the gate for whether it's safe to
// delete them outright rather than just marking them inactive. Any of these means real
// history (a played game, real money, a roster spot, a won award) would be lost.
const stmtCountPlayerGameStats = db.prepare(`SELECT COUNT(*) AS n FROM game_player_stats WHERE player_id = ?`);
const stmtCountPlayerLedger    = db.prepare(`SELECT COUNT(*) AS n FROM transaction_ledger WHERE player_id = ?`);
const stmtCountPlayerPapawis   = db.prepare(`SELECT COUNT(*) AS n FROM papawis_signups WHERE player_id = ? AND status != 'cancelled'`);
const stmtCountPlayerAwards    = db.prepare(`SELECT COUNT(*) AS n FROM awards WHERE player_id = ?`);
export function playerHasActivity(playerId) {
  return stmtCountPlayerGameStats.get(playerId).n > 0
    || stmtCountPlayerLedger.get(playerId).n > 0
    || stmtCountPlayerPapawis.get(playerId).n > 0
    || stmtCountPlayerAwards.get(playerId).n > 0;
}

// stmtDeletePlayerPositions is declared later in the file (shared with updatePlayer's
// own position-replace step) — referencing it here is fine, this only runs at request
// time, long after module load has finished initializing every top-level const.
const stmtDeletePlayerDetails    = db.prepare(`DELETE FROM player_details WHERE player_id = ?`);
const stmtDeletePlayerRatings    = db.prepare(`DELETE FROM player_ratings WHERE player_id = ?`);
const stmtDeletePlayerAnalysis   = db.prepare(`DELETE FROM ai_player_analysis WHERE player_id = ?`);
const stmtDeletePlayerFinancials = db.prepare(`DELETE FROM player_financials WHERE player_id = ?`);
// The registration that created this player (if any) goes back to unlinked rather than
// pointing at a now-missing player_id — re-enables "Create Player"/"Link" on that
// registration in the admin UI instead of leaving it stuck on a dangling reference.
const stmtClearRegPlayerLink     = db.prepare(`UPDATE registrations SET player_id = '' WHERE player_id = ?`);
const stmtDeletePlayerRow        = db.prepare(`DELETE FROM players WHERE id = ?`);

// Re-checks playerHasActivity() itself rather than trusting a caller's earlier check —
// this is the actual source of truth for whether the delete is safe, not just what
// gated the button in the UI.
export const deletePlayer = db.transaction((playerId) => {
  if (playerHasActivity(playerId)) return { error: 'has_activity' };
  stmtDeletePlayerPositions.run(playerId);
  stmtDeletePlayerDetails.run(playerId);
  stmtDeletePlayerRatings.run(playerId);
  stmtDeletePlayerAnalysis.run(playerId);
  stmtDeletePlayerFinancials.run(playerId);
  stmtClearRegPlayerLink.run(playerId);
  stmtDeletePlayerRow.run(playerId);
  return { ok: true };
});

export function getRegistration(id) {
  return stmtRegById.get(id);
}

export function getRegistrationByEmail(email) {
  return stmtRegByEmail.get(email);
}

export function getRegistrationByPlayerId(playerId) {
  return stmtRegByPlayerId.get(playerId);
}

export function updateRegistration(id, { status, player_id = '', notes = '', approved_at = 0 }) {
  stmtUpdateReg.run(status, player_id, notes, approved_at, id);
}

const stmtUpdateRegContact = db.prepare(
  'UPDATE registrations SET emergency_name = ?, emergency_phone = ? WHERE id = ?'
);
// Birthday is handled separately by the existing updateRegBirthday() (keeps players.birthday
// in sync too, when the registration is linked to a player) — this only covers the two
// fields that live solely on registrations.
export function updateRegistrationContact(id, { emergency_name = '', emergency_phone = '' }) {
  stmtUpdateRegContact.run(emergency_name, emergency_phone, id);
}

const stmtSetPwToken   = db.prepare('UPDATE registrations SET pw_token=?, pw_token_exp=? WHERE id=?');
const stmtGetByPwToken = db.prepare('SELECT * FROM registrations WHERE pw_token=? AND pw_token_exp > ? LIMIT 1');
const stmtSetPassword  = db.prepare('UPDATE registrations SET password_hash=?, pw_token=\'\', pw_token_exp=0 WHERE id=?');

export function setPasswordToken(id, token, expMs) { stmtSetPwToken.run(token, expMs, id); }
export function getRegByPasswordToken(token)        { return stmtGetByPwToken.get(token, Date.now()); }
export function setRegistrationPassword(id, hash)   { stmtSetPassword.run(hash, id); }

const stmtGetRegByFacebookId  = db.prepare(`SELECT * FROM registrations WHERE facebook_id = ? AND facebook_id != '' LIMIT 1`);
const stmtSetFacebookId       = db.prepare(`UPDATE registrations SET facebook_id=? WHERE id=?`);
const stmtClearFacebookId     = db.prepare(`UPDATE registrations SET facebook_id='' WHERE id=?`);
export function getRegByFacebookId(fbId)           { return stmtGetRegByFacebookId.get(String(fbId)); }
export function setFacebookId(regId, fbId)         { stmtSetFacebookId.run(String(fbId), regId); }
export function clearFacebookId(regId)             { stmtClearFacebookId.run(regId); }

const stmtSetAdmin  = db.prepare('UPDATE registrations SET is_admin=? WHERE id=?');
export function setRegistrationAdmin(id, isAdmin)   { stmtSetAdmin.run(isAdmin ? 1 : 0, id); }

const stmtSetSensitiveAccess = db.prepare('UPDATE registrations SET can_view_sensitive=? WHERE id=?');
export function setRegistrationSensitiveAccess(id, allowed) { stmtSetSensitiveAccess.run(allowed ? 1 : 0, id); }

const stmtSetLastLogin = db.prepare('UPDATE registrations SET last_login_at=? WHERE id=?');
export function setRegistrationLastLogin(id) { stmtSetLastLogin.run(Date.now(), id); }

const stmtInsertLog = db.prepare('INSERT INTO admin_logs (actor, actor_type, method, path, details, created_at) VALUES (?,?,?,?,?,?)');
const stmtGetLogs   = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?');
// Matches actions taken *on* this registration (path carries its id, e.g.
// /admin/users/<id>/approve) as well as its own /login and /set-password events
// (those log the email inside details, not the reg id, since they're unauthenticated
// at the time — see server.js login/set-password handlers).
const stmtGetLogsForUser = db.prepare(`
  SELECT * FROM admin_logs
  WHERE path LIKE ? OR details LIKE ?
  ORDER BY created_at DESC LIMIT ?
`);
export function insertAdminLog({ actor, actorType = 'super', method, path, details = {} }) {
  stmtInsertLog.run(actor, actorType, method, path, JSON.stringify(details), Date.now());
}
export function getAdminLogs(limit = 200) { return stmtGetLogs.all(limit); }
export function getAdminLogsForUser(regId, email, limit = 200) {
  return stmtGetLogsForUser.all(`/admin/users/${regId}%`, `%"email":"${email}"%`, limit);
}

// ── Financial ledger ──────────────────────────────────────────────────────────

const stmtGetFinancials    = db.prepare('SELECT * FROM player_financials WHERE player_id = ?');
const stmtAllFinancials    = db.prepare('SELECT * FROM player_financials');
const stmtUpsertFinancials = db.prepare(`
  INSERT INTO player_financials (player_id, current_balance, total_paid, total_outstanding, updated_at)
    VALUES (?, 0, 0, 0, ?)
  ON CONFLICT(player_id) DO NOTHING
`);
const stmtUpdateFinancials = db.prepare(`
  UPDATE player_financials
  SET current_balance = current_balance + ?,
      total_paid      = total_paid      + ?,
      total_outstanding = total_outstanding + ?,
      updated_at      = ?
  WHERE player_id = ?
`);
const stmtInsertTx      = db.prepare(`
  INSERT INTO transaction_ledger (id, player_id, amount, type, payment_method, date, status, notes, reference_no, season, category, screenshot_url, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtTxByPlayer       = db.prepare('SELECT * FROM transaction_ledger WHERE player_id = ? ORDER BY date DESC, created_at DESC');
const stmtTxByPlayerSeason = db.prepare('SELECT * FROM transaction_ledger WHERE player_id = ? AND season = ? ORDER BY date DESC, created_at DESC');
const stmtAllTx            = db.prepare('SELECT * FROM transaction_ledger ORDER BY date DESC, created_at DESC');
const stmtAllTxBySeason    = db.prepare('SELECT * FROM transaction_ledger WHERE season = ? ORDER BY date DESC, created_at DESC');
const stmtTxById           = db.prepare('SELECT * FROM transaction_ledger WHERE id = ?');
const stmtVoidTx           = db.prepare(`UPDATE transaction_ledger SET status = 'voided' WHERE id = ?`);
const stmtConfirmTx        = db.prepare(`UPDATE transaction_ledger SET status = 'confirmed' WHERE id = ? AND status = 'pending'`);
const stmtDeleteTx         = db.prepare(`DELETE FROM transaction_ledger WHERE id = ?`);
const stmtSeasonBalances   = db.prepare(`
  SELECT player_id,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS balance,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  WHERE season = ?
  GROUP BY player_id
`);
const stmtSeasonSummary    = db.prepare(`
  SELECT
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS total_charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_outstanding,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  WHERE season = ?
`);
const stmtAllBalances      = db.prepare(`
  SELECT player_id,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS balance,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
  GROUP BY player_id
`);
const stmtAllSummary       = db.prepare(`
  SELECT
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS total_charged,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS total_outstanding,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
  FROM transaction_ledger
`);
const stmtGetQuota         = db.prepare('SELECT amount FROM season_quotas WHERE season = ?');
const stmtSetQuota         = db.prepare('INSERT OR REPLACE INTO season_quotas (season, amount, created_at) VALUES (?, ?, ?)');
const stmtAllSeasons       = db.prepare(`SELECT DISTINCT season FROM transaction_ledger WHERE season != '' ORDER BY season DESC`);
const stmtPendingTx        = db.prepare(`
  SELECT tl.*, p.name AS player_name, p.team_id
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  WHERE tl.status = 'pending'
  ORDER BY tl.date DESC, tl.created_at DESC
`);
const stmtCategoryTotals   = db.prepare(`
  SELECT category,
    SUM(CASE WHEN type='payment' AND status='confirmed' THEN amount ELSE 0 END) AS paid,
    SUM(CASE WHEN type='charge'  AND status='confirmed' THEN amount ELSE 0 END) AS charged
  FROM transaction_ledger
  WHERE season = ?
  GROUP BY category
  ORDER BY charged DESC
`);
const stmtTeamTotals       = db.prepare(`
  SELECT t.name AS team_name, t.color AS team_color,
    SUM(CASE WHEN tl.type='charge'  AND tl.status='confirmed' THEN tl.amount ELSE 0 END) -
    SUM(CASE WHEN tl.type='payment' AND tl.status='confirmed' THEN tl.amount ELSE 0 END) AS outstanding
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE tl.season = ?
  GROUP BY t.id
  ORDER BY outstanding DESC
`);
const stmtRecentTx         = db.prepare(`
  SELECT tl.*, p.name AS player_name
  FROM transaction_ledger tl
  JOIN players p ON p.id = tl.player_id
  ORDER BY tl.created_at DESC
  LIMIT 10
`);

const recordTxTransaction = db.transaction(({ id, player_id, amount, type, payment_method, date, status, notes, reference_no = '', season = '', category = '', screenshot_url = '' }) => {
  const now = Date.now();
  stmtUpsertFinancials.run(player_id, now);
  stmtInsertTx.run(id, player_id, amount, type, payment_method, date, status, notes, reference_no, season, category, screenshot_url, now);
  if (status === 'confirmed') {
    const balanceDelta      = type === 'payment' ? -amount : amount;
    const paidDelta         = type === 'payment' ?  amount : 0;
    const outstandingDelta  = type === 'charge'  ?  amount : 0;
    stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, player_id);
  }
});


const confirmTxTransaction = db.transaction((id) => {
  const tx = stmtTxById.get(id);
  if (!tx || tx.status !== 'pending') return false;
  const result = stmtConfirmTx.run(id);
  if (!result.changes) return false;
  const now = Date.now();
  const balanceDelta     = tx.type === 'payment' ? -tx.amount : tx.amount;
  const paidDelta        = tx.type === 'payment' ?  tx.amount : 0;
  const outstandingDelta = tx.type === 'charge'  ?  tx.amount : 0;
  stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
  return true;
});

// Category is only editable while still pending — once confirmed it's part of the
// posted record. Lets admin say what a player-submitted payment was actually for
// before it hits the ledger for real.
const stmtUpdateTxCategory = db.prepare(`UPDATE transaction_ledger SET category = ? WHERE id = ? AND status = 'pending'`);
export function setTransactionCategory(id, category) {
  return stmtUpdateTxCategory.run(category, id).changes > 0;
}

const voidTxTransaction = db.transaction((id) => {
  const tx = stmtTxById.get(id);
  if (!tx || tx.status !== 'confirmed') return false;
  const now = Date.now();
  stmtVoidTx.run(id);
  const balanceDelta     = tx.type === 'payment' ?  tx.amount : -tx.amount;
  const paidDelta        = tx.type === 'payment' ? -tx.amount : 0;
  const outstandingDelta = tx.type === 'charge'  ? -tx.amount : 0;
  stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
  return true;
});

export function getAllFinancials() {
  return Object.fromEntries(stmtAllFinancials.all().map(r => [r.player_id, r]));
}

export function getPlayerFinancials(playerId) {
  return stmtGetFinancials.get(playerId) ?? { player_id: playerId, current_balance: 0, total_paid: 0, total_outstanding: 0 };
}

export function getAllTransactions()                    { return stmtAllTx.all(); }
export function getPendingTransactions()               { return stmtPendingTx.all(); }
export function getCategoryTotals(season)              { return stmtCategoryTotals.all(season); }
export function getTeamTotals(season)                  { return stmtTeamTotals.all(season); }
export function getRecentTransactions()                { return stmtRecentTx.all(); }
export function getAllTransactionsBySeason(season)      { return stmtAllTxBySeason.all(season); }
export function getPlayerTransactions(playerId)        { return stmtTxByPlayer.all(playerId); }
export function getPlayerTransactionsBySeason(playerId, season) { return stmtTxByPlayerSeason.all(playerId, season); }
export function getSeasonBalances(season)              { return stmtSeasonBalances.all(season); }
export function getSeasonSummary(season)               { return stmtSeasonSummary.get(season) ?? {}; }
export function getAllBalances()                        { return stmtAllBalances.all(); }
// Most recent transaction date per player, across every season and status — like balance,
// this is deliberately never season-scoped: "last activity" is meant to distinguish a
// stale debt from a fresh one, and a season filter would hide more-recent activity that
// happened to land outside whatever season is currently selected.
const stmtLastTxDatePerPlayer = db.prepare(`
  SELECT player_id, MAX(date) AS last_date FROM transaction_ledger GROUP BY player_id
`);
export function getLastTransactionDates() {
  return Object.fromEntries(stmtLastTxDatePerPlayer.all().map(r => [r.player_id, r.last_date]));
}
export function getAllSummary()                         { return stmtAllSummary.get() ?? {}; }
export function getLedgerSeasons()                     { return stmtAllSeasons.all().map(r => r.season); }
export function getSeasonQuota(season)                 { return stmtGetQuota.get(season)?.amount ?? 0; }
export function setSeasonQuota(season, amount)         { stmtSetQuota.run(season, amount, Date.now()); }
export function recordTransaction(data)                { recordTxTransaction(data); }
export function voidTransaction(id)                    { return voidTxTransaction(id); }
export function confirmTransaction(id)                 { return confirmTxTransaction(id); }
export function getTransactionById(id)                 { return stmtTxById.get(id); }

export function deleteTransaction(id) {
  const tx = stmtTxById.get(id);
  if (!tx) return false;
  db.transaction(() => {
    if (tx.status === 'confirmed') {
      const now = Date.now();
      const balanceDelta     = tx.type === 'payment' ?  tx.amount : -tx.amount;
      const paidDelta        = tx.type === 'payment' ? -tx.amount : 0;
      const outstandingDelta = tx.type === 'charge'  ? -tx.amount : 0;
      stmtUpdateFinancials.run(balanceDelta, paidDelta, outstandingDelta, now, tx.player_id);
    }
    stmtDeleteTx.run(id);
  })();
  return true;
}

// ── Basketball data tables (migrated from wknd-stats.db) ─────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS seasons (
    id         TEXT PRIMARY KEY,
    number     INTEGER NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    year       INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL DEFAULT '',
    end_date   TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL DEFAULT '',
    first_name  TEXT NOT NULL DEFAULT '',
    last_name   TEXT NOT NULL DEFAULT '',
    name        TEXT GENERATED ALWAYS AS (last_name || ', ' || first_name) STORED,
    number      TEXT NOT NULL DEFAULT '',
    positions   TEXT NOT NULL DEFAULT '[]',
    picture_url TEXT NOT NULL DEFAULT '',
    birthday    TEXT NOT NULL DEFAULT '',
    writeup     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    sort_order  INTEGER NOT NULL DEFAULT 0
  )
`);

{
  const _plCols = db.prepare("PRAGMA table_info(players)").all().map(c => c.name);
  if (!_plCols.includes('user_id')) db.exec(`ALTER TABLE players ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
  // Compressed pre-crop source photo, kept so re-crops (main avatar or award graphics)
  // aren't boxed in by the already-cropped 400x400 picture_url. See compressSourceImage() in server.js.
  if (!_plCols.includes('photo_original')) db.exec(`ALTER TABLE players ADD COLUMN photo_original TEXT NOT NULL DEFAULT ''`);
  // Persistent masked identity for peer ratings (see peer_ratings below) — assigned once,
  // lazily, the first time this player submits an anonymous rating, and reused for every
  // anonymous rating they submit after that (never regenerated).
  if (!_plCols.includes('anon_alias')) db.exec(`ALTER TABLE players ADD COLUMN anon_alias TEXT NOT NULL DEFAULT ''`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS player_details (
    player_id        TEXT PRIMARY KEY,
    height            TEXT NOT NULL DEFAULT '',
    weight            TEXT NOT NULL DEFAULT '',
    hometown          TEXT NOT NULL DEFAULT '',
    school            TEXT NOT NULL DEFAULT '',
    nickname          TEXT NOT NULL DEFAULT '',
    wingspan          TEXT NOT NULL DEFAULT '',
    dominant_hand     TEXT NOT NULL DEFAULT '',
    years_playing     TEXT NOT NULL DEFAULT '',
    social_instagram  TEXT NOT NULL DEFAULT '',
    social_twitter    TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_positions (
    player_id  TEXT NOT NULL,
    position   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, position)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS game_dnp (
    game_id   TEXT NOT NULL,
    player_id TEXT NOT NULL,
    PRIMARY KEY (game_id, player_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_totals (
    player_id    TEXT NOT NULL,
    season       INTEGER NOT NULL DEFAULT 3,
    games_played INTEGER NOT NULL DEFAULT 0,
    pts          INTEGER NOT NULL DEFAULT 0,
    ast          INTEGER NOT NULL DEFAULT 0,
    reb          INTEGER NOT NULL DEFAULT 0,
    stl          INTEGER NOT NULL DEFAULT 0,
    blk          INTEGER NOT NULL DEFAULT 0,
    turnover     INTEGER NOT NULL DEFAULT 0,
    pf           INTEGER NOT NULL DEFAULT 0,
    fg2m         INTEGER NOT NULL DEFAULT 0,
    fg3m         INTEGER NOT NULL DEFAULT 0,
    fg2m_miss    INTEGER NOT NULL DEFAULT 0,
    fg3m_miss    INTEGER NOT NULL DEFAULT 0,
    ftm          INTEGER NOT NULL DEFAULT 0,
    ft_miss      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, season)
  )
`);

// One row per player — always the *current* generated analysis, overwritten on
// regeneration (not a history log). stat_snapshot is compared against the player's
// live career totals to decide whether a regeneration is warranted.
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_player_analysis (
    player_id     TEXT PRIMARY KEY,
    generated_at  INTEGER NOT NULL,
    model         TEXT NOT NULL DEFAULT '',
    provider      TEXT NOT NULL DEFAULT '',
    stat_snapshot TEXT NOT NULL DEFAULT '{}',
    analysis      TEXT NOT NULL DEFAULT '',
    focus_tag     TEXT NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_ratings (
    player_id       TEXT NOT NULL,
    season          TEXT NOT NULL,
    scoring         INTEGER,
    shooting        INTEGER,
    rebounding      INTEGER,
    playmaking      INTEGER,
    defense         INTEGER,
    iq              INTEGER,
    athleticism     INTEGER,
    overall         INTEGER,
    scoring_ovr     INTEGER,
    shooting_ovr    INTEGER,
    rebounding_ovr  INTEGER,
    playmaking_ovr  INTEGER,
    defense_ovr     INTEGER,
    iq_ovr          INTEGER,
    athleticism_ovr INTEGER,
    overall_ovr     INTEGER,
    locked          INTEGER NOT NULL DEFAULT 0,
    computed_at     INTEGER,
    updated_at      INTEGER,
    PRIMARY KEY (player_id, season)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id                    TEXT PRIMARY KEY,
    season                INTEGER NOT NULL DEFAULT 3,
    date                  TEXT NOT NULL DEFAULT '',
    game_type             TEXT NOT NULL DEFAULT 'regular',
    playoff_round         TEXT NOT NULL DEFAULT '',
    series_id             TEXT NOT NULL DEFAULT '',
    team_a_id             TEXT NOT NULL DEFAULT '',
    team_b_id             TEXT NOT NULL DEFAULT '',
    team_a_name           TEXT NOT NULL DEFAULT '',
    team_b_name           TEXT NOT NULL DEFAULT '',
    team_a_score          INTEGER NOT NULL DEFAULT 0,
    team_b_score          INTEGER NOT NULL DEFAULT 0,
    scheduled             INTEGER NOT NULL DEFAULT 0,
    under_review          INTEGER NOT NULL DEFAULT 0,
    game_writeup          TEXT NOT NULL DEFAULT '',
    potg_writeup          TEXT NOT NULL DEFAULT '',
    manual_potg_player_id TEXT NOT NULL DEFAULT '',
    youtube_url           TEXT NOT NULL DEFAULT '',
    period_snapshots_json TEXT NOT NULL DEFAULT '[]',
    dnp_players_json      TEXT NOT NULL DEFAULT '[]',
    game_log_json         TEXT NOT NULL DEFAULT '[]',
    social_cover_data_url TEXT NOT NULL DEFAULT '',
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'complete',
    overtime              INTEGER NOT NULL DEFAULT 0
  )
`);

// Migrate pre-status / pre-has_cover games
const _gamesCols = db.prepare('PRAGMA table_info(games)').all().map(c => c.name);
if (!_gamesCols.includes('overtime')) db.exec(`ALTER TABLE games ADD COLUMN overtime INTEGER NOT NULL DEFAULT 0`);
if (!_gamesCols.includes('status')) {
  db.exec(`ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'`);
  db.exec(`UPDATE games SET status = 'scheduled' WHERE scheduled = 1`);
  // under_review=1 games are drafts (have box scores) — keep status='complete'
  // only existing regular complete games keep default 'complete'
}
// Fix incorrect migration: under_review=1 games should be 'complete', not 'final'
db.exec(`UPDATE games SET status = 'complete' WHERE status = 'final' AND under_review = 1`);
if (!_gamesCols.includes('has_cover')) {
  db.exec(`ALTER TABLE games ADD COLUMN has_cover INTEGER NOT NULL DEFAULT 0`);
  db.exec(`UPDATE games SET has_cover = 1 WHERE LENGTH(social_cover_data_url) > 0`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS game_player_stats (
    game_id   TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team_id   TEXT NOT NULL DEFAULT '',
    pts       INTEGER NOT NULL DEFAULT 0,
    ast       INTEGER NOT NULL DEFAULT 0,
    reb       INTEGER NOT NULL DEFAULT 0,
    stl       INTEGER NOT NULL DEFAULT 0,
    blk       INTEGER NOT NULL DEFAULT 0,
    turnover  INTEGER NOT NULL DEFAULT 0,
    pf        INTEGER NOT NULL DEFAULT 0,
    fg2m      INTEGER NOT NULL DEFAULT 0,
    fg3m      INTEGER NOT NULL DEFAULT 0,
    fg2m_miss INTEGER NOT NULL DEFAULT 0,
    fg3m_miss INTEGER NOT NULL DEFAULT 0,
    ftm       INTEGER NOT NULL DEFAULT 0,
    ft_miss   INTEGER NOT NULL DEFAULT 0,
    minutes   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (game_id, player_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS awards (
    id         TEXT PRIMARY KEY,
    season     INTEGER NOT NULL DEFAULT 3,
    award_type TEXT NOT NULL,
    player_id  TEXT NOT NULL DEFAULT '',
    team_id    TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )
`);

// Sparse per-player photo placement (and optional replacement photo) for a specific
// award share graphic. A missing row means "use the default rendering" — see
// buildOgStripPng() in server.js. `slot` supports MVP/DPOY's multi-image cover mode
// (several photos of the *same* confirmed player tiled side by side) — slot 0 is the
// single-hero photo, slots 1+ are only used when that award's column count is >1.
db.exec(`
  CREATE TABLE IF NOT EXISTS award_photo_overrides (
    season     INTEGER NOT NULL,
    award_type TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    slot       INTEGER NOT NULL DEFAULT 0,
    offset_x   REAL NOT NULL DEFAULT 50,
    offset_y   REAL NOT NULL DEFAULT 50,
    zoom       REAL NOT NULL DEFAULT 1,
    photo_url  TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (season, award_type, player_id, slot)
  )
`);
{
  const _apoCols = db.prepare("PRAGMA table_info(award_photo_overrides)").all().map(c => c.name);
  if (!_apoCols.includes('slot')) {
    db.exec(`
      CREATE TABLE award_photo_overrides_new (
        season     INTEGER NOT NULL,
        award_type TEXT NOT NULL,
        player_id  TEXT NOT NULL,
        slot       INTEGER NOT NULL DEFAULT 0,
        offset_x   REAL NOT NULL DEFAULT 50,
        offset_y   REAL NOT NULL DEFAULT 50,
        zoom       REAL NOT NULL DEFAULT 1,
        photo_url  TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, award_type, player_id, slot)
      );
      INSERT INTO award_photo_overrides_new (season, award_type, player_id, slot, offset_x, offset_y, zoom, photo_url, updated_at)
        SELECT season, award_type, player_id, 0, offset_x, offset_y, zoom, photo_url, updated_at FROM award_photo_overrides;
      DROP TABLE award_photo_overrides;
      ALTER TABLE award_photo_overrides_new RENAME TO award_photo_overrides;
    `);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    slug            TEXT NOT NULL UNIQUE,
    body_html       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    publish_at      INTEGER,
    ai_generated    INTEGER NOT NULL DEFAULT 0,
    stat_check_json TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  )
`);

const stmtCreatePost = db.prepare(`
  INSERT INTO posts (id, title, slug, body_html, status, publish_at, ai_generated, created_at, updated_at)
  VALUES (@id, @title, @slug, @body_html, @status, @publish_at, @ai_generated, @created_at, @updated_at)
`);
const stmtUpdatePost = db.prepare(`
  UPDATE posts SET title=@title, slug=@slug, body_html=@body_html, status=@status,
    publish_at=@publish_at, stat_check_json=@stat_check_json, updated_at=@updated_at
  WHERE id=@id
`);
const stmtDeletePost      = db.prepare('DELETE FROM posts WHERE id = ?');
const stmtGetPostById     = db.prepare('SELECT * FROM posts WHERE id = ?');
const stmtGetPostBySlug   = db.prepare('SELECT * FROM posts WHERE slug = ?');
const stmtGetPostBySlugExcl = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?');
const stmtGetAllPostsAdmin = db.prepare('SELECT * FROM posts ORDER BY created_at DESC');
const stmtGetPublicPosts   = db.prepare(`
  SELECT * FROM posts
  WHERE status = 'published' OR (status = 'scheduled' AND publish_at <= ?)
  ORDER BY COALESCE(publish_at, created_at) DESC
`);

export function createPost({ id, title, slug, body_html = '', status = 'draft', publish_at = null, ai_generated = 0 }) {
  const now = Date.now();
  stmtCreatePost.run({ id, title, slug, body_html, status, publish_at, ai_generated: ai_generated ? 1 : 0, created_at: now, updated_at: now });
}
export function updatePost(id, { title, slug, body_html, status, publish_at = null, stat_check_json = '' }) {
  stmtUpdatePost.run({ id, title, slug, body_html, status, publish_at, stat_check_json, updated_at: Date.now() });
}
export function deletePost(id)               { stmtDeletePost.run(id); }
export function getPostById(id)              { return stmtGetPostById.get(id); }
export function getPostBySlug(slug)          { return stmtGetPostBySlug.get(slug); }
export function isPostSlugTaken(slug, excludeId = '') { return !!stmtGetPostBySlugExcl.get(slug, excludeId); }
export function getAllPostsAdmin()           { return stmtGetAllPostsAdmin.all(); }
export function getPublicPosts()             { return stmtGetPublicPosts.all(Date.now()); }

db.exec(`
  CREATE TABLE IF NOT EXISTS seo_overrides (
    slug        TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_url   TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL DEFAULT 0
  )
`);

const stmtGetSeoOverride    = db.prepare('SELECT * FROM seo_overrides WHERE slug = ?');
const stmtGetAllSeoOverrides = db.prepare('SELECT * FROM seo_overrides ORDER BY slug ASC');
const stmtUpsertSeoOverride = db.prepare(`
  INSERT INTO seo_overrides (slug, title, description, image_url, created_at, updated_at)
  VALUES (@slug, @title, @description, @image_url, @created_at, @updated_at)
  ON CONFLICT(slug) DO UPDATE SET title=@title, description=@description, image_url=@image_url, updated_at=@updated_at
`);
const stmtDeleteSeoOverride = db.prepare('DELETE FROM seo_overrides WHERE slug = ?');

export function getSeoOverride(slug)    { return stmtGetSeoOverride.get(slug) || null; }
export function getAllSeoOverrides()    { return stmtGetAllSeoOverrides.all(); }
export function upsertSeoOverride({ slug, title = '', description = '', image_url = '' }) {
  const now = Date.now();
  const existing = stmtGetSeoOverride.get(slug);
  stmtUpsertSeoOverride.run({ slug, title, description, image_url, created_at: existing?.created_at || now, updated_at: now });
}
export function deleteSeoOverride(slug) { stmtDeleteSeoOverride.run(slug); }

// ── Game comments + reactions ───────────────────────────────────────────────────
// Flat list only (no reply_to) — kept deliberately simple for v1; a reply-to column
// can be added later without reshaping this if real usage ever calls for it.
db.exec(`
  CREATE TABLE IF NOT EXISTS game_comments (
    id         TEXT PRIMARY KEY,
    game_id    TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_game_comments_game ON game_comments(game_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (comment_id, player_id)
  )
`);

const stmtInsertComment = db.prepare(`
  INSERT INTO game_comments (id, game_id, player_id, body, created_at) VALUES (?, ?, ?, ?, ?)
`);
const stmtDeleteComment = db.prepare('DELETE FROM game_comments WHERE id = ?');
const stmtDeleteCommentReactions = db.prepare('DELETE FROM comment_reactions WHERE comment_id = ?');
// Reaction count + "did the current viewer react" resolved in one pass per comment via
// a correlated subquery/EXISTS, rather than N+1 queries per comment on render.
const stmtGetGameComments = db.prepare(`
  SELECT c.id, c.game_id, c.player_id, c.body, c.created_at,
    p.name AS player_name, p.team_id, t.name AS team_name,
    (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id) AS reaction_count
  FROM game_comments c
  JOIN players p ON p.id = c.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE c.game_id = ?
  ORDER BY c.created_at ASC
`);
const stmtGetCommentById = db.prepare('SELECT * FROM game_comments WHERE id = ?');
// Same joined shape as stmtGetGameComments, single row — used to build the WebSocket
// broadcast payload right after a comment is inserted (a freshly-created comment isn't
// in the game.status='final' snapshot getGameComments would otherwise re-derive).
const stmtGetCommentWithMeta = db.prepare(`
  SELECT c.id, c.game_id, c.player_id, c.body, c.created_at,
    p.name AS player_name, p.team_id, t.name AS team_name,
    (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id) AS reaction_count
  FROM game_comments c
  JOIN players p ON p.id = c.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE c.id = ?
`);
const stmtGetReaction = db.prepare('SELECT 1 FROM comment_reactions WHERE comment_id = ? AND player_id = ?');
const stmtInsertReaction = db.prepare('INSERT OR IGNORE INTO comment_reactions (comment_id, player_id, created_at) VALUES (?, ?, ?)');
const stmtDeleteReaction = db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND player_id = ?');
const stmtCountReactions = db.prepare('SELECT COUNT(*) AS n FROM comment_reactions WHERE comment_id = ?');

export function getGameComments(gameId) { return stmtGetGameComments.all(gameId); }
export function getCommentById(id)      { return stmtGetCommentById.get(id); }
export function getCommentWithMeta(id)  { return stmtGetCommentWithMeta.get(id); }

export function addGameComment({ gameId, playerId, body }) {
  const id = crypto.randomUUID();
  stmtInsertComment.run(id, gameId, playerId, body, Date.now());
  return id;
}

export function deleteGameComment(id) {
  stmtDeleteCommentReactions.run(id);
  stmtDeleteComment.run(id);
}

// Toggle: reacting again removes the reaction. Returns the fresh count and whether the
// caller is now reacted, so the route can hand both straight back to the client.
export function toggleCommentReaction(commentId, playerId) {
  const already = !!stmtGetReaction.get(commentId, playerId);
  if (already) stmtDeleteReaction.run(commentId, playerId);
  else stmtInsertReaction.run(commentId, playerId, Date.now());
  return { reacted: !already, count: stmtCountReactions.get(commentId).n };
}

// Set of player_ids who reacted to any comment in this list — used to mark "you reacted"
// on initial page render without a per-comment query.
export function getReactedCommentIdsForPlayer(commentIds, playerId) {
  if (!playerId || !commentIds.length) return new Set();
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT comment_id FROM comment_reactions WHERE player_id = ? AND comment_id IN (${placeholders})`).all(playerId, ...commentIds);
  return new Set(rows.map(r => r.comment_id));
}

// Page-level reaction ("liked the game itself") — separate from comment_reactions
// (which is always tied to one specific comment). Same toggle shape, deliberately kept
// as its own table rather than a polymorphic target_type/target_id design; the two are
// conceptually distinct enough (and each already has its own real query shape) that a
// shared table would just be indirection without saving anything concrete yet.
db.exec(`
  CREATE TABLE IF NOT EXISTS game_reactions (
    game_id    TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, player_id)
  )
`);
const stmtGetGameReaction    = db.prepare('SELECT 1 FROM game_reactions WHERE game_id = ? AND player_id = ?');
const stmtInsertGameReaction = db.prepare('INSERT OR IGNORE INTO game_reactions (game_id, player_id, created_at) VALUES (?, ?, ?)');
const stmtDeleteGameReaction = db.prepare('DELETE FROM game_reactions WHERE game_id = ? AND player_id = ?');
const stmtCountGameReactions = db.prepare('SELECT COUNT(*) AS n FROM game_reactions WHERE game_id = ?');

export function toggleGameReaction(gameId, playerId) {
  const already = !!stmtGetGameReaction.get(gameId, playerId);
  if (already) stmtDeleteGameReaction.run(gameId, playerId);
  else stmtInsertGameReaction.run(gameId, playerId, Date.now());
  return { reacted: !already, count: stmtCountGameReactions.get(gameId).n };
}

export function getGameReactionState(gameId, playerId) {
  return {
    count: stmtCountGameReactions.get(gameId).n,
    reacted: playerId ? !!stmtGetGameReaction.get(gameId, playerId) : false,
  };
}

// Bulk variants for list pages (e.g. /games) — one query per list instead of N+1 per row.
// Same placeholders-from-array technique as getReactedCommentIdsForPlayer above.
export function getGameCommentCounts(gameIds) {
  if (!gameIds.length) return {};
  const placeholders = gameIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT game_id, COUNT(*) AS n FROM game_comments WHERE game_id IN (${placeholders}) GROUP BY game_id`).all(...gameIds);
  return Object.fromEntries(rows.map(r => [r.game_id, r.n]));
}

export function getGameReactionCounts(gameIds) {
  if (!gameIds.length) return {};
  const placeholders = gameIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT game_id, COUNT(*) AS n FROM game_reactions WHERE game_id IN (${placeholders}) GROUP BY game_id`).all(...gameIds);
  return Object.fromEntries(rows.map(r => [r.game_id, r.n]));
}

export function getReactedGameIdsForPlayer(gameIds, playerId) {
  if (!playerId || !gameIds.length) return new Set();
  const placeholders = gameIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT game_id FROM game_reactions WHERE player_id = ? AND game_id IN (${placeholders})`).all(playerId, ...gameIds);
  return new Set(rows.map(r => r.game_id));
}

const stmtGetHeadToHead = db.prepare(`
  SELECT date, team_a_id, team_a_name, team_a_score, team_b_id, team_b_name, team_b_score, game_type
  FROM games
  WHERE status = 'complete' AND under_review = 0
    AND ((team_a_id = ? AND team_b_id = ?) OR (team_a_id = ? AND team_b_id = ?))
  ORDER BY date ASC
`);
export function getHeadToHeadRecord(teamAId, teamBId) {
  const games = stmtGetHeadToHead.all(teamAId, teamBId, teamBId, teamAId);
  let teamAWins = 0, teamBWins = 0;
  for (const g of games) {
    const aScore = g.team_a_id === teamAId ? g.team_a_score : g.team_b_score;
    const bScore = g.team_a_id === teamAId ? g.team_b_score : g.team_a_score;
    if (aScore > bScore) teamAWins++; else if (bScore > aScore) teamBWins++;
  }
  return { teamAWins, teamBWins, games };
}

// ── Basketball query functions ────────────────────────────────────────────────

const stmtGetTeams = db.prepare(
  'SELECT id, name, color FROM teams ORDER BY sort_order ASC, id ASC'
);

const stmtGetPlayers = db.prepare(`
  SELECT p.id, p.team_id, p.first_name, p.last_name, p.name, p.number,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions,
         p.picture_url, p.birthday, p.writeup, p.status, p.sort_order,
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
         COALESCE(t.pf, 0) AS pf,
         tm.name AS team_name, tm.color AS team_color
  FROM players p
  LEFT JOIN player_totals t ON t.player_id = p.id
    AND t.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
  LEFT JOIN teams tm ON tm.id = p.team_id
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetGames = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, season, game_type,
         playoff_round, series_id, youtube_url, scheduled, status, overtime,
         has_cover
  FROM games
  ORDER BY date DESC, id DESC
`);

const stmtGetGameCover = db.prepare(
  'SELECT social_cover_data_url FROM games WHERE id = ?'
);

const stmtGetTeamSeasonStats = db.prepare(`
  SELECT gps.team_id, t.name AS team_name,
         COUNT(DISTINCT gps.game_id)                                             AS gp,
         COALESCE(SUM(gps.pts), 0)                                               AS pts,
         COALESCE(SUM(gps.reb), 0)                                               AS reb,
         COALESCE(SUM(gps.ast), 0)                                               AS ast,
         COALESCE(SUM(gps.stl), 0)                                               AS stl,
         COALESCE(SUM(gps.blk), 0)                                               AS blk,
         COALESCE(SUM(gps.fg3m), 0)                                              AS fg3m,
         COALESCE(SUM(gps.fg2m + gps.fg3m), 0)                                  AS fgm,
         COALESCE(SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss), 0) AS fga,
         COALESCE(SUM(gps.fg3m + gps.fg3m_miss), 0)                             AS fg3a,
         COALESCE(SUM(gps.ftm), 0)                                               AS ftm,
         COALESCE(SUM(gps.ft_miss), 0)                                           AS ft_miss,
         COALESCE(SUM(gps.turnover), 0)                                          AS turnover,
         COALESCE(SUM(gps.pf), 0)                                                AS pf
  FROM game_player_stats gps
  JOIN teams t ON t.id = gps.team_id
  JOIN games g  ON g.id = gps.game_id
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
    AND g.game_type = 'regular' AND g.status = 'complete'
  GROUP BY gps.team_id, t.name
  ORDER BY t.sort_order ASC
`);

const stmtGetTeamRecords = db.prepare(`
  SELECT team_id,
         SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
  FROM (
    SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status = 'complete' AND under_review = 0)
      AND game_type = 'regular' AND status = 'complete' AND under_review = 0
    UNION ALL
    SELECT team_b_id, team_b_score, team_a_score FROM games
    WHERE season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status = 'complete' AND under_review = 0)
      AND game_type = 'regular' AND status = 'complete' AND under_review = 0
  )
  GROUP BY team_id
`);

// Returns team records for all regular-season games completed on or before the given date.
// Used for game recap articles so records reflect the state after the recapped game, not today.
const stmtGetTeamRecordsAsOf = db.prepare(`
  SELECT team_id,
         SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
         SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
  FROM (
    SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score FROM games
    WHERE season = ? AND game_type = 'regular' AND status = 'complete' AND under_review = 0 AND date <= ?
    UNION ALL
    SELECT team_b_id, team_b_score, team_a_score FROM games
    WHERE season = ? AND game_type = 'regular' AND status = 'complete' AND under_review = 0 AND date <= ?
  )
  GROUP BY team_id
`);

const stmtGetLeaders = db.prepare(`
  SELECT p.id, p.name, p.team_id, p.picture_url,
         tm.name AS team_name,
         COUNT(DISTINCT gps.game_id)       AS games_played,
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
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'regular' AND status IN ('final','complete'))
    AND g.game_type = 'regular'
    AND g.status = 'complete'
  GROUP BY p.id, p.name, p.team_id, tm.name
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetPlayoffLeaders = db.prepare(`
  SELECT p.id, p.name, p.team_id, p.picture_url,
         tm.name AS team_name,
         COUNT(DISTINCT gps.game_id)       AS games_played,
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
  WHERE g.season = (SELECT MAX(season) FROM games WHERE game_type = 'playoff' AND status = 'complete' AND under_review = 0)
    AND g.game_type = 'playoff'
    AND g.status = 'complete'
    AND g.under_review = 0
  GROUP BY p.id, p.name, p.team_id, tm.name
  ORDER BY p.sort_order ASC, p.id ASC
`);

const stmtGetGameRecords = db.prepare(`
  SELECT
    p.id AS player_id, p.name, p.team_id, p.picture_url,
    t.name AS team_name,
    gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
    gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss,
    gps.ftm, gps.ft_miss, gps.turnover, gps.pf,
    g.id AS game_id, g.date, g.season, g.game_type,
    g.team_a_id, g.team_a_name, g.team_a_score,
    g.team_b_id, g.team_b_name, g.team_b_score
  FROM game_player_stats gps
  JOIN players p ON p.id = gps.player_id
  JOIN teams t ON t.id = p.team_id
  JOIN games g ON g.id = gps.game_id
  WHERE g.under_review = 0
  ORDER BY g.sort_order DESC, g.id DESC
`);

const stmtGetGameById = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name,
         team_a_score, team_b_score, game_writeup, potg_writeup,
         manual_potg_player_id, under_review, scheduled, season, game_type,
         playoff_round, youtube_url, period_snapshots_json, dnp_players_json, game_log_json,
         status, overtime,
         has_cover
  FROM games WHERE id = ?
`);

const stmtGetGameDetailStats = db.prepare(`
  SELECT gps.player_id, gps.team_id,
         gps.pts, gps.ast, gps.reb, gps.stl, gps.blk, gps.turnover, gps.pf,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss, gps.minutes,
         p.name, p.number, p.picture_url,
         t.name AS team_name, t.color AS team_color
  FROM game_player_stats gps
  JOIN players p ON p.id = gps.player_id
  JOIN teams t ON t.id = gps.team_id
  WHERE gps.game_id = ?
  ORDER BY gps.pts DESC
`);

const stmtGetGameStats = db.prepare(`
  SELECT player_id, team_id, pts, ast, reb, stl, blk, turnover,
         fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes
  FROM game_player_stats
  WHERE game_id = ?
  ORDER BY pts DESC
`);

// p.* still carries the legacy players.positions column, which nothing writes to
// anymore (positions live in player_positions since the normalization) — the
// COALESCE(...) AS positions at the end overrides it in the returned row object
// (duplicate column names: the last one wins), same pattern as stmtGetPlayers.
const stmtGetPlayerWithTeam = db.prepare(`
  SELECT p.*, t.name AS team_name,
         d.height, d.weight, d.hometown, d.school, d.nickname,
         d.wingspan, d.dominant_hand, d.years_playing,
         d.social_instagram, d.social_twitter,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions
  FROM players p
  LEFT JOIN teams t ON t.id = p.team_id
  LEFT JOIN player_details d ON d.player_id = p.id
  WHERE p.id = ?
`);

const stmtGetPlayerById = db.prepare(`
  SELECT *,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = players.id), '[]') AS positions
  FROM players WHERE id = ?
`);
const stmtGetTeamById      = db.prepare('SELECT * FROM teams WHERE id = ?');
const stmtGetPlayerPhoto   = db.prepare('SELECT picture_url FROM players WHERE id = ?');
const stmtUpdatePlayerPhoto = db.prepare('UPDATE players SET picture_url = ? WHERE id = ?');
const stmtGetPlayerPhotoOriginal    = db.prepare('SELECT photo_original FROM players WHERE id = ?');
const stmtUpdatePlayerPhotoOriginal = db.prepare('UPDATE players SET photo_original = ? WHERE id = ?');
const stmtGetCurrentSeason = db.prepare(
  `SELECT MAX(season) AS season FROM games WHERE game_type = 'regular' AND status IN ('final','complete')`
);

const stmtGetSeasonLatestWeek = db.prepare(
  `SELECT (COUNT(*) + 1) / 2 AS week FROM games WHERE season = ? AND game_type = 'regular' AND status IN ('final','complete') AND date <= date('now')`
);

const stmtGetPlayerTotals = db.prepare(`
  SELECT gps.player_id,
         COUNT(DISTINCT gps.game_id) AS games_played,
         SUM(gps.pts)       AS pts,
         SUM(gps.ast)       AS ast,
         SUM(gps.reb)       AS reb,
         SUM(gps.stl)       AS stl,
         SUM(gps.blk)       AS blk,
         SUM(gps.turnover)  AS turnover,
         SUM(gps.pf)        AS pf,
         SUM(gps.fg2m)      AS fg2m,
         SUM(gps.fg3m)      AS fg3m,
         SUM(gps.fg2m_miss) AS fg2m_miss,
         SUM(gps.fg3m_miss) AS fg3m_miss,
         SUM(gps.ftm)       AS ftm,
         SUM(gps.ft_miss)   AS ft_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
    AND g.status = 'complete'
    AND g.under_review = 0
  WHERE gps.player_id = ?
`);

const stmtGetPlayerGameLog = db.prepare(`
  SELECT g.id, g.date, g.season, g.game_type,
         g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score,
         g.manual_potg_player_id,
         CASE WHEN gps.player_id IS NOT NULL THEN 'played' ELSE 'dnp' END AS status,
         COALESCE(gps.team_id, p.team_id) AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss,
         gps.ftm, gps.ft_miss, gps.turnover, gps.pf
  FROM games g
  JOIN players p ON p.id = ?
  LEFT JOIN game_player_stats gps ON gps.game_id = g.id AND gps.player_id = p.id
  LEFT JOIN game_dnp d ON d.game_id = g.id AND d.player_id = p.id
  WHERE g.status = 'complete'
    AND (gps.player_id IS NOT NULL OR d.player_id IS NOT NULL)
  ORDER BY g.date DESC, g.id DESC
`);

const stmtGetPlayerPotgCandidates = db.prepare(`
  SELECT g.id, g.date, g.team_a_id, g.team_a_name, g.team_a_score,
         g.team_b_id, g.team_b_name, g.team_b_score, g.potg_writeup,
         g.manual_potg_player_id,
         gps.team_id AS player_team_id,
         gps.pts, gps.reb, gps.ast, gps.stl, gps.blk,
         gps.fg2m, gps.fg3m, gps.fg2m_miss, gps.fg3m_miss, gps.ftm, gps.ft_miss
  FROM games g
  JOIN game_player_stats gps ON gps.game_id = g.id AND gps.player_id = @id
  WHERE g.status = 'complete'
    AND g.potg_writeup IS NOT NULL AND g.potg_writeup != ''
  ORDER BY g.id DESC
`);

const stmtGetPlayerCareerHighs = db.prepare(`
  SELECT MAX(pts) AS pts, MAX(reb) AS reb, MAX(ast) AS ast,
         MAX(stl) AS stl, MAX(blk) AS blk, MAX(fg3m) AS fg3m
  FROM game_player_stats WHERE player_id = ?
`);

const stmtGetPlayerAwards = db.prepare(
  'SELECT * FROM awards WHERE player_id = ? ORDER BY season DESC'
);

const stmtGetSeasonAwards = db.prepare(`
  SELECT a.id, a.award_type, a.season, a.notes, a.player_id, a.team_id,
         p.name AS player_name, p.picture_url,
         t.name AS team_name, t.color AS team_color,
         COALESCE(s.games_played, 0) AS games_played,
         COALESCE(s.pts,        0)   AS pts,
         COALESCE(s.ast,        0)   AS ast,
         COALESCE(s.reb,        0)   AS reb,
         COALESCE(s.stl,        0)   AS stl,
         COALESCE(s.blk,        0)   AS blk,
         COALESCE(s.fg2m,       0)   AS fg2m,
         COALESCE(s.fg3m,       0)   AS fg3m,
         COALESCE(s.fg2m_miss,  0)   AS fg2m_miss,
         COALESCE(s.fg3m_miss,  0)   AS fg3m_miss,
         COALESCE(s.ftm,        0)   AS ftm,
         COALESCE(s.ft_miss,    0)   AS ft_miss
  FROM awards a
  LEFT JOIN players p ON p.id = a.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  LEFT JOIN (
    SELECT gps.player_id,
           COUNT(DISTINCT gps.game_id) AS games_played,
           SUM(gps.pts)       AS pts,
           SUM(gps.ast)       AS ast,
           SUM(gps.reb)       AS reb,
           SUM(gps.stl)       AS stl,
           SUM(gps.blk)       AS blk,
           SUM(gps.fg2m)      AS fg2m,
           SUM(gps.fg3m)      AS fg3m,
           SUM(gps.fg2m_miss) AS fg2m_miss,
           SUM(gps.fg3m_miss) AS fg3m_miss,
           SUM(gps.ftm)       AS ftm,
           SUM(gps.ft_miss)   AS ft_miss
    FROM game_player_stats gps
    JOIN games g ON g.id = gps.game_id
      AND g.season        = @season
      AND g.game_type     = 'regular'
      AND g.under_review  = 0
      AND g.status        = 'complete'
    GROUP BY gps.player_id
  ) s ON s.player_id = a.player_id
  WHERE a.season = @season
  ORDER BY a.id ASC
`);

const stmtGetAwardSeasons = db.prepare(
  'SELECT DISTINCT season FROM awards ORDER BY season DESC'
);

const stmtGetGameDnpPlayers = db.prepare(`
  SELECT p.id, p.name, p.team_id, t.name AS team_name
  FROM game_dnp d
  JOIN players p ON p.id = d.player_id
  JOIN teams t ON t.id = p.team_id
  WHERE d.game_id = ?
  ORDER BY t.sort_order, p.sort_order
`);

const stmtUpdateGameRecap   = db.prepare('UPDATE games SET game_writeup = ? WHERE id = ?');
const stmtUpdateGameYoutube = db.prepare('UPDATE games SET youtube_url = ? WHERE id = ?');
const stmtUpdateGameCover   = db.prepare('UPDATE games SET social_cover_data_url = ?, has_cover = (CASE WHEN LENGTH(?) > 0 THEN 1 ELSE 0 END) WHERE id = ?');
const stmtUpdateGamePotg    = db.prepare('UPDATE games SET potg_writeup = ?, manual_potg_player_id = ? WHERE id = ?');
const stmtUpdateGameReview  = db.prepare('UPDATE games SET under_review = ? WHERE id = ?');
const stmtUpdateGameAll     = db.prepare(`
  UPDATE games
  SET game_writeup=?, potg_writeup=?, manual_potg_player_id=?, youtube_url=?, under_review=?, date=?
  WHERE id=?
`);

export function updateGameRecap(id, writeup)        { stmtUpdateGameRecap.run(writeup, id); }
export function updateGameYoutube(id, url)          { stmtUpdateGameYoutube.run(url, id); }
export function updateGameCover(id, dataUrl)        { stmtUpdateGameCover.run(dataUrl, dataUrl, id); }
export function updateGamePotg(id, writeup, player) { stmtUpdateGamePotg.run(String(writeup || ''), String(player || ''), id); }
export function updateGameReview(id, flag)          { stmtUpdateGameReview.run(flag ? 1 : 0, id); }
const stmtDeleteGameStats = db.prepare('DELETE FROM game_player_stats WHERE game_id = ?');
const stmtDeleteGameDnp   = db.prepare('DELETE FROM game_dnp WHERE game_id = ?');
const stmtDeleteGame      = db.prepare('DELETE FROM games WHERE id = ?');

export function deleteGame(id) {
  const game = db.prepare('SELECT season FROM games WHERE id = ?').get(id);
  stmtDeleteGameStats.run(id);
  stmtDeleteGameDnp.run(id);
  stmtDeleteGame.run(id);
  recomputePlayerTotals(game?.season ?? null);
}

const stmtCreateGame = db.prepare(`
  INSERT INTO games (id, date, team_a_id, team_b_id, team_a_name, team_b_name,
    team_a_score, team_b_score, season, game_type, series_id, scheduled, sort_order, status)
  VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1, 0, 'scheduled')
`);
export function createGame({ date, teamAId, teamBId, season, gameType, seriesId }) {
  const teamA = stmtGetTeamById.get(teamAId);
  const teamB = stmtGetTeamById.get(teamBId);
  if (!teamA || !teamB) throw new Error('Invalid team IDs');
  if (teamAId === teamBId) throw new Error('Teams must be different');
  const id = `game_sched_${Date.now()}`;
  stmtCreateGame.run(id, date, teamAId, teamBId, teamA.name, teamB.name, Number(season), gameType || 'regular', seriesId || '');
  return id;
}

const stmtMarkFinal = db.prepare(`
  UPDATE games
  SET team_a_score=?, team_b_score=?, scheduled=0, under_review=0,
      status='final', overtime=?
  WHERE id=?
`);
const stmtSetOvertime = db.prepare(`UPDATE games SET overtime=? WHERE id=?`);

const stmtImportScores = db.prepare(`
  UPDATE games
  SET team_a_score=?, team_b_score=?, scheduled=0, under_review=0,
      status='complete', overtime=?,
      period_snapshots_json=?, game_log_json=?
  WHERE id=?
`);
const stmtInsertGameStat = db.prepare(`
  INSERT OR REPLACE INTO game_player_stats
    (game_id, player_id, team_id, pts, ast, reb, stl, blk, turnover, pf,
     fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes)
  VALUES
    (@game_id,@player_id,@team_id,@pts,@ast,@reb,@stl,@blk,@turnover,@pf,
     @fg2m,@fg3m,@fg2m_miss,@fg3m_miss,@ftm,@ft_miss,@minutes)
`);
const stmtInsertDnp      = db.prepare('INSERT OR IGNORE INTO game_dnp (game_id, player_id) VALUES (?,?)');
const stmtGetPlayerTeam  = db.prepare('SELECT team_id FROM players WHERE id = ?');

export function markGameFinal(gameId, { teamAScore, teamBScore, overtime = 0 }) {
  stmtMarkFinal.run(Number(teamAScore), Number(teamBScore), Number(overtime) || 0, gameId);
}
export function setGameOvertime(gameId, overtime) {
  stmtSetOvertime.run(Number(overtime) || 0, gameId);
}

export function importGameResults(gameId, { teamAScore, teamBScore, periodSnapshots, gameLog, dnpPlayerIds, playerStats, season }) {
  const otCount = Math.max(0, (periodSnapshots || []).length - 4);
  const t1 = Date.now();
  db.transaction(() => {
    stmtDeleteGameStats.run(gameId);
    stmtDeleteGameDnp.run(gameId);
    stmtImportScores.run(
      Number(teamAScore), Number(teamBScore),
      otCount,
      JSON.stringify(periodSnapshots || []),
      JSON.stringify(Array.isArray(gameLog) ? gameLog : []),
      gameId
    );
    for (const [playerId, s] of Object.entries(playerStats || {})) {
      const row = stmtGetPlayerTeam.get(playerId);
      stmtInsertGameStat.run({
        game_id: gameId, player_id: playerId, team_id: row?.team_id || '',
        pts: s.pts|0, ast: s.ast|0, reb: s.reb|0, stl: s.stl|0, blk: s.blk|0,
        turnover: s.to|0, pf: s.pf|0,
        fg2m: s.fg2m|0, fg3m: s.fg3m|0,
        fg2m_miss: s.fg2m_miss|0, fg3m_miss: s.fg3m_miss|0,
        ftm: s.ftm|0, ft_miss: s.ft_miss|0,
        minutes: String(s.min || ''),
      });
    }
    for (const pid of (dnpPlayerIds || [])) {
      if (pid) stmtInsertDnp.run(gameId, pid);
    }
  })();
  console.log(`[importGameResults] transaction=${Date.now() - t1}ms`);
  const t2 = Date.now();
  recomputePlayerTotals(season);
  console.log(`[importGameResults] recomputePlayerTotals=${Date.now() - t2}ms`);
}

export function updateGameAll(id, { game_writeup, potg_writeup, manual_potg_player_id, youtube_url, under_review, date }) {
  stmtUpdateGameAll.run(
    String(game_writeup || ''),
    String(potg_writeup || ''),
    String(manual_potg_player_id || ''),
    String(youtube_url || ''),
    under_review ? 1 : 0,
    String(date || ''),
    id
  );
}

const stmtGetTickerGames = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name, team_a_score, team_b_score,
         game_type, season, series_id, scheduled, period_snapshots_json, overtime, status
  FROM games
  WHERE status IN ('scheduled','final','complete')
  ORDER BY date DESC, id DESC
  LIMIT 14
`);

// Completed games in the same season + game_type, for tallying a playoff/finals series'
// win count "as of" a given game — used to build the ticker's series-score line. Grouped by
// series_id, falling back to the sorted team-id pair when series_id wasn't set, same
// fallback convention as views/playoffs.js's seriesMap.
const stmtGetSeriesCompletedGames = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_score, team_b_score, series_id
  FROM games
  WHERE season = ? AND game_type = ? AND status IN ('final','complete')
  ORDER BY date ASC, id ASC
`);

// highTeamId only matters for game_type 'playoff' — semifinal series are "twice to beat":
// the higher seed only needs 1 win to advance, the lower seed needs 2 (see computeSeries()
// in views/playoffs.js, the actual bracket's win-condition this mirrors). Finals is a plain
// symmetric race to 2, no seeding involved, so highTeamId is ignored there. Pass null/omit
// when the caller doesn't know seeding (e.g. couldn't place both teams in the top 4) — the
// series just won't report as decided, which is the safe default over guessing wrong.
export function getSeriesRecordForGame(game, highTeamId = null) {
  if (!game || (game.game_type !== 'playoff' && game.game_type !== 'finals')) return null;
  const keyOf = (g) => g.series_id || [g.team_a_id, g.team_b_id].sort().join('_');
  const myKey = keyOf(game);
  const rows = stmtGetSeriesCompletedGames.all(game.season, game.game_type)
    .filter(g => keyOf(g) === myKey && (g.date < game.date || (g.date === game.date && g.id <= game.id)));

  let teamAWins = 0, teamBWins = 0;
  for (const g of rows) {
    if (Number(g.team_a_score) === 0 && Number(g.team_b_score) === 0) continue;
    const winnerId = Number(g.team_a_score) > Number(g.team_b_score) ? g.team_a_id : g.team_b_id;
    if (winnerId === game.team_a_id) teamAWins++; else teamBWins++;
  }

  let decided = false, winnerTeamId = null;
  if (game.game_type === 'finals') {
    decided = teamAWins >= 2 || teamBWins >= 2;
    winnerTeamId = teamAWins >= 2 ? game.team_a_id : teamBWins >= 2 ? game.team_b_id : null;
  } else if (highTeamId) {
    const lowTeamId = highTeamId === game.team_a_id ? game.team_b_id : game.team_a_id;
    const highWins  = highTeamId === game.team_a_id ? teamAWins : teamBWins;
    const lowWins   = highTeamId === game.team_a_id ? teamBWins : teamAWins;
    decided = highWins >= 1 || lowWins >= 2;
    winnerTeamId = highWins >= 1 ? highTeamId : lowWins >= 2 ? lowTeamId : null;
  }

  return { teamAWins, teamBWins, decided, winnerTeamId };
}

const stmtGetLastFinalsGame = db.prepare(`
  SELECT * FROM games WHERE season = ? AND game_type = 'finals'
  ORDER BY date DESC, id DESC LIMIT 1
`);

// Whether this season's best-of-N finals series has been decided, and by whom.
// Reuses getSeriesRecordForGame against the most recent finals game on record —
// that function already tallies completed games in the series regardless of
// whether the latest row is itself played yet.
export function getFinalsSeriesResult(season) {
  const game = stmtGetLastFinalsGame.get(String(season));
  if (!game) return null;
  const rec = getSeriesRecordForGame(game);
  if (!rec) return null;
  return {
    ...rec,
    teamAId:   game.team_a_id,
    teamBId:   game.team_b_id,
    teamAName: game.team_a_name,
    teamBName: game.team_b_name,
    winnerTeamName: rec.winnerTeamId === game.team_a_id ? game.team_a_name
      : rec.winnerTeamId === game.team_b_id ? game.team_b_name
      : null,
  };
}

const stmtRecentPlayedGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, team_a_score, team_b_score,
         game_type, season, under_review, status
  FROM games
  WHERE status IN ('final','complete')
  ORDER BY date DESC, id DESC
  LIMIT 5
`);
const stmtScheduledGames = db.prepare(`
  SELECT id, date, team_a_name, team_b_name, game_type, season
  FROM games
  WHERE scheduled = 1
  ORDER BY date ASC, id ASC
  LIMIT 3
`);
const stmtGamesUnderReview = db.prepare(
  `SELECT COUNT(*) AS n FROM games WHERE under_review = 1`
);
const stmtCountActivePlayers = db.prepare(
  `SELECT COUNT(*) AS n FROM players WHERE status != 'inactive'`
);
const stmtCountPlayedGames = db.prepare(
  `SELECT COUNT(*) AS n FROM games WHERE status IN ('final','complete')`
);

export function getRecentPlayedGames()               { return stmtRecentPlayedGames.all(); }
export function getScheduledGames()                  { return stmtScheduledGames.all(); }
export function getGamesUnderReviewCount()           { return stmtGamesUnderReview.get()?.n ?? 0; }
// markGameFinal and setGameOvertime are exported alongside importGameResults above
export function getActivePlayerCount()               { return stmtCountActivePlayers.get()?.n ?? 0; }
export function getPlayedGamesCount()                { return stmtCountPlayedGames.get()?.n ?? 0; }
export function getTickerGames()                     { return stmtGetTickerGames.all(); }
export function getGameRecords()                     { return stmtGetGameRecords.all(); }
export function getAllTeams()                        { return stmtGetTeams.all(); }
export function getAllPlayers()                      { return stmtGetPlayers.all(); }
export function getAllGames()                        { return stmtGetGames.all(); }
export function getGameCover(id)                    { return stmtGetGameCover.get(id); }
export function getTeamSeasonStats()                { return stmtGetTeamSeasonStats.all(); }
export function getTeamRecords()                    { return stmtGetTeamRecords.all(); }
export function getTeamRecordsAsOf(season, date)   { return stmtGetTeamRecordsAsOf.all(season, date, season, date); }
export function getLeaders()                        { return stmtGetLeaders.all(); }
export function getPlayoffLeaders()                 { return stmtGetPlayoffLeaders.all(); }
export function getGameById(id)                     { return stmtGetGameById.get(id); }
export function getGameDetailStats(gameId)          { return stmtGetGameDetailStats.all(gameId); }
export function getGameStats(gameId)                { return stmtGetGameStats.all(gameId); }
export function getPlayerWithTeam(id)               { return stmtGetPlayerWithTeam.get(id); }
export function getPlayerById(id)                   { return stmtGetPlayerById.get(id); }
export function getTeamById(id)                     { return stmtGetTeamById.get(id); }
export function getPlayerTotals(playerId)           { return stmtGetPlayerTotals.get(playerId); }
export function getPlayerGameLog(playerId)          { return stmtGetPlayerGameLog.all(playerId); }
export function getPlayerPotgCandidates(id)         { return stmtGetPlayerPotgCandidates.all({ id }); }
export function getPlayerCareerHighs(playerId)      { return stmtGetPlayerCareerHighs.get(playerId); }
export function getPlayerAwards(playerId)           { return stmtGetPlayerAwards.all(playerId); }
export function getSeasonAwards(season)             { return stmtGetSeasonAwards.all({ season }); }

// ── AI player analysis (Coach's Note) ────────────────────────────────────────

// Career totals + positions for every player who has logged a game — used to
// build position-peer averages for the coach analysis. Mirrors getPlayerTotals'
// own aggregation (complete, non-under-review games) but for the whole league.
const stmtGetAllPlayerCareerTotals = db.prepare(`
  SELECT gps.player_id,
         COALESCE((SELECT json_group_array(pp.position) FROM player_positions pp WHERE pp.player_id = gps.player_id), '[]') AS positions,
         COUNT(DISTINCT gps.game_id) AS games_played,
         SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
         SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
         SUM(gps.fg2m) AS fg2m, SUM(gps.fg3m) AS fg3m,
         SUM(gps.fg2m_miss) AS fg2m_miss, SUM(gps.fg3m_miss) AS fg3m_miss,
         SUM(gps.ftm) AS ftm, SUM(gps.ft_miss) AS ft_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id AND g.status = 'complete' AND g.under_review = 0
  GROUP BY gps.player_id
  HAVING games_played > 0
`);
export function getAllPlayerCareerTotals()          { return stmtGetAllPlayerCareerTotals.all(); }

const stmtGetCoachAnalysis  = db.prepare('SELECT * FROM ai_player_analysis WHERE player_id = ?');
const stmtSaveCoachAnalysis = db.prepare(`
  INSERT INTO ai_player_analysis (player_id, generated_at, model, provider, stat_snapshot, analysis, focus_tag)
  VALUES (@player_id, @generated_at, @model, @provider, @stat_snapshot, @analysis, @focus_tag)
  ON CONFLICT(player_id) DO UPDATE SET
    generated_at=excluded.generated_at, model=excluded.model, provider=excluded.provider,
    stat_snapshot=excluded.stat_snapshot, analysis=excluded.analysis, focus_tag=excluded.focus_tag
`);
const stmtGetAllCoachAnalyses = db.prepare(`
  SELECT a.*, p.name AS player_name, t.name AS team_name
  FROM ai_player_analysis a
  JOIN players p ON p.id = a.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  ORDER BY a.generated_at DESC
`);

export function getCoachAnalysis(playerId)          { return stmtGetCoachAnalysis.get(playerId); }
export function saveCoachAnalysis(data)             { stmtSaveCoachAnalysis.run({ generated_at: Date.now(), ...data }); }
export function getAllCoachAnalyses()               { return stmtGetAllCoachAnalyses.all(); }
export function getAwardSeasons()                   { return stmtGetAwardSeasons.all().map(r => r.season); }

const stmtUpsertAward = db.prepare(
  `INSERT OR REPLACE INTO awards (id, season, award_type, player_id, team_id, notes, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const stmtDeleteAward       = db.prepare('DELETE FROM awards WHERE id = ?');
const stmtClearAwardType    = db.prepare('DELETE FROM awards WHERE season = ? AND award_type = ?');
const stmtGetAwardPlayers = db.prepare(
  `SELECT id, name, team_id FROM players WHERE status != 'inactive' ORDER BY team_id, sort_order, name`
);

// Active players with a real, usable portal login — approved registration AND an
// actual password set (an approved-but-never-set-a-password registration can't log in
// yet, so mentioning that player wouldn't actually reach anyone). Used to scope
// @mentions on game comments to people who could plausibly see/react to being tagged.
const stmtGetPlayersWithAccounts = db.prepare(`
  SELECT DISTINCT p.id, p.name
  FROM players p
  JOIN registrations r ON r.player_id = p.id
  WHERE p.status != 'inactive' AND r.status = 'approved' AND r.password_hash != ''
  ORDER BY p.name
`);
export function getPlayersWithAccounts() { return stmtGetPlayersWithAccounts.all(); }

const stmtGetSeasonPlayerStats = db.prepare(`
  SELECT p.id, p.name, p.positions, t.name AS team_name, t.id AS team_id, t.color AS team_color, p.picture_url,
         COUNT(DISTINCT gps.game_id)  AS games_played,
         SUM(gps.pts)       AS pts,  SUM(gps.ast)      AS ast,  SUM(gps.reb) AS reb,
         SUM(gps.stl)       AS stl,  SUM(gps.blk)      AS blk,  SUM(gps.turnover) AS turnover,
         SUM(gps.fg2m)      AS fg2m, SUM(gps.fg2m_miss) AS fg2m_miss,
         SUM(gps.fg3m)      AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss,
         SUM(gps.ftm)       AS ftm,  SUM(gps.ft_miss)   AS ft_miss,
         pr.overall_ovr     AS overall_ovr
  FROM game_player_stats gps
  JOIN games g   ON g.id   = gps.game_id
  JOIN players p ON p.id   = gps.player_id
  JOIN teams t   ON t.id   = gps.team_id
  LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.season = CAST(? AS TEXT)
  WHERE g.season = ? AND g.under_review = 0 AND g.game_type = 'regular'
  GROUP BY gps.player_id
  HAVING games_played >= 1
`);

export function upsertAward({ id, season, award_type, player_id, team_id = '', notes = '' }) {
  stmtUpsertAward.run(id, season, award_type, player_id, team_id, notes, Date.now());
}
export function deleteAward(id)                        { stmtDeleteAward.run(id); }
export function clearAwardType(season, award_type)     { stmtClearAwardType.run(season, award_type); }
export function getActivePlayers()                     { return stmtGetAwardPlayers.all(); }
export function getSeasonPlayerStats(season)           { return stmtGetSeasonPlayerStats.all(season, season); }
export function getGameDnpPlayers(gameId)           { return stmtGetGameDnpPlayers.all(gameId); }
export function getPlayerPhoto(id)                  { return stmtGetPlayerPhoto.get(id); }
export function updatePlayerPhoto(id, dataUrl)      { stmtUpdatePlayerPhoto.run(dataUrl, id); }
export function getPlayerPhotoOriginal(id)          { return stmtGetPlayerPhotoOriginal.get(id)?.photo_original || ''; }
export function updatePlayerPhotoOriginal(id, dataUrl) { stmtUpdatePlayerPhotoOriginal.run(dataUrl || '', id); }

// Team/stat-leader graphics: one override per (different) player, always slot 0.
const stmtGetAwardPhotoOverrides = db.prepare(
  'SELECT player_id, offset_x, offset_y, zoom, photo_url FROM award_photo_overrides WHERE season = ? AND award_type = ? AND slot = 0'
);
// MVP/DPOY multi-image cover mode: several slots for the *same* player.
const stmtGetAwardPhotoOverridesForPlayer = db.prepare(
  'SELECT slot, offset_x, offset_y, zoom, photo_url FROM award_photo_overrides WHERE season = ? AND award_type = ? AND player_id = ?'
);
const stmtUpsertAwardPhotoOverride = db.prepare(`
  INSERT INTO award_photo_overrides (season, award_type, player_id, slot, offset_x, offset_y, zoom, photo_url, updated_at)
  VALUES (@season, @award_type, @player_id, @slot, @offset_x, @offset_y, @zoom, @photo_url, @updated_at)
  ON CONFLICT(season, award_type, player_id, slot) DO UPDATE SET
    offset_x = excluded.offset_x, offset_y = excluded.offset_y,
    zoom = excluded.zoom, photo_url = excluded.photo_url, updated_at = excluded.updated_at
`);
const stmtDeleteAwardPhotoOverride = db.prepare(
  'DELETE FROM award_photo_overrides WHERE season = ? AND award_type = ? AND player_id = ? AND slot = ?'
);
const stmtDeleteAwardPhotoOverridesAbove = db.prepare(
  'DELETE FROM award_photo_overrides WHERE season = ? AND award_type = ? AND player_id = ? AND slot >= ?'
);

export function getAwardPhotoOverrides(season, award_type) {
  const rows = stmtGetAwardPhotoOverrides.all(season, award_type);
  return Object.fromEntries(rows.map(r => [r.player_id, r]));
}
export function getAwardPhotoOverridesForPlayer(season, award_type, player_id) {
  const rows = stmtGetAwardPhotoOverridesForPlayer.all(season, award_type, player_id);
  return Object.fromEntries(rows.map(r => [r.slot, r]));
}
export function upsertAwardPhotoOverride({ season, award_type, player_id, slot = 0, offset_x = 50, offset_y = 50, zoom = 1, photo_url = '' }) {
  stmtUpsertAwardPhotoOverride.run({ season, award_type, player_id, slot, offset_x, offset_y, zoom, photo_url, updated_at: Date.now() });
}
export function deleteAwardPhotoOverride(season, award_type, player_id, slot = 0) {
  stmtDeleteAwardPhotoOverride.run(season, award_type, player_id, slot);
}
// Drops slots that no longer exist after the column count is reduced.
export function deleteAwardPhotoOverridesFromSlot(season, award_type, player_id, fromSlot) {
  stmtDeleteAwardPhotoOverridesAbove.run(season, award_type, player_id, fromSlot);
}

const stmtUpdatePlayer = db.prepare(
  `UPDATE players SET first_name=?, last_name=?, number=?, positions=?, status=? WHERE id=?`
);
const stmtDeletePlayerPositions = db.prepare(`DELETE FROM player_positions WHERE player_id = ?`);
export function updatePlayer(id, { first_name, last_name, number, positions, status }) {
  const posArr = Array.isArray(positions) ? positions : [];
  db.transaction(() => {
    stmtUpdatePlayer.run(
      String(first_name || '').trim(),
      String(last_name || '').trim(),
      String(number || '').trim(),
      JSON.stringify(posArr),
      ['active','inactive'].includes(status) ? status : 'active',
      id
    );
    stmtDeletePlayerPositions.run(id);
    posArr.forEach((pos, i) => stmtInsertPlayerPos.run(id, pos, i));
  })();
}
export function getCurrentSeason()                  { return stmtGetCurrentSeason.get(); }
export function getSeasonLatestWeek(season)         { return stmtGetSeasonLatestWeek.get(season); }

// ── Player ratings ────────────────────────────────────────────────────────────
const stmtGetGameSeasons = db.prepare(
  `SELECT DISTINCT CAST(season AS TEXT) AS season FROM games WHERE season IS NOT NULL ORDER BY season DESC`
);
export function getGameSeasons() { return stmtGetGameSeasons.all().map(r => r.season); }

const stmtGameCountsBySeason = db.prepare(`
  SELECT CAST(season AS TEXT) AS season,
    SUM(CASE WHEN game_type = 'regular' AND status = 'complete' AND under_review = 0 THEN 1 ELSE 0 END) AS regular_games,
    SUM(CASE WHEN game_type = 'playoff' AND status = 'complete' AND under_review = 0 THEN 1 ELSE 0 END) AS playoff_games,
    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_games
  FROM games
  WHERE season IS NOT NULL
  GROUP BY season
  ORDER BY season DESC
`);
export function getGameCountsBySeason() { return stmtGameCountsBySeason.all(); }

const stmtSignupStatsBySeason = db.prepare(`
  SELECT season,
    COUNT(*)                                                       AS total,
    SUM(CASE WHEN status = 'confirmed'  THEN 1 ELSE 0 END)        AS confirmed,
    SUM(CASE WHEN status = 'waitlisted' THEN 1 ELSE 0 END)        AS waitlisted,
    SUM(CASE WHEN status = 'rejected'   THEN 1 ELSE 0 END)        AS rejected
  FROM season_signups
  GROUP BY season
`);
export function getSignupStatsBySeason() { return stmtSignupStatsBySeason.all(); }

const stmtAllSeasonQuotas = db.prepare('SELECT season, amount FROM season_quotas ORDER BY season DESC');
export function getAllSeasonQuotas() { return stmtAllSeasonQuotas.all(); }

const stmtGetPlayersWithRatings = db.prepare(`
  SELECT p.id, p.name, p.number, p.status, p.sort_order, p.picture_url,
         COALESCE((SELECT pt.games_played FROM player_totals pt WHERE pt.player_id = p.id), 0) AS career_games,
         t.name AS team_name, t.color AS team_color,
         COALESCE((SELECT json_group_array(pp.position ORDER BY pp.sort_order)
                   FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions,
         r.scoring, r.shooting, r.rebounding, r.playmaking, r.defense, r.iq, r.usage, r.overall,
         r.scoring_ovr, r.shooting_ovr, r.rebounding_ovr, r.playmaking_ovr,
         r.defense_ovr, r.iq_ovr, r.usage_ovr, r.overall_ovr,
         r.locked, r.computed_at,
         COALESCE(r.overall_ovr, r.overall)       AS eff_overall,
         COALESCE(r.scoring_ovr, r.scoring)       AS eff_scoring,
         COALESCE(r.shooting_ovr, r.shooting)     AS eff_shooting,
         COALESCE(r.rebounding_ovr, r.rebounding) AS eff_rebounding,
         COALESCE(r.playmaking_ovr, r.playmaking) AS eff_playmaking,
         COALESCE(r.defense_ovr, r.defense)       AS eff_defense,
         COALESCE(r.iq_ovr, r.iq)                 AS eff_iq,
         COALESCE(r.usage_ovr, r.usage)           AS eff_usage
  FROM players p
  LEFT JOIN teams t ON t.id = p.team_id
  LEFT JOIN player_ratings r ON r.player_id = p.id AND r.season = ?
  ORDER BY p.status ASC, COALESCE(r.overall_ovr, r.overall) DESC, p.sort_order ASC
`);
export function getPlayersWithRatings(season) { return stmtGetPlayersWithRatings.all(String(season ?? '')); }

const stmtSetPlayerNumber = db.prepare(`UPDATE players SET number = ? WHERE id = ?`);
export function setPlayerNumber(id, number) { stmtSetPlayerNumber.run(String(number ?? '').trim(), id); }

const stmtSetPlayerStatus = db.prepare(`UPDATE players SET status = ? WHERE id = ?`);
export function setPlayerStatus(id, status) {
  stmtSetPlayerStatus.run(['active','inactive'].includes(status) ? status : 'active', id);
}

const stmtSetPlayerTeam = db.prepare(`UPDATE players SET team_id = ? WHERE id = ?`);
export function setPlayerTeam(id, teamId) { stmtSetPlayerTeam.run(String(teamId ?? ''), id); }

const stmtGetPlayerRating = db.prepare('SELECT * FROM player_ratings WHERE player_id = ? AND season = ?');
export function getPlayerRating(playerId, season) { return stmtGetPlayerRating.get(playerId, String(season ?? '')); }

const stmtDeleteUnlockedRating = db.prepare(
  `DELETE FROM player_ratings WHERE player_id = ? AND season = ? AND locked = 0`
);
export function deleteUnlockedRating(playerId, season) {
  stmtDeleteUnlockedRating.run(playerId, String(season ?? ''));
}

const stmtUpsertComputedRating = db.prepare(`
  INSERT INTO player_ratings
    (player_id, season, scoring, shooting, rebounding, playmaking, defense, iq, usage, overall, computed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id, season) DO UPDATE SET
    scoring=excluded.scoring, shooting=excluded.shooting, rebounding=excluded.rebounding,
    playmaking=excluded.playmaking, defense=excluded.defense, iq=excluded.iq,
    usage=excluded.usage, overall=excluded.overall, computed_at=excluded.computed_at
  WHERE locked = 0
`);
export function upsertComputedRating(playerId, season, r) {
  stmtUpsertComputedRating.run(
    playerId, String(season ?? ''),
    r.scoring, r.shooting, r.rebounding, r.playmaking, r.defense, r.iq, r.usage, r.overall,
    Date.now()
  );
}

const stmtSaveRatingOverrides = db.prepare(`
  INSERT INTO player_ratings
    (player_id, season, scoring_ovr, shooting_ovr, rebounding_ovr, playmaking_ovr,
     defense_ovr, iq_ovr, usage_ovr, overall_ovr, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id, season) DO UPDATE SET
    scoring_ovr=excluded.scoring_ovr, shooting_ovr=excluded.shooting_ovr,
    rebounding_ovr=excluded.rebounding_ovr, playmaking_ovr=excluded.playmaking_ovr,
    defense_ovr=excluded.defense_ovr, iq_ovr=excluded.iq_ovr,
    usage_ovr=excluded.usage_ovr, overall_ovr=excluded.overall_ovr,
    updated_at=excluded.updated_at
`);
export function saveRatingOverrides(playerId, season, ovr) {
  const n = v => (v !== '' && v != null && !isNaN(Number(v))) ? Number(v) : null;
  stmtSaveRatingOverrides.run(
    playerId, String(season ?? ''),
    n(ovr.scoring), n(ovr.shooting), n(ovr.rebounding), n(ovr.playmaking),
    n(ovr.defense), n(ovr.iq), n(ovr.usage), n(ovr.overall),
    Date.now()
  );
}

const stmtGetStatsBySeason = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE CAST(g.season AS TEXT) = ? AND g.status = 'complete'
  GROUP BY gps.player_id
`);
const stmtGetStatsAllTime = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE g.status = 'complete'
  GROUP BY gps.player_id
`);
export function getStatsBySeason(season) {
  return season ? stmtGetStatsBySeason.all(String(season)) : stmtGetStatsAllTime.all();
}

const stmtGetOnePlayerStatsBySeason = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND CAST(g.season AS TEXT) = ? AND g.status = 'complete'
`);
const stmtGetOnePlayerStatsAllTime = db.prepare(`
  SELECT gps.player_id,
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover,
    SUM(gps.pf) AS pf, SUM(gps.fg3m) AS fg3m, SUM(gps.fg3m_miss) AS fg3m_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ? AND g.status = 'complete'
`);
export function getOnePlayerStats(playerId, season) {
  return season
    ? stmtGetOnePlayerStatsBySeason.get(playerId, String(season))
    : stmtGetOnePlayerStatsAllTime.get(playerId);
}

const stmtUpsertPlayerDetails = db.prepare(`
  INSERT INTO player_details
    (player_id, height, weight, hometown, school, nickname, wingspan, dominant_hand, years_playing, social_instagram, social_twitter)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_id) DO UPDATE SET
    height=excluded.height, weight=excluded.weight, hometown=excluded.hometown,
    school=excluded.school, nickname=excluded.nickname, wingspan=excluded.wingspan,
    dominant_hand=excluded.dominant_hand, years_playing=excluded.years_playing,
    social_instagram=excluded.social_instagram, social_twitter=excluded.social_twitter
`);
export function upsertPlayerDetails(playerId, d) {
  const s = v => String(v || '').trim();
  stmtUpsertPlayerDetails.run(
    playerId, s(d.height), s(d.weight), s(d.hometown), s(d.school),
    s(d.nickname), s(d.wingspan), s(d.dominant_hand), s(d.years_playing),
    s(d.social_instagram), s(d.social_twitter)
  );
}

const stmtUpdateWriteup  = db.prepare(`UPDATE players SET writeup = ? WHERE id = ?`);
export function updatePlayerWriteup(id, writeup) { stmtUpdateWriteup.run(String(writeup || '').trim(), id); }

const stmtUpdatePlayerUserId        = db.prepare(`UPDATE players SET user_id  = ? WHERE id = ?`);
const stmtUpdatePlayerBirthday      = db.prepare(`UPDATE players SET birthday = ? WHERE id = ? AND (birthday = '' OR birthday IS NULL)`);
const stmtUpdatePlayerBirthdayForce = db.prepare(`UPDATE players SET birthday = ? WHERE id = ?`);
const stmtUpdateRegBirthday         = db.prepare(`UPDATE registrations SET birthday = ? WHERE id = ?`);
const stmtUpdatePlayerName          = db.prepare(`UPDATE players SET first_name = ?, last_name = ? WHERE id = ?`);

export function updateRegBirthday(regId, birthday, playerId = null) {
  db.transaction(() => {
    stmtUpdateRegBirthday.run(birthday, regId);
    if (playerId) stmtUpdatePlayerBirthdayForce.run(birthday, playerId);
  })();
}

export function mergeRegistrationIntoPlayer(playerId, reg) {
  db.transaction(() => {
    // Parse "LASTNAME, Firstname" from full_name
    const parts     = (reg.full_name || '').split(',');
    const last_name  = (parts[0] || '').trim();
    const first_name = (parts[1] || '').trim();
    if (first_name || last_name) stmtUpdatePlayerName.run(first_name, last_name, playerId);

    if (reg.user_id)  stmtUpdatePlayerUserId.run(reg.user_id, playerId);
    if (reg.birthday) stmtUpdatePlayerBirthday.run(reg.birthday, playerId);
    if (reg.motto)    stmtUpdateWriteup.run(reg.motto.trim(), playerId);
    // Registration positions only replace the player's if the registrant actually
    // picked any — an admin linking to an existing player shouldn't wipe out
    // positions the player already has just because this particular registration
    // row left the field blank.
    let regPositions = [];
    try { regPositions = JSON.parse(reg.positions || '[]'); } catch {}
    if (Array.isArray(regPositions) && regPositions.length) {
      stmtDeletePlayerPositions.run(playerId);
      regPositions.forEach((pos, i) => stmtInsertPlayerPos.run(playerId, pos, i));
    }
    if (reg.height || reg.weight || reg.dominant_hand) {
      upsertPlayerDetails(playerId, {
        height: reg.height || '',
        weight: reg.weight || '',
        dominant_hand: reg.dominant_hand || '',
      });
    }
  })();
}

const stmtPrevMatchup = db.prepare(`
  SELECT id, date, team_a_id, team_b_id, team_a_name, team_b_name, team_a_score, team_b_score
  FROM games
  WHERE status IN ('final','complete') AND id != ?
    AND ((team_a_id = ? AND team_b_id = ?) OR (team_a_id = ? AND team_b_id = ?))
    AND team_a_score + team_b_score > 0
  ORDER BY date DESC, id DESC
  LIMIT 1
`);
export function getPrevMatchup(gameId, teamAId, teamBId) {
  return stmtPrevMatchup.get(gameId, teamAId, teamBId, teamBId, teamAId) ?? null;
}

export function getTeamStreak(teamId, currentGameId) {
  const games = db.prepare(`
    SELECT team_a_id, team_a_score, team_b_score
    FROM games
    WHERE status IN ('final','complete') AND id != ?
      AND (team_a_id = ? OR team_b_id = ?)
      AND team_a_score + team_b_score > 0
    ORDER BY date DESC, id DESC
    LIMIT 10
  `).all(currentGameId, teamId, teamId);
  if (!games.length) return { streak: 0, type: null };
  let streak = 0, type = null;
  for (const g of games) {
    const teamScore = g.team_a_id === teamId ? g.team_a_score : g.team_b_score;
    const oppScore  = g.team_a_id === teamId ? g.team_b_score : g.team_a_score;
    const won = teamScore > oppScore;
    if (type === null) { type = won ? 'W' : 'L'; streak = 1; }
    else if ((type === 'W') === won) streak++;
    else break;
  }
  return { streak, type };
}

export function getPlayerLeagueRank(playerId, season) {
  const rows = db.prepare(`
    SELECT player_id, pts * 1.0 / NULLIF(games_played, 0) AS ppg
    FROM player_totals WHERE season = ? AND games_played > 0
    ORDER BY ppg DESC
  `).all(season);
  const idx = rows.findIndex(r => r.player_id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

export function getPlayerSeasonStats(playerId, season) {
  return db.prepare('SELECT * FROM player_totals WHERE player_id = ? AND season = ?').get(playerId, season) ?? null;
}

// Returns rows per (season, game_type) plus a synthetic 'career' row summing everything.
export function getPlayerStatsByType(playerId) {
  const rows = db.prepare(`
    SELECT g.season, g.game_type,
      COUNT(DISTINCT gps.game_id)                               AS games_played,
      SUM(gps.pts) AS pts, SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
      SUM(gps.stl) AS stl, SUM(gps.blk) AS blk, SUM(gps.turnover) AS turnover, SUM(gps.pf) AS pf,
      SUM(gps.fg2m) AS fg2m, SUM(gps.fg3m) AS fg3m,
      SUM(gps.fg2m_miss) AS fg2m_miss, SUM(gps.fg3m_miss) AS fg3m_miss,
      SUM(gps.ftm) AS ftm, SUM(gps.ft_miss) AS ft_miss
    FROM game_player_stats gps
    JOIN games g ON g.id = gps.game_id
    WHERE gps.player_id = ? AND g.status = 'complete'
    GROUP BY g.season, g.game_type
    ORDER BY g.season DESC, g.game_type ASC
  `).all(playerId);

  if (!rows.length) return { seasons: [], career: null };

  const sum = (field) => rows.reduce((acc, r) => acc + (r[field] ?? 0), 0);
  const career = {
    season: null, game_type: 'career',
    games_played: sum('games_played'),
    pts: sum('pts'), ast: sum('ast'), reb: sum('reb'),
    stl: sum('stl'), blk: sum('blk'), turnover: sum('turnover'), pf: sum('pf'),
    fg2m: sum('fg2m'), fg3m: sum('fg3m'),
    fg2m_miss: sum('fg2m_miss'), fg3m_miss: sum('fg3m_miss'),
    ftm: sum('ftm'), ft_miss: sum('ft_miss'),
  };

  return { seasons: rows, career };
}

export function recomputePlayerTotals(season) {
  const s = season ?? db.prepare(`SELECT MAX(season) AS s FROM games WHERE status = 'complete'`).get()?.s ?? 3;
  const rows = db.prepare(`
    SELECT player_id,
      COUNT(DISTINCT game_id) AS games_played,
      SUM(pts) AS pts, SUM(ast) AS ast, SUM(reb) AS reb,
      SUM(stl) AS stl, SUM(blk) AS blk, SUM(turnover) AS turnover, SUM(pf) AS pf,
      SUM(fg2m) AS fg2m, SUM(fg3m) AS fg3m,
      SUM(fg2m_miss) AS fg2m_miss, SUM(fg3m_miss) AS fg3m_miss,
      SUM(ftm) AS ftm, SUM(ft_miss) AS ft_miss
    FROM game_player_stats gps
    JOIN games g ON g.id = gps.game_id
    WHERE g.season = ? AND g.status = 'complete' AND g.game_type = 'regular'
    GROUP BY player_id
  `).all(s);
  const upsert = db.prepare(`
    INSERT INTO player_totals
      (player_id, season, games_played, pts, ast, reb, stl, blk, turnover, pf,
       fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id, season) DO UPDATE SET
      games_played=excluded.games_played, pts=excluded.pts, ast=excluded.ast,
      reb=excluded.reb, stl=excluded.stl, blk=excluded.blk,
      turnover=excluded.turnover, pf=excluded.pf, fg2m=excluded.fg2m,
      fg3m=excluded.fg3m, fg2m_miss=excluded.fg2m_miss,
      fg3m_miss=excluded.fg3m_miss, ftm=excluded.ftm, ft_miss=excluded.ft_miss
  `);
  const run = db.transaction(() => {
    for (const r of rows) {
      upsert.run(r.player_id, s, r.games_played, r.pts, r.ast, r.reb, r.stl, r.blk,
        r.turnover, r.pf, r.fg2m, r.fg3m, r.fg2m_miss, r.fg3m_miss, r.ftm, r.ft_miss);
    }
  });
  run();
  return rows.length;
}

// ── Rating context queries ────────────────────────────────────────────────────

// Team-level FGA/FTA/TOV totals for USG% calculation
const stmtGetTeamRatingTotals = db.prepare(`
  SELECT gps.team_id,
    SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss) AS fga,
    SUM(gps.ftm  + gps.ft_miss)                               AS fta,
    SUM(gps.turnover)                                          AS tov
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE CAST(g.season AS TEXT) = ? AND g.status = 'complete' AND g.under_review = 0
  GROUP BY gps.team_id
`);
const stmtGetTeamRatingTotalsAll = db.prepare(`
  SELECT gps.team_id,
    SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss) AS fga,
    SUM(gps.ftm  + gps.ft_miss)                               AS fta,
    SUM(gps.turnover)                                          AS tov
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE g.status = 'complete' AND g.under_review = 0
  GROUP BY gps.team_id
`);
export function getTeamRatingTotals(season) {
  const rows = season
    ? stmtGetTeamRatingTotals.all(String(season))
    : stmtGetTeamRatingTotalsAll.all();
  return Object.fromEntries(rows.map(r => [r.team_id, { fga: r.fga || 0, fta: r.fta || 0, tov: r.tov || 0 }]));
}

// Last N games stats for a player (for recency blend)
const stmtGetPlayerRecentStats = db.prepare(`
  SELECT
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts)       AS pts,  SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl)       AS stl,  SUM(gps.blk) AS blk,
    SUM(gps.turnover)  AS turnover, SUM(gps.pf) AS pf,
    SUM(gps.fg2m)      AS fg2m, SUM(gps.fg3m) AS fg3m,
    SUM(gps.fg2m_miss) AS fg2m_miss, SUM(gps.fg3m_miss) AS fg3m_miss,
    SUM(gps.ftm)       AS ftm,  SUM(gps.ft_miss) AS ft_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
    AND gps.game_id IN (
      SELECT gps2.game_id FROM game_player_stats gps2
      JOIN games g2 ON g2.id = gps2.game_id
      WHERE gps2.player_id = ?
        AND CAST(g2.season AS TEXT) = ?
        AND g2.status = 'complete' AND g2.under_review = 0
      ORDER BY g2.date DESC, g2.id DESC
      LIMIT 5
    )
`);
const stmtGetPlayerRecentStatsAll = db.prepare(`
  SELECT
    COUNT(DISTINCT gps.game_id) AS games_played,
    SUM(gps.pts)       AS pts,  SUM(gps.ast) AS ast, SUM(gps.reb) AS reb,
    SUM(gps.stl)       AS stl,  SUM(gps.blk) AS blk,
    SUM(gps.turnover)  AS turnover, SUM(gps.pf) AS pf,
    SUM(gps.fg2m)      AS fg2m, SUM(gps.fg3m) AS fg3m,
    SUM(gps.fg2m_miss) AS fg2m_miss, SUM(gps.fg3m_miss) AS fg3m_miss,
    SUM(gps.ftm)       AS ftm,  SUM(gps.ft_miss) AS ft_miss
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND g.status = 'complete' AND g.under_review = 0
    AND gps.game_id IN (
      SELECT gps2.game_id FROM game_player_stats gps2
      JOIN games g2 ON g2.id = gps2.game_id
      WHERE gps2.player_id = ?
        AND g2.status = 'complete' AND g2.under_review = 0
      ORDER BY g2.date DESC, g2.id DESC
      LIMIT 5
    )
`);
export function getPlayerRecentStats(playerId, season) {
  return season
    ? stmtGetPlayerRecentStats.get(playerId, String(season), playerId, String(season))
    : stmtGetPlayerRecentStatsAll.get(playerId, playerId);
}

// Per-game pts array for consistency calculation
const stmtGetPlayerGamePts = db.prepare(`
  SELECT gps.pts
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
  ORDER BY g.date DESC, g.id DESC
`);
const stmtGetPlayerGamePtsAll = db.prepare(`
  SELECT gps.pts
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND g.status = 'complete' AND g.under_review = 0
  ORDER BY g.date DESC, g.id DESC
`);
export function getPlayerGamePts(playerId, season) {
  return (season
    ? stmtGetPlayerGamePts.all(playerId, String(season))
    : stmtGetPlayerGamePtsAll.all(playerId)
  ).map(r => r.pts || 0);
}

// Win rate for games a player appeared in
const stmtGetPlayerWinRate = db.prepare(`
  SELECT
    COUNT(*) AS gp,
    SUM(CASE
      WHEN gps.team_id = g.team_a_id AND g.team_a_score > g.team_b_score THEN 1
      WHEN gps.team_id = g.team_b_id AND g.team_b_score > g.team_a_score THEN 1
      ELSE 0
    END) AS wins
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND CAST(g.season AS TEXT) = ?
    AND g.status = 'complete' AND g.under_review = 0
`);
const stmtGetPlayerWinRateAll = db.prepare(`
  SELECT
    COUNT(*) AS gp,
    SUM(CASE
      WHEN gps.team_id = g.team_a_id AND g.team_a_score > g.team_b_score THEN 1
      WHEN gps.team_id = g.team_b_id AND g.team_b_score > g.team_a_score THEN 1
      ELSE 0
    END) AS wins
  FROM game_player_stats gps
  JOIN games g ON g.id = gps.game_id
  WHERE gps.player_id = ?
    AND g.status = 'complete' AND g.under_review = 0
`);
export function getPlayerWinRate(playerId, season) {
  const row = season
    ? stmtGetPlayerWinRate.get(playerId, String(season))
    : stmtGetPlayerWinRateAll.get(playerId);
  if (!row || !row.gp) return null;
  return row.wins / row.gp;
}

// Total completed games in a season (for availability)
const stmtGetTotalSeasonGames = db.prepare(`
  SELECT COUNT(*) AS n FROM games
  WHERE CAST(season AS TEXT) = ? AND status = 'complete' AND under_review = 0
`);
const stmtGetTotalSeasonGamesAll = db.prepare(`
  SELECT COUNT(*) AS n FROM games WHERE status = 'complete' AND under_review = 0
`);
export function getTotalSeasonGames(season) {
  return season
    ? (stmtGetTotalSeasonGames.get(String(season))?.n ?? 0)
    : (stmtGetTotalSeasonGamesAll.get()?.n ?? 0);
}

// ── Compare cache ─────────────────────────────────────────────────────────────
const stmtGetCompareCache = db.prepare(
  `SELECT writeup FROM compare_cache WHERE pair_key = ? AND stats_key = ?`
);
const stmtSetCompareCache = db.prepare(
  `INSERT OR REPLACE INTO compare_cache (pair_key, stats_key, writeup, created_at, view_count, last_viewed_at, model)
   VALUES (?, ?, ?, ?, 1, ?, ?)`
);
const stmtIncrementCompareViews = db.prepare(
  `UPDATE compare_cache SET view_count = view_count + 1, last_viewed_at = ? WHERE pair_key = ?`
);
const stmtGetCompareAnalytics = db.prepare(`
  SELECT
    cc.pair_key,
    cc.writeup,
    cc.view_count,
    cc.last_viewed_at,
    cc.created_at,
    cc.model,
    p1.id   AS player_a_id,
    p1.name AS player_a_name,
    p2.id   AS player_b_id,
    p2.name AS player_b_name
  FROM compare_cache cc
  LEFT JOIN players p1 ON p1.id = substr(cc.pair_key, 1, instr(cc.pair_key, '|') - 1)
  LEFT JOIN players p2 ON p2.id = substr(cc.pair_key, instr(cc.pair_key, '|') + 1)
  ORDER BY cc.view_count DESC, cc.last_viewed_at DESC
`);

function comparePairKey(idA, idB) { return [idA, idB].sort().join('|'); }
function compareStatsKey(idA, idB, tA, tB) {
  // Always encode stats in sorted-ID order so A vs B == B vs A
  const [first, second] = idA < idB ? [tA, tB] : [tB, tA];
  return `${first?.games_played|0}_${first?.pts|0}_${first?.reb|0}_${first?.ast|0}_${second?.games_played|0}_${second?.pts|0}_${second?.reb|0}_${second?.ast|0}`;
}

export function getCompareCache(idA, idB, tA, tB) {
  const pair = comparePairKey(idA, idB);
  const stats = compareStatsKey(idA, idB, tA, tB);
  const row = stmtGetCompareCache.get(pair, stats);
  return row ? row.writeup : null;
}

export function setCompareCache(idA, idB, tA, tB, writeup, model = null) {
  const pair = comparePairKey(idA, idB);
  const stats = compareStatsKey(idA, idB, tA, tB);
  const now = Date.now();
  stmtSetCompareCache.run(pair, stats, writeup, now, now, model);
}

export function incrementCompareViews(idA, idB) {
  stmtIncrementCompareViews.run(Date.now(), comparePairKey(idA, idB));
}

export function getCompareAnalytics() {
  return stmtGetCompareAnalytics.all();
}

// ── MVP cache ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS mvp_cache (
    player_id  TEXT NOT NULL,
    season     TEXT NOT NULL,
    stats_key  TEXT NOT NULL,
    writeup    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, season)
  )
`);

const stmtGetMvpWriteup = db.prepare(
  `SELECT writeup FROM mvp_cache WHERE player_id=? AND season=? AND stats_key=?`
);
const stmtSetMvpWriteup = db.prepare(
  `INSERT OR REPLACE INTO mvp_cache (player_id, season, stats_key, writeup, created_at)
   VALUES (?, ?, ?, ?, ?)`
);
// Team win/loss context always reflects the regular season (used for computeMvpScore's
// winMult), independent of which game_type the candidate stats themselves are scoped to.
const stmtGetCandidatesForGameType = db.prepare(`
  WITH team_records AS (
    SELECT team_id,
           SUM(CASE WHEN team_score > opp_score THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN team_score < opp_score THEN 1 ELSE 0 END) AS losses
    FROM (
      SELECT team_a_id AS team_id, team_a_score AS team_score, team_b_score AS opp_score
      FROM games WHERE season = ? AND game_type = 'regular' AND status = 'complete' AND under_review = 0
      UNION ALL
      SELECT team_b_id, team_b_score, team_a_score
      FROM games WHERE season = ? AND game_type = 'regular' AND status = 'complete' AND under_review = 0
    ) GROUP BY team_id
  )
  SELECT
    p.id, p.name, p.picture_url, p.team_id,
    t.name  AS team_name,
    t.color AS team_color,
    COUNT(gps.game_id)                                         AS gp,
    SUM(gps.pts)                                               AS pts,
    SUM(gps.reb)                                               AS reb,
    SUM(gps.ast)                                               AS ast,
    SUM(gps.stl)                                               AS stl,
    SUM(gps.blk)                                               AS blk,
    SUM(gps.turnover)                                          AS tov,
    SUM(gps.fg2m + gps.fg3m)                                  AS fgm,
    SUM(gps.fg2m + gps.fg3m + gps.fg2m_miss + gps.fg3m_miss) AS fga,
    SUM(gps.fg3m)                                              AS fg3m,
    SUM(gps.fg3m + gps.fg3m_miss)                             AS fg3a,
    SUM(gps.ftm)                                               AS ftm,
    SUM(gps.ftm + gps.ft_miss)                                AS fta,
    SUM(gps.fg2m_miss + gps.fg3m_miss)                        AS fgmiss,
    SUM(gps.ft_miss)                                           AS ftmiss,
    COALESCE(tr.wins, 0)                                       AS wins,
    COALESCE(tr.losses, 0)                                     AS losses
  FROM game_player_stats gps
  JOIN games        g  ON g.id  = gps.game_id
  JOIN players      p  ON p.id  = gps.player_id
  JOIN teams        t  ON t.id  = p.team_id
  LEFT JOIN team_records tr ON tr.team_id = p.team_id
  WHERE g.season = ? AND g.under_review = 0 AND g.game_type = ?
    AND g.status = 'complete'
  GROUP BY p.id
`);
function getCandidatesForGameType(season, gameType) {
  const s = String(season);
  return stmtGetCandidatesForGameType.all(s, s, s, gameType);
}
const stmtGetTotalSeasonGamesForMvp = db.prepare(`
  SELECT COUNT(*) AS cnt FROM games
  WHERE season=? AND under_review=0 AND game_type='regular' AND status='complete'
`);

export function getMvpWriteup(playerId, season, statsKey) {
  const row = stmtGetMvpWriteup.get(playerId, String(season), statsKey);
  return row ? row.writeup : null;
}
export function setMvpWriteup(playerId, season, statsKey, writeup) {
  stmtSetMvpWriteup.run(playerId, String(season), statsKey, writeup, Date.now());
}

const stmtDeleteMvpWriteupForPlayer = db.prepare(`DELETE FROM mvp_cache WHERE player_id=? AND season=?`);
const stmtClearMvpWriteupSeason     = db.prepare(`DELETE FROM mvp_cache WHERE season=?`);
export function deleteMvpWriteupForPlayer(playerId, season) { stmtDeleteMvpWriteupForPlayer.run(playerId, String(season)); }
export function clearMvpWriteupSeason(season)               { stmtClearMvpWriteupSeason.run(String(season)); }
export function getMvpCandidates(season) {
  return getCandidatesForGameType(season, 'regular');
}
export function getFinalsMvpCandidates(season) {
  return getCandidatesForGameType(season, 'finals');
}
export function getTotalSeasonGamesForMvp(season) {
  return stmtGetTotalSeasonGamesForMvp.get(String(season))?.cnt ?? 0;
}

// ── Playoffs ──────────────────────────────────────────────────────────────────
const stmtGetSeasonStandings = db.prepare(`
  SELECT t.id, t.name, t.color, t.sort_order,
    COALESCE(SUM(CASE
      WHEN (g.team_a_id = t.id AND g.team_a_score > g.team_b_score)
        OR (g.team_b_id = t.id AND g.team_b_score > g.team_a_score) THEN 1 ELSE 0 END), 0) AS wins,
    COALESCE(SUM(CASE
      WHEN (g.team_a_id = t.id AND g.team_a_score < g.team_b_score)
        OR (g.team_b_id = t.id AND g.team_b_score < g.team_a_score) THEN 1 ELSE 0 END), 0) AS losses,
    COALESCE(SUM(CASE
      WHEN g.team_a_id = t.id THEN g.team_a_score - g.team_b_score
      WHEN g.team_b_id = t.id THEN g.team_b_score - g.team_a_score
      ELSE 0 END), 0) AS point_diff,
    COALESCE(SUM(CASE
      WHEN g.team_a_id = t.id THEN g.team_a_score
      WHEN g.team_b_id = t.id THEN g.team_b_score
      ELSE 0 END), 0) AS pf,
    COALESCE(SUM(CASE
      WHEN g.team_a_id = t.id THEN g.team_b_score
      WHEN g.team_b_id = t.id THEN g.team_a_score
      ELSE 0 END), 0) AS pa
  FROM teams t
  LEFT JOIN games g ON (g.team_a_id = t.id OR g.team_b_id = t.id)
    AND g.season = ? AND g.game_type = 'regular' AND g.status = 'complete' AND g.under_review = 0
  GROUP BY t.id
  ORDER BY wins DESC, point_diff DESC, t.sort_order ASC
`);
export function getSeasonStandings(season) { return stmtGetSeasonStandings.all(String(season)); }

const stmtGetPlayoffGames = db.prepare(`
  SELECT id, date, game_type, playoff_round, series_id,
    team_a_id, team_a_name, team_a_score,
    team_b_id, team_b_name, team_b_score,
    status, overtime
  FROM games
  WHERE season = ? AND game_type IN ('playoff', 'finals') AND under_review = 0
  ORDER BY date ASC, sort_order ASC, id ASC
`);
export function getPlayoffGames(season) { return stmtGetPlayoffGames.all(String(season)); }

// ── Papawis (pickup games) ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS papawis_games (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL DEFAULT '',
    date             TEXT NOT NULL,
    time_label       TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    max_slots        INTEGER NOT NULL DEFAULT 10,
    price_per_player REAL,
    status           TEXT NOT NULL DEFAULT 'open',
    notes            TEXT NOT NULL DEFAULT '',
    created_by       TEXT NOT NULL DEFAULT '',
    created_at       INTEGER NOT NULL,
    completed_at     INTEGER
  )
`);
const _papawisCols = db.prepare('PRAGMA table_info(papawis_games)').all().map(c => c.name);
if (!_papawisCols.includes('start_time')) db.exec(`ALTER TABLE papawis_games ADD COLUMN start_time TEXT NOT NULL DEFAULT ''`);
if (!_papawisCols.includes('end_time'))   db.exec(`ALTER TABLE papawis_games ADD COLUMN end_time   TEXT NOT NULL DEFAULT ''`);
// NULL = sign-ups open immediately. Set = sign-ups are shown as "Scheduled" (not joinable)
// until this many days before the game date, then automatically read as open — see
// isSignupOpen() below, computed at read time rather than a background status flip.
if (!_papawisCols.includes('open_days_before')) db.exec(`ALTER TABLE papawis_games ADD COLUMN open_days_before INTEGER`);
// Manual roster lock — set once an admin has actually sent the numbered list out (e.g.
// via "Copy for Messenger"), independent of the automated reminder-email flag. While set,
// the admin UI swaps the interactive confirmed/waitlist/teams panels for a static summary
// table; see the signups_locked_at guard on the mutation routes in server.js.
if (!_papawisCols.includes('signups_locked_at')) db.exec(`ALTER TABLE papawis_games ADD COLUMN signups_locked_at INTEGER`);

db.exec(`
  CREATE TABLE IF NOT EXISTS papawis_signups (
    id           TEXT PRIMARY KEY,
    game_id      TEXT NOT NULL,
    player_id    TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'confirmed',
    signed_up_at INTEGER NOT NULL,
    cancelled_at INTEGER
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_papawis_signups_game ON papawis_signups(game_id)`);
{
  // Empty = a real signup for player_id. Non-empty = a guest slot sponsored by player_id —
  // player_id is who gets charged, guest_name is who's actually attending.
  const _psCols = db.prepare('PRAGMA table_info(papawis_signups)').all().map(c => c.name);
  if (!_psCols.includes('guest_name')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN guest_name TEXT NOT NULL DEFAULT ''`);
  // Admin-draggable order within a status group (confirmed/waitlist are ordered
  // separately — see stmtPapawisSignups' ORDER BY). Defaults to 0 for pre-existing
  // rows, which just means they all sort together by signed_up_at until an admin
  // actually drags something, at which point every touched row gets a real value.
  if (!_psCols.includes('sort_order')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  // '' = not yet assigned to a scrimmage side. 'light'/'dark' once the admin has run (or
  // manually set) the team split for that game — see buildBalancedTeams() in
  // lib/papawis-teams.js. Independent of status: only 'confirmed' signups are ever
  // assigned, but the column isn't constrained to that so a status change later doesn't
  // require touching it.
  if (!_psCols.includes('team')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN team TEXT NOT NULL DEFAULT ''`);
  // NULL = the pre-game reminder email hasn't gone out yet. Set on send by the reminder
  // job (see getPapawisSignupsDueForReminder/markPapawisReminderSent + lib/papawis-notify.js).
  // Deliberately a per-signup flag rather than "games created after date X" — that's what
  // lets a game already sitting inside the reminder window (created before this feature
  // existed, or joined late) get caught up on the very next scan instead of being skipped.
  if (!_psCols.includes('reminder_sent_at')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN reminder_sent_at INTEGER`);
  // NULL = no one-time "you've been placed on Team X" catch-up email has been sent for
  // this signup. Distinct from reminder_sent_at — that's the automatic pre-game reminder,
  // which only mentions a team if one was already assigned *when the scan ran*. This column
  // exists for the gap case: reminder already went out with no team yet, team gets arranged
  // afterward, and an admin manually sends this exactly once (see sendPapawisTeamAssignedEmail
  // in lib/papawis-notify.js and the "Notify Team" button in views/admin/papawis.js) — never
  // an automated resend, since nothing re-scans reminder_sent_at signups.
  if (!_psCols.includes('team_notified_at')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN team_notified_at INTEGER`);
  // Paid status for a completed game's charge — NULL/unset until an admin hits "Mark
  // Paid". paid_tx_id links to the exact transaction_ledger row that payment created, so
  // un-marking can void that specific transaction instead of guessing which one to reverse.
  if (!_psCols.includes('paid_at'))    db.exec(`ALTER TABLE papawis_signups ADD COLUMN paid_at INTEGER`);
  if (!_psCols.includes('paid_tx_id')) db.exec(`ALTER TABLE papawis_signups ADD COLUMN paid_tx_id TEXT NOT NULL DEFAULT ''`);
}

// Admin-facing audit trail per papawis game. game_id = '' for events not tied to any one
// game (currently only 'registered' — a new member signing up via a shared papawis link,
// since the public page lists every game rather than linking to one specific game).
db.exec(`
  CREATE TABLE IF NOT EXISTS papawis_activity_log (
    id          TEXT PRIMARY KEY,
    game_id     TEXT NOT NULL DEFAULT '',
    event_type  TEXT NOT NULL,
    player_id   TEXT NOT NULL DEFAULT '',
    player_name TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_papawis_activity_game ON papawis_activity_log(game_id)`);

const stmtInsertPapawisActivity = db.prepare(`
  INSERT INTO papawis_activity_log (id, game_id, event_type, player_id, player_name, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
export function logPapawisActivity({ gameId = '', eventType, playerId = '', playerName = '', notes = '' }) {
  const id = `pal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertPapawisActivity.run(id, gameId, eventType, playerId, playerName, notes, Date.now());
}

const stmtPapawisActivityForGame = db.prepare(`
  SELECT * FROM papawis_activity_log WHERE game_id = ? ORDER BY created_at DESC
`);
export function getPapawisActivityForGame(gameId) { return stmtPapawisActivityForGame.all(gameId); }

const stmtAllPapawisActivity = db.prepare(`
  SELECT l.*, g.title AS game_title
  FROM papawis_activity_log l
  LEFT JOIN papawis_games g ON g.id = l.game_id
  ORDER BY l.created_at DESC
  LIMIT ?
`);
export function getAllPapawisActivity(limit = 200) { return stmtAllPapawisActivity.all(limit); }

// Real signups only (guest_name = '') — a player being flaky is only meaningful for
// their own accountability, not for guests they happened to bring and un-bring.
const stmtFrequentPapawisCancellers = db.prepare(`
  SELECT s.player_id, p.name AS player_name, t.name AS team_name, COUNT(*) AS cancel_count
  FROM papawis_signups s
  JOIN players p ON p.id = s.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE s.status = 'cancelled' AND s.guest_name = ''
  GROUP BY s.player_id
  HAVING cancel_count >= 2
  ORDER BY cancel_count DESC
`);
export function getFrequentPapawisCancellers() { return stmtFrequentPapawisCancellers.all(); }

// Games a player is (or was) actually part of — confirmed or waitlisted, own signup or a
// guest they sponsored (still "their" involvement either way). Grouped by game since a
// player can have two rows for the same game (themselves + a guest); any_confirmed flags
// whether at least one of those rows is confirmed, so a guest-waitlisted-but-self-confirmed
// player still reads as "confirmed" for that game.
// all_paid: MIN across only the confirmed rows' (paid_at IS NOT NULL) — 0 if even one of
// the player's confirmed rows for that game (their own signup or a guest they sponsored)
// is still unpaid, 1 only if every one of them is, NULL if they were never confirmed at
// all (pure waitlist, paid_at is meaningless there). MAX would silently ignore an unpaid
// row sitting alongside a paid one, which is exactly the case this needs to catch.
const stmtPapawisGamesForPlayer = db.prepare(`
  SELECT g.id, g.title, g.date, g.start_time, g.end_time, g.location, g.status,
    MAX(CASE WHEN s.status = 'confirmed' THEN 1 ELSE 0 END) AS any_confirmed,
    MIN(CASE WHEN s.status = 'confirmed' THEN (s.paid_at IS NOT NULL) END) AS all_paid
  FROM papawis_signups s
  JOIN papawis_games g ON g.id = s.game_id
  WHERE s.player_id = ? AND s.status IN ('confirmed', 'waitlist')
  GROUP BY g.id
  ORDER BY g.date DESC
`);
export function getPapawisGamesForPlayer(playerId) { return stmtPapawisGamesForPlayer.all(playerId); }

// ── In-site notifications ─────────────────────────────────────────────────────
// One generic table for every feature to write into — `type` is just a label for
// display/analytics, never branched on by the notification system itself. Any feature
// (ledger, Papawis, comments, whatever comes later) calls createNotification() at its own
// existing event points; nothing here needs to know what those features are.
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    player_id  TEXT NOT NULL,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    link       TEXT NOT NULL DEFAULT '',
    read_at    INTEGER,
    created_at INTEGER NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_player ON notifications(player_id, created_at DESC)`);

const stmtInsertNotification = db.prepare(`
  INSERT INTO notifications (id, player_id, type, title, body, link, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
export function createNotification({ playerId, type, title, body = '', link = '' }) {
  const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertNotification.run(id, playerId, type, title, body, link, Date.now());
  return id;
}

const stmtNotificationsForPlayer = db.prepare(`
  SELECT * FROM notifications WHERE player_id = ? ORDER BY created_at DESC LIMIT ?
`);
export function getNotificationsForPlayer(playerId, limit = 20) {
  return stmtNotificationsForPlayer.all(playerId, limit);
}

const stmtUnreadNotificationCount = db.prepare(`
  SELECT COUNT(*) AS n FROM notifications WHERE player_id = ? AND read_at IS NULL
`);
export function getUnreadNotificationCount(playerId) {
  return stmtUnreadNotificationCount.get(playerId).n;
}

const stmtMarkNotificationsRead = db.prepare(`
  UPDATE notifications SET read_at = ? WHERE player_id = ? AND read_at IS NULL
`);
export function markNotificationsRead(playerId) {
  stmtMarkNotificationsRead.run(Date.now(), playerId);
}

const stmtPapawisGames = db.prepare(`
  SELECT g.*,
    (SELECT COUNT(*) FROM papawis_signups s WHERE s.game_id = g.id AND s.status = 'confirmed') AS confirmed_count,
    (SELECT COUNT(*) FROM papawis_signups s WHERE s.game_id = g.id AND s.status = 'waitlist')  AS waitlist_count
  FROM papawis_games g
  ORDER BY g.date DESC, g.created_at DESC
`);
const stmtPapawisGame = db.prepare(`
  SELECT g.*,
    (SELECT COUNT(*) FROM papawis_signups s WHERE s.game_id = g.id AND s.status = 'confirmed') AS confirmed_count,
    (SELECT COUNT(*) FROM papawis_signups s WHERE s.game_id = g.id AND s.status = 'waitlist')  AS waitlist_count
  FROM papawis_games g
  WHERE g.id = ?
`);
const stmtInsertPapawisGame = db.prepare(`
  INSERT INTO papawis_games (id, title, date, start_time, end_time, location, max_slots, status, notes, created_by, created_at, open_days_before)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
`);
const stmtSetPapawisGameCompleted = db.prepare(`
  UPDATE papawis_games SET status = 'completed', price_per_player = ?, completed_at = ? WHERE id = ?
`);
const stmtSetPapawisGameCancelled = db.prepare(`UPDATE papawis_games SET status = 'cancelled' WHERE id = ?`);
const stmtLockPapawisSignups   = db.prepare(`UPDATE papawis_games SET signups_locked_at = ? WHERE id = ?`);
const stmtUnlockPapawisSignups = db.prepare(`UPDATE papawis_games SET signups_locked_at = NULL WHERE id = ?`);
const stmtDeletePapawisGame = db.prepare(`DELETE FROM papawis_games WHERE id = ?`);
const stmtDeletePapawisGameSignups = db.prepare(`DELETE FROM papawis_signups WHERE game_id = ?`);

const stmtPapawisSignups = db.prepare(`
  SELECT s.*, p.name AS player_name, p.team_id, t.name AS team_name
  FROM papawis_signups s
  JOIN players p ON p.id = s.player_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE s.game_id = ? AND s.status IN ('confirmed', 'waitlist')
  ORDER BY (s.status = 'waitlist'), s.sort_order ASC, s.signed_up_at ASC
`);
// Next sort_order for appending a signup to the end of its status group (confirmed
// and waitlist are ordered independently) — used on insert, on manual confirm/waitlist
// moves, and when a cancellation auto-promotes the earliest waitlisted signup.
const stmtMaxPapawisSortOrder = db.prepare(`
  SELECT COALESCE(MAX(sort_order), -1) AS m FROM papawis_signups WHERE game_id = ? AND status = ?
`);
function nextPapawisSortOrder(gameId, status) { return stmtMaxPapawisSortOrder.get(gameId, status).m + 1; }
// guest_name = '' — a sponsor's own guest slots (guest_name != '') never block or get
// mistaken for their personal signup here.
const stmtPapawisActiveSignupForPlayer = db.prepare(`
  SELECT * FROM papawis_signups WHERE game_id = ? AND player_id = ? AND guest_name = '' AND status IN ('confirmed', 'waitlist')
`);
const stmtCountConfirmed = db.prepare(`
  SELECT COUNT(*) AS n FROM papawis_signups WHERE game_id = ? AND status = 'confirmed'
`);
const stmtEarliestWaitlisted = db.prepare(`
  SELECT * FROM papawis_signups WHERE game_id = ? AND status = 'waitlist' ORDER BY signed_up_at ASC LIMIT 1
`);
const stmtInsertPapawisSignup = db.prepare(`
  INSERT INTO papawis_signups (id, game_id, player_id, status, signed_up_at, guest_name, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const stmtCancelPapawisSignup = db.prepare(`
  UPDATE papawis_signups SET status = 'cancelled', cancelled_at = ? WHERE id = ?
`);
// Shared by cancel's auto-promote and the admin's manual confirm/waitlist move below —
// always pairs a status change with a fresh sort_order at the end of the destination
// group, so a row promoted out of the waitlist doesn't drag its old waitlist position
// into the confirmed list (which has its own independent ordering).
const stmtSetPapawisSignupStatus = db.prepare(`
  UPDATE papawis_signups SET status = ?, sort_order = ? WHERE id = ?
`);
const stmtSetPapawisSortOrder = db.prepare(`
  UPDATE papawis_signups SET sort_order = ? WHERE id = ? AND game_id = ? AND status = ?
`);
const stmtPapawisSignupById = db.prepare(`SELECT * FROM papawis_signups WHERE id = ?`);
const stmtMarkPapawisSignupPaid   = db.prepare(`UPDATE papawis_signups SET paid_at = ?, paid_tx_id = ? WHERE id = ?`);
const stmtMarkPapawisSignupUnpaid = db.prepare(`UPDATE papawis_signups SET paid_at = NULL, paid_tx_id = '' WHERE id = ?`);

// Confirmed roster for the team-builder page: real signups carry their player's
// positions + height for balancing; guest signups have no player_details row of their
// own (guest_name is just a string billed to a sponsor), so height/positions come back
// null/'[]' for them and buildBalancedTeams() treats that as "assign randomly."
const stmtPapawisConfirmedForTeams = db.prepare(`
  SELECT s.id, s.player_id, s.guest_name, s.team, p.name AS player_name,
    COALESCE((SELECT json_group_array(pp.position) FROM player_positions pp WHERE pp.player_id = p.id), '[]') AS positions,
    d.height AS height
  FROM papawis_signups s
  JOIN players p ON p.id = s.player_id
  LEFT JOIN player_details d ON d.player_id = p.id
  WHERE s.game_id = ? AND s.status = 'confirmed'
  ORDER BY s.sort_order ASC, s.signed_up_at ASC
`);
const stmtSetPapawisSignupTeam = db.prepare(`UPDATE papawis_signups SET team = ? WHERE id = ?`);

export function getPapawisGames()       { return stmtPapawisGames.all(); }
export function getPapawisGame(id)      { return stmtPapawisGame.get(id); }
export function getPapawisSignups(gameId) { return stmtPapawisSignups.all(gameId); }
export function getPapawisSignupById(id) { return stmtPapawisSignupById.get(id); }
export function markPapawisSignupPaid(id, txId = '')  { stmtMarkPapawisSignupPaid.run(Date.now(), txId, id); }
export function markPapawisSignupUnpaid(id)            { stmtMarkPapawisSignupUnpaid.run(id); }

// Confirmed payments tagged Papawis that aren't already linked to some other signup's
// paid_tx_id — candidates for the admin's "possible match, link it?" suggestion when a
// player paid through /settle-balance (or was entered directly in the ledger) instead of
// via Mark Paid. LOWER() on category because older rows were written with a lowercase
// 'papawis' before that was corrected to match the player-facing 'Papawis' dropdown value.
// Deliberately not filtered by amount — a player can slightly over/underpay, and the admin
// sees the actual amount before choosing to link, rather than the query silently deciding
// what "close enough" means.
const stmtUnlinkedPapawisPayments = db.prepare(`
  SELECT * FROM transaction_ledger
  WHERE player_id = ? AND type = 'payment' AND status = 'confirmed' AND LOWER(category) = 'papawis'
    AND id NOT IN (SELECT paid_tx_id FROM papawis_signups WHERE paid_tx_id != '')
  ORDER BY date DESC, created_at DESC
`);
export function getUnlinkedPapawisPayments(playerId) { return stmtUnlinkedPapawisPayments.all(playerId); }
export function lockPapawisSignups(id)   { stmtLockPapawisSignups.run(Date.now(), id); }
export function unlockPapawisSignups(id) { stmtUnlockPapawisSignups.run(id); }
export function getPapawisActiveSignupForPlayer(gameId, playerId) { return stmtPapawisActiveSignupForPlayer.get(gameId, playerId); }

export function createPapawisGame({ id, title, date, start_time, end_time, location, max_slots, notes, created_by, open_days_before = null }) {
  stmtInsertPapawisGame.run(id, title || '', date, start_time || '', end_time || '', location || '', max_slots || 10, notes || '', created_by || '', Date.now(), open_days_before || null);
  return getPapawisGame(id);
}

// True once a game's sign-ups should be visible/joinable to the public — either it was
// never delayed (open_days_before is null) or it's past the 8AM-Manila open instant. See
// papawisSignupOpensAtMs() in views/utils.js — the single source of truth this, the
// "Scheduled" badge, and the live countdown all key off, so they can't disagree.
export function isPapawisSignupOpen(game) {
  return isPapawisSignupOpenNow(game);
}

// Atomic: counts confirmed slots and decides confirmed-vs-waitlist in the same
// synchronous transaction as the insert, so two near-simultaneous joins can never
// land on the same slot — whichever request's handler runs first wins it.
const stmtPlayerNameById = db.prepare('SELECT name FROM players WHERE id = ?');

// Day-granularity, same as the rest of papawis' date handling (see CUTOFF_DAYS/daysUntil
// in views/papawis.js) — a game is "passed" once its calendar date (Manila) is behind
// today's, not tied to its exact start/end time. An admin can still mark it completed/
// cancelled at any point regardless; this only gates new joins that never got closed out.
export function isPapawisGamePassed(game) { return game.date < manilaTodayStr(); }

export const joinPapawisGame = db.transaction((gameId, playerId, signupId) => {
  const game = stmtPapawisGame.get(gameId);
  if (!game) return { error: 'not_found' };
  if (game.status !== 'open') return { error: 'not_open' };
  if (!isPapawisSignupOpen(game)) return { error: 'not_open' };
  if (isPapawisGamePassed(game)) return { error: 'passed' };
  const existing = stmtPapawisActiveSignupForPlayer.get(gameId, playerId);
  if (existing) return { error: 'already_listed', status: existing.status };
  const confirmedCount = stmtCountConfirmed.get(gameId).n;
  const status = confirmedCount < game.max_slots ? 'confirmed' : 'waitlist';
  stmtInsertPapawisSignup.run(signupId, gameId, playerId, status, Date.now(), '', nextPapawisSortOrder(gameId, status));
  const playerName = stmtPlayerNameById.get(playerId)?.name || '';
  logPapawisActivity({ gameId, eventType: 'joined', playerId, playerName, notes: status === 'waitlist' ? 'waitlisted' : '' });
  return { status };
});

// Atomic: marks a signup cancelled and, if it freed a confirmed slot, promotes the
// earliest waitlisted signup in the same transaction.
export const cancelPapawisSignup = db.transaction((signupId, actor = 'player') => {
  const signup = stmtPapawisSignupById.get(signupId);
  if (!signup || signup.status === 'cancelled') return { error: 'not_found' };
  const wasConfirmed = signup.status === 'confirmed';
  stmtCancelPapawisSignup.run(Date.now(), signupId);
  let promoted = null;
  if (wasConfirmed) {
    const next = stmtEarliestWaitlisted.get(signup.game_id);
    if (next) {
      stmtSetPapawisSignupStatus.run('confirmed', nextPapawisSortOrder(signup.game_id, 'confirmed'), next.id);
      promoted = next;
    }
  }
  const playerName = signup.guest_name || stmtPlayerNameById.get(signup.player_id)?.name || '';
  logPapawisActivity({
    gameId: signup.game_id, eventType: 'cancelled', playerId: signup.player_id, playerName,
    notes: actor === 'admin' ? 'removed by admin' : '',
  });
  return { ok: true, promoted };
});

// Admin override: adds an existing registered player directly, bypassing the
// balance gate and FIFO capacity logic (still records signed_up_at for ordering).
// guestName set: adds a guest slot instead — playerId is who gets billed, guestName is
// who's actually attending. A sponsor can have any number of guest slots alongside (or
// instead of) their own, so the duplicate check only applies to a player's own signup.
export function adminAddPapawisSignup({ id, gameId, playerId, status = 'confirmed', guestName = '' }) {
  if (!guestName) {
    const existing = stmtPapawisActiveSignupForPlayer.get(gameId, playerId);
    if (existing) return { error: 'already_listed' };
  }
  stmtInsertPapawisSignup.run(id, gameId, playerId, status, Date.now(), guestName || '', nextPapawisSortOrder(gameId, status));
  const playerName = guestName || stmtPlayerNameById.get(playerId)?.name || '';
  logPapawisActivity({ gameId, eventType: 'joined', playerId, playerName, notes: 'added by admin' + (status === 'waitlist' ? ', waitlisted' : '') });
  return { ok: true };
}

// Admin removal — same atomic cancel+promote path players use for their own cancellation.
export function adminRemovePapawisSignup(signupId) { return cancelPapawisSignup(signupId, 'admin'); }

// Manual move between confirmed/waitlist from the admin roster UI. Moving INTO confirmed
// is capacity-checked against max_slots (mirrors joinPapawisGame's own gate) — moving INTO
// waitlist is always allowed, there's no cap on that side. Always lands at the end of the
// destination group; reorderPapawisSignups (below) handles fine-tuning the position after.
export const setPapawisSignupStatus = db.transaction((signupId, newStatus) => {
  const signup = stmtPapawisSignupById.get(signupId);
  if (!signup || signup.status === 'cancelled') return { error: 'not_found' };
  if (signup.status === newStatus) return { ok: true };
  if (newStatus === 'confirmed') {
    const game = stmtPapawisGame.get(signup.game_id);
    const confirmedCount = stmtCountConfirmed.get(signup.game_id).n;
    if (confirmedCount >= game.max_slots) return { error: 'full' };
  }
  stmtSetPapawisSignupStatus.run(newStatus, nextPapawisSortOrder(signup.game_id, newStatus), signupId);
  const playerName = signup.guest_name || stmtPlayerNameById.get(signup.player_id)?.name || '';
  logPapawisActivity({
    gameId: signup.game_id, eventType: newStatus === 'confirmed' ? 'promoted' : 'waitlisted',
    playerId: signup.player_id, playerName, notes: 'moved by admin',
  });
  return { ok: true };
});

// Persists a drag-reordered list — ids must all belong to the same game+status group
// (the admin UI only ever drags within one of its two columns at a time).
export const reorderPapawisSignups = db.transaction((gameId, status, orderedIds) => {
  orderedIds.forEach((id, i) => stmtSetPapawisSortOrder.run(i, id, gameId, status));
  return { ok: true };
});

// Reorders within one side of the team-builder page (light or dark). sort_order is a
// single shared sequence across *all* confirmed signups for the game (same field the
// confirmed/waitlist board above reorders) — rewriting it for only this team's ids would
// leave the other team's rows with stale/colliding values, so this walks the *current*
// full confirmed order and substitutes in the new arrangement only where a row belongs to
// `team`, preserving every other row's relative position exactly where it already was.
export const reorderPapawisTeam = db.transaction((gameId, team, orderedIds) => {
  const confirmed = stmtPapawisSignups.all(gameId).filter(s => s.status === 'confirmed');
  const queue = orderedIds.slice();
  const merged = confirmed.map(s => (s.team === team && queue.length) ? queue.shift() : s.id);
  merged.forEach((id, i) => stmtSetPapawisSortOrder.run(i, id, gameId, 'confirmed'));
  return { ok: true };
});

export function completePapawisGame(gameId, pricePerPlayer) {
  stmtSetPapawisGameCompleted.run(pricePerPlayer, Date.now(), gameId);
  return getPapawisGame(gameId);
}
export function cancelPapawisGame(gameId) { stmtSetPapawisGameCancelled.run(gameId); return getPapawisGame(gameId); }
export function deletePapawisGame(gameId) {
  stmtDeletePapawisGameSignups.run(gameId);
  stmtDeletePapawisGame.run(gameId);
}

export function getPapawisConfirmedForTeams(gameId) { return stmtPapawisConfirmedForTeams.all(gameId); }
export function getPapawisConfirmedCount(gameId) { return stmtCountConfirmed.get(gameId).n; }

// ── Papawis notification support ──────────────────────────────────────────────
// Real signups due for their pre-game reminder: not yet sent, still an active status,
// game still open, and its date falls within [today, today+reminderDays]. Bounding by
// "today" too (not just the far edge) keeps a game that already happened and was never
// closed out from silently emailing people forever. guest_name='' — guests have no
// account/email of their own, so only the sponsor's own signup row gets reminded (see
// lib/papawis-notify.js for how the sponsor is told who's coming, guests included).
const stmtPapawisSignupsDueForReminder = db.prepare(`
  SELECT s.id, s.game_id, s.player_id, s.status, s.team,
    p.name AS player_name,
    (SELECT r.email FROM registrations r WHERE r.player_id = p.id ORDER BY r.created_at DESC LIMIT 1) AS player_email,
    g.title AS game_title, g.date AS game_date, g.start_time, g.end_time, g.location, g.max_slots
  FROM papawis_signups s
  JOIN papawis_games g ON g.id = s.game_id
  JOIN players p ON p.id = s.player_id
  WHERE s.reminder_sent_at IS NULL
    AND s.guest_name = ''
    AND s.status IN ('confirmed', 'waitlist')
    AND g.status = 'open'
    AND g.date >= ? AND g.date <= ?
  ORDER BY g.date ASC, (s.status = 'waitlist'), s.sort_order ASC
`);
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
export function getPapawisSignupsDueForReminder(reminderDays) {
  const today = manilaTodayStr();
  return stmtPapawisSignupsDueForReminder.all(today, addDaysToDateStr(today, reminderDays));
}
const stmtMarkPapawisReminderSent = db.prepare(`UPDATE papawis_signups SET reminder_sent_at = ? WHERE id = ?`);
export function markPapawisReminderSent(signupId) { stmtMarkPapawisReminderSent.run(Date.now(), signupId); }

// Real (non-guest) confirmed/waitlist signups for one game, with email resolved the same
// way as the reminder query — used for the immediate cancellation notice, which fires
// once on cancel rather than through the reminder scan.
const stmtPapawisSignupsWithEmail = db.prepare(`
  SELECT s.*, p.name AS player_name,
    (SELECT r.email FROM registrations r WHERE r.player_id = p.id ORDER BY r.created_at DESC LIMIT 1) AS player_email
  FROM papawis_signups s
  JOIN players p ON p.id = s.player_id
  WHERE s.game_id = ? AND s.status IN ('confirmed', 'waitlist') AND s.guest_name = ''
  ORDER BY (s.status = 'waitlist'), s.sort_order ASC, s.signed_up_at ASC
`);
export function getPapawisSignupsWithEmail(gameId) { return stmtPapawisSignupsWithEmail.all(gameId); }

const stmtPapawisSignupWithEmailById = db.prepare(`
  SELECT s.*, p.name AS player_name,
    (SELECT r.email FROM registrations r WHERE r.player_id = p.id ORDER BY r.created_at DESC LIMIT 1) AS player_email
  FROM papawis_signups s
  JOIN players p ON p.id = s.player_id
  WHERE s.id = ?
`);
export function getPapawisSignupWithEmail(id) { return stmtPapawisSignupWithEmailById.get(id); }
const stmtMarkPapawisTeamNotified = db.prepare(`UPDATE papawis_signups SET team_notified_at = ? WHERE id = ? AND team_notified_at IS NULL`);
// Guarded by "AND team_notified_at IS NULL" in the UPDATE itself (not just a pre-check in
// the caller) so this is safe even if two clicks race — only the first actually flips the
// flag, changes=0 on the second tells the caller nothing needs to be (re)sent.
export function markPapawisTeamNotified(signupId) {
  return stmtMarkPapawisTeamNotified.run(Date.now(), signupId).changes > 0;
}

// Next upcoming open game after (or on) the given date, excluding one game id — used to
// point a waitlisted or cancelled-out player at what's coming up next.
const stmtNextOpenPapawisGame = db.prepare(`
  SELECT * FROM papawis_games WHERE status = 'open' AND date >= ? AND id != ? ORDER BY date ASC LIMIT 1
`);
export function getNextOpenPapawisGame(afterDate, excludeGameId) { return stmtNextOpenPapawisGame.get(afterDate, excludeGameId || ''); }

// Single drag-drop move on the team-builder page — auto-saves on drop, same pattern as
// setPapawisSignupStatus for the confirmed/waitlist board.
export function setPapawisSignupTeam(signupId, team) {
  if (team !== 'light' && team !== 'dark') return { error: 'invalid_team' };
  const signup = stmtPapawisSignupById.get(signupId);
  if (!signup || signup.status !== 'confirmed') return { error: 'not_found' };
  stmtSetPapawisSignupTeam.run(team, signupId);
  return { ok: true };
}

// Bulk-writes a full team split in one transaction — used both for the first auto-arrange
// on page load and for the "Re-shuffle" button (which discards whatever's there and
// recomputes from scratch).
export const setPapawisTeams = db.transaction((assignments) => {
  for (const { id, team } of assignments) stmtSetPapawisSignupTeam.run(team, id);
  return { ok: true };
});

// ── Team Heads / Coaches ────────────────────────────────────────────────────────
// A team head is just an existing registered player granted one extra privilege: voting
// on (and filing) fine cases for their team, via the *player* session — see requireHead
// in server.js. Deliberately not folded into the admin-core is_admin/isElevatedPlayer
// mechanism (docs/agents/features/admin-core.md) — heads are team-scoped, not admins.
db.exec(`
  CREATE TABLE IF NOT EXISTS team_heads (
    id         TEXT PRIMARY KEY,
    team_id    TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(team_id, player_id)
  )
`);
const stmtInsertTeamHead = db.prepare(`INSERT OR IGNORE INTO team_heads (id, team_id, player_id, created_at) VALUES (?, ?, ?, ?)`);
export function addTeamHead(teamId, playerId) {
  const id = `th_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertTeamHead.run(id, teamId, playerId, Date.now());
}
const stmtDeleteTeamHead = db.prepare(`DELETE FROM team_heads WHERE id = ?`);
export function removeTeamHead(id) { stmtDeleteTeamHead.run(id); }
const stmtAllTeamHeads = db.prepare(`
  SELECT th.*, p.name AS player_name, t.name AS team_name
  FROM team_heads th
  JOIN players p ON p.id = th.player_id
  JOIN teams t ON t.id = th.team_id
  ORDER BY t.sort_order ASC, p.name ASC
`);
export function getAllTeamHeads() { return stmtAllTeamHeads.all(); }
// Team id(s) a player heads, empty array if they're not a head at all — the fast-path
// check requireHead runs on every /fines request, so this stays a single indexed lookup.
const stmtTeamIdsForHead = db.prepare(`SELECT team_id FROM team_heads WHERE player_id = ?`);
export function getHeadTeamIds(playerId) { return stmtTeamIdsForHead.all(playerId).map(r => r.team_id); }

// ── Fine categories (admin-editable conduct policy) ────────────────────────────
// Seeded once below from the league's existing conduct policy — editable afterward via
// /admin/fines/categories, never hardcoded into the report/vote flow itself.
db.exec(`
  CREATE TABLE IF NOT EXISTS fine_categories (
    id         TEXT PRIMARY KEY,
    label      TEXT NOT NULL,
    amount     REAL NOT NULL,
    examples   TEXT NOT NULL DEFAULT '',
    active     INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);
// description added after ship — the one-sentence category summary, kept separate from
// examples (see parseFineExamples below) so the admin UI can render/edit them as two
// distinct fields instead of one freeform blob.
{
  const _fcCols = db.prepare('PRAGMA table_info(fine_categories)').all().map(c => c.name);
  if (!_fcCols.includes('description')) db.exec(`ALTER TABLE fine_categories ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
}

// examples is stored as a JSON array string (one string per pill) — parsed back into a
// real array on every read so callers never see the raw JSON. Rows written before pills
// existed hold freeform prose instead of JSON; those come back as a single one-item array
// (the whole old blob as one pill) rather than silently dropped, so nothing's lost — the
// admin just re-splits it into real pills via the edit UI once.
function parseFineExamples(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
  } catch {}
  return [String(raw).trim()];
}
function normalizeFineCategory(c) {
  return c ? { ...c, examples: parseFineExamples(c.examples) } : c;
}

const stmtActiveFineCategories = db.prepare(`SELECT * FROM fine_categories WHERE active = 1 ORDER BY sort_order ASC`);
const stmtAllFineCategories    = db.prepare(`SELECT * FROM fine_categories ORDER BY sort_order ASC`);
export function getActiveFineCategories() { return stmtActiveFineCategories.all().map(normalizeFineCategory); }
export function getAllFineCategories()    { return stmtAllFineCategories.all().map(normalizeFineCategory); }
export function getFineCategory(id)       { return normalizeFineCategory(db.prepare('SELECT * FROM fine_categories WHERE id = ?').get(id)); }
const stmtInsertFineCategory = db.prepare(`
  INSERT INTO fine_categories (id, label, amount, description, examples, sort_order) VALUES (?, ?, ?, ?, ?, ?)
`);
export function createFineCategory({ label, amount, description = '', examples = [] }) {
  const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM fine_categories').get().m;
  stmtInsertFineCategory.run(id, label, amount, description, JSON.stringify(examples || []), maxOrder + 1);
  return id;
}
const stmtUpdateFineCategory = db.prepare(`UPDATE fine_categories SET label = ?, amount = ?, description = ?, examples = ? WHERE id = ?`);
export function updateFineCategory(id, { label, amount, description = '', examples = [] }) {
  stmtUpdateFineCategory.run(label, amount, description, JSON.stringify(examples || []), id);
}
const stmtSetFineCategoryActive = db.prepare(`UPDATE fine_categories SET active = ? WHERE id = ?`);
export function setFineCategoryActive(id, active) { stmtSetFineCategoryActive.run(active ? 1 : 0, id); }

// Only runs once, ever (no-ops the moment any category exists) — a category an admin
// already created or edited for real, including a manually-added $0 "not fined" reference
// entry, is never touched by this.
function seedDefaultFineCategories() {
  if (db.prepare('SELECT COUNT(*) AS n FROM fine_categories').get().n > 0) return;
  createFineCategory({
    label: 'Standard Unsportsmanlike Conduct', amount: 500,
    description: 'Unsportsmanlike conduct that disrupts game flow or shows disrespect toward referees or opponents.',
    examples: ['Taunting or mocking referees', 'Excessive arguing after a call', 'Disrespectful gestures or language', 'Verbal provocation of opponents', 'Repeated complaining after a warning'],
  });
  createFineCategory({
    label: 'Serious or Repeated Violations', amount: 1000,
    description: 'Severe, aggressive, or repeated conduct — including fighting or attempted fighting — that endangers participants or disrespects league authority.',
    examples: ['Attempting to fight or physically confront another player', 'Threats toward referees, players, or officials', 'Aggressive confrontations (getting in faces, chest bumping)', 'Continued misconduct after prior fines', 'Inciting bench players or spectators', 'Refusal to leave the court after ejection'],
  });
}
seedDefaultFineCategories();

// A dedicated catch-all category for the player-facing report flow's top-level "Something
// else" option (see reportPlayerSection in views/player.js) — every report needs a real
// category row (createFineCase looks amount/label up from it), so rather than special-case
// a fake category-less report everywhere it's charged/displayed, "something else" reports
// just point at this ordinary, admin-editable $0 reference category like any other. Seeded
// idempotently by label (unlike seedDefaultFineCategories, which only checks "does ANY
// category exist" — this needs its own check so it still seeds even after other categories
// already exist) and excluded from the player-facing category list itself (getReportableFineCategories)
// so it isn't shown twice — once as a normal tile, once as the dedicated bottom action.
const OTHER_FINE_CATEGORY_LABEL = 'Something Else / Other';
function seedOtherFineCategory() {
  if (db.prepare('SELECT 1 FROM fine_categories WHERE label = ?').get(OTHER_FINE_CATEGORY_LABEL)) return;
  createFineCategory({
    label: OTHER_FINE_CATEGORY_LABEL, amount: 0,
    description: 'Does not fit any specific category — an admin will review and re-categorize if a fine applies.',
    examples: [],
  });
}
seedOtherFineCategory();
const stmtOtherFineCategory = db.prepare('SELECT * FROM fine_categories WHERE label = ?');
export function getOtherFineCategory() { return normalizeFineCategory(stmtOtherFineCategory.get(OTHER_FINE_CATEGORY_LABEL)); }
// Active categories minus the catch-all above — what the player-facing report flow's main
// category list shows; the catch-all is only reachable via its own dedicated "Something
// else" action, not as a regular tile in this list.
export function getReportableFineCategories() {
  return getActiveFineCategories().filter(c => c.label !== OTHER_FINE_CATEGORY_LABEL);
}

// ── Fine cases & votes ──────────────────────────────────────────────────────────
// A technical foul does NOT automatically create a case — see league conduct policy.
// Cases are always filed manually by an admin or team head describing what happened;
// resolution (approve/reject) is always a deliberate admin action informed by the vote
// tally, not an automatic majority — "voting is for admin to decide," not for the vote to
// decide by itself.
db.exec(`
  CREATE TABLE IF NOT EXISTS fine_cases (
    id                TEXT PRIMARY KEY,
    player_id         TEXT NOT NULL,
    player_name       TEXT NOT NULL DEFAULT '',
    game_id           TEXT NOT NULL DEFAULT '',
    category_id       TEXT NOT NULL DEFAULT '',
    category_label    TEXT NOT NULL DEFAULT '',
    amount            REAL NOT NULL DEFAULT 0,
    description       TEXT NOT NULL DEFAULT '',
    reported_by_type  TEXT NOT NULL,
    reported_by_id    TEXT NOT NULL,
    reported_by_name  TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'open',
    resolved_by_name  TEXT NOT NULL DEFAULT '',
    resolution_note   TEXT NOT NULL DEFAULT '',
    transaction_id    TEXT NOT NULL DEFAULT '',
    created_at        INTEGER NOT NULL,
    resolved_at       INTEGER
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_fine_cases_status ON fine_cases(status, created_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_fine_cases_player ON fine_cases(player_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS fine_votes (
    id         TEXT PRIMARY KEY,
    case_id    TEXT NOT NULL,
    voter_type TEXT NOT NULL,
    voter_id   TEXT NOT NULL,
    voter_name TEXT NOT NULL DEFAULT '',
    vote       TEXT NOT NULL,
    comment    TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE(case_id, voter_type, voter_id)
  )
`);

const stmtInsertFineCase = db.prepare(`
  INSERT INTO fine_cases (id, player_id, player_name, game_id, category_id, category_label, amount, description, reported_by_type, reported_by_id, reported_by_name, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// status defaults to 'open' (head-reported cases skip straight to head-voting, as
// always) — a player-submitted report passes status: 'pending_admin' instead, so it
// sits behind the admin-escalation gate before any head ever sees it.
export function createFineCase({ playerId, gameId = '', categoryId, description, reportedByType, reportedById, reportedByName, status = 'open' }) {
  const player = getPlayerById(playerId);
  const category = getFineCategory(categoryId);
  if (!player || !category) return { error: 'invalid' };
  const id = `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtInsertFineCase.run(id, playerId, player.name, gameId, categoryId, category.label, category.amount, description, reportedByType, reportedById, reportedByName, status, Date.now());
  return { ok: true, id };
}
// Blocks a player from piling on a second report against the same target while an
// earlier one of theirs is still live (pending_admin or open) — the simplest possible
// spam guard, no separate cooldown table needed.
const stmtOpenReportExists = db.prepare(`
  SELECT 1 FROM fine_cases
  WHERE player_id = ? AND reported_by_type = 'player' AND reported_by_id = ? AND status IN ('pending_admin', 'open')
  LIMIT 1
`);
export function hasOpenPlayerReport(targetPlayerId, reporterPlayerId) {
  return !!stmtOpenReportExists.get(targetPlayerId, reporterPlayerId);
}

const stmtFineCaseById = db.prepare(`SELECT * FROM fine_cases WHERE id = ?`);
export function getFineCase(id) { return stmtFineCaseById.get(id); }
const stmtFineCasesByStatus = db.prepare(`SELECT * FROM fine_cases WHERE status = ? ORDER BY created_at DESC`);
export function getFineCasesByStatus(status) { return stmtFineCasesByStatus.all(status); }
const stmtAllFineCases = db.prepare(`SELECT * FROM fine_cases ORDER BY created_at DESC`);
export function getAllFineCases() { return stmtAllFineCases.all(); }
const stmtFineCasesForPlayer = db.prepare(`SELECT * FROM fine_cases WHERE player_id = ? ORDER BY created_at DESC`);
export function getFineCasesForPlayer(playerId) { return stmtFineCasesForPlayer.all(playerId); }

const stmtFineVotesForCase = db.prepare(`SELECT * FROM fine_votes WHERE case_id = ? ORDER BY created_at ASC`);
export function getFineVotesForCase(caseId) { return stmtFineVotesForCase.all(caseId); }
const stmtUpsertFineVote = db.prepare(`
  INSERT INTO fine_votes (id, case_id, voter_type, voter_id, voter_name, vote, comment, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(case_id, voter_type, voter_id) DO UPDATE SET vote = excluded.vote, comment = excluded.comment, created_at = excluded.created_at
`);
// Upsert, not insert-only — a voter changing their mind while the case is still open
// overwrites their previous vote rather than creating a second row (the UNIQUE constraint
// on case_id+voter_type+voter_id is what makes this an update instead of a duplicate).
export function castFineVote({ caseId, voterType, voterId, voterName, vote, comment = '' }) {
  const kase = stmtFineCaseById.get(caseId);
  if (!kase || kase.status !== 'open') return { error: 'not_open' };
  const id = `vote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtUpsertFineVote.run(id, caseId, voterType, voterId, voterName, vote, comment, Date.now());
  return { ok: true };
}

const stmtResolveFineCase = db.prepare(`
  UPDATE fine_cases SET status = ?, resolved_by_name = ?, resolution_note = ?, transaction_id = ?, resolved_at = ? WHERE id = ? AND status = 'open'
`);
// The actual charge + notification are the caller's responsibility (server.js /admin/fines
// resolve route) — this just flips the case status and records what happened, same
// separation as papawis' completePapawisGame (status flip) vs. the caller looping charges.
export function resolveFineCase(id, { approved, resolvedByName, note = '', transactionId = '' }) {
  const result = stmtResolveFineCase.run(approved ? 'approved' : 'rejected', resolvedByName, note, transactionId, Date.now(), id);
  return { ok: result.changes > 0 };
}

// ── Admin escalation votes (player-submitted reports only) ──────────────────────
// A separate table from fine_votes on purpose — admins already cast voter_type='admin'
// votes on OPEN cases via the existing head-style vote (see castFineVote/currentAdminActor
// in server.js). Reusing that same table+voter_type for escalate/dismiss votes on
// pending_admin cases would collide: the upsert key is (case_id, voter_type, voter_id), so
// the same admin's later real vote would silently overwrite their earlier escalation vote,
// and every existing reader of fine_votes (myVote lookups, tallies) assumes one vote
// vocabulary per case for its whole life. Keeping escalation votes structurally separate
// avoids all of that instead of retrofitting voter_type-awareness everywhere.
db.exec(`
  CREATE TABLE IF NOT EXISTS fine_escalation_votes (
    id         TEXT PRIMARY KEY,
    case_id    TEXT NOT NULL,
    admin_id   TEXT NOT NULL,
    admin_name TEXT NOT NULL DEFAULT '',
    vote       TEXT NOT NULL,
    comment    TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    UNIQUE(case_id, admin_id)
  )
`);

const stmtEscalationVotesForCase = db.prepare(`SELECT * FROM fine_escalation_votes WHERE case_id = ? ORDER BY created_at ASC`);
export function getEscalationVotesForCase(caseId) { return stmtEscalationVotesForCase.all(caseId); }

const stmtUpsertEscalationVote = db.prepare(`
  INSERT INTO fine_escalation_votes (id, case_id, admin_id, admin_name, vote, comment, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(case_id, admin_id) DO UPDATE SET vote = excluded.vote, comment = excluded.comment, created_at = excluded.created_at
`);
export function castEscalationVote({ caseId, adminId, adminName, vote, comment = '' }) {
  const kase = stmtFineCaseById.get(caseId);
  if (!kase || kase.status !== 'pending_admin') return { error: 'not_pending' };
  const id = `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  stmtUpsertEscalationVote.run(id, caseId, adminId, adminName, vote, comment, Date.now());
  return { ok: true };
}

// 1 (the shared PORTAL_ADMIN_USER/PASS login — always exactly one bucket, however many
// humans actually use those credentials, see currentAdminActor in server.js) + every
// individually-identified elevated player-admin still in good standing.
const stmtElevatedAdminCount = db.prepare(`SELECT COUNT(*) AS n FROM registrations WHERE is_admin = 1 AND status = 'approved'`);
export function getTotalAdminCount() { return 1 + stmtElevatedAdminCount.get().n; }

const stmtTransitionEscalation = db.prepare(`UPDATE fine_cases SET status = ? WHERE id = ? AND status = 'pending_admin'`);
// Strict majority to escalate (escalateNeeded = floor(N/2)+1); dismiss needs just enough
// votes to make that majority mathematically unreachable (dismissNeeded = N-escalateNeeded+1).
// For an even N this is deliberately asymmetric: a tied split resolves to dismiss, not
// escalate — protecting the accused by default rather than favoring escalation on a
// coin-flip. Whichever side crosses its threshold first wins and the case goes terminal;
// this isn't a guarantee the other side "can't" still happen, just that once one side
// crosses, further votes are rejected (case is no longer 'pending_admin').
export const recomputeEscalation = db.transaction((caseId) => {
  const votes = stmtEscalationVotesForCase.all(caseId);
  const escalateVotes = votes.filter(v => v.vote === 'escalate').length;
  const dismissVotes  = votes.filter(v => v.vote === 'dismiss').length;
  const total = getTotalAdminCount();
  const escalateNeeded = Math.floor(total / 2) + 1;
  const dismissNeeded  = total - escalateNeeded + 1;
  if (escalateVotes >= escalateNeeded) stmtTransitionEscalation.run('open', caseId);
  else if (dismissVotes >= dismissNeeded) stmtTransitionEscalation.run('dismissed', caseId);
});

// Super-admin escape hatch — a pending_admin case with a stalled/incomplete vote count
// would otherwise sit forever. Reuses resolved_by_name/resolution_note purely as a record
// of who forced the call and why; the case never runs through resolveFineCase (no
// approved/rejected/charge), so resolved_at stays null for a force-dismiss and this is NOT
// the same as a real resolution.
const stmtForceEscalation = db.prepare(`
  UPDATE fine_cases SET status = ?, resolved_by_name = ?, resolution_note = ? WHERE id = ? AND status = 'pending_admin'
`);
export function forceEscalationDecision(caseId, { escalate, decidedByName }) {
  const note = escalate ? `Force-escalated by ${decidedByName}` : `Force-dismissed by ${decidedByName}`;
  const result = stmtForceEscalation.run(escalate ? 'open' : 'dismissed', decidedByName, note, caseId);
  return { ok: result.changes > 0 };
}

// ── Peer ratings (roast-style player-to-player ratings) ─────────────────────────
// One row per (season, rater, ratee) — the "Rate This Player" card submits all five
// category scores together in one POST, so a single row keeps the once-a-week cooldown
// check (updated_at) unambiguous instead of drifting per category. Public feed, but
// is_anonymous rows are displayed under the rater's persistent alias (players.anon_alias)
// everywhere except to a super admin — see requireSuperAdmin in server.js.
db.exec(`
  CREATE TABLE IF NOT EXISTS peer_ratings (
    id               TEXT PRIMARY KEY,
    season           TEXT NOT NULL,
    rater_player_id  TEXT NOT NULL,
    ratee_player_id  TEXT NOT NULL,
    clutch           INTEGER NOT NULL DEFAULT 0,
    hustle           INTEGER NOT NULL DEFAULT 0,
    sportsmanship    INTEGER NOT NULL DEFAULT 0,
    ball_hog         INTEGER NOT NULL DEFAULT 0,
    flopper          INTEGER NOT NULL DEFAULT 0,
    is_anonymous     INTEGER NOT NULL DEFAULT 1,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    UNIQUE(season, rater_player_id, ratee_player_id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_peer_ratings_ratee ON peer_ratings(ratee_player_id, season)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_peer_ratings_rater ON peer_ratings(rater_player_id, season)`);

const stmtPeerRating = db.prepare(`
  SELECT * FROM peer_ratings WHERE season = ? AND rater_player_id = ? AND ratee_player_id = ?
`);
export function getPeerRating(season, raterPlayerId, rateePlayerId) {
  return stmtPeerRating.get(String(season), raterPlayerId, rateePlayerId) || null;
}

const stmtPeerRatingsForRatee = db.prepare(`
  SELECT * FROM peer_ratings WHERE season = ? AND ratee_player_id = ? ORDER BY updated_at DESC
`);
export function getPeerRatingsForRatee(season, rateePlayerId) {
  return stmtPeerRatingsForRatee.all(String(season), rateePlayerId);
}

const stmtUpsertPeerRating = db.prepare(`
  INSERT INTO peer_ratings (id, season, rater_player_id, ratee_player_id, clutch, hustle, sportsmanship, ball_hog, flopper, is_anonymous, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(season, rater_player_id, ratee_player_id) DO UPDATE SET
    clutch = excluded.clutch, hustle = excluded.hustle, sportsmanship = excluded.sportsmanship,
    ball_hog = excluded.ball_hog, flopper = excluded.flopper,
    is_anonymous = excluded.is_anonymous, updated_at = excluded.updated_at
`);
// Enforces the once-a-week cooldown here, not just in the route — a read-then-write check
// in server.js alone would leave a race between the check and the write.
export function upsertPeerRating({ season, raterPlayerId, rateePlayerId, scores, isAnonymous }) {
  if (raterPlayerId === rateePlayerId) return { error: 'self' };
  const existing = stmtPeerRating.get(String(season), raterPlayerId, rateePlayerId);
  const now = Date.now();
  if (existing && (now - existing.updated_at) < RATING_COOLDOWN_MS) {
    return { error: 'cooldown', retryAt: existing.updated_at + RATING_COOLDOWN_MS };
  }
  const id = existing?.id || `pr_${now}_${Math.random().toString(36).slice(2, 8)}`;
  stmtUpsertPeerRating.run(
    id, String(season), raterPlayerId, rateePlayerId,
    scores.clutch, scores.hustle, scores.sportsmanship, scores.ball_hog, scores.flopper,
    isAnonymous ? 1 : 0, now, now
  );
  return { ok: true, id };
}

const stmtSetPlayerAlias = db.prepare(`UPDATE players SET anon_alias = ? WHERE id = ?`);
// Lazily assigns and persists a player's masked alias the first time they need one
// (their first anonymous rating) — `pick` is the caller-supplied alias source
// (see pickPeerRatingAlias in server.js), kept out of this file since it needs
// getSetting/setSetting + the AI pool, same separation as the banner message pools.
export function getOrAssignPlayerAlias(playerId, pick) {
  const player = getPlayerById(playerId);
  if (player?.anon_alias) return player.anon_alias;
  const alias = pick();
  stmtSetPlayerAlias.run(alias, playerId);
  return alias;
}
