import { escHtml } from '../layout.js';

const SOURCE_LABELS = { ai: 'AI-written', default: 'Default copy', edited: 'Edited by admin' };

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

function pill(text, color) {
  return `<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color};background:${color}1f;padding:2px 8px;border-radius:999px;white-space:nowrap">${escHtml(text)}</span>`;
}

function statusPill(draft) {
  if (!draft) return pill('No message yet', '#64748b');
  if (draft.status === 'sent') return pill('Sent', '#34d399');
  if (draft.status === 'sending') return pill('Sending', '#60a5fa');
  return pill(`Draft · ${SOURCE_LABELS[draft.source] || draft.source}`, '#f59332');
}

// Where a birthday's email stands, in one word for the summary table and the dashboard.
// `attention` marks the ones an admin should act on today.
export function birthdayEmailStatus(entry, draft) {
  if (draft?.status === 'sent') return { label: 'Sent', color: '#34d399', detail: `${fmtTime(draft.sent_at)}` };
  if (draft?.status === 'sending') return { label: 'Sending', color: '#60a5fa', detail: '' };
  if (!entry.activity?.active) return { label: 'Skipped', color: '#64748b', detail: 'Inactive for 3+ months' };
  if (!entry.email) return { label: 'No email', color: '#f87171', detail: 'No approved email on file', attention: entry.inDays === 0 };
  if (entry.inDays < 0) return { label: draft ? 'Belated, ready' : 'Belated, not sent', color: '#f59332', detail: 'Can still send a belated email' };
  if (entry.inDays === 0) return { label: draft ? 'Ready to send' : 'Not written', color: '#f59332', detail: draft ? 'Draft saved' : '', attention: true };
  return { label: draft ? 'Draft ready' : 'Not written', color: '#64748b', detail: '' };
}

function fmtShortDate(date) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// "Played Sep 27, 2026", the most recent of login / Papawis / game. Shown so it's clear
// why someone does or doesn't qualify under the 3-month activity rule.
function lastActiveText(activity) {
  if (!activity?.latest) return 'No activity on record';
  return `${activity.latest.label} ${fmtShortDate(activity.latest.date)}`;
}

export function fmtBirthdayWhen(inDays, date) {
  const d = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (inDays === 0) return `Today, ${d}`;
  if (inDays === 1) return `Tomorrow, ${d}`;
  if (inDays === -1) return `Yesterday, ${d}`;
  return inDays > 0 ? `${d} (in ${inDays} days)` : `${d} (${-inDays} days ago)`;
}

