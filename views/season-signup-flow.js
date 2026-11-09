// The season sign-up (Season 5 redesign, docs/agents/features/season5-signup-spec.md): the
// start screen, the six steps, the Sent screen, "Who do you click with?" and "How we choose
// the 48". One markup for both sides: the site wraps it in renderPage (/season-signup), the
// app in appPage (/app/signup). kind: 'site' | 'app' only changes the top bar and links.
// Styles: public/signup.css (also folded into app.css). Behaviour: public/signup.js.
import { escHtml as esc } from './layout.js';
import { icons, backChev } from './app/layout.js';
import {
  STEPS, LAST_STEP, GAMES_MISS, AWAY_PLANS, awayMonths, PLAN_KEYS, PLAN_LABEL, planSteps, peso, ROLE_QS, WORK_ON_MIN,
  SELF_TIERS, SELF_FIELDS, VOLUNTEER_ROLES, MAX_RATHER_NOT, MAX_CLICK_WITH, JERSEY_CUTS, WAIVER_POINTS, MIN_GAMES, ROUND_ROBIN_GAMES,
} from '../lib/season-signup.js';

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ic = {
  clock: icons.clock, chat: icons.chat, cal: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  money: icons.wallet, shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V6z"/>'), check: icons.check,
  warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'), x: icons.close, info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>'),
  lock: icons.lock, camera: icons.camera, star: svg('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>'),
  chart: icons.me, video: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'), image: icons.image,
  cut: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5 20 18M8.5 16.5 20 6"/>'), hand: svg('<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5.2-3L3.5 14a1.5 1.5 0 0 1 2.6-1.5L7 14"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'), chev: svg('<path d="M9 6l6 6-6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'), phone: svg('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'),
};
const VOL_ICON = { stats: ic.chart, videos: ic.video, photos: ic.image, editing: ic.cut, gameday: ic.hand, anything: ic.heart };

// Where things live on each side.
const LINKS = {
  site: { home: '/me', homeLabel: 'Profile', conduct: '/rules/conduct', settle: '/settle-balance' },
  app: { home: '/app', homeLabel: 'Home', conduct: '/app/conduct', settle: '/app/settle' },
};
const first = s => String(s || '').split(' ')[0];
const nameOf = p => p.display || `${p.first_name || ''} ${p.last_name || ''}`.trim();
const avInitials = p => `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() || '?';
const fmtDay = day => (day ? new Date(`${day}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }) : '');

function topBar(kind, { back, backLabel, title, later = false }) {
  const laterBtn = later ? `<button type="submit" form="sgn-form" name="go" value="later" class="${kind === 'app' ? 'navbar__act' : 'sgn-nav__later'} sgn-later" formnovalidate>Finish later</button>` : '<span></span>';
  if (kind === 'app') return `<div class="navbar"><a class="navbar__back" href="${esc(back)}">${backChev}${esc(backLabel)}</a><span class="navbar__title">${esc(title)}</span>${laterBtn}</div>`;
  return `<div class="sgn-nav"><a class="sgn-nav__back" href="${esc(back)}">${backChev}${esc(backLabel)}</a><span class="sgn-nav__title">${esc(title)}</span>${laterBtn}</div>`;
}

// One screen: the top bar, the body, the bottom actions. The site centres it as a phone-width column.
function frame(kind, { bar, body, actions = '', form = null }) {
  const inner = `<div class="sgn-body">${body}</div>${actions ? `<div class="sgn-actions">${actions}</div>` : ''}`;
  const content = form ? `<form id="sgn-form" method="post" action="${esc(form)}" novalidate data-busy>${inner}</form>` : inner;
  return `<div class="sgn sgn--${kind}" data-sgn>${bar}${content}</div>`;
}

const errFor = (errors, field) => errors.find(e => e.field === field);
const errMsg = (errors, field) => { const e = errFor(errors, field); return e ? `<p class="sgn-err" id="err-${esc(field)}">${esc(e.message)}</p>` : ''; };
const invalid = (errors, field) => (errFor(errors, field) ? ` aria-invalid="true" aria-describedby="err-${esc(field)}"` : '');
const checked = c => (c ? ' checked' : '');
// One problem shows only beside its field; several get a line at the top as well.
const errBox = errors => (errors.length > 1 ? `<p class="sgn-msg sgn-msg--err" role="alert">${errors.length} things to fix below.</p>` : '');

function progress(n) {
  const s = STEPS[n - 1];
  return `<div class="sgn-prog">
    <div class="sgn-bar" aria-hidden="true">${STEPS.map(x => `<span${x.n <= n ? ' class="on"' : ''}></span>`).join('')}</div>
    <div class="sgn-prog__row"><span class="sgn-lbl">Step ${n} of ${STEPS.length}${n === LAST_STEP ? ' · Last one' : ''}</span><span class="sgn-lbl" data-sgn-count-label>${n === LAST_STEP ? '' : esc(s.time)}</span></div>
  </div>`;
}

// ── Start ─────────────────────────────────────────────────────────────────────
// data: { season, deadline, spots, fee, topPrice, shortPrice, pocketsPrice, cutPrice, step,
//         record, owing, payFirst, draftStep, isNew }
function recordCard(r, season) {
  if (!r || (!r.played && !r.teamGames && !r.pay)) return '';
  const rows = [];
  if (r.teamGames) rows.push({ tone: r.played / r.teamGames >= 2 / 3 ? 'ok' : 'wn', icon: r.played / r.teamGames >= 2 / 3 ? ic.check : ic.warn,
    text: `Played <b class="sgn-num">${r.played}</b> of <b class="sgn-num">${r.teamGames}</b> team games`, sub: 'All team games, excused or not' });
  const g = r.pay?.grade;
  if (g) {
    const owingAfter = g === 'owing' && r.balance >= 100;
    const t = {
      ontime: ['ok', ic.check, 'Paid on time', ''],
      chased: ['wn', ic.warn, 'Paid, but needed reminders', r.payFirst ? 'So for this season you pay in full before you’re confirmed' : 'Fine once. Twice and you pay in full first.'],
      after: ['bad', ic.x, 'Paid after the season', 'So for this season you pay in full before you’re confirmed'],
      owing: owingAfter ? ['bad', ic.x, r.seasonOver ? 'Still owing after the season' : `Still paying Season ${r.season}`, r.payFirst ? 'So for this season you pay in full before you’re confirmed' : 'Settle it before sign-ups close'] : ['ok', ic.check, 'Paid', ''],
    }[g];
    if (t) rows.push({ tone: t[0], icon: t[1], text: esc(t[2]), sub: t[3] });
  }
  if (!rows.length) return '';
  return `<div><div class="sgn-lbl sgn-sec">Your Season ${esc(String(season))} record</div>
    <div class="sgn-card">${rows.map(x => `<div class="sgn-rec"><span class="sgn-ri sgn-ri--${x.tone}">${x.icon}</span><span class="sgn-rec__t">${x.text}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></div>`).join('')}</div></div>`;
}

