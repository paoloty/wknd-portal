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
  // (Not one still waiting to be woken: no src yet reads as "complete" with no width.)
  $$('.media img, .gx__hero img, .nx__pic img').forEach(function (img) { if (img.getAttribute('src') && img.complete && !img.naturalWidth) imgFailed(img); });

  // ════ A player's profile (views/app/season.js appPlayerPage) ════
  // The cover drifts at half the scroll (parallax) and stretches on a pull down at the top; the
  // back button sits on a dark pill until the nav turns solid past the cover; once the name has
  // gone under the nav, the sticky bar under it shows the photo, first name and the section
  // chips (the one in view lit). Chips jump to their section; the name goes back to the top.
  // Reduce Motion: no parallax, the bar just switches.
  var ppOff = null;
  function initProfile() {
    if (ppOff) ppOff();
    var pp = $('[data-pp]'); if (!pp) return;
    var cover = $('[data-pp-cover]', pp), img = cover && $('img, .pp-cover__art', cover), name = $('[data-pp-name]', pp), nav = $('.pp-nav', pp);
    var chips = $$('[data-pp-go]', $('[data-pp-jump]', pp));
    // tapped: the chip just tapped stays lit while the page scrolls there (a section near the end
    // can't reach the top), until the player scrolls themselves.
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches, raf = 0, tapped = -1;
    var navBottom = function () { return nav ? nav.getBoundingClientRect().bottom : 44; };
    var paint = function () {
      raf = 0;
      if (!pp.isConnected) return off();
      var y = window.scrollY, ch = cover.offsetHeight || 1, nb = navBottom();
      if (img && !still) img.style.transform = y < 0 ? 'scale(' + (1 + -y / ch).toFixed(3) + ')' : y < ch ? 'translate3d(0,' + Math.round(y * 0.5) + 'px,0)' : '';
      var top = name.getBoundingClientRect().top;
      var mini = still ? (top < nb ? 1 : 0) : Math.max(0, Math.min(1, (nb + 10 - top) / 30));
      pp.style.setProperty('--pp-mini', mini.toFixed(3));
      pp.classList.toggle('is-mini', mini > 0.5);
      pp.classList.toggle('is-solid', cover.getBoundingClientRect().bottom <= nb + 2);
      var cur = 0;
      chips.forEach(function (c, i) { var s = document.getElementById(c.getAttribute('data-pp-go')); if (s && s.getBoundingClientRect().top <= nb + 80) cur = i; });
      // At the very end of the page: the last section in view, since it can't scroll any higher.
      if (window.innerHeight + y >= document.documentElement.scrollHeight - 4) chips.forEach(function (c, i) { var s = document.getElementById(c.getAttribute('data-pp-go')); if (s && s.getBoundingClientRect().top < window.innerHeight - 80) cur = i; });
      if (tapped >= 0) cur = tapped;
      chips.forEach(function (c, i) { c.classList.toggle('is-on', i === cur); });
    };
    var onScroll = function () { if (!raf) raf = requestAnimationFrame(paint); };
    var own = function () { if (tapped >= 0) { tapped = -1; onScroll(); } };
    var off = function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); window.removeEventListener('touchstart', own); window.removeEventListener('wheel', own); ppOff = null; };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('touchstart', own, { passive: true });
    window.addEventListener('wheel', own, { passive: true });
    ppOff = off;
    // Bound again on each setup (this run's tapped and chips), the last one taken off.
    if (pp._ppClick) pp.removeEventListener('click', pp._ppClick);
    {
      pp.addEventListener('click', pp._ppClick = function (e) {
        var go = e.target.closest('[data-pp-go]'), up = e.target.closest('[data-pp-top]');
        if (!go && !up) return;
        e.preventDefault();
        var s = go && document.getElementById(go.getAttribute('data-pp-go'));
        tapped = go ? chips.map(function (c) { return c.getAttribute('data-pp-go'); }).indexOf(go.getAttribute('data-pp-go')) : -1;
        window.scrollTo({ top: s ? Math.max(0, window.scrollY + s.getBoundingClientRect().top - navBottom() - 58) : 0, behavior: still ? 'auto' : 'smooth' });
      });
    }
    paint();
  }

  // Me → cover photo: shrunk on the phone first (a 12 MP photo would take ages on a weak signal),
  // then cropped wide by the server (POST /app/me/cover). Remove goes back to the latest game's.
  var coverBusy = false;
  document.addEventListener('click', function (e) {
    // Your profile's camera on the photo: the same upload as setup's photo step (its input is on the page).
    var ph = e.target.closest && e.target.closest('[data-photo-pick]');
    if (ph) { var pin = $('[data-photo-input]'); if (pin) pin.click(); return; }
    var pick = e.target.closest && e.target.closest('[data-cover-pick]');
    if (pick) { var inp = $('[data-cover-input]'); if (inp) { inp.value = ''; inp.click(); } return; }
    var rm = e.target.closest && e.target.closest('[data-cover-remove]');
    if (!rm || coverBusy) return;
    if (!window.confirm('Remove your cover photo? Your profile goes back to your team’s colours.')) return;
    coverBusy = true;
    postJson('/app/me/cover/remove', {}).then(function () { coverBusy = false; toast('Cover removed'); refreshScreen(true); }, function (err) { coverBusy = false; toast(err && err.message && err.message !== 'failed' ? err.message : 'That didn’t go through. Try again.', 'err'); });
  });
  document.addEventListener('change', function (e) {
    var inp = e.target.closest && e.target.closest('[data-cover-input]');
    if (!inp || !inp.files || !inp.files[0] || coverBusy) return;
    var file = inp.files[0];
    if (!/^image\//.test(file.type || '')) return toast('That isn’t a photo.', 'err');
    if (!navigator.onLine) return toast('You’re offline. Nothing was sent.', 'err');
    coverBusy = true; toast('Uploading your cover…', 'info');
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var s = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      postJson('/app/me/cover', { dataUrl: c.toDataURL('image/jpeg', 0.86) }).then(function () { coverBusy = false; toast('Cover saved'); refreshScreen(true); },
        function (err) { coverBusy = false; toast(err && err.message && err.message !== 'failed' ? err.message : 'That didn’t go through. Try again.', 'err'); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); coverBusy = false; toast('Couldn’t read that photo. Try another.', 'err'); };
    img.src = url;
  });

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
  function initBlocks() {
    $$('[data-block-src]').forEach(function (b) {
      // data-block-later: the server knows there's nothing to show yet (no game live), so no
      // request now, only the slow check below.
      if (!b.hasAttribute('data-block-later')) loadBlock(b);
      // A block that keeps itself fresh (Home's live card): again every N ms while it's on
      // screen, or every data-block-idle ms while it's empty (nothing live, nothing to poll for).
      var every = Number(b.getAttribute('data-block-every')), idle = Number(b.getAttribute('data-block-idle')) || every;
      if (!every || b._every) return;
      var tick = function () {
        if (!b.isConnected) return;
        if (document.visibilityState === 'visible') loadBlock(b, true);
        b._every = setTimeout(tick, b.hidden ? idle : every);
      };
      b._every = setTimeout(tick, b.hidden ? idle : every);
    });
  }
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
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
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
      + '<button type="button" class="player__fs" aria-label="Full screen">' + FULL + '</button></div>'
      + '<button type="button" class="player__expand" aria-label="Full screen">' + FULL + '</button>'
      + '<button type="button" class="player__close" aria-label="Close video">' + CLOSE + '</button>');
    var seek = $('.player__seek', box), time = $('.player__time', box), dragging = false, player = null, timer = null;
    var playing = function () { return player && player.getPlayerState && player.getPlayerState() === 1; };
    var toggle = function () { if (!player || !player.playVideo) return; if (playing()) player.pauseVideo(); else player.playVideo(); };
    var paint = function () {
      if (!player || !player.getDuration) return;
      var d = player.getDuration() || 0, t = player.getCurrentTime() || 0;
      seek.max = Math.floor(d);
      if (!dragging) seek.value = Math.floor(t);
      seek.style.setProperty('--p', d ? (seek.value / d * 100) + '%' : '0%');
      box.style.setProperty('--prog', d ? (t / d * 100) + '%' : '0%'); // the mini player's progress line
      time.textContent = mmss(dragging ? seek.value : t) + (d ? ' / ' + mmss(d) : '');
    };
    $('.player__tap', box).addEventListener('click', toggle);
    // From the mini player, full screen starts from the video's own spot.
    var goFull = function () { if (box.classList.contains('is-float')) setFloat(false); fullScreen(box); };
    $('.player__fs', box).addEventListener('click', goFull);
    $('.player__expand', box).addEventListener('click', goFull);
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

    // Mini player: a playing video scrolled off screen floats at the bottom right (above the
    // tab bar) and keeps playing; a spacer holds its place so nothing below it moves. Scrolling
    // back to the spot puts it back. The X pauses it and puts it back, and it stays put until
    // it's played again. The frame is never moved in the page (that would reload YouTube).
    var spacer = null, dismissed = false;
    var floatIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      if (!box.isConnected) { floatIO.disconnect(); return; }
      es.forEach(function (en) {
        var out = !en.isIntersecting || en.intersectionRatio < 0.3;
        if (en.target === box && out && playing() && !dismissed && !box.classList.contains('is-full') && !box.classList.contains('is-float')) setFloat(true);
        else if (en.target === spacer && !out) setFloat(false);
      });
    }, { threshold: [0, 0.3] }) : null;
    function setFloat(on) {
      if (!floatIO) return;
      if (on) {
        var cs = getComputedStyle(box);
        spacer = document.createElement('div');
        spacer.className = 'player__spacer';
        spacer.style.height = box.offsetHeight + 'px';
        spacer.style.margin = cs.margin;
        box.parentNode.insertBefore(spacer, box);
        box.classList.add('is-float');
        floatIO.unobserve(box); floatIO.observe(spacer);
      } else {
        box.classList.remove('is-float');
        if (spacer) { floatIO.unobserve(spacer); spacer.remove(); spacer = null; }
        floatIO.observe(box);
      }
    }
    $('.player__close', box).addEventListener('click', function () {
      dismissed = true;
      if (player && player.pauseVideo) player.pauseVideo();
      setFloat(false);
    });
    if (floatIO) floatIO.observe(box);
    loadYt().then(function (YT) {
      player = new YT.Player($('.player__frame', box), {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1 },
        events: {
          onReady: function () { box.classList.add('is-ready'); paint(); timer = setInterval(function () { if (!box.isConnected) return clearInterval(timer); paint(); }, 250); },
          onStateChange: function (e) {
            var on = e.data === 1 || e.data === 3; // playing / buffering
            if (on) box.classList.add('is-started');
            if (e.data === 1) dismissed = false; // played again: it may float again
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

  // Feed pictures below the top cards come as data-src (views/app/feed.js deferImgs) and get
  // their real src once they're within a screen or so of view.
  var imgObserver = null;
  var wakeImg = function (img) {
    var set = img.getAttribute('data-srcset');
    if (set) { img.setAttribute('srcset', set); img.removeAttribute('data-srcset'); }
    img.setAttribute('src', img.getAttribute('data-src')); img.removeAttribute('data-src');
  };
  function wakeImgs(root) {
    var imgs = $$('img[data-src]', root || document);
    if (!imgs.length) return;
    if (!('IntersectionObserver' in window)) return imgs.forEach(wakeImg);
    if (!imgObserver) imgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { imgObserver.unobserve(en.target); if (en.target.hasAttribute('data-src')) wakeImg(en.target); } });
    }, { rootMargin: '1000px 0px' });
    imgs.forEach(function (img) { imgObserver.observe(img); });
  }

  // ════ Poll takeover (views/app/poll.js) ════
  // Home brings it in its HTML when a popup poll is waiting on this player. It's lifted out
  // of the screen onto the page (so screen changes and view transitions leave it alone) and
  // opens after a beat. Ways out: a vote (through the site's POST /polls/:id/vote), or "Ask
  // me later" when the poll allows it, kept on this phone till the next Manila day under the
  // site popup's key. A vote is also kept here, so Home's copy on the phone doesn't ask
  // again before it's refreshed.
  var tkTimer = null;
  // ════ The scorer (views/app/score.js) ════ Its script (public/scorer.js, with the shared
  // engine public/score-engine.js) loads only on that screen, as a module, then draws it.
  function initScorer() {
    var el = $('[data-scorer]');
    if (!el || el._scLoading) return;
    el._scLoading = true;
    // Never hang on "Loading the scorer": an error shows itself (with Reload), and so does a
    // load that's still going after 10 s.
    var fail = function (why) {
      var r = $('[data-sc-root]', el);
      if (!r || $('.sc-board', r)) return;
      r.innerHTML = '<div class="sc-fail"><div class="msg msg--err" role="alert">The scorer didn\'t open' + (why ? ': <b>' + String(why).replace(/[<>&]/g, '') + '</b>' : '.') + '</div>'
        + '<p class="foot-note">Your plays are safe on this phone. Reload to try again; if it keeps happening, send Paolo a screenshot of this.</p>'
        + '<div class="sc-fail__btn"><button type="button" class="btn" onclick="location.reload()">Reload</button></div></div>';
      var pill = $('[data-sc-sync]', el); if (pill) pill.textContent = 'Not loaded';
    };
    setTimeout(function () { if (document.contains(el) && !$('.sc-board', el)) fail('still loading after 10 seconds'); }, 10000);
    var go = function () {
      try { var p = window.wkndScorer.mount(el); if (p && p.catch) p.catch(function (e) { fail(e && e.message); }); }
      catch (e) { fail(e && e.message); }
    };
    if (window.wkndScorer) return go();
    var s = document.createElement('script'); s.type = 'module'; s.src = '/scorer.js?v=' + ver;
    s.onload = go;
    s.onerror = function () { el._scLoading = false; fail('the scorer file didn’t download (connection?)'); };
    document.head.appendChild(s);
  }
  // A game being scored (views/app/feed.js appLiveParts): public/live-score.js keeps it fresh,
  // and on every other screen closes its socket.
  // Live chat on a live game (views/live-chat.js): public/live-chat.js, loaded on that screen.
  // ════ The app's live connection (server.js /ws/app, Barkadahan) ════
  // Open while the app is on screen (that's what "online" means), closed when it's put away.
  // It brings the Barkadahan's news: the online count, new messages (the Home icon's count
  // goes up when you're not in the room), reactions, deletions, typing. The room's own script
  // (public/barkadahan.js) listens for 'wknd:bk'. meta app-bk = this player's id, only when on.
  (function () {
    var meta = document.querySelector('meta[name="app-bk"]');
    if (!meta || !window.WebSocket) return;
    // unread: kept here and painted on every screen drawn (a kept Home still showed "9+" after
    // the room was read), null until the server's first word.
    var mePid = meta.getAttribute('content'), ws = null, retry = 0, ping = null, unread = null, refused = 0, stopped = false;
    var badge = function (n) { unread = n; $$('[data-bk-badge]').forEach(function (b) { b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n; }); };
    window.wkndBkSync = function () { if ($('[data-bk]')) badge(0); else if (unread != null) badge(unread); };
    function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
    function open() {
      if (ws || stopped || document.visibilityState !== 'visible' || !navigator.onLine) return;
      var opened = false;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/app'); } catch (e) { ws = null; return; }
      ws.onopen = function () { opened = true; retry = 0; refused = 0; clearInterval(ping); ping = setInterval(function () { send({ type: 'ping' }); }, 60000); };
      ws.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        var inRoom = !!$('[data-bk]');
        if (d.type === 'online') { $$('[data-bk-online]').forEach(function (x) { x.textContent = d.n; }); if (d.unread != null) badge(inRoom ? 0 : d.unread); }
        if (d.type === 'msg' && d.m && d.m.pid !== mePid && !inRoom) badge((unread || 0) + 1);
        window.dispatchEvent(new CustomEvent('wknd:bk', { detail: d }));
      };
      // Switched off (4001), or refused five times in a row (signed out, the room closed): stop
      // asking until the app is next brought back.
      ws.onclose = function (e) {
        ws = null; clearInterval(ping);
        if (e && e.code === 4001 || (!opened && ++refused >= 5)) { stopped = true; return; }
        if (document.visibilityState === 'visible') setTimeout(open, Math.min(30000, 1000 * Math.pow(2, retry++)));
      };
    }
    window.wkndAppSocket = { send: send };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { stopped = false; refused = 0; open(); } else if (ws) ws.close(); });
    window.addEventListener('online', open);
    open();
  })();
  function initBarkadahan() {
    if (window.wkndBarkadahan) return window.wkndBarkadahan.scan();
    if (!$('[data-bk]') || initBarkadahan.loading) return;
    initBarkadahan.loading = true;
    var s = document.createElement('script'); s.src = '/barkadahan.js?v=' + ver;
    s.onerror = function () { initBarkadahan.loading = false; };
    document.head.appendChild(s);
  }
  // Settings → Privacy → Show me as online (Barkadahan).
  function initOnlineSwitch() {
    var sw = $('[data-online-visible]');
    if (!sw || sw._bound) return;
    sw._bound = true;
    sw.addEventListener('change', function () {
      postJson('/app/online-visibility', { on: sw.checked }).then(function () { toast(sw.checked ? 'You show as online' : 'You’re hidden from the online list'); }, function () { sw.checked = !sw.checked; toast('Couldn’t save that. Try again.', 'err'); });
    });
  }
  function initChat() {
    if (window.wkndChat) return window.wkndChat.scan();
    if (!$('[data-live-chat]') || initChat.loading) return;
    initChat.loading = true;
    var s = document.createElement('script'); s.src = '/live-chat.js?v=' + ver;
    s.onerror = function () { initChat.loading = false; };
    document.head.appendChild(s);
  }
  function initLive() {
    if (window.wkndLive) return window.wkndLive.scan();
    if (!$('[data-live-src]') || initLive.loading) return;
    initLive.loading = true;
    var s = document.createElement('script'); s.src = '/live-score.js?v=' + ver;
    s.onerror = function () { initLive.loading = false; };
    document.head.appendChild(s);
  }

  function initPollTakeover() {
    var root = $('main.app [data-tk]'), open = $('body > .tk');
    if (root && open && open.getAttribute('data-tk') === root.getAttribute('data-tk')) { root.remove(); return; } // a quiet refresh of Home: keep the one up
    if (open) { clearInterval(tkTimer); open.remove(); document.documentElement.classList.remove('tk-lock'); }
    if (!root) return;
    root.remove();
    var id = root.getAttribute('data-tk'), canLater = root.getAttribute('data-tk-later') === '1';
    var LATER = 'wknd_poll_later_' + id, VOTED = 'wknd_poll_voted_' + id;
    try {
      if (localStorage.getItem(VOTED)) return;
      if (canLater && Number(localStorage.getItem(LATER) || 0) > Date.now()) return;
    } catch (e) {}
    var opts = $$('[data-tk-opt]', root), msg = $('[data-tk-msg]', root), done = $('[data-tk-done]', root);
    var box = $('.tk__box', root), voted = false, busy = false, closed = false;

    function close() {
      clearInterval(tkTimer);
      root.classList.remove('is-in');
      document.documentElement.classList.remove('tk-lock');
      setTimeout(function () { root.remove(); }, 220);
    }
    // Until the start of the next day in Manila (UTC+8, no DST).
    function later() {
      var H8 = 8 * 3600000, DAY = 86400000;
      try { localStorage.setItem(LATER, String(Math.floor((Date.now() + H8) / DAY + 1) * DAY - H8)); } catch (e) {}
      close();
    }
    // After a vote every way out is the same: close, say so, and refresh Home (and its copy).
    function finish() { close(); if (voted) { toast('Vote saved'); refreshScreen(); } }
    $$('[data-tk-later]', root).forEach(function (b) { b.addEventListener('click', function () { if (voted || closed) finish(); else later(); }); });
    done.addEventListener('click', finish);

    var cd = $('[data-tk-cd]', root);
    if (cd) {
      var to = Number(cd.getAttribute('data-tk-cd'));
      var two = function (n) { return n < 10 ? '0' + n : String(n); };
      var tick = function () {
        var s = Math.max(0, Math.floor((to - Date.now()) / 1000));
        $('[data-tk-d]', cd).textContent = Math.floor(s / 86400);
        $('[data-tk-h]', cd).textContent = two(Math.floor(s / 3600) % 24);
        $('[data-tk-m]', cd).textContent = two(Math.floor(s / 60) % 60);
        $('[data-tk-s]', cd).textContent = two(s % 60);
        if (!s && !closed) {
          closed = true; clearInterval(tkTimer);
          opts.forEach(function (b) { b.disabled = true; });
          msg.textContent = 'Voting has closed.';
          $$('[data-tk-later-btn]', root).forEach(function (b) { b.hidden = true; });
          done.hidden = false;
        }
      };
      tick(); clearInterval(tkTimer); tkTimer = setInterval(tick, 1000);
    }

    opts.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy || closed || btn.classList.contains('is-mine')) return;
        busy = true;
        opts.forEach(function (b) { b.disabled = true; });
        msg.classList.remove('is-error'); msg.textContent = 'Saving…';
        var i = Number(btn.getAttribute('data-tk-opt'));
        postJson('/polls/' + encodeURIComponent(id) + '/vote', { option_index: i }).then(function (j) {
          voted = true;
          try { localStorage.setItem(VOTED, '1'); } catch (e) {}
          opts.forEach(function (b, k) {
            var pct = j.total ? Math.round(j.counts[k] / j.total * 100) : 0;
            b.classList.toggle('is-mine', k === i);
            $('.tk__fill', b).style.width = pct + '%';
            $('.tk__pct', b).textContent = pct + '%';
          });
          $$('[data-tk-n]', root).forEach(function (n) { n.textContent = j.total; });
          msg.classList.add('is-done'); msg.textContent = 'Locked in: ' + $('.tk__label', btn).textContent + '. Tap another to change it.';
          $$('[data-tk-later-btn]', root).forEach(function (b) { b.hidden = true; });
          done.hidden = false;
        }, function (e) {
          msg.classList.add('is-error');
          msg.textContent = !navigator.onLine ? 'No connection. Your vote wasn\'t sent.' : (e.message && e.message !== 'failed' ? e.message : 'Couldn\'t save your vote. Try again.');
        }).then(function () { busy = false; if (!closed) opts.forEach(function (b) { b.disabled = false; }); });
      });
    });

    document.body.appendChild(root);
    setTimeout(function () {
      if (!root.isConnected) return;
      root.hidden = false;
      document.documentElement.classList.add('tk-lock');
      requestAnimationFrame(function () { root.classList.add('is-in'); });
      box.focus({ preventScroll: true });
    }, 600);
  }
  document.addEventListener('keydown', function (e) {
    var root = $('body > .tk:not([hidden])');
    if (!root || e.key !== 'Escape') return;
    var out = $('[data-tk-later]', root) || ($('[data-tk-done]:not([hidden])', root));
    if (out) out.click();
  });

  // ════ Game recap (views/app/game.js) ════
  //   • [data-gr-jump]: the section bar scrolls to its section; the chip of the section in
  //     view lights up as the screen scrolls
  //   • [data-gr-more]: the recap opens in place (the button only shows when it's cut)
  //   • [data-gr-team]: White / Black box score · [data-gr-sort]: sort by a column (TO, PF
  //     lowest first; ties by points). Swiping, the pinned names and their shadow come from
  //     the swipeable-tables standard (public/table-scroll.js).
  var grBound = false, grSpy = null, grEnd = null;
  function initGameRecap() {
    var bar = $('.gr-jump');
    $$('[data-gr-more]').forEach(function (b) {
      var body = document.getElementById(b.getAttribute('data-gr-more'));
      if (body && body.scrollHeight > body.clientHeight + 8) { body.classList.add('is-cut'); b.hidden = false; }
    });
    if (grSpy) { grSpy.disconnect(); grSpy = null; }
    if (bar && window.IntersectionObserver) {
      var light = function (id) {
        $$('button', bar).forEach(function (b) {
          var on = b.getAttribute('data-gr-jump') === id;
          b.classList.toggle('is-on', on);
          if (on && b.scrollIntoView) bar.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' });
        });
      };
      grSpy = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) light(e.target.id); });
        if (grEnd) grEnd();
      }, { rootMargin: '-110px 0px -60% 0px' });
      $$('button', bar).forEach(function (b) { var s = document.getElementById(b.getAttribute('data-gr-jump')); if (s) grSpy.observe(s); });
      // At the very bottom the last sections can't reach the top: light the last one.
      if (!grEnd) {
        grEnd = function () {
          var b = $('.gr-jump'); if (!b) return;
          if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
            var bs = $$('button', b); var last = bs[bs.length - 1];
            if (last && !last.classList.contains('is-on')) { bs.forEach(function (x) { x.classList.toggle('is-on', x === last); }); b.scrollTo({ left: last.offsetLeft - 16, behavior: 'smooth' }); }
          }
        };
        window.addEventListener('scroll', grEnd, { passive: true });
      }
    }
    if (grBound) return;
    grBound = true;
    // The live score swapped in a new box score and plays (public/live-score.js): watch those.
    document.addEventListener('wknd:live-swapped', initGameRecap);
    document.addEventListener('click', function (e) {
      var t = e.target, b;
      if (!t.closest) return;
      if ((b = t.closest('[data-gr-jump]'))) {
        var s = document.getElementById(b.getAttribute('data-gr-jump'));
        if (s) s.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if ((b = t.closest('[data-gr-more]'))) {
        var body = document.getElementById(b.getAttribute('data-gr-more'));
        var open = body.classList.toggle('is-open');
        b.setAttribute('aria-expanded', open); b.textContent = open ? 'Show less' : 'Read the full recap';
        if (!open) body.scrollIntoView({ block: 'nearest' });
        return;
      }
      if ((b = t.closest('[data-gr-team]'))) {
        var box = b.closest('.gr'), i = b.getAttribute('data-gr-team');
        $$('[data-gr-team]', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $$('[data-gr-panel]', box).forEach(function (p) { p.hidden = p.getAttribute('data-gr-panel') !== i; });
        return;
      }
      if ((b = t.closest('[data-gr-sort]'))) {
        var table = b.closest('[data-gr-table]'), j = Number(b.getAttribute('data-gr-sort')), low = b.hasAttribute('data-low');
        var tbody = table.tBodies[0], rows = [].slice.call(tbody.rows);
        var v = function (r, k) { return Number(r.cells[k + 1].getAttribute('data-v')) || 0; };
        rows.sort(function (x, y) { return (low ? v(x, j) - v(y, j) : v(y, j) - v(x, j)) || v(y, 0) - v(x, 0); });
        rows.forEach(function (r) {
          tbody.appendChild(r);
          [].forEach.call(r.cells, function (c, k) { if (k) c.classList.toggle('is-on', k - 1 === j); });
        });
        $$('[data-gr-sort]', table).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      }
    });
  }

  // ════ Practice game setup (views/app/practice.js) ════
  // Carry on: the phone's own note of its last practice (public/scorer.js save), never the
  // server's. Try tips: on starts them from the first tip again. Two different teams.
  function initPractice() {
    var form = $('[data-practice]');
    if (!form || form._bound) return;
    form._bound = true;
    var last = null;
    try { last = JSON.parse(localStorage.getItem('wknd-practice') || 'null'); } catch (e) {}
    var carry = $('[data-practice-carry]', form);
    if (last && last.id && !last.final && carry) {
      carry.href = '/app/practice/play?a=' + encodeURIComponent(last.a) + '&b=' + encodeURIComponent(last.b) + '&q=' + encodeURIComponent(last.q) + '&id=' + encodeURIComponent(last.id);
      carry.textContent = 'Carry on: ' + last.an + ' ' + last.sa + '–' + last.sb + ' ' + last.bn + ', ' + last.period;
      carry.hidden = false;
    }
    var tips = $('[data-practice-tips]', form);
    if (tips) { try { tips.checked = localStorage.getItem('wknd-prac-tips') !== 'off'; } catch (e) {} }
    form.addEventListener('submit', function (e) {
      var a = (form.querySelector('input[name="a"]:checked') || {}).value, b = (form.querySelector('input[name="b"]:checked') || {}).value;
      var err = $('[data-practice-err]', form);
      if (!a || !b || a === b) { e.preventDefault(); if (err) err.hidden = false; return; }
      try {
        if (tips && tips.checked) { localStorage.setItem('wknd-prac-tips', 'on'); localStorage.setItem('wknd-prac-tip', '0'); }
        else localStorage.setItem('wknd-prac-tips', 'off');
      } catch (x) {}
    });
  }
  // ════ How to score (views/app/help.js): the contents' search ════
  function initGuide() {
    var q = $('[data-hg-search]');
    if (!q || q._bound) return;
    q._bound = true;
    q.addEventListener('input', function () {
      var t = q.value.trim().toLowerCase(), any = false;
      $$('[data-hg-toc] li').forEach(function (li) { var a = li.querySelector('[data-text]'); var on = !t || a.getAttribute('data-text').indexOf(t) !== -1; li.hidden = !on; if (on) any = true; });
      var none = $('[data-hg-none]'); if (none) none.hidden = any;
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

    // Videos (views/app/feed.js media): our player, loaded under the cover picture.
    initVideos();
    initPapawis();
    initAdminPapawis();
    initFinish();
    initPush();
    initSettle();
    initRate();
    initBlocks();
    initThreads();
    initShare();
    initPollTakeover();
    initScorer();
    initLive(); initChat();
    initGameRecap();
    initPractice(); initGuide(); initBarkadahan(); initOnlineSwitch(); initProfile();
    if (window.wkndBkSync) window.wkndBkSync();

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
    // (the keyboard's Go submits again even with the button busy, so a second submit is stopped)
    $$('form[data-busy]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        if (f._sending) { e.preventDefault(); return; }
        f._sending = true;
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
  window.wkndToast = function (t, tone) { toast(t, tone); };
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
  // Bars, like the site's pick cards (views/pick-card.js): once the refreshed screen is in,
  // the card just picked grows its bars in from the left with a sheen and counts the % up;
  // a switch slides the bars from the old split to the new one instead. A picked card also
  // grows in the first time it scrolls into view (once per game per app session).
  // justPicked = { id, from }: from = the split before the tap ({ a, b } %), null if hidden.
  var justPicked = null, pickGrown = {}, pickIO = null;
  var pickCalm = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var pickSplit = function (card) {
    if (!$('.pick__fill', card)) return null;
    var o = { a: 0, b: 0 };
    $$('.pick__fill', card).forEach(function (f) { o[f.closest('.pick__opt').getAttribute('data-side')] = Number(f.getAttribute('data-pct')) || 0; });
    return o;
  };
  function pickCount(card, from) {
    $$('[data-pick-pct]', card).forEach(function (el) {
      var to = Number(el.getAttribute('data-pick-pct')), a = from ? from[el.closest('.pick__opt').getAttribute('data-side')] || 0 : 0, t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(a + (to - a) * e) + '%';
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      })(t0);
      setTimeout(function () { el.textContent = to + '%'; }, 850); // frames can stall (app in the background)
    });
  }
  function pickReveal(card, from, count) {
    pickGrown[card.getAttribute('data-pick-game')] = true;
    if (pickCalm()) return;
    if (from) {
      var fills = $$('.pick__fill', card), to = fills.map(function (f) { return f.style.width; });
      fills.forEach(function (f) { f.style.width = (from[f.closest('.pick__opt').getAttribute('data-side')] || 0) + '%'; });
      void card.offsetWidth; // start the slide from the old widths
      card.classList.add('is-sliding', 'is-swept');
      fills.forEach(function (f, i) { f.style.width = to[i]; });
    } else card.classList.add('is-revealed');
    if (count) pickCount(card, from);
  }
  function pickGrowOnView() {
    if (pickIO) pickIO.disconnect();
    if (pickCalm() || !('IntersectionObserver' in window)) return;
    pickIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        pickIO.unobserve(e.target);
        if (!pickGrown[e.target.getAttribute('data-pick-game')]) pickReveal(e.target, null, false);
      });
    }, { threshold: 0.4 });
    $$('[data-pick-game]').forEach(function (card) { if (!pickGrown[card.getAttribute('data-pick-game')] && $('.pick__fill', card)) pickIO.observe(card); });
  }
  function initPicks() {
    clearInterval(pickTimer);
    if (justPicked) {
      var jp = justPicked, done = $('[data-pick-game="' + jp.id + '"]');
      justPicked = null;
      if (done && $('.pick__fill', done)) pickReveal(done, jp.from, true);
    }
    pickGrowOnView();
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
        // Never queued for later: offline, nothing is sent and the card says so.
        if (!navigator.onLine) { msg.textContent = 'You\'re offline. Picks need a connection, so nothing was sent.'; msg.hidden = false; return; }
        var from = pickSplit(card);
        card.setAttribute('data-saving', '1');
        opts.forEach(function (b) { b.classList.toggle('is-mine', b === btn); b.classList.add('is-saving'); b.disabled = true; });
        var settle = function () {
          card.removeAttribute('data-saving');
          opts.forEach(function (b) { b.classList.remove('is-saving'); b.disabled = false; });
        };
        var undo = function (text) {
          settle();
          opts.forEach(function (b) { b.classList.toggle('is-mine', b === prev); });
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
            settle();
            justPicked = { id: card.getAttribute('data-pick-game'), from: from };
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
  // The tab's cover countdown ("Tip-off in 6d 23h 14m 05s"), every second.
  var pwClock = function (ms) {
    if (ms <= 0) return 'now';
    var p = function (n) { return String(n).padStart(2, '0'); };
    var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    return (d ? d + 'd ' : '') + p(h) + 'h ' + p(m) + 'm ' + p(s) + 's';
  };
  // The run just joined: once the refreshed screen is in, your face pops into its seat.
  // pwSeen: runs whose roster this session already reported (the site's "viewed" beacon,
  // which Papawis announcements use to find interested players).
  var pwJustJoined = null, pwSeen = {};
  function initPapawis() {
    clearInterval(pwTimer);
    var cds = $$('[data-countdown-to]'), caps = $$('[data-pw-cd]');
    if (cds.length || caps.length) {
      var tick = function () {
        cds.forEach(function (c) { c.textContent = c.getAttribute('data-countdown-label') + ' ' + pwLeft(Number(c.getAttribute('data-countdown-to')) - Date.now()); });
        caps.forEach(function (c) { $('b', c).textContent = pwClock(Number(c.getAttribute('data-pw-cd')) - Date.now()); });
      };
      tick(); pwTimer = setInterval(tick, caps.length ? 1000 : 30000);
    }
    if (pwJustJoined) {
      var joined = $('[data-pw-card="' + pwJustJoined + '"]');
      pwJustJoined = null;
      if (joined) joined.classList.add('is-joined');
    }
    $$('[data-pw-roster]').forEach(function (card) {
      var id = card.getAttribute('data-pw-card');
      if (pwSeen[id] || !navigator.onLine) return;
      pwSeen[id] = true;
      fetch('/papawis/' + encodeURIComponent(id) + '/viewed', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(function () {});
    });
    $$('[data-pw-card]').forEach(function (card) {
      if (card._bound) return;
      card._bound = true;
      card.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-pw-act]');
        if (!b || b.disabled || card.getAttribute('data-saving')) return;
        var act = b.getAttribute('data-pw-act'), run = b.getAttribute('data-pw-run');
        var msg = $('[data-pw-msg]', card); msg.hidden = true;
        // Never queued for later: offline, nothing is sent and the card says so.
        if (!navigator.onLine) { msg.textContent = 'You\'re offline. This needs a connection, so nothing was sent.'; msg.hidden = false; return; }
        var ask = b.getAttribute('data-pw-confirm');
        if (ask && !window.confirm(ask)) return;
        if (act === 'cancel' && !window.confirm(b.textContent.trim() + '?')) return;
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
            if (act === 'join') pwJustJoined = run;
            refreshScreen();
          }, function () {
            card.removeAttribute('data-saving'); b.classList.remove('is-busy');
            msg.textContent = 'No connection. Nothing was changed.'; msg.hidden = false;
          });
      });
    });
  }

  // ════ Manage a Papawis run (admins; views/app/admin-papawis.js) ════
  // Every change posts to the site's own /admin/papawis routes (the same ones the site's run
  // page uses), so the site's rules decide. After a change the screen refreshes from the server.
  //   • [data-adm-post] buttons: confirm first when they ask, then a toast and a refresh
  //   • a player's actions and Add player open in a sheet (the comments sheet's machinery)
  //   • drag the grip to reorder, move between Confirmed and the waitlist, or swap sides
  //   • the cover: pick a photo, or drop one on it on a computer or iPad
  var admBusy = false, admBound = false;
  var closeSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  // Answers JSON from an admin route, or throws the reason. A signed-out or no-longer-admin
  // session gets a page back instead of JSON: that's a failure too, never a silent success.
  function admSend(url, body, method) {
    if (method === 'GET') {
      return fetch(url, { credentials: 'same-origin', redirect: 'manual' }).then(function (r) {
        if (r.type === 'opaqueredirect' || r.ok) return {};
        throw new Error('That didn\'t go through. Try again.');
      });
    }
    return fetch(url, { method: method || 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) {
        var json = /json/.test(r.headers.get('content-type') || '');
        return r.text().then(function (t) {
          var j = null; try { j = json ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok || !j || j.error) throw new Error((j && j.error) || (json ? 'That didn\'t go through. Try again.' : 'Your admin sign-in ended. Open the app again.'));
          return j;
        });
      }, function () { throw new Error('No connection. Nothing was changed.'); });
  }
  // A sheet like the comments one (same var, so closeSheet, the keyboard fit and navigation
  // all apply): title + body HTML.
  function admSheet(title, html) {
    closeSheet(true);
    var el = document.createElement('div');
    el.className = 'sheet adm-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = '<div class="sheet__scrim" data-sheet-x></div><div class="sheet__box"><div class="sheet__head"><span class="sheet__grab" aria-hidden="true"></span><b></b><button type="button" class="sheet__x" data-sheet-x aria-label="Close">' + closeSvg + '</button></div><div class="sheet__body adm-sheet__body"></div></div>';
    $('.sheet__head b', el).textContent = title;
    $('.adm-sheet__body', el).innerHTML = html;
    lockPage();
    document.body.appendChild(el);
    document.documentElement.classList.add('has-sheet');
    sheet = el; fitSheet();
    swipeToClose(el, '.adm-input', '.adm-pick');
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-open'); }); });
    return el;
  }
  var admEsc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  // A yes/no question in the amber bar at the top (the scorer's confirmations, public/scorer.js
  // alertBar): resolves true for the action, false for Not yet.
  var AMBER_ICONS = { up: 'M12 16V4M7 9l5-5 5 5M5 20h14', flag: 'M5 21V4M5 4h11l-2 4 2 4H5' };
  function amberAsk(title, sub, yes, icon) {
    return new Promise(function (done) {
      $$('.amber-ask').forEach(function (x) { x.remove(); });
      var el = document.createElement('div');
      el.className = 'amber-ask sc-alert'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', title);
      el.innerHTML = '<div class="sc-alert__r"><span class="sc-alert__ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (AMBER_ICONS[icon] || AMBER_ICONS.up) + '"/></svg></span><span class="sc-alert__t"><b></b><small></small></span></div>' +
        '<div class="sc-alert__b"><button type="button" class="sc-alert__no">Not yet</button><button type="button" class="sc-alert__yes"></button></div>';
      $('.sc-alert__t b', el).textContent = title; $('.sc-alert__t small', el).textContent = sub; $('.sc-alert__yes', el).textContent = yes;
      var end = function (v) { el.remove(); done(v); };
      $('.sc-alert__no', el).onclick = function () { end(false); };
      $('.sc-alert__yes', el).onclick = function () { end(true); };
      document.body.appendChild(el);
      $('.sc-alert__yes', el).focus();
    });
  }
  // A short toast: the first sentence of a long server message (Autofill explains every skip).
  var admShort = function (m) { return String(m || '').split('. ')[0].replace(/\.$/, ''); };

  // The cover: downscaled on the phone first (a 12 MP photo would take ages to send), then
  // the site's cover route crops it to 16:9.
  function admCover(file, box) {
    if (!file || !/^image\//.test(file.type || '')) { toast('That isn\'t a photo.', 'err'); return; }
    if (admBusy) return;
    if (!navigator.onLine) { toast('You\'re offline. Nothing was sent.', 'err'); return; }
    admBusy = true; box.classList.add('is-busy');
    var label = $('[data-adm-cover-btn] span', box), was = label ? label.textContent : '';
    if (label) label.textContent = 'Uploading…';
    var done = function () { admBusy = false; box.classList.remove('is-busy', 'is-drop'); if (label) label.textContent = was; };
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var max = 2000, s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      admSend(box.getAttribute('data-adm-cover-url') || '/admin/papawis/' + encodeURIComponent(box.getAttribute('data-adm-cover')) + '/cover', { dataUrl: c.toDataURL('image/jpeg', 0.86) })
        .then(function () {
          done(); toast('Cover saved');
          // A game's cover (Finish the game): shown in place, so what's typed and not saved yet stays.
          if (!box.getAttribute('data-adm-cover-url')) return refreshScreen(true);
          var src = box.getAttribute('data-adm-cover-url') + '-img?v=' + Date.now(), img = $('img', box), none = $('.fin-cover__none', box);
          if (img) img.src = src; else if (none) { img = document.createElement('img'); img.alt = 'The game’s cover'; img.src = src; none.replaceWith(img); }
          box.setAttribute('data-has-cover', ''); if (label) label.textContent = was = 'Change photo';
        }, function (e) { done(); toast(e.message, 'err'); });
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(); toast('Couldn\'t read that photo. Try another.', 'err'); };
    img.src = url;
  }

  // Drag by the grip (mouse, finger or pen: pointer events, so it works the same everywhere).
  // Lists: [data-adm-list="confirmed|waitlist"] (the roster) or [data-adm-team="light|dark|"].
  function admDrag(grip, e) {
    var row = grip.closest('.adm-row'), from = row.parentNode, root = row.closest('.adm');
    if (!root || admBusy) return;
    var run = root.getAttribute('data-adm-run'), max = Number(root.getAttribute('data-adm-max')) || 0;
    var teams = from.hasAttribute('data-adm-team');
    var kind = teams ? 'data-adm-team' : 'data-adm-list';
    var lists = $$('[' + kind + '][data-adm-dnd]', root);
    var rowsOf = function (l) { return $$('.adm-row', l); };
    // The roster's Confirmed takes only max: a full list doesn't take a row from the waitlist.
    var canEnter = function (l) { return teams || l === from || l.getAttribute(kind) !== 'confirmed' || rowsOf(l).length < max; };
    e.preventDefault();
    // Moves are heard on the document, not the grip: moving the row in the list releases any
    // pointer capture on it, and the drag would stop after the first step.
    var pid = e.pointerId;
    var rect = row.getBoundingClientRect(), offY = e.clientY - rect.top, offX = e.clientX - rect.left;
    var ghost = row.cloneNode(true); ghost.classList.add('adm-ghost'); ghost.style.width = rect.width + 'px'; ghost.style.left = rect.left + 'px'; ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    row.classList.add('is-dragging');
    root.classList.add('is-dragging');
    var lastX = e.clientX, lastY = e.clientY, scroller = 0;
    // The roster is one column: the row only moves up and down. Teams are two side by side:
    // the row follows the finger across too, and the list under the finger takes it.
    var place = function (x, y) {
      ghost.style.top = (y - offY) + 'px';
      if (teams) ghost.style.left = (x - offX) + 'px';
      var el = document.elementFromPoint(teams ? x : rect.left + rect.width / 2, y), list = el && el.closest('[' + kind + '][data-adm-dnd]');
      lists.forEach(function (l) { l.classList.toggle('is-over', l === list && canEnter(l)); l.classList.toggle('is-blocked', l === list && !canEnter(l)); });
      if (!list || !canEnter(list)) return;
      var empty = $('.adm-empty', list); if (empty) empty.hidden = true;
      var after = null, best = -Infinity;
      rowsOf(list).forEach(function (r) { if (r === row) return; var b = r.getBoundingClientRect(), off = y - b.top - b.height / 2; if (off < 0 && off > best) { best = off; after = r; } });
      if (after) list.insertBefore(row, after); else list.appendChild(row);
    };
    // Near the top or bottom edge the screen scrolls along, so a long list can be crossed.
    var edge = function () {
      var h = window.innerHeight, zone = 70, v = lastY < zone ? -(zone - lastY) / 4 : lastY > h - zone - 70 ? (lastY - (h - zone - 70)) / 4 : 0;
      if (v) { window.scrollBy(0, v); place(lastX, lastY); }
      scroller = requestAnimationFrame(edge);
    };
    scroller = requestAnimationFrame(edge);
    var move = function (ev) { if (ev.pointerId !== pid) return; ev.preventDefault(); lastX = ev.clientX; lastY = ev.clientY; place(lastX, lastY); };
    var up = function (ev) {
      if (ev.pointerId !== pid) return;
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      cancelAnimationFrame(scroller);
      ghost.remove(); row.classList.remove('is-dragging'); root.classList.remove('is-dragging');
      lists.forEach(function (l) { l.classList.remove('is-over', 'is-blocked'); });
      var to = row.parentNode, key = to.getAttribute(kind), id = row.getAttribute('data-id');
      var ids = function (l) { return rowsOf(l).map(function (r) { return r.getAttribute('data-id'); }); };
      var base = '/admin/papawis/' + encodeURIComponent(run);
      var save;
      if (teams) {
        if (!key) { toast('Drag them into Light or Dark: no side isn\'t saved', 'err'); refreshScreen(true); return; }
        save = (to === from ? Promise.resolve() : admSend(base + '/teams/assign', { signup_id: id, team: key }))
          .then(function () { return admSend(base + '/teams/reorder', { team: key, ids: ids(to) }); })
          .then(function () { return to === from ? 'Order saved' : 'Moved to ' + (key === 'dark' ? 'Dark' : 'Light'); });
      } else {
        save = (to === from ? Promise.resolve() : admSend(base + '/signups/' + encodeURIComponent(id) + '/status', { status: key }))
          .then(function () { return admSend(base + '/signups/reorder', { status: key, ids: ids(to) }); })
          .then(function () { return to === from ? 'Order saved' : key === 'confirmed' ? 'Moved to confirmed' : 'Moved to the waitlist'; });
      }
      admBusy = true;
      save.then(function (msg) { admBusy = false; toast(msg); refreshScreen(true); }, function (err) { admBusy = false; toast(err.message, 'err'); refreshScreen(true); });
    };
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  // Add player: search, pick one, optional guests, Confirmed or Waitlist.
  function admAdd(tpl) {
    var el = admSheet('Add a player', tpl.innerHTML);
    var form = $('[data-adm-add-form]', el), q = $('[data-adm-q]', el), go = $('[data-adm-add-go]', el), msg = $('[data-adm-add-msg]', el);
    var rows = $$('.adm-pick__row', el), picked = null;
    var filter = function () {
      var v = q.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) { var on = !!v && r.getAttribute('data-q').indexOf(v) >= 0 && shown < 30; if (on) shown++; r.hidden = !on && r !== picked; });
    };
    q.addEventListener('input', filter);
    rows.forEach(function (r) {
      r.addEventListener('click', function () {
        if (picked) { picked.classList.remove('is-on'); picked.setAttribute('aria-pressed', 'false'); }
        picked = picked === r ? null : r;
        if (picked) { r.classList.add('is-on'); r.setAttribute('aria-pressed', 'true'); }
        go.disabled = !picked; msg.hidden = true; filter();
      });
      r.setAttribute('aria-pressed', 'false');
    });
    go.addEventListener('click', function () {
      if (!picked || admBusy) return;
      if (!navigator.onLine) { msg.textContent = 'You\'re offline. Nothing was sent.'; msg.hidden = false; return; }
      admBusy = true; go.disabled = true; go.classList.add('is-busy');
      var to = ($('input[name="adm-to"]:checked', el) || {}).value || 'confirmed';
      admSend(form.getAttribute('data-url'), { player_id: picked.getAttribute('data-id'), guest_names: $('[data-adm-guests]', el).value, status: to })
        .then(function (j) {
          admBusy = false; closeSheet();
          toast((j.added > 1 ? j.added + ' added' : 'Added') + (to === 'waitlist' ? ' to the waitlist' : ''));
          refreshScreen(true);
        }, function (e) { admBusy = false; go.disabled = false; go.classList.remove('is-busy'); msg.textContent = e.message; msg.hidden = false; });
    });
    setTimeout(function () { q.focus(); }, 300);
  }

  function initAdminPapawis() {
    if (admBound) return;
    admBound = true;
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      var b;
      if ((b = t.closest('[data-adm-post]'))) {
        if (b.disabled || admBusy) return;
        if (!navigator.onLine) { toast('You\'re offline. Nothing was sent.', 'err'); return; }
        var ask = b.getAttribute('data-adm-ask');
        // A title too: the question in the amber bar (the scorer's look) instead of the phone's pop-up.
        if (ask && b.getAttribute('data-adm-ask-title') && !b._asked) {
          var post = b;
          amberAsk(b.getAttribute('data-adm-ask-title'), ask, b.getAttribute('data-adm-ask-yes') || 'OK', b.getAttribute('data-adm-ask-icon')).then(function (ok) { if (ok) { post._asked = true; post.click(); post._asked = false; } });
          return;
        }
        if (ask && !b._asked && !window.confirm(ask)) return;
        var body = null; try { body = JSON.parse(b.getAttribute('data-adm-body') || 'null'); } catch (x) {}
        admBusy = true; b.disabled = true; b.classList.add('is-busy');
        admSend(b.getAttribute('data-adm-post'), body, b.getAttribute('data-adm-method')).then(function (j) {
          admBusy = false; b.disabled = false; b.classList.remove('is-busy');
          if (sheet && sheet.contains(b)) closeSheet();
          toast(admShort(j.message) || b.getAttribute('data-adm-done') || 'Done');
          refreshScreen(true);
        }, function (err) { admBusy = false; b.disabled = false; b.classList.remove('is-busy'); toast(err.message, 'err'); });
        return;
      }
      if ((b = t.closest('[data-adm-acts]'))) {
        var acts = []; try { acts = JSON.parse(b.getAttribute('data-adm-acts')); } catch (x) {}
        admSheet(b.getAttribute('data-adm-title') || 'Player', '<div class="group adm-acts">' + acts.map(function (a) {
          return '<button type="button" class="cell adm-act' + (a.danger ? ' adm-act--danger' : '') + '"' + (a.disabled ? ' disabled' : '') +
            ' data-adm-post="' + admEsc(a.post || '') + '"' + (a.body ? ' data-adm-body="' + admEsc(JSON.stringify(a.body)) + '"' : '') +
            (a.ask ? ' data-adm-ask="' + admEsc(a.ask) + '"' : '') + ' data-adm-done="' + admEsc(a.done || 'Done') + '">' +
            '<span class="cell__t">' + admEsc(a.label) + (a.sub ? '<small>' + admEsc(a.sub) + '</small>' : '') + '</span></button>';
        }).join('') + '</div>');
        return;
      }
      if ((b = t.closest('[data-adm-add]'))) { var tpl = $('[data-adm-add-tpl]'); if (tpl) admAdd(tpl); return; }
      if ((b = t.closest('[data-adm-cover-btn]'))) {
        var box = b.closest('[data-adm-cover]'), input = $('[data-adm-cover-input]', box);
        if (!box.hasAttribute('data-has-cover')) { input.click(); return; }
        var game = !!box.getAttribute('data-adm-cover-url');
        var el = admSheet('Cover', '<div class="group adm-acts"><button type="button" class="cell adm-act" data-adm-pick-photo><span class="cell__t">Choose a photo<small>' + (game ? 'Shown on the game page and share cards' : 'Cropped to 16:9 for the run card and the homepage') + '</small></span></button>' +
          '<button type="button" class="cell adm-act adm-act--danger" data-adm-post="' + admEsc(box.getAttribute('data-adm-cover-url') || '/admin/papawis/' + encodeURIComponent(box.getAttribute('data-adm-cover')) + '/cover') + '" data-adm-method="DELETE" data-adm-ask="' + (game ? 'Remove this cover? The game shows without a photo.' : 'Remove this cover? The court photo shows again.') + '" data-adm-done="Cover removed"><span class="cell__t">Remove cover</span></button></div>');
        $('[data-adm-pick-photo]', el).addEventListener('click', function () { input.click(); closeSheet(); });
        return;
      }
      if ((b = t.closest('[data-adm-copy]'))) {
        var text = b.getAttribute('data-adm-copy');
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Copied. Paste it into Messenger'); }, function () { window.prompt('Copy this text:', text); });
      }
    });
    document.addEventListener('change', function (e) {
      var input = e.target.closest && e.target.closest('[data-adm-cover-input]');
      if (input && input.files && input.files[0]) { admCover(input.files[0], input.closest('[data-adm-cover]')); input.value = ''; }
    });
    document.addEventListener('pointerdown', function (e) {
      var grip = e.target.closest && e.target.closest('.adm-grip');
      if (grip && (e.pointerType !== 'mouse' || e.button === 0)) admDrag(grip, e);
    });
    // Drop a photo on the cover (a computer, or an iPad with Files open beside the app).
    var coverOf = function (e) { return e.target.closest && e.target.closest('[data-adm-cover]'); };
    var hasFile = function (e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; };
    document.addEventListener('dragover', function (e) { var box = coverOf(e); if (box && hasFile(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; box.classList.add('is-drop'); } });
    document.addEventListener('dragleave', function (e) { var box = coverOf(e); if (box && !box.contains(e.relatedTarget)) box.classList.remove('is-drop'); });
    document.addEventListener('drop', function (e) {
      var box = coverOf(e); if (!box || !hasFile(e)) return;
      e.preventDefault(); box.classList.remove('is-drop');
      admCover(e.dataTransfer.files[0], box);
    });
  }

  // ════ Finish the game (views/app/finish.js) ════
  // Tick the POTG (two share it: the second is the co-POTG, with its own write-up), write with
  // AI, then one Save to the site's /admin/games/:id/save. The recap goes as paragraphs, and only
  // when it changed (a recap with the site editor's formatting is never flattened unasked).
  function initFinish() {
    var form = $('[data-fin]');
    if (!form || form._fin) return;
    form._fin = true;
    var gid = form.getAttribute('data-fin'), base = '/admin/games/' + encodeURIComponent(gid);
    var potgIn = $('[data-fin-potg]', form), coIn = $('[data-fin-co]', form), recap = $('[data-fin-recap]', form);
    var save = $('[data-fin-save]', form), note = $('[data-fin-note]', form);
    var recapAt = recap ? recap.value : '', dirty = false, busy = false;
    var nameOf = function (id) { var b = id && $('[data-fin-cand="' + id + '"]', form); return b ? b.getAttribute('data-name') : ''; };
    var mark = function () { dirty = true; save.disabled = busy; note.textContent = 'Unsaved changes. Tap Save to keep them.'; };
    var paintCands = function () {
      var order = [potgIn.value, coIn.value];
      $$('[data-fin-cand]', form).forEach(function (b) {
        var i = order.indexOf(b.getAttribute('data-fin-cand'));
        if (!b.getAttribute('data-fin-cand')) i = -1;
        b.classList.toggle('is-on', i !== -1); b.setAttribute('aria-pressed', String(i !== -1));
        $('[data-fin-tag]', b).textContent = i === 0 ? 'POTG' : i === 1 ? 'CO-POTG' : '';
      });
      $('[data-fin-label="potg"]', form).textContent = 'Write-up' + (potgIn.value ? ' · ' + nameOf(potgIn.value) : '');
      $('[data-fin-label="copotg"]', form).textContent = 'Write-up' + (coIn.value ? ' · ' + nameOf(coIn.value) : '');
      $('[data-fin-box="copotg"]', form).hidden = !coIn.value;
    };
    var words = function () { var n = $('[data-fin-words]', form); if (n) n.textContent = String((recap.value.trim().match(/\S+/g) || []).length); };
    form.addEventListener('input', function (e) { if (e.target === recap) words(); if (!e.target.hasAttribute('data-fin-ctx') && !e.target.hasAttribute('data-fin-fa') && !e.target.hasAttribute('data-fin-fb')) mark(); });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fin-cand]');
      if (b) {
        var id = b.getAttribute('data-fin-cand');
        // Unticking the POTG: the co-POTG moves up, and their write-up with them.
        if (potgIn.value === id) {
          var pw = $('[name="potg_writeup"]', form), cw = $('[name="co_potg_writeup"]', form);
          if (coIn.value) { pw.value = cw.value; cw.value = ''; }
          potgIn.value = coIn.value; coIn.value = '';
        }
        else if (coIn.value === id) coIn.value = '';
        else if (!potgIn.value) potgIn.value = id;
        else if (!coIn.value) coIn.value = id;
        else { toast('Two already share it. Untick one first.', 'err'); return; }
        paintCands(); mark(); return;
      }
      // The final score corrected (the box score stays): the site's /final-correct.
      var fx = e.target.closest('[data-fin-final]');
      if (fx) {
        var fa = parseInt($('[data-fin-fa]', form).value, 10), fb = parseInt($('[data-fin-fb]', form).value, 10);
        if (!(fa >= 0) || !(fb >= 0) || fa === fb) { toast('Type a final score with a winner.', 'err'); return; }
        amberAsk('Correct the final score?', fa + '–' + fb + '. The box score stays; Who wins? settles again', 'Correct it', 'flag').then(function (ok) {
          if (!ok) return;
          admSend(base + '/final-correct', { team_a_score: fa, team_b_score: fb }).then(function (j) { toast(j.message ? j.message.split('. ')[0] : 'Corrected'); refreshScreen(true); }, function (err) { toast(err.message, 'err'); });
        });
        return;
      }
      var ai = e.target.closest('[data-fin-ai]');
      if (ai) {
        var key = ai.getAttribute('data-fin-ai'), status = $('[data-fin-status="' + key + '"]', form);
        if (key === 'copotg' && !coIn.value) { toast('Tick a second player first.', 'err'); return; }
        if (!navigator.onLine) { toast('You\'re offline. Try again with signal.', 'err'); return; }
        var body = key === 'recap' ? { player_id: potgIn.value || null, context: ($('[data-fin-ctx]', form) || {}).value || '' }
          : key === 'copotg' ? { player_id: coIn.value, shared_with: potgIn.value } : { player_id: potgIn.value || null, shared_with: coIn.value, co_player_id: coIn.value };
        var label = ai.textContent; ai.disabled = true; ai.textContent = 'Writing…'; status.hidden = true;
        admSend(base + (key === 'recap' ? '/generate-recap' : '/generate-potg'), body).then(function (d) {
          var ta = key === 'recap' ? recap : $('[name="' + (key === 'potg' ? 'potg_writeup' : 'co_potg_writeup') + '"]', form);
          ta.value = String(d.writeup || ''); if (key === 'recap') words(); mark();
          // The writer rewrites until its checks pass (lib/writer.js); after 3 tries it says what's still off.
          var missed = d.missed || [];
          status.textContent = missed.length ? 'Written, but check it: ' + missed.join(' · ') + '. Fix it by hand or write again.' : 'Written. Read it over, then Save.';
          status.hidden = false;
        }, function (err) { toast(err.message, 'err'); }).then(function () { ai.disabled = false; ai.textContent = label; });
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !dirty) return;
      if (!navigator.onLine) { toast('You\'re offline. Nothing was saved.', 'err'); return; }
      var body = { potg_player_id: potgIn.value, co_potg_player_id: coIn.value };
      $$('[data-fin-field]', form).forEach(function (f) { body[f.name] = f.value; });
      if (!coIn.value) delete body.co_potg_writeup;
      if (recap.value !== recapAt) {
        var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var paras = recap.value.trim().split(/\n\s*\n/).filter(Boolean);
        body.game_writeup = paras.length ? paras.map(function (p) { return '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>'; }).join('') : '';
      }
      busy = true; save.disabled = true; save.textContent = 'Saving…';
      admSend(base + '/save', body).then(function () {
        busy = false; dirty = false; recapAt = recap.value; save.textContent = 'Save'; note.textContent = 'Saved.';
        toast('Saved'); refreshScreen(true);
      }, function (err) { busy = false; save.disabled = false; save.textContent = 'Save'; toast(err.message, 'err'); });
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
    // The picker opens from its <label> alone (as the setup photo does): a file.click() here
    // too opened it twice, and on iPhone the second open dropped the picked screenshot.
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
      if (form._sending) return; // the keyboard's Go while it's sending: one receipt only
      var el = form.elements, amt = Number(el.amount.value);
      var say = function (t) { msg.textContent = t; msg.hidden = false; };
      if (!(amt > 0)) return say('Enter the amount you paid.');
      if (!shot) return say('Add the receipt screenshot from GCash (or your bank).');
      var btn = $('[data-st-send]', form); btn.classList.add('is-busy'); msg.hidden = true; form._sending = true;
      fetch('/settle-balance', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, category: el.category.value, payment_method: el.payment_method.value, reference_no: el.reference_no.value, screenshot: shot }) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok && !!j && !!j.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          btn.classList.remove('is-busy'); form._sending = false;
          if (res.status === 401) { location.href = '/app/login'; return; }
          if (!res.ok) return say((res.j && res.j.error) || (res.status === 413 ? 'That screenshot is too big. Try a smaller one.' : 'Couldn\'t send it. Try again.'));
          toast('Sent · an admin will confirm it');
          refreshScreen();
        }, function () { btn.classList.remove('is-busy'); form._sending = false; say('No connection. Nothing was sent.'); });
    });
  }

  // ════ Rate your game (views/app/rate.js) ════
  // Tags toggle, a "No" opens the admin-only part, and Done posts everything answered to the
  // site's own POST /rate/:kind/:ref (same rules as the site). A "No" needs a reason.
  function initRate() {
    var form = $('[data-rt-form]');
    if (!form || form._bound) return;
    form._bound = true;
    var msg = $('[data-rt-msg]', form);
    var say = function (t) { msg.textContent = t; msg.hidden = false; };
    form.addEventListener('click', function (e) {
      var t = e.target.closest('[data-rt-tag]');
      if (t) t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
    form.addEventListener('change', function (e) {
      if (/^a_/.test(e.target.name || '') && e.target.value === 'no') { var d = $('.rt__bad', e.target.closest('[data-rt-player]')); if (d) d.open = true; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form._sending) return;
      var body = { via: 'app', players: [] }, bad = null;
      var cs = $('input[name="court_stars"]:checked', form);
      if (cs) {
        var tb = $('textarea[name="court_body"]', form), an = $('input[name="court_anon"]', form);
        body.court = { stars: Number(cs.value), body: tb ? tb.value : undefined, anon: an ? an.checked : undefined };
      }
      $$('[data-rt-player]', form).forEach(function (row) {
        var a = $('input[type="radio"]:checked', row);
        if (!a) return;
        if (a.value === 'no' && !$('.rt__tag--bad[aria-pressed="true"]', row)) bad = bad || row;
        body.players.push({ id: row.getAttribute('data-rt-player'), answer: a.value,
          tags: $$('[data-rt-tag][aria-pressed="true"]', row).map(function (b) { return b.getAttribute('data-rt-tag'); }),
          note: ($('[data-rt-note]', row) || {}).value || '' });
      });
      if (bad) { say('For a "No", pick what went wrong.'); $('.rt__bad', bad).open = true; bad.scrollIntoView({ block: 'center' }); return; }
      if (!body.court && !body.players.length) return say('Rate the court or at least one player first.');
      if (!navigator.onLine) return say('No connection. Nothing was sent.');
      var btn = $('[data-rt-send]', form); btn.disabled = true; btn.classList.add('is-busy'); msg.hidden = true; form._sending = true;
      var done = function () { btn.disabled = false; btn.classList.remove('is-busy'); form._sending = false; };
      fetch(form.getAttribute('data-rt-form'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          done();
          if (res.status === 401) { location.href = '/app/login'; return; }
          if (!res.ok) return say(res.j.error || 'Couldn\'t save. Try again.');
          toast(res.j.message || 'Saved. Thanks!');
          refreshScreen(true);
        }, function () { done(); say('No connection. Nothing was sent.'); });
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
    // Settings → Analytics: saved for the player, then a reload loads (or drops) GA.
    var gaSw = $('[data-analytics]');
    if (gaSw && !gaSw._bound) gaSw._bound = true, gaSw.addEventListener('change', function () {
      postJson('/app/analytics', { on: gaSw.checked })
        .then(function () { location.reload(); }, function () { gaSw.checked = !gaSw.checked; toast('Couldn\'t save that. Try again.', 'err'); });
    });
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
      // The Notifications screen marks everything read as its list loads, so it clears the badge,
      // here and in the screens already fetched (their tab bars still carry the old count).
      if (location.pathname === '/app/notifications') {
        nav.setAttribute('data-unread', '0');
        Object.keys(pages || {}).forEach(function (u) { if (pages[u].html) pages[u].html = pages[u].html.replace(/data-unread="\d+"/, 'data-unread="0"'); });
      }
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
    if (e.data && e.data.type === 'push') pushBanner(e.data);
    if (e.data && e.data.type === 'fresh') launchFresh(e.data);
  });
  // Push banner: a notification that arrives while the app is open on screen (the service
  // worker sends it here instead of the phone's own banner). The sender's face, else the app
  // icon; neutral surface (info tone). Tap opens it, swipe up or 5 seconds puts it away.
  function pushBanner(d) {
    $$('.push-banner').forEach(function (b) { b.remove(); });
    var b = document.createElement('a'); b.className = 'push-banner'; b.href = d.url || '/app'; b.setAttribute('role', 'status');
    var f = d.face;
    b.innerHTML = (f
      ? '<span class="avatar-wrap"><span class="avatar"></span></span>'
      : '<span class="push-banner__app"><img src="/app-icon-192.png" alt=""></span>')
      + '<span class="cell__t"><span></span><small></small></span><span class="push-banner__when">now</span>';
    if (f) {
      var av = $('.avatar', b); av.style.setProperty('--ring', f.ring || 'var(--subtle)'); av.textContent = f.initials || '';
      if (f.photo) { var img = document.createElement('img'); img.alt = ''; img.src = f.photo; img.onerror = function () { img.remove(); }; av.appendChild(img); }
    }
    $('.cell__t > span', b).textContent = d.title || 'WKND';
    if (d.body) $('.cell__t small', b).textContent = d.body; else $('.cell__t small', b).remove();
    var gone = false, hide = function () {
      if (gone) return; gone = true; b.classList.add('is-out');
      setTimeout(function () { b.remove(); }, 250);
    };
    var y0 = null;
    b.addEventListener('touchstart', function (ev) { y0 = ev.touches[0].clientY; }, { passive: true });
    b.addEventListener('touchmove', function (ev) {
      if (y0 === null) return; var dy = Math.min(0, ev.touches[0].clientY - y0);
      b.style.transform = 'translateY(' + dy + 'px)'; if (dy < -36) { y0 = null; hide(); }
    }, { passive: true });
    b.addEventListener('touchend', function () { y0 = null; if (!gone) b.style.transform = ''; });
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); hide();
      if (navOn) go(urlOf(b.getAttribute('href')), true); else location.href = b.getAttribute('href');
    });
    document.body.appendChild(b);
    setTimeout(hide, 5000);
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

  // ════ Share my stats (views/app/share.js) ════
  // A story-style editor. The card is the site's PNG (/api/games/:id/my-stat-card.png): each
  // template's thumbnail loads small (?thumb=1), the big card as a blob, kept per setting.
  // Tools (top right) open their choices on the bottom fade, one at a time; tapping the open
  // tool again or the card closes it, leaving the card on its own (full width, as on a story).
  // It opens on Templates. Share: Save image (a download; on iPhone,
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
    var thumbs = function () {
      $$('[data-thumb]', root).forEach(function (t) {
        var tpl = t.getAttribute('data-thumb');
        if (!onPhone(tpl)) { t.src = url(tpl, true); return; }
        load(tpl).then(function (c) { if (t.src !== c.url) t.src = c.url; }, function () {});
      });
    };
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
    // Premium templates the phone draws itself (public/share-cards.js) when the server sent their
    // facts (not locked): no request per template or colour, and they work offline once loaded.
    // The preview and thumbnails are the SVG; the PNG is made as soon as the card is on show, so
    // it's ready when Share is tapped (the share sheet must open inside the tap). Drawing fails:
    // the server's PNG, as for every other template.
    var phoneKeys = (root.getAttribute('data-phone') || '').split(' ').filter(Boolean);
    var cardEl = $('[data-sh-card]', root), drawer = null;
    var onPhone = function (tpl) { return !!cardEl && phoneKeys.indexOf(tpl) >= 0; };
    var getDrawer = function () {
      if (!drawer) drawer = new Promise(function (ok, no) {
        var made = function () { try { ok(window.wkndShareCards.phoneDrawer(JSON.parse(cardEl.textContent), { photoUrl: root.getAttribute('data-photo') })); } catch (e) { no(e); } };
        if (window.wkndShareCards) return made();
        var s = document.createElement('script'); s.type = 'module'; s.src = '/share-cards.js?v=' + ver;
        s.onload = made; s.onerror = function () { drawer = null; no(''); };
        document.head.appendChild(s);
      });
      return drawer;
    };
    var fromServer = function (k) {
      return fetch(k, { credentials: 'same-origin' }).then(function (r) { if (r.status === 401) { location.href = '/app/login'; throw ''; } if (!r.ok) throw 'Couldn\'t make the card. Try again.'; return r.blob(); });
    };
    // The card on screen loads first; the thumbnails and the other templates follow it.
    // A card: { url (shown), blob + file (the PNG, to save or share) } and, drawn on the phone, svg.
    var pending = {};
    var load = function (tpl) {
      var k = url(tpl, false), accent = st.accent;
      if (cache[k]) return Promise.resolve(cache[k]);
      var server = function () { return fromServer(k).then(function (b) { var u = URL.createObjectURL(b); return { blob: b, url: u, file: u }; }); };
      if (!pending[k]) pending[k] = (onPhone(tpl)
        ? getDrawer().then(function (d) { return d.draw(tpl, accent).then(function (u) { return { url: u, svg: u, drawer: d }; }); }).catch(server)
        : server())
        .then(function (c) { delete pending[k]; return (cache[k] = c); }, function (e) { delete pending[k]; throw e; });
      return pending[k];
    };
    var raster = function (c, k) {
      return c.raster || (c.raster = c.drawer.png(c.svg).catch(function () { return fromServer(k); })
        .then(function (b) { c.blob = b; c.file = URL.createObjectURL(b); }, function () { c.raster = null; }));
    };
    function render() {
      var k = url(st.tpl, false);
      say('');
      var show = function (c) {
        if (k !== url(st.tpl, false)) return;
        current = c; img.src = c.url; img.hidden = false; spin.hidden = true; thumbs(); preload();
        if (!c.blob) raster(c, k);
      };
      if (cache[k]) return show(cache[k]);
      spin.hidden = false;
      load(st.tpl).then(show, function (e) { if (k !== url(st.tpl, false)) return; spin.hidden = true; thumbs(); say(typeof e === 'string' && e ? e : 'No connection. The card needs the internet.'); });
    }
    // Every other template's full card for the current colour, two at a time, so a tap shows at
    // once. Skipped when the phone asks to save data (the ones drawn on the phone cost nothing).
    function preload() {
      var save = navigator.connection && navigator.connection.saveData;
      var list = [];
      $$('[data-tpl], [data-variant]', root).forEach(function (b) {
        var tpl = b.getAttribute('data-variant') || b.getAttribute('data-tpl'), k = url(tpl, false);
        if (!cache[k] && !pending[k] && list.indexOf(tpl) < 0 && (!save || onPhone(tpl))) list.push(tpl);
      });
      var next = function () { var tpl = list.shift(); if (tpl && root.isConnected) return load(tpl).then(next, next); };
      next(); next();
    }
    // Panels: the open tool's choices take the template strip's place.
    function panel(name) {
      $$('[data-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      root.classList.toggle('is-clean', !name);
      $$('[data-tool]', root).forEach(function (t) { var on = t.getAttribute('data-tool') === name; t.classList.toggle('is-on', on); t.setAttribute('aria-expanded', String(on)); });
    }
    var log = function (action) {
      fetch('/api/games/' + encodeURIComponent(game) + '/stat-card-action', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, template: st.tpl, focus: st.focus, accent: st.accent }) }).catch(function () {});
    };
    var fileOf = function () { return new File([current.blob], 'wknd-stats-' + game + '.png', { type: 'image/png' }); };
    var canShareFile = function () { try { return !!(navigator.canShare && navigator.canShare({ files: [fileOf()] })); } catch (e) { return false; } };
    var sheet = function (action) {
      navigator.share({ files: [fileOf()] }).then(function () { log(action); panel(''); }, function (e) { if (e && e.name !== 'AbortError') say('Sharing didn\'t work. Try Save image.'); });
    };
    var download = function () {
      var a = document.createElement('a'); a.href = current.file; a.download = 'wknd-stats-' + game + '.png';
      document.body.appendChild(a); a.click(); a.remove(); log('save'); panel(''); toast('Saved');
    };
    var copy = function () {
      if (!navigator.clipboard || !window.ClipboardItem) return say('This phone can\'t copy pictures. Use Save image.');
      navigator.clipboard.write([new ClipboardItem({ 'image/png': current.blob })])
        .then(function () { log('copy'); panel(''); toast('Copied. Paste it into your story'); }, function () { say('Couldn\'t copy it. Use Save image.'); });
    };
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) { if (e.target === img || e.target.closest('[data-sh-stage]')) panel(''); return; }
      var on = function (sel) { $$(sel, root).forEach(function (x) { x.classList.toggle('is-on', x === b); }); };
      if (b.hasAttribute('data-tool')) { var t = b.getAttribute('data-tool'); panel(b.classList.contains('is-on') ? '' : t); }
      else if (b.hasAttribute('data-tpl')) {
        var vars = $('[data-vars="' + b.getAttribute('data-fam') + '"] .is-on', root);
        pickTpl(vars ? vars.getAttribute('data-variant') : b.getAttribute('data-tpl')); remember(); render();
      } else if (b.hasAttribute('data-variant')) { pickTpl(b.getAttribute('data-variant')); remember(); render(); }
      else if (b.hasAttribute('data-accent')) { on('[data-accent]'); st.accent = b.getAttribute('data-accent'); remember(); render(); }
      else if (b.hasAttribute('data-focus')) { on('[data-focus]'); st.focus = b.getAttribute('data-focus'); render(); }
      else if (b.hasAttribute('data-bg')) { on('[data-bg]'); $('[data-sh-stage]', root).setAttribute('style', b.getAttribute('data-css') || ''); }
      else if (b.hasAttribute('data-sh-do')) {
        if (!current || !current.blob) return say('The card is still loading.');
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
    panel('tpl'); render();
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
    swipeToClose(el, '.th__comp', '.th__list');
  }
  // Swipe down to close a sheet: from the top bar, or anywhere in its list once that's
  // scrolled to the top (a swipe up still scrolls it). Not from skip (the box you type in).
  function swipeToClose(el, skip, listSel) {
    var box = $('.sheet__box', el), y0 = null, dy = 0, list = null, dragging = false;
    box.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1 || (e.target.closest && e.target.closest(skip))) { y0 = null; return; }
      list = e.target.closest && e.target.closest(listSel);
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
  // The feed's first two games are fetched ahead (most launches end in a tap on the latest
  // result), so that tap opens at once. Not on data saver.
  function feedAhead(box, items) {
    if (!/^\/app\/feed\/items/.test(box.getAttribute('data-lazy-src')) || typeof prefetch !== 'function'
      || (navigator.connection && navigator.connection.saveData)) return;
    var ahead = [];
    // The card's own link, not its "Share my stats" (/share), which used to take a slot.
    $$('a.gx__link[href^="/app/games/"]', items).forEach(function (a) { var u = urlOf(a.href); if (ahead.length < 2 && ahead.indexOf(u) === -1) ahead.push(u); });
    setTimeout(function () { ahead.forEach(prefetch); }, 1500);
  }
  function initLazyLists() {
    lazyObservers.forEach(function (o) { o.disconnect(); }); lazyObservers = [];
    $$('[data-lazy-src]').forEach(function (box) {
      var items = $('.lazy__items', box), skel = $('.lazy__skel', box) || document.createElement('div'), end = $('.lazy__end', box);
      // A screen put back from memory (see "Kept screens") carries on where it was: its rows
      // are there, data-lazy-next says what's left. So does a first page the server drew in the
      // screen (data-lazy-inline: Home's feed); the first time it's up it counts as the first
      // page landing.
      var resumed = box.hasAttribute('data-lazy-next');
      if (box.hasAttribute('data-lazy-inline') && !box._inline) {
        box._inline = true;
        wakeImgs(items);
        document.dispatchEvent(new Event('wknd:list-first'));
        feedAhead(box, items);
      }
      var next = resumed ? box.getAttribute('data-lazy-next') : box.getAttribute('data-lazy-src'), busy = false;
      // The first page: the copy on the phone (public/app-sw.js keeps one) shows at once, then
      // the network's answer replaces it, or is skipped when it's the same.
      var first = !resumed, shownCopy = null;
      if (first && window.caches) {
        caches.match(next, { cacheName: 'wknd-data' }).then(function (r) { return r && r.json(); }).then(function (j) {
          if (!j || !j.html || !first || !box.isConnected) return;
          shownCopy = j.html;
          items.hidden = false; items.innerHTML = j.html; skel.hidden = true; initVideos(); initPapawis(); wakeImgs(items);
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
            if (wasFirst) document.dispatchEvent(new Event('wknd:list-first')); // the tab warm-up waits for this
            // Feed pages can carry Papawis cards with their join button (initPapawis binds new ones).
            if (wasFirst && shownCopy !== null) { if (j.html !== shownCopy) { items.innerHTML = j.html || ''; initVideos(); initPapawis(); wakeImgs(items); } }
            else if (j.html) { items.hidden = false; items.insertAdjacentHTML('beforeend', j.html); initVideos(); initPapawis(); wakeImgs(items); }
            skel.hidden = true;
            if (wasFirst) feedAhead(box, items);
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
        // A screen the server says not to keep (X-App-No-Copy: an admin's game with its Review
        // card) isn't reused from memory either: it's always fetched fresh. Not Cache-Control:
        // every app screen is no-store for the browser's cache (2026-10-27: reading that kept
        // no screen at all for a day).
        if (!r.headers.get('X-App-No-Copy')) { pages[url] = page; if (finalUrl !== url) pages[finalUrl] = page; }
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
  // force: re-render even when nothing changed (pull to refresh reloads the lists that way).
  // Signed out meanwhile: go to sign-in rather than leave the old screen up.
  // public/live-score.js: a game that stopped being live (published, switched off) is swapped
  // for the fresh screen, never reloaded (a reload would get the phone's copy back).
  window.wkndRefreshScreen = function () { return refreshScreen(true); };
  function refreshScreen(force) {
    if (!navOn) { location.reload(); return new Promise(function () {}); }
    var id = navId;
    return fetchPage(currentUrl, true).then(function (p) { if (id === navId) swapIfChanged(p, force); }, function (e) {
      if (e && e.reload && /^\/app\/login/.test(new URL(e.reload, location.href).pathname)) location.href = e.reload;
    });
  }
  // What the screen on show was built from: its main and tab bar as the server sent them
  // (never read back from the page: initPage changes it — countdowns, lists, toggles).
  // null when unknown, e.g. a kept screen. Whole pages never match: each has its own app-time.
  var partsOf = function (doc) {
    var m = doc.querySelector('main.app'), n = doc.querySelector('nav.tabbar'), v = doc.querySelector('meta[name="app-ver"]');
    return m ? { main: m.innerHTML, nav: n ? n.innerHTML : '', ver: v ? v.content : '' } : null;
  };
  var shown = partsOf(document);
  // A fresh copy of the screen on show: swap it in only if it changed. Only the tab bar
  // changed (badges): swap just that.
  function swapIfChanged(page, force) {
    var doc = new DOMParser().parseFromString(page.html || '', 'text/html');
    var now = !force && shown && partsOf(doc);
    if (now && now.ver === shown.ver && now.main !== shown.main && patchHome(doc)) {
      var nb = $('nav.tabbar');
      if (now.nav !== shown.nav && nb) nb.innerHTML = now.nav;
      shown = now; loadedAt = Date.now();
      return;
    }
    if (!now || now.main !== shown.main || now.ver !== shown.ver) return render(page, false, true);
    var cur = $('nav.tabbar');
    if (now.nav !== shown.nav && cur) cur.innerHTML = now.nav;
    shown = now;
    loadedAt = Date.now();
  }
  // Home, fresh from the server: only the parts that changed are put in, so the feed doesn't
  // flash and its pictures don't load again while the player is reading (the fresh copy
  // differs almost every launch: Today/Yesterday, fire and comment counts). Each part of the
  // screen is compared as the server sent it, before and now; in the feed, card by card
  // (data-fk). Anything else (a new card at the top, a part with its own live bits) and the
  // whole screen goes in as before. true when patched.
  function patchHome(doc) {
    var live = $('main.app'), fresh = doc.querySelector('main.app');
    if (!live || !fresh || !live.querySelector('[data-lazy-inline]') || !fresh.querySelector('[data-lazy-inline]')) return false;
    var before = new DOMParser().parseFromString('<main>' + shown.main + '</main>', 'text/html').querySelector('main');
    var L = live.children, O = before.children, N = fresh.children;
    if (L.length !== O.length || O.length !== N.length) return false;
    var swaps = [], lists = [];
    for (var i = 0; i < N.length; i++) {
      if (O[i].tagName !== N[i].tagName || L[i].tagName !== N[i].tagName) return false;
      if (O[i].outerHTML === N[i].outerHTML) continue;
      if (N[i].hasAttribute('data-lazy-inline')) { lists.push([L[i], O[i], N[i]]); continue; }
      // Parts that set themselves up (blocks, forms, countdowns, sheets): the whole screen.
      if (N[i].matches('[data-block-src], form, [data-push-ask], .poll-take') || N[i].querySelector('[data-block-src], form, input, [data-countdown], [data-countdown-to], [data-close-at], [data-pw-cd]')) return false;
      swaps.push([L[i], N[i]]);
    }
    // The feed: the same cards in the same order, each replaced only if it changed.
    var keys = function (box) { return Array.prototype.map.call($('.lazy__items', box).children, function (c) { return c.getAttribute('data-fk') || 'day:' + c.textContent.trim(); }); };
    for (var k = 0; k < lists.length; k++) {
      var lb = lists[k][0], ob = lists[k][1], nb = lists[k][2];
      var ok = keys(ob), nk = keys(nb), lk = keys(lb).slice(0, ok.length);
      if (ok.join('|') !== nk.join('|') || lk.join('|') !== ok.join('|')) return false;
      var lc = $('.lazy__items', lb).children, oc = $('.lazy__items', ob).children, nc = $('.lazy__items', nb).children;
      for (var j = 0; j < nc.length; j++) if (oc[j].outerHTML !== nc[j].outerHTML) swaps.push([lc[j], nc[j]]);
    }
    swaps.forEach(function (s) {
      var el = document.importNode(s[1], true);
      s[0].replaceWith(el);
      wakeImgs(el);
    });
    if (swaps.length) { initVideos(); initPapawis(); if (window.wkndBkSync) window.wkndBkSync(); }
    return true;
  }
  var prefetch = function (url) { if (!pages[url] && !inflight[url] && navigator.onLine) fetchPage(url).catch(function () {}); };
  // Links in view, fetched ahead once the screen has settled and nothing else is loading: up to
  // 4 (Me → Settings was 650 ms on a tap; a touch is too short a head start). Not games (the
  // feed fetches its top two), share screens, money, admin or the chat; not on data saver or
  // a 2G-slow signal (Fable speed audit, 2026-10-28).
  var AHEAD_SKIP = /^\/app\/(games\/|settle|logout|admin|barkadahan|setup|login|passkeys|score)|\/share(\?|$)/;
  function warmLinks(again) {
    var c = navigator.connection;
    if (!navOn || !navigator.onLine || (c && (c.saveData || /2g/.test(c.effectiveType || '')))) return;
    var run = function () {
      if (Object.keys(inflight).length) { if (!again) setTimeout(function () { warmLinks(true); }, 2500); return; }
      var h = window.innerHeight, n = 0;
      $$('main.app a[href^="/app/"]').forEach(function (a) {
        if (n >= 4 || !eligible(a)) return;
        var u = urlOf(a.href);
        if (AHEAD_SKIP.test(u) || u === currentUrl || pages[u] || inflight[u]) return;
        var r = a.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > h) return;
        n++; prefetch(u);
      });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1500);
  }

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
    shown = page.el ? null : partsOf(doc);
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
      // A new screen is a page view for GA (server.js buildAppGaSnippet); a refresh isn't.
      if (fromUrl !== page.url && window.wkndGaView) try { window.wkndGaView(); } catch (e) {}
      initPage();
      if (fromUrl !== page.url) setTimeout(warmLinks, 1500);
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
        if (id === navId && !dirty()) swapIfChanged(fresh);
      }).catch(function () {});
      return;
    }
    // Not in memory: the copy on the phone (the service worker's, from an earlier visit) goes up
    // at once, and the fresh screen swaps in behind it when it lands, as on a launch. With no
    // copy, or the network first, the fresh screen as before.
    progress(true);
    var settled = false;
    var net = fetchPage(url, false, true);
    phoneCopy(url).then(function (page) {
      if (!page || settled || id !== navId) return;
      settled = true; progress(false);
      render(page, push, false, dir);
      net.then(function (fresh) { if (id === navId && !dirty()) swapIfChanged(fresh); }, function () {});
    });
    net.then(function (page) { if (settled) return; settled = true; if (id === navId) { progress(false); render(page, push, false, dir); } })
      .catch(function (e) { if (settled) return; settled = true; progress(false); if (id === navId) location.href = (e && e.reload) || url; });
  }
  // A screen's copy in the service worker's store (public/app-sw.js PAGES), if it was built in
  // the last day: an older one would change too much when the fresh one swaps in.
  var COPY_MAX = 24 * 60 * 60 * 1000;
  function phoneCopy(url) {
    if (!window.caches) return Promise.resolve(null);
    return caches.open('wknd-pages').then(function (c) { return c.match(url); }).then(function (r) {
      return r ? r.text().then(function (html) {
        var t = /<meta name="app-time" content="(\d+)"/.exec(html);
        return t && Date.now() - Number(t[1]) < COPY_MAX ? { html: html, url: url } : null;
      }) : null;
    }).catch(function () { return null; });
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
      // Back on a screen anyone can open from anywhere (a profile): back in history when an app
      // screen is behind it, so a face tapped in the chat goes back to the chat.
      if (a.hasAttribute('data-hist-back') && history.state && history.state.app) { history.back(); return; }
      var url = urlOf(a.href);
      if (url === urlOf(location.href) && !a.hash) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      go(url, true);
    });
    // A face or name (data-pid, views/app/layout.js appAvatar) opens that player's profile,
    // unless it's part of a link or a button.
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      var f = e.target.closest && e.target.closest('[data-pid]');
      if (!f || f.closest('a, button, label')) return;
      var pid = f.getAttribute('data-pid'); if (!pid) return;
      e.preventDefault();
      go('/app/players/' + encodeURIComponent(pid), true);
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
    // Not ahead of the screen's own list (Home's feed): after its first page, or 4 s at most.
    // On data saver or a 2G-slow signal, only once the player touches the screen.
    var warmed = false;
    // (Not the screen it opened on while the service worker is handing its fresh copy over:
    // that copy fills the same slot.)
    var warmTabs = function () {
      if (warmed) return; warmed = true;
      var here = urlOf(location.href);
      [here].concat($$('.tabbar a.tab').map(function (a) { return urlOf(a.href); })).forEach(function (u) { if (u !== here || !launchWait) prefetch(u); });
      setTimeout(warmLinks, 2000);
    };
    var conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) document.addEventListener('touchstart', warmTabs, { once: true, passive: true });
    else {
      var idleWarm = function () { if ('requestIdleCallback' in window) requestIdleCallback(warmTabs, { timeout: 2000 }); else setTimeout(warmTabs, 800); };
      if ($('[data-lazy-src]')) { document.addEventListener('wknd:list-first', idleWarm, { once: true }); setTimeout(warmTabs, 4000); }
      else idleWarm();
    }
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
      if (busy || sheet || e.touches.length > 1 || window.scrollY > 0 || !$('nav.tabbar') || (e.target.closest && e.target.closest('.player, .adm-grip'))) return;
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
      refreshScreen(true).then(done, done);
    };
    document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
  })();

  // No pinch zoom (iPhone ignores user-scalable=no; its own gesture events can be stopped).
  ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });

  initPage();
  // Back to a sign-in page from the phone's back-forward cache: its button was left busy.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    $$('form[data-busy]').forEach(function (f) { f._sending = false; var b = $('button[type="submit"]', f); if (b) b.classList.remove('is-busy'); });
  });

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
  // The fresh screen comes from the service worker, which fetched it behind the copy and posts
  // it here ('fresh'): asking the server again sent and built every launch twice (Fable speed
  // audit, 2026-10-28). A worker that doesn't post (an older one, none, or its fetch failed)
  // and the page fetches it itself.
  var launchWait = null;
  if (navOn && builtAt && Date.now() - builtAt > 15000 && navigator.onLine) {
    launchWait = setTimeout(function () { launchWait = null; refreshScreen(); }, navigator.serviceWorker && navigator.serviceWorker.controller ? 8000 : 0);
  }
  function launchFresh(d) {
    if (!launchWait) return;
    clearTimeout(launchWait); launchWait = null;
    if (d.url !== currentUrl) return; // moved on meanwhile: that screen is fresh already
    if (!d.html) { refreshScreen(); return; } // not a plain screen (signed out, redirected): as before
    var page = { html: d.html, url: d.url, at: Date.now() };
    pages[d.url] = page;
    if (!dirty()) swapIfChanged(page);
  }
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
