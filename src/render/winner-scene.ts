import * as THREE from 'three';
import { designFor } from '../animals/designs';
import { WINTER_WOLF_DESIGN } from '../animals/wolf-design';
import { GAME_STEP } from './scene';
import { createWolfMesh, requestWolfGeometry } from './wolf-mesh';
import type { Wobble } from './wobble';

/**
 * The winner cutscene (#5), render only: a storm rolls in, the winner trots into the cave as the
 * lightning starts, turns to watch from the cave mouth, and a tornado sweeps the losers away.
 * Its own small scene and renderer on an overlay canvas, so the tray scene is left alone.
 */

export interface Contender {
  readonly name: string;
  readonly colour: string;
  /** Animal id (the seat's die). */
  readonly animal: string;
}

/** Shot timings in seconds. */
export const WINNER_TIMELINE = {
  /** Wide shot: rain, the winner trots for the cave. */
  trot: [0, 3.4],
  /** The first lightning strike, as the winner reaches the cave mouth. */
  strike: 3.1,
  /** Cut to the cave mouth: the winner turns to look out at the storm. */
  cave: 3.4,
  /** The tornado crosses outside and takes the losers. */
  tornado: [4.4, 8.6],
  /** The scene ends (the title card follows). */
  end: 9.2,
} as const;

const CAVE_AT = new THREE.Vector3(4.2, 0, 0);

interface Actor {
  readonly holder: THREE.Group;
  readonly model: THREE.Object3D;
  readonly wobble: Wobble | undefined;
}

function actor(c: Contender): Actor {
  const design = designFor(c.animal) ?? WINTER_WOLF_DESIGN;
  const model = createWolfMesh(design, { step: GAME_STEP, collar: c.colour, wobble: true });
  model.scale.setScalar(0.88);
  const holder = new THREE.Group();
  holder.add(model);
  model.traverse((o) => {
    o.castShadow = true;
  });
  return { holder, model, wobble: model.userData.wobble as Wobble | undefined };
}

/** A lumpy rock dome with a dark mouth facing -X: the den at the end of the trail. */
function cave(): THREE.Group {
  const g = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: '#4a3d6e', roughness: 1, flatShading: true });
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), rock);
  dome.scale.set(1.2, 0.9, 1.3);
  dome.position.set(1.4, 0.4, 0);
  const lip = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), rock);
  lip.position.set(-0.4, 1.5, 0.9);
  const lip2 = lip.clone();
  lip2.position.set(-0.3, 1.3, -1.1);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: '#05030a' }));
  mouth.scale.set(1, 1.05, 1);
  mouth.rotation.y = -Math.PI / 2;
  mouth.position.set(-0.98, 0.95, 0);
  g.add(dome, lip, lip2, mouth);
  g.position.copy(CAVE_AT);
  return g;
}

