// Manage a Papawis run from the app (/app/admin/papawis/:id), for admins with the Papawis
// section (server.js appPapawisAdmin). The same run page as /admin/papawis/:id
// (views/admin/papawis-run.js), drawn in the app's look: cover, roster, teams, money,
// messages and activity. Every action posts to the site's own /admin/papawis routes
// (public/app.js initAdminPapawis), so the site and the app can't drift apart. Court, time
// and cancelling stay on the full site (linked at the bottom).
// Mockups: https://claude.ai/artifact/CM4NXNzpQRsjHxgM9LZSJk
import { esc, appAvatar, backChev, chev, icons } from './layout.js';

const peso = n => `₱${Math.round(Number(n) || 0).toLocaleString('en-PH')}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sideLabel = t => (t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : '');
const attrJson = o => esc(JSON.stringify(o));
const grip = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

// A button that posts to an admin route (public/app.js initAdminPapawis). ask: confirm text.
const postBtn = (label, url, { cls = 'btn btn--ghost', body = null, ask = '', done = 'Done', method = '' } = {}) =>
  `<button type="button" class="${cls}" data-adm-post="${esc(url)}"${body ? ` data-adm-body="${attrJson(body)}"` : ''}${ask ? ` data-adm-ask="${esc(ask)}"` : ''}${method ? ` data-adm-method="${method}"` : ''} data-adm-done="${esc(done)}">${label}</button>`;

// The ⋯ sheet for one player: the same choices as the site's row menu (views/admin/papawis-run.js rosterRow).
function rowActs(run, s, canManage, full) {
  const base = `/admin/papawis/${run.id}/signups/${s.id}`;
  const canNotify = canManage && !s.guest && s.status === 'confirmed' && s.team && s.reminded && !s.teamNotified;
  return [
    canManage && s.status === 'waitlist' ? (full
      ? { label: 'Move to confirmed', sub: 'Confirmed is full', disabled: true }
      : { label: 'Move to confirmed', sub: 'Takes the next open slot', post: `${base}/status`, body: { status: 'confirmed' }, done: `${s.name} moved to confirmed` }) : null,
    canManage && s.status === 'confirmed' ? { label: 'Move to the waitlist', sub: 'Frees their slot for the next person', post: `${base}/status`, body: { status: 'waitlist' }, done: `${s.name} moved to the waitlist` } : null,
    canNotify ? { label: `Email their team (${sideLabel(s.team)})`, sub: 'Their reminder went out before teams were set', post: `${base}/notify-team`, done: `${s.name} emailed their team`,
      ask: `Email ${s.name} that they're on Team ${sideLabel(s.team)}? This is a one-time catch-up email.` } : null,
    // On the day or after (also once closed out): who didn't show, who came and sat out.
    // Both stay on the bill.
    ...(s.canMark ? [
      s.att !== 'noshow' ? { label: 'Mark as no-show', sub: 'Signed up, didn’t come. Still charged', post: `${base}/attendance`, body: { mark: 'noshow' }, done: `${s.name} marked no-show` } : null,
      s.att !== 'dnp' ? { label: 'Mark as DNP', sub: 'Came, didn’t play. Still charged', post: `${base}/attendance`, body: { mark: 'dnp' }, done: `${s.name} marked DNP` } : null,
      s.att ? { label: 'Mark as played', sub: 'Clears the no-show or DNP', post: `${base}/attendance`, body: { mark: '' }, done: `${s.name} marked played` } : null,
    ] : []),
    canManage ? { label: 'Remove from the run', danger: true, post: `/admin/papawis/${run.id}/remove/${s.id}`, done: `${s.name} removed`,
      ask: `Remove ${s.name}? ${s.status === 'confirmed' ? 'The first person on the waitlist moves up.' : 'They come off the waitlist.'}` } : null,
  ].filter(Boolean);
}

// No-show / DNP pill beside a name (Roster and Money).
const attPill = s => (s.att ? `<span class="adm-att adm-att--${esc(s.att)}">${s.att === 'noshow' ? 'No-show' : 'DNP'}</span>` : '');

