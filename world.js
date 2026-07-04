/* ============================================================
   world.js
   Procedural chunk generation for the endless train track.
   Each "chunk" is a THREE.Group spanning CHUNK_LENGTH units
   along local Z (from 0 down to -CHUNK_LENGTH), containing:
     - ground plane (biome colored)
     - rails + sleepers
     - scenery (trees for forest, houses for village)
     - obstacles (logs/barrels) the player must dodge
     - coins the player can collect
   ============================================================ */

const CHUNK_LENGTH = 60;
const LANE_WIDTH = 4;
const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];
const GROUND_WIDTH = 40;

// Reusable geometries/materials for performance
const Materials = {
  forestGround: new THREE.MeshLambertMaterial({ color: 0x3d7a3d }),
  villageGround: new THREE.MeshLambertMaterial({ color: 0x9c8a63 }),
  trackBed: new THREE.MeshLambertMaterial({ color: 0x5b4a3a }),
  rail: new THREE.MeshLambertMaterial({ color: 0x8c8c8c }),
  sleeper: new THREE.MeshLambertMaterial({ color: 0x5a3b26 }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  leaves: new THREE.MeshLambertMaterial({ color: 0x2e6b2e }),
  leavesLight: new THREE.MeshLambertMaterial({ color: 0x4a9c4a }),
  houseWall: [
    new THREE.MeshLambertMaterial({ color: 0xd9c9a3 }),
    new THREE.MeshLambertMaterial({ color: 0xc98a5a }),
    new THREE.MeshLambertMaterial({ color: 0xb5c9d9 }),
  ],
  roof: [
    new THREE.MeshLambertMaterial({ color: 0x8b3a2a }),
    new THREE.MeshLambertMaterial({ color: 0x4a4a5a }),
  ],
  obstacleLog: new THREE.MeshLambertMaterial({ color: 0x6b4423 }),
  obstacleBarrel: new THREE.MeshLambertMaterial({ color: 0xaa3a3a }),
  coin: new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0x8a6a00, metalness: 0.6, roughness: 0.3 }),
  fence: new THREE.MeshLambertMaterial({ color: 0x7a5c3e }),
};

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- Track (rails + sleepers) ---------- */
function buildTrack(group) {
  const trackBed = new THREE.Mesh(
    new THREE.PlaneGeometry(9, CHUNK_LENGTH),
    Materials.trackBed
  );
  trackBed.rotation.x = -Math.PI / 2;
  trackBed.position.set(0, 0.01, -CHUNK_LENGTH / 2);
  group.add(trackBed);

  // Two continuous rails
  [-1.3, 1.3].forEach((x) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.15, CHUNK_LENGTH),
      Materials.rail
    );
    rail.position.set(x, 0.1, -CHUNK_LENGTH / 2);
    group.add(rail);
  });

  // Sleepers every 2 units
  for (let z = -1; z > -CHUNK_LENGTH; z -= 2) {
    const sleeper = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 0.5),
      Materials.sleeper
    );
    sleeper.position.set(0, 0.03, z);
    group.add(sleeper);
  }
}

/* ---------- Scenery ---------- */
function buildTree(x, z) {
  const tree = new THREE.Group();
  const trunkHeight = randRange(1.6, 2.6);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, trunkHeight, 6), Materials.trunk);
  trunk.position.y = trunkHeight / 2;
  tree.add(trunk);

  const leafMat = Math.random() > 0.5 ? Materials.leaves : Materials.leavesLight;
  const tiers = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = randRange(1.1, 1.6) * (1 - i * 0.22);
    const h = randRange(1.4, 2.0);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leafMat);
    cone.position.y = trunkHeight + i * h * 0.65;
    tree.add(cone);
  }
  tree.position.set(x, 0, z);
  tree.rotation.y = Math.random() * Math.PI * 2;
  const s = randRange(0.85, 1.3);
  tree.scale.set(s, s, s);
  return tree;
}

function buildHouse(x, z) {
  const house = new THREE.Group();
  const w = randRange(2.4, 3.6);
  const d = randRange(2.4, 3.6);
  const h = randRange(1.8, 2.6);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(Materials.houseWall));
  wall.position.y = h / 2;
  house.add(wall);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4), pick(Materials.roof));
  roof.position.y = h + (h * 0.7) / 2;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);

  house.position.set(x, 0, z);
  house.rotation.y = Math.random() * Math.PI * 2;
  return house;
}

function buildFencePost(x, z) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), Materials.fence);
  post.position.set(x, 0.45, z);
  return post;
}

/* ---------- Obstacles & Coins ---------- */
function buildObstacle() {
  const type = Math.random() > 0.5 ? 'log' : 'barrel';
  let mesh;
  if (type === 'log') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 8), Materials.obstacleLog);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.y = 0.5;
  } else {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 10), Materials.obstacleBarrel);
    mesh.position.y = 0.65;
  }
  return mesh;
}

function buildCoin() {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 8, 16), Materials.coin);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 1.1;
  return mesh;
}

/* ---------- Chunk factory ---------- */
// index: used to decide difficulty ramp; biome: 'forest' | 'village'
function createChunk(localZ, index, biome) {
  const group = new THREE.Group();
  group.position.z = localZ;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_WIDTH, CHUNK_LENGTH),
    biome === 'forest' ? Materials.forestGround : Materials.villageGround
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -CHUNK_LENGTH / 2;
  group.add(ground);

  buildTrack(group);

  const obstacles = [];
  const coins = [];

  // Scenery on both sides of the track
  const sceneryCount = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < sceneryCount; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side * randRange(6, GROUND_WIDTH / 2 - 1.5);
    const z = -randRange(1, CHUNK_LENGTH - 1);
    if (biome === 'forest') {
      group.add(buildTree(x, z));
    } else {
      if (Math.random() > 0.35) {
        group.add(buildHouse(x, z));
      } else {
        group.add(buildTree(x, z));
      }
    }
  }

  // Fence posts lining the track for village chunks
  if (biome === 'village') {
    for (let z = -2; z > -CHUNK_LENGTH; z -= 4) {
      group.add(buildFencePost(-5, z));
      group.add(buildFencePost(5, z));
    }
  }

  // Obstacles: skip on the very first (safe) chunk
  if (index > 0) {
    const obstacleCount = Math.min(1 + Math.floor(index / 3), 3);
    const usedZ = [];
    for (let i = 0; i < obstacleCount; i++) {
      let z;
      let tries = 0;
      do {
        z = -randRange(10, CHUNK_LENGTH - 6);
        tries++;
      } while (usedZ.some((u) => Math.abs(u - z) < 6) && tries < 10);
      usedZ.push(z);

      const lane = Math.floor(Math.random() * 3);
      const mesh = buildObstacle();
      mesh.position.x = LANE_X[lane];
      mesh.position.z = z;
      group.add(mesh);
      obstacles.push({ mesh, lane, localZ: z });
    }
  }

  // Coins: nice little pickup trails
  if (Math.random() > 0.15) {
    const lane = Math.floor(Math.random() * 3);
    const startZ = -randRange(5, 20);
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const z = startZ - i * 2.4;
      if (z < -CHUNK_LENGTH + 2) break;
      // avoid placing coins directly on obstacles
      const blocked = obstacles.some((o) => o.lane === lane && Math.abs(o.localZ - z) < 2.2);
      if (blocked) continue;
      const mesh = buildCoin();
      mesh.position.x = LANE_X[lane];
      mesh.position.z = z;
      group.add(mesh);
      coins.push({ mesh, lane, localZ: z, collected: false });
    }
  }

  return { group, obstacles, coins, localZ };
}
