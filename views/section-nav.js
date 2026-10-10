// Sticky "on this page" section nav (.gd-snav) behaviour, shared by the game page and the
// team page. Same feel as the /leaders bar (views/leaders.js leadersScript):
//   - the clicked link lights immediately and the page glides the section up to just under
//     the pinned bar (instant with prefers-reduced-motion);
//   - scroll-spy: of the sections whose top has passed just under the pinned bar, the lowest
//     one lights its link; at the very bottom of the page the lowest one on screen wins;
//   - .is-stuck once the bar pins (shows the mini title, adds the shadow);
//   - on phones the link row scrolls sideways to keep the lit link in view.
// Offsets come from the bar's real sticky top + height, never from html scroll-padding-top
// (which would stack with the bar and park sections too low).
export function sectionNavScript() {
  return `<script>
(function () {
  var header = document.querySelector('.site-header');
  var nav = document.querySelector('[data-gd-snav]');
  if (!nav) return;
  function setTop() { document.documentElement.style.setProperty('--gd-top', (header ? header.getBoundingClientRect().height : 0) + 'px'); }
  setTop(); window.addEventListener('resize', setTop);

  var links = [].slice.call(nav.querySelectorAll('[data-spy]'));
  var GAP = 16; // breathing room between the pinned bar and a section's top
  function pinTop() { return parseFloat(getComputedStyle(nav).top) || 0; }
  function stuckBottom() { return pinTop() + nav.offsetHeight; }
  var last = null;
  function setOn(on) {
    links.forEach(function (a) { a.classList.toggle('is-on', a === on); });
    if (on && on !== last && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - 16, behavior: 'smooth' });
    last = on;
  }

  var ticking = false, lock = null;
  function spy() {
    ticking = false;
    nav.classList.toggle('is-stuck', nav.getBoundingClientRect().top <= pinTop() + 1);
    if (lock || !links.length) return;
    var line = stuckBottom() + GAP + 40;
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    // Pick by position, not link order: on phones the game page's side rail ("Who called
    // it") drops below the main column, so sections aren't in the same order as the links.
    // On desktop that rail sits beside the main column, so two sections can share a top —
    // a tie keeps the link that's already lit (i.e. the one just clicked).
    var on = null, best = -Infinity, limit = atEnd ? window.innerHeight : line;
    links.forEach(function (a) {
      var s = document.getElementById(a.dataset.spy); if (!s) return;
      var top = s.getBoundingClientRect().top;
      if (top > limit) return;
      if (top > best + 1 || (Math.abs(top - best) <= 1 && a === last)) { best = Math.max(best, top); on = a; }
    });
    setOn(on || links[0]);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });

  nav.addEventListener('click', function (e) {
    var a = e.target.closest('[data-spy]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var sec = document.getElementById(a.dataset.spy);
    if (!sec) return;
    e.preventDefault();
    if (sec.tagName === 'DETAILS') sec.open = true;
    setOn(a);
    var y = Math.max(0, window.scrollY + sec.getBoundingClientRect().top - stuckBottom() - GAP);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(lock);
    // Hold the spy until the glide settles (scrollend where supported, a timer as backstop).
    lock = setTimeout(function () { lock = null; spy(); }, 1200);
    window.addEventListener('scrollend', function () { clearTimeout(lock); lock = null; }, { once: true });
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', '#' + sec.id);
  });

  // Direct #section link on load: land it under the bar the same way.
  if (location.hash) {
    var t = document.getElementById(location.hash.slice(1));
    if (t && links.some(function (a) { return a.dataset.spy === t.id; })) {
      if (t.tagName === 'DETAILS') t.open = true;
      requestAnimationFrame(function () { window.scrollTo(0, Math.max(0, window.scrollY + t.getBoundingClientRect().top - stuckBottom() - GAP)); });
    }
  }
  spy();
})();
</script>`;
}