// One player row. Drag by the grip to reorder or move between lists; tap for the sheet.
function row(run, s, { canManage, full, n, drag = true, right = '' }) {
  const acts = rowActs(run, s, canManage, full);
  const sub = [s.guest ? `Guest of ${s.sponsor}` : s.teamName, run.open && s.status === 'confirmed' && s.team ? sideLabel(s.team) : ''].filter(Boolean).join(' · ');
  // No-show / DNP as a pill beside the name, so the roster reads at a glance.
  const att = attPill(s);
  const face = appAvatar({ playerId: s.face.playerId, initials: s.face.ini, ring: s.face.color, photoUrl: s.face.photoUrl });
  const who = `${face}<span class="cell__t"><span class="adm-name">${esc(s.name)}${att}</span><small>${esc(sub || ' ')}</small></span>`;
  return `<div class="cell adm-row" data-id="${esc(s.id)}">
    ${canManage && drag ? `<button type="button" class="adm-grip" aria-label="Drag ${esc(s.name)} to reorder">${grip}</button>` : `<span class="adm-n num">${n}</span>`}
    ${acts.length ? `<button type="button" class="adm-row__open" data-adm-acts="${attrJson(acts)}" data-adm-title="${esc(s.name)}">${who}<span class="adm-row__more" aria-hidden="true">${icons.more}</span></button>` : `<span class="adm-row__open">${who}</span>`}
    ${right}
  </div>`;
}

