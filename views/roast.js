import { escHtml } from './layout.js';
import { teamColor, playerAvatar, playerLink } from './utils.js';

const SHARE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
const DL_ICON   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

// ── Roast categories — mirror of leaders page, worst performers ───────────────
export const ROAST_CATS = [
  {
    id: 'ghost',
    label: 'PPG',
    title: 'The Ghost',
    sub: 'Fewest points per game',
    fn: p => p.games_played >= 3 ? p.pts / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: true,
  },
  {
    id: 'passenger',
    label: 'PER',
    title: 'The Passenger',
    sub: 'Lowest efficiency rating',
    fn: p => {
      const fga = (p.fg2m||0)+(p.fg3m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0);
      if (p.games_played < 3 || fga < 10) return null;
      const per = (p.pts||0) + 0.4*((p.fg2m||0)+(p.fg3m||0)) - 0.7*fga - 0.4*(p.ft_miss||0)
        + 0.7*(p.reb||0) + (p.stl||0) + 0.7*(p.ast||0) + 0.7*(p.blk||0) - (p.turnover||0);
      return per / p.games_played;
    },
    fmt: v => v.toFixed(1),
    asc: true,
    min: '3+ GP · 10+ FGA',
  },
  {
    id: 'lane',
    label: 'RPG',
    title: 'Stay in Your Lane',
    sub: 'Fewest rebounds per game',
    fn: p => p.games_played >= 3 ? p.reb / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: true,
  },
  {
    id: 'generous',
    label: 'TOV',
    title: 'Most Generous',
    sub: 'Most turnovers per game',
    fn: p => p.games_played >= 3 ? (p.turnover||0) / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: false,
  },
  {
    id: 'foul',
    label: 'PF',
    title: 'Foul Magnet',
    sub: 'Most personal fouls per game',
    fn: p => p.games_played >= 3 ? (p.pf||0) / p.games_played : null,
    fmt: v => v.toFixed(1),
    asc: false,
  },
  {
    id: 'icecold',
    label: 'FG%',
    title: 'Ice Cold',
    sub: 'Worst field goal percentage',
    fn: p => {
      const fga = (p.fg2m||0)+(p.fg3m||0)+(p.fg2m_miss||0)+(p.fg3m_miss||0);
      return fga >= 10 && p.games_played >= 3 ? ((p.fg2m||0)+(p.fg3m||0)) / fga : null;
    },
    fmt: v => Math.round(v * 100) + '%',
    asc: true,
    min: '3+ GP · 10+ FGA',
  },
  {
    id: 'ftphobia',
    label: 'FT%',
    title: 'Free Throw Phobia',
    sub: 'Worst free throw percentage',
    fn: p => {
      const fta = (p.ftm||0) + (p.ft_miss||0);
      return fta >= 5 && p.games_played >= 3 ? (p.ftm||0) / fta : null;
    },
    fmt: v => Math.round(v * 100) + '%',
    asc: true,
    min: '3+ GP · 5+ FTA',
  },
  {
    id: 'bricks',
    label: 'MISS',
    title: 'The Brick Factory',
    sub: 'Most missed shots per game',
    fn: p => {
      if (p.games_played < 3) return null;
      return ((p.fg2m_miss||0) + (p.fg3m_miss||0) + (p.ft_miss||0)) / p.games_played;
    },
    fmt: v => v.toFixed(1),
    asc: false,
  },
];

