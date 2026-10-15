// /admin/games/:id: one game (admin redesign, 2026-10-15; mockup: canvas "Game page").
// Rebuilt from scratch on views/admin/ui.js. A header with the score and what content is
// still missing, then tabs:
//   Box score  the line score and each team's box score, ✎ to correct a line (every change
//              is logged); before the game file is in: import it, or save the final score only
//   Content    recap (rich text, ✦ Write with AI), player of the game, cover, YouTube
//   Picks      Who wins? picks for this game, the pick window and hide-odds switch
//   Settings   date, type, overtime, published, stat corrections, delete
// Browser side (import, inline corrections, the recap editor, AI writing, cover upload,
// pick window): public/admin-game.js. Every POST goes to the same routes as before.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageTabs, breadcrumb, badge, button, menu, banner, section, statStrip, field, fieldGrid, segmented, toggleRow, saveBar, timeline, emptyState, drawer, avatar, progress } from './ui.js';
import { gameState, STATE_BADGE, TYPE_LABEL, otLabel, contentChecks } from './games.js';

const attr = s => escHtml(String(s ?? ''));
const n = v => Number(v) || 0;
const fmtDateLong = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtWhen = ms => new Date(ms).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Same PER the public site and the AI prompts use.
export function perOf(p) {
  const fgm = n(p.fg2m) + n(p.fg3m) + n(p.fg4m);
  const fga = fgm + n(p.fg2m_miss) + n(p.fg3m_miss) + n(p.fg4m_miss);
  const ftm = n(p.ftm), fta = ftm + n(p.ft_miss);
  return n(p.pts) + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) + 0.7 * n(p.reb) + n(p.stl) + 0.7 * n(p.ast) + 0.7 * n(p.blk) - n(p.turnover);
}

// ── Header ────────────────────────────────────────────────────────────────────────────
function hero(game, colors, st) {
  const a = n(game.team_a_score), b = n(game.team_b_score);
  const played = st !== 'upcoming';
  const win = !played || a === b ? '' : a > b ? 'a' : 'b';
  const team = (name, side) => `<span class="agd-hero__team${win === side ? ' is-win' : ''}"><i class="agl-dot" style="background:${attr(colors[side])}"></i>${escHtml(name)}</span>`;
  const checks = contentChecks(game).filter(([, ok]) => !ok).map(([l]) => `<span class="agd-check">✕ ${escHtml(l)}</span>`).join('');
  const meta = [fmtDateLong(game.date), TYPE_LABEL[game.game_type] || 'Regular season', game.season ? `Season ${game.season}` : '', otLabel(game.overtime)].filter(Boolean).join(' · ');
  const more = menu([
    st !== 'upcoming' && st !== 'score' ? { label: 'Re-import game file', href: `/admin/games/${game.id}#import` } : null,
    { label: 'All games', href: '/admin/games' },
  ]);
  return `<header class="agd-hero">
    <div class="agd-hero__main">
      <div class="agd-hero__score">${team(game.team_a_name, 'a')}${played ? `<b>${a}</b><span class="agd-hero__dash" aria-hidden="true">–</span><b>${b}</b>` : '<span class="agd-hero__vs">vs</span>'}${team(game.team_b_name, 'b')}</div>
      <div class="agd-hero__meta">${escHtml(meta)}</div>
      <div class="agd-hero__badges">${badge(...STATE_BADGE[st])}${checks}</div>
    </div>
    <div class="agd-hero__actions">${button('View on site ↗', { kind: 'secondary', href: `/games/${game.id}`, attrs: 'target="_blank" rel="noopener"' })}${more}</div>
  </header>`;
}

// ── Box score ─────────────────────────────────────────────────────────────────────────
// Each shot type is its own made-attempted pair (2PT, 3PT, 4PT when anyone took one, FT),
// so a correction maps straight back onto the stored columns.
const SHOTS = [['fg2', 'fg2m', 'fg2m_miss', '2PT'], ['fg3', 'fg3m', 'fg3m_miss', '3PT'], ['fg4', 'fg4m', 'fg4m_miss', '4PT'], ['ft', 'ftm', 'ft_miss', 'FT']];
const COUNTS = [['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'], ['turnover', 'TO']];

