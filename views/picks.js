import { escHtml, pageHeader } from './layout.js';
import { teamColor } from './utils.js';
import { calledItCard, pickAvatar, FLAME, dot, tc, dayLabel, shortDayLabel, matchupCard, matchupScript } from './games.js';
import { openPickCard, pickBoxScript, pickProgress, fmtCloseTime, previewHref } from './pick-box.js';
import { fmtPts } from '../lib/picks.js';

// This week's games, pickable right here (same pick box as /games, the homepage and profile).
function openPicksSection(open, { isPlayer, closeTime }) {
  if (!open.length) return '';
  const day = open[0].ymd;
  const allClosed = open.every(o => o.closed);
  return `<section class="pkp-now" aria-labelledby="pkp-now-h">
    <div class="pkp-now__head">
      <h2 id="pkp-now-h">${allClosed ? 'Picks are in' : 'Open picks'} <span>${escHtml(dayLabel(day))} · ${allClosed ? 'results after the final' : `close ${escHtml(fmtCloseTime(closeTime))} on game day`}</span></h2>
      ${isPlayer ? pickProgress(open, '.pkp-now') : ''}
    </div>
    <div class="pkp-now__grid${open.length === 1 ? ' is-one' : ''}">
      ${open.map(o => openPickCard(o, { isPlayer, next: '/picks', size: 'lg' })).join('')}
    </div>
  </section>`;
}

// ── /picks — the full "Who wins?" record for a season ─────────────────────────
// Data comes from server.js (/picks, /picks/players/:id) → lib/picks.js. Class prefix pkp-;
// the game-day cards and avatars are the same pk- components /games uses.

const playerHref = (id, season) => `/picks/players/${encodeURIComponent(id)}?season=${encodeURIComponent(season)}`;

function seasonTabs(seasons, season, base) {
  if (seasons.length < 2) return '';
  return `<nav class="gr-segs" aria-label="Season">${seasons.map(s => `<a href="${base}?season=${encodeURIComponent(s)}" class="gr-seg${s === season ? ' is-on' : ''}"${s === season ? ' aria-current="page"' : ''}>Season ${escHtml(s)}</a>`).join('')}</nav>`;
}

