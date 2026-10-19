// The fixed test set. Every case drives a real admin route on the eval copy.
// Game ids are the portal's (data/portal.db games.id); player ids likewise.
const G = {
  s4_sep13_white_blue:   'game_sched_1788876656556', // WHITE 87-79 BLUE
  s4_sep13_black_maroon: 'game_sched_1788877136472', // MAROON 74-69 BLACK
  s4_sep20_blue_black:   'game_sched_1789594056173', // BLACK 80-62 BLUE
  s4_sep20_maroon_white: 'game_sched_1789594074082', // WHITE 102-82 MAROON (team record?)
  s4_sep27_maroon_blue:  'game_sched_1790233678418', // BLUE 95-80 MAROON
  s4_sep27_white_black:  'game_sched_1790233694864', // WHITE 79-75 BLACK
  s4_oct04_maroon_black: 'game_sched_1790808025029', // MAROON 77-71 BLACK
  s4_oct04_white_blue:   'game_sched_1790808046398', // WHITE 99-90 BLUE
  s4_oct11_white_maroon: 'game_sched_1791328003709', // MAROON 96-81 WHITE
  s4_oct11_black_blue:   'game_sched_1791328027862', // BLACK 95-90 BLUE
  s4_oct18_maroon_blue:  'game_sched_1791835578307', // BLUE 103-73 MAROON — Salenga 36, Sarmiento 10 threes, co-POTG
  s3_po_white_maroon:    'game_sched_1784552778891', // S3 playoff WHITE 83-80 MAROON
  s3_finals_g3:          'game_sched_1786968572755', // S3 Finals G3 WHITE 78-72 BLUE (champions)
  s4_oct25_playoff:      'game_sched_1792405956944', // upcoming: MAROON vs BLACK (storyline)
};
const P = {
  salenga:   '4b2ccd26-2da5-42e2-a419-c29a9a82ddfc',
  sarmiento: 'aacfa7ee-d059-4c00-a0b6-de7ae776e43a',
};

