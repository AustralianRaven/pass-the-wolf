import * as THREE from 'three';
import type { AnimalDefinition } from '../animals/body';
import { ARENA, type DiceWorld } from '../physics/dice-world';
import { DIREWOLVES } from '../animals/direwolves';
import { createDieMesh, setCollarColour } from './die-mesh';
import { createDirewolfMesh, requestDirewolfGeometry } from './direwolf-mesh';
import { pineTexture, woolTexture } from './textures';

/** In-game detail: the dice are small on screen, so a coarser sculpt builds faster. */
export const GAME_STEP = 0.014;

function meshFor(animal: AnimalDefinition, collar: string): THREE.Group {
  const design = DIREWOLVES.find((d) => d.id === animal.scoring.id);
  if (!design) return createDieMesh(animal, collar);
  // Until the sculpted body is carved, show the collider hulls in the wolf's coat colour.
  const placeholder = createDieMesh(animal, collar);
  placeholder.getObjectByName('collar')?.removeFromParent();
  return createDirewolfMesh(design, { step: GAME_STEP, collar, async: true, placeholder });
}

/** Start carving every direwolf in a background worker as soon as the page loads. */
export function prewarmDirewolves(): void {
  for (const d of DIREWOLVES) void requestDirewolfGeometry(d, GAME_STEP);
}

/** Three.js view of the table: wool blanket, pine tray, two carved dice, warm lamp light. */
export class TableScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private dieMeshes: THREE.Group[] = [];
  private readonly aim: THREE.Line;
  private readonly raycaster = new THREE.Raycaster();
  private readonly tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color('#14100d');

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.camera.position.set(0, 12.5, 9.6);
    this.camera.lookAt(0, 0, 0.9);

    this.buildLights();
    this.buildTable();

    const aimGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.aim = new THREE.Line(aimGeometry, new THREE.LineBasicMaterial({ color: '#e9dcc4', transparent: true, opacity: 0.85 }));
    this.aim.visible = false;
    this.scene.add(this.aim);

    this.resize();
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffe2bf', '#2a1610', 0.55));
    const lamp = new THREE.DirectionalLight('#ffd7a3', 2.6);
    lamp.position.set(-6, 18, 6);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    const s = lamp.shadow.camera;
    s.left = -ARENA.halfX - 1;
    s.right = ARENA.halfX + 1;
    s.top = ARENA.halfZ + 1;
    s.bottom = -ARENA.halfZ - 1;
    lamp.shadow.bias = -0.0005;
    lamp.shadow.radius = 4;
    this.scene.add(lamp);
    const fill = new THREE.PointLight('#ff9a5a', 18, 40, 1.6);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
  }

  private buildTable(): void {
    const wool = woolTexture();
    wool.repeat.set(ARENA.halfX / 2, ARENA.halfZ / 2);
    const blanket = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfX * 2, ARENA.halfZ * 2),
      new THREE.MeshStandardMaterial({ map: wool, roughness: 0.98, metalness: 0 }),
    );
    blanket.rotation.x = -Math.PI / 2;
    blanket.receiveShadow = true;
    this.scene.add(blanket);

    const pine = pineTexture();
    const rimMaterial = new THREE.MeshStandardMaterial({ map: pine, roughness: 0.55, color: '#d9a466' });
    const rimHeight = 0.9;
    const t = 0.6;
    const rims: Array<[number, number, number, number]> = [
      [0, -(ARENA.halfZ + t / 2), ARENA.halfX * 2 + t * 2, t],
      [0, ARENA.halfZ + t / 2, ARENA.halfX * 2 + t * 2, t],
      [-(ARENA.halfX + t / 2), 0, t, ARENA.halfZ * 2],
      [ARENA.halfX + t / 2, 0, t, ARENA.halfZ * 2],
    ];
    for (const [x, z, w, d] of rims) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w, rimHeight, d), rimMaterial);
      rim.position.set(x, rimHeight / 2, z);
      rim.castShadow = true;
      rim.receiveShadow = true;
      this.scene.add(rim);
    }

    const tableTexture = pineTexture(11);
    tableTexture.repeat.set(3, 3);
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 60),
      new THREE.MeshStandardMaterial({ map: tableTexture, color: '#7a5233', roughness: 0.7 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.02;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  /** Replace the dice meshes (new turn may bring different animals or seat colour). */
  setDice(animals: readonly [AnimalDefinition, AnimalDefinition], collar: string): void {
    for (const m of this.dieMeshes) this.scene.remove(m);
    this.dieMeshes = animals.map((a) => {
      const m = meshFor(a, collar);
      this.scene.add(m);
      return m;
    });
  }

  setCollar(colour: string): void {
    for (const m of this.dieMeshes) setCollarColour(m, colour);
  }

  /** Copy body transforms from physics onto the meshes. */
  sync(world: DiceWorld): void {
    world.dice.forEach((die, i) => {
      const mesh = this.dieMeshes[i];
      if (!mesh) return;
      const p = die.body.translation();
      const q = die.body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
    });
  }

  /** Point on the table under a screen position, or null when off the table. */
  pick(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.tablePlane, hit) ? hit : null;
  }

  showAim(from: THREE.Vector3 | null, to?: THREE.Vector3): void {
    if (!from || !to) {
      this.aim.visible = false;
      return;
    }
    const pos = this.aim.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, 0.05, from.z);
    pos.setXYZ(1, to.x, 0.05, to.z);
    pos.needsUpdate = true;
    this.aim.visible = true;
  }

  showAimFrom(from: THREE.Vector3, angle: number, length: number): void {
    this.showAim(from, new THREE.Vector3(from.x + Math.cos(angle) * length, 0, from.z + Math.sin(angle) * length));
  }

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole tray in view on narrower windows.
    this.camera.fov = w / h < 1.5 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
