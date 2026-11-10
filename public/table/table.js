// The table display (/table = public/table/index.html, 2026-10-30). Pairs with the scorer's
// phone by two QR scans (public/table-link.js), then shows what the phone sends: the score, the
// quarter and the clock (it runs its own copy of the clock from the last message, so a dropped
// message never freezes it), team fouls and timeouts (league games; Papawis has neither), the
// last play. Players (only when someone taps it, Paolo): the top 3 by the box score's rating as
// cards, everyone's points, then any player's card. Back to the score by itself after 20 s.
import { loadVendor, drawQr, camera, stopCamera, scan, tabletOffer, tabletAnswer, addrsOf } from '/table-link.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = name => document.querySelectorAll('[data-screen]').forEach(el => { el.hidden = el.getAttribute('data-screen') !== name; });
const fmt = secs => { const s = Math.max(0, Math.ceil(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const IDLE_MS = 20000;

// ── Papawis clock (Paolo, 2026-11-01): big, and it warns. The layout: A (big clock, the normal
// one) or B (clock first: tap the clock), kept per tablet; the last 2 minutes are always B
// (2026-11-10). Amber in the last 2 minutes with a
// chime at 2:00, red with tenths in the last 10 s with a tick each second from 0:05, a buzzer at
// 0:00. Sounds are small WAV files made here and played as ordinary audio, which an iPad plays
// even with the silent switch on; a tablet only plays sound after a tap (Turn on sound).
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let clockFirst = store.get('wknd-table-clock') === 'first';
const pwClock = secs => {
  if (secs > 0 && secs < 10) { const t = Math.floor(secs * 10); return `0:0${Math.floor(t / 10)}<small>.${t % 10}</small>`; }
  return fmt(secs);
};
const alertOf = secs => (secs <= 0 ? 'end' : secs < 10 ? 'last' : secs <= 120 ? 'warn' : '');
const RATE = 22050;
function wav(len, fn) {
  const n = Math.floor(len * RATE), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, fn(i / RATE))) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
const env = (t, start, dur) => { const u = t - start; return u < 0 || u > dur ? 0 : Math.min(1, u / 0.02) * Math.exp(-4 * u / dur); };
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
let sounds = null, soundOn = false;
function makeSounds() {
  if (sounds) return sounds;
  const src = {
    chime: wav(1.2, t => 0.55 * (env(t, 0, 0.55) * sine(880, t) + env(t, 0.32, 0.8) * sine(660, t))),
    tick: wav(0.12, t => 0.5 * env(t, 0, 0.1) * (sine(1320, t) > 0 ? 1 : -1)),
    buzzer: wav(1.25, t => { const a = t < 0.03 ? t / 0.03 : t > 1.15 ? Math.max(0, (1.25 - t) / 0.1) : 1; return 0.35 * a * ((((t * 170) % 1) * 2 - 1) + (((t * 176) % 1) * 2 - 1)); }),
  };
  sounds = {};
  for (const k of Object.keys(src)) { const a = new Audio(src[k]); a.preload = 'auto'; sounds[k] = a; }
  return sounds;
}
function play(k) { if (!soundOn || !sounds) return; const a = sounds[k]; try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function soundUnlock() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const s = makeSounds();
  for (const a of Object.values(s)) { a.muted = true; const p = a.play(); const done = () => { a.pause(); a.currentTime = 0; a.muted = false; }; if (p && p.then) p.then(done, done); else done(); }
  soundOn = true;
  setTimeout(() => play('chime'), 150);
}
// Sounds only when the clock runs down past the mark (so joining at 1:50, or a restart, stays quiet).
let lastSecs = null, lastPer = null;
function alertSounds(secs) {
  if (!S || S.kind !== 'papawis' || S.final) { lastSecs = null; return; }
  const prev = lastSecs, same = lastPer === S.period;
  lastSecs = secs; lastPer = S.period;
  if (prev == null || !same || prev - secs > 2 || prev <= secs) return;
  if (prev > 120 && secs <= 120) play('chime');
  for (let m = 5; m >= 1; m--) if (prev > m && secs <= m) play('tick');
  if (prev > 0 && secs <= 0) play('buzzer');
}
function paintClock() {
  if (!S || view !== 'board') return;
  const secs = S.final ? 0 : Math.max(0, clockNow()), pw = S.kind === 'papawis';
  const c = $('[data-clock]');
  if (pw && !S.final) c.innerHTML = pwClock(secs); else c.textContent = fmt(secs);
  const a = pw && !S.final ? alertOf(secs) : '';
  const board = $('[data-board]');
  board.classList.toggle('board--pw', pw); board.classList.toggle('board--first', pw && (clockFirst || !!a));
  for (const k of ['warn', 'last', 'end']) board.classList.toggle(`is-${k}`, a === k);
  const cue = $('[data-cue]'); cue.hidden = !a;
  cue.textContent = a === 'end' ? `End of ${S.period}` : a === 'last' ? 'Last 10 s' : a === 'warn' ? 'Last 2 min' : '';
  $('[data-act="sound"]').hidden = !pw || soundOn;
  alertSounds(secs);
}

// ── Offline copy ──
const offNote = $('[data-offline-note]');
// In the app (/app/table, table mode) the app keeps the screen; /table keeps its own copy.
if (/^\/app\//.test(location.pathname)) document.querySelectorAll('[data-app-only]').forEach(el => { el.hidden = false; });
if (/^\/app\//.test(location.pathname)) offNote.textContent = 'Table mode in the app: works with no internet once it has opened here with signal.';
else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/table/sw.js', { scope: '/table' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => caches.open('wknd-table').then(c => c.match('/table')))
    .then(hit => { offNote.textContent = hit ? 'Saved on this tablet: it works with no internet.' : 'Saving a copy… open this once more with internet.'; })
    .catch(() => { offNote.textContent = 'This browser can’t keep an offline copy: open it with internet at the court.'; });
} else offNote.textContent = 'This browser can’t keep an offline copy.';

// ── Pairing ──
let pc = null, ch = null, stream = null, stopScan = null, S = null, recvAt = 0, lastMsg = 0, closed = false;
let facing = 'user';
const status = (text, tone = 'wait') => { $('[data-pair-status]').textContent = text; $('[data-pair-dot]').className = `dot dot--${tone}`; };
// Everything off: the direct link, its camera and reader (Fable audit 2026-10-30), and following online.
function stopAll() {
  if (stopScan) stopScan();
  stopCamera(stream, $('[data-video]')); stream = null;
  if (ch) { ch.onclose = null; try { ch.close(); } catch (e) {} }
  if (pc) { try { pc.close(); } catch (e) {} }
  pc = null; ch = null; closed = false;
  followId = null; clearTimeout(wsRetry);
  if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} ws = null; }
  $('[data-online]').hidden = true;
  S = null; view = 'board';
}
async function pair() {
  stopAll(); mode = 'direct';
  show('pair');
  status('Getting the code ready…');
  try {
    await loadVendor();
    const video = $('[data-video]');
    // Camera first: the tablet's real address goes in the code. The front camera, since the phone
    // is held up to the tablet's screen; "Use the other camera" switches.
    stream = await camera(video, facing);
    video.classList.toggle('is-front', facing === 'user');
    $('[data-act="flip"]').hidden = false;
    const o = await tabletOffer();
    pc = o.pc; ch = o.ch; wire(ch);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') linkDown('Couldn’t connect. Both on the phone’s hotspot? Pair again.'); };
    drawQr($('[data-qr]'), o.code);
    $('[data-pair-row]').hidden = false;
    $('[data-act="pair"]').textContent = 'Start over';
    status('Waiting for the phone’s code…');
    // Connecting shows both sides' addresses, and gives up after 20 s with them (Paolo's first
    // real test, 2026-10-30, stuck on Connecting with nothing to go on).
    const where = () => `Tablet ${addrsOf(pc.localDescription && pc.localDescription.sdp).join(', ') || 'no address'} · Phone ${addrsOf(pc.remoteDescription && pc.remoteDescription.sdp).join(', ') || 'no address'}`;
    const read = () => { stopScan = scan(video, text => tabletAnswer(pc, text).then(() => {
      status(`Connecting… ${where()}`);
      const mine = pc;
      setTimeout(() => { if (pc === mine && !(ch && ch.readyState === 'open')) status(`Couldn’t connect (${pc.iceConnectionState}). Is the tablet on the phone’s hotspot? ${where()}`, 'err'); }, 20000);
    }, e => { status(e.message, 'err'); read(); })); };
    read();
  } catch (e) {
    status(e.name === 'NotAllowedError' ? 'The camera is needed to read the phone’s code. Allow it and try again.' : `Something went wrong: ${e.message}`, 'err');
  }
}
function wire(c) {
  c.onopen = () => {
    if (stopScan) stopScan();
    stopCamera(stream, $('[data-video]')); stream = null;
    wake();
    status('Linked', 'ok');
  };
  c.onclose = () => linkDown('The link closed. Pair again from the phone: ••• → Table display.');
  c.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } got(m); };
}
function linkDown(text) {
  closed = true;
  // The board stays up with the last score; Pair again starts over (the phone: ••• → Table display).
  const b = $('[data-lost]'); b.innerHTML = `<span>${esc(text)}</span><button type="button" class="btn btn--ghost" data-act="pair">Pair again</button>`; b.className = 'banner banner--err'; b.hidden = false;
  $('[data-link]').textContent = 'Not linked'; $('[data-link-dot]').className = 'dot dot--err';
  if (!S) { show('pair'); status(text, 'err'); }
}
let lock = null;
function wake() { if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => { lock = l; }, () => {}); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ((ch && ch.readyState === 'open') || followId)) wake(); });

