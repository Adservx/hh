# Angry Birds Clone

A small browser-based Angry Birds–style game built with HTML5 Canvas and [Matter.js](https://brm.io/matter-js/) for physics. No build step, no external assets — open `index.html` and play.

## Play locally

Any static server works. Examples:

```bash
# Python 3
python3 -m http.server 8080

# Node (if installed)
npx http-server -p 8080
```

Then open <http://localhost:8080>.

## Controls

- **Drag** the bird back on the slingshot, then **release** to launch.
- **Reset Level** restarts the current level.
- **Sound** toggles SFX (mute/unmute).

## Gameplay

- Each level has a fixed number of birds. Knock out **all the green pigs** before you run out.
- **Wood** blocks break easily; **stone** blocks take much more punishment.
- You earn:
  - 5,000 points per pig killed
  - 500 points per block destroyed
  - 10,000 bonus points for every unused bird at the end of the level
- Beat all four levels to roll the credits (and start over with a fresh score).

## Project structure

```
.
├── index.html       # markup, HUD, overlay, controls
├── style.css        # theming + responsive layout
├── game.js          # game logic (single file, no build)
├── vendor/
│   └── matter.min.js  # Matter.js physics engine (vendored)
└── README.md
```

## Tech

- Pure ES2020 in a single IIFE (`game.js`) — no bundler required.
- Physics by Matter.js (vendored, MIT licensed).
- Sounds are synthesized at runtime via the WebAudio API — no audio files.
- Sprites are drawn procedurally on `<canvas>` — no image assets.

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Pointer Events and
WebAudio are required.
