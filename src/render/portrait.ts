import * as THREE from 'three';
import type { AnimalDefinition } from '../animals/body';
import { WOLF_DESIGNS } from '../animals/wolf-design';
import type { GenericPose } from '../rules/poses';
import { GAME_STEP } from './scene';
import { createWolfMesh, requestWolfGeometry } from './wolf-mesh';
import { feltTexture } from './textures';
import { DiceWorld, loadRapier } from '../physics/dice-world';
import { demoThrow, stageAlpha } from '../demo/results';
import demoSeeds from '../demo/demo-seeds.json';

/**
 * Still renders of the real wolf model in each resting pose, for the score sheet tiles and the
 * wolf picker. One small offscreen renderer is shared and every image is cached.
 */

/** World-up in the body frame for each pose, as the pig hitbox actually rests (tools/rests.ts). */
const POSE_UP: Readonly<Record<GenericPose, readonly [number, number, number]>> = {
  sideMarkUp: [0, 0.2, 0.98],
  sideMarkDown: [0, 0.2, -0.98],
  back: [0, -1, 0],
  upright: [0, 1, 0],
  noseDown: [-0.79, 0.61, 0],
  lean: [-0.68, 0.28, -0.68],
  tailDown: [0.9, 0.43, 0],
};

export type PortraitScene =
  | { readonly kind: 'pair'; readonly poses: readonly [GenericPose, GenericPose] }
  | { readonly kind: 'single'; readonly pose: GenericPose }
  | { readonly kind: 'touching' }
  | { readonly kind: 'alpha' };

const W = 360;
const H = 220;
let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();

function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
  }
  return renderer;
}

/** A wolf posed so `up` (body frame) points at the sky, turned to face the camera, resting on the felt. */
function posedWolf(animal: AnimalDefinition, collar: string, up: readonly [number, number, number], yaw: number): THREE.Group {
  const design = WOLF_DESIGNS.find((d) => d.id === animal.scoring.id) ?? WOLF_DESIGNS[0]!;
  const model = createWolfMesh(design, { step: GAME_STEP, collar });
  const fit = animal.fit ?? { scale: 1, offset: [0, 0, 0] as const };
  model.scale.setScalar(fit.scale);
  model.position.set(...fit.offset);
  const holder = new THREE.Group();
  holder.add(model);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...up).normalize(), new THREE.Vector3(0, 1, 0));
  holder.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q));
  // Drop it onto the felt: lowest point at y = 0.
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.y = -box.min.y;
  holder.traverse((o) => {
    o.castShadow = true;
  });
  return holder;
}

/**
 * The wolves exactly where the physics leaves them, centred on the felt. Used for the Tangled
 * and Alpha tiles so they show a landing that really scores, not a staged one.
 */
async function physicsWolves(animal: AnimalDefinition, collar: string, setup: (w: DiceWorld) => void): Promise<THREE.Group[]> {
  const world = new DiceWorld(await loadRapier(), [animal, animal]);
  setup(world);
  const poses = world.dice.map((d) => world.visiblePose(d));
  world.free();
  const cx = (poses[0]!.at[0] + poses[1]!.at[0]) / 2;
  const cz = (poses[0]!.at[2] + poses[1]!.at[2]) / 2;
  const design = WOLF_DESIGNS.find((d) => d.id === animal.scoring.id) ?? WOLF_DESIGNS[0]!;
  const fit = animal.fit ?? { scale: 1, offset: [0, 0, 0] as const };
  return poses.map(({ at, q }) => {
    const model = createWolfMesh(design, { step: GAME_STEP, collar });
    model.scale.setScalar(fit.scale);
    model.position.set(...fit.offset);
    const holder = new THREE.Group();
    holder.add(model);
    holder.position.set(at[0] - cx, at[1], at[2] - cz);
    holder.quaternion.set(q.x, q.y, q.z, q.w);
    holder.traverse((o) => {
      o.castShadow = true;
    });
    return holder;
  });
}

const SEEDS = demoSeeds as Record<string, number>;

function stage(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1e1533');
  scene.add(new THREE.HemisphereLight('#cdbff5', '#1a1030', 0.9));
  const key = new THREE.DirectionalLight('#ebe6f5', 2.4);
  key.position.set(2, 5, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
  scene.add(key);
  const felt = feltTexture();
  felt.repeat.set(2, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ map: felt, color: '#ffffff', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return scene;
}

/** Render one tile's scene to a PNG data URL. Waits for the wolf to be carved the first time. */
export async function renderPortrait(animal: AnimalDefinition, collar: string, shot: PortraitScene): Promise<string> {
  const key = `${animal.scoring.id}|${collar}|${JSON.stringify(shot)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const design = WOLF_DESIGNS.find((d) => d.id === animal.scoring.id) ?? WOLF_DESIGNS[0]!;
  await requestWolfGeometry(design, GAME_STEP);

  const scene = stage();
  const wolves: THREE.Group[] = [];
  if (shot.kind === 'single') {
    wolves.push(posedWolf(animal, collar, POSE_UP[shot.pose], 0.5));
  } else if (shot.kind === 'pair') {
    const a = posedWolf(animal, collar, POSE_UP[shot.poses[0]], 0.4);
    const b = posedWolf(animal, collar, POSE_UP[shot.poses[1]], 0.9);
    a.position.x -= 0.62;
    b.position.x += 0.62;
    b.position.z -= 0.2;
    wolves.push(a, b);
  } else if (shot.kind === 'touching') {
    // The demo page's Tangled throw: a real landing where the visible wolves touch.
    const seed = SEEDS.tangled;
    wolves.push(
      ...(await physicsWolves(animal, collar, (w) => {
        if (seed === undefined) {
          w.place(0, [0, 0.02, 0], { x: 0, y: 0, z: 0, w: 1 });
          w.place(1, [0.15, 0.02, 0.5], { x: 0, y: 0, z: 0, w: 1 });
        } else w.throwDice(demoThrow(seed));
        w.settle();
      })),
    );
  } else {
    // The piggyback: one wolf set on the other's back and let settle, so it really rides.
    wolves.push(
      ...(await physicsWolves(animal, collar, (w) => {
        stageAlpha(w);
        w.settle();
      })),
    );
  }
  for (const w of wolves) scene.add(w);

  const centre = new THREE.Box3();
  for (const w of wolves) centre.expandByObject(w);
  const c = centre.getCenter(new THREE.Vector3());
  const size = centre.getSize(new THREE.Vector3()).length();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  camera.position.set(c.x + size * 0.55, c.y + size * 0.75, c.z + size * 1.55);
  camera.lookAt(c.x, c.y * 0.7, c.z);

  const r = getRenderer();
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
