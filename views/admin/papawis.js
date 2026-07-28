import { escHtml } from '../layout.js';
import { displayPlayerName, formatTimeRange, isPapawisSignupOpenNow } from '../utils.js';

const PAPAWIS_LOCATIONS = [
  'Cloverleaf Basketball Court, Makati',
  'Gatorade Hoops Center, Mandaluyong',
  'Gameville Ball Park, Mandaluyong',
  'Dumlao Sports Center, Mandaluyong',
  'Reyes Gym Basketball Court, Mandaluyong',
  'Activate Hoop Arena, Pasig',
  'The Upper Deck Sports Center, Pasig',
  'G Court, Mandaluyong',
  'Meralco Basketball Gym, Pasig',
  'Philsports Arena Basketball Court, Pasig',
];

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_PLUS      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>`;
const ICON_CHECK     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_X         = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/></svg>`;
const ICON_TRASH     = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h10M5.5 3.5V2.5h3v1M12 3.5l-.9 8a1 1 0 0 1-1 .9H3.9a1 1 0 0 1-1-.9L2 3.5"/></svg>`;
const ICON_CHEVRON_UP   = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5l3.5-3.5 3.5 3.5"/></svg>`;
const ICON_CHEVRON_DOWN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg>`;

function fmtDate(d) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

function addDaysStr(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function fmtLogTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ACTIVITY_LABELS = {
  registered:    { label: 'registered', color: 'text-amber-400' },
  joined:        { label: 'joined',    color: 'text-emerald-400' },
  cancelled:     { label: 'cancelled', color: 'text-red-400' },
  promoted:      { label: 'moved to confirmed', color: 'text-emerald-400' },
  waitlisted:    { label: 'moved to waitlist',  color: 'text-amber-400' },
  viewed_roster: { label: 'viewed the player list', color: 'text-slate-400' },
};

// Shared between the per-game log (Game column hidden) and the global feed (shown).
function activityRow(e, { showGame = false } = {}) {
  const cfg = ACTIVITY_LABELS[e.event_type] || { label: e.event_type, color: 'text-slate-400' };
  return `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-sm font-medium text-slate-100">${escHtml(e.player_name || 'Someone')}</td>
    <td class="px-4 py-2.5 text-sm ${cfg.color}">${escHtml(cfg.label)}${e.notes ? `<span class="text-xs text-slate-500"> (${escHtml(e.notes)})</span>` : ''}</td>
    ${showGame ? `<td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(e.game_title || 'General')}</td>` : ''}
    <td class="px-4 py-2.5 text-xs text-slate-500 text-right whitespace-nowrap">${fmtLogTime(e.created_at)}</td>
  </tr>`;
}

function activityTableHead(showGame) {
  return `<thead><tr>
    <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player</th>
    <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Action</th>
    ${showGame ? '<th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Game</th>' : ''}
    <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">When</th>
  </tr></thead>`;
}

const signupOpenNow = isPapawisSignupOpenNow;

function statusBadge(game) {
  if (game.status === 'cancelled') return `<span class="agm-badge agm-badge--gray">Cancelled</span>`;
  if (game.status === 'completed') return `<span class="agm-badge agm-badge--blue">Completed</span>`;
  if (game.status === 'open' && !signupOpenNow(game)) return `<span class="agm-badge agm-badge--gray">Scheduled</span>`;
  if ((game.confirmed_count || 0) >= game.max_slots) return `<span class="agm-badge agm-badge--gray">Full</span>`;
  return `<span class="agm-badge agm-badge--amber">Open</span>`;
}

// ── List ──────────────────────────────────────────────────────────────────────
export function adminPapawisListBody({ games = [] } = {}) {
  const rows = games.map(g => `<tr class="border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(g.date)}</td>
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(g.title || 'Papawis')}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${escHtml(g.location || '—')}</td>
      <td class="px-4 py-3 text-sm text-slate-300 font-saira">${g.confirmed_count || 0}<span class="text-slate-600">/${g.max_slots}</span>${g.waitlist_count ? `<span class="text-[11px] text-slate-500 ml-1">+${g.waitlist_count} waiting</span>` : ''}</td>
      <td class="px-4 py-3">${statusBadge(g)}</td>
      <td class="px-4 py-3 text-xs text-slate-500">${g.price_per_player != null ? '₱' + Number(g.price_per_player).toLocaleString() : '—'}</td>
      <td class="px-4 py-3 text-right">
        <a href="/admin/papawis/${escHtml(g.id)}" class="agm-edit-link">Manage ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Papawis</h2>
  <div class="flex items-center gap-2">
    <a href="/admin/papawis/activity" class="admin-btn">Activity Log</a>
    <button class="agm-new-btn" id="pw-new-btn">${ICON_PLUS} New Papawis</button>
  </div>
