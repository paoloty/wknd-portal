import { escHtml } from '../layout.js';
import { SIZES } from '../../lib/season-pricing.js';

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function sizeText(top, shorts, pockets) {
  if (!top && !shorts) return '—';
  return [top ? `Top ${top}` : '', shorts ? `Shorts ${shorts}${pockets ? ' + pockets' : ''}` : ''].filter(Boolean).join(' · ');
}

// Available to every player, not just new/traded ones — an existing player who wants a
// different size can still be sent this by admin. needsJersey/data-needs-jersey only
// controls whether the bulk "Request All Pending" action picks this row up automatically.
function jerseyRequestCell(p) {
  const attrs = `data-signup-id="${escHtml(p.signupId)}" data-name="${escHtml(p.name)}" data-needs-jersey="${p.needsJersey ? '1' : '0'}" data-requested="${p.jerseyRequestedAt ? '1' : '0'}"`;
  // Carries the current values onto the row's Edit button so opening the modal doesn't
  // need a round trip — same fields the player's own /jersey-request form collects.
  const editAttrs = `data-edit-id="${escHtml(p.signupId)}" data-edit-name="${escHtml(p.name)}"
    data-jersey-name="${escHtml(p.jerseyName || '')}" data-jersey-number="${escHtml(p.number || '')}"
    data-jersey-top="${escHtml(p.jerseyTop || '')}" data-jersey-shorts="${escHtml(p.jerseyShorts || '')}"
    data-pockets="${p.pockets ? '1' : '0'}" data-shorts-notes="${escHtml(p.shortsNotes || '')}"`;
  const editBtn = `<button class="jrq-edit-btn text-[10px] text-slate-600 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${editAttrs} title="Edit jersey details">✎ Edit</button>`;

  if (p.jerseySubmittedAt) {
    return `<td class="px-4 py-2.5 text-right whitespace-nowrap">
      <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">✓ Submitted</span>
      <button class="jrq-btn text-[10px] text-slate-600 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>
      ${editBtn}
    </td>`;
  }
  if (p.jerseyRequestedAt) {
    return `<td class="px-4 py-2.5 text-right whitespace-nowrap">
      <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#f5933218;color:#f59332;border:1px solid #f5933233">Requested</span>
      <button class="jrq-btn text-[10px] text-slate-600 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>
      ${editBtn}
    </td>`;
  }
  return `<td class="px-4 py-2.5 text-right whitespace-nowrap">
    <button class="jrq-btn admin-btn admin-btn--sm" ${attrs}>Request Jersey Details</button>
    ${editBtn}
  </td>`;
}

