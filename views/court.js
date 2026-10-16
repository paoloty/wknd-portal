// Public court pages: /courts (every court with a page), /courts/:slug and the owners' page
// /courts/:slug/partner. Data: lib/court-page.js buildCourtPage + server.js courtViewerExtras;
// styles: public/courts.css. Mockup (Booking layout, refined):
// https://claude.ai/artifact/VUzXbTmvbnr9EEnuHphhEM
// Ratings, run votes, rent requests and the partner link each show only with their switch on.
import { escHtml } from './layout.js';
import { avatarStack, shareIcon, playerPhotoUrl, initials, displayPlayerName } from './utils.js';
import { gameCard, gameCardScript } from './games.js';
import { sectionNavScript } from './section-nav.js';
import { courtInfoTags, parseJson, RATING_ASPECTS, RATING_TAGS_GOOD, RATING_TAGS_BAD, RATING_MIN_FOR_SCORE } from '../lib/court-page.js';

const MESSENGER_URL = 'https://m.me/wkndbasketball';
const ymdLabel = (ymd, opts) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', opts);
const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;
const dh = h => { const t = Math.round(h); return t < 24 ? `${t}h` : `${Math.floor(t / 24)}d ${t % 24}h`; };
const mapsHref = c => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address || `${c.name} ${c.city || ''}`)}`;
const svg = (d, size = 16, sw = 2.2, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  tick: svg('<path d="M20 6L9 17l-5-5"/>', 14, 2.8),
  chev: svg('<path d="M9 18l6-6-6-6"/>', 14, 2.4),
  prev: svg('<path d="M15 18l-6-6 6-6"/>', 16, 2.4),
  next: svg('<path d="M9 18l6-6-6-6"/>', 16, 2.4),
  out: svg('<path d="M7 17L17 7"/><path d="M8 7h9v9"/>', 14),
  pin: svg('<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>', 16, 2, 'crt-ico'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', 18, 2.2, 'crt-ico'),
  inbox: svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>', 18, 2.2, 'crt-ico'),
  shield: svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>', 16, 2.2, 'crt-ico'),
  chart: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', 18),
  bubble: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 18),
};
const star = (on, size = 14) => `<svg${on ? '' : ' class="off"'} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>`;
const stars = (v, label = '') => `<span class="crt-stars"${label ? ` role="img" aria-label="${escHtml(label)}"` : ' aria-hidden="true"'}>${[1, 2, 3, 4, 5].map(i => star(v >= i - 0.25)).join('')}</span>`;
const avatar = (id, name) => `<span class="crt-av"><span>${escHtml(initials(name))}</span><img src="${playerPhotoUrl(id, 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
const sh = (title, { sub = '', id = '', link = '' } = {}) => `<div class="section-header crt-sh"><h2${id ? ` id="${id}"` : ''}>${escHtml(title)}${sub ? ` <span class="section-header__sub">${escHtml(sub)}</span>` : ''}</h2>${link}</div>`;

// ── Gallery: equal cards, three across, scroll for more ──
function gallery(p) {
  const ph = p.photos;
  if (!ph.length) return '';
  const per = Math.min(3, ph.length);
  // One height for every card, each as wide as its photo's shape (no cropping): the first
  // `per` cards fill the row exactly, so the height is the row width over their summed ratios.
  const r = x => Number(x.ratio) || 16 / 9;
  const sum = ph.slice(0, per).reduce((a, x) => a + r(x), 0);
  return `<section class="crt-gal" style="--gal-n:${per};--gal-r:${sum.toFixed(4)};--gal-r0:${r(ph[0]).toFixed(4)};--gal-fill:${ph.length > per ? 0.93 : 1}" aria-label="Photos of ${escHtml(p.name)}" data-crt-gallery>
    <div class="crt-gal__track">${ph.map((x, i) => `<figure class="crt-gal__card" style="aspect-ratio:${r(x).toFixed(4)}"><img src="${escHtml(x.src)}" alt="${escHtml(x.alt)}"${i < per ? (i ? '' : ' fetchpriority="high"') : ' loading="lazy"'}><figcaption><span class="crt-kicker">${escHtml(x.tag)}</span><b>${escHtml(x.caption)}</b></figcaption></figure>`).join('')}</div>
    ${railBar(ph.length, per, 'photos')}
  </section>`;
}

