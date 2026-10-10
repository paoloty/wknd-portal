import { escHtml } from './layout.js';
import { boardModel, recordModel, controlsBar, pageHead, sectionsHtml, plainName } from './leaders.js';



// ── Roast categories — mirror of leaders page, worst performers ───────────────
export const ROAST_CATS = [
  {
    id: 'ghost',
    label: 'PPG',
    title: 'The Ghost',
    sub: 'Fewest points per game',
    fn: p => p.games_played >= 3 ? p.pts / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: true,
  },
  {
    id: 'passenger',
    label: 'PER',
    title: 'The Passenger',
    sub: 'Lowest efficiency rating',
    fn: p => {
      const fga = (p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0)+(p.fg4m_miss||0);
      if (p.games_played < 3 || fga < 10) return null;
      const per = (p.pts||0) + 0.4*((p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)) - 0.7*fga - 0.4*(p.ft_miss||0)
        + 0.7*(p.reb||0) + (p.stl||0) + 0.7*(p.ast||0) + 0.7*(p.blk||0) - (p.turnover||0);
      return per / p.games_played;
    },
    fmt: v => v.toFixed(1),
    asc: true,
    min: '3+ GP · 10+ FGA',
  },
  {
    id: 'lane',
    label: 'RPG',
    title: 'Stay in Your Lane',
    sub: 'Fewest rebounds per game',
    fn: p => p.games_played >= 3 ? p.reb / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: true,
  },
  {
    id: 'generous',
    label: 'TOV',
    title: 'Most Generous',
    sub: 'Most turnovers per game',
    fn: p => p.games_played >= 3 ? (p.turnover||0) / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: false,
  },
  {
    id: 'foul',
    label: 'PF',
    title: 'Foul Magnet',
    sub: 'Most personal fouls per game',
    fn: p => p.games_played >= 3 ? (p.pf||0) / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: false,
  },
  {
    id: 'icecold',
    label: 'FG%',
    title: 'Ice Cold',
    sub: 'Worst field goal percentage',
    fn: p => {
      const fga = (p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0)+(p.fg4m_miss||0);
      return fga >= 10 && p.games_played >= 3 ? ((p.fg2m||0)+(p.fg3m||0)+(p.fg4m||0)) / fga : null;
    },
    fmt: v => Math.round(v * 100) + '%',
    asc: true,
    min: '3+ GP · 10+ FGA',
  },
  {
    id: 'ftphobia',
    label: 'FT%',
    title: 'Free Throw Phobia',
    sub: 'Worst free throw percentage',
    fn: p => {
      const fta = (p.ftm||0) + (p.ft_miss||0);
      return fta >= 5 && p.games_played >= 3 ? (p.ftm||0) / fta : null;
    },
    fmt: v => Math.round(v * 100) + '%',
    asc: true,
    min: '3+ GP · 5+ FTA',
  },
  {
    id: 'bricks',
    label: 'MISS',
    title: 'The Brick Factory',
    sub: 'Most missed shots per game',
    fn: p => {
      if (p.games_played < 3) return null;
      return ((p.fg2m_miss||0) + (p.fg3m_miss||0) + (p.fg4m_miss||0) + (p.ft_miss||0)) / p.games_played;
    },
    fmt: v => v.toFixed(1),
    asc: false,
  },
];

// ── Single-game disasters (all seasons) ──────────────────────────────────────
// Same record machinery as /leaders (higher fn = worse). `show` is the tile's big value,
// `unit` the line under it; ties sort by the record helper's usual order.
const fga = r => (r.fg2m || 0) + (r.fg3m || 0) + (r.fg4m || 0) + (r.fg2m_miss || 0) + (r.fg3m_miss || 0) + (r.fg4m_miss || 0);
const fgm = r => (r.fg2m || 0) + (r.fg3m || 0) + (r.fg4m || 0);
const fta = r => (r.ftm || 0) + (r.ft_miss || 0);
const misses = r => fga(r) - fgm(r) + (r.ft_miss || 0);
export const DISASTER_CATS = [
  { id: 'd_to',    label: 'TO',   title: 'Most turnovers in a game', tileTitle: 'Turnovers', worst: true,
    fn: r => r.turnover || 0, unit: () => 'in one game' },
  { id: 'd_miss',  label: 'MISS', title: 'Most missed shots in a game', tileTitle: 'Missed shots', worst: true,
    fn: r => misses(r), unit: r => `incl. ${r.ft_miss || 0} free throws · ${fgm(r)} of ${fga(r)} FG` },
  { id: 'd_cold',  label: 'FG',   title: 'Coldest shooting night', tileTitle: 'Coldest night', worst: true,
    fn: r => fga(r) >= 10 ? (1 - fgm(r) / fga(r)) + fga(r) / 1000 : -1, show: r => `${fgm(r)}/${fga(r)}`, unit: () => 'from the field · 10+ attempts' },
  { id: 'd_ft',    label: 'FT',   title: 'Worst free-throw night', tileTitle: 'Free-throw nightmare', worst: true,
    fn: r => fta(r) >= 5 ? (1 - (r.ftm || 0) / fta(r)) + fta(r) / 1000 : -1, show: r => `${r.ftm || 0}/${fta(r)}`, unit: () => 'at the line · 5+ attempts' },
];

