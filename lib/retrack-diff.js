// Saved game vs re-track, play by play (Paolo, 2026-11-10; Fable audit the same day). The two
// tracks' stat plays are lined up in order like two versions of a document (the longest run of
// plays both have), never by the clock: a court game and a re-track from the video never keep the
// same time. What's left over is grouped into spots, and each spot is named:
//   Wrong player   the same play, credited to someone else
//   Made vs missed the same shot or free throw, a different result
//   Missing        a play only the saved game has
//   Extra          a play only the re-track has
// Plays that are in both but in another order (a rebound tapped before its miss, two free throws
// swapped) change no stat: they're counted apart and hidden, so they never drown the real mistakes.
// Rebounds match on the player only: whether one is offensive comes from the play before it, so
// one missing miss would otherwise turn the next rebound into a second, false difference.
// Pure functions: server.js retrackCompare feeds them folded rows (public/score-engine.js foldGame:
// each row carries type, player, team, pts, made, kind, from, period, clock and the score after it).

export const DIFF_TYPES = new Set(['shot', 'ft', 'reb', 'ast', 'stl', 'blk', 'to', 'foul', 'team_to', 'team_tech']);
export const MAX_PLAYS = 2500;
// Fouls that change something beyond PF (a turnover, an ejection count) keep their kind.
const foulClass = k => (['offensive', 'technical', 'unsportsmanlike', 'disqualifying', 'flagrant'].includes(k) ? k : 'p');
const who = e => e.player || `team:${e.team || ''}`;
export function playKey(e) {
  switch (e.type) {
    case 'shot': return `shot|${who(e)}|${e.team || ''}|${e.pts}|${e.made ? 1 : 0}`;
    case 'ft': return `ft|${who(e)}|${e.team || ''}|${e.made ? 1 : 0}`;
    case 'foul': return `foul|${who(e)}|${foulClass(e.kind)}`;
    case 'stl': return `stl|${who(e)}|${e.from || ''}`;
    default: return `${e.type}|${who(e)}`;
  }
}
// The same play by anyone (Wrong player), and the same attempt with any result (Made vs missed).
const anyoneKey = e => `${e.type}|${e.pts || ''}|${e.made ? 1 : 0}|${e.type === 'foul' ? foulClass(e.kind) : ''}`;
const attemptKey = e => (e.type === 'shot' || e.type === 'ft' ? `${e.type}|${who(e)}|${e.pts || 1}` : null);

const TITLES = { player: 'Wrong player', result: 'Made vs missed', missing: 'Missing in re-track', extra: 'Extra in re-track' };
// What a play adds to a box score line: [label, n].
function statOf(e) {
  switch (e.type) {
    case 'shot': return e.made ? ['PTS', Number(e.pts) || 2] : ['FGA', 1];
    case 'ft': return e.made ? ['PTS', 1] : ['FTA', 1];
    case 'reb': return ['REB', 1];
    case 'ast': return ['AST', 1];
    case 'stl': return ['STL', 1];
    case 'blk': return ['BLK', 1];
    case 'to': return ['TO', 1];
    case 'foul': return ['PF', 1];
    case 'team_to': return ['team TO', 1];
    case 'team_tech': return ['technicals', 1];
    default: return [e.type, 1];
  }
}
const signed = n => (n > 0 ? `+${n}` : `−${-n}`);

