function fmtNotifTime(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "WKND" wordmark — Archivo 900 italic (thickened further with a same-color text stroke,
// since 900 is Archivo's heaviest weight), tight tracking, and a small basketball as the
// full stop. Shared by the main header and the register/season-signup sidebars so every
// page shows the same mark. The ball on its own is also the favicon (public/favicon.svg)
// and the admin console's brand mark.
export function wkndBall(className = 'wknd-logo__ball') {
  return `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="48" fill="#f59332"/><g fill="none" stroke="#0a0e16" stroke-width="6" stroke-linecap="round"><path d="M50 3V97M3 50H97M17 13Q41 50 17 87M83 13Q59 50 83 87"/></g></svg>`;
}

export function wkndLogo(className = 'site-header__logo', href = '/') {
  return `<a href="${href}" class="wknd-logo ${className}" aria-label="WKND Basketball home">WKND${wkndBall()}</a>`;
}

export function layout({ title = 'WKND Basketball League', currentPath = '/', body, ticker = '', gaSnippet = '', metaTags = '', cssVer = '', isAdmin = false, isPlayer = false, isOwnProfile = false, isHead = false, features = {}, minimalHeader = false, joinLabel = '', origin = '', notifications = [], unreadNotificationCount = 0, navPlayer = null, headerInfo = null }) {
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
    ...(features.picks ? [{ href: '/picks', label: 'Who wins? picks' }] : []),
  ], ['/games', '/standings', '/playoffs', '/picks']);

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
    features.marketplace ? `<a href="/marketplace"${isActive('/marketplace') ? ' aria-current="page"' : ''}>Marketplace</a>` : '',
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
  // is computed once per request in server.js' renderPage(), not looked up here. Polls is
  // the first item here open to every player, not just heads — visibility per-poll is
  // handled server-side (/polls), the nav link itself is just "you're logged in".
  const myAccountItems = [
    { href: '/me', label: 'My Profile', active: onOwnProfile },
    { href: '/polls', label: 'Polls', active: currentPath.startsWith('/polls') },
    ...(isHead ? [
      { href: '/team',  label: 'My Team', active: currentPath.startsWith('/team') },
      { href: '/fines', label: 'Fines',   active: currentPath.startsWith('/fines') },
    ] : []),
  ];
  const myAccountDropdown = dropdown('My Account', myAccountItems, [], onOwnProfile || currentPath.startsWith('/polls') || (isHead && (currentPath.startsWith('/fines') || currentPath.startsWith('/team'))));

  // Bell sits right after My Account (not before it) — folded into authLink itself
  // rather than inserted as a separate element at the nav render sites, so it always
  // lands in the same spot relative to My Account regardless of admin/player branch.
  const adminActive = currentPath.startsWith('/admin');
  const authLink = isAdmin
    ? `${isPlayer ? `${myAccountDropdown}${notificationBell}` : ''}<div class="site-nav__auth-pill"><a href="/admin"${adminActive ? ' aria-current="page"' : ''} class="site-nav__auth-join">Admin</a><span class="site-nav__auth-sep" aria-hidden="true"></span><a href="/logout" class="site-nav__auth-login">Sign out</a></div>`
    : isPlayer
      ? `${myAccountDropdown}${notificationBell}<a href="/logout" class="site-nav__login">Sign out</a>`
      : `<a href="/login" class="site-nav__signin"${currentPath === '/login' ? ' aria-current="page"' : ''}>Log in</a><a href="/register" class="site-nav__join"${joinLabel ? ` aria-label="${escHtml(joinLabel)}, join the community"` : ''}${currentPath === '/register' ? ' aria-current="page"' : ''}>${escHtml(joinLabel || 'Join the community')}</a>`;

  // Logged-out visitors on mobile get a Join button pinned in the header bar itself —
  // the nav (and its Join link) only exists inside the hamburger overlay there, so
  // without this a phone visitor never sees a way to register unless they open the menu.
  // Hidden on /register itself, where it would just point at the current page.
  const mobileJoin = !isAdmin && !isPlayer && currentPath !== '/register'
    ? `<a href="/register" class="site-header__join">Join</a>`
    : '';

  // Mobile drawer — its own markup rather than the desktop nav restyled: every link is
  // visible at once in labelled sections (no accordions), with the account card, bell and
  // head/admin shortcuts up top. Rendered once per page for both header variants; the
  // hamburger(s) open it via navToggleScript below. The bell is a second copy of the same
  // notificationBell markup, which the bell script already handles (class-based, not ids).
  const mIcon = (paths) => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const mIcons = {
    home:      mIcon('<path d="M2.5 8L9 2.5 15.5 8v7a.5.5 0 0 1-.5.5h-3.5v-4.5h-5v4.5H3a.5.5 0 0 1-.5-.5z"/>'),
    games:     mIcon('<rect x="2.5" y="3.5" width="13" height="12" rx="2"/><path d="M2.5 7.5h13M6 2v3M12 2v3"/>'),
    standings: mIcon('<path d="M3 15V9M7 15V4M11 15V7M15 15V11"/>'),
    playoffs:  mIcon('<path d="M2 3.5h4v4h4v4h4M2 14.5h4M10 7.5h4"/>'),
    picks:     mIcon('<circle cx="9" cy="9" r="6.5"/><path d="M6 9.2l2 2 4-4.4"/>'),
    papawis:   mIcon('<circle cx="9" cy="9" r="6.5"/><path d="M2.5 9h13M9 2.5c2 2 2 11 0 13M9 2.5c-2 2-2 11 0 13"/>'),
  };
  const mLink = (href, label, icon = '') =>
    `<a href="${href}" class="mnav__link"${isActive(href) ? ' aria-current="page"' : ''}>${icon}${label}</a>`;
  const mChip = (href, label, active) =>
    `<a href="${href}" class="mnav__chip"${active ? ' aria-current="page"' : ''}>${label}</a>`;
  const mSection = (label, links, grid = false) => {
    const html = links.filter(Boolean).join('');
    return html ? `<div class="mnav__section"><span class="mnav__label">${label}</span>${grid ? `<div class="mnav__grid">${html}</div>` : html}</div>` : '';
  };
  const mClose = `<button type="button" class="mnav__icon-btn" data-mnav-close aria-label="Close menu"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14"/></svg></button>`;

  const mChips = [
    isPlayer ? mChip('/polls', 'Polls', currentPath.startsWith('/polls')) : '',
    isPlayer && isHead ? mChip('/team', 'My Team', currentPath.startsWith('/team')) : '',
    isPlayer && isHead ? mChip('/fines', 'Fines', currentPath.startsWith('/fines')) : '',
    isAdmin ? mChip('/admin', 'Admin', adminActive) : '',
  ].join('');
  const mAvatar = navPlayer?.photoUrl
    ? `<span class="mnav__avatar"><img src="${escHtml(navPlayer.photoUrl)}" alt="" loading="lazy"></span>`
    : `<span class="mnav__avatar" aria-hidden="true">${escHtml(navPlayer?.initials || '')}</span>`;
  const mHead = isPlayer
    ? `<div class="mnav__account">
        <a href="/me" class="mnav__me"${onOwnProfile ? ' aria-current="page"' : ''}>${mAvatar}<span class="mnav__me-text"><span class="mnav__me-name">${escHtml(navPlayer?.name || 'My Profile')}</span><span class="mnav__me-sub">View my profile</span></span></a>
        ${notificationBell}
        ${mClose}
      </div>
      ${mChips ? `<div class="mnav__chips">${mChips}</div>` : ''}`
    : `<div class="mnav__account">${wkndLogo('mnav__logo')}${mClose}</div>
      ${isAdmin
        ? `<div class="mnav__chips">${mChips}</div>`
        : `<div class="mnav__auth"><a href="/login" class="mnav__btn"${currentPath === '/login' ? ' aria-current="page"' : ''}>Log in</a><a href="/register" class="mnav__btn mnav__btn--primary">${escHtml(joinLabel || 'Join the community')}</a></div>`}`;

  const mobileNav = `<div class="mnav" id="mobile-nav">
    <div class="mnav__backdrop" data-mnav-close></div>
    <nav class="mnav__panel" aria-label="Main menu">
      <div class="mnav__head">${mHead}</div>
      <div class="mnav__body">
        ${mSection('League', [
          mLink('/', 'Home', mIcons.home),
          mLink('/games', 'Games', mIcons.games),
          features.picks ? mLink('/picks', 'Picks <span class="nav-new">New</span>', mIcons.picks) : '',
          mLink('/standings', 'Standings', mIcons.standings),
          mLink('/playoffs', 'Playoffs', mIcons.playoffs),
          features.papawis ? mLink('/papawis', 'Papawis', mIcons.papawis) : '',
        ])}
        ${mSection('Stats', [
          mLink('/players', 'Players'),
          mLink('/teams', 'Teams'),
          mLink('/leaders', 'Leaders'),
          mLink('/roast', 'The Roast'),
        ], true)}
        ${mSection('Awards &amp; more', [
          features.mvpRace !== false ? mLink('/mvp', 'MVP Race') : '',
          features.awards  !== false ? mLink('/awards', 'Season Awards') : '',
          features.posts ? mLink('/posts', 'Posts') : '',
          features.marketplace ? mLink('/marketplace', 'Marketplace') : '',
        ], true)}
      </div>
      <div class="mnav__foot">
        <div class="mnav__social">
          <a href="https://www.facebook.com/wkndbasketball" target="_blank" rel="noopener" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
          <a href="https://www.instagram.com/wknd.basketball" target="_blank" rel="noopener" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg></a>
          <a href="https://www.youtube.com/@wkndbasketball" target="_blank" rel="noopener" aria-label="YouTube"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#10141d"/></svg></a>
        </div>
        ${isPlayer || isAdmin ? `<a href="/logout" class="mnav__signout">Sign out</a>` : ''}
      </div>
    </nav>
  </div>`;

  // ── Desktop header (full layout only) ──────────────────────────────────────
  // A thin top strip (season, next Papawis run, socials, log in/out) over a taller bar:
  // the logo, condensed all-caps links with an amber underline on the current page, and
  // Join / My Account + bell on the right. Most-used pages are direct links rather than
  // dropdown items; Stats and Awards stay groups. With the mega_menu_enabled flag on
  // (Admin → Visibility), those two groups open as full-width panels — same open/close
  // script as every other dropdown, only the menu's markup and CSS differ.
  const hdr = headerInfo || {};
  const barLink = (href, label) =>
    `<a href="${href}" class="hbar__link"${isActive(href) ? ' aria-current="page"' : ''}>${label}</a>`;
  const megaCard = (href, label, desc, icon) =>
    `<a href="${href}" class="mega__card${isActive(href) ? ' is-active' : ''}"><span class="mega__icon">${icon}</span><span class="mega__text"><span class="mega__title">${label}</span><span class="mega__desc">${desc}</span></span></a>`;
  const megaFeature = hdr.mvpLead && features.mvpRace !== false
    ? `<a href="/mvp" class="mega__feature">
        <span class="mega__feature-head"><span>MVP Race</span><span>S${escHtml(String(hdr.season))}${hdr.mvpLead.week ? ` · After week ${hdr.mvpLead.week}` : ''}</span></span>
        <span class="mega__feature-lead">
          <span class="mega__feature-avatar">${escHtml(hdr.mvpLead.initials)}</span>
          <span class="mega__feature-id"><span class="mega__feature-badge">Frontrunner</span><span class="mega__feature-name">${escHtml(hdr.mvpLead.name)}</span></span>
          <span class="mega__feature-score font-condensed">${escHtml(hdr.mvpLead.score)}</span>
        </span>
        <span class="mega__feature-line">${escHtml(hdr.mvpLead.line)}</span>
        <span class="mega__feature-cta">See the full race &rarr;</span>
      </a>`
    : '';
  // Mega mode (mega_menu_enabled) swaps the whole bar for the "four groups" layout:
  // Games / Stats / Awards / Community, each opening a full-width panel. Off, it's the
  // bar with direct links and plain Stats/Awards dropdowns. The top strip shows in both.
  const megaMode = !!features.megaMenu;
  const barDropdown = (label, items, withFeature = false) => {
    if (!items.length) return '';
    const active = items.some(i => isActive(i.href));
    const chevron = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 3.5l3 3 3-3"/></svg>`;
    const feature = withFeature ? megaFeature : '';
    const menu = megaMode
      ? `<div class="site-nav__dropdown-menu mega"><div class="container"><div class="mega__inner${feature ? '' : ' mega__inner--solo'}">
          <div class="mega__col"><span class="mega__label">${label}</span><div class="mega__grid${feature ? '' : ' mega__grid--3'}">${items.map(i => megaCard(i.href, i.label, i.desc, i.icon)).join('')}</div></div>
          ${feature}
        </div></div></div>`
      : `<div class="site-nav__dropdown-menu">${items.map(({ href, label: lbl }) =>
          `<a href="${href}" class="site-nav__dropdown-item${isActive(href) ? ' is-active' : ''}">${lbl}</a>`).join('')}</div>`;
    return `<div class="site-nav__dropdown hbar__dd${megaMode ? ' site-nav__dropdown--mega' : ''}${active ? ' is-active' : ''}">
      <button type="button" class="site-nav__dropdown-trigger hbar__link"${active ? ' aria-current="page"' : ''}>${label} ${chevron}</button>
      ${menu}
    </div>`;
  };
  const gamesItems = [
    { href: '/games',     label: 'All Games', desc: 'Results, schedule and box scores', icon: mIcons.games },
    { href: '/standings', label: 'Standings', desc: 'Season standings and records',     icon: mIcons.standings },
    { href: '/playoffs',  label: 'Playoffs',  desc: 'Bracket and playoff series',       icon: mIcons.playoffs },
    ...(features.picks ? [{ href: '/picks', label: 'Who wins? picks', desc: 'Pick the winners, climb the Pickmaster race', icon: mIcons.picks }] : []),
  ];
  const statsItems = [
    { href: '/players', label: 'Players',   desc: 'Profiles, season and career numbers', icon: mIcon('<circle cx="9" cy="6" r="3"/><path d="M3 16c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/>') },
    { href: '/teams',   label: 'Teams',     desc: 'Rosters and team averages',           icon: mIcon('<path d="M9 2l6 2.5v4c0 3.5-2.6 6-6 7.5-3.4-1.5-6-4-6-7.5v-4z"/>') },
    { href: '/leaders', label: 'Leaders',   desc: 'League leaders by stat category',     icon: mIcons.standings },
    { href: '/roast',   label: 'The Roast', desc: 'Peer ratings, roast-style',           icon: mIcon('<path d="M9 2c1 2.5 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3 .5 1.5 1.5 2 1.5 2C7.5 6 9 2 9 2z"/>') },
  ];
  const awardsItems = [
    features.mvpRace !== false ? { href: '/mvp',    label: 'MVP Race',      desc: 'Who leads the season MVP ladder, week by week', icon: mIcon('<path d="M5 2.5h8v4a4 4 0 0 1-8 0z"/><path d="M5 4H2.5v1.5A2.5 2.5 0 0 0 5 8M13 4h2.5v1.5A2.5 2.5 0 0 1 13 8M9 10.5V13M6 15.5h6"/>') } : null,
    features.awards  !== false ? { href: '/awards', label: 'Season Awards', desc: 'All-WKND teams, champions and season honours', icon: mIcon('<circle cx="9" cy="7" r="4.5"/><path d="M6.5 10.8L5.5 16 9 14l3.5 2-1-5.2"/>') } : null,
  ].filter(Boolean);
  const communityItems = [
    features.papawis     ? { href: '/papawis',     label: 'Papawis',     desc: hdr.nextPapawis ? `Next run: ${escHtml(hdr.nextPapawis)}` : 'Pickup runs — sign up for the next one', icon: mIcons.papawis } : null,
    features.marketplace ? { href: '/marketplace', label: 'Marketplace', desc: 'League group buys',                icon: mIcon('<path d="M3 6.5h12l-1 9H4z"/><path d="M6.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5"/>') } : null,
    features.posts       ? { href: '/posts',       label: 'Posts',       desc: 'League news and matchup previews', icon: mIcon('<rect x="3" y="2.5" width="12" height="13" rx="2"/><path d="M6 6.5h6M6 9.5h6M6 12.5h3"/>') } : null,
  ].filter(Boolean);

  const barNav = megaMode
    ? [
      barDropdown('Games', gamesItems),
      barDropdown('Stats', statsItems, true),
      barDropdown('Awards', awardsItems, true),
      barDropdown('Community', communityItems),
    ].join('')
    : [
      barLink('/games', 'Games'),
      barLink('/standings', 'Standings'),
      features.picks ? barLink('/picks', 'Picks <span class="nav-new">New</span>') : '',
      hdr.playoffsStarted ? barLink('/playoffs', 'Playoffs') : '',
      barDropdown('Stats', statsItems),
      barDropdown('Awards', awardsItems),
      features.papawis ? barLink('/papawis', 'Papawis') : '',
      features.marketplace ? barLink('/marketplace', 'Marketplace') : '',
      features.posts ? barLink('/posts', 'Posts') : '',
    ].join('');
  const joinBtn = `<a href="/register" class="hbar__join"${joinLabel ? ` aria-label="${escHtml(joinLabel)}, join the community"` : ''}${currentPath === '/register' ? ' aria-current="page"' : ''}>${escHtml(joinLabel || 'Join the community')}</a>`;
  // Log in / Admin / Sign out live in the top strip in both modes; the bar only carries
  // Join (guests) or My Account + bell (players).
  const barAccount = isPlayer ? `${myAccountDropdown}${notificationBell}` : isAdmin ? '' : joinBtn;
  // Rolling ticker after the season label: one line at a time, rolling up every few seconds
// (server.js buildTopTicker). Falls back to the plain "Next Papawis run" link when there's
// nothing else to say. The roll pauses on hover/focus and never moves for reduced motion.
  const topTicker = h => {
    const items = h.tickerItems || [];
    if (!items.length) {
      return h.nextPapawis ? `<span class="topstrip__sep" aria-hidden="true"></span><a href="/papawis" class="topstrip__link">Next Papawis run: ${escHtml(h.nextPapawis)}</a>` : '';
    }
    const line = (it, clone) => `<a href="${escHtml(it.href)}" class="tkr__item"${clone ? ' aria-hidden="true" tabindex="-1"' : ''}>
        <span class="tkr__tag${it.accent ? '' : ' tkr__tag--plain'}">${escHtml(it.tag)}</span>
        <span class="tkr__txt">${it.parts.map(([t, b]) => (b ? `<b>${escHtml(t)}</b>` : escHtml(t))).join('')}</span>
        <span class="tkr__go" aria-hidden="true">→</span>
      </a>`;
    return `<span class="topstrip__sep" aria-hidden="true"></span>
      <div class="tkr" data-tkr aria-label="League updates" role="region">
        <div class="tkr__roll" data-tkr-roll>${items.map(it => line(it, false)).join('')}${items.length > 1 ? line(items[0], true) : ''}</div>
      </div>
      ${items.length > 1 ? `<span class="tkr__pips" aria-hidden="true">${items.map((_, i) => `<i${i ? '' : ' class="is-on"'}></i>`).join('')}</span>` : ''}`;
  };
  const topStrip = `<div class="topstrip">
    <div class="container">
      <div class="topstrip__inner">
        <div class="topstrip__left">
          ${hdr.season ? `<span class="topstrip__season"><span class="topstrip__dot" aria-hidden="true"></span>Season ${escHtml(String(hdr.season))}</span>` : ''}
          ${topTicker(hdr)}
        </div>
        <div class="topstrip__right">
          <a href="https://www.facebook.com/wkndbasketball" class="topstrip__icon" target="_blank" rel="noopener" aria-label="Facebook"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
          <a href="https://www.instagram.com/wknd.basketball" class="topstrip__icon" target="_blank" rel="noopener" aria-label="Instagram"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/></svg></a>
          <a href="https://www.youtube.com/@wkndbasketball" class="topstrip__icon" target="_blank" rel="noopener" aria-label="YouTube"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#070a10"/></svg></a>
          <span class="topstrip__sep" aria-hidden="true"></span>
          ${isAdmin ? `<a href="/admin" class="topstrip__link${adminActive ? ' is-active' : ''}">Admin</a>` : ''}
          ${isPlayer || isAdmin
            ? `<a href="/logout" class="topstrip__link">Sign out</a>`
            : `<a href="/login" class="topstrip__link topstrip__link--strong"${currentPath === '/login' ? ' aria-current="page"' : ''}>Log in</a>`}
        </div>
      </div>
    </div>
  </div>`;

  // Global footer — "mirror the header": wordmark + social tiles, five link groups that
  // follow the mega-menu groups (plus League), and a bottom strip styled like .topstrip.
  // Each group is a <details> so phones get an accordion; desktop forces them open.
  // Links keep the same feature gating as the header; empty groups drop out.
  const isGuest = !isPlayer && !isAdmin;
  const footerGroups = [
    ['Games', [
      ['/games', 'All games'], ['/standings', 'Standings'], ['/playoffs', 'Playoffs'],
      features.picks ? ['/picks', 'Who wins? picks'] : null,
      ['/highlights', 'Highlights'],
    ]],
    ['Stats', [['/leaders', 'Leaders'], ['/players', 'Players'], ['/teams', 'Teams'], ['/roast', 'The Roast']]],
    ['Awards', [
      features.mvpRace !== false ? ['/mvp', 'MVP Race'] : null,
      features.awards  !== false ? ['/awards', 'Season awards'] : null,
      ['/badges', 'Badges'],
    ]],
    ['Community', [
      features.papawis ? ['/papawis', 'Papawis'] : null,
      features.posts ? ['/posts', 'Posts'] : null,
      isPlayer ? ['/polls', 'Polls'] : null,
      features.marketplace ? ['/marketplace', 'Marketplace'] : null,
    ]],
    ['League', [
      ['/rules', 'League rules'], ['/rules/fines', 'League fines'],
      features.picks ? ['/picks/rules', 'Pickmaster rules'] : null,
      isGuest ? ['/register', 'Join the community', 'site-footer__join-link'] : null,
    ]],
  ].map(([t, links]) => [t, links.filter(Boolean)]).filter(([, links]) => links.length);
  const footerChevron = `<svg class="site-footer__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  const footerTile = (href, label, svg) =>
    `<a href="${href}" class="site-footer__tile" target="_blank" rel="noopener" aria-label="${label}">${svg}</a>`;
  const siteFooter = `<footer class="site-footer">
    <div class="container">
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          ${wkndLogo('site-footer__logo')}
          <p class="site-footer__tagline">Ball is life. Every weekend.</p>
          <div class="site-footer__social">
            ${footerTile('https://www.facebook.com/wkndbasketball', 'Facebook', '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>')}
            ${footerTile('https://www.instagram.com/wknd.basketball', 'Instagram', '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/></svg>')}
            ${footerTile('https://www.youtube.com/@wkndbasketball', 'YouTube', '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#10141d"/></svg>')}
          </div>
          ${isGuest ? `<a href="/register" class="site-footer__join">Join the community</a>` : ''}
        </div>
        <nav class="site-footer__groups" aria-label="Footer">
          ${footerGroups.map(([t, links]) => `<details class="site-footer__group" open>
            <summary class="site-footer__group-title">${t}${footerChevron}</summary>
            <div class="site-footer__links">${links.map(([href, lbl, cls]) =>
              `<a href="${href}"${cls ? ` class="${cls}"` : ''}>${lbl}</a>`).join('')}</div>
          </details>`).join('')}
        </nav>
      </div>
    </div>
    <div class="site-footer__bottom">
      <div class="container">
        <div class="site-footer__bottom-inner">
          <div class="site-footer__bottom-left">
            ${hdr.season ? `<span class="topstrip__season"><span class="topstrip__dot" aria-hidden="true"></span>Season ${escHtml(String(hdr.season))}</span><span class="topstrip__sep" aria-hidden="true"></span>` : ''}
            <nav class="site-footer__legal" aria-label="Legal">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
              <a href="#" data-cookie-settings hidden>Cookie Settings</a>
            </nav>
          </div>
          <span class="site-footer__copy">&copy; ${new Date().getFullYear()} WKND Basketball League</span>
        </div>
      </div>
    </div>
    <script>
      (function(){
        // Phones: accordion with only the first group open. Wider: every group open, and
        // the summaries don't toggle.
        var mq = window.matchMedia('(max-width: 640px)');
        var groups = document.querySelectorAll('.site-footer__group');
        function sync(){ groups.forEach(function(d, i){ d.open = mq.matches ? i === 0 : true; }); }
        groups.forEach(function(d){
          d.querySelector('summary').addEventListener('click', function(e){ if (!mq.matches) e.preventDefault(); });
        });
        sync();
        (mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync));
      })();
    </script>
  </footer>`;

  // Shared by both header variants (full and minimal) — only one ever renders, and
  // both render mobileNav (#mobile-nav) right before this script, so one script covers
  // either. Two hamburger buttons can exist for minimalHeader pages — one in the header
  // and one in the sidebar (register.js / season-signup.js) — both open the same drawer
  // and stay in sync, since resizing across the breakpoint shouldn't leave a stale
  // open/closed state on whichever one becomes visible next.
  const navToggleScript = `<script>
      (function(){
        // Top-strip ticker: roll up one line every 4.5s; the cloned first line at the end
        // lets it loop without a visible jump back.
        var t = document.querySelector('[data-tkr]');
        if (!t) return;
        var roll = t.querySelector('[data-tkr-roll]'), n = roll.children.length - 1;
        if (n < 1 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
        var pips = document.querySelectorAll('.tkr__pips i'), i = 0, paused = false;
        t.addEventListener('mouseenter', function(){ paused = true; });
        t.addEventListener('mouseleave', function(){ paused = false; });
        t.addEventListener('focusin', function(){ paused = true; });
        t.addEventListener('focusout', function(){ paused = false; });
        setInterval(function(){
          if (paused || document.hidden) return;
          i++;
          roll.style.transition = 'transform .55s cubic-bezier(.65,0,.35,1)';
          roll.style.transform = 'translateY(' + (-i * 36) + 'px)';
          pips.forEach(function(p, k){ p.classList.toggle('is-on', k === i % n); });
          if (i === n) setTimeout(function(){ roll.style.transition = 'none'; roll.style.transform = 'translateY(0)'; i = 0; }, 600);
        }, 4500);
      })();
      (function(){
        var nav = document.getElementById('mobile-nav');
        if (!nav) return;
        // Buttons are queried lazily (at click/toggle time, not once at script
        // load) since minimalHeader pages render a second hamburger inside the
        // page body, which comes AFTER this script tag in the HTML — an
        // upfront querySelectorAll here would run before that button exists
        // in the DOM yet and silently never attach a listener to it.
        function btns(){ return Array.prototype.slice.call(document.querySelectorAll('.site-nav__hamburger')); }
        var lastTrigger = null;
        function setOpen(open){
          var wasOpen = nav.classList.contains('mnav--open');
          nav.classList.toggle('mnav--open', open);
          btns().forEach(function(b){
            b.setAttribute('aria-expanded', String(open));
          });
          document.body.style.overflow = open ? 'hidden' : '';
          if (open && !wasOpen) {
            var first = nav.querySelector('[data-mnav-close].mnav__icon-btn');
            if (first) first.focus({ preventScroll: true });
          } else if (!open && wasOpen && lastTrigger) {
            lastTrigger.focus({ preventScroll: true });
          }
        }
        document.addEventListener('click', function(e){
          var btn = e.target.closest && e.target.closest('.site-nav__hamburger');
          if (btn) { lastTrigger = btn; setOpen(!nav.classList.contains('mnav--open')); return; }
          if (e.target.closest && e.target.closest('[data-mnav-close]')) setOpen(false);
        });
        document.addEventListener('keydown', function(e){
          if (e.key === 'Escape' && nav.classList.contains('mnav--open')) setOpen(false);
        });
        nav.querySelectorAll('a').forEach(function(a){
          a.addEventListener('click', function(){ setOpen(false); });
        });
        // Mobile Safari/Chrome restore this exact page (DOM, scroll position, inline
        // styles) from bfcache on back/forward navigation instead of reloading it. If the
        // menu was left open at that point (closing it only runs via the close button, the
        // backdrop or a link click, never via the browser's own back/forward button), the restored
        // page comes back with body.style.overflow still 'hidden' — trapping the scroll
        // position wherever it was and making the header/hamburger unreachable. Force-close
        // on every pageshow (not just persisted ones) since it's a harmless no-op otherwise.
        window.addEventListener('pageshow', function(){ setOpen(false); });
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
  <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,700;0,800;1,900&family=Saira+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
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
    ${mobileNav}
    ${navToggleScript}
    <div class="minimal-page__body">${body}</div>
    <footer class="site-footer--minimal">
      <nav class="site-footer__legal">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="#" data-cookie-settings hidden>Cookie Settings</a>
      </nav>
      <span class="site-footer__copy">&copy; ${new Date().getFullYear()} WKND Basketball League</span>
    </footer>
  </div>` : `<div class="page-body">
    ${topStrip}
    <header class="site-header site-header--bar${megaMode ? ' site-header--mega' : ''}">
      <div class="container">
        <div class="site-header__inner">
          ${wkndLogo()}
          <nav class="site-nav hbar" aria-label="Main">${barNav}</nav>
          ${barAccount ? `<div class="hbar__account">${barAccount}</div>` : ''}
          <div class="site-header__actions">
            ${mobileJoin}
            <button class="site-nav__hamburger" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav">
              <span class="site-nav__hamburger-line"></span>
              <span class="site-nav__hamburger-line"></span>
              <span class="site-nav__hamburger-line"></span>
            </button>
          </div>
        </div>
      </div>
    </header>
    ${mobileNav}
    ${navToggleScript}
    <div class="container">
      ${ticker}
      ${body}
    </div>
  </div>
  ${siteFooter}`}
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

// Standard page hero — title + description, optionally a right-aligned actions slot
// (e.g. Fines' "Report Incident" button). title/description are always author-written
// static copy, never DB/user content, so callers pass raw strings — same convention the
// three pre-existing per-page copies of this (Papawis, Polls, Fines) already used.
export function pageHeader({ title, description = '', actions = '' }) {
  return `<div class="page-header">
  <div class="page-header__text">
    <h1 class="page-header__title">${title}</h1>
    ${description ? `<p class="page-header__sub">${description}</p>` : ''}
  </div>
  ${actions ? `<div class="page-header__actions">${actions}</div>` : ''}
</div>`;
}

export function teamChip(teamName, teamColors) {
  const color = teamColors[teamName?.toUpperCase()] || '#4a5263';
  const isLight = teamName?.toUpperCase() === 'WHITE';
  return `<span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>`;
}
