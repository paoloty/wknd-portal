import { escHtml } from '../layout.js';
import { teamColor, displayPlayerName } from '../utils.js';

// ── /admin/mvp-podium — the "Call the podium" ballot (server.js GET /admin/mvp-podium) ────
// Totals, the tally (how many put each of the ten 1st / 2nd / 3rd), every ballot with its
// frozen bonus copy, who hasn't voted, and the one-off reminder (bell + optional email).
// Admin-only: the tally is the league's call and stays off the public pages until the reveal.

const kicker = 'text-[10px] font-bold uppercase tracking-widest text-slate-500';
const panel = 'bg-admin-surface border border-admin-border rounded-lg overflow-hidden';
const dot = team => `<span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${teamColor(team)};box-shadow:0 0 0 1px rgba(255,255,255,.15)"></span>`;
const when = ms => new Date(ms).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const nm = p => (p ? escHtml(displayPlayerName(p.name)) : '<span class="text-slate-600">—</span>');

function tile(label, value, sub = '') {
  return `<div class="${panel} px-4 py-3.5">
      <div class="${kicker} mb-1.5">${label}</div>
      <div class="text-2xl font-extrabold text-slate-100 leading-none" style="font-family:'Space Grotesk',sans-serif">${value}</div>
      ${sub ? `<div class="text-xs text-slate-500 mt-1.5">${sub}</div>` : ''}
    </div>`;
}

