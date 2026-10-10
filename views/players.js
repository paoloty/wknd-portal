import { escHtml } from './layout.js';
import { teamColor, initials, playerPhotoUrl } from './utils.js';

// /players — the player directory.
// Rosters view (default): every rostered player as a card in one grid (photo backdrop, PPG/RPG/APG,
//   points-by-game sparkline), filtered client-side by the sticky bar (search, team, position,
//   rookies, sort); then Alumni (played before, no team now) and Community (Papawis only).
// Stats view (?view=stats): sortable season table (?season=N|career, ?mode=totals), pick two
//   rows to compare — the write-up comes from /api/compare in the conyo voice.
// Styles: public/players.css (pl- prefix). Head + pills reuse the /standings stp- classes.

const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
const TEAM_ORDER = ['WHITE', 'MAROON', 'BLUE', 'BLACK'];

const pct = (made, miss) => { const att = (made || 0) + (miss || 0); return att > 0 ? (made || 0) / att : null; };
const per = (v, gp) => gp > 0 ? (v || 0) / gp : null;
const f1 = v => v === null || v === undefined ? '—' : v.toFixed(1);
const fp = v => v === null || v === undefined ? '—' : Math.round(v * 100) + '%';
const num = v => v === null || v === undefined ? '' : String(Math.round(v * 10000) / 10000);

