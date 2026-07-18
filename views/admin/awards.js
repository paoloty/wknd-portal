import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor, initials } from '../utils.js';

const ICON_CHECK = `<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_X     = `<svg width="10" height="10" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/></svg>`;
const ICON_EDIT  = `<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2l2 2-6.5 6.5L2 11l.5-2.5z"/></svg>`;
const ICON_SPARK = `<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M3 3l1.5 1.5M8.5 8.5L10 10M3 10l1.5-1.5M8.5 4.5L10 3"/><circle cx="6.5" cy="6.5" r="2"/></svg>`;
const ICON_RETRY = `<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.5"/><path d="M8 1v3h3"/></svg>`;

const AWARD_LABELS = {
  mvp:             'Season MVP',
  dpoy:            'Best Defender',
  all_wknd_1:      'All WKND 1st Team',
  all_wknd_2:      'All WKND 2nd Team',
  all_wknd_def:    'All WKND Defensive Team',
  scoring_champ:   'Scoring Champion',
  assists_leader:  'Assists Leader',
  rebounds_leader: 'Rebounds Leader',
  steals_leader:   'Steals Leader',
  blocks_leader:   'Blocks Leader',
  three_pm_leader: '3-Pointers Leader',
};

const TEAM_TYPES     = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def']);
const POSITION_ORDER = Object.fromEntries(['PG','SG','SF','PF','C'].map((p,i) => [p,i]));

