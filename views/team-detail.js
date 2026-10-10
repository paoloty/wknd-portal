import { escHtml } from './layout.js';
import { teamColor, initials, playerPhotoUrl } from './utils.js';
import { gameCard, gamesPageScript } from './games.js';
import { summaryPanel } from './home.js';
import { openPickCard, pickBoxScript } from './pick-box.js';
import { teamsRegenScript } from './teams.js';
import { faceoffCard } from './picks-widget.js';
import { sectionNavScript } from './section-nav.js';

// ── /teams/:slug ──────────────────────────────────────────────────────────────
// Rebuilt 2026-10-11 from the "WKND Teams Redesign" canvas (boards Team + TeamMobile).
// One scrolling page with a sticky section nav (same idea as /games/:slug):
// hero banner + Up next (the shared Who wins? card) → AI team summary → where they rank →
// team leaders → roster → schedule & results (the /games result cards) → head to head →
// season by season. On phones the leaders, results and head-to-head rows swipe sideways.
// Styles: public/teams.css (tdp- prefix). Data: server.js GET /teams/:ref.

const dot = (name, size = 9) => `<span class="team-dot" style="background:${teamColor(name)};width:${size}px;height:${size}px"></span>`;
const TROPHY = (size = 13) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>`;

function avatar(p, cls, team) {
  return `<span class="${cls}" style="--team:${teamColor(team)}"><span>${escHtml(initials(p.name))}</span><img src="${playerPhotoUrl(p.id, 192)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
}

// desc: the one-line subheadline under the header (same .stp-desc line as /standings).
function sh(id, title, { sub = '', link = '', linkLabel = '', desc = '' } = {}) {
  return `<div class="section-header"><h2 id="${id}-h">${title}${sub ? ` <span class="section-header__sub">${sub}</span>` : ''}</h2>${link ? `<a href="${escHtml(link)}" class="section-header__link">${linkLabel}</a>` : ''}</div>${desc ? `<p class="stp-desc tdp-desc">${desc}</p>` : ''}`;
}

function wl(r, title = '') {
  return `<span class="tms-wl tms-wl--${r === 'W' ? 'w' : 'l'}"${title ? ` title="${escHtml(title)}"` : ''}>${r}</span>`;
}

function hero(d) {
  const { team } = d;
  const chips = d.chips.map(c => `<span class="tdp-chip tdp-chip--${c.kind}">${c.kind === 'title' ? TROPHY(12) : ''}${escHtml(c.label)}</span>`).join('');
  const kpis = d.kpis.map(k => `<span class="tdp-kpi"><b class="font-condensed${k.tone ? ` is-${k.tone}` : ''}">${escHtml(k.value)}</b><small>${escHtml(k.label)}</small></span>`).join('');
  return `<div class="tdp-banner" style="--team:${teamColor(team.name)}">
      ${d.coverId ? `<img class="tdp-banner__img" src="/api/photo/${encodeURIComponent(d.coverId)}?w=960" alt="" fetchpriority="high">` : ''}
      <div class="tdp-banner__body">
        <div class="tdp-banner__id">
          <span class="tms-kicker">${escHtml(d.kicker)}</span>
          <div class="tdp-banner__name"><h1>${escHtml(team.name)}</h1><b class="tdp-banner__rec font-condensed">${escHtml(d.record)}</b></div>
          ${chips || d.form.length ? `<div class="tdp-banner__chips">${chips}${d.form.length ? `<span class="tms-form">${d.form.map(f => wl(f.r, f.title)).join('')}</span>` : ''}</div>` : ''}
        </div>
        <div class="tdp-kpis">${kpis}</div>
      </div>
    </div>`;
}

