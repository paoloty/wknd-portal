import { escHtml } from '../layout.js';

const SOURCE_LABELS = { ai: 'AI-written', default: 'Default copy', edited: 'Edited by admin' };
const SEND_HOUR_LABEL = '8 AM';

function fmtWhen(inDays, date) {
  const d = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (inDays === 0) return `Today · ${d}`;
  if (inDays === 1) return `Tomorrow · ${d}`;
  if (inDays === -1) return `Yesterday · ${d}`;
  return inDays > 0 ? `In ${inDays} days · ${d}` : `${-inDays} days ago · ${d}`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
}

function fmtMonthDay(date) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function pill(text, color) {
  return `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color};background:${color}1f;padding:2px 8px;border-radius:999px;white-space:nowrap">${escHtml(text)}</span>`;
}

// Where a birthday's email stands, for the summary table, the cards and the dashboard.
// `attention` marks the ones that need an admin: belated emails still unsent, and today's
// when automation didn't (or can't) send it. `state` is autoSendState() from lib/birthday.js.
export function birthdayEmailStatus(entry, draft, state = {}) {
  if (draft?.status === 'sent') return { label: 'Sent', color: '#34d399', detail: fmtTime(draft.sent_at) };
  if (draft?.status === 'sending') return { label: 'Sending', color: '#60a5fa', detail: '' };
  if (!entry.activity?.active) return { label: 'Skipped', color: '#64748b', detail: 'Inactive for 3+ months' };
  if (!entry.email) return { label: 'No email', color: '#f87171', detail: 'No approved email on file', attention: entry.inDays <= 0 };
  if (entry.inDays < 0) return { label: 'Belated, not sent', color: '#f59332', detail: 'Send it by hand below', attention: true };
  if (!state.on) {
    const why = state.production ? 'Automatic sending is paused' : 'Automatic sending only runs on the live site';
    return entry.inDays === 0
      ? { label: 'Not sent', color: '#f59332', detail: why, attention: true }
      : { label: draft ? 'Draft ready' : 'Not written', color: '#64748b', detail: why };
  }
  if (entry.inDays === 0) {
    if (state.windowPassed) return { label: 'Not sent', color: '#f87171', detail: 'Automatic send didn\'t go out; send it by hand below', attention: true };
    if (state.windowOpen) return { label: 'Sending this hour', color: '#60a5fa', detail: 'Retries hourly until 8 PM if it fails' };
    return { label: `Sends ${SEND_HOUR_LABEL}`, color: '#60a5fa', detail: draft ? 'Draft ready' : 'Draft being written' };
  }
  return { label: `Sends ${fmtMonthDay(entry.date)}, ${SEND_HOUR_LABEL}`, color: '#64748b', detail: draft ? 'Draft ready' : 'Draft being written' };
}

function fmtShortDate(date) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// "Played Sep 27, 2026", the most recent of login / Papawis / game. Shown so it's clear
// why someone qualifies under the 3-month activity rule.
function lastActiveText(activity) {
  if (!activity?.latest) return 'No activity on record';
  return `${activity.latest.label} ${fmtShortDate(activity.latest.date)}`;
}

export function fmtBirthdayWhen(inDays, date) {
  const d = fmtMonthDay(date);
  if (inDays === 0) return `Today, ${d}`;
  if (inDays === 1) return `Tomorrow, ${d}`;
  if (inDays === -1) return `Yesterday, ${d}`;
  return inDays > 0 ? `${d} (in ${inDays} days)` : `${d} (${-inDays} days ago)`;
}

