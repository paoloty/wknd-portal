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
import { foldGame, defaultFreeThrows, nextPos, isOvertime } from './score-engine.js';

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

  // Plays: the server's, plus any this phone made that the server doesn't have yet.
  const rec = (await store.get(gid)) || { id: gid, events: [], sent: [], secs: rules.periodMin * 60 };
  const events = new Map();
  for (const e of B.events) events.set(e.id, e);
  const serverIds = new Set(B.events.map(e => e.id));
  for (const e of rec.events) if (!events.has(e.id)) events.set(e.id, e);
  const sent = new Set([...rec.sent, ...serverIds]);
  const ui = { sel: null, benchFirst: null, ask: null, tip: '', flash: null, flashN: 0, running: false, secs: rec.secs ?? rules.periodMin * 60, sync: 'idle', syncMsg: '', locked: published };

  const list = () => [...events.values()];
  const unsent = () => list().filter(e => !sent.has(e.id));
  const save = () => store.put({ id: gid, events: list(), sent: [...sent], secs: ui.secs });
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
  window.addEventListener('online', () => { pull(); sync(); });
  const syncTimer = setInterval(() => { if (!document.contains(el)) { clearInterval(syncTimer); clearInterval(tick); return; } if (unsent().length) sync(); }, 10000);
  pull();

  // ── Making plays ──
  function add(fields, { flash } = {}) {
    if (ui.locked) { ui.tip = 'This game is published. Nothing more can be added here.'; return paint(); }
    const e = { id: uid(), pos: nextPos(list()), at: Date.now(), period: G.period, clock: clockStr(), ...fields };
    events.set(e.id, e);
    G = fold();
    if (flash && fields.player) { ui.flashN++; ui.flash = { pid: fields.player, ...flash }; }
    save().then(sync);
    return e;
  }
  const other = t => (t === 'a' ? 'b' : 'a');
  // The five who played last for a team, topped up from the roster.
  const five = t => {
    const ids = G.lastActive[t].filter(id => byId[id] && !G.flags[id]);
    for (const p of team[t].players) { if (ids.length >= 5) break; if (!ids.includes(p.id) && !G.flags[p.id]) ids.push(p.id); }
    return ids.slice(0, 5);
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
    } else if (a.kind === 'menu') { ui.ask = null; a.act(id); return; }
    paint();
  }
  const ftAsk = (pid, n, i) => ({ kind: 'ft', pid, n, i, q: `Free throw ${i} of ${n} · ${short(pid)}`, hint: '', opts: [{ id: 'made', label: 'Made' }, { id: 'miss', label: 'Missed' }] });
  const menu = (q, opts, act, def) => { ui.ask = { kind: 'menu', q, hint: 'tap = the outlined one', opts: opts.map(([id, label]) => ({ id, label, def: id === def })), act }; paint(); };

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
    const p = byId[id], L = G.players[id] || {}, hit = ui.flash && ui.flash.pid === id;
    const cls = ['sc-p', ui.sel === id ? 'on' : '', hit ? `ring ${ui.flash.tone} b${ui.flashN % 2} r${ui.flashN % 2}` : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" style="--c:${esc(team[p.team].color)}" data-pick="${esc(id)}" aria-pressed="${ui.sel === id}" aria-label="${esc(p.name)}${L.pf ? `, ${L.pf} fouls` : ''}">
      <b class="num">${esc(p.number || '–')}</b><span>${esc(p.short)}</span>${L.pf ? `<i class="sc-p__pf">${L.pf}F</i>` : ''}${hit ? `<i class="sc-fl ${ui.flash.tone} f${ui.flashN % 2}" aria-hidden="true">${esc(ui.flash.text)}</i>` : ''}</button>`;
  };
  const teamBlock = t => {
    const on = five(t);
    const rest = team[t].players.filter(p => !on.includes(p.id));
    return `<section class="sc-team" style="grid-area:${t}">
      <div class="sc-th"><span class="sc-th__n"><span class="dot" style="--c:${esc(team[t].color)}"></span>${esc(team[t].name)}</span>
        <button type="button" class="sc-tb" data-act="timeout" data-team="${t}">Timeout</button>
        <button type="button" class="sc-tb hold" data-hold="team" data-team="${t}" aria-label="${esc(team[t].name)} team turnover. Hold for more team plays">Team</button></div>
      <div class="sc-five">${on.map(tile).join('')}</div>
      ${rest.length ? `<div class="sc-bench">${rest.map(p => `<button type="button" class="${G.flags[p.id] ? 'is-out' : ui.sel === p.id ? 'on' : ''}" data-pick="${esc(p.id)}"${G.flags[p.id] ? ' disabled' : ''}>${esc(p.number ? '#' + p.number + ' ' : '')}${esc(p.short)}${G.flags[p.id] ? ` · ${G.flags[p.id]}` : ''}</button>`).join('')}</div>` : ''}
    </section>`;
  };
  const playText = r => {
    if (r.type === 'period_end') return `<b>End of ${esc(r.period)}</b>`;
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
          <div class="sc-opts">${ask.opts.map(o => `<button type="button" class="${o.def ? 'def' : ''}" data-ask="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div></div>`
      : `<div class="sc-strip" role="status"><p>${esc(ui.tip || (ui.sel ? `${byId[ui.sel].name} picked. Now the stat.` : 'Tap a player, then the stat. Corner mark: tap for the usual, hold for more.'))}</p></div>`;
    const rows = G.rows.slice(-6).reverse();
    root.innerHTML = `
      ${ui.locked ? '<div class="msg msg--info sc-msg">This game is published. The scorer is read-only now.</div>' : ''}
      ${ui.sync === 'error' && ui.syncMsg ? `<div class="msg msg--err sc-msg" role="alert">${esc(ui.syncMsg)}</div>` : ''}
      <div class="sc-board">
        ${sideBoard('a')}
        <div class="sc-clk"><span class="sc-clk__p">${esc(G.period)}</span><span class="sc-clk__t num" data-sc-clock>${clockStr()}</span>
          <div class="sc-clk__row">
            <button type="button" class="sc-cb sc-cb--go" data-act="clock" aria-label="${ui.running ? 'Pause clock' : 'Start clock'}">${ui.running ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button>
            <button type="button" class="sc-cb hold" data-hold="refs" aria-label="Referees stopped play. Hold for the reason">Refs</button>
            <button type="button" class="sc-cb" data-act="end">End</button>
          </div></div>
        ${sideBoard('b')}
      </div>
      <div class="sc-main">
        ${teamBlock('a')}${teamBlock('b')}
        <section class="sc-center" style="grid-area:c">
          ${strip}
          <div class="sc-pad">
            ${[1, 2, 3, 4].map(p => `<button type="button" class="sc-st sc-st--made" data-shot="${p}" data-made="1">${p === 1 ? 'FT' : p + 'PT'}<small>made</small></button>`).join('')}
            ${[1, 2, 3, 4].map(p => `<button type="button" class="sc-st sc-st--miss" data-shot="${p}">${p === 1 ? 'FT' : p + 'PT'}<small>miss</small></button>`).join('')}
          </div>
          <div class="sc-pad sc-pad--6">
            <button type="button" class="sc-st" data-act="reb">REB<small>off/def auto</small></button>
            <button type="button" class="sc-st" data-act="ast">AST<small>assist</small></button>
            <button type="button" class="sc-st" data-act="stl">STL<small>steal</small></button>
            <button type="button" class="sc-st" data-act="blk">BLK<small>block</small></button>
            <button type="button" class="sc-st sc-st--warn hold" data-hold="to" aria-label="Turnover. Hold for the kind">TO<small>hold: kind</small></button>
            <button type="button" class="sc-st sc-st--warn hold" data-hold="pf" aria-label="Personal foul. Hold for other fouls">PF<small>hold: kind</small></button>
          </div>
          <div class="sc-log" aria-label="Latest plays">
            ${rows.length ? rows.map(r => `<div class="sc-lg"><span class="sc-lg__t">${esc([r.period, r.clock].filter(Boolean).join(' '))}</span><span class="sc-lg__w">${r.team ? `<span class="dot" style="--c:${esc(team[r.team].color)}"></span>` : ''}${playText(r)}</span><span class="sc-lg__s num">${r.score.a}–${r.score.b}</span>${ui.locked ? '' : `<button type="button" class="sc-undo" data-undo="${esc(r.id)}" aria-label="Undo: ${esc(r.player ? short(r.player) : '')} ${esc(r.type)}">Undo</button>`}</div>`).join('') : '<p class="sc-empty">Plays show here as you tap.</p>'}
          </div>
        </section>
      </div>`;
    paintPill();
  }

  // ── Input: one listener for taps, holds handled with per-button timers ──
  function act(name, b) {
    const t = b.getAttribute('data-team');
    if (name === 'clock') { ui.running = !ui.running; if (ui.running) ui.tip = ''; save(); return paint(); }
    if (name === 'end') return endPeriod();
    if (name === 'timeout') return timeout(t);
    if (name === 'reb') return simple('reb', 'REB');
    if (name === 'ast') return simple('ast', 'AST');
    if (name === 'stl') return simple('stl', 'STL');
    if (name === 'blk') return simple('blk', 'BLK');
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-hold')) { if (e.detail === 0) holdTap(b); return; } // keyboard: Enter = tap
    if (ui.locked && !b.hasAttribute('data-ask')) return;
    if (b.hasAttribute('data-pick')) { const id = b.getAttribute('data-pick'); ui.sel = ui.sel === id ? null : id; ui.ask = ui.ask && ui.ask.kind === 'ft' ? ui.ask : null; ui.tip = ''; return paint(); }
    if (b.hasAttribute('data-ask')) return answer(b.getAttribute('data-ask'));
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

  paint();
  sync();
}

if (typeof window !== 'undefined') window.wkndScorer = { mount };
