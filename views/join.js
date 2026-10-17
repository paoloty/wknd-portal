// /join: what WKND is and how to get in, for people who find us through a search or a player
// page. It sells membership of the community, never season details (fee, dates): the season
// sign-up form is for members only. Design: Fable's "player card" direction,
// https://claude.ai/artifact/7QBTCWfjjmZBvX6aQ4eaGC (Join · Fable design). Styles: public/join.css.
// The actual sign-up stays on /register.
import { escHtml } from './layout.js';
import { avatarStack } from './utils.js';

const MESSENGER_URL = 'https://m.me/wkndbasketball';

// [value on /register, nickname, who it's for]
export const JOIN_LEVELS = [
  ['beginner', 'New but make it fashion', 'Still learning the game. You’re welcome here.'],
  ['intermediate', 'I’ve watched enough NBA', 'You play now and then and know your way around.'],
  ['advanced', 'Built different. Trust.', 'School team, varsity or years of runs.'],
];

// The FAQ, shared with the page's FAQPage structured data (server.js /join).
export function joinFaq({ priceRange = '' } = {}) {
  return [
    ['Do I need a team?', 'No. Join on your own. When a season opens, team heads draft even teams from the members who sign up.'],
    ['I’ve never played in a league. Can I join?', 'Yes. Pick “New but make it fashion” and the draft keeps the teams balanced.'],
    ['Will I actually get to play at Papawis?', `Yes. A run has 20 players and a referee, and everyone gets about four 10-minute games.${priceRange ? ` It’s around ${priceRange} a head, depending on the court.` : ''}`],
    ['How do I get approved?', 'An admin reviews your application and emails you a link to set your password.'],
    ['When can I play in the league?', 'When a season opens, members get the sign-up form. Join now so you’re on the list.'],
    ['Where are the games?', 'Courts in Makati, Mandaluyong and Pasig. Every game and Papawis run lists its court, and each court has its own page.'],
  ];
}

const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
const CHAT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.3A8 8 0 1 1 21 12z"/></svg>';
const PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.3-.9z"/></svg>';

// The empty player card a new member gets (hero on desktop, its own section on phones).
function sampleCard() {
  return `<div class="jn-pcard" aria-label="Sample player card">
    <div class="jn-pcard__top"><span class="jn-pcard__brand">WKND</span><span class="jn-pcard__tag">Your player card</span></div>
    <div class="jn-pcard__who">
      <span class="jn-pcard__av">You</span>
      <span class="jn-pcard__id"><b>Your name</b><span class="jn-pcard__pills"><span class="jn-pill jn-pill--amber">#—</span><span class="jn-pill">Your positions</span></span></span>
    </div>
    <div class="jn-pcard__stats">${['PPG', 'RPG', 'APG'].map(k => `<div><b class="font-condensed">—</b><span>${k}</span></div>`).join('')}</div>
    <span class="jn-pcard__label">Badges you unlock</span>
    <div class="jn-pcard__badges">${['Player of the Game', 'Career high', 'Pickmaster'].map(b => `<span class="jn-badge">${STAR}${escHtml(b)}</span>`).join('')}</div>
  </div>`;
}