function stepList(kind, base, reached = 0) {
  return `<div class="sgn-card sgn-steps">${STEPS.map(s => {
    const done = s.n < reached;
    const inner = `<span class="sgn-sn${done ? ' sgn-sn--done' : ''}">${done ? ic.check : s.n}</span><span class="sgn-ct">${esc(s.title)}${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>`;
    return reached && s.n <= reached ? `<a class="sgn-cell" href="${esc(base)}/${s.n}">${inner}${ic.chev}</a>` : `<div class="sgn-cell">${inner}</div>`;
  }).join('')}</div>`;
}

function feeCard(d, { payFirst }) {
  return `<div class="sgn-card sgn-fee">
    <div class="sgn-fee__row"><span>Season fee</span><b class="sgn-num">${peso(d.fee)}</b></div>
    <div class="sgn-fee__row"><span>New jersey top, paid first</span><b class="sgn-num">from ${peso(d.topPrice)}</b></div>
    <div class="sgn-fine">${payFirst
      ? 'Pay in full only this season. Down payment plans open again next season if you pay on time.'
      : `Shorts ${peso(d.shortPrice)} and pockets ${peso(d.pocketsPrice)} are optional. NBA cut +${peso(d.cutPrice)}, sizes past XL +${peso(d.stepPrice)} per size. You can split the fee; the jersey is paid in your first payment.`}</div>
  </div>`;
}

// Test mode only (server.js signupReset): wipe your own sign-up or draft and run it again.
const resetForm = base => `<form method="post" action="${esc(base)}/reset" class="sgn-testreset"><button type="submit" class="sgn-ghost">Start over (test mode)</button><small>Deletes your sign-up and photo so you can do it again from step 1.</small></form>`;

export function signupStartScreen(kind, d) {
  const L = LINKS[kind];
  const base = d.base;
  const owing = d.owing >= 100;
  const resume = d.draftStep || 0;
  const head = `<div class="sgn-head"><div class="sgn-lbl sgn-lbl--amber">Season ${esc(String(d.season))} · Sign-ups open</div>
    <h1>Count me in</h1>${owing ? '' : `<p class="sgn-sub">6 steps, about 5 minutes. You can stop and finish later.</p>`}</div>`;
  const owe = owing ? `<div class="sgn-owe" role="alert">
    <div class="sgn-lbl">Unpaid balance</div>
    <div class="sgn-owe__amt"><span class="sgn-num">${peso(d.owing)}</span><span>from before</span></div>
    <p>You can sign up now, but <b>you can’t be picked until it’s paid.</b>${d.deadline ? ` Settle it before sign-ups close on ${esc(d.deadline)}.` : ''}</p>
    <ol class="sgn-owe__steps"><li>Settle ${peso(d.owing)}</li><li>Fill in your sign-up, now or after</li><li>Once an admin confirms your payment, you’re in the running</li></ol>
    <p class="sgn-owe__fine">Already paid? It can take a day to show. Message an admin if it doesn’t.</p>
  </div>` : '';
  const facts = owing ? '' : `<div class="sgn-card sgn-facts">
    <div><b class="sgn-num">${esc(d.deadline || 'Soon')}</b><span class="sgn-lbl">Closes</span></div>
    <div><b class="sgn-num">${esc(String(d.spots || 48))}</b><span class="sgn-lbl">Spots</span></div>
    <div><b class="sgn-num">${peso(d.fee)}+</b><span class="sgn-lbl">Fee + jersey</span></div>
  </div>`;
  const body = `${head}${owe}${facts}${owing ? recordCard(d.record, d.recordSeason) + feeCard(d, { payFirst: true }) : feeCard(d, { payFirst: d.payFirst }) + recordCard(d.record, d.recordSeason)}
    ${stepList(kind, base, resume)}
    <p class="sgn-links"><a href="${esc(base)}/how">How we choose the 48</a> · <a href="${esc(L.conduct)}">Conduct rules</a></p>
    ${d.canReset ? resetForm(base) : ''}`;
  const startHref = `${base}/${resume || 1}`;
  const startLabel = resume ? `Continue: ${STEPS[resume - 1].title}` : 'Start';
  const actions = owing
    ? `<a class="sgn-btn" href="${esc(L.settle)}">Settle ${peso(d.owing)}</a><a class="sgn-ghost" href="${esc(startHref)}">${resume ? 'Continue my sign-up' : 'Start my sign-up'}</a>`
    : `<a class="sgn-btn" href="${esc(startHref)}">${esc(startLabel)}</a>`;
  return frame(kind, { bar: topBar(kind, { back: L.home, backLabel: L.homeLabel, title: 'Sign up' }), body, actions: `<div class="sgn-stack">${actions}</div>` });
}

// ── Steps ─────────────────────────────────────────────────────────────────────
// data: { n, base, d (draft), errors, season, deadline, prices, returning, team, payFirst,
//         plansOffered, shared (rather-not list), onFile, hasWaiver, photo, pose, poseLabel,
//         reviewLines, jersey, sizes, sizeChart, siteCamera }
function dealStep(x) {
  const item = (icon, h, ps) => `<div class="sgn-it"><span class="sgn-ic">${icon}</span><div><p class="sgn-h">${h}</p>${ps.map(p => `<p class="sgn-p">${p}</p>`).join('')}</div></div>`;
  return `<div class="sgn-head"><h1>The deal</h1><p class="sgn-sub">We pick players who help their team win, not players who want the most minutes.</p></div>
  <div class="sgn-card">
    ${item(ic.clock, 'Minutes', [`At least ${MIN_GAMES} games: a double round robin (${ROUND_ROBIN_GAMES} games), then the playoffs.`, 'Double round robin: everyone plays in every game (the Pasarella rule).', 'Semis and finals: the coach picks who plays. Some players will sit. That’s part of the deal.'])}
    ${item(ic.chat, 'Problems with your role', ['Talk to your coach or captain in private. Not in the group chat. Not during a game.'])}
    ${item(ic.cal, 'Sundays, 6 AM and 8 AM', ['Can’t make a Sunday? Tell your captain by Friday.'])}
    ${item(ic.money, 'Money', [`${peso(x.prices.fee)} season fee + your new jersey. The jersey is paid first, then the fee on the plan you pick.`, 'First payment on the first payday (15th or 30th) at least 5 days after we confirm you. Miss it and your spot goes to the next player.', 'No extensions. Everything paid before the semis, or no playoffs.', 'Pay late this season, and next season you pay in full first.', 'The jersey is yours once paid. The fee is refunded only if you withdraw before the first game.'])}
    ${item(ic.shield, 'Conduct', [`The <a href="${esc(LINKS[x.kind].conduct)}">conduct rules</a> apply. Technicals, fines and reports count toward next season.`])}
  </div>
  <label class="sgn-agree"${invalid(x.errors, 'agree')}><input type="checkbox" name="agree" value="1" data-sgn-gate${checked(x.d.agree === '1')}><span class="sgn-cb">${ic.check}</span><span>I’ve read this and I agree.</span></label>
  ${errMsg(x.errors, 'agree')}`;
}

function commitStep(x) {
  const d = x.d;
  const months = awayMonths(x.now);
  const plans = x.plansOffered;
  const jerseyLabel = 'Jersey';
  const plan = k => {
    const steps = planSteps(k, { fee: x.prices.fee, jerseyLabel }).map(s => s.replace(/^(Jersey \+ ₱[\d,]+|₱[\d,]+)/, '<b>$1</b>'));
    const perk = k === 'full' ? `<div class="sgn-perk"><span>${ic.star}First pick of your jersey number</span><span>${ic.star}A free Papawis run</span><span>${ic.star}Done. No reminders all season</span></div>` : '';
    return `<label class="sgn-plan"><input type="radio" name="payment_plan" value="${k}"${checked(d.payment_plan === k)}>
      <span class="sgn-plan__h"><span class="sgn-rad"></span><span class="sgn-plan__t">${esc(PLAN_LABEL[k])}</span><span class="sgn-plan__a">${k === 'full' ? `${peso(x.prices.fee)} + jersey` : `${k === 'dp1' ? 2 : 3} payments`}</span></span>
      <span class="sgn-plan__steps">${steps.map(s => `<span>${s}</span>`).join('')}</span>${perk}</label>`;
  };
  return `<div class="sgn-head"><h1>Can you commit?</h1></div>
  <section class="sgn-q"${invalid(x.errors, 'games_miss')}>
    <p class="sgn-qt">Your team plays at least ${MIN_GAMES} Sunday games (6 AM or 8 AM) over about 4 months. How many will you miss?</p>
    <p class="sgn-hint">Missing 3 or more is a mark against you next season.</p>
    <div class="sgn-seg sgn-seg--wrap" role="radiogroup">${GAMES_MISS.map(([v, l]) => `<label><input type="radio" name="games_miss" value="${v}"${checked(d.games_miss === v)}><span>${esc(l)}</span></label>`).join('')}</div>
    ${errMsg(x.errors, 'games_miss')}
  </section>
  <section class="sgn-q">
    <p class="sgn-qt">Anything planned in the next few months? <small>Optional</small></p>
    <p class="sgn-hint">Helps your captain plan. It doesn’t excuse missed games.</p>
    <div class="sgn-chips">${AWAY_PLANS.map(([v, l]) => `<label class="sgn-chip"><input type="checkbox" name="away" value="${v}" data-sgn-away="${v}"${checked((d.away || []).includes(v))}><span>${esc(l)}</span></label>`).join('')}</div>
    ${AWAY_PLANS.map(([v, l]) => `<div class="sgn-when" data-sgn-when="${v}"${(d.away || []).includes(v) ? '' : ' hidden'}>
      <div class="sgn-when__t">${esc(l)} · roughly when?</div>
      <div class="sgn-mo">${months.map(([m, ml]) => `<label><input type="checkbox" name="away_when_${v}" value="${m}"${checked((d.away_when?.[v] || []).includes(m))}><span>${esc(ml)}</span></label>`).join('')}</div>
    </div>`).join('')}
    <label class="sgn-field"><span>A short note <i>optional</i></span><input type="text" name="away_note" maxlength="300" value="${esc(d.away_note || '')}" placeholder="e.g. Back from Dubai Feb 20" enterkeyhint="done"></label>
  </section>
  <section class="sgn-q"${invalid(x.errors, 'payment_plan')}>
    <p class="sgn-qt">How you’ll pay</p>
    <p class="sgn-hint">Season fee ${peso(x.prices.fee)} on every plan, <b>plus your jersey</b> (from ${peso(x.prices.topPrice)}) in your first payment. Exact dates are set when we confirm you.</p>
    ${x.payFirst ? `<p class="sgn-msg sgn-msg--warn">This season you pay in full before you’re confirmed: last season’s payments came late. Pay on time and the plans open again next season.</p>` : ''}
    <div class="sgn-plans">${plans.map(plan).join('')}</div>
    ${errMsg(x.errors, 'payment_plan')}
    <div class="sgn-note">${ic.info}<span>Your first payday is the first 15th or 30th at least 5 days after we confirm you. When two players are otherwise equal, paying in full goes first. Your plan may change if you’re confirmed late.</span></div>
  </section>`;
}

function roleStep(x) {
  const d = x.d;
  const qs = ROLE_QS.map((q, i) => {
    const opts = q.duo
      ? `<div class="sgn-duo">${q.options.map(o => `<label class="sgn-pick"><input type="radio" name="${q.key}" value="${o.v}" data-sgn-count${checked(d[q.key] === o.v)}><span><span class="sgn-big sgn-num">${esc(o.big)}</span><b>${esc(o.label)}</b>${esc(o.sub)}</span></label>`).join('')}</div>`
      : `<div class="sgn-opts">${q.options.map(o => `<label class="sgn-opt"><input type="radio" name="${q.key}" value="${o.v}" data-sgn-count${checked(d[q.key] === o.v)}><span class="sgn-rad"></span><span>${esc(o.label)}</span></label>`).join('')}</div>`;
    return `<section class="sgn-q" data-sgn-q="${q.key}"${invalid(x.errors, q.key)}><span class="sgn-qn">${i + 1} of 5</span><p class="sgn-qt">${esc(q.q)}</p>${opts}${errMsg(x.errors, q.key)}</section>`;
  }).join('');
  return `<div class="sgn-head"><h1>Your role</h1><p class="sgn-sub">No right answers to copy. Admins read these to build teams that win together. Answer how you really are.</p></div>
  ${qs}
  <section class="sgn-q" data-sgn-q="work_on"${invalid(x.errors, 'work_on')}><span class="sgn-qn">5 of 5</span>
    <label class="sgn-qt" for="sgn-work-on">What would a teammate say you need to work on?</label>
    <p class="sgn-hint">One real thing. Not “nothing”.${x.workOnPrefilled ? ' Your last answer is filled in.' : ''}</p>
    <textarea id="sgn-work-on" class="sgn-input" name="work_on" rows="3" maxlength="600" data-sgn-count data-sgn-min="${WORK_ON_MIN}">${esc(d.work_on || '')}</textarea>
    <p class="sgn-counter" data-sgn-chars></p>
    ${errMsg(x.errors, 'work_on')}
  </section>
  <section class="sgn-q" data-sgn-q="self">
    <p class="sgn-qt">Rate yourself against players in WKND</p>
    <p class="sgn-hint">Not basketball in general. Just here.</p>
    <div class="sgn-card">${SELF_FIELDS.map(([k, l]) => `<div class="sgn-rt"${invalid(x.errors, k)}><span class="sgn-rt__l">${esc(l)}</span>
      <div class="sgn-tiers" role="radiogroup" aria-label="${esc(l)}">${SELF_TIERS.map(([v, tl]) => `<label><input type="radio" name="${k}" value="${v}" data-sgn-count-self${checked(d[k] === v)}><span>${esc(tl)}</span></label>`).join('')}</div>${errMsg(x.errors, k)}</div>`).join('')}</div>
  </section>`;
}

function personRow(p, { name = 'avoid', on = false, kind = 'checkbox', meta = '' } = {}) {
  return `<label class="sgn-person" data-sgn-person data-name="${esc(nameOf(p).toLowerCase())}" data-rel="${esc(p.rel || '')}">
    <input type="${kind}" name="${name}" value="${esc(p.id)}"${checked(on)}>
    <span class="sgn-av"${p.color ? ` style="--c:${esc(p.color)}"` : ''}>${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="" loading="lazy" width="36" height="36">` : esc(avInitials(p))}</span>
    <span class="sgn-ct">${esc(nameOf(p))}${meta ? `<small>${esc(meta)}</small>` : ''}</span><span class="sgn-cb">${ic.check}</span>
  </label>`;
}

// A searchable list of players to tick (rather not / click with), filterable by how they know them.
function peoplePicker({ people, selected, field, max, filters = true, label }) {
  const sel = new Set(selected);
  const chosen = people.filter(p => sel.has(p.id));
  return `<div class="sgn-people" data-sgn-picker data-max="${max}">
    <div class="sgn-chosen" data-sgn-chosen>${chosen.length ? chosen.map(p => `<span class="sgn-tag">${esc(nameOf(p))}</span>`).join('') : '<span class="sgn-fine">No one picked.</span>'}</div>
    <details class="sgn-pickbox"${chosen.length ? '' : ''}>
      <summary class="sgn-ghost sgn-ghost--sm">${chosen.length ? 'Change' : esc(label)}</summary>
      <div class="sgn-pickbox__in">
        <label class="sgn-search">${ic.search}<input type="search" placeholder="Search names" data-sgn-search autocomplete="off" enterkeyhint="search" aria-label="Search names"></label>
        ${filters ? `<div class="sgn-seg sgn-seg--sm" role="radiogroup" aria-label="Show">${[['', 'All'], ['team', 'Teammates'], ['opp', 'Opponents'], ['papawis', 'Papawis']].map(([v, l], i) => `<label><input type="radio" name="_rel_${field}" value="${v}" data-sgn-rel${i ? '' : ' checked'}><span>${l}</span></label>`).join('')}</div>` : ''}
        <p class="sgn-fine" data-sgn-max-note>Up to ${max}. Tap again to remove.</p>
        <div class="sgn-plist">${people.map(p => personRow(p, { name: field, on: sel.has(p.id), meta: p.meta })).join('') || '<p class="sgn-empty">No one yet.</p>'}</div>
        <p class="sgn-empty" data-sgn-none hidden>No one matches.</p>
      </div>
    </details>
  </div>`;
}

function leagueStep(x) {
  const d = x.d;
  const vol = new Set(d.vol || []);
  return `<div class="sgn-head"><h1>You and the league</h1></div>
  <section class="sgn-q">
    <p class="sgn-qt">Help run WKND <small>Optional</small></p>
    <p class="sgn-hint">WKND runs on volunteers. Nobody here gets paid. Tap anything you could help with.</p>
    <div class="sgn-vol">${VOLUNTEER_ROLES.map(r => `<label class="sgn-v"><input type="checkbox" name="vol" value="${r.v}"${checked(vol.has(r.v))}><span class="sgn-vi">${VOL_ICON[r.v]}</span><span>${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span></label>`).join('')}</div>
    <label class="sgn-field"><span>Something else you can do?</span><textarea class="sgn-input" name="vol_note" rows="2" maxlength="300" placeholder="Graphic design, driving gear, sponsors, first aid, anything">${esc(d.vol_note || '')}</textarea></label>
    <p class="sgn-hint">Helping counts in our picks once you’ve actually helped during the season.</p>
  </section>
  ${x.returning ? `<section class="sgn-q"${invalid(x.errors, 'team_pref')}>
    <p class="sgn-qt">Next season’s team</p>
    <div class="sgn-card sgn-opts sgn-opts--card">
      <label class="sgn-opt"><input type="radio" name="team_pref" value="stick"${checked(d.team_pref === 'stick')}><span class="sgn-rad"></span><span><span class="sgn-dot" style="--c:${esc(x.returning.team.color || '#8a93a4')}"></span>Stay with ${esc(x.returning.team.name)}<small>Your Season ${esc(String(x.returning.prevSeason))} team</small></span></label>
      <label class="sgn-opt"><input type="radio" name="team_pref" value="reshuffle"${checked(d.team_pref === 'reshuffle')}><span class="sgn-rad"></span><span>Shuffle me<small>Happy to start fresh on any team</small></span></label>
    </div>${errMsg(x.errors, 'team_pref')}
  </section>` : ''}
  <section class="sgn-q"${invalid(x.errors, 'avoid')}>
    <p class="sgn-qt">Anyone you’d rather not play with again? <small>Optional</small></p>
    <p class="sgn-hint">Up to ${MAX_RATHER_NOT}, from your Season ${esc(String(x.leagueSeason))} games and Papawis runs.</p>
    ${x.shared.length ? peoplePicker({ people: x.shared, selected: d.avoid || [], field: 'avoid', max: MAX_RATHER_NOT, label: 'Choose' }) : '<p class="sgn-fine">No one yet: this list is the players you’ve shared a court with in league games or Papawis.</p>'}
    ${errMsg(x.errors, 'avoid')}
    <div class="sgn-lock">${ic.lock}<span>Admins see this, including who named whom. The player is never told. Something serious? Use Report on their profile instead.</span></div>
  </section>`;
}

function sizeGrid(name, sizes, chart, value, { none = false } = {}) {
  const cell = s => `<label class="sgn-s"><input type="radio" name="${name}" value="${s}"${checked(value === s)}><span><b>${s}</b><small>${chart[s][0]} / ${chart[s][1]}</small></span></label>`;
  return `<div class="sgn-sz">${none ? `<label class="sgn-s"><input type="radio" name="${name}" value=""${checked(!value)}><span><b>None</b><small>&#160;</small></span></label>` : ''}${sizes.map(cell).join('')}</div>`;
}

function kitStep(x) {
  const d = x.d, p = x.prices;
  const of = x.onFile;
  const detail = (field, label, value, input) => `<details class="sgn-edit"${errFor(x.errors, field) || !value ? ' open' : ''}>
    <summary class="sgn-cell"><span class="sgn-k"><span class="sgn-lbl">${esc(label)}</span><span class="sgn-kv">${esc(value || 'Not on file')}</span></span><span class="sgn-ed">Edit</span></summary>
    <div class="sgn-edit__in">${input}${errMsg(x.errors, field)}</div></details>`;
  const maskPhone = ph => { const s = String(ph || '').replace(/\s/g, ''); return s.length > 7 ? `${s.slice(0, 4)} ••• ${s.slice(-4)}` : s; };
  return `<div class="sgn-head"><h1>Kit and details</h1></div>
  <div class="sgn-note sgn-note--amber">${icons.shirt}<span><b>New jerseys this season.</b> ${x.kitPrefilled ? 'We filled in your last sizes. Check the chart, the fit may be different.' : 'Check the chart for your size.'}</span></div>
  <section class="sgn-q"${invalid(x.errors, 'jersey_top')} data-sgn-kit data-top="${p.topPrice}" data-short="${p.shortPrice}" data-pockets="${p.pocketsPrice}" data-cut="${p.cutPrice}" data-step="${p.stepPrice}">
    <p class="sgn-qt">Jersey top</p>
    ${sizeGrid('jersey_top', x.sizes, x.sizeChart.top, d.jersey_top)}
    <div class="sgn-axis">Chest / length, inches. ${peso(p.topPrice)}. Sizes past XL: +${peso(p.stepPrice)} per size.</div>
    ${errMsg(x.errors, 'jersey_top')}
    <div class="sgn-cut">${JERSEY_CUTS.map(([v, l]) => `<label><input type="radio" name="jersey_cut" value="${v}"${checked((d.jersey_cut || 'regular') === v)}><span><b>${esc(l)}</b><small>${v === 'nba' ? `+${peso(p.cutPrice)}` : 'Included'}</small></span></label>`).join('')}</div>
  </section>
  <section class="sgn-q"${invalid(x.errors, 'jersey_shorts')}>
    <p class="sgn-qt">Shorts <small>Optional</small></p>
    ${sizeGrid('jersey_shorts', x.sizes, x.sizeChart.shorts, d.jersey_shorts, { none: true })}
    <div class="sgn-axis">Hips / length, inches. ${peso(p.shortPrice)}. Sizes past XL: +${peso(p.stepPrice)} per size.</div>
    ${errMsg(x.errors, 'jersey_shorts')}
    <label class="sgn-check" data-sgn-pockets><input type="checkbox" name="pockets" value="1"${checked(d.pockets === '1')}><span class="sgn-cb">${ic.check}</span><span>Add pockets to the shorts · +${peso(p.pocketsPrice)}</span></label>
  </section>
  <div class="sgn-card sgn-brk" data-sgn-brk aria-live="polite">${jerseyBreakdownHtml(x.jersey)}</div>
  <section class="sgn-q">
    <p class="sgn-qt">Your details <small>From your profile</small></p>
    <div class="sgn-card sgn-details">
      ${detail('emergency_name', 'Emergency contact', of.emergency_name ? `${of.emergency_name}${of.emergency_phone ? ` · ${maskPhone(of.emergency_phone)}` : ''}` : '',
        `<label class="sgn-field"><span>Name</span><input type="text" name="emergency_name" maxlength="60" autocomplete="off" value="${esc(d.emergency_name ?? of.emergency_name ?? '')}"${invalid(x.errors, 'emergency_name')}></label>
         <label class="sgn-field"><span>Phone</span><input type="tel" inputmode="tel" name="emergency_phone" maxlength="30" autocomplete="off" value="${esc(d.emergency_phone ?? of.emergency_phone ?? '')}"${invalid(x.errors, 'emergency_phone')}></label>${errMsg(x.errors, 'emergency_phone')}`)}
      ${detail('birthday', 'Birthday', of.birthday ? new Date(`${of.birthday}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }) : '',
        `<label class="sgn-field"><span>Birthday</span><input type="date" name="birthday" value="${esc(d.birthday ?? of.birthday ?? '')}"${invalid(x.errors, 'birthday')}></label>`)}
    </div>
    <p class="sgn-hint">Jersey number: you pick it after you pay. Full payers pick first.</p>
  </section>`;
}

// jersey: { top, topLabel, shorts, shortsLabel, total }
export function jerseyBreakdownHtml(j) {
  if (!j || !j.total) return '<div class="sgn-brk__row"><span>Pick a top size to see your jersey price</span><span></span></div>';
  return `${j.topLabel ? `<div class="sgn-brk__row"><span>${esc(j.topLabel)}</span><span class="sgn-num">${peso(j.top)}</span></div>` : ''}
    ${j.shortsLabel ? `<div class="sgn-brk__row"><span>${esc(j.shortsLabel)}</span><span class="sgn-num">${peso(j.shorts)}</span></div>` : ''}
    <div class="sgn-brk__row sgn-brk__tot"><span>Your jersey, paid first</span><span class="sgn-num">${peso(j.total)}</span></div>`;
}

function gameFace(x) {
  const photo = x.photo;
  const app = x.kind === 'app';
  const taker = app
    ? `<button type="button" class="${photo ? 'sgn-ghost sgn-ghost--sm' : 'sgn-btn sgn-btn--sm'}" data-sgn-cam>${ic.camera}${photo ? 'Retake' : 'Open camera'}</button>
       <input type="file" accept="image/*" capture="user" data-sgn-cam-input hidden>`
    : `<div class="sgn-cam" data-sgn-livecam hidden><video playsinline muted autoplay></video></div>
       <div class="sgn-cam__row">
         <button type="button" class="${photo ? 'sgn-ghost sgn-ghost--sm' : 'sgn-btn sgn-btn--sm'}" data-sgn-live>${ic.camera}${photo ? 'Retake' : 'Use this device’s camera'}</button>
         <button type="button" class="sgn-ghost sgn-ghost--sm" data-sgn-snap hidden>Take the photo</button>
         <button type="button" class="sgn-ghost sgn-ghost--sm" data-sgn-qr>${ic.phone}Use my phone</button>
       </div>
       <div class="sgn-qr" data-sgn-qr-box hidden><img alt="QR code to take the photo on your phone" width="180" height="180"><p class="sgn-fine">Scan it with your phone’s camera and take the photo there. This page updates when it’s in.</p></div>`;
  return `<div class="sgn-card sgn-gf" data-sgn-gf data-photo="${photo ? '1' : ''}">
    <div class="sgn-lbl">Game face · your pose</div>
    <div class="sgn-pose">${esc(x.poseText)}</div>
    <div class="sgn-shot${photo ? ' sgn-shot--done' : ''}" data-sgn-shot>${photo ? `<img src="${esc(x.photoUrl)}" alt="Your game face" width="120" height="160">` : ic.camera}${photo ? `<span class="sgn-shot__ok">${ic.check}</span>` : ''}</div>
    ${taker}
    <p class="sgn-err" data-sgn-cam-err role="alert" hidden></p>
    ${errMsg(x.errors, 'photo')}
    <p class="sgn-fine">Every season, so we know it’s really you signing up. Only admins see it, unless you enter the contest.</p>
    <label class="sgn-check"><input type="checkbox" name="contest" value="1"${checked(x.d.contest === '1')}><span class="sgn-cb">${ic.check}</span><span><b>Enter the Game Face contest</b><small>Category: ${esc(x.poseLabel)}. Everyone can see and vote. Winners get a free Papawis run. Optional.</small></span></label>
  </div>`;
}

function reviewStep(x) {
  const d = x.d;
  const lines = x.reviewLines;
  const waiver = x.hasWaiver
    ? `<label class="sgn-check sgn-check--card"${invalid(x.errors, 'waiver_agree')}><input type="checkbox" name="waiver_agree" value="1" data-sgn-gate${checked(d.waiver_agree === '1')}><span class="sgn-cb">${ic.check}</span><span>The waiver I agreed to when I joined still applies for Season ${esc(String(x.season))}. <a href="#sgn-waiver" data-sgn-open-waiver>Read it</a></span></label>
       <details class="sgn-waiver" id="sgn-waiver"><summary>The waiver</summary>${WAIVER_POINTS.map(([h, t], i) => `<p><b>${i + 1}. ${esc(h)}.</b> ${esc(t)}</p>`).join('')}</details>`
    : `<div class="sgn-card sgn-waiver-full"><p class="sgn-qt">Liability waiver</p><p class="sgn-hint">We don’t have a signed waiver on file for you yet. Read it, then sign below.</p>
       <div class="sgn-waiver sgn-waiver--open">${WAIVER_POINTS.map(([h, t], i) => `<p><b>${i + 1}. ${esc(h)}.</b> ${esc(t)}</p>`).join('')}<p>This waiver applies to all WKND Basketball activities for as long as I remain an active member, reconfirmed each season.</p></div>
       <label class="sgn-check"${invalid(x.errors, 'waiver_agree')}><input type="checkbox" name="waiver_agree" value="1" data-sgn-gate${checked(d.waiver_agree === '1')}><span class="sgn-cb">${ic.check}</span><span>I have read and agree to the waiver above.</span></label>
       <label class="sgn-field"><span>Type your full legal name as your signature</span><input type="text" name="waiver_signature" maxlength="120" autocomplete="name" value="${esc(d.waiver_signature || '')}"${invalid(x.errors, 'waiver_signature')}></label>${errMsg(x.errors, 'waiver_signature')}</div>`;
  return `<div class="sgn-head"><h1>Check it, then show us your game face</h1></div>
  <div class="sgn-card sgn-review">${STEPS.slice(0, -1).map(s => `<div class="sgn-cell"><span class="sgn-sn">${s.n}</span><span class="sgn-k">${esc(s.title)}<small>${esc(lines[s.n] || '')}</small></span><button type="submit" name="go" value="${s.n}" class="sgn-ed" formnovalidate>${s.n === 1 ? 'View' : 'Edit'}</button></div>`).join('')}</div>
  <label class="sgn-field sgn-field--big"><span>Comments or suggestions <i>optional</i></span>
    <small>How can we make Season ${esc(String(x.season))} better? Format, schedule, venue, the app, anything. Admins read every one.</small>
    <textarea class="sgn-input" name="comments" rows="3" maxlength="1500" placeholder="Your ideas, gripes or shout-outs">${esc(d.comments || '')}</textarea></label>
  ${gameFace(x)}
  ${waiver}${x.hasWaiver ? errMsg(x.errors, 'waiver_agree') : ''}`;
}

const STEP_BODY = { 1: dealStep, 2: commitStep, 3: roleStep, 4: leagueStep, 5: kitStep, 6: reviewStep };

export function signupStepScreen(kind, x) {
  x = { ...x, kind, errors: x.errors || [] };
  const n = x.n;
  const back = n > 1 ? `${x.base}/${n - 1}` : x.base;
  const next = STEPS[n];
  const nav = n === LAST_STEP
    ? `<button type="submit" name="go" value="send" class="sgn-btn" data-sgn-send>Count me in for Season ${esc(String(x.season))}</button>
       <p class="sgn-fine sgn-center">${x.deadline ? `You can change your answers until sign-ups close on ${esc(x.deadline)}.` : 'You can change your answers until sign-ups close.'}</p>`
    : `<div class="sgn-two"><button type="submit" name="go" value="back" class="sgn-ghost" formnovalidate>Back</button>
       <button type="submit" name="go" value="next" class="sgn-btn" data-sgn-next>Next: ${esc(next.title)}</button></div>`;
  const body = `${progress(n)}${errBox(x.errors)}${STEP_BODY[n](x)}`;
  return frame(kind, {
    bar: topBar(kind, { back, backLabel: 'Sign up', title: `Season ${x.season}`, later: true }),
    body, actions: nav, form: `${x.base}/${n}`,
  });
}

// ── Sent ──────────────────────────────────────────────────────────────────────
// data: { base, season, deadline, signup, open, canEdit, clickWith: [players], payments }
const STATUS = {
  waitlisted: { title: 'You’re on the list', sub: 'We’ll tell you here, by push and by email once the 48 are picked.', tone: 'ok' },
  confirmed: { title: 'You’re in', sub: 'Your payment dates are below. Pay on each date and you’re set.', tone: 'ok' },
  rejected: { title: 'Not this season', sub: 'You weren’t picked this time. Keep playing Papawis and sign up again next season.', tone: 'muted' },
  withdrawn: { title: 'You withdrew', sub: 'You’re no longer signed up for this season. Message an admin if that’s a mistake.', tone: 'muted' },
};
export function signupSentScreen(kind, x) {
  const L = LINKS[kind];
  const st = STATUS[x.signup.status] || STATUS.waitlisted;
  const waiting = x.signup.status === 'waitlisted';
  const steps = [
    ['Sign-up sent', x.canEdit && x.deadline ? `You can still change it until ${x.deadline}` : ''],
    ['Admins pick the 48', 'Right after sign-ups close'],
    ['You hear if you’re in', 'With your payment dates'],
    ['First payment on your first payday', 'Jersey + fee or down payment'],
    ['Pick your jersey number', 'Full payers pick first'],
  ];
  const click = x.clickWith || [];
  const body = `<div class="sgn-done">
      <span class="sgn-done__ic sgn-done__ic--${st.tone}">${st.tone === 'ok' ? ic.check : ic.info}</span>
      <h1>${esc(st.title)}</h1><p class="sgn-sub">${esc(st.sub)}</p>
    </div>
    ${x.payments || ''}
    ${waiting ? `<div><div class="sgn-lbl sgn-sec">What happens next</div>
    <div class="sgn-card">${steps.map(([t, s], i) => `<div class="sgn-st"><span class="sgn-sn${i === 0 ? ' sgn-sn--on' : ''}">${i + 1}</span><span class="sgn-ct">${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</span></div>`).join('')}</div></div>` : ''}
    ${x.open && x.signup.status !== 'withdrawn' && x.signup.status !== 'rejected' ? `<a class="sgn-card sgn-extra" href="${esc(x.base)}/click">
      <span class="sgn-avs">${click.slice(0, 3).map(p => `<span>${esc(avInitials(p))}</span>`).join('')}<span class="sgn-avs__plus">+</span></span>
      <span class="sgn-ct">Who do you click with?<small>${click.length ? `${click.length} picked. Tap to change.` : 'Optional. Helps us build teams.'}</small></span>${ic.chev}</a>` : ''}
    ${x.contest ? `<a class="sgn-card sgn-extra" href="${esc(x.contest.href)}"><span class="sgn-ct">Game Face contest<small>${esc(x.contest.sub)}</small></span>${ic.chev}</a>` : ''}
    ${x.canReset ? resetForm(x.base) : ''}`;
  // A POST, not a link: opening the editor copies the sign-up into a draft.
  const actions = x.canEdit ? `<form method="post" action="${esc(x.base)}/edit"><button type="submit" class="sgn-ghost">Edit my sign-up</button></form>` : `<a class="sgn-ghost" href="${esc(L.home)}">Back to ${esc(L.homeLabel)}</a>`;
  return frame(kind, { bar: topBar(kind, { back: L.home, backLabel: L.homeLabel, title: `Season ${x.season}` }), body, actions });
}

// ── Who do you click with? ────────────────────────────────────────────────────
export function signupClickScreen(kind, x) {
  const body = `<div class="sgn-head"><h1>Who do you click with?</h1><p class="sgn-sub">Up to ${MAX_CLICK_WITH} players you play well with. Only admins see it, and only to build teams.</p></div>
    ${x.error ? `<p class="sgn-msg sgn-msg--err" role="alert">${esc(x.error)}</p>` : ''}
    ${peoplePicker({ people: x.people, selected: x.selected, field: 'click', max: MAX_CLICK_WITH, filters: false, label: 'Choose players' })}`;
  return frame(kind, {
    bar: topBar(kind, { back: x.base, backLabel: 'Sign-up', title: `Season ${x.season}` }),
    body, form: `${x.base}/click`, actions: '<button type="submit" class="sgn-btn">Save</button>',
  });
}

// ── The Game Face contest (/game-face, /app/game-face) ────────────────────────
// data: { season, phase: entries|voting|over, closes, closesShort, voteAction, canVote, loginHref, mine,
//         poses: [{ key, label, entries: [{ id, name, photo, big, mine, voted, votes }] }] }
// mine: what the viewer's own entry needs to know ('waiting' | 'approved' | 'hidden'), or ''.
// Tapping a photo opens the viewer (public/signup.js gfViewer); Vote saves in place there. Without
// script every Vote is a plain form button (tapping your vote again takes it back).
const MINE_MSG = {
  waiting: ['info', 'Your entry is waiting for an admin to approve it. It shows here once it’s in.'],
  approved: ['ok', 'Your game face is in the contest.'],
  hidden: ['info', 'Your photo isn’t in the contest this time. Message an admin if you’d like to know why.'],
};
export function gameFaceScreen(kind, x) {
  const L = LINKS[kind];
  const total = x.poses.reduce((n, p) => n + p.entries.length, 0);
  const sub = {
    entries: `${total} ${total === 1 ? 'entry' : 'entries'} so far. Voting opens for ${x.voteDays} days once sign-ups close. Each category’s winner gets a free Papawis run.`,
    voting: `Pick one face in each category. You can change your pick until ${x.closes}. Results stay hidden until then.`,
    over: 'The votes are in. Each winner gets a free Papawis run.',
  }[x.phase];
  const voting = x.phase === 'voting';
  const zoom = svg('<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>');
  const tile = e => {
    const tag = x.phase === 'over' ? `${e.votes} vote${e.votes === 1 ? '' : 's'}` : e.mine ? 'You' : e.voted ? `${ic.check}Your vote` : '';
    const vote = !voting ? (x.phase === 'over' ? '<small class="sgn-gf__win">Winner</small>' : '')
      : e.mine ? '<button type="button" class="sgn-gf__vote" disabled>You</button>'
      : !x.canVote ? (x.loginHref ? `<a class="sgn-gf__vote" href="${esc(x.loginHref)}">Vote</a>` : '')
      : `<button type="submit" class="sgn-gf__vote" name="entry" value="${esc(e.id)}" aria-pressed="${e.voted ? 'true' : 'false'}" aria-label="${e.voted ? `Take back your vote for ${esc(e.name)}` : `Vote for ${esc(e.name)}`}">${e.voted ? `${ic.check}Voted` : 'Vote'}</button>`;
    return `<div class="sgn-gf__tile${e.voted ? ' is-on' : ''}" data-gf-entry="${esc(e.id)}" data-gf-name="${esc(e.name)}" data-gf-big="${esc(e.big)}"${e.mine ? ' data-gf-mine="1"' : ''}>
      <button type="button" class="sgn-gf__ph" data-gf-open aria-label="See ${esc(e.name)}’s photo"><img src="${esc(e.photo)}" alt="" loading="lazy" decoding="async">${tag ? `<span class="sgn-gf__tag">${tag}</span>` : ''}<span class="sgn-gf__zoom" aria-hidden="true">${zoom}</span></button>
      <div class="sgn-gf__row"><span class="sgn-gf__name">${esc(e.name)}</span>${vote}</div></div>`;
  };
  const shown = x.poses.filter(p => p.entries.length);
  const sections = shown.map(p => `<section class="sgn-gfc" id="gf-${esc(p.key)}" data-gf-cat="${esc(p.key)}" data-gf-label="${esc(p.label)}">
    <div class="sgn-gfc__h"><span class="sgn-lbl">${esc(p.label)}</span>${voting ? `<small data-gf-state${p.entries.some(e => e.voted) ? ' class="is-done"' : ''}>${p.entries.some(e => e.voted) ? '✓ Voted' : `${p.entries.length} face${p.entries.length === 1 ? '' : 's'}`}</small>` : ''}</div>
    <div class="sgn-gfgrid${x.phase === 'over' ? ' sgn-gfgrid--one' : ''}">${p.entries.map(tile).join('')}</div></section>`).join('');
  const votedIn = shown.filter(p => p.entries.some(e => e.voted)).length;
  const prog = voting && x.canVote && shown.length ? `<div class="sgn-gfp" data-gf-prog><span class="sgn-gfp__dots">${shown.map(p => `<i${p.entries.some(e => e.voted) ? ' class="on"' : ''}></i>`).join('')}</span>
    <span class="sgn-gfp__t"><b class="sgn-num" data-gf-count>${votedIn} of ${shown.length}</b> categories voted</span><span class="sgn-gfp__end">Closes ${esc(x.closesShort)}</span></div>` : '';
  const mine = MINE_MSG[x.mine];
  // The progress bar sits directly in the form so it stays stuck below the header for the whole list.
  const body = `<div class="sgn-head"><div class="sgn-lbl sgn-lbl--amber">Season ${esc(String(x.season))}</div><h1>Game Face contest</h1><p class="sgn-sub">${esc(sub)}</p></div>${prog}
    ${mine ? `<p class="sgn-msg sgn-msg--${mine[0]}">${esc(mine[1])}</p>` : ''}
    ${voting && !x.canVote ? `<p class="sgn-msg sgn-msg--info">${x.loginHref ? `<a href="${esc(x.loginHref)}">Log in</a> to vote.` : 'Only members can vote.'}</p>` : ''}
    ${sections || `<div class="sgn-card sgn-how"><p>${x.phase === 'over' ? 'No votes came in.' : 'No entries yet. Enter on Step 6 of your sign-up.'}</p></div>`}
    <p class="sgn-fine sgn-center">Each category’s winner gets a free Papawis run.</p>`;
  const content = voting && x.canVote ? `<form method="post" action="${esc(x.voteAction)}" class="sgn-gf-form">${body}</form>` : `<div class="sgn-gf-form">${body}</div>`;
  const bar = topBar(kind, { back: L.home, backLabel: L.homeLabel, title: 'Game Face' });
  return `<div class="sgn sgn--${kind} sgn--wide" data-sgn data-gf data-gf-phase="${esc(x.phase)}"${voting && x.canVote ? ` data-gf-vote="${esc(x.voteAction)}"` : ''}>${bar}<div class="sgn-body">${content}</div></div>`;
}

// ── Not open, not approved, banned ────────────────────────────────────────────
export function signupNoticeScreen(kind, { title, body, action = '' }) {
  const L = LINKS[kind];
  return frame(kind, {
    bar: topBar(kind, { back: L.home, backLabel: L.homeLabel, title: 'Sign up' }),
    body: `<div class="sgn-done"><span class="sgn-done__ic sgn-done__ic--muted">${ic.info}</span><h1>${esc(title)}</h1><p class="sgn-sub">${body}</p></div>`,
    actions: action || `<a class="sgn-ghost" href="${esc(L.home)}">Back to ${esc(L.homeLabel)}</a>`,
  });
}

// ── How we choose the 48 (the public text; the order matches lib/season-candidates.js) ──
export function signupHowScreen(kind, { base, season, prevSeason }) {
  const L = LINKS[kind];
  const body = `<div class="sgn-head"><h1>How we choose the 48</h1><p class="sgn-sub">Every season more people want in than we have spots. This is how we choose.</p></div>
  <div class="sgn-card sgn-how">
    <p><b>You have to sign up.</b> No sign-up, no spot, whatever your record.</p>
    <p><b>You need to be clear:</b> no unpaid balance and no ban. Owe something? Settle it before sign-ups close, or you can’t be picked.</p>
  </div>
  <div><div class="sgn-lbl sgn-sec">Then we go in this order</div>
  <div class="sgn-card">
    <div class="sgn-st"><span class="sgn-sn">1</span><span class="sgn-ct">Season ${esc(String(prevSeason))} players who played at least half of their team’s games</span></div>
    <div class="sgn-st"><span class="sgn-sn">2</span><span class="sgn-ct">Papawis regulars<small>4 or more runs in the last 12 months</small></span></div>
    <div class="sgn-st"><span class="sgn-sn">3</span><span class="sgn-ct">Everyone else<small>New members and players coming back</small></span></div>
  </div></div>
  <div><div class="sgn-lbl sgn-sec">Inside each group, these count against you</div>
  <div class="sgn-card sgn-how"><ul>
    <li>Playing less than two-thirds of your team’s games (at least 5 of ${MIN_GAMES})</li>
    <li>Needing to be chased for payment, or paying after the season</li>
    <li>Not being active in the app or on the site (members who joined in the last 3 months don’t need this)</li>
    <li>Fines, or repeated technicals</li>
    <li>Two or more late Papawis cancellations in a year</li>
  </ul></div></div>
  <div class="sgn-card sgn-how">
    <p><b>These help:</b> playing both league and Papawis, and helping run the league.</p>
    <p><b>When two players are otherwise equal:</b> paying in full first, then more games played.</p>
    <p><b>Serious conduct cases</b> (two or more fines, a suspension, a disqualification) are decided by the admins before any spot. See the <a href="${esc(L.conduct)}">conduct rules</a>.</p>
    <p><b>Admins make the final call</b> and read every sign-up. What you write about your role and the team matters.</p>
    <p><b>Once you’re picked:</b> your first payment (jersey + down payment or the full fee) is due on the first payday at least 5 days after we confirm you. Miss it and your spot goes to the next player.</p>
  </div>`;
  return frame(kind, { bar: topBar(kind, { back: base, backLabel: 'Sign up', title: `Season ${season}` }), body });
}

// The "Your payments" card (Sent screen once confirmed, and Me): dates, paid, next, Settle.
// pay: { rows: [{ due, amount, what, paid: bool, late: bool }], paidSoFar, total, next }
export function paymentsCard(kind, pay) {
  if (!pay?.rows?.length) return '';
  const L = LINKS[kind];
  return `<div><div class="sgn-lbl sgn-sec">Your payments</div><div class="sgn-card sgn-pay">
    ${pay.rows.map(r => `<div class="sgn-pay__row${r.paid ? ' is-paid' : r.late ? ' is-late' : ''}"><span class="sgn-pay__d">${esc(fmtDay(r.due))}</span><span class="sgn-ct">${esc(r.what)}<small>${r.paid ? 'Paid' : r.late ? 'Late' : 'Due'}</small></span><b class="sgn-num">${peso(r.amount)}</b></div>`).join('')}
    <div class="sgn-pay__sum"><span>Paid so far</span><b class="sgn-num">${peso(pay.paidSoFar)} of ${peso(pay.total)}</b></div>
    ${pay.next ? `<a class="sgn-btn" href="${esc(L.settle)}">Pay ${peso(pay.next.amount)}</a>` : ''}
  </div></div>`;
}
export { first as firstName };
