// Admin: one court's public page (/courts/:slug). Papawis → Courts → a court. Name, address,
// rate and photo stay in the Courts list drawer; this page holds everything the public page
// adds: city, "Good to know" info, the About writeup, the gallery, visibility and search text.
import { escHtml } from '../layout.js';
import { pageHeader, section, button, badge, breadcrumb, field, fieldGrid, toggleRow, saveBar, banner, facts } from './ui.js';
import { COURT_TYPES, COURT_FLOORS, COURT_FEATURES, COURT_TEXT_FIELDS, COURT_CITIES } from '../../lib/court-page.js';

const attr = s => escHtml(String(s ?? ''));

export function adminPapawisCourtBody({ court, p, info = {}, aiOn = true }) {
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

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Papawis', href: '/admin/papawis' }, { label: 'Courts', href: '/admin/papawis/courts' }, { label: p.name }])}
    ${pageHeader({ eyebrow: p.city || 'Court', title: p.name, sub: court.address || '', actionsHtml: button('View on site ↗', { kind: 'secondary', href: pageUrl, attrs: 'target="_blank" rel="noopener"' }) })}
    <form id="court-page-form" class="acrt-form" data-json-action="/admin/papawis/courts/${id}/page" data-done="Court page saved." data-dirty-watch>
      ${section({ title: 'Public page', asideHtml: status, bodyHtml: page })}
      ${section({ title: 'Court info', note: '· ticked items show as tags on the page', bodyHtml: infoBlock })}
      ${section({ title: 'About this court', note: '· the writeup at the top of the page', bodyHtml: writeup })}
      ${section({ title: 'Gallery', note: `· ${p.photos.length} of ${p.allPhotos.length} shown`, bodyHtml: gallery })}
      ${section({ title: 'Search', note: '· how the page shows on Google', bodyHtml: seo })}
    </form>
    ${saveBar({ label: 'Save court page', form: 'court-page-form' })}
  </div>`;
}
