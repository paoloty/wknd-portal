import { escHtml } from './layout.js';

const SITE_NAME = 'WKND Basketball League';
// Fallback only — server.js passes the real address (CONTACT_EMAIL env var) into every page
// below, keeping this view free of its own env/config reads.
const DEFAULT_CONTACT_EMAIL = 'pao@wkndbasketball.com';

function legalPage(title, sections) {
  const body = sections.map(({ heading, content }) => `
  <div class="legal-section">
    <h2 class="legal-section__heading">${escHtml(heading)}</h2>
    <div class="legal-section__body">${content}</div>
  </div>`).join('');

  return `<div class="page-content">
  <div class="legal-page">
    <div class="legal-header">
      <h1 class="legal-title">${escHtml(title)}</h1>
      <p class="legal-updated">Last updated: June 2026</p>
    </div>
    <div class="card legal-card">
      ${body}
    </div>
  </div>
</div>`;
}

export function privacyPage(contactEmail = DEFAULT_CONTACT_EMAIL) {
  const CONTACT_EMAIL = contactEmail;
  return legalPage('Privacy Policy', [
    {
      heading: 'Overview',
      content: `<p>${escHtml(SITE_NAME)} ("we", "us", "our") operates this website to provide basketball statistics, standings, and game recaps for our league. This page explains what information we collect, how we use it, and your rights regarding that information.</p>`,
    },
    {
      heading: 'Information We Collect',
      content: `<p>We collect the following types of information:</p>
      <ul>
        <li><strong>Usage data</strong> — pages visited, referrer, browser type, and device information, collected automatically via Google Analytics.</li>
        <li><strong>Account information</strong> — if you sign in with Facebook, we receive your public profile (name and profile photo) and email address as permitted by Facebook.</li>
        <li><strong>Cookies</strong> — small files stored on your device used to maintain your session and analytics preferences.</li>
      </ul>
      <p>We do not collect payment information, and we do not knowingly collect data from children under 13.</p>`,
    },
    {
      heading: 'How We Use Your Information',
      content: `<ul>
        <li>To display league statistics, standings, and game results.</li>
        <li>To authenticate you if you choose to log in.</li>
        <li>To understand site usage and improve the experience via Google Analytics.</li>
      </ul>
      <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>`,
    },
    {
      heading: 'Third-Party Services',
      content: `<p>We use the following third-party services that may collect data independently under their own privacy policies:</p>
      <ul>
        <li><strong>Google Analytics</strong> — collects anonymised usage data. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>.</li>
        <li><strong>Meta (Facebook Login)</strong> — used for optional sign-in. <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener">Meta Privacy Policy</a>.</li>
        <li><strong>Google Fonts</strong> — fonts are loaded from Google's servers. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a>.</li>
      </ul>`,
    },
    {
      heading: 'Data Retention',
      content: `<p>Analytics data is retained according to Google Analytics' default retention settings. If you sign in, your account information is stored until you request deletion. You may request deletion of your account data at any time by contacting us.</p>`,
    },
    {
      heading: 'Your Rights',
      content: `<p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of your data.</li>
        <li>Opt out of Google Analytics by using the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics Opt-out Browser Add-on</a>.</li>
      </ul>`,
    },
    {
      heading: 'Contact',
      content: `<p>For privacy-related questions or data requests, contact us at <a href="mailto:${escHtml(CONTACT_EMAIL)}">${escHtml(CONTACT_EMAIL)}</a>.</p>`,
    },
  ]);
}

