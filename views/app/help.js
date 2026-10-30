// How to score (Me → Scoring, 2026-10-27, mockup claude.ai/artifact/QMXxzqVm3HHpJKzWmTPWYQ): the
// scorer's manual as a help guide you read like a document. Contents with reading times and a
// search, then one chapter per screen with real screenshots (public/help/scorer/*.jpg, taken from
// a practice game; regenerate them when the scorer changes), steps, a Good to know box and
// previous / next. Plain words, the app's reading size (15px). Keep it true to public/scorer.js.
import { esc, backChev, chev } from './layout.js';

// blocks: ['p', text] · ['img', file, caption] · ['steps', [..]] · ['tip', title, text] ·
// ['h', text] · ['dl', [[term, def], ..]]. Text may use <b> and <i> (written here, never user input).
export const SCORER_GUIDE = [
  {
    slug: 'before', title: 'Before tip-off', blocks: [
      ['p', 'You can score a game when an admin picks you for it, or when you’re a scorer, which lets you score any game with scoring turned on. Your games are under <b>Me → Scoring → Games to score</b>, and Home reminds you on game day.'],
      ['img', 'list.jpg', 'Games to score: every game you can score, with the ones being scored now marked.'],
      ['steps', [
        '<b>Open the game</b> a few minutes before tip-off. The scorer opens even with no signal once it has loaded.',
        '<b>Pick your side</b> if someone else is scoring too: White, Blue, or Both. With one phone, choose Both.',
        '<b>Check who’s there.</b> Tap a team’s name → <i>DNP…</i> to mark players who didn’t come, so they don’t show on court.',
        '<b>Start the clock</b> with ▶ at tip-off. If you forget, it starts by itself with the first play.',
      ]],
      ['tip', 'Good to know', 'Every play is saved on your phone first, then sent. The pill at the top right says <i>Saved</i>, <i>Sending</i> or <i>Offline · 3 saved</i>. You can lose signal for a whole quarter and nothing is lost.'],
      ['p', 'Never scored before? Play a practice game first: <b>Me → Scoring → Practice game</b>. It runs only on your phone.'],
    ],
  },
  {
    slug: 'play', title: 'Recording a play', blocks: [
      ['p', 'Every play is a player and what they did. Tap the player, then the stat. The other way round works too: tap the stat first (it lights up), then the player.'],
      ['img', 'play.jpg', 'Each team’s five on court on top, the bench below, and the stat buttons at the bottom.'],
      ['dl', [
        ['Green FT · 2PT · 3PT', 'A made free throw or basket. 4PT shows only at courts with a 4-point line.'],
        ['Red FT · 2PT · 3PT', 'A missed one.'],
        ['REB · AST · STL · BLK', 'Rebound, assist, steal, block.'],
        ['TO · FOUL', 'Turnover and foul. Hold them for the other kinds.'],
      ]],
      ['steps', [
        'The tile flashes what you recorded (<i>+2</i>, <i>MISS</i>, <i>REB</i>) and the play shows in the last-play line.',
        'A bench player’s stat brings them on court and asks who went off.',
        'Hold a player’s tile to see their line so far. Hold a team’s score for the score by quarter.',
        '<b>Scoresheet</b> at the bottom has the box score, every play and the fouls.',
      ]],
      ['tip', 'Good to know', 'Players with foul trouble show it on their tile: a small foul count, white when it’s worth watching, red when they’re one away.'],
    ],
  },
  {
    slug: 'followups', title: 'Follow-up questions', blocks: [
      ['p', 'Some plays have a second part. A missed shot is usually followed by a rebound, a made basket might have an assist. After those plays an amber line asks about it, just above the stat buttons.'],
      ['img', 'followup.jpg', 'After a miss: all ten players light up. The team labels say who would get an offensive or a defensive rebound.'],
      ['h', 'Answering'],
      ['steps', [
        '<b>Tap a lit player.</b> That’s the answer. The players who can’t answer are dimmed.',
        '<b>Nobody fits?</b> Tap the button in the line: <i>No rebound</i>, <i>No assist</i> or <i>Skip</i>. Or swipe the line down.',
        '<b>Too busy?</b> Just record the next play. The question goes away by itself.',
      ]],
      ['tip', 'Good to know', 'The amber line shrinks as time runs out: 8 seconds for Rebound?, 12 for the others. Answering is optional; the score never depends on it.'],
      ['h', 'The questions you’ll see'],
      ['dl', [
        ['Rebound?', 'After a missed shot, the last missed free throw, or a block.'],
        ['Assisted?', 'After a made basket. <i>Bench</i> lights up the bench instead.'],
        ['Whose shot?', 'After a block when the miss wasn’t recorded. Pick 2PT or 3PT first.'],
        ['Who lost it?', 'After a steal, when the turnover wasn’t recorded.'],
        ['Who went off?', 'After a bench player’s play.'],
        ['Who comes on?', 'When a player fouls out. This one waits for you.'],
      ]],
      ['h', 'After a block: up to two questions'],
      ['p', 'A block is the one play that can ask twice. If the missed shot is already recorded, you only get <b>Rebound?</b>. If it isn’t, you get <b>Whose shot?</b> first, then <b>Rebound?</b>.'],
      ['steps', [
        '<b>Whose shot?</b> Pick 2PT or 3PT, then tap the shooter. That records their missed shot.',
        '<b>Rebound?</b> comes straight after. Tap who got the ball.',
        'Skip <b>Whose shot?</b> and the scorer doesn’t ask about the rebound either.',
      ]],
      ['h', 'Turning the questions off'],
      ['p', 'Know the game well and want fewer taps? You can switch the questions off on your phone.'],
      ['steps', [
        'Tap <b>•••</b> beside the clock to open the game menu.',
        'Tap <b>Follow-up questions: on</b>. It changes to <i>off</i>.',
        'Tap it again any time to turn the questions back on.',
      ]],
      ['tip', 'Good to know', 'With the questions off, you won’t be asked Rebound?, Assisted?, Who lost it?, Whose shot? or Who went off?. Record those plays with the stat buttons instead. Who comes on? after a foul-out, the and-one’s Who fouled? and the free throws always ask. The switch is only for your phone.'],
      ['h', 'If it goes wrong'],
      ['p', 'Tapped the wrong player? Tap <b>Undo</b> on the last play and answer again.'],
    ],
  },
  {
    slug: 'holds', title: 'Holds and swipes', blocks: [
      ['p', 'Buttons with three dots in the corner do more than one thing: a tap does the usual, a hold (or a swipe up) shows the other kinds.'],
      ['img', 'holds.jpg', 'Hold FOUL: every kind of foul, personal already picked.'],
      ['dl', [
        ['REB', 'Hold to say <i>Offensive</i> or <i>Defensive</i>. A tap works it out from the play before.'],
        ['TO', 'Hold for the kind: bad pass, lost ball, travel, double dribble, out of bounds.'],
        ['FOUL', 'Hold for shooting, offensive, technical, unsportsmanlike or disqualifying. A tap is a personal foul.'],
        ['Green 2PT / 3PT', 'Swipe up for an and-one: the basket, then who fouled, then the free throw.'],
      ]],
      ['steps', [
        '<b>Swipe the last play left</b> to undo it.',
        '<b>Swipe a question down</b> (the amber line, or a menu) to close it.',
        '<b>Tap a team’s name</b> for team plays: timeouts, shot-clock and 3-, 5- and 8-second violations, a coach or bench technical, and DNP.',
      ]],
    ],
  },
  {
    slug: 'fouls', title: 'Fouls and free throws', blocks: [
      ['p', 'A foul opens the foul panel in the stat buttons’ place. It shows the player’s foul count, whether the team is in the penalty, and how many free throws, already filled in.'],
      ['img', 'fouls.jpg', 'A shooting foul: two free throws, the shooter picked, each one made ✓ or missed ✗.'],
      ['steps', [
        '<b>Check the number of free throws.</b> Change it if the ref gave a different number (0 to 3), or tap <i>And-one</i>.',
        '<b>Pick the shooter</b> if it isn’t picked: tap them in the panel or on the court.',
        '<b>Tap ✓ or ✗</b> for each free throw as it happens.',
      ]],
      ['tip', 'Good to know', 'Team fouls show as small bars under each score. From the 5th team foul in a quarter, the other team shoots: the panel says <i>In the penalty</i>. A foul stops the clock by itself.'],
      ['p', 'A missed last free throw asks <b>Rebound?</b>. Closing the panel with × keeps the foul and skips the free throws.'],
    ],
  },
  {
    slug: 'subs', title: 'Subs and DNP', blocks: [
      ['p', 'Keep the five on court right and every stat lands on the right player.'],
      ['img', 'subs.jpg', 'The Subs sheet: who comes off in red, who goes on in green.'],
      ['steps', [
        '<b>One sub:</b> tap the bench player, then the court player coming off.',
        '<b>Several at once:</b> tap <b>Sub</b> beside the team’s name, tap who comes off and who goes on (they pair up in that order), then Save. <i>All 5</i> is a line change.',
        '<b>Forgot to sub?</b> Just record the bench player’s play. They come on and the scorer asks who went off.',
      ]],
      ['tip', 'Good to know', 'DNP (didn’t play) is under the team’s name → <i>DNP…</i>. A DNP player’s first play takes them off the DNP list.'],
    ],
  },
  {
    slug: 'clock', title: 'The clock and quarters', blocks: [
      ['p', 'Quarters are 12 minutes. The clock in the middle of the scoreboard runs on your phone, even if you leave the app for a moment.'],
      ['img', 'clock.jpg', 'The scoreboard: score, quarter, the clock with ▶ / ❚❚, and the game menu (•••).'],
      ['steps', [
        '<b>▶ / ❚❚</b> starts and pauses it. Fouls and timeouts pause it by themselves.',
        'After a whistle, the next live-ball play (a shot, rebound, steal or block) restarts it, and the scorer tells you.',
        '<b>Tap the time</b> to fix it if it drifts from the scoreboard at the court.',
        'At 0:00, tap <b>End</b> beside the clock to end the quarter. The game menu (•••) can end it early.',
      ]],
      ['tip', 'Good to know', 'After the 4th quarter with a winner, the scorer asks <i>Game over?</i>. A tie goes to overtime (5 minutes).'],
    ],
  },
  {
    slug: 'two', title: 'Two scorers', blocks: [
      ['p', 'Two phones can score one game: each takes a team, or one takes both. Never more than two.'],
      ['steps', [
        '<b>Pick a side</b> when you open the game. The pill at the top says <i>You: White</i>; tap it to change.',
        'The other team folds into one line showing their latest play, so your screen has only your five and bench.',
        '<b>One phone keeps the clock</b>: the one on Both, otherwise White’s. The other phone shows that clock.',
        '<b>Want a side someone has?</b> Ask them. They get <i>Hand over</i> or <i>Keep</i>. A phone that has been quiet for 2 minutes can be taken over.',
      ]],
      ['tip', 'Good to know', 'Both phones’ plays meet on the server in the order they happened, so a rebound after the other side’s miss is still counted right.'],
    ],
  },
  {
    slug: 'end', title: 'Ending the game', blocks: [
      ['p', 'When the 4th quarter (or overtime) ends with a winner, the stat buttons make way for the Game over panel.'],
      ['img', 'end.jpg', 'Game over: the final score from the plays, the player of the game, then Publish.'],
      ['steps', [
        'Wait until every play is sent. The panel tells you if some are still sending.',
        '<b>Check the final score.</b> It comes from the plays; fix it if the court’s scoreboard says otherwise.',
        '<b>Pick the player of the game</b> from the winners’ top five.',
        '<b>Publish the game.</b> The box score goes on the site and in the app straight away, marked <i>Stats pending review</i>.',
      ]],
      ['tip', 'Good to know', 'With two scorers, the phone keeping the clock publishes; the other one just waits. After that a games admin checks the plays, and writes the recap.'],
    ],
  },
  {
    slug: 'papawis', title: 'Scoring Papawis', blocks: [
      ['p', 'Papawis uses the same scorer, Light against Dark. Papawis scorers score it (an admin adds them: it’s separate from scoring league games). On the run’s day, its card on the Papawis tab has <b>Start scoring</b>. One phone scores at a time, every game of the run.'],
      ['steps', [
        '<b>Set up the game.</b> Before each game: <i>Basic</i> or <i>Full</i> stats, the quarter length, how many quarters, and who’s here. Tap a name if they didn’t come; the ⇄ beside it moves them to the other side. A guest who isn’t on the list: type their name and tap <i>+ Light</i> or <i>+ Dark</i>.',
        '<b>Start Game 1.</b> The clock starts on the first play, or tap ▶.',
        '<b>Score.</b> <i>Basic</i>: tap a player, then FT, 2PT or 3PT for a make, or REB or AST. Misses aren’t logged and nothing asks a follow-up question. <i>Full</i>: everything works like a league game.',
        '<b>Someone switches sides?</b> Hold their tile → <i>Move to Light</i> (or Dark). Their points so far stay with the old side; from then on they count for the new one. The team’s name menu has <i>Move someone to Light…</i> too, and <i>A late arrival…</i> for someone you marked not here.',
        '<b>End the last quarter</b> with End beside the clock: <i>Game over</i> (a tie is fine), <i>Extra time</i> if there’s still time, or <i>Not yet</i>.',
        '<b>Game over</b>, then <i>Start Game 2</i>. It’s set up like the last game: same minutes, sides as they finished. Change anything that’s different and start.',
        '<b>Done playing?</b> Tap <i>Finish the run</i> once every play is sent (it needs signal). Keep or discard each game, check the Player of the Day, and save.',
      ]],
      ['dl', [
        ['No timeouts, penalty or foul-outs', 'Papawis has none of them, so the scoreboard shows no timeout dots or team-foul pips, and nobody fouls out.'],
        ['Someone else is scoring', 'Opening a run another scorer has shows who. Between games you can <i>Take over</i> once their phone has sent every play; mid-game, <i>Ask</i> them and they get <i>Let you score</i> or <i>Keep it</i>. If their phone goes quiet for 2 minutes, any scorer can take over.'],
        ['Guests', 'A guest’s stats stay with the run under their name and count in nobody’s career. Tell an admin, so they’re added to the run and charged.'],
        ['Another game of this run', 'The ••• menu switches back to an earlier game to fix it.'],
        ['Finish the run', 'Each game has Edit (opens it here) and Discard (left out of everything). The Player of the Day is the best rating over the games you keep (points, rebounds and assists when a game was Basic); pick someone else if they ran the show. Anyone who scored the run, or an admin, finishes it.'],
      ]],
      ['tip', 'Good to know', 'The results go on the run’s page with the box score and the top 3 as player cards. Papawis stats count in Papawis careers, separate from league totals.'],
    ],
  },
  {
    slug: 'table', title: 'The table display', blocks: [
      ['p', 'A tablet at the table can show the score and the clock from your phone. Coaches and players tap <i>Players</i> on it for the cards. On the tablet, open the app: Me → Scoring → <i>Table display</i> (once with internet beforehand, so it works offline).'],
      ['p', '<b>With internet</b> (the tablet on your hotspot is fine): tap <i>Follow online</i> on the tablet and pick your game. Nothing to pair: just keep scoring.'],
      ['p', '<b>No internet:</b> the two link directly. Your phone’s own hotspot drops the link after a few seconds, so use the <b>tablet’s</b> hotspot (or any other phone’s, or a pocket Wi‑Fi):'],
      ['steps', [
        '<b>Turn on the tablet’s hotspot</b> and join it from your phone.',
        '<b>On the tablet,</b> tap <i>Show the code</i>.',
        '<b>On your phone:</b> ••• → <i>Table display</i> → <i>Scan the tablet’s code</i>, and point it at the tablet.',
        '<b>Hold your phone’s code</b> up to the tablet’s camera. When it says <i>Tablet linked</i>, you’re done.',
      ]],
      ['dl', [
        ['On the tablet', 'The score, quarter and clock (it keeps running between updates), team fouls and timeouts for league games, the last play.'],
        ['Players', 'Only when someone taps it: the top 3 so far as cards, everyone’s points, any player’s card. It goes back to the score by itself after 20 seconds.'],
        ['Link lost', 'The tablet says so and keeps the clock running. ••• → Table display pairs it again.'],
      ]],
      ['tip', 'Good to know', 'Keep both screens on. A phone that locks stops sending until it’s back.'],
    ],
  },
  {
    slug: 'fix', title: 'Fixing mistakes', blocks: [
      ['p', 'Mistakes happen in a fast game. Most take one tap to fix, and nothing is ever lost: a fix is saved as a new play.'],
      ['img', 'fix.jpg', 'The last play, with Undo and Fix.'],
      ['dl', [
        ['Undo', 'Takes back the last play (or swipe it left). <i>Redo</i> brings it back until your next play.'],
        ['Fix', 'Changes who did it or what they did, adds a missed play right after it, or removes it.'],
        ['Older plays', 'Scoresheet → Plays: every play has Fix.'],
        ['The clock', 'Tap the time to set it.'],
      ]],
      ['tip', 'Good to know', 'Missed a play a while back? Fix the play just before it and choose <i>Add a play after this</i>. It goes in at the right spot.'],
      ['p', 'Still not right after the game? Tell a games admin: they check every game before the stats are final.'],
    ],
  },
];

