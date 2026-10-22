// Colour matching for a set of photos (the POTG video's 6), run at render time so they look
// like one set: different cameras, phones and spots in the gym otherwise give one photo a
// yellow cast, another a blue one, one dark and one blown out.
//
// Per photo, measured on a small copy:
//   • levels: its darkest 1% / brightest 1% are stretched (gently, capped) to a common black and
//     white point, so flat photos gain punch and harsh ones calm down;
//   • colour: the cast of its midtones is matched to the set's common cast (itself nudged a bit
//     toward neutral), so a yellow or blue odd one out comes in line but the gym light stays;
//   • exposure: a gamma curve brings its average brightness to the set's common target.
// Then the WKND grade (a touch more contrast, saturation and warmth) goes on top of every photo.
import sharp from 'sharp';

const BLACK = 0.03, WHITE = 0.96;

async function measure(file) {
  const { data, info } = await sharp(file).resize(160, 160, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, lum = new Float64Array(n);
  let sr = 0, sg = 0, sb = 0, m = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; lum[i] = y;
    if (y > 0.15 && y < 0.85) { sr += r; sg += g; sb += b; m++; }
  }
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const q = p => sorted[Math.min(n - 1, Math.floor(p * n))];
  m = m || 1;
  return { lo: q(0.01), hi: q(0.99), mid: { r: sr / m, g: sg / m, b: sb / m } };
}

// Levels + colour cast, as an affine per channel: out = in * a_c + b_c (0..1 units). The cast is
// matched to the set's median cast (not forced to neutral), so the odd photo out comes in line
// while the gym's own light stays.
function correction(st, cast) {
  let a = (WHITE - BLACK) / Math.max(0.05, st.hi - st.lo);
  a = Math.min(1.5, Math.max(0.85, a));                 // don't over-stretch
  const b = BLACK - st.lo * a;
  const { r, g, b: bl } = st.mid;
  const k = (want, have) => Math.min(1.4, Math.max(0.7, want / (have || want)));
  return { a: [a * k(cast.rg, r / g), a, a * k(cast.bg, bl / g)], b: [b, b, b] };
}

async function meanAfter(file, corr) {
  const { data } = await sharp(file).resize(160, 160, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0; const n = data.length / 3;
  for (let i = 0; i < n; i++) {
    const r = Math.min(1, Math.max(0, data[i * 3] / 255 * corr.a[0] + corr.b[0]));
    const g = Math.min(1, Math.max(0, data[i * 3 + 1] / 255 * corr.a[1] + corr.b[1]));
    const b = Math.min(1, Math.max(0, data[i * 3 + 2] / 255 * corr.a[2] + corr.b[2]));
    s += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return s / n;
}

// inputs: photo paths; outputs: where to write the matched versions (same order).
// grade: false for photos that were already graded (jobs from before render-time matching).
export async function matchPhotos(inputs, outputs, { grade = true } = {}) {
  const stats = await Promise.all(inputs.map(measure));
  const med = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  // the set's common cast, nudged a little toward neutral so a whole set shot under yellow light
  // still gets slightly cleaner
  const cast = { rg: 0.8 * med(stats.map(s => s.mid.r / s.mid.g)) + 0.2, bg: 0.8 * med(stats.map(s => s.mid.b / s.mid.g)) + 0.2 };
  const corrs = stats.map(st => correction(st, cast));
  const means = await Promise.all(inputs.map((f, i) => meanAfter(f, corrs[i])));
  // common brightness: the set's median, kept in a sensible range for a dark gym look
  const target = Math.min(0.46, Math.max(0.32, med(means)));
  for (let i = 0; i < inputs.length; i++) {
    const c = corrs[i];
    const gamma = Math.min(1.45, Math.max(0.7, Math.log(target) / Math.log(Math.min(0.95, Math.max(0.05, means[i])))));
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
    const { data, info } = await sharp(inputs[i]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let p = 0; p < data.length; p += 3) {
      for (let ch = 0; ch < 3; ch++) {
        const x = Math.min(255, Math.max(0, Math.round((data[p + ch] / 255 * c.a[ch] + c.b[ch]) * 255)));
        data[p + ch] = lut[x];
      }
    }
    let img = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
    if (grade) img = img.linear(1.1, -10).modulate({ saturation: 1.12, brightness: 0.99 }).recomb([[1.04, 0, 0], [0, 1.0, 0], [0, 0, 0.94]]);
    await img.jpeg({ quality: 92, mozjpeg: true }).toFile(outputs[i]);
  }
  return outputs;
}
