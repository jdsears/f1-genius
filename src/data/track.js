/**
 * Silverstone Circuit — Corner Definitions
 *
 * l  = length in segments (how long the corner lasts)
 * cv = curve intensity — higher = sharper. negative = left, positive = right.
 *
 * KEY INSIGHT: In pseudo-3D, curveDrift grows QUADRATICALLY with segment count
 * but only linearly with curve value. So 30 segs at curve 30 sweeps 3x more
 * than 10 segs at curve 80. Corners need 20-40+ segments to look dramatic.
 */
export const SILVERSTONE_CORNERS = [
  // Start/finish straight — long, builds anticipation
  { name: "PIT STRAIGHT",     length: 50, curve: 0 },

  // Copse — fast sweeping right-hander, one of the classic corners
  { name: "COPSE",            length: 30, curve: 35 },

  // Short straight before the esses
  { name: "MAGGOTTS APP.",    length: 15, curve: 0 },

  // Maggotts-Becketts-Chapel: the famous S-curves
  // Quick direction changes — each one shorter but punchier
  { name: "MAGGOTTS",         length: 22, curve: -45 },
  { name: "BECKETTS",         length: 22, curve: 50 },
  { name: "CHAPEL",           length: 18, curve: -20 },

  // Hangar Straight — longest straight, DRS zone, top speed
  { name: "HANGAR STRAIGHT",  length: 55, curve: 0 },

  // Stowe — heavy braking into a right-hander
  { name: "STOWE",            length: 28, curve: 40 },

  // Short link to Vale
  { name: "VALE APPROACH",    length: 10, curve: 0 },

  // Vale-Club chicane — tight complex
  { name: "VALE",             length: 20, curve: -35 },
  { name: "CLUB",             length: 25, curve: 45 },

  // Back straight (Hamilton Straight in modern layout)
  { name: "HAMILTON STRAIGHT",length: 40, curve: 0 },

  // Abbey — fast left-hander
  { name: "ABBEY",            length: 25, curve: -38 },

  // Farm-Bridge — flowing section
  { name: "FARM",             length: 18, curve: 20 },
  { name: "BRIDGE",           length: 18, curve: -25 },

  // Short straight before Luffield
  { name: "LUFFIELD APP.",    length: 12, curve: 0 },

  // Luffield — slow, tight right-hander (good overtaking spot)
  { name: "LUFFIELD",         length: 30, curve: 42 },

  // Woodcote — slight left back onto the pit straight
  { name: "WOODCOTE",         length: 20, curve: -18 },
];

/**
 * AI Competitor Cars
 * n = 3-letter abbreviation (shown on car)
 * c = team colour (hex)
 */
export const AI_CARS = [
  { name: "VER", color: "#2546FF" },  // Red Bull blue
  { name: "NOR", color: "#FF8700" },  // McLaren orange
  { name: "LEC", color: "#E8002D" },  // Ferrari red
  { name: "RUS", color: "#27F4D2" },  // Mercedes teal
  { name: "ALO", color: "#006F62" },  // Aston Martin green
];

/**
 * Rendering / Projection Constants
 * These control the OutRun-style pseudo-3D perspective.
 */
export const RENDER = {
  FOV: 160,              // focal length — higher = more zoomed, better distance perception
  CAMERA_HEIGHT: 2.2,    // driver-eye camera height — slightly raised for better road view
  ROAD_HALF_WIDTH: 4.0,  // road width in world units
  DRAW_DISTANCE: 150,    // how far ahead we render (more = see corners approaching)
  CURVE_FACTOR: 0.0012,  // curve accumulation — tuned for new longer corners
};

/**
 * Game Tuning Constants
 */
export const TUNING = {
  BASE_SPEED: 1.4,        // normal racing speed (segments per frame)
  BOOST_SPEED: 3.2,       // speed after correct answer
  SLOW_SPEED: 0.3,        // speed after wrong answer
  BOOST_DURATION: 140,    // frames of boost effect
  SHAKE_DURATION: 25,     // frames of screen shake
  RACE_SEGMENT_FRAMES: 350, // frames of racing between each question (~6 secs)
  COUNTDOWN_INTERVAL: 900,  // ms between countdown lights
  ANSWER_REVEAL_TIME: 3200, // ms to show answer before resuming
  QUESTIONS_PER_RACE: 10,
  TOTAL_CARS: 6,          // player + 5 AI
};

/**
 * Game States
 */
export const GAME_STATES = {
  START: 0,
  COUNTDOWN: 1,
  RACING: 2,
  QUESTION: 3,
  FINISH: 4,
};
