import { escHtml } from '../layout.js';

const card = (title, body, sub = '') => `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">${escHtml(title)}</div>
  <div class="p-4">
    ${sub ? `<p style="color:var(--text-muted);font-size:12px;margin:0 0 12px">${sub}</p>` : ''}
    ${body}
  </div>
</div>`;

const voiceOptions = (voices, selected, firstLabel) =>
  (firstLabel ? `<option value="">${escHtml(firstLabel)}</option>` : '') +
  voices.map(v => `<option value="${escHtml(v.id)}" ${v.id === selected ? 'selected' : ''}>${escHtml(v.name)}</option>`).join('');

function voiceCard(v) {
  return `<div class="aiw-voice" data-id="${escHtml(v.id)}" style="border:1px solid var(--admin-border,#1e293b);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px">
  <div style="display:flex;align-items:center;gap:10px">
    <input type="text" class="admin-input aiw-name" value="${escHtml(v.name)}" placeholder="Voice name" maxlength="40" style="flex:1">
    <label class="site-toggle" title="Include in weekly rotation">
      <input type="checkbox" class="aiw-enabled" ${v.enabled !== false ? 'checked' : ''}>
      <span class="site-toggle__track"></span>
    </label>
    <button type="button" class="admin-btn admin-btn--sm admin-btn--danger aiw-remove" title="Delete voice">Delete</button>
  </div>
  <label class="admin-field-label">Instructions for the AI</label>
  <textarea class="admin-input agm-textarea aiw-guide" rows="4" maxlength="1200" placeholder="Describe how this voice writes — tone, vocabulary, what to avoid.">${escHtml(v.guide)}</textarea>
  <label class="admin-field-label">Sample line <span style="font-weight:400;color:var(--text-muted)">(optional — the AI copies its style, not its words)</span></label>
  <input type="text" class="admin-input aiw-sample" value="${escHtml(v.sample || '')}" maxlength="400" placeholder="One sentence written in this voice">
</div>`;
}

