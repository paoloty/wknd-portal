// Admin: "Make POTG video" for one game (/admin/games/:id/potg-video). One panel per POTG
// (two for a co-POTG game): the stat line is filled from the box score, the admin picks which
// 2-3 numbers to feature and the chip, adds exactly 6 photos and frames each one (drag to move,
// slider to zoom). Saving queues one background render per player and goes to the Processing
// list (/admin/media). Browser side: public/admin-potg-video.js. Video look:
// assets/media/potg/template.html.
import { escHtml } from '../layout.js';
import { breadcrumb, section, button, emptyState, banner } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

const SLOT_HINTS = ['Hero shot', 'Signature play', 'Wide, in the game', 'Tight: face / intensity', 'Another action angle', 'Emotion to close'];

function playerPanel(p, { cats, photoCount }) {
  const statBoxes = cats.map(c => {
    const v = p.line[c.key];
    const on = p.suggestedStats.includes(c.key);
    return `<label class="pv-stat${on ? ' is-on' : ''}"><input type="checkbox" value="${attr(c.key)}" data-pv-stat${on ? ' checked' : ''}>
      <b>${attr(v)}</b><span>${attr(c.label)}</span></label>`;
  }).join('');
  const slots = Array.from({ length: photoCount }, (_, i) => `
    <div class="pv-slot" data-pv-slot="${i}">
      <div class="pv-frame" data-pv-frame>
        <img alt="" draggable="false" hidden data-pv-img>
        <div class="pv-guide pv-guide--logo"></div><div class="pv-guide pv-guide--stats"><span>stats</span></div>
        <label class="pv-empty" data-pv-empty><input type="file" accept="image/*" multiple hidden data-pv-file><span class="pv-empty__n">${i + 1}</span><span>${attr(SLOT_HINTS[i] || 'Photo')}</span><span class="aui-muted">Tap to add</span></label>
        <div class="pv-busy" hidden data-pv-busy>Uploading…</div>
      </div>
      <div class="pv-tools" hidden data-pv-tools>
        <input type="range" min="1" max="2.5" step="0.01" value="1" aria-label="Zoom" data-pv-zoom>
        <div class="pv-tools__row">
          <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-pv-move="-1" title="Move earlier">←</button>
          <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-pv-auto title="Back to the auto framing">Auto</button>
          <label class="aui-btn aui-btn--ghost aui-btn--sm" title="Replace">Replace<input type="file" accept="image/*" hidden data-pv-replace></label>
          <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-pv-remove title="Remove">✕</button>
          <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-pv-move="1" title="Move later">→</button>
        </div>
      </div>
    </div>`).join('');
  return section({
    title: `${p.role === 'CO-POTG' ? 'Co-player of the game' : 'Player of the game'} · ${p.first} ${p.last}`,
    note: `· ${p.teamTitle} · ${p.result} vs ${p.oppTitle}`,
    bodyHtml: `<div class="aui-panel pv-player" data-pv-player="${attr(p.playerId)}">
      <div class="pv-meta">
        <label class="aui-field"><span class="aui-field__label">Jersey # in this game</span>
          <input class="aui-input pv-num" inputmode="numeric" maxlength="3" value="${attr(p.number)}" data-pv-number></label>
        <label class="aui-field pv-chipfield"><span class="aui-field__label">Chip <span class="aui-muted">(optional)</span></span>
          <input class="aui-input" maxlength="32" value="${attr(p.suggestedChip)}" placeholder="e.g. DOUBLE-DOUBLE" data-pv-chip></label>
      </div>
      <div class="aui-field__label pv-label">Big numbers <span class="aui-muted">· pick up to 3</span></div>
      <div class="pv-stats">${statBoxes}</div>
      <div class="aui-field__label pv-label">Photos <span class="aui-muted">· exactly ${photoCount}, in order. Drag to move, slider to zoom. Keep him clear of the stats area.</span></div>
      <div class="pv-slots">${slots}</div>
    </div>`,
  });
}

