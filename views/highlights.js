import { escHtml } from './layout.js';
import { pageHead } from './leaders.js';
import { potgCard } from './games.js';

// /highlights: every Player of the Game, newest first, grouped by season. Each one is the
// shared player card from the /games POTG row (potgCard) with the POTG writeup added.
// Season + Team dropdowns are a plain GET form (the page reloads on change).
// items: buildPotgMarquee() output (server.js); seasons: every season with a POTG.
export function highlightsPage({ items = [], seasons = [], teams = [], season = '', team = '' } = {}) {
  const field = (name, label, value, options) => `<label class="ld-field">
      <span class="ld-field__k">${label}</span>
      <select name="${name}" class="ld-field__select" onchange="this.form.submit()">
        ${options.map(o => `<option value="${escHtml(o.value)}"${o.value === value ? ' selected' : ''}>${escHtml(o.label)}</option>`).join('')}
      </select>
    </label>`;
  const bar = `<form class="hl-bar" action="/highlights" method="get">
    ${field('season', 'Season', season, [{ value: '', label: 'All seasons' }, ...seasons.map(s => ({ value: String(s), label: `Season ${s}` }))])}
    ${field('team', 'Team', team, [{ value: '', label: 'All teams' }, ...teams.map(t => ({ value: t, label: t }))])}
    <noscript><button type="submit" class="ld-bar__go">Go</button></noscript>
  </form>`;

  const groups = [];
  for (const p of items) {
    const key = String(p.season);
    let g = groups.find(x => x.season === key);
    if (!g) groups.push(g = { season: key, items: [] });
    g.items.push(p);
  }
  const body = groups.length
    ? groups.map(g => `<section class="hl-sec" aria-labelledby="hl-s${escHtml(g.season)}">
    <div class="section-header"><h2 id="hl-s${escHtml(g.season)}">Season ${escHtml(g.season)} <span class="section-header__sub">${g.items.length} ${g.items.length === 1 ? 'spotlight' : 'spotlights'}</span></h2></div>
    <div class="hl-grid">${g.items.map(p => potgCard(p, { writeup: true })).join('')}</div>
  </section>`).join('')
    : `<div class="card hl-empty">${season || team ? 'No Player of the Game spotlights for this selection.' : 'No highlights yet. Check back after the next game!'}</div>`;

  return `<div class="page-content hl-page">
  <div class="hl-head">
    ${pageHead({ kicker: 'Player of the Game', title: 'Highlights', meta: 'Every Player of the Game spotlight, newest first.' })}
    ${bar}
  </div>
  ${body}
</div>`;
}
