// The one log (/admin/logs): turns each source table (getLogSources in lib/portal-db.js) into
// the same row, so every log can be read and filtered in one place. The tables stay as they
// are, because features read them (Papawis activity, the Sent log, dedupe keys).
//
// Row: { key, at, source, area, whoType: 'admin'|'player'|'system', who, whoPlayerId, what, sub,
//        target, href, failed, status, method, path, facts: [[label, text]] }
import { displayPlayerName } from '../views/utils.js';
import { sectionForPath, ADMIN_SECTIONS } from '../views/admin/layout.js';
import { emailStatus } from '../views/admin/email-status.js';
import { ACTIVITY_LABELS } from '../views/admin/papawis.js';

const WKND = 'WKND';

// Player actions no other table records. Logged by the middleware in server.js: the event and
// (keep) a few named fields only, never the rest of the body, so votes and messages stay
// private. failOnly: the success is already in another log. anon: logged for visitors who
// aren't signed in too (anything else they post is just bounced to the login page).
export const PLAYER_AUDIT_ROUTES = [
  [/^\/settle-balance$/, 'settle_balance'],
  [/^\/register$/, 'registered', { keep: ['email'], anon: true }],
  [/^\/season-signup$/, 'season_signup'],
  [/^\/papawis\/[^/]+\/join$/, 'papawis_join', { failOnly: true }],
  [/^\/papawis\/[^/]+\/cancel$/, 'papawis_cancel', { failOnly: true }],
  [/^\/papawis\/[^/]+\/give-back$/, 'papawis_give_back'],
  [/^\/papawis\/[^/]+\/voucher$/, 'papawis_voucher'],
  [/^\/fines$/, 'fine_reported'],
  [/^\/fines\/[^/]+\/vote$/, 'fine_voted'],
  [/^\/players\/[^/]+\/report$/, 'player_reported'],
  [/^\/polls\/[^/]+\/vote$/, 'poll_voted'],
  [/^\/api\/mvp\/ballot$/, 'mvp_ballot'],
  [/^\/marketplace\/[^/]+\/commit$/, 'marketplace_commit'],
  [/^\/marketplace\/[^/]+\/cancel-commitment$/, 'marketplace_cancel'],
  [/^\/jersey-request$/, 'jersey_request'],
  [/^\/my-team\/number$/, 'jersey_number'],
  [/^\/me\/photo$/, 'photo_changed'],
  [/^\/me\/writeup$/, 'intro_changed'],
  [/^\/app\/me\/cover(\/remove)?$/, 'cover_changed'],
  [/^\/auth\/facebook\/disconnect$/, 'facebook_disconnected'],
  [/^\/games\/[^/]+\/comments\/[^/]+$/, 'comment_deleted'],
  [/^\/marketplace\/[^/]+\/comments\/[^/]+$/, 'comment_deleted'],
  [/^\/app\/thread\/[^/]+\/comments\/[^/]+\/delete$/, 'comment_deleted'],
  [/^\/app\/barkadahan\/messages\/[^/]+\/delete$/, 'chat_deleted'],
  [/^\/app\/barkadahan\/messages\/[^/]+\/report$/, 'chat_reported'],
  [/^\/api\/score\/[^/]+\/finish$/, 'score_finished'],
  [/^\/app\/papawis\/[^/]+\/finish$/, 'score_finished'],
  [/^\/app\/games\/[^/]+\/review$/, 'score_reviewed'],
];

export function playerAuditRoute(method, path) {
  if (method === 'GET') return null;
  for (const [re, event, opts] of PLAYER_AUDIT_ROUTES) {
    if (!re.test(path)) continue;
    // The comment routes share their path with nothing else that deletes; only DELETE counts.
    if (event === 'comment_deleted' && !path.endsWith('/delete') && method !== 'DELETE') return null;
    return { event, ...(opts || {}) };
  }
  return null;
}

