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
  // ════ Pictures that fail ════
  // Feed and game pictures (.media img): a failed load is tried once more 1.5 s later (a load
  // dropped by the app going to the background, or by a weak signal), then reported to
  // /admin/app (img_failed, once per picture per visit) and removed: a photo takes its grey
  // box with it, a video keeps its play button.
  var imgReported = {};
  var bust = function (u) { return u.replace(/([?&])r=\d+&?/, '$1').replace(/[?&]$/, '') + (u.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now() % 1e6; };
  function imgFailed(img) {
    if (!img.isConnected) return;
    if (!img.getAttribute('data-retried')) {
      img.setAttribute('data-retried', '1');
      setTimeout(function () {
        if (!img.isConnected) return;
        var set = img.getAttribute('srcset');
        if (set) img.setAttribute('srcset', set.split(', ').map(function (part) { var x = part.split(' '); return bust(x[0]) + ' ' + x[1]; }).join(', '));
        img.src = bust(img.getAttribute('src'));
      }, 1500);
      return;
    }
    var src = (img.currentSrc || img.src || '').replace(location.origin, '').replace(/[?&]r=\d+/, '');
    if (!imgReported[src] && navigator.onLine) {
      imgReported[src] = 1;
      fetch('/app/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify({ imgFailed: src }) }).catch(function () {});
    }
    // A game's hero keeps its dark gradient and score; a news picture's box goes.
    var box = img.closest('.media, .nx__pic');
    if (box && !box.querySelector('.media__play')) box.remove(); else img.remove();
  }
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.closest && t.closest('.media, .gx__hero, .nx__pic')) imgFailed(t); }, true);
  // Any that failed before this script ran (a game screen opened directly).
  $$('.media img, .gx__hero img, .nx__pic img').forEach(function (img) { if (img.complete && !img.naturalWidth) imgFailed(img); });

  // ════ Blocks ════
  // A part of a screen that loads after it (Home's rail, /app/rail → JSON { html }): the copy
  // on the phone shows at once (public/app-sw.js keeps one), then the network's. A kept or
  // refreshed screen shows what it has and quietly takes the fresh one if it changed.
  function loadBlock(block, fresh) {
    var src = block.getAttribute('data-block-src');
    var put = function (html) {
      if (!block.isConnected || html === block._html) return;
      block._html = html;
      if (!html) { block.hidden = true; return; }
      var rail = $('[data-rail]', block), left = rail ? rail.scrollLeft : 0; // stay on the card in view
      block.hidden = false; block.innerHTML = html;
      rail = $('[data-rail]', block);
      if (rail && left) { rail.style.scrollSnapType = 'none'; rail.scrollLeft = left; rail.style.scrollSnapType = ''; }
      initPicks(); initRails(block); initVideos();
      if (rail && left) rail.dispatchEvent(new Event('scroll'));
    };
    if (!block._html && !fresh && window.caches) {
      caches.match(src, { cacheName: 'wknd-data' }).then(function (r) { return r && r.json(); })
        .then(function (j) { if (j && block._html === undefined) put(j.html || ''); }).catch(function () {});
    }
    fetch(src, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (j) { put(j.html || ''); }, function () { if (block._html === undefined) block.hidden = true; });
  }
  // The tab bar's badges from a fresh copy of this screen (after a pick on Home's rail).
  function refreshNav() {
    if (!navOn) return;
    fetchPage(currentUrl, true).then(function (page) {
      var nb = new DOMParser().parseFromString(page.html, 'text/html').querySelector('nav.tabbar'), cur = $('nav.tabbar');
      if (nb && cur && nb.innerHTML !== cur.innerHTML) cur.innerHTML = nb.innerHTML;
    }).catch(function () {});
  }
  function initBlocks() { $$('[data-block-src]').forEach(function (b) { loadBlock(b); }); }
  // The rail's dots follow the card in view.
  function initRails(root) {
    $$('[data-rail]', root).forEach(function (rail) {
      var dots = rail.parentNode.querySelector('[data-rail-dots]');
      if (!dots || rail._dots) return;
      rail._dots = true;
      rail.addEventListener('scroll', function () {
        var w = rail.firstElementChild ? rail.firstElementChild.offsetWidth + 10 : 1;
        var i = Math.min(dots.children.length - 1, Math.round(rail.scrollLeft / w));
        Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); });
      }, { passive: true });
    });
  }

  // ════ Video player ════
  // YouTube without its own controls: only play/pause, a seek bar and the time.
  // iPhone only starts a video with sound from a tap on the YouTube frame itself, so the
  // player is loaded as soon as the screen shows, under our cover picture, which lets taps
  // through (pointer-events: none): the first tap lands on YouTube and plays, one tap, with
  // sound. Once it plays, our layer takes the taps (play/pause) and the bar appears, so
  // YouTube's title, logo and "more videos" links can't take a player out of the app; paused,
  // the picture dims under our ▶, hiding most of YouTube's pause screen.
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
  var SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  var MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  var FULL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var SHRINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  // Full screen: the real thing where the phone allows it on a page element (Android, iPad);
  // iPhone only allows it for its own video player, so there the player fills the window
  // instead (turn the phone for landscape).
  function fullScreen(box) {
    var doc = document, inReal = doc.fullscreenElement || doc.webkitFullscreenElement;
    var btn = $('.player__fs', box);
    var mark = function (on) { box.classList.toggle('is-full', on); document.body.classList.toggle('player-full', on); btn.innerHTML = on ? SHRINK : FULL; btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen'); };
    if (inReal) { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); return; }
    if (box.classList.contains('is-full')) return mark(false);
    var req = box.requestFullscreen || box.webkitRequestFullscreen;
    if (req) {
      var off = function () { if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) { mark(false); doc.removeEventListener('fullscreenchange', off); doc.removeEventListener('webkitfullscreenchange', off); } };
      doc.addEventListener('fullscreenchange', off); doc.addEventListener('webkitfullscreenchange', off);
      var r = req.call(box);
      if (r && r.catch) r.catch(function () { mark(true); }); // refused: fill the window instead
      mark(true);
      return;
    }
    mark(true);
  }
  // box: views/app/feed.js media() — .media.player[data-yt] holding the cover picture + ▶.
  function mountPlayer(box) {
    if (box.getAttribute('data-mounted')) return;
    box.setAttribute('data-mounted', '1');
    box._cover = box.innerHTML;
    var id = box.getAttribute('data-yt');
    var poster = document.createElement('div'); poster.className = 'player__poster';
    while (box.firstChild) poster.appendChild(box.firstChild);
    // stage: the 16:9 picture (YouTube's frame, sized taller than the stage so its title bar
    // and bottom strip fall outside it, our cover, our tap layer); bar: seek, time, full screen.
    box.innerHTML = '<div class="player__stage"><div class="player__crop"><div class="player__frame"></div></div></div>';
    var stage = $('.player__stage', box);
    stage.appendChild(poster);
    stage.insertAdjacentHTML('beforeend', '<button type="button" class="player__tap" aria-label="Play or pause"><i class="media__play">' + PLAY + '</i></button>');
    box.insertAdjacentHTML('beforeend', '<div class="player__bar">'
      + '<input class="player__seek" type="range" min="0" max="0" step="1" value="0" aria-label="Seek">'
      + '<span class="player__time">0:00</span>'
      + '<button type="button" class="player__mute" aria-label="Mute">' + SOUND + '</button>'
      + '<button type="button" class="player__fs" aria-label="Full screen">' + FULL + '</button></div>');
    var seek = $('.player__seek', box), time = $('.player__time', box), dragging = false, player = null, timer = null;
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
    $('.player__fs', box).addEventListener('click', function () { fullScreen(box); });
    var muteBtn = $('.player__mute', box);
    var showMute = function (m) { muteBtn.innerHTML = m ? MUTED : SOUND; muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute'); };
    muteBtn.addEventListener('click', function () {
      if (!player || !player.isMuted) return;
      if (player.isMuted()) player.unMute(); else player.mute();
      showMute(!player.isMuted());
      setTimeout(function () { if (player.isMuted) showMute(player.isMuted()); }, 300); // the real state, once YouTube has it
    });
    seek.addEventListener('input', function () { dragging = true; paint(); });
    seek.addEventListener('change', function () { dragging = false; if (player && player.seekTo) player.seekTo(Number(seek.value), true); });
    loadYt().then(function (YT) {
      player = new YT.Player($('.player__frame', box), {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1 },
        events: {
          onReady: function () { box.classList.add('is-ready'); paint(); timer = setInterval(function () { if (!box.isConnected) return clearInterval(timer); paint(); }, 250); },
          onStateChange: function (e) {
            var on = e.data === 1 || e.data === 3; // playing / buffering
            if (on) box.classList.add('is-started');
            box.classList.toggle('is-paused', !on && box.classList.contains('is-started')); paint();
          },
        },
      });
    }, function () {
      // No IFrame API (blocked or offline): YouTube's own player, so the video still plays.
      box.innerHTML = '<iframe class="player__frame" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Video"></iframe>';
    });
  }
  // Videos on screen now get their player; ones further down (feed announcements) once
  // they scroll near, so a long feed doesn't load a YouTube player per video up front.
  var playerObserver = null;
  function initVideos() {
    if (playerObserver) playerObserver.disconnect();
    var boxes = $$('.player[data-yt]:not([data-mounted])');
    if (!boxes.length) return;
    if (!('IntersectionObserver' in window)) return boxes.forEach(mountPlayer);
    playerObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { playerObserver.unobserve(en.target); mountPlayer(en.target); } });
    }, { rootMargin: '400px 0px' });
    boxes.forEach(function (b) { playerObserver.observe(b); });
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

    // Videos (views/app/feed.js media): our player, loaded under the cover picture.
    initVideos();
    initPapawis();
    initPush();
    initSettle();
    initBlocks();
    initThreads();
    initShare();

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
  // The card just picked: once the refreshed screen is in, its pickers' bars grow in from
  // the left (the split shows for the first time), like the site's pick cards.
  var justPicked = null;
  function initPicks() {
    clearInterval(pickTimer);
    if (justPicked) {
      var done = $('[data-pick-game="' + justPicked + '"]');
      justPicked = null;
      if (done) done.classList.add('is-revealed');
    }
    var clocks = $$('[data-close-at]');
    if (clocks.length) {
      var tick = function () { clocks.forEach(function (c) { c.textContent = closeText(Number(c.getAttribute('data-close-at')) - Date.now()); }); };
      tick(); pickTimer = setInterval(tick, 1000);
    }
    $$('[data-pick-game]').forEach(function (card) {
      if (card._bound) return; // a block loaded later calls initPicks again
      card._bound = true;
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
            justPicked = card.getAttribute('data-pick-game');
            var block = card.closest('[data-block-src]');
            if (block) { loadBlock(block, true); refreshNav(); } else refreshScreen();
          }, function () { undo('No connection. Your pick wasn\'t saved.'); });
      });
    });
  }

  // ════ Papawis (views/app/papawis.js) ════
  // Join, leave and the free run go through the site's own endpoints, so its rules decide
  // (bans, unpaid games, deposits, the cancel window, the waitlist). A claim inside the
  // cancel window asks first. After a change the screen refreshes for the new list.
  var pwTimer = null;
  var pwLeft = function (ms) {
    if (ms <= 0) return 'now';
    var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
  };
  function initPapawis() {
    clearInterval(pwTimer);
    var cds = $$('[data-countdown-to]');
    if (cds.length) {
      var tick = function () { cds.forEach(function (c) { c.textContent = c.getAttribute('data-countdown-label') + ' ' + pwLeft(Number(c.getAttribute('data-countdown-to')) - Date.now()); }); };
      tick(); pwTimer = setInterval(tick, 30000);
    }
    $$('[data-pw-card]').forEach(function (card) {
      if (card._bound) return;
      card._bound = true;
      card.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-pw-act]');
        if (!b || b.disabled || card.getAttribute('data-saving')) return;
        var act = b.getAttribute('data-pw-act'), run = b.getAttribute('data-pw-run');
        var ask = b.getAttribute('data-pw-confirm');
        if (ask && !window.confirm(ask)) return;
        if (act === 'cancel' && !window.confirm(b.textContent.trim() + '?')) return;
        var msg = $('[data-pw-msg]', card); msg.hidden = true;
        card.setAttribute('data-saving', '1'); b.classList.add('is-busy');
        var use = b.getAttribute('data-pw-use') === '1';
        fetch('/papawis/' + encodeURIComponent(run) + '/' + act, {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: act === 'voucher' ? JSON.stringify({ use: use }) : '{}',
        }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok && !!j && !!j.ok, status: r.status, j: j }; }); })
          .then(function (res) {
            card.removeAttribute('data-saving'); b.classList.remove('is-busy');
            if (res.status === 401) { location.href = '/app/login'; return; }
            if (!res.ok) { msg.textContent = (res.j && res.j.error) || 'That didn\'t go through. Try again.'; msg.hidden = false; return; }
            var st = res.j.status;
            toast(act === 'voucher' ? (res.j.message || 'Done')
              : act === 'cancel' ? 'You\'re off the list'
              : st === 'waitlist' ? 'You\'re on the waitlist' : st === 'pending' ? 'You\'re listed · send your deposit to confirm' : 'You\'re in!');
            refreshScreen();
          }, function () {
            card.removeAttribute('data-saving'); b.classList.remove('is-busy');
            msg.textContent = 'No connection. Nothing was changed.'; msg.hidden = false;
          });
      });
    });
  }

  // ════ Settle a balance (views/app/settle.js) ════
  // Copy the GCash number; save the QR (iPhone: the share sheet's "Save Image"); open GCash;
  // then the receipt screenshot (shrunk to 1600px) posts to the site's /settle-balance.
  function initSettle() {
    var form = $('[data-st-form]');
    var copy = $('[data-st-copy]');
    if (copy && !copy._bound) {
      copy._bound = true;
      copy.addEventListener('click', function () {
        var n = $('[data-st-number]').textContent.trim();
        var ok = function () { toast('Number copied · paste it in GCash Send Money'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(n).then(ok, function () { window.prompt('Copy this number:', n); });
        else window.prompt('Copy this number:', n);
      });
    }
    var save = $('[data-st-save]');
    if (save && !save._bound) {
      save._bound = true;
      save.addEventListener('click', function () {
        var src = $('[data-st-qr]').getAttribute('src');
        fetch(src, { credentials: 'same-origin' }).then(function (r) { return r.blob(); }).then(function (blob) {
          var file = new File([blob], 'wknd-gcash-qr.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: 'WKND GCash QR' });
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wknd-gcash-qr.png'; document.body.appendChild(a); a.click(); a.remove();
          toast('QR saved');
        }).catch(function (e) { if (!e || e.name !== 'AbortError') toast('Couldn\'t save it. Press and hold the QR instead.', 'err'); });
      });
    }
    var gc = $('[data-st-gcash]');
    if (gc && !gc._bound) {
      gc._bound = true;
      // gcash:// isn't official: if GCash doesn't open, say how instead of leaving them waiting.
      gc.addEventListener('click', function () {
        var left = false, mark = function () { left = true; };
        document.addEventListener('visibilitychange', mark, { once: true });
        setTimeout(function () { document.removeEventListener('visibilitychange', mark); if (!left) toast('Open GCash from your home screen, then Pay QR → Upload QR', 'info'); }, 1600);
      });
    }
    if (!form || form._bound) return;
    form._bound = true;
    var file = $('[data-st-file]', form), pick = $('[data-st-pick]', form), prev = $('[data-st-preview]', form), msg = $('[data-st-msg]', form);
    var shot = null;
    $$('[data-st-preset]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        form.elements.amount.value = b.getAttribute('data-st-preset');
        $$('[data-st-preset]', form).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      });
    });
    pick.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight, 1)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        shot = c.toDataURL('image/jpeg', 0.85); URL.revokeObjectURL(url);
        prev.src = shot; prev.hidden = false; pick.textContent = '📎 Change screenshot'; msg.hidden = true;
      };
      img.onerror = function () { URL.revokeObjectURL(url); msg.textContent = 'That file isn\'t a picture we can read. Try the screenshot again.'; msg.hidden = false; };
      img.src = url;
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var el = form.elements, amt = Number(el.amount.value);
      var say = function (t) { msg.textContent = t; msg.hidden = false; };
      if (!(amt > 0)) return say('Enter the amount you paid.');
      if (!shot) return say('Add the receipt screenshot from GCash (or your bank).');
      var btn = $('[data-st-send]', form); btn.classList.add('is-busy'); msg.hidden = true;
      fetch('/settle-balance', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, category: el.category.value, payment_method: el.payment_method.value, reference_no: el.reference_no.value, screenshot: shot }) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok && !!j && !!j.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          btn.classList.remove('is-busy');
          if (res.status === 401) { location.href = '/app/login'; return; }
          if (!res.ok) return say((res.j && res.j.error) || (res.status === 413 ? 'That screenshot is too big. Try a smaller one.' : 'Couldn\'t send it. Try again.'));
          toast('Sent · an admin will confirm it');
          refreshScreen();
        }, function () { btn.classList.remove('is-busy'); say('No connection. Nothing was sent.'); });
    });
  }

  // ════ Push notifications (lib/push.js) ════
  // Turned on from Settings or Home's card. iPhone asks for permission only from a tap and only
  // in the installed app; the subscription is this phone's, the kinds (picks, Papawis...) the
  // account's. Once a day an existing subscription is re-sent, so the server never loses it.
  var pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var b64 = function (s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    var raw = atob(s), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  };
  var postJson = function (url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'failed'); return j; }); });
  };
  var getSub = function () { return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }); };
  function pushOn() {
    // requestPermission first, straight from the tap (iPhone needs that).
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'blocked' : 'not now');
      return fetch('/app/push/key', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    }).then(function (k) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (old) {
          return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.publicKey) });
        });
      });
    }).then(function (sub) { return postJson('/app/push/subscribe', { subscription: sub.toJSON() }); });
  }
  function pushOff() {
    return getSub().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return postJson('/app/push/unsubscribe', { endpoint: ep }); });
    });
  }
  var pushFail = function (e) {
    toast(e && e.message === 'blocked' ? 'Notifications are blocked. Allow WKND in your phone\'s Settings → Notifications.' : 'Couldn\'t turn on notifications. Try again.', 'err');
  };
  function initPush() {
    var box = $('[data-push]');
    if (box && !box._bound) {
      box._bound = true;
      var status = $('[data-push-status]', box), btn = $('[data-push-toggle]', box), test = $('[data-push-test]');
      var paint = function (sub) {
        var blocked = Notification.permission === 'denied';
        status.textContent = sub ? 'On' : blocked ? 'Blocked · allow WKND in your phone\'s Settings → Notifications' : 'Off';
        btn.hidden = blocked && !sub; btn.textContent = sub ? 'Turn off' : 'Turn on';
        btn.className = sub ? 'pill' : 'pill pill--solid';
        if (test) test.hidden = !sub;
      };
      if (!pushSupported) {
        status.textContent = standalone || !/iPhone|iPad/.test(navigator.userAgent) ? 'Not available on this phone' : 'Open WKND from your home screen to turn them on';
      } else {
        getSub().then(paint, function () { status.textContent = 'Off'; btn.hidden = false; });
        btn.addEventListener('click', function () {
          btn.classList.add('is-busy');
          getSub().then(function (sub) { return sub ? pushOff().then(function () { toast('Notifications off', 'info'); }) : pushOn().then(function () { toast('Notifications on'); }); })
            .catch(pushFail).then(function () { btn.classList.remove('is-busy'); return getSub().then(paint); });
        });
        if (test) test.addEventListener('click', function () {
          postJson('/app/push/test').then(function () { toast('Test sent'); }, function (e) { toast(e.message, 'err'); });
        });
      }
      $$('[data-push-kind]', box).forEach(function (sw) {
        sw.addEventListener('change', function () {
          postJson('/app/push/prefs', { key: sw.getAttribute('data-push-kind'), on: sw.checked })
            .catch(function () { sw.checked = !sw.checked; toast('Couldn\'t save that. Try again.', 'err'); });
        });
      });
    }
    // Home's card: on a phone that can, until it's on or put off (asks again after 2 weeks).
    var ask = $('[data-push-ask]');
    if (ask && pushSupported && Notification.permission === 'default') {
      var later = 0; try { later = Number(localStorage.getItem('wknd-push-ask') || 0); } catch (e) {}
      if (Date.now() > later) {
        ask.hidden = false;
        if (!ask._bound) {
          ask._bound = true;
          $('[data-push-ask-on]', ask).addEventListener('click', function () {
            pushOn().then(function () { ask.hidden = true; toast('Notifications on · choose which in Settings'); }, function (e) { pushFail(e); if (Notification.permission !== 'default') ask.hidden = true; });
          });
          $('[data-push-ask-off]', ask).addEventListener('click', function () {
            ask.hidden = true; try { localStorage.setItem('wknd-push-ask', String(Date.now() + 14 * 864e5)); } catch (e) {}
          });
        }
      }
    }
    // The app icon's badge: unread notifications (from the tab bar's data-unread).
    var nav = $('nav.tabbar');
    if (nav && 'setAppBadge' in navigator) {
      var n = Number(nav.getAttribute('data-unread') || 0);
      (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () {});
    }
  }
  // Keep this phone's subscription on the server (once a day).
  if (pushSupported && Notification.permission === 'granted' && document.querySelector('nav.tabbar')) {
    var syncDay = new Date().toDateString(), synced = null;
    try { synced = localStorage.getItem('wknd-push-sync'); } catch (e) {}
    if (synced !== syncDay) getSub().then(function (sub) {
      if (sub) postJson('/app/push/subscribe', { subscription: sub.toJSON() }).then(function () { try { localStorage.setItem('wknd-push-sync', syncDay); } catch (e) {} }, function () {});
    }).catch(function () {});
  }
  // A tapped notification while the app is open: the service worker asks us to go there.
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'open' && e.data.url) { if (navOn) go(urlOf(e.data.url), true); else location.href = e.data.url; }
  });

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

  // ════ Share my stats (views/app/share.js) ════
  // A story-style editor. The card is the site's PNG (/api/games/:id/my-stat-card.png): each
  // template's thumbnail loads small (?thumb=1), the big card as a blob, kept per setting.
  // Tools (top right) swap the bottom fade's template strip for their choices; tapping the
  // tool again or the card brings the strip back. Share: Save image (a download; on iPhone,
  // whose installed app can't download, the share sheet's Save Image), Copy image (the
  // clipboard, to paste into a story), Share to… (the share sheet). Logged as on the site.
  // The last template and colour are remembered on the phone. Zeros are always hidden (no toggle,
  // unlike the site's editor: a 0 says nothing on a story).
  var isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function initShare() {
    var root = $('[data-sh]'); if (!root || root._bound) return;
    root._bound = true;
    var game = root.getAttribute('data-game'), lk = root.getAttribute('data-locked') === '1' ? 1 : 0;
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('wknd-share') || '{}'); } catch (e) {}
    var st = { tpl: 'center', accent: 'amber', focus: root.getAttribute('data-focus') };
    var img = $('[data-sh-img]', root), spin = $('[data-sh-spin]', root), msg = $('[data-sh-msg]', root), lockMsg = $('[data-sh-lockmsg]', root);
    var cache = {}, current = null;
    var url = function (tpl, thumb) {
      return '/api/games/' + encodeURIComponent(game) + '/my-stat-card.png?layout=gauges&align=' + tpl + '&focus=' + st.focus + '&accent=' + st.accent +
        '&gauges=1&hidezeros=1&badge=0&lk=' + lk + (thumb ? '&thumb=1' : '');
    };
    var thumbs = function () { $$('[data-thumb]', root).forEach(function (t) { t.src = url(t.getAttribute('data-thumb'), true); }); };
    var say = function (text) { msg.textContent = text || ''; msg.hidden = !text; };
    var remember = function () { try { localStorage.setItem('wknd-share', JSON.stringify({ tpl: st.tpl, accent: st.accent })); } catch (e) {} };
    // The template strip and its variant chips follow st.tpl.
    function pickTpl(tpl) {
      var tile = $$('[data-tpl]', root).filter(function (t) { return t.getAttribute('data-tpl') === tpl; })[0];
      var chipEl = $$('[data-variant]', root).filter(function (c) { return c.getAttribute('data-variant') === tpl; })[0];
      if (chipEl && !tile) tile = $('[data-fam="' + chipEl.parentNode.getAttribute('data-vars') + '"]', root);
      if (!tile) return false;
      $$('[data-tpl]', root).forEach(function (t) { t.classList.toggle('is-on', t === tile); });
      var fam = tile.getAttribute('data-fam');
      $$('[data-vars]', root).forEach(function (v) { v.hidden = v.getAttribute('data-vars') !== fam; });
      if (chipEl) $$('[data-variant]', chipEl.parentNode).forEach(function (c) { c.classList.toggle('is-on', c === chipEl); });
      st.tpl = tpl;
      if (lockMsg) lockMsg.hidden = !tile.hasAttribute('data-premium');
      return true;
    }
    function render() {
      var k = url(st.tpl, false);
      say('');
      var show = function (c) { if (k !== url(st.tpl, false)) return; current = c; img.src = c.url; img.hidden = false; spin.hidden = true; };
      if (cache[k]) return show(cache[k]);
      spin.hidden = false;
      fetch(k, { credentials: 'same-origin' }).then(function (r) { if (r.status === 401) { location.href = '/app/login'; throw ''; } if (!r.ok) throw 'Couldn\'t make the card. Try again.'; return r.blob(); })
        .then(function (b) { cache[k] = { blob: b, url: URL.createObjectURL(b) }; show(cache[k]); },
          function (e) { if (k !== url(st.tpl, false)) return; spin.hidden = true; say(typeof e === 'string' ? e : 'No connection. The card needs the internet.'); });
    }
    // Panels: the open tool's choices take the template strip's place.
    function panel(name) {
      $$('[data-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      $$('[data-tool]', root).forEach(function (t) { var on = t.getAttribute('data-tool') === name; t.classList.toggle('is-on', on); t.setAttribute('aria-expanded', String(on)); });
    }
    var log = function (action) {
      fetch('/api/games/' + encodeURIComponent(game) + '/stat-card-action', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, template: st.tpl, focus: st.focus, accent: st.accent }) }).catch(function () {});
    };
    var fileOf = function () { return new File([current.blob], 'wknd-stats-' + game + '.png', { type: 'image/png' }); };
    var canShareFile = function () { try { return !!(navigator.canShare && navigator.canShare({ files: [fileOf()] })); } catch (e) { return false; } };
    var sheet = function (action) {
      navigator.share({ files: [fileOf()] }).then(function () { log(action); panel('tpl'); }, function (e) { if (e && e.name !== 'AbortError') say('Sharing didn\'t work. Try Save image.'); });
    };
    var download = function () {
      var a = document.createElement('a'); a.href = current.url; a.download = 'wknd-stats-' + game + '.png';
      document.body.appendChild(a); a.click(); a.remove(); log('save'); panel('tpl'); toast('Saved');
    };
    var copy = function () {
      if (!navigator.clipboard || !window.ClipboardItem) return say('This phone can\'t copy pictures. Use Save image.');
      navigator.clipboard.write([new ClipboardItem({ 'image/png': current.blob })])
        .then(function () { log('copy'); panel('tpl'); toast('Copied. Paste it into your story'); }, function () { say('Couldn\'t copy it. Use Save image.'); });
    };
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) { if (e.target === img || e.target.closest('[data-sh-stage]')) panel('tpl'); return; }
      var on = function (sel) { $$(sel, root).forEach(function (x) { x.classList.toggle('is-on', x === b); }); };
      if (b.hasAttribute('data-tool')) { var t = b.getAttribute('data-tool'); panel(b.classList.contains('is-on') ? 'tpl' : t); }
      else if (b.hasAttribute('data-tpl')) {
        var vars = $('[data-vars="' + b.getAttribute('data-fam') + '"] .is-on', root);
        pickTpl(vars ? vars.getAttribute('data-variant') : b.getAttribute('data-tpl')); remember(); render();
      } else if (b.hasAttribute('data-variant')) { pickTpl(b.getAttribute('data-variant')); remember(); render(); }
      else if (b.hasAttribute('data-accent')) { on('[data-accent]'); st.accent = b.getAttribute('data-accent'); remember(); thumbs(); render(); }
      else if (b.hasAttribute('data-focus')) { on('[data-focus]'); st.focus = b.getAttribute('data-focus'); thumbs(); render(); }
      else if (b.hasAttribute('data-bg')) { on('[data-bg]'); $('[data-sh-stage]', root).setAttribute('style', b.getAttribute('data-css') || ''); }
      else if (b.hasAttribute('data-sh-do')) {
        if (!current) return say('The card is still loading.');
        var act = b.getAttribute('data-sh-do');
        if (act === 'copy') copy();
        else if (act === 'send') { if (canShareFile()) sheet('share'); else download(); }
        else if (isIos && canShareFile()) sheet('save'); else download();
      }
    });
    // The last template and colour used on this phone.
    if (saved.accent && $('[data-accent="' + saved.accent + '"]', root)) { st.accent = saved.accent; $$('[data-accent]', root).forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-accent') === st.accent); }); }
    if (!(saved.tpl && pickTpl(saved.tpl))) pickTpl(st.tpl);
    var onTile = $('.se__tpl.is-on', root); if (onTile) onTile.scrollIntoView({ inline: 'center', block: 'nearest' });
    thumbs(); render();
  }

  // ════ Comments (views/app/comments.js) ════
  // Feed cards: 🔥 toggles at once; 💬, the latest comment and "View all" open the thread in
  // a sheet over the feed. A game screen has the same panel under its box score. Replies are
  // one level deep, folded behind "View N replies". Every answer from /app/thread/:key carries
  // the fresh list and the card's bar, so both stay in step. Handlers sit on the document:
  // cards arrive later in lazy pages and the sheet lives outside the screen.
  var thSend = function (url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) {
        if (r.status === 401) { location.href = '/app/login'; throw ''; }
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw j.error || 'That didn\'t go through. Try again.'; return j; });
      }, function () { throw 'No connection. Try again.'; });
  };
  var thUrl = function (key, rest) { return '/app/thread/' + encodeURIComponent(key) + (rest || ''); };
  function setBars(key, html) {
    if (typeof html !== 'string') return;
    $$('[data-cx]').forEach(function (b) { if (b.getAttribute('data-cx') === key) b.outerHTML = html; });
  }
  function setThread(th, j) {
    $('[data-th-list]', th).innerHTML = j.html;
    th.setAttribute('data-th-count', j.count);
    var sec = th.closest('.th-sec'), label = sec && $('[data-th-count-label]', sec);
    if (label) label.textContent = j.count ? ' · ' + j.count : '';
    setBars(th.getAttribute('data-th'), j.bar);
  }
  function thReplyTo(th, topId, name) {
    var form = $('[data-th-form]', th); if (!form) return;
    var to = $('[data-th-to]', form), input = $('[data-th-input]', form);
    form.setAttribute('data-parent', topId || '');
    to.hidden = !topId;
    if (topId) {
      $('[data-th-to-name]', to).textContent = name;
      if (input.value.indexOf('@' + name) < 0) input.value = '@' + name + ' ' + input.value.replace(/^\s+/, '');
      thInput(input);
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  }
  var thPeople = function (th) { if (!th._people) { try { th._people = JSON.parse(($('[data-th-people]', th) || {}).textContent || '[]'); } catch (e) { th._people = []; } } return th._people; };
  // Typing: the send button wakes up, the box grows to five lines, and "@Fir…" offers names.
  function thInput(input) {
    var form = input.form, th = input.closest('[data-th]');
    var has = !!input.value.trim();
    $('[data-th-send]', form).disabled = !has;
    if (has) form.setAttribute('data-dirty', '1'); else form.removeAttribute('data-dirty');
    input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    var box = $('[data-th-at]', form);
    var m = /(?:^|\s)@([^@\n]{0,24})$/.exec(input.value.slice(0, input.selectionEnd || input.value.length));
    var q = m ? m[1].toLowerCase() : null;
    var hits = q === null || q.split(' ').length > 3 ? [] : thPeople(th).filter(function (p) {
      var n = p.name.toLowerCase(); return !q || n.indexOf(q) === 0 || n.indexOf(' ' + q) >= 0;
    }).slice(0, 5);
    box.hidden = !hits.length;
    box.innerHTML = '';
    hits.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = p.name; b.setAttribute('data-th-pick', p.name);
      box.appendChild(b);
    });
  }
  function thSubmit(form) {
    var th = form.closest('[data-th]'), input = $('[data-th-input]', form), msg = $('[data-th-msg]', form), btn = $('[data-th-send]', form);
    var body = input.value.trim();
    if (!body || form.getAttribute('data-busy')) return;
    form.setAttribute('data-busy', '1'); btn.disabled = true; msg.hidden = true;
    var parent = form.getAttribute('data-parent') || '';
    thSend(thUrl(th.getAttribute('data-th')), { body: body, parentId: parent || undefined }).then(function (j) {
      form.removeAttribute('data-busy');
      input.value = ''; thInput(input); thReplyTo(th, '');
      setThread(th, j);
      var list = $('[data-th-list]', th);
      var rows = parent ? $$('[data-ct-kids="' + parent + '"] .ct', list) : $$('.th__list > .ct', th);
      var last = rows[rows.length - 1];
      if (last) { last.classList.add('is-new'); last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }, function (e) {
      form.removeAttribute('data-busy'); btn.disabled = false;
      if (e) { msg.textContent = e; msg.hidden = false; }
    });
  }

  // The sheet over the feed. It follows the part of the screen the keyboard leaves free.
  var sheet = null;
  function fitSheet() {
    if (!sheet || !window.visualViewport) return;
    sheet.style.top = visualViewport.offsetTop + 'px';
    sheet.style.height = visualViewport.height + 'px';
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitSheet); visualViewport.addEventListener('scroll', fitSheet); }
  // The page under the sheet holds still where it was: pinned in place while the sheet is up
  // (iPhone otherwise scrolls the page under it, or jumps it to the top), put back on close.
  var lockY = 0;
  function lockPage() {
    lockY = window.scrollY;
    var b = document.body.style; b.position = 'fixed'; b.top = -lockY + 'px'; b.left = '0'; b.right = '0';
  }
  function unlockPage() {
    var b = document.body.style; b.position = b.top = b.left = b.right = '';
    window.scrollTo(0, lockY);
  }
  function closeSheet(now) {
    var el = sheet; if (!el) return;
    sheet = null;
    document.documentElement.classList.remove('has-sheet');
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    unlockPage();
    if (now || reducedMotion.matches) { el.remove(); return; }
    el.classList.remove('is-open');
    setTimeout(function () { el.remove(); }, 260);
  }
  function openSheet(key) {
    closeSheet(true);
    var el = document.createElement('div');
    el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Comments');
    el.innerHTML = '<div class="sheet__scrim" data-sheet-x></div><div class="sheet__box"><div class="sheet__head"><span class="sheet__grab" aria-hidden="true"></span><b>Comments</b><button type="button" class="sheet__x" data-sheet-x aria-label="Close">✕</button></div><div class="sheet__body"><div class="sheet__load"><span class="ptr__spin"></span></div></div></div>';
    lockPage();
    document.body.appendChild(el);
    document.documentElement.classList.add('has-sheet');
    sheet = el; fitSheet();
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-open'); }); });
    fetch(thUrl(key), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (r.status === 401) { location.href = '/app/login'; throw ''; } return r.json().then(function (j) { if (!r.ok) throw j.error || 'Couldn\'t load the comments.'; return j; }); },
        function () { throw 'No connection. Comments need the internet.'; })
      .then(function (j) {
        if (sheet !== el) return;
        $('.sheet__body', el).innerHTML = j.panel;
        setBars(key, j.bar);
        var list = $('[data-th-list]', el); list.scrollTop = list.scrollHeight;
      }).catch(function (e) {
        if (sheet !== el || !e) return;
        var p = document.createElement('p'); p.className = 'ct__empty'; p.textContent = e;
        $('.sheet__body', el).innerHTML = ''; $('.sheet__body', el).appendChild(p);
      });
    // Swipe down to close: from the top bar, or anywhere in the comments once they're scrolled
    // to the top (a swipe up still scrolls them). Not from the box you type in.
    var box = $('.sheet__box', el), y0 = null, dy = 0, list = null, dragging = false;
    box.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1 || (e.target.closest && e.target.closest('.th__comp'))) { y0 = null; return; }
      list = e.target.closest && e.target.closest('.th__list');
      y0 = e.touches[0].clientY; dy = 0; dragging = false;
    }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      var d = e.touches[0].clientY - y0;
      if (!dragging) {
        if (d <= 0 || (list && list.scrollTop > 0)) { if (d < 0 || (list && list.scrollTop > 0)) y0 = null; return; }
        dragging = true; box.style.transition = 'none';
      }
      e.preventDefault(); // the sheet moves, not the list behind the finger
      dy = Math.max(0, d); box.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: false });
    var end = function () {
      if (y0 === null && !dragging) return;
      y0 = null;
      if (!dragging) return;
      dragging = false; box.style.transition = ''; box.style.transform = '';
      if (dy > 90) closeSheet();
    };
    box.addEventListener('touchend', end); box.addEventListener('touchcancel', end);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet) closeSheet();
    var input = e.target.closest && e.target.closest('[data-th-input]');
    if (input && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); thSubmit(input.form); }
  });
  document.addEventListener('input', function (e) { var input = e.target.closest && e.target.closest('[data-th-input]'); if (input) thInput(input); });
  document.addEventListener('submit', function (e) { var form = e.target.closest && e.target.closest('[data-th-form]'); if (form) { e.preventDefault(); thSubmit(form); } });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var b;
    if ((b = t.closest('[data-sheet-x]'))) return closeSheet();
    if ((b = t.closest('[data-cx-open]'))) return openSheet(b.closest('[data-cx]').getAttribute('data-cx'));
    if ((b = t.closest('[data-cx-fire]'))) {
      var bar = b.closest('[data-cx]'), key = bar.getAttribute('data-cx');
      if (bar.getAttribute('data-busy')) return;
      bar.setAttribute('data-busy', '1');
      var on = !b.classList.contains('is-on'), n = $('span:last-child', b), was = n.textContent;
      var cnt = (Number(was) || 0) + (on ? 1 : -1);
      b.classList.toggle('is-on', on); b.classList.add('is-pop'); n.textContent = cnt > 0 ? cnt : 'Fire';
      thSend(thUrl(key, '/fire')).then(function (j) { setBars(key, j.bar); }, function (err) {
        bar.removeAttribute('data-busy'); b.classList.toggle('is-on', !on); n.textContent = was; if (err) toast(err, 'err');
      });
      return;
    }
    var th = t.closest('[data-th]'); if (!th) return;
    var key2 = th.getAttribute('data-th');
    if ((b = t.closest('[data-th-pick]'))) {
      var input = $('[data-th-input]', th), end = input.selectionEnd || input.value.length;
      var before = input.value.slice(0, end).replace(/@([^@\n]{0,24})$/, '@' + b.getAttribute('data-th-pick') + ' ');
      input.value = before + input.value.slice(end);
      thInput(input); input.focus();
      try { input.setSelectionRange(before.length, before.length); } catch (x) {}
      return;
    }
    if ((b = t.closest('[data-th-to-x]'))) return thReplyTo(th, '');
    if ((b = t.closest('[data-ct-toggle]'))) {
      var id = b.getAttribute('data-ct-toggle'), kids = $('[data-ct-kids="' + id + '"]', th), n2 = Number(kids.getAttribute('data-n'));
      kids.hidden = !kids.hidden;
      b.setAttribute('aria-expanded', String(!kids.hidden));
      $('span', b).textContent = kids.hidden ? 'View ' + n2 + ' repl' + (n2 === 1 ? 'y' : 'ies') : 'Hide replies';
      return;
    }
    if ((b = t.closest('[data-ct-reply]'))) return thReplyTo(th, b.getAttribute('data-ct-reply'), b.getAttribute('data-ct-name'));
    if ((b = t.closest('[data-ct-del]'))) {
      if (!window.confirm('Delete this comment?' + ($('[data-ct-kids="' + b.getAttribute('data-ct-del') + '"]', th) ? ' Its replies go too.' : ''))) return;
      thSend(thUrl(key2, '/comments/' + encodeURIComponent(b.getAttribute('data-ct-del')) + '/delete')).then(function (j) { setThread(th, j); toast('Comment deleted'); }, function (err) { if (err) toast(err, 'err'); });
      return;
    }
    if ((b = t.closest('[data-ct-fire]'))) {
      if (b.getAttribute('data-busy')) return;
      b.setAttribute('data-busy', '1');
      var on2 = !b.classList.contains('is-on'), c = $('span', b), was2 = c.textContent, next = (Number(was2) || 0) + (on2 ? 1 : -1);
      b.classList.toggle('is-on', on2); b.classList.add('is-pop'); b.setAttribute('aria-pressed', String(on2)); c.textContent = next > 0 ? next : '';
      thSend(thUrl(key2, '/comments/' + encodeURIComponent(b.getAttribute('data-ct-fire')) + '/fire')).then(function (j) {
        b.removeAttribute('data-busy'); b.classList.toggle('is-on', j.reacted); c.textContent = j.count || '';
      }, function (err) { b.removeAttribute('data-busy'); b.classList.toggle('is-on', !on2); c.textContent = was2; if (err) toast(err, 'err'); });
    }
  });
  // ?thread=<key> (a notification about comments): the thread's panel on this screen, else
  // the sheet. Handled once; the address loses it.
  function initThreads() {
    var m = /[?&]thread=([^&]+)/.exec(location.search);
    if (!m) return;
    var key = decodeURIComponent(m[1]);
    var clean = location.pathname + location.search.replace(/([?&])thread=[^&]+&?/, '$1').replace(/[?&]$/, '');
    try { history.replaceState(history.state, '', clean); } catch (e) {}
    if (typeof currentUrl !== 'undefined') currentUrl = clean;
    var inline = $$('main.app [data-th]').filter(function (x) { return x.getAttribute('data-th') === key; })[0];
    if (inline) { var sec = inline.closest('.th-sec') || inline; setTimeout(function () { sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); }
    else openSheet(key);
  }

  // ════ Lazy lists (views/app/layout.js lazyList) ════
  // The first page loads as soon as the screen is up; the next one when the bottom of the
  // list comes within ~600px. Each answer is { html, next }.
  var lazyObservers = [];
  function initLazyLists() {
    lazyObservers.forEach(function (o) { o.disconnect(); }); lazyObservers = [];
    $$('[data-lazy-src]').forEach(function (box) {
      var items = $('.lazy__items', box), skel = $('.lazy__skel', box), end = $('.lazy__end', box);
      // A screen put back from memory (see "Kept screens") carries on where it was: its rows
      // are there, data-lazy-next says what's left.
      var resumed = box.hasAttribute('data-lazy-next');
      var next = resumed ? box.getAttribute('data-lazy-next') : box.getAttribute('data-lazy-src'), busy = false;
      // The first page: the copy on the phone (public/app-sw.js keeps one) shows at once, then
      // the network's answer replaces it, or is skipped when it's the same.
      var first = !resumed, shownCopy = null;
      if (first && window.caches) {
        caches.match(next, { cacheName: 'wknd-data' }).then(function (r) { return r && r.json(); }).then(function (j) {
          if (!j || !j.html || !first || !box.isConnected) return;
          shownCopy = j.html;
          items.innerHTML = j.html; items.hidden = false; skel.hidden = true; initVideos(); initPapawis();
        }).catch(function () {});
      }
      var nearBottom = function () { return end.getBoundingClientRect().top < window.innerHeight + 600; };
      var load = function () {
        if (busy || !next) return;
        busy = true;
        fetch(next, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { if (r.status === 401) { location.href = '/app/login'; throw 0; } if (!r.ok) throw r.status; return r.json(); })
          .then(function (j) {
            busy = false; next = j.next || null; box.setAttribute('data-lazy-next', next || '');
            var wasFirst = first; first = false;
            // Feed pages can carry Papawis cards with their join button (initPapawis binds new ones).
            if (wasFirst && shownCopy !== null) { if (j.html !== shownCopy) { items.innerHTML = j.html || ''; initVideos(); initPapawis(); } }
            else if (j.html) { items.hidden = false; items.insertAdjacentHTML('beforeend', j.html); initVideos(); initPapawis(); }
            skel.hidden = true;
            if (!items.children.length) { end.className = 'lazy__end empty'; end.textContent = box.getAttribute('data-lazy-empty') || 'Nothing yet.'; return; }
            end.textContent = '';
            if (next && (!io || nearBottom())) { if (io) load(); else showMore(); }
          })
          .catch(function (e) {
            busy = false; if (e === 0) return;
            if (first && shownCopy !== null) { first = false; return; } // offline: the copy stays
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
      if (!resumed) load(); else if (next && !io) showMore();
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
    if (!navOn) { location.reload(); return new Promise(function () {}); }
    var id = navId;
    return fetchPage(currentUrl, true).then(function (p) { if (id === navId) render(p, false, true); }, function () {});
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
  // ════ Kept screens ════
  // A screen with a lazy list (the feed, notifications) is kept as it was when the player
  // left it: its loaded rows, pictures and scroll position. Going back to it (back swipe or
  // its tab) puts that same screen back instead of rebuilding it from the server and loading
  // the list again. Kept 10 minutes; pull to refresh fetches it fresh.
  var kept = {};
  var KEEP_MS = 10 * 60 * 1000;
  function keepScreen(url, main, y) {
    if (!main || !main.querySelector('[data-lazy-next]')) return;
    // A video player can't move with the screen (its frame reloads): back to its cover.
    $$('.player[data-mounted]', main).forEach(function (b) {
      if (b._cover != null) b.innerHTML = b._cover;
      b.removeAttribute('data-mounted'); b.className = 'media player';
    });
    kept[url] = { el: main, y: y, title: document.title, at: Date.now() };
  }
  function takeKept(url) {
    var k = kept[url]; delete kept[url];
    return k && Date.now() - k.at < KEEP_MS ? k : null;
  }

  var pendingSwap = null;
  // page: { html, url } from the server, or { el, y, url } for a kept screen (with html, when
  // there is one, for its tab bar).
  function render(page, push, keepScroll, dir) {
    if (pendingSwap && !dir) {
      var want = navId; // dropped if the player has moved on by then
      pendingSwap.then(function () { if (want === navId) render(page, push, keepScroll, dir); });
      return;
    }
    var doc = new DOMParser().parseFromString(page.html || '', 'text/html');
    var newVer = (doc.querySelector('meta[name="app-ver"]') || {}).content || '';
    if (newVer && ver && newVer !== ver) { location.href = page.url; return; } // new deploy: load it properly
    var newMain = page.el || doc.querySelector('main.app');
    if (!$('main.app') || !newMain) { location.href = page.url; return; }
    var fromUrl = currentUrl;
    var y = window.scrollY;
    if (push) {
      try { history.replaceState(Object.assign({}, history.state, { y: y }), ''); } catch (e) {}
      history.pushState({ app: 1 }, '', page.url);
    }
    currentUrl = page.url;
    // The tab bar holds still only between two screens that both have it; otherwise it
    // moves with the screen it belongs to (setup has none), like an iPhone app.
    var oldNav = $('nav.tabbar'), keepBar = !!oldNav && (!!doc.querySelector('nav.tabbar') || !!page.el);
    if (oldNav && !keepBar) oldNav.style.viewTransitionName = 'none';
    var swap = function () {
      var old = $('main.app');
      if (old !== newMain) keepScreen(fromUrl, old, y); // before the title changes: it keeps that too
      document.title = page.title || doc.title || document.title;
      old.replaceWith(page.el ? newMain : document.importNode(newMain, true));
      var nav = $('nav.tabbar'), newNav = doc.querySelector('nav.tabbar');
      if (page.el && !newNav) { // no fresh tab bar to hand: light the right tab on this one
        $$('.tab').forEach(function (t) { var on = urlOf(t.href) === page.url; t.classList.toggle('is-on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
        newNav = null; nav = null;
      }
      if (nav) nav.remove();
      if (newNav) {
        var added = document.body.insertBefore(document.importNode(newNav, true), $('main.app').nextSibling);
        if (!keepBar) { added.style.viewTransitionName = 'none'; setTimeout(function () { added.style.viewTransitionName = ''; }, 400); }
      }
      $$('.update-bar').forEach(function (b) { b.remove(); });
      if (page.el) window.scrollTo(0, page.y || 0);
      else if (!keepScroll) window.scrollTo(0, push ? 0 : ((history.state && history.state.y) || 0));
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

  function go(url, push, still) {
    closeSheet(true);
    var id = ++navId;
    var dir = still ? undefined : direction(currentUrl, url);
    var k = takeKept(url);
    if (k) {
      var html = pages[url] ? pages[url].html : '';
      render({ el: k.el, y: k.y, title: k.title, url: url, html: html }, push, false, dir);
      // The tab bar's badges can have changed meanwhile: take them from a fresh copy, leave
      // the screen as it was.
      if (navigator.onLine) fetchPage(url).then(function (fresh) {
        if (id !== navId) return;
        var nb = new DOMParser().parseFromString(fresh.html, 'text/html').querySelector('nav.tabbar'), cur = $('nav.tabbar');
        if (nb && cur && nb.innerHTML !== cur.innerHTML) cur.innerHTML = nb.innerHTML;
      }).catch(function () {});
      return;
    }
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
    // Back (iPhone's edge swipe, Android's back): iPhone animates the swipe itself, so the
    // screen goes in without our slide on top of it.
    window.addEventListener('popstate', function () { go(urlOf(location.href), false, true); });
    // Fetch the other tabs once the first screen is up.
    // The screen it opened on too, from the server: a copy of the live page (countdown ticked,
    // lists loaded) would never match a refresh and force a re-render on every return.
    var warmTabs = function () { prefetch(urlOf(location.href)); $$('.tabbar a.tab').forEach(function (a) { prefetch(urlOf(a.href)); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(warmTabs, { timeout: 2000 }); else setTimeout(warmTabs, 800);
  }

  // ════ Pull to refresh ════
  // On a screen with the tab bar, pulling down from the very top and letting go past the
  // mark reloads the screen (refreshScreen; the feed fetches its first page again). The
  // spinner follows the finger, turns amber once letting go would refresh, and spins until
  // the fresh screen is in.
  if (navOn) (function () {
    var el = null, startY = null, pull = 0, busy = false, MARK = 64;
    var show = function (px, dragging) {
      if (!el) { el = document.createElement('div'); el.className = 'ptr'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<span class="ptr__spin"></span>'; document.body.appendChild(el); }
      el.style.transition = dragging ? 'none' : ''; // follow the finger; ease back on release
      el.style.transform = 'translateY(' + px + 'px)';
      el.style.opacity = Math.min(1, px / MARK);
      el.firstChild.style.transform = busy ? '' : 'rotate(' + (px * 4) + 'deg)';
      el.classList.toggle('is-ready', px >= MARK);
    };
    document.addEventListener('touchstart', function (e) {
      startY = null;
      if (busy || sheet || e.touches.length > 1 || window.scrollY > 0 || !$('nav.tabbar') || (e.target.closest && e.target.closest('.player'))) return;
      startY = e.touches[0].clientY; pull = 0;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      var dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) { if (pull) { pull = 0; show(0); } return; }
      pull = Math.min(110, dy * 0.5); show(pull, true);
    }, { passive: true });
    var end = function () {
      if (startY === null) return;
      startY = null;
      if (pull < MARK) { pull = 0; if (el) show(0); return; }
      busy = true; pull = 0; show(MARK); el.classList.add('is-busy');
      var t0 = Date.now();
      var done = function () { setTimeout(function () { busy = false; el.classList.remove('is-busy'); show(0); }, Math.max(0, 450 - (Date.now() - t0))); };
      refreshScreen().then(done, done);
    };
    document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
  })();

  // No pinch zoom (iPhone ignores user-scalable=no; its own gesture events can be stopped).
  ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });

  initPage();

  // ════ Launch from the phone's copy ════
  // The service worker answers a launch with the copy of the screen on the phone (instant),
  // fetching a fresh one behind it. A page built more than 15 s ago is that copy: swap in the
  // fresh screen quietly as soon as it's here. And a copy that belongs to a different player
  // than the one signed in (shouldn't happen: sign-in pages wipe them) is wiped and reloaded.
  var builtAt = Number(($('meta[name="app-time"]') || {}).content || 0);
  var who = ($('meta[name="app-who"]') || {}).content || '';
  var wipeCopies = function () {
    try { localStorage.removeItem('wknd-who'); } catch (e) {}
    return window.caches ? Promise.all(['wknd-pages', 'wknd-data'].map(function (k) { return caches.delete(k); })) : Promise.resolve();
  };
  if (who) {
    var lastWho = null; try { lastWho = localStorage.getItem('wknd-who'); } catch (e) {}
    if (lastWho && lastWho !== who) wipeCopies().then(function () { if (Date.now() - builtAt > 15000) location.reload(); });
    try { localStorage.setItem('wknd-who', who); } catch (e) {}
  }
  if (navOn && builtAt && Date.now() - builtAt > 15000 && navigator.onLine) refreshScreen();
  // Log out: wipe the copies first, so the next person on this phone sees none of them.
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.getAttribute('action') !== '/app/logout' || f._wiped) return;
    e.preventDefault(); f._wiped = true;
    var done = function () { f.submit(); };
    // And this phone stops getting the player's notifications.
    var off = pushSupported ? pushOff().catch(function () {}) : Promise.resolve();
    Promise.all([wipeCopies(), off]).then(done, done);
  });

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
