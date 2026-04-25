/* ============================================
   balloons.js — Balloon Types, Physics & Rendering
============================================ */

// ── Balloon Types ──────────────────────────────
const BALLOON_TYPES = {
  normal:  { emoji: '🎈', color: '#ff6b9d', glow: '#ff006e', score: 10,  scoreText: '+10',  chance: 0.50, speedMult: 1.0 },
  speed:   { emoji: '⚡',  color: '#00d4ff', glow: '#0099cc', score: 20,  scoreText: '+20',  chance: 0.20, speedMult: 2.0 },
  bomb:    { emoji: '💣',  color: '#ff4444', glow: '#cc0000', score: -30, scoreText: '-30',  chance: 0.15, speedMult: 1.2 },
  bonus:   { emoji: '⭐',  color: '#ffd700', glow: '#ffaa00', score: 50,  scoreText: '+50',  chance: 0.08, speedMult: 0.8 },
  slowmo:  { emoji: '🌀',  color: '#bf00ff', glow: '#9900cc', score: 0,   scoreText: '🌀 SLOW',  chance: 0.04, speedMult: 0.9 },
  double:  { emoji: '✖️', color: '#39ff14', glow: '#22bb00', score: 0,   scoreText: '✖️ 2X',    chance: 0.03, speedMult: 1.0 },
};

const BALLOON_NAMES = Object.keys(BALLOON_TYPES);

// ── Particle Pool for Pop Effects ──────────────
class ParticleSystem {
  constructor() { this.particles = []; }

  emit(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.025,
        size: Math.random() * 10 + 4,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  update() {
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.vx *= 0.97;
      p.life -= p.decay;
      p.rotation += p.rotSpeed;
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      // Confetti rect
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }
}

// ── Balloon Class ──────────────────────────────
class Balloon {
  constructor(config, levelConfig, playerSide = 'both') {
    const { canvasW, canvasH } = config;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.playerSide = playerSide; // 'left' | 'right' | 'both'

    // Choose type based on weighted chance
    this.type = this._randomType(levelConfig);
    const td = BALLOON_TYPES[this.type];

    // Size
    this.radius = Math.random() * 22 + 30; // 30-52px

    // Position — spawn in player's half if split screen
    this.x = this._spawnX(canvasW);
    this.y = canvasH + this.radius * 2;

    // Movement
    const baseSpeed = levelConfig.balloonSpeed * td.speedMult;
    this.vy = -(Math.random() * baseSpeed * 0.6 + baseSpeed * 0.5);
    this.vx = (Math.random() - 0.5) * 1.5;
    this.wobble = Math.random() * Math.PI * 2; // phase
    this.wobbleAmp = Math.random() * 1.5 + 0.5;
    this.wobbleFreq = Math.random() * 0.04 + 0.02;

    // Appearance
    this.color = td.color;
    this.glow = td.glow;
    this.emoji = td.emoji;
    this.score = td.score;
    this.scoreText = td.scoreText;

    // State
    this.alive = true;
    this.popProgress = 0; // 0→1 pop animation
    this.popping = false;
    this.hovered = false;

    // Rope
    this.ropeLen = Math.random() * 20 + 15;

    // Shimmer animation
    this.shimmerOffset = Math.random() * Math.PI * 2;
    this.age = 0;
  }

  _randomType(levelConfig) {
    const roll = Math.random();
    let cumulative = 0;
    for (const name of BALLOON_NAMES) {
      // Increase bomb chance with level
      let chance = BALLOON_TYPES[name].chance;
      if (name === 'bomb') chance = Math.min(0.30, chance + levelConfig.level * 0.015);
      cumulative += chance;
      if (roll < cumulative) return name;
    }
    return 'normal';
  }

  _spawnX(canvasW) {
    if (this.playerSide === 'left')  return Math.random() * (canvasW * 0.5 - 60) + 30;
    if (this.playerSide === 'right') return Math.random() * (canvasW * 0.5 - 60) + canvasW * 0.5 + 30;
    return Math.random() * (canvasW - 100) + 50;
  }

  update(dt) {
    if (!this.alive && !this.popping) return;
    if (this.popping) {
      this.popProgress += dt * 3;
      if (this.popProgress >= 1) { this.popping = false; }
      return;
    }
    this.age += dt;
    this.wobble += this.wobbleFreq;
    this.x += this.vx + Math.sin(this.wobble) * this.wobbleAmp;
    this.y += this.vy;
    // Bounce off side walls
    if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    if (this.x > this.canvasW - this.radius) { this.x = this.canvasW - this.radius; this.vx = -Math.abs(this.vx); }
    // In 2P mode, keep in own half
    if (this.playerSide === 'left'  && this.x > this.canvasW * 0.5 - 10) this.vx = -Math.abs(this.vx);
    if (this.playerSide === 'right' && this.x < this.canvasW * 0.5 + 10) this.vx = Math.abs(this.vx);
  }

