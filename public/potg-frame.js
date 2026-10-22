// POTG video photo framing: ONE copy of the maths, used by both the editor preview
// (public/admin-potg-video.js, served at /potg-frame.js) and the video renderer's template
// (assets/media/potg/template.html loads it by relative path), so the editor shows exactly
// what renders.
//
// A photo is placed in the 1080x1350 frame by:
//   fx, fy  focal point (0..1 of the image) that sits at the target point (centre, 40% down,
//           above the stat block)
//   zoom    1 = just covers the frame; more = tighter
//   rot     straighten angle in degrees (-30..30), clockwise positive
//   extra   the push-in multiplier during playback (1 → 1.10); the editor shows the end (1.10)
// Rotating auto-zooms just enough that no corner ever shows, and the position is clamped so
// the frame stays inside the (rotated) photo.
(function (root) {
  'use strict';
  var FW = 1080, FH = 1350, TX = FW / 2, TY = FH * 0.40, KB = 1.10, MAX_ROT = 30;
  function place(iw, ih, fx, fy, zoom, extra, rot) {
    rot = Math.max(-MAX_ROT, Math.min(MAX_ROT, +rot || 0));
    var th = rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), ac = Math.abs(cs), as = Math.abs(sn);
    var bw = FW * ac + FH * as, bh = FW * as + FH * ac;          // frame's bounding box in photo space
    var s = Math.max(bw / iw, bh / ih) * Math.max(1, zoom || 1) * (extra || 1), w = iw * s, h = ih * s;
    var dx = FW / 2 - TX, dy = FH / 2 - TY;                       // target → frame centre
    var ox = cs * dx + sn * dy, oy = -sn * dx + cs * dy;          // same, in photo space
    var cx = fx * w + ox, cy = fy * h + oy;                       // photo point under the frame centre
    cx = Math.min(w - bw / 2, Math.max(bw / 2, cx));
    cy = Math.min(h - bh / 2, Math.max(bh / 2, cy));
    return {
      s: s, w: w, h: h, rot: rot,
      fx: (cx - ox) / w, fy: (cy - oy) / h,                        // focal after clamping
      transform: 'translate(' + (FW / 2) + 'px,' + (FH / 2) + 'px) rotate(' + rot + 'deg) translate(' + (-cx) + 'px,' + (-cy) + 'px) scale(' + s + ')',
    };
  }
  // A screen drag of (dX, dY) frame pixels → the focal point change that keeps the photo under the finger.
  function dragDelta(f, dX, dY) {
    var th = f.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    return { dfx: -(cs * dX + sn * dY) / f.w, dfy: -(-sn * dX + cs * dY) / f.h };
  }
  root.potgFrame = { place: place, dragDelta: dragDelta, FW: FW, FH: FH, KB: KB, MAX_ROT: MAX_ROT };
})(typeof window !== 'undefined' ? window : globalThis);
