import * as THREE from 'three';
import type { WolfDesign } from '../animals/wolf-design';
import { partDistance, type V3 } from '../sculpt/sdf';

/**
 * Floppy tail, ears and legs (issue #3). Render-only secondary motion: the carved wolf is skinned
 * to a few bones, and each bone's tip is a spring-damped particle in world space. The hitbox, the
 * mass and the landing pose never see any of it, so the calibrated odds are untouched.
 *
 * - Tail and ears are soft: they whip about in a tumble and hang a little under gravity at rest.
 * - Legs are stiff: they flail on impact and in the hand, then spring back to nearly straight.
 */

type Kind = 'tail' | 'ear' | 'leg';

interface BoneSpec {
  readonly kind: Kind;
  /** Sculpt part groups that move with this bone. */
  readonly groups: readonly string[];
  readonly pivot: V3;
  readonly tip: V3;
  /** Index of the parent bone in the spec list, or -1 for the body. */
  readonly parent: number;
}

/**
 * Spring stiffness (1/s²), velocity kept per 1/240 s step, and the furthest a bone may swing (rad).
 * Damped close to critical, so a tail just drops and settles within about a second of the landing
 * instead of ringing. keep = 1 - 2·ζ·√k·step, with ζ about 0.7 for tail and ears, 0.45 for legs.
 */
const FEEL: Readonly<Record<Kind, { k: number; keep: number; maxAngle: number }>> = {
  tail: { k: 900, keep: 0.825, maxAngle: 1.3 },
  ear: { k: 2000, keep: 0.74, maxAngle: 0.8 },
  leg: { k: 5000, keep: 0.735, maxAngle: 0.55 },
};
/** A softened gravity (world units/s²): enough to droop the tail and ears, not to wilt the legs. */
const SAG = new THREE.Vector3(0, -40, 0);
const STEP = 1 / 240;
/** A jump bigger than this in one frame is a teleport (a reset or a new turn): snap to rest. */
const TELEPORT = 1.5;
/** Width over which a vertex blends between its two nearest bones. */
const BLEND = 0.04;

/** The bones for a design, read from its sculpt part groups. */
function rigOf(design: WolfDesign): BoneSpec[] {
  const cones = (g: string) => design.parts.filter((p): p is Extract<typeof p, { kind: 'cone' }> => p.kind === 'cone' && p.group === g);
  const specs: BoneSpec[] = [];
  for (let i = 0; cones(`tail${i}`).length; i++) {
    const c = cones(`tail${i}`)[0]!;
    specs.push({ kind: 'tail', groups: [`tail${i}`], pivot: c.a, tip: c.b, parent: i === 0 ? -1 : specs.length - 1 });
  }
  for (const g of ['earL', 'earR']) {
    const c = cones(g)[0];
    if (c) specs.push({ kind: 'ear', groups: [g], pivot: c.a, tip: c.b, parent: -1 });
  }
  for (let i = 0; cones(`leg${i}u`).length; i++) {
    const upper = cones(`leg${i}u`)[0]!;
    const lower = cones(`leg${i}l`);
    specs.push({ kind: 'leg', groups: [`leg${i}u`], pivot: upper.a, tip: upper.b, parent: -1 });
    if (lower.length) specs.push({ kind: 'leg', groups: [`leg${i}l`], pivot: lower[0]!.a, tip: lower.at(-1)!.b, parent: specs.length - 1 });
  }
  return specs;
}

/**
 * Skin weights for the carved body: each vertex follows its nearest bone (bone 0 is the body),
 * blended with the second nearest across a narrow band so joints bend smoothly. Computed once per
 * geometry and stored on it.
 */
export function skinWolfGeometry(geometry: THREE.BufferGeometry, design: WolfDesign): void {
  if (geometry.getAttribute('skinIndex')) return;
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count === 0) return;
  const specs = rigOf(design);
  const boneOfGroup = new Map<string, number>();
  specs.forEach((s, i) => s.groups.forEach((g) => boneOfGroup.set(g, i + 1)));
  const parts = design.parts.map((p) => ({ p, bone: boneOfGroup.get(p.group ?? '') ?? 0 }));
  const w = design.width;
  const nBones = specs.length + 1;
  const best = new Float64Array(nBones);
  const index = new Uint16Array(pos.count * 4);
  const weight = new Float32Array(pos.count * 4);
  for (let v = 0; v < pos.count; v++) {
    best.fill(Infinity);
    const x = pos.getX(v);
    const y = pos.getY(v);
    const z = pos.getZ(v) / w;
    for (const { p, bone } of parts) best[bone] = Math.min(best[bone]!, partDistance(p, x, y, z));
    let b1 = 0;
    let b2 = -1;
    for (let b = 1; b < nBones; b++) if (best[b]! < best[b1]!) b1 = b;
    for (let b = 0; b < nBones; b++) if (b !== b1 && (b2 < 0 || best[b]! < best[b2]!)) b2 = b;
    const share = b2 < 0 ? 0 : 0.5 * Math.max(0, 1 - (best[b2]! - best[b1]!) / BLEND);
    index[v * 4] = b1;
    index[v * 4 + 1] = Math.max(0, b2);
    weight[v * 4] = 1 - share;
    weight[v * 4 + 1] = share;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
}

