/**
 * Naive surface nets: turns a signed-distance function into a smooth triangle mesh.
 * One vertex per cell that the surface crosses, placed at the mean of its edge crossings,
 * and one quad per grid edge that crosses the surface.
 */
export interface Bounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface MeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

const CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function surfaceNets(sdf: (x: number, y: number, z: number) => number, bounds: Bounds, step: number): MeshData {
  const [x0, y0, z0] = bounds.min;
  const nx = Math.ceil((bounds.max[0] - x0) / step) + 1;
  const ny = Math.ceil((bounds.max[1] - y0) / step) + 1;
  const nz = Math.ceil((bounds.max[2] - z0) / step) + 1;
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const field = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) field[idx(i, j, k)] = sdf(x0 + i * step, y0 + j * step, z0 + k * step);

  const cellVertex = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        const v: number[] = [];
        for (let c = 0; c < 8; c++) {
          const [di, dj, dk] = CORNERS[c]!;
          const f = field[idx(i + di, j + dj, k + dk)]!;
          v.push(f);
          if (f < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const fa = v[a]!;
          const fb = v[b]!;
          if (fa < 0 === fb < 0) continue;
          const t = fa / (fa - fb);
          const ca = CORNERS[a]!;
          const cb = CORNERS[b]!;
          sx += ca[0] + (cb[0] - ca[0]) * t;
          sy += ca[1] + (cb[1] - ca[1]) * t;
          sz += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        cellVertex[idx(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * step, y0 + (j + sy / n) * step, z0 + (k + sz / n) * step);
      }

  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, d, c, a, c, b);
    else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const inside = field[idx(i, j, k)]! < 0;
        // Edge along X: cells sharing it differ in j and k.
        if (inside !== field[idx(i + 1, j, k)]! < 0) {
          quad(cellVertex[idx(i, j, k)]!, cellVertex[idx(i, j - 1, k)]!, cellVertex[idx(i, j - 1, k - 1)]!, cellVertex[idx(i, j, k - 1)]!, !inside);
        }
        if (inside !== field[idx(i, j + 1, k)]! < 0) {
          quad(cellVertex[idx(i, j, k)]!, cellVertex[idx(i, j, k - 1)]!, cellVertex[idx(i - 1, j, k - 1)]!, cellVertex[idx(i - 1, j, k)]!, !inside);
        }
        if (inside !== field[idx(i, j, k + 1)]! < 0) {
          quad(cellVertex[idx(i, j, k)]!, cellVertex[idx(i - 1, j, k)]!, cellVertex[idx(i - 1, j - 1, k)]!, cellVertex[idx(i, j - 1, k)]!, !inside);
        }
      }

  // Normals from the field gradient: smooth, and independent of triangle winding.
  const positions = new Float32Array(pos);
  const normals = new Float32Array(pos.length);
  const e = step * 0.5;
  for (let v = 0; v < positions.length; v += 3) {
    const x = positions[v]!;
    const y = positions[v + 1]!;
    const z = positions[v + 2]!;
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const len = Math.hypot(gx, gy, gz) || 1;
    normals[v] = gx / len;
    normals[v + 1] = gy / len;
    normals[v + 2] = gz / len;
  }

  // Fix winding against the gradient so back-face culling and shadows behave.
  const indices = new Uint32Array(tris);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3;
    const b = indices[t + 1]! * 3;
    const c = indices[t + 2]! * 3;
    const ux = positions[b]! - positions[a]!;
    const uy = positions[b + 1]! - positions[a + 1]!;
    const uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!;
    const vy = positions[c + 1]! - positions[a + 1]!;
    const vz = positions[c + 2]! - positions[a + 2]!;
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    const dot = fx * normals[a]! + fy * normals[a + 1]! + fz * normals[a + 2]!;
    if (dot < 0) {
      const tmp = indices[t + 1]!;
      indices[t + 1] = indices[t + 2]!;
      indices[t + 2] = tmp;
    }
  }
  return { positions, normals, indices };
}