// The roster: deposits that need a confirm, then Confirmed and the waitlist (drag lists),
// then Add player and the lock.
function rosterTab(run, d) {
  const { confirmed, waitlist, pending, canManage } = d;
  const full = confirmed.length >= run.max;
  const dep = pending.length ? `<div class="sec sec--warn">Needs you · ${plural(pending.length, 'deposit')}</div>
    <div class="group">${pending.map(s => {
      const tx = s.tx;
      const act = tx
        ? postBtn('Confirm', `/admin/papawis/${run.id}/signups/${s.id}/confirm-deposit`, { cls: 'adm-pill', body: { tx_id: tx.id }, done: `${s.name} listed`,
            ask: `Confirm ${s.name}'s ${peso(tx.amount)} deposit? They move into Confirmed or the waitlist, whichever is open.` })
        : '';
      return `<div class="cell adm-dep">
        ${appAvatar({ playerId: s.face.playerId, initials: s.face.ini, ring: s.face.color, photoUrl: s.face.photoUrl })}
        <span class="cell__t">${esc(s.name)}<small>${tx ? `${peso(tx.amount)} ${esc(tx.method || 'deposit')} sent · review it` : `No deposit sent yet · at least ${peso(d.minDeposit)}`}</small></span>
        ${act}
      </div>`;
    }).join('')}</div>
    ${pending.some(s => !s.tx) ? '<p class="foot-note">A deposit paid outside the app (cash, Messenger) is confirmed on the full site.</p>' : ''}` : '';
  const list = (status, label, rows, empty) => `<div class="sec adm-sec">${label}</div>
    <div class="group adm-list" data-adm-list="${status}"${canManage ? ' data-adm-dnd' : ''}>
      ${rows.length ? rows.map((s, i) => row(run, s, { canManage, full, n: i + 1 })).join('') : `<div class="cell adm-empty">${esc(empty)}</div>`}
    </div>`;
  const lock = run.open ? postBtn(run.locked ? 'Unlock roster' : 'Lock roster', `/admin/papawis/${run.id}/${run.locked ? 'unlock' : 'lock'}`, { cls: 'btn btn--outline',
    ask: run.locked ? 'Unlock the roster? Sign-ups and teams become editable again.' : 'Lock the roster? Sign-ups and teams freeze until you unlock. Do this once you\'ve sent the list out.',
    done: run.locked ? 'Roster unlocked' : 'Roster locked' }) : '';
  return `${dep}
    ${list('confirmed', `Confirmed · ${confirmed.length}/${run.max}${['noshow', 'dnp'].map(k => { const n = confirmed.filter(s => s.att === k).length; return n ? ` · ${n} ${k === 'noshow' ? 'no-show' : 'DNP'}` : ''; }).join('')}`, confirmed, 'No one confirmed yet.')}
    ${run.open || waitlist.length ? list('waitlist', `Waitlist · ${waitlist.length}`, waitlist, 'Nobody waiting.') : ''}
    ${canManage ? '<p class="foot-note">Drag the grip to reorder or move between lists. The order is the slot order.</p>' : ''}
    <div class="adm-actions">
      ${canManage ? `<button type="button" class="btn btn--ghost" data-adm-add>${icons.plus}Add player</button>` : ''}
      ${lock}
    </div>
    ${canManage ? addSheet(run, d.players) : ''}`;
}

// Add a player (or their guests): search, pick, then Add. Same route as the site's form.
function addSheet(run, players) {
  return `<template data-adm-add-tpl>
    <div class="adm-add" data-adm-add-form data-url="/admin/papawis/${esc(run.id)}/add">
      <label class="adm-lbl" for="adm-q">Player</label>
      <input class="adm-input" id="adm-q" type="search" placeholder="Type a name" autocomplete="off" autocapitalize="words" enterkeyhint="search" data-adm-q>
      <div class="group adm-pick" data-adm-pick>${players.map(p => `<button type="button" class="cell adm-pick__row" data-id="${esc(p.id)}" data-q="${esc(p.name.toLowerCase())}" hidden>${appAvatar({ playerId: p.id, initials: p.ini, ring: p.color, photoUrl: p.photoUrl })}<span class="cell__t">${esc(p.name)}<small>${esc(p.team || ' ')}</small></span><span class="adm-pick__on">${icons.check}</span></button>`).join('')}</div>
      <label class="adm-lbl" for="adm-guests">Their guests (optional)</label>
      <input class="adm-input" id="adm-guests" type="text" placeholder="e.g. Bryan, Mark" autocomplete="off" autocapitalize="words" data-adm-guests>
      <p class="adm-help">Comma-separated. Guests are billed to this player.</p>
      <div class="seg adm-seg" role="radiogroup" aria-label="Add to">
        <label><input type="radio" name="adm-to" value="confirmed" checked><span>Confirmed</span></label>
        <label><input type="radio" name="adm-to" value="waitlist"><span>Waitlist</span></label>
      </div>
      <p class="msg msg--err" data-adm-add-msg role="alert" hidden></p>
      <button type="button" class="btn" data-adm-add-go disabled>Add</button>
      ${postBtn('Autofill regulars', `/admin/papawis/${run.id}/autofill-regulars`, { cls: 'btn btn--plain', done: 'Regulars added',
        ask: 'Add the regulars who aren\'t listed yet? Skips anyone on probation, with an unpaid balance or without an active account. Fills Confirmed first, then the waitlist.' })}
    </div>
  </template>`;
}

// Light and Dark: drag players across to swap sides (saves on drop).
function teamsTab(run, d) {
  const { teams } = d;
  if (!run.open) return '<div class="empty">Teams are only for upcoming runs.</div>';
  if (run.locked) return '<div class="empty">The roster is locked. Unlock it to change teams.</div>';
  if (!teams.all.length) return '<div class="empty">No confirmed players yet. Teams are built from the confirmed list.</div>';
  const seen = d.teamsSent ? '<p class="msg msg--ok">Players can see the teams.</p>'
    : '<p class="msg adm-msg">Players don\'t see teams yet. They show once their team email goes out with the reminder.</p>';
  if (!teams.built) {
    return `${seen}<div class="empty">Teams aren't built yet. They're balanced by position and height; guests are placed randomly.</div>
      <div class="adm-actions">${postBtn('Build teams', `/admin/papawis/${run.id}/teams`, { cls: 'btn', method: 'GET', done: 'Teams built',
        ask: 'Build the teams now? Each confirmed player gets a bell with their team.' })}</div>`;
  }
  const item = r => `<div class="cell adm-row" data-id="${esc(r.id)}">
      <button type="button" class="adm-grip" aria-label="Drag ${esc(r.name)} to the other side">${grip}</button>
      <span class="cell__t">${esc(r.name)}${r.guest ? ' <span class="muted">guest</span>' : ''}<small>${esc(r.meta || ' ')}</small></span>
    </div>`;
  const col = (key, label) => {
    const rows = teams.all.filter(r => r.team === key);
    return `<div class="adm-team"><div class="adm-team__h"><span class="pw-shirt pw-shirt--${key}" aria-hidden="true"></span>${label}<b class="num">${rows.length}</b></div>
      <div class="group adm-list" data-adm-team="${key}" data-adm-dnd>${rows.map(item).join('') || '<div class="cell adm-empty">Drop players here</div>'}</div></div>`;
  };
  const none = teams.all.filter(r => r.team !== 'light' && r.team !== 'dark');
  return `${seen}
    ${none.length ? `<p class="msg msg--warn">${plural(none.length, 'player')} not on a side yet. Drag them into Light or Dark.</p>` : ''}
    <div class="adm-teams">${col('light', 'Light')}${col('dark', 'Dark')}</div>
    ${none.length ? `<div class="sec adm-sec">No side yet</div><div class="group adm-list" data-adm-team="" data-adm-dnd>${none.map(item).join('')}</div>` : ''}
    <p class="foot-note">Drag the grip across to swap sides. Saves as you drop.</p>
    <div class="adm-actions">
      ${d.catchUp ? postBtn(`Email their teams · ${d.catchUp}`, `/admin/papawis/${run.id}/notify-teams`, { cls: 'btn', done: 'Team emails sent',
        ask: `Email ${plural(d.catchUp, 'player')} their team? Each gets their side and teammates, plus a bell. Anyone already emailed their team is skipped.` }) : ''}
      ${postBtn('Reshuffle', `/admin/papawis/${run.id}/teams/reshuffle`, { cls: 'btn btn--outline', done: 'Teams reshuffled', ask: 'Reshuffle both sides from scratch? Any swaps you made by hand are lost.' })}
    </div>`;
}

// Before close-out: the amounts, as the site's Money tab (views/admin/papawis-run.js). The
// estimate (court, hours, referee, minimum) saves to /estimate and is what players see per
// head; the final price charges everyone confirmed through /complete. public/app.js
// initAdminPapawis keeps the sums live (same maths as public/admin-papawis.js).
function amountsTab(run, d) {
  const c = d.calc;
  if (!c) return '';
  const n = d.confirmedCount;
  const num = (label, key, value, attrs = '') => `<label class="adm-calc__f"><span class="adm-lbl">${label}</span>
    <input class="adm-input num" type="number" inputmode="decimal" min="0" value="${esc(value)}" data-calc="${key}"${attrs}></label>`;
  return `<div class="sec adm-sec">Price estimate</div>
    <div class="card adm-card adm-calc" data-adm-calc="${esc(run.id)}" data-count="${n}">
      <div class="adm-calc__row">${num('Court ₱ per hour', 'rate', c.rate, ' step="1"')}${num('Hours', 'hours', c.hours, ' step="0.25"')}</div>
      <label class="adm-calc__sw"><span class="cell__t">Referee<small>Paid by the hour, like the court</small></span><input type="checkbox" class="switch" data-calc="hasRef"${c.hasRef ? ' checked' : ''}></label>
      <div class="adm-calc__row">${num('Referee ₱ per hour', 'ref', c.refRate, ` step="1"${c.hasRef ? '' : ' disabled'}`)}${num('Minimum per player', 'min', c.min, ' step="1" placeholder="Optional"')}</div>
      <dl class="adm-calc__sum">
        <div><dt>Court</dt><dd class="num" data-calc-out="court">₱0</dd></div>
        <div data-calc-refrow${c.hasRef ? '' : ' hidden'}><dt>Referee</dt><dd class="num" data-calc-out="refCost">₱0</dd></div>
        <div class="is-total"><dt>Total</dt><dd class="num" data-calc-out="total">₱0</dd></div>
        <div><dt>÷ ${plural(n, 'confirmed player')}</dt><dd class="num" data-calc-out="raw">₱0</dd></div>
      </dl>
      <button type="button" class="btn btn--ghost" data-calc-save>Save estimate</button>
      <p class="adm-help">${c.saved ? 'Saved. ' : ''}Players see this per head on the run and in their reminder email. Nobody is charged.</p>
    </div>
    <div class="sec adm-sec">After the game</div>
    <div class="card adm-card adm-calc">
      <label class="adm-calc__f"><span class="adm-lbl">Final price per player</span>
        <span class="adm-calc__peso"><span aria-hidden="true">₱</span><input class="adm-input num" type="number" inputmode="numeric" min="1" step="1" value="${esc(c.price)}" data-calc-price></span></label>
      <p class="adm-help">Follows the estimate; change it freely. Close out marks the run played and charges ${n ? `all ${plural(n, 'confirmed player')}` : 'every confirmed player'} this price. Free-run vouchers are used up instead of charged.</p>
      <button type="button" class="btn" data-calc-complete${n ? '' : ' disabled'}>Close out and charge</button>
      ${n ? '' : '<p class="adm-help">Nobody is confirmed, so there\'s no one to charge.</p>'}
    </div>`;
}

// After the game: who paid. Mark paid records the payment in the ledger, as on the site.
function moneyTab(run, d) {
  if (run.cancelled) return '<div class="empty">Cancelled. Nobody was charged for this run.</div>';
  if (!run.completed) return amountsTab(run, d);
  const { confirmed } = d;
  const paid = confirmed.filter(s => s.paid).length;
  const rows = confirmed.map(s => {
    const base = `/admin/papawis/${run.id}/signups/${s.id}`;
    let right, sub;
    if (s.paid) {
      sub = s.teamName;
      right = postBtn(`${icons.check}Paid`, `${base}/paid`, { cls: 'adm-pill adm-pill--done', body: { paid: false }, done: `${s.name} marked unpaid`, ask: `Unmark ${s.name} as paid? This voids the recorded payment in the ledger.` });
    } else if (s.match === 1 && s.matchPending) {
      // Sent by the player, waiting for an admin: confirm it and link it in one tap.
      sub = `Sent ${peso(s.matchAmount)} on ${s.matchDate}${s.matchMethod ? ` · ${s.matchMethod}` : ''} · waiting to confirm`;
      right = postBtn('Confirm', `${base}/confirm-link`, { cls: 'adm-pill', body: { tx_id: s.matchId }, done: `${s.name}'s payment confirmed`,
        ask: `Confirm ${s.name}'s ${peso(s.matchAmount)} payment from ${s.matchDate}? It's posted to the ledger under Papawis and marks them paid for this run.` });
    } else if (s.match === 1) {
      sub = `Possible match: ${peso(s.matchAmount)} paid ${s.matchDate}${s.matchCat ? ` · filed as ${s.matchCat}` : ''}`;
      right = postBtn('Link', `${base}/link-payment`, { cls: 'adm-pill', body: { tx_id: s.matchId }, done: 'Payment linked',
        ask: s.matchCat ? `Link ${s.name}'s ${peso(s.matchAmount)} payment from ${s.matchDate} to this run? It moves from ${s.matchCat} to Papawis in the ledger.` : '' });
    } else {
      sub = s.match > 1 ? `Owes ${peso(run.price)} · ${s.match} payments sent: check them on the full site` : `Owes ${peso(run.price)}`;
      right = postBtn('Mark paid', `${base}/paid`, { cls: 'adm-pill adm-pill--quiet', body: { paid: true }, done: `${s.name} marked paid`, ask: `Mark ${s.name} as paid ${peso(run.price)}? This records the payment in the ledger.` });
    }
    return `<div class="cell adm-pay">
      ${appAvatar({ playerId: s.face.playerId, initials: s.face.ini, ring: s.face.color, photoUrl: s.face.photoUrl })}
      <span class="cell__t"><span class="adm-name">${esc(s.name)}${attPill(s)}</span><small class="${s.paid ? '' : s.match === 1 ? 'adm-amber' : 'adm-due'}">${esc(s.guest ? [sub, `Guest of ${s.sponsor}`].filter(Boolean).join(' · ') : sub || ' ')}</small></span>
      ${right}
    </div>`;
  }).join('');
  const owed = confirmed.length - paid;
  return `<div class="group adm-stats">
      <div><span>Per player</span><b class="num">${peso(run.price)}</b></div>
      <div><span>Paid</span><b class="num">${paid}<small>/${confirmed.length}</small></b></div>
      <div><span>Still owed</span><b class="num">${peso(owed * run.price)}</b></div>
    </div>
    <div class="sec adm-sec">Payments</div>
    <div class="group">${rows || '<div class="cell adm-empty">Nobody was charged.</div>'}</div>
    ${owed ? `<div class="adm-actions">${postBtn(`Email payment reminders · ${owed}`, `/admin/papawis/${run.id}/send-payment-emails`, { cls: 'btn', done: 'Payment emails sent',
      ask: `Email everyone charged (${confirmed.length}) their total? Each gets what they owe for this run and a link to settle up. Nobody is charged again.` })}</div>` : ''}`;
}

