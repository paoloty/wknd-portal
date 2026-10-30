// The table display (/table = public/table/index.html, 2026-10-30). Pairs with the scorer's
// phone by two QR scans (public/table-link.js), then shows what the phone sends: the score, the
// quarter and the clock (it runs its own copy of the clock from the last message, so a dropped
// message never freezes it), team fouls and timeouts (league games; Papawis has neither), the
// last play. Players (only when someone taps it, Paolo): the top 3 by the box score's rating as
// cards, everyone's points, then any player's card. Back to the score by itself after 20 s.
import { loadVendor, drawQr, camera, stopCamera, scan, tabletOffer, tabletAnswer } from '/table-link.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = name => document.querySelectorAll('[data-screen]').forEach(el => { el.hidden = el.getAttribute('data-screen') !== name; });
const fmt = secs => { const s = Math.max(0, Math.ceil(secs)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const IDLE_MS = 20000;

// ── Offline copy ──
const offNote = $('[data-offline-note]');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/table/sw.js', { scope: '/table' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => caches.open('wknd-table').then(c => c.match('/table')))
    .then(hit => { offNote.textContent = hit ? 'Saved on this tablet: it works with no internet.' : 'Saving a copy… open this once more with internet.'; })
    .catch(() => { offNote.textContent = 'This browser can’t keep an offline copy: open it with internet at the court.'; });
} else offNote.textContent = 'This browser can’t keep an offline copy.';

// ── Pairing ──
let pc = null, ch = null, stream = null, stopScan = null, S = null, recvAt = 0, lastMsg = 0, closed = false;
const status = (text, tone = 'wait') => { $('[data-pair-status]').textContent = text; $('[data-pair-dot]').className = `dot dot--${tone}`; };
async function pair() {
  // Start clean: the last link, its camera and its reader go first (Fable audit 2026-10-30).
  if (stopScan) stopScan();
  stopCamera(stream, $('[data-video]')); stream = null;
  if (ch) { ch.onclose = null; try { ch.close(); } catch (e) {} }
  if (pc) { try { pc.close(); } catch (e) {} }
  pc = null; ch = null; closed = false;
  show('pair');
  status('Getting the code ready…');
  try {
    await loadVendor();
    const video = $('[data-video]');
    stream = await camera(video); // camera first: the tablet's real address goes in the code
    const o = await tabletOffer();
    pc = o.pc; ch = o.ch; wire(ch);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') linkDown('Couldn’t connect. Both on the phone’s hotspot? Pair again.'); };
    drawQr($('[data-qr]'), o.code);
    $('[data-pair-row]').hidden = false;
    $('[data-act="pair"]').textContent = 'Start over';
    status('Waiting for the phone’s code…');
    const read = () => { stopScan = scan(video, text => tabletAnswer(pc, text).then(() => status('Connecting…'), e => { status(e.message, 'err'); read(); })); };
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ch && ch.readyState === 'open') wake(); });

// ── What the phone sends ──
// { t: 's', kind: 'league'|'papawis', title, period, final, clock: { secs, running }, last,
//   prev: [{ n, a, b }], basic, teams: [{ name, color, score, fouls, penaltyAt, penalty,
//   toLeft, toAllow, players: [{ id, name, short, number, line }] }] }
function got(m) {
  if (m.t !== 's') return;
  const first = !S;
  S = m; recvAt = performance.now(); lastMsg = recvAt;
  try { ch.send(JSON.stringify({ t: 'ack', at: m.at })); } catch (e) {}
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
    $('[data-clock]').textContent = S.final ? '0:00' : fmt(clockNow());
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
    if (S && view === 'board' && !S.final) $('[data-clock]').textContent = fmt(clockNow());
    if (S && view !== 'board') { const left = Math.ceil((IDLE_MS - (Date.now() - touched)) / 1000); if (left <= 0) { view = 'board'; paint(); } else document.querySelectorAll('[data-act="board"]').forEach(b => { b.textContent = `Back to the score · ${left} s`; }); }
    const quiet = performance.now() - lastMsg;
    if (!closed) {
      const b = $('[data-lost]');
      if (quiet > 3000) { b.hidden = false; b.className = 'banner'; b.textContent = `No word from the phone for ${Math.round(quiet / 1000)} s. The clock keeps running from the last update.`; $('[data-link]').textContent = 'Waiting for the phone'; $('[data-link-dot]').className = 'dot dot--wait'; }
      else { b.hidden = true; $('[data-link]').textContent = 'Linked to the scorer'; $('[data-link-dot]').className = 'dot'; }
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
  if (act === 'players') { view = 'players'; return paint(); }
  if (act === 'board') { view = 'board'; return paint(); }
  if (b.hasAttribute('data-team')) { cardTeam = Number(b.getAttribute('data-team')) || 0; return paint(); }
  if (b.hasAttribute('data-pid')) {
    cardId = b.getAttribute('data-pid');
    const p = everyone().find(x => x.id === cardId); if (p) cardTeam = p.t;
    view = 'card'; return paint();
  }
});
