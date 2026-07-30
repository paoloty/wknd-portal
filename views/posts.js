import { escHtml } from './layout.js';
import { formatDate, excerpt, stripEmptyParagraphs } from './utils.js';

function postRow(post) {
  const body = excerpt(post.body_html.replace(/<[^>]+>/g, ' '));
  const dateLabel = post.publish_at ? formatDate(new Date(post.publish_at).toISOString()) : '';
  return `<a href="/posts/${encodeURIComponent(post.slug)}" class="post-row">
  <div class="post-row__body">
    <div class="post-row__meta">${escHtml(dateLabel)}</div>
    <h3 class="post-row__title">${escHtml(post.title)}</h3>
    ${body ? `<p class="post-row__excerpt">${escHtml(body.length > 160 ? body.slice(0, 160) + '…' : body)}</p>` : ''}
    <span class="post-row__cta">READ MORE <span>→</span></span>
  </div>
</a>`;
}

export function postsListPage({ posts = [] } = {}) {
  const rows = posts.length
    ? posts.map(postRow).join('\n    ')
    : `<div class="card post-list__empty">No posts yet.</div>`;

  return `<style>
  .post-list__empty { padding: 32px; text-align: center; color: var(--text-muted); }
  .post-row { display: block; padding: 20px 18px; text-decoration: none; border-bottom: 1px solid var(--border); }
  .post-row:last-child { border-bottom: none; }
  .post-row__meta { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
  .post-row__title { font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0 0 6px; }
  .post-row__excerpt { font-size: 14px; color: var(--text-muted); margin: 0 0 8px; line-height: 1.5; }
  .post-row__cta { font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--amber); }
</style>
<div class="page-content">
  <div class="card">
    <div class="card-label">POSTS</div>
    ${rows}
  </div>
</div>`;
}

export function postDetailPage({ post }) {
  return `<style>
  .post-detail__meta { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .post-detail__title { font-size: 32px; font-weight: 900; color: var(--text-primary); margin: 0 0 24px; letter-spacing: -.01em; }
  .post-detail__body { font-size: 16px; line-height: 1.7; color: var(--text-primary); }
  .post-detail__body p { margin: 0 0 18px; }
</style>
<div class="page-content">
  <div class="card" style="padding:32px">
    <div class="post-detail__meta">${post.publish_at ? escHtml(formatDate(new Date(post.publish_at).toISOString())) : ''}</div>
    <h1 class="post-detail__title">${escHtml(post.title)}</h1>
    <div class="post-detail__body">${stripEmptyParagraphs(post.body_html)}</div>
  </div>
</div>`;
}
