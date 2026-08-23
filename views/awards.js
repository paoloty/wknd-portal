import { escHtml, pageHeader } from './layout.js';
import { displayPlayerName, teamColor, initials } from './utils.js';

// ── Award badge config ────────────────────────────────────────────────────────
const AWARD_BADGE = {
  mvp:             { label: 'SEASON MVP',       bg: '#f59332', text: '#10141d' },
  dpoy:            { label: 'BEST DEFENDER',    bg: '#3b82f6', text: '#fff'    },
  all_wknd_1:      { label: '1ST TEAM',         bg: '#22c55e', text: '#000'    },
  all_wknd_2:      { label: '2ND TEAM',         bg: '#64748b', text: '#fff'    },
  all_wknd_def:    { label: 'DEF TEAM',         bg: '#3b82f6', text: '#fff'    },
  scoring_champ:   { label: 'SCORING CHAMP',    bg: '#f59332', text: '#10141d' },
  assists_leader:  { label: 'ASSISTS LEADER',   bg: '#f59332', text: '#10141d' },
  rebounds_leader: { label: 'REBOUNDS LEADER',  bg: '#f59332', text: '#10141d' },
  steals_leader:   { label: 'STEALS LEADER',    bg: '#f59332', text: '#10141d' },
  blocks_leader:   { label: 'BLOCKS LEADER',    bg: '#f59332', text: '#10141d' },
  three_pm_leader: { label: '3-PT LEADER',      bg: '#f59332', text: '#10141d' },
  champion:        { label: 'CHAMPION',         bg: '#facc15', text: '#10141d' },
  finals_mvp:      { label: 'FINALS MVP',       bg: '#ef4444', text: '#fff'    },
};

// Roster/leaderboard groups — each becomes a tab with a compact ranked list. (Season
// MVP/DPOY/Finals MVP/Champion are the single-winner spotlight awards and are pinned above
// these tabs as full hero rows instead — see heroRows in awardsPage below.)
const TABS = [
  { key: 'all_wknd_1',   label: 'All-WKND 1st Team',       types: ['all_wknd_1'],   shareKey: 'all_wknd_1'   },
  { key: 'all_wknd_2',   label: 'All-WKND 2nd Team',       types: ['all_wknd_2'],   shareKey: 'all_wknd_2'   },
  { key: 'all_wknd_def', label: 'All-WKND Defensive Team', types: ['all_wknd_def'], shareKey: 'all_wknd_def' },
  { key: 'stat_leaders', label: 'Statistical Leaders',     types: ['scoring_champ', 'assists_leader', 'rebounds_leader', 'steals_leader', 'blocks_leader', 'three_pm_leader'], shareKey: 'stat-leaders' },
];

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POSITION_ORDER = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));
const TEAM_AWARD_TYPES = new Set(['all_wknd_1', 'all_wknd_2', 'all_wknd_def', 'champion']);