function boxRow(p, shots, potgId, color) {
  const orig = Object.fromEntries(['fg2m', 'fg2m_miss', 'fg3m', 'fg3m_miss', 'fg4m', 'fg4m_miss', 'ftm', 'ft_miss', 'reb', 'ast', 'stl', 'blk', 'turnover', 'pts'].map(k => [k, n(p[k])]));
  const name = displayPlayerName(p.name || '');
  const shotCell = ([key, m, miss]) => {
    const made = orig[m], att = orig[m] + orig[miss];
    return `<td class="is-num"><span class="agd-v">${att ? `${made}-${att}` : '<span class="aui-muted">–</span>'}</span><span class="agd-e" hidden><input class="aui-input agd-in" type="number" min="0" step="1" inputmode="numeric" data-shot="${key}" data-role="made" value="${made}" aria-label="${attr(`${name} ${key} made`)}"><span aria-hidden="true">-</span><input class="aui-input agd-in" type="number" min="0" step="1" inputmode="numeric" data-shot="${key}" data-role="att" value="${att}" aria-label="${attr(`${name} ${key} attempted`)}"></span></td>`;
  };
  const countCell = ([k]) => `<td class="is-num"><span class="agd-v">${orig[k]}</span><span class="agd-e" hidden><input class="aui-input agd-in" type="number" min="0" step="1" inputmode="numeric" data-field="${k}" value="${orig[k]}" aria-label="${attr(`${name} ${k}`)}"></span></td>`;
  return `<tr class="agd-row" data-stat-row data-player="${attr(p.player_id)}" data-orig="${attr(JSON.stringify(orig))}">
    <td class="agd-who"><span class="aui-who">${avatar(name, color, { size: 26, playerId: p.player_id })}<a class="agd-name" href="/admin/players/${attr(p.player_id)}">${escHtml(name)}</a>${p.player_id === potgId ? badge('POTG', 'amber') : ''}</span></td>
    ${shots.map(shotCell).join('')}
    ${COUNTS.map(countCell).join('')}
    <td class="is-num agd-per">${perOf(p).toFixed(1)}</td>
    <td class="is-num agd-pts">${orig.pts}</td>
    <td class="agd-act"><span class="agd-act__view"><button type="button" class="agd-icon" data-row-edit aria-label="${attr(`Correct ${name}’s line`)}">✎</button></span><span class="agd-act__edit" hidden><button type="button" class="agd-icon is-ok" data-row-save aria-label="Save">✓</button><button type="button" class="agd-icon" data-row-cancel aria-label="Cancel">×</button></span></td>
  </tr>`;
}

function teamTable(list, dnp, teamTo, shots, potgId, color) {
  const rows = [...list].sort((x, y) => n(y.pts) - n(x.pts));
  const sum = k => rows.reduce((t, p) => t + n(p[k]), 0);
  const cols = 1 + shots.length + COUNTS.length + 3;
  const shotTot = ([, m, miss]) => { const made = sum(m), att = made + sum(miss); return `<td class="is-num">${att ? `${made}-${att}` : '–'}</td>`; };
  const body = rows.map(p => boxRow(p, shots, potgId, color)).join('')
    + dnp.map(p => `<tr class="agd-row is-dnp"><td class="agd-who"><span class="aui-who">${avatar(p.name, color, { size: 26, playerId: p.id })}<span class="agd-name">${escHtml(p.name)}</span>${badge('DNP', 'gray')}</span></td><td colspan="${cols - 1}" class="aui-muted">Did not play</td></tr>`).join('');
  return `<div class="agd-tablewrap"><table class="agd-table">
    <thead><tr><th scope="col">Player</th>${shots.map(s => `<th scope="col" class="is-num">${s[3]}</th>`).join('')}${COUNTS.map(c => `<th scope="col" class="is-num">${c[1]}</th>`).join('')}<th scope="col" class="is-num">PER</th><th scope="col" class="is-num">PTS</th><th scope="col"><span class="sr-only">Correct</span></th></tr></thead>
    <tbody>${body || `<tr><td colspan="${cols}" class="aui-muted">No stats for this team.</td></tr>`}</tbody>
    ${rows.length ? `<tfoot><tr><td>Team</td>${shots.map(shotTot).join('')}${COUNTS.map(([k]) => `<td class="is-num">${sum(k) + (k === 'turnover' ? teamTo : 0)}${k === 'turnover' && teamTo ? '*' : ''}</td>`).join('')}<td class="is-num">–</td><td class="is-num">${sum('pts')}</td><td></td></tr></tfoot>` : ''}
  </table></div>
  ${teamTo ? `<p class="agd-foot">* includes ${teamTo} team turnover${teamTo === 1 ? '' : 's'} (shot clock and the like) not charged to a player.</p>` : ''}`;
}

