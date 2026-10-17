import { escHtml, wkndBall } from '../layout.js';

const IC = {
  bell:      `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5V7a4 4 0 0 1 8 0v3.5l1 1.5h-10l1-1.5z"/><path d="M6 13.5a1.6 1.6 0 0 0 3 0"/></svg>`,
  dashboard: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="8.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/></svg>`,
  picks:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><circle cx="7.5" cy="7.5" r="2.5"/><path d="M7.5 1.5v2M7.5 11.5v2M1.5 7.5h2M11.5 7.5h2"/></svg>`,
  games:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="12" height="10" rx="1.5"/><path d="M5 3V1.5M10 3V1.5"/><path d="M1.5 7h12"/></svg>`,
  players:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="4.5" r="2.5"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13"/></svg>`,
  teams:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1.5L2 4v4.5c0 3 2.5 5.5 5.5 6 3-.5 5.5-3 5.5-6V4L7.5 1.5z"/></svg>`,
  standings: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="2.5" height="5.5" rx=".5"/><rect x="6.25" y="4" width="2.5" height="8.5" rx=".5"/><rect x="10.5" y="8.5" width="2.5" height="4" rx=".5"/></svg>`,
  ledger:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="12" height="9" rx="1.5"/><path d="M1.5 7h12"/><path d="M5 10.5h2"/></svg>`,
  finance:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4v1.5M7.5 9.5V11M5.5 6a2 2 0 0 1 4 0c0 1.5-2 2-2 3"/></svg>`,
  users:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4"/><circle cx="10.5" cy="5" r="2.5"/><path d="M6 13c0-2.485 2.015-4.5 4.5-4.5S15 10.515 15 13"/></svg>`,
  site:      `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><circle cx="7.5" cy="7.5" r="2"/><path d="M7.5 1.5v4M7.5 9.5v4M1.5 7.5h4M9.5 7.5h4"/></svg>`,
  podium:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 6h4v7.5h-4zM1.5 9h4v4.5h-4zM9.5 10.5h4v3h-4z"/><path d="M7.5 1.5l.6 1.2 1.3.2-.95.9.2 1.3-1.15-.6-1.15.6.2-1.3-.95-.9 1.3-.2z"/></svg>`,
  awards:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1l1.545 3.09L13 4.854l-2.75 2.687.65 3.793L7.5 9.59l-3.4 1.744.65-3.793L2 4.854l3.955-.764z"/></svg>`,
  compare:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="7.5" r="2.5"/><circle cx="11" cy="7.5" r="2.5"/><path d="M6.5 7.5h2"/></svg>`,
  coach:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4v4l2.5 1.5"/></svg>`,
  papawis:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M1.5 7.5h12"/><path d="M7.5 1.5v12"/><path d="M3.05 3.05c2.4 2.4 2.4 6.4 0 8.9"/><path d="M11.95 3.05c-2.4 2.4-2.4 6.4 0 8.9"/></svg>`,
  activity:  `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7.5H4L5.5 3L7 12L8.5 7.5H14"/></svg>`,
  posts:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="12" height="11" rx="1.2"/><rect x="3" y="3.5" width="4" height="3.2" rx="0.5"/><path d="M8.5 4h3.3M8.5 6h3.3"/><path d="M3 8.7h9M3 10.5h9M3 12.2h5.5"/></svg>`,
  visibility: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7.5C2.5 4 5 2.5 7.5 2.5S12.5 4 14 7.5C12.5 11 10 12.5 7.5 12.5S2.5 11 1 7.5Z"/><circle cx="7.5" cy="7.5" r="2"/></svg>`,
  pen:        `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 1.8l2.7 2.7-8 8L2 13l.5-3.2 8-8z"/><path d="M9 3.3l2.7 2.7"/></svg>`,
  seo:        `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="5"/><path d="M10.2 10.2L14 14"/></svg>`,
  wallet:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="4" width="12" height="9" rx="1.5"/><path d="M1.5 6.5h12"/><circle cx="10.5" cy="9.75" r=".9" fill="currentColor" stroke="none"/></svg>`,
  shield:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1.5l5 1.8v3.6c0 3.6-2 6-5 6.9-3-.9-5-3.3-5-6.9V3.3l5-1.8z"/></svg>`,
  external:  `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"/><polyline points="9.5 1 13 1 13 4.5"/><line x1="7" y1="7" x2="13" y2="1"/></svg>`,
  signout:   `<svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/><path d="M10 10.5l3-3-3-3"/><line x1="13" y1="7.5" x2="6" y2="7.5"/></svg>`,
  chevron:   `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5L5 6l2.5-2.5"/></svg>`,
  share:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.5" cy="3" r="1.8"/><circle cx="3.5" cy="7.5" r="1.8"/><circle cx="11.5" cy="12" r="1.8"/><path d="M5.1 6.5l4.7-2.6M5.1 8.5l4.7 2.6"/></svg>`,
};

