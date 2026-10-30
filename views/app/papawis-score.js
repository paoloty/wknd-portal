// Finish the run (2026-10-30, mockup claude.ai/artifact/QyYMf51jSBCFrSK3ddi1ss "Finish the run"):
// after a Papawis run's games are scored, keep or discard each game, then pick the Player of the
// Day (the top box-score rating over the kept games is ticked; change it if someone else ran the
// show), then Save. Plain links and a form: Discard / Keep re-draw the page (?discard=2,3) with
// the ratings worked out again. Data and rules: server.js "Papawis scoring".
import { esc, backChev, appAvatar } from './layout.js';

const SIDE = { a: 'Light', b: 'Dark' };

// d: { id, title, day, done, games: [{ n, a, b, final, plays, stats, periodMin, periods, moves,
// discarded, toggle, edit }], discard, cands: [{ key, name, ini, photo, side, moved, line, rating,
// games }], pick, players }
export function appPapawisFinishPage({ back, missing = '', d = null }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Finish the run</span><span></span></div>`;
  if (missing || !d) return `${nav}<div class="empty">${esc(missing || 'Nothing to finish.')}</div>`;
  const kept = d.games.filter(g => !g.discarded);
  const game = g => `<div class="card pwf-game${g.discarded ? ' is-off' : ''}">
      <div class="pwf-game__h"><span class="kick">Game ${g.n} · ${g.periods} × ${g.periodMin} min · ${g.stats === 'full' ? 'Full' : 'Basic'}</span><small>${g.plays} play${g.plays === 1 ? '' : 's'}${g.moves ? ` · ${g.moves} move${g.moves === 1 ? '' : 's'}` : ''}${g.final ? '' : ' · not ended'}</small></div>
      <div class="pwf-game__s"><span class="pw-shirt pw-shirt--light" aria-hidden="true"></span>Light <b class="num">${g.a}</b><span aria-hidden="true">–</span><b class="num">${g.b}</b> Dark <span class="pw-shirt pw-shirt--dark" aria-hidden="true"></span>${g.discarded ? '<span class="pwf-game__tag">Discarded</span>' : ''}</div>
      ${g.discarded ? '<p class="pwf-game__n">Left out: it won’t show on the run or count in anyone’s stats.</p>' : ''}
      <div class="pwf-game__b">
        ${g.discarded ? '' : `<a class="btn btn--ghost" href="${esc(g.edit)}">Edit</a>`}
        <a class="btn btn--ghost${g.discarded ? '' : ' pwf-game__drop'}" href="/app/papawis/${esc(d.id)}/finish?discard=${esc(g.toggle)}">${g.discarded ? 'Keep it after all' : 'Discard'}</a>
      </div>
    </div>`;
  const line = c => `${c.line.pts} PTS · ${c.line.reb} REB · ${c.line.ast} AST`;
  const cand = (c, i) => `<label class="cell pwf-cand${c.key === d.pick ? ' is-on' : ''}">
      <input type="radio" name="potd" value="${esc(c.key)}"${c.key === d.pick ? ' checked' : ''}>
      ${appAvatar({ initials: c.ini, photoUrl: c.photo, ring: c.side === 'a' ? 'var(--team-white)' : 'var(--team-black)' })}
      <span class="cell__t">${esc(c.name)}<small>${esc(line(c))}${c.games > 1 ? ` · ${c.games} games` : ''}${c.moved ? ' · switched sides' : ''}</small></span>
      <span class="cell__v num">${c.rating}${i === 0 ? '<small>Top</small>' : ''}</span>
    </label>`;
  return `${nav}
  <p class="foot-note pwf-intro">${esc(d.title)} · ${esc(d.day)}. Check each game before the stats count. Edit opens the scorer on that game. Discard leaves a game out of everything.</p>
  ${d.walkIns && d.walkIns.length && d.admin ? `<p class="msg msg--warn pwf-walkins" role="status">Added at the court: ${esc(d.walkIns.join(', '))}. <a href="${esc(d.manage)}">Add them to the run</a> so they're charged.</p>` : ''}
  <div class="sec">Games</div>
  ${d.games.map(game).join('')}
  <form method="post" action="/app/papawis/${esc(d.id)}/finish" class="pwf-form">
    <input type="hidden" name="discard" value="${esc(d.discard)}">
    <div class="sec">Player of the Day</div>
    ${kept.length ? `<p class="foot-note">Picked by the rating, ${kept.length === 1 ? 'from the one game kept' : `all ${kept.length} kept games added up`}${d.basicRating ? ' (points, rebounds and assists: Basic games log no misses)' : ''}. Change it if someone else ran the show.</p>
    <div class="group">${d.cands.slice(0, 5).map(cand).join('')}</div>
    ${d.cands.length > 5 ? `<details class="pwf-more"><summary>Pick someone else</summary><div class="group">${d.cands.slice(5).map((c, i) => cand(c, i + 5)).join('')}</div></details>` : ''}
    <button type="submit" class="btn pwf-save">${d.done ? 'Save again' : 'Save the stats'}</button>
    <p class="foot-note">Saves ${kept.length} game${kept.length === 1 ? '' : 's'} to Papawis careers and leaders${d.done ? '' : '. The Player of the Day gets a bell'}.</p>`
      : '<div class="empty">Every game is discarded. Keep at least one to save the stats.</div>'}
  </form>`;
}
export { SIDE };
