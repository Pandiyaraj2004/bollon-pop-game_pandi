/* ============================================
   handtracking.js — MediaPipe Hand Tracking
   FIXED:
   - Camera frame ALWAYS drawn to bgCanvas every rAF
   - Hand skeleton drawn to handCanvas (overlay)
   - All 5 fingertips used for collision
   - Correct mirroring so screen matches real hand
============================================ */
 
const HandTracker = (() => {
  let handsInstance = null;
  let videoEl = null;
  let bgCanvas = null, bgCtx = null;
  let handCanvas = null, handCtx = null;
  let onDetect = null;
 
  // Latest processed hand data updated by MediaPipe callback
  let latestHandData = [];
  let streaming = false;
 
  // ── Setup canvases ──────────────────────────
  function setupCanvases(video, bg, hand) {
    videoEl = video;
    bgCanvas = bg;
    bgCtx = bg.getContext('2d');
    handCanvas = hand;
    handCtx = hand.getContext('2d');
  }
 
  // ── Init MediaPipe Hands ────────────────────
  function init(callback) {
    onDetect = callback;
 
    if (typeof Hands === 'undefined') {
      console.warn('[HandTracker] MediaPipe not loaded — mouse fallback only.');
      return;
    }
 
    handsInstance = new Hands({
      locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
 
    handsInstance.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
      selfieMode: false   // we handle mirroring ourselves
    });
 
    handsInstance.onResults(onResults);
    console.log('[HandTracker] MediaPipe Hands initialized.');
  }
 
  // ── Start Camera via getUserMedia ───────────
  // We own the loop so we can guarantee camera is
  // drawn to bgCanvas on EVERY animation frame —
  // not only when MediaPipe fires its callback.
  function startCamera(videoElement) {
    navigator.mediaDevices.getUserMedia({
      video: {
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
      }
    })
    .then(stream => {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resizeCanvases();
        streaming = true;
        console.log('[HandTracker] Camera streaming.');
        runLoop(videoElement);
      };
    })
    .catch(err => {
      console.error('[HandTracker] Camera error:', err);
      alert(
        'Camera access denied or unavailable.\n' +
        'You can still play using your mouse cursor!\n\n' +
        'Error: ' + err.message
      );
    });
  }
 
  // ── Main rAF Loop ───────────────────────────
  // Every frame:
  //   1. Draw mirrored video → bgCanvas   (always)
  //   2. Send frame → MediaPipe           (every frame)
  //   3. MediaPipe calls onResults async  (whenever ready)
  //   4. onResults updates handCanvas + latestHandData
  function runLoop(vid) {
    async function tick() {
      if (streaming) {
        // ① Always paint camera to background
        paintBackground(vid);
 
        // ② Feed frame into MediaPipe
        if (handsInstance && vid.readyState >= 2) {
          try {
            await handsInstance.send({ image: vid });
          } catch (_) {
            // MediaPipe still initializing — safe to ignore
          }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
 
  // ── Paint mirrored video to bgCanvas ────────
  function paintBackground(source) {
    if (!bgCtx || bgCanvas.width === 0 || bgCanvas.height === 0) return;
    bgCtx.save();
    // Flip horizontally so it acts like a mirror
    bgCtx.translate(bgCanvas.width, 0);
    bgCtx.scale(-1, 1);
    bgCtx.drawImage(source, 0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.restore();
  }
 
  // ── MediaPipe Results ────────────────────────
  // Fires every time MediaPipe finishes processing a frame.
  function onResults(results) {
    // Clear hand canvas
    if (handCtx) {
      handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }
 
    latestHandData = [];
 
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (onDetect) onDetect([]);
      return;
    }
 
    const W = handCanvas.width;
    const H = handCanvas.height;
 
    results.multiHandLandmarks.forEach((rawLandmarks, i) => {
      const label = results.multiHandedness[i].label; // 'Left'|'Right' from camera
 
      // Mirror x so landmarks align with the mirrored video
      const lms = rawLandmarks.map(lm => ({
        x: (1.0 - lm.x) * W,
        y: lm.y * H,
        z: lm.z
      }));
 
      // Fingertip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
      const TIP_IDX = [4, 8, 12, 16, 20];
      const tips = TIP_IDX.map(idx => lms[idx]);
      const indexTip = lms[8]; // primary pointer
 
      const screenSide = indexTip.x < W / 2 ? 'left' : 'right';
 
      latestHandData.push({ label, landmarks: lms, tips, indexTip, screenSide });
 
      // Draw on overlay
      drawSkeleton(lms, label);
      drawFingertipReticles(tips, indexTip, label);
    });
 
    if (onDetect) onDetect(latestHandData);
  }
 
  // ── Skeleton Connections ─────────────────────
  const CONN = [
    [0,1],[1,2],[2,3],[3,4],           // thumb
    [0,5],[5,6],[6,7],[7,8],           // index
    [0,9],[9,10],[10,11],[11,12],      // middle
    [0,13],[13,14],[14,15],[15,16],    // ring
    [0,17],[17,18],[18,19],[19,20],    // pinky
    [5,9],[9,13],[13,17],[0,17],[0,5]  // palm
  ];
 
  function drawSkeleton(lms, label) {
    if (!handCtx) return;
    // Right from camera (appears on left of mirrored view) → cyan
    // Left from camera (appears on right) → pink
    const boneColor  = label === 'Right'
      ? 'rgba(0,212,255,0.9)'
      : 'rgba(255,60,160,0.9)';
    const tipColor   = label === 'Right' ? '#00d4ff' : '#ff3ca0';
 
    handCtx.save();
    handCtx.lineCap = 'round';
 
    // Bones
    handCtx.strokeStyle = boneColor;
    handCtx.lineWidth = 3;
    handCtx.shadowColor = boneColor;
    handCtx.shadowBlur = 10;
    CONN.forEach(([a, b]) => {
      handCtx.beginPath();
      handCtx.moveTo(lms[a].x, lms[a].y);
      handCtx.lineTo(lms[b].x, lms[b].y);
      handCtx.stroke();
    });
 
    // Joints
    lms.forEach((lm, idx) => {
      const isTip = [4,8,12,16,20].includes(idx);
      handCtx.shadowBlur = isTip ? 18 : 8;
      handCtx.beginPath();
      handCtx.arc(lm.x, lm.y, isTip ? 7 : 4, 0, Math.PI * 2);
      handCtx.fillStyle = '#ffffff';
      handCtx.fill();
      handCtx.strokeStyle = tipColor;
      handCtx.lineWidth = 2;
      handCtx.stroke();
    });
 
    handCtx.restore();
  }
 
  // ── Fingertip Reticles ───────────────────────
  // Draws a glowing targeting ring on each fingertip.
  // The index finger gets a bigger crosshair so users
  // can precisely see their primary "pop" pointer.
  function drawFingertipReticles(tips, indexTip, label) {
    if (!handCtx) return;
    const color = label === 'Right' ? '#00d4ff' : '#ff3ca0';
 
    tips.forEach((tip, i) => {
      const isIndex = (i === 1); // index finger
      const r = isIndex ? 28 : 14;
 
      handCtx.save();
      handCtx.strokeStyle = color;
      handCtx.lineWidth = isIndex ? 3 : 1.5;
      handCtx.shadowColor = color;
      handCtx.shadowBlur = isIndex ? 22 : 10;
 
      // Outer ring
      handCtx.beginPath();
      handCtx.arc(tip.x, tip.y, r, 0, Math.PI * 2);
      handCtx.stroke();
 
      // Crosshair on index finger only
      if (isIndex) {
        const arm = r + 12;
        handCtx.lineWidth = 2;
        handCtx.shadowBlur = 10;
        [[tip.x - arm, tip.y, tip.x - r - 4, tip.y],
         [tip.x + r + 4, tip.y, tip.x + arm, tip.y],
         [tip.x, tip.y - arm, tip.x, tip.y - r - 4],
         [tip.x, tip.y + r + 4, tip.x, tip.y + arm]
        ].forEach(([x1,y1,x2,y2]) => {
          handCtx.beginPath();
          handCtx.moveTo(x1, y1);
          handCtx.lineTo(x2, y2);
          handCtx.stroke();
        });
      }
 
      // Inner glow dot
      handCtx.fillStyle = isIndex ? '#ffffff' : color;
      handCtx.shadowBlur = 16;
      handCtx.beginPath();
      handCtx.arc(tip.x, tip.y, isIndex ? 5 : 3, 0, Math.PI * 2);
      handCtx.fill();
 
      handCtx.restore();
    });
  }
 
  // ── Resize both canvases ─────────────────────
  function resizeCanvases() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (bgCanvas)   { bgCanvas.width = w;   bgCanvas.height = h;   }
    if (handCanvas) { handCanvas.width = w; handCanvas.height = h; }
  }
 
  // ── Public API ───────────────────────────────
  return {
    init,
    startCamera,
    setupCanvases,
    resizeCanvases,
    getHandData: () => latestHandData,
    get streaming() { return streaming; }
  };
})();
