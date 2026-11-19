import * as THREE from 'three';
import type { WolfDesign } from '../animals/wolf-design';
import { sculptWolfArrays, type WolfArrays } from '../sculpt/paint-wolf';
import { Wobble, skinWolfGeometry } from './wobble';

export interface WolfMeshOptions {
  /** Grid step: smaller is more detailed and slower. */
  readonly step?: number;
  /** Seat colour for a painted collar; omitted, no collar. */
  readonly collar?: string;
  /** Carve in a worker and fill the body in when ready, instead of blocking the page. */
  readonly async?: boolean;
  /** Shown until the carved body arrives (async only). */
  readonly placeholder?: THREE.Object3D;
  /** Rig the tail, ears and legs to flop (render only). The group's userData.wobble drives it. */
  readonly wobble?: boolean;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();
const pending = new Map<string, Promise<THREE.BufferGeometry>>();
const waiting = new Map<string, (g: THREE.BufferGeometry) => void>();
let worker: Worker | null = null;
/** One carve at a time; urgent requests (dice on the table now) jump the queue. */
const queue: Array<{ id: string; step: number }> = [];
let busy = false;

function pump(): void {
  if (busy || !worker) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  worker.postMessage(job);
}

const keyOf = (design: WolfDesign, step: number) => `${design.id}@${step}`;

/** A body with no vertices yet, but every attribute a skinned mesh reads, until the carving lands. */
function emptyGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([], 4));
  return g;
}

function toGeometry(a: WolfArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.colours, 3));
  g.setIndex(new THREE.BufferAttribute(a.indices, 1));
  return g;
}

/** Sculpt (or reuse) the painted body geometry on the main thread. Fine for the gallery page. */
export function wolfGeometry(design: WolfDesign, step: number): THREE.BufferGeometry {
  const key = keyOf(design, step);
  let g = geometryCache.get(key);
  if (!g) {
    g = toGeometry(sculptWolfArrays(design, step));
    geometryCache.set(key, g);
  }
  return g;
}

/** Sculpt in a Web Worker so the game never freezes; resolves from cache when already carved. */
export function requestWolfGeometry(design: WolfDesign, step: number, urgent = false): Promise<THREE.BufferGeometry> {
  const key = keyOf(design, step);
  const cached = geometryCache.get(key);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(key);
  if (!p) {
    if (!worker) {
      worker = new Worker(new URL('./sculpt.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<WolfArrays & { id: string; step: number }>) => {
        const k = `${e.data.id}@${e.data.step}`;
        const g = toGeometry(e.data);
        geometryCache.set(k, g);
        waiting.get(k)?.(g);
        waiting.delete(k);
        busy = false;
        pump();
      };
    }
    p = new Promise((resolve) => waiting.set(key, resolve));
    pending.set(key, p);
    queue.push({ id: design.id, step });
  }
  if (urgent) {
    const i = queue.findIndex((j) => j.id === design.id && j.step === step);
    if (i > 0) queue.unshift(...queue.splice(i, 1));
  }
  pump();
  return p;
}

/**
 * A painted wolf: coat, moon mark on the +Z flank, amber eyes and an optional seat-coloured
 * collar. Width is stretched by design.width to match the physics collider.
 */
export function createWolfMesh(design: WolfDesign, opts: WolfMeshOptions = {}): THREE.Group {
  const step = opts.step ?? 0.0105;
  const w = design.width;
  const key = keyOf(design, step);
  const ready = geometryCache.get(key);
  const geometry = ready ?? (opts.async ? emptyGeometry() : wolfGeometry(design, step));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  const wobble = opts.wobble ? new Wobble(design) : null;
  if (wobble) skinWolfGeometry(geometry, design);
  const body = wobble ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
  if (body instanceof THREE.SkinnedMesh && wobble) {
    body.add(wobble.root);
    body.bind(new THREE.Skeleton(wobble.bones));
    // Skinned vertices move outside the rest bounds; don't let culling clip a flopping tail.
    body.frustumCulled = false;
  }
  body.castShadow = true;
  body.receiveShadow = true;
  const group = new THREE.Group();
  group.add(body);
  if (wobble) group.userData.wobble = wobble;
  if (opts.async && !ready) {
    if (opts.placeholder) group.add(opts.placeholder);
    void requestWolfGeometry(design, step, true).then((g) => {
      if (wobble) skinWolfGeometry(g, design);
      body.geometry = g;
      if (opts.placeholder) group.remove(opts.placeholder);
    });
  }
  // Eyes are set into the face, not stuck on it: small, flattened against the skull and pushed
  // half their depth into the fur, with a soft ice-blue glint.
  const iced = !design.eyeColour;
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: design.eyeColour ?? '#9fd3f2',
    emissive: iced ? '#3a7fb0' : '#000000',
    emissiveIntensity: iced ? 0.35 : 0,
    roughness: 0.2,
  });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: '#0d0a08' });
  for (const e of design.eyes) {
    const side = Math.sign(e[2]);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 10), eyeMaterial);
    eye.scale.set(1.2, 0.8, 0.55);
    eye.position.set(e[0] - 0.002, e[1], e[2] * w - side * 0.005);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), pupilMaterial);
    pupil.position.set(0.006, 0, side * 0.016);
    eye.add(pupil);
    group.add(eye);
  }

  if (opts.collar && design.marker?.kind === 'bowtie') {
    group.add(createBowTie(opts.collar, design.marker.at, design.marker.size ?? 0.05));
  } else if (opts.collar) {
    const [a, b] = design.neck;
    const at = new THREE.Vector3(a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55, 0);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0).normalize();
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(design.marker?.kind === 'collar' ? (design.marker.radius ?? 0.128) : 0.128, 0.032, 10, 32),
      new THREE.MeshStandardMaterial({ color: opts.collar, roughness: 0.35, emissive: opts.collar, emissiveIntensity: 0.25 }),
    );
    collar.name = 'collar';
    collar.position.copy(at);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    collar.scale.set(1, w, 1);
    group.add(collar);
  }
  return group;
}

/** A bow tie in the player's colour, facing forward (+X) at the throat. Named 'collar' so recolouring finds it. */
function createBowTie(colour: string, at: readonly [number, number, number], size: number): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, emissive: colour, emissiveIntensity: 0.25 });
  const tie = new THREE.Group();
  tie.name = 'collar';
  for (const side of [1, -1]) {
    // Each wing is a flattened cone, its point at the knot, flaring out to the side.
    const wing = new THREE.Mesh(new THREE.ConeGeometry(size * 0.75, size * 1.5, 4), material);
    wing.rotation.x = side * (Math.PI / 2);
    wing.position.set(0, 0, side * size * 0.75);
    wing.scale.set(1, 1, 0.45);
    tie.add(wing);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.38, 12, 8), material);
  tie.add(knot);
  tie.position.set(...at);
  return tie;
}
