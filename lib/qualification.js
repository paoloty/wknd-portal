// Attendance rules for who counts on per-game leader boards and season award suggestions.
// One place for the thresholds so /leaders, the homepage boards, share cards and the admin
// award suggestions can't drift apart. Totals boards and single-game records have no
// games minimum: missing games already costs a player there.
//
// One rule: two thirds of the games the player's team has played, rounded up (4 of 6 — a
// player can miss two games). A share, not a fixed schedule length, so it scales through the
// season (1 after 1 team game, 2 after 2-3, 3 after 4, 4 after 5-6) and doesn't punish a team
// with a postponed game. Leader boards and award suggestions share it so the leader /leaders
// shows is the one the admin awards suggest (they disagreed on assists when boards used half).
// Every public ranking uses it: /leaders, /roast, the MVP and Best Defender races, team pages,
// /players, badges and the AI writers' "led the league" facts.
// Career boards need one full season's worth of games.

export const AWARD_SHARE = 2 / 3;
export const LEADER_SHARE = AWARD_SHARE;
export const CAREER_MIN_GP = 6;

const share = (teamGames, frac) => Math.max(1, Math.ceil((Number(teamGames) || 0) * frac - 1e-9));

export const leaderMinGames = teamGames => share(teamGames, LEADER_SHARE);
export const awardMinGames  = teamGames => share(teamGames, AWARD_SHARE);

// Rows carry min_gp (server.js buildLeaderPlayers*, portal-db getMvpCandidates); rows without
// it, like the playoff boards', only need a game played. Leader rows count games in
// games_played, race candidates in gp.
export const qualifiesPerGame = p => (p.games_played ?? p.gp ?? 0) >= Math.max(1, p.min_gp || 1);

// Rankings built from other rows (team pages, /players, badges, AI facts) pass the team's games.
export const meetsLeaderRule = (gp, teamGames) => (Number(gp) || 0) >= leaderMinGames(teamGames);
