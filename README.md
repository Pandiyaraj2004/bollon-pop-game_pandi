# 🎈 Virtual Balloon Pop Multiplayer Game

A real-time hand-tracking balloon popping game using MediaPipe, Flask, and the Web Audio API.

---

## 🚀 Quick Start

### 1. Install Python dependencies
```bash
pip install flask
```
*(No other Python packages needed — MediaPipe runs in the browser via CDN)*

### 2. Run the server
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

> **Important:** Use **Google Chrome** or **Edge** for best MediaPipe hand tracking performance.

---

## 🎮 How to Play

1. Open the game in Chrome
2. Select **Single Player** or **Two Player**
3. Enter player name(s)
4. Allow camera access when prompted
5. **Move your hand** in front of the camera
6. **Touch balloons** with your index fingertip to pop them!

### Balloon Types
| Balloon | Points | Effect |
|---------|--------|--------|
| 🎈 Normal | +10 | Standard balloon |
| ⚡ Speed | +20 | Moves faster, worth more |
| 💣 Bomb | -30 | Lose score AND a life! |
| ⭐ Bonus | +50 | Big points! |
| 🌀 Slow-mo | — | Activates slow motion for 5s |
| ✖️ Double | — | 2x score for 8s |

---

## 🕹️ Controls

| Action | Key |
|--------|-----|
| Pause / Resume | `P` or `Esc` |
| Toggle Sound | `M` |
| Fullscreen | `F` |

### Mouse Fallback
If your camera isn't available, **move your mouse** to aim at balloons. They pop on hover (within 30px radius).

---

## 🏗️ Project Structure

```
balloon_pop/
├── app.py                    # Flask server
├── requirements.txt          # Python dependencies
├── templates/
│   ├── index.html            # Mode selection screen
│   └── game.html             # Main game screen
└── static/
    ├── css/
    │   ├── style.css          # Shared styles
    │   ├── menu.css           # Menu screen styles
    │   └── game.css           # Game HUD & overlay styles
    └── js/
        ├── menu.js            # Menu animations & navigation
        ├── audio.js           # Web Audio API sound engine
        ├── balloons.js        # Balloon types, physics & rendering
        ├── handtracking.js    # MediaPipe hand tracking wrapper
        └── game.js            # Core game engine
```

---

## ✨ Features

- **Real-time hand tracking** via MediaPipe Hands (runs 100% in browser)
- **Camera feed as game background** (mirrored, darkened)
- **Hand skeleton visualization** with fingertip reticle
- **10 progressive levels** with increasing speed and difficulty
- **6 balloon types** including power-ups and bombs
- **Combo scoring** system
- **Procedural audio** — all sounds generated via Web Audio API (no audio files needed!)
- **Split-screen 2-player mode** — each player controls their half
- **Mouse/touch fallback** when no camera is available
- **Fullscreen support**
- **Animated menus** with floating balloons and particles

---

## 🔧 Tips for Best Performance

- Use a **well-lit room** — MediaPipe needs good lighting
- Keep your hand **30–80 cm from camera**
- Use a **solid background** (wall) behind you
- Chrome or Edge recommended for best WebRTC + WebGL performance

---

## 📱 Browser Compatibility

| Browser | Hand Tracking | Mouse Fallback |
|---------|--------------|----------------|
| Chrome 88+ | ✅ Full | ✅ |
| Edge 88+ | ✅ Full | ✅ |
| Firefox | ⚠️ Partial | ✅ |
| Safari | ❌ Limited | ✅ |
