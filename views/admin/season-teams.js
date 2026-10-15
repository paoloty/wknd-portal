// Team builder (GET /admin/season/teams) and its Sandbox (GET /admin/season/teams/sandbox),
// rebuilt on the admin UI kit 2026-10-15 from the TeamBuilder + Sandbox mockups. One board:
// the pool ("Not on a team") beside the team columns, a live balance strip, a sticky save
// bar. Drag with a mouse, or use Move on any player (keyboard and phones). Board behaviour:
// public/admin-team-builder.js. Styles: "Team builder" block at the end of public/admin.css.
import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { pageHeader, button, banner, avatar, drawer, menu, badge } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const EXTRA_COLORS = ['#3b82f6', '#b91c1c', '#e2e8f0', '#64748b', '#22c55e', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#eab308'];

const num = v => (v == null || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v)));
// Very dark team colours (Black) vanish on the navy admin, so their dots and avatar rings
// get a light outline. Rough luminance of a #rgb / #rrggbb colour, 0–1.
export function isDarkColor(c) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2;
}
const dot = c => `<span class="atb-dot${isDarkColor(c) ? ' is-dark' : ''}" style="background:${attr(c)}"></span>`;
// Adds the light outline to every dark avatar ring in a chunk of admin HTML (rings come from
// ui.js avatar() as "box-shadow:0 0 0 2px <colour>"). Used on the team builder, ledger and
// award graphic pages.
export function outlineDarkRings(html) {
  return String(html).replace(/box-shadow:0 0 0 2px (#[0-9a-f]{3}(?:[0-9a-f]{3})?)(?=[;"])/gi, (m, c) => (isDarkColor(c) ? `${m},0 0 0 3px rgba(255,255,255,.35)` : m));
}
const avg = (list, k) => { const v = list.map(p => p[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

// One shape for every pool source (sign-ups, sandbox sign-ups, a past season's players).
function normalise(p) {
  let positions = [];
  try { positions = JSON.parse(p.positions || '[]'); } catch { positions = []; }
  // Jersey sizes, labelled: "Size M" when top and shorts match, else "Top M · Shorts L".
  const top = String(p.jersey_top || '').trim(), shorts = String(p.jersey_shorts || '').trim();
  const sizes = top && top === shorts ? `Size ${top}` : [top && `Top ${top}`, shorts && `Shorts ${shorts}`].filter(Boolean).join(' · ');
  return {
    id: String(p.id),
    playerId: String(p.player_id || ''),
    name: signupDisplayName(p) || p.full_name || '—',
    pos: positions.filter(Boolean).slice(0, 2).join('/'),
    primary: positions[0] || '',
    ovr: num(p.rating), off: num(p.off_rating), def: num(p.def_rating),
    isNew: (p.career_games ?? 0) === 0,
    sizes,
    realTeam: p.real_team || '',
  };
}

// A player on the board. The same element sits in the pool or a team; CSS shows OFF/DEF in
// the pool and the × in a team.
function playerItem(p, color, locked) {
  const sub = [p.pos || 'No position', p.sizes].filter(Boolean).join(' · ');
  return `<li class="atb-p" data-id="${attr(p.id)}" data-name="${attr(p.name.toLowerCase())}" data-display="${attr(p.name)}" data-pos="${attr(p.primary)}" data-ovr="${p.ovr ?? ''}" data-off="${p.off ?? ''}" data-def="${p.def ?? ''}" data-real-team="${attr(p.realTeam)}"${locked ? '' : ' draggable="true"'}>
    <span class="atb-p__main"${locked ? '' : ` role="button" tabindex="0" data-atb-move aria-haspopup="menu" aria-label="Move ${attr(p.name)} to…"`}>${avatar(p.name, color, { size: 32, playerId: p.playerId })}<span class="atb-p__who"><span class="atb-p__name"><span class="atb-p__n">${escHtml(p.name)}</span>${p.isNew ? '<span class="atb-new">NEW</span>' : ''}</span><span class="atb-p__sub">${escHtml(sub)}</span></span></span>
    <b class="atb-num atb-p__ovr">${p.ovr ?? '–'}</b><span class="atb-num atb-p__off">${p.off ?? '–'}</span><span class="atb-num atb-p__def">${p.def ?? '–'}</span>
    ${locked ? '' : `<button type="button" class="atb-icon atb-p__move" data-atb-move aria-haspopup="menu" tabindex="-1" aria-hidden="true">Move</button>
    <button type="button" class="atb-icon atb-p__out" data-atb-out aria-label="Send ${attr(p.name)} back to the pool">×</button>`}
  </li>`;
}

function meters(players) {
  return `<div class="atb-meters">${[['OVR', 'ovr'], ['OFF', 'off'], ['DEF', 'def']].map(([l, k]) => {
    const v = avg(players, k);
    return `<div class="atb-meter" data-meter="${k}"><span>${l}</span><span class="atb-meter__track"><span class="atb-meter__fill${k === 'ovr' ? ' is-ovr' : ''}" style="width:${v ?? 0}%"></span></span><b class="atb-num">${v ?? '–'}</b></div>`;
  }).join('')}</div>`;
}

function teamCard(team, players, locked) {
  const sorted = players.slice().sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1));
  const opts = locked ? '' : `<details class="aui-menu"><summary class="aui-menu__btn" aria-label="${attr(team.name)} options">⋯</summary><div class="aui-menu__list" role="menu">
      <button type="button" role="menuitem" class="aui-menu__item" data-atb-edit>Rename or recolour…</button>
      <div class="aui-menu__sep" role="separator"></div>
      <button type="button" role="menuitem" class="aui-menu__item is-danger" data-atb-remove>Remove team…</button>
    </div></details>`;
  return `<article class="atb-team" data-team-id="${attr(team.id)}" data-color="${attr(team.color)}" data-name="${attr(team.name)}" aria-label="${attr(team.name)}">
    <div class="atb-team__head">${dot(team.color)}<b class="atb-team__name">${escHtml(team.name)}</b><span class="atb-team__count" data-count>${players.length} ${players.length === 1 ? 'player' : 'players'}</span>${opts}</div>
    ${meters(players)}
    <ul class="atb-list" data-atb-zone="${attr(team.id)}">${sorted.map(p => playerItem(p, team.color, locked)).join('')}${locked ? '' : '<li class="atb-drop" aria-hidden="true"><span class="atb-drop__drag">Drop players here</span><span class="atb-drop__tap">No players yet. Use Move on a player.</span></li>'}</ul>
  </article>`;
}

function poolPanel(pool, locked) {
  const sorted = pool.slice().sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1));
  return `<section class="atb-pool" aria-label="Not on a team">
    <div class="atb-pool__head">
      <div class="atb-pool__title"><b>Not on a team</b><span class="aui-badge aui-badge--amber" data-atb-pool-count>${pool.length}</span></div>
      <label class="aui-search atb-pool__search"><span class="aui-search__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M9.5 9.5 13 13"/></svg></span><input type="search" placeholder="Search players" aria-label="Search players" data-atb-search autocomplete="off"></label>
      <div class="atb-pos" role="group" aria-label="Filter by position">${POSITIONS.map(p => `<button type="button" aria-pressed="false" data-atb-pos="${p}">${p}</button>`).join('')}</div>
    </div>
    <div class="atb-cols" role="group" aria-label="Sort the pool">
      <button type="button" data-atb-sort="name">Player</button>
      <button type="button" data-atb-sort="ovr" class="is-on" aria-label="Sort by OVR">OVR <span aria-hidden="true">↓</span></button>
      <button type="button" data-atb-sort="off" aria-label="Sort by OFF">OFF</button>
      <button type="button" data-atb-sort="def" aria-label="Sort by DEF">DEF</button>
      ${locked ? '' : '<span aria-hidden="true"></span>'}
    </div>
    <ul class="atb-list atb-list--pool" data-atb-zone="">${sorted.map(p => playerItem(p, '', locked)).join('')}</ul>
    <p class="atb-pool__empty" data-atb-pool-empty${pool.length ? ' hidden' : ''}>Everyone is on a team.</p>
    <p class="atb-pool__empty" data-atb-pool-nomatch hidden>No one in the pool matches.</p>
  </section>`;
}

function swatches(colors) {
  return `<div class="atb-swatches" role="radiogroup" aria-label="Team colour">${colors.map((c, i) => `<label class="atb-swatch"><input type="radio" name="color" value="${attr(c)}"${i === 0 ? ' checked' : ''}><span style="background:${attr(c)}" aria-label="${attr(c)}"></span></label>`).join('')}</div>`;
}

export function adminSeasonTeamsBody({ sigSeason = '', players = [], teams = [], rosterMap = {}, draftStatus = '', isSandbox = false, sandboxSource = null, leagueTeams = [], rosterPublished = false, compare = null } = {}) {
  const locked = !isSandbox && draftStatus === 'started';
  const confirmed = players.filter(p => p.status === 'confirmed');
  const byTeam = {};
  const assigned = new Set();
  for (const t of teams) {
    byTeam[t.id] = (rosterMap[t.id] || []).map(normalise);
    byTeam[t.id].forEach(p => assigned.add(p.id));
  }
  const pool = confirmed.filter(p => !assigned.has(String(p.id))).map(normalise);
  const season = isSandbox ? (sandboxSource?.targetSeason || '') : sigSeason;
  const poolSeason = isSandbox ? (sandboxSource?.season || '') : sigSeason;
  // Once the rosters are published, every save shows on /my-team straight away.
  const PUBLISHED_LINE = 'Published: players see changes as soon as you save.';

  // Header
  const moreItems = isSandbox
    ? [{ label: 'Back to the team builder', href: '/admin/season/teams' },
       ...(compare?.season && !compare.started ? [{ label: 'Copy to the real builder…', copy: true }] : []),
       'sep',
       { label: 'Clear sandbox…', post: '/admin/season/teams/sandbox/clear', danger: true, done: 'Sandbox cleared.', confirm: { title: 'Clear the sandbox?', body: 'Removes every sandbox team and assignment. The real season isn’t touched.', send: 'Clear sandbox' } }]
    : [{ label: 'Open the sandbox', href: '/admin/season/teams/sandbox' },
       { label: 'Download jersey sizes (CSV)', href: `/admin/season/teams/export-jerseys?season=${encodeURIComponent(sigSeason)}` },
       ...(locked ? [{ label: 'Download charges (CSV)', href: `/admin/season/teams/export-charges?season=${encodeURIComponent(sigSeason)}` }] : [])];
  // menu() can't carry the copy action, so it gets its own item.
  let moreHtml = menu(moreItems.filter(i => !i.copy), 'More actions');
  if (moreItems.some(i => i.copy)) moreHtml = moreHtml.replace('<div class="aui-menu__sep"', '<button type="button" role="menuitem" class="aui-menu__item" data-atb-copy>Copy to the real builder…</button><div class="aui-menu__sep"');
  const actions = locked
    ? moreHtml
    : `${button('Auto-balance…', { attrs: 'data-atb-balance' })}${isSandbox ? '' : button('Review and start season →', { kind: 'primary', attrs: 'data-atb-review' })}${moreHtml}`;
  const header = isSandbox
    ? `<header class="aui-head">
        <div class="aui-head__text">
          <div class="aui-head__eyebrow atb-eyebrow">${poolSeason ? `Season ${escHtml(poolSeason)}` : 'Team builder'} ${badge('Sandbox', 'blue')}</div>
          <h1 class="aui-head__title">Try a team split</h1>
          <p class="aui-head__sub">Same board as the team builder. Nothing here touches the real season, its draft or anyone’s fees.</p>
        </div>
        <div class="aui-head__actions">${actions}</div>
      </header>`
    : pageHeader({
        eyebrow: `Season ${sigSeason}`,
        title: 'Team builder',
        sub: locked
          ? `${confirmed.length} confirmed sign-ups on ${teams.length} teams.`
          : `${confirmed.length} confirmed sign-ups. Drag players onto teams, or use Move. ${rosterPublished ? PUBLISHED_LINE : 'Nothing changes for players until you publish.'}`,
        actionsHtml: actions,
      });

  // Status (real season): Draft → Published → Started, with the publish switch beside it.
  let statusHtml = '';
  if (!isSandbox) {
    const hasDraft = teams.length > 0 && (draftStatus === 'draft' || draftStatus === 'started');
    const st = locked
      ? [hasDraft ? 'done' : 'next', rosterPublished ? 'done' : 'next', 'done']
      : [hasDraft ? 'done' : 'now', rosterPublished ? 'done' : (hasDraft ? 'now' : 'next'), rosterPublished ? 'now' : 'next'];
    const steps = [
      ['Draft', hasDraft ? 'Teams saved as a draft' : locked ? 'No teams drafted' : 'Not saved yet'],
      ['Published', 'Players see their team on /my-team'],
      ['Started', locked ? 'Fees charged, teams locked' : 'Season fees charged, builder locked'],
    ];
    statusHtml = `<div class="atb-status">
      <ol class="atb-steps" aria-label="Season status">${steps.map(([l, s], i) => `<li class="atb-step is-${st[i]}"${i === 1 ? ' data-atb-step-pub' : ''}${i === 2 ? ' data-atb-step-start' : ''}><span class="atb-step__mark" aria-hidden="true">${st[i] === 'done' ? '✓' : st[i] === 'now' ? '•' : ''}</span><span class="atb-step__text"><b>${escHtml(l)}</b><span>${escHtml(s)}</span></span></li>`).join('')}</ol>
      <div class="atb-pub"><span id="atb-pub-label">Published to players</span><button type="button" class="aui-switch" role="switch" aria-checked="${rosterPublished}" aria-labelledby="atb-pub-label" data-atb-publish><span></span></button></div>
    </div>`;
  }

  // Sandbox: where the pool comes from.
  let sourceHtml = '';
  if (isSandbox && sandboxSource) {
    const { source, season: srcSeason, gameSeasons = [], signupSeasons = [], targetSeason = '', otherPool = 0 } = sandboxSource;
    const sigOpts = [...new Set([targetSeason, ...signupSeasons].filter(Boolean).map(String))];
    const note = {
      signups: `Confirmed sign-ups for Season ${srcSeason}. Ratings: each player’s latest rating, the same numbers the real builder uses.`,
      waitlist: `Confirmed and waitlisted sign-ups for Season ${srcSeason}. Ratings: each player’s latest rating.`,
      players: `Everyone active, rated on their Season ${srcSeason} ratings (with overrides), so numbers can differ from the real builder.`,
    }[source];
    const seasonSelect = (list, label) => list.length > 1 || (list.length && !list.includes(String(srcSeason)))
      ? `<label class="atb-source__season"><span class="sr-only">${escHtml(label)}</span><select class="aui-input" data-atb-source-season aria-label="${attr(label)}">${list.map(s => `<option value="${attr(s)}"${String(s) === String(srcSeason) ? ' selected' : ''}>Season ${escHtml(s)}</option>`).join('')}</select></label>`
      : '';
    sourceHtml = `<section class="aui-panel atb-source" data-atb-source-panel data-source="${attr(source)}" data-season="${attr(srcSeason)}" data-target="${attr(targetSeason)}" data-latest-game-season="${attr(gameSeasons[0] || '')}">
      <div class="atb-source__text"><b>Who’s in the pool</b><span>${escHtml(note)}</span></div>
      <div class="atb-source__pick">
        <div class="aui-segmented" role="radiogroup" aria-label="Pool source">
          ${[['signups', 'Sign-ups'], ['waitlist', 'Sign-ups + waitlist'], ['players', 'A past season’s players']].map(([v, l]) => `<label><input type="radio" name="atb-source" value="${v}"${v === source ? ' checked' : ''} data-atb-source><span>${escHtml(l)}</span></label>`).join('')}
        </div>
        ${source === 'players' ? seasonSelect(gameSeasons.map(String), 'Season') : seasonSelect(sigOpts, 'Sign-up season')}
      </div>
    </section>
    ${otherPool ? banner('warn', `${otherPool} saved ${otherPool === 1 ? 'assignment is' : 'assignments are'} for players in another pool, so ${otherPool === 1 ? 'it isn’t' : 'they aren’t'} shown. Saving here replaces ${otherPool === 1 ? 'it' : 'them'}.`) : ''}`;
  }

  // Sandbox: compared with the real draft (by team name).
  const compareHtml = isSandbox && compare ? `<section class="atb-compare" aria-label="Sandbox vs the real draft">
      <div class="atb-compare__head"><b>Sandbox vs the real draft</b><span>${compare.season && (compare.teams || []).length ? `Team average OVR against Season ${escHtml(compare.season)}, matched by team name.` : 'There’s no real draft to compare with yet.'}</span></div>
      <div class="atb-compare__rows" data-atb-compare></div>
      <p class="atb-compare__foot" data-atb-compare-foot></p>
    </section>` : '';

  const colors = [...new Set([...leagueTeams.map(t => t.color), ...teams.map(t => t.color), ...EXTRA_COLORS].filter(c => /^#[0-9a-f]{3,8}$/i.test(c || '')).map(c => c.toLowerCase()))].slice(0, 12);
  const used = new Set(teams.map(t => (t.color || '').toLowerCase()));
  const firstFree = colors.find(c => !used.has(c)) || colors[0];
  const colorList = [firstFree, ...colors.filter(c => c !== firstFree)];

  const emptyTeams = !teams.length ? `<div class="atb-noteams">
      ${locked ? '' : '<b>No teams yet</b>'}
      <span>${locked ? 'No teams were drafted this season.' : !isSandbox && leagueTeams.length ? `Start from the league’s ${leagueTeams.length} teams, or add your own.` : 'Add a team to start the split.'}</span>
      ${!isSandbox && leagueTeams.length && !locked ? `<div class="atb-noteams__league">${leagueTeams.map(t => `<span class="atb-chip">${dot(t.color)}${escHtml(t.name)}</span>`).join('')}</div>${button(`Use these ${leagueTeams.length} teams`, { kind: 'primary', size: 'sm', attrs: 'data-atb-seed' })}` : ''}
    </div>` : '';

  const board = `<div class="atb-board${locked ? ' is-locked' : ''}">
      <div class="atb-side">${compareHtml}${poolPanel(pool, locked)}</div>
      <section class="atb-teams" aria-label="Teams">
        ${emptyTeams}
        ${teams.map(t => teamCard(t, byTeam[t.id] || [], locked)).join('')}
        ${locked ? '' : '<button type="button" class="atb-add" data-atb-add><span aria-hidden="true">＋</span> Add a team</button>'}
      </section>
    </div>`;

  const balance = locked ? '' : `<div class="atb-balance" data-atb-balance-strip>${[['OVR spread', 'ovr'], ['OFF spread', 'off'], ['DEF spread', 'def'], ['Roster sizes', 'size']].map(([l, k]) => `<div class="atb-balance__cell" data-spread="${k}"><span class="atb-balance__label">${escHtml(l)}</span><span class="atb-balance__row"><b class="atb-num">–</b><span class="atb-balance__note"></span></span></div>`).join('')}</div>`;

  const saveBar = locked ? '' : `<div class="aui-savebar atb-savebar" data-atb-savebar hidden>
      <span><b data-atb-dirty>Unsaved changes</b> · <span data-atb-savenote>${isSandbox ? 'saves to the sandbox only' : rosterPublished ? PUBLISHED_LINE : 'saved as a draft; players see nothing until you publish'}</span></span>
      <div class="aui-savebar__actions"><button type="button" class="aui-btn aui-btn--ghost" data-atb-discard>Discard</button><button type="button" class="aui-btn aui-btn--primary" data-atb-save>${isSandbox ? 'Save sandbox' : 'Save draft'}</button></div>
    </div>`;

  const teamDrawer = locked ? '' : drawer({
    id: 'atb-team-drawer',
    eyebrow: isSandbox ? 'Sandbox' : `Season ${sigSeason}`,
    title: 'Add a team',
    bodyHtml: `<form id="atb-team-form" class="aui-stack" data-atb-team-form novalidate>
        <input type="hidden" name="team_id" value="">
        <label class="aui-field"><span class="aui-field__label">Team name</span><input class="aui-input" name="name" maxlength="40" autocomplete="off" required placeholder="e.g. Blue"></label>
        <div class="aui-field"><span class="aui-field__label">Colour</span>${swatches(colorList)}<span class="aui-field__help">Shown as the team’s dot and avatar rings.</span></div>
      </form>`,
    footerHtml: `<button type="button" class="aui-btn aui-btn--ghost" data-drawer-close>Cancel</button><button type="submit" form="atb-team-form" class="aui-btn aui-btn--primary" data-atb-team-submit>Add team</button>`,
  });

  const config = { season: sigSeason, sandbox: isSandbox, locked, published: !isSandbox && !!rosterPublished, targetSeason: season, real: compare?.teams || [] };

  return outlineDarkRings(`<div class="aui-page atb" id="atb" data-config="${attr(JSON.stringify(config))}">
    ${header}
    ${locked ? banner('ok', 'Season started — teams are locked. Fees were charged against this draft, so it can’t be changed here.') : ''}
    ${statusHtml}
    ${sourceHtml}
    ${balance}
    ${board}
    ${saveBar}
    ${teamDrawer}
  </div>
  <script src="/admin-team-builder.js" defer></script>`);
}
