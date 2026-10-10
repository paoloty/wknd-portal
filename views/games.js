import { escHtml, pageHeader } from './layout.js';
import { teamColor, formatDate, boldTitle, excerpt, initials, commentSnippet, playerPhotoUrl } from './utils.js';
import { summaryPanel } from './home.js';
import { pickBox, pickBoxScript, previewHref, oddsEdge, talkLink } from './pick-box.js';

// Comment/react/share for this row — same actions as the game page's tabActionsBar, just
// reachable from the list. The row itself is a "stretched link" card (see .game-row__link
// in styles.css), not a wrapping <a>, specifically so these can be real interactive
// elements without nesting them inside another link (invalid HTML, unreliable clicks).
function gameRowActions(game, commentsEnabled, social) {
  const gameId = encodeURIComponent(game.id);
  const commentItem = commentsEnabled
    ? `<a href="/games/${gameId}#comments" class="game-row__action" aria-label="Comments">💬<span>${social.commentsCount || 0}</span></a>`
    : '';
  const reactItem = commentsEnabled
    ? `<button type="button" class="game-row__action${social.reacted ? ' is-active' : ''}" data-action="react-game" data-game-id="${escHtml(game.id)}" aria-label="React to this game">🔥<span>${social.reactCount || 0}</span></button>`
    : '';
  return `<div class="game-row__actions">
    ${commentItem}
    ${reactItem}
    <button type="button" class="game-row__action" data-action="share-game" data-url="/games/${gameId}" aria-label="Share">↗</button>
  </div>`;
}

// ── Game row (article-list style) ─────────────────────────────────────────────
// Exported so other pages (e.g. team detail) can reuse the exact same row/list
// markup and click-delegation script for a filtered subset of games.
export function gameRow(game, { commentsEnabled = false, social = { commentsCount: 0, reactCount: 0, reacted: false } } = {}) {
  const scoreA = Number(game.team_a_score);
  const scoreB = Number(game.team_b_score);
  const winA = scoreA > scoreB;
  const winB = scoreB > scoreA;
  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);
  const isFinal = game.status === 'final';

  const title = boldTitle(game.game_writeup)
    || `${game.team_a_name} vs ${game.team_b_name}`;
  const body = excerpt(game.game_writeup);
  const isPlayoff = game.game_type === 'playoff';
  const isFinals  = game.game_type === 'finals';

  const flareOpacity = game.has_cover ? '55' : 'bb';
  const thumb = `${game.has_cover
    ? `<img src="/api/photo/${encodeURIComponent(game.id)}?w=640" alt="" class="game-row__thumb-img" loading="lazy">`
    : `<div class="game-row__thumb-placeholder"><span class="game-row__thumb-vs">VS</span></div>`}
  <div class="game-row__thumb-flare" style="background:linear-gradient(135deg,${colorA}${flareOpacity} 0%,transparent 55%,${colorB}${flareOpacity} 100%)"></div>`;

  const scoreInline = `<span class="game-row__score-inline">
    <span class="team-dot" style="background:${colorA}"></span>
    <span class="game-row__score-team-name${winA ? ' game-row__score-team-name--win' : ''}">${escHtml(game.team_a_name)}</span>
    <span class="game-row__score-num font-condensed${winA ? ' game-row__score-num--win' : ''}">${scoreA}</span>
    <span class="game-row__score-sep">–</span>
    <span class="game-row__score-num font-condensed${winB ? ' game-row__score-num--win' : ''}">${scoreB}</span>
    <span class="game-row__score-team-name${winB ? ' game-row__score-team-name--win' : ''}">${escHtml(game.team_b_name)}</span>
    <span class="team-dot" style="background:${colorB}"></span>
  </span>`;

  const cta = isFinal
    ? `<span class="game-row__cta" style="color:var(--text-muted)">STATS PENDING</span>`
    : `<span class="game-row__cta">FULL GAME RECAP <span>→</span></span>`;

  const cleanTitle = title.slice(0, 120);

  return `<article class="game-row" data-game-id="${escHtml(game.id)}">
  <a href="/games/${encodeURIComponent(game.id)}" class="game-row__link" aria-label="${escHtml(cleanTitle)}"></a>
  <div class="game-row__thumb">${thumb}</div>
  <div class="game-row__body">
    <div class="game-row__meta">
      ${escHtml(formatDate(game.date))} <span class="badge-season">S${escHtml(String(game.season))}</span>${isPlayoff ? ' <span class="badge-playoff">PLAYOFF</span>' : ''}${isFinals ? ' <span class="badge-playoff" style="background:var(--amber);color:#0a0e16;border-color:var(--amber)">FINALS</span>' : ''}${isFinal ? ' <span class="badge-playoff" style="background:rgba(59,130,246,.15);color:#60a5fa;border-color:#3b82f6">STATS PENDING</span>' : ''}
      ${scoreInline}
    </div>
    <h3 class="game-row__title">${escHtml(cleanTitle)}</h3>
    ${body && !isFinal ? `<p class="game-row__excerpt">${escHtml(body.length > 110 ? body.slice(0, 110) + '…' : body)}</p>` : ''}
    <div class="game-row__footer">
      ${cta}
      ${gameRowActions(game, commentsEnabled, social)}
    </div>
  </div>
</article>`;
}

