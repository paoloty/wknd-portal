import { escHtml } from './layout.js';
import { displayPlayerName, teamColor, initials, playerPhotoUrl, shareIcon, avatarStack } from './utils.js';
import { swipeScript } from './games.js';
import { summaryPanel, sectionPanel, sectionRegenScript } from './home.js';

// /mvp: the race as player cards (the shared .pl-card look: team glare, faded photo
// backdrop, avatar ring, first over LASTNAME). #1 is a wide card with #2–#3 beside it,
// #4–#10 a scrolling row of smaller cards ("The chase"). Styles: styles.css "MVP Race
// page" (mv- prefix, plus the mvpx- head / admin / photo-dialog rules).

const RANK_LABELS = ['', 'FRONTRUNNER', 'CLOSE SECOND', 'IN THE MIX'];

// The races this page renders: the MVP Race (/mvp) and the Best Defender race (/dpoy). Same
// cards, scoring flow and share/writeup plumbing (server.js RACES); only the wording, the
// stat set and the endpoints differ. Stat keys come from perGame().
export const RACES = {
  mvp: {
    key: 'mvp', path: '/mvp', name: 'MVP Race', short: 'MVP', finalists: 'MVP Finalists',
    scoreLabel: 'MVP score', scoresNoun: 'MVP scores', award: 'Most Valuable Player',
    how: "Per game: points + 0.8×rebounds + 0.9×assists + 1.5×steals + 2×blocks − turnovers. That's then scaled by shooting efficiency (true shooting %), team win rate, and games played, so a hot two-game stretch can't top a full season.",
    tiles: ['ppg', 'rpg', 'apg', 'spg', 'ts'], foot: ['ppg', 'rpg', 'apg', 'ts'], snap: ['ppg', 'rpg', 'apg', 'spg', 'ts'],
    dl: 'wknd-mvp-race.png', shareTitle: 'WKND MVP Race', photoLabel: 'MVP Race photo',
  },
  dpoy: {
    key: 'dpoy', path: '/dpoy', name: 'Best Defender Race', short: 'Best Defender', finalists: 'Best Defender Finalists',
    scoreLabel: 'Defense score', scoresNoun: 'defense scores', award: 'Best Defender', imgTitle: 'BEST DEFENDER RACE',
    how: "Per game: 1.5×steals + 2×blocks + 0.3×rebounds − 0.3×fouls. That's then scaled by team win rate and games played, so a hot two-game stretch can't top a full season.",
    tiles: ['spg', 'bpg', 'stk', 'rpg', 'pf'], foot: ['spg', 'bpg', 'rpg', 'pf'], snap: ['spg', 'bpg', 'stk', 'rpg', 'pf'], card: ['spg', 'bpg', 'rpg', 'pf'],
    dl: 'wknd-best-defender-race.png', shareTitle: 'WKND Best Defender Race', photoLabel: 'Race photo',
  },
};
const STAT_LABEL = { ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG', stk: 'STK', pf: 'PF', ts: 'TS%' };
const raceOf = key => RACES[key] || RACES.mvp;

// Admin-only, hidden once playoffs lock every writeup.
function regenBtn(playerId, season, isAdmin, playoffsStarted) {
  if (!isAdmin || playoffsStarted) return '';
  return `<button type="button" class="mvpx-admin-btn mvp-regen-btn" data-pid="${escHtml(String(playerId))}" data-season="${escHtml(String(season))}" title="Regenerate writeup">↺</button>`;
}

// Admin-only photo picker trigger (dialog + script at the bottom of the page). The picked
// photo is the card's faded backdrop; the avatar stays the profile photo.
function photoBtn(c, isAdmin) {
  if (!isAdmin) return '';
  return `<button type="button" class="mvpx-admin-btn mvpx-photo-btn" data-pid="${escHtml(String(c.player.id))}" data-name="${escHtml(displayPlayerName(c.player.name))}">Photo</button>`;
}

// Week-over-week movement pill. prevRank: undefined = no earlier week to compare (render
// nothing), null = wasn't in last week's pool (NEW), number = last week's rank.
// Also used by the homepage MVP card (views/home.js).
export function moveBadge(rank, prevRank) {
  if (prevRank === undefined) return '';
  if (prevRank === null) return `<span class="mvp-move mvp-move--new" title="New this week">NEW</span>`;
  const delta = prevRank - rank;
  const prev  = `<span class="mvp-move__prev">Last week #${prevRank}</span>`;
  if (delta > 0) return `<span class="mvp-move mvp-move--up">▲${delta}</span>${prev}`;
  if (delta < 0) return `<span class="mvp-move mvp-move--down">▼${-delta}</span>${prev}`;
  return `<span class="mvp-move mvp-move--same">–</span>${prev}`;
}

// Movement as text: `short` for the chase cards, otherwise a phrase for #1–#3.
function moveText(rank, prevRank, short = false) {
  if (prevRank === undefined) return { text: '', cls: '' };
  if (prevRank === null) return { text: short ? 'NEW' : 'New to the race this week', cls: 'is-new' };
  const d = prevRank - rank;
  if (d > 0) return { text: short ? `▲${d}` : `▲${d} from #${prevRank} last week`, cls: 'is-up' };
  if (d < 0) return { text: short ? `▼${-d}` : `▼${-d} from #${prevRank} last week`, cls: 'is-down' };
  return { text: short ? '–' : `Held #${rank} from last week`, cls: 'is-same' };
}

// Faded backdrop: the admin's MVP photo override (crop in --x/--y/--z, phone crop in
// --mx/--my/--mz, swapped by .mvpx-img at the phone breakpoint), else the profile photo.
function backdrop(c) {
  const p = c.photo || { url: playerPhotoUrl(String(c.player.id)), x: 50, y: 25, zoom: 1 };
  const m = p.phone || p;
  const vars = `--x:${p.x}%;--y:${p.y}%;--z:${p.zoom};--mx:${m.x}%;--my:${m.y}%;--mz:${m.zoom}`;
  const img = `<img class="mvpx-img" src="${escHtml(p.url)}" alt="" loading="lazy" style="${vars}" onerror="this.remove()">`;
  return `<span class="mv-card__bg" aria-hidden="true">${m.url && m.url !== p.url ? `<picture><source media="(max-width: 720px)" srcset="${escHtml(m.url)}">${img}</picture>` : img}</span>`;
}

function splitName(raw) {
  const s = String(raw || '');
  const i = s.indexOf(',');
  return i === -1 ? { first: '', last: s.toUpperCase() } : { first: s.slice(i + 1).trim(), last: s.slice(0, i).trim().toUpperCase() };
}

// Avatar ring + first over LASTNAME + team line (the shared .pl-av / .pl-card__* pieces).
function who(c, { avCls = '', extra = '' } = {}) {
  const { first, last } = splitName(c.player.name);
  const team = String(c.stats.team_name || '').toUpperCase();
  const num = c.player.number !== '' && c.player.number != null ? ` · #${escHtml(String(c.player.number))}` : '';
  return `<span class="pl-av${avCls}"><span>${escHtml(initials(displayPlayerName(c.player.name)))}</span><img src="${playerPhotoUrl(String(c.player.id), 192)}" alt="" loading="lazy" onerror="this.remove()"></span>
      <span class="pl-card__who">
        ${first ? `<span class="pl-card__first">${escHtml(first)}</span>` : ''}
        <span class="pl-card__last">${escHtml(last)}</span>
        <span class="pl-card__meta"><span class="pl-team"><i style="background:${teamColor(team)}"></i>${escHtml(team)}${num} · ${c.stats.gp} GP${extra}</span></span>
      </span>`;
}

function perGame(stats) {
  const gp = stats.gp || 1;
  const tsDenom = 2 * ((stats.fga || 0) + 0.44 * (stats.fta || 0));
  return {
    ppg: (stats.pts / gp).toFixed(1),
    rpg: (stats.reb / gp).toFixed(1),
    apg: (stats.ast / gp).toFixed(1),
    spg: (stats.stl / gp).toFixed(1),
    bpg: ((stats.blk || 0) / gp).toFixed(1),
    stk: (((stats.stl || 0) + (stats.blk || 0)) / gp).toFixed(1),
    pf:  ((stats.pf || 0) / gp).toFixed(1),
    ts:  tsDenom > 0 ? String(Math.round(stats.pts / tsDenom * 100)) : '—',
  };
}
const statsFoot = (pg, keys = RACES.mvp.foot) => `<span class="mv-card__foot">${keys.map(k => [STAT_LABEL[k], pg[k]])
  .map(([k, v]) => `<span class="pl-stat"><b class="font-condensed">${v}</b><small>${k}</small></span>`).join('')}</span>`;

const href = (c) => `/players/${encodeURIComponent(String(c.player.id))}`;
// The whole card links to the profile through a stretched link, so the admin buttons, the
// share icons and "Read the case" can sit inside the card as real buttons.
const cardLink = c => `<a href="${href(c)}" class="mv-card__link" aria-label="${escHtml(displayPlayerName(c.player.name))}’s profile"></a>`;
const adminTools = (c, ctx) => (ctx.isAdmin ? `<span class="mv-card__admin">${photoBtn(c, true)}${regenBtn(c.player.id, ctx.season, true, ctx.playoffsStarted)}</span>` : '');
const missing = (ctx, cls) => (ctx.isAdmin ? `<p class="${cls} is-muted">Writeup unavailable (AI provider error or quota). Try ↺ later.</p>` : '');

const SHARE_ICON = shareIcon(15);
const DL_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 19h14"/></svg>';
// Share / Download icons in a card's top row (page script: data-mv-share / data-mv-dl).
const shareIcons = (c, race = RACES.mvp) => {
  const pid = escHtml(String(c.player.id)), name = escHtml(displayPlayerName(c.player.name));
  return `<span class="mv-card__acts"><button type="button" class="mv-card__act" data-mv-share="${pid}" aria-label="Share ${name}’s ${race.short} card" title="Copy a link to this card">${SHARE_ICON}</button><button type="button" class="mv-card__act" data-mv-dl="${pid}" aria-label="Download ${name}’s ${race.short} card" title="Download this card">${DL_ICON}</button></span>`;
};

// ── The shareable snapshot ────────────────────────────────────────────────────
// One card as data: the case modal, the share page (/mvp/share/:id) and the share images
// (lib/leader-card-image.js renderMvp*) all draw from this, so they can't drift apart.
// move.dir: up | down | same | new | '' (no earlier week); move.text has no arrow.
// race 'dpoy' adds title / scoreLabel / cardStats for the share images (lib/leader-card-image.js).
export function mvpSnapshot(c, rank, top, { season, week = null, playoffsStarted = false, race = 'mvp' } = {}) {
  const r = raceOf(race);
  const pg = perGame(c.stats);
  const lead = top[0], second = top[1];
  const p = c.prevRank;
  const move = p === undefined ? { dir: '', text: '' }
    : p === null ? { dir: 'new', text: 'New this week' }
      : p > rank ? { dir: 'up', text: `${p - rank} from #${p}` }
        : p < rank ? { dir: 'down', text: `${rank - p} from #${p}` }
          : { dir: 'same', text: `Held #${rank}` };
  const gap = rank === 1
    ? (second ? `+${Math.max(0, c.mvpScore - second.mvpScore).toFixed(1)} clear` : '')
    : `${Math.max(0, lead.mvpScore - c.mvpScore).toFixed(1)} behind #1`;
  const extra = r.key === 'mvp' ? {} : {
    title: r.imgTitle, scoreLabel: r.scoreLabel.toUpperCase(), cardStats: r.card.map(k => [STAT_LABEL[k], pg[k]]),
  };
  return {
    kind: r.key, ...extra, season: String(season), week, asOf: playoffsStarted ? 'Final' : week ? `After week ${week}` : '',
    rank, label: RANK_LABELS[rank] || '', move, gap,
    record: rank === 1 && (c.stats.wins || c.stats.losses) ? `Team ${c.stats.wins}–${c.stats.losses}` : '',
    lead: { id: String(c.player.id), name: c.player.name, number: c.player.number ?? '', team: String(c.stats.team_name || '').toUpperCase(), gp: c.stats.gp, value: c.mvpScore.toFixed(1) },
    stats: r.snap.map(k => [STAT_LABEL[k], pg[k]]),
    writeup: c.writeup || '',
  };
}

const ARROW = { up: '▲', down: '▼', same: '', new: '' };
const MOVE_CLS = { up: 'is-up', down: 'is-down', same: 'is-same', new: 'is-new' };

// The full case, from a snapshot: the modal on /mvp and the body of the share page.
// opts.modal adds the close button; opts.actions adds Share / Download / Full profile.
export function mvpCaseHtml(s, { modal = false, actions = true } = {}) {
  const { first, last } = splitName(s.lead.name);
  const team = s.lead.team;
  const num = s.lead.number !== '' && s.lead.number != null ? ` · #${escHtml(String(s.lead.number))}` : '';
  const medal = s.rank <= 3 ? ` mv-card--r${s.rank}` : '';
  const badge = `#${s.rank}${s.label ? ` · ${s.label}` : ''}`;
  const pid = escHtml(s.lead.id);
  return `<div class="mv-case mv-card${medal}" style="--team:${teamColor(team)}">
    <span class="mv-card__bg" aria-hidden="true"><img class="mvpx-img" src="${playerPhotoUrl(s.lead.id)}" alt="" onerror="this.remove()"></span>
    <span class="mv-case__top">
      <span class="mv-card__tags"><span class="mvpx-badge${s.rank === 1 ? ' mvpx-badge--solid' : ''}">${escHtml(badge)}</span>${s.move.text ? `<span class="mvpx-move ${MOVE_CLS[s.move.dir] || ''}">${ARROW[s.move.dir] || ''}${escHtml(s.move.text)}</span>` : ''}</span>
      ${modal ? '<button type="button" class="mv-case__x" data-mv-close aria-label="Close">&times;</button>' : ''}
    </span>
    <span class="mv-card__id">
      <span class="pl-av mv-av--lg"><span>${escHtml(initials(`${first} ${last}`))}</span><img src="${playerPhotoUrl(s.lead.id, 192)}" alt="" onerror="this.remove()"></span>
      <span class="pl-card__who">
        ${first ? `<span class="pl-card__first">${escHtml(first)}</span>` : ''}
        <span class="pl-card__last">${escHtml(last)}</span>
        <span class="pl-card__meta"><span class="pl-team"><i style="background:${teamColor(team)}"></i>${escHtml(team)}${num} · ${s.lead.gp} GP${s.record ? ` · ${escHtml(s.record.toUpperCase())}` : ''}</span></span>
      </span>
      <span class="mv-card__score"><b class="font-condensed${s.rank === 1 ? ' is-lead' : ''}">${escHtml(s.lead.value)}</b><small>${escHtml(s.gap)}</small></span>
    </span>
    ${s.writeup ? `<p class="mv-case__text">${escHtml(s.writeup)}</p>` : ''}
    <span class="mv-card__foot">${s.stats.map(([k, v]) => `<span class="pl-stat"><b class="font-condensed">${escHtml(v)}</b><small>${k}</small></span>`).join('')}</span>
    ${actions ? `<span class="mv-case__acts">
      <button type="button" class="mv-case__btn mv-case__btn--primary" data-mv-share="${pid}">${SHARE_ICON}<span>Share</span></button>
      <button type="button" class="mv-case__btn" data-mv-dl="${pid}">${DL_ICON}<span>Download</span></button>
      <a href="/players/${encodeURIComponent(s.lead.id)}" class="mv-case__profile">Full profile &rarr;</a>
    </span>` : ''}
  </div>`;
}
// The modal's content waits in a <template> next to each card ("Read the case" clones it).
const caseTemplate = snap => `<template class="mv-case-tpl" data-pid="${escHtml(snap.lead.id)}">${mvpCaseHtml(snap, { modal: true })}</template>`;
const readMore = c => `<button type="button" class="mv-card__more" data-mv-case="${escHtml(String(c.player.id))}">Read the case <span aria-hidden="true">&rarr;</span></button>`;

// ── #1: the wide card ─────────────────────────────────────────────────────────
function leadCard(c, second, ctx, snap) {
  const pg   = perGame(c.stats);
  const move = moveText(1, c.prevRank);
  const rankNote = (r) => (r && r <= 5 ? `#${r} in league` : '');
  const tiles = ctx.race.tiles.map(k => [STAT_LABEL[k], pg[k], c.ranks?.[k]]);
  const clear = second ? Math.max(0, c.mvpScore - second.mvpScore).toFixed(1) : '';
  const rec = (c.stats.wins || c.stats.losses) ? ` · TEAM ${c.stats.wins}–${c.stats.losses}` : '';
  return `<article class="mv-card mv-card--lead mv-card--r1" style="--team:${teamColor(String(c.stats.team_name || ''))}">
    ${backdrop(c)}
    <span class="mv-card__ghost font-condensed" aria-hidden="true">1</span>
    <span class="mv-card__row"><span class="mv-card__tags"><span class="mvpx-badge mvpx-badge--solid">${RANK_LABELS[1]}</span>${move.text ? `<span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>` : ''}</span>${shareIcons(c, ctx.race)}</span>
    <span class="mv-card__id">
      ${who(c, { avCls: ' mv-av--xl', extra: rec })}
      <span class="mv-card__score mv-card__score--lead"><b class="font-condensed">${c.mvpScore.toFixed(1)}</b><small>${ctx.race.scoreLabel}${clear ? ` · +${clear} clear` : ''}</small></span>
    </span>
    <span class="mv-tiles">${tiles.map(([k, v, r]) => `<span class="mv-tile"><b class="font-condensed">${v}</b><small>${k}</small>${rankNote(r) ? `<em${r <= 2 ? ' class="is-top"' : ''}>${rankNote(r)}</em>` : ''}</span>`).join('')}</span>
    ${c.writeup ? `<p class="mv-card__case">${escHtml(c.writeup)}</p>` : missing(ctx, 'mv-card__case')}
    ${cardLink(c)}
    ${adminTools(c, ctx)}
    ${caseTemplate(snap)}
  </article>`;
}

// ── #2 and #3 ─────────────────────────────────────────────────────────────────
function chaserCard(c, rank, lead, ctx, snap) {
  // Shorter than #1's ("▲1 from #3"): the share icons share the row.
  const move = moveText(rank, c.prevRank);
  move.text = move.text.replace(/ last week$/, '');
  const gap  = Math.max(0, lead.mvpScore - c.mvpScore).toFixed(1);
  return `<article class="mv-card mv-card--chaser mv-card--r${rank}" style="--team:${teamColor(String(c.stats.team_name || ''))}">
    ${backdrop(c)}
    <span class="mv-card__ghost font-condensed" aria-hidden="true">${rank}</span>
    <span class="mv-card__row"><span class="mv-card__tags"><span class="mvpx-badge">${RANK_LABELS[rank]}</span>${move.text ? `<span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>` : ''}</span>${shareIcons(c, ctx.race)}</span>
    <span class="mv-card__id">${who(c)}</span>
    <span class="mv-card__score mv-card__score--row"><b class="font-condensed">${c.mvpScore.toFixed(1)}</b><small>${gap} behind #1</small></span>
    ${c.writeup ? `<p class="mv-card__case mv-card__case--clamp5">${escHtml(c.writeup)}</p>${readMore(c)}` : missing(ctx, 'mv-card__case')}
    ${statsFoot(perGame(c.stats), ctx.race.foot)}
    ${cardLink(c)}
    ${adminTools(c, ctx)}
    ${caseTemplate(snap)}
  </article>`;
}

// ── #4 onwards: The chase ─────────────────────────────────────────────────────
function chaseCard(c, rank, lead, ctx, snap) {
  const move = moveText(rank, c.prevRank, true);
  const gap  = Math.max(0, lead.mvpScore - c.mvpScore).toFixed(1);
  return `<article class="mv-card mv-card--sm" style="--team:${teamColor(String(c.stats.team_name || ''))}">
    ${backdrop(c)}
    <span class="mv-card__row">
      <span class="mv-card__rank"><b class="font-condensed">#${rank}</b>${move.text ? `<span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>` : ''}</span>
      ${shareIcons(c, ctx.race)}
    </span>
    <span class="mv-card__id">${who(c)}</span>
    <span class="mv-card__score mv-card__score--row mv-card__score--sm"><b class="font-condensed">${c.mvpScore.toFixed(1)}</b><small>${gap} behind #1</small></span>
    ${c.writeup ? `<p class="mv-card__case mv-card__case--clamp3">${escHtml(c.writeup)}</p>${readMore(c)}` : missing(ctx, 'mv-card__case')}
    ${statsFoot(perGame(c.stats), ctx.race.foot)}
    ${cardLink(c)}
    ${adminTools(c, ctx)}
    ${caseTemplate(snap)}
  </article>`;
}

function photoDialog(season, race = RACES.mvp) {
  return `<dialog class="mvpx-dlg" id="mvpx-photo-dlg" data-season="${escHtml(String(season))}">
  <form method="dialog" class="mvpx-dlg__form">
    <div class="mvpx-dlg__head">
      <h2>${escHtml(race.photoLabel)} — <span data-dlg-name></span></h2>
      <button type="submit" value="cancel" class="mvpx-dlg__x" aria-label="Close">&times;</button>
    </div>
    <div class="mvpx-dlg__tabs" role="tablist" aria-label="Which screen">
      <button type="button" role="tab" class="mvpx-dlg__tab" data-dlg-tab="desktop" aria-selected="true"><span class="pill-label">Desktop</span></button>
      <button type="button" role="tab" class="mvpx-dlg__tab" data-dlg-tab="phone" aria-selected="false"><span class="pill-label">Phone</span></button>
      <span class="mvpx-dlg__tab-note" data-dlg-note></span>
    </div>
    <div class="mvpx-dlg__body">
      <div class="mvpx-dlg__preview"><img data-dlg-preview alt="Preview"></div>
      <div class="mvpx-dlg__side">
        <span class="mvpx-dlg__label">Choose a photo</span>
        <div class="mvpx-dlg__opts" data-dlg-opts><span class="mvpx-dlg__loading">Loading…</span></div>
        <label class="mvpx-dlg__upload">Upload a new photo<input type="file" accept="image/*" data-dlg-file hidden></label>
        <span class="mvpx-dlg__label">Position</span>
        <label class="mvpx-dlg__range">Left / right<input type="range" min="0" max="100" step="1" data-dlg-x></label>
        <label class="mvpx-dlg__range">Up / down<input type="range" min="0" max="100" step="1" data-dlg-y></label>
        <label class="mvpx-dlg__range">Zoom<input type="range" min="1" max="3" step="0.05" data-dlg-zoom></label>
      </div>
    </div>
    <p class="mvpx-dlg__msg" data-dlg-msg></p>
    <div class="mvpx-dlg__actions">
      <button type="button" class="mvpx-dlg__btn" data-dlg-reset>Use profile photo</button>
      <span></span>
      <button type="submit" value="cancel" class="mvpx-dlg__btn">Cancel</button>
      <button type="button" class="mvpx-dlg__btn mvpx-dlg__btn--primary" data-dlg-save>Save</button>
    </div>
  </form>
</dialog>
<script>
(function () {
  var dlg = document.getElementById('mvpx-photo-dlg');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var season = dlg.dataset.season;
  var $ = function (sel) { return dlg.querySelector(sel); };
  var pv = $('[data-dlg-preview]'), opts = $('[data-dlg-opts]'), msg = $('[data-dlg-msg]'), note = $('[data-dlg-note]');
  var inX = $('[data-dlg-x]'), inY = $('[data-dlg-y]'), inZ = $('[data-dlg-zoom]'), resetBtn = $('[data-dlg-reset]');
  // st.d = desktop, st.m = phone. Phone 'same' shows whatever desktop currently shows.
  var st = {}, data = null;
  function side() { return st.tab === 'phone' ? st.m : st.d; }
  function urlOf(s) { return s.source === 'same' ? st.d.url : s.url; }
  function paint() {
    var s = side();
    dlg.classList.toggle('is-phone', st.tab === 'phone');
    dlg.querySelectorAll('[data-dlg-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.dlgTab === st.tab)); });
    note.textContent = st.tab === 'phone'
      ? (st.mReset ? 'Phones will follow desktop (top-weighted crop).' : st.mSet || st.mTouched ? 'Phones use their own settings.' : 'Not set yet — phones follow desktop, cropped toward the top.')
      : '';
    resetBtn.textContent = st.tab === 'phone' ? 'Match desktop' : 'Use profile photo';
    pv.src = urlOf(s);
    pv.style.objectPosition = s.x + '% ' + s.y + '%';
    pv.style.transformOrigin = s.x + '% ' + s.y + '%';
    pv.style.transform = 'scale(' + s.zoom + ')';
    inX.value = s.x; inY.value = s.y; inZ.value = s.zoom;
    opts.querySelectorAll('.mvpx-dlg__opt').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.key === s.source); });
  }
  function touch() { if (st.tab === 'phone') { st.mTouched = true; st.mReset = false; } }
  function addOpt(key, label, url) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mvpx-dlg__opt'; b.dataset.key = key;
    var img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy';
    img.onerror = function () { b.remove(); };
    var span = document.createElement('span'); span.textContent = label;
    b.appendChild(img); b.appendChild(span);
    b.addEventListener('click', function () { var s = side(); s.source = key; s.url = url; s.dataUrl = null; touch(); paint(); });
    opts.appendChild(b);
  }
  function renderOpts() {
    opts.innerHTML = '';
    if (!data) return;
    if (st.tab === 'phone') {
      addOpt('same', 'Same as desktop', st.d.url);
      if (data.phone.currentUrl) addOpt('current', 'Current phone photo', data.phone.currentUrl);
    } else if (data.desktop.currentUrl) {
      addOpt('current', 'Current MVP photo', data.desktop.currentUrl);
    }
    data.options.forEach(function (o) { addOpt(o.key, o.label, o.url); });
    var s = side();
    if (s.source === 'upload' && s.dataUrl) addOpt('upload', 'New upload', s.dataUrl);
  }
  function setTab(t) { st.tab = t; renderOpts(); paint(); }
  function open(pid, name) {
    st = { pid: pid, tab: 'desktop', mTouched: false, mReset: false, mSet: false,
      d: { source: 'profile', url: '', x: 50, y: 50, zoom: 1, dataUrl: null },
      m: { source: 'same', url: '', x: 50, y: 25, zoom: 1, dataUrl: null } };
    data = null;
    $('[data-dlg-name]').textContent = name;
    msg.textContent = '';
    opts.innerHTML = '<span class="mvpx-dlg__loading">Loading…</span>';
    dlg.showModal();
    fetch('/admin/mvp/photo-options?season=' + encodeURIComponent(season) + '&player_id=' + encodeURIComponent(pid))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        data = d;
        var profile = d.options[0].url;
        st.d = { source: d.desktop.source, url: d.desktop.currentUrl || profile, x: d.desktop.offset_x, y: d.desktop.offset_y, zoom: d.desktop.zoom, dataUrl: null };
        st.m = { source: d.phone.source, url: d.phone.source === 'profile' ? profile : (d.phone.currentUrl || ''), x: d.phone.offset_x, y: d.phone.offset_y, zoom: d.phone.zoom, dataUrl: null };
        st.mSet = d.phone.set;
        setTab('desktop');
      })
      .catch(function () { opts.innerHTML = ''; msg.textContent = 'Could not load photos.'; });
  }
  dlg.querySelectorAll('[data-dlg-tab]').forEach(function (t) { t.addEventListener('click', function () { setTab(t.dataset.dlgTab); }); });
  [[inX, 'x'], [inY, 'y'], [inZ, 'zoom']].forEach(function (p) {
    p[0].addEventListener('input', function () { side()[p[1]] = Number(this.value); touch(); paint(); });
  });
  $('[data-dlg-file]').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { var s = side(); s.source = 'upload'; s.dataUrl = rd.result; s.url = rd.result; touch(); renderOpts(); paint(); };
    rd.readAsDataURL(f);
    this.value = '';
  });
  resetBtn.addEventListener('click', function () {
    if (st.tab === 'phone') {
      st.m = { source: 'same', url: '', x: st.d.x, y: Math.min(st.d.y, 25), zoom: st.d.zoom, dataUrl: null };
      st.mReset = true; st.mTouched = false;
    } else {
      st.d = { source: 'profile', url: data ? data.options[0].url : st.d.url, x: 50, y: 50, zoom: 1, dataUrl: null };
    }
    renderOpts(); paint();
  });
  function payload(s) { return { source: s.source, dataUrl: s.source === 'upload' ? s.dataUrl : null, offset_x: s.x, offset_y: s.y, zoom: s.zoom }; }
  $('[data-dlg-save]').addEventListener('click', function () {
    var btn = this; btn.disabled = true; msg.textContent = 'Saving…';
    fetch('/admin/mvp/photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: season, player_id: st.pid, desktop: payload(st.d), phone: st.mReset ? 'reset' : st.mTouched ? payload(st.m) : null })
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Save failed'); }); })
      .then(function () { location.reload(); })
      .catch(function (e) { msg.textContent = e.message; btn.disabled = false; });
  });
  document.querySelectorAll('.mvpx-photo-btn').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(b.dataset.pid, b.dataset.name); });
  });
})();
</script>`;
}

// ── MVP reveal lock: the finalists ───────────────────────────────────────────
// lib/mvp-lock.js. Three equal cards, A–Z, with only who they are and their season line:
// no rank, ghost numeral, medal glow, score, movement, writeup or share buttons.
function finalistCard(c, ctx) {
  return `<article class="mv-card mv-card--chaser mv-card--finalist" style="--team:${teamColor(String(c.stats.team_name || ''))}">
    ${backdrop(c)}
    <span class="mv-card__row"><span class="mv-card__tags"><span class="mvpx-badge">FINALIST</span></span></span>
    <span class="mv-card__id">${who(c)}</span>
    ${statsFoot(perGame(c.stats), ctx.race.foot)}
    ${cardLink(c)}
    ${ctx.isAdmin ? `<span class="mv-card__admin">${photoBtn(c, true)}</span>` : ''}
  </article>`;
}

function mvpFinalistsPage({ candidates, season, isAdmin, race }) {
  const head = `<header class="mvpx-head">
    <div class="mvpx-head__main ld-head">
      <span class="ld-kicker">Season ${escHtml(String(season))}</span>
      <h1>${escHtml(race.finalists)}</h1>
      <p class="ld-head__meta">The three players still in the running for ${escHtml(race.award)}, listed A–Z.</p>
    </div>
  </header>`;
  const banner = `<div class="card mv-reveal">
    <span class="mvpx-badge mvpx-badge--solid">Revealed at Finals Game 2</span>
    <p>The order and the ${escHtml(race.scoresNoun)} stay under wraps until the award is handed out at Finals Game 2.</p>
  </div>`;
  if (!candidates.length) return `<div class="page-content mvpx">${head}${banner}</div>`;
  return `<div class="page-content mvpx">
  ${head}
  ${banner}
  <div class="mv-top mv-top--finalists">${candidates.map(c => finalistCard(c, { isAdmin, race })).join('')}</div>
</div>
${isAdmin ? photoDialog(season, race) : ''}`;
}

// sections: the AI writeups (server.js mvpSectionFacts): race under the page header (full
// kicker, like the other pages' summary panel), chase under The chase header.
// locked: the MVP reveal lock is on; candidates are the finalists A–Z with no scores.
// race: 'mvp' (default) or 'dpoy', see RACES.
export function mvpPage({ candidates = [], season, week = null, totalGames, seasonGames, isAdmin = false, playoffsStarted = false, sections = {}, locked = false, race: raceKey = 'mvp', called = null }) {
  const race = raceOf(raceKey);
  if (locked) return mvpFinalistsPage({ candidates, season, isAdmin, race });
  const kicker = `Season ${escHtml(String(season))}${playoffsStarted ? ' · Final' : week ? ` · After week ${escHtml(String(week))}` : ''}`;
  const head = (side = '') => `<header class="mvpx-head">
    <div class="mvpx-head__main ld-head">
      <span class="ld-kicker">${kicker}</span>
      <h1>${escHtml(race.name)}</h1>
      <p class="ld-head__meta">${playoffsStarted ? `The final regular-season standings for ${race.award}.` : `The ten best cases for ${race.award}, re-scored after every game week.`}</p>
    </div>
    ${side}
  </header>`;

  if (!candidates.length) {
    return `<div class="page-content mvpx">
  ${head()}
  <div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No games played yet this season.</div>
</div>`;
  }

  const totalSlots = seasonGames * 2;
  const pct = totalSlots ? Math.min(100, Math.round(totalGames / totalSlots * 100)) : 0;
  const side = `<div class="mvpx-head__side">
    ${playoffsStarted
      ? `<span class="mvpx-badge mvpx-badge--solid">Season final</span>`
      : `<div class="mvpx-progress">
          <span class="mvpx-progress__label"><span>Regular season</span><span><b>${totalGames}</b> of ${totalSlots} games</span></span>
          <span class="mvpx-progress__bar"><span style="width:${pct}%"></span></span>
        </div>`}
    <details class="mvpx-how">
      <summary>How the score works</summary>
      <p>${race.how}</p>
    </details>
    ${isAdmin && !playoffsStarted ? `<button type="button" id="mvp-regen-all" class="mvpx-admin-btn" data-season="${escHtml(String(season))}">↺ Regenerate all</button>` : ''}
  </div>`;

  const ctx = { isAdmin, season, playoffsStarted, race };
  const lead = candidates[0];
  const chasers = candidates.slice(1, 3);
  const rest = candidates.slice(3);
  const snap = (c, i) => mvpSnapshot(c, i + 1, candidates, { season, week, playoffsStarted, race: race.key });
  const arrow = d => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const chase = rest.length ? `<section class="mv-chase-sec" aria-labelledby="mv-chase-h">
    <div class="section-header mv-chase-head">
      <h2 id="mv-chase-h">The chase <span class="section-header__sub">#4–${rest.length + 3} · per game</span></h2>
      <span class="gm-potg-head__nav mv-chase-nav">
        <button type="button" class="gm-potg-head__btn" data-mv-nav="-1" aria-label="Previous players">${arrow('M15 18l-6-6 6-6')}</button>
        <button type="button" class="gm-potg-head__btn" data-mv-nav="1" aria-label="More players">${arrow('M9 18l6-6-6-6')}</button>
      </span>
    </div>
    ${rest.length >= 1 ? sectionPanel(sections.chase || null, `${race.key}_chase:${season}`, isAdmin) : ''}
    <div class="mv-chase swipe-row" data-swipe data-mv-row>${rest.map((c, i) => chaseCard(c, i + 4, lead, ctx, snap(c, i + 3))).join('')}</div>
  </section>` : '';

  const scripts = `<script>
(function () {
  var season = ${JSON.stringify(String(season))};
  // "Read the case": the card's <template> into the modal (a bottom sheet on phones).
  var dlg = document.getElementById('mv-case-dlg');
  function openCase(pid) {
    var tpl = document.querySelector('.mv-case-tpl[data-pid="' + pid + '"]');
    if (!tpl || !dlg) return;
    dlg.innerHTML = '';
    dlg.appendChild(tpl.content.cloneNode(true));
    dlg.showModal();
  }
  if (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-mv-close]')) dlg.close();
    });
  }
  // Share: one share link per player per season (/api/mvp/share). Phones get the share
  // sheet; elsewhere the link is copied.
  var shares = {};
  function shareOf(pid) {
    if (shares[pid]) return shares[pid];
    shares[pid] = fetch(${JSON.stringify(`/api/${race.key}/share`)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ season: season, player_id: pid }) })
      .then(function (r) { if (!r.ok) throw new Error('share'); return r.json(); })
      .catch(function (e) { delete shares[pid]; throw e; });
    return shares[pid];
  }
  function flash(btn, text) {
    var label = btn.querySelector('span');
    var old = label ? label.textContent : btn.title;
    btn.classList.add('is-done');
    if (label) label.textContent = text; else btn.title = text;
    setTimeout(function () { btn.classList.remove('is-done'); if (label) label.textContent = old; else btn.title = old; }, 1800);
  }
  function share(btn) {
    shareOf(btn.dataset.mvShare).then(function (s) {
      var phone = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (phone && navigator.share) return navigator.share({ title: ${JSON.stringify(race.shareTitle)}, url: s.url }).catch(function (e) { if (e && e.name === 'AbortError') return; throw e; });
      return navigator.clipboard.writeText(s.url).then(function () { window.wkndCopied(btn); }, function () { window.prompt('Copy this link', s.url); });
    }).catch(function () { flash(btn, 'Try again'); });
  }
  function download(btn) {
    btn.disabled = true;
    shareOf(btn.dataset.mvDl).then(function (s) { return fetch(${JSON.stringify(`/api/${race.key}/share/`)} + s.id + '/card.png'); })
      .then(function (r) { if (!r.ok) throw new Error('png'); return r.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = ${JSON.stringify(race.dl)};
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      })
      .catch(function () { flash(btn, 'Try again'); })
      .then(function () { btn.disabled = false; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mv-share],[data-mv-dl],[data-mv-case]');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.mvCase) openCase(b.dataset.mvCase);
    else if (b.dataset.mvShare) share(b);
    else download(b);
  });
  // The chase: header arrows page the row (desktop); phones swipe it.
  var row = document.querySelector('[data-mv-row]');
  var btns = document.querySelectorAll('[data-mv-nav]');
  if (!row || !btns.length) return;
  function sync() {
    btns[0].disabled = row.scrollLeft <= 2;
    btns[1].disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { row.scrollBy({ left: Number(b.dataset.mvNav) * (row.clientWidth + 16), behavior: 'smooth' }); });
  });
  row.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
})();
</script>
${swipeScript()}${isAdmin ? `
${sectionRegenScript()}
<script>
(function () {
  async function regen(pid, season, btn) {
    btn.disabled = true; btn.textContent = '…';
    await fetch(${JSON.stringify(`/admin/${race.key}/regenerate`)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pid ? { player_id: pid, season: season } : { season: season })
    });
    location.reload();
  }
  document.querySelectorAll('.mvp-regen-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); regen(this.dataset.pid, this.dataset.season, this); });
  });
  var all = document.getElementById('mvp-regen-all');
  if (all) all.addEventListener('click', function () { regen(null, this.dataset.season, this); });
})();
</script>
${photoDialog(season, race)}` : ''}`;

  return `<div class="page-content mvpx">
  ${head(side)}
  ${summaryPanel(sections.race || null, `${race.key}_race:${season}`, isAdmin, 'section-block')}
  <div class="mv-top${chasers.length ? '' : ' mv-top--solo'}">
    ${leadCard(lead, candidates[1], ctx, snap(lead, 0))}
    ${chasers.map((c, i) => chaserCard(c, i + 2, lead, ctx, snap(c, i + 1))).join('')}
  </div>
  ${calledSection(called)}
  ${chase}
</div>
<dialog class="mv-dlg" id="mv-case-dlg" aria-label="${escHtml(race.short)} case"></dialog>
${scripts}`;
}

