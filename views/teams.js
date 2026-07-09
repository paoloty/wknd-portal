import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function abbr(name) {
  const n = name.toUpperCase();
  if (n.length <= 5) return n;
  return n.split(' ').map(w => w[0]).join('').toUpperCase();
}

export function teamsBody({ teams = [] } = {}) {
  const cards = teams.map(t => {
    const color  = teamColor(t.name);
    const tc10   = rgba(color, 0.10);
    const tc22   = rgba(color, 0.22);
    const tc06   = rgba(color, 0.06);
    const winsDisplay   = t.wins   != null ? String(t.wins)   : '—';
    const lossesDisplay = t.losses != null ? String(t.losses) : '—';

    const statCol = (label, val, highlight = false) =>
      `<div class="t2k-stat">
         <span class="t2k-stat__num font-condensed" style="${highlight ? `color:${escHtml(color)}` : 'color:var(--text-primary)'}">${val ?? '—'}</span>
         <span class="t2k-stat__lbl">${label}</span>
       </div>`;

    return `
<a href="/teams/${encodeURIComponent(t.id)}" class="t2k-card" style="
  --tc:${escHtml(color)};
  --tc10:${tc10};
  --tc22:${tc22};
">
  <div class="t2k-card__gradient" style="background:linear-gradient(145deg,${tc10} 0%,${tc06} 40%,transparent 70%)"></div>
  <div class="t2k-card__strip" style="background:${escHtml(color)}"></div>
  <span class="t2k-card__wm font-condensed" style="color:${escHtml(color)}">${escHtml(abbr(t.name))}</span>

  <div class="t2k-card__inner">
    <div class="t2k-card__top">
      <div>
        <div class="t2k-card__league">WKND BASKETBALL</div>
        <div class="t2k-card__name font-condensed">${escHtml(t.name.toUpperCase())}</div>
      </div>
      <div class="t2k-record">
        <div class="t2k-record__col">
          <span class="t2k-record__num font-condensed" style="color:${escHtml(color)}">${escHtml(winsDisplay)}</span>
          <span class="t2k-record__lbl">W</span>
        </div>
        <span class="t2k-record__dash">—</span>
        <div class="t2k-record__col">
          <span class="t2k-record__num font-condensed" style="color:var(--text-muted)">${escHtml(lossesDisplay)}</span>
          <span class="t2k-record__lbl">L</span>
        </div>
      </div>
    </div>

    <div class="t2k-card__bottom">
      ${statCol('OFF', t.avgOff)}
      <div class="t2k-bottom__divider"></div>
      ${statCol('DEF', t.avgDef)}
      <div class="t2k-bottom__divider"></div>
      ${statCol('OVR', t.avgOvr, true)}
      <div class="t2k-roster-count">${t.rosterCount} <span>PLAYERS</span></div>
    </div>
  </div>
</a>`;
  }).join('');

  return `
<style>
  .t2k-header { margin-bottom: 28px; }
  .t2k-header__eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .14em; color: var(--amber); text-transform: uppercase; margin-bottom: 6px; }
  .t2k-header__title { font-family: 'Saira Condensed', sans-serif; font-size: 52px; font-weight: 900; line-height: 1; color: var(--text-primary); letter-spacing: -1px; text-transform: uppercase; }

  .t2k-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }

  .t2k-card {
    position: relative; overflow: hidden;
    border-radius: 14px; border: 1px solid var(--border);
    background: var(--surface);
    text-decoration: none; display: block;
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
    min-height: 230px;
  }
  .t2k-card:hover {
    transform: translateY(-5px);
    border-color: var(--tc);
    box-shadow: 0 20px 56px var(--tc22);
  }

  .t2k-card__gradient { position: absolute; inset: 0; pointer-events: none; }
  .t2k-card__strip { position: absolute; left: 0; top: 0; bottom: 0; width: 5px; border-radius: 14px 0 0 14px; }
  .t2k-card__wm {
    position: absolute; right: -8px; bottom: -28px;
    font-size: 150px; font-weight: 900; line-height: 1;
    opacity: .07; pointer-events: none; user-select: none;
    text-transform: uppercase; letter-spacing: -3px;
  }
  .t2k-card__inner {
    position: relative; z-index: 1;
    padding: 28px 28px 24px 36px;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 230px;
  }

  .t2k-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .t2k-card__league { font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
  .t2k-card__name { font-size: 44px; font-weight: 900; line-height: 1; color: var(--text-primary); letter-spacing: -1px; }

  .t2k-record { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 4px; }
  .t2k-record__col { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .t2k-record__num { font-size: 34px; font-weight: 900; line-height: 1; }
  .t2k-record__lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; }
  .t2k-record__dash { font-size: 18px; color: var(--border); line-height: 1; margin-bottom: 10px; }

  .t2k-card__bottom {
    display: flex; align-items: center; gap: 18px;
    padding-top: 16px; margin-top: 16px;
    border-top: 1px solid rgba(255,255,255,.05);
  }
  .t2k-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .t2k-stat__num { font-size: 32px; font-weight: 900; line-height: 1; }
  .t2k-stat__lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .1em; }

  .t2k-bottom__divider { width: 1px; height: 36px; background: rgba(255,255,255,.08); flex-shrink: 0; }

  .t2k-roster-count { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--text-muted); text-align: right; white-space: nowrap; }
  .t2k-roster-count span { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; display: block; margin-top: 1px; }

  @media (max-width: 600px) {
    .t2k-grid { grid-template-columns: 1fr; }
    .t2k-header__title { font-size: 38px; }
    .t2k-card__name { font-size: 34px; }
    .t2k-card__wm { font-size: 110px; }
    .t2k-ovr__num { font-size: 28px; }
    .t2k-record__num { font-size: 26px; }
  }
</style>

  <div class="page-content">

    <div class="t2k-header">
      <div class="t2k-header__eyebrow">WKND Basketball League</div>
      <div class="t2k-header__title">Select Team</div>
    </div>

    <div class="t2k-grid">
      ${cards || '<p style="color:var(--text-muted)">No teams found.</p>'}
    </div>

  </div>
`;
}
