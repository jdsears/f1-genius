/**
 * Silverstone Circuit — Corner Definitions
 *
 * length = segments. curve = intensity (negative=left, positive=right).
 *
 * CURVE MATH: curveDrift = C * CURVE_FACTOR * n*(n+1)/2
 * Screen offset = curveDrift * FOV/z
 * With CF=0.004, curve=30, 30 segs → offset at z=30 ≈ 300px. Dramatic!
 */
export const SILVERSTONE_CORNERS = [
  { name: "PIT STRAIGHT",     length: 40, curve: 0 },
  { name: "COPSE",            length: 35, curve: 30 },
  { name: "MAGGOTTS APP.",    length: 12, curve: 0 },
  { name: "MAGGOTTS",         length: 28, curve: -40 },
  { name: "BECKETTS",         length: 28, curve: 45 },
  { name: "CHAPEL",           length: 20, curve: -22 },
  { name: "HANGAR STRAIGHT",  length: 45, curve: 0 },
  { name: "STOWE",            length: 32, curve: 35 },
  { name: "VALE APPROACH",    length: 8,  curve: 0 },
  { name: "VALE",             length: 24, curve: -30 },
  { name: "CLUB",             length: 30, curve: 40 },
  { name: "HAMILTON STRAIGHT",length: 35, curve: 0 },
  { name: "ABBEY",            length: 28, curve: -32 },
  { name: "FARM",             length: 20, curve: 18 },
  { name: "BRIDGE",           length: 20, curve: -22 },
  { name: "LUFFIELD APP.",    length: 10, curve: 0 },
  { name: "LUFFIELD",         length: 35, curve: 38 },
  { name: "WOODCOTE",         length: 22, curve: -15 },
];

export const AI_CARS = [
  { name: "VER", color: "#2546FF" },
  { name: "NOR", color: "#FF8700" },
  { name: "LEC", color: "#E8002D" },
  { name: "HAM", color: "#E8002D" },
  { name: "RUS", color: "#27F4D2" },
  { name: "PIA", color: "#FF8700" },
  { name: "SAI", color: "#00D2BE" },
  { name: "ALO", color: "#006F62" },
  { name: "GAS", color: "#2293D1" },
];

export const RENDER = {
  FOV: 145,
  CAMERA_HEIGHT: 2.0,
  ROAD_HALF_WIDTH: 4.0,
  DRAW_DISTANCE: 140,
  CURVE_FACTOR: 0.004,    // 3.3x increase — road now sweeps dramatically
};

export const TUNING = {
  BASE_SPEED: 1.0,         // slower baseline — corners feel like real braking
  BOOST_SPEED: 3.0,        // 3x base speed — DRS boost feels incredible
  SLOW_SPEED: 0.2,         // wrong answer really hurts
  BOOST_DURATION: 120,
  SHAKE_DURATION: 30,
  RACE_SEGMENT_FRAMES: 380, // slightly longer racing between questions
  COUNTDOWN_INTERVAL: 900,
  ANSWER_REVEAL_TIME: 3000,
  QUESTIONS_PER_RACE: 10,
  TOTAL_CARS: 6,
};

export const GAME_STATES = {
  START: 0,
  COUNTDOWN: 1,
  RACING: 2,
  QUESTION: 3,
  FINISH: 4,
};