// The announcement, the Messenger post and the slot-opened alerts.
function messagesTab(run, d) {
  const b = d.broadcast;
  const parts = [];
  if (run.open && b) {
    const scheduled = run.announceAt && !run.announcedAt && run.announceAt > Date.now();
    let body;
    if (run.locked) body = '<p class="adm-help">The roster is locked, so there\'s nothing to announce.</p>';
    else if (scheduled) body = `<p class="adm-help">Scheduled for ${esc(d.fmt(run.announceAt))}, when sign-ups open.</p>${postBtn('Cancel scheduled announcement', `/admin/papawis/${run.id}/announce/cancel`, { done: 'Scheduled announcement cancelled' })}`;
    else if (run.announcedAt) body = `<p class="adm-help">Announced ${esc(d.fmt(run.announcedAt))}: ${plural(run.announcedCount || 0, 'email')} sent.</p>${postBtn('Announce again', `/admin/papawis/${run.id}/announce`, { done: 'Announced again', ask: 'Announce this run again? Regulars who aren\'t on the roster get another email.' })}`;
    else {
      const p = b.preview || { total: 0, emailable: 0 };
      body = `<div class="adm-reach"><div><span>Bell + phone</span><b class="num">${p.total}</b></div><div><span>Email</span><b class="num">${p.emailable}</b></div></div>
        <p class="adm-help">Goes to regulars (played ${esc(b.regularsRule)}). Anyone already on the roster is skipped.</p>
        ${postBtn(run.openDelay ? 'Announce when sign-ups open' : `Announce to ${plural(p.total, 'regular')}`, `/admin/papawis/${run.id}/announce`, { cls: 'btn', done: 'Announcement sent',
          ask: `Announce ${run.title} to ${plural(p.total, 'regular')}? Bell to ${p.total}, email to ${p.emailable}.` })}`;
    }
    parts.push(`<div class="sec adm-sec">New-run announcement</div><div class="card adm-card">${body}</div>`);
  }
  parts.push(`<div class="sec adm-sec">${run.completed ? 'Payment status for Messenger' : 'Roster for Messenger'}</div>
    <div class="group"><div class="adm-post">${esc(d.messenger)}</div>
      <button type="button" class="btn btn--plain adm-copy" data-adm-copy="${esc(d.messenger)}">${icons.copy}Copy for Messenger</button></div>`);
  if (run.open && b) {
    const off = !b.state.slotAlertsEnabled ? 'Slot-opened alerts are off. Turn them on from the Runs page on the full site.' : !b.state.production ? 'Slot-opened alerts only send from the live site.' : '';
    const items = (b.alerts || []).map(a => `<div class="cell"><span class="cell__t">${a.open_slots ? `${plural(a.open_slots, 'slot')} opened` : 'A slot opened'}<small>${esc(d.fmt(a.created_at))}${a.group1_sent_at != null ? ` · ${a.group1_count < 0 ? 'skipped, slots filled first' : `${a.group1_count} regulars emailed`}` : ' · waiting to send'}</small></span></div>`).join('');
    parts.push(`<div class="sec adm-sec">Slot-opened alerts</div><div class="group">${items || `<div class="cell adm-empty">${esc(off || 'None for this run.')}</div>`}</div>${items && off ? `<p class="foot-note">${esc(off)}</p>` : ''}`);
  }
  return parts.join('');
}

