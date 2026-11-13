import type { DirewolfDesign } from '../animals/direwolves';
import { noise3, sculptDistance, type Sculpt } from './sdf';
import { surfaceNets } from './surface-nets';

/**
 * Sculpts and paints a direwolf into plain typed arrays. No three.js here, so it runs in a
 * Web Worker and the page never freezes while a wolf is being carved.
 */
export interface WolfArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colours: Float32Array;
  readonly indices: Uint32Array;
}

type RGB = [number, number, number];

/** Hex sRGB to linear RGB (what three.js expects in vertex colours). */
function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

function mix(c: RGB, to: RGB, t: number): void {
  if (t <= 0) return;
  const k = Math.min(1, t);
  c[0] += (to[0] - c[0]) * k;
  c[1] += (to[1] - c[1]) * k;
  c[2] += (to[2] - c[2]) * k;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Crescent moon in the flank plane: inside a disc, outside a smaller offset disc. */
function inMoon(dx: number, dy: number, r: number): number {
  const outer = Math.hypot(dx, dy);
  const inner = Math.hypot(dx - r * 0.45, dy - r * 0.1);
  return smooth(r, r * 0.88, outer) * smooth(r * 0.72, r * 0.84, inner);
}

export function sculptWolfArrays(design: DirewolfDesign, step: number): WolfArrays {
  const sculpt: Sculpt = { parts: design.parts, fur: design.fur, blend: 0.05 };
  const w = design.width;
  const sdf = (x: number, y: number, z: number) => sculptDistance(sculpt, x, y, z / w);
  const halfZ = 0.3 * w;
  const mesh = surfaceNets(sdf, { min: [-0.9, -0.05, -halfZ], max: [0.95, 1.05, halfZ] }, step);

  const base = rgb(design.coat.base);
  const saddle = rgb(design.coat.saddle);
  const under = rgb(design.coat.under);
  const markColour = rgb(design.coat.mark);
  const black = rgb('#141110');
  const tailEnd = Math.min(...design.parts.filter((p) => p.kind === 'cone').map((p) => Math.min(p.a[0], p.b[0])));
  const [hx, hy] = design.head;
  const [nx, ny, nz] = design.nose;
  const [mx, my] = design.markAt;

  const colours = new Float32Array(mesh.positions.length);
  for (let v = 0; v < mesh.positions.length; v += 3) {
    const x = mesh.positions[v]!;
    const y = mesh.positions[v + 1]!;
    const z = mesh.positions[v + 2]!;
    const nY = mesh.normals[v + 1]!;
    const nZ = mesh.normals[v + 2]!;
    const c: RGB = [base[0], base[1], base[2]];
    // Dark saddle over the back and down the top of the neck.
    mix(c, saddle, smooth(0.15, 0.75, nY) * smooth(0.32, 0.5, y) * (x < hx - 0.05 ? 0.85 : 0.35));
    // Pale underside, inner legs and throat.
    mix(c, under, smooth(-0.05, -0.65, nY) * 0.9);
    // Pale muzzle and cheeks.
    if (x > hx) mix(c, under, smooth(0.0, -0.4, nY - 0.15) * 0.8);
    // Lower legs fade lighter, paws darker.
    if (y < 0.2) mix(c, under, 0.25 * (1 - y / 0.2));
    if (y < 0.05) mix(c, saddle, 0.35);
    // Ear tips and tail tip.
    if (y > hy + 0.12) mix(c, saddle, 0.7);
    if (x < tailEnd + 0.09) mix(c, saddle, smooth(tailEnd + 0.09, tailEnd, x) * 0.8);
    // Grizzle: banded hairs read as flecks of light and dark.
    const g = noise3(x * 60, y * 140, (z / w) * 140);
    if (g > 0.7) mix(c, under, design.coat.grizzle * (g - 0.7) * 2.5);
    else if (g < 0.3) mix(c, saddle, design.coat.grizzle * (0.3 - g) * 2.5);
    // Nose pad.
    const dn = Math.hypot(x - nx, y - ny, z / w - nz);
    if (dn < 0.045) mix(c, black, smooth(0.045, 0.02, dn));
    // The moon mark, painted on the +Z flank only: it tells Moon side from Plain side.
    if (z > 0 && nZ > 0.35) mix(c, markColour, inMoon(x - mx, y - my, 0.075) * smooth(0.35, 0.6, nZ));
    colours[v] = c[0];
    colours[v + 1] = c[1];
    colours[v + 2] = c[2];
  }
  return { positions: mesh.positions, normals: mesh.normals, colours, indices: mesh.indices };
}
