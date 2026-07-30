import { escHtml } from '../layout.js';

const ICON_TRASH = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h10M5 4V2.5A1 1 0 0 1 6 1.5h2a1 1 0 0 1 1 1V4m1.5 0-.6 8a1 1 0 0 1-1 .9H4.1a1 1 0 0 1-1-.9L2.5 4"/></svg>`;

function statusBadge(status) {
  if (status === 'published') return `<span class="agm-badge agm-badge--green">Published</span>`;
  if (status === 'scheduled') return `<span class="agm-badge agm-badge--blue">Scheduled</span>`;
  return `<span class="agm-badge agm-badge--gray">Draft</span>`;
}

const fmtDate = ms => ms
  ? new Date(Number(ms)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';

export function adminPostsListBody({ posts = [] } = {}) {
  const rows = posts.map(p => `
    <tr class="admin-table-row">
      <td class="admin-td"><a href="/admin/posts/${escHtml(p.id)}/edit" style="color:var(--text-primary);text-decoration:none;font-weight:600">${escHtml(p.title || 'Untitled')}</a></td>
      <td class="admin-td">${statusBadge(p.status)}</td>
      <td class="admin-td">${fmtDate(p.publish_at || p.created_at)}</td>
      <td class="admin-td" style="text-align:right">
        <a href="/admin/posts/${escHtml(p.id)}/edit" class="admin-btn admin-btn--sm">Edit</a>
        <button class="admin-btn admin-btn--sm admin-btn--danger ap-del" data-id="${escHtml(p.id)}">${ICON_TRASH}</button>
      </td>
    </tr>`).join('');

  return `
<div class="agm-edit-bar">
  <a href="/admin/visibility" class="admin-btn">Visibility</a>
  <a href="/admin/posts/new" class="agm-new-btn">+ New Post</a>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr>
        <th class="admin-th">Title</th>
        <th class="admin-th">Status</th>
        <th class="admin-th">Date</th>
        <th class="admin-th" style="text-align:right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td class="admin-td" colspan="4" style="text-align:center;color:var(--text-muted);padding:32px">No posts yet.</td></tr>`}
    </tbody>
  </table>
</div>

<script>
(function(){
  document.querySelectorAll('.ap-del').forEach(function(btn){
    btn.addEventListener('click', async function(){
      if (!confirm('Delete this post?')) return;
      var id = btn.dataset.id;
      var r = await fetch('/admin/posts/' + id, { method: 'DELETE' });
      if (r.ok) location.reload();
    });
  });
})();
</script>`;
}

export function adminPostEditorBody({ post, teams = [] } = {}) {
  const isNew = !post;
  const id = post?.id || '';
  const bodyRaw = post?.body_html || '';
  const status = post?.status || 'draft';
  const publishAtLocal = post?.publish_at
    ? new Date(post.publish_at - new Date(post.publish_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
  const mismatches = (() => { try { return JSON.parse(post?.stat_check_json || '[]'); } catch { return []; } })();

  const teamOpts = teams.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`).join('');

  return `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css">

<div class="agm-edit-bar">
  <a href="/admin/posts" class="agm-edit-bar__back">← All Posts</a>
  <div class="agm-edit-bar__right">
    <span id="save-msg" class="agm-save-msg"></span>
    <button id="ap-save" class="agm-edit-bar__save">${isNew ? 'Create Post' : 'Save Changes'}</button>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_300px] items-start">

  <div class="flex flex-col gap-4 min-w-0">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Generate Draft</div>
      <div class="p-4">
        <div class="mb-3">
          <label class="admin-field-label">Content type</label>
          <select id="ap-gen-type" class="admin-input">
            <option value="matchup_preview">Playoff / Finals Matchup Preview</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="admin-field-label">Team A</label>
            <select id="ap-gen-team-a" class="admin-input"><option value="">Select…</option>${teamOpts}</select>
          </div>
          <div>
            <label class="admin-field-label">Team B</label>
            <select id="ap-gen-team-b" class="admin-input"><option value="">Select…</option>${teamOpts}</select>
          </div>
        </div>
        <div class="mb-3">
          <label class="admin-field-label">Angle / steer (optional)</label>
          <textarea id="ap-gen-steer" class="admin-input agm-textarea" rows="2" placeholder="e.g. mention the season sweep, make it dramatic…"></textarea>
        </div>
        <div class="agm-gen-bar">
          <button class="agm-gen-btn" id="ap-gen-btn">✦ Generate Draft</button>
          <span class="agm-gen-status" id="ap-gen-status"></span>
        </div>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</div>
      <div class="p-4">
        <input id="ap-title" type="text" class="admin-input" value="${escHtml(post?.title || '')}" placeholder="Post title">
      </div>
    </div>

    <div id="ap-warning-banner" style="display:${mismatches.length ? 'block' : 'none'}" class="ap-warning">
      <div class="ap-warning__head">
        <span>⚠ Some stated numbers didn't match real data — double-check before publishing</span>
        <button id="ap-warning-dismiss" class="ap-warning__dismiss">Dismiss</button>
      </div>
      <ul id="ap-warning-list" class="ap-warning__list">
        ${mismatches.map(m => `<li><strong>${escHtml(m.claim)}</strong> — expected ${escHtml(m.expected)}, found "${escHtml(m.found)}"</li>`).join('')}
      </ul>
    </div>

    <div class="card">
      <div class="card-label">BODY</div>
      <div style="padding:14px">
        <div id="post-body-quill"></div>
      </div>
    </div>

  </div>

  <div class="flex flex-col gap-4">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Publish</div>
      <div class="p-4">
        <div class="mb-3">
          <label class="admin-field-label">Status</label>
          <select id="ap-status" class="admin-input">
            <option value="draft"${status === 'draft' ? ' selected' : ''}>Draft</option>
            <option value="scheduled"${status === 'scheduled' ? ' selected' : ''}>Scheduled</option>
            <option value="published"${status === 'published' ? ' selected' : ''}>Published</option>
          </select>
        </div>
        <div id="ap-publish-at-wrap" style="display:${status === 'scheduled' ? 'block' : 'none'}">
          <label class="admin-field-label">Publish at</label>
          <input type="datetime-local" id="ap-publish-at" class="admin-input" value="${escHtml(publishAtLocal)}">
        </div>
        <div class="mt-3">
          <label class="admin-field-label">Slug</label>
          <input type="text" id="ap-slug" class="admin-input" value="${escHtml(post?.slug || '')}" placeholder="auto-generated-from-title">
        </div>
      </div>
    </div>

    ${!isNew ? `
    <div class="pt-1">
      <button id="ap-delete-btn" class="admin-btn admin-btn--danger">${ICON_TRASH} Delete post</button>
    </div>
    ` : ''}

  </div>
</div>

<style>
  .ap-warning { background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.35); border-radius: 10px; padding: 12px 14px; font-size: 13px; }
  .ap-warning__head { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#f59e0b; font-weight:600; }
  .ap-warning__dismiss { background:none; border:1px solid rgba(245,158,11,.4); color:#f59e0b; border-radius:6px; padding:2px 8px; font-size:11px; cursor:pointer; }
  .ap-warning__list { margin: 8px 0 0; padding-left: 18px; color: var(--text-muted); }
</style>

<script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>
<script>
(function(){
  var postId = ${JSON.stringify(id)};
  var isNew = ${JSON.stringify(isNew)};
  var aiGenerated = false;

  var quill = new Quill('#post-body-quill', {
    theme: 'snow',
    placeholder: 'Write the post here…',
    modules: { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link','clean']] }
  });
  quill.clipboard.dangerouslyPasteHTML(${JSON.stringify(bodyRaw)});

  var statusSel = document.getElementById('ap-status');
  statusSel.addEventListener('change', function(){
    document.getElementById('ap-publish-at-wrap').style.display = statusSel.value === 'scheduled' ? 'block' : 'none';
  });

  var dismissBtn = document.getElementById('ap-warning-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', function(){
    document.getElementById('ap-warning-banner').style.display = 'none';
  });

  var genBtn = document.getElementById('ap-gen-btn');
  genBtn.addEventListener('click', async function(){
    var status = document.getElementById('ap-gen-status');
    var teamA = document.getElementById('ap-gen-team-a').value;
    var teamB = document.getElementById('ap-gen-team-b').value;
    if (!teamA || !teamB || teamA === teamB) { status.textContent = 'Pick two different teams.'; status.className = 'agm-gen-status agm-gen-status--err'; return; }
    genBtn.disabled = true; genBtn.textContent = 'Generating…';
    status.textContent = ''; status.className = 'agm-gen-status';
    try {
      var r = await fetch('/admin/posts/generate-preview', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ teamAId: teamA, teamBId: teamB, steer: document.getElementById('ap-gen-steer').value })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'AI error');
      document.getElementById('ap-title').value = j.title;
      quill.clipboard.dangerouslyPasteHTML(j.body_html);
      aiGenerated = true;
      status.textContent = 'Generated'; status.className = 'agm-gen-status agm-gen-status--ok';
    } catch(e) {
      status.textContent = e.message; status.className = 'agm-gen-status agm-gen-status--err';
    } finally {
      genBtn.disabled = false; genBtn.textContent = '✦ Generate Draft';
    }
  });

  async function runVerify(id) {
    try {
      var r = await fetch('/admin/posts/' + id + '/verify-stats', { method: 'POST' });
      var j = await r.json();
      if (!r.ok) return;
      var banner = document.getElementById('ap-warning-banner');
      var list = document.getElementById('ap-warning-list');
      if (j.mismatches && j.mismatches.length) {
        list.innerHTML = j.mismatches.map(function(m){
          return '<li><strong>' + m.claim + '</strong> — expected ' + m.expected + ', found "' + m.found + '"</li>';
        }).join('');
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    } catch(e) { /* non-blocking, ignore */ }
  }

  // Quill's root.innerHTML almost always carries a trailing <p><br></p> for
  // whatever empty line the cursor is resting on (and can pick up more if the
  // user hits Enter a few extra times at the start/end) — strip only leading
  // and trailing empty paragraphs so that artifact doesn't ship as a blank gap
  // on the published page. Deliberately leaves every interior paragraph
  // untouched, even if blank, so real content can never be caught by this.
  function cleanEditorHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    function isEmptyP(el) {
      return !!el && (el.tagName === 'P' || el.tagName === 'DIV') && !el.textContent.trim() && !el.querySelector('img, video, iframe');
    }
    while (isEmptyP(div.firstElementChild)) div.firstElementChild.remove();
    while (isEmptyP(div.lastElementChild)) div.lastElementChild.remove();
    return div.innerHTML.trim();
  }

  async function doSave() {
    var btn = document.getElementById('ap-save');
    var msg = document.getElementById('save-msg');
    btn.disabled = true; btn.textContent = 'Saving…';
    var publishAtVal = document.getElementById('ap-publish-at').value;
    var body = {
      title: document.getElementById('ap-title').value,
      slug: document.getElementById('ap-slug').value,
      body_html: cleanEditorHtml(quill.root.innerHTML),
      status: statusSel.value,
      publish_at: publishAtVal ? new Date(publishAtVal).getTime() : null,
    };
    try {
      var url = isNew ? '/admin/posts' : '/admin/posts/' + postId;
      var r = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      msg.textContent = 'Saved'; msg.style.color = 'var(--amber)';
      var savedId = isNew ? j.id : postId;
      if (aiGenerated) await runVerify(savedId);
      if (isNew) { window.location.href = '/admin/posts/' + savedId + '/edit'; return; }
    } catch(e) {
      msg.textContent = e.message; msg.style.color = '#ef4444';
    } finally {
      btn.disabled = false; btn.textContent = isNew ? 'Create Post' : 'Save Changes';
    }
  }
  document.getElementById('ap-save').addEventListener('click', doSave);

  var delBtn = document.getElementById('ap-delete-btn');
  if (delBtn) delBtn.addEventListener('click', async function(){
    if (!confirm('Delete this post?')) return;
    var r = await fetch('/admin/posts/' + postId, { method: 'DELETE' });
    if (r.ok) window.location.href = '/admin/posts';
  });
})();
</script>`;
}
