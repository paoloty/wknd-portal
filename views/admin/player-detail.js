// /admin/players/:id: one player (admin redesign, 2026-10-15; mockup: canvas "Players ·
// Player detail"). Rebuilt from scratch on views/admin/ui.js. A header with the photo (✎ to
// change it, click the face to re-crop) and links to the same person elsewhere, then tabs
// (?tab=): Profile (bio and details), Ratings and stats (?season=), Papawis (runs and
// probation), Settings (team, status, profile address, delete). Every action posts to the
// same routes as before and updates the page in place. Browser bits (photo crop, the
// switches and selects that save as you change them, the season picker):
// public/admin-players.js.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import {
  avatar, badge, breadcrumb, button, emptyState, field, fieldGrid, formCard, formSection, pageTabs,
  saveBar, section, segmented, statStrip, toggleRow,
} from './ui.js';
import { parsePositions } from './players.js';

const attr = s => escHtml(String(s ?? ''));
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const ATTRS = [
  ['overall', 'Overall'], ['scoring', 'Scoring'], ['shooting', 'Shooting'], ['playmaking', 'Playmaking'],
  ['rebounding', 'Rebounding'], ['defense', 'Defense'], ['iq', 'IQ'], ['usage', 'Usage'],
];
const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const fmtDay = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

// ── Header ─────────────────────────────────────────────────────────────────────────────
function header(p, { name, color, rating, linkedReg, slug, canImpersonate }) {
  const pos = parsePositions(p.positions);
  const ovr = rating ? (rating.overall_ovr ?? rating.overall ?? null) : null;
  const sub = [p.team_name || 'No team', p.number !== '' && p.number != null ? `#${p.number}` : '', pos.join(' / '), p.height || ''].filter(Boolean).join(' · ');
  const id = encodeURIComponent(p.id);
  const links = [
    `<a class="aui-person__link is-active" href="/admin/players/${id}" aria-current="page">Player admin</a>`,
    linkedReg ? `<a class="aui-person__link" href="/admin/users/${attr(linkedReg.id)}">User account</a>` : '',
    `<a class="aui-person__link" href="/players/${attr(encodeURIComponent(slug || p.id))}" target="_blank" rel="noopener">Public profile ↗</a>`,
    `<a class="aui-person__link" href="/admin/papawis/activity?q=${attr(encodeURIComponent(name))}">Papawis activity</a>`,
    canImpersonate ? `<button type="button" class="aui-person__link apl-link-btn" data-post-json="/admin/impersonate/${id}" data-then="/me" data-done="Viewing as ${attr(name)}"
      data-confirm data-confirm-title="View the site as ${attr(name)}?" data-confirm-body="You see the site exactly as they do (read-only) until you stop from the bar at the top of the site." data-confirm-send="View as">View as player</button>` : '',
  ].join('');
  return `<div class="aui-person apl-head">
    <div class="aui-person__who">
      <div class="apl-photo">
        <button type="button" class="apl-photo__face" data-apl-recrop${p.picture_url ? '' : ' disabled'} aria-label="${p.picture_url ? 'Re-crop photo' : 'No photo yet'}" title="${p.picture_url ? 'Re-crop photo' : 'No photo yet'}">${avatar(name, color, { size: 64, playerId: p.id })}</button>
        <button type="button" class="apl-photo__edit" data-apl-photo-pick aria-label="Change photo" title="Change photo">✎</button>
        <input type="file" accept="image/*,.heic,.heif" data-apl-photo-input hidden>
      </div>
      <div class="apl-head__text">
        <div class="apl-head__line">
          <span class="apl-head__name">${escHtml(name)}</span>
          ${badge(p.status === 'inactive' ? 'Inactive' : 'Active', p.status === 'inactive' ? 'gray' : 'green')}
          ${p.papawis_probation ? badge('Papawis probation', 'amber') : ''}
          ${ovr != null ? `<span class="apl-ovr">${escHtml(ovr)}</span><span class="apl-ovr__label">OVR</span>` : ''}
        </div>
        <span class="aui-person__sub">${escHtml(sub)}</span>
      </div>
    </div>
    <nav class="aui-person__links" aria-label="${attr(name)} across the admin">${links}</nav>
  </div>`;
}