// ── Title block + About (left), next run (right) ──
function head(p, court, x, isAdmin) {
  const n = p.numbers;
  const commute = (p.info.directions || '').split(/(?<=\.)\s/)[0] || court.address || '';
  const r = x.flags.ratings && x.ratings?.showScore ? x.ratings : null;
  // label, value, context: one strip card, the numbers in Saira.
  const lg = n.league.games, pw = n.papawis.runs;
  const chips = [
    n.games && ['Games here', String(n.games), [pw && plural(pw, 'run'), lg && plural(lg, 'league game')].filter(Boolean).join(' · ')],
    n.players && ['Players', String(n.players), n.since ? `since ${n.since}` : 'have played here'],
    p.players >= 5 && ['Came back', `${n.cameBackPct}%`, `${plural(n.cameBack, 'player')} ran here 2+ times`],
    n.papawis.fastestH != null && ['Fastest sell-out', dh(n.papawis.fastestH), p.fastest ? `the ${ymdLabel(p.fastest.ymd, { month: 'short', day: 'numeric' })} run` : 'first sign-up to full'],
  ].filter(Boolean).slice(0, 4);
  const paras = String(court.writeup || '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  return `<header class="crt-head">
      <div class="crt-head__top"><nav class="crt-crumbs" aria-label="Breadcrumb"><a href="/papawis">Papawis</a><span aria-hidden="true">/</span><a href="/courts">Courts</a></nav>${isAdmin ? `<a class="crt-link" href="/admin/papawis/courts/${encodeURIComponent(court.id)}">Edit this court</a>` : ''}</div>
      <span class="crt-kicker">Basketball court${p.city ? ` · ${escHtml(p.city)}` : ''}</span>
      <h1 class="crt-h1">${escHtml(p.name)}</h1>
      ${commute ? `<p class="crt-line">${ICON.pin}<span>${escHtml(commute)}</span></p>` : ''}
      ${r ? `<div class="crt-rateline">${stars(r.avg)}<b>${r.avg.toFixed(1)}</b><span>${plural(r.n, 'player rating')}</span><a href="#crt-say">What players say</a></div>` : ''}
      ${chips.length ? `<dl class="crt-chips crt-chips--${chips.length}">${chips.map(([l, val, sub]) => `<div class="crt-chip"><dt>${escHtml(l)}</dt><dd><b class="crt-num">${escHtml(val)}</b><span>${escHtml(sub)}</span></dd></div>`).join('')}</dl>` : ''}
    </header>
    ${paras.length ? `<section class="crt-about" id="crt-about" aria-labelledby="crt-about-h">${sh('About this court', { id: 'crt-about-h' })}<div class="crt-about__text">${paras.map(t => `<p>${escHtml(t)}</p>`).join('')}</div></section>` : ''}`;
}

function runPanel(p, court, x) {
  const r = p.nextRun;
  const partnerLine = x.flags.partner ? `<div class="card crt-partnerline"><span>Run this court?</span><a href="/courts/${encodeURIComponent(court.slug)}/partner">Become a partner ${ICON.chev}</a></div>` : '';
  if (!r) {
    return `<aside class="crt-panel" aria-label="Next run"><div class="card crt-book">
      <span class="crt-kicker">Next Papawis run</span>
      <b class="crt-book__none">No run posted here yet</b>
      <p class="crt-muted">Runs go up on the Papawis page. ${x.flags.votes && x.slots?.length ? 'Vote for one below.' : 'Follow it to catch the next one.'}</p>
      <a class="crt-btn crt-btn--amber crt-btn--block" href="/papawis">See Papawis runs</a>
    </div>${partnerLine}</aside>`;
  }
  const max = Number(r.max_slots) || 0;
  const conf = x.nextConfirmed ?? r.confirmed;
  const full = max && conf >= max;
  const hours = (() => { const t = s => { const [h, m] = String(s || '').split(':').map(Number); return h + (m || 0) / 60; }; const d = t(r.end_time) - t(r.start_time); return d > 0 ? d : 0; })();
  const bits = [hours && plural(Math.round(hours * 10) / 10, 'hour'), max && `${max} players`, r.has_referee && 'referee'].filter(Boolean).join(' · ');
  const papawis = p.numbers.papawis;
  const record = papawis.runs && papawis.slotsPct === 100
    ? `Every run here has sold out.${papawis.fastestH != null ? ` The fastest filled in ${dh(papawis.fastestH)}.` : ''}`
    : papawis.fastestH != null ? `The fastest run here filled in ${dh(papawis.fastestH)}.` : '';
  const href = `/papawis#pw-game-${encodeURIComponent(r.id)}`;
  const status = !max ? `${plural(conf, 'player')} in` : full ? `${conf}/${max} full${x.nextWaitlist ? ` · ${x.nextWaitlist} on the waitlist` : ''}` : `${conf}/${max} in · ${plural(max - conf, 'slot')} left`;
  return `<aside class="crt-panel" aria-label="Next run"><div class="card crt-book">
      <span class="crt-kicker">Next Papawis run</span>
      <div class="crt-book__run"><div class="crt-date"><span>${escHtml(ymdLabel(r.ymd, { month: 'short' }).toUpperCase())}</span><b class="crt-num">${escHtml(ymdLabel(r.ymd, { day: 'numeric' }))}</b></div>
        <div class="crt-book__when"><b>${escHtml(ymdLabel(r.ymd, { weekday: 'long' }))}${r.time ? ` · ${escHtml(r.time)}` : ''}</b>${bits ? `<span>${escHtml(bits)}</span>` : ''}</div></div>
      <div class="crt-urg"><b>${escHtml(status)}</b>
        ${x.nextFaces?.length ? avatarStack(x.nextFaces, { size: 30, max: 7, total: conf, className: 'crt-urg__stack', label: `${conf} players are in` }) : ''}
        ${record ? `<p>${escHtml(record)}</p>` : ''}</div>
      ${x.nextPrice ? `<div class="crt-price"><b class="crt-num">₱${escHtml(String(x.nextPrice))}</b><span>per player${r.has_referee ? ' · ref included' : ''} · estimate</span></div>` : ''}
      <div class="crt-book__btns"><a class="crt-btn crt-btn--amber crt-btn--block" href="${href}">${full ? 'Join the waitlist' : 'Sign up'}</a>
        ${x.shareUrl ? `<button type="button" class="crt-btn crt-btn--ghost crt-btn--block" data-share="${escHtml(x.shareUrl)}">${shareIcon(15)}<span>Share this run</span></button>` : ''}</div>
    </div>${partnerLine}</aside>`;
}

// ── Sections ──
function crowd(p, x, isLoggedIn) {
  if (!p.players) return '';
  const k = x.known;
  const rowKnown = k && (k.teammates || k.ranWith)
    ? `<div class="crt-rw">${avatarStack(k.faces, { size: 32, max: 5, moreBubble: false })}
        <div class="crt-rw__text"><b>${[k.teammates && plural(k.teammates, 'of your teammates', 'of your teammates'), k.ranWith && plural(k.ranWith, 'player you’ve run with', 'players you’ve run with')].filter(Boolean).join(' and ')} ${k.teammates + k.ranWith === 1 ? 'has' : 'have'} played here</b><span>${escHtml(`${p.players} players have run here, and ${p.cameBack} came back for more.`)}</span></div>
        <a class="crt-rw__link" href="/papawis">See Papawis runs ${ICON.chev}</a></div>`
    : `<div class="crt-rw">${avatarStack(p.regulars.map(r => ({ id: r.id, name: r.name })), { size: 32, max: 4, moreBubble: false })}
        <div class="crt-rw__text"><b>${escHtml(`${p.players} players have run here${p.cameBack ? `, and ${p.cameBack} came back for more` : ''}`)}</b><span>${isLoggedIn ? 'None of your teammates or the players you’ve run with have played here yet.' : 'Log in to see which of your teammates and the players you’ve run with have played here.'}</span></div>
        ${isLoggedIn ? `<a class="crt-rw__link" href="/papawis">See Papawis runs ${ICON.chev}</a>` : `<a class="crt-rw__link" href="/login?next=${encodeURIComponent(`/courts/${p.slug}`)}">Log in to see who ${ICON.chev}</a>`}</div>`;
  const first = p.firstHere
    ? `<div class="crt-rw"><b class="crt-rw__big crt-num">${p.firstHere}</b>
        <div class="crt-rw__text"><b>Good first court</b><span>${escHtml(`${plural(p.firstHere, 'player')} played ${p.firstHere === 1 ? 'their' : 'their'} first-ever Papawis here.${p.refereed && p.refereed === p.playedRuns ? ' Every run had a referee.' : ''}`)}</span></div>
        ${isLoggedIn ? '' : `<a class="crt-rw__link" href="/register" data-cta="court-join">Join WKND ${ICON.chev}</a>`}</div>` : '';
  return `<section class="crt-sec" id="crt-crowd" aria-labelledby="crt-crowd-h">${sh('Who plays here', { id: 'crt-crowd-h' })}<div class="card crt-rows">${rowKnown}${first}</div></section>`;
}

function numbers(p) {
  const n = p.numbers, pw = n.papawis, lg = n.league;
  if (!n.games) return '';
  const kv = (k, v) => `<div class="crt-kv"><span>${escHtml(k)}</span><b>${escHtml(v)}</b></div>`;
  const tops = [
    [String(n.games), 'Games played here', [pw.runs && plural(pw.runs, 'Papawis run'), lg.games && plural(lg.games, 'league game')].filter(Boolean).join(' · ')],
    [String(n.players), 'Different players', lg.games && pw.runs ? 'across runs and league games' : pw.runs ? 'members who ran here' : 'who played league games here'],
    [String(n.showUps), 'Times players showed up', [pw.runs && `${p.checkins} run check-ins`, lg.games && `${lg.appearances} league appearances`].filter(Boolean).join(' · ')],
    [`${n.cameBackPct}%`, 'Came back to run again', `${plural(n.cameBack, 'player')} ran here 2+ times`],
  ];
  return `<section class="crt-sec" id="crt-numbers" aria-labelledby="crt-numbers-h">${sh('By the numbers', { id: 'crt-numbers-h', sub: n.since ? `Papawis runs and league games, since ${n.since}` : '' })}
    <div class="card">
      <div class="crt-bn">${tops.map(([v, l, s]) => `<div><b class="crt-num">${escHtml(v)}</b><span>${escHtml(l)}</span><small>${escHtml(s)}</small></div>`).join('')}</div>
      <div class="crt-split">
        <div class="crt-split__col"><h3>Papawis runs</h3>${pw.runs ? [
          kv('Runs played', String(pw.runs)), kv('Slots filled', `${pw.slotsPct}%`), kv('Fastest sell-out', pw.fastestH != null ? dh(pw.fastestH) : 'Not yet'),
          kv('Waitlist sign-ups', String(pw.waitlist)), kv('Refereed', `${pw.refereed} of ${pw.runs}`)].join('') : '<p class="crt-empty">No Papawis runs here yet.</p>'}</div>
        <div class="crt-split__col"><h3>League games</h3>${lg.games ? [
          kv('Games played', String(lg.games)), kv('Playoff games', String(lg.playoff)), kv('Average combined score', String(lg.avgCombined)),
          kv('Highest combined score', String(lg.highCombined)), kv('Closest finish', lg.closest === 0 ? 'Tie' : plural(lg.closest, 'pt'))].join('') : '<p class="crt-empty">No league games set to this court yet.</p>'}</div>
      </div>
      <p class="crt-foot">Court totals only. Player and team stats live on their own pages.</p>
    </div></section>`;
}

function leaders(p) {
  const L = p.leaders;
  if (L.mostRuns.length < 3) return '';
  const col = (title, sub, rows) => `<div class="crt-lb__col"><h3>${escHtml(title)}${sub ? ` <small>${escHtml(sub)}</small>` : ''}</h3>${rows.map((r, i) => `<a class="crt-lb__row" href="/players/${encodeURIComponent(r.slug)}"><span class="crt-lb__rank">${i + 1}</span>${avatar(r.id, r.name)}<b>${escHtml(r.name)}</b><em>${escHtml(r.value)}</em></a>`).join('')}</div>`;
  return `<section class="crt-sec" id="crt-leaders" aria-labelledby="crt-leaders-h">${sh('Court leaders', { id: 'crt-leaders-h', sub: `Papawis runs at ${p.name}` })}
    <div class="card"><div class="crt-lb${L.quickest.length >= 3 ? '' : ' crt-lb--one'}">${col('Most runs here', '', L.mostRuns)}${L.quickest.length >= 3 ? col('Quickest to sign up', 'avg. sign-up spot, 2+ runs', L.quickest) : ''}</div>
    <p class="crt-foot">Attendance only, no scoring. Ties go to whoever signed up earlier on average.</p></div></section>`;
}

function votes(p, x, isLoggedIn) {
  if (!x.flags.votes || !x.slots?.length) return '';
  const rows = x.slots.map(s => {
    const pct = Math.min(100, Math.round(s.votes / s.threshold * 100));
    const reached = s.votes >= s.threshold;
    const mine = x.myVotes?.has(s.id);
    const title = s.run_id ? 'Run posted' : reached ? `Going ahead: ${s.votes} of ${s.threshold} in` : `${s.votes} of ${s.threshold} in`;
    const sub = s.run_id ? 'Sign-ups are open on the Papawis page.' : reached ? 'We’re setting up the run. Everyone who voted gets told first.' : `${plural(s.threshold - s.votes, 'more player')} needed.`;
    const action = s.run_id ? `<a class="crt-btn crt-btn--ghost crt-btn--sm crt-btn--block" href="/papawis#pw-game-${encodeURIComponent(s.run_id)}">Sign up</a>`
      : isLoggedIn ? `<button type="button" class="crt-btn crt-btn--sm crt-btn--block ${mine ? 'crt-btn--on' : 'crt-btn--ghost'}" aria-pressed="${mine ? 'true' : 'false'}" data-vote="${escHtml(s.id)}">${mine ? `${ICON.tick} You’re in` : 'I’m in'}</button>`
      : `<a class="crt-btn crt-btn--ghost crt-btn--sm crt-btn--block" href="/login?next=${encodeURIComponent(`/courts/${p.slug}#crt-vote`)}">Log in to vote</a>`;
    return `<div class="crt-rw" data-slot="${escHtml(s.id)}" data-threshold="${s.threshold}">
      <div class="crt-rw__date"><b>${escHtml(ymdLabel(s.date, { month: 'short', day: 'numeric' }).toUpperCase())}</b><span>${escHtml(`${ymdLabel(s.date, { weekday: 'short' })} · ${fmtRange(s.start_time, s.end_time)}`)}</span></div>
      <div class="crt-rw__text"><b data-vote-title>${escHtml(title)}</b><div class="crt-prog" role="meter" aria-valuemin="0" aria-valuemax="${s.threshold}" aria-valuenow="${s.votes}" aria-label="${escHtml(`${s.votes} of ${s.threshold} votes`)}"><i style="width:${pct}%"></i></div><span data-vote-sub>${escHtml(sub)}</span></div>
      ${action}</div>`;
  }).join('');
  const target = x.slots[0]?.threshold || 16;
  return `<section class="crt-sec" id="crt-vote" aria-labelledby="crt-vote-h">${sh('Vote for the next run', { id: 'crt-vote-h' })}
    <div class="card"><p class="crt-intro">${ICON.cal}<span>${escHtml(`The court has these times open. Tap I’m in. When ${target} players are in, we set up a Papawis run and tell everyone who voted first.`)}</span></p>
    <div class="crt-rows">${rows}</div></div></section>`;
}
const fmtRange = (a, b) => {
  const f = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); if (!Number.isFinite(h)) return null; const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12; return { s: m ? `${hh}:${String(m).padStart(2, '0')}` : String(hh), ap }; };
  const x = f(a), y = f(b);
  if (!x) return '';
  if (!y) return `${x.s} ${x.ap}`;
  return x.ap === y.ap ? `${x.s}–${y.s} ${y.ap}` : `${x.s} ${x.ap}–${y.s} ${y.ap}`;
};

