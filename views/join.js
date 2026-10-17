// /join: what WKND is and how to get in, for people searching "basketball league for working
// professionals / adult basketball league Makati" and the like. Mockup:
// https://claude.ai/artifact/7QBTCWfjjmZBvX6aQ4eaGC (Join WKND). Styles: public/join.css.
// The actual sign-up stays on /register.
import { escHtml } from './layout.js';

const MESSENGER_URL = 'https://m.me/wkndbasketball';

export const JOIN_LEVELS = [
  ['Beginner', 'New but make it fashion', 'Still learning the game. You’re welcome here.'],
  ['Intermediate', 'I’ve watched enough NBA', 'You play now and then and know your way around.'],
  ['Advanced', 'Built different. Trust.', 'School team, varsity or years of runs.'],
];

// The FAQ, shared with the page's FAQPage structured data (server.js /join).
export function joinFaq({ feeText = '', priceRange = '' } = {}) {
  return [
    ['How much does it cost?', `${feeText ? `${feeText}.` : 'Message us for this season’s fee.'}${priceRange ? ` Papawis runs are paid per run, around ${priceRange} a head depending on the court.` : ''}`],
    ['Do I need a team?', 'No. Sign up on your own and the team heads draft even teams from everyone who registered.'],
    ['I’ve never played in a league. Can I join?', 'Yes. Pick “New but make it fashion” when you register, and the draft keeps the teams balanced.'],
    ['When are games?', 'On weekends, mostly Sundays. The schedule for each season is on the Games page.'],
    ['What is Papawis?', 'Our pickup runs: 2 hours, 20 players and a referee. Slots open on the Papawis page and go first come, first served.'],
    ['How do I get approved?', 'After you register, an admin reviews it and emails you a link to set your password.'],
  ];
}

