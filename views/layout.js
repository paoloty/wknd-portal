export function layout({ title = 'WKND Basketball League', currentPath = '/', body, ticker = '', gaSnippet = '', metaTags = '', cssVer = '', isAdmin = false, features = {} }) {
  const mainLinks = [
    { href: '/',          label: 'Home' },
    { href: '/games',     label: 'Games' },
    { href: '/standings', label: 'Standings' },
    { href: '/teams',     label: 'Teams' },
    { href: '/players',   label: 'Players' },
    { href: '/leaders',   label: 'Leaders' },
  ];
  const navLinks = [...mainLinks, { href: '/roast', label: 'The Roast' }];

  const awardsActive = currentPath.startsWith('/awards') || currentPath.startsWith('/mvp');

  const awardsDropdown = (() => {
    const showAwards = features.awards  !== false;
    const showMvp    = features.mvpRace !== false;
    if (!showAwards && !showMvp) return '';
    const items = [
      showAwards ? `<a href="/awards" class="site-nav__dropdown-item${currentPath.startsWith('/awards') ? ' is-active' : ''}">Season Awards</a>` : '',
      showMvp    ? `<a href="/mvp"    class="site-nav__dropdown-item${currentPath.startsWith('/mvp')    ? ' is-active' : ''}">MVP Race</a>`    : '',
    ].join('');
    return `<div class="site-nav__dropdown${awardsActive ? ' is-active' : ''}">
      <button class="site-nav__dropdown-trigger"${awardsActive ? ' aria-current="page"' : ''}>Awards <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 3.5l3 3 3-3"/></svg></button>
      <div class="site-nav__dropdown-menu">${items}</div>
    </div>`;
  })();

  const linkHtml = ({ href, label }) => {
    const active = href === '/' ? currentPath === '/' : currentPath.startsWith(href);
    return `<a href="${href}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
  };

  const nav = [
    ...mainLinks.map(linkHtml),
    awardsDropdown,
    linkHtml({ href: '/roast', label: 'The Roast' }),
  ].join('');

  const adminActive = currentPath.startsWith('/admin');
  const authLink = isAdmin
    ? `<a href="/admin/ledger"${adminActive ? ' aria-current="page"' : ''} class="site-nav__admin">Admin</a><a href="/logout" class="site-nav__login">Sign out</a>`
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
        <a href="/" class="site-footer__logo">WKND Basketball</a>
        <nav class="site-footer__nav">
          ${navLinks.map(({ href, label }) => `<a href="${href}">${escHtml(label)}</a>`).join('')}
          ${features.awards  !== false ? `<a href="/awards">Season Awards</a>` : ''}
          ${features.mvpRace !== false ? `<a href="/mvp">MVP Race</a>`         : ''}
        </nav>
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
