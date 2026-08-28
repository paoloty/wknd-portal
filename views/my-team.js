import { escHtml } from './layout.js';

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function initials(name) {
  return escHtml((name || '?').charAt(0).toUpperCase());
}

function sizeChip(top, shorts) {
  if (!top && !shorts) return `<span class="mt-chip mt-chip--muted">Size: —</span>`;
  const parts = [top ? `Top ${escHtml(top)}` : '', shorts ? `Shorts ${escHtml(shorts)}` : ''].filter(Boolean);
  return `<span class="mt-chip">${parts.join(' · ')}</span>`;
}

function numberChip(number) {
  return `<span class="mt-chip mt-chip--num">#${escHtml(String(number))}</span>`;
}

function rosterRow(p, teamColor, viewerIsHead) {
  const positions = parsePositions(p.positions);
  const avatar = p.pictureUrl
    ? `<img src="${escHtml(p.pictureUrl)}" alt="">`
    : initials(p.name);

  let numberSlot;
  if (!p.isNew || p.number) {
    numberSlot = numberChip(p.number || '—');
  } else if (viewerIsHead) {
    numberSlot = `
      <form class="mt-num-form" data-signup-id="${escHtml(p.signupId)}">
        <input type="text" inputmode="numeric" maxlength="2" placeholder="##" class="mt-num-input" aria-label="Jersey number for ${escHtml(p.name)}">
        <button type="submit" class="mt-num-save">Save</button>
        <span class="mt-num-error"></span>
      </form>`;
  } else {
    numberSlot = `<span class="mt-chip mt-chip--muted">Number pending</span>`;
  }

  return `
  <div class="mt-row">
    <div class="mt-avatar" style="border-color:${escHtml(teamColor || '#1e293b')}">${avatar}</div>
    <div class="mt-row__info">
      <div class="mt-row__name">
        ${escHtml(p.name)}
        ${p.isNew  ? `<span class="mt-badge mt-badge--new">NEW</span>` : ''}
        ${p.isHead ? `<span class="mt-badge mt-badge--head">TEAM HEAD</span>` : ''}
      </div>
      ${positions.length ? `<div class="mt-row__pos">${positions.map(escHtml).join(' · ')}</div>` : ''}
    </div>
    <div class="mt-row__meta">
      ${sizeChip(p.jerseyTop, p.jerseyShorts)}
      ${numberSlot}
    </div>
  </div>`;
}

export function myTeamPage({ notPublished = false, notAssigned = false, team = null, roster = [], season = '', viewerIsHead = false } = {}) {
  if (notPublished) {
    return `<div class="page-content">
      <div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">
        Team assignments for next season haven't been published yet — check back soon.
      </div>
    </div>`;
  }
  if (notAssigned) {
    return `<div class="page-content">
      <div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">
        You're not on a team roster for Season ${escHtml(String(season))} yet.
      </div>
    </div>`;
  }

  const rows = roster.map(p => rosterRow(p, team?.color, viewerIsHead)).join('');

  return `<div class="page-content">
    <div class="section-header" style="margin-bottom:16px">
      <h2><span class="team-dot" style="background:${escHtml(team?.color || '#64748b')}"></span> ${escHtml(team?.name || 'My Team')}</h2>
    </div>
    <p class="mt-intro">
      Season ${escHtml(String(season))} team preview — rosters aren't final until the season officially starts.
      ${viewerIsHead ? ' As team head, you can fill in jersey numbers for new players below.' : ''}
    </p>
    <div class="card mt-card">
      <div class="mt-roster">${rows}</div>
    </div>
  </div>

<style>
.mt-intro { font-size: 12.5px; color: var(--text-muted); margin: 0 0 20px; line-height: 1.5; max-width: 620px; }
.mt-card { padding: 8px 20px; }
.mt-roster { display: flex; flex-direction: column; }
.mt-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); flex-wrap: wrap; }
.mt-row:first-child { border-top: none; }
.mt-avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: rgba(255,255,255,.7); background: var(--bg); }
.mt-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.mt-row__info { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 2px; }
.mt-row__name { font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mt-row__pos { font-size: 10.5px; color: var(--text-muted); font-weight: 600; letter-spacing: .03em; }
.mt-row__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.mt-badge { font-size: 8.5px; font-weight: 800; letter-spacing: .06em; padding: 1px 5px; border-radius: 3px; line-height: 1.5; }
.mt-badge--new { background: #22c55e18; color: #22c55e; border: 1px solid #22c55e33; }
.mt-badge--head { background: #f5933218; color: var(--amber); border: 1px solid #f5933233; }
.mt-chip { font-size: 11px; font-weight: 600; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 3px 10px; white-space: nowrap; }
.mt-chip--num { font-family: 'Saira Condensed', sans-serif; font-weight: 700; }
.mt-chip--muted { color: var(--text-muted); font-weight: 500; }
.mt-num-form { display: flex; align-items: center; gap: 6px; position: relative; }
.mt-num-input { width: 44px; height: 26px; text-align: center; font-size: 12px; font-weight: 700; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); outline: none; }
.mt-num-input:focus { border-color: var(--amber); }
.mt-num-save { height: 26px; padding: 0 10px; font-size: 11px; font-weight: 700; background: var(--amber); color: #1a1206; border: none; border-radius: 6px; cursor: pointer; }
.mt-num-save:disabled { opacity: .5; cursor: default; }
.mt-num-error { font-size: 10.5px; color: #f87171; position: absolute; top: 28px; left: 0; white-space: nowrap; }
@media (max-width: 560px) {
  .mt-avatar { width: 30px; height: 30px; }
  .mt-row__meta { margin-left: 0; }
}
</style>

<script>
document.querySelectorAll('.mt-num-form').forEach(function(form) {
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var input   = form.querySelector('.mt-num-input');
    var saveBtn = form.querySelector('.mt-num-save');
    var errEl   = form.querySelector('.mt-num-error');
    var number  = input.value.trim();
    errEl.textContent = '';
    if (!/^\\d{1,2}$/.test(number)) { errEl.textContent = 'Enter 0–99.'; return; }
    input.disabled = true; saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      var r = await fetch('/my-team/number', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId: form.dataset.signupId, number: number }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      var chip = document.createElement('span');
      chip.className = 'mt-chip mt-chip--num';
      chip.textContent = '#' + d.number;
      form.replaceWith(chip);
    } catch (err) {
      errEl.textContent = err.message;
      input.disabled = false; saveBtn.disabled = false; saveBtn.textContent = 'Save';
    }
  });
});
</script>`;
}