// /mvp/share/:id: the shared card's full case (the same snapshot the share images are drawn
// from, frozen when it was shared), with a way to the live race.
export function mvpSharePage(snap) {
  const race = raceOf(snap.kind);
  return `<div class="lsp mv-share">
  <div class="lsp-eyebrow">
    <span class="lsp-eyebrow__cat">${escHtml(race.name.toUpperCase())}</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>SEASON ${escHtml(snap.season)}${snap.asOf ? ` · ${escHtml(snap.asOf.toUpperCase())}` : ''}</span>
  </div>
  ${mvpCaseHtml(snap, { actions: false })}
  <div class="lsp-nav">
    <a href="${race.path}${snap.season ? `?season=${encodeURIComponent(snap.season)}` : ''}" class="lsp-nav__back">&larr; The full ${escHtml(race.key === 'mvp' ? 'MVP race' : 'Best Defender race')}</a>
    <a href="/players/${encodeURIComponent(snap.lead.id)}" class="lsp-nav__back">Full profile &rarr;</a>
  </div>
</div>`;
}

// ── MVP reveal lock: the ten cases + "Call the podium" (server.js mvpLockTen) ─────────────
// Shuffled server-side on every view; nothing here may hint at the order: no rank, score,
// movement, medal colour or ghost numeral. Each card: the player-card head, the earlier
// meeting with Sunday's opponent as depth bars (game value, dashed season average), the
// forecast ("Sunday's job" + a question) and the 1st/2nd/3rd pick buttons. Styles: styles.css
// "MVP lock" (mvl- prefix). The bars animate in when the card scrolls into view.
const LOCK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ORD = ['1st', '2nd', '3rd'];

