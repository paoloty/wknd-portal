// A finished game's full recap on the game screen (/app/games/:id), the app's side of the
// site's game page: line score, game leaders + the pre-game watch list, team stats against
// their usual, game flow + key plays, the full box score, Who called it? and the series.
// Data: server.js appGameRecap() (the site's own helpers) plus the box score rows.
// Rows that scroll sideways: the section bar, game leaders, key plays and the box score.
// Script (public/app.js initGameRecap): data-gr-jump, data-gr-more, data-gr-team, data-gr-sort.
import { esc, appAvatar } from './layout.js';
import { pickOption } from './picks.js';

const signed = d => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(1)}`;
const dot = c => `<span class="dot" style="--c:${esc(c)}"></span>`;
const ini = name => String(name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const shortDay = ymd => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const arrow = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const head = (title, hint = '') => `<div class="gr-head"><span class="kick">${title}</span>${hint ? `<span class="gr-hint">${hint}</span>` : ''}</div>`;
const swipe = `Swipe${arrow}`;
const sideOf = (teams, name) => (String(teams[1]?.name).toUpperCase() === String(name).toUpperCase() ? teams[1] : teams[0]);

// Quarter by quarter under the score; each side's better quarters stand out.
export function lineScore(a, b, quarters = []) {
  if (!quarters.length) return '';
  const ql = q => (q <= 4 ? `Q${q}` : quarters.length > 5 ? `OT${q - 4}` : 'OT');
  const row = (t, side) => `<div class="gr-ls__r"><span class="gr-ls__t">${dot(t.color)}${esc(t.name)}</span>${quarters.map(q => {
    const mine = q[side], theirs = q[side === 'a' ? 'b' : 'a'];
    return `<span${mine > theirs ? ' class="is-w"' : ''}>${mine}</span>`;
  }).join('')}<b${t.won ? '' : ' class="is-l"'}>${t.score}</b></div>`;
  return `<div class="gr-ls" style="--q:${quarters.length}" role="table" aria-label="Score by quarter">
    <div class="gr-ls__r gr-ls__h"><span></span>${quarters.map(q => `<span>${ql(q.quarter)}</span>`).join('')}<b>T</b></div>${row(a, 'a')}${row(b, 'b')}</div>`;
}

// The section bar: sticks under the navbar, one chip per section on the screen. Also on the
// upcoming / live game screen (views/app/feed.js appGamePreviewPage). public/app.js
// initGameRecap scrolls to a section on tap and lights the chip of the one in view.
export function jumpBar(items) {
  return `<nav class="gr-jump" aria-label="Sections">${items.map(([id, label, n]) =>
    `<button type="button" data-gr-jump="${id}">${label}${n ? ` <small>${n}</small>` : ''}</button>`).join('')}</nav>`;
}

// Each team's leader in six stats, side by side, then the preview's watch list.
const CATS = [['Points', 'pts'], ['Rebounds', 'reb'], ['Assists', 'ast'], ['Threes', 'tpm'], ['Steals', 'stl'], ['Blocks', 'blk']];
function leadersCard(teams, watch) {
  const top = (t, k) => t.rows.reduce((best, r) => (r[k] > best[k] ? r : best), t.rows[0]);
  const cards = CATS.map(([label, k]) => {
    const [x, y] = teams.map(t => top(t, k));
    if (!x[k] && !y[k]) return '';
    const row = (r, t, other) => (r[k]
      ? `<div class="gr-ld__r">${appAvatar({ playerId: r.playerId, initials: ini(r.name), ring: t.color, photoUrl: r.photo })}<span class="gr-ld__n">${esc(r.name)}</span><b${r[k] >= other[k] ? ' class="is-hi"' : ''}>${r[k]}</b></div>`
      : `<div class="gr-ld__r">${appAvatar({ ring: t.color })}<span class="gr-ld__n mut">Nobody</span><b>0</b></div>`);
    return `<div class="gr-ld"><span class="kick">${label}</span>${row(x, teams[0], y)}${row(y, teams[1], x)}</div>`;
  }).join('');
  const wl = watch.length ? `<div class="gr-wl">${head('Watch list', 'From the preview')}${watch.map(w => {
    const d = w.pts == null ? null : Math.round((w.pts - w.ppg) * 10) / 10;
    return `<div class="gr-wl__r">${appAvatar({ playerId: w.playerId, initials: w.initials, ring: w.ring, photoUrl: w.photoUrl })}
      <div class="gr-wl__b"><b>${esc(w.name)}</b><small>${w.ppg.toFixed(1)} a game vs ${esc(w.opp)} before this</small></div>
      ${w.pts == null ? '<span class="gr-wl__v"><small>Didn’t play</small></span>'
        : `<span class="gr-wl__v"><b class="num">${w.pts}</b><em class="gr-u${d > 0 ? ' up' : d < 0 ? ' dn' : ''}">${signed(d)}</em></span>`}</div>`;
  }).join('')}</div>` : '';
  return `<section class="fc gr" id="gr-leaders">${head('Game leaders', swipe)}<div class="gr-hs">${cards}</div>${wl}</section>`;
}

// The recap, cut to a few lines until opened, with the pre-game storyline folded under it.
function recapCard(recap, story) {
  const has = recap && (recap.title || recap.paras.length);
  if (!has && !story) return '';
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const tip = story ? `<details class="gr-tip"${has ? '' : ' open'}><summary><span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Before tip-off</span><svg class="gr-tip__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
      ${story.headline ? `<p class="gr-tip__h">${md(story.headline)}</p>` : ''}${story.body ? `<p>${md(story.body)}</p>` : ''}<small>The preview as it stood when picks closed.</small></details>` : '';
  return `<section class="fc art gr" id="gr-recap">
    <div class="kick">Recap</div>
    ${has ? `${recap.title ? `<h2>${esc(recap.title)}</h2>` : ''}
    <div class="gr-clamp" id="gr-recap-body">${recap.paras.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <button type="button" class="gr-more" data-gr-more="gr-recap-body" aria-expanded="false" aria-controls="gr-recap-body" hidden>Read the full recap</button>` : ''}
    ${tip}
  </section>`;
}

// How it was won (lib/game-detail.js howItWasWon), then the two teams side by side; with
// earlier meetings (usual), each number gets a +/− against that team's usual.
function teamStatsCard(teams, totals, won, usual) {
  const [A, B] = totals;
  const pc = (m, a) => (a ? +(m / a * 100).toFixed(1) : null);
  const by = Object.fromEntries((usual?.rows || []).map(r => [r.key, r]));
  // [usual key, label, A, B, lower is better, A made/att, B made/att]
  const rows = [
    ['pts', 'Points', A.pts, B.pts],
    ['fg', 'Field goals', pc(A.fgm, A.fga), pc(B.fgm, B.fga), false, `${A.fgm}/${A.fga}`, `${B.fgm}/${B.fga}`],
    ['t3m', 'Threes made', A.fg3m, B.fg3m],
    ['t3p', 'Three-point %', pc(A.fg3m, A.fg3a), pc(B.fg3m, B.fg3a), false, `${A.fg3m}/${A.fg3a}`, `${B.fg3m}/${B.fg3a}`],
    ...(A.fg4m + B.fg4m ? [['', 'Fours made', A.fg4m, B.fg4m]] : []),
    ['ft', 'Free throws', pc(A.ftm, A.fta), pc(B.ftm, B.fta), false, `${A.ftm}/${A.fta}`, `${B.ftm}/${B.fta}`],
    ['reb', 'Rebounds', A.reb, B.reb], ['ast', 'Assists', A.ast, B.ast], ['stl', 'Steals', A.stl, B.stl], ['blk', 'Blocks', A.blk, B.blk],
    ['to', 'Turnovers', A.to, B.to, true],
  ].filter(r => r[2] != null && r[3] != null);
  const vs = (v, uv, low) => {
    if (uv == null) return '<span></span>';
    const d = Math.round((v - uv) * 10) / 10;
    return `<span class="gr-u${d === 0 ? '' : (low ? d < 0 : d > 0) ? ' up' : ' dn'}">${d === 0 ? 'Usual' : signed(d)}</span>`;
  };
  const row = ([key, label, a, b, low, sa = '', sb = '']) => {
    const aw = low ? a < b : a > b, bw = low ? b < a : b > a;
    const share = a + b ? Math.round(a / (a + b) * 100) : 50;
    const f = v => (sa ? `${v}%` : v);
    const u = by[key];
    return `<div class="gr-cmp__row">
      <div class="gr-cmp__top"><span class="gr-cmp__v${aw ? ' is-w' : ''}">${f(a)}${sa ? `<small>${sa}</small>` : ''}</span><span class="gr-cmp__l">${label}</span><span class="gr-cmp__v gr-cmp__v--r${bw ? ' is-w' : ''}">${sb ? `<small>${sb}</small>` : ''}${f(b)}</span></div>
      ${u ? `<div class="gr-cmp__u">${vs(a, u.a, low)}${vs(b, u.b, low)}</div>` : ''}
      <div class="gr-cmp__bar"><span class="${aw ? 'is-w' : ''}" style="width:${share}%"></span><span class="${bw ? 'is-w' : ''}"></span></div>
    </div>`;
  };
  const how = won.length ? `${head('How it was won')}<div class="gr-how">${won.map(w => `<div class="gr-how__r"><b class="num">+${w.n}</b><div><span>${dot(sideOf(teams, w.team).color)}${esc(w.label)}</span><small>${esc(w.team)} · ${esc(w.detail)}</small></div></div>`).join('')}</div>` : '';
  return `<section class="fc gr" id="gr-stats">${how}
    ${head('Team stats')}
    ${usual ? `<p class="gr-note">Green and red: this game against each team's usual in their ${usual.n === 1 ? 'one earlier meeting' : `${usual.n} earlier meetings`}.</p>` : ''}
    <div class="gr-cmp__h"><span>${dot(teams[0].color)}${esc(teams[0].name)}</span><span>${esc(teams[1].name)}${dot(teams[1].color)}</span></div>
    ${rows.map(row).join('')}
  </section>`;
}

// Game flow: the lead through the game (winner's lead up), four numbers, then key plays.
// Runs of baskets the scorer logged with one stale clock (all at 0:00, say) are spread
// evenly back to the basket before them, so they draw as plays, not one wall.
function flowCard(flow, plays, teams) {
  if (!flow) return '';
  const pts = flow.points.map(p => ({ ...p }));
  for (let i = 0; i < pts.length;) {
    let j = i; while (j + 1 < pts.length && pts[j + 1].t === pts[i].t) j++;
    if (j > i) { const from = i ? pts[i - 1].t : 0, span = pts[i].t - from; for (let k = i; k <= j; k++) pts[k].t = from + span * (k - i + 1) / (j - i + 1); }
    i = j + 1;
  }
  const win = teams[1].won ? 'b' : 'a', lose = win === 'a' ? 'b' : 'a';
  const W = teams[win === 'a' ? 0 : 1], L = teams[win === 'a' ? 1 : 0];
  const lead = p => (win === 'a' ? p.a - p.b : p.b - p.a);
  const hi = Math.max(6, ...pts.map(lead)), lo = Math.min(-6, ...pts.map(lead));
  const w = 326, top = 16, bot = 134;
  const X = t => (4 + t / flow.total * (w - 8)).toFixed(1);
  const Y = v => (top + (hi - v) / (hi - lo) * (bot - top)).toFixed(1);
  let line = `M${X(0)} ${Y(0)}`;
  for (const p of pts) line += `H${X(p.t)}V${Y(lead(p))}`;
  line += `H${X(flow.total)}`;
  const qs = []; for (let q = 1, t = 0; t < flow.total - 0.01; q++) { qs.push({ q, from: t, to: t + flow.len(q) }); t += flow.len(q); }
  const ql = q => (q <= 4 ? `Q${q}` : `OT${q - 4}`);
  const peak = flow.maxLead[win];
  const peakAt = peak ? pts[flow.points.indexOf(peak.p)] : null;
  const big = [flow.maxLead.a, flow.maxLead.b].filter(Boolean).sort((x, y) => y.n - x.n)[0];
  const run = [flow.bestA, flow.bestB].filter(Boolean).sort((x, y) => y.n - x.n)[0];
  const chart = `<svg class="gr-flow" viewBox="0 0 ${w} 152" role="img" aria-label="${esc(`The lead through the game. ${W.name} led by as many as ${peak?.n || 0}${flow.maxLead[lose] ? `; ${L.name} by as many as ${flow.maxLead[lose].n}` : ''}.`)}">
    ${qs.slice(1).map(s => `<line class="gr-flow__q" x1="${X(s.from)}" x2="${X(s.from)}" y1="6" y2="${bot + 4}"/>`).join('')}
    <path class="gr-flow__area" d="${line}V${Y(0)}Z"/>
    <line class="gr-flow__zero" x1="0" x2="${w}" y1="${Y(0)}" y2="${Y(0)}"/>
    <path class="gr-flow__line" d="${line}"/>
    ${peakAt ? `<circle class="gr-flow__dot" cx="${X(peakAt.t)}" cy="${Y(peak.n)}" r="4"/><text class="gr-flow__peak" x="${Math.min(+X(peakAt.t) + 8, w - 26)}" y="${+Y(peak.n) + 4}">+${peak.n}</text>` : ''}
    <text class="gr-flow__lbl" x="4" y="11">${esc(W.name)} ahead</text>
    <text class="gr-flow__lbl" x="4" y="${bot + 2}">${esc(L.name)} ahead</text>
    ${qs.map(s => `<text class="gr-flow__ql" x="${X((s.from + s.to) / 2)}" y="150" text-anchor="middle">${ql(s.q)}</text>`).join('')}
  </svg>`;
  const tiles = `<div class="gr-tiles">
    <div><b class="num">${flow.leadChanges}</b><span>Lead changes</span></div>
    <div><b class="num">${flow.ties}</b><span>Ties</span></div>
    <div><b class="num">${big ? big.n : 0}</b><span>Biggest lead</span></div>
    <div><b class="num">${run ? `${run.n}–0` : '–'}</b><span>Best run</span></div>
  </div>`;
  const when = p => (p.qLabel === 'FINAL' ? 'Final' : [p.qLabel, p.clock && p.clock !== '0:00' ? p.clock : ''].filter(Boolean).join(' · '));
  const kp = plays.length ? `${head('Key plays', swipe)}<div class="gr-hs">${plays.map(p => `<div class="gr-kp">
      <div class="gr-kp__top"><span>${esc(when(p))}</span><b class="num">${p.score.a}–${p.score.b}</b></div>
      <p>${dot(teams[p.side === 'b' ? 1 : 0].color)}<b>${esc(p.strong)}</b> ${esc(p.rest)}</p></div>`).join('')}</div>` : '';
  return `<section class="fc gr" id="gr-flow">${head('Game flow', 'Lead by play')}${chart}${tiles}${kp}</section>`;
}

// The full box score: one team at a time, swipes sideways, names stay put, tap a column to sort.
export function boxCard(teams, meId, myTeamId, dnp) {
  const made = (m, a) => (a ? `${m}-${a}` : '–');
  const cols = [
    ['PTS', r => r.pts], ['REB', r => r.reb], ['AST', r => r.ast], ['STL', r => r.stl], ['BLK', r => r.blk],
    ['TO', r => r.to, true], ['PF', r => r.pf, true],
    ['FG', r => r.fgm, false, r => made(r.fgm, r.fga), 'fgm', 'fga'],
    ['3PT', r => r.tpm, false, r => made(r.tpm, r.tpa), 'tpm', 'tpa'],
    teams.some(t => t.rows.some(r => r.qpa)) ? ['4PT', r => r.qpm, false, r => made(r.qpm, r.qpa), 'qpm', 'qpa'] : null,
    ['FT', r => r.ftm, false, r => made(r.ftm, r.fta), 'ftm', 'fta'],
  ].filter(Boolean);
  const on = Math.max(0, teams.findIndex(t => t.id === myTeamId));
  const panel = (t, i) => {
    const rows = [...t.rows].sort((x, y) => y.pts - x.pts);
    const max = cols.map(c => Math.max(...rows.map(c[1])));
    const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const tot = Object.fromEntries(['pts', 'reb', 'ast', 'stl', 'blk', 'to', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'qpm', 'qpa', 'ftm', 'fta'].map(k => [k, sum(k)]));
    const out = dnp.filter(p => String(p.team).toUpperCase() === String(t.name).toUpperCase()).map(p => p.name);
    return `<div class="gr-bx" data-gr-panel="${i}"${i === on ? '' : ' hidden'}>
      <div class="gr-bx__scroll"><table class="gr-tb" data-gr-table>
        <thead><tr><th scope="col">Player</th>${cols.map((c, j) => `<th scope="col"><button type="button" data-gr-sort="${j}"${c[2] ? ' data-low' : ''}${j ? '' : ' class="is-on"'} aria-label="Sort by ${c[0]}">${c[0]}</button></th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr${r.playerId === meId ? ' class="is-me"' : ''}><th scope="row"><span class="gr-tb__no">${esc(r.number)}</span><span class="gr-tb__nm">${esc(r.name)}</span>${r.playerId === meId ? '<small>you</small>' : ''}</th>${cols.map((c, j) => {
          const v = c[1](r);
          return `<td data-v="${v}" class="${[!c[2] && v > 0 && v === max[j] ? 'is-hi' : '', j ? '' : 'is-on'].filter(Boolean).join(' ')}">${c[3] ? c[3](r) : v}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
        <tfoot>
          <tr><th scope="row">Team</th>${cols.map(c => `<td>${c[3] ? made(tot[c[4]], tot[c[5]]) : c[1](tot)}</td>`).join('')}</tr>
          <tr class="gr-tb__pct"><th scope="row">Shooting</th>${cols.map(c => `<td>${c[4] && tot[c[5]] ? `${Math.round(tot[c[4]] / tot[c[5]] * 100)}%` : ''}</td>`).join('')}</tr>
        </tfoot>
      </table></div>
      ${out.length ? `<p class="gr-note gr-note--foot">Didn’t play: ${esc(out.join(', '))}</p>` : ''}
    </div>`;
  };
  return `<section class="fc gr" id="gr-box">${head('Box score', `Swipe for shooting${arrow}`)}
    ${teams.length > 1 ? `<div class="gr-seg" role="group" aria-label="Team">${teams.map((t, i) => `<button type="button" data-gr-team="${i}" aria-pressed="${i === on}">${dot(t.color)}${esc(t.name)} ${t.score}</button>`).join('')}</div>` : ''}
    ${teams.map(panel).join('')}
    <p class="gr-note gr-note--foot">Tap a column to sort.</p>
  </section>`;
}

// Who called it?: the pickers' split as the Picks tab's own bars (closed), the odds, and who
// got it right. called: server.js pickResultOf().
function calledCard(c, teams) {
  if (!c || !c.total) return '';
  const g = { a: { name: teams[0].name, color: teams[0].color }, b: { name: teams[1].name, color: teams[1].color }, counts: c.counts, myPick: c.myPick, closed: true, odds: c.odds };
  const winSide = c.winner === 'b' ? 'b' : 'a'; // lib/picks.js: 'a' | 'b'
  const right = c.faces.filter(f => f.right);
  const names = right.filter(f => !f.me).slice(0, 3).map(f => f.name);
  const meRight = right.some(f => f.me);
  const who = right.length ? [meRight ? 'You' : '', ...names].filter(Boolean) : [];
  const more = right.length - who.length;
  const odds = c.odds ? `The odds had ${esc(c.odds.fav === 'b' ? teams[1].name : teams[0].name)} at ${Math.max(c.odds.pctA, c.odds.pctB)}%${c.odds.margin ? `, by about ${Math.round(c.odds.margin)}` : ''}.` : '';
  const mine = c.myPick ? `<p class="gr-note">You picked ${esc(c.myPick === 'b' ? teams[1].name : teams[0].name)}: ${c.myPick === winSide ? 'right' : 'wrong'}.</p>` : '';
  return `<section class="fc gr" id="gr-picks">
    <div class="gr-head"><span class="kick">Who called it?</span>${c.upset ? '<span class="sx__chip sx__chip--amber">Upset</span>' : ''}</div>
    <p class="gr-big"><b class="num">${c.called} of ${c.total}</b> picked ${esc(teams[winSide === 'b' ? 1 : 0].name)}</p>
    <div class="pick__opts">${pickOption(g, 'a')}${pickOption(g, 'b')}</div>
    ${odds ? `<p class="gr-note gr-note--foot">${odds}</p>` : ''}${mine}
    ${right.length ? `<div class="pick__who gr-who"><span class="pick__stack">${right.slice(0, 5).map(f => `<span style="--c:${esc(f.color)}"${f.me ? ' class="is-me"' : ''}>${esc(f.ini)}</span>`).join('')}</span><span>${esc(who.join(', '))}${more > 0 ? ` and ${more} more` : ''} called it.</span></div>` : '<p class="gr-note gr-note--foot">Nobody called it.</p>'}
    <a class="btn btn--ghost gr-btn" href="/app/picks">See all picks</a>
  </section>`;
}

// The series: every meeting as a dot in the winner's colour (this one ringed), the all-time
// and season record, then the last three meetings before this one.
function seriesCard(s, teams) {
  if (!s) return '';
  const wins = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), 0]));
  const season = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), 0]));
  for (const r of s.results) {
    const k = String(r.winner).toUpperCase(); wins[k] = (wins[k] || 0) + 1;
    if (String(r.season) === String(s.season)) season[k] = (season[k] || 0) + 1;
  }
  const [x, y] = teams.map(t => wins[String(t.name).toUpperCase()]);
  const lead = x === y ? `Tied ${x}–${y} all-time` : `${esc((x > y ? teams[0] : teams[1]).name)} leads ${Math.max(x, y)}–${Math.min(x, y)} all-time`;
  const [sx, sy] = teams.map(t => season[String(t.name).toUpperCase()]);
  const color = name => sideOf(teams, name).color;
  return `<section class="fc gr" id="gr-series">
    ${head('The series', sx + sy > 1 ? `Season ${esc(s.season)}: ${sx}–${sy}` : '')}
    <div class="gr-sr"><span class="gr-sr__dots" role="img" aria-label="${esc(`Every meeting in order: ${s.results.map(r => r.winner).join(', ')}`)}">${s.results.map(r => `<span class="dot${r.id === s.thisId ? ' is-now' : ''}" style="--c:${esc(color(r.winner))}"></span>`).join('')}</span><span><b>${lead}</b></span></div>
    ${s.meetings.map(m => {
      const aw = m.sa > m.sb;
      const [wn, ws, ln, ls] = aw ? [m.a, m.sa, m.b, m.sb] : [m.b, m.sb, m.a, m.sa];
      return `<a class="gr-sr__r" href="/app/games/${encodeURIComponent(m.id)}">
        <span class="gr-sr__d">${shortDay(m.ymd)}<small>S${esc(m.season)}</small></span>
        <span class="gr-sr__b"><span class="gr-sr__s">${dot(color(wn))}${esc(wn)} <b class="num">${ws}</b><i>–</i><b class="num l">${ls}</b><span class="l">${esc(ln)}</span></span>
        ${m.potg ? `<small>Player of the game ${esc(m.potg.name)} · ${m.potg.pts} pts${m.potg.reb >= 10 ? `, ${m.potg.reb} reb` : ''}</small>` : ''}</span></a>`;
    }).join('')}
  </section>`;
}

// Everything under the hero, in screen order. g: appGamePage's input (teams, full, recap…).
export function gameRecapSections(g, { potgHtml = '', commentsHtml = '', commentCount = 0, emptyRecap = '' } = {}) {
  const f = g.full;
  const two = g.teams.length === 2;
  const parts = [
    ['gr-leaders', 'Leaders', two ? leadersCard(g.teams, f.watch) : ''],
    ['', '', potgHtml],
    ['gr-recap', 'Recap', recapCard(g.recap, f.story) || emptyRecap],
    ['gr-stats', 'Team stats', two ? teamStatsCard(g.teams, f.totals, f.won, f.usual) : ''],
    ['gr-flow', 'Game flow', two ? flowCard(f.flow, f.plays, g.teams) : ''],
    ['gr-box', 'Box score', g.teams.length ? boxCard(g.teams, g.meId, g.myTeamId, f.dnp) : ''],
    ['gr-picks', 'Picks', two ? calledCard(f.called, g.teams) : ''],
    ['gr-series', 'Series', two ? seriesCard(f.series, g.teams) : ''],
    ['comments', 'Comments', commentsHtml, commentCount],
  ].filter(p => p[2]);
  const chips = parts.filter(p => p[0]).map(([id, label, , n]) => [id, label, n]);
  return `${chips.length > 2 ? jumpBar(chips) : ''}${parts.map(p => p[2]).join('')}`;
}
