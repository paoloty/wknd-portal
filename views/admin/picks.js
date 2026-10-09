import { escHtml } from '../layout.js';
import { teamColor } from '../utils.js';

// ── /admin/picks — every "Who wins?" pick in one place ────────────────────────────────
// Data from server.js (GET /admin/picks). Up next: per-game controls (the same
// POST /admin/games/:id/picks the game page uses), who picked each side, and who hasn't
// picked yet with a one-click in-app reminder. Then the season's results and pickers.

const tc = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
const dot = name => `<span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${teamColor(name)};box-shadow:0 0 0 1px rgba(255,255,255,.15)"></span>`;
const day = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const shortDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '');
const when = ms => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
const kicker = 'text-[10px] font-bold uppercase tracking-widest text-slate-500';
const panel = 'bg-admin-surface border border-admin-border rounded-lg overflow-hidden';
const YES = '<span class="text-amber-400 font-bold">✓</span>';
const NO = '<span class="text-slate-500 font-bold">✕</span>';

function face(p) {
  const ini = String(p.name || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<a href="/admin/players/${encodeURIComponent(p.id)}" title="${escHtml(p.name)}" class="relative inline-grid place-items-center w-6 h-6 rounded-full overflow-hidden bg-slate-800 text-[9px] font-bold text-slate-300 -ml-1.5 first:ml-0" style="box-shadow:0 0 0 2px #0f172a,0 0 0 3px ${teamColor(p.team)}">
    <span>${escHtml(ini)}</span><img src="/api/player/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" onerror="this.remove()" class="absolute inset-0 w-full h-full object-cover" style="object-position:center 20%">
  </a>`;
}
const faces = (list, max = 8) => `<span class="inline-flex items-center pl-1.5">${list.slice(0, max).map(face).join('')}</span>${list.length > max ? `<span class="text-xs text-slate-500 ml-1.5">+${list.length - max}</span>` : ''}`;

function kpis(k) {
  const tile = (label, value, sub) => `<div class="${panel} px-4 py-3.5">
      <div class="${kicker} mb-1.5">${label}</div>
      <div class="text-2xl font-extrabold text-slate-100 leading-none" style="font-family:'Space Grotesk',sans-serif">${value}</div>
      <div class="text-xs text-slate-500 mt-1.5">${sub}</div>
    </div>`;
  const rec = r => (r.of ? `${r.called} of ${r.of}` : '—');
  return `<div class="grid gap-3 mb-6" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
    ${tile('Picks', String(k.picks), `this season · ${k.pickers} pickers`)}
    ${tile('Reach', k.accounts ? `${Math.round((k.pickers / k.accounts) * 100)}%` : '—', `of ${k.accounts} players with an account`)}
    ${tile('Fans called', rec(k.callers.fans), 'games with picks · majority won')}
    ${k.oddsOn ? tile('Odds called', rec(k.oddsRecord), `every finished game · ${k.upsets} upset${k.upsets === 1 ? '' : 's'}`) : ''}
    ${tile('Pickmaster leader', k.leader ? escHtml(k.leader.name) : '—', k.leader ? `${k.leader.correct} of ${k.leader.picks} · min ${k.minPicks} picks` : `Ranks start at ${k.minPicks} settled picks`)}
  </div>`;
}

function upNextCard(u) {
  const side = s => {
    const list = u.picks.filter(p => p.side === s);
    const team = s === 'a' ? u.a : u.b;
    return `<div>
      <div class="flex items-center gap-2 text-xs font-bold text-slate-200 mb-1.5">${dot(team)}${escHtml(team)} <span class="text-slate-500">${list.length}</span></div>
      ${list.length ? `<ul class="text-xs text-slate-400 space-y-1" data-pick-list>${list.map((p, i) => `<li class="flex justify-between gap-2${i >= 6 ? ' hidden' : ''}" ${i >= 6 ? 'data-more-row' : ''}>
          <span class="truncate">${escHtml(p.name)}${p.ownTeamAgainst ? ' <span class="text-[9px] font-bold uppercase tracking-wider text-orange-300/80" title="Picked against their own team">vs own team</span>' : ''}</span>
          <span class="text-slate-600 whitespace-nowrap">${escHtml(when(p.at))}</span>
        </li>`).join('')}</ul>${list.length > 6 ? `<button type="button" class="text-xs text-amber-400 font-semibold mt-1" data-show-more>+${list.length - 6} more</button>` : ''}` : '<p class="text-xs text-slate-600">No picks</p>'}
    </div>`;
  };
  const total = u.counts.a + u.counts.b;
  const fanA = total ? Math.round((u.counts.a / total) * 100) : 50;
  const o = u.odds;
  const bar = (pctA, color) => `<div class="flex h-1.5 rounded overflow-hidden bg-slate-800"><span style="width:${pctA}%;background:${color}"></span></div>`;
  const fanFav = total && u.counts.a !== u.counts.b ? (u.counts.a > u.counts.b ? 'a' : 'b') : null;
  const disagree = o?.fav && fanFav && o.fav !== fanFav;
  const id = escHtml(u.id);
  return `<div class="${panel}" data-up="${id}">
    <div class="px-4 py-3 border-b border-admin-border flex items-center justify-between gap-3">
      <a href="/admin/games/${encodeURIComponent(u.id)}" class="flex items-center gap-2 text-sm font-extrabold text-slate-100 hover:text-amber-400">${dot(u.a)}${escHtml(u.a)} <span class="text-slate-500 font-semibold text-xs">vs</span> ${escHtml(u.b)}${dot(u.b)}</a>
      ${u.closed ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Closed</span>' : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Open</span>'}
    </div>
    <div class="p-4 space-y-3">
      <div class="space-y-1.5 text-xs text-slate-400">
        ${o ? `<div class="flex justify-between"><span>Odds</span><span>${escHtml(tc(u.a))} <b class="text-slate-200">${o.pctA}%</b> · <b class="text-slate-200">${o.pctB}%</b> ${escHtml(tc(u.b))}${u.hideOdds ? ' <span class="text-amber-400">(hidden on site)</span>' : ''}</span></div>${bar(o.pctA, '#64748b')}` : '<div>No odds yet (a team has no games this season)</div>'}
        <div class="flex justify-between pt-1"><span>Fans · ${total}</span><span>${escHtml(tc(u.a))} <b class="text-slate-200">${fanA}%</b> · <b class="text-slate-200">${100 - fanA}%</b> ${escHtml(tc(u.b))}</span></div>${bar(fanA, '#f59332')}
        ${disagree ? `<div class="text-amber-400 pt-1">Fans vs odds: fans lean ${escHtml(tc(fanFav === 'a' ? u.a : u.b))}, the odds like ${escHtml(tc(o.fav === 'a' ? u.a : u.b))}</div>` : ''}
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <select class="admin-input" style="height:32px;width:auto" data-pick-closed="${id}" aria-label="Pick window">
          <option value="auto"${u.override === 'auto' ? ' selected' : ''}>Automatic (cut-off ${escHtml(u.closeTime)})</option>
          <option value="closed"${u.override === 'closed' ? ' selected' : ''}>Closed now</option>
          <option value="open"${u.override === 'open' ? ' selected' : ''}>Keep open (ignore cut-off)</option>
        </select>
        <label class="flex items-center gap-1.5"><input type="checkbox" data-pick-hide="${id}"${u.hideOdds ? ' checked' : ''}> Hide odds</label>
        <span class="text-xs" data-pick-msg="${id}"></span>
      </div>
      <div class="grid grid-cols-2 gap-4">${side('a')}${side('b')}</div>
    </div>
  </div>`;
}

// Who-to-remind checklist: every reachable player starts ticked; untick to leave someone
// out, or "None" then tick a few to remind just them. Unreachable players are listed but
// can't be ticked. The boxes belong to the reminder form via form="picks-remind".
function remindChecklist(people) {
  const tag = { email: '', bell: '<span class="text-slate-500">bell only</span>', skip: '<span class="text-slate-600">can\'t reach</span>' };
  return `<details class="mt-2" data-remind-pick>
      <summary class="cursor-pointer text-amber-400 font-semibold select-none">Choose players · <span data-sel-count></span></summary>
      <div class="flex gap-3 mt-2 mb-1.5">
        <button type="button" class="text-amber-400 font-semibold" data-sel="all">All</button>
        <button type="button" class="text-amber-400 font-semibold" data-sel="none">None</button>
        <button type="button" class="text-amber-400 font-semibold" data-sel="email">Only emailable</button>
      </div>
      <div class="grid gap-x-4 gap-y-1" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
        ${people.map(p => `<label class="flex items-center gap-1.5 min-w-0${p.reach === 'skip' ? ' opacity-50' : ''}" title="${escHtml(p.note)}">
          <input type="checkbox" form="picks-remind" name="ids" value="${escHtml(p.id)}" data-reach="${p.reach}"${p.reach === 'skip' ? ' disabled' : ' checked'}>
          <span class="truncate text-slate-300">${escHtml(p.name)}</span> ${tag[p.reach]}
        </label>`).join('')}
      </div>
    </details>`;
}

function missingBar(m) {
  if (!m) return '';
  if (!m.list.length) return `<div class="px-4 py-3 border-t border-admin-border text-xs text-emerald-400">Every player with an account has picked. 🎯</div>`;
  const shown = m.list.slice(0, 12);
  return `<div class="px-4 py-3 border-t border-admin-border flex flex-wrap items-center justify-between gap-3">
    <div class="text-xs text-slate-400 min-w-0 flex-1">
      <b class="text-slate-200">${m.list.length} of ${m.accounts} players with an account haven't picked ${m.games > 1 ? 'every game' : 'yet'}</b>
      <span class="block mt-1">${shown.map(p => escHtml(p.name)).join(', ')}${m.list.length > shown.length ? ` <span class="text-slate-500">+${m.list.length - shown.length} more</span>` : ''}</span>
      ${remindChecklist(m.people || [])}
      ${m.noValidEmail ? `<span class="block mt-1 text-slate-500">${m.noValidEmail} skipped, no valid email on their account</span>` : ''}
      ${m.dormant ? `<span class="block mt-1 text-slate-500">${m.dormant} skipped, account inactive (no login in 3+ months or setup link expired)</span>` : ''}
      ${m.alreadyEmailed ? `<span class="block mt-1 text-slate-500">${m.alreadyEmailed} already emailed for this game day, left off the list</span>` : ''}
      ${m.remindedAt ? `<span class="block mt-1 text-amber-400">Reminder sent ${escHtml(when(m.remindedAt))} to ${m.remindedCount} player${m.remindedCount === 1 ? '' : 's'}</span>` : ''}
      ${m.emailed ? `<span class="block mt-1 text-amber-400">Email sent ${escHtml(when(m.emailed.at))} to ${m.emailed.sent} of ${m.emailed.of}${m.emailed.failed ? ` · <b class="text-red-400">${m.emailed.failed} failed</b>` : ''} · ${m.emailed.source === 'ai' ? 'AI copy' : 'template copy'}</span>` : ''}
    </div>
    <div class="flex flex-wrap items-center gap-2 shrink-0">
      <button type="button" class="admin-btn admin-btn--sm" data-copy-names="${escHtml(m.list.map(p => p.name).join(', '))}">Copy names</button>
      <a href="/admin/picks/email/preview" class="admin-btn admin-btn--sm" title="See the AI-written email, rewrite it, or send yourself a test">Preview email</a>
      <form method="post" action="/admin/picks/remind" id="picks-remind" class="inline-flex items-center gap-2" data-reminded="${m.remindedAt ? 1 : ''}">
        <label class="inline-flex items-center gap-1.5 text-xs text-slate-300" title="Players who unsubscribed, reported spam or share an inbox get the bell only">
          <input type="checkbox" name="email" value="1"${m.emailable ? ' checked' : ' disabled'}> Also email <span data-email-count>${m.emailable}</span> of them
        </label>
        <button type="submit" class="admin-btn admin-btn--sm admin-btn--success"${m.reachable ? '' : ' disabled'} data-remind-submit>${m.remindedAt ? 'Remind again' : 'Send reminder'}</button>
      </form>
    </div>
  </div>`;
}

function resultsTable(rows, oddsOn) {
  if (!rows.length) return `<div class="${panel} p-8 text-center text-sm text-slate-500 mb-6">No finished games this season yet.</div>`;
  const body = rows.map((r, i) => {
    const winner = r.winner === 'a' ? r.a : r.b, loser = r.winner === 'a' ? r.b : r.a;
    const ws = Math.max(r.sa, r.sb), ls = Math.min(r.sa, r.sb);
    const oddsCell = !oddsOn ? '' : r.odds?.fav
      ? `<td class="admin-td">${escHtml(tc(r.odds.fav === 'a' ? r.a : r.b))} ${r.odds.fav === 'a' ? r.odds.pctA : r.odds.pctB}% ${r.odds.fav === r.winner ? YES : NO}</td>`
      : '<td class="admin-td text-slate-600">—</td>';
    const has = r.total > 0;
    return `<tr class="admin-table-row${has ? ' cursor-pointer' : ''}" ${has ? `data-expand="${i}" tabindex="0" aria-expanded="false"` : ''}>
      <td class="admin-td text-slate-500 font-semibold whitespace-nowrap">${escHtml(shortDay(r.ymd))}</td>
      <td class="admin-td whitespace-nowrap"><span class="inline-flex items-center gap-1.5">${dot(winner)}<b class="text-slate-100">${escHtml(tc(winner))} ${ws}</b></span> <span class="text-slate-500">– ${ls} ${escHtml(tc(loser))}</span>${r.upset ? ' <span class="ml-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-slate-900">Upset</span>' : ''}</td>
      ${oddsCell}
      <td class="admin-td">${has ? r.total : '<span class="text-slate-600">—</span>'}</td>
      <td class="admin-td">${has ? `${r.pctWinner}% ${escHtml(tc(winner))} ${r.pctWinner === 50 ? '' : r.fansCalled ? YES : NO}` : '<span class="text-slate-600">No picks</span>'}</td>
      <td class="admin-td">${has ? `${r.called.length} of ${r.total}` : ''}</td>
      <td class="admin-td">${has ? (r.settledAt ? `<span class="text-emerald-400">Sent</span>` : '<span class="text-amber-400">Not yet</span>') : ''}</td>
    </tr>
    ${has ? `<tr class="hidden" data-expanded="${i}"><td></td><td colspan="${oddsOn ? 6 : 5}" class="admin-td">
      <div class="flex flex-wrap items-center gap-x-8 gap-y-2 py-1">
        <span class="flex items-center gap-2"><span class="${kicker} !text-amber-400">Called it · ${r.called.length}</span>${r.called.length ? faces(r.called) : '<span class="text-xs text-slate-600">Nobody</span>'}</span>
        <span class="flex items-center gap-2"><span class="${kicker}">Missed · ${r.missed.length}</span>${r.missed.length ? faces(r.missed) : '<span class="text-xs text-slate-600">Nobody</span>'}</span>
        <a href="/admin/games/${encodeURIComponent(r.id)}" class="text-xs text-amber-400 font-semibold ml-auto">Open game →</a>
      </div>
    </td></tr>` : ''}`;
  }).join('');
  return `<div class="${panel} overflow-auto mb-6">
    <table class="admin-table">
      <thead><tr><th class="admin-th">Date</th><th class="admin-th">Final</th>${oddsOn ? '<th class="admin-th">Odds had</th>' : ''}<th class="admin-th">Picks</th><th class="admin-th">Fans</th><th class="admin-th">Called it</th><th class="admin-th">Results sent</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function pickersTable(rows, minPicks) {
  if (!rows.length) return `<div class="${panel} p-8 text-center text-sm text-slate-500">Nobody has picked this season yet.</div>`;
  const body = rows.map(r => `<tr class="admin-table-row">
      <td class="admin-td font-bold ${r.rank === 1 ? 'text-amber-400' : 'text-slate-400'}">${r.rank || '<span class="text-slate-600">—</span>'}</td>
      <td class="admin-td"><a href="/admin/players/${encodeURIComponent(r.id)}" class="inline-flex items-center gap-2 text-slate-100 hover:text-amber-400">${dot(r.team)}${escHtml(r.name)}</a></td>
      <td class="admin-td">${r.picks}</td>
      <td class="admin-td">${r.correct}</td>
      <td class="admin-td">${r.settled ? `${r.pct}%` : '<span class="text-slate-600">—</span>'}</td>
      <td class="admin-td">${r.streak >= 2 ? `<span class="text-amber-400 font-semibold">${r.streak} in a row</span>` : '<span class="text-slate-600">—</span>'}</td>
      <td class="admin-td">${r.upsets || '<span class="text-slate-600">0</span>'}</td>
      <td class="admin-td whitespace-nowrap">${r.last ? `${escHtml(shortDay(r.last.ymd))} · ${escHtml(tc(r.last.team))}` : ''}${r.missingNext ? ' <span class="text-amber-400">· no pick yet this week</span>' : ''}</td>
      <td class="admin-td text-xs ${r.rank ? 'text-slate-400' : 'text-slate-500'}">${r.rank ? 'Ranked' : `${Math.max(0, minPicks - r.settled)} more to rank`}</td>
    </tr>`).join('');
  return `<div class="${panel} overflow-auto">
    <table class="admin-table">
      <thead><tr><th class="admin-th">#</th><th class="admin-th">Player</th><th class="admin-th">Picks</th><th class="admin-th">Called</th><th class="admin-th">%</th><th class="admin-th">Streak</th><th class="admin-th">Upsets</th><th class="admin-th">Last pick</th><th class="admin-th">Status</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

export function adminPicksBody({ season, seasons, isCurrent, kpi, upNext, upDay, missing, results, pickers, minPicks, oddsOn, picksOn, msg = '' }) {
  const seasonSel = seasons.length > 1 ? `<select class="admin-input" style="height:34px;width:auto" aria-label="Season" onchange="location.href='/admin/picks?season='+encodeURIComponent(this.value)">${seasons.map(s => `<option value="${escHtml(s)}"${s === season ? ' selected' : ''}>Season ${escHtml(s)}</option>`).join('')}</select>` : '';
  return `
<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Who wins? picks</h2>
    <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Every game's picks in one place: open and close picks, see who picked what, nudge players who haven't picked, and follow the Pickmaster race.${picksOn ? '' : ' <b class="text-amber-400">Picks are switched off on the site right now.</b>'}</p>
  </div>
  <div class="flex items-center gap-2">
    ${seasonSel}
    <a href="/admin/visibility" class="admin-btn admin-btn--sm">Settings</a>
    <a href="/admin/awards" class="admin-btn admin-btn--sm">Pickmaster award</a>
    <a href="/picks" class="admin-btn admin-btn--sm" target="_blank" rel="noopener">View /picks ↗</a>
  </div>
</div>
${msg ? `<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">${escHtml(msg)}</div>` : ''}
${kpis(kpi)}
${isCurrent ? `<h3 class="${kicker} mb-2">Up next${upDay ? ` · ${escHtml(day(upDay))}` : ''}</h3>
${upNext.length ? `<div class="${panel} mb-6">
  <div class="grid gap-3 p-3" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">${upNext.map(upNextCard).join('')}</div>
  ${missingBar(missing)}
</div>` : `<div class="${panel} p-6 text-sm text-slate-500 mb-6">No games scheduled in the next two weeks. Picks open as soon as a game is scheduled.</div>`}` : ''}
<h3 class="${kicker} mb-2">Season ${escHtml(season)} results <span class="normal-case tracking-normal font-normal text-slate-600">· click a row for who called it and who missed</span></h3>
${resultsTable(results, oddsOn)}
<h3 class="${kicker} mb-2">Pickers · Season ${escHtml(season)}</h3>
${pickersTable(pickers, minPicks)}
<script>
(function () {
  function save(id, body) {
    var msg = document.querySelector('[data-pick-msg="' + id + '"]');
    msg.textContent = 'Saving…'; msg.style.color = '#64748b';
    fetch('/admin/games/' + encodeURIComponent(id) + '/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(); msg.style.color = '#34d399'; msg.textContent = 'Saved'; setTimeout(function () { location.reload(); }, 500); })
      .catch(function () { msg.style.color = '#f87171'; msg.textContent = 'Error saving'; });
  }
  document.querySelectorAll('[data-pick-closed]').forEach(function (s) { s.addEventListener('change', function () { save(s.dataset.pickClosed, { closed: s.value }); }); });
  document.querySelectorAll('[data-pick-hide]').forEach(function (c) { c.addEventListener('change', function () { save(c.dataset.pickHide, { hide_odds: c.checked }); }); });
  document.querySelectorAll('[data-show-more]').forEach(function (b) { b.addEventListener('click', function () { b.previousElementSibling.querySelectorAll('[data-more-row]').forEach(function (r) { r.classList.remove('hidden'); }); b.remove(); }); });
  document.querySelectorAll('[data-copy-names]').forEach(function (b) { b.addEventListener('click', function () { navigator.clipboard.writeText(b.dataset.copyNames).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy names'; }, 1500); }); }); });
  document.querySelectorAll('[data-confirm]').forEach(function (b) { b.addEventListener('click', function (e) { if (!confirm(b.dataset.confirm)) e.preventDefault(); }); });
  // Reminder checklist: counts, the "also email" label and the confirm follow the ticks.
  var remind = document.getElementById('picks-remind');
  if (remind) {
    var boxes = [].slice.call(document.querySelectorAll('input[name="ids"][form="picks-remind"]:not([disabled])'));
    var submit = remind.querySelector('[data-remind-submit]');
    var emailBox = remind.querySelector('input[name="email"]');
    var tally = function () {
      var on = boxes.filter(function (b) { return b.checked; });
      return { n: on.length, e: on.filter(function (b) { return b.dataset.reach === 'email'; }).length };
    };
    var sync = function () {
      var t = tally();
      var sc = document.querySelector('[data-sel-count]');
      if (sc) sc.textContent = t.n + ' of ' + boxes.length + ' selected';
      remind.querySelector('[data-email-count]').textContent = t.e;
      emailBox.disabled = !t.e;
      submit.disabled = !t.n;
    };
    boxes.forEach(function (b) { b.addEventListener('change', sync); });
    document.querySelectorAll('[data-sel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        boxes.forEach(function (b) { b.checked = btn.dataset.sel === 'all' || (btn.dataset.sel === 'email' && b.dataset.reach === 'email'); });
        sync();
      });
    });
    remind.addEventListener('submit', function (e) {
      var t = tally();
      var msg = 'Send a reminder to ' + t.n + ' player' + (t.n === 1 ? '' : 's') + '?' +
        (emailBox.checked && t.e ? ' ' + t.e + ' get the email too.' : ' Bell only, no email.') +
        (remind.dataset.reminded ? ' You already sent one for this game day.' : '');
      if (!confirm(msg)) e.preventDefault();
    });
    sync();
  }
  function toggle(row) {
    var ex = document.querySelector('[data-expanded="' + row.dataset.expand + '"]');
    var open = ex.classList.toggle('hidden') === false;
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.querySelectorAll('[data-expand]').forEach(function (r) {
    r.addEventListener('click', function () { toggle(r); });
    r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(r); } });
  });
})();
</script>`;
}
