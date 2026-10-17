// Admin → Overview → Analytics (/admin/analytics): guests and members on the public site.
// Daily counts only (page_views, entity_views, cta_clicks, cta_ref_clicks in lib/portal-db.js);
// no names, IPs or single visits. Data: buildAnalytics() in server.js.
import { escHtml } from '../layout.js';
import { pageHeader, section, kpi, button, pageTabs, dataGrid, emptyState } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const pct = (n, of) => (of ? `${((n / of) * 100).toFixed(1)}%` : '—');
const SOURCE_LABEL = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', direct: 'Direct (typed or app)', site: 'From another page on the site', other: 'Other websites' };

function bars(rows, total) {
  if (!total) return emptyState({ title: 'No visits yet', sub: 'Counts start from the day this page went live.' });
  return `<div class="ana-bars">${rows.map(r => `<div class="ana-bar">
      <div class="ana-bar__top"><span>${escHtml(r.label)}</span><b>${r.n} <small>${pct(r.n, total)}</small></b></div>
      <div class="ana-bar__track"><i style="width:${Math.max(2, Math.round((r.n / total) * 100))}%"></i></div>
    </div>`).join('')}</div>`;
}

function overviewTab(a) {
  const sourceRows = Object.entries(a.sources).filter(([, n]) => n).sort((x, y) => y[1] - x[1]).map(([k, n]) => ({ label: SOURCE_LABEL[k] || k, n }));
  const sourceTotal = sourceRows.reduce((t, r) => t + r.n, 0);
  const pathTotal = a.topPaths.reduce((t, r) => t + r.n, 0);
  return `<div class="aui-kpis">
      ${kpi({ label: 'Guest page views', value: String(a.guestViews) })}
      ${kpi({ label: 'Player pages (guests)', value: String(a.playerGuestViews), href: `/admin/analytics?tab=players&days=${a.days}` })}
      ${kpi({ label: 'Court pages (guests)', value: String(a.courtGuestViews), href: `/admin/analytics?tab=courts&days=${a.days}` })}
      ${kpi({ label: 'Join clicks', value: String(a.joinClicks), of: a.guestViews ? ` · ${pct(a.joinClicks, a.guestViews)}` : '' })}
    </div>
    ${section({ title: 'Where visitors come from', note: '· guests on player and court pages', bodyHtml: `<div class="aui-panel">${bars(sourceRows, sourceTotal)}</div>` })}
    ${section({ title: 'Most-viewed pages', note: '· guests', bodyHtml: `<div class="aui-panel">${bars(a.topPaths.map(r => ({ label: r.label, n: r.n })), pathTotal)}</div>` })}`;
}

function playersTab(a, query) {
  const rows = a.players;
  if (!rows.length) return `<div class="aui-panel">${emptyState({ title: 'No player page views yet', sub: 'Per-player counts started on 17 Oct 2026. Check back in a day or two.' })}</div>`;
  const t = rows.reduce((s, r) => ({ guest: s.guest + r.guest, google: s.google + r.google, social: s.social + r.social, member: s.member + r.member, join: s.join + r.join }), { guest: 0, google: 0, social: 0, member: 0, join: 0 });
  return `<div class="aui-kpis">
      ${kpi({ label: 'Guest views', value: String(t.guest) })}
      ${kpi({ label: 'From Google', value: String(t.google), of: ` · ${pct(t.google, t.guest)}` })}
      ${kpi({ label: 'From Facebook / IG / Messenger', value: String(t.social), of: ` · ${pct(t.social, t.guest)}` })}
      ${kpi({ label: 'Join card clicks', value: String(t.join), of: ` · ${pct(t.join, t.guest)}` })}
    </div>
    ${dataGrid({
      rows, query, baseUrl: '/admin/analytics', keep: { tab: 'players', days: a.days }, minimal: true, perPage: 25,
      noun: ['player page', 'player pages'], defaultSort: '-guest', rowKey: r => r.id,
      search: { placeholder: 'Find a player', text: r => r.name },
      columns: [
        { key: 'name', label: 'Player', primary: true, sort: r => r.name, cell: r => `<span class="aui-cell__stack"><a class="aui-cell__title" href="/players/${attr(encodeURIComponent(r.slug))}" target="_blank" rel="noopener">${escHtml(r.name)} ↗</a><span class="aui-cell__sub">${escHtml(r.team || '')}</span></span>` },
        { key: 'guest', label: 'Guest views', num: true, sort: r => r.guest, cell: r => String(r.guest) },
        { key: 'google', label: 'From Google', num: true, sort: r => r.google, cell: r => String(r.google) },
        { key: 'social', label: 'From social', num: true, sort: r => r.social, cell: r => String(r.social) },
        { key: 'member', label: 'Member views', num: true, sort: r => r.member, cell: r => String(r.member) },
        { key: 'join', label: 'Join clicks', num: true, sort: r => r.join, cell: r => String(r.join) },
        { key: 'rate', label: 'Join rate', num: true, sort: r => (r.guest ? r.join / r.guest : -1), cell: r => pct(r.join, r.guest) },
      ],
    })}
    <p class="aui-muted ana-foot">Guest views are people who aren’t logged in, usually someone who searched the player’s name. Member views are logged-in players. A player’s own visits aren’t counted. Join clicks: Join the next season or See Papawis runs on that player’s page.</p>`;
}