/** Rain: short falling streaks, recycled to the top as they land. */
function rain(count: number): { lines: THREE.LineSegments; step: (dt: number, around: THREE.Vector3) => void } {
  const pos = new Float32Array(count * 6);
  const seed = (i: number, around: THREE.Vector3, anyHeight: boolean) => {
    const x = around.x + (Math.random() - 0.5) * 24;
    const z = around.z + (Math.random() - 0.5) * 16;
    const y = anyHeight ? Math.random() * 10 : 10;
    pos.set([x, y, z, x - 0.08, y - 0.45, z], i * 6);
  };
  const origin = new THREE.Vector3();
  for (let i = 0; i < count; i++) seed(i, origin, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#a9c4e8', transparent: true, opacity: 0.5 }));
  lines.frustumCulled = false;
  return {
    lines,
    step: (dt, around) => {
      for (let i = 0; i < count; i++) {
        const fall = dt * 22;
        pos[i * 6 + 1] = pos[i * 6 + 1]! - fall;
        pos[i * 6 + 4] = pos[i * 6 + 4]! - fall;
        pos[i * 6] = pos[i * 6]! - fall * 0.18;
        pos[i * 6 + 3] = pos[i * 6 + 3]! - fall * 0.18;
        if (pos[i * 6 + 4]! < 0) seed(i, around, false);
      }
      geo.attributes.position!.needsUpdate = true;
    },
  };
}

/** A tapering, twisting funnel of translucent rings, with debris orbiting it. */
function tornado(): { group: THREE.Group; spin: (t: number) => void } {
  const group = new THREE.Group();
  const rings: THREE.Mesh[] = [];
  const mat = new THREE.MeshBasicMaterial({ color: '#8d80b3', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const h = i / 13;
    const r = 0.25 + h * h * 2.4;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r, 0.62, 20, 1, true), mat);
    ring.position.y = 0.3 + i * 0.58;
    rings.push(ring);
    group.add(ring);
  }
  const debrisGeo = new THREE.BufferGeometry();
  const debris = new Float32Array(180 * 3);
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(debris, 3));
  const bits = new THREE.Points(debrisGeo, new THREE.PointsMaterial({ color: '#2f2152', size: 0.12 }));
  group.add(bits);
  return {
    group,
    spin: (t) => {
      rings.forEach((ring, i) => {
        ring.rotation.y = t * (6 - i * 0.2);
        ring.position.x = Math.sin(t * 2.2 + i * 0.45) * 0.18 * (i / 13);
        ring.position.z = Math.cos(t * 1.7 + i * 0.4) * 0.18 * (i / 13);
      });
      for (let i = 0; i < 180; i++) {
        const h = (i * 0.37 + t * 0.6) % 8;
        const a = i * 2.4 + t * (7 - h * 0.4);
        const r = 0.4 + (h / 8) ** 2 * 2.6;
        debris.set([Math.cos(a) * r, h, Math.sin(a) * r], i * 3);
      }
      debrisGeo.attributes.position!.needsUpdate = true;
    },
  };
}

/** A jagged bolt from the sky to the ground near `x`. */
function bolt(x: number, z: number): THREE.Line {
  const pts: THREE.Vector3[] = [];
  let px = x;
  let pz = z;
  for (let y = 12; y >= 0; y -= 1.2) {
    pts.push(new THREE.Vector3(px, y, pz));
    px += (Math.random() - 0.5) * 1.1;
    pz += (Math.random() - 0.5) * 0.6;
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f4f1ff' }));
  line.visible = false;
  return line;
}

const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const bump = (a: number, b: number, t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, (t - a) / (b - a))));

// ---------------------------------------------------------------------------------------------
// The shared stage: renderer, sky, cast and camera. Each cutscene is a "director" that dresses
// the stage and moves the cast and camera over time.
// ---------------------------------------------------------------------------------------------

export type WinnerSceneId = 'storm' | 'summit' | 'lake' | 'fireworks';

export const WINNER_SCENES: readonly { readonly id: WinnerSceneId; readonly name: string; readonly blurb: string }[] = [
  { id: 'storm', name: 'Storm and tornado', blurb: 'The winner shelters in the cave; a tornado takes the rest.' },
  { id: 'summit', name: 'Summit howl', blurb: 'The winner howls from the peak; the rest slide down the mountain.' },
  { id: 'lake', name: 'Frozen lake', blurb: 'The winner skates and bows; the ice gives way under the rest.' },
  { id: 'fireworks', name: 'Fireworks', blurb: 'The winner takes the podium; the rest go up as fireworks.' },
];

interface Cast extends Actor {
  readonly i: number;
  readonly colour: string;
}

interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly hero: Actor & { readonly colour: string };
  readonly pack: readonly Cast[];
  /** A lightning-style white flash (the DOM flash fires too). */
  strike(): void;
}

interface Shot {
  readonly end: number;
  update(t: number, dt: number): void;
}

type Director = (stage: Stage) => Shot;

