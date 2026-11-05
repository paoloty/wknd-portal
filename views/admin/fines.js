// /admin/fines: Conduct → Cases and Categories (rewrite, 2026-11). A case moves from a player's report
// (pending_admin: admins vote on escalating it) to open (votes are guidance, an admin decides) to
// approved, rejected or dismissed. A player only ever hears the outcome.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, breadcrumb, section, needsYou, statStrip, dataGrid, badge, button, drawer, field, fieldGrid, playerPicker, emptyState } from './ui.js';

const peso = n => `₱${Number(n || 0).toLocaleString()}`;
const fmtDate = ms => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pts = n => plural(n, 'pt', 'pts');
const none = '<span class="asr-none">None</span>';

const STATUS = { approved: ['Fined', 'blue'], rejected: ['Rejected', 'gray'], pending_admin: ['Needs escalation vote', 'amber'], dismissed: ['Dismissed', 'gray'], open: ['Open', 'amber'] };
const statusBadge = status => badge(...(STATUS[status] || [status, 'gray']));
// Only a charged case has anything to pay: anything else shows nothing, not an "Unpaid".
const paidBadge = c => (c.status !== 'approved' ? none : c.paid_at ? badge('Paid', 'green') : badge('Unpaid', 'amber'));

const row = (who, text, asideHtml = '') => `<div class="aas-qa"><div class="aas-qa__text"><div class="aas-qa__q">${who}</div><div class="aas-qa__a">${text}</div></div>${asideHtml}</div>`;
const list = rows => `<div class="aui-panel aas-list">${rows.join('')}</div>`;

export function adminFinesListBody({ pendingAdmin = [], open = [], resolved = [], players = [], categories = [], summary = null, query = {} } = {}) {
  const s = summary || { caseCount: 0, paidCount: 0, totalFined: 0, totalPaid: 0, totalOutstanding: 0 };
  const waiting = c => c.status === 'open' || c.status === 'pending_admin';
  const unpaid = c => c.status === 'approved' && !c.paid_at;
  const rows = [...pendingAdmin, ...open, ...resolved].map(c => ({ ...c, name: displayPlayerName(c.player_name) }));

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
      { key: 'status', label: 'Status', bare: true, cell: c => statusBadge(c.status) },
      { key: 'amount', label: 'Fine', num: true, phone: true, cell: c => `${peso(c.amount)}${c.points ? ` <span class="asr-none">${pts(c.points)}</span>` : ''}` },
      { key: 'paid', label: 'Paid', phone: false, cell: paidBadge },
      { key: 'by', label: 'Reported by', phone: true, cell: c => escHtml(c.reported_by_name) },
      { key: 'date', label: 'Date', phone: false, cell: c => escHtml(fmtDate(c.created_at)) },
    ],
    rowHref: c => `/admin/fines/${c.id}`,
    empty: { title: 'No cases yet', sub: 'Reports from players and admins show here.' },
  });

  return `<div class="aui-page">
    ${pageHeader({
      title: 'Conduct',
      sub: 'Reports, votes and fines. A player only hears the outcome.',
      actionsHtml: `${button('Team heads', { href: '/admin/team-heads' })}${categories.length ? button('Report incident', { kind: 'primary', attrs: 'data-drawer-open="fine-report"' }) : ''}`,
    })}
    ${needsYou([
      pendingAdmin.length && { title: `${plural(pendingAdmin.length, 'player report')} to vote on`, sub: 'Admins decide whether each goes to the team heads.', href: pendingAdmin.length === 1 ? `/admin/fines/${pendingAdmin[0].id}` : '/admin/fines?view=waiting', label: 'Vote', hot: true },
      open.length && { title: `${plural(open.length, 'open case')} to decide`, sub: 'Votes are guidance. An admin makes the call.', href: open.length === 1 ? `/admin/fines/${open[0].id}` : '/admin/fines?view=waiting', label: 'Review' },
    ])}
    ${statStrip([
      { label: 'Total fined', value: peso(s.totalFined) },
      { label: 'Collected', value: peso(s.totalPaid) },
      { label: 'Outstanding', value: peso(s.totalOutstanding) },
      { label: 'Fines paid', value: String(s.paidCount), of: ` of ${s.caseCount}` },
    ])}
    ${grid}
    ${categories.length ? drawer({
      id: 'fine-report', eyebrow: 'Conduct', title: 'Report incident',
      bodyHtml: `<form id="fine-report-form" class="afn-form" data-json-action="/admin/fines" data-then="/admin/fines/{id}" data-done="Report filed.">
        ${playerPicker({ name: 'playerId', label: 'Player', multiple: false, options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name) })) })}
        ${field({ label: 'Category', name: 'categoryId', type: 'select', wide: true, options: categories.map(c => [c.id, `${c.label} (${peso(c.amount)}${c.points ? `, ${pts(c.points)}` : ''})`]) })}
        ${field({ label: 'What happened', name: 'description', type: 'textarea', rows: 4, wide: true, placeholder: 'Game, context, who saw it' })}
      </form>`,
      footerHtml: button('File report', { kind: 'primary', type: 'submit', attrs: 'form="fine-report-form"' }),
    }) : ''}
  </div>`;
}