const EVENT_LABELS = {
  login: 'Signed in', login_failed: 'Failed sign-in', logout: 'Signed out',
  email_opened: 'Opened their password link', password_set: 'Set their password', password_reset: 'Reset their password',
  self_service_reset_requested: 'Asked for a password reset', app_code_sent: 'Asked for a sign-in code', profile_edit: 'Edited their profile',
  impersonate_stop: 'Stopped viewing as a player',
  auto_ban: 'Banned automatically (unpaid balance)', auto_ban_lifted: 'Ban lifted automatically (balance settled)',
  backup_done: 'Daily database backup', error: 'Server error',
  // These two routes redirect whether or not it worked, hence "submitted".
  settle_balance: 'Sent a balance payment', registered: 'Submitted the registration form', season_signup: 'Submitted the season form',
  papawis_join: 'Tried to join a run', papawis_cancel: 'Tried to cancel a slot', papawis_give_back: 'Gave a slot back', papawis_voucher: 'Used a voucher',
  fine_reported: 'Reported a fine', fine_voted: 'Voted on a fine', player_reported: 'Reported a player', poll_voted: 'Voted in a poll', mvp_ballot: 'Saved their podium ballot',
  marketplace_commit: 'Joined a group buy', marketplace_cancel: 'Left a group buy', jersey_request: 'Requested a jersey', jersey_number: 'Changed their jersey number',
  photo_changed: 'Changed their photo', intro_changed: 'Edited their intro', cover_changed: 'Changed their cover', facebook_disconnected: 'Disconnected Facebook',
  comment_deleted: 'Deleted a comment', chat_deleted: 'Deleted a chat message', chat_reported: 'Reported a chat message',
  score_finished: 'Finished scoring a game', score_reviewed: 'Reviewed a scored game',
};