/** Points that fly out from a spot, fall and fade: sparks, splashes, snow puffs, fireworks. */
function bursts(scene: THREE.Scene, max: number, size: number) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const grav = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  const c = new THREE.Color();
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -100;
  return {
    /** Throw `n` points from `at` at up to `speed`, in `colour`; `up` biases them skyward. */
    fire(at: THREE.Vector3, n: number, speed: number, colour: string, up = 0, gravity = 1) {
      c.set(colour);
      for (let k = 0; k < n; k++) {
        const i = next++ % max;
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const s = speed * (0.4 + Math.random() * 0.6);
        pos.set([at.x, at.y, at.z], i * 3);
        vel.set([dir.x * s, dir.y * s + up, dir.z * s], i * 3);
        col.set([c.r, c.g, c.b], i * 3);
        life[i] = 1;
        grav[i] = gravity;
      }
    },
    step(dt: number) {
      for (let i = 0; i < max; i++) {
        if (life[i]! <= 0) continue;
        life[i] = life[i]! - dt * 0.7;
        vel[i * 3 + 1] = vel[i * 3 + 1]! - 9 * grav[i]! * dt;
        for (let a = 0; a < 3; a++) pos[i * 3 + a] = pos[i * 3 + a]! + vel[i * 3 + a]! * dt;
        // Fade by dimming toward black: additive blending makes black invisible.
        for (let a = 0; a < 3; a++) col[i * 3 + a] = col[i * 3 + a]! * (1 - dt * 0.9);
        if (life[i]! <= 0) pos[i * 3 + 1] = -100;
      }
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.color!.needsUpdate = true;
    },
  };
}

/** Falling snow: slow drifting points recycled to the top. */
function snowfall(scene: THREE.Scene, count: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * 40, Math.random() * 16, (Math.random() - 0.5) * 30], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#efeaff', size: 0.08, transparent: true, opacity: 0.8 }));
  pts.frustumCulled = false;
  scene.add(pts);
  return (dt: number, t: number) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] = pos[i * 3 + 1]! - dt * 1.4;
      pos[i * 3] = pos[i * 3]! + Math.sin(t + i) * dt * 0.3;
      if (pos[i * 3 + 1]! < 0) pos[i * 3 + 1] = 16;
    }
    geo.attributes.position!.needsUpdate = true;
  };
}

/** A starry sky dome. */
function stars(scene: THREE.Scene): void {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = 0.15 + Math.random() * 0.85;
    const flat = Math.sqrt(1 - h * h);
    pos.set([Math.cos(a) * 45 * flat, h * 45, Math.sin(a) * 45 * flat], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f4f1ff', size: 0.14 })));
}

function pines(scene: THREE.Scene, at: (i: number) => [number, number], n: number): void {
  const pine = new THREE.MeshStandardMaterial({ color: '#1a1330', roughness: 1, flatShading: true });
  for (let i = 0; i < n; i++) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.2, 3 + (i % 4), 6), pine);
    const [x, z] = at(i);
    tree.position.set(x, 1.5 + (i % 4) / 2, z);
    scene.add(tree);
  }
}

/** Spread `n` cast members across a fraction of a circle (radians from `from` to `to`). */
const spread = (i: number, n: number, from: number, to: number) => (n <= 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1));

// ---------- 1. Storm and tornado ----------

