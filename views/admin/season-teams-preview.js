import { escHtml } from '../layout.js';

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

  if (p.jerseySubmittedAt) {
    return `<td class="px-4 py-2.5 text-right">
      <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">✓ Submitted</span>
      <button class="jrq-btn text-[10px] text-slate-600 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>
    </td>`;
  }
  if (p.jerseyRequestedAt) {
    return `<td class="px-4 py-2.5 text-right">
      <span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#f5933218;color:#f59332;border:1px solid #f5933233">Requested</span>
      <button class="jrq-btn text-[10px] text-slate-600 hover:text-slate-300 bg-transparent border-0 cursor-pointer ml-1" ${attrs}>Resend</button>
    </td>`;
  }
  return `<td class="px-4 py-2.5 text-right">
    <button class="jrq-btn admin-btn admin-btn--sm" ${attrs}>Request Jersey Details</button>
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

function teamCard(team, roster) {
  const newCount     = roster.filter(p => p.isNew).length;
  const pendingCount = roster.filter(p => !p.number).length;
  const jerseyDue    = roster.filter(p => p.needsJersey && !p.jerseySubmittedAt).length;

  return `<div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
    <div class="px-5 py-3.5 border-b border-admin-border flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background:${escHtml(team.color)}"></span>
        <span class="text-[13px] font-bold text-slate-200">${escHtml(team.name)}</span>
        <span class="text-[11px] text-slate-600">${roster.length} player${roster.length === 1 ? '' : 's'}${newCount ? ` · ${newCount} new` : ''}</span>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${pendingCount
          ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#f871711a;color:#f87171;border:1px solid #f8717133">${pendingCount} number${pendingCount === 1 ? '' : 's'} pending</span>`
          : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">All numbers set</span>`}
        ${jerseyDue ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#3b82f61a;color:#3b82f6;border:1px solid #3b82f633">${jerseyDue} jersey request${jerseyDue === 1 ? '' : 's'} due</span>` : ''}
      </div>
    </div>
    ${roster.length === 0
      ? `<div class="p-6 text-center text-[12px] text-slate-600">No players assigned yet.</div>`
      : `<table class="w-full border-collapse">
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
        </table>`}
  </div>`;
}

// Mirrors exactly what a team head sees on the public /my-team page (see
// buildTeamRosterView in server.js) — plus a "Request Jersey Details" trigger, available for
// any player (not just new/traded), which pushes a notification + email with a tokenized
// link to /jersey-request for the player to fill in their own size/number/printed name.
export function adminSeasonTeamsPreviewBody({ sigSeason = '', teamsWithRosters = [], rosterPublished = false } = {}) {
  const cards = teamsWithRosters.map(({ team, roster }) => teamCard(team, roster)).join('');
  const totalDue = teamsWithRosters.reduce((sum, { roster }) => sum + roster.filter(p => p.needsJersey && !p.jerseyRequestedAt).length, 0);

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
  : `<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit, minmax(460px, 1fr))">${cards}</div>`}

<span id="jrq-msg" class="fixed bottom-5 right-5 text-[12px] font-semibold px-3.5 py-2 rounded-lg" style="display:none;background:#0f1623;border:1px solid #1c2840;color:#e2e8f0;z-index:50"></span>

<script>
(function() {
  var msg = document.getElementById('jrq-msg');
  function flash(text, ok) {
    msg.textContent = text;
    msg.style.color = ok ? '#22c55e' : '#f87171';
    msg.style.display = 'block';
    setTimeout(function() { msg.style.display = 'none'; }, 3000);
  }

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
})();
</script>`;
}
