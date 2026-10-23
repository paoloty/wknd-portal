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
  var deferredInstall = null, cdTimer = null, loadedAt = Date.now();

  // ════ Per screen: everything that hooks into the current page's content ════
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

    // Setup photo: shrink on the phone, send to the same /me/photo the site uses
    var pIn = $('[data-photo-input]');
    if (pIn) {
      var pMsg = $('[data-photo-msg]');
      var say = function (t, kind) { pMsg.hidden = !t; pMsg.className = 'msg msg--' + (kind || 'info'); pMsg.textContent = t || ''; };
      var shrink = function (img, max) {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.88);
      };
      pIn.addEventListener('change', function () {
        var file = pIn.files && pIn.files[0]; if (!file) return;
        say('Uploading…');
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var body = JSON.stringify({ dataUrl: shrink(img, 900), originalDataUrl: shrink(img, 2000) });
          fetch('/me/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (!res.ok) throw new Error(res.j && res.j.error || 'Upload failed');
              var av = $('[data-photo-preview] .avatar');
              if (av) { var old = $('img', av); if (old) old.remove(); var i2 = new Image(); i2.src = url; av.appendChild(i2); }
              say('Saved. Looking good.', 'ok');
              var next = $('[data-photo-next]'); if (next) next.textContent = 'Looks good';
              pages = {}; // screens showing the old photo
            })
            .catch(function (e) { say(e.message || 'Upload failed. Try another photo.', 'err'); });
        };
        img.onerror = function () { say('That file isn\'t a photo we can read. Try a JPG or PNG.', 'err'); };
        img.src = url;
      });
    }

    // Install hint (Home): iPhone gets the Share steps, Android the real prompt
    var card = $('[data-install-card]');
    if (card && !standalone) {
      if (deferredInstall) { card.hidden = false; $('[data-install-ios]', card).hidden = true; $('[data-install-android]', card).hidden = false; }
      else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) card.hidden = false;
      var ib = $('[data-install-btn]');
      if (ib) ib.addEventListener('click', function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; card.hidden = true; } });
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; initInstallOnly(); });
  function initInstallOnly() {
    var card = $('[data-install-card]');
    if (card && !standalone && deferredInstall) { card.hidden = false; $('[data-install-ios]', card).hidden = true; $('[data-install-android]', card).hidden = false; }
  }

  // ════ Fast navigation ════
  // In-app links are fetched and swapped in. Screens are kept in memory for this visit
  // only (a reload or log out clears them): shown at once when tapped again, then
  // refreshed from the server in the background. The tabs are fetched ahead once the
  // first screen has loaded, and any other link starts loading on touch.
  var pages = {}, inflight = {}, navId = 0;
  var NO_PREFETCH = /^\/app\/notifications/; // opening it marks notifications read
  var urlOf = function (u) { var x = new URL(u, location.href); return x.pathname + x.search; };
  var inApp = function (path) { return /^\/app(\/|$|\?)/.test(path) && !/^\/app\/(login|logout|sw\.js|manifest|version|offline|ping)/.test(path); };
  var eligible = function (a) {
    return a && a.href && !a.target && !a.hasAttribute('download') && a.origin === location.origin && inApp(a.pathname) && !a.hasAttribute('data-reload');
  };

  function fetchPage(url) {
    if (inflight[url]) return inflight[url];
    var p = fetch(url, { credentials: 'same-origin', headers: { 'X-App-Nav': '1' } }).then(function (r) {
      var finalUrl = urlOf(r.url);
      if (!r.ok || !inApp(new URL(r.url).pathname) || !/text\/html/.test(r.headers.get('content-type') || '')) throw { reload: r.url };
      return r.text().then(function (html) {
        var page = { html: html, url: finalUrl, at: Date.now() };
        pages[url] = page; if (finalUrl !== url) pages[finalUrl] = page;
        return page;
      });
    });
    inflight[url] = p;
    p.then(function () { delete inflight[url]; }, function () { delete inflight[url]; });
    return p;
  }
  var prefetch = function (url) { if (!pages[url] && !inflight[url] && !NO_PREFETCH.test(url) && navigator.onLine) fetchPage(url).catch(function () {}); };

  var bar = null, barTimer = null;
  function progress(on) {
    clearTimeout(barTimer);
    if (on) { barTimer = setTimeout(function () { if (!bar) { bar = document.createElement('div'); bar.className = 'nav-progress'; document.body.appendChild(bar); } }, 120); }
    else if (bar) { bar.remove(); bar = null; }
  }

  // Which way a move goes, like an iPhone app: between tabs a quick cross-fade; into a
  // screen below a tab (notifications, setup) a slide in from the right; back out a slide
  // the other way. Setup steps slide forward and back in their own order.
  var ROOTS = ['/app', '/app/team', '/app/me', '/app/papawis', '/app/more'];
  var STEPS = ['/app/setup/photo', '/app/setup/details', '/app/setup/season', '/app/setup/done'];
  var place = function (url) {
    var path = url.split('?')[0].replace(/\/$/, '') || '/app';
    if (ROOTS.indexOf(path) >= 0) return { depth: 0, step: 0 };
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
  function render(page, push, keepScroll, dir) {
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
    fetchPage(url).then(function (page) { if (id === navId) { progress(false); render(page, push, false, dir); } })
      .catch(function (e) { progress(false); if (id === navId) location.href = (e && e.reload) || url; });
  }

  if (window.fetch && window.DOMParser && history.pushState) {
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    pages[urlOf(location.href)] = { html: '<!DOCTYPE html>' + document.documentElement.outerHTML, url: urlOf(location.href), at: Date.now() };
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
    var warmTabs = function () { $$('.tabbar a.tab').forEach(function (a) { prefetch(urlOf(a.href)); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(warmTabs, { timeout: 2000 }); else setTimeout(warmTabs, 800);
  }

  initPage();

  // ════ Once per visit ════
  // Usage for /admin/app: the first open of the day on this phone, and whether it came
  // from the home screen (that's how "installed" is known on iPhone).
  var ping = function (body) {
    if (!navigator.onLine || !document.querySelector('.tabbar')) return; // signed-in screens only
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
  var offlineBar = null;
  var net = function () {
    if (navigator.onLine) { if (offlineBar) { offlineBar.remove(); offlineBar = null; } return; }
    if (offlineBar) return;
    offlineBar = document.createElement('div'); offlineBar.className = 'offline-bar'; offlineBar.textContent = 'You\'re offline · showing what was last loaded';
    document.body.insertBefore(offlineBar, document.body.firstChild);
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