const storm: Director = ({ scene, camera, hero, pack, strike }) => {
  const T = WINNER_TIMELINE;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#241a3d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, cave());
  pines(scene, (i) => [-14 + i * 1.9, -7 - (i % 3) * 1.4], 18);
  const wet = rain(900);
  scene.add(wet.lines);
  const twister = tornado();
  twister.group.visible = false;
  scene.add(twister.group);
  const bolts = [bolt(-2, -5), bolt(6, -6), bolt(-6, -4)];
  scene.add(...bolts);
  hero.holder.position.set(-3.6, 0, 0.4);
  const homes = pack.map((p) => {
    const row = p.i - (pack.length - 1) / 2;
    p.holder.position.set(-4.6 + Math.abs(row) * 0.5, 0, row * 1.6 - 0.4);
    p.holder.rotation.y = 0.3 - row * 0.2;
    return { home: p.holder.position.clone(), spin: 3 + p.i * 0.7, phase: p.i * 1.9, lift: 0, caught: false };
  });
  const strikes = [T.strike, T.strike + 0.35, 5.6, 7.4];
  let struck = 0;
  let boltClock = 0;
  return {
    end: T.end,
    update(t, dt) {
      const trot = smooth(T.trot[0] + 0.3, T.trot[1], t);
      const mouth = CAVE_AT.x - 1.5;
      hero.holder.position.x = -3.6 + (mouth + 0.2 + 3.6) * trot;
      hero.holder.position.z = 0.4 * (1 - trot);
      hero.holder.position.y = trot > 0 && trot < 1 ? Math.abs(Math.sin(t * 11)) * 0.12 : 0;
      hero.holder.rotation.y = Math.PI * smooth(T.cave + 0.2, T.cave + 1.3, t);
      hero.holder.rotation.z = -0.12 * smooth(T.cave + 1.1, T.cave + 1.8, t);

      const across = smooth(T.tornado[0], T.tornado[1], t);
      twister.group.visible = t > T.tornado[0] - 0.4;
      twister.group.position.set(-11 + across * 11, 0, -0.4);
      twister.spin(t);
      pack.forEach((p, k) => {
        const h = homes[k]!;
        if (!h.caught && t > T.tornado[0] && Math.abs(h.home.x - twister.group.position.x) < 2.2) h.caught = true;
        if (h.caught) {
          h.lift += dt;
          const a = h.lift * h.spin + h.phase;
          const r = 0.8 + h.lift * 0.9;
          p.holder.position.set(twister.group.position.x + Math.cos(a) * r, Math.min(9, h.lift * 2.6), twister.group.position.z + Math.sin(a) * r);
          p.holder.rotation.set(h.lift * 5.1, a * 1.3, h.lift * 3.7);
        } else {
          p.holder.position.y = Math.abs(Math.sin(t * 2 + h.phase)) * 0.05;
        }
      });

      while (struck < strikes.length && t >= strikes[struck]!) {
        bolts[struck % bolts.length]!.visible = true;
        boltClock = 0.12;
        strike();
        struck++;
      }
      boltClock -= dt;
      if (boltClock <= 0) for (const b of bolts) b.visible = false;

      if (t < T.cave) {
        const k = t / T.cave;
        camera.position.set(-1 + k * 2.2, 3.2 - k * 0.6, 9 - k * 1.5);
        camera.lookAt(hero.holder.position.x * 0.6 + 1, 1, 0);
      } else {
        // Over the winner's shoulder from just inside the cave, the storm beyond.
        const push = smooth(T.cave, T.end, t);
        const h = hero.holder.position;
        camera.position.set(h.x + 1.4 - push * 0.25, 1.0, h.z + 1.3 - push * 0.2);
        camera.lookAt(h.x - 3, 0.3 + Math.sin(t) * 0.03, h.z - 0.8);
      }
      wet.step(dt, camera.position);
    },
  };
};

// ---------- 2. Summit howl ----------

