import { escHtml } from './layout.js';
import { displayPlayerName, playerAvatar, playerLink } from './utils.js';

function fmtShareDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderRecordsMode(share, color, teamName, isLight) {
  const chipColor = isLight ? '#10141d' : '#fff';
  const scopeLabel = share.season === 'alltime' ? 'ALL TIME' : `SEASON ${share.season}`;

  let top5 = [];
  try { top5 = JSON.parse(share.top10_json || '[]'); } catch {}

  if (!top5.length) return '';

  const first = top5[0];
  const firstCtxResult = first.game_result || '';
  const firstIsW  = firstCtxResult.startsWith('W');
  const firstIsPO = first.is_playoff === true || first.is_playoff === 1 || first.is_playoff === '1';

  const rows = top5.slice(1).map((x, i) => {
    const tc = escHtml(x.team_color || '#64748b');
    const nameEl = x.player_id
      ? playerLink(x.player_id, x.player_name, { upper: true })
      : escHtml(displayPlayerName(x.player_name).toUpperCase());
    return `<div class="record-panel__row">
      <span class="leader-panel__rank">${i + 2}</span>
      <span class="team-dot" style="background:${tc}"></span>
      <span class="record-panel__row-name">
        ${nameEl} <a href="/games/${encodeURIComponent(x.game_id || '')}" class="record-panel__row-game">${escHtml(fmtShareDate(x.game_date))} · vs ${escHtml(x.game_opp || '')}</a>
      </span>
      <span class="record-panel__row-val font-condensed">${escHtml(x.stat_fmt)}</span>
    </div>`;
  }).join('');

  return `<div class="lsp">

  <div class="lsp-eyebrow">
    <span class="lsp-eyebrow__cat" style="color:${escHtml(color)}">${escHtml(share.stat_label)} RECORD</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>${escHtml(share.stat_title.toUpperCase())}</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>${escHtml(scopeLabel)}</span>
  </div>

  <div class="card leader-panel record-panel" style="--lp-color:${escHtml(color)}">
    <div class="leader-panel__head">
      <span class="leader-panel__cat">${escHtml(share.stat_label)}</span>
      <span class="leader-panel__title">${escHtml(share.stat_title)}</span>
    </div>
    <div class="leader-panel__top" style="background:linear-gradient(135deg,${escHtml(color)}1a 0%,transparent 65%)">
      ${playerAvatar(share.player_id, share.player_name, color, { className: 'leader-avatar', link: true })}
      <div class="leader-panel__info">
        <div class="leader-panel__name">${playerLink(share.player_id, share.player_name, { upper: true })}</div>
        <span class="team-chip" style="background:${escHtml(color)};color:${chipColor}">${escHtml(teamName)}</span>
        <a href="/games/${encodeURIComponent(first.game_id || '')}" class="record-panel__ctx">${escHtml(fmtShareDate(first.game_date))} · vs ${escHtml(first.game_opp || '')} · <span class="${firstIsW ? 'record-ctx--w' : 'record-ctx--l'}">${escHtml(firstCtxResult)}</span>${firstIsPO ? ' <span class="gl-badge gl-badge--po">PO</span>' : ''}</a>
      </div>
      <div class="leader-panel__stat font-condensed">${escHtml(share.stat_fmt)}</div>
    </div>
    ${rows ? `<div class="leader-panel__list">${rows}</div>` : ''}
  </div>

  <div class="lsp-nav">
    <a href="/leaders" class="lsp-nav__back">&larr; League Leaders</a>
    <span class="lsp-nav__brand">WKND Basketball League</span>
  </div>

</div>`;
}

export function leaderSharePage({ share, displayName, teamName, color, isLight }) {
  if (share.mode === 'rec') {
    return renderRecordsMode(share, color, teamName, isLight);
  }

  const chipColor = isLight ? '#10141d' : '#fff';
  const modeLabel = share.mode === 'pg' ? 'PER GAME' : 'TOTALS';

  let top10 = [];
  try { top10 = JSON.parse(share.top10_json || '[]'); } catch {}
  const maxVal = top10[0]?.stat_value || 1;

  const rows = top10.map((p, i) => {
    const pct     = maxVal > 0 ? Math.round(p.stat_value / maxVal * 100) : 0;
    const isFirst = i === 0;
    const tc      = escHtml(p.team_color || '#64748b');
    const nameEl  = p.player_id
      ? playerLink(p.player_id, p.player_name, { upper: true })
      : escHtml(displayPlayerName(p.player_name).toUpperCase());
    return `<div class="lsp-row${isFirst ? ' lsp-row--first' : ''}">
      <span class="lsp-row__rank font-condensed"${isFirst ? ` style="color:${escHtml(color)}"` : ''}>${i + 1}</span>
      <span class="lsp-row__dot" style="background:${tc}"></span>
      <span class="lsp-row__name">${nameEl}</span>
      <div class="lsp-row__bar-wrap">
        <div class="lsp-row__bar" style="--w:${pct}%;background:${tc}22;border-right:2px solid ${tc};animation-delay:${i * 55}ms"></div>
      </div>
      <span class="lsp-row__val font-condensed${isFirst ? ' lsp-row__val--first' : ''}" ${isFirst ? `style="color:${escHtml(color)}"` : ''}>${escHtml(p.stat_fmt)}</span>
    </div>`;
  }).join('');


  return `<div class="lsp">

  <div class="lsp-eyebrow">
    <span class="lsp-eyebrow__cat" style="color:${escHtml(color)}">${escHtml(share.stat_label)} LEADER</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>${escHtml(share.stat_title.toUpperCase())}</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>SEASON ${escHtml(String(share.season))}</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>${escHtml(modeLabel)}</span>
  </div>

  <div class="card lsp-hero" style="--accent:${escHtml(color)}">
    ${playerAvatar(share.player_id, share.player_name, color, { className: 'lsp-avatar', link: true })}
    <div class="lsp-hero__info">
      <div class="lsp-hero__stat font-condensed">${escHtml(share.stat_fmt)}</div>
      <div class="lsp-hero__stat-label">${escHtml(share.stat_title.toUpperCase())}</div>
      <div class="lsp-hero__name">${playerLink(share.player_id, share.player_name, { upper: true })}</div>
      <div class="lsp-hero__chips">
        <span class="team-chip" style="background:${escHtml(color)};color:${chipColor}">${escHtml(teamName)}</span>
      </div>
    </div>
  </div>

  ${top10.length ? `<div class="card lsp-rankings">
    <div class="lsp-rankings__head">TOP 10 &mdash; ${escHtml(share.stat_title.toUpperCase())}</div>
    <div class="lsp-rows">${rows}</div>
  </div>` : ''}

  <div class="lsp-nav">
    <a href="/leaders" class="lsp-nav__back">&larr; League Leaders</a>
    <span class="lsp-nav__brand">WKND Basketball League</span>
  </div>

</div>`;
}
