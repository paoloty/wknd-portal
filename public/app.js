// WKND Players app (/app) — the small amount of script the server-rendered screens need.
// Moving around inside the app doesn't reload the page: links to other app screens are
// fetched and swapped in (see "Fast navigation" below), so a tab already fetched opens
// instantly. Forms, sign-in and links out of /app are ordinary page loads.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ver = ($('meta[name="app-ver"]') || {}).content || '';
  var dirty = function () { return !!$('form[data-dirty="1"]'); };
  var deferredInstall = null, cdTimer = null, pickTimer = null, loadedAt = Date.now(), navOn = false;
  // The install wall is up (views/app/layout.js): the app underneath is hidden, so don't
  // fetch tabs ahead or count this as an app open.
  var walled = document.documentElement.classList.contains('needs-install');

  // ════ Per screen: everything that hooks into the current page's content ════
  // ════ Video player ════
  // YouTube without its own controls: only play/pause, a seek bar and the time. A layer over
  // the video takes the taps (play/pause), so YouTube's title, logo and "more videos" links
  // can't take a player out of the app. Uses the IFrame API, loaded on first play.
  var ytReady = null;
  function loadYt() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (ok, fail) {
      if (window.YT && window.YT.Player) return ok(window.YT);
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); ok(window.YT); };
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      s.onerror = function () { ytReady = null; fail(); };
      document.head.appendChild(s);
    });
    return ytReady;
  }
  var mmss = function (t) { t = Math.max(0, Math.floor(t || 0)); var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s; };
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
  function playVideo(btn) {
    var id = btn.getAttribute('data-yt');
    var box = document.createElement('div'); box.className = 'media player is-loading';
    box.innerHTML = '<div class="player__frame"></div><button type="button" class="player__tap" aria-label="Play or pause"></button>'
      + '<div class="player__bar"><button type="button" class="player__pp" aria-label="Play">' + PLAY + '</button>'
      + '<input class="player__seek" type="range" min="0" max="0" step="1" value="0" aria-label="Seek">'
      + '<span class="player__time">0:00</span></div>';
    btn.replaceWith(box);
    var pp = $('.player__pp', box), seek = $('.player__seek', box), time = $('.player__time', box), dragging = false, player = null, timer = null;
    var playing = function () { return player && player.getPlayerState && player.getPlayerState() === 1; };
    var toggle = function () { if (!player || !player.playVideo) return; if (playing()) player.pauseVideo(); else player.playVideo(); };
    var paint = function () {
      if (!player || !player.getDuration) return;
      var d = player.getDuration() || 0, t = player.getCurrentTime() || 0;
      seek.max = Math.floor(d);
      if (!dragging) seek.value = Math.floor(t);
      seek.style.setProperty('--p', d ? (seek.value / d * 100) + '%' : '0%');
      time.textContent = mmss(dragging ? seek.value : t) + (d ? ' / ' + mmss(d) : '');
    };
    $('.player__tap', box).addEventListener('click', toggle);
    pp.addEventListener('click', toggle);
    seek.addEventListener('input', function () { dragging = true; paint(); });
    seek.addEventListener('change', function () { dragging = false; if (player && player.seekTo) player.seekTo(Number(seek.value), true); });
    loadYt().then(function (YT) {
      player = new YT.Player($('.player__frame', box), {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1, autoplay: 1 },
        events: {
          onReady: function (e) { box.classList.remove('is-loading'); e.target.playVideo(); paint(); timer = setInterval(function () { if (!box.isConnected) return clearInterval(timer); paint(); }, 250); },
          onStateChange: function (e) {
            var on = e.data === 1 || e.data === 3;
            pp.innerHTML = on ? PAUSE : PLAY; pp.setAttribute('aria-label', on ? 'Pause' : 'Play');
            box.classList.toggle('is-paused', !on); paint();
          },
        },
      });
    }, function () {
      box.classList.remove('is-loading');
      box.innerHTML = '<p class="player__err">Couldn\'t load the video. Check your connection and try again.</p>';
    });
  }

  function initPage() {
    // Appearance: Automatic (follow the phone) / Light / Dark, remembered on this phone
    var sw = $('[data-theme-switch]');
    if (sw) {
      var cur = 'auto';
      try { cur = localStorage.getItem('wknd-theme') || 'auto'; } catch (e) {}
      var input = $('input[value="' + cur + '"]', sw); if (input) input.checked = true;
      sw.addEventListener('change', function (e) {
        var v = e.target.value;
        try { if (v === 'auto') localStorage.removeItem('wknd-theme'); else localStorage.setItem('wknd-theme', v); } catch (x) {}
        if (v === 'auto') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', v);
      });
    }

    // Videos (views/app/feed.js media): the picture is a play button; tapped, it becomes
    // our own player (playVideo below).
    $$('[data-yt]').forEach(function (btn) { btn.addEventListener('click', function () { playVideo(btn); }); });

    // Up next countdown: data-countdown = epoch ms; ticks every 30s
    clearInterval(cdTimer);
    var cd = $('[data-countdown]');
    if (cd) {
      var to = Number(cd.getAttribute('data-countdown'));
      var tick = function () {
        var ms = Math.max(0, to - Date.now());
        $('[data-cd-d]', cd).textContent = Math.floor(ms / 864e5);
        $('[data-cd-h]', cd).textContent = Math.floor(ms / 36e5) % 24;
        $('[data-cd-m]', cd).textContent = Math.floor(ms / 6e4) % 60;
      };
      tick(); cdTimer = setInterval(tick, 30000);
    }

    // Forms: one submit at a time; remember unsaved input (see the update check)
    $$('form[data-busy]').forEach(function (f) {
      f.addEventListener('submit', function () {
        var b = $('button[type="submit"]', f); if (b) { b.classList.add('is-busy'); }
        f.setAttribute('data-dirty', '');
      });
    });
    $$('form input, form textarea').forEach(function (el) {
      el.addEventListener('input', function () { var f = el.form; if (f) f.setAttribute('data-dirty', '1'); });
    });

    // 6-digit code: one hidden-looking input, six boxes drawn from its value
    var boxes = $('[data-code-boxes]');
    if (boxes) {
      var codeIn = $('input', boxes), spans = $$('span', boxes);
      var draw = function () {
        var v = codeIn.value.replace(/\D/g, '').slice(0, 6);
        if (v !== codeIn.value) codeIn.value = v;
        spans.forEach(function (s, i) { s.textContent = v[i] || ''; s.classList.toggle('is-active', document.activeElement === codeIn && i === Math.min(v.length, 5)); });
        if (v.length === 6) { var f = codeIn.form; if (f && !f.getAttribute('data-sent')) { f.setAttribute('data-sent', '1'); f.requestSubmit ? f.requestSubmit() : f.submit(); } }
      };
      codeIn.addEventListener('input', draw); codeIn.addEventListener('focus', draw); codeIn.addEventListener('blur', draw);
      boxes.addEventListener('click', function () { codeIn.focus(); });
      draw();
    }

    // Setup photo: shrink on the phone, send to the same /me/photo the site uses. The
    // reply is read as text first: a proxy in front of the app (size limit, Cloudflare)
    // answers with an HTML page, which Safari would report as "The string did not match the
    // expected pattern". On a failure it retries once with the profile size only, and the
    // failure is logged for /admin/app (photo_failed: status and size).
    var pIn = $('[data-photo-input]');
    if (pIn) {
      var pMsg = $('[data-photo-msg]');
      var say = function (t, kind) { pMsg.hidden = !t; pMsg.className = 'msg msg--' + (kind || 'info'); pMsg.textContent = t || ''; };
      var shrink = function (img, max, q) {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var s = Math.min(1, max / Math.max(w, h, 1));
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', q);
      };
      var post = function (payload) {
        var body = JSON.stringify(payload);
        return fetch('/me/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin' })
          .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) {} return { ok: r.ok && !!j && !!j.ok, status: r.status, j: j, kb: Math.round(body.length / 1024) }; }); },
                function () { return { ok: false, status: 0, j: null, kb: Math.round(body.length / 1024) }; });
      };
      var report = function (res, retry) {
        fetch('/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ photoFailed: (res.status || 'network') + ' · ' + res.kb + ' KB' + (retry ? ' · retry' : '') }) }).catch(function () {});
      };
      pIn.addEventListener('change', function () {
        var file = pIn.files && pIn.files[0]; if (!file) return;
        say('Uploading…');
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var small = shrink(img, 800, 0.86), original = shrink(img, 1600, 0.85);
          // Keep the full upload well under the server's limit; the original is optional.
          var payload = (small.length + original.length) < 6 * 1024 * 1024 ? { dataUrl: small, originalDataUrl: original } : { dataUrl: small };
          post(payload).then(function (res) {
            if (res.ok || !payload.originalDataUrl || (res.j && res.status >= 400 && res.status < 500)) return res;
            report(res, false);
            return post({ dataUrl: small }); // once more, profile size only
          }).then(function (res) {
            pIn.value = '';
            if (!res.ok) {
              report(res, true);
              say(res.j && res.j.error ? res.j.error
                : res.status === 0 ? 'No connection. Check your signal and try again.'
                : 'Upload didn\'t go through (error ' + res.status + '). Try again, or pick another photo.', 'err');
              return;
            }
            var av = $('[data-photo-preview] .avatar');
            if (av) { var old = $('img', av); if (old) old.remove(); var i2 = new Image(); i2.src = url; av.appendChild(i2); }
            say('Saved. Looking good.', 'ok');
            var next = $('[data-photo-next]'); if (next) next.textContent = 'Looks good';
            pages = {}; // screens showing the old photo
          });
        };
        img.onerror = function () { pIn.value = ''; say('That file isn\'t a photo we can read. Try a JPG or PNG.', 'err'); };
        img.src = url;
      });
    }

    initLazyLists();
    initPicks();
    initPasskeys();

    // Install hint (Home): iPhone gets the Share steps, Android the real prompt
    var card = $('[data-install-card]');
    if (card && !standalone) {
      if (deferredInstall) { card.hidden = false; $('[data-install-ios]', card).hidden = true; $('[data-install-android]', card).hidden = false; }
      else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) card.hidden = false;
      var ib = $('[data-install-btn]');
      if (ib) ib.addEventListener('click', function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; card.hidden = true; } });
    }
  }
  // A short notice above the tab bar, coloured by tone (CLAUDE.md "Notices"): ok = green
  // (done), err = red (problem), warn = amber (needs attention), info = neutral.
  function toast(text, tone) {
    tone = tone || 'ok';
    $$('.app-toast').forEach(function (t) { t.remove(); });
    var t = document.createElement('div'); t.className = 'app-toast app-toast--' + tone; t.setAttribute('role', tone === 'err' ? 'alert' : 'status');
    t.innerHTML = '<i>' + (tone === 'ok' ? '✓' : tone === 'info' ? 'i' : '!') + '</i><span></span>'; $('span', t).textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ════ Who wins? (views/app/picks.js) ════
  // One tap picks: the button lights up at once, the pick saves through the site's own
  // POST /games/:id/pick (same rules as the site), then the screen refreshes from the server
  // for the bars, faces and stakes. Tapping your own pick does nothing; a failure puts the
  // old pick back and says why. "Closes in …" counts down like the site's cards.
  var closeText = function (ms) {
    if (ms <= 0) return 'Picks are closing';
    var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return 'Closes in ' + (d >= 1 ? d + ' day' + (d === 1 ? '' : 's') : h >= 1 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + ':' + String(x).padStart(2, '0'));
  };
  function initPicks() {
    clearInterval(pickTimer);
    var clocks = $$('[data-close-at]');
    if (clocks.length) {
      var tick = function () { clocks.forEach(function (c) { c.textContent = closeText(Number(c.getAttribute('data-close-at')) - Date.now()); }); };
      tick(); pickTimer = setInterval(tick, 1000);
    }
    $$('[data-pick-game]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.pick__opt');
        if (!btn || btn.disabled || btn.classList.contains('is-mine') || card.getAttribute('data-saving')) return;
        var side = btn.getAttribute('data-side'), opts = $$('.pick__opt', card), prev = $('.pick__opt.is-mine', card);
        var msg = $('[data-pick-msg]', card); msg.hidden = true;
        card.setAttribute('data-saving', '1');
        opts.forEach(function (b) { b.classList.toggle('is-mine', b === btn); b.classList.add('is-saving'); });
        var undo = function (text) {
          card.removeAttribute('data-saving');
          opts.forEach(function (b) { b.classList.toggle('is-mine', b === prev); b.classList.remove('is-saving'); });
          msg.textContent = text; msg.hidden = false;
        };
        fetch('/games/' + encodeURIComponent(card.getAttribute('data-pick-game')) + '/pick', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ side: side }),
        }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok && !!j && !!j.ok, status: r.status, j: j }; }); })
          .then(function (res) {
            if (res.status === 401) { location.href = '/app/login'; return; }
            if (!res.ok) return undo((res.j && res.j.error) || 'Couldn\'t save your pick. Try again.');
            var label = card.getAttribute('data-close-label');
            toast('Picked ' + card.getAttribute('data-pick-' + side) + (label ? ' · change until ' + label : ''));
            refreshScreen();
          }, function () { undo('No connection. Your pick wasn\'t saved.'); });
      });
    });
  }

  // ════ Face ID / fingerprint sign-in (passkeys; views/app/passkeys.js) ════
  // The passkey library (served from /app/vendor) loads only on the screens that use it.
  // Wording follows the phone: Face ID on iPhone, fingerprint on Android, passkey elsewhere.
  // Cancelling the phone's prompt isn't an error.
  var bioName = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Face ID' : /Android/.test(navigator.userAgent) ? 'fingerprint' : 'passkey';
  var webauthn = null;
  var loadWebAuthn = function () {
    if (window.SimpleWebAuthnBrowser) return Promise.resolve(window.SimpleWebAuthnBrowser);
    return webauthn || (webauthn = new Promise(function (ok, fail) {
      var sc = document.createElement('script'); sc.src = '/app/vendor/webauthn.js?v=14.0.0';
      sc.onload = function () { ok(window.SimpleWebAuthnBrowser); }; sc.onerror = function () { webauthn = null; fail(new Error('load')); };
      document.head.appendChild(sc);
    }));
  };
  var postJSON = function (url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body || {}) })
      .then(function (r) { return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok, status: r.status, j: j }; }); });
  };
  var cancelled = function (e) { return e && (e.name === 'NotAllowedError' || e.name === 'AbortError'); };
  function passkeyMsg(text) { var m = $('[data-passkey-msg]'); if (m) { m.textContent = text || ''; m.hidden = !text; } }

  function passkeyLogin(auto) {
    return loadWebAuthn().then(function (W) {
      return postJSON('/app/passkeys/login/options').then(function (o) {
        if (!o.ok) throw { msg: o.j.error };
        return W.startAuthentication({ optionsJSON: o.j, useBrowserAutofill: !!auto });
      }).then(function (resp) { return postJSON('/app/passkeys/login/verify', resp); })
        .then(function (v) { if (!v.ok) throw { msg: v.j.error }; location.href = v.j.redirect || '/app'; });
    }).catch(function (e) {
      if (auto || cancelled(e)) return;
      passkeyMsg((e && e.msg) || (bioName === 'passkey' ? 'Passkey' : bioName.charAt(0).toUpperCase() + bioName.slice(1)) + ' sign-in didn\'t work. Use your password or an email code.');
    });
  }
  function passkeyAdd(done) {
    passkeyMsg('');
    return loadWebAuthn().then(function (W) {
      return postJSON('/app/passkeys/register/options').then(function (o) {
        if (!o.ok) throw { msg: o.j.error };
        return W.startRegistration({ optionsJSON: o.j });
      }).then(function (resp) { return postJSON('/app/passkeys/register/verify', resp); })
        .then(function (v) { if (!v.ok) throw { msg: v.j.error }; done(); });
    }).catch(function (e) {
      if (cancelled(e)) return;
      if (e && e.name === 'InvalidStateError') return done(); // this phone already has one
      passkeyMsg((e && e.msg) || 'That didn\'t work. Try again.');
    });
  }
  function initPasskeys() {
    $$('[data-bio]').forEach(function (el) { el.textContent = bioName === 'passkey' ? 'a passkey' : bioName; });
    var supported = !!window.PublicKeyCredential;
    // Sign-in screen: the button, plus the phone's own "passkey for …" suggestion on the
    // email field where it supports that.
    var lb = $('[data-passkey-login]');
    if (lb && supported) {
      lb.hidden = false;
      lb.onclick = function () { passkeyLogin(false); };
      loadWebAuthn().then(function (W) { return W.browserSupportsWebAuthnAutofill(); }).then(function (yes) { if (yes) passkeyLogin(true); }, function () {});
    }
    // The one-time offer after signing in.
    var offer = $('[data-faceid-offer]');
    if (offer) {
      var next = offer.getAttribute('data-next') || '/app';
      var skipped = false; try { skipped = !!localStorage.getItem('wknd-faceid-skip'); } catch (e) {}
      var go = function () { location.replace(next); };
      if (!supported || skipped) go();
      else loadWebAuthn().then(function (W) { return W.platformAuthenticatorIsAvailable(); }).then(function (yes) { if (yes) offer.hidden = false; else go(); }, go);
      var skip = $('[data-faceid-skip]');
      if (skip) skip.onclick = function () { try { localStorage.setItem('wknd-faceid-skip', '1'); } catch (e) {} };
    }
    $$('[data-passkey-add]').forEach(function (b) {
      if (!supported) { b.hidden = true; return; }
      b.onclick = function () {
        b.classList.add('is-busy');
        passkeyAdd(function () {
          if (offer) return location.replace(offer.getAttribute('data-next') || '/app');
          toast((bioName === 'passkey' ? 'Passkey' : bioName.charAt(0).toUpperCase() + bioName.slice(1)) + ' is on for this phone');
          refreshScreen();
        }).then(function () { b.classList.remove('is-busy'); });
      };
    });
  }

  // ════ Lazy lists (views/app/layout.js lazyList) ════
  // The first page loads as soon as the screen is up; the next one when the bottom of the
  // list comes within ~600px. Each answer is { html, next }.
  var lazyObservers = [];
  function initLazyLists() {
    lazyObservers.forEach(function (o) { o.disconnect(); }); lazyObservers = [];
    $$('[data-lazy-src]').forEach(function (box) {
      var items = $('.lazy__items', box), skel = $('.lazy__skel', box), end = $('.lazy__end', box);
      var next = box.getAttribute('data-lazy-src'), busy = false;
      var nearBottom = function () { return end.getBoundingClientRect().top < window.innerHeight + 600; };
      var load = function () {
        if (busy || !next) return;
        busy = true;
        fetch(next, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { if (r.status === 401) { location.href = '/app/login'; throw 0; } if (!r.ok) throw r.status; return r.json(); })
          .then(function (j) {
            busy = false; next = j.next || null;
            if (j.html) { items.hidden = false; items.insertAdjacentHTML('beforeend', j.html); }
            skel.hidden = true;
            if (!items.children.length) { end.className = 'lazy__end empty'; end.textContent = box.getAttribute('data-lazy-empty') || 'Nothing yet.'; return; }
            end.textContent = '';
            if (next && (!io || nearBottom())) { if (io) load(); else showMore(); }
          })
          .catch(function (e) {
            busy = false; if (e === 0) return;
            skel.hidden = true;
            end.className = 'lazy__end is-error';
            end.innerHTML = 'Couldn\'t load. <button type="button">Try again</button>';
            $('button', end).addEventListener('click', function () { end.className = 'lazy__end'; end.textContent = ''; load(); });
          });
      };
      // No IntersectionObserver (very old phones): a "Show more" button instead.
      var showMore = function () {
        end.innerHTML = '<button type="button">Show more</button>';
        $('button', end).addEventListener('click', function () { end.textContent = ''; load(); });
      };
      var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) load();
      }, { rootMargin: '0px 0px 600px 0px' }) : null;
      if (io) { io.observe(end); lazyObservers.push(io); }
      load();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; initInstallOnly(); initWall(); });

  // ════ Install wall ════
  // Android: Chrome's own install prompt behind one button (the manual steps stay as the
  // fallback). In-app browsers: copy the link to paste into Safari / Chrome.
  function initWall() {
    if (!walled) return;
    var btn = $('[data-iw-install]');
    if (btn && deferredInstall) {
      btn.hidden = false;
      btn.onclick = function () {
        var ev = deferredInstall; deferredInstall = null; btn.hidden = true;
        ev.prompt();
        if (ev.userChoice) ev.userChoice.then(function (c) { if (c.outcome !== 'accepted') { deferredInstall = ev; btn.hidden = false; } });
      };
    }
    var copy = $('[data-iw-copy]');
    if (copy && !copy.onclick) copy.onclick = function () {
      var url = location.origin + '/app';
      var done = function () { $('[data-iw-copied]').hidden = false; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
      else window.prompt('Copy this link:', url);
    };
  }
  window.addEventListener('appinstalled', function () {
    var ok = $('[data-iw-installed]'); if (ok) ok.hidden = false;
    var manual = $('[data-iw-manual]'); if (manual) manual.hidden = true;
  });
  initWall();
  function initInstallOnly() {
    var card = $('[data-install-card]');
    if (card && !standalone && deferredInstall) { card.hidden = false; $('[data-install-ios]', card).hidden = true; $('[data-install-android]', card).hidden = false; }
  }

  // ════ Fast navigation ════
  // In-app links are fetched and swapped in. Screens are kept in memory for this visit
  // only (a reload or log out clears them): shown at once when tapped again, then
  // refreshed from the server in the background. The tabs are fetched ahead once the
  // first screen has loaded, and any other link starts loading on touch. Screens must be
  // safe to fetch ahead: anything with a side effect (like marking notifications read)
  // belongs in a lazy list's data request, which only runs once the screen is shown.
  var pages = {}, inflight = {}, navId = 0;
  var urlOf = function (u) { var x = new URL(u, location.href); return x.pathname + x.search; };
  var inApp = function (path) { return /^\/app(\/|$|\?)/.test(path) && !/^\/app\/(login|logout|sw\.js|manifest|version|offline|ping)/.test(path); };
  var eligible = function (a) {
    return a && a.href && !a.target && !a.hasAttribute('download') && a.origin === location.origin && inApp(a.pathname) && !a.hasAttribute('data-reload');
  };

  // A request can hang for good on iPhone when the app goes to the background mid-fetch, and
  // a tap that waited on it would sit under a stuck progress bar. So every fetch gives up
  // after 10 s, a tap only shares a request started in the last few seconds, and coming
  // back to the app cancels whatever was in flight (a tap then loads its page normally).
  function fetchPage(url, fresh, tap) {
    var cur = inflight[url];
    if (cur && !fresh && (!tap || Date.now() - cur.started < 4000)) return cur;
    var ac = window.AbortController ? new AbortController() : null;
    var timer = ac ? setTimeout(function () { ac.abort(); }, 10000) : 0;
    var p = fetch(url, { credentials: 'same-origin', headers: { 'X-App-Nav': '1' }, signal: ac ? ac.signal : undefined }).then(function (r) {
      var finalUrl = urlOf(r.url);
      if (!r.ok || !inApp(new URL(r.url).pathname) || !/text\/html/.test(r.headers.get('content-type') || '')) throw { reload: r.url };
      return r.text().then(function (html) {
        var page = { html: html, url: finalUrl, at: Date.now() };
        pages[url] = page; if (finalUrl !== url) pages[finalUrl] = page;
        return page;
      });
    });
    p.started = Date.now();
    p.abort = function () { if (ac) ac.abort(); };
    inflight[url] = p;
    var clean = function () { clearTimeout(timer); if (inflight[url] === p) delete inflight[url]; };
    p.then(clean, clean);
    return p;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') Object.keys(inflight).forEach(function (u) { inflight[u].abort(); });
  });
  // Re-fetch the current screen and swap it in quietly (after a save that changes it).
  function refreshScreen() {
    if (!navOn) return location.reload();
    var id = navId;
    fetchPage(currentUrl, true).then(function (p) { if (id === navId) render(p, false, true); }, function () {});
  }
  var prefetch = function (url) { if (!pages[url] && !inflight[url] && navigator.onLine) fetchPage(url).catch(function () {}); };

  var bar = null, barTimer = null;
  function progress(on) {
    clearTimeout(barTimer);
    if (on) { barTimer = setTimeout(function () { if (!bar) { bar = document.createElement('div'); bar.className = 'nav-progress'; document.body.appendChild(bar); } }, 120); }
    else if (bar) { bar.remove(); bar = null; }
  }

  // Which way a move goes, like an iPhone app: between tabs a quick cross-fade; into a
  // screen below a tab (notifications, setup) a slide in from the right; back out a slide
  // the other way. Setup steps slide forward and back in their own order.
  var ROOTS = ['/app', '/app/picks', '/app/papawis', '/app/team', '/app/me']; // views/app/layout.js TABS
  var DEEP = ['/app/passkeys']; // two levels down (Me → Settings → Face ID)
  var STEPS = ['/app/setup/photo', '/app/setup/details', '/app/setup/season', '/app/setup/done'];
  var place = function (url) {
    var path = url.split('?')[0].replace(/\/$/, '') || '/app';
    if (ROOTS.indexOf(path) >= 0) return { depth: 0, step: 0 };
    if (DEEP.indexOf(path) >= 0) return { depth: 2, step: 0 };
    return { depth: 1, step: Math.max(0, STEPS.indexOf(path)) };
  };
  var direction = function (from, to) {
    var a = place(from), b = place(to);
    if (a.depth !== b.depth) return b.depth > a.depth ? 'push' : 'pop';
    if (a.step !== b.step) return b.step > a.step ? 'push' : 'pop';
    return 'tab';
  };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var currentUrl = urlOf(location.href);

  // dir: 'push' | 'pop' | 'tab' animates the swap; none (a background refresh) swaps quietly.
  // An animated swap happens a frame later (after the old screen is captured), so a quiet
  // swap waits for it — otherwise the fresh screen would be covered by the stale one.
  var pendingSwap = null;
  function render(page, push, keepScroll, dir) {
    if (pendingSwap && !dir) {
      var want = navId; // dropped if the player has moved on by then
      pendingSwap.then(function () { if (want === navId) render(page, push, keepScroll, dir); });
      return;
    }
    var doc = new DOMParser().parseFromString(page.html, 'text/html');
    var newVer = (doc.querySelector('meta[name="app-ver"]') || {}).content || '';
    if (newVer && ver && newVer !== ver) { location.href = page.url; return; } // new deploy: load it properly
    var newMain = doc.querySelector('main.app');
    if (!$('main.app') || !newMain) { location.href = page.url; return; }
    var y = window.scrollY;
    if (push) {
      try { history.replaceState(Object.assign({}, history.state, { y: y }), ''); } catch (e) {}
      history.pushState({ app: 1 }, '', page.url);
    }
    currentUrl = page.url;
    // The tab bar holds still only between two screens that both have it; otherwise it
    // moves with the screen it belongs to (setup has none), like an iPhone app.
    var oldNav = $('nav.tabbar'), keepBar = !!oldNav && !!doc.querySelector('nav.tabbar');
    if (oldNav && !keepBar) oldNav.style.viewTransitionName = 'none';
    var swap = function () {
      document.title = doc.title;
      $('main.app').replaceWith(document.importNode(newMain, true));
      var nav = $('nav.tabbar'), newNav = doc.querySelector('nav.tabbar');
      if (nav) nav.remove();
      if (newNav) {
        var added = document.body.insertBefore(document.importNode(newNav, true), $('main.app').nextSibling);
        if (!keepBar) { added.style.viewTransitionName = 'none'; setTimeout(function () { added.style.viewTransitionName = ''; }, 400); }
      }
      $$('.update-bar').forEach(function (b) { b.remove(); });
      if (!keepScroll) window.scrollTo(0, push ? 0 : ((history.state && history.state.y) || 0));
      else window.scrollTo(0, y);
      loadedAt = Date.now();
      initPage();
    };
    if (!dir || reducedMotion.matches) return swap();
    var root = document.documentElement;
    if (document.startViewTransition) {
      root.setAttribute('data-nav', dir);
      var t = document.startViewTransition(swap);
      var done = function () { if (pendingSwap === p) pendingSwap = null; };
      var p = pendingSwap = t.updateCallbackDone.then(done, done);
      t.finished.then(function () { root.removeAttribute('data-nav'); }, function () { root.removeAttribute('data-nav'); });
    } else {
      // Older phones: animate the new screen in with CSS.
      swap();
      var m = $('main.app'); m.classList.add('enter-' + dir);
      m.addEventListener('animationend', function () { m.classList.remove('enter-' + dir); }, { once: true });
    }
  }

  function go(url, push) {
    var id = ++navId;
    var dir = direction(currentUrl, url);
    var cached = pages[url];
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      render(cached, push, false, dir);
      // Refresh in the background; swap again only if it changed and nothing's being typed.
      if (navigator.onLine) fetchPage(url).then(function (fresh) {
        if (id === navId && fresh.html !== cached.html && !dirty()) render(fresh, false, true);
      }).catch(function () {});
      return;
    }
    progress(true);
    fetchPage(url, false, true).then(function (page) { if (id === navId) { progress(false); render(page, push, false, dir); } })
      .catch(function (e) { progress(false); if (id === navId) location.href = (e && e.reload) || url; });
  }

  if (window.fetch && window.DOMParser && history.pushState && !walled) {
    navOn = true;
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a');
      if (!eligible(a)) return;
      e.preventDefault();
      // The tab lights up straight away, before the screen arrives.
      if (a.classList.contains('tab')) { $$('.tab').forEach(function (t) { t.classList.toggle('is-on', t === a); }); }
      var url = urlOf(a.href);
      if (url === urlOf(location.href) && !a.hash) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      go(url, true);
    });
    var warm = function (e) { var a = e.target.closest && e.target.closest('a'); if (eligible(a)) prefetch(urlOf(a.href)); };
    document.addEventListener('touchstart', warm, { passive: true });
    document.addEventListener('mousedown', warm);
    window.addEventListener('popstate', function () { go(urlOf(location.href), false); });
    // Fetch the other tabs once the first screen is up.
    // The screen it opened on too, from the server: a copy of the live page (countdown ticked,
    // lists loaded) would never match a refresh and force a re-render on every return.
    var warmTabs = function () { prefetch(urlOf(location.href)); $$('.tabbar a.tab').forEach(function (a) { prefetch(urlOf(a.href)); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(warmTabs, { timeout: 2000 }); else setTimeout(warmTabs, 800);
  }

  initPage();

  // ════ Once per visit ════
  // Usage for /admin/app: the first open of the day on this phone, and whether it came
  // from the home screen (that's how "installed" is known on iPhone).
  var ping = function (body) {
    if (walled || !navigator.onLine || !document.querySelector('.tabbar')) return; // signed-in app screens only
    fetch('/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin', keepalive: true }).catch(function () {});
  };
  try {
    var day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) + (standalone ? '|hs' : '|web');
    if (localStorage.getItem('wknd-ping') !== day) { ping({ standalone: standalone }); localStorage.setItem('wknd-ping', day); }
  } catch (e) { ping({ standalone: standalone }); }
  window.addEventListener('appinstalled', function () { ping({ installed: true }); });

  // Offline shell
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app' }).catch(function () {});
  }
  // Red while offline; on reconnect it turns green ("Back online") for a moment, then goes.
  var offlineBar = null, onlineTimer = null;
  var net = function () {
    if (navigator.onLine) {
      if (!offlineBar || onlineTimer) return;
      var bar = offlineBar;
      bar.className = 'offline-bar is-online'; bar.textContent = 'Back online';
      onlineTimer = setTimeout(function () { bar.remove(); if (offlineBar === bar) offlineBar = null; onlineTimer = null; }, 2000);
      return;
    }
    if (onlineTimer) { clearTimeout(onlineTimer); onlineTimer = null; }
    if (!offlineBar) { offlineBar = document.createElement('div'); document.body.insertBefore(offlineBar, document.body.firstChild); }
    offlineBar.className = 'offline-bar'; offlineBar.setAttribute('role', 'status');
    offlineBar.textContent = 'You\'re offline · showing what was last loaded';
  };
  window.addEventListener('online', net); window.addEventListener('offline', net); net();

  // Updates: iPhone resumes the old screen without reloading, so on coming back to the app
  // check the deployed version; reload when it changed or the screen is >30 min old. A
  // half-filled form gets a "tap to refresh" bar instead of losing what was typed.
  var checking = false;
  var showBar = function () {
    if ($('.update-bar')) return;
    var b = document.createElement('div'); b.className = 'update-bar';
    b.innerHTML = 'New version ready <button type="button">Refresh</button>';
    $('button', b).addEventListener('click', function () { location.reload(); });
    document.body.appendChild(b);
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || checking || !navigator.onLine) return;
    checking = true;
    fetch('/app/version', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      var stale = Date.now() - loadedAt > 30 * 60 * 1000;
      if ((j.ver && j.ver !== ver) || stale) { pages = {}; if (dirty()) showBar(); else location.reload(); }
    }).catch(function () {}).then(function () { checking = false; });
  });
})();