const summit: Director = ({ scene, camera, hero, pack }) => {
  const H = 5;
  const R = 11;
  const heightAt = (r: number) => H * Math.max(0, 1 - r / R);
  const slope = Math.atan(H / R);
  scene.background = new THREE.Color('#0a0820');
  scene.fog = new THREE.Fog('#0a0820', 18, 50);
  stars(scene);
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(R, H, 40, 6), new THREE.MeshStandardMaterial({ color: '#d9d4ef', roughness: 0.9, flatShading: true }));
  mountain.position.y = H / 2;
  mountain.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#2a2150', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(mountain, floor);
  // A huge moon low over the shoulder of the peak, and the aurora.
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 16), new THREE.MeshBasicMaterial({ color: '#f1ecff', fog: false }));
  moon.position.set(26, 10, -18);
  scene.add(moon);
  const ribbons = [0, 1, 2].map((k) => {
    const geo = new THREE.PlaneGeometry(46, 5, 60, 1);
    const count = geo.attributes.position!.count;
    const colours = new Float32Array(count * 3);
    const low = new THREE.Color(k === 1 ? '#7a5cc4' : '#5fd3a0');
    const high = new THREE.Color('#a58bd6');
    for (let v = 0; v < count; v++) {
      const c = geo.attributes.position!.getY(v) > 0 ? high : low;
      colours.set([c.r, c.g, c.b], v * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    mesh.position.set(6, 9.5 + k * 1.4, -26 - k * 3);
    mesh.rotation.x = 0.25;
    scene.add(mesh);
    return { mesh, base: Float32Array.from(geo.attributes.position!.array as Float32Array) };
  });
  const snow = snowfall(scene, 500);
  const puffs = bursts(scene, 800, 0.16);

  const climbFrom = 8.5;
  // On the east slope, below the moon, where the camera looks once the winner sits.
  const placed = pack.map((p) => ({ ang: -Math.PI * spread(p.i, pack.length, 0.08, 0.5), r: 3.4 + (p.i % 2) * 1.1, slip: 4.6 + p.i * 0.55, slid: 0, puffed: false }));
  const T = { climb: [0.2, 3.6], sit: [3.7, 4.3], howl: [4.3, 6.0], end: 9.4 } as const;
  return {
    end: T.end,
    update(t, dt) {
      // Climb the slope from the west, nose uphill, then sit up and howl at the moon.
      const k = smooth(T.climb[0], T.climb[1], t);
      const r = climbFrom * (1 - k) + 0.35 * k;
      hero.holder.position.set(-r, heightAt(r) + (k > 0 && k < 1 ? Math.abs(Math.sin(t * 10)) * 0.08 : 0), 0);
      const sit = smooth(T.sit[0], T.sit[1], t);
      hero.holder.rotation.z = slope * (1 - sit) + 1.25 * sit + 0.12 * bump(T.howl[0], T.howl[1], t);

      placed.forEach((s, j) => {
        const p = pack[j]!;
        if (t > s.slip) {
          if (!s.puffed) {
            s.puffed = true;
            puffs.fire(p.holder.position.clone(), 40, 2.5, '#efeaff', 1.5, 0.4);
          }
          s.slid += dt;
          s.r += s.slid * 9 * dt;
        }
        const y = s.r < R ? heightAt(s.r) : Math.max(-3, -(s.r - R) * 2);
        p.holder.position.set(Math.cos(s.ang) * s.r, y, Math.sin(s.ang) * s.r);
        p.holder.rotation.set(s.slid * 6, Math.PI - s.ang, s.slid > 0 ? s.slid * 8 : slope);
      });

      ribbons.forEach(({ mesh, base }, j) => {
        const pos = mesh.geometry.attributes.position!;
        for (let v = 0; v < pos.count; v++) pos.setY(v, base[v * 3 + 1]! + Math.sin(base[v * 3]! * 0.25 + t * (0.8 + j * 0.3)) * 1.2);
        pos.needsUpdate = true;
      });
      snow(dt, t);
      puffs.step(dt);

      if (t < T.sit[0]) {
        camera.position.set(-r - 2.5, heightAt(r) + 2.4, 6.5);
        camera.lookAt(-r + 1.5, heightAt(r) + 0.6, 0);
      } else {
        // Low and to the side of the peak: the winner in profile against the moon.
        const push = smooth(T.sit[0], T.end, t);
        camera.position.set(-3.6 + push * 0.6, H + 1.0, 4.2 - push * 0.6);
        camera.lookAt(3, H - 0.6, -3.5);
      }
    },
  };
};

// ---------- 3. Frozen lake ----------

const lake: Director = ({ scene, camera, hero, pack }) => {
  scene.background = new THREE.Color('#0c0a22');
  scene.fog = new THREE.Fog('#0c0a22', 16, 45);
  stars(scene);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: '#b9d3ec', roughness: 0.12, metalness: 0.15 }));
  ice.rotation.x = -Math.PI / 2;
  ice.receiveShadow = true;
  const bank = new THREE.Mesh(new THREE.TorusGeometry(9.4, 0.7, 10, 64), new THREE.MeshStandardMaterial({ color: '#e9e4f7', roughness: 1 }));
  bank.rotation.x = Math.PI / 2;
  const land = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#d9d4ef', roughness: 1 }));
  land.rotation.x = -Math.PI / 2;
  land.position.y = -0.02;
  scene.add(land, ice, bank);
  pines(scene, (i) => {
    const a = (i / 24) * Math.PI * 2;
    return [Math.cos(a) * (12 + (i % 3)), Math.sin(a) * (12 + (i % 3))];
  }, 24);
  const snow = snowfall(scene, 300);
  const splash = bursts(scene, 900, 0.14);
  const crackMat = new THREE.LineBasicMaterial({ color: '#ffffff' });
  const hole = new THREE.MeshBasicMaterial({ color: '#081428' });

  const placed = pack.map((p) => {
    const ang = Math.PI * spread(p.i, pack.length, 0.75, 1.25);
    const at = new THREE.Vector3(Math.cos(ang) * 4.6, 0, Math.sin(ang) * 4.6);
    p.holder.position.copy(at);
    p.holder.rotation.y = -ang;
    const lines: THREE.Vector3[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.random();
      const len = 0.9 + Math.random() * 0.7;
      lines.push(at.clone().setY(0.01), at.clone().add(new THREE.Vector3(Math.cos(a) * len, 0.01, Math.sin(a) * len)));
    }
    const crack = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), crackMat);
    crack.visible = false;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), hole);
    water.rotation.x = -Math.PI / 2;
    water.position.copy(at).setY(0.005);
    water.visible = false;
    scene.add(crack, water);
    return { at, crack, water, cracks: 5.0 + p.i * 0.6, sunk: false };
  });
  const T = { glide: [0.2, 3.0], spin: [3.0, 4.2], bow: [4.3, 5.0], end: 9.2 } as const;
  return {
    end: T.end,
    update(t, dt) {
      // Glide in on a curve, spin twice, then a deep bow.
      const g = smooth(T.glide[0], T.glide[1], t);
      const a = Math.PI * (1.1 - g * 1.1);
      hero.holder.position.set(Math.cos(a) * 6 * (1 - g), 0, Math.sin(a) * 6 * (1 - g) + 0.4 * g);
      hero.holder.rotation.y = -a - Math.PI / 2 + Math.PI * 4 * smooth(T.spin[0], T.spin[1], t);
      hero.holder.rotation.z = -0.55 * bump(T.bow[0], T.bow[1], t);

      placed.forEach((s, j) => {
        const p = pack[j]!;
        if (t > s.cracks) s.crack.visible = true;
        const drop = t - s.cracks - 0.45;
        if (drop > 0) {
          if (!s.sunk) {
            s.sunk = true;
            s.water.visible = true;
            splash.fire(s.at.clone().setY(0.1), 70, 3.2, '#a9c4e8', 2.5, 0.8);
          }
          p.holder.position.y = -Math.min(2.5, drop * drop * 4);
          p.holder.rotation.x = drop * 2.2;
        } else {
          p.holder.position.y = Math.abs(Math.sin(t * 2.4 + j)) * 0.04;
        }
      });
      snow(dt, t);
      splash.step(dt);
      const orbit = 0.35 + t * 0.09;
      camera.position.set(Math.cos(orbit) * 9.5, 4.2 - smooth(0, T.end, t) * 1.2, Math.sin(orbit) * 9.5);
      camera.lookAt(0, 0.4, 0);
    },
  };
};

