import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WINTER_WOLF_DESIGN } from '../../src/animals/wolf-design';
import { Wobble } from '../../src/render/wobble';

const at = (x: number, spin = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0.2, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(spin, spin * 0.7, 0)), new THREE.Vector3(0.88, 0.88, 0.88));
const finite = (w: Wobble) => w.bones.every((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w].every(Number.isFinite));

describe('Feature: the floppy rig survives bad frames', () => {
  it('Scenario: Given one NaN frame mid-tumble (a replay reading frame -1), Then the bones stay finite and keep moving', () => {
    const w = new Wobble(WINTER_WOLF_DESIGN);
    for (let i = 0; i < 10; i++) w.update(1 / 60, at(i * 0.1, i * 0.3));
    w.update(1 / 60, new THREE.Matrix4().set(NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, 0, 0, 0, 1));
    for (let i = 10; i < 30; i++) w.update(1 / 60, at(i * 0.1, i * 0.3));
    expect(finite(w), 'Then no bone is poisoned by the bad frame').toBe(true);
    expect(w.bones.some((b) => b.quaternion.angleTo(new THREE.Quaternion()) > 0.01), 'Then the rig still flops').toBe(true);
  });

  it('Scenario: Given a collapsed (zero-scale) frame, Then the bones stay finite', () => {
    const w = new Wobble(WINTER_WOLF_DESIGN);
    w.update(1 / 60, at(0));
    w.update(1 / 60, new THREE.Matrix4().makeScale(0, 0, 0));
    w.update(1 / 60, at(0.1, 0.4));
    expect(finite(w), 'Then the bones are still real numbers').toBe(true);
  });
});

describe('Feature: an animal body repairs itself', () => {
  it('Scenario: Given a carved, floppy animal whose bones have gone bad, When the scene checks it, Then the rig is straightened and the body is whole', async () => {
    const { createWolfMesh } = await import('../../src/render/wolf-mesh');
    const group = createWolfMesh(WINTER_WOLF_DESIGN, { step: 0.035, collar: '#a58bd6', wobble: true });
    const wobble = group.userData.wobble as Wobble;
    wobble.bones[3]!.quaternion.set(NaN, 0, 0, 1);
    const health = (group.userData.check as () => { verts: number; bonesOk: boolean; healed: string })();
    expect(health.healed, 'Then the bad bones are repaired').toContain('bones');
    expect(finite(wobble), 'Then every bone is a real number again').toBe(true);
    expect(health.verts, 'Then the carved body is there').toBeGreaterThan(300);
  });
});
