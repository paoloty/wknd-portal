// Prints the MVP reveal lock state (lib/mvp-lock.js) for the current portal season, or for
// the seasons given: node scripts/mvp-lock-state.js [season ...]
// Read-only — it never changes mvp_reveal_mode.
import { mvpLockState } from '../lib/mvp-lock.js';
import { getPortalCurrentSeason } from '../lib/portal-db.js';

const seasons = process.argv.slice(2).length ? process.argv.slice(2) : [getPortalCurrentSeason()];
for (const season of seasons) {
  const st = mvpLockState(season);
  console.log(`Season ${st.season}${st.season === String(getPortalCurrentSeason()) ? ' (current)' : ''}`);
  console.log(`  override: ${st.mode}`);
  console.log(`  auto:     ${st.auto.note}`);
  console.log(`  result:   ${st.locked ? 'LOCKED (finalists only, no order or scores)' : 'REVEALED (normal MVP race)'}`);
}
