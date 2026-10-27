// The scorer (replaces wknd-stats live tracking). The page is a shell: the game, both rosters,
// the rules and every play so far ride in the HTML (one request), and public/scorer.js draws the
// screen, keeps every tap on the phone first (IndexedDB) and sends them in batches. The same
// page serves the app (/app/score/:id) and the site's admin (/admin/games/:id/score).
// Rules and maths: public/score-engine.js (shared with the server's publish).
import { esc, backChev, chev } from './layout.js';

// The games this player (or admin) can score. games: [{ id, title, when, status, href }]
export function appScorerListPage({ games, back }) {
  const rows = games.length
    ? `<div class="group">${games.map(g => g.full
      // Two scorers already in (the most a game takes): shown, not tappable.
      ? `<div class="cell cell--off" aria-disabled="true"><span class="cell__t">${esc(g.title)}<small>${esc(g.when)} · 2 scorers already in: ${esc(g.full.join(' and '))}</small></span></div>`
      : `<a class="cell" href="${esc(g.href)}"><span class="cell__t">${esc(g.title)}<small>${esc(g.when)}${g.status === 'live' ? ' · scoring now' : ''}</small></span>${chev}</a>`).join('')}</div>`
    : '<div class="empty">No games to score. When an admin picks you to score a game, it shows up here.</div>';
  // One title: the bar's (a large title under it said the same thing twice; audit 2026-10-27).
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Games to score</span><span></span></div>
  ${rows}`;
}

// bundle: server.js scoreBundle(). back: { href, label }. readOnly: published (nothing to add).
export function appScorerPage({ bundle, back }) {
  // </script> can't appear inside the JSON (player names are escaped by JSON already, but
  // a "<" is turned into its unicode form to be safe).
  const json = JSON.stringify(bundle).replace(/</g, '\\u003c');
  const video = bundle.pass === 'video';
  // A practice game: a slim amber strip across the top that never goes away (Paolo, 2026-10-27).
  const prac = bundle.practice ? `<div class="sc-prac" role="note"><b class="num">PRACTICE</b><span>· only on this phone</span><button type="button" data-prac-reset>Reset</button></div>` : '';
  return `<div class="sc${video ? ' sc--video' : ''}${prac ? ' sc--practice' : ''}" data-scorer data-game="${esc(bundle.game.id)}" data-api="/api/score/${esc(encodeURIComponent(bundle.game.id))}/events${video ? '?pass=video' : ''}">
    ${prac}<div class="navbar sc-nav"><a class="navbar__back" href="${esc(back.href)}" data-sc-leave>${backChev}${esc(back.label)}</a><span class="navbar__title">${video ? 'Video re-track · ' : ''}${esc(bundle.a.name)} vs ${esc(bundle.b.name)}</span><span class="sc-sync" data-sc-sync role="status">Loading…</span></div>
    <div class="sc-body" data-sc-root><div class="sc-loading" role="status"><span class="ptr__spin" aria-hidden="true"></span>Loading the scorer…</div></div>
    <script type="application/json" data-sc-bundle>${json}</script>
  </div>`;
}
