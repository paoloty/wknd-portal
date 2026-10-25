// The scorer screen (views/app/score.js renders the shell; server.js /api/score/:id/events takes
// the plays). Phase 1: one device scores both teams, lineups off, so every player is always
// tappable: the five who played last show first, the rest sit in a row under them.
//
// Every tap becomes a play (public/score-engine.js) that is saved on this phone first
// (IndexedDB) and then sent in batches; a play sent twice is kept once by the server, so a
// flaky connection never loses or doubles a stat. With no signal the screen keeps working and
// says how many plays are waiting. Undo adds a "void" play; nothing is ever deleted.
//
// Buttons with a corner mark: tap = the usual, hold = the other kinds (PF, TO, Team, Refs).
// After some plays a question shows above the stat pad (assist?, who lost it?, free throws,
// who shoots); answering is optional except free throws, and tapping the next player skips it.
//
// Corrections (phase 2): every play in the log has Fix: change who did it or what stat it was
// (a void plus the fixed play in the same spot), add a missed play after it ("Go back here":
// new plays go in there until Done, later running scores update), or remove it. All plays
// opens the whole log. DNP (per team): mark a late or absent player as didn't play; their
// first stat clears it. The video pass (?pass=video, admins) is this same screen re-tracking
// the game from the video: its own plays, an optional embedded video, never on the live score.
//
// Two scorers (phase 3, live pass): each phone holds a side, White, Blue or Both
// (lib/score-lanes.js on the server). It checks in every few seconds; the other side folds away,
// the other phone's plays come in (one shared log, so a rebound after their miss is still
// offensive), a late scorer asks for a side and the holder gets Hand over / Keep it, a phone gone
// quiet can be taken over. One phone keeps the clock (Both, else the first team); the other shows
// it. Plays never wait on any of this: with no signal both phones keep scoring.
import { foldGame, defaultFreeThrows, nextPos, isOvertime, correction } from './score-engine.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
const HOLD_MS = 450;

