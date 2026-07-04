/* ============================================================
   main.js
   Core game engine: scene, camera, train, input, chunk
   streaming (infinite world), collisions, scoring, HUD.
   ============================================================ */

(function () {
  'use strict';

  // ---------- Renderer / Scene / Camera ----------
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd3f0);
  scene.fog = new THREE.Fog(0x9fd3f0, 40, 130);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 6, 11);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // ---------- Lighting ----------
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff2d0, 0.85);
  sun.position.set(-20, 35, 15);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3d7a3d, 0.4);
  scene.add(hemi);

  // ---------- Train model ----------
  function buildTrain() {
    const train = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd23c3c });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d2 });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 4.2), bodyMat);
    body.position.y = 1.1;
    train.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 1.8), cabinMat);
    cabin.position.set(0, 2.05, 0.7);
    train.add(cabin);

    const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 12), bodyMat);
    nose.rotation.z = Math.PI / 2;
    nose.position.set(0, 1.1, -2.9);
    train.add(nose);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 1.1, 10), trimMat);
    chimney.position.set(0, 2.35, -2.3);
    train.add(chimney);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.3, 0.3), trimMat);
    bumper.position.set(0, 0.5, 2.15);
    train.add(bumper);

    // Wheels
    const wheelPositions = [
      [-1.35, 0.55, 1.4], [1.35, 0.55, 1.4],
      [-1.35, 0.55, 0], [1.35, 0.55, 0],
      [-1.35, 0.55, -1.4], [1.35, 0.55, -1.4],
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, y, z);
      train.add(wheel);
    });

    return train;
  }

  const train = buildTrain();
  train.position.set(0, 0, 0);
  scene.add(train);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // ---------- Game state ----------
  const BIOMES = ['forest', 'village'];
  const AHEAD_DISTANCE = 260;   // keep this much world generated ahead of the train
  const BEHIND_DESPAWN = 25;    // remove chunks once this far behind the train

  let chunks = [];
  let chunkIndex = 0;
  let nextLocalZ = 0;
  let lastBiome = null;

  let currentLane = 1;
  let targetX = LANE_X[currentLane];

  let baseSpeed = 16;
  let maxSpeed = 46;
  let speed = baseSpeed;
  let elapsed = 0;
  let distance = 0;
  let coinsCollected = 0;

  let running = false;
  let gameOver = false;

  const clock = new THREE.Clock();

  function pickBiome() {
    // avoid repeating the same biome too many times in a row
    let biome = pick(BIOMES);
    if (biome === lastBiome && Math.random() > 0.3) {
      biome = BIOMES.find((b) => b !== lastBiome);
    }
    lastBiome = biome;
    return biome;
  }

  function spawnNextChunk() {
    const biome = chunkIndex === 0 ? 'forest' : pickBiome();
    const chunkData = createChunk(nextLocalZ, chunkIndex, biome);
    worldGroup.add(chunkData.group);
    chunks.push(chunkData);
    nextLocalZ -= CHUNK_LENGTH;
    chunkIndex++;
  }

  function resetWorld() {
    chunks.forEach((c) => worldGroup.remove(c.group));
    chunks = [];
    chunkIndex = 0;
    nextLocalZ = 0;
    lastBiome = null;
    worldGroup.position.set(0, 0, 0);

    // Pre-generate enough chunks to cover the ahead distance
    let covered = 0;
    while (covered < AHEAD_DISTANCE) {
      spawnNextChunk();
      covered += CHUNK_LENGTH;
    }
  }

  function resetGame() {
    speed = baseSpeed;
    elapsed = 0;
    distance = 0;
    coinsCollected = 0;
    currentLane = 1;
    targetX = LANE_X[currentLane];
    train.position.x = 0;
    train.rotation.z = 0;
    gameOver = false;
    resetWorld();
    updateHUD();
  }

  // ---------- Input ----------
  function moveLeft() {
    if (gameOver) return;
    currentLane = Math.max(0, currentLane - 1);
    targetX = LANE_X[currentLane];
  }
  function moveRight() {
    if (gameOver) return;
    currentLane = Math.min(2, currentLane + 1);
    targetX = LANE_X[currentLane];
  }

  window.addEventListener('keydown', (e) => {
    if (!running) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
    if (gameOver && (e.key === 'Enter' || e.key === ' ')) startGame();
  });

  document.getElementById('btn-left').addEventListener('click', moveLeft);
  document.getElementById('btn-right').addEventListener('click', moveRight);
  document.getElementById('btn-left').addEventListener('touchstart', (e) => { e.preventDefault(); moveLeft(); });
  document.getElementById('btn-right').addEventListener('touchstart', (e) => { e.preventDefault(); moveRight(); });

  // Swipe support
  let touchStartX = null;
  window.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  window.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) moveLeft(); else moveRight();
    }
    touchStartX = null;
  });

  // ---------- HUD ----------
  const hudDistance = document.getElementById('hud-distance');
  const hudCoins = document.getElementById('hud-coins');
  const hudSpeed = document.getElementById('hud-speed');

  function updateHUD() {
    hudDistance.textContent = `${Math.floor(distance)} m`;
    hudCoins.textContent = `🪙 ${coinsCollected}`;
    hudSpeed.textContent = `${Math.floor(speed * 3.2)} km/h`;
  }

  // ---------- Collision ----------
  const TRAIN_Z = 0;
  const COLLIDE_RANGE = 1.6;
  const COIN_RANGE = 1.8;
  const LANE_TOLERANCE = 1.4;

  function checkCollisions() {
    for (const chunk of chunks) {
      const chunkWorldZ = worldGroup.position.z + chunk.group.position.z;

      for (const obs of chunk.obstacles) {
        if (obs.hit) continue;
        const worldZ = chunkWorldZ + obs.localZ;
        if (Math.abs(worldZ - TRAIN_Z) < COLLIDE_RANGE) {
          if (Math.abs(train.position.x - LANE_X[obs.lane]) < LANE_TOLERANCE) {
            obs.hit = true;
            triggerGameOver();
            return;
          }
        }
      }

      for (const coin of chunk.coins) {
        if (coin.collected) continue;
        const worldZ = chunkWorldZ + coin.localZ;
        if (Math.abs(worldZ - TRAIN_Z) < COIN_RANGE) {
          if (Math.abs(train.position.x - LANE_X[coin.lane]) < LANE_TOLERANCE) {
            coin.collected = true;
            coin.mesh.visible = false;
            coinsCollected++;
            distance += 0; // no-op, keeps intent clear
          }
        }
      }
    }
  }

  // ---------- Chunk streaming ----------
  function streamChunks() {
    // Spawn ahead
    const lastChunk = chunks[chunks.length - 1];
    const lastWorldZ = worldGroup.position.z + lastChunk.group.position.z;
    if (lastWorldZ > -AHEAD_DISTANCE) {
      spawnNextChunk();
    }

    // Despawn behind
    while (chunks.length > 0) {
      const first = chunks[0];
      const firstWorldZ = worldGroup.position.z + first.group.position.z;
      // chunk's "front" edge (closest to camera) is at firstWorldZ (localZ=0 is the near edge)
      if (firstWorldZ > BEHIND_DESPAWN) {
        worldGroup.remove(first.group);
        chunks.shift();
      } else {
        break;
      }
    }
  }

  // ---------- Game over ----------
  const gameoverScreen = document.getElementById('gameover-screen');
  const finalStats = document.getElementById('final-stats');

  function triggerGameOver() {
    gameOver = true;
    finalStats.textContent = `Distance: ${Math.floor(distance)} m  •  Coins: ${coinsCollected}`;
    gameoverScreen.classList.remove('hidden');
  }

  // ---------- Main loop ----------
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (running && !gameOver) {
      elapsed += dt;
      speed = Math.min(maxSpeed, baseSpeed + elapsed * 0.35);

      worldGroup.position.z += speed * dt;
      distance += speed * dt;

      // Smooth lane switching
      train.position.x += (targetX - train.position.x) * Math.min(1, dt * 9);
      train.rotation.z = (targetX - train.position.x) * -0.12;

      // Gentle bob for life-like motion
      train.position.y = Math.sin(elapsed * 14) * 0.03 + Math.abs(Math.sin(elapsed * 7)) * 0.02;

      checkCollisions();
      streamChunks();
      updateHUD();
    }

    // Camera follows train smoothly
    const camTargetX = train.position.x * 0.6;
    camera.position.x += (camTargetX - camera.position.x) * Math.min(1, dt * 4);
    camera.position.y = 6;
    camera.position.z = 11;
    camera.lookAt(train.position.x * 0.3, 1.4, -8);

    renderer.render(scene, camera);
  }

  // ---------- Start / Restart ----------
  const startScreen = document.getElementById('start-screen');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');

  function startGame() {
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    resetGame();
    running = true;
    clock.getDelta(); // reset delta accumulation
  }

  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);

  // Prepare an initial (idle) world so the start screen has scenery behind it
  resetWorld();
  animate();
})();