</div>

<div class="agm-modal-backdrop" id="pw-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">New Papawis</h3>
      <button class="agm-modal-close" id="pw-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body">
      <div class="agm-modal-field">
        <label class="agm-modal-label">Title</label>
        <input type="text" id="pw-title" class="agm-modal-input" placeholder="e.g. Sunday (Aug 2)">
      </div>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Date</label>
          <input type="date" id="pw-date" class="agm-modal-input">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">Max slots</label>
          <input type="number" id="pw-max-slots" class="agm-modal-input" value="10" min="1" step="1">
        </div>
      </div>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Start time</label>
          <input type="time" id="pw-start-time" class="agm-modal-input">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">End time</label>
          <input type="time" id="pw-end-time" class="agm-modal-input">
        </div>
      </div>
      <div class="agm-modal-field">
        <label class="agm-modal-label">Location</label>
        <select id="pw-location-select" class="agm-modal-select">
          <option value="">Select location…</option>
          ${PAPAWIS_LOCATIONS.map(loc => `<option value="${escHtml(loc)}">${escHtml(loc)}</option>`).join('')}
          <option value="__other__">Others</option>
        </select>
      </div>
      <div class="agm-modal-field" id="pw-location-other-wrap" hidden>
        <label class="agm-modal-label">Other location</label>
        <input type="text" id="pw-location-other" class="agm-modal-input" placeholder="Enter location">
      </div>
      <label class="agm-modal-checkbox">
        <input type="checkbox" id="pw-delay-open">
        <span>Hold sign-ups until 6 days before the game (game still shows publicly, marked "Scheduled")</span>
      </label>
      <p class="agm-modal-err" id="pw-err" hidden></p>
    </div>
    <div class="agm-modal-footer">
      <button class="agm-new-btn agm-new-btn--ghost" id="pw-modal-cancel">${ICON_X} Cancel</button>
      <button class="agm-new-btn" id="pw-submit">${ICON_CHECK} Create Papawis</button>
    </div>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Date</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Title</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Location</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Slots</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Status</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Price</th>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">No papawis scheduled yet.</td></tr>'}
    </tbody>
  </table>
</div>

