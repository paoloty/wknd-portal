import { escHtml } from './layout.js';
import { teamColor } from './utils.js';

// ── Homepage playoff scoreboard ───────────────────────────────────────────────
// Leads the homepage while playoff mode (lib/playoff-mode.js) is in its 'playoffs' or
// 'finals' phase: the live series as an arena scoreboard (seeds, series wins, wins still
// needed), a day countdown to the next game, and a cover photo from an earlier meeting of
// the two teams behind it. One markup for every width: styles.css (.pso) places the same
// cells as one wide row on desktop and as two team rows on phones.
//
// d (server.js buildPlayoffHero): { season, label, gameNo, format, high, low, next, photos,
// tipLabel, also, picksHref, line } — high/low: { team: { id, name }, seed, wins, need };
// next: { id, href, date } | null; photos: [{ id, href, caption }] (0–4, crossfading with a
// slow zoom, each with its own caption chip); tipLabel: '6 AM';
// also: { label, high, low, date, href } | null (the other live series).

const ORD = ['1st', '2nd', '3rd', '4th'];
const dayLabel = ymd => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// Games have a date but no tip-off time, so the countdown is in days.
function countdown(next, today, tip) {
  if (!next?.date) return { big: 'TBA', small: 'Date to be announced' };
  const days = Math.round((Date.parse(`${next.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const when = `${dayLabel(next.date)}${tip ? ` · ${tip}` : ''}`;
  if (days > 1) return { big: String(days), small: `days · ${when}` };
  if (days === 1) return { big: 'Tomorrow', small: when };
  if (days === 0) return { big: 'Game day', small: when };
  return { big: 'Final soon', small: `Played ${dayLabel(next.date)}, result coming` };
}

function sideCells(side, key) {
  const t = side.team;
  const left = Math.max(0, side.need - side.wins);
  const sub = `${side.seed ? `${ORD[side.seed - 1]} seed · ` : ''}needs ${left} win${left === 1 ? '' : 's'}`;
  return `<span class="pso__rowbg pso__rowbg--${key}" aria-hidden="true"></span>
    <span class="pso__seed pso__seed--${key} font-condensed${side.seed === 1 || side.seed === 2 ? ' is-top' : ''}">${side.seed || ''}</span>
    <a href="/teams/${encodeURIComponent(t.id)}" class="pso__team pso__team--${key}">
      <span class="pso__name font-condensed">${escHtml(t.name)}</span>
      <span class="pso__sub"><span class="team-dot" style="background:${teamColor(t.name)}"></span>${sub}</span>
    </a>
    <span class="pso__wins pso__wins--${key} font-condensed" aria-label="${escHtml(t.name)} series wins">${side.wins}</span>`;
}

export function playoffScoreboard(d, today) {
  if (!d) return '';
  const cd = countdown(d.next, today, d.tipLabel);
  // The game is being scored (server.js liveMini): its live score takes the countdown's place.
  const L = d.next?.live;
  const lead = L ? (L.a === L.b ? 'Tied' : `${L.a > L.b ? L.an : L.bn} lead${/s$/i.test(L.a > L.b ? L.an : L.bn) ? '' : 's'}`) : '';
  const photos = d.photos || [];
  const n = photos.length;
  // Each slide and its caption share --i, so they fade in and out together (styles.css .pso--n2–4).
  const photo = n ? `<div class="pso__bg" aria-hidden="true">${photos.map((p, i) => {
    const src = `/api/photo/${encodeURIComponent(p.id)}`;
    return `<img class="pso__slide" style="--i:${i}" src="${src}" srcset="${src}?w=640 640w, ${src}?w=960 960w, ${src} 1200w" sizes="(max-width: 760px) 100vw, 1200px" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`;
  }).join('')}</div>` : '';
  const credits = n ? `<div class="pso__credits">${photos.map((p, i) => `<a href="${escHtml(p.href)}" class="pso__credit" style="--i:${i}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>${escHtml(p.caption)}</span></a>`).join('')}</div>` : '';
  const also = d.also ? `<a href="${escHtml(d.also.href)}" class="pso-also card">
    <span class="pso-also__kicker">${escHtml(d.also.date ? `Also ${dayLabel(d.also.date).split(',')[0]}` : 'Also in the playoffs')} · ${escHtml(d.also.label)}</span>
    <span class="pso-also__teams font-condensed">${[d.also.high, d.also.low].map(s => `<span class="pso-also__team"><b class="${s.seed <= 2 ? 'is-top' : ''}">${s.seed || ''}</b><span class="team-dot" style="background:${teamColor(s.team.name)}"></span>${escHtml(s.team.name)}</span>`).join('<span class="pso-also__vs">vs</span>')}</span>
    <span class="pso-also__go" aria-hidden="true">&rarr;</span>
  </a>` : '';

  return `<section class="pso${n ? ' has-photo' : ''}${n > 1 ? ` pso--n${n}` : ''}" aria-labelledby="pso-h">
  ${photo}
  <div class="pso__shade" aria-hidden="true"></div>
  <div class="pso__body">
    <div class="pso__kicker"><span class="pso__rule" aria-hidden="true"></span><h2 id="pso-h">${d.label === 'Finals' ? `<span class="pso__kpre">Season ${escHtml(String(d.season))} </span>Finals` : `<span class="pso__kpre">Season ${escHtml(String(d.season))} Playoffs · </span>${escHtml(d.label)}`}${d.gameNo ? ` · Game ${d.gameNo}` : ''}</h2><span class="pso__rule" aria-hidden="true"></span></div>
    <div class="pso__format">${escHtml(d.format)}</div>
    <div class="pso__board">
      <span class="pso__slabel">Series</span>
      ${sideCells(d.high, 'a')}
      <span class="pso__dash font-condensed" aria-hidden="true">–</span>
      ${sideCells(d.low, 'b')}
    </div>
    ${d.line ? `<p class="pso__line">${d.line}</p>` : ''}
    <div class="pso__foot">
      ${L ? `<div class="pso__when pso__when--live"><span class="pso__th">${d.gameNo ? `Game ${d.gameNo} · ` : ''}${L.when.startsWith('Final') ? 'Final · unofficial' : 'Live · unofficial'}</span><span class="pso__cd font-condensed">${escHtml(`${L.an} ${L.a}–${L.b} ${L.bn}`)}</span><span class="pso__cdsub">${escHtml(L.when.startsWith('Final') ? lead.replace(/leads?$/, 'won') : `${lead} · ${L.when}`)}</span></div>`
        : `<div class="pso__when"><span class="pso__th">${d.gameNo ? `Game ${d.gameNo} tips off` : 'Next game'}</span><span class="pso__cd font-condensed">${escHtml(cd.big)}</span><span class="pso__cdsub">${escHtml(cd.small)}</span></div>`}
      <div class="pso__actions">
        ${L ? `<a href="${escHtml(L.href)}" class="pso__btn is-primary">Follow it live</a>` : ''}
        ${d.picksHref && !L ? `<a href="${escHtml(d.picksHref)}" class="pso__btn is-primary">Who wins? Make your pick</a>` : ''}
        <a href="/playoffs" class="pso__btn${d.picksHref || L ? '' : ' is-primary'}">The bracket</a>
      </div>
    </div>
  </div>
  ${credits}
</section>
${also}`;
}
