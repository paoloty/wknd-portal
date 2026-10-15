// Who wins? picks admin page (views/admin/picks.js), browser side. Sending is the generic
// form[data-confirm] in public/admin-ui.js (posted in the background, page re-rendered in
// place); this keeps the reminder checklist honest and handles the pick window:
//   • ticked count, "Also email N of them", the Send button and the confirm wording follow
//     the ticks; All / None / Only emailable
//   • Copy names
//   • the per-game pick window (POST /admin/games/:id/picks { closed })
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function (t) { alert(t); }, refresh: function () { location.reload(); } }; };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  function sync() {
    var form = document.getElementById('picks-remind');
    if (!form) return;
    var boxes = [].slice.call(form.querySelectorAll('input[name="ids"]:not([disabled])'));
    var on = boxes.filter(function (b) { return b.checked; });
    var emailable = on.filter(function (b) { return b.getAttribute('data-reach') === 'email'; }).length;
    var emailBox = form.querySelector('input[name="email"]');
    var count = form.querySelector('[data-sel-count]');
    if (count) count.textContent = String(on.length);
    var ec = form.querySelector('[data-email-count]');
    if (ec) ec.textContent = String(emailable);
    if (emailBox) emailBox.disabled = !emailable;
    var submit = form.querySelector('[data-remind-submit]');
    if (submit) submit.disabled = !on.length;
    var email = emailBox && emailBox.checked && !emailBox.disabled ? emailable : 0;
    form.setAttribute('data-confirm-title', 'Remind ' + plural(on.length, 'player') + '?');
    form.setAttribute('data-confirm-body', (email ? 'Bell to all of them, and the reminder email to ' + email + '.' : 'Bell only, no email.') + (form.getAttribute('data-reminded') ? ' You already sent one for this game day.' : ''));
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#picks-remind')) { sync(); return; }
    var win = t.closest('[data-pick-window]');
    if (win && t.type === 'radio') {
      fetch(win.getAttribute('data-pick-window'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closed: t.value }) })
        .then(function (r) { if (!r.ok) throw new Error(); ui().refresh({ auto: 'Picks follow the game-day cut-off.', closed: 'Picks closed.', open: 'Picks kept open.' }[t.value] || 'Saved.'); })
        .catch(function () { ui().toast('Couldn’t save the pick window.', { tone: 'error' }); });
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var sel = t.closest('[data-sel]');
    if (sel) {
      var mode = sel.getAttribute('data-sel');
      document.querySelectorAll('#picks-remind input[name="ids"]:not([disabled])').forEach(function (b) {
        b.checked = mode === 'all' || (mode === 'email' && b.getAttribute('data-reach') === 'email');
      });
      sync();
      return;
    }
    var copy = t.closest('[data-copy-names]');
    if (copy) {
      var text = copy.getAttribute('data-copy-names');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function () { ui().toast('Names copied.'); })
        .catch(function () { ui().toast('Couldn’t copy. Select the names by hand.', { tone: 'error' }); });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();
  document.addEventListener('admin:updated', sync);
})();
