import { escHtml } from './layout.js';
import { playerAvatar, playerLink } from './utils.js';

const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', owing: 'Owing', not_charged: '—' };
const STATUS_COLOR = { paid: '#22c55e', partial: '#f59332', owing: '#f87171', not_charged: '#64748b' };

function statusPill(status) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.not_charged;
  return `<span style="background:${color}22;color:${color};border:1px solid ${color}44;border-radius:10px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap">${STATUS_LABEL[status] || '—'}</span>`;
}

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function playerRow(p, status, teamColor) {
  const positions = parsePositions(p.positions);
  return `
  <div class="th-row">
    ${playerAvatar(p.id, p.name, teamColor, { className: 'th-avatar', link: true })}
    <div class="th-row__info">
      ${playerLink(p.id, p.name, { className: 'th-row__name' })}
      ${positions.length ? `<div class="th-row__pos">${positions.map(pos => escHtml(pos)).join(' · ')}</div>` : ''}
    </div>
    ${statusPill(status)}
  </div>`;
}

// teams: [{ team: { id, name, color }, roster: [{ player, status }] }]
// status per player is one of 'paid' | 'partial' | 'owing' | 'not_charged' (the last meaning
// no season fee charge exists yet for them — deliberately distinct from 'owing' so a head
// doesn't read "not yet billed" as "won't pay").
export function teamHeadPage({ teams = [], season = '' } = {}) {
  if (teams.length === 0) {
    return `<div class="page-content">
      <div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">You're not currently set as a head for any team.</div>
    </div>`;
  }

  const sections = teams.map(({ team, roster }) => {
    const paidCount = roster.filter(r => r.status === 'paid').length;
    const rows = roster.length === 0
      ? `<div class="th-empty">No active players on this roster yet.</div>`
      : roster.map(r => playerRow(r.player, r.status, team.color || '#64748b')).join('');
    return `
    <div class="card th-team-card">
      <div class="section-header th-team-card__header">
        <h2><span class="team-dot" style="background:${escHtml(team.color || '#64748b')}"></span> ${escHtml(team.name)}</h2>
        <span class="th-team-card__count">${paidCount}/${roster.length} paid</span>
      </div>
      <div class="th-roster">${rows}</div>
    </div>`;
  }).join('');

  return `<div class="page-content">
    <div class="section-header" style="margin-bottom:16px">
      <h2>My Team${teams.length > 1 ? 's' : ''}</h2>
    </div>
    <p class="th-intro">Roster and season fee status for Season ${escHtml(String(season))} — for reference only, admin handles all payment records.</p>
    ${sections}
  </div>

<style>
.th-intro { font-size: 12.5px; color: var(--text-muted); margin: 0 0 20px; line-height: 1.5; max-width: 560px; }
.th-team-card { padding: 18px 20px 6px; margin-bottom: 16px; }
.th-team-card__header { margin-bottom: 10px; }
.th-team-card__header h2 { display: flex; align-items: center; gap: 8px; }
.th-team-card__count { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.th-roster { display: flex; flex-direction: column; }
.th-empty { font-size: 12.5px; color: var(--text-muted); font-style: italic; padding: 10px 0 18px; }
.th-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); }
.th-row:first-child { border-top: none; }
.th-avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; line-height: 1; color: rgba(255,255,255,.7); background: var(--bg); }
.th-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.th-row__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.th-row__name { font-size: 13.5px; font-weight: 700; }
.th-row__pos { font-size: 10.5px; color: var(--text-muted); font-weight: 600; letter-spacing: .03em; }
@media (max-width: 560px) {
  .th-avatar { width: 30px; height: 30px; }
}
</style>`;
}
