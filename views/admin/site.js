import { escHtml } from '../layout.js';

const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;

const AWARD_SECTIONS = [
  { key: 'award_show_mvp',            label: 'Season MVP' },
  { key: 'award_show_dpoy',           label: 'Defensive Player of the Season' },
  { key: 'award_show_all_wknd_1',     label: 'All WKND 1st Team' },
  { key: 'award_show_all_wknd_2',     label: 'All WKND 2nd Team' },
  { key: 'award_show_all_wknd_def',   label: 'All WKND Defensive Team' },
  { key: 'award_show_scoring_champ',   label: 'Scoring Champion' },
  { key: 'award_show_assists_leader',  label: 'Assists Leader' },
  { key: 'award_show_rebounds_leader', label: 'Rebounds Leader' },
  { key: 'award_show_steals_leader',   label: 'Steals Leader' },
  { key: 'award_show_blocks_leader',   label: 'Blocks Leader' },
  { key: 'award_show_three_pm_leader', label: '3-Pointers Leader' },
];

export function adminSiteBody({ seasons = [], quotas = {}, settings = {} } = {}) {
  const fmt = v => v ? Number(v).toFixed(2) : '';
  const awardsEnabled = settings.awards_enabled   !== '0';
  const mvpEnabled    = settings.mvp_race_enabled !== '0';
  const regOpen       = settings.reg_open === '1';

  const sectionToggles = AWARD_SECTIONS.map(({ key, label }) => {
    const on = settings[key] !== '0';
    return `<div class="flex items-center justify-between py-2 border-b border-admin-border/30 last:border-0">
      <span class="text-[12px] text-slate-400">${escHtml(label)}</span>
      <label class="site-toggle site-toggle--sm" title="Show ${escHtml(label)}">
        <input type="checkbox" class="section-toggle" data-key="${escHtml(key)}" ${on ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>`;
  }).join('');

  const quotaRows = seasons.length
    ? seasons.map(s => `
  <div class="flex items-center gap-3 py-3 border-b border-admin-border/70 last:border-b-0">
    <span class="text-[13px] font-semibold text-slate-200 w-20 shrink-0">Season ${escHtml(String(s))}</span>
    <input type="number" class="admin-input site-quota-input" data-season="${escHtml(String(s))}"
      min="0" step="0.01" placeholder="0.00"
      value="${escHtml(fmt(quotas[s]))}"
      style="width:140px">
    <span class="site-quota-msg text-xs"></span>
  </div>`).join('')
    : `<p class="text-sm text-slate-500 py-3">No seasons found. Games must exist before setting quotas.</p>`;

  return `
<div class="mb-6 flex items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Site Settings</h2>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg mb-4">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Awards</div>
  <div class="p-5">
    <p class="text-xs text-slate-500 mb-4 leading-relaxed">Show or hide awards pages from the nav. Toggle off between seasons.</p>

    <div class="flex items-center justify-between py-3 border-b border-admin-border/50">
      <div>
        <div class="text-[13px] font-semibold text-slate-200">Season Awards</div>
        <div class="text-xs text-slate-500 mt-0.5">Season awards page (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/awards</code>)</div>
      </div>
      <label class="site-toggle" title="Toggle Season Awards">
        <input type="checkbox" id="toggle-awards" ${awardsEnabled ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>
    <div class="ml-4 pl-3 border-l-2 border-admin-border/60 py-1 mb-3">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1 mt-1">Sections — release daily</div>
      ${sectionToggles}
      <span id="section-msg" class="text-xs block mt-1.5 min-h-[14px]"></span>
    </div>
    <div class="flex items-center justify-between py-3 border-t border-admin-border/50">
      <div>
        <div class="text-[13px] font-semibold text-slate-200">MVP Race</div>
        <div class="text-xs text-slate-500 mt-0.5">Season MVP ladder with AI-written player cases (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/mvp</code>)</div>
      </div>
      <label class="site-toggle" title="Toggle MVP Race">
        <input type="checkbox" id="toggle-mvp-race" ${mvpEnabled ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>
    <span id="features-msg" class="text-xs block mt-1 min-h-[16px]"></span>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg mb-4">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Registration</div>
  <div class="p-5">
    <p class="text-xs text-slate-500 mb-4 leading-relaxed">Show or hide the membership application banner on the homepage. This is not season-specific — it's for new players who want to join the league.</p>
    <div class="flex items-center justify-between py-3 border-b border-admin-border/50">
      <div>
        <div class="text-[13px] font-semibold text-slate-200">Accepting Applications</div>
        <div class="text-xs text-slate-500 mt-0.5">Shows the "Apply to Join" banner on the homepage</div>
      </div>
      <label class="site-toggle" title="Toggle registration banner">
        <input type="checkbox" id="toggle-reg-open" ${regOpen ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>
    <div class="py-3 border-b border-admin-border/30">
      <label class="block text-[12px] font-semibold text-slate-300 mb-2">Application Deadline <span class="text-slate-500 font-normal">(optional)</span></label>
      <div class="flex items-center gap-3">
        <input type="text" id="reg-deadline-input" placeholder="e.g. August 15, 2026"
          value="${escHtml(settings.reg_deadline || '')}"
          class="admin-input" style="width:220px">
        <button id="reg-deadline-save" class="agm-new-btn">${ICON_CHECK} Save</button>
        <span id="reg-deadline-msg" class="text-xs"></span>
      </div>
    </div>
    <div class="py-3 border-b border-admin-border/30">
      <div class="text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-widest">Info Strip (shown on the /register page)</div>
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <span class="text-slate-500 text-xs w-24 shrink-0">📍 Venue</span>
          <input type="text" id="reg-venue-input" placeholder="e.g. La Salle Gym, Makati"
            value="${escHtml(settings.reg_venue || '')}"
            class="admin-input" style="flex:1;max-width:280px">
        </div>
        <div class="flex items-center gap-3">
          <span class="text-slate-500 text-xs w-24 shrink-0">📅 Schedule</span>
          <input type="text" id="reg-schedule-input" placeholder="e.g. Saturdays, 8am–12pm"
            value="${escHtml(settings.reg_schedule || '')}"
            class="admin-input" style="flex:1;max-width:280px">
        </div>
        <div class="flex items-center gap-3">
          <span class="text-slate-500 text-xs w-24 shrink-0">💸 Season Fee</span>
          <input type="text" id="reg-fee-input" placeholder="e.g. ₱1,500 / season"
            value="${escHtml(settings.reg_fee || '')}"
            class="admin-input" style="flex:1;max-width:280px">
        </div>
        <div class="flex items-center gap-3 mt-1">
          <button id="reg-info-save" class="agm-new-btn">${ICON_CHECK} Save Info</button>
          <span id="reg-info-msg" class="text-xs"></span>
        </div>
      </div>
    </div>
    <span id="reg-msg" class="text-xs block min-h-[14px]"></span>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg">
  <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Season Quotas</div>
  <div class="p-5">
    <p class="text-xs text-slate-500 mb-4 leading-relaxed">Set the payment quota per player for each season. Used in the Ledger to track progress.</p>
    ${quotaRows}
    ${seasons.length ? `<div class="flex items-center gap-3 mt-4">
      <button id="site-quota-save" class="agm-new-btn">${ICON_CHECK} Save Quotas</button>
      <span id="site-quota-msg" class="text-xs"></span>
    </div>` : ''}
  </div>
</div>

<script>
  function bindToggle(id, key) {
    document.getElementById(id).addEventListener('change', async function() {
      var msg = document.getElementById('features-msg');
      msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch(e) {
        msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
        this.checked = !this.checked;
      }
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  }
  bindToggle('toggle-awards',   'awards_enabled');
  bindToggle('toggle-mvp-race', 'mvp_race_enabled');
  (function() {
    document.getElementById('toggle-reg-open').addEventListener('change', async function() {
      var msg = document.getElementById('reg-msg');
      msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reg_open: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch(e) {
        msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
        this.checked = !this.checked;
      }
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  })();

  document.getElementById('reg-deadline-save').addEventListener('click', async function() {
    var val = document.getElementById('reg-deadline-input').value.trim();
    var msg = document.getElementById('reg-deadline-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/site/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reg_deadline: val })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
    } catch(e) {
      msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
    }
    setTimeout(function() { msg.textContent = ''; }, 2000);
  });

  document.getElementById('reg-info-save').addEventListener('click', async function() {
    var msg = document.getElementById('reg-info-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/site/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reg_venue:    document.getElementById('reg-venue-input').value.trim(),
          reg_schedule: document.getElementById('reg-schedule-input').value.trim(),
          reg_fee:      document.getElementById('reg-fee-input').value.trim(),
        })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
    } catch(e) {
      msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
    }
    setTimeout(function() { msg.textContent = ''; }, 2000);
  });

  // Section toggles
  document.querySelectorAll('.section-toggle').forEach(function(input) {
    input.addEventListener('change', async function() {
      var key = this.dataset.key;
      var msg = document.getElementById('section-msg');
      msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch(e) {
        msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
        this.checked = !this.checked;
      }
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  });

  // Quota save
  var saveBtn = document.getElementById('site-quota-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      var btn = this;
      var origHtml = btn.innerHTML;
      var globalMsg = document.getElementById('site-quota-msg');
      btn.disabled = true; btn.textContent = 'Saving…';
      globalMsg.textContent = '';

      var inputs = document.querySelectorAll('.site-quota-input');
      var errors = 0;

      await Promise.all(Array.from(inputs).map(async function(input) {
        var season = input.dataset.season;
        var amount = parseFloat(input.value);
        var msg = input.nextElementSibling;
        if (input.value === '') { msg.textContent = ''; return; }
        if (isNaN(amount) || amount < 0) { msg.style.color = '#f87171'; msg.textContent = 'Invalid'; errors++; return; }
        try {
          var r = await fetch('/admin/ledger/quota/' + encodeURIComponent(season), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
          });
          if (!r.ok) throw new Error('Failed');
          msg.style.color = '#22c55e'; msg.textContent = 'Saved';
        } catch(e) {
          msg.style.color = '#f87171'; msg.textContent = 'Error';
          errors++;
        }
      }));

      btn.disabled = false; btn.innerHTML = origHtml;
      if (!errors) {
        globalMsg.style.color = '#22c55e';
        globalMsg.textContent = 'All quotas saved.';
      }
    });
  }
</script>`;
}
