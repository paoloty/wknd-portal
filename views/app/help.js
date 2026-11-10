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
      ['tip', 'Scoring Papawis?', 'It has its own guide: Me → Scoring → <i>How to score Papawis</i>, and a practice run to try it.'],
      ['p', 'You can score a game when an admin picks you for it, or when you’re a scorer, which lets you score any game with scoring turned on. Your games are under <b>Me → Scoring → Games to score</b>, and Home reminds you on game day.'],
      ['img', 'list.jpg', 'Games to score: every game you can score, with the ones being scored now marked.'],
      ['steps', [
        '<b>Open the game</b> a few minutes before tip-off. Scoring opens 2 hours before tip-off (Papawis runs too), or at the start of the day when there’s no time set; until then the game shows greyed in Games to score with when it opens, so nobody starts it by accident. Open it once with signal: it then opens by itself on time, even with no signal.',
        '<b>Pick your side</b> if someone else is scoring too: White, Blue, or Both. With one phone, choose Both.',
        '<b>Check who’s there.</b> Tap a team’s name → <i>Didn’t play…</i> to mark players who didn’t come, so they don’t show on court.',
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
      ['p', 'Each player on court is a card in their team’s colour: their jersey number big over a faint photo, their surname in the strip at the bottom. The card you picked turns amber.'],
      ['dl', [
        ['Green FT · 2PT · 3PT', 'A made free throw or basket. 4PT shows only at courts with a 4-point line.'],
        ['Red FT · 2PT · 3PT', 'A missed one.'],
        ['REB · AST · STL · BLK', 'Rebound, assist, steal, block.'],
        ['TO · FOUL', 'Turnover and foul. Hold them for the other kinds.'],
      ]],
      ['steps', [
        'The card flashes what you recorded (<i>+2</i>, <i>MISS</i>, <i>REB</i>) and the play shows in the last-play line.',
        'A bench player’s stat brings them on court and asks who went off.',
        'Hold a player’s card to see their line so far. Hold a team’s score for the score by quarter.',
        '<b>Scoresheet</b> at the bottom has the box score, every play and the fouls.',
      ]],
      ['tip', 'Good to know', 'A player’s fouls show in the top corner of their card (<i>2F</i>): white when it’s worth watching, red when they’re one away. On a small phone the cards drop the photos, so the numbers and names stay big.'],
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
      ['h', 'The Spotter: pick your questions'],
      ['p', 'On a stat crew, the spotter is the one who calls out who got the board or the assist. Here the Spotter is your setting for these questions: all of them, a few, or none.'],
      ['steps', [
        'Tap <b>•••</b> beside the clock to open the game menu.',
        'Under <i>My settings</i>, tap <b>Spotter</b>. It shows what you have now: <i>Off</i>, <i>Light</i>, <i>Full</i> or <i>Your mix</i>.',
        'Pick <b>Off</b> (no questions), <b>Light</b> (Rebound? and Assisted? only) or <b>Full</b> (every question).',
        'Or switch single questions on and off below. Anything that isn’t one of the three shows as <i>Your mix</i>.',
      ]],
      ['tip', 'Good to know', 'The Spotter is yours: it’s saved to your account, so it’s the same on any phone you score on. A question you’ve switched off isn’t asked; record that play with the stat buttons instead. Who comes on? after a foul-out, the and-one’s Who fouled? and the free throws always ask. Full is where everyone starts.'],
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
      ['img', 'team.jpg', 'A team’s menu: Call timeout (it stops the clock), the team turnovers, a coach or bench technical, Didn’t play… and Sub.'],
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
        '<b>An open spot:</b> if a team is down to 4 on court (someone fouled out and everyone on the bench had already sat), the court shows <i>Open</i>. Tap a bench player and they go straight on, nobody comes off.',
      ]],
      ['tip', 'Good to know', 'DNP (didn’t play) is under the team’s name → <i>Didn’t play…</i>. A DNP player’s first play takes them off the DNP list.'],
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
        '<b>Publish the game.</b> The box score goes on the site and in the app straight away, marked <i>Unofficial stats</i> until a stats approver makes them official.',
      ]],
      ['tip', 'Good to know', 'With two scorers, the phone keeping the clock publishes; the other one just waits. After that a games admin checks the plays, and writes the recap.'],
    ],
  },
  {
    slug: 'thumb', title: 'One hand: thumb mode', blocks: [
      ['p', 'Scoring with one hand? <b>Thumb mode</b> puts everything you tap every play in the bottom half of the screen: the clock, the five on court and the buttons. The top keeps what you read or tap now and then: the score, the benches and the plays before the last one.'],
      ['img', 'thumb.jpg', 'Thumb mode: the benches and the last plays up top, the clock, both fives and the buttons at the bottom.'],
      ['steps', [
        '<b>Turn it on</b> in the game menu (•••): under <i>My settings</i>, switch <i>Thumb mode</i> on. Your phone remembers it for league games.',
        '<b>Left-handed?</b> ••• → <i>Hand</i> → <i>Left</i> moves the clock’s ▶ and mirrors the buttons to your side.',
        '<b>Subs:</b> the benches are up top, one row per team; swipe a row for more. Tap a bench player, then who comes off, as always. Sub beside the team name works too.',
        '<b>An older play:</b> tap it in the list at the top to fix it. The last play is in the dock with Undo and Fix.',
      ]],
      ['tip', 'Good to know', 'Everything works the same: every button, hold, swipe and question. Only the order on the screen changes. The Scoresheet is in the game menu (•••). With two scorers each phone docks only its own five, so the cards are taller.'],
    ],
  },
  {
    slug: 'papawis', title: 'Scoring Papawis', blocks: [
      ['p', 'Papawis uses the same scorer, Light against Dark, and has its own guide: Me → Scoring → <i>How to score Papawis</i>. It covers setting up each game, Basic stats, switching sides between Light and Dark, and Finish the run. There’s a practice run to try it too.'],
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
        ['Papawis', 'The clock is as big as the scores; tap it on the tablet to fill the screen with it (tap again to go back). Tap <i>Turn on sound</i> once: it chimes at 2:00, ticks from 0:05 and buzzes at 0:00, and the clock turns amber, then red.'],
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
        ['Fix', 'Opens <i>Fix a play</i>: <i>Wrong player</i> (tap the right one on the court), <i>Wrong stat</i>, <i>Missed a play</i> or <i>Remove</i>. The new score shows before you save.'],
        ['Fixing', 'An amber frame and the <i>Fixing</i> bar stay on until you save or tap <i>Cancel</i>. New plays wait until then.'],
        ['Older plays', 'Scoresheet → Play-by-play: tap any play (each has a pencil). To see one player’s plays, hold their card, then <i>All [name]’s plays</i>.'],
        ['Twice?', 'The same thing from one player within a few seconds (a double tap, or both phones scoring it) gets a <i>Twice?</i> tag. Tap it, then <i>Remove</i>.'],
        ['After a fix', 'A line says what changed, with <i>Undo</i> for a few seconds.'],
        ['The clock', 'Tap the time to set it.'],
      ]],
      ['img', 'fix-panel.jpg', 'Fix a play: the play, then what’s wrong.'],
      ['tip', 'Good to know', 'Missed a play a while back? Fix the play just before it and choose <i>Missed a play</i>. It goes in at the right spot.'],
      ['p', 'Still not right after the game? Tell a games admin: they check every game before the stats are final.'],
    ],
  },
  {
    // Re-track a saved box score (2026-11-10, mockup claude.ai/artifact/BNeRKL2kkH25NLsqZr45Z2).
    slug: 'retrack', title: 'Admins: re-track a saved game', blocks: [
      ['p', 'A game whose box score is saved can be scored again from the video, start to finish, while that box score stays on the site. Players see nothing new until it’s replaced.'],
      ['dl', [
        ['Unofficial stats', 'Published from the court. Any games admin can re-track it; a stats approver makes it official.'],
        ['Official stats', 'Final. A stats approver can <i>Reopen for review</i> (the other admins get a bell).'],
        ['Stats under review', 'Reopened. Players see the tag and keep the current box score. Any games admin can re-track it; a stats approver replaces it or taps <i>Keep as official</i>.'],
      ]],
      ['steps', [
        '<b>On the game’s Review card,</b> tap <i>Re-track from the video</i> (Unofficial or Under review stats). The scorer opens on an empty game, just admins, and it scores like a real one: the clock, quarters, fouls and every question.',
        '<b>Watch it anywhere.</b> On the TV is fine: the scorer runs its own clock, so pause it when you pause the video. If the game has a YouTube link, ••• → <i>Show the video</i> puts it above the scorer (it starts hidden).',
        '<b>Check as you go:</b> ••• → <i>Compare</i> shows both scores, and the saved game at the same moment when it was scored live.',
        '<b>At Game over,</b> tap <i>Compare and replace</i>: team totals and only the players whose lines differ.',
        '<b>A stats approver</b> taps <i>Replace the box score</i>: one step, the stats become official, the old box score is kept on record and <i>Undo the replace</i> puts it back. Or <i>Keep the saved one</i>: the re-track goes and the saved box score becomes official.',
      ]],
      ['tip', 'Good to know', '<i>Start over</i> throws away the re-track only; the saved box score isn’t touched. Stats approvers are picked by the super admin (player page → Settings).'],
    ],
  },
];


