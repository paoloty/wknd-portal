import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials, playerAvatar, playerLink } from './utils.js';

export const PER_GAME = [
  { id: 'pts',      label: 'PPG', title: 'Scoring',        fn: p => p.pts      / p.games_played },
  { id: 'reb',      label: 'RPG', title: 'Rebounds',       fn: p => p.reb      / p.games_played },
  { id: 'ast',      label: 'APG', title: 'Assists',        fn: p => p.ast      / p.games_played },
  { id: 'stl',      label: 'SPG', title: 'Steals',         fn: p => p.stl      / p.games_played },
  { id: 'blk',      label: 'BPG', title: 'Blocks',         fn: p => p.blk      / p.games_played },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m     / p.games_played },
  {
    id: 'fgp', label: 'FG%', title: 'FG Efficiency',
    fn: p => { const a = p.fg2m + p.fg3m + p.fg2m_miss + p.fg3m_miss; return a >= 10 ? (p.fg2m + p.fg3m) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: '3PT Efficiency',
    fn: p => { const a = p.fg3m + p.fg3m_miss; return a >= 5 ? p.fg3m / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ 3PA',
  },
  {
    id: 'ftp', label: 'FT%', title: 'Free Throws',
    fn: p => { const a = p.ftm + p.ft_miss; return a >= 5 ? p.ftm / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ FTA',
  },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm      / p.games_played },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover / p.games_played },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf       / p.games_played },
];

