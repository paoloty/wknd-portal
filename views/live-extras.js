// Live game extras (lib/live-extras.js liveExtras): one markup for the site's live game page and
// the app's live game screen (each styles .lx with its own tokens: public/styles.css, public/app.css).
// x: liveExtras result. l: lib/live-score.js liveScoreData (team names and colours, the score).
// Win odds, momentum, who's hot + watch for, team pace, picks. Swapped in with the live body.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dot = c => `<span class="lx-dot" style="--c:${esc(c)}"></span>`;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const initials = name => String(name || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const signed = v => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

// 1. Win odds: the number and its change since tip-off, the split bar, and the line over the game.
function oddsCard(x, l) {
  const o = x.odds; if (!o) return '';
  const lead = o.a >= o.b ? 'a' : 'b', other = lead === 'a' ? 'b' : 'a';
  const start = lead === 'a' ? o.start : 100 - o.start, change = o[lead] - start;
  const W = 320, H = 96, top = 8, bot = 84, left = 24, right = 314;
  const end = Math.max(o.total, o.line[o.line.length - 1].at || 1);
  const px = at => left + (at / end) * (right - left), py = v => top + ((100 - v) / 100) * (bot - top);
  const d = o.line.map((p, i) => `${i ? 'L' : 'M'}${px(p.at).toFixed(1)} ${py(p.a).toFixed(1)}`).join(' ');
  const lastP = o.line[o.line.length - 1];
  const qs = Array.from({ length: o.periods }, (_, i) => px(i * o.pm));
  const svg = `<svg class="lx-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(l.a.name)}'s win odds through the game: ${o.start}% at tip-off, ${o.a}% now">
    ${[25, 75].map(v => `<line x1="${left}" x2="${right}" y1="${py(v)}" y2="${py(v)}" class="lx-grid"/>`).join('')}
    <line x1="${left}" x2="${right}" y1="${py(50)}" y2="${py(50)}" class="lx-mid"/>
    ${qs.slice(1).map(x1 => `<line x1="${x1}" x2="${x1}" y1="${top}" y2="${bot}" class="lx-grid"/>`).join('')}
    <text x="0" y="${py(75) + 4}" class="lx-ax">75%</text><text x="0" y="${py(25) + 4}" class="lx-ax">25%</text>
    <path d="${d} L${px(lastP.at).toFixed(1)} ${bot} L${left} ${bot} Z" class="lx-area" style="--c:${esc(l.a.color)}"/>
    <path d="${d}" class="lx-line" style="--c:${esc(l.a.color)}"/>
    <circle cx="${px(lastP.at).toFixed(1)}" cy="${py(lastP.a).toFixed(1)}" r="4.5" class="lx-now"/>
  </svg>`;
  return `<section class="lx-card lx-odds" aria-label="Win odds">
    <div class="lx-kick"><span>Win odds</span><span>${x.ended ? 'final' : `was ${start}% at tip-off`}</span></div>
    <div class="lx-odds__row"><span class="lx-odds__l">${dot(l[lead].color)}<b class="lx-big num">${o[lead]}%</b><span class="lx-name">${esc(l[lead].name)}</span>${change ? `<span class="lx-trend ${change > 0 ? 'up' : 'dn'} num">${change > 0 ? '↑' : '↓'} ${Math.abs(change)}</span>` : ''}</span><span class="lx-mut">${esc(l[other].name)} ${o[other]}%</span></div>
    <div class="lx-bar2" aria-hidden="true"><i style="width:${o.a}%;--c:${esc(l.a.color)}"></i><i style="width:${o.b}%;--c:${esc(l.b.color)}"></i></div>
    ${svg}
    <div class="lx-legend"><span>Tip-off</span>${Array.from({ length: o.periods - 1 }, (_, i) => `<span>Q${i + 2}</span>`).join('')}<span>End</span></div>
    <p class="lx-note">Starts from the Who wins? odds and moves with the lead and the time left. ${esc(l.a.name)}’s chances on the line.</p>
  </section>`;
}

// 2. Momentum: the run, four numbers, and points by 2-minute stretch.
function momentumCard(x, l) {
  const m = x.momentum; if (!m) return '';
  const r = m.run;
  const runHtml = r ? `<div class="lx-run">${dot(l[r.team].color)}<b class="lx-big num">${r.pts}–0</b><span><b>${esc(l[r.team].name)} run</b><small>${r.secs != null ? `over the last ${mmss(r.secs)}` : 'right now'}${r.top ? `, led by ${esc(r.top.name)} (${r.top.pts})` : ''}</small></span></div>` : '';
  const big = m.biggest.a >= m.biggest.b ? 'a' : 'b';
  const facts = [
    [m.leadChanges, `lead change${m.leadChanges === 1 ? '' : 's'}`],
    [m.ties, m.ties === 1 ? 'tie' : 'ties'],
    [m.biggest[big], `${l[big].name}’s biggest lead`],
    m.led ? [`${m.led[m.led.a >= m.led.b ? 'a' : 'b']}%`, `of the game ${l[m.led.a >= m.led.b ? 'a' : 'b'].name} led (about)`] : [m.biggest[big === 'a' ? 'b' : 'a'], `${l[big === 'a' ? 'b' : 'a'].name}’s biggest lead`],
  ];
  const s = m.stretch;
  const maxS = s ? Math.max(4, ...s.a, ...s.b) : 1;
  const strip = s ? `<div class="lx-strip" aria-hidden="true">${s.a.map(v => `<i style="height:${Math.max(4, (v / maxS) * 100)}%;--c:${esc(l.a.color)}${v ? '' : ';opacity:.25'}"></i>`).join('')}</div>
      <div class="lx-strip lx-strip--b" aria-hidden="true">${s.b.map(v => `<i style="height:${Math.max(4, (v / maxS) * 100)}%;--c:${esc(l.b.color)}${v ? '' : ';opacity:.25'}"></i>`).join('')}</div>
      <p class="lx-note">Points every 2 minutes: ${esc(l.a.name)} up, ${esc(l.b.name)} down.</p>` : '';
  return `<section class="lx-card lx-mom" aria-label="Momentum">
    <div class="lx-kick"><span>Momentum</span><span>${m.led ? 'time from the scorer’s clock' : 'so far'}</span></div>
    ${runHtml}
    <div class="lx-facts">${facts.map(([v, t]) => `<div class="lx-fact"><b class="num">${esc(v)}</b><span>${esc(t)}</span></div>`).join('')}</div>
    ${strip}
  </section>`;
}

