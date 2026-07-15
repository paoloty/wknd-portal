import { escHtml } from './layout.js';

const POSITIONS = [
  { id: 'PG', desc: 'running the group chat' },
  { id: 'SG', desc: 'shoots their shot. everywhere.' },
  { id: 'SF', desc: 'versatile. very versatile. 👀' },
  { id: 'PF', desc: 'muscles & issues' },
  { id: 'C',  desc: 'tall and in the way' },
];

export function registerPage({ error = null, success = false, prefill = {} } = {}) {
  if (success) {
    return `<div class="login-page">
  <div class="reg-box">
    <div class="login-brand">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <div class="login-form" style="text-align:center;padding:56px 32px">
      <div style="font-size:48px;margin-bottom:18px">🏀</div>
      <h2 style="font-size:1.3rem;font-weight:800;color:var(--text);margin:0 0 10px">You're in the queue!</h2>
      <p style="color:var(--text-muted);font-size:13px;line-height:1.75;margin:0 0 32px">
        Your application has been submitted.<br>An admin will review it and reach out once you're approved.
      </p>
      <a href="/" class="login-submit" style="display:block;text-decoration:none;text-align:center">Back to Home</a>
    </div>
  </div>
</div>`;
  }

  const v   = name => escHtml(prefill[name] || '');
  const sel = (name, val) => prefill[name] === val ? 'selected' : '';

  // If server-side validation error, figure out which step the error belongs to
  // so we can restore the right step on re-render. Default to step 1.
  const errorStep = (() => {
    if (!error) return 1;
    if (/position|height|weight|hand/i.test(error)) return 2;
    if (/agree|emergency|experience|bio/i.test(error)) return 3;
    return 1;
  })();

  return `<div class="login-page" style="align-items:flex-start;padding:48px 16px 80px">
  <div class="reg-box">

    <div class="login-brand" style="margin-bottom:4px">
      <div class="login-brand__badge">W</div>
      <span class="login-brand__name">WKND Basketball</span>
    </div>
    <p class="login-brand__sub">Open to all genders, all skill levels, and at least two people per team who think they're the main character.* We promise good runs, real community, and one group chat that will absolutely ruin your sleep schedule.** <span style="font-size:11px;opacity:.5">(*you know who you are) (**we will also judge your form — lovingly)</span></p>

    <!-- Stepper -->
    <div class="reg-stepper">
      <div class="reg-step is-active" data-step="1">
        <span class="reg-step__num">1</span>
        <span class="reg-step__label">Who Are You</span>
      </div>
      <div class="reg-step-line"></div>
      <div class="reg-step" data-step="2">
        <span class="reg-step__num">2</span>
        <span class="reg-step__label">Body Check</span>
      </div>
      <div class="reg-step-line"></div>
      <div class="reg-step" data-step="3">
        <span class="reg-step__num">3</span>
        <span class="reg-step__label">Final Boss</span>
      </div>
    </div>

    ${error ? `<div class="login-error">${escHtml(error)}</div>` : ''}

    <form id="reg-form" method="POST" action="/register" novalidate>

      <!-- Step 1: Who Are You -->
      <div class="login-form reg-panel" data-panel="1">
        <div class="reg-grid-2">
          <div class="login-field">
            <label for="first_name">First Slay Name <span class="reg-req">*</span></label>
            <input id="first_name" class="login-field__input" type="text" name="first_name" value="${v('first_name')}" autocomplete="given-name" placeholder="Juan" data-required="1" data-step="1">
          </div>
          <div class="login-field">
            <label for="last_name">Government Name (the sequel) <span class="reg-req">*</span></label>
            <input id="last_name" class="login-field__input" type="text" name="last_name" value="${v('last_name')}" autocomplete="family-name" placeholder="dela Cruz" data-required="1" data-step="1">
          </div>
        </div>
        <div class="login-field">
          <label for="email">Slide Into Our DMs <span class="reg-req">*</span></label>
          <input id="email" class="login-field__input" type="email" name="email" value="${v('email')}" autocomplete="email" placeholder="juan@example.com" data-required="1" data-step="1">
        </div>
        <div class="reg-grid-2">
          <div class="login-field">
            <label for="phone">Your Digits 👀 <span class="reg-req">*</span></label>
            <input id="phone" class="login-field__input" type="tel" name="phone" value="${v('phone')}" autocomplete="tel" placeholder="+63 917 123 4567" data-required="1" data-step="1">
          </div>
          <div class="login-field" style="margin-bottom:0">
            <label for="birthday">Day You Entered the Chat <span class="reg-req">*</span></label>
            <input id="birthday" class="login-field__input" type="date" name="birthday" value="${v('birthday')}" data-required="1" data-step="1">
          </div>
        </div>
        <div class="reg-nav reg-nav--single">
          <button type="button" class="reg-nav__next" data-next="2">Yes, that's me →</button>
        </div>
      </div>

      <!-- Step 2: Body Check -->
      <div class="login-form reg-panel" data-panel="2" style="display:none">
        <div class="login-field">
          <label>Where Do You Like to Play <span style="opacity:.5;font-size:11px">(on the court, focus)</span> <span class="reg-req">*</span></label>
          <div class="reg-pos-chips">
            ${POSITIONS.map(pos => `<label class="reg-pos-chip">
              <input type="checkbox" name="positions" value="${pos.id}">
              <span class="reg-pos-chip__abbr">${pos.id}</span>
              <span class="reg-pos-chip__divider"></span>
              <span class="reg-pos-chip__desc">${pos.desc}</span>
            </label>`).join('')}
          </div>
        </div>
        <div class="reg-grid-2">
          <div class="login-field" style="margin-bottom:0">
            <label for="height">Height — Be Honest (cm) <span class="reg-req">*</span></label>
            <input id="height" class="login-field__input" type="number" name="height" value="${v('height')}" placeholder="175" min="100" max="250" data-required="1" data-step="2">
          </div>
          <div class="login-field" style="margin-bottom:0">
            <label for="weight">Current Form (kg) <span class="reg-req">*</span></label>
            <input id="weight" class="login-field__input" type="number" name="weight" value="${v('weight')}" placeholder="75" min="30" max="200" data-required="1" data-step="2">
          </div>
          <div class="login-field" style="margin-bottom:0">
            <label for="dominant_hand">Working Hand 💅 <span class="reg-req">*</span></label>
            <select id="dominant_hand" class="login-field__input" name="dominant_hand" data-required="1" data-step="2">
              <option value="">—</option>
              <option value="right" ${sel('dominant_hand','right')}>Right (allegedly)</option>
              <option value="left"  ${sel('dominant_hand','left')}>Left (dangerous)</option>
              <option value="both"  ${sel('dominant_hand','both')}>Both (show-off)</option>
            </select>
          </div>
          <div class="login-field" style="margin-bottom:0">
            <label for="gender">Vibe <span class="reg-req">*</span></label>
            <select id="gender" class="login-field__input" name="gender" data-required="1" data-step="2">
              <option value="">—</option>
              <option value="male"        ${sel('gender','male')}>Male (allegedly)</option>
              <option value="female"      ${sel('gender','female')}>Female (wrong group chat)</option>
              <option value="sigma"       ${sel('gender','sigma')}>Sigma Male 🐺</option>
              <option value="fabulous"    ${sel('gender','fabulous')}>Fabolous 💅</option>
              <option value="classified"  ${sel('gender','classified')}>Classified (ask my bestie)</option>
            </select>
          </div>
        </div>
        <div class="reg-nav reg-nav--single">
          <button type="button" class="reg-nav__next" data-next="3">This body slays →</button>
          <button type="button" class="reg-nav__back reg-nav__back--link" data-back="1">← wait, I lied</button>
        </div>
      </div>

      <!-- Step 3: Final Boss -->
      <div class="login-form reg-panel" data-panel="3" style="display:none">
        <div class="reg-grid-2">
          <div class="login-field">
            <label for="experience">Basketball Resume</label>
            <select id="experience" class="login-field__input" name="experience">
              <option value="">— be honest —</option>
              <option value="beginner"     ${sel('experience','beginner')}>New but make it fashion</option>
              <option value="intermediate" ${sel('experience','intermediate')}>I've watched enough NBA</option>
              <option value="advanced"     ${sel('experience','advanced')}>Built different. Trust.</option>
            </select>
          </div>
          <div class="login-field">
            <label for="referred_by">Who Dragged You Here</label>
            <input id="referred_by" class="login-field__input" type="text" name="referred_by" value="${v('referred_by')}" placeholder="We love them for it">
          </div>
        </div>
        <div class="reg-grid-2">
          <div class="login-field">
            <label for="emergency_name">Who to Call When You Get Cooked</label>
            <input id="emergency_name" class="login-field__input" type="text" name="emergency_name" value="${v('emergency_name')}" placeholder="Full name">
          </div>
          <div class="login-field">
            <label for="emergency_phone">Their Digits (someone who picks up)</label>
            <input id="emergency_phone" class="login-field__input" type="tel" name="emergency_phone" value="${v('emergency_phone')}" placeholder="+63 917 000 0000">
          </div>
        </div>
        <div class="login-field" style="margin-bottom:20px">
          <label for="motto">Your Villain Arc Intro</label>
          <textarea id="motto" class="login-field__input" name="motto" rows="3" placeholder="Your origin story — this shows on your player profile.">${escHtml(prefill.motto || '')}</textarea>
        </div>
        <label class="login-check" style="margin-bottom:20px">
          <input type="checkbox" name="agree" data-required="1" data-step="3">
          <span>I swear on my crossover that everything above is accurate, and I understand my application needs admin approval before I can ball. 🏀</span>
        </label>
        <div class="reg-nav reg-nav--single">
          <button type="submit" class="login-submit">SEND IT BESTIE 💅</button>
          <button type="button" class="reg-nav__back reg-nav__back--link" data-back="2">← actually—</button>
        </div>
      </div>

    </form>
  </div>
</div>

<style>
.reg-box { width: 100%; max-width: 640px; }

/* Stepper */
.reg-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 24px;
}
.reg-step {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.reg-step__num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  transition: background .2s, border-color .2s, color .2s;
}
.reg-step__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: .03em;
  transition: color .2s;
}
.reg-step.is-active .reg-step__num {
  background: var(--amber);
  border-color: var(--amber);
  color: #0a0e16;
}
.reg-step.is-active .reg-step__label { color: var(--text); }
.reg-step.is-done .reg-step__num {
  background: var(--border);
  border-color: var(--border);
  color: var(--text-muted);
}
.reg-step-line {
  flex: 1;
  height: 1px;
  background: var(--border);
  margin: 0 10px;
}

.reg-req { color: var(--amber); font-style: normal; }

/* Grids */
.reg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 0; }
.reg-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

/* Input overrides for select/textarea */
.login-field__input {
  display: block;
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text);
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
  box-sizing: border-box;
  resize: vertical;
}
.login-field__input:focus { border-color: var(--amber); }
.login-field__input::placeholder { color: var(--text-muted); opacity: .5; }
.login-field__input option { background: #0d1424; }

/* Position chips */
.reg-pos-chips { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; margin-bottom: 16px; }
.reg-pos-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 14px;
  cursor: pointer;
  color: var(--text-muted);
  transition: border-color .15s, color .15s;
  user-select: none;
}
.reg-pos-chip input { display: none; }
.reg-pos-chip__abbr {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .06em;
  color: var(--text);
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
  transition: color .15s;
}
.reg-pos-chip__divider {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 12px;
  flex-shrink: 0;
}
.reg-pos-chip__desc { font-size: 11px; font-weight: 400; line-height: 1.3; text-transform: none; }
.reg-pos-chip:has(input:checked) { border-color: var(--amber); }
.reg-pos-chip:has(input:checked) .reg-pos-chip__abbr { color: var(--amber); }
.reg-pos-chip:has(input:checked) .reg-pos-chip__divider { background: var(--amber); opacity: .3; }

/* Nav row */
.reg-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  gap: 10px;
}
.reg-nav--single {
  flex-direction: column;
  align-items: stretch;
}
.reg-nav__back {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 18px;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.reg-nav__back:hover { border-color: var(--text-muted); color: var(--text); }
.reg-nav__back--link {
  border: none;
  background: none;
  text-align: center;
  font-size: 12px;
  padding: 6px;
  opacity: .6;
}
.reg-nav__back--link:hover { opacity: 1; border: none; }
.reg-nav__next {
  background: var(--amber);
  border: none;
  border-radius: 8px;
  color: #0a0e16;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 22px;
  cursor: pointer;
  letter-spacing: .04em;
  transition: opacity .15s;
}
.reg-nav--single .reg-nav__next { width: 100%; padding: 12px; font-size: 14px; }
.reg-nav__next:hover { opacity: .85; }
.login-submit { display: block; width: 100%; }

/* Panel: sections hidden by JS; fallback for no-JS shows all */
.reg-panel { margin-bottom: 12px; }

/* Inline error */
.reg-field-error {
  font-size: 11px;
  color: #f87171;
  margin-top: 5px;
}

@media (max-width: 600px) {
  .reg-grid-2, .reg-grid-3 { grid-template-columns: 1fr; }
  .login-form { padding: 20px; }
  .reg-step__label { display: none; }
}
</style>

<script>
(function () {
  var form    = document.getElementById('reg-form');
  var panels  = Array.from(form.querySelectorAll('.reg-panel'));
  var steps   = Array.from(document.querySelectorAll('.reg-step'));
  var current = ${errorStep};

  function showPanel(n) {
    current = n;
    panels.forEach(function (p) {
      p.style.display = parseInt(p.dataset.panel, 10) === n ? '' : 'none';
    });
    steps.forEach(function (s, i) {
      var sn = i + 1;
      s.classList.toggle('is-active', sn === n);
      s.classList.toggle('is-done', sn < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateStep(n) {
    var fields = form.querySelectorAll('[data-step="' + n + '"][data-required]');
    var ok = true;
    fields.forEach(function (f) {
      var err = f.parentElement.querySelector('.reg-field-error');
      if (!err) {
        err = document.createElement('div');
        err.className = 'reg-field-error';
        f.parentElement.appendChild(err);
      }
      var val = f.type === 'checkbox' ? f.checked : f.value.trim();
      if (!val) {
        err.textContent = 'Bestie, we need this one.';
        f.classList.add('reg-invalid');
        ok = false;
      } else {
        err.textContent = '';
        f.classList.remove('reg-invalid');
      }
    });
    // position check on step 2
    if (n === 2) {
      var boxes = form.querySelectorAll('[name="positions"]');
      var any   = Array.from(boxes).some(function (b) { return b.checked; });
      var posErr = form.querySelector('.reg-pos-err');
      if (!posErr) {
        posErr = document.createElement('div');
        posErr.className = 'reg-field-error reg-pos-err';
        form.querySelector('.reg-pos-chips').after(posErr);
      }
      posErr.textContent = any ? '' : "Pick at least one position. You can't just stand there.";
      if (!any) ok = false;
    }
    return ok;
  }

  form.querySelectorAll('.reg-nav__next').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = parseInt(btn.dataset.next, 10);
      var curr = next - 1;
      if (validateStep(curr)) showPanel(next);
    });
  });

  form.querySelectorAll('.reg-nav__back').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showPanel(parseInt(btn.dataset.back, 10));
    });
  });

  form.addEventListener('submit', function (e) {
    if (!validateStep(3)) e.preventDefault();
  });

  // clear inline errors on input
  form.addEventListener('input', function (e) {
    var err = e.target.parentElement && e.target.parentElement.querySelector('.reg-field-error');
    if (err) err.textContent = '';
    e.target.classList.remove('reg-invalid');
  });

  showPanel(current);
})();
</script>`;
}
