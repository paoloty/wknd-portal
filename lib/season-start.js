// Starting a season charges real money and can't be undone, so these are what the Review and start
// page and the start route agree on. No database in here: the route hands over the rows.

// A confirmed player with no account is skipped by the charging step, and so is a total of zero or
// less. What's left is what the ledger will actually get.
export const billedAmount = r => (r.playerId && r.total > 0 ? r.total : 0);
export const billedTotal = rows => rows.reduce((sum, r) => sum + billedAmount(r), 0);

// Why the start route must say no: '' when it can go ahead. Nobody confirmed matters as much as a
// double charge: the same run takes every player off their old team.
export function startRefusal({ season = '', target = '', draft = '', confirmed = 0 } = {}) {
  if (!season) return 'No season to start.';
  if (draft === 'started') return 'This season has already been started. Charges were already applied.';
  if (String(season) !== String(target)) return `Season ${season} isn't the one being set up (Season ${target}).`;
  if (!confirmed) return 'No confirmed players yet.';
  return '';
}

// What's worth looking at before pressing Start. None of these stop it. rows: charge review rows
// with teamName and teamIsLive (a live team has the same name).
export function startChecks({ rows = [], fee = 0 } = {}) {
  return {
    noFee: !(Number(fee) > 0),
    noAccount: rows.filter(r => !r.playerId),
    noTeam: rows.filter(r => !r.teamName),
    teamNotLive: rows.filter(r => r.teamName && !r.teamIsLive),
  };
}

// The email a sign-up got when the season started, from its latest email_log row. canResend: only
// when something went wrong. Without a record, only if this season's emails were logged at all,
// since a season started before the log existed would otherwise offer everyone a second email.
export function startEmailState(row, { hasEmail = true, anyLogged = false } = {}) {
  if (!hasEmail) return { label: 'No email', tone: 'gray', canResend: false };
  if (!row) return { label: anyLogged ? 'Not sent' : 'No record', tone: anyLogged ? 'red' : 'gray', canResend: anyLogged };
  if (row.status === 'failed') return { label: 'Failed', tone: 'red', canResend: true };
  if (row.bounced_at) return { label: 'Bounced', tone: 'red', canResend: true };
  if (row.opened_at) return { label: 'Opened', tone: 'green', canResend: false };
  return { label: 'Sent', tone: 'green', canResend: false };
}