// 3. Who's hot (tonight against their season average) and Watch for.
function hotCard(x, l) {
  if (!x.hot.length && !x.watch.length) return '';
  const hot = x.hot.map(p => `<div class="lx-hot__r"><span class="lx-av" style="--c:${esc(l[p.team].color)}">${esc(initials(p.name))}</span><span class="lx-hot__n"><b>${esc(p.name)}</b><small>${esc(l[p.team].name)}${p.note ? ` · ${esc(p.note)}` : ''}</small></span><span class="lx-hot__v"><b class="num">${p.pts}</b>${p.vs ? `<span class="lx-d ${p.vs > 0 ? 'up' : 'dn'} num">${signed(p.vs)}</span>` : ''}</span></div>`).join('');
  const watch = x.watch.map(w => `<div class="lx-watch__r">${dot(l[w.team].color)}<span>${esc(w.text)}</span><span class="lx-meter" aria-hidden="true"><i style="width:${Math.min(100, w.pct)}%"></i></span></div>`).join('');
  return `<section class="lx-card lx-hot" aria-label="Who's hot">
    ${hot ? `<div class="lx-kick"><span>Who’s hot</span><span>points vs their season average</span></div><div class="lx-hot__list">${hot}</div>` : ''}
    ${watch ? `<div class="lx-kick${hot ? ' lx-kick--gap' : ''}"><span>Watch for</span><span>close to it now</span></div><div class="lx-watch">${watch}</div>` : ''}
  </section>`;
}

// 4. Team pace: on pace for, against each team's usual this season.
function paceCard(x, l) {
  if (!x.pace) return '';
  const chip = (v, u, lowGood) => (u == null ? '' : (() => { const d = Math.round(v - u); const good = lowGood ? d < 0 : d > 0; return d ? `<span class="lx-d ${good ? 'up' : 'dn'} num">${signed(d)}</span>` : ''; })());
  return `<section class="lx-card lx-pace" aria-label="Team pace">
    <div class="lx-kick"><span>On pace for</span><span>vs their usual this season</span></div>
    <div class="lx-pace__h"><span>${dot(l.a.color)}${esc(l.a.name)}</span><span></span><span>${esc(l.b.name)}${dot(l.b.color)}</span></div>
    ${x.pace.map(r => `<div class="lx-pace__r"><span><b class="num">${r.a}</b>${chip(r.a, r.ua, r.lowGood)}</span><span class="lx-pace__l">${esc(r.label)}</span><span>${chip(r.b, r.ub, r.lowGood)}<b class="num">${r.b}</b></span></div>`).join('')}
  </section>`;
}

// 5. Picks: if it ended now, who'd be right; the viewer's own pick.
function picksCard(x, l) {
  const p = x.picks; if (!p) return '';
  const na = p.a.length, nb = p.b.length;
  const head = !p.lead ? `<b class="num">${p.total}</b> picked. It’s tied, so nobody’s sweating yet.` : (() => { const behind = p.lead === 'a' ? nb : na; const pct = Math.round((behind / p.total) * 100); return `<span class="lx-amber num">${pct}%</span> of pickers are sweating`; })();
  const faces = (list, side) => list.length ? `<div class="lx-faces"><span class="lx-faces__stack">${list.slice(0, 5).map(q => `<i style="--c:${esc(l[side].color)}">${esc(initials(q.name))}</i>`).join('')}</span><span><b class="num">${list.length}</b> ${p.lead ? (p.lead === side ? 'would be right' : `need ${esc(l[side].name)} to come back`) : `picked ${esc(l[side].name)}`}</span></div>` : '';
  const diff = Math.abs(l.score.a - l.score.b);
  const mine = p.mine ? `<div class="lx-you">You picked <b>${esc(l[p.mine].name)}</b>: ${!p.lead ? 'all square' : p.lead === p.mine ? `up ${diff}` : `down ${diff}`}.</div>` : '';
  return `<section class="lx-card lx-picks" aria-label="Who wins? picks">
    <div class="lx-kick"><span>Who wins?</span><span>${p.total} picked</span></div>
    <p class="lx-pk">${head}</p>
    <div class="lx-split"><span class="lx-split__a" style="flex:${Math.max(na, 0.0001)};--c:${esc(l.a.color)}">${dot(l.a.color)}${na}</span><span class="lx-split__b" style="flex:${Math.max(nb, 0.0001)};--c:${esc(l.b.color)}">${nb}${dot(l.b.color)}</span></div>
    ${faces(p.a, 'a')}${faces(p.b, 'b')}
    ${mine}
  </section>`;
}

export function liveExtrasHtml(x, l) {
  if (!x) return '';
  const cards = [oddsCard(x, l), momentumCard(x, l), hotCard(x, l), paceCard(x, l), picksCard(x, l)].filter(Boolean);
  return cards.length ? `<div class="lx" id="live-extras">${cards.join('')}</div>` : '';
}