// ── Storage on the phone: one record per game { id, events, sent: [ids], secs } ──
const store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((ok, no) => {
    if (!window.indexedDB) return no(new Error('no indexedDB'));
    const r = indexedDB.open('wknd-scorer', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('games', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  }));
  return {
    get: id => open().then(db => new Promise((ok, no) => { const q = db.transaction('games').objectStore('games').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => no(q.error); })).catch(() => null),
    put: rec => open().then(db => new Promise((ok, no) => { const tx = db.transaction('games', 'readwrite'); tx.objectStore('games').put(rec); tx.oncomplete = () => ok(true); tx.onerror = () => no(tx.error); })).catch(() => false),
  };
})();
const deviceId = (() => { try { let d = localStorage.getItem('wknd-device'); if (!d) { d = uid(); localStorage.setItem('wknd-device', d); } return d; } catch (e) { return 'unknown'; } })();

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
  const byId = {};
  for (const t of ['a', 'b']) for (const p of team[t].players) byId[p.id] = { ...p, team: t };
  const published = B.status === 'published';
  const video = B.pass === 'video';
  const key = video ? `${gid}:video` : gid;
  // Tablet and laptop widths: drag-and-drop subs (and the tip says so).
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
  const ui = { sel: null, benchFirst: null, ask: null, tip: '', flash: null, flashN: 0, running: false, secs: rec.secs ?? rules.periodMin * 60, sync: 'idle', syncMsg: '', locked: published, after: null, sheet: false, lane: multi ? readLane() : 'both', lanes: null, asked: '' };

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
  function paintPill() {
    const n = unsent().length;
    pill.className = 'sc-sync' + (ui.sync === 'offline' || ui.sync === 'error' ? ' is-off' : n ? ' is-wait' : ' is-ok');
    pill.textContent = ui.locked && published ? 'Published' : ui.sync === 'offline' ? `Offline · ${n} saved` : ui.sync === 'error' ? `Not sent · ${n}` : n ? `Sending ${n}…` : 'All saved';
    pill.title = ui.syncMsg || '';
  }
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
    if (d.me.lane !== ui.lane) { ui.lane = d.me.lane; storeLane(ui.lane); ui.sel = null; }
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
    save().then(sync);
    return e;
  }
  const other = t => (t === 'a' ? 'b' : 'a');
  // The five who played last for a team, topped up from the roster.
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
  const short = id => (byId[id] ? `${byId[id].number ? '#' + byId[id].number + ' ' : ''}${byId[id].short}` : 'Player');
  const needPlayer = () => { ui.tip = 'Tap a player first.'; ui.ask = null; paint(); };

  function shot(pts, made) {
    const pid = ui.sel; if (!pid) return needPlayer();
    const t = byId[pid].team;
    const e = add({ type: pts === 1 ? 'ft' : 'shot', ...(pts > 1 ? { pts } : {}), made, team: t, player: pid }, { flash: { text: made ? `+${pts}` : 'MISS', tone: made ? 'good' : 'bad' } });
    ui.sel = null; ui.tip = '';
    ui.ask = made && pts > 1 ? { kind: 'ast', ref: e.id, team: t, q: `Assisted? ${short(pid)}'s ${pts}PT`, hint: 'optional', opts: five(t).filter(id => id !== pid).map(id => ({ id, label: short(id) })).concat([{ id: '', label: 'No assist' }]) } : null;
    paint();
  }
  function simple(type, flashText) {
    const pid = ui.sel; if (!pid) return needPlayer();
    const t = byId[pid].team;
    const e = add({ type, team: t, player: pid }, { flash: { text: flashText, tone: 'plain' } });
    if (type === 'reb') { const row = G.rows.find(r => r.id === e.id); ui.flash.text = row && row.off ? 'OREB' : 'REB'; }
    ui.sel = null; ui.tip = '';
    ui.ask = type === 'stl' ? { kind: 'lost', ref: e.id, team: t, q: 'Who lost it?', hint: 'skip = team turnover', opts: five(other(t)).map(id => ({ id, label: short(id) })).concat([{ id: '', label: 'Skip' }]) } : null;
    paint();
  }
  function turnover(kind) {
    const pid = ui.sel; if (!pid) return needPlayer();
    add({ type: 'to', team: byId[pid].team, player: pid, ...(kind ? { kind } : {}) }, { flash: { text: 'TO', tone: 'bad' } });
    ui.sel = null; ui.ask = null; ui.tip = ''; paint();
  }
  function foul(kind) {
    const pid = ui.sel; if (!pid) return needPlayer();
    const t = byId[pid].team, o = other(t);
    const inPenalty = G.teamFouls[t] + 1 >= rules.penaltyAt;
    add({ type: 'foul', team: t, player: pid, kind }, { flash: { text: kind === 'technical' ? 'T' : 'PF', tone: 'bad' } });
    if (keepsClock()) ui.running = false; // a foul stops the clock
    ui.sel = null; ui.tip = '';
    const flag = G.flags[pid];
    if (flag) ui.tip = `${byId[pid].name} is ${flag}.`;
    if (kind === 'offensive') { ui.ask = null; return paint(); }
    const def = defaultFreeThrows(kind, { inPenalty });
    const shooters = kind === 'technical' ? team[o].players.map(p => p.id) : five(o);
    ui.ask = { kind: 'fts', team: o, shooters, q: `${kind === 'technical' ? 'Technical' : kind === 'personal' && inPenalty ? 'Penalty' : 'Free throws'}: how many?`, hint: inPenalty && kind === 'personal' ? `${team[t].name}'s ${G.teamFouls[t]}th team foul` : '',
      opts: [0, 1, 2, 3].map(n => ({ id: String(n), label: n === 0 ? 'None' : `${n} FT`, def: n === def })) };
    paint();
  }
  function teamPlay(t, type, extra = {}) {
    add({ type, team: t, ...extra });
    if ((type === 'team_tech' || type === 'team_to') && keepsClock()) ui.running = false; // whistles stop the clock
    ui.ask = null; ui.sel = null; paint();
  }

  // Questions above the pad.
  function answer(id) {
    const a = ui.ask; if (!a) return;
    if (a.kind === 'ast') { if (id) add({ type: 'ast', team: a.team, player: id, ref: a.ref }, { flash: { text: 'AST', tone: 'plain' } }); ui.ask = null; }
    else if (a.kind === 'lost') {
      if (id) { add({ type: 'void', target: a.ref }); const old = events.get(a.ref); add({ type: 'stl', team: old.team, player: old.player, from: id }); }
      ui.ask = null;
    } else if (a.kind === 'fts') {
      const n = Number(id);
      ui.ask = n ? { kind: 'shooter', n, team: a.team, q: 'Who shoots?', hint: `${n} free throw${n > 1 ? 's' : ''}`, opts: a.shooters.map(pid => ({ id: pid, label: short(pid) })) } : null;
    } else if (a.kind === 'shooter') ui.ask = ftAsk(id, a.n, 1);
    else if (a.kind === 'ft') {
      const made = id === 'made';
      add({ type: 'ft', team: byId[a.pid].team, player: a.pid, made }, { flash: { text: made ? '+1' : 'MISS', tone: made ? 'good' : 'bad' } });
      ui.ask = a.i < a.n ? ftAsk(a.pid, a.n, a.i + 1) : null;
    } else if (a.kind === 'menu') { ui.ask = null; if (id === '__cancel') return paint(); a.act(id); return; }
    paint();
  }
  const ftAsk = (pid, n, i) => ({ kind: 'ft', pid, n, i, q: `Free throw ${i} of ${n} · ${short(pid)}`, hint: '', opts: [{ id: 'made', label: 'Made' }, { id: 'miss', label: 'Missed' }] });
  // Every menu ends with Cancel: closes it, nothing saved.
  const menu = (q, opts, act, def) => { ui.ask = { kind: 'menu', q, hint: def ? 'tap = the outlined one' : '', opts: [...opts.map(([id, label]) => ({ id, label, def: id === def })), { id: '__cancel', label: 'Cancel', cancel: true }], act }; paint(); };

  // What each button does on a tap, and on a hold.
  const TAP = {
    pf: () => foul('personal'),
    to: () => turnover(null),
    refs: () => { ui.running = false; teamPlay(null, 'stoppage'); },
  };
  const HOLD = {
    pf: () => (ui.sel ? menu('Foul: what kind?', [['personal', 'Personal'], ['shooting', 'Shooting'], ['offensive', 'Offensive'], ['technical', 'Technical'], ['unsportsmanlike', 'Unsportsmanlike'], ['disqualifying', 'Disqualifying']], k => foul(k), 'personal') : needPlayer()),
    to: () => (ui.sel ? menu('Turnover: what kind?', [['bad pass', 'Bad pass'], ['lost ball', 'Lost ball'], ['travel', 'Travel'], ['double dribble', 'Double dribble'], ['out of bounds', 'Out of bounds']], k => turnover(k)) : needPlayer()),
    refs: () => menu('Referees stopped play: why?', [['injury', 'Injury'], ['equipment', 'Equipment'], ['clock', 'Clock / scoreboard'], ['coach', 'Talking to a coach'], ['other', 'Other']], k => { ui.running = false; teamPlay(null, 'stoppage', { kind: k }); }),
  };
  const teamTap = t => teamPlay(t, 'team_to');
  const teamHold = t => menu(`${team[t].name}: team play`, [['shot clock', 'Shot clock'], ['3 seconds', '3 seconds'], ['5 seconds', '5 seconds'], ['8 seconds', '8 seconds'], ['coach T', 'Coach technical'], ['bench T', 'Bench technical']],
    k => (k.endsWith(' T') ? teamPlay(t, 'team_tech', { kind: k.slice(0, -2) }) : teamPlay(t, 'team_to', { kind: k })), 'shot clock');
  function timeout(t) {
    if (G.timeouts.left[t] <= 0) { ui.tip = `${team[t].name} has no timeouts left.`; return paint(); }
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

  // ── Subs ──
  // Tap: Sub (in the bench row) → who comes off (a court tile) → who goes on (a bench player),
  // either order, as many as needed, then Done. Tablet: drag a bench player onto a court tile
  // or the other way. Each is a 'sub' play (score-engine): the player going on takes that
  // tile's place, the one coming off sits until they play again. A stat by a bench player
  // still brings them on by itself.
  const onCourt = (t, id) => five(t).includes(id);
  function doSub(t, inId, outId) {
    if (!inId || !outId || inId === outId) return;
    add({ type: 'sub', team: t, in: inId, out: outId });
    ui.tip = `${short(inId)} on for ${short(outId)}.`;
  }
  function subPick(id) {
    const s = ui.sub, t = byId[id].team;
    if (t !== s.t) { ui.sub = { t, off: null, on: null }; return subPick(id); }
    if (onCourt(t, id)) s.off = s.off === id ? null : id; else s.on = s.on === id ? null : id;
    if (s.off && s.on) { doSub(t, s.on, s.off); s.off = null; s.on = null; }
    paint();
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
    ui.sheet = false;
    const what = playText(r).replace(/<[^>]+>/g, '');
    const opts = [r.player && STAT_PLAYS.has(r.type) ? ['who', 'Change player'] : null, r.player && STAT_PLAYS.has(r.type) ? ['what', 'Change stat'] : null,
      ['after', 'Add a missed play after this'], ['remove', 'Remove']].filter(Boolean);
    menu(`Fix: ${what}`, opts, k => {
      if (k === 'remove') { add({ type: 'void', target: id }); ui.tip = 'Removed. It stays on record for the review.'; return paint(); }
      if (k === 'after') { ui.after = id; ui.sel = null; ui.tip = ''; return paint(); }
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
      <div class="sc-sheet__h"><b>${esc(team[d.t].name)}: who didn’t play?</b><button type="button" class="sc-undo" data-act="dnp-close">Cancel</button></div>
      <p class="sc-sheet__note">Late or absent. Players with a play already aren’t listed. If a DNP player comes in, their first stat clears it.</p>
      <div class="sc-dnp">${list.map(p => `<button type="button" data-dnp-toggle="${esc(p.id)}" aria-pressed="${d.sel.has(p.id)}">${esc(p.number ? '#' + p.number + ' ' : '')}${esc(p.short)}</button>`).join('')}</div>
      <button type="button" class="sc-dnp__save" data-act="dnp-save">Save${d.sel.size ? ` · ${d.sel.size} DNP` : ''}</button></div></div>`;
  };
  const clockMenu = () => menu('Fix the clock', [['+5', '+5 s'], ['+1', '+1 s'], ['-1', '−1 s'], ['-5', '−5 s'], ['reset', 'Period start']], k => {
    const full = (isOvertime(G.period) ? rules.otMin : rules.periodMin) * 60;
    ui.secs = k === 'reset' ? full : Math.max(0, Math.min(full, ui.secs + Number(k)));
    save(); paint();
  });

  // ── Clock ──
  const tick = setInterval(() => {
    if (!ui.running) return;
    if (ui.secs <= 0) { ui.running = false; ui.tip = `End of ${G.period} on the clock. Tap End when the period is over.`; paint(); return; }
    ui.secs--;
    const c = root.querySelector('[data-sc-clock]'); if (c) c.textContent = clockStr();
    if (ui.secs % 15 === 0) save();
  }, 1000);

  // ── Drawing ──
  const pips = t => [1, 2, 3, 4, 5].map(i => `<i class="${G.teamFouls[t] >= i ? (G.teamFouls[t] >= rules.penaltyAt ? 'pen' : G.teamFouls[t] === rules.penaltyAt - 1 ? 'warn' : 'on') : ''}"></i>`).join('');
  const dots = t => Array.from({ length: G.timeouts.allowance }, (_, i) => `<i class="${i < G.timeouts.left[t] ? 'on' : ''}"></i>`).join('');
  // The pips show the count; words only when it matters (and the pips' label says it for screen readers).
  const penText = t => (G.penalty[t] ? '<b class="is-pen">PENALTY</b>' : G.penaltyNext[t] ? '<b class="is-warn">PENALTY NEXT</b>' : '');
  const sideBoard = t => `<div class="sc-tm sc-tm--${t}">
      <span class="sc-tm__n"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}</span>
      <span class="sc-tm__s num">${G.score[t]}</span>
      <span class="sc-ind"><span class="sc-pips" role="img" aria-label="${G.teamFouls[t]} team fouls${G.penalty[t] ? ', penalty' : ''}">${pips(t)}</span>${penText(t)}</span>
      <span class="sc-ind"><span class="sc-dots" role="img" aria-label="${G.timeouts.left[t]} timeouts left">${dots(t)}</span><span>${G.timeouts.left[t]} timeout${G.timeouts.left[t] === 1 ? '' : 's'}</span></span>
    </div>`;
  const tile = id => {
    // The ring and float play once, right after the tap: a later repaint (a sync, the other
    // scorer's play) mustn't start them again.
    const p = byId[id], L = G.players[id] || {}, hit = ui.flash && ui.flash.pid === id && Date.now() - ui.flash.at < 900;
    const cls = ['sc-p', ui.sel === id || (ui.sub && ui.sub.off === id) ? 'on' : '', hit ? `ring ${ui.flash.tone} b${ui.flashN % 2} r${ui.flashN % 2}` : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" style="--c:${esc(team[p.team].color)}" data-pick="${esc(id)}" aria-pressed="${ui.sel === id}" aria-label="${esc(p.name)}${L.pf ? `, ${L.pf} fouls` : ''}">
      <b class="num">${esc(p.number || '–')}</b><span>${esc(p.short)}</span>${L.pf ? `<i class="sc-p__pf">${L.pf}F</i>` : ''}${hit ? `<i class="sc-fl ${ui.flash.tone} f${ui.flashN % 2}" aria-hidden="true">${esc(ui.flash.text)}</i>` : ''}</button>`;
  };
  const teamBlock = t => {
    if (!mine(t)) {
      const h = holderOf(t);
      return `<section class="sc-team sc-team--off" style="grid-area:${t}"><div class="sc-th"><span class="sc-th__n"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}</span></div>
        <p class="sc-off">${h ? `${esc(h.name)} scores ${esc(team[t].name)}. Their plays show in the log.` : `Nobody is scoring ${esc(team[t].name)} yet.`}</p></section>`;
    }
    const on = five(t);
    const dnps = team[t].players.filter(p => G.dnp.includes(p.id));
    const rest = team[t].players.filter(p => !on.includes(p.id) && !G.dnp.includes(p.id));
    return `<section class="sc-team" style="grid-area:${t}">
      <div class="sc-th"><span class="sc-th__n"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}</span>
        <button type="button" class="sc-tb" data-act="timeout" data-team="${t}">Timeout</button>
        <button type="button" class="sc-tb hold" data-hold="team" data-team="${t}" aria-label="${esc(team[t].name)} team turnover. Hold for more team plays">Team</button>
        <button type="button" class="sc-tb" data-act="dnp" data-team="${t}" aria-label="${esc(team[t].name)}: mark who didn’t play">DNP</button></div>
      <div class="sc-five">${on.map(tile).join('')}</div>
      ${rest.length || dnps.length ? `<div class="sc-bench"><button type="button" class="sc-subbtn${ui.sub && ui.sub.t === t ? ' on' : ''}" data-act="sub" data-team="${t}" aria-pressed="${!!(ui.sub && ui.sub.t === t)}">⇄ Sub</button>${rest.map(p => `<button type="button" class="${G.flags[p.id] ? 'is-out' : ui.sel === p.id || (ui.sub && ui.sub.on === p.id) ? 'on' : ''}" data-pick="${esc(p.id)}"${G.flags[p.id] ? ' disabled' : ''}>${esc(p.number ? '#' + p.number + ' ' : '')}${esc(p.short)}${G.flags[p.id] ? ` · ${G.flags[p.id]}` : ''}</button>`).join('')}${dnps.length ? `<button type="button" class="is-dnp" data-act="dnp" data-team="${t}" aria-label="${dnps.length} didn’t play: ${esc(dnps.map(p => p.short).join(', '))}. Tap to change">DNP · ${dnps.length}</button>` : ''}</div>` : ''}
    </section>`;
  };
  const playText = r => {
    if (r.type === 'period_end') return `<b>End of ${esc(r.period)}</b>`;
    if (r.type === 'sub') return `<b>${esc(short(r.in))}</b> on for ${esc(short(r.out))}`;
    if (r.type === 'dnp') return `<b>${esc(short(r.player))}</b> ${r.on === false ? 'back on the roster' : 'didn’t play'}`;
    const who = r.player ? short(r.player) : r.team ? team[r.team].name : 'Refs';
    const w = { shot: `${r.pts}PT ${r.made ? 'made' : 'miss'}`, ft: `FT ${r.made ? 'made' : 'miss'}`, reb: r.off ? 'off. rebound' : 'rebound', ast: 'assist', blk: 'block', stl: `steal${r.from ? ` from ${short(r.from)}` : ''}`,
      to: `turnover${r.kind ? ` · ${r.kind}` : ''}`, foul: `${r.kind || 'personal'} foul`, team_to: `team turnover${r.kind ? ` · ${r.kind}` : ''}`, team_tech: `technical · ${r.kind || 'coach'}`,
      timeout: 'timeout', stoppage: `stoppage${r.kind ? ` · ${r.kind}` : ''}`, period_end: `end of ${r.period}` }[r.type] || r.type;
    return `<b>${esc(who)}</b> ${esc(w)}`;
  };
  function paint() {
    const ask = ui.ask;
    const strip = ask
      ? `<div class="sc-strip ${ask.kind === 'menu' ? 'is-menu' : 'is-ask'}" role="status"><div class="sc-strip__q"><b>${esc(ask.q)}</b>${ask.hint ? `<small>${esc(ask.hint)}</small>` : ''}</div>
          <div class="sc-opts">${ask.opts.map(o => `<button type="button" class="${o.def ? 'def' : o.cancel ? 'cancel' : ''}" data-ask="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div></div>`
      : ui.sub ? `<div class="sc-strip is-ask" role="status"><div class="sc-strip__q"><b>Sub ${esc(team[ui.sub.t].name)}: ${ui.sub.off ? `${esc(short(ui.sub.off))} off. Who goes on?` : ui.sub.on ? `${esc(short(ui.sub.on))} on. Who comes off?` : 'tap who comes off, then who goes on'}</b><small>as many as you need</small></div>
          ${ui.tip ? `<p>${esc(ui.tip)}</p>` : ''}<div class="sc-opts"><button type="button" class="def" data-act="sub-done">Done</button></div></div>`
      : multi && ui.lanes && ui.lanes.asks.length ? `<div class="sc-strip is-ask" role="status"><div class="sc-strip__q"><b>${esc(ui.lanes.asks[0].name)} asks to score ${esc(sideName(ui.lanes.asks[0].lane))}</b><small>you keep the other side</small></div>
          <div class="sc-opts"><button type="button" class="def" data-handover="${esc(ui.lanes.asks[0].device)}" data-yes="1">Hand it over</button><button type="button" data-handover="${esc(ui.lanes.asks[0].device)}">Keep it</button></div></div>`
      : multi && !ui.lane && !ui.locked ? `<div class="sc-strip is-ask" role="status"><div class="sc-strip__q"><b>${ui.asked ? `Asked ${esc(ui.asked)}. Waiting for them to hand it over…` : ui.lanes && ui.lanes.others.length ? `${esc(ui.lanes.others.filter(o => o.lane).map(o => `${o.name} scores ${sideName(o.lane)}`).join(', ') || 'Someone is here')}. Which side do you score?` : 'Which side do you score?'}</b></div>
          ${ui.tip ? `<p>${esc(ui.tip)}</p>` : ''}
          <div class="sc-opts">${['a', 'b', 'both'].map(l => { const h = holderOf(l); return `<button type="button" data-side="${l}" data-holder="${esc(h ? h.name : '')}">${h ? `Ask for ${esc(sideName(l))}` : `Score ${esc(sideName(l))}`}</button>`; }).join('')}${ui.lanes && ui.lanes.admin ? '<button type="button" data-act="sides">Take over…</button>' : ''}</div></div>`
      : ui.after ? `<div class="sc-strip is-ask" role="status"><div class="sc-strip__q"><b>Adding after: ${playText(G.rows.find(r => r.id === ui.after) || { type: '' }).replace(/<[^>]+>/g, '')}</b><small>later scores update</small></div>
          <div class="sc-opts"><button type="button" class="def" data-act="insert-done">Done, back to the end</button></div>${ui.tip ? `<p>${esc(ui.tip)}</p>` : ''}</div>`
      : `<div class="sc-strip" role="status"><p>${esc(ui.tip || (ui.sel ? `${byId[ui.sel].name} picked. Now the stat.` : (wide.matches ? 'Tap a player, then the stat. Subs: ⇄ Sub, or drag a bench player onto a tile. A bench player’s stat brings them on too.' : 'Tap a player, then the stat. Subs: ⇄ Sub. A bench player’s stat brings them on too. Corner mark: tap for the usual, hold for more.')))}</p></div>`;
    const rows = G.rows.slice(-6).reverse();
    // Undo: this phone's own last play (with two scorers, the other phone's plays get Fix only).
    const mineRows = G.rows.filter(r => !r.dev || r.dev === deviceId);
    const lastId = mineRows.length ? mineRows[mineRows.length - 1].id : '';
    const logRow = (r, sheet = false) => `<div class="sc-lg${r.id === ui.after ? ' is-at' : ''}"><span class="sc-lg__t">${esc([r.period, r.clock].filter(Boolean).join(' '))}</span><span class="sc-lg__w">${r.team ? `<span class="dot" style="--c:${esc(team[r.team].color)}"></span>` : ''}${playText(r)}</span><span class="sc-lg__s num">${r.score.a}–${r.score.b}</span>${ui.locked ? '' : `${r.id === lastId && !ui.after && !sheet ? `<button type="button" class="sc-undo" data-undo="${esc(r.id)}" aria-label="Undo the last play">Undo</button>` : ''}<button type="button" class="sc-undo sc-fix" data-fix="${esc(r.id)}" aria-label="Fix this play">Fix</button>`}</div>`;
    root.innerHTML = `
      ${ui.locked ? '<div class="msg msg--info sc-msg">This game is published. The scorer is read-only now.</div>' : ''}
      ${ui.sync === 'error' && ui.syncMsg ? `<div class="msg msg--err sc-msg" role="alert">${esc(ui.syncMsg)}</div>` : ''}
      <div class="sc-board">
        ${sideBoard('a')}
        <div class="sc-clk"><span class="sc-clk__p">${video ? 'Video · ' : ''}${esc(G.period)}</span><button type="button" class="sc-clk__t num" data-act="clockset" data-sc-clock aria-label="Game clock ${clockStr()}. Tap to fix it">${clockStr()}</button>
          <div class="sc-clk__row">
            <button type="button" class="sc-cb sc-cb--go" data-act="clock"${keepsClock() ? '' : ` disabled title="${esc(keeper().name)} keeps the clock"`} aria-label="${keepsClock() ? (ui.running ? 'Pause clock' : 'Start clock') : `${esc(keeper().name)} keeps the clock`}">${ui.running ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button>
            <button type="button" class="sc-cb hold" data-hold="refs" aria-label="Referees stopped play. Hold for the reason">Refs</button>
            <button type="button" class="sc-cb" data-act="end">End</button>
            ${video && B.video ? `<button type="button" class="sc-cb${ui.showVideo ? ' is-on' : ''}" data-act="video" aria-pressed="${!!ui.showVideo}">Video</button>` : ''}
          </div></div>
        ${sideBoard('b')}
      </div>
      ${multi && ui.lane && (ui.lane !== 'both' || (ui.lanes && ui.lanes.others.length)) ? `<div class="sc-lanes"><span>You: <b>${esc(sideName(ui.lane))}</b>${ui.lanes && ui.lanes.others.filter(o => o.lane).map(o => ` · ${esc(o.name)}: <b>${esc(sideName(o.lane))}</b>`).join('')}${keeper() && !keeper().me ? ` · clock: ${esc(keeper().name)}` : ''}</span><button type="button" class="sc-tb" data-act="sides">Change</button></div>` : ''}
      <div class="sc-main">
        ${teamBlock('a')}${teamBlock('b')}
        <section class="sc-center" style="grid-area:c">
          ${strip}
          <div class="sc-pad${shots.length === 3 ? ' sc-pad--3' : ''}">
            ${shots.map(p => `<button type="button" class="sc-st sc-st--made" data-shot="${p}" data-made="1">${p === 1 ? 'FT' : p + 'PT'}<small>made</small></button>`).join('')}
            ${shots.map(p => `<button type="button" class="sc-st sc-st--miss" data-shot="${p}">${p === 1 ? 'FT' : p + 'PT'}<small>miss</small></button>`).join('')}
          </div>
          <div class="sc-pad sc-pad--6">
            <button type="button" class="sc-st" data-act="reb">REB<small>off/def auto</small></button>
            <button type="button" class="sc-st" data-act="ast">AST<small>assist</small></button>
            <button type="button" class="sc-st" data-act="stl">STL<small>steal</small></button>
            <button type="button" class="sc-st" data-act="blk">BLK<small>block</small></button>
            <button type="button" class="sc-st sc-st--warn hold" data-hold="to" aria-label="Turnover. Hold for the kind">TO<small>hold: kind</small></button>
            <button type="button" class="sc-st sc-st--warn hold" data-hold="pf" aria-label="Personal foul. Hold for other fouls">PF<small>hold: kind</small></button>
          </div>
        </section>
        <section class="sc-logsec" style="grid-area:l" aria-label="Latest plays"><div class="sc-log">
            ${rows.length ? rows.map(logRow).join('') : '<p class="sc-empty">Plays show here as you tap.</p>'}
            ${G.rows.length > rows.length ? `<button type="button" class="sc-all" data-act="all">All ${G.rows.length} plays</button>` : ''}
        </div></section>
      </div>
      ${dnpSheet()}
      ${ui.sheet ? `<div class="sc-sheet" role="dialog" aria-modal="true" aria-label="All plays"><div class="sc-sheet__in">
        <div class="sc-sheet__h"><b>All plays · ${G.rows.length}</b><button type="button" class="sc-undo" data-act="sheet-close">Close</button></div>
        <div class="sc-log">${G.rows.slice().reverse().map(r => logRow(r, true)).join('')}</div></div></div>` : ''}`;
    paintPill();
  }

  // ── Input: one listener for taps, holds handled with per-button timers ──
  function act(name, b) {
    const t = b.getAttribute('data-team');
    if (name === 'clock') { ui.running = !ui.running; if (ui.running) ui.tip = ''; save(); return paint(); }
    if (name === 'end') return endPeriod();
    if (name === 'dnp') return dnpMenu(t);
    if (name === 'sides') return sideMenu();
    if (name === 'sub') { ui.sub = ui.sub && ui.sub.t === t ? null : { t, off: null, on: null }; ui.sel = null; ui.ask = null; ui.tip = ''; return paint(); }
    if (name === 'sub-done') { ui.sub = null; ui.tip = ''; return paint(); }
    if (name === 'dnp-save') return dnpSave();
    if (name === 'dnp-close') { ui.dnp = null; return paint(); }
    if (name === 'clockset') { if (!keepsClock()) { ui.tip = `${keeper().name} keeps the clock.`; return paint(); } return clockMenu(); }
    if (name === 'all') { ui.sheet = true; return paint(); }
    if (name === 'sheet-close') { ui.sheet = false; return paint(); }
    if (name === 'insert-done') { ui.after = null; ui.tip = 'Back at the end of the game.'; return paint(); }
    if (name === 'video') { ui.showVideo = !ui.showVideo; showVideo(); return paint(); }
    if (name === 'timeout') return timeout(t);
    if (name === 'reb') return simple('reb', 'REB');
    if (name === 'ast') return simple('ast', 'AST');
    if (name === 'stl') return simple('stl', 'STL');
    if (name === 'blk') return simple('blk', 'BLK');
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-hold')) { if (e.detail === 0) holdTap(b); return; } // keyboard: Enter = tap
    if (ui.locked && !b.hasAttribute('data-ask') && !/^(all|sheet-close|video)$/.test(b.getAttribute('data-act') || '')) return;
    if (b.hasAttribute('data-pick') && ui.sub) return subPick(b.getAttribute('data-pick'));
    if (b.hasAttribute('data-pick')) { const id = b.getAttribute('data-pick'); ui.sel = ui.sel === id ? null : id; ui.ask = ui.ask && ui.ask.kind === 'ft' ? ui.ask : null; ui.tip = ''; return paint(); }
    if (b.hasAttribute('data-ask')) return answer(b.getAttribute('data-ask'));
    if (b.hasAttribute('data-fix')) return fixMenu(b.getAttribute('data-fix'));
    if (b.hasAttribute('data-dnp-toggle') && ui.dnp) { const id = b.getAttribute('data-dnp-toggle'); ui.dnp.sel.has(id) ? ui.dnp.sel.delete(id) : ui.dnp.sel.add(id); return paint(); }
    if (b.hasAttribute('data-side')) return pickSide(b.getAttribute('data-side'), b.getAttribute('data-holder'));
    if (b.hasAttribute('data-handover')) { const yes = b.hasAttribute('data-yes'); return lanes({ action: 'answer', from: b.getAttribute('data-handover'), yes }); }
    if (b.hasAttribute('data-undo')) { add({ type: 'void', target: b.getAttribute('data-undo') }); ui.ask = null; ui.tip = 'Undone. Removed plays stay on record for the review.'; return paint(); }
    if (b.hasAttribute('data-shot')) return shot(Number(b.getAttribute('data-shot')), b.hasAttribute('data-made'));
    if (b.hasAttribute('data-act')) return act(b.getAttribute('data-act'), b);
  });
  function holdTap(b) {
    const k = b.getAttribute('data-hold');
    if (ui.locked) return;
    if (k === 'team') teamTap(b.getAttribute('data-team')); else TAP[k]();
  }
  function holdLong(b) {
    const k = b.getAttribute('data-hold');
    if (ui.locked) return;
    if (k === 'team') teamHold(b.getAttribute('data-team')); else HOLD[k]();
  }
  // Drag and drop subs, tablet and laptop widths only (on a phone the bench row scrolls
  // sideways, so a drag there would fight the scroll: Sub is the way).
  let drag = null;
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-pick]');
    if (!b || !wide.matches || ui.locked || e.button > 0) return;
    drag = { b, id: b.getAttribute('data-pick'), x: e.clientX, y: e.clientY, on: false };
  });
  root.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) return;
      drag.on = true;
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
    const t = byId[d.id].team, other = target.getAttribute('data-pick');
    const [inId, outId] = onCourt(t, d.id) ? [other, d.id] : [d.id, other];
    doSub(t, inId, outId); paint();
  };
  let swallowClick = false;
  root.addEventListener('click', e => { if (swallowClick && e.target.closest('[data-pick]')) { e.stopPropagation(); e.preventDefault(); swallowClick = false; } }, true);
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
  root.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });

  // Leaving with plays not sent yet: they're safe on this phone, but say so.
  const leave = el.querySelector('[data-sc-leave]');
  if (leave) leave.addEventListener('click', e => {
    const n = unsent().length;
    if (n && !window.confirm(`${n} play${n > 1 ? 's haven’t' : ' hasn’t'} been sent yet. ${n > 1 ? 'They stay' : 'It stays'} on this phone and ${n > 1 ? 'send' : 'sends'} next time you open this game with signal. Leave anyway?`)) e.preventDefault();
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
