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
// hold = the other kinds (TO, FOUL). Hold the score for the score by quarter, hold a player for
// their line. After some plays a question takes the stat buttons' place (assisted?, who lost
// it?, the foul panel with its free throws, who went off?); tapping the next player or stat
// skips it, except free throws.
//
// Subs: tap a bench player, then the court player coming off (tablet: drag one onto the
// other). A stat by a bench player brings them on and asks who went off. Foul trouble follows
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
import { foldGame, defaultFreeThrows, nextPos, isOvertime, correction, periodIndex } from './score-engine.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
const HOLD_MS = 450;
const SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const SHEET_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>';
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
  const rules = B.rules;
  const team = { a: B.a, b: B.b };
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
  const published = B.status === 'published';
  const video = B.pass === 'video';
  const key = video ? `${gid}:video` : gid;
  // Tablet landscape and laptops: the Scoresheet docks on the right, drag-and-drop subs.
  const wide = window.matchMedia ? matchMedia('(min-width: 900px)') : { matches: false };
  const multi = !video && !published;
  const laneKey = `wknd-lane:${gid}`;
  const readLane = () => { try { const v = localStorage.getItem(laneKey); return ['a', 'b', 'both'].includes(v) ? v : null; } catch (e) { return null; } };
  const storeLane = l => { try { if (l) localStorage.setItem(laneKey, l); else localStorage.removeItem(laneKey); } catch (e) {} };
  // 4PT only at a court with a 4-point line (admin: the court's features); a game with no
  // court set keeps it, so nothing is ever missing.
  const shots = B.fourPoint === false ? [1, 2, 3] : [1, 2, 3, 4];

  // Plays: the server's, plus any this phone made that the server doesn't have yet.
  const rec = (await store.get(key)) || { id: key, events: [], sent: [], secs: rules.periodMin * 60 };
  const events = new Map();
  for (const e of B.events) events.set(e.id, e);
  const serverIds = new Set(B.events.map(e => e.id));
  for (const e of rec.events) if (!events.has(e.id)) events.set(e.id, e);
  const sent = new Set([...rec.sent, ...serverIds]);
  const ui = {
    sel: null, arm: null, ask: null, tip: '', flash: null, flashN: 0, running: false, secs: rec.secs ?? rules.periodMin * 60,
    sync: 'idle', syncMsg: '', locked: published, after: null, lane: multi ? readLane() : 'both', lanes: null, asked: '',
    sheet: false, tab: pref.get('wknd-sc-tab', 'box'), dockTab: pref.get('wknd-sc-dock', 'fouls'), hideDock: false, sheetTeam: 'a', filter: 'all',
    peek: null, redo: null, lastShown: '',
  };

  const list = () => [...events.values()];
  const unsent = () => list().filter(e => !sent.has(e.id));
  const save = () => store.put({ id: key, events: list(), sent: [...sent], secs: ui.secs });
  const fold = () => foldGame(list(), rules, { a: team.a.players.map(p => p.id), b: team.b.players.map(p => p.id) });
  let G = fold();
  const clockStr = () => `${Math.floor(ui.secs / 60)}:${String(ui.secs % 60).padStart(2, '0')}`;

  // ── Sending ──
  let sending = false, retry = null;
  async function sync() {
    clearTimeout(retry);
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
      else { for (const e of batch) sent.add(e.id); ui.sync = 'ok'; ui.syncMsg = ''; await save(); }
    } catch (e) { ui.sync = 'offline'; retry = setTimeout(sync, 8000); }
    sending = false;
    paintPill();
    if (ui.sync === 'ok' && unsent().length) sync();
  }
  // The header pill: the sync state, and with two scorers which side this phone has (tap it to
  // switch, hand over or take over).
  function paintPill() {
    const n = unsent().length;
    const bad = ui.sync === 'offline' || ui.sync === 'error';
    const sides = multi && ui.lane && !ui.locked && (ui.lane !== 'both' || !!(ui.lanes && ui.lanes.others.length));
    pill.className = 'sc-sync' + (bad ? ' is-off' : n ? ' is-wait' : ' is-ok') + (sides ? ' is-side' : '');
    const state = ui.locked && published ? 'Published' : ui.sync === 'offline' ? `Offline · ${n} saved` : ui.sync === 'error' ? `Not sent · ${n}` : n ? `Sending ${n}…` : 'Saved';
    pill.innerHTML = sides && !bad && !n ? `<i class="sc-sync__dot"></i>You: ${esc(sideName(ui.lane))}${CHEV}` : esc(state) + (sides ? CHEV : '');
    pill.title = ui.syncMsg || '';
    if (sides) { pill.setAttribute('role', 'button'); pill.tabIndex = 0; pill.setAttribute('aria-label', `${state}. You score ${sideName(ui.lane)}. Switch, hand over or take over`); }
    else { pill.setAttribute('role', 'status'); pill.removeAttribute('tabindex'); pill.removeAttribute('aria-label'); }
  }
  pill.addEventListener('click', () => { if (pill.classList.contains('is-side')) sideMenu(); });
  // ── Fetching: the screen opens from the phone's copy, so plays made elsewhere (an admin's
  // removals, another phone's) come from the server when it opens and when the signal is back.
  async function pull() {
    if (!navigator.onLine) return;
    try {
      const r = await fetch(api, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      let n = 0;
      for (const e of d.events || []) { sent.add(e.id); if (!events.has(e.id)) { events.set(e.id, e); n++; } }
      if (d.status === 'published') ui.locked = true;
      if (n || ui.locked) { G = fold(); await save(); paint(); }
    } catch (e) { /* no signal: the phone's copy stands */ }
  }
  window.addEventListener('online', () => { pull(); sync(); lanes(); });

  // ── Two scorers ──
  const laneApi = api.replace(/\/events(\?.*)?$/, '/lanes');
  const sideName = l => (l === 'both' ? 'both teams' : team[l].name);
  const mine = t => !multi || ui.lane === 'both' || ui.lane === t;
  const keeper = () => (multi && ui.lanes && ui.lanes.keeper ? ui.lanes.keeper : null);
  const keepsClock = () => { const k = keeper(); return !k || k.me; };
  async function lanes(body = {}) {
    if (!multi || !navigator.onLine) return;
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
    if (d.asked) ui.asked = d.asked;
    if (d.me.lane) ui.asked = '';
    if (d.tookOver) ui.tip = `You took over from ${d.tookOver}.`;
    const k = d.keeper;
    if (k && !k.me && k.clock) {
      const gone = k.clock.running ? Math.round((d.now - k.clock.at) / 1000) : 0;
      ui.secs = Math.max(0, k.clock.secs - gone); ui.running = k.clock.running;
    }
    if (d.others.length) pull();
    paint();
  }
  const pickSide = (want, holder) => {
    if (!holder) return lanes({ action: 'claim', want });
    ui.asked = holder; ui.tip = '';
    return lanes({ action: 'ask', want });
  };
  const holderOf = l => (ui.lanes ? ui.lanes.others.find(o => o.lane && (o.lane === 'both' || l === 'both' || o.lane === l)) : null);
  function sideMenu() {
    const opts = ['a', 'b', 'both'].filter(l => l !== ui.lane).map(l => { const h = holderOf(l); return [l, h ? `Ask ${h.name} for ${sideName(l)}` : `Score ${sideName(l)}`]; });
    if (ui.lane) opts.push(['watch', 'Stop scoring (watch)']);
    if (ui.lanes && ui.lanes.admin) opts.push(...['a', 'b', 'both'].filter(l => holderOf(l)).map(l => [`force:${l}`, `Take over ${sideName(l)} (admin)`]));
    menu('Which side do you score?', opts, k => {
      if (k === 'watch') return lanes({ action: 'claim', want: null });
      if (k.startsWith('force:')) return lanes({ action: 'claim', want: k.slice(6), force: true });
      const h = holderOf(k);
      return pickSide(k, h ? h.name : '');
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
  const laneTimer = multi ? setInterval(() => { if (!document.contains(el)) { clearInterval(laneTimer); if (sock) sock.close(); return; } lanes(); }, 4000) : null;
  const syncTimer = setInterval(() => { if (!document.contains(el)) { clearInterval(syncTimer); clearInterval(tick); return; } if (unsent().length) sync(); }, 10000);
  pull();

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
    if (anchor && fields.type !== 'void') ui.after = e.id;
    G = fold();
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
  const trouble = pf => (!pf ? '' : pf >= rules.foulOut - 1 || pf > quarter() ? 'd' : quarter() >= 2 && pf === quarter() ? 'w' : '');

  // Both orders: with a player picked the stat goes straight in; without one the stat lights
  // up (armed) and the next player tapped gets it.
  function want(key, run) {
    if (ui.sel) return run();
    ui.arm = ui.arm && ui.arm.key === key ? null : { key, run };
    ui.ask = null; ui.tip = ''; paint();
  }
  // A bench player's stat brings them on; ask who went off (skippable: the engine already
  // sits the one who played least recently).
  function benchIn(pid, t, wasOn) {
    if (wasOn.includes(pid) || ui.ask) return;
    ui.ask = { kind: 'wentoff', team: t, pid, q: `${short(pid)} on. Who went off?`, opts: wasOn.map(id => ({ id, label: short(id) })), skip: 'Skip' };
  }
  function shot(pts, made) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    const e = add({ type: pts === 1 ? 'ft' : 'shot', ...(pts > 1 ? { pts } : {}), made, team: t, player: pid }, { flash: { text: made ? `+${pts}` : 'MISS', tone: made ? 'good' : 'bad' } });
    ui.sel = null; ui.tip = '';
    ui.ask = made && pts > 1 ? { kind: 'ast', ref: e.id, team: t, shooter: pid, q: 'Assisted?', skip: 'No assist' } : null;
    benchIn(pid, t, wasOn);
    paint();
  }
  function simple(type, flashText) {
    const pid = ui.sel; const t = byId[pid].team; const wasOn = five(t).slice();
    const e = add({ type, team: t, player: pid }, { flash: { text: flashText, tone: 'plain' } });
    if (type === 'reb') { const row = G.rows.find(r => r.id === e.id); ui.flash.text = row && row.off ? 'OREB' : 'REB'; }
    ui.sel = null; ui.tip = '';
    ui.ask = type === 'stl' ? { kind: 'lost', ref: e.id, team: t, q: 'Who lost it?', opts: five(other(t)).map(id => ({ id, label: short(id) })), skip: 'Team turnover' } : null;
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
    const pid = ui.sel; const t = byId[pid].team, o = other(t);
    const inPenalty = G.teamFouls[t] + 1 >= rules.penaltyAt;
    const prev = G.rows[G.rows.length - 1];
    const e = add({ type: 'foul', team: t, player: pid, kind }, { flash: { text: kind === 'technical' ? 'T' : 'FOUL', tone: 'bad' } });
    if (keepsClock()) ui.running = false; // a foul stops the clock
    ui.sel = null; ui.tip = '';
    const flag = G.flags[pid];
    if (flag) ui.tip = `${byId[pid].name} is ${flag}.`;
    if (kind === 'offensive') { ui.ask = null; return paint(); }
    // The shooter: the other team's player who just shot, when there is one
    const shooter = prev && prev.team === o && prev.player && (prev.type === 'shot' || prev.type === 'ft') && kind !== 'technical' ? prev.player : null;
    ui.ask = { kind: 'fp', ref: e.id, team: t, o, pid, foulKind: kind, n: defaultFreeThrows(kind, { inPenalty }), andOne: false, shooter, done: 0, bench: false };
    paint();
  }
  function teamPlay(t, type, extra = {}) {
    add({ type, team: t, ...extra });
    if ((type === 'team_tech' || type === 'team_to') && keepsClock()) ui.running = false; // whistles stop the clock
    ui.ask = null; ui.sel = null; ui.arm = null; paint();
  }

  // Questions in the stat buttons' place.
  function answer(id) {
    const a = ui.ask; if (!a) return;
    if (a.kind === 'ast') { if (id) add({ type: 'ast', team: a.team, player: id, ref: a.ref }, { flash: { text: 'AST', tone: 'plain' } }); ui.ask = null; }
    else if (a.kind === 'lost') {
      if (id) { add({ type: 'void', target: a.ref }); const old = events.get(a.ref); add({ type: 'stl', team: old.team, player: old.player, from: id }); }
      ui.ask = null;
    } else if (a.kind === 'wentoff') {
      if (id) add({ type: 'sub', team: a.team, in: a.pid, out: id });
      ui.ask = null;
    } else if (a.kind === 'menu') { ui.ask = null; if (id === '__cancel') return paint(); a.act(id); return; }
    paint();
  }
  // Every menu ends with Cancel: closes it, nothing saved.
  const menu = (q, opts, act, def) => { ui.ask = { kind: 'menu', q, opts: [...opts.map(([id, label]) => ({ id, label, def: id === def })), { id: '__cancel', label: 'Cancel', cancel: true }], act }; ui.peek = null; paint(); };

  // What each button does on a tap, and on a hold.
  const TAP = {
    pf: () => want('pf', () => foul('personal')),
    to: () => want('to', () => turnover(null)),
    score: () => {},
  };
  const FOULS = [['personal', 'Personal'], ['shooting', 'Shooting'], ['offensive', 'Offensive'], ['technical', 'Technical'], ['unsportsmanlike', 'Unsportsmanlike'], ['disqualifying', 'Disqualifying']];
  const TOS = [['bad pass', 'Bad pass'], ['lost ball', 'Lost ball'], ['travel', 'Travel'], ['double dribble', 'Double dribble'], ['out of bounds', 'Out of bounds']];
  const HOLD = {
    pf: () => menu('Foul: what kind?', FOULS, k => (ui.sel ? foul(k) : want(`pf:${k}`, () => foul(k))), 'personal'),
    to: () => menu('Turnover: what kind?', TOS, k => (ui.sel ? turnover(k) : want(`to:${k}`, () => turnover(k)))),
    score: () => { ui.peek = 'score'; paint(); },
  };
  // The team's name is its menu: team stats and DNP.
  const teamMenu = t => menu(`${team[t].name}: team stats`, [['to', 'Team turnover'], ['shot clock', 'Shot clock violation'], ['3 seconds', '3 seconds'], ['5 seconds', '5 seconds'], ['8 seconds', '8 seconds'], ['coach T', 'Coach technical'], ['bench T', 'Bench technical'], ['dnp', 'DNP: who didn’t play…']],
    k => (k === 'dnp' ? dnpMenu(t) : k === 'to' ? teamPlay(t, 'team_to') : k.endsWith(' T') ? teamPlay(t, 'team_tech', { kind: k.slice(0, -2) }) : teamPlay(t, 'team_to', { kind: k })));
  function timeout(t) {
    if (G.timeouts.left[t] <= 0) return;
    ui.running = false; teamPlay(t, 'timeout');
  }
  function endPeriod() {
    const cur = G.period, i = Number(cur.replace(/\D/g, '')) + (isOvertime(cur) ? 4 : 0);
    const next = i < 4 ? `Q${i + 1}` : `OT${i - 3}`;
    const note = isOvertime(next) ? `${rules.otMin} min, 1 timeout each, team fouls carry on` : next === 'Q3' ? '3 timeouts each, team fouls reset' : 'team fouls reset';
    menu(`End ${cur} and start ${next}? (${note})`, [['end', `End ${cur}`], ['no', 'Not yet']], k => {
      if (k !== 'end') return;
      add({ type: 'period_end', period: cur });
      ui.running = false; ui.secs = (isOvertime(next) ? rules.otMin : rules.periodMin) * 60; ui.tip = `${next} started.`;
      save(); paint();
    }, 'end');
  }
  const gameMenu = () => menu(`${G.period} · ${clockStr()}`, [['refs', 'Refs stopped play…'], ['end', `End ${G.period}`], ['clock', 'Fix the clock'], ...(video && B.video ? [['video', ui.showVideo ? 'Hide the video' : 'Show the video']] : [])], k => {
    if (k === 'refs') return menu('Refs stopped play: why?', [['injury', 'Injury'], ['equipment', 'Equipment'], ['clock', 'Clock / scoreboard'], ['coach', 'Talking to a coach'], ['other', 'Other']], r => { ui.running = false; teamPlay(null, 'stoppage', { kind: r }); });
    if (k === 'end') return endPeriod();
    if (k === 'clock') return clockMenu();
    if (k === 'video') { ui.showVideo = !ui.showVideo; showVideo(); return paint(); }
  });

  // ── Subs ──
  // Tap a bench player, then the court tile of the one coming off (or drag, on a tablet). Each
  // is a 'sub' play (score-engine): the player going on takes that tile's place, the one coming
  // off sits until they play again.
  function doSub(t, inId, outId) {
    if (!inId || !outId || inId === outId) return;
    add({ type: 'sub', team: t, in: inId, out: outId });
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
  function undo(id) {
    const old = events.get(id); if (!old) return;
    const row = G.rows.find(r => r.id === id);
    ui.redoText = row ? playText(row) : '';
    add({ type: 'void', target: id });
    ui.redo = id; ui.ask = null; ui.tip = ''; paint();
  }
  function redo() {
    const old = events.get(ui.redo); if (!old) return;
    const { id: _id, pos: _pos, at: _at, ...fields } = old;
    const e = { ...fields, id: uid(), pos: nextPos(list(), old.id), at: Date.now(), dev: deviceId };
    events.set(e.id, e);
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
    return `<div class="sc-sheet" role="dialog" aria-modal="true" aria-label="${esc(team[d.t].name)}: who didn’t play"><div class="sc-sheet__in">
      <div class="sc-sheet__h"><b>${esc(team[d.t].name)}: who didn’t play?</b><button type="button" class="sc-hbtn" data-act="dnp-close">Cancel</button></div>
      <p class="sc-sheet__note">Late or absent. Players with a play already aren’t listed. If a DNP player comes in, their first stat clears it.</p>
      <div class="sc-dnp">${list.map(p => `<button type="button" data-dnp-toggle="${esc(p.id)}" aria-pressed="${d.sel.has(p.id)}">${esc(p.number ? '#' + p.number + ' ' : '')}${esc(p.short)}</button>`).join('')}</div>
      <button type="button" class="sc-dnp__save" data-act="dnp-save">Save${d.sel.size ? ` · ${d.sel.size} DNP` : ''}</button></div></div>`;
  };
  const clockMenu = () => {
    if (!keepsClock()) { ui.tip = `${keeper().name} keeps the clock.`; return paint(); }
    menu('Fix the clock', [['+5', '+5 s'], ['+1', '+1 s'], ['-1', '−1 s'], ['-5', '−5 s'], ['reset', 'Period start']], k => {
      const full = (isOvertime(G.period) ? rules.otMin : rules.periodMin) * 60;
      ui.secs = k === 'reset' ? full : Math.max(0, Math.min(full, ui.secs + Number(k)));
      save(); paint();
    });
  };

  // ── Clock ──
  const tick = setInterval(() => {
    if (!ui.running) return;
    if (ui.secs <= 0) { ui.running = false; ui.tip = `End of ${G.period} on the clock. ⋯ → End when the period is over.`; paint(); return; }
    ui.secs--;
    const c = root.querySelector('[data-sc-clock]'); if (c) c.textContent = clockStr();
    if (ui.secs % 15 === 0) save();
  }, 1000);

  // ── Drawing ──
  // Team fouls: white pips; at one from the penalty the 5th is outlined red; in the penalty all
  // red; past five, the number in red.
  const pips = t => {
    const n = G.teamFouls[t], at = rules.penaltyAt;
    const label = `${n} team foul${n === 1 ? '' : 's'}${G.penalty[t] ? ', in the penalty' : G.penaltyNext[t] ? ', penalty next' : ''}. Tap for the fouls`;
    const body = n > at ? `<b class="sc-pips__n num">${n}</b>`
      : `<span class="sc-pips">${Array.from({ length: at }, (_, i) => `<i class="${n >= at ? 'pen' : i < n ? 'on' : n === at - 1 && i === at - 1 ? 'next' : ''}"></i>`).join('')}</span>`;
    return `<button type="button" class="sc-pipbtn" data-act="fouls" data-team="${t}" aria-label="${esc(team[t].name)}: ${label}">${body}</button>`;
  };
  const dots = t => `<span class="sc-dots" role="img" aria-label="${G.timeouts.left[t]} timeout${G.timeouts.left[t] === 1 ? '' : 's'} left">${Array.from({ length: G.timeouts.allowance }, (_, i) => `<i class="${i < G.timeouts.left[t] ? 'on' : ''}"></i>`).join('')}</span>`;
  const sideBoard = t => `<div class="sc-tm sc-tm--${t}">
      <div class="sc-tm__r"><button type="button" class="sc-tm__s" data-hold="score" aria-label="${esc(team[t].name)} ${G.score[t]}. Hold for the score by quarter"><span class="dot" style="--c:${esc(team[t].color)}"></span><span class="num">${G.score[t]}</span></button>${dots(t)}</div>
      ${pips(t)}
    </div>`;
  // Name size: long names shrink a little, then wrap; shared numbers get a bigger name; no
  // number on file and the name takes the big slot.
  const nameSize = p => {
    const L = (p.short || '').length || 1;
    if (!p.number) return Math.max(11, Math.min(17, Math.floor(60 / (L * 0.5))));
    if (shared.has(p.id)) return 13;
    return Math.max(10, Math.min(11, Math.round((58 / (L * 0.62)) * 2) / 2));
  };
  const tile = id => {
    // The ring and float play once, right after the tap: a later repaint (a sync, the other
    // scorer's play) mustn't start them again.
    const p = byId[id], L = G.players[id] || {}, pf = L.pf || 0, tr = trouble(pf), hit = ui.flash && ui.flash.pid === id && Date.now() - ui.flash.at < 900;
    const benchSel = ui.sel && byId[ui.sel] && byId[ui.sel].team === p.team && !onCourt(p.team, ui.sel);
    const cls = ['sc-p', ui.sel === id ? 'on' : '', tr === 'd' ? 'is-d' : tr === 'w' ? 'is-w' : '', shared.has(id) ? 'is-dup' : '', p.number ? '' : 'is-nonum', benchSel ? 'swap' : '',
      hit ? `ring ${ui.flash.tone} b${ui.flashN % 2} r${ui.flashN % 2}` : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" style="--c:${esc(team[p.team].color)};--fs:${nameSize(p)}" data-pick="${esc(id)}" aria-pressed="${ui.sel === id}" aria-label="${esc(short(id))}, ${pf} foul${pf === 1 ? '' : 's'}${benchSel ? `. Tap to sub ${esc(short(ui.sel))} on for them` : ''}. Hold for their line">
      ${p.number ? `<b class="sc-p__no num" aria-hidden="true">${esc(p.number)}</b>` : ''}${pf ? `<em class="sc-p__pf num${tr ? ' ' + tr : ''}" aria-hidden="true">${pf}F</em>` : ''}<span class="sc-p__nm">${esc(p.short)}</span><i class="sc-p__sw" aria-hidden="true">${SWAP}</i>${hit ? `<i class="sc-fl ${ui.flash.tone} f${ui.flashN % 2}" aria-hidden="true">${esc(ui.flash.text)}</i>` : ''}</button>`;
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
    const rest = team[t].players.filter(p => !on.includes(p.id) && !G.dnp.includes(p.id));
    const noTO = G.timeouts.left[t] <= 0;
    return `<section class="sc-team${multi && ui.lane === t ? ' sc-team--solo' : ''}">
      <div class="sc-th"><button type="button" class="sc-th__n" data-act="teammenu" data-team="${t}" aria-label="${esc(team[t].name)}: team stats, DNP"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}${CHEV}</button>
        <button type="button" class="sc-tb" data-act="timeout" data-team="${t}"${noTO ? ` disabled aria-label="${esc(team[t].name)}: no timeouts left"` : ''}>Timeout</button></div>
      <div class="sc-five">${on.map(tile).join('')}</div>
      ${rest.length || dnps.length ? `<div class="sc-bench">${rest.map(p => {
        const out = G.flags[p.id];
        return `<button type="button" class="sc-bn${out ? ' is-out' : ui.sel === p.id ? ' on' : ''}" data-pick="${esc(p.id)}"${out ? ' disabled' : ''} aria-pressed="${ui.sel === p.id}" aria-label="${esc(short(p.id))}, bench${out ? `, ${out}` : ''}">${p.number ? `<i class="num">${esc(p.number)}</i>` : ''}<s>${esc(p.short)}</s></button>`;
      }).join('')}${dnps.length ? `<button type="button" class="sc-bn is-dnp" data-act="dnp" data-team="${t}" aria-label="${dnps.length} didn’t play: ${esc(dnps.map(p => p.short).join(', '))}. Tap to change">DNP · ${dnps.length}</button>` : ''}</div>` : ''}
    </section>`;
  };
  const playText = r => {
    if (r.type === 'period_end') return `<b>End of ${esc(r.period)}</b>`;
    if (r.type === 'sub') return `<b>${esc(short(r.in))}</b> on for ${esc(short(r.out))}`;
    if (r.type === 'dnp') return `<b>${esc(short(r.player))}</b> ${r.on === false ? 'back on the roster' : 'didn’t play'}`;
    const who = r.player ? short(r.player) : r.team ? team[r.team].name : 'Refs';
    const w = { shot: `${r.pts}PT ${r.made ? 'made' : 'missed'}`, ft: `FT ${r.made ? 'made' : 'missed'}`, reb: r.off ? 'offensive rebound' : 'defensive rebound', ast: 'assist', blk: 'block', stl: `steal${r.from ? ` from ${short(r.from)}` : ''}`,
      to: `turnover${r.kind ? ` · ${r.kind}` : ''}`, foul: `${r.kind && r.kind !== 'personal' ? r.kind + ' ' : ''}foul`, team_to: `team turnover${r.kind ? ` · ${r.kind}` : ''}`, team_tech: `technical · ${r.kind || 'coach'}`,
      timeout: 'timeout', stoppage: `stoppage${r.kind ? ` · ${r.kind}` : ''}`, period_end: `end of ${r.period}` }[r.type] || r.type;
    return `<b>${esc(who)}</b> ${esc(w)}`;
  };
  const scores = r => r.type === 'shot' || r.type === 'ft';

  // The question panel: in the stat buttons' place until answered or skipped.
  const optBtn = (id, attrs = 'data-ask', on = false) => {
    const p = byId[id];
    return `<button type="button" class="sc-opt${on ? ' on' : ''}" ${attrs}="${esc(id)}" aria-pressed="${on}">${p.number ? `<b class="num">${esc(p.number)}</b>` : ''}<span>${esc(p.short)}</span></button>`;
  };
  function question() {
    const a = ui.ask;
    if (a && a.kind === 'fp') {
      const L = G.players[a.pid] || {}, pf = L.pf || 0, tr = trouble(pf);
      const shooters = a.foulKind === 'technical' || a.bench ? team[a.o].players.filter(p => !G.flags[p.id]).map(p => p.id) : five(a.o);
      const st = G.penalty[a.team] ? '<span class="sc-q__pen num">IN THE PENALTY</span>' : '';
      const fts = Array.from({ length: a.n }, (_, i) => {
        const done = i < a.done;
        return `<span class="sc-ft__l num">FT${i + 1}</span>${done ? `<span class="sc-ft__done${a.res[i] ? ' good' : ' bad'}">${a.res[i] ? 'Made' : 'Missed'}</span>`
          : `<button type="button" class="sc-st sc-st--made" data-fpft="1"${!a.shooter || i !== a.done ? ' disabled' : ''} aria-label="Free throw ${i + 1} made">${CHECK}</button><button type="button" class="sc-st sc-st--miss" data-fpft="0"${!a.shooter || i !== a.done ? ' disabled' : ''} aria-label="Free throw ${i + 1} missed">✕</button>`}`;
      }).join('');
      return `<div class="sc-q" role="group" aria-label="Foul and free throws">
        <div class="sc-q__h"><b>Foul · ${esc(short(a.pid))}</b><span class="sc-q__o${tr ? ' ' + tr : ''}">${ordinal(pf)}</span>${st}</div>
        <div class="sc-q__row">${[0, 1, 2, 3].map(n => `<button type="button" class="sc-ftc num${a.n === n ? ' on' : ''}" data-fpn="${n}" aria-pressed="${a.n === n}" aria-label="${n} free throw${n === 1 ? '' : 's'}"${a.done ? ' disabled' : ''}>${n}</button>`).join('')}<span class="sc-q__sp"></span><button type="button" class="sc-ftc sc-ftc--txt${a.andOne ? ' on' : ''}" data-fpand aria-pressed="${a.andOne}"${a.done ? ' disabled' : ''}>And-one</button></div>
        ${a.n ? `<div class="sc-q__opts sc-q__opts--6">${shooters.map(id => optBtn(id, 'data-fpsh', a.shooter === id)).join('')}${a.foulKind === 'technical' || a.bench ? '' : '<button type="button" class="sc-opt sc-opt--more" data-fpbench>Bench</button>'}</div>
        <div class="sc-ft" style="--n:${a.n}">${fts}</div>` : ''}
      </div>`;
    }
    if (a && a.kind === 'ast') {
      const opts = a.bench ? team[a.team].players.filter(p => p.id !== a.shooter && !onCourt(a.team, p.id) && !G.flags[p.id]).map(p => p.id) : five(a.team).filter(id => id !== a.shooter);
      return `<div class="sc-q" role="group" aria-label="Assisted?"><div class="sc-q__h"><b>${esc(a.q)}</b><span class="sc-q__sp"></span><button type="button" class="sc-skip" data-ask="">${esc(a.skip)}</button></div>
        <div class="sc-q__opts">${opts.map(id => optBtn(id)).join('')}${a.bench ? '' : `<button type="button" class="sc-opt sc-opt--more" data-astbench><b>Bench</b></button>`}</div></div>`;
    }
    if (a && (a.kind === 'lost' || a.kind === 'wentoff')) {
      return `<div class="sc-q" role="group" aria-label="${esc(a.q)}"><div class="sc-q__h"><b>${esc(a.q)}</b><span class="sc-q__sp"></span><button type="button" class="sc-skip" data-ask="">${esc(a.skip)}</button></div>
        <div class="sc-q__opts">${a.opts.map(o => optBtn(o.id)).join('')}</div></div>`;
    }
    if (a && a.kind === 'menu') {
      return `<div class="sc-q sc-q--menu" role="group" aria-label="${esc(a.q)}"><div class="sc-q__h"><b>${esc(a.q)}</b></div>
        <div class="sc-menu">${a.opts.map(o => `<button type="button" class="${o.def ? 'def' : o.cancel ? 'cancel' : ''}" data-ask="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div></div>`;
    }
    if (multi && ui.lanes && ui.lanes.asks.length) {
      const k = ui.lanes.asks[0];
      return `<div class="sc-q" role="group"><div class="sc-q__h"><b>${esc(k.name)} asks to score ${esc(sideName(k.lane))}</b></div>
        <div class="sc-menu"><button type="button" class="def" data-handover="${esc(k.device)}" data-yes="1">Hand it over</button><button type="button" data-handover="${esc(k.device)}">Keep it</button></div></div>`;
    }
    if (multi && !ui.lane && !ui.locked) {
      return `<div class="sc-q" role="group"><div class="sc-q__h"><b>${ui.asked ? `Asked ${esc(ui.asked)}. Waiting for them to hand it over…` : ui.lanes && ui.lanes.others.length ? `${esc(ui.lanes.others.filter(o => o.lane).map(o => `${o.name} scores ${sideName(o.lane)}`).join(', ') || 'Someone is here')}. Which side do you score?` : 'Which side do you score?'}</b></div>
        <div class="sc-menu">${['a', 'b', 'both'].map(l => { const h = holderOf(l); return `<button type="button" data-side="${l}" data-holder="${esc(h ? h.name : '')}">${h ? `Ask for ${esc(sideName(l))}` : `Score ${esc(sideName(l))}`}</button>`; }).join('')}${ui.lanes && ui.lanes.admin ? '<button type="button" data-act="sides">Take over…</button>' : ''}</div></div>`;
    }
    return '';
  }
  const pad = () => {
    const arm = k => (ui.arm && ui.arm.key === k ? ' arm' : '');
    const lab = p => (p === 1 ? 'FT' : p + 'PT');
    return `<div class="sc-pad sc-pad--${shots.length}">
        ${shots.map(p => `<button type="button" class="sc-st sc-st--made${arm(`s${p}m`)}" data-shot="${p}" data-made="1" aria-pressed="${!!arm(`s${p}m`)}" aria-label="${lab(p)} made">${lab(p)}</button>`).join('')}
        ${shots.map(p => `<button type="button" class="sc-st sc-st--miss${arm(`s${p}x`)}" data-shot="${p}" aria-pressed="${!!arm(`s${p}x`)}" aria-label="${lab(p)} missed">${lab(p)}</button>`).join('')}
      </div>
      <div class="sc-pad sc-pad--6">
        <button type="button" class="sc-st${arm('reb')}" data-act="reb" aria-label="Rebound (offensive or defensive is worked out)">REB</button>
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
    if (ui.redo) {
      return `<div class="sc-last" role="status"><span class="sc-last__w">Undone: ${ui.redoText || ''}</span><button type="button" class="sc-lb sc-lb--amber" data-act="redo">Redo</button></div>`;
    }
    const mineRows = G.rows.filter(r => !r.dev || r.dev === deviceId);
    const r = mineRows[mineRows.length - 1];
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
      return `${head}<button type="button" class="sc-pbp__r" data-fix="${esc(r.id)}" aria-label="${esc(playText(r).replace(/<[^>]+>/g, ''))}. Fix"><span class="sc-pbp__t num">${esc(r.clock || '')}</span>${r.team ? `<span class="dot" style="--c:${esc(team[r.team].color)}"></span>` : '<span></span>'}<span class="sc-pbp__w">${playText(r)}</span><span class="sc-pbp__s num${scores(r) && r.made ? ' on' : ''}">${scores(r) && r.made ? `${r.score.a}–${r.score.b}` : ''}</span></button>`;
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
      const tr = trouble(pf), note = G.flags[p.id] ? G.flags[p.id] : pf === rules.foulOut - 1 ? 'one more and out' : o ? '' : 'bench';
      return `<div class="sc-fl__r"><span class="sc-fl__top"><i class="${o ? 'on' : ''}"></i><b>${esc(short(p.id))}</b><small>${esc(note)}</small><span class="num sc-fl__c ${tr}">${pf} PF</span></span><span class="sc-fl__bar"><i class="${tr === 'd' ? 'd' : ''}" style="width:${Math.min(100, (pf / rules.foulOut) * 100)}%"></i></span></div>`;
    }).join('') || '<p class="sc-empty">No fouls yet.</p>'}</div>
      <div class="sc-fls__sum"><span>Technicals <b>${tech}</b></span><span>Fouled out <b>${outs}</b></span></div>`;
  }
  const sheetBody = tab => (tab === 'plays' ? playsTab() : tab === 'fouls' ? foulsTab() : boxTab());
  const sheetTabs = (tab, attr) => `<div class="sc-stabs" role="tablist" aria-label="Scoresheet">${TABS.map(([k, l]) => `<button type="button" role="tab" class="sc-stab${tab === k ? ' on' : ''}" aria-selected="${tab === k}" ${attr}="${k}">${l}</button>`).join('')}</div>`;

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
    const p = byId[ui.peek]; if (!p) return '';
    const L = G.players[p.id] || {}, z = k => L[k] || 0;
    const m = z('fg2m') + z('fg3m') + z('fg4m'), a = m + z('fg2m_miss') + z('fg3m_miss') + z('fg4m_miss');
    return `<div class="sc-peek" data-act="peek-close"><div class="sc-pop sc-pop--p" role="dialog" aria-label="${esc(short(p.id))}, this game">
      <div class="sc-pop__who"><b>${esc(short(p.id))}</b><span>${esc(team[p.team].name)} · ${onCourt(p.team, p.id) ? 'on court' : 'bench'}</span></div>
      <div class="sc-pop__line">${[['PTS', z('pts')], ['REB', z('reb')], ['AST', z('ast')], ['STL', z('stl')], ['TO', z('turnover')], ['PF', z('pf')]].map(([k, v]) => `<span${k === 'PF' && trouble(v) ? ` class="${trouble(v)}"` : ''}><b class="num">${v}</b><small class="num">${k}</small></span>`).join('')}</div>
      <div class="sc-pop__line sc-pop__line--3">${[['FG', `${m}-${a}`], ['3PT', `${z('fg3m')}-${z('fg3m') + z('fg3m_miss')}`], ['FT', `${z('ftm')}-${z('ftm') + z('ft_miss')}`]].map(([k, v]) => `<span><b class="num">${v}</b><small class="num">${k}</small></span>`).join('')}</div>
    </div></div>`;
  }

  function paint() {
    const q = question();
    const docked = wide.matches && !ui.hideDock;
    root.classList.toggle('is-docked', docked);
    root.innerHTML = `
      <div class="sc-left">
        ${ui.locked ? '<div class="msg msg--info sc-msg">This game is published. The scorer is read-only now.</div>' : ''}
        ${ui.sync === 'error' && ui.syncMsg ? `<div class="msg msg--err sc-msg" role="alert">${esc(ui.syncMsg)}</div>` : ''}
        <div class="sc-board">
          ${sideBoard('a')}
          <div class="sc-clk"><span class="sc-clk__p num">${video ? 'Video · ' : ''}${esc(G.period)}</span>
            <div class="sc-clk__row">
              <button type="button" class="sc-clk__t num" data-act="clockset" data-sc-clock aria-label="Game clock ${clockStr()}. Tap to fix it">${clockStr()}</button>
              ${keepsClock() ? `<button type="button" class="sc-cb sc-cb--go" data-act="clock" aria-label="${ui.running ? 'Pause clock' : 'Start clock'}">${ui.running ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button>`
                : `<span class="sc-keeper num" aria-label="${esc(keeper().name)} keeps the clock">${esc(keeper().name.split(' ')[0])}</span>`}
              <button type="button" class="sc-cb" data-act="game" aria-label="Game: refs stopped play, end the period, fix the clock"><svg viewBox="0 0 12 4" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1.6"/><circle cx="6" cy="2" r="1.6"/><circle cx="10" cy="2" r="1.6"/></svg></button>
            </div></div>
          ${sideBoard('b')}
        </div>
        <div class="sc-teams">${teamBlock('a')}${teamBlock('b')}</div>
        <div class="sc-bottom">
          ${ui.tip ? `<p class="sc-tip" role="status">${esc(ui.tip)}</p>` : ''}
          ${lastRow()}
          ${q || `<div class="sc-padw">${pad()}</div>`}
          ${!docked && !q ? `<button type="button" class="sc-sheetbtn" data-act="sheet">${SHEET_ICON}Scoresheet</button>` : ''}
        </div>
      </div>
      ${docked ? `<aside class="sc-dock" aria-label="Scoresheet"><div class="sc-dock__h"><b>Scoresheet</b><button type="button" class="sc-hbtn" data-act="dock-hide" aria-label="Hide the scoresheet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>${sheetTabs(ui.dockTab, 'data-dtab')}<div class="sc-dock__b">${sheetBody(ui.dockTab)}</div></aside>`
        : wide.matches ? '<button type="button" class="sc-dock-show" data-act="dock-show" aria-label="Show the scoresheet">Scoresheet</button>' : ''}
      ${dnpSheet()}
      ${ui.sheet && !docked ? `<div class="sc-sheet" role="dialog" aria-modal="true" aria-label="Scoresheet"><div class="sc-sheet__in sc-sheet__in--tall">
        <div class="sc-sheet__h"><b>Scoresheet</b><button type="button" class="sc-hbtn sc-hbtn--amber" data-act="sheet-close">Done</button></div>
        ${sheetTabs(ui.tab, 'data-tab')}<div class="sc-sheet__b">${sheetBody(ui.tab)}</div></div></div>` : ''}
      ${peek()}`;
    paintPill();
  }

  // ── Input: one listener for taps, holds handled with per-button timers ──
  function act(name, b) {
    const t = b.getAttribute('data-team');
    if (name === 'clock') { ui.running = !ui.running; if (ui.running) ui.tip = ''; save(); return paint(); }
    if (name === 'game') return gameMenu();
    if (name === 'teammenu') return teamMenu(t);
    if (name === 'dnp') return dnpMenu(t);
    if (name === 'sides') return sideMenu();
    if (name === 'dnp-save') return dnpSave();
    if (name === 'dnp-close') { ui.dnp = null; return paint(); }
    if (name === 'clockset') return clockMenu();
    if (name === 'sheet') { ui.sheet = true; ui.sel = null; ui.arm = null; return paint(); }
    if (name === 'sheet-close') { ui.sheet = false; return paint(); }
    if (name === 'fouls') { ui.sheetTeam = t; if (wide.matches) { ui.hideDock = false; ui.dockTab = 'fouls'; } else { ui.sheet = true; ui.tab = 'fouls'; } return paint(); }
    if (name === 'dock-hide') { ui.hideDock = true; return paint(); }
    if (name === 'dock-show') { ui.hideDock = false; return paint(); }
    if (name === 'peek-close') { ui.peek = null; return paint(); }
    if (name === 'insert-done') { ui.after = null; ui.tip = ''; return paint(); }
    if (name === 'redo') return redo();
    if (name === 'timeout') return timeout(t);
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
    if (a && a.kind === 'fp' && !a.shooter && p.team === a.o) { a.shooter = id; return paint(); }
    if (a && a.kind === 'fp' && a.done > 0 && a.done < a.n) return; // free throws first
    if (ui.arm) { ui.sel = id; ui.ask = null; const run = ui.arm.run; ui.arm = null; return run(); }
    const s = ui.sel && byId[ui.sel];
    if (s && s.team === p.team && !onCourt(p.team, ui.sel) && onCourt(p.team, id)) { doSub(p.team, ui.sel, id); ui.sel = null; ui.ask = null; return paint(); }
    ui.sel = ui.sel === id ? null : id; ui.ask = null; ui.tip = ''; ui.redo = null; paint();
  }
  let swallowClick = false;
  root.addEventListener('click', e => {
    if (swallowClick) { e.preventDefault(); return; }
    const b = e.target.closest('button, [data-act="peek-close"]'); if (!b || b.disabled) return;
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
    if (b.hasAttribute('data-astbench')) { ui.ask.bench = true; return paint(); }
    if (b.hasAttribute('data-fpbench')) { ui.ask.bench = true; return paint(); }
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
      if (a.done >= a.n) ui.ask = null;
      return paint();
    }
    if (b.hasAttribute('data-dnp-toggle') && ui.dnp) { const id = b.getAttribute('data-dnp-toggle'); ui.dnp.sel.has(id) ? ui.dnp.sel.delete(id) : ui.dnp.sel.add(id); return paint(); }
    if (b.hasAttribute('data-side')) return pickSide(b.getAttribute('data-side'), b.getAttribute('data-holder'));
    if (b.hasAttribute('data-handover')) { const yes = b.hasAttribute('data-yes'); return lanes({ action: 'answer', from: b.getAttribute('data-handover'), yes }); }
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
  // Hold a player: their line. Drag (tablet and laptop widths): a bench player onto a court
  // tile, or the other way, is a sub.
  let drag = null, pickHold = null;
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-pick]');
    if (!b || e.button > 0) return;
    const id = b.getAttribute('data-pick');
    clearTimeout(pickHold);
    pickHold = setTimeout(() => { pickHold = null; ui.peek = id; swallowClick = true; setTimeout(() => { swallowClick = false; }, 400); paint(); }, HOLD_MS);
    if (wide.matches && !ui.locked) drag = { b, id, x: e.clientX, y: e.clientY, on: false };
  });
  const cancelPickHold = () => { clearTimeout(pickHold); pickHold = null; };
  root.addEventListener('pointerup', cancelPickHold);
  root.addEventListener('pointercancel', cancelPickHold);
  root.addEventListener('pointermove', e => {
    if (pickHold && drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) cancelPickHold();
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
      drag.on = true; cancelPickHold();
      drag.ghost = document.createElement('div'); drag.ghost.className = 'sc-ghost'; drag.ghost.textContent = short(drag.id);
      document.body.appendChild(drag.ghost); drag.b.classList.add('is-drag');
    }
    drag.ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY + 8}px)`;
    const over = document.elementFromPoint(e.clientX, e.clientY);
    const target = over && over.closest('[data-pick]');
    root.querySelectorAll('.is-drop').forEach(x => x.classList.remove('is-drop'));
    if (target && target !== drag.b && subTarget(drag.id, target.getAttribute('data-pick'))) target.classList.add('is-drop');
  });
  // Dragging works between the court and the bench of the same team.
  const subTarget = (a, b) => byId[a] && byId[b] && byId[a].team === byId[b].team && onCourt(byId[a].team, a) !== onCourt(byId[a].team, b);
  const endDrag = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) return;
    d.ghost.remove(); d.b.classList.remove('is-drag');
    root.querySelectorAll('.is-drop').forEach(x => x.classList.remove('is-drop'));
    const over = e && document.elementFromPoint(e.clientX, e.clientY);
    const target = over && over.closest('[data-pick]');
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 50);
    if (!target || !subTarget(d.id, target.getAttribute('data-pick'))) return;
    const t = byId[d.id].team, o = target.getAttribute('data-pick');
    const [inId, outId] = onCourt(t, d.id) ? [o, d.id] : [d.id, o];
    doSub(t, inId, outId); paint();
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', () => endDrag(null));

  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-hold]'); if (!b) return;
    b._hx = e.clientX; b._hy = e.clientY; b._held = false;
    clearTimeout(b._ht);
    b._ht = setTimeout(() => { b._held = true; b._ht = null; holdLong(b); }, HOLD_MS);
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

  // Leaving a live game asks first (a mis-tap on Back mid-game); plays not sent yet are safe on
  // this phone and say so.
  const leave = el.querySelector('[data-sc-leave]');
  if (leave) leave.addEventListener('click', e => {
    const n = unsent().length;
    if (n) { if (!window.confirm(`${n} play${n > 1 ? 's haven’t' : ' hasn’t'} been sent yet. ${n > 1 ? 'They stay' : 'It stays'} on this phone and ${n > 1 ? 'send' : 'sends'} next time you open this game with signal. Leave anyway?`)) e.preventDefault(); return; }
    if (!ui.locked && G.rows.length && !window.confirm('Leave the scorer? Every play is saved.')) e.preventDefault();
  });

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
  sync();
  if (multi) { listen(); if (ui.lane) lanes(); else lanes({ action: 'claim', want: 'both' }); }
}

if (typeof window !== 'undefined') window.wkndScorer = { mount };