// The meeting block (also the homepage card's, with keys = ['pts', 'reb', 'ast']).
export function lockBars(c, { keys = null, compact = false } = {}) {
  const bars = keys ? c.bars.filter(b => keys.includes(b.key)) : c.bars;
  const head = c.meet
    ? `${c.mode === 'forecast' ? `Last time vs ${escHtml(c.meet.opp)}` : `Last game · vs ${escHtml(c.meet.opp)}`} · ${escHtml(c.meet.date)} · ${escHtml(c.meet.res)}`
    : 'Season per game';
  const rows = bars.map((b, i) => {
    const none = b.v == null;
    const worse = b.inv ? b.d.startsWith('+') : b.d.startsWith('−');
    const cls = !b.d ? '' : worse ? ' is-down' : ' is-up';
    return `<span class="mvl-row">
        <small class="mvl-row__k">${b.label}</small>
        <span class="mvl-track"><span class="mvl-fill" style="width:${none ? b.m : b.w};--i:${i}"><i></i></span>${none ? '' : `<span class="mvl-avg" style="left:${b.m}"></span>`}</span>
        <span class="mvl-row__v"><b class="font-condensed">${none ? escHtml(b.avg) : b.v}</b>${b.d ? `<small class="${cls.trim()}">${b.d}</small>` : ''}</span>
      </span>`;
  }).join('');
  const missed = c.meet && !c.meet.played ? '<span class="mvl-meet__miss">Didn’t play in that one · bars show his season</span>' : '';
  return `<div class="mvl-meet${compact ? ' mvl-meet--sm' : ''}">
      <span class="mvl-meet__head"><small>${head}</small>${c.line ? '<small class="mvl-meet__key"><i></i>season avg</small>' : ''}</span>
      ${rows}
      ${compact ? '' : `<span class="mvl-meet__foot"><span class="font-condensed">${c.line ? escHtml(c.line.shot) : ''}</span>${c.foot ? `<span>${escHtml(c.foot[0])} <b>${escHtml(c.foot[1])}</b></span>` : ''}</span>`}
      ${missed}
    </div>`;
}