// ---------- 4. Fireworks ----------

const fireworks: Director = ({ scene, camera, hero, pack, strike }) => {
  scene.background = new THREE.Color('#07051a');
  scene.fog = null;
  stars(scene);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#1e1838', roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.receiveShadow = true;
  scene.add(meadow);
  pines(scene, (i) => [-18 + i * 2.1, -9 - (i % 3) * 1.6], 18);
  const stone = new THREE.MeshStandardMaterial({ color: '#4a3d6e', roughness: 0.9, flatShading: true });
  const step = (x: number, h: number) => {
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.4), stone);
    block.position.set(x, h / 2, 0);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  };
  step(0, 1.3);
  step(-1.7, 0.8);
  step(1.7, 0.5);
  hero.holder.position.set(0, 1.3, 0);
  hero.holder.rotation.y = -Math.PI / 2;
  camera.fov = 55;
  camera.updateProjectionMatrix();
  const sparks = bursts(scene, 2400, 0.13);
  // Second and third place on the lower steps; anyone else on the grass beside them.
  const spots: [number, number][] = [[-1.7, 0.8], [1.7, 0.5], [-3.5, 0], [3.5, 0], [-4.7, 0]];
  const launch = pack.map((p) => {
    const [x, y] = spots[p.i] ?? [0, 0];
    p.holder.position.set(x, y, 0.1);
    p.holder.rotation.y = -Math.PI / 2;
    return { base: p.holder.position.clone(), at: 2.4 + p.i * 0.95, popped: false, v: 0 };
  });
  const T = { finale: 7.4, end: 9.6 } as const;
  let finale = false;
  return {
    end: T.end,
    update(t, dt) {
      // The winner rears up proudly on the top step, with a little hop.
      hero.holder.rotation.z = 0.5 * smooth(0.6, 1.4, t) + 0.15 * bump(1.4, 2.2, t);
      hero.holder.position.y = 1.3 + Math.abs(Math.sin(t * 3)) * 0.06 * smooth(1.4, 2.0, t);

      launch.forEach((l, j) => {
        const p = pack[j]!;
        if (t < l.at) {
          p.holder.position.y = l.base.y + Math.abs(Math.sin(t * 5 + j)) * 0.04;
          return;
        }
        if (l.popped) return;
        l.v += dt * 14;
        p.holder.position.y += l.v * dt;
        p.holder.rotation.x += dt * 9;
        p.holder.rotation.z += dt * 6;
        sparks.fire(p.holder.position.clone().add(new THREE.Vector3(0, -0.3, 0)), 3, 0.8, '#f2b04a', -2, 0.3);
        if (p.holder.position.y > 7 + j * 0.4) {
          l.popped = true;
          p.holder.visible = false;
          sparks.fire(p.holder.position.clone(), 220, 7, p.colour, 0, 0.35);
        }
      });
      if (!finale && t > T.finale) {
        finale = true;
        for (const [dx, dy] of [[-4, 7.5], [0, 9], [4, 7.5]] as const) sparks.fire(new THREE.Vector3(dx, dy, -2), 260, 7, hero.colour, 0, 0.3);
        sparks.fire(new THREE.Vector3(0, 8.5, -2), 200, 8, '#f2c94c', 0, 0.3);
        strike();
      }
      sparks.step(dt);
      const up = smooth(2.2, 4.5, t);
      camera.position.set(Math.sin(t * 0.15) * 1.6, 2.2 + up * 0.6, 10.5 + up * 1.2);
      camera.lookAt(0, 2.2 + up * 2.4, 0);
    },
  };
};

