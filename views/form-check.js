import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// ── Form check: one line chart, both teams, every stat ─────────────────────────────────
// The "Who wins?" pick cards (pick-card.js, /picks 'full' variant) render this, so a
// change here lands everywhere. Dashed lines = each team's usual against the other (the
// matchup's head-to-head rows; first meeting: this season); solid = their last 5 games with
// box scores, any opponent (server.js buildMatchup m.form).
// Every value is shown against the pair's usual average on a log axis (½× … 4×), so FG% and
// blocks share one scale; turnovers plot as usual ÷ value, so higher always means better.
// Amber dashed columns: the usual leader of a stat is behind on recent form ("Watch").

const STATS = [
  ['fg', 'FG%', 'shooting'], ['t3m', '3PM', 'threes'], ['t3p', '3P%', '3PT%'], ['ft', 'FT%', 'free throws'],
  ['reb', 'REB', 'rebounds'], ['ast', 'AST', 'assists'], ['stl', 'STL', 'steals'], ['blk', 'BLK', 'blocks'],
  ['to', 'TO', 'turnovers'],
];
const LOW = new Set(['to']);
const tcase = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();

// The chart's data from a matchup (server.js buildMatchup / matchupAsOf, or a frozen copy).
// null when there's too little to draw: no form on old frozen previews, under 2 recent box
// scores for a side, or fewer than 5 stats with both a usual and a recent number.
export function formCheckOf(m) {
  if (!m?.form || !m.rows?.length || (m.form.nA ?? 0) < 2 || (m.form.nB ?? 0) < 2) return null;
  const usual = Object.fromEntries(m.rows.map(r => [r.key, r]));
  const rows = STATS
    .map(([key, short, word]) => ({ key, short, word, low: LOW.has(key), ua: usual[key]?.a, ub: usual[key]?.b, a: m.form.a?.[key], b: m.form.b?.[key] }))
    .filter(r => [r.ua, r.ub, r.a, r.b].every(v => v != null && v > 0));
  if (rows.length < 5) return null;
  return { a: m.a, b: m.b, firstMeeting: !!m.firstMeeting, rows };
}

const W = 380, H = 150, L = 8, R = 8, T = 8, B = 22;
const lg = Math.log2, Y_MIN = lg(0.5), Y_MAX = lg(4);
const r1 = n => Math.round(n * 10) / 10;

