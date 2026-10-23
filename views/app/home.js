// App Home: "my game day". Pinned Up next card, the player's To Do list, their latest
// result with their own line, plus the Finish setup and Add to Home Screen cards while
// those apply. Data comes from server.js appHomeData().
import { esc, appLogo, appAvatar, chev, icons, ballSvg } from './layout.js';

// tipAt: epoch ms of tip-off (Manila), or 0 when the time isn't set — the countdown then
// counts to the start of game day. app.js ticks it every minute.
function upNextCard(u) {
  if (!u) {
    return `<div class="hero hero--quiet"><div class="kick">Up next</div>
      <div class="vs" style="font-size:28px">No game scheduled</div>
      <div class="hero__meta">Your next game shows up here as soon as it's on the schedule.</div></div>`;
  }
  return `<div class="hero">
    <div class="kick">${esc(u.kicker)}</div>
    <div class="vs"><span>${esc(u.mine)}</span><em>vs</em><span style="display:inline-flex;align-items:center;gap:8px"><span class="dot" style="--c:${esc(u.oppColor)};width:12px;height:12px"></span>${esc(u.opp)}</span></div>
    <div class="hero__meta">${esc([u.dateLabel, u.court].filter(Boolean).join(' · '))}</div>
    <div class="cd" data-countdown="${u.countTo}"><div><b data-cd-d>–</b><small>DAYS</small></div><div><b data-cd-h>–</b><small>HRS</small></div><div><b data-cd-m>–</b><small>MIN</small></div></div>
    <div class="hero__foot"><span>${esc(u.foot)}</span><a href="${esc(u.href)}">Details ›</a></div>
  </div>`;
}

function todoRows(todos) {
  if (!todos.length) return `<div class="empty">You're all caught up.</div>`;
  return `<div class="group group--icons">${todos.map(t => `
    <a class="cell" href="${esc(t.href)}">
      <span class="ico ico--amber">${icons[t.icon] || icons.target}</span>
      <span class="cell__t">${esc(t.title)}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>
      <span class="pill${t.solid ? ' pill--solid' : ''}">${esc(t.pill)}</span>
    </a>`).join('')}</div>`;
}

function latestRow(l) {
  if (!l) return '';
  return `<div class="sec">Your latest game</div>
  <div class="group"><a class="cell" href="${esc(l.href)}">
    <span class="date">${esc(l.date)}</span>
    <span class="cell__t">vs ${esc(l.opp)}${l.line ? `<small>You: ${esc(l.line)}</small>` : '<small>Didn\'t play</small>'}</span>
    <span class="res ${l.won ? 'res--w' : 'res--l'}">${l.won ? 'W' : 'L'} ${l.my}–${l.oppScore}</span>${chev}
  </a></div>`;
}

function setupCard(s) {
  if (!s || s.done >= s.total) return '';
  const pct = Math.round((s.done / s.total) * 100);
  return `<a class="card setup-card" href="${esc(s.href)}" style="margin-bottom:12px">
    <div class="row"><b>Finish setting up</b><span class="muted" style="font-size:13px">${s.done} of ${s.total}</span></div>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <div class="muted" style="font-size:13px;margin-top:8px">Next: ${esc(s.nextLabel)} ›</div>
  </a>`;
}

// Shown only in the browser (app.js hides it once running from the home screen) — the
// iPhone steps, since Safari has no install button; Android gets its own prompt.
const installCard = `<div class="card install" data-install-card hidden style="margin-top:12px">
  <span class="app-icon">${ballSvg}</span>
  <div><b>Add WKND to your home screen</b>
    <p data-install-ios>Tap <svg class="share-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 11v9h14v-9"/></svg> Share, then <b style="font-size:13px">Add to Home Screen</b>.</p>
    <p data-install-android hidden><button class="link" type="button" data-install-btn>Install the app</button> for alerts and one-tap access.</p>
  </div>
</div>`;

export function appHomePage({ phase, me, upNext, todos, latest, setup }) {
  return `
  <header class="lt lt--logo">${appLogo(phase)}<a href="/app/me" aria-label="Me">${appAvatar({ ...me, badge: me.unread })}</a></header>
  ${setupCard(setup)}
  ${upNextCard(upNext)}
  <div class="sec">To do</div>
  ${todoRows(todos)}
  ${latestRow(latest)}
  ${installCard}`;
}