const AWARD_GROUPS = [
  { label: 'Season Awards',            types: ['mvp', 'dpoy'],                                       col: 'award' },
  { label: 'All WKND 1st Team',       types: ['all_wknd_1'],                                        col: 'pos'   },
  { label: 'All WKND 2nd Team',       types: ['all_wknd_2'],                                        col: 'pos'   },
  { label: 'All WKND Defensive Team', types: ['all_wknd_def'],                                      col: 'pos'   },
  { label: 'Statistical Leaders',     types: ['scoring_champ', 'assists_leader', 'rebounds_leader', 'steals_leader', 'blocks_leader', 'three_pm_leader'], col: 'award' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatar(pid, pname) {
  const init = initials(pname || '');
  return `<div class="awd-av">
  <span class="awd-av__init">${escHtml(init)}</span>
  <img src="/api/player/${encodeURIComponent(pid)}/photo" alt="" loading="lazy" class="awd-av__img" onerror="this.style.display='none'">
</div>`;
}

function stat(v) {
  return v != null
    ? `<span class="font-saira-sm" style="color:var(--text)">${v}</span>`
    : `<span style="color:var(--border)">—</span>`;
}

function getStats(entry, isConf, statsMap = {}) {
  if (isConf) {
    const pid = entry.player_id;
    const s   = statsMap[pid];
    if (s?.games_played) {
      const gp = s.games_played;
      return { gp, ppg: (s.pts/gp).toFixed(1), rpg: (s.reb/gp).toFixed(1), apg: (s.ast/gp).toFixed(1) };
    }
  }
  if (!isConf) {
    return { gp: entry.player?.games_played ?? null, ppg: entry.ppg ?? null, rpg: entry.rpg ?? null, apg: entry.apg ?? null };
  }
  return { gp: null, ppg: null, rpg: null, apg: null };
}

// ── Row builder ───────────────────────────────────────────────────────────────

function playerRow({ rowId, pid, pname, tname, type, awdId, isConf, stats, col, colVal, withArticle, article, articleKey, articlePid }) {
  const aKey = articleKey || type;
  const aPid = articlePid || '';
  const name   = displayPlayerName(pname || '');
  const color  = teamColor(String(tname || '').toUpperCase());
  const team   = String(tname || '').toUpperCase();
  const s      = stats;

  const statusBg    = isConf ? 'rgba(34,197,94,.12)'  : 'rgba(245,147,50,.12)';
  const statusColor = isConf ? '#22c55e' : '#f59332';
  const statusLabel = isConf ? 'Confirmed' : 'Suggested';

  return `<tr class="awd-tr" id="awd-row-${escHtml(rowId)}">
  <td class="awd-td awd-td--name">
    <div style="display:flex;align-items:center;gap:9px">
      ${avatar(pid, pname)}
      <div>
        <div style="display:flex;align-items:center;gap:5px">
          <span class="team-dot" style="background:${color}"></span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(name)}</span>
        </div>
        <span style="font-size:10px;color:var(--text-muted);letter-spacing:.04em">${escHtml(team)}</span>
      </div>
    </div>
  </td>
  <td class="awd-td" style="white-space:nowrap">
    <span style="font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--text-muted)">${escHtml(colVal || '—')}</span>
  </td>
  <td class="awd-td text-right">${stat(s.ppg)}</td>
  <td class="awd-td text-right">${stat(s.rpg)}</td>
  <td class="awd-td text-right">${stat(s.apg)}</td>
  <td class="awd-td text-right">${stat(s.gp)}</td>
  <td class="awd-td">
    <span class="awd-status" style="background:${statusBg};color:${statusColor};border-color:${statusColor}33">${statusLabel}</span>
  </td>
  <td class="awd-td awd-td--actions">
    ${!isConf ? `<button class="awd-action awd-action--confirm" title="Confirm" data-confirm-solo="${escHtml(type)}" data-confirm-pid="${escHtml(pid)}">${ICON_CHECK}</button>` : ''}
    <button class="awd-action" title="Change player" data-toggle-picker="${escHtml(rowId)}" data-award-type="${escHtml(type)}" data-confirmed-id="${escHtml(awdId || '')}" data-pid="${escHtml(pid)}">${ICON_EDIT}</button>
    ${isConf && awdId ? `<button class="awd-action awd-action--danger" title="Remove" data-remove-id="${escHtml(awdId)}">${ICON_X}</button>` : ''}
    ${withArticle && isConf ? `<button class="awd-action" title="Article" data-toggle-article="${escHtml(aKey)}">${ICON_SPARK}</button>` : ''}
  </td>
</tr>
<tr id="awd-picker-${escHtml(rowId)}" style="display:none">
  <td colspan="8" class="awd-td-sub">
    <div style="display:flex;gap:8px;align-items:center">
      <select class="admin-input" style="flex:1;max-width:300px" data-picker-select="${escHtml(rowId)}" data-award-type="${escHtml(type)}"><option>Loading…</option></select>
      <button class="agm-new-btn" style="height:28px;font-size:11px;padding:0 12px" data-picker-save="${escHtml(rowId)}" data-award-type="${escHtml(type)}">${ICON_CHECK} Set</button>
      <span id="picker-msg-${escHtml(rowId)}" class="text-xs"></span>
    </div>
  </td>
</tr>
${withArticle ? `<tr id="awd-article-${escHtml(aKey)}" style="display:none">
  <td colspan="8" class="awd-td-sub">
    <textarea id="article-ta-${escHtml(aKey)}" class="admin-input w-full" rows="3" style="font-size:12px;line-height:1.6;resize:vertical" placeholder="Generated article…">${escHtml(article || '')}</textarea>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="admin-btn admin-btn--sm" data-save-article="${escHtml(aKey)}">${ICON_CHECK} Save</button>
      <button class="admin-btn admin-btn--sm" data-gen-article="${escHtml(aKey)}" data-award-type="${escHtml(type)}" data-player-id="${escHtml(aPid)}">${ICON_RETRY} Generate</button>
      <span id="article-msg-${escHtml(aKey)}" class="text-xs"></span>
    </div>
  </td>
</tr>` : ''}`;
}

function emptyRow(colspan = 8) {
  return `<tr><td colspan="${colspan}" class="awd-td" style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px">No data yet.</td></tr>`;
}

// ── Group card ────────────────────────────────────────────────────────────────

function groupCard({ label, types, col, byType, suggestions, articles, statsMap }) {
  const isTeamGroup = types.some(t => TEAM_TYPES.has(t));

  // Show Confirm All button when any team type still has unconfirmed suggestions remaining.
  const unconfirmedTeam = isTeamGroup && types.some(t => {
    const confirmedIds = new Set((byType[t] || []).map(e => e.player_id));
    return Array.isArray(suggestions[t]) && suggestions[t].some(e => !confirmedIds.has(e.player.id));
  });

  const colHeader = col === 'award' ? 'Award' : 'Pos';

  const rows = types.flatMap(type => {
    const confirmed = byType[type] || [];
    const isConf    = confirmed.length > 0;
    const isTeam    = TEAM_TYPES.has(type);

    if (isTeam) {
      // Show confirmed entries first, then fill remaining slots with unconfirmed suggestions.
      const confirmedSorted = [...confirmed].sort((a,b) => (POSITION_ORDER[a.notes]??99) - (POSITION_ORDER[b.notes]??99));
      const confirmedIds    = new Set(confirmed.map(e => e.player_id));
      const remainingSugg   = Array.isArray(suggestions[type])
        ? suggestions[type].filter(e => !confirmedIds.has(e.player.id))
        : [];
      const fullList = [...confirmedSorted, ...remainingSugg].slice(0, 5);

      if (!fullList.length) return [emptyRow()];

      return fullList.map((entry, i) => {
        const isEntryConf = 'player_id' in entry;
        const pid         = isEntryConf ? entry.player_id   : entry.player.id;
        const pname       = isEntryConf ? entry.player_name  : entry.player.name;
        const tname       = isEntryConf ? entry.team_name    : entry.player.team_name;
        const awdId       = isEntryConf ? entry.id : '';
        const pos         = isEntryConf ? (entry.notes || '') : (entry.position || '');
        const rowId       = `${type}-${i+1}`;
        const articleKey  = `${type}_${pid}`;
        const stats       = isEntryConf ? getStats(entry, true, statsMap) : getStats(entry, false, statsMap);
        return playerRow({ rowId, pid, pname, tname, type, awdId, isConf: isEntryConf, stats, col, colVal: pos, withArticle: true, article: articles[articleKey] || '', articleKey, articlePid: pid });
      });
    } else {
      const winner = confirmed[0] || null;
      const sugg   = suggestions[type] || null;
      const entry  = winner || sugg?.player || null;
      if (!entry) return [emptyRow()];

      const isConfSolo = !!winner;
      const pid    = isConfSolo ? winner.player_id   : sugg.player.id;
      const pname  = isConfSolo ? winner.player_name  : sugg.player.name;
      const tname  = isConfSolo ? winner.team_name    : sugg.player.team_name;
      const awdId  = isConfSolo ? winner.id : '';
      const rowId  = type;
      const stats  = isConfSolo ? getStats(winner, true, statsMap) : getStats(sugg, false, statsMap);
      const colVal = col === 'award' ? AWARD_LABELS[type] : '';
      const article = articles[type] || '';
      return [playerRow({ rowId, pid, pname, tname, type, awdId, isConf: isConfSolo, stats, col, colVal, withArticle: true, article })];
    }
  });

  const hasAnyConfirmed = isTeamGroup && types.some(t => byType[t]?.length > 0);

  const confirmAllBtn = unconfirmedTeam
    ? `<button class="agm-new-btn" style="height:26px;font-size:11px;padding:0 12px" data-confirm-team="${escHtml(types[0])}">${ICON_CHECK} Confirm</button>`
    : '';

  const resuggestBtn = hasAnyConfirmed
    ? `<button style="display:flex;align-items:center;gap:5px;height:26px;padding:0 12px;font-size:11px;font-weight:700;font-family:inherit;background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:8px;cursor:pointer;white-space:nowrap" data-resuggest-team="${escHtml(types[0])}">${ICON_RETRY} Auto-suggest</button>`
    : '';

  return `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-4">
  <div class="card-label card-label--admin" style="padding:10px 16px">
    ${escHtml(label.toUpperCase())}
    <div style="display:flex;gap:6px">${confirmAllBtn}${resuggestBtn}</div>
  </div>
  <div style="overflow-x:auto">
    <table class="w-full border-collapse has-col-dividers has-freeze-col">
      <thead>
        <tr>
          <th class="awd-th" style="text-align:left;width:220px;min-width:220px">Player</th>
          <th class="awd-th" style="text-align:left">${escHtml(colHeader)}</th>
          <th class="awd-th">PPG</th>
          <th class="awd-th">RPG</th>
          <th class="awd-th">APG</th>
          <th class="awd-th">GP</th>
          <th class="awd-th" style="text-align:left">Status</th>
          <th class="awd-th"></th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function adminAwardsBody({ season, seasons = [], awards = [], suggestions = {}, players = [], articles = {}, seasonStats = [] }) {
  const byType   = {};
  for (const row of awards) (byType[row.award_type] ??= []).push(row);
  const statsMap = Object.fromEntries(seasonStats.map(s => [s.id, s]));

  const seasonTabs = seasons.length > 1
    ? `<div class="flex gap-2 mb-5 flex-wrap">${seasons.map(s =>
        `<a href="/admin/awards?season=${s}" class="agm-pill${s === season ? ' is-active' : ''}">Season ${escHtml(String(s))}</a>`
      ).join('')}</div>`
    : '';

  const playerOptsJson = JSON.stringify(players.map(p => ({ id: p.id, name: p.name, team: p.team_id })));

  const cards = AWARD_GROUPS.map(g => groupCard({ ...g, byType, suggestions, articles, statsMap })).join('');

  return `
<style>
.awd-th {
  padding: 8px 12px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--admin-border, #1e293b);
  text-align: right;
  white-space: nowrap;
}
.awd-td {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid rgba(30,41,59,.5);
  vertical-align: middle;
  text-align: right;
}
.awd-tr:last-of-type .awd-td,
.awd-tr:last-of-type .awd-td-sub { border-bottom: none; }
.awd-td--name { text-align: left; width: 220px; min-width: 220px; max-width: 220px; }
.awd-td-sub {
  padding: 8px 16px 14px;
  border-bottom: 1px solid rgba(30,41,59,.5);
  background: var(--surface-2, #0d1424);
}
.awd-td--actions { text-align: right; white-space: nowrap; }
.awd-av {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--border, #1e293b);
  position: relative; overflow: hidden; flex-shrink: 0;
}
.awd-av__init {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 800; color: var(--text-muted);
  font-family: 'Saira Condensed', sans-serif;
}
.awd-av__img {
  position: absolute; inset: 0;
  width: 100%; height: 100%; object-fit: cover;
}
.awd-status {
  display: inline-block;
  font-size: 9px; font-weight: 700; letter-spacing: .07em;
  text-transform: uppercase;
  padding: 2px 7px; border-radius: 4px;
  border: 1px solid transparent;
}
.awd-action {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 5px;
  border: 1px solid transparent;
  background: none; cursor: pointer;
  color: var(--text-muted);
  transition: background .12s, color .12s, border-color .12s;
}
.awd-action:hover { background: rgba(255,255,255,.06); border-color: var(--admin-border, #1e293b); color: var(--text); }
.awd-action--confirm:hover { color: #22c55e; border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.08); }
.awd-action--danger:hover  { color: #f87171; border-color: rgba(248,113,113,.35); background: rgba(248,113,113,.08); }
</style>

<div class="mb-5 flex items-center justify-between">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Season Awards</h2>
  <span style="font-size:12px;color:var(--text-muted)">Season ${escHtml(String(season))}</span>
</div>
${seasonTabs}
${cards}

<script>
var SEASON = ${season};
var ALL_PLAYERS = ${playerOptsJson};

function buildOpts(selectedId) {
  var byTeam = {};
  ALL_PLAYERS.forEach(function(p) { (byTeam[p.team] = byTeam[p.team] || []).push(p); });
  var html = '<option value="">— select player —</option>';
  Object.keys(byTeam).sort().forEach(function(tid) {
    html += '<optgroup label="' + tid + '">';
    byTeam[tid].forEach(function(p) {
      html += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + p.name + '</option>';
    });
    html += '</optgroup>';
  });
  return html;
}

// ── Picker toggle ─────────────────────────────────────────────────────────────
document.querySelectorAll('[data-toggle-picker]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var rowId = this.dataset.togglePicker;
    var pid   = this.dataset.pid;
    var el    = document.getElementById('awd-picker-' + rowId);
    var sel   = el && el.querySelector('[data-picker-select]');
    if (sel && !sel.dataset._populated) {
      sel.innerHTML = buildOpts(pid);
      sel.dataset._populated = '1';
    }
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  });
});

// ── Picker save ───────────────────────────────────────────────────────────────
document.querySelectorAll('[data-picker-save]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    var rowId = this.dataset.pickerSave;
    var type  = this.dataset.awardType;
    var sel   = document.querySelector('[data-picker-select="' + rowId + '"]');
    var msg   = document.getElementById('picker-msg-' + rowId);
    if (!sel || !sel.value) { if (msg) { msg.textContent = 'Select a player'; msg.style.color = '#f87171'; } return; }
    var orig = this.innerHTML; this.disabled = true; this.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/awards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, award_type: type, player_id: sel.value, clear_first: true })
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) {
      if (msg) { msg.textContent = 'Error'; msg.style.color = '#f87171'; }
      this.disabled = false; this.innerHTML = orig;
    }
  });
});