// Admin requests, most specific first. Anything not here still reads fine through plainPath().
const ADMIN_LABELS = [
  [/\/admin\/ledger\/transaction\/[^/]+\/confirm$/, 'Confirmed a payment'],
  [/\/admin\/ledger\/transaction\/[^/]+\/void$/, 'Voided a transaction'],
  [/^DELETE \/admin\/ledger\/transaction\//, 'Deleted a transaction'],
  [/\/admin\/ledger\/transaction$/, 'Recorded a transaction'],
  [/\/admin\/ledger\/bulk-charge$/, 'Charged players in bulk'],
  [/\/admin\/papawis\/[^/]+\/teams\/reorder$/, 'Reordered teams'],
  [/\/admin\/papawis\/[^/]+\/teams\/assign$/, 'Assigned teams'],
  [/\/admin\/papawis\/[^/]+\/add$/, 'Added a player to a run'],
  [/\/admin\/papawis\/[^/]+\/remove\/[^/]+$/, 'Removed a player from a run'],
  [/\/signups\/[^/]+\/paid$/, 'Changed a slot’s paid status'],
  [/\/signups\/[^/]+\/notify-team$/, 'Told a player their team'],
  [/\/signups\/[^/]+\/link-payment$/, 'Linked a payment to a slot'],
  [/\/signups\/[^/]+\/status$/, 'Changed a slot’s status'],
  [/\/admin\/papawis\/[^/]+\/estimate$/, 'Set a run’s estimate'],
  [/\/admin\/papawis\/[^/]+\/complete$/, 'Set a run’s final price'],
  [/\/admin\/papawis\/[^/]+\/location$/, 'Changed a run’s court'],
  [/^POST \/admin\/papawis$/, 'Created a run'],
  [/\/admin\/games\/[^/]+\/save$/, 'Saved a game'],
  [/\/admin\/games\/[^/]+\/final$/, 'Marked a game final'],
  [/\/admin\/games\/[^/]+\/import$/, 'Imported a box score'],
  [/\/admin\/games\/[^/]+\/generate-potg$/, 'Generated a POTG write-up'],
  [/\/admin\/games\/[^/]+\/generate-recap$/, 'Generated a recap'],
  [/\/admin\/games\/[^/]+\/cover$/, 'Changed a game’s cover'],
  [/\/admin\/games\/[^/]+\/scoring\/publish$/, 'Published a scored game'],
  [/^POST \/admin\/games$/, 'Created a game'],
  [/\/admin\/site\/settings$/, 'Changed site settings'],
  [/\/admin\/impersonate\/[^/]+$/, 'Started viewing as a player'],
  [/\/admin\/users\/[^/]+\/approve$/, 'Approved an account'],
  [/\/admin\/users\/[^/]+\/reject$/, 'Rejected an account'],
  [/\/admin\/home\/nudge$/, 'Nudged quiet players'],
  [/\/admin\/reach\/send$/, 'Messaged players'],
  [/\/export-charges$/, 'Exported the charges'],
  [/\/export-jerseys$/, 'Exported the jerseys'],
];

const isIdSegment = s => /^[0-9a-f-]{8,}$/i.test(s) || /\d/.test(s) || /_/.test(s);

// '/admin/papawis/abc123/signups/x9/foo-bar' → 'Papawis: signups foo bar'
function plainPath(path) {
  const words = String(path).split('/').filter(s => s && s !== 'admin' && s !== 'system' && !isIdSegment(s)).map(s => s.replace(/-/g, ' '));
  if (!words.length) return 'Admin action';
  const [first, ...rest] = words;
  const head = first[0].toUpperCase() + first.slice(1);
  return rest.length ? `${head}: ${rest.join(' ')}` : head;
}

export function describeAdminRequest(method, path, event) {
  if (event && EVENT_LABELS[event]) return EVENT_LABELS[event];
  const key = `${method} ${path}`;
  for (const [re, label] of ADMIN_LABELS) if (re.test(key)) return label;
  return plainPath(path);
}

const ADMIN_LABEL_BY_KEY = Object.fromEntries(ADMIN_SECTIONS.map(s => [s.key, s.label]));

// Which part of the admin a request belongs to: the menu's own groups, plus the few areas
// that have no group.
export function areaForPath(path) {
  const p = String(path || '');
  if (p.startsWith('/system')) return 'System';
  if (/^\/(login|logout|set-password|forgot-password|register)\b|^\/app\/(login|setup|passkeys)\b|^\/auth\//.test(p)) return 'Account';
  if (/^\/admin\/(impersonate|stop-impersonating)\b/.test(p)) return 'Members';
  if (p.startsWith('/admin/barkadahan') || p.startsWith('/app/barkadahan')) return 'Barkadahan';
  if (p.startsWith('/admin/birthdays')) return 'Birthdays';
  if (p.startsWith('/admin/privileges')) return 'Members';
  if (p.startsWith('/admin')) return ADMIN_LABEL_BY_KEY[sectionForPath(p)?.key] || 'Overview';
  if (/^\/papawis\b|^\/app\/papawis\b/.test(p)) return 'Papawis';
  if (/^\/(settle-balance)\b/.test(p)) return 'Finance';
  if (/^\/season-signup\b|^\/jersey-request\b|^\/my-team\b/.test(p)) return 'Season';
  if (/^\/(fines|players|polls|games\/[^/]+\/comments)\b|^\/app\/thread\b/.test(p)) return 'Community';
  if (p.startsWith('/marketplace')) return 'Marketplace';
  if (p.startsWith('/api/mvp')) return 'Awards';
  if (/^\/api\/score\b|^\/app\/games\b/.test(p)) return 'Game Day';
  if (/^\/me\b|^\/app\/me\b/.test(p)) return 'Members';
  return 'Other';
}

const hiddenFact = new Set(['event', 'ids', 'via']);
function factText(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

function parseDetails(raw) {
  try { const d = JSON.parse(raw || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}

// Who or what a request acted on: a player or account named by the path or the form; else
// the run or game whose page it came from.
function targetOf(path, d, ctx) {
  const ids = [...String(path).split('/'), d.player_id, d.playerId, d.playerid].filter(Boolean).map(String);
  for (const id of ids) {
    const p = ctx.players[id];
    if (p) return { name: displayPlayerName(p.name), href: `/admin/players/${id}`, playerId: id };
    const r = ctx.regs[id];
    if (r) return { name: displayPlayerName(r.full_name) || r.email, href: `/admin/users/${id}`, playerId: r.player_id || '' };
  }
  const run = /^\/admin\/papawis\/([^/]+)/.exec(path);
  if (run && ctx.runs[run[1]]) return { name: ctx.runs[run[1]].title || 'Papawis run', href: `/admin/papawis/${run[1]}` };
  const game = /^\/admin\/games\/([^/]+)/.exec(path);
  if (game && ctx.games[game[1]]) return { name: ctx.games[game[1]], href: `/admin/games/${game[1]}` };
  return null;
}

function fromAdminLog(l, ctx) {
  const d = parseDetails(l.details);
  const event = d.event || '';
  const whoType = l.actor_type === 'player' ? 'player' : l.actor_type === 'system' ? 'system' : 'admin';
  const who = l.actor_type === 'super' ? 'Super admin' : whoType === 'system' ? WKND : displayPlayerName(l.actor) || 'Admin';
  const target = targetOf(l.path, d, ctx);
  const failed = l.status >= 400 || event === 'login_failed' || event === 'error';
  const sub = event === 'error' || event === 'login_failed' ? d.message || d.email || ''
    : event === 'login' && d.via ? `App, ${d.via}`
    : d.amount ? `₱${Number(d.amount).toLocaleString()}${d.category ? ` · ${d.category}` : ''}` : '';
  return {
    key: `a${l.id}`, at: l.created_at, source: 'admin', area: areaForPath(l.path), whoType, who, whoPlayerId: '',
    what: describeAdminRequest(l.method, l.path, event), sub: String(sub),
    target: target?.name || '', href: target?.href || '', targetPlayerId: target?.playerId || '',
    failed, status: l.status || 0, method: l.method, path: l.path,
    facts: Object.entries(d).filter(([k, v]) => !hiddenFact.has(k) && factText(v)).map(([k, v]) => [k.replace(/_/g, ' '), factText(v)]),
  };
}

const PAPAWIS_SENT = new Set(['reminded', 'cancel_notified', 'completion_notified', 'announced', 'slot_alerted', 'team_notified', 'updated_notified']);
function fromPapawis(e) {
  const name = displayPlayerName(e.player_name) || 'Someone';
  const label = (ACTIVITY_LABELS[e.event_type] || { label: e.event_type.replace(/_/g, ' ') }).label;
  const sent = PAPAWIS_SENT.has(e.event_type);
  return {
    key: `p${e.id}`, at: e.created_at, source: 'papawis', area: 'Papawis', whoType: sent ? 'system' : 'player',
    who: sent ? WKND : name, whoPlayerId: sent ? '' : e.player_id,
    what: label[0].toUpperCase() + label.slice(1), sub: e.notes || '',
    target: sent ? name : (e.game_title || ''), targetPlayerId: sent ? e.player_id : '', href: e.game_id ? `/admin/papawis/${e.game_id}?tab=activity` : '',
    failed: false, status: 0, method: '', path: '', facts: e.game_title ? [['run', e.game_title]] : [],
  };
}

const APP_LABELS = {
  installed: 'Installed the app', setup_done: 'Finished app setup', setup_season_seen: 'Saw the season step in setup', push_on: 'Turned on app notifications', push_off: 'Turned off app notifications',
  passkey_added: 'Added Face ID sign-in', passkey_removed: 'Removed Face ID sign-in', signout: 'Signed out of the app', comment: 'Commented in the app', share_open: 'Opened Share my stats', img_failed: 'A photo upload failed',
};
// In admin_logs too, or only a page count.
const APP_SKIP = new Set(['open', 'signin', 'code_sent', 'setup_details']);
function fromAppEvent(e) {
  return {
    key: `e${e.id}`, at: e.created_at, source: 'app', area: 'App', whoType: 'player',
    who: displayPlayerName(e.full_name) || e.email || 'Player', whoPlayerId: e.player_id || '',
    what: APP_LABELS[e.type] || e.type.replace(/_/g, ' '), sub: [e.detail, e.platform].filter(Boolean).join(' · '),
    target: '', href: e.reg_id ? `/admin/users/${e.reg_id}` : '', failed: e.type === 'img_failed', status: 0, method: '', path: '', facts: [],
  };
}

function fromEmail(e, ctx) {
  const st = emailStatus(e);
  const reg = ctx.regsByEmail[String(e.to_email).toLowerCase()];
  return {
    key: `m${e.id}`, at: e.sent_at, source: 'email', area: 'Email', whoType: 'system', who: WKND, whoPlayerId: '',
    what: `Emailed “${e.subject || e.kind || 'a message'}”`, sub: st?.label || '',
    target: reg ? displayPlayerName(reg.full_name) || e.to_email : e.to_email, targetPlayerId: reg?.player_id || '', href: reg ? `/admin/users/${reg.id}?tab=emails` : '',
    failed: ['failed', 'bounced', 'complained'].includes(st?.key), status: 0, method: '', path: '',
    facts: [['to', e.to_email], ['kind', e.kind], e.error ? ['error', e.error] : null, e.bounce_reason ? ['bounce', e.bounce_reason] : null, e.open_count ? ['opens', String(e.open_count)] : null].filter(x => x && x[1]),
  };
}

function fromShareCard(s) {
  const name = displayPlayerName(s.player_name) || 'Player';
  const verb = { save: 'Saved', copy: 'Copied', share: 'Shared' }[s.action] || s.action;
  return {
    key: `s${s.id}`, at: s.created_at, source: 'share', area: 'Share cards', whoType: 'player', who: name, whoPlayerId: s.player_id || '',
    what: `${verb} a stats card`, sub: s.template || '', target: '', href: '/admin/share-log', failed: false, status: 0, method: '', path: '', facts: [],
  };
}

function fromBirthday(b) {
  const label = String(b.event).replace(/_/g, ' ');
  return {
    key: `b${b.id}`, at: b.created_at, source: 'birthday', area: 'Birthdays', whoType: b.actor === 'auto' ? 'system' : 'admin', who: b.actor === 'auto' ? WKND : 'Super admin', whoPlayerId: '',
    what: `Birthday email: ${label}`, sub: b.detail || '', target: displayPlayerName(b.player_name), targetPlayerId: b.player_id, href: '/admin/birthdays',
    failed: /fail|error/i.test(b.event), status: 0, method: '', path: '', facts: [],
  };
}

function fromBroadcast(b) {
  const auto = !b.created_by || b.created_by === 'auto';
  return {
    key: `r${b.id}`, at: b.created_at, source: 'broadcast', area: 'Reach', whoType: auto ? 'system' : 'admin', who: auto ? WKND : (b.created_by === 'admin' || b.created_by === 'super' ? 'Super admin' : displayPlayerName(b.created_by)), whoPlayerId: '',
    what: `Sent “${b.title || b.kind}”`, sub: `${b.bell_count} bells, ${b.email_count} emails`, target: b.segment || '', href: '/admin/reach/sent', failed: false, status: 0, method: '', path: '', facts: [['kind', b.kind]],
  };
}

// sources: getLogSources(). ctx: { players, regs, regsByEmail, runs, games } lookups by id.
export function buildLogRows(sources, ctx) {
  const rows = [
    ...sources.admin.map(l => fromAdminLog(l, ctx)),
    ...sources.papawis.map(fromPapawis),
    ...sources.app.filter(e => !APP_SKIP.has(e.type)).map(fromAppEvent),
    ...sources.email.map(e => fromEmail(e, ctx)),
    ...sources.share.map(fromShareCard),
    ...sources.birthday.map(fromBirthday),
    ...sources.broadcast.map(fromBroadcast),
  ];
  return rows.sort((a, b) => b.at - a.at);
}

// Every console.error (about 170 places: failed jobs, mail, AI, push…) also lands in the log,
// because stdout is gone by the time anyone asks. The same message at most every 5 minutes.
export function captureConsoleErrors(insert) {
  const original = console.error;
  const seen = new Map();
  console.error = (...args) => {
    original(...args);
    try {
      const text = args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      const sig = text.slice(0, 120), now = Date.now();
      if (now - (seen.get(sig) || 0) < 5 * 60 * 1000) return;
      if (seen.size > 500) seen.clear();
      seen.set(sig, now);
      const tag = /^\[([^\]]+)\]/.exec(text)?.[1] || 'server';
      insert({ actor: 'System', actorType: 'system', method: 'ERROR', path: `/system/${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, details: { event: 'error', message: text } });
    } catch { /* logging must never break the thing that was logging */ }
  };
}