function lockCard(c, { isAdmin, season, canPick }) {
  const { first, last } = splitName(c.player.name);
  const when = c.mode === 'forecast' ? `${escHtml(c.nextDay)} · vs ${escHtml(c.opp)}` : 'Regular season done';
  const game = c.mode === 'forecast' ? [c.team, c.opp].sort().join('|') : '';
  const pid = escHtml(String(c.player.id));
  return `<article class="mv-card mvl-card" style="--team:${teamColor(c.team)}" data-pid="${pid}" data-team="${escHtml(c.team)}" data-game="${escHtml(game)}"
    data-first="${escHtml(first)}" data-last="${escHtml(last)}" ${Object.entries(c.sort).map(([k, v]) => ` data-sort-${k}="${v}"`).join('')}>
    ${backdrop(c)}
    <span class="mvl-card__top"><span class="mvl-card__when">${when}</span><span class="mvl-card__mine" data-mvl-mine hidden></span></span>
    <span class="mv-card__id mvl-card__id">${who(c)}</span>
    ${lockBars(c)}
    <div class="mvl-fc">
      <small>${c.mode === 'forecast' ? 'Sunday’s job' : 'The final case'}</small>
      <p class="mvl-fc__job">${escHtml(c.job)}</p>
    </div>
    <p class="mvl-fc__q">${escHtml(c.question)}</p>
    <span class="mvl-picks" role="group" aria-label="Put ${escHtml(displayPlayerName(c.player.name))} on your podium">
      ${ORD.map((o, i) => `<button type="button" class="mvl-pick" data-mvl-pick="${i + 1}" aria-pressed="false"${canPick ? '' : ' disabled'}>${o.toUpperCase()}</button>`).join('')}
    </span>
    ${cardLink(c)}
    ${isAdmin ? `<span class="mv-card__admin">${photoBtn(c, true)}<button type="button" class="mvpx-admin-btn mvp-regen-btn" data-pid="${pid}" data-season="${escHtml(String(season))}" title="Regenerate this card's writeup">↺</button></span>` : ''}
  </article>`;
}