function automationBar(state) {
  const status = !state.production
    ? { text: 'Off on this server', sub: 'Automatic sending only runs on the live site. Here, today\'s birthdays are sent by hand.', color: '#64748b' }
    : state.enabled
      ? { text: 'On', sub: `Drafts are written up to a week ahead. Each email sends at ${SEND_HOUR_LABEL} Manila on the birthday, retrying hourly until 8 PM if it fails.`, color: '#34d399' }
      : { text: 'Paused', sub: 'Drafts are still written, but nothing sends on its own. Today\'s birthdays are sent by hand.', color: '#f59332' };
  const toggle = state.production
    ? `<form method="post" action="/admin/birthdays/auto-send" class="m-0">
        <input type="hidden" name="enabled" value="${state.enabled ? '0' : '1'}">
        <button class="admin-btn admin-btn--sm"${state.enabled ? ' data-confirm="Pause automatic birthday emails? Nothing will send on its own until you turn it back on."' : ''}>${state.enabled ? 'Pause' : 'Turn on'}</button>
      </form>`
    : '';
  return `<div class="mb-6 bg-admin-surface border border-admin-border rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
  <span class="h-2 w-2 rounded-full shrink-0" style="background:${status.color}"></span>
  <span class="text-sm text-slate-200"><strong>Automatic birthday emails:</strong> <span style="color:${status.color}">${escHtml(status.text)}</span></span>
  <span class="text-xs text-slate-500 basis-full sm:basis-auto sm:flex-1">${escHtml(status.sub)}</span>
  ${toggle}
</div>`;
}

function summaryTable(all, drafts, state) {
  const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap';
  const rows = all.map(e => {
    const draft = drafts.get(`${e.player.id}:${e.year}`);
    const st = birthdayEmailStatus(e, draft, state);
    const today = e.inDays === 0;
    const hasCard = e.inDays >= 0 || draft?.status !== 'sent';
    return `<tr class="border-b border-admin-border/40 last:border-0 ${today ? 'bg-brand/[.05]' : ''}">
      <td class="px-4 py-2.5 text-sm whitespace-nowrap ${today ? 'text-brand font-semibold' : e.inDays < 0 ? 'text-slate-500' : 'text-slate-300'}">${escHtml(fmtBirthdayWhen(e.inDays, e.date))}</td>
      <td class="px-4 py-2.5 text-sm whitespace-nowrap">${hasCard
        ? `<a href="#p-${escHtml(e.player.id)}" class="text-slate-200 hover:text-brand no-underline">${escHtml(e.fullName)}</a>`
        : `<span class="text-slate-400">${escHtml(e.fullName)}</span>`}</td>
      <td class="px-4 py-2.5 text-sm text-slate-400 whitespace-nowrap">${escHtml(e.teamName || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap tabular-nums">${e.age ? `${e.inDays < 0 ? 'Turned' : 'Turns'} ${e.age}` : '—'}</td>
      <td class="px-4 py-2.5 text-sm whitespace-nowrap text-slate-400">${escHtml(lastActiveText(e.activity))}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${pill(st.label, st.color)}${st.detail ? ` <span class="text-xs text-slate-500 ml-1">${escHtml(st.detail)}</span>` : ''}</td>
    </tr>`;
  }).join('');
  return `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto mb-6">
  <table class="w-full border-collapse">
    <thead><tr class="border-b border-admin-border">
      <th class="${th}">Birthday</th><th class="${th}">Player</th><th class="${th}">Team</th><th class="${th}">Age</th><th class="${th}">Last active</th><th class="${th}">Email</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

const LOG_EVENTS = {
  drafted:     { label: 'Drafted',     color: '#94a3b8' },
  redrafted:   { label: 'Rewritten',   color: '#94a3b8' },
  edited:      { label: 'Edited',      color: '#94a3b8' },
  test_sent:   { label: 'Test sent',   color: '#a78bfa' },
  sent:        { label: 'Sent',        color: '#34d399' },
  send_failed: { label: 'Send failed', color: '#f87171' },
};

function activityLog(log) {
  const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap';
  const rows = log.map(l => {
    const ev = LOG_EVENTS[l.event] || { label: l.event, color: '#64748b' };
    return `<tr class="border-b border-admin-border/40 last:border-0">
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(l.created_at))}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${pill(ev.label, ev.color)}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap">${escHtml(l.player_name || l.player_id)}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${l.actor === 'auto' ? 'Automatic' : 'Admin'}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(l.detail || '')}</td>
    </tr>`;
  }).join('');
  return `<div class="mt-8">
  <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Activity log</h3>
  ${log.length
    ? `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
    <table class="w-full border-collapse">
      <thead><tr class="border-b border-admin-border"><th class="${th}">Time</th><th class="${th}">What</th><th class="${th}">Player</th><th class="${th}">By</th><th class="${th}">Details</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
    : `<div class="bg-admin-surface border border-admin-border rounded-lg p-8 text-center text-sm text-slate-500">Nothing logged yet. Drafts and sends will show up here.</div>`}
</div>`;
}