<script>
(function() {
  var backdrop = document.getElementById('pw-modal-backdrop');
  function openModal() { backdrop.hidden = false; document.getElementById('pw-title').focus(); }
  function closeModal() { backdrop.hidden = true; document.getElementById('pw-err').hidden = true; }
  document.getElementById('pw-new-btn').addEventListener('click', openModal);
  document.getElementById('pw-modal-close').addEventListener('click', closeModal);
  document.getElementById('pw-modal-cancel').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });

  // Title defaults to "Dayname (Date)" from the picked date, until the admin types their own.
  var titleInput = document.getElementById('pw-title');
  var titleTouched = false;
  titleInput.addEventListener('input', function() { titleTouched = true; });
  document.getElementById('pw-date').addEventListener('change', function() {
    if (titleTouched || !this.value) return;
    var d = new Date(this.value + 'T00:00:00');
    var day   = d.toLocaleDateString('en-US', { weekday: 'long' });
    var short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    titleInput.value = day + ' (' + short + ')';
  });

  var locationSelect = document.getElementById('pw-location-select');
  var locationOtherWrap = document.getElementById('pw-location-other-wrap');
  locationSelect.addEventListener('change', function() {
    locationOtherWrap.hidden = this.value !== '__other__';
  });

  document.getElementById('pw-submit').addEventListener('click', function() {
    var title     = titleInput.value.trim();
    var date      = document.getElementById('pw-date').value;
    var startTime = document.getElementById('pw-start-time').value;
    var endTime   = document.getElementById('pw-end-time').value;
    var location  = locationSelect.value === '__other__'
      ? document.getElementById('pw-location-other').value.trim()
      : locationSelect.value;
    var maxSlots  = document.getElementById('pw-max-slots').value;
    var delayOpen = document.getElementById('pw-delay-open').checked;
    var errEl = document.getElementById('pw-err');
    var btn = this;
    var orig = btn.innerHTML;
    if (!date) { errEl.textContent = 'Date is required.'; errEl.hidden = false; return; }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'Creating…';
    fetch('/admin/papawis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, date: date, start_time: startTime, end_time: endTime, location: location, max_slots: maxSlots, open_days_before: delayOpen ? 6 : null })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) { window.location.href = '/admin/papawis/' + data.id; }
      else { errEl.textContent = data.error || 'Failed to create.'; errEl.hidden = false; btn.disabled = false; btn.innerHTML = orig; }
    })
    .catch(function() { errEl.textContent = 'Network error.'; errEl.hidden = false; btn.disabled = false; btn.innerHTML = orig; });
  });
})();
</script>`;
}

// ── Detail / manage ───────────────────────────────────────────────────────────
export function adminPapawisDetailBody({ game, signups = [], players = [], activity = [] } = {}) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const waitlist  = signups.filter(s => s.status === 'waitlist');
  const isOpen      = game.status === 'open';
  const isCompleted = game.status === 'completed';
  const isCancelled = game.status === 'cancelled';
  const isScheduled = isOpen && !signupOpenNow(game);

  // Not pre-filtered by "already listed" — the same picker is used both to add a player
  // themselves and to add their guests, and only the former can actually collide.
  const playerList = players.map(p => ({
    id: p.id,
    name: displayPlayerName(p.name) + (p.team_name ? ' — ' + p.team_name : ''),
  }));

  // Read-only once a game is completed/cancelled — no drag handle, no move/remove
  // controls, matches the old table's own gating on the Remove button.
  const canManage = !isCompleted && !isCancelled;
  const isConfirmedFull = confirmed.length >= game.max_slots;

  const signupRow = (s) => `<li class="pw-row" ${canManage ? 'draggable="true"' : ''} data-id="${escHtml(s.id)}" data-status="${s.status}">
      ${canManage ? `<span class="pw-row__handle" aria-hidden="true">⠿</span>` : ''}
      <div class="pw-row__info">
        <div class="pw-row__name">${s.guest_name ? `${escHtml(s.guest_name)} <span class="pw-row__guest-tag">(guest)</span>` : escHtml(displayPlayerName(s.player_name))}</div>
        <div class="pw-row__meta">${s.guest_name ? `Billed to ${escHtml(displayPlayerName(s.player_name))}` : escHtml(s.team_name || '—')}</div>
      </div>
      ${canManage ? `<div class="pw-row__actions">
        ${s.status === 'waitlist'
          ? `<button class="pw-move-btn pw-move-btn--confirm" data-move="${escHtml(s.id)}" data-to="confirmed" ${isConfirmedFull ? 'disabled title="Confirmed is full"' : ''}>${ICON_CHEVRON_UP} Confirm</button>`
          : `<button class="pw-move-btn" data-move="${escHtml(s.id)}" data-to="waitlist">${ICON_CHEVRON_DOWN} Waitlist</button>`}
        <button class="admin-btn admin-btn--sm admin-btn--danger" data-remove="${escHtml(s.id)}">Remove</button>
      </div>` : ''}
    </li>`;

  return `
<div class="agm-edit-bar">
  <a href="/admin/papawis" class="agm-edit-bar__back">${ICON_CHEVRON_L} All Papawis</a>
</div>

