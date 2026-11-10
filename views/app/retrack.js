// Compare (games admins): a game's saved box score against its video re-track, then Replace the
// box score, Back to the re-track, or Keep the saved one (Paolo, 2026-11-10; redesign after the
// Fable audit, mockup claude.ai/artifact/MYdBwkuzKoJmPoE5YsbBmQ). A strip of the whole game with a
// tick per spot that differs (tap to jump), then one card per spot: what kind of difference, when,
// the plays around it, the − saved / + re-track lines and what it changes in the box score.
// Saved is neutral grey, the re-track amber (amber is the only accent); − / + and the words carry
// the meaning, never the colour alone. Every button posts to the site's own routes
// (/admin/games/:id/scoring/replace, /scoring/review discard) through public/app.js
// [data-adm-post]; data-adm-then takes the screen back to the game afterwards.
import { esc, backChev, icons } from './layout.js';

const ICON = { missing: '−', extra: '+', player: '≠', result: '≠', many: '≠' };

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
  const scores = `<div class="rt-scores">
      <div class="fc rt-sc"><span class="kick rt-kick--mut">Saved</span><b class="num">${score(d.saved)}</b><small>${esc(d.source)} · on the site</small></div>
      <div class="fc rt-sc rt-sc--re"><span class="kick">Re-track</span><b class="num">${score(d.re)}</b><small>${d.over ? 'From the video' : 'So far · admins only'}</small></div>
    </div>`;

  // The spots, play by play.
  const p = d.pbp, MAX = 30;
  let pbp = '';
  if (p) {
    const segs = p.segs;
    const tick = h => `<a class="rd-tick rd-tick--${h.type}" href="#rd-${h.n}" style="left:${(h.pos * 100).toFixed(1)}%" aria-label="${esc(`${h.n}: ${h.title}, ${h.when}`)}"><i aria-hidden="true"></i></a>`;
    const strip = `<div class="fc rd-sum">
        <div class="rd-sum__h"><b>${segs.length ? `${segs.length} difference${segs.length === 1 ? '' : 's'}` : 'Every play matches'}</b><small>${d.over ? 'tap one to see it' : `so far · re-track at ${esc(p.through)}`}</small></div>
        ${segs.length ? `<div class="rd-strip" aria-label="The whole game, Q1 to the end">
          <div class="rd-strip__bar"><span></span><span></span><span></span><span></span></div>
          ${p.divergeAt !== null && p.divergeAt !== undefined ? `<div class="rd-strip__off" style="left:${(p.divergeAt * 100).toFixed(1)}%" title="The two scores stop matching from here"></div>` : ''}
          ${segs.map(tick).join('')}
        </div>
        <div class="rd-strip__q" aria-hidden="true"><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>` : ''}
        ${p.orderCount ? `<small class="rd-sum__n">${p.orderCount} play${p.orderCount === 1 ? '' : 's'} in another order, the same in both: not counted.</small>` : ''}
        ${p.truncated ? '<small class="rd-sum__n">A very long game: the first 2,500 plays were compared.</small>' : ''}
      </div>`;
    const line = (sideKey, text, item) => {
      if (!text) return '';
      const cut = text.indexOf(' · '), name = cut > 0 ? text.slice(0, cut) : text, rest = cut > 0 ? text.slice(cut) : '';
      const hl = item.type === 'player';
      return `<div class="rd-l rd-l--${sideKey}"><span class="rd-l__s" aria-hidden="true">${sideKey === 's' ? '−' : '+'}</span>
        <span class="rd-l__t"><span class="rd-l__tag">${sideKey === 's' ? 'Saved' : 'Re-track'}</span> <span${hl ? ' class="rd-l__hl"' : ''}>${esc(name)}</span>${esc(rest)}</span>
        <span class="rd-l__sc">${esc(sideKey === 's' ? item.sScore : item.rScore)}</span></div>`;
    };
    const ctx = t => (t ? `<div class="rd-l rd-l--ctx"><span class="rd-l__s" aria-hidden="true"></span><span class="rd-l__t">${esc(t)}</span><span></span></div>` : '');
    const card = h => `<section class="fc rd-card" id="rd-${h.n}">
        <div class="rd-card__h"><span class="rd-ico rd-ico--${h.type}" aria-hidden="true">${ICON[h.type]}</span>
          <span class="rd-card__t"><b>${esc(h.title)}</b><small>${esc(h.when)} · at ${esc(h.at)}${h.delta ? ` · <span class="rd-off">${esc(h.delta)}</span>` : ''}</small></span><span class="rd-card__n">${h.n} / ${segs.length}</span></div>
        <div class="rd-lines">${ctx(h.before)}${h.items.map(x => `${h.items.length > 1 ? `<div class="rd-sub">${esc(x.title)}</div>` : ''}${line('s', x.saved, x)}${line('r', x.re, x)}`).join('')}${ctx(h.after)}</div>
        <div class="rd-eff"><span>Box score</span>${h.items.map(x => `<b>${esc(x.effect)}</b>`).join('')}</div>
      </section>`;
    pbp = `${strip}${segs.slice(0, MAX).map(card).join('')}${segs.length > MAX ? `<p class="rt-at">And ${segs.length - MAX} more: the site’s compare page shows every one.</p>` : ''}
      <p class="rt-at">Lined up play by play, not by the clock (the two never keep the same time). Grey lines: the plays around it, the same in both.</p>`;
  } else pbp = '<p class="rt-at">The saved box score came from a wknd-stats file: it has no plays to line up, so only the totals are compared.</p>';

  // Totals: only what changes, as old → new.
  const teamChanges = d.over ? d.teams.flatMap(t => t.cells.filter(c => c.saved !== c.re).map(c => `<span class="rt-chip num">${dot(t.side)}<span class="rt-was">${esc(c.label)} ${c.saved}→</span>${c.re}</span>`)) : [];
  const totals = d.over ? `<div class="rt-hrow"><h2 class="rt-h">Box score changes</h2><small class="mut">${d.match} player${d.match === 1 ? '' : 's'} match</small></div>
    ${teamChanges.length ? `<div class="rt-chips rt-chips--l">${teamChanges.join('')}</div>` : ''}
    ${d.players.length ? `<div class="fc rt-list">${d.players.map(x => `<div class="rt-p">${dot(x.team)}<span class="rt-pn">${esc(x.name)}</span><span class="rt-chips">${x.diffs.map(y => `<span class="rt-chip num"><span class="rt-was">${esc(y.label)} ${y.saved}→</span>${y.re}</span>`).join('')}</span></div>`).join('')}</div>`
      : '<div class="empty">Every player’s line is the same in both.</div>'}` : '';

  // Replace keeps the typed final score unless the approver picks the plays' score; when the spots
  // account for the gap, the screen says so.
  const ask = final => `${final === 'plays' ? `Final score ${score(d.mismatch.plays)} from the plays. ` : d.mismatch ? `Final score stays ${score(d.mismatch.typed)}. ` : ''}The re-track becomes the box score${d.hidden ? ' (players see it once Visible to everyone is on)' : ' on the site and in the app'}, and the stats are official. The saved one is kept on record: Undo the replace puts it back`;
  const replaceBtn = (final, label, cls) => `<button type="button" class="btn${cls}" data-adm-post="${esc(d.replace)}" data-adm-body="${esc(JSON.stringify({ final }))}" data-adm-ask-title="Replace the box score?" data-adm-ask-yes="Replace it" data-adm-ask-icon="up" data-adm-ask="${esc(ask(final))}" data-adm-done="Box score replaced" data-adm-then="${esc(d.gameHref)}">${esc(label)}</button>`;
  const replace = !d.over ? '' : d.blocked ? `<p class="msg rt-status--plain">${esc(d.blocked)}</p>`
    : d.mismatch ? `<p class="rt-mm">The plays add up to <b>${score(d.mismatch.plays)}</b>; the final score says <b>${score(d.mismatch.typed)}</b>.${d.explain ? ` ${esc(d.explain)}` : ''}</p>${replaceBtn('typed', `Replace, keep ${score(d.mismatch.typed)}`, '')}${replaceBtn('plays', `Use the plays’ ${score(d.mismatch.plays)} instead`, ' btn--plain')}`
    : replaceBtn('', 'Replace the box score', '');
  // An approver keeps the saved one and makes it official; anyone else just throws the re-track away.
  const keep = d.held ? '' : d.approver
    ? `<button type="button" class="btn btn--ghost" data-adm-post="${esc(d.discard)}" data-adm-body="${esc(JSON.stringify({ action: 'discard', keep: true }))}" data-adm-ask-title="Keep the saved one?" data-adm-ask-yes="Keep it" data-adm-ask-icon="flag" data-adm-ask="The re-track is thrown away (kept on record, never counted) and the saved box score becomes official" data-adm-done="Saved box score is official" data-adm-then="${esc(d.gameHref)}">Keep saved (official)</button>`
    : `<button type="button" class="btn btn--ghost" data-adm-post="${esc(d.discard)}" data-adm-body="${esc(JSON.stringify({ action: 'discard' }))}" data-adm-ask-title="Throw away the re-track?" data-adm-ask-yes="Throw it away" data-adm-ask-icon="flag" data-adm-ask="The re-track is thrown away (kept on record, never counted). The saved box score stays as it is" data-adm-done="Re-track thrown away" data-adm-then="${esc(d.gameHref)}">Throw it away</button>`;
  return `${nav}
  <div class="rt">
    ${status}
    ${scores}
    ${pbp}
    ${totals}
  </div>
  <div class="rt-acts">
    ${replace}
    <div class="rt-acts__row"><a class="btn${d.over && !d.blocked ? ' btn--ghost' : ''}" href="${esc(d.retrack)}">${d.over ? 'Back to re-track' : 'Continue re-track'}</a>${keep}</div>
  </div>`;
}
