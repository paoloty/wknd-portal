// My conduct in the app (/app/conduct): the site's /me/conduct (views/my-conduct.js) on a phone.
// Answering and appealing post to the site's routes (public/app.js initConduct).
import { esc, backChev } from './layout.js';
import { conductCaseState, standingSummary } from '../my-conduct.js';

const day = ms => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : '');
const CONTEXT = { league: 'League game', papawis: 'Papawis run', online: 'Online', other: 'Elsewhere' };
const APPEAL = { pending: 'Your appeal is in. Your fine is on hold until it’s decided.', upheld: 'Appeal decided: the decision stands.', lowered: 'Appeal decided: lowered.', cancelled: 'Appeal won: cancelled.' };

function caseCard(k) {
  const st = conductCaseState(k);
  const block = (label, text) => `<div class="cnd__b"><span class="cnd__l">${esc(label)}</span><p>${esc(text)}</p></div>`;
  return `<div class="card cnd" id="case-${esc(k.id)}">
    <div class="cnd__top"><b>${esc(k.category_label)}</b><span class="cnd__pill${st.open ? ' is-open' : ''}">${esc(st.pill)}</span></div>
    <p class="cnd__meta">${esc(CONTEXT[k.incident_context] || 'League game')}, ${esc(day(k.incident_at || k.created_at))} · filed by ${esc(k.by.toLowerCase() === 'a player' ? 'a player' : k.by)}</p>
    ${k.description ? block('What was reported', k.description) : ''}
    <p class="cnd__line">${esc(st.line)}</p>
    ${k.resolution_note && k.status !== 'open' ? block('The reason', k.resolution_note) : ''}
    ${k.response ? block('Your side', k.response) : ''}
    ${k.canRespond ? `<form class="cnd__form" data-cd-form="/me/conduct/${esc(k.id)}/respond">
      <label class="cnd__l" for="cd-r-${esc(k.id)}">${k.response ? 'Change your side' : 'Your side'}</label>
      <textarea id="cd-r-${esc(k.id)}" name="text" rows="4" maxlength="2000" placeholder="What happened, from where you stood. Who else saw it?">${esc(k.response || '')}</textarea>
      <p class="msg msg--err" data-cd-msg hidden></p>
      <button type="submit" class="btn">Send</button>
    </form>` : ''}
    ${k.appeal_at ? `${block('Your appeal', k.appeal_text)}<p class="cnd__line">${esc(APPEAL[k.appeal_status] || '')}</p>${k.appeal_note ? `<p class="cnd__line">${esc(k.appeal_note)}</p>` : ''}` : ''}
    ${k.canAppeal ? `<details class="cnd__appeal"><summary>Appeal this decision · until ${esc(day(k.appealUntil))}</summary>
      <form class="cnd__form" data-cd-form="/me/conduct/${esc(k.id)}/appeal">
        <label class="cnd__l" for="cd-a-${esc(k.id)}">What did the decision get wrong?</label>
        <textarea id="cd-a-${esc(k.id)}" name="text" rows="4" maxlength="3000" placeholder="One appeal per case. It can lower or confirm the decision, never raise it."></textarea>
        <p class="msg msg--err" data-cd-msg hidden></p>
        <button type="submit" class="btn btn--ghost">Send appeal</button>
      </form></details>` : ''}
  </div>`;
}

// The red bar on every tab screen while suspended (server.js sendTab). s: suspensionStanding().
export function appSuspendedBar(s) {
  if (!s?.active) return '';
  const what = s.rest ? 'for the rest of the season' : `: ${s.left} league game${s.left === 1 ? '' : 's'} left`;
  return `<a class="pw-lockbar" href="/app/conduct" role="status"><span class="pw-lockbar__ic" aria-hidden="true">!</span><span class="pw-lockbar__t"><b>You’re suspended${esc(what)}</b><small>Served by missing your team’s league games. No Papawis runs until then.</small></span></a>`;
}

// back: { href, label } · r: lib/conduct.js conductRecord()
export function appConductPage({ back, r }) {
  const s = r.suspension;
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Conduct</span><span></span></div>
  <div class="cnd-stats">${standingSummary(r).map(x => `<div class="card cnd-stat"><b class="num">${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div>
  <div class="sec">Cases</div>
  ${r.cases.length ? r.cases.map(caseCard).join('<div style="height:10px"></div>') : '<div class="card"><p class="cnd__line">Nothing on your record. Keep it that way.</p></div>'}
  ${r.owed > 0 ? '<p class="foot-note"><a class="link" href="/app/settle?from=conduct">Settle your balance</a> to pay a fine.</p>' : ''}
  <p class="foot-note">How it works: <a class="link" href="/rules/conduct">the conduct rules</a>.</p>
  <div style="height:16px"></div>`;
}
