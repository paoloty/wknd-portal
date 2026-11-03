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
// site: { recap, share } lays it out like a game page (the site's results page, below).
export function papawisResultsBody(results, { profileHref = id => `/players/${encodeURIComponent(id)}`, site = null } = {}) {
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
  // out: no-shows and DNPs on this side, at the bottom with their mark in place of a line.
  const outRow = a => `<tr class="is-out"><th scope="row"><span class="pwx-pname">${esc(a.name)}</span></th><td colspan="${cols.length}" class="pwx-out">${a.mark === 'noshow' ? 'No-show' : 'DNP'}</td></tr>`;
  const table = (title, rows, out = []) => `<div class="pwx-box"><div class="pwx-box__h">${title}</div>
    <div class="table-scroll"><table class="pwx-tbl"><thead><tr><th scope="col">Player</th>${cols.map(c => `<th scope="col" class="num">${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr data-pcard="${esc(r.key)}" tabindex="0"${r.key === potd?.key ? ' class="is-potd"' : ''}><th scope="row"><span class="pwx-pname">${r.number ? `<i class="num">${esc(r.number)}</i>` : ''}${esc(r.name)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span></th>${cells(r.L).map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}${out.map(outRow).join('')}</tbody></table></div></div>`;
  // The whole day, each player under the side he finished on.
  const day = ['light', 'dark'].map(s => {
    const rows = people.filter(p => p.side === s).sort((x, y) => (y.line.pts || 0) - (x.line.pts || 0)).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.line, note: Object.values(p.games).some(r => r.side !== s) ? `also played ${s === 'light' ? 'Dark' : 'Light'}` : p.n < games.length ? `${p.n} of ${games.length} games` : '' }));
    const out = absent.filter(a => a.side === s);
    return rows.length || out.length ? table(`<span class="pw-shirt pw-shirt--${s}" aria-hidden="true"></span>${SIDE[s]} · whole day`, rows, out) : '';
  }).join('');
  // Marked players with no side: their own short table.
  const noSide = absent.filter(a => a.side !== 'light' && a.side !== 'dark');
  const perGame = games.map(g => ['light', 'dark'].map(s => {
    const rows = people.filter(p => p.games[g.n] && p.games[g.n].side === s).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.games[g.n] })).sort((x, y) => (y.L.pts || 0) - (x.L.pts || 0));
    return rows.length ? table(`Game ${g.n} · ${SIDE[s]} <b class="num">${s === 'light' ? g.a : g.b}</b>`, rows) : '';
  }).join('')).join('');
  // The site: the game page's layout (Paolo, 2026-11-03). Main column with the box score in the
  // game page's table and team switch, the games and Share my stats in the sticky rail.
  if (site) {
    const pct = (m, x) => (m + x ? `${Math.round((m / (m + x)) * 100)}%` : '–');
    const shot = (m, x) => (m + x ? [m, m + x, pct(m, x)] : ['–', '–', '–']);
    const sum = (L, ks) => ks.reduce((n, k) => n + (L[k] || 0), 0);
    const SHOTS = [['FIELD GOALS', ['fg2m', 'fg3m', 'fg4m'], ['fg2m_miss', 'fg3m_miss', 'fg4m_miss']], ['3-POINTERS', ['fg3m'], ['fg3m_miss']], ['4-POINTERS', ['fg4m'], ['fg4m_miss']], ['FREE THROWS', ['ftm'], ['ft_miss']]];
    const shotCells = L => SHOTS.flatMap(([, m, x]) => shot(sum(L, m), sum(L, x))).map((v, i) => `<td class="bs-stat${i % 3 === 2 ? ' bs-pct' : ''}">${v}</td>`).join('');
    const totals = rows => rows.reduce((t, r) => { for (const [k, v] of Object.entries(r.L)) if (typeof v === 'number') t[k] = (t[k] || 0) + v; return t; }, {});
    const numCells = L => `${full ? shotCells(L) : ''}<td class="bs-stat">${L.reb || 0}</td><td class="bs-stat">${L.ast || 0}</td>${full ? `<td class="bs-stat">${L.stl || 0}</td><td class="bs-stat">${L.blk || 0}</td><td class="bs-stat">${L.turnover || 0}</td>` : ''}<td class="bs-stat bs-pts">${L.pts || 0}</td>`;
    const span = full ? 18 : 3;
    const head = full
      ? `<tr><th class="bs-name" rowspan="2">PLAYER</th>${SHOTS.map(s => `<th colspan="3" class="bs-group">${s[0]}</th>`).join('')}${['REB', 'AST', 'STL', 'BLK', 'TO'].map(c => `<th class="bs-stat" rowspan="2">${c}</th>`).join('')}<th class="bs-stat bs-pts" rowspan="2">PTS</th></tr>
         <tr class="bs-subhead">${'<th class="bs-stat">M</th><th class="bs-stat">A</th><th class="bs-stat bs-pct">%</th>'.repeat(4)}</tr>`
      : '<tr><th class="bs-name">PLAYER</th><th class="bs-stat">REB</th><th class="bs-stat">AST</th><th class="bs-stat bs-pts">PTS</th></tr>';
    const box = (rows, out = []) => `<div class="bs-block"><div class="bs-scroll"><table class="bs-table${full ? '' : ' pwr-basic'}"><thead>${head}</thead><tbody>
      ${rows.map(r => `<tr data-pcard="${esc(r.key)}" tabindex="0"${r.key === potd?.key ? ' class="is-potd"' : ''}><td class="bs-name">${r.number ? `<i class="pwr-no num">${esc(r.number)}</i>` : ''}${esc(r.name)}${r.note ? `<small class="pwr-also">${esc(r.note)}</small>` : ''}</td>${numCells(r.L)}</tr>`).join('')}
      ${out.map(a => `<tr class="bs-dnp"><td class="bs-dnp__cell" colspan="${span + 1}">${esc(a.name)} <span class="dnp-pill">${a.mark === 'noshow' ? 'No-show' : 'DNP'}</span></td></tr>`).join('')}
      ${rows.length ? `<tr class="bs-totals"><td class="bs-name">TEAM</td>${numCells(totals(rows))}</tr>` : ''}
    </tbody></table></div></div>`;
    const sideRows = s => people.filter(p => p.side === s).sort((x, y) => (y.line.pts || 0) - (x.line.pts || 0)).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.line, note: Object.values(p.games).some(r => r.side !== s) ? `also played ${s === 'light' ? 'Dark' : 'Light'}` : '' }));
    const sides = ['light', 'dark'].filter(s => sideRows(s).length || absent.some(a => a.side === s));
    const first = potd && sides.includes(potd.side) ? potd.side : sides[0];
    const seg = sides.length > 1 ? `<span class="gd-seg" role="group" aria-label="Side">${sides.map(s => `<button type="button" class="${s === first ? 'is-on' : ''}" aria-pressed="${s === first}" data-pwr-btn="${s}"><span class="pw-shirt pw-shirt--${s}" aria-hidden="true"></span><span class="pill-label">${SIDE[s]}</span></button>`).join('')}</span>` : '';
    const eachGame = games.map(g => ['light', 'dark'].map(s => {
      const rows = people.filter(p => p.games[g.n] && p.games[g.n].side === s).map(p => ({ key: p.key, name: p.name, number: p.number, L: p.games[g.n] })).sort((x, y) => (y.L.pts || 0) - (x.L.pts || 0));
      return rows.length ? `<div class="pwx-box__h pwr-gh"><span class="pw-shirt pw-shirt--${s}" aria-hidden="true"></span>Game ${g.n} · ${SIDE[s]} <b class="num">${s === 'light' ? g.a : g.b}</b></div><div class="card gd-box">${box(rows)}</div>` : '';
    }).join('')).join('');
    return `<div class="pwr pwr--site"><div class="gd-cols gd-cols--final">
      <div class="gd-cols__main">
        ${site.recap || ''}
        <div class="gd-pcards">${topThreeCards(cards, { firstLabel: 'Player of the Day', label: 'Player of the Day · top 3' })}</div>
        <section aria-labelledby="pwr-box-h">
          <div class="section-header gd-sh gd-sh--row"><h2 id="pwr-box-h">Box score</h2>${seg}</div>
          <div class="card gd-box">${sides.map(s => `<div class="gd-box__panel" data-pwr-box="${s}"${s === first ? '' : ' hidden'}>${box(sideRows(s), absent.filter(a => a.side === s))}</div>`).join('')}</div>
          <p class="gd-sd">Tap a player for their card. Whole day totals.</p>
          ${noSide.length ? `<p class="gd-sd">Didn’t play: ${noSide.map(a => esc(a.name)).join(', ')}.</p>` : ''}
        </section>
        <details class="pwr-more"><summary>Each game</summary>${eachGame}</details>
        <p class="pwr-note">Papawis stats count in Papawis careers and leaders, separate from league totals.${full ? '' : ' Basic stats: points, rebounds and assists.'}</p>
      </div>
      <aside class="gd-cols__rail gd-rail--sticky">
        <div class="card pwr-games"><h3>${games.length === 1 ? 'The game' : 'The games'}</h3><div class="pwx-games">${games.map(result).join('')}</div></div>
        ${site.share || ''}
      </aside>
    </div>${playerCardTemplates(cards)}
    <script>document.querySelectorAll('[data-pwr-btn]').forEach(function (b) { b.addEventListener('click', function () { var s = b.dataset.pwrBtn; document.querySelectorAll('[data-pwr-btn]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); document.querySelectorAll('[data-pwr-box]').forEach(function (p) { p.hidden = p.dataset.pwrBox !== s; }); }); });</script>
    </div>`;
  }
  return `<div class="pwr">
    <div class="pwx-games">${games.map(result).join('')}</div>
    ${topThreeCards(cards, { firstLabel: 'Player of the Day', label: 'Player of the Day · top 3' })}
    ${day}
    ${noSide.length ? table('Didn’t play', [], noSide) : ''}
    <details class="pwr-more"><summary>Each game</summary>${perGame}</details>
    <p class="pwr-note">Papawis stats count in Papawis careers and leaders, separate from league totals.${full ? '' : ' Basic stats: points, rebounds and assists.'}</p>
    ${playerCardTemplates(cards)}
  </div>`;
}

// The site's page for a scored run.
// summary: the run's AI recap (server.js pwRunSummaryStart) or null
// share: { game, stat, locked } for a signed-in player with a line (server.js pwShareFacts): the
// game page's Share my stats editor, on the run
export function papawisResultsPage({ run, results, summary = null, share = null }) {
  return `<div class="page-content gd-page">
    <div class="section-header"><h2>${esc(run.title)} · results</h2><a href="/papawis">All runs</a></div>
    <p class="pwx-sub">${esc([run.day, run.place].filter(Boolean).join(' · '))}</p>
    ${papawisResultsBody(results, { site: {
      recap: summary ? summaryPanel(summary, 'papawis-run', false) : '',
      share: share ? '<div class="pwx-share"><button type="button" class="gd-btn gd-btn--amber" data-ssc-open>Share my stats</button></div>' : '',
    } })}
    ${share ? `${shareStatsModal(share.game, share.stat, share.locked, share.lockText || '')}
    <script>if (/[?&]share=1(&|$)/.test(location.search)) { var b = document.querySelector('[data-ssc-open]'); if (b) setTimeout(function () { b.click(); }, 0); }</script>` : ''}
  </div>`;
}