// The crop dialog (the site's shared .pcp-* crop look, same as the public profile page).
function cropDialog() {
  return `<div class="pcp-backdrop" data-apl-crop hidden>
    <div class="pcp-modal" role="dialog" aria-modal="true" aria-labelledby="apl-crop-title">
      <div class="pcp-modal__header"><span class="pcp-modal__title" id="apl-crop-title">Crop photo</span><button type="button" class="pcp-modal__close" data-apl-crop-close aria-label="Close">✕</button></div>
      <div class="pcp-modal__body"><img data-apl-crop-img src="" alt="" style="max-width:100%;display:block"></div>
      <div class="pcp-modal__hint">Line up the eyes with the dashed line and keep the head inside the oval, so photos look the same across players.</div>
      <div class="pcp-modal__footer">${button('Cancel', { kind: 'ghost', attrs: 'data-apl-crop-close' })}${button('Crop and save', { kind: 'primary', attrs: 'data-apl-crop-save' })}</div>
    </div>
  </div>`;
}

// ── Profile ────────────────────────────────────────────────────────────────────────────
function profileTab(p) {
  const pos = parsePositions(p.positions);
  const f = (label, name, value, extra = {}) => field({ label, name, value: value ?? '', ...extra });
  const chips = `<div class="apl-pos" role="group" aria-label="Positions">${POSITIONS.map(x => `<label class="apl-pos__chip"><input type="checkbox" name="positions[]" value="${x}"${pos.includes(x) ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div>`;
  return `<form id="apl-profile" data-json-action="/admin/players/${attr(p.id)}/bio" data-done="Profile saved." data-dirty-watch>
    ${formCard([
      formSection({ title: 'Basics', sub: 'How they’re listed everywhere.', bodyHtml: fieldGrid([
        f('First name', 'first_name', p.first_name), f('Last name', 'last_name', p.last_name),
        f('Nickname', 'nickname', p.nickname), f('Jersey number', 'number', p.number, { placeholder: 'e.g. 23', attrs: 'inputmode="numeric"' }),
      ].join('')) }),
      formSection({ title: 'Body', sub: 'Used for team balance in Papawis.', bodyHtml: fieldGrid([
        f('Height', 'height', p.height, { placeholder: 'e.g. 178 cm' }), f('Weight', 'weight', p.weight, { placeholder: 'e.g. 74 kg' }),
        f('Wingspan', 'wingspan', p.wingspan), f('Dominant hand', 'dominant_hand', p.dominant_hand, { placeholder: 'Right / Left' }),
      ].join('')) }),
      formSection({ title: 'Background', sub: 'Shown on their public profile.', bodyHtml: `<div class="aui-fields apl-fields-3">${[
        f('Hometown', 'hometown', p.hometown), f('School', 'school', p.school), f('Years playing', 'years_playing', p.years_playing),
      ].join('')}</div>${fieldGrid([
        f('Instagram', 'social_instagram', p.social_instagram, { placeholder: '@handle' }), f('X / Twitter', 'social_twitter', p.social_twitter, { placeholder: '@handle' }),
      ].join(''))}` }),
      formSection({ title: 'Positions', sub: 'Pick all they play.', bodyHtml: chips }),
      formSection({ title: 'Bio', sub: 'Shown on their public profile.', bodyHtml: field({ label: 'Bio', name: 'writeup', type: 'textarea', rows: 5, value: p.writeup || '' }) }),
    ].join(''))}
  </form>
  ${saveBar({ label: 'Save profile', form: 'apl-profile' })}`;
}

// ── Ratings and stats ──────────────────────────────────────────────────────────────────
function ratingsTab(p, { rating, stats, seasons, season }) {
  const gp = Number(stats?.games_played) || 0;
  const avg = k => (gp > 0 ? (Number(stats?.[k] || 0) / gp).toFixed(1) : '—');
  const fg3a = Number(stats?.fg3m || 0) + Number(stats?.fg3m_miss || 0);
  const strip = statStrip([
    { label: 'GP', value: String(gp) }, { label: 'PPG', value: avg('pts') }, { label: 'RPG', value: avg('reb') }, { label: 'APG', value: avg('ast') },
    { label: 'SPG', value: avg('stl') }, { label: 'BPG', value: avg('blk') }, { label: '3P%', value: fg3a > 0 ? `${Math.round((Number(stats.fg3m || 0) / fg3a) * 100)}%` : '—' }, { label: 'TOV', value: avg('turnover') },
  ]);
  const picker = `<div class="apl-season" data-apl-season data-base="/admin/players/${attr(encodeURIComponent(p.id))}?tab=ratings">${segmented({
    name: 'season', value: season || 'all', label: 'Season', options: [['all', 'All time'], ...seasons.map(s => [String(s), `Season ${s}`])],
  })}</div>`;
  const recompute = button('Recompute from games', { kind: 'secondary', size: 'sm', attrs: `data-post-json="/admin/players/${attr(p.id)}/recompute" data-body="${attr(JSON.stringify({ season: season || '' }))}" data-done="Ratings recomputed from games."` });
  const rows = ATTRS.map(([key, label]) => {
    const calc = rating?.[key] ?? null;
    const over = rating?.[`${key}_ovr`] ?? null;
    const eff = over ?? calc;
    const pct = eff != null ? Math.max(2, Math.min(100, Math.round((eff / 99) * 100))) : 0;
    return `<tr class="${key === 'overall' ? 'apl-attr--overall' : ''}">
      <td class="apl-attr__name">${escHtml(label)}</td>
      <td><span class="apl-rating"><span class="apl-bar"><span class="apl-bar__fill" style="width:${pct}%"></span></span><span class="apl-rating__n">${eff ?? '—'}</span>${over != null ? badge('Override', 'amber') : ''}</span></td>
      <td class="is-num"><span class="apl-calc">${calc ?? '—'}</span></td>
      <td><input class="aui-input apl-override" type="number" name="${key}_ovr" min="1" max="99" step="1" inputmode="numeric" placeholder="—" value="${over ?? ''}" aria-label="Override ${attr(label)}"></td>
    </tr>`;
  }).join('');
  const table = `<form data-json-action="/admin/players/${attr(p.id)}/ratings" data-done="Ratings saved.">
    <input type="hidden" name="season" value="${attr(season || '')}">
    <div class="aui-table-wrap">
      <table class="aui-table apl-attrs">
        <thead><tr><th scope="col">Attribute</th><th scope="col">Rating</th><th scope="col" class="is-num">From games</th><th scope="col">Override</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="apl-attrs__foot"><span class="aui-muted">Overrides (1–99) win over the numbers from games until cleared. Leave blank for none.</span>${button('Save ratings', { kind: 'primary', size: 'sm', type: 'submit' })}</div>
    </div>
  </form>`;
  return `<div class="aui-row-between">${picker}${recompute}</div>
    <div class="apl-stats">${strip}</div>
    ${rating ? '' : `<p class="aui-muted apl-note">No ratings ${season ? `for Season ${escHtml(season)}` : 'yet'}. Recompute from games, or set overrides.</p>`}
    ${table}`;
}

// ── Papawis ────────────────────────────────────────────────────────────────────────────
function runStatus(s, today) {
  if (s.status === 'cancelled') return ['Cancelled', 'red', s.cancelled_at ? `Cancelled ${fmtDate(s.cancelled_at)}` : 'Cancelled'];
  if (s.game_status === 'cancelled') return ['Run cancelled', 'gray', 'The run was called off'];
  if (s.status === 'pending') return ['Pending deposit', 'amber', 'Held until their deposit is confirmed'];
  if (s.status === 'waitlist') return s.game_status === 'completed' || s.date < today ? ['Waitlisted', 'gray', 'Didn’t get a slot'] : ['Waitlist', 'blue', 'On the waitlist'];
  if (s.game_status === 'completed') {
    const price = s.price_per_player != null ? peso(s.price_per_player) : '';
    return s.paid_at ? ['Paid', 'green', `Paid ${price}`.trim()] : ['Owes', 'red', price ? `Owes ${price}` : 'Not paid yet'];
  }
  if (s.date < today) return ['Played', 'gray', 'Waiting for close-out'];
  return ['Upcoming', 'gray', 'Confirmed'];
}

function papawisTab(p, { history, today }) {
  const runs = history.length ? `<div class="aui-panel aui-panel--flush">${history.map(s => {
    const [label, tone, what] = runStatus(s, today);
    const sub = [fmtDay(s.date), s.location, s.guest_name ? `Guest: ${s.guest_name}` : '', what].filter(Boolean).join(' · ');
    return `<a class="aui-action apl-run" href="/admin/papawis/${attr(encodeURIComponent(s.game_id))}"><span class="aui-cell__stack"><span class="aui-action__label">${escHtml(s.title || 'Papawis')}</span><span class="aui-cell__sub">${escHtml(sub)}</span></span>${badge(label, tone)}</a>`;
  }).join('')}</div>` : emptyState({ title: 'No Papawis runs yet', sub: 'Runs they sign up for show up here.' });
  const probation = `<form class="aui-panel aui-stack" data-apl-probation="/admin/players/${attr(p.id)}/papawis-probation">
    ${toggleRow({ label: 'On probation', help: 'Their sign-ups wait for a deposit you confirm.', name: 'probation', on: !!p.papawis_probation })}
    ${field({ label: 'Reason (admins only)', name: 'note', type: 'textarea', rows: 3, value: p.papawis_probation_note || '', placeholder: 'e.g. New player, or late payment last time',
      help: p.papawis_probation ? 'Saves when you click away.' : 'Turn probation on to give a reason.', attrs: p.papawis_probation ? '' : 'disabled' })}
  </form>`;
  return `<div class="aui-cols">
    <div class="aui-cols__main">${section({ title: 'Recent runs', note: history.length ? `· ${history.length === 30 ? 'last 30' : history.length}` : '', bodyHtml: runs })}</div>
    <aside class="aui-cols__side">${section({ title: 'Probation', bodyHtml: probation })}</aside>
  </div>`;
}

// ── Settings ───────────────────────────────────────────────────────────────────────────
function settingsTab(p, { teams, slug, isSuperAdmin, canDelete, deleteReason, name }) {
  const id = attr(p.id);
  const teamStatus = formSection({ title: 'Team and status', sub: 'Saves as you change it.', bodyHtml: fieldGrid([
    field({ label: 'Team', name: 'team_id', type: 'select', value: p.team_id || '', options: [...teams.map(t => [t.id, t.name]), ['', 'No team']], attrs: `data-apl-autosave="/admin/players/${id}/team"` }),
    field({ label: 'Status', name: 'status', type: 'select', value: p.status === 'inactive' ? 'inactive' : 'active', options: [['active', 'Active'], ['inactive', 'Inactive']], attrs: `data-apl-autosave="/admin/players/${id}/status"` }),
  ].join('')) });
  const address = isSuperAdmin ? formSection({ title: 'Profile address', sub: 'Super admin only.', bodyHtml: `<form class="aui-inline-form apl-slug" data-json-action="/admin/players/${id}/slug" data-done="Profile address saved.">
      <label class="aui-input aui-input--affix apl-slug__box"><span class="aui-input__pre">/players/</span><input name="slug" value="${attr(slug || '')}" placeholder="e.g. juan-dela-cruz" aria-label="Profile address" required></label>
      ${button('Save', { kind: 'secondary', type: 'submit' })}
    </form>
    <span class="aui-field__help">Letters, numbers and dashes. The old address stops working.</span>` }) : '';
  const del = formSection({ title: 'Delete player', sub: 'Only for players with no games, payments, Papawis or awards.', bodyHtml: canDelete
    ? `<div class="aui-row">${button('Delete player…', { kind: 'danger', attrs: `data-post-json="/admin/players/${id}" data-method="DELETE" data-then="/admin/players" data-done="${attr(name)} deleted." data-confirm data-confirm-title="Delete ${attr(name)}?" data-confirm-body="Removes the player for good. This can’t be undone." data-confirm-send="Delete"` })}</div>`
    : `<div class="aui-row">${button('Delete player…', { kind: 'danger', attrs: 'disabled' })}<span class="aui-muted">${escHtml(deleteReason)}</span></div>` });
  return formCard(teamStatus + address + del);
}

export function adminPlayerDetailBody({
  player, rating = null, overallRating = null, stats = null, seasons = [], season = '', teams = [], currentSlug = null, isSuperAdmin = false,
  canDelete = false, canImpersonate = false, linkedReg = null, history = [], tab = 'profile', deleteReason = '', today = '', ver = '',
} = {}) {
  const p = player;
  const name = displayPlayerName(p.name);
  const team = teams.find(t => t.id === p.team_id);
  const color = team?.color || '';
  const base = `/admin/players/${encodeURIComponent(p.id)}`;
  const tabs = [['profile', 'Profile'], ['ratings', 'Ratings and stats'], ['papawis', 'Papawis', history.length || ''], ['settings', 'Settings']];
  const current = tabs.some(t => t[0] === tab) ? tab : 'profile';
  const tabsHtml = pageTabs(tabs.map(([k, label, count]) => ({ label, count, href: k === 'profile' ? base : `${base}?tab=${k}`, active: k === current })));
  const main = {
    profile: () => profileTab(p),
    ratings: () => ratingsTab(p, { rating, stats, seasons, season }),
    papawis: () => papawisTab(p, { history, today }),
    settings: () => settingsTab(p, { teams, slug: currentSlug, isSuperAdmin, canDelete, deleteReason, name }),
  }[current]();

  return `<div class="aui-page apl-detail" data-apl-player="${attr(p.id)}">
    ${breadcrumb([{ label: 'Players', href: '/admin/players' }, { label: name }])}
    ${header(p, { name, color, rating: overallRating, linkedReg, slug: currentSlug, canImpersonate })}
    ${tabsHtml}
    ${main}
    ${cropDialog()}
  </div>
  <script src="/admin-players.js${ver ? `?v=${ver}` : ''}" defer></script>`;
}
