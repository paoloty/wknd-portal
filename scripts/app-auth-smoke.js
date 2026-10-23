// Quick after-deploy check of the players app's sign-in (/app). Read-only apart from one
// sign-in and sign-out of the account you give it (both show in /admin/app's activity log),
// and one deliberately wrong password for that email (counts toward its sign-in limit).
// Never requests an email code.
//
// Usage (from the project root; the password goes in an env var, not on the command line):
//   BASE=https://wkndbasketball.com EMAIL=you@example.com node scripts/app-auth-smoke.js
//   BASE=... EMAIL=... PASSWORD='…' node scripts/app-auth-smoke.js   — also signs in and out
const BASE = (process.env.BASE || 'http://localhost:4000').replace(/\/$/, '');
const { EMAIL = '', PASSWORD = '' } = process.env;

let cookie = '', failed = 0;
const go = async (path, { method = 'GET', form = null } = {}) => {
  const res = await fetch(BASE + path, {
    method, redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { status: res.status, location: res.headers.get('location') || '', type: res.headers.get('content-type') || '', text: await res.text() };
};
const check = (label, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `  (got ${got})`}`); if (!ok) failed++; };
const goesTo = (r, re) => r.status === 302 && re.test(r.location);

console.log(`Players app sign-in check against ${BASE}\n`);
let r = await go('/app/login');
check('sign-in screen loads', r.status === 200 && r.text.includes('Sign in'), r.status);
r = await go('/app/version');
check('version answers', r.status === 200 && /"ver"/.test(r.text), r.status);
r = await go('/app');
check('signed out: /app goes to sign-in', goesTo(r, /\/app\/login$/), `${r.status} ${r.location}`);
r = await go('/app/notifications/items');
check('signed out: list data is refused', r.status === 401 && r.type.includes('json'), r.status);

if (EMAIL) {
  r = await go('/app/login', { method: 'POST', form: { email: EMAIL, password: 'definitely-wrong-password' } });
  check('wrong password: same message as any failure', r.status === 400 && r.text.includes('Wrong email or password'), r.status);
}
if (EMAIL && PASSWORD) {
  cookie = '';
  r = await go('/app/login', { method: 'POST', form: { email: EMAIL, password: PASSWORD } });
  check('right password: signed in', goesTo(r, /\/app(\/setup)?$/), `${r.status} ${r.location}`);
  r = await go('/app');
  check('signed in: Home loads', r.status === 200 && r.text.includes('class="tabbar"'), r.status);
  r = await go('/app/notifications/items');
  check('signed in: list data loads', r.status === 200 && r.type.includes('json'), r.status);
  r = await go('/app/logout', { method: 'POST' });
  check('log out', goesTo(r, /\/app\/login$/), `${r.status} ${r.location}`);
  r = await go('/app');
  check('after log out: /app goes to sign-in', goesTo(r, /\/app\/login$/), `${r.status} ${r.location}`);
}
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll good.');
process.exit(failed ? 1 : 0);