// One delegated listener for the whole list rather than one per row — mirrors the
// react/share handlers in views/game.js (gameTabsScript), just scoped to .games-grid and
// keyed off data-game-id instead of a single page-level gameId.
export function gameListScript() {
  return `<script>
(function() {
  var list = document.querySelector('.games-grid');
  if (!list) return;

  list.addEventListener('click', function(e) {
    var reactBtn = e.target.closest('[data-action="react-game"]');
    if (reactBtn) {
      var gameId = reactBtn.dataset.gameId;
      reactBtn.disabled = true;
      fetch('/games/' + encodeURIComponent(gameId) + '/react', { method: 'POST', headers: {'Content-Type':'application/json'} })
        .then(function(r) {
          if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return null; }
          return r.json();
        })
        .then(function(d) {
          if (!d) return;
          reactBtn.disabled = false;
          if (!d.ok) return;
          reactBtn.classList.toggle('is-active', d.reacted);
          reactBtn.querySelector('span').textContent = d.count;
        })
        .catch(function() { reactBtn.disabled = false; });
      return;
    }

    var shareBtn = e.target.closest('[data-action="share-game"]');
    if (shareBtn) {
      var url = window.location.origin + shareBtn.dataset.url;
      if (navigator.share) {
        navigator.share({ url: url }).catch(function() {});
        return;
      }
      navigator.clipboard.writeText(url).then(function() {
        var orig = shareBtn.innerHTML;
        shareBtn.innerHTML = '✓';
        setTimeout(function() { shareBtn.innerHTML = orig; }, 1500);
      }).catch(function() {});
    }
  });
})();
<\/script>`;
}

