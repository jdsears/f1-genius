/**
 * Silverstone Circuit — Corner Definitions
 *
 * l  = length in segments (how long the corner lasts)
 * cv = curve intensity — higher = sharper. negative = left, positive = right.
 *
 * Short corners + long straights = feels like a real circuit, not a windy road.
 */
export const SILVERSTONE_CORNERS = [
  { name: "PIT STRAIGHT",     length: 60, curve: 0 },    // long straight before Copse
  { name: "COPSE",            length: 10, curve: 80 },    // fast right-hander
  { name: "MAGGOTTS",         length: 8,  curve: -120 },  // sharp left
  { name: "BECKETTS",         length: 8,  curve: 120 },   // sharp right (S-curve!)
  { name: "CHAPEL",           length: 8,  curve: 40 },    // gentle right exit
  { name: "HANGAR STRAIGHT",  length: 70, curve: 0 },     // longest straight
  { name: "STOWE",            length: 10, curve: 90 },    // heavy braking right
  { name: "VALE",             length: 8,  curve: -60 },   // left kink
  { name: "CLUB",             length: 10, curve: 100 },   // tight right
  { name: "HAMILTON STRAIGHT",length: 55, curve: 0 },     // back straight
  { name: "ABBEY",            length: 10, curve: -70 },   // fast left
  { name: "FARM",             length: 12, curve: 30 },    // gentle right
  { name: "BRIDGE",           length: 8,  curve: -45 },   // left kink
  { name: "LUFFIELD",         length: 10, curve: 100 },   // slow tight right
  { name: "WOODCOTE",         length: 10, curve: -35 },   // slight left onto straight
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
  FOV: 150,              // focal length — slightly zoomed for onboard feel
  CAMERA_HEIGHT: 1.8,    // low driver-eye camera height
  ROAD_HALF_WIDTH: 4.2,  // wider road for realism
  DRAW_DISTANCE: 120,    // draw distance in segments
  CURVE_FACTOR: 0.0018,  // curve accumulation — higher = sharper visible corners
};

/**
 * Game Tuning Constants
 */
export const TUNING = {
  BASE_SPEED: 1.3,        // normal racing speed (segments per frame)
  BOOST_SPEED: 3.0,       // speed after correct answer
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
