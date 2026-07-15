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
    ? `${isPlayer ? `<a href="/me"${currentPath === '/me' ? ' aria-current="page"' : ''}>My Profile</a>` : ''}<a href="/admin/ledger"${adminActive ? ' aria-current="page"' : ''} class="site-nav__admin">Admin</a><a href="/logout" class="site-nav__login">Sign out</a>`
    : isPlayer
      ? `<a href="/me"${currentPath === '/me' ? ' aria-current="page"' : ''}>My Profile</a><a href="/logout" class="site-nav__login">Sign out</a>`
      : `<a href="/login" class="site-nav__login">Login</a>`;

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
