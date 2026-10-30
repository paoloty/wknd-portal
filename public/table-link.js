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

// ── Codes: an offer or answer, as text for a QR code ──
// WK2 (2026-10-30, Paolo: a tablet's front camera couldn't read the long code): only what the two
// devices need to find each other: the ICE name and password, the security fingerprint, the
// DTLS role and the hotspot addresses (IPv4, UDP). About 100 characters instead of 545, a small
// QR any camera reads. The other side rebuilds a standard data-channel description from it.
// WK1 (the whole description, deflated) stays as the fallback when there's no plain IPv4 address.
const bytesOf = stream => new Response(stream).arrayBuffer().then(b => new Uint8Array(b));
const b64u = bytes => { let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { let b64 = s.replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '='; const bin = atob(b64), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
const SETUPS = ['actpass', 'active', 'passive'];
function packShort(sdp) {
  const line = k => { const m = new RegExp('^a=' + k + ':(.*)$', 'm').exec(sdp); return m ? m[1].trim() : ''; };
  const ufrag = line('ice-ufrag'), pwd = line('ice-pwd'), fp = /^sha-256 ([0-9A-Fa-f:]{95})$/.exec(line('fingerprint')), setup = SETUPS.indexOf(line('setup')), mid = line('mid');
  const cands = [...sdp.matchAll(/^a=candidate:\S+ 1 udp \d+ (\d{1,3}(?:\.\d{1,3}){3}) (\d+) typ host/gim)].map(m => ({ ip: m[1].split('.').map(Number), port: Number(m[2]) }))
    .filter(c => c.ip.every(n => n <= 255) && c.port > 0 && c.port < 65536).slice(0, 4);
  if (!ufrag || !pwd || ufrag.length > 64 || pwd.length > 64 || !fp || setup < 0 || mid !== '0' || !cands.length) return null;
  const enc = new TextEncoder(), u = enc.encode(ufrag), p = enc.encode(pwd);
  const out = [1, setup, u.length, ...u, p.length, ...p, ...fp[1].split(':').map(h => parseInt(h, 16)), cands.length];
  for (const c of cands) out.push(...c.ip, c.port >> 8, c.port & 255);
  return b64u(Uint8Array.from(out));
}
function unpackShort(s) {
  const b = unb64u(s), dec = new TextDecoder();
  let i = 0; const take = n => { const x = b.slice(i, i + n); i += n; if (x.length !== n) throw new Error('short code'); return x; };
  if (take(1)[0] !== 1) throw new Error('unknown code');
  const setup = SETUPS[take(1)[0]];
  const ufrag = dec.decode(take(take(1)[0])), pwd = dec.decode(take(take(1)[0]));
  const fp = [...take(32)].map(n => n.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const n = take(1)[0], cands = [];
  for (let k = 0; k < n; k++) { const ip = [...take(4)].join('.'), pb = take(2); cands.push(`a=candidate:${k + 1} 1 udp ${2122260223 - k} ${ip} ${(pb[0] << 8) | pb[1]} typ host generation 0`); }
  return ['v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', ...cands,
    `a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`, 'a=ice-options:trickle', `a=fingerprint:sha-256 ${fp}`, `a=setup:${setup}`,
    'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', ''].join('\r\n');
}
export function pack(kind, sdp) {
  try { const s = packShort(sdp); if (s) return Promise.resolve('WK2' + kind + s); } catch (e) { /* the long code below */ }
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
  const short = /^WK2([OA])([A-Za-z0-9_-]+)$/.exec(String(text).trim());
  if (short) { try { return Promise.resolve({ kind: short[1], sdp: unpackShort(short[2]) }); } catch (e) { return Promise.resolve(null); } }
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
  const q = window.qrcode(0, text.length < 200 ? 'M' : 'L'); q.addData(text, 'Byte'); q.make();
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
      read.then(text => { busy = false; if (text && on && /^WK[12]/.test(text)) { on = false; onText(text); } });
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