export const TOTALS = [
  { id: 'pts',      label: 'PTS', title: 'Points',         fn: p => p.pts },
  { id: 'reb',      label: 'REB', title: 'Rebounds',       fn: p => p.reb },
  { id: 'ast',      label: 'AST', title: 'Assists',        fn: p => p.ast },
  { id: 'stl',      label: 'STL', title: 'Steals',         fn: p => p.stl },
  { id: 'blk',      label: 'BLK', title: 'Blocks',         fn: p => p.blk },
  { id: 'fg3m',     label: '3PM', title: '3-Pointers',     fn: p => p.fg3m },
  {
    id: 'fgp', label: 'FG%', title: 'FG Efficiency',
    fn: p => { const a = p.fg2m + p.fg3m + p.fg2m_miss + p.fg3m_miss; return a >= 10 ? (p.fg2m + p.fg3m) / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '10+ FGA',
  },
  {
    id: 'fg3p', label: '3P%', title: '3PT Efficiency',
    fn: p => { const a = p.fg3m + p.fg3m_miss; return a >= 5 ? p.fg3m / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ 3PA',
  },
  {
    id: 'ftp', label: 'FT%', title: 'Free Throws',
    fn: p => { const a = p.ftm + p.ft_miss; return a >= 5 ? p.ftm / a : -1; },
    fmt: v => (v * 100).toFixed(1) + '%', min: '5+ FTA',
  },
  { id: 'ftm',      label: 'FTM', title: 'FT Made',        fn: p => p.ftm },
  { id: 'turnover', label: 'TO',  title: 'Turnovers',      fn: p => p.turnover },
  { id: 'pf',       label: 'PF',  title: 'Fouls',          fn: p => p.pf },
];

export function fmtPerGame(v) { return v.toFixed(1); }
export function fmtTotals(v)  { return String(Math.round(v)); }

function shareBtn(cat, mode, season, best, color, fmt) {
  return `<button class="leader-panel__share" onclick="shareLeader(this)" title="Share"
    data-season="${escHtml(String(season))}"
    data-cat-id="${escHtml(cat.id)}"
    data-mode="${escHtml(mode)}"
    data-player-id="${escHtml(best.p.id)}"
    data-player-name="${escHtml(best.p.name)}"
    data-team-id="${escHtml(best.p.team_id)}"
    data-team-name="${escHtml(String(best.p.team_name || ''))}"
    data-team-color="${escHtml(color)}"
    data-stat-label="${escHtml(cat.label)}"
    data-stat-title="${escHtml(cat.title)}"
    data-stat-value="${best.v}"
    data-stat-fmt="${escHtml(fmt(best.v))}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>`;
}

function leaderPanel(cat, players, defaultFmt, { mode = 'pg', season = '' } = {}) {
  const scored = players
    .map(p => ({ p, v: cat.fn(p) }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v || b.p.games_played - a.p.games_played || (b.p.team_wins || 0) - (a.p.team_wins || 0));

  if (!scored.length) return '';

  const top10 = scored.slice(0, 10);
  const best = top10[0];
  const fmt = cat.fmt || defaultFmt;
  const maxV = best.v;

  const teamName = String(best.p.team_name || '').toUpperCase();
  const color = teamColor(teamName);
  const isLight = teamName === 'WHITE';

  return `<div class="card leader-panel" style="--lp-color:${color}">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${escHtml(cat.label)}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
    ${cat.min ? `<span class="leader-panel__min">${escHtml(cat.min)}</span>` : ''}
    ${shareBtn(cat, mode, season, best, color, fmt)}
  </div>
  <div class="leader-panel__top" style="background:linear-gradient(135deg,${color}1a 0%,transparent 65%)">
    ${playerAvatar(best.p.id, best.p.name, color, { className: 'leader-avatar', link: true })}
    <div class="leader-panel__info">
      <div class="leader-panel__name">${playerLink(best.p.id, best.p.name, { upper: true })}</div>
      <span class="team-chip" style="background:${color};color:${isLight?'#10141d':'#fff'}">${escHtml(teamName)}</span>
    </div>
    <div class="leader-panel__stat font-condensed">${escHtml(fmt(best.v))}</div>
  </div>
  <div class="leader-panel__list">
    ${top10.slice(1).map((x, i) => {
      const tc = teamColor(String(x.p.team_name || '').toUpperCase());
      const barW = maxV > 0 ? Math.round(x.v / maxV * 100) : 0;
      return `<div class="leader-panel__row" style="--bar-w:${barW}%;--bar-color:${tc}">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="leader-panel__row-name">${playerLink(x.p.id, x.p.name, { upper: true })}</span>
      <span class="leader-panel__row-stat font-condensed">${escHtml(fmt(x.v))}</span>
    </div>`;
    }).join('')}
  </div>
</div>`;
}

export function leadersPage({ players, season = '' }) {
  const opts = s => ({ mode: s, season });
  const pgPanels  = PER_GAME.map(cat => leaderPanel(cat, players, fmtPerGame, opts('pg'))).filter(Boolean).join('\n');
  const totPanels = TOTALS.map(cat => leaderPanel(cat, players, fmtTotals, opts('tot'))).filter(Boolean).join('\n');

  return `<div class="page-content">
    <div class="section-divider">
      <span class="section-divider__label">LEAGUE LEADERS</span>
      <span class="section-divider__line"></span>
      <div class="leaders-toggle">
        <button class="leaders-toggle__btn leaders-toggle__btn--active" id="leaders-btn-pg" onclick="leadersSwitch('pg')">Per Game</button>
        <button class="leaders-toggle__btn" id="leaders-btn-tot" onclick="leadersSwitch('tot')">Totals</button>
      </div>
    </div>
    <div class="leaders-page-grid" id="leaders-grid-pg">${pgPanels}</div>
    <div class="leaders-page-grid" id="leaders-grid-tot" style="display:none">${totPanels}</div>
    <script>
    function leadersSwitch(mode) {
      document.getElementById('leaders-grid-pg').style.display  = mode === 'pg'  ? '' : 'none';
      document.getElementById('leaders-grid-tot').style.display = mode === 'tot' ? '' : 'none';
      document.getElementById('leaders-btn-pg').classList.toggle('leaders-toggle__btn--active',  mode === 'pg');
      document.getElementById('leaders-btn-tot').classList.toggle('leaders-toggle__btn--active', mode === 'tot');
    }
    async function shareLeader(btn) {
      if (btn._busy) return;
      btn._busy = true;
      const icon = btn.innerHTML;
      btn.innerHTML = '&hellip;';
      try {
        const r = await fetch('/api/leaders/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            season:      btn.dataset.season,
            category_id: btn.dataset.catId,
            mode:        btn.dataset.mode,
            player_id:   btn.dataset.playerId,
            player_name: btn.dataset.playerName,
            team_id:     btn.dataset.teamId,
            team_name:   btn.dataset.teamName,
            team_color:  btn.dataset.teamColor,
            stat_label:  btn.dataset.statLabel,
            stat_title:  btn.dataset.statTitle,
            stat_value:  parseFloat(btn.dataset.statValue),
            stat_fmt:    btn.dataset.statFmt,
          })
        });
        const { url } = await r.json();
        await navigator.clipboard.writeText(url);
        btn.innerHTML = '&#10003; Copied';
        btn.classList.add('leader-panel__share--copied');
        setTimeout(() => {
          btn.innerHTML = icon;
          btn.classList.remove('leader-panel__share--copied');
          btn._busy = false;
        }, 2000);
      } catch {
        btn.innerHTML = icon;
        btn._busy = false;
      }
    }
    </script>
  </div>`;
}