function activityTab(d) {
  if (!d.activity.length) return '<div class="empty">No activity yet. Sign-ups, cancellations and emails show up here.</div>';
  return `<div class="group">${d.activity.map(a => `<div class="cell"><span class="cell__t">${esc(a.who)} ${esc(a.what)}<small>${esc(a.when)}</small></span></div>`).join('')}</div>`;
}

// run: { id, title, day, time, place, photo, hasCover, status, open, completed, cancelled,
// locked, scheduled, max, price, announcedAt, announcedCount, announceAt, openDelay, daysLeft }
// d: the tab's data (server.js /app/admin/papawis/:id)
export function appAdminPapawisPage({ missing = false, run = null, tab = 'roster', d = {}, back }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Manage run</span><span></span></div>`;
  if (missing || !run) return `${nav}<div class="empty pw-gap">This run isn't on the list any more.</div>`;
  const tabs = [
    ['roster', 'Roster', d.count],
    run.open ? ['teams', 'Teams'] : null,
    ['money', 'Money'],
    ['messages', 'Messages'],
    ['activity', 'Activity'],
  ].filter(Boolean);
  const current = tabs.some(t => t[0] === tab) ? tab : 'roster';
  const status = run.cancelled ? 'Cancelled' : run.completed ? 'Played' : run.scheduled ? 'Scheduled' : run.locked ? 'Locked' : d.confirmedCount >= run.max ? 'Full' : 'Open';
  const notices = [
    run.open && run.locked ? '<p class="msg msg--warn">The roster is locked: sign-ups and team changes are frozen.</p>' : '',
    run.open && run.scheduled ? `<p class="msg adm-msg">Sign-ups open ${esc(run.opensLabel)}. Until then players see the run as Scheduled.</p>` : '',
    d.canAnnounce && !run.scheduled && current !== 'messages' ? `<p class="msg msg--warn adm-msg-act"><span>Not announced yet. Regulars haven't heard about this run.</span><a class="adm-pill" href="/app/admin/papawis/${esc(run.id)}?tab=messages">Announce</a></p>` : '',
    d.catchUp && current === 'roster' ? `<p class="msg msg--warn adm-msg-act"><span>${plural(d.catchUp, 'player')} got their reminder before teams were set.</span><a class="adm-pill" href="/app/admin/papawis/${esc(run.id)}?tab=teams">Teams</a></p>` : '',
  ].join('');
  const body = { roster: () => rosterTab(run, d), teams: () => teamsTab(run, d), money: () => moneyTab(run, d), messages: () => messagesTab(run, d), activity: () => activityTab(d) }[current]();
  // The cover: Change cover opens the photo picker; on a computer or iPad, drop a photo on it.
  const cover = `<div class="pw-hero adm-cover" data-adm-cover="${esc(run.id)}"${run.hasCover ? ' data-has-cover' : ''}>
      ${run.photo ? `<img class="pw-hero__img" src="${esc(run.photo)}" alt="" decoding="async">` : ''}
      <div class="pw-hero__top"><span class="pw-glass">${esc(status)}</span>
        <button type="button" class="pw-glass adm-cover__btn" data-adm-cover-btn>${icons.camera}<span>${run.hasCover ? 'Change cover' : 'Add cover'}</span></button></div>
      <div class="pw-hero__body"><span class="kick">${esc(run.title)}</span>${run.time ? `<b class="pw-hero__time">${esc(run.time)}</b>` : ''}<span class="pw-hero__place">${icons.pin}${esc(run.day)} · ${esc(run.place)}</span></div>
      <div class="adm-cover__drop" aria-hidden="true"><span>${icons.image}Drop the photo to use it as the cover</span></div>
      <input type="file" accept="image/*" hidden data-adm-cover-input>
    </div>`;
  const stats = current === 'money' && run.completed ? '' : `<div class="group adm-stats">
      <div><span>Confirmed</span><b class="num">${d.confirmedCount}<small>/${run.max}</small></b></div>
      <div><span>Waitlist</span><b class="num">${d.waitCount}</b></div>
      ${run.completed ? `<div><span>Paid</span><b class="num">${d.paidCount}<small>/${d.confirmedCount}</small></b></div>`
        : `<div><span>${run.daysLeft >= 0 ? 'Starts' : 'Played'}</span><b>${run.daysLeft === 0 ? 'Today' : run.daysLeft === 1 ? 'Tomorrow' : run.daysLeft > 0 ? `In ${run.daysLeft} days` : `${-run.daysLeft} days ago`}</b></div>`}
    </div>`;
  return `${nav}
  <div class="adm" data-adm-run="${esc(run.id)}" data-adm-max="${run.max}">
    <section class="sx adm-hero">${cover}</section>
    ${notices}
    ${stats}
    <nav class="adm-tabs" aria-label="Run sections">${tabs.map(([k, label, n]) => `<a class="adm-tab${k === current ? ' is-on' : ''}" href="/app/admin/papawis/${esc(run.id)}${k === 'roster' ? '' : `?tab=${k}`}"${k === current ? ' aria-current="page"' : ''}>${label}${n ? ` <span class="num">${n}</span>` : ''}</a>`).join('')}</nav>
    ${body}
    <p class="foot-note">Court, time and cancelling are on the full site. <a class="adm-link" href="/admin/papawis/${esc(run.id)}?tab=settings" data-reload>Run settings</a></p>
  </div>`;
}

