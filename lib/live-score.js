// The live score: what the public sees while a game is being scored, before it's published.
// One summary for the site's game page (views/live-score.js) and the app's game screen
// (views/app/live.js), folded from the same plays the scorer sends, with the same engine
// (public/score-engine.js). Only the live pass: a review pass never shows. Season stats,
// leaders, picks, the recap and awards wait for publish; the published game replaces this.
import { foldGame, periodIndex, isOvertime } from '../public/score-engine.js';

// Where the game is, in one line: "Q2 · 7:30", "Halftime", "Final".
export const liveWhen = l => (l.ended || /^(Halftime|End)/.test(l.label) ? l.label : [l.label, l.clock].filter(Boolean).join(' · '));

// bundle: server.js scoreBundle(game). photo: playerId → photo URL (optional).
export function liveScoreData(bundle, { photo = () => '' } = {}) {
  const G = foldGame(bundle.events, bundle.rules);
  const sideOf = {}, byId = {};
  for (const t of ['a', 'b']) for (const p of bundle[t].players) { sideOf[p.id] = t; byId[p.id] = p; }
  const nm = id => byId[id]?.name || 'Someone';
  const tname = t => bundle[t]?.name || '';

  const last = G.rows[G.rows.length - 1] || null;
  const lastClocked = [...G.rows].reverse().find(r => r.clock && r.type !== 'period_end') || null;
  // Where the game is: the period being played, or the break after one.
  let label = G.period, ended = false;
  if (last?.type === 'period_end') {
    const i = periodIndex(last.period);
    const level = G.score.a === G.score.b;
    if (i >= bundle.rules.periods && !level) { label = 'Final'; ended = true; }
    else if (i === bundle.rules.periods) label = 'End of regulation';
    else if (i === 2) label = 'Halftime';
    else label = `End of ${last.period}`;
  }
  const team = t => ({
    id: bundle[t].id, name: tname(t), color: bundle[t].color, score: G.score[t],
    fouls: G.teamFouls[t], penalty: G.penalty[t], penaltyNext: G.penaltyNext[t],
    toLeft: G.timeouts.left[t], toAllow: G.timeouts.allowance, teamTO: G.teamTO?.[t] || 0,
    rows: Object.entries(G.players).filter(([id]) => sideOf[id] === t).map(([id, L]) => {
      const p = byId[id];
      return {
        playerId: id, number: p.number, name: p.name, photo: photo(id), flag: G.flags[id] || '', line: L,
        pts: L.pts, reb: L.reb, ast: L.ast, stl: L.stl, blk: L.blk, to: L.turnover, pf: L.pf,
        fgm: L.fg2m + L.fg3m + L.fg4m, fga: L.fg2m + L.fg2m_miss + L.fg3m + L.fg3m_miss + L.fg4m + L.fg4m_miss,
        tpm: L.fg3m, tpa: L.fg3m + L.fg3m_miss, qpm: L.fg4m, qpa: L.fg4m + L.fg4m_miss, ftm: L.ftm, fta: L.ftm + L.ft_miss,
      };
    }).sort((x, y) => y.pts - x.pts || x.name.localeCompare(y.name)),
  });
  // Play-by-play, newest first. Subs, lineups and DNP marks are the scorer's bookkeeping, not plays.
  const plays = G.rows.filter(r => r.type !== 'sub' && r.type !== 'lineup' && r.type !== 'dnp').map(r => ({
    id: r.id, period: r.period || '', clock: r.type === 'period_end' ? '' : r.clock || '',
    side: r.team || (r.player ? sideOf[r.player] : '') || '',
    end: r.type === 'period_end', score: r.score, scoring: (r.type === 'shot' || r.type === 'ft') && r.made,
    ...describe(r, nm, tname),
  })).reverse();
  return {
    status: bundle.status, label, ended, ot: isOvertime(G.period),
    clock: lastClocked ? lastClocked.clock : '', clockPeriod: lastClocked ? lastClocked.period : '',
    score: G.score, a: team('a'), b: team('b'),
    quarters: G.byPeriod.map(q => ({ quarter: periodIndex(q.period), a: q.a, b: q.b })),
    plays, count: plays.length,
    updatedAt: bundle.events.reduce((m, e) => Math.max(m, Number(e.at) || 0), 0),
  };
}

// { who, what }: who did it (bold), then what.
function describe(r, nm, tname) {
  const who = r.player ? nm(r.player) : r.team ? tname(r.team) : 'Referees';
  const kind = r.kind ? ` (${r.kind})` : '';
  switch (r.type) {
    case 'shot': return { who, what: `${r.made ? 'makes' : 'misses'} a ${r.pts === 2 ? 'two' : r.pts === 3 ? 'three' : 'four'}` };
    case 'ft': return { who, what: `${r.made ? 'makes' : 'misses'} a free throw` };
    case 'reb': return { who, what: r.off ? 'offensive rebound' : 'rebound' };
    case 'ast': return { who, what: 'assist' };
    case 'blk': return { who, what: 'block' };
    case 'stl': return { who, what: r.from ? `steal from ${nm(r.from)}` : 'steal' };
    case 'to': return { who, what: `turnover${kind}` };
    case 'foul': return { who, what: `${r.kind && r.kind !== 'personal' ? `${r.kind} ` : ''}foul` };
    case 'team_to': return { who, what: `team turnover${kind}` };
    case 'team_tech': return { who, what: `${r.kind || 'coach'} technical` };
    case 'timeout': return { who, what: 'timeout' };
    case 'stoppage': return { who: 'Referees', what: `stopped play${kind}` };
    case 'period_end': return { who: `End of ${r.period}`, what: '' };
    default: return { who, what: r.type };
  }
}
