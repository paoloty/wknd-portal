import { escHtml } from '../layout.js';

const IC = {
  dashboard: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="8.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/></svg>`,
  games:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="12" height="10" rx="1.5"/><path d="M5 3V1.5M10 3V1.5"/><path d="M1.5 7h12"/></svg>`,
  players:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="4.5" r="2.5"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13"/></svg>`,
  teams:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1.5L2 4v4.5c0 3 2.5 5.5 5.5 6 3-.5 5.5-3 5.5-6V4L7.5 1.5z"/></svg>`,
  standings: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="2.5" height="5.5" rx=".5"/><rect x="6.25" y="4" width="2.5" height="8.5" rx=".5"/><rect x="10.5" y="8.5" width="2.5" height="4" rx=".5"/></svg>`,
  ledger:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="12" height="9" rx="1.5"/><path d="M1.5 7h12"/><path d="M5 10.5h2"/></svg>`,
  users:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4"/><circle cx="10.5" cy="5" r="2.5"/><path d="M6 13c0-2.485 2.015-4.5 4.5-4.5S15 10.515 15 13"/></svg>`,
  site:      `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><circle cx="7.5" cy="7.5" r="2"/><path d="M7.5 1.5v4M7.5 9.5v4M1.5 7.5h4M9.5 7.5h4"/></svg>`,
  compare:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="7.5" r="2.5"/><circle cx="11" cy="7.5" r="2.5"/><path d="M6.5 7.5h2"/></svg>`,
};

const NAV_GROUPS = [
  {
    label: 'Content',
    items: [
      { href: '/admin',           label: 'Dashboard', icon: 'dashboard', exact: true },
      { href: '/admin/games',     label: 'Games',     icon: 'games' },
      { href: '/admin/players',   label: 'Players',   icon: 'players' },
      { href: '/admin/teams',     label: 'Teams',     icon: 'teams',     soon: true },
      { href: '/admin/standings', label: 'Standings', icon: 'standings', soon: true },
      { href: '/admin/compare',   label: 'Compares',  icon: 'compare' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/finance', label: 'Overview', icon: 'standings' },
      { href: '/admin/ledger',  label: 'Ledger',   icon: 'ledger' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/admin/users', label: 'Users', icon: 'users', soon: true },
      { href: '/admin/site',  label: 'Site',  icon: 'site' },
    ],
  },
];

export function adminLayout({ title, currentPath = '/admin', body, cssVer = '', gaSnippet = '' }) {
  const navHtml = NAV_GROUPS.map(({ label, items }) => {
    const itemsHtml = items.map(({ href, label: lbl, icon, exact, soon }) => {
      const active = exact ? currentPath === href : currentPath.startsWith(href);
      const cls = ['admin-sb__item', active && 'is-active', soon && 'admin-sb__item--soon'].filter(Boolean).join(' ');
      return `<a href="${href}" class="${cls}"${soon ? ' tabindex="-1" aria-disabled="true"' : ''}>
        ${IC[icon]}
        <span>${escHtml(lbl)}</span>
        ${soon ? '<span class="admin-sb__soon">Soon</span>' : ''}
      </a>`;
    }).join('');
    return `<div class="admin-sb__group">
      <div class="admin-sb__label">${escHtml(label)}</div>
      ${itemsHtml}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} — WKND Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Saira+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css${cssVer ? `?v=${cssVer}` : ''}">
  ${gaSnippet}
</head>
<body class="admin-body">
  <div class="admin-shell">
    <header class="admin-topbar">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="admin-topbar__hamburger" id="admin-menu-btn" aria-label="Open menu">
          <span></span><span></span><span></span>
        </button>
        <a href="/admin" class="admin-topbar__brand">
          <span class="admin-topbar__badge">W</span>
          <span class="admin-topbar__name">WKND</span>
          <span class="admin-topbar__sep">|</span>
          <span class="admin-topbar__sub">Admin</span>
        </a>
      </div>
      <a href="/logout" class="admin-topbar__logout">Sign out</a>
    </header>
    <div class="admin-layout">
      <div class="admin-overlay" id="admin-overlay"></div>
      <nav class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sb__nav">${navHtml}</div>
        <div class="admin-sb__footer">
          <a href="/" target="_blank" class="admin-sb__portal">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"/><polyline points="9.5 1 13 1 13 4.5"/><line x1="7" y1="7" x2="13" y2="1"/></svg>
            View Portal
          </a>
        </div>
      </nav>
      <main class="admin-content">
        ${body}
      </main>
    </div>
    <script>
    (function() {
      var btn      = document.getElementById('admin-menu-btn');
      var sidebar  = document.getElementById('admin-sidebar');
      var overlay  = document.getElementById('admin-overlay');
      function open()  { sidebar.classList.add('is-open');  overlay.classList.add('is-open');  document.body.style.overflow = 'hidden'; }
      function close() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }
      btn.addEventListener('click', function() { sidebar.classList.contains('is-open') ? close() : open(); });
      overlay.addEventListener('click', close);
    })();
    </script>
  </div>
</body>
</html>`;
}
