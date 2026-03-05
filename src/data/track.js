/**
 * Silverstone Circuit — Corner Definitions
 * 
 * l  = length in segments (how long the corner lasts)
 * cv = curve intensity (-45 to +45, negative = left, positive = right)
 * 
 * These values control how dramatically the road curves.
 * The curve is applied with a sine envelope so entry/exit is smooth.
 */
export const SILVERSTONE_CORNERS = [
  { name: "PIT STRAIGHT",    length: 40, curve: 0 },
  { name: "COPSE",           length: 25, curve: 42 },
  { name: "MAGGOTTS",        length: 16, curve: -65 },
  { name: "BECKETTS",        length: 16, curve: 65 },
  { name: "CHAPEL",          length: 20, curve: 25 },
  { name: "HANGAR STRAIGHT", length: 50, curve: 0 },
  { name: "STOWE",           length: 22, curve: 48 },
  { name: "VALE",            length: 15, curve: -38 },
  { name: "CLUB",            length: 22, curve: 55 },
  { name: "HAMILTON STRAIGHT",length: 45, curve: 0 },
  { name: "ABBEY",           length: 20, curve: -35 },
  { name: "FARM",            length: 28, curve: 18 },
  { name: "BRIDGE",          length: 15, curve: -25 },
  { name: "LUFFIELD",        length: 22, curve: 55 },
  { name: "WOODCOTE",        length: 20, curve: -22 },
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
  DRAW_DISTANCE: 140,    // more segments for longer view distance
  CURVE_FACTOR: 0.0008,  // curve accumulation tuned for wider road
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
