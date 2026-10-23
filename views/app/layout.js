// Shell for the players-only app at /app (public/app.css, public/app.js, /app/sw.js).
// Every app page returns appPage({ ... }) — the full HTML document — instead of going
// through views/layout.js: no site header, footer or banners, a bottom tab bar instead.
import { escHtml } from '../layout.js';

export const esc = escHtml;

export const ballSvg = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="48" fill="#f59332"/><g fill="none" stroke="#0a0e16" stroke-width="6" stroke-linecap="round"><path d="M50 3V97M3 50H97M17 13Q41 50 17 87M83 13Q59 50 83 87"/></g></svg>';

// The site's wordmark; the outline "PLAYOFFS" ribbon while playoff mode is on.
export function appLogo(phase = null) {
  if (phase === 'playoffs') return `<span class="logo" aria-label="WKND Basketball"><span class="logo__mark">WKND${ballSvg}</span><span class="logo__ribbon" aria-hidden="true"><span>Playoffs</span></span></span>`;
  return `<span class="logo" aria-label="WKND Basketball"><span class="logo__mark">WKND${ballSvg}</span></span>`;
}

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  home: svg('<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>'),
  team: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
  me: svg('<path d="M4 20h16M7 17V10M12 17V5M17 17v-5"/>'),
  ball: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 5.8c2.6 3.4 2.6 9 0 12.4M18 5.8c-2.6 3.4-2.6 9 0 12.4"/>'),
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  target: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h1.5"/>'),
  form: svg('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/>'),
  shirt: svg('<path d="M8 4 3.5 7l2 4L8 10v10h8V10l2.5 1 2-4L16 4c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>'),
  scale: svg('<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>'),
  camera: svg('<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>'),
  door: svg('<path d="M14 4H6v16h8M10 12h10M17 9l3 3-3 3"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>', 'style="width:15px;height:15px;color:var(--subtle)"'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 11v9h14v-9"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
};
// The app keeps players inside it: only links to /app screens are tappable. Rows about
// something not built into the app yet (balance, sign-ups, picks) show as information with
// a "Soon" pill, and "Open full site" in More is the one way out.
export const isAppHref = h => /^\/app(\/|$|\?)/.test(String(h || ''));
export const soonTag = '<span class="tag-muted">Soon</span>';
// A list that loads itself: the screen arrives with placeholder rows and public/app.js
// fetches src, which answers JSON { html, next } — rows to append and the URL of the next
// page (null at the end). More pages load as the player scrolls near the bottom. Use it for
// anything long (notifications now, the feed later) so the screen opens at once.
export function lazyList({ src, empty = 'Nothing yet.', rows = 6 }) {
  const skel = Array.from({ length: rows }, () => '<div class="cell skel-row"><span class="skel skel--dot"></span><span class="cell__t"><span class="skel skel--line"></span><span class="skel skel--line skel--short"></span></span></div>').join('');
  return `<div class="lazy" data-lazy-src="${esc(src)}" data-lazy-empty="${esc(empty)}">
    <div class="group lazy__items" hidden></div>
    <div class="group lazy__skel" aria-hidden="true">${skel}</div>
    <div class="lazy__end" aria-live="polite"></div>
  </div>`;
}

export const chev = '<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5"/></svg>';
export const backChev = '<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>';

const TABS = [
  { key: 'home', href: '/app', label: 'Home', icon: icons.home },
  { key: 'team', href: '/app/team', label: 'My Team', icon: icons.team },
  { key: 'me', href: '/app/me', label: 'Me', icon: icons.me },
  { key: 'papawis', href: '/app/papawis', label: 'Papawis', icon: icons.ball },
  { key: 'more', href: '/app/more', label: 'More', icon: icons.more },
];

// The player's avatar: photo inside a ring in their team colour, initials underneath as
// the fallback while (or if) the photo doesn't load.
export function appAvatar({ playerId, initials = '', ring = '', size = '', badge = 0, photoUrl = '' }) {
  const cls = size ? ` avatar--${size}` : '';
  const img = playerId ? `<img src="${esc(photoUrl)}" alt="" onerror="this.remove()">` : '';
  const b = badge ? `<span class="badge-dot">${badge > 9 ? '9+' : badge}</span>` : '';
  return `<span class="avatar-wrap"><span class="avatar${cls}" style="--ring:${esc(ring || 'var(--subtle)')}">${esc(initials)}${img}</span>${b}</span>`;
}

// "Install the app" wall (installWall: the app_require_install setting). On a phone the app
// only runs from the home screen: in a phone browser — or the in-app browser of Messenger,
// Facebook or Instagram, where installing isn't possible — this screen replaces it. Shown
// before sign-in too: on iPhone the installed app has its own sign-in, separate from Safari.
// A computer's browser is never walled, so admins can test there. The head script decides
// before the first paint (html.needs-install + iw-ios / iw-android / iw-inapp).
const INSTALL_DETECT = `<script>(function(){try{var d=document.documentElement,ua=navigator.userAgent;
var sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
var ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),android=/Android/.test(ua);
if(sa||!(ios||android))return;
d.classList.add('needs-install',/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|MessengerForiOS|Line\\//.test(ua)?'iw-inapp':ios?'iw-ios':'iw-android',ios?'iw-is-ios':'iw-is-android');}catch(e){}})();</script>`;

