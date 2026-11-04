// /admin/season/liveness/:id: one liveness photo beside the player's profile photo (rewrite, 2026-11).
// For a person to compare: nothing here is matched automatically.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, breadcrumb, section, facts, button } from './ui.js';

const fmtDate = ts => (ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—');

const VIA_LABEL = { inline: 'Captured on the same device', qr: 'Captured on a phone by QR code', activation: 'Captured at account activation' };

// Short form for cards and chips. The QR bridge is shared by Season Signup and /activate, so a 'qr'
// row can't say which flow it came from, only that a phone took it.
export const LIVENESS_SOURCE_LABEL = { inline: 'Season signup', qr: 'Phone (QR)', activation: 'Activation' };

export function adminLivenessReviewBody({ capture, signup, registration, back = '' } = {}) {
  // A sign-up row only exists once the form is submitted, and the photo saves earlier. The
  // registration always exists by this point.
  const fullName = signup?.full_name || registration?.full_name || '';
  const name = fullName ? displayPlayerName(fullName) : (capture.player_id || 'Unknown');
  const playerId = capture.player_id || registration?.player_id || '';
  const profile = playerId ? `/admin/players/${playerId}` : `/admin/users/${capture.reg_id}`;
  const crumb = back === 'user'
    ? { label: 'Registration', href: `/admin/users/${capture.reg_id}` }
    : { label: 'Liveness photos', href: '/admin/season/liveness' };

  return `<div class="aui-page">
    ${breadcrumb([crumb, { label: name }])}
    ${pageHeader({ title: name, sub: `Liveness check, Season ${capture.season}.`, actionsHtml: button(playerId ? 'Player' : 'Registration', { href: profile }) })}
    ${section({
      title: 'Side by side',
      note: 'For you to compare. Nothing is matched automatically.',
      bodyHtml: `<div class="alv-compare">
        <figure class="alv-compare__item"><figcaption>Liveness photo</figcaption><div class="alv-compare__photo"><img src="/admin/season/liveness/${escHtml(capture.id)}/photo" alt="Liveness photo"></div></figure>
        <figure class="alv-compare__item"><figcaption>Profile photo</figcaption><div class="alv-compare__photo">${playerId
          ? `<img src="/api/player/${escHtml(playerId)}/photo" alt="Profile photo" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>No profile photo</span>`
          : '<span>No player linked yet</span>'}</div></figure>
      </div>`,
    })}
    ${section({
      title: 'Details',
      bodyHtml: `<div class="aui-panel">${facts([
        ['Method', escHtml(VIA_LABEL[capture.via] || capture.via || '—')],
        ['Captured', escHtml(fmtDate(capture.captured_at))],
        ['Consent recorded', escHtml(fmtDate(capture.consent_at))],
        capture.prompt && ['They were asked to', escHtml(capture.prompt)],
      ])}</div>`,
    })}
    <p class="alv-note">Kept for admin reference only: never shown publicly and never leaves this system. Only the latest photo per registration is kept, so this one replaces any from an earlier season.</p>
  </div>`;
}