<div class="card agm-game-header">
  <div class="agm-game-header__teams">
    <span class="text-lg font-bold text-slate-100">${escHtml(game.title || 'Papawis')}</span>
  </div>
  <div class="agm-game-header__meta">
    <span>${fmtDate(game.date)}</span>
    ${(() => { const t = formatTimeRange(game.start_time, game.end_time) || game.time_label; return t ? `<span class="agm-sep">·</span><span>${escHtml(t)}</span>` : ''; })()}
    ${game.location ? `<span class="agm-sep">·</span><span>${escHtml(game.location)}</span>` : ''}
    <span class="agm-sep">·</span>
    ${statusBadge(game)}
    ${isScheduled ? `<span class="text-xs text-slate-500">Sign-ups open ${fmtDate(addDaysStr(game.date, -game.open_days_before))}, 8:00 AM</span>` : ''}
    <a href="/papawis" target="_blank" class="agm-view-link">View on site ↗</a>
    <button id="pw-copy-messenger" type="button" class="admin-btn admin-btn--sm">📋 Copy for Messenger</button>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_320px] items-start">

  <div class="flex flex-col gap-4 min-w-0">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="pw-panel pw-panel--confirmed bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-widest pw-panel__label pw-panel__label--confirmed">Confirmed — ${confirmed.length}/${game.max_slots}</span>
        </div>
        <ul class="pw-list" id="pw-list-confirmed" data-status="confirmed">
          ${confirmed.length ? confirmed.map(signupRow).join('') : '<li class="pw-list__empty">No one confirmed yet.</li>'}
        </ul>
      </div>
      <div class="pw-panel pw-panel--waitlist bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-widest pw-panel__label pw-panel__label--waitlist">Waitlist${waitlist.length ? ` — ${waitlist.length}` : ''}</span>
        </div>
        <ul class="pw-list" id="pw-list-waitlist" data-status="waitlist">
          ${waitlist.length ? waitlist.map(signupRow).join('') : '<li class="pw-list__empty">Nobody waiting.</li>'}
        </ul>
      </div>
    </div>

    ${!isCompleted && !isCancelled ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg" style="overflow:visible">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Add a player or guest</div>
      <div class="p-4 flex flex-col gap-3">
        <div>
          <label class="admin-field-label">Guest names <span class="normal-case font-normal text-slate-600">— optional, comma-separated. Leave blank to add the player below; fill in to add their guests (billed to them) instead.</span></label>
          <input type="text" id="pw-guest-names" class="admin-input" placeholder="e.g. Bryan, Mark">
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[220px]" style="position:relative">
            <label class="admin-field-label">Player</label>
            <input type="text" id="pw-add-player-input" class="admin-input" placeholder="Type a name…" autocomplete="off">
            <input type="hidden" id="pw-add-player-id">
            <div id="pw-add-player-dropdown" class="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-admin-surface2 border border-admin-border rounded-lg shadow-xl" hidden></div>
          </div>
          <div>
            <label class="admin-field-label">Status</label>
            <select id="pw-add-status" class="admin-input">
              <option value="confirmed">Confirmed</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </div>
          <button class="admin-btn" id="pw-add-btn" style="align-self:flex-end">${ICON_PLUS} Add</button>
        </div>
      </div>
      <div id="pw-add-msg" class="px-4 pb-3 text-xs text-error" style="display:none"></div>
    </div>
    ` : ''}

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Activity Log</div>
      ${activity.length ? `<table class="w-full border-collapse">
        ${activityTableHead(false)}
        <tbody>${activity.map(e => activityRow(e)).join('')}</tbody>
      </table>` : '<div class="px-4 py-8 text-center text-sm text-slate-500">No activity yet.</div>'}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    ${isOpen ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Close out</div>
      <div class="p-4 flex flex-col gap-3">
        <p class="text-xs text-slate-500 leading-relaxed">No division — pick a flat, rounded price. Every confirmed player (${confirmed.length}) gets charged exactly that.</p>
        <div>
          <label class="admin-field-label">Price per player</label>
          <input type="number" id="pw-price" class="admin-input" placeholder="e.g. 250" min="0" step="1">
        </div>
        <div id="pw-complete-msg" class="text-xs text-error" style="display:none"></div>
        <button class="admin-btn admin-btn--danger" id="pw-cancel-game-btn">Cancel game</button>
        <button class="agm-new-btn" id="pw-complete-btn">${ICON_CHECK} Confirm &amp; charge</button>
      </div>
    </div>
    ` : isCompleted ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Closed out</div>
      <div class="p-4">
        <div class="text-2xl font-extrabold font-saira text-brand">₱${Number(game.price_per_player || 0).toLocaleString()}</div>
        <div class="text-xs text-slate-500 mt-1">per player · ${confirmed.length} charged</div>
      </div>
    </div>
    ` : `
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Cancelled</div>
      <div class="p-4 text-xs text-slate-500">No charges were made for this game.</div>
    </div>
    `}

    <div class="pt-1">
      <button id="pw-delete-btn" class="admin-btn admin-btn--danger">${ICON_TRASH} Delete papawis</button>
    </div>
  </div>

</div>

<script>
(function() {
  var gameId = ${JSON.stringify(game.id)};
  var players = ${JSON.stringify(playerList)};

  // ── Copy for Messenger ────────────────────────────────────────────────
  var gcMeta = ${JSON.stringify({
    date: game.date,
    start_time: game.start_time,
    end_time: game.end_time,
    location: game.location || '',
    max_slots: game.max_slots,
  })};
  var gcConfirmedNames = ${JSON.stringify(confirmed.map(s => s.guest_name ? s.guest_name : displayPlayerName(s.player_name)))};

  function pwCompactClock(hhmm) {
    var parts = hhmm.split(':');
    var h = Number(parts[0]), m = Number(parts[1]);
    var period = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? (h12 + period) : (h12 + ':' + String(m).padStart(2, '0') + period);
  }

  function buildMessengerText() {
    var d = new Date(gcMeta.date + 'T00:00:00');
    var dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var timeRange = (gcMeta.start_time && gcMeta.end_time)
      ? (pwCompactClock(gcMeta.start_time) + '-' + pwCompactClock(gcMeta.end_time))
      : '';

    var lines = [];
    lines.push('Papawis sign-ups are open! 🏀');
    lines.push('Head to the WKND Portal (https://wkndbasketball.com/papawis), log in, and tap Join to grab a slot. First come, first served — once we hit the slot limit, extra names go on the waitlist.');
    lines.push('');
    lines.push('⚠ Not able to make it? Cancel on the portal at least 3 days before game day. After that, message an admin directly — no-shows without notice may affect future priority. ⚠');
    lines.push('');
    lines.push('🏀 PPWS : ' + dayName + ' : ' + timeRange + ' - ' + monthDay + ' 🏀');
    if (gcMeta.location) lines.push('📍 ' + gcMeta.location);
    lines.push('');
    for (var i = 0; i < gcMeta.max_slots; i++) {
      lines.push((i + 1) + '. ' + (gcConfirmedNames[i] || ''));
    }
    return lines.join('\\n');
  }

  var copyBtn = document.getElementById('pw-copy-messenger');
  if (copyBtn) {
    var copyBtnDefault = copyBtn.textContent;
    copyBtn.addEventListener('click', function() {
      var text = buildMessengerText();
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function() { copyBtn.textContent = copyBtnDefault; }, 1800);
      }).catch(function() {
        alert('Could not copy automatically — copy the text below:\\n\\n' + text);
      });
    });
  }

  var pInput    = document.getElementById('pw-add-player-input');
  var pHidden   = document.getElementById('pw-add-player-id');
  var pDropdown = document.getElementById('pw-add-player-dropdown');

  if (pInput) {
    function renderDropdown() {
      var q = pInput.value.trim().toLowerCase();
      var matches = players.filter(function(p) {
        return !q || p.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      if (!matches.length) { pDropdown.hidden = true; pDropdown.innerHTML = ''; return; }
      pDropdown.innerHTML = matches.map(function(p) {
        var div = document.createElement('div');
        div.className = 'px-3 py-2 text-sm text-slate-200 hover:bg-white/5 cursor-pointer';
        div.textContent = p.name;
        div.dataset.id = p.id;
        div.dataset.name = p.name;
        return div.outerHTML;
      }).join('');
      pDropdown.hidden = false;
    }
    pInput.addEventListener('focus', renderDropdown);
    pInput.addEventListener('input', function() { pHidden.value = ''; renderDropdown(); });
    pDropdown.addEventListener('mousedown', function(e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      pHidden.value = item.dataset.id;
      pInput.value = item.dataset.name;
      pDropdown.hidden = true;
    });
    document.addEventListener('click', function(e) {
      if (e.target !== pInput && !pDropdown.contains(e.target)) pDropdown.hidden = true;
    });
  }

  // ── Confirmed/Waitlist: move buttons + drag-and-drop reorder ─────────────
  var pwLists = Array.prototype.slice.call(document.querySelectorAll('.pw-list'));

  function pwListEl(status) { return document.getElementById('pw-list-' + status); }

  function pwPersistOrder(status) {
    var list = pwListEl(status);
    if (!list) return Promise.resolve();
    var ids = Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) { return li.dataset.id; });
    if (!ids.length) return Promise.resolve();
    return fetch('/admin/papawis/' + gameId + '/signups/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, ids: ids })
    });
  }

  // Button-based move — the reliable path (also the only one that works on touch,
  // since native HTML5 drag-and-drop below is desktop/mouse only).
  document.querySelectorAll('[data-move]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sid = btn.dataset.move, to = btn.dataset.to;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not move.'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  // Drag-and-drop: reorders within a list, or moves between the two (server has final
  // say on the confirmed-list cap — a rejected cross-list move just reloads to the
  // last-saved state instead of leaving the UI showing a drop that didn't actually stick).
  var draggingRow = null, draggingFrom = null;

  document.querySelectorAll('.pw-row[draggable="true"]').forEach(function(row) {
    row.addEventListener('dragstart', function() {
      draggingRow = row;
      draggingFrom = row.dataset.status;
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('is-dragging');
      pwLists.forEach(function(l) { l.classList.remove('is-drag-over'); l.classList.remove('is-drag-blocked'); });
      draggingRow = null; draggingFrom = null;
    });
  });

  function pwRowAfterPoint(list, y) {
    var rows = Array.prototype.slice.call(list.querySelectorAll('.pw-row:not(.is-dragging)'));
    var closest = null, closestOffset = -Infinity;
    rows.forEach(function(r) {
      var box = r.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = r; }
    });
    return closest;
  }

  pwLists.forEach(function(list) {
    list.addEventListener('dragover', function(e) {
      if (!draggingRow) return;
      // Only a cross-list drag actually adds a new row to Confirmed — reordering
      // within an already-full Confirmed list doesn't grow it, so that stays allowed.
      var isConfirmedList = list.dataset.status === 'confirmed';
      var wouldExceed = isConfirmedList && draggingFrom !== 'confirmed'
        && list.querySelectorAll('.pw-row:not(.is-dragging)').length >= gcMeta.max_slots;
      if (wouldExceed) {
        list.classList.remove('is-drag-over');
        list.classList.add('is-drag-blocked');
        return; // no preventDefault() — browser shows its native not-allowed cursor and blocks the drop
      }
      e.preventDefault();
      list.classList.remove('is-drag-blocked');
      list.classList.add('is-drag-over');
      var empty = list.querySelector('.pw-list__empty');
      if (empty) empty.remove();
      var after = pwRowAfterPoint(list, e.clientY);
      if (after == null) list.appendChild(draggingRow);
      else list.insertBefore(draggingRow, after);
    });
    list.addEventListener('dragleave', function(e) {
      if (e.target === list) { list.classList.remove('is-drag-over'); list.classList.remove('is-drag-blocked'); }
    });
    list.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!draggingRow) return;
      list.classList.remove('is-drag-over');
      list.classList.remove('is-drag-blocked');
      var toStatus = list.dataset.status;
      var sid = draggingRow.dataset.id;
      if (draggingFrom === toStatus) {
        pwPersistOrder(toStatus);
      } else {
        draggingRow.dataset.status = toStatus;
        fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok) return pwPersistOrder(toStatus).then(function() { location.reload(); });
          alert(d.error || 'Could not move.'); location.reload();
        })
        .catch(function() { alert('Network error'); location.reload(); });
      }
    });
  });

  document.querySelectorAll('[data-remove]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Remove this player from the papawis?')) return;
      var sid = btn.dataset.remove;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/remove/' + sid, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); btn.disabled = false; } })
        .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  var addBtn = document.getElementById('pw-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var pid = pHidden.value;
      var status = document.getElementById('pw-add-status').value;
      var guestNames = document.getElementById('pw-guest-names').value;
      var msg = document.getElementById('pw-add-msg');
      msg.style.display = 'none';
      if (!pid) { msg.textContent = 'Select a player first.'; msg.style.display = 'block'; return; }
      addBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: pid, status: status, guest_names: guestNames })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed to add.'; msg.style.display = 'block'; addBtn.disabled = false; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; addBtn.disabled = false; });
    });
  }

  var completeBtn = document.getElementById('pw-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', function() {
      var price = document.getElementById('pw-price').value;
      var msg = document.getElementById('pw-complete-msg');
      msg.style.display = 'none';
      if (!price || Number(price) <= 0) { msg.textContent = 'Enter a valid price per player.'; msg.style.display = 'block'; return; }
      if (!confirm('Charge ₱' + price + ' to every confirmed player? This cannot be undone from here.')) return;
      completeBtn.disabled = true; completeBtn.textContent = 'Charging…';
      fetch('/admin/papawis/' + gameId + '/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_player: Number(price) })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed.'; msg.style.display = 'block'; completeBtn.disabled = false; completeBtn.textContent = '${ICON_CHECK} Confirm & charge'; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; completeBtn.disabled = false; });
    });
  }

  var cancelGameBtn = document.getElementById('pw-cancel-game-btn');
  if (cancelGameBtn) {
    cancelGameBtn.addEventListener('click', function() {
      if (!confirm('Cancel this papawis? No charges will be made.')) return;
      cancelGameBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/cancel', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); cancelGameBtn.disabled = false; } })
        .catch(function() { alert('Network error'); cancelGameBtn.disabled = false; });
    });
  }

  document.getElementById('pw-delete-btn').addEventListener('click', function() {
    if (!confirm('Delete this papawis entirely? This removes all signups and cannot be undone.')) return;
    var btn = this;
    btn.disabled = true;
    fetch('/admin/papawis/' + gameId, { method: 'DELETE' })
      .then(function(r) { if (r.ok) { window.location.href = '/admin/papawis'; } else { alert('Failed'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
  });
})();
</script>`;
}

