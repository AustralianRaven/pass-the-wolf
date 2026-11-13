import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { AnimalDefinition, BodyPart } from '../animals/body';
import { capsuleRotation } from '../physics/dice-world';

function partMesh(part: BodyPart, material: THREE.Material): THREE.Mesh {
  switch (part.kind) {
    case 'capsule': {
      const [fx, fy, fz] = part.from;
      const [tx, ty, tz] = part.to;
      const length = Math.hypot(tx - fx, ty - fy, tz - fz);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(part.radius, length, 3, 8), material);
      mesh.position.set((fx + tx) / 2, (fy + ty) / 2, (fz + tz) / 2);
      const q = capsuleRotation(part.from, part.to);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
      return mesh;
    }
    case 'ball': {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(part.radius, 1), material);
      mesh.position.set(...part.at);
      return mesh;
    }
    case 'box': {
      const [hx, hy, hz] = part.half;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), material);
      mesh.position.set(...part.at);
      return mesh;
    }
    case 'hull':
      return new THREE.Mesh(new ConvexGeometry(part.points.map((p) => new THREE.Vector3(...p))), material);
  }
}

/** Crescent moon shape for the flank mark. */
function moonShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false);
  s.absarc(r * 0.45, 0, r * 0.8, Math.PI * 1.55, Math.PI * 0.45, true);
  return s;
}

/**
 * A carved-wood die built from the same part list as its collider.
 * Flat shading and low tessellation give a whittled, faceted look.
 */
export function createDieMesh(animal: AnimalDefinition, collar: string): THREE.Group {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: animal.palette.body, roughness: 0.62, metalness: 0, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: animal.palette.accent, roughness: 0.8, flatShading: true });
  animal.parts.forEach((part, i) => {
    // Ears (the small boxes high on the head) and the snout tip take the accent stain.
    const isAccent = part.kind === 'box' && part.at[1] > 0.6 && i > 0;
    const mesh = partMesh(part, isAccent ? accent : wood);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const mark = new THREE.Mesh(
    new THREE.ShapeGeometry(moonShape(0.07)),
    new THREE.MeshStandardMaterial({ color: animal.palette.accent, roughness: 0.9, side: THREE.DoubleSide }),
  );
  const [mx, my, mz] = animal.markAt;
  mark.position.set(mx, my, mz + 0.105);
  group.add(mark);

  // A painted collar band in the seat colour, so you can tell whose wolves are whose.
  const collarMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.022, 6, 14),
    new THREE.MeshStandardMaterial({ color: collar, roughness: 0.5 }),
  );
  collarMesh.position.set(0.36, 0.47, 0);
  collarMesh.rotation.set(0, Math.PI / 2, -0.85);
  collarMesh.name = 'collar';
  group.add(collarMesh);
  return group;
}

export function setCollarColour(group: THREE.Group, colour: string): void {
  const collar = group.getObjectByName('collar') as THREE.Mesh | undefined;
  if (collar) (collar.material as THREE.MeshStandardMaterial).color.set(colour);
}