function sentHistory(sent, year) {
  if (!sent.length) return '';
  const items = sent.map(r => `<li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 border-b border-admin-border/40 last:border-0 text-sm">
      <span class="text-slate-200">${escHtml(`${r.first_name || ''} ${r.last_name || ''}`.trim() || r.player_id)}</span>
      <span class="text-xs text-slate-500">${escHtml(r.sent_to)}</span>
      <span class="text-xs text-slate-500">${escHtml(SOURCE_LABELS[r.source] || r.source)}</span>
      <span class="ml-auto text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(r.sent_at))}</span>
    </li>`).join('');
  return `<div class="mt-8">
  <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Sent in ${year} (${sent.length})</h3>
  <ul class="bg-admin-surface border border-admin-border rounded-lg list-none m-0 p-0">${items}</ul>
</div>`;
}

// A card per birthday. `manual` cards (belated, or today when automation can't send it)
// get the editor and Send button; the rest are monitor-only: status, preview, and a test
// send to the admin inbox. previewHtml is shown in a sandboxed iframe so its inline styles
// can't leak into the admin page.
function birthdayCard({ entry, draft, previewHtml, manual }, testEmail, state) {
  const pid = escHtml(entry.player.id);
  const base = `/admin/birthdays/${encodeURIComponent(entry.player.id)}`;
  const st = birthdayEmailStatus(entry, draft, state);
  const sent = draft?.status === 'sent';
  const belated = entry.inDays < 0;
  const canSend = entry.inDays <= 0 && !!entry.email && draft?.status === 'draft';

  const meta = [
    entry.age ? `${belated ? 'Turned' : 'Turns'} ${entry.age}` : '',
    entry.player.number ? `#${escHtml(entry.player.number)}` : '',
    entry.teamName ? escHtml(entry.teamName) : '',
    entry.email ? escHtml(entry.email) : '<span style="color:var(--error)">No email on file</span>',
    escHtml(lastActiveText(entry.activity)),
  ].filter(Boolean).join(' · ');

  const testButton = draft && !sent
    ? `<button class="admin-btn admin-btn--sm" formaction="${base}/test" data-busy="Sending…">Send test to ${escHtml(testEmail)}</button>`
    : '';

  let body;
  if (sent) {
    body = `<p class="text-sm text-slate-400">Sent to <strong class="text-slate-200">${escHtml(draft.sent_to)}</strong> on ${escHtml(fmtTime(draft.sent_at))}.</p>`;
  } else if (!manual) {
    body = `<form method="post" class="space-y-3">
        ${draft
          ? `<p class="text-sm text-slate-300 leading-relaxed">${escHtml(draft.opening)}</p>
             ${draft.closing ? `<p class="text-sm text-slate-300 leading-relaxed">${escHtml(draft.closing)}</p>` : ''}
             ${draft.note ? `<p class="text-xs text-slate-500">${escHtml(draft.note)}</p>` : ''}`
          : `<p class="text-sm text-slate-500">The message is written automatically within the hour.</p>`}
        ${testButton ? `<div class="flex flex-wrap gap-2">${testButton}</div>` : ''}
      </form>`;
  } else {
    const sendHint = !entry.email ? 'No approved registration email on file, so this can\'t be sent.'
      : entry.inDays > 0 ? 'Sending opens on their birthday.'
      : !draft ? 'Write a message first.'
      : '';
    body = `<form method="post" class="space-y-3">
        <label class="block">
          <span class="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Opening</span>
          <textarea name="opening" id="opening-${pid}" rows="5" class="admin-input w-full" placeholder="Click “Write with AI” or “Use default” to start.">${escHtml(draft?.opening || '')}</textarea>
        </label>
        <label class="block">
          <span class="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Closing line</span>
          <textarea name="closing" id="closing-${pid}" rows="2" class="admin-input w-full">${escHtml(draft?.closing || '')}</textarea>
        </label>
        ${draft?.note ? `<p class="text-xs text-slate-500">${escHtml(draft.note)}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          <button class="admin-btn admin-btn--sm" formaction="${base}/generate" data-busy="Writing…">${draft ? 'Rewrite with AI' : 'Write with AI'}</button>
          <button class="admin-btn admin-btn--sm" formaction="${base}/default">Use default</button>
          ${draft ? `<button class="admin-btn admin-btn--sm" formaction="${base}/save">Save edits</button>` : ''}
          ${testButton}
        </div>
        <div class="pt-3 border-t border-admin-border flex flex-wrap items-center gap-3">
          <button class="agm-new-btn" formaction="${base}/send" ${canSend ? '' : 'disabled'}
            data-confirm="Send the ${belated ? 'belated ' : ''}birthday email to ${escHtml(entry.email)} now? Unsaved edits above are saved first. This can't be undone.">Send ${belated ? 'belated email ' : ''}to ${escHtml(entry.firstName)}</button>
          ${sendHint ? `<span class="text-xs text-slate-500">${escHtml(sendHint)}</span>` : ''}
        </div>
      </form>`;
  }

  return `
<section id="p-${pid}" class="bg-admin-surface border border-admin-border rounded-lg p-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
  <div class="space-y-4 min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-base font-bold text-slate-100">${escHtml(entry.fullName)}</h3>
      ${pill(st.label, st.color)}
      ${draft && !sent ? pill(SOURCE_LABELS[draft.source] || draft.source, '#64748b') : ''}
    </div>
    <p class="text-xs text-slate-500 -mt-2">${escHtml(fmtWhen(entry.inDays, entry.date))} · ${meta}</p>
    ${st.detail && !sent ? `<p class="text-xs text-slate-400 -mt-2">${escHtml(st.detail)}</p>` : ''}
    ${body}
  </div>
  <div class="min-w-0">
    ${previewHtml
      ? `<iframe title="Email preview for ${escHtml(entry.fullName)}" sandbox srcdoc="${escHtml(`<body style="margin:0;padding:16px;background:#f1f5f9">${previewHtml}</body>`)}" style="width:100%;height:760px;border:1px solid var(--border);border-radius:8px;background:#f1f5f9"></iframe>`
      : `<div class="h-full min-h-[200px] border border-dashed border-admin-border rounded-lg grid place-items-center text-sm text-slate-500 p-6 text-center">The email preview shows up here once there's a message.</div>`}
  </div>
</section>`;
}

// all: every qualifying birthday from 7 days back to 7 days ahead (summary table).
// rows: the cards (today, upcoming, and belated ones not yet sent). drafts: Map of
// `${playerId}:${year}` → row. state: autoSendState(). log: birthday_email_log rows.
export function adminBirthdaysBody({ all = [], rows, drafts = new Map(), sent = [], year, state = {}, log = [], msg = '', error = '', testEmail }) {
  const needsYou = rows.filter(r => r.manual && r.draft?.status !== 'sent' && r.entry.inDays <= 0).length;
  return `
<div class="mb-4">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Birthdays</h2>
  <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Birthdays from the past week and the week ahead. Upcoming birthday emails are written and sent automatically; the activity log below shows everything that happened. Missed ones from the past week are yours to send as a belated email. Only players who logged in, joined Papawis or played a game in the last 3 months are listed. Ages are only shown here; the email never mentions them.</p>
</div>
${msg ? `<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">${escHtml(msg)}</div>` : ''}
${error ? `<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">${escHtml(error)}</div>` : ''}
${automationBar(state)}
${all.length ? summaryTable(all, drafts, state) : ''}
${needsYou ? `<h3 class="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">${needsYou} to send by hand</h3>` : ''}
${rows.length
  ? `<div class="space-y-4">${rows.map(r => birthdayCard(r, testEmail, state)).join('')}</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No birthdays within a week of today.</div>`}
${activityLog(log)}
${sentHistory(sent, year)}
<script>
  document.querySelectorAll('button[formaction], form[action="/admin/birthdays/auto-send"] button').forEach(btn => {
    btn.addEventListener('click', e => {
      if (btn.dataset.confirm && !confirm(btn.dataset.confirm)) { e.preventDefault(); return; }
      // Disable the whole form after submit starts so a double click can't fire twice.
      const form = btn.form;
      setTimeout(() => {
        form.querySelectorAll('button').forEach(b => b.disabled = true);
        if (btn.dataset.busy) btn.textContent = btn.dataset.busy;
      }, 0);
    });
  });
</script>`;
}
