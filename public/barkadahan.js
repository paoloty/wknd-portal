// Barkadahan (views/app/barkadahan.js draws the shell; server.js "Barkadahan" block). Loaded by
// public/app.js on the screen only. Messages come from the page's bundle, then a fresh fetch;
// new ones, reactions, deletions, typing and the online count arrive over the app's live
// connection (public/app.js, the 'wknd:bk' event). Sending is a POST; a message that fails stays
// with "Not sent · Retry". Hold a message for reactions, Reply, Copy, Report, Delete and (admins)
// Mute. @ opens a list of players to mention. The 🙂 button opens a small emoji sheet.
(function () {
  var EMOJI = ['😀', '😁', '😂', '🤣', '😅', '😊', '😎', '🤔', '😮', '😢', '😡', '😴', '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👀', '🔥', '💯', '🎉', '❤️', '🏀', '⛹️', '🏆', '🥇', '⏰', '🚗', '🍕', '🍺'];
  var HOLD_MS = 450, GROUP_MS = 3 * 60 * 1000;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pref = { get: function (k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var post = function (url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Not sent. Try again.'); return j; }); });
  };
  var toast = function (t, tone) { if (window.wkndToast) window.wkndToast(t, tone); };
  var chevSvg = '<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5"/></svg>';
  var dayOf = function (ms) { return new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' }); };
  var timeOf = function (ms) { return new Date(ms).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }); };
  var todayStr = function () { return dayOf(Date.now()); };
  var onlyEmoji = function (s) { try { return /^[\p{Extended_Pictographic}‍️\s]{1,16}$/u.test(s) && Array.from(s.replace(/\s/g, '')).length <= 8; } catch (e) { return false; } };
  var avatar = function (m) {
    // The same markup as views/app/layout.js appAvatar.
    return '<span class="avatar-wrap bk-av"' + (m.pid ? ' data-pid="' + esc(m.pid) + '"' : '') + '><span class="avatar" style="--ring:' + esc(m.ring || 'var(--subtle)') + '">' + esc(m.initials || '?') + (m.photo ? '<img src="' + esc(m.photo) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span></span>';
  };

  // The room on screen now; its listeners on window/document/visualViewport come off when it's
  // gone (each visit used to leave a set behind: Fable audit, 2026-10-28).
  var current = null;
  function mount(el) {
    if (el._bk) return;
    el._bk = true;
    var offs = [];
    var on = function (target, ev, fn) { target.addEventListener(ev, fn); offs.push(function () { target.removeEventListener(ev, fn); }); };
    current = { el: el, off: function () { offs.forEach(function (f) { f(); }); offs = []; } };
    var B = JSON.parse(el.querySelector('[data-bk-bundle]').textContent);
    var me = B.me, list = el.querySelector('[data-bk-list]'), form = el.querySelector('[data-bk-form]'), input = el.querySelector('[data-bk-input]');
    var typingEl = el.querySelector('[data-bk-typing]'), replyEl = el.querySelector('[data-bk-reply]'), mentionEl = el.querySelector('[data-bk-mention]');
    var msgs = [], byId = {}, pending = [], replyTo = null, mentions = {}, loadingOld = false, noMore = false, typers = {}, readT = null;
    var nameOf = {}; B.people.forEach(function (p) { nameOf[p.pid] = p.name; });
    // Cards: { key: html } drawn by the server for this player; seen: who's seen the newest
    // message; attach: the card an admin is about to share.
    var cards = B.cards || {}, seen = B.seen || null, attach = null, attachEl = el.querySelector('[data-bk-attach]');

    // ── Drawing ──
    var bodyHtml = function (m) {
      var h = esc(m.body);
      (m.mentions || []).forEach(function (pid) { var n = nameOf[pid]; if (n) h = h.split('@' + esc(n)).join('<span class="bk-at">@' + esc(n) + '</span>'); });
      return h.replace(/\n/g, '<br>');
    };
    var rxHtml = function (m) {
      var keys = Object.keys(m.rx || {}).filter(function (k) { return m.rx[k].length; });
      if (!keys.length) return '';
      return '<div class="bk-rx">' + keys.map(function (k) { var mine = m.rx[k].indexOf(me.pid) !== -1; return '<button type="button" class="bk-rx__b' + (mine ? ' is-mine' : '') + '" data-bk-rx="' + esc(k) + '" aria-pressed="' + mine + '" aria-label="' + esc(k) + ' ' + m.rx[k].length + '">' + k + ' <b class="num">' + m.rx[k].length + '</b></button>'; }).join('') + '</div>';
    };
    function msgHtml(m, prev) {
      var mine = m.pid === me.pid;
      var cont = prev && prev.pid === m.pid && !prev.deleted && m.at - prev.at < GROUP_MS && dayOf(prev.at) === dayOf(m.at) && !m.reply;
      var emo = !m.deleted && onlyEmoji(m.body);
      var bubble = m.deleted ? '<div class="bk-bub is-del">Message deleted</div>'
        : (m.body || m.reply ? '<div class="bk-bub' + (emo ? ' is-emo' : '') + '" data-bk-hold>' + (m.reply ? '<span class="bk-q"><b>' + esc(m.reply.name) + '</b>' + esc(m.reply.body) + '</span>' : '') + bodyHtml(m) + '</div>' : '')
          + (m.card ? '<div class="bk-cardw" data-bk-card="' + esc(m.card) + '" data-bk-hold>' + (cards[m.card] || '<div class="bkc is-loading" aria-busy="true"></div>') + '</div>' : '');
      var state = m.pending ? '<span class="bk-st">' + (m.failed ? 'Not sent · <button type="button" data-bk-retry>Retry</button>' : 'Sending…') + '</span>' : '';
      return '<div class="bk-m' + (mine ? ' is-me' : '') + (cont ? ' is-cont' : '') + '" data-id="' + esc(m.id) + '">'
        + (mine || cont ? '' : avatar(m))
        + '<div class="bk-m__b">' + (mine || cont ? '' : '<div class="bk-who"><span class="dot" style="--c:' + esc(m.ring || 'var(--subtle)') + '"></span><b data-pid="' + esc(m.pid) + '">' + esc(m.name) + '</b><span>' + esc(timeOf(m.at)) + '</span></div>')
        + bubble + rxHtml(m) + state + '</div></div>';
    }
    var nearBottom = function () { return list.scrollHeight - list.scrollTop - list.clientHeight < 80; };
    var toBottom = function () { list.scrollTop = list.scrollHeight; };
    function draw(keep) {
      var atEnd = nearBottom(), oldH = list.scrollHeight, oldTop = list.scrollTop;
      var all = msgs.concat(pending), out = [], lastDay = '';
      if (noMore || !msgs.length) out.push('<p class="bk-start">' + (msgs.length ? 'That’s everything from the last 30 days.' : 'No messages yet. Say hi to the barkada.') + '</p>');
      all.forEach(function (m, i) {
        var d = dayOf(m.at);
        if (d !== lastDay) { out.push('<div class="bk-day">' + (d === todayStr() ? 'Today' : esc(d)) + '</div>'); lastDay = d; }
        out.push(msgHtml(m, all[i - 1] && dayOf(all[i - 1].at) === d ? all[i - 1] : null));
      });
      out.push(seenHtml());
      list.innerHTML = out.join('');
      tickClocks();
      if (keep === 'top') list.scrollTop = list.scrollHeight - oldH + oldTop;
      else if (keep === 'stay' && !atEnd) list.scrollTop = oldTop;
      else toBottom();
    }
    function setAll(arr) { msgs = arr; byId = {}; msgs.forEach(function (m) { byId[m.id] = m; }); }
    // Adds what's new and takes the latest copy of what's known, never drops: a fresh page
    // replacing the list lost older pages already loaded and live messages that came in between.
    function merge(arr) {
      var seen = {};
      var all = msgs.map(function (m) { return m; });
      arr.forEach(function (m) { seen[m.id] = 1; });
      all = all.filter(function (m) { return !seen[m.id]; }).concat(arr);
      all.sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); });
      pending = pending.filter(function (p) { return !arr.some(function (m) { return m.cid && m.cid === p.id; }); });
      setAll(all);
    }
    // Live changes touch only their own messages (and the one after, whose grouping can change)
    // instead of redrawing the room (40–50 ms per reaction with 100 messages, re-read by
    // screen readers).
    var nodeOf = function (id) { return list.querySelector('.bk-m[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); };
    function patch(id) {
      var i = -1; for (var k = 0; k < msgs.length; k++) if (msgs[k].id === id) { i = k; break; }
      var n = nodeOf(id); if (i < 0 || !n) return draw('stay');
      [i, i + 1].forEach(function (j) {
        var m = msgs[j], node = m && nodeOf(m.id); if (!node) return;
        var prev = msgs[j - 1] && dayOf(msgs[j - 1].at) === dayOf(m.at) ? msgs[j - 1] : null;
        node.insertAdjacentHTML('afterend', msgHtml(m, prev)); node.remove();
      });
    }
    function append(m) {
      var prev = msgs[msgs.length - 2], last = list.lastElementChild;
      // Only the simple case: nothing waiting to send, same day as the one before it.
      if (pending.length || !prev || !last || dayOf(prev.at) !== dayOf(m.at) || !nodeOf(prev.id)) return false;
      var atEnd = nearBottom();
      list.insertAdjacentHTML('beforeend', msgHtml(m, prev));
      paintSeen(); tickClocks();
      if (atEnd || m.pid === me.pid) toBottom();
      return true;
    }

    // ── Seen: under the newest message only, "Seen by" + up to 5 faces + the rest ──
    function seenHtml() {
      var last = msgs[msgs.length - 1];
      if (!seen || !last || pending.length || last.id !== seen.id) return '';
      var ids = (seen.ids || []).filter(function (id) { return id !== me.pid; });
      if (!ids.length) return '';
      var faces = (seen.faces || []).filter(function (f) { return f.pid !== me.pid; }).slice(0, 5);
      return '<button type="button" class="bk-seen" data-bk-seen="' + esc(seen.id) + '" aria-label="Seen by ' + ids.length + '. Show who"><span>Seen by</span><span class="bk-seen__f" aria-hidden="true">' + faces.map(avatar).join('') + '</span>'
        + (ids.length > faces.length ? '<span class="num">+' + (ids.length - faces.length) + '</span>' : '') + '</button>';
    }
    function paintSeen() {
      var old = list.querySelector('.bk-seen'); if (old) old.remove();
      var h = seenHtml(); if (!h) return;
      var atEnd = nearBottom();
      list.insertAdjacentHTML('beforeend', h);
      if (atEnd) toBottom();
    }

    // ── Cards ──
    var cardKeys = function () { var k = {}; msgs.concat(pending).forEach(function (m) { if (m.card && !m.deleted) k[m.card] = 1; }); return Object.keys(k); };
    function paintCard(key) {
      list.querySelectorAll('[data-bk-card]').forEach(function (n) { if (n.getAttribute('data-bk-card') === key && cards[key]) { n.innerHTML = cards[key]; n.classList.remove('is-busy'); } });
    }
    function takeCards(c) { if (!c) return; Object.keys(c).forEach(function (k) { cards[k] = c[k]; paintCard(k); }); tickClocks(); }
    var cardsBusy = {};
    function fetchCards(keys) {
      keys = keys.filter(function (k) { return !cardsBusy[k]; });
      if (!keys.length || !navigator.onLine) return;
      keys.forEach(function (k) { cardsBusy[k] = 1; });
      fetch('/app/barkadahan/cards?keys=' + keys.map(encodeURIComponent).join(','), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { keys.forEach(function (k) { delete cardsBusy[k]; }); if (j && el.isConnected) takeCards(j.cards); else keys.forEach(paintCard); },
          function () { keys.forEach(function (k) { delete cardsBusy[k]; paintCard(k); }); });
    }
    // "Closes in 3h 20m" on open Who wins? cards; at the cut-off the card is fetched again.
    var closeIn = function (ms) {
      var m = Math.ceil(ms / 6e4), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24;
      return 'Closes in ' + (d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + 'm');
    };
    function tickClocks() {
      var due = [];
      list.querySelectorAll('[data-bk-close-at]').forEach(function (c) {
        var left = Number(c.getAttribute('data-bk-close-at')) - Date.now();
        if (left > 0) c.textContent = closeIn(left);
        else { c.textContent = 'Picks closed'; var w = c.closest('[data-bk-card]'); if (w) due.push(w.getAttribute('data-bk-card')); }
      });
      if (due.length) fetchCards(due);
    }
    // Every 30 s: the clocks; every 2 minutes: the cards themselves (a change made somewhere the
    // live connection doesn't hear about, like an admin moving someone on a run).
    var ticks = 0, cardTimer = setInterval(function () {
      if (!el.isConnected) return current && current.el === el ? current.off() : null;
      if (document.visibilityState !== 'visible') return;
      tickClocks();
      if (++ticks % 4 === 0) fetchCards(cardKeys());
    }, 30000);
    offs.push(function () { clearInterval(cardTimer); });
    function setAttach(a) {
      attach = a;
      attachEl.hidden = !a;
      attachEl.innerHTML = a ? '<span><b>Sharing</b>' + esc(a.title) + (a.sub ? ' · ' + esc(a.sub) : '') + '</span><button type="button" data-bk-noattach aria-label="Don’t share it">×</button>' : '';
      if (a && input) input.focus();
    }
    setAll(B.messages); draw();
    // The keyboard: the room is pinned to the part of the screen you can see (the visual
    // viewport), so the box sits right on the keyboard and the newest messages stay in sight.
    // iPhone doesn't shrink the page for the keyboard; it slides what you see up instead, so
    // shrinking the room left the box in the middle of the screen (Paolo, 2026-10-27). Pinned
    // to the visible area's top and height, it follows that slide.
    var vv = window.visualViewport;
    if (vv) {
      el.classList.add('is-pinned');
      // Once a frame at most, and only for real moves: iOS reports the keyboard's slide in
      // small steps, and following every one made the box jump (Paolo, 2026-10-27).
      // fullH: the tallest the visible area has been (no keyboard). Not window.innerHeight: on
      // iPhone that shrinks with the keyboard too, so the home-bar gap never went (Paolo's
      // screenshot, 2026-10-27).
      // A new width (the phone turned) starts fullH again, or landscape counted as "keyboard up".
      var raf = 0, lastTop = -1, lastH = -1, fullH = 0, lastW = 0;
      var apply = function () {
        raf = 0;
        if (!el.isConnected) return current && current.el === el ? current.off() : null;
        var top = Math.max(0, Math.round(vv.offsetTop)), h = Math.round(vv.height), w = Math.round(vv.width);
        if (Math.abs(w - lastW) > 40) { fullH = 0; lastW = w; }
        fullH = Math.max(fullH, h);
        if (Math.abs(top - lastTop) < 2 && Math.abs(h - lastH) < 2) return;
        var near = nearBottom();
        lastTop = top; lastH = h;
        el.style.transform = top ? 'translate3d(0,' + top + 'px,0)' : '';
        el.style.height = h + 'px';
        // The keyboard covers the home bar: no bottom inset while it's up.
        el.classList.toggle('is-kb', h < fullH - 120);
        if (near) toBottom();
      };
      var fit = function () { if (!raf) raf = requestAnimationFrame(apply); };
      on(vv, 'resize', fit);
      on(vv, 'scroll', fit);
      apply();
    }

    // A fresh copy (the page may have come from the phone's copy), merged in.
    fetch('/app/barkadahan/messages', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && el.isConnected) { Object.keys(j.cards || {}).forEach(function (k) { cards[k] = j.cards[k]; }); if (j.seen !== undefined) seen = j.seen; merge(j.messages); draw('stay'); setOnline(j.online); } }).catch(function () {});

    // Older messages when scrolled to the top.
    list.addEventListener('scroll', function () {
      if (list.scrollTop > 60 || loadingOld || noMore || !msgs.length) return;
      loadingOld = true;
      fetch('/app/barkadahan/messages?before=' + msgs[0].at + '&id=' + encodeURIComponent(msgs[0].id), { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (j) {
        loadingOld = false;
        if (!j.messages.length) { noMore = true; draw('top'); return; }
        Object.keys(j.cards || {}).forEach(function (k) { cards[k] = j.cards[k]; });
        setAll(j.messages.concat(msgs)); draw('top');
      }).catch(function () { loadingOld = false; });
    });

    var setOnline = function (n) { if (n == null) return; el.querySelectorAll('[data-bk-online]').forEach(function (x) { x.textContent = n; }); };
    // The read mark is the room's own (opening it, a message coming in while it's open, coming
    // back to it); the page's GET doesn't write, since it's also a prefetch.
    var markRead = function (now) {
      clearTimeout(readT);
      readT = setTimeout(function () { if (document.visibilityState === 'visible' && el.isConnected) post('/app/barkadahan/read').then(function () { if (window.wkndBkSync) window.wkndBkSync(); }, function () {}); }, now ? 0 : 1500);
    };
    markRead(true);

    // ── Live: from the app's connection ──
    function onLive(e) {
      if (!el.isConnected) return current && current.el === el ? current.off() : null;
      var d = e.detail || {};
      if (d.type === 'online') setOnline(d.n);
      if (d.type === 'msg' && d.m) {
        // Your own, coming back: it replaces its "Sending…" copy (matched by the phone's id).
        var had = pending.length;
        if (d.m.cid) pending = pending.filter(function (p) { return p.id !== d.m.cid; });
        if (!byId[d.m.id]) {
          msgs.push(d.m); byId[d.m.id] = d.m;
          if (had !== pending.length || !append(d.m)) { var atEnd = nearBottom(); draw(d.m.pid === me.pid || atEnd ? '' : 'stay'); }
        } else if (had !== pending.length) draw();
        delete typers[d.m.pid]; paintTyping();
        if (d.m.pid !== me.pid) markRead();
        if (d.m.card && !cards[d.m.card]) fetchCards([d.m.card]);
      }
      if (d.type === 'seen') { seen = d.seen; paintSeen(); }
      if (d.type === 'card' && cardKeys().indexOf(d.key) !== -1) fetchCards([d.key]);
      if (d.type === 'rx' && byId[d.id]) { byId[d.id].rx = d.rx; patch(d.id); }
      if (d.type === 'del' && byId[d.id]) { byId[d.id].deleted = true; byId[d.id].body = ''; byId[d.id].rx = {}; patch(d.id); }
      if (d.type === 'typing' && d.pid !== me.pid) { typers[d.pid] = { name: d.name, until: Date.now() + 4000 }; paintTyping(); setTimeout(paintTyping, 4100); }
    }
    on(window, 'wknd:bk', onLive);
    function paintTyping() {
      var now = Date.now(), names = Object.keys(typers).filter(function (k) { return typers[k].until > now; }).map(function (k) { return typers[k].name; });
      typingEl.textContent = !names.length ? '' : names.length === 1 ? names[0] + ' is typing…' : names.length === 2 ? names[0] + ' and ' + names[1] + ' are typing…' : 'A few people are typing…';
    }

    // ── Sending ──
    function send(text) {
      // id: also the phone's id for the send (cid), so a retry is stored once and the live
      // copy of it replaces this one.
      var p = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), pid: me.pid, at: Date.now(), body: text, mentions: Object.keys(mentions).filter(function (k) { return text.indexOf('@' + mentions[k]) !== -1; }), reply: replyTo ? { id: replyTo.id, name: replyTo.name, body: replyTo.body } : null, rx: {}, pending: true, card: attach ? attach.key : null };
      p.replyTo = replyTo && replyTo.id;
      pending.push(p); draw();
      deliver(p);
      mentions = {}; setReply(null); setAttach(null);
    }
    function deliver(p) {
      p.failed = false; draw('stay');
      post('/app/barkadahan/messages', { body: p.body, replyTo: p.replyTo || null, mentions: p.mentions, cid: p.id, card: p.card || undefined }).then(function (j) {
        Object.keys(j.cards || {}).forEach(function (k) { cards[k] = j.cards[k]; });
        pending = pending.filter(function (x) { return x !== p; });
        if (!byId[j.m.id]) { msgs.push(j.m); byId[j.m.id] = j.m; }
        draw();
      }, function (err) { if (pending.indexOf(p) === -1) return; p.failed = true; draw('stay'); toast(err.message, 'err'); });
    }
    if (form) {
      var grow = function () { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = input.value.trim(); if (!text && !attach) return;
        input.value = ''; grow(); closeMention(); send(text); input.focus();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && mentionEl.hidden) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
      });
      var lastTyping = 0;
      input.addEventListener('input', function () {
        grow(); checkMention();
        if (Date.now() - lastTyping > 2500 && input.value.trim() && window.wkndAppSocket) { lastTyping = Date.now(); window.wkndAppSocket.send({ type: 'typing' }); }
      });
    }
    function setReply(m) {
      replyTo = m;
      replyEl.hidden = !m;
      replyEl.innerHTML = m ? '<span><b>Replying to ' + esc(m.name) + '</b>' + esc(m.body ? m.body.slice(0, 80) : m.card ? 'Shared a card' : '') + '</span><button type="button" data-bk-noreply aria-label="Cancel reply">×</button>' : '';
      if (m && input) input.focus();
    }

    // ── @mentions ──
    function checkMention() {
      var upto = input.value.slice(0, input.selectionStart), m = /(^|\s)@([^\s@]{0,20}(?: [^\s@]{0,20})?)$/.exec(upto);
      if (!m) return closeMention();
      var q = m[2].toLowerCase();
      var hits = B.people.filter(function (p) { if (p.pid === me.pid) return false; var n = p.name.toLowerCase(); return !q || n.indexOf(q) === 0 || n.split(' ').some(function (w) { return w.indexOf(q) === 0; }); }).slice(0, 6);
      if (!hits.length) return closeMention();
      mentionEl.innerHTML = hits.map(function (p) { return '<button type="button" role="option" data-bk-mention-pick="' + esc(p.pid) + '">@' + esc(p.name) + '</button>'; }).join('');
      mentionEl.hidden = false; mentionEl._at = upto.length - m[2].length - 1;
    }
    function closeMention() { mentionEl.hidden = true; mentionEl.innerHTML = ''; }

    // ── Hold a message: reactions and actions ──
    var sheet = null;
    function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
    function openMenu(m) {
      closeSheet();
      // The keyboard goes first, so the sheet opens on a screen that isn't moving.
      if (input && document.activeElement === input) input.blur();
      if (emoSheet) { emoSheet.remove(); emoSheet = null; }
      var mine = m.pid === me.pid, acts = [];
      var nRx = Object.keys(m.rx || {}).reduce(function (n, k) { return n + m.rx[k].length; }, 0);
      if (nRx) acts.push(['who-rx', 'Reactions', '', Object.keys(m.rx).filter(function (k) { return m.rx[k].length; }).join(' ') + ' · ' + nRx]);
      if (!m.pending) acts.push(['who-seen', 'Seen by']);
      if (!me.cant) acts.push(['reply', 'Reply']);
      if (m.body) acts.push(['copy', 'Copy']);
      if (!mine) acts.push(['report', 'Report']);
      if (mine || me.mod) acts.push(['delete', 'Delete', 'red']);
      if (me.mod && !mine) acts.push(['mute', 'Mute ' + m.name + '…']);
      sheet = document.createElement('div');
      sheet.className = 'bk-hold'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Message actions');
      sheet.innerHTML = '<div class="bk-hold__in">' + (me.cant ? '' : '<div class="bk-hold__rx">' + B.reactions.map(function (r) { var on = (m.rx[r] || []).indexOf(me.pid) !== -1; return '<button type="button" class="' + (on ? 'is-on' : '') + '" data-bk-react="' + r + '" aria-label="React ' + r + '">' + r + '</button>'; }).join('') + '</div>')
        + '<div class="bk-hold__msg">' + (m.reply ? '<span class="bk-q"><b>' + esc(m.reply.name) + '</b>' + esc(m.reply.body) + '</span>' : '') + (m.body ? bodyHtml(m) : m.card ? '<i>Shared a card</i>' : '') + '</div>'
        + '<div class="bk-hold__acts">' + acts.map(function (a) { return '<button type="button" class="' + (a[2] || '') + '" data-bk-act="' + a[0] + '">' + esc(a[1]) + (/^who/.test(a[0]) ? '<span class="bk-hold__r">' + esc(a[3] || '') + chevSvg + '</span>' : '') + '</button>'; }).join('') + '</div></div>';
      sheet._m = m;
      el.appendChild(sheet);
    }
    // A list sheet in the same place as the hold menu: title, optional tabs, rows.
    function listSheet(title, label) {
      closeSheet();
      if (input && document.activeElement === input) input.blur();
      if (emoSheet) { emoSheet.remove(); emoSheet = null; }
      sheet = document.createElement('div');
      sheet.className = 'bk-hold'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', label || title);
      sheet.innerHTML = '<div class="bk-hold__in bk-sheet"><div class="bk-sheet__h"><b>' + esc(title) + '</b><small data-bk-sheet-n></small></div><div class="bk-sheet__body" data-bk-sheet-body><p class="bk-sheet__empty">Loading…</p></div></div>';
      el.appendChild(sheet);
      return sheet;
    }
    var personRow = function (p, right, rightCls) {
      return '<div class="bk-row" data-pid="' + esc(p.pid) + '">' + avatar(p) + '<span class="bk-row__t">' + esc(p.pid === me.pid ? 'You' : p.full || p.name) + '<small>' + esc(p.team || 'No team') + '</small></span><span class="bk-row__v' + (rightCls ? ' ' + rightCls : '') + '">' + right + '</span></div>';
    };
    var seenAt = function (ms) { return dayOf(ms) === todayStr() ? timeOf(ms) : dayOf(ms).replace(/^\w+, /, ''); };
    // Who reacted (tabs: All, then one per emoji) or who's seen it, for one message.
    function openWho(m, kind, only) {
      var sh = listSheet(kind === 'rx' ? 'Reactions' : 'Seen by');
      fetch('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/who', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Couldn’t load that. Try again.'); return j; }); })
        .then(function (j) {
          if (sheet !== sh) return;
          var body = sh.querySelector('[data-bk-sheet-body]'), n = sh.querySelector('[data-bk-sheet-n]');
          if (kind === 'seen') {
            var rows = j.seen.filter(function (p) { return p.pid !== me.pid; });
            n.textContent = rows.length || '';
            body.innerHTML = rows.length ? '<div class="bk-sheet__list">' + rows.map(function (p) { return personRow(p, esc(seenAt(p.at))); }).join('') + '</div>'
              : '<p class="bk-sheet__empty">Nobody else has opened the chat since this came in.</p>';
            return;
          }
          var paint = function (pick) {
            var emo = []; j.rx.forEach(function (r) { if (emo.indexOf(r.emoji) === -1) emo.push(r.emoji); });
            var rows = pick ? j.rx.filter(function (r) { return r.emoji === pick; }) : j.rx;
            n.textContent = j.rx.length || '';
            body.innerHTML = (emo.length > 1 ? '<div class="bk-sheet__tabs" role="tablist">' + ['' ].concat(emo).map(function (e) {
              var c = e ? j.rx.filter(function (r) { return r.emoji === e; }).length : j.rx.length;
              return '<button type="button" role="tab" aria-selected="' + (e === (pick || '')) + '" class="' + (e === (pick || '') ? 'is-on' : '') + '" data-bk-tab="' + esc(e) + '">' + (e || 'All') + ' <b class="num">' + c + '</b></button>';
            }).join('') + '</div>' : '')
              + (rows.length ? '<div class="bk-sheet__list">' + rows.map(function (r) { return personRow(r, r.emoji, 'is-emo'); }).join('') + '</div>' : '<p class="bk-sheet__empty">No reactions yet.</p>');
          };
          sh._tab = paint;
          paint(only && j.rx.some(function (r) { return r.emoji === only; }) ? only : '');
        })
        .catch(function (err) { if (sheet === sh) sh.querySelector('[data-bk-sheet-body]').innerHTML = '<p class="bk-sheet__empty">' + esc(err.message || 'No connection.') + '</p>'; });
    }
    // A person's menu (a face or name tapped in the room or its lists): View profile, Mention,
    // and Mute for admins. Who they are comes from their messages, else the people list.
    function personMenu(pid) {
      var m = null; for (var k = msgs.length - 1; k >= 0; k--) if (msgs[k].pid === pid) { m = msgs[k]; break; }
      var full = (m && m.full) || nameOf[pid] || 'Player', short = (m && m.name) || full;
      var p = m || { pid: pid, initials: full.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2), ring: '', photo: '' };
      closeSheet();
      if (input && document.activeElement === input) input.blur();
      if (emoSheet) { emoSheet.remove(); emoSheet = null; }
      var self = pid === me.pid, acts = [['profile', self ? 'View your profile' : 'View profile']];
      if (!self && !me.cant && nameOf[pid]) acts.push(['mention', 'Mention @' + nameOf[pid]]);
      if (!self && me.mod) acts.push(['mute', 'Mute ' + short + '…']);
      sheet = document.createElement('div');
      sheet.className = 'bk-hold'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', full);
      sheet._m = { pid: pid, name: nameOf[pid] || full, short: short };
      sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg bk-pm">' + avatar(p).replace(' data-pid=', ' data-self=') + '<span><b>' + esc(full) + '</b>' + (m && m.team ? '<small>' + esc(m.team) + '</small>' : '') + '</span></div>'
        + '<div class="bk-hold__acts">' + acts.map(function (a) { return '<button type="button" data-bk-pm="' + a[0] + '">' + esc(a[1]) + '</button>'; }).join('') + '</div></div>';
      el.appendChild(sheet);
    }
    // Admins: what's open right now, to share as a card.
    function openShare() {
      var sh = listSheet('Share to the chat');
      sh.querySelector('[data-bk-sheet-n]').textContent = 'Admins only';
      fetch('/app/barkadahan/share', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Couldn’t load that. Try again.'); return j; }); })
        .then(function (j) { if (sheet === sh) sh.querySelector('[data-bk-sheet-body]').innerHTML = j.html + '<p class="bk-sheet__foot">Pick one and add a line if you like. Players join or pick right on the card.</p>'; })
        .catch(function (err) { if (sheet === sh) sh.querySelector('[data-bk-sheet-body]').innerHTML = '<p class="bk-sheet__empty">' + esc(err.message || 'No connection.') + '</p>'; });
    }
    // Asks first (cancel a spot, a claim that can't be cancelled), in the hold menu's place.
    function ask(text, yes, go) {
      closeSheet();
      sheet = document.createElement('div'); sheet.className = 'bk-hold'; sheet._go = go;
      sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg">' + esc(text) + '</div><div class="bk-hold__acts"><button type="button" data-bk-ask-go="yes">' + esc(yes) + '</button><button type="button" data-bk-ask-go="no">Not now</button></div></div>';
      el.appendChild(sheet);
    }
    // A card's own buttons: the site's own routes, then the card is drawn again.
    function cardBusy(w, on) { w.classList.toggle('is-busy', on); w.querySelectorAll('button').forEach(function (b) { b.disabled = on; }); }
    function papawisAct(b) {
      var w = b.closest('[data-bk-card]'), key = w.getAttribute('data-bk-card'), act = b.getAttribute('data-bk-pw'), run = b.getAttribute('data-bk-run');
      if (!navigator.onLine) return toast('You’re offline. This needs a connection, so nothing was sent.', 'err');
      var go = function () {
        cardBusy(w, true);
        post('/papawis/' + encodeURIComponent(run) + '/' + act, {}).then(function (j) {
          toast(act === 'cancel' ? 'You’re off the list' : j.status === 'waitlist' ? 'You’re on the waitlist' : j.status === 'pending' ? 'You’re listed · send your deposit to confirm' : 'You’re in!', act === 'cancel' ? '' : 'ok');
          fetchCards([key]);
        }, function (err) { toast(err.message, 'err'); fetchCards([key]); });
      };
      var q = b.getAttribute('data-bk-ask');
      if (q) return ask(q, act === 'cancel' ? (b.textContent.trim() === 'Leave' ? 'Leave the waitlist' : 'Cancel my spot') : 'Claim it', go);
      go();
    }
    function pickAct(b) {
      var w = b.closest('[data-bk-card]'), card = b.closest('[data-bk-pick]'), key = w.getAttribute('data-bk-card'), side = b.getAttribute('data-side');
      if (b.disabled || b.classList.contains('is-mine') || w.classList.contains('is-busy')) return;
      if (!navigator.onLine) return toast('You’re offline. Picks need a connection, so nothing was sent.', 'err');
      card.querySelectorAll('.pick__opt').forEach(function (o) { o.classList.toggle('is-mine', o === b); });
      cardBusy(w, true);
      post('/games/' + encodeURIComponent(card.getAttribute('data-bk-pick')) + '/pick', { side: side }).then(function () {
        toast('Picked ' + card.getAttribute('data-pick-' + side), 'ok');
        fetchCards([key]);
      }, function (err) { toast(err.message, 'err'); fetchCards([key]); });
    }
    // The menu opens when the finger lifts after a hold, not while it's still down: opened
    // under the finger, the lift landed on the sheet and pressed whatever was there (Report, or
    // Delete for an admin) or on its backdrop, which closed it again: the "unstable" menu (Fable
    // audit, 2026-10-28). The bubble dims once the hold counts, so you know to let go.
    var holdT = null, holdAt = null, held = null, quietUntil = 0;
    var cancelHold = function () { clearTimeout(holdT); holdT = null; if (held) { held.b.classList.remove('is-held'); held = null; } };
    // Holding a reaction pill lists who reacted with it (a tap still adds or takes back yours).
    list.addEventListener('pointerdown', function (e) {
      var rxb = e.target.closest('[data-bk-rx]');
      var b = rxb || e.target.closest('[data-bk-hold]'); if (!b) return;
      cancelHold();
      holdAt = { x: e.clientX, y: e.clientY };
      holdT = setTimeout(function () {
        holdT = null;
        var id = b.closest('[data-id]').getAttribute('data-id');
        if (byId[id]) { held = { b: b, m: byId[id], rx: rxb ? rxb.getAttribute('data-bk-rx') : null }; b.classList.add('is-held'); if (navigator.vibrate) navigator.vibrate(10); }
      }, HOLD_MS);
    });
    var release = function () {
      if (!held) return cancelHold();
      var m = held.m, rx = held.rx; cancelHold();
      quietUntil = Date.now() + 400; // the click that follows this lift
      if (rx) openWho(m, 'rx', rx); else openMenu(m);
    };
    list.addEventListener('pointerup', release);
    // iPhone can cancel a still finger at the end of a long press: that's still a hold.
    list.addEventListener('pointercancel', function () { if (held) release(); else cancelHold(); });
    list.addEventListener('pointermove', function (e) { if ((holdT || held) && holdAt && Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 10) cancelHold(); });
    list.addEventListener('contextmenu', function (e) { if (e.target.closest('[data-bk-hold]')) e.preventDefault(); });

    // One at a time per message: a double tap toggled it on and straight off again.
    var react = function (m, emoji) {
      if (!m || m.deleted || me.cant || m._rxBusy) return;
      m._rxBusy = true;
      post('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/react', { emoji: emoji }).then(function (j) { m._rxBusy = false; m.rx = j.rx; patch(m.id); }, function (err) { m._rxBusy = false; toast(err.message, 'err'); });
    };

    // ── Emoji sheet ──
    var emoSheet = null;
    function toggleEmoji() {
      if (emoSheet) { emoSheet.remove(); emoSheet = null; return; }
      var recent = (pref.get('wknd-bk-emoji', '') || '').split(',').filter(Boolean).slice(0, 8);
      var grid = function (arr) { return '<div class="bk-emo__grid">' + arr.map(function (x) { return '<button type="button" data-bk-emo="' + x + '" aria-label="' + x + '">' + x + '</button>'; }).join('') + '</div>'; };
      emoSheet = document.createElement('div');
      emoSheet.className = 'bk-emo';
      emoSheet.innerHTML = (recent.length ? '<span class="bk-emo__l">Recent</span>' + grid(recent) : '') + '<span class="bk-emo__l">All</span>' + grid(EMOJI);
      form.parentNode.insertBefore(emoSheet, form);
    }
    function insertText(t) {
      var s = input.selectionStart, e = input.selectionEnd;
      input.value = input.value.slice(0, s) + t + input.value.slice(e);
      input.selectionStart = input.selectionEnd = s + t.length;
      input.dispatchEvent(new Event('input'));
    }

    el.addEventListener('click', function (e) {
      var t = e.target;
      // The click that follows a hold's lift lands on what was under the finger (the menu, a
      // reaction pill, a card's button or link): it never counts.
      if (Date.now() < quietUntil) { e.preventDefault(); e.stopPropagation(); return; }
      // A face or name here opens a small menu, not the profile straight away (Paolo, 2026-10-29).
      var pf = t.closest('[data-pid]');
      if (pf && !t.closest('button:not(.bk-row), a')) { e.preventDefault(); return personMenu(pf.getAttribute('data-pid')); }
      var pm = t.closest('[data-bk-pm]');
      if (pm && sheet) {
        var who = sheet._m; closeSheet();
        var act2 = pm.getAttribute('data-bk-pm');
        if (act2 === 'profile') { var a2 = document.createElement('a'); a2.href = '/app/players/' + encodeURIComponent(who.pid); el.appendChild(a2); a2.click(); a2.remove(); return; }
        if (act2 === 'mention' && input) {
          var at = input.value && !/\s$/.test(input.value) ? ' ' : '';
          input.value += at + '@' + who.name + ' '; mentions[who.pid] = who.name; input.dispatchEvent(new Event('input')); input.focus(); return;
        }
        if (act2 === 'mute') {
          sheet = document.createElement('div'); sheet.className = 'bk-hold'; sheet._m = { pid: who.pid, name: who.short };
          sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg">Mute ' + esc(who.short) + ' in the Barkadahan? They can still read.</div><div class="bk-hold__acts"><button type="button" data-bk-mute="1">For a day</button><button type="button" data-bk-mute="7">For a week</button><button type="button" data-bk-mute="cancel">Cancel</button></div></div>';
          el.appendChild(sheet); return;
        }
        return;
      }
      var rxb = t.closest('[data-bk-rx]'); if (rxb) return react(byId[rxb.closest('[data-id]').getAttribute('data-id')], rxb.getAttribute('data-bk-rx'));
      var pwb = t.closest('[data-bk-pw]'); if (pwb && !pwb.disabled) return papawisAct(pwb);
      var pkb = t.closest('[data-bk-pick] .pick__opt'); if (pkb) return pickAct(pkb);
      var sn = t.closest('[data-bk-seen]'); if (sn && byId[sn.getAttribute('data-bk-seen')]) return openWho(byId[sn.getAttribute('data-bk-seen')], 'seen');
      if (t.closest('[data-bk-share]')) return openShare();
      var sp = t.closest('[data-bk-share-pick]');
      if (sp) { closeSheet(); return setAttach({ key: sp.getAttribute('data-bk-share-pick'), title: sp.getAttribute('data-title'), sub: sp.getAttribute('data-sub') }); }
      if (t.closest('[data-bk-noattach]')) return setAttach(null);
      var tab = t.closest('[data-bk-tab]'); if (tab && sheet && sheet._tab) return sheet._tab(tab.getAttribute('data-bk-tab'));
      var ag = t.closest('[data-bk-ask-go]');
      if (ag && sheet) { var go = sheet._go; closeSheet(); if (ag.getAttribute('data-bk-ask-go') === 'yes' && go) go(); return; }
      if (t.closest('[data-bk-retry]')) { var id = t.closest('[data-id]').getAttribute('data-id'); var p = pending.filter(function (x) { return x.id === id; })[0]; if (p) deliver(p); return; }
      if (t.closest('[data-bk-noreply]')) return setReply(null);
      if (t.closest('[data-bk-emoji]')) return toggleEmoji();
      var emo = t.closest('[data-bk-emo]');
      if (emo) {
        var x = emo.getAttribute('data-bk-emo'); insertText(x);
        var rec = [x].concat((pref.get('wknd-bk-emoji', '') || '').split(',').filter(function (y) { return y && y !== x; })).slice(0, 8);
        pref.set('wknd-bk-emoji', rec.join(','));
        return;
      }
      var pick = t.closest('[data-bk-mention-pick]');
      if (pick) {
        var pid = pick.getAttribute('data-bk-mention-pick'), name = nameOf[pid], at = mentionEl._at;
        var caret = input.selectionStart;
        input.value = input.value.slice(0, at) + '@' + name + ' ' + input.value.slice(caret);
        input.selectionStart = input.selectionEnd = at + name.length + 2;
        mentions[pid] = name; closeMention(); input.focus();
        return;
      }
      if (sheet && (t === sheet || t.closest('.bk-hold') && !t.closest('.bk-hold__in'))) return closeSheet();
      var r = t.closest('[data-bk-react]'); if (r && sheet) { var m0 = sheet._m; closeSheet(); return react(m0, r.getAttribute('data-bk-react')); }
      var a = t.closest('[data-bk-act]');
      if (a && sheet) {
        var m = sheet._m, act = a.getAttribute('data-bk-act'); closeSheet();
        if (act === 'who-rx') return openWho(m, 'rx');
        if (act === 'who-seen') return openWho(m, 'seen');
        if (act === 'reply') return setReply(m);
        if (act === 'copy') { try { navigator.clipboard.writeText(m.body).then(function () { toast('Copied'); }); } catch (x2) {} return; }
        if (act === 'report') return post('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/report', {}).then(function (j) { toast(j.message || 'Reported'); }, function (err) { toast(err.message, 'err'); });
        // Delete asks first (it goes for everyone), like Mute below.
        if (act === 'delete') {
          sheet = document.createElement('div'); sheet.className = 'bk-hold'; sheet._m = m;
          sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg">Delete this message? It goes for everyone.</div><div class="bk-hold__acts"><button type="button" class="red" data-bk-del="yes">Delete</button><button type="button" data-bk-del="no">Cancel</button></div></div>';
          el.appendChild(sheet); return;
        }
        if (act === 'mute') {
          sheet = document.createElement('div'); sheet.className = 'bk-hold'; sheet._m = m;
          sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg">Mute ' + esc(m.name) + ' in the Barkadahan? They can still read.</div><div class="bk-hold__acts"><button type="button" data-bk-mute="1">For a day</button><button type="button" data-bk-mute="7">For a week</button><button type="button" data-bk-mute="cancel">Cancel</button></div></div>';
          el.appendChild(sheet); return;
        }
      }
      var dl = t.closest('[data-bk-del]');
      if (dl && sheet) {
        var md = sheet._m; closeSheet();
        if (dl.getAttribute('data-bk-del') !== 'yes') return;
        return post('/app/barkadahan/messages/' + encodeURIComponent(md.id) + '/delete').then(function () { md.deleted = true; md.body = ''; md.rx = {}; patch(md.id); toast('Deleted'); }, function (err) { toast(err.message, 'err'); });
      }
      var mu = t.closest('[data-bk-mute]');
      if (mu && sheet) {
        var mm = sheet._m, d = mu.getAttribute('data-bk-mute'); closeSheet();
        if (d === 'cancel') return;
        return post('/app/barkadahan/mute/' + encodeURIComponent(mm.pid), { days: Number(d) }).then(function (j) { toast(j.message); }, function (err) { toast(err.message, 'err'); });
      }
      if (emoSheet && !t.closest('.bk-emo') && !t.closest('[data-bk-input]')) { emoSheet.remove(); emoSheet = null; }
    });
    on(document, 'visibilitychange', function () { if (!el.isConnected) return current && current.el === el ? current.off() : null; if (document.visibilityState === 'visible') markRead(); });
  }

  window.wkndBarkadahan = { scan: function () {
    if (current && !current.el.isConnected) { current.off(); current = null; }
    var el = document.querySelector('[data-bk]'); if (el) mount(el);
  } };
  window.wkndBarkadahan.scan();
})();
