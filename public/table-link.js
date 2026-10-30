// The phone ↔ tablet link for the table display (2026-10-30; proven by the link test,
// public/linktest/). A direct WebRTC data channel between the scorer's phone and the table
// tablet over the phone's hotspot: no internet and no server in between. Paired by two QR
// scans: the tablet shows an offer, the phone reads it and shows an answer, the tablet reads
// that. The camera is on while each side gathers its addresses, so the browser gives real
// network addresses instead of hidden ".local" names (what usually stops two devices finding
// each other offline). Used by public/table/table.js (the tablet) and public/scorer.js (the
// phone). The QR maker and reader (qrcode-generator, jsQR) load from /table/vendor/.
export const VENDOR = ['/table/vendor/qrcode.js', '/table/vendor/jsqr.js'];
export function loadVendor() {
  return Promise.all(VENDOR.map(src => new Promise((ok, no) => {
    if (document.querySelector(`script[data-tl="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.setAttribute('data-tl', src);
    s.onload = () => ok(); s.onerror = () => no(new Error('The code reader didn’t load. Open this once with signal first.'));
    document.head.appendChild(s);
  })));
}

// ── Codes: an offer or answer, squeezed, as text for a QR code ──
// WK1 + O (offer) | A (answer) + Z (deflated) | R (raw) + base64url.
const bytesOf = stream => new Response(stream).arrayBuffer().then(b => new Uint8Array(b));
export function pack(kind, sdp) {
  // TCP addresses never carry this link (it's UDP over the hotspot): left out, the code is
  // smaller and scans more easily off a phone screen.
  sdp = sdp.split('\r\n').filter(l => !(/^a=candidate:/.test(l) && / tcp /i.test(l))).join('\r\n');
  const raw = new TextEncoder().encode(sdp);
  const squeeze = window.CompressionStream
    ? bytesOf(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).then(b => ({ b, tag: 'Z' }), () => ({ b: raw, tag: 'R' }))
    : Promise.resolve({ b: raw, tag: 'R' });
  return squeeze.then(r => {
    let bin = ''; for (let i = 0; i < r.b.length; i++) bin += String.fromCharCode(r.b[i]);
    return 'WK1' + kind + r.tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
}
export function unpack(text) {
  const m = /^WK1([OA])([ZR])([A-Za-z0-9_-]+)$/.exec(String(text).trim());
  if (!m) return Promise.resolve(null);
  let b64 = m[3].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
  const bin = atob(b64), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const open = m[2] === 'Z'
    ? (window.DecompressionStream ? bytesOf(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))) : Promise.reject(new Error('This browser can’t read the code')))
    : Promise.resolve(b);
  return open.then(bytes => ({ kind: m[1], sdp: new TextDecoder().decode(bytes) }));
}
// The code as an SVG in box (a quiet edge of 4 squares round it: readers need it).
export function drawQr(box, text) {
  const q = window.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
  box.innerHTML = q.createSvgTag(4, 16);
  box.dataset.code = text; // what the code says (it's on screen anyway), for checks and tests
  const svg = box.querySelector('svg');
  if (svg && !svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);
  if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); }
}

// ── Camera and reading codes ──
// facing: 'environment' (the back camera: the phone pointed at the tablet) or 'user' (the front
// camera: the tablet, with the phone held up to its screen).
export function camera(video, facing = 'environment') {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(s => {
    video.srcObject = s;
    return video.play().catch(() => {}).then(() => s);
  });
}
export function stopCamera(stream, video) {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (video) video.srcObject = null;
}
// Reads codes from the video until one starting WK1 turns up: Android's built-in reader when
// there is one, jsQR otherwise (iPhone). Returns a stop function.
export function scan(video, onText) {
  let on = true, det = null, busy = false;
  if ('BarcodeDetector' in window) { try { det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; } }
  const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
  const tick = () => {
    if (!on) return;
    if (!busy && video.readyState >= 2 && video.videoWidth) {
      busy = true;
      const read = det
        ? det.detect(video).then(r => (r.length ? r[0].rawValue : null), () => { det = null; return null; })
        : Promise.resolve().then(() => {
          const w = Math.min(1080, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
          c.width = w; c.height = h; ctx.drawImage(video, 0, 0, w, h);
          const q = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          return q ? q.data : null;
        });
      read.then(text => { busy = false; if (text && on && /^WK1/.test(text)) { on = false; onText(text); } });
    }
    setTimeout(tick, 120);
  };
  tick();
  return () => { on = false; };
}

// ── The link ──
export const newPeer = () => new RTCPeerConnection({ iceServers: [] }); // the hotspot only
export function gathered(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') fin(); });
    setTimeout(fin, 4000);
  });
}
// The tablet: makes the offer (code to show) and waits for the answer.
export async function tabletOffer() {
  const pc = newPeer();
  const ch = pc.createDataChannel('table', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return { pc, ch, code: await pack('O', pc.localDescription.sdp) };
}
export async function tabletAnswer(pc, text) {
  const d = await unpack(text);
  if (!d || d.kind !== 'A') throw new Error('That isn’t the phone’s code.');
  await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
}
// The phone: reads the tablet's offer, makes the answer (code to show), gets the channel.
export async function phoneAnswer(text, onChannel) {
  const d = await unpack(text);
  if (!d || d.kind !== 'O') throw new Error('That isn’t the tablet’s code.');
  const pc = newPeer();
  pc.ondatachannel = e => onChannel(e.channel);
  await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return { pc, code: await pack('A', pc.localDescription.sdp) };
}