// savedRows / reRows: folded rows of each track. over: the re-track is at Game over.
// o.describe(e) → "Name · play"; o.nameOf(e) → the player's (or team's) name.
export function alignTracks(savedRows, reRows, over, { describe = e => e.type, nameOf = e => e.player || e.team || '' } = {}) {
  const allS = savedRows.filter(e => DIFF_TYPES.has(e.type)), allR = reRows.filter(e => DIFF_TYPES.has(e.type));
  const truncated = allS.length > MAX_PLAYS || allR.length > MAX_PLAYS;
  const S = allS.slice(0, MAX_PLAYS), R = allR.slice(0, MAX_PLAYS);
  const n = S.length, m = R.length, W = m + 1, sk = S.map(playKey), rk = R.map(playKey);
  const L = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * W + j] = sk[i] === rk[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  let ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (sk[i] === rk[j]) { ops.push({ t: 'same', s: S[i++], r: R[j++] }); continue; }
    if (L[(i + 1) * W + j] >= L[i * W + j + 1]) ops.push({ t: 'saved', s: S[i++] }); else ops.push({ t: 're', r: R[j++] });
  }
  while (j < m) ops.push({ t: 're', r: R[j++] });
  let pending = n - i;
  if (over) while (i < n) ops.push({ t: 'saved', s: S[i++] });
  else {
    // Still re-tracking: saved plays after the last play both have aren't missing, just not
    // reached yet.
    let lastSame = -1;
    ops.forEach((o, k) => { if (o.t === 'same') lastSame = k; });
    const tail = ops.slice(lastSame + 1);
    pending += tail.filter(o => o.t === 'saved').length;
    ops = [...ops.slice(0, lastSame + 1), ...tail.filter(o => o.t !== 'saved')];
  }

  // Swapped plays: the lining up keeps one of the two, so the other shows on each side a few
  // plays apart. The same play on both sides within 4 places is moved, not a mistake.
  let orderCount = 0;
  const loose = ops.map((o, k) => (o.t === 'saved' || o.t === 're' ? k : -1)).filter(k => k >= 0);
  for (const k of loose) {
    const o = ops[k];
    if (o.t !== 'saved') continue;
    const key = playKey(o.s);
    const mate = loose.find(q => ops[q].t === 're' && Math.abs(q - k) <= 4 && playKey(ops[q].r) === key);
    if (mate === undefined) continue;
    o.t = 'moved'; ops[mate].t = 'moved'; orderCount++;
  }

  // The spots: each run of differences, its plays sorted into named items.
  const hunks = [];
  let sAt = { a: 0, b: 0 }, rAt = { a: 0, b: 0 }, divergeAt = null;
  const text = e => describe(e);
  for (let k = 0; k < ops.length;) {
    if (ops[k].t === 'same') {
      const o = ops[k];
      sAt = o.s.score || sAt; rAt = o.r.score || rAt;
      if (divergeAt === null && (sAt.a !== rAt.a || sAt.b !== rAt.b)) divergeAt = k / Math.max(1, ops.length);
      k++; continue;
    }
    const start = k, run = [];
    while (k < ops.length && ops[k].t !== 'same') run.push(ops[k++]);
    // Moved plays sit in the run but aren't differences.
    const sP = run.filter(o => o.t === 'saved').map(o => o.s), rP = run.filter(o => o.t === 're').map(o => o.r);
    // Plays in both, just in another order: no stat changes.
    const left = new Map();
    rP.forEach(e => { const key = playKey(e); left.set(key, [...(left.get(key) || []), e]); });
    const sRest = [], moved = [];
    for (const e of sP) { const l = left.get(playKey(e)); if (l && l.length) moved.push([e, l.shift()]); else sRest.push(e); }
    let rRest = rP.filter(e => [...left.values()].some(l => l.includes(e)));
    orderCount += moved.length;
    const items = [];
    // Wrong player: the same play by someone else.
    for (const s of [...sRest]) {
      const r = rRest.find(x => anyoneKey(x) === anyoneKey(s) && who(x) !== who(s));
      if (!r) continue;
      sRest.splice(sRest.indexOf(s), 1); rRest = rRest.filter(x => x !== r);
      const [lab, v] = statOf(s);
      items.push({ type: 'player', s, r, effect: `${nameOf(s)} ${lab} ${signed(-v)} · ${nameOf(r)} ${lab} ${signed(v)}` });
    }
    // Made vs missed: the same attempt, another result.
    for (const s of [...sRest]) {
      const key = attemptKey(s);
      const r = key && rRest.find(x => attemptKey(x) === key && !!x.made !== !!s.made);
      if (!r) continue;
      sRest.splice(sRest.indexOf(s), 1); rRest = rRest.filter(x => x !== r);
      const pts = s.type === 'ft' ? 1 : Number(s.pts) || 2;
      items.push({ type: 'result', s, r, effect: `${nameOf(s)} PTS ${signed(r.made ? pts : -pts)}` });
    }
    for (const s of sRest) { const [lab, v] = statOf(s); items.push({ type: 'missing', s, r: null, effect: `${nameOf(s)} ${lab} ${signed(-v)}` }); }
    for (const r of rRest) { const [lab, v] = statOf(r); items.push({ type: 'extra', s: null, r, effect: `${nameOf(r)} ${lab} ${signed(v)}` }); }
    // Back in the order they happened (the saved side's order, else the re-track's).
    const pos = e => run.findIndex(o => o.s === e || o.r === e);
    items.sort((x, y) => pos(x.s || x.r) - pos(y.s || y.r));
    for (const o of run) { if (o.s) sAt = o.s.score || sAt; if (o.r) rAt = o.r.score || rAt; }
    if (!items.length) continue;
    const first = items[0].s || items[0].r;
    const before = ops[start - 1], after = ops[k];
    const sBefore = before ? before.s.score : { a: 0, b: 0 }, rBefore = before ? before.r.score : { a: 0, b: 0 };
    const gap = (rBefore.a + rBefore.b) - (sBefore.a + sBefore.b);
    hunks.push({
      n: hunks.length + 1, start, pos: start / Math.max(1, ops.length),
      at: `${sBefore.a}–${sBefore.b}`, delta: gap ? `re-track ${gap > 0 ? `${gap} ahead` : `${-gap} behind`}` : '',
      when: [first.period, first.clock].filter(Boolean).join(' '),
      type: items.length === 1 ? items[0].type : 'many', title: items.length === 1 ? TITLES[items[0].type] : `${items.length} changes`,
      items: items.map(x => ({ type: x.type, title: TITLES[x.type], saved: x.s ? text(x.s) : '', re: x.r ? text(x.r) : '', effect: x.effect,
        sWhen: x.s ? [x.s.period, x.s.clock].filter(Boolean).join(' ') : '', rWhen: x.r ? [x.r.period, x.r.clock].filter(Boolean).join(' ') : '',
        sScore: x.s && x.s.score ? `${x.s.score.a}–${x.s.score.b}` : '', rScore: x.r && x.r.score ? `${x.r.score.a}–${x.r.score.b}` : '',
        made: { s: x.s && x.s.type === 'shot' || x.s && x.s.type === 'ft' ? (x.s.made ? (x.s.type === 'ft' ? 1 : Number(x.s.pts) || 2) : 0) : 0, r: x.r && (x.r.type === 'shot' || x.r.type === 'ft') ? (x.r.made ? (x.r.type === 'ft' ? 1 : Number(x.r.pts) || 2) : 0) : 0 },
        team: { s: x.s ? x.s.team || '' : '', r: x.r ? x.r.team || '' : '' } })),
      before: before ? text(before.s) : '', after: after && after.t === 'same' ? text(after.s) : '',
    });
  }
  return { ops, hunks, orderCount, pending, truncated, divergeAt };
}

