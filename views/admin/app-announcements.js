// Admin → Players app → Feed posts (/admin/app/announcements; was Announcements). The app's
// feed posts by type (announcement, highlight, photos, throwback, Facebook post), the bulk add
// for past Facebook and YouTube links, and each post's date, edit, pin, hide and delete. The
// screen itself is views/feed-admin.js, shared with the app's Me → Feed posts.
import { pageHeader, button } from './ui.js';
import { feedAdminBody } from '../feed-admin.js';

// list: getAppAnnouncements() rows · refOptions: server.js feedRefOptions()
export function adminAnnouncementsBody({ list, refOptions = [], now = Date.now() }) {
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Players app', title: 'Feed posts', sub: 'Posts in the app’s feed, by date with the games, runs and results. An earlier date puts a post lower in the feed.', actionsHtml: button('Back to Players app', { href: '/admin/app' }) })}
    ${feedAdminBody({ list, refOptions, now, thumb: a => feedThumb(a) })}
  </div>`;
}
// A post's small picture for the Posted list: its first photo, else its photo.
export const feedThumb = a => (a.photos ? `/admin/app/announcements/${encodeURIComponent(a.id)}/photos/1?w=160&v=${a.updated_at}`
  : a.has_image ? `/admin/app/announcements/${encodeURIComponent(a.id)}/image?w=160&v=${a.updated_at}` : '');
