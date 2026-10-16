// Starting content for the court pages (2026-10-16): an "About this court" draft and the
// "Good to know" ticks for each court that had a live page, from public sources (venue sites,
// booking listings, news) plus how WKND runs are played there. Facts only, written fresh; a
// fact the sources disagreed on was left out. Applied once by server.js (setting
// court_seeds_v1), only into empty fields, and the writeup lands as a DRAFT: nothing shows on
// the site until an admin clicks "Use this draft" on Papawis → Courts → the court.
export const COURT_SEEDS = {
  'gameville-central-park': {
    info: { features: ['multi', 'food', 'near_mrt'], directions: 'Greenfield District, where Shaw Blvd meets EDSA. A short walk from MRT-3 Shaw Boulevard; public parking is a few steps away.' },
    draft: `Gameville Central Park is the new sports hub in Greenfield District, Mandaluyong, right where Shaw Boulevard meets EDSA. Getting here is easy: it's a short walk from the MRT-3 Shaw Boulevard station, and if you're driving, public parking is just a few steps away.

Inside, it's a full sports complex. There are eight courts for basketball, volleyball and badminton, plus a sports bar and a food hall for the kwentuhan after the game. The PBA's TNT Tropang 5G use it as their practice home, so this floor has definitely seen some serious ball.

For WKND, it's one of our go-to spots for Papawis. A run here is 2 hours with 20 players and a referee calling the game, so it feels like a real game, not just a shootaround. Runs here fill up, so check the Papawis page and grab a slot early.`,
  },
  'cloverleaf-basketball-court-makati': {
    info: { setting: 'covered', features: ['free_parking', 'restrooms', 'lockers', 'near_mrt'], directions: 'East Cloverleaf, Guadalupe Nuevo, behind the Guadalupe Commercial Complex. A few minutes from MRT-3 Guadalupe.', notes: 'No aircon, so bring water and a spare shirt. Parking is free, first come, first served.' },
    draft: `Cloverleaf Basketball Court is a covered court in East Cloverleaf, Guadalupe Nuevo, Makati, tucked behind the Guadalupe Commercial Complex. It's a few minutes from the MRT-3 Guadalupe station, and parking is free on a first come, first served basis.

There's no aircon here, so expect proper Manila ball: you will sweat, and honestly, that's part of the charm. Bring water and a spare shirt. The court has a bathroom and lockers, so you can change before the game and keep your things safe while you play.

Cloverleaf has a special place in WKND history: it's where our Papawis runs started, and many of our regulars played their very first run on this court. A run here is 2 hours with 20 players. If you're new to the community, this is the classic place to start, so check the Papawis page for the next run and come play.`,
  },
  'activate-hoop-arena': {
    info: { setting: 'covered', features: ['scoreboard'], directions: '126 Pioneer St, Mandaluyong.' },
    draft: `Activate Hoops Arena is a covered, full-size basketball court on Pioneer Street in Mandaluyong. Being covered means a little rain won't cancel your game, and the full-size court gives everyone room to actually run.

The court has a scoreboard and game clock, so every possession counts and every close game gets the drama it deserves. It's the kind of setup that makes a pickup run feel like a league game, which is exactly how we like it.

WKND runs Papawis here, most often on Sundays. A run is 2 hours with 20 players, and every game has a referee, so the calls are fair and the game keeps moving. Runs here fill up, so keep an eye on the Papawis page and grab a slot when the next one drops.`,
  },
  'delta-sports-arena': {
    info: { setting: 'indoor', features: ['food'], directions: 'Yakal St, Barangay San Antonio, Makati.' },
    draft: `Delta Arena is an indoor court on Yakal Street in Barangay San Antonio, Makati. Being indoors means no rain delays and no afternoon sun in your eyes, just basketball, which makes it an easy pick any time of year.

It's more than a basketball court. Volleyball and pickleball share the building, and there's a café on site for a coffee before tip-off or a cold drink after the game. It's a good spot to bring a friend who plays a different sport, or to hang out after your run.

WKND has started bringing Papawis here. A run is 2 hours with 20 players and a referee on the floor, so the game has structure while still feeling like pickup. Follow the Papawis page so you don't miss the next run at Delta.`,
  },
  'the-upper-deck-sports-center': {
    info: { setting: 'indoor', features: ['multi', 'paid_parking', 'restrooms', 'showers', 'in_building'], directions: '6th floor, Ortigas Technopoint Building, 1 Doña Julia Vargas Ave, Ugong, Pasig. Parking is inside the compound.' },
    draft: `The Upper Deck Sports Center is on the 6th floor of the Ortigas Technopoint Building along Doña Julia Vargas Avenue, Pasig. If you work around Ortigas, it's an easy after-work or weekend game, and there's parking inside the compound.

The floor has two basketball courts, with volleyball, badminton and a gym alongside, and the same complex has a climbing wall and a diving pool. There are shower rooms and restrooms, so you can freshen up and head straight to wherever you're going next.

WKND Papawis runs here follow our usual format: 2 hours, 20 players and a referee calling the game. It's a solid indoor option on the Pasig side of the city. Watch the Papawis page for the next run here and bring a friend from the office.`,
  },
  'gameville-double-play': {
    info: { features: ['multi'], directions: '104 S. Reyes St, Villa Miguela, Barangay Pinagbuhatan, Pasig.' },
    draft: `Gameville Double Play is Gameville's Pasig venue, on S. Reyes Street in Villa Miguela, Barangay Pinagbuhatan. It's a convenient spot for anyone living or working on the eastern side of Pasig.

It's a multi-sport facility run by the same people behind Gameville Central Park and Gameville Ballpark, with courts for basketball, volleyball and badminton, plus pickleball open play on both wooden and PVC courts.

A WKND Papawis run here is 2 hours with 20 players and a referee, and it's one of our more budget-friendly runs. If you're on the Pasig side, this one's for you: check the Papawis page for the next run at Double Play and come play.`,
  },
  'whiteplains-basketball-court-quezon-city': {
    info: {},
    draft: `Whiteplains Basketball Court is in Quezon City, and it's the one court on our list so far that sits outside Makati, Mandaluyong and Pasig. For players in the northern part of Metro Manila, it's a much shorter trip than crossing the city for a game.

Details about the venue itself are still limited, so if you've played here before and know the area, tell us what newcomers should know about getting in and parking.

A WKND Papawis run here is a bit longer than usual at 2.5 hours, with 20 player slots, so there's more time on the court for everyone. Watch the Papawis page for the next run at Whiteplains and come play.`,
  },
};
