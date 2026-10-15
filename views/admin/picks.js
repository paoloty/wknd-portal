// /admin/picks: every "Who wins?" pick in one place (admin redesign, 2026-10-15; built on the
// shared components, no page mockup). Data from server.js (GET /admin/picks).
//   Up next     the next game day's games: odds vs fans, the pick window and hide-odds
//               (same POST /admin/games/:id/picks the game page uses), who picked which side
//   Not picked  who hasn't picked yet, a checklist of who to remind, bell and/or email
//               (POST /admin/picks/remind), Preview email
//   Results     the season's finished games: odds had, how the fans did, who called it
//   Pickers     the Pickmaster race on the shared data grid
//   Settings    the picks switches (POST /admin/site/settings)
// Browser side (checklist counts, copy names, pick window): public/admin-picks.js.
import { escHtml } from '../layout.js';
import { fmtPts } from '../../lib/picks.js';
import { pageHeader, pageTabs, statStrip, section, badge, button, banner, dataGrid, segmented, toggleRow, emptyState, avatar, field } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const tc = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
const day = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const shortDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const when = ms => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// A row of faces (photo, else initials in the team ring), "+N" past max.
function faces(list, colorById, max = 8) {
  if (!list.length) return '<span class="aui-muted">Nobody</span>';
  return `<span class="apk-faces">${list.slice(0, max).map(p => `<a class="apk-face" href="/admin/players/${attr(p.id)}" title="${attr(p.name)}">${avatar(p.name, colorById[p.id] || '', { size: 26, playerId: p.id })}</a>`).join('')}${list.length > max ? `<span class="apk-more">+${list.length - max}</span>` : ''}</span>`;
}

function bar(pctA, colA, colB) {
  return `<span class="apk-bar" aria-hidden="true"><span style="width:${pctA}%;background:${attr(colA)}"></span><span style="width:${100 - pctA}%;background:${attr(colB)}"></span></span>`;
}

function upNextCard(u, colorOf, colorById) {
  const total = u.counts.a + u.counts.b;
  const fanA = total ? Math.round((u.counts.a / total) * 100) : 50;
  const o = u.odds;
  const fanFav = total && u.counts.a !== u.counts.b ? (u.counts.a > u.counts.b ? 'a' : 'b') : null;
  const disagree = o?.fav && fanFav && o.fav !== fanFav;
  const side = s => {
    const list = u.picks.filter(p => p.side === s);
    const team = s === 'a' ? u.a : u.b;
    const against = list.filter(p => p.ownTeamAgainst).length;
    return `<div class="apk-side"><div class="apk-side__head"><span class="apk-team"><i class="agl-dot" style="background:${attr(colorOf(team))}"></i>${escHtml(team)}</span><b>${list.length}</b></div>
      ${faces(list, colorById, 10)}
      ${against ? `<span class="aui-muted apk-note">${plural(against, 'player')} picked against their own team</span>` : ''}</div>`;
  };
  return `<article class="aui-panel apk-game">
    <header class="apk-game__head">
      <a class="apk-match" href="/admin/games/${attr(u.id)}?tab=picks"><span class="apk-team"><i class="agl-dot" style="background:${attr(colorOf(u.a))}"></i>${escHtml(u.a)}</span><span class="aui-muted">vs</span><span class="apk-team"><i class="agl-dot" style="background:${attr(colorOf(u.b))}"></i>${escHtml(u.b)}</span></a>
      ${u.closed ? badge('Closed', 'amber') : badge('Open', 'green')}
    </header>
    <div class="apk-lines">
      ${o ? `<div class="apk-line"><span>Odds${u.hideOdds ? ' <span class="aui-muted">(hidden on the site)</span>' : ''}</span><b>${escHtml(tc(u.a))} ${o.pctA}% · ${o.pctB}% ${escHtml(tc(u.b))}</b></div>${bar(o.pctA, colorOf(u.a), colorOf(u.b))}` : '<div class="apk-line"><span>Odds</span><span class="aui-muted">None yet (a team has no games this season)</span></div>'}
      <div class="apk-line"><span>Fans · ${total}</span><b>${escHtml(tc(u.a))} ${fanA}% · ${100 - fanA}% ${escHtml(tc(u.b))}</b></div>${bar(fanA, colorOf(u.a), colorOf(u.b))}
      ${disagree ? `<p class="apk-disagree">Fans lean ${escHtml(tc(fanFav === 'a' ? u.a : u.b))}, the odds like ${escHtml(tc(o.fav === 'a' ? u.a : u.b))}.</p>` : ''}
    </div>
    <div class="apk-ctl">
      <div data-pick-window="/admin/games/${attr(u.id)}/picks">${segmented({ name: `closed-${u.id}`, value: u.override, label: 'Pick window', options: [['auto', `Auto (${u.closeTime})`], ['closed', 'Closed'], ['open', 'Keep open']] })}</div>
      ${toggleRow({ label: 'Hide odds', name: 'hide_odds', on: u.hideOdds, post: `/admin/games/${u.id}/picks`, reload: true })}
    </div>
    <div class="apk-sides">${side('a')}${side('b')}</div>
  </article>`;
}

