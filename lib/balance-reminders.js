// Manual balance reminders from the admin ledger (/admin/ledger: the "Email balance reminder"
// bulk action and the button in a player's drawer). Nothing sends on its own.
//
// "Overdue" = owes money and hasn't reached out in OVERDUE_DAYS: no payment of any status
// (a pending one counts, they sent it in) dated within that window, or, if they never paid,
// their first charge is older than that. Overdue players get the suspension warning with a
// deadline WARNING_GRACE_DAYS out. Nothing bans anyone automatically: once
// the deadline passes with no payment since the warning, the ledger
// flags them "Deadline passed" and an admin bans them by hand (players.banned_at).
//
// Not gated by selectBroadcastRecipients: a debtor who stopped logging in is exactly who this
// is for. Only the email itself has to be usable (well-formed, not bounced).
import { getAllBalances, getRegistrationByPlayerId, getEmailHealth, getPlayerById, createNotification, isWellFormedEmail } from './portal-db.js';
import { sendMail, balanceReminderEmail } from './mailer.js';
import { manilaTodayStr } from '../views/utils.js';

const LIVE_URL = (process.env.LIVE_URL || 'https://wkndbasketball.com').replace(/\/$/, '');
export const OVERDUE_DAYS = 90;
export const WARNING_GRACE_DAYS = 7;
const EPS = 0.005;

const daysBetween = (fromYmd, toYmd) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86400000);
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayLabel = ymd => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const manilaYmd = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);

// b: a getAllBalances() row; reminder: its getLastBalanceReminders() entry.
// → { owes, balance, quietDays, overdue, lastPaid, warnedAt, deadline, deadlinePassed }
// deadlinePassed: warned, the deadline is behind us, they still owe and no payment is dated
// on or after the warning day.
export function balanceStanding(b, reminder = null, today = manilaTodayStr()) {
  const balance = Number(b?.balance) || 0;
  const since = b?.last_payment_date || b?.first_charge_date || '';
  const quietDays = since ? Math.max(0, daysBetween(String(since).slice(0, 10), today)) : 0;
  const owes = balance > EPS;
  const warnedAt = reminder?.warnedAt || 0;
  const warnedDay = warnedAt ? manilaYmd(warnedAt) : '';
  const deadline = warnedDay ? addDays(warnedDay, WARNING_GRACE_DAYS) : '';
  const actedSince = !!warnedDay && String(b?.last_payment_date || '') >= warnedDay;
  return {
    owes, balance, quietDays, overdue: owes && quietDays >= OVERDUE_DAYS, lastPaid: b?.last_payment_date || '',
    warnedAt, deadline, deadlinePassed: owes && !!deadline && today > deadline && !actedSince,
  };
}

export async function sendBalanceReminder(playerId) {
  const b = getAllBalances().find(r => r.player_id === playerId);
  const st = balanceStanding(b);
  if (!st.owes) return { error: 'no_balance' };
  const player = getPlayerById(playerId);
  const email = String(getRegistrationByPlayerId(playerId)?.email || '').trim().toLowerCase();
  if (!isWellFormedEmail(email)) return { error: 'no_email' };
  if (getEmailHealth(email).bounced) return { error: 'bounced' };

  const today = manilaTodayStr();
  const amount = Math.round(st.balance * 100) / 100;
  await sendMail({
    to: email, ref: playerId,
    ...balanceReminderEmail({
      name: player?.name || '', amount, url: `${LIVE_URL}/settle-balance`,
      lastPaidLabel: st.lastPaid ? dayLabel(String(st.lastPaid).slice(0, 10)) : '',
      warning: st.overdue ? { days: st.quietDays, deadlineLabel: dayLabel(addDays(today, WARNING_GRACE_DAYS)) } : null,
    }),
  });
  createNotification({
    playerId, type: 'balance_reminder',
    title: st.overdue ? `Action needed: your balance is ₱${amount.toLocaleString()}` : `Reminder: your balance is ₱${amount.toLocaleString()}`,
    body: st.overdue ? `Settle it or reach out by ${dayLabel(addDays(today, WARNING_GRACE_DAYS))} to avoid a suspension.` : 'Tap to settle all or part of it.',
    link: '/settle-balance',
  });
  return { ok: true, overdue: st.overdue };
}
