// /admin/ratings with "Rate your game" on (lib/game-ratings.js, docs/plans/ratings-and-raffle.md).
// Tabs: Conduct watch, Players, All ratings, By game, Raters, Old ratings (the roast-style
// archive, super admin). Who rated whom shows only to the super admin; other admins see the
// answers, tags and notes without the rater. Ratings point admins at players, they never
// decide anything: qualification rests on fines and reports, shown alongside.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, pageTabs, section, badge, button, emptyState, avatar, ago, statStrip } from './ui.js';
import { TAG_LABEL, isBadTag, WATCH_MIN_NO_RATERS, WATCH_MIN_GAMES } from '../../lib/game-ratings.js';

const ANSWER_TONE = { yes: 'green', maybe: 'amber', no: 'red', skip: 'gray' };
const name = n => displayPlayerName(n || 'Unknown');
const tagsOf = json => { try { return JSON.parse(json || '[]'); } catch { return []; } };
const tagPills = keys => keys.map(k => badge(TAG_LABEL[k] || k, isBadTag(k) ? 'red' : 'gray')).join(' ');
const countPills = list => list.map(t => badge(`${t.label} ×${t.n}`, isBadTag(t.k) ? 'red' : 'gray')).join(' ');
const table = (head, rows) => `<div class="aui-table-wrap"><table class="aui-table"><thead><tr>${head.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const gameLink = (kind, ref, label) => `<a href="/rate/${kind}/${encodeURIComponent(ref)}" class="aui-link">${escHtml(label)}</a>`;

function finesCell(f) {
  if (!f) return '<span class="aui-muted">None</span>';
  const parts = [];
  if (f.approved) parts.push(badge(`${f.approved} upheld`, 'red'));
  if (f.open) parts.push(badge(`${f.open} open`, 'amber'));
  return parts.join(' ') || '<span class="aui-muted">None</span>';
}

function watchTab({ watch }) {
  const intro = `<p class="aui-muted" style="margin-bottom:12px">Players where ${WATCH_MIN_NO_RATERS}+ different players answered "No" and who have ratings from ${WATCH_MIN_GAMES}+ games. A nudge to keep an eye out, talk to them, or open a report if something real happened. Ratings never decide qualification on their own: fines and reports do.</p>`;
  if (!watch.length) return intro + emptyState({ title: 'Nobody on the watch list', sub: 'Everyone is fine to play with so far.', done: true });
  return intro + table(['Player', 'Answers', 'What went wrong', 'Fines & reports', ''], watch.map(w => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px">${avatar(name(w.name), w.color, { playerId: w.id })}<a class="aui-link" href="/admin/players/${encodeURIComponent(w.id)}">${escHtml(name(w.name))}</a></div></td>
    <td>${badge(`No ×${w.s.no}`, 'red')} ${badge(`Maybe ×${w.s.maybe}`, 'amber')} ${badge(`Yes ×${w.s.yes}`, 'green')}<div class="aui-muted">${w.s.noRaters} said No · ${w.s.raters} raters · ${w.s.games} games</div></td>
    <td>${countPills(w.s.bad) || '<span class="aui-muted">No tags</span>'}</td>
    <td>${finesCell(w.fines)}</td>
    <td><a class="aui-link" href="/admin/ratings?tab=all&amp;player=${encodeURIComponent(w.id)}">See ratings</a></td>
  </tr>`));
}

function playersTab({ players }) {
  if (!players.length) return emptyState({ title: 'No ratings yet', sub: 'They come in after games once "Rate your game" is on.' });
  return table(['Player', 'Yes', 'Maybe', 'No', 'Raters', 'Games', 'Tags', 'One-tap links'], players.map(p => `<tr>
    <td><a class="aui-link" href="/admin/ratings?tab=all&amp;player=${encodeURIComponent(p.id)}">${escHtml(name(p.name))}</a>${p.s.watch ? ` ${badge('Watch', 'red')}` : ''}</td>
    <td>${p.s.yes}</td><td>${p.s.maybe}</td><td>${p.s.no}</td><td>${p.s.raters}</td><td>${p.s.games}</td>
    <td>${countPills([...p.s.good, ...p.s.bad].slice(0, 6))}</td>
    <td>${button(p.linksOff ? 'Turn on' : 'Turn off', { size: 'sm', kind: 'ghost', attrs: `data-post-json="/admin/ratings/players/${encodeURIComponent(p.id)}/links" data-body='${JSON.stringify({ off: !p.linksOff })}' data-done="Saved."` })}${p.linksOff ? ` ${badge('Off', 'gray')}` : ''}</td>
  </tr>`));
}