// ── Activity (global feed + frequent cancellers) ─────────────────────────────
export function adminPapawisActivityBody({ activity = [], cancellers = [] } = {}) {
  const cancellerRow = (c) => `<tr class="border-b border-admin-border/50 last:border-b-0">
      <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 font-saira text-right">${c.cancel_count}</td>
    </tr>`;

  return `
<div class="agm-edit-bar">
  <a href="/admin/papawis" class="agm-edit-bar__back">${ICON_CHEVRON_L} All Papawis</a>
</div>

<h2 class="text-xl font-bold tracking-tight text-slate-100 mt-4 mb-5">Papawis Activity</h2>

<div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start">

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">All Activity</div>
    ${activity.length ? `<table class="w-full border-collapse">
      ${activityTableHead(true)}
      <tbody>${activity.map(e => activityRow(e, { showGame: true })).join('')}</tbody>
    </table>` : '<div class="px-4 py-8 text-center text-sm text-slate-500">No activity yet.</div>'}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Frequent Cancellers</div>
    <table class="w-full border-collapse">
      <tbody>
        ${cancellers.length ? cancellers.map(cancellerRow).join('') : '<tr><td class="px-4 py-8 text-center text-sm text-slate-500">No repeat cancellers yet.</td></tr>'}
      </tbody>
    </table>
  </div>

</div>`;
}
