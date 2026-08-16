import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const SIGNUP_PILL = {
  waitlisted: `<span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">SIGNED UP &middot; WAITLISTED</span>`,
  confirmed:  `<span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">SIGNED UP &middot; CONFIRMED</span>`,
  rejected:   `<span style="background:#64748b22;color:#64748b;border:1px solid #64748b44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">SIGNED UP &middot; REJECTED</span>`,
  withdrawn:  `<span style="background:#f8717122;color:#f87171;border:1px solid #f8717144;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">SIGNED UP &middot; WITHDRAWN</span>`,
};
const NOT_SIGNED_UP_PILL = `<span style="background:#1e293b;color:#64748b;border:1px solid #1e293b;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">NOT SIGNED UP</span>`;
// Shown alongside a waitlisted/confirmed signup when the player asked for the shuffle instead
// of sticking with the prior team this row is grouped under — the case an admin building
// teams needs flagged, since it means this "returning" player isn't actually holding their
// old spot even though they did sign up.
const SHUFFLE_PILL = `<span style="background:#a78bfa22;color:#a78bfa;border:1px solid #a78bfa44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">WANTS SHUFFLE</span>`;

function wantsShuffle(p) {
  return !!p.signup
    && (p.signup.status === 'waitlisted' || p.signup.status === 'confirmed')
    && p.signup.team_pref === 'reshuffle';
}

// Row order within a team: not-signed-up first (that's where outreach is actually needed),
// then signed-up/sticking, then signed-up-but-wants-shuffle last (already spoken for elsewhere).
function rowPriority(p) {
  if (!p.signup) return 0;
  if (wantsShuffle(p)) return 2;
  return 1;
}

// players: [{ id, name, team_id, team_name, team_color, picture_url, signup: signupRowOrNull }]
// signup carries a status ('waitlisted'|'confirmed'|'rejected'|'withdrawn') and the admin
// signup detail id to link into — same season_signups rows the Waitlist page reads.
export function adminReturningBody({ prevSeason = '', sigSeason = '', players = [] } = {}) {
  const signedUpCount = players.filter(p => p.signup).length;
  const pct = players.length > 0 ? Math.round((signedUpCount / players.length) * 100) : 0;

  const groups = new Map();
  for (const p of players) {
    const key = p.team_id || 'none';
    if (!groups.has(key)) groups.set(key, { name: p.team_name || 'No Team', color: p.team_color || '#64748b', players: [] });
    groups.get(key).players.push(p);
  }
  // Teams with the most players still missing sort first — that's where an admin's outreach
  // effort is best spent, rather than reading alphabetically past teams that are done.
  const teamGroups = Array.from(groups.values()).sort((a, b) => {
    const missA = a.players.filter(p => !p.signup).length;
    const missB = b.players.filter(p => !p.signup).length;
    return missB - missA;
  });

  const row = (p) => {
    const name = displayPlayerName(p.name);
    const initials = escHtml((name || '?').charAt(0).toUpperCase());
    const avatar = p.picture_url
      ? `<img src="${escHtml(p.picture_url)}" alt="" class="w-8 h-8 rounded-full object-cover shrink-0" style="background:#1e293b">`
      : `<div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-slate-500" style="background:#1e293b">${initials}</div>`;

    const pills = `
      ${p.signup ? (SIGNUP_PILL[p.signup.status] ?? NOT_SIGNED_UP_PILL) : NOT_SIGNED_UP_PILL}
      ${wantsShuffle(p) ? SHUFFLE_PILL : ''}`;

    return `
  <div class="returning-row flex items-center gap-3 px-4 py-2.5 border-b border-admin-border/40 last:border-0" data-signed="${p.signup ? '1' : '0'}" data-name="${escHtml(name.toLowerCase())}">
    ${avatar}
    <div class="min-w-0 flex-1">
      <div class="text-[13px] font-semibold text-slate-200 truncate">${escHtml(name)}</div>
    </div>
    <div class="flex items-center gap-1.5">
      ${p.signup && p.signup.id ? `<a href="/admin/season/signups/${escHtml(p.signup.id)}" class="no-underline flex items-center gap-1.5">${pills}</a>` : pills}
    </div>
  </div>`;
  };

  const teamCard = (g) => {
    const missing = g.players.filter(p => !p.signup).length;
    return `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-4">
  <div class="px-4 py-2.5 border-b border-admin-border flex items-center gap-2">
    <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${escHtml(g.color)}"></span>
    <span class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${escHtml(g.name)}</span>
    <span class="text-[10px] text-slate-600 ml-auto">${g.players.length - missing}/${g.players.length} signed up</span>
  </div>
  <div>${g.players.slice().sort((a, b) => {
    const priorityDiff = rowPriority(a) - rowPriority(b);
    return priorityDiff !== 0 ? priorityDiff : displayPlayerName(a.name).localeCompare(displayPlayerName(b.name));
  }).map(row).join('')}</div>
</div>`;
  };

  const body = players.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500">No players found for Season ${escHtml(String(prevSeason))}.</div>`
    : teamGroups.map(teamCard).join('');

  return `
<div class="w-full" style="max-width:900px">
  <a href="/admin/season" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">&larr; Season Management</a>
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <h1 class="text-xl font-bold text-slate-100">Returning Players</h1>
      <p class="text-xs text-slate-500 mt-0.5">Season ${escHtml(String(prevSeason))} roster &middot; checked against Season ${escHtml(String(sigSeason))} signups</p>
    </div>
    <div class="text-right">
      <div class="text-xl font-bold text-slate-100">${signedUpCount}<span class="text-slate-500 font-normal text-sm"> / ${players.length}</span></div>
      <div class="text-[10px] text-slate-500 uppercase tracking-wider">Signed up &middot; ${pct}%</div>
    </div>
  </div>

  <div class="flex items-center gap-3 mb-4">
    <input id="returning-search" type="text" placeholder="Search player…" class="admin-input text-xs" style="max-width:220px">
    <select id="returning-filter" class="admin-input text-xs" style="font-size:11px;padding:3px 8px">
      <option value="">All</option>
      <option value="0">Not signed up</option>
      <option value="1">Signed up</option>
    </select>
  </div>

  ${body}
</div>

<script>
(function() {
  var search = document.getElementById('returning-search');
  var filter = document.getElementById('returning-filter');

  function apply() {
    var q = (search.value || '').toLowerCase().trim();
    var f = filter.value;
    document.querySelectorAll('.returning-row').forEach(function(row) {
      var matchesSearch = !q || row.dataset.name.indexOf(q) !== -1;
      var matchesFilter = !f || row.dataset.signed === f;
      row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
    });
  }
  if (search) search.addEventListener('input', apply);
  if (filter) filter.addEventListener('change', apply);
})();
</script>`;
}
