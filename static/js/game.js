/* ============================================
   game.js — Main Game Engine
   Handles game loop, state, scoring, levels,
   collision detection, UI updates
============================================ */

const GAME = (() => {
  // ── State ────────────────────────────────────
  let state = 'camera'; // camera | countdown | playing | paused | levelComplete | gameOver
  let mode = 'single';  // single | two
  let currentLevel = 0;
  let levelConfig = null;
  let balloons = [];
  let particles = new ParticleSystem();
  let spawnTimer = 0;
  let lastTime = 0;
  let animFrameId = null;

  // Player state
  let players = [];
  // { name, score, lives, combo, comboTimer, lastPopTime, doubleScore, slowmo }

  // Power-up timers
  let slowmoActive = false;
  let slowmoTimer = 0;

  // Hand data from tracker
  let handData = [];

  // Mouse/touch fallback
  let mousePos = { x: -999, y: -999 };
  let mouseActive = false;

  // Canvas refs
  let gameCanvas, gameCtx;

  // Level timer
  let levelTimer = 0;
  let levelTimerMax = 60;

  // ── DOM refs ──────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ─────────────────────────────────────
  function init() {
    mode = GAME_CONFIG.mode;

    // Setup players
    players = [
      { name: GAME_CONFIG.p1, score: 0, lives: 3, combo: 0, comboTimer: 0, lastPopTime: 0, doubleScore: false, slowmo: false }
    ];
    if (mode === 'two') {
      players.push({ name: GAME_CONFIG.p2, score: 0, lives: 3, combo: 0, comboTimer: 0, lastPopTime: 0, doubleScore: false, slowmo: false });
    }

    // Update HUD names
    $('p1NameDisplay').textContent = players[0].name;
    if (mode === 'two') {
      $('p2Hud').style.display = '';
      $('p2NameDisplay').textContent = players[1].name;
      $('splitDivider').classList.add('active');
    } else {
      $('p2Hud').style.display = 'none';
      $('splitDivider').classList.remove('active');
    }

    // Setup game canvas
    gameCanvas = $('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');
    resizeCanvases();

    // Setup hand tracking canvases
    HandTracker.setupCanvases($('inputVideo'), $('bgCanvas'), $('handCanvas'));

    // Show camera permission screen
    showScreen('cameraScreen');

    // Mouse/touch fallback input
    setupMouseFallback();

    // Window resize
    window.addEventListener('resize', resizeCanvases);

    // Init audio
    AudioEngine.init();
  }

  function resizeCanvases() {
    const w = window.innerWidth, h = window.innerHeight;
    gameCanvas.width = w;
    gameCanvas.height = h;
    HandTracker.resizeCanvases();
  }

  // ── Camera Request ────────────────────────────
  function requestCamera() {
    HandTracker.init(onHandDetected);
    HandTracker.startCamera($('inputVideo'));

    // Give camera time to start
    setTimeout(() => {
      hideScreen('cameraScreen');
      AudioEngine.startMusic();
      startLevel(0);
    }, 1800);
  }

  // ── Hand Detection Callback ───────────────────
  function onHandDetected(data) {
    handData = data;
  }

  // ── Mouse / Touch Fallback ────────────────────
  function setupMouseFallback() {
    const wrapper = $('gameWrapper');
    wrapper.addEventListener('mousemove', e => {
      mousePos = { x: e.clientX, y: e.clientY };
      mouseActive = true;
    });
    wrapper.addEventListener('touchmove', e => {
      const t = e.touches[0];
      mousePos = { x: t.clientX, y: t.clientY };
      mouseActive = true;
      e.preventDefault();
    }, { passive: false });
    wrapper.addEventListener('mouseleave', () => { mouseActive = false; });
  }

  // ── Level Management ──────────────────────────
  function startLevel(levelIdx) {
    currentLevel = Math.min(levelIdx, LEVEL_CONFIGS.length - 1);
    levelConfig = LEVEL_CONFIGS[currentLevel];
    balloons = [];
    spawnTimer = 0;
    levelTimer = levelConfig.time;
    levelTimerMax = levelConfig.time;

    // Reset player combos
    players.forEach(p => { p.combo = 0; p.comboTimer = 0; });

    updateHUD();
    showCountdown();
  }

  function showCountdown() {
    state = 'countdown';
    $('countdownLevel').textContent = `LEVEL ${currentLevel + 1}`;
    $('countdownTip').textContent = levelConfig.tip;
    showScreen('countdownScreen');

    let count = 3;
    $('countdownNum').textContent = count;
    AudioEngine.playCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        $('countdownNum').textContent = 'GO!';
        AudioEngine.playCountdown(0);
        setTimeout(() => {
          hideScreen('countdownScreen');
          state = 'playing';
          lastTime = performance.now();
          requestAnimationFrame(gameLoop);
        }, 700);
      } else {
        $('countdownNum').textContent = count;
        AudioEngine.playCountdown(count);
      }
    }, 1000);
  }

  function nextLevel() {
    hideScreen('levelCompleteScreen');
    if (currentLevel + 1 >= LEVEL_CONFIGS.length) {
      // All levels complete — show final win
      showGameOver(true);
    } else {
      startLevel(currentLevel + 1);
    }
  }

  // ── Main Game Loop ────────────────────────────
  function gameLoop(timestamp) {
    if (state !== 'playing') return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Power-up timers
    updatePowerups(dt);

    // Level timer
    levelTimer -= dt;
    if (levelTimer <= 0) {
      levelTimer = 0;
      onLevelEnd();
      return;
    }

    // Spawn balloons
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0 && balloons.length < levelConfig.maxBalloons) {
      spawnBalloon();
      spawnTimer = levelConfig.spawnRate * (slowmoActive ? 1.5 : 1.0);
    }

    // Update balloons
    const dtMod = slowmoActive ? dt * 0.4 : dt;
    balloons.forEach(b => b.update(dtMod));
    particles.update();

    // Remove off-screen balloons
    balloons = balloons.filter(b => !b.isOffScreen());

    // Collision detection
    detectCollisions();

    // Update combo timers
    players.forEach(p => {
      if (p.combo > 0) {
        p.comboTimer -= dt;
        if (p.comboTimer <= 0) { p.combo = 0; updateComboUI(p, 0); }
      }
    });

    // Draw everything
    draw();

    // Update HUD
    updateTimerHUD();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  // ── Balloon Spawning ──────────────────────────
  function spawnBalloon() {
    const cW = gameCanvas.width, cH = gameCanvas.height;
    const config = { canvasW: cW, canvasH: cH };

    if (mode === 'two') {
      // Spawn one balloon per side
      balloons.push(new Balloon(config, levelConfig, 'left'));
      balloons.push(new Balloon(config, levelConfig, 'right'));
    } else {
      balloons.push(new Balloon(config, levelConfig, 'both'));
    }
  }

  // ── Collision Detection ───────────────────────
  function detectCollisions() {
    // Build list of pointers: each has {x, y, playerIdx}
    const pointers = getPointers();

    for (const balloon of balloons) {
      if (!balloon.alive) continue;

      for (const ptr of pointers) {
        // In 2P mode, validate player can only pop in their half
        if (mode === 'two') {
          const halfW = gameCanvas.width / 2;
          if (ptr.playerIdx === 0 && balloon.playerSide === 'right') continue;
          if (ptr.playerIdx === 1 && balloon.playerSide === 'left') continue;
        }

        if (balloon.checkCollision(ptr.x, ptr.y, 30)) {
          popBalloon(balloon, ptr.playerIdx);
          break;
        }
      }
    }
  }

  function getPointers() {
    const pointers = [];

    // ── Hand tracking pointers ──
    if (handData.length > 0) {
      handData.forEach((hand, i) => {
        const tip = hand.indexTip;
        // Assign to player based on screen side in 2P
        let pidx = 0;
        if (mode === 'two') {
          pidx = tip.x < gameCanvas.width / 2 ? 0 : 1;
        }
        pointers.push({ x: tip.x, y: tip.y, playerIdx: pidx });
      });
    } else if (mouseActive) {
      // Mouse fallback
      pointers.push({ x: mousePos.x, y: mousePos.y, playerIdx: 0 });
    }

    return pointers;
  }

  // ── Pop Balloon ───────────────────────────────
  function popBalloon(balloon, playerIdx) {
    const player = players[playerIdx] || players[0];
    const now = performance.now();

    // Emit particles
    particles.emit(balloon.x, balloon.y, balloon.color, 16);

    // Handle type effects
    if (balloon.type === 'bomb') {
      // Bomb: lose score and life
      player.score = Math.max(0, player.score + balloon.score);
      player.lives = Math.max(0, player.lives - 1);
      player.combo = 0;
      AudioEngine.playBomb();
      showFloatText(balloon.x, balloon.y, balloon.scoreText, '#ff4444');
      // Screen shake
      shakeCanvas();
      if (player.lives <= 0) { onPlayerDead(playerIdx); }
    } else if (balloon.type === 'slowmo') {
      // Slow-motion power-up
      activatePowerup('slowmo', player, playerIdx);
      AudioEngine.playBonus();
      showFloatText(balloon.x, balloon.y, '🌀 SLOW MO!', '#bf00ff');
    } else if (balloon.type === 'double') {
      // Double score power-up
      activatePowerup('double', player, playerIdx);
      AudioEngine.playBonus();
      showFloatText(balloon.x, balloon.y, '✖️ 2X SCORE!', '#39ff14');
    } else {
      // Normal scoring
      let pts = balloon.score;
      if (player.doubleScore) pts *= 2;

      // Combo bonus
      const timeSinceLastPop = now - player.lastPopTime;
      if (timeSinceLastPop < 1200) {
        player.combo++;
        player.comboTimer = 1.5;
        if (player.combo >= 3) {
          pts += Math.floor(player.combo * 5);
          AudioEngine.playCombo(player.combo);
        }
      } else {
        player.combo = 1;
        player.comboTimer = 1.5;
        AudioEngine.playPop();
      }
      player.lastPopTime = now;

      if (balloon.type === 'bonus') AudioEngine.playBonus();
      else if (balloon.type !== 'normal') AudioEngine.playPop();

      player.score += pts;
      const scoreStr = pts > 0 ? `+${pts}` : `${pts}`;
      const scoreColor = pts >= 50 ? '#ffd700' : pts >= 20 ? '#00d4ff' : '#ffffff';
      showFloatText(balloon.x, balloon.y, scoreStr, scoreColor);
      updateComboUI(player, player.combo, playerIdx);
    }

    balloon.pop();
    updateHUD();
  }

  // ── Power-ups ─────────────────────────────────
  function activatePowerup(type, player, playerIdx) {
    if (type === 'slowmo') {
      slowmoActive = true;
      slowmoTimer = 5.0;
      showPowerupToast('🌀 SLOW MOTION — 5 sec');
    } else if (type === 'double') {
      player.doubleScore = true;
      setTimeout(() => { player.doubleScore = false; }, 8000);
      const name = players[playerIdx].name;
      showPowerupToast(`✖️ 2X SCORE for ${name} — 8 sec`);
    }
  }

  function updatePowerups(dt) {
    if (slowmoActive) {
      slowmoTimer -= dt;
      if (slowmoTimer <= 0) { slowmoActive = false; }
    }
  }

  // ── Level End ─────────────────────────────────
  function onLevelEnd() {
    state = 'levelComplete';
    AudioEngine.playLevelComplete();

    const isLast = currentLevel + 1 >= LEVEL_CONFIGS.length;
    $('levelCompleteTitle').textContent = isLast ? '🏆 All Levels Complete!' : `🎊 Level ${currentLevel + 1} Complete!`;
    $('nextLevelBtn').textContent = isLast ? '🏁 See Final Score' : '➡ Next Level';

    // Stats
    const stats = $('levelStats');
    if (mode === 'single') {
      stats.innerHTML = `
        <div class="stat-row"><span class="stat-label">Score</span><span class="stat-val">${players[0].score}</span></div>
        <div class="stat-row"><span class="stat-label">Lives Remaining</span><span class="stat-val">${'❤️'.repeat(players[0].lives)}</span></div>
        <div class="stat-row"><span class="stat-label">Level</span><span class="stat-val">${currentLevel + 1} / ${LEVEL_CONFIGS.length}</span></div>
      `;
    } else {
      const leader = players[0].score > players[1].score ? players[0] : players[0].score < players[1].score ? players[1] : null;
      stats.innerHTML = `
        <div class="stat-row"><span class="stat-label">🔵 ${players[0].name}</span><span class="stat-val">${players[0].score} pts</span></div>
        <div class="stat-row"><span class="stat-label">🔴 ${players[1].name}</span><span class="stat-val">${players[1].score} pts</span></div>
        <div class="stat-row"><span class="stat-label">Leading</span><span class="stat-val">${leader ? leader.name : 'Tie!'}</span></div>
      `;
    }
    showScreen('levelCompleteScreen');
  }

  function onPlayerDead(playerIdx) {
    // In single player: game over if no lives
    if (mode === 'single' && players[0].lives <= 0) {
      setTimeout(() => showGameOver(false), 500);
    }
    // In 2P: continue until timer ends
  }

  function showGameOver(win) {
    state = 'gameOver';
    if (animFrameId) cancelAnimationFrame(animFrameId);
    AudioEngine.stopMusic();
    AudioEngine.playGameOver();

    const icon = $('gameOverIcon');
    const title = $('gameOverTitle');

    if (mode === 'single') {
      icon.textContent = win ? '🏆' : '💥';
      title.textContent = win ? 'You Win!' : 'Game Over!';
      $('finalStats').innerHTML = `
        <div class="stat-row"><span class="stat-label">Final Score</span><span class="stat-val">${players[0].score}</span></div>
        <div class="stat-row"><span class="stat-label">Levels Completed</span><span class="stat-val">${currentLevel + 1}</span></div>
        <div class="stat-row"><span class="stat-label">Lives Remaining</span><span class="stat-val">${'❤️'.repeat(Math.max(0, players[0].lives))}</span></div>
      `;
    } else {
      const p1 = players[0], p2 = players[1];
      const winner = p1.score > p2.score ? p1 : p2.score > p1.score ? p2 : null;
      icon.textContent = winner ? '🏆' : '🤝';
      title.textContent = winner ? `${winner.name} Wins!` : "It's a Tie!";
      $('finalStats').innerHTML = `
        <div class="stat-row"><span class="stat-label">🔵 ${p1.name}</span><span class="stat-val">${p1.score} pts</span></div>
        <div class="stat-row"><span class="stat-label">🔴 ${p2.name}</span><span class="stat-val">${p2.score} pts</span></div>
        <div class="stat-row"><span class="stat-label">Difference</span><span class="stat-val">${Math.abs(p1.score - p2.score)} pts</span></div>
      `;
    }
    showScreen('gameOverScreen');
  }

  // ── Draw ──────────────────────────────────────
  function draw() {
    const ctx = gameCtx;
    const W = gameCanvas.width, H = gameCanvas.height;
    ctx.clearRect(0, 0, W, H);

    // 2P mode: subtle half tinting
    if (mode === 'two') {
      ctx.fillStyle = 'rgba(0, 212, 255, 0.04)';
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = 'rgba(255, 0, 110, 0.04)';
      ctx.fillRect(W / 2, 0, W / 2, H);
    }

    // Draw balloons
    balloons.forEach(b => b.draw(ctx));

    // Draw particles
    particles.draw(ctx);

    // Slowmo overlay
    if (slowmoActive) {
      ctx.fillStyle = `rgba(100, 0, 200, ${0.08 + Math.sin(performance.now() / 200) * 0.03})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(180, 100, 255, 0.05)';
      ctx.fillRect(0, 0, W, H);
    }

    // Draw mouse cursor (if using mouse fallback)
    if (mouseActive && handData.length === 0) {
      drawMouseCursor(ctx, mousePos.x, mousePos.y);
    }
  }

  function drawMouseCursor(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Canvas shake effect ───────────────────────
  let shakeOffset = { x: 0, y: 0 };
  let shakeDuration = 0;
  function shakeCanvas() {
    shakeDuration = 0.3;
    const wrapper = document.getElementById('gameWrapper');
    wrapper.style.animation = 'none';
    void wrapper.offsetWidth; // reflow
    wrapper.style.animation = '';
    // Quick shake via transform
    let elapsed = 0;
    const shakeInterval = setInterval(() => {
      elapsed += 0.05;
      const x = (Math.random() - 0.5) * 12;
      const y = (Math.random() - 0.5) * 12;
      wrapper.style.transform = `translate(${x}px, ${y}px)`;
      if (elapsed >= shakeDuration) {
        clearInterval(shakeInterval);
        wrapper.style.transform = '';
      }
    }, 50);
  }

  // ── HUD Updates ───────────────────────────────
  function updateHUD() {
    $('p1Score').textContent = players[0].score.toLocaleString();
    $('p1Lives').textContent = '❤️'.repeat(Math.max(0, players[0].lives));
    $('levelDisplay').textContent = currentLevel + 1;

    if (mode === 'two' && players[1]) {
      $('p2Score').textContent = players[1].score.toLocaleString();
      $('p2Lives').textContent = '❤️'.repeat(Math.max(0, players[1].lives));
    }

    // Level progress bar
    const progress = Math.min(100, ((levelTimerMax - levelTimer) / levelTimerMax) * 100);
    $('levelProgress').style.width = progress + '%';
  }

  function updateTimerHUD() {
    const t = Math.ceil(Math.max(0, levelTimer));
    $('timerText').textContent = t;

    // Timer ring
    const circ = 163; // 2*pi*26
    const pct = levelTimer / levelTimerMax;
    const offset = circ - circ * pct;
    $('timerCircle').style.strokeDashoffset = offset;

    // Color based on urgency
    const color = t <= 10 ? '#ff4444' : t <= 20 ? '#ffd700' : '#00d4ff';
    $('timerCircle').style.stroke = color;
    $('timerText').style.color = t <= 10 ? '#ff4444' : '#fff';
  }

  function updateComboUI(player, combo, playerIdx = 0) {
    const el = $( playerIdx === 0 ? 'p1Combo' : 'p2Combo');
    if (!el) return;
    if (combo >= 3) {
      el.textContent = `🔥 x${combo} COMBO!`;
    } else if (combo >= 2) {
      el.textContent = `⚡ x${combo} COMBO`;
    } else {
      el.textContent = '';
    }
  }

  // ── Float Text ────────────────────────────────
  function showFloatText(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    $('floatContainer').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ── Power-up Toast ─────────────────────────────
  let toastTimeout = null;
  function showPowerupToast(msg) {
    const toast = $('powerupToast');
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ── Screen helpers ────────────────────────────
  function showScreen(id) {
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }
  function hideScreen(id) {
    const el = $(id);
    if (el) el.classList.add('hidden');
  }

  // ── Controls ──────────────────────────────────
  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      cancelAnimationFrame(animFrameId);
      showScreen('pauseScreen');
      $('btnPause').textContent = '▶ Resume';
    } else if (state === 'paused') {
      state = 'playing';
      hideScreen('pauseScreen');
      $('btnPause').textContent = '⏸ Pause';
      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
    }
  }

  function restart() {
    hideScreen('pauseScreen');
    hideScreen('gameOverScreen');
    hideScreen('levelCompleteScreen');
    players.forEach(p => { p.score = 0; p.lives = 3; p.combo = 0; p.doubleScore = false; });
    slowmoActive = false;
    AudioEngine.startMusic();
    $('btnPause').textContent = '⏸ Pause';
    startLevel(0);
  }

  function toggleSound() {
    const on = AudioEngine.toggleSound();
    $('btnSound').textContent = on ? '🔊' : '🔇';
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      $('btnFullscreen').textContent = '⛶';
    } else {
      document.exitFullscreen();
    }
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });

  // Auto-start on load
  window.addEventListener('load', init);

  // Public API
  return { requestCamera, togglePause, restart, toggleSound, toggleFullscreen, nextLevel };
})();