// ── /games page ───────────────────────────────────────────────────────────────
const tc = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const dayLabel = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const shortDayLabel = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const initialsOf = name => String(name || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const dot = (name, size = 0) => `<span class="team-dot"${size ? ` style="width:${size}px;height:${size}px;background:${teamColor(name)}"` : ` style="background:${teamColor(name)}"`}></span>`;
const avatar = (cls, p) => p.hasPhoto
  ? `<img class="${cls}" src="${playerPhotoUrl(p.id || p.playerId, 96)}" alt="" loading="lazy">`
  : `<span class="${cls} gm-avatar--initials">${escHtml(initialsOf(p.name))}</span>`;
const gameYmdOf = raw => {
  const s = String(raw || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// POTG marquee: the list twice in one track so the loop is seamless (the second copy is
// hidden from screen readers).
function potgMarquee(items) {
  if (!items.length) return '';
  const item = (p, hidden) => `<a href="/games/${encodeURIComponent(p.gameId)}" class="gm-mq__item" style="--team:${teamColor(p.team)}"${hidden ? ' tabindex="-1" aria-hidden="true"' : ''}>
      ${avatar('gm-mq__img', p)}
      <span class="gm-mq__who"><span class="gm-mq__meta">${escHtml(p.meta)}</span><span class="gm-mq__name">${escHtml(p.name)}</span></span>
      <span class="gm-mq__line">
        <span class="gm-mq__stats">${p.stats.map(s => `<span><b class="font-condensed">${s.n}</b><i>${s.u}</i></span>`).join('')}</span>
        <span class="gm-mq__result">${dot(p.team, 8)}${escHtml(p.result)}</span>
      </span>
    </a>`;
  return `<section class="gm-mq" aria-label="Recent Players of the Game">
  <div class="gm-mq__label"><b>POTG</b><span>Players of the game</span></div>
  <div class="gm-mq__view"><div class="gm-mq__track">
    ${items.map(p => item(p, false)).join('')}
    ${items.map(p => item(p, true)).join('')}
  </div></div>
</section>`;
}

// One stat row: the better side's number + bar in amber (lower is better for turnovers).
function edgeRow(r) {
  const tie = r.a === r.b;
  const aGood = !tie && (r.hi ? r.a > r.b : r.a < r.b);
  const bGood = !tie && !aGood;
  const max = Math.max(r.a, r.b) || 1;
  const w = v => `${Math.round((v / max) * 100)}%`;
  return `<div class="gm-st">
      <span class="gm-st__v${aGood ? ' is-good' : ''}">${r.a.toFixed(1)}</span>
      <span class="gm-st__track gm-st__track--a"><span class="gm-st__bar${aGood ? ' is-good' : ''}" style="width:${w(r.a)}"></span></span>
      <span class="gm-st__lbl">${escHtml(r.label)}</span>
      <span class="gm-st__track"><span class="gm-st__bar${bGood ? ' is-good' : ''}" style="width:${w(r.b)}"></span></span>
      <span class="gm-st__v gm-st__v--b${bGood ? ' is-good' : ''}">${r.b.toFixed(1)}</span>
    </div>`;
}

function scorerCard(p, side) {
  if (!p) return `<div class="gm-fo__p gm-fo__p--empty${side === 'b' ? ' gm-fo__p--r' : ''}">No box scores yet</div>`;
  const max = Math.max(...p.series, 1);
  return `<a href="/players/${encodeURIComponent(p.id)}" class="gm-fo__p${side === 'b' ? ' gm-fo__p--r' : ''}" style="--team:${teamColor(p.team)}">
      <span class="gm-fo__head">
        ${avatar('gm-fo__img', p)}
        <span class="gm-fo__id"><b class="gm-fo__name">${escHtml(p.name)}</b><span class="gm-fo__sub">${dot(p.team, 7)}${escHtml(p.team)}${p.number !== '' && p.number != null ? ` · #${escHtml(String(p.number))}` : ''}</span></span>
      </span>
      <span class="gm-fo__big"><b class="font-condensed${p.lead ? ' is-lead' : ''}">${p.ppg.toFixed(1)}</b><span>PPG vs ${escHtml(p.opp)}</span></span>
      <span class="gm-fo__spark" data-bars${p.team === 'BLACK' ? ' style="--bar:#8a94a6"' : ''} aria-label="Points in each game against ${escHtml(tc(p.opp))}: ${p.series.join(', ')}">
        ${p.series.map((v, i) => `<span class="gm-fo__bar${v === max ? ' is-best' : ''}" data-bar style="--i:${i};height:${Math.max(6, Math.round((v / max) * 100))}%" title="${v} pts"></span>`).join('')}
      </span>
      <span class="gm-fo__stats"><span><b class="font-condensed">${p.rpg.toFixed(1)}</b>REB</span><span><b class="font-condensed">${p.apg.toFixed(1)}</b>AST</span>${p.fg != null ? `<span><b class="font-condensed">${p.fg.toFixed(1)}</b>FG%</span>` : ''}</span>
      <span class="gm-fo__best">Best vs ${escHtml(tc(p.opp))} · <b>${p.best.pts} · ${escHtml(p.best.label)}</b></span>
    </a>`;
}

function meetingTile(m, x) {
  const aWin = x.scoreA > x.scoreB;
  const potg = x.potg
    ? `POTG · ${escHtml(x.potg.name)} ${x.potg.pts} pts${x.potg.reb >= 5 ? `, ${x.potg.reb} reb` : x.potg.ast >= 5 ? `, ${x.potg.ast} ast` : ''}`
    : 'No box score for this game';
  return `<a href="/games/${encodeURIComponent(x.id)}" class="gm-mt${x.hasCover ? ' has-photo' : ''}" style="--team:${teamColor(aWin ? m.a : m.b)}">
      ${x.hasCover ? `<img class="gm-mt__img" src="/api/photo/${encodeURIComponent(x.id)}?w=640" alt="" loading="lazy">` : ''}
      <span class="gm-mt__in">
        <span class="gm-mt__top"><span class="gm-mt__when">${escHtml(shortDayLabel(x.ymd))} · S${escHtml(String(x.season))}</span>${x.tag ? `<span class="gm-mt__tag">${escHtml(x.tag)}</span>` : ''}</span>
        <span class="gm-mt__sb">
          <span class="gm-mt__row${aWin ? ' is-win' : ''}">${dot(m.a, 8)}${escHtml(m.a)}<b class="font-condensed">${x.scoreA}</b></span>
          <span class="gm-mt__row${aWin ? '' : ' is-win'}">${dot(m.b, 8)}${escHtml(m.b)}<b class="font-condensed">${x.scoreB}</b></span>
        </span>
        <span class="gm-mt__potg">${potg}</span>
      </span>
    </a>`;
}

// /games Up next cards: the storyline's first sentence (or ~150 characters at a word break).
function storyExcerpt(body) {
  const text = String(body || '').trim();
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0] || text;
  if (first.length <= 170) return first.length < text.length && !/[.!?]$/.test(first) ? `${first}…` : first;
  return `${first.slice(0, 150).replace(/\s+\S*$/, '')}…`;
}

const storyHtml = s => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');

// ── "Who wins?" odds, results and leaderboard ────────────────────────────────
// Odds are a thin amber line so they never read as the thick fan-picks bar. Numbers come
// from lib/picks.js computeOdds — the panel only formats its `steps`.
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
const pctWord = w => (Math.abs(w - 0.5) < 0.005 ? 'half' : `${Math.round(w * 100)}%`);

function howFigured(m, o) {
  const s = o.steps;
  const favName = o.fav === 'b' ? m.b : m.a;
  const favPct = o.fav === 'b' ? o.pctB : o.pctA;
  const damp = s.weightA === s.weightB
    ? `Only ${s.gamesA} game${s.gamesA === 1 ? '' : 's'} in, so it counts ${pctWord(s.weightA)}`
    : `Counted at ${pctWord(s.weightA)} for ${tc(m.a)} (${s.gamesA} games) and ${pctWord(s.weightB)} for ${tc(m.b)} (${s.gamesB})`;
  const base = s.rA - s.rB;
  const h2hLead = s.h2hAvg > 0 ? m.a : m.b;
  return `<details class="gm-how">
      <summary>How it's figured</summary>
      <ol class="gm-how__steps">
        <li><b>Points margin per game, S${escHtml(String(m.season))}</b><span>${dot(m.a, 7)} ${escHtml(tc(m.a))} <em>${signed(s.avgA)}</em> · ${dot(m.b, 7)} ${escHtml(tc(m.b))} <em>${signed(s.avgB)}</em></span></li>
        <li><b>${escHtml(damp)}</b><span>${escHtml(tc(m.a))} <em>${signed(s.rA)}</em> vs ${escHtml(tc(m.b))} <em>${signed(s.rB)}</em> → ${base === 0 ? 'even' : `${escHtml(tc(base > 0 ? m.a : m.b))} by <em>${Math.abs(base).toFixed(1)}</em>`}. The weight grows as the season goes on.</span></li>
        <li><b>Head to head nudge</b><span>${s.meetings
          ? `Last ${s.meetings} meeting${s.meetings === 1 ? '' : 's'}: ${s.h2hAvg === 0 ? 'dead even' : `${escHtml(tc(h2hLead))} <em>+${Math.abs(s.h2hAvg).toFixed(1)}</em> a game`}, counts half → <em>${signed(s.h2hAdj)}</em>`
          : 'No meetings yet, so no nudge.'}</span></li>
        <li><b>Projected margin → chance to win</b><span>${o.fav
          ? `${escHtml(tc(favName))} by <em>${Math.abs(o.margin).toFixed(1)}</em>. A typical game swings about ${s.swing} points either way, so that's <em>${favPct}%</em> to win.`
          : 'Dead even — a coin flip.'}</span></li>
      </ol>
      <p class="gm-how__foot">Recalculated after every final. Just for fun — no betting.</p>
    </details>`;
}

function oddsLine(m, o) {
  const favName = o.fav === 'b' ? m.b : m.a;
  const proj = o.fav ? `${tc(favName)} by ${Math.max(1, Math.round(Math.abs(o.margin)))}` : 'Toss-up';
  // Team glare on both sides, like the matchup banner — the favourite's side glows stronger.
  // White is the one light team colour, so it gets half strength or it washes out the text.
  const glow = side => {
    const base = o.fav === side ? 55 : o.fav ? 28 : 40;
    return `${Math.round(base * ((side === 'a' ? m.a : m.b) === 'WHITE' ? 0.5 : 1))}%`;
  };
  return `<div class="gm-odds" style="--ta:${teamColor(m.a)};--tb:${teamColor(m.b)};--ga:${glow('a')};--gb:${glow('b')}">
      <div class="gm-odds__top"><span class="gm-odds__kick">Odds</span><span class="gm-odds__proj">· ${escHtml(proj)}</span></div>
      <div class="gm-odds__row">
        <span class="gm-odds__side${o.fav === 'a' ? ' is-fav' : ''}">${dot(m.a, 8)}${escHtml(m.a)} <b class="font-condensed">${o.pctA}%</b></span>
        <span class="gm-odds__bar" aria-hidden="true"><span class="${o.fav === 'a' ? 'is-fav' : ''}" style="width:${o.pctA}%"></span><span class="${o.fav === 'b' ? 'is-fav' : ''}"></span></span>
        <span class="gm-odds__side gm-odds__side--b${o.fav === 'b' ? ' is-fav' : ''}"><b class="font-condensed">${o.pctB}%</b> ${escHtml(m.b)}${dot(m.b, 8)}</span>
      </div>
      ${howFigured(m, o)}
    </div>`;
}

const FLAME = `<svg class="pk-flame" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/></svg>`;
const CHECK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const CROSS = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const verdict = ok => (ok ? `<span class="pk-ok">${CHECK}Called it</span>` : `<span class="pk-miss">${CROSS}Missed</span>`);

// Photo with initials behind it and a team-colour ring. link: false inside rows that are
// already links themselves (a nested <a> is invalid HTML).
function pickAvatar(p, size = 30, link = true) {
  const tag = link ? 'a' : 'span';
  return `<${tag}${link ? ` href="/players/${encodeURIComponent(p.id)}"` : ''} class="pk-av" style="--team:${teamColor(p.team)};width:${size}px;height:${size}px" title="${escHtml(p.name)}">
      <span class="pk-av__init">${escHtml(initials(p.name))}</span>
      <img src="${playerPhotoUrl(p.id, size > 48 ? 192 : 96)}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.remove()">
    </${tag}>`;
}

// preview: false on the preview page itself (it would link to itself).
function calledItCard(s, isPlayer, { preview = true } = {}) {
  const g = s.game;
  const winnerName = g.winner === 'a' ? g.a : g.b;
  const row = (name, score, win) => `<span class="pk-sb__row${win ? ' is-win' : ''}">${dot(name, 8)}${escHtml(name)}<b class="font-condensed">${score}</b></span>`;
  const oddsFav = g.odds?.fav ? (g.odds.fav === 'a' ? g.a : g.b) : null;
  const shown = s.calledIt.slice(0, 10);
  const more = s.calledIt.length - shown.length;
  return `<article class="pk-card" style="--team:${teamColor(winnerName)}">
      <div class="pk-card__top">
        <a href="/games/${encodeURIComponent(g.id)}" class="pk-card__when">${escHtml(shortDayLabel(g.ymd))} · Final</a>
        ${s.upset ? '<span class="pk-upset">Upset</span>' : ''}
      </div>
      <div class="pk-sb">${row(g.a, g.sa, g.winner === 'a')}${row(g.b, g.sb, g.winner === 'b')}</div>
      ${s.upset ? `<p class="pk-upset-line">${escHtml(tc(winnerName))} won with <b>${g.winner === 'a' ? g.odds.pctA : g.odds.pctB}%</b> odds</p>` : ''}
      <div class="pk-res">
        ${oddsFav ? `<div class="pk-res__row"><span class="pk-res__k">Odds</span><span><b>${escHtml(tc(oddsFav))} ${g.odds.fav === 'a' ? g.odds.pctA : g.odds.pctB}%</b></span>${verdict(s.oddsCalled)}</div>` : ''}
        <div class="pk-res__row"><span class="pk-res__k">Fans</span>${s.total
          ? `<span><b>${s.pctWinner}%</b> picked ${escHtml(tc(winnerName))} · ${s.total} pick${s.total === 1 ? '' : 's'}</span>${s.pctWinner === 50 ? '' : verdict(s.fansCalled)}`
          : '<span>No picks on this game</span>'}</div>
        ${isPlayer ? `<div class="pk-res__row"><span class="pk-res__k">You</span><span>${s.myPick ? `You picked <b>${escHtml(tc(s.myPick === 'a' ? g.a : g.b))}</b>` : "You didn't pick"}</span>${s.myPick ? verdict(s.myPick === g.winner) : ''}</div>` : ''}
      </div>
      ${s.calledIt.length ? `<div class="pk-called">
        <span class="pk-called__lbl">Called it · ${s.calledIt.length}</span>
        <div class="pk-called__avs">${shown.map(p => pickAvatar(p)).join('')}${more > 0 ? `<span class="pk-av pk-av--more">+${more}</span>` : ''}</div>
      </div>` : `<div class="pk-called pk-called--none">${s.total ? 'Nobody called this one' : 'Nobody picked this game'}</div>`}
      ${preview ? `<a href="${escHtml(previewHref(g))}#preview" class="pk-card__prev">Pre-game preview →</a>` : ''}
    </article>`;
}

// variant 'semi' = /games Up next (storyline + pick, links to the full preview);
// 'full' = /picks/<game>. state: 'open' | 'closed' | 'final' (the archived preview, with the
// pre-game odds in place of the pick) | 'later' (scheduled, picks not open yet).
function matchupCard(m, { story, counts = { a: 0, b: 0 }, myPick, isAdmin, isPlayer, pickState = null, pickers = null, variant = 'full', state = 'open', href = '', next = '/games', page = false, talk = false }) {
  const g = m.game;
  const semi = variant === 'semi';
  const leadA = m.winsA > m.winsB, leadB = m.winsB > m.winsA;
  const glare = `radial-gradient(65% 130% at 0% 75%, ${teamColor(m.a)}80 0%, transparent 62%), radial-gradient(65% 130% at 100% 75%, ${teamColor(m.b)}80 0%, transparent 62%)`;
  const slides = m.slides.map((id, i) => `<div class="gm-sl${i === 0 ? ' is-on' : ''}"><img src="/api/photo/${encodeURIComponent(id)}?w=960" alt=""${i === 0 ? '' : ' loading="lazy"'}></div>`).join('');

  // Who wins? — the shared pick box (views/pick-box.js) with this card's odds panel on top.
  // The bar shows the fan split; "Who picked" opens from its middle badge.
  const total = counts.a + counts.b;
  const { closed = false, odds = null, ymd = null, closeHm = null } = pickState || {};
  const pick = state === 'final' || state === 'later' ? '' : pickBox({ id: g.id, a: m.a, b: m.b, counts, myPick: myPick || null, closed, odds, pickers, ymd, closeHm }, {
    // The preview keeps the full odds panel + the Fans vs odds line; the /games card shows the
    // odds as an edge along its photo banner instead.
    isPlayer, next, oddsHtml: !semi && odds ? oddsLine(m, odds) : '', flag: !semi,
  });
  const pickSec = state === 'final'
    ? (odds ? `<div class="gm-grp">Pre-game odds</div>${oddsLine(m, odds)}` : '')
    : state === 'later'
      ? '<div class="gm-grp">Who wins?</div><p class="gm-later">Picks open closer to game day.</p>'
      : pickState ? `<div class="gm-grp">Who wins? <span class="gm-grp__note" data-pick-total>${closed ? `Picks closed · ${total} pick${total === 1 ? '' : 's'}` : total ? `${total} pick${total === 1 ? '' : 's'}` : 'Be the first to pick'}</span></div>
      ${pick}
      ${talk && isPlayer && href ? talkLink(g.id, `${href}#talk`, !!myPick) : ''}` : '';
  // /games card: each side's chance next to its record, matching the odds edge on the banner.
  const showEdge = semi && state !== 'final' && state !== 'later' && !!odds;
  const heroPct = (side, before = false) => {
    if (!showEdge) return '';
    const v = `<span class="pkb-pct${odds.fav === side ? ' is-fav' : ''}">${side === 'a' ? odds.pctA : odds.pctB}%</span>`;
    return before ? `${v} · ` : ` · ${v}`;
  };
  const chip = state === 'final' ? 'Pre-game preview' : state === 'later' ? 'Coming up' : 'Up next';

  // Biggest edges first (gap relative to the larger value), the rest behind a toggle.
  const gap = r => Math.abs(r.a - r.b) / (Math.max(r.a, r.b) || 1);
  const ranked = [...m.rows].sort((x, y) => gap(y) - gap(x));
  const edgeIds = new Set(ranked.slice(0, 5).map(r => r.key));
  const rowsHtml = m.rows.map(r => `<div class="gm-st-wrap${edgeIds.has(r.key) ? '' : ' is-extra'}">${edgeRow(r)}</div>`).join('');
  const basisNote = m.firstMeeting
    ? `First meeting · S${escHtml(String(m.season))} per game`
    : `${m.meetings} meeting${m.meetings === 1 ? '' : 's'}${m.boxMeetings < m.meetings ? ` · ${m.boxMeetings} with box scores` : ''}`;

  const scorers = m.scorers.length === 2 && (m.scorers[0] || m.scorers[1]) ? (() => {
    const [sa, sb] = m.scorers;
    if (sa && sb) { sa.lead = sa.ppg > sb.ppg; sb.lead = sb.ppg > sa.ppg; }
    return `<div class="gm-grp">Go-to scorers · in this matchup</div>
      <div class="gm-fo">${scorerCard(sa, 'a')}${scorerCard(sb, 'b')}<span class="gm-fo__vs font-condensed" aria-hidden="true">VS</span></div>`;
  })() : '';

  const meetings = m.lastMeetings.length ? `<div class="gm-grp">${m.lastMeetings.length === 1 ? 'Last meeting' : `Last ${m.lastMeetings.length} meetings`}</div>
      <div class="gm-mts">${m.lastMeetings.map(x => meetingTile(m, x)).join('')}</div>` : '';

  const regen = isAdmin && state !== 'final' && state !== 'later';
  const storySec = story
    ? `<div class="gm-story">
        <p class="gm-story__head">${storyHtml(story.headline)}</p>
        ${semi
          ? `<p class="gm-story__body">${escHtml(storyExcerpt(story.body))} <a href="${escHtml(href)}" class="gm-story__link">${state === 'open' ? 'Read more &amp; pick' : 'Read more'} →</a></p>`
          : `<p class="gm-story__body" data-clamp>${escHtml(story.body)}</p>
        <button type="button" class="gm-story__more" data-clamp-btn hidden aria-expanded="false">Read more</button>`}
        ${regen ? `<button type="button" class="hs-summary__regen gm-story__regen" data-matchup="${escHtml(g.id)}">↺ Regenerate</button>` : ''}
      </div>`
    : regen ? `<div class="gm-story gm-story--empty"><span>No storyline yet — it's written in the background, or regenerate it now</span><button type="button" class="hs-summary__regen gm-story__regen" data-matchup="${escHtml(g.id)}">↺ Regenerate</button></div>` : '';

  // Semi: the details stay on /picks/<game> — a short teaser of what's there instead.
  const teaser = [
    m.firstMeeting ? 'First meeting' : `${m.meetings} meeting${m.meetings === 1 ? '' : 's'}`,
    `${m.rows.length} stats compared`,
    m.scorers.some(Boolean) ? 'go-to scorers' : '',
    m.lastMeetings.length ? `last ${m.lastMeetings.length === 1 ? 'meeting' : `${m.lastMeetings.length} meetings`}` : '',
  ].filter(Boolean).join(' · ');
  const detailSec = semi
    ? `${ranked.length ? `<div class="gm-grp gm-grp--row"><span>${m.firstMeeting ? 'Top edges · this season' : 'Top edges · head to head'}</span><span class="gm-grp__note">${basisNote}</span></div>
      <div class="gm-edges">${ranked.slice(0, 3).map(edgeRow).join('')}</div>` : ''}
      <a href="${escHtml(href)}" class="gm-full"><span class="gm-full__k">Full matchup preview</span><span class="gm-full__t">${escHtml(teaser)}</span><span class="gm-full__go">${state === 'open' ? 'Preview &amp; pick' : 'Open preview'} →</span></a>`
    : `<div class="gm-grp gm-grp--row"><span>${m.firstMeeting ? 'Biggest edges · this season' : 'Biggest edges · head to head'}</span><span class="gm-grp__note">${basisNote}</span></div>
      <div class="gm-edges">${rowsHtml}</div>
      ${m.rows.length > 5 ? `<button type="button" class="gm-more" data-more aria-expanded="false">Show all ${m.rows.length} stats</button>` : ''}
      ${scorers}
      ${meetings}`;

  return `<article class="gm-card${page ? ' gm-card--page' : ''}${semi ? ' gm-card--semi' : ''}" id="m-${escHtml(g.id)}" aria-label="${escHtml(tc(m.a))} vs ${escHtml(tc(m.b))}">
    <div class="gm-hero">
      <div class="gm-slides" data-slides>${slides}</div>
      <div class="gm-shade"></div>
      <div class="gm-glare" style="background:${glare}"></div>
      ${showEdge ? oddsEdge(m.a, m.b, odds) : ''}
      <div class="gm-hero__in">
        <div class="gm-hero__chips"><span class="hero-chip hero-chip--season">${chip}</span><span class="hero-chip">${escHtml(dayLabel(m.ymd))}</span></div>
        <div class="gm-hero__teams">
          <span class="gm-side"><span class="gm-side__name">${dot(m.a, 11)}<b>${escHtml(m.a)}</b></span><span class="gm-side__rec">S${escHtml(String(m.season))} ${m.recordA.w}–${m.recordA.l}${heroPct('a')}</span></span>
          <span class="gm-h2h">${m.firstMeeting
            ? '<span class="gm-h2h__lbl">First meeting</span>'
            : `<span class="gm-h2h__lbl">Head to head</span><span class="gm-h2h__wins"><b class="font-condensed${leadA ? ' is-lead' : ''}">${m.winsA}</b><span class="font-condensed">–</span><b class="font-condensed${leadB ? ' is-lead' : ''}">${m.winsB}</b></span>`}</span>
          <span class="gm-side gm-side--b"><span class="gm-side__name"><b>${escHtml(m.b)}</b>${dot(m.b, 11)}</span><span class="gm-side__rec">${heroPct('b', true)}S${escHtml(String(m.season))} ${m.recordB.w}–${m.recordB.l}</span></span>
        </div>
      </div>
    </div>
    <div class="gm-body">
      <!-- Three fixed sections (story / picks / the rest): side by side, the cards share these
           rows through CSS subgrid, so "Who wins?" and "Biggest edges" line up across both
           cards whatever the storyline length. Each wrapper always renders, even when empty. -->
      <div class="gm-sec">${storySec}</div>
      <div class="gm-sec">${pickSec}</div>
      <div class="gm-sec">
      ${detailSec}
      </div>
    </div>
  </article>`;
}

// Recap card for the list — the homepage Game headlines card plus a footer (top scorer,
// comment/react/share). The card is a stretched link so the footer buttons stay real buttons.
function gameCard(g, { commentsEnabled, social, topScorer, odds = null }) {
  const sa = Number(g.team_a_score), sb = Number(g.team_b_score);
  const aWin = sa > sb;
  const winner = aWin ? g.team_a_name : g.team_b_name;
  const recapTitle = boldTitle(g.game_writeup);
  const margin = Math.abs(sa - sb);
  const title = recapTitle || `${tc(winner)} beat ${tc(aWin ? g.team_b_name : g.team_a_name)} by ${margin}`;
  const ymd = gameYmdOf(g.date);
  const pending = g.status === 'final';
  const typeTag = g.game_type === 'finals' ? 'Finals' : g.game_type === 'playoff' ? 'Playoffs' : '';
  const tag = typeTag || (g.overtime ? 'OT' : margin <= 2 ? 'Thriller' : margin >= 20 ? 'Blowout' : '');
  const side = (name, score, w) => `<span class="gh-score__team${w ? ' is-win' : ''}"><span class="gh-score__name">${dot(name)}${escHtml(name)}</span><b class="gh-score__num font-condensed">${score}</b></span>`;
  const id = encodeURIComponent(g.id);
  const actions = `${commentsEnabled ? `<a href="/games/${id}#comments" class="gr-act" aria-label="Comments"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>${social.commentsCount || 0}</span></a>
      <button type="button" class="gr-act${social.reacted ? ' is-active' : ''}" data-action="react-game" data-game-id="${escHtml(g.id)}" aria-label="React to this game"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/></svg><span>${social.reactCount || 0}</span></button>` : ''}
      <button type="button" class="gr-act" data-action="share-game" data-url="/games/${id}" aria-label="Share"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg></button>`;
  return `<article class="gh-card gr-card${g.has_cover ? ' has-photo' : ''}" style="--team:${teamColor(winner)}" data-teams="${escHtml(`${g.team_a_name} ${g.team_b_name}`)}" data-type="${escHtml(g.game_type || 'regular')}">
    <a href="/games/${id}" class="gr-card__link" aria-label="${escHtml(title.slice(0, 120))}"></a>
    ${g.has_cover ? `<img class="gh-card__img" src="/api/photo/${id}?w=640" alt="" loading="lazy">` : ''}
    <span class="gh-card__top"><span class="gh-card__when"><span class="gh-card__season">S${escHtml(String(g.season))}</span><span class="gh-card__date">${escHtml(dayLabel(ymd))}</span></span>${tag ? `<span class="gr-card__tag">${escHtml(tag)}</span>` : ''}</span>
    <span class="gh-card__body">
      <span class="gh-score">${side(g.team_a_name, sa, aWin)}<span class="gh-score__dash font-condensed">–</span>${side(g.team_b_name, sb, !aWin)}</span>
      ${odds ? `<span class="gr-card__odds${odds.upset ? ' is-upset' : ''}">${odds.upset
        ? `<span class="gr-card__tag gr-card__tag--upset">Upset</span><span>${escHtml(tc(winner))} won with ${100 - odds.pct}% odds</span>`
        : `Odds had ${escHtml(tc(winner))} ${odds.pct}%`}</span>` : ''}
      <span class="gh-card__title${recapTitle ? '' : ' gr-card__title--quiet'}">${escHtml(title.slice(0, 120))}</span>
      ${commentsEnabled && social.latest ? `<a href="/games/${id}#talk" class="gr-talk-link">${commentSnippet(social.latest)}</a>` : ''}
      <span class="gh-card__cta">${pending ? 'Stats pending' : recapTitle ? 'Read recap &rarr;' : 'Box score &rarr;'}</span>
    </span>
    <span class="gr-card__foot">
      <span class="gr-card__top-scorer">${topScorer ? `Top scorer · <b>${escHtml(topScorer.name)} ${topScorer.pts}</b>` : ''}</span>
      <span class="gr-card__acts">${actions}</span>
    </span>
  </article>`;
}

const REGEN_JS = `
  // Admin: regenerate the intro summary or a matchup storyline
  document.querySelectorAll('.hs-summary__regen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var matchup = btn.dataset.matchup;
      btn.disabled = true; btn.textContent = 'Writing…';
      fetch(matchup ? '/admin/games/matchup-story/regenerate' : '/admin/home-summary/regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchup ? { gameId: matchup } : { block: btn.dataset.block })
      })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
        .then(function () { location.reload(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(e.message); });
    });
  });`;

// Bars grow up from the baseline when they scroll into view (homepage face-off, matchup
// scorers). Armed only from JS, so without it the bars simply show; off for reduced motion.
// window.__wkndBars.replay(el) re-runs one chart (the homepage tabs call it on switch).
function barsScript() {
  return `<script>
(function () {
  if (window.__wkndBars) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(el) { requestAnimationFrame(function () { el.classList.add('is-in'); }); }
  function replay(el) { if (reduce || !el.classList.contains('is-armed')) return; el.classList.remove('is-in'); void el.offsetWidth; show(el); }
  window.__wkndBars = { replay: replay };
  if (reduce || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  document.querySelectorAll('[data-bars]').forEach(function (el) { el.classList.add('is-armed'); io.observe(el); });
})();
</script>`;
}

// Matchup card behaviour — slideshow, storyline clamp, stats toggle, admin regenerate.
// Shared with /picks/<game>.
function matchupScript({ isAdmin }) {
  return `${barsScript()}
<script>
(function () {
  // Matchup photo slideshows: next photo fades in on top while the previous one stays
  // underneath and keeps drifting, so the banner never dims or jumps.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-slides]').forEach(function (box, n) {
    var slides = box.querySelectorAll('.gm-sl');
    if (slides.length < 2 || reduce) return;
    var on = 0;
    setTimeout(function () {
      setInterval(function () {
        var prev = on; on = (on + 1) % slides.length;
        slides.forEach(function (s, i) { s.classList.toggle('is-on', i === on); s.classList.toggle('is-prev', i === prev); });
      }, 5500);
    }, n * 1800);
  });

  // Storylines are capped at 5 lines; "Read more" only shows when one actually overflows.
  document.querySelectorAll('[data-clamp]').forEach(function (p) {
    var btn = p.parentNode.querySelector('[data-clamp-btn]');
    if (!btn || p.scrollHeight <= p.clientHeight + 1) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var open = p.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Show less' : 'Read more';
    });
  });

  // Biggest edges ⇄ all stats
  document.querySelectorAll('[data-more]').forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var edges = btn.previousElementSibling;
      var open = edges.classList.toggle('is-all');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? 'Show biggest edges only' : label;
    });
  });
${isAdmin ? REGEN_JS : ''}
})();
</script>`;
}

function gamesPageScript() {
  return `<script>
(function () {
  // Team / type filters on the results grid
  var grid = document.querySelector('.gr-grid');
  var state = { team: '', type: '' };
  function applyFilters() {
    if (!grid) return;
    var shown = 0;
    grid.querySelectorAll('.gr-card').forEach(function (c) {
      var ok = (!state.team || c.dataset.teams.split(' ').indexOf(state.team) !== -1)
        && (!state.type || (state.type === 'playoff' ? c.dataset.type !== 'regular' : c.dataset.type === state.type));
      c.hidden = !ok; if (ok) shown++;
    });
    var empty = document.querySelector('.gr-empty');
    if (empty) empty.hidden = shown !== 0;
    var count = document.querySelector('[data-games-count]');
    if (count) count.textContent = shown + (shown === 1 ? ' game' : ' games');
  }
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.filter;
      state[key] = btn.dataset.value;
      document.querySelectorAll('[data-filter="' + key + '"]').forEach(function (b) { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      applyFilters();
    });
  });

  // React / share on result cards
  if (grid) grid.addEventListener('click', function (e) {
    var reactBtn = e.target.closest('[data-action="react-game"]');
    if (reactBtn) {
      reactBtn.disabled = true;
      fetch('/games/' + encodeURIComponent(reactBtn.dataset.gameId) + '/react', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(function (r) { if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return null; } return r.json(); })
        .then(function (d) { reactBtn.disabled = false; if (!d || !d.ok) return; reactBtn.classList.toggle('is-active', d.reacted); reactBtn.querySelector('span').textContent = d.count; })
        .catch(function () { reactBtn.disabled = false; });
      return;
    }
    var shareBtn = e.target.closest('[data-action="share-game"]');
    if (shareBtn) {
      var url = window.location.origin + shareBtn.dataset.url;
      if (navigator.share) { navigator.share({ url: url }).catch(function () {}); return; }
      navigator.clipboard.writeText(url).then(function () {
        var orig = shareBtn.innerHTML; shareBtn.textContent = '✓';
        setTimeout(function () { shareBtn.innerHTML = orig; }, 1500);
      }).catch(function () {});
    }
  });
})();
</script>`;
}

export function gamesPage({
  games, season, seasons = [], currentSeason, seasonPlayedCount = 0, summary = null, isAdmin = false, isPlayer = false,
  tiles = [], potg = [], matchups = [], stories = {}, pickCounts = {}, myPicks = {}, picks = null, previewHrefs = {}, recapDay = null,
  commentsEnabled = false, socialByGame = {}, topScorerByGame = {}, oddsByGame = {},
}) {
  const seasonLinks = [...seasons.map(s => ({ v: s, label: `Season ${s}` })), { v: 'all', label: 'All seasons' }]
    .map(s => `<a href="/games${s.v === String(currentSeason) ? '' : `?season=${s.v}`}" class="gr-seg${s.v === season ? ' is-on' : ''}"${s.v === season ? ' aria-current="page"' : ''}><span class="pill-label">${escHtml(s.label)}</span></a>`).join('');

  const tilesHtml = tiles.length ? `<div class="gr-tiles">${tiles.map(t => `<a href="${t.href}" class="gr-tile${t.accent ? ' gr-tile--accent' : ''}">
      <span class="gr-tile__lbl">${escHtml(t.label)}</span>
      <b class="gr-tile__val font-condensed">${escHtml(t.value)}</b>
      <span class="gr-tile__sub">${escHtml(t.sub)}</span>
    </a>`).join('')}</div>` : '';

  // Ordered by time: what's next on top, then the last game day's recap (storyline + POTG),
  // then the season — each block under its own header so they don't run together.
  const matchupsHtml = matchups.length ? `<section class="gr-sec" aria-labelledby="gr-next-h">
  <div class="section-header"><h2 id="gr-next-h">Up next <span class="section-header__sub">${escHtml(dayLabel(matchups[0].ymd))}</span></h2><a href="/picks" class="section-header__link">Picks &amp; race →</a></div>
  <div class="gm-grid${matchups.length === 1 ? ' gm-grid--one' : ''}">
    ${matchups.map(m => matchupCard(m, { story: stories[m.game.id], counts: pickCounts[m.game.id] || { a: 0, b: 0 }, myPick: myPicks[m.game.id], isAdmin, isPlayer, pickState: picks?.states?.[m.game.id] || null, pickers: picks?.pickers?.[m.game.id] || null, variant: 'semi', state: picks?.states?.[m.game.id]?.closed ? 'closed' : 'open', href: previewHrefs[m.game.id] || '/picks', talk: commentsEnabled })).join('')}
  </div>
</section>` : '';

  const recapInner = `${summaryPanel(summary, 'headlines', isAdmin)}${potgMarquee(potg)}`;
  const recapHtml = recapInner.trim() ? `<section class="gr-sec gr-recap" aria-labelledby="gr-recap-h">
  <div class="section-header"><h2 id="gr-recap-h">Recap${recapDay ? ` <span class="section-header__sub">${escHtml(dayLabel(recapDay))}</span>` : ''}</h2></div>
  ${recapInner}
</section>` : '';

  const teams = ['WHITE', 'BLACK', 'BLUE', 'MAROON'].filter(t => games.some(g => g.team_a_name === t || g.team_b_name === t));
  const hasPost = games.some(g => g.game_type && g.game_type !== 'regular');
  const filters = games.length ? `<div class="gr-filters">
    <div class="gr-chips" role="group" aria-label="Filter by team">
      <button type="button" class="gr-chip is-on" data-filter="team" data-value="" aria-pressed="true">All teams</button>
      ${teams.map(t => `<button type="button" class="gr-chip" data-filter="team" data-value="${t}" aria-pressed="false">${dot(t)}${escHtml(tc(t))}</button>`).join('')}
    </div>
    ${hasPost ? `<div class="gr-chips" role="group" aria-label="Filter by game type">
      <button type="button" class="gr-chip is-on" data-filter="type" data-value="" aria-pressed="true">All</button>
      <button type="button" class="gr-chip" data-filter="type" data-value="regular" aria-pressed="false">Regular</button>
      <button type="button" class="gr-chip" data-filter="type" data-value="playoff" aria-pressed="false">Playoffs</button>
    </div>` : ''}
  </div>` : '';

  const cards = games.map(g => gameCard(g, {
    commentsEnabled,
    social: socialByGame[g.id] || { commentsCount: 0, reactCount: 0, reacted: false },
    topScorer: topScorerByGame[g.id],
    odds: oddsByGame[g.id] || null,
  })).join('\n    ');

  return `<div class="page-content gr-page">
${pageHeader({ title: 'Games', description: 'Every result — box scores, recaps and Player of the Game spotlights.', actions: seasons.length ? `<nav class="gr-segs" aria-label="Season">${seasonLinks}</nav>` : '' })}
${matchupsHtml}
${recapHtml}
${tilesHtml}
<section class="gr-results" aria-labelledby="gr-results-h">
  <div class="section-header"><h2 id="gr-results-h">${season === 'all' ? 'All results' : `Season ${escHtml(season)} results`} <span class="section-header__sub" data-games-count>${games.length} ${games.length === 1 ? 'game' : 'games'}</span></h2></div>
  ${filters}
  ${games.length ? `<div class="gr-grid">${cards}</div><div class="card gr-empty" hidden>No games match these filters.</div>` : `<div class="card gr-empty">No results yet${season !== 'all' ? ` for Season ${escHtml(season)}` : ''}.</div>`}
</section>
</div>
${gamesPageScript()}
${matchups.length || isAdmin ? matchupScript({ isAdmin }) : ''}
${matchups.length ? pickBoxScript() : ''}`;
}

// Shared with views/picks.js (the /picks page reuses the "Who called it?" cards and avatars).
export { calledItCard, pickAvatar, FLAME, dot, tc, dayLabel, shortDayLabel, matchupCard, matchupScript, edgeRow, barsScript, oddsLine, scorerCard, meetingTile, storyHtml, gameCard, gamesPageScript };