// The player's whole season, on every case, before anyone votes or decides. For information only:
// nothing here blocks anything by itself (getPlayerSuspensionStatus in lib/portal-db.js).
function conductSection(s) {
  if (!s) return '';
  const label = s.needsReview ? 'League review' : s.gamesSuspended > 0 ? plural(s.gamesSuspended, 'game') : 'None';
  return section({
    title: 'This season',
    bodyHtml: `${statStrip([{ label: 'Conduct points', value: String(s.activePoints) }, { label: 'Suspension', value: label }])}${s.categoryFloor > 0 ? `<p class="alv-note afn-note">Includes a mandatory ${plural(s.categoryFloor, 'game')} from a category charged this season.</p>` : ''}`,
  });
}

const descriptionSection = c => section({
  title: 'What happened',
  note: `Reported by ${c.reported_by_name} (${c.reported_by_type}), ${fmtDate(c.created_at)}`,
  bodyHtml: `<div class="aui-panel">${c.description ? `<span class="asu-comment">${escHtml(c.description)}</span>` : '<span class="asr-none">No description.</span>'}</div>`,
});

const voteButton = (id, path, label, kind, body, withId, extra = '') => button(label, { kind, attrs: `data-post-json="/admin/fines/${escHtml(id)}/${path}" data-body='${escHtml(JSON.stringify(body))}' data-with="#${withId}" ${extra}` });

