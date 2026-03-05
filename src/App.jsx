import { useState, useEffect, useRef, useCallback } from "react";
import QUESTIONS from "./data/questions";
import {
  SILVERSTONE_CORNERS, AI_CARS, RENDER, TUNING, GAME_STATES as GS,
} from "./data/track";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Build the full track by repeating Silverstone corners with sine-smoothed curves */
function buildTrackSegments() {
  const segments = [];
  for (let rep = 0; rep < 5; rep++) {
    for (const corner of SILVERSTONE_CORNERS) {
      for (let i = 0; i < corner.length; i++) {
        const progress = i / corner.length;
        const curveAtPoint = corner.curve * Math.sin(progress * Math.PI);
        segments.push({ curve: curveAtPoint, cornerName: corner.name });
      }
    }
  }
  return segments;
}

/** Calculate finishing position: 0 wrong = P1, 1 wrong = P2, etc. */
function calcPosition(correctCount, totalAnswered) {
  if (totalAnswered === 0) return 6;
  return Math.min(1 + (totalAnswered - correctCount), 6);
}

/** Format position: 1 → "1ST", 2 → "2ND", etc. */
function positionText(p) {
  if (p === 1) return "1ST";
  if (p === 2) return "2ND";
  if (p === 3) return "3RD";
  return `${p}TH`;
}

