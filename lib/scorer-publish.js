// Publishing a scored game: turns the scorer's plays (public/score-engine.js) into exactly what a
// wknd-stats file import hands importGameResults, so every page that reads a game — the box
// score, game flow and key plays, quarter scores, play-by-play, the recap writer — works the
// same either way. The route (server.js POST /admin/games/:id/scoring/publish) then runs the
// import's own follow-up steps (afterGameImport).
//
// The old log format, which those readers parse (lib/game-detail.js gameFlow/quarterMarkers,
// server.js extractQuarterScores/scoringTimeline, lib/ai.js filterPbpForRecap):
//   • newest first
//   • scoring plays carry the score in their text: "LASTNAME, First: 2pt Made [WHI 36 - BLA 40]",
//     tags = the first 3 letters of each team's name, team A first
//   • statField + changeAmount + isTeamA + quarter (number; 5 = OT1) + clockRemaining "07:24"
//   • a quarterEnd meta per period: "End Q2 [WHI 40 - BLA 49]"
import { foldGame, livePlays, periodIndex, DEFAULT_RULES } from '../public/score-engine.js';

const tag = name => String(name || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TM';
const clock = c => {
  const [m, s] = String(c || '0:00').split(':').map(n => Number(n) || 0);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// game: the games row. events: getScoreEvents(). players: { [id]: { name } } (raw "LAST, First").
// settings: score_games settings ({ rules, dnp }). Returns { payload, orebs, state }.
export function buildPublishPayload(game, events, players, settings = {}) {
  const rules = { ...DEFAULT_RULES, ...(settings.rules || {}) };
  const state = foldGame(events, rules);
  const plays = livePlays(events);
  const A = tag(game.team_a_name), B = tag(game.team_b_name);
  const nameOf = id => (players[id] && players[id].name) || 'Player';
  const suffix = s => ` [${A} ${s.a} - ${B} ${s.b}]`;
  const log = [];
  let n = 0;
  const push = (e, fields) => log.push({ id: `${e.id}_${n++}`, time: '', kind: 'stat', quarter: periodIndex(e.period || 'Q1'), clockRemaining: clock(e.clock), isTeamA: e.team === 'a', ...fields });

  // Walk the plays in order with the running score (state.rows has it after each play).
  const rows = state.rows;
  const seenPeriods = new Set();
  rows.forEach(e => {
    const s = e.score, who = nameOf(e.player);
    seenPeriods.add(e.period || 'Q1');
    switch (e.type) {
      case 'shot': {
        const k = Number(e.pts) || 2;
        push(e, e.made
          ? { text: `${who}: ${k}pt Made${suffix(s)}`, playerId: e.player, statField: 'pts', changeAmount: k, attachedTrackingStat: `fg${k}m`, trackingDelta: 1 }
          : { text: `${who}: ${k}pt Miss${suffix(s)}`, playerId: e.player, statField: `fg${k}m_miss`, changeAmount: 1 });
        break;
      }
      case 'ft':
        push(e, e.made
          ? { text: `${who}: +1 FT${suffix(s)}`, playerId: e.player, statField: 'pts', changeAmount: 1, attachedTrackingStat: 'ftm', trackingDelta: 1 }
          : { text: `${who}: FT Miss${suffix(s)}`, playerId: e.player, statField: 'ft_miss', changeAmount: 1 });
        break;
      case 'reb': push(e, { text: `${who}: +1 REB${e.off ? ' (OFF)' : ''}`, playerId: e.player, statField: 'reb', changeAmount: 1 }); break;
      case 'ast': push(e, { text: `${who}: +1 AST`, playerId: e.player, statField: 'ast', changeAmount: 1 }); break;
      case 'blk': push(e, { text: `${who}: +1 BLK`, playerId: e.player, statField: 'blk', changeAmount: 1 }); break;
      case 'stl':
        push(e, { text: `${who}: +1 STL`, playerId: e.player, statField: 'stl', changeAmount: 1 });
        if (e.from) push({ ...e, team: e.team === 'a' ? 'b' : 'a' }, { text: `${nameOf(e.from)}: +1 TO`, playerId: e.from, statField: 'to', changeAmount: 1 });
        break;
      case 'to': push(e, { text: `${who}: +1 TO${e.kind ? ` (${e.kind})` : ''}`, playerId: e.player, statField: 'to', changeAmount: 1 }); break;
      case 'foul':
        push(e, { text: `${who}: +1 FOUL${e.kind && e.kind !== 'personal' ? ` (${e.kind})` : ''}`, playerId: e.player, statField: 'pf', changeAmount: 1, countsTeamFoul: true });
        if (e.kind === 'offensive') push(e, { text: `${who}: +1 TO (offensive foul)`, playerId: e.player, statField: 'to', changeAmount: 1 });
        break;
      case 'team_to': push(e, { kind: 'meta', metaType: 'teamTurnover', text: `Team turnover${e.kind ? ` (${e.kind})` : ''} (${e.team === 'a' ? A : B})` }); break;
      case 'team_tech': push(e, { kind: 'meta', metaType: 'teamTechnical', text: `Technical (${e.kind || 'coach'}) (${e.team === 'a' ? A : B})` }); break;
      case 'timeout': push(e, { kind: 'meta', metaType: 'timeout', text: `Timeout (${e.team === 'a' ? A : B})` }); break;
      case 'period_end': push(e, { kind: 'meta', metaType: 'quarterEnd', quarter: periodIndex(e.period), clockRemaining: '00:00', text: `End ${e.period}${suffix(s)}` }); break;
      default: break;
    }
  });
  // The last period ends at the final score even if nobody tapped End.
  const lastPeriod = plays.length ? (plays[plays.length - 1].period || 'Q1') : 'Q4';
  if (!rows.some(e => e.type === 'period_end' && e.period === lastPeriod)) {
    log.push({ id: `end_${lastPeriod}`, time: '', kind: 'meta', metaType: 'quarterEnd', quarter: periodIndex(lastPeriod), clockRemaining: '00:00', isTeamA: true, text: `End ${lastPeriod}${suffix(state.score)}` });
  }
  log.reverse(); // newest first, like a wknd-stats export

  // Points by period, the shape period_snapshots_json takes (overtime = periods beyond 4).
  const periods = [...new Set([...seenPeriods, lastPeriod])].sort((x, y) => periodIndex(x) - periodIndex(y));
  const byP = Object.fromEntries(state.byPeriod.map(p => [p.period, p]));
  const periodSnapshots = periods.map(p => ({ quarter: periodIndex(p), quarterStats: { teamA: { pts: byP[p] ? byP[p].a : 0 }, teamB: { pts: byP[p] ? byP[p].b : 0 } } }));

  // Box score lines in the import's shape (to → turnover, min stays empty: minutes aren't tracked).
  // Didn't play: the admin's list plus the scorer's DNP marks (a late player who then played
  // isn't on it: their first stat cleared the mark).
  const dnp = new Set([...(settings.dnp || []), ...state.dnp]);
  const playerStats = {};
  const orebs = {};
  for (const [pid, L] of Object.entries(state.players)) {
    if (dnp.has(pid)) continue;
    playerStats[pid] = { pts: L.pts, ast: L.ast, reb: L.reb, stl: L.stl, blk: L.blk, to: L.turnover, pf: L.pf,
      fg2m: L.fg2m, fg3m: L.fg3m, fg4m: L.fg4m, fg2m_miss: L.fg2m_miss, fg3m_miss: L.fg3m_miss, fg4m_miss: L.fg4m_miss, ftm: L.ftm, ft_miss: L.ft_miss, min: '' };
    orebs[pid] = L.oreb;
  }
  return {
    state, orebs,
    payload: {
      teamAScore: state.score.a, teamBScore: state.score.b,
      periodSnapshots, gameLog: log, dnpPlayerIds: [...dnp], playerStats,
      season: game.season, teamATeamTurnovers: state.teamTO.a, teamBTeamTurnovers: state.teamTO.b,
    },
  };
}
