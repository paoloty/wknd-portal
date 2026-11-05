// /admin/fines: Conduct → Cases and Categories (rewrite, 2026-11). A case moves from a player's report
// (pending_admin: admins vote on escalating it) to open (the player is told and has 72 hours to
// answer; votes are guidance, an admin decides) to approved (a fine or a warning), rejected,
// dismissed or voided (cancelled). The rules are lib/conduct.js, published at /rules/conduct.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, breadcrumb, section, needsYou, statStrip, dataGrid, badge, button, drawer, field, fieldGrid, playerPicker, emptyState } from './ui.js';

const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const fmtDate = ms => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—');
const fmtDay = ms => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '—');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pts = n => plural(n, 'pt', 'pts');
const none = '<span class="asr-none">None</span>';
const todayYmd = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

const STATUS = { approved: ['Fined', 'blue'], rejected: ['Rejected', 'gray'], pending_admin: ['Needs escalation vote', 'amber'], dismissed: ['Dismissed', 'gray'], open: ['Open', 'amber'], voided: ['Cancelled', 'gray'] };
const statusBadge = c => (c.status === 'approved' && c.kind === 'warning' ? badge('Warning', 'gray') : badge(...(STATUS[c.status] || [c.status, 'gray'])));
// Only a charged case has anything to pay: anything else shows nothing, not an "Unpaid".
const charged = c => c.status === 'approved' && !!c.transaction_id;
const paidBadge = c => (!charged(c) ? none : c.paid_at ? badge('Paid', 'green') : c.due_at && c.due_at < Date.now() && c.appeal_status !== 'pending' ? badge('Overdue', 'red') : badge('Unpaid', 'amber'));

const row = (who, text, asideHtml = '') => `<div class="aas-qa"><div class="aas-qa__text"><div class="aas-qa__q">${who}</div><div class="aas-qa__a">${text}</div></div>${asideHtml}</div>`;
const list = rows => `<div class="aui-panel aas-list">${rows.join('')}</div>`;
const note = text => `<p class="alv-note">${text}</p>`;

function reportDrawer({ players, categories, contexts }) {
  return drawer({
    id: 'fine-report', eyebrow: 'Conduct', title: 'Report incident',
    bodyHtml: `<form id="fine-report-form" class="afn-form" data-json-action="/admin/fines" data-then="/admin/fines/{id}" data-done="Report filed.">
      ${playerPicker({ name: 'playerId', label: 'Player', multiple: false, options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name) })) })}
      ${field({ label: 'Category', name: 'categoryId', type: 'select', wide: true, options: categories.map(c => [c.id, `${c.label} (${peso(c.amount)}${c.points ? `, ${pts(c.points)}` : ''})`]) })}
      ${fieldGrid(`${field({ label: 'When', name: 'incidentDate', type: 'date', value: todayYmd(), id: 'afn-date', attrs: `max="${todayYmd()}"` })}
        ${field({ label: 'Where', name: 'context', type: 'select', id: 'afn-ctx', options: Object.entries(contexts) })}`)}
      ${field({ label: 'What happened', name: 'description', type: 'textarea', rows: 4, wide: true, required: true, placeholder: 'What happened, where, and who else saw it' })}
      ${note('The player is told today and has 72 hours to give their side before anyone decides.')}
    </form>`,
    footerHtml: button('File report', { kind: 'primary', type: 'submit', attrs: 'form="fine-report-form"' }),
  });
}

