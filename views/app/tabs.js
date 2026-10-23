// My Team, Me and Settings, plus the notifications list. My Team and Me are read-only
// views of data the site already has. Nothing here links out to the site except "Open full
// site" in Settings (layout.js isAppHref): site-only things show as information.
import { esc, appAvatar, chev, icons, backChev, isAppHref, soonTag, lazyList } from './layout.js';
import { upNextCard, todoRows } from './home.js';

// Large title; right: optional HTML on the right (Me's gear).
const lt = (title, right = '') => `<header class="lt"><h1>${esc(title)}</h1>${right}</header>`;
const resCell = g => `<span class="res ${g.won ? 'res--w' : 'res--l'}">${g.won ? 'W' : 'L'} ${g.my}–${g.oppScore}</span>`;

// team: { name, color, record, standing } · upNext: views/app/home.js upNextCard data
// schedule: [{ date, opp, oppColor, played, won, my, oppScore, when, href }]
// roster: [{ id, name, number, positions, photoUrl, initials, isMe, isHead }]
export function appTeamPage({ me, team, roster = [], upNext = null, schedule = [], season = '' }) {
  if (!team) {
    return `${lt('My Team')}<div class="empty">You're not on a team yet. Teams show up here once rosters are out.</div>`;
  }
  // Upcoming games soonest first, then results newest first.
  const rows = list => list.map(g => {
    const inner = `<span class="date">${esc(g.date)}</span><span class="dot" style="--c:${esc(g.oppColor)}"></span><span class="cell__t">vs ${esc(g.opp)}${g.played ? '' : `<small>${esc(g.when)}</small>`}</span>${g.played ? resCell(g) : ''}`;
    return g.href ? `<a class="cell" href="${esc(g.href)}">${inner}${chev}</a>` : `<div class="cell">${inner}</div>`;
  }).join('');
  const upcoming = schedule.filter(g => !g.played), results = schedule.filter(g => g.played).reverse();
  // No team card: Up next already names the team, so the record and standing sit under the title.
  return `<header class="lt"><div><h1>My Team</h1><div class="lt__sub"><span class="dot" style="--c:${esc(team.color)}"></span>${esc([team.name, team.record, team.standing].filter(Boolean).join(' · '))}</div></div></header>
  ${upNextCard(upNext)}
  ${upcoming.length ? `<div class="sec">Coming up</div><div class="group">${rows(upcoming)}</div>` : ''}
  ${results.length ? `<div class="sec">Season ${esc(season)} results</div><div class="group">${rows(results)}</div>` : ''}
  <div class="sec">Roster · ${roster.length}</div>
  <div class="group">${roster.map(p => `
    <div class="cell">
      ${appAvatar({ playerId: p.id, initials: p.initials, ring: team.color, photoUrl: p.photoUrl })}
      <span class="cell__t">${esc(p.name)}${p.isMe ? ' <span class="muted" style="font-weight:400">· You</span>' : ''}<small>${esc([p.positions, p.isHead ? 'Team head' : ''].filter(Boolean).join(' · ') || ' ')}</small></span>
      <span class="num" style="font-size:18px;color:var(--muted)">${p.number !== '' ? `#${esc(p.number)}` : ''}</span>
    </div>`).join('')}</div>`;
}

