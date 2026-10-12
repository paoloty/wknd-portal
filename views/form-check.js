import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// ── Form check: one line chart, both teams, every stat ─────────────────────────────────
// The "Who wins?" pick cards (pick-box.js openPickCard, /games Up next) all render this, so a
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