// Who hasn't picked: a checklist of who to remind (everyone reachable starts ticked), bell
// for all of them, email for the emailable ones when "Also email" is on.
function missingPanel(m) {
  if (!m) return '';
  if (!m.list.length) return banner('ok', 'Every player with an account has picked.');
  const tag = { email: '', bell: badge('Bell only', 'gray'), skip: badge('Can’t reach', 'red') };
  const notes = [
    m.noValidEmail ? `${m.noValidEmail} skipped: no valid email on their account` : '',
    m.dormant ? `${m.dormant} skipped: no login in 3+ months, or their setup link expired` : '',
    m.alreadyEmailed ? `${m.alreadyEmailed} already emailed for this game day, left off the list` : '',
    m.remindedAt ? `Reminder sent ${when(m.remindedAt)} to ${plural(m.remindedCount, 'player')}` : '',
    m.emailed ? `Email sent ${when(m.emailed.at)} to ${m.emailed.sent} of ${m.emailed.of}${m.emailed.failed ? `, ${m.emailed.failed} failed` : ''} · ${m.emailed.source === 'ai' ? 'AI copy' : 'template copy'}` : '',
  ].filter(Boolean);
  const people = m.people || [];
  return `<form class="aui-panel apk-remind" id="picks-remind" method="post" action="/admin/picks/remind"
      data-confirm data-confirm-title="Send the pick reminder?" data-confirm-body="" data-confirm-send="Send reminder" data-reminded="${m.remindedAt ? 1 : ''}">
    <div class="apk-remind__head">
      <span class="aui-cell__stack"><span class="aui-cell__title">${m.list.length} of ${m.accounts} players with an account haven’t picked ${m.games > 1 ? 'every game' : 'yet'}</span>
        <span class="aui-cell__sub"><span data-sel-count>${people.filter(p => p.reach !== 'skip').length}</span> ticked to remind</span></span>
      <span class="aui-row">
        ${button('Copy names', { kind: 'ghost', size: 'sm', attrs: `data-copy-names="${attr(m.list.map(p => p.name).join(', '))}"` })}
        ${button('Preview email', { kind: 'secondary', size: 'sm', href: '/admin/picks/email/preview', attrs: 'target="_blank" rel="noopener"' })}
      </span>
    </div>
    <div class="aui-row apk-sel">
      <button type="button" class="aui-link" data-sel="all">All</button><button type="button" class="aui-link" data-sel="none">None</button><button type="button" class="aui-link" data-sel="email">Only emailable</button>
    </div>
    <div class="apk-people">${people.map(p => `<label class="apk-person${p.reach === 'skip' ? ' is-off' : ''}" title="${attr(p.note)}">
        <input type="checkbox" name="ids" value="${attr(p.id)}" data-reach="${p.reach}"${p.reach === 'skip' ? ' disabled' : ' checked'}>
        ${avatar(p.name, '', { size: 22, playerId: p.id })}<span class="apk-person__name">${escHtml(p.name)}</span>${tag[p.reach]}</label>`).join('')}</div>
    ${notes.length ? `<ul class="apk-notes">${notes.map(n => `<li>${escHtml(n)}</li>`).join('')}</ul>` : ''}
    <div class="apk-remind__foot">
      <label class="aui-check" title="Players who unsubscribed, reported spam or share an inbox get the bell only"><input type="checkbox" name="email" value="1"${m.emailable ? ' checked' : ' disabled'}><span>Also email <span data-email-count>${m.emailable}</span> of them</span></label>
      <button type="submit" class="aui-btn aui-btn--primary" data-remind-submit${m.reachable ? '' : ' disabled'}>${m.remindedAt ? 'Remind again' : 'Send reminder'}</button>
    </div>
  </form>`;
}

