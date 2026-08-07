import { escHtml } from '../layout.js';

const ICON_TEAM = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5L2 4v4c0 2.5 2 4.5 5 5 3-.5 5-2.5 5-5V4L7 1.5z"/></svg>`;

const STATUS_BADGE = {
  waitlisted: `<span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WAITLISTED</span>`,
  confirmed:  `<span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">CONFIRMED</span>`,
  rejected:   `<span style="background:#64748b22;color:#64748b;border:1px solid #64748b44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">REJECTED</span>`,
  withdrawn:  `<span style="background:#f8717122;color:#f87171;border:1px solid #f8717144;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WITHDRAWN</span>`,
};

// Checkbox + Member stay pinned while the rest of the row scrolls horizontally, so an admin
// scanning Balance/Status/Actions on a wide row never loses track of whose row it is. Member
// carries the shadow (not the checkbox) since it's the visual edge of the frozen region —
// widths are fixed rather than measured so the second column's sticky offset is deterministic.
const FROZEN_CHECK_TH   = 'px-5 py-2.5 text-left sticky left-0 z-20 bg-admin-surface w-[44px] min-w-[44px]';
const FROZEN_CHECK_TD   = 'px-5 py-3 sticky left-0 z-10 bg-admin-surface w-[44px] min-w-[44px]';
const FROZEN_MEMBER_TH  = 'px-4 py-2.5 text-left font-semibold sticky left-[44px] z-20 bg-admin-surface shadow-[8px_0_12px_-4px_rgba(0,0,0,0.85)]';
const FROZEN_MEMBER_TD  = 'px-4 py-3 sticky left-[44px] z-10 bg-admin-surface shadow-[8px_0_12px_-4px_rgba(0,0,0,0.85)]';

// Matches the dot + count legend rows in the sidebar poll cards (season-waitlist's stats
// sidebar) — same colors, same "colored dot carries identity, text stays readable" split,
// so a value means the same thing whether you're reading the table or the poll card.
function dotLabel(color, textClass, label) {
  return `<span class="inline-flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full" style="background:${color}"></span><span class="${textClass} font-medium">${escHtml(label)}</span></span>`;
}

