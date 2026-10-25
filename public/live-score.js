// The live score, kept fresh: on a game being scored (the site's game page, the app's game
// screen), an element with data-live-src holds the live parts (data-live="hero" / "body").
// The server says when a play lands (data-live-ws, server.js liveChanged); this fetches the new
// parts (X-Live) and swaps them in. A hero whose pieces carry data-lv-swap keeps everything else
// (its buttons) and swaps just those. No socket: it checks every 20 s. Back to the tab: at once.
// When the game is published (or the live score is switched off) the page reloads into the
// official one; in the app, the fresh screen is swapped in (app.js wkndRefreshScreen). Loaded by views/game.js
// and, in the app, by public/app.js (initLive), which calls scan() on every screen.
(function () {
  'use strict';
  if (window.wkndLive) { window.wkndLive.scan(); return; }
  var cur = null;

  function scan() {
    var el = document.querySelector('[data-live-src]');
    if (cur && cur.el === el) return;
    stop();
    if (el) start(el);
  }
  function stop() {
    if (!cur) return;
    cur.dead = true;
    clearTimeout(cur.retry); clearInterval(cur.poll);
    if (cur.ws) try { cur.ws.close(); } catch (e) {}
    cur = null;
  }
  function start(el) {
    var c = cur = { el: el, wait: 2000, busy: false, again: false };
    var connect = function () {
      if (c.dead || !window.WebSocket) return;
      var ws;
      try { ws = c.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + el.getAttribute('data-live-ws')); } catch (e) { return; }
      ws.onopen = function () { if (c.wasOpen) refresh(c); c.wasOpen = true; c.wait = 2000; };
      ws.onmessage = function () { refresh(c); };
      ws.onclose = function () {
        if (c.dead) return;
        c.retry = setTimeout(connect, c.wait);
        c.wait = Math.min(c.wait * 2, 30000);
      };
    };
    connect();
    // The app may have opened its saved copy of the screen: catch up at once.
    var built = Number((document.querySelector('meta[name="app-time"]') || {}).content || 0);
    if (built && Date.now() - built > 3000) refresh(c);
    c.poll = setInterval(function () {
      if (document.visibilityState === 'visible' && (!c.ws || c.ws.readyState !== 1)) refresh(c);
    }, 20000);
  }
  document.addEventListener('visibilitychange', function () { if (cur && document.visibilityState === 'visible') refresh(cur); });

  function refresh(c) {
    if (c.dead) return;
    if (c.busy) { c.again = true; return; }
    c.busy = true;
    fetch(c.el.getAttribute('data-live-src'), { credentials: 'same-origin', headers: { 'X-Live': '1', Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (c.dead || !d) return;
        if (d.waiting) return; // scoring is on, no plays yet
        // Not live any more, or just went live on a page that had no live parts: the whole page.
        if (!d.on || !c.el.querySelector('[data-live="hero"]')) { stop(); if (window.wkndRefreshScreen) window.wkndRefreshScreen(); else location.reload(); return; }
        swap(c.el, 'hero', d.hero);
        swap(c.el, 'body', d.body);
      })
      .catch(function () {})
      .then(function () { c.busy = false; if (c.again) { c.again = false; refresh(c); } });
  }

  // Swap one part, keeping what the reader had chosen: the team shown in the box score, the
  // "All plays" list open. Plays that weren't there before flash once.
  function swap(root, part, html) {
    var box = root.querySelector('[data-live="' + part + '"]');
    if (!box || html == null) return;
    var tpl = document.createElement('div');
    tpl.innerHTML = html;
    var pieces = box.querySelectorAll('[data-lv-swap]');
    if (pieces.length) {
      [].forEach.call(pieces, function (old) {
        var nu = tpl.querySelector('[data-lv-swap="' + old.getAttribute('data-lv-swap') + '"]');
        if (nu) old.replaceWith(nu);
      });
      return;
    }
    var seen = {};
    [].forEach.call(box.querySelectorAll('[data-lv-play]'), function (p) { seen[p.getAttribute('data-lv-play')] = 1; });
    var team = box.querySelector('[data-lv-box-btn][aria-pressed="true"], [data-gr-team][aria-pressed="true"]');
    var teamSel = team && (team.hasAttribute('data-lv-box-btn') ? '[data-lv-box-btn="' + team.getAttribute('data-lv-box-btn') + '"]' : '[data-gr-team="' + team.getAttribute('data-gr-team') + '"]');
    var more = box.querySelector('[data-lv-more]');
    var open = more && more.open;
    box.innerHTML = '';
    while (tpl.firstChild) box.appendChild(tpl.firstChild);
    if (teamSel) { var b = box.querySelector(teamSel); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }
    if (open) { var m = box.querySelector('[data-lv-more]'); if (m) m.open = true; }
    if (Object.keys(seen).length) {
      [].forEach.call(box.querySelectorAll('[data-lv-play]'), function (p) { if (!seen[p.getAttribute('data-lv-play')]) p.classList.add('is-new'); });
    }
  }

  // The site's box score team switch (the app's is public/app.js data-gr-team).
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lv-box-btn]');
    if (!b) return;
    var side = b.getAttribute('data-lv-box-btn'), sec = b.closest('section');
    [].forEach.call(sec.querySelectorAll('[data-lv-box-btn]'), function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    [].forEach.call(sec.querySelectorAll('[data-lv-box]'), function (p) { p.hidden = p.getAttribute('data-lv-box') !== side; });
  });

  window.wkndLive = { scan: scan };
  scan();
})();
