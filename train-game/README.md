# 🚂 Endless Rails — 3D Train Runner

A browser-based, infinite 3D train game built with [Three.js](https://threejs.org/).
Ride the rails through procedurally generated **forests** and **villages** —
the world streams in ahead of you and is cleaned up behind you, so it runs
forever with a light memory footprint.

## Play

Just open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
No build step, no server required — pure HTML/CSS/JS + a CDN copy of Three.js.

### Controls
| Action              | Key                     |
|---------------------|-------------------------|
| Switch to left lane  | `←` or `A`              |
| Switch to right lane | `→` or `D`              |
| Restart after crash  | `Enter` / `Space`       |
| Mobile               | On-screen buttons or swipe left/right |

### Goal
Dodge the logs and barrels on the track, collect coins, and see how far you
can ride before you crash. Speed increases the longer you survive.

## Project structure

```
train-game/
├── index.html        # Page structure, HUD, overlays
├── css/
│   └── style.css     # All styling (HUD, buttons, menus)
├── js/
│   ├── world.js       # Procedural chunk/biome generation (track, trees, houses, obstacles, coins)
│   └── main.js        # Scene setup, train, camera, input, game loop, collisions
└── README.md
```

## How the infinite world works

- The track is built from fixed-length **chunks** (60 units each).
- A single `worldGroup` holds all chunks and is translated forward each
  frame — this simulates the train moving without ever having to move the
  camera through an unbounded coordinate space.
- Chunks are spawned ahead of the train as needed and **removed** once they
  scroll far enough behind the camera, so the scene graph never grows
  unbounded — this is what makes the map "infinite."
- Each chunk randomly picks a biome (`forest` or `village`) and scatters
  trees, houses, fences, obstacles, and coin trails accordingly.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push these files to it (keep the
   folder structure as-is).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   choose the `main` branch and `/ (root)` folder, then **Save**.
4. GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

That's it — no build tools, no dependencies to install.

## Customizing

- **Track difficulty / speed**: tweak `baseSpeed`, `maxSpeed`, and the
  acceleration factor in `js/main.js` (`speed = Math.min(maxSpeed, baseSpeed + elapsed * 0.35)`).
- **Chunk length / world density**: `CHUNK_LENGTH`, `AHEAD_DISTANCE` in
  `js/world.js` and `js/main.js`.
- **New biomes**: add an entry to the `BIOMES` array in `js/main.js` and a
  matching branch inside `createChunk()` in `js/world.js`.
- **Visuals**: all geometry is built procedurally with basic Three.js
  primitives (boxes, cones, cylinders) so it's easy to swap in your own
  colors, proportions, or even imported `.glb` models.

Enjoy the ride! 🌲🚉🏘️
