import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { AnimalDefinition, BodyPart, Vec3 } from '../animals/body';
import type { GenericPose } from '../rules/poses';
import { classifyPose } from './classify';
import { createRng } from './rng';

type Rapier = typeof RAPIER_NS;
type RigidBody = RAPIER_NS.RigidBody;
type Collider = RAPIER_NS.Collider;

/**
 * Scale: one unit is about 4 cm (a wolf die is ~1 unit long), so gravity is 9.81 / 0.04.
 * Real-world gravity at this scale is what makes the tumble look small and quick
 * instead of floaty.
 */
export const GRAVITY = -245;
export const TIMESTEP = 1 / 240;
/** Arena half-extents (the blanket inside the tray walls). */
export const ARENA = { halfX: 5.4, halfZ: 3.5, wallHeight: 3 } as const;

const WOOD = { friction: 0.55, restitution: 0.32 };
const WOOL = { friction: 0.85, restitution: 0.18 };
const WALL = { friction: 0.4, restitution: 0.45 };

const REST_LINEAR = 0.05;
const REST_ANGULAR = 0.12;
/** Consecutive quiet steps before a die counts as stopped (~0.25 s). */
const REST_STEPS = 60;
/** Give up waiting after this many steps (~12 s) and read whatever is there. */
export const MAX_STEPS = 240 * 12;
/** Contact gap that still counts as "touching". */
const TOUCH_DISTANCE = 0.02;

export interface ThrowInput {
  /** Launch heading in radians on the table plane; 0 throws toward +X. */
  readonly angle: number;
  /** 0 to 1. */
  readonly power: number;
  /** Seeds the jitter: same seed and input, same throw. */
  readonly seed: number;
}

export interface SettledDice {
  readonly poses: readonly [GenericPose, GenericPose];
  readonly touching: boolean;
  readonly stacked: boolean;
  /** True when the dice stopped by themselves rather than by timeout. */
  readonly settled: boolean;
  readonly steps: number;
}

export interface DieBody {
  readonly body: RigidBody;
  readonly colliders: readonly Collider[];
  readonly animal: AnimalDefinition;
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/** Quaternion rotating +Y onto the direction from a to b (capsules are Y-aligned). */
export function capsuleRotation(from: Vec3, to: Vec3): { x: number; y: number; z: number; w: number } {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!);
  const nx = d[0]! / len;
  const ny = d[1]! / len;
  const nz = d[2]! / len;
  // Rotation from (0,1,0) to n: axis = y × n, angle = acos(ny).
  if (ny > 0.999999) return { x: 0, y: 0, z: 0, w: 1 };
  if (ny < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
  const ax = nz;
  const az = -nx;
  const axisLen = Math.hypot(ax, az);
  const half = Math.acos(ny) / 2;
  const s = Math.sin(half) / axisLen;
  return { x: ax * s, y: 0, z: az * s, w: Math.cos(half) };
}

function partCollider(R: Rapier, part: BodyPart): RAPIER_NS.ColliderDesc {
  let desc: RAPIER_NS.ColliderDesc;
  switch (part.kind) {
    case 'capsule': {
      const [fx, fy, fz] = part.from;
      const [tx, ty, tz] = part.to;
      const halfHeight = Math.hypot(tx - fx, ty - fy, tz - fz) / 2;
      const [mx, my, mz] = midpoint(part.from, part.to);
      desc = R.ColliderDesc.capsule(halfHeight, part.radius)
        .setTranslation(mx, my, mz)
        .setRotation(capsuleRotation(part.from, part.to));
      break;
    }
    case 'ball':
      desc = R.ColliderDesc.ball(part.radius).setTranslation(...part.at);
      break;
    case 'box':
      desc = R.ColliderDesc.cuboid(...part.half).setTranslation(...part.at);
      break;
  }
  return desc.setDensity(part.density ?? 1).setFriction(WOOD.friction).setRestitution(WOOD.restitution);
}

/** A physics world with an arena and two animal dice. Works in the browser and headless in Node. */
export class DiceWorld {
  readonly world: RAPIER_NS.World;
  readonly dice: readonly [DieBody, DieBody];
  private readonly floor: Collider;
  private quietSteps = 0;
  private stepCount = 0;

  constructor(
    private readonly R: Rapier,
    animals: readonly [AnimalDefinition, AnimalDefinition],
  ) {
    this.world = new R.World({ x: 0, y: GRAVITY, z: 0 });
    this.world.timestep = TIMESTEP;
    this.world.numSolverIterations = 8;

    const ground = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.floor = this.world.createCollider(
      R.ColliderDesc.cuboid(ARENA.halfX + 1, 0.5, ARENA.halfZ + 1)
        .setTranslation(0, -0.5, 0)
        .setFriction(WOOL.friction)
        .setRestitution(WOOL.restitution),
      ground,
    );
    const h = ARENA.wallHeight;
    const walls: Array<[number, number, number, number, number, number]> = [
      [ARENA.halfX + 0.25, h / 2, 0, 0.25, h / 2, ARENA.halfZ + 0.5],
      [-ARENA.halfX - 0.25, h / 2, 0, 0.25, h / 2, ARENA.halfZ + 0.5],
      [0, h / 2, ARENA.halfZ + 0.25, ARENA.halfX + 0.5, h / 2, 0.25],
      [0, h / 2, -ARENA.halfZ - 0.25, ARENA.halfX + 0.5, h / 2, 0.25],
    ];
    for (const [x, y, z, hx, hy, hz] of walls) {
      this.world.createCollider(
        R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(WALL.friction).setRestitution(WALL.restitution),
        ground,
      );
    }
    // A lid stops a wild throw from leaving the tray.
    this.world.createCollider(R.ColliderDesc.cuboid(ARENA.halfX + 1, 0.25, ARENA.halfZ + 1).setTranslation(0, h * 3, 0), ground);

    this.dice = [this.createDie(animals[0], -1), this.createDie(animals[1], 1)];
  }

