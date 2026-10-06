import { escHtml } from '../layout.js';

// Status of one email_log row (lib/portal-db.js), worst news first: a bounce or spam
// complaint matters more than an open. "Delivered" with no open is deliberately neutral —
// image-blocking clients never register opens, so it isn't evidence they didn't read it.
export function emailStatus(row) {
  if (!row) return null;
  if (row.complained_at) return { key: 'complained', label: 'Marked spam', cls: 'bg-red-500/15 text-red-400',     at: row.complained_at };
  if (row.bounced_at)    return { key: 'bounced',    label: 'Bounced',     cls: 'bg-red-500/15 text-red-400',     at: row.bounced_at };
  if (row.failed_at)     return { key: 'failed',     label: 'Failed',      cls: 'bg-red-500/15 text-red-400',     at: row.failed_at };
  if (row.clicked_at)    return { key: 'clicked',    label: 'Clicked',     cls: 'bg-green-500/15 text-green-400', at: row.clicked_at };
  if (row.opened_at)     return { key: 'opened',     label: 'Opened',      cls: 'bg-green-500/15 text-green-400', at: row.opened_at };
  if (row.delivered_at)  return { key: 'delivered',  label: 'Delivered',   cls: 'bg-slate-500/15 text-slate-300', at: row.delivered_at };
  if (row.delayed_at)    return { key: 'delayed',    label: 'Delayed',     cls: 'bg-amber-500/15 text-amber-400', at: row.delayed_at };
  return                        { key: 'sent',       label: 'Sent',        cls: 'bg-slate-500/15 text-slate-400', at: row.sent_at };
}

export function fmtAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tooltip(row, st) {
  const parts = [`Sent ${new Date(row.sent_at).toLocaleString('en-US')}`];
  if (row.delivered_at) parts.push(`Delivered ${new Date(row.delivered_at).toLocaleString('en-US')}`);
  if (row.opened_at)    parts.push(`First opened ${new Date(row.opened_at).toLocaleString('en-US')}${row.open_count > 1 ? ` (${row.open_count} opens)` : ''}`);
  if (row.clicked_at)   parts.push(`Clicked ${new Date(row.clicked_at).toLocaleString('en-US')}`);
  if (row.bounce_reason) parts.push(`Bounce: ${row.bounce_reason}`);
  if (st.key === 'delivered') parts.push('No open recorded — some mail apps block the tracking image, so this may still have been read.');
  return parts.join('\n');
}

// Small pill, e.g. "Opened · 2h ago". prefix labels which email it is when that isn't
// obvious from where it's shown.
export function emailStatusChip(row, { prefix = '' } = {}) {
  const st = emailStatus(row);
  if (!st) return '';
  return `<span title="${escHtml(tooltip(row, st))}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${st.cls}">${prefix ? `<span class="opacity-70">${escHtml(prefix)}</span> ` : ''}${st.label}<span class="font-semibold normal-case tracking-normal opacity-70">· ${fmtAgo(st.at)}</span></span>`;
}

// "Emails" card for an admin detail page: everything sent to one address, newest first.
export function emailActivityCard(rows) {
  const list = rows.length
    ? rows.map(r => `
        <li class="flex items-center justify-between gap-3 py-2.5 border-b border-admin-border last:border-0">
          <div class="min-w-0">
            <div class="text-sm text-slate-200 truncate">${escHtml(r.subject || '(no subject)')}</div>
            <div class="text-[11px] text-slate-500">${new Date(r.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${r.bounce_reason ? ` · ${escHtml(r.bounce_reason)}` : ''}</div>
          </div>
          ${emailStatusChip(r)}
        </li>`).join('')
    : `<li class="py-2 text-sm text-slate-500">No emails logged yet. Tracking started when email logging was added; anything sent before then isn't here.</li>`;
  return `
    <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Emails</div>
      </div>
      <ul class="px-5 py-1.5">${list}</ul>
    </div>`;
}
