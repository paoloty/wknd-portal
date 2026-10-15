// Games list (views/admin/games.js), browser side. Posting is the generic
// form[data-json-action] in public/admin-ui.js; this only:
//   • points the one Final score drawer at the row's game and labels its score fields
//   • shows the Series field in New game for playoff games
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-final-open]');
    if (!b) return;
    e.preventDefault();
    var dr = document.getElementById('final-score');
    var form = document.getElementById('final-form');
    if (!dr || !form) return;
    form.reset();
    form.setAttribute('data-json-action', '/admin/games/' + encodeURIComponent(b.getAttribute('data-final-open')) + '/final');
    form.setAttribute('data-confirm', '');
    form.setAttribute('data-confirm-title', 'Save the final score?');
    form.setAttribute('data-confirm-body', 'Picks for this game settle and results go out.');
    form.setAttribute('data-confirm-send', 'Save score');
    var title = dr.querySelector('.aui-drawer__title');
    if (title) title.textContent = b.getAttribute('data-a') + ' vs ' + b.getAttribute('data-b');
    var la = form.querySelector('[data-final-a]'), lb = form.querySelector('[data-final-b]');
    if (la) la.closest('.aui-field').querySelector('.aui-field__label').textContent = b.getAttribute('data-a');
    if (lb) lb.closest('.aui-field').querySelector('.aui-field__label').textContent = b.getAttribute('data-b');
    dr.hidden = false;
    if (la) la.focus();
  });

  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('[data-game-type]')) return;
    var wrap = e.target.form && e.target.form.querySelector('[data-series]');
    if (!wrap) return;
    wrap.hidden = e.target.value !== 'playoff';
    var sel = wrap.querySelector('select');
    if (sel) sel.disabled = wrap.hidden; // a hidden series must not be sent
  });
})();