function resultsList(rows, oddsOn, colorOf, colorById) {
  if (!rows.length) return emptyState({ title: 'No finished games this season yet' });
  const yes = '<span class="apk-yes" aria-label="yes">✓</span>', no = '<span class="apk-no" aria-label="no">✕</span>';
  return `<div class="aui-panel aui-panel--flush apk-results">${rows.map(r => {
    const winner = r.winner === 'a' ? r.a : r.b, loser = r.winner === 'a' ? r.b : r.a;
    const ws = Math.max(r.sa, r.sb), ls = Math.min(r.sa, r.sb);
    const has = r.total > 0;
    const oddsCell = !oddsOn ? '' : r.odds?.fav ? `<span class="apk-res__odds">Odds: ${escHtml(tc(r.odds.fav === 'a' ? r.a : r.b))} ${r.odds.fav === 'a' ? r.odds.pctA : r.odds.pctB}% ${r.odds.fav === r.winner ? yes : no}</span>` : '<span class="apk-res__odds aui-muted">No odds</span>';
    const summary = `<span class="apk-res__date">${escHtml(shortDay(r.ymd))}</span>
      <span class="apk-res__final"><span class="apk-team"><i class="agl-dot" style="background:${attr(colorOf(winner))}"></i><b>${escHtml(tc(winner))} ${ws}</b></span><span class="aui-muted">– ${ls} ${escHtml(tc(loser))}</span>${r.upset ? badge('Upset', 'amber') : ''}</span>
      ${oddsCell}
      <span class="apk-res__fans">${has ? `${r.total} picks · fans ${r.pctWinner}% ${escHtml(tc(winner))} ${r.pctWinner === 50 ? '' : r.fansCalled ? yes : no}` : '<span class="aui-muted">No picks</span>'}</span>
      <span class="apk-res__sent">${has ? (r.settledAt ? badge('Results sent', 'green') : badge('Not sent yet', 'amber')) : ''}</span>`;
    if (!has) return `<div class="apk-res">${summary}</div>`;
    return `<details class="apk-res"><summary>${summary}<span class="apk-res__chev" aria-hidden="true">›</span></summary>
      <div class="apk-res__more">
        <span class="apk-res__grp"><span class="apk-kicker is-amber">Called it · ${r.called.length}</span>${faces(r.called, colorById)}</span>
        <span class="apk-res__grp"><span class="apk-kicker">Missed · ${r.missed.length}</span>${faces(r.missed, colorById)}</span>
        <a class="aui-link" href="/admin/games/${attr(r.id)}?tab=picks">Open game</a>
      </div></details>`;
  }).join('')}</div>`;
}

