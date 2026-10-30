// Box score player cards (views/player-cards.js): a tap on a top-3 card or a box score row marked
// data-pcard="<key>" opens that player's card (its <template data-pcard-t="<key>">) in a sheet.
// Loaded on the site and in the app, like table-scroll.js; one listener for the whole page, so
// screens the app swaps in work without setting anything up.
(function () {
  if (window.wkndPlayerCards) return;
  window.wkndPlayerCards = true;
  var sheet = null, last = null;
  function close() {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    document.removeEventListener('keydown', onKey);
    if (last && document.contains(last)) last.focus();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(key, from) {
    var t = null;
    var all = document.querySelectorAll('template[data-pcard-t]');
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute('data-pcard-t') === key) { t = all[i]; break; }
    if (!t) return;
    close();
    last = from;
    sheet = document.createElement('div');
    sheet.className = 'pcd-sheet';
    sheet.innerHTML = '<div class="pcd-sheet__in" role="dialog" aria-modal="true" aria-label="Player card"><span class="pcd-sheet__grab" aria-hidden="true"></span>'
      + '<button type="button" class="pcd-sheet__x" data-pcard-close aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    sheet.firstChild.appendChild(t.content.cloneNode(true));
    document.body.appendChild(sheet);
    document.addEventListener('keydown', onKey);
    var x = sheet.querySelector('[data-pcard-close]'); if (x) x.focus();
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-pcard], [data-pcard-close], .pcd-sheet');
    if (!el) return;
    // See profile: the sheet goes as the link opens (the app swaps the screen without a page load).
    if (e.target.closest('.pcd-sheet a[href]')) { setTimeout(close, 0); return; }
    if (el.hasAttribute('data-pcard-close') || (el.classList.contains('pcd-sheet') && e.target === el)) { e.preventDefault(); return close(); }
    if (el.hasAttribute('data-pcard')) {
      // A link inside the row (a name that goes to the profile) still works.
      // (So does the app box score name that opens the profile.)
      if (e.target.closest('a[href], [data-pid]') && !e.target.closest('a[href], [data-pid]').hasAttribute('data-pcard')) return;
      e.preventDefault();
      open(el.getAttribute('data-pcard'), el);
    }
  });
  // A row (not a button) opens with Enter or Space from the keyboard too.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest && e.target.closest('[data-pcard]');
    if (!el || el.tagName === 'BUTTON' || e.target.closest('a[href], [data-pid]')) return;
    e.preventDefault(); open(el.getAttribute('data-pcard'), el);
  });
  // The app swaps screens without a page load: a sheet left open goes with the old screen.
  window.addEventListener('popstate', close);
  document.addEventListener('wknd:screen', close);
})();