function upNext(d) {
  if (d.openPick) {
    const when = d.openPick.ymd ? new Date(`${d.openPick.ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    return `<span class="tms-kicker tdp-hero__kicker">Up next${when ? ` · ${escHtml(when)}` : ''} · Who wins?</span>
      ${d.openPick.face
        ? faceoffCard(d.openPick, { isPlayer: d.isPlayer, next: `/teams/${encodeURIComponent(d.slug)}` })
        : openPickCard(d.openPick, { isPlayer: d.isPlayer, next: `/teams/${encodeURIComponent(d.slug)}`, size: 'sm' })}`;
  }
  const n = d.nextGame;
  if (!n) return '';
  return `<div class="tdp-next" style="--team:${teamColor(n.opp)}">
      <span class="tms-kicker">Up next · ${escHtml(n.dateLabel)}</span>
      <span class="tdp-next__opp"><span>vs</span>${dot(n.opp, 10)}<b>${escHtml(n.opp)}</b>${n.oppRecord ? `<small>${escHtml(n.oppRecord)}</small>` : ''}</span>
      ${n.series ? `<span class="tdp-next__row"><span>Series, all seasons</span><b>${escHtml(n.series)}</b></span>` : ''}
      ${n.last ? `<span class="tdp-next__row"><span>Last meeting</span><b>${escHtml(n.last)}</b></span>` : ''}
      <a href="${escHtml(n.href)}" class="tdp-next__link">Full matchup preview →</a>
    </div>`;
}

function rankTile(c) {
  const meter = Array.from({ length: c.totalTeams }, (_, i) => `<span class="${i < c.totalTeams - c.rank + 1 ? (c.rank === 1 ? 'is-top' : 'is-on') : ''}"></span>`).join('');
  return `<div class="tdp-rank${c.rank === 1 ? ' is-top' : ''}">
      <span class="tdp-rank__label">${escHtml(c.label)}</span>
      <b class="tdp-rank__val font-condensed">${escHtml(c.valueDisplay)}${c.unit ? `<small>${escHtml(c.unit)}</small>` : ''}</b>
      <span class="tdp-meter" aria-hidden="true">${meter}</span>
      <span class="tdp-rank__place">${escHtml(c.place)} of ${c.totalTeams}</span>
    </div>`;
}

function leaderCard(c, team) {
  return `<div class="tdp-lb" style="--team:${teamColor(team)}">
      <div class="tdp-lb__top">
        <div class="tdp-lb__head"><span class="tdp-lb__title">${escHtml(c.title)}</span><span class="tdp-lb__key">${escHtml(c.key)}</span></div>
        <a href="/players/${encodeURIComponent(c.id)}" class="tdp-lb__lead">
          ${avatar(c, 'tdp-av tdp-av--lg', team)}
          <span class="tdp-lb__who">
            <span class="tdp-lb__first">${escHtml(c.first)}</span>
            <span class="tdp-lb__last">${escHtml(c.last)}</span>
            <span class="tdp-lb__note">${escHtml(c.note)}</span>
          </span>
          <b class="tdp-lb__val font-condensed">${escHtml(c.value)}</b>
        </a>
      </div>
      ${c.rest.length ? `<div class="tdp-lb__rest">${c.rest.map((r, i) => `<a href="/players/${encodeURIComponent(r.id)}"><span class="font-condensed">${i + 2}</span><span>${escHtml(r.name)}</span><b class="font-condensed">${escHtml(r.value)}</b></a>`).join('')}</div>` : ''}
    </div>`;
}

// Roster colouring: a number well above this roster's own average turns green (turnovers
// are never coloured — "high" isn't good there). Rec-league box scores mean little against
// a fixed benchmark, so it's relative to teammates.
const HI_RATIO = 1.5;
const ROSTER_COLS = [
  { k: 'pts', label: 'PTS', group: 'pg' }, { k: 'reb', label: 'REB' }, { k: 'ast', label: 'AST' }, { k: 'stl', label: 'STL' },
  { k: 'blk', label: 'BLK' }, { k: 'to', label: 'TO', noHi: true }, { k: 'high', label: 'HIGH', noHi: true },
  { k: 'fgp', label: 'FG%', group: 'sh', pct: true }, { k: 'tpp', label: '3P%', pct: true }, { k: 'ftp', label: 'FT%', pct: true },
];

function rosterSection(d) {
  const rows = d.roster;
  if (!rows.length) return `<div class="card tdp-empty">No players on this roster yet.</div>`;
  const avg = {};
  for (const c of ROSTER_COLS) {
    const vals = rows.map(p => p.v?.[c.k]).filter(v => v != null);
    avg[c.k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  const fmt = (c, v) => (v == null ? '—' : c.pct ? `${Math.round(v)}%` : c.k === 'high' ? String(v) : v.toFixed(1));
  const tag = p => [p.pos, p.tag].filter(Boolean).join(' · ');
  const body = rows.map(p => {
    const cells = ROSTER_COLS.map(c => {
      const v = p.v?.[c.k];
      const hi = !c.noHi && v != null && avg[c.k] > 0 && v >= avg[c.k] * HI_RATIO && (p.gp || 0) >= 2;
      return `<td class="tdp-td${c.group ? ' tdp-td--g' : ''}${c.k === 'pts' ? ' tdp-td--pts' : ''}${hi ? ' is-hi' : ''}">${fmt(c, v)}</td>`;
    }).join('');
    return `<tr>
        <td class="tdp-td--player"><a href="/players/${encodeURIComponent(p.id)}">
          <span class="tdp-num font-condensed">${escHtml(p.num || '')}</span>
          ${avatar(p, 'tdp-av', d.team.name)}
          <span class="tdp-who"><span class="tdp-who__name"><span>${escHtml(p.name)}</span>${p.ring ? `<span class="tdp-ring" role="img" aria-label="${escHtml(p.ring)}" title="${escHtml(p.ring)}">${TROPHY(13)}</span>` : ''}</span><span class="tdp-who__tag">${escHtml(p.tag || '')}</span></span>
        </a></td>
        <td class="tdp-td--pos">${escHtml(p.pos || '—')}</td>
        <td class="tdp-td">${p.gp || '—'}</td>
        ${cells}
      </tr>`;
  }).join('');

  // Phone: three headline numbers per row; tap a row for the rest of the line.
  const list = rows.map(p => `<details class="tdp-pr">
      <summary>
        <span class="tdp-num font-condensed">${escHtml(p.num || '')}</span>
        ${avatar(p, 'tdp-av', d.team.name)}
        <span class="tdp-who"><span class="tdp-who__name"><span>${escHtml(p.name)}</span>${p.ring ? `<span class="tdp-ring" role="img" aria-label="${escHtml(p.ring)}">${TROPHY(12)}</span>` : ''}</span><span class="tdp-who__tag">${escHtml(tag(p))}</span></span>
        <span class="tdp-pr__nums font-condensed"><b>${fmt(ROSTER_COLS[0], p.v?.pts)}</b><span>${fmt(ROSTER_COLS[1], p.v?.reb)}</span><span>${fmt(ROSTER_COLS[2], p.v?.ast)}</span></span>
      </summary>
      <div class="tdp-pr__more">
        <span><b class="font-condensed">${p.gp || '—'}</b><small>GP</small></span>
        ${ROSTER_COLS.slice(3).map(c => `<span><b class="font-condensed">${fmt(c, p.v?.[c.k])}</b><small>${c.label}</small></span>`).join('')}
      </div>
    </details>`).join('');

  return `<div class="tdp-table-card">
      <div class="tdp-table-wrap">
        <table class="tdp-table">
          <thead>
            <tr class="tdp-groups"><th colspan="3">SEASON ${escHtml(String(d.season))}</th><th colspan="7" class="tdp-td--g">PER GAME</th><th colspan="3" class="tdp-td--g">SHOOTING</th></tr>
            <tr class="tdp-cols"><th class="tdp-td--player">PLAYER</th><th class="tdp-td--pos">POS</th><th>GP</th>${ROSTER_COLS.map(c => `<th class="${c.group ? 'tdp-td--g' : ''}">${c.label}</th>`).join('')}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
    <div class="tdp-plist">
      <div class="tdp-plist__head"><span></span><span class="font-condensed">PTS</span><span class="font-condensed">REB</span><span class="font-condensed">AST</span></div>
      ${list}
    </div>`;
}

function h2hCard(h) {
  return `<div class="tdp-h2h" style="--team:${teamColor(h.opp)}">
      <span class="tdp-h2h__top"><span class="tdp-h2h__opp"><span>vs</span>${dot(h.opp, 10)}<b>${escHtml(h.opp)}</b></span>${h.tag ? `<span class="tdp-tag">${escHtml(h.tag)}</span>` : ''}</span>
      <span class="tdp-h2h__mid"><b class="font-condensed">${escHtml(h.series)}</b><span><span>This season <b>${escHtml(h.season)}</b></span><span>Avg margin <b class="${h.marginNum > 0 ? 'is-pos' : h.marginNum < 0 ? 'is-neg' : ''}">${escHtml(h.margin)}</b></span></span></span>
      <span class="tms-form">${h.games.map(g => wl(g.r, g.title)).join('')}</span>
      <span class="tdp-h2h__last">Last: <b>${escHtml(h.last)}</b></span>
    </div>`;
}

function historyRow(s) {
  return `<div class="tdp-season${s.champion ? ' is-champ' : ''}">
      <span class="tms-kicker">Season ${escHtml(String(s.season))}</span>
      <b class="tdp-season__rec font-condensed">${escHtml(s.record)}</b>
      <span class="tdp-season__result">${s.champion ? TROPHY(16) : ''}${escHtml(s.result)}</span>
      <span class="tdp-season__more">
        ${s.line ? `<span>${escHtml(s.line)}</span>` : ''}
        ${s.awards.length ? `<span class="tdp-awards">${s.awards.map(a => `<span>${escHtml(a)}</span>`).join('')}</span>` : ''}
      </span>
    </div>`;
}

export function teamDetailPage(d) {
  const { team } = d;
  const sections = [
    ['overview', 'Overview'], d.leaders.length && ['leaders', 'Leaders'], ['roster', 'Roster'],
    d.games.length && ['schedule', 'Schedule'], d.h2h.length && ['h2h', 'Head to head'], d.history.length && ['history', 'History'],
  ].filter(Boolean);
  const next = upNext(d);
  const seasonNote = d.isCurrent ? '' : ` <span class="section-header__sub">Season ${escHtml(String(d.season))} — no games yet this season</span>`;

  return `<div class="page-content tdp-page">
  <a href="/teams" class="tdp-back">← All teams</a>
  <div class="tdp-hero${next ? '' : ' tdp-hero--solo'}">
    ${hero(d)}
    ${next ? `<div class="tdp-hero__next">${next}</div>` : ''}
  </div>

  <nav class="gd-snav tdp-nav" data-gd-snav aria-label="Sections">${sections.map(([id, label], i) => `<a href="#${id}" data-spy="${id}"${i === 0 ? ' class="is-on"' : ''}>${label}</a>`).join('')}</nav>

  <section id="overview" class="tdp-sec" aria-label="Overview">
    ${summaryPanel(d.summary, `team:${team.id}`, d.isAdmin)}
    ${d.ranks.length ? `${sh('ranks', 'Where they rank', { sub: `among ${d.ranks[0].totalTeams} teams, per game${seasonNote ? `, Season ${escHtml(String(d.season))}` : ''}`, link: '/teams', linkLabel: 'Compare all teams →', desc: `How ${escHtml(team.name)} compares with the other ${d.ranks[0].totalTeams - 1} teams. The first four are the same on every team page; the last two are where ${escHtml(team.name)} ranks lowest.` })}
    <div class="tdp-ranks">${d.ranks.map(rankTile).join('')}</div>` : ''}
  </section>

  ${d.leaders.length ? `<section id="leaders" class="tdp-sec" aria-labelledby="leaders-h">
    ${sh('leaders', 'Team leaders', { sub: 'per game', link: '/leaders', linkLabel: 'League leaders →', desc: `The top 3 on the roster in each category, and the leader's place in the whole league.` })}
    <div class="tdp-swipe tdp-lbs">${d.leaders.map(c => leaderCard(c, team.name)).join('')}</div>
  </section>` : ''}

  <section id="roster" class="tdp-sec" aria-labelledby="roster-h">
    ${sh('roster', 'Roster', { sub: escHtml(d.rosterSub), desc: `Season ${escHtml(String(d.season))} per-game numbers for everyone on the current roster, top scorer first.` })}
    ${d.roster.length ? `<div class="tdp-legend">${d.ringLabel ? `<span>${TROPHY(13)}${escHtml(d.ringLabel)}</span>` : ''}<span><b>Green</b> = well above the team average</span></div>` : ''}
    ${rosterSection(d)}
  </section>

  ${d.games.length ? `<section id="schedule" class="tdp-sec" aria-labelledby="schedule-h">
    ${sh('schedule', 'Schedule &amp; results', { sub: `Season ${escHtml(String(d.season))}`, link: '/games', linkLabel: 'All games →', desc: `Every ${escHtml(team.name)} game this season, newest first. Tap a card for the box score and recap.` })}
    <div class="gr-grid tdp-swipe tdp-games">${d.games.map(g => gameCard(g, { commentsEnabled: d.commentsEnabled, social: d.socialByGame[g.id] || { commentsCount: 0, reactCount: 0, reacted: false }, topScorer: d.topScorerByGame[g.id], odds: d.oddsByGame[g.id] || null })).join('')}</div>
  </section>` : ''}

  ${d.h2h.length ? `<section id="h2h" class="tdp-sec" aria-labelledby="h2h-h">
    ${sh('h2h', 'Head to head', { sub: 'all seasons, playoffs included', desc: `${escHtml(team.name)}'s record against each team, every meeting in order, oldest first.` })}
    <div class="tdp-swipe tdp-h2hs">${d.h2h.map(h2hCard).join('')}</div>
  </section>` : ''}

  ${d.history.length ? `<section id="history" class="tdp-sec" aria-labelledby="history-h">
    ${sh('history', 'Season by season', { sub: d.allTime ? `${escHtml(d.allTime)} all-time` : '', desc: 'Regular-season record and how each season ended, with the awards its players won.' })}
    <div class="tdp-seasons">${d.history.map(historyRow).join('')}</div>
  </section>` : ''}
</div>
${d.games.length ? gamesPageScript() : ''}
${d.openPick ? pickBoxScript() : ''}
${d.isAdmin ? teamsRegenScript() : ''}
${sectionNavScript()}`;
}