function summaryTable(all, drafts) {
  const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap';
  const rows = all.map(e => {
    const st = birthdayEmailStatus(e, drafts.get(`${e.player.id}:${e.year}`));
    const today = e.inDays === 0;
    return `<tr class="border-b border-admin-border/40 last:border-0 ${today ? 'bg-brand/[.05]' : ''}">
      <td class="px-4 py-2.5 text-sm whitespace-nowrap ${today ? 'text-brand font-semibold' : e.inDays < 0 ? 'text-slate-500' : 'text-slate-300'}">${escHtml(fmtBirthdayWhen(e.inDays, e.date))}</td>
      <td class="px-4 py-2.5 text-sm whitespace-nowrap">${e.inDays >= 0
        ? `<a href="#p-${escHtml(e.player.id)}" class="text-slate-200 hover:text-brand no-underline">${escHtml(e.fullName)}</a>`
        : `<span class="text-slate-400">${escHtml(e.fullName)}</span>`}</td>
      <td class="px-4 py-2.5 text-sm text-slate-400 whitespace-nowrap">${escHtml(e.teamName || '—')}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap tabular-nums">${e.age ? `${e.inDays < 0 ? 'Turned' : 'Turns'} ${e.age}` : '—'}</td>
      <td class="px-4 py-2.5 text-sm whitespace-nowrap ${e.activity?.active ? 'text-slate-400' : 'text-slate-600'}">${escHtml(lastActiveText(e.activity))}</td>
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

// rows: [{ entry, draft, previewHtml }] — previewHtml is the rendered email for the
// current draft (or null), shown in a sandboxed iframe so its inline styles can't leak.
function birthdayCard({ entry, draft, previewHtml }, testEmail) {
  const pid = escHtml(entry.player.id);
  const base = `/admin/birthdays/${encodeURIComponent(entry.player.id)}`;
  const sent = draft?.status === 'sent';
  const active = !!entry.activity?.active;
  // On the day, or up to a week late as a "belated" email.
  const canSend = entry.inDays <= 0 && active && !!entry.email && draft?.status === 'draft';
  const belated = entry.inDays < 0;
  const sendHint = !active
    ? 'No login, Papawis or game in the last 3 months, so no birthday email.'
    : entry.inDays !== 0
    ? 'Sending opens on their birthday.'
    : !entry.email ? 'No approved registration email on file, so this can\'t be sent.'
    : !draft ? 'Write a message first.'
    : '';

  const meta = [
    entry.age ? `Turns ${entry.age}` : '',
    entry.player.number ? `#${escHtml(entry.player.number)}` : '',
    entry.teamName ? escHtml(entry.teamName) : '',
    entry.email ? escHtml(entry.email) : '<span style="color:var(--error)">No email on file</span>',
    escHtml(lastActiveText(entry.activity)),
  ].filter(Boolean).join(' · ');

  const editor = sent
    ? `<div class="text-sm text-slate-400 leading-relaxed space-y-3">
        <p>Sent to <strong class="text-slate-200">${escHtml(draft.sent_to)}</strong> on ${escHtml(fmtTime(draft.sent_at))}.</p>
      </div>`
    : `<form method="post" class="space-y-3">
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
          ${draft ? `<button class="admin-btn admin-btn--sm" formaction="${base}/save">Save edits</button>
          <button class="admin-btn admin-btn--sm" formaction="${base}/test" data-busy="Sending…">Send test to ${escHtml(testEmail)}</button>` : ''}
        </div>
        <div class="pt-3 border-t border-admin-border flex flex-wrap items-center gap-3">
          <button class="agm-new-btn" formaction="${base}/send" ${canSend ? '' : 'disabled'}
            data-confirm="Send the ${belated ? 'belated ' : ''}birthday email to ${escHtml(entry.email)} now? Unsaved edits above are saved first. This can't be undone.">Send ${belated ? 'belated email ' : ''}to ${escHtml(entry.firstName)}</button>
          ${sendHint ? `<span class="text-xs text-slate-500">${escHtml(sendHint)}</span>` : ''}
        </div>
      </form>`;

  return `
<section id="p-${pid}" class="bg-admin-surface border border-admin-border rounded-lg p-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
  <div class="space-y-4 min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-base font-bold text-slate-100">${escHtml(entry.fullName)}</h3>
      ${statusPill(draft)}
    </div>
    <p class="text-xs text-slate-500 -mt-2">${escHtml(fmtWhen(entry.inDays, entry.date))} · ${meta}</p>
    ${editor}
  </div>
  <div class="min-w-0">
    ${previewHtml
      ? `<iframe title="Email preview for ${escHtml(entry.fullName)}" sandbox srcdoc="${escHtml(`<body style="margin:0;padding:16px;background:#f1f5f9">${previewHtml}</body>`)}" style="width:100%;height:760px;border:1px solid var(--border);border-radius:8px;background:#f1f5f9"></iframe>`
      : `<div class="h-full min-h-[200px] border border-dashed border-admin-border rounded-lg grid place-items-center text-sm text-slate-500 p-6 text-center">The email preview shows up here once there's a message.</div>`}
  </div>
</section>`;
}

// all: every birthday from 7 days back to 7 days ahead (summary table). rows: today and
// upcoming only, with their editor cards. drafts: Map of `${playerId}:${year}` → row.
export function adminBirthdaysBody({ all = [], rows, drafts = new Map(), sent = [], year, msg = '', error = '', testEmail }) {
  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Birthdays</h2>
  <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Birthdays from the past week and the week ahead, with each player's age and whether their birthday email went out. Missed ones from the past week can still get a belated email, worded as late. Only players who logged in, joined Papawis or played a game in the last 3 months get one; everyone else is marked Skipped. Write the message with AI or use the default copy, check the preview, send yourself a test, then send it on the day. Nothing sends automatically. Ages are only shown here; the email never mentions them.</p>
</div>
${msg ? `<div class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">${escHtml(msg)}</div>` : ''}
${error ? `<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">${escHtml(error)}</div>` : ''}
${all.length ? summaryTable(all, drafts) : ''}
${rows.length
  ? `<div class="space-y-4">${rows.map(r => birthdayCard(r, testEmail)).join('')}</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No birthdays today or in the next 7 days.</div>`}
${sentHistory(sent, year)}
<script>
  document.querySelectorAll('button[formaction]').forEach(btn => {
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
