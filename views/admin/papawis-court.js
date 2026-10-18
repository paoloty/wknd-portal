// Admin: one court's public page (/courts/:slug). Papawis → Courts → a court. Name, address,
// rate and photo stay in the Courts list drawer; this page holds everything the public page
// adds: city, "Good to know" info, the About writeup, the gallery, visibility and search text.
import { escHtml } from '../layout.js';
import { pageHeader, section, button, badge, breadcrumb, field, fieldGrid, toggleRow, saveBar, banner, facts, menu, emptyState, ago } from './ui.js';
import { COURT_TYPES, COURT_FLOORS, COURT_FEATURES, COURT_TEXT_FIELDS, COURT_LINK_FIELDS, COURT_CITIES, RATING_ASPECTS, RATING_TAGS_GOOD, RATING_TAGS_BAD, parseJson } from '../../lib/court-page.js';
import { displayPlayerName, formatTimeRange } from '../utils.js';

const attr = s => escHtml(String(s ?? ''));

// "Suggest facts": posts the pasted notes, lists the facts that come back as ticks, and adds
// the ticked ones to the Extra facts box (the save bar then saves them with the page).
// Re-binds on admin:updated, since admin pages update in place.
const SUGGEST_SCRIPT = `<script>
(function () {
  function bind() {
    var btn = document.querySelector('[data-suggest-facts]');
    if (!btn || btn.__bound) return; btn.__bound = true;
    var text = document.querySelector('[data-suggest-text]'), list = document.querySelector('[data-suggest-list]'), msg = document.querySelector('[data-suggest-msg]');
    var box = document.querySelector('[data-extra-facts]');
    btn.addEventListener('click', function () {
      btn.disabled = true; msg.textContent = 'Reading…'; list.hidden = true; list.innerHTML = '';
      fetch(btn.getAttribute('data-suggest-facts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.value }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Failed.'); return d; }); })
        .then(function (d) {
          if (!d.facts.length) { msg.textContent = 'No new facts found in that text.'; return; }
          msg.textContent = 'Tick the ones you know are true, then add them.';
          d.facts.forEach(function (f) {
            var l = document.createElement('label'); l.className = 'aui-check';
            var i = document.createElement('input'); i.type = 'checkbox'; i.value = f; i.checked = true;
            var s = document.createElement('span'); s.textContent = f;
            l.appendChild(i); l.appendChild(s); list.appendChild(l);
          });
          var add = document.createElement('button'); add.type = 'button'; add.className = 'aui-btn aui-btn--primary aui-btn--sm'; add.textContent = 'Add ticked facts';
          add.addEventListener('click', function () {
            var picked = [].slice.call(list.querySelectorAll('input:checked')).map(function (i) { return i.value; });
            if (!picked.length) return;
            box.value = (box.value.trim() ? box.value.trim() + '\\n' : '') + picked.join('\\n');
            box.dispatchEvent(new Event('input', { bubbles: true }));
            list.hidden = true; list.innerHTML = ''; text.value = '';
            msg.textContent = picked.length + ' added to Extra facts. Save the page to keep them.';
          });
          list.appendChild(add); list.hidden = false;
        })
        .catch(function (e) { msg.textContent = e.message; })
        .then(function () { btn.disabled = false; });
    });
  }
  bind(); document.addEventListener('admin:updated', bind);
})();
</script>`;
const dayLabel = ymd => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const TAG_LABEL = Object.fromEntries([...RATING_TAGS_GOOD, ...RATING_TAGS_BAD]);
const ASPECT_LABEL = Object.fromEntries(RATING_ASPECTS);

