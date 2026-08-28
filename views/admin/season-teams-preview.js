import { escHtml } from '../layout.js';
import { SIZES } from '../../lib/season-pricing.js';

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function sizeText(top, shorts, pockets) {
  if (!top && !shorts) return '—';
  return [top ? `Top ${top}` : '', shorts ? `Shorts ${shorts}${pockets ? ' + pockets' : ''}` : ''].filter(Boolean).join(' · ');
}

// Quick add/remove, separate from the full jersey-details edit — the player-facing size
// picker defaults to "None" and players kept missing it or picking it by mistake, so this
// is a one-click fix admin can reach without opening the modal (which also demands
// re-entering name/number). Removing clears shorts + pockets + notes together, since none
// of those mean anything without a shorts size to go with them.
function shortsControlHtml(signupId) {
  const opts = SIZES.map(s => `<option value="${s}">${s}</option>`).join('');
  return `<select class="shorts-add-select text-[10px] bg-transparent border border-admin-border rounded px-1 py-0.5 text-slate-500" data-signup-id="${escHtml(signupId)}">
    <option value="">+ Add shorts</option>${opts}
  </select>`;
}

function sizeCellInner(p) {
  const shortsControl = p.jerseyShorts
    ? `<button class="shorts-remove-btn text-[10px] text-rose-400 hover:text-rose-300 bg-transparent border-0 cursor-pointer p-0" data-signup-id="${escHtml(p.signupId)}">✕ Remove shorts</button>`
    : shortsControlHtml(p.signupId);
  return `${escHtml(sizeText(p.jerseyTop, p.jerseyShorts, p.pockets))}
    ${p.shortsNotes ? `<div class="text-slate-600 text-[10px] italic mt-0.5" style="white-space:normal;max-width:180px" title="${escHtml(p.shortsNotes)}">"${escHtml(p.shortsNotes)}"</div>` : ''}
    <div class="mt-1">${shortsControl}</div>`;
}

// Same pill recipe as STATUS_BADGE in season-waitlist.js (background/border alpha suffixes
// included) so a status badge reads identically whether you're looking at the waitlist or
// here — one visual vocabulary for "state of a row" across admin.
function pill(color, label) {
  return `<span style="background:${color}22;color:${color};border:1px solid ${color}44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">${label}</span>`;
}

// Small, self-contained templates (name matches the client-side JS mirrors in the script
// block below) so a successful action can patch the DOM in place instead of the page doing
// a full reload — a reload was resetting the active team tab back to the first one every
// time, which is what made repeat admin actions annoying.
function numberBadgeHtml(number) {
  return number
    ? `<span class="text-xs font-bold px-2 py-0.5 rounded" style="background:#1e293b;color:#e2e8f0;font-family:'Saira Condensed',sans-serif">#${escHtml(String(number))}</span>`
    : pill('#f87171', 'PENDING');
}

function jerseyStatusHtml(p) {
  const attrs = `data-signup-id="${escHtml(p.signupId)}" data-name="${escHtml(p.name)}" data-needs-jersey="${p.needsJersey ? '1' : '0'}" data-requested="${p.jerseyRequestedAt ? '1' : '0'}"`;
  if (p.jerseySubmittedAt) {
    return `${pill('#22c55e', '✓ SUBMITTED')}
      <button class="jrq-btn text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>`;
  }
  if (p.jerseyRequestedAt) {
    return `${pill('#f59332', 'REQUESTED')}
      <button class="jrq-btn text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>`;
  }
  return `<button class="jrq-btn admin-btn admin-btn--sm" ${attrs}>Request Jersey Details</button>`;
}