export function joinPage({ numbers = {}, courts = [], faq = [], faces = [], covers = [], runImg = '', priceRange = '' }) {
  const cta = (key, label = 'Claim your spot') => `<a class="jn-btn jn-btn--amber" href="/register" data-cta="${key}">${label}${ARROW}</a>`;
  const hero = covers[0];
  const record = [
    ['A box score for every game', `${numbers.games ? `${numbers.games} league games on the record so far. ` : ''}Your points, boards and assists, kept on your profile with a game log and career highs.`],
    ['A recap and a Player of the Game', 'Every game gets written up. Have a big night and the spotlight is yours.'],
    [`${numbers.teams || 4} teams, drafted fresh each season`, 'White, Black, Blue and Maroon. Team heads draft even squads from the members who sign up.'],
  ].map(([t, d], i) => ({ t, d, img: covers[(i + 1) % Math.max(covers.length, 1)] }));
  const proof = [
    [numbers.players, 'Players', 'with league games on their card'],
    [numbers.games, 'Box scores', 'every game, with a recap'],
    [numbers.teams, 'Teams', 'drafted fresh each season'],
    [numbers.courts, 'Courts', 'Makati, Mandaluyong, Pasig'],
  ].filter(([n]) => n);

  return `<div class="page-content jn">
  <section class="jn-hero" aria-labelledby="jn-h1">
    ${hero ? `<img class="jn-hero__bg" src="${escHtml(hero.src)}" alt="" fetchpriority="high">` : ''}
    <div class="jn-hero__text">
      <span class="jn-kicker">Weekend basketball · Makati · Mandaluyong · Pasig</span>
      <h1 id="jn-h1" class="jn-h1">Get your own player card.</h1>
      <p class="jn-lede">Join the WKND community: Papawis runs, league seasons when they open, and every league game goes on your card. No team needed. Beginners welcome.</p>
      <div class="jn-btns">
        ${cta('join-register', 'Claim your spot · 2 min')}
        <a class="jn-btn jn-btn--ghost" href="${MESSENGER_URL}" target="_blank" rel="noopener" data-cta="join-messenger">${CHAT}Ask us on Messenger</a>
      </div>
      ${faces.length && numbers.players ? `<div class="jn-faces">${avatarStack(faces, { size: 34, max: 6, moreBubble: false, label: 'Some of our players' })}<span><b>${escHtml(String(numbers.players))} players</b> already have their card</span></div>` : ''}
    </div>
    <div class="jn-hero__media">
      ${hero ? `<img class="jn-hero__img" src="${escHtml(hero.src)}" alt="${escHtml(hero.alt)}">` : ''}
      ${sampleCard()}
    </div>
  </section>

  ${proof.length ? `<section class="card jn-proof" aria-label="WKND by the numbers">
    ${proof.map(([n, l, d]) => `<div class="jn-proof__cell"><b class="font-condensed">${escHtml(String(n))}</b><span><span class="jn-proof__l">${escHtml(l)}</span><span class="jn-proof__d">${escHtml(d)}</span></span></div>`).join('')}
  </section>` : ''}

  <section class="jn-pair">
    <div class="jn-col" aria-labelledby="jn-how">
      <span class="jn-kicker">How it works</span>
      <h2 id="jn-how" class="jn-h2">Three steps. No team needed.</h2>
      <ol class="card jn-steps">
        ${[
          ['Join', 'Your name, positions and level. About 2 minutes.'],
          ['Get approved', 'An admin reviews it and emails you your login.'],
          ['Play', 'Papawis runs any time. When a season opens, members get the sign-up form.'],
        ].map(([t, d], i) => `<li class="jn-step"><span class="jn-step__n">${i + 1}</span><span><b>${escHtml(t)}</b><span>${escHtml(d)}</span></span></li>`).join('')}
      </ol>
    </div>
    <div class="jn-col" aria-labelledby="jn-run">
      <span class="jn-kicker">Papawis runs · open to members</span>
      <h2 id="jn-run" class="jn-h2">Will I actually get to play? Yes.</h2>
      <div class="card jn-run">
        ${runImg ? `<img class="jn-run__img" src="${escHtml(runImg)}" alt="A Papawis run" loading="lazy">` : ''}
        <div class="jn-run__body">
          <div class="jn-run__nums">${[['20', 'players'], ['1', 'referee'], ['4', 'games each, 10 min']].map(([n, l]) => `<div><b class="font-condensed">${n}</b><span>${l}</span></div>`).join('')}</div>
          <p>Every run has 20 players and a referee, and each player is assured about four 10-minute games. Members sign up on the Papawis page, first come, first served.${priceRange ? ` Around ${escHtml(priceRange)} a head, depending on the court.` : ''}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="jn-sec jn-cardsec" aria-labelledby="jn-card">
    <h2 id="jn-card" class="jn-h2">Your card, from game one</h2>
    ${sampleCard()}
  </section>

  <section class="jn-sec" aria-labelledby="jn-lvl">
    <h2 id="jn-lvl" class="jn-h2">Which one are you?</h2>
    <p class="jn-sub">Pick one when you join. Team heads use it to draft even teams, so nobody gets stuck on a lopsided squad.</p>
    <div class="jn-levels">
      ${JOIN_LEVELS.map(([v, l, d], i) => `<a class="jn-level${i ? '' : ' is-on'}" href="/register?experience=${v}" data-cta="join-level">
        <span class="jn-level__dot" aria-hidden="true"></span>
        <span class="jn-level__text"><span class="jn-level__head"><b>“${escHtml(l)}”</b>${i ? '' : '<span class="jn-tag">Start here</span>'}</span><span>${escHtml(d)}</span></span>
        <span class="jn-level__go">Join as this${ARROW}</span>
      </a>`).join('')}
    </div>
  </section>

  <section class="jn-sec" aria-labelledby="jn-real">
    <h2 id="jn-real" class="jn-h2">Not a pickup group chat. A real league.</h2>
    <div class="jn-record">
      ${record.map(r => `<div class="card jn-rec">${r.img ? `<img src="${escHtml(r.img.src)}" alt="${escHtml(r.img.alt)}" loading="lazy">` : ''}<div><b>${escHtml(r.t)}</b><span>${escHtml(r.d)}</span></div></div>`).join('')}
    </div>
    <div class="jn-inside"><span class="jn-label">Also inside</span>${['Members’ Messenger chat', 'Who wins? picks', 'MVP and Best Defender races'].map(t => `<span class="jn-chip"><span class="jn-chip__dot" aria-hidden="true"></span>${escHtml(t)}</span>`).join('')}</div>
  </section>

  ${courts.length ? `<section class="jn-sec" aria-labelledby="jn-where">
    <span class="jn-kicker">Where we play</span>
    <h2 id="jn-where" class="jn-h3">Courts in Makati, Mandaluyong and Pasig</h2>
    <div class="jn-courts">${courts.map(c => `<a class="jn-chip jn-chip--court" href="/courts/${encodeURIComponent(c.slug)}" data-cta="join-court">${PIN}${escHtml(c.name)}</a>`).join('')}</div>
  </section>` : ''}

  <section class="jn-sec" aria-labelledby="jn-faq">
    <h2 id="jn-faq" class="jn-h2">Questions</h2>
    <div class="jn-faq">${faq.map(([q, a]) => `<div class="card jn-q"><b>${escHtml(q)}</b><p>${escHtml(a)}</p></div>`).join('')}</div>
  </section>

  <section class="jn-end">
    <div><b>You in?</b><span>About 2 minutes to join. An admin reviews it and emails you. Beginners welcome.</span></div>
    <a class="jn-btn jn-btn--dark" href="/register" data-cta="join-register-end">Claim your spot${ARROW}</a>
  </section>

  <section class="card jn-fil" lang="fil" aria-label="Sa Filipino">
    <span class="jn-kicker">Sa Filipino</span>
    <p>Gusto mong maglaro tuwing weekend? Sumali sa WKND sa Makati, Mandaluyong at Pasig. Hindi mo kailangan ng team, puwede ang baguhan, at may sariling player card ka pagka-approve.</p>
  </section>

  <div class="jn-sticky">
    <span>About 2 min · beginners welcome</span>
    <a class="jn-btn jn-btn--amber" href="/register" data-cta="join-register-sticky">Claim your spot${ARROW}</a>
  </div>
</div>`;
}
