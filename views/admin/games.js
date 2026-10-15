// /admin/games: every league game (admin redesign, 2026-10-15; mockup: canvas "Data grid",
// Game Day). Rebuilt from scratch on views/admin/ui.js: the shared data grid with views for
// what needs doing (upcoming, box score to import, drafts, missing content), New game and
// Final score in drawers. The game page itself is views/admin/game.js.
// Browser side (Final score drawer, series field): public/admin-games.js.
import { escHtml } from '../layout.js';
import { manilaTodayStr } from '../utils.js';
import { pageHeader, dataGrid, statStrip, badge, button, drawer, field, fieldGrid } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtDate = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
const fmtDow = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric' }) : '');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Where a game is in its life: scheduled → score only (needs the box score) → draft → live.
export function gameState(g) {
  const noScore = Number(g.team_a_score) + Number(g.team_b_score) === 0;
  if (g.scheduled === 1 || g.status === 'scheduled' || noScore) return 'upcoming';
  if (g.status === 'final') return 'score';
  if (g.under_review) return 'draft';
  return 'live';
}
export const STATE_BADGE = {
  upcoming: ['Upcoming', 'blue'], score: ['Needs box score', 'amber'], draft: ['Draft', 'amber'], live: ['Live', 'green'],
};
export const TYPE_LABEL = { regular: 'Regular season', playoff: 'Playoff', finals: 'Finals' };
export const otLabel = ot => (Number(ot) > 1 ? `${Number(ot)}OT` : Number(ot) === 1 ? 'OT' : '');

// The content a live game page wants. A score-only game only takes a cover.
export function contentChecks(g) {
  const st = gameState(g);
  if (st === 'upcoming') return [];
  if (st === 'score') return [['Box score', false], ['Cover', !!g.has_cover]];
  return [
    ['Recap', !!String(g.game_writeup || '').replace(/<[^>]*>/g, '').trim()],
    ['Player of the game', !!String(g.potg_writeup || '').trim()],
    ['Cover', !!g.has_cover],
    ['YouTube', !!String(g.youtube_url || '').trim()],
  ];
}
const missingCount = g => contentChecks(g).filter(([, ok]) => !ok).length;

function matchup(g, colors) {
  const st = gameState(g);
  const a = Number(g.team_a_score), b = Number(g.team_b_score);
  const win = st === 'upcoming' || a === b ? '' : a > b ? 'a' : 'b';
  const team = (name, side) => `<span class="agl-team${win === side ? ' is-win' : ''}"><i class="agl-dot" style="background:${attr(colors[side])}"></i>${escHtml(name)}</span>`;
  const mid = st === 'upcoming' ? '<span class="agl-vs">vs</span>'
    : `<span class="agl-score">${a}<span aria-hidden="true">–</span>${b}</span>${otLabel(g.overtime) ? `<span class="agl-ot">${otLabel(g.overtime)}</span>` : ''}`;
  return `<span class="agl-match">${team(g.team_a_name, 'a')}${mid}${team(g.team_b_name, 'b')}</span>`;
}

function checksCell(g) {
  const list = contentChecks(g);
  if (!list.length) return '<span class="aui-muted">—</span>';
  const short = { Recap: 'R', 'Player of the game': 'P', Cover: 'C', YouTube: 'Y', 'Box score': 'B' };
  return `<span class="agl-checks">${list.map(([l, ok]) => `<span class="agl-check${ok ? ' is-on' : ''}" title="${attr(`${l}: ${ok ? 'done' : 'missing'}`)}">${short[l]}</span>`).join('')}</span>`;
}