function pickersGrid(rows, { season, hasFinalsG1, query, colorById }) {
  return dataGrid({
    id: 'pickers', baseUrl: '/admin/picks', query, keep: { season },
    rows, rowKey: r => r.id, noun: ['picker', 'pickers'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'board', label: 'On the board', test: r => !!r.rank },
      { key: 'missing', label: 'No pick this week', test: r => r.missingNext },
    ],
    search: { placeholder: 'Search players', text: r => `${r.name} ${r.team}` },
    defaultSort: 'rank', perPage: 50,
    columns: [
      { key: 'rank', label: '#', num: true, sort: r => r.rank ?? 1e9, cell: r => (r.rank ? `<b class="${r.rank === 1 ? 'apk-first' : ''}">${r.rank}</b>` : '<span class="aui-muted">—</span>') },
      { key: 'name', label: 'Player', primary: true, sort: r => r.name.toLowerCase(), cell: r => `<span class="aui-who">${avatar(r.name, colorById[r.id] || '', { playerId: r.id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span><span class="aui-cell__sub">${escHtml(r.team || 'No team')}</span></span></span>` },
      { key: 'picks', label: 'Picks', num: true, sort: r => r.picks, cell: r => String(r.picks) },
      { key: 'correct', label: 'Called', num: true, sort: r => r.correct, cell: r => String(r.correct) },
      { key: 'net', label: 'Pts', num: true, sort: r => (r.settled ? r.net : -1e9), cell: r => (r.settled ? escHtml(fmtPts(r.net)) : '<span class="aui-muted">—</span>') },
      { key: 'odds', label: 'Odds pts', num: true, phone: false, sort: r => r.oddsPts, cell: r => (r.settled ? r.oddsPts.toFixed(2) : '<span class="aui-muted">—</span>') },
      { key: 'streak', label: 'Streak', num: true, phone: false, sort: r => r.streak, cell: r => (r.streak >= 2 ? `<span class="apk-streak">${r.streak}</span>` : '<span class="aui-muted">—</span>') },
      { key: 'upsets', label: 'Upsets', num: true, phone: false, sort: r => r.upsets, cell: r => String(r.upsets || 0) },
      ...(hasFinalsG1 ? [{ key: 'margin', label: 'Finals guess', num: true, phone: false, sort: r => r.marginGuess ?? -1, cell: r => (r.marginGuess != null ? `by ${r.marginGuess}` : '<span class="aui-muted">—</span>') }] : []),
      { key: 'last', label: 'Last pick', nowrap: true, sort: r => r.last?.at || 0, cell: r => (r.last ? `${escHtml(shortDay(r.last.ymd))} · ${escHtml(tc(r.last.team))}${r.missingNext ? `<div class="aui-cell__sub apk-warn">No pick yet this week</div>` : ''}` : '') },
    ],
    rowHref: r => `/admin/players/${encodeURIComponent(r.id)}`,
    empty: { title: 'Nobody has picked this season yet' },
  });
}

function settingsBlock(s) {
  return `<div class="aui-panel">
    ${toggleRow({ label: 'Who wins? picks on the site', help: 'Fan picks on /picks, the matchup cards, the homepage widget, profiles and the after-game notifications.', name: 'picks_enabled', on: s.picksOn, post: '/admin/site/settings', setting: true, reload: true })}
    ${toggleRow({ label: 'Show odds', help: 'Win chances on the matchup cards. Hidden until both teams have played this season; can also be hidden per game.', name: 'picks_odds_enabled', on: s.oddsOn, post: '/admin/site/settings', setting: true, reload: true })}
    ${toggleRow({ label: 'Homepage widget', help: 'The pick widget under the homepage banner: the next game day, or “Who called it?” on game day and the day after.', name: 'home_picks_widget_enabled', on: s.homeWidget, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Automatic pick reminder', help: 'At 6 PM the day before game day, everyone still missing picks gets a bell and the reminder email, unless you already sent one. Live site only.', name: 'picks_auto_remind', on: s.autoRemind, post: '/admin/site/settings', setting: true })}
    <form class="apk-close" data-json-action="/admin/site/settings" data-done="Cut-off saved.">
      <span class="aui-cell__stack"><span class="aui-cell__title">Picks close at</span><span class="aui-cell__sub">Game-day cut-off, Manila time. Games have no tip-off time, so picks lock at this time on the game date.</span></span>
      <span class="aui-row">${field({ label: 'Time', name: 'picks_close_time', type: 'time', value: s.closeTime, required: true })}${button('Save', { kind: 'secondary', size: 'sm', type: 'submit' })}</span>
    </form>
  </div>`;
}

