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

/**
 * Run the winner scene on `canvas` until it ends or `signal` aborts. Resolves either way.
 * `onStrike` fires with each lightning flash (for a screen flash in the DOM).
 */
export async function runWinnerScene(canvas: HTMLCanvasElement, winner: Contender, losers: readonly Contender[], signal: AbortSignal, onStrike: () => void): Promise<void> {
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
  const sky = new THREE.HemisphereLight('#8d80b3', '#120c22', 0.7);
  const moon = new THREE.DirectionalLight('#cdbff5', 1.4);
  moon.position.set(-4, 9, 5);
  moon.castShadow = true;
  Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  const flash = new THREE.AmbientLight('#ffffff', 0);
  scene.add(sky, moon, flash);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#241a3d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, cave());
  // A few pines on the skyline.
  const pine = new THREE.MeshStandardMaterial({ color: '#1a1330', roughness: 1, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.2, 3 + (i % 4), 6), pine);
    tree.position.set(-14 + i * 1.9, 1.5 + (i % 4) / 2, -7 - (i % 3) * 1.4);
    scene.add(tree);
  }
  const storm = rain(900);
  scene.add(storm.lines);
  const twister = tornado();
  twister.group.visible = false;
  scene.add(twister.group);
  const bolts = [bolt(-2, -5), bolt(6, -6), bolt(-6, -4)];
  scene.add(...bolts);

  const hero = actor(winner);
  hero.holder.position.set(-3.6, 0, 0.4);
  hero.holder.rotation.y = 0;
  scene.add(hero.holder);
  const pack = losers.map((l, i) => {
    const a = actor(l);
    const row = i - (losers.length - 1) / 2;
    a.holder.position.set(-4.6 + Math.abs(row) * 0.5, 0, row * 1.6 - 0.4);
    a.holder.rotation.y = 0.3 - row * 0.2;
    scene.add(a.holder);
    return { ...a, home: a.holder.position.clone(), spin: 3 + i * 0.7, phase: i * 1.9 };
  });

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const T = WINNER_TIMELINE;
  const strikes = [T.strike, T.strike + 0.35, 5.6, 7.4];
  let struck = 0;
  const start = performance.now();
  let last = start;

  await new Promise<void>((done) => {
    const frame = (now: number) => {
      if (signal.aborted) return done();
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (t >= T.end) return done();

      // The winner trots to the cave mouth with a bob, then turns round to watch: the mog.
      const trot = smooth(T.trot[0] + 0.3, T.trot[1], t);
      const mouth = CAVE_AT.x - 1.5;
      hero.holder.position.x = -3.6 + (mouth + 0.2 - -3.6) * trot;
      hero.holder.position.z = 0.4 * (1 - trot);
      hero.holder.position.y = trot > 0 && trot < 1 ? Math.abs(Math.sin(t * 11)) * 0.12 : 0;
      const turn = smooth(T.cave + 0.2, T.cave + 1.3, t);
      hero.holder.rotation.y = Math.PI * turn;
      // Chin up, a slow smug tilt once it has turned.
      hero.holder.rotation.z = -0.12 * smooth(T.cave + 1.1, T.cave + 1.8, t);

      // The losers shuffle, then the tornado crosses and takes them up its side.
      const across = smooth(T.tornado[0], T.tornado[1], t);
      twister.group.visible = t > T.tornado[0] - 0.4;
      twister.group.position.set(-11 + across * 11, 0, -0.4);
      twister.spin(t);
      for (const p of pack) {
        const dx = p.home.x - twister.group.position.x;
        const caught = t > T.tornado[0] && Math.abs(dx) < 2.2 ? 1 : p.holder.userData.caught ?? 0;
        if (caught) {
          p.holder.userData.caught = 1;
          p.holder.userData.lift = (p.holder.userData.lift ?? 0) + dt;
          const lift = p.holder.userData.lift as number;
          const a = lift * p.spin + p.phase;
          const r = 0.8 + lift * 0.9;
          p.holder.position.set(twister.group.position.x + Math.cos(a) * r, Math.min(9, lift * 2.6), twister.group.position.z + Math.sin(a) * r);
          p.holder.rotation.set(lift * 5.1, a * 1.3, lift * 3.7);
        } else {
          p.holder.position.y = Math.abs(Math.sin(t * 2 + p.phase)) * 0.05;
          p.holder.rotation.y += Math.sin(t * 3 + p.phase) * 0.004;
        }
      }

      // Lightning: a bolt and a flash at each strike time.
      while (struck < strikes.length && t >= strikes[struck]!) {
        bolts[struck % bolts.length]!.visible = true;
        flash.intensity = 3.2;
        onStrike();
        struck++;
      }
      flash.intensity = Math.max(0, flash.intensity - dt * 9);
      if (flash.intensity < 0.6) for (const b of bolts) b.visible = false;

      // Camera: the wide trot shot, then from inside the cave looking out past the winner.
      if (t < T.cave) {
        const k = t / T.cave;
        camera.position.set(-1 + k * 2.2, 3.2 - k * 0.6, 9 - k * 1.5);
        camera.lookAt(hero.holder.position.x * 0.6 + 1, 1, 0);
      } else {
        // At the cave mouth, just inside the rock: the winner's profile up close, the storm beyond.
        // Over the winner's shoulder from just inside the cave, the storm beyond.
        const push = smooth(T.cave, T.end, t);
        const h = hero.holder.position;
        camera.position.set(h.x + 1.4 - push * 0.25, 1.0, h.z + 1.3 - push * 0.2);
        camera.lookAt(h.x - 3, 0.3 + Math.sin(t) * 0.03, h.z - 0.8);
      }

      storm.step(dt, camera.position);
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