function statTiles({ callers, upsets, pickers, ranked, oddsOn }) {
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
    ${tile('Pickers', String(pickers), ranked ? `${ranked} on the board` : 'On the board after their first final')}
  </div>`;
}

const fmtOdds = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}`;

// Movement since the game day before: ▲2 / ▼1 (nothing for no change or a first game day).
const trendHtml = t => (t > 0 ? `<i class="pkp-lb__tr is-up">▲${t}</i>` : t < 0 ? `<i class="pkp-lb__tr is-down">▼${-t}</i>` : '');

function raceRow(r, season, viewerId) {
  const sub = [
    r.team ? `${dot(r.team, 6)}${escHtml(tc(r.team))}` : '',
    r.weekPicks ? `${fmtPts(r.week)} this week` : '',
  ].filter(Boolean).join(' · ');
  return `<a href="${playerHref(r.playerId, season)}" class="pkp-lb${r.rank === 1 ? ' is-top' : ''}${r.playerId === viewerId ? ' is-me' : ''}" data-picks-player>
      <span class="pkp-lb__rank font-condensed">${r.rank}</span>
      ${pickAvatar({ id: r.playerId, name: r.name, team: r.team }, 32, false)}
      <span class="pkp-lb__nm"><b>${escHtml(r.name)}${r.playerId === viewerId ? ' · You' : ''}</b><span>${sub}${trendHtml(r.trend)}</span></span>
      <span class="pkp-lb__rec">${r.correct}–${r.wrong}</span>
      <span class="pkp-lb__pts font-condensed">${fmtPts(r.net)}</span>
      <span class="pkp-lb__run${r.streak >= 2 ? '' : ' is-zero'}">${FLAME}${r.streak}</span>
    </a>`;
}

function oddsRow(r, season, viewerId) {
  return `<a href="${playerHref(r.playerId, season)}" class="pkp-lb${r.oddsRank === 1 ? ' is-top' : ''}${r.playerId === viewerId ? ' is-me' : ''}" data-picks-player>
      <span class="pkp-lb__rank font-condensed">${r.oddsRank}</span>
      ${pickAvatar({ id: r.playerId, name: r.name, team: r.team }, 32, false)}
      <span class="pkp-lb__nm"><b>${escHtml(r.name)}${r.playerId === viewerId ? ' · You' : ''}</b><span>${r.team ? `${dot(r.team, 6)}${escHtml(tc(r.team))}` : ''}${r.upsets ? ` · ${r.upsets} upset${r.upsets === 1 ? '' : 's'}` : ''}</span></span>
      <span class="pkp-lb__rec">${r.correct}–${r.wrong}</span>
      <span class="pkp-lb__pts font-condensed">${fmtOdds(r.oddsPts)}</span>
      <span class="pkp-lb__run is-zero"></span>
    </a>`;
}

function boardList(rows, rowFn, { name, season, viewerId, hidden = false }) {
  const SHOW = 10;
  return `<div data-race-board="${name}"${hidden ? ' hidden' : ''}>
      <div class="pkp-lb__head" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>W–L</span><span>Pts</span><span>${name === 'pts' ? 'Run' : ''}</span></div>
      <div class="pkp-lb__list${rows.length > SHOW ? ' is-capped' : ''}">${rows.map((r, i) => (i === SHOW ? '<div class="pkp-lb__rest">' : '') + rowFn(r, season, viewerId)).join('')}${rows.length > SHOW ? '</div>' : ''}</div>
      ${rows.length > SHOW ? `<button type="button" class="gm-more pkp-lb__all" data-race-all aria-expanded="false">Show all ${rows.length}</button>` : ''}
    </div>`;
}

function racePanel({ board, oddsBoard, season, viewerId }) {
  const body = board.length
    ? `<div class="pkp-boards" role="group" aria-label="Leaderboard">
        <button type="button" class="pkp-boards__b is-on" data-race-show="pts" aria-pressed="true">Pickmaster</button>
        <button type="button" class="pkp-boards__b" data-race-show="odds" aria-pressed="false">Beat the Odds</button>
      </div>
      ${boardList(board, raceRow, { name: 'pts', season, viewerId })}
      ${boardList(oddsBoard, oddsRow, { name: 'odds', season, viewerId, hidden: true })}`
    : '<p class="pk-lb__empty">The board fills after the first game day\'s finals. Every settled pick counts.</p>';
  return `<section class="pk-board pkp-race" aria-labelledby="pkp-race-h">
      <div class="pk-board__head"><h2 id="pkp-race-h">Pickmaster race · S${escHtml(season)}</h2><span>${board.length} on the board</span></div>
      ${body}
      <div class="pk-board__foot">
        <p data-race-foot="pts">Most points at season's end wins the <b>Pickmaster</b> award: <b>+1</b> for a correct pick, <b>−1</b> for a miss, <b>0</b> for a game you sit out.</p>
        <p data-race-foot="odds" hidden>Bragging rights, no prize. A correct pick on the side the odds doubted earns more (up to +1.30); a miss on the side they backed costs more. Games without odds count ±1.</p>
        <details class="pkp-ties">
          <summary>How ties are broken</summary>
          <p>Players level on points share a rank during the season. For the award, a tie at the end goes down this list until it's settled:</p>
          <ol>
            <li><b>Head-to-head</b>: on games where the tied players picked opposite sides, who was right more often</li>
            <li><b>More correct picks</b>: 10–4 beats 7–1</li>
            <li><b>Longest streak</b> of correct picks (a skipped game doesn't break it)</li>
            <li><b>Beat the Odds</b> points</li>
            <li><b>Finals margin guess</b>: closest guess of Finals Game 1's winning margin</li>
            <li>Still level: <b>co-Pickmasters</b></li>
          </ol>
          <p>When three or more are tied, anyone a step separates is placed, and whoever is still level starts again at head-to-head.</p>
        </details>
        <a class="pkp-rules-link" href="/picks/rules">Full Pickmaster rules →</a>
      </div>
    </section>`;
}

function upsetsPanel(upsets, season) {
  if (!upsets.length) return '';
  return `<section class="pk-board pkp-upsets" aria-labelledby="pkp-up-h">
      <div class="pk-board__head"><h2 id="pkp-up-h">Upsets · S${escHtml(season)}</h2><span>Underdog won</span></div>
      ${upsets.map(s => {
        const g = s.game, w = g.winner === 'a' ? g.a : g.b, l = g.winner === 'a' ? g.b : g.a;
        const shown = s.calledIt.slice(0, 3);
        return `<a href="${escHtml(previewHref(g))}" class="pkp-up">
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

export function picksPage({ season, seasons, days, board, oddsBoard = [], callers, upsets, pickers, oddsOn, isPlayer, viewerId, open = [], closeTime = '06:00' }) {
  return `<div class="page-content pkp-page">
${pageHeader({
    title: 'Who wins? picks',
    description: `${open.length ? `Make this week's picks, then follow every call and the Pickmaster race${oddsOn ? ' — and how the odds are doing' : ''}.` : `Every call, the Pickmaster race${oddsOn ? ', and how the odds are doing' : ''}.`} <a href="/picks/rules" class="pkp-rules-link">How scoring works →</a>`,
    actions: seasonTabs(seasons, season, '/picks'),
  })}
${openPicksSection(open, { isPlayer, closeTime })}
${statTiles({ callers, upsets, pickers, ranked: board.length, oddsOn })}
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
    ${racePanel({ board, oddsBoard, season, viewerId })}
    ${upsetsPanel(upsets, season)}
  </aside>
</div>
<dialog class="pkp-dialog" aria-label="Player picks"><div class="pkp-dialog__in" data-pkp-sheet></div></dialog>
</div>
${open.length ? pickBoxScript() : ''}
${picksScript()}`;
}

// ── One player's picks ───────────────────────────────────────────────────────
export function picksPlayerSheet({ player, season, record, rank, ranked, rows, isSelf, oddsOn }) {
  const col = teamColor(player.team);
  const strip = record ? record.results.map(r => `<span class="${r.correct ? 'is-hit' : ''}" title="${r.correct ? 'Called it' : 'Missed'}"></span>`).join('') : '';
  const rankLine = rank
    ? `#${rank} of ${ranked} · Pickmaster race · S${escHtml(season)}`
    : `No settled picks in Season ${escHtml(season)}`;
  const rowHtml = rows.length ? rows.map(r => {
    const g = r.g;
    const picked = r.side ? tc(r.side === 'a' ? g.a : g.b) : null;
    const verdict = r.state === 'ok' ? '<span class="pk-ok">Called it</span>' : r.state === 'miss' ? '<span class="pk-miss">Missed</span>' : '<span class="pkp-open">Open</span>';
    const score = r.state === 'open' ? 'vs' : `${g.sa}–${g.sb}`;
    const oddsTxt = oddsOn && r.pickPct != null ? ` · odds gave them ${r.pickPct}%` : '';
    return `<a href="${escHtml(previewHref(g))}" class="pkp-row">
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
      <div><b class="font-condensed is-amber">${fmtPts(record.net)}</b><span>Points</span></div>
      <div><b class="font-condensed">${record.correct}–${record.wrong}</b><span>Record</span></div>
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

// ── /picks/rules — the Pickmaster rules in plain language ───────────────────────────────
// Same card + section styling as /rules (legal-*). The numbers here must match lib/picks.js:
// net scoring, the tiebreak order (TIEBREAK_STEPS) and the 35–65% odds clamp.
export function picksRulesPage({ closeTime = '06:00', oddsOn = true, prizeLine = '' }) {
  const section = (heading, content) => `<div class="legal-section">
    <h2 class="legal-section__heading">${escHtml(heading)}</h2>
    <div class="legal-section__body">${content}</div>
  </div>`;
  return `<div class="page-content">
  <div class="legal-page pkr-page">
    <p class="pkp-crumb"><a href="/picks">← Who wins? picks</a></p>
    <div class="legal-header">
      <h1 class="legal-title">Pickmaster rules</h1>
      <p class="legal-updated">Season 4 · in effect from the October 11, 2026 games</p>
    </div>
    <div class="card legal-card">
      ${section('The short version', `<p>Pick who wins each game. A correct pick is <strong>+1</strong>, a wrong one is <strong>−1</strong>, and a game you don't pick is <strong>0</strong>. Most points when the season ends is the <strong>Pickmaster</strong>.</p>
      ${prizeLine ? `<p>${escHtml(prizeLine)}</p>` : ''}`)}
      ${section('Making a pick', `<ul>
        <li>Log in with your player account, then tap a team on any open game: on the homepage, <a href="/picks">/picks</a>, a game page or your profile.</li>
        <li>You can change or remove your pick until picks close at <strong>${escHtml(fmtCloseTime(closeTime))} (Manila time) on game day</strong>. Your last pick is the one that counts.</li>
        <li>You can pick any game, including your own team's, and either side of it.</li>
        <li>Logged-in players can see who picked each side. Everyone sees the results after the final.</li>
      </ul>`)}
      ${section('Scoring', `<table class="pkr-table">
        <thead><tr><th>Your pick</th><th>Points</th></tr></thead>
        <tbody>
          <tr><td>Correct</td><td class="font-condensed">+1</td></tr>
          <tr><td>Wrong</td><td class="font-condensed">−1</td></tr>
          <tr><td>Didn't pick</td><td class="font-condensed">0</td></tr>
        </tbody>
      </table>
      <p>The leaderboard shows your points next to your record, so <strong>7–1</strong> is <strong>+6</strong>. Every game counts the same, regular season and playoffs alike.</p>
      <p>There's no minimum number of picks. Sitting out a game costs nothing, and guessing every game doesn't help either: a coin-flip picker ends up near 0. Joining late is fine. Someone who starts in week 8 and goes 6–0 is level with someone who went 9–3 all season.</p>`)}
      ${section('If players are tied', `<p>During the season, players on the same points share a rank. When the season ends, a tie for Pickmaster goes down this list until it's settled:</p>
      <ol class="pkr-steps">
        <li><strong>Head-to-head.</strong> Only the games where the tied players picked opposite sides count. Whoever was right more often wins.</li>
        <li><strong>More correct picks.</strong> 10–4 beats 7–1, even though both are +6.</li>
        <li><strong>Longest streak</strong> of correct picks in the season. A wrong pick breaks a streak; a game you skip doesn't.</li>
        <li><strong>Beat the Odds points</strong> (below).</li>
        <li><strong>Finals margin guess.</strong> When you pick Finals Game 1, you'll also be able to guess the winning margin (it opens before the playoffs). Closest guess wins.</li>
        <li>Still level: <strong>co-Pickmasters</strong>.</li>
      </ol>
      <p>With three or more tied, anyone a step separates is placed, and whoever is still level starts again at head-to-head.</p>`)}
      ${section('Beat the Odds', `<p>A second leaderboard for calling upsets. Bragging rights only; it doesn't decide the prize except as tiebreaker 4.</p>
      <ul>
        <li>A correct pick earns <strong>2 × (100% − the odds on your side)</strong>. A wrong pick costs <strong>2 × the odds on your side</strong>.</li>
        <li>Odds count between 35% and 65%. A team given 84% counts as 65%, and one given 16% counts as 35%.</li>
        <li>So a correct pick on a 35% underdog earns <strong>+1.30</strong>, and a miss on a 65% favourite costs <strong>−1.30</strong>. A 50/50 game is +1 or −1.</li>
        <li>The odds used are the ones shown when picks closed. A game with no odds (early in the season, or odds hidden for that game) counts +1 or −1.</li>
      </ul>
      ${oddsOn ? '' : '<p>Odds are switched off on the site right now, but the odds stored for each game still count here.</p>'}`)}
      ${section('Special cases', `<ul>
        <li><strong>Cancelled games</strong>, or games without a final result, score nothing for anyone.</li>
        <li><strong>Score corrections:</strong> if a final score is corrected, every pick on that game is rescored. Beat the Odds points stay based on the odds shown at close.</li>
        <li>Rules are set before the season's picks are scored. Any change only applies to games after it's announced.</li>
      </ul>`)}
      ${section('Questions', '<p>Ask an admin, or message the league page. <a href="/picks">See the race →</a></p>')}
    </div>
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

  // Race: Pickmaster / Beat the Odds boards, each showing 10 then "Show all".
  document.querySelectorAll('[data-race-show]').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.dataset.raceShow;
      document.querySelectorAll('[data-race-show]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      document.querySelectorAll('[data-race-board]').forEach(function (p) { p.hidden = p.dataset.raceBoard !== name; });
      document.querySelectorAll('[data-race-foot]').forEach(function (p) { p.hidden = p.dataset.raceFoot !== name; });
    });
  });
  document.querySelectorAll('[data-race-all]').forEach(function (all) {
    all.dataset.label = all.textContent;
    all.addEventListener('click', function () {
      var open = all.previousElementSibling.classList.toggle('is-open');
      all.setAttribute('aria-expanded', open ? 'true' : 'false');
      all.textContent = open ? 'Show top 10' : all.dataset.label;
    });
  });

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

// ── /picks/<game> — the full matchup preview; after the final, its archive ──────────────
// state: 'open' | 'closed' | 'later' | 'final'. The matchup, storyline and odds come from
// the saved preview (server.js gamePreview), frozen from the moment picks close — so a
// finished game shows the preview exactly as it read before tip-off, with the result on top.
export function picksGamePage({ m, story, state, odds = null, pick = null, result = null, recapHref = '', siblings = [], isAdmin = false, isPlayer = false, selfHref = '/picks' }) {
  const when = dayLabel(m.ymd);
  const desc = {
    final: `${when} · Season ${m.season} · Final`,
    closed: `${when} · Picks closed · results after the final`,
    later: `${when} · Picks open closer to game day`,
    open: `${when} · Make your pick before tip-off`,
  }[state];
  const card = matchupCard(m, {
    story, isAdmin, isPlayer, variant: 'full', state, next: selfHref, page: true,
    counts: pick?.counts, myPick: pick?.myPick, pickers: pick?.pickers || null,
    pickState: pick ? { closed: pick.closed, odds } : state === 'final' ? { odds } : null,
  });
  const also = siblings.length ? `<p class="pkg-also">Also on ${escHtml(shortDayLabel(m.ymd))}: ${siblings.map(x => `<a href="${escHtml(x.href)}">${dot(x.a, 7)}${escHtml(tc(x.a))} vs ${escHtml(tc(x.b))}${dot(x.b, 7)}</a>`).join(' · ')}</p>` : '';

  const resultHtml = state === 'final' ? `<section class="pkg-result" aria-labelledby="pkg-res-h">
    <div class="section-header"><h2 id="pkg-res-h">Result</h2>${recapHref ? `<a href="${escHtml(recapHref)}" class="section-header__link">Read the recap →</a>` : ''}</div>
    ${result ? `<div class="pkg-result__card">${calledItCard(result, isPlayer, { preview: false })}</div>` : ''}
  </section>
  <div class="section-header pkg-prev-h"><h2>The preview <span class="section-header__sub">as it stood before tip-off</span></h2></div>` : '';

  return `<div class="page-content pkg-page">
  <p class="pkp-crumb"><a href="/picks">← All picks</a></p>
  ${pageHeader({ title: `${escHtml(tc(m.a))} vs ${escHtml(tc(m.b))}`, description: escHtml(desc) })}
  ${also}
  ${resultHtml}
  <div class="gm-grid gm-grid--one">${card}</div>
</div>
${matchupScript({ isAdmin })}
${pick ? pickBoxScript() : ''}`;
}
