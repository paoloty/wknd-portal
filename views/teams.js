import { escHtml } from './layout.js';
import { teamColor, initials, playerPhotoUrl } from './utils.js';
import { summaryPanel } from './home.js';

// ── /teams ────────────────────────────────────────────────────────────────────
// Rebuilt 2026-10-11 from the "WKND Teams Redesign" canvas (boards Main + Mobile).
// Same head as /standings (kicker + upright title + season pills), an AI summary panel,
// one card per team in standings order, "How they stack up" (one ranked-bar card per
// category) and "Past champions" — each of the last two with its own AI write-up.
// Styles: public/teams.css (tms- prefix). Data: server.js GET /teams.

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const dot = (name, size = 10) => `<span class="team-dot" style="background:${teamColor(name)};width:${size}px;height:${size}px"></span>`;

function avatar(p, cls) {
  return `<span class="${cls}" style="--team:${teamColor(p.team)}"><span>${escHtml(initials(p.name))}</span><img src="${playerPhotoUrl(p.id, 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
}

function formPills(form) {
  return form.map(f => `<span class="tms-wl tms-wl--${f.r === 'W' ? 'w' : 'l'}" title="${escHtml(f.title)}">${f.r}</span>`).join('');
}

function teamCard(t) {
  const diff = t.diff == null ? '—' : `${t.diff > 0 ? '+' : t.diff < 0 ? '−' : ''}${Math.abs(t.diff).toFixed(1)}`;
  const diffCls = t.diff > 0 ? ' is-pos' : t.diff < 0 ? ' is-neg' : '';
  const streak = t.streak ? `<span class="tms-card__streak${t.streak.won ? ' is-w' : ' is-l'}">${t.streak.won ? 'Won' : 'Lost'} ${t.streak.count}</span>` : '';
  const stars = t.stars.map(p => `<span class="tms-star">
        ${avatar(p, 'tms-av')}
        <span class="tms-star__name">${escHtml(p.name)}</span>
        <b class="tms-star__val font-condensed">${escHtml(p.ppg)}</b>
      </span>`).join('');
  const foot = [
    t.next ? `<span><span>Next</span><b>${escHtml(t.next)}</b></span>` : '',
    t.head ? `<span><span>Team head</span><b>${escHtml(t.head)}</b></span>` : '',
    `<span><span>Roster</span><b>${t.rosterCount} player${t.rosterCount === 1 ? '' : 's'}</b></span>`,
  ].join('');
  return `<a href="/teams/${encodeURIComponent(t.slug)}" class="tms-card" style="--team:${teamColor(t.name)}">
    <span class="tms-card__body">
      <span class="tms-card__top">
        <span class="tms-kicker">${escHtml(t.place)}</span>
        ${t.chip ? `<span class="tms-chip">${escHtml(t.chip)}</span>` : ''}
      </span>
      <span class="tms-card__id">
        <span class="tms-card__namecol">
          <span class="tms-card__name">${dot(t.name)}<span>${escHtml(t.name)}</span></span>
          ${t.form.length ? `<span class="tms-form">${formPills(t.form)}</span>` : ''}
        </span>
        <span class="tms-card__reccol">
          <b class="tms-card__record font-condensed">${escHtml(t.record)}</b>
          ${streak}
        </span>
      </span>
      <span class="tms-card__kpis">
        <span><b class="font-condensed">${t.ppg ?? '—'}</b><small>PPG</small></span>
        <span><b class="font-condensed">${t.opp ?? '—'}</b><small>Allowed</small></span>
        <span><b class="font-condensed${diffCls}">${diff}</b><small>Diff</small></span>
      </span>
      ${t.knownFor ? `<span class="tms-card__known"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z"/></svg><span>${escHtml(t.knownFor)}</span></span>` : ''}
      ${stars ? `<span class="tms-card__stars"><span class="tms-card__label">Top scorers</span>${stars}</span>` : ''}
      <span class="tms-card__phone"><span class="tms-stack">${t.stars.map(p => avatar(p, 'tms-av')).join('')}</span><span>${escHtml(t.knownFor || '')}${t.stars[0] ? ` · ${escHtml(t.stars[0].short)} ${escHtml(t.stars[0].ppg)} PPG` : ''}</span></span>
    </span>
    <span class="tms-card__foot">${foot}</span>
  </a>`;
}

function catCard(c) {
  const vals = c.rows.map(r => r.num);
  const max = Math.max(...vals), min = Math.min(...vals);
  const rows = c.rows.map((r, i) => {
    const w = c.lowBetter ? (r.num > 0 ? (min / r.num) * 100 : 0) : (max > 0 ? (r.num / max) * 100 : 0);
    return `<span class="tms-bar${i === 0 ? ' is-lead' : ''}">
        <span class="tms-bar__row">${dot(r.team, 8)}<span class="tms-bar__team">${escHtml(r.team)}</span><b class="font-condensed">${escHtml(r.value)}</b></span>
        <span class="tms-bar__track"><span style="width:${Math.round(w)}%"></span></span>
      </span>`;
  }).join('');
  return `<div class="tms-cat">
    <span class="tms-cat__head"><span class="tms-cat__title">${escHtml(c.title)}</span><span class="tms-cat__note">${escHtml(c.note)}</span></span>
    ${rows}
  </div>`;
}

function championRow(c) {
  return `<a href="/playoffs?season=${encodeURIComponent(c.season)}" class="tms-champ" style="--team:${teamColor(c.team)}">
    <span class="tms-champ__when"><span class="tms-kicker">Season ${escHtml(String(c.season))}</span>${c.dateLabel ? `<span>${escHtml(c.dateLabel)}</span>` : ''}</span>
    <span class="tms-champ__team"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg><b>${escHtml(c.team)}</b></span>
    ${c.line ? `<span class="tms-champ__line">${escHtml(c.line)}</span>` : ''}
    <span class="tms-champ__mvps">${c.mvp ? `<span>MVP <b>${escHtml(c.mvp)}</b></span>` : ''}${c.finalsMvp ? `<span>Finals MVP <b>${escHtml(c.finalsMvp)}</b></span>` : ''}</span>
  </a>`;
}

export function teamsBody({ season, seasons = [], isCurrent = true, week = null, playerCount = 0, nextLabel = '', teams = [], cats = [], champions = [], summaries = {}, isAdmin = false } = {}) {
  const pills = seasons.map(s => `<a href="/teams${String(s) === String(seasons[0]) ? '' : `?season=${encodeURIComponent(s)}`}" class="stp-pill${String(s) === String(season) ? ' is-on' : ''}"${String(s) === String(season) ? ' aria-current="page"' : ''}><span class="pill-label">Season ${escHtml(String(s))}</span></a>`).join('');
  const sub = [`${teams.length} team${teams.length === 1 ? '' : 's'}`, playerCount ? `${playerCount} players` : '', nextLabel].filter(Boolean).join(' · ');
  const kicker = `Season ${season}${isCurrent && week ? ` · After week ${week}` : isCurrent ? '' : ' · Final'}`;

  return `<div class="page-content tms-page">
  <div class="stp-head tms-head">
    <div class="stp-head__title">
      <span class="stp-kicker">${escHtml(kicker)}</span>
      <h1>Teams</h1>
      <span class="tms-head__sub">${escHtml(sub)}</span>
    </div>
    ${seasons.length > 1 ? `<div class="stp-head__side"><nav class="stp-pills" aria-label="Season">${pills}</nav></div>` : ''}
  </div>

  ${isCurrent ? summaryPanel(summaries.index, 'teams', isAdmin) : ''}

  ${teams.length ? `<div class="tms-grid">${teams.map(teamCard).join('')}</div>` : '<div class="card tms-empty">No teams yet.</div>'}

  ${cats.length ? `<section class="tms-sec" aria-labelledby="tms-stack-h">
    <div class="section-header"><h2 id="tms-stack-h">How they stack up <span class="section-header__sub">per game, Season ${escHtml(String(season))}</span></h2><a href="/standings${isCurrent ? '' : `?season=${encodeURIComponent(season)}`}" class="section-header__link">Full team stats on Standings →</a></div>
    ${isCurrent ? summaryPanel(summaries.stackup, 'teams_stackup', isAdmin) : ''}
    <div class="tms-cats">${cats.map(catCard).join('')}</div>
  </section>` : ''}

  ${champions.length ? `<section class="tms-sec" aria-labelledby="tms-champs-h">
    <div class="section-header"><h2 id="tms-champs-h">Past champions</h2><a href="/playoffs" class="section-header__link">Playoff history →</a></div>
    ${summaryPanel(summaries.champions, 'teams_champions', isAdmin)}
    <div class="tms-champs">${champions.map(championRow).join('')}</div>
  </section>` : ''}
</div>
${isAdmin ? teamsRegenScript() : ''}`;
}

// Admin "Regenerate" on any teams-page summary panel (index, stack-up, champions, team pages).
export function teamsRegenScript() {
  return `<script>
(function () {
  document.querySelectorAll('.hs-summary__regen').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Writing…';
      fetch('/admin/teams-summary/regenerate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ block: btn.dataset.block }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed'); }); })
        .then(function () { location.reload(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = '↺ Regenerate'; alert(e.message); });
    });
  });
})();
</script>`;
}

export { ordinal };
