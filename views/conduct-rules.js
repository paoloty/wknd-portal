import { escHtml, pageHeader } from './layout.js';

// /rules/conduct: the published conduct rules (Fable audit 2026-11-05, Paolo said yes to all
// 2026-11-06). The ladder comes live from fine_categories, the numbers from lib/conduct.js
// (passed in as `n`), so the page can't drift from what's charged and enforced. counts: anonymous
// per-season totals (seasonConductCounts). Replaces /rules/fines, which redirects here.
const peso = v => `₱${Number(v || 0).toLocaleString()}`;
const plural = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const sitsOut = c => (c.min_suspension_games > 0 ? `Sits out ${plural(c.min_suspension_games, 'game')}${c.level === 4 ? ', plus a review' : ''}` : 'No games out on its own');

const POINTS = [['1–3', 'Nothing'], ['4–5', '1 game'], ['6–7', '2 games'], ['8–9', '3 games'], ['10+', 'The rest of the season, and a review before next season']];

const card = (title, items) => `<div class="section-header"><h2>${title}</h2></div>
  <div class="card cr-card"><ul class="cr-list">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;

function ladderCard(c) {
  return `<div class="card fine-tier">
    <div class="fine-tier__amount">${peso(c.amount)}</div>
    <div class="fine-tier__body">
      <div class="fine-tier__name">${escHtml(c.label)}</div>
      ${c.description ? `<p class="fine-tier__desc">${escHtml(c.description)}</p>` : ''}
      ${c.examples?.length ? `<div class="fine-tier__examples">${c.examples.map(e => `<span class="fine-chip">${escHtml(e)}</span>`).join('')}</div>` : ''}
      <div class="fine-tier__meta"><span class="fine-tier__points">${plural(c.points || 0, 'pt', 'pts')}</span><span>${sitsOut(c)}</span></div>
    </div>
  </div>`;
}

function countsTable(counts) {
  if (!counts.length) return '<p class="fine-footnote">No decided cases yet.</p>';
  return `<div class="cr-table-wrap"><table class="fine-points-table cr-counts">
    <thead><tr><th>Season</th><th>Warnings</th><th>Level 1</th><th>Level 2</th><th>Level 3</th><th>Level 4</th><th>Rejected</th><th>Appeals won</th><th>Suspensions</th></tr></thead>
    <tbody>${counts.map(s => `<tr><td>Season ${escHtml(s.season)}</td><td>${s.warnings}</td><td>${s.levels[1]}</td><td>${s.levels[2]}</td><td>${s.levels[3]}</td><td>${s.levels[4]}</td><td>${s.rejected}</td><td>${s.appealsWon} of ${s.appeals}</td><td>${s.suspensions}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

export function conductRulesPage({ categories = [], counts = [], n }) {
  const ladder = categories.filter(c => c.level > 0).sort((a, b) => a.level - b.level);
  return `<div class="container"><div class="page-content cr-page">
  ${pageHeader({
    title: 'Conduct rules',
    description: 'WKND stays at four teams. We don’t add teams, we pick people. These rules are how we stay fair to everyone who shows up to play, and how we decide who plays next season. Same rules for everyone.',
  })}

  <nav class="cr-toc" aria-label="On this page">
    <a href="#where">Where</a><a href="#ladder">The ladder</a><a href="#points">Points</a><a href="#warnings">Warnings</a><a href="#reports">Reports</a>
    <a href="#your-side">Your side</a><a href="#appeal">Appeal</a><a href="#paying">Paying</a><a href="#next-season">Next season</a><a href="#honest">How we keep it honest</a>
  </nav>

  <div id="where">${card('Where these rules apply', [
    'Everything WKND: league games, Papawis runs, practices, the court before and after, the Barkadahan chat, comments and polls on the site and app, WKND’s social posts, and any group chat about WKND.',
    'You’re also responsible for the people you bring to a game.',
    'Same ladder everywhere. A suspension covers league games and Papawis runs.',
  ])}</div>

  <div class="section-header" id="ladder"><h2>The ladder</h2></div>
  <p class="fine-footnote cr-lead">The examples are binding: the same act gets the same level for everyone. If an act fits two levels, the lower one applies unless the admin deciding writes down why not.</p>
  <div class="fine-tiers">
    <div class="card fine-tier">
      <div class="fine-tier__amount">₱0</div>
      <div class="fine-tier__body">
        <div class="fine-tier__name">Warning</div>
        <p class="fine-tier__desc">A first small thing. On your record, costs nothing the first time.</p>
        <div class="fine-tier__examples">${['Wrong jersey', 'Late', 'Delay of game', 'One heated word', 'A chat message that crossed the line'].map(e => `<span class="fine-chip">${e}</span>`).join('')}</div>
        <div class="fine-tier__meta"><span class="fine-tier__points">0 pts</span><span>No games out</span></div>
      </div>
    </div>
    ${ladder.map(ladderCard).join('')}
  </div>

  <div class="section-header" id="points"><h2>Points and sitting out</h2></div>
  <table class="fine-points-table">
    <thead><tr><th>Points this season</th><th>Sits out</th></tr></thead>
    <tbody>${POINTS.map(([r, s]) => `<tr><td>${r}</td><td>${s}</td></tr>`).join('')}</tbody>
  </table>
  <div class="card cr-card"><ul class="cr-list">
    <li>You sit out the games when you reach each line: reaching 4 points is 1 game, reaching 6 is 2 more, and so on.</li>
    <li>A level with its own games (Level 3 and 4) applies even if your points are low. The bigger number counts, not both.</li>
    <li>A second case at the same level in one season is charged one level higher.</li>
    <li>You serve a suspension by missing your own team’s league games. A game you play anyway doesn’t count. Until it’s served, you can’t join Papawis runs.</li>
    <li>Points reset when a new season starts. Games you still owe don’t: you serve them in your team’s next league games.</li>
  </ul></div>

  <div id="warnings">${card('Warnings', [
    'Only admins give warnings. Referees, scorers and heads can ask for one.',
    'A warning is on your record. It costs nothing.',
    `Your ${n.warningsForL1 === 3 ? 'third' : `${n.warningsForL1}th`} warning in a season becomes a Level 1 case, whatever it was for.`,
    'Being muted in the Barkadahan counts as a warning.',
  ])}</div>

  ${card('On-court fouls are separate', [
    'A technical, unsportsmanlike or disqualifying foul is the game’s penalty (FIBA: free throws, possession, ejection). It isn’t a fine by itself.',
    'An ejection or a disqualifying foul opens a conduct case automatically from the scorebook, and an admin decides it like any other case.',
    'A plain technical with nothing else never opens a case. You’re never fined twice for one act.',
  ])}

  <div id="reports">${card('Reports', [
    'Anyone can report what they saw: players, heads, referees, scorers, admins. Players report from the player’s profile.',
    `Report within ${n.reportDays} days of the incident, ${n.reportDaysOnline} days for something online with a screenshot. Later than that, it’s a warning at most.`,
    'A report says what happened, when, where, and who else saw it. “He’s toxic” isn’t a report.',
    'One incident, one case. A second report of the same incident joins the first.',
    'A player’s report goes to the admins first. It only goes further if most of them agree it should.',
    'A report filed to get back at someone, or that you knew was false, is a Level 2 case against you. A report being rejected doesn’t make it false.',
  ])}</div>

  ${card('Evidence', [
    'A fine needs the admin deciding to be satisfied it more likely than not happened, from at least one of: video, a referee’s or scorer’s account, or two people who weren’t both on the reporter’s team.',
    'One player’s word alone is enough for a warning, never for a fine.',
  ])}

  <div id="your-side">${card('You get to answer', [
    'When a case about you is opened, you’re told the same day: what it’s about, the level, and who filed it. A player’s report shows as “a player”.',
    `You have ${n.respondHours} hours to give your side, on the site or in the app (Me → Conduct). Nobody decides before then unless you’ve answered.`,
    'The heads of the other teams give their recommendation. The head of your own team doesn’t vote, and neither does whoever filed it. If you saw it happen, your account goes in the case, not a vote.',
    `An admin decides within ${n.decideDays} days, with a written reason you can read.`,
    'If you’re an admin, the super admin decides your case. Nobody votes on or decides a case about themselves or one they filed.',
  ])}</div>

  <div id="appeal">${card('Appeal', [
    `One appeal, within ${n.appealDays} days of the decision, in writing, saying what the decision got wrong.`,
    `At least ${n.appealHeads} heads from teams not involved give their view, then the super admin decides. If the super admin filed the case, another admin decides.`,
    'Your fine is on hold until the appeal is decided. Games to sit out are served meanwhile; if you win, they’re off your record.',
    'An appeal can only lower or confirm a decision, never raise it.',
  ])}</div>

  <div id="paying">${card('Paying', [
    `A fine is due ${n.payDays} days after the decision (or after the appeal). Pay the way you pay anything else on WKND.`,
    'Unpaid after that: you can’t play league games or join runs until it’s paid. It lifts the moment we confirm the payment.',
    'Unpaid at Season sign-up: not eligible, same as any other balance.',
  ])}</div>

  ${card('Leaving and coming back', [
    'Fines and games to sit out stay on your record if you stop playing.',
    'Coming back means settling your balance, serving what’s left, and a review if you ever had a Level 3 or 4.',
  ])}

  <div id="next-season">${card('Next season', [
    'When we choose next season’s players, we look at the last two seasons: warnings, points, cases by level, games served, and unpaid fines.',
    `A Level 3 or 4, ${n.reviewPoints} or more points in a season, or 2 or more fines means the admins discuss you before you get a spot.`,
    `${n.removalPoints} or more points in a season, or a second Level 4 within two seasons, means you’re not invited back. That takes a majority of admins, not one person, and you’re heard first.`,
  ])}</div>

  <div id="honest">${card('Where judgement stays, and how we keep it honest', [
    'No rule removes judgement from which level an act is, whether it more likely than not happened, what a review decides, and whether someone is invited back.',
    'We keep that honest with: the binding examples, a written reason on every decision, the vote shown on every case, nobody deciding their own case, one appeal, and the counts below, with no names.',
  ])}</div>

  <div class="section-header"><h2>Cases by season</h2></div>
  ${countsTable(counts)}

  <p class="fine-footnote">On-court rules are on <a href="/rules">League rules</a>. Questions about a case: reply to it from your Conduct page, or message an admin.</p>
</div></div>`;
}
