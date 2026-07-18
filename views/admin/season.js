import { escHtml } from '../layout.js';

const IC_CHECK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 5.5 10.5 11 3"/></svg>`;
const IC_LIST  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="4" x2="11" y2="4"/><line x1="2" y1="7" x2="11" y2="7"/><line x1="2" y1="10" x2="7" y2="10"/></svg>`;
const IC_PLAY  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 2 11 6.5 3 11" fill="currentColor" stroke="none"/></svg>`;

export function adminSeasonBody({
  sigSeason = '', sigOpen = false, deadline = '', portalSeason = '', autoSeason = 3,
  count = 0, confirmedCount = 0,
  seasonFormat = '', quotaAmount = '', jerseyTopPrice = '', jerseyShortPrice = '', teamCount = '4',
  allSeasons = [],
} = {}) {
  const autoStr   = String(autoSeason);
  const nextStr   = String(Number(autoStr) + 1);

  // Which season the admin is configuring for signup.
  // Defaults to active signup season, then next season, then auto+1.
  const configSeason = sigSeason || nextStr;

  // Build ordered season list for dropdowns (newest first).
  // Include allSeasons from game data + configSeason so there's always at least one option.
  const knownSeasons = [...new Set([...allSeasons.map(String), configSeason])].sort((a, b) => Number(b) - Number(a));

  // ── Portal display season row ─────────────────────────────────────────────
  // Options: Auto + every known season + configSeason (for upcoming season)
  const portalOptSeasons = [...new Set([...allSeasons.map(String)])].sort((a, b) => Number(b) - Number(a));
  const portalOpts = [
    `<option value="" ${!portalSeason ? 'selected' : ''}>Auto — Season ${autoStr}</option>`,
    ...portalOptSeasons.map(s =>
      `<option value="${escHtml(s)}" ${portalSeason === s ? 'selected' : ''}>Season ${escHtml(s)}</option>`
    ),
  ].join('');

  const portalRow = `
<div class="bg-admin-surface border border-admin-border rounded-lg px-5 py-4 max-w-2xl mb-4">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Public Portal</div>
      <div class="text-xs text-slate-400">Season shown to visitors on the public site</div>
    </div>
    <div class="flex items-center gap-2">
      <select id="portal-season-select" class="admin-input text-sm font-semibold" style="min-width:180px">
        ${portalOpts}
      </select>
      <button id="portal-season-save" class="agm-new-btn shrink-0">${IC_CHECK} Apply</button>
      <span id="portal-season-msg" class="text-xs min-w-[40px]"></span>
    </div>
  </div>
</div>`;

  // ── Season picker options for setup card ──────────────────────────────────
  const setupSeasonOpts = knownSeasons.map(s => {
    const isActive = s === sigSeason;
    const isNext   = s === nextStr && !allSeasons.map(String).includes(s);
    const suffix   = isActive ? ' — active signup' : isNext ? ' — next' : '';
    return `<option value="${escHtml(s)}" ${s === configSeason ? 'selected' : ''}>Season ${escHtml(s)}${suffix}</option>`;
  }).join('');

  // Signup status for the configured season
  const isSigActive = !!sigSeason; // true if any signup season is active
  const isSigForConfig = sigSeason === configSeason;

  const signupStatusBadge = isSigActive
    ? `<span style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 10px;font-size:10px;font-weight:700">Active</span>`
    : `<span style="background:#1e293b;color:#64748b;border:1px solid #1e293b;border-radius:10px;padding:2px 10px;font-size:10px;font-weight:700">Not started</span>`;

  const signupControls = isSigForConfig ? `
    <div class="flex flex-col gap-3 pt-1">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[13px] font-semibold text-slate-200">Open to Members</div>
          <div class="text-xs text-slate-500 mt-0.5">Members see a signup banner on every page</div>
        </div>
        <label class="site-toggle" title="Toggle season signup">
          <input type="checkbox" id="toggle-signup-open" ${sigOpen ? 'checked' : ''}>
          <span class="site-toggle__track"></span>
        </label>
      </div>
      <div class="flex items-center gap-3">
        <div class="shrink-0">
          <div class="text-[11px] font-semibold text-slate-400 mb-1.5">Signup Deadline <span class="font-normal text-slate-500">(optional)</span></div>
          <div class="flex items-center gap-2">
            <input type="text" id="signup-deadline-input" placeholder="e.g. August 1, 2026"
              value="${escHtml(deadline)}" class="admin-input" style="width:200px">
            <button id="signup-deadline-save" class="agm-new-btn shrink-0">${IC_CHECK} Save</button>
            <span id="signup-deadline-msg" class="text-xs"></span>
          </div>
        </div>
      </div>
      <span id="signup-open-msg" class="text-xs min-h-[14px]"></span>
    </div>` : `
    <div class="pt-1 flex flex-col gap-2">
      ${isSigActive ? `
      <div class="text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2 leading-relaxed">
        Season ${escHtml(sigSeason)} signup is currently active. Activating a different season will replace it.
      </div>` : ''}
      <div class="flex items-center gap-3">
        <button id="start-season-btn" class="agm-new-btn" data-season="${escHtml(configSeason)}">${IC_PLAY} Activate Season ${escHtml(configSeason)} Signup</button>
        <span id="start-season-msg" class="text-xs"></span>
      </div>
      <p class="text-xs text-slate-500 leading-relaxed">Activating opens the waitlist. You control when it's visible to members with the toggle above.</p>
    </div>`;

  // ── Combined setup card ───────────────────────────────────────────────────
  const setupCard = `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-2xl mb-4">
  <div class="px-5 py-3 border-b border-admin-border flex items-center justify-between gap-3 flex-wrap">
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Season Setup</span>
      ${signupStatusBadge}
    </div>
    <select id="setup-season-select" class="admin-input text-sm font-semibold" style="width:auto">
      ${setupSeasonOpts}
    </select>
  </div>

  <div class="p-5 flex flex-col gap-5">
    <!-- Settings fields -->
    <div class="flex flex-col gap-4">
      <div>
        <label class="block text-[12px] font-semibold text-slate-300 mb-1.5">Season Format <span class="text-slate-500 font-normal">(shown to members on signup)</span></label>
        <textarea id="season-format-input" rows="2" class="admin-input w-full resize-none" style="font-size:12px" placeholder="e.g. 4 teams · 10-game round robin · best-of-3 playoffs">${escHtml(seasonFormat)}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[12px] font-semibold text-slate-300 mb-1.5">Season Fee (₱)</label>
          <input id="quota-amount-input" type="number" min="0" step="1" placeholder="0"
            value="${escHtml(String(quotaAmount))}" class="admin-input w-full">
        </div>
        <div>
          <label class="block text-[12px] font-semibold text-slate-300 mb-1.5">Number of Teams</label>
          <input id="team-count-input" type="number" min="2" max="8" placeholder="4"
            value="${escHtml(String(teamCount || 4))}" class="admin-input w-full">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[12px] font-semibold text-slate-300 mb-1.5">Jersey Top Price (₱)</label>
          <input id="jersey-top-price-input" type="number" min="0" step="1" placeholder="0"
            value="${escHtml(String(jerseyTopPrice))}" class="admin-input w-full">
        </div>
        <div>
          <label class="block text-[12px] font-semibold text-slate-300 mb-1.5">Jersey Shorts Price (₱)</label>
          <input id="jersey-short-price-input" type="number" min="0" step="1" placeholder="0"
            value="${escHtml(String(jerseyShortPrice))}" class="admin-input w-full">
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="settings-save-btn" class="agm-new-btn">${IC_CHECK} Save Settings</button>
        <span id="settings-save-msg" class="text-xs"></span>
      </div>
    </div>

    <!-- Divider -->
    <div class="border-t border-admin-border"></div>

    <!-- Signup controls -->
    <div class="flex flex-col gap-1">
      <div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Signup</div>
      ${signupControls}
    </div>
  </div>
</div>`;

  // ── Waitlist summary card ─────────────────────────────────────────────────
  const waitlistCard = isSigActive ? `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-2xl mb-4">
  <div class="px-5 py-3 border-b border-admin-border flex items-center gap-3">
    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Waitlist</span>
    <span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 10px;font-size:10px;font-weight:700">Season ${escHtml(sigSeason)}</span>
  </div>
  <div class="p-5 flex items-center justify-between gap-4">
    <div class="flex items-center gap-8">
      <div class="text-center">
        <div class="text-xl font-bold text-slate-100">${count}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Total</div>
      </div>
      <div class="text-center">
        <div class="text-xl font-bold text-green-400">${confirmedCount}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Confirmed</div>
      </div>
      <div class="text-center">
        <div class="text-xl font-bold text-slate-400">${count - confirmedCount}</div>
        <div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Waitlisted</div>
      </div>
    </div>
    <a href="/admin/season/waitlist" class="agm-new-btn inline-flex items-center gap-1.5">${IC_LIST} View Waitlist</a>
  </div>
</div>` : '';

  return `
<div class="flex flex-col gap-0" style="max-width:900px">
  <h1 class="text-xl font-bold text-slate-100 mb-6">Season Management</h1>
  ${portalRow}
  ${setupCard}
  ${waitlistCard}
</div>

<script>
(function() {

  // ── Portal season dropdown ──────────────────────────────────────────────
  document.getElementById('portal-season-save').addEventListener('click', async function() {
    var val = document.getElementById('portal-season-select').value;
    var msg = document.getElementById('portal-season-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/season/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_season: val })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      setTimeout(function() { location.reload(); }, 700);
    } catch(e) { msg.style.color = '#f87171'; msg.textContent = 'Error.'; }
  });

  // ── Setup season dropdown — updates activate button label ───────────────
  var setupSelect = document.getElementById('setup-season-select');
  var startBtn    = document.getElementById('start-season-btn');
  if (setupSelect && startBtn) {
    setupSelect.addEventListener('change', function() {
      var s = this.value;
      startBtn.dataset.season = s;
      startBtn.innerHTML = ${JSON.stringify(IC_PLAY)} + ' Activate Season ' + s + ' Signup';
    });
  }

  // ── Season settings save ────────────────────────────────────────────────
  document.getElementById('settings-save-btn').addEventListener('click', async function() {
    var msg = document.getElementById('settings-save-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/season/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_format:       document.getElementById('season-format-input').value.trim(),
          season_quota_amount: document.getElementById('quota-amount-input').value.trim(),
          season_team_count:   document.getElementById('team-count-input').value.trim(),
          jersey_top_price:    document.getElementById('jersey-top-price-input').value.trim(),
          jersey_short_price:  document.getElementById('jersey-short-price-input').value.trim(),
        })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
    } catch(e) { msg.style.color = '#f87171'; msg.textContent = 'Error.'; }
    setTimeout(function() { msg.textContent = ''; }, 2500);
  });

  // ── Activate signup ─────────────────────────────────────────────────────
  if (startBtn) startBtn.addEventListener('click', async function() {
    var season = this.dataset.season;
    var msg = document.getElementById('start-season-msg');
    if (!season) { msg.style.color = '#f87171'; msg.textContent = 'Select a season.'; return; }
    this.disabled = true;
    msg.textContent = 'Activating…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/season/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season })
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) {
      this.disabled = false;
      msg.style.color = '#f87171'; msg.textContent = 'Error.';
    }
  });

  // ── Signup open toggle ──────────────────────────────────────────────────
  var toggle = document.getElementById('toggle-signup-open');
  if (toggle) toggle.addEventListener('change', async function() {
    var msg = document.getElementById('signup-open-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/season/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_signup_open: this.checked ? '1' : '0' })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = this.checked ? 'Signup is now open.' : 'Signup closed.';
    } catch(e) {
      msg.style.color = '#f87171'; msg.textContent = 'Error.';
      this.checked = !this.checked;
    }
    setTimeout(function() { msg.textContent = ''; }, 2500);
  });

  // ── Deadline save ───────────────────────────────────────────────────────
  var dlSave = document.getElementById('signup-deadline-save');
  if (dlSave) dlSave.addEventListener('click', async function() {
    var val = document.getElementById('signup-deadline-input').value.trim();
    var msg = document.getElementById('signup-deadline-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/season/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_signup_deadline: val })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
    } catch(e) { msg.style.color = '#f87171'; msg.textContent = 'Error.'; }
    setTimeout(function() { msg.textContent = ''; }, 2000);
  });

})();
</script>`;
}