// Available to every player, not just new/traded ones — an existing player who wants a
// different size can still be sent this by admin. needsJersey/data-needs-jersey only
// controls whether the bulk "Request All Pending" action picks this row up automatically.
function jerseyRequestCell(p) {
  // Carries the current values onto the row's Edit button so opening the modal doesn't
  // need a round trip — same fields the player's own /jersey-request form collects.
  const editAttrs = `data-edit-id="${escHtml(p.signupId)}" data-edit-name="${escHtml(p.name)}"
    data-jersey-name="${escHtml(p.jerseyName || '')}" data-jersey-number="${escHtml(p.number || '')}"
    data-jersey-top="${escHtml(p.jerseyTop || '')}" data-jersey-shorts="${escHtml(p.jerseyShorts || '')}"
    data-pockets="${p.pockets ? '1' : '0'}" data-shorts-notes="${escHtml(p.shortsNotes || '')}"`;
  const editBtn = `<button class="jrq-edit-btn text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${editAttrs} title="Edit jersey details">✎ Edit</button>`;

  return `<td class="px-4 py-3 text-right whitespace-nowrap jrq-cell">
    <span class="jrq-status" data-submitted="${p.jerseySubmittedAt ? '1' : '0'}">${jerseyStatusHtml(p)}</span>
    ${editBtn}
  </td>`;
}

