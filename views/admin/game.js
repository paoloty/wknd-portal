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
import { pageTabs, breadcrumb, badge, button, menu, banner, section, statStrip, field, fieldGrid, segmented, toggleRow, saveBar, timeline, emptyState, drawer, avatar, progress, playerPicker, dataGrid } from './ui.js';
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
  const meta = [fmtDateLong(game.date), TYPE_LABEL[game.game_type] || 'Regular season', game.season ? `Season ${game.season}` : '', otLabel(game.overtime), game.court_name || ''].filter(Boolean).join(' · ');
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
    <td class="agd-who"><span class="aui-who">${avatar(name, color, { size: 26, playerId: p.player_id })}<a class="agd-name" href="/admin/players/${attr(p.player_id)}">${escHtml(name)}</a>${potgId.includes(p.player_id) ? badge(p.player_id === potgId[0] ? 'POTG' : 'CO-POTG', 'amber') : ''}</span></td>
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

  // Player of the game: the winners' top five by PER (plus hand-picked ones from outside it).
  // Tick one, or two to share the award: the first ticked is the POTG, the second the co-POTG
  // (public/admin-game.js keeps the order in the hidden inputs and each one's write-up box).
  const a = n(game.team_a_score), b = n(game.team_b_score);
  const winner = String(a >= b ? game.team_a_name : game.team_b_name).toUpperCase();
  const top = stats.filter(s => String(s.team_name || '').toUpperCase() === winner).sort((x, y) => perOf(y) - perOf(x)).slice(0, 5);
  for (const id of [game.manual_potg_player_id, game.co_potg_player_id]) {
    const m = id && !top.some(p => p.player_id === id) && stats.find(s => s.player_id === id);
    if (m) top.push(m);
  }
  const chosen = game.manual_potg_player_id || top[0]?.player_id || '';
  const co = chosen && game.co_potg_player_id !== chosen && top.some(p => p.player_id === game.co_potg_player_id) ? String(game.co_potg_player_id) : '';
  const order = [chosen, co].filter(Boolean);
  const nameOf = id => displayPlayerName(top.find(p => p.player_id === id)?.name || '');
  const potgList = top.length ? `<div class="aui-choices agd-potg" data-potg-wrap data-potg-order="${attr(order.join(','))}" data-potg-initial="${attr(order.join(','))}">${top.map(p => {
    const name = displayPlayerName(p.name || '');
    const i = order.indexOf(p.player_id);
    return `<label class="aui-choice"><input type="checkbox" value="${attr(p.player_id)}" data-potg-pick data-name="${attr(name)}"${i !== -1 ? ' checked' : ''}${order.length > 1 && i === -1 ? ' disabled' : ''}><span class="aui-choice__body"><span class="agd-tick" aria-hidden="true"></span>${avatar(name, colorOfTeam(p.team_name), { size: 28, playerId: p.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(name)}</span><span class="aui-cell__sub">${n(p.pts)} pts · ${n(p.reb)} reb · ${n(p.ast)} ast</span></span><span class="agd-potg-tag" data-potg-tag>${order.length > 1 && i === 1 ? 'CO-POTG' : 'POTG'}</span><span class="agd-per-tag">PER ${perOf(p).toFixed(1)}</span></span></label>`;
  }).join('')}</div>
    <input type="hidden" name="potg_player_id" value="${attr(chosen)}" data-potg-id>
    <input type="hidden" name="co_potg_player_id" value="${attr(co)}" data-copotg-id>
    <p class="aui-muted agd-potg-hint" data-potg-hint>${order.length > 1 ? 'Two picked: they share the award, both get full POTG credit.' : 'Tick a second player to share the award.'}</p>` : '<p class="aui-muted">No stats to choose from.</p>';
  const coBlock = top.length > 1 ? `<div class="agd-copotg" data-copotg-fields${co ? '' : ' hidden'}>
        <label class="aui-field is-wide" for="f-copotg"><span class="aui-field__label" data-copotg-label>Write-up · ${escHtml(nameOf(co))}</span>
          <textarea class="aui-input" rows="4" id="f-copotg" name="co_potg_writeup" placeholder="Why they shared the award…" data-copotg-text>${escHtml(game.co_potg_writeup || '')}</textarea></label>
        <div class="aui-row">${button('✦ Write with AI', { kind: 'secondary', attrs: `data-ai="/admin/games/${attr(game.id)}/generate-potg" data-ai-target="copotg"` })}<span class="aui-muted" data-ai-status="copotg"></span></div>
      </div>` : '';

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
        <label class="aui-field is-wide" for="f-potg"><span class="aui-field__label" data-potg-label>Write-up${chosen ? ` · ${escHtml(nameOf(chosen))}` : ''}</span>
          <textarea class="aui-input" rows="4" id="f-potg" name="potg_writeup" placeholder="Why they were the player of the game…" data-potg-text>${escHtml(game.potg_writeup || '')}</textarea></label>
        <div class="aui-row">${button('✦ Write with AI', { kind: 'secondary', attrs: `data-ai="/admin/games/${attr(game.id)}/generate-potg" data-ai-target="potg"` })}<span class="aui-muted" data-ai-status="potg"></span></div>
        ${coBlock}
        <div class="aui-row agd-potgvideo">${button('🎬 Make POTG video', { kind: 'secondary', href: `/admin/games/${encodeURIComponent(game.id)}/potg-video` })}<span class="aui-muted">Save your POTG pick first. ${co ? 'Makes two videos (POTG + co-POTG).' : 'Renders in the background under Processing.'}</span></div>
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

// Court options: active courts, plus the game's current court if it was since switched off.
function courtOptions(courts, currentId = '') {
  const list = courts.filter(c => c.active || c.id === currentId);
  return [['', 'Not set'], ...list.map(c => [c.id, c.name])];
}

function settingsTab({ game, st, statCorrections, nameById, courts }) {
  const id = attr(game.id);
  const gameForm = `<form id="game-settings" class="aui-panel" data-json-action="/admin/games/${id}/save" data-done="Game saved." data-dirty-watch>
    ${fieldGrid(`${field({ label: 'Date', name: 'date', type: 'date', value: game.date || '', required: true })}
      ${field({ label: 'Tip-off', name: 'tip_time', type: 'time', value: game.tip_time || '', help: 'Shows next to the date wherever the game is listed. Leave empty if not set yet.' })}
      ${field({ label: 'Type', name: 'game_type', type: 'select', value: game.game_type || 'regular', options: Object.entries(TYPE_LABEL), help: game.game_type === 'playoff' ? 'Set a Finals game to Finals so Game 1 gets the margin-guess tiebreaker.' : '' })}
      ${st !== 'upcoming' ? field({ label: 'Overtime', name: 'overtime', type: 'select', value: String(n(game.overtime)), options: [['0', 'Regulation'], ['1', 'OT'], ['2', '2OT'], ['3', '3OT']] }) : ''}
      <div class="aui-field"><span class="aui-field__label">Season</span><span class="agd-ro">Season ${escHtml(String(game.season || '—'))}</span><span class="aui-field__help">Set when the game was created.</span></div>
      ${field({ label: 'Court', name: 'court_id', type: 'select', value: game.court_id || '', options: courtOptions(courts, game.court_id), help: 'Shown on the game page. Courts are managed under Papawis → Courts.' })}`)}
    <label class="aui-check" style="margin-top:12px"><input type="checkbox" name="court_whole_day" value="1"><span>Use this court for every game on this day</span></label>
  </form>`;
  const publish = st === 'live' || st === 'draft'
    ? `<div class="aui-panel">${toggleRow({ label: 'Published', help: 'Off = Draft: hidden from every public page.', name: 'published', on: st === 'live', post: `/admin/games/${game.id}/review`, reload: true })}</div>`
    : '<p class="aui-muted">Publishing comes after the game file is imported.</p>';
  const del = `<div class="aui-panel agd-danger"><span class="aui-cell__stack"><span class="aui-cell__title">Delete game</span><span class="aui-cell__sub">Removes the game and every player’s stats from it. This can’t be undone.</span></span>
    ${button('Delete game…', { kind: 'danger', attrs: `data-post-json="/admin/games/${id}" data-method="DELETE" data-then="/admin/games" data-done="Game deleted." data-confirm data-confirm-title="Delete ${attr(`${game.team_a_name} vs ${game.team_b_name}`)}?" data-confirm-body="Every player’s stats from this game go too. This can’t be undone." data-confirm-send="Delete game"` })}</div>`;
  return `${section({ title: 'Game', note: '· date, tip-off, type, overtime and court', bodyHtml: gameForm })}
    ${section({ title: 'On the site', bodyHtml: publish })}
    ${st === 'live' || st === 'draft' ? section({ title: 'Stat corrections', note: '· every change to the box score', bodyHtml: `<div class="aui-panel">${correctionsList(statCorrections, nameById)}</div>` }) : ''}
    ${section({ title: 'Danger zone', bodyHtml: del })}
    ${saveBar({ label: 'Save game', form: 'game-settings' })}`;
}

// The scorer (server.js adminScoringPanel; replaces importing a wknd-stats file). Turn scoring on
// and pick up to 2 scorers; once plays come in, the quick review: the scored total against the
// official score, every play with Remove, who didn't play, then Publish. The full screen for an
// admin on a laptop or tablet: /admin/games/:id/score.
function scoringTab({ game, sc, colors }) {
  const base = `/admin/games/${game.id}`;
  const scorerForm = `<form id="scoring-setup" class="aui-stack" data-json-action="${base}/scoring" data-then="${base}?tab=scoring" data-done="Saved.">
      ${playerPicker({ name: 'scorers[]', label: 'Scorers (up to 2)', options: sc.options, selected: sc.scorers, placeholder: 'Search players' })}
      <div class="aui-field"><span class="aui-field__label">Waves</span>${segmented({ name: 'waves', value: sc.waves || (game.game_type === 'playoff' ? 'off' : 'first half'), label: 'Waves', options: [['off', 'Off'], ['first half', 'First half'], ['whole game', 'Whole game']] })}
        <span class="aui-field__help">Regular season: first half. Playoffs: off.</span></div>
      <div>${button(sc.on ? 'Save scorers' : 'Turn on scoring', { kind: 'primary', type: 'submit' })}</div>
    </form>`;
  // Played without the scorer (only a final score): review it to fill in the plays.
  const finalOnly = (Number(game.team_a_score) || 0) + (Number(game.team_b_score) || 0) > 0 || game.status === 'final' || game.status === 'complete';
  if (!sc.on && finalOnly) {
    const go = (label, kind, then, k) => button(label, { kind: k, attrs: `data-post-json="${base}/scoring/review" data-body="${attr(JSON.stringify({ action: 'start', kind }))}" data-then="${then}"` });
    return section({ title: 'Review', note: '· this game has a final score but no plays', bodyHtml: `<div class="aui-panel aui-stack">
      <p><b>${escHtml(game.team_a_name)} ${Number(game.team_a_score) || 0}–${Number(game.team_b_score) || 0} ${escHtml(game.team_b_name)}</b> is the result, and stays the result.</p>
      <p class="aui-muted">Add the plays to fill in the box score: re-track them from the video, or enter them from your notes. Nobody gets a bell, and the site doesn’t show it as a live score while you work.</p>
      <div class="agd-rv__acts">${go('Re-track from the video', 'video', `${base}/score?pass=video`, game.youtube_url ? 'primary' : 'secondary')} ${go('Enter the plays', 'plays', `${base}/score`, game.youtube_url ? 'secondary' : 'primary')}</div>
      ${game.youtube_url ? '' : '<p class="aui-muted">No video on this game yet: add its YouTube link on the Game tab to re-track from it.</p>'}</div>` });
  }
  if (!sc.on) {
    return section({ title: 'Scoring', note: '· score this game live in the app instead of importing a wknd-stats file', bodyHtml: `<div class="aui-panel">
      <p class="aui-muted">Turn scoring on, pick who scores it, and they get it in the app under Me → Score a game. Admins can always score it, from the app or from this page.</p>
      ${scorerForm}</div>` });
  }
  const statusLine = { setup: 'Ready. No plays yet.', live: `Scoring has started · ${sc.period}`, review: 'In review', published: 'Published' }[sc.status] || sc.status;
  const open = button('Open the scorer', { kind: 'secondary', href: `${base}/score` });
  const rv = sc.review || {}, lock = rv.lock;
  // Someone else has the review: everything that changes it is read-only here.
  const lockedOut = !!lock && !lock.mine;
  const reviewCard = reviewSection({ game, sc, base });
  // Late plays (after the end, after publishing, or from a phone that was taken over): set aside
  // until an admin adds them or leaves them out.
  const importBox = lockedOut || sc.status === 'published' ? '' : `<div class="agd-import"><label class="aui-btn aui-btn--ghost aui-btn--sm">Import a phone’s plays…<input type="file" accept=".json,application/json" hidden data-import-plays="${base}/scoring/import"></label>
      <span class="aui-muted">The file from a scorer’s ⋯ → Send my plays, when their phone couldn’t send. They land here as late plays.</span></div>
    <script>document.querySelectorAll('[data-import-plays]').forEach(function (inp) { inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; f.text().then(function (t) { var file; try { file = JSON.parse(t); } catch (e) { alert('That isn’t a plays file.'); return; } return fetch(inp.getAttribute('data-import-plays'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: file }) }).then(function (r) { return r.json(); }).then(function (d) { location.href = location.pathname + '?tab=scoring&toast=' + encodeURIComponent(d.message || d.error || 'Done.'); }); }); }; });</script>`;
  const lateCard = !(sc.late && sc.late.length) ? (importBox ? section({ title: 'Late plays', note: '· none', bodyHtml: `<div class="aui-panel aui-stack">${importBox}</div>` }) : '') : section({ title: 'Late plays', note: `· ${sc.late.length} set aside`, bodyHtml: `<div class="aui-panel aui-stack">${importBox}
        <p class="aui-muted">Sent after the final score was saved, after publishing, or from a phone whose side another scorer took over. They’re not in the game until you add them, so nothing doubles up.</p>
        ${dataGrid({ baseUrl: base, keep: { tab: 'scoring' }, perPage: 200, noun: ['play', 'plays'], minimal: true, rows: sc.late, rowKey: r => r.id,
          columns: [{ key: 'when', label: 'When', cell: r => escHtml(r.when) }, { key: 'text', label: 'Play', primary: true, cell: r => escHtml(r.text) }, { key: 'by', label: 'Phone', cell: r => escHtml(r.by) }] })}
        ${lockedOut ? '' : `<div>${sc.status === 'published' ? '' : button('Add them to the game', { kind: 'secondary', size: 'sm', attrs: `data-post-json="${base}/scoring/late" data-body="${attr(JSON.stringify({ action: 'add' }))}" data-then="${base}?tab=scoring"` })} ${button('Leave them out', { kind: 'ghost', size: 'sm', attrs: `data-post-json="${base}/scoring/late" data-body="${attr(JSON.stringify({ action: 'drop' }))}" data-then="${base}?tab=scoring"` })}</div>`}</div>` });
  if (sc.status === 'published') {
    const undo = sc.canUnpublish ? button('Undo publish…', { kind: 'secondary', size: 'sm', attrs: `data-post-json="${base}/scoring/unpublish" data-then="${base}?tab=scoring" data-confirm data-confirm-title="Undo this publish?" data-confirm-body="The game goes back to exactly what it had before publishing (score, box score, who didn’t play), and scoring reopens so the plays can be fixed and published again." data-confirm-send="Undo publish"` }) : '';
    return `${banner('ok', `Published from the scorer: ${game.team_a_name} ${sc.finalScore ? sc.finalScore.a : sc.score.a}, ${game.team_b_name} ${sc.finalScore ? sc.finalScore.b : sc.score.b}.`, undo)}
      ${reviewCard}
      ${lateCard}
      ${section({ title: 'Plays', note: `· ${sc.plays.length}`, bodyHtml: playsGrid(sc, base, false) })}`;
  }
  const notPlayed = sc.roster.filter(p => !p.played);
  const dnpForm = lockedOut ? `<p class="aui-muted">${sc.dnp.length ? `Didn’t play: ${sc.dnp.length}.` : 'Nobody marked yet.'} ${escHtml(lock.name)} is reviewing.</p>` : `<form id="scoring-dnp" class="aui-stack" data-json-action="${base}/scoring/dnp" data-then="${base}?tab=scoring" data-done="Saved.">
      ${playerPicker({ name: 'dnp[]', label: 'Didn’t play', options: notPlayed.map(p => ({ id: p.id, name: p.name, color: colors[p.team] || '', meta: p.team === 'a' ? game.team_a_name : game.team_b_name })), selected: sc.dnp, placeholder: 'Players with no plays' })}
      <div>${button('Save', { kind: 'secondary', type: 'submit' })}</div></form>`;
  // The final score: typed as always (it settles Who wins? straight away), then publish. Plays
  // that don't add up to it never block publishing; the final score stays the result.
  const fin = sc.finalScore;
  const off = fin && (fin.a !== sc.score.a || fin.b !== sc.score.b);
  const finalForm = `<form id="scoring-final" class="aui-stack" data-json-action="${base}/final" data-then="${base}?tab=scoring" data-done="Final score saved. Who wins? is settled.">
      ${fieldGrid(`${field({ label: `Final ${game.team_a_name}`, name: 'team_a_score', type: 'number', value: fin ? fin.a : '', placeholder: String(sc.score.a), required: true })}${field({ label: `Final ${game.team_b_name}`, name: 'team_b_score', type: 'number', value: fin ? fin.b : '', placeholder: String(sc.score.b), required: true })}`)}
      <input type="hidden" name="overtime" value="${attr(game.overtime || 0)}">
      <div>${button(fin ? 'Update the final score' : 'Save the final score', { kind: 'secondary', type: 'submit' })}</div></form>`;
  const publishForm = `<form id="scoring-publish" class="aui-stack" data-json-action="${base}/scoring/publish" data-then="${base}?tab=scoring"
        data-confirm data-confirm-title="Publish this game?" data-confirm-body="${attr(sc.livePublic === false ? 'Its box score, quarter scores and play-by-play are saved, hidden from players until you switch Visible to everyone on.' : 'Its box score, quarter scores and play-by-play go on the site and in the app, and rating asks go out. Like an import, it shows straight away.')}" data-confirm-send="Publish">
      ${sc.video ? `<div class="aui-field"><span class="aui-field__label">Publish</span>${segmented({ name: 'pass', value: sc.pass, label: 'Which track to publish', options: [['video', `Video re-track · ${sc.video.score.a}–${sc.video.score.b}`], ['live', `Live track · ${sc.liveScore.a}–${sc.liveScore.b}`]] })}</div>` : ''}
      <p class="aui-muted">${sc.video ? (sc.pass === 'video' ? 'Video re-track' : 'Live track') : 'The plays'} add up to <b>${escHtml(game.team_a_name)} ${sc.score.a} – ${sc.score.b} ${escHtml(game.team_b_name)}</b>.${fin ? (off ? ` The final score is ${fin.a}–${fin.b}: it stays the result, and you can still publish.` : ' It matches the final score.') : ' Save the final score first if you have it.'}</p>
      ${sc.checks && sc.checks.length ? `<div class="agd-checks"><b>Worth a look before publishing</b><ul>${sc.checks.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul></div>` : '<p class="aui-muted">✓ No odd lines: no plays after a foul-out, no DNP with stats, assists fit the baskets.</p>'}
      <div>${button('Publish', { kind: 'primary', type: 'submit' })}</div>
    </form>`;
  // The video re-track: an admin scores the game again from the video, from tip-off. It never
  // shows on the live score; the compare below shows where it differs from the live track.
  const videoHref = `${base}/score?pass=video`;
  const videoPanel = sc.video
    ? `<p class="aui-muted">${sc.video.count} play${sc.video.count === 1 ? '' : 's'} so far: <b>${escHtml(game.team_a_name)} ${sc.video.score.a} – ${sc.video.score.b} ${escHtml(game.team_b_name)}</b>. Live track: ${sc.liveScore.a}–${sc.liveScore.b}.</p>
      <div>${button('Continue the re-track', { kind: 'secondary', href: videoHref })}</div>`
    : `<p class="aui-muted">Score the game again from the video, from tip-off. It never shows on the live score. When it’s done, compare it with the live track and publish the one you trust.${sc.hasVideo ? '' : ' This game has no video link: watch it on another screen and the scorer runs its own clock.'}</p>
      <div>${button('Start the video re-track', { kind: 'secondary', href: videoHref })}</div>`;
  const KEYS = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '3PM', 'FTM'];
  const compare = sc.video ? (sc.compare.length
    ? `<div class="aui-table-wrap"><table class="aui-table"><thead><tr><th>Player</th>${KEYS.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>
      ${sc.compare.map(r => `<tr><td><span class="aui-dot" style="background:${attr(colors[r.team] || '')}"></span>${escHtml(r.name)}</td>${KEYS.map(k => { const d = r.diffs.find(x => x.label === k); return `<td>${d ? `${d.live} → <b>${d.video}</b>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div><p class="aui-muted">Live → video. Only the numbers that differ.</p>`
    : `<div class="aui-panel"><p class="aui-muted">Every player’s line is the same in both tracks.</p></div>`) : '';
  return `${reviewCard}
    ${section({ title: 'Scoring', note: `· ${statusLine}`, asideHtml: open, bodyHtml: `<div class="aui-panel">${scorerForm}</div>` })}
    ${lateCard}
    ${(sc.plays.length || sc.video) && !lockedOut ? section({ title: 'Video re-track', bodyHtml: `<div class="aui-panel aui-stack">${videoPanel}</div>` }) : ''}
    ${sc.video ? section({ title: 'Live vs video', note: `· ${sc.compare.length} player${sc.compare.length === 1 ? '' : 's'} differ`, bodyHtml: compare }) : ''}
    ${section({ title: 'Final score', note: '· settles Who wins? straight away', bodyHtml: `<div class="aui-panel">${lockedOut ? `<p class="aui-muted">${fin ? `${escHtml(game.team_a_name)} ${fin.a} – ${fin.b} ${escHtml(game.team_b_name)}.` : 'Not saved yet.'} ${escHtml(lock.name)} is reviewing.</p>` : finalForm}</div>` })}
    ${sc.plays.length && !lockedOut ? section({ title: 'Publish', note: '· the plays become the box score', bodyHtml: `<div class="aui-panel">${publishForm}</div>` }) : ''}
    ${sc.plays.length ? section({ title: 'Plays', note: `· ${sc.video ? (sc.pass === 'video' ? 'video re-track, ' : 'live track, ') : ''}${sc.plays.length}, newest first`, asideHtml: lockedOut ? '' : button('Fix plays in the scorer', { kind: 'ghost', size: 'sm', href: sc.pass === 'video' ? videoHref : `${base}/score` }), bodyHtml: playsGrid(sc, base, !lockedOut) }) : ''}
    ${sc.removed && sc.removed.length ? section({ title: 'Removed plays', note: `· ${sc.removed.length}, kept on record`, bodyHtml: `<div class="aui-panel"><ul class="agd-removed">${sc.removed.map(r => `<li><span class="aui-muted">${escHtml(r.when)}</span> ${escHtml(r.text)} <span class="aui-muted">· removed by ${escHtml(r.by)}</span></li>`).join('')}</ul></div>` }) : ''}
    ${sc.plays.length ? section({ title: 'Who didn’t play', bodyHtml: `<div class="aui-panel">${dnpForm}</div>` }) : ''}`;
}
// The review card: who's reviewing and how far (a progress bar over its steps), Start / Hand
// over / Close for the reviewer, Ask to take over for the others (Take over for a super admin),
// and the Visible to everyone switch (live score + the published game).
function reviewSection({ game, sc, base }) {
  const rv = sc.review || {}, lock = rv.lock, prog = rv.progress || { pct: 0, steps: [] };
  const post = (label, body, { kind = 'secondary', confirm = null, done = '' } = {}) => button(label, { kind, size: 'sm', attrs: `data-post-json="${base}/scoring/review" data-body="${attr(JSON.stringify(body))}" data-then="${base}?tab=scoring"${done ? ` data-done="${attr(done)}"` : ''}${confirm ? ` data-confirm data-confirm-title="${attr(confirm.title)}" data-confirm-body="${attr(confirm.body)}" data-confirm-send="${attr(confirm.send)}"` : ''}` });
  const steps = `<div class="agd-rv__steps">${prog.steps.map(x => `<span class="agd-rv__step${x.done >= 1 ? ' is-done' : x.done > 0 ? ' is-part' : ''}">${x.done >= 1 ? '✓ ' : ''}${escHtml(x.label)}${x.done > 0 && x.done < 1 ? ` ${Math.round(x.done * 100)}%` : ''}</span>`).join('')}</div>`;
  const bar = progress(prog.pct, { label: sc.status === 'published' ? `Done${rv.reviewedBy ? ` · reviewed by ${rv.reviewedBy}` : ''}` : `${prog.pct}%${prog.next ? ` · next: ${prog.next}` : ''}` });
  const kindLabel = k => (k === 'video' ? 're-tracking from the video' : 'checking the plays');
  let head = '', actions = '';
  if (sc.status === 'published') head = `<p class="aui-muted">Published${rv.reviewedBy ? ` by ${escHtml(rv.reviewedBy)}` : ''}.</p>`;
  else if (!lock) {
    head = '<p class="aui-muted">Nobody is reviewing it. Starting locks the review to you until you close it or hand it over, and the other admins get a bell.</p>';
    actions = `${post('Start review', { action: 'start', kind: 'plays' }, { kind: 'primary' })} ${button('Re-track from video', { kind: 'secondary', size: 'sm', href: `${base}/score?pass=video` })}`;
  } else if (lock.mine) {
    head = `<p><b>You’re reviewing</b> <span class="aui-muted">· ${kindLabel(lock.kind)}</span></p>`;
    const hand = rv.admins && rv.admins.length ? `<form class="agd-rv__hand" data-json-action="${base}/scoring/review" data-then="${base}?tab=scoring">
        <input type="hidden" name="action" value="handover">${field({ label: 'Hand over to', name: 'to', type: 'select', options: rv.admins.map(a => [a.playerId, a.name]) })}
        ${button('Hand over', { kind: 'secondary', size: 'sm', type: 'submit' })}</form>` : '';
    actions = `${lock.ask ? banner('warn', `${lock.ask.name} asks to take over the review.`, `${post('Hand it over', { action: 'answer', yes: true }, { kind: 'primary' })} ${post('Keep it', { action: 'answer', yes: false })}`) : ''}
      ${hand}<div>${post('Close the review', { action: 'finish' }, { kind: 'ghost', confirm: { title: 'Close the review?', body: 'It unlocks, so any admin can pick it up. Nothing you did is lost.', send: 'Close it' } })}</div>`;
  } else {
    head = `<p><b>${escHtml(lock.name)} is reviewing</b> <span class="aui-muted">· ${kindLabel(lock.kind)}</span></p>`;
    actions = `${lock.ask ? `<p class="aui-muted">${lock.ask.mineAsk ? `You asked ${escHtml(lock.name)} to hand it over.` : `${escHtml(lock.ask.name)} asked to take over.`}</p>` : post(`Ask ${lock.name} to hand it over`, { action: 'ask' })}
      ${rv.superAdmin ? post('Take over', { action: 'take' }, { kind: 'ghost', confirm: { title: `Take over from ${lock.name}?`, body: `${lock.name} gets a bell that you took the review.`, send: 'Take over' } }) : ''}`;
  }
  const lockedOut = !!lock && !lock.mine && sc.status !== 'published';
  // A review watched live (temporary, admins only, never in the feed): reviews only.
  const watch = sc.status !== 'published' && (sc.reviewOnly || lock) ? `${toggleRow({ label: 'Watch it live while reviewing', name: 'reviewLive', on: !!sc.reviewLive, post: `${base}/scoring/review-live`, reload: true,
      help: 'A review under way can always be watched live by admins (and shows on their Home). This switch keeps it watchable when nobody is reviewing. Off by default. On: the game page shows the plays as a live game, to admins only. Never in the feed, the ticker or the homepage, and nobody gets a bell. It switches off when the review closes or the game is published.' })}
    ${sc.reviewLive ? `<p class="aui-muted">Open it: <a href="/games/${encodeURIComponent(sc.slug || game.id)}?review=live" target="_blank" rel="noopener">on the site</a> · <a href="/app/games/${encodeURIComponent(game.id)}?review=live" target="_blank" rel="noopener">in the app</a></p>` : ''}` : '';
  const visible = lockedOut ? `<p class="aui-muted">Visible to everyone: <b>${sc.livePublic !== false ? 'on' : 'off'}</b>.</p>` : toggleRow({ label: 'Visible to everyone', name: 'visible', on: sc.livePublic !== false, post: `${base}/scoring/visible`, reload: true,
    help: 'On: the live score shows while it’s scored, and the game shows when published. Off: only admins see either, so you can check it first, or switch it on to see the player side. A fresh game that’s on, with no final score yet, bells both teams and everyone who picked it when the scorer starts the clock.' });
  return section({ title: 'Review', note: lock ? `· ${lock.mine ? 'you' : lock.name}, ${prog.pct}%` : sc.status === 'published' ? '· done' : '· not started', bodyHtml: `<div class="aui-panel aui-stack agd-rv">${head}${bar}${steps}${actions ? `<div class="agd-rv__acts">${actions}</div>` : ''}${visible}${watch}</div>` });
}
function playsGrid(sc, base, editable) {
  return dataGrid({
    baseUrl: base, keep: { tab: 'scoring' }, perPage: 500, noun: ['play', 'plays'], minimal: true,
    rows: sc.plays, rowKey: r => r.id,
    columns: [
      { key: 'when', label: 'When', cell: r => escHtml(r.when) },
      { key: 'text', label: 'Play', primary: true, cell: r => escHtml(r.text) },
      { key: 'by', label: 'By', phone: false, cell: r => `<span class="aui-muted">${escHtml(r.by || '')}</span>` },
      { key: 'score', label: 'Score', num: true, cell: r => escHtml(r.score) },
    ],
    rowMenu: editable ? r => [{ label: 'Remove play…', danger: true, post: `${base}/scoring/void`, body: { eventId: r.id, pass: sc.pass }, then: `${base}?tab=scoring`, done: 'Play removed.',
      confirm: { title: 'Remove this play?', body: `${r.text}. The scores after it update. A removed play stays on record.`, send: 'Remove' } }] : null,
    empty: { title: 'No plays yet', sub: 'They show here as the scorer taps.' },
  });
}

export function adminGameDetailBody({ game, tab = 'box', stats = [], dnpPlayers = [], quarterScores = [], statCorrections = [], picksPanel = null, players = [], teams = [], colorById = {}, box, courts = [], scoring = null }) {
  const st = gameState(game);
  const colorByName = Object.fromEntries(teams.map(t => [String(t.name).toUpperCase(), t.color || '']));
  const colorOfTeam = name => colorByName[String(name || '').toUpperCase()] || '';
  const colors = { a: colorOfTeam(game.team_a_name), b: colorOfTeam(game.team_b_name) };
  const nameById = Object.fromEntries(players.map(p => [p.id, displayPlayerName(p.name || '')]));

  // The player of the game as the site shows it: picked by hand, else the winners' top PER.
  const a = n(game.team_a_score), b = n(game.team_b_score);
  const winner = String(a >= b ? game.team_a_name : game.team_b_name).toUpperCase();
  const autoPotg = stats.filter(s => String(s.team_name || '').toUpperCase() === winner).sort((x, y) => perOf(y) - perOf(x))[0]?.player_id || '';
  // [POTG, co-POTG?] for the box score's badges.
  const potgId = st === 'live' || st === 'draft' ? [game.manual_potg_player_id || autoPotg, game.co_potg_player_id].filter(Boolean) : [];

  const missing = contentChecks(game).filter(([, ok]) => !ok).length;
  const tabs = [
    ['box', st === 'upcoming' || st === 'score' ? 'Results' : 'Box score', ''],
    ['content', 'Content', missing && st !== 'upcoming' ? `${missing} missing` : ''],
    ['picks', 'Picks', picksPanel?.picks.length ? String(picksPanel.picks.length) : ''],
    ['scoring', 'Scoring', ''],
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
    scoring: () => (scoring ? scoringTab({ game, sc: scoring, colors }) : ''),
    settings: () => settingsTab({ game, st, statCorrections, nameById, courts }),
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
