import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

// ── /admin/awards (Overview) and /admin/awards/races — the Awards admin section ──────────
// Overview: one status card per area (races, podium ballot, season awards, Pickmaster) with
// a link to where it's managed. Races: the MVP and Best Defender races' tools (their
// settings panel sits above, server.js racesSettingsPanel).

const kicker = 'text-[10px] font-bold uppercase tracking-widest text-slate-500';
const panel = 'bg-admin-surface border border-admin-border rounded-lg';
const pill = (txt, tone = 'slate') => {
  const c = { slate: 'text-slate-300 bg-white/[.06]', amber: 'text-amber-300 bg-amber-500/10', green: 'text-emerald-300 bg-emerald-500/10', red: 'text-red-300 bg-red-500/10' }[tone];
  return `<span class="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${c}">${escHtml(txt)}</span>`;
};

function card({ title, status, lines = [], links = [] }) {
  return `<div class="${panel} p-5 flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3"><h3 class="text-[15px] font-bold text-slate-100">${escHtml(title)}</h3>${status || ''}</div>
    <div class="flex flex-col gap-1.5 text-[13px] text-slate-400">${lines.map(l => `<div>${l}</div>`).join('')}</div>
    <div class="mt-auto flex flex-wrap gap-2 pt-1">${links.map(([href, label, primary]) => `<a href="${href}" class="admin-btn admin-btn--sm${primary ? ' admin-btn--success' : ''}"${href.startsWith('/admin') ? '' : ' target="_blank" rel="noopener"'}>${escHtml(label)}</a>`).join('')}</div>
  </div>`;
}

export function adminAwardsOverviewBody({ season, races, podium, awards, pickmaster }) {
  const b = v => `<b class="text-slate-200">${v}</b>`;
  return `
<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Awards · Season ${escHtml(String(season))}</h2>
    <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Everything award-related in one place: the races, the MVP podium ballot, the season awards and the Pickmaster.</p>
  </div>
  <a href="/awards" class="admin-btn admin-btn--sm" target="_blank" rel="noopener">View /awards ↗</a>
</div>
<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
  ${card({
    title: 'MVP & Best Defender races',
    status: !races.enabled ? pill('Off', 'red') : races.locked ? pill('Locked', 'amber') : pill('Revealed', 'green'),
    lines: [
      `On the site: ${b(races.enabled ? 'yes' : 'no')} · reveal mode ${b(escHtml(races.mode))}`,
      escHtml(races.note),
    ],
    links: [['/admin/awards/races', 'Manage races', true], ['/mvp', 'View /mvp ↗'], ['/dpoy', 'View /dpoy ↗']],
  })}
  ${card({
    title: 'MVP podium ballot',
    status: !podium.enabled ? pill('Off', 'red') : !podium.locked ? pill('Scored', 'green') : podium.closed ? pill('Closed', 'slate') : pill('Open', 'amber'),
    lines: [
      `${b(podium.complete)} ballot${podium.complete === 1 ? '' : 's'} · ${b(podium.bonus)} in for the bonus`,
      podium.locked ? `Bonus ${podium.bonusOpen ? `closes ${b(escHtml(podium.bonusAt || 'when the last games are scheduled'))}` : 'closed'}` : 'Race revealed: ballots are scored',
      podium.reminded ? `Reminder sent ${escHtml(podium.reminded)}` : 'No reminder sent yet',
    ],
    links: [['/admin/awards/podium', 'Ballots & reminder', true]],
  })}
  ${card({
    title: 'Season awards',
    status: awards.enabled ? pill(`${awards.public} of ${awards.total} public`, awards.public ? 'green' : 'slate') : pill('Page off', 'red'),
    lines: [
      `${b(awards.filled)} of ${awards.total} awards filled in for Season ${escHtml(String(season))}`,
      `/awards page: ${b(awards.enabled ? 'on' : 'off')} · ${b(awards.public)} released`,
    ],
    links: [['/admin/awards/season', 'Manage season awards', true]],
  })}
  ${card({
    title: 'Pickmaster',
    status: pickmaster ? pill('Fan award', 'slate') : '',
    lines: pickmaster
      ? [`Leader: ${b(escHtml(displayPlayerName(pickmaster.name)))} on ${b(escHtml(pickmaster.pts))} (${escHtml(pickmaster.record)})${pickmaster.level > 1 ? ` · level with ${pickmaster.level - 1} other${pickmaster.level > 2 ? 's' : ''}` : ''}`, 'Award it from Season awards when the season ends.']
      : ['Nobody on the board yet.'],
    links: [['/admin/picks', 'Who wins? picks'], ['/admin/awards/season#pickmaster', 'Pickmaster award']],
  })}
</div>`;
}