function rosterRow(p) {
  const positions = parsePositions(p.positions);
  const initial    = escHtml((p.name || '?').charAt(0).toUpperCase());
  const avatar     = p.pictureUrl
    ? `<img src="${escHtml(p.pictureUrl)}" style="width:100%;height:100%;object-fit:cover;object-position:top center">`
    : initial;

  return `<tr class="border-b border-admin-border/40 last:border-0" data-row-signup-id="${escHtml(p.signupId)}" data-needs-jersey="${p.needsJersey ? '1' : '0'}">
    <td class="px-4 py-3">
      <div class="flex items-center gap-2.5">
        <div style="width:28px;height:28px;border-radius:50%;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#64748b;overflow:hidden">${avatar}</div>
        <div>
          <div class="font-semibold text-slate-200 flex items-center gap-1.5">
            ${escHtml(p.name)}
            ${p.isNew    ? pill('#22c55e', 'NEW') : ''}
            ${p.isTraded ? pill('#3b82f6', 'TRADED') : ''}
            ${p.isHead   ? pill('#f59332', 'HEAD') : ''}
          </div>
          ${positions.length ? `<div class="text-slate-500">${positions.map(escHtml).join(' · ')}</div>` : ''}
        </div>
      </div>
    </td>
    <td class="px-4 py-3 text-slate-400 jn-cell">${p.jerseyName ? escHtml(p.jerseyName) : '<span class="text-slate-600">—</span>'}</td>
    <td class="px-4 py-3 text-slate-400 whitespace-nowrap size-cell">${sizeCellInner(p)}</td>
    <td class="px-4 py-3 text-right num-cell" data-has-number="${p.number ? '1' : '0'}">${numberBadgeHtml(p.number)}</td>
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
      <span class="text-xs text-slate-500">${roster.length} player${roster.length === 1 ? '' : 's'}</span>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${pendingCount
          ? `<span class="pending-badge text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="${pendingCount}" style="background:#f8717122;color:#f87171;border:1px solid #f8717144">${pendingCount} number${pendingCount === 1 ? '' : 's'} pending</span>`
          : `<span class="pending-badge text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="0" style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44">All numbers set</span>`}
        ${jerseyDue ? `<span class="due-badge text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="${jerseyDue}" style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644">${jerseyDue} jersey request${jerseyDue === 1 ? '' : 's'} due</span>` : ''}
      </div>
    </div>
    ${roster.length === 0
      ? `<div class="p-6 text-center text-sm text-slate-500">No players assigned yet.</div>`
      : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead>
            <tr class="border-b border-admin-border text-slate-500 uppercase tracking-wider text-[10px]">
              <th class="px-4 py-2.5 text-left font-semibold">Player</th>
              <th class="px-4 py-2.5 text-left font-semibold">Jersey Name</th>
              <th class="px-4 py-2.5 text-left font-semibold">Size</th>
              <th class="px-4 py-2.5 text-right font-semibold">Number</th>
              <th class="px-4 py-2.5 text-right font-semibold">Jersey Request</th>
            </tr>
          </thead>
          <tbody>${roster.map(rosterRow).join('')}</tbody>
        </table></div>
      </div>`}
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
      ${due ? `<span class="tab-due-badge text-[9px] font-bold px-1.5 py-0.5 rounded-full" data-count="${due}" style="background:#3b82f633;color:#93c5fd">${due}</span>` : ''}
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

  // Client-side mirrors of the server templates in season-teams-preview.js, so a
  // successful action can patch just the affected DOM instead of reloading the whole page
  // — a reload was resetting the active team tab back to the first one every time.
  function escHtmlJs(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Same color22/color44 pill recipe as the server-side pill() helper (and STATUS_BADGE in
  // season-waitlist.js) — kept in sync by hand since this runs in the browser.
  function pill(color, label) {
    return '<span style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">' + label + '</span>';
  }
  function numberBadgeHtml(number) {
    return number
      ? '<span class="text-xs font-bold px-2 py-0.5 rounded" style="background:#1e293b;color:#e2e8f0;font-family:\\'Saira Condensed\\',sans-serif">#' + escHtmlJs(number) + '</span>'
      : pill('#f87171', 'PENDING');
  }
  var SIZES = ${JSON.stringify(SIZES)};
  function sizeText(top, shorts, pockets) {
    var parts = [];
    if (top) parts.push('Top ' + top);
    if (shorts) parts.push('Shorts ' + shorts + (pockets ? ' + pockets' : ''));
    return parts.length ? parts.join(' · ') : '—';
  }
  function shortsControlHtml(signupId, shorts) {
    if (shorts) {
      return '<button class="shorts-remove-btn text-[10px] text-rose-400 hover:text-rose-300 bg-transparent border-0 cursor-pointer p-0" data-signup-id="' + escHtmlJs(signupId) + '">✕ Remove shorts</button>';
    }
    var opts = '<option value="">+ Add shorts</option>' + SIZES.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    return '<select class="shorts-add-select text-[10px] bg-transparent border border-admin-border rounded px-1 py-0.5 text-slate-500" data-signup-id="' + escHtmlJs(signupId) + '">' + opts + '</select>';
  }
  function sizeCellInner(signupId, top, shorts, pockets, notes) {
    var html = escHtmlJs(sizeText(top, shorts, pockets));
    if (notes) html += '<div class="text-slate-600 text-[10px] italic mt-0.5" style="white-space:normal;max-width:180px" title="' + escHtmlJs(notes) + '">"' + escHtmlJs(notes) + '"</div>';
    html += '<div class="mt-1">' + shortsControlHtml(signupId, shorts) + '</div>';
    return html;
  }
  function statusHtml(signupId, name, needsJersey, requested, submitted) {
    var attrs = 'data-signup-id="' + escHtmlJs(signupId) + '" data-name="' + escHtmlJs(name) + '" data-needs-jersey="' + (needsJersey ? '1' : '0') + '" data-requested="' + (requested ? '1' : '0') + '"';
    if (submitted) {
      return pill('#22c55e', '✓ SUBMITTED') +
        '<button class="jrq-btn text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ' + attrs + '>Resend</button>';
    }
    if (requested) {
      return pill('#f59332', 'REQUESTED') +
        '<button class="jrq-btn text-[11px] text-slate-500 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ' + attrs + '>Resend</button>';
    }
    return '<button class="jrq-btn admin-btn admin-btn--sm" ' + attrs + '>Request Jersey Details</button>';
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

  // Requesting/resending never changes jersey_submitted_at, so it can only ever move a row
  // to the "Requested" state (or leave an already-"Submitted" row exactly as it was) — no
  // pending/due badge counts to adjust for this action, only edits below touch those.
  function applyRequestedState(btn) {
    var span = btn.closest('.jrq-status');
    if (!span) return;
    var wasSubmitted = span.dataset.submitted === '1';
    span.innerHTML = statusHtml(btn.dataset.signupId, btn.dataset.name, btn.dataset.needsJersey === '1', true, wasSubmitted);
  }

  // Delegated (not bound per-button) so it keeps working on buttons rebuilt by
  // applyRequestedState/edit-save without needing to re-wire listeners after every patch.
  document.addEventListener('click', async function(e) {
    var btn = e.target.closest('.jrq-btn');
    if (!btn) return;
    btn.disabled = true;
    try {
      await requestOne(btn.dataset.signupId);
      flash('Jersey request sent to ' + btn.dataset.name + '.', true);
      applyRequestedState(btn);
    } catch (err) { btn.disabled = false; flash(err.message, false); }
  });

  var bulkBtn = document.getElementById('bulk-request-btn');
  if (bulkBtn) bulkBtn.addEventListener('click', async function() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('.jrq-btn[data-needs-jersey="1"][data-requested="0"]'));
    if (!targets.length) return;
    if (!confirm('Send a jersey request to ' + targets.length + ' player' + (targets.length === 1 ? '' : 's') + '?')) return;
    bulkBtn.disabled = true; bulkBtn.textContent = 'Sending…';
    var sent = 0, failed = 0;
    for (var i = 0; i < targets.length; i++) {
      try { await requestOne(targets[i].dataset.signupId); applyRequestedState(targets[i]); sent++; } catch (e) { failed++; }
    }
    flash(failed ? sent + ' sent, ' + failed + ' failed.' : 'Sent to all ' + sent + '.', !failed);
    var remaining = document.querySelectorAll('.jrq-btn[data-needs-jersey="1"][data-requested="0"]').length;
    if (remaining) { bulkBtn.disabled = false; bulkBtn.textContent = 'Request All Pending (' + remaining + ')'; }
    else bulkBtn.remove();
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

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.jrq-edit-btn');
    if (btn) openEditModal(btn);
  });

  var jeCancel = document.getElementById('je-cancel');
  if (jeCancel) jeCancel.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', function(e) { if (e.target === editModal) closeEditModal(); });

  function pendingBadgeHtml(n) {
    return n > 0
      ? '<span class="pending-badge text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="' + n + '" style="background:#f8717122;color:#f87171;border:1px solid #f8717144">' + n + ' number' + (n === 1 ? '' : 's') + ' pending</span>'
      : '<span class="pending-badge text-[10px] font-bold px-2 py-0.5 rounded-full" data-count="0" style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44">All numbers set</span>';
  }

  // Shared by edit-save and the shorts quick-toggle below — both can flip a row from
  // unsubmitted to submitted, and either way the due counts can only ever go down.
  function decrementDueBadges(tr) {
    var panel = tr.closest('.game-tabs__body');
    if (!panel) return;
    var db = panel.querySelector('.due-badge');
    if (db) {
      var n2 = Math.max(0, Number(db.dataset.count) - 1);
      if (n2 <= 0) db.remove();
      else { db.dataset.count = n2; db.textContent = n2 + ' jersey request' + (n2 === 1 ? '' : 's') + ' due'; }
    }
    var tabBadge = document.querySelector('.game-tabs__tab--active .tab-due-badge');
    if (tabBadge) {
      var n3 = Math.max(0, Number(tabBadge.dataset.count) - 1);
      if (n3 <= 0) tabBadge.remove();
      else { tabBadge.dataset.count = n3; tabBadge.textContent = n3; }
    }
  }

  // ── Shorts quick add/remove ────────────────────────────────────────────────
  document.addEventListener('click', async function(e) {
    var btn = e.target.closest('.shorts-remove-btn');
    if (!btn) return;
    await applyShortsChange(btn, '', false, '');
  });
  document.addEventListener('change', async function(e) {
    var sel = e.target.closest('.shorts-add-select');
    if (!sel || !sel.value) return;
    await applyShortsChange(sel, sel.value, false, '');
  });

  async function applyShortsChange(el, shorts, pockets, notes) {
    var signupId = el.dataset.signupId;
    var tr = el.closest('tr[data-row-signup-id]');
    el.disabled = true;
    try {
      var r = await fetch('/admin/season-signups/' + signupId + '/shorts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jersey_shorts: shorts, pockets: pockets, jersey_shorts_notes: notes }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save.');
      if (tr) {
        var sizeCell = tr.querySelector('.size-cell');
        var editBtn  = tr.querySelector('.jrq-edit-btn');
        var topVal   = editBtn ? editBtn.dataset.jerseyTop : '';
        if (sizeCell) sizeCell.innerHTML = sizeCellInner(signupId, topVal, shorts, pockets, notes);
        if (editBtn) {
          editBtn.dataset.jerseyShorts = shorts;
          editBtn.dataset.pockets      = pockets ? '1' : '0';
          editBtn.dataset.shortsNotes  = notes;
        }
        var statusSpan  = tr.querySelector('.jrq-status');
        var wasSubmitted = !!statusSpan && statusSpan.dataset.submitted === '1';
        var needsJersey  = tr.dataset.needsJersey === '1';
        if (statusSpan) {
          // This write always sets jersey_submitted_at server-side, so the row is
          // "Submitted" now regardless of whether it was ever formally requested first.
          statusSpan.dataset.submitted = '1';
          statusSpan.innerHTML = statusHtml(signupId, editBtn ? editBtn.dataset.editName : '', needsJersey, true, true);
        }
        if (needsJersey && !wasSubmitted) decrementDueBadges(tr);
      }
      flash(shorts ? 'Shorts added.' : 'Shorts removed.', true);
    } catch (err) {
      flash(err.message, false);
    } finally {
      el.disabled = false;
    }
  }

  var jeSave = document.getElementById('je-save');
  if (jeSave) jeSave.addEventListener('click', async function() {
    var errEl = document.getElementById('je-error');
    errEl.textContent = '';

    var nameVal    = document.getElementById('je-name').value.trim();
    var numberVal  = document.getElementById('je-number').value.trim();
    var topVal     = document.getElementById('je-top').value;
    var shortsVal  = document.getElementById('je-shorts').value;
    var pocketsVal = document.getElementById('je-pockets').checked;
    var notesVal   = document.getElementById('je-notes').value.trim();

    jeSave.disabled = true; jeSave.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/season-signups/' + editIdField + '/jersey-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jersey_name: nameVal, jersey_number: numberVal, jersey_top: topVal, jersey_shorts: shortsVal,
          pockets: pocketsVal, jersey_shorts_notes: notesVal,
        }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save.');

      var tr = document.querySelector('tr[data-row-signup-id="' + editIdField + '"]');
      if (tr) {
        var jnCell = tr.querySelector('.jn-cell');
        if (jnCell) jnCell.innerHTML = nameVal ? escHtmlJs(nameVal) : '<span class="text-slate-700">—</span>';

        var sizeCell = tr.querySelector('.size-cell');
        if (sizeCell) sizeCell.innerHTML = sizeCellInner(editIdField, topVal, shortsVal, pocketsVal, notesVal);

        var numCell = tr.querySelector('.num-cell');
        var wasPending = !!numCell && numCell.dataset.hasNumber === '0';
        if (numCell) {
          numCell.dataset.hasNumber = numberVal ? '1' : '0';
          numCell.innerHTML = numberBadgeHtml(numberVal);
        }

        var statusSpan = tr.querySelector('.jrq-status');
        var wasSubmitted = !!statusSpan && statusSpan.dataset.submitted === '1';
        var needsJersey = tr.dataset.needsJersey === '1';
        var editBtn = tr.querySelector('.jrq-edit-btn');
        var playerName = editBtn ? editBtn.dataset.editName : '';
        if (statusSpan) {
          statusSpan.dataset.submitted = '1';
          statusSpan.innerHTML = statusHtml(editIdField, playerName, needsJersey, true, true);
        }
        if (editBtn) {
          editBtn.dataset.jerseyName   = nameVal;
          editBtn.dataset.jerseyNumber = numberVal;
          editBtn.dataset.jerseyTop    = topVal;
          editBtn.dataset.jerseyShorts = shortsVal;
          editBtn.dataset.pockets      = pocketsVal ? '1' : '0';
          editBtn.dataset.shortsNotes  = notesVal;
        }

        // Editing always results in a submitted, non-empty number — so pending/due counts
        // can only ever go down here, never up.
        var panel = tr.closest('.game-tabs__body');
        if (panel && wasPending && numberVal) {
          var pb = panel.querySelector('.pending-badge');
          if (pb) pb.outerHTML = pendingBadgeHtml(Math.max(0, Number(pb.dataset.count) - 1));
        }
        if (needsJersey && !wasSubmitted) decrementDueBadges(tr);
      }

      flash('Saved.', true);
      closeEditModal();
    } catch (e) {
      errEl.textContent = e.message;
    } finally {
      jeSave.disabled = false; jeSave.textContent = 'Save';
    }
  });
})();
</script>`;
}