// ── Online (2026-10-30, Paolo: an iPhone's own hotspot drops the direct link): when there's
// internet, follow the game through the server instead (server.js /api/table/live and
// /ws/table/:id; the scorer's phone posts the same scoreboard there). No codes to scan.
let mode = 'direct', ws = null, followId = null, wsRetry = null;
async function online() {
  stopAll(); mode = 'online';
  show('pair');
  $('[data-pair-row]').hidden = true; $('[data-act="flip"]').hidden = true;
  $('[data-act="pair"]').textContent = 'Show the code';
  const box = $('[data-online]'); box.hidden = false; box.innerHTML = '';
  status('Looking for games being scored…');
  let d;
  try {
    const r = await fetch('/api/table/live', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (r.status === 401) return status('Sign in first: open table mode from the app (Me → Scoring → Table display).', 'err');
    d = await r.json();
  } catch (e) { return status('No internet here. Use Show the code (the tablet’s hotspot) instead.', 'err'); }
  if (mode !== 'online') return;
  box.innerHTML = d.games.map(g => `<button type="button" class="game" data-follow="${esc(g.id)}">
      <span class="lbl">${esc(g.title)}${g.final ? ' · Final' : ''}</span>
      <span class="game__s"><span class="tdot" style="--c:${esc(g.teams[0].color)}"></span><b class="num">${g.teams[0].score}</b><span>–</span><b class="num">${g.teams[1].score}</b><span class="tdot" style="--c:${esc(g.teams[1].color)}"></span></span>
    </button>`).join('') + '<button type="button" class="btn btn--ghost" data-act="online">Refresh</button>';
  status(d.games.length ? 'Tap the game to show' : 'No game is being scored right now. Once the scorer’s phone has started (with signal), tap Refresh.', d.games.length ? 'ok' : 'wait');
}
function follow(id) {
  if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} }
  followId = id; closed = false;
  if (!S) status('Waiting for the scorer’s phone…');
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/table/${encodeURIComponent(id)}`);
  ws.onopen = () => wake();
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } got(m); };
  // Signal comes and goes at courts: keep trying, the board stays up meanwhile.
  ws.onclose = () => { if (followId !== id) return; clearTimeout(wsRetry); wsRetry = setTimeout(() => { if (followId === id) follow(id); }, 3000); };
}

// ── What the phone sends ──
// { t: 's', kind: 'league'|'papawis', title, period, final, clock: { secs, running }, last,
//   prev: [{ n, a, b }], basic, teams: [{ name, color, score, fouls, penaltyAt, penalty,
//   toLeft, toAllow, players: [{ id, name, short, number, line }] }] }
function got(m) {
  if (m.t !== 's') return;
  const first = !S;
  // age: how long the server had it (online), so the clock catches up.
  S = m; lastMsg = performance.now(); recvAt = lastMsg - Math.max(0, Number(m.age) || 0);
  if (ch) { try { ch.send(JSON.stringify({ t: 'ack', at: m.at })); } catch (e) {} }
  if (first) { show('board'); loop(); }
  paint();
}

// ── The rating (the box score's PER, lib/game-detail.js gameScore) ──
const rating = L => {
  const n = k => Number(L[k]) || 0;
  // Basic logs makes only: rate on points, rebounds and assists (server.js pwBasicRating).
  if (S && S.basic) return n('pts') + 0.7 * n('reb') + 0.7 * n('ast');
  const fgm = n('fg2m') + n('fg3m') + n('fg4m'), fga = fgm + n('fg2m_miss') + n('fg3m_miss') + n('fg4m_miss');
  return n('pts') + 0.4 * fgm - 0.7 * fga - 0.4 * n('ft_miss') + 0.7 * n('reb') + n('stl') + 0.7 * n('ast') + 0.7 * n('blk') - n('turnover');
};
const everyone = () => S.teams.flatMap((t, i) => t.players.map(p => ({ ...p, t: i, color: t.color, team: t.name })));

// ── Drawing ──
let view = 'board', cardId = null, cardTeam = 0, touched = 0;
const clockNow = () => (S.clock.running ? S.clock.secs - (performance.now() - recvAt) / 1000 : S.clock.secs);
function sideHtml(t) {
  const fouls = t.fouls == null ? '' : `<span class="pips" role="img" aria-label="${t.fouls} team fouls${t.penalty ? ', in the penalty' : ''}">${Array.from({ length: t.penaltyAt }, (_, i) => `<i class="${t.fouls >= t.penaltyAt ? 'pen' : i < t.fouls ? 'on' : t.fouls === t.penaltyAt - 1 && i === t.penaltyAt - 1 ? 'next' : ''}"></i>`).join('')}${t.penalty ? '<b>PENALTY</b>' : ''}</span>`;
  const tos = t.toAllow ? `<span class="tos" role="img" aria-label="${t.toLeft} timeouts left">${Array.from({ length: t.toAllow }, (_, i) => `<i class="${i < t.toLeft ? 'on' : ''}"></i>`).join('')}</span>` : '';
  return `<div class="side__n"><span class="tdot" style="--c:${esc(t.color)}"></span><span>${esc(t.name)}</span></div>
    <b class="score num">${t.score}</b><div class="marks">${fouls}${tos}</div>`;
}
const miniHtml = (secs) => `<span class="lbl" style="font-size:18px">${esc(S.title)}</span>
  <span class="mini__s"><span class="tdot" style="--c:${esc(S.teams[0].color)};width:14px;height:14px"></span><b>${S.teams[0].score}</b><span>${S.final ? 'FINAL' : `${esc(S.period)} · ${fmt(clockNow())}`}</span><b>${S.teams[1].score}</b><span class="tdot" style="--c:${esc(S.teams[1].color)};width:14px;height:14px"></span></span>
  <button type="button" class="btn" data-act="board">Back to the score · ${secs} s</button>`;
const statsOf = (L, full) => full
  ? [['PTS', L.pts], ['REB', L.reb], ['AST', L.ast], ['BLK', L.blk], ['FG', `${(L.fg2m || 0) + (L.fg3m || 0) + (L.fg4m || 0)}-${(L.fg2m || 0) + (L.fg3m || 0) + (L.fg4m || 0) + (L.fg2m_miss || 0) + (L.fg3m_miss || 0) + (L.fg4m_miss || 0)}`], ['FOULS', L.pf]]
  : [['PTS', L.pts], ['REB', L.reb], ['AST', L.ast]];
const lineHtml = st => `<div class="line" style="--n:${st.length}">${st.map(([k, v]) => `<span><b>${esc(v ?? 0)}</b><small>${k}</small></span>`).join('')}</div>`;
const ini = n => String(n || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const firstOf = p => String(p.name || '').split(' ').slice(0, -1).join(' ') || p.name;
function paint() {
  if (!S) return;
  const left = Math.max(0, Math.ceil((IDLE_MS - (Date.now() - touched)) / 1000));
  if (view !== 'board' && left <= 0) view = 'board';
  if (view === 'board') {
    show('board');
    $('[data-title]').innerHTML = esc(S.title);
    for (const [i, side] of ['a', 'b'].entries()) $(`[data-side="${side}"]`).innerHTML = sideHtml(S.teams[i]);
    $('[data-per]').textContent = S.final ? 'FINAL' : S.period;
    paintClock();
    $('[data-run]').innerHTML = S.final ? 'Game over' : `<span class="dot${S.clock.running ? '' : ' dot--wait'}"></span>${S.clock.running ? 'Clock running' : 'Clock stopped'}`;
    $('[data-last]').textContent = S.last || '';
    $('[data-prev]').innerHTML = (S.prev || []).map(g => `Game ${g.n} <b>${g.a}–${g.b}</b>`).join(' · ');
    return;
  }
  const all = everyone();
  if (view === 'players') {
    show('players');
    $('[data-mini]').innerHTML = miniHtml(left);
    const top = all.filter(p => p.line).map(p => ({ ...p, r: rating(p.line) })).sort((x, y) => y.r - x.r).slice(0, 3);
    $('[data-top-label]').textContent = S.kind === 'papawis' ? 'Player of the Day race · this game so far' : 'Top 3 so far';
    $('[data-cards]').innerHTML = top.map((p, i) => `<button type="button" class="card${i ? '' : ' card--1'}" data-pid="${esc(p.id)}">
        <span class="rank${i ? ` rank--${i + 1}` : ''}">${['1ST', '2ND', '3RD'][i]}</span>${p.number ? `<b class="ghost">${esc(p.number)}</b>` : ''}
        <span class="card__top"><span class="av" style="--c:${esc(p.color)}">${esc(ini(p.name))}</span><span class="who"><small>${esc(firstOf(p))}</small><b>${esc(p.short)}</b><em>${esc(p.team)}${p.number ? ` · #${esc(p.number)}` : ''}</em></span></span>
        ${lineHtml(statsOf(p.line, false))}</button>`).join('');
    $('[data-teams]').innerHTML = S.teams.map((t, i) => {
      const ps = all.filter(p => p.t === i).sort((x, y) => ((y.line || {}).pts || 0) - ((x.line || {}).pts || 0));
      return `<div><div class="team__h"><span class="tdot" style="--c:${esc(t.color)}"></span>${esc(t.name)} <small>· points</small></div>
        <div class="chips">${ps.map(p => `<button type="button" class="chip" data-pid="${esc(p.id)}"><i>${esc(p.number || '–')}</i><span>${esc(p.short)}</span><em>${(p.line || {}).pts || 0}</em></button>`).join('')}</div></div>`;
    }).join('');
    return;
  }
  show('card');
  const p = all.find(x => x.id === cardId) || all[0];
  if (!p) { view = 'board'; return paint(); }
  const L = p.line || {};
  $('[data-mini2]').innerHTML = miniHtml(left);
  const rank = all.filter(x => x.line).map(x => ({ id: x.id, r: rating(x.line) })).sort((x, y) => y.r - x.r).findIndex(x => x.id === p.id);
  $('[data-big]').innerHTML = `${p.number ? `<b class="ghost">${esc(p.number)}</b>` : ''}
    <div class="big__top"><span class="av" style="--c:${esc(p.color)}">${esc(ini(p.name))}</span><span class="who"><small>${esc(firstOf(p))}</small><b>${esc(p.short)}</b><em>${esc(p.team)}${p.number ? ` · #${esc(p.number)}` : ''}${rank >= 0 && rank < 3 ? ` · ${['1st', '2nd', '3rd'][rank]} in this game` : ''}</em></span></div>
    ${lineHtml(statsOf(L, !S.basic))}`;
  const t = cardTeam;
  $('[data-list]').innerHTML = `<div class="seg">${S.teams.map((x, i) => `<button type="button" data-team="${i}" aria-pressed="${i === t}"><span class="tdot" style="--c:${esc(x.color)}"></span>${esc(x.name)}</button>`).join('')}</div>
    ${all.filter(x => x.t === t).sort((x, y) => ((y.line || {}).pts || 0) - ((x.line || {}).pts || 0)).map(x => `<button type="button" class="row" data-pid="${esc(x.id)}" aria-current="${x.id === p.id}"><i>${esc(x.number || '–')}</i><span>${esc(x.name)}</span><em>${(x.line || {}).pts || 0}</em></button>`).join('')}`;
}
// The clock ticks between messages; the "no word from the phone" note after 3 s.
let looping = false;
function loop() {
  if (looping) return; looping = true;
  const tick = () => {
    if (S && view === 'board') paintClock();
    if (S && view !== 'board') { const left = Math.ceil((IDLE_MS - (Date.now() - touched)) / 1000); if (left <= 0) { view = 'board'; paint(); } else document.querySelectorAll('[data-act="board"]').forEach(b => { b.textContent = `Back to the score · ${left} s`; }); }
    const quiet = performance.now() - lastMsg;
    // Online, the phone only sends changes (and every 20 s), so quiet is normal up to ~45 s.
    const net = mode === 'online', wsUp = !!(ws && ws.readyState === 1);
    if (S && !closed) {
      const b = $('[data-lost]');
      if (net && !wsUp) { b.hidden = false; b.className = 'banner'; b.textContent = 'No internet on this tablet. Trying again… The clock keeps running from the last update.'; $('[data-link]').textContent = 'Reconnecting'; $('[data-link-dot]').className = 'dot dot--wait'; }
      else if (quiet > (net ? 45000 : 3000)) { b.hidden = false; b.className = 'banner'; b.textContent = `No word from the phone for ${Math.round(quiet / 1000)} s. The clock keeps running from the last update.`; $('[data-link]').textContent = 'Waiting for the phone'; $('[data-link-dot]').className = 'dot dot--wait'; }
      else { b.hidden = true; $('[data-link]').textContent = net ? 'Online' : 'Linked to the scorer'; $('[data-link-dot]').className = 'dot'; }
    }
    requestAnimationFrame(tick);
  };
  tick();
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  touched = Date.now();
  const act = b.getAttribute('data-act');
  if (act === 'pair') return pair();
  if (act === 'online') return online();
  if (act === 'home') {
    if (!confirm('Stop showing this game?')) return;
    stopAll(); show('pair'); status('Not paired');
    $('[data-pair-row]').hidden = true; $('[data-act="flip"]').hidden = true; $('[data-act="pair"]').textContent = 'Show the code';
    return;
  }
  if (act === 'flip') {
    // The other camera, keeping the code on screen and the link being made.
    facing = facing === 'user' ? 'environment' : 'user';
    const video = $('[data-video]');
    stopCamera(stream, video);
    camera(video, facing).then(s => { stream = s; video.classList.toggle('is-front', facing === 'user'); }, () => {});
    return;
  }
  if (b.hasAttribute('data-follow')) return follow(b.getAttribute('data-follow'));
  if (act === 'sound') { soundUnlock(); return paint(); }
  if (act === 'clockmode') { if (!S || S.kind !== 'papawis') return; clockFirst = !clockFirst; store.set('wknd-table-clock', clockFirst ? 'first' : 'big'); return paint(); }
  if (act === 'players') { view = 'players'; return paint(); }
  if (act === 'board') { view = 'board'; return paint(); }
  if (b.hasAttribute('data-team')) { cardTeam = Number(b.getAttribute('data-team')) || 0; return paint(); }
  if (b.hasAttribute('data-pid')) {
    cardId = b.getAttribute('data-pid');
    const p = everyone().find(x => x.id === cardId); if (p) cardTeam = p.t;
    view = 'card'; return paint();
  }
});