// ── Confirm solo ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-confirm-solo]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    var type = this.dataset.confirmSolo;
    var pid  = this.dataset.confirmPid;
    var orig = this.innerHTML; this.disabled = true; this.textContent = '…';
    try {
      var r = await fetch('/admin/awards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, award_type: type, player_id: pid, clear_first: true })
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) { this.disabled = false; this.innerHTML = orig; }
  });
});

// ── Confirm team ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-confirm-team]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    var type = this.dataset.confirmTeam;
    var orig = this.innerHTML; this.disabled = true; this.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/awards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, award_type: type, from_suggestion: true })
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) { this.disabled = false; this.innerHTML = orig; }
  });
});

// ── Re-suggest team ───────────────────────────────────────────────────────────
document.querySelectorAll('[data-resuggest-team]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    if (!confirm('Clear all confirmed picks and revert to auto-suggestions?')) return;
    var type = this.dataset.resuggestTeam;
    var orig = this.innerHTML; this.disabled = true; this.textContent = 'Clearing…';
    try {
      var r = await fetch('/admin/awards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, award_type: type, clear_only: true })
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) { this.disabled = false; this.innerHTML = orig; }
  });
});

// ── Remove ────────────────────────────────────────────────────────────────────
document.querySelectorAll('[data-remove-id]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    if (!confirm('Remove this award?')) return;
    var orig = this.innerHTML; this.disabled = true; this.innerHTML = '…';
    try {
      var r = await fetch('/admin/awards/' + encodeURIComponent(this.dataset.removeId), { method: 'DELETE' });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) { this.disabled = false; this.innerHTML = orig; }
  });
});

