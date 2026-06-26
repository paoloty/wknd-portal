import { escHtml } from './layout.js';

const SITE_NAME    = 'WKND Basketball League';
const CONTACT_EMAIL = 'wkndbasketball@gmail.com';

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

export function privacyPage() {
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

export function termsPage() {
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
