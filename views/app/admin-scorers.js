// Scorers in the app (Me → Scoring → Scorers, /app/admin/scorers, 2026-10-30): for admins.
// Games section: pick up to 2 scorers for each coming league game, and the game scorers (who
// score any game with scoring on). Papawis section: the Papawis scorers (any run). Every change
// posts to the site's own admin routes (/admin/games/:id/scoring, /admin/scorers,
// /admin/papawis/scorers) through public/app.js admPick and data-adm-post, so the site and the
// app stay one.
import { esc, appAvatar, backChev, chev, icons } from './layout.js';

const attrJson = o => esc(JSON.stringify(o));
const face = p => appAvatar({ playerId: p.id, initials: p.ini, ring: p.color, photoUrl: p.photo });

// One scorer with Remove (asks first).
function scorerRow(p, { url, what }) {
  return `<div class="cell adm-dep">
    ${face(p)}
    <span class="cell__t">${esc(p.name)}<small>${esc(p.team || ' ')}</small></span>
    <button type="button" class="adm-pill adm-pill--quiet" data-adm-post="${esc(url)}" data-adm-body="${attrJson({ on: false })}"
      data-adm-ask="Remove ${esc(p.name)} as a ${what}?" data-adm-done="${esc(p.name)} removed">Remove</button>
  </div>`;
}

// Opens the picker sheet (public/app.js admPick): search everyone, pick up to max, send.
const pickBtn = (label, { title, url, field, max, ids = [], only = '', note = '', done, cls = 'btn btn--ghost' }) =>
  `<button type="button" class="${cls}" data-adm-picker data-title="${esc(title)}" data-url="${esc(url)}" data-field="${field}" data-max="${max}"
    data-ids="${attrJson(ids)}"${only ? ` data-skip="${only}"` : ''}${note ? ` data-note="${esc(note)}"` : ''} data-done="${esc(done)}">${label}</button>`;

export function appAdminScorersPage({ can, games, people, gameScorers, pwScorers, papawisOn, back }) {
  const gamesPart = can.games ? `<div class="sec">Coming games</div>
    ${games.length ? `<div class="group">${games.map(g => {
      const who = g.picked.length ? g.picked.map(p => p.name).join(' and ') : 'No scorers picked';
      const state = !g.on ? ' · scoring off' : g.live ? ' · scoring now' : '';
      return pickBtn(`<span class="cell__t">${esc(g.title)}<small>${esc(g.when)}${state}</small><small class="${g.picked.length ? '' : 'adm-amber'}">${esc(who)}</small></span>${chev}`, {
        cls: 'cell adm-act', title: `Scorers · ${g.title}`, url: `/admin/games/${encodeURIComponent(g.id)}/scoring`, field: 'scorers', max: 2,
        ids: g.picked.map(p => p.id), note: g.on ? 'Up to 2. Anyone new gets a bell.' : 'Up to 2. Picking scorers turns scoring on for this game, and they get a bell.', done: 'Scorers saved' });
    }).join('')}</div>` : '<div class="empty">No coming games.</div>'}
    <p class="foot-note">Game scorers below can score any game with scoring on without being picked.</p>
    <div class="sec">Game scorers · ${gameScorers.length}</div>
    <div class="group">${gameScorers.length ? gameScorers.map(p => scorerRow(p, { url: `/admin/players/${encodeURIComponent(p.id)}/scorer`, what: 'game scorer' })).join('') : '<div class="cell adm-empty">No game scorers yet</div>'}</div>
    <div class="adm-actions">${pickBtn(`${icons.plus}Add a game scorer`, { title: 'Add a game scorer', url: '/admin/scorers/add', field: 'player_id', max: 1, only: 'game', done: 'Game scorer added' })}</div>` : '';
  const pwPart = can.papawis ? `<div class="sec">Papawis scorers · ${pwScorers.length}</div>
    <div class="group">${pwScorers.length ? pwScorers.map(p => scorerRow(p, { url: `/admin/papawis/scorers/${encodeURIComponent(p.id)}`, what: 'Papawis scorer' })).join('') : '<div class="cell adm-empty">No Papawis scorers yet</div>'}</div>
    <p class="foot-note">Papawis scorers score any run, one phone at a time. Separate from game scorers: add someone to both if they do both.${papawisOn ? '' : ' Papawis is turned off right now.'}</p>
    <div class="adm-actions">${pickBtn(`${icons.plus}Add a Papawis scorer`, { title: 'Add a Papawis scorer', url: '/admin/papawis/scorers/add', field: 'player_id', max: 1, only: 'pw', done: 'Papawis scorer added' })}</div>` : '';
  // Everyone the picker can show (the rows are built on the phone, once per sheet).
  const list = people.map(p => ({ id: p.id, name: p.name, ini: p.ini, team: p.team, color: p.color, photo: p.photo, game: p.game, pw: p.pw }));
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Scorers</span><span></span></div>
  ${gamesPart}${pwPart}
  <script type="application/json" data-adm-people>${JSON.stringify(list).replace(/</g, '\\u003c')}</script>`;
}