function ballotStatus(b) {
  if (!b) return '';
  if (b.closed) return 'Ballots closed when the MVP was awarded.';
  if (!b.loggedIn) return 'Log in with your player account to call it.';
  const n = b.picks.filter(Boolean).length;
  if (b.bonusOpen) return n === 3 ? '✓ Locked in for the bonus. Change it any time before the cut-off.' : `${n} of 3 picked · saves as you tap`;
  return n === 3 ? '✓ Saved for Who called it.' : `${n} of 3 picked · saves as you tap`;
}

// race: 'mvp' (with the podium ballot) or 'dpoy' (the Best Defender race: defensive bars and
// writeups, no ballot; server.js passes ballot = null).
export function mvpLockPage({ ten = [], season, totalGames = 0, seasonGames = 6, isAdmin = false, ballot = null, viewerId = null, race: raceKey = 'mvp' }) {
  const race = raceOf(raceKey);
  const dpoy = race.key === 'dpoy';
  const forecast = ten.some(c => c.mode === 'forecast');
  const canPick = !!(ballot && ballot.enabled && !ballot.closed);
  const showBallot = !!(ballot && ballot.enabled);
  const totalSlots = seasonGames * 2;
  const pct = totalSlots ? Math.min(100, Math.round(totalGames / totalSlots * 100)) : 0;
  const head = `<header class="mvpx-head">
    <div class="mvpx-head__main ld-head">
      <span class="ld-kicker">Season ${escHtml(String(season))} · ${forecast ? 'Final week' : 'Regular season done'}</span>
      <h1>${escHtml(race.name)}</h1>
      <p class="ld-head__meta">${forecast ? 'Ten players still have a case, and Sunday is the last chance to make it.' : 'Ten players made their case.'} The order and the scores stay hidden until the ${dpoy ? 'Best Defender award' : 'MVP is awarded'} at Finals Game 2.</p>
    </div>
    <div class="mvpx-head__side">
      <div class="mvpx-progress">
        <span class="mvpx-progress__label"><span>Regular season</span><span><b>${totalGames}</b> of ${totalSlots} games</span></span>
        <span class="mvpx-progress__bar mvl-progress"><span style="width:${pct}%"></span></span>
      </div>
      <details class="mvpx-how"><summary>How the score works</summary><p>${race.how}</p></details>
      ${isAdmin ? `<button type="button" id="mvp-regen-all" class="mvpx-admin-btn" data-season="${escHtml(String(season))}">↺ Regenerate all</button>` : ''}
    </div>
  </header>`;
  const cut = showBallot && ballot.bonusOpen ? `Bonus closes ${ballot.bonusAt ? escHtml(ballot.bonusAt) : 'at Sunday’s tip-off'}` : showBallot ? 'Bonus ballots locked' : '';
  const strip = `<div class="mvl-strip">${LOCK_ICON}<span><b>Locked${forecast ? ' for the final week' : ''}.</b> No ranks, no scores, no gaps. The ten are shuffled on every visit.</span>${cut ? `<span class="mvl-strip__cut">${cut}</span>` : ''}</div>`;

  // Filters: Sunday's games (both teams' dots), else teams; My picks for a logged-in voter.
  const games = forecast ? [...new Set(ten.filter(c => c.mode === 'forecast').map(c => [c.team, c.opp].sort().join('|')))] : [];
  const teams = [...new Set(ten.map(c => c.team))].sort();
  const dotsOf = ts => `<span class="mvl-dots">${ts.map(t => `<i style="background:${teamColor(t)}"></i>`).join('')}</span>`;
  const tc = t => t.charAt(0) + t.slice(1).toLowerCase();
  const chips = [`<button type="button" class="gr-chip is-on" data-mvl-filter="" aria-pressed="true">All ${ten.length}</button>`]
    .concat(games.length
      ? games.map(g => { const ts = g.split('|'); return `<button type="button" class="gr-chip" data-mvl-filter="game:${escHtml(g)}" aria-pressed="false">${dotsOf(ts)}${ts.map(tc).join(' v ')}</button>`; })
      : teams.map(t => `<button type="button" class="gr-chip" data-mvl-filter="team:${escHtml(t)}" aria-pressed="false">${dotsOf([t])}${tc(t)}</button>`))
    .concat(ballot?.loggedIn ? [`<button type="button" class="gr-chip" data-mvl-filter="mine" aria-pressed="false">My picks <span data-mvl-minecount></span></button>`] : []);
  const toolbar = `<div class="mvl-bar" role="toolbar" aria-label="Filter and sort the ten">
      <span class="mvl-bar__chips">${chips.join('')}</span>
      <label class="mvl-bar__sort"><span>Sort</span>
        <select class="form-input" data-mvl-sort aria-label="Sort the ten">
          <option value="shuffle">Shuffled</option>
          ${(dpoy
            ? [['spg', 'Steals per game'], ['bpg', 'Blocks per game'], ['rpg', 'Rebounds per game'], ['last', forecast ? 'Stocks last game vs Sunday’s team' : 'Stocks in his last game']]
            : [['ppg', 'Points per game'], ['rpg', 'Rebounds per game'], ['apg', 'Assists per game'], ['last', forecast ? 'Last game vs Sunday’s team' : 'Points in his last game']])
            .map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          <option value="team">Team</option>
          <option value="name">Name A–Z</option>
        </select>
      </label>
      <button type="button" class="mvl-bar__shuffle" data-mvl-shuffle aria-label="Shuffle again" title="Shuffle again"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button>
    </div>`;

  const byId = Object.fromEntries(ten.map(c => [String(c.player.id), c]));
  const slotHtml = (pid, i) => {
    const c = pid && byId[pid];
    if (!c) return `<div class="mvl-slot is-empty" data-mvl-slot="${i + 1}"><b class="font-condensed">${i + 1}</b><span class="mvl-slot__hint">${canPick ? `Tap <b>${ORD[i].toUpperCase()}</b> on a player` : '—'}</span></div>`;
    const { first, last } = splitName(c.player.name);
    return `<div class="mvl-slot" data-mvl-slot="${i + 1}"><b class="font-condensed">${i + 1}</b>
      <span class="pl-av mvl-slot__av" style="--team:${teamColor(c.team)}"><span>${escHtml(initials(displayPlayerName(c.player.name)))}</span><img src="${playerPhotoUrl(String(c.player.id), 96)}" alt="" loading="lazy" onerror="this.remove()"></span>
      <span class="mvl-slot__who"><small>${escHtml(first)}</small><b>${escHtml(last)}</b></span>
      ${canPick && ballot.loggedIn ? `<button type="button" class="mvl-slot__x" data-mvl-clear="${i + 1}" aria-label="Remove ${escHtml(last)}">×</button>` : ''}
    </div>`;
  };
  const picks = ballot?.picks || [null, null, null];
  const bonusLine = ballot && !ballot.bonusOpen && ballot.bonusPicks
    ? `<p class="mvl-ballot__bonus">Your bonus ballot: ${ballot.bonusPicks.map((p, i) => `${i + 1}. ${p && byId[p] ? escHtml(splitName(byId[p].player.name).last) : '—'}`).join(' · ')}. Changes now only count for Who called it.</p>` : '';
  const aside = showBallot ? `<aside class="card mvl-ballot" id="ballot" aria-labelledby="mvl-ballot-h">
      <div class="mvl-ballot__head">
        <span class="mvl-ballot__kicker">Your ballot</span>
        <h2 id="mvl-ballot-h">Call the podium</h2>
        <p>Who finishes 1st, 2nd and 3rd? Your call stays private until the reveal at Finals Game 2.</p>
      </div>
      <div class="mvl-slots" data-mvl-slots>${picks.map(slotHtml).join('')}</div>
      ${ballot.loggedIn || ballot.closed ? `<p class="mvl-ballot__status" data-mvl-status role="status">${escHtml(ballotStatus(ballot))}</p>`
        : `<a class="mvl-ballot__login" href="/login?next=${encodeURIComponent('/mvp#ballot')}">Log in to call the podium</a>`}
      ${bonusLine}
      <dl class="mvl-ballot__meta">
        <div><dt>Ballots in</dt><dd class="font-condensed" data-mvl-count>${ballot.count}</dd></div>
        <div><dt>${ballot.bonusOpen ? 'Bonus closes' : 'Ballots close'}</dt><dd>${escHtml(ballot.bonusOpen ? (ballot.bonusAt || 'Sunday tip-off') : (ballot.closeAt || 'at Finals Game 2'))}</dd></div>
      </dl>
      <p class="mvl-ballot__rule"><b>Pickmaster bonus:</b> +1 for each player in the exact spot, up to +3. Only the ballot you have in at the cut-off counts. <a href="/picks/rules#podium">Rules</a></p>
    </aside>` : '';
  const dock = showBallot ? `<a class="mvl-dock" href="#ballot" data-mvl-dock>
      <span class="mvl-dock__lbl">Your podium · <span data-mvl-dockn>${picks.filter(Boolean).length}</span> of 3</span>
      <span class="mvl-dock__slots">${picks.map((p, i) => `<span class="mvl-dock__slot${p ? '' : ' is-empty'}" data-mvl-dockslot="${i + 1}"><b class="font-condensed">${i + 1}</b><span>${p && byId[p] ? escHtml(splitName(byId[p].player.name).last) : 'Pick'}</span></span>`).join('')}</span>
    </a>` : '';

  const state = { picks, loggedIn: !!ballot?.loggedIn, canPick, bonusOpen: !!ballot?.bonusOpen, login: `/login?next=${encodeURIComponent('/mvp#ballot')}` };
  return `<div class="page-content mvpx mvl${showBallot ? ' mvl--ballot' : ''}" data-mvl data-season="${escHtml(String(season))}">
  ${head}
  ${strip}
  <div class="mvl-layout">
    <section class="mvl-main" aria-labelledby="mvl-ten-h">
      <div class="section-header"><h2 id="mvl-ten-h">The ten <span class="section-header__sub">shuffled · order means nothing</span></h2></div>
      ${toolbar}
      <div class="mvl-grid swipe-row" data-swipe data-mvl-grid>${ten.map(c => lockCard(c, { isAdmin, season, canPick })).join('\n')}</div>
      <div class="card mvl-empty" data-mvl-empty hidden>No players match. <button type="button" class="mvl-empty__reset" data-mvl-filter="">Show all ten</button></div>
    </section>
    ${aside}
  </div>
  ${dock}
</div>
<script type="application/json" id="mvl-state">${JSON.stringify(state).replace(/</g, '\\u003c')}</script>
${mvpLockScript()}
${swipeScript()}${isAdmin ? `
<script>
(function () {
  function regen(pid, season, btn) {
    btn.disabled = true; btn.textContent = '…';
    fetch(${JSON.stringify(`/admin/${race.key}/regenerate`)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pid ? { player_id: pid, season: season } : { season: season }) })
      .then(function () { location.reload(); });
  }
  document.querySelectorAll('.mvp-regen-btn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); regen(b.dataset.pid, b.dataset.season, b); }); });
  var all = document.getElementById('mvp-regen-all');
  if (all) all.addEventListener('click', function () { regen(null, all.dataset.season, all); });
})();
</script>
${photoDialog(season, race)}` : ''}`;
}