// The Messenger post, as the site's Copy for Messenger builds it (public/admin-papawis.js).
// New run (/app/admin/papawis/new): the site's New run drawer as a screen. courts: active court
// names (then Other…). values: what was sent back after a missing date; error: why.
export function appAdminPapawisNewPage({ courts = [], today = '', back, error = '', values = {} }) {
  const v = k => esc(values[k] ?? '');
  const other = values.location === '__other__';
  const opt = (val, label, on) => `<option value="${esc(val)}"${on ? ' selected' : ''}>${esc(label)}</option>`;
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">New run</span><span></span></div>
  <form method="post" action="/app/admin/papawis/new" data-busy data-new-run>
    ${error ? `<p class="msg msg--err" role="alert">${esc(error)}</p>` : ''}
    <div class="group form-group" style="margin-top:14px">
      <div class="cell"><label class="cell__lbl" for="nr-date">Date</label><input id="nr-date" name="date" type="date" min="${esc(today)}" value="${v('date')}" required></div>
      <div class="cell"><label class="cell__lbl" for="nr-start">Start</label><input id="nr-start" name="start_time" type="time" value="${v('start_time')}"></div>
      <div class="cell"><label class="cell__lbl" for="nr-end">End</label><input id="nr-end" name="end_time" type="time" value="${v('end_time')}"></div>
      <div class="cell"><label class="cell__lbl" for="nr-court">Court</label><select id="nr-court" name="location" data-nr-court>
        ${opt('', 'Pick a court', !values.location)}${courts.map(c => opt(c, c, values.location === c)).join('')}${opt('__other__', 'Other…', other)}</select></div>
      <div class="cell" data-nr-other${other ? '' : ' hidden'}><label class="cell__lbl" for="nr-other">Where</label><input id="nr-other" name="location_other" type="text" placeholder="Court name and area" value="${v('location_other')}"></div>
      <div class="cell"><label class="cell__lbl" for="nr-max">Players</label><input id="nr-max" name="max_slots" type="number" inputmode="numeric" min="1" step="1" value="${v('max_slots') || '20'}"></div>
      <div class="cell"><label class="cell__lbl" for="nr-title">Title</label><input id="nr-title" name="title" type="text" placeholder="From the date, e.g. Sunday (Nov 8)" value="${v('title')}"></div>
    </div>
    <div class="group" style="margin-top:12px"><label class="cell adm-check"><input type="checkbox" name="open_days_before" value="6"${values.open_days_before ? ' checked' : ''}><span class="cell__t">Hold sign-ups until 6 days before<small>Shows as Scheduled until then</small></span></label></div>
    <div class="pad stack" style="margin-top:12px"><button class="btn" type="submit">Create run</button></div>
    <p class="foot-note">The run shows on the Papawis tab and Home once it's created. Announce it from Manage run → Messages.</p>
  </form>
  <script>(function () { var f = document.querySelector('[data-new-run]'); if (!f) return; var s = f.querySelector('[data-nr-court]'), o = f.querySelector('[data-nr-other]');
    s.addEventListener('change', function () { o.hidden = s.value !== '__other__'; if (!o.hidden) o.querySelector('input').focus(); }); })();</script>`;
}

export function papawisMessengerText({ date, start_time, end_time, location, max_slots, completed, confirmed, waitlist, paid }) {
  const clock = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); const h12 = h % 12 === 0 ? 12 : h % 12; return m === 0 ? `${h12}${h >= 12 ? 'PM' : 'AM'}` : `${h12}:${String(m).padStart(2, '0')}${h >= 12 ? 'PM' : 'AM'}`; };
  const d = new Date(`${date}T00:00:00`);
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lines = [];
  if (completed) {
    lines.push(`🏀 PPWS : ${monthDay} — Payment Status 🏀`, '');
    confirmed.forEach((n, i) => lines.push(`${i + 1}. ${n} ${paid[i] ? '✅' : '❌'}`));
    lines.push('', '❌ = still unpaid — settle up through the Portal or send an admin your payment directly.');
    return lines.join('\n');
  }
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const time = start_time && end_time ? `${clock(start_time)}-${clock(end_time)}` : '';
  lines.push('Papawis sign-ups are open! 🏀',
    'Head to the WKND Portal (https://wkndbasketball.com/papawis), log in, and tap Join to grab a slot. First come, first served — once we hit the slot limit, extra names go on the waitlist.', '',
    '⚠ Not able to make it? Cancel on the portal at least 3 days before game day. After that, message an admin directly — no-shows without notice may affect future priority. ⚠', '',
    `🏀 PPWS : ${day} : ${time} - ${monthDay} 🏀`);
  if (location) lines.push(`📍 ${location}`);
  lines.push('');
  for (let i = 0; i < max_slots; i++) lines.push(`${i + 1}. ${confirmed[i] || ''}`);
  if (waitlist.length) { lines.push('', 'Waitlist:'); waitlist.forEach((n, i) => lines.push(`${i + 1}. ${n}`)); }
  lines.push('', '💸 After the game, you can settle up anytime through your Portal account — totally optional, you can always just send payment straight to an admin instead.');
  return lines.join('\n');
}

// The run card's admin strip on the Papawis tab and a past run's screen (views/app/papawis.js).
// a: { id, note, count }
export function papawisAdminStrip(a) {
  return `<a class="pw-admin" href="/app/admin/papawis/${esc(a.id)}"><i>${icons.gear}</i><span><b>Manage run</b><small>${esc(a.note)}</small></span>${a.count ? `<em class="num" aria-label="${a.count} to do">${a.count}</em>` : ''}${chev}</a>`;
}