// kind: recap | potg | section | home | story. tier: 'core' runs in every round; 'full' only
// with --full (the baseline and the final run).
export const CASES = [
  // The hardest game first: recap with the co-POTG, both spotlights.
  { id: 'recap:oct18', kind: 'recap', game: G.s4_oct18_maroon_blue, body: { player_id: P.salenga, co_player_id: P.sarmiento }, tier: 'core' },
  { id: 'potg:oct18:salenga', kind: 'potg', game: G.s4_oct18_maroon_blue, body: { player_id: P.salenga, shared_with: P.sarmiento }, tier: 'core' },
  { id: 'potg:oct18:sarmiento', kind: 'potg', game: G.s4_oct18_maroon_blue, body: { player_id: P.sarmiento, shared_with: P.salenga }, tier: 'core' },
  { id: 'recap:oct11:black-blue', kind: 'recap', game: G.s4_oct11_black_blue, tier: 'core' },
  { id: 'potg:oct11:black-blue', kind: 'potg', game: G.s4_oct11_black_blue, tier: 'core' },
  { id: 'recap:oct11:white-maroon', kind: 'recap', game: G.s4_oct11_white_maroon, tier: 'core' },
  { id: 'potg:oct11:white-maroon', kind: 'potg', game: G.s4_oct11_white_maroon, tier: 'core' },
  { id: 'recap:s3:finals-g3', kind: 'recap', game: G.s3_finals_g3, tier: 'core' },
  { id: 'potg:s3:finals-g3', kind: 'potg', game: G.s3_finals_g3, tier: 'core' },
  { id: 'recap:sep20:maroon-white', kind: 'recap', game: G.s4_sep20_maroon_white, tier: 'full' },
  { id: 'potg:sep20:maroon-white', kind: 'potg', game: G.s4_sep20_maroon_white, tier: 'full' },
  { id: 'recap:oct04:maroon-black', kind: 'recap', game: G.s4_oct04_maroon_black, tier: 'full' },
  { id: 'potg:oct04:maroon-black', kind: 'potg', game: G.s4_oct04_maroon_black, tier: 'full' },
  { id: 'recap:oct04:white-blue', kind: 'recap', game: G.s4_oct04_white_blue, tier: 'full' },
  { id: 'potg:oct04:white-blue', kind: 'potg', game: G.s4_oct04_white_blue, tier: 'full' },
  { id: 'recap:sep27:maroon-blue', kind: 'recap', game: G.s4_sep27_maroon_blue, tier: 'full' },
  { id: 'potg:sep27:maroon-blue', kind: 'potg', game: G.s4_sep27_maroon_blue, tier: 'full' },
  { id: 'recap:sep27:white-black', kind: 'recap', game: G.s4_sep27_white_black, tier: 'full' },
  { id: 'potg:sep27:white-black', kind: 'potg', game: G.s4_sep27_white_black, tier: 'full' },
  { id: 'recap:sep20:blue-black', kind: 'recap', game: G.s4_sep20_blue_black, tier: 'full' },
  { id: 'potg:sep20:blue-black', kind: 'potg', game: G.s4_sep20_blue_black, tier: 'full' },
  { id: 'recap:sep13:white-blue', kind: 'recap', game: G.s4_sep13_white_blue, tier: 'full' },
  { id: 'potg:sep13:white-blue', kind: 'potg', game: G.s4_sep13_white_blue, tier: 'full' },
  { id: 'recap:sep13:black-maroon', kind: 'recap', game: G.s4_sep13_black_maroon, tier: 'full' },
  { id: 'potg:sep13:black-maroon', kind: 'potg', game: G.s4_sep13_black_maroon, tier: 'full' },
  { id: 'recap:s3:po-white-maroon', kind: 'recap', game: G.s3_po_white_maroon, tier: 'full' },
  { id: 'potg:s3:po-white-maroon', kind: 'potg', game: G.s3_po_white_maroon, tier: 'full' },
  // Game page sections.
  { id: 'section:game_perf:oct18', kind: 'section', block: `game_perf:${G.s4_oct18_maroon_blue}`, tier: 'core' },
  { id: 'section:game_stats:oct18', kind: 'section', block: `game_stats:${G.s4_oct18_maroon_blue}`, tier: 'core' },
  { id: 'section:game_perf:oct11', kind: 'section', block: `game_perf:${G.s4_oct11_black_blue}`, tier: 'full' },
  { id: 'section:game_stats:oct11', kind: 'section', block: `game_stats:${G.s4_oct11_black_blue}`, tier: 'full' },
  { id: 'section:game_perf:s3-finals', kind: 'section', block: `game_perf:${G.s3_finals_g3}`, tier: 'full' },
  { id: 'section:game_stats:s3-finals', kind: 'section', block: `game_stats:${G.s3_finals_g3}`, tier: 'full' },
  // Homepage blocks.
  { id: 'home:headlines', kind: 'home', block: 'headlines', tier: 'core' },
  { id: 'home:standings', kind: 'home', block: 'standings', tier: 'core' },
  { id: 'home:leaders', kind: 'home', block: 'leaders', tier: 'full' },
  // /standings and /playoffs sections.
  { id: 'section:standings_playoffs:4', kind: 'section', block: 'standings_playoffs:4', tier: 'core' },
  { id: 'section:standings_h2h:4', kind: 'section', block: 'standings_h2h:4', tier: 'full' },
  { id: 'section:standings_road:4', kind: 'section', block: 'standings_road:4', tier: 'full' },
  { id: 'section:standings_stats:4', kind: 'section', block: 'standings_stats:4', tier: 'full' },
  { id: 'section:playoffs_bracket:3', kind: 'section', block: 'playoffs_bracket:3', tier: 'full' },
  { id: 'section:playoffs_games:3', kind: 'section', block: 'playoffs_games:3', tier: 'core' },
  { id: 'section:playoffs_bracket:4', kind: 'section', block: 'playoffs_bracket:4', tier: 'full' },
  // Matchup storyline for the next game.
  { id: 'story:oct25', kind: 'story', game: G.s4_oct25_playoff, tier: 'core' },
];
