// The scorer screen (views/app/score.js renders the shell; server.js /api/score/:id/events takes
// the plays). Layout B (Paolo, 2026-10-26; mockup claude.ai/artifact/LYTiRSStLRyxntwjmQqm1A):
// scoreboard, both teams (five tiles + the whole bench), the last play with Undo and Fix, the
// stat buttons, and one Scoresheet (Box score · Play-by-play · Fouls). Tablet landscape docks
// the Scoresheet on the right.
//
// Every tap becomes a play (public/score-engine.js) that is saved on this phone first
// (IndexedDB) and then sent in batches; a play sent twice is kept once by the server, so a
// flaky connection never loses or doubles a stat. With no signal the screen keeps working and
// says how many plays are waiting. Undo adds a "void" play; nothing is ever deleted.
//
// Both orders work (scorers come from wknd-stats, which is stat first): tap a player then the
// stat, or a stat (it lights up) then the player. Buttons with a corner mark: tap = the usual,
// hold = the other kinds (TO, FOUL, REB: offensive or defensive). Hold the score for the score by quarter, hold a player for
// their line. After some plays a question takes the stat buttons' place (assisted?, who lost
// it?, the foul panel with its free throws, who went off?); tapping the next player or stat
// skips it, except free throws.
//
// Subs: tap a bench player, then the court player coming off; several at once from the Sub
// button (the Subs sheet). A stat by a bench player brings them on and asks who went off. Foul trouble follows
// the quarter: fouls = the quarter is "watch", more (or one from out) is "danger".
//
// Corrections: Fix on any play (change who, change what, add a missed play after, remove), in
// the last play row and in Play-by-play. DNP (team menu): a late or absent player.
//
// Two scorers (phase 3, live pass): each phone holds a side, White, Blue or Both
// (lib/score-lanes.js on the server). It checks in every few seconds; the other side folds to one
// line, the other phone's plays come in (one shared log, so a rebound after their miss is still
// offensive), a late scorer asks for a side and the holder gets Hand over / Keep it, a phone gone
// quiet can be taken over. One phone keeps the clock (Both, else the first team); the other shows
// it. Plays never wait on any of this: with no signal both phones keep scoring.
//
// Papawis (2026-10-30, bundle.papawis; mockup claude.ai/artifact/QyYMf51jSBCFrSK3ddi1ss): the same
// screen, Light vs Dark, one session for the whole run with its games numbered inside it (every
// play carries `game`). Each game opens on a setup screen (Basic or Full stats, quarter length,
// quarters, who's here, sides) that becomes the game's `setup` play. Basic = makes only (FT,
// 2PT, 3PT) plus REB and AST, no follow-ups. No timeouts or penalty. Hold a player → Move to
// Light/Dark. Game over → Start the next game (set up from this one) or Finish the run.
import { foldGame, defaultFreeThrows, nextPos, isOvertime, correction, periodIndex, periodName, livePlays, setupOf, papawisRules, papawisSides } from './score-engine.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
const HOLD_MS = 450;
const SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ARROW_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
const ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
const SHEET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>';
const LIVE_BALL = new Set(['shot', 'reb', 'stl', 'blk']);
// Plays that stop the clock (on either scorer's phone).
const WHISTLES = new Set(['foul', 'timeout', 'team_tech', 'team_to', 'stoppage']);
// Follow-ups (Paolo, 2026-10-26): the optional questions after a play (Assisted?, Who lost it?,
// Whose shot?, Who went off?, And-one: who fouled?, Rebound?). One amber line above the stat
// buttons (which stay usable: the next tap skips); the players who can answer light up on the
// court and a tap there answers (a dimmed tile skips and picks that player). They close with
// the skip button, a tap on empty space, or by themselves after FOLLOW_MS. The foul panel (free throws owed) is not a follow-up: it stays until answered.
const OPTIONAL = new Set(['ast', 'lost', 'blocked', 'wentoff', 'andone', 'foulout', 'rebound']);
// Menus (team stats, foul kind, Fix…) close the same ways, minus the timer: the scorer opened them.
const CLOSABLE = new Set([...OPTIONAL, 'menu']);
const FOLLOW_MS = 12000;
// Rebound? is the most frequent question and the moment passes fastest (Fable review, 2026-10-27).
const followMs = a => (a.kind === 'rebound' ? 8000 : FOLLOW_MS);
// The follow-ups the Follow-up questions switch (game menu, per phone) turns off. Not Who comes on?
// (a foul-out needs a sub), the and-one's Who fouled? (the scorer asked for it), nor free throws.
const SKIPPABLE = new Set(['rebound', 'ast', 'lost', 'blocked', 'wentoff']);
// Reduced motion: no countdown at all; a follow-up stays until answered, skipped or the next play.
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Someone asks for this phone's side: the alert counts down this long, then it's a no.
const ASK_MS = 20000;
const EXIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>';
// Chimes (Paolo, 2026-10-26): made on the phone (Web Audio, no file, works offline). ask: two
// notes up; left: two notes down; yes/no: one soft note for the phone that asked. Android also
// vibrates; iPhones can't from a web app, and their silent switch mutes the chime.
const chime = (() => {
  let ctx = null;
  const unlock = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; } };
  if (typeof window !== 'undefined') window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  const NOTES = { ask: [[659, 0], [880, 0.16]], left: [[880, 0], [587, 0.18]], yes: [[784, 0]], no: [[440, 0]] };
  return kind => {
    try { if (localStorage.getItem('wknd-sc-sound') === 'off') return; } catch (e) {}
    if (navigator.vibrate && (kind === 'ask' || kind === 'left')) { try { navigator.vibrate([120, 80, 120]); } catch (e) {} }
    if (!ctx) return;
    const loud = kind === 'ask' || kind === 'left' ? 0.28 : 0.14;
    for (const [f, at] of NOTES[kind] || []) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(loud, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
    }
  };
})();
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// ── Storage on the phone: one record per game { id, events, sent: [ids], secs } ──
const store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    if (!window.indexedDB) return no(new Error('no indexedDB'));
    const r = indexedDB.open('wknd-scorer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('games', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
    r.onblocked = () => no(new Error('storage blocked'));
  }));
  // The phone's storage can, rarely, never answer (seen on iPhones): give it 3 s, then go on
  // without the phone's copy (the server's plays still load, and saving retries next time).
  const within = (pr, fallback) => Promise.race([pr, new Promise(ok => setTimeout(() => { dbp = null; ok(fallback); }, 3000))]);
  return {
    get: id => within(open().then(db => new Promise((ok, no) => { const q = db.transaction('games').objectStore('games').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => no(q.error); })).catch(() => null), null),
    put: rec => within(open().then(db => new Promise((ok, no) => { const tx = db.transaction('games', 'readwrite'); tx.objectStore('games').put(rec); tx.oncomplete = () => ok(true); tx.onerror = () => no(tx.error); })).catch(() => false), false),
  };
})();
const deviceId = (() => { try { let d = localStorage.getItem('wknd-device'); if (!d) { d = uid(); localStorage.setItem('wknd-device', d); } return d; } catch (e) { return 'unknown'; } })();
const pref = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

