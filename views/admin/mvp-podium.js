import { escHtml } from '../layout.js';
import { teamColor, displayPlayerName } from '../utils.js';

// ── /admin/awards/podium — the "Call the podium" ballot (server.js GET /admin/awards/podium) ──
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
  const status = !enabled ? '<b class="text-amber-400">The ballot is switched off</b> (Ballot settings above).'
    : locked ? `Race locked · bonus ${bonusOpen ? `closes <b class="text-slate-200">${escHtml(bonusAt || 'when the last regular-season games are scheduled')}</b>` : 'closed'} · ballots close ${escHtml(closeAt || 'at Finals Game 2')}`
    : 'Race revealed: ballots are scored.';
  // Fan rank by points (3 for a 1st-place vote, 2 for 2nd, 1 for 3rd; server.js), T for ties.
  // showActual (super admin only): the real rank and MVP score beside it, ordered by real rank.
  const showActual = tally.some(t => t.actual);
  const actualCells = t => (showActual ? `<td class="admin-td font-bold ${t.actual?.rank <= 3 ? 'text-amber-400' : 'text-slate-300'}">${t.actual ? `#${t.actual.rank}` : '—'}</td>
      <td class="admin-td text-slate-400" style="font-family:'Space Grotesk',sans-serif">${t.actual ? t.actual.score.toFixed(1) : '—'}</td>` : '');
  const tallyRows = tally.length ? tally.map(t => `<tr class="admin-table-row">
      ${actualCells(t)}
      <td class="admin-td font-bold ${t.rank === 1 ? 'text-amber-400' : 'text-slate-400'}">${t.rank ? `${t.tied ? 'T' : ''}${t.rank}` : '<span class="text-slate-600">—</span>'}</td>
      <td class="admin-td"><a href="/admin/players/${encodeURIComponent(t.id)}" class="inline-flex items-center gap-2 text-slate-100 hover:text-amber-400">${dot(t.team)}${escHtml(displayPlayerName(t.name))}</a></td>
      <td class="admin-td font-extrabold text-slate-100" style="font-family:'Space Grotesk',sans-serif">${t.pts}</td>
      ${t.votes.map(v => `<td class="admin-td font-semibold ${v ? 'text-slate-100' : 'text-slate-600'}">${v}${v && totals.complete ? ` <span class="text-xs text-slate-500">${Math.round((v / totals.complete) * 100)}%</span>` : ''}</td>`).join('')}
      ${podium ? `<td class="admin-td">${t.place ? `<b class="text-amber-400">#${t.place}</b>` : ''}</td>` : ''}
    </tr>`).join('') : `<tr><td class="admin-td text-slate-500" colspan="7">No ballots yet.</td></tr>`;
  const ballotRows = ballots.length ? ballots.map(b => `<tr class="admin-table-row">
      <td class="admin-td"><a href="/admin/players/${encodeURIComponent(b.voter.id)}" class="inline-flex items-center gap-2 text-slate-100 hover:text-amber-400">${dot(b.voter.team)}${escHtml(displayPlayerName(b.voter.name))}</a></td>
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
<h3 class="${kicker} mb-2">Who voted who <span class="normal-case tracking-normal font-normal text-slate-600">· ranked by points: 3 per 1st-place vote, 2 per 2nd, 1 per 3rd</span></h3>
<div class="${panel} overflow-auto mb-6">
  <table class="admin-table">
    <thead><tr>${showActual ? '<th class="admin-th" title="Real rank by the MVP score (super admin only)">Actual #</th><th class="admin-th">MVP score</th>' : ''}<th class="admin-th" title="Fan rank by points">Fan #</th><th class="admin-th">Player</th><th class="admin-th" title="3 per 1st-place vote, 2 per 2nd, 1 per 3rd">Points</th><th class="admin-th">1st votes</th><th class="admin-th">2nd</th><th class="admin-th">3rd</th>${podium ? '<th class="admin-th">Finished</th>' : ''}</tr></thead>
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
      <b class="text-slate-100">${missing.count}</b> active player${missing.count === 1 ? '' : 's'} without a complete ballot${missing.names.length && !reminded ? `: <span class="text-slate-400">${missing.names.map(escHtml).join(', ')}</span>` : ''}
      ${reminded ? `<span class="block mt-1 text-amber-400">Reminder sent ${escHtml(when(reminded.at))}: ${reminded.bell} bell${reminded.bell === 1 ? '' : 's'}${reminded.email != null ? `, ${reminded.email} email${reminded.email === 1 ? '' : 's'}` : ''}${reminded.resent ? ` · resent to ${reminded.resent.count} ${escHtml(when(reminded.resent.at))}` : ''}</span>` : ''}
      ${reminded ? [
        ['Missed the email', missing.resend, 'text-slate-100'],
        ['Already emailed', missing.emailed, 'text-slate-500'],
        ['Bell only (unsubscribed, bounced or shared inbox)', missing.bellOnly, 'text-slate-500'],
      ].filter(([, list]) => list.length).map(([label, list, tone]) => `<span class="block mt-1.5 text-xs"><b class="text-slate-400">${label} (${list.length}):</b> <span class="${tone}">${list.map(escHtml).join(', ')}</span></span>`).join('') : ''}
    </div>
    ${reminded ? `<form method="post" action="/admin/awards/podium/remind" class="shrink-0" onsubmit="return confirm(${escHtml(JSON.stringify(`Resend the bell and email to the ${missing.resend.length} who missed the email?`))})">
      <button type="submit" class="admin-btn admin-btn--sm admin-btn--success" title="Only players who haven’t voted and have no podium email on record"${missing.resend.length ? '' : ' disabled'}>Resend to ${missing.resend.length}</button>
    </form>` : `<form method="post" action="/admin/awards/podium/remind" class="inline-flex items-center gap-2 shrink-0" onsubmit="return confirm('Send the podium reminder now?')">
      <label class="inline-flex items-center gap-1.5 text-xs text-slate-300" title="Same rules as pick reminders: unsubscribed, bounced or shared inboxes get the bell only">
        <input type="checkbox" name="email" value="1"${missing.emailable ? ' checked' : ' disabled'}> Also email ${missing.emailable}
      </label>
      <button type="submit" class="admin-btn admin-btn--sm admin-btn--success"${missing.reachable ? '' : ' disabled'}>Send reminder</button>
    </form>`}
  </div>
</div>` : ''}`;
}
