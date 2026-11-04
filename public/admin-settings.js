// Saves the switches in a settings panel (views/admin/settings.js) through /admin/site/settings.
// Listens on the document once; after an in-place page swap, only the "controls" rows need syncing.
(function () {
  var saved = new WeakMap();
  function current(el) { return el.type === 'checkbox' ? el.checked : el.value; }
  function restore(el) { if (el.type === 'checkbox') el.checked = saved.get(el); else el.value = saved.get(el); }
  function msgOf(el) { var row = el.closest('.aset-row__control, .text-right'); return row && row.querySelector('[data-setting-msg]'); }
  function sync(el) {
    if (!el.dataset.controls) return;
    // style.display, not [hidden]: Tailwind's flex/grid classes would win over the attribute.
    document.querySelectorAll(el.dataset.controls).forEach(function (t) { t.style.display = el.checked ? '' : 'none'; });
  }
  function init() {
    document.querySelectorAll('[data-setting]').forEach(function (el) { saved.set(el, current(el)); sync(el); });
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('[data-setting]')) return;
    var value = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value.trim();
    var msg = msgOf(el);
    if (msg) { msg.style.color = 'var(--text-muted)'; msg.textContent = 'Saving…'; }
    var body = {}; body[el.dataset.setting] = value;
    fetch('/admin/site/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Error saving.'); }); })
      .then(function () {
        saved.set(el, current(el));
        sync(el);
        if (el.hasAttribute('data-reload')) { location.reload(); return; }
        if (msg) { msg.style.color = 'var(--aui-green)'; msg.textContent = 'Saved.'; setTimeout(function () { msg.textContent = ''; }, 2000); }
      })
      .catch(function (err) {
        restore(el);
        sync(el);
        if (msg) { msg.style.color = 'var(--aui-red)'; msg.textContent = err.message; }
      });
  });
  init();
  document.addEventListener('admin:updated', init);
})();
