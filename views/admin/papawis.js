// Papawis admin: shared pricing helpers (also used by lib/papawis-notify.js for the reminder
// emails) and the Activity page, which hasn't been rebuilt yet. The runs list and the run
// page were rebuilt on views/admin/ui.js in the 2026-10 admin redesign: see
// views/admin/papawis-runs.js and views/admin/papawis-run.js.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;

function fmtLogTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const ACTIVITY_LABELS = {
  registered:    { label: 'registered', color: 'text-amber-400' },
  joined:        { label: 'joined',    color: 'text-emerald-400' },
  cancelled:     { label: 'cancelled', color: 'text-red-400' },
  promoted:      { label: 'moved to confirmed', color: 'text-emerald-400' },
  waitlisted:    { label: 'moved to waitlist',  color: 'text-amber-400' },
  viewed_roster: { label: 'viewed the player list', color: 'text-slate-400' },
  reminded:      { label: 'reminder emailed', color: 'text-sky-400' },
  cancel_notified: { label: 'notified of cancellation', color: 'text-red-400' },
  completion_notified: { label: 'sent payment receipt', color: 'text-sky-400' },
  announced:     { label: 'sent new-game announcement', color: 'text-sky-400' },
  slot_alerted:  { label: 'sent slot-opened alert', color: 'text-sky-400' },
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

// ── Detail / manage ───────────────────────────────────────────────────────────
// Last-resort fallback only, for when neither a court rate nor session hours are known at
// all (no court match, no start/end time) — everywhere else now prefers estimateTotal()
// below. 20 slots has historically settled on a flat ₱270/player rate; smaller turnouts scale
// off a fixed ₱4,200 court budget instead, rounded to the nearest ₱10.
export function defaultPapawisPrice(confirmedCount) {
  if (!confirmedCount) return null;
  if (confirmedCount === 20) return 270;
  return roundTo10(4200 / confirmedCount);
}

// The standing default whenever there's a referee — ₱/hr, same pricing shape as a court.
// Only ever a starting point in an (editable) input; nothing here charges anyone on its own.
export const REFEREE_RATE_DEFAULT = 500;

export function roundTo10(n) { return Math.round(n / 10) * 10; }

// "18:00" / "20:30" → 2.5. Null if either is missing or unparseable — the Hours field just
// starts blank in that case rather than guessing.
export function hoursBetween(start, end) {
  const parse = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const a = parse(start), b = parse(end);
  if (a === null || b === null || b <= a) return null;
  return Math.round(((b - a) / 60) * 4) / 4; // nearest quarter-hour
}

// Court cost + (optionally) referee cost, both ₱/hr × hours, rounded to the nearest ₱10.
// Null if there's not enough to compute from (no rate, or no hours).
export function estimateTotal({ rate, hours, hasReferee, refereeRate }) {
  if (!rate || !hours) return null;
  const court = rate * hours;
  const ref = hasReferee ? (refereeRate || REFEREE_RATE_DEFAULT) * hours : 0;
  return roundTo10(court + ref);
}

// Whether nothing has been explicitly set on this game yet (via "Save details" or "Confirm &
// charge") — while true, a referee is *assumed* present at the standing ₱500/hr default; once
// an admin has saved anything (even "no referee"), that saved choice is used as-is instead.
export function hasSavedPapawisAmount(game) { return game?.actual_total != null; }

// Used by the pre-game reminder/team-assigned emails (lib/papawis-notify.js) as well as the
// Manage page itself — same "court + referee, rounded to ₱10" default the panel shows,
// preferring whatever's actually been saved on the game. courtRateFallback is a fresh
// location→court rate lookup, used only when the game itself has no saved rate yet.
export function estimatedPapawisPrice(game, confirmedCount, courtRateFallback = null) {
  const saved = hasSavedPapawisAmount(game);
  const rate    = game?.court_rate_per_hour || courtRateFallback || null;
  const hours   = game?.session_hours || hoursBetween(game?.start_time, game?.end_time);
  const hasRef  = saved ? !!game?.has_referee : true;
  const refRate = game?.referee_rate_per_hour || REFEREE_RATE_DEFAULT;
  const total = estimateTotal({ rate, hours, hasReferee: hasRef, refereeRate: refRate });
  const raw = (total && confirmedCount) ? roundTo10(total / confirmedCount) : defaultPapawisPrice(confirmedCount);
  if (raw == null) return null;
  // Same override the admin's own live calculator applies (recalcCloseOut, in this page's own
  // script below) — a saved min_per_player should win here too, otherwise the pre-game
  // reminder email quotes a different number than what Close Out will actually charge.
  return game?.min_per_player ? roundTo10(game.min_per_player) : raw;
}

// ── Activity (global feed + frequent cancellers) ─────────────────────────────
export function adminPapawisActivityBody({ activity = [], cancellers = [], regulars = [] } = {}) {
  const cancellerRow = (c) => `<tr class="border-b border-admin-border/50 last:border-b-0">
      <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(c.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 font-saira text-right">${c.cancel_count}</td>
    </tr>`;

  const regularRow = (r) => `<tr class="border-b border-admin-border/50 last:border-b-0">
      <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(displayPlayerName(r.player_name))}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(r.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 font-saira text-right">${r.games_played}</td>
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

  <div class="flex flex-col gap-5">
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Regulars <span class="normal-case font-normal text-slate-600">— confirmed in 5+ of the last 10</span></div>
      <table class="w-full border-collapse">
        <tbody>
          ${regulars.length ? regulars.map(regularRow).join('') : '<tr><td class="px-4 py-8 text-center text-sm text-slate-500">No regulars yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Frequent Cancellers</div>
      <table class="w-full border-collapse">
        <tbody>
          ${cancellers.length ? cancellers.map(cancellerRow).join('') : '<tr><td class="px-4 py-8 text-center text-sm text-slate-500">No repeat cancellers yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

</div>`;
}