// Every play side by side for the site's compare page: same plays on one row, each spot's items
// (a Wrong player or Made vs missed pair on one row), moved plays muted. Hunk n marks its first row.
export function sideBySide(al, describe) {
  const cell = e => {
    if (!e) return null;
    const t = describe(e), cut = t.indexOf(' · ');
    return { name: cut > 0 ? t.slice(0, cut) : t, rest: cut > 0 ? t.slice(cut) : '', when: [e.period, e.clock].filter(Boolean).join(' '), score: e.score ? `${e.score.a}–${e.score.b}` : '' };
  };
  const byStart = new Map(al.hunks.map(h => [h.start, h]));
  const rows = [];
  for (let k = 0; k < al.ops.length;) {
    const o = al.ops[k];
    if (o.t === 'same') { const s = cell(o.s), r = cell(o.r); rows.push({ t: 'same', s, r, off: s.score !== r.score }); k++; continue; }
    const start = k, run = [];
    while (k < al.ops.length && al.ops[k].t !== 'same') run.push(al.ops[k++]);
    const h = byStart.get(start);
    // Rebuild the items with their plays (the hunk keeps text only): pair saved/re plays the same
    // way alignTracks did by walking its items in order against this run.
    const pool = run.slice();
    const take = (side, txt) => { const ix = pool.findIndex(p => p[side] && describe(p[side]) === txt); if (ix < 0) return null; const p = pool[ix][side]; pool.splice(ix, 1); return p; };
    let first = true;
    for (const x of h ? h.items : []) {
      const s = x.saved ? take('s', x.saved) : null, r = x.re ? take('r', x.re) : null;
      rows.push({ t: x.type, s: cell(s), r: cell(r), hunk: first ? h.n : null, off: false });
      first = false;
    }
    // What's left in the run: plays in both, only in another order.
    for (const p of pool) rows.push({ t: 'order', s: cell(p.s), r: cell(p.r), hunk: null, off: false });
  }
  return rows;
}
