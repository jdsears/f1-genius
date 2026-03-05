# CLAUDE.md — F1 Race to Victory

## Project Overview

An educational F1 history browser game for schools. Students (ages 12–16) and parents play together at a physical display alongside an A1 history board covering 75 years of Formula One.

The game is a **cockpit-view pseudo-3D racing game** around Silverstone, where players answer 10 multiple-choice F1 history questions between racing segments. Correct answers = speed boost + gain a position. Wrong answers = slow down + drop a position. **Only 10/10 correct wins the race (P1).**

## Architecture

```
f1-race/
├── index.html              # Entry point with mobile meta tags
├── package.json            # Vite + React
├── vite.config.js          # Dev/preview server config
├── Dockerfile              # Railway deployment
├── src/
│   ├── main.jsx            # React mount
│   ├── App.jsx             # Main game component (canvas renderer + UI)
│   └── data/
│       ├── questions.js    # Question bank (36+ questions, 10 selected per race)
│       └── track.js        # Silverstone corners, AI cars, rendering & tuning constants
```

## How the Rendering Works

The game uses a **classic OutRun-style pseudo-3D renderer** (NOT WebGL/3D — pure 2D canvas):

1. **Track segments**: Each "segment" is one slice of road. The full track is Silverstone's 15 corners repeated 8x (~3,200 segments).
2. **Projection**: For segment at depth `z`: `scale = FOV / z`. This gives perspective — near segments are wide, far segments are tiny.
3. **Curves**: Each segment has a `curve` value. These accumulate: `curveDrift += curveRate; curveRate += segment.curve * CURVE_FACTOR`. This makes the road visually sweep left/right.
4. **Drawing**: Segments are drawn **back-to-front** as filled trapezoids (road), with kerbs, grass stripes, edge lines, trees, and AI cars drawn at the correct Z depth.

### Key rendering constants (in `src/data/track.js` → `RENDER`):
- `FOV: 130` — focal length. Higher = more zoomed in.
- `CAMERA_HEIGHT: 3.2` — height above road in world units. Higher = see further.
- `ROAD_HALF_WIDTH: 3.8` — road width in world units.
- `CURVE_FACTOR: 0.0006` — how aggressively curves accumulate. Higher = sharper corners.
- `DRAW_DISTANCE: 120` — segments rendered ahead. Higher = see further but slower.

### Key tuning constants (`TUNING`):
- `BASE_SPEED: 1` — normal speed in segments/frame
- `BOOST_SPEED: 2.5` — speed after correct answer
- `RACE_SEGMENT_FRAMES: 350` — frames of racing between questions (~6 sec at 60fps)

## Game Mechanics

- **Position = 1 + wrong answers.** 0 wrong = P1, 1 wrong = P2, up to P6.
- **Only P1 (10/10) is a race win.** This encourages studying the history board.
- **AI cars** are positioned by `segmentsAhead` (how many road segments in front of player). Cars ahead of player rank are positive (visible ahead), cars behind are negative (shown in mirrors).
- **Overtaking**: When a correct answer moves you up, the car being passed is brought close (`targetSegAhead = 4`) and player moves to opposite lane, creating a visible pass.
- **Questions**: 10 randomly selected from 36+ per race. All answers are on the physical A1 history board.

## Known Issues & Priority Improvements

### HIGH PRIORITY — Visual/Feel
1. **Corners need to feel stronger.** The curve values in `SILVERSTONE_CORNERS` (track.js) may need increasing, and `CURVE_FACTOR` may need tuning. Maggotts/Becketts should feel like dramatic S-curves. Test by watching the road — it should visibly sweep left and right.
2. **Speed perception.** If it feels slow, increase `BASE_SPEED` and `BOOST_SPEED` in track.js. The grass stripe alternation (`alt = Math.floor(segmentIndex / 4) % 2`) drives speed feel — try `/3` for faster flicker.
3. **AI cars may not be visible enough.** They're drawn when `Math.round(car.segmentsAhead) === far.drawOrder`. If they're not appearing, check that `segmentsAhead` values are within `DRAW_DISTANCE` (120). Debug by logging `game.aiCars.map(c => c.segmentsAhead)`.
4. **Overtaking animation.** When correct, the overtaken car should visibly approach, then pass by on one side. If not working, check the `handleAnswer` function — `carToPass.targetSegAhead = 4` should bring it close, and `game.playerLaneTarget` should move player to the opposite side.

### MEDIUM PRIORITY — Gameplay
5. **Sound effects.** Add engine sound (tone.js or simple oscillator), gear change clicks, correct/wrong sounds, countdown beeps, chequered flag.
6. **F1-style countdown.** Currently 5 red circles lighting up. Could add engine revving sound and dramatic "LIGHTS OUT" audio.
7. **Better finish experience.** Winning (P1) should feel amazing — confetti, champagne animation, crowd cheering. Losing should encourage retry.
8. **Question variety.** Add more questions to `src/data/questions.js`. The A1 board content has much more material that could be turned into questions.

### LOWER PRIORITY — Polish
9. **Mobile touch optimization.** Answer buttons need to be large enough for phone taps. Test on actual phones at arm's length.
10. **Pit board graphics.** Show position changes on a pit board style graphic during racing.
11. **Engine sound pitch tied to speed.** Use Web Audio API oscillator with frequency mapped to `game.speed`.
12. **Tyre smoke/sparks** on hard braking (wrong answer) or DRS zones.
13. **Start screen animation.** The background canvas should show the track moving even on the start screen.
14. **Leaderboard.** Optional: store best scores/times in localStorage or a simple backend.

## Development

```bash
npm install
npm run dev        # Dev server on :3000
npm run build      # Production build to dist/
npm start          # Preview production build (Railway uses this)
```

## Deployment (Railway)

1. Push to GitHub
2. Connect repo in Railway
3. Railway auto-detects Dockerfile
4. Deploy — serves on the assigned Railway URL

The `PORT` env var is read automatically from Railway in `vite.config.js` and `package.json` start script.

## Companion Project: A1 History Board

This game is designed to be played alongside a physical A1 poster covering F1 history in 6 era columns. Every question answer can be found on the board. The board was created as a Word document — see the project chat history for the file.

## Technical Notes

- **No external dependencies** beyond React. All rendering is vanilla Canvas 2D.
- **No localStorage** — each race is independent.
- **All game physics state** is in a `useRef` (not `useState`) to avoid re-renders during the 60fps game loop. Only UI overlay state uses `useState`.
- **The canvas is redrawn every frame** via `requestAnimationFrame`. React only re-renders when game state changes (question shown, answer selected, etc.).