function mvpLockScript() {
  return `<script>
(function () {
  var root = document.querySelector('[data-mvl]');
  if (!root) return;
  var st = JSON.parse(document.getElementById('mvl-state').textContent);
  var grid = root.querySelector('[data-mvl-grid]');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.mvl-card'));
  var ORD = ['1ST', '2ND', '3RD'];
  var byId = {};
  cards.forEach(function (c, i) { c.dataset.shuffle = i; byId[c.dataset.pid] = c; });

  // Bars grow in as each card scrolls into view (static without JS or with reduced motion).
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window) {
    root.classList.add('mvl-anim');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.25 });
    cards.forEach(function (c) { io.observe(c); });
  }

  // Filter + sort.
  var filter = '', sort = 'shuffle';
  function apply() {
    var mine = st.picks.filter(Boolean);
    var list = cards.slice();
    if (sort === 'shuffle') list.sort(function (a, b) { return a.dataset.shuffle - b.dataset.shuffle; });
    else if (sort === 'team') list.sort(function (a, b) { return a.dataset.team.localeCompare(b.dataset.team) || a.dataset.last.localeCompare(b.dataset.last); });
    else if (sort === 'name') list.sort(function (a, b) { return a.dataset.last.localeCompare(b.dataset.last); });
    else list.sort(function (a, b) { return Number(b.getAttribute('data-sort-' + sort)) - Number(a.getAttribute('data-sort-' + sort)); });
    var shown = 0;
    list.forEach(function (c) {
      var ok = !filter
        || (filter === 'mine' && mine.indexOf(c.dataset.pid) !== -1)
        || (filter.indexOf('game:') === 0 && c.dataset.game === filter.slice(5))
        || (filter.indexOf('team:') === 0 && c.dataset.team === filter.slice(5));
      c.hidden = !ok; if (ok) shown++;
      grid.appendChild(c);
    });
    root.querySelector('[data-mvl-empty]').hidden = shown > 0;
    grid.scrollLeft = 0;
  }
  root.addEventListener('click', function (e) {
    var f = e.target.closest('[data-mvl-filter]');
    if (f) {
      filter = f.dataset.mvlFilter;
      root.querySelectorAll('.mvl-bar [data-mvl-filter]').forEach(function (b) { var on = b.dataset.mvlFilter === filter; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      apply();
    }
    if (e.target.closest('[data-mvl-shuffle]')) {
      var order = cards.map(function (c, i) { return i; });
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      cards.forEach(function (c, i) { c.dataset.shuffle = order[i]; });
      sort = 'shuffle'; root.querySelector('[data-mvl-sort]').value = 'shuffle';
      apply();
    }
  });
  root.querySelector('[data-mvl-sort]').addEventListener('change', function () { sort = this.value; apply(); });

  // The ballot: a tap saves at once (rolls back on an error).
  var slotsBox = root.querySelector('[data-mvl-slots]');
  var statusEl = root.querySelector('[data-mvl-status]');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function status(text) { if (statusEl) statusEl.textContent = text; }
  function statusText() {
    var n = st.picks.filter(Boolean).length;
    if (n === 3) return st.bonusOpen ? '✓ Locked in for the bonus. Change it any time before the cut-off.' : '✓ Saved for Who called it.';
    return n + ' of 3 picked · saves as you tap';
  }
  function paint(prev) {
    cards.forEach(function (c) {
      var at = st.picks.indexOf(c.dataset.pid);
      c.classList.toggle('is-mine', at !== -1);
      var tag = c.querySelector('[data-mvl-mine]');
      tag.hidden = at === -1; tag.textContent = at === -1 ? '' : 'YOUR ' + ORD[at];
      c.querySelectorAll('[data-mvl-pick]').forEach(function (b) { var on = Number(b.dataset.mvlPick) - 1 === at; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    });
    if (slotsBox) slotsBox.innerHTML = st.picks.map(function (pid, i) {
      var c = pid && byId[pid];
      if (!c) return '<div class="mvl-slot is-empty" data-mvl-slot="' + (i + 1) + '"><b class="font-condensed">' + (i + 1) + '</b><span class="mvl-slot__hint">' + (st.canPick ? 'Tap <b>' + ORD[i] + '</b> on a player' : '—') + '</span></div>';
      var av = c.querySelector('.pl-av');
      return '<div class="mvl-slot" data-mvl-slot="' + (i + 1) + '"><b class="font-condensed">' + (i + 1) + '</b>'
        + '<span class="pl-av mvl-slot__av" style="--team:' + c.style.getPropertyValue('--team') + '">' + (av ? av.innerHTML : '') + '</span>'
        + '<span class="mvl-slot__who"><small>' + esc(c.dataset.first) + '</small><b>' + esc(c.dataset.last) + '</b></span>'
        + (st.canPick && st.loggedIn ? '<button type="button" class="mvl-slot__x" data-mvl-clear="' + (i + 1) + '" aria-label="Remove ' + esc(c.dataset.last) + '">×</button>' : '') + '</div>';
    }).join('');
    root.querySelectorAll('[data-mvl-dockslot]').forEach(function (s, i) {
      var c = st.picks[i] && byId[st.picks[i]];
      s.classList.toggle('is-empty', !c); s.querySelector('span').textContent = c ? c.dataset.last : 'Pick';
    });
    var dn = root.querySelector('[data-mvl-dockn]'); if (dn) dn.textContent = st.picks.filter(Boolean).length;
    var mc = root.querySelector('[data-mvl-minecount]'); if (mc) mc.textContent = '· ' + st.picks.filter(Boolean).length;
    if (prev) celebrate(prev);
  }
  // A slot that just got a player: the pressed button and the YOUR 1ST tag pop, the ballot
  // slot and the dock slot slide in (CSS .is-pop / .is-new; off with reduced motion).
  function flash(el, cls) {
    if (!el || !el.offsetParent) return; // hidden (the dock on desktop): no animation would end
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    el.addEventListener('animationend', function done(e) {
      if (e.target !== el) return; // a child's animation bubbling up
      el.classList.remove(cls); el.removeEventListener('animationend', done);
    });
  }
  function celebrate(prev) {
    st.picks.forEach(function (pid, i) {
      if (!pid || pid === prev[i]) return;
      var c = byId[pid];
      if (c) {
        flash(c.querySelector('[data-mvl-pick="' + (i + 1) + '"]'), 'is-pop');
        flash(c.querySelector('[data-mvl-mine]'), 'is-pop');
        flash(c, 'is-picked');
      }
      if (slotsBox) flash(slotsBox.querySelector('[data-mvl-slot="' + (i + 1) + '"]'), 'is-new');
      flash(root.querySelector('[data-mvl-dockslot="' + (i + 1) + '"]'), 'is-new');
    });
  }
  var saving = 0;
  function save(next) {
    var prev = st.picks.slice();
    st.picks = next; paint(prev); status('Saving…');
    var mine = ++saving;
    fetch('/api/mvp/ballot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p1: next[0], p2: next[1], p3: next[2] }) })
      .then(function (r) { return r.json().then(function (d) { if (r.status === 401) { location.href = st.login; } if (!r.ok) throw new Error(d.error || 'Could not save.'); return d; }); })
      .then(function (d) {
        if (mine !== saving) return;
        st.bonusOpen = d.bonusOpen;
        var cnt = root.querySelector('[data-mvl-count]'); if (cnt) cnt.textContent = d.count;
        status(statusText());
      })
      .catch(function (err) { if (mine !== saving) return; st.picks = prev; paint(); status(err.message); });
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mvl-pick]');
    var x = e.target.closest('[data-mvl-clear]');
    if (!b && !x) return;
    e.preventDefault(); e.stopPropagation();
    if (!st.loggedIn) { location.href = st.login; return; }
    if (!st.canPick) return;
    var next = st.picks.slice();
    if (x) { next[Number(x.dataset.mvlClear) - 1] = null; return save(next); }
    var pid = b.closest('.mvl-card').dataset.pid, at = Number(b.dataset.mvlPick) - 1;
    if (next[at] === pid) next[at] = null;
    else { var was = next.indexOf(pid); if (was !== -1) next[was] = null; next[at] = pid; }
    save(next);
  });
  paint();
})();
</script>`;
}

