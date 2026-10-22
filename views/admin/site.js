import { escHtml } from '../layout.js';
import { settingsScript } from './settings.js';

// ── /admin/site — Site & homepage (was /admin/visibility) ─────────────────────────────────
// The settings that belong to the whole site (comments, ratings, the join banner, the header
// and the homepage cards), plus a read-only "What's public right now" list: one line per
// feature with a link to the page where its switch now lives (each feature's switches moved
// onto its own admin page in the 2026-10 reorganisation). panels: settingsPanel() HTML.
// status: [{ label, on, href }]. The panels are built in server.js, not through withSettings,
// so the script that saves them is added here (without it the switches never save).
export function adminSiteBody({ panels = '', status = [] }) {
  return `
<div class="mb-5">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Site &amp; homepage</h2>
  <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Site-wide settings. Each feature's own on/off switch now lives on that feature's admin page; the list below shows what's public and where to change it.</p>
</div>
<div class="grid gap-5 items-start" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
  <div>${panels}</div>
  <section class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
    <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">What's public right now</div>
    <div class="px-5 py-2">${status.map((s, i) => `<a href="${s.href}" class="flex items-center justify-between gap-3 py-2 no-underline${i ? ' border-t border-admin-border' : ''}">
        <span class="text-[13px] text-slate-200">${escHtml(s.label)}</span>
        <span class="flex items-center gap-2 text-xs"><span class="font-bold ${s.on ? 'text-emerald-400' : 'text-slate-500'}">${s.on ? 'On' : 'Off'}</span><span class="text-slate-500">${escHtml(s.where)} →</span></span>
      </a>`).join('')}</div>
  </section>
</div>
${settingsScript()}`;
}
