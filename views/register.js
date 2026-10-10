import { escHtml } from './layout.js';
import { playerAvatar } from './utils.js';
import { authShell, playerCard } from './auth-shell.js';

// /register — "Join the community". Three steps on one page (Who are you → Your game →
// Sign off) next to a live "your player card" that fills in as you type, over the same
// blurred-profile backdrop as the sign-in page. Mockups: claude.ai/artifact/Tg9DRY8WKmEwXsdmNFV1he.
// Joining the community is separate from Season Signup, so nothing here mentions a season.
// Field names are unchanged from the old accordion, so POST /register's validation and
// insertRegistration() didn't need to change. The client checks each step before moving on;
// the server re-checks everything and, on an error, re-renders with the right step open.

const POSITIONS = [
  { id: 'PG', desc: 'running the group chat' },
  { id: 'SG', desc: 'shoots their shot. everywhere.' },
  { id: 'SF', desc: 'versatile. very versatile.' },
  { id: 'PF', desc: 'muscles &amp; issues' },
  { id: 'C',  desc: 'tall and in the way' },
];
const HANDS = [['right', 'Right'], ['left', 'Left'], ['both', 'Both']];
const VIBES = [['male', 'Male (allegedly)'], ['female', 'Female (wrong group chat)'], ['sigma', 'Sigma Male 🐺'], ['fabulous', 'Fabulous 💅'], ['classified', 'Classified (ask my bestie)']];
const EXPERIENCE = [['beginner', 'New but make it fashion'], ['intermediate', "I've watched enough NBA"], ['advanced', 'Built different. Trust.']];

// Server error text → the step it belongs to (messages live in POST /register).
function errorStepFor(error) {
  if (!error) return 1;
  if (/position|height|weight|hand/i.test(error)) return 2;
  if (/crossover|agree|waiver|signature|fine print/i.test(error)) return 3;
  return 1;
}

const initialsOf = (first, last) => `${String(first || '').trim().charAt(0)}${String(last || '').trim().charAt(0)}`.toUpperCase();

function crowd(hypeAvatars, playerCount) {
  if (!playerCount) return '';
  const faces = [...hypeAvatars].sort(() => Math.random() - 0.5).slice(0, 4)
    .map(p => playerAvatar(p.id, p.name, p.color, { className: 'au-face' })).join('');
  return `<div class="au-crowd">${faces ? `<span class="au-crowd__faces" aria-hidden="true">${faces}</span>` : ''}<span><b>${playerCount}</b> players already in</span></div>`;
}