export async function mount(el) {
  if (el._sc) return;
  el._sc = true;
  const B = JSON.parse(el.querySelector('[data-sc-bundle]').textContent);
  const root = el.querySelector('[data-sc-root]');
  const pill = el.querySelector('[data-sc-sync]');
  const api = el.getAttribute('data-api');
  const gid = B.game.id;
  let rules = B.rules;
  const team = { a: B.a, b: B.b };
  // Papawis: everyone in the run, and the side each signed up on (a Light, b Dark).
  const pw = B.papawis || null;
  const everyone = [...B.a.players, ...B.b.players, ...((B.papawis && B.papawis.extra) || [])];
  const homeSides = Object.fromEntries([...B.a.players.map(p => [p.id, 'a']), ...B.b.players.map(p => [p.id, 'b'])]);
  // A guest added at the court (a setup play's guests) joins everyone, on the side picked.
  const guestPerson = (id, name) => { const n = String(name || '').trim().slice(0, 40) || 'Guest'; return { id, name: n, short: (n.split(/s+/)[0] || n).toUpperCase(), number: '', guest: true }; };
  const learn = e => {
    if (!e || e.type !== 'setup') return;
    for (const g of Array.isArray(e.guests) ? e.guests : []) {
      if (!g || !g.id || everyone.some(p => p.id === g.id)) continue;
      const p = guestPerson(g.id, g.name); everyone.push(p); homeSides[g.id] = g.side === 'b' ? 'b' : 'a';
    }
    for (const id of [...((e.sides || {}).a || []), ...((e.sides || {}).b || [])]) if (!homeSides[id]) homeSides[id] = ((e.sides || {}).a || []).includes(id) ? 'a' : 'b';
  };
  // Team colours that vanish on one of the themes (White on light, Black on dark) use the
  // app's theme-aware team tokens.
  for (const t of ['a', 'b']) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(team[t].color || '').trim());
    if (!m) continue;
    const n = parseInt(m[1], 16), lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    if (lum > 0.75) team[t] = { ...team[t], color: `var(--team-white, ${team[t].color})` };
    else if (lum < 0.12) team[t] = { ...team[t], color: `var(--team-black, ${team[t].color})` };
  }
  const byId = {};
  for (const t of ['a', 'b']) for (const p of team[t].players) byId[p.id] = { ...p, team: t };
  // Numbers two players share (the name does the work on their tiles)
  const shared = new Set();
  for (const t of ['a', 'b']) { const seen = {}; for (const p of team[t].players) if (p.number) { if (seen[p.number]) { shared.add(seen[p.number]); shared.add(p.id); } else seen[p.number] = p.id; } }
  // A finished Papawis run can still be fixed (Finish the run's Edit) and saved again.
  const published = !pw && B.status === 'published';
  const video = B.pass === 'video';
  // A practice game (the app's Scoring → Practice game, 2026-10-27): the same screen and rules on
  // real rosters, but nothing leaves the phone. No sending, no fetching, no sides; the server only
  // hears how far it got (practice_log, for the admin Scorers page). One practice is kept.
  const practice = B.practice || null;
  const key = practice ? 'practice' : video ? `${gid}:video` : gid;
  // Tablet landscape and laptops: the Scoresheet docks on the right.
  const wide = window.matchMedia ? matchMedia('(min-width: 900px)') : { matches: false };
  const multi = !video && !published && !practice && !pw;
  const laneKey = `wknd-lane:${gid}`;
  const readLane = () => { try { const v = localStorage.getItem(laneKey); return ['a', 'b', 'both'].includes(v) ? v : null; } catch (e) { return null; } };
  const storeLane = l => { try { if (l) localStorage.setItem(laneKey, l); else localStorage.removeItem(laneKey); } catch (e) {} };
  // 4PT only at a court with a 4-point line (admin: the court's features); a game with no
  // court set keeps it, so nothing is ever missing.
  const shots = B.fourPoint === false ? [1, 2, 3] : [1, 2, 3, 4];

  // Plays: the server's, plus any this phone made that the server doesn't have yet.
  let rec = (await store.get(key)) || { id: key, events: [], sent: [], secs: rules.periodMin * 60 };
  // A new practice (not the one being carried on) starts empty.
  if (practice && rec.practiceId !== practice.id) rec = { id: key, events: [], sent: [], secs: rules.periodMin * 60 };
  const events = new Map();
  for (const e of B.events) events.set(e.id, e);
  const serverIds = new Set(B.events.map(e => e.id));
  for (const e of rec.events) if (!events.has(e.id)) events.set(e.id, e);
  const sent = new Set([...rec.sent, ...serverIds]);
  // The clock as it was left: a running clock kept running while the scorer was away.
  const away = rec.running && rec.savedAt ? Math.round((Date.now() - rec.savedAt) / 1000) : 0;
  const ui = {
    sel: null, arm: null, ask: null, tip: '', flash: null, flashN: 0, running: !!rec.running && (rec.secs ?? 0) - away > 0, secs: Math.max(0, (rec.secs ?? rules.periodMin * 60) - away),
    sync: 'idle', syncMsg: '', locked: published, after: null, lane: multi ? readLane() : 'both', lanes: null, asked: '',
    sheet: false, tab: pref.get('wknd-sc-tab', 'box'), dockTab: pref.get('wknd-sc-dock', 'fouls'), hideDock: false, sheetTeam: 'a', filter: 'all',
    peek: null, redo: null, lastShown: '',
    // Follow-ups waiting their turn (a bench player's basket: Who went off? first, then Assisted?).
    queue: [],
  };

  const list = () => [...events.values()];
  // Papawis: which game a play belongs to (a void goes with the play it cancels), the game on
  // screen, and that game's setup play.
  const gameOf = (e, d = 0) => (e.game != null ? Number(e.game) || 1 : e.type === 'void' && events.has(e.target) && d < 5 ? gameOf(events.get(e.target), d + 1) : 1);
  const games = () => [...new Set(list().map(e => gameOf(e)))].sort((x, y) => x - y);
  const setupFor = n => setupOf(list().filter(e => !e.late && gameOf(e) === n));
  // Each game keeps its own clock (Fable audit 2026-10-30: looking at Game 1 reset Game 2's).
  ui.clocks = (pw && rec.clocks) || {};
  if (pw) for (const e of list()) learn(e);
  {
    const asked = Number(new URLSearchParams(location.search).get('game')) || 0;
    const set = games().filter(n => setupFor(n));
    ui.game = pw ? (asked >= 1 ? asked : set.length ? set[set.length - 1] : 1) : 1;
    const c = pw && ui.clocks[ui.game];
    if (c) { const left = c.running ? Math.max(0, c.secs - Math.floor((Date.now() - c.at) / 1000)) : c.secs; ui.secs = left; ui.running = !!c.running && left > 0; }
  }
  // Every new play joins the game on screen; a setup's guests join everyone.
  if (pw) {
    const put = events.set.bind(events);
    events.set = (k, e) => { if (e && e.game == null) e.game = e.type === 'void' && events.has(e.target) ? gameOf(events.get(e.target)) : ui.game; learn(e); return put(k, e); };
  }
  // Plays the server set aside as late (POST answer) stay on the phone but out of its game.
  const counted = () => list().filter(e => !e.late && (!pw || gameOf(e) === ui.game));
  // Papawis Basic stats: makes only, REB and AST, no follow-ups.
  const basic = () => !!pw && (setupFor(ui.game) || {}).stats !== 'full';
  const unsent = () => list().filter(e => !sent.has(e.id));
  // Everything is on the phone after every change: the plays, what's been sent, and the clock
  // (running or not, as of when), so leaving the scorer with no signal and coming back finds it
  // all as it was, the clock having run meanwhile if it was running.
  // The clock runs on wall time: phones pause timers in the background, so while it runs the
  // seconds left are worked out from when it started, never counted tick by tick.
  let runFrom = null;
  const syncRun = () => { runFrom = ui.running ? { secs: ui.secs, at: Date.now() } : null; };
  const clockNow = () => { if (ui.running && runFrom) ui.secs = Math.max(0, runFrom.secs - Math.floor((Date.now() - runFrom.at) / 1000)); };
  syncRun();
  const save = () => {
    clockNow();
    // The practice setup screen offers "Carry on" from this (public/app.js initPractice).
    if (practice && !practice.gone) pref.set('wknd-practice', JSON.stringify({ id: practice.id, a: team.a.id, b: team.b.id, an: team.a.name, bn: team.b.name, q: rules.periodMin, sa: G.score.a, sb: G.score.b, period: G.period, final: !!G.final || !!ui.published, at: Date.now() }));
    if (pw) ui.clocks[ui.game] = { secs: ui.secs, running: ui.running, at: Date.now() };
    return store.put({ id: key, events: list(), sent: [...sent], secs: ui.secs, running: ui.running, savedAt: Date.now(), clocks: pw ? ui.clocks : undefined, practiceId: practice ? practice.id : undefined });
  };
  const fold = () => {
    if (!pw) return foldGame(counted(), rules, { a: team.a.players.map(p => p.id), b: team.b.players.map(p => p.id) });
    // Papawis: the game's own rules and sides (its setup), then who's moved since.
    const st = setupFor(ui.game);
    rules = papawisRules(B.rules, st);
    const start = st ? papawisSides(st, null) : { ...homeSides };
    const ids = t => Object.keys(start).filter(id => start[id] === t);
    const g = foldGame(counted(), rules, { a: ids('a'), b: ids('b') });
    const now = { ...start, ...g.moved };
    for (const t of ['a', 'b']) team[t] = { ...team[t], players: everyone.filter(p => now[p.id] === t) };
    for (const p of everyone) byId[p.id] = { ...p, team: now[p.id] || homeSides[p.id] };
    return g;
  };
  let G = fold();
  const clockStr = () => `${Math.floor(ui.secs / 60)}:${String(ui.secs % 60).padStart(2, '0')}`;

  // ── Practice: how far it got, for the admin log (never the plays). At most every 20 s, and
  // right away at the end of a quarter, at game over and on Reset. ──
  let lastReport = 0, reportT = null;
  function report(extra = {}, now = false) {
    if (!practice || !navigator.onLine) return;
    clearTimeout(reportT);
    const go = () => {
      lastReport = Date.now();
      const body = JSON.stringify({ teamA: team.a.name, teamB: team.b.name, q: rules.periodMin, plays: counted().filter(e => e.type !== 'void').length, period: G.period, a: G.score.a, b: G.score.b, tips: tipAt(), ...extra });
      try { fetch(practice.log, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {}); } catch (e) {}
    };
    if (now || Date.now() - lastReport > 20000) go(); else reportT = setTimeout(go, 20000 - (Date.now() - lastReport));
  }
  // Try tips (practice only, Paolo 2026-10-27): one move at a time, ticked off when the scorer
  // does it, so a new scorer learns the screen by using it. Hide tips turns them off for good
  // on this phone; the manual (How to score) has the same moves in full.
  const TIPS = [
    { t: 'Tap a player, then the green 2PT: a made basket.', done: e => e.type === 'shot' && e.made },
    { t: 'The other way round works too: tap the red 3PT (a miss) first, then the player.', done: e => e.type === 'shot' && !e.made },
    { t: 'After a miss, Rebound? asks who got it. Tap the lit player.', done: e => e.type === 'reb' },
    { t: 'Make a basket, then answer Assisted? by tapping who passed.', done: e => e.type === 'ast' },
    { t: 'Hold FOUL to pick the kind (or tap it for a personal). Then follow the free throws.', done: e => e.type === 'foul' },
    { t: 'Made a mistake? Tap Undo on the last play.', done: e => e.type === 'void' },
    { t: 'Sub: tap a bench player, then the player coming off.', done: e => e.type === 'sub' },
    { t: 'Hold REB to say whether a rebound was offensive or defensive.', done: e => e.type === 'reb' && !!e.kind },
    { t: 'Swipe a green 2PT up for an and-one: the basket plus the foul.', done: e => e.type === 'foul' && e.kind === 'shooting' },
    { t: 'When the time runs out, tap End beside the clock to end the quarter.', done: e => e.type === 'period_end' },
  ];
  const tipsOn = () => !!practice && pref.get('wknd-prac-tips', 'on') !== 'off';
  const tipAt = () => Math.min(TIPS.length, Number(pref.get('wknd-prac-tip', '0')) || 0);
  function tipCheck(e) {
    if (!tipsOn()) return;
    const i = tipAt();
    if (i < TIPS.length && TIPS[i].done(e)) { pref.set('wknd-prac-tip', String(i + 1)); ui.tipDone = Date.now(); report({}, true); }
  }
  function tipBox() {
    if (!tipsOn() || ui.ask || ui.locked) return '';
    const i = tipAt();
    if (i >= TIPS.length) return `<div class="sc-try is-done"><b class="num">DONE</b><span>That's every move. Keep practising, or read How to score for the rest.</span><button type="button" data-act="tips-off">Hide</button></div>`;
    const just = ui.tipDone && Date.now() - ui.tipDone < 2500;
    return `<div class="sc-try${just ? ' is-new' : ''}"><b class="num">TRY ${i + 1}/${TIPS.length}</b><span>${esc(TIPS[i].t)}</span><button type="button" data-act="tips-next" aria-label="Skip this tip">Skip</button></div>`;
  }

  // ── Sending ──
  let sending = false, retry = null;
  async function sync() {
    clearTimeout(retry);
    if (practice) { for (const e of unsent()) sent.add(e.id); report(); paintPill(); return; }
    const batch = unsent();
    if (!batch.length || sending) { paintPill(); return; }
    if (!navigator.onLine) { ui.sync = 'offline'; paintPill(); return; }
    sending = true; ui.sync = 'sending'; paintPill();
    try {
      const r = await fetch(api, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: deviceId, events: batch }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { ui.sync = 'error'; ui.syncMsg = 'Signed out. Your plays are safe on this phone; sign in again to send them.'; }
      else if (r.status === 409 || r.status === 403) { ui.sync = 'error'; ui.syncMsg = d.error || 'Not sent.'; if (/published/i.test(d.error || '')) ui.locked = true; }
      else if (!r.ok) { ui.sync = 'error'; ui.syncMsg = d.error || 'Not sent. Trying again.'; retry = setTimeout(sync, 8000); }
      else {
        for (const e of batch) sent.add(e.id);
        ui.sync = 'ok'; ui.syncMsg = '';
        if (d.late && d.late.length) {
          for (const id of d.late) { const e = events.get(id); if (e) e.late = true; }
          G = fold();
          const why = { published: 'the game was already published', ended: 'the final score was already in', taken: 'another scorer had taken over your side', side: 'that side is the other scorer’s', fast: 'too many in a second or two (a pocket tap?)' }[d.lateWhy] || 'they came in late';
          ui.tip = `${d.late.length === 1 ? 'A play' : `${d.late.length} plays`} of yours ${d.late.length === 1 ? 'was' : 'were'} set aside for the admin: ${why}. Nothing was overwritten.`;
          paint();
        }
        await save();
      }
    } catch (e) { ui.sync = 'offline'; retry = setTimeout(sync, 8000); }
    sending = false;
    paintPill();
    if (G.final && !ui.publishing) paint(); // the game-over panel says what's still sending
    if (ui.sync === 'ok' && unsent().length) sync();
  }
  // The header pill: the sync state, and with two scorers which side this phone has (tap it to
  // switch, hand over or take over).
  function paintPill() {
    if (practice) { pill.className = 'sc-sync is-ok'; pill.textContent = ui.published ? 'Finished' : 'Practice'; pill.title = ''; return; }
    const n = unsent().length;
    const bad = ui.sync === 'offline' || ui.sync === 'error';
    const sides = multi && ui.lane && !ui.locked && (ui.lane !== 'both' || !!(ui.lanes && ui.lanes.others.length));
    pill.className = 'sc-sync' + (bad ? ' is-off' : n ? ' is-wait' : ' is-ok') + (sides ? ' is-side' : '');
    const state = ui.locked && (published || ui.published) ? 'Published' : ui.sync === 'offline' ? `Offline · ${n} saved` : ui.sync === 'error' ? `Not sent · ${n}` : n ? `Sending ${n}…` : 'Saved';
    // Asking for a side: the pill says so (with a pulse) until they answer.
    if (multi && !ui.lane && ui.asked && !bad && !n) {
      pill.className = 'sc-sync is-wait is-asking';
      pill.innerHTML = `<i class="sc-sync__dot"></i>Asking ${esc(ui.asked)}…`;
      pill.setAttribute('role', 'status'); pill.removeAttribute('tabindex'); pill.removeAttribute('aria-label');
      return;
    }
    pill.innerHTML = sides && !bad && !n ? `<i class="sc-sync__dot${ui.sideOpen ? ' is-open' : ''}"></i>You: ${esc(sideName(ui.lane))}${CHEV}` : esc(state) + (sides ? CHEV : '');
    pill.title = ui.syncMsg || '';
    if (sides) { pill.setAttribute('role', 'button'); pill.tabIndex = 0; pill.setAttribute('aria-label', `${state}. You score ${sideName(ui.lane)}. Switch, hand over or take over`); }
    else { pill.setAttribute('role', 'status'); pill.removeAttribute('tabindex'); pill.removeAttribute('aria-label'); }
  }
  pill.addEventListener('click', () => { if (pill.classList.contains('is-side')) sideMenu(); });
  // ── Fetching: the screen opens from the phone's copy, so plays made elsewhere (an admin's
  // removals, another phone's) come from the server when it opens and when the signal is back.
  async function pull() {
    if (practice || !navigator.onLine) return;
    try {
      const r = await fetch(api, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      let n = 0, blow = false, go = false;
      for (const e of d.events || []) {
        sent.add(e.id);
        if (events.has(e.id)) continue;
        events.set(e.id, e); n++;
        // The other scorer's whistle (a foul, a timeout) stops the clock this phone keeps.
        if (e.dev && e.dev !== deviceId && Number(e.at) > openedAt) { if (WHISTLES.has(e.type)) blow = true; else if (LIVE_BALL.has(e.type)) go = true; }
      }
      if (blow && keepsClock()) whistle();
      else if (go && ui.whistle && !ui.running && keepsClock()) { ui.running = true; ui.whistle = false; ui.restarted = true; syncRun(); }
      if (d.status === 'published' && !pw) ui.locked = true;
      if (n || ui.locked) { G = fold(); await save(); paint(); }
    } catch (e) { /* no signal: the phone's copy stands */ }
  }
  window.addEventListener('online', () => { pull(); sync(); lanes(); });

  // ── Two scorers ──
  const laneApi = api.replace(/\/events(\?.*)?$/, '/lanes');
  const sideName = l => (l === 'both' ? 'both teams' : team[l].name);
  const openedAt = Date.now();
  const mine = t => !multi || ui.lane === 'both' || ui.lane === t;
  const keeper = () => (multi && ui.lanes && ui.lanes.keeper ? ui.lanes.keeper : null);
  const keepsClock = () => { const k = keeper(); return !k || k.me; };
  let laneSig = '';
  async function lanes(body = {}) {
    if (!multi || !navigator.onLine) return;
    clockNow();
    const clock = keepsClock() && ui.lane ? { secs: ui.secs, running: ui.running, period: G.period } : null;
    let d;
    try {
      const r = await fetch(laneApi, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: deviceId, lane: ui.lane, clock, ...body }) });
      if (!r.ok) return;
      d = await r.json();
    } catch (e) { return; }
    ui.lanes = d;
    if (d.me.lane !== ui.lane) { ui.lane = d.me.lane; storeLane(ui.lane); ui.sel = null; ui.arm = null; }
    if (d.me.note) ui.tip = d.me.note;
    // Asking for a side: waiting until they answer (or the ask is gone: they kept it).
    const wasAsking = ui.asked;
    ui.asked = d.me.lane ? '' : d.asked || (d.me.ask ? ui.asked || (holderOf(d.me.ask) || {}).name || 'them' : '');
    if (wasAsking && !ui.asked && !body.action) chime(d.me.lane ? 'yes' : 'no');
    // Someone asks for this phone's side: a chime (again after 10 s), and a no after ASK_MS.
    const ask0 = ui.lane && d.asks && d.asks[0];
    if (ask0 && (!ui.askFor || ui.askFor.device !== ask0.device || ui.askFor.lane !== ask0.lane)) {
      const f = ui.askFor = { device: ask0.device, lane: ask0.lane, at: Date.now() };
      chime('ask');
      setTimeout(() => { if (ui.askFor === f) chime('ask'); }, 10000);
      setTimeout(() => { if (ui.askFor === f && !ui.handing) { ui.handing = 'no'; paint(); lanes({ action: 'answer', from: f.device, yes: false, timeout: true }).finally(() => { ui.handing = null; paint(); }); } }, ASK_MS);
    } else if (!ask0) ui.askFor = null;
    // The other scorer left (or their phone has been quiet 2 minutes): offer this phone both
    // teams, once.
    const otherSide = ui.lane === 'a' ? 'b' : ui.lane === 'b' ? 'a' : null;
    if (otherSide) {
      const h = holderOf(otherSide), live = h && (h.quiet || 0) < (d.staleMs || 120000);
      if (live) { ui.partner = h.name; ui.partnerIni = h.ini || ''; ui.alone = null; ui.sideOpen = false; }
      else if (ui.partner) { ui.alone = { name: ui.partner, ini: ui.partnerIni || '', why: h ? 'quiet' : 'left' }; ui.sideOpen = true; ui.partner = null; chime('left'); }
    } else { ui.partner = null; ui.alone = null; ui.sideOpen = false; }
    if (d.tookOver) ui.tip = `You took over from ${d.tookOver}.`;
    if (d.conflict && !twoIn()) ui.tip = `${d.conflict.name} is still scoring that side. Ask them, or wait until their phone has been quiet for 2 minutes.`;
    const k = d.keeper;
    if (k && !k.me && k.clock) {
      const gone = k.clock.running ? Math.round((d.now - k.clock.at) / 1000) : 0;
      ui.secs = Math.max(0, k.clock.secs - gone); ui.running = k.clock.running; syncRun();
    }
    if (d.others.length) pull();
    // Repaint only when something changed (not every check-in): sides, asks, the keeper, the
    // notes; while choosing a side the countdowns tick, so then always.
    const sig = JSON.stringify([d.me, d.others, d.asks, d.keeper && d.keeper.device, ui.asked, ui.alone, ui.tip, !ui.lane && d.holders]);
    if (sig !== laneSig || body.action) { laneSig = sig; paint(); }
    else { const c = root.querySelector('[data-sc-clock]'); if (c) c.textContent = clockStr(); }
  }
  const pickSide = (want, holder) => {
    if (!holder) return lanes({ action: 'claim', want });
    ui.asked = holder; ui.tip = '';
    return lanes({ action: 'ask', want });
  };
  // Who holds a side, quiet phones included (the server says how long each has been quiet).
  const holderOf = l => (ui.lanes ? (ui.lanes.holders || ui.lanes.others).find(o => o.lane && (o.lane === 'both' || l === 'both' || o.lane === l)) : null);
  // A side's button: Score it (free), Ask the holder (active), wait (gone quiet, not long
  // enough), or Take over (quiet 2+ minutes: anyone can).
  // Two scorers at most: with two others in (neither quiet 2+ minutes) and no side of my own,
  // the sides show greyed out; one going quiet opens Take over.
  const twoIn = () => !ui.lane && !!ui.lanes && (ui.lanes.holders || []).filter(h => (h.quiet || 0) < (ui.lanes.staleMs || 120000)).length >= 2;
  function sideState(l) {
    const h = holderOf(l), side = sideName(l);
    if (!h) return { act: 'claim', label: `Score ${side}` };
    const quiet = h.quiet || 0, active = ui.lanes.activeMs || 45000, stale = ui.lanes.staleMs || 120000;
    if (twoIn() && quiet < stale) return { act: 'wait', label: `${h.name} scores ${side}` };
    if (quiet < active) return { act: 'ask', holder: h.name, label: `Ask ${h.name} for ${side}` };
    if (quiet < stale) return { act: 'wait', label: `${h.name} went quiet · take over ${side} in ${Math.ceil((stale - quiet) / 1000)}s` };
    return { act: 'claim', label: `Take over ${side} (${h.name} quiet ${Math.floor(quiet / 60000)} min)` };
  }
  function sideMenu() {
    const opts = ['a', 'b', 'both'].filter(l => l !== ui.lane && (l !== 'both' || sideState('both').act !== 'ask')).map(l => { const st = sideState(l); return [st.act === 'wait' ? `wait:${l}` : l, st.label]; });
    if (ui.lane) opts.push(['watch', 'Stop scoring (watch)']);
    if (ui.lanes && ui.lanes.admin) opts.push(...['a', 'b', 'both'].filter(l => holderOf(l) && sideState(l).act !== 'claim').map(l => [`force:${l}`, `Take over ${sideName(l)} now (admin)`]));
    menu('Which side do you score?', opts, k => {
      if (k === 'watch') return lanes({ action: 'claim', want: null });
      if (k.startsWith('wait:')) return sideMenu();
      if (k.startsWith('force:')) return lanes({ action: 'claim', want: k.slice(6), force: true });
      const st = sideState(k);
      return st.act === 'ask' ? pickSide(k, st.holder) : lanes({ action: 'claim', want: k });
    });
  }
  // The other phone's plays as they land (the live score's socket says when).
  let sock = null;
  const listen = () => {
    if (!multi || !window.WebSocket || sock) return;
    try { sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/ws/games/${encodeURIComponent(gid)}/live`); } catch (e) { return; }
    sock.onmessage = () => { if (ui.lanes && ui.lanes.others.length) pull(); };
    sock.onclose = () => { sock = null; if (document.contains(el)) setTimeout(listen, 5000); };
  };
  const laneTimer = multi ? setInterval(() => { if (!document.contains(el)) { clearInterval(laneTimer); if (sock) sock.close(); release(); return; } lanes(); }, 4000) : null;
  const syncTimer = setInterval(() => { if (!document.contains(el)) { clearInterval(syncTimer); clearInterval(tick); return; } if (unsent().length) sync(); }, 10000);
  pull();
  // Practice: Reset (the strip at the top) clears this practice and goes back to the setup.
  if (practice) el.addEventListener('click', e => {
    if (!e.target.closest('[data-prac-reset]')) return;
    confirm('Reset the practice?', 'Every play in this practice goes. Nothing was sent anywhere', 'flag', 'Reset', async () => {
      report({ reset: true }, true);
      practice.gone = true; pref.set('wknd-practice', '');
      await store.put({ id: key, events: [], sent: [], secs: rules.periodMin * 60, practiceId: 'reset' });
      location.href = B.over.back;
    });
  });

  // ── Making plays ──
  function add(fields, { flash } = {}) {
    if (ui.locked) { ui.tip = 'This game is published. Nothing more can be added here.'; return paint(); }
    // Going back (ui.after): the play goes in right after that one, in its period, and the
    // next one goes after this.
    const anchor = ui.after && events.get(ui.after);
    const e = anchor
      ? { id: uid(), pos: nextPos(list(), anchor.id), at: Date.now(), period: anchor.period || G.period, clock: anchor.clock || '', dev: deviceId, ...fields }
      : { id: uid(), pos: nextPos(list()), at: Date.now(), period: G.period, clock: clockStr(), dev: deviceId, ...fields };
    events.set(e.id, e);
    if (practice) sent.add(e.id); // nothing to send: a practice play is saved the moment it's made
    tipCheck(e);
    if (anchor && fields.type !== 'void') ui.after = e.id;
    G = fold();
    if (fields.type === 'period_end') report({}, true);
    if (ui.whistle && !ui.running && !anchor && LIVE_BALL.has(fields.type)) { ui.running = true; ui.whistle = false; ui.restarted = true; syncRun(); }
    else if (!ui.running && !anchor && LIVE_BALL.has(fields.type) && keepsClock() && !G.final && ui.secs === periodSecs()) { ui.running = true; ui.started = true; syncRun(); }
    if (flash && fields.player) { ui.flashN++; ui.flash = { pid: fields.player, ...flash, at: Date.now() }; }
    // The phone's Scoresheet closes on this phone's next play (with two scorers the clock is
    // the other phone's, so the clock can't be the signal); the docked one stays.
    if (!wide.matches) ui.sheet = false;
    if (fields.type !== 'void') ui.redo = null;
    ui.peek = null;
    save().then(sync);
    return e;
  }
  const other = t => (t === 'a' ? 'b' : 'a');
  const soundOn = () => pref.get('wknd-sc-sound', 'on') !== 'off';
  // Follow-up questions (Paolo, 2026-10-27): on by default; a scorer who knows the game can turn
  // off the optional ones (SKIPPABLE) on their phone.
  const followOn = () => !basic() && pref.get('wknd-sc-follow', 'on') !== 'off';
  const periodSecs = () => (isOvertime(G.period) ? rules.otMin : rules.periodMin) * 60;
  // Which five: the five who played last (topped up from the roster). Where they sit: tiles
  // never move (Paolo, 2026-10-25: the scorer learns where a player is). A player coming in
  // from the bench takes the slot of the one who dropped out, in place.
  const slots = { a: [], b: [] };
  const five = t => {
    const out = id => G.flags[id] || G.dnp.includes(id) || G.benched.includes(id);
    const ids = G.lastActive[t].filter(id => byId[id] && !out(id));
    for (const p of team[t].players) { if (ids.length >= 5) break; if (!ids.includes(p.id) && !out(p.id)) ids.push(p.id); }
    const want = ids.slice(0, 5);
    const next = slots[t].map(id => (want.includes(id) ? id : null));
    const fresh = want.filter(id => !next.includes(id));
    for (let i = 0; i < next.length && fresh.length; i++) if (!next[i]) next[i] = fresh.shift();
    next.push(...fresh);
    slots[t] = next.filter(Boolean).slice(0, 5);
    return slots[t];
  };
  const onCourt = (t, id) => five(t).includes(id);
  const short = id => (byId[id] ? `${byId[id].number ? '#' + byId[id].number + ' ' : ''}${byId[id].short}` : 'Player');
  // Foul trouble follows the quarter: fouls = the quarter (from Q2) is "watch"; more, or one
  // from fouling out, is "danger". Overtime counts as Q4.
  const quarter = () => Math.min(periodIndex(G.period), 4);
  // No foul-outs (Papawis): no foul trouble either.
  const trouble = pf => (!pf || !(rules.foulOut > 0) ? '' : pf >= rules.foulOut - 1 || pf > quarter() ? 'd' : quarter() >= 2 && pf === quarter() ? 'w' : '');

  // Both orders: with a player picked the stat goes straight in; without one the stat lights
  // up (armed) and the next player tapped gets it.
  function want(key, run) {
    ui.queue = [];
    if (ui.sel) return run();
    ui.arm = ui.arm && ui.arm.key === key ? null : { key, run };
    ui.ask = null; ui.tip = ''; paint();
  }
  // A bench player's stat brings them on; ask who went off (skippable: the engine already
  // sits the one who played least recently).
  // It comes first (the lineup must be right), whatever the play asked (Assisted? waits its turn);
  // behind the foul panel it waits until the free throws are done.
  function benchIn(pid, t, wasOn) {
    if (wasOn.includes(pid)) return;
    const q = { kind: 'wentoff', team: t, pid, q: `${short(pid)} on. Who went off?`, opts: wasOn.map(id => ({ id, label: short(id) })), skip: 'Skip' };
    if (ui.ask && ui.ask.kind === 'fp') { ui.queue.push(q); return; }
    if (ui.ask) ui.queue.unshift(ui.ask);
    ui.ask = q;
  }
  // A player who fouls out (or is ejected) leaves the court: who comes on for them? The engine
  // already filled the tile from the bench; the answer puts in who really came on.
  function foulOut(pid, t) {
    const auto = five(t).filter(id => !G.lastActive[t].includes(id));
    const bench = [...new Set([...auto, ...subBench(t)])];
    if (!bench.length) return;
    ui.queue.push({ kind: 'foulout', team: t, pid, noTimer: true, q: `${short(pid)} is ${G.flags[pid]}. Who comes on?`, opts: bench.map(id => ({ id, label: short(id) })), skip: 'Later' });
  }
  function shot(pts, made) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    const e = add({ type: pts === 1 ? 'ft' : 'shot', ...(pts > 1 ? { pts } : {}), made, team: t, player: pid }, { flash: { text: made ? `+${pts}` : 'MISS', tone: made ? 'good' : 'bad' } });
    ui.sel = null; ui.tip = '';
    ui.ask = made && pts > 1 ? { kind: 'ast', ref: e.id, team: t, shooter: pid, q: 'Assisted?', skip: 'No assist' }
      : !made && pts > 1 ? reboundAsk(t) : null;
    benchIn(pid, t, wasOn);
    paint();
  }
  // A live-ball miss (a field goal, or the last free throw of a trip): who got the rebound?
  // Two rows: the defending five first (most rebounds are theirs), the shooting team's below
  // (Paolo, 2026-10-26: ten in one strip was too long, a swap button one tap too many).
  const reboundAsk = missTeam => ({ kind: 'rebound', q: 'Rebound?', skip: 'No rebound', miss: missTeam });
  // Steal right after the other team's turnover: one play (the steal says who lost it), no
  // question. Block right after the other team's missed shot: linked to it, then Rebound?.
  // Otherwise: Who lost it? / Whose shot? (that one also records their missed shot, then Rebound?).
  // extra: fields for the play, e.g. a rebound's kind ('off' | 'def') picked by holding REB.
  function simple(type, flashText, extra = {}) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    const prev = G.rows[G.rows.length - 1];
    if (type === 'stl' && prev && prev.type === 'to' && prev.team === other(t) && prev.player && !ui.after) {
      add({ type: 'void', target: prev.id });
      add({ type: 'stl', team: t, player: pid, from: prev.player, restores: prev.id }, { flash: { text: flashText, tone: 'plain' } });
      ui.sel = null; ui.tip = ''; ui.ask = null; benchIn(pid, t, wasOn); return paint();
    }
    if (type === 'blk' && prev && prev.type === 'shot' && !prev.made && prev.team === other(t)) {
      add({ type: 'blk', team: t, player: pid, ref: prev.id }, { flash: { text: flashText, tone: 'plain' } });
      // A block is usually followed by a rebound (Paolo, 2026-10-27): ask, as after a miss.
      ui.sel = null; ui.tip = ''; ui.ask = reboundAsk(prev.team); benchIn(pid, t, wasOn); return paint();
    }
    const e = add({ type, team: t, player: pid, ...extra }, { flash: { text: flashText, tone: 'plain' } });
    if (type === 'reb') { const row = G.rows.find(r => r.id === e.id); ui.flash.text = row && row.off ? 'OREB' : extra.kind === 'def' ? 'DREB' : 'REB'; }
    ui.sel = null; ui.tip = '';
    ui.ask = type === 'stl' ? { kind: 'lost', ref: e.id, team: t, o: other(t), q: 'Who lost it?', opts: five(other(t)).map(id => ({ id, label: short(id) })), skip: 'Team turnover' }
      : type === 'blk' ? { kind: 'blocked', ref: e.id, team: t, o: other(t), pts: 2, q: 'Whose shot?', opts: five(other(t)).map(id => ({ id, label: short(id) })), skip: 'Skip' } : null;
    benchIn(pid, t, wasOn);
    paint();
  }
  function turnover(kind) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    add({ type: 'to', team: t, player: pid, ...(kind ? { kind } : {}) }, { flash: { text: 'TO', tone: 'bad' } });
    ui.sel = null; ui.ask = null; ui.tip = '';
    benchIn(pid, t, wasOn);
    paint();
  }
  // A foul opens one panel: how many free throws (the engine's default picked), and-one, the
  // shooter, then each free throw on one row. 2-shot foul = player, FOUL, FT, FT.
  function foul(kind) {
    const pid = ui.sel; const t = byId[pid].team, o = other(t); const wasOn = five(t).slice();
    const inPenalty = G.teamFouls[t] + 1 >= rules.penaltyAt;
    const prev = G.rows[G.rows.length - 1];
    ui.queue = [];
    const e = add({ type: 'foul', team: t, player: pid, kind }, { flash: { text: kind === 'technical' ? 'T' : 'FOUL', tone: 'bad' } });
    whistle(); // a foul stops the clock
    ui.sel = null; ui.tip = '';
    const flag = G.flags[pid];
    if (flag) ui.tip = `${byId[pid].name} is ${flag}.`;
    const after = () => {
      // A bench player's foul (not a technical: that can come from the bench) puts them on.
      if (kind !== 'technical') benchIn(pid, t, wasOn);
      if (G.flags[pid] && wasOn.includes(pid)) foulOut(pid, t);
    };
    if (kind === 'offensive') { ui.ask = null; after(); return paint(); }
    // The shooter: only for a shooting foul, the other team's player who just shot (in the
    // penalty the fouled player shoots, rarely the last shooter: the scorer picks).
    const shotBy = prev && prev.team === o && prev.player && prev.type === 'shot' ? prev : null;
    const shooter = kind === 'shooting' && shotBy ? shotBy.player : null;
    const shotPts = kind === 'shooting' && shotBy && !shotBy.made ? shotBy.pts : 2;
    ui.ask = { kind: 'fp', ref: e.id, team: t, o, pid, foulKind: kind, n: defaultFreeThrows(kind, { inPenalty, shotPts }), andOne: false, shooter, done: 0, bench: false };
    after();
    paint();
  }
  // A whistle (foul, timeout, technical, violation, refs) stops the clock. If it was running,
  // the next play that only happens with the ball live (a shot, rebound, steal or block) starts
  // it again, and the Start button pulses until then (Paolo, 2026-10-26). Free throws never do.
  // Only the phone that keeps the clock.
  function whistle() { if (!keepsClock()) return; clockNow(); if (ui.running) ui.whistle = true; ui.running = false; syncRun(); }
  // And-one (swipe a made shot up): the basket, then who fouled; the foul panel opens set to
  // one free throw for the shooter.
  function andOne(pts) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    add({ type: 'shot', pts, made: true, team: t, player: pid }, { flash: { text: `+${pts}`, tone: 'good' } });
    ui.sel = null; ui.tip = '';
    ui.ask = { kind: 'andone', shooter: pid, team: t, o: other(t), q: `And-one: who fouled ${short(pid)}?`, opts: five(other(t)).map(id => ({ id, label: short(id) })), skip: 'Skip' };
    benchIn(pid, t, wasOn);
    paint();
  }
  function teamPlay(t, type, extra = {}) {
    const e = add({ type, team: t, ...extra });
    if (type === 'team_tech' || type === 'team_to') whistle();
    ui.ask = null; ui.sel = null; ui.arm = null; ui.queue = [];
    // A coach or bench technical: one free throw, shot by any player of the other team.
    if (type === 'team_tech' && e) ui.ask = { kind: 'fp', ref: e.id, team: t, o: other(t), pid: null, who: `${team[t].name} ${extra.kind || 'coach'}`, foulKind: 'technical', n: 1, andOne: false, shooter: null, done: 0, bench: true };
    paint();
  }

  // Questions in the stat buttons' place.
  function answer(id) {
    const a = ui.ask; if (!a) return;
    if (a.kind === 'ast') { if (id) add({ type: 'ast', team: a.team, player: id, ref: a.ref }, { flash: { text: 'AST', tone: 'plain' } }); ui.ask = null; }
    else if (a.kind === 'lost') {
      if (id) { add({ type: 'void', target: a.ref }); const old = events.get(a.ref); add({ type: 'stl', team: old.team, player: old.player, from: id, restores: a.ref }); }
      ui.ask = null;
    } else if (a.kind === 'blocked') {
      // Their missed shot goes in just before the block.
      if (id) {
        const blk = events.get(a.ref);
        const order = list().sort((x, y) => x.pos - y.pos), i = order.findIndex(x => x.id === a.ref), before = order[i - 1];
        const miss = { id: uid(), pos: before ? nextPos(list(), before.id) : blk.pos - 1, at: Date.now(), period: blk.period, clock: blk.clock, dev: deviceId, type: 'shot', pts: a.pts, made: false, team: a.o, player: id };
        events.set(miss.id, miss);
        G = fold(); save().then(sync);
      }
      // Then the rebound off the block, only if they answered: a skipped first question means
      // they're moving on, so no second one (Paolo, 2026-10-27).
      ui.ask = id ? reboundAsk(a.o) : null;
    } else if (a.kind === 'andone') {
      ui.ask = null;
      if (id) {
        ui.sel = id; foul('shooting');
        if (ui.ask && ui.ask.kind === 'fp') { ui.ask.n = 1; ui.ask.andOne = true; ui.ask.shooter = a.shooter; }
        return paint();
      }
    } else if (a.kind === 'wentoff') {
      if (id) add({ type: 'sub', team: a.team, in: a.pid, out: id });
      ui.ask = null;
    } else if (a.kind === 'rebound') {
      // Its kind from the question (whose miss it was), not guessed: after a block whose shooter
      // was skipped there's no miss in the plays to guess from.
      if (id) { const off = byId[id].team === a.miss; add({ type: 'reb', team: byId[id].team, player: id, kind: off ? 'off' : 'def' }, { flash: { text: off ? 'OREB' : 'DREB', tone: 'plain' } }); }
      ui.ask = null;
    } else if (a.kind === 'foulout') {
      if (id) { const tiles = [...five(a.team)], auto = tiles.find(x => !G.lastActive[a.team].includes(x)); add({ type: 'sub', team: a.team, in: id, out: a.pid }); if (auto && auto !== id) slots[a.team] = tiles.map(x => (x === auto ? id : x)); }
      ui.ask = null;
    } else if (a.kind === 'menu') { ui.ask = null; if (id === '__cancel') return paint(); a.act(id); return; }
    paint();
  }
  // Every menu ends with Cancel: closes it, nothing saved.
  // opts: [id, label] pairs, or groups ({ group, items: [[id, label], …] }) shown as labelled rows.
  const menu = (q, opts, act, def) => {
    const one = ([id, label]) => ({ id, label, def: id === def });
    const groups = opts.some(o => o.group) ? opts.map(g => ({ group: g.group, opts: g.items.map(one) })) : null;
    ui.ask = { kind: 'menu', q, groups, opts: groups ? groups.flatMap(g => g.opts) : opts.map(one), act }; ui.peek = null; paint();
  };

  // What each button does on a tap, and on a hold.
  const TAP = {
    pf: () => want('pf', () => foul('personal')),
    to: () => want('to', () => turnover(null)),
    reb: () => want('reb', () => simple('reb', 'REB')),
    score: () => {},
  };
  const FOULS = [['personal', 'Personal'], ['shooting', 'Shooting'], ['offensive', 'Offensive'], ['technical', 'Technical'], ['unsportsmanlike', 'Unsportsmanlike'], ['disqualifying', 'Disqualifying']];
  const TOS = [['bad pass', 'Bad pass'], ['lost ball', 'Lost ball'], ['travel', 'Travel'], ['double dribble', 'Double dribble'], ['out of bounds', 'Out of bounds']];
  const REBS = [['off', 'Offensive'], ['def', 'Defensive']];
  const HOLD = {
    pf: () => menu('Foul: what kind?', FOULS, k => (ui.sel ? foul(k) : want(`pf:${k}`, () => foul(k))), 'personal'),
    to: () => menu('Turnover: what kind?', TOS, k => (ui.sel ? turnover(k) : want(`to:${k}`, () => turnover(k)))),
    // A tap works out offensive or defensive from the play before; a hold says which (Paolo,
    // 2026-10-27: the guess is wrong when the miss wasn't logged or a play sits in between).
    reb: () => menu('Rebound: which kind?', REBS, k => (ui.sel ? simple('reb', 'REB', { kind: k }) : want(`reb:${k}`, () => simple('reb', 'REB', { kind: k })))),
    score: () => { ui.peek = 'score'; paint(); },
  };
  // The team's name is its menu: team plays in labelled rows (the row says what kind, so the
  // chips stay short), and DNP. Sub sits beside Timeout in the team's header.
  // Timeout first (it lived beside the tiles until a mis-tap cost one: Paolo, 2026-10-26).
  // Papawis: no timeouts or coaches; Basic has no turnovers either. Players: move one over, or
  // bring in a late arrival.
  const teamMenu = t => menu(team[t].name, [
    ...(G.timeouts.allowance ? [{ group: 'Timeout', items: [[G.timeouts.left[t] > 0 ? 'timeout' : 'wait:timeout', G.timeouts.left[t] > 0 ? `Call timeout · ${G.timeouts.left[t]} left` : 'No timeouts left']] }] : []),
    ...(basic() ? [] : [{ group: 'Turnover', items: [['to', 'Team'], ['shot clock', 'Shot clock'], ['3 seconds', '3s'], ['5 seconds', '5s'], ['8 seconds', '8s']] }]),
    ...(pw ? [] : [{ group: 'Technical', items: [['coach T', 'Coach'], ['bench T', 'Bench']] }]),
    ...(pw ? [{ group: 'Players', items: [['pw-in', `Move someone to ${team[t].name}…`], ...(lateFor().length ? [['pw-late', 'A late arrival…']] : [])] }] : []),
    { group: 'Lineup', items: [['dnp', 'DNP…']] }],
  k => (k === 'timeout' ? timeout(t) : k === 'dnp' ? dnpMenu(t) : k === 'pw-in' ? moveInMenu(t) : k === 'pw-late' ? lateMenu(t) : k === 'to' ? teamPlay(t, 'team_to') : k.endsWith(' T') ? teamPlay(t, 'team_tech', { kind: k.slice(0, -2) }) : teamPlay(t, 'team_to', { kind: k })));
  // Papawis: a player switches sides (a `move` play; his points so far stay with the old side).
  function movePlayer(id, to) {
    if (!byId[id] || (to !== 'a' && to !== 'b')) return;
    add({ type: 'move', team: to, player: id, to });
    ui.sel = null; ui.tip = `${short(id)} is on ${team[to].name} now. His points so far stay with ${team[other(to)].name}.`;
    paint();
  }
  const moveInMenu = t => {
    const from = team[other(t)].players.map(p => [p.id, `${short(p.id)}${onCourt(other(t), p.id) ? ' · on court' : ''}`]);
    if (!from.length) { ui.tip = `Nobody on ${team[other(t)].name} to move.`; return paint(); }
    menu(`Move to ${team[t].name}: who?`, from, id => movePlayer(id, t));
  };
  // Players not in this game (marked not here at setup) who came after all.
  const lateFor = () => { const st = setupFor(ui.game); return st ? everyone.filter(p => (st.absent || []).includes(p.id) && !(G.moved || {})[p.id]) : []; };
  const lateMenu = t => menu(`A late arrival for ${team[t].name}`, lateFor().map(p => [p.id, short(p.id)]), id => movePlayer(id, t));
  // Sub from the menu: who comes on, then who goes off (the same as tapping the tiles).
  // The Subs sheet (the Sub button beside Timeout): tap who comes off (court, red ↓) and who
  // goes on (bench, green ↑), as many as you like; they pair up in the order tapped. "All 5"
  // for a line change. Save makes
  // every sub at once. A fouled-out or ejected player still on court starts marked.
  // The bench, late arrivals (DNP) last: subbing one in clears their DNP.
  const subBench = t => { const b = team[t].players.filter(p => !onCourt(t, p.id) && !G.flags[p.id]); return [...b.filter(p => !G.dnp.includes(p.id)), ...b.filter(p => G.dnp.includes(p.id))].map(p => p.id); };
  const subMenu = t => {
    if (!subBench(t).length) { ui.tip = `${team[t].name}: nobody on the bench to bring on.`; return paint(); }
    ui.subs = { t, out: five(t).filter(id => G.flags[id]), in: [] };
    ui.ask = null; ui.peek = null; paint();
  };
  function subSave() {
    const s = ui.subs; if (!s || !s.out.length || s.out.length !== s.in.length) return;
    // Each one coming on takes the tile of the one they replace (several at once would
    // otherwise fill the empty tiles in roster order).
    const tiles = [...five(s.t)], batch = s.out.length > 1 ? uid() : undefined;
    s.out.forEach((outId, i) => doSub(s.t, s.in[i], outId, batch));
    slots[s.t] = tiles.map(id => { const i = s.out.indexOf(id); return i >= 0 ? s.in[i] : id; });
    ui.tip = s.out.length > 1 ? `${s.out.length} subs for ${team[s.t].name}.` : '';
    ui.subs = null; paint();
  }
  const subsSheet = () => {
    const s = ui.subs; if (!s) return '';
    const t = s.t, on = five(t), bench = subBench(t);
    const tileP = (id, side) => {
      const p = byId[id], i = (side === 'out' ? s.out : s.in).indexOf(id), mark = i >= 0;
      const mate = mark ? (side === 'out' ? s.in : s.out)[i] : null;
      const flag = side === 'out' && G.flags[id];
      return `<button type="button" class="sc-sbp${mark ? (side === 'out' ? ' is-out' : ' is-in') : ''}" data-subp="${esc(id)}" data-sublist="${side}" aria-pressed="${mark}" aria-label="${esc(short(id))}${mark ? (side === 'out' ? ', coming off' : ', going on') : ''}${mate ? ', for ' + esc(short(mate)) : ''}">
        ${mark ? `<i class="sc-sbp__m">${side === 'out' ? ARROW_DOWN : ARROW_UP}</i>` : ''}
        ${p.number ? `<b class="num">${esc(p.number)}</b>` : ''}<span>${esc(p.short)}</span>
        ${mate ? `<small class="sc-sbp__for">${side === 'out' ? '↑' : '↓'} ${esc(byId[mate].number ? '#' + byId[mate].number : byId[mate].short)}</small>` : flag ? `<small class="sc-sbp__for sc-sbp__for--flag">${esc(flag)}</small>` : side === 'in' && G.dnp.includes(id) ? '<small class="sc-sbp__for">DNP</small>' : ''}</button>`;
    };
    const nOut = s.out.length, nIn = s.in.length;
    const label = !nOut && !nIn ? 'Pick who comes off and who goes on'
      : nOut > nIn ? `Pick ${nOut - nIn} more going on` : nIn > nOut ? `Pick ${nIn - nOut} more coming off`
      : `Make ${nOut} sub${nOut === 1 ? '' : 's'}`;
    const allOut = on.every(id => s.out.includes(id));
    return `<div class="sc-sheet sc-sheet--subs" role="dialog" aria-modal="true" aria-label="${esc(team[t].name)}: subs"><div class="sc-sheet__in">
      <div class="sc-sheet__grab" aria-hidden="true"></div>
      <div class="sc-sheet__h"><b>${esc(team[t].name)}: subs</b><button type="button" class="sc-x" data-act="subs-close" aria-label="Close without saving">${CLOSE}</button></div>
      <div class="sc-sbh"><span class="sc-mg__l">On court · coming off</span><button type="button" class="sc-sbh__all" data-act="subs-all" aria-pressed="${allOut}">${allOut ? 'None' : 'All 5'}</button></div>
      <div class="sc-sb">${on.map(id => tileP(id, 'out')).join('')}</div>
      <div class="sc-sbh"><span class="sc-mg__l">Bench · going on</span></div>
      <div class="sc-sb sc-sb--bench">${bench.map(id => tileP(id, 'in')).join('')}</div>
      <button type="button" class="sc-dnp__save" data-act="subs-save"${nOut && nOut === nIn ? '' : ' disabled'}>${esc(label)}</button></div></div>`;
  };
  function timeout(t) {
    if (G.timeouts.left[t] <= 0) return;
    whistle(); teamPlay(t, 'timeout');
  }
  // End of Q4 (or an overtime) with a winner: Game over or Not yet, never overtime; a tie:
  // overtime only (Paolo, 2026-10-26). Both in the amber bar.
  function endPeriod() {
    if (G.final) { ui.tip = 'The game is over. Undo the last play to reopen it.'; return paint(); }
    const cur = G.period, next = periodName(periodIndex(cur) + 1);
    const note = pw ? (isOvertime(next) ? `${rules.otMin} min of overtime` : `${rules.periodMin} min`) : isOvertime(next) ? `${rules.otMin} min, 1 timeout each, team fouls carry on` : next === 'Q3' ? '3 timeouts each, team fouls reset' : 'Team fouls reset';
    const late = periodIndex(cur) >= rules.periods;
    // Papawis (Paolo, 2026-10-30): a game can end tied; extra time only if there's time.
    if (pw && late) {
      const tied = G.score.a === G.score.b, ot = `OT${isOvertime(cur) ? Number(String(cur).slice(2)) + 1 : 1}`;
      return menu(`End of ${cur}: ${team.a.name} ${G.score.a}–${G.score.b} ${team.b.name}`, [['over', tied ? 'Game over · tied' : 'Game over'], ['extra', `Extra time · ${rules.otMin} min`], ['wait', 'Not yet']], k => {
        if (k === 'over') { add({ type: 'period_end', period: cur, final: true }); ui.running = false; ui.whistle = false; syncRun(); ui.tip = ''; save(); return paint(); }
        if (k === 'extra') return startNext(cur, ot);
        return paint();
      }, 'over');
    }
    if (late && G.score.a !== G.score.b) {
      return confirm('Game over?', `End of ${cur}: ${team.a.name} ${G.score.a}–${G.score.b} ${team.b.name}`, 'flag', 'Game over', () => {
        add({ type: 'period_end', period: cur, final: true }); ui.running = false; ui.whistle = false; syncRun(); ui.tip = ''; save(); paint();
      });
    }
    confirm(`End ${cur} and start ${next}?`, late ? `Tied ${G.score.a}–${G.score.b}. ${note}` : note.charAt(0).toUpperCase() + note.slice(1), 'clock', `End ${cur}`, () => startNext(cur, next));
  }
  // A confirmation in the amber bar at the top, like Leave and the other scorer's alerts
  // (Paolo, 2026-10-26): Not yet, and the action.
  const ICONS = { flag: 'M5 21V4M5 4h11l-2 4 2 4H5', clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', up: 'M12 16V4M7 9l5-5 5 5M5 20h14' };
  function confirm(title, sub, icon, yes, act, no = 'Not yet', noAct = null) { ui.confirm = { title, sub, icon, yes, act, no, noAct }; ui.ask = null; ui.peek = null; paint(); }
  function startNext(cur, next) {
    // Extra time after a Papawis game shorter than four quarters: the next period is OT1, not Q3.
    add({ type: 'period_end', period: cur, ...(periodIndex(next) !== periodIndex(cur) + 1 ? { next } : {}) });
    ui.running = false; ui.whistle = false; ui.secs = (isOvertime(next) ? rules.otMin : rules.periodMin) * 60; syncRun(); ui.tip = `${next} started.`;
    save(); paint();
  }
  // Send my plays: every play on this phone as a file (share sheet or download), for when it
  // can't sync (signed out, account trouble). An admin imports it on the Scoring tab.
  function sendMyPlays() {
    const data = JSON.stringify({ kind: 'wknd-scorer-plays', game: gid, pass: B.pass, device: deviceId, at: Date.now(), events: list() });
    const name = `wknd-plays-${gid}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    const file = typeof File === 'function' ? new File([data], name, { type: 'application/json' }) : null;
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    // The share sheet when the phone has one (then Messenger, email…), else a download; a share
    // that fails (not one the scorer closed) falls back to the download.
    const phone = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (phone && file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'My plays' }).catch(err => { if (!err || err.name !== 'AbortError') download(); });
    download();
  }
  const gameMenu = () => menu(`${G.final ? 'Final' : G.period} · ${clockStr()}`, [['sheet', 'Scoresheet'], ['refs', 'Refs stopped play…'], ...(G.final ? [] : [['end', `End ${G.period}`]]), ['clock', 'Fix the clock'], ...(video && B.video ? [['video', ui.showVideo ? 'Hide the video' : 'Show the video']] : []), ['send', `Send my plays (${list().length})…`], ...(basic() ? [] : [['follow', followOn() ? 'Follow-up questions: on (tap to turn off)' : 'Follow-up questions: off (tap to turn on)']]), ...(multi ? [['sound', soundOn() ? 'Sounds: on (tap to turn off)' : 'Sounds: off (tap to turn on)']] : []),
    ...(pw && games().filter(n => setupFor(n)).length > 1 ? [['pw-games', 'Another game of this run…']] : []), ...(pw ? [['pw-finish', 'Finish the run…']] : []), ['table', tblOn() ? 'Table display: linked ✓' : 'Table display (tablet)…']], k => {
    if (k === 'send') return sendMyPlays();
    if (k === 'pw-games') return menu('Which game?', games().filter(n => setupFor(n)).map(n => [String(n), `Game ${n}${n === ui.game ? ' · on screen' : ''}`]), v => goGame(Number(v)));
    if (k === 'pw-finish') { if (unsent().length) { ui.tip = `Finish the run once every play is sent: ${unsent().length} still on this phone.`; return paint(); } location.href = pw.finish; return; }
    if (k === 'table') return tableOpen();
    if (k === 'sheet') { ui.sheet = true; return paint(); }
    if (k === 'follow') { pref.set('wknd-sc-follow', followOn() ? 'off' : 'on'); ui.tip = followOn() ? 'Follow-up questions on: Rebound?, Assisted? and the rest.' : 'Follow-up questions off. Foul-outs and free throws still ask.'; return paint(); }
    if (k === 'sound') { pref.set('wknd-sc-sound', soundOn() ? 'off' : 'on'); ui.tip = soundOn() ? 'Sounds on.' : 'Sounds off.'; if (soundOn()) chime('yes'); return paint(); }
    if (k === 'refs') return menu('Refs stopped play: why?', [['injury', 'Injury'], ['equipment', 'Equipment'], ['clock', 'Clock / scoreboard'], ['coach', 'Talking to a coach'], ['other', 'Other']], r => { whistle(); teamPlay(null, 'stoppage', { kind: r }); });
    if (k === 'end') return endPeriod();
    if (k === 'clock') return clockMenu();
    if (k === 'video') { ui.showVideo = !ui.showVideo; showVideo(); return paint(); }
  });

  // ── Subs ──
  // Tap a bench player, then the court tile of the one coming off (or the Subs sheet). Each
  // is a 'sub' play (score-engine): the player going on takes that tile's place, the one coming
  // off sits until they play again.
  function doSub(t, inId, outId, batch) {
    if (!inId || !outId || inId === outId) return;
    add({ type: 'sub', team: t, in: inId, out: outId, ...(batch ? { batch } : {}) });
    ui.tip = '';
  }

  // ── Fixing plays ──
  const STATS = [['shot2m', '2PT made', { type: 'shot', pts: 2, made: true }], ['shot2x', '2PT miss', { type: 'shot', pts: 2, made: false }],
    ['shot3m', '3PT made', { type: 'shot', pts: 3, made: true }], ['shot3x', '3PT miss', { type: 'shot', pts: 3, made: false }],
    ...(shots.includes(4) ? [['shot4m', '4PT made', { type: 'shot', pts: 4, made: true }], ['shot4x', '4PT miss', { type: 'shot', pts: 4, made: false }]] : []),
    ['ftm', 'FT made', { type: 'ft', made: true }], ['ftx', 'FT miss', { type: 'ft', made: false }],
    ['reb', 'Rebound', { type: 'reb' }], ['ast', 'Assist', { type: 'ast' }], ['stl', 'Steal', { type: 'stl' }], ['blk', 'Block', { type: 'blk' }],
    ['to', 'Turnover', { type: 'to' }], ['foul', 'Foul', { type: 'foul', kind: 'personal' }]];
  const STAT_PLAYS = new Set(['shot', 'ft', 'reb', 'ast', 'stl', 'blk', 'to', 'foul']);
  function fix(id, fields, tip) {
    const old = events.get(id); if (!old) return;
    const [v, n] = correction(list(), old, { pts: undefined, made: undefined, kind: undefined, from: undefined, ref: undefined, ...fields }, [uid(), uid()]);
    events.set(v.id, v); events.set(n.id, n);
    G = fold(); save().then(sync);
    ui.ask = null; ui.tip = tip; paint();
  }
  function fixMenu(id) {
    const r = G.rows.find(x => x.id === id); if (!r) return;
    if (!wide.matches) ui.sheet = false;
    const what = playText(r).replace(/<[^>]+>/g, '');
    const opts = [r.player && STAT_PLAYS.has(r.type) ? ['who', 'Change player'] : null, r.player && STAT_PLAYS.has(r.type) ? ['what', 'Change stat'] : null,
      ['after', 'Add a missed play after this'], ['remove', 'Remove']].filter(Boolean);
    menu(`Fix: ${what}`, opts, k => {
      if (k === 'remove') { add({ type: 'void', target: id }); ui.tip = 'Removed. It stays on record for the review.'; return paint(); }
      if (k === 'after') { ui.after = id; ui.sel = null; ui.arm = null; ui.tip = ''; return paint(); }
      if (k === 'who') {
        const keep = { ...r };
        return menu(`Change player: ${what}`, [...team.a.players, ...team.b.players].filter(p => p.id !== r.player).map(p => [p.id, `${short(p.id)} · ${team[byId[p.id].team].name.slice(0, 3)}`]),
          pid => fix(id, { ...pick(keep), player: pid, team: byId[pid].team }, `Fixed: now ${short(pid)}.`));
      }
      if (k === 'what') {
        return menu(`Change stat: ${what}`, STATS.map(([sid, label]) => [sid, label]),
          sid => { const s = STATS.find(x => x[0] === sid); fix(id, { ...s[2], player: r.player, team: r.team }, `Fixed: now ${s[1]}.`); });
      }
    });
  }
  // The type fields worth keeping when only the player changes.
  const pick = r => ({ type: r.type, pts: r.pts, made: r.made, kind: r.kind, from: r.from, ref: r.ref });
  // Undo, then Redo until the next play: the undone play comes back in its place.
  // Undo: subs saved together go together; a play that replaced another (a steal that took in
  // their turnover, or Who lost it?) brings the replaced one back.
  const copyOf = (o, extra = {}) => { const { id: _i, pos: _p, at: _a, ...f } = o; return { ...f, id: uid(), pos: nextPos(list(), o.id), at: Date.now(), dev: deviceId, ...extra }; };
  function undo(id) {
    const old = events.get(id); if (!old) return;
    const ids = old.batch ? G.rows.filter(r => r.batch === old.batch).map(r => r.id) : [id];
    const row = G.rows.find(r => r.id === id);
    ui.redoText = ids.length > 1 ? `${ids.length} subs for ${esc(team[old.team].name)}` : row ? playText(row) : '';
    for (const x of ids) add({ type: 'void', target: x });
    let back = null;
    const replaced = old.restores && events.get(old.restores);
    if (replaced) { back = copyOf(replaced); events.set(back.id, back); G = fold(); save().then(sync); }
    ui.redo = { ids, back: back && back.id }; ui.ask = null; ui.queue = []; ui.tip = ''; paint();
  }
  function redo() {
    const r = ui.redo; if (!r) return;
    const batch = r.ids.length > 1 ? uid() : undefined;
    for (const x of r.ids) { const old = events.get(x); if (old) { const e = copyOf(old, batch ? { batch } : {}); events.set(e.id, e); } }
    if (r.back) { const v = { id: uid(), pos: nextPos(list()), at: Date.now(), period: G.period, clock: clockStr(), dev: deviceId, type: 'void', target: r.back }; events.set(v.id, v); }
    G = fold(); ui.redo = null; save().then(sync); paint();
  }
  // DNP: a late or absent player. Their first stat clears it (score-engine dnp).
  // Several at once: a sheet of the team's players with no plays yet; tick, then Save.
  const playedIds = () => new Set(G.rows.filter(r => r.type !== 'dnp').flatMap(r => [r.player, r.from]).filter(Boolean));
  function dnpMenu(t) {
    const played = playedIds();
    if (!team[t].players.some(p => !played.has(p.id))) { ui.tip = `Everyone on ${team[t].name} has a play.`; return paint(); }
    ui.dnp = { t, sel: new Set(G.dnp.filter(id => byId[id] && byId[id].team === t)) };
    ui.ask = null; paint();
  }
  function dnpSave() {
    const d = ui.dnp; if (!d) return;
    let on = 0, off = 0;
    for (const p of team[d.t].players) {
      const was = G.dnp.includes(p.id), want = d.sel.has(p.id);
      if (want !== was) { add({ type: 'dnp', team: d.t, player: p.id, on: want }); want ? on++ : off++; }
    }
    ui.dnp = null;
    ui.tip = on || off ? [on ? `${on} marked DNP` : '', off ? `${off} back on the roster` : ''].filter(Boolean).join(', ') + '. A DNP player’s first stat clears it.' : '';
    paint();
  }
  const dnpSheet = () => {
    const d = ui.dnp; if (!d) return '';
    const played = playedIds();
    const list = team[d.t].players.filter(p => !played.has(p.id));
    return `<div class="sc-sheet sc-sheet--dnp" role="dialog" aria-modal="true" aria-label="${esc(team[d.t].name)}: who didn’t play"><div class="sc-sheet__in">
      <div class="sc-sheet__h"><b>${esc(team[d.t].name)}: who didn’t play?</b><button type="button" class="sc-x" data-act="dnp-close" aria-label="Close without saving">${CLOSE}</button></div>
      <p class="sc-sheet__note">Late or absent. Players with a play already aren’t listed. If a DNP player comes in, their first stat clears it.</p>
      <div class="sc-dnp">${list.map(p => `<button type="button" data-dnp-toggle="${esc(p.id)}" aria-pressed="${d.sel.has(p.id)}">${esc(p.number ? '#' + p.number + ' ' : '')}${esc(p.short)}</button>`).join('')}</div>
      <button type="button" class="sc-dnp__save" data-act="dnp-save">Save${d.sel.size ? ` · ${d.sel.size} DNP` : ''}</button></div></div>`;
  };
  const clockMenu = () => {
    if (!keepsClock()) { ui.tip = `${keeper().name} keeps the clock.`; return paint(); }
    menu('Fix the clock', [['+5', '+5 s'], ['+1', '+1 s'], ['-1', '−1 s'], ['-5', '−5 s'], ['reset', 'Period start']], k => {
      const full = (isOvertime(G.period) ? rules.otMin : rules.periodMin) * 60;
      clockNow();
      ui.secs = k === 'reset' ? full : Math.max(0, Math.min(full, ui.secs + Number(k)));
      syncRun(); save(); paint();
    });
  };

  // ── Clock ──
  // The ask's seconds count down with its ring, without repainting the screen.
  const askTick = setInterval(() => {
    if (!document.contains(el)) return clearInterval(askTick);
    const n = root.querySelector('[data-ask-left]');
    if (n && ui.askFor) n.textContent = String(Math.max(0, Math.ceil((ASK_MS - (Date.now() - ui.askFor.at)) / 1000)));
  }, 1000);
  let lastSave = Date.now();
  const tick = setInterval(() => {
    if (!ui.running) return;
    clockNow();
    if (ui.secs <= 0) { ui.running = false; syncRun(); ui.tip = `End of ${G.period} on the clock.`; save(); paint(); return; }
    const c = root.querySelector('[data-sc-clock]'); if (c) c.textContent = clockStr();
    if (Date.now() - lastSave > 15000) { lastSave = Date.now(); save(); }
  }, 1000);
  // Back on the screen (a call, the lock screen): the clock catches up at once.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.contains(el) && ui.running) { clockNow(); paint(); } });

  // ── Drawing ──
  // Team fouls: white pips; at one from the penalty the 5th is outlined red; in the penalty all
  // red; past five, the number in red.
  const pips = t => {
    const n = G.teamFouls[t], at = rules.penaltyAt;
    if (!(at > 0)) return ''; // no penalty (Papawis): no team-foul pips
    const label = `${n} team foul${n === 1 ? '' : 's'}${G.penalty[t] ? ', in the penalty' : G.penaltyNext[t] ? ', penalty next' : ''}. Tap for the fouls`;
    // Past five: the red pips stay and the count shows beside them (refs ask for it).
    const body = `<span class="sc-pips">${Array.from({ length: at }, (_, i) => `<i class="${n >= at ? 'pen' : i < n ? 'on' : n === at - 1 && i === at - 1 ? 'next' : ''}"></i>`).join('')}</span>${n > at ? `<b class="sc-pips__n num">${n}</b>` : ''}`;
    return `<button type="button" class="sc-pipbtn" data-act="fouls" data-team="${t}" aria-label="${esc(team[t].name)}: ${label}">${body}</button>`;
  };
  const dots = t => !G.timeouts.allowance ? '' : `<span class="sc-dots" role="img" aria-label="${G.timeouts.left[t]} timeout${G.timeouts.left[t] === 1 ? '' : 's'} left">${Array.from({ length: G.timeouts.allowance }, (_, i) => `<i class="${i < G.timeouts.left[t] ? 'on' : ''}"></i>`).join('')}</span>`;
  const sideBoard = t => `<div class="sc-tm sc-tm--${t}">
      <div class="sc-tm__r"><button type="button" class="sc-tm__s" data-hold="score" aria-label="${esc(team[t].name)} ${G.score[t]}. Hold for the score by quarter"><span class="dot" style="--c:${esc(team[t].color)}"></span><span class="num">${G.score[t]}</span></button>${dots(t)}</div>
      ${pips(t)}
    </div>`;
  // Name size: long names shrink a little, then wrap; shared numbers get a bigger name. No
  // number on file: a dash holds the number's place and the name stays at the bottom, like
  // everyone else's (Paolo, 2026-10-26).
  const nameSize = p => {
    const L = (p.short || '').length || 1;
    if (p.number && shared.has(p.id)) return 13;
    return Math.max(L >= 8 ? 9.5 : 10, Math.min(11, Math.round((58 / (L * 0.62)) * 2) / 2));
  };
  // The players an open follow-up is waiting on (set at the top of every paint).
  let ansIds = null;
  const tile = id => {
    // The ring and float play once, right after the tap: a later repaint (a sync, the other
    // scorer's play) mustn't start them again.
    const p = byId[id], L = G.players[id] || {}, pf = L.pf || 0, tr = trouble(pf), hit = ui.flash && ui.flash.pid === id && Date.now() - ui.flash.at < 900;
    const benchSel = ui.sel && byId[ui.sel] && byId[ui.sel].team === p.team && !onCourt(p.team, ui.sel);
    const ans = ansIds ? (ansIds.has(id) ? 'is-ans' : 'is-dim') : '';
    const cls = ['sc-p', ui.sel === id ? 'on' : '', ans, tr === 'd' ? 'is-d' : tr === 'w' ? 'is-w' : '', shared.has(id) ? 'is-dup' : '', benchSel ? 'swap' : '',
      hit ? `ring ${ui.flash.tone} b${ui.flashN % 2} r${ui.flashN % 2}` : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" style="--c:${esc(team[p.team].color)};--fs:${nameSize(p)}" data-pick="${esc(id)}" aria-pressed="${ui.sel === id}" aria-label="${esc(short(id))}, ${pf} foul${pf === 1 ? '' : 's'}${ans === 'is-ans' ? `. Tap to answer ${esc(ui.ask.q)}` : benchSel ? `. Tap to sub ${esc(short(ui.sel))} on for them` : ''}. Hold for their line">
      <b class="sc-p__no num${p.number ? '' : ' is-none'}" aria-hidden="true">${p.number ? esc(p.number) : '–'}</b>${pf ? `<em class="sc-p__pf num${tr ? ' ' + tr : ''}" aria-hidden="true">${pf}F</em>` : ''}<span class="sc-p__nm">${esc(p.short)}</span><i class="sc-p__sw" aria-hidden="true">${SWAP}</i>${hit ? `<i class="sc-fl ${ui.flash.tone} f${ui.flashN % 2}" aria-hidden="true">${esc(ui.flash.text)}</i>` : ''}</button>`;
  };
  // The latest play by a team (for the folded side with two scorers)
  const lastOf = t => { for (let i = G.rows.length - 1; i >= 0; i--) if (G.rows[i].team === t) return G.rows[i]; return null; };
  const teamBlock = t => {
    if (!mine(t)) {
      const h = holderOf(t), r = lastOf(t);
      return `<section class="sc-team sc-team--off"><button type="button" class="sc-fold" data-act="sides" aria-label="${esc(team[t].name)}: ${h ? `${esc(h.name)} scores them` : 'nobody scores them yet'}. Sides">
        <span class="dot" style="--c:${esc(team[t].color)}"></span><span class="sc-fold__n">${esc(team[t].name)}</span>
        <span class="sc-fold__p">${r ? playText(r) : ''}</span><span class="sc-fold__w">${h ? `<i class="sc-sync__dot"></i>${esc(h.name)}` : 'Open'}</span></button></section>`;
    }
    const on = five(t);
    const dnps = team[t].players.filter(p => G.dnp.includes(p.id));
    // The bench; players who fouled out (or were ejected) go to the very end, greyed out.
    const bench = team[t].players.filter(p => !on.includes(p.id) && !G.dnp.includes(p.id));
    const rest = [...bench.filter(p => !G.flags[p.id]), ...bench.filter(p => G.flags[p.id])];
    const noSub = !rest.some(p => !G.flags[p.id]);
    return `<section class="sc-team${multi && ui.lane === t ? ' sc-team--solo' : ''}">
      <div class="sc-th"><button type="button" class="sc-th__n" data-act="teammenu" data-team="${t}" aria-label="${esc(team[t].name)}: team stats, DNP"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}${CHEV}</button>${ui.ask && ui.ask.kind === 'rebound' ? `<span class="sc-th__ans">${ui.ask.miss === t ? 'Offensive' : 'Defensive'}</span>` : ''}
        <button type="button" class="sc-tb" data-act="subq" data-team="${t}"${noSub ? ` disabled aria-label="${esc(team[t].name)}: nobody on the bench"` : ` aria-label="${esc(team[t].name)}: sub"`}>Sub</button>
</div>
      <div class="sc-five">${on.map(tile).join('')}</div>
      ${rest.length || dnps.length ? `<div class="sc-bench">${rest.map(p => {
        const out = G.flags[p.id];
        const ans = ansIds && !out ? (ansIds.has(p.id) ? ' is-ans' : ' is-dim') : '';
        return `<button type="button" class="sc-bn${out ? ' is-out' : ui.sel === p.id ? ' on' : ''}${ans}" data-pick="${esc(p.id)}"${out ? ' disabled' : ''} aria-pressed="${ui.sel === p.id}" aria-label="${esc(short(p.id))}, bench${out ? `, ${out}` : ''}">${p.number ? `<i class="num">${esc(p.number)}</i>` : ''}<s>${esc(p.short)}</s></button>`;
      }).join('')}${dnps.length ? `<button type="button" class="sc-bn is-dnp" data-act="dnp" data-team="${t}" aria-label="${dnps.length} didn’t play: ${esc(dnps.map(p => p.short).join(', '))}. Tap to change">DNP · ${dnps.length}</button>` : ''}</div>` : ''}
    </section>`;
  };
  const playText = r => {
    if (r.type === 'period_end') return r.final ? `<b>Final</b> · game over` : `<b>End of ${esc(r.period)}</b>`;
    if (r.type === 'sub') return `<b>${esc(short(r.in))}</b> on for ${esc(short(r.out))}`;
    if (r.type === 'dnp') return `<b>${esc(short(r.player))}</b> ${r.on === false ? 'back on the roster' : 'didn’t play'}`;
    if (r.type === 'move') return `<b>${esc(short(r.player))}</b> moved to ${esc(team[r.to] ? team[r.to].name : '')}`;
    if (r.type === 'setup') return `<b>Game ${esc(String(r.game || ui.game))}</b> set up · ${r.stats === 'full' ? 'Full' : 'Basic'} · ${esc(String(r.periods || 4))} × ${esc(String(r.periodMin || 10))} min`;
    const who = r.player ? short(r.player) : r.team ? team[r.team].name : 'Refs';
    const w = { shot: `${r.pts}PT ${r.made ? 'made' : 'missed'}`, ft: `FT ${r.made ? 'made' : 'missed'}`, reb: r.off ? 'offensive rebound' : 'defensive rebound', ast: 'assist', blk: 'block', stl: `steal${r.from ? ` from ${short(r.from)}` : ''}`,
      to: `turnover${r.kind ? ` · ${r.kind}` : ''}`, foul: `${r.kind && r.kind !== 'personal' ? r.kind + ' ' : ''}foul`, team_to: `team turnover${r.kind ? ` · ${r.kind}` : ''}`, team_tech: `technical · ${r.kind || 'coach'}`,
      timeout: 'timeout', stoppage: `stoppage${r.kind ? ` · ${r.kind}` : ''}`, period_end: `end of ${r.period}` }[r.type] || r.type;
    return `<b>${esc(who)}</b> ${esc(w)}`;
  };
  const scores = r => r.type === 'shot' || r.type === 'ft';

  // The question panel: in the stat buttons' place until answered or skipped.
  const optBtn = (id, attrs = 'data-ask', on = false, teamTop = false) => {
    const p = byId[id];
    return `<button type="button" class="sc-opt${on ? ' on' : ''}${teamTop ? ' sc-opt--team' : ''}"${teamTop ? ` style="--c:${esc(team[p.team].color)}"` : ''} ${attrs}="${esc(id)}" aria-pressed="${on}">${p.number ? `<b class="num">${esc(p.number)}</b>` : ''}<span>${esc(p.short)}</span></button>`;
  };
  // A follow-up is one amber line (Paolo, 2026-10-27, mockup claude.ai/artifact/JKT8xX8edkcizKXiio3Vip):
  // the players who can answer light up on the court (tile() / the bench, `ansIds`) and a tap
  // there answers. Only players with no tile on this phone (the other side folded away with two
  // scorers, a DNP) get a button in the line. extra: 2PT/3PT, Bench.
  const HINTS = { rebound: 'Tap who got it', ast: 'Tap who passed', lost: 'Tap who lost it', blocked: 'Tap the shooter', andone: 'Tap who fouled', wentoff: 'Tap who went off', foulout: 'Tap who comes on' };
  const hasTile = id => { const p = byId[id]; return !!p && mine(p.team) && !G.dnp.includes(id); };
  const followUp = (a, extra = '') => {
    if (!a.at) a.at = Date.now();
    const ms = followMs(a), timed = !a.noTimer && !calm(), gone = Math.min(ms, Date.now() - a.at);
    // Off this phone's court (folded side, DNP) or scrolled out of sight (a small phone: tidyAnswers).
    const loose = followOpts(a).filter(id => !hasTile(id) || (a.loose || []).includes(id));
    return `<div class="sc-q sc-q--line${timed ? ' sc-q--timed' : ''}" role="group" aria-label="${esc(a.q)} ${esc(HINTS[a.kind] || 'Tap a player')}. Optional"><div class="sc-q__h"><b>${esc(a.q)}</b><small class="sc-q__hint">${esc(HINTS[a.kind] || 'Tap a player')}</small><span class="sc-q__sp"></span>${extra}<button type="button" class="sc-q__skip" data-ask="">${esc(a.skip)}</button></div>
      ${loose.length ? `<div class="sc-q__opts">${loose.map(id => optBtn(id)).join('')}</div>` : ''}${timed ? `<i class="sc-q__timer" style="animation-duration:${ms}ms;animation-delay:-${gone}ms" aria-hidden="true"></i>` : ''}</div>`;
  };
  function question() {
    const a = ui.ask;
    if (a && a.kind === 'fp') {
      const L = (a.pid && G.players[a.pid]) || {}, pf = L.pf || 0, tr = trouble(pf);
      const shooters = a.foulKind === 'technical' || a.bench ? team[a.o].players.filter(p => !G.flags[p.id]).map(p => p.id) : five(a.o);
      const st = G.penalty[a.team] && a.foulKind !== 'technical' ? '<span class="sc-q__pen num">IN THE PENALTY</span>' : '';
      const fts = Array.from({ length: a.n }, (_, i) => {
        const done = i < a.done;
        return `<span class="sc-ft__l num">FT${i + 1}</span>${done ? `<span class="sc-ft__done${a.res[i] ? ' good' : ' bad'}">${a.res[i] ? 'Made' : 'Missed'}</span>`
          : `<button type="button" class="sc-st sc-st--made" data-fpft="1"${!a.shooter || i !== a.done ? ' disabled' : ''} aria-label="Free throw ${i + 1} made">${CHECK}</button><button type="button" class="sc-st sc-st--miss" data-fpft="0"${!a.shooter || i !== a.done ? ' disabled' : ''} aria-label="Free throw ${i + 1} missed">${CLOSE}</button>`}`;
      }).join('');
      return `<div class="sc-q" role="group" aria-label="Foul and free throws">
        <div class="sc-q__h"><b>${a.pid ? `Foul · ${esc(short(a.pid))}` : `Technical · ${esc(a.who || 'coach')}`}</b>${a.pid ? `<span class="sc-q__o${tr ? ' ' + tr : ''}">${ordinal(pf)}</span>` : ''}${st}<span class="sc-q__sp"></span><button type="button" class="sc-x" data-fpclose aria-label="${a.n && a.done < a.n ? 'Close without the free throws' : 'Close'}">${CLOSE}</button></div>
        <div class="sc-q__row">${[0, 1, 2, 3].map(n => `<button type="button" class="sc-ftc num${a.n === n ? ' on' : ''}" data-fpn="${n}" aria-pressed="${a.n === n}" aria-label="${n} free throw${n === 1 ? '' : 's'}"${a.done ? ' disabled' : ''}>${n}</button>`).join('')}<span class="sc-q__sp"></span><button type="button" class="sc-ftc sc-ftc--txt${a.andOne ? ' on' : ''}" data-fpand aria-pressed="${a.andOne}"${a.done ? ' disabled' : ''}>And-one</button></div>
        ${a.n && !a.shooter ? `<p class="sc-q__hint">Who shoots? Tap them here or on the court.</p>` : ''}
        ${a.n ? `<div class="sc-q__opts sc-q__opts--6">${shooters.map(id => optBtn(id, 'data-fpsh', a.shooter === id)).join('')}${a.foulKind === 'technical' || a.bench ? '' : '<button type="button" class="sc-opt sc-opt--more" data-fpbench>Bench</button>'}</div>
        <div class="sc-ft" style="--n:${a.n}">${fts}</div>` : ''}
      </div>`;
    }
    // Assisted?: Bench lights the bench instead of the four teammates.
    if (a && a.kind === 'ast') return followUp(a, a.bench ? '' : '<button type="button" class="sc-q__chip" data-astbench>Bench</button>');
    // Rebound?: all ten light up; the team headers say which side is offensive (tile()).
    if (a && a.kind === 'rebound') return followUp(a);
    if (a && (a.kind === 'lost' || a.kind === 'wentoff' || a.kind === 'blocked' || a.kind === 'andone' || a.kind === 'foulout')) {
      const pts = a.kind === 'blocked' ? [2, 3].map(n => `<button type="button" class="sc-q__chip num${a.pts === n ? ' on' : ''}" data-blkpts="${n}" aria-pressed="${a.pts === n}">${n}PT</button>`).join('') : '';
      return followUp(a, pts);
    }
    if (a && a.kind === 'menu') {
      const chips = opts => `<div class="sc-menu">${opts.map(o => `<button type="button" class="${o.def ? 'def' : ''}" data-ask="${esc(o.id)}"${String(o.id).startsWith('wait:') ? ' disabled' : ''}>${esc(o.label)}</button>`).join('')}</div>`;
      return `<div class="sc-q sc-q--menu" role="group" aria-label="${esc(a.q)}"><div class="sc-q__h"><b>${esc(a.q)}</b><span class="sc-q__sp"></span><button type="button" class="sc-x" data-ask="__cancel" aria-label="Close">${CLOSE}</button></div>
        ${a.groups ? a.groups.map(g => `<div class="sc-mg"><span class="sc-mg__l">${esc(g.group)}</span>${chips(g.opts)}</div>`).join('') : chips(a.opts)}</div>`;
    }
    if (multi && !ui.lane && !ui.locked) {
      // Asked for a side: waiting for the answer, with a way to stop asking.
      if (ui.asked) return `<div class="sc-q sc-q--wait" role="status"><div class="sc-q__h"><span class="sc-spin" aria-hidden="true"></span><b>Asked ${esc(ui.asked)}. Waiting for them to hand it over…</b></div>
        <div class="sc-menu"><button type="button" data-act="ask-cancel">Stop asking</button></div></div>`;
      const full = twoIn() && ['a', 'b', 'both'].every(l => sideState(l).act === 'wait');
      return `<div class="sc-q" role="group"><div class="sc-q__h"><b>${full ? 'Two scorers are already in (the most a game takes). You’re watching; if one’s phone goes quiet for 2 minutes, you can take over.' : ui.lanes && ui.lanes.others.length ? `${esc(ui.lanes.others.filter(o => o.lane).map(o => `${o.name} scores ${sideName(o.lane)}`).join(', ') || 'Someone is here')}. Which side do you score?` : 'Which side do you score?'}</b></div>
        <div class="sc-menu">${(full ? ['a', 'b'] : ['a', 'b', 'both']).filter(l => l !== 'both' || full || sideState('both').act !== 'ask').map(l => { const st = sideState(l); return `<button type="button" data-side="${l}" data-holder="${esc(st.act === 'ask' ? st.holder : '')}"${st.act === 'wait' ? ' disabled' : ''}>${esc(st.label)}</button>`; }).join('')}${ui.lanes && ui.lanes.admin ? '<button type="button" data-act="sides">Take over…</button>' : ''}</div></div>`;
    }
    return '';
  }
  // Banners over the stat buttons (which stay): another scorer asking for this phone's side
  // (the answer shows on its button until the server has it), or the other scorer gone.
  // Alerts from the other scorer, in an amber bar at the top (mockup B, Paolo 2026-10-26):
  // someone asking for this phone's side (a ring counts down ASK_MS, then it's a no; the tapped
  // answer shows on its button until the server has it), or the other scorer gone.
  const avatar = ini => `<span class="sc-alert__av num">${esc(ini || '?')}</span>`;
  function alertBar() {
    if (ui.confirm) {
      const c = ui.confirm;
      return `<div class="sc-alert" role="alertdialog" aria-label="${esc(c.title)}">
        <div class="sc-alert__r"><span class="sc-alert__ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[c.icon] || ICONS.flag}"/></svg></span><span class="sc-alert__t"><b>${esc(c.title)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span></div>
        <div class="sc-alert__b"><button type="button" class="sc-alert__no" data-act="confirm-no">${esc(c.no || 'Not yet')}</button><button type="button" class="sc-alert__yes" data-act="confirm-yes">${esc(c.yes)}</button></div></div>`;
    }
    if (ui.leaving) {
      return `<div class="sc-alert" role="alertdialog" aria-label="${esc(ui.leaving.title)}">
        <div class="sc-alert__r"><span class="sc-alert__t"><b>${esc(ui.leaving.title)}</b><small>${esc(ui.leaving.sub)}</small></span></div>
        <div class="sc-alert__b"><button type="button" class="sc-alert__no" data-act="leave-stay">Stay</button><button type="button" class="sc-alert__yes" data-act="leave-go">Leave</button></div></div>`;
    }
    if (!multi || ui.locked) return '';
    if (ui.lanes && ui.lanes.asks.length && ui.lane) {
      const k = ui.lanes.asks[0], h = ui.handing, side = sideName(k.lane);
      const keep = ui.lane === 'both' && k.lane !== 'both' ? sideName(other(k.lane)) : '';
      const at = ui.askFor && ui.askFor.device === k.device ? ui.askFor.at : Date.now();
      const gone = Math.min(ASK_MS, Date.now() - at), left = Math.max(0, Math.ceil((ASK_MS - gone) / 1000));
      return `<div class="sc-alert" role="alertdialog" aria-label="${esc(k.name)} asks to score ${esc(side)}">
        <div class="sc-alert__r">
          <span class="sc-alert__ring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" class="sc-alert__track"/><circle cx="24" cy="24" r="22" class="sc-alert__left" style="animation-duration:${ASK_MS}ms;animation-delay:-${gone}ms"/></svg>${avatar(k.ini)}</span>
          <span class="sc-alert__t"><b>${esc(k.name)} asks to score ${esc(side)}</b><small>${keep ? `You’d keep scoring ${esc(keep)}.` : 'You’d stop scoring.'} No answer in <span data-ask-left>${left}</span> s = no.</small></span>
        </div>
        <div class="sc-alert__b">
          <button type="button" class="sc-alert__no${h === 'no' ? ' is-busy' : ''}" data-handover="${esc(k.device)}"${h ? ' disabled' : ''}>${h === 'no' ? '<span class="sc-spin" aria-hidden="true"></span>Saying no…' : `No, I’ll keep ${esc(side)}`}</button>
          <button type="button" class="sc-alert__yes${h === 'yes' ? ' is-busy' : ''}" data-handover="${esc(k.device)}" data-yes="1"${h ? ' disabled' : ''}>${h === 'yes' ? '<span class="sc-spin" aria-hidden="true"></span>Handing over…' : `Let ${esc(k.name)} score ${esc(side)}`}</button>
        </div></div>`;
    }
    if (ui.alone && ui.lane && ui.lane !== 'both') {
      const o = sideName(other(ui.lane));
      return `<div class="sc-alert" role="alertdialog" aria-label="${esc(ui.alone.name)} ${ui.alone.why === 'left' ? 'left the game' : 'has gone quiet'}">
        <div class="sc-alert__r">
          <span class="sc-alert__ring is-gone">${avatar(ui.alone.ini)}<i class="sc-alert__badge">${EXIT_ICON}</i></span>
          <span class="sc-alert__t"><b>${ui.alone.why === 'left' ? `${esc(ui.alone.name)} left the game` : `${esc(ui.alone.name)}’s phone has gone quiet`}</b><small>Nobody is scoring ${esc(o)} now.</small></span>
          <button type="button" class="sc-x" data-act="alone-no" aria-label="Not now">${CLOSE}</button>
        </div>
        <button type="button" class="sc-alert__yes" data-act="alone-both">Score ${esc(o)} too (both teams)</button></div>`;
    }
    return '';
  }
  const pad = () => {
    const arm = k => (ui.arm && ui.arm.key === k ? ' arm' : '');
    const lab = p => (p === 1 ? 'FT' : p + 'PT');
    // Papawis Basic: makes only, then REB and AST. One tap per play, no follow-ups.
    if (basic()) return `<div class="sc-pad sc-pad--${shots.length} sc-pad--basic">
        ${shots.map(p => `<button type="button" class="sc-st sc-st--made${arm(`s${p}m`)}" data-shot="${p}" data-made="1" aria-pressed="${!!arm(`s${p}m`)}" aria-label="${lab(p)} made">${lab(p)}</button>`).join('')}
      </div>
      <div class="sc-pad sc-pad--2">
        <button type="button" class="sc-st${ui.arm && /^reb/.test(ui.arm.key) ? ' arm' : ''}" data-act="reb" aria-label="Rebound">REB</button>
        <button type="button" class="sc-st${arm('ast')}" data-act="ast" aria-label="Assist">AST</button>
      </div>`;
    return `<div class="sc-pad sc-pad--${shots.length}">
        ${shots.map(p => `<button type="button" class="sc-st sc-st--made${p > 1 ? ' up' : ''}${arm(`s${p}m`) || arm(`s${p}a`)}" data-shot="${p}" data-made="1" aria-pressed="${!!(arm(`s${p}m`) || arm(`s${p}a`))}" aria-label="${lab(p)} made${p > 1 ? '. Swipe up for and-one' : ''}">${lab(p)}</button>`).join('')}
        ${shots.map(p => `<button type="button" class="sc-st sc-st--miss${arm(`s${p}x`)}" data-shot="${p}" aria-pressed="${!!arm(`s${p}x`)}" aria-label="${lab(p)} missed">${lab(p)}</button>`).join('')}
      </div>
      <div class="sc-pad sc-pad--6">
        <button type="button" class="sc-st hold${ui.arm && /^reb/.test(ui.arm.key) ? ' arm' : ''}" data-hold="reb" aria-label="Rebound: offensive or defensive is worked out. Hold to pick">REB</button>
        <button type="button" class="sc-st${arm('ast')}" data-act="ast" aria-label="Assist">AST</button>
        <button type="button" class="sc-st${arm('stl')}" data-act="stl" aria-label="Steal">STL</button>
        <button type="button" class="sc-st${arm('blk')}" data-act="blk" aria-label="Block">BLK</button>
        <button type="button" class="sc-st sc-st--warn hold${ui.arm && /^to/.test(ui.arm.key) ? ' arm' : ''}" data-hold="to" aria-label="Turnover. Hold for the kind">TO</button>
        <button type="button" class="sc-st sc-st--warn hold${ui.arm && /^pf/.test(ui.arm.key) ? ' arm' : ''}" data-hold="pf" aria-label="Foul. Hold for other fouls">FOUL</button>
      </div>`;
  };
  // The last play: always there, with Undo (this phone's own plays) and Fix.
  function lastRow() {
    if (ui.after) {
      const r = G.rows.find(x => x.id === ui.after);
      return `<div class="sc-last is-after" role="status"><span class="sc-last__w">Adding after: ${r ? playText(r) : ''}</span><button type="button" class="sc-lb" data-act="insert-done">Done</button></div>`;
    }
    const mineRows = G.rows.filter(r => !r.dev || r.dev === deviceId);
    const r = mineRows[mineRows.length - 1];
    // Just undone: Redo, and Undo again for the play before it (two in a row).
    if (ui.redo) {
      return `<div class="sc-last" role="status"><span class="sc-last__w">Undone: ${ui.redoText || ''}</span><button type="button" class="sc-lb sc-lb--amber" data-act="redo">Redo</button>${r && !ui.locked ? `<button type="button" class="sc-lb" data-undo="${esc(r.id)}" aria-label="Undo the play before: ${esc(playText(r).replace(/<[^>]+>/g, ''))}">Undo</button>` : ''}</div>`;
    }
    if (!r) return `<div class="sc-last is-empty" role="status"><span class="sc-last__w">No plays yet</span></div>`;
    const fresh = r.id !== ui.lastShown; ui.lastShown = r.id;
    return `<div class="sc-last${fresh ? ' is-fresh' : ''}" role="status"><i class="sc-last__ok" aria-hidden="true">${CHECK}</i><span class="sc-last__w">${playText(r)}${scores(r) ? ` <span class="num sc-last__s">· ${r.score.a}–${r.score.b}</span>` : ''}</span>${ui.locked ? '' : `<button type="button" class="sc-lb sc-lb--amber" data-undo="${esc(r.id)}" aria-label="Undo: ${esc(playText(r).replace(/<[^>]+>/g, ''))}">Undo</button><button type="button" class="sc-lb" data-fix="${esc(r.id)}" aria-label="Fix this play">Fix</button>`}</div>`;
  }

  // ── The Scoresheet: Box score · Play-by-play · Fouls ──
  const TABS = [['box', 'Box score'], ['plays', 'Play-by-play'], ['fouls', 'Fouls']];
  const teamTabs = (kind) => `<div class="sc-ttabs" role="tablist" aria-label="Team">${['a', 'b'].map(t => {
    const n = kind === 'fouls' ? G.teamFouls[t] : G.score[t];
    const red = kind === 'fouls' && (G.penalty[t] || G.penaltyNext[t]);
    return `<button type="button" role="tab" class="sc-ttab${ui.sheetTeam === t ? ' on' : ''}" aria-selected="${ui.sheetTeam === t}" data-steam="${t}"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)} <b class="num${red ? ' red' : ''}">${n}</b></button>`;
  }).join('')}</div>`;
  function boxTab() {
    const t = ui.sheetTeam, on = new Set(five(t)), played = playedIds();
    const fg = L => [L.fg2m + L.fg3m + L.fg4m, L.fg2m + L.fg3m + L.fg4m + L.fg2m_miss + L.fg3m_miss + L.fg4m_miss];
    const players = team[t].players.filter(p => on.has(p.id) || played.has(p.id));
    const dnps = team[t].players.filter(p => G.dnp.includes(p.id));
    const tot = {}; for (const k of ['pts', 'pf', 'reb', 'ast', 'stl', 'blk', 'turnover', 'fg2m', 'fg3m', 'fg4m', 'fg2m_miss', 'fg3m_miss', 'fg4m_miss', 'ftm', 'ft_miss']) tot[k] = 0;
    const row = p => {
      const L = G.players[p.id] || {}; for (const k in tot) tot[k] += L[k] || 0;
      const z = k => L[k] || 0, [m, a] = fg({ fg2m: z('fg2m'), fg3m: z('fg3m'), fg4m: z('fg4m'), fg2m_miss: z('fg2m_miss'), fg3m_miss: z('fg3m_miss'), fg4m_miss: z('fg4m_miss') });
      const tr = trouble(z('pf'));
      return `<tr><td><span class="sc-bx__n"><i class="${on.has(p.id) ? 'on' : ''}"></i>${esc(short(p.id))}</span></td><td><b>${z('pts')}</b></td><td class="${tr === 'd' ? 'red' : tr === 'w' ? 'strong' : ''}">${z('pf')}</td><td>${z('reb')}</td><td>${z('ast')}</td><td>${z('stl')}</td><td>${z('blk')}</td><td>${z('turnover')}</td><td>${m}-${a}</td><td>${z('fg3m')}-${z('fg3m') + z('fg3m_miss')}</td><td>${z('ftm')}-${z('ftm') + z('ft_miss')}</td></tr>`;
    };
    const body = players.map(row).join('');
    const [tm, ta] = fg(tot);
    return `${teamTabs('box')}<div class="sc-bx"><table><thead><tr><th>PLAYER</th><th>PTS</th><th>PF</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>FT</th></tr></thead><tbody>
      ${body}${dnps.map(p => `<tr class="dnp"><td><span class="sc-bx__n"><i></i>${esc(short(p.id))}</span></td><td colspan="10">DNP</td></tr>`).join('')}
      <tr class="tot"><td><span class="sc-bx__n"><i></i>Team</span></td><td><b>${G.score[t]}</b></td><td>${tot.pf}</td><td>${tot.reb}</td><td>${tot.ast}</td><td>${tot.stl}</td><td>${tot.blk}</td><td>${tot.turnover}</td><td>${tm}-${ta}</td><td>${tot.fg3m}-${tot.fg3m + tot.fg3m_miss}</td><td>${tot.ftm}-${tot.ftm + tot.ft_miss}</td></tr>
    </tbody></table></div>`;
  }
  function playsTab() {
    const f = ui.filter;
    const keep = r => f === 'all' || (f === 'a' || f === 'b' ? r.team === f : f === 'scoring' ? scores(r) && r.made : r.type === 'foul' || r.type === 'team_tech');
    const rows = G.rows.filter(keep).slice().reverse();
    const chips = [['all', 'All'], ['a', team.a.name], ['b', team.b.name], ['scoring', 'Scoring'], ['fouls', 'Fouls']].map(([k, l]) => `<button type="button" class="sc-chip${f === k ? ' on' : ''}" data-filter="${k}" aria-pressed="${f === k}">${k === 'a' || k === 'b' ? `<span class="dot" style="--c:${esc(team[k].color)}"></span>` : ''}${esc(l)}</button>`).join('');
    let cur = null;
    const out = rows.map(r => {
      const head = r.period !== cur ? (cur = r.period, `<div class="sc-pbp__h num"><span>${esc(r.period)}</span><span>${(G.byPeriod.find(x => x.period === r.period) || { a: 0, b: 0 }).a}–${(G.byPeriod.find(x => x.period === r.period) || { a: 0, b: 0 }).b} in ${esc(r.period)}</span></div>`) : '';
      return `${head}<button type="button" class="sc-pbp__r" data-fix="${esc(r.id)}" aria-label="${esc(playText(r).replace(/<[^>]+>/g, ''))}. Fix"><span class="sc-pbp__t num">${esc(r.clock || '')}</span>${r.team ? `<span class="dot" style="--c:${esc(team[r.team].color)}"></span>` : '<span></span>'}<span class="sc-pbp__w">${playText(r)}${r.fixes ? ` <small class="sc-pbp__by">fixed${r.by ? ` by ${esc(r.by)}` : ''}</small>` : r.by && r.dev !== deviceId && multi ? ` <small class="sc-pbp__by">${esc(r.by)}</small>` : ''}</span><span class="sc-pbp__s num${scores(r) && r.made ? ' on' : ''}">${scores(r) && r.made ? `${r.score.a}–${r.score.b}` : ''}</span></button>`;
    }).join('');
    return `<div class="sc-chips">${chips}</div><div class="sc-pbp">${out || '<p class="sc-empty">No plays yet.</p>'}</div>`;
  }
  function foulsTab() {
    const t = ui.sheetTeam, on = new Set(five(t));
    const rows = team[t].players.map(p => ({ p, pf: (G.players[p.id] || {}).pf || 0, on: on.has(p.id) }))
      .filter(x => x.pf || x.on).sort((x, y) => y.pf - x.pf || (y.on - x.on));
    const tech = team[t].players.reduce((n, p) => n + ((G.players[p.id] || {}).tech || 0), 0);
    const outs = team[t].players.filter(p => G.flags[p.id]).length;
    return `${teamTabs('fouls')}<div class="sc-fls">${rows.map(({ p, pf, on: o }) => {
      const tr = trouble(pf), note = G.flags[p.id] ? G.flags[p.id] : rules.foulOut > 0 && pf === rules.foulOut - 1 ? 'one more and out' : o ? '' : 'bench';
      return `<div class="sc-fl__r"><span class="sc-fl__top"><i class="${o ? 'on' : ''}"></i><b>${esc(short(p.id))}</b><small>${esc(note)}</small><span class="num sc-fl__c ${tr}">${pf} PF</span></span><span class="sc-fl__bar"><i class="${tr === 'd' ? 'd' : ''}" style="width:${Math.min(100, (pf / (rules.foulOut > 0 ? rules.foulOut : 6)) * 100)}%"></i></span></div>`;
    }).join('') || '<p class="sc-empty">No fouls yet.</p>'}</div>
      <div class="sc-fls__sum"><span>Technicals <b>${tech}</b></span><span>Fouled out <b>${outs}</b></span></div>`;
  }
  const sheetBody = tab => (tab === 'plays' ? playsTab() : tab === 'fouls' ? foulsTab() : boxTab());
  const sheetTabs = (tab, attr) => `<div class="sc-stabs" role="tablist" aria-label="Scoresheet">${TABS.map(([k, l]) => `<button type="button" role="tab" class="sc-stab${tab === k ? ' on' : ''}" aria-selected="${tab === k}" ${attr}="${k}">${l}</button>`).join('')}</div>`;

  // The player of the game so far: the site's rating (server.js derivePotgPlayerId), winning
  // team only; nobody while it's tied.
  function potgLeader() {
    if (G.score.a === G.score.b) return null;
    const win = G.score.a > G.score.b ? 'a' : 'b';
    let best = null, bestV = -Infinity;
    for (const [id, L] of Object.entries(G.players)) {
      if (!byId[id] || byId[id].team !== win) continue;
      const z = k => L[k] || 0, fgm = z('fg2m') + z('fg3m') + z('fg4m'), fga = fgm + z('fg2m_miss') + z('fg3m_miss') + z('fg4m_miss');
      const v = z('pts') + 0.4 * fgm - 0.7 * fga - 0.4 * z('ft_miss') + 0.7 * z('reb') + z('stl') + 0.7 * z('ast') + 0.7 * z('blk') - 0.4 * z('pf') - z('turnover');
      if (v > bestV) { bestV = v; best = id; }
    }
    return best;
  }
  // Hold popovers: the score by quarter, a player's line.
  function peek() {
    if (!ui.peek) return '';
    if (ui.peek === 'score') {
      const ps = G.byPeriod.length ? G.byPeriod : [{ period: G.period, a: 0, b: 0 }];
      const cols = Math.max(4, ps.length);
      const per = Array.from({ length: cols }, (_, i) => ps[i] || { period: i < 4 ? `Q${i + 1}` : `OT${i - 3}`, a: null, b: null });
      return `<div class="sc-peek" data-act="peek-close"><div class="sc-pop" role="dialog" aria-label="Score by quarter" style="--cols:${cols}">
        <span></span>${per.map(p => `<span class="sc-pop__h num">${esc(p.period)}</span>`).join('')}<span class="sc-pop__h num">T</span>
        ${['a', 'b'].map(t => `<span class="sc-pop__t"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}</span>${per.map(p => `<span class="num${p[t] == null ? ' dim' : ''}">${p[t] == null ? '–' : p[t]}</span>`).join('')}<b class="num">${G.score[t]}</b>`).join('')}
      </div></div>`;
    }
    // A player's line, in the player of the game card's look: their photo on a team ring,
    // points big, then every number on its own tile.
    const p = byId[ui.peek]; if (!p) return '';
    const L = G.players[p.id] || {}, z = k => L[k] || 0;
    const m = z('fg2m') + z('fg3m') + z('fg4m'), a = m + z('fg2m_miss') + z('fg3m_miss') + z('fg4m_miss');
    const ini = String(p.name || p.short).split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    // Fouls on a strip of pips (red in foul trouble for the quarter), and their last play
    // with Fix: a scorer often holds a player because they're unsure what they just gave them.
    const tr = trouble(z('pf'));
    let lastP = null;
    for (let i = G.rows.length - 1; i >= 0 && !lastP; i--) { const r = G.rows[i]; if (r.player === p.id || r.in === p.id) lastP = r; }
    return `<div class="sc-peek" data-act="peek-close"><div class="sc-pop sc-pop--p" role="dialog" aria-label="${esc(short(p.id))}, this game">
      <div class="sc-pc">
        <span class="sc-pc__avw"><span class="avatar sc-pc__av" style="--ring:${esc(team[p.team].color)}">${esc(ini)}${p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.remove()">` : ''}</span>${potgLeader() === p.id ? '<i class="sc-pc__star" aria-label="Player of the game so far">★</i>' : ''}</span>
        <span class="sc-pc__who"><small class="num">${p.number ? `#${esc(p.number)} · ` : ''}${esc(team[p.team].name)} · ${onCourt(p.team, p.id) ? 'on court' : 'bench'}</small><b>${esc(p.name)}</b>
          <span class="sc-pc__fouls ${tr}"${basic() || !(rules.foulOut > 0) ? ' hidden' : ''} role="img" aria-label="${z('pf')} of ${rules.foulOut} fouls${tr === 'd' ? ', in foul trouble' : ''}">${Array.from({ length: rules.foulOut }, (_, i) => `<i class="${i < z('pf') ? 'on' : ''}"></i>`).join('')}</span></span>
        <span class="sc-pc__pts${z('pts') ? ' pos' : ''}"><b class="num">${z('pts')}</b><small class="num">PTS</small></span>
      </div>
      ${basic() ? `<div class="sc-pop__line sc-pop__line--3">${[['REB', z('reb')], ['AST', z('ast')], ['3PT', z('fg3m')]].map(([k, v]) => `<span class="${v ? 'pos' : 'zero'}"><b class="num">${v}</b><small class="num">${k}</small></span>`).join('')}</div>`
        : `<div class="sc-pop__line">${[['REB', z('reb'), 'pos'], ['AST', z('ast'), 'pos'], ['STL', z('stl'), 'pos'], ['BLK', z('blk'), 'pos'], ['TO', z('turnover'), 'neg'], ['PF', z('pf'), 'neg']].map(([k, v, t]) => `<span class="${v ? t : 'zero'}"><b class="num">${v}</b><small class="num">${k}</small></span>`).join('')}</div>
      <div class="sc-pop__line sc-pop__line--3">${[['FG', m, a], ['3PT', z('fg3m'), z('fg3m') + z('fg3m_miss')], ['FT', z('ftm'), z('ftm') + z('ft_miss')]].map(([k, made, att]) => `<span><b class="num">${made}-${att}</b><small class="num">${k}${att ? ` · ${Math.round((made / att) * 100)}%` : ''}</small></span>`).join('')}</div>`}
      ${pw && !ui.locked && !G.final ? `<button type="button" class="sc-move" data-act="move" data-pid="${esc(p.id)}"><span class="dot" style="--c:${esc(team[other(p.team)].color)}"></span>Move to ${esc(team[other(p.team)].name)}</button>
      <p class="sc-move__n">His ${z('pts')} point${z('pts') === 1 ? '' : 's'} so far stay with ${esc(team[p.team].name)}. Undo works like any play.</p>` : ''}
      ${lastP ? `<div class="sc-pc__last"><span>Last: ${playText(lastP).replace(/<b>[^<]*<\/b>\s*/, '')}${lastP.period ? ` <span class="num">· ${esc(lastP.period)}${lastP.clock ? ' ' + esc(lastP.clock) : ''}</span>` : ''}</span>${ui.locked ? '' : `<button type="button" class="sc-lb" data-fix="${esc(lastP.id)}">Fix</button>`}</div>` : ''}
    </div></div>`;
  }

  function paint() {
    if (swipe || (slide && slide.live)) { (swipe || slide).pending = true; return; }
    const keep = ['.sc-sheet__b', '.sc-dock__b'].map(sel => { const n = root.querySelector(sel); return n ? [sel, n.scrollTop] : null; }).filter(Boolean);
    paintNow();
    tableSend();
    fitNames();
    for (const [sel, top] of keep) { const n = root.querySelector(sel); if (n) n.scrollTop = top; }
    tidyAnswers();
  }
  // A small phone (667pt) can't show both teams: a lit player scrolled out of sight gets a button
  // in the follow-up line instead, so every answer is on screen (Fable review, 2026-10-27). The
  // line growing can hide more tiles, so it measures again, a few times at most.
  function tidyAnswers(pass = 0) {
    const a = ui.ask, area = root.querySelector('.sc-teams');
    if (!ansIds || !a || !area || pass > 2) return;
    const box = area.getBoundingClientRect();
    const hidden = [...root.querySelectorAll('.sc-p.is-ans, .sc-bn.is-ans')].filter(el => { const r = el.getBoundingClientRect(); return r.top < box.top - 1 || r.bottom > box.bottom + 1; }).map(el => el.getAttribute('data-pick'));
    const add = hidden.filter(id => !(a.loose || []).includes(id));
    if (!add.length) return;
    a.loose = [...(a.loose || []), ...add];
    paintNow(); fitNames(); tidyAnswers(pass + 1);
  }
  // A one-word name too wide for its tile (CONTIGNO with a shared number, at the bigger size)
  // can't wrap: it shrinks until it fits, down to 8px (Paolo, 2026-10-26).
  function fitNames() {
    for (const el of root.querySelectorAll('.sc-p__nm')) {
      let px = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && px > 8) { px -= 0.5; el.style.fontSize = px + 'px'; }
    }
  }
  root.addEventListener('input', e => {
    const f = e.target.closest && e.target.closest('[data-fin-score]'); if (!f || !ui.fin) return;
    ui.fin[f.getAttribute('data-fin-score')] = Math.max(0, Math.min(300, parseInt(f.value, 10) || 0));
    const btn = root.querySelector('[data-act="court-publish"]'); if (btn) btn.disabled = !!unsent().length || ui.fin.a === ui.fin.b || ui.publishing;
  });
  root.addEventListener('change', e => { if (e.target.closest && e.target.closest('[data-fin-score]')) paint(); });
  root.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-su-guest]') && ui.draft) ui.draft.guestName = e.target.value; });
  // Turning the phone resizes the tiles: fit again from the usual size.
  window.addEventListener('resize', () => { for (const el of root.querySelectorAll('.sc-p__nm')) el.style.fontSize = ''; fitNames(); });
  // Game over: in the stat buttons' place, what happens next (Paolo, 2026-10-26: nothing did).
  // Every play has to reach the server first. A review: Publish (the site's publish route, the
  // track on this screen) and Back to the game. A scorer at the court: an admin publishes it.
  // Undo on the last play reopens the game; the Scoresheet still fixes plays.
  function overPanel() {
    const n = unsent().length, all = list().length;
    if (pw) return pwOverPanel(n, all);
    const O0 = B.over || {};
    if (O0.finish && !ui.locked && !ui.published) return courtPanel(n, all);
    const sendLine = ui.published ? esc(ui.published)
      : n ? `${n} play${n === 1 ? '' : 's'} still sending${ui.sync === 'offline' ? ': waiting for signal' : ui.sync === 'error' && ui.syncMsg ? `: ${esc(ui.syncMsg)}` : '…'}`
      : `All ${all} play${all === 1 ? '' : 's'} saved.`;
    const O = B.over || {};
    const back = O.back ? `<a class="sc-over__btn sc-over__btn--ghost" href="${esc(O.back)}">${practice ? 'Back to practice' : O.review ? 'Back to the game' : 'Back to games'}</a>` : '';
    // Saved: the next step, the POTG and the recap (the site's Content tab).
    const acts = ui.published && ui.next ? `<a class="sc-over__btn" href="${esc(ui.next)}">Finish the game</a>${back}`
      : ui.locked || ui.published ? back
      : O.publish ? `<button type="button" class="sc-over__btn" data-act="publish"${n || ui.publishing ? ' disabled' : ''}>${ui.publishing ? 'Saving…' : 'Save the box score'}</button>${back}`
      : back;
    const note = ui.published ? (O.publish ? 'Next: the POTG and the recap.' : '') : ui.locked ? '' : O.publish ? (n ? 'Every play has to be saved first.' : `The stats go on the site and in the app${O.liveOff ? ' once Visible to everyone is on' : ''}. The POTG and the recap come next.`)
      : 'An admin checks the plays and saves the box score.';
    return `<div class="sc-over" role="status"><div class="sc-over__h"><b>Game over</b><span class="num">${esc(team.a.name)} ${G.score.a}–${G.score.b} ${esc(team.b.name)}</span></div>
      <p class="sc-over__s${n && !ui.published ? ' is-wait' : ''}">${sendLine}</p>${note ? `<p class="sc-over__n">${note}</p>` : ''}
      <div class="sc-over__b">${acts}</div></div>`;
  }
  // A live game at the court (Paolo, 2026-10-26): the scorer keeping the clock sets the final
  // score (from the plays, fixable) and taps the player of the game, then publishes. The box
  // score shows at once, tagged "Stats pending review" until a games admin checks it; the recap
  // and write-ups stay with the admins. The other scorer's phone just waits for it.
  // The site's PER (views/admin/game.js perOf), on the plays' lines.
  const perOf = L => { const fgm = (L.fg2m || 0) + (L.fg3m || 0) + (L.fg4m || 0), fga = fgm + (L.fg2m_miss || 0) + (L.fg3m_miss || 0) + (L.fg4m_miss || 0);
    return (L.pts || 0) + 0.4 * fgm - 0.7 * fga - 0.4 * (L.ft_miss || 0) + 0.7 * (L.reb || 0) + (L.stl || 0) + 0.7 * (L.ast || 0) + 0.7 * (L.blk || 0) - (L.turnover || 0); };
  const finWinner = () => (ui.fin.a > ui.fin.b ? 'a' : ui.fin.b > ui.fin.a ? 'b' : '');
  const finCands = t => (t ? team[t].players.map(p => p.id).filter(id => G.players[id]).sort((x, y) => perOf(G.players[y]) - perOf(G.players[x])).slice(0, 5) : []);
  function courtPanel(n, all) {
    const O = B.over;
    const k = keeper();
    const head = `<div class="sc-over__h"><b>Game over</b><span class="num">${esc(team.a.name)} ${G.score.a}–${G.score.b} ${esc(team.b.name)}</span></div>`;
    if (multi && k && !k.me) return `<div class="sc-over" role="status">${head}<p class="sc-over__s">${n ? `${n} play${n === 1 ? '' : 's'} still sending…` : `All ${all} play${all === 1 ? '' : 's'} saved.`}</p>
      <p class="sc-over__n">${esc(k.name)} keeps the clock: they set the final score and publish the game.</p><div class="sc-over__b"><a class="sc-over__btn sc-over__btn--ghost" href="${esc(O.back)}">Back to games</a></div></div>`;
    if (!ui.fin) { ui.fin = { a: G.score.a, b: G.score.b, potg: '' }; }
    const w = finWinner(), cands = finCands(w);
    if (ui.fin.potg && !cands.includes(ui.fin.potg)) ui.fin.potg = '';
    if (!ui.fin.potg && ui.fin.auto !== false && cands[0]) ui.fin.potg = cands[0];
    const ready = !n && w && !ui.publishing;
    return `<div class="sc-over sc-over--court" role="group" aria-label="Game over: final score and player of the game">${head}
      <p class="sc-over__s${n ? ' is-wait' : ''}">${practice ? `Practice · ${all} play${all === 1 ? '' : 's'}, all on this phone. This is how a real game ends.` : n ? `${n} play${n === 1 ? '' : 's'} still sending${ui.sync === 'offline' ? ': waiting for signal' : '…'}` : `All ${all} play${all === 1 ? '' : 's'} saved.`}</p>
      <div class="sc-fin"><span class="sc-fin__l">Final score</span>
        <label class="sc-fin__t"><span>${esc(team.a.name)}</span><input type="number" inputmode="numeric" min="0" max="300" value="${ui.fin.a}" data-fin-score="a" aria-label="${esc(team.a.name)} final score"></label>
        <label class="sc-fin__t"><span>${esc(team.b.name)}</span><input type="number" inputmode="numeric" min="0" max="300" value="${ui.fin.b}" data-fin-score="b" aria-label="${esc(team.b.name)} final score"></label>
        ${ui.fin.a !== G.score.a || ui.fin.b !== G.score.b ? `<small class="sc-fin__n">The plays add up to ${G.score.a}–${G.score.b}. The score you type is the result.</small>` : '<small class="sc-fin__n">From the plays. Fix it if the scoreboard says otherwise.</small>'}</div>
      <div class="sc-fin"><span class="sc-fin__l">Player of the game${w ? ` · ${esc(team[w].name)}` : ''}</span>
        ${w ? `<div class="sc-q__opts">${cands.map(id => optBtn(id, 'data-finpotg', ui.fin.potg === id)).join('')}</div>` : '<small class="sc-fin__n">A tied score has no winner: fix the final score.</small>'}</div>
      <div class="sc-over__b"><button type="button" class="sc-over__btn" data-act="court-publish"${ready ? '' : ' disabled'}>${ui.publishing ? 'Publishing…' : 'Publish the game'}</button></div>
      <p class="sc-over__n">${practice ? 'In a real game the box score goes up now, marked “Stats pending review” until an admin checks it. Here nothing is sent.' : 'The box score goes up now, marked “Stats pending review” until an admin checks it. The recap comes later.'}</p></div>`;
  }
  function courtPublish() {
    const O = B.over || {}, w = finWinner();
    if (!O.finish || unsent().length || ui.publishing || !w) return;
    const name = ui.fin.potg ? short(ui.fin.potg) : 'none picked';
    // Practice: the real last step, without sending anything.
    if (practice) return confirm('Publish the practice game?', `${team.a.name} ${ui.fin.a}–${ui.fin.b} ${team.b.name} · POTG: ${name}. In a real game this puts the box score on the site, marked pending review. Here nothing is sent`, 'up', 'Publish', () => {
      ui.published = 'Practice finished. In a real game the box score would now be on the site, marked Stats pending review.'; ui.locked = true;
      report({ finished: true }, true); save(); if (soundOn()) chime('yes'); paint();
    });
    confirm('Publish the game?', `${team.a.name} ${ui.fin.a}–${ui.fin.b} ${team.b.name} · POTG: ${name}. The stats show as pending review until an admin checks them`, 'up', 'Publish', () => {
      ui.publishing = true; paint();
      fetch(O.finish, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ a: ui.fin.a, b: ui.fin.b, potg: ui.fin.potg, device: deviceId }) })
        .then(r => r.text().then(t => { let j = null; try { j = JSON.parse(t); } catch (e) {} if (!j) throw new Error('Not published. Try again.'); if (!r.ok || j.error) { const e = new Error(j.error || 'Not published. Try again.'); e.published = !!j.published; throw e; } return j; }))
        .then(j => { ui.publishing = false; ui.published = j.message || 'Published.'; ui.locked = true; if (soundOn()) chime('yes'); paint(); },
          err => { ui.publishing = false; if (err.published) { ui.published = err.message; ui.locked = true; } else ui.tip = err.message; paint(); });
    });
  }
  function publish() {
    const O = B.over || {};
    if (!O.publish || unsent().length || ui.publishing) return;
    const off = O.official && (O.official.a !== G.score.a || O.official.b !== G.score.b) ? O.official : null;
    const send = final => {
      ui.publishing = true; paint();
      fetch(O.publish, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ pass: B.pass, final }) })
        .then(r => r.text().then(t => { let j = null; try { j = JSON.parse(t); } catch (e) {} if (!r.ok || !j || j.error) throw new Error((j && j.error) || 'Your admin sign-in ended. Open the scorer again.'); return j; }))
        .then(j => { ui.publishing = false; ui.published = j.message || 'Box score saved.'; ui.next = /^\/app\//.test(location.pathname) ? `/app/admin/games/${encodeURIComponent(gid)}/finish` : j.next || ''; ui.locked = true; if (soundOn()) chime('yes'); paint(); },
          err => { ui.publishing = false; ui.tip = err.message || 'Not saved. Try again.'; paint(); });
    };
    // The plays and the typed final score differ (Paolo, 2026-10-27: a review said 84–78, the
    // saved final 83–78): ask which one is the result.
    if (off) return confirm('Which final score?', `The plays add up to ${G.score.a}–${G.score.b}; the final score says ${off.a}–${off.b}. Saving the box score uses the one you pick`, 'up', `Use ${G.score.a}–${G.score.b}`, () => send('plays'), `Keep ${off.a}–${off.b}`, () => send('typed'));
    confirm('Save the box score?', `${team.a.name} ${G.score.a}–${G.score.b} ${team.b.name}. The stats go on the site and in the app${O.liveOff ? ' once Visible to everyone is on' : ' now'}; the POTG and recap come next`, 'up', 'Save it', () => send(''));
  }
  // ── Table display (2026-10-30): the tablet at the table (/table, public/table/) mirrors this
  // phone over a direct link on the phone's hotspot (public/table-link.js, the link test's
  // approach). ••• → Table display: scan the tablet's code, then hold this phone's code up to
  // the tablet. From then on every change goes to the tablet (and every 2 s, for the clock).
  const tbl = { ch: null, pc: null, box: null, stream: null, stop: null, t: null, at: 0 };
  const tblOn = () => !!(tbl.ch && tbl.ch.readyState === 'open');
  function tableClose() {
    if (tbl.stop) tbl.stop();
    if (tbl.L && tbl.stream) tbl.L.stopCamera(tbl.stream);
    tbl.stream = null; tbl.stop = null;
    if (tbl.box) { tbl.box.remove(); tbl.box = null; }
  }
  function tableOpen() {
    ui.ask = null; paint();
    tableClose();
    const box = document.createElement('div');
    box.className = 'sc-tbl';
    box.innerHTML = `<div class="sc-tbl__in" role="dialog" aria-modal="true" aria-label="Table display">
      <div class="sc-tbl__h"><b>Table display</b><button type="button" class="sc-x" data-tbl-close aria-label="Close">${CLOSE}</button></div>
      <p class="sc-tbl__s" data-tbl-s>${tblOn() ? 'The tablet is linked. To pair another one, scan its code.' : `On the tablet, join this phone’s hotspot, open <b>${esc(location.host)}/table</b> and tap Show the code. Then scan it here.`}</p>
      <video playsinline muted autoplay class="sc-tbl__v" hidden></video>
      <div class="sc-tbl__qr" data-tbl-qr hidden></div>
      <button type="button" class="sc-over__btn" data-tbl-go>Scan the tablet’s code</button>
    </div>`;
    el.appendChild(box); tbl.box = box;
    box.addEventListener('click', e => {
      if (e.target.closest('[data-tbl-close]') || e.target === box) return tableClose();
      if (e.target.closest('[data-tbl-go]')) tableScan();
    });
  }
  async function tableScan() {
    const box = tbl.box; if (!box) return;
    const say = t => { const s = box.querySelector('[data-tbl-s]'); if (s) s.innerHTML = t; };
    const go = box.querySelector('[data-tbl-go]'), video = box.querySelector('video');
    try {
      tbl.L = tbl.L || await import('/table-link.js');
      await tbl.L.loadVendor();
      go.hidden = true; video.hidden = false;
      say('Point the camera at the tablet’s code, about a forearm away.');
      tbl.stream = await tbl.L.camera(video);
      tbl.stop = tbl.L.scan(video, async text => {
        try {
          say('Got it. Making this phone’s code…');
          // The camera stays on while the answer is made: this phone's real address goes in it.
          const r = await tbl.L.phoneAnswer(text, ch => {
            ch.onopen = () => {
              if (tbl.ch && tbl.ch !== ch) { try { tbl.ch.close(); } catch (x) {} }
              if (tbl.pc && tbl.pc !== r.pc) { try { tbl.pc.close(); } catch (x) {} }
              tbl.ch = ch; tbl.pc = r.pc; tableClose(); wakeOn();
              ui.tip = 'Tablet linked: it shows the score and the clock. Players on it shows the cards.'; tableSend(true); paint();
            };
            ch.onclose = () => { if (tbl.ch === ch) { tbl.ch = null; ui.tip = 'The tablet’s link closed. ••• → Table display pairs it again.'; paint(); } };
            ch.onmessage = () => { tbl.at = Date.now(); };
          });
          if (tbl.L && tbl.stream) tbl.L.stopCamera(tbl.stream, video);
          tbl.stream = null; video.hidden = true;
          const qr = box.querySelector('[data-tbl-qr]'); tbl.L.drawQr(qr, r.code); qr.hidden = false;
          say('Now hold this up to the tablet’s camera.');
        } catch (e) { say(esc(e.message || 'That code didn’t work. Try again.')); go.hidden = false; }
      });
    } catch (e) {
      say(e && e.name === 'NotAllowedError' ? 'The camera is needed to read the tablet’s code. Allow it and try again.' : esc((e && e.message) || 'Something went wrong.'));
      go.hidden = false; video.hidden = true;
    }
  }
  // What the tablet shows (public/table/table.js got()).
  const LINE_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'turnover', 'pf', 'fg2m', 'fg2m_miss', 'fg3m', 'fg3m_miss', 'fg4m', 'fg4m_miss', 'ftm', 'ft_miss'];
  let prevCache = { n: -1, v: [] };
  function tableState() {
    clockNow();
    const lastRow = G.rows.filter(r => r.type !== 'setup').pop();
    if (pw && prevCache.n !== list().length) {
      prevCache = { n: list().length, v: games().filter(n => n < ui.game && setupFor(n)).map(n => { const g = foldGame(list().filter(e => !e.late && gameOf(e) === n), papawisRules(B.rules, setupFor(n))); return { n, a: g.score.a, b: g.score.b }; }) };
    }
    return {
      t: 's', at: Date.now(), kind: pw ? 'papawis' : 'league', basic: basic(),
      title: pw ? `Papawis · Game ${ui.game}` : `${team.a.name} vs ${team.b.name}`,
      period: G.period, final: !!G.final, clock: { secs: ui.running && runFrom ? Math.max(0, runFrom.secs - (Date.now() - runFrom.at) / 1000) : ui.secs, running: !!ui.running },
      last: lastRow ? `${playText(lastRow).replace(/<[^>]+>/g, '')}${scores(lastRow) ? ` · ${lastRow.score.a}–${lastRow.score.b}` : ''}` : '',
      prev: pw ? prevCache.v : [],
      teams: ['a', 'b'].map(t => ({
        name: team[t].name, color: team[t].color, score: G.score[t],
        fouls: rules.penaltyAt > 0 ? G.teamFouls[t] : null, penaltyAt: rules.penaltyAt, penalty: !!G.penalty[t],
        toLeft: G.timeouts.left[t], toAllow: G.timeouts.allowance,
        players: team[t].players.filter(p => !G.dnp.includes(p.id)).map(p => ({ id: p.id, name: p.name, short: p.short, number: p.number || '', line: G.players[p.id] ? Object.fromEntries(LINE_KEYS.map(k => [k, G.players[p.id][k] || 0])) : null })),
      })),
    };
  }
  function tableSend(now = false) {
    if (!tblOn()) return;
    clearTimeout(tbl.t);
    const go = () => { try { tbl.ch.send(JSON.stringify(tableState())); } catch (e) {} };
    if (now) go(); else tbl.t = setTimeout(go, 200);
  }
  const tblTimer = setInterval(() => { if (!document.contains(el)) return clearInterval(tblTimer); tableSend(true); }, 2000);

  // ── Papawis: one phone scores a run at a time (server.js /api/score/:id/hold; Fable audit
  // 2026-10-30: two phones double-counted). This phone checks in every 10 s with how many plays
  // it still has to send and whether its game is over. Someone else holding it: this phone shows
  // who, with Take over (between games once their plays are in, or after 2 quiet minutes) or Ask
  // them. With no signal nothing is checked and this phone just scores.
  const hold = { mine: true, holder: null, canTake: false, said: '', sig: '' };
  async function holdPing(action, extra = {}) {
    if (!pw || !pw.hold || !navigator.onLine || ui.locked) return;
    try {
      const r = await fetch(pw.hold, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: deviceId, action, unsent: unsent().length, over: !!G.final, ...extra }) });
      if (!r.ok) return;
      const d = await r.json();
      const was = hold.mine;
      Object.assign(hold, { mine: !!d.mine, holder: d.holder, canTake: !!d.canTake, said: d.said || '' });
      if (!was && d.mine) { ui.tip = d.from ? `${d.from} handed the run to you. You're scoring.` : 'You’re scoring this run now.'; pull(); }
      if (was && !d.mine) { ui.running = false; syncRun(); ui.sel = null; ui.ask = null; save(); }
      if (d.ask && !ui.confirm) confirm(`${d.ask.name} wants to score`, 'They score from their next play. Anything still on this phone sends as usual', 'up', `Let ${d.ask.name} score`, () => holdPing('answer', { yes: true }), 'No, I’ll keep it', () => holdPing('answer', { yes: false }));
      // Only repaint when something changed (a repaint every 10 s would drop a name being typed).
      const sig = JSON.stringify([hold.mine, hold.holder && hold.holder.name, hold.holder && Math.floor(hold.holder.quiet / 30), hold.canTake, hold.said, !!d.ask]);
      if (sig !== hold.sig || action) { hold.sig = sig; paint(); }
    } catch (e) {}
  }
  function holdView() {
    const h = hold.holder || { name: 'Someone', quiet: 0, unsent: 0, over: false };
    const quiet = h.quiet >= 60 ? `quiet for ${Math.floor(h.quiet / 60)} min` : 'active now';
    const why = hold.canTake ? (h.quiet >= 120 ? 'Their phone has gone quiet.' : h.over ? 'Their game is over and every play is in.' : '')
      : h.unsent ? `Their phone still has ${h.unsent} play${h.unsent === 1 ? '' : 's'} to send.` : 'They’re in the middle of a game.';
    return `<div class="su"><div class="su-card su-hold" role="status">
      <span class="su-l">Scoring this run</span>
      <b class="su-hold__n">${esc(h.name)} is scoring</b>
      <p class="su-n">${esc([quiet, why].filter(Boolean).join(' · '))}</p>
      ${hold.canTake ? '<button type="button" class="sc-over__btn" data-act="hold-take">Take over</button>' : ''}
      ${hold.said === 'waiting' ? `<p class="su-n">Asked ${esc(h.name)}. Waiting for them to answer…</p>` : hold.said === 'no' ? `<p class="su-n">${esc(h.name)} is keeping it for now.</p>` : ''}
      ${!hold.canTake && hold.said !== 'waiting' ? `<button type="button" class="sc-over__btn${hold.canTake ? ' sc-over__btn--ghost' : ''}" data-act="hold-ask">Ask ${esc(h.name)} to hand it over</button>` : ''}
      <p class="su-n">Between games you can take over once their phone has sent every play. If it goes quiet for 2 minutes, any scorer can.</p>
    </div></div>`;
  }
  if (pw) {
    holdPing();
    const ht = setInterval(() => { if (!document.contains(el)) return clearInterval(ht); holdPing(); }, 10000);
    window.addEventListener('online', () => holdPing());
  }
  // Keep the screen on while scoring a run or feeding the tablet (a locked phone stops sending).
  let lock = null;
  const wakeOn = () => { if ((pw || tblOn()) && 'wakeLock' in navigator && !lock) navigator.wakeLock.request('screen').then(l => { lock = l; l.addEventListener('release', () => { lock = null; }); }, () => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.contains(el)) wakeOn(); });
  wakeOn();
  // The tablet pairing works offline only if its scripts are on the phone: fetch them now.
  if (navigator.onLine && !practice) setTimeout(() => { for (const u of ['/table-link.js', '/table/vendor/qrcode.js', '/table/vendor/jsqr.js']) fetch(u, { credentials: 'same-origin' }).catch(() => {}); }, 2500);

  // ── Papawis: the setup before each game, and moving between the run's games ──
  // A new game starts set up like the last one: same stats and minutes, sides as they
  // finished (moves included), the same people not here. The first game: the run's defaults
  // and the sides people signed up on.
  function draftFor(n) {
    const prevN = games().filter(x => x < n && setupFor(x)).pop();
    if (prevN) {
      const st = setupFor(prevN);
      const Gp = foldGame(list().filter(e => !e.late && gameOf(e) === prevN), papawisRules(B.rules, st));
      const now = papawisSides(st, Gp), side = {};
      for (const p of everyone) side[p.id] = now[p.id] || homeSides[p.id];
      return { stats: st.stats === 'full' ? 'full' : 'basic', periodMin: Number(st.periodMin) || 10, periods: Number(st.periods) || 4, side, absent: new Set(everyone.filter(p => !now[p.id]).map(p => p.id)), guests: (st.guests || []).map(g => ({ ...g })), guestName: '' };
    }
    const d = pw.defaults || {};
    return { stats: d.stats === 'full' ? 'full' : 'basic', periodMin: d.periodMin || 10, periods: d.periods || 4, side: { ...homeSides }, absent: new Set(), guests: [], guestName: '' };
  }
  const SWAP_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';
  function setupView() {
    const d = ui.draft || (ui.draft = draftFor(ui.game));
    const seg = (act, v, label, sub = '') => `<button type="button" class="su-seg${String(d[act === 'su-stats' ? 'stats' : 'periodMin']) === String(v) ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${String(d[act === 'su-stats' ? 'stats' : 'periodMin']) === String(v)}"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
    const chip = p => {
      const off = d.absent.has(p.id), t = d.side[p.id], moved = t !== homeSides[p.id];
      return `<div class="su-chip${off ? ' is-off' : ''}">
        <button type="button" class="su-chip__n" data-act="su-here" data-pid="${esc(p.id)}" aria-pressed="${!off}" aria-label="${esc(p.name)}: ${off ? 'not here. Tap if they came' : 'here. Tap if they didn’t come'}">${p.number ? `<i class="num">${esc(p.number)}</i>` : '<i class="num">–</i>'}<span>${esc(p.short)}</span>${off ? '<small>Not here</small>' : moved ? `<small>from ${esc(team[homeSides[p.id]].name.charAt(0) + team[homeSides[p.id]].name.slice(1).toLowerCase())}</small>` : ''}</button>
        ${off ? '' : `<button type="button" class="su-chip__mv" data-act="su-swap" data-pid="${esc(p.id)}" aria-label="Move ${esc(p.name)} to ${esc(team[other(t)].name)}">${SWAP_SM}</button>`}
      </div>`;
    };
    const side = t => {
      const ppl = everyone.filter(p => d.side[p.id] === t);
      const here = ppl.filter(p => !d.absent.has(p.id)).length;
      return `<section class="su-side"><div class="su-side__h"><span class="dot" style="--c:${esc(team[t].color)}"></span><b>${esc(team[t].name)}</b><span class="num">${here} PLAYING</span></div>
        <div class="su-chips">${ppl.map(chip).join('')}</div></section>`;
    };
    const any = games().some(n => setupFor(n));
    const here = t => everyone.filter(p => d.side[p.id] === t && !d.absent.has(p.id)).length;
    return `<div class="su">
      <div class="su-card">
        <span class="su-l">Stats</span>
        <div class="su-segs su-segs--2">${seg('su-stats', 'basic', 'Basic', 'PTS · REB · AST')}${seg('su-stats', 'full', 'Full', 'Like league games')}</div>
        <p class="su-n">Basic logs makes only, one tap per play. Pick Full when someone can score properly.</p>
        <span class="su-l">Quarter length</span>
        <div class="su-segs su-segs--4">${[5, 8, 10, 12].map(m => seg('su-min', m, `${m} min`)).join('')}</div>
        <div class="su-row"><span>Quarters</span><span class="su-step"><button type="button" data-act="su-q" data-v="-1" aria-label="Fewer quarters"${d.periods <= 1 ? ' disabled' : ''}>−</button><b class="num">${d.periods}</b><button type="button" data-act="su-q" data-v="1" aria-label="More quarters"${d.periods >= 4 ? ' disabled' : ''}>+</button></span></div>
        <p class="su-n">No timeouts or penalty at Papawis.${ui.game > 1 && any ? ' Set up like the last game: change anything that’s different.' : ''}</p>
      </div>
      <div class="su-who"><span class="su-l">Who’s here</span><small>Tap a name if they didn’t come. ${SWAP_SM} moves them to the other side.</small></div>
      ${side('a')}${side('b')}
      <div class="su-card su-guest"><label class="su-l" for="su-guest">A guest who isn’t on the list</label>
        <input id="su-guest" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="Their name" value="${esc(d.guestName || '')}" data-su-guest>
        <div class="su-segs su-segs--2"><button type="button" class="su-seg" data-act="su-guest" data-v="a">+ ${esc(team.a.name)}</button><button type="button" class="su-seg" data-act="su-guest" data-v="b">+ ${esc(team.b.name)}</button></div>
        <p class="su-n">Their stats stay with this run under their name. Tell an admin, so they’re added to the run and charged.</p></div>
      <div class="su-go">
        <button type="button" class="sc-over__btn" data-act="su-start"${here('a') && here('b') ? '' : ' disabled'}>Start Game ${ui.game} · ${d.stats === 'full' ? 'Full' : 'Basic'} · ${d.periods} × ${d.periodMin} min</button>
        ${any ? `<button type="button" class="sc-over__btn sc-over__btn--ghost" data-act="su-cancel">Not now</button>` : ''}
        <small>Late arrivals can be added during the game (the team menu).</small>
      </div>
    </div>`;
  }
  function setupAct(name, b) {
    const d = ui.draft || (ui.draft = draftFor(ui.game));
    const v = b.getAttribute('data-v'), pid = b.getAttribute('data-pid');
    if (name === 'su-stats') d.stats = v === 'full' ? 'full' : 'basic';
    else if (name === 'su-min') d.periodMin = Math.max(1, Math.min(20, Number(v) || 10));
    else if (name === 'su-q') d.periods = Math.max(1, Math.min(4, d.periods + (Number(v) || 0)));
    else if (name === 'su-here' && pid) { if (d.absent.has(pid)) d.absent.delete(pid); else d.absent.add(pid); }
    else if (name === 'su-swap' && pid) d.side[pid] = other(d.side[pid] || homeSides[pid]);
    else if (name === 'su-guest') {
      const box = root.querySelector('[data-su-guest]'), nm = String((box && box.value) || d.guestName || '').trim().slice(0, 40);
      if (!nm) { ui.tip = 'Type the guest’s name first.'; return paint(); }
      const g = { id: `x${uid().replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}`, name: nm, side: v === 'b' ? 'b' : 'a' };
      d.guests.push(g); d.guestName = '';
      const p = guestPerson(g.id, g.name); everyone.push(p); homeSides[g.id] = g.side; byId[g.id] = { ...p, team: g.side }; d.side[g.id] = g.side;
      ui.tip = `${nm} added to ${team[g.side].name}.`;
    }
    else if (name === 'su-cancel') { const set = games().filter(n => setupFor(n)); ui.draft = null; return goGame(set[set.length - 1] || 1); }
    else if (name === 'su-start') {
      const sides = { a: [], b: [] };
      for (const p of everyone) if (!d.absent.has(p.id)) sides[d.side[p.id] || homeSides[p.id]].push(p.id);
      if (!sides.a.length || !sides.b.length) { ui.tip = 'Each side needs someone playing.'; return paint(); }
      add({ type: 'setup', game: ui.game, stats: d.stats, periodMin: d.periodMin, periods: d.periods, sides, absent: [...d.absent].filter(id => everyone.some(p => p.id === id)), guests: d.guests.map(g => ({ id: g.id, name: g.name, side: d.side[g.id] || g.side })) });
      ui.draft = null; ui.running = false; ui.secs = rules.periodMin * 60; syncRun(); ui.tip = `Game ${ui.game} is on. The clock starts on the first play, or tap Start.`;
      Object.keys(slots).forEach(t => { slots[t] = []; });
      save();
    }
    return paint();
  }
  function goGame(n) {
    clockNow();
    ui.clocks[ui.game] = { secs: ui.secs, running: ui.running, at: Date.now() };
    ui.game = n; ui.draft = null; ui.sel = null; ui.arm = null; ui.ask = null; ui.queue = []; ui.peek = null; ui.after = null; ui.redo = null;
    Object.keys(slots).forEach(t => { slots[t] = []; });
    G = fold();
    const c = ui.clocks[n];
    if (c) { const left = c.running ? Math.max(0, c.secs - Math.floor((Date.now() - c.at) / 1000)) : c.secs; ui.secs = left; ui.running = !!c.running && left > 0; }
    else { ui.secs = G.final ? 0 : rules.periodMin * 60; ui.running = false; }
    syncRun(); save();
    paint();
  }
  const nextGame = () => goGame(Math.max(ui.game, ...games()) + 1);
  // Game over in a Papawis run: the next game, or Finish the run (that needs signal).
  function pwOverPanel(n, all) {
    const later = games().filter(x => x > ui.game && setupFor(x));
    const sendLine = n ? `${n} play${n === 1 ? '' : 's'} still sending${ui.sync === 'offline' ? ': waiting for signal' : '…'}` : `All ${all} play${all === 1 ? '' : 's'} saved.`;
    return `<div class="sc-over" role="status"><div class="sc-over__h"><b>Game ${ui.game} over</b><span class="num">${esc(team.a.name)} ${G.score.a}–${G.score.b} ${esc(team.b.name)}</span></div>
      <p class="sc-over__s${n ? ' is-wait' : ''}">${sendLine}</p>
      <div class="sc-over__b">${later.length ? `<button type="button" class="sc-over__btn" data-act="pw-goto" data-v="${later[0]}">Back to Game ${later[0]}</button>` : `<button type="button" class="sc-over__btn" data-act="pw-next">Start Game ${ui.game + 1}</button>`}
        ${n ? `<button type="button" class="sc-over__btn sc-over__btn--ghost" disabled>Finish the run · ${n} play${n === 1 ? '' : 's'} still sending</button>` : `<a class="sc-over__btn sc-over__btn--ghost" href="${esc(pw.finish)}">${pw.done ? 'Finish the run again' : 'Done playing · Finish the run'}</a>`}</div>
      <p class="sc-over__n">${later.length ? '' : `Game ${ui.game + 1} starts set up like this one: same minutes, sides as they finished. `}${n ? 'Finishing the run needs signal: every play has to reach the server first.' : 'Undo the last play to reopen this game.'}</p></div>`;
  }

  function paintNow() {
    // Papawis: a game with no setup yet shows the setup screen instead.
    const title = el.querySelector('.sc-nav .navbar__title');
    if (pw && title) title.textContent = `Game ${ui.game} · ${pw.title}`;
    if (pw && !hold.mine) { root.innerHTML = holdView() + (ui.tip ? `<p class="sc-tip su-tip" role="status">${esc(ui.tip)}</p>` : ''); ui.tip = ''; paintPill(); return; }
    if (pw && !setupFor(ui.game) && !ui.locked) { root.innerHTML = setupView() + (ui.tip ? `<p class="sc-tip su-tip" role="status">${esc(ui.tip)}</p>` : ''); ui.tip = ''; paintPill(); return; }
    const quiet = a => !!a && SKIPPABLE.has(a.kind) && !followOn();
    if (quiet(ui.ask)) ui.ask = null;
    while (!ui.ask && ui.queue.length && !ui.subs && !ui.dnp) { ui.ask = ui.queue.shift(); if (quiet(ui.ask)) ui.ask = null; }
    clockNow();
    // The players a follow-up is waiting on light up; the rest dim (tile(), the bench).
    ansIds = ui.ask && OPTIONAL.has(ui.ask.kind) ? new Set(followOpts(ui.ask)) : null;
    const q = question();
    const restarted = ui.restarted; ui.restarted = false;
    const started = ui.started; ui.started = false;
    const optional = !!(ui.ask && OPTIONAL.has(ui.ask.kind));
    // A follow-up closes itself after FOLLOW_MS with no answer (not "who comes on" after a foul-out).
    if (optional && !ui.ask._timer && !ui.ask.noTimer && !calm()) {
      const a = ui.ask; if (!a.at) a.at = Date.now();
      a._timer = setTimeout(() => { if (ui.ask === a) { ui.ask = null; paint(); } }, Math.max(0, followMs(a) - (Date.now() - a.at)));
    }
    const docked = wide.matches && !ui.hideDock;
    root.classList.toggle('is-docked', docked);
    root.innerHTML = `
      <div class="sc-left">
        ${ui.locked ? `<div class="msg msg--info sc-msg">${practice ? 'Practice finished. Reset at the top to play another one.' : 'The box score is saved. The scorer is read-only now.'}</div>` : ''}
        ${ui.sync === 'error' && ui.syncMsg ? `<div class="msg msg--err sc-msg" role="alert">${esc(ui.syncMsg)}</div>` : ''}
        <div class="sc-board">
          ${sideBoard('a')}
          <div class="sc-clk"><span class="sc-clk__p num">${video ? 'Video · ' : ''}${G.final ? 'FINAL' : esc(G.period)}</span>
            <div class="sc-clk__row">
              <button type="button" class="sc-clk__t num" data-act="clockset" data-sc-clock aria-label="Game clock ${clockStr()}. Tap to fix it">${clockStr()}</button>
              ${keepsClock() && !ui.running && ui.secs === 0 && !G.final && !ui.locked ? `<button type="button" class="sc-cb sc-cb--go sc-cb--end" data-act="end" aria-label="End ${esc(G.period)}">End</button>`
                : keepsClock() ? `<button type="button" class="sc-cb sc-cb--go${ui.whistle && !ui.running ? ' is-pulse' : ''}" data-act="clock" aria-label="${ui.running ? 'Pause clock' : 'Start clock'}">${ui.running ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button>`
                : `<span class="sc-keeper num" aria-label="${esc(keeper().name)} keeps the clock">${esc(keeper().name.split(' ')[0])}</span>`}
              <button type="button" class="sc-cb" data-act="game" aria-label="Game: refs stopped play, end the period, fix the clock"><svg viewBox="0 0 12 4" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.6"/><circle cx="6" cy="2" r="1.6"/><circle cx="10" cy="2" r="1.6"/></svg></button>
            </div></div>
          ${sideBoard('b')}
        </div>
        <div class="sc-teams">${teamBlock('a')}${teamBlock('b')}</div>
        <div class="sc-bottom">
          ${ui.tip || restarted || started ? `<p class="sc-tip" role="status">${esc(ui.tip || (started ? 'Clock started with the first play. Tap the time to fix it.' : 'Clock restarted. Tap the time to fix it.'))}</p>` : ''}
          ${tipBox()}
          ${lastRow()}
          ${optional && !docked ? q : ''}
          ${q && !optional ? q : G.final && !ui.after ? overPanel() : `<div class="sc-padw">${pad()}</div>`}
          ${!docked ? `<button type="button" class="sc-sheetbtn" data-act="sheet">${SHEET_ICON}Scoresheet</button>` : ''}
        </div>
      </div>
      ${docked ? `<aside class="sc-dock" aria-label="Scoresheet">${optional ? `<div class="sc-dock__q">${q}</div>` : ''}<div class="sc-dock__h"><b>Scoresheet</b><button type="button" class="sc-hbtn" data-act="dock-hide" aria-label="Hide the scoresheet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>${sheetTabs(ui.dockTab, 'data-dtab')}<div class="sc-dock__b">${sheetBody(ui.dockTab)}</div></aside>`
        : wide.matches ? '<button type="button" class="sc-dock-show" data-act="dock-show" aria-label="Show the scoresheet">Scoresheet</button>' : ''}
      ${dnpSheet()}
      ${subsSheet()}
      ${alertBar()}
      ${ui.sheet && !docked ? `<div class="sc-sheet sc-sheet--swipe" role="dialog" aria-modal="true" aria-label="Scoresheet" data-act="sheet-close"><div class="sc-sheet__in sc-sheet__in--tall">
        <div class="sc-sheet__grab" aria-hidden="true"></div>
        <div class="sc-sheet__h"><b>Scoresheet</b><button type="button" class="sc-x" data-act="sheet-close" aria-label="Close the Scoresheet">${CLOSE}</button></div>
        ${sheetTabs(ui.tab, 'data-tab')}<div class="sc-sheet__b">${sheetBody(ui.tab)}</div></div></div>` : ''}
      ${peek()}`;
    paintPill();
  }

  // ── Input: one listener for taps, holds handled with per-button timers ──
  function act(name, b) {
    const t = b.getAttribute('data-team');
    if (name === 'clock') { clockNow(); ui.running = !ui.running; syncRun(); ui.whistle = false; if (ui.running) ui.tip = ''; save(); return paint(); }
    if (name === 'end') return endPeriod();
    if (name === 'move') { const id = b.getAttribute('data-pid'); ui.peek = null; return byId[id] ? movePlayer(id, other(byId[id].team)) : paint(); }
    if (name === 'pw-next') return nextGame();
    if (name === 'hold-take') return holdPing('take');
    if (name === 'hold-ask') return holdPing('ask');
    if (name === 'pw-goto') return goGame(Number(b.getAttribute('data-v')) || 1);
    if (/^su-/.test(name)) return setupAct(name, b);
    if (name === 'confirm-no') { const c = ui.confirm; ui.confirm = null; if (c && c.noAct) c.noAct(); return paint(); }
    if (name === 'confirm-yes') { const c = ui.confirm; ui.confirm = null; if (c) c.act(); return paint(); }
    if (name === 'publish') return publish();
    if (name === 'court-publish') return courtPublish();
    if (name === 'ask-cancel') { ui.asked = ''; return lanes({ action: 'ask', want: null }); }
    if (name === 'alone-both') { ui.alone = null; return lanes({ action: 'claim', want: 'both' }); }
    if (name === 'alone-no') { ui.alone = null; return paint(); }
    if (name === 'game') return gameMenu();
    if (name === 'teammenu') return teamMenu(t);
    if (name === 'dnp') return dnpMenu(t);
    if (name === 'sides') return sideMenu();
    if (name === 'dnp-save') return dnpSave();
    if (name === 'dnp-close') { ui.dnp = null; return paint(); }
    if (name === 'subs-close') { ui.subs = null; return paint(); }
    if (name === 'subs-save') return subSave();
    if (name === 'subs-all' && ui.subs) { const on = five(ui.subs.t); ui.subs.out = on.every(id => ui.subs.out.includes(id)) ? [] : [...ui.subs.out, ...on.filter(id => !ui.subs.out.includes(id))]; return paint(); }
    if (name === 'clockset') return clockMenu();
    if (name === 'sheet') { ui.sheet = true; ui.sel = null; ui.arm = null; return paint(); }
    if (name === 'sheet-close') { ui.sheet = false; return paint(); }
    if (name === 'fouls') { ui.sheetTeam = t; if (wide.matches) { ui.hideDock = false; ui.dockTab = 'fouls'; } else { ui.sheet = true; ui.tab = 'fouls'; } return paint(); }
    if (name === 'tips-next') { pref.set('wknd-prac-tip', String(tipAt() + 1)); return paint(); }
    if (name === 'tips-off') { pref.set('wknd-prac-tips', 'off'); ui.tip = 'Tips off. How to score (Me → Scoring) has every move.'; return paint(); }
    if (name === 'dock-hide') { ui.hideDock = true; return paint(); }
    if (name === 'dock-show') { ui.hideDock = false; return paint(); }
    if (name === 'peek-close') { ui.peek = null; return paint(); }
    if (name === 'insert-done') { ui.after = null; ui.tip = ''; return paint(); }
    if (name === 'redo') return redo();
    if (name === 'timeout') return timeout(t);
    if (name === 'subq') return subMenu(t);
    if (name === 'reb') return want('reb', () => simple('reb', 'REB'));
    if (name === 'ast') return want('ast', () => simple('ast', 'AST'));
    if (name === 'stl') return want('stl', () => simple('stl', 'STL'));
    if (name === 'blk') return want('blk', () => simple('blk', 'BLK'));
  }
  // A player tapped: an armed stat goes to them; a bench player then a court tile is a sub;
  // otherwise it picks (or unpicks) them.
  function pickPlayer(id) {
    const p = byId[id];
    const a = ui.ask;
    if (a && a.kind === 'fp') {
      // No free throws: the panel just says what the foul was; the next tap carries on.
      if (!a.n) ui.ask = null;
      // Free throws owed: a tap on the shooting team picks (or, before FT1, changes) the
      // shooter; anything else waits until they're done (× closes without them).
      else if (a.done < a.n) {
        if (p.team === a.o && (!a.done || !a.shooter)) { a.shooter = id; return paint(); }
        ui.tip = `Free throws first: FT${a.done + 1} of ${a.n}. × closes without them.`; return paint();
      }
    }
    // A follow-up: tapping one of its players on the court answers it.
    if (a && OPTIONAL.has(a.kind) && followOpts(a).includes(id)) return answer(id);
    ui.queue = [];
    if (ui.arm) { ui.sel = id; ui.ask = null; const run = ui.arm.run; ui.arm = null; return run(); }
    const s = ui.sel && byId[ui.sel];
    if (s && s.team === p.team && !onCourt(p.team, ui.sel) && onCourt(p.team, id)) { doSub(p.team, ui.sel, id); ui.sel = null; ui.ask = null; return paint(); }
    ui.sel = ui.sel === id ? null : id; ui.ask = null; ui.tip = ''; ui.redo = null; paint();
  }
  // The players a follow-up offers.
  function followOpts(a) {
    return (a.kind === 'ast' ? (a.bench ? team[a.team].players.filter(p => p.id !== a.shooter && !onCourt(a.team, p.id) && !G.flags[p.id]).map(p => p.id) : five(a.team).filter(id => id !== a.shooter))
    : a.kind === 'rebound' ? [...five(other(a.miss)), ...five(a.miss)] : (a.opts || []).map(o => o.id));
  }
  // Free throws still owed on the foul panel.
  const owed = () => !!(ui.ask && ui.ask.kind === 'fp' && ui.ask.n && ui.ask.done < ui.ask.n);
  // A hold (player card, a button's kinds) or a swipe ends with the finger lifting, and the
  // click that follows must not land on what the hold just opened, however long the hold was.
  // The next touch clears it, so a quick tap right after still counts.
  let swallowClick = false, swallowNext = false;
  // iPhone (2026-10-27, a scorer: "swipe up goes straight to Fix"): when the screen redraws under
  // a finger that's still down, iOS cancels the touch instead of ending it, then still taps
  // whatever is under the finger when it lifts (the last play's Fix sits right above the shot
  // buttons). So a hold or swipe also quiets every tap for a moment after the finger lifts,
  // however the touch ended.
  let gesture = false, quietUntil = 0;
  const gestureEnd = () => { if (gesture) { gesture = false; quietUntil = Date.now() + 450; } };
  window.addEventListener('pointerup', () => { if (swallowNext) { swallowNext = false; swallowClick = true; } gestureEnd(); }, true);
  window.addEventListener('pointercancel', () => { swallowNext = false; gestureEnd(); }, true);
  root.addEventListener('pointerdown', () => { swallowClick = false; swallowNext = false; }, true);
  const STAT_BTN = b => b.hasAttribute('data-shot') || b.hasAttribute('data-hold') && b.getAttribute('data-hold') !== 'score' || /^(reb|ast|stl|blk)$/.test(b.getAttribute('data-act') || '');
  root.addEventListener('click', e => {
    if (e.detail !== 0 && (swallowClick || gesture || Date.now() < quietUntil)) { swallowClick = false; e.preventDefault(); return; }
    if (e.target.matches && e.target.matches('.sc-sheet--swipe')) { ui.sheet = false; return paint(); }
    const closable = ui.ask && (CLOSABLE.has(ui.ask.kind) || (ui.ask.kind === 'fp' && !ui.ask.n));
    if (closable && !e.target.closest('button, a, input, label, .sc-q, [data-pick], .sc-sheet, .sc-peek')) { ui.ask = null; return paint(); }
    const b = e.target.closest('button, [data-act="peek-close"]'); if (!b || b.disabled) return;
    // Free throws owed: the stat buttons wait (the panel's × closes it without them).
    if (owed() && STAT_BTN(b)) { ui.tip = `Free throws first: FT${ui.ask.done + 1} of ${ui.ask.n}. × closes without them.`; return paint(); }
    if (b.hasAttribute('data-hold')) { if (e.detail === 0) holdTap(b); return; } // keyboard: Enter = tap
    const readOnly = /^(sheet|sheet-close|peek-close|fouls|dock-hide|dock-show)$/.test(b.getAttribute('data-act') || '') || b.hasAttribute('data-tab') || b.hasAttribute('data-dtab') || b.hasAttribute('data-steam') || b.hasAttribute('data-filter') || b.hasAttribute('data-ask');
    if (ui.locked && !readOnly) return;
    if (b.hasAttribute('data-pick')) return pickPlayer(b.getAttribute('data-pick'));
    if (b.hasAttribute('data-ask')) return answer(b.getAttribute('data-ask'));
    if (b.hasAttribute('data-fix')) return fixMenu(b.getAttribute('data-fix'));
    if (b.hasAttribute('data-tab')) { ui.tab = b.getAttribute('data-tab'); pref.set('wknd-sc-tab', ui.tab); return paint(); }
    if (b.hasAttribute('data-dtab')) { ui.dockTab = b.getAttribute('data-dtab'); pref.set('wknd-sc-dock', ui.dockTab); return paint(); }
    if (b.hasAttribute('data-steam')) { ui.sheetTeam = b.getAttribute('data-steam'); return paint(); }
    if (b.hasAttribute('data-filter')) { ui.filter = b.getAttribute('data-filter'); return paint(); }
    if (b.hasAttribute('data-finpotg')) { const id = b.getAttribute('data-finpotg'); ui.fin.potg = ui.fin.potg === id ? '' : id; ui.fin.auto = false; return paint(); }
    const fresh = () => { clearTimeout(ui.ask._timer); ui.ask._timer = null; ui.ask.at = Date.now(); };
    if (b.hasAttribute('data-astbench')) { ui.ask.bench = true; fresh(); return paint(); }
    if (b.hasAttribute('data-blkpts')) { ui.ask.pts = Number(b.getAttribute('data-blkpts')); fresh(); return paint(); }
    if (b.hasAttribute('data-fpbench')) { ui.ask.bench = true; return paint(); }
    if (b.hasAttribute('data-fpclose')) { ui.ask = null; return paint(); }
    if (b.hasAttribute('data-fpn')) { const n = Number(b.getAttribute('data-fpn')); if (!n) { ui.ask = null; return paint(); } ui.ask.n = n; ui.ask.andOne = false; return paint(); }
    if (b.hasAttribute('data-fpand')) {
      const a = ui.ask; a.andOne = !a.andOne;
      if (a.andOne) { a.n = 1; const prev = G.rows.filter(r => r.team === a.o && r.type === 'shot' && r.made).pop(); if (prev && !a.shooter) a.shooter = prev.player; }
      return paint();
    }
    if (b.hasAttribute('data-fpsh')) { ui.ask.shooter = b.getAttribute('data-fpsh'); return paint(); }
    if (b.hasAttribute('data-fpft')) {
      const a = ui.ask, made = b.getAttribute('data-fpft') === '1';
      add({ type: 'ft', team: a.o, player: a.shooter, made }, { flash: { text: made ? '+1' : 'MISS', tone: made ? 'good' : 'bad' } });
      (a.res = a.res || []).push(made); a.done++;
      if (a.done >= a.n) ui.ask = !made && (a.foulKind === 'personal' || a.foulKind === 'shooting') ? reboundAsk(a.o) : null;
      return paint();
    }
    if (b.hasAttribute('data-subp') && ui.subs) {
      const id = b.getAttribute('data-subp'), list = b.getAttribute('data-sublist') === 'out' ? 'out' : 'in';
      ui.subs[list] = ui.subs[list].includes(id) ? ui.subs[list].filter(x => x !== id) : [...ui.subs[list], id];
      return paint();
    }
    if (b.hasAttribute('data-dnp-toggle') && ui.dnp) { const id = b.getAttribute('data-dnp-toggle'); ui.dnp.sel.has(id) ? ui.dnp.sel.delete(id) : ui.dnp.sel.add(id); return paint(); }
    if (b.hasAttribute('data-side')) return pickSide(b.getAttribute('data-side'), b.getAttribute('data-holder'));
    if (b.hasAttribute('data-handover')) {
      // The answer shows on the button right away (and both wait) until the server has it.
      if (ui.handing) return;
      const yes = b.hasAttribute('data-yes');
      ui.handing = yes ? 'yes' : 'no'; paint();
      return lanes({ action: 'answer', from: b.getAttribute('data-handover'), yes }).finally(() => { ui.handing = null; paint(); });
    }
    if (b.hasAttribute('data-undo')) return undo(b.getAttribute('data-undo'));
    if (b.hasAttribute('data-shot')) { const pts = Number(b.getAttribute('data-shot')), made = b.hasAttribute('data-made'); return want(`s${pts}${made ? 'm' : 'x'}`, () => shot(pts, made)); }
    if (b.hasAttribute('data-act')) return act(b.getAttribute('data-act'), b);
  });
  function holdTap(b) {
    if (ui.locked && b.getAttribute('data-hold') !== 'score') return;
    TAP[b.getAttribute('data-hold')]();
  }
  function holdLong(b) {
    if (ui.locked && b.getAttribute('data-hold') !== 'score') return;
    HOLD[b.getAttribute('data-hold')]();
  }
  // Hold a player: their line. Moving the finger (a scroll) cancels it. Subs are taps only
  // (Paolo, 2026-10-26: drag removed; the Subs sheet does several at once).
  let pickHold = null, holdAt = null;
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-pick]');
    if (!b || e.button > 0) return;
    const id = b.getAttribute('data-pick');
    clearTimeout(pickHold); holdAt = { x: e.clientX, y: e.clientY };
    pickHold = setTimeout(() => { pickHold = null; ui.peek = id; swallowNext = true; gesture = true; paint(); }, HOLD_MS);
  });
  const cancelPickHold = () => { clearTimeout(pickHold); pickHold = null; };
  root.addEventListener('pointerup', cancelPickHold);
  root.addEventListener('pointercancel', cancelPickHold);
  root.addEventListener('pointermove', e => {
    if (pickHold && holdAt && Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 10) cancelPickHold();
  });

  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-hold]'); if (!b) return;
    b._hx = e.clientX; b._hy = e.clientY; b._held = false;
    clearTimeout(b._ht);
    b._ht = setTimeout(() => { b._held = true; b._ht = null; swallowNext = true; gesture = true; holdLong(b); }, HOLD_MS);
  });
  root.addEventListener('pointermove', e => {
    const b = e.target.closest('[data-hold]'); if (!b || !b._ht) return;
    if (Math.hypot(e.clientX - b._hx, e.clientY - b._hy) > 10) { clearTimeout(b._ht); b._ht = null; b._held = true; }
  });
  root.addEventListener('pointerup', e => {
    const b = e.target.closest('[data-hold]'); if (!b) return;
    if (b._ht) { clearTimeout(b._ht); b._ht = null; if (!b._held) holdTap(b); }
  });
  root.addEventListener('pointercancel', e => { const b = e.target.closest('[data-hold]'); if (b && b._ht) { clearTimeout(b._ht); b._ht = null; } });
  root.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold], [data-pick]')) e.preventDefault(); });
  if (wide.addEventListener) wide.addEventListener('change', () => paint());

  // ── Gestures (Paolo, 2026-10-26) ──
  // Swipe a stat button up: FOUL, TO and REB open their kinds (as a hold); a made 2PT/3PT/4PT is the
  // basket plus the foul on the shot (and-one).
  let flick = null;
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-hold="pf"], [data-hold="to"], [data-hold="reb"], [data-shot][data-made]');
    flick = b && !ui.locked ? { b, x: e.clientX, y: e.clientY, done: false } : null;
  });
  root.addEventListener('pointermove', e => {
    if (!flick || flick.done) return;
    const dy = e.clientY - flick.y, dx = e.clientX - flick.x;
    if (dy > -28 || Math.abs(dx) > Math.abs(dy)) return;
    // Recognised: the button says so now, the play happens when the finger lifts (redrawing
    // under a finger that's still down is what made iPhone tap Fix).
    flick.done = true; gesture = true;
    const b = flick.b; clearTimeout(b._ht); b._ht = null; b._held = true;
    b.classList.add('is-flick');
    swallowNext = true;
    const k = b.getAttribute('data-hold');
    const pts = Number(b.getAttribute('data-shot'));
    flick.run = k ? () => HOLD[k]() : pts > 1 ? () => want(`s${pts}a`, () => andOne(pts)) : null;
  });
  // Up or cancelled (iOS ends a swipe either way): a recognised swipe still does its thing.
  const flickEnd = () => { const f = flick; flick = null; if (f && f.done && f.run) f.run(); };
  window.addEventListener('pointerup', flickEnd);
  window.addEventListener('pointercancel', flickEnd);

  // Swipe the last play left to undo it (the Undo button stays).
  let slide = null;
  root.addEventListener('pointerdown', e => {
    const row = e.target.closest('.sc-last'), u = row && row.querySelector('[data-undo]');
    slide = u && !e.target.closest('button') && !ui.locked ? { row, id: u.getAttribute('data-undo'), x: e.clientX, y: e.clientY, dx: 0, live: false } : null;
  });
  root.addEventListener('pointermove', e => {
    if (!slide) return;
    const dx = e.clientX - slide.x, dy = e.clientY - slide.y;
    if (!slide.live) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { slide = null; return; }
      if (dx > -10) return;
      slide.live = true; slide.row.style.transition = 'none';
    }
    slide.dx = Math.min(0, dx);
    const pct = Math.min(1, -slide.dx / 120);
    slide.row.style.transform = `translateX(${slide.dx}px)`;
    slide.row.style.background = `color-mix(in srgb, var(--loss) ${Math.round(pct * 45)}%, var(--surface-2))`;
  });
  const endSlide = () => {
    if (!slide) return;
    const s = slide; slide = null;
    if (!s.live) return;
    swallowClick = true;
    if (s.dx < -90) return undo(s.id);
    s.row.style.transition = 'transform .2s ease, background .2s ease'; s.row.style.transform = ''; s.row.style.background = '';
    if (s.pending) setTimeout(paint, 220);
  };
  root.addEventListener('pointerup', endSlide);
  root.addEventListener('pointercancel', endSlide);

  // Swipe sideways in the Scoresheet (the sheet, or the tablet's dock) for the next tab. The box
  // score's table keeps its own sideways scroll.
  let hs = null;
  root.addEventListener('touchstart', e => {
    const body = e.target.closest('.sc-sheet__b, .sc-dock__b');
    hs = body && e.touches.length === 1 && !e.target.closest('.sc-bx') ? { dock: body.classList.contains('sc-dock__b'), x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  root.addEventListener('touchend', e => {
    if (!hs) return;
    const t = e.changedTouches[0], dx = t.clientX - hs.x, dy = t.clientY - hs.y, d = hs.dock;
    hs = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const keys = TABS.map(x => x[0]), cur = keys.indexOf(d ? ui.dockTab : ui.tab), next = keys[Math.max(0, Math.min(keys.length - 1, cur + (dx < 0 ? 1 : -1)))];
    if (d) { ui.dockTab = next; pref.set('wknd-sc-dock', next); } else { ui.tab = next; pref.set('wknd-sc-tab', next); }
    paint();
  });

  // Swipe down to close: the Scoresheet (from its top, or from the list once it's scrolled to
  // the top), the DNP sheet, a follow-up or a menu. Past 90 px (or a quick flick) it closes;
  // else it springs back.
  let swipe = null;
  const swipeClose = card => {
    if (card.classList.contains('sc-q')) ui.ask = null;
    else if (card.closest('.sc-sheet--dnp')) ui.dnp = null;
    else if (card.closest('.sc-sheet--subs')) ui.subs = null;
    else ui.sheet = false;
  };
  root.addEventListener('touchstart', e => {
    const card = e.target.closest('.sc-sheet--swipe .sc-sheet__in, .sc-sheet--dnp .sc-sheet__in, .sc-sheet--subs .sc-sheet__in, .sc-q--opt, .sc-q--line, .sc-q--menu');
    if (!card || e.touches.length !== 1) return;
    const body = card.querySelector('.sc-sheet__b');
    const fromList = body && body.contains(e.target);
    if (fromList && body.scrollTop > 0) return;
    swipe = { card, y: e.touches[0].clientY, t: Date.now(), dy: 0, fromList, live: false };
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (!swipe) return;
    const dy = e.touches[0].clientY - swipe.y;
    if (!swipe.live) {
      if (dy < 6) { if (dy < -6) swipe = null; return; } // scrolling up the list: not a swipe
      swipe.live = true; swipe.card.style.transition = 'none';
    }
    e.preventDefault();
    swipe.dy = Math.max(0, dy);
    swipe.card.style.transform = `translateY(${swipe.dy}px)`;
    if (swipe.card.classList.contains('sc-q')) swipe.card.style.opacity = String(Math.max(0.3, 1 - swipe.dy / 200));
  }, { passive: false });
  const endSwipe = () => {
    if (!swipe) return;
    const s = swipe; swipe = null;
    if (!s.live) { if (s.pending) paint(); return; }
    const fast = s.dy / Math.max(1, Date.now() - s.t) > 0.6;
    s.card.style.transition = 'transform .2s ease';
    if (s.dy > 90 || (fast && s.dy > 30)) {
      s.card.style.transform = 'translateY(100%)';
      if (s.card.classList.contains('sc-q')) s.card.style.opacity = '0';
      setTimeout(() => { swipeClose(s.card); paint(); }, 180);
    } else {
      s.card.style.transform = ''; s.card.style.opacity = '';
      if (s.pending) setTimeout(paint, 200);
    }
  };
  root.addEventListener('touchend', endSwipe);
  root.addEventListener('touchcancel', endSwipe);

  // Saved again whenever the phone leaves the screen (app switched, locked, closed).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && document.contains(el)) save(); });
  window.addEventListener('pagehide', () => { if (document.contains(el)) save(); });

  // Leaving a live game asks first (a mis-tap on Back mid-game); plays not sent yet are safe on
  // this phone and say so.
  // Leaving lets the side go at once, so the other scorer is told and can take both teams.
  const release = () => { if (multi && ui.lane && navigator.onLine) { try { fetch(laneApi, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: deviceId, action: 'claim', want: null }) }); } catch (e) {} } };
  const leave = el.querySelector('[data-sc-leave]');
  let leaving = false;
  if (leave) leave.addEventListener('click', e => {
    if (leaving) { release(); return; }
    const n = unsent().length;
    if (!n && (ui.locked || !G.rows.length)) { release(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    // Asked in the amber bar at the top, like the other scorer's alerts (Paolo, 2026-10-26).
    ui.leaving = n ? { title: `${n} play${n > 1 ? 's haven’t' : ' hasn’t'} been sent yet`, sub: `${n > 1 ? 'They stay' : 'It stays'} on this phone and ${n > 1 ? 'send' : 'sends'} next time you open this game with signal.` }
      : { title: 'Leave the scorer?', sub: `Every play is saved.${multi && ui.lane && ui.lanes && ui.lanes.others.some(o => o.lane) ? ' The other scorer is told your side is free.' : ''}` };
    paint();
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act="leave-go"], [data-act="leave-stay"]'); if (!b) return;
    e.stopImmediatePropagation();
    if (b.getAttribute('data-act') === 'leave-stay') { ui.leaving = null; return paint(); }
    leaving = true; ui.leaving = null; leave.click();
  }, true);
  window.addEventListener('pagehide', () => { if (document.contains(el)) release(); });

  // The game's video above the scorer (video pass, toggle): made once and kept outside the
  // screen that repaints, so it doesn't reload on every tap.
  let frame = null;
  function showVideo() {
    if (!frame && ui.showVideo) {
      frame = document.createElement('div'); frame.className = 'sc-video';
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(B.video)}?playsinline=1&rel=0" title="Game video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      root.parentNode.insertBefore(frame, root);
    }
    if (frame) frame.hidden = !ui.showVideo;
  }

  paint();
  el._scDrawn = true; // the app's "didn't open" check (public/app.js initScorer) stands down
  sync();
  // Ask the phone to keep this app's saved data (a full or idle phone may otherwise clear it,
  // unsent plays and all).
  if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  // The players' photos (the hold card) come from the app's image cache at the court: fetch
  // them once now, while there's signal.
  if (navigator.onLine) setTimeout(() => { for (const p of pw ? everyone : [...team.a.players, ...team.b.players]) if (p.photo) fetch(p.photo, { credentials: 'same-origin' }).catch(() => {}); }, 1500);
  if (multi) { listen(); if (ui.lane) lanes(); else lanes({ action: 'claim', want: 'both' }); }
}

if (typeof window !== 'undefined') window.wkndScorer = { mount };