export function adminWaitlistBody({ sigSeason = '', signups = [], count = 0, confirmedCount = 0, isSuperAdmin = false } = {}) {
  const byStatus = { waitlisted: 0, confirmed: 0, rejected: 0, withdrawn: 0 };
  for (const s of signups) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

  const byPref = { stick: 0, reshuffle: 0 };
  for (const s of signups) if (s.team_pref === 'stick' || s.team_pref === 'reshuffle') byPref[s.team_pref]++;
  const pollTotal = byPref.stick + byPref.reshuffle;

  // League Reshuffle Poll (reshuffle_vote) is a separate yes/no asked of every registrant —
  // distinct from team_pref above, which only applies to returning players with a team on
  // record and only means "keep my own team or not."
  const byReshuffleVote = { yes: 0, no: 0 };
  for (const s of signups) if (s.reshuffle_vote === 'yes' || s.reshuffle_vote === 'no') byReshuffleVote[s.reshuffle_vote]++;
  const reshuffleVoteTotal = byReshuffleVote.yes + byReshuffleVote.no;

  const overviewCard = `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Overview</div>
  <div class="grid grid-cols-2 gap-4 p-4">
    <div><div class="text-2xl font-bold text-slate-100">${signups.length}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Total</div></div>
    <div><div class="text-2xl font-bold text-amber-400">${byStatus.waitlisted}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Waitlisted</div></div>
    <div><div class="text-2xl font-bold text-green-400">${byStatus.confirmed}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Confirmed</div></div>
    <div><div class="text-2xl font-bold text-slate-500">${byStatus.rejected}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Rejected</div></div>
    ${byStatus.withdrawn > 0 ? `<div><div class="text-2xl font-bold text-rose-400">${byStatus.withdrawn}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Withdrawn</div></div>` : ''}
  </div>
</div>`;

  // Shared visual for both polls — a legend row per option (dot + label in neutral ink,
  // never the series color itself — a colored mark carries identity, colored text doesn't
  // read as data) with its count and share % read off directly, then one stacked meter bar
  // underneath so the split still reads at a glance instead of requiring mental math.
  // Sample size is captioned in the header since a 100%-filled bar off one vote would
  // otherwise read as consensus rather than "n=1." Each poll gets its own card — they're
  // answering unrelated questions (returning-team preference vs. a league-wide reshuffle
  // vote) and a shared box would imply a connection that isn't there.
  function pollCard(title, blurb, options) {
    const total = options.reduce((sum, o) => sum + o.count, 0);
    const pct = (o) => total > 0 ? Math.round((o.count / total) * 100) : 0;

    const legendRow = (o) => `
    <div class="flex items-center justify-between text-xs py-1">
      <span class="inline-flex items-center gap-2 text-slate-300 font-medium">
        <span style="width:8px;height:8px;border-radius:50%;background:${o.color};flex-shrink:0"></span>
        ${escHtml(o.label)}
      </span>
      <span class="text-slate-500" style="font-variant-numeric:tabular-nums">${o.count} &middot; ${pct(o)}%</span>
    </div>`;

    // 2px surface-color gaps between segments (rather than a border) so touching shares
    // still read as distinct — zero-share options are dropped from the bar entirely so an
    // empty segment doesn't still eat a gap.
    const bar = `<div class="flex h-2 rounded-full overflow-hidden mt-3" style="gap:2px" aria-hidden="true">
      ${options.filter(o => o.count > 0).map(o => `<div style="width:${(o.count / total) * 100}%;background:${o.color};border-radius:99px"></div>`).join('')}
    </div>`;

    return `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between gap-2">
    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(title)}</span>
    <span class="text-[10px] text-slate-600">n=${total}</span>
  </div>
  <div class="p-4">
    <p class="text-[11px] text-slate-500 leading-relaxed mb-3">${blurb}</p>
    <div class="flex flex-col divide-y divide-admin-border/40">${options.map(legendRow).join('')}</div>
    ${bar}
  </div>
</div>`;
  }

  const teamPrefCard = pollTotal > 0 ? pollCard(
    'Team Preference',
    'Returning players choosing to stick with their prior team vs. opting into the shuffle.',
    [
      { label: 'Stick', count: byPref.stick, color: '#38bdf8' },
      { label: 'Shuffle', count: byPref.reshuffle, color: '#a78bfa' },
    ]
  ) : '';

  const reshuffleVoteCard = reshuffleVoteTotal > 0 ? pollCard(
    'League Shuffle Poll',
    'League-wide yes/no on a full shuffle, asked of every registrant.',
    [
      { label: 'Yes', count: byReshuffleVote.yes, color: '#34d399' },
      { label: 'No', count: byReshuffleVote.no, color: '#f87171' },
    ]
  ) : '';

  const sidebar = `<div class="flex flex-col gap-5">${overviewCard}${teamPrefCard}${reshuffleVoteCard}</div>`;

  const table = signups.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500">No signups yet for Season ${escHtml(sigSeason)}.</div>`
    : `
<div class="px-5 py-2.5 border-b border-admin-border/40 flex items-center gap-3">
  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
    <input type="checkbox" id="select-all" class="accent-amber-400"> Select all
  </label>
  <div class="ml-auto flex gap-3 items-center">
    <span class="text-[10px] text-slate-600 uppercase tracking-wider">Filter:</span>
    <select id="status-filter" class="admin-input text-xs" style="font-size:11px;padding:3px 8px">
      <option value="">All</option>
      <option value="waitlisted">Waitlisted</option>
      <option value="confirmed">Confirmed</option>
      <option value="rejected">Rejected</option>
      <option value="withdrawn">Withdrawn</option>
    </select>
    <span class="text-slate-700">|</span>
    <button id="bulk-confirm-btn" class="text-[11px] font-semibold text-green-400 hover:text-green-300 disabled:opacity-30" disabled>Confirm Selected</button>
    <span class="text-slate-700">·</span>
    <button id="bulk-reject-btn" class="text-[11px] font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-30" disabled>Reject Selected</button>
  </div>
</div>
<div class="overflow-x-auto">
  <table class="w-full text-xs">
    <thead>
      <tr class="border-b border-admin-border text-slate-500 uppercase tracking-wider text-[10px]">
        <th class="${FROZEN_CHECK_TH}"></th>
        <th class="${FROZEN_MEMBER_TH}">Member</th>
        <th class="px-4 py-2.5 text-left font-semibold">Team Pref</th>
        <th class="px-4 py-2.5 text-left font-semibold">League Shuffle</th>
        <th class="px-4 py-2.5 text-left font-semibold">Balance</th>
        <th class="px-4 py-2.5 text-left font-semibold">Status</th>
        <th class="px-4 py-2.5 text-right font-semibold">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${signups.map(s => `<tr class="waitlist-row border-b border-admin-border/40 last:border-0" data-id="${escHtml(s.id)}" data-status="${escHtml(s.status)}">
        <td class="${FROZEN_CHECK_TD}"><input type="checkbox" class="row-check accent-amber-400" data-id="${escHtml(s.id)}"></td>
        <td class="${FROZEN_MEMBER_TD}">
          <div class="font-semibold text-slate-200 flex items-center gap-1.5">
            <a href="/admin/season/signups/${escHtml(s.id)}" class="text-slate-200 hover:text-amber-400 no-underline">${escHtml(s.full_name || '—')}</a>
            ${s.contact_changed_at ? `<span title="${escHtml(s.contact_change_note || 'Emergency contact or birthday differs from what is on file')}" style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;cursor:help">⚠ CONTACT CHANGED</span>` : ''}
            ${s.liveness
              ? (isSuperAdmin
                  ? `<a href="/admin/season/liveness/${escHtml(s.liveness.id)}" title="View liveness capture vs. profile photo" style="background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;text-decoration:none">📷 PHOTO</a>`
                  : `<span title="Liveness capture on file — super admin only" style="background:#3b82f622;color:#60a5fa;border:1px solid #3b82f644;border-radius:10px;padding:1px 6px;font-size:9px;font-weight:700;cursor:help">📷 PHOTO</span>`)
              : s.liveness_skipped_at ? `<span title="Registrant used the skip option instead of capturing a photo" style="color:#64748b;font-size:9px;font-weight:700;cursor:help">📷 SKIPPED</span>` : ''}
          </div>
          <div class="text-slate-500">${escHtml(s.email || '')}</div>
          ${s.phone ? `<div class="text-slate-600 text-[10px] mt-0.5">${escHtml(s.phone)}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          ${s.team_pref === 'stick'
            ? `<span class="inline-flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full" style="background:${escHtml(s.prev_team_color || '#64748b')}"></span><span class="text-sky-400 font-medium">Stick</span>${s.prev_team_name ? `<span class="text-slate-600">(${escHtml(s.prev_team_name)})</span>` : ''}</span>`
            : s.team_pref === 'reshuffle'
              ? dotLabel('#a78bfa', 'text-violet-400', 'Shuffle')
              : `<span class="text-slate-600">—</span>`}
        </td>
        <td class="px-4 py-3">
          ${s.reshuffle_vote === 'yes'
            ? dotLabel('#34d399', 'text-emerald-400', 'Yes')
            : s.reshuffle_vote === 'no'
              ? dotLabel('#f87171', 'text-rose-400', 'No')
              : `<span class="text-slate-600">—</span>`}
        </td>
        <td class="px-4 py-3">
          ${s.has_balance
            ? `<span class="text-amber-400 font-medium">⚠ ₱${Number(s.balance_amt).toLocaleString()}</span>`
            : `<span class="text-slate-600">—</span>`}
        </td>
        <td class="px-4 py-3">${STATUS_BADGE[s.status] ?? escHtml(s.status)}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-2">
            ${s.status === 'confirmed' ? `<button class="admin-btn admin-btn--sm admin-btn--danger signup-withdraw-btn" data-id="${escHtml(s.id)}">Withdraw</button>` : ''}
            ${s.status !== 'confirmed' ? `<button class="admin-btn admin-btn--sm admin-btn--success signup-confirm-btn" data-id="${escHtml(s.id)}">Confirm</button>` : ''}
            ${s.status !== 'rejected'  ? `<button class="admin-btn admin-btn--sm admin-btn--muted signup-reject-btn" data-id="${escHtml(s.id)}">Reject</button>` : ''}
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;

  return `
<div class="w-full">
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <a href="/admin/season" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Season Management</a>
      <h1 class="text-xl font-bold text-slate-100">Waitlist <span class="text-amber-400">Season ${escHtml(String(sigSeason))}</span></h1>
      ${isSuperAdmin ? `<a href="/admin/season/liveness" class="text-[11px] font-semibold text-sky-400 hover:text-sky-300 no-underline">📷 All Liveness Photos</a>` : ''}
    </div>
    ${confirmedCount > 0 ? `<a href="/admin/season/teams" class="agm-new-btn inline-flex items-center gap-1.5">${ICON_TEAM} Build Teams (${confirmedCount})</a>` : ''}
  </div>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start">
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden min-w-0">
      ${table}
    </div>
    ${sidebar}
  </div>
</div>

<script>
(function() {
  // Status filter
  var filter = document.getElementById('status-filter');
  if (filter) filter.addEventListener('change', function() {
    var val = this.value;
    document.querySelectorAll('.waitlist-row').forEach(function(row) {
      row.style.display = (!val || row.dataset.status === val) ? '' : 'none';
    });
    // Uncheck hidden rows
    document.querySelectorAll('.waitlist-row[style*="none"] .row-check').forEach(function(c) { c.checked = false; });
    updateBulkBtns();
  });

  // Select all
  var selectAll   = document.getElementById('select-all');
  var confirmBtn  = document.getElementById('bulk-confirm-btn');
  var rejectBtn   = document.getElementById('bulk-reject-btn');

  function visibleChecks() {
    return Array.from(document.querySelectorAll('.waitlist-row:not([style*="none"]) .row-check'));
  }
  function updateBulkBtns() {
    var checked = document.querySelectorAll('.row-check:checked').length;
    if (confirmBtn) confirmBtn.disabled = checked === 0;
    if (rejectBtn)  rejectBtn.disabled  = checked === 0;
  }

  if (selectAll) {
    selectAll.addEventListener('change', function() {
      visibleChecks().forEach(function(c) { c.checked = selectAll.checked; });
      updateBulkBtns();
    });
  }
  document.querySelectorAll('.row-check').forEach(function(c) {
    c.addEventListener('change', function() {
      updateBulkBtns();
      if (selectAll) {
        var vis = visibleChecks();
        selectAll.checked = vis.length > 0 && vis.every(function(c) { return c.checked; });
      }
    });
  });

  async function bulkAction(action) {
    var ids = Array.from(document.querySelectorAll('.row-check:checked')).map(function(c) { return c.dataset.id; });
    if (!ids.length) return;
    var label = action === 'confirm' ? confirmBtn : rejectBtn;
    var orig = label.textContent; label.disabled = true; label.textContent = 'Saving…';
    await Promise.all(ids.map(function(id) {
      return fetch('/admin/season/signups/' + id + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }));
    location.reload();
  }
  if (confirmBtn) confirmBtn.addEventListener('click', function() { bulkAction('confirm'); });
  if (rejectBtn)  rejectBtn.addEventListener('click',  function() { bulkAction('reject'); });

  // Individual confirm/reject
  document.querySelectorAll('.signup-confirm-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
  document.querySelectorAll('.signup-reject-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
  document.querySelectorAll('.signup-withdraw-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      if (!confirm('Withdraw this player and free their confirmed spot? The earliest waitlisted signup will be promoted automatically. If this player has already been charged (season started), you\\'ll need to handle any refund/credit manually in the Ledger — this does not touch it.')) return;
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
        .then(function(res) {
          if (!res.ok) { alert(res.d.error || 'Could not withdraw.'); location.reload(); return; }
          location.reload();
        });
    });
  });
})();
</script>`;
}
