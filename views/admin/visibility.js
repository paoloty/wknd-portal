import { escHtml } from '../layout.js';

const AWARD_SECTIONS = [
  { key: 'award_show_mvp',             label: 'Season MVP' },
  { key: 'award_show_dpoy',            label: 'Defensive Player of the Season' },
  { key: 'award_show_all_wknd_1',      label: 'All WKND 1st Team' },
  { key: 'award_show_all_wknd_2',      label: 'All WKND 2nd Team' },
  { key: 'award_show_all_wknd_def',    label: 'All WKND Defensive Team' },
  { key: 'award_show_scoring_champ',   label: 'Scoring Champion' },
  { key: 'award_show_assists_leader',  label: 'Assists Leader' },
  { key: 'award_show_rebounds_leader', label: 'Rebounds Leader' },
  { key: 'award_show_steals_leader',   label: 'Steals Leader' },
  { key: 'award_show_blocks_leader',   label: 'Blocks Leader' },
  { key: 'award_show_three_pm_leader', label: '3-Pointers Leader' },
  { key: 'award_show_champion',        label: 'Champion' },
  { key: 'award_show_finals_mvp',      label: 'Finals MVP' },
];

function toggleRow({ id, label, sub, checked, dataKey, extraClass = '' }) {
  return `<div class="flex items-center justify-between py-3 ${extraClass}">
    <div>
      <div class="text-[13px] font-semibold text-slate-200">${escHtml(label)}</div>
      ${sub ? `<div class="text-xs text-slate-500 mt-0.5">${sub}</div>` : ''}
    </div>
    <label class="site-toggle" title="Toggle ${escHtml(label)}">
      <input type="checkbox" id="${id}" ${dataKey ? `data-key="${escHtml(dataKey)}"` : ''} ${checked ? 'checked' : ''}>
      <span class="site-toggle__track"></span>
    </label>
  </div>`;
}

function card(title, body) {
  return `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden max-w-lg mb-4">
    <div class="px-5 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(title)}</div>
    <div class="p-5">${body}</div>
  </div>`;
}

