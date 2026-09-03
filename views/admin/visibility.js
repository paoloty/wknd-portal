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

function featureRow({ id, label, sub, checked, dataKey, msgId }) {
  return `<tr class="admin-table-row">
    <td class="admin-td" style="font-weight:600;white-space:nowrap">${escHtml(label)}</td>
    <td class="admin-td" style="color:var(--text-muted)">${sub}</td>
    <td class="admin-td" style="text-align:right">
      <label class="site-toggle" title="Toggle ${escHtml(label)}">
        <input type="checkbox" id="${id}" data-key="${escHtml(dataKey)}" ${checked ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
      <span id="${msgId}" class="text-xs block mt-1 min-h-[14px]"></span>
    </td>
  </tr>`;
}

function sectionRow({ key, label, on }) {
  return `<tr class="admin-table-row vis-section-row">
    <td class="admin-td" style="padding-left:36px;color:var(--text-muted);font-size:12px" colspan="2">${escHtml(label)}</td>
    <td class="admin-td" style="text-align:right">
      <label class="site-toggle site-toggle--sm" title="Show ${escHtml(label)}">
        <input type="checkbox" class="vis-awards-child" data-key="${escHtml(key)}" ${on ? 'checked' : ''}>
        <span class="site-toggle__track"></span>
      </label>
    </td>
  </tr>`;
}

export function adminVisibilityBody({
  papawisEnabled = false,
  postsEnabled = false,
  commentsEnabled = false,
  marketplaceEnabled = false,
  peerRatingsEnabled = false,
  playerReportsEnabled = false,
  awardsEnabled = true,
  mvpEnabled = true,
  homeShowRosterMoves = false,
  sectionSettings = {},
} = {}) {
  const sectionRows = AWARD_SECTIONS.map(({ key, label }) => sectionRow({ key, label, on: sectionSettings[key] !== '0' })).join('');

  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Visibility</h2>
  <p class="text-xs text-slate-500 mt-0.5">What's currently shown to the public. Each feature keeps its own management page — this is only the public on/off switch.</p>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden overflow-x-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="admin-th" style="width:200px">Feature</th>
        <th class="admin-th">Description</th>
        <th class="admin-th" style="text-align:right;width:90px">Status</th>
      </tr>
    </thead>
    <tbody>
      ${featureRow({
        id: 'vis-papawis-enabled', dataKey: 'papawis_enabled', checked: papawisEnabled, msgId: 'vis-msg-papawis_enabled',
        label: 'Papawis',
        sub: `Pickup game sign-ups (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/papawis</code>). Management stays available either way.`,
      })}
      ${featureRow({
        id: 'vis-marketplace-enabled', dataKey: 'marketplace_enabled', checked: marketplaceEnabled, msgId: 'vis-msg-marketplace_enabled',
        label: 'Marketplace',
        sub: `Admin group-buy listings (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/marketplace</code>). Management stays available either way.`,
      })}
      ${featureRow({
        id: 'vis-posts-enabled', dataKey: 'posts_enabled', checked: postsEnabled, msgId: 'vis-msg-posts_enabled',
        label: 'Posts',
        sub: `League news / matchup previews (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/posts</code>). Management stays available either way.`,
      })}
      ${featureRow({
        id: 'vis-comments-enabled', dataKey: 'comments_enabled', checked: commentsEnabled, msgId: 'vis-msg-comments_enabled',
        label: 'Comments',
        sub: `Registered players can comment and react on any game page. Admins can delete inline either way.`,
      })}
      ${featureRow({
        id: 'vis-peer-ratings-enabled', dataKey: 'peer_ratings_enabled', checked: peerRatingsEnabled, msgId: 'vis-msg-peer_ratings_enabled',
        label: 'Player Ratings',
        sub: `Roast-style player-to-player ratings on <code class="text-[11px] bg-admin-border/50 px-1 rounded">/players/:id</code>. Anonymous ratings are masked to everyone except a super admin.`,
      })}
      ${featureRow({
        id: 'vis-player-reports-enabled', dataKey: 'player_reports_enabled', checked: playerReportsEnabled, msgId: 'vis-msg-player_reports_enabled',
        label: 'Player Reports',
        sub: `Adds a "Report" button on <code class="text-[11px] bg-admin-border/50 px-1 rounded">/players/:id</code>. Needs a majority admin vote to escalate to team heads — see <code class="text-[11px] bg-admin-border/50 px-1 rounded">/admin/fines</code>.`,
      })}
      ${featureRow({
        id: 'vis-awards-enabled', dataKey: 'awards_enabled', checked: awardsEnabled, msgId: 'vis-msg-awards_enabled',
        label: 'Season Awards',
        sub: `Season awards page (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/awards</code>)`,
      })}
    </tbody>
    <tbody id="vis-awards-sections" ${awardsEnabled ? '' : 'hidden'}>
      <tr><td colspan="3" class="admin-td" style="padding:8px 16px 4px;border-bottom:none">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-600">Sections — release daily</span>
      </td></tr>
      ${sectionRows}
      <tr><td colspan="3" class="admin-td" style="border-bottom:none"><span id="vis-section-msg" class="text-xs block min-h-[14px]"></span></td></tr>
    </tbody>
    <tbody>
      ${featureRow({
        id: 'vis-mvp-enabled', dataKey: 'mvp_race_enabled', checked: mvpEnabled, msgId: 'vis-msg-mvp_race_enabled',
        label: 'MVP Race',
        sub: `Season MVP ladder with AI-written player cases (<code class="text-[11px] bg-admin-border/50 px-1 rounded">/mvp</code>)`,
      })}
      ${featureRow({
        id: 'vis-home-roster-moves', dataKey: 'home_show_roster_moves', checked: homeShowRosterMoves, msgId: 'vis-msg-home_show_roster_moves',
        label: 'Homepage: New/Traded',
        sub: `Swaps the homepage's League Leaders carousel for a New/Traded Players one — for early in a season, before there's enough game data for real leaders. Off shows League Leaders as usual (empty if the current season has no games yet).`,
      })}
    </tbody>
  </table>
</div>

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
  bindToggle('vis-marketplace-enabled', 'marketplace_enabled', 'vis-msg-marketplace_enabled');
  bindToggle('vis-posts-enabled',    'posts_enabled',     'vis-msg-posts_enabled');
  bindToggle('vis-comments-enabled', 'comments_enabled',  'vis-msg-comments_enabled');
  bindToggle('vis-peer-ratings-enabled', 'peer_ratings_enabled', 'vis-msg-peer_ratings_enabled');
  bindToggle('vis-player-reports-enabled', 'player_reports_enabled', 'vis-msg-player_reports_enabled');
  bindToggle('vis-awards-enabled',  'awards_enabled',    'vis-msg-awards_enabled');
  bindToggle('vis-mvp-enabled',     'mvp_race_enabled',  'vis-msg-mvp_race_enabled');
  bindToggle('vis-home-roster-moves', 'home_show_roster_moves', 'vis-msg-home_show_roster_moves');

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

  // Sections only show while Season Awards itself is on — collapsed out of the
  // table entirely otherwise, same as the initial server-rendered state.
  var awardsParent = document.getElementById('vis-awards-enabled');
  var sectionsWrap = document.getElementById('vis-awards-sections');
  awardsParent.addEventListener('change', function() {
    sectionsWrap.hidden = !awardsParent.checked;
  });
})();
</script>`;
}
