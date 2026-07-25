import { escHtml } from '../layout.js';
import { displayPlayerName, formatTimeRange, manilaTodayStr } from '../utils.js';

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

function signupOpenNow(game) {
  if (!game.open_days_before) return true;
  const today = new Date(manilaTodayStr() + 'T00:00:00');
  const gameDate = new Date(game.date + 'T00:00:00');
  const daysLeft = Math.round((gameDate - today) / 86400000);
  return daysLeft <= game.open_days_before;
}

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
        <span>Hold sign-ups until 5 days before the game (game still shows publicly, marked "Scheduled")</span>
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
      body: JSON.stringify({ title: title, date: date, start_time: startTime, end_time: endTime, location: location, max_slots: maxSlots, open_days_before: delayOpen ? 5 : null })
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

  const signupRow = (s) => `<tr class="border-b border-admin-border/50 last:border-b-0">
      <td class="px-4 py-2.5 text-sm text-slate-200">${s.guest_name ? `${escHtml(s.guest_name)} <span class="text-[10px] text-slate-500 font-normal">(guest)</span>` : escHtml(displayPlayerName(s.player_name))}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${s.guest_name ? `Billed to ${escHtml(displayPlayerName(s.player_name))}` : escHtml(s.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${s.status === 'waitlist' ? '<span class="agm-badge agm-badge--gray">Waitlist</span>' : '<span class="agm-badge agm-badge--green">Confirmed</span>'}</td>
      <td class="px-4 py-2.5 text-right">
        ${!isCompleted && !isCancelled ? `<button class="admin-btn admin-btn--sm admin-btn--danger" data-remove="${escHtml(s.id)}">Remove</button>` : ''}
      </td>
    </tr>`;

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
    ${isScheduled ? `<span class="text-xs text-slate-500">Sign-ups open ${fmtDate(addDaysStr(game.date, -game.open_days_before))}</span>` : ''}
    <a href="/papawis" target="_blank" class="agm-view-link">View on site ↗</a>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_320px] items-start">

  <div class="flex flex-col gap-4 min-w-0">
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Signups — ${confirmed.length}/${game.max_slots}${waitlist.length ? ` · ${waitlist.length} waiting` : ''}</span>
      </div>
      <table class="w-full border-collapse">
        <tbody>
          ${signups.length ? signups.map(signupRow).join('') : '<tr><td class="px-4 py-8 text-center text-sm text-slate-500">No one listed yet.</td></tr>'}
        </tbody>
      </table>
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
