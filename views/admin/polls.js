// /admin/polls and /admin/polls/:id (admin redesign, rebuilt from scratch 2026-10-19 on
// views/admin/ui.js). The list is the shared data grid with New poll in a drawer; each poll's
// page has the results, the popup (switches + art), and the poll's own fields. Browser side
// (option rows, art upload): public/admin-polls.js.
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, section, badge, button, drawer, field, fieldGrid, toggleRow, saveBar, breadcrumb, statStrip, progress, emptyState } from './ui.js';
import { pollClosesLabel } from '../polls.js';

const attr = s => escHtml(String(s ?? ''));
const TIER_LABEL = { admins: 'Admins', heads: 'Team heads', players: 'All players' };
const TIER_OPTIONS = [['players', 'All players'], ['heads', 'Team heads'], ['admins', 'Admins']];
const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '');

function tally(poll, votes) {
  const counts = poll.options.map(() => 0);
  for (const v of votes) if (counts[v.option_index] !== undefined) counts[v.option_index]++;
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

function statusBadges(p) {
  const out = [p.status === 'open' ? badge('Open', 'green') : badge('Closed', 'gray')];
  if (p.status === 'open' && p.popup) out.push(badge('Popup', 'amber'));
  return `<span class="aui-cell__badges">${out.join('')}</span>`;
}

function whoText(p) {
  return p.visibility === p.voter_eligibility ? TIER_LABEL[p.visibility] : `${TIER_LABEL[p.visibility]} see · ${TIER_LABEL[p.voter_eligibility]} vote`;
}

export function adminPollsBody({ polls = [], query = {}, notifyOnOpen = true }) {
  const grid = dataGrid({
    id: 'polls', baseUrl: '/admin/polls', query, minimal: true,
    rows: polls, rowKey: p => p.id, noun: ['poll', 'polls'],
    views: [
      { key: 'open', label: 'Open', test: p => p.status === 'open' },
      { key: 'closed', label: 'Closed', test: p => p.status !== 'open' },
      { key: 'all', label: 'All', test: () => true },
    ],
    search: polls.length > 8 ? { placeholder: 'Search questions', text: p => `${p.question} ${p.options.join(' ')}` } : null,
    defaultSort: '-created', perPage: 25,
    columns: [
      { key: 'question', label: 'Poll', primary: true, sort: p => p.question.toLowerCase(), cell: p => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(p.question)}</span><span class="aui-cell__sub">${escHtml(`${p.options.length} options · ${whoText(p)}`)}</span></span>` },
      { key: 'votes', label: 'Votes', num: true, sort: p => p.votes.length, cell: p => `<span class="aui-num">${p.votes.length}</span>` },
      { key: 'closes', label: 'Closes', nowrap: true, sort: p => p.closes_at || 0, cell: p => (p.status === 'open' && p.closes_at ? escHtml(pollClosesLabel(p.closes_at)) : '<span class="aui-muted">—</span>') },
      { key: 'created', label: 'Created', nowrap: true, phone: false, sort: p => p.created_at, cell: p => `<span class="aui-muted">${escHtml(fmtDate(p.created_at))}</span>` },
      { key: 'status', label: 'Status', bare: true, cell: statusBadges },
    ],
    rowHref: p => `/admin/polls/${encodeURIComponent(p.id)}`,
    rowMenu: p => [
      { label: 'Open poll', href: `/admin/polls/${encodeURIComponent(p.id)}` },
      p.status === 'open'
        ? { label: 'Close poll', post: `/admin/polls/${p.id}/status`, body: { status: 'closed' }, done: 'Poll closed.', confirm: { title: 'Close this poll?', body: 'Nobody can vote after this. You can reopen it.', send: 'Close poll' } }
        : { label: 'Reopen poll', post: `/admin/polls/${p.id}/status`, body: { status: 'open' }, done: 'Poll reopened.' },
      { label: 'View on site', href: '/polls', external: true },
    ],
    actionsHtml: button('+ New poll', { kind: 'primary', attrs: 'data-drawer-open="new-poll"' }),
    empty: { title: 'No polls here', sub: 'Start one with “+ New poll”.' },
  });

  const newPoll = drawer({
    id: 'new-poll', eyebrow: 'Polls', title: 'New poll',
    bodyHtml: `<form id="new-poll-form" data-json-action="/admin/polls" data-then="/admin/polls/{id}" data-done="Poll created. Add details, art or the popup here.">${fieldGrid(`
        ${field({ label: 'Question', name: 'question', wide: true, required: true, placeholder: 'e.g. What’s the costume party theme?' })}
        ${field({ label: 'Description', name: 'description', type: 'textarea', rows: 2, wide: true, help: 'Optional. Shown under the question.' })}
        ${field({ label: 'Options', name: 'options', type: 'textarea', rows: 5, wide: true, required: true, placeholder: 'One per line', help: 'One per line. You can add a second line to each on the next page.' })}
        ${field({ label: 'Who can see it', name: 'visibility', type: 'select', value: 'players', options: TIER_OPTIONS })}
        ${field({ label: 'Who can vote', name: 'voter_eligibility', type: 'select', value: 'players', options: TIER_OPTIONS })}`)}
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Create poll', { kind: 'primary', type: 'submit', attrs: 'form="new-poll-form"' })}`,
  });

  const switches = `<div class="aui-panel">
    ${toggleRow({ label: 'Tell players about new polls', help: 'A bell notification to every active member when a poll for all players opens. Live site only.', name: 'polls_notify_on_open', on: notifyOnOpen, post: '/admin/site/settings', setting: true })}
  </div>`;

  return `<div class="aui-page">
    ${pageHeader({ title: 'Polls', sub: 'Quick votes for members on /polls. Switch one to a popup and members see it on every page until they vote.' })}
    ${grid}
    ${section({ title: 'Switches', bodyHtml: switches })}
    ${newPoll}
  </div>`;
}

function resultsPanel(poll, votes) {
  const { counts, total } = tally(poll, votes);
  if (!total) return emptyState({ title: 'No votes yet', sub: poll.status === 'open' ? 'Votes show up here as they come in.' : '' });
  const names = poll.options.map(() => []);
  for (const v of votes) names[v.option_index]?.push(v.voter_name || 'Someone');
  const leader = Math.max(...counts);
  return `<div class="aui-panel apl-results">${poll.options.map((opt, i) => {
    const pct = Math.round((counts[i] / total) * 100);
    return `<div class="apl-result">
      <div class="apl-result__head"><span class="aui-cell__title">${escHtml(opt)}${counts[i] === leader ? ` ${badge('Leading', 'amber')}` : ''}</span><span class="aui-num">${counts[i]} <span class="aui-muted">· ${pct}%</span></span></div>
      ${progress(pct)}
      ${names[i].length ? `<div class="aui-cell__sub">${names[i].map(escHtml).join(', ')}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function popupPanel(poll) {
  const id = encodeURIComponent(poll.id);
  const art = `<div class="apl-art" data-poll-art data-upload="/admin/polls/${attr(id)}/art" data-img="/api/poll-art/${attr(id)}">
      <div class="apl-art__frame"${poll.has_art ? '' : ' hidden'} data-art-frame><img alt="Popup art" data-art-img src="${poll.has_art ? `/api/poll-art/${attr(id)}?v=${attr(poll.art_ver)}` : ''}"></div>
      <div class="aui-row">
        <label class="aui-btn aui-btn--secondary aui-btn--sm" for="apl-art-input">${poll.has_art ? 'Replace art' : 'Upload art'}</label>
        <button type="button" class="aui-btn aui-btn--ghost aui-btn--sm" data-art-remove${poll.has_art ? '' : ' hidden'}>Remove</button>
        <span class="aui-muted" data-art-msg></span>
      </div>
      <input type="file" id="apl-art-input" accept="image/*" hidden data-art-input>
    </div>`;
  return `<div class="aui-panel">
    ${toggleRow({ label: 'Show as popup', help: poll.status === 'open' ? 'Logged-in members who can vote and haven’t yet see it on every page. Only one popup shows at a time: the newest.' : 'Only open polls pop up. Reopen this one to use it.', name: 'popup', on: !!poll.popup, post: `/admin/polls/${id}/flag`, reload: true })}
    ${toggleRow({ label: 'Allow “Ask me later”', help: 'Lets members close it until the next day. Off: voting is the only way to close it.', name: 'popup_later', on: !!poll.popup_later, post: `/admin/polls/${id}/flag` })}
    <div class="apl-art-row">
      <div><div class="aui-toggle-row__label">Art</div><div class="aui-toggle-row__help">Optional. Shown whole beside the poll (or above it, if it’s wide), never cropped. On phones the middle shows as a banner.</div></div>
      ${art}
    </div>
  </div>`;
}

function pollForm(poll, hasVotes, closesLocal) {
  const optRow = (label, detail, i) => `<div class="apl-opt" data-opt-row>
      <input class="aui-input" name="option_label[]" value="${attr(label)}" placeholder="Option" aria-label="Option ${i + 1}">
      <input class="aui-input" name="option_detail[]" value="${attr(detail)}" placeholder="Second line (optional)" aria-label="Option ${i + 1} second line">
      ${button('×', { kind: 'ghost', size: 'sm', attrs: `data-opt-remove aria-label="Remove option"${hasVotes && i < poll.options.length ? ' hidden' : ''}` })}
    </div>`;
  return `<form id="poll-form" class="aui-panel" data-json-action="/admin/polls/${attr(encodeURIComponent(poll.id))}/save" data-done="Poll saved." data-dirty-watch>
    ${fieldGrid(`
      ${field({ label: 'Question', name: 'question', value: poll.question, wide: true, required: true })}
      ${field({ label: 'Description', name: 'description', type: 'textarea', rows: 2, value: poll.description || '', wide: true, help: 'Optional. Shown under the question.' })}
      <div class="aui-field is-wide"><span class="aui-field__label">Options</span>
        <div class="apl-opts" data-opt-list>${poll.options.map((o, i) => optRow(o, poll.option_details[i] || '', i)).join('')}</div>
        <span class="aui-field__help">${hasVotes ? 'People have voted, so options can be renamed and added but not removed.' : 'The second line is the funny details, shown in smaller text under the option.'}</span>
        <div>${button('+ Add option', { kind: 'secondary', size: 'sm', attrs: 'data-opt-add' })}</div>
      </div>
      ${field({ label: 'Who can see it', name: 'visibility', type: 'select', value: poll.visibility, options: TIER_OPTIONS })}
      ${field({ label: 'Who can vote', name: 'voter_eligibility', type: 'select', value: poll.voter_eligibility, options: TIER_OPTIONS })}
      ${field({ label: 'Voting closes', name: 'closes_at', type: 'datetime-local', value: closesLocal, help: 'Optional, Manila time. The poll closes itself then, and the popup stops.' })}`)}
    <template data-opt-template>${optRow('', '', 999)}</template>
  </form>`;
}

export function adminPollDetailBody({ poll, votes = [], closesLocal = '' }) {
  const id = encodeURIComponent(poll.id);
  const { total } = tally(poll, votes);
  const isOpen = poll.status === 'open';
  const statusBtn = isOpen
    ? button('Close poll', { kind: 'secondary', attrs: `data-post-json="/admin/polls/${attr(id)}/status" data-body="${attr(JSON.stringify({ status: 'closed' }))}" data-done="Poll closed." data-confirm data-confirm-title="Close this poll?" data-confirm-body="Nobody can vote after this, and the popup stops. You can reopen it." data-confirm-send="Close poll"` })
    : button('Reopen poll', { kind: 'secondary', attrs: `data-post-json="/admin/polls/${attr(id)}/status" data-body="${attr(JSON.stringify({ status: 'open' }))}" data-done="Poll reopened."` });

  const stats = statStrip([
    { label: 'Votes', value: String(total) },
    { label: 'Status', value: isOpen ? (poll.closes_at ? `Open till ${pollClosesLabel(poll.closes_at)}` : 'Open') : 'Closed' },
    { label: 'Popup', value: isOpen && poll.popup ? 'On' : 'Off' },
    { label: 'Who votes', value: TIER_LABEL[poll.voter_eligibility] },
  ]);

  const del = `<div class="aui-panel apl-danger"><span class="aui-cell__stack"><span class="aui-cell__title">Delete poll</span><span class="aui-cell__sub">Removes the poll and every vote in it. This can’t be undone.</span></span>
    ${button('Delete poll…', { kind: 'danger', attrs: `data-post-json="/admin/polls/${attr(id)}" data-method="DELETE" data-then="/admin/polls" data-done="Poll deleted." data-confirm data-confirm-title="Delete this poll?" data-confirm-body="${attr(`${total} vote${total === 1 ? '' : 's'} go too. This can’t be undone.`)}" data-confirm-send="Delete poll"` })}</div>`;

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Polls', href: '/admin/polls' }, { label: poll.question }])}
    ${pageHeader({ title: poll.question, sub: `${whoText(poll)} · created ${fmtDate(poll.created_at)}${poll.created_by ? ` by ${poll.created_by}` : ''}`, actionsHtml: `${button('View on site', { kind: 'ghost', href: '/polls', attrs: 'target="_blank" rel="noopener"' })}${statusBtn}` })}
    ${stats}
    ${section({ title: 'Results', note: `· ${total} vote${total === 1 ? '' : 's'}`, bodyHtml: resultsPanel(poll, votes) })}
    ${section({ title: 'Popup', note: '· over every page until they vote', bodyHtml: popupPanel(poll) })}
    ${section({ title: 'Poll', note: '· question, options and who votes', bodyHtml: pollForm(poll, total > 0, closesLocal) })}
    ${section({ title: 'Danger zone', bodyHtml: del })}
    ${saveBar({ label: 'Save poll', form: 'poll-form' })}
  </div>
  <script src="/admin-polls.js" defer></script>`;
}