function ratingsSection(p, court, x) {
  if (!x.flags.ratings) return '';
  const R = x.ratings;
  const left = RATING_MIN_FOR_SCORE - R.n;
  const scoreBlock = R.showScore ? `<div class="crt-rt">
      <div><span class="crt-rt__h">Overall</span><div class="crt-ov">
        <div class="crt-overall"><b class="crt-num">${R.avg.toFixed(1)}</b>${stars(R.avg, `${R.avg.toFixed(1)} out of 5`)}<small>${plural(R.n, 'rating')}</small></div>
        <div class="crt-rt__body">${R.dist.map(d => `<div class="crt-bar crt-bar--s"><span>${d.k}★</span><span class="crt-track" role="meter" aria-valuemin="0" aria-valuemax="${R.n}" aria-valuenow="${d.n}" aria-label="${escHtml(`${plural(d.n, `${d.k}-star rating`)}`)}"><i style="width:${R.n ? Math.round(d.n / R.n * 100) : 0}%"></i></span><em>${d.n}</em></div>`).join('')}</div>
      </div></div>
      <div><span class="crt-rt__h">The court</span><div class="crt-rt__body">${R.aspects.length ? R.aspects.map(a => `<div class="crt-bar"><span>${escHtml(a.label)}</span><span class="crt-track" role="meter" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${a.avg}" aria-label="${escHtml(`${a.label} ${a.avg} out of 5`)}"><i${a.avg < 3.5 ? ' class="lo"' : ''} style="width:${Math.round(a.avg / 5 * 100)}%"></i></span><em>${a.avg.toFixed(1)}</em></div>`).join('') : '<p class="crt-empty">No court scores yet.</p>'}</div></div>
    </div>
    ${R.good.length || R.bad.length ? `<div class="crt-tagline"><span>Players love</span><div>${R.good.map(t => `<span class="crt-pill">${escHtml(`${t.label} · ${t.n}`)}</span>`).join('') || '<span class="crt-muted">Nothing yet</span>'}${R.bad.length ? `<span class="crt-tagsep">Could be better</span>${R.bad.map(t => `<span class="crt-pill">${escHtml(`${t.label} · ${t.n}`)}</span>`).join('')}` : ''}</div></div>` : ''}`
    : `<div class="crt-rate-empty"><b>${R.n ? `${plural(R.n, 'rating')} so far` : 'Ratings are open'}</b><span>${escHtml(`The score shows once ${RATING_MIN_FOR_SCORE} players have rated this court${R.n ? `: ${plural(left, 'more')} to go` : ''}. Only players who played a run here can rate it.`)}</span></div>`;
  const reviews = R.reviews.slice(0, 6).map(r => {
    const mine = x.viewerId === r.player_id;
    const on = x.helpfulByMe?.has(r.id);
    return `<article class="crt-rev">
      ${avatar(r.player_id, r.player_name || '')}
      <div class="crt-rev__top"><div class="crt-rev__who"><b>${escHtml(displayPlayerName(r.player_name || ''))}</b><small><span class="crt-ver">${ICON.tick} Played here</span> · ${escHtml(new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</small></div>${stars(r.stars, `${r.stars} out of 5`)}</div>
      <p>${escHtml(r.body)}</p>
      ${mine ? '' : `<div class="crt-rev__act"><button type="button" aria-pressed="${on ? 'true' : 'false'}" data-helpful="${escHtml(r.id)}"${x.viewerId ? '' : ' disabled title="Log in to vote"'}>▲ Helpful · <span>${r.helpful}</span></button></div>`}
      ${r.owner_reply ? `<div class="crt-owner"><b>${escHtml(p.name)}${court.partner ? ' <span class="crt-pill crt-pill--amber">Partner court</span>' : ''}</b><p>${escHtml(r.owner_reply)}</p></div>` : ''}
    </article>`;
  }).join('');
  return `<section class="crt-sec" id="crt-say" aria-labelledby="crt-say-h">${sh('Players say', { id: 'crt-say-h', link: x.canRate ? '<a class="section-header__link" href="#crt-rate">Rate this court</a>' : '' })}
    <div class="card">${scoreBlock}${reviews}${x.canRate ? rateForm(x) : ''}
      <p class="crt-notice">${ICON.shield}<span>Only players who checked in to a run here can rate, and every rating shows their name. Written reviews are checked before they appear, and the court can reply.</span></p>
    </div></section>`;
}

function rateForm(x) {
  const m = x.myRating;
  const aspects = parseJson(m?.aspects_json, {});
  const tags = new Set(parseJson(m?.tags_json, []));
  const when = x.lastRunYmd ? ymdLabel(x.lastRunYmd, { month: 'short', day: 'numeric' }) : '';
  const tagBtn = ([k, l]) => `<button type="button" class="crt-tagbtn" aria-pressed="${tags.has(k) ? 'true' : 'false'}" data-tag="${escHtml(k)}">${escHtml(l)}</button>`;
  return `<form class="crt-rateform" id="crt-rate" data-rate-form>
    <div class="crt-rateform__top"><b>${m ? 'Your rating' : `You played here${when ? ` ${escHtml(when)}` : ''}. How was it?`}</b>
      <div class="crt-starin" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="stars" value="${i}"${m?.stars === i ? ' checked' : ''}${i === 1 ? ' required' : ''}><span aria-label="${plural(i, 'star')}">${star(true, 26)}</span></label>`).join('')}</div></div>
    <div class="crt-aspin">${RATING_ASPECTS.map(([k, l]) => `<div class="crt-aspin__row" role="radiogroup" aria-label="${escHtml(l)}"><span>${escHtml(l)}${k === 'airflow' ? ' <small>5 = cool</small>' : ''}</span><div>${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="asp_${k}" value="${i}"${Number(aspects[k]) === i ? ' checked' : ''}><span>${i}</span></label>`).join('')}</div></div>`).join('')}</div>
    <div class="crt-tagin" role="group" aria-label="Quick tags">${RATING_TAGS_GOOD.map(tagBtn).join('')}<span class="crt-tagsep">Could be better</span>${RATING_TAGS_BAD.map(tagBtn).join('')}</div>
    <label class="crt-field crt-field--full"><span>Anything else? <em>Optional</em></span><textarea name="body" maxlength="600" rows="3" placeholder="What should someone know before their first run here?">${escHtml(m?.body || '')}</textarea></label>
    <div class="crt-formfoot"><span data-form-msg>Posts with your name. The court can reply.</span><button type="submit" class="crt-btn crt-btn--amber">${m ? 'Update rating' : 'Post rating'}</button></div>
  </form>`;
}

function runs(p) {
  if (!p.pastRuns.length) return '';
  return `<section class="crt-sec" id="crt-runs" aria-labelledby="crt-runs-h">${sh('Runs here', { id: 'crt-runs-h', sub: `${p.pastRuns.length} played${p.cancelled ? ` · ${p.cancelled} cancelled` : ''}`, link: '<a class="section-header__link" href="/papawis">All Papawis runs</a>' })}
    <div class="card crt-rows">${p.pastRuns.slice(0, 8).map(r => `<a class="crt-rw" href="/papawis#pw-game-${encodeURIComponent(r.id)}">
      <div class="crt-rw__date"><b>${escHtml(ymdLabel(r.ymd, { month: 'short', day: 'numeric' }).toUpperCase())}</b><span>${escHtml(`${ymdLabel(r.ymd, { weekday: 'short' })}${r.time ? ` · ${r.time}` : ''}`)}</span></div>
      <div class="crt-mets">
        <div class="crt-met"><b>${r.players}</b><span>played</span></div>
        <div class="crt-met"><b>${r.fresh}</b><span>new faces</span></div>
        <div class="crt-met"><b>${r.selloutH != null ? escHtml(dh(r.selloutH)) : '—'}</b><span>${r.fastest ? 'fastest sell-out' : r.selloutH != null ? 'to sell out' : 'not full'}</span></div>
        <div class="crt-met"><b class="crt-met__ok">${r.refereed ? ICON.tick : '—'}</b><span>${r.refereed ? 'refereed' : 'no referee'}</span></div>
      </div>
      <span class="crt-rw__link">See the teams ${ICON.chev}</span></a>`).join('')}</div></section>`;
}

// Arrows, count and dots under a scrolling row (photos, league games); the script drives them.
function railBar(total, per, label) {
  if (total <= per) return '';
  return `<div class="crt-gal__bar">
      <div class="crt-gal__dots" aria-hidden="true">${Array.from({ length: total - per + 1 }, (_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>
      <div class="crt-gal__right"><span class="crt-gal__count" data-gal-count>${per > 1 ? `1–${per}` : '1'} of ${total}</span>
        <div class="crt-gal__btns"><button type="button" class="crt-gal__nav" data-step="-1" aria-label="Previous ${label}" disabled>${ICON.prev}</button><button type="button" class="crt-gal__nav" data-step="1" aria-label="Next ${label}">${ICON.next}</button></div>
      </div>
    </div>`;
}

// League games: the standard /games card, in a row that scrolls (three across on desktop).
function league(games, extras) {
  if (!games.length) return '';
  return `<section class="crt-sec" id="crt-league" aria-labelledby="crt-league-h">${sh('League games here', { id: 'crt-league-h', sub: 'WKND Basketball League', link: '<a class="section-header__link" href="/games">All games</a>' })}
    <div class="crt-rail${games.length > 3 ? ' crt-rail--more' : ''}" data-crt-rail>
      <div class="crt-rail__track">${games.map(g => gameCard(g, { commentsEnabled: extras.commentsEnabled, social: extras.socialByGame?.[g.id] || { commentsCount: 0, reactCount: 0, reacted: false }, topScorer: extras.topScorerByGame?.[g.id], odds: extras.oddsByGame?.[g.id] || null })).join('')}</div>
      ${railBar(games.length, Math.min(3, games.length), 'games')}
    </div></section>`;
}

function rent(p, court, x) {
  if (!x.flags.requests) return '';
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const times = Array.from({ length: 17 }, (_, i) => i + 6).map(h => [`${String(h).padStart(2, '0')}:00`, fmtRange(`${h}:00`, '')]);
  return `<section class="crt-sec" id="crt-rent" aria-labelledby="crt-rent-h">${sh('Rent the court for your group', { id: 'crt-rent-h' })}
    <div class="card"><p class="crt-intro">${ICON.inbox}<span>${escHtml(`Booking your own game? Send ${p.name} a request. The court confirms with you directly, and you pay the court, not WKND.`)}</span></p>
    <form class="crt-form" data-request-form="/courts/${encodeURIComponent(court.slug)}/request">
      <div class="crt-fgrid">
        <label class="crt-field"><span>Date <i>*</i></span><input type="date" name="date" min="${today}" required></label>
        <label class="crt-field"><span>Start <i>*</i></span><select name="start" required>${times.map(([v, l]) => `<option value="${v}"${v === '19:00' ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}</select></label>
        <label class="crt-field"><span>Hours <i>*</i></span><select name="hours" required>${[1, 2, 3, 4].map(h => `<option value="${h}"${h === 2 ? ' selected' : ''}>${plural(h, 'hour')}</option>`).join('')}</select></label>
        <label class="crt-field"><span>Court <i>*</i></span><select name="size" required><option value="full">Full court</option><option value="half">Half court</option></select></label>
        <label class="crt-field"><span>Your name <i>*</i></span><input type="text" name="name" autocomplete="name" maxlength="80" required></label>
        <label class="crt-field"><span>Mobile <i>*</i></span><input type="tel" name="contact" autocomplete="tel" inputmode="tel" maxlength="80" placeholder="0917 123 4567" required></label>
        <label class="crt-field crt-field--full"><span>Anything the court should know? <em>Optional</em></span><textarea name="note" rows="3" maxlength="500" placeholder="Company league, need a scoreboard"></textarea></label>
      </div>
      <div class="crt-formfoot"><span data-form-msg><i>*</i> Required. The court replies to you directly.</span><button type="submit" class="crt-btn crt-btn--amber">Send request</button></div>
    </form></div></section>`;
}

function there(p, court, x) {
  const info = p.info || {};
  const tags = courtInfoTags(info);
  const notes = [['How to get there', info.directions], ['Good to know', info.notes], info.contact_public ? ['Contact', info.contact] : null].filter(r => r && r[1]);
  const pin = x.pin;
  const href = pin ? `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}` : mapsHref(court);
  // A real map (Leaflet, OSM tiles recoloured dark, amber pin), loaded when the section comes near.
  // No pin on file: the old static map image, linking out.
  const map = pin
    ? `<div class="crt-there__map crt-map" data-crt-map data-lat="${pin.lat}" data-lng="${pin.lng}" data-name="${escHtml(p.name)}" data-href="${escHtml(href)}" role="region" aria-label="Map of ${escHtml(p.name)}"><a class="crt-map__fallback" href="${escHtml(href)}" target="_blank" rel="noopener">Open the map ↗</a></div>`
    : `<a class="crt-there__map" href="${escHtml(href)}" target="_blank" rel="noopener" aria-label="Open ${escHtml(p.name)} in Google Maps"><img src="/api/papawis-map/photo?loc=${encodeURIComponent(court.address || court.name)}" alt="Map showing ${escHtml(p.name)}${p.city ? `, ${escHtml(p.city)}` : ''}" loading="lazy" onerror="this.remove()"></a>`;
  return `<section class="crt-sec" id="crt-there" aria-labelledby="crt-there-h">${sh('Getting there', { id: 'crt-there-h', link: `<a class="section-header__link" href="${escHtml(href)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>` })}
    <div class="card crt-there">
      ${map}
      <div class="crt-there__info">
        ${court.address ? `<div class="crt-note"><b>Address</b><p>${escHtml(court.address)}</p></div>` : ''}
        ${notes.map(([k, v]) => `<div class="crt-note"><b>${escHtml(k)}</b><p>${escHtml(v)}</p></div>`).join('')}
        ${tags.length ? `<ul class="crt-ticks" aria-label="Court features">${tags.map(t => `<li>${ICON.tick}${escHtml(t)}</li>`).join('')}</ul>` : ''}
      </div>
    </div></section>`;
}

// The Good to know questions (also the page's FAQPage structured data, via courtFaqItems).
export function courtFaqItems(p, flags = {}) {
  const pw = p.numbers.papawis;
  return [
    p.playedRuns && p.avgPrice && ['How much is a run here?', `About ₱${p.avgPrice} a player${p.usualHours ? ` for a ${p.usualHours}-hour run` : ''}${p.runSlots ? ` with ${p.runSlots} players` : ''}. The exact price is set per run and moves with the headcount.${pw.refereed === pw.runs ? ' The referee is included.' : ''}`],
    p.playedRuns && ['May ref ba?', pw.refereed === pw.runs ? `Yes. ${pw.runs === 1 ? 'The run' : `All ${pw.runs} runs`} here so far had a referee calling the game.` : `${pw.refereed} of ${pw.runs} runs here had a referee. Each run says whether it has one.`],
    ['How do I join a run?', 'Sign up on the Papawis page. When a run is full, join the waitlist and you’re in if someone drops.'],
    ['I’m new. Can I still play?', `Yes.${p.firstHere ? ` ${plural(p.firstHere, 'player')} played their first Papawis here.` : ''} Make a WKND account, then sign up for a run.`],
    flags.requests && ['Can I book the court for my own group?', 'Yes. Send a request under Rent the court. The court confirms with you directly and you pay the court.'],
  ].filter(Boolean);
}
function faq(p, x) {
  const qa = courtFaqItems(p, x.flags);
  return `<section class="crt-sec" id="crt-faq" aria-labelledby="crt-faq-h">${sh('Good to know', { id: 'crt-faq-h' })}
    <div class="card crt-faq">${qa.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${escHtml(q)}</summary><p>${escHtml(a)}</p></details>`).join('')}</div></section>`;
}

function dock(p) {
  const r = p.nextRun;
  if (!r) return '';
  const max = Number(r.max_slots) || 0;
  const full = max && r.confirmed >= max;
  return `<div class="crt-dock"><div><b>${escHtml(`${ymdLabel(r.ymd, { weekday: 'short', month: 'short', day: 'numeric' })}${r.time ? ` · ${r.time}` : ''}`)}</b><span>${escHtml(max ? (full ? 'Full · waitlist open' : `${plural(max - r.confirmed, 'slot')} left`) : 'Papawis run')}</span></div><a class="crt-btn crt-btn--amber crt-btn--sm" href="/papawis#pw-game-${encodeURIComponent(r.id)}">${full ? 'Join the waitlist' : 'Sign up'}</a></div>`;
}

// The site's sticky "on this page" bar (.gd-snav + views/section-nav.js, as on game, team and
// player pages): pins under the header, glides to a section on click, lights the one in view,
// shows the court name once pinned. The run button rides at its right end on desktop.
function jumpbar(p, x, sections) {
  const r = p.nextRun;
  const max = Number(r?.max_slots) || 0;
  const full = r && max && r.confirmed >= max;
  return `<nav class="gd-snav crt-snav" data-gd-snav aria-label="On this page">
    <span class="gd-snav__mini">${escHtml(p.name)}</span>
    ${sections.map(([id, l], i) => `<a href="#${id}" data-spy="${id}"${i ? '' : ' class="is-on"'}>${escHtml(l)}</a>`).join('')}
    ${r ? `<a class="crt-btn crt-btn--amber crt-btn--sm crt-snav__cta" href="/papawis#pw-game-${encodeURIComponent(r.id)}">${full ? 'Join the waitlist' : 'Sign up'}</a>` : ''}
  </nav>`;
}

const SCRIPT = `<script>
(function () {
  var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.'); return d; }); });
  }
  // Scrolling rows (photos, league games): cards can differ in width, so stops, the count and
  // the dots come from where each card actually starts.
  document.querySelectorAll('[data-crt-gallery], [data-crt-rail]').forEach(function (g) {
    var track = g.querySelector('.crt-gal__track, .crt-rail__track'), cards = [].slice.call(track.children);
    var dotsBox = g.querySelector('.crt-gal__dots'), count = g.querySelector('[data-gal-count]');
    var prev = g.querySelector('[data-step="-1"]'), next = g.querySelector('[data-step="1"]');
    if (!prev) return;
    var stops = [], dots = [];
    function left(c) { return c.offsetLeft - track.offsetLeft; }
    function build() {
      var max = track.scrollWidth - track.clientWidth;
      stops = cards.map(left).filter(function (x) { return x < max - 4; });
      stops.push(max);
      var k0 = at();
      dotsBox.innerHTML = ''; dots = stops.map(function (s, k) { var i = document.createElement('i'); if (k === k0) i.className = 'on'; dotsBox.appendChild(i); return i; });
      sync();
    }
    function at() { var x = track.scrollLeft, k = 0; stops.forEach(function (s, i) { if (Math.abs(s - x) < Math.abs(stops[k] - x)) k = i; }); return k; }
    function sync() {
      var x = track.scrollLeft, w = track.clientWidth;
      var shown = cards.map(function (c, i) { var l = left(c); return l >= x - 4 && l + c.offsetWidth <= x + w + 4 ? i : -1; }).filter(function (i) { return i >= 0; });
      var a = shown.length ? shown[0] + 1 : 1, b = shown.length ? shown[shown.length - 1] + 1 : 1;
      count.textContent = (a === b ? a : a + '\\u2013' + b) + ' of ' + cards.length;
      var k = at(); dots.forEach(function (d, i) { d.classList.toggle('on', i === k); });
      prev.disabled = x < 4;
      next.disabled = x + w >= track.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) { b.addEventListener('click', function () {
      var k = Math.max(0, Math.min(stops.length - 1, at() + Number(b.dataset.step)));
      track.scrollTo({ left: stops[k], behavior: smooth ? 'smooth' : 'auto' });
    }); });
    track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', build);
    if (document.readyState === 'complete') build(); else window.addEventListener('load', build);
    build();
  });
  // Getting there: load Leaflet only when the map comes near, then a dark map with an amber pin.
  var mapEl = document.querySelector('[data-crt-map]');
  if (mapEl) {
    var started = false;
    var start = function () {
      if (started) return; started = true;
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = function () {
        var lat = Number(mapEl.dataset.lat), lng = Number(mapEl.dataset.lng);
        mapEl.innerHTML = '';
        var map = L.map(mapEl, { center: [lat, lng], zoom: 16, scrollWheelZoom: false });
        map.attributionControl.setPrefix(false);
        // OpenStreetMap's own tiles (keyless, credited); courts.css recolours the tile layer navy.
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
          attribution: '&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a>' }).addTo(map);
        var icon = L.divIcon({ className: 'crt-pin', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30] });
        var pop = document.createElement('div'), b = document.createElement('b'), a = document.createElement('a');
        b.textContent = mapEl.dataset.name; a.textContent = 'Directions in Google Maps'; a.href = mapEl.dataset.href; a.target = '_blank'; a.rel = 'noopener';
        pop.appendChild(b); pop.appendChild(document.createElement('br')); pop.appendChild(a);
        L.marker([lat, lng], { icon: icon, title: mapEl.dataset.name }).addTo(map).bindPopup(pop);
      };
      document.body.appendChild(js);
    };
    if ('IntersectionObserver' in window) { var mo = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { mo.disconnect(); start(); } }, { rootMargin: '400px' }); mo.observe(mapEl); } else start();
  }
  // Share this run: copy the run link.
  document.querySelectorAll('[data-share]').forEach(function (b) { b.addEventListener('click', function () {
    var url = b.getAttribute('data-share');
    var done = function () { if (window.wkndCopied) window.wkndCopied(b, url); };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(url).then(done, done); } catch (e) { done(); }
  }); });
  // Vote for a run.
  document.querySelectorAll('[data-vote]').forEach(function (b) { b.addEventListener('click', function () {
    var row = b.closest('[data-slot]'), th = Number(row.getAttribute('data-threshold'));
    b.disabled = true;
    post('/courts/slots/' + encodeURIComponent(b.getAttribute('data-vote')) + '/vote').then(function (d) {
      b.setAttribute('aria-pressed', d.on ? 'true' : 'false');
      b.classList.toggle('crt-btn--on', d.on); b.classList.toggle('crt-btn--ghost', !d.on);
      b.textContent = d.on ? 'You\\u2019re in' : 'I\\u2019m in';
      var bar = row.querySelector('.crt-prog'); bar.setAttribute('aria-valuenow', d.votes); bar.querySelector('i').style.width = Math.min(100, Math.round(d.votes / th * 100)) + '%';
      row.querySelector('[data-vote-title]').textContent = d.votes >= th ? 'Going ahead: ' + d.votes + ' of ' + th + ' in' : d.votes + ' of ' + th + ' in';
      row.querySelector('[data-vote-sub]').textContent = d.votes >= th ? 'We\\u2019re setting up the run. Everyone who voted gets told first.' : (th - d.votes) + ' more player' + (th - d.votes === 1 ? '' : 's') + ' needed.';
    }).catch(function (e) { alert(e.message); }).then(function () { b.disabled = false; });
  }); });
  // Helpful on a review.
  document.querySelectorAll('[data-helpful]').forEach(function (b) { b.addEventListener('click', function () {
    var slug = location.pathname.split('/')[2];
    post('/courts/' + slug + '/ratings/' + encodeURIComponent(b.getAttribute('data-helpful')) + '/helpful').then(function (d) {
      b.setAttribute('aria-pressed', d.on ? 'true' : 'false'); b.querySelector('span').textContent = d.count;
    }).catch(function () {});
  }); });
  // Rating form.
  document.querySelectorAll('[data-rate-form]').forEach(function (f) {
    f.querySelectorAll('[data-tag]').forEach(function (t) { t.addEventListener('click', function () { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f), aspects = {};
      ${JSON.stringify(RATING_ASPECTS.map(([k]) => k))}.forEach(function (k) { if (fd.get('asp_' + k)) aspects[k] = Number(fd.get('asp_' + k)); });
      var body = { stars: Number(fd.get('stars')), aspects: aspects, body: fd.get('body') || '', tags: [].slice.call(f.querySelectorAll('[data-tag][aria-pressed="true"]')).map(function (t) { return t.getAttribute('data-tag'); }) };
      var msg = f.querySelector('[data-form-msg]'), btn = f.querySelector('[type=submit]');
      btn.disabled = true;
      post('/courts/' + location.pathname.split('/')[2] + '/rate', body).then(function (d) { msg.textContent = d.message; btn.textContent = 'Update rating'; })
        .catch(function (err) { msg.textContent = err.message; }).then(function () { btn.disabled = false; });
    });
  });
  // Rent request form.
  document.querySelectorAll('[data-request-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f), body = {}; fd.forEach(function (v, k) { body[k] = v; });
      var msg = f.querySelector('[data-form-msg]'), btn = f.querySelector('[type=submit]');
      btn.disabled = true;
      post(f.getAttribute('data-request-form'), body).then(function (d) { msg.textContent = d.message; f.reset(); })
        .catch(function (err) { msg.textContent = err.message; }).then(function () { btn.disabled = false; });
    });
  });
})();
</script>`;

export function courtPage({ court, p, games = [], extras = {}, extra = {}, isLoggedIn = false, isAdmin = false }) {
  const x = { flags: {}, ...extra };
  const sections = [
    p.players && ['crt-crowd', 'Who plays here'],
    p.numbers.games && ['crt-numbers', 'Numbers'],
    p.leaders.mostRuns.length >= 3 && ['crt-leaders', 'Leaders'],
    x.flags.votes && x.slots?.length && ['crt-vote', 'Vote for a run'],
    x.flags.ratings && ['crt-say', 'Players say'],
    p.pastRuns.length && ['crt-runs', 'Runs here'],
    x.flags.requests && ['crt-rent', 'Rent the court'],
    ['crt-there', 'Getting there'],
  ].filter(Boolean);
  return `<div class="page-content crt">
  ${gallery(p)}
  <div class="crt-top">
    <div class="crt-top__left">${head(p, court, x, isAdmin)}</div>
    ${runPanel(p, court, x)}
  </div>
  ${jumpbar(p, x, sections)}
  ${crowd(p, x, isLoggedIn)}
  ${numbers(p)}
  ${leaders(p)}
  ${votes(p, x, isLoggedIn)}
  ${ratingsSection(p, court, x)}
  ${runs(p)}
  ${league(games, extras)}
  ${rent(p, court, x)}
  ${there(p, court, x)}
  ${faq(p, x)}
  ${isLoggedIn ? '' : `<section class="card crt-cta" aria-label="Play here"><div><span class="crt-kicker">Play here</span><b>Weekend basketball in Makati, Mandaluyong and Pasig</b><span class="crt-muted">League seasons with stats and recaps, plus Papawis pickup runs.</span></div><div class="crt-cta__btns"><a class="crt-btn crt-btn--amber" href="/register" data-cta="court-join">Join the next season</a><a class="crt-btn crt-btn--ghost" href="${MESSENGER_URL}" target="_blank" rel="noopener" data-cta="court-messenger">Message us</a></div></section>`}
  ${dock(p)}
</div>
${games.length ? gameCardScript() : ''}
${sectionNavScript()}
${SCRIPT}`;
}

// /courts: every court with a public page, busiest first.
export function courtsIndexPage({ courts }) {
  return `<div class="page-content crt">
  <header class="crt-index__head">
    <span class="crt-kicker">Papawis · League</span>
    <h1 class="crt-h1">Courts</h1>
    <p class="crt-muted">Where WKND plays: pickup runs and league games in Makati, Mandaluyong and Pasig.</p>
  </header>
  <div class="crt-index">${courts.map(({ court, p }) => `<a class="card crt-tile" href="/courts/${encodeURIComponent(court.slug)}">
      <span class="crt-tile__img">${p.photos[0] ? `<img src="${escHtml(p.photos[0].src)}" alt="${escHtml(p.photos[0].alt)}" loading="lazy">` : ''}</span>
      <span class="crt-tile__body">
        <span class="crt-kicker">${escHtml(p.city || 'Metro Manila')}</span>
        <b>${escHtml(p.name)}</b>
        <small>${[p.playedRuns ? plural(p.playedRuns, 'run') : '', p.finalsCount ? plural(p.finalsCount, 'league game') : '', p.numbers.players ? `${p.numbers.players} players` : ''].filter(Boolean).join(' · ')}</small>
        ${p.nextRun ? `<span class="crt-tile__next">Next run ${escHtml(ymdLabel(p.nextRun.ymd, { weekday: 'short', month: 'short', day: 'numeric' }))}</span>` : ''}
      </span>
    </a>`).join('')}</div>
</div>`;
}

// /courts/:slug/partner: what WKND brings a court, written for its owners.
export function courtPartnerPage({ court, p, ratings, flags }) {
  const n = p.numbers, pw = n.papawis;
  const hours = p.pastRuns.length ? Math.round(p.pastRuns.length * (p.usualHours || 2)) : 0;
  const badgeOk = ratings && ratings.showScore && ratings.avg >= 4;
  const since = n.since ? ` since ${n.since}` : '';
  const perks = [
    flags.votes && [ICON.cal, 'Fill your quiet times', 'List the weekday nights or early mornings that are hard to fill. Players vote for a run in them, and we set one up when enough say yes.'],
    flags.requests && [ICON.inbox, 'Booking requests, straight to you', 'Groups send a date, time and headcount from your page. You confirm and get paid directly. WKND never takes a cut.'],
    [ICON.chart, 'A court report', 'Runs hosted, players brought, how fast runs filled and what players said. One page you can forward.'],
    flags.ratings && [ICON.bubble, 'Reply to players', 'Ratings come only from players who played here, with their names. Reply as the court, right under the review.'],
  ].filter(Boolean);
  const report = [
    [String(pw.runs), 'runs hosted'], [String(p.checkins), 'check-ins'], [String(n.players), 'different players'],
    [String(p.firstHere), 'first Papawis ever'], [pw.fastestH != null ? dh(pw.fastestH) : '—', 'fastest sell-out'], [String(pw.waitlist), 'on waitlists'],
  ];
  return `<div class="page-content crt">
  <nav class="crt-crumbs crt-crumbs--top" aria-label="Breadcrumb"><a href="/courts/${encodeURIComponent(court.slug)}">${escHtml(p.name)}</a><span aria-hidden="true">/</span><span>Partner</span></nav>
  <div class="crt-top crt-top--partner">
    <section class="card crt-pt-hero">
      <span class="crt-kicker">For the ${escHtml(p.name)} team</span>
      <h1 class="crt-h1">${escHtml(`${plural(n.players, 'player')} have played at your court${since}`)}</h1>
      <p>WKND Basketball runs Papawis pickup games and league seasons around Makati, Mandaluyong and Pasig. Here’s what our games at your court look like, and what partner courts get. It costs nothing.</p>
      <div class="crt-pt-btns"><a class="crt-btn crt-btn--amber" href="${MESSENGER_URL}" target="_blank" rel="noopener">Message us to claim this page</a><a class="crt-btn crt-btn--ghost" href="/courts/${encodeURIComponent(court.slug)}">See your court page</a></div>
    </section>
    <aside class="card crt-badge" aria-label="Badge">
      ${badgeOk ? `<div class="crt-badge__row"><span class="crt-badge__ball"><b class="crt-num">${ratings.avg.toFixed(1)}</b></span><span class="crt-badge__txt"><span>WKND PLAYERS’ PICK</span><b>${escHtml(p.name)}</b><small>${escHtml(`Rated by ${plural(ratings.n, 'player')} · ${new Date().getFullYear()}`)}</small></span></div>
        <span class="crt-muted">Your badge, for your page and front desk. Ask us for the file.</span>`
        : `<b class="crt-badge__h">Your court, in numbers</b><span class="crt-muted">${escHtml(`${plural(pw.runs, 'Papawis run')}${n.league.games ? ` and ${plural(n.league.games, 'league game')}` : ''} so far. ${pw.runs && pw.slotsPct === 100 ? 'Every run sold out.' : ''}`)}</span>`}
    </aside>
  </div>
  <section class="crt-sec">${sh('Your court with WKND', { sub: n.since ? `since ${n.since}` : '' })}
    <div class="crt-nums">
      <div class="card"><b class="crt-num">${n.players}</b><span>Players brought</span><small>different WKND members who played here</small></div>
      <div class="card"><b class="crt-num">${pw.slotsPct}%</b><span>Run slots filled</span><small>${escHtml(pw.slotsPct === 100 ? `${pw.runs} of ${pw.runs} runs sold out` : `${p.checkins} check-ins`)}</small></div>
      <div class="card"><b class="crt-num">${n.cameBackPct}%</b><span>Came back</span><small>${escHtml(`${plural(n.cameBack, 'player')} played here 2+ times`)}</small></div>
      <div class="card"><b class="crt-num">${hours}h</b><span>Court time booked</span><small>${escHtml(`${plural(pw.runs, 'Papawis run')}${n.league.games ? ` + ${plural(n.league.games, 'league game')}` : ''}`)}</small></div>
    </div></section>
  <section class="crt-sec">${sh('What partner courts get')}<div class="crt-perks crt-perks--${perks.length}">${perks.map(([ic, t, d]) => `<div class="card"><span class="crt-perk__ic">${ic}</span><b>${escHtml(t)}</b><p>${escHtml(d)}</p></div>`).join('')}</div></section>
  <section class="crt-sec">${sh('Court report preview', { sub: n.since ? `since ${n.since}` : '' })}
    <div class="card"><div class="crt-report__head"><b>${escHtml(p.name)} × WKND</b><span class="crt-muted">What a partner court gets each month</span></div>
      <div class="crt-report">${report.map(([v, l]) => `<div><b class="crt-num">${escHtml(v)}</b><span>${escHtml(l)}</span></div>`).join('')}</div>
      ${ratings && (ratings.good.length || ratings.bad.length) ? `<p class="crt-foot"><b>Players say:</b> ${escHtml(ratings.good.slice(0, 3).map(t => t.label.toLowerCase()).join(', '))}${ratings.bad.length ? `. Could be better: ${escHtml(ratings.bad.slice(0, 2).map(t => t.label.toLowerCase()).join(', '))}` : ''}.</p>` : ''}
    </div></section>
  <section class="crt-sec">${sh('How it works')}<div class="card crt-faq">
    <details open><summary>Does it cost anything?</summary><p>No. Partner courts pay nothing, and we keep renting your court the way we do now.</p></details>
    <details><summary>Who handles the money?</summary><p>You do. Groups that request your court pay you directly. WKND only passes the request along.</p></details>
    <details><summary>Who can rate my court?</summary><p>Only players who checked in to a WKND run at your court. Every rating shows their name, and written reviews are checked before they go up.</p></details>
    <details><summary>What if a review is unfair?</summary><p>Tell us. We remove anything abusive or untrue, and you can reply under any review.</p></details>
    <details><summary>Will you show our rates?</summary><p>Only if you want us to.</p></details>
  </div></section>
</div>`;
}