const shareGlyph = '<svg class="iw-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 11v9h14v-9"/></svg>';
const dotsGlyph = '<svg class="iw-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
const moreGlyph = '<svg class="iw-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

function installWallHtml() {
  return `<section class="install-wall" aria-label="Install the WKND app">
  <div class="iw-top">
    <span class="iw-icon"><img src="/app-icon-180.png?v=2" alt="" width="72" height="72"></span>
    <h1>Install the<br><em>WKND app</em></h1>
    <p class="iw-lede">The players app works from your home screen, not the browser. It takes 10 seconds.</p>
  </div>

  <div class="iw-card iw-only-inapp">
    <div class="kick">Open it in your browser first</div>
    <p>You're inside Messenger, Facebook or Instagram, which can't install apps.</p>
    <ol class="iw-steps">
      <li><span class="iw-n">1</span><span class="iw-only-ios">Tap ${moreGlyph} at the top or bottom, then <b>Open in Safari</b> (or <b>Open in external browser</b>)</span><span class="iw-only-android">Tap ${dotsGlyph} at the top, then <b>Open in Chrome</b> (or <b>Open in browser</b>)</span></li>
      <li><span class="iw-n">2</span><span>Follow the steps there to add it to your home screen</span></li>
    </ol>
    <button class="btn btn--ghost" type="button" data-iw-copy>Copy link</button>
    <p class="iw-hint" data-iw-copied hidden>Copied. Paste it into <span class="iw-only-ios">Safari</span><span class="iw-only-android">Chrome</span>.</p>
  </div>

  <div class="iw-card iw-only-ios-browser">
    <div class="kick">On iPhone</div>
    <ol class="iw-steps">
      <li><span class="iw-n">1</span><span>Tap <span class="iw-pill">${shareGlyph} Share</span> in Safari's toolbar. Don't see it? Tap ${moreGlyph} first.</span></li>
      <li><span class="iw-n">2</span><span>Scroll down and tap <b>Add to Home Screen</b></span></li>
      <li><span class="iw-n">3</span><span>Tap <b>Add</b>, then open <b>WKND</b> from your home screen</span></li>
    </ol>
  </div>

  <div class="iw-card iw-only-android-browser">
    <div class="kick">On Android</div>
    <button class="btn" type="button" data-iw-install hidden>Install the app</button>
    <p class="iw-hint" data-iw-installed hidden>Installed. Now open <b>WKND</b> from your home screen.</p>
    <ol class="iw-steps" data-iw-manual>
      <li><span class="iw-n">1</span><span>Tap ${dotsGlyph} at the top right of Chrome</span></li>
      <li><span class="iw-n">2</span><span>Tap <b>Install app</b> or <b>Add to Home screen</b></span></li>
      <li><span class="iw-n">3</span><span>Open <b>WKND</b> from your home screen</span></li>
    </ol>
  </div>

  <div class="iw-note"><b>Already added it?</b> Close this and open the <b>WKND</b> icon on your home screen. The app doesn't work from the browser or Messenger.</div>
  <div class="iw-arrow iw-only-ios-browser" aria-hidden="true">${shareGlyph}</div>
</section>`;
}

// tab: which tab is lit ('' = none, e.g. sign-in and setup, which also drop the tab bar).
export function appPage({ title = 'WKND', tab = '', body = '', bare = false, ver = '', bodyClass = '', installWall = false }) {
  const tabbar = bare ? '' : `<nav class="tabbar" aria-label="App">${TABS.map(t =>
    `<a class="tab${t.key === tab ? ' is-on' : ''}" href="${t.href}"${t.key === tab ? ' aria-current="page"' : ''}>${t.icon}<span>${t.label}</span></a>`).join('')}</nav>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="app-ver" content="${esc(ver)}">
  <meta name="theme-color" content="#f3f4f7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0a0e16" media="(prefers-color-scheme: dark)">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="WKND">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="format-detection" content="telephone=no">
  <link rel="manifest" href="/app/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/app-icon-180.png?v=2">
  <link rel="icon" href="/favicon-32.png?v=2" type="image/png" sizes="32x32">
  <link rel="icon" href="/favicon-16.png?v=2" type="image/png" sizes="16x16">
  <script>try{var t=localStorage.getItem('wknd-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
  ${installWall ? INSTALL_DETECT : ''}
  <link rel="preload" href="/fonts/fonts.css" as="style">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <link rel="stylesheet" href="/app.css?v=${esc(ver)}">
</head>
<body class="${esc(bodyClass)}">
  ${installWall ? installWallHtml() : ''}
  <main class="app${bare ? ' app--bare' : ''}">${body}</main>
  ${tabbar}
  <script src="/app.js?v=${esc(ver)}" defer></script>
</body>
</html>`;
}
