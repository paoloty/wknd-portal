import { classifyPositionGroup } from './player-analysis.js';

// Accepts either a plain cm number ("178", "160.02") — the format every real record in
// player_details actually uses — or a feet'inches string ("6'2\"") in case that's ever
// entered by hand. Returns null (not 0) for anything unparseable, or outside a plausible
// human range, so callers can tell "no usable data" apart from "very short" — real data
// has at least one player_details row with height "627", presumably a fat-fingered entry,
// which would otherwise dominate the whole balancing pass as a false outlier.
export function parseHeightCm(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 100 && n <= 230) return n;
  const m = String(raw).match(/(\d+)\s*'\s*(\d+)/);
  if (m) {
    const cm = (Number(m[1]) * 12 + Number(m[2])) * 2.54;
    return cm >= 100 && cm <= 230 ? cm : null;
  }
  return null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// roster: rows from getPapawisConfirmedForTeams() — { id, guest_name, positions (JSON
// string), height }. Returns [{ id, team }] for every row, team is 'light'|'dark'.
//
// Real players are split by position group (perimeter/big, via the same
// classifyPositionGroup used by the coach-analysis feature) so both sides end up with a
// similar guard/big mix. Within each group, sorted tallest-to-shortest and assigned one
// at a time to whichever side currently has fewer players from that group — ties broken
// by lower total height. Headcount balance is the primary goal (so one group never
// lopsidedly stacks a side even when height data is missing or dirty for several
// players), with height only deciding ties, which is still enough to keep both sides'
// height sums close over a normal sorted distribution. Guests carry no player_details of
// their own, so they're shuffled and dealt out afterward to whichever side has fewer
// members overall, purely to even out final headcount.
export function buildBalancedTeams(roster) {
  const real   = roster.filter(r => !r.guest_name);
  const guests = roster.filter(r => r.guest_name);

  const known = real.map(r => parseHeightCm(r.height)).filter(h => h != null);
  const avgHeight = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 175;

  const groups = { perimeter: [], big: [] };
  for (const r of real) {
    let positions = [];
    try { positions = JSON.parse(r.positions || '[]'); } catch { /* leave empty */ }
    const height = parseHeightCm(r.height) ?? avgHeight;
    groups[classifyPositionGroup(positions)].push({ id: r.id, height });
  }

  const assignments = [];
  const totals = { light: 0, dark: 0 };
  const counts = { light: 0, dark: 0 };

  for (const group of Object.values(groups)) {
    group.sort((a, b) => b.height - a.height);
    const groupCounts = { light: 0, dark: 0 };
    for (const player of group) {
      const side = groupCounts.light !== groupCounts.dark
        ? (groupCounts.light < groupCounts.dark ? 'light' : 'dark')
        : (totals.light <= totals.dark ? 'light' : 'dark');
      assignments.push({ id: player.id, team: side });
      totals[side] += player.height;
      counts[side]++;
      groupCounts[side]++;
    }
  }

  for (const guest of shuffle(guests)) {
    const side = counts.light <= counts.dark ? 'light' : 'dark';
    assignments.push({ id: guest.id, team: side });
    counts[side]++;
  }

  return assignments;
}