  isOffScreen() { return this.y < -this.radius * 3 && !this.popping; }

  pop() {
    if (!this.alive) return;
    this.alive = false;
    this.popping = true;
    this.popProgress = 0;
  }

  checkCollision(fx, fy, hitRadius = 28) {
    if (!this.alive) return false;
    const dx = fx - this.x;
    const dy = fy - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + hitRadius;
  }

  draw(ctx) {
    if (!this.alive && !this.popping) return;
    ctx.save();

    if (this.popping) {
      // Pop burst animation
      const p = this.popProgress;
      ctx.globalAlpha = 1 - p;
      ctx.translate(this.x, this.y);
      ctx.scale(1 + p * 1.5, 1 + p * 1.5);
      // Draw fragments
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        const dist = p * this.radius * 2;
        ctx.save();
        ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.glow;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3 * (1 - p), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    ctx.translate(this.x, this.y);

    // Hover scale effect
    const hoverScale = this.hovered ? 1.1 : 1.0;
    ctx.scale(hoverScale, hoverScale);

    // ── Rope ──
    ctx.beginPath();
    ctx.moveTo(0, this.radius);
    ctx.quadraticCurveTo(5, this.radius + this.ropeLen * 0.6, 2, this.radius + this.ropeLen);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Glow ──
    const shimmer = Math.sin(this.age * 2 + this.shimmerOffset) * 0.15 + 0.85;
    const glowGrad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, this.radius * 1.8);
    glowGrad.addColorStop(0, this.glow + '55');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // ── Balloon body ──
    const bodyGrad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.35, this.radius * 0.1,
                                               0, 0, this.radius);
    bodyGrad.addColorStop(0, '#ffffffbb');
    bodyGrad.addColorStop(0.2, this.color + 'ee');
    bodyGrad.addColorStop(0.7, this.color);
    bodyGrad.addColorStop(1, this.glow + 'aa');
    ctx.shadowColor = this.glow;
    ctx.shadowBlur = 18 * shimmer;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius, this.radius * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Balloon knot ──
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 1.02, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Emoji (type indicator) ──
    ctx.shadowBlur = 0;
    ctx.font = `${this.radius * 0.85}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText(this.emoji, 0, 0);

    ctx.restore();
  }
}

// ── Level Configuration ──────────────────────
const LEVEL_CONFIGS = [
  // Level 1
  { level: 1,  time: 60, balloonSpeed: 1.2, spawnRate: 2200, maxBalloons: 5,  tip: 'Pop balloons with your fingertip!' },
  // Level 2
  { level: 2,  time: 60, balloonSpeed: 1.5, spawnRate: 2000, maxBalloons: 6,  tip: 'Watch out for 💣 bombs!' },
  // Level 3
  { level: 3,  time: 55, balloonSpeed: 1.7, spawnRate: 1800, maxBalloons: 7,  tip: 'Grab ⭐ bonus balloons for big points!' },
  // Level 4
  { level: 4,  time: 55, balloonSpeed: 2.0, spawnRate: 1600, maxBalloons: 8,  tip: '⚡ Speed balloons are worth more!' },
  // Level 5
  { level: 5,  time: 50, balloonSpeed: 2.2, spawnRate: 1500, maxBalloons: 9,  tip: '🌀 Slow-mo helps you catch fast ones!' },
  // Level 6
  { level: 6,  time: 50, balloonSpeed: 2.5, spawnRate: 1300, maxBalloons: 10, tip: 'Go for combos for bonus points!' },
  // Level 7
  { level: 7,  time: 45, balloonSpeed: 2.8, spawnRate: 1200, maxBalloons: 12, tip: 'Stay focused — more bombs incoming!' },
  // Level 8
  { level: 8,  time: 45, balloonSpeed: 3.0, spawnRate: 1100, maxBalloons: 13, tip: 'Double score activated — pop fast!' },
  // Level 9
  { level: 9,  time: 40, balloonSpeed: 3.4, spawnRate: 1000, maxBalloons: 14, tip: 'Almost there! Keep going!' },
  // Level 10
  { level: 10, time: 40, balloonSpeed: 3.8, spawnRate: 850,  maxBalloons: 16, tip: '🔥 FINAL LEVEL — Give it everything!' },
];