export function formCheck(fc) {
  if (!fc) return '';
  const leader = (r, a, b) => (a === b ? null : (r.low ? a < b : a > b) ? 'a' : 'b');
  const n = fc.rows.length, colW = (W - L - R) / n;
  const x = i => r1(L + (i + 0.5) * colW);
  const y = v => r1(T + (1 - (Math.max(Y_MIN, Math.min(Y_MAX, lg(v))) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - T - B));
  const pts = fc.rows.map(r => {
    const base = (r.ua + r.ub) / 2, rel = v => (r.low ? base / v : v / base);
    const u = leader(r, r.ua, r.ub), now = leader(r, r.a, r.b);
    return { ...r, ra: rel(r.a), rb: rel(r.b), rua: rel(r.ua), rub: rel(r.ub), watch: !!(u && now && u !== now) };
  });
  const hot = side => pts.filter(p => (p.low ? p[side] < p['u' + side] : p[side] > p['u' + side])).length;
  const ha = hot('a'), hb = hot('b');
  const A = escHtml(tcase(fc.a)), Bn = escHtml(tcase(fc.b));
  const head = ha === hb
    ? `Both teams come in close to their usual: better in ${ha} of ${n} lately.`
    : `${ha > hb ? A : Bn} comes in hotter: better than usual in ${Math.max(ha, hb)} of ${n} lately. ${ha > hb ? Bn : A} in ${Math.min(ha, hb)}.`;
  const words = pts.filter(p => p.watch).map(p => p.word);
  const watch = words.length > 1 ? [words.slice(0, -1).join(', '), words[words.length - 1]] : words;
  const path = k => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join('');
  const dotFill = side => teamColor(side === 'a' ? fc.a : fc.b);
  return `<div class="fck">
      <div class="fck__k"><span>Form check</span><span>last 5 vs ${fc.firstMeeting ? 'their season' : 'their usual'}</span></div>
      <p class="fck__head">${head}</p>
      <p class="fck__watch">${watch.length
        ? `<b>Watch:</b> ${escHtml(watch.join(' and '))}. Recent form points the other way.`
        : 'No flips brewing: recent form backs the usual leader in every stat.'}</p>
      <svg class="fck__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${A} and ${Bn}: last 5 games against their usual, ${n} stats">
        ${pts.map((p, i) => (p.watch ? `<rect class="fck__watchcol" x="${r1(x(i) - colW / 2 + 1.5)}" y="${T}" width="${r1(colW - 3)}" height="${H - T - B}" rx="5"/>` : '')).join('')}
        ${pts.slice(1).map((_, i) => `<line class="fck__div" x1="${r1(L + (i + 1) * colW)}" x2="${r1(L + (i + 1) * colW)}" y1="${T}" y2="${H - B + 4}"/>`).join('')}
        <line class="fck__mid" x1="${L}" x2="${W - R}" y1="${y(1)}" y2="${y(1)}"/>
        <path class="fck__line fck__line--a fck__line--usual" d="${path('rua')}"/>
        <path class="fck__line fck__line--b fck__line--usual" d="${path('rub')}"/>
        <path class="fck__line fck__line--a" d="${path('ra')}"/>
        <path class="fck__line fck__line--b" d="${path('rb')}"/>
        ${pts.map((p, i) => `<circle class="fck__pt" cx="${x(i)}" cy="${y(p.ra)}" r="3.5" stroke="${dotFill('a')}"><title>${A} ${escHtml(p.word)}: ${r1(p.a)} last 5 · usual ${r1(p.ua)}</title></circle>
        <circle class="fck__pt" cx="${x(i)}" cy="${y(p.rb)}" r="3.5" stroke="${dotFill('b')}"><title>${Bn} ${escHtml(p.word)}: ${r1(p.b)} last 5 · usual ${r1(p.ub)}</title></circle>
        <text class="fck__x${p.watch ? ' is-watch' : ''}" x="${x(i)}" y="${H - 6}" text-anchor="middle">${p.short}</text>`).join('')}
      </svg>
      <div class="fck__key"><span><i class="fck__sw fck__sw--usual"></i>Their usual</span><span><i class="fck__sw"></i>Last 5 games</span><span>Higher = better, even turnovers</span></div>
    </div>`;
}

// ── Full chart: the game page's Team stats (recap) and Head to head (preview) ───────────
// Same axis and maths as the pick cards' Form check, with words for casual readers: a
// headline, three tiles, the biggest moves labelled on the chart, takeaways and tap-for-
// numbers. Two states share the dashed "usual" lines:
//   pre — before tip-off: solid = each team's last 5 games going in (m.form)
//   fin — final: solid = this game
// The recap renders both with a toggle (Final first); the preview only has 'pre'.

// Data for the full chart. m: the as-of-tip-off matchup (usual = m.rows, last 5 = m.form);
// finals: { [key]: { a, b } } this game's numbers (recap only). null when neither state has
// enough to draw (5+ stats with a usual and that state's numbers).
export function formChartOf(m, finals = null) {
  if (!m?.rows?.length) return null;
  const usual = Object.fromEntries(m.rows.map(r => [r.key, r]));
  const hasPre = !!m.form && (m.form.nA ?? 0) >= 2 && (m.form.nB ?? 0) >= 2;
  const ok = v => v != null && v > 0;
  const rows = STATS
    .map(([key, short, word]) => ({
      key, short, word, low: LOW.has(key), ua: usual[key]?.a, ub: usual[key]?.b,
      pre: hasPre && ok(m.form.a?.[key]) && ok(m.form.b?.[key]) ? { a: m.form.a[key], b: m.form.b[key] } : null,
      fin: finals?.[key] && ok(finals[key].a) && ok(finals[key].b) ? { a: finals[key].a, b: finals[key].b } : null,
    }))
    .filter(r => ok(r.ua) && ok(r.ub));
  const modes = ['fin', 'pre'].filter(k => rows.filter(r => r[k]).length >= 5);
  if (!modes.length) return null;
  return { a: m.a, b: m.b, firstMeeting: !!m.firstMeeting, rows, modes };
}

const MODE = {
  pre: {
    label: 'Before tip-off', now: 'last 5', nowLong: 'Last 5 games', flipWord: 'Could flip',
    head: (A, B, ha, hb, n) => {
      const feel = k => (k >= Math.ceil(n * 2 / 3) ? 'hotter than usual' : k <= Math.floor(n / 3) ? 'colder than usual' : 'about normal');
      return `${A} comes in ${feel(ha)}. ${B} comes in ${feel(hb)}.`;
    },
    tiles: ['Form says hold', 'Recent form backs the usual leader', 'Hottest lately', 'Next hottest'],
    takes: w => (w ? `<b class="fcx__amber">Watch:</b> ${w}. These usually go one way, but recent form points the other.` : 'Recent form backs the usual leader in every stat.'),
    flipKey: 'Recent form says the usual leader could lose it',
  },
  fin: {
    label: 'Final', now: 'this game', nowLong: 'This game', flipWord: 'Flipped',
    head: (A, B, ha, hb, n) => (ha === hb
      ? `Both teams played better than usual in ${ha} of ${n} stats.`
      : `${ha > hb ? A : B} played better than usual in ${Math.max(ha, hb)} of ${n} stats. ${ha > hb ? B : A} did in ${Math.min(ha, hb)}.`),
    tiles: ['Went to form', 'The team that usually leads led again', 'Biggest swing', 'Next biggest swing'],
    takes: w => (w ? `<b class="fcx__amber">Flipped:</b> ${w}. The team that usually wins these lost them.` : 'Every stat went the usual way.'),
    flipKey: 'Usual leader lost it',
  },
};
const TICK = { 0.5: 'Half', 1: 'Usual', 2: 'Double', 4: '4×' };
const fmtV = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const andList = w => (w.length > 1 ? `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}` : w.join(''));

function chartState(fc, mode) {
  const M = MODE[mode];
  const leader = (r, a, b) => (a === b ? null : (r.low ? a < b : a > b) ? 'a' : 'b');
  const pts = fc.rows.filter(r => r[mode]).map(r => {
    const base = (r.ua + r.ub) / 2, rel = v => (r.low ? base / v : v / base);
    const { a, b } = r[mode];
    const u = leader(r, r.ua, r.ub), now = leader(r, a, b);
    return { ...r, a, b, ra: rel(a), rb: rel(b), rua: rel(r.ua), rub: rel(r.ub), both: !!(u && now), flip: !!(u && now && u !== now) };
  });
  const better = (p, side) => (p.low ? p[side] < p['u' + side] : p[side] > p['u' + side]);
  // The biggest moves from a team's own usual (relative). Usuals under 5 (blocks) are left
  // out: 1.5 to 3 doubles and means little. One per stat, so labels never stack.
  const moves = pts.flatMap((p, i) => ['a', 'b'].map(side => ({ i, side, p, v: p[side], u: p['u' + side], lift: lg(p['r' + side] / p['ru' + side]) })))
    .filter(mv => mv.u >= 5 && mv.v !== mv.u)
    .sort((x, y) => Math.abs(y.lift) - Math.abs(x.lift))
    .filter((mv, k, all) => all.findIndex(o => o.i === mv.i) === k)
    .slice(0, 3);
  return { M, pts, moves, ha: pts.filter(p => better(p, 'a')).length, hb: pts.filter(p => better(p, 'b')).length };
}

// The chart. It stretches in width only, so text, dots and lines keep the same pixel size on
// every screen: the axis labels are HTML; in the SVG, x positions are percentages of the plot
// width and y positions are pixels (fixed height); the lines sit in a nested SVG stretched to
// the plot (preserveAspectRatio none) with non-scaling strokes. On phones the plot keeps a
// minimum width and scrolls sideways (.fcx__plot) instead of squeezing the stats together.
const CH = 330, CT = 16, CB = 34, PATH_W = 1000;
const ASSUMED_PLOT_PX = 640; // for label collisions only; wider screens just get more room

function chartSvg(fc, st) {
  const { pts, moves } = st;
  const n = pts.length;
  const pct = i => r1(((i + 0.5) / n) * 1000) / 10; // column centre, % of the plot width
  const y = v => r1(CT + (1 - (Math.max(Y_MIN, Math.min(Y_MAX, lg(v))) - Y_MIN) / (Y_MAX - Y_MIN)) * (CH - CT - CB));
  const path = k => pts.map((p, i) => `${i ? 'L' : 'M'}${r1((pct(i) / 100) * PATH_W)},${y(p[k])}`).join('');
  const col = side => teamColor(side === 'a' ? fc.a : fc.b);
  const colPct = 100 / n;
  const pt = (i, v, side, now) => (now
    ? `<circle class="fcx__pt" cx="${pct(i)}%" cy="${y(v)}" r="5" fill="${col(side)}"/>`
    : `<circle class="fcx__upt fcx__upt--${side}" cx="${pct(i)}%" cy="${y(v)}" r="3"/>`);
  // Move labels: above a rise, below a drop. Each label's box (rough text width) is checked
  // against the ones already placed and the two zone captions; on a clash it steps further
  // from its point, or flips to the other side, so labels never overlap.
  const PW = ASSUMED_PLOT_PX;
  const placed = [
    { x0: 0, x1: 170, y0: CT, y1: CT + 14 }, // ▲ Better than usual
    { x0: 0, x1: 170, y0: CH - CB - 20, y1: CH - CB - 4 }, // ▼ Worse than usual
  ];
  const callout = mv => {
    const text = `${fmtV(mv.v)} (usual ${mv.u.toFixed(1)})`;
    const w = text.length * 6.6, cx = (pct(mv.i) / 100) * PW, cy = y(mv.p['r' + mv.side]);
    const anchor = mv.i === 0 ? 'start' : mv.i === n - 1 ? 'end' : 'middle';
    const x0 = anchor === 'start' ? cx - 6 : anchor === 'end' ? cx - w + 6 : cx - w / 2;
    const clash = ty => placed.some(b => x0 < b.x1 && x0 + w > b.x0 && ty - 11 < b.y1 && ty + 3 > b.y0);
    const tries = [];
    for (const dir of mv.lift > 0 ? [-1, 1] : [1, -1]) {
      for (let k = 0; k < 4; k++) tries.push(dir < 0 ? cy - 12 - k * 15 : cy + 21 + k * 15);
    }
    const ty = tries.find(t => t - 11 >= CT && t + 3 <= CH - CB && !clash(t));
    if (ty == null) return '';
    placed.push({ x0, x1: x0 + w, y0: ty - 11, y1: ty + 3 });
    return `<text class="fcx__call" x="${pct(mv.i)}%" y="${r1(ty)}" text-anchor="${anchor}"${anchor === 'start' ? ' dx="-6"' : anchor === 'end' ? ' dx="6"' : ''}>${text}</text>`;
  };
  return `<div class="fcx__chart">
      <div class="fcx__axis" aria-hidden="true">${[4, 2, 1, 0.5].map(t => `<span class="${t === 1 ? 'is-mid' : ''}" style="top:${y(t)}px">${TICK[t]}</span>`).join('')}</div>
      <svg class="fcx__svg" height="${CH}" role="img" aria-label="${escHtml(tcase(fc.a))} and ${escHtml(tcase(fc.b))}: ${st.M.now} against their usual, ${n} stats">
      ${pts.map((p, i) => (p.flip ? `<rect class="fcx__flipcol" x="${r1(i * colPct + 0.4)}%" y="${CT}" width="${r1(colPct - 0.8)}%" height="${CH - CT - CB}" rx="6"/>` : '')).join('')}
      ${[0.5, 1, 2, 4].map(t => `<line class="fcx__grid${t === 1 ? ' is-mid' : ''}" x1="0" x2="100%" y1="${y(t)}" y2="${y(t)}"/>`).join('')}
      ${pts.slice(1).map((_, i) => `<line class="fck__div" x1="${r1((i + 1) * colPct)}%" x2="${r1((i + 1) * colPct)}%" y1="${CT}" y2="${CH - CB + 6}"/>`).join('')}
      <text class="fcx__zone" x="6" y="${CT + 10}">▲ Better than usual</text><text class="fcx__zone" x="6" y="${CH - CB - 8}">▼ Worse than usual</text>
      <svg class="fcx__lines" x="0" y="0" width="100%" height="${CH}" viewBox="0 0 ${PATH_W} ${CH}" preserveAspectRatio="none" aria-hidden="true">
        <path class="fck__line fck__line--a fck__line--usual" d="${path('rua')}"/>
        <path class="fck__line fck__line--b fck__line--usual" d="${path('rub')}"/>
        <path class="fck__line fck__line--a fcx__now" d="${path('ra')}"/>
        <path class="fck__line fck__line--b fcx__now" d="${path('rb')}"/>
      </svg>
      ${pts.map((p, i) => `${pt(i, p.rua, 'a')}${pt(i, p.rub, 'b')}${pt(i, p.ra, 'a', true)}${pt(i, p.rb, 'b', true)}
        <text class="fcx__x${p.flip ? ' is-flip' : ''}" x="${pct(i)}%" y="${CH - 10}" text-anchor="middle">${p.short}</text>`).join('')}
      ${moves.map(callout).join('')}
      ${pts.map((p, i) => `<rect class="fcx__hit" data-fcx-col="${i}" data-x="${(pct(i) / 100).toFixed(3)}" x="${r1(i * colPct)}%" y="0" width="${r1(colPct)}%" height="${CH}" tabindex="0" role="button" aria-label="${escHtml(p.word)}: the real numbers"/>`).join('')}
    </svg>
    </div>`;
}

function chartPanel(fc, mode, hidden) {
  const st = chartState(fc, mode);
  const { M, pts, moves } = st;
  const A = escHtml(tcase(fc.a)), B = escHtml(tcase(fc.b));
  const both = pts.filter(p => p.both).length, held = both - pts.filter(p => p.flip).length;
  const dotOf = side => `<span class="team-dot" style="background:${teamColor(side === 'a' ? fc.a : fc.b)};width:9px;height:9px"></span>`;
  const tile = (kick, big, who, detail) => `<div class="gd-won__t"><span class="gd-kick">${kick}</span><div class="gd-won__v">${big}${who}</div><div class="gd-won__d">${detail}</div></div>`;
  const swing = (mv, kick) => {
    const d = Math.round((mv.v - mv.u) * 10) / 10;
    return tile(kick, `<b class="font-condensed${mv.lift > 0 ? '' : ' is-down'}">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</b>`,
      `<span>${dotOf(mv.side)}${escHtml(String(mv.side === 'a' ? fc.a : fc.b).toUpperCase())} ${escHtml(mv.p.word.toUpperCase())}</span>`,
      `${fmtV(mv.v)} ${M.now} · usual ${mv.u.toFixed(1)}`);
  };
  const tiles = [
    both ? tile(M.tiles[0], `<b class="font-condensed">${held}<small> / ${both}</small></b>`, '', M.tiles[1]) : '',
    moves[0] ? swing(moves[0], M.tiles[2]) : '', moves[1] ? swing(moves[1], M.tiles[3]) : '',
  ].filter(Boolean);
  const flips = andList(pts.filter(p => p.flip).map(p => escHtml(p.word)));
  const tip = (p, i) => `<div class="fcx__tip" data-fcx-tip="${i}" hidden><b>${escHtml(p.word)}${p.flip ? ` · <span class="fcx__amber">${M.flipWord}</span>` : ''}</b>
      <span>${dotOf('a')}<span class="font-condensed">${fmtV(p.a)}</span><small>${M.now} · usual ${p.ua.toFixed(1)}</small></span>
      <span>${dotOf('b')}<span class="font-condensed">${fmtV(p.b)}</span><small>${M.now} · usual ${p.ub.toFixed(1)}</small></span></div>`;
  return `<div class="fcx__panel" data-fcx-mode="${mode}"${hidden ? ' hidden' : ''}>
      <p class="fcx__head">${M.head(A, B, st.ha, st.hb, pts.length)}</p>
      ${tiles.length ? `<div class="gd-won gd-form">${tiles.join('')}</div>` : ''}
      <div class="card fcx__card">
        <div class="fcx__how"><span><i class="fck__sw fck__sw--usual"></i>Dashed = their usual</span><span><i class="fck__sw"></i>Solid = ${M.now}</span><span>Higher = better, even turnovers. Solid above dashed = better than usual.</span></div>
        <div class="fcx__plot"><div class="fcx__canvas">${chartSvg(fc, st)}${pts.map(tip).join('')}</div></div>
        <p class="fcx__swipe">Swipe the chart to see every stat →</p>
        <ul class="fcx__takes"><li>${M.takes(flips)}</li><li>Tap a stat for the real numbers.</li></ul>
        <div class="fcx__key"><span><i class="fck__sw fck__sw--usual"></i>Their usual${fc.firstMeeting ? ' (this season)' : ''}</span><span><i class="fck__sw"></i>${M.nowLong}</span><span><i class="fcx__sw-flip"></i>${M.flipKey}</span></div>
      </div>
    </div>`;
}

export function formChart(fc) {
  if (!fc) return '';
  const two = fc.modes.length > 1;
  return `<div class="fcx" data-fcx>
    ${two ? `<span class="gd-seg fcx__seg" role="group" aria-label="Chart state">${fc.modes.map((k, i) => `<button type="button" class="${i ? '' : 'is-on'}" aria-pressed="${!i}" data-fcx-btn="${k}"><span class="pill-label">${MODE[k].label}</span></button>`).join('')}</span>` : ''}
    ${fc.modes.map((k, i) => chartPanel(fc, k, i > 0)).join('')}
  </div>
  ${formChartScript()}`;
}

// Toggle + tap-for-numbers. Safe to include more than once.
function formChartScript() {
  return `<script>
(function () {
  if (window.__wkndFcx) return;
  window.__wkndFcx = true;
  function hideTips(panel) {
    if (!panel) return;
    panel.querySelectorAll('[data-fcx-tip]').forEach(function (t) { t.hidden = true; });
    panel.querySelectorAll('.fcx__hit.is-on').forEach(function (r) { r.classList.remove('is-on'); });
  }
  function show(hit) {
    var panel = hit.closest('.fcx__panel'), canvas = hit.closest('.fcx__canvas');
    var tip = panel.querySelector('[data-fcx-tip="' + hit.dataset.fcxCol + '"]');
    if (!tip || !tip.hidden) return;
    hideTips(panel);
    panel.querySelectorAll('[data-fcx-col="' + hit.dataset.fcxCol + '"]').forEach(function (r) { r.classList.add('is-on'); });
    tip.hidden = false;
    // data-x is the column centre as a share of the plot SVG, which sits right of the axis.
    var c = canvas.getBoundingClientRect(), s = hit.ownerSVGElement.getBoundingClientRect();
    var w = c.width, half = tip.offsetWidth / 2, at = s.left - c.left + Number(hit.dataset.x) * s.width;
    tip.style.left = Math.max(half, Math.min(w - half, at)) + 'px';
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fcx-btn]');
    if (btn) {
      var root = btn.closest('[data-fcx]');
      root.querySelectorAll('[data-fcx-btn]').forEach(function (b) { var on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      root.querySelectorAll('[data-fcx-mode]').forEach(function (p) { p.hidden = p.dataset.fcxMode !== btn.dataset.fcxBtn; });
      return;
    }
    var hit = e.target.closest('.fcx__hit');
    if (hit) return show(hit);
    if (!e.target.closest('.fcx__tip')) document.querySelectorAll('.fcx__panel').forEach(hideTips);
  });
  document.addEventListener('mouseover', function (e) {
    var hit = e.target.closest && e.target.closest('.fcx__hit');
    if (hit && window.matchMedia('(hover: hover)').matches) show(hit);
  });
  document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('fcx__hit')) show(e.target); });
  document.addEventListener('mouseleave', function (e) {
    if (e.target.classList && e.target.classList.contains('fcx__plot')) hideTips(e.target.closest('.fcx__panel'));
  }, true);
})();
</script>`;
}
