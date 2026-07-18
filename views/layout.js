export function layout({ title = 'WKND Basketball League', currentPath = '/', body, ticker = '', gaSnippet = '', metaTags = '', cssVer = '', isAdmin = false, isPlayer = false, features = {} }) {
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

  const isActive = (href) => href === '/' ? currentPath === '/' : currentPath.startsWith(href);

  const dropdown = (label, items, activeHrefs) => {
    const active = activeHrefs.some(h => isActive(h));
    const chevron = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 3.5l3 3 3-3"/></svg>`;
    const itemHtml = items.map(({ href, label: lbl }) =>
      `<a href="${href}" class="site-nav__dropdown-item${isActive(href) ? ' is-active' : ''}">${lbl}</a>`
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
    gamesDropdown,
    statsDropdown,
    awardsDropdown,
  ].join('');

  const adminActive = currentPath.startsWith('/admin');
  const authLink = isAdmin
    ? `${isPlayer ? `<a href="/me"${currentPath === '/me' ? ' aria-current="page"' : ''}>My Profile</a>` : ''}<div class="site-nav__auth-pill"><a href="/admin/ledger"${adminActive ? ' aria-current="page"' : ''} class="site-nav__auth-join">Admin</a><span class="site-nav__auth-sep" aria-hidden="true"></span><a href="/logout" class="site-nav__auth-login">Sign out</a></div>`
    : isPlayer
      ? `<a href="/me"${currentPath === '/me' ? ' aria-current="page"' : ''}>My Profile</a><a href="/logout" class="site-nav__login">Sign out</a>`
      : `<div class="site-nav__auth-pill"><a href="/register" class="site-nav__auth-join">Join</a><span class="site-nav__auth-sep" aria-hidden="true"></span><a href="/login" class="site-nav__auth-login">Login</a></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  ${metaTags}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Saira+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css${cssVer ? `?v=${cssVer}` : ''}">
  ${gaSnippet}
</head>
<body>
  <div class="page-body">
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
      <script>
      (function(){
        var btn = document.getElementById('nav-toggle');
        var nav = document.getElementById('site-nav');
        btn.addEventListener('click', function(){
          var open = nav.classList.toggle('site-nav--open');
          btn.classList.toggle('site-nav__hamburger--open', open);
          btn.setAttribute('aria-expanded', String(open));
          btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
          document.body.style.overflow = open ? 'hidden' : '';
        });
        nav.querySelectorAll('a').forEach(function(a){
          a.addEventListener('click', function(){
            nav.classList.remove('site-nav--open');
            btn.classList.remove('site-nav__hamburger--open');
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Open menu');
            document.body.style.overflow = '';
          });
        });
        // Accordion: toggle submenu on trigger click
        nav.querySelectorAll('.site-nav__dropdown-trigger').forEach(function(trigger){
          trigger.addEventListener('click', function(e){
            e.stopPropagation();
            var dd = trigger.closest('.site-nav__dropdown');
            var wasOpen = dd.classList.contains('is-open');
            nav.querySelectorAll('.site-nav__dropdown').forEach(function(d){ d.classList.remove('is-open'); });
            if (!wasOpen) dd.classList.add('is-open');
          });
        });
        // Close dropdowns when clicking outside
        document.addEventListener('click', function(){
          nav.querySelectorAll('.site-nav__dropdown').forEach(function(d){ d.classList.remove('is-open'); });
        });
        nav.addEventListener('click', function(e){ e.stopPropagation(); });
      })();
      </script>
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
  </footer>
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