// How to score Papawis (Me → Scoring, 2026-11-01, mockup claude.ai/artifact/XpZnj9bEgij8cvqacFbCE1):
// its own guide, same reader. Screenshots in public/help/papawis/*.jpg, taken from a practice run.
// Switching sides (Light ↔ Dark) has its own chapter and is highlighted in the contents (Paolo:
// the one scorers miss most).
export const PW_SCORER_GUIDE = [
  {
    slug: 'before', title: 'Before the run', blocks: [
      ['p', 'Papawis scorers score the runs (an admin adds you in Papawis → Scorers; it’s separate from league scoring). One phone scores the whole run, game after game, Light against Dark.'],
      ['steps', [
        '<b>Find the run</b> under Me → Scoring → <i>Games to score</i>, or on its card on the Papawis tab: <i>Score today’s games</i>.',
        '<b>Scoring opens 2 hours before the run.</b> Until then it shows greyed with when it opens, so nobody starts it by accident.',
        '<b>Open it once with signal</b> (at home is fine). It’s then saved on your phone and opens by itself on time, even with no signal at the court.',
        '<b>New to it?</b> Me → Scoring → <i>Practice a run</i>: the same scorer on a past run’s players, only on your phone, with tips.',
      ]],
      ['tip', 'Good to know', 'Thumb mode is on for Papawis: everything you tap is in the bottom half, for one hand. Chapter 5 explains it.'],
    ],
  },
  {
    slug: 'setup', title: 'Setting up a game', blocks: [
      ['p', 'Every game of the run starts with its setup. Game 1 takes the run’s list on the sides the admin set; each next game starts set up like the one before.'],
      ['img', 'setup.jpg', 'A game’s setup: stats, minutes, quarters and who’s here, on their sides.'],
      ['steps', [
        '<b>Stats:</b> <i>Basic</i> (makes, rebounds and assists: the usual) or <i>Full</i> (everything a league game records).',
        '<b>Minutes and quarters</b> for this game.',
        '<b>Who’s here:</b> tap a name if they didn’t come. The <b>⇄</b> beside a name puts them on the other side.',
        '<b>A guest</b> who isn’t on the list: type their name and tap <i>+ Light</i> or <i>+ Dark</i>.',
        '<b>From the waitlist:</b> someone waitlisted who came for a no-show’s place. Tap <i>+ Light</i> or <i>+ Dark</i> beside their name. Their stats go on their profile.',
        '<b>Start Game 1.</b> The clock starts with the first play, or tap ▶.',
        '<b>The last 2 minutes:</b> your clock turns amber, and red in the last 10 seconds. A table display does the same: its clock grows under the two scores, with a chime and a buzzer (tap <i>Turn on sound</i> on the tablet). Tap the clock on the tablet to keep it that big all game.',
      ]],
    ],
  },
  {
    slug: 'basic', title: 'Scoring: Basic stats', blocks: [
      ['p', 'Basic records the makes, rebounds and assists. One tap for the player, one for what they did. No misses, and no questions after a play unless you ask for them (the Spotter, below).'],
      ['img', 'basic.jpg', 'Basic stats: the players at the bottom, then FT, 2PT, 3PT, REB, AST and ⇄.'],
      ['steps', [
        '<b>A basket:</b> tap the player, then <b>2PT</b> or <b>3PT</b> (or <b>4PT</b> at a court with a 4-point line). The other way round works too.',
        '<b>A free throw:</b> the player, then <b>FT</b>.',
        '<b>A rebound or an assist:</b> the player, then <b>REB</b> or <b>AST</b>.',
        '<b>Made a mistake?</b> <b>Undo</b> on the last play takes it back.',
      ]],
      ['dl', [
        ['The cards', 'Each player is a card with their photo and surname, framed in their side’s shirt: Light or Dark. No photo yet: their initials.'],
        ['A guest', 'The card’s border is dashed.'],
        ['Two with one surname', 'Their first initials tell them apart: <i>T. BRINGAS</i>, <i>JP BRINGAS</i>.'],
      ]],
      ['h', 'The Spotter: Assisted? after a basket'],
      ['p', 'Want the assists without remembering to tap AST? Turn on the Spotter and the scorer asks after each made basket. It starts off, so Basic stays one tap per play until you choose.'],
      ['steps', [
        'Tap <b>•••</b>, then <b>Spotter</b> under <i>My settings</i>. It says <i>Off</i> to start.',
        '<b>Light</b> asks <b>Assisted?</b> after a made 2PT, 3PT or 4PT. Tap who passed, or <i>No assist</i>.',
        '<b>Full</b> also asks <b>Who went off?</b> when a player from the bench makes a play, so the five on the court stay right.',
        '<b>Off</b> goes back to no questions. You can also switch each one on or off by itself.',
      ]],
      ['tip', 'Good to know', 'The Spotter is saved to your account, so it follows you to any phone. Basic and Full stats keep their own setting: questions on for league games don’t turn them on for a Basic run. Full stats work like a league game: misses, the Rebound? and Assisted? questions, steals, blocks, turnovers and fouls. How to score (the league guide) explains each.'],
    ],
  },
  {
    slug: 'switch', title: '⇄ Switching Light and Dark', blocks: [
      ['p', 'Players switch sides during a run all the time: someone leaves, a game is lopsided, a late arrival evens it out. <b>Move them the moment it happens</b>, so every point after it counts for the right side.'],
      ['img', 'switch.jpg', '⇄ then the player: they move to the other side.'],
      ['h', 'During a game'],
      ['steps', [
        '<b>Tap ⇄, then the player</b> who switched. They move to the other side.',
        'Or <b>hold their card</b>, then <i>Move to Dark</i> (or Light).',
        'Or tap the side’s name → <i>Move someone to Light</i>.',
      ]],
      ['h', 'Between games'],
      ['steps', [
        'The next game’s setup starts with the sides as they finished. Tap <b>⇄</b> beside a name to put them on the other side before you start.',
      ]],
      ['dl', [
        ['Where the points go', 'Before the move they stay with the old side; from the move on they count for the new one. Their own line keeps everything.'],
        ['A side down to 4', 'Moving someone off the court leaves an <i>Open</i> spot when nobody on the bench is fresh. Tap a bench player and they go straight on. The player who moved starts on the new side’s bench.'],
        ['Moved the wrong player?', 'Undo the move, or move them back.'],
        ['Someone came late', 'The side’s name → <i>A late arrival</i> for someone you marked not here.'],
        ['Someone from the waitlist', 'The side’s name → <i>From the waitlist</i> (the number says how many are waiting), then their name. They join that side’s bench.'],
      ]],
      ['tip', 'Good to know', 'The practice run plays this out: halfway through a game it tells you someone “just switched to Dark”, and its Finish the run shows where their points went.'],
    ],
  },
  {
    slug: 'thumb', title: 'One hand: thumb mode', blocks: [
      ['p', 'Thumb mode is on for Papawis. Everything you tap every play is in the bottom half: the clock, both sides’ players, the buttons. The top shows the score, the bench and the plays before the last one.'],
      ['steps', [
        '<b>Left-handed?</b> ••• → <i>Hand</i> → <i>Left</i> moves the clock’s ▶ and mirrors the buttons.',
        '<b>Prefer the old layout?</b> ••• → switch <i>Thumb mode</i> off. Your phone remembers it.',
        '<b>An older play:</b> tap it in the list at the top to fix it.',
      ]],
    ],
  },
  {
    slug: 'next', title: 'Ending a game, the next game', blocks: [
      ['steps', [
        '<b>End the last quarter</b> with End beside the clock: <i>Game over</i> (a tie is fine), <i>Extra time</i> if there’s still time, or <i>Not yet</i>.',
        '<b>Start Game 2.</b> It’s set up like the last game: same minutes, sides as they finished. Change anything that’s different, then start.',
        '<b>Back to an earlier game</b> to fix it: ••• → <i>Another game</i>.',
      ]],
      ['dl', [
        ['No timeouts, penalty or foul-outs', 'Papawis has none of them, so the scoreboard shows no timeout dots or team-foul pips, and nobody fouls out.'],
      ]],
    ],
  },
  {
    slug: 'two', title: 'Two phones and taking over', blocks: [
      ['p', 'One phone scores at a time. Opening a run someone else is scoring shows who.'],
      ['dl', [
        ['Between games', '<i>Take over</i> once their phone has sent every play.'],
        ['Mid-game', '<i>Ask</i> them: they get <i>Let you score</i> or <i>Keep it</i>.'],
        ['Their phone went quiet', 'After 2 minutes, any scorer can take over.'],
      ]],
    ],
  },
  {
    slug: 'finish', title: 'Finish the run', blocks: [
      ['p', 'When the playing’s done, ••• → <i>Finish the run</i> (or <i>Done playing · Finish the run</i> after a game). It needs signal: every play has to reach the server first.'],
      ['steps', [
        '<b>Each game:</b> keep it, <i>Edit</i> it (opens it in the scorer) or <i>Discard</i> it (left out of everything).',
        '<b>The Player of the Day</b> is the best rating over the games you keep (points, rebounds and assists when a game was Basic). Pick someone else if they ran the show.',
        '<b>Save.</b> The results go on the run’s page with the box score and the top 3 as cards, and into everyone’s Papawis stats.',
      ]],
      ['tip', 'Good to know', 'Anyone who scored the run, or an admin, finishes it. Saving again later replaces the results. Anyone from the waitlist who played moves to Confirmed when you save, so the close-out charges them like everyone else.'],
    ],
  },
  {
    slug: 'fix', title: 'Fixing mistakes', blocks: [
      ['img', 'fix.jpg', 'Fix a play: the play, then what’s wrong.'],
      ['dl', [
        ['Undo', 'Takes back the last play. <i>Redo</i> brings it back until your next play.'],
        ['Fix', 'On the last play, or tap an older one at the top (or in Scoresheet → Play-by-play). <i>Fix a play</i> opens: <i>Wrong player</i> (tap the right one on the court), <i>Wrong stat</i>, <i>Missed a play</i> or <i>Remove</i>. An amber frame and the <i>Fixing</i> bar stay on until you save or tap <i>Cancel</i>.'],
        ['Twice?', 'The same thing from one player within a few seconds gets a <i>Twice?</i> tag. Tap it, then <i>Remove</i>. A line says what changed, with <i>Undo</i> for a few seconds.'],
        ['A player on the wrong side', 'Move them (⇄). Points before the move stay where they were; fix those plays one by one if they were on the wrong side all along.'],
        ['A guest', 'Their stats stay with the run under their name and count in nobody’s career. Tell an admin, so they’re added to the run and charged.'],
        ['After saving', 'Finish the run again from the run’s card, or ask an admin.'],
      ]],
    ],
  },
];

