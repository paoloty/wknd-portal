import { escHtml, pageHeader } from './layout.js';

// /me/conduct: a player's own conduct record (conduct rules, 2026-11-06): points, warnings, games
// left to sit out, every case that reached them, their side and their one appeal. The app's
// /app/conduct (views/app/conduct.js) shows the same record. r: lib/conduct.js conductRecord().
const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = ms => (ms ? new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '');
const day = ms => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '');
const CONTEXT = { league: 'League game', papawis: 'Papawis run', online: 'Online', other: 'Elsewhere' };
const APPEAL = { pending: 'Your appeal is in. Your fine is on hold until it’s decided.', upheld: 'Appeal decided: the decision stands.', lowered: 'Appeal decided: lowered.', cancelled: 'Appeal won: cancelled.' };

// Status line and pill for one case.
export function conductCaseState(k) {
  if (k.status === 'open') return { pill: 'Open', open: true, line: k.response_at ? 'Waiting for an admin to decide.' : k.respond_by > Date.now() ? `Give your side by ${when(k.respond_by)}.` : 'Waiting for an admin to decide.' };
  if (k.status === 'rejected') return { pill: 'Closed', line: 'Closed with no fine and no points.' };
  if (k.status === 'voided') return { pill: 'Cancelled', line: 'Cancelled. It’s off your record.' };
  if (k.kind === 'warning') return { pill: 'Warning', line: 'A warning: ₱0, 0 points, on your record.' };
  const pay = !k.transaction_id ? '' : k.paid_at ? ' Paid.' : k.appeal_status === 'pending' ? ' On hold during your appeal.' : k.due_at ? ` Due ${day(k.due_at)}.` : '';
  const sit = k.suspension_games === -1 ? ' Suspended for the rest of the season.' : k.suspension_games > 0 ? ` Sits out ${plural(k.suspension_games, 'league game')}.` : '';
  return { pill: 'Fined', line: `${peso(k.amount)}, ${plural(Number(k.points) || 0, 'point')}.${pay}${sit}` };
}

export function standingSummary(r) {
  const s = r.suspension;
  return [
    { value: String(r.points), label: `Points, Season ${r.season}` },
    { value: String(r.warnings), label: 'Warnings this season' },
    { value: s.active ? (s.rest ? 'Season' : String(s.left)) : '0', label: s.active && s.rest ? 'Suspended: rest of season' : 'League games to sit out' },
    { value: peso(r.owed), label: 'Fines unpaid' },
  ];
}

function caseCard(k) {
  const st = conductCaseState(k);
  return `<article class="card mc-case" id="case-${escHtml(k.id)}">
    <div class="mc-case__top">
      <div><div class="mc-case__title">${escHtml(k.category_label)}</div>
        <div class="mc-case__meta">${escHtml(CONTEXT[k.incident_context] || 'League game')}, ${escHtml(day(k.incident_at || k.created_at))} · filed by ${escHtml(k.by.toLowerCase() === 'a player' ? 'a player' : k.by)}</div></div>
      <span class="mc-pill${st.open ? ' mc-pill--open' : ''}">${st.pill}</span>
    </div>
    ${k.description ? `<div><span class="mc-case__label">What was reported</span><p>${escHtml(k.description)}</p></div>` : ''}
    <p>${escHtml(st.line)}</p>
    ${k.resolution_note && k.status !== 'open' ? `<div><span class="mc-case__label">The reason</span><p>${escHtml(k.resolution_note)}</p></div>` : ''}
    ${k.response ? `<div><span class="mc-case__label">Your side</span><p>${escHtml(k.response)}</p></div>` : ''}
    ${k.canRespond ? `<form class="mc-case__form" data-mc-form="/me/conduct/${escHtml(k.id)}/respond">
      <span class="mc-case__label">${k.response ? 'Change your side' : 'Your side'}</span>
      <textarea name="text" rows="4" maxlength="2000" placeholder="What happened, from where you stood. Who else saw it?">${escHtml(k.response || '')}</textarea>
      <div class="mc-case__actions"><button type="submit" class="mc-btn">Send</button><span class="mc-case__meta" data-mc-msg></span></div>
    </form>` : ''}
    ${k.appeal_at ? `<div><span class="mc-case__label">Your appeal</span><p>${escHtml(k.appeal_text)}</p></div><p>${escHtml(APPEAL[k.appeal_status] || '')}</p>${k.appeal_note ? `<p>${escHtml(k.appeal_note)}</p>` : ''}` : ''}
    ${k.canAppeal ? `<details class="mc-case__appeal"><summary class="mc-case__meta">Appeal this decision (until ${escHtml(day(k.appealUntil))})</summary>
      <form class="mc-case__form" data-mc-form="/me/conduct/${escHtml(k.id)}/appeal">
        <span class="mc-case__label">What did the decision get wrong?</span>
        <textarea name="text" rows="4" maxlength="3000" placeholder="One appeal per case. It can lower or confirm the decision, never raise it."></textarea>
        <div class="mc-case__actions"><button type="submit" class="mc-btn mc-btn--ghost">Send appeal</button><span class="mc-case__meta" data-mc-msg></span></div>
      </form></details>` : ''}
  </article>`;
}

// The red bar on every site page while suspended (server.js renderPage), in the "You're locked
// in" bar's look. s: suspensionStanding().
export function suspendedBar(s) {
  if (!s?.active) return '';
  const what = s.rest ? 'for the rest of the season' : `: ${plural(s.left, 'league game')} left to sit out`;
  return `<div class="pw-lock-bar cr-susp-bar" role="status">
  <span class="pw-lock-bar__ic" aria-hidden="true">!</span>
  <a class="pw-lock-bar__t" href="/me/conduct"><b>You’re suspended${what}</b><small>You serve it by missing your team’s league games. No Papawis runs until it’s served.</small></a>
  <a class="pw-lock-bar__btn" href="/me/conduct">My conduct</a>
</div>`;
}

export function myConductPage(r) {
  const s = r.suspension;
  return `<div class="container"><div class="page-content cr-page">
  ${pageHeader({ title: 'My conduct', description: 'Your record under the <a href="/rules/conduct">conduct rules</a>: points this season, warnings, anything you owe, and every case about you.' })}
  ${s.active ? `<div class="mc-alert">You’re suspended${s.rest ? ' for the rest of the season' : `: ${plural(s.left, 'league game')} left to sit out`}. You can’t join Papawis runs until it’s served.</div>` : ''}
  <div class="mc-stats">${standingSummary(r).map(x => `<div class="card mc-stat"><b>${escHtml(x.value)}</b><span>${escHtml(x.label)}</span></div>`).join('')}</div>
  <div class="section-header"><h2>Cases</h2></div>
  ${r.cases.length ? r.cases.map(caseCard).join('') : '<div class="card cr-card"><p class="fine-footnote" style="margin:0">Nothing on your record. Keep it that way.</p></div>'}
  ${r.owed > 0 ? '<p class="fine-footnote"><a href="/settle-balance">Settle your balance</a> to pay a fine.</p>' : ''}
</div></div>
<script>
(function () {
  document.querySelectorAll('[data-mc-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('[data-mc-msg]'), btn = f.querySelector('button');
      btn.disabled = true; msg.textContent = '';
      fetch(f.getAttribute('data-mc-form'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: f.querySelector('textarea').value }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) { if (!x.ok) throw new Error(x.d.error || 'Something went wrong.'); location.reload(); })
        .catch(function (err) { msg.textContent = err.message; btn.disabled = false; });
    });
  });
})();
</script>`;
}
