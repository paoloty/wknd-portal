import { escHtml, pageHeader } from './layout.js';
import { teamColor } from './utils.js';
import { calledItCard, pickAvatar, FLAME, dot, tc, dayLabel, shortDayLabel } from './games.js';

// ── /picks — the full "Who wins?" record for a season ─────────────────────────
// Data comes from server.js (/picks, /picks/players/:id) → lib/picks.js. Class prefix pkp-;
// the game-day cards and avatars are the same pk- components /games uses.

const playerHref = (id, season) => `/picks/players/${encodeURIComponent(id)}?season=${encodeURIComponent(season)}`;

function seasonTabs(seasons, season, base) {
  if (seasons.length < 2) return '';
  return `<nav class="gr-segs" aria-label="Season">${seasons.map(s => `<a href="${base}?season=${encodeURIComponent(s)}" class="gr-seg${s === season ? ' is-on' : ''}"${s === season ? ' aria-current="page"' : ''}>Season ${escHtml(s)}</a>`).join('')}</nav>`;
}

function statTiles({ callers, upsets, pickers, ranked, minPicks, oddsOn }) {
  const rec = r => (r.of ? `${r.called} of ${r.of}` : '—');
  const tile = (label, value, sub, accent = false) => `<div class="gr-tile${accent ? ' gr-tile--accent' : ''}">
      <span class="gr-tile__lbl">${label}</span>
      <b class="gr-tile__val font-condensed">${value}</b>
      <span class="gr-tile__sub">${sub}</span>
    </div>`;
  const oddsMisses = callers.odds.of - callers.odds.called;
  return `<div class="gr-tiles pkp-tiles">
    ${oddsOn ? tile('Odds record', rec(callers.odds), callers.odds.of ? (oddsMisses && oddsMisses === upsets.length ? `${oddsMisses === 1 ? 'The miss was an upset' : 'Every miss was an upset'}` : 'Favourite won') : 'After the first game day', true) : ''}
    ${tile('Fans record', rec(callers.fans), callers.fans.of ? `Majority pick won ${Math.round((callers.fans.called / callers.fans.of) * 100)}% of the time` : 'After the first game day', !oddsOn)}
    ${oddsOn ? tile('Upsets', String(upsets.length), upsets.length ? upsets.slice(0, 2).map(u => `${escHtml(tc(u.game.winner === 'a' ? u.game.a : u.game.b))} over ${escHtml(tc(u.game.winner === 'a' ? u.game.b : u.game.a))}`).join(' · ') : 'Underdog wins show here') : ''}
    ${tile('Pickers', String(pickers), `${ranked} ranked · min ${minPicks} picks`)}
  </div>`;
}

function raceRow(r, season, viewerId) {
  return `<a href="${playerHref(r.playerId, season)}" class="pkp-lb${r.rank === 1 ? ' is-top' : ''}${r.playerId === viewerId ? ' is-me' : ''}" data-picks-player>
      <span class="pkp-lb__rank font-condensed">${r.rank}</span>
      ${pickAvatar({ id: r.playerId, name: r.name, team: r.team }, 32, false)}
      <span class="pkp-lb__nm"><b>${escHtml(r.name)}${r.playerId === viewerId ? ' · You' : ''}</b><span>${r.team ? `${dot(r.team, 6)}${escHtml(tc(r.team))}` : ''}${r.upsets ? ` · ${r.upsets} upset${r.upsets === 1 ? '' : 's'}` : ''}</span></span>
      <span class="pkp-lb__wl font-condensed">${r.correct}–${r.picks - r.correct}</span>
      <span class="pkp-lb__pct">${r.pct}%</span>
      <span class="pkp-lb__run${r.streak >= 2 ? '' : ' is-zero'}">${FLAME}${r.streak}</span>
    </a>`;
}

function racePanel({ board, unranked, minPicks, season, viewerId }) {
  const SHOW = 10;
  const rows = board.length
    ? `<div class="pkp-lb__head" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>W–L</span><span>Pct</span><span>Run</span></div>
      <div class="pkp-lb__list${board.length > SHOW ? ' is-capped' : ''}" data-race>${board.map((r, i) => (i === SHOW ? '<div class="pkp-lb__rest">' : '') + raceRow(r, season, viewerId)).join('')}${board.length > SHOW ? '</div>' : ''}</div>
      ${board.length > SHOW ? `<button type="button" class="gm-more pkp-lb__all" data-race-all aria-expanded="false">Show all ${board.length}</button>` : ''}`
    : `<p class="pk-lb__empty">Rankings start once players have ${minPicks} picks settled.</p>`;
  const waiting = unranked.length ? `<div class="pkp-sub">
      <div class="pkp-sub__lbl">Not ranked yet · need ${minPicks} picks</div>
      ${unranked.slice(0, 8).map(u => `<a href="${playerHref(u.id, season)}" class="pkp-sub__row" data-picks-player><span>${dot(u.team, 6)}${escHtml(u.name)}${u.id === viewerId ? ' · You' : ''}</span><i>${u.picks} pick${u.picks === 1 ? '' : 's'} · ${u.need} more to rank</i></a>`).join('')}
      ${unranked.length > 8 ? `<p class="pkp-sub__more">+${unranked.length - 8} more</p>` : ''}
    </div>` : '';
  return `<section class="pk-board pkp-race" aria-labelledby="pkp-race-h">
      <div class="pk-board__head"><h2 id="pkp-race-h">Pickmaster race · S${escHtml(season)}</h2><span>${board.length} ranked</span></div>
      ${rows}
      ${waiting}
      <p class="pk-board__foot">Best pick record at season's end wins the <b>Pickmaster</b> award. Ties break on most correct, then upsets called.</p>
    </section>`;
}

