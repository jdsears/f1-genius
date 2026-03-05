/**
 * F1 History Question Bank
 * Each question maps to content on the physical A1 History Board.
 * 
 * Format: { era, question, options[], correctIndex, fact }
 * 
 * 10 random questions are selected per race.
 * To add questions: just append to this array.
 */
const QUESTIONS = [
  // ═══ PIONEER AGE (1950–1960) ═══
  { era: "Pioneer Age", question: "How many titles did Fangio win?", options: ["3", "4", "5", "7"], correctIndex: 2, fact: "5 titles with 4 teams — unbroken for 46 years!" },
  { era: "Pioneer Age", question: "Where was the first F1 race?", options: ["Monaco", "Monza", "Silverstone", "Spa"], correctIndex: 2, fact: "Silverstone, 13 May 1950." },
  { era: "Pioneer Age", question: "Cooper 1958 — what was new?", options: ["Disc brakes", "Engine behind driver", "Slick tyres", "Wings"], correctIndex: 1, fact: "Engine behind the driver. Everyone copied." },
  { era: "Pioneer Age", question: "Why is Moss 'greatest never to win'?", options: ["Banned", "Defended rival, lost title", "Retired", "Only 2 seasons"], correctIndex: 1, fact: "Defended Hawthorn — costing himself the title." },
  { era: "Pioneer Age", question: "1950s drivers wore…?", options: ["Fireproof suits", "Leather helmets & goggles", "Carbon helmets", "Nothing"], correctIndex: 1, fact: "Leather helmets, goggles, straw bales." },
  { era: "Pioneer Age", question: "Deaths in 1950s championship?", options: ["3", "7", "13", "21"], correctIndex: 2, fact: "13 killed in one decade." },

  // ═══ LEGENDS ERA (1961–1976) ═══
  { era: "Legends Era", question: "Clark wins from 10 races, 1963?", options: ["4", "5", "7", "All 10"], correctIndex: 2, fact: "7 of 10!" },
  { era: "Legends Era", question: "Stewart campaigned for…?", options: ["Speed", "More races", "Safety", "Prizes"], correctIndex: 2, fact: "Saved countless lives." },
  { era: "Legends Era", question: "Lauda at Nürburgring 1976?", options: ["Won", "Fiery crash", "Lap record", "Retired"], correctIndex: 1, fact: "Burns. Returned 42 days later." },
  { era: "Legends Era", question: "Hunt vs Lauda 1976 ending?", options: ["Lauda won", "Hunt won in rain", "Tied", "Shared"], correctIndex: 1, fact: "Hunt won in rain-soaked Japan." },
  { era: "Legends Era", question: "Only posthumous champion?", options: ["Clark", "Rindt", "McLaren", "Villeneuve"], correctIndex: 1, fact: "Rindt killed Monza 1970." },
  { era: "Legends Era", question: "New on cars in 1968?", options: ["Wings", "Turbos", "Carbon", "Paddle-shift"], correctIndex: 0, fact: "Wings for downforce!" },

  // ═══ TURBO ERA (1977–1988) ═══
  { era: "Turbo Era", question: "McLaren wins 1988 (of 16)?", options: ["10", "12", "15", "All 16"], correctIndex: 2, fact: "15 of 16 with Senna & Prost." },
  { era: "Turbo Era", question: "Ground effect did what?", options: ["More power", "Sucked car down", "Less weight", "Better brakes"], correctIndex: 1, fact: "Vacuum = massive grip." },
  { era: "Turbo Era", question: "1980s turbo power?", options: ["500 bhp", "800 bhp", "1,000 bhp", "1,500 bhp"], correctIndex: 3, fact: "1,500 bhp! Banned 1988." },
  { era: "Turbo Era", question: "Lauda beat Prost 1984 by?", options: ["½ point", "1 point", "3 points", "10 points"], correctIndex: 0, fact: "HALF A POINT!" },
  { era: "Turbo Era", question: "MP4/1 (1981) first…?", options: ["Turbo", "Carbon chassis", "Wings", "Hybrid"], correctIndex: 1, fact: "Carbon fibre. Every car since." },
  { era: "Turbo Era", question: "Lead changes Dijon '79?", options: ["2", "3", "5", "7"], correctIndex: 2, fact: "Five at 170 mph!" },

  // ═══ TECH REVOLUTION (1989–2000) ═══
  { era: "Tech Revolution", question: "Imola 1994?", options: ["Pile-up", "Senna & Ratzenberger killed", "Flood", "Fire"], correctIndex: 1, fact: "Darkest weekend. Safety revolution." },
  { era: "Tech Revolution", question: "Years no death after '94?", options: ["5", "10", "15", "20"], correctIndex: 3, fact: "20 years!" },
  { era: "Tech Revolution", question: "Senna Suzuka 1990?", options: ["Retired", "Crashed into Prost", "Team orders", "Blocked pits"], correctIndex: 1, fact: "Deliberate crash." },
  { era: "Tech Revolution", question: "Ferrari 1989 innovation?", options: ["Active susp.", "Carbon brakes", "Paddle-shift", "DRS"], correctIndex: 2, fact: "Fingertip gears." },
  { era: "Tech Revolution", question: "Häkkinen Spa 2000?", options: ["Braking", "Either side of lapped car", "Pit lane", "Final lap"], correctIndex: 1, fact: "Either side at 190 mph." },

  // ═══ SCHUMACHER & RED BULL (2001–2013) ═══
  { era: "Schumacher Era", question: "Schumacher Ferrari titles?", options: ["3", "4", "5", "6"], correctIndex: 2, fact: "FIVE in a row." },
  { era: "Schumacher Era", question: "Hamilton 2008 win?", options: ["Every race", "Final corner, 1pt", "20pts", "Rival DQ'd"], correctIndex: 1, fact: "Final corner, final lap!" },
  { era: "Schumacher Era", question: "Brawn GP 2009?", options: ["Big budget", "Bankrupt team won", "4 champions", "Electric"], correctIndex: 1, fact: "Honda for £1. Won both titles!" },
  { era: "Schumacher Era", question: "Schumacher 2004 wins?", options: ["8", "10", "13", "15"], correctIndex: 2, fact: "13 of 18!" },
  { era: "Schumacher Era", question: "Vettel streak 2013?", options: ["5", "7", "9", "11"], correctIndex: 2, fact: "9 in a row!" },

  // ═══ HYBRID ERA (2014–Present) ═══
  { era: "Hybrid Era", question: "Halo (2018)?", options: ["Engine", "Titanium cockpit guard", "Aero wing", "Pit tool"], correctIndex: 1, fact: "Saved multiple lives." },
  { era: "Hybrid Era", question: "Verstappen 2023 wins?", options: ["12", "15", "19", "22"], correctIndex: 2, fact: "19 of 22!" },
  { era: "Hybrid Era", question: "Mercedes streak from 2014?", options: ["5", "6", "7", "8"], correctIndex: 3, fact: "8 in a row!" },
  { era: "Hybrid Era", question: "Grosjean Bahrain 2020?", options: ["Won", "Exploded, walked out", "Set record", "Retired"], correctIndex: 1, fact: "Fireball. Halo saved him." },
  { era: "Hybrid Era", question: "Netflix F1 series?", options: ["Grand Tour", "Top Gear", "Drive to Survive", "Speed Kings"], correctIndex: 2, fact: "Doubled US viewership." },
  { era: "Hybrid Era", question: "Abu Dhabi 2021?", options: ["Hamilton won", "SC restart, Verstappen won", "They crashed", "Draw"], correctIndex: 1, fact: "Most debated finish." },
  { era: "Hybrid Era", question: "Hamilton wins exceed?", options: ["50", "75", "100", "120"], correctIndex: 2, fact: "100+ — triple digits." },
  { era: "Hybrid Era", question: "Zhou Silverstone 2022?", options: ["Seatbelt", "Halo", "Gravel", "Safety car"], correctIndex: 1, fact: "150 mph upside-down. Halo." },
];

export default QUESTIONS;