function lineScore(game, quarterScores) {
  const qs = (quarterScores || []).filter(q => q.a != null || q.b != null);
  if (!qs.length) return '';
  const label = q => (q.quarter <= 4 ? `Q${q.quarter}` : q.quarter === 5 ? 'OT' : `${q.quarter - 4}OT`);
  return `<div class="agd-lines" role="table" aria-label="Line score">
    ${qs.map(q => `<div class="agd-lines__cell" role="cell"><span>${label(q)}</span><b>${q.a ?? '–'} · ${q.b ?? '–'}</b></div>`).join('')}
    <div class="agd-lines__cell is-final" role="cell"><span>Final</span><b>${n(game.team_a_score)} · ${n(game.team_b_score)}</b></div>
  </div>`;
}

function importPanel(game, st) {
  const sub = st === 'score'
    ? 'The score is in. Import the game file from the wknd-stats app to add the box score and player stats.'
    : st === 'upcoming' ? 'After the game, export the game file from the wknd-stats app and import it here: the final score, box score and player stats come in together.'
    : 'Replaces this game’s box score and player stats with the file’s. Recap, cover and picks stay.';
  return `<div class="agd-import" data-import="/admin/games/${attr(game.id)}/import">
    <p class="aui-muted agd-import__sub">${escHtml(sub)}</p>
    <label class="agd-file"><input type="file" accept=".json,application/json" data-import-file><span class="agd-file__name" data-import-name>Choose the exported file (.json)…</span><span class="aui-btn aui-btn--secondary aui-btn--sm">Browse</span></label>
    <div class="aui-row">${button('Import results', { kind: 'primary', attrs: 'data-import-go disabled' })}</div>
    <div data-import-progress hidden>${progress(0, { label: 'Uploading…' })}</div>
  </div>`;
}

function boxTab({ game, st, stats, dnpPlayers, quarterScores, colors, potgId, teamA, teamB, byTeam, dnpByTeam, teamTurnovers }) {
  if (st === 'upcoming' || st === 'score') {
    const finalForm = st === 'upcoming' ? section({
      title: 'Or save the final score only',
      note: '· picks settle now, the box score can follow',
      bodyHtml: `<form class="aui-panel" data-json-action="/admin/games/${attr(game.id)}/final" data-done="Final score saved. Picks are settled." data-confirm data-confirm-title="Save the final score?" data-confirm-body="Picks for this game settle and results go out." data-confirm-send="Save score">
        ${fieldGrid(`${field({ label: game.team_a_name, name: 'team_a_score', type: 'number', required: true, attrs: 'min="0" step="1" inputmode="numeric"' })}
          ${field({ label: game.team_b_name, name: 'team_b_score', type: 'number', required: true, attrs: 'min="0" step="1" inputmode="numeric"' })}
          ${field({ label: 'Overtime', name: 'overtime', type: 'select', value: '0', options: [['0', 'Regulation'], ['1', 'OT'], ['2', '2OT'], ['3', '3OT']] })}`)}
        <div class="aui-row agd-formfoot">${button('Save final score', { kind: 'secondary', type: 'submit' })}</div>
      </form>`,
    }) : '';
    return `${section({ title: 'Import the game file', bodyHtml: `<div class="aui-panel">${importPanel(game, st)}</div>` })}${finalForm}`;
  }
  const shots = SHOTS.filter(([key, m, miss]) => key !== 'fg4' || stats.some(p => n(p[m]) + n(p[miss]) > 0));
  const tA = String(game.team_a_name).toUpperCase(), tB = String(game.team_b_name).toUpperCase();
  const switcher = `<div class="aui-segmented agd-teamswitch" role="radiogroup" aria-label="Team">
    <label><input type="radio" name="box-team" value="a" checked data-team-pick><span><i class="agl-dot" style="background:${attr(colors.a)}"></i>${escHtml(teamA)}</span></label>
    <label><input type="radio" name="box-team" value="b" data-team-pick><span><i class="agl-dot" style="background:${attr(colors.b)}"></i>${escHtml(teamB)}</span></label>
  </div>`;
  return `${lineScore(game, quarterScores)}
    <div class="agd-boxhead">${switcher}<span class="aui-muted agd-boxhead__hint">Click ✎ to correct a line. Every change is logged.</span>${button('Re-import game file', { kind: 'ghost', size: 'sm', attrs: 'data-drawer-open="import"' })}</div>
    <div data-team-panel="a">${teamTable(byTeam[tA] || [], dnpByTeam[tA] || [], teamTurnovers[tA] || 0, shots, potgId, colors.a)}</div>
    <div data-team-panel="b" hidden>${teamTable(byTeam[tB] || [], dnpByTeam[tB] || [], teamTurnovers[tB] || 0, shots, potgId, colors.b)}</div>
    ${drawer({ id: 'import', eyebrow: 'Box score', title: 'Re-import the game file', bodyHtml: importPanel(game, st) })}`;
}

