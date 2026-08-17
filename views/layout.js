function fmtNotifTime(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function layout({ title = 'WKND Basketball League', currentPath = '/', body, ticker = '', gaSnippet = '', metaTags = '', cssVer = '', isAdmin = false, isPlayer = false, isOwnProfile = false, isHead = false, features = {}, minimalHeader = false, origin = '', notifications = [], unreadNotificationCount = 0 }) {
  // Viewing your own profile (reached via /me, which redirects to /players/:slug) should
  // light up "My Profile", not the Stats dropdown, even though the URL shape overlaps
  // with "browsing another player via Stats > Players". The route resolves this directly
  // (comparing the viewed player's real id against the session), not via URL matching —
  // the player route passes a fixed currentPath: '/players' for other reasons, so
  // comparing currentPath against a computed "own profile URL" can never actually match.
  const onOwnProfile = isPlayer && isOwnProfile;
  const navLinks = [
    { href: '/',          label: 'Home' },
    { href: '/games',     label: 'Games' },
    { href: '/standings', label: 'Standings' },
    { href: '/playoffs',  label: 'Playoffs' },
    { href: '/teams',     label: 'Teams' },
    { href: '/players',   label: 'Players' },
    { href: '/leaders',   label: 'Leaders' },
    { href: '/roast',     label: 'The Roast' },
  ];

  const isActive = (href) => {
    // Own profile lands on /players/:slug too, but that shouldn't light up "Players" /
    // the Stats dropdown — My Profile covers that case separately below.
    if (onOwnProfile && href === '/players') return false;
    return href === '/' ? currentPath === '/' : currentPath.startsWith(href);
  };

  // forceActive + a per-item `active` override exist for My Account below — /me redirects
  // to /players/:slug, so plain isActive(href) can't detect "viewing your own profile" the
  // way it can for every other dropdown here (see onOwnProfile above). Both are optional
  // and unused by the other three dropdowns, which keep relying on isActive(href) as before.
  const dropdown = (label, items, activeHrefs, forceActive = false) => {
    const active = forceActive || activeHrefs.some(h => isActive(h));
    const chevron = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 3.5l3 3 3-3"/></svg>`;
    const itemHtml = items.map(({ href, label: lbl, active: itemActive }) =>
      `<a href="${href}" class="site-nav__dropdown-item${(itemActive ?? isActive(href)) ? ' is-active' : ''}">${lbl}</a>`
    ).join('');
    return `<div class="site-nav__dropdown${active ? ' is-active' : ''}">
      <button class="site-nav__dropdown-trigger"${active ? ' aria-current="page"' : ''}>${label} ${chevron}</button>
      <div class="site-nav__dropdown-menu">${itemHtml}</div>
    </div>`;
  };

  const gamesDropdown = dropdown('Games', [
    { href: '/games',     label: 'All Games' },
    { href: '/standings', label: 'Standings' },
    { href: '/playoffs',  label: 'Playoffs' },
  ], ['/games', '/standings', '/playoffs']);

  const statsDropdown = dropdown('Stats', [
    { href: '/teams',   label: 'Teams' },
    { href: '/players', label: 'Players' },
    { href: '/leaders', label: 'Leaders' },
    { href: '/roast',   label: 'The Roast' },
  ], ['/teams', '/players', '/leaders', '/roast']);

  const awardsDropdown = (() => {
    const showAwards = features.awards  !== false;
    const showMvp    = features.mvpRace !== false;
    if (!showAwards && !showMvp) return '';
    const items = [
      showAwards ? { href: '/awards', label: 'Season Awards' } : null,
      showMvp    ? { href: '/mvp',    label: 'MVP Race' }      : null,
    ].filter(Boolean);
    return dropdown('Awards', items, ['/awards', '/mvp']);
  })();

  const nav = [
    `<a href="/"${isActive('/') ? ' aria-current="page"' : ''}>Home</a>`,
    features.papawis ? `<a href="/papawis"${isActive('/papawis') ? ' aria-current="page"' : ''}>Papawis</a>` : '',
    features.posts ? `<a href="/posts"${isActive('/posts') ? ' aria-current="page"' : ''}>Posts</a>` : '',
    gamesDropdown,
    statsDropdown,
    awardsDropdown,
  ].join('');

  // Bell + dropdown panel — reuses the same trigger/panel/click-outside mechanics as the
  // Games/Stats dropdowns above (see .site-nav__dropdown handling in navToggleScript),
  // just under its own class so it can carry an unread badge and mark-as-read behavior
  // the plain nav dropdowns don't need.
  // Uses class-based JS targeting throughout, not ids — this markup can render twice on
  // minimalHeader pages (desktop nav + mobile overlay nav), same reason the hamburger
  // buttons above use .site-nav__hamburger instead of an id.
  const notificationBell = isPlayer ? `<div class="site-nav__notif">
    <button class="site-nav__notif-trigger" type="button" aria-label="Notifications" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6.5a5 5 0 0 0-10 0c0 4.5-1.5 5.5-1.5 5.5h13S14 11 14 6.5z"/><path d="M7.5 15a1.5 1.5 0 0 0 3 0"/></svg>
      ${unreadNotificationCount > 0 ? `<span class="site-nav__notif-badge">${unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>` : ''}
    </button>
    <div class="site-nav__notif-panel">
      <div class="site-nav__notif-panel-head">Notifications</div>
      <div class="site-nav__notif-list">
        ${notifications.length ? notifications.map(n => `<a href="${n.link ? escHtml(n.link) : '#'}" class="site-nav__notif-item${!n.read_at ? ' is-unread' : ''}">
          <div class="site-nav__notif-item-title">${escHtml(n.title)}</div>
          ${n.body ? `<div class="site-nav__notif-item-body">${escHtml(n.body)}</div>` : ''}
          <div class="site-nav__notif-item-time">${fmtNotifTime(n.created_at)}</div>
        </a>`).join('') : `<div class="site-nav__notif-empty">No notifications yet.</div>`}
      </div>
    </div>
  </div>` : '';

  // Groups "My Profile" with head/coach-only features (Fines today, more later per
  // Paolo) under one dropdown rather than piling standalone links into the nav — isHead
  // is computed once per request in server.js' renderPage(), not looked up here.
  const myAccountItems = [
    { href: '/me', label: 'My Profile', active: onOwnProfile },
    ...(isHead ? [
      { href: '/team',  label: 'My Team', active: currentPath.startsWith('/team') },
      { href: '/fines', label: 'Fines',   active: currentPath.startsWith('/fines') },
    ] : []),
  ];
  const myAccountDropdown = dropdown('My Account', myAccountItems, [], onOwnProfile || (isHead && (currentPath.startsWith('/fines') || currentPath.startsWith('/team'))));

  // Bell sits right after My Account (not before it) — folded into authLink itself
  // rather than inserted as a separate element at the nav render sites, so it always
  // lands in the same spot relative to My Account regardless of admin/player branch.
  const adminActive = currentPath.startsWith('/admin');
  const authLink = isAdmin
    ? `${isPlayer ? `${myAccountDropdown}${notificationBell}` : ''}<div class="site-nav__auth-pill"><a href="/admin"${adminActive ? ' aria-current="page"' : ''} class="site-nav__auth-join">Admin</a><span class="site-nav__auth-sep" aria-hidden="true"></span><a href="/logout" class="site-nav__auth-login">Sign out</a></div>`
    : isPlayer
      ? `${myAccountDropdown}${notificationBell}<a href="/logout" class="site-nav__login">Sign out</a>`
      : `<div class="site-nav__auth-pill"><a href="/register" class="site-nav__auth-join">Join</a><span class="site-nav__auth-sep" aria-hidden="true"></span><a href="/login" class="site-nav__auth-login">Login</a></div>`;

  // Shared by both header variants (full and minimal) — only one ever renders,
  // both use the same #nav-toggle/#site-nav ids, so one script covers either.
  // Two hamburger buttons can exist for minimalHeader pages — one in the
  // header (desktop) and one in the sidebar (mobile, register.js) — only one
  // is ever visually shown at a given width, but both stay wired to the same
  // #site-nav overlay and stay in sync with each other regardless of which is
  // visible, since resizing across the breakpoint shouldn't leave a stale
  // open/closed icon state on the one that becomes visible next.
  const navToggleScript = `<script>
      (function(){
        var nav = document.getElementById('site-nav');
        if (!nav) return;
        // Buttons are queried lazily (at click/toggle time, not once at script
        // load) since minimalHeader pages render a second hamburger inside the
        // page body, which comes AFTER this script tag in the HTML — an
        // upfront querySelectorAll here would run before that button exists
        // in the DOM yet and silently never attach a listener to it.
        function btns(){ return Array.prototype.slice.call(document.querySelectorAll('.site-nav__hamburger')); }
        function setOpen(open){
          nav.classList.toggle('site-nav--open', open);
          btns().forEach(function(b){
            b.classList.toggle('site-nav__hamburger--open', open);
            b.setAttribute('aria-expanded', String(open));
            b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
          });
          document.body.style.overflow = open ? 'hidden' : '';
        }
        document.addEventListener('click', function(e){
          var btn = e.target.closest && e.target.closest('.site-nav__hamburger');
          if (btn) setOpen(!nav.classList.contains('site-nav--open'));
        });
        nav.querySelectorAll('a').forEach(function(a){
          a.addEventListener('click', function(){ setOpen(false); });
        });
        // Dropdown (Games/Stats/Awards) toggle + click-outside-close, delegated
        // on document rather than scoped to one nav element — minimalHeader
        // pages render TWO separate nav copies (an inline one in the desktop
        // header, a full-screen one for the mobile overlay), each with their
        // own dropdown triggers, so this has to work regardless of which nav
        // instance a given trigger lives in.
        document.addEventListener('click', function(e){
          var trigger = e.target.closest && e.target.closest('.site-nav__dropdown-trigger');
          if (trigger) {
            var dd = trigger.closest('.site-nav__dropdown');
            var scope = trigger.closest('nav') || document;
            var wasOpen = dd.classList.contains('is-open');
            scope.querySelectorAll('.site-nav__dropdown').forEach(function(d){ d.classList.remove('is-open'); });
            if (!wasOpen) dd.classList.add('is-open');
            return;
          }
          document.querySelectorAll('.site-nav__dropdown').forEach(function(d){ d.classList.remove('is-open'); });
        });
        // Notification bell — same open/close mechanics as the dropdowns above, plus
        // marking everything read (once, across however many copies of the bell exist on
        // this page) the first time the panel is actually opened.
        var notifMarkedRead = false;
        document.addEventListener('click', function(e){
          var trigger = e.target.closest && e.target.closest('.site-nav__notif-trigger');
          if (trigger) {
            var wrap = trigger.closest('.site-nav__notif');
            var wasOpen = wrap.classList.contains('is-open');
            document.querySelectorAll('.site-nav__notif').forEach(function(d){ d.classList.remove('is-open'); });
            document.querySelectorAll('.site-nav__notif-trigger').forEach(function(t){ t.setAttribute('aria-expanded', 'false'); });
            if (!wasOpen) {
              wrap.classList.add('is-open');
              trigger.setAttribute('aria-expanded', 'true');
              if (!notifMarkedRead) {
                notifMarkedRead = true;
                document.querySelectorAll('.site-nav__notif-badge').forEach(function(b){ b.remove(); });
                document.querySelectorAll('.site-nav__notif-item.is-unread').forEach(function(it){ it.classList.remove('is-unread'); });
                fetch('/notifications/mark-read', { method: 'POST', headers: {'Content-Type':'application/json'} }).catch(function(){});
              }
            }
            return;
          }
          if (!(e.target.closest && e.target.closest('.site-nav__notif-panel'))) {
            document.querySelectorAll('.site-nav__notif').forEach(function(d){ d.classList.remove('is-open'); });
            document.querySelectorAll('.site-nav__notif-trigger').forEach(function(t){ t.setAttribute('aria-expanded', 'false'); });
          }
        });
      })();
      </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/favicon-32.png" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  ${metaTags}
  ${origin ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: 'WKND Basketball League',
    url: origin,
    logo: `${origin}/og-image.png`,
    sameAs: [
      'https://www.facebook.com/wkndbasketball',
      'https://www.instagram.com/wknd.basketball',
      'https://www.youtube.com/@wkndbasketball',
    ],
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'WKND Basketball League',
    url: origin,
  })}</script>` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Saira+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css${cssVer ? `?v=${cssVer}` : ''}">
  ${gaSnippet}
</head>
<body>
  ${minimalHeader ? `<div class="minimal-page">
    <header class="site-header site-header--minimal">
      <nav class="site-nav site-header--minimal__nav">
        ${nav}
        ${authLink}
      </nav>
    </header>
    <nav class="site-nav site-nav--overlay" id="site-nav">
      ${nav}
      ${authLink}
    </nav>
    ${navToggleScript}
    <div class="minimal-page__body">${body}</div>
    <footer class="site-footer--minimal">
      <nav class="site-footer__legal">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </nav>
      <span class="site-footer__copy">&copy; ${new Date().getFullYear()} WKND Basketball League</span>
    </footer>
  </div>` : `<div class="page-body">
    <div class="container">
      <header class="site-header">
        <div class="site-header__inner">
          <a href="/" class="site-header__logo-text">WKND Basketball</a>
          <nav class="site-nav" id="site-nav">
            ${nav}
            ${authLink}
          </nav>
          <button class="site-nav__hamburger" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">
            <span class="site-nav__hamburger-line"></span>
            <span class="site-nav__hamburger-line"></span>
            <span class="site-nav__hamburger-line"></span>
          </button>
        </div>
      </header>
      ${navToggleScript}
      <div class="header-rule"></div>
      ${ticker}
      ${body}
    </div>
  </div>
  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <a href="/" class="site-footer__logo">WKND Basketball</a>
          <span class="site-footer__tagline">Ball is life. Every weekend.</span>
          <div class="site-footer__social">
            <a href="https://www.facebook.com/wkndbasketball" class="site-footer__social-link" target="_blank" rel="noopener" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="https://www.instagram.com/wknd.basketball" class="site-footer__social-link" target="_blank" rel="noopener" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="https://www.youtube.com/@wkndbasketball" class="site-footer__social-link" target="_blank" rel="noopener" aria-label="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#020817"/></svg>
            </a>
          </div>
        </div>
        <div class="site-footer__groups">
          <div class="site-footer__group">
            <span class="site-footer__group-title">Games</span>
            <a href="/games">All Games</a>
            <a href="/standings">Standings</a>
            <a href="/playoffs">Playoffs</a>
            ${features.papawis ? '<a href="/papawis">Papawis</a>' : ''}
            ${features.posts ? '<a href="/posts">Posts</a>' : ''}
          </div>
          <div class="site-footer__group">
            <span class="site-footer__group-title">Stats</span>
            <a href="/teams">Teams</a>
            <a href="/players">Players</a>
            <a href="/leaders">Leaders</a>
            <a href="/roast">The Roast</a>
          </div>
          ${features.awards !== false || features.mvpRace !== false ? `<div class="site-footer__group">
            <span class="site-footer__group-title">Awards</span>
            ${features.awards  !== false ? `<a href="/awards">Season Awards</a>` : ''}
            ${features.mvpRace !== false ? `<a href="/mvp">MVP Race</a>`         : ''}
          </div>` : ''}
        </div>
      </div>
      <div class="site-footer__bottom">
        <nav class="site-footer__legal">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </nav>
        <span class="site-footer__copy">&copy; ${new Date().getFullYear()} WKND Basketball League</span>
      </div>
    </div>
  </footer>`}
</body>
</html>`;
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function teamChip(teamName, teamColors) {
  const color = teamColors[teamName?.toUpperCase()] || '#4a5263';
  const isLight = teamName?.toUpperCase() === 'WHITE';
  return `<span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>`;
}