// success: the "application sent" screen. card: what they entered, for the card on it.
export function registerPage({ error = null, success = false, prefill = {}, hypeAvatars = [], ref = '', playerCount = 0, card = null } = {}) {
  const topLink = { href: '/login', html: 'Already a member? <b>Sign in →</b>' };

  if (success) {
    const c = card || {};
    return authShell({
      split: true,
      backdrop: 'glow',
      topLink: { href: '/', html: 'Back to site →' },
      body: `<section class="au-card au-card--form" aria-labelledby="reg-done-h">
        <div>
          <div class="au-k au-k--amber">APPLICATION SENT</div>
          <h1 class="au-h1" id="reg-done-h" style="font-size:32px">You better werk — you're in the queue!</h1>
          <p class="au-sub" style="font-size:15px;color:#c9cfda">We got it${c.first ? `, ${escHtml(c.first)}` : ''}. Here's what happens next.</p>
        </div>
        <ol class="au-tl">
          <li style="display:contents"><div><div class="au-tl__dot is-done" aria-hidden="true">✓</div><div class="au-tl__line is-done"></div></div><div class="au-tl__body"><b>Application sent</b><span>Just now</span></div></li>
          <li style="display:contents"><div><div class="au-tl__dot is-next" aria-hidden="true">2</div><div class="au-tl__line"></div></div><div class="au-tl__body"><b>An admin reviews it</b><span>Usually within a few days</span></div></li>
          <li style="display:contents"><div><div class="au-tl__dot" aria-hidden="true">3</div><div class="au-tl__line"></div></div><div class="au-tl__body"><b>You get an email to set your password</b><span>${c.email ? `Sent to ${escHtml(c.email)} — ` : ''}check spam just in case</span></div></li>
          <li style="display:contents"><div><div class="au-tl__dot" aria-hidden="true">4</div></div><div class="au-tl__body" style="padding-bottom:0"><b>Set your password and snap your game face</b><span>Then you're in — your profile goes live</span></div></li>
        </ol>
        <div style="display:flex;flex-wrap:wrap;gap:10px;padding-top:18px;border-top:1px solid var(--border)">
          <a href="/games" class="au-btn au-btn--amber">See this weekend's games</a>
          <a href="/" class="au-btn au-btn--ghost">Back to home</a>
        </div>
      </section>
      <aside class="au-aside" aria-label="Your player card">
        <div class="au-k">YOUR PLAYER CARD</div>
        ${playerCard({ name: c.name, initials: c.initials, chips: c.positions ? [{ text: c.positions }] : [], intro: c.intro, status: { text: 'Pending approval', kind: 'amber' } })}
        <p class="au-note" style="text-align:left">Goes live on the Players page once you're approved.</p>
      </aside>`,
    });
  }

  const v = name => escHtml(prefill[name] || '');
  const sel = (name, val) => (prefill[name] === val ? ' selected' : '');
  const picked = new Set(Array.isArray(prefill.positions) ? prefill.positions : prefill.positions ? [prefill.positions] : []);
  const refValue = ref || prefill.ref || '';
  const errorStep = errorStepFor(error);
  const field = (id, label, input, hint = '') => `<div class="au-field" data-field="${id}"><label class="au-lbl" for="${id}">${label}${hint ? ` <small>${hint}</small>` : ''}</label>${input}</div>`;

  const step1 = `
    <div class="au-g2">
      ${field('first_name', 'First name', `<input class="au-input" id="first_name" name="first_name" type="text" autocomplete="given-name" value="${v('first_name')}" placeholder="Juan" required data-card>`, 'your slay name')}
      ${field('last_name', 'Last name', `<input class="au-input" id="last_name" name="last_name" type="text" autocomplete="family-name" value="${v('last_name')}" placeholder="dela Cruz" required data-card>`)}
    </div>
    ${field('email', 'Email', `<input class="au-input" id="email" name="email" type="email" autocomplete="email" value="${v('email')}" placeholder="juan@example.com" required>`, "you'll sign in with this")}
    <div class="au-g2">
      ${field('phone', 'Mobile', `<input class="au-input" id="phone" name="phone" type="tel" autocomplete="tel" value="${v('phone')}" placeholder="+63 917 123 4567" required>`)}
      ${field('birthday', 'Birthday', `<input class="au-input" id="birthday" name="birthday" type="date" value="${v('birthday')}" required>`, '18+ to play')}
    </div>`;

  const step2 = `
    <fieldset class="au-fieldset" data-field="positions">
      <legend class="au-lbl">Where do you play <small>pick all that fit</small></legend>
      <div class="au-pos">
        ${POSITIONS.map(p => `<label class="au-pos__opt"><input type="checkbox" name="positions" value="${p.id}"${picked.has(p.id) ? ' checked' : ''} data-card><b>${p.id}</b><span>${p.desc}</span></label>`).join('')}
      </div>
    </fieldset>
    <div class="au-g3">
      ${field('height', 'Height', `<input class="au-input" id="height" name="height" type="number" inputmode="numeric" min="100" max="250" value="${v('height')}" placeholder="175" required data-card>`, 'cm')}
      ${field('weight', 'Weight', `<input class="au-input" id="weight" name="weight" type="number" inputmode="numeric" min="30" max="200" value="${v('weight')}" placeholder="75" required>`, 'kg')}
      <fieldset class="au-fieldset au-field" data-field="dominant_hand">
        <legend class="au-lbl">Working hand</legend>
        <div class="au-seg">${HANDS.map(([val, lbl]) => `<label><input type="radio" name="dominant_hand" value="${val}"${prefill.dominant_hand === val ? ' checked' : ''} data-card>${lbl}</label>`).join('')}</div>
      </fieldset>
    </div>
    <div class="au-g2">
      ${field('gender', 'Vibe', `<select class="au-input" id="gender" name="gender" required><option value="">—</option>${VIBES.map(([val, lbl]) => `<option value="${val}"${sel('gender', val)}>${lbl}</option>`).join('')}</select>`)}
      ${field('experience', 'Experience', `<select class="au-input" id="experience" name="experience" data-card><option value="">— be honest —</option>${EXPERIENCE.map(([val, lbl]) => `<option value="${val}"${sel('experience', val)}>${lbl}</option>`).join('')}</select>`)}
    </div>
    ${field('social_handle', 'Insta or FB', `<input class="au-input" id="social_handle" name="social_handle" type="text" value="${v('social_handle')}" placeholder="@yourhandle or fb.com/you">`, 'so we can hype you')}
    ${field('motto', 'Your intro', `<textarea class="au-input" id="motto" name="motto" rows="3" maxlength="500" placeholder="Your origin story — this shows on your player profile." data-card>${escHtml(prefill.motto || '')}</textarea>`, 'shows on your profile')}
    <details class="au-more"${prefill.emergency_name || prefill.emergency_phone || prefill.referred_by ? ' open' : ''}>
      <summary>Emergency contact &amp; who invited you <small>optional</small></summary>
      <div class="au-more__body">
        <div class="au-g2">
          ${field('emergency_name', 'Emergency contact', `<input class="au-input" id="emergency_name" name="emergency_name" type="text" value="${v('emergency_name')}" placeholder="Full name">`, 'who to call if cooked')}
          ${field('emergency_phone', 'Their number', `<input class="au-input" id="emergency_phone" name="emergency_phone" type="tel" value="${v('emergency_phone')}" placeholder="+63 917 000 0000">`)}
        </div>
        ${field('referred_by', 'Who invited you', `<input class="au-input" id="referred_by" name="referred_by" type="text" value="${v('referred_by')}" placeholder="We'll thank them (or shade them) privately">`)}
      </div>
    </details>`;

  const step3 = `
    <div class="au-rev" id="reg-review">
      <div class="au-rev__row"><span>Name</span><span><span data-rev="name">—</span><button type="button" class="au-rev__edit" data-goto="1">Edit</button></span></div>
      <div class="au-rev__row"><span>Email</span><span><span data-rev="email">—</span><button type="button" class="au-rev__edit" data-goto="1">Edit</button></span></div>
      <div class="au-rev__row"><span>Plays</span><span><span data-rev="plays">—</span><button type="button" class="au-rev__edit" data-goto="2">Edit</button></span></div>
    </div>
    <label class="au-check" data-field="agree"><input type="checkbox" name="agree"><span>I swear on my crossover that everything above is accurate, and I know an admin approves my application before I can ball.</span></label>
    <div class="au-field">
      <span class="au-lbl">Liability waiver <small>5 short points</small></span>
      <details class="au-waiver">
        <summary><b>Assumption of risk</b> · <b>Release of liability</b> · <b>Medical fitness</b> · <b>Photo/video</b> · <b>Code of conduct</b><br><span class="au-waiver__more">Read the full waiver ▾</span></summary>
        <p><strong>1. Assumption of Risk.</strong> Basketball is a physical contact sport that carries inherent risks of injury, including but not limited to sprains, fractures, collisions, and other physical harm. By participating in WKND Basketball League ("the League") activities &mdash; games, practices, and Papawis pickup sessions &mdash; I voluntarily assume all such risks, foreseeable or not.</p>
        <p><strong>2. Release of Liability.</strong> To the fullest extent permitted by law, I release and hold harmless the League, its organizers, coaches, and fellow participants from claims, damages, or liability arising from my participation, except where caused by gross negligence or willful misconduct.</p>
        <p><strong>3. Medical Fitness.</strong> I confirm I am physically fit to participate and am not aware of any medical condition that would make participation unsafe. I am responsible for my own health insurance and any medical costs arising from participation.</p>
        <p><strong>4. Photo/Video.</strong> Games and events may be photographed or recorded for the League's social media and promotional use. By participating, I consent to this unless I notify admin otherwise in writing.</p>
        <p><strong>5. Code of Conduct.</strong> I agree to follow the League's conduct policies and understand that violations may result in fines or removal from the League, per its published rules.</p>
        <p>This waiver applies to all League activities for as long as I remain an active member. I'll be asked to reconfirm it each season during Season Signup.</p>
        <p class="au-waiver__legal">This is a template, not a substitute for real legal advice specific to your jurisdiction.</p>
      </details>
    </div>
    <label class="au-check" data-field="waiver_agree"><input type="checkbox" name="waiver_agree"><span>I've read and agree to the Liability Waiver.</span></label>
    ${field('waiver_signature', 'Signature', `<input class="au-input au-sign" id="waiver_signature" name="waiver_signature" type="text" value="${v('waiver_signature')}" placeholder="Juan Miguel dela Cruz" autocomplete="name">`, 'type your full legal name')}`;

  const STEPS = [
    { n: 1, label: 'Who are you', title: 'Who are you?', sub: 'Three quick steps. An admin approves you, then we email your password link.', body: step1, next: "Yes, that's me →" },
    { n: 2, label: 'Your game', title: 'Your game', sub: 'Helps the team heads build even teams at the draft.', body: step2, next: 'Almost there →' },
    { n: 3, label: 'Sign off', title: 'Sign off', sub: "Check it's all you, then sign the waiver.", body: step3, next: 'Send my application' },
  ];

  const cardInitials = initialsOf(prefill.first_name, prefill.last_name);
  const cardName = [prefill.first_name, prefill.last_name].filter(Boolean).join(' ');
  const strip = `<div class="au-strip" aria-hidden="true">
      <div class="au-pc__av" id="regs-av"><span id="regs-ini">${escHtml(cardInitials || '··')}</span></div>
      <div style="min-width:0"><div class="au-pc__name" id="regs-name">${escHtml(cardName || 'Your name')}</div><div class="au-pc__chips" id="regs-chips"><span class="au-chip au-chip--ghost">Positions</span></div></div>
      <span class="au-k au-strip__k">YOUR CARD</span>
    </div>`;

  return authShell({
    split: true,
    topLink,
    before: strip,
    body: `<form class="au-card au-card--form" id="reg-form" method="POST" action="/register" novalidate>
      ${refValue ? `<input type="hidden" name="ref" value="${escHtml(refValue)}">` : ''}
      <div class="au-k au-k--amber">JOIN THE COMMUNITY</div>
      ${error ? `<div class="au-error" role="alert" id="reg-error">${escHtml(error)}</div>` : ''}
      ${STEPS.map(s => `<section class="reg-step${s.n === errorStep ? '' : ' hidden'}" data-step="${s.n}" aria-labelledby="reg-h${s.n}">
        <div style="display:flex;flex-direction:column;gap:20px">
          <div>
            <h1 class="au-h1" id="reg-h${s.n}">${s.title}</h1>
            <p class="au-sub">${s.sub}</p>
          </div>
          <ol class="au-steps" aria-label="Step ${s.n} of 3">${STEPS.map(t => `<li class="${t.n < s.n ? 'is-done' : t.n === s.n ? 'is-on' : ''}">${t.n} · ${t.label}${t.n < s.n ? ' ✓' : ''}</li>`).join('')}</ol>
          ${s.body}
          <div class="au-row">
            ${s.n > 1 ? `<button type="button" class="au-back" data-goto="${s.n - 1}">← Back</button>` : '<span></span>'}
            <button type="${s.n === 3 ? 'submit' : 'button'}" class="au-btn au-btn--amber"${s.n < 3 ? ` data-next="${s.n + 1}"` : ''}>${s.next}</button>
          </div>
        </div>
      </section>`).join('')}
    </form>
    <aside class="au-aside" aria-label="Your player card preview">
      <div class="au-k">YOUR PLAYER CARD · LIVE PREVIEW</div>
      ${playerCard({ name: cardName, initials: cardInitials, chips: [{ text: '#—', kind: 'ghost' }, { text: 'Positions', kind: 'ghost' }, { text: 'Team at the draft', kind: 'ghost' }], intro: prefill.motto || '', stats: true, ids: 'regc' })}
      <p class="au-note" style="text-align:left">Fills in as you go. Add a photo after you're approved.</p>
      ${crowd(hypeAvatars, playerCount)}
    </aside>
<script>
(function () {
  var form = document.getElementById('reg-form');
  if (!form) return;
  var steps = Array.prototype.slice.call(form.querySelectorAll('.reg-step'));
  var $ = function (id) { return document.getElementById(id); };
  var HANDS = { right: 'Right-handed', left: 'Left-handed', both: 'Both hands' };
  var EXP = ${JSON.stringify(Object.fromEntries(EXPERIENCE))};

  function val(name) { var el = form.elements[name]; return el ? String(el.value || '').trim() : ''; }
  function positions() { return Array.prototype.map.call(form.querySelectorAll('input[name="positions"]:checked'), function (b) { return b.value; }); }
  function hand() { var el = form.querySelector('input[name="dominant_hand"]:checked'); return el ? el.value : ''; }

  // ── live player card (and the phone strip) ──
  function chipsHtml(pos) {
    var ghost = function (t) { return '<span class="au-chip au-chip--ghost">' + t + '</span>'; };
    return ghost('#—') + (pos.length ? '<span class="au-chip au-chip--amber">' + pos.join(' · ') + '</span>' : ghost('Positions')) + ghost('Team at the draft');
  }
  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
  function updateCard() {
    var first = val('first_name'), last = val('last_name'), pos = positions();
    var name = (first + ' ' + last).trim();
    var ini = ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase() || '··';
    setText('regc-name', name || 'Your name'); setText('regs-name', name || 'Your name');
    setText('regc-ini', ini); setText('regs-ini', ini);
    var chips = $('regc-chips'); if (chips) chips.innerHTML = chipsHtml(pos);
    var strip = $('regs-chips'); if (strip) strip.innerHTML = pos.length ? '<span class="au-chip au-chip--amber">' + pos.join(' · ') + '</span>' : '<span class="au-chip au-chip--ghost">Positions</span>';
    var intro = $('regc-intro'), motto = val('motto');
    if (intro) { intro.textContent = motto ? '\\u201C' + motto + '\\u201D' : 'Your intro shows here.'; intro.classList.toggle('is-empty', !motto); }
    var meta = [val('height') ? val('height') + ' cm' : '', HANDS[hand()] || '', EXP[val('experience')] || ''].filter(Boolean).join(' · ');
    setText('regc-meta', meta);
    // review list on step 3
    var r =function (k, t) { var el = form.querySelector('[data-rev="' + k + '"]'); if (el) el.textContent = t || '—'; };
    r('name', name); r('email', val('email'));
    r('plays', [pos.join(' · '), val('height') ? val('height') + ' cm' : '', (HANDS[hand()] || '').replace('-handed', '')].filter(Boolean).join(' · '));
  }
  // Fixing a field clears its error straight away.
  function clearOne(e) {
    var box = e.target.closest('[data-field]');
    if (!box) return;
    box.querySelectorAll('.au-field__err').forEach(function (x) { x.remove(); });
    box.querySelectorAll('.is-invalid').forEach(function (x) { x.classList.remove('is-invalid'); });
  }
  form.addEventListener('input', function (e) { clearOne(e); updateCard(); });
  form.addEventListener('change', function (e) { clearOne(e); updateCard(); });
  updateCard();

  // ── per-step checks (the server re-checks everything) ──
  function fieldBox(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function clearErrors(step) {
    step.querySelectorAll('.au-field__err').forEach(function (e) { e.remove(); });
    step.querySelectorAll('.is-invalid').forEach(function (e) { e.classList.remove('is-invalid'); });
  }
  function flag(name, msg) {
    var box = fieldBox(name);
    if (!box) return;
    var input = box.querySelector('.au-input');
    if (input) input.classList.add('is-invalid');
    var p = document.createElement('div'); p.className = 'au-field__err'; p.textContent = msg; box.appendChild(p);
  }
  function check(n) {
    var step = steps[n - 1]; clearErrors(step);
    var bad = [];
    function need(name, msg) { if (!val(name)) { bad.push(name); flag(name, msg); } }
    if (n === 1) {
      need('first_name', 'Your first name, please.');
      need('last_name', 'And your last name.');
      if (!val('email')) { bad.push('email'); flag('email', "We'll need this to send your password link."); }
      else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val('email'))) { bad.push('email'); flag('email', "That email doesn't look right."); }
      need('phone', 'Your mobile number, please.');
      if (!val('birthday')) { bad.push('birthday'); flag('birthday', 'Your birthday, please.'); }
      else {
        var d = new Date(val('birthday')), a18 = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
        if (new Date() < a18) { bad.push('birthday'); flag('birthday', "You need to be 18 or older to play."); }
      }
    } else if (n === 2) {
      if (!positions().length) { bad.push('positions'); flag('positions', 'Pick at least one position.'); }
      need('height', 'Height in cm.');
      need('weight', 'Weight in kg.');
      if (!hand()) { bad.push('dominant_hand'); flag('dominant_hand', 'Pick one.'); }
      need('gender', 'Pick your vibe.');
    } else if (n === 3) {
      if (!form.elements.agree.checked) { bad.push('agree'); flag('agree', 'Tick this to continue.'); }
      if (!form.elements.waiver_agree.checked) { bad.push('waiver_agree'); flag('waiver_agree', 'Tick this to agree to the waiver.'); }
      need('waiver_signature', 'Type your full legal name to sign.');
    }
    if (bad.length) {
      var first = fieldBox(bad[0]);
      var focusable = first && first.querySelector('input, select, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !bad.length;
  }

  function go(n) {
    steps.forEach(function (s) { s.classList.toggle('hidden', s.getAttribute('data-step') !== String(n)); });
    var err = $('reg-error'); if (err) err.remove();
    updateCard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var h = $('reg-h' + n); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  form.addEventListener('click', function (e) {
    var next = e.target.closest('[data-next]');
    if (next) { var to = Number(next.getAttribute('data-next')); if (check(to - 1)) go(to); return; }
    var back = e.target.closest('[data-goto]');
    if (back) go(Number(back.getAttribute('data-goto')));
  });
  // Enter in a text field moves to the next step instead of submitting early.
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    var step = e.target.closest('.reg-step');
    if (!step) return;
    var n = Number(step.getAttribute('data-step'));
    if (n < 3) { e.preventDefault(); if (check(n)) go(n + 1); }
  });
  form.addEventListener('submit', function (e) {
    for (var n = 1; n <= 3; n++) { if (!check(n)) { e.preventDefault(); go(n); check(n); return; } }
  });
})();
</script>`,
  });
}
