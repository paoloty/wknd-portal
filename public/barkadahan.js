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
  var dayOf = function (ms) { return new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' }); };
  var timeOf = function (ms) { return new Date(ms).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }); };
  var todayStr = function () { return dayOf(Date.now()); };
  var onlyEmoji = function (s) { try { return /^[\p{Extended_Pictographic}‍️\s]{1,16}$/u.test(s) && Array.from(s.replace(/\s/g, '')).length <= 8; } catch (e) { return false; } };
  var avatar = function (m) {
    // The same markup as views/app/layout.js appAvatar.
    return '<span class="avatar-wrap bk-av"><span class="avatar" style="--ring:' + esc(m.ring || 'var(--subtle)') + '">' + esc(m.initials || '?') + (m.photo ? '<img src="' + esc(m.photo) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '</span></span>';
  };

  function mount(el) {
    if (el._bk) return;
    el._bk = true;
    var B = JSON.parse(el.querySelector('[data-bk-bundle]').textContent);
    var me = B.me, list = el.querySelector('[data-bk-list]'), form = el.querySelector('[data-bk-form]'), input = el.querySelector('[data-bk-input]');
    var typingEl = el.querySelector('[data-bk-typing]'), replyEl = el.querySelector('[data-bk-reply]'), mentionEl = el.querySelector('[data-bk-mention]');
    var msgs = [], byId = {}, pending = [], replyTo = null, mentions = {}, loadingOld = false, noMore = false, typers = {}, readT = null;
    var nameOf = {}; B.people.forEach(function (p) { nameOf[p.pid] = p.name; });

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
        : '<div class="bk-bub' + (emo ? ' is-emo' : '') + '" data-bk-hold>' + (m.reply ? '<span class="bk-q"><b>' + esc(m.reply.name) + '</b>' + esc(m.reply.body) + '</span>' : '') + bodyHtml(m) + '</div>';
      var state = m.pending ? '<span class="bk-st">' + (m.failed ? 'Not sent · <button type="button" data-bk-retry>Retry</button>' : 'Sending…') + '</span>' : '';
      return '<div class="bk-m' + (mine ? ' is-me' : '') + (cont ? ' is-cont' : '') + '" data-id="' + esc(m.id) + '">'
        + (mine || cont ? '' : avatar(m))
        + '<div class="bk-m__b">' + (mine || cont ? '' : '<div class="bk-who"><span class="dot" style="--c:' + esc(m.ring || 'var(--subtle)') + '"></span><b>' + esc(m.name) + '</b><span>' + esc(timeOf(m.at)) + '</span></div>')
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
      list.innerHTML = out.join('');
      if (keep === 'top') list.scrollTop = list.scrollHeight - oldH + oldTop;
      else if (keep === 'stay' && !atEnd) list.scrollTop = oldTop;
      else toBottom();
    }
    function setAll(arr) { msgs = arr; byId = {}; msgs.forEach(function (m) { byId[m.id] = m; }); }
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
      var raf = 0, lastTop = -1, lastH = -1;
      var apply = function () {
        raf = 0;
        if (!el.isConnected) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); return; }
        var top = Math.max(0, Math.round(vv.offsetTop)), h = Math.round(vv.height);
        if (Math.abs(top - lastTop) < 2 && Math.abs(h - lastH) < 2) return;
        var near = nearBottom();
        lastTop = top; lastH = h;
        el.style.transform = top ? 'translate3d(0,' + top + 'px,0)' : '';
        el.style.height = h + 'px';
        // The keyboard covers the home bar: no bottom inset while it's up.
        el.classList.toggle('is-kb', h < window.innerHeight - 120);
        if (near) toBottom();
      };
      var fit = function () { if (!raf) raf = requestAnimationFrame(apply); };
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
      apply();
    }

    // A fresh copy (the page may have come from the phone's copy).
    fetch('/app/barkadahan/messages', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && el.isConnected) { setAll(j.messages); draw('stay'); setOnline(j.online); } }).catch(function () {});

    // Older messages when scrolled to the top.
    list.addEventListener('scroll', function () {
      if (list.scrollTop > 60 || loadingOld || noMore || !msgs.length) return;
      loadingOld = true;
      fetch('/app/barkadahan/messages?before=' + msgs[0].at, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (j) {
        loadingOld = false;
        if (!j.messages.length) { noMore = true; draw('top'); return; }
        setAll(j.messages.concat(msgs)); draw('top');
      }).catch(function () { loadingOld = false; });
    });

    var setOnline = function (n) { if (n == null) return; el.querySelectorAll('[data-bk-online]').forEach(function (x) { x.textContent = n; }); };
    var markRead = function () { clearTimeout(readT); readT = setTimeout(function () { if (document.visibilityState === 'visible' && el.isConnected) post('/app/barkadahan/read').catch(function () {}); }, 1500); };

    // ── Live: from the app's connection ──
    function onLive(e) {
      if (!el.isConnected) { window.removeEventListener('wknd:bk', onLive); return; }
      var d = e.detail || {};
      if (d.type === 'online') setOnline(d.n);
      if (d.type === 'msg' && d.m && !byId[d.m.id]) {
        pending = pending.filter(function (p) { return p.serverId !== d.m.id; });
        msgs.push(d.m); byId[d.m.id] = d.m;
        var atEnd = nearBottom(); draw(d.m.pid === me.pid || atEnd ? '' : 'stay');
        delete typers[d.m.pid]; paintTyping();
        if (d.m.pid !== me.pid) markRead();
      }
      if (d.type === 'rx' && byId[d.id]) { byId[d.id].rx = d.rx; draw('stay'); }
      if (d.type === 'del' && byId[d.id]) { byId[d.id].deleted = true; byId[d.id].body = ''; byId[d.id].rx = {}; draw('stay'); }
      if (d.type === 'typing' && d.pid !== me.pid) { typers[d.pid] = { name: d.name, until: Date.now() + 4000 }; paintTyping(); setTimeout(paintTyping, 4100); }
    }
    window.addEventListener('wknd:bk', onLive);
    function paintTyping() {
      var now = Date.now(), names = Object.keys(typers).filter(function (k) { return typers[k].until > now; }).map(function (k) { return typers[k].name; });
      typingEl.textContent = !names.length ? '' : names.length === 1 ? names[0] + ' is typing…' : names.length === 2 ? names[0] + ' and ' + names[1] + ' are typing…' : 'A few people are typing…';
    }

    // ── Sending ──
    function send(text) {
      var p = { id: 'tmp' + Date.now(), pid: me.pid, at: Date.now(), body: text, mentions: Object.keys(mentions).filter(function (k) { return text.indexOf('@' + mentions[k]) !== -1; }), reply: replyTo ? { id: replyTo.id, name: replyTo.name, body: replyTo.body } : null, rx: {}, pending: true };
      p.replyTo = replyTo && replyTo.id;
      pending.push(p); draw();
      deliver(p);
      mentions = {}; setReply(null);
    }
    function deliver(p) {
      p.failed = false; draw('stay');
      post('/app/barkadahan/messages', { body: p.body, replyTo: p.replyTo || null, mentions: p.mentions }).then(function (j) {
        pending = pending.filter(function (x) { return x !== p; });
        if (!byId[j.m.id]) { msgs.push(j.m); byId[j.m.id] = j.m; }
        draw();
      }, function (err) { p.failed = true; draw('stay'); toast(err.message, 'err'); });
    }
    if (form) {
      var grow = function () { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = input.value.trim(); if (!text) return;
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
      replyEl.innerHTML = m ? '<span><b>Replying to ' + esc(m.name) + '</b>' + esc(m.body.slice(0, 80)) + '</span><button type="button" data-bk-noreply aria-label="Cancel reply">×</button>' : '';
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
      if (!me.cant) acts.push(['reply', 'Reply']);
      acts.push(['copy', 'Copy']);
      if (!mine) acts.push(['report', 'Report']);
      if (mine || me.mod) acts.push(['delete', 'Delete', 'red']);
      if (me.mod && !mine) acts.push(['mute', 'Mute ' + m.name + '…']);
      sheet = document.createElement('div');
      sheet.className = 'bk-hold'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Message actions');
      sheet.innerHTML = '<div class="bk-hold__in">' + (me.cant ? '' : '<div class="bk-hold__rx">' + B.reactions.map(function (r) { var on = (m.rx[r] || []).indexOf(me.pid) !== -1; return '<button type="button" class="' + (on ? 'is-on' : '') + '" data-bk-react="' + r + '" aria-label="React ' + r + '">' + r + '</button>'; }).join('') + '</div>')
        + '<div class="bk-hold__msg">' + (m.reply ? '<span class="bk-q"><b>' + esc(m.reply.name) + '</b>' + esc(m.reply.body) + '</span>' : '') + bodyHtml(m) + '</div>'
        + '<div class="bk-hold__acts">' + acts.map(function (a) { return '<button type="button" class="' + (a[2] || '') + '" data-bk-act="' + a[0] + '">' + esc(a[1]) + '</button>'; }).join('') + '</div></div>';
      sheet._m = m;
      el.appendChild(sheet);
    }
    var holdT = null, holdAt = null;
    list.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-bk-hold]'); if (!b) return;
      holdAt = { x: e.clientX, y: e.clientY };
      clearTimeout(holdT);
      holdT = setTimeout(function () { holdT = null; var id = b.closest('[data-id]').getAttribute('data-id'); if (byId[id]) { if (navigator.vibrate) navigator.vibrate(10); openMenu(byId[id]); } }, HOLD_MS);
    });
    var cancelHold = function () { clearTimeout(holdT); holdT = null; };
    list.addEventListener('pointerup', cancelHold);
    list.addEventListener('pointercancel', cancelHold);
    list.addEventListener('pointermove', function (e) { if (holdT && holdAt && Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 10) cancelHold(); });
    list.addEventListener('contextmenu', function (e) { if (e.target.closest('[data-bk-hold]')) e.preventDefault(); });

    var react = function (m, emoji) {
      if (!m || m.deleted || me.cant) return;
      post('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/react', { emoji: emoji }).then(function (j) { m.rx = j.rx; draw('stay'); }, function (err) { toast(err.message, 'err'); });
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
      var rxb = t.closest('[data-bk-rx]'); if (rxb) return react(byId[rxb.closest('[data-id]').getAttribute('data-id')], rxb.getAttribute('data-bk-rx'));
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
        if (act === 'reply') return setReply(m);
        if (act === 'copy') { try { navigator.clipboard.writeText(m.body).then(function () { toast('Copied'); }); } catch (x2) {} return; }
        if (act === 'report') return post('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/report', {}).then(function (j) { toast(j.message || 'Reported'); }, function (err) { toast(err.message, 'err'); });
        if (act === 'delete') return post('/app/barkadahan/messages/' + encodeURIComponent(m.id) + '/delete').then(function () { m.deleted = true; m.body = ''; draw('stay'); toast('Deleted'); }, function (err) { toast(err.message, 'err'); });
        if (act === 'mute') {
          sheet = document.createElement('div'); sheet.className = 'bk-hold'; sheet._m = m;
          sheet.innerHTML = '<div class="bk-hold__in"><div class="bk-hold__msg">Mute ' + esc(m.name) + ' in the Barkadahan? They can still read.</div><div class="bk-hold__acts"><button type="button" data-bk-mute="1">For a day</button><button type="button" data-bk-mute="7">For a week</button><button type="button" data-bk-mute="cancel">Cancel</button></div></div>';
          el.appendChild(sheet); return;
        }
      }
      var mu = t.closest('[data-bk-mute]');
      if (mu && sheet) {
        var mm = sheet._m, d = mu.getAttribute('data-bk-mute'); closeSheet();
        if (d === 'cancel') return;
        return post('/app/barkadahan/mute/' + encodeURIComponent(mm.pid), { days: Number(d) }).then(function (j) { toast(j.message); }, function (err) { toast(err.message, 'err'); });
      }
      if (emoSheet && !t.closest('.bk-emo') && !t.closest('[data-bk-input]')) { emoSheet.remove(); emoSheet = null; }
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && el.isConnected) markRead(); });
  }

  window.wkndBarkadahan = { scan: function () { var el = document.querySelector('[data-bk]'); if (el) mount(el); } };
  window.wkndBarkadahan.scan();
})();