// ── Content ───────────────────────────────────────────────────────────────────────────
function coverBlock(game) {
  const id = attr(game.id);
  return `<div class="agd-cover" data-cover-game="${id}">
    ${game.has_cover
      ? `<img class="agd-cover__img" src="/admin/games/${id}/cover-img?v=${Date.now()}" alt="Cover">`
      : '<span class="agd-cover__empty" aria-hidden="true">＋</span>'}
    <span class="aui-cell__stack"><span class="aui-cell__title">${game.has_cover ? 'Cover image' : 'Upload a cover'}</span><span class="aui-cell__sub" data-cover-status>Shown on the game page and share cards</span></span>
    <span class="aui-row">
      <label class="aui-btn aui-btn--secondary aui-btn--sm agd-cover__pick">${game.has_cover ? 'Change' : 'Upload'}<input type="file" accept="image/jpeg,image/png,image/webp" data-cover-file hidden></label>
      ${game.has_cover ? button('Remove', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/games/${id}/cover" data-method="DELETE" data-done="Cover removed." data-confirm data-confirm-title="Remove the cover image?" data-confirm-send="Remove"` }) : ''}
    </span>
  </div>`;
}

function contentTab({ game, st, stats, colors, colorOfTeam }) {
  if (st === 'upcoming') return emptyState({ title: 'Content comes after the game', sub: 'Import the game file first. Then write the recap and pick the player of the game here.' });
  if (st === 'score') return section({ title: 'Cover', note: '· the recap and player of the game need the box score', bodyHtml: `<div class="aui-panel">${coverBlock(game)}</div>` });

  // Player of the game: the winners' top five by PER (plus a hand-picked one from outside it).
  const a = n(game.team_a_score), b = n(game.team_b_score);
  const winner = String(a >= b ? game.team_a_name : game.team_b_name).toUpperCase();
  const top = stats.filter(s => String(s.team_name || '').toUpperCase() === winner).sort((x, y) => perOf(y) - perOf(x)).slice(0, 5);
  if (game.manual_potg_player_id && !top.some(p => p.player_id === game.manual_potg_player_id)) {
    const m = stats.find(s => s.player_id === game.manual_potg_player_id);
    if (m) top.push(m);
  }
  const chosen = game.manual_potg_player_id || top[0]?.player_id || '';
  const potgList = top.length ? `<div class="aui-choices agd-potg">${top.map(p => {
    const name = displayPlayerName(p.name || '');
    return `<label class="aui-choice"><input type="radio" name="potg_player_id" value="${attr(p.player_id)}"${p.player_id === chosen ? ' checked' : ''}><span class="aui-choice__body">${avatar(name, colorOfTeam(p.team_name), { size: 28, playerId: p.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}</span><span class="aui-cell__sub">${n(p.pts)} pts · ${n(p.reb)} reb · ${n(p.ast)} ast</span></span><span class="agd-per-tag">PER ${perOf(p).toFixed(1)}</span></span></label>`;
  }).join('')}</div>` : '<p class="aui-muted">No stats to choose from.</p>';

  const raw = game.game_writeup || '';
  const recapHtml = raw.trim().startsWith('<') ? raw : raw ? `<p>${escHtml(raw).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>` : '';
  const words = String(raw).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;

  return `<form id="game-content" data-json-action="/admin/games/${attr(game.id)}/save" data-done="Content saved." data-dirty-watch class="aui-page agd-content">
    ${section({
      title: 'Recap',
      asideHtml: `<span class="aui-muted agd-words"><span data-recap-words>${words}</span> words</span>`,
      bodyHtml: `<div class="aui-panel agd-recap">
        <div class="agd-editor" data-recap-editor></div>
        <textarea name="game_writeup" hidden data-recap-html>${escHtml(recapHtml)}</textarea>
        <div class="agd-ai">
          <label class="aui-field is-wide" for="f-recap-context"><span class="aui-field__label">Extra context for the AI <span class="aui-muted">(optional, not saved)</span></span>
            <textarea class="aui-input" rows="2" id="f-recap-context" maxlength="1500" placeholder="e.g. First game back for Kix. Focus on the defense in Q4." data-recap-context></textarea></label>
          <div class="aui-row">${button('✦ Write with AI', { kind: 'secondary', attrs: `data-ai="/admin/games/${attr(game.id)}/generate-recap" data-ai-target="recap"` })}<span class="aui-muted" data-ai-status="recap"></span></div>
        </div>
      </div>`,
    })}
    ${section({
      title: 'Player of the game',
      bodyHtml: `<div class="aui-panel agd-potgwrap">
        ${potgList}
        <label class="aui-field is-wide" for="f-potg"><span class="aui-field__label">Write-up</span>
          <textarea class="aui-input" rows="4" id="f-potg" name="potg_writeup" placeholder="Why they were the player of the game…" data-potg-text>${escHtml(game.potg_writeup || '')}</textarea></label>
        <div class="aui-row">${button('✦ Write with AI', { kind: 'secondary', attrs: `data-ai="/admin/games/${attr(game.id)}/generate-potg" data-ai-target="potg"` })}<span class="aui-muted" data-ai-status="potg"></span></div>
      </div>`,
    })}
    ${section({
      title: 'Cover and video',
      bodyHtml: `<div class="aui-panel agd-media">
        ${coverBlock(game)}
        ${field({ label: 'YouTube link', name: 'youtube_url', type: 'url', value: game.youtube_url || '', placeholder: 'https://youtube.com/watch?v=…', wide: true })}
      </div>`,
    })}
  </form>
  ${saveBar({ label: 'Save content', form: 'game-content' })}`;
}

// ── Picks ─────────────────────────────────────────────────────────────────────────────
function picksTab({ game, st, pp, colors, colorById }) {
  if (!pp) return emptyState({ title: 'No picks for this game' });
  const sides = { a: pp.picks.filter(p => p.side === 'a'), b: pp.picks.filter(p => p.side === 'b') };
  const total = pp.picks.length;
  const pct = k => (total ? Math.round((sides[k].length / total) * 100) : 0);
  const o = pp.odds;
  const played = st === 'live' || st === 'draft' || st === 'score';
  const winSide = played && n(game.team_a_score) !== n(game.team_b_score) ? (n(game.team_a_score) > n(game.team_b_score) ? 'a' : 'b') : '';
  const strip = statStrip([
    { label: 'Picks', value: String(total) },
    { label: `Picked ${game.team_a_name}`, value: String(sides.a.length), of: total ? ` · ${pct('a')}%` : '' },
    { label: `Picked ${game.team_b_name}`, value: String(sides.b.length), of: total ? ` · ${pct('b')}%` : '' },
    { label: played ? 'Odds before' : 'Odds', value: o?.pctA != null ? `${o.pctA}% · ${o.pctB}%` : '—', of: o?.pctA != null ? '' : '' },
  ]);
  const oddsLine = o?.pctA != null ? `${game.team_a_name} ${o.pctA}% · ${o.pctB}% ${game.team_b_name}` : 'No odds yet: a team has no games this season.';
  const state = pp.upcoming
    ? (pp.closedNow ? `Picks are closed${pp.override === 'closed' ? ' (closed by hand)' : ''}.` : `Picks are open. They close at ${pp.closeTime} on game day${pp.override === 'open' ? ', unless kept open by hand' : ''}.`)
    : pp.settledAt ? `Picks closed when the game started. Results went out ${fmtWhen(pp.settledAt)}.` : 'Picks closed when the game started. Results go out once the game is final and published.';
  const controls = pp.upcoming ? `<div class="aui-panel agd-pickctl">
      <div class="agd-pickctl__row"><span class="aui-cell__stack"><span class="aui-cell__title">Pick window</span><span class="aui-cell__sub">Automatic closes at the game-day cut-off.</span></span>
        <div data-pick-window="/admin/games/${attr(game.id)}/picks">${segmented({ name: 'closed', value: pp.override, label: 'Pick window', options: [['auto', 'Automatic'], ['closed', 'Closed now'], ['open', 'Keep open']] })}</div></div>
      ${toggleRow({ label: 'Hide odds for this game', help: 'The matchup card shows no win chances.', name: 'hide_odds', on: pp.hideOdds, post: `/admin/games/${game.id}/picks`, reload: true })}
    </div>` : '';
  const col = k => {
    const team = k === 'a' ? game.team_a_name : game.team_b_name;
    const res = winSide ? (winSide === k ? badge(`Called it · ${sides[k].length}`, 'green') : badge(`Missed · ${sides[k].length}`, 'gray')) : badge(String(sides[k].length), 'gray');
    const list = sides[k].map(p => `<li class="agd-picker">${avatar(p.player_name, colorById[p.player_id] || '', { size: 24, playerId: p.player_id })}<a class="agd-name" href="/admin/players/${attr(p.player_id)}">${escHtml(p.player_name || p.player_id)}</a><span class="aui-muted agd-picker__when">${escHtml(fmtWhen(p.created_at))}</span></li>`).join('');
    return `<section class="aui-panel aui-panel--flush agd-pickcol"><h3 class="agd-pickcol__head"><span class="agd-pickcol__team"><i class="agl-dot" style="background:${attr(colors[k])}"></i>${escHtml(team)}</span>${res}</h3>
      ${list ? `<ul class="agd-pickers">${list}</ul>` : '<p class="aui-muted agd-pickcol__none">No picks</p>'}</section>`;
  };
  return `${strip}
    <p class="aui-muted agd-odds">${escHtml(oddsLine)}</p>
    ${banner('info', state)}
    ${pp.finalsNote ? banner('warn', pp.finalsNote) : ''}
    ${controls}
    <div class="agd-pickcols">${col('a')}${col('b')}</div>`;
}

// ── Settings ──────────────────────────────────────────────────────────────────────────
function correctionsList(statCorrections, nameById) {
  // The admin audit log records every request, including rejected ones; only entries
  // stamped with old_value actually changed the box score.
  const applied = statCorrections.map(l => { try { return { l, d: JSON.parse(l.details || '{}') }; } catch { return null; } }).filter(x => x && 'old_value' in x.d);
  if (!applied.length) return '<p class="aui-muted">No corrections yet.</p>';
  const FIELD = { fg2m: '2PT made', fg2m_miss: '2PT missed', fg3m: '3PT made', fg3m_miss: '3PT missed', fg4m: '4PT made', fg4m_miss: '4PT missed', ftm: 'FT made', ft_miss: 'FT missed', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', turnover: 'TO' };
  return timeline(applied.slice(0, 30).map(({ l, d }) => {
    const pid = (l.path.match(/\/stats\/([^/]+)$/) || [])[1];
    return { who: l.actor || 'Admin', what: `${nameById[pid] || 'a player'} · ${FIELD[d.field] || d.field} ${d.old_value ?? '—'} → ${d.value}`, when: fmtWhen(l.created_at) };
  }));
}

function settingsTab({ game, st, statCorrections, nameById }) {
  const id = attr(game.id);
  const gameForm = `<form id="game-settings" class="aui-panel" data-json-action="/admin/games/${id}/save" data-done="Game saved." data-dirty-watch>
    ${fieldGrid(`${field({ label: 'Date', name: 'date', type: 'date', value: game.date || '', required: true })}
      ${field({ label: 'Type', name: 'game_type', type: 'select', value: game.game_type || 'regular', options: Object.entries(TYPE_LABEL), help: game.game_type === 'playoff' ? 'Set a Finals game to Finals so Game 1 gets the margin-guess tiebreaker.' : '' })}
      ${st !== 'upcoming' ? field({ label: 'Overtime', name: 'overtime', type: 'select', value: String(n(game.overtime)), options: [['0', 'Regulation'], ['1', 'OT'], ['2', '2OT'], ['3', '3OT']] }) : ''}
      <div class="aui-field"><span class="aui-field__label">Season</span><span class="agd-ro">Season ${escHtml(String(game.season || '—'))}</span><span class="aui-field__help">Set when the game was created.</span></div>`)}
  </form>`;
  const publish = st === 'live' || st === 'draft'
    ? `<div class="aui-panel">${toggleRow({ label: 'Published', help: 'Off = Draft: hidden from every public page.', name: 'published', on: st === 'live', post: `/admin/games/${game.id}/review`, reload: true })}</div>`
    : '<p class="aui-muted">Publishing comes after the game file is imported.</p>';
  const del = `<div class="aui-panel agd-danger"><span class="aui-cell__stack"><span class="aui-cell__title">Delete game</span><span class="aui-cell__sub">Removes the game and every player’s stats from it. This can’t be undone.</span></span>
    ${button('Delete game…', { kind: 'danger', attrs: `data-post-json="/admin/games/${id}" data-method="DELETE" data-then="/admin/games" data-done="Game deleted." data-confirm data-confirm-title="Delete ${attr(`${game.team_a_name} vs ${game.team_b_name}`)}?" data-confirm-body="Every player’s stats from this game go too. This can’t be undone." data-confirm-send="Delete game"` })}</div>`;
  return `${section({ title: 'Game', note: '· date, type and overtime', bodyHtml: gameForm })}
    ${section({ title: 'On the site', bodyHtml: publish })}
    ${st === 'live' || st === 'draft' ? section({ title: 'Stat corrections', note: '· every change to the box score', bodyHtml: `<div class="aui-panel">${correctionsList(statCorrections, nameById)}</div>` }) : ''}
    ${section({ title: 'Danger zone', bodyHtml: del })}
    ${saveBar({ label: 'Save game', form: 'game-settings' })}`;
}

export function adminGameDetailBody({ game, tab = 'box', stats = [], dnpPlayers = [], quarterScores = [], statCorrections = [], picksPanel = null, players = [], teams = [], colorById = {}, box }) {
  const st = gameState(game);
  const colorByName = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), t.color || '']));
  const colorOfTeam = name => colorByName[String(name || '').toUpperCase()] || '';
  const colors = { a: colorOfTeam(game.team_a_name), b: colorOfTeam(game.team_b_name) };
  const nameById = Object.fromEntries(players.map(p => [p.id, displayPlayerName(p.name || '')]));

  // The player of the game as the site shows it: picked by hand, else the winners' top PER.
  const a = n(game.team_a_score), b = n(game.team_b_score);
  const winner = String(a >= b ? game.team_a_name : game.team_b_name).toUpperCase();
  const autoPotg = stats.filter(s => String(s.team_name || '').toUpperCase() === winner).sort((x, y) => perOf(y) - perOf(x))[0]?.player_id || '';
  const potgId = st === 'live' || st === 'draft' ? (game.manual_potg_player_id || autoPotg) : '';

  const missing = contentChecks(game).filter(([, ok]) => !ok).length;
  const tabs = [
    ['box', st === 'upcoming' || st === 'score' ? 'Results' : 'Box score', ''],
    ['content', 'Content', missing && st !== 'upcoming' ? `${missing} missing` : ''],
    ['picks', 'Picks', picksPanel?.picks.length ? String(picksPanel.picks.length) : ''],
    ['settings', 'Settings', ''],
  ];
  const current = tabs.some(t => t[0] === tab) ? tab : 'box';
  const base = `/admin/games/${game.id}`;
  const tabsHtml = pageTabs(tabs.map(([k, label, count]) => ({ label, count, href: k === 'box' ? base : `${base}?tab=${k}`, active: k === current })));

  const draft = st === 'draft'
    ? banner('warn', 'Draft: hidden from every public page until you publish it.', button('Publish', { kind: 'primary', size: 'sm', attrs: `data-post-json="${base}/review" data-body="${attr(JSON.stringify({ under_review: 0 }))}" data-done="Published. The game is live." data-confirm data-confirm-title="Publish this game?" data-confirm-body="It shows on the site, and pick results go out if they haven’t." data-confirm-send="Publish"` }))
    : '';

  const body = {
    box: () => boxTab({ game, st, stats, dnpPlayers, quarterScores, colors, potgId, teamA: game.team_a_name, teamB: game.team_b_name, ...box }),
    content: () => contentTab({ game, st, stats, colors, colorOfTeam }),
    picks: () => picksTab({ game, st, pp: picksPanel, colors, colorById }),
    settings: () => settingsTab({ game, st, statCorrections, nameById }),
  }[current]();

  return `<div class="aui-page agd" id="agd" data-game="${attr(game.id)}">
    ${breadcrumb([{ label: 'Games', href: '/admin/games' }, { label: `${game.team_a_name} vs ${game.team_b_name}` }])}
    ${hero(game, colors, st)}
    ${draft}
    ${tabsHtml}
    <div class="agd-body" data-tab="${current}">${body}</div>
  </div>
  <script src="/admin-game.js" defer></script>`;
}