// The admin menu, grouped by task. `key` is the permission key stored in
// registrations.admin_sections: it is fixed on purpose, so renaming a group's label can never
// silently change who can open it. `hidden` items aren't shown in the menu but still belong
// to their group, so the admin tools that live on public pages (↺ regenerate, photo pickers,
// signup detail actions) are gated with the section they belong to.
const NAV_GROUPS = [
  {
    key: 'overview', label: 'Overview',
    items: [
      { href: '/admin', label: 'Home', icon: 'dashboard', exact: true },
      { href: '/admin/analytics', label: 'Analytics', icon: 'standings' },
    ],
  },
  {
    key: 'reach', label: 'Reach',
    items: [
      { href: '/admin/reach',      label: 'Message players', icon: 'bell', exact: true },
      { href: '/admin/reach/sent', label: 'Sent log',        icon: 'activity' },
    ],
  },
  {
    key: 'games-stats', label: 'Game Day',
    items: [
      { href: '/admin/games',   label: 'Games',           icon: 'games' },
      { href: '/admin/picks',   label: 'Who wins? picks', icon: 'picks' },
      { href: '/admin/players', label: 'Players',         icon: 'players' },
      { href: '/admin/player', hidden: true },
      { href: '/admin/player-photo-original', hidden: true },
    ],
  },
  {
    key: 'papawis', label: 'Papawis',
    items: [
      { href: '/admin/papawis',          label: 'Runs',     icon: 'papawis', exact: true },
      { href: '/admin/papawis/courts',   label: 'Courts',   icon: 'site' },
      { href: '/admin/papawis/activity', label: 'Activity', icon: 'activity' },
      { href: '/admin/papawis-summary', hidden: true },
    ],
  },
  {
    key: 'awards', label: 'Awards',
    items: [
      { href: '/admin/awards',        label: 'Overview',      icon: 'dashboard', exact: true },
      { href: '/admin/awards/season', label: 'Season awards', icon: 'awards' },
      { href: '/admin/awards/races',  label: 'MVP & Best Defender', icon: 'standings' },
      { href: '/admin/awards/podium', label: 'MVP podium ballot', icon: 'podium' },
      { href: '/admin/mvp', hidden: true },
      { href: '/admin/dpoy', hidden: true },
      { href: '/admin/mvp-podium', hidden: true },
      { href: '/admin/award-photo', hidden: true },
    ],
  },
  {
    key: 'season', label: 'Season',
    items: [
      { href: '/admin/seasons',         label: 'All seasons',        icon: 'standings', exact: true },
      { href: '/admin/season',          label: 'Signups & settings', icon: 'site',      exact: true },
      { href: '/admin/season/waitlist', label: 'Waitlist',           icon: 'users' },
      { href: '/admin/season/returning', label: 'Returning',         icon: 'players' },
      { href: '/admin/season/comments', label: 'Comments',           icon: 'posts' },
      { href: '/admin/season/assessment-reviews', label: 'Assessment reviews', icon: 'coach' },
      { href: '/admin/season/teams',    label: 'Team builder',       icon: 'teams', exact: true },
      { href: '/admin/season/teams/sandbox', label: 'Sandbox',       icon: 'compare' },
      { href: '/admin/season-signups', hidden: true },
    ],
  },
  {
    key: 'content', label: 'Content',
    items: [
      { href: '/admin/posts',       label: 'Posts',         icon: 'posts' },
      { href: '/admin/coach-notes', label: 'Coach notes',   icon: 'coach' },
      { href: '/admin/compare',     label: 'Compares',      icon: 'compare' },
      { href: '/admin/seo',         label: 'SEO overrides', icon: 'seo' },
      { href: '/admin/ai-writing',  label: 'AI writing',    icon: 'pen' },
      { href: '/admin/home-summary', hidden: true },
      { href: '/admin/section-summary', hidden: true },
      { href: '/admin/teams-summary', hidden: true },
      { href: '/admin/leaders', hidden: true },
    ],
  },
  {
    key: 'community', label: 'Community',
    items: [
      { href: '/admin/polls',            label: 'Polls',           icon: 'standings', exact: true },
      { href: '/admin/fines',            label: 'Fines & conduct', icon: 'shield',    exact: true },
      { href: '/admin/fines/categories', label: 'Fine categories', icon: 'ledger' },
    ],
  },
  {
    key: 'marketplace', label: 'Marketplace',
    items: [
      { href: '/admin/marketplace',     label: 'Listings',      icon: 'wallet', exact: true },
      { href: '/admin/marketplace/new', label: 'New group buy', icon: 'games' },
    ],
  },
  {
    key: 'finance', label: 'Finance',
    items: [
      { href: '/admin/finance',        label: 'Summary', icon: 'finance', exact: true },
      { href: '/admin/ledger',         label: 'Ledger',  icon: 'ledger' },
      { href: '/admin/finance/gcash',  label: 'GCash',   icon: 'wallet' },
    ],
  },
  {
    key: 'members', label: 'Members',
    items: [
      { href: '/admin/users',       label: 'Users',      icon: 'users' },
      { href: '/admin/team-heads', label: 'Team heads', icon: 'shield' },
    ],
  },
  {
    key: 'site', label: 'Site',
    items: [
      { href: '/admin/site', label: 'Site & homepage', icon: 'visibility', exact: true },
      { href: '/admin/visibility', hidden: true },
    ],
  },
];