export function adminGamesListBody({ games = [], teams = [], currentSeason = 1, pickCounts = {}, query = {} }) {
  const colorOf = Object.fromEntries(teams.map(t => [t.id, t.color || '']));
  const nameColor = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), t.color || '']));
  const colors = g => ({ a: colorOf[g.team_a_id] || nameColor[String(g.team_a_name).toUpperCase()] || '', b: colorOf[g.team_b_id] || nameColor[String(g.team_b_name).toUpperCase()] || '' });
  const today = manilaTodayStr();
  const seasons = [...new Set(games.map(g => String(g.season || '')).filter(Boolean))].sort((x, y) => Number(y) - Number(x));

  const upcoming = games.filter(g => gameState(g) === 'upcoming' && g.date >= today).sort((x, y) => (x.date < y.date ? -1 : 1));
  const strip = statStrip([
    { label: upcoming[0] ? `Next game day · ${fmtDate(upcoming[0].date)}` : 'Next game day', value: upcoming[0] ? String(upcoming.filter(g => g.date === upcoming[0].date).length) : '—', of: upcoming[0] ? ' games' : '' },
    { label: 'Box scores to import', value: String(games.filter(g => gameState(g) === 'score' || (gameState(g) === 'upcoming' && g.date < today)).length) },
    { label: 'Drafts', value: String(games.filter(g => gameState(g) === 'draft').length) },
    { label: 'Live games missing content', value: String(games.filter(g => gameState(g) === 'live' && missingCount(g)).length) },
  ]);

  const grid = dataGrid({
    id: 'games', baseUrl: '/admin/games', query,
    rows: games, rowKey: g => g.id, noun: ['game', 'games'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'upcoming', label: 'Upcoming', test: g => gameState(g) === 'upcoming' },
      { key: 'import', label: 'Needs box score', test: g => gameState(g) === 'score' || (gameState(g) === 'upcoming' && g.date < today) },
      { key: 'draft', label: 'Drafts', test: g => gameState(g) === 'draft' },
      { key: 'content', label: 'Missing content', test: g => gameState(g) === 'live' && missingCount(g) > 0 },
    ],
    search: { placeholder: 'Search teams', text: g => `${g.team_a_name} ${g.team_b_name}` },
    filters: [
      ...(seasons.length > 1 ? [{ key: 'season', label: 'Season', options: seasons.map(s => [s, `Season ${s}`]), test: (g, v) => String(g.season) === v }] : []),
      { key: 'type', label: 'Type', options: Object.entries(TYPE_LABEL), test: (g, v) => (g.game_type || 'regular') === v },
    ],
    defaultSort: '-date', perPage: 30,
    columns: [
      { key: 'date', label: 'Date', num: true, nowrap: true, sort: g => `${g.date}|${g.id}`, cell: g => `${escHtml(fmtDate(g.date))}<div class="aui-cell__sub agl-sub">${escHtml(fmtDow(g.date))}</div>` },
      { key: 'match', label: 'Game', primary: true, cell: g => matchup(g, colors(g)) },
      { key: 'type', label: 'Type', bare: true, phone: false, sort: g => g.game_type || 'regular', cell: g => badge(TYPE_LABEL[g.game_type] || 'Regular season', g.game_type === 'finals' ? 'amber' : g.game_type === 'playoff' ? 'blue' : 'gray') },
      { key: 'status', label: 'Status', bare: true, sort: g => gameState(g), cell: g => {
        const st = gameState(g);
        const fin = st === 'upcoming' ? button('Final score', { kind: 'secondary', size: 'sm', attrs: `data-final-open="${attr(g.id)}" data-a="${attr(g.team_a_name)}" data-b="${attr(g.team_b_name)}"` }) : '';
        return `<span class="aui-cell__badges">${badge(...STATE_BADGE[st])}${fin}</span>`;
      } },
      { key: 'content', label: 'Content', bare: true, sort: g => -missingCount(g), cell: checksCell },
      { key: 'picks', label: 'Picks', num: true, phone: false, sort: g => pickCounts[g.id] || 0, cell: g => (pickCounts[g.id] ? String(pickCounts[g.id]) : '<span class="aui-muted">—</span>') },
      { key: 'season', label: 'Season', num: true, phone: false, sort: g => Number(g.season) || 0, cell: g => escHtml(g.season || '—') },
    ],
    rowHref: g => `/admin/games/${g.id}`,
    rowMenu: g => {
      const st = gameState(g);
      const ot = st === 'upcoming' ? [] : ['sep', ...[0, 1, 2, 3].filter(n => n !== (Number(g.overtime) || 0)).map(n => ({ label: n ? `Mark ${otLabel(n)}` : 'Mark regulation', post: `/admin/games/${g.id}/overtime`, body: { overtime: n }, done: n ? `Marked ${otLabel(n)}.` : 'Marked regulation.' }))];
      return [
        { label: 'Open game', href: `/admin/games/${g.id}` },
        st !== 'upcoming' ? { label: 'Content', href: `/admin/games/${g.id}?tab=content` } : null,
        { label: 'Picks', href: `/admin/games/${g.id}?tab=picks` },
        { label: 'View on site', href: `/games/${g.id}`, external: true },
        ...ot,
      ];
    },
    actionsHtml: button('+ New game', { kind: 'primary', attrs: 'data-drawer-open="new-game"' }),
    empty: { title: 'No games yet', sub: 'Create one with “+ New game”.' },
  });

  // New games default to the next game day: the coming Sunday (today, if it's Sunday) in
  // Manila time. Creating Sunday's games midweek used to save them under the day they were
  // made when nobody changed the date.
  const nextSunday = (() => {
    const [y, m, d] = today.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + ((7 - t.getUTCDay()) % 7));
    return t.toISOString().slice(0, 10);
  })();
  const teamOpts = [['', 'Pick a team…'], ...teams.map(t => [t.id, t.name])];
  const newGame = drawer({
    id: 'new-game', eyebrow: 'Game Day', title: 'New game',
    bodyHtml: `<form id="new-game-form" data-json-action="/admin/games" data-then="/admin/games/{id}" data-done="Game created.">${fieldGrid(`
        ${field({ label: 'Date', name: 'date', type: 'date', value: nextSunday, required: true, help: 'Defaults to the coming Sunday.' })}
        ${field({ label: 'Season', name: 'season', type: 'number', value: String(currentSeason), required: true, attrs: 'min="1" step="1"' })}
        ${field({ label: 'Team A', name: 'team_a_id', type: 'select', options: teamOpts, required: true })}
        ${field({ label: 'Team B', name: 'team_b_id', type: 'select', options: teamOpts, required: true })}
        ${field({ label: 'Type', name: 'game_type', type: 'select', value: 'regular', options: Object.entries(TYPE_LABEL), attrs: 'data-game-type' })}
        <div data-series hidden>${field({ label: 'Series', name: 'series_id', type: 'select', options: [['semi-1', 'semi-1 (#1 vs #4)'], ['semi-2', 'semi-2 (#2 vs #3)']], help: 'Groups the games of one playoff series.', attrs: 'disabled' })}</div>`)}
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Create game', { kind: 'primary', type: 'submit', attrs: 'form="new-game-form"' })}`,
  });

  // One Final score drawer; public/admin-games.js points it at the row's game.
  const finalScore = drawer({
    id: 'final-score', eyebrow: 'Final score', title: 'Mark as final',
    bodyHtml: `<form id="final-form" data-json-action="" data-done="Final score saved. Picks are settled.">
      <p class="aui-muted agl-final-note">Saves the score only, so picks can settle. Import the game file later for the box score.</p>
      ${fieldGrid(`
        ${field({ label: 'Team A', name: 'team_a_score', type: 'number', required: true, attrs: 'min="0" step="1" inputmode="numeric" data-final-a' })}
        ${field({ label: 'Team B', name: 'team_b_score', type: 'number', required: true, attrs: 'min="0" step="1" inputmode="numeric" data-final-b' })}
        ${field({ label: 'Overtime', name: 'overtime', type: 'select', wide: true, value: '0', options: [['0', 'Regulation'], ['1', 'OT'], ['2', '2OT'], ['3', '3OT']] })}`)}
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Save final score', { kind: 'primary', type: 'submit', attrs: 'form="final-form"' })}`,
  });

  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Game Day', title: 'Games', sub: `${plural(games.length, 'game')}. Open one for its box score, recap, player of the game and picks.`, actionsHtml: button('Who wins? picks', { kind: 'secondary', href: '/admin/picks' }) })}
    ${strip}
    ${grid}
    ${newGame}
    ${finalScore}
  </div>
  <script src="/admin-games.js" defer></script>`;
}