function allTab({ ratings, isSuper, playerFilter, gameLabels }) {
  if (!ratings.length) return emptyState({ title: playerFilter ? 'No ratings for this player' : 'No ratings yet' });
  const head = [...(isSuper ? ['Rater'] : []), 'Player', 'Answer', 'Tags & note', 'Game', 'When', ''];
  return table(head, ratings.slice(0, 500).map(r => `<tr${r.ignored ? ' style="opacity:.5"' : ''}>
    ${isSuper ? `<td>${escHtml(name(r.rater_name))}</td>` : ''}
    <td>${escHtml(name(r.ratee_name))}</td>
    <td>${badge(r.answer, ANSWER_TONE[r.answer])}${r.via === 'email' ? ` <span class="aui-muted">via email link</span>` : ''}</td>
    <td>${tagPills(tagsOf(r.tags_json))}${r.note ? `<div class="aui-muted" style="margin-top:4px">“${escHtml(r.note)}”</div>` : ''}</td>
    <td>${gameLink(r.kind, r.ref, gameLabels[`${r.kind}:${r.ref}`] || r.kind)}</td>
    <td class="aui-muted">${escHtml(ago(r.updated_at))}</td>
    <td style="white-space:nowrap">${button(r.ignored ? 'Count it' : 'Ignore', { size: 'sm', kind: 'ghost', attrs: `data-post-json="/admin/ratings/${encodeURIComponent(r.id)}/ignore" data-body='${JSON.stringify({ ignored: !r.ignored })}' data-done="Saved."` })}${isSuper ? ` ${button('Delete', { size: 'sm', kind: 'danger', attrs: `data-post-json="/admin/ratings/${encodeURIComponent(r.id)}/delete" data-confirm data-confirm-title="Delete this rating?" data-confirm-body="It's removed for good." data-done="Deleted."` })}` : ''}</td>
  </tr>`));
}

function gamesTab({ rounds, gameLabels }) {
  if (!rounds.length) return emptyState({ title: 'No games asked about yet' });
  return table(['Game', 'Asked', 'Emailed', 'Rated', 'Response', 'When'], rounds.map(r => `<tr>
    <td>${badge(r.kind === 'league' ? 'League' : 'Papawis', r.kind === 'league' ? 'blue' : 'amber')} ${gameLink(r.kind, r.ref, gameLabels[`${r.kind}:${r.ref}`] || r.ref)}</td>
    <td>${r.asked}</td><td>${r.emailed || 0}</td><td>${r.responded}</td>
    <td>${r.asked ? Math.round(r.responded / r.asked * 100) : 0}%</td>
    <td class="aui-muted">${escHtml(ago(r.asked_at))}</td>
  </tr>`));
}

function ratersTab({ flags, isSuper }) {
  const intro = '<p class="aui-muted" style="margin-bottom:12px">Raters with 5+ answers where 60% or more are "No". Could be honest, could be a grudge: worth a look before trusting their answers.</p>';
  if (!isSuper) return intro + emptyState({ title: 'Super admin only', sub: 'This list names raters.' });
  if (!flags.length) return intro + emptyState({ title: 'No raters stand out', done: true });
  return intro + table(['Rater', 'Answers', '"No"', ''], flags.map(f => `<tr>
    <td>${escHtml(name(f.raterName))}</td><td>${f.total}</td><td>${f.no} (${Math.round(f.no / f.total * 100)}%)</td>
    <td><a class="aui-link" href="/admin/ratings?tab=all&amp;rater=${encodeURIComponent(f.raterId)}">See their ratings</a></td>
  </tr>`));
}

// x: { tab, isSuper, watch, players, ratings, rounds, flags, gameLabels, counts, playerFilter, legacyHtml }
export function adminGameRatingsBody(x) {
  const t = x.tab;
  const tabs = pageTabs([
    { label: 'Conduct watch', href: '/admin/ratings', count: x.watch.length, active: t === 'watch' },
    { label: 'Players', href: '/admin/ratings?tab=players', count: x.players.length, active: t === 'players' },
    { label: 'All ratings', href: '/admin/ratings?tab=all', count: x.counts.ratings, active: t === 'all' },
    { label: 'By game', href: '/admin/ratings?tab=games', count: x.rounds.length, active: t === 'games' },
    { label: 'Raters', href: '/admin/ratings?tab=raters', active: t === 'raters' },
    ...(x.isSuper ? [{ label: 'Old ratings', href: '/admin/ratings?tab=legacy', active: t === 'legacy' }] : []),
  ]);
  const body = t === 'players' ? playersTab(x) : t === 'all' ? allTab(x) : t === 'games' ? gamesTab(x) : t === 'raters' ? ratersTab(x) : t === 'legacy' ? x.legacyHtml : watchTab(x);
  return `${pageHeader({ eyebrow: 'Community', title: 'Player ratings', sub: `"Rate your game" answers. Anonymous to players${x.isSuper ? '; you see who rated whom' : '; only the super admin sees who rated whom'}.` })}
  ${statStrip([
    { label: 'Ratings', value: String(x.counts.ratings) },
    { label: 'Players rated', value: String(x.players.length) },
    { label: 'Games asked', value: String(x.rounds.length) },
    { label: 'On watch', value: String(x.watch.length) },
  ])}
  ${tabs}
  ${section({ title: { watch: 'Conduct watch', players: 'Players', all: 'All ratings', games: 'By game', raters: 'Raters to check', legacy: 'Old roast-style ratings' }[t] || 'Conduct watch', bodyHtml: body })}`;
}
