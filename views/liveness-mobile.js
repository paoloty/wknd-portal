import { escHtml } from './layout.js';

// Deliberately bare — no site header/nav/footer, no login required (the token itself is
// the authorization for this one narrow action). Scanned from a QR code shown on someone
// else's desktop screen, so this needs to load fast and work with zero context: one camera
// view, one button, one outcome. Reuses the same inline getUserMedia capture UI as the
// desktop-with-webcam path in views/season-signup.js, just without the accordion/form
// around it — see that file's Group 00 for the sibling implementation and shared rationale.
export function livenessMobilePage({ token, expired = false, prompt = '' } = {}) {
  if (expired) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link Expired — WKND Basketball</title>
<style>body{background:#020817;color:#e2e8f0;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.box{max-width:360px}h1{font-size:18px;margin:0 0 8px}p{color:#64748b;font-size:14px;line-height:1.6}</style>
</head><body><div class="box"><h1>This link has expired</h1><p>QR codes for the photo step are single-use and time out after a few minutes. Go back to Season Signup on your other device and generate a new one.</p></div></body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Take Photo — WKND Basketball</title>
<style>
  body { background:#020817; color:#e2e8f0; font-family:Arial,sans-serif; margin:0; padding:20px; min-height:100vh; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; }
  h1 { font-size:16px; margin:0 0 4px; text-align:center; }
  p.sub { color:#64748b; font-size:12.5px; margin:0 0 18px; text-align:center; max-width:320px; }
  .cam-wrap { width:100%; max-width:360px; aspect-ratio:3/4; background:#0d1424; border:1px solid #1e293b; border-radius:12px; overflow:hidden; position:relative; }
  video, canvas, img.preview { width:100%; height:100%; object-fit:cover; display:block; }
  .btn { width:100%; max-width:360px; margin-top:14px; padding:13px; border-radius:8px; border:none; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; }
  .btn-primary { background:#f59332; color:#0a0e16; }
  .btn-secondary { background:#151b26; color:#e2e8f0; border:1px solid #1e293b; }
  .btn:disabled { opacity:.5; cursor:default; }
  .row { display:flex; gap:10px; width:100%; max-width:360px; margin-top:14px; }
  .row .btn { margin-top:0; }
  .status { margin-top:14px; font-size:12.5px; color:#64748b; text-align:center; min-height:16px; }
  .status.ok { color:#22c55e; }
  .status.err { color:#f87171; }
  .hidden { display:none !important; }
  /* Pinned to the top of the camera view itself (not just above it) so it's still in
     view at the moment of framing/capture, not just something read once beforehand. */
  .prompt { position:absolute; top:0; left:0; right:0; z-index:1; margin:0; padding:10px 14px 16px; font-size:12px; line-height:1.4; color:#fff; text-align:center; background:linear-gradient(180deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.4) 65%, transparent 100%); box-sizing:border-box; }
  .prompt strong { color:#f59332; }
</style>
</head>
<body>
  <h1>Snap a Quick Photo</h1>
  <p class="sub">For admin's reference only — never shown publicly, never sent anywhere else. This finishes the Season Signup you started on your other device.</p>

  <div class="cam-wrap">
    ${prompt ? `<p class="prompt">📸 <strong>${escHtml(prompt)}</strong></p>` : ''}
    <video id="lv-video" autoplay playsinline muted></video>
    <canvas id="lv-canvas" class="hidden"></canvas>
    <img id="lv-preview" class="preview hidden" alt="Captured photo preview">
  </div>

  <button class="btn btn-primary" id="lv-start-btn">Enable Camera</button>
  <button class="btn btn-primary hidden" id="lv-capture-btn">Capture</button>
  <div class="row hidden" id="lv-confirm-row">
    <button class="btn btn-secondary" id="lv-retake-btn">Retake</button>
    <button class="btn btn-primary" id="lv-use-btn">Use This Photo</button>
  </div>
  <div class="status" id="lv-status"></div>

<script>
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var video   = document.getElementById('lv-video');
  var canvas  = document.getElementById('lv-canvas');
  var preview = document.getElementById('lv-preview');
  var startBtn   = document.getElementById('lv-start-btn');
  var captureBtn = document.getElementById('lv-capture-btn');
  var confirmRow = document.getElementById('lv-confirm-row');
  var retakeBtn  = document.getElementById('lv-retake-btn');
  var useBtn     = document.getElementById('lv-use-btn');
  var status     = document.getElementById('lv-status');
  var stream = null, dataUrl = null;

  function setStatus(msg, cls) {
    status.textContent = msg || '';
    status.className = 'status' + (cls ? ' ' + cls : '');
  }

  // getUserMedia on an insecure origin (http://, and not literally "localhost") throws
  // SYNCHRONOUSLY because navigator.mediaDevices itself is undefined there — that throw
  // happens before any promise exists, so a plain .then()/.catch() never runs and the UI
  // was silently stuck on "Requesting…" forever with no error shown. This wraps the call
  // so that failure mode (and a hung permission prompt, some in-app browsers just never
  // resolve or reject) both surface as a real, visible error instead of a silent freeze.
  function requestCamera(constraints, onResult) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onResult(null, 'insecure-context');
      return;
    }
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      onResult(null, 'timeout');
    }, 12000);
    navigator.mediaDevices.getUserMedia(constraints).then(function (s) {
      clearTimeout(timer);
      if (settled) { s.getTracks().forEach(function (t) { t.stop(); }); return; } // arrived after we'd already given up — release it
      settled = true;
      onResult(s, null);
    }).catch(function (err) {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      onResult(null, (err && err.name) || 'error');
    });
  }

  function cameraErrorMessage(reason) {
    if (reason === 'insecure-context') return 'Camera access needs a secure link (https://) or "localhost" — the link you used may not qualify. Ask for a fresh QR code.';
    if (reason === 'timeout') return 'The camera permission prompt took too long to respond. Try again, or check your browser\\'s site settings.';
    if (reason === 'NotAllowedError') return "Camera access was denied — check your browser's permission settings for this site.";
    if (reason === 'NotFoundError') return 'No camera was found on this device.';
    return "Couldn't access the camera — check your browser's permission settings.";
  }

  startBtn.addEventListener('click', function () {
    startBtn.disabled = true;
    setStatus('Requesting camera access…');
    requestCamera({ video: { facingMode: 'user' }, audio: false }, function (s, reason) {
      if (!s) {
        startBtn.disabled = false;
        setStatus(cameraErrorMessage(reason), 'err');
        return;
      }
      stream = s;
      video.srcObject = s;
      startBtn.classList.add('hidden');
      captureBtn.classList.remove('hidden');
      setStatus('');
    });
  });

  captureBtn.addEventListener('click', function () {
    // See the matching comment in season-signup.js's Group 00 — native-resolution phone
    // camera captures occasionally exceeded the server's upload size limit, which failed
    // silently as a generic "Network error" instead of a clear message. Cap the longest
    // side; this is a casual reference photo, not something needing full resolution.
    var LV_MAX_DIM = 900;
    var lvScale = Math.min(1, LV_MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * lvScale);
    canvas.height = Math.round(video.videoHeight * lvScale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    video.classList.add('hidden');
    captureBtn.classList.add('hidden');
    confirmRow.classList.remove('hidden');
  });

  retakeBtn.addEventListener('click', function () {
    dataUrl = null;
    preview.classList.add('hidden');
    video.classList.remove('hidden');
    confirmRow.classList.add('hidden');
    captureBtn.classList.remove('hidden');
  });

  useBtn.addEventListener('click', function () {
    if (!dataUrl) return;
    useBtn.disabled = true; retakeBtn.disabled = true;
    setStatus('Sending…');
    fetch('/season-signup/liveness/' + encodeURIComponent(TOKEN) + '/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: dataUrl }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { setStatus(res.d.error || 'Could not send photo.', 'err'); useBtn.disabled = false; retakeBtn.disabled = false; return; }
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        confirmRow.classList.add('hidden');
        setStatus('Sent! You can close this tab and go back to your other device.', 'ok');
      })
      .catch(function () {
        setStatus('Network error — try again.', 'err');
        useBtn.disabled = false; retakeBtn.disabled = false;
      });
  });
})();
</script>
</body></html>`;
}