// ── Stat helpers ──────────────────────────────────────────────────────────────
function statLine(row, type) {
  const gp  = row.games_played || 1;
  const avg = v => v != null ? (v / gp).toFixed(1) : null;
  const parts =
    (type === 'mvp' || type === 'all_wknd_1' || type === 'all_wknd_2' || type === 'finals_mvp')
      ? [avg(row.pts) && `${avg(row.pts)} PPG`, avg(row.reb) && `${avg(row.reb)} RPG`, avg(row.ast) && `${avg(row.ast)} APG`]
    : (type === 'dpoy' || type === 'all_wknd_def')
      ? [avg(row.stl) && `${avg(row.stl)} SPG`, avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'scoring_champ'   ? [avg(row.pts) && `${avg(row.pts)} PPG`]
    : type === 'assists_leader'  ? [avg(row.ast) && `${avg(row.ast)} APG`]
    : type === 'rebounds_leader' ? [avg(row.reb) && `${avg(row.reb)} RPG`]
    : type === 'steals_leader'   ? [avg(row.stl) && `${avg(row.stl)} SPG`]
    : type === 'blocks_leader'   ? [avg(row.blk) && `${avg(row.blk)} BPG`]
    : type === 'three_pm_leader' ? [avg(row.fg3m) && `${avg(row.fg3m)} 3PM`]
    : [];
  return parts.filter(Boolean).join(' · ');
}

// ── Hero row (pinned, always visible) ──────────────────────────────────────────
// Season MVP/DPOY/Finals MVP/Champion — one spotlight-sized row per winner, photo-left.
// This .awd-hero-row family is now the shared "spotlight winner" component — the MVP race
// page (views/mvp.js) reuses it for its own top-3 hero tier rather than duplicating it.
function heroRow(row, type, article, season) {
  const name  = displayPlayerName(row.player_name || '');
  const color = teamColor(String(row.team_name || '').toUpperCase());
  const init  = initials(row.player_name || '');
  const badge = AWARD_BADGE[type] || { label: type.toUpperCase(), bg: '#f59332', text: '#10141d' };
  const href  = `/players/${encodeURIComponent(row.player_id)}`;
  const stats = statLine(row, type);
  const shareHref = `/awards/share/${encodeURIComponent(season)}/${encodeURIComponent(type)}/${encodeURIComponent(row.player_id)}`;

  return `<div class="awd-hero-wrap">
  <a href="${href}" class="awd-hero-row">
    <div class="awd-hero-row__thumb">
      <div class="awd-hero-row__thumb-placeholder"><span class="font-condensed">${escHtml(init)}</span></div>
      <img class="awd-hero-row__thumb-img" src="/api/player/${encodeURIComponent(row.player_id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="awd-hero-row__thumb-flare" style="background:linear-gradient(135deg,${color}44 0%,transparent 55%)"></div>
    </div>
    <div class="awd-hero-row__body" style="background:linear-gradient(135deg,${color}12 0%,transparent 50%)">
      <span class="awd-hero-row__badge" style="background:${badge.bg};color:${badge.text}">${escHtml(badge.label)}</span>
      <div class="awd-hero-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</div>
      ${stats   ? `<p class="awd-hero-row__stats">${escHtml(stats)}</p>` : ''}
      ${article ? `<p class="awd-hero-row__article">${escHtml(article)}</p>` : ''}
      <span class="awd-hero-row__cta">Full stats <span>&rarr;</span></span>
    </div>
  </a>
  <button type="button" class="awd-share-btn" onclick="wkndShareFb('${shareHref}',this)" aria-label="Copy share link">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  </button>
</div>`;
}

// ── Ranked row (tab content) ───────────────────────────────────────────────────
// Compact single-line row for roster/leaderboard groups — leading chip shows position
// (All-WKND rows) or falls back to the award label (Stat Leaders, which don't have one).
// The row itself is a "stretched link" to the player's profile (see .awd-rank-row__link,
// same trick as .game-row__link in views/games.js) rather than an <a> wrapping everything,
// specifically so the writeup toggle button can be a real interactive element instead of
// nesting a <button> inside an <a> (invalid HTML, unreliable clicks). Rows with no writeup
// just render without the toggle/panel — nothing to expand.
function rankRow(row, type, article) {
  const name  = displayPlayerName(row.player_name || '');
  const color = teamColor(String(row.team_name || '').toUpperCase());
  const badge = AWARD_BADGE[type] || { label: type.toUpperCase(), bg: '#f59332', text: '#10141d' };
  const href  = `/players/${encodeURIComponent(row.player_id)}`;
  const stats = statLine(row, type);
  const pos   = POSITIONS.includes(row.notes) ? row.notes : null;
  const chip  = pos || badge.label;

  const toggle = article
    ? `<button type="button" class="awd-rank-row__toggle" data-action="toggle-writeup" aria-expanded="false" aria-label="Read writeup">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>`
    : '';
  const writeup = article ? `<div class="awd-rank-writeup" hidden><p>${escHtml(article)}</p></div>` : '';

  return `<div class="awd-rank-row">
  <a href="${href}" class="awd-rank-row__link" aria-label="${escHtml(name)}"></a>
  <span class="awd-rank-row__avatar" style="border-color:${color}">
    <span class="font-condensed">${escHtml(initials(row.player_name || ''))}</span>
    <img class="awd-rank-row__avatar-img" src="/api/player/${encodeURIComponent(row.player_id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
  </span>
  <span class="awd-rank-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</span>
  <span class="awd-rank-row__chip" style="background:${badge.bg};color:${badge.text}">${escHtml(chip)}</span>
  <span class="awd-rank-row__stat">${escHtml(stats)}</span>
  ${toggle}
</div>
${writeup}`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function awardsPage({ awards = [], season, availableSeasons = [], visibleSections = new Set(), articles = {} }) {
  const byType = {};
  for (const row of awards) (byType[row.award_type] ??= []).push(row);

  for (const type of ['all_wknd_1', 'all_wknd_2', 'all_wknd_def']) {
    if (byType[type]) {
      byType[type].sort((a, b) => (POSITION_ORDER[a.notes] ?? 99) - (POSITION_ORDER[b.notes] ?? 99));
    }
  }

  const seasonSelector = availableSeasons.length > 1
    ? `<div class="awd-season-tabs">${availableSeasons.map(s =>
        `<a href="/awards?season=${encodeURIComponent(s)}" class="awd-season-tab${s === season ? ' is-active' : ''}">Season ${escHtml(String(s))}</a>`
      ).join('')}</div>`
    : '';

  // Hero section: mvp, dpoy, finals_mvp in that order, then every champion (a full roster,
  // not a single winner) — each still gets its own spotlight row rather than being
  // compressed into a list, since celebrating the champions is the point of the section.
  const heroRows = [];
  for (const type of ['mvp', 'dpoy', 'finals_mvp']) {
    if (!visibleSections.has(type) || !byType[type]?.length) continue;
    heroRows.push(...byType[type].map((row, i) => heroRow(row, type, i === 0 ? (articles[type] || '') : '', season)));
  }
  if (visibleSections.has('champion') && byType.champion?.length) {
    heroRows.push(...byType.champion.map(row => heroRow(row, 'champion', articles[`champion_${row.player_id}`] || '', season)));
  }

  const tabsWithContent = TABS.map(tab => {
    const isStatGroup = tab.key === 'stat_leaders';
    const groupVisible = isStatGroup ? tab.types.some(t => visibleSections.has(t)) : visibleSections.has(tab.types[0]);
    const rows = tab.types.flatMap(type => {
      if (!groupVisible || !byType[type]?.length) return [];
      const isTeam = TEAM_AWARD_TYPES.has(type);
      return byType[type].map((row, i) => {
        const article = isTeam
          ? (articles[`${type}_${row.player_id}`] || '')
          : (i === 0 ? (articles[type] || '') : '');
        return rankRow(row, type, article);
      });
    });
    return { ...tab, rows };
  }).filter(t => t.rows.length);

  if (!heroRows.length && !tabsWithContent.length) {
    return `<div class="page-content">
${pageHeader({ title: 'Awards', description: 'Season honors, All-WKND teams, and statistical leaders.' })}
  ${seasonSelector}
  <div class="card" style="padding:60px 24px;text-align:center;color:var(--text-muted)">
    Awards have not been announced yet. Check back soon.
  </div>
</div>`;
  }

  const heroSection = heroRows.length ? `<div class="awd-hero-section">${heroRows.join('')}</div>` : '';

  const shareBtnHtml = (shareKey) => shareKey
    ? `<button type="button" class="mvp-card-share-btn" onclick="wkndShareFb('/awards/share/${encodeURIComponent(season)}/${encodeURIComponent(shareKey)}',this)" aria-label="Copy share link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>`
    : '';

  const tabsSection = tabsWithContent.length ? `
  <div class="awd-tabs-row">
    <div class="awd-tabs">
      ${tabsWithContent.map((t, i) => `<button type="button" class="awd-tab${i === 0 ? ' is-active' : ''}" data-tab="${t.key}">${escHtml(t.label)} (${t.rows.length})</button>`).join('')}
    </div>
    <div class="awd-tabs-share">
      ${tabsWithContent.map((t, i) => `<span data-share-for="${t.key}"${i === 0 ? '' : ' hidden'}>${shareBtnHtml(t.shareKey)}</span>`).join('')}
    </div>
  </div>
  ${tabsWithContent.map((t, i) => `
  <div class="awd-tab-panel" data-panel="${t.key}"${i === 0 ? '' : ' hidden'}>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="awd-rank-list">${t.rows.join('')}</div>
    </div>
  </div>`).join('')}` : '';

  const shareScript = `<script>
function wkndShareFb(path, btn) {
  var url = location.origin + path;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.resolve(document.execCommand('copy', true, url)))
    .then(function() {
      var orig = btn.innerHTML;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      btn.disabled = true;
      setTimeout(function(){ btn.innerHTML = orig; btn.disabled = false; }, 2000);
    })
    .catch(function() {
      window.prompt('Copy this link and paste into Facebook:', url);
    });
}
(function() {
  document.querySelectorAll('.awd-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.awd-tab').forEach(function(t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var target = tab.dataset.tab;
      document.querySelectorAll('.awd-tab-panel').forEach(function(p) { p.hidden = p.dataset.panel !== target; });
      document.querySelectorAll('.awd-tabs-share [data-share-for]').forEach(function(s) { s.hidden = s.dataset.shareFor !== target; });
    });
  });

  document.querySelectorAll('.awd-rank-row__toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = btn.closest('.awd-rank-row');
      var panel = row && row.nextElementSibling;
      if (!panel || !panel.classList.contains('awd-rank-writeup')) return;
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      row.classList.toggle('is-expanded', !expanded);
    });
  });
})();
</script>`;

  return `<div class="page-content">
${pageHeader({ title: 'Awards', description: 'Season honors, All-WKND teams, and statistical leaders.' })}
  ${seasonSelector}
  ${heroSection}
  ${tabsSection}
</div>
${shareScript}`;
}