// ── After the reveal: "Who called it" (server.js mvpPodiumReveal) ─────────────────────────
// Three cards under the podium: your ballot (exact spots + your Pickmaster bonus), who the
// league put 1st, and the perfect podiums. Styles: styles.css "MVP lock" (mvr- prefix).
function calledSection(called) {
  if (!called) return '';
  const nameOf = p => escHtml(splitName(p.name).last || '—');
  const placeTag = n => (n === 1 ? 'MVP' : n === 2 ? '2ND' : n === 3 ? '3RD' : '');
  const mine = called.mine
    ? `<b class="mvr-big font-condensed">${called.mine.spots}<small> of 3 spots</small></b>
      <div class="mvr-rows">${called.mine.picks.map((p, i) => `<span class="mvr-row${called.mine.exact[i] ? ' is-ok' : ''}"><b class="font-condensed">${i + 1}</b><span>${nameOf(p)}</span><small>${called.mine.exact[i] ? '✓ exact' : (() => { const at = called.podium.findIndex(x => x.id === p.id); return at === -1 ? 'off the podium' : `finished ${['1st', '2nd', '3rd'][at]}`; })()}</small></span>`).join('')}</div>
      ${called.bonus != null ? `<p class="mvr-note">Pickmaster bonus: <b>+${called.bonus}</b> (from your ballot at the cut-off)</p>` : '<p class="mvr-note">No bonus ballot: this one was in after the cut-off.</p>'}`
    : '<p class="mvr-note">You didn’t call the podium this season.</p>';
  const firsts = called.firsts.map(f => `<span class="mvr-bar">
      <span class="mvr-bar__lbl"><span>${nameOf(f)}${placeTag(f.place) ? ` <i>${placeTag(f.place)}</i>` : ''}</span><b class="font-condensed">${f.pct}%</b></span>
      <span class="mvr-bar__track"><span style="width:${f.pct}%;--team:${teamColor(f.team)}"${f.place === 1 ? ' class="is-mvp"' : ''}></span></span>
    </span>`).join('') + (called.othersPct ? `<span class="mvr-bar"><span class="mvr-bar__lbl"><span>Others</span><b class="font-condensed">${called.othersPct}%</b></span><span class="mvr-bar__track"><span style="width:${called.othersPct}%"></span></span></span>` : '');
  return `<section class="mvr" aria-labelledby="mvr-h">
    <div class="section-header"><h2 id="mvr-h">Who called it <span class="section-header__sub">${called.total} ballot${called.total === 1 ? '' : 's'}</span></h2></div>
    <div class="mvr-grid">
      <div class="card mvr-card"><span class="mvr-kicker">Your ballot</span>${mine}</div>
      <div class="card mvr-card"><span class="mvr-kicker">The league’s #1</span><h3>Who ballots put 1st</h3>${firsts}</div>
      <div class="card mvr-card"><span class="mvr-kicker">Called it</span><h3>Perfect podiums</h3>
        ${called.perfect.length ? `<span class="mvr-perfect">${avatarStack(called.perfect, { size: 34, max: 8, link: true })}<span><b>${called.perfect.length}</b> got all three, in order</span></span>` : '<p class="mvr-note">Nobody got all three in order.</p>'}
        <dl class="mvr-stats"><div><dt>Picked the MVP</dt><dd>${called.pickedMvp}%</dd></div><div><dt>Right three, any order</dt><dd>${called.rightThree}%</dd></div></dl>
      </div>
    </div>
  </section>`;
}

