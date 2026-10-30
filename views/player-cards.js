// Box score player cards (Paolo, 2026-10-30; mockup claude.ai/artifact/QyYMf51jSBCFrSK3ddi1ss, row
// "Box score"): the top 3 as cards above a box score (Player of the Game / Day first, amber; 2nd
// and 3rd in silver and bronze; from either team), and a card for anyone in the table: a row
// marked data-pcard="<key>" opens that player's card in a sheet (public/player-cards.js, loaded
// on the site and in the app). One markup for both; styled in public/styles.css and
// public/app.css ("Player cards").
//
// p: { key, name, number, photo, ini, ring (a CSS colour), team (label), note, stats: [[label,
// value]…], lines: [[label, value]…] (the card's extra rows: each game, the season), href }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The name as two lines: p.first / p.last when given ("Paul Erickson" / "Sarmiento"), else split.
const first = p => (p.first != null ? p.first : String(p.name || '').split(' ')[0]);
const rest = p => (p.last != null ? p.last : String(p.name || '').split(' ').slice(1).join(' ') || String(p.name || ''));

const avatar = (p, size) => `<span class="pcd__av" style="--ring:${esc(p.ring || 'var(--border)')};--sz:${size}px" aria-hidden="true">${esc(p.ini || '')}${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`;
const statRow = stats => `<span class="pcd__st" style="--n:${stats.length}">${stats.map(([k, v]) => `<span><b class="num">${esc(v)}</b><small>${esc(k)}</small></span>`).join('')}</span>`;

// The row of three. firstLabel: 'Player of the Day' | 'Player of the Game'.
export function topThreeCards(people, { firstLabel = 'Player of the Game', label = '' } = {}) {
  const top = people.slice(0, 3);
  if (!top.length) return '';
  const rank = ['', 'rank--2', 'rank--3'];
  const tag = i => (i === 0 ? firstLabel : i === 1 ? '2nd' : '3rd');
  return `${label ? `<div class="pcd-h"><span>${esc(label)}</span>${top.length > 1 ? '<small>Tap a card for more</small>' : ''}</div>` : ''}
  <div class="pcd-row" role="list">${top.map((p, i) => `<button type="button" class="pcd${i === 0 ? ' pcd--1' : ''}" role="listitem" data-pcard="${esc(p.key)}" aria-label="${esc(tag(i))}: ${esc(p.name)}">
      <span class="pcd__rank ${rank[i]}">${esc(tag(i))}</span>
      ${p.number ? `<b class="pcd__ghost num" aria-hidden="true">${esc(p.number)}</b>` : ''}
      <span class="pcd__top">${avatar(p, 52)}<span class="pcd__who"><small>${esc(first(p))}</small><b class="num">${esc(rest(p).toUpperCase())}</b><small class="pcd__team">${esc([p.team, p.number ? `#${p.number}` : ''].filter(Boolean).join(' · '))}</small></span></span>
      ${statRow(p.stats)}
    </button>`).join('')}</div>`;
}

// Every player's full card, kept in the page until a row or card asks for it.
export function playerCardTemplates(people) {
  return people.map(p => `<template data-pcard-t="${esc(p.key)}"><div class="pcd-sheet__card">
      ${p.number ? `<b class="pcd__ghost num" aria-hidden="true">${esc(p.number)}</b>` : ''}
      <div class="pcd__top">${avatar(p, 64)}<span class="pcd__who"><small>${esc(first(p))}</small><b class="num">${esc(rest(p).toUpperCase())}</b><small class="pcd__team">${esc([p.team, p.number ? `#${p.number}` : '', p.note].filter(Boolean).join(' · '))}</small></span></div>
      ${statRow(p.stats)}
    </div>
    ${p.lines && p.lines.length ? `<div class="pcd-sheet__lines">${p.lines.map(([k, v]) => `<div><span>${esc(k)}</span><b class="num">${esc(v)}</b></div>`).join('')}</div>` : ''}
    ${p.href ? `<a class="pcd-sheet__btn" href="${esc(p.href)}">See profile</a>` : ''}
  </template>`).join('');
}
