// Season sign-up (Season 5 redesign, spec: docs/agents/features/season5-signup-spec.md). One
// flow on the site (/season-signup) and in the app (/app/signup), both drawn by
// views/season-signup-flow.js and saved by the same routes in server.js. This file holds what
// both need and nothing that touches the database: the steps, the questions, the payment
// plans and their dates, the validator, the Playing-time risk tag and the review summary.

export const STEPS = [
  { n: 1, key: 'deal', title: 'The deal', sub: 'What you’re signing up for', time: '1 min read' },
  { n: 2, key: 'commit', title: 'Can you commit?', sub: 'Sundays and how you’ll pay', time: 'About 1 min' },
  { n: 3, key: 'role', title: 'Your role', sub: '5 questions, rate yourself', time: 'About 2 min' },
  { n: 4, key: 'league', title: 'You and the league', sub: 'Help out, your team, rather not', time: 'About 1 min' },
  { n: 5, key: 'kit', title: 'Kit and details', sub: 'Mostly filled in', time: 'A few seconds' },
  { n: 6, key: 'review', title: 'Review, game face, send', sub: '', time: 'Last one' },
];
export const LAST_STEP = STEPS.length;

// Bumped whenever the deal's wording changes, so a sign-up records which one it agreed to.
export const EXPECTATIONS_VERSION = '2026-11-08';

// The season's shape (Paolo, 2026-11-08): a double round robin then the playoffs.
export const MIN_GAMES = 7;
export const ROUND_ROBIN_GAMES = 6;

export const GAMES_MISS = [['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3 or more'], ['unsure', 'Not sure yet']];
export const GAMES_MISS_LABEL = Object.fromEntries(GAMES_MISS);
export const AWAY_PLANS = [['abroad', 'Trip abroad'], ['work', 'Work travel or shifts'], ['school', 'School'], ['family', 'Family event'], ['injury', 'Injury recovery']];
export const AWAY_LABEL = Object.fromEntries(AWAY_PLANS);

// Months to pick for "roughly when?": the next six, from next month. → [['2026-12', 'Dec'], …]
export function awayMonths(now = new Date()) {
  const out = [];
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(Date.UTC(y, m + i, 1));
    out.push([d.toISOString().slice(0, 7), d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })]);
  }
  return out;
}
const monthLabel = ym => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

// ── Payments ──────────────────────────────────────────────────────────────────
// Same fee on every plan, no discounts. The jersey is always in the first payment.
export const DOWN_PAYMENT = 1000;
export const PLAN_KEYS = ['full', 'dp1', 'dp2'];
export const PLAN_LABEL = { full: 'Pay in full', dp1: 'Down payment + 1', dp2: 'Down payment + 2' };
// Paydays after the first: dp1's second payment two paydays later, dp2's at two and four.
const PLAN_OFFSETS = { full: [], dp1: [2], dp2: [2, 4] };
export const FIRST_PAYMENT_LEAD_DAYS = 5;

const iso = d => d.toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// The 15th and "the 30th" (the last day in a shorter month) of a month, as day strings.
const paydaysOf = (y, m) => [iso(new Date(Date.UTC(y, m, 15))), iso(new Date(Date.UTC(y, m, Math.min(30, lastDay(y, m)))))];