export function joinPage({ numbers = {}, courts = [], faq = [], heroImg = '', regOpen = true }) {
  const stat = (v, l) => (v ? `<div class="card jn-stat"><b class="font-condensed">${escHtml(String(v))}</b><span>${escHtml(l)}</span></div>` : '');
  const cta = regOpen ? 'Register for the next season' : 'Register for the next season';
  return `<div class="page-content jn">
  <section class="jn-hero${heroImg ? '' : ' jn-hero--plain'}" aria-labelledby="jn-h1">
    ${heroImg ? `<img class="jn-hero__img" src="${escHtml(heroImg)}" alt="WKND players on court" fetchpriority="high">` : ''}
    <div class="jn-hero__shade"></div>
    <div class="jn-hero__in">
      <span class="jn-kicker">Join WKND Basketball</span>
      <h1 id="jn-h1" class="jn-h1">A weekend basketball league in Makati, Mandaluyong and Pasig</h1>
      <p class="jn-lede">Real league games with stats, recaps and a Player of the Game, plus Papawis pickup runs any time of the season. No team needed, and beginners are welcome.</p>
      <div class="jn-btns">
        <a class="jn-btn jn-btn--amber" href="/register" data-cta="join-register">${cta} &rarr;</a>
        <a class="jn-btn jn-btn--ghost" href="${MESSENGER_URL}" target="_blank" rel="noopener" data-cta="join-messenger">Questions? Message us</a>
      </div>
    </div>
  </section>

  <section class="jn-stats" aria-label="WKND by the numbers">
    ${stat(numbers.players, 'players with league games on file')}
    ${stat(numbers.games, 'league games with box scores and recaps')}
    ${stat(numbers.teams, 'teams, drafted fresh each season')}
    ${stat(numbers.runs, 'Papawis pickup runs played')}
  </section>

  <section class="jn-sec" aria-labelledby="jn-how">
    <h2 id="jn-how">How a season works</h2>
    <p class="jn-sub">Sign up on your own. We build the teams.</p>
    <ol class="jn-steps">
      ${[
        ['Register', 'Tell us your positions and your level. An admin approves you, then you get your login.'],
        ['Get drafted', 'Team heads draft even teams from everyone who signed up. You don’t need a team or friends to join.'],
        ['Play on weekends', 'League games are on weekends, mostly Sundays, at courts in Makati, Mandaluyong and Pasig.'],
        ['See yourself on the site', 'Every game gets a box score and a recap. Your profile builds up your stats, game log and highlights.'],
      ].map(([t, d], i) => `<li class="card jn-step"><span class="jn-step__n font-condensed">${i + 1}</span><b>${escHtml(t)}</b><p>${escHtml(d)}</p></li>`).join('')}
    </ol>
  </section>

  <section class="jn-sec jn-who" aria-labelledby="jn-who">
    <div>
      <h2 id="jn-who">Who it’s for</h2>
      <p class="jn-body">Working professionals, weekend warriors, ex-varsity players and people who just want to sweat on a Sunday. When you register you pick your level, and the team heads use it to draft even teams, so nobody gets stuck on a super team or a squad that never wins.</p>
    </div>
    <div class="jn-levels">
      ${JOIN_LEVELS.map(([k, l, d]) => `<div class="card jn-level"><span class="jn-level__k font-condensed">${escHtml(k.toUpperCase())}</span><span><b>“${escHtml(l)}”</b><small>${escHtml(d)}</small></span></div>`).join('')}
    </div>
  </section>

  <section class="jn-sec" aria-labelledby="jn-get">
    <h2 id="jn-get">What you get</h2>
    <div class="jn-perks">
      ${[
        ['Your own player profile', 'Stats, game logs, career highs and badges, with a share card for your best games.'],
        ['Recaps and Player of the Game', 'Every game gets a written recap and a Player of the Game spotlight.'],
        ['Awards and the MVP race', 'Season awards, an MVP race and a Best Defender race you can follow week by week.'],
        ['Who wins? picks', 'Call the winner of every game and climb the Pickmaster standings.'],
        ['Papawis pickup runs', 'Open runs with limited slots, first come, first served.'],
        ['A community that shows up', 'A members’ chat for run updates, last-minute slots and game-day banter.'],
      ].map(([t, d]) => `<div class="card jn-perk"><b>${escHtml(t)}</b><p>${escHtml(d)}</p></div>`).join('')}
    </div>
  </section>

  ${courts.length ? `<section class="jn-sec" aria-labelledby="jn-where">
    <h2 id="jn-where">Where we play</h2>
    <p class="jn-sub">Every court has its own page with directions, photos and stats.</p>
    <div class="jn-courts">${courts.map(c => `<a class="jn-court" href="/courts/${encodeURIComponent(c.slug)}" data-cta="join-court">${escHtml(c.name)}${c.city ? `<small>${escHtml(c.city)}</small>` : ''}</a>`).join('')}</div>
  </section>` : ''}

  <section class="jn-sec jn-faq" aria-labelledby="jn-faq">
    <h2 id="jn-faq">Questions</h2>
    <div class="jn-faq__list">${faq.map(([q, a]) => `<div class="jn-q"><b>${escHtml(q)}</b><p>${escHtml(a)}</p></div>`).join('')}</div>
  </section>

  <section class="card jn-fil" lang="fil" aria-label="Sa Filipino">
    <span class="jn-kicker">Sa Filipino</span>
    <p>Gusto mong sumali sa liga ng basketball tuwing weekend? Ang WKND ay liga sa Makati, Mandaluyong at Pasig. Hindi mo kailangan ng team: mag-register ka lang, at ang mga team head ang bubuo ng pantay-pantay na teams. Puwede rin ang mga baguhan.</p>
  </section>

  <section class="jn-end">
    <div><b>Next season is coming. Get on the list.</b><span>Register now: it takes about 2 minutes, and an admin approves you before the draft.</span></div>
    <a class="jn-btn jn-btn--amber" href="/register" data-cta="join-register-end">${cta} &rarr;</a>
  </section>
</div>`;
}