export function adminVisibilityBody({
  papawisEnabled = false,
  postsEnabled = false,
  commentsEnabled = false,
  peerRatingsEnabled = false,
  awardsEnabled = true,
  mvpEnabled = true,
  sectionSettings = {},
} = {}) {
  const sectionRows = AWARD_SECTIONS.map(({ key, label }) => {
    const on = sectionSettings[key] !== '0';
    return `<div class="vis-section-row flex items-center justify-between py-2 border-b border-admin-border/30 last:border-0">
      <span class="text-[12px] text-slate-400">${escHtml(label)}</span>
      <label class="site-toggle site-toggle--sm" title="Show ${escHtml(label)}">
        <input type="checkbox" class="vis-awards-child" data-key="${escHtml(key)}" ${on ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </div>`;
  }).join('');

  const papawisCard = card('Papawis', toggleRow({
    id: 'vis-papawis-enabled', dataKey: 'papawis_enabled', checked: papawisEnabled,
    label: 'Show Papawis publicly',
    sub: `Pickup game sign-ups (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/papawis</code>). Management stays available either way.`,
  }) + `<span id="vis-msg-papawis_enabled" class="text-xs block mt-1 min-h-[16px]"></span>`);

  const postsCard = card('Posts', toggleRow({
    id: 'vis-posts-enabled', dataKey: 'posts_enabled', checked: postsEnabled,
    label: 'Show Posts publicly',
    sub: `League news / matchup previews (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/posts</code>). Management stays available either way.`,
  }) + `<span id="vis-msg-posts_enabled" class="text-xs block mt-1 min-h-[16px]"></span>`);

  const commentsCard = card('Comments', toggleRow({
    id: 'vis-comments-enabled', dataKey: 'comments_enabled', checked: commentsEnabled,
    label: 'Show comments &amp; reactions on games',
    sub: `Registered players can comment and react on any game page. Admins can delete inline either way.`,
  }) + `<span id="vis-msg-comments_enabled" class="text-xs block mt-1 min-h-[16px]"></span>`);

  const peerRatingsCard = card('Player Ratings', toggleRow({
    id: 'vis-peer-ratings-enabled', dataKey: 'peer_ratings_enabled', checked: peerRatingsEnabled,
    label: 'Show peer ratings on player profiles',
    sub: `Roast-style player-to-player ratings, shown on <code class="text-[11px] bg-admin-border/50 px-1 rounded">/players/:id</code>. Anonymous ratings are masked to everyone except a super admin.`,
  }) + `<span id="vis-msg-peer_ratings_enabled" class="text-xs block mt-1 min-h-[16px]"></span>`);

  const awardsCard = card('Awards', `
    ${toggleRow({
      id: 'vis-awards-enabled', dataKey: 'awards_enabled', checked: awardsEnabled,
      label: 'Season Awards', sub: `Season awards page (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/awards</code>)`,
      extraClass: 'border-b border-admin-border/50',
    })}
    <span id="vis-msg-awards_enabled" class="text-xs block mt-1 min-h-[14px]"></span>
    <div class="ml-4 pl-3 border-l-2 border-admin-border/60 py-1 mb-3" id="vis-awards-sections">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1 mt-1">Sections — release daily</div>
      <p id="vis-awards-note" class="text-[11px] text-slate-600 italic mb-1" style="display:${awardsEnabled ? 'none' : 'block'}">Staged here, but won't show publicly until Season Awards above is on.</p>
      ${sectionRows}
      <span id="vis-section-msg" class="text-xs block mt-1.5 min-h-[14px]"></span>
    </div>
    ${toggleRow({
      id: 'vis-mvp-enabled', dataKey: 'mvp_race_enabled', checked: mvpEnabled,
      label: 'MVP Race', sub: `Season MVP ladder with AI-written player cases (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/mvp</code>)`,
      extraClass: 'border-t border-admin-border/50',
    })}
    <span id="vis-msg-mvp_race_enabled" class="text-xs block mt-1 min-h-[16px]"></span>
  `);

  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Visibility</h2>
  <p class="text-xs text-slate-500 mt-0.5">What's currently shown to the public. Each feature keeps its own management page — this is only the public on/off switch.</p>
</div>

${papawisCard}
${postsCard}
${commentsCard}
${peerRatingsCard}
${awardsCard}

<style>
  #vis-awards-sections.is-dim .vis-section-row { opacity: .45; }
</style>

<script>
(function() {
  function bindToggle(id, key, msgId) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', async function() {
      var msg = document.getElementById(msgId);
      if (msg) { msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)'; }
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        if (msg) { msg.style.color = '#22c55e'; msg.textContent = 'Saved.'; }
      } catch(e) {
        if (msg) { msg.style.color = '#f87171'; msg.textContent = 'Error saving.'; }
        this.checked = !this.checked;
      }
      if (msg) setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  }

  bindToggle('vis-papawis-enabled',  'papawis_enabled',   'vis-msg-papawis_enabled');
  bindToggle('vis-posts-enabled',    'posts_enabled',     'vis-msg-posts_enabled');
  bindToggle('vis-comments-enabled', 'comments_enabled',  'vis-msg-comments_enabled');
  bindToggle('vis-peer-ratings-enabled', 'peer_ratings_enabled', 'vis-msg-peer_ratings_enabled');
  bindToggle('vis-awards-enabled',  'awards_enabled',    'vis-msg-awards_enabled');
  bindToggle('vis-mvp-enabled',     'mvp_race_enabled',  'vis-msg-mvp_race_enabled');

  document.querySelectorAll('.vis-awards-child').forEach(function(input) {
    input.addEventListener('change', async function() {
      var key = this.dataset.key;
      var msg = document.getElementById('vis-section-msg');
      msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
      try {
        var r = await fetch('/admin/site/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: this.checked ? '1' : '0' })
        });
        if (!r.ok) throw new Error();
        msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      } catch(e) {
        msg.style.color = '#f87171'; msg.textContent = 'Error saving.';
        this.checked = !this.checked;
      }
      setTimeout(function() { msg.textContent = ''; }, 2000);
    });
  });

  // Section toggles stay clickable even while Season Awards is off (so you can
  // stage next week's releases in advance) — just visually flagged as inert
  // until the parent switch is actually on.
  var awardsParent = document.getElementById('vis-awards-enabled');
  var sectionsWrap = document.getElementById('vis-awards-sections');
  var note = document.getElementById('vis-awards-note');
  function syncAwardsDim() {
    var on = awardsParent.checked;
    sectionsWrap.classList.toggle('is-dim', !on);
    note.style.display = on ? 'none' : 'block';
  }
  awardsParent.addEventListener('change', syncAwardsDim);
  syncAwardsDim();
})();
</script>`;
}