const DIRECTORS: Readonly<Record<WinnerSceneId, Director>> = { storm, summit, lake, fireworks };

/** A random cutscene, for the end of a real game. */
export function randomWinnerScene(): WinnerSceneId {
  return WINNER_SCENES[Math.floor(Math.random() * WINNER_SCENES.length)]!.id;
}

/**
 * Run a winner cutscene on `canvas` until it ends or `signal` aborts. Resolves either way.
 * `onStrike` fires with each flash (lightning, a splash, a firework) for a screen flash.
 */
export async function runWinnerScene(
  canvas: HTMLCanvasElement,
  winner: Contender,
  losers: readonly Contender[],
  signal: AbortSignal,
  onStrike: () => void,
  id: WinnerSceneId = randomWinnerScene(),
): Promise<void> {
  // Carve everyone first, so the scene never shows a placeholder.
  await Promise.all([winner, ...losers].map((c) => requestWolfGeometry(designFor(c.animal) ?? WINTER_WOLF_DESIGN, GAME_STEP)));
  if (signal.aborted) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0716');
  scene.fog = new THREE.Fog('#0b0716', 10, 30);
  const sky = new THREE.HemisphereLight('#8d80b3', '#120c22', 0.75);
  const moonLight = new THREE.DirectionalLight('#cdbff5', 1.4);
  moonLight.position.set(-4, 9, 5);
  moonLight.castShadow = true;
  Object.assign(moonLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  const flash = new THREE.AmbientLight('#ffffff', 0);
  scene.add(sky, moonLight, flash);

  const hero = { ...actor(winner), colour: winner.colour };
  scene.add(hero.holder);
  const pack: Cast[] = losers.map((l, i) => {
    const a = actor(l);
    scene.add(a.holder);
    return { ...a, i, colour: l.colour };
  });
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140); // a director may widen the lens
  const shot = DIRECTORS[id]({
    scene,
    camera,
    hero,
    pack,
    strike: () => {
      flash.intensity = 3.2;
      onStrike();
    },
  });

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const start = performance.now();
  let last = start;
  await new Promise<void>((done) => {
    const frame = (now: number) => {
      if (signal.aborted) return done();
      const t = Math.max(0, now - start) / 1000;
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      if (t >= shot.end) return done();
      shot.update(t, dt);
      flash.intensity = Math.max(0, flash.intensity - dt * 9);
      scene.updateMatrixWorld();
      for (const a of [hero, ...pack]) a.wobble?.update(dt, a.model.matrixWorld);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  window.removeEventListener('resize', resize);
  renderer.dispose();
}