export function adminPotgVideoBody({ game, ctx, cats, photoCount, ver }) {
  const title = `${game.team_a_name} vs ${game.team_b_name}`;
  const head = `${breadcrumb([{ label: 'Games', href: '/admin/games' }, { label: title, href: `/admin/games/${encodeURIComponent(game.id)}?tab=content` }, { label: 'POTG video' }])}
    <header class="aui-head"><div class="aui-head__text"><div class="aui-head__eyebrow">Player of the game video</div>
      <h1 class="aui-head__title">${escHtml(title)}</h1>
      <p class="aui-head__sub">${ctx.co ? 'Co-POTG game: this makes two videos, one per player.' : 'One video, about 33 seconds, 1080×1350.'} It renders in the background; you'll find it under Processing.</p></div></header>`;
  if (!ctx.players.length) return `<div class="aui-page">${head}${emptyState({ title: 'No player of the game yet', sub: 'Pick the POTG on the game’s Content tab first.' })}</div>`;
  return `<div class="aui-page pv-page" data-pv-page data-game="${attr(game.id)}" data-count="${photoCount}">
    ${head}
    ${ctx.players.map(p => playerPanel(p, { cats, photoCount })).join('')}
    <div class="pv-savebar">
      <span class="aui-muted" data-pv-status>Add ${photoCount} photos${ctx.co ? ' for each player' : ''} to render.</span>
      ${button(ctx.co ? 'Render both videos' : 'Render video', { kind: 'primary', attrs: 'disabled data-pv-save' })}
    </div>
  </div>
  <script src="/admin-potg-video.js${ver ? `?v=${ver}` : ''}" defer></script>`;
}

// ── Processing list (/admin/media) ───────────────────────────────────────────────────────
const STATUS = { queued: ['Queued', 'gray'], processing: ['Processing', 'amber'], done: ['Ready', 'green'], failed: ['Failed', 'red'], expired: ['Expired', 'gray'] };

export function mediaJobRow(j, outputs, fmtWhen, expiresAt = null) {
  const [label, tone] = STATUS[j.status] || [j.status, 'gray'];
  const pct = Math.round((j.progress || 0) * 100);
  const files = j.status === 'done'
    ? `<div class="mj-files">${outputs.map(f => `<a class="aui-btn aui-btn--secondary aui-btn--sm" href="/admin/media/${attr(j.id)}/${attr(f.name)}" download>${escHtml(f.label)}</a>`).join('')}</div>`
    : '';
  const bar = j.status === 'processing'
    ? `<div class="mj-bar"><span style="width:${pct}%"></span></div><div class="aui-muted mj-stage">${escHtml(j.stage || 'Working')} · ${pct}%</div>`
    : j.status === 'queued' ? '<div class="aui-muted mj-stage">Waiting for the renderer…</div>' : '';
  const left = j.status === 'done' && expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : null;
  const note = left != null ? `<div class="aui-muted mj-stage">${left <= 1 ? 'Deletes from the server within a day. Download it now.' : `Deletes from the server in ${left} days.`}</div>`
    : j.status === 'expired' ? '<div class="aui-muted mj-stage">Files deleted after 30 days. Make again to re-render.</div>' : '';
  const err = j.status === 'failed' ? `<pre class="mj-err">${escHtml(j.error || 'Unknown error')}</pre>` : '';
  const actions = [
    j.status === 'failed' ? `<button type="button" class="aui-btn aui-btn--secondary aui-btn--sm" data-mj-retry="${attr(j.id)}">Retry</button>` : '',
    j.status !== 'processing' ? `<button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-mj-delete="${attr(j.id)}">Delete</button>` : '',
    j.game_id ? `<a class="aui-btn aui-btn--ghost aui-btn--sm" href="/admin/games/${attr(encodeURIComponent(j.game_id))}/potg-video">Make again</a>` : '',
  ].join('');
  return `<div class="aui-panel mj-row" data-mj="${attr(j.id)}" data-mj-status="${attr(j.status)}">
    <div class="mj-top"><div><div class="mj-title">${escHtml(j.title || j.kind)}</div><div class="aui-muted mj-when">${escHtml(fmtWhen(j.created_at))}</div></div>
      <span class="aui-badge aui-badge--${tone}">${escHtml(label)}</span></div>
    ${bar}${err}${files}${note}
    <div class="mj-actions">${actions}</div>
  </div>`;
}

export function adminMediaBody({ jobs, outputs, fmtWhen, expiresAt, ver }) {
  const rows = jobs.length ? jobs.map(j => mediaJobRow(j, outputs, fmtWhen, expiresAt?.(j))).join('') : emptyState({ title: 'Nothing processing', sub: 'Videos you make (e.g. a game’s POTG video) show up here while they render.' });
  return `<div class="aui-page" data-mj-page>
    <header class="aui-head"><div class="aui-head__text"><div class="aui-head__eyebrow">Content</div><h1 class="aui-head__title">Processing</h1>
      <p class="aui-head__sub">Videos render in the background, one at a time. This page updates itself; you can leave and come back. Finished videos stay for 30 days, then their files are deleted automatically.</p></div></header>
    <div class="mj-list" data-mj-list>${rows}</div>
  </div>
  <script src="/admin-media.js${ver ? `?v=${ver}` : ''}" defer></script>`;
}