export function adminPicksBody({ season, seasons, isCurrent, kpi, upNext, upDay, missing, results, pickers, hasFinalsG1 = false, oddsOn, picksOn, msg = '', query = {}, teams = [], colorById = {}, settings = {} }) {
  const colorByName = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), t.color || '']));
  const colorOf = name => colorByName[String(name || '').toUpperCase()] || '';
  const rec = r => (r.of ? `${r.called} of ${r.of}` : '—');
  const strip = statStrip([
    { label: `Picks · ${plural(kpi.pickers, 'picker')}`, value: String(kpi.picks) },
    { label: `Reach · of ${kpi.accounts} with an account`, value: kpi.accounts ? `${Math.round((kpi.pickers / kpi.accounts) * 100)}%` : '—' },
    { label: 'Fans called · majority won', value: rec(kpi.callers.fans) },
    ...(kpi.oddsOn ? [{ label: `Odds called · ${plural(kpi.upsets, 'upset')}`, value: rec(kpi.oddsRecord) }] : []),
    { label: kpi.leader ? `Pickmaster · ${fmtPts(kpi.leader.net)} pts (${kpi.leader.correct}–${kpi.leader.wrong})` : 'Pickmaster', value: kpi.leader ? kpi.leader.name : '—' },
  ]);
  const seasonTabs = seasons.length > 1 ? pageTabs(seasons.map(s => ({ label: `Season ${s}`, href: `/admin/picks?season=${encodeURIComponent(s)}`, active: s === season }))) : '';
  const upNextHtml = !isCurrent ? '' : section({
    title: 'Up next', note: upDay ? `· ${day(upDay)}` : '',
    bodyHtml: upNext.length
      ? `<div class="apk-games">${upNext.map(u => upNextCard(u, colorOf, colorById)).join('')}</div>${missingPanel(missing)}`
      : emptyState({ title: 'No games in the next two weeks', sub: 'Picks open as soon as a game is scheduled.' }),
  });
  return `<div class="aui-page" id="apk">
    ${pageHeader({
      eyebrow: 'Game Day', title: 'Who wins? picks',
      sub: 'Open and close picks, see who picked what, nudge players who haven’t picked, and follow the Pickmaster race.',
      actionsHtml: `${button('Pickmaster award', { kind: 'secondary', href: '/admin/awards/season#pickmaster' })}${button('View /picks ↗', { kind: 'secondary', href: '/picks', attrs: 'target="_blank" rel="noopener"' })}`,
    })}
    ${picksOn ? '' : banner('warn', 'Picks are switched off on the site. Turn them on under Settings below.')}
    ${msg ? banner('ok', msg) : ''}
    ${seasonTabs}
    ${strip}
    ${upNextHtml}
    ${section({ title: `Season ${season} results`, note: '· open a game for who called it', bodyHtml: resultsList(results, oddsOn, colorOf, colorById) })}
    ${section({ title: `Pickers · Season ${season}`, bodyHtml: pickersGrid(pickers, { season, hasFinalsG1, query, colorById }) })}
    ${section({ title: 'Settings', bodyHtml: settingsBlock({ ...settings, picksOn, oddsOn }) })}
  </div>
  <script src="/admin-picks.js" defer></script>`;
}
