// Which season Papawis money belongs to (Paolo, 2026-11-05): the latest season that has started
// on the day of the run. So a run after a season's last game still counts for that season until
// the next one starts: the next season may not exist yet when the run is played. No database
// in here: lib/portal-db.js and scripts/fix-papawis-seasons.js share it.

export const isPapawisCategory = c => ['papawis', 'papawis deposit'].includes(String(c || '').trim().toLowerCase());

// starts: [{ season, start: 'YYYY-MM-DD' }], the first game of each season. '' before the first.
export function seasonOnDate(date, starts) {
  let best = null;
  for (const s of starts) {
    if (!s.start || s.start > date) continue;
    if (!best || s.start > best.start) best = s;
  }
  return best ? String(best.season) : '';
}
