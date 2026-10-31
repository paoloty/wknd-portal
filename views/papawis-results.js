// A scored Papawis run's results (2026-10-30): the games, the Player of the Day's card, the top 3
// as cards, then the box score (the whole day, then each game), every row opening that player's
// card. One body for the app's run screen (views/app/papawis.js) and the site's
// /papawis/:id/results (papawisResultsPage). Data: server.js pwResultsFor.
import { escHtml as esc } from './layout.js';
import { topThreeCards, playerCardTemplates } from './player-cards.js';
import { summaryPanel } from './home.js';
import { shareStatsModal } from './game.js';

const SIDE = { light: 'Light', dark: 'Dark' };
const RING = { light: 'var(--team-white, #d7dce5)', dark: 'var(--team-black, #6b7486)' };
const fg = (L, ks) => { const m = ks.reduce((n, k) => n + (L[`${k}`] || 0), 0); return m; };
const fgLine = L => { const m = fg(L, ['fg2m', 'fg3m', 'fg4m']), a = m + fg(L, ['fg2m_miss', 'fg3m_miss', 'fg4m_miss']); return `${m}-${a}`; };

// results: { games: [{ n, a, b, stats, periodMin, periods }], people: [{ key, playerId, name,
// number, side, line, games: { n: row }, rating, photo, ini }] (Player of the Day first), potd,
// full, potdCount }
export function papawisResultsBody(results, { profileHref = id => `/players/${encodeURIComponent(id)}` } = {}) {
  const { games, people, potd, full, absent = [] } = results;
  const statsOf = L => [['PTS', L.pts || 0], ['REB', L.reb || 0], ['AST', L.ast || 0], ...(full ? [['STL', L.stl || 0]] : [])];
  const card = p => ({
    key: p.key, name: p.name, first: p.first, last: p.last, number: p.number, photo: p.photo, ini: p.ini, ring: RING[p.side], team: SIDE[p.side] || '',
    note: p.key === potd?.key ? 'Player of the Day' : '',
    stats: statsOf(p.line),
    lines: games.filter(g => p.games[g.n]).map(g => { const r = p.games[g.n]; return [`Game ${g.n} · ${SIDE[r.side]}`, `${r.pts} PTS · ${r.reb} REB · ${r.ast} AST`]; }),
    href: p.playerId ? profileHref(p.playerId) : '',
  });
  const cards = people.map(card);
  const result = g => {
    const win = g.a === g.b ? '' : g.a > g.b ? 'light' : 'dark';
    return `<div class="pwx-res"><span class="pwx-res__n">Game ${g.n}</span>
      <span class="pwx-res__s"><span class="pw-shirt pw-shirt--light" aria-hidden="true"></span>Light <b class="num${win === 'dark' ? ' is-dim' : ''}">${g.a}</b><span aria-hidden="true">–</span><b class="num${win === 'light' ? ' is-dim' : ''}">${g.b}</b> Dark <span class="pw-shirt pw-shirt--dark" aria-hidden="true"></span></span>
      <small>${g.stats === 'full' ? 'Full stats' : 'Basic stats'} · ${g.periods} × ${g.periodMin} min</small></div>`;
  };
  const cols = full ? ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG'] : ['PTS', 'REB', 'AST'];
  const cells = L => [L.pts || 0, L.reb || 0, L.ast || 0, ...(full ? [L.stl || 0, L.blk || 0, fgLine(L)] : [])];
  const table = (title, rows) => `<div class="pwx-box"><div class="pwx-box__h">${title}</div>
    <div class="table-scroll"><table class="pwx-tbl"><thead><tr><th scope="col">Player</th>${cols.map(c => `<th scope="col" class="num">${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr data-pcard="${esc(r.key)}" tabindex="0"${r.key === potd?.key ? ' class="is-potd"' : ''}><th scope="row"><span class="pwx-who">${r.number ? `<i class="num">${esc(r.number)}</i>` : ''}${esc(r.name)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span></th>${cells(r.L).map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  // The whole day, each player under the side he finished on.
  const day = ['light', 'dark'].map(s => {
    const rows = people.filter(p => p.side === s).sort((x, y) => (y.line.pts || 0) - (x.line.pts || 0)).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.line, note: Object.values(p.games).some(r => r.side !== s) ? `also played ${s === 'light' ? 'Dark' : 'Light'}` : p.n < games.length ? `${p.n} of ${games.length} games` : '' }));
    return rows.length ? table(`<span class="pw-shirt pw-shirt--${s}" aria-hidden="true"></span>${SIDE[s]} · whole day`, rows) : '';
  }).join('');
  const perGame = games.map(g => ['light', 'dark'].map(s => {
    const rows = people.filter(p => p.games[g.n] && p.games[g.n].side === s).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.games[g.n] })).sort((x, y) => (y.L.pts || 0) - (x.L.pts || 0));
    return rows.length ? table(`Game ${g.n} · ${SIDE[s]} <b class="num">${s === 'light' ? g.a : g.b}</b>`, rows) : '';
  }).join('')).join('');
  return `<div class="pwx">
    <div class="pwx-games">${games.map(result).join('')}</div>
    ${topThreeCards(cards, { firstLabel: 'Player of the Day', label: 'Player of the Day · top 3' })}
    ${day}
    ${absent.length ? `<div class="pwx-box"><div class="pwx-box__h">Didn’t play</div>
      <div class="table-scroll"><table class="pwx-tbl"><thead><tr><th scope="col">Player</th><th scope="col">Status</th></tr></thead>
      <tbody>${absent.map(a => `<tr><th scope="row"><span class="pwx-who">${esc(a.name)}${a.side ? `<small>${SIDE[a.side]}</small>` : ''}</span></th><td>${a.mark === 'noshow' ? 'No-show' : 'DNP'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <details class="pwx-more"><summary>Each game</summary>${perGame}</details>
    <p class="pwx-note">Papawis stats count in Papawis careers and leaders, separate from league totals.${full ? '' : ' Basic stats: points, rebounds and assists.'}</p>
    ${playerCardTemplates(cards)}
  </div>`;
}

// The site's page for a scored run.
// summary: the run's AI recap (server.js pwRunSummaryStart) or null
// share: { game, stat, locked } for a signed-in player with a line (server.js pwShareFacts): the
// game page's Share my stats editor, on the run
export function papawisResultsPage({ run, results, summary = null, share = null }) {
  return `<div class="container"><div class="page-content">
    <div class="section-header"><h2>${esc(run.title)} · results</h2><a href="/papawis">All runs</a></div>
    <p class="pwx-sub">${esc([run.day, run.place].filter(Boolean).join(' · '))}</p>
    ${summary ? summaryPanel(summary, 'papawis-run', false) : ''}
    ${share ? `<p class="pwx-share"><button type="button" class="gd-btn gd-btn--amber" data-ssc-open>Share my stats</button></p>${shareStatsModal(share.game, share.stat, share.locked)}` : ''}
    ${papawisResultsBody(results)}
  </div></div>`;
}
