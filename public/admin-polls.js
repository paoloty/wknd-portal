// /admin/polls/:id (views/admin/polls.js): option rows (add / remove) and the popup art
// upload. Re-runs on admin:updated, after the page is swapped in place.
(function () {
  function ui() { return window.adminUi; }

  function init() {
    // ── Options: add a row from the template, remove a row ─────────────────────────────
    var list = document.querySelector('[data-opt-list]');
    var tpl = document.querySelector('[data-opt-template]');
    var form = document.getElementById('poll-form');
    if (list && tpl && !list.__aplInit) {
      list.__aplInit = true;
      var changed = function () { form.dispatchEvent(new Event('input', { bubbles: true })); };
      var renumber = function () {
        list.querySelectorAll('[data-opt-row]').forEach(function (row, i) {
          var ins = row.querySelectorAll('input');
          ins[0].setAttribute('aria-label', 'Option ' + (i + 1));
          ins[1].setAttribute('aria-label', 'Option ' + (i + 1) + ' second line');
        });
      };
      document.querySelector('[data-opt-add]').addEventListener('click', function () {
        var row = tpl.content.firstElementChild.cloneNode(true);
        list.appendChild(row);
        renumber();
        row.querySelector('input').focus();
        changed();
      });
      list.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-opt-remove]');
        if (!rm) return;
        if (list.querySelectorAll('[data-opt-row]').length <= 2) { ui().toast('A poll needs at least 2 options.', { tone: 'error' }); return; }
        rm.closest('[data-opt-row]').remove();
        renumber();
        changed();
      });
    }

    // ── Popup art: upload / remove right away (not part of the Save poll form) ─────────
    var art = document.querySelector('[data-poll-art]');
    if (art && !art.__aplInit) {
      art.__aplInit = true;
      var upUrl = art.getAttribute('data-upload'), imgUrl = art.getAttribute('data-img');
      var input = art.querySelector('[data-art-input]'), frame = art.querySelector('[data-art-frame]'), img = art.querySelector('[data-art-img]');
      var rmBtn = art.querySelector('[data-art-remove]'), msg = art.querySelector('[data-art-msg]');
      var pick = art.querySelector('label[for="apl-art-input"]');
      input.addEventListener('change', function () {
        var f = input.files && input.files[0]; if (!f) return;
        msg.textContent = 'Uploading…';
        var r = new FileReader();
        r.onload = function () {
          fetch(upUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: r.result }) })
            .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok || d.error) throw new Error(d.error || 'Couldn’t upload that.'); }); })
            .then(function () { img.src = imgUrl + '?v=' + Date.now(); frame.hidden = false; rmBtn.hidden = false; pick.textContent = 'Replace art'; msg.textContent = ''; ui().toast('Art saved.'); })
            .catch(function (e) { msg.textContent = ''; ui().toast(e.message, { tone: 'error' }); })
            .then(function () { input.value = ''; });
        };
        r.readAsDataURL(f);
      });
      rmBtn.addEventListener('click', function () {
        ui().confirm({ title: 'Remove the art?', body: 'The popup shows without a picture.', sendLabel: 'Remove' }).then(function (ok) {
          if (!ok) return;
          fetch(upUrl, { method: 'DELETE' })
            .then(function (res) { if (!res.ok) throw new Error('Couldn’t remove it.'); frame.hidden = true; rmBtn.hidden = true; img.removeAttribute('src'); pick.textContent = 'Upload art'; ui().toast('Art removed.'); })
            .catch(function (e) { ui().toast(e.message, { tone: 'error' }); });
        });
      });
    }
  }

  init();
  document.addEventListener('admin:updated', init);
})();
