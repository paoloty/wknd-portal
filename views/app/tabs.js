// The other four tabs and the notifications list. My Team and Me are read-only views of
// data the site already has. Nothing here links out to the site except "Open full site"
// in More (layout.js isAppHref): site-only things show as information.
import { esc, appAvatar, chev, icons, backChev, isAppHref, soonTag } from './layout.js';

const lt = (title, me) => `<header class="lt"><h1>${esc(title)}</h1>${me ? `<a href="/app/me" aria-label="Me">${appAvatar({ ...me, badge: me.unread })}</a>` : ''}</header>`;

// roster: [{ id, name, number, positions, photoUrl, initials, isMe, isHead }]
export function appTeamPage({ me, team, roster, nextGame, record }) {
  if (!team) {
    return `${lt('My Team', me)}<div class="empty">You're not on a team yet. Teams show up here once rosters are out.</div>`;
  }
  return `${lt('My Team', me)}
  <div class="card prof">
    <span class="avatar avatar--lg" style="--ring:${esc(team.color)}">${esc(team.name.slice(0, 2))}</span>
    <div style="flex:1"><h2>${esc(team.name)}</h2><div class="prof__sub">${esc(record || 'No games yet')}</div></div>
  </div>
  ${nextGame ? `<div class="sec">Next game</div>
  <div class="group"><div class="cell"><span class="dot" style="--c:${esc(nextGame.oppColor)}"></span><span class="cell__t">vs ${esc(nextGame.opp)}<small>${esc(nextGame.when)}</small></span></div></div>` : ''}
  <div class="sec">Roster · ${roster.length}</div>
  <div class="group">${roster.map(p => `
    <div class="cell">
      ${appAvatar({ playerId: p.id, initials: p.initials, ring: team.color, photoUrl: p.photoUrl })}
      <span class="cell__t">${esc(p.name)}${p.isMe ? ' <span class="muted" style="font-weight:400">· You</span>' : ''}<small>${esc([p.positions, p.isHead ? 'Team head' : ''].filter(Boolean).join(' · ') || ' ')}</small></span>
      <span class="num" style="font-size:18px;color:var(--muted)">${p.number !== '' ? `#${esc(p.number)}` : ''}</span>
    </div>`).join('')}</div>`;
}

// season: { label, gp, ppg, rpg, apg } · games: [{ date, opp, won, my, oppScore, line }]
export function appMePage({ me, season, games, positions }) {
  return `${lt('Me', null)}
  <div class="card prof">
    ${appAvatar({ ...me, size: 'lg' })}
    <div style="flex:1;min-width:0"><h2>${esc(me.name.toUpperCase())}</h2>
      <div class="prof__sub"><span class="dot" style="--c:${esc(me.ring)}"></span>${esc([me.teamName || 'No team', me.number !== '' ? `#${me.number}` : '', positions].filter(Boolean).join(' · '))}</div></div>
  </div>
  <div class="sec">${esc(season.label)}</div>
  <div class="tiles" style="margin-top:0">
    <div><b>${season.ppg}</b><small>PTS</small></div><div><b>${season.rpg}</b><small>REB</small></div>
    <div><b>${season.apg}</b><small>AST</small></div><div><b>${season.gp}</b><small>GP</small></div>
  </div>
  <div class="sec">Last games</div>
  ${games.length ? `<div class="group">${games.map(g => `
    <div class="cell"><span class="date">${esc(g.date)}</span><span class="cell__t">vs ${esc(g.opp)}</span>
      <span class="res ${g.won ? 'res--w' : 'res--l'}">${g.won ? 'W' : 'L'} ${g.my}–${g.oppScore}</span><span class="line">${esc(g.line)}</span></div>`).join('')}</div>
  <p class="foot-note">Points · rebounds · assists</p>` : '<div class="empty">No games played yet this season.</div>'}
  <div class="sec">Profile</div>
  <div class="group group--icons">
    <a class="cell" href="/app/setup/photo"><span class="ico">${icons.camera}</span><span class="cell__t">Change photo</span>${chev}</a>
    <a class="cell" href="/app/setup/details"><span class="ico">${icons.user}</span><span class="cell__t">Edit details</span>${chev}</a>
  </div>`;
}

export function appPapawisPage({ me }) {
  return `${lt('Papawis', me)}
  <div class="card" style="text-align:center;padding:26px 18px">
    <div class="kick">Coming to the app next</div>
    <p class="muted" style="margin:8px 0 0;font-size:14.5px">Joining runs, the waitlist and your free runs move in here in the next build.</p>
  </div>`;
}

// rows: [{ icon, title, value, href, count, amber, soon }] — a row without an /app href is
// information only; soon adds the "Soon" pill (it'll be tappable once built into the app).
export function appMorePage({ me, rows }) {
  const row = r => {
    const inner = `<span class="ico${r.amber ? ' ico--amber' : ''}">${icons[r.icon]}</span><span class="cell__t">${esc(r.title)}</span>${r.count ? `<span class="count">${r.count}</span>` : ''}${r.value ? `<span class="cell__v">${esc(r.value)}</span>` : ''}`;
    return isAppHref(r.href) ? `<a class="cell" href="${esc(r.href)}">${inner}${chev}</a>` : `<div class="cell">${inner}${r.soon ? soonTag : ''}</div>`;
  };
  return `${lt('More', me)}
  <div class="group group--icons">${rows.map(row).join('')}</div>
  <div class="sec">Settings</div>
  <div class="group group--icons">
    <div class="cell"><span class="ico">${icons.moon}</span><span class="cell__t">Appearance</span></div>
    <div class="cell" style="padding-top:0"><div class="seg" style="flex:1" data-theme-switch>
      ${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"><span>${l}</span></label>`).join('')}
    </div></div>
    <a class="cell" href="/app/setup/details"><span class="ico">${icons.user}</span><span class="cell__t">Edit profile</span>${chev}</a>
    <a class="cell" href="/"><span class="ico">${icons.globe}</span><span class="cell__t">Open full site</span>${icons.ext}</a>
  </div>
  <form method="post" action="/app/logout" style="margin-top:16px">
    <div class="group"><button class="cell" type="submit" style="justify-content:center"><span style="color:var(--danger);font-weight:600">Log out</span></button></div>
  </form>
  <p class="foot-note" style="text-align:center;margin-top:14px">Signed in as ${esc(me.email)}</p>`;
}

// items: [{ title, body, when, unread }]
export function appNotificationsPage({ items }) {
  return `
  <div class="navbar"><a class="navbar__back" href="/app/more">${backChev}More</a><span class="navbar__title">Notifications</span><span></span></div>
  ${items.length ? `<div class="group" style="margin-top:8px">${items.map(n => `
    <div class="cell">
      <span class="dot" style="--c:${n.unread ? 'var(--amber)' : 'transparent'}"></span>
      <span class="cell__t">${esc(n.title)}${n.body ? `<small>${esc(n.body)}</small>` : ''}<small>${esc(n.when)}</small></span>
    </div>`).join('')}</div>` : '<div class="empty" style="margin-top:8px">Nothing yet.</div>'}`;
}
