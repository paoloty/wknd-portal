// Swipeable tables, the standard for every data grid on the site, the admin and the app
// (2026-10-25): a table wider than its box swipes sideways, its first column (the names)
// stays put, and once the stats scroll under it a shadow shows on that column's edge.
// Nothing to add per table: any <table> whose parent (up to three levels) scrolls sideways
// (overflow-x: auto) gets it, and only while it really is wider than its box. Opt out with
// data-xs-off on the table or a parent. Styles: the "Swipeable tables" block in
// public/styles.css (site + admin) and public/app.css (app). Loaded by views/layout.js,
// views/admin/layout.js and views/app/layout.js.
(function () {
  'use strict';
  if (window.wkndTableScroll) return;

  // "rgb(1, 2, 3)" / "rgba(1, 2, 3, .5)" / "color(srgb .1 .2 .3 / .5)" → [r, g, b, a] (0–255, 0–1)
  function parse(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (m) { var p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = /color\(srgb ([^)]+)\)/.exec(c || '');
    if (m) { var q = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [q[0] * 255, q[1] * 255, q[2] * 255, q.length > 3 ? q[3] : 1]; }
    return null;
  }
  var css = function (c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; };
  var over = function (top, under) { var a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  // What's actually painted behind el: the first solid background up the tree, with any
  // see-through tints on the way laid over it.
  function behind(el) {
    var tints = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = parse(getComputedStyle(n).backgroundColor);
      if (!c || c[3] === 0) continue;
      if (c[3] >= 1) { var out = c; for (var i = tints.length - 1; i >= 0; i--) out = over(tints[i], out); return out; }
      tints.push(c);
    }
    var base = [10, 14, 22, 1]; for (var j = tints.length - 1; j >= 0; j--) base = over(tints[j], base);
    return base;
  }
  // A stylesheet can name the background itself (--xs-bg: the app's cards are a gradient);
  // a probe resolves it to a colour.
  function cssBg(box) {
    if (!getComputedStyle(box).getPropertyValue('--xs-bg').trim()) return null;
    var p = document.createElement('i'); p.style.cssText = 'position:absolute;width:0;height:0;background-color:var(--xs-bg)';
    box.appendChild(p); var c = parse(getComputedStyle(p).backgroundColor); p.remove();
    return c && c[3] >= 1 ? c : null;
  }

  function scroller(t) {
    for (var n = t.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) {
      var o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll') return n;
    }
    return null;
  }
  // The cells in the first column, row and column spans counted: with a two-row header
  // (DATE spanning both, then FG / 3PT over M A %), the second row's first cell isn't in it.
  function firstCells(t) {
    var taken = [], out = [];
    Array.prototype.forEach.call(t.rows, function (r, ri) {
      var col = 0;
      Array.prototype.forEach.call(r.cells, function (c) {
        while (taken[ri] && taken[ri][col]) col++;
        if (col === 0) out.push(c);
        for (var y = 0; y < (c.rowSpan || 1); y++) { taken[ri + y] = taken[ri + y] || []; for (var x = 0; x < (c.colSpan || 1); x++) taken[ri + y][col + x] = true; }
        col += c.colSpan || 1;
      });
    });
    return out;
  }
  // Tables drawn as a full grid (every cell boxed in) or with borders on the rows only work
  // with collapsed borders, which can't show a cell's shadow: those are left as they are.
  // Dividers on one side of a cell (the pinned column's edge, between stat groups) are fine.
  function drawable(t) {
    var row = t.tBodies[0] && t.tBodies[0].rows[0];
    if (!row || row.cells.length < 2) return false;
    var boxed = Array.prototype.slice.call(row.cells, 1).some(function (c) { var s = getComputedStyle(c); return parseFloat(s.borderLeftWidth) > 0 && parseFloat(s.borderRightWidth) > 0; });
    if (boxed) return false;
    if (getComputedStyle(t).borderCollapse === 'collapse' && parseFloat(getComputedStyle(row).borderBottomWidth) > 0) return false;
    return true;
  }

  function update(t) {
    var box = t._xs;
    if (!box || !box.isConnected || !t.isConnected) return;
    var wide = box.scrollWidth > box.clientWidth + 1;
    var cells = firstCells(t);
    // A first column that takes most of the box isn't worth pinning.
    var pin = wide && cells.length && cells[0].getBoundingClientRect().width < box.clientWidth * 0.6;
    if (pin && !t.classList.contains('xs__t')) {
      if (!drawable(t)) { t._xsSkip = true; return; }
      var bg = cssBg(box) || behind(box);
      box.style.setProperty('--xs-bg', css(bg));
      // Before the class lands (it paints the cells): keep each cell's own background, laid
      // over the box's, so highlighted rows and header colours still show.
      cells.forEach(function (c) {
        var own = parse(getComputedStyle(c).backgroundColor), row = parse(getComputedStyle(c.parentElement).backgroundColor);
        var col = own && own[3] > 0 ? own : row && row[3] > 0 ? row : null;
        if (col) c.style.setProperty('--xs-cell', css(col[3] >= 1 ? col : over(col, bg)));
        c.classList.add('xs__c');
      });
      box.classList.add('xs'); t.classList.add('xs__t');
      box.classList.toggle('is-scrolled', box.scrollLeft > 2);
    } else if (!pin && t.classList.contains('xs__t')) {
      box.classList.remove('xs', 'is-scrolled'); t.classList.remove('xs__t');
      Array.prototype.forEach.call(t.querySelectorAll('.xs__c'), function (c) { c.classList.remove('xs__c'); });
    }
  }

  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) { entries.forEach(function (e) { (e.target._xsTables || []).forEach(update); }); }) : null;
  function bind(t) {
    if (t._xsBound || t.closest('[data-xs-off]')) return;
    t._xsBound = true;
    var box = scroller(t);
    if (!box) return;
    t._xs = box;
    (box._xsTables = box._xsTables || []).push(t);
    t._xsTables = [t];
    if (ro) { ro.observe(box); ro.observe(t); }
    update(t);
  }
  function scan(root) {
    if (root.tagName === 'TABLE') return bind(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('table'), bind);
  }

  // The shadow follows the scroll (capture: scroll events don't bubble).
  document.addEventListener('scroll', function (e) {
    var b = e.target;
    if (b && b.classList && b.classList.contains('xs')) b.classList.toggle('is-scrolled', b.scrollLeft > 2);
  }, { capture: true, passive: true });
  // Tables that arrive later: the app's screen swaps, the admin's in-place updates, lazy blocks.
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  // Sections that open with an animation (a profile's Career, tabs, <details>) settle after
  // the resize was seen: look again once things stop moving. Only tables already found.
  var known = function () { Array.prototype.forEach.call(document.querySelectorAll('table'), function (t) { if (t._xs && !t._xsSkip) update(t); }); };
  var soon = null, later = function () { clearTimeout(soon); soon = setTimeout(known, 120); };
  ['click', 'transitionend', 'animationend', 'toggle'].forEach(function (ev) { document.addEventListener(ev, later, { capture: true, passive: true }); });
  if (!ro) window.addEventListener('resize', later);
  var start = function () { scan(document); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // Tables can widen after fonts load.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Array.prototype.forEach.call(document.querySelectorAll('table'), function (t) { if (t._xs) update(t); }); });
  window.wkndTableScroll = { scan: scan };
})();