const parsePositions = raw => { try { return Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { return []; } };
const sortPositions = list => [...list].sort((a, b) => {
  const ai = POS_ORDER.indexOf(a), bi = POS_ORDER.indexOf(b);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
});
const posKey = list => list.map(p => `|${p}|`).join('');
const teamSort = (a, b) => (TEAM_ORDER.indexOf(a) + 1 || 99) - (TEAM_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

const ICON_SEARCH = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>`;
const ICON_PENCIL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

function avatar(p, cls) {
  return `<span class="${cls}" style="--team:${teamColor(p.team)}"><span>${escHtml(initials(`${p.first} ${p.last}`))}</span>${p.photo ? `<img src="${playerPhotoUrl(p.id, 192)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

// Points per game as a little line (0–30 scale), last game dotted amber.
function sparkline(pts) {
  if (!pts || pts.length < 2) return '';
  const step = 72 / (pts.length - 1);
  const xy = pts.map((v, i) => [2 + i * step, 26 - Math.min(v, 30) / 30 * 23]);
  const [lx, ly] = xy[xy.length - 1];
  return `<span class="pl-spark"><svg width="76" height="28" viewBox="0 0 76 28" role="img" aria-label="Points by game: ${pts.join(', ')}"><polyline points="${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6"/></svg><small>PTS BY GAME</small></span>`;
}

function teamTag(team) {
  return team ? `<span class="pl-team"><i style="background:${teamColor(team)}"></i>${escHtml(team)}</span>` : '';
}

function playerCard(p, isTop) {
  const ppg = per(p.pts, p.gp), rpg = per(p.reb, p.gp), apg = per(p.ast, p.gp);
  const pos = sortPositions(p.positions);
  const stat = (v, k, lead) => `<span class="pl-stat${lead ? ' is-lead' : ''}"><b class="font-condensed">${f1(v)}</b><small>${k}</small></span>`;
  return `<a href="/players/${encodeURIComponent(p.id)}" class="pl-card${p.photo ? ' pl-card--photo' : ''}" style="--team:${teamColor(p.team)}"
    data-name="${escHtml(`${p.first} ${p.last}`.toLowerCase())}" data-team="${escHtml(p.team)}" data-pos="${escHtml(posKey(pos))}" data-rookie="${p.rookie ? 1 : 0}"
    data-ppg="${num(ppg) || -1}" data-rpg="${num(rpg) || -1}" data-apg="${num(apg) || -1}" data-num="${p.number !== '' && p.number != null ? parseInt(p.number, 10) || 0 : 999}" data-sortname="${escHtml(`${p.last} ${p.first}`.toLowerCase())}">
    ${p.photo ? `<img class="pl-card__bg" src="${playerPhotoUrl(p.id, 192)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    ${p.number !== '' && p.number != null ? `<span class="pl-card__num font-condensed" aria-hidden="true">#${escHtml(String(p.number))}</span>` : ''}
    <span class="pl-card__top">
      ${avatar(p, 'pl-av')}
      <span class="pl-card__who">
        <span class="pl-card__first">${escHtml(p.first)}</span>
        <span class="pl-card__last">${escHtml(p.last)}</span>
        <span class="pl-card__meta">${teamTag(p.team)}<span class="pl-card__num-sm">${p.number !== '' && p.number != null ? `#${escHtml(String(p.number))} · ` : ''}</span><span>${escHtml(pos.slice(0, 2).join(' · ') || '—')}</span>${p.rookie ? '<span class="pl-rookie">ROOKIE</span>' : ''}${p.status === 'inactive' ? '<span class="pl-rookie pl-rookie--off">INACTIVE</span>' : ''}</span>
        <span class="pl-card__sub">${p.gp ? `${f1(rpg)} RPG · ${f1(apg)} APG` : 'No games yet'}</span>
      </span>
    </span>
    <span class="pl-card__foot">
      <span class="pl-card__stats">${stat(ppg, 'PPG', isTop)}${stat(rpg, 'RPG')}${stat(apg, 'APG')}</span>
      ${sparkline(p.spark)}
    </span>
  </a>`;
}

function head({ season, week, view, counts }) {
  const toggle = (key, label, href) => key === view
    ? `<span class="stp-pill is-on" aria-current="page"><span class="pill-label">${label}</span></span>`
    : `<a href="${href}" class="stp-pill"><span class="pill-label">${label}</span></a>`;
  return `<div class="stp-head pl-head">
    <div class="stp-head__title">
      <span class="stp-kicker">Season ${escHtml(String(season))}${week ? ` · After week ${escHtml(String(week))}` : ''}</span>
      <h1>Players</h1>
      <span class="pl-head__count">${counts}</span>
    </div>
    <nav class="stp-pills" aria-label="View">${toggle('rosters', 'Rosters', '/players')}${toggle('stats', 'Stats', '/players?view=stats')}</nav>
  </div>`;
}

function searchBox(placeholder) {
  return `<label class="pl-search">${ICON_SEARCH}<input type="search" id="pl-search" placeholder="${escHtml(placeholder)}" aria-label="Search players" autocomplete="off"></label>`;
}

function filterPills(teams, positions) {
  const teamPills = teams.length > 1 ? `<div class="pl-bar__group" role="group" aria-label="Team">${teams.map(t =>
    `<button type="button" class="stp-chip pl-chip" data-group="team" data-val="${escHtml(t)}" aria-pressed="false"><i class="pl-dot" style="background:${teamColor(t)}"></i><span class="pill-label">${escHtml(t)}</span></button>`).join('')}</div>` : '';
  const posPills = positions.length > 1 ? `<div class="pl-bar__group" role="group" aria-label="Position">${positions.map(p =>
    `<button type="button" class="stp-chip pl-chip pl-chip--pos" data-group="pos" data-val="${escHtml(p)}" aria-pressed="false"><span class="pill-label">${escHtml(p)}</span></button>`).join('')}</div>` : '';
  return [teamPills, posPills].filter(Boolean).join('<span class="pl-bar__sep" aria-hidden="true"></span>');
}

// ── Rosters view ──────────────────────────────────────────────────────────────
function rostersView({ season, roster, alumni, community }) {
  const sorted = [...roster].sort((a, b) => (per(b.pts, b.gp) ?? -1) - (per(a.pts, a.gp) ?? -1) || b.gp - a.gp || a.last.localeCompare(b.last));
  const teams = [...new Set(roster.map(p => p.team).filter(Boolean))].sort(teamSort);
  const positions = sortPositions([...new Set(roster.flatMap(p => p.positions))]);
  const hasRookies = roster.some(p => p.rookie);
  const topId = sorted.find(p => p.gp)?.id;
  const shownCommunity = community.filter(c => c.papawis > 0);
  const hiddenCommunity = community.filter(c => !(c.papawis > 0));

  const bar = `<div class="pl-bar" data-pl-bar>
    ${searchBox('Search players…')}
    <span class="pl-bar__sep" aria-hidden="true"></span>
    ${filterPills(teams, positions)}
    ${hasRookies ? `<span class="pl-bar__sep" aria-hidden="true"></span><button type="button" class="stp-chip pl-chip" data-group="rookie" data-val="1" aria-pressed="false"><span class="pl-new">NEW</span><span class="pill-label">Rookies only</span></button>` : ''}
    <label class="pl-sort">Sort
      <select id="pl-sort">
        <option value="ppg">PPG</option><option value="rpg">RPG</option><option value="apg">APG</option><option value="num">Jersey #</option><option value="sortname">Name</option>
      </select>
    </label>
  </div>`;

  const alumniHtml = alumni.length ? `<section class="pl-more__col">
      <div class="section-header"><h2>Alumni <span class="section-header__sub">${alumni.length} player${alumni.length === 1 ? "" : "s"}</span></h2></div>
      <p class="stp-desc">Players who suited up in an earlier season but aren't on a Season ${escHtml(String(season))} roster. Each one shows their last season's numbers.</p>
      <div class="pl-alumni">${alumni.map(a => `<a href="/players/${encodeURIComponent(a.id)}" class="pl-person" data-name="${escHtml(a.name.toLowerCase())}">
        <span class="pl-person__av">${escHtml(initials(a.name))}</span>
        <span class="pl-person__who"><span class="pl-person__name">${escHtml(a.name)}</span><span class="pl-person__line">Season ${escHtml(String(a.season))} · ${a.gp} GP · ${f1(per(a.pts, a.gp))} PPG</span></span>
      </a>`).join('')}</div>
    </section>` : '';

  const commChip = (c, hidden) => `<a href="/players/${encodeURIComponent(c.id)}" class="pl-cchip${hidden ? ' is-extra' : ''}" data-name="${escHtml(c.name.toLowerCase())}"${hidden ? ' hidden' : ''}>
      <span class="pl-cchip__av">${escHtml(initials(c.name))}</span><span>${escHtml(c.name)}</span>${c.papawis ? `<b class="font-condensed">${c.papawis}</b>` : ''}</a>`;
  const communityHtml = community.length ? `<section class="pl-more__col">
      <div class="section-header"><h2>Community <span class="section-header__sub">${community.length} member${community.length === 1 ? "" : "s"}</span></h2><a href="/papawis" class="section-header__link">Papawis <span>&rarr;</span></a></div>
      <p class="stp-desc">Members who play Papawis, our weekend pickup games, but haven't played a league game yet.${shownCommunity.length ? ' The number is how many Papawis sessions they\'ve played.' : ''}</p>
      <div class="pl-community">${shownCommunity.map(c => commChip(c, false)).join('')}${hiddenCommunity.map(c => commChip(c, true)).join('')}</div>
      ${hiddenCommunity.length ? `<p class="pl-note"><button type="button" class="pl-linkbtn" id="pl-comm-more">Show all ${community.length} members</button></p>` : ''}
    </section>` : '';

  return `<div class="pl-browse">
    ${bar}
    <p class="pl-status" id="pl-status" aria-live="polite">Showing all ${roster.length} rostered players · sorted by points per game</p>
    <div class="pl-grid" id="pl-grid">${sorted.map(p => playerCard(p, p.id === topId)).join('')}</div>
    <p class="pl-empty" id="pl-empty" hidden>No rostered players match. Try clearing a filter.</p>
  </div>
  ${alumniHtml || communityHtml ? `<div class="pl-more">${alumniHtml}${communityHtml}</div>` : ''}`;
}

// ── Stats view ────────────────────────────────────────────────────────────────
const COLS_PG = [
  { k: 'gp', label: 'GP', group: 1 }, { k: 'ppg', label: 'PPG' }, { k: 'fgp', label: 'FG%', pct: 1 }, { k: 'tpp', label: '3P%', pct: 1 }, { k: 'qpp', label: '4P%', pct: 1 }, { k: 'ftp', label: 'FT%', pct: 1 },
  { k: 'rpg', label: 'RPG', group: 1 }, { k: 'apg', label: 'APG' }, { k: 'spg', label: 'SPG' }, { k: 'bpg', label: 'BPG' }, { k: 'tpg', label: 'TO', low: 1 },
];
const COLS_TOT = [
  { k: 'gp', label: 'GP', group: 1 }, { k: 'pts', label: 'PTS' }, { k: 'fgp', label: 'FG%', pct: 1 }, { k: 'tpp', label: '3P%', pct: 1 }, { k: 'qpp', label: '4P%', pct: 1 }, { k: 'ftp', label: 'FT%', pct: 1 },
  { k: 'reb', label: 'REB', group: 1 }, { k: 'ast', label: 'AST' }, { k: 'stl', label: 'STL' }, { k: 'blk', label: 'BLK' }, { k: 'tov', label: 'TO', low: 1 },
];

function statValues(r) {
  const gp = r.gp || 0;
  return {
    gp, pts: r.pts, reb: r.reb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.turnover,
    ppg: per(r.pts, gp), rpg: per(r.reb, gp), apg: per(r.ast, gp), spg: per(r.stl, gp), bpg: per(r.blk, gp), tpg: per(r.turnover, gp),
    fgp: pct((r.fg2m || 0) + (r.fg3m || 0) + (r.fg4m || 0), (r.fg2m_miss || 0) + (r.fg3m_miss || 0) + (r.fg4m_miss || 0)),
    tpp: pct(r.fg3m, r.fg3m_miss), qpp: pct(r.fg4m, r.fg4m_miss), ftp: pct(r.ftm, r.ft_miss),
  };
}

function statsView({ stats, isAdmin }) {
  const { rows, season, seasons, mode } = stats;
  const cols = mode === 'totals' ? COLS_TOT : COLS_PG;
  const sortKey = mode === 'totals' ? 'pts' : 'ppg';
  const vals = rows.map(r => ({ r, v: statValues(r) }))
    .sort((a, b) => (b.v[sortKey] ?? -1) - (a.v[sortKey] ?? -1) || b.v.gp - a.v.gp);
  // Column leader (amber) — counting stats only; GP and turnovers don't get one.
  const best = {};
  for (const c of cols) if (c.k !== 'gp' && !c.low) best[c.k] = Math.max(...vals.map(x => x.v[c.k] ?? -1));
  const teams = [...new Set(rows.map(r => r.team).filter(Boolean))].sort(teamSort);
  const positions = sortPositions([...new Set(rows.flatMap(r => r.positions))]);
  const seasonLabel = season === 'career' ? 'Career' : `Season ${season}`;
  const q = (s, m) => {
    const p = ['view=stats'];
    if (s !== String(seasons[0])) p.push(`season=${encodeURIComponent(s)}`);
    if (m === 'totals') p.push('mode=totals');
    return `/players?${p.join('&')}`;
  };
  const pill = (label, on, href) => on
    ? `<span class="stp-pill is-on" aria-current="page"><span class="pill-label">${label}</span></span>`
    : `<a href="${href}" class="stp-pill"><span class="pill-label">${label}</span></a>`;

  const bar = `<div class="pl-bar" data-pl-bar>
    <nav class="pl-bar__group" aria-label="Season">${seasons.map(s => pill(`S${escHtml(String(s))}`, String(s) === String(season), q(String(s), mode))).join('')}${pill('Career', season === 'career', q('career', mode))}</nav>
    <nav class="pl-bar__group" aria-label="Stat type">${pill('Per game', mode !== 'totals', q(String(season), 'pg'))}${pill('Totals', mode === 'totals', q(String(season), 'totals'))}</nav>
    <span class="pl-bar__sep" aria-hidden="true"></span>
    ${searchBox('Search players…')}
    <span class="pl-bar__sep" aria-hidden="true"></span>
    ${filterPills(teams, positions)}
  </div>`;

  const th = cols.map((c, i) => `<th class="pl-th${c.group ? ' pl-th--group' : ''}${c.k === sortKey ? ' is-sorted' : ''}" data-col="${i + 4}" aria-sort="${c.k === sortKey ? 'descending' : 'none'}"><button type="button" class="pl-th__btn" data-sort="${i}" data-low="${c.low ? 1 : 0}">${c.label}<span class="pl-th__arrow" aria-hidden="true"></span></button></th>`).join('');

  const body = vals.map(({ r, v }, i) => {
    const pos = sortPositions(r.positions);
    const name = `${r.first} ${r.last}`;
    const cells = cols.map(c => {
      const x = v[c.k];
      const shown = c.pct ? fp(x) : c.k === 'gp' || mode === 'totals' ? (x === null || x === undefined ? '—' : String(x)) : f1(x);
      const lead = best[c.k] !== undefined && x !== null && x !== undefined && x === best[c.k] && x > 0;
      return `<td class="pl-td pl-td--stat${c.group ? ' pl-td--group' : ''}${c.k === sortKey ? ' is-sorted' : ''}${lead ? ' is-lead' : ''}" data-v="${x === null || x === undefined ? -1 : num(x)}">${shown}</td>`;
    }).join('');
    const cmp = { ppg: v.ppg, rpg: v.rpg, apg: v.apg, spg: v.spg, bpg: v.bpg, fgp: v.fgp, tpp: v.tpp, ftp: v.ftp, tpg: v.tpg };
    return `<tr class="pl-row" data-id="${escHtml(r.id)}" data-name="${escHtml(name.toLowerCase())}" data-display="${escHtml(name)}" data-team="${escHtml(r.team || '')}" data-color="${teamColor(r.team)}" data-pos="${escHtml(posKey(pos))}" data-posl="${escHtml(pos.slice(0, 2).join(' · '))}" data-cmp="${escHtml(JSON.stringify(Object.fromEntries(Object.entries(cmp).map(([k, x]) => [k, x === null ? null : Math.round(x * 1000) / 1000]))))}">
      <td class="pl-td pl-td--pick"><label><input type="checkbox" class="pl-pick" aria-label="Compare ${escHtml(name)}"></label></td>
      <td class="pl-td pl-td--player" data-v="${escHtml(`${r.last} ${r.first}`.toLowerCase())}">
        <a href="/players/${encodeURIComponent(r.id)}" class="pl-tplayer">
          <span class="pl-rank font-condensed">${i + 1}</span>
          ${avatar(r, 'pl-av pl-av--sm')}
          <span class="pl-tname">${escHtml(r.first)} <b>${escHtml(r.last)}</b></span>
          ${r.rookie && season !== 'career' ? '<span class="pl-rookie">ROOKIE</span>' : ''}${r.status === 'inactive' ? '<span class="pl-rookie pl-rookie--off">INACTIVE</span>' : ''}
        </a>
        ${isAdmin ? `<button type="button" class="pl-edit" aria-label="Edit ${escHtml(name)}" data-pid="${escHtml(r.id)}" data-fn="${escHtml(r.firstName || '')}" data-ln="${escHtml(r.lastName || '')}" data-num="${escHtml(String(r.number ?? ''))}" data-pos="${escHtml(JSON.stringify(r.positions || []))}" data-status="${escHtml(r.status || 'active')}">${ICON_PENCIL}</button>` : ''}
      </td>
      <td class="pl-td pl-td--team" data-v="${escHtml(r.team || '')}">${teamTag(r.team)}</td>
      <td class="pl-td pl-td--pos" data-v="${escHtml(pos[0] || '')}">${escHtml(pos.slice(0, 2).join(' · ') || '—')}</td>
      ${cells}
    </tr>`;
  }).join('');

  return `<div class="pl-browse">
    ${bar}
    <div class="pl-tablewrap">
      <table class="pl-table" id="pl-table">
        <thead>
          <tr class="pl-groups">
            <th colspan="4" class="pl-groups__ctx">${escHtml(seasonLabel)} · regular season · ${mode === 'totals' ? 'totals' : 'per game'}</th>
            <th colspan="6" class="pl-groups__g">SCORING</th>
            <th colspan="5" class="pl-groups__g">FLOOR GAME</th>
          </tr>
          <tr class="pl-cols">
            <th class="pl-th pl-th--pick"><span class="sr-only">Compare</span></th>
            <th class="pl-th pl-th--player"><button type="button" class="pl-th__btn" data-sort="name">PLAYER<span class="pl-th__arrow" aria-hidden="true"></span></button></th>
            <th class="pl-th pl-th--team">TEAM</th>
            <th class="pl-th pl-th--pos">POS</th>
            ${th}
          </tr>
        </thead>
        <tbody id="pl-body">${body}</tbody>
      </table>
      <p class="pl-empty" id="pl-empty" hidden>No players match. Try clearing a filter.</p>
      <p class="pl-tablenote">${rows.length} players with ${escHtml(seasonLabel === 'Career' ? 'regular-season games' : `${seasonLabel} games`)} · tick two to compare</p>
    </div>
  </div>

  <div class="pl-tray" id="pl-tray" hidden>
    <span class="pl-tray__label">COMPARE</span>
    <span class="pl-tray__slots" id="pl-tray-slots"></span>
    <span class="pl-tray__hint" id="pl-tray-hint">Tick one more player</span>
    <button type="button" class="pl-tray__go" id="pl-tray-go" disabled><span class="pill-label">Compare 2 players →</span></button>
    <button type="button" class="pl-tray__x" id="pl-tray-x" aria-label="Clear comparison">&times;</button>
  </div>

  <div class="pl-modal" id="pl-modal" hidden>
    <div class="pl-modal__box" role="dialog" aria-modal="true" aria-labelledby="pl-modal-title">
      <button type="button" class="pl-modal__x" id="pl-modal-x" aria-label="Close">&times;</button>
      <h2 class="sr-only" id="pl-modal-title">Player comparison</h2>
      <div id="pl-modal-body"></div>
    </div>
  </div>
  ${isAdmin ? adminEditModal() : ''}`;
}

function adminEditModal() {
  return `<div class="pl-modal" id="pl-edit-modal" hidden>
    <div class="pl-modal__box pl-modal__box--sm" role="dialog" aria-modal="true" aria-labelledby="pl-edit-title">
      <button type="button" class="pl-modal__x" id="pl-edit-close" aria-label="Close">&times;</button>
      <h2 class="pl-edit__title" id="pl-edit-title">Edit player</h2>
      <div class="pl-edit__msg" id="pl-edit-msg" hidden></div>
      <input type="hidden" id="pl-edit-pid">
      <form id="pl-edit-form" class="pl-edit__form">
        <div class="pl-edit__row">
          <label><span class="admin-field-label">First name</span><input name="first_name" type="text" class="admin-input" required></label>
          <label><span class="admin-field-label">Last name</span><input name="last_name" type="text" class="admin-input" required></label>
        </div>
        <div class="pl-edit__row">
          <label><span class="admin-field-label">Jersey #</span><input name="number" type="text" class="admin-input" placeholder="e.g. 23"></label>
          <label><span class="admin-field-label">Status</span><select name="status" class="admin-input"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <fieldset class="pl-edit__pos"><legend class="admin-field-label">Positions</legend>
          ${POS_ORDER.map(p => `<label><input type="checkbox" name="positions" value="${p}"> ${p}</label>`).join('')}
        </fieldset>
        <button type="submit" class="admin-btn" id="pl-edit-submit">SAVE CHANGES</button>
      </form>
    </div>
  </div>`;
}

// ── Writeups under the page title (built from the numbers, never AI, so always accurate) ──
const nameOf = p => `${p.first} ${p.last}`;
const joinNames = list => list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;

// The player(s) with the best per-game value; ties share it.
function perGameLeaders(roster, key) {
  const played = roster.filter(p => p.gp > 0);
  if (!played.length) return null;
  const val = p => Math.round(per(p[key], p.gp) * 10) / 10;
  const top = Math.max(...played.map(val));
  if (!(top > 0)) return null;
  return { names: played.filter(p => val(p) === top).map(nameOf), value: top.toFixed(1) };
}

function rostersIntro({ season, roster }) {
  // The counts line above already says how many players/rookies, so this starts at the leaders.
  let text = '';
  const lead = (key, what) => {
    const l = perGameLeaders(roster, key);
    if (!l) return '';
    return l.names.length > 1 ? `${joinNames(l.names)} share the ${what} lead at ${l.value}` : `${l.names[0]} leads the ${what} at ${l.value}`;
  };
  const parts = [lead('pts', 'scoring'), lead('reb', 'rebounding'), lead('ast', 'assists')].filter(Boolean);
  if (parts.length) text = `${parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts[0]} a game.`;
  else text = `Season ${season} stats show up here after the first game.`;
  return `${escHtml(text)} Tap a card for the full profile.`;
}

function statsIntro({ stats }) {
  const n = stats.rows.length;
  const nums = stats.seasons.map(Number).filter(Boolean);
  const range = nums.length > 1 ? `Seasons ${Math.min(...nums)}–${Math.max(...nums)}` : `Season ${nums[0] ?? ''}`;
  const scope = stats.season === 'career'
    ? `Career regular-season ${stats.mode === 'totals' ? 'totals' : 'averages'} for all ${n} players across ${range}.`
    : `Season ${stats.season} regular-season ${stats.mode === 'totals' ? 'totals' : 'averages'} for the ${n} players who played.`;
  return escHtml(`${scope} Tap any column to sort, or tick two players to compare them and get the conyo take.`);
}

export function playersPage(d) {
  const { view, season, week, roster, alumni, community, isAdmin } = d;
  const rookies = roster.filter(p => p.rookie).length;
  const counts = [
    `${roster.length} on Season ${escHtml(String(season))} rosters`,
    rookies ? `${rookies} rookie${rookies === 1 ? '' : 's'}` : '',
    alumni.length ? `${alumni.length} alumni` : '',
    community.length ? `${community.length} community member${community.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="pl" data-view="${view}">
    <div class="pl-top">
      ${head({ season, week, view, counts })}
      <p class="stp-desc pl-intro">${view === 'stats' ? statsIntro(d) : rostersIntro(d)}</p>
    </div>
    ${view === 'stats' ? statsView(d) : rostersView(d)}
  </div>
  ${pageScript(view, isAdmin)}`;
}

// ── Client script ─────────────────────────────────────────────────────────────
function pageScript(view, isAdmin) {
  return `<script>
(function () {
  // Sticky bar sits right under the sticky site header, whatever its height.
  var header = document.querySelector('.site-header');
  function setTop() { document.documentElement.style.setProperty('--pl-top', (header ? header.getBoundingClientRect().height : 0) + 'px'); }
  setTop(); window.addEventListener('resize', setTop);

  var search = document.getElementById('pl-search');
  var sel = { team: new Set(), pos: new Set(), rookie: new Set() };
  var q = '';
  document.querySelectorAll('.pl-chip[data-group]').forEach(function (b) {
    b.addEventListener('click', function () {
      var set = sel[b.dataset.group], v = b.dataset.val;
      if (set.has(v)) set.delete(v); else set.add(v);
      b.classList.toggle('is-on', set.has(v));
      b.setAttribute('aria-pressed', set.has(v) ? 'true' : 'false');
      update();
    });
  });
  if (search) search.addEventListener('input', function () { q = search.value.trim().toLowerCase(); update(); });

  function matches(el) {
    if (q && el.dataset.name.indexOf(q) === -1) return false;
    if (sel.team.size && !sel.team.has(el.dataset.team)) return false;
    if (sel.pos.size && !Array.from(sel.pos).some(function (p) { return el.dataset.pos.indexOf('|' + p + '|') !== -1; })) return false;
    if (sel.rookie.size && el.dataset.rookie !== '1') return false;
    return true;
  }
  var empty = document.getElementById('pl-empty');
${view === 'stats' ? statsScript(isAdmin) : rostersScript()}
})();
</script>`;
}

function rostersScript() {
  return `
  var grid = document.getElementById('pl-grid');
  var cards = Array.from(grid.children);
  var sortSel = document.getElementById('pl-sort');
  var status = document.getElementById('pl-status');
  var people = Array.from(document.querySelectorAll('.pl-person, .pl-cchip'));
  var LABEL = { ppg: 'points per game', rpg: 'rebounds per game', apg: 'assists per game', num: 'jersey number', sortname: 'name' };
  function update() {
    var key = sortSel ? sortSel.value : 'ppg';
    var asc = key === 'num' || key === 'sortname';
    cards.sort(function (a, b) {
      if (key === 'sortname') return a.dataset.sortname.localeCompare(b.dataset.sortname);
      var d = parseFloat(a.dataset[key]) - parseFloat(b.dataset[key]);
      return asc ? d : -d;
    });
    var shown = 0;
    cards.forEach(function (c) { var ok = matches(c); c.hidden = !ok; if (ok) shown++; grid.appendChild(c); });
    empty.hidden = shown > 0;
    var filtered = q || sel.team.size || sel.pos.size || sel.rookie.size;
    status.textContent = (filtered ? 'Showing ' + shown + ' of ' + cards.length + ' rostered players' : 'Showing all ' + cards.length + ' rostered players') + ' · sorted by ' + LABEL[key];
    // Search reaches Alumni / Community too (team/position filters don't apply to them).
    people.forEach(function (p) {
      var extra = p.classList.contains('is-extra') && !p.classList.contains('is-open');
      p.hidden = q ? p.dataset.name.indexOf(q) === -1 : extra;
    });
  }
  if (sortSel) sortSel.addEventListener('change', update);
  var more = document.getElementById('pl-comm-more');
  if (more) more.addEventListener('click', function () {
    document.querySelectorAll('.pl-cchip.is-extra').forEach(function (c) { c.classList.add('is-open'); c.hidden = false; });
    more.remove();
  });`;
}

function statsScript(isAdmin) {
  return `
  var body = document.getElementById('pl-body');
  var rows = Array.from(body.children);
  var sortCol = null, sortDir = -1;
  function update() {
    var shown = 0;
    rows.forEach(function (r) { var ok = matches(r); r.hidden = !ok; if (ok) shown++; });
    empty.hidden = shown > 0;
  }
  // Column sorting. data-sort = index into the stat columns, or "name".
  var ths = Array.from(document.querySelectorAll('.pl-th__btn'));
  ths.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.sort;
      var defDir = key === 'name' || btn.dataset.low === '1' ? 1 : -1;
      sortDir = key === sortCol ? -sortDir : defDir;
      sortCol = key;
      var cell = key === 'name' ? 1 : parseInt(key, 10) + 4;
      rows.sort(function (a, b) {
        var av = a.children[cell].dataset.v, bv = b.children[cell].dataset.v;
        if (key === 'name') return av.localeCompare(bv) * sortDir;
        var x = parseFloat(av), y = parseFloat(bv);
        if (x === -1 && y !== -1) return 1;
        if (y === -1 && x !== -1) return -1;
        return (x - y) * sortDir;
      });
      rows.forEach(function (r, i) { body.appendChild(r); var rk = r.querySelector('.pl-rank'); if (rk) rk.textContent = i + 1; });
      document.querySelectorAll('.pl-th').forEach(function (t) { t.classList.remove('is-sorted', 'is-asc'); t.setAttribute('aria-sort', 'none'); });
      document.querySelectorAll('.pl-td.is-sorted').forEach(function (t) { t.classList.remove('is-sorted'); });
      var th = btn.closest('th');
      th.classList.add('is-sorted'); if (sortDir === 1) th.classList.add('is-asc');
      th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      if (key !== 'name') rows.forEach(function (r) { r.children[cell].classList.add('is-sorted'); });
    });
  });

  // ── Compare: tick two rows → tray → sheet with bars + the conyo take ──
  var picked = [];
  var tray = document.getElementById('pl-tray'), slots = document.getElementById('pl-tray-slots');
  var hint = document.getElementById('pl-tray-hint'), go = document.getElementById('pl-tray-go');
  var modal = document.getElementById('pl-modal'), mbody = document.getElementById('pl-modal-body');
  var SEASON = (new URLSearchParams(location.search)).get('season') || '';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function syncTray() {
    tray.hidden = picked.length === 0;
    slots.innerHTML = picked.map(function (r, i) {
      return '<span class="pl-tray__slot"><i class="pl-dot" style="background:' + r.dataset.color + '"></i>' + esc(r.dataset.display) +
        '<button type="button" data-i="' + i + '" aria-label="Remove ' + esc(r.dataset.display) + '">&times;</button></span>';
    }).join('');
    hint.hidden = picked.length === 2;
    go.disabled = picked.length !== 2;
    rows.forEach(function (r) { var on = picked.indexOf(r) !== -1; r.classList.toggle('is-picked', on); r.querySelector('.pl-pick').checked = on; });
  }
  body.addEventListener('change', function (e) {
    if (!e.target.classList.contains('pl-pick')) return;
    var r = e.target.closest('tr');
    var i = picked.indexOf(r);
    if (i !== -1) picked.splice(i, 1);
    else { if (picked.length === 2) picked.shift(); picked.push(r); }
    syncTray();
  });
  slots.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (!b) return; picked.splice(+b.dataset.i, 1); syncTray(); });
  document.getElementById('pl-tray-x').addEventListener('click', function () { picked = []; syncTray(); });
  go.addEventListener('click', openCompare);
  function closeModal(m) { m.hidden = true; document.body.classList.remove('pl-noscroll'); }
  document.getElementById('pl-modal-x').addEventListener('click', function () { closeModal(modal); });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(modal); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.pl-modal').forEach(function (m) { if (!m.hidden) closeModal(m); }); });

  var STATS = [['PPG', 'ppg'], ['RPG', 'rpg'], ['APG', 'apg'], ['SPG', 'spg'], ['BPG', 'bpg'], ['FG%', 'fgp', 1], ['3P%', 'tpp', 1], ['FT%', 'ftp', 1], ['TO', 'tpg', 0, 1]];
  function side(r, cls) {
    var d = r.dataset;
    return '<a href="/players/' + encodeURIComponent(d.id) + '" class="pl-cmp__who ' + cls + '">' +
      '<span class="pl-av pl-av--lg" style="--team:' + d.color + '"><span>' + esc(d.display.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()) + '</span>' +
      '<img src="/api/player/' + encodeURIComponent(d.id) + '/photo?w=192" alt="" onerror="this.remove()"></span>' +
      '<span class="pl-cmp__name">' + esc(d.display) + '</span><span class="pl-cmp__meta">' + esc(d.team || '') + (d.posl ? ' · ' + esc(d.posl) : '') + '</span></a>';
  }
  function fmt(v, p) { if (v === null || v === undefined) return '—'; return p ? Math.round(v * 100) + '%' : v.toFixed(1); }
  function openCompare() {
    if (picked.length !== 2) return;
    var a = picked[0], b = picked[1];
    var A = JSON.parse(a.dataset.cmp), B = JSON.parse(b.dataset.cmp);
    var bars = STATS.map(function (s) {
      var va = A[s[1]], vb = B[s[1]], x = va || 0, y = vb || 0, tot = x + y || 1;
      var aw = va !== null && vb !== null && (s[3] ? x < y : x > y), bw = va !== null && vb !== null && (s[3] ? y < x : y > x);
      return '<div class="pl-cmp__row"><span class="pl-cmp__v' + (aw ? ' is-win' : '') + '">' + fmt(va, s[2]) + '</span>' +
        '<span class="pl-cmp__track pl-cmp__track--a"><i style="width:' + Math.round(x / tot * 100) + '%;background:' + a.dataset.color + '"></i></span>' +
        '<span class="pl-cmp__k">' + s[0] + '</span>' +
        '<span class="pl-cmp__track"><i style="width:' + Math.round(y / tot * 100) + '%;background:' + b.dataset.color + '"></i></span>' +
        '<span class="pl-cmp__v pl-cmp__v--b' + (bw ? ' is-win' : '') + '">' + fmt(vb, s[2]) + '</span></div>';
    }).join('');
    mbody.innerHTML = '<div class="pl-cmp">' +
      '<div class="pl-cmp__heads">' + side(a, '') + '<span class="pl-cmp__vs font-condensed">VS</span>' + side(b, 'pl-cmp__who--b') + '</div>' +
      '<div class="pl-cmp__take"><div class="pl-cmp__takehead"><span class="stp-kicker">The conyo take</span>' +
      '<button type="button" class="pl-cmp__again" id="pl-cmp-again"><span class="pill-label">↺ Another take</span></button></div>' +
      '<p class="pl-cmp__text" id="pl-cmp-text" aria-live="polite">Writing…</p></div>' +
      '<div class="pl-cmp__bars">' + bars + '</div></div>';
    modal.hidden = false; document.body.classList.add('pl-noscroll');
    loadTake(a.dataset.id, b.dataset.id, false);
    document.getElementById('pl-cmp-again').addEventListener('click', function () { loadTake(a.dataset.id, b.dataset.id, true); });
  }
  var takeReq = 0;
  function loadTake(ida, idb, force) {
    var el = document.getElementById('pl-cmp-text'), btn = document.getElementById('pl-cmp-again');
    var my = ++takeReq;
    el.textContent = 'Writing…'; el.classList.add('is-loading'); btn.disabled = true;
    fetch('/api/compare?a=' + encodeURIComponent(ida) + '&b=' + encodeURIComponent(idb) + (SEASON ? '&season=' + encodeURIComponent(SEASON) : '') + (force ? '&force=1' : ''))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (my !== takeReq) return; el.textContent = d && d.writeup ? d.writeup : 'No take right now, try again in a bit.'; })
      .catch(function () { if (my === takeReq) el.textContent = 'No take right now, try again in a bit.'; })
      .then(function () { if (my === takeReq) { el.classList.remove('is-loading'); btn.disabled = false; } });
  }