function rosterRow(p) {
  const positions = parsePositions(p.positions);
  const initial    = escHtml((p.name || '?').charAt(0).toUpperCase());
  const avatar     = p.pictureUrl
    ? `<img src="${escHtml(p.pictureUrl)}" style="width:100%;height:100%;object-fit:cover;object-position:top center">`
    : initial;

  const numberBadge = p.number
    ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded" style="background:#1e293b;color:#e2e8f0;font-family:'Saira Condensed',sans-serif">#${escHtml(String(p.number))}</span>`
    : `<span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#f871711a;color:#f87171;border:1px solid #f8717133">Pending</span>`;

  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-2.5">
      <div class="flex items-center gap-2.5">
        <div style="width:28px;height:28px;border-radius:50%;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#64748b;overflow:hidden">${avatar}</div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-[12.5px] font-semibold text-slate-200">${escHtml(p.name)}</span>
            ${p.isNew    ? `<span class="text-[8px] font-extrabold tracking-wide px-1.5 py-0.5 rounded" style="background:#22c55e18;color:#22c55e;border:1px solid #22c55e33">NEW</span>` : ''}
            ${p.isTraded ? `<span class="text-[8px] font-extrabold tracking-wide px-1.5 py-0.5 rounded" style="background:#3b82f618;color:#3b82f6;border:1px solid #3b82f633">TRADED</span>` : ''}
            ${p.isHead   ? `<span class="text-[8px] font-extrabold tracking-wide px-1.5 py-0.5 rounded" style="background:#f5933218;color:#f59332;border:1px solid #f5933233">HEAD</span>` : ''}
          </div>
          ${positions.length ? `<div class="text-[10px] text-slate-600">${positions.map(escHtml).join(' · ')}</div>` : ''}
        </div>
      </div>
    </td>
    <td class="px-4 py-2.5 text-[11px] text-slate-400">${p.jerseyName ? escHtml(p.jerseyName) : '<span class="text-slate-700">—</span>'}</td>
    <td class="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">
      ${escHtml(sizeText(p.jerseyTop, p.jerseyShorts, p.pockets))}
      ${p.shortsNotes ? `<div class="text-[10px] text-slate-600 italic" style="white-space:normal;max-width:180px" title="${escHtml(p.shortsNotes)}">"${escHtml(p.shortsNotes)}"</div>` : ''}
    </td>
    <td class="px-4 py-2.5 text-right">${numberBadge}</td>
    ${jerseyRequestCell(p)}
  </tr>`;
}

// One team's full-width table + status line — lives inside a single game-tabs__body panel,
// so it's never squeezed into a narrow card the way a side-by-side grid would (that's what
// was clipping/hiding the Jersey Request column before).
function teamPanel(team, roster) {
  const pendingCount = roster.filter(p => !p.number).length;
  const jerseyDue    = roster.filter(p => p.needsJersey && !p.jerseySubmittedAt).length;

  return `<div class="px-5 py-4">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
      <span class="text-[11px] text-slate-600">${roster.length} player${roster.length === 1 ? '' : 's'}</span>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${pendingCount
          ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#f871711a;color:#f87171;border:1px solid #f8717133">${pendingCount} number${pendingCount === 1 ? '' : 's'} pending</span>`
          : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">All numbers set</span>`}
        ${jerseyDue ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#3b82f61a;color:#3b82f6;border:1px solid #3b82f633">${jerseyDue} jersey request${jerseyDue === 1 ? '' : 's'} due</span>` : ''}
      </div>
    </div>
    ${roster.length === 0
      ? `<div class="p-6 text-center text-[12px] text-slate-600">No players assigned yet.</div>`
      : `<div style="overflow-x:auto"><table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-admin-border">
              <th class="px-4 py-2 text-left text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Player</th>
              <th class="px-4 py-2 text-left text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Jersey Name</th>
              <th class="px-4 py-2 text-left text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Size</th>
              <th class="px-4 py-2 text-right text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Number</th>
              <th class="px-4 py-2 text-right text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Jersey Request</th>
            </tr>
          </thead>
          <tbody>${roster.map(rosterRow).join('')}</tbody>
        </table></div>`}
  </div>`;
}

// Mirrors exactly what a team head sees on the public /my-team page (see
// buildTeamRosterView in server.js) — plus a "Request Jersey Details" trigger, available for
// any player (not just new/traded), which pushes a notification + email with a tokenized
// link to /jersey-request for the player to fill in their own size/number/printed name.
// Teams are tabbed (reusing the same .game-tabs pattern as the game-detail admin page)
// rather than shown side-by-side — a row-by-row grid squeezed every table into a narrow
// card and clipped the rightmost columns; one full-width panel per team fixes that.
export function adminSeasonTeamsPreviewBody({ sigSeason = '', teamsWithRosters = [], rosterPublished = false } = {}) {
  const totalDue = teamsWithRosters.reduce((sum, { roster }) => sum + roster.filter(p => p.needsJersey && !p.jerseyRequestedAt).length, 0);

  const tabs = teamsWithRosters.map(({ team, roster }, i) => {
    const due = roster.filter(p => p.needsJersey && !p.jerseySubmittedAt).length;
    return `<button class="game-tabs__tab${i === 0 ? ' game-tabs__tab--active' : ''}" data-team-tab="team-${escHtml(team.id)}">
      <span class="team-dot" style="background:${escHtml(team.color)}"></span>${escHtml(team.name)}
      ${due ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style="background:#3b82f633;color:#93c5fd">${due}</span>` : ''}
    </button>`;
  }).join('');

  const panels = teamsWithRosters.map(({ team, roster }, i) =>
    `<div id="tab-team-${escHtml(team.id)}" class="game-tabs__body${i === 0 ? '' : ' game-tabs__body--hidden'}">${teamPanel(team, roster)}</div>`
  ).join('');

  return `
<div class="flex items-start justify-between gap-4 flex-wrap mb-5">
  <div>
    <a href="/admin/season/teams" class="text-[11px] text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Team Builder</a>
    <h1 class="m-0 text-xl font-extrabold text-slate-100">Team Preview <span class="text-brand">— Head View</span></h1>
    <p class="text-[11px] text-slate-500 mt-1 mb-0">What each team head sees at <code class="text-[10.5px] bg-admin-border/50 px-1 rounded">/my-team</code> for Season ${escHtml(String(sigSeason))}.</p>
  </div>
  <div class="flex items-center gap-2 flex-wrap">
    ${rosterPublished
      ? `<span class="text-[11px] font-bold px-3 py-1 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">● Published to Players</span>`
      : `<span class="text-[11px] font-bold px-3 py-1 rounded-full" style="background:transparent;color:#64748b;border:1px solid #334155">○ Not Published — heads can't see this yet</span>`}
    <label class="text-[11px] text-slate-500 flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" id="export-all-toggle"> Include stayed players
    </label>
    <a id="export-link" href="/admin/season/teams/export-jerseys?season=${encodeURIComponent(sigSeason)}" class="text-[12px] font-semibold px-3.5 py-1.5 rounded-md no-underline bg-transparent border border-admin-border text-slate-400 hover:text-slate-200">⬇ Export CSV</a>
    ${totalDue ? `<button id="bulk-request-btn" class="text-[12px] font-bold px-3.5 py-1.5 rounded-md cursor-pointer border-0" style="background:#f59332;color:#1a1206">Request All Pending (${totalDue})</button>` : ''}
  </div>
</div>

${teamsWithRosters.length === 0
  ? `<div class="border-2 border-dashed border-admin-border rounded-xl p-10 text-center text-slate-700 text-[13px]">No teams built yet — set them up in Team Builder first.</div>`
  : `<div class="card game-tabs">
      <div class="game-tabs__nav">${tabs}</div>
      ${panels}
    </div>`}

<span id="jrq-msg" class="fixed bottom-5 right-5 text-[12px] font-semibold px-3.5 py-2 rounded-lg" style="display:none;background:#0f1623;border:1px solid #1c2840;color:#e2e8f0;z-index:50"></span>

<!-- Edit Jersey Details modal — one shared instance, populated per-row from the clicked
     Edit button's data-* attributes. Same fields/validation as the player's own form. -->
<div id="jersey-edit-modal" class="hidden fixed inset-0 z-50 items-center justify-center" style="background:rgba(0,0,0,.75)">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-6 max-w-sm w-[90%] shadow-2xl">
    <h2 class="m-0 mb-4 text-[15px] font-extrabold text-slate-100">Edit Jersey Details — <span id="je-player-name" class="text-brand"></span></h2>
    <div class="flex flex-col gap-3">
      <div>
        <label class="admin-field-label">Name on Jersey</label>
        <input id="je-name" class="admin-input" maxlength="20">
      </div>
      <div>
        <label class="admin-field-label">Number</label>
        <input id="je-number" class="admin-input" inputmode="numeric" maxlength="2" placeholder="0-99">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="admin-field-label">Top Size</label>
          <select id="je-top" class="admin-input">
            <option value="">—</option>
            ${SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="admin-field-label">Shorts Size</label>
          <select id="je-shorts" class="admin-input">
            <option value="">None</option>
            ${SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <label class="text-[12px] text-slate-400 flex items-center gap-2 cursor-pointer">
        <input type="checkbox" id="je-pockets"> Add pockets to shorts
      </label>
      <div>
        <label class="admin-field-label">Shorts Notes</label>
        <textarea id="je-notes" class="admin-input" rows="2" maxlength="200"></textarea>
      </div>
    </div>
    <div id="je-error" class="text-error text-[12px] mt-3 min-h-[16px]"></div>
    <div class="flex gap-2.5 justify-end mt-2">
      <button id="je-cancel" class="bg-transparent border border-admin-border text-slate-400 text-[13px] font-semibold rounded-md px-4 py-2 cursor-pointer">Cancel</button>
      <button id="je-save" class="bg-green-500 text-admin-bg text-[13px] font-bold border-0 rounded-md px-4 py-2 cursor-pointer">Save</button>
    </div>
  </div>
</div>

<script>
(function() {
  var msg = document.getElementById('jrq-msg');
  function flash(text, ok) {
    msg.textContent = text;
    msg.style.color = ok ? '#22c55e' : '#f87171';
    msg.style.display = 'block';
    setTimeout(function() { msg.style.display = 'none'; }, 3000);
  }

  var tabNav = document.querySelector('.game-tabs__nav');
  if (tabNav) tabNav.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-team-tab]');
    if (!btn) return;
    document.querySelectorAll('.game-tabs__tab').forEach(function(b) { b.classList.remove('game-tabs__tab--active'); });
    document.querySelectorAll('[id^="tab-team-"]').forEach(function(b) { b.classList.add('game-tabs__body--hidden'); });
    btn.classList.add('game-tabs__tab--active');
    document.getElementById('tab-' + btn.dataset.teamTab).classList.remove('game-tabs__body--hidden');
  });

  async function requestOne(signupId) {
    var r = await fetch('/admin/season-signups/' + signupId + '/request-jersey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Failed');
  }

  document.querySelectorAll('.jrq-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      btn.disabled = true;
      try {
        await requestOne(btn.dataset.signupId);
        flash('Jersey request sent to ' + btn.dataset.name + '.', true);
        setTimeout(function() { location.reload(); }, 900);
      } catch (e) { btn.disabled = false; flash(e.message, false); }
    });
  });

  var bulkBtn = document.getElementById('bulk-request-btn');
  if (bulkBtn) bulkBtn.addEventListener('click', async function() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('.jrq-btn[data-needs-jersey="1"][data-requested="0"]'));
    if (!targets.length) return;
    if (!confirm('Send a jersey request to ' + targets.length + ' player' + (targets.length === 1 ? '' : 's') + '?')) return;
    bulkBtn.disabled = true; bulkBtn.textContent = 'Sending…';
    var failed = 0;
    for (var i = 0; i < targets.length; i++) {
      try { await requestOne(targets[i].dataset.signupId); } catch (e) { failed++; }
    }
    flash(failed ? (targets.length - failed) + ' sent, ' + failed + ' failed.' : 'Sent to all ' + targets.length + '.', !failed);
    setTimeout(function() { location.reload(); }, 900);
  });

  var exportLink = document.getElementById('export-link');
  var exportAllToggle = document.getElementById('export-all-toggle');
  if (exportLink && exportAllToggle) {
    var baseHref = exportLink.getAttribute('href');
    exportAllToggle.addEventListener('change', function() {
      exportLink.href = baseHref + (exportAllToggle.checked ? '&all=1' : '');
    });
  }

  // ── Edit Jersey Details modal ─────────────────────────────────────────────
  var editModal   = document.getElementById('jersey-edit-modal');
  var editIdField = null; // current signup id being edited

  function openEditModal(btn) {
    editIdField = btn.dataset.editId;
    document.getElementById('je-player-name').textContent = btn.dataset.editName;
    document.getElementById('je-name').value    = btn.dataset.jerseyName;
    document.getElementById('je-number').value  = btn.dataset.jerseyNumber;
    document.getElementById('je-top').value     = btn.dataset.jerseyTop;
    document.getElementById('je-shorts').value  = btn.dataset.jerseyShorts;
    document.getElementById('je-pockets').checked = btn.dataset.pockets === '1';
    document.getElementById('je-notes').value   = btn.dataset.shortsNotes;
    document.getElementById('je-error').textContent = '';
    editModal.classList.remove('hidden'); editModal.classList.add('flex');
  }
  function closeEditModal() {
    editModal.classList.add('hidden'); editModal.classList.remove('flex');
  }

  document.querySelectorAll('.jrq-edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openEditModal(btn); });
  });

  var jeCancel = document.getElementById('je-cancel');
  if (jeCancel) jeCancel.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', function(e) { if (e.target === editModal) closeEditModal(); });

  var jeSave = document.getElementById('je-save');
  if (jeSave) jeSave.addEventListener('click', async function() {
    var errEl = document.getElementById('je-error');
    errEl.textContent = '';
    jeSave.disabled = true; jeSave.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/season-signups/' + editIdField + '/jersey-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jersey_name:   document.getElementById('je-name').value,
          jersey_number: document.getElementById('je-number').value,
          jersey_top:    document.getElementById('je-top').value,
          jersey_shorts: document.getElementById('je-shorts').value,
          pockets:       document.getElementById('je-pockets').checked,
          jersey_shorts_notes: document.getElementById('je-notes').value,
        }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save.');
      location.reload();
    } catch (e) {
      errEl.textContent = e.message;
      jeSave.disabled = false; jeSave.textContent = 'Save';
    }
  });
})();
</script>`;
}
