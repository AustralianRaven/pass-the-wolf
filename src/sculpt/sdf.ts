/**
 * Signed-distance sculpting: a body is a smooth union of simple parts.
 * Negative inside, positive outside. Units match the dice (about 1 unit nose to tail).
 */
export type V3 = readonly [number, number, number];

export type SculptPart =
  /** Tapered capsule from a (radius ra) to b (radius rb). */
  | { readonly kind: 'cone'; readonly a: V3; readonly b: V3; readonly ra: number; readonly rb: number; readonly blend?: number; readonly fur?: number; readonly group?: string }
  /** Axis-aligned ellipsoid. */
  | { readonly kind: 'ellipsoid'; readonly c: V3; readonly r: V3; readonly blend?: number; readonly fur?: number; readonly group?: string };

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

/** Polynomial smooth minimum: blends two surfaces over a width of k. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

function sdEllipsoid(px: number, py: number, pz: number, c: V3, r: V3): number {
  const x = px - c[0];
  const y = py - c[1];
  const z = pz - c[2];
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** Round cone (capsule with two radii), after Inigo Quilez. */
function sdRoundCone(px: number, py: number, pz: number, a: V3, b: V3, r1: number, r2: number): number {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0];
  const pay = py - a[1];
  const paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y;
  const qy = pay * l2 - bay * y;
  const qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// ---------- value noise for fur ----------

function hash(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** Fur: noise stretched along the body (X) so it reads as strands flowing back. */
function furNoise(x: number, y: number, z: number): number {
  return noise3(x * 9, y * 34, z * 34) * 0.65 + noise3(x * 22, y * 70, z * 70) * 0.35 - 0.5;
}

export interface Sculpt {
  readonly parts: readonly SculptPart[];
  /** Overall fur displacement depth. */
  readonly fur: number;
  /** Default blend width between parts. */
  readonly blend: number;
}

export function partDistance(p: SculptPart, x: number, y: number, z: number): number {
  return p.kind === 'cone' ? sdRoundCone(x, y, z, p.a, p.b, p.ra, p.rb) : sdEllipsoid(x, y, z, p.c, p.r);
}

/** Distance to the sculpted body, including fur. */
export function sculptDistance(s: Sculpt, x: number, y: number, z: number): number {
  let d = Infinity;
  let furAmount = 0;
  let nearest = Infinity;
  for (const p of s.parts) {
    const pd = partDistance(p, x, y, z);
    d = d === Infinity ? pd : smin(d, pd, p.blend ?? s.blend);
    if (pd < nearest) {
      nearest = pd;
      furAmount = p.fur ?? 1;
    }
  }
  return d - s.fur * furAmount * furNoise(x, y, z);
}