// Paydays on or after a day string, in order: [first, next, …] (count of them).
export function paydaysFrom(day, count = 6) {
  const d = new Date(`${day}T00:00:00Z`);
  let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const out = [];
  while (out.length < count) {
    for (const p of paydaysOf(y, m)) if (p >= day && out.length < count) out.push(p);
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

// The first payday at least FIRST_PAYMENT_LEAD_DAYS after confirmation (a day string).
export function firstPayday(confirmDay) {
  const d = new Date(`${confirmDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + FIRST_PAYMENT_LEAD_DAYS);
  return paydaysFrom(iso(d), 1)[0];
}

// The plan's payments, dates locked at confirmation. → [{ due, amount, what }]
export function planSchedule(plan, { confirmDay, jersey = 0, fee = 3750, down = DOWN_PAYMENT }) {
  const days = paydaysFrom(firstPayday(confirmDay), 5);
  if (plan === 'full' || !PLAN_OFFSETS[plan]) return [{ due: days[0], amount: jersey + fee, what: 'Jersey + season fee' }];
  const rest = fee - down;
  const parts = plan === 'dp1' ? [rest] : [Math.ceil(rest / 2), rest - Math.ceil(rest / 2)];
  return [
    { due: days[0], amount: jersey + down, what: 'Jersey + down payment' },
    ...PLAN_OFFSETS[plan].map((k, i) => ({ due: days[k], amount: parts[i], what: 'Season fee' })),
  ];
}

// The plan as the form shows it, before any dates exist.
export function planSteps(plan, { fee = 3750, down = DOWN_PAYMENT, jerseyLabel = 'Jersey' } = {}) {
  const rest = fee - down;
  if (plan === 'full') return [`${jerseyLabel} + ${peso(fee)} on your first payday`];
  if (plan === 'dp1') return [`${jerseyLabel} + ${peso(down)} on your first payday`, `${peso(rest)} two paydays later (about a month)`];
  return [`${jerseyLabel} + ${peso(down)} on your first payday`, `${peso(Math.ceil(rest / 2))} two paydays later`, `${peso(rest - Math.ceil(rest / 2))} four paydays later (about 2 months)`];
}

export const peso = n => `₱${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

// ── Step 3: Your role ─────────────────────────────────────────────────────────
// flag: 'amber' or 'red' counts toward the Playing-time risk tag (admin-only, never a mark).
export const ROLE_QS = [
  { key: 'role_playoffs', q: 'Pick the playoffs you’d rather have', duo: true, options: [
    { v: 'title', big: '8 min', label: 'We win the title', sub: 'You play about 8 minutes a game.' },
    { v: 'minutes', big: '30 min', label: 'We lose in the semis', sub: 'You play 30 minutes and have your best games of the year.' },
  ] },
  { key: 'role_bench', q: 'Semifinal, close game. You haven’t played since the 2nd quarter. What do you do?', options: [
    { v: 'stay_ready', label: 'Stay ready and cheer' },
    { v: 'ask_private', label: 'Ask the coach after the game, in private' },
    { v: 'ask_team', label: 'Ask the coach face to face after the game, with the team there' },
    { v: 'ask_bench', label: 'Ask the coach on the bench, during the game', flag: 'amber' },
    { v: 'post_chat', label: 'Keep quiet, then post about it in the team chat later', flag: 'red' },
  ] },
  { key: 'role_chat', q: 'Your team lost. A teammate complains about the rotation in the team chat. What do you do?', options: [
    { v: 'stay_out', label: 'Stay out of it' },
    { v: 'tell_private', label: 'Tell them privately to talk to the coach' },
    { v: 'next_game', label: 'Say it should be talked about at the next game, not in the chat' },
    { v: 'agree_chat', label: 'Agree with them in the chat', flag: 'amber' },
  ] },
  { key: 'role_coach', q: 'The coach tells you one part of your game needs real work. What do you do?', options: [
    { v: 'work_on', label: 'Ask what exactly, and work on it' },
    { v: 'think_wrong', label: 'Listen, but I think they’re wrong' },
    { v: 'push_back', label: 'Push back', flag: 'amber' },
    { v: 'ignore', label: 'Ignore it. I know my game.', flag: 'amber' },
  ] },
];
export const ROLE_LABEL = Object.fromEntries(ROLE_QS.map(q => [q.key, Object.fromEntries(q.options.map(o => [o.v, o.label]))]));
export const WORK_ON_MIN = 40;
export const SELF_TIERS = [['below_average', 'Below average'], ['average', 'Average'], ['above_average', 'Above average'], ['best', 'One of the best in WKND']];
export const SELF_FIELDS = [['self_scoring', 'Scoring and shooting'], ['self_defense', 'Defense'], ['self_overall', 'Overall game']];

// Playing-time risk (spec, Step 3): triggers are an amber/red bench answer, an amber chat
// answer, an amber coach answer and a self-rating gap. Amber = 2 triggers; red = the red
// bench answer, or 3+. selfGap: any self-rating two or more bands above their rating.
export function playingTimeRisk(a = {}, { selfGap = false } = {}) {
  const flagOf = key => ROLE_QS.find(q => q.key === key)?.options.find(o => o.v === a[key])?.flag || '';
  const triggers = [
    flagOf('role_bench') && 'Bench answer',
    flagOf('role_chat') && 'Team chat answer',
    flagOf('role_coach') && 'Coach answer',
    selfGap && 'Rates themselves well above their play',
  ].filter(Boolean);
  const level = flagOf('role_bench') === 'red' || triggers.length >= 3 ? 'red' : triggers.length >= 2 ? 'amber' : '';
  return { level, triggers };
}

// ── Step 4: You and the league ────────────────────────────────────────────────
export const VOLUNTEER_ROLES = [
  { v: 'stats', label: 'Keep stats', sub: 'We’ll teach you the app' },
  { v: 'videos', label: 'Take videos' },
  { v: 'photos', label: 'Take photos' },
  { v: 'editing', label: 'Edit videos' },
  { v: 'gameday', label: 'Help on game day', sub: 'Setup, scoreboard' },
  { v: 'anything', label: 'Anything you need' },
];
export const VOLUNTEER_LABEL = Object.fromEntries(VOLUNTEER_ROLES.map(r => [r.v, r.label]));
export const MAX_RATHER_NOT = 2;
export const MAX_CLICK_WITH = 3;

// ── Step 5: Kit ───────────────────────────────────────────────────────────────
export const JERSEY_CUTS = [['regular', 'Regular cut'], ['nba', 'NBA cut']];

// ── Step 6: the Game Face contest (Paolo, 2026-11-08) ─────────────────────────
// The four poses Season sign-up uses. Each is one of LIVENESS_PROMPTS in server.js, word for
// word, so a photo's prompt says which category it's in. Money poses never go public.
export const CONTEST_POSES = [
  { key: 'and_one', prompt: "Give us your best 'and-one!' face", label: 'Best “and-one!” face' },
  { key: 'too_small', prompt: "Do the 'too small' celebration — you know the one", label: 'Best “too small” celebration' },
  { key: 'clean', prompt: "Give us your 'ref, that was clean!' face", label: 'Best “ref, that was clean!” face' },
  { key: 'finals_mvp', prompt: 'Hold up your tumbler or mug like you just won Finals MVP', label: 'Best Finals MVP pose' },
];
export const poseByKey = k => CONTEST_POSES.find(p => p.key === k) || null;
// Balanced random: one of the poses with the fewest photos so far. counts: { key: n }.
export function pickPose(counts = {}, rand = Math.random) {
  const least = Math.min(...CONTEST_POSES.map(p => counts[p.key] || 0));
  const pool = CONTEST_POSES.filter(p => (counts[p.key] || 0) === least);
  return pool[Math.floor(rand() * pool.length)].key;
}

export const WAIVER_POINTS = [
  ['Assumption of Risk', 'Basketball is a physical contact sport that carries inherent risks of injury, including but not limited to sprains, fractures, collisions, and other physical harm. By participating in WKND Basketball League ("the League") activities (games, practices, and Papawis pickup sessions) I voluntarily assume all such risks, foreseeable or not.'],
  ['Release of Liability', 'To the fullest extent permitted by law, I release and hold harmless the League, its organizers, coaches, and fellow participants from claims, damages, or liability arising from my participation, except where caused by gross negligence or willful misconduct.'],
  ['Medical Fitness', 'I confirm I am physically fit to participate and am not aware of any medical condition that would make participation unsafe. I am responsible for my own health insurance and any medical costs arising from participation.'],
  ['Photo/Video', "Games and events may be photographed or recorded for the League's social media and promotional use. By participating, I consent to this unless I notify admin otherwise in writing."],
  ['Code of Conduct', "I agree to follow the League's conduct policies and understand that violations may result in warnings, fines, suspensions or removal from the League, per its published conduct rules."],
];

// ── Reading a step's form ─────────────────────────────────────────────────────
const one = v => String(Array.isArray(v) ? v[v.length - 1] ?? '' : v ?? '').trim();
const many = v => [].concat(v ?? []).map(x => String(x).trim()).filter(Boolean);
const clip = (s, n) => String(s || '').slice(0, n);

// The draft keys each step owns. A step's POST replaces exactly these.
export const STEP_FIELDS = {
  1: ['agree'],
  2: ['games_miss', 'away', 'away_when', 'away_note', 'payment_plan'],
  3: ['role_playoffs', 'role_bench', 'role_chat', 'role_coach', 'work_on', 'self_scoring', 'self_defense', 'self_overall'],
  4: ['vol', 'vol_note', 'team_pref', 'avoid'],
  5: ['jersey_top', 'jersey_cut', 'jersey_shorts', 'pockets', 'emergency_name', 'emergency_phone', 'birthday'],
  6: ['comments', 'waiver_agree', 'waiver_signature', 'contest'],
};

// A step's posted form → its draft values (cleaned, nothing checked yet).
export function readStep(n, body = {}, ctx = {}) {
  const b = body || {};
  switch (Number(n)) {
    case 1: return { agree: one(b.agree) === '1' ? '1' : '' };
    case 2: {
      const away = many(b.away).filter(k => AWAY_LABEL[k]);
      const months = new Set(awayMonths(ctx.now).map(m => m[0]));
      const awayWhen = {};
      for (const k of away) awayWhen[k] = many(b[`away_when_${k}`]).filter(m => months.has(m));
      return { games_miss: one(b.games_miss), away, away_when: awayWhen, away_note: clip(one(b.away_note), 300), payment_plan: one(b.payment_plan) };
    }
    case 3: return Object.fromEntries(STEP_FIELDS[3].map(k => [k, k === 'work_on' ? clip(one(b[k]), 600) : one(b[k])]));
    case 4: return { vol: many(b.vol).filter(v => VOLUNTEER_LABEL[v]), vol_note: clip(one(b.vol_note), 300), team_pref: one(b.team_pref), avoid: [...new Set(many(b.avoid))].slice(0, MAX_RATHER_NOT) };
    case 5: return {
      jersey_top: one(b.jersey_top), jersey_cut: one(b.jersey_cut) === 'nba' ? 'nba' : 'regular', jersey_shorts: one(b.jersey_shorts),
      pockets: one(b.pockets) === '1' ? '1' : '',
      emergency_name: clip(one(b.emergency_name), 60), emergency_phone: clip(one(b.emergency_phone), 30), birthday: one(b.birthday),
    };
    case 6: return { comments: clip(one(b.comments), 1500), waiver_agree: one(b.waiver_agree) === '1' ? '1' : '', waiver_signature: clip(one(b.waiver_signature), 120), contest: one(b.contest) === '1' ? '1' : '' };
    default: return {};
  }
}

// Problems with one step's values. → [{ step, field, message }], first problem first.
// ctx: { sizes, returning, avoidIds (Set), selfId, hasWaiver, ownPhone, plans, now }
export function checkStep(n, d = {}, ctx = {}) {
  const errs = [];
  const err = (field, message) => errs.push({ step: Number(n), field, message });
  switch (Number(n)) {
    case 1:
      if (d.agree !== '1') err('agree', 'Tick “I’ve read this and I agree” to go on.');
      break;
    case 2:
      if (!GAMES_MISS_LABEL[d.games_miss]) err('games_miss', 'Pick how many games you’ll miss.');
      if (!(ctx.plans || PLAN_KEYS).includes(d.payment_plan)) err('payment_plan', 'Pick how you’ll pay.');
      break;
    case 3:
      for (const q of ROLE_QS) if (!q.options.some(o => o.v === d[q.key])) err(q.key, 'Answer this one.');
      if (String(d.work_on || '').trim().length < WORK_ON_MIN) err('work_on', `Give us one real thing, at least ${WORK_ON_MIN} characters.`);
      for (const [k] of SELF_FIELDS) if (!SELF_TIERS.some(t => t[0] === d[k])) err(k, 'Rate yourself here.');
      break;
    case 4:
      if (ctx.returning && !['stick', 'reshuffle'].includes(d.team_pref)) err('team_pref', 'Pick: stay with your team, or shuffle.');
      for (const id of d.avoid || []) if (id === ctx.selfId || !(ctx.avoidIds || new Set()).has(id)) { err('avoid', 'You can only name players you’ve played with.'); break; }
      break;
    case 5: {
      const sizes = ctx.sizes || [];
      if (!sizes.includes(d.jersey_top)) err('jersey_top', 'Pick a jersey top size.');
      if (d.jersey_shorts && !sizes.includes(d.jersey_shorts)) err('jersey_shorts', 'Pick a shorts size, or None.');
      if (!d.emergency_name) err('emergency_name', 'Add an emergency contact name.');
      const ph = String(d.emergency_phone || '').replace(/[\s-]/g, '');
      if (!/^(?:\+63|0)9\d{9}$/.test(ph)) err('emergency_phone', 'Enter a PH mobile number for your emergency contact.');
      else if (ctx.ownPhone && ph === String(ctx.ownPhone).replace(/[\s-]/g, '')) err('emergency_phone', 'Your emergency contact can’t be your own number.');
      const dob = new Date(d.birthday || '');
      if (!d.birthday || Number.isNaN(dob.getTime())) err('birthday', 'Add your birthday.');
      else {
        const now = ctx.now || new Date();
        if (now < new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate())) err('birthday', 'You must be 18 or older to sign up.');
      }
      break;
    }
    case 6:
      if (d.waiver_agree !== '1') err('waiver_agree', 'Tick the waiver box to send.');
      if (!ctx.hasWaiver && String(d.waiver_signature || '').trim().length < 3) err('waiver_signature', 'Type your full legal name as your signature.');
      break;
  }
  return errs;
}

// Every step at once, for Send. → the first problem ({ step, field, message }) or null.
export function checkAll(d = {}, ctx = {}) {
  for (const s of STEPS) {
    const e = checkStep(s.n, d, ctx);
    if (e.length) return e[0];
  }
  return null;
}

// How far through the draft is: the first step with a problem (LAST_STEP once 1–5 are fine).
export function resumeStep(d = {}, ctx = {}) {
  for (const s of STEPS.slice(0, -1)) if (checkStep(s.n, d, ctx).length) return s.n;
  return LAST_STEP;
}

// One line per step for Review. jersey: { total, top, shorts } from the kit pricing.
export function reviewLines(d = {}, { teamName = '', ratherNotNames = [], jerseyTotal = 0 } = {}) {
  const miss = d.games_miss === '0' ? 'Miss no games' : d.games_miss === 'unsure' ? 'Not sure about games' : d.games_miss ? `Miss ${GAMES_MISS_LABEL[d.games_miss]} game${d.games_miss === '1' ? '' : 's'}` : '';
  const away = (d.away || []).map(k => {
    const ms = (d.away_when?.[k] || []).map(monthLabel);
    return `${AWAY_LABEL[k].toLowerCase()}${ms.length ? ` ${ms.join(', ')}` : ''}`;
  });
  const answered = ROLE_QS.filter(q => d[q.key]).length + (String(d.work_on || '').trim().length >= WORK_ON_MIN ? 1 : 0);
  const rated = SELF_FIELDS.every(([k]) => d[k]);
  const vol = (d.vol || []).map(v => VOLUNTEER_LABEL[v]);
  return {
    1: d.agree === '1' ? 'Agreed' : 'Not agreed yet',
    2: [miss, ...away, PLAN_LABEL[d.payment_plan]?.toLowerCase()].filter(Boolean).join(' · ') || 'Not done yet',
    3: `${answered} of 5 answered${rated ? ' · rated yourself' : ''}`,
    4: [vol.length ? vol.join(', ') : 'No help offered', d.team_pref === 'stick' ? `stay with ${teamName || 'your team'}` : d.team_pref === 'reshuffle' ? 'shuffle me' : '',
      ratherNotNames.length ? `${ratherNotNames.length} rather not` : ''].filter(Boolean).join(' · '),
    5: [d.jersey_top && `Top ${d.jersey_top}${d.jersey_cut === 'nba' ? ' NBA cut' : ''}`, d.jersey_shorts ? `shorts ${d.jersey_shorts}${d.pockets ? ' + pockets' : ''}` : 'no shorts', jerseyTotal ? peso(jerseyTotal) : ''].filter(Boolean).join(' · '),
  };
}
