// Practice game setup (Me → Scoring → Practice game, 2026-10-27): two real teams, the clock, and
// the Try tips switch, then the real scorer with nothing leaving the phone (public/scorer.js
// `practice`). "Carry on" is filled in by public/app.js initPractice from the phone's own note of
// the last practice (localStorage wknd-practice), so it never asks the server.
import { esc, backChev } from './layout.js';

// teams: [{ id, name, color }] (at least two with players)
export function appPracticePage({ teams, back }) {
  const pick = (name, label, on) => `<fieldset class="pr-pick"><legend class="sec">${esc(label)}</legend>
    <div class="group pr-teams">${teams.map(t => `<label class="cell pr-team"><input type="radio" name="${name}" value="${esc(t.id)}"${t.id === on ? ' checked' : ''} required><span class="dot" style="--c:${esc(t.color)}"></span><span class="cell__t">${esc(t.name)}</span></label>`).join('')}</div></fieldset>`;
  return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Practice game</span><span></span></div>
  <form class="pr" method="get" action="/app/practice/play" data-practice>
    <div class="msg msg--info pr-note">Only on this phone. Nothing is sent, saved to the site or shown to anyone, and the players aren’t told. Reset any time.</div>
    <a class="btn pr-carry" href="#" data-practice-carry hidden></a>
    ${pick('a', 'Home team', teams[0]?.id)}
    ${pick('b', 'Away team', teams[1]?.id)}
    <div class="sec">Quarters</div>
    <div class="group"><div class="cell"><div class="seg" style="flex:1">
      <label><input type="radio" name="q" value="12" checked><span>12 min, like a game</span></label>
      <label><input type="radio" name="q" value="5"><span>5 min, quick</span></label>
    </div></div></div>
    <div class="sec">Try tips</div>
    <div class="group"><label class="cell"><span class="cell__t">Show tips while I practise<small>One move at a time, ticked off as you do it.</small></span><input type="checkbox" class="switch" data-practice-tips checked></label></div>
    <p class="foot-note" data-practice-err hidden>Pick two different teams.</p>
    <div class="pr-go"><button type="submit" class="btn">Start practice</button></div>
  </form>`;
}