interface Particle {
  readonly spec: BoneSpec;
  readonly bone: THREE.Bone;
  /** Rest direction in the model frame (unit) and length in model units. */
  readonly restDir: THREE.Vector3;
  readonly length: number;
  x: THREE.Vector3;
  prev: THREE.Vector3;
  /** This bone's accumulated rotation in the model frame, for its children. */
  readonly turn: THREE.Quaternion;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const modelQ = new THREE.Quaternion();
const modelS = new THREE.Vector3();
const modelP = new THREE.Vector3();

/** The bones of one wolf, and the springs that drive them. */
export class Wobble {
  readonly root = new THREE.Bone();
  private readonly particles: Particle[];
  private ready = false;
  private acc = 0;
  private lastOrigin = new THREE.Vector3();

  constructor(design: WolfDesign) {
    const specs = rigOf(design);
    const bones = specs.map(() => new THREE.Bone());
    this.particles = specs.map((spec, i) => {
      const bone = bones[i]!;
      const parentPivot = spec.parent < 0 ? [0, 0, 0] : specs[spec.parent]!.pivot;
      bone.position.set(spec.pivot[0] - parentPivot[0]!, spec.pivot[1] - parentPivot[1]!, spec.pivot[2] - parentPivot[2]!);
      (spec.parent < 0 ? this.root : bones[spec.parent]!).add(bone);
      const rest = new THREE.Vector3(spec.tip[0] - spec.pivot[0], spec.tip[1] - spec.pivot[1], spec.tip[2] - spec.pivot[2]);
      return { spec, bone, restDir: rest.clone().normalize(), length: rest.length(), x: new THREE.Vector3(), prev: new THREE.Vector3(), turn: new THREE.Quaternion() };
    });
  }

  /** Every bone, body first: the skeleton for a SkinnedMesh. */
  get bones(): THREE.Bone[] {
    return [this.root, ...this.particles.map((p) => p.bone)];
  }

  /** Straighten every bone and forget all motion. */
  reset(): void {
    for (const p of this.particles) p.bone.quaternion.identity();
    this.ready = false;
  }

  /**
   * Advance the springs by `dt` seconds. `model` is the wolf model's world matrix (the carved
   * body's frame): the bones hang off it, so any spin or jolt of the die drives them.
   */
  update(dt: number, model: THREE.Matrix4): void {
    model.decompose(modelP, modelQ, modelS);
    const scale = modelS.x;
    if (!this.ready || modelP.distanceTo(this.lastOrigin) > TELEPORT) {
      this.snap(model, scale);
      this.lastOrigin.copy(modelP);
      return;
    }
    this.lastOrigin.copy(modelP);
    this.acc = Math.min(this.acc + dt, STEP * 8);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      for (const p of this.particles) this.stepParticle(p, model, scale);
    }
    this.pose(model);
  }

  /** World position of a bone's pivot: its parent's simulated tip, or a fixed point on the body. */
  private pivotWorld(p: Particle, model: THREE.Matrix4, out: THREE.Vector3): THREE.Vector3 {
    if (p.spec.parent >= 0) return out.copy(this.particles[p.spec.parent]!.x);
    return out.set(...p.spec.pivot).applyMatrix4(model);
  }

  private snap(model: THREE.Matrix4, scale: number): void {
    for (const p of this.particles) {
      this.pivotWorld(p, model, v1);
      p.x.copy(v2.copy(p.restDir).applyQuaternion(modelQ).multiplyScalar(p.length * scale).add(v1));
      p.prev.copy(p.x);
      p.bone.quaternion.identity();
      p.turn.identity();
    }
    this.ready = true;
  }

  private stepParticle(p: Particle, model: THREE.Matrix4, scale: number): void {
    const feel = FEEL[p.spec.kind];
    const pivot = this.pivotWorld(p, model, v1);
    const restW = v2.copy(p.restDir).applyQuaternion(modelQ);
    const target = v3.copy(restW).multiplyScalar(p.length * scale).add(pivot);
    // Verlet: keep some velocity, pull toward the carved pose, sag under the soft gravity.
    const next = target.sub(p.x).multiplyScalar(feel.k).add(SAG).multiplyScalar(STEP * STEP);
    next.add(p.x).addScaledVector(v4.copy(p.x).sub(p.prev), feel.keep);
    p.prev.copy(p.x);
    // Hold the bone's length, and never let it swing further than it can bend.
    const dir = next.sub(pivot).normalize();
    const angle = dir.angleTo(restW);
    if (angle > feel.maxAngle) {
      q1.setFromUnitVectors(restW, dir);
      q2.identity().slerp(q1, feel.maxAngle / angle);
      dir.copy(restW).applyQuaternion(q2);
    }
    p.x.copy(dir).multiplyScalar(p.length * scale).add(pivot);
  }

  /** Turn each bone to point at its particle, relative to its parent's turn. */
  private pose(model: THREE.Matrix4): void {
    const toModel = q1.copy(modelQ).invert();
    for (const p of this.particles) {
      const dir = v2.copy(p.x).sub(this.pivotWorld(p, model, v1)).applyQuaternion(toModel).normalize();
      p.turn.setFromUnitVectors(p.restDir, dir);
      const parentTurn = p.spec.parent >= 0 ? this.particles[p.spec.parent]!.turn : null;
      p.bone.quaternion.copy(parentTurn ? q2.copy(parentTurn).invert().multiply(p.turn) : p.turn);
    }
  }
}