export function adminAiWritingBody({ config, features, creativityLevels, currentVoices, limits }) {
  const { voices, mode, fixedVoice, overrides, creativity } = config;

  const modeBody = `
  <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;cursor:pointer">
    <input type="radio" name="aiw-mode" value="rotate" ${mode === 'rotate' ? 'checked' : ''} style="margin-top:3px">
    <span><strong>Rotate weekly</strong><br><span style="color:var(--text-muted);font-size:12px">Each game week uses the next voice that's switched on below. Both games in a week share it; award articles cycle through the voices across the page.</span></span>
  </label>
  <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">
    <input type="radio" name="aiw-mode" value="fixed" ${mode === 'fixed' ? 'checked' : ''} style="margin-top:3px">
    <span style="flex:1"><strong>Always use one voice</strong>
      <select id="aiw-fixed" class="admin-input" style="margin-top:6px">${voiceOptions(voices, fixedVoice, 'Choose a voice…')}</select>
    </span>
  </label>`;

  const overrideBody = `
  <table class="w-full border-collapse">
    <tbody>
      ${features.map(f => `<tr class="admin-table-row">
        <td class="admin-td" style="font-weight:600;white-space:nowrap">${escHtml(f.label)}</td>
        <td class="admin-td" style="color:var(--text-muted);font-size:12px">${currentVoices[f.key] ? `Now: ${escHtml(currentVoices[f.key])}` : ''}</td>
        <td class="admin-td" style="width:220px">
          <select class="admin-input aiw-override" data-feature="${escHtml(f.key)}">${voiceOptions(voices, overrides[f.key], 'Follow voice mode')}</select>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;

  const creativityBody = creativityLevels.map(l => `
  <label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;cursor:pointer">
    <input type="radio" name="aiw-creativity" value="${escHtml(l.key)}" ${creativity === l.key ? 'checked' : ''} style="margin-top:3px">
    <span><strong>${escHtml(l.label)}</strong> <span style="color:var(--text-muted);font-size:12px">— ${escHtml(l.hint)}</span></span>
  </label>`).join('');

  const voicesBody = `
  <div id="aiw-voices" style="display:flex;flex-direction:column;gap:12px">${voices.map(voiceCard).join('')}</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
    <button type="button" id="aiw-add" class="admin-btn admin-btn--sm">+ Add voice</button>
    <button type="button" id="aiw-reset" class="admin-btn admin-btn--sm admin-btn--muted">Reset everything to defaults</button>
  </div>
  <template id="aiw-voice-template">${voiceCard({ id: '', enabled: true, name: '', guide: '', sample: '' })}</template>`;

  return `
<div class="agm-edit-bar">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">AI Writing</h2>
    <p class="text-xs text-slate-500 mt-0.5">How the AI writes game recaps, POTG spotlights, MVP Race writeups, and award articles. Changes apply the next time something is generated — saved writeups don't change.</p>
  </div>
  <div class="agm-edit-bar__right">
    <span id="save-msg" class="agm-save-msg"></span>
    <button id="aiw-save" class="agm-edit-bar__save">Save Changes</button>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_340px] items-start">
  <div class="flex flex-col gap-4 min-w-0">
    ${card('Voices', voicesBody, `Switch a voice off to drop it from the weekly rotation. You can edit the instructions or add your own (up to ${limits.maxVoices}).`)}
  </div>
  <div class="flex flex-col gap-4">
    ${card('Voice mode', modeBody)}
    ${card('Per-feature voice', overrideBody, 'Pin a voice for one feature only — e.g. conyo for recaps while everything else rotates.')}
    ${card('Creativity', creativityBody)}
  </div>
</div>

<script>
(function() {
  var list = document.getElementById('aiw-voices');
  var tpl  = document.getElementById('aiw-voice-template');
  var msg  = document.getElementById('save-msg');

  function bindRemove(el) {
    el.querySelector('.aiw-remove').addEventListener('click', function() {
      if (list.children.length <= 1) { alert('Keep at least one voice.'); return; }
      if (confirm('Delete this voice?')) el.remove();
    });
  }
  Array.prototype.forEach.call(list.children, bindRemove);

  document.getElementById('aiw-add').addEventListener('click', function() {
    if (list.children.length >= ${limits.maxVoices}) { alert('At most ${limits.maxVoices} voices.'); return; }
    var el = tpl.content.firstElementChild.cloneNode(true);
    list.appendChild(el);
    bindRemove(el);
    el.querySelector('.aiw-name').focus();
  });

  document.getElementById('aiw-reset').addEventListener('click', async function() {
    if (!confirm('Reset voices, mode, per-feature voices and creativity to the defaults?')) return;
    var r = await fetch('/admin/ai-writing/reset', { method: 'POST' });
    if (r.ok) location.reload(); else alert('Reset failed.');
  });

  document.getElementById('aiw-save').addEventListener('click', async function() {
    var voices = Array.prototype.map.call(list.children, function(el) {
      return {
        id: el.dataset.id || '',
        name: el.querySelector('.aiw-name').value,
        enabled: el.querySelector('.aiw-enabled').checked,
        guide: el.querySelector('.aiw-guide').value,
        sample: el.querySelector('.aiw-sample').value,
      };
    });
    var overrides = {};
    document.querySelectorAll('.aiw-override').forEach(function(s) { overrides[s.dataset.feature] = s.value; });
    var body = {
      voices: voices,
      mode: (document.querySelector('input[name=aiw-mode]:checked') || {}).value || 'rotate',
      fixedVoice: document.getElementById('aiw-fixed').value,
      overrides: overrides,
      creativity: (document.querySelector('input[name=aiw-creativity]:checked') || {}).value || 'balanced',
    };
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    try {
      var r = await fetch('/admin/ai-writing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      var d = await r.json().catch(function() { return {}; });
      if (!r.ok) throw new Error(d.error || 'Error saving.');
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      // Reload so new voices get their ids and the dropdowns pick them up.
      setTimeout(function() { location.reload(); }, 600);
    } catch (e) {
      msg.style.color = '#f87171'; msg.textContent = e.message;
    }
  });
})();
</script>`;
}