function upsetsPanel(upsets, season) {
  if (!upsets.length) return '';
  return `<section class="pk-board pkp-upsets" aria-labelledby="pkp-up-h">
      <div class="pk-board__head"><h2 id="pkp-up-h">Upsets · S${escHtml(season)}</h2><span>Underdog won</span></div>
      ${upsets.map(s => {
        const g = s.game, w = g.winner === 'a' ? g.a : g.b, l = g.winner === 'a' ? g.b : g.a;
        const shown = s.calledIt.slice(0, 3);
        return `<a href="/games/${encodeURIComponent(g.id)}" class="pkp-up">
          <span class="pkp-up__pct font-condensed">${g.winner === 'a' ? g.odds.pctA : g.odds.pctB}%</span>
          <span class="pkp-up__txt"><span><b>${escHtml(tc(w))}</b> beat ${escHtml(tc(l))} ${Math.max(g.sa, g.sb)}–${Math.min(g.sa, g.sb)}</span><i>${escHtml(shortDayLabel(g.ymd))} · ${s.calledIt.length} called it</i></span>
          <span class="pkp-up__avs">${shown.map(p => pickAvatar(p, 26, false)).join('')}</span>
        </a>`;
      }).join('')}
    </section>`;
}

function gameDays(days, isPlayer) {
  if (!days.length) return '<div class="card pk-empty">No settled picks yet this season — results show here after each game day.</div>';
  return days.map((d, i) => `<div class="pkp-day">
      <h3 class="pkp-day__h">${escHtml(dayLabel(d.ymd))}${i === 0 ? ' <span>Latest</span>' : ''}</h3>
      <div class="pk-cards${d.games.length === 1 ? ' pk-cards--one' : ''}">${d.games.map(s => calledItCard(s, isPlayer)).join('')}</div>
    </div>`).join('');
}

export function picksPage({ season, seasons, days, board, unranked, minPicks, callers, upsets, pickers, oddsOn, isPlayer, viewerId }) {
  return `<div class="page-content pkp-page">
${pageHeader({
    title: 'Who wins? picks',
    description: `Every call, the Pickmaster race${oddsOn ? ', and how the odds are doing' : ''}. <a href="/games" class="pkp-back">Make this week's picks →</a>`,
    actions: seasonTabs(seasons, season, '/picks'),
  })}
${statTiles({ callers, upsets, pickers, ranked: board.length, minPicks, oddsOn })}
<div class="pkp-tabs" role="tablist" aria-label="Picks sections">
  <button type="button" class="pkp-tab is-on" role="tab" aria-selected="true" data-pkp-tab="race">Pickmaster race</button>
  <button type="button" class="pkp-tab" role="tab" aria-selected="false" data-pkp-tab="days">Game days</button>
</div>
<div class="pkp-grid">
  <section class="pkp-days" data-pkp-panel="days" aria-labelledby="pkp-days-h">
    <div class="section-header"><h2 id="pkp-days-h">Game days <span class="section-header__sub">Newest first</span></h2></div>
    ${gameDays(days, isPlayer)}
  </section>
  <aside class="pkp-side" data-pkp-panel="race">
    ${racePanel({ board, unranked, minPicks, season, viewerId })}
    ${upsetsPanel(upsets, season)}
  </aside>