const DUBIOUS = ['ghost', 'passenger', 'generous', 'bricks'];
const MORE = ['icecold', 'ftphobia', 'lane', 'foul'];
const fmt1 = v => v.toFixed(1);

// season: number | 'alltime'. players = that scope's per-player season rows (3+ GP rule is
// inside each category's fn); gameRecords = every game line, for the disasters.
export function buildRoastModel({ season, players = [], gameRecords = [], currentSeason }) {
  const shareSeason = season === 'alltime' ? 'alltime' : String(season);
  const board = id => {
    const c = ROAST_CATS.find(x => x.id === id);
    return boardModel({ ...c, min: c.min || '' }, players, { mode: 'roast', season: shareSeason, fmt: c.fmt || fmt1, asc: !!c.asc, valid: () => true, size: 'lg' });
  };
  const dubious = DUBIOUS.map(board);
  const more = MORE.map(board).map(b => b && { ...b, size: 'sm' });
  const name = b => b ? plainName(b.lead.p.name) : '';
  return {
    season,
    sections: [
      { id: 'dubious', nav: 'Dubious', title: 'Dubious awards', sub: 'per game · gap to the “winner”', items: dubious,
        fallback: dubious.filter(Boolean).length ? `This season’s least flattering per-game marks, minimum 3 games. ${name(dubious[0]) ? `${name(dubious[0])} is The Ghost.` : ''}`.trim() : '' },
      { id: 'more', nav: 'More', title: 'More awards', sub: 'per game', items: more,
        fallback: 'Shooting boards need 3+ games plus 10+ field-goal or 5+ free-throw attempts.' },
      { id: 'disasters', nav: 'Disasters', title: 'Single-game disasters', sub: 'all seasons', cols: 4,
        items: DISASTER_CATS.map(c => recordModel(c, gameRecords, { scope: 'alltime', currentSeason, mode: 'disaster' })),
        fallback: 'The roughest single-game lines across all seasons.' },
    ],
    also: [],
  };
}

// v: { model, seasons, kicker, meta, summaryHtml, writeups, showDownload }
export function roastPage(v) {
  const { model } = v;
  const seasonOpts = [...v.seasons.map(s => ({ value: s, label: `Season ${s}` })), { value: 'alltime', label: 'All-time' }];
  const bar = controlsBar({
    action: '/roast', title: 'The Roast', sections: model.sections,
    fields: [{ name: 'season', label: 'Season', value: model.season, options: seasonOpts }],
  });
  const body = model.sections.some(s => s.items.some(Boolean))
    ? sectionsHtml(model.sections, v.writeups, v.showDownload)
    : '<div class="ld-empty">Nobody has played 3 games yet — the roast needs a bigger sample.</div>';
  return `<div class="ld-page" data-ld-page data-as-of="${escHtml(v.asOfLabel || '')}">
  ${pageHead({ kicker: v.kicker, title: 'The Roast', meta: v.meta })}
  ${v.summaryHtml || ''}
  ${bar}
  <div class="ld-body">
    ${body}
    <div class="ld-also">
      <span>Boards need 3+ games; shooting boards also need 10+ field-goal or 5+ free-throw attempts. All in good fun.</span>
      <a href="/leaders" class="ld-also__roast">Back to the leaders <span>&rarr;</span></a>
    </div>
  </div>
</div>`;
}