export function rulesPage(contactEmail = DEFAULT_CONTACT_EMAIL) {
  const CONTACT_EMAIL = contactEmail;
  return legalPage('League Rules', [
    {
      heading: 'The Short Version',
      content: `<p>${escHtml(SITE_NAME)} plays under FIBA's rules as its foundation. What's below isn't the FIBA rulebook copy-pasted — it's our own plain-language rundown of how a game actually runs here, including the house rules layered on top.</p>`,
    },
    {
      heading: 'Game Format',
      content: `<p>Games are 4 quarters of 12 minutes.</p>
      <p><strong>Pasarella (1st half only):</strong> at the 6-minute mark of both Q1 and Q2, every team must swap out all 5 players on the court for a full lineup change — not a spot substitution. Once that lineup is locked in, no further subs are allowed for the rest of that segment, with one exception: an injury. A player subbed out for injury is done for the rest of the game — they can't check back in later, even if they recover.</p>
      <p>The 2nd half (Q3 and Q4) reverts to normal, unrestricted substitutions.</p>`,
    },
    {
      heading: 'Overtime',
      content: `<p>A tied game goes to a single 5-minute overtime period, decided by whoever's ahead when the clock hits zero. Pasarella does not apply in overtime — substitutions are free the whole period.</p>`,
    },
    {
      heading: 'Scoring',
      content: `<p>Standard 2 and 3-point scoring applies everywhere. On courts with a 4-point line marked, a shot from beyond it is worth 4 — we use the same distance the PBA introduced for its Governors' Cup, 27 feet (about 8.2m) from the rim. Courts without that line marked simply play with a 3-point max, no 4-point shot available that game.</p>`,
    },
    {
      heading: 'Fouls & Free Throws',
      content: `<p>FIBA's foul rules apply: 5 personal fouls disqualifies a player for the rest of the game. On team fouls, the bonus kicks in starting on a team's 5th foul of the quarter — every non-shooting foul after that sends the other team to the line for 2 free throws.</p>
      <p>Technical and flagrant fouls carry their standard FIBA on-court consequences (free throws, possession, and ejection for a Flagrant 2). For the monetary penalty that comes with them, see the <a href="/rules/fines">League Fines</a> page.</p>`,
    },
    {
      heading: 'Timeouts',
      content: `<p>FIBA's standard allotment: 2 timeouts in the first half, 3 in the second (only 2 of those 3 can be used in the final 2 minutes of the 4th quarter), and 1 per overtime period.</p>`,
    },
    {
      heading: 'Shot Clock',
      content: `<p>24 seconds per possession, resetting to 14 after an offensive rebound — FIBA standard.</p>`,
    },
    {
      heading: 'Roster & Eligibility',
      content: `<p>${escHtml(SITE_NAME)} is exclusive to its members, not an open registration league — it's capped at exactly 4 teams by design, built to stay a tight community where people actually know each other rather than an anonymous open league.</p>
      <p>A team roster can carry 12-15 players, but only 12 may be dressed and eligible to play in any single game.</p>`,
    },
    {
      heading: 'Playoffs',
      content: `<p>The top 4 teams by regular-season record make the bracket, seeded by wins — ties broken by head-to-head record first (when it's exactly two teams tied), then point-differential.</p>
      <p>Semifinals are <strong>twice to beat</strong>: the higher seed only needs one win to advance, while the lower seed needs two. The <strong>Championship Finals are best-of-3</strong>, first to 2 wins.</p>`,
    },
    {
      heading: 'Questions',
      content: `<p>Anything not covered here, or a call you want clarified? Reach us at <a href="mailto:${escHtml(CONTACT_EMAIL)}">${escHtml(CONTACT_EMAIL)}</a>.</p>`,
    },
  ]);
}

export function termsPage(contactEmail = DEFAULT_CONTACT_EMAIL) {
  const CONTACT_EMAIL = contactEmail;
  return legalPage('Terms of Service', [
    {
      heading: 'Acceptance',
      content: `<p>By accessing this website you agree to these Terms of Service. If you do not agree, please do not use the site. We may update these terms at any time; continued use after changes constitutes acceptance.</p>`,
    },
    {
      heading: 'What This Service Is',
      content: `<p>${escHtml(SITE_NAME)} is a public-facing statistics portal for a recreational basketball league. It provides game scores, standings, player stats, and recaps. The site is provided for informational and entertainment purposes only.</p>`,
    },
    {
      heading: 'Acceptable Use',
      content: `<p>You agree not to:</p>
      <ul>
        <li>Scrape, crawl, or systematically download site content for commercial purposes without permission.</li>
        <li>Attempt to gain unauthorised access to any part of the site or its underlying systems.</li>
        <li>Use the site in any way that could damage, disable, or impair its operation.</li>
        <li>Misrepresent statistics or content from this site in a misleading or defamatory context.</li>
      </ul>`,
    },
    {
      heading: 'Intellectual Property',
      content: `<p>All content on this site — including statistics, game writeups, player profiles, and design — is owned by ${escHtml(SITE_NAME)} or its contributors. Player photos may be subject to individual rights. You may share and link to content with attribution, but may not reproduce it commercially without permission.</p>`,
    },
    {
      heading: 'Disclaimer',
      content: `<p>Statistics and game results are provided in good faith but may contain errors. ${escHtml(SITE_NAME)} makes no warranties about the accuracy or completeness of any information on this site. We are not liable for any decisions made based on information found here.</p>`,
    },
    {
      heading: 'Governing Law',
      content: `<p>These terms are governed by applicable local laws. Any disputes shall be resolved in good faith between the parties.</p>`,
    },
    {
      heading: 'Contact',
      content: `<p>Questions about these terms? Reach us at <a href="mailto:${escHtml(CONTACT_EMAIL)}">${escHtml(CONTACT_EMAIL)}</a>.</p>`,
    },
  ]);
}
