// Pieces of the player's game day, shared by the tabs: the Up next countdown (My Team), the
// To do list (Me), and Home's header, Finish setup and Add to Home Screen cards. Home itself
// is the feed (views/app/feed.js appHomeFeedPage).
import { esc, appLogo, icons, ballSvg, isAppHref, soonTag } from './layout.js';

// tipAt: epoch ms of tip-off (Manila), or 0 when the time isn't set — the countdown then
// counts to the start of game day. app.js ticks it every minute.
export function upNextCard(u) {
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
    <div class="hero__foot"><span>${esc(u.foot)}</span></div>
  </div>`;
}

export function todoRows(todos) {
  if (!todos.length) return '';
  // Things done on the site stay listed (so they're not forgotten) but aren't tappable.
  return `<div class="group group--icons">${todos.map(t => {
    const inApp = isAppHref(t.href);
    const inner = `<span class="ico ico--amber">${icons[t.icon] || icons.target}</span>
      <span class="cell__t">${esc(t.title)}${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span>
      ${inApp ? `<span class="pill${t.solid ? ' pill--solid' : ''}">${esc(t.pill)}</span>` : soonTag}`;
    return inApp ? `<a class="cell" href="${esc(t.href)}">${inner}</a>` : `<div class="cell">${inner}</div>`;
  }).join('')}</div>`;
}

export function setupCard(s) {
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
export const installCard = `<div class="card install" data-install-card hidden style="margin-bottom:12px">
  <span class="app-icon">${ballSvg}</span>
  <div><b>Add WKND to your home screen</b>
    <p data-install-ios>Tap <svg class="share-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 11v9h14v-9"/></svg> Share, then <b style="font-size:13px">Add to Home Screen</b>.</p>
    <p data-install-android hidden><button class="link" type="button" data-install-btn>Install the app</button> for alerts and one-tap access.</p>
  </div>
</div>`;

// Home's large title: the logo, and the bell for notifications (red count while unread).
export function homeHeader({ phase, unread = 0 }) {
  return `<header class="lt lt--logo">${appLogo(phase)}<a class="bell" href="/app/notifications" aria-label="Notifications${unread ? `, ${unread} unread` : ''}">${icons.bell}${unread ? `<span class="badge-dot">${unread > 9 ? '9+' : unread}</span>` : ''}</a></header>`;
}
