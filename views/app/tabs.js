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
// links: { standing, bracket, games } — the Season screen's tiles, each with one fact (or null).
export function appTeamPage({ me, team, roster = [], upNext = null, schedule = [], season = '', links = null }) {
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
  ${links ? `<div class="ss-links">
    <a class="ss-link" href="/app/season"><span class="ico">${icons.me}</span><b>Standings</b><small>${esc(links.standing)}</small></a>
    <a class="ss-link" href="/app/season/bracket"><span class="ico">${icons.trophy}</span><b>Bracket</b><small>${esc(links.bracket)}</small></a>
    <a class="ss-link" href="/app/season/games"><span class="ico">${icons.ball}</span><b>Games</b><small>${esc(links.games)}</small></a>
  </div>` : ''}
  ${upNextCard(upNext)}
  ${upcoming.length ? `<div class="sec">Coming up</div><div class="group">${rows(upcoming)}</div>` : ''}
  ${results.length ? `<div class="sec">Season ${esc(season)} results</div><div class="group">${rows(results)}</div>` : ''}
  <div class="sec">Roster · ${roster.length}</div>
  <div class="group">${roster.map(p => `
    <a class="cell" href="${p.isMe ? '/app/me' : `/app/players/${encodeURIComponent(p.id)}?from=team`}">
      ${appAvatar({ playerId: p.id, initials: p.initials, ring: team.color, photoUrl: p.photoUrl })}
      <span class="cell__t">${esc(p.name)}${p.isMe ? ' <span class="muted" style="font-weight:400">· You</span>' : ''}<small>${esc([p.positions, p.isHead ? 'Team head' : ''].filter(Boolean).join(' · ') || ' ')}</small></span>
      <span class="num roster__no">${p.number !== '' ? `#${esc(p.number)}` : ''}</span>${chev}
    </a>`).join('')}</div>`;
}

// todos: views/app/home.js todoCard items · season: { label, gp, ppg, rpg, apg }
// games: [{ date, opp, won, my, oppScore, line, href }]
// scoring: { games } for scorers, anyone picked to score, and admins (server.js scoringMenuFor), else null.
// cover: { own } — the profile's cover is the player's own photo (else their team's colours).
// Its buttons sit under Change photo (Paolo, 2026-10-29: not over the cover, too big there).
// Me, today first (Paolo, 2026-11-01, mockup claude.ai/artifact/79gtR9oxJh42xnh29PLn7d, B): a
// greeting, the one thing that needs you now, your week, the rest of the to-dos, how you're
// doing (season and Papawis, each with a points line), recent games and runs, Scoring, then
// the profile rows. Data: server.js /app/me.
// now: { kick, title, sub, red, actions: [{ label, href, ghost }] } | null
// week: [{ dow, day, today, game, run }] (7 days from today)
// doing: { season: { label, gp, ppg, sub, spark, href }, papawis: same | null }
// recent: [{ date, title, res, won, line, href, share? }]
// scoring: server.js appScoringMenu, or null (one row; the Scoring screen has the rest).
const spark = (pts, color) => {
  if (pts.length < 2) return '<span class="me-spark me-spark--none"></span>';
  const max = Math.max(...pts, 1), w = 100, h = 26;
  const xy = pts.map((v, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`);
  const last = xy[xy.length - 1].split(',');
  return `<svg class="me-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${xy.join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
};
// feedAdmin: an admin, so Me has the Feed posts row (/app/admin/feed).
export function appMePage({ me, positions, todos = [], scoring = null, cover = null, now = null, week = [], doing = null, recent = [], things = 0, feedAdmin = false }) {
  // Given names ("Jose Paolo TY" → "Jose Paolo"); the team in title case.
  const words = String(me.name || '').split(' ').filter(Boolean);
  const first = (words.length > 1 ? words.slice(0, -1).join(' ') : words[0]) || 'there';
  const teamName = String(me.teamName || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const mini = (k, c, color) => c ? `<a class="me-mini" href="${esc(c.href)}"><span class="me-mini__k">${esc(k)}</span><span class="me-mini__v"><b class="num">${esc(c.ppg)}</b><small>PPG</small></span>${spark(c.spark || [], color)}<span class="me-mini__s">${esc(c.sub)}</span></a>` : '';
  const recentRow = r => {
    // The line under the name ("16 PTS · 6 REB · 5 AST"), not a column of its own.
    const [pts, reb, ast] = String(r.line || '').split('·');
    const main = `<a class="me-rec__a" href="${esc(r.href)}"><span class="date">${esc(r.date)}</span><span class="cell__t">${esc(r.sub ? `${r.title} · ${r.sub}` : r.title)}<small>${esc(`${pts || 0} PTS · ${reb || 0} REB · ${ast || 0} AST`)}</small></span><span class="res ${r.won ? 'res--w' : r.even ? 'res--e' : 'res--l'}">${esc(r.res)}</span>${r.share ? '' : `<span class="me-rec__end">${chev}</span>`}</a>`;
    return `<div class="cell me-rec">${main}${r.share ? `<a class="pwp-share" href="${esc(r.share)}" aria-label="Share my stats from ${r.title.startsWith('Papawis') ? 'this run' : 'this game'}">${icons.share}</a>` : ''}</div>`;
  };
  return `${lt('Me', `<a class="lt__icon" href="/app/settings" aria-label="Settings">${icons.gear}</a>`)}
  <div class="me-hi">
    <a class="me-hi__av" href="/app/players/${encodeURIComponent(me.playerId)}?from=me" aria-label="My profile">${appAvatar({ ...me, size: 'lg' })}</a>
    <span class="me-hi__t"><b>Hey ${esc(first)}</b><small><span class="dot" style="--c:${esc(me.ring)}"></span>${esc([teamName || 'No team', me.number !== '' ? `#${me.number}` : '', things ? `${things} thing${things === 1 ? '' : 's'} for you` : 'All caught up'].filter(Boolean).join(' · '))}</small></span>
    <a class="prof__edit" href="/app/setup/details">Edit</a>
  </div>
  ${now ? `<section class="me-now${now.red ? ' me-now--red' : ''}" aria-label="${esc(now.kick)}">
    <span class="me-now__k">${esc(now.kick)}</span>
    <b class="me-now__t">${esc(now.title)}</b>
    ${now.sub ? `<span class="me-now__s">${esc(now.sub)}</span>` : ''}
    <div class="me-now__b">${now.actions.map(a => `<a class="me-now__btn${a.ghost ? ' me-now__btn--ghost' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</div>
  </section>` : ''}
  ${week.length ? `<div class="sec">This week</div>
  <div class="me-week" role="list">${week.map(d => `<div class="me-day${d.today ? ' is-today' : ''}" role="listitem" aria-label="${esc(d.dow)} ${d.day}${d.game ? ', a game' : ''}${d.run ? ', a Papawis run' : ''}"><span>${esc(d.dow)}</span><b class="num">${d.day}</b><i class="${d.game ? 'is-game' : ''}${d.run ? ' is-run' : ''}"></i></div>`).join('')}</div>
  <p class="foot-note me-legend"><i class="is-game"></i>Your games <i class="is-run"></i>Your Papawis runs</p>` : ''}
  ${todos.length ? `<div class="sec">To do</div>${todoCard(todos)}` : ''}
  ${doing ? `<div class="sec">How you’re doing</div>
  <div class="me-minis${doing.papawis ? '' : ' me-minis--one'}">${mini(doing.season.label, doing.season, 'var(--blue, #3b82f6)')}${mini('Papawis', doing.papawis, 'var(--amber)')}</div>` : ''}
  ${recent.length ? `<div class="sec">Recent</div>
  <div class="group">${recent.map(recentRow).join('')}</div>` : ''}
  ${scoring ? `<div class="group group--icons me-scoring">
    <a class="cell" href="/app/scoring"><span class="ico ico--amber">${icons.ball}</span><span class="cell__t">${scoring.league || scoring.admin ? 'Scoring' : 'Learn to score Papawis'}<small>${scoring.games ? `${scoring.games} to score now` : scoring.league || scoring.admin ? 'Games to score, practice, guides' : 'A practice run and the guide'}</small></span>${scoring.games ? `<span class="count">${scoring.games}</span>` : ''}${chev}</a>
  </div>` : ''}
  ${feedAdmin ? `<div class="group group--icons me-scoring">
    <a class="cell" href="/app/admin/feed"><span class="ico">${icons.megaphone}</span><span class="cell__t">Feed posts<small>Admin: highlights, photos, Facebook posts, announcements</small></span>${chev}</a>
  </div>` : ''}
  <div class="sec">Profile</div>
  <div class="group group--icons">
    <a class="cell" href="/app/players/${encodeURIComponent(me.playerId)}?from=me"><span class="ico">${icons.user}</span><span class="cell__t">View my profile<small>${esc([teamName, me.number !== '' ? `#${me.number}` : '', positions].filter(Boolean).join(' · ') || 'As other players see it')}</small></span>${chev}</a>
    <a class="cell" href="/app/setup/photo"><span class="ico">${icons.camera}</span><span class="cell__t">Change photo</span>${chev}</a>
    ${cover ? `<button type="button" class="cell" data-cover-pick><span class="ico">${icons.image}</span><span class="cell__t">${cover.own ? 'Change cover photo' : 'Add a cover photo'}<small>${cover.own ? 'The wide photo at the top of your profile' : 'For now it’s your team’s colours'}</small></span>${chev}</button>
    ${cover.own ? `<button type="button" class="cell" data-cover-remove><span class="ico">${icons.close}</span><span class="cell__t">Remove cover photo<small>Go back to your team’s colours</small></span></button>` : ''}
    <input type="file" accept="image/*" data-cover-input hidden>` : ''}
  </div>`;
}

// Under Me (gear). rows: [{ icon, title, value, href, count, soon }] — a row without an
// /app href is information only.
// push: [{ key, label, sub, on }] — the kinds of notification (lib/push.js PUSH_KINDS).
// The on/off for this phone is the browser's, so public/app.js (initPush) fills that part in.
// online: Show me as online (Barkadahan), or null when the Barkadahan is off.
export function appSettingsPage({ me, rows, push = [], analytics = true, online = null }) {
  const row = r => {
    const inner = `<span class="ico">${icons[r.icon]}</span><span class="cell__t">${esc(r.title)}</span>${r.count ? `<span class="count">${r.count}</span>` : ''}${r.value ? `<span class="cell__v">${esc(r.value)}</span>` : ''}`;
    return isAppHref(r.href) ? `<a class="cell" href="${esc(r.href)}">${inner}${chev}</a>` : `<div class="cell">${inner}${r.soon ? soonTag : ''}</div>`;
  };
  return `
  <div class="navbar"><a class="navbar__back" href="/app/me">${backChev}Me</a><span class="navbar__title">Settings</span><span></span></div>
  <div class="group group--icons">${rows.map(row).join('')}</div>
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
  <div class="sec">Privacy</div>
  <div class="group"><label class="cell"><span class="cell__t">Analytics<small>Google Analytics sees which screens you open, so we know what to improve. No ads.</small></span>
    <input type="checkbox" class="switch" data-analytics${analytics ? ' checked' : ''}></label>${online === null ? '' : `
    <label class="cell"><span class="cell__t">Show me as online<small>In the Barkadahan’s online list while the app is open.</small></span>
    <input type="checkbox" class="switch" data-online-visible${online ? ' checked' : ''}></label>`}</div>
  <p class="foot-note">More in the <a class="link" href="/privacy">Privacy Policy</a>.</p>
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

// The Scoring screen (Me → Scoring, 2026-11-01): what was a long list on Me, grouped. Each
// group shows only to who can use it. s: server.js appScoringMenu
// ({ league, games, pw, admin: { games, papawis } | null }).
export function appScoringPage(s) {
  const row = (href, icon, title, sub, extra = '', attrs = '') => `<a class="cell" href="${href}"${attrs}><span class="ico${icon === 'ball' ? ' ico--amber' : ''}">${icons[icon]}</span><span class="cell__t">${title}<small>${sub}</small></span>${extra}${chev}</a>`;
  const group = (label, rows) => (rows.filter(Boolean).length ? `<div class="sec">${label}</div><div class="group group--icons">${rows.filter(Boolean).join('')}</div>` : '');
  return `<div class="navbar"><a class="navbar__back" href="/app/me">${backChev}Me</a><span class="navbar__title">Scoring</span><span></span></div>
  ${s.league ? group('To score', [row('/app/score', 'ball', 'Games to score', s.games ? `${s.games} you can score` : 'None right now', s.games ? `<span class="count">${s.games}</span>` : '')]) : ''}
  ${s.league ? group('League games', [row('/app/practice', 'play', 'Practice game', 'Real teams, only on this phone'), row('/app/help/scoring', 'book', 'How to score', 'The guide, with pictures')]) : ''}
  ${s.pw ? group('Papawis', [row('/app/papawis/practice', 'play', 'Practice a run', 'A past run’s players, only on this phone'), row('/app/help/papawis', 'book', 'How to score Papawis', 'Light and Dark, switching sides, Finish the run')]) : ''}
  ${s.league ? group('Tools', [row('/app/table', 'tablet', 'Table display', 'Show the live score on a big screen', '', ' data-reload')]) : ''}
  ${s.admin ? group('Admin', [row('/app/admin/scorers', 'user', 'Scorers', `Who scores ${s.admin.games && s.admin.papawis ? 'games and Papawis' : s.admin.games ? 'the games' : 'Papawis'}`)]) : ''}
  ${s.pw && !s.league ? '<p class="foot-note">Scoring real runs is for Papawis scorers. Ask an admin if you’d like to be one.</p>' : ''}`;
}

// Me → Feed posts (admins): the site's Feed posts screen (views/feed-admin.js) in the app.
export function appFeedAdminPage({ body }) {
  return `<div class="navbar"><a class="navbar__back" href="/app/me">${backChev}Me</a><span class="navbar__title">Feed posts</span><span></span></div>
  <div class="fa-app">${body}</div>`;
}
