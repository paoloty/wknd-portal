// Live chat on a live game (views/live-chat.js draws it; site game page and app game screen).
// New messages come over the game's comments socket (/ws/games/:id/comments, the same one the
// comments use) and are sent as game comments (POST /games/:id/comments). The eye hides the
// chat to a pill counting new messages; the choice is kept on this phone.
(function () {
  var KEY = 'wknd-chat-hidden';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var item = function (c) { return '<div class="lc__m is-new" data-id="' + esc(c.id) + '"><span class="lc__av" style="--c:' + esc(c.color || '#5b6475') + '">' + esc(c.initials || '?') + '</span><span class="lc__b"><b' + ((c.playerId || c.player_id) ? ' data-pid="' + esc(c.playerId || c.player_id) + '"' : '') + '>' + esc(c.displayName) + '</b> ' + esc(c.body) + '</span></div>'; };
  var hiddenPref = function () { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

  function mount(el) {
    if (el._lc) return;
    el._lc = true;
    var list = el.querySelector('[data-lc-list]'), form = el.querySelector('[data-lc-form]'), tip = el.querySelector('[data-lc-tip]');
    var show = el.querySelector('[data-lc-show]'), badge = el.querySelector('[data-lc-new]');
    var unread = 0, ws = null, tipT = null;
    var scrollEnd = function () { list.scrollTop = list.scrollHeight; };
    var say = function (t) { tip.textContent = t; tip.hidden = false; clearTimeout(tipT); tipT = setTimeout(function () { tip.hidden = true; }, 3500); };
    var setHidden = function (h) {
      el.classList.toggle('is-hidden', h); show.hidden = !h;
      document.documentElement.classList.toggle('lc-off', h);
      if (!h) { unread = 0; badge.hidden = true; scrollEnd(); }
      try { localStorage.setItem(KEY, h ? '1' : '0'); } catch (e) {}
    };
    setHidden(hiddenPref());
    scrollEnd();
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-lc-hide]')) return setHidden(true);
      if (e.target.closest('[data-lc-show]')) return setHidden(false);
      var f = e.target.closest('[data-lc-fire]');
      if (f) {
        f.classList.remove('is-pop'); void f.offsetWidth; f.classList.add('is-pop');
        fetch(el.getAttribute('data-fire'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
          .then(function (r) { if (r.status === 401) location.href = el.getAttribute('data-login'); }).catch(function () {});
      }
    });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input'), body = input.value.trim();
      if (!body) return;
      input.disabled = true;
      fetch(el.getAttribute('data-post'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body }) })
        .then(function (r) {
          if (r.status === 401) { location.href = el.getAttribute('data-login'); return; }
          return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Not sent.'); input.value = ''; });
        })
        .catch(function (err) { say(err.message || 'Not sent. Try again.'); })
        .then(function () { input.disabled = false; input.focus(); });
    });
    // The game's comments, live: new ones join the bottom, deleted ones go.
    var connect = function () {
      if (!document.contains(el) || !window.WebSocket) return;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + el.getAttribute('data-ws')); } catch (e) { return; }
      ws.onmessage = function (m) {
        var d; try { d = JSON.parse(m.data); } catch (e) { return; }
        if (d.type === 'comment:new' && d.comment && !list.querySelector('[data-id="' + d.comment.id + '"]')) {
          list.insertAdjacentHTML('beforeend', item(d.comment));
          while (list.children.length > 60) list.removeChild(list.firstElementChild);
          if (el.classList.contains('is-hidden')) { unread++; badge.textContent = unread > 9 ? '9+' : String(unread); badge.hidden = false; }
          scrollEnd();
        } else if (d.type === 'presence') {
          // How many have the page open: shown from two (you alone isn't news).
          var w = el.querySelectorAll('[data-lc-watch]');
          for (var i = 0; i < w.length; i++) { w[i].hidden = !(d.count > 1); var n = w[i].querySelector('[data-lc-watch-n]'); if (n) n.textContent = d.count; }
        } else if (d.type === 'comment:delete') {
          var gone = list.querySelector('[data-id="' + d.id + '"]'); if (gone) gone.remove();
        }
      };
      ws.onclose = function () { ws = null; if (document.contains(el)) setTimeout(connect, 4000); };
    };
    connect();
    // A wide screen (the site's sidebar): it starts level with the game and stays below a sticky
    // header while the page scrolls.
    var wide = window.matchMedia ? matchMedia('(min-width: 1100px)') : null, page = document.querySelector('.gd-page');
    var place = function () {
      if (!wide || !wide.matches || !page) { el.style.top = ''; return; }
      var hdr = document.querySelector('header'), hb = 0;
      if (hdr) { var pos = getComputedStyle(hdr).position; if (pos === 'sticky' || pos === 'fixed') hb = hdr.getBoundingClientRect().bottom; }
      el.style.top = Math.max(hb + 12, page.getBoundingClientRect().top) + 'px';
    };
    place();
    window.addEventListener('scroll', place, { passive: true }); window.addEventListener('resize', place);
    // Leaving the screen (the app swaps screens): close the socket.
    var watch = setInterval(function () { if (!document.contains(el)) { clearInterval(watch); document.documentElement.classList.remove('lc-off'); if (ws) { ws.onclose = null; ws.close(); } } }, 2000);
  }
  function scan() { var els = document.querySelectorAll('[data-live-chat]'); for (var i = 0; i < els.length; i++) mount(els[i]); }
  window.wkndChat = { scan: scan };
  scan();
})();