</div>
<dialog class="pkp-dialog" aria-label="Player picks"><div class="pkp-dialog__in" data-pkp-sheet></div></dialog>
</div>
${picksScript()}`;
}

// ── One player's picks ───────────────────────────────────────────────────────
export function picksPlayerSheet({ player, season, record, rank, ranked, minPicks, rows, isSelf, oddsOn }) {
  const col = teamColor(player.team);
  const strip = record ? record.results.map(r => `<span class="${r.correct ? 'is-hit' : ''}" title="${r.correct ? 'Called it' : 'Missed'}"></span>`).join('') : '';
  const rankLine = rank
    ? `#${rank} of ${ranked} · Pickmaster race · S${escHtml(season)}`
    : record ? `${Math.max(0, minPicks - record.picks)} more pick${minPicks - record.picks === 1 ? '' : 's'} to get ranked` : `No settled picks in Season ${escHtml(season)}`;
  const rowHtml = rows.length ? rows.map(r => {
    const g = r.g;
    const picked = r.side ? tc(r.side === 'a' ? g.a : g.b) : null;
    const verdict = r.state === 'ok' ? '<span class="pk-ok">Called it</span>' : r.state === 'miss' ? '<span class="pk-miss">Missed</span>' : '<span class="pkp-open">Open</span>';
    const score = r.state === 'open' ? 'vs' : `${g.sa}–${g.sb}`;
    const oddsTxt = oddsOn && r.pickPct != null ? ` · odds gave them ${r.pickPct}%` : '';
    return `<a href="/games/${encodeURIComponent(g.id)}" class="pkp-row">
        <span class="pkp-row__when">${escHtml(shortDayLabel(g.ymd))}</span>
        <span class="pkp-row__mu">
          <b>${dot(g.a, 7)}${escHtml(tc(g.a))} <i>${score}</i> ${escHtml(tc(g.b))}${dot(g.b, 7)}${r.upset ? '<span class="pkp-row__upset">Upset</span>' : ''}</b>
          <span>${picked ? `Picked <em>${escHtml(picked)}</em>${oddsTxt}` : 'Pick hidden until the final'}</span>
        </span>
        ${verdict}
      </a>`;
  }).join('') : `<p class="pkp-row__empty">${isSelf ? "You haven't" : `${escHtml(player.name)} hasn't`} made any picks in Season ${escHtml(season)}.</p>`;

  return `<div class="pkp-sheet">
  <div class="pkp-sheet__top" style="--team:${col}">
    <button type="button" class="pkp-sheet__x" data-pkp-close aria-label="Close">×</button>
    <div class="pkp-sheet__who">
      ${pickAvatar({ id: player.id, name: player.name, team: player.team }, 56, false)}
      <div>
        <div class="pkp-sheet__rank">${rankLine}</div>
        <div class="pkp-sheet__name">${escHtml(player.name)}${isSelf ? ' · You' : ''}</div>
        <div class="pkp-sheet__team">${player.team ? `${dot(player.team, 7)}${escHtml(tc(player.team))} · ` : ''}<a href="/players/${encodeURIComponent(player.slug)}">Profile →</a></div>
      </div>
    </div>
    ${record ? `<div class="pkp-sheet__stats">
      <div><b class="font-condensed is-amber">${record.correct}–${record.picks - record.correct}</b><span>Record</span></div>
      <div><b class="font-condensed">${record.pct}%</b><span>Pct</span></div>
      <div><b class="font-condensed">${record.streak}</b><span>Streak</span></div>
      <div><b class="font-condensed">${record.upsets}</b><span>Upsets</span></div>
    </div>
    <div class="pkp-sheet__strip-lbl">Every pick, oldest → newest</div>
    <div class="pkp-sheet__strip">${strip}</div>` : ''}
  </div>
  <div class="pkp-sheet__list">
    <div class="pkp-sheet__list-lbl">Picks · newest first</div>
    ${rowHtml}
    <p class="pkp-sheet__note">${isSelf ? 'Your open picks are only visible to you until the final.' : 'Picks on games not played yet stay private until the final.'}</p>
  </div>
</div>`;
}

export function picksPlayerPage(props) {
  return `<div class="page-content pkp-page pkp-page--player">
  <p class="pkp-crumb"><a href="/picks?season=${encodeURIComponent(props.season)}">← All picks · Season ${escHtml(props.season)}</a></p>
  ${seasonTabs(props.seasons, props.season, `/picks/players/${encodeURIComponent(props.player.id)}`)}
  <div class="pkp-sheet-wrap">${picksPlayerSheet(props)}</div>
</div>`;
}

function picksScript() {
  return `<script>
(function () {
  // Phone: Race / Game days tabs (both columns show side by side on desktop).
  var tabs = document.querySelectorAll('[data-pkp-tab]');
  function show(name) {
    tabs.forEach(function (t) { var on = t.dataset.pkpTab === name; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('[data-pkp-panel]').forEach(function (p) { p.classList.toggle('is-hidden-sm', p.dataset.pkpPanel !== name); });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.pkpTab); }); });
  show('race');

  // Race: first 10, then "Show all".
  var all = document.querySelector('[data-race-all]');
  if (all) all.addEventListener('click', function () {
    var list = document.querySelector('[data-race]');
    var open = list.classList.toggle('is-open');
    all.setAttribute('aria-expanded', open ? 'true' : 'false');
    all.textContent = open ? 'Show top 10' : all.dataset.label || all.textContent;
  });
  if (all) all.dataset.label = all.textContent;

  // A player's picks open in a sheet; the link still works as a normal page without JS.
  var dlg = document.querySelector('.pkp-dialog'), sheet = document.querySelector('[data-pkp-sheet]');
  if (!dlg || !dlg.showModal) return;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-picks-player]');
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      fetch(a.href + (a.href.indexOf('?') < 0 ? '?' : '&') + 'partial=1')
        .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
        .then(function (html) { sheet.innerHTML = html; dlg.showModal(); })
        .catch(function () { window.location.href = a.href; });
      return;
    }
    if (e.target.closest('[data-pkp-close]') || e.target === dlg) dlg.close();
  });
})();
</script>`;
}