  private createDie(animal: AnimalDefinition, side: number): DieBody {
    const body = this.world.createRigidBody(
      this.R.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.05, side * 1.2)
        .setCcdEnabled(true)
        .setLinearDamping(0.05)
        .setAngularDamping(0.25),
    );
    const colliders = animal.parts.map((p) => this.world.createCollider(partCollider(this.R, p), body));
    return { body, colliders, animal };
  }

  /** Launch both dice from the thrower's edge. Jitter comes from the seed. */
  throwDice(input: ThrowInput): void {
    const rng = createRng(input.seed);
    const power = Math.min(1, Math.max(0, input.power));
    const speed = 9 + power * 15;
    const dirX = Math.cos(input.angle);
    const dirZ = Math.sin(input.angle);
    // Start behind the centre, opposite the throw direction.
    const startX = -dirX * (ARENA.halfX - 1.4);
    const startZ = -dirZ * (ARENA.halfZ - 1.1);

    this.dice.forEach((die, i) => {
      const offset = (i === 0 ? -1 : 1) * 1.1;
      const yaw = rng() * Math.PI * 2;
      const pitch = (rng() - 0.5) * Math.PI;
      const roll = rng() * Math.PI * 2;
      die.body.setTranslation({ x: startX - dirZ * offset, y: 2.2 + rng() * 0.6, z: startZ + dirX * offset }, true);
      die.body.setRotation(eulerToQuat(pitch, yaw, roll), true);
      const spread = (i === 0 ? -1 : 1) * (0.12 + rng() * 0.25);
      const v = speed * (0.9 + rng() * 0.2);
      die.body.setLinvel(
        { x: v * Math.cos(input.angle + spread), y: 6 + rng() * 6, z: v * Math.sin(input.angle + spread) },
        true,
      );
      const spin = 18 + power * 26;
      die.body.setAngvel({ x: (rng() - 0.5) * spin, y: (rng() - 0.5) * spin, z: (rng() - 0.5) * spin }, true);
    });
    this.quietSteps = 0;
    this.stepCount = 0;
  }

  /** Advance one fixed timestep. Returns true once both dice are at rest. */
  step(): boolean {
    this.world.step();
    this.stepCount++;
    const quiet = this.dice.every(({ body }) => {
      if (body.isSleeping()) return true;
      const v = body.linvel();
      const w = body.angvel();
      return Math.hypot(v.x, v.y, v.z) < REST_LINEAR && Math.hypot(w.x, w.y, w.z) < REST_ANGULAR;
    });
    this.quietSteps = quiet ? this.quietSteps + 1 : 0;
    return this.isAtRest();
  }

  isAtRest(): boolean {
    return this.quietSteps >= REST_STEPS;
  }

  get steps(): number {
    return this.stepCount;
  }

  /** Step until both dice rest or the step budget runs out. */
  settle(maxSteps = MAX_STEPS): SettledDice {
    while (this.stepCount < maxSteps && !this.step()) {
      /* stepping */
    }
    return this.read();
  }

  private dieTouchesCollider(die: DieBody, other: Collider): boolean {
    let touching = false;
    for (const c of die.colliders) {
      this.world.contactPair(c, other, (manifold) => {
        for (let i = 0; i < manifold.numContacts(); i++) {
          if (manifold.contactDist(i) < TOUCH_DISTANCE) touching = true;
        }
      });
      if (touching) return true;
    }
    return false;
  }

  private diceTouch(): boolean {
    const [a, b] = this.dice;
    return b.colliders.some((c) => this.dieTouchesCollider(a, c));
  }

  /** Read the current poses and contacts. */
  read(): SettledDice {
    const [a, b] = this.dice;
    const touching = this.diceTouch();
    const aOnFloor = this.dieTouchesCollider(a, this.floor);
    const bOnFloor = this.dieTouchesCollider(b, this.floor);
    return {
      poses: [classifyPose(a.body.rotation()), classifyPose(b.body.rotation())],
      touching,
      stacked: touching && (!aOnFloor || !bOnFloor),
      settled: this.isAtRest(),
      steps: this.stepCount,
    };
  }

  /** Place a die at an exact pose (used by tests and the debug view). */
  place(index: 0 | 1, position: Vec3, rotation: { x: number; y: number; z: number; w: number }): void {
    const die = this.dice[index];
    die.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    die.body.setRotation(rotation, true);
    die.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    die.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.quietSteps = 0;
    this.stepCount = 0;
  }

  free(): void {
    this.world.free();
  }
}

/** Intrinsic X (pitch), Y (yaw), Z (roll) Euler angles to a quaternion. */
export function eulerToQuat(x: number, y: number, z: number): { x: number; y: number; z: number; w: number } {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

/** Load Rapier's WASM once. */
let rapierPromise: Promise<Rapier> | null = null;
export function loadRapier(): Promise<Rapier> {
  rapierPromise ??= import('@dimforge/rapier3d-compat').then(async (mod) => {
    const R = (mod.default ?? mod) as Rapier;
    await R.init();
    return R;
  });
  return rapierPromise;
}