const words = b => b.flat(2).join(' ').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
const minsOf = ch => Math.max(1, Math.round(words(ch.blocks) / 180));
const plain = ch => [ch.title, ...ch.blocks.flat(2)].join(' ').replace(/<[^>]+>/g, '').toLowerCase();

// The Papawis guide's look and links (the league guide's are the defaults below).
export const PW_GUIDE_OPTS = { guide: PW_SCORER_GUIDE, base: '/app/help/papawis', img: '/help/papawis/', tryHref: '/app/papawis/practice', tryText: 'Try it in a practice run',
  kicker: 'Papawis scorer guide', title: 'How to score a Papawis run', nav: 'How to score Papawis', intro: 'From opening the run to Finish the run: Light against Dark, game after game, on one phone.', hot: 'switch', hotSub: 'The one scorers miss most' };
const LEAGUE_OPTS = { guide: SCORER_GUIDE, base: '/app/help/scoring', img: '/help/scorer/', tryHref: '/app/practice', tryText: 'Try it in a practice game',
  kicker: 'WKND scorer guide', title: 'How to score a game', nav: 'How to score', intro: 'Everything you need to keep the box score of a league game from your phone: what to tap, what the questions mean, and how to finish.', hot: '', hotSub: '' };

export function appScorerGuidePage({ back, opts = LEAGUE_OPTS }) {
  const G = opts.guide;
  const total = G.reduce((n, ch) => n + minsOf(ch), 0);
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">${esc(opts.nav)}</span><span></span></div>
  <div class="hg">
    <p class="hg__k">${esc(opts.kicker)} · ${total} min read</p>
    <h1 class="hg__t">${esc(opts.title)}</h1>
    <p class="hg__p">${esc(opts.intro)}</p>
    <label class="hg__search"><span class="sr-only">Search the guide</span><input type="search" placeholder="Search the guide" enterkeyhint="search" autocomplete="off" data-hg-search></label>
  </div>
  <div class="sec">Contents</div>
  <ol class="group hg__toc" data-hg-toc>${G.map((ch, i) => `<li><a class="cell${ch.slug === opts.hot ? ' hg__hot' : ''}" href="${opts.base}/${ch.slug}" data-text="${esc(plain(ch))}"><span class="hg__n num">${i + 1}</span><span class="cell__t">${esc(ch.title)}${ch.slug === opts.hot ? `<small>${esc(opts.hotSub)}</small>` : ''}</span><span class="cell__v">${minsOf(ch)} min</span>${chev}</a></li>`).join('')}</ol>
  <p class="empty hg__none" data-hg-none hidden>Nothing in the guide matches that.</p>
  <a class="btn btn--ghost hg__try" href="${opts.tryHref}">${esc(opts.tryText)}</a>`;
}

export function appScorerChapterPage({ slug, opts = LEAGUE_OPTS }) {
  const G = opts.guide;
  const i = G.findIndex(ch => ch.slug === slug);
  if (i === -1) return null;
  const ch = G[i], prev = G[i - 1], next = G[i + 1];
  const block = ([kind, a, b]) => {
    if (kind === 'p') return `<p>${a}</p>`;
    if (kind === 'h') return `<h2>${a}</h2>`;
    if (kind === 'img') return `<figure><img src="${opts.img}${esc(a)}" alt="${esc(b)}" loading="lazy" decoding="async"><figcaption>${b}</figcaption></figure>`;
    if (kind === 'steps') return `<ol>${a.map(s => `<li>${s}</li>`).join('')}</ol>`;
    if (kind === 'tip') return `<aside class="hg__tip"><b>${a}</b><p>${b}</p></aside>`;
    if (kind === 'dl') return `<dl>${a.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl>`;
    return '';
  };
  return `<div class="navbar"><a class="navbar__back" href="${opts.base}">${backChev}Contents</a><span class="navbar__title">${i + 1} of ${G.length}</span><span></span></div>
  <article class="hg hg--ch">
    <p class="hg__k">Chapter ${i + 1} · ${minsOf(ch)} min</p>
    <h1 class="hg__t">${esc(ch.title)}</h1>
    ${ch.blocks.map(block).join('\n    ')}
    <a class="btn btn--ghost hg__try" href="${opts.tryHref}">${esc(opts.tryText)}</a>
    <nav class="hg__pn" aria-label="Chapters">${prev ? `<a href="${opts.base}/${prev.slug}">‹ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${opts.base}/${next.slug}">${esc(next.title)} ›</a>` : '<span></span>'}</nav>
  </article>`;
}