export function adminMvpPodiumBody({ season, locked, enabled, bonusAt, closeAt, bonusOpen, totals, tally, ballots, missing, podium = null, reminded = null, msg = '' }) {
  const status = !enabled ? '<b class="text-amber-400">The ballot is switched off</b> (Visibility → MVP podium ballot).'
    : locked ? `Race locked · bonus ${bonusOpen ? `closes <b class="text-slate-200">${escHtml(bonusAt || 'when the last regular-season games are scheduled')}</b>` : 'closed'} · ballots close ${escHtml(closeAt || 'at Finals Game 2')}`
    : 'Race revealed: ballots are scored.';
  const tallyRows = tally.length ? tally.map((t, i) => `<tr class="admin-table-row">
      <td class="admin-td text-slate-500">${i + 1}</td>
      <td class="admin-td"><a href="/admin/players/${encodeURIComponent(t.id)}" class="inline-flex items-center gap-2 text-slate-100 hover:text-amber-400">${dot(t.team)}${escHtml(displayPlayerName(t.name))}</a></td>
      ${t.votes.map((v, k) => `<td class="admin-td font-semibold ${v ? 'text-slate-100' : 'text-slate-600'}">${v}${v && totals.complete ? ` <span class="text-xs text-slate-500">${Math.round((v / totals.complete) * 100)}%</span>` : ''}</td>`).join('')}
      <td class="admin-td font-bold">${t.votes[0] + t.votes[1] + t.votes[2]}</td>
      ${podium ? `<td class="admin-td">${t.place ? `<b class="text-amber-400">#${t.place}</b>` : ''}</td>` : ''}
    </tr>`).join('') : `<tr><td class="admin-td text-slate-500" colspan="6">No ballots yet.</td></tr>`;
  const ballotRows = ballots.length ? ballots.map(b => `<tr class="admin-table-row">
      <td class="admin-td"><a href="/admin/players/${encodeURIComponent(b.voter.id)}" class="inline-flex items-center gap-2 text-slate-100 hover:text-amber-400">${dot(b.voter.team)}${escHtml(displayPlayerName(b.voter.name))}</a>${b.admin ? ' <span class="text-[10px] font-bold text-amber-400" title="Admins can see the MVP scores, so they never earn the bonus">ADMIN</span>' : ''}</td>
      ${b.picks.map(p => `<td class="admin-td">${nm(p)}</td>`).join('')}
      <td class="admin-td text-xs text-slate-400 whitespace-nowrap">${escHtml(when(b.updatedAt))}</td>
      <td class="admin-td text-xs">${!b.bonus ? '<span class="text-slate-600">none (after the cut-off)</span>' : b.bonusSame ? '<span class="text-slate-400">same</span>' : `<span class="text-amber-400" title="The ballot changed after the cut-off; the bonus uses this one">${b.bonus.map(p => (p ? escHtml(displayPlayerName(p.name).split(' ').pop()) : '—')).join(' · ')}</span>`}</td>
      ${podium ? `<td class="admin-td font-bold">${b.points == null ? '<span class="text-slate-600">—</span>' : `+${b.points}`}</td>` : ''}
    </tr>`).join('') : `<tr><td class="admin-td text-slate-500" colspan="7">No ballots yet.</td></tr>`;
  return `
<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">MVP podium · Season ${escHtml(String(season))}</h2>
    <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">${status}</p>
  </div>
  <div class="flex items-center gap-2">
    <a href="/admin/visibility" class="admin-btn admin-btn--sm">Settings</a>
    <a href="/mvp" class="admin-btn admin-btn--sm" target="_blank" rel="noopener">View /mvp ↗</a>
  </div>
</div>
${msg ? `<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">${escHtml(msg)}</div>` : ''}
<div class="grid gap-3 mb-6" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
  ${tile('Ballots', totals.complete, `${totals.partial} more started, not finished`)}
  ${tile('In for the bonus', totals.bonus, 'complete ballots frozen at the cut-off')}
  ${tile('Haven’t voted', missing.count, `${missing.reachable} reachable · ${missing.emailable} by email`)}
  ${tile('Closed the bar', totals.dismissed, 'hid the site-wide bar for good')}
  ${podium ? tile('Perfect podiums', totals.perfect, 'all three, in order') : ''}
</div>
${podium ? `<div class="${panel} px-4 py-3 mb-6 text-sm text-slate-300"><span class="${kicker} mr-2">Official podium</span>${podium.map((p, i) => `<b class="text-slate-100">${i + 1}. ${nm(p)}</b>`).join(' · ')}</div>` : ''}
<h3 class="${kicker} mb-2">Who voted who</h3>
<div class="${panel} overflow-auto mb-6">
  <table class="admin-table">
    <thead><tr><th class="admin-th">#</th><th class="admin-th">Player</th><th class="admin-th">Votes for 1st</th><th class="admin-th">2nd</th><th class="admin-th">3rd</th><th class="admin-th">Total</th>${podium ? '<th class="admin-th">Finished</th>' : ''}</tr></thead>
    <tbody>${tallyRows}</tbody>
  </table>
</div>
<h3 class="${kicker} mb-2">Every ballot</h3>
<div class="${panel} overflow-auto mb-6">
  <table class="admin-table">
    <thead><tr><th class="admin-th">Voter</th><th class="admin-th">1st</th><th class="admin-th">2nd</th><th class="admin-th">3rd</th><th class="admin-th">Last change</th><th class="admin-th" title="The copy frozen at the bonus cut-off">Bonus ballot</th>${podium ? '<th class="admin-th">Bonus</th>' : ''}</tr></thead>
    <tbody>${ballotRows}</tbody>
  </table>
</div>
${locked && enabled ? `<h3 class="${kicker} mb-2">Haven’t voted</h3>
<div class="${panel} p-4 mb-6">
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div class="text-sm text-slate-300 min-w-0 max-w-3xl">
      <b class="text-slate-100">${missing.count}</b> active player${missing.count === 1 ? '' : 's'} without a complete ballot${missing.names.length ? `: <span class="text-slate-400">${missing.names.map(escHtml).join(', ')}</span>` : ''}
      ${reminded ? `<span class="block mt-1 text-amber-400">Reminder sent ${escHtml(when(reminded.at))}: ${reminded.bell} bell${reminded.email != null ? `, ${reminded.email} email${reminded.email === 1 ? '' : 's'}` : ''}</span>` : ''}
    </div>
    <form method="post" action="/admin/mvp-podium/remind" class="inline-flex items-center gap-2 shrink-0" onsubmit="return confirm(${escHtml(JSON.stringify(reminded ? 'A reminder already went out. Send another?' : 'Send the podium reminder now?'))})">
      <label class="inline-flex items-center gap-1.5 text-xs text-slate-300" title="Same rules as pick reminders: unsubscribed, bounced or shared inboxes get the bell only">
        <input type="checkbox" name="email" value="1"${missing.emailable ? ' checked' : ' disabled'}> Also email ${missing.emailable}
      </label>
      <button type="submit" class="admin-btn admin-btn--sm admin-btn--success"${missing.reachable ? '' : ' disabled'}>${reminded ? 'Remind again' : 'Send reminder'}</button>
    </form>
  </div>
</div>` : ''}`;
}