// ═══════════════════════════════════════════════════════════════
// SOUND ENGINE (Web Audio API)
// ═══════════════════════════════════════════════════════════════

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.masterGain = null;
    this.noiseSource = null;
    this.modOsc = null;
    this.filterBank = [];
    this.harmonicMults = [2, 4, 8, 16, 32];
  }

  init() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const ac = this.ctx;

      // Master gain → compressor → destination
      this.masterGain = ac.createGain();
      this.masterGain.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      comp.knee.value = 10;
      this.masterGain.connect(comp);
      comp.connect(ac.destination);

      // ── Noise buffer (combustion texture) ──
      const sr = ac.sampleRate;
      const buf = ac.createBuffer(1, sr * 2, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseSource = ac.createBufferSource();
      this.noiseSource.buffer = buf;
      this.noiseSource.loop = true;

      // ── Bandpass filter bank at engine harmonics ──
      // V8 cross-plane: dominant at 2x, 4x, 8x crankshaft freq
      const idleCrank = 50; // ~3000 RPM idle
      const harmonics = [
        { mult: 2,  Q: 4,  gain: 1.0 },   // deep rumble
        { mult: 4,  Q: 6,  gain: 0.9 },   // firing frequency (dominant)
        { mult: 8,  Q: 8,  gain: 0.45 },  // upper harmonic
        { mult: 16, Q: 10, gain: 0.2 },   // buzz
        { mult: 32, Q: 14, gain: 0.08 },  // air/presence
      ];

      const merger = ac.createGain();
      merger.gain.value = 1.0;

      harmonics.forEach(h => {
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = idleCrank * h.mult;
        bp.Q.value = h.Q;
        const g = ac.createGain();
        g.gain.value = h.gain;
        this.noiseSource.connect(bp);
        bp.connect(g);
        g.connect(merger);
        this.filterBank.push({ filter: bp, gain: g, mult: h.mult });
      });

      // ── Output gain (modulated by firing oscillator) ──
      const outputGain = ac.createGain();
      outputGain.gain.value = 0.5;
      merger.connect(outputGain);
      outputGain.connect(this.masterGain);

      // ── Periodic wave modulator — V8 cross-plane firing pattern ──
      // Cross-plane V8 fires unevenly: gives the distinctive burble
      const real = new Float32Array([0, 0.4, 1.0, 0.3, 0.15, 0.05]);
      const imag = new Float32Array([0, 0, 0, 0, 0, 0]);
      const wave = ac.createPeriodicWave(real, imag);
      this.modOsc = ac.createOscillator();
      this.modOsc.setPeriodicWave(wave);
      this.modOsc.frequency.value = idleCrank * 4; // firing freq
      const modDepth = ac.createGain();
      modDepth.gain.value = 0.6; // modulation depth
      this.modOsc.connect(modDepth);
      modDepth.connect(outputGain.gain);
      this.modDepthNode = modDepth;

      // ── Exhaust distortion (subtle waveshaper for crackle) ──
      const waveshaper = ac.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = Math.tanh(x * 1.5);
      }
      waveshaper.curve = curve;
      waveshaper.oversample = "2x";
      // Insert between merger and outputGain
      merger.disconnect(outputGain);
      merger.connect(waveshaper);
      waveshaper.connect(outputGain);

      this.noiseSource.start();
      this.modOsc.start();
      this.started = true;
    } catch (_) { /* audio not available */ }
  }

  updateEngine(speed) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    // Map game speed to RPM: idle ~2500, max ~9000
    const rpm = 2500 + speed * 4000;
    const crankFreq = rpm / 60;
    const firingFreq = crankFreq * 4;

    // Update modulator frequency
    this.modOsc.frequency.setTargetAtTime(firingFreq, t, 0.04);

    // Update all bandpass filters
    this.filterBank.forEach(({ filter, mult }) => {
      filter.frequency.setTargetAtTime(crankFreq * mult, t, 0.04);
    });

    // Volume: quiet at idle, louder with speed
    const vol = Math.min(0.18, 0.03 + speed * 0.08);
    this.masterGain.gain.setTargetAtTime(vol, t, 0.03);

    // Reduce modulation depth at high RPM (engine smooths out)
    const modDepth = 0.7 - speed * 0.15;
    this.modDepthNode.gain.setTargetAtTime(Math.max(0.2, modDepth), t, 0.05);
  }

  stopEngine() {
    if (!this.started) return;
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  playTone(freq, duration, type = "square", vol = 0.1) {
    if (!this.started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime + duration * 0.7, duration * 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  correct() {
    this.playTone(880, 0.12, "square", 0.08);
    setTimeout(() => this.playTone(1174, 0.18, "square", 0.08), 100);
  }
  wrong() {
    this.playTone(220, 0.25, "sawtooth", 0.07);
    setTimeout(() => this.playTone(165, 0.3, "sawtooth", 0.07), 120);
  }
  countdownBeep() { this.playTone(660, 0.15, "sine", 0.12); }
  lightsOut() {
    this.playTone(880, 0.15, "sine", 0.1);
    setTimeout(() => this.playTone(1320, 0.4, "sine", 0.12), 80);
  }
  chequered() {
    [0, 100, 200, 300, 400].forEach((d, i) =>
      setTimeout(() => this.playTone(660 + i * 110, 0.15, "sine", 0.08), d)
    );
  }

  destroy() {
    if (this.started && this.ctx) {
      try { this.noiseSource.stop(); } catch (_) {}
      try { this.modOsc.stop(); } catch (_) {}
      this.ctx.close();
      this.started = false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CONFETTI
// ═══════════════════════════════════════════════════════════════

function createConfetti(count = 120) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random(),
      y: -Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.008,
      vy: 0.003 + Math.random() * 0.006,
      size: 3 + Math.random() * 5,
      color: ["#FFD700", "#DC0000", "#fff", "#4ade80", "#FF8700", "#2546FF"][Math.floor(Math.random() * 6)],
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
    });
  }
  return particles;
}

function drawConfetti(ctx, particles, W, H) {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.00008;
    p.rot += p.rotSpeed;
    const px = p.x * W;
    const py = p.y * H;
    if (py > H + 20) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((p.rot * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const soundRef = useRef(null);
  const confettiRef = useRef(null);

  // ── React state (drives UI overlays) ──
  const [gameState, setGameState] = useState(GS.START);
  const [countdownNum, setCountdownNum] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showFact, setShowFact] = useState(false);
  const [position, setPosition] = useState(6);
  const [finalPosition, setFinalPosition] = useState(6);
  const [cornerName, setCornerName] = useState("");
  const [raceProgress, setRaceProgress] = useState(0);

  // ── Mutable game state (updated every frame, not re-rendering) ──
  const game = useRef({
    position: 0,           // current position along track (in segments)
    speed: 0,              // current speed
    targetSpeed: 0,        // speed we're lerping toward
    segments: [],          // full track data
    playerLane: 0,         // current lateral position (-1 to 1)
    playerLaneTarget: 0,   // target lateral position
    raceFrames: 0,         // frames spent racing since last question
    questionsAsked: 0,     // total questions shown so far
    boostTimer: 0,         // frames remaining of DRS boost effect
    shakeTimer: 0,         // frames remaining of screen shake
    brakeTimer: 0,         // frames remaining of brake smoke
    totalProgress: 0,      // overall race completion 0→1
    aiCars: [],            // AI competitor data
    startScreenPos: 0,     // position for start screen background animation
  }).current;

  // Initialize sound engine
  useEffect(() => {
    soundRef.current = new SoundEngine();
    return () => { if (soundRef.current) soundRef.current.destroy(); };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // GAME INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  const initializeGame = useCallback(() => {
    // Pick 10 random questions
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, TUNING.QUESTIONS_PER_RACE));
    setQuestionIndex(0);
    setCorrectCount(0);
    setSelectedAnswer(null);
    setShowFact(false);
    setPosition(6);
    setFinalPosition(6);
    setRaceProgress(0);
    setCornerName("PIT LANE");

    // Reset mutable state
    Object.assign(game, {
      position: 0, speed: 0, targetSpeed: 0,
      playerLane: 0, playerLaneTarget: 0,
      raceFrames: 0, questionsAsked: 0,
      boostTimer: 0, shakeTimer: 0, totalProgress: 0,
    });
    game.segments = buildTrackSegments();

    // Initialize AI cars — close together so they're clearly visible
    game.aiCars = AI_CARS.map((car, i) => ({
      ...car,
      rank: i + 1,                              // 1 = fastest AI
      segmentsAhead: 6 + i * 6,                 // close spacing: 6, 12, 18, 24, 30
      targetSegAhead: 6 + i * 6,
      lane: ((i % 2) * 2 - 1) * 0.35,          // alternating left/right
      targetLane: ((i % 2) * 2 - 1) * 0.35,
      bobPhase: Math.random() * Math.PI * 2,
      laneChangeTimer: 40 + Math.random() * 60,
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════
  // START RACE (countdown sequence)
  // ═══════════════════════════════════════════════════════════

  const startRace = useCallback(() => {
    initializeGame();
    if (soundRef.current) soundRef.current.init();
    confettiRef.current = null;
    setGameState(GS.COUNTDOWN);
    let count = 5;
    setCountdownNum(5);
    if (soundRef.current) soundRef.current.countdownBeep();
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        game.targetSpeed = TUNING.BASE_SPEED;
        setGameState(GS.RACING);
        if (soundRef.current) soundRef.current.lightsOut();
      } else {
        setCountdownNum(count);
        if (soundRef.current) soundRef.current.countdownBeep();
      }
    }, TUNING.COUNTDOWN_INTERVAL);
  }, [initializeGame]);

  // ═══════════════════════════════════════════════════════════
  // ANSWER A QUESTION
  // ═══════════════════════════════════════════════════════════

  const handleAnswer = useCallback((answerIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);

    const isCorrect = answerIndex === questions[questionIndex].correctIndex;
    const previousPosition = position;

    if (isCorrect) {
      // Speed boost + DRS effect
      if (soundRef.current) soundRef.current.correct();
      setCorrectCount(prev => {
        const newCount = prev + 1;
        setPosition(calcPosition(newCount, questionIndex + 1));
        return newCount;
      });
      game.boostTimer = TUNING.BOOST_DURATION;
      game.targetSpeed = TUNING.BOOST_SPEED;

      // Trigger overtake animation: move player to opposite lane of car being passed
      const carToPass = game.aiCars.find(c => c.rank === previousPosition - 1);
      if (carToPass) {
        carToPass.targetSegAhead = 3; // bring very close for visible pass
        carToPass.segmentsAhead = Math.min(carToPass.segmentsAhead, 12); // snap closer if far away
        game.playerLaneTarget = carToPass.lane > 0 ? -0.5 : 0.5;
      }
    } else {
      // Slow down + screen shake + brake smoke
      if (soundRef.current) soundRef.current.wrong();
      setPosition(calcPosition(correctCount, questionIndex + 1));
      game.shakeTimer = TUNING.SHAKE_DURATION;
      game.brakeTimer = 40;
      game.targetSpeed = TUNING.SLOW_SPEED;
    }

    setShowFact(true);

    // After delay, resume racing
    setTimeout(() => {
      setShowFact(false);
      setSelectedAnswer(null);
      setQuestionIndex(prev => prev + 1);
      game.questionsAsked++;
      game.raceFrames = 0;
      game.targetSpeed = TUNING.BASE_SPEED;
      game.playerLaneTarget = 0; // drift back to center
      setGameState(GS.RACING);
    }, TUNING.ANSWER_REVEAL_TIME);
  }, [selectedAnswer, questions, questionIndex, correctCount, position]);

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER LOOP (canvas + game logic)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    let running = true;
    const { FOV, CAMERA_HEIGHT, ROAD_HALF_WIDTH, DRAW_DISTANCE, CURVE_FACTOR } = RENDER;
    const g = game;

    // Ensure segments exist for start screen animation
    if (g.segments.length === 0) {
      g.segments = buildTrackSegments();
    }

    const renderFrame = () => {
      if (!running) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width;
      const H = canvas.height;
      const isRacing = gameState === GS.RACING;
      const isQuestion = gameState === GS.QUESTION;
      const dashboardHeight = Math.floor(H * 0.14);
      const viewHeight = H - dashboardHeight; // drawable area above dashboard

      // ─── START SCREEN ANIMATION ───
      if (gameState === GS.START) {
        g.startScreenPos += 0.6;
      }

      // ─── PHYSICS UPDATE ───
      if (isRacing || isQuestion) {
        // Smooth speed interpolation
        const lerpRate = isQuestion ? 0.003 : 0.015;
        g.speed += (g.targetSpeed - g.speed) * lerpRate;
        g.speed = Math.max(0.05, g.speed);

        // Slow down in corners — read current segment curve intensity
        const curSegIdx = Math.floor(g.position) % g.segments.length;
        const curSeg = g.segments[curSegIdx];
        const curveIntensity = Math.abs(curSeg ? curSeg.curve : 0);
        // Scale: curve > 20 starts slowing, curve 60+ is heavy braking
        if (curveIntensity > 15 && g.boostTimer <= 0) {
          const brakeFactor = Math.min(0.6, (curveIntensity - 15) * 0.012);
          g.speed *= (1 - brakeFactor);
          g.speed = Math.max(0.4, g.speed);
        }

        // Advance position
        g.position += g.speed;
        g.totalProgress += g.speed * 0.0001;

        // Update engine sound
        if (soundRef.current) soundRef.current.updateEngine(g.speed);

        // Decrement timers
        if (g.boostTimer > 0) g.boostTimer--;
        if (g.shakeTimer > 0) g.shakeTimer--;
        if (g.brakeTimer > 0) g.brakeTimer--;

        // Player lane animation
        g.playerLane += (g.playerLaneTarget - g.playerLane) * 0.06;
        if (g.boostTimer <= 0) g.playerLaneTarget *= 0.97; // drift to center slowly

        // Update corner name display
        const segIndex = Math.floor(g.position) % g.segments.length;
        const segName = g.segments[segIndex]?.cornerName;
        if (segName && segName !== cornerName) setCornerName(segName);
        setRaceProgress(Math.min(g.totalProgress, 1));

        // Update AI car positions
        const playerRank = position;
        g.aiCars.forEach(car => {
          car.bobPhase += 0.04;

          // Target distance based on rank relative to player
          // Cars ahead: close enough to see clearly (6-30 segs)
          // Cars behind: negative (shown in mirrors)
          if (car.rank < playerRank) {
            car.targetSegAhead = 6 + (playerRank - car.rank) * 7; // ahead, tightly packed
          } else {
            car.targetSegAhead = -4 - (car.rank - playerRank) * 5; // behind
          }
          // Clamp so ahead cars stay within view
          car.targetSegAhead = Math.min(car.targetSegAhead, 50);
          car.segmentsAhead += (car.targetSegAhead - car.segmentsAhead) * 0.04; // faster lerp

          // Lane changes
          car.laneChangeTimer--;
          if (car.laneChangeTimer <= 0) {
            car.targetLane = (Math.random() - 0.5) * 0.5;
            // Avoid player's lane when close
            if (car.segmentsAhead > 0 && car.segmentsAhead < 15) {
              if (Math.abs(car.targetLane - g.playerLane) < 0.25) {
                car.targetLane = g.playerLane > 0 ? -0.4 : 0.4;
              }
            }
            car.laneChangeTimer = 50 + Math.random() * 80;
          }
          car.lane += (car.targetLane - car.lane) * 0.025;
        });

        // Trigger next question after racing segment
        if (isRacing) {
          g.raceFrames++;
          if (g.raceFrames >= TUNING.RACE_SEGMENT_FRAMES &&
              questionIndex < TUNING.QUESTIONS_PER_RACE &&
              g.questionsAsked < TUNING.QUESTIONS_PER_RACE) {
            setGameState(GS.QUESTION);
          }
          // Check for race finish
          if (g.questionsAsked >= TUNING.QUESTIONS_PER_RACE && g.totalProgress >= 1) {
            const fp = calcPosition(correctCount, TUNING.QUESTIONS_PER_RACE);
            setFinalPosition(fp);
            setPosition(fp);
            setGameState(GS.FINISH);
            if (soundRef.current) { soundRef.current.chequered(); soundRef.current.stopEngine(); }
            if (fp === 1) confettiRef.current = createConfetti(150);
          }
        }
      }

      // ─── ROAD PROJECTION ───
      const horizon = viewHeight * 0.35; // lower horizon = more road visible
      const effectivePos = (isRacing || isQuestion) ? g.position : g.startScreenPos;
      const baseSegIndex = Math.floor(effectivePos);
      const fractionalPos = effectivePos - baseSegIndex;

      const projected = [];
      let curveDrift = 0;
      let curveRate = 0;

      for (let n = 0; n < DRAW_DISTANCE; n++) {
        const z = n + 1 - fractionalPos;
        if (z <= 0.1) continue;

        const segIdx = (baseSegIndex + n) % g.segments.length;
        const seg = g.segments[segIdx];

        // Accumulate curve (this creates the sweeping road effect)
        curveDrift += curveRate;
        curveRate += seg.curve * CURVE_FACTOR;

        const scale = FOV / z;
        const screenY = horizon + CAMERA_HEIGHT * scale;
        const screenW = ROAD_HALF_WIDTH * 2 * scale;
        const screenX = W / 2 + (curveDrift - g.playerLane * ROAD_HALF_WIDTH) * scale;

        if (screenY < horizon - 5) continue;
        projected.push({
          x: screenX,
          y: Math.min(screenY, viewHeight + 5),
          w: screenW,
          segmentIndex: segIdx,
          drawOrder: n,
        });
      }

      // ─── DRAW SKY (daytime) ───
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
      skyGrad.addColorStop(0, "#4a90d9");
      skyGrad.addColorStop(0.5, "#7bb8e8");
      skyGrad.addColorStop(0.85, "#b8d8f0");
      skyGrad.addColorStop(1, "#d4e8d0");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizon + 10);

      // Clouds (fixed positions, slowly drifting)
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      const cloudDrift = (effectivePos * 0.02) % W;
      for (let c = 0; c < 6; c++) {
        const cx = ((c * 217 + 50 - cloudDrift) % (W + 200)) - 100;
        const cy = horizon * (0.15 + (c % 3) * 0.18);
        const cw = 50 + (c * 37 % 60);
        const ch = 12 + (c * 13 % 10);
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - cw * 0.4, cy + 3, cw * 0.6, ch * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + cw * 0.35, cy + 2, cw * 0.5, ch * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant hills/grandstands silhouette
      ctx.fillStyle = "#5a7a5a";
      ctx.beginPath();
      ctx.moveTo(0, horizon + 2);
      for (let x = 0; x <= W; x += 8) {
        const h1 = Math.sin(x * 0.003 + 1.2) * 15;
        const h2 = Math.sin(x * 0.007 + 0.5) * 8;
        ctx.lineTo(x, horizon - 5 - h1 - h2);
      }
      ctx.lineTo(W, horizon + 2);
      ctx.fill();

      // Grandstand blocks (distant)
      ctx.fillStyle = "#7a8a7a";
      const gsX1 = W * 0.15 - (cloudDrift * 0.3 % 40);
      ctx.fillRect(gsX1, horizon - 22, 60, 18);
      ctx.fillRect(gsX1 + 70, horizon - 18, 40, 14);
      ctx.fillStyle = "#8a9a8a";
      ctx.fillRect(W * 0.7 + (cloudDrift * 0.2 % 30), horizon - 20, 80, 16);

      // Green grass horizon strip
      ctx.fillStyle = "#3a8a3a";
      ctx.fillRect(0, horizon - 2, W, 12);

      // ─── DRAW ROAD (back to front) ───
      for (let i = projected.length - 1; i > 0; i--) {
        const far = projected[i];
        const near = projected[i - 1];
        const y1 = Math.floor(far.y);   // far = closer to horizon (small y)
        const y2 = Math.floor(near.y);  // near = closer to camera (large y)

        // Skip degenerate strips: y1 should be ABOVE y2 on screen
        if (y1 >= y2 || y2 < horizon || y1 > viewHeight + 5) continue;

        // Alternating colours for speed perception (/ 3 = faster flicker)
        const alt = Math.floor(far.segmentIndex / 3) % 2;

        // y1 = far (top, near horizon), y2 = near (bottom, near camera)
        const stripH = y2 - y1;

        // ── GRASS (bright green, alternating for speed feel) ──
        ctx.fillStyle = alt ? "#2d8a2d" : "#258a25";
        ctx.fillRect(0, y1, W, stripH + 1);

        // ── GRAVEL TRAP (between grass and kerb) ──
        const gravelFar = far.w * 0.08;
        const gravelNear = near.w * 0.08;
        ctx.fillStyle = alt ? "#c4a86a" : "#b89a5e";
        // Left gravel
        ctx.beginPath();
        ctx.moveTo(far.x - far.w / 2 - gravelFar * 2.5, y1);
        ctx.lineTo(far.x - far.w / 2 - gravelFar * 0.3, y1);
        ctx.lineTo(near.x - near.w / 2 - gravelNear * 0.3, y2);
        ctx.lineTo(near.x - near.w / 2 - gravelNear * 2.5, y2);
        ctx.fill();
        // Right gravel
        ctx.beginPath();
        ctx.moveTo(far.x + far.w / 2 + gravelFar * 0.3, y1);
        ctx.lineTo(far.x + far.w / 2 + gravelFar * 2.5, y1);
        ctx.lineTo(near.x + near.w / 2 + gravelNear * 2.5, y2);
        ctx.lineTo(near.x + near.w / 2 + gravelNear * 0.3, y2);
        ctx.fill();

        // ── ROAD SURFACE (darker, realistic tarmac) ──
        ctx.fillStyle = alt ? "#484850" : "#404048";
        ctx.beginPath();
        ctx.moveTo(far.x - far.w / 2, y1);
        ctx.lineTo(far.x + far.w / 2, y1);
        ctx.lineTo(near.x + near.w / 2, y2);
        ctx.lineTo(near.x - near.w / 2, y2);
        ctx.fill();

        // ── THICK KERBS (red/white sausage style) ──
        const kFar = far.w * 0.06;   // much wider kerbs
        const kNear = near.w * 0.06;
        // Kerb base colour (alternating red/white like real F1 kerbs)
        const kerbAlt = Math.floor(far.segmentIndex / 2) % 2;
        ctx.fillStyle = kerbAlt ? "#DC0000" : "#ffffff";
        // Left kerb
        ctx.beginPath();
        ctx.moveTo(far.x - far.w / 2 - kFar, y1);
        ctx.lineTo(far.x - far.w / 2, y1);
        ctx.lineTo(near.x - near.w / 2, y2);
        ctx.lineTo(near.x - near.w / 2 - kNear, y2);
        ctx.fill();
        // Right kerb
        ctx.beginPath();
        ctx.moveTo(far.x + far.w / 2, y1);
        ctx.lineTo(far.x + far.w / 2 + kFar, y1);
        ctx.lineTo(near.x + near.w / 2 + kNear, y2);
        ctx.lineTo(near.x + near.w / 2, y2);
        ctx.fill();
        // Kerb raised edge highlight (gives 3D raised look)
        ctx.fillStyle = kerbAlt ? "#ff3333" : "#e8e8e8";
        const keH = Math.max(1, stripH * 0.3);
        // Left raised edge
        ctx.beginPath();
        ctx.moveTo(far.x - far.w / 2 - kFar, y1);
        ctx.lineTo(far.x - far.w / 2, y1);
        ctx.lineTo(near.x - near.w / 2, y1 + keH);
        ctx.lineTo(near.x - near.w / 2 - kNear, y1 + keH);
        ctx.fill();
        // Right raised edge
        ctx.beginPath();
        ctx.moveTo(far.x + far.w / 2, y1);
        ctx.lineTo(far.x + far.w / 2 + kFar, y1);
        ctx.lineTo(near.x + near.w / 2 + kNear, y1 + keH);
        ctx.lineTo(near.x + near.w / 2, y1 + keH);
        ctx.fill();

        // ── WHITE EDGE LINES (thick like real track) ──
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        const edgeW = Math.max(1, near.w * 0.006);
        ctx.beginPath();
        ctx.moveTo(far.x - far.w / 2, y1);
        ctx.lineTo(far.x - far.w / 2 + edgeW, y1);
        ctx.lineTo(near.x - near.w / 2 + edgeW, y2);
        ctx.lineTo(near.x - near.w / 2, y2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(far.x + far.w / 2 - edgeW, y1);
        ctx.lineTo(far.x + far.w / 2, y1);
        ctx.lineTo(near.x + near.w / 2, y2);
        ctx.lineTo(near.x + near.w / 2 - edgeW, y2);
        ctx.fill();

        // ── TRACKSIDE BARRIERS (dark wall beyond gravel) ──
        if (far.w > 6) {
          const barrierH = Math.max(1, far.w * 0.015);
          const barrierFarL = far.x - far.w / 2 - gravelFar * 2.8;
          const barrierFarR = far.x + far.w / 2 + gravelFar * 2.8;
          const barrierNearL = near.x - near.w / 2 - gravelNear * 2.8;
          const barrierNearR = near.x + near.w / 2 + gravelNear * 2.8;
          // Left barrier
          ctx.fillStyle = alt ? "#556" : "#667";
          ctx.beginPath();
          ctx.moveTo(barrierFarL, y1 - barrierH);
          ctx.lineTo(barrierFarL + far.w * 0.01, y1 - barrierH);
          ctx.lineTo(barrierNearL + near.w * 0.01, y2);
          ctx.lineTo(barrierNearL, y2);
          ctx.fill();
          // Right barrier
          ctx.beginPath();
          ctx.moveTo(barrierFarR - far.w * 0.01, y1 - barrierH);
          ctx.lineTo(barrierFarR, y1 - barrierH);
          ctx.lineTo(barrierNearR, y2);
          ctx.lineTo(barrierNearR - near.w * 0.01, y2);
          ctx.fill();
        }

        // ── Catch fence posts (every 8 segments) ──
        if (far.segmentIndex % 8 === 0 && far.w > 10) {
          const postH = far.w * 0.025;
          const postW = Math.max(1, far.w * 0.003);
          const postFL = far.x - far.w / 2 - gravelFar * 2.8;
          const postFR = far.x + far.w / 2 + gravelFar * 2.8;
          ctx.fillStyle = "#888";
          ctx.fillRect(postFL - postW / 2, y1 - postH, postW, postH);
          ctx.fillRect(postFR - postW / 2, y1 - postH, postW, postH);
        }

        // ── Distance boards (every 25 segments) ──
        if (far.segmentIndex % 25 === 12 && far.w > 14) {
          const side = (far.segmentIndex % 50 < 25) ? -1 : 1;
          const signX = far.x + side * (far.w / 2 + gravelFar * 3.5);
          const signH = far.w * 0.04;
          ctx.fillStyle = "#185a28";
          ctx.fillRect(signX - signH * 1.2, y1 - signH * 1.5, signH * 2.4, signH);
          if (signH > 5) {
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(5, Math.floor(signH * 0.5))}px monospace`;
            ctx.textAlign = "center";
            ctx.fillText("100", signX, y1 - signH * 0.8);
          }
        }

        // ── AI CARS (drawn at their depth in the scene) ──
        g.aiCars.forEach(car => {
          if (car.segmentsAhead < 2 || car.segmentsAhead >= DRAW_DISTANCE - 2) return;
          // Draw this car when the current strip matches its depth
          const carDrawIdx = Math.round(car.segmentsAhead);
          if (far.drawOrder !== carDrawIdx) return;

          // Car width proportional to road width at this depth, with minimum size
          const carWidth = Math.max(8, far.w * 0.14);
          if (far.y < horizon + 3) return;
          const carHeight = carWidth * 0.45;
          const carX = far.x + car.lane * far.w * 0.35;
          const carY = far.y;
          const bob = Math.sin(car.bobPhase) * 0.6;

          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath();
          ctx.ellipse(carX, carY + bob + 1, carWidth * 0.4, carHeight * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rear wing
          ctx.fillStyle = car.color;
          ctx.fillRect(carX - carWidth * 0.52, carY - carHeight - carHeight * 0.1 + bob, carWidth * 1.04, carHeight * 0.09);
          // Endplates
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(carX - carWidth * 0.55, carY - carHeight - carHeight * 0.14 + bob, carWidth * 0.05, carHeight * 0.15);
          ctx.fillRect(carX + carWidth * 0.5, carY - carHeight - carHeight * 0.14 + bob, carWidth * 0.05, carHeight * 0.15);

          // Body (tapered rear view)
          ctx.fillStyle = car.color;
          ctx.beginPath();
          ctx.moveTo(carX - carWidth * 0.36, carY + bob);
          ctx.lineTo(carX - carWidth * 0.42, carY - carHeight * 0.5 + bob);
          ctx.lineTo(carX - carWidth * 0.22, carY - carHeight + bob);
          ctx.lineTo(carX + carWidth * 0.22, carY - carHeight + bob);
          ctx.lineTo(carX + carWidth * 0.42, carY - carHeight * 0.5 + bob);
          ctx.lineTo(carX + carWidth * 0.36, carY + bob);
          ctx.fill();

          // Rear light strip
          ctx.fillStyle = "#ff1a1a";
          ctx.fillRect(carX - carWidth * 0.1, carY - carHeight * 0.18 + bob, carWidth * 0.2, Math.max(1, carHeight * 0.05));

          // Rear wheels
          ctx.fillStyle = "#080808";
          ctx.fillRect(carX - carWidth * 0.5, carY - carHeight * 0.45 + bob, carWidth * 0.08, carHeight * 0.4);
          ctx.fillRect(carX + carWidth * 0.42, carY - carHeight * 0.45 + bob, carWidth * 0.08, carHeight * 0.4);

          // Name label
          if (carWidth > 15) {
            ctx.font = `bold ${Math.max(7, Math.floor(carWidth * 0.18))}px monospace`;
            ctx.fillStyle = `rgba(255,255,255,${Math.min(0.65, carWidth / 60)})`;
            ctx.textAlign = "center";
            ctx.fillText(car.name, carX, carY - carHeight - carHeight * 0.2 + bob);
          }
        });
      }

      // ─── SPEED STREAKS ───
      if (g.speed > 0.7) {
        const intensity = Math.min(1, (g.speed - 0.7) / 1.8);
        ctx.strokeStyle = `rgba(255,255,255,${intensity * 0.1})`;
        ctx.lineWidth = 1;
        for (let s = 0; s < Math.floor(intensity * 10); s++) {
          const sy = viewHeight * 0.35 + Math.random() * viewHeight * 0.5;
          const isLeft = Math.random() < 0.5;
          const sx = isLeft ? Math.random() * W * 0.06 : W - Math.random() * W * 0.06;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (isLeft ? -1 : 1) * 25 * intensity, sy + 14 * intensity);
          ctx.stroke();
        }
      }

      // ─── BRAKE SMOKE ───
      if (g.brakeTimer > 0) {
        const smokeAlpha = g.brakeTimer / 40;
        ctx.fillStyle = `rgba(180,180,180,${smokeAlpha * 0.15})`;
        for (let s = 0; s < 8; s++) {
          const sx = W / 2 + (Math.random() - 0.5) * W * 0.12;
          const sy = viewHeight * 0.75 + Math.random() * viewHeight * 0.15;
          const sr = 5 + Math.random() * 15 * smokeAlpha;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Boost tunnel vignette
      if (g.boostTimer > 0) {
        const bi = g.boostTimer / TUNING.BOOST_DURATION;
        const vg = ctx.createRadialGradient(W / 2, viewHeight * 0.4, W * 0.08, W / 2, viewHeight * 0.4, W * 0.65);
        vg.addColorStop(0, "transparent");
        vg.addColorStop(1, `rgba(0,0,0,${bi * 0.18})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, viewHeight);
      }

      // Screen shake offset
      if (g.shakeTimer > 0) {
        ctx.save();
        ctx.translate(
          (Math.random() - 0.5) * g.shakeTimer * 0.4,
          (Math.random() - 0.5) * g.shakeTimer * 0.25
        );
      }

      // ─── COCKPIT OVERLAY (subtle T-cam onboard view) ───
      // In the reference images, the cockpit is in the lower ~30% of screen
      // Wheels peek in at the very edges, nose is a slim wedge at center-bottom

      // ── Front wheels (small, at screen edges, partially off-screen) ──
      const wheelW = W * 0.045;
      const wheelH = H * 0.10;
      const wheelY = H * 0.72;
      // Left wheel (partially off left edge)
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(W * 0.07, wheelY, wheelW, wheelH, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(W * 0.07, wheelY, wheelW * 0.8, wheelH * 0.8, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#252525";
      ctx.lineWidth = 1;
      for (let wg = 1; wg < 4; wg++) {
        ctx.beginPath();
        ctx.ellipse(W * 0.07, wheelY, wheelW * (0.25 + wg * 0.18), wheelH * (0.25 + wg * 0.18), -0.1, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Right wheel (partially off right edge)
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(W * 0.93, wheelY, wheelW, wheelH, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(W * 0.93, wheelY, wheelW * 0.8, wheelH * 0.8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#252525";
      for (let wg = 1; wg < 4; wg++) {
        ctx.beginPath();
        ctx.ellipse(W * 0.93, wheelY, wheelW * (0.25 + wg * 0.18), wheelH * (0.25 + wg * 0.18), 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Nose cone (slim center wedge, bottom 25% of screen) ──
      const noseTop = H * 0.72;
      const noseGrad = ctx.createLinearGradient(W / 2 - W * 0.06, 0, W / 2 + W * 0.06, 0);
      noseGrad.addColorStop(0, "#1a1a2a");
      noseGrad.addColorStop(0.3, "#2a2a3a");
      noseGrad.addColorStop(0.5, "#353545");
      noseGrad.addColorStop(0.7, "#2a2a3a");
      noseGrad.addColorStop(1, "#1a1a2a");
      ctx.fillStyle = noseGrad;
      ctx.beginPath();
      ctx.moveTo(W / 2 - W * 0.015, noseTop);          // narrow tip
      ctx.lineTo(W / 2 + W * 0.015, noseTop);
      ctx.lineTo(W / 2 + W * 0.06, H * 0.88);          // widens toward camera
      ctx.lineTo(W / 2 + W * 0.08, H);
      ctx.lineTo(W / 2 - W * 0.08, H);
      ctx.lineTo(W / 2 - W * 0.06, H * 0.88);
      ctx.fill();
      // Center line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2, noseTop + 5);
      ctx.lineTo(W / 2, H);
      ctx.stroke();

      // ── Suspension arms (thin lines from nose to wheels) ──
      ctx.strokeStyle = "#2a2a38";
      ctx.lineWidth = Math.max(1.5, W * 0.002);
      // Left
      ctx.beginPath();
      ctx.moveTo(W / 2 - W * 0.03, H * 0.76);
      ctx.lineTo(W * 0.10, wheelY - wheelH * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 - W * 0.035, H * 0.82);
      ctx.lineTo(W * 0.10, wheelY + wheelH * 0.15);
      ctx.stroke();
      // Right
      ctx.beginPath();
      ctx.moveTo(W / 2 + W * 0.03, H * 0.76);
      ctx.lineTo(W * 0.90, wheelY - wheelH * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 + W * 0.035, H * 0.82);
      ctx.lineTo(W * 0.90, wheelY + wheelH * 0.15);
      ctx.stroke();

      // ── Side mirrors (small, at roughly 15%/85% width) ──
      const mirrorW = W * 0.025;
      const mirrorH = H * 0.018;
      const mirrorY = H * 0.66;
      ctx.fillStyle = "#1a1a2a";
      ctx.fillRect(W * 0.13 - mirrorW, mirrorY, mirrorW, mirrorH);
      ctx.fillStyle = "#304060";
      ctx.fillRect(W * 0.13 - mirrorW + 1, mirrorY + 1, mirrorW - 2, mirrorH - 2);
      ctx.fillStyle = "#1a1a2a";
      ctx.fillRect(W * 0.87, mirrorY, mirrorW, mirrorH);
      ctx.fillStyle = "#304060";
      ctx.fillRect(W * 0.87 + 1, mirrorY + 1, mirrorW - 2, mirrorH - 2);
      // Mirror reflections
      g.aiCars.forEach(car => {
        if (car.segmentsAhead < 2) {
          const mx = car.lane < 0 ? W * 0.13 - mirrorW + 3 : W * 0.87 + 3;
          ctx.fillStyle = car.color;
          ctx.fillRect(mx, mirrorY + 3, 4, 2);
        }
      });

      // ── Halo center pillar only (thin vertical bar, no arch blocking view) ──
      ctx.fillStyle = "rgba(60,60,70,0.7)";
      ctx.fillRect(W / 2 - 2, noseTop - H * 0.08, 4, H * 0.08);

      // ── Dashboard bar (slim bottom strip with telemetry) ──
      const dashY = H * 0.91;
      ctx.fillStyle = "rgba(10,10,15,0.85)";
      ctx.fillRect(W * 0.32, dashY, W * 0.36, H - dashY);

      // RPM LED strip
      const rpmFraction = Math.min(1, g.speed / 2.5);
      const ledCount = 15;
      const ledW = Math.min(6, W * 0.006);
      const ledGap = ledW * 1.5;
      const ledStartX = W / 2 - (ledCount * ledGap) / 2;
      for (let l = 0; l < ledCount; l++) {
        const isLit = l / ledCount < rpmFraction;
        if (l < 5) ctx.fillStyle = isLit ? "#0d0" : "#091a09";
        else if (l < 10) ctx.fillStyle = isLit ? "#dd0" : "#1a1a09";
        else ctx.fillStyle = isLit ? "#d00" : "#1a0909";
        ctx.fillRect(ledStartX + l * ledGap, dashY + 3, ledW, ledW * 0.5);
      }

      // Gear (center, big)
      const gear = g.speed < 0.3 ? 2 : g.speed < 0.6 ? 4 : g.speed < 1.0 ? 6 : g.speed < 1.6 ? 7 : 8;
      ctx.font = `bold ${Math.max(16, Math.floor(H * 0.032))}px monospace`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(gear.toString(), W / 2, dashY + 22);

      // Speed (right of center)
      const kph = Math.floor(g.speed * 180 + 80);
      ctx.font = `bold ${Math.max(11, Math.floor(H * 0.018))}px monospace`;
      ctx.fillStyle = g.boostTimer > 0 ? "#0f8" : "#ccc";
      ctx.fillText(kph.toString(), W * 0.58, dashY + 16);
      ctx.font = `${Math.max(5, Math.floor(H * 0.007))}px monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillText("KPH", W * 0.58, dashY + 23);

      // DRS indicator
      if (g.boostTimer > 0 && g.boostTimer % 14 < 8) {
        ctx.font = `bold ${Math.max(9, Math.floor(H * 0.012))}px monospace`;
        ctx.fillStyle = "#0f8";
        ctx.textAlign = "center";
        ctx.fillText("DRS", W * 0.42, dashY + 16);
      }

      if (g.shakeTimer > 0) ctx.restore();

      // ─── CONFETTI (finish screen P1) ───
      if (confettiRef.current && gameState === GS.FINISH) {
        drawConfetti(ctx, confettiRef.current, W, H);
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      running = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, questionIndex, correctCount, position, selectedAnswer, questions, cornerName]);

  // ═══════════════════════════════════════════════════════════
  // UI COMPONENTS
  // ═══════════════════════════════════════════════════════════

  const currentQuestion = questions[questionIndex];

  return (
    <div style={{ width: "100%", height: "100vh", background: "#000", fontFamily: "'Courier New', monospace", overflow: "hidden", position: "relative", userSelect: "none" }}>
      {/* Canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      {/* ═══ HUD ═══ */}
      {(gameState === GS.RACING || gameState === GS.QUESTION) && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)", zIndex: 10 }}>
          <div style={{ background: position === 1 ? "#DC0000" : "rgba(0,0,0,0.55)", padding: "2px 9px", borderRadius: "3px", border: `1px solid ${position === 1 ? "#f44" : "rgba(255,255,255,0.08)"}`, textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "6px", letterSpacing: "2px" }}>POS</div>
            <div style={{ color: "#fff", fontSize: "16px", fontWeight: "bold" }}>{positionText(position)}</div>
          </div>
          <div style={{ textAlign: "center", flex: 1, padding: "0 6px" }}>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "9px", fontWeight: "bold", letterSpacing: "3px" }}>{cornerName}</div>
            <div style={{ height: "3px", background: "rgba(255,255,255,0.04)", borderRadius: "2px", marginTop: "3px", maxWidth: "140px", margin: "3px auto 0" }}>
              <div style={{ height: "100%", width: `${raceProgress * 100}%`, background: "linear-gradient(90deg, #DC0000, #f44)", borderRadius: "2px", transition: "width 0.4s" }} />
            </div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.55)", padding: "2px 9px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "6px", letterSpacing: "2px" }}>SCORE</div>
            <div style={{ color: "#4ade80", fontSize: "16px", fontWeight: "bold" }}>
              {correctCount}<span style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)" }}>/{questionIndex}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ START SCREEN ═══ */}
      {gameState === GS.START && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 60%, rgba(220,0,0,0.05) 0%, rgba(0,0,0,0.95) 70%)", zIndex: 20 }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "repeating-linear-gradient(90deg, #fff 0px, #fff 8px, #DC0000 8px, #DC0000 16px)" }} />
          <div style={{ fontSize: "clamp(8px, 1.2vw, 10px)", letterSpacing: "8px", color: "rgba(255,255,255,0.12)" }}>THE HISTORY OF F1</div>
          <div style={{ fontSize: "clamp(22px, 5.5vw, 42px)", fontWeight: "bold", color: "#DC0000", textShadow: "0 0 60px rgba(220,0,0,0.18)" }}>RACE TO VICTORY</div>
          <div style={{ fontSize: "clamp(9px, 1.4vw, 11px)", color: "rgba(255,255,255,0.15)", letterSpacing: "5px" }}>SILVERSTONE GRAND PRIX</div>
          <div style={{ width: "30px", height: "2px", background: "#DC0000", margin: "10px 0" }} />
          <div style={{ fontSize: "clamp(9px, 1.1vw, 10px)", color: "rgba(255,255,255,0.15)", maxWidth: "340px", textAlign: "center", lineHeight: 1.7, marginBottom: "16px", padding: "0 12px" }}>
            Cockpit racing around Silverstone. Answer 10 F1 history questions between laps. Get ALL right to win! Each wrong answer drops a position.
          </div>
          <button onClick={startRace} style={{ padding: "14px 40px", fontSize: "clamp(13px, 1.8vw, 16px)", fontWeight: "bold", fontFamily: "'Courier New', monospace", background: "#DC0000", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", letterSpacing: "4px", boxShadow: "0 0 40px rgba(220,0,0,0.25)", minHeight: "48px" }}>
            START RACE
          </button>
        </div>
      )}

      {/* ═══ COUNTDOWN ═══ */}
      {gameState === GS.COUNTDOWN && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", zIndex: 20 }}>
          <div style={{ display: "flex", gap: "clamp(6px, 1.4vw, 11px)", marginBottom: "16px" }}>
            {[5, 4, 3, 2, 1].map(n => (
              <div key={n} style={{ width: "clamp(20px, 4.5vw, 36px)", height: "clamp(20px, 4.5vw, 36px)", borderRadius: "50%", background: countdownNum <= n ? "#DC0000" : "#151515", boxShadow: countdownNum <= n ? "0 0 22px rgba(220,0,0,0.9), 0 0 44px rgba(220,0,0,0.3)" : "inset 0 2px 4px rgba(0,0,0,0.5)", border: "2px solid #2a2a2a", transition: "all 0.3s" }} />
            ))}
          </div>
          <div style={{ fontSize: "clamp(10px, 1.6vw, 14px)", letterSpacing: "4px", color: "rgba(255,255,255,0.55)", fontWeight: "bold" }}>
            {countdownNum > 1 ? "LIGHTS ON" : "LIGHTS OUT AND AWAY WE GO!"}
          </div>
        </div>
      )}

      {/* ═══ QUESTION OVERLAY ═══ */}
      {gameState === GS.QUESTION && currentQuestion && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "15%", display: "flex", justifyContent: "center", zIndex: 20, padding: "0 8px", pointerEvents: "none" }}>
          <div style={{ background: "rgba(6,6,14,0.92)", border: "1px solid rgba(220,0,0,0.16)", borderRadius: "8px", padding: "clamp(9px, 1.8vw, 14px)", maxWidth: "420px", width: "100%", boxShadow: "0 -6px 36px rgba(0,0,0,0.75)", backdropFilter: "blur(5px)", pointerEvents: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
              <span style={{ fontSize: "7px", letterSpacing: "2px", color: "#DC0000", fontWeight: "bold" }}>Q{questionIndex + 1}/10</span>
              <span style={{ fontSize: "7px", letterSpacing: "2px", color: "rgba(255,255,255,0.12)" }}>{currentQuestion.era.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: "clamp(10px, 1.7vw, 13px)", color: "#fff", lineHeight: 1.4, marginBottom: "7px", fontWeight: "bold" }}>{currentQuestion.question}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
              {currentQuestion.options.map((option, i) => {
                const revealed = selectedAnswer !== null;
                const isCorrect = i === currentQuestion.correctIndex;
                const isSelected = selectedAnswer === i;
                let bg = "rgba(255,255,255,0.025)";
                let border = "1px solid rgba(255,255,255,0.035)";
                if (revealed && isCorrect) { bg = "rgba(74,222,128,0.15)"; border = "1px solid #4ade80"; }
                else if (revealed && isSelected && !isCorrect) { bg = "rgba(220,0,0,0.15)"; border = "1px solid #DC0000"; }
                return (
                  <button key={i} onClick={() => handleAnswer(i)} disabled={revealed} style={{ padding: "10px 9px", fontSize: "clamp(11px, 1.6vw, 13px)", fontFamily: "'Courier New', monospace", background: bg, color: "#fff", border, borderRadius: "4px", cursor: revealed ? "default" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "6px", minHeight: "44px" }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: "bold", flexShrink: 0, background: revealed && isCorrect ? "#4ade80" : revealed && isSelected ? "#DC0000" : "rgba(255,255,255,0.035)", color: revealed && (isCorrect || isSelected) ? "#fff" : "rgba(255,255,255,0.2)" }}>
                      {revealed && isCorrect ? "✓" : revealed && isSelected && !isCorrect ? "✗" : String.fromCharCode(65 + i)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
            {showFact && (
              <div style={{ marginTop: "5px", padding: "5px 7px", background: selectedAnswer === currentQuestion.correctIndex ? "rgba(74,222,128,0.05)" : "rgba(220,0,0,0.04)", border: `1px solid ${selectedAnswer === currentQuestion.correctIndex ? "rgba(74,222,128,0.09)" : "rgba(220,0,0,0.06)"}`, borderRadius: "3px", fontSize: "8px", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                <span style={{ fontWeight: "bold", color: selectedAnswer === currentQuestion.correctIndex ? "#4ade80" : "#DC0000" }}>
                  {selectedAnswer === currentQuestion.correctIndex ? "✓ " : "✗ "}
                </span>
                {currentQuestion.fact}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ FINISH SCREEN ═══ */}
      {gameState === GS.FINISH && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.87)", zIndex: 20 }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "repeating-linear-gradient(90deg, #fff 0px, #fff 10px, #111 10px, #111 20px)" }} />
          <div style={{ fontSize: "8px", letterSpacing: "5px", color: "rgba(255,255,255,0.12)" }}>🏁 CHEQUERED FLAG 🏁</div>
          <div style={{ fontSize: "clamp(30px, 8vw, 56px)", fontWeight: "bold", color: finalPosition === 1 ? "#FFD700" : finalPosition <= 3 ? "#ddd" : "#888", textShadow: finalPosition === 1 ? "0 0 50px rgba(255,215,0,0.4)" : "none" }}>{positionText(finalPosition)}</div>
          <div style={{ fontSize: "clamp(10px, 1.8vw, 14px)", color: "rgba(255,255,255,0.28)", marginBottom: "12px" }}>
            {finalPosition === 1 ? "🏆 RACE WINNER! 🏆" : finalPosition <= 3 ? "PODIUM FINISH!" : "CLASSIFIED FINISHER"}
          </div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            {[
              ["CORRECT", correctCount, "#4ade80", "of 10"],
              ["POSITION", positionText(finalPosition), finalPosition === 1 ? "#FFD700" : "#fff", "of 6"],
            ].map(([label, value, color, sub], i) => (
              <div key={i} style={{ textAlign: "center", padding: "5px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.035)" }}>
                <div style={{ fontSize: "6px", letterSpacing: "2px", color: "rgba(255,255,255,0.12)" }}>{label}</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color }}>{value}</div>
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.08)" }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.14)", marginBottom: "12px", textAlign: "center", maxWidth: "300px", lineHeight: 1.5 }}>
            {correctCount === 10 ? "🏆 PERFECT! True F1 historian!" :
             correctCount >= 8 ? `So close! ${10 - correctCount} wrong — study the board!` :
             correctCount >= 5 ? "Good try! The history board has the answers." :
             "Study the history board and race again!"}
          </div>
          <button onClick={() => { setGameState(GS.START); confettiRef.current = null; }} style={{ padding: "12px 32px", fontSize: "clamp(11px, 1.5vw, 14px)", fontWeight: "bold", fontFamily: "'Courier New', monospace", background: "#DC0000", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", letterSpacing: "3px", boxShadow: "0 0 30px rgba(220,0,0,0.25)", minHeight: "48px" }}>
            RACE AGAIN
          </button>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: "repeating-linear-gradient(90deg, #fff 0px, #fff 10px, #111 10px, #111 20px)" }} />
        </div>
      )}
    </div>
  );
}