// todos: views/app/home.js todoRows items · season: { label, gp, ppg, rpg, apg }
// games: [{ date, opp, won, my, oppScore, line, href }]
export function appMePage({ me, season, games, positions, todos = [] }) {
  return `${lt('Me', `<a class="lt__icon" href="/app/settings" aria-label="Settings">${icons.gear}</a>`)}
  <div class="card prof">
    ${appAvatar({ ...me, size: 'lg' })}
    <div style="flex:1;min-width:0"><h2>${esc(me.name.toUpperCase())}</h2>
      <div class="prof__sub"><span class="dot" style="--c:${esc(me.ring)}"></span>${esc([me.teamName || 'No team', me.number !== '' ? `#${me.number}` : '', positions].filter(Boolean).join(' · '))}</div></div>
    <a class="prof__edit" href="/app/setup/details">Edit</a>
  </div>
  ${todos.length ? `<div class="sec">To do</div>${todoRows(todos)}` : ''}
  <div class="sec">${esc(season.label)}</div>
  <div class="tiles" style="margin-top:0">
    <div><b>${season.ppg}</b><small>PTS</small></div><div><b>${season.rpg}</b><small>REB</small></div>
    <div><b>${season.apg}</b><small>AST</small></div><div><b>${season.gp}</b><small>GP</small></div>
  </div>
  <div class="sec">Your games</div>
  ${games.length ? `<div class="group">${games.map(g => `
    <a class="cell" href="${esc(g.href)}"><span class="date">${esc(g.date)}</span><span class="cell__t">vs ${esc(g.opp)}</span>
      ${resCell(g)}<span class="line">${esc(g.line)}</span>${chev}</a>`).join('')}</div>
  <p class="foot-note">Points · rebounds · assists</p>` : '<div class="empty">No games played yet this season.</div>'}
  <div class="sec">Profile</div>
  <div class="group group--icons">
    <a class="cell" href="/app/setup/photo"><span class="ico">${icons.camera}</span><span class="cell__t">Change photo</span>${chev}</a>
    <a class="cell" href="/app/setup/details"><span class="ico">${icons.user}</span><span class="cell__t">Edit details</span>${chev}</a>
  </div>`;
}

export function appPapawisPage() {
  return `${lt('Papawis')}
  <div class="card" style="text-align:center;padding:26px 18px">
    <div class="kick">Coming to the app next</div>
    <p class="muted" style="margin:8px 0 0;font-size:14.5px">Joining runs, the waitlist and your free runs move in here in the next build. Open runs already show on Home.</p>
  </div>`;
}

// Under Me (gear). rows: [{ icon, title, value, href, count, soon }] — a row without an
// /app href is information only.
export function appSettingsPage({ me, rows }) {
  const row = r => {
    const inner = `<span class="ico">${icons[r.icon]}</span><span class="cell__t">${esc(r.title)}</span>${r.count ? `<span class="count">${r.count}</span>` : ''}${r.value ? `<span class="cell__v">${esc(r.value)}</span>` : ''}`;
    return isAppHref(r.href) ? `<a class="cell" href="${esc(r.href)}">${inner}${chev}</a>` : `<div class="cell">${inner}${r.soon ? soonTag : ''}</div>`;
  };
  return `
  <div class="navbar"><a class="navbar__back" href="/app/me">${backChev}Me</a><span class="navbar__title">Settings</span><span></span></div>
  <div class="group group--icons" style="margin-top:8px">${rows.map(row).join('')}</div>
  <div class="sec">Appearance</div>
  <div class="group"><div class="cell"><div class="seg" style="flex:1" data-theme-switch>
    ${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"><span>${l}</span></label>`).join('')}
  </div></div></div>
  <div class="group group--icons" style="margin-top:16px">
    <a class="cell" href="/?from=app"><span class="ico">${icons.globe}</span><span class="cell__t">Open full site</span>${icons.ext}</a>
  </div>
  <form method="post" action="/app/logout" style="margin-top:16px">
    <div class="group"><button class="cell" type="submit" style="justify-content:center"><span style="color:var(--danger);font-weight:600">Log out</span></button></div>
  </form>
  <p class="foot-note" style="text-align:center;margin-top:14px">Signed in as ${esc(me.email)}</p>`;
}

// The screen is just the shell; the rows load through /app/notifications/items.
export function appNotificationsPage() {
  return `
  <div class="navbar"><a class="navbar__back" href="/app">${backChev}Home</a><span class="navbar__title">Notifications</span><span></span></div>
  <div style="margin-top:8px">${lazyList({ src: '/app/notifications/items', empty: 'Nothing yet.' })}</div>`;
}

// items: [{ title, body, when, unread }] — one page of rows for the lazy list.
export function appNotificationRows(items) {
  return items.map(n => `
    <div class="cell">
      <span class="dot" style="--c:${n.unread ? 'var(--amber)' : 'transparent'}"></span>
      <span class="cell__t">${esc(n.title)}${n.body ? `<small>${esc(n.body)}</small>` : ''}<small>${esc(n.when)}</small></span>
    </div>`).join('');
}
