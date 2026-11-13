import * as THREE from 'three';
import type { DirewolfDesign } from '../animals/direwolves';
import { sculptWolfArrays, type WolfArrays } from '../sculpt/paint-wolf';

export interface DirewolfMeshOptions {
  /** Grid step: smaller is more detailed and slower. */
  readonly step?: number;
  /** Seat colour for a painted collar; omitted, no collar. */
  readonly collar?: string;
  /** Carve in a worker and fill the body in when ready, instead of blocking the page. */
  readonly async?: boolean;
  /** Shown until the carved body arrives (async only). */
  readonly placeholder?: THREE.Object3D;
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

const keyOf = (design: DirewolfDesign, step: number) => `${design.id}@${step}`;

function toGeometry(a: WolfArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(a.colours, 3));
  g.setIndex(new THREE.BufferAttribute(a.indices, 1));
  return g;
}

/** Sculpt (or reuse) the painted body geometry on the main thread. Fine for the gallery page. */
export function direwolfGeometry(design: DirewolfDesign, step: number): THREE.BufferGeometry {
  const key = keyOf(design, step);
  let g = geometryCache.get(key);
  if (!g) {
    g = toGeometry(sculptWolfArrays(design, step));
    geometryCache.set(key, g);
  }
  return g;
}

/** Sculpt in a Web Worker so the game never freezes; resolves from cache when already carved. */
export function requestDirewolfGeometry(design: DirewolfDesign, step: number, urgent = false): Promise<THREE.BufferGeometry> {
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
 * A painted direwolf: coat, moon mark on the +Z flank, amber eyes and an optional seat-coloured
 * collar. Width is stretched by design.width to match the physics collider.
 */
export function createDirewolfMesh(design: DirewolfDesign, opts: DirewolfMeshOptions = {}): THREE.Group {
  const step = opts.step ?? 0.0105;
  const w = design.width;
  const key = keyOf(design, step);
  const ready = geometryCache.get(key);
  const geometry = ready ?? (opts.async ? new THREE.BufferGeometry() : direwolfGeometry(design, step));
  const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }));
  body.castShadow = true;
  body.receiveShadow = true;
  const group = new THREE.Group();
  group.add(body);
  if (opts.async && !ready) {
    if (opts.placeholder) group.add(opts.placeholder);
    void requestDirewolfGeometry(design, step, true).then((g) => {
      body.geometry = g;
      if (opts.placeholder) group.remove(opts.placeholder);
    });
  }
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#f2b233', emissive: '#c77a10', emissiveIntensity: 0.9, roughness: 0.2 });
  for (const e of design.eyes) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8), eyeMaterial);
    eye.position.set(e[0], e[1], e[2] * w);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: '#0d0a08' }));
    pupil.position.set(0.01, 0, Math.sign(e[2]) * 0.009);
    eye.add(pupil);
    group.add(eye);
  }

  if (opts.collar) {
    const [a, b] = design.neck;
    const at = new THREE.Vector3(a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3, 0);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0).normalize();
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.022, 8, 24),
      new THREE.MeshStandardMaterial({ color: opts.collar, roughness: 0.45 }),
    );
    collar.name = 'collar';
    collar.position.copy(at);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    collar.scale.set(1, w, 1);
    group.add(collar);
  }
  return group;
}
