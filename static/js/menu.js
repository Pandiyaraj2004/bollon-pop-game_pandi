/* ============================================
   menu.js — Mode Selection Logic
============================================ */

// Create animated background particles
function createParticles() {
  const container = document.getElementById('bgParticles');
  const colors = ['#00d4ff', '#ff006e', '#bf00ff', '#ffd700', '#39ff14'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 8 + 2;
    p.style.cssText = `
      width: ${size}px; height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(p);
  }
}

// Create floating decorative balloons in background
function createBgBalloons() {
  const container = document.getElementById('bgBalloons');
  const balloonTypes = ['🎈', '🎉', '🎊', '🎁'];
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('div');
    b.style.cssText = `
      position: absolute;
      font-size: ${Math.random() * 30 + 20}px;
      left: ${Math.random() * 100}%;
      bottom: -60px;
      animation: floatParticle ${Math.random() * 20 + 15}s linear infinite;
      animation-delay: ${Math.random() * 15}s;
      opacity: 0.15;
      pointer-events: none;
    `;
    b.textContent = balloonTypes[Math.floor(Math.random() * balloonTypes.length)];
    container.appendChild(b);
  }
}

function selectMode(mode) {
  if (mode === 'single') {
    document.getElementById('singleModal').classList.add('active');
    document.getElementById('spName').focus();
  } else {
    document.getElementById('nameModal').classList.add('active');
    document.getElementById('p1Name').focus();
  }
}

function closeModal() {
  document.getElementById('nameModal').classList.remove('active');
}
function closeSingleModal() {
  document.getElementById('singleModal').classList.remove('active');
}

function startSinglePlayer() {
  const name = document.getElementById('spName').value.trim() || 'Player 1';
  window.location.href = `/game?mode=single&p1=${encodeURIComponent(name)}`;
}

function startTwoPlayer() {
  const p1 = document.getElementById('p1Name').value.trim() || 'Player 1';
  const p2 = document.getElementById('p2Name').value.trim() || 'Player 2';
  window.location.href = `/game?mode=two&p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// Enter key on inputs
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('nameModal').classList.contains('active')) startTwoPlayer();
    if (document.getElementById('singleModal').classList.contains('active')) startSinglePlayer();
  }
  if (e.key === 'Escape') {
    closeModal();
    closeSingleModal();
  }
});

// Init
createParticles();
createBgBalloons();
