// Compare (games admins): a game's saved box score against its video re-track, then Replace the
// box score, Back to the re-track, or Keep the saved one (Paolo, 2026-11-10, mockup
// claude.ai/artifact/BNeRKL2kkH25NLsqZr45Z2). Every button posts to the site's own routes
// (/admin/games/:id/scoring/replace, /scoring/review discard) through public/app.js
// [data-adm-post]; data-adm-then takes the screen back to the game afterwards.
import { esc, backChev, icons } from './layout.js';

// d: server.js /app/games/:id/compare (retrackCompare plus the teams, links and what blocks a replace).
export function appRetrackComparePage({ back, missing = '', d = {} }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Compare</span><span></span></div>`;
  if (missing) return `${nav}<div class="empty" style="margin-top:12px">${esc(missing)}</div>`;
  const side = t => (t === 'a' ? d.a : d.b);
  const dot = t => `<i class="dot" style="--c:${esc(side(t).color)}"></i>`;
  const score = s => `${s.a}–${s.b}`;
  const status = d.over
    ? `<p class="msg msg--ok rt-status">${icons.check}Re-track at Game over · ${d.count} plays</p>`
    : `<p class="msg rt-status rt-status--plain">Re-track so far · ${esc(d.at)} · ${d.pct}%</p>`;
  const apart = d.savedAt ? Math.abs(d.savedAt.a - d.re.a) + Math.abs(d.savedAt.b - d.re.b) : 0;
  const scores = `<div class="rt-scores">
      <div class="fc rt-sc"><span class="kick rt-kick--mut">Saved</span><b class="num">${score(d.saved)}</b><small>${esc(d.source)} · on the site</small></div>
      <div class="fc rt-sc rt-sc--re"><span class="kick">Re-track</span><b class="num">${score(d.re)}</b><small>${d.over ? 'From the video' : 'So far · admins only'}</small></div>
    </div>
    ${d.savedAt ? `<p class="rt-at">Saved at ${esc(d.at)}: <b class="num">${score(d.savedAt)}</b> · ${apart ? `${apart} point${apart === 1 ? '' : 's'} apart` : 'same as the re-track'}</p>` : ''}`;
  const cell = c => (c.saved === c.re ? `<span class="num rt-same">${c.re}</span>` : `<span class="num"><span class="rt-was">${c.saved}→</span>${c.re}</span>`);
  const teams = d.over ? `<h2 class="rt-h">Team totals</h2>
    <div class="fc rt-tbl" role="table" aria-label="Team totals, saved to re-track">
      <div class="rt-row rt-row--h" role="row"><span role="columnheader"></span>${d.teams[0].cells.map(c => `<span role="columnheader">${esc(c.label)}</span>`).join('')}</div>
      ${d.teams.map(t => `<div class="rt-row" role="row"><span role="cell" class="rt-team">${dot(t.side)}${esc(side(t.side).name)}</span>${t.cells.map(c => `<span role="cell">${cell(c)}</span>`).join('')}</div>`).join('')}
    </div>` : '';
  const players = d.over ? `<div class="rt-hrow"><h2 class="rt-h">Players that differ · ${d.players.length}</h2><small class="mut">${d.match} match</small></div>
    ${d.players.length ? `<div class="fc rt-list">${d.players.map(p => `<div class="rt-p">${dot(p.team)}<span class="rt-pn">${esc(p.name)}</span><span class="rt-chips">${p.diffs.map(x => `<span class="rt-chip num"><span class="rt-was">${esc(x.label)} ${x.saved}→</span>${x.re}</span>`).join('')}</span></div>`).join('')}</div>`
      : '<div class="empty">Every player’s line is the same in both.</div>'}`
    : '<div class="empty">Player by player opens when the re-track reaches Game over.</div>';
  // Replace: with the typed final or the plays' score when they differ (the scorer's rule).
  const ask = final => `${final === 'plays' ? `Final score ${score(d.mismatch.plays)} from the plays. ` : final === 'typed' ? `Final score stays ${score(d.mismatch.typed)}. ` : ''}The re-track becomes the box score${d.hidden ? ' (players see it once Visible to everyone is on)' : ' on the site and in the app'}. The saved one is kept on record: Undo the replace puts it back`;
  const replaceBtn = (final, label, primary) => `<button type="button" class="btn${primary ? '' : ' btn--ghost'}" data-adm-post="${esc(d.replace)}" data-adm-body="${esc(JSON.stringify({ final }))}" data-adm-ask-title="Replace the box score?" data-adm-ask-yes="Replace it" data-adm-ask-icon="up" data-adm-ask="${esc(ask(final))}" data-adm-done="Box score replaced" data-adm-then="${esc(d.gameHref)}">${esc(label)}</button>`;
  const replace = !d.over ? '' : d.blocked ? `<p class="msg msg--info rt-status--plain">${esc(d.blocked)}</p>`
    : d.mismatch ? `<p class="rt-mm">The plays add up to <b>${score(d.mismatch.plays)}</b>; the final score says <b>${score(d.mismatch.typed)}</b>.</p>${replaceBtn('plays', `Replace with ${score(d.mismatch.plays)} (the plays)`, true)}${replaceBtn('typed', `Replace, keep ${score(d.mismatch.typed)}`, false)}`
    : replaceBtn('', 'Replace the box score', true);
  // An approver keeps the saved one and makes it official; anyone else just throws the re-track away.
  const keep = d.held ? '' : d.approver
    ? `<button type="button" class="btn btn--ghost" data-adm-post="${esc(d.discard)}" data-adm-body="${esc(JSON.stringify({ action: 'discard', keep: true }))}" data-adm-ask-title="Keep the saved one?" data-adm-ask-yes="Keep it" data-adm-ask-icon="flag" data-adm-ask="The re-track is thrown away (kept on record, never counted) and the saved box score becomes official" data-adm-done="Saved box score is official" data-adm-then="${esc(d.gameHref)}">Keep the saved one</button>`
    : `<button type="button" class="btn btn--ghost" data-adm-post="${esc(d.discard)}" data-adm-body="${esc(JSON.stringify({ action: 'discard' }))}" data-adm-ask-title="Throw away the re-track?" data-adm-ask-yes="Throw it away" data-adm-ask-icon="flag" data-adm-ask="The re-track is thrown away (kept on record, never counted). The saved box score stays as it is" data-adm-done="Re-track thrown away" data-adm-then="${esc(d.gameHref)}">Throw away the re-track</button>`;
  return `${nav}
  <div class="rt">
    ${status}
    ${scores}
    ${teams}
    ${players}
  </div>
  <div class="rt-acts">
    ${replace}
    <div class="rt-acts__2"><a class="btn${d.over && !d.blocked ? ' btn--ghost' : ''}" href="${esc(d.retrack)}">${d.over ? 'Back to the re-track' : 'Continue the re-track'}</a>${keep}</div>
  </div>`;
}