export function adminPapawisCourtBody({ court, p, info = {}, aiOn = true, flags = {}, ratings = [], slots = [], requests = [], runs = [] }) {
  const id = attr(court.id);
  const pageUrl = `/courts/${encodeURIComponent(court.slug)}`;
  const status = court.page_hidden
    ? badge('Hidden', 'gray')
    : p.live ? badge('Live', 'green') : badge('Not played yet', 'amber');
  const statusLine = court.page_hidden
    ? 'Hidden by you. Switch it on to show the page again.'
    : p.live ? 'Live on the site and in the sitemap.' : 'Goes live by itself after the first run or league game here.';

  const page = `<div class="aui-panel acrt-panel">
    ${toggleRow({ label: 'Show the court page', help: statusLine, name: 'page_on', on: !court.page_hidden })}
    ${facts([
      ['Page address', `<a class="acrt-link" href="${attr(pageUrl)}" target="_blank" rel="noopener">wkndbasketball.com${escHtml(pageUrl)} ↗</a>`],
      ['Played here', escHtml(`${p.playedRuns} Papawis run${p.playedRuns === 1 ? '' : 's'} · ${p.finalsCount} league game${p.finalsCount === 1 ? '' : 's'}`)],
    ])}
    ${button('Edit name, address, rate & photo', { kind: 'secondary', size: 'sm', href: '/admin/papawis/courts' })}
  </div>`;

  // Ticks so every court page reads the same; text only where a tick can't say it.
  const radios = (name, opts, cur) => `<div class="acrt-ticks">${[['', 'Not set'], ...opts].map(([k, l]) => `<label class="aui-check"><input type="radio" name="${name}" value="${attr(k)}"${(cur || '') === k ? ' checked' : ''}><span>${escHtml(l)}</span></label>`).join('')}</div>`;
  const feats = new Set(info.features || []);
  const tick = (title, html) => `<div class="acrt-tickgroup"><span class="aui-field__label">${escHtml(title)}</span>${html}</div>`;
  const text = Object.fromEntries(COURT_TEXT_FIELDS.map(x => [x.key, x]));
  const infoBlock = `<div class="aui-panel acrt-info">
    ${fieldGrid(field({ label: 'City', name: 'city', type: 'select', value: court.city || '', options: [['', p.city ? `Automatic (${p.city})` : 'Not set'], ...COURT_CITIES.map(c => [c, c])] }))}
    ${tick('Court type', radios('info_setting', COURT_TYPES, info.setting))}
    ${tick('Floor', radios('info_floor', COURT_FLOORS, info.floor))}
    ${COURT_FEATURES.map(g => tick(g.group, `<div class="acrt-ticks">${g.items.map(([k, l]) => `<label class="aui-check"><input type="checkbox" name="features[]" value="${attr(k)}"${feats.has(k) ? ' checked' : ''}><span>${escHtml(l)}</span></label>`).join('')}</div>`)).join('')}
    ${fieldGrid(`${field({ label: text.directions.label, name: 'info_directions', value: info.directions || '', placeholder: `e.g. ${text.directions.placeholder}`, wide: true })}
      ${field({ label: text.notes.label, name: 'info_notes', value: info.notes || '', placeholder: `e.g. ${text.notes.placeholder}`, wide: true })}
      ${field({ label: text.contact.label, name: 'info_contact', value: info.contact || '', placeholder: `e.g. ${text.contact.placeholder}`, wide: true, help: 'Only you see this, unless you tick the box below.' })}`)}
    <label class="aui-check acrt-check"><input type="checkbox" name="info_contact_public" value="1"${info.contact_public ? ' checked' : ''}><span>Show the court contact on the public page</span></label>
    ${fieldGrid(`${field({ label: 'Court rental rate', name: 'info_rate', value: info.rate || '', placeholder: 'e.g. From ₱2,800 (per activatesports.ph)', wide: true, help: 'As the venue posts it publicly. Shown on the page and sent to Google. Blank = hidden.' })}
      ${COURT_LINK_FIELDS.map(f => field({ label: f.label, name: `link_${f.key}`, type: 'url', value: info.links?.[f.key] || '', placeholder: f.placeholder })).join('')}`)}
    ${fieldGrid(field({ label: 'Map pin', name: 'map_pin', value: court.map_lat != null ? `${court.map_lat}, ${court.map_lng}` : '', placeholder: 'Paste a Google Maps link or 14.5806, 121.0536', wide: true,
      help: court.map_lat != null ? 'The court page map uses this exact pin. Clear it to fall back to the address.' : 'Empty: the map uses the address, which can land on the city centre. In Google Maps, right-click the court and copy the numbers, or paste the share link.' }))}
    <div class="acrt-facts">
      ${fieldGrid(field({ label: 'Extra facts for the writeup', name: 'extra_facts', type: 'textarea', rows: 5, value: court.extra_facts || '', wide: true, attrs: 'data-extra-facts',
        placeholder: 'Air-conditioned court\nScoreboard and game clock\nLockers and showers on the 2nd floor',
        help: 'One fact per line, things you checked yourself (the front desk, the court’s page, reviews you read). The About writeup can use these. No opinions or quotes.' }))}
      <details class="acrt-suggest">
        <summary>Suggest facts from notes or reviews</summary>
        <div class="acrt-suggest__body">
          <textarea class="aui-input" rows="5" data-suggest-text placeholder="Paste notes, the court’s own page text, or reviews you read. Only facts come back, never opinions or quotes. Nothing here is saved."></textarea>
          <div class="acrt-actions">${button('Suggest facts', { kind: 'secondary', size: 'sm', attrs: `data-suggest-facts="/admin/papawis/courts/${id}/facts/suggest"` })}<span class="aui-muted acrt-hint" data-suggest-msg></span></div>
          <div class="acrt-suggest__list" data-suggest-list hidden></div>
        </div>
      </details>
    </div>
  </div>`;

  const draft = court.writeup_draft
    ? `<div class="aui-panel acrt-draft">
        <div class="acrt-draft__head">${badge('Draft', 'amber')}<span class="aui-muted">Read it, then use it or keep editing the live text.</span></div>
        <p class="acrt-draft__text">${escHtml(court.writeup_draft)}</p>
        <div class="acrt-actions">
          ${button('Use this draft', { kind: 'primary', size: 'sm', attrs: `data-post-json="/admin/papawis/courts/${id}/writeup/approve" data-done="Writeup is live."` })}
          ${button('Discard', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/papawis/courts/${id}/writeup/discard" data-done="Draft discarded."` })}
        </div>
      </div>` : '';
  const writeup = `${draft}<div class="aui-panel">${fieldGrid(field({ label: 'Live text', name: 'writeup', type: 'textarea', rows: 6, wide: true, value: court.writeup || '', placeholder: 'Two short paragraphs about the court, or use Generate draft below.', help: 'Leave a blank line between paragraphs. Empty = the page skips this section.' }))}
    <div class="acrt-actions">
      ${aiOn ? button(court.writeup ? 'Regenerate draft' : 'Generate draft', { kind: 'secondary', size: 'sm', attrs: `data-post-json="/admin/papawis/courts/${id}/writeup/generate" data-done="Draft ready."` }) : '<span class="aui-muted">AI drafts need an AI provider key.</span>'}
      <span class="aui-muted acrt-hint">Written from this court’s own numbers and fact-checked. You approve it before it goes live.</span>
    </div></div>`;

  const shown = new Set(p.photos.map(x => x.key));
  const mainKey = court.gallery_main || p.allPhotos[0]?.key;
  const gallery = p.allPhotos.length
    ? `<div class="aui-panel"><div class="acrt-gal">${p.allPhotos.map(ph => `<div class="acrt-gal__item">
        <img src="${attr(ph.src)}" alt="" loading="lazy">
        <div class="acrt-gal__meta"><b>${escHtml(ph.tag)}</b><small>${escHtml(ph.caption)}</small></div>
        <div class="acrt-gal__ctl">
          <label class="aui-check"><input type="checkbox" name="gallery_show[]" value="${attr(ph.key)}"${shown.has(ph.key) ? ' checked' : ''}><span>Show</span></label>
          <label class="aui-check"><input type="radio" name="gallery_main" value="${attr(ph.key)}"${mainKey === ph.key ? ' checked' : ''}><span>Main photo</span></label>
        </div>
      </div>`).join('')}</div>
      <p class="aui-muted acrt-foot">Photos come in by themselves: the court photo, Papawis run covers and league game covers at this court.</p></div>`
    : `<div class="aui-panel"><p class="aui-muted acrt-foot">No photos yet. Add a court photo with “Edit name, address, rate &amp; photo”, or a cover on a run or game here.</p></div>`;

  const seo = `<div class="aui-panel">
    <div class="acrt-serp" aria-label="Google preview"><span class="acrt-serp__url">wkndbasketball.com › courts › ${escHtml(court.slug)}</span><b class="acrt-serp__title">${escHtml(p.title)}</b><span class="acrt-serp__desc">${escHtml(p.description)}</span></div>
    ${fieldGrid(`${field({ label: 'Title', name: 'seo_title', value: court.seo_title || '', wide: true, help: `Blank = automatic (the preview above, ${p.autoTitle.length} characters). Keep it under 60.` })}
      ${field({ label: 'Description', name: 'seo_description', type: 'textarea', rows: 2, value: court.seo_description || '', wide: true, help: 'Blank = automatic, and it updates with every run. Keep it under 160 characters.' })}`)}
  </div>`;

  // Court page features: one switch each, for every court page at once.
  const features = `<div class="aui-panel acrt-panel">
    ${toggleRow({ label: 'Player ratings', help: 'Stars, court scores and reviews from players who checked in to a run here. Written reviews wait for your OK. The score shows from 5 ratings.', name: 'papawis_court_ratings_enabled', on: !!flags.ratings, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Vote for a run', help: 'Open times you list below. Players tap I\'m in; at the target you get an email, post the run, and link it so voters are told.', name: 'papawis_court_votes_enabled', on: !!flags.votes, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Rent the court', help: 'A request form on the page. Requests email you, and the court too when it is a partner with an email set.', name: 'papawis_court_requests_enabled', on: !!flags.requests, post: '/admin/site/settings', setting: true })}
    ${toggleRow({ label: 'Partner page', help: 'The "Run this court?" link and the owner page at /courts/<court>/partner (admins can preview it while off).', name: 'papawis_court_partner_enabled', on: !!flags.partner, post: '/admin/site/settings', setting: true })}
  </div>`;

  // Open times + votes. A separate form from the page form (no nested forms).
  const runOpts = [['', 'Pick the run'], ...runs.map(g => [g.id, `${dayLabel(String(g.date).slice(0, 10))} · ${formatTimeRange(g.start_time, g.end_time)} · ${g.location}`])];
  const slotRows = slots.length ? `<div class="acrt-rows">${slots.map(x => {
    const state = x.run_id ? badge('Run linked', 'green') : x.votes >= x.threshold ? badge('Target reached', 'amber') : badge(`${x.votes} of ${x.threshold}`, 'gray');
    return `<div class="acrt-row">
      <div class="acrt-row__main"><b>${escHtml(dayLabel(x.date))} · ${escHtml(formatTimeRange(x.start_time, x.end_time))}</b><span class="aui-muted">${x.votes} vote${x.votes === 1 ? '' : 's'} · target ${x.threshold}</span></div>
      ${state}
      ${menu([{ label: 'Delete this time', post: `/admin/papawis/court-slots/${x.id}/delete`, danger: true, done: 'Open time deleted.', confirm: { title: 'Delete this open time?', body: 'Its votes go too.' } }])}
      <form class="acrt-row__form" id="slot-run-${attr(x.id)}" data-json-action="/admin/papawis/court-slots/${attr(x.id)}/run" data-done="Saved.">
        <select class="aui-input" name="run_id" aria-label="Papawis run for this time">${runOpts.map(([v, l]) => `<option value="${attr(v)}"${v === x.run_id ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select>
        ${button(x.run_id ? 'Update' : 'Link run', { kind: 'secondary', size: 'sm', type: 'submit' })}
      </form>
    </div>`;
  }).join('')}</div>` : `<p class="aui-muted acrt-foot" style="margin:0">No open times yet. Add the times the court has free; players vote for a run in them.</p>`;
  const slotsBlock = `<div class="aui-panel acrt-panel">
    <form id="slot-add" class="acrt-slotform" data-json-action="/admin/papawis/courts/${id}/slots" data-done="Open time added.">
      ${fieldGrid(`${field({ label: 'Date', name: 'slot_date', type: 'date', required: true })}${field({ label: 'Start', name: 'slot_start', type: 'time', value: '20:00', required: true })}${field({ label: 'End', name: 'slot_end', type: 'time', value: '22:00', required: true })}${field({ label: 'Votes needed', name: 'slot_threshold', type: 'number', value: '16', attrs: 'min="2" max="40"' })}`)}
      ${button('Add open time', { kind: 'primary', size: 'sm', type: 'submit' })}
    </form>
    ${slotRows}
  </div>`;

  // Ratings: pending reviews first.
  const order = { pending: 0, approved: 1, none: 2, rejected: 3 };
  const rated = [...ratings].sort((a, b) => (order[a.body_status] ?? 9) - (order[b.body_status] ?? 9) || b.created_at - a.created_at);
  const ratingRows = rated.length ? `<div class="acrt-rows">${rated.map(x => {
    const tags = parseJson(x.tags_json, []).map(t => TAG_LABEL[t]).filter(Boolean);
    const asp = Object.entries(parseJson(x.aspects_json, {})).map(([k, v]) => `${ASPECT_LABEL[k] || k} ${v}`);
    const st = x.hidden ? badge('Hidden', 'gray') : x.body_status === 'pending' ? badge('Review waiting', 'amber') : x.body_status === 'approved' ? badge('Review live', 'green') : x.body_status === 'rejected' ? badge('Review rejected', 'red') : badge('Stars only', 'gray');
    return `<div class="acrt-row acrt-row--rating">
      <div class="acrt-row__main"><b>${escHtml(displayPlayerName(x.player_name || ''))} · ${x.stars}★</b>
        <span class="aui-muted">${escHtml([ago(x.updated_at), asp.join(', '), tags.join(', ')].filter(Boolean).join(' · '))}</span>
        ${x.body ? `<p class="acrt-row__text">${escHtml(x.body)}</p>` : ''}
        <form class="acrt-row__form" id="reply-${attr(x.id)}" data-json-action="/admin/papawis/court-ratings/${attr(x.id)}" data-done="Reply saved.">
          <input class="aui-input" name="reply" value="${attr(x.owner_reply)}" placeholder="Reply as the court (optional)" aria-label="Reply as the court">
          ${button('Save reply', { kind: 'ghost', size: 'sm', type: 'submit' })}
        </form>
      </div>
      ${st}
      ${menu([
        x.body_status === 'pending' && { label: 'Approve review', post: `/admin/papawis/court-ratings/${x.id}`, body: { action: 'approve' }, done: 'Review is live.' },
        x.body_status === 'pending' && { label: 'Reject review', post: `/admin/papawis/court-ratings/${x.id}`, body: { action: 'reject' }, done: 'Review rejected. The stars still count.' },
        x.hidden ? { label: 'Show rating', post: `/admin/papawis/court-ratings/${x.id}`, body: { action: 'show' }, done: 'Rating shown.' }
          : { label: 'Hide rating', post: `/admin/papawis/court-ratings/${x.id}`, body: { action: 'hide' }, danger: true, done: 'Rating hidden.', confirm: { title: 'Hide this rating?', body: 'Its stars stop counting and the review comes off the page.' } },
      ])}
    </div>`;
  }).join('')}</div>` : `<p class="aui-muted acrt-foot" style="margin:0">No ratings yet. Players who checked in to a run here can rate the court once ratings are on.</p>`;

  const reqRows = requests.length ? `<div class="acrt-rows">${requests.map(x => `<div class="acrt-row">
      <div class="acrt-row__main"><b>${escHtml(x.name)} · ${escHtml(x.contact)}</b>
        <span class="aui-muted">${escHtml(`${dayLabel(x.date)}, ${formatTimeRange(x.start_time, '')}, ${x.hours}h, ${x.court_size === 'half' ? 'half court' : 'full court'} · sent ${ago(x.created_at)}`)}</span>
        ${x.note ? `<p class="acrt-row__text">${escHtml(x.note)}</p>` : ''}</div>
      ${x.status === 'done' ? badge('Handled', 'green') : badge('New', 'amber')}
      ${menu([{ label: x.status === 'done' ? 'Mark as new' : 'Mark as handled', post: `/admin/papawis/court-requests/${x.id}`, body: { status: x.status === 'done' ? 'new' : 'done' }, done: 'Saved.' }])}
    </div>`).join('')}</div>` : `<p class="aui-muted acrt-foot" style="margin:0">No requests yet.</p>`;

  const partnerUrl = `/courts/${encodeURIComponent(court.slug)}/partner`;
  const partner = `<div class="aui-panel acrt-panel">
    ${toggleRow({ label: 'Partner court', help: 'The court claimed its page: a "Partner court" mark on owner replies, and rent requests go to the email below too.', name: 'partner_on', on: !!court.partner })}
    ${fieldGrid(field({ label: 'Court email for rent requests', name: 'partner_email', type: 'email', value: court.partner_email || '', placeholder: 'bookings@court.com', wide: true, help: 'Optional. Only used for rent requests; never shown on the site.' }))}
    ${facts([['Partner page', `<a class="acrt-link" href="${attr(partnerUrl)}" target="_blank" rel="noopener">wkndbasketball.com${escHtml(partnerUrl)} ↗</a>`]])}
  </div>`;

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Papawis', href: '/admin/papawis' }, { label: 'Courts', href: '/admin/papawis/courts' }, { label: p.name }])}
    ${pageHeader({ eyebrow: p.city || 'Court', title: p.name, sub: court.address || '', actionsHtml: button('View on site ↗', { kind: 'secondary', href: pageUrl, attrs: 'target="_blank" rel="noopener"' }) })}
    <form id="court-page-form" class="acrt-form" data-json-action="/admin/papawis/courts/${id}/page" data-done="Court page saved." data-dirty-watch>
      ${section({ title: 'Public page', asideHtml: status, bodyHtml: page })}
      ${section({ title: 'Court info', note: '· ticked items show as tags on the page', bodyHtml: infoBlock })}
      ${section({ title: 'About this court', note: '· the writeup at the top of the page', bodyHtml: writeup })}
      ${section({ title: 'Gallery', note: `· ${p.photos.length} of ${p.allPhotos.length} shown`, bodyHtml: gallery })}
      ${section({ title: 'Search', note: '· how the page shows on Google', bodyHtml: seo })}
      ${section({ title: 'Partner', note: '· when the court has claimed its page', bodyHtml: partner })}
    </form>
    ${section({ title: 'Court page features', note: '· switches for every court page', bodyHtml: features })}
    ${section({ title: 'Open times', note: '· players vote for a run in these', id: 'court-slots', asideHtml: flags.votes ? '' : badge('Off', 'gray'), bodyHtml: slotsBlock })}
    ${section({ title: 'Ratings', note: `· ${ratings.length} rating${ratings.length === 1 ? '' : 's'}`, asideHtml: flags.ratings ? '' : badge('Off', 'gray'), bodyHtml: `<div class="aui-panel">${ratingRows}</div>` })}
    ${section({ title: 'Rent requests', note: `· ${requests.filter(x => x.status !== 'done').length} new`, asideHtml: flags.requests ? '' : badge('Off', 'gray'), bodyHtml: `<div class="aui-panel">${reqRows}</div>` })}
    ${saveBar({ label: 'Save court page', form: 'court-page-form' })}
    ${SUGGEST_SCRIPT}
  </div>`;
}