function escalationView(c, { escalationVotes, totalAdmins, viewerAdminId, isSuperAdmin, suspension, heading }) {
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
          bodyHtml: `<div class="aui-panel afn-form">${field({ label: 'Comment (optional)', name: 'comment', type: 'textarea', rows: 2, value: mine?.comment || '', id: 'afn-comment' })}
            <div class="aui-row">${voteButton(c.id, 'escalate-vote', 'Escalate to heads', 'primary', { vote: 'escalate' }, 'afn-comment', 'data-done="Vote saved."')}${voteButton(c.id, 'escalate-vote', 'Dismiss', 'secondary', { vote: 'dismiss' }, 'afn-comment', 'data-done="Vote saved."')}</div></div>`,
        }) : ''}
      </div>
      <aside class="aui-cols__side">
        ${conductSection(suspension)}
        ${pending ? section({
          title: 'Escalation',
          bodyHtml: `<div class="aui-panel afn-form"><p class="alv-note">A player filed this. Once most admins vote to escalate, it goes to the team heads for a recommendation. An admin still decides after that.</p>
            ${isSuperAdmin ? `<p class="alv-note">If the vote has stalled, super admin can settle it:</p><div class="aui-row">
              ${button('Force escalate', { attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/force-escalation" data-body='{"escalate":true}' data-confirm data-confirm-title="Escalate this case to the team heads?" data-confirm-send="Escalate" data-done="Escalated."` })}
              ${button('Force dismiss', { kind: 'danger', attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/force-escalation" data-body='{"escalate":false}' data-confirm data-confirm-title="Dismiss this case?" data-confirm-body="The player who reported it gets told it wasn't escalated." data-confirm-send="Dismiss" data-done="Dismissed."` })}
            </div>` : ''}</div>`,
        }) : section({
          title: 'Result',
          bodyHtml: `<div class="aui-panel afn-form"><p class="afn-result">${c.resolution_note ? escHtml(c.resolution_note) : `Dismissed by admin vote, ${down} to ${up}.`}</p><p class="alv-note">Never reached the team heads. The player who reported it was told.</p></div>`,
        })}
      </aside>
    </div>`;
}

export function adminFineCaseBody({ case: c, votes = [], player, escalationVotes = [], totalAdmins = 0, viewerAdminId = '', isSuperAdmin = false, suspension = null } = {}) {
  const name = displayPlayerName(c.player_name);
  const heading = `${breadcrumb([{ label: 'Conduct', href: '/admin/fines' }, { label: name }])}
    ${pageHeader({
      title: name,
      sub: [c.category_label, peso(c.amount), c.points ? pts(c.points) : '', player?.team_name].filter(Boolean).join(' · '),
      actionsHtml: statusBadge(c.status),
    })}`;

  if (c.status === 'pending_admin' || c.status === 'dismissed') {
    return `<div class="aui-page">${escalationView(c, { escalationVotes, totalAdmins, viewerAdminId, isSuperAdmin, suspension, heading })}</div>`;
  }

  const isOpen = c.status === 'open';
  const yes = votes.filter(v => v.vote === 'approve').length;
  const no = votes.filter(v => v.vote === 'reject').length;
  const mine = votes.find(v => v.voter_id === viewerAdminId);
  const voteRows = votes.map(v => row(`${escHtml(v.voter_name)} (${escHtml(v.voter_type)})`, v.comment ? escHtml(v.comment) : '<span class="asr-none">No comment</span>', `<span class="aui-cell__badges">${v.vote === 'approve' ? badge('Approve', 'green') : badge('Reject', 'red')}<span class="asr-none">${escHtml(fmtDate(v.created_at))}</span></span>`));
  const charge = `${peso(c.amount)}${c.points ? ` and ${pts(c.points)}` : ''}`;

  return `<div class="aui-page">
    ${heading}
    <div class="aui-cols">
      <div class="aui-cols__main">
        ${descriptionSection(c)}
        ${section({ title: `Votes (${yes} approve, ${no} reject)`, bodyHtml: voteRows.length ? list(voteRows) : '<div class="aui-panel asr-none">No votes yet.</div>' })}
        ${isOpen ? section({
          title: mine ? `Your vote: ${mine.vote === 'approve' ? 'Approve' : 'Reject'}` : 'Your vote',
          bodyHtml: `<div class="aui-panel afn-form">${field({ label: 'Comment (optional)', name: 'comment', type: 'textarea', rows: 2, value: mine?.comment || '', id: 'afn-comment' })}
            <div class="aui-row">${voteButton(c.id, 'vote', 'Approve', 'secondary', { vote: 'approve' }, 'afn-comment', 'data-done="Vote saved."')}${voteButton(c.id, 'vote', 'Reject', 'secondary', { vote: 'reject' }, 'afn-comment', 'data-done="Vote saved."')}</div></div>`,
        }) : ''}
      </div>
      <aside class="aui-cols__side">
        ${conductSection(suspension)}
        ${section({
          title: isOpen ? 'Decide' : 'Result',
          bodyHtml: isOpen ? `<div class="aui-panel afn-form">
              <p class="alv-note">Votes are guidance, and the call is yours. Approving charges ${escHtml(charge)} to the player's record as a Penalty and tells them.</p>
              ${field({ label: 'Note (optional)', name: 'note', type: 'textarea', rows: 2, id: 'afn-note' })}
              <div class="aui-row">
                ${voteButton(c.id, 'resolve', `Approve and charge ${peso(c.amount)}`, 'primary', { approved: true }, 'afn-note', `data-confirm data-confirm-title="Fine ${escHtml(name)} ${peso(c.amount)}?" data-confirm-body="This charges their ledger and tells them." data-confirm-send="Approve and charge" data-done="Fine approved."`)}
                ${voteButton(c.id, 'resolve', 'Reject, no fine', 'secondary', { approved: false }, 'afn-note', `data-confirm data-confirm-title="Reject this case?" data-confirm-body="No fine is charged. ${escHtml(name)} is told a report was reviewed." data-confirm-send="Reject" data-done="Case rejected."`)}
              </div>
            </div>` : `<div class="aui-panel afn-form">
              <p class="afn-result">Decided by <b>${escHtml(c.resolved_by_name)}</b>, ${escHtml(fmtDate(c.resolved_at))}.</p>
              ${c.resolution_note ? `<span class="asu-comment">${escHtml(c.resolution_note)}</span>` : ''}
              ${c.status === 'approved' ? `<p class="alv-note">Charged ${escHtml(charge)} to the player's record.</p>
                <div class="aui-row afn-paid">${paidBadge(c)}${c.paid_at ? `<span class="asr-none">${escHtml(fmtDate(c.paid_at))}</span>` : ''}
                  ${c.paid_at
                    ? button('Mark unpaid', { size: 'sm', attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/paid" data-body='{"paid":false}' data-confirm data-confirm-title="Mark this fine unpaid?" data-confirm-body="This voids the payment on their ledger." data-confirm-send="Mark unpaid" data-done="Marked unpaid."` })
                    : button('Mark paid', { size: 'sm', kind: 'primary', attrs: `data-post-json="/admin/fines/${escHtml(c.id)}/paid" data-body='{"paid":true}' data-done="Marked paid."` })}
                </div>` : ''}
            </div>`,
        })}
      </aside>
    </div>
  </div>`;
}

function categoryForm(c) {
  const key = c ? c.id : 'new';
  return drawer({
    id: `fine-cat-${key}`, eyebrow: 'Conduct', title: c ? `Edit ${c.label}` : 'Add category',
    bodyHtml: `<form id="fine-cat-form-${escHtml(key)}" data-json-action="/admin/fines/categories${c ? `/${escHtml(c.id)}` : ''}" data-done="Saved.">
      ${fieldGrid(`${field({ label: 'Name', name: 'label', value: c?.label || '', required: true, wide: true, id: `cat-label-${key}`, placeholder: 'Standard unsportsmanlike conduct' })}
        ${field({ label: 'Fine', name: 'amount', type: 'money', value: c ? c.amount : '', required: true, id: `cat-amount-${key}`, help: '0 for a category that only gives points.' })}
        ${field({ label: 'Conduct points', name: 'points', type: 'number', value: c?.points || 0, id: `cat-points-${key}`, attrs: 'min="0"' })}
        ${field({ label: 'Minimum suspension (games)', name: 'minSuspensionGames', type: 'number', value: c?.min_suspension_games || 0, id: `cat-min-${key}`, attrs: 'min="0"', help: 'Applies whatever their points are.' })}
        ${field({ label: 'Description', name: 'description', type: 'textarea', rows: 2, value: c?.description || '', wide: true, id: `cat-desc-${key}` })}
        ${field({ label: 'Examples', name: 'examples', type: 'textarea', rows: 4, value: (c?.examples || []).join('\n'), wide: true, id: `cat-ex-${key}`, help: 'One per line.' })}`)}
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
      sub: 'The conduct policy. Changes apply to new reports straight away.',
      actionsHtml: button('Add category', { kind: 'primary', attrs: 'data-drawer-open="fine-cat-new"' }),
    })}
    ${grid}
    ${categoryForm(null)}
    ${categories.map(categoryForm).join('')}
  </div>`;
}