export function adminFinesListBody({ pendingAdmin = [], open = [], resolved = [], appeals = [], players = [], categories = [], summary = null, query = {}, contexts = {} } = {}) {
  const s = summary || { caseCount: 0, paidCount: 0, totalFined: 0, totalPaid: 0, totalOutstanding: 0 };
  const waiting = c => c.status === 'open' || c.status === 'pending_admin' || c.appeal_status === 'pending';
  const unpaid = c => charged(c) && !c.paid_at;
  const rows = [...pendingAdmin, ...open, ...resolved].map(c => ({ ...c, name: displayPlayerName(c.player_name) }));
  const now = Date.now();
  const ready = open.filter(c => c.response_at || (c.respond_by || 0) <= now);

  const grid = dataGrid({
    id: 'cases', baseUrl: '/admin/fines', query, minimal: true, perPage: 50,
    rows, rowKey: c => c.id, noun: ['case', 'cases'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'waiting', label: 'Waiting', test: waiting },
      { key: 'unpaid', label: 'Unpaid', test: unpaid },
      { key: 'closed', label: 'Closed', test: c => !waiting(c) },
    ],
    search: { placeholder: 'Search player or category', text: c => `${c.name} ${c.category_label}` },
    columns: [
      { key: 'name', label: 'Player', primary: true, cell: c => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(c.name)}</span><span class="aui-cell__sub">${escHtml(c.category_label)}</span></span>` },
      { key: 'status', label: 'Status', bare: true, cell: c => `<span class="aui-cell__badges">${statusBadge(c)}${c.appeal_status === 'pending' ? badge('Appeal', 'amber') : ''}</span>` },
      { key: 'amount', label: 'Fine', num: true, phone: true, cell: c => `${peso(c.amount)}${c.points ? ` <span class="asr-none">${pts(c.points)}</span>` : ''}` },
      { key: 'paid', label: 'Paid', phone: false, cell: paidBadge },
      { key: 'by', label: 'Reported by', phone: true, cell: c => escHtml(c.reported_by_name) },
      { key: 'date', label: 'Date', phone: false, cell: c => escHtml(fmtDay(c.incident_at || c.created_at)) },
    ],
    rowHref: c => `/admin/fines/${c.id}`,
    empty: { title: 'No cases yet', sub: 'Reports from players and admins show here.' },
  });

  return `<div class="aui-page">
    ${pageHeader({
      title: 'Conduct',
      sub: 'Reports, votes, fines and warnings, under the published conduct rules.',
      actionsHtml: `${button('Rules', { href: '/rules/conduct', attrs: 'target="_blank" rel="noopener"' })}${button('Team heads', { href: '/admin/team-heads' })}${categories.length ? button('Report incident', { kind: 'primary', attrs: 'data-drawer-open="fine-report"' }) : ''}`,
    })}
    ${needsYou([
      pendingAdmin.length && { title: `${plural(pendingAdmin.length, 'player report')} to vote on`, sub: 'Admins decide whether each goes to the team heads.', href: pendingAdmin.length === 1 ? `/admin/fines/${pendingAdmin[0].id}` : '/admin/fines?view=waiting', label: 'Vote', hot: true },
      ready.length && { title: `${plural(ready.length, 'case')} ready to decide`, sub: 'The player has answered or their 72 hours are up.', href: ready.length === 1 ? `/admin/fines/${ready[0].id}` : '/admin/fines?view=waiting', label: 'Decide' },
      open.length > ready.length && { title: `${plural(open.length - ready.length, 'case')} waiting on the player`, sub: 'They have 72 hours to give their side.', href: '/admin/fines?view=waiting', label: 'View' },
      appeals.length && { title: `${plural(appeals.length, 'appeal')}`, sub: 'Two heads from teams not involved weigh in, then the super admin decides.', href: appeals.length === 1 ? `/admin/fines/${appeals[0].id}` : '/admin/fines?view=waiting', label: 'Review' },
    ])}
    ${statStrip([
      { label: 'Total fined', value: peso(s.totalFined) },
      { label: 'Collected', value: peso(s.totalPaid) },
      { label: 'Outstanding', value: peso(s.totalOutstanding) },
      { label: 'Fines paid', value: String(s.paidCount), of: ` of ${s.caseCount}` },
    ])}
    ${grid}
    ${categories.length ? reportDrawer({ players, categories, contexts }) : ''}
  </div>`;
}

// The player's season on every case, before anyone votes or decides, and what they owe in games.
function conductSection(s, standing) {
  if (!s) return '';
  const label = s.needsReview ? 'League review' : s.gamesSuspended > 0 ? plural(s.gamesSuspended, 'game') : 'None';
  const owed = standing?.active ? (standing.rest ? 'Rest of the season' : plural(standing.left, 'game')) : 'None';
  const played = (standing?.cases || []).reduce((n, c) => n + c.playedWhile.length, 0);
  return section({
    title: 'This season',
    bodyHtml: `${statStrip([{ label: 'Conduct points', value: String(s.activePoints) }, { label: 'Ladder', value: label }, { label: 'Games left to sit', value: owed }])}
      ${played ? `<p class="alv-note afn-note">Played ${plural(played, 'league game')} while suspended. Those don't count as served.</p>` : ''}`,
  });
}

const CONTEXT_LABEL = { league: 'League game', papawis: 'Papawis run', online: 'Online', other: 'Elsewhere' };
const descriptionSection = c => section({
  title: 'What happened',
  note: `${CONTEXT_LABEL[c.incident_context] || 'League game'}, ${fmtDay(c.incident_at || c.created_at)} · reported by ${c.reported_by_name} (${c.reported_by_type}), ${fmtDate(c.created_at)}${c.late ? ' · reported late: a warning at most' : ''}`,
  bodyHtml: `<div class="aui-panel">${c.description ? `<span class="asu-comment">${escHtml(c.description)}</span>` : '<span class="asr-none">No description.</span>'}</div>`,
});

// Their side (conduct rule 8): told when the case opened, 72 hours to answer.
function responseSection(c) {
  if (!c.opened_at) return '';
  const body = c.response
    ? `<span class="asu-comment">${escHtml(c.response)}</span><p class="alv-note">${escHtml(fmtDate(c.response_at))}</p>`
    : c.status === 'open' && (c.respond_by || 0) > Date.now()
      ? `<span class="asr-none">Told ${escHtml(fmtDate(c.opened_at))}. They have until ${escHtml(fmtDate(c.respond_by))} to answer.</span>`
      : '<span class="asr-none">They didn’t answer.</span>';
  return section({ title: 'Their side', bodyHtml: `<div class="aui-panel">${body}</div>` });
}

const logSection = log => (log.length ? section({ title: 'History', bodyHtml: list(log.map(l => row(escHtml(l.by), escHtml(l.what), `<span class="asr-none">${escHtml(fmtDate(l.at))}</span>`))) }) : '');

const postButton = (id, path, label, kind, body, withSel, extra = '') => button(label, { kind, attrs: `data-post-json="/admin/fines/${escHtml(id)}/${path}" data-body='${escHtml(JSON.stringify(body))}'${withSel ? ` data-with="${withSel}"` : ''} ${extra}` });

function escalationView(c, { escalationVotes, totalAdmins, viewerAdminId, isSuperAdmin, suspension, standing, heading, voteBlock, categories }) {
  const pending = c.status === 'pending_admin';
  const up = escalationVotes.filter(v => v.vote === 'escalate').length;
  const down = escalationVotes.filter(v => v.vote === 'dismiss').length;
  const upNeeded = Math.floor(totalAdmins / 2) + 1;
  const mine = escalationVotes.find(v => v.admin_id === viewerAdminId);
  const votes = escalationVotes.map(v => row(escHtml(v.admin_name), v.comment ? escHtml(v.comment) : '<span class="asr-none">No comment</span>', `<span class="aui-cell__badges">${v.vote === 'escalate' ? badge('Escalate', 'amber') : badge('Dismiss', 'gray')}<span class="asr-none">${escHtml(fmtDate(v.created_at))}</span></span>`));
  return `${heading}
    <div class="aui-cols">
      <div class="aui-cols__main">
        ${descriptionSection(c)}
        ${section({ title: `Escalation votes (${up} escalate, ${down} dismiss)`, note: pending ? `${upNeeded} of ${totalAdmins} admins needed to escalate, ${totalAdmins - upNeeded + 1} to dismiss` : '', bodyHtml: votes.length ? list(votes) : '<div class="aui-panel asr-none">No votes yet.</div>' })}
        ${pending ? section({
          title: mine ? `Your vote: ${mine.vote === 'escalate' ? 'Escalate' : 'Dismiss'}` : 'Your vote',
          bodyHtml: voteBlock ? `<div class="aui-panel">${note(escHtml(voteBlock))}</div>` : `<div class="aui-panel afn-form">${field({ label: 'Comment (optional)', name: 'comment', type: 'textarea', rows: 2, value: mine?.comment || '', id: 'afn-comment' })}
            <div class="aui-row">${postButton(c.id, 'escalate-vote', 'Escalate to heads', 'primary', { vote: 'escalate' }, '#afn-comment', 'data-done="Vote saved."')}${postButton(c.id, 'escalate-vote', 'Dismiss', 'secondary', { vote: 'dismiss' }, '#afn-comment', 'data-done="Vote saved."')}</div></div>`,
        }) : ''}
        ${logSection(c.__log)}
      </div>
      <aside class="aui-cols__side">
        ${conductSection(suspension, standing)}
        ${pending ? categorySection(c, categories, voteBlock) : ''}
        ${pending ? section({
          title: 'Escalation',
          bodyHtml: `<div class="aui-panel afn-form">${note('A player filed this. Once most admins vote to escalate, the player is told and it goes to the team heads. An admin still decides after that.')}
            ${isSuperAdmin ? `${note('If the vote has stalled, super admin can settle it, with a reason:')}
              ${field({ label: 'Why', name: 'note', type: 'textarea', rows: 2, id: 'afn-force-note' })}
              <div class="aui-row">
              ${postButton(c.id, 'force-escalation', 'Force escalate', 'secondary', { escalate: true }, '#afn-force-note', 'data-confirm data-confirm-title="Escalate this case to the team heads?" data-confirm-send="Escalate" data-done="Escalated."')}
              ${postButton(c.id, 'force-escalation', 'Force dismiss', 'danger', { escalate: false }, '#afn-force-note', 'data-confirm data-confirm-title="Dismiss this case?" data-confirm-body="The player who reported it gets told it wasn\'t escalated." data-confirm-send="Dismiss" data-done="Dismissed."')}
            </div>` : ''}</div>`,
        }) : section({
          title: 'Result',
          bodyHtml: `<div class="aui-panel afn-form"><p class="afn-result">${c.resolution_note ? escHtml(c.resolution_note) : `Dismissed by admin vote, ${down} to ${up}.`}</p>${note('Never reached the team heads. The player who reported it was told.')}</div>`,
        })}
      </aside>
    </div>`;
}

function categorySection(c, categories, block) {
  if (block || !categories.length) return '';
  return section({
    title: 'Category',
    bodyHtml: `<div class="aui-panel afn-form">
      ${field({ label: 'Charge it as', name: 'categoryId', type: 'select', value: c.category_id, id: 'afn-cat', options: categories.map(k => [k.id, `${k.label} (${peso(k.amount)}${k.points ? `, ${pts(k.points)}` : ''})`]) })}
      <div class="aui-row">${postButton(c.id, 'category', 'Change category', 'secondary', {}, '#afn-cat', 'data-done="Category changed."')}</div></div>`,
  });
}

function decidePanel(c, { name, canDecide, decideOpensAt, decideBlock, evidence, accusedAdmin }) {
  if (decideBlock) return `<div class="aui-panel">${note(escHtml(decideBlock))}</div>`;
  if (!canDecide) return `<div class="aui-panel">${note(`They have until <b>${escHtml(fmtDate(decideOpensAt))}</b> to give their side. Decide opens then, or as soon as they answer.`)}</div>`;
  const charge = `${peso(c.amount)}${c.points ? ` and ${pts(c.points)}` : ''}`;
  return `<div class="aui-panel afn-form">
    ${note(`Votes are guidance, and the call is yours. A fine charges ${escHtml(charge)} as a Penalty, due in 14 days. A warning is ₱0 and 0 points, on their record.${accusedAdmin ? ' They\'re an admin, so this is the super admin\'s call.' : ''}`)}
    ${field({ label: 'What it rests on', name: 'evidence', type: 'select', id: 'afn-evidence', options: [['', 'Pick one'], ...Object.entries(evidence)], help: c.late ? 'Reported late: a warning at most.' : 'One player’s word supports a warning, never a fine.' })}
    ${field({ label: 'Reason (the player reads it)', name: 'note', type: 'textarea', rows: 3, id: 'afn-note' })}
    <div class="aui-row">
      ${c.late ? '' : postButton(c.id, 'resolve', `Fine ${peso(c.amount)}`, 'primary', { outcome: 'fine' }, '#afn-note,#afn-evidence', `data-confirm data-confirm-title="Fine ${escHtml(name)} ${peso(c.amount)}?" data-confirm-body="This charges their ledger and tells them. A second case at the same level this season is charged one level up." data-confirm-send="Fine" data-done="Fine approved."`)}
      ${postButton(c.id, 'resolve', 'Warning', 'secondary', { outcome: 'warning' }, '#afn-note,#afn-evidence', `data-confirm data-confirm-title="Give ${escHtml(name)} a warning?" data-confirm-body="₱0 and 0 points, on their record. Their third this season opens a Level 1 case." data-confirm-send="Give warning" data-done="Warning given."`)}
      ${postButton(c.id, 'resolve', 'Reject', 'ghost', { outcome: 'reject' }, '#afn-note,#afn-evidence', `data-confirm data-confirm-title="Reject this case?" data-confirm-body="No fine, no warning. ${escHtml(name)} is told it was closed." data-confirm-send="Reject" data-done="Case rejected."`)}
    </div>
  </div>`;
}

function appealSection(c, { appealVotes, appealReady, appealDecider, appealHeads, categories }) {
  if (!c.appeal_at) return '';
  const views = appealVotes.map(v => row(escHtml(v.voter_name), v.comment ? escHtml(v.comment) : '<span class="asr-none">No comment</span>', badge(v.vote === 'uphold' ? 'Keep it' : 'Lower it', 'gray')));
  const decided = c.appeal_status !== 'pending';
  const lower = categories.filter(k => k.level > 0 && k.level < c.level);
  const body = `<div class="aui-panel afn-form">
    <span class="asu-comment">${escHtml(c.appeal_text)}</span>
    ${note(`Appealed ${escHtml(fmtDate(c.appeal_at))}.`)}
    ${views.length ? list(views) : note(`No head has weighed in yet.${appealHeads.length ? ` Heads who can: ${escHtml(appealHeads.join(', '))}.` : ''}`)}
    ${decided ? `<p class="afn-result">${escHtml({ upheld: 'Upheld', lowered: 'Lowered', cancelled: 'Cancelled' }[c.appeal_status] || c.appeal_status)} by <b>${escHtml(c.appeal_decided_by)}</b>, ${escHtml(fmtDate(c.appeal_decided_at))}.</p><span class="asu-comment">${escHtml(c.appeal_note)}</span>`
      : !appealDecider ? note(c.reported_by_id === 'super_admin' ? 'The super admin filed this case, so another admin decides the appeal.' : 'The super admin decides the appeal.')
      : !appealReady ? note('Decide opens once two heads from teams not involved weigh in, or 7 days after the appeal.')
      : `${field({ label: 'Lower to', name: 'categoryId', type: 'select', id: 'afn-appeal-cat', options: [...lower.map(k => [k.id, `${k.label} (${peso(k.amount)})`]), ['warning', 'A warning']] })}
        ${field({ label: 'Reason (the player reads it)', name: 'note', type: 'textarea', rows: 3, id: 'afn-appeal-note' })}
        <div class="aui-row">
          ${postButton(c.id, 'appeal', 'Keep the decision', 'primary', { outcome: 'upheld' }, '#afn-appeal-note', 'data-done="Upheld."')}
          ${postButton(c.id, 'appeal', 'Lower it', 'secondary', { outcome: 'lowered' }, '#afn-appeal-note,#afn-appeal-cat', 'data-confirm data-confirm-title="Lower this decision?" data-confirm-body="The old charge comes off their ledger and the lower one goes on." data-confirm-send="Lower" data-done="Lowered."')}
          ${postButton(c.id, 'appeal', 'Cancel the case', 'danger', { outcome: 'cancelled' }, '#afn-appeal-note', 'data-confirm data-confirm-title="Cancel this case on appeal?" data-confirm-body="The fine, the points and any suspension go." data-confirm-send="Cancel case" data-done="Cancelled."')}
        </div>`}
  </div>`;
  return section({ title: decided ? 'Appeal' : 'Appeal (fine on hold)', bodyHtml: body });
}

function resultPanel(c, { isSuperAdmin }) {
  const charge = `${peso(c.amount)}${c.points ? ` and ${pts(c.points)}` : ''}`;
  const susp = c.suspension_games === -1 ? 'Suspended for the rest of the season.' : c.suspension_games > 0 ? `Suspended ${plural(c.suspension_games, 'league game')}.` : '';
  return `<div class="aui-panel afn-form">
    <p class="afn-result">${c.status === 'voided' ? 'Cancelled' : 'Decided'} by <b>${escHtml(c.status === 'voided' ? c.voided_by : c.resolved_by_name)}</b>, ${escHtml(fmtDate(c.status === 'voided' ? c.voided_at : c.resolved_at))}.</p>
    ${c.resolution_note ? `<span class="asu-comment">${escHtml(c.resolution_note)}</span>` : ''}
    ${c.evidence ? note(`Rests on: ${escHtml({ video: 'video', official: "a referee's or scorer's account", witnesses: 'two independent witnesses', one_player: "one player's word" }[c.evidence] || c.evidence)}.`) : ''}
    ${c.status === 'approved' && c.kind === 'warning' ? note('A warning: ₱0, 0 points, on their record.') : ''}
    ${charged(c) ? `${note(`Charged ${escHtml(charge)}.${c.due_at && !c.paid_at ? ` Due ${escHtml(fmtDay(c.due_at))}${c.appeal_status === 'pending' ? ', on hold during the appeal' : ''}.` : ''} ${susp}`)}
      <div class="aui-row afn-paid">${paidBadge(c)}${c.paid_at ? `<span class="asr-none">${escHtml(fmtDate(c.paid_at))}</span>` : ''}
        ${c.paid_at
          ? button('Mark unpaid', { size: 'sm', attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/paid" data-body='{"paid":false}' data-confirm data-confirm-title="Mark this fine unpaid?" data-confirm-body="This voids the payment on their ledger." data-confirm-send="Mark unpaid" data-done="Marked unpaid."` })
          : button('Mark paid', { size: 'sm', kind: 'primary', attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/paid" data-body='{"paid":true}' data-done="Marked paid."` })}
      </div>` : susp ? note(susp) : ''}
    ${c.status === 'approved' && isSuperAdmin ? `${field({ label: 'Cancel it (why, the player reads it)', name: 'note', type: 'textarea', rows: 2, id: 'afn-void-note' })}
      <div class="aui-row">${postButton(c.id, 'void', 'Cancel this decision', 'danger', {}, '#afn-void-note', 'data-confirm data-confirm-title="Cancel this decision?" data-confirm-body="The charge comes off their ledger (a payment stays as credit); the points and any suspension go." data-confirm-send="Cancel it" data-done="Cancelled."')}</div>` : ''}
  </div>`;
}

export function adminFineCaseBody({
  case: c, votes = [], player, escalationVotes = [], totalAdmins = 0, viewerAdminId = '', isSuperAdmin = false, suspension = null, standing = null,
  voteBlock = '', decideBlock = '', decideOpensAt = 0, canDecide = false, accusedAdmin = false, appealVotes = [], appealReady = false, appealDecider = false,
  appealHeads = [], categories = [], log = [], evidence = {},
} = {}) {
  const name = displayPlayerName(c.player_name);
  const heading = `${breadcrumb([{ label: 'Conduct', href: '/admin/fines' }, { label: name }])}
    ${pageHeader({
      title: name,
      sub: [c.category_label, peso(c.amount), c.points ? pts(c.points) : '', player?.team_name].filter(Boolean).join(' · '),
      actionsHtml: statusBadge(c),
    })}`;

  if (c.status === 'pending_admin' || c.status === 'dismissed') {
    return `<div class="aui-page">${escalationView({ ...c, __log: log }, { escalationVotes, totalAdmins, viewerAdminId, isSuperAdmin, suspension, standing, heading, voteBlock, categories })}</div>`;
  }

  const isOpen = c.status === 'open';
  const yes = votes.filter(v => v.vote === 'approve').length;
  const no = votes.filter(v => v.vote === 'reject').length;
  const mine = votes.find(v => v.voter_id === viewerAdminId);
  const voteRows = votes.map(v => row(`${escHtml(v.voter_name)} (${escHtml(v.voter_type)})`, v.comment ? escHtml(v.comment) : '<span class="asr-none">No comment</span>', `<span class="aui-cell__badges">${v.vote === 'approve' ? badge('Approve', 'green') : badge('Reject', 'red')}<span class="asr-none">${escHtml(fmtDate(v.created_at))}</span></span>`));

  return `<div class="aui-page">
    ${heading}
    <div class="aui-cols">
      <div class="aui-cols__main">
        ${descriptionSection(c)}
        ${responseSection(c)}
        ${section({ title: `Votes (${yes} approve, ${no} reject)`, bodyHtml: voteRows.length ? list(voteRows) : '<div class="aui-panel asr-none">No votes yet.</div>' })}
        ${isOpen ? section({
          title: mine ? `Your vote: ${mine.vote === 'approve' ? 'Approve' : 'Reject'}` : 'Your vote',
          bodyHtml: voteBlock ? `<div class="aui-panel">${note(escHtml(voteBlock))}</div>` : `<div class="aui-panel afn-form">${field({ label: 'Comment (optional)', name: 'comment', type: 'textarea', rows: 2, value: mine?.comment || '', id: 'afn-comment' })}
            <div class="aui-row">${postButton(c.id, 'vote', 'Approve', 'secondary', { vote: 'approve' }, '#afn-comment', 'data-done="Vote saved."')}${postButton(c.id, 'vote', 'Reject', 'secondary', { vote: 'reject' }, '#afn-comment', 'data-done="Vote saved."')}</div></div>`,
        }) : ''}
        ${appealSection(c, { appealVotes, appealReady, appealDecider, appealHeads, categories })}
        ${logSection(log)}
      </div>
      <aside class="aui-cols__side">
        ${conductSection(suspension, standing)}
        ${isOpen ? categorySection(c, categories, decideBlock) : ''}
        ${section({ title: isOpen ? 'Decide' : 'Result', bodyHtml: isOpen ? decidePanel(c, { name, canDecide, decideOpensAt, decideBlock, evidence, accusedAdmin }) : resultPanel(c, { isSuperAdmin }) })}
      </aside>
    </div>
  </div>`;
}

function categoryForm(c) {
  const key = c ? c.id : 'new';
  return drawer({
    id: `fine-cat-${key}`, eyebrow: 'Conduct', title: c ? `Edit ${c.label}` : 'Add category',
    bodyHtml: `<form id="fine-cat-form-${escHtml(key)}" data-json-action="/admin/fines/categories${c ? `/${escHtml(c.id)}` : ''}" data-done="Saved.">
      ${fieldGrid(`${field({ label: 'Name', name: 'label', value: c?.label || '', required: true, wide: true, id: `cat-label-${key}`, placeholder: 'Level 2 – Unsportsmanlike conduct' })}
        ${field({ label: 'Fine', name: 'amount', type: 'money', value: c ? c.amount : '', required: true, id: `cat-amount-${key}`, help: '0 for a category that only gives points.' })}
        ${field({ label: 'Level', name: 'level', type: 'select', value: c?.level || 0, id: `cat-level-${key}`, options: [[0, 'None'], [1, 'Level 1'], [2, 'Level 2'], [3, 'Level 3'], [4, 'Level 4']], help: 'A second case at the same level in a season is charged one level up.' })}
        ${field({ label: 'Conduct points', name: 'points', type: 'number', value: c?.points || 0, id: `cat-points-${key}`, attrs: 'min="0"' })}
        ${field({ label: 'Minimum suspension (games)', name: 'minSuspensionGames', type: 'number', value: c?.min_suspension_games || 0, id: `cat-min-${key}`, attrs: 'min="0"', help: 'Applies whatever their points are.' })}
        ${field({ label: 'Description', name: 'description', type: 'textarea', rows: 2, value: c?.description || '', wide: true, id: `cat-desc-${key}` })}
        ${field({ label: 'Examples', name: 'examples', type: 'textarea', rows: 4, value: (c?.examples || []).join('\n'), wide: true, id: `cat-ex-${key}`, help: 'One per line. The rules call these binding: the same act gets the same level.' })}`)}
    </form>`,
    footerHtml: button('Save', { kind: 'primary', type: 'submit', attrs: `form="fine-cat-form-${escHtml(key)}"` }),
  });
}

export function adminFineCategoriesBody({ categories = [], query = {} } = {}) {
  const grid = categories.length ? dataGrid({
    id: 'fine-cats', baseUrl: '/admin/fines/categories', query, minimal: true, perPage: 100,
    rows: categories, rowKey: c => c.id, noun: ['category', 'categories'],
    columns: [
      { key: 'label', label: 'Category', primary: true, cell: c => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(c.label)}</span>${c.description ? `<span class="aui-cell__sub afn-desc">${escHtml(c.description)}</span>` : ''}</span>` },
      { key: 'amount', label: 'Fine', num: true, phone: true, cell: c => peso(c.amount) },
      { key: 'points', label: 'Points', num: true, phone: true, cell: c => String(c.points || 0) },
      { key: 'min', label: 'Min. suspension', phone: true, cell: c => (c.min_suspension_games > 0 ? plural(c.min_suspension_games, 'game') : none) },
      { key: 'status', label: 'Status', bare: true, cell: c => (c.active ? badge('Active', 'green') : badge('Off', 'gray')) },
      { key: 'go', label: '', bare: true, cell: c => `<span class="aui-cell__badges">${button('Edit', { size: 'sm', attrs: `data-drawer-open="fine-cat-${escHtml(c.id)}"` })}${button(c.active ? 'Turn off' : 'Turn on', { size: 'sm', kind: 'ghost', attrs: `data-post-json="/admin/fines/categories/${escHtml(c.id)}/toggle" data-done="${c.active ? 'Turned off.' : 'Turned on.'}"` })}</span>` },
    ],
    expand: c => (c.examples?.length ? `<ul class="afn-examples">${c.examples.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>` : '<span class="asr-none">No examples.</span>'),
  }) : emptyState({ title: 'No categories yet', sub: 'Add one to start taking reports.' });

  return `<div class="aui-page">
    ${pageHeader({
      title: 'Categories',
      sub: 'The conduct ladder, shown on /rules/conduct. Changes apply to new reports straight away.',
      actionsHtml: button('Add category', { kind: 'primary', attrs: 'data-drawer-open="fine-cat-new"' }),
    })}
    ${grid}
    ${categoryForm(null)}
    ${categories.map(categoryForm).join('')}
  </div>`;
}
