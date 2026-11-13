import * as THREE from 'three';
import { createRng } from '../physics/rng';

/** Buffalo-check wool: red ground, black bands crossing, with fibre noise. */
export function woolTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const cell = size / 4;
  g.fillStyle = '#8f1717';
  g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(20, 14, 12, 0.5)';
  for (let i = 0; i < 4; i += 2) {
    g.fillRect(i * cell, 0, cell, size);
    g.fillRect(0, i * cell, size, cell);
  }
  // Woven fibre: short strokes in both directions.
  const rng = createRng(7);
  for (let i = 0; i < 9000; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const horizontal = rng() > 0.5;
    const light = rng() > 0.5;
    g.strokeStyle = light ? 'rgba(255, 210, 190, 0.07)' : 'rgba(0, 0, 0, 0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (horizontal ? 6 : 0.6), y + (horizontal ? 0.6 : 6));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Knotty pine planks with grain lines and the odd knot. */
export function pineTexture(seed = 3): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rng = createRng(seed);
  g.fillStyle = '#c4904f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const y = rng() * h;
    g.strokeStyle = `rgba(110, 62, 24, ${0.08 + rng() * 0.18})`;
    g.lineWidth = 0.6 + rng() * 1.6;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3 + (rng() - 0.5) * 2);
    g.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 5 + rng() * 7;
    for (let ring = r; ring > 0; ring -= 2) {
      g.strokeStyle = `rgba(90, 48, 18, ${0.5 - ring / (r * 3)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, ring * 1.6, ring, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
