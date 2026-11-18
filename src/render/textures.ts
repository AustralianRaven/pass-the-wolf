import * as THREE from 'three';
import { createRng } from '../physics/rng';

function finish(c: HTMLCanvasElement, anisotropy = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

/** Night-violet felt for the tray floor: a soft nap of short fibres, no pattern. */
export function feltTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3156';
  g.fillRect(0, 0, size, size);
  const rng = createRng(7);
  for (let i = 0; i < 14000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const a = rng() * Math.PI;
    const len = 2 + rng() * 4;
    g.strokeStyle = rng() > 0.55 ? 'rgba(200, 186, 245, 0.06)' : 'rgba(10, 6, 24, 0.14)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  return finish(c, 8);
}

/**
 * A carved lino block: dark violet ground with pale gouge strokes running one way,
 * the marks a cutter leaves when clearing a field. Used for the tray rim and the table.
 */
export function carvedTexture(seed = 3, ground = '#241a40', ink = 'rgba(214, 204, 246, 0.16)'): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rng = createRng(seed);
  g.fillStyle = ground;
  g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 18 + rng() * 60;
    const bend = (rng() - 0.5) * 8;
    g.strokeStyle = ink;
    g.lineWidth = 1.2 + rng() * 2.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y + bend, x + len, y + (rng() - 0.5) * 3);
    g.stroke();
  }
  return finish(c);
}