// ── Article toggle ────────────────────────────────────────────────────────────
document.querySelectorAll('[data-toggle-article]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var el = document.getElementById('awd-article-' + this.dataset.toggleArticle);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  });
});

// ── Generate article ──────────────────────────────────────────────────────────
document.querySelectorAll('[data-gen-article]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    var aKey   = this.dataset.genArticle;
    var aType  = this.dataset.awardType || aKey;
    var aPid   = this.dataset.playerId || '';
    var ta     = document.getElementById('article-ta-' + aKey);
    var msg    = document.getElementById('article-msg-' + aKey);
    var orig = this.innerHTML;
    if (ta) ta.value = 'Writing…';
    this.disabled = true; this.textContent = 'Generating…';
    try {
      var payload = { season: SEASON, award_type: aType };
      if (aPid) payload.player_id = aPid;
      var r = await fetch('/admin/awards/generate-article', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var d = await r.json();
      if (!r.ok || !d.text) throw new Error(d.error || 'No response');
      if (ta) ta.value = d.text;
      if (msg) { msg.style.color = 'var(--text-muted)'; msg.textContent = 'Generated — save to publish'; }
    } catch(e) {
      if (ta) ta.value = '';
      if (msg) { msg.style.color = '#f87171'; msg.textContent = e.message || 'Error'; }
    }
    this.disabled = false; this.innerHTML = orig;
  });
});

// ── Save article ──────────────────────────────────────────────────────────────
document.querySelectorAll('[data-save-article]').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    var aKey = this.dataset.saveArticle;
    var ta   = document.getElementById('article-ta-' + aKey);
    var msg  = document.getElementById('article-msg-' + aKey);
    var orig = this.innerHTML; this.disabled = true; this.textContent = 'Saving…';
    try {
      var body = {};
      body['award_article_' + aKey + '_' + SEASON] = ta ? ta.value : '';
      var r = await fetch('/admin/site/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error();
      if (msg) { msg.style.color = '#22c55e'; msg.textContent = 'Saved.'; setTimeout(function(){ msg.textContent=''; }, 2500); }
    } catch(e) {
      if (msg) { msg.style.color = '#f87171'; msg.textContent = 'Error saving.'; }
    }
    this.disabled = false; this.innerHTML = orig;
  });
});
</script>`;
}
