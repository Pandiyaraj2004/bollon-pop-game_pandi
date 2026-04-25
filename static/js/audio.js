/* ============================================
   audio.js — Web Audio API Sound Engine
   All sounds generated procedurally — no files needed!
============================================ */

const AudioEngine = (() => {
  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let soundEnabled = true;
  let musicOscillators = [];
  let musicPlaying = false;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.gain.value = 0.15;
      sfxGain.gain.value = 0.5;
      musicGain.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, type, duration, gainVal = 0.4, delay = 0) {
    if (!ctx || !soundEnabled) return;
    resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  // Pop sound — burst of noise + pitch drop
  function playPop() {
    if (!ctx || !soundEnabled) return;
    resume();
    // Short noise burst
    const bufLen = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    gain.gain.setValueAtTime(1.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    src.start();
    src.stop(ctx.currentTime + 0.15);
    // Pitch chirp
    playTone(600, 'sine', 0.1, 0.3);
    playTone(300, 'sine', 0.08, 0.2, 0.05);
  }

  // Bomb explosion
  function playBomb() {
    if (!ctx || !soundEnabled) return;
    resume();
    const bufLen = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    gain.gain.setValueAtTime(2.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    src.start();
    src.stop(ctx.currentTime + 0.45);
  }

  // Bonus / power-up chime
  function playBonus() {
    if (!ctx || !soundEnabled) return;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => playTone(freq, 'sine', 0.2, 0.4, i * 0.1));
  }

  // Combo sound — ascending arpeggio
  function playCombo(count) {
    if (!ctx || !soundEnabled) return;
    const base = 440 + count * 60;
    playTone(base, 'triangle', 0.15, 0.5);
    playTone(base * 1.25, 'triangle', 0.15, 0.4, 0.1);
  }

  // Level complete fanfare
  function playLevelComplete() {
    if (!ctx || !soundEnabled) return;
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((freq, i) => playTone(freq, 'sine', 0.25, 0.4, i * 0.12));
  }

  // Game over
  function playGameOver() {
    if (!ctx || !soundEnabled) return;
    const sad = [440, 415, 392, 349];
    sad.forEach((freq, i) => playTone(freq, 'sawtooth', 0.4, 0.3, i * 0.2));
  }

  // Countdown beep
  function playCountdown(num) {
    if (!ctx || !soundEnabled) return;
    if (num === 0) {
      playTone(880, 'sine', 0.3, 0.6);
      playTone(1100, 'sine', 0.3, 0.5, 0.1);
    } else {
      playTone(440, 'sine', 0.15, 0.4);
    }
  }

  // Background music — simple procedural loop
  function startMusic() {
    if (!ctx || !soundEnabled || musicPlaying) return;
    musicPlaying = true;
    const notes = [130.8, 164.8, 196.0, 261.6, 196.0, 164.8]; // C3 E3 G3 C4 sequence
    let noteIdx = 0;
    function playNextNote() {
      if (!musicPlaying || !soundEnabled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(musicGain);
      osc.type = 'triangle';
      osc.frequency.value = notes[noteIdx % notes.length];
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      noteIdx++;
      setTimeout(playNextNote, 480);
    }
    playNextNote();
  }

  function stopMusic() {
    musicPlaying = false;
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (!soundEnabled) stopMusic();
    else startMusic();
    return soundEnabled;
  }

  return { init, playPop, playBomb, playBonus, playCombo, playLevelComplete, playGameOver, playCountdown, startMusic, stopMusic, toggleSound, get enabled() { return soundEnabled; } };
})();
