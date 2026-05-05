/* Angry Birds–style physics game built on Matter.js.
 * No external sprites — everything is drawn with Canvas 2D.
 */
(() => {
  const {
    Engine, World, Bodies, Body, Composite, Constraint, Events,
    Vector, Query
  } = Matter;

  // ---------- Constants ----------
  const WORLD_W = 1600;          // virtual world width
  const WORLD_H = 900;           // virtual world height
  const GROUND_H = 80;
  const SLING_X = 220;
  const SLING_Y = WORLD_H - GROUND_H - 180;
  const SLING_MAX_PULL = 180;
  const LAUNCH_POWER = 0.22;
  const BIRD_RADIUS = 28;
  const PIG_RADIUS = 30;
  const DAMAGE_THRESHOLD = 3;    // impact speed needed to register damage
  const PIG_KILL_DAMAGE = 16;    // total damage a pig can absorb
  const WOOD_HP = 14;
  const STONE_HP = 36;
  const SCORE_PIG = 5000;
  const SCORE_BLOCK = 500;
  const SCORE_BIRD_LEFT = 10000;

  // ---------- Canvas / scaling ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let viewScale = 1;
  let viewOffsetX = 0;
  let viewOffsetY = 0;

  function resize() {
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit world into view, keeping aspect; letterbox vertically if needed.
    const sx = w / WORLD_W;
    const sy = h / WORLD_H;
    viewScale = Math.min(sx, sy);
    viewOffsetX = (w - WORLD_W * viewScale) / 2;
    viewOffsetY = (h - WORLD_H * viewScale) / 2;
  }
  window.addEventListener('resize', resize);

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - viewOffsetX) / viewScale;
    const y = (clientY - rect.top  - viewOffsetY) / viewScale;
    return { x, y };
  }

  // ---------- Engine ----------
  const engine = Engine.create();
  engine.world.gravity.y = 1;
  engine.timing.timeScale = 1;
  const world = engine.world;

  // Ground + walls
  const ground = Bodies.rectangle(WORLD_W / 2, WORLD_H - GROUND_H / 2, WORLD_W * 4, GROUND_H, {
    isStatic: true, label: 'ground', friction: 0.9, restitution: 0.05
  });
  const leftWall  = Bodies.rectangle(-200, WORLD_H / 2, 400, WORLD_H * 2, { isStatic: true });
  const rightWall = Bodies.rectangle(WORLD_W + 200, WORLD_H / 2, 400, WORLD_H * 2, { isStatic: true });
  const ceiling   = Bodies.rectangle(WORLD_W / 2, -400, WORLD_W * 2, 200, { isStatic: true });
  World.add(world, [ground, leftWall, rightWall, ceiling]);

  // ---------- Game state ----------
  const state = {
    levelIndex: 0,
    score: 0,
    birdsRemaining: 0,
    activeBird: null,
    sling: null,
    aiming: false,
    aimPos: { x: SLING_X, y: SLING_Y },
    pigs: [],
    blocks: [],
    levelObjects: [],
    awaitingNextBird: false,
    levelDone: false,
    muted: false,
    cameraX: 0,
    targetCameraX: 0
  };

  // ---------- Levels ----------
  function L_block(x, y, w, h, mat = 'wood') {
    return { kind: 'block', x, y, w, h, mat };
  }
  function L_pig(x, y, r = PIG_RADIUS) {
    return { kind: 'pig', x, y, r };
  }

  function buildTower(baseX, baseY) {
    const out = [];
    // Two vertical wood pillars
    out.push(L_block(baseX, baseY - 60, 24, 120, 'wood'));
    out.push(L_block(baseX + 90, baseY - 60, 24, 120, 'wood'));
    // Roof
    out.push(L_block(baseX + 45, baseY - 130, 130, 20, 'wood'));
    return out;
  }

  const LEVELS = [
    {
      name: 'Warm-Up',
      birds: 3,
      objects: [
        ...buildTower(1100, WORLD_H - GROUND_H),
        L_pig(1145, WORLD_H - GROUND_H - 30),
        L_pig(1300, WORLD_H - GROUND_H - 30)
      ]
    },
    {
      name: 'Stone Fort',
      birds: 4,
      objects: [
        L_block(1050, WORLD_H - GROUND_H - 80, 24, 160, 'stone'),
        L_block(1200, WORLD_H - GROUND_H - 80, 24, 160, 'stone'),
        L_block(1125, WORLD_H - GROUND_H - 170, 200, 24, 'stone'),
        L_pig(1125, WORLD_H - GROUND_H - 30),
        L_pig(1125, WORLD_H - GROUND_H - 210),
        L_block(1370, WORLD_H - GROUND_H - 50, 24, 100, 'wood'),
        L_block(1470, WORLD_H - GROUND_H - 50, 24, 100, 'wood'),
        L_block(1420, WORLD_H - GROUND_H - 110, 130, 20, 'wood'),
        L_pig(1420, WORLD_H - GROUND_H - 30)
      ]
    },
    {
      name: 'Tower Trio',
      birds: 4,
      objects: [
        ...buildTower(950, WORLD_H - GROUND_H),
        ...buildTower(1150, WORLD_H - GROUND_H),
        ...buildTower(1350, WORLD_H - GROUND_H),
        L_pig(995, WORLD_H - GROUND_H - 30),
        L_pig(1195, WORLD_H - GROUND_H - 30),
        L_pig(1395, WORLD_H - GROUND_H - 30),
        L_pig(1095, WORLD_H - GROUND_H - 160),
        L_pig(1295, WORLD_H - GROUND_H - 160)
      ]
    },
    {
      name: 'Stacked Up',
      birds: 5,
      objects: [
        // Wide wood platform with stone supports
        L_block(1100, WORLD_H - GROUND_H - 80, 24, 160, 'stone'),
        L_block(1300, WORLD_H - GROUND_H - 80, 24, 160, 'stone'),
        L_block(1200, WORLD_H - GROUND_H - 170, 240, 24, 'wood'),
        // Upper level
        L_block(1140, WORLD_H - GROUND_H - 230, 20, 100, 'wood'),
        L_block(1260, WORLD_H - GROUND_H - 230, 20, 100, 'wood'),
        L_block(1200, WORLD_H - GROUND_H - 290, 160, 20, 'wood'),
        L_pig(1200, WORLD_H - GROUND_H - 200),
        L_pig(1200, WORLD_H - GROUND_H - 320),
        L_pig(1100, WORLD_H - GROUND_H - 30),
        L_pig(1300, WORLD_H - GROUND_H - 30)
      ]
    }
  ];

  // ---------- Build level ----------
  function clearLevel() {
    state.levelObjects.forEach(b => Composite.remove(world, b));
    state.levelObjects = [];
    state.pigs = [];
    state.blocks = [];
    if (state.activeBird) {
      Composite.remove(world, state.activeBird);
      state.activeBird = null;
    }
    if (state.sling) {
      Composite.remove(world, state.sling);
      state.sling = null;
    }
    state.aiming = false;
    state.awaitingNextBird = false;
    state.levelDone = false;
  }

  function loadLevel(i) {
    clearLevel();
    const lvl = LEVELS[Math.min(i, LEVELS.length - 1)];
    state.birdsRemaining = lvl.birds;
    for (const obj of lvl.objects) {
      if (obj.kind === 'block') {
        const hp = obj.mat === 'stone' ? STONE_HP : WOOD_HP;
        const body = Bodies.rectangle(obj.x, obj.y, obj.w, obj.h, {
          density: obj.mat === 'stone' ? 0.005 : 0.0025,
          friction: 0.7,
          frictionStatic: 0.9,
          restitution: 0.1,
          label: 'block',
          render: { fillStyle: obj.mat }
        });
        body.gameType = 'block';
        body.material = obj.mat;
        body.hp = hp;
        body.maxHp = hp;
        body.w = obj.w;
        body.h = obj.h;
        World.add(world, body);
        state.blocks.push(body);
        state.levelObjects.push(body);
      } else if (obj.kind === 'pig') {
        const body = Bodies.circle(obj.x, obj.y, obj.r, {
          density: 0.0015,
          friction: 0.6,
          restitution: 0.3,
          label: 'pig'
        });
        body.gameType = 'pig';
        body.r = obj.r;
        body.damage = 0;
        body.dead = false;
        World.add(world, body);
        state.pigs.push(body);
        state.levelObjects.push(body);
      }
    }
    state.cameraX = 0;
    state.targetCameraX = 0;
    spawnBird();
    updateHUD();
  }

  // ---------- Bird & slingshot ----------
  function spawnBird() {
    if (state.birdsRemaining <= 0) {
      checkEndConditions();
      return;
    }
    const bird = Bodies.circle(SLING_X, SLING_Y, BIRD_RADIUS, {
      density: 0.004,
      friction: 0.5,
      frictionAir: 0.001,
      restitution: 0.45,
      label: 'bird'
    });
    bird.gameType = 'bird';
    bird.launched = false;
    bird.flightImpacts = 0;
    World.add(world, bird);
    state.activeBird = bird;

    const sling = Constraint.create({
      pointA: { x: SLING_X, y: SLING_Y },
      bodyB: bird,
      stiffness: 0.04,
      damping: 0.001,
      length: 0
    });
    World.add(world, sling);
    state.sling = sling;
    state.awaitingNextBird = false;
  }

  function launchBird(vx, vy) {
    if (!state.activeBird) return;
    state.activeBird.launched = true;
    if (state.sling) {
      Composite.remove(world, state.sling);
      state.sling = null;
    }
    Body.setVelocity(state.activeBird, { x: vx, y: vy });
    state.birdsRemaining = Math.max(0, state.birdsRemaining - 1);
    updateHUD();
    playSound('launch');
  }

  // ---------- Input ----------
  // Velocity multiplier for the slingshot. Tuned so a full pull (~180 px) yields
  // a snappy, satisfying launch. We set velocity directly rather than applying
  // force for predictable behavior.
  const LAUNCH_VELOCITY_GAIN = 0.55;

  let dragging = false;

  function onPointerDown(e) {
    if (!state.activeBird || state.activeBird.launched) return;
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    const d = Math.hypot(p.x - SLING_X, p.y - SLING_Y);
    if (d > 240) return;
    dragging = true;
    state.aiming = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragging || !state.activeBird || state.activeBird.launched) return;
    const p = toWorld(e.clientX, e.clientY);
    const dx = p.x - SLING_X;
    const dy = p.y - SLING_Y;
    const dist = Math.hypot(dx, dy);
    let nx = p.x, ny = p.y;
    if (dist > SLING_MAX_PULL) {
      const k = SLING_MAX_PULL / dist;
      nx = SLING_X + dx * k;
      ny = SLING_Y + dy * k;
    }
    // Don't allow pulling forward past the slingshot fork (i.e. toward target).
    if (nx > SLING_X - 10) nx = SLING_X - 10;
    state.aimPos = { x: nx, y: ny };
    Body.setPosition(state.activeBird, state.aimPos);
    Body.setVelocity(state.activeBird, { x: 0, y: 0 });
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    state.aiming = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (!state.activeBird || state.activeBird.launched) return;
    const dx = SLING_X - state.activeBird.position.x;
    const dy = SLING_Y - state.activeBird.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 25) {
      // tiny pull → snap back, don't waste a bird
      Body.setPosition(state.activeBird, { x: SLING_X, y: SLING_Y });
      Body.setVelocity(state.activeBird, { x: 0, y: 0 });
      return;
    }
    launchBird(dx * LAUNCH_VELOCITY_GAIN, dy * LAUNCH_VELOCITY_GAIN);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- Collision damage ----------
  Events.on(engine, 'collisionStart', (evt) => {
    for (const pair of evt.pairs) {
      const { bodyA, bodyB, collision } = pair;
      const speed = Math.max(
        Vector.magnitude(bodyA.velocity),
        Vector.magnitude(bodyB.velocity)
      );
      if (speed < DAMAGE_THRESHOLD) continue;
      handleHit(bodyA, bodyB, speed);
      handleHit(bodyB, bodyA, speed);
    }
  });

  function handleHit(target, hitter, speed) {
    if (!target.gameType) return;
    if (target.gameType === 'block') {
      const dmg = Math.min(22, speed * 1.4);
      target.hp -= dmg;
      if (target.hp <= 0 && !target.destroyed) {
        target.destroyed = true;
        addScore(SCORE_BLOCK);
        playSound('break');
        // Remove on next tick to avoid invalidating iteration
        queueMicrotask(() => {
          if (state.levelObjects.includes(target)) {
            Composite.remove(world, target);
            state.blocks = state.blocks.filter(b => b !== target);
            state.levelObjects = state.levelObjects.filter(b => b !== target);
          }
        });
      } else if (dmg > 4) {
        playSound('thud');
      }
    } else if (target.gameType === 'pig') {
      const dmg = Math.min(25, speed * 1.4);
      target.damage += dmg;
      if (target.damage >= PIG_KILL_DAMAGE && !target.dead) {
        target.dead = true;
        addScore(SCORE_PIG);
        playSound('pig');
        queueMicrotask(() => {
          if (state.levelObjects.includes(target)) {
            Composite.remove(world, target);
            state.pigs = state.pigs.filter(p => p !== target);
            state.levelObjects = state.levelObjects.filter(b => b !== target);
            checkEndConditions();
          }
        });
      } else {
        playSound('oink');
      }
    }
  }

  // ---------- Score / HUD ----------
  function addScore(n) {
    state.score += n;
    updateHUD();
  }

  function updateHUD() {
    document.getElementById('hud-level').textContent = String(state.levelIndex + 1);
    document.getElementById('hud-score').textContent = state.score.toLocaleString();
    document.getElementById('hud-birds').textContent = String(state.birdsRemaining);
  }

  // ---------- End conditions ----------
  function birdAtRest() {
    const b = state.activeBird;
    if (!b || !b.launched) return false;
    const speed = Vector.magnitude(b.velocity);
    return speed < 0.4;
  }

  function birdOffscreen() {
    const b = state.activeBird;
    if (!b) return false;
    return b.position.x > WORLD_W + 200 || b.position.x < -200 || b.position.y > WORLD_H + 400;
  }

  let restTimer = 0;
  function tickEndChecks(dt) {
    if (state.levelDone) return;
    if (state.activeBird && state.activeBird.launched) {
      if (birdAtRest()) {
        restTimer += dt;
      } else {
        restTimer = 0;
      }
      if (restTimer > 1.2 || birdOffscreen()) {
        restTimer = 0;
        // remove current bird
        Composite.remove(world, state.activeBird);
        state.activeBird = null;
        if (!checkEndConditions()) {
          spawnBird();
        }
      }
    }
  }

  function checkEndConditions() {
    if (state.levelDone) return true;
    if (state.pigs.length === 0) {
      // win
      state.levelDone = true;
      // bonus for unused birds (not counting the one currently in flight, which is already decremented)
      const bonus = state.birdsRemaining * SCORE_BIRD_LEFT;
      if (bonus > 0) addScore(bonus);
      showOverlay({
        title: `Level ${state.levelIndex + 1} Complete!`,
        text: `Score: ${state.score.toLocaleString()}` + (bonus ? ` (+${bonus.toLocaleString()} bonus)` : ''),
        primaryLabel: state.levelIndex + 1 < LEVELS.length ? 'Next Level' : 'Play Again',
        primaryAction: () => {
          if (state.levelIndex + 1 < LEVELS.length) {
            state.levelIndex++;
          } else {
            state.levelIndex = 0;
            state.score = 0;
          }
          loadLevel(state.levelIndex);
          hideOverlay();
        }
      });
      playSound('win');
      return true;
    }
    if (state.birdsRemaining <= 0 && !state.activeBird) {
      state.levelDone = true;
      showOverlay({
        title: 'Out of Birds!',
        text: `Score: ${state.score.toLocaleString()}`,
        primaryLabel: 'Retry Level',
        primaryAction: () => { loadLevel(state.levelIndex); hideOverlay(); }
      });
      playSound('lose');
      return true;
    }
    return false;
  }

  // ---------- Overlay ----------
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText  = document.getElementById('overlay-text');
  const btnNext      = document.getElementById('btn-next');
  const btnRestart   = document.getElementById('btn-restart');
  let primaryHandler = null;
  function showOverlay({ title, text, primaryLabel, primaryAction }) {
    overlayTitle.textContent = title;
    overlayText.textContent = text || '';
    btnNext.textContent = primaryLabel || 'Continue';
    primaryHandler = primaryAction;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); primaryHandler = null; }
  btnNext.addEventListener('click', () => { if (primaryHandler) primaryHandler(); });
  btnRestart.addEventListener('click', () => { loadLevel(state.levelIndex); hideOverlay(); });

  document.getElementById('btn-reset').addEventListener('click', () => loadLevel(state.levelIndex));
  const muteBtn = document.getElementById('btn-mute');
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇 Muted' : '🔊 Sound';
    muteBtn.setAttribute('aria-pressed', String(state.muted));
  });

  // ---------- Sound (synthesized via WebAudio) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    return audioCtx;
  }
  function playSound(kind) {
    if (state.muted) return;
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    let dur = 0.12;
    let freq = 220;
    let type = 'sine';
    let vol = 0.06;
    switch (kind) {
      case 'launch': type = 'sawtooth'; freq = 180; dur = 0.18; vol = 0.07; break;
      case 'thud':   type = 'square';   freq = 110; dur = 0.08; vol = 0.05; break;
      case 'break':  type = 'square';   freq = 320; dur = 0.18; vol = 0.08; break;
      case 'pig':    type = 'triangle'; freq = 140; dur = 0.25; vol = 0.09; break;
      case 'oink':   type = 'triangle'; freq = 280; dur = 0.10; vol = 0.05; break;
      case 'win':    type = 'triangle'; freq = 660; dur = 0.45; vol = 0.10; break;
      case 'lose':   type = 'sawtooth'; freq = 120; dur = 0.55; vol = 0.10; break;
    }
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (kind === 'win')  osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + dur);
    if (kind === 'lose') osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur);
  }

  // ---------- Camera ----------
  // The level fits within WORLD_W and the view is scaled to fit. We keep the
  // camera fixed so the player always sees the slingshot, the bird in flight,
  // and the targets. A future improvement would add camera panning for wider
  // levels.
  function updateCamera() {
    state.targetCameraX = 0;
    state.cameraX += (state.targetCameraX - state.cameraX) * 0.1;
  }

  // ---------- Render ----------
  function drawBackground() {
    // Sky already via CSS gradient on wrap; draw clouds + parallax hills.
    ctx.save();
    ctx.translate(viewOffsetX, viewOffsetY);
    ctx.scale(viewScale, viewScale);
    // Soft gradient inside world for consistent look across letterbox
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, '#7ed0ff');
    g.addColorStop(1, '#c4ecff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Distant hills
    ctx.fillStyle = '#8fd170';
    for (let i = 0; i < 6; i++) {
      const cx = (i * 320) - state.cameraX * 0.2 + 100;
      ctx.beginPath();
      ctx.arc(cx, WORLD_H - GROUND_H + 20, 200, Math.PI, 0);
      ctx.fill();
    }
    // Closer hills
    ctx.fillStyle = '#6cba3a';
    for (let i = 0; i < 8; i++) {
      const cx = (i * 240) - state.cameraX * 0.4 - 80;
      ctx.beginPath();
      ctx.arc(cx, WORLD_H - GROUND_H + 40, 160, Math.PI, 0);
      ctx.fill();
    }

    ctx.restore();
  }

  function applyWorldTransform() {
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.translate(viewOffsetX, viewOffsetY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-state.cameraX, 0);
  }

  function drawGround() {
    ctx.fillStyle = '#6cba3a';
    ctx.fillRect(-200, WORLD_H - GROUND_H, WORLD_W + 400, GROUND_H);
    ctx.fillStyle = '#4f9b27';
    ctx.fillRect(-200, WORLD_H - GROUND_H, WORLD_W + 400, 8);
    // grass tufts
    ctx.fillStyle = '#7fce42';
    for (let x = -50; x < WORLD_W + 100; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD_H - GROUND_H);
      ctx.lineTo(x + 5, WORLD_H - GROUND_H - 8);
      ctx.lineTo(x + 10, WORLD_H - GROUND_H);
      ctx.fill();
    }
  }

  function drawSlingshot() {
    // Y-shaped wooden slingshot at SLING_X / SLING_Y
    const baseY = WORLD_H - GROUND_H;
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(SLING_X, baseY);
    ctx.lineTo(SLING_X, SLING_Y + 20);
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(SLING_X, SLING_Y + 20);
    ctx.lineTo(SLING_X - 22, SLING_Y - 10);
    ctx.moveTo(SLING_X, SLING_Y + 20);
    ctx.lineTo(SLING_X + 22, SLING_Y - 10);
    ctx.stroke();

    // Elastic bands
    const bird = state.activeBird;
    const grabX = bird && !bird.launched ? bird.position.x : SLING_X;
    const grabY = bird && !bird.launched ? bird.position.y : SLING_Y;
    ctx.strokeStyle = '#2b1a0c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(SLING_X - 22, SLING_Y - 10);
    ctx.lineTo(grabX, grabY);
    ctx.lineTo(SLING_X + 22, SLING_Y - 10);
    ctx.stroke();
  }

  function drawBird(b) {
    const x = b.position.x;
    const y = b.position.y;
    const r = BIRD_RADIUS;
    const a = b.angle;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    // body
    ctx.fillStyle = '#e6342a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // belly
    ctx.fillStyle = '#fff3df';
    ctx.beginPath();
    ctx.arc(4, 6, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -8, 8, 0, Math.PI * 2);
    ctx.arc(-6, -8, 6, 0, Math.PI * 2);
    ctx.fill();
    // pupils
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(10, -8, 3, 0, Math.PI * 2);
    ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(r - 2, 2);
    ctx.lineTo(r + 14, 0);
    ctx.lineTo(r - 2, 10);
    ctx.closePath();
    ctx.fill();
    // tail tuft
    ctx.fillStyle = '#a91f15';
    ctx.beginPath();
    ctx.moveTo(-r + 4, -4);
    ctx.lineTo(-r - 8, -10);
    ctx.lineTo(-r + 2, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPig(p) {
    const x = p.position.x;
    const y = p.position.y;
    const r = p.r;
    const damageRatio = Math.min(1, p.damage / PIG_KILL_DAMAGE);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    // body
    ctx.fillStyle = '#87d36b';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // shading
    ctx.fillStyle = '#6cba53';
    ctx.beginPath();
    ctx.arc(2, 6, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // snout
    ctx.fillStyle = '#9adf7e';
    ctx.beginPath();
    ctx.ellipse(0, 4, r * 0.45, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // nostrils
    ctx.fillStyle = '#3f7a2c';
    ctx.beginPath();
    ctx.ellipse(-5, 4, 2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(5, 4, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-7, -8, 5, 0, Math.PI * 2);
    ctx.arc(7, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-6, -8, 2, 0, Math.PI * 2);
    ctx.arc(8, -8, 2, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#6cba53';
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, -r * 0.6, 5, 8, -0.5, 0, Math.PI * 2);
    ctx.ellipse( r * 0.7, -r * 0.6, 5, 8,  0.5, 0, Math.PI * 2);
    ctx.fill();
    // damage cracks
    if (damageRatio > 0.4) {
      ctx.strokeStyle = '#3f7a2c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2);
      ctx.lineTo(-r * 0.1, r * 0.1);
      ctx.lineTo(-r * 0.3, r * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlock(b) {
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    const w = b.w, h = b.h;
    if (b.material === 'stone') {
      ctx.fillStyle = '#b8bcc4';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#6f7480';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      // stone speckles
      ctx.fillStyle = '#9aa0a8';
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * (w / 4);
        ctx.fillRect(dx - 2, -2, 4, 4);
      }
    } else {
      // wood
      ctx.fillStyle = '#c98a4b';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      // grain lines
      ctx.strokeStyle = '#a36e35';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (w > h) {
        ctx.moveTo(-w / 2 + 4, -h / 4); ctx.lineTo(w / 2 - 4, -h / 4);
        ctx.moveTo(-w / 2 + 4,  h / 4); ctx.lineTo(w / 2 - 4,  h / 4);
      } else {
        ctx.moveTo(-w / 4, -h / 2 + 4); ctx.lineTo(-w / 4, h / 2 - 4);
        ctx.moveTo( w / 4, -h / 2 + 4); ctx.lineTo( w / 4, h / 2 - 4);
      }
      ctx.stroke();
    }
    // damage tint
    const dmg = 1 - (b.hp / b.maxHp);
    if (dmg > 0.1) {
      ctx.fillStyle = `rgba(0,0,0,${dmg * 0.35})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawTrajectoryPreview() {
    const b = state.activeBird;
    if (!b || b.launched || !state.aiming) return;
    // Predict trajectory using the same launch model as launchBird()
    const dx = SLING_X - b.position.x;
    const dy = SLING_Y - b.position.y;
    let vx = dx * LAUNCH_VELOCITY_GAIN;
    let vy = dy * LAUNCH_VELOCITY_GAIN;
    let px = b.position.x;
    let py = b.position.y;
    // Tuned manually to match the actual physics step. Adjust along with
    // LAUNCH_VELOCITY_GAIN if launch feel changes.
    const g = 0.95;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 32; i++) {
      px += vx;
      py += vy;
      vy += g;
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (py > WORLD_H - GROUND_H - 4) break;
    }
  }

  function render() {
    // Clear
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // World-space draws (camera applied)
    applyWorldTransform();
    drawBackground();
    drawGround();
    for (const b of state.blocks) drawBlock(b);
    for (const p of state.pigs) drawPig(p);
    drawSlingshot();
    if (state.activeBird) drawBird(state.activeBird);
    drawTrajectoryPreview();
  }

  // ---------- Loop ----------
  let lastTs = performance.now();
  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    Engine.update(engine, dt * 1000);
    updateCamera();
    tickEndChecks(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- Boot ----------
  resize();
  loadLevel(0);
  requestAnimationFrame(loop);
})();
