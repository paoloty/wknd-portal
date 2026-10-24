// My Team, Me and Settings, plus the notifications list. My Team and Me are read-only
// views of data the site already has. Nothing here links out to the site except "Open full
// site" in Settings (layout.js isAppHref): site-only things show as information.
import { esc, appAvatar, chev, icons, backChev, isAppHref, soonTag, lazyList, ballSvg } from './layout.js';
import { upNextCard, todoCard } from './home.js';

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
      <span class="num roster__no">${p.number !== '' ? `#${esc(p.number)}` : ''}</span>
    </div>`).join('')}</div>`;
}

// todos: views/app/home.js todoCard items · season: { label, gp, ppg, rpg, apg }
// games: [{ date, opp, won, my, oppScore, line, href }]
export function appMePage({ me, season, games, positions, todos = [] }) {
  return `${lt('Me', `<a class="lt__icon" href="/app/settings" aria-label="Settings">${icons.gear}</a>`)}
  <div class="card glow prof">
    ${appAvatar({ ...me, size: 'lg' })}
    <div style="flex:1;min-width:0"><h2>${esc(me.name)}</h2>
      <div class="prof__sub"><span class="dot" style="--c:${esc(me.ring)}"></span>${esc([me.teamName || 'No team', me.number !== '' ? `#${me.number}` : '', positions].filter(Boolean).join(' · '))}</div></div>
    <a class="prof__edit" href="/app/setup/details">Edit</a>
  </div>
  ${todos.length ? `<div class="sec">To do</div>${todoCard(todos)}` : ''}
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

// Under Me (gear). rows: [{ icon, title, value, href, count, soon }] — a row without an
// /app href is information only.
// push: [{ key, label, sub, on }] — the kinds of notification (lib/push.js PUSH_KINDS).
// The on/off for this phone is the browser's, so public/app.js (initPush) fills that part in.
export function appSettingsPage({ me, rows, push = [] }) {
  const row = r => {
    const inner = `<span class="ico">${icons[r.icon]}</span><span class="cell__t">${esc(r.title)}</span>${r.count ? `<span class="count">${r.count}</span>` : ''}${r.value ? `<span class="cell__v">${esc(r.value)}</span>` : ''}`;
    return isAppHref(r.href) ? `<a class="cell" href="${esc(r.href)}">${inner}${chev}</a>` : `<div class="cell">${inner}${r.soon ? soonTag : ''}</div>`;
  };
  return `
  <div class="navbar"><a class="navbar__back" href="/app/me">${backChev}Me</a><span class="navbar__title">Settings</span><span></span></div>
  <div class="group group--icons" style="margin-top:8px">${rows.map(row).join('')}</div>
  <div class="sec">Notifications</div>
  <div class="group" data-push>
    <div class="cell"><span class="ico ico--amber">${icons.bell}</span><span class="cell__t">On this phone<small data-push-status>Checking…</small></span>
      <button type="button" class="pill pill--solid" data-push-toggle hidden>Turn on</button></div>
    ${push.map(k => `<label class="cell push-kind"><span class="cell__t">${esc(k.label)}<small>${esc(k.sub)}</small></span>
      <input type="checkbox" class="switch" data-push-kind="${esc(k.key)}"${k.on ? ' checked' : ''}></label>`).join('')}
  </div>
  <p class="foot-note">Account messages (balance, Rate &amp; Win) always come through. <button type="button" class="link" data-push-test hidden>Send a test</button></p>
  <div class="sec">Appearance</div>
  <div class="group"><div class="cell"><div class="seg" style="flex:1" data-theme-switch>
    ${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}"><span>${l}</span></label>`).join('')}
  </div></div></div>
  <div class="group group--icons" style="margin-top:16px">
    <a class="cell" href="/?from=app"><span class="ico">${icons.globe}</span><span class="cell__t">Open full site</span>${icons.ext}</a>
  </div>
  <form method="post" action="/app/logout" style="margin-top:16px">
    <div class="group"><button class="cell cell--danger" type="submit">Log out</button></div>
  </form>
  <p class="foot-note" style="text-align:center;margin-top:14px">Signed in as ${esc(me.email)}</p>`;
}

// The screen is just the shell; the rows load through /app/notifications/items.
export function appNotificationsPage() {
  return `
  <div class="navbar"><a class="navbar__back" href="/app">${backChev}Home</a><span class="navbar__title">Notifications</span><span></span></div>
  <div class="nf-list">${lazyList({ src: '/app/notifications/items', empty: 'Nothing yet.', plain: true })}</div>`;
}

// The face on a notification row (app notice faces mockup, 2026-10-24): a person did it →
// their photo (two stacked when several did), with a corner badge for what they did; it's
// about you → your photo; a run → its cover; the app or the league → an icon tile.
const NF_BADGE = [
  [/^comment_mention/, icons.at], [/^comment_reaction/, icons.flame], [/comment/, icons.comment],
  [/^stat_card/, icons.me],
];
const NF_TILE = [
  [/^(pick_reminder|app_pick_closing)/, icons.clock], [/^(pick_|app_pick)/, icons.target],
  [/^mvp_podium$/, icons.trophy, 'gold'], [/^mvp_/, icons.trophy],
  [/^(app_announcement|admin_message|quiet_nudge|post)/, 'logo'],
  [/^(ledger_|balance_|banned|ban_lifted|papawis_completed|raffle_won)/, icons.wallet],
  [/^(papawis_|court_)/, icons.ball], [/^(game_rate|court_rate)/, icons.picks],
  [/^poll_/, icons.form], [/^jersey_/, icons.shirt], [/^(fine_|report_)/, icons.scale],
];
const pick = (list, type) => (list.find(([re]) => re.test(type)) || [])[1] || '';
function notificationFace(n) {
  const people = n.people || [];
  if (people.length) {
    const b = pick(NF_BADGE, n.type);
    const badge = b ? `<span class="nf__kind">${b}</span>` : '';
    if (people.length > 1) return `<span class="nf nf--stack">${people.slice(0, 2).map(p => appAvatar(p)).join('')}${badge}</span>`;
    return `<span class="nf">${appAvatar(people[0])}${badge}</span>`;
  }
  if (n.cover) return `<span class="nf"><span class="nf__tile nf__tile--cover"><img src="${esc(n.cover)}" alt="" loading="lazy" onerror="this.remove()">${icons.ball}</span></span>`;
  const [, icon, tone] = NF_TILE.find(([re]) => re.test(n.type)) || [null, icons.bell];
  if (icon === 'logo') return `<span class="nf"><span class="nf__tile nf__tile--logo">${ballSvg}</span></span>`;
  return `<span class="nf"><span class="nf__tile${tone ? ` nf__tile--${tone}` : ''}">${icon}</span></span>`;
}

// items: [{ type, title, body, when, unread, href, people, cover, day }] — one page of the
// lazy list. people: [{ playerId, initials, ring, photoUrl }] (appAvatar), cover: a run's
// picture. day: Today / Yesterday / This week / Earlier; a heading starts each new one, and
// prevDay (the last row of the page before) lets a page carry on the group it ended in.
export function appNotificationRows(items, { prevDay = '' } = {}) {
  // href: the app screen it's about (server.js appLinkFor); tapping opens it.
  let out = '', day = prevDay, open = false;
  for (const n of items) {
    if (n.day !== day || !open) {
      if (open) out += '</div>';
      if (n.day !== day) out += `<div class="sec nf-day">${esc(n.day)}</div>`;
      out += '<div class="group group--nf">'; open = true; day = n.day;
    }
    const inner = `${notificationFace(n)}
      <span class="cell__t${n.unread ? ' is-new' : ''}">${esc(n.title)}${n.body ? `<small>${esc(n.body)}</small>` : ''}</span>
      <span class="nf__r"><span class="nf__when">${esc(n.when)}</span>${n.unread ? '<span class="nf__dot" aria-label="New"></span>' : ''}</span>`;
    out += n.href && n.href !== '/app/notifications' ? `<a class="cell cell--nf" href="${esc(n.href)}">${inner}</a>` : `<div class="cell cell--nf">${inner}</div>`;
  }
  return open ? `${out}</div>` : out;
}