// Section keys from before the 2026-10 reorganisation, still stored on some registrations:
// what each one grants now. A Season or Game Day admin also gets Awards (season awards and
// the MVP podium used to live in those groups); Fines and Polls became Community; Visibility
// became Site.
const LEGACY_SECTION_KEYS = {
  season: ['season', 'awards'],
  'games-stats': ['games-stats', 'awards'],
  fines: ['community'],
  polls: ['community'],
  visibility: ['site'],
};
export function expandAdminSections(keys) {
  if (!keys) return keys;
  return [...new Set(keys.flatMap(k => LEGACY_SECTION_KEYS[k] || [k]))];
}

// Derived from NAV_GROUPS itself (not a separately-maintained list) so the sections an admin
// can be restricted to and the nav they actually see can never drift apart. SUPER_ADMIN_NAV
// is deliberately excluded — those routes stay gated by requireSuperAdmin regardless of any
// section list, since an elevated player-admin (the only kind this restricts) can never be
// the true super admin anyway and would never reach them.
export const ADMIN_SECTIONS = NAV_GROUPS.map(g => ({
  key: g.key,
  label: g.label,
  prefixes: g.items.map(i => i.href),
}));

// The section a given request path falls under, or null if it doesn't belong to any of
// them (shared/cross-cutting routes like /admin/site/settings, /admin/impersonate/:id —
// left ungated by section restrictions on purpose, see requireAuth in server.js).
//
// Longest-matching-prefix wins, not first-in-NAV_GROUPS-order — Overview's href is the bare
// "/admin", which is technically a prefix of every other admin path too. Picking the first
// array match would make every nested route (e.g. /admin/marketplace/:id/trigger-charge)
// resolve to "overview" instead of its real section, silently defeating admin_sections for
// anyone restricted away from Overview trying to reach any nested page in their own section.
export function sectionForPath(path) {
  let best = null;
  let bestLen = -1;
  for (const s of ADMIN_SECTIONS) {
    for (const href of s.prefixes) {
      if (path === href || path.startsWith(href + '/')) {
        if (href.length > bestLen) { best = s; bestLen = href.length; }
      }
    }
  }
  return best;
}

// Where to send a restricted admin who hit a page outside their allowed sections — the
// first (in canonical NAV_GROUPS order, not whatever order they happen to be stored in)
// section they're actually allowed into. '/admin' as an absolute last resort only, for a
// pathologically broken/stale section list that matches nothing real.
export function firstAllowedAdminUrl(allowedSections) {
  if (!allowedSections || !allowedSections.length) return '/admin';
  const section = ADMIN_SECTIONS.find(s => allowedSections.includes(s.key));
  return section?.prefixes[0] || '/admin';
}

