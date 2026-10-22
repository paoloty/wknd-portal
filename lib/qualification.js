// Attendance rules for who counts on per-game leader boards and season award suggestions.
// One place for the thresholds so /leaders, the homepage boards, share cards and the admin
// award suggestions can't drift apart. Totals boards and single-game records have no
// games minimum: missing games already costs a player there.
//
// Both rules are a share of the games the player's team has played (not a fixed schedule
// length), so they scale through the season and don't punish a team with a postponed game:
//   leader boards  — half,       rounded up: 1 after 1-2 team games, 2 after 3-4, 3 of 6
//   season awards  — two thirds, rounded up: 4 of 6 (a player can miss two games)
// Career boards need one full season's worth of games.

export const LEADER_SHARE = 1 / 2;
export const AWARD_SHARE = 2 / 3;
export const CAREER_MIN_GP = 6;

const share = (teamGames, frac) => Math.max(1, Math.ceil((Number(teamGames) || 0) * frac - 1e-9));

export const leaderMinGames = teamGames => share(teamGames, LEADER_SHARE);
export const awardMinGames  = teamGames => share(teamGames, AWARD_SHARE);

// Leader rows carry min_gp (set in server.js buildLeaderPlayers*); rows without it, like the
// playoff boards', only need a game played.
export const qualifiesPerGame = p => (p.games_played || 0) >= Math.max(1, p.min_gp || 1);