${isAdmin ? adminScript() : ''}`;
}

function adminScript() {
  return `
  // ── Admin: edit a player from the table ──
  var em = document.getElementById('pl-edit-modal'), ef = document.getElementById('pl-edit-form');
  var emsg = document.getElementById('pl-edit-msg'), epid = document.getElementById('pl-edit-pid');
  body.addEventListener('click', function (e) {
    var btn = e.target.closest('.pl-edit'); if (!btn) return;
    e.preventDefault();
    var pos = []; try { pos = JSON.parse(btn.dataset.pos); } catch (err) {}
    epid.value = btn.dataset.pid;
    ef.first_name.value = btn.dataset.fn; ef.last_name.value = btn.dataset.ln;
    ef.number.value = btn.dataset.num; ef.status.value = btn.dataset.status;
    ef.querySelectorAll('[name=positions]').forEach(function (cb) { cb.checked = pos.indexOf(cb.value) !== -1; });
    emsg.hidden = true; em.hidden = false; document.body.classList.add('pl-noscroll');
  });
  document.getElementById('pl-edit-close').addEventListener('click', function () { closeModal(em); });
  em.addEventListener('click', function (e) { if (e.target === em) closeModal(em); });
  ef.addEventListener('submit', function (e) {
    e.preventDefault();
    var submit = document.getElementById('pl-edit-submit');
    var payload = {
      first_name: ef.first_name.value.trim(), last_name: ef.last_name.value.trim(),
      number: ef.number.value.trim(), status: ef.status.value,
      positions: Array.from(ef.querySelectorAll('[name=positions]:checked')).map(function (cb) { return cb.value; })
    };
    submit.disabled = true; submit.textContent = 'Saving…';
    fetch('/admin/player/' + encodeURIComponent(epid.value) + '/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { submit.textContent = 'Saved!'; setTimeout(function () { location.reload(); }, 600); return; }
        emsg.textContent = d.error || 'Something went wrong.'; emsg.hidden = false; submit.disabled = false; submit.textContent = 'SAVE CHANGES';
      })
      .catch(function () { emsg.textContent = 'Network error. Please try again.'; emsg.hidden = false; submit.disabled = false; submit.textContent = 'SAVE CHANGES'; });
  });`;
}