const SUPER_ADMIN_NAV = [
  {
    label: 'Super Admin',
    items: [
      { href: '/admin/privileges', label: 'Privileges', icon: 'shield' },
      { href: '/admin/logs', label: 'Action Logs', icon: 'ledger' },
      { href: '/admin/share-log', label: 'Share Card Log', icon: 'share' },
      { href: '/admin/birthdays', label: 'Birthdays', icon: 'users' },
      { href: '/admin/ratings', label: 'Community Ratings', icon: 'awards' },
      ...(process.env.NODE_ENV !== 'production' ? [{ href: '/admin/db', label: 'Sync DB', icon: 'finance' }] : []),
    ],
  },
];

// The sidebar icon for each group (the group row is what you see; items sit under it).
const GROUP_ICON = {
  overview: 'dashboard', reach: 'bell', 'games-stats': 'games', papawis: 'papawis', awards: 'awards', season: 'standings',
  content: 'posts', community: 'activity', marketplace: 'wallet', finance: 'finance', members: 'users', site: 'site',
  super: 'shield',
};

// The admin shell (admin redesign, 2026-10-15; mockup: canvas "A · Clubhouse v2"). Rebuilt
// from scratch with its own .ashell-* styles (public/admin.css, "Admin shell"), not Tailwind:
//   sidebar  = brand, season pill, one row per menu group (icon, label, count, chevron; its
//              pages fold out underneath, one group open at a time), who's signed in
//   top bar  = where you are (group / page), View site; on a phone also the menu button
//   content  = the page body
// The Tailwind CDN still loads for pages not rebuilt yet; drop it once none use it.
export function adminLayout({ title, currentPath = '/admin', body, cssVer = '', gaSnippet = '', isSuperAdmin = true, allowedSections = null, navBadges = {}, season = '', me = null }) {
  const v = cssVer ? `?v=${cssVer}` : '';

  // allowedSections null = unrestricted (the true super admin always). Otherwise only the
  // groups in the list show; requireAuth in server.js is what actually blocks the rest.
  const baseNavGroups = allowedSections ? NAV_GROUPS.filter(g => allowedSections.includes(g.key)) : NAV_GROUPS;
  const allNavGroups = isSuperAdmin ? [...baseNavGroups, ...SUPER_ADMIN_NAV] : baseNavGroups;

  const isActive = ({ href, exact }) => (exact ? currentPath === href : currentPath === href || currentPath.startsWith(href + '/'));
  let crumbGroup = '';
  const navHtml = allNavGroups.map(({ key = 'super', label, items: allItems }) => {
    const items = allItems.filter(i => !i.hidden);
    if (!items.length) return '';
    const groupActive = items.some(isActive) || allItems.some(i => i.hidden && isActive(i));
    if (groupActive && key !== 'overview') crumbGroup = label;
    const n = Number(navBadges[key]) || 0;
    const badge = n ? `<span class="admin-nav__badge">${n}</span>` : '';
    const icon = `<span class="admin-nav__icon" aria-hidden="true">${IC[GROUP_ICON[key]] || IC.dashboard}</span>`;
    if (items.length === 1) {
      const [it] = items;
      const on = isActive(it);
      return `<a href="${it.href}" class="admin-nav__row${on ? ' is-active' : ''}"${on ? ' aria-current="page"' : ''}>
        <span class="admin-nav__label">${icon}<span>${escHtml(key === 'overview' ? it.label : label)}</span></span>${badge}
      </a>`;
    }
    const itemsHtml = items.map(it => {
      const on = isActive(it);
      return `<a href="${it.href}" class="admin-nav__item${on ? ' is-active' : ''}"${on ? ' aria-current="page"' : ''}>${escHtml(it.label)}</a>`;
    }).join('');
    return `<div class="admin-nav__group">
      <button type="button" class="admin-nav__row nav-group-toggle${groupActive ? ' is-current' : ''}" aria-expanded="${groupActive}">
        <span class="admin-nav__label">${icon}<span>${escHtml(label)}</span></span>
        <span class="admin-nav__end">${badge}<span class="admin-nav__chev" aria-hidden="true">${IC.chevron}</span></span>
      </button>
      <div class="admin-nav__items"${groupActive ? '' : ' hidden'}>${itemsHtml}</div>
    </div>`;
  }).join('');

  const who = me || { name: isSuperAdmin ? 'Super admin' : 'Admin', role: isSuperAdmin ? 'Full access' : 'Admin' };
  const initials = String(who.name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'A';
  const crumb = crumbGroup
    ? `<span class="ashell__crumb-group">${escHtml(crumbGroup)}</span><span class="ashell__crumb-sep" aria-hidden="true">/</span><span class="ashell__crumb-page">${escHtml(title)}</span>`
    : `<span class="ashell__crumb-page">${escHtml(title)}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} — WKND Admin</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon-32.png" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <!-- The site's own self-hosted fonts (Archivo + Saira Condensed). -->
  <link rel="preload" href="/fonts/archivo-k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/fonts/fonts.css${v}">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          // The site's palette (public/styles.css :root), for pages not rebuilt yet. Hex, not
          // rgba, so /50-style opacity modifiers keep working.
          colors: {
            brand:            '#f59332',
            'admin-bg':       '#0a0e16',
            'admin-surface':  '#10141d',
            'admin-surface2': '#161c29',
            'admin-border':   '#1c2230',
            'admin-border2':  '#2a3142',
            success:          '#34d399',
            error:            '#f87171',
          },
          fontFamily: {
            sans:  ['Archivo', 'system-ui', '-apple-system', 'sans-serif'],
            saira: ['"Saira Condensed"', 'sans-serif'],
          },
        },
      },
    };
  </script>
  <link rel="stylesheet" href="/styles.css${v}">
  <link rel="stylesheet" href="/admin.css${v}">
  ${gaSnippet}
</head>
<body class="admin-body ashell">
  <a class="ashell__skip" href="#admin-main">Skip to content</a>
  <div class="ashell__overlay" data-shell-close hidden></div>

  <aside class="ashell__side" id="ashell-side" aria-label="Admin menu">
    <div class="ashell__brand-row">
      <a href="/admin" class="ashell__brand" aria-label="WKND Admin home">
        ${wkndBall('ashell__ball')}
        <span class="ashell__brand-text"><span class="ashell__wordmark">WKND</span><span class="ashell__brand-sub">Admin</span></span>
      </a>
      <button type="button" class="ashell__icon-btn ashell__close" data-shell-close aria-label="Close menu">×</button>
    </div>
    ${season ? `<a class="ashell__season" href="/admin/season" title="Season settings"><span class="ashell__season-dot" aria-hidden="true"></span><span>${escHtml(season)}</span><span class="ashell__season-chev" aria-hidden="true">${IC.chevron}</span></a>` : ''}
    <nav class="admin-nav" aria-label="Admin sections">${navHtml}</nav>
    <div class="ashell__me">
      <span class="ashell__me-avatar" aria-hidden="true">${escHtml(initials)}</span>
      <span class="ashell__me-text"><span class="ashell__me-name">${escHtml(who.name)}</span><span class="ashell__me-role">${escHtml(who.role)}</span></span>
      <a class="ashell__icon-btn" href="/logout" aria-label="Sign out" title="Sign out">${IC.signout}</a>
    </div>
  </aside>

  <div class="ashell__main">
    <header class="ashell__top">
      <button type="button" class="ashell__icon-btn ashell__menu-btn" data-shell-open aria-label="Open menu" aria-controls="ashell-side" aria-expanded="false"><span></span><span></span><span></span></button>
      <a href="/admin" class="ashell__top-brand" aria-label="WKND Admin home"><span class="ashell__wordmark">WKND</span><span class="ashell__brand-sub">Admin</span></a>
      <div class="ashell__crumb">${crumb}</div>
      <div class="ashell__top-actions">
        <a class="aui-btn aui-btn--ghost aui-btn--sm" href="/" target="_blank" rel="noopener">View site <span aria-hidden="true">↗</span></a>
      </div>
    </header>
    <main class="ashell__content" id="admin-main">${body}</main>
  </div>

  <script>
  (function() {
    var side = document.getElementById('ashell-side');
    var overlay = document.querySelector('.ashell__overlay');
    var openBtn = document.querySelector('[data-shell-open]');
    function open()  { side.classList.add('is-open'); overlay.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
    function close() { side.classList.remove('is-open'); overlay.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
    openBtn.addEventListener('click', open);
    document.querySelectorAll('[data-shell-close]').forEach(function(b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && side.classList.contains('is-open')) close(); });

    // One group open at a time.
    var toggles = document.querySelectorAll('.nav-group-toggle');
    toggles.forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        var willOpen = toggle.getAttribute('aria-expanded') !== 'true';
        toggles.forEach(function(t) {
          var isOpen = t === toggle && willOpen;
          t.setAttribute('aria-expanded', String(isOpen));
          t.nextElementSibling.hidden = !isOpen;
        });
      });
    });
  })();
  </script>
  <script src="/admin-ui.js${v}" defer></script>
</body>
</html>`;
}
