import { escHtml, pageHeader } from './layout.js';
import { displayPlayerName, teamColor, initials } from './utils.js';

const RANK_LABELS = ['', 'FRONTRUNNER', 'CLOSE SECOND', 'IN THE MIX', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE', 'DARK HORSE'];

const BADGE_COLORS = [
  null,
  { bg: '#f59332', text: '#10141d' }, // 1 — FRONTRUNNER  (amber)
  { bg: '#3b82f6', text: '#fff' },    // 2 — CLOSE SECOND (blue)
  { bg: '#8b5cf6', text: '#fff' },    // 3 — IN THE MIX   (purple)
  { bg: '#374151', text: '#9ca3af' }, // 4+ — DARK HORSE  (slate)
];

// Admin-only, hidden once playoffs lock every writeup — reused verbatim on both the hero
// and compact tail rows (regenScript below binds to every .mvp-regen-btn regardless of
// which tier it's rendered in).
function regenBtn(playerId, season, isAdmin, playoffsStarted, { absolute = false } = {}) {
  if (!isAdmin || playoffsStarted) return '';
  const pos = absolute
    ? 'position:absolute;top:10px;right:10px;z-index:2;'
    : 'position:relative;height:22px;';
  return `<button class="mvp-regen-btn" data-pid="${escHtml(String(playerId))}" data-season="${escHtml(String(season))}" title="Regenerate writeup" style="${pos}background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);color:#94a3b8;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">↺</button>`;
}

// ── Hero row (pinned, top 3 — Frontrunner/Close Second/In the Mix) ─────────────
// Same awd-hero-row family the Awards page uses for its own spotlight winners (see
// views/awards.js) — reused directly rather than duplicated, since this is now the shared
// "spotlight winner" component across both pages. Score is folded into the stats line
// (awd-hero-row has no dedicated score-pill slot the way the old .mvp-row did).
function mvpHeroRow(c, rank, isAdmin, season, playoffsStarted) {
  const { player, stats, mvpScore, writeup } = c;
  const name  = displayPlayerName(player.name);
  const color = teamColor(stats.team_name);
  const label = RANK_LABELS[rank] || 'CONTENDER';
  const badge = BADGE_COLORS[rank] || BADGE_COLORS[4];
  const init  = initials(player.name);
  const href  = `/players/${encodeURIComponent(String(player.id))}`;
  const gp    = stats.gp || 1;
  const statsLine = `${mvpScore.toFixed(1)} SCORE · ${(stats.pts/gp).toFixed(1)} PPG · ${(stats.reb/gp).toFixed(1)} RPG · ${(stats.ast/gp).toFixed(1)} APG`;

  return `<div class="awd-hero-wrap">
  <a href="${href}" class="awd-hero-row">
    <div class="awd-hero-row__thumb">
      <div class="awd-hero-row__thumb-placeholder"><span class="font-condensed">${escHtml(init)}</span></div>
      <img class="awd-hero-row__thumb-img" src="/api/player/${encodeURIComponent(String(player.id))}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="awd-hero-row__thumb-flare" style="background:linear-gradient(135deg,${color}44 0%,transparent 55%)"></div>
    </div>
    <div class="awd-hero-row__body" style="background:linear-gradient(135deg,${color}12 0%,transparent 50%)">
      <span class="awd-hero-row__badge" style="background:${badge.bg};color:${badge.text}">${escHtml(label)}</span>
      <div class="awd-hero-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</div>
      <p class="awd-hero-row__stats">${escHtml(statsLine)}</p>
      ${writeup
        ? `<p class="awd-hero-row__article">${escHtml(writeup)}</p>`
        : `<p class="awd-hero-row__article" style="opacity:.6">Analysis generating…</p>`}
      <span class="awd-hero-row__cta">Full stats <span>&rarr;</span></span>
    </div>
  </a>
  ${regenBtn(player.id, season, isAdmin, playoffsStarted, { absolute: true })}
</div>`;
}

// ── Ranked row (compact tail — everyone past the top 3) ────────────────────────
// Same awd-rank-row family Awards uses for its roster/leaderboard tabs — the long dark-horse
// pack reads as a scannable list instead of 7-10 more full-size spotlight cards. Chip shows
// the numeric rank (the "DARK HORSE" label is identical for all of them past #3, so it
// wouldn't tell the admin anything a repeated badge doesn't already).
function mvpRankRow(c, rank, isAdmin, season, playoffsStarted) {
  const { player, stats, mvpScore, writeup } = c;
  const name  = displayPlayerName(player.name);
  const color = teamColor(stats.team_name);
  const init  = initials(player.name);
  const href  = `/players/${encodeURIComponent(String(player.id))}`;
  const dark  = BADGE_COLORS[4];

  const toggle = writeup
    ? `<button type="button" class="awd-rank-row__toggle" data-action="toggle-writeup" aria-expanded="false" aria-label="Read writeup">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>`
    : '';
  const writeupPanel = writeup ? `<div class="awd-rank-writeup" hidden><p>${escHtml(writeup)}</p></div>` : '';

  return `<div class="awd-rank-row">
  <a href="${href}" class="awd-rank-row__link" aria-label="${escHtml(name)}"></a>
  <span class="awd-rank-row__avatar" style="border-color:${color}">
    <span class="font-condensed">${escHtml(init)}</span>
    <img class="awd-rank-row__avatar-img" src="/api/player/${encodeURIComponent(String(player.id))}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
  </span>
  <span class="awd-rank-row__name"><span class="team-dot" style="background:${color}"></span>${escHtml(name)}</span>
  <span class="awd-rank-row__chip" style="background:${dark.bg};color:${dark.text}">#${rank}</span>
  <span class="awd-rank-row__stat">${mvpScore.toFixed(1)}</span>
  ${regenBtn(player.id, season, isAdmin, playoffsStarted)}
  ${toggle}
</div>
${writeupPanel}`;
}

export function mvpPage({ candidates = [], season, totalGames, seasonGames, isAdmin = false, playoffsStarted = false }) {
  if (!candidates.length) {
    return `<div class="page-content">
${pageHeader({ title: 'MVP Race', description: 'Tracking the top MVP candidates as the season unfolds.' })}
  <div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No games played yet this season.</div>
</div>`;
  }

  const hasAllWriteups = candidates.every(c => c.writeup);
  const heroCandidates = candidates.slice(0, 3);
  const restCandidates = candidates.slice(3);

  const regenAllBtn = isAdmin && !playoffsStarted
    ? `<button id="mvp-regen-all" data-season="${escHtml(String(season))}" style="background:transparent;border:1px solid rgba(255,255,255,.12);color:#64748b;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer">↺ Regenerate All</button>`
    : '';
  const finalBadge = playoffsStarted
    ? `<span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#f59332;background:rgba(245,147,50,.12);border:1px solid rgba(245,147,50,.25);border-radius:4px;padding:2px 8px">SEASON FINAL</span>`
    : '';
  const actions = [regenAllBtn, finalBadge].filter(Boolean).join(' ');

  const heroSection = `<div class="awd-hero-section">${heroCandidates.map((c, i) => mvpHeroRow(c, i + 1, isAdmin, season, playoffsStarted)).join('')}</div>`;

  const restSection = restCandidates.length ? `
  <div class="card" style="padding:0;overflow:hidden;margin-top:16px">
    <div class="awd-rank-list">${restCandidates.map((c, i) => mvpRankRow(c, i + 4, isAdmin, season, playoffsStarted)).join('')}</div>
  </div>` : '';

  const regenScript = isAdmin ? `
<script>
(function() {
  async function regen(pid, season, btn) {
    var orig = btn.innerHTML; btn.disabled = true; btn.textContent = '…';
    await fetch('/admin/mvp/regenerate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(pid ? { player_id: pid, season } : { season })
    });
    location.reload();
  }
  document.querySelectorAll('.mvp-regen-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      regen(this.dataset.pid, this.dataset.season, this);
    });
  });
  var all = document.getElementById('mvp-regen-all');
  if (all) all.addEventListener('click', function() { regen(null, this.dataset.season, this); });
})();
</script>` : '';

  const toggleScript = `<script>
(function() {
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
${pageHeader({
    title: playoffsStarted ? `Season ${season} MVP Race — Final` : 'MVP Race',
    description: `Season ${season} · ${totalGames}/${seasonGames * 2} games played`,
    actions,
  })}
  ${heroSection}
  ${restSection}
</div>
${!hasAllWriteups && !playoffsStarted ? `<script>setTimeout(function(){ location.reload(); }, 8000);</script>` : ''}
${toggleScript}
${regenScript}`;
}
