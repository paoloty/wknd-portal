// Player setup in the app: photo → details → season → done. Each step shows what's already
// on file, so a player who registered on the site mostly just confirms. Skipped steps stay
// on Home as the "Finish setting up" card (server.js appSetupState).
import { esc, appAvatar, backChev, icons, soonTag } from './layout.js';

export const SETUP_STEPS = ['photo', 'details', 'season'];
// Same choices and stored values as the register form (views/register.js).
export const POSITIONS = [['PG', 'Point guard'], ['SG', 'Shooting guard'], ['SF', 'Small forward'], ['PF', 'Power forward'], ['C', 'Center']];
export const HANDS = [['right', 'Right'], ['left', 'Left'], ['both', 'Both']];

function frame(step, inner, { from = '' } = {}) {
  const i = SETUP_STEPS.indexOf(step);
  const prev = i > 0 ? `/app/setup/${SETUP_STEPS[i - 1]}` : (from || '/app');
  return `
  <div class="navbar"><a class="navbar__back" href="${prev}">${backChev}${i > 0 ? 'Back' : 'Home'}</a><span class="navbar__title">Set up</span><a class="navbar__act" href="/app/setup/${SETUP_STEPS[i + 1] || 'done'}" data-skip>Skip</a></div>
  <div class="steps-bar" aria-label="Step ${i + 1} of ${SETUP_STEPS.length}">${SETUP_STEPS.map((_, k) => `<span${k <= i ? ' class="on"' : ''}></span>`).join('')}</div>
  ${inner}`;
}

export function appSetupPhotoPage({ me, hasPhoto }) {
  return frame('photo', `
  <div class="step-head"><div class="kick">Step 1 of 3</div><h1>Your photo</h1>
    <p>It shows on your profile, the rosters and your share cards. A clear face shot works best.</p></div>
  <div class="photo-pick">
    <span data-photo-preview>${appAvatar({ ...me, size: 'xl' })}</span>
    <label class="btn btn--outline" style="width:auto;padding:0 18px">${icons.camera}${hasPhoto ? 'Change photo' : 'Add a photo'}
      <input type="file" accept="image/*" data-photo-input hidden></label>
    <div class="msg" data-photo-msg hidden></div>
  </div>
  <div class="step-actions"><a class="btn" href="/app/setup/details" data-photo-next>${hasPhoto ? 'Looks good' : 'Continue'}</a></div>`);
}

export function appSetupDetailsPage({ reg, positions, error = '', number = '', teamName = '' }) {
  const posSet = new Set(positions);
  const hand = reg.dominant_hand || '';
  return frame('details', `
  <div class="step-head"><div class="kick">Step 2 of 3</div><h1>Your details</h1>
    <p>What we have on file. Fix anything that's off.</p></div>
  ${error ? `<div class="msg msg--err" role="alert">${esc(error)}</div>` : ''}
  <form method="post" action="/app/setup/details" data-busy>
    <div class="sec">Player</div>
    <div class="group form-group">
      <div class="cell"><span class="cell__lbl" style="width:96px;font-weight:600">Team</span><span class="cell__t muted">${esc(teamName || 'Not assigned yet')}${number !== '' ? ` · #${esc(number)}` : ''}</span></div>
      <div class="cell field-stack"><label>Positions</label>
        <div class="chips">${POSITIONS.map(([k, l]) => `<label class="chip" title="${esc(l)}"><input type="checkbox" name="positions" value="${k}"${posSet.has(k) ? ' checked' : ''}><span>${k}</span></label>`).join('')}</div></div>
      <div class="cell"><label class="cell__lbl" for="height">Height</label><input id="height" name="height" placeholder="e.g. 5'10&quot;" maxlength="12" value="${esc(reg.height || '')}"></div>
      <div class="cell field-stack"><label>Shoots</label>
        <div class="seg">${HANDS.map(([v, l]) => `<label><input type="radio" name="dominant_hand" value="${v}"${hand === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    </div>
    <p class="foot-note">Jersey numbers are set by your team head.</p>
    <div class="sec">About you</div>
    <div class="group form-group">
      <div class="cell field-stack"><label for="motto">Motto or intro</label><textarea id="motto" name="motto" maxlength="500" placeholder="One line about your game">${esc(reg.motto || '')}</textarea></div>
      <div class="cell"><label class="cell__lbl" for="social">Instagram</label><input id="social" name="social_handle" autocapitalize="none" spellcheck="false" placeholder="@handle" maxlength="40" value="${esc(reg.social_handle || '')}"></div>
    </div>
    <div class="sec">Emergency contact · private</div>
    <div class="group form-group">
      <div class="cell"><label class="cell__lbl" for="ename">Name</label><input id="ename" name="emergency_name" autocomplete="off" maxlength="60" placeholder="Required" value="${esc(reg.emergency_name || '')}"></div>
      <div class="cell"><label class="cell__lbl" for="ephone">Phone</label><input id="ephone" name="emergency_phone" type="tel" inputmode="tel" autocomplete="off" maxlength="30" placeholder="Required" value="${esc(reg.emergency_phone || '')}"></div>
    </div>
    <p class="foot-note">Only league admins see this.</p>
    <div class="step-actions"><button class="btn" type="submit">Save and continue</button></div>
  </form>`);
}

// rows: [{ icon, title, sub, pill, href, done }] — built in server.js from the season state.
export function appSetupSeasonPage({ rows }) {
  return frame('season', `
  <div class="step-head"><div class="kick">Step 3 of 3</div><h1>Your season</h1>
    <p>Where you stand for the season. Anything still to do is coming to the app soon. Until then it's on the full site (More → Open full site).</p></div>
  <div class="group group--icons" style="margin-top:16px">${rows.map(r => `
    <div class="cell">
      <span class="ico${r.done ? '' : ' ico--amber'}">${icons[r.icon] || icons.form}</span>
      <span class="cell__t">${esc(r.title)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
      ${r.done ? `<span class="ico" style="background:none;color:var(--win)">${icons.check}</span>` : soonTag}
    </div>`).join('')}</div>
  <div class="step-actions"><a class="btn" href="/app/setup/done">Continue</a></div>`);
}

export function appSetupDonePage({ first, remaining }) {
  return `
  <div class="gate" style="padding-top:64px">
    <span style="display:inline-flex;width:72px;height:72px;border-radius:50%;background:var(--amber);color:#111;align-items:center;justify-content:center;box-shadow:0 0 0 10px rgba(245,147,50,.14)">${icons.check.replace('<svg', '<svg style="width:34px;height:34px"')}</span>
    <h1>You're set, ${esc(first)}</h1>
    <p>${remaining ? `${remaining} thing${remaining === 1 ? '' : 's'} left. They'll wait for you on Home.` : 'Everything\'s in. See you on court.'}</p>
  </div>
  <div class="pad" style="margin-top:auto;padding-top:28px"><a class="btn" href="/app">Go to Home</a></div>`;
}