// ── The podium attention bar (every page, above the header) ───────────────────────────────
// Only for a logged-in player with no complete ballot who hasn't closed it, while the bonus
// is open (server.js podiumBarState). The whole bar is one link to the ballot; × sits outside
// the link and removes it for good (POST /api/mvp/bar/dismiss). Desktop counts down to the
// cut-off (amber in the final 24 hours); phones get one compact row with no countdown.
// deadline: epoch ms of the bonus cut-off, or null when the schedule can't say yet.
export function podiumBarHtml({ deadline = null, faces = [] }) {
  const CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  const last = deadline && deadline - Date.now() < 24 * 3600 * 1000;
  const av = (f, i) => `<span class="pl-av pdb-av${i >= 3 ? ' pdb-av--wide' : ''}" style="--team:${teamColor(f.team)}"><span>${escHtml(initials(displayPlayerName(f.name)))}</span><img src="${playerPhotoUrl(String(f.id), 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  const tile = (k, u) => `<span class="pdb-tile" data-pdb-${k}><b class="font-condensed">--</b><small>${u}</small></span>`;
  return `<div class="pdb${last ? ' is-last' : ''}" data-pdb${deadline ? ` data-deadline="${deadline}"` : ''}>
  <a class="pdb__link" href="/mvp#ballot">
    <span class="pdb__faces">${faces.map(av).join('')}</span>
    <span class="pdb__text"><span class="pdb__last">Last day: </span><b>Ten cases. Your call.</b><span class="pdb__wide"> Pick the MVP podium for up to</span><span class="pdb__narrow"> MVP podium ·</span> <em>+3<span class="pdb__wide"> Pickmaster points</span><span class="pdb__narrow"> pts</span></em></span>
    ${deadline ? `<span class="pdb__count"><small class="pdb__count-lbl">${last ? 'Last day · closes in' : 'Closes in'}</small>${tile('d', 'DAYS')}${tile('h', 'HRS')}${tile('m', 'MIN')}${tile('s', 'SEC')}</span>` : '<span class="pdb__count pdb__count--text">Closes Sunday 6 AM</span>'}
    <span class="pdb__cta"><span class="pdb__wide">Click to pick</span><span class="pdb__narrow">Tap to pick</span>${CHEV}</span>
  </a>
  <button type="button" class="pdb__x" data-pdb-x aria-label="Hide this for good"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
</div>
<script>
(function () {
  var top = document.querySelector('[data-pdb]');
  if (!top) return;
  // The bar sits at the top of the page; once it scrolls out of view a copy slides up docked
  // at the bottom of the screen (pages have their own sticky bars up top), and slides away
  // again when the top one is back in view.
  var dock = top.cloneNode(true);
  dock.removeAttribute('data-pdb');
  dock.setAttribute('data-pdb-dock', '');
  dock.classList.add('pdb--dock');
  dock.setAttribute('aria-hidden', 'true');
  dock.inert = true;
  document.body.appendChild(dock);
  var bars = [top, dock];
  function gone() { bars.forEach(function (b) { b.remove(); }); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var off = !es[0].isIntersecting && es[0].boundingClientRect.top < 0;
      dock.classList.toggle('is-on', off);
      dock.setAttribute('aria-hidden', off ? 'false' : 'true');
      dock.inert = !off;
    }).observe(top);
  }
  var end = Number(top.dataset.deadline || 0);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    if (!end) return;
    var left = Math.max(0, end - Date.now());
    if (!left) { gone(); return; }
    var s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    var last = left < 86400000;
    bars.forEach(function (bar) {
      if (!bar.querySelector('[data-pdb-d]')) return;
      bar.classList.toggle('is-last', last);
      var dt = bar.querySelector('[data-pdb-d]'); dt.hidden = last; dt.querySelector('b').textContent = d;
      bar.querySelector('[data-pdb-h] b').textContent = pad(h);
      bar.querySelector('[data-pdb-m] b').textContent = pad(m);
      bar.querySelector('[data-pdb-s] b').textContent = pad(s % 60);
      var lbl = bar.querySelector('.pdb__count-lbl'); if (lbl) lbl.textContent = last ? 'Last day · closes in' : 'Closes in';
    });
  }
  tick(); setInterval(tick, 1000);
  bars.forEach(function (bar) {
    bar.querySelector('[data-pdb-x]').addEventListener('click', function () {
      gone();
      fetch('/api/mvp/bar/dismiss', { method: 'POST' }).catch(function () {});
    });
  });
})();
</script>`;
}

// ── The season-pick strip + picker (/picks, under Open picks) ────────────────────────────
// ballot = server.js mvpBallotState; ten = mvpLockLite ([{ id, name, team, ppg }]); scored =
// after the reveal, mvpPodiumReveal's view of your ballot. The picker is a <dialog> (a bottom
// sheet on phones) with the ten and 1/2/3 buttons; it saves on tap through /api/mvp/ballot,
// same rules as /mvp. Styles: styles.css "Season-pick strip" (pss- prefix).
export function podiumStrip({ ballot = null, ten = [], scored = null }) {
  const byId = Object.fromEntries(ten.map(p => [String(p.id), p]));
  const ORDS = ['1st', '2nd', '3rd'];
  const av = p => `<span class="pl-av pss-av" style="--team:${teamColor(p.team)}"><span>${escHtml(initials(displayPlayerName(p.name)))}</span><img src="${playerPhotoUrl(String(p.id), 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  if (scored) {
    if (!scored.mine) return '';
    return `<section class="pss" aria-label="Your MVP podium">
    <span class="pss__lbl"><span class="pss__kick">Season pick · scored</span><b>Your podium: ${scored.bonus != null ? `+${scored.bonus}` : `${scored.mine.spots} of 3`}</b><small>${scored.mine.spots} of 3 spots exact</small></span>
    <span class="pss__slots">${scored.mine.picks.map((p, i) => `<span class="pss-slot"><b class="font-condensed">${i + 1}</b><span>${escHtml(splitName(p.name).last)}</span><small>${scored.mine.exact[i] ? '✓' : '✗'}</small></span>`).join('')}</span>
    <a class="pss__link" href="/mvp#mvr-h">Who called it →</a>
  </section>`;
  }
  if (!ballot || !ballot.enabled || !ten.length) return '';
  const slotHtml = (pid, i) => {
    const p = pid && byId[pid];
    return p ? `<span class="pss-slot" data-pss-slot="${i}"><b class="font-condensed">${i + 1}</b>${av(p)}<span>${escHtml(splitName(p.name).last)}</span></span>`
      : `<span class="pss-slot is-empty" data-pss-slot="${i}"><b class="font-condensed">${i + 1}</b><span>Pick</span></span>`;
  };
  const n = ballot.picks.filter(Boolean).length;
  const action = ballot.closed ? '<span class="pss__note">Ballots closed</span>'
    : !ballot.loggedIn ? `<a class="pss-btn" href="/login?next=${encodeURIComponent('/picks')}">Log in to call it</a>`
    : !ballot.bonusOpen ? `<span class="pss__locked"><b>Bonus ballot locked</b><button type="button" class="pss__change" data-pss-open>Change for Who called it →</button></span>`
    : `<button type="button" class="pss-btn${n === 3 ? ' pss-btn--quiet' : ''}" data-pss-open data-pss-cta>${n === 3 ? '✓ Locked in · change' : n ? `Pick your ${ORDS[ballot.picks.indexOf(null)]}` : 'Call the podium'}</button>`;
  const rows = ten.map(p => `<li class="pss-row" data-pid="${escHtml(String(p.id))}">
      ${av(p)}
      <span class="pss-row__who"><b>${escHtml(splitName(p.name).last)}</b> <span>${escHtml(splitName(p.name).first)}</span><small><i style="background:${teamColor(p.team)}"></i>${escHtml(p.team)} · ${escHtml(p.ppg)} PPG</small></span>
      <span class="pss-row__picks">${[1, 2, 3].map(k => `<button type="button" class="pss-pick" data-pss-pick="${k}" aria-pressed="false" aria-label="${escHtml(splitName(p.name).last)} ${ORDS[k - 1]}">${k}</button>`).join('')}</span>
    </li>`).join('');
  const state = { picks: ballot.picks, bonusOpen: ballot.bonusOpen, names: Object.fromEntries(ten.map(p => [p.id, splitName(p.name).last])) };
  return `<section class="pss" aria-label="Season pick: the MVP podium" data-pss>
    <span class="pss__lbl"><span class="pss__kick">Season pick · up to +3</span><b>Call the MVP podium</b><small>${ballot.bonusOpen ? `Bonus closes ${escHtml(ballot.bonusAt ? ballot.bonusAt.split(' · ').join(', ') : 'Sunday 6 AM')}` : 'Scored at Finals Game 2'}</small></span>
    <span class="pss__slots" data-pss-slots>${ballot.picks.map(slotHtml).join('')}</span>
    ${action}
  </section>
  ${ballot.loggedIn && !ballot.closed ? `<dialog class="pss-dlg" data-pss-dlg aria-labelledby="pss-dlg-h">
    <div class="pss-dlg__head"><span><span class="pss__kick">Season pick · up to +3</span><h2 id="pss-dlg-h">Call the MVP podium</h2></span><button type="button" class="pss-dlg__x" data-pss-close aria-label="Close">×</button></div>
    <span class="pss__slots" data-pss-slots>${ballot.picks.map(slotHtml).join('')}</span>
    <p class="pss-dlg__hint" data-pss-status>The ten, shuffled · tap 1, 2 or 3 · saves as you tap</p>
    <ul class="pss-list" data-pss-list>${rows}</ul>
    <a class="pss-dlg__more" href="/mvp">Read every case on /mvp →</a>
  </dialog>
  <script type="application/json" id="pss-state">${JSON.stringify(state).replace(/</g, '\\u003c')}</script>
  ${podiumStripScript()}` : ''}`;
}

function podiumStripScript() {
  return `<script>
(function () {
  var box = document.querySelector('[data-pss]'), dlg = document.querySelector('[data-pss-dlg]');
  if (!box || !dlg) return;
  var st = JSON.parse(document.getElementById('pss-state').textContent);
  var list = dlg.querySelector('[data-pss-list]'), statusEl = dlg.querySelector('[data-pss-status]');
  var ORD = ['1st', '2nd', '3rd'];
  // Shuffle the ten each visit (the order means nothing).
  var items = Array.prototype.slice.call(list.children);
  while (items.length) { var j = Math.floor(Math.random() * items.length); list.appendChild(items[j]); items.splice(j, 1); }
  function rowOf(pid) { return list.querySelector('[data-pid="' + pid + '"]'); }
  function slotHtml(pid, i) {
    var r = pid && rowOf(pid);
    if (!r) return '<span class="pss-slot is-empty" data-pss-slot="' + i + '"><b class="font-condensed">' + (i + 1) + '</b><span>Pick</span></span>';
    return '<span class="pss-slot" data-pss-slot="' + i + '"><b class="font-condensed">' + (i + 1) + '</b>' + r.querySelector('.pss-av').outerHTML + '<span>' + st.names[pid] + '</span></span>';
  }
  function paint(prev) {
    document.querySelectorAll('[data-pss-slots]').forEach(function (s) { s.innerHTML = st.picks.map(slotHtml).join(''); });
    list.querySelectorAll('.pss-row').forEach(function (r) {
      var at = st.picks.indexOf(r.dataset.pid);
      r.classList.toggle('is-mine', at !== -1);
      r.querySelectorAll('[data-pss-pick]').forEach(function (b) { var on = Number(b.dataset.pssPick) - 1 === at; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    });
    var n = st.picks.filter(Boolean).length, cta = box.querySelector('[data-pss-cta]');
    if (cta) { cta.textContent = n === 3 ? '✓ Locked in · change' : n ? 'Pick your ' + ORD[st.picks.indexOf(null)] : 'Call the podium'; cta.classList.toggle('pss-btn--quiet', n === 3); }
    if (prev) st.picks.forEach(function (pid, i) {
      if (!pid || pid === prev[i]) return;
      document.querySelectorAll('[data-pss-slot="' + i + '"]').forEach(function (el) { el.classList.add('is-new'); });
      var b = rowOf(pid) && rowOf(pid).querySelector('[data-pss-pick="' + (i + 1) + '"]'); if (b) b.classList.add('is-pop');
    });
  }
  var saving = 0;
  function save(next) {
    var prev = st.picks.slice(); st.picks = next; paint(prev); statusEl.textContent = 'Saving…';
    var mine = ++saving;
    fetch('/api/mvp/ballot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p1: next[0], p2: next[1], p3: next[2] }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not save.'); return d; }); })
      .then(function () {
        if (mine !== saving) return;
        var done = st.picks.every(Boolean);
        statusEl.textContent = done ? (st.bonusOpen ? '✓ Locked in for the bonus. Change it any time before the cut-off.' : '✓ Saved for Who called it.') : st.picks.filter(Boolean).length + ' of 3 picked · saves as you tap';
        // The site bar has done its job: a quick confirmation, then it goes.
        if (done) document.querySelectorAll('[data-pdb], [data-pdb-dock]').forEach(function (bar) {
          bar.querySelector('.pdb__link').innerHTML = '<span class="pdb__text"><b>You\u2019re in.</b> Your podium counts for the bonus.</span>';
          setTimeout(function () { bar.remove(); }, 3500);
        });
      })
      .catch(function (err) { if (mine !== saving) return; st.picks = prev; paint(); statusEl.textContent = err.message; });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-pss-open]')) { e.preventDefault(); dlg.showModal(); return; }
    if (e.target.closest('[data-pss-close]') || e.target === dlg) { dlg.close(); return; }
    var b = e.target.closest('[data-pss-pick]');
    if (!b) return;
    var pid = b.closest('.pss-row').dataset.pid, at = Number(b.dataset.pssPick) - 1, next = st.picks.slice();
    if (next[at] === pid) next[at] = null;
    else { var was = next.indexOf(pid); if (was !== -1) next[was] = null; next[at] = pid; }
    save(next);
  });
  document.addEventListener('animationend', function (e) { if (e.target.classList) e.target.classList.remove('is-new', 'is-pop'); });
  paint();
})();
</script>`;
}