// races: [{ key, name, path, writeups, lockCards }]
export function adminRacesBody({ season, locked, races }) {
  return `
<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">MVP &amp; Best Defender races · Season ${escHtml(String(season))}</h2>
    <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">Both races share these settings and the reveal lock. Photos are set on the race pages themselves (the Photo button on each card).</p>
  </div>
  <a href="/admin/ai-writing" class="admin-btn admin-btn--sm">AI voice ↗</a>
</div>
<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
  ${races.map(r => `<div class="${panel} p-5 flex flex-col gap-3">
    <div class="flex items-center justify-between"><h3 class="text-[15px] font-bold text-slate-100">${escHtml(r.name)}</h3><a href="${r.path}" class="text-xs text-amber-400" target="_blank" rel="noopener">${escHtml(r.path)} ↗</a></div>
    <div class="text-[13px] text-slate-400">${locked
      ? `Locked: ${codeTagSm(r.path)} shows the ten forecast cards (${r.lockCards} written). Regenerate rewrites them on the next visit.`
      : `${r.writeups} player case${r.writeups === 1 ? '' : 's'} written this season. Regenerate rewrites them on the next visit to ${escHtml(r.path)}.`}</div>
    ${r.standings ? `<div class="rounded-md border border-admin-border overflow-hidden">
      <div class="px-3 py-2 border-b border-admin-border flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500"><span>Actual standings</span><span class="normal-case tracking-normal font-normal">super admin only${locked ? ' · hidden from the public' : ''}</span></div>
      <table class="w-full text-[13px]">${r.standings.map(p => `<tr class="border-t border-admin-border/60 first:border-t-0">
        <td class="px-3 py-1.5 w-8 font-bold ${p.rank <= 3 ? 'text-amber-400' : 'text-slate-500'}">${p.rank}</td>
        <td class="px-1 py-1.5 text-slate-200">${escHtml(displayPlayerName(p.name))} <span class="text-[11px] text-slate-500">${escHtml(p.team)}</span></td>
        <td class="px-3 py-1.5 text-right text-slate-300" style="font-family:'Space Grotesk',sans-serif">${p.score.toFixed(1)}</td>
      </tr>`).join('')}</table>
    </div>` : ''}
    <div class="flex flex-wrap items-center gap-2 mt-auto">
      <button type="button" class="admin-btn admin-btn--sm" data-regen="${escHtml(r.key)}" data-season="${escHtml(String(season))}">↺ Regenerate all writeups</button>
      <a href="${r.path}" class="admin-btn admin-btn--sm" target="_blank" rel="noopener">Photos (on ${escHtml(r.path)}) ↗</a>
      <span class="text-xs text-slate-500" data-regen-msg="${escHtml(r.key)}"></span>
    </div>
  </div>`).join('')}
</div>
<script>
document.querySelectorAll('[data-regen]').forEach(function (b) {
  b.addEventListener('click', function () {
    if (!confirm('Rewrite every writeup for this race? They regenerate on the next visit to the page.')) return;
    var msg = document.querySelector('[data-regen-msg="' + b.dataset.regen + '"]');
    b.disabled = true; msg.textContent = 'Clearing…';
    fetch('/admin/' + b.dataset.regen + '/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ season: b.dataset.season }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
      .then(function () { msg.style.color = '#22c55e'; msg.textContent = 'Cleared. They rewrite on the next visit.'; })
      .catch(function (e) { msg.style.color = '#f87171'; msg.textContent = e.message; b.disabled = false; });
  });
});
</script>`;
}

const codeTagSm = s => `<code class="text-[11px] bg-admin-border/50 px-1 rounded">${s}</code>`;