function roastPanel(cat, players, season) {
  const scored = players
    .map(p => ({ p, v: cat.fn(p) }))
    .filter(x => x.v !== null && x.v !== undefined && !isNaN(x.v))
    .sort((a, b) => cat.asc ? a.v - b.v : b.v - a.v);

  if (!scored.length) return '';

  const top10    = scored.slice(0, 10);
  const best     = top10[0];
  const fmt      = cat.fmt || (v => v.toFixed(1));
  const refV     = best.v;
  const teamName = String(best.p.team_name || '').toUpperCase();
  const color    = teamColor(teamName);
  const isLight  = teamName === 'WHITE';
  const fmtVal   = fmt(best.v);

  const shareBtn = `<button class="leader-panel__share" onclick="shareLeader(this)" title="Share"
    data-season="${escHtml(String(season || ''))}"
    data-cat-id="${escHtml(cat.id)}"
    data-mode="roast"
    data-player-id="${escHtml(String(best.p.id || ''))}"
    data-player-name="${escHtml(String(best.p.name || ''))}"
    data-team-id="${escHtml(String(best.p.team_id || ''))}"
    data-team-name="${escHtml(teamName)}"
    data-team-color="${escHtml(color)}"
    data-stat-label="${escHtml(cat.label)}"
    data-stat-title="${escHtml(cat.title)}"
    data-stat-value="${best.v}"
    data-stat-fmt="${escHtml(fmtVal)}">${SHARE_ICON}</button>`;

  const dlBtn = `<button class="leader-panel__share" onclick="downloadLeader(this)" title="Download image"
    data-label="${escHtml(cat.label)}"
    data-mode="roast">${DL_ICON}</button>`;

  const rows = top10.slice(1).map((x, i) => {
    const tc   = teamColor(String(x.p.team_name || '').toUpperCase());
    const barW = refV !== 0 ? Math.round((cat.asc ? refV / x.v : x.v / refV) * 100) : 0;
    return `<div class="leader-panel__row" style="--bar-w:${barW}%;--bar-color:${tc}">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="leader-panel__row-name">${playerLink(x.p.id, x.p.name, { upper: true })}</span>
      <span class="leader-panel__row-stat font-condensed">${escHtml(fmt(x.v))}</span>
    </div>`;
  }).join('');

  return `<div class="card leader-panel leader-panel--roast" style="--lp-color:${color}">
  <div class="leader-panel__head">
    <span class="leader-panel__cat">${escHtml(cat.label)}</span>
    <span class="leader-panel__title">${escHtml(cat.title)}</span>
    ${cat.min ? `<span class="leader-panel__min">${escHtml(cat.min)}</span>` : ''}
    <div class="leader-panel__actions">${shareBtn}${dlBtn}</div>
  </div>
  <div class="leader-panel__top" style="background:linear-gradient(135deg,${color}1a 0%,transparent 65%)">
    ${playerAvatar(best.p.id, best.p.name, color, { className: 'leader-avatar', link: true })}
    <div class="leader-panel__info">
      <div class="leader-panel__name">${playerLink(best.p.id, best.p.name, { upper: true })}</div>
      <span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>
      <span class="roast-sub">${escHtml(cat.sub)}</span>
    </div>
    <div class="leader-panel__stat font-condensed roast-stat">${escHtml(fmtVal)}</div>
  </div>
  ${rows ? `<div class="leader-panel__list">${rows}</div>` : ''}
</div>`;
}

export function roastPage({ players = [], season = '' }) {
  const panels = ROAST_CATS.map(cat => roastPanel(cat, players, season)).filter(Boolean).join('\n');

  if (!panels) {
    return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">Not enough data yet. Check back after a few games.</div>`;
  }

  return `<div class="page-content">
  <div class="roast-header">
    <p class="roast-intro">The flip side of glory. Same stats, opposite podium.</p>
  </div>
  <div class="leaders-page-grid">${panels}</div>
  <script>
  var _asOfLabel = '';
  async function downloadLeader(btn) {
    if (btn._busy) return;
    btn._busy = true;
    var icon = btn.innerHTML;
    btn.innerHTML = '&hellip;';
    var panel = btn.closest('.card.leader-panel');
    try {
      if (!window._h2cPro) {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro/dist/html2canvas-pro.min.js';
          s.onload = function() { window._h2cPro = window.html2canvasPro || window.html2canvas; resolve(); };
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      var captured = await window._h2cPro(panel, {
        backgroundColor: null, scale: 2, useCORS: true, logging: false,
        scrollX: -window.scrollX, scrollY: -window.scrollY,
        onclone: function(clonedDoc, clonedEl) {
          var acts = clonedEl.querySelector('.leader-panel__actions');
          if (acts) acts.style.display = 'none';
        },
      });
      var PAD = 32, FOOTER_H = 56;
      var W = captured.width + PAD * 2, H = captured.height + PAD * 2 + FOOTER_H;
      var out = document.createElement('canvas');
      out.width = W; out.height = H;
      var ctx = out.getContext('2d');
      ctx.fillStyle = '#0a0e16';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(captured, PAD, PAD);
      ctx.fillStyle = '#475569';
      ctx.font = '600 20px Arial,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WKNDBASKETBALL.COM · THE ROAST', W / 2, captured.height + PAD + Math.round((PAD + FOOTER_H) / 2));
      out.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'wknd-roast-' + (btn.dataset.label || 'stat').toLowerCase() + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
      btn.innerHTML = '&#10003;';
      setTimeout(function() { btn.innerHTML = icon; btn._busy = false; }, 1500);
    } catch(e) { btn.innerHTML = icon; btn._busy = false; }
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
    } catch { btn.innerHTML = icon; btn._busy = false; }
  }
  </script>
</div>`;
}
