import { escHtml } from './layout.js';
import { authShell, playerCard } from './auth-shell.js';

// Activation step 2 of 2 — "Snap your game face". Shown once, right after a first-time
// password set (never on a reset). Same private liveness capture as Season Signup
// (liveness_captures, super-admin-only), so the photo taken here also covers the
// "liveness photo before continuing" check on their first Season Signup. Two paths, like
// there: this device's camera (POST /activate/liveness-capture) or a QR handoff to a phone
// (POST /activate/liveness-token → the shared token page + /ws/liveness/:token). The selfie
// only ever lands on the card in this browser; it is never the public profile photo.
// card: { name, initials, positions, intro }
export function activatePage({ prompt = '', card = {} } = {}) {
  return authShell({
    split: true,
    backdrop: 'glow',
    body: `<section class="au-card au-card--mid" aria-labelledby="gf-h">
        <div>
          <div class="au-k au-k--amber">LAST THING</div>
          <h1 class="au-h1" id="gf-h">Snap your game face</h1>
          <p class="au-sub">A quick selfie so we know it's really you behind this account.</p>
        </div>
        <ol class="au-steps" aria-label="Step 2 of 2"><li class="is-done">1 · Password ✓</li><li class="is-on">2 · Game face</li></ol>

        <div class="au-cam" id="gf-cam">
          <div class="au-cam__prompt"><span>YOUR POSE</span>${escHtml(prompt)}</div>
          <div class="au-cam__idle" id="gf-idle">Turn on your camera, strike the pose, snap.</div>
          <svg class="au-cam__guide hidden" id="gf-guide" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><ellipse cx="200" cy="160" rx="78" ry="98" fill="none" stroke="#f59332" stroke-width="2.5" stroke-dasharray="7 7" opacity=".85"/></svg>
          <video id="gf-video" class="hidden" autoplay playsinline muted></video>
          <img id="gf-preview" class="hidden" alt="Your snapshot">
          <div class="au-cam__qr hidden" id="gf-qr">
            <img id="gf-qr-img" alt="QR code to open the camera on your phone">
            <span>Scan with your phone's camera. This page updates by itself when the photo arrives.</span>
          </div>
        </div>
        <canvas id="gf-canvas" class="hidden"></canvas>

        <label class="au-check"><input type="checkbox" id="gf-consent"><span>OK — league admins can keep this photo to check it's me. It isn't my profile picture.</span></label>

        <div class="au-g2" id="gf-start">
          <button type="button" class="au-btn au-btn--amber" id="gf-camera" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Turn on camera
          </button>
          <button type="button" class="au-btn au-btn--ghost" id="gf-phone" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>Use my phone
          </button>
        </div>
        <button type="button" class="au-btn au-btn--amber au-btn--block hidden" id="gf-snap">Snap it</button>
        <div class="au-g2 hidden" id="gf-confirm">
          <button type="button" class="au-btn au-btn--ghost" id="gf-retake">Retake</button>
          <button type="button" class="au-btn au-btn--amber" id="gf-use">Use this photo</button>
        </div>
        <div class="au-ok hidden" id="gf-done" role="status">Got it — you're verified. Welcome in!</div>
        <a class="au-btn au-btn--amber au-btn--block hidden" id="gf-go" href="/me">Go to My Profile →</a>
        <div class="au-error hidden" id="gf-error" role="alert"></div>

        <div style="display:flex;justify-content:center" id="gf-skip-row">
          <a href="/me" class="au-back" id="gf-skip" style="font-size:13px;text-align:center">Skip for now — you'll need one before your first Season Signup</a>
        </div>
      </section>
      <aside class="au-aside" aria-label="Your player card">
        <div class="au-k" id="gf-card-k">YOUR PLAYER CARD</div>
        <div id="gf-card">${playerCard({ name: card.name, initials: card.initials, chips: card.positions ? [{ text: card.positions }] : [], intro: card.intro, status: { text: 'Approved ✓', kind: 'ok' }, ids: 'gfc' })}</div>
        <p class="au-note" style="text-align:left">The selfie only shows here, for you. Add your real profile photo from My Profile.</p>
      </aside>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var consent = $('gf-consent'), camBtn = $('gf-camera'), phoneBtn = $('gf-phone'), snapBtn = $('gf-snap');
  var confirmRow = $('gf-confirm'), retakeBtn = $('gf-retake'), useBtn = $('gf-use');
  var video = $('gf-video'), preview = $('gf-preview'), canvas = $('gf-canvas'), idle = $('gf-idle'), guide = $('gf-guide');
  var qr = $('gf-qr'), qrImg = $('gf-qr-img'), errEl = $('gf-error');
  var stream = null, dataUrl = null, ws = null;

  function show(el, on) { el.classList.toggle('hidden', !on); }
  function setError(msg) { errEl.textContent = msg || ''; show(errEl, !!msg); }

  consent.addEventListener('change', function () { camBtn.disabled = phoneBtn.disabled = !consent.checked; });

  // Same guard as Season Signup: on an insecure origin navigator.mediaDevices is missing and
  // the call throws synchronously, and a permission prompt can hang — both become a message.
  function requestCamera(cb) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return cb(null, 'insecure-context');
    var settled = false;
    var timer = setTimeout(function () { if (!settled) { settled = true; cb(null, 'timeout'); } }, 12000);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (s) {
      clearTimeout(timer);
      if (settled) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      settled = true; cb(s, null);
    }).catch(function (e) { clearTimeout(timer); if (!settled) { settled = true; cb(null, (e && e.name) || 'error'); } });
  }
  function camMessage(r) {
    if (r === 'insecure-context') return 'Camera access needs a secure connection — use the phone option instead.';
    if (r === 'timeout') return 'The camera prompt took too long. Try again, or use your phone.';
    if (r === 'NotAllowedError') return 'Camera access was blocked — allow it in your browser settings, or use your phone.';
    if (r === 'NotFoundError') return 'No camera found on this device — use your phone instead.';
    return "Couldn't start the camera — try your phone instead.";
  }
  function stopStream() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }

  function finish(src) {
    stopStream();
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    [ $('gf-start'), snapBtn, confirmRow, qr, guide, $('gf-skip-row') ].forEach(function (el) { show(el, false); });
    show($('gf-done'), true); show($('gf-go'), true); setError('');
    consent.disabled = true;
    // Put the selfie on the card — this browser only.
    var av = $('gfc-av');
    if (av) {
      av.classList.add('is-verified');
      av.innerHTML = '';
      if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; av.appendChild(im); }
      else { var sp = document.createElement('span'); sp.textContent = '✓'; av.appendChild(sp); }
      var st = document.createElement('span'); st.className = 'au-stamp'; st.textContent = 'VERIFIED HUMAN ✓'; av.appendChild(st);
    }
    var status = $('gfc-status'); if (status) status.textContent = 'Active ✓';
    $('gf-card-k').textContent = 'YOUR PLAYER CARD · VERIFIED';
  }

  camBtn.addEventListener('click', function () {
    setError('');
    requestCamera(function (s, reason) {
      if (!s) return setError(camMessage(reason));
      stream = s; video.srcObject = s;
      show(idle, false); show(video, true); show(guide, true); show($('gf-start'), false); show(snapBtn, true);
    });
  });

  snapBtn.addEventListener('click', function () {
    // Capped at 900px on the long side — a reference photo, and full-resolution phone
    // frames can exceed the upload limit (see Season Signup's identical note).
    var scale = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    var ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1); // match the mirrored preview
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    preview.src = dataUrl;
    show(preview, true); show(video, false); show(guide, false); show(snapBtn, false); show(confirmRow, true);
  });

  retakeBtn.addEventListener('click', function () {
    dataUrl = null;
    show(preview, false); show(video, true); show(guide, true); show(confirmRow, false); show(snapBtn, true);
  });

  useBtn.addEventListener('click', function () {
    if (!dataUrl) return;
    useBtn.disabled = retakeBtn.disabled = true; setError('');
    fetch('/activate/liveness-capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: dataUrl }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        useBtn.disabled = retakeBtn.disabled = false;
        if (!res.ok) return setError(res.d.error || "Couldn't save the photo — try again.");
        finish(dataUrl);
      })
      .catch(function () { useBtn.disabled = retakeBtn.disabled = false; setError('Network error — try again.'); });
  });

  phoneBtn.addEventListener('click', function () {
    setError(''); phoneBtn.disabled = true;
    fetch('/activate/liveness-token', { method: 'POST' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        phoneBtn.disabled = false;
        if (!res.ok) return setError(res.d.error || "Couldn't make the QR code — try again.");
        stopStream();
        qrImg.src = res.d.qrDataUrl;
        show(qr, true); show(idle, false); show(video, false); show(guide, false); show(snapBtn, false);
        var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(proto + '//' + location.host + '/ws/liveness/' + encodeURIComponent(res.d.token));
        ws.onmessage = function (ev) {
          try { if (JSON.parse(ev.data).type === 'captured') finish(null); } catch (e) {}
        };
      })
      .catch(function () { phoneBtn.disabled = false; setError('Network error — try again.'); });
  });
})();
</script>`,
  });
}
