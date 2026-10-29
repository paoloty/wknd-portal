// A player's profile (/app/players/:id) and the Season screen (/app/season: standings, the
// bracket, every game). mockup claude.ai/artifact/3hM6uYrLqkXKNnweruMFx7 (2026-10-29). Read-only
// views of what the site's /players/:id, /standings and /playoffs show (server.js "Profiles and
// the Season screen"), so the app can't disagree with the site.
import { esc, appAvatar, chev, icons, backChev } from './layout.js';
import { AWARD_META } from '../player.js';

// back: { href, label } — the screen it came from; data-hist-back lets app.js go back in
// history when there is an app screen behind it (a face tapped in the chat goes back there).
const navbar = (back, title = '') => `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}" data-hist-back>${backChev}${esc(back.label)}</a><span class="navbar__title">${esc(title)}</span><span></span></div>`;
const resCell = g => `<span class="res ${g.won ? 'res--w' : 'res--l'}">${g.won ? 'W' : 'L'} ${g.my}–${g.oppScore}</span>`;

// A badge's medallion: its glyph (lib/badges.js BADGE_ICONS), ringed in its tier.
const medal = b => `<span class="pp-md${b.tier ? ` is-${esc(b.tier)}` : ''}" aria-hidden="true"><svg viewBox="0 0 24 24">${b.icon}</svg></span>`;

// p: { id, name, initials, ring, photoUrl, team, number, positions, writeup }
// cover: { img, srcset, own } | null (null: the team colour) · season: this season's number
// stats: { label, gp, tiles: [[value, label] x4], foot } | null · games: [{ date, opp, kind, won, my, oppScore, line, href }]
// badges: [{ name, tier: 'gold'|'silver'|'bronze'|'legendary'|'', meta, icon }] (this season, best first)
// career: [{ season, gp, ppg, rpg, apg, current }] · awards: [{ icon, label, season, top }] (top: the big
// ones, also chips under the name; plain surface, not medal gold: CLAUDE.md keeps that for podiums) ·
// papawis: runs played
// Scrolling (public/app.js initProfile): the cover drifts at half speed (parallax) and stretches on
// a pull down; once the name has gone under the nav, the sticky bar below it shows the photo and
// first name, then chips that jump to each section (the one in view lit).
export function appPlayerPage({ back, p, cover, season, stats, games, badges = [], career, awards, papawis }) {
  const first = p.name.split(' ')[0];
  const parts = [stats && ['pp-stats', 'Stats'], ['pp-games', 'Games'], badges.length && ['pp-badges', 'Badges'], career.length && ['pp-career', 'Career'], awards.length && ['pp-awards', 'Awards']].filter(Boolean);
  const shown = badges.slice(0, 8), more = badges.slice(8);
  const badgeTile = b => `<div class="pp-bdg">${medal(b)}<span>${esc(b.name)}<small>${esc([b.tier && b.tier !== 'legendary' ? b.tier.charAt(0).toUpperCase() + b.tier.slice(1) : '', b.meta].filter(Boolean).join(' · '))}</small></span></div>`;
  return `<div class="pp" data-pp>
  ${navbar(back).replace('class="navbar"', 'class="navbar pp-nav"')}
  <div class="pp-jump" data-pp-jump aria-hidden="true">
    <button type="button" class="pp-jump__who" data-pp-top aria-label="Back to the top">${appAvatar({ playerId: p.id, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}<b>${esc(first)}</b></button>
    <nav class="pp-jump__chips" aria-label="Sections">${parts.map(([id, label], i) => `<a href="#${id}" data-pp-go="${id}"${i ? '' : ' class="is-on"'}>${label}</a>`).join('')}</nav>
  </div>
  <div class="pp-cover" data-pp-cover style="--team:${esc(p.ring)}">${cover ? `<img src="${esc(cover.img)}" srcset="${esc(cover.srcset)}" sizes="(min-width: 560px) 560px, 100vw" alt="" decoding="async">` : ''}</div>
  <div class="pp-hero">
    ${appAvatar({ playerId: p.id, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl, size: 'xl' })}
    <h1 class="pp-hero__name" data-pp-name>${esc(p.name)}</h1>
    <div class="pp-hero__meta"><span class="dot" style="--c:${esc(p.ring)}"></span>${esc([p.team || 'No team', p.number !== '' ? `#${p.number}` : '', p.positions].filter(Boolean).join(' · '))}</div>
    ${awards.some(a => a.top) ? `<div class="pp-chips">${awards.filter(a => a.top).slice(0, 3).map(a => `<span class="pp-chip">${esc(a.icon)} ${esc(a.label)} S${esc(a.season)}</span>`).join('')}</div>` : ''}
    ${badges.length ? `<a class="pp-hero__bdg" href="#pp-badges" data-pp-go="pp-badges" aria-label="${badges.length} badge${badges.length === 1 ? '' : 's'} this season">${badges.slice(0, 5).map(medal).join('')}${badges.length > 5 ? `<em class="num">+${badges.length - 5}</em>` : ''}</a>` : ''}
  </div>
  ${stats ? `<div class="sec" id="pp-stats">${esc(stats.label)}</div>
  <div class="tiles" style="margin-top:0">${stats.tiles.map(([v, l]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
  ${stats.foot ? `<p class="foot-note">${esc(stats.foot)}</p>` : ''}` : ''}
  <div class="sec" id="pp-games">Last games</div>
  ${games.length ? `<div class="group">${games.map(g => `
    <a class="cell" href="${esc(g.href)}"><span class="date">${esc(g.date)}</span><span class="cell__t">vs ${esc(g.opp)}${g.kind ? `<small>${esc(g.kind)}</small>` : ''}</span>
      ${resCell(g)}<span class="line">${esc(g.line)}</span>${chev}</a>`).join('')}</div>
  <p class="foot-note">Points · rebounds · assists</p>` : '<div class="empty">No games played yet.</div>'}
  ${badges.length ? `<div class="sec" id="pp-badges">Badges · Season ${esc(season)} · ${badges.length}</div>
  <div class="pp-bdgs">${shown.map(badgeTile).join('')}</div>
  ${more.length ? `<details class="pp-more"><summary>See all ${badges.length}</summary><div class="pp-bdgs">${more.map(badgeTile).join('')}</div></details>` : ''}` : ''}
  ${career.length ? `<div class="sec" id="pp-career">Career · regular season</div>
  <div class="group"><table class="pp-tbl">
    <thead><tr><th>Season</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
    <tbody>${career.map(c => `<tr${c.current ? ' class="is-cur"' : ''}><td>Season ${esc(c.season)}</td><td class="num">${c.gp}</td><td class="num">${c.ppg}</td><td class="num">${c.rpg}</td><td class="num">${c.apg}</td></tr>`).join('')}</tbody>
  </table></div>` : ''}
  ${awards.length ? `<div class="sec" id="pp-awards">Awards</div>
  <div class="group group--icons">${awards.map(a => `<div class="cell"><span class="ico">${esc(a.icon)}</span><span class="cell__t">${esc(a.label)}<small>Season ${esc(a.season)}</small></span></div>`).join('')}</div>` : ''}
  ${p.writeup ? `<div class="sec">About</div><div class="card pp-about">${esc(p.writeup).replace(/\n+/g, '<br>')}</div>` : ''}
  ${papawis ? `<div class="sec">Papawis</div><div class="group"><div class="cell"><span class="ico">${icons.ball}</span><span class="cell__t">${papawis} run${papawis === 1 ? '' : 's'} played</span></div></div>` : ''}
  <div style="height:12px"></div>
  </div>`;
}

export function appPlayerMissing(back) {
  return `${navbar(back)}<div class="empty">That player isn't here any more.</div>`;
}

