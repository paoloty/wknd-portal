import { escHtml } from '../layout.js';

const IC = {
  dashboard: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="5" height="5" rx="1"/><rect x="8.5" y="1.5" width="5" height="5" rx="1"/><rect x="1.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="8.5" width="5" height="5" rx="1"/></svg>`,
  games:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="12" height="10" rx="1.5"/><path d="M5 3V1.5M10 3V1.5"/><path d="M1.5 7h12"/></svg>`,
  players:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="4.5" r="2.5"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13"/></svg>`,
  teams:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1.5L2 4v4.5c0 3 2.5 5.5 5.5 6 3-.5 5.5-3 5.5-6V4L7.5 1.5z"/></svg>`,
  standings: `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="2.5" height="5.5" rx=".5"/><rect x="6.25" y="4" width="2.5" height="8.5" rx=".5"/><rect x="10.5" y="8.5" width="2.5" height="4" rx=".5"/></svg>`,
  ledger:    `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="12" height="9" rx="1.5"/><path d="M1.5 7h12"/><path d="M5 10.5h2"/></svg>`,
  finance:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><path d="M7.5 4v1.5M7.5 9.5V11M5.5 6a2 2 0 0 1 4 0c0 1.5-2 2-2 3"/></svg>`,
  users:     `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="4.5" r="2"/><path d="M1 12c0-2.21 1.79-4 4-4"/><circle cx="10.5" cy="5" r="2.5"/><path d="M6 13c0-2.485 2.015-4.5 4.5-4.5S15 10.515 15 13"/></svg>`,
  site:      `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="6"/><circle cx="7.5" cy="7.5" r="2"/><path d="M7.5 1.5v4M7.5 9.5v4M1.5 7.5h4M9.5 7.5h4"/></svg>`,
  compare:   `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="7.5" r="2.5"/><circle cx="11" cy="7.5" r="2.5"/><path d="M6.5 7.5h2"/></svg>`,
  external:  `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"/><polyline points="9.5 1 13 1 13 4.5"/><line x1="7" y1="7" x2="13" y2="1"/></svg>`,
  signout:   `<svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/><path d="M10 10.5l3-3-3-3"/><line x1="13" y1="7.5" x2="6" y2="7.5"/></svg>`,
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
      { href: '/admin/finance', label: 'Overview', icon: 'finance' },
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
  const v = cssVer ? `?v=${cssVer}` : '';

  const navHtml = NAV_GROUPS.map(({ label, items }, gi) => {
    const itemsHtml = items.map(({ href, label: lbl, icon, exact, soon }) => {
      const active = exact ? currentPath === href : currentPath.startsWith(href);
      const base = 'flex items-center gap-2.5 mx-2 px-2.5 h-9 rounded-md text-[13px] font-medium transition-colors relative no-underline';
      const state = active
        ? 'bg-brand/10 text-brand'
        : soon
          ? 'text-slate-600 opacity-40 pointer-events-none'
          : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200';
      return `<a href="${href}" class="${base} ${state}"${soon ? ' tabindex="-1" aria-disabled="true"' : ''}>
        <span class="flex items-center shrink-0 ${active ? 'opacity-100' : 'opacity-60'}">${IC[icon] || ''}</span>
        <span>${escHtml(lbl)}</span>
        ${soon ? `<span class="ml-auto text-[9px] font-bold uppercase tracking-wide text-slate-500 bg-white/[.06] px-1.5 py-0.5 rounded">Soon</span>` : ''}
      </a>`;
    }).join('');
    return `<div class="py-1.5 ${gi > 0 ? 'border-t border-admin-border mt-1.5 pt-2.5' : ''}">
      <div class="px-[18px] pt-1.5 pb-1 text-[9.5px] font-bold tracking-[.12em] uppercase text-slate-500/70">${escHtml(label)}</div>
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand:            '#f59332',
            'admin-bg':       '#080d17',
            'admin-surface':  '#0f1623',
            'admin-surface2': '#172030',
            'admin-border':   '#1c2840',
            'admin-border2':  '#243350',
            success:          '#34d399',
            error:            '#f87171',
          },
          fontFamily: {
            sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            saira: ['"Space Grotesk"', 'sans-serif'],
          },
        },
      },
    };
  </script>
  <link rel="stylesheet" href="/styles.css${v}">
  <link rel="stylesheet" href="/admin.css${v}">
  ${gaSnippet}
</head>
<body class="admin-body bg-admin-bg text-slate-200 font-sans antialiased min-h-screen">

  <div class="hidden fixed inset-0 bg-black/65 z-40 backdrop-blur-[2px] [&.is-open]:block" id="admin-overlay"></div>

  <nav class="fixed top-0 left-0 bottom-0 w-60 bg-admin-surface border-r border-admin-border flex flex-col z-50 overflow-hidden -translate-x-full transition-transform duration-200 ease-out [&.is-open]:translate-x-0 md:translate-x-0 md:transition-none" id="admin-sidebar">
    <a href="/admin" class="flex items-center gap-2.5 px-4 h-14 border-b border-admin-border shrink-0 no-underline">
      <span class="w-[30px] h-[30px] bg-brand rounded-[7px] flex items-center justify-center text-sm font-extrabold text-admin-bg shrink-0">W</span>
      <span class="text-sm font-bold text-slate-100 leading-tight">WKND <em class="block not-italic text-[10px] font-medium text-slate-500 tracking-wide uppercase">Admin Console</em></span>
    </a>
    <div class="flex-1 overflow-y-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:w-0">${navHtml}</div>
    <div class="shrink-0 p-2 border-t border-admin-border flex flex-col gap-0.5">
      <a href="/" target="_blank" rel="noopener" class="flex items-center gap-2 px-2.5 h-8 rounded-md text-xs font-medium text-slate-500 hover:bg-white/[.04] hover:text-slate-400 transition-colors no-underline">
        ${IC.external} View Portal
      </a>
      <a href="/logout" class="flex items-center gap-2 px-2.5 h-8 rounded-md text-xs font-medium text-slate-500 hover:bg-error/10 hover:text-error transition-colors no-underline">
        ${IC.signout} Sign out
      </a>
    </div>
  </nav>

  <div class="md:ml-60">
    <header class="flex md:hidden border-b border-admin-border bg-admin-surface px-4 items-center justify-between sticky top-0 z-30" style="height:52px">
      <button class="w-9 h-9 bg-transparent border-0 cursor-pointer p-1 flex flex-col items-center justify-center gap-[5px]" id="admin-menu-btn" aria-label="Open navigation">
        <span class="block w-[18px] h-[1.5px] bg-slate-400 rounded-sm"></span>
        <span class="block w-[18px] h-[1.5px] bg-slate-400 rounded-sm"></span>
        <span class="block w-[18px] h-[1.5px] bg-slate-400 rounded-sm"></span>
      </button>
      <a href="/admin" class="text-sm font-bold text-slate-100 no-underline">WKND Admin</a>
      <a href="/logout" class="text-xs text-slate-500 hover:text-error no-underline">Sign out</a>
    </header>

    <main>
      <div class="p-4 pb-10 md:p-8 md:pb-14">
        ${body}
      </div>
    </main>
  </div>

  <script>
  (function() {
    var btn     = document.getElementById('admin-menu-btn');
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('admin-overlay');
    function open()  { sidebar.classList.add('is-open');  overlay.classList.add('is-open');  document.body.style.overflow = 'hidden'; }
    function close() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }
    if (btn) btn.addEventListener('click', function() { sidebar.classList.contains('is-open') ? close() : open(); });
    overlay.addEventListener('click', close);
  })();
  </script>

</body>
</html>`;
}
