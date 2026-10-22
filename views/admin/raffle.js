// /admin/raffle: Rate & Win (lib/raffle.js). The open round (entries, who can't win and
// why), schedule and minimum, pause / resume / skip, the draw log with each round's seed,
// and the free-run vouchers. There's no "pick a winner" button: draws only happen on
// schedule, from the seed committed when the round opened.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, section, badge, button, emptyState, statStrip, ago, banner } from './ui.js';

const fmtWhen = ms => ms ? new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—';
const table = (head, rows) => `<div class="aui-table-wrap"><table class="aui-table"><thead><tr>${head.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const ROUND_TONE = { open: 'amber', drawn: 'green', rolled: 'blue', skipped: 'gray' };
const V_TONE = { active: 'green', reserved: 'amber', used: 'gray', expired: 'gray' };

// x: { on, settingsHtml (the on/off switch panel, with its save script), raffle, schedule, round, entries: [{ name, n, reason }], rounds: [...], vouchers: [...] }
export function adminRaffleBody(x) {
  const r = x.raffle, round = x.round;
  const eligible = x.entries.filter(e => !e.reason);
  const paused = r.status !== 'active';
  const controls = `<div style="display:flex;gap:8px;flex-wrap:wrap">
    ${button(paused ? 'Resume draws' : 'Pause draws', { kind: paused ? 'primary' : 'secondary', attrs: `data-post-json="/admin/raffle/status" data-body='${JSON.stringify({ status: paused ? 'active' : 'paused' })}' data-done="Saved."` })}
    ${round ? button('Skip this round', { kind: 'ghost', attrs: `data-post-json="/admin/raffle/skip" data-confirm data-confirm-title="Skip Round ${round.number}?" data-confirm-body="No draw this time. Every ticket moves to the next round." data-done="Round skipped."` }) : ''}
  </div>`;
  const schedule = `<form data-json-action="/admin/raffle/schedule" data-done="Schedule saved." class="aui-fields" style="max-width:640px">
    <label class="aui-field"><span class="aui-field__label">First draw (date)</span><input class="aui-input" type="date" name="first_draw" value="${escHtml(x.schedule.first_draw || '')}"></label>
    <label class="aui-field"><span class="aui-field__label">Time (Manila)</span><input class="aui-input" type="time" name="time" value="${escHtml(x.schedule.time || '20:00')}"></label>
    <label class="aui-field"><span class="aui-field__label">Minimum players</span><input class="aui-input" type="number" min="2" max="200" name="min_players" value="${r.min_players}"></label>
    <div style="align-self:end">${button('Save schedule', { kind: 'secondary', type: 'submit' })}</div>
  </form>
  <p class="aui-muted" style="margin-top:8px">Draws repeat every ${x.schedule.every_days || 14} days from the first draw. Changing it moves the open round's draw to the next slot.</p>`;
  const entries = x.entries.length ? table(['Player', 'Tickets', 'Can win?'], x.entries.map(e => `<tr>
      <td>${escHtml(displayPlayerName(e.name))}</td><td>${e.n}</td>
      <td>${e.reason ? badge(e.reason, 'gray') : badge('Yes', 'green')}</td></tr>`)) : emptyState({ title: 'No tickets yet this round', sub: 'They come in as players finish rating their games.' });
  const log = x.rounds.length ? table(['Round', 'Status', 'Winner', 'Players', 'Tickets', 'Draw', 'Seed'], x.rounds.map(o => `<tr>
      <td>${o.number}</td><td>${badge(o.status, ROUND_TONE[o.status])}${o.note ? `<div class="aui-muted">${escHtml(o.note)}</div>` : ''}</td>
      <td>${o.winner ? escHtml(displayPlayerName(o.winner)) : '—'}</td><td>${o.players || '—'}</td><td>${o.tickets || '—'}</td>
      <td class="aui-muted">${escHtml(fmtWhen(o.status === 'open' ? o.draws_at : o.drawn_at))}</td>
      <td><code style="font-size:11px;word-break:break-all">${o.status === 'open' ? `fingerprint ${escHtml(o.seed_hash.slice(0, 16))}…` : escHtml(o.seed.slice(0, 16)) + '…'}</code></td></tr>`)) : emptyState({ title: 'No rounds yet' });
  const vouchers = x.vouchers.length ? table(['Player', 'Prize', 'Status', 'Good through', 'Won'], x.vouchers.map(v => `<tr>
      <td>${escHtml(displayPlayerName(v.player_name || ''))}</td><td>${escHtml(v.label)}</td>
      <td>${badge(v.status === 'reserved' ? 'on a run' : v.status, V_TONE[v.status])}</td>
      <td>${v.expires_season ? `Season ${escHtml(v.expires_season)}` : 'No expiry'}</td><td class="aui-muted">${escHtml(ago(v.created_at))}</td></tr>`)) : emptyState({ title: 'No vouchers yet' });
  return `${pageHeader({ eyebrow: 'Community', title: 'Rate & Win raffle', sub: 'Players earn a ticket for every game they finish rating. The draw runs on its own; nobody picks the winner.', actionsHtml: '<a class="aui-link" href="/raffle">View the raffle page ↗</a>' })}
  ${x.settingsHtml || ''}
  ${!x.on ? `<div style="margin-bottom:16px">${banner('warn', 'The raffle is off. Turn it on in the settings above (and check the DTI sales-promo question first).')}</div>` : ''}
  ${statStrip([
    { label: 'Status', value: !x.on ? 'Off' : paused ? 'Paused' : 'Running' },
    { label: 'Next draw', value: round ? fmtWhen(round.draws_at) : '—' },
    { label: 'Players who can win', value: String(eligible.length), of: ` / min ${r.min_players}` },
    { label: 'Tickets', value: String(eligible.reduce((t, e) => t + e.n, 0)) },
  ])}
  ${section({ title: `Round ${round?.number || '—'}: who's in`, asideHtml: controls, bodyHtml: entries })}
  ${section({ title: 'Schedule', bodyHtml: schedule })}
  ${section({ title: 'Draw log', bodyHtml: log })}
  ${section({ title: 'Free-run vouchers', note: 'used at a Papawis signup, never on the ledger', bodyHtml: vouchers })}`;
}
