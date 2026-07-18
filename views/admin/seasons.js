import { escHtml } from '../layout.js';

export function adminSeasonsBody({ rows = [], currentSeason = null, signupSeason = '', signupOpen = false } = {}) {
  const currentNum = currentSeason ? String(currentSeason) : null;

  const badge = (label, color) =>
    `<span style="background:${color}1a;color:${color};border:1px solid ${color}33;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">${label}</span>`;

  const tableRows = rows.map(r => {
    const isActive  = currentNum && String(r.season) === currentNum;
    const isSignup  = String(r.season) === String(signupSeason);
    const quota     = r.quota_amount ? `₱${Number(r.quota_amount).toLocaleString()}` : '—';
    const signupTxt = r.signup_total
      ? `${r.signup_confirmed}/${r.signup_total}`
      : '—';

    const badges = [
      isActive  ? badge('Current', '#f59332') : '',
      isSignup && signupOpen  ? badge('Signup Open', '#22c55e') : '',
      isSignup && !signupOpen && signupSeason ? badge('Signup Setup', '#3b82f6') : '',
    ].filter(Boolean).join(' ');

    return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.02] transition-colors">
      <td class="px-5 py-3.5">
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-bold text-slate-100">Season ${escHtml(String(r.season))}</span>
          ${badges}
        </div>
      </td>
      <td class="px-4 py-3.5 text-center">
        <span class="text-sm font-semibold text-slate-200">${r.regular_games ?? 0}</span>
        ${r.scheduled_games ? `<span class="text-[10px] text-slate-500 block">+${r.scheduled_games} sched</span>` : ''}
      </td>
      <td class="px-4 py-3.5 text-center">
        <span class="text-sm font-semibold ${r.playoff_games ? 'text-slate-200' : 'text-slate-600'}">${r.playoff_games ?? 0}</span>
      </td>
      <td class="px-4 py-3.5 text-center">
        <span class="text-sm ${r.quota_amount ? 'text-amber-400 font-semibold' : 'text-slate-600'}">${escHtml(quota)}</span>
      </td>
      <td class="px-4 py-3.5 text-center">
        ${r.signup_total ? `
          <span class="text-sm font-semibold text-slate-200">${r.signup_confirmed}</span>
          <span class="text-slate-500 text-xs"> / ${r.signup_total}</span>
          <div class="text-[10px] text-slate-500 mt-0.5">confirmed</div>
        ` : `<span class="text-slate-600 text-sm">—</span>`}
      </td>
      <td class="px-4 py-3.5 text-right">
        <div class="flex items-center justify-end gap-3">
          <a href="/?season=${escHtml(String(r.season))}" target="_blank" rel="noopener"
            class="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors no-underline">
            View ↗
          </a>
          ${isSignup ? `<a href="/admin/season" class="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors no-underline">Manage →</a>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  const emptyState = `<tr><td colspan="6" class="px-5 py-12 text-center text-sm text-slate-500">No seasons found. Seasons are created when games are recorded in the system.</td></tr>`;

  return `
<div style="max-width:860px">
  <div class="flex items-center justify-between mb-6 gap-4">
    <h1 class="text-xl font-bold text-slate-100">Seasons</h1>
    <span class="text-xs text-slate-500">${rows.length} season${rows.length !== 1 ? 's' : ''}</span>
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-admin-border text-slate-500 text-[10px] uppercase tracking-wider">
            <th class="px-5 py-3 text-left font-semibold">Season</th>
            <th class="px-4 py-3 text-center font-semibold">Regular</th>
            <th class="px-4 py-3 text-center font-semibold">Playoffs</th>
            <th class="px-4 py-3 text-center font-semibold">Fee</th>
            <th class="px-4 py-3 text-center font-semibold">Signups</th>
            <th class="px-4 py-3 text-right font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? tableRows : emptyState}
        </tbody>
      </table>
    </div>
  </div>

  <p class="text-xs text-slate-600 mt-4 leading-relaxed">
    Seasons are derived from game data. Set fees on <a href="/admin/site" class="text-slate-500 hover:text-slate-300">Site Settings</a>. Manage the active signup season on <a href="/admin/season" class="text-slate-500 hover:text-slate-300">Season Management</a>.
  </p>
</div>`;
}
