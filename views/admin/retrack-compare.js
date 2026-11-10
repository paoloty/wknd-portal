// /admin/games/:id/compare: the saved box score against the video re-track, full width (Paolo,
// 2026-11-10: "like comparing code in Visual Studio"; redesign after the Fable audit, mockup
// claude.ai/artifact/MYdBwkuzKoJmPoE5YsbBmQ). Each row meets in the middle:
//   − saved play | clock | score ‖ score | clock | re-track play +
// each side with its own clock and score (they never match exactly). Matching runs fold away
// (Differences) or show (Every play, ?all=1). A strip on the right edge is the whole game with a
// tick per spot that differs (click to jump); the panel names each spot and what it changes, then
// the box score changes and Replace / Keep the saved one. Saved is neutral grey, the re-track amber
// (amber is the only accent); − / + and words carry the meaning. Every button posts to the
// Scoring tab's own routes.
import { escHtml } from '../layout.js';
import { pageHeader, section, button, banner } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const sc = s => `${s.a}–${s.b}`;
const ICON = { missing: '−', extra: '+', player: '≠', result: '≠', many: '≠' };

// d: server.js GET /admin/games/:id/compare. c: retrackCompare(game, { full: true }).
export function adminRetrackCompareBody({ game, c, d }) {
  const base = `/admin/games/${encodeURIComponent(game.id)}`;
  const post = (label, url, body, { kind = 'secondary', confirm, then = `${base}?tab=scoring` } = {}) => button(label, { kind, size: 'sm', attrs: `data-post-json="${url}" data-body="${attr(JSON.stringify(body || {}))}" data-then="${then}"${confirm ? ` data-confirm data-confirm-title="${attr(confirm[0])}" data-confirm-body="${attr(confirm[1])}" data-confirm-send="${attr(confirm[2])}"` : ''}` });
  const back = button('Back to the Scoring tab', { kind: 'ghost', size: 'sm', href: `${base}?tab=scoring` });
  const head = pageHeader({ eyebrow: `${game.team_a_name} vs ${game.team_b_name}`, title: 'Saved vs re-track', sub: c.over ? `Re-track at Game over · ${c.count} plays` : `Re-track so far · ${c.at} · ${c.pct}%`, actionsHtml: back });
  if (!c.count) return `${head}${banner('info', 'No re-track yet. Start one from the Scoring tab.')}`;

  const scores = `<div class="arc-scores">
      <div class="arc-sc"><span class="arc-k">Saved · ${escHtml(c.source)} · on the site</span><b>${escHtml(game.team_a_name)} ${sc(c.saved)} ${escHtml(game.team_b_name)}</b></div>
      <div class="arc-sc arc-sc--re"><span class="arc-k">Re-track${c.over ? ' · Game over' : ' so far'}</span><b>${escHtml(game.team_a_name)} ${sc(c.re)} ${escHtml(game.team_b_name)}</b></div>
    </div>`;
  const p = c.pbp;
  const segs = p ? p.segs : [];

  // The rows, side by side.
  let table = '';
  if (!p) table = '<div class="aui-panel"><p class="aui-muted">The saved box score came from a wknd-stats file: it has no plays to line up. The box score changes on the right compare the two.</p></div>';
  else {
    const rows = p.rows;
    const keepIdx = new Set();
    if (!d.all) rows.forEach((r, i) => { if (r.t !== 'same') { keepIdx.add(i); keepIdx.add(i - 1); keepIdx.add(i + 1); } });
    const period = r => String((r.s || r.r || {}).when || '').split(' ')[0];
    const side = (x, sideKey, t) => {
      const mine = sideKey === 's' ? (t === 'missing' || t === 'player' || t === 'result') : (t === 'extra' || t === 'player' || t === 'result');
      if (!x) return `<span class="arc-c arc-c--none"></span><span class="arc-c arc-c--none"></span><span class="arc-c arc-c--none"></span>`;
      const play = `<span class="arc-c arc-play">${mine ? `<span class="arc-tag">${sideKey === 's' ? 'Saved' : 'Re-track'}</span>` : ''}<span${mine && (t === 'player') ? ' class="arc-hl"' : ''}>${escHtml(x.name)}</span><span>${escHtml(x.rest)}</span></span>`;
      const clock = `<span class="arc-c arc-clock">${escHtml(String(x.when).split(' ').slice(1).join(' ') || x.when)}</span>`;
      const score = `<span class="arc-c arc-score">${escHtml(x.score)}</span>`;
      return sideKey === 's' ? `${play}${clock}${score}` : `${score}${clock}${play}`;
    };
    let html = '', last = -1, lastPeriod = '', folded = 0;
    const fold = n => `<div class="arc-fold"><span>⋯</span><span>${n} matching play${n === 1 ? '' : 's'}</span><a href="${base}/compare?all=1">Show every play</a></div>`;
    rows.forEach((r, i) => {
      if (!d.all && !keepIdx.has(i)) { folded++; return; }
      if (folded) { html += fold(folded); folded = 0; }
      const per = period(r);
      if (per && per !== lastPeriod) { html += `<div class="arc-q">${escHtml(per)}</div>`; lastPeriod = per; }
      const t = r.t;
      const lSign = t === 'missing' || t === 'player' || t === 'result' ? '−' : '', rSign = t === 'extra' || t === 'player' || t === 'result' ? '+' : '';
      html += `<div class="arc-row arc-row--${t}${r.off ? ' is-off' : ''}"${r.hunk ? ` id="h-${r.hunk}"` : ''}>
        <span class="arc-c arc-sign">${lSign}</span>${side(r.s, 's', t)}<span class="arc-mid" aria-hidden="true"></span>${side(r.r, 'r', t)}<span class="arc-c arc-sign arc-sign--r">${rSign}</span></div>`;
      last = i;
    });
    if (folded) html += fold(folded);
    // The strip: the whole game, a tick per spot.
    const ticks = segs.map(h => `<a class="arc-tick arc-tick--${h.type}" href="#h-${h.n}" style="top:${(h.pos * 100).toFixed(1)}%" title="${attr(`${h.n}. ${h.title} · ${h.when}`)}" aria-label="${attr(`${h.n}: ${h.title}, ${h.when}`)}"></a>`).join('');
    const strip = `<div class="arc-strip" aria-label="The whole game: a tick per difference">${p.divergeAt !== null && p.divergeAt !== undefined ? `<div class="arc-strip__off" style="top:${(p.divergeAt * 100).toFixed(1)}%" title="The two scores stop matching from here"></div>` : ''}${ticks}</div>`;
    table = `<div class="arc-diff"><div class="arc-scroll"><div class="arc-grid">
        <div class="arc-row arc-row--head"><span></span><span class="arc-c arc-play">Saved · on the site</span><span class="arc-c arc-clock">Clock</span><span class="arc-c arc-score">Score</span><span class="arc-mid"></span><span class="arc-c arc-score">Score</span><span class="arc-c arc-clock">Clock</span><span class="arc-c arc-play">Re-track · from the video</span><span></span></div>
        ${html}</div></div>${strip}</div>
      <p class="aui-muted arc-note">Lined up play by play, never by the clock: a court game and a re-track from the video never keep the same time, so each side keeps its own clock and score. Scores in amber: the two stop matching there.${p.orderCount ? ` ${p.orderCount} play${p.orderCount === 1 ? ' is' : 's are'} in another order but the same in both: not counted.` : ''}${p.truncated ? ' A very long game: the first 2,500 plays were compared.' : ''}${c.over ? '' : ` Saved plays the re-track hasn’t reached yet: ${p.pending}.`}</p>`;
  }
  const filter = p ? `<div class="arc-filter">${button('Differences', { kind: d.all ? 'ghost' : 'secondary', size: 'sm', href: `${base}/compare` })} ${button('Every play', { kind: d.all ? 'secondary' : 'ghost', size: 'sm', href: `${base}/compare?all=1` })}</div>` : '';
  const legend = `<div class="arc-legend"><span><i class="arc-key arc-key--s">−</i>Missing in re-track</span><span><i class="arc-key arc-key--r">+</i>Extra in re-track</span><span><i class="arc-key arc-key--b">≠</i>Wrong player / made vs missed</span></div>`;
  const left = section({ title: 'Play by play', note: `· ${segs.length ? `${segs.length} difference${segs.length === 1 ? '' : 's'}` : 'every play matches'}`, asideHtml: filter, bodyHtml: `${p ? legend : ''}${table}` });

  // The panel: each spot, the box score changes, the decision.
  const spots = segs.length ? `<div class="arc-list">${segs.map(h => `<a class="arc-item" href="#h-${h.n}"><span class="arc-ico arc-ico--${h.type}" aria-hidden="true">${ICON[h.type]}</span><span class="arc-item__t">
      <span class="arc-item__h"><b>${escHtml(h.title)}</b><span>${escHtml(h.when)}</span></span>
      ${h.items.map(x => `<span>${escHtml(x.saved && x.re ? `${x.saved} → ${x.re}` : x.saved || x.re)}</span><span class="arc-item__e">${escHtml(x.effect)}</span>`).join('')}
      <span class="arc-item__at">at ${escHtml(h.at)}${h.delta ? ` · <em>${escHtml(h.delta)}</em>` : ''}</span></span></a>`).join('')}</div>`
    : `<div class="aui-panel"><p class="aui-muted">${p ? 'Every play matches.' : 'No plays to compare.'}</p></div>`;
  const teamCh = c.over ? c.teams.flatMap(t => t.cells.filter(x => x.saved !== x.re).map(x => `<span>${escHtml(t.side === 'a' ? game.team_a_name : game.team_b_name)} · ${escHtml(x.label)}</span><span class="arc-num"><span class="aui-muted">${x.saved} →</span> <b>${x.re}</b></span>`)) : [];
  const plCh = c.over ? c.players.flatMap(x => x.diffs.map(y => `<span>${escHtml(x.name)} · ${escHtml(y.label)}</span><span class="arc-num"><span class="aui-muted">${y.saved} →</span> <b>${y.re}</b></span>`)) : [];
  const changes = c.over ? `<div class="aui-panel aui-stack">${teamCh.length || plCh.length ? `<div class="arc-ch">${[...teamCh, ...plCh].join('')}</div>` : '<p class="aui-muted">Nothing changes.</p>'}<p class="aui-muted">${c.match} player${c.match === 1 ? '' : 's'} match.</p></div>`
    : '<div class="aui-panel"><p class="aui-muted">The box score changes show once the re-track reaches Game over.</p></div>';
  const replaceBody = final => `${final === 'plays' ? `Final score ${sc(d.mismatch.plays)} from the plays. ` : d.mismatch ? `The final score stays ${sc(d.mismatch.typed)}. ` : ''}The re-track becomes the box score in one step and the stats are official. The saved one is kept on record: Undo the replace puts it back.`;
  const replaceBtn = (final, label, kind) => post(label, `${base}/scoring/replace`, { final }, { kind, confirm: ['Replace the box score?', replaceBody(final), 'Replace it'] });
  const acts = !c.over ? `<p class="aui-muted">Replace opens when the re-track reaches Game over.</p>`
    : d.blocked ? `<p class="aui-muted">${escHtml(d.blocked)}</p>`
    : d.mismatch ? `<p>The plays add up to <b>${sc(d.mismatch.plays)}</b>; the final score says <b>${sc(d.mismatch.typed)}</b>.${c.explain ? ` ${escHtml(c.explain)}` : ''}</p><div>${replaceBtn('typed', `Replace, keep ${sc(d.mismatch.typed)}`, 'primary')}</div><div>${replaceBtn('plays', `Use the plays’ ${sc(d.mismatch.plays)} instead`, 'ghost')}</div>`
    : `<div>${replaceBtn('', 'Replace the box score', 'primary')}</div>`;
  const keep = d.held ? '' : d.approver && c.over && d.open
    ? post('Keep the saved one (official)', `${base}/scoring/review`, { action: 'discard', keep: true }, { kind: 'ghost', confirm: ['Keep the saved one?', 'The re-track is thrown away (kept on record, never counted) and the saved box score becomes official.', 'Keep it'] })
    : post('Throw away the re-track', `${base}/scoring/review`, { action: 'discard' }, { kind: 'ghost', confirm: ['Throw away the re-track?', 'The re-track is thrown away (kept on record, never counted). The saved box score isn’t touched.', 'Throw it away'] });
  const decide = `<div class="aui-panel aui-stack">${acts}<div>${button(c.over ? 'Back to the re-track' : 'Continue the re-track', { kind: 'secondary', size: 'sm', href: `${base}/score?pass=video` })} ${keep}</div></div>`;
  const right = `${section({ title: 'The differences', bodyHtml: spots })}${section({ title: 'Box score changes', bodyHtml: changes })}${section({ title: 'Decide', bodyHtml: decide })}`;

  return `${head}${scores}<div class="arc-layout"><div class="arc-main">${left}</div><aside class="arc-side">${right}</aside></div>`;
}