function courtsTab(a, query) {
  const rows = a.courts;
  if (!rows.length) return `<div class="aui-panel">${emptyState({ title: 'No court page views yet', sub: 'Per-court counts started on 17 Oct 2026.' })}</div>`;
  return `${dataGrid({
      rows, query, baseUrl: '/admin/analytics', keep: { tab: 'courts', days: a.days }, minimal: true, perPage: 25,
      noun: ['court page', 'court pages'], defaultSort: '-guest', rowKey: r => r.id,
      columns: [
        { key: 'name', label: 'Court', primary: true, sort: r => r.name, cell: r => `<span class="aui-cell__stack"><a class="aui-cell__title" href="/courts/${attr(encodeURIComponent(r.slug))}" target="_blank" rel="noopener">${escHtml(r.name)} ↗</a><span class="aui-cell__sub">${escHtml(r.city || '')}</span></span>` },
        { key: 'guest', label: 'Guest views', num: true, sort: r => r.guest, cell: r => String(r.guest) },
        { key: 'google', label: 'From Google', num: true, sort: r => r.google, cell: r => String(r.google) },
        { key: 'member', label: 'Member views', num: true, sort: r => r.member, cell: r => String(r.member) },
        { key: 'signup', label: 'Run sign-ups', num: true, sort: r => r.signup, cell: r => String(r.signup) },
        { key: 'directions', label: 'Directions', num: true, sort: r => r.directions, cell: r => String(r.directions) },
        { key: 'join', label: 'Join clicks', num: true, sort: r => r.join, cell: r => String(r.join) },
      ],
    })}
    <p class="aui-muted ana-foot">Run sign-ups count taps on Sign up / Join the waitlist anywhere on the court page (panel, sticky bar or phone dock).</p>`;
}

function clicksTab(a) {
  const groups = {};
  for (const r of a.clicks) {
    const [page, ...rest] = r.label.split(' · ');
    (groups[page] ??= []).push({ ...r, short: rest.join(' · ') || page });
  }
  const ordered = Object.entries(groups).map(([page, rows]) => ({ page, rows: rows.sort((x, y) => y.n - x.n), total: rows.reduce((t, r) => t + r.n, 0) })).sort((x, y) => y.total - x.total);
  return `<div class="ana-groups">${ordered.map(g => section({ title: g.page, note: `· ${g.total} click${g.total === 1 ? '' : 's'}`, bodyHtml: `<div class="aui-panel ana-list">${g.rows.map(r => `<div class="ana-list__row"><span>${escHtml(r.short)}</span><b>${r.n}</b></div>`).join('')}</div>` })).join('')}</div>`;
}

export function adminAnalyticsBody(a, { tab = 'overview', query = {} } = {}) {
  const ranges = [7, 30, 90].map(d => button(`${d} days`, { kind: d === a.days ? 'primary' : 'ghost', size: 'sm', href: `/admin/analytics?tab=${tab}&days=${d}` })).join('');
  const tabs = pageTabs([
    { label: 'Overview', href: `/admin/analytics?days=${a.days}`, active: tab === 'overview' },
    { label: 'Player pages', count: a.players.length || '', href: `/admin/analytics?tab=players&days=${a.days}`, active: tab === 'players' },
    { label: 'Court pages', count: a.courts.length || '', href: `/admin/analytics?tab=courts&days=${a.days}`, active: tab === 'courts' },
    { label: 'Clicks', href: `/admin/analytics?tab=clicks&days=${a.days}`, active: tab === 'clicks' },
  ]);
  const body = tab === 'players' ? playersTab(a, query) : tab === 'courts' ? courtsTab(a, query) : tab === 'clicks' ? clicksTab(a) : overviewTab(a);
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Overview', title: 'Analytics', sub: `Visitors on the public site, last ${a.days} days. Counts only: no names, no IPs, no single visits.`, actionsHtml: `<div class="ana-range">${ranges}</div>` })}
    ${tabs}
    ${body}
  </div>`;
}

// Admin home: the short version, with a way into the full page.
export function analyticsHomeSection(a) {
  if (!a) return '';
  const row = (label, value) => `<div class="ahome-clicks__row"><span>${escHtml(label)}</span><b>${value}</b></div>`;
  return section({ title: 'Site analytics', note: '· last 30 days', asideHtml: '<a class="aui-link" href="/admin/analytics">Open →</a>', bodyHtml: `<div class="ahome-clicks">
    ${row('Guest page views', a.guestViews)}
    ${row('Player pages (guests)', a.playerGuestViews)}
    ${row('Court pages (guests)', a.courtGuestViews)}
    ${row('Join clicks', a.joinClicks)}
  </div>` });
}
