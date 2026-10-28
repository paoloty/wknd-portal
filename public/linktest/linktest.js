// Phone ↔ tablet link test (public/linktest/index.html, 2026-10-28). Proves the table display's
// offline plan before it's built: a direct WebRTC data channel between the scorer's phone and
// the table tablet over the phone's hotspot, with no internet and no server in between.
//
// Pairing, two scans: the tablet makes an offer and shows it as a QR code; the phone scans it,
// makes an answer and shows that; the tablet scans it back. The camera is opened before either
// side gathers its addresses: a page using the camera gets real network addresses instead of
// hidden ".local" names, which is what usually stops two devices finding each other offline.
//
// Then the phone runs the clock and the score and sends the whole state every second and on
// every change. The tablet runs its own copy of the clock from the last message, so a dropped
// second never freezes the board. Everything worth knowing lands in the on-screen log.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var logEl = $('[data-log]'), t0 = Date.now();
  function log(m) {
    logEl.textContent += ((Date.now() - t0) / 1000).toFixed(1).padStart(6, ' ') + 's  ' + m + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
  log('Device: ' + navigator.userAgent);
  log('Internet: ' + (navigator.onLine ? 'yes' : 'no'));
  window.addEventListener('online', function () { log('Internet: back'); });
  window.addEventListener('offline', function () { log('Internet: gone (the link should not care)'); });

  // ── Offline copy ──
  var offNote = $('[data-offline-note]');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/linktest/sw.js', { scope: '/linktest/' })
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function () { return caches.open('wknd-linktest').then(function (c) { return c.match('/linktest/'); }); })
      .then(function (hit) { offNote.textContent = hit ? 'Offline copy: saved on this device ✓' : 'Offline copy: saving… open this page once more with internet.'; })
      .catch(function (e) { offNote.textContent = 'Offline copy: not available (' + e.message + ')'; });
  } else offNote.textContent = 'Offline copy: this browser can\'t keep one.';

  function show(name) { Array.prototype.forEach.call(document.querySelectorAll('[data-screen]'), function (el) { el.hidden = el.getAttribute('data-screen') !== name; }); }
  function status(text, tone) { $('[data-pair-status]').textContent = text; $('[data-pair-dot]').className = 'dot dot--' + (tone || 'wait'); }
  $('[data-restart]').addEventListener('click', function () { location.reload(); });
  $('[data-copy]').addEventListener('click', function () {
    var t = logEl.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { log('Log copied'); }, function () { window.prompt('Copy the log:', t); });
  });

  // ── Codes: the offer or answer, squeezed, as text for a QR code ──
  // WK1 + O (offer) | A (answer) + Z (deflated) | R (raw) + base64url.
  function bytesOf(stream) { return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function pack(kind, sdp) {
    // TCP addresses never carry this link (it's UDP over the hotspot): left out, the code
    // shrinks and scans more easily off a phone screen.
    sdp = sdp.split('\r\n').filter(function (l) { return !(/^a=candidate:/.test(l) && / tcp /i.test(l)); }).join('\r\n');
    var raw = new TextEncoder().encode(sdp);
    var squeeze = window.CompressionStream
      ? bytesOf(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).then(function (b) { return { b: b, tag: 'Z' }; }, function () { return { b: raw, tag: 'R' }; })
      : Promise.resolve({ b: raw, tag: 'R' });
    return squeeze.then(function (r) {
      var bin = ''; for (var i = 0; i < r.b.length; i++) bin += String.fromCharCode(r.b[i]);
      return 'WK1' + kind + r.tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });
  }
  function unpack(text) {
    var m = /^WK1([OA])([ZR])([A-Za-z0-9_-]+)$/.exec(String(text).trim());
    if (!m) return Promise.resolve(null);
    var b64 = m[3].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
    var bin = atob(b64), b = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    var open = m[2] === 'Z'
      ? (window.DecompressionStream ? bytesOf(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))) : Promise.reject(new Error('This browser can\'t read squeezed codes')))
      : Promise.resolve(b);
    return open.then(function (bytes) { return { kind: m[1], sdp: new TextDecoder().decode(bytes) }; });
  }
  function drawQr(text, note) {
    var q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    // A quiet edge of 4 squares round the code: readers need it.
    var box = $('[data-qr]'); box.innerHTML = q.createSvgTag(4, 16);
    var svg = box.querySelector('svg');
    if (svg && !svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + parseFloat(svg.getAttribute('width')) + ' ' + parseFloat(svg.getAttribute('height')));
    if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); }
    box.hidden = false;
    $('[data-qr-note]').textContent = note; $('[data-qr-note]').hidden = false;
    log('Code shown: ' + text.length + ' characters, ' + q.getModuleCount() + '×' + q.getModuleCount() + ' squares');
  }
  function hideQr() { $('[data-qr]').hidden = true; $('[data-qr-note]').hidden = true; }

  // ── Camera and reading codes ──
  var video = $('[data-video]'), stream = null, scanning = false;
  function camera(note) {
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(function (s) {
      stream = s; video.srcObject = s; video.hidden = false;
      $('[data-cam-note]').textContent = note; $('[data-cam-note]').hidden = false;
      log('Camera on');
      return video.play().catch(function () {});
    });
  }
  function stopCamera() {
    scanning = false;
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; log('Camera off'); }
    video.hidden = true; $('[data-cam-note]').hidden = true;
  }
  // Android's built-in reader when there is one, jsQR otherwise (iPhone).
  function scan(onText) {
    scanning = true;
    var det = null;
    if ('BarcodeDetector' in window) { try { det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; } }
    log('Code reader: ' + (det ? 'built-in' : 'jsQR'));
    var c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true }), busy = false;
    var tick = function () {
      if (!scanning) return;
      if (!busy && video.readyState >= 2 && video.videoWidth) {
        busy = true;
        var read = det
          ? det.detect(video).then(function (r) { return r.length ? r[0].rawValue : null; }, function (e) { log('Built-in reader failed (' + e.message + '), using jsQR'); det = null; return null; })
          : Promise.resolve().then(function () {
            var w = Math.min(1080, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
            c.width = w; c.height = h; ctx.drawImage(video, 0, 0, w, h);
            var q = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            return q ? q.data : null;
          });
        read.then(function (text) {
          busy = false;
          if (text && scanning && /^WK1/.test(text)) { scanning = false; log('Code read (' + text.length + ' characters)'); onText(text); }
        });
      }
      setTimeout(tick, 120);
    };
    tick();
  }

  // ── The link ──
  var pc = null, ch = null;
  function newPc() {
    pc = new RTCPeerConnection({ iceServers: [] }); // no internet helpers: the hotspot only
    pc.onicecandidate = function (e) {
      if (!e.candidate || !e.candidate.candidate) return;
      var p = e.candidate.candidate.split(' ');
      var addr = p[4] || '?';
      log('My address: ' + addr + ':' + (p[5] || '?') + ' ' + (p[2] || '') + (/\.local$/.test(addr) ? '  ← hidden name, may not connect' : ''));
    };
    pc.oniceconnectionstatechange = function () { log('Link check: ' + pc.iceConnectionState); };
    pc.onconnectionstatechange = function () { log('Connection: ' + pc.connectionState); if (pc.connectionState === 'failed') linkDown('Couldn\'t connect. Both on the iPhone\'s hotspot? Start over to try again.'); };
    return pc;
  }
  function gathered() {
    return new Promise(function (res) {
      if (pc.iceGatheringState === 'complete') return res();
      var done = false, fin = function (why) { if (done) return; done = true; if (why) log(why); res(); };
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') fin(); });
      setTimeout(function () { fin('Address search stopped after 4 s'); }, 4000);
    });
  }
  var lock = null;
  function wake() {
    if (!('wakeLock' in navigator)) { log('Keep-awake: not supported here, keep the screen on by hand'); return; }
    navigator.wakeLock.request('screen').then(function (l) { lock = l; log('Keep-awake: on'); }, function (e) { log('Keep-awake failed: ' + e.message); });
  }
  document.addEventListener('visibilitychange', function () {
    log(document.visibilityState === 'visible' ? 'Screen: back' : 'Screen: hidden (locked or another app)');
    if (document.visibilityState === 'visible' && ch && ch.readyState === 'open') { wake(); if (role === 'phone') send(); }
  });

  var role = '';
  Array.prototype.forEach.call(document.querySelectorAll('[data-role]'), function (b) {
    b.addEventListener('click', function () {
      role = b.getAttribute('data-role');
      log('Role: ' + (role === 'phone' ? 'scorer\'s phone' : 'table tablet'));
      (role === 'phone' ? startPhone : startTablet)().catch(function (e) { log('Stopped: ' + e.message); status(e.name === 'NotAllowedError' ? 'The camera is needed to read the codes. Allow it and start over.' : 'Something went wrong: ' + e.message, 'err'); });
    });
  });

  // Tablet: offer first, shown as a code; then read the phone's answer.
  function startTablet() {
    show('pair'); status('Allow the camera: it reads the phone\'s code', 'wait');
    return camera('Step 2: then hold the phone\'s code up to this camera').then(function () {
      newPc();
      ch = pc.createDataChannel('score', { ordered: true });
      wire(ch);
      status('Getting this tablet\'s address…', 'wait');
      return pc.createOffer();
    }).then(function (o) { return pc.setLocalDescription(o); })
      .then(gathered)
      .then(function () { return pack('O', pc.localDescription.sdp); })
      .then(function (code) {
        drawQr(code, 'Step 1: on the scorer\'s phone, tap "This is the scorer\'s phone" and point it here.');
        status('Waiting for the phone…', 'wait');
        var read = function () {
          scan(function (text) {
            unpack(text).then(function (d) {
              if (!d || d.kind !== 'A') { log('That isn\'t the phone\'s code, still looking'); return read(); }
              status('Connecting…', 'wait');
              return pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
            }).catch(function (e) { log('Couldn\'t use that code: ' + e.message); read(); });
          });
        };
        read();
      });
  }

  // Phone: read the tablet's offer, answer it, show the answer as a code.
  function startPhone() {
    show('pair'); status('Point the camera at the tablet\'s code', 'wait');
    return camera('Hold steady, about a forearm away from the tablet').then(function () {
      return new Promise(function (resolve, reject) {
        var read = function () {
          scan(function (text) {
            unpack(text).then(function (d) {
              if (!d || d.kind !== 'O') { log('That isn\'t the tablet\'s code, still looking'); return read(); }
              newPc();
              pc.ondatachannel = function (e) { ch = e.channel; wire(ch); };
              status('Getting this phone\'s address…', 'wait');
              return pc.setRemoteDescription({ type: 'offer', sdp: d.sdp })
                .then(function () { return pc.createAnswer(); })
                .then(function (a) { return pc.setLocalDescription(a); })
                .then(gathered) // camera still on here: real addresses
                .then(function () { stopCamera(); return pack('A', pc.localDescription.sdp); })
                .then(function (code) {
                  drawQr(code, 'Now hold this up to the tablet\'s camera.');
                  status('Waiting for the tablet to read it…', 'wait');
                  resolve();
                });
            }).catch(reject);
          });
        };
        read();
      });
    });
  }

  function wire(c) {
    c.onopen = function () {
      log('Linked ✓ direct, phone to tablet. Internet: ' + (navigator.onLine ? 'yes' : 'no'));
      stopCamera(); hideQr(); wake();
      if (role === 'tablet') { show('board'); board(); } else { show('control'); send(); beat = setInterval(send, 1000); phoneLoop(); }
    };
    c.onclose = function () { log('Link closed'); linkDown('Link closed. Start over on both devices to pair again.'); };
    c.onerror = function (e) { log('Link error: ' + ((e && e.error && e.error.message) || 'unknown')); };
    c.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (role === 'tablet') got(m); else if (m.t === 'ack') acked(m);
    };
  }
  var closed = false;
  function linkDown(text) {
    closed = true;
    if (role === 'tablet') { var b = $('[data-lost]'); b.textContent = text + ' (tap to start over)'; b.hidden = false; b.onclick = function () { location.reload(); }; }
    else if (role === 'phone') { $('[data-link]').textContent = text; $('[data-link-dot]').className = 'dot dot--err'; }
    if (!ch || ch.readyState !== 'open') status(text, 'err');
  }

  // ── Phone: the clock and the score ──
  var S = { a: 0, b: 0, q: 1, running: false, rem: 600000, at: 0 }, seq = 0, beat = null, lastAck = 0;
  var remNow = function () { return S.running ? Math.max(0, S.rem - (performance.now() - S.at)) : S.rem; };
  var fmt = function (ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function send() {
    if (!ch || ch.readyState !== 'open') return;
    try { ch.send(JSON.stringify({ t: 's', seq: ++seq, a: S.a, b: S.b, q: S.q, running: S.running, rem: Math.round(remNow()), sent: performance.now() })); }
    catch (e) { log('Send failed: ' + e.message); }
  }
  function acked(m) {
    lastAck = performance.now();
    var rtt = Math.round(performance.now() - m.sent);
    $('[data-link]').textContent = 'Linked to the tablet · ' + rtt + ' ms'; $('[data-link-dot]').className = 'dot dot--ok';
    if (m.seq % 30 === 0) log('Still linked · round trip ' + rtt + ' ms');
  }
  function phoneLoop() {
    var tick = function () {
      if (S.running && remNow() <= 0) { S.rem = 0; S.running = false; send(); log('Clock hit 0:00'); }
      $('[data-pclock]').textContent = fmt(remNow());
      $('[data-act="clock"]').textContent = S.running ? 'Stop clock' : 'Start clock';
      $('[data-pq]').textContent = 'Q' + S.q; $('[data-pa]').textContent = S.a; $('[data-pb]').textContent = S.b;
      if (!closed && lastAck && performance.now() - lastAck > 3000) { $('[data-link]').textContent = 'No reply from the tablet for ' + Math.round((performance.now() - lastAck) / 1000) + ' s'; $('[data-link-dot]').className = 'dot dot--wait'; }
      requestAnimationFrame(tick);
    };
    tick();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act], [data-pts]');
    if (!b || role !== 'phone') return;
    if (b.getAttribute('data-act') === 'clock') {
      if (S.running) { S.rem = remNow(); S.running = false; log('Clock stopped at ' + fmt(S.rem)); }
      else if (S.rem > 0) { S.at = performance.now(); S.running = true; log('Clock started at ' + fmt(S.rem)); }
    } else if (b.getAttribute('data-act') === 'quarter') {
      S.q += 1; S.rem = 600000; S.running = false; log('Quarter ' + S.q);
    } else {
      var p = b.getAttribute('data-pts').split(','); S[p[0]] = Math.max(0, S[p[0]] + Number(p[1]));
      log((p[0] === 'a' ? 'White' : 'Black') + ' ' + (Number(p[1]) > 0 ? '+' : '') + p[1] + ' → ' + S.a + '–' + S.b);
    }
    send();
  });

  // ── Tablet: the scoreboard, its own clock from the last message ──
  var L = null, lastMsg = 0, gapLogged = false;
  function got(m) {
    if (m.t !== 's') return;
    var now = performance.now();
    if (lastMsg && now - lastMsg > 3000) log('Phone back after ' + ((now - lastMsg) / 1000).toFixed(1) + ' s quiet');
    L = m; L.recv = now; lastMsg = now; gapLogged = false;
    try { ch.send(JSON.stringify({ t: 'ack', seq: m.seq, sent: m.sent })); } catch (e) {}
  }
  function board() {
    var tick = function () {
      var now = performance.now();
      if (L) {
        var rem = L.running ? Math.max(0, L.rem - (now - L.recv)) : L.rem;
        $('[data-sa]').textContent = L.a; $('[data-sb]').textContent = L.b; $('[data-q]').textContent = 'Q' + L.q;
        $('[data-clock]').textContent = fmt(rem); $('[data-run]').textContent = L.running ? 'Clock running' : 'Clock stopped';
      }
      var quiet = lastMsg ? now - lastMsg : 0;
      if (!closed) {
        var b = $('[data-lost]');
        if (quiet > 3000) {
          b.hidden = false; b.onclick = null;
          b.textContent = 'No word from the phone for ' + Math.round(quiet / 1000) + ' s. The clock keeps running from the last update.';
          if (!gapLogged) { gapLogged = true; log('Phone quiet for 3 s+'); }
        } else b.hidden = true;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
})();
