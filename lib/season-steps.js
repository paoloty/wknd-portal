// Where a season is, for the step bar on the Season pages (views/admin/layout.js). No database in
// here: the route hands over the settings. The first step not done yet is the next one.
//   target: signup_target_season. open: sign-ups are open. draft: season_draft_status ('', 'draft',
//   'started'). fee: the season fee. entered / confirmed: sign-ups so far.
export function seasonStepState({ target = '', open = false, draft = '', fee = 0, entered = 0, confirmed = 0 } = {}) {
  const started = draft === 'started';
  const done = {
    setup: !!target && (Number(fee) > 0 || started),
    signups: started || (!open && entered > 0),
    teams: started,
    start: started,
  };
  const text = {
    setup: !target ? 'Not started' : done.setup ? `Season ${target}` : 'Season fee not set',
    signups: open ? `Open · ${entered} in` : entered ? `Closed · ${entered} in` : 'Not open',
    teams: started ? 'Locked' : draft === 'draft' ? `In progress · ${confirmed} confirmed` : `${confirmed} confirmed`,
    start: started ? 'Started' : 'Not yet',
  };
  const next = ['setup', 'signups', 'teams', 'start'].find(k => !done[k]) || '';
  return Object.fromEntries(['setup', 'signups', 'teams', 'start'].map(k => [k, { text: text[k], done: done[k], next: k === next }]));
}