// ── The Season screen: Standings · Bracket · Games (one screen, three tabs as links) ──
const TABS = [['standings', 'Standings', '/app/season'], ['bracket', 'Bracket', '/app/season/bracket'], ['games', 'Games', '/app/season/games']];
const seg = tab => `<nav class="seg ss-seg" aria-label="Season">${TABS.map(([k, label, href]) => `<a class="seg__b${k === tab ? ' is-on' : ''}" href="${href}"${k === tab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
const marked = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const dotOf = c => `<span class="dot" style="--c:${esc(c)}"></span>`;

// standings: [{ seed, name, color, wl, diff, last5: 'WLWWL', tag, mine }] · read: { headline, body } | null
function standingsTab({ standings, read, label }) {
  if (!standings.length) return '<div class="empty">The table fills in after the first game.</div>';
  return `<div class="sec">${esc(label)}</div>
  <div class="group"><table class="ss-tbl">
    <thead><tr><th></th><th class="l">Team</th><th>W–L</th><th>Diff</th><th>Last 5</th></tr></thead>
    <tbody>${standings.map(r => `<tr${r.mine ? ' class="is-mine"' : ''}>
      <td class="ss-seed num">${r.seed || ''}</td>
      <td class="l"><span class="ss-team">${dotOf(r.color)}${esc(r.name)}${r.tag ? ` <span class="ss-tag${r.tag === 'OUT' ? '' : ' is-in'}">${esc(r.tag)}</span>` : ''}</span></td>
      <td class="num">${esc(r.wl)}</td><td class="num ${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${r.diff > 0 ? '+' : r.diff < 0 ? '−' : ''}${Math.abs(r.diff)}</td>
      <td><span class="ss-form" aria-label="Last five: ${esc(r.last5.split('').join(' '))}">${r.last5.split('').map(x => `<i class="${x === 'W' ? 'w' : 'l'}"></i>`).join('')}</span></td></tr>`).join('')}</tbody>
  </table></div>
  <p class="foot-note">Regular season. Ties: head-to-head first, then points quotient.</p>
  ${read ? `<div class="sec">Playoff picture</div><div class="card ss-read"><b class="ss-read__h">${marked(read.headline)}</b>${read.body ? `<p>${marked(read.body)}</p>` : ''}</div>` : ''}`;
}

// series: [{ title, sub, rows: [{ seed, name, color, wins, need, out, tbd }], games: [{ label, text, href, pick }], status, live, done }]
function bracketTab({ series, champ }) {
  if (!series.length) return '<div class="empty">The bracket shows up once the regular season is done.</div>';
  return `${champ ? `<div class="card glow ss-champ"><span class="kick">Champions</span><b>${dotOf(champ.color)}${esc(champ.name)}</b></div>` : ''}
  ${series.map(s => `<div class="sec">${esc(s.title)}<span class="sec__r">${esc(s.sub)}</span></div>
  <div class="group ss-series${s.live ? ' is-live' : ''}">
    ${s.rows.map(r => r.tbd ? `<div class="ss-row is-tbd"><span class="ss-seed num"></span><span class="ss-row__n">${esc(r.name)}</span></div>`
      : `<div class="ss-row${r.out ? ' is-out' : ''}"><span class="ss-seed num">${r.seed || ''}</span>${dotOf(r.color)}<span class="ss-row__n">${esc(r.name)}</span><span class="ss-pips" aria-label="${r.wins} of ${r.need} wins">${Array.from({ length: r.need }, (_, i) => `<i${i < r.wins ? ' class="on"' : ''}></i>`).join('')}</span></div>`).join('')}
    ${s.games.map(g => g.href ? `<a class="ss-g" href="${esc(g.href)}"><span class="ss-g__l num">${esc(g.label)}</span><span class="ss-g__t">${esc(g.text)}</span>${g.pick ? '<span class="pill">Pick</span>' : chev}</a>`
      : `<div class="ss-g"><span class="ss-g__l num">${esc(g.label)}</span><span class="ss-g__t muted">${esc(g.text)}</span></div>`).join('')}
    ${s.status ? `<div class="ss-foot">${marked(s.status)}${s.done ? '<span class="pill pill--ok">Done</span>' : ''}</div>` : ''}
  </div>`).join('')}
  <p class="foot-note">Semifinals: the higher seed needs one win, the lower seed two. Finals: best of 3.</p>`;
}

// days: [{ head, date, games: [{ a: { name, color, score, won }, b, side, sideSub, href, next, pick }] }]
function gamesTab({ days, mineOnly, myTeam }) {
  const chips = myTeam ? `<div class="ss-chips"><a class="ss-chip${mineOnly ? '' : ' is-on'}" href="/app/season/games">All games</a><a class="ss-chip${mineOnly ? ' is-on' : ''}" href="/app/season/games?team=mine">${dotOf(myTeam.color)}${esc(myTeam.name)} only</a></div>` : '';
  if (!days.length) return `${chips}<div class="empty">No games yet this season.</div>`;
  const side = (t, played) => `<span class="ss-gt${played && !t.won ? ' is-lost' : ''}">${dotOf(t.color)}<span>${esc(t.name)}</span><b class="num">${t.score ?? ''}</b></span>`;
  return `${chips}${days.map(d => `<div class="sec">${esc(d.head)}<span class="sec__r">${esc(d.date)}</span></div>
  <div class="group">${d.games.map(g => {
    const inner = `<span class="ss-gm__teams">${side(g.a, g.played)}${side(g.b, g.played)}${g.potg ? `<small class="ss-gm__potg"><b>POTG</b>${esc(g.potg)}</small>` : ''}</span><span class="ss-gm__side"><b${g.next ? ' class="up"' : ''}>${esc(g.side)}</b>${g.pick ? '<span class="pill">Pick</span>' : g.sideSub ? `<small>${esc(g.sideSub)}</small>` : ''}</span>`;
    return g.href ? `<a class="ss-gm" href="${esc(g.href)}">${inner}</a>` : `<div class="ss-gm">${inner}</div>`;
  }).join('')}</div>`).join('')}`;
}

// tab: 'standings' | 'bracket' | 'games' · back: { href, label }
export function appSeasonPage({ tab, back, season, standings, read, label, series, champ, days, mineOnly, myTeam }) {
  const body = tab === 'bracket' ? bracketTab({ series, champ }) : tab === 'games' ? gamesTab({ days, mineOnly, myTeam }) : standingsTab({ standings, read, label });
  return `${navbar(back, `Season ${season}`)}${seg(tab)}${body}<div style="height:12px"></div>`;
}