const words = b => b.flat(2).join(' ').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
const minsOf = ch => Math.max(1, Math.round(words(ch.blocks) / 180));
const plain = ch => [ch.title, ...ch.blocks.flat(2)].join(' ').replace(/<[^>]+>/g, '').toLowerCase();

export function appScorerGuidePage({ back }) {
  const total = SCORER_GUIDE.reduce((n, ch) => n + minsOf(ch), 0);
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">How to score</span><span></span></div>
  <div class="hg">
    <p class="hg__k">WKND scorer guide · ${total} min read</p>
    <h1 class="hg__t">How to score a game</h1>
    <p class="hg__p">Everything you need to keep the box score of a league game from your phone: what to tap, what the questions mean, and how to finish.</p>
    <label class="hg__search"><span class="sr-only">Search the guide</span><input type="search" placeholder="Search the guide" enterkeyhint="search" autocomplete="off" data-hg-search></label>
  </div>
  <div class="sec">Contents</div>
  <ol class="group hg__toc" data-hg-toc>${SCORER_GUIDE.map((ch, i) => `<li><a class="cell" href="/app/help/scoring/${ch.slug}" data-text="${esc(plain(ch))}"><span class="hg__n num">${i + 1}</span><span class="cell__t">${esc(ch.title)}</span><span class="cell__v">${minsOf(ch)} min</span>${chev}</a></li>`).join('')}</ol>
  <p class="empty hg__none" data-hg-none hidden>Nothing in the guide matches that.</p>
  <a class="btn btn--ghost hg__try" href="/app/practice">Try it in a practice game</a>`;
}

export function appScorerChapterPage({ slug }) {
  const i = SCORER_GUIDE.findIndex(ch => ch.slug === slug);
  if (i === -1) return null;
  const ch = SCORER_GUIDE[i], prev = SCORER_GUIDE[i - 1], next = SCORER_GUIDE[i + 1];
  const block = ([kind, a, b]) => {
    if (kind === 'p') return `<p>${a}</p>`;
    if (kind === 'h') return `<h2>${a}</h2>`;
    if (kind === 'img') return `<figure><img src="/help/scorer/${esc(a)}" alt="${esc(b)}" loading="lazy" decoding="async"><figcaption>${b}</figcaption></figure>`;
    if (kind === 'steps') return `<ol>${a.map(s => `<li>${s}</li>`).join('')}</ol>`;
    if (kind === 'tip') return `<aside class="hg__tip"><b>${a}</b><p>${b}</p></aside>`;
    if (kind === 'dl') return `<dl>${a.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;
    return '';
  };
  return `<div class="navbar"><a class="navbar__back" href="/app/help/scoring">${backChev}Contents</a><span class="navbar__title">${i + 1} of ${SCORER_GUIDE.length}</span><span></span></div>
  <article class="hg hg--ch">
    <p class="hg__k">Chapter ${i + 1} · ${minsOf(ch)} min</p>
    <h1 class="hg__t">${esc(ch.title)}</h1>
    ${ch.blocks.map(block).join('\n    ')}
    <a class="btn btn--ghost hg__try" href="/app/practice">Try it in a practice game</a>
    <nav class="hg__pn" aria-label="Chapters">${prev ? `<a href="/app/help/scoring/${prev.slug}">‹ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="/app/help/scoring/${next.slug}">${esc(next.title)} ›</a>` : '<span></span>'}</nav>
  </article>`;
}
