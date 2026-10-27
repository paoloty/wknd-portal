// /admin/scorers (Game Day → Scorers, 2026-10-27): who can score any game with scoring on (the
// player's Scorer switch, players.is_scorer), on one page, with what they've scored and every
// practice game they've played in the app (practice_log). Admins are listed only when switched
// on: being an admin doesn't make you a scorer (Paolo).
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, section, avatar, badge, button, playerPicker, emptyState } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtTime = ts => (ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '');
const fmtDay = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : '');
const mins = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

// scorers: [{ id, name, team, color, admin, games, lastGame, lastAt, practices, lastPractice }]
// candidates: players who aren't scorers yet, for the Add picker: [{ id, name, color, meta }]
// practice: practice_log rows with name / color: [{ …row, name, color }]
export function adminScorersBody({ scorers = [], candidates = [], practice = [], query = {} }) {
  const add = `<form class="aui-panel aui-stack" data-json-action="/admin/scorers/add" data-then="/admin/scorers" data-done="Scorer added.">
      ${playerPicker({ name: 'player_id', label: 'Player', options: candidates, multiple: false, placeholder: 'Type a player’s name' })}
      <div>${button('Add', { kind: 'primary', type: 'submit' })}</div>
    </form>`;
  const grid = dataGrid({
    id: 'scorers', baseUrl: '/admin/scorers', query, minimal: true,
    rows: scorers, rowKey: s => s.id, noun: ['scorer', 'scorers'], perPage: 50,
    search: { placeholder: 'Search scorers', text: s => `${s.name} ${s.team}` },
    defaultSort: 'name',
    columns: [
      { key: 'name', label: 'Scorer', primary: true, sort: s => s.name.toLowerCase(), cell: s => `<span class="aui-who">${avatar(s.name, s.color, { size: 26, playerId: s.id })}<a class="aui-cell__title" href="/admin/players/${attr(s.id)}">${escHtml(s.name)}</a>${s.admin ? ` ${badge('Admin')}` : ''}</span>` },
      { key: 'team', label: 'Team', sort: s => s.team, cell: s => escHtml(s.team || '–') },
      { key: 'games', label: 'Games scored', num: true, sort: s => s.games, cell: s => String(s.games) },
      { key: 'last', label: 'Last scored', sort: s => s.lastAt || 0, cell: s => (s.lastGame ? `${escHtml(s.lastGame)} <span class="aui-muted">· ${escHtml(fmtDay(s.lastAt))}</span>` : '<span class="aui-muted">Not yet</span>') },
      { key: 'practice', label: 'Practice', sort: s => s.practices, cell: s => (s.practices ? `${s.practices} game${s.practices === 1 ? '' : 's'} <span class="aui-muted">· ${escHtml(fmtDay(s.lastPractice))}</span>` : '<span class="aui-muted">Not yet</span>') },
      { key: 'act', label: '', bare: true, cell: s => button('Remove', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/players/${attr(s.id)}/scorer" data-body="${attr(JSON.stringify({ on: false }))}" data-then="/admin/scorers" data-done="${attr(s.name)} is no longer a scorer." data-confirm data-confirm-title="Remove ${attr(s.name)} as a scorer?" data-confirm-body="They can still score the games they're picked for." data-confirm-send="Remove"` }) },
    ],
    empty: { title: 'No scorers yet', sub: 'Add a player above. Scorers can score any game with scoring turned on.' },
  });
  const now = Date.now();
  const log = practice.length ? dataGrid({
    id: 'practice', baseUrl: '/admin/scorers', query, minimal: true, keep: {},
    rows: practice, rowKey: p => p.id, noun: ['practice game', 'practice games'], perPage: 25,
    defaultSort: '-when',
    columns: [
      { key: 'who', label: 'Who', primary: true, sort: p => p.name.toLowerCase(), cell: p => `<span class="aui-who">${avatar(p.name, p.color, { size: 26, playerId: p.player_id })}<span class="aui-cell__title">${escHtml(p.name)}</span></span>` },
      { key: 'teams', label: 'Teams', cell: p => `${escHtml(p.team_a)} vs ${escHtml(p.team_b)} <span class="aui-muted">· ${p.period_min}-min quarters</span>` },
      { key: 'got', label: 'Got to', cell: p => `${escHtml(p.period || 'Q1')} · ${p.score_a}–${p.score_b} <span class="aui-muted">· ${p.plays} play${p.plays === 1 ? '' : 's'}${p.tips_done ? ` · ${p.tips_done} tip${p.tips_done === 1 ? '' : 's'} done` : ''}</span>` },
      { key: 'end', label: 'Ended', bare: true, cell: p => (p.finished ? badge('Finished', 'green') : p.reset ? badge('Reset') : now - p.updated_at < 15 * 60000 ? badge('Playing', 'amber') : badge('Left')) },
      { key: 'when', label: 'When', num: true, sort: p => p.started_at, cell: p => `${escHtml(fmtTime(p.started_at))} <span class="aui-muted">· ${escHtml(mins(p.updated_at - p.started_at))}</span>` },
    ],
  }) : emptyState({ title: 'No practice games yet', sub: 'Scorers find Practice game under Me → Scoring in the app. Each one shows up here.' });
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Game Day', title: 'Scorers', sub: 'Players who can score any game with scoring turned on. Admins are added like anyone else; reviewing and finishing a game stay admin jobs and don’t need this.' })}
    ${section({ title: 'Add a scorer', bodyHtml: add })}
    ${section({ title: 'Scorers', note: `· ${scorers.length}`, bodyHtml: grid })}
    ${section({ title: 'Practice games', note: `· ${practice.length}`, bodyHtml: log })}
  </div>`;
}
