import * as THREE from 'three';
import type { AnimalDefinition } from '../animals/body';
import { ARENA, hexWalls, type DiceWorld } from '../physics/dice-world';
import { DESIGNS as WOLF_DESIGNS } from '../animals/designs';
import { createDieMesh, createHitboxMesh, setCollarColour } from './die-mesh';
import { createWolfMesh, requestWolfGeometry } from './wolf-mesh';
import { carvedTexture, feltTexture } from './textures';
import type { Wobble } from './wobble';

/** In-game detail: the dice are small on screen, so a coarser sculpt builds faster. */
export const GAME_STEP = 0.014;

function meshFor(animal: AnimalDefinition, collar: string): THREE.Group {
  const design = WOLF_DESIGNS.find((d) => d.id === animal.scoring.id);
  if (!design) return createDieMesh(animal, collar);
  // Until the sculpted body is carved, show the collider hulls in the wolf's coat colour.
  const placeholder = createDieMesh(animal, collar);
  placeholder.getObjectByName('collar')?.removeFromParent();
  const model = createWolfMesh(design, { step: GAME_STEP, collar, async: true, placeholder, wobble: true });
  // Display-only animal: fitted inside the shared hitbox by its own scale and offset.
  const fit = animal.fit ?? { scale: 1, offset: [0, 0, 0] as const };
  model.scale.setScalar(fit.scale);
  model.position.set(...fit.offset);
  model.name = 'model';
  const group = new THREE.Group();
  group.add(model);
  return group;
}

/** Body-frame sample of the physics hitbox, used to keep the visible animal on the felt. */
function hitboxPoints(animal: AnimalDefinition): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const part of animal.parts) {
    if (part.kind === 'hull') for (const p of part.points) out.push(new THREE.Vector3(p[0], p[1], p[2]));
    else if (part.kind === 'ball') out.push(new THREE.Vector3(...part.at));
  }
  return out;
}

/** Body-frame sample of a carved mesh's vertices (every nth, fit applied), once its geometry has arrived. */
function meshPoints(group: THREE.Group): THREE.Vector3[] | null {
  const model = group.getObjectByName('model') ?? group;
  const body = model.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  const pos = body?.geometry.getAttribute('position');
  if (!body || !pos || pos.count === 0) return null;
  model.updateMatrix();
  body.updateMatrix();
  const toBody = new THREE.Matrix4().multiplyMatrices(model === group ? new THREE.Matrix4() : model.matrix, body.matrix);
  const stride = Math.max(1, Math.floor(pos.count / 600));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += stride) out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(toBody));
  return out;
}

const tmp = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
/** Lowest world-height offset of a point cloud under a rotation. */
function lowest(points: readonly THREE.Vector3[], q: THREE.Quaternion): number {
  let min = Infinity;
  for (const p of points) min = Math.min(min, tmp.copy(p).applyQuaternion(q).y);
  return min;
}

/** Start carving every wolf in a background worker as soon as the page loads. */
export function prewarmWolves(): void {
  for (const d of WOLF_DESIGNS) void requestWolfGeometry(d, GAME_STEP);
}

/** Three.js view of the table: violet felt tray, carved rim, two wolves, cold moonlight. */
export class TableScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private readonly scene = new THREE.Scene();
  private dieMeshes: THREE.Group[] = [];
  private wobbleOn = true;
  private lastRender = 0;
  private hitboxMeshes: THREE.Group[] = [];
  private showHitboxes = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color('#120c22');

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.camera.position.set(0, 12.5, 9.6);
    this.camera.lookAt(0, 0, 0.9);

    this.buildLights();
    this.buildTable();


    this.resize();
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight('#cdbff5', '#1a1030', 0.6));
    const lamp = new THREE.DirectionalLight('#ebe6f5', 2.2);
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
    const fill = new THREE.PointLight('#9b7ae0', 22, 40, 1.6);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
  }

  private buildTable(): void {
    const felt = feltTexture();
    felt.repeat.set(ARENA.radius / 2, ARENA.radius / 2);
    const blanket = new THREE.Mesh(
      // A six-segment circle is a hexagon with its corners at ±X, matching the physics walls.
      new THREE.CircleGeometry(ARENA.radius + 0.05, 6),
      new THREE.MeshStandardMaterial({ map: felt, roughness: 0.98, metalness: 0 }),
    );
    blanket.rotation.x = -Math.PI / 2;
    blanket.receiveShadow = true;
    this.scene.add(blanket);

    const rimMaterial = new THREE.MeshStandardMaterial({ map: carvedTexture(), roughness: 0.6, color: '#b9a8e6' });
    const rimHeight = 0.9;
    const t = 0.6;
    for (const w of hexWalls()) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(t, rimHeight, ARENA.radius + t * 0.62), rimMaterial);
      rim.position.set(w.x + Math.cos(w.heading) * (t / 2), rimHeight / 2, w.z + Math.sin(w.heading) * (t / 2));
      rim.rotation.y = -w.heading;
      rim.castShadow = true;
      rim.receiveShadow = true;
      this.scene.add(rim);
    }

    const tableTexture = carvedTexture(11, '#160f2b', 'rgba(170, 150, 230, 0.10)');
    tableTexture.repeat.set(3, 3);
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 60),
      new THREE.MeshStandardMaterial({ map: tableTexture, color: '#ffffff', roughness: 0.8 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.02;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  /** Replace the dice meshes (new turn may bring different animals or seat colour). */
  setDice(animals: readonly [AnimalDefinition, AnimalDefinition], collar: string): void {
    for (const m of this.dieMeshes) this.scene.remove(m);
    for (const h of this.hitboxMeshes) this.scene.remove(h);
    this.hitboxMeshes = animals.map((a) => {
      const h = createHitboxMesh(a);
      h.visible = this.showHitboxes;
      this.scene.add(h);
      return h;
    });
    this.dieMeshes = animals.map((a) => {
      const m = meshFor(a, collar);
      m.userData.hitbox = hitboxPoints(a);
      this.scene.add(m);
      return m;
    });
  }

  setCollar(colour: string): void {
    for (const m of this.dieMeshes) setCollarColour(m, colour);
  }

  /** Copy body transforms from physics onto the meshes. */
  /** Debug view: draw the real physics hitboxes over the wolves. */
  setShowHitboxes(show: boolean): void {
    this.showHitboxes = show;
    for (const h of this.hitboxMeshes) h.visible = show;
  }

  sync(world: DiceWorld): void {
    world.dice.forEach((die, i) => {
      const mesh = this.dieMeshes[i];
      if (!mesh) return;
      const p = die.body.translation();
      const q = die.body.rotation();
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
      // The visible animal is slimmer than its hitbox: lift or drop it so its lowest point sits
      // exactly where the hitbox's lowest point does, so it never floats or sinks into the felt.
      const ud = mesh.userData as { hitbox?: THREE.Vector3[]; visible?: THREE.Vector3[] | null };
      ud.visible ??= meshPoints(mesh);
      let lift = 0;
      if (ud.hitbox?.length && ud.visible?.length) {
        tmpQ.set(q.x, q.y, q.z, q.w);
        lift = lowest(ud.hitbox, tmpQ) - lowest(ud.visible, tmpQ);
      }
      mesh.position.set(p.x, p.y + lift, p.z);
      // The hitbox wireframe stays exactly where the physics has it.
      this.hitboxMeshes[i]?.position.set(p.x, p.y, p.z);
      this.hitboxMeshes[i]?.quaternion.set(q.x, q.y, q.z, q.w);
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

  resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole tray in view on narrower windows.
    this.camera.fov = w / h < 1.5 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  /** Midpoint of the two wolves, for the cutscene camera. */
  diceCentre(): THREE.Vector3 {
    const c = new THREE.Vector3();
    for (const m of this.dieMeshes) c.add(m.position);
    return c.multiplyScalar(1 / Math.max(1, this.dieMeshes.length));
  }

  /** How far apart the two wolves lie on the felt. */
  diceSpan(): number {
    const [a, b] = this.dieMeshes;
    return a && b ? Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) : 0;
  }

  private readonly homePosition = new THREE.Vector3(0, 12.5, 9.6);
  private readonly homeTarget = new THREE.Vector3(0, 0, 0.9);
  private readonly lookTarget = new THREE.Vector3(0, 0, 0.9);
  private shot: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromLook: THREE.Vector3; toLook: THREE.Vector3; start: number; ms: number } | null = null;

  /**
   * Glide the camera to a low close-up on a point (the landed wolves), or back home with null.
   * Exponential ease-out, so the move lands softly.
   */
  focusOn(target: THREE.Vector3 | null, ms = 900): void {
    const toLook = target ? target.clone().setY(0.35) : this.homeTarget.clone();
    // Pull back far enough to frame both wolves, however far apart they landed.
    const reach = Math.max(4, this.diceSpan() * 1.25 + 2.4);
    const dir = new THREE.Vector3(1.6, 2.6, 3.1).normalize();
    const toPos = target ? target.clone().setY(0).addScaledVector(dir, reach) : this.homePosition.clone();
    this.shot = { fromPos: this.camera.position.clone(), toPos, fromLook: this.lookTarget.clone(), toLook, start: performance.now(), ms: Math.max(1, ms) };
  }

  /** Floppy tail, ears and legs on or off (render only; the physics never sees them). */
  setWobble(on: boolean): void {
    this.wobbleOn = on;
    if (!on) for (const w of this.wobbles()) w.reset();
  }

  private wobbles(): Wobble[] {
    return this.dieMeshes.map((g) => g.getObjectByName('model')?.userData.wobble as Wobble | undefined).filter((w): w is Wobble => !!w);
  }

  render(): void {
    const now = performance.now();
    const dt = this.lastRender ? Math.min(0.05, (now - this.lastRender) / 1000) : 0;
    this.lastRender = now;
    if (this.wobbleOn) {
      this.scene.updateMatrixWorld();
      for (const g of this.dieMeshes) {
        const model = g.getObjectByName('model');
        (model?.userData.wobble as Wobble | undefined)?.update(dt, model!.matrixWorld);
      }
    }
    if (this.shot) {
      const t = Math.min(1, (performance.now() - this.shot.start) / this.shot.ms);
      const e = 1 - Math.pow(1 - t, 4);
      this.camera.position.lerpVectors(this.shot.fromPos, this.shot.toPos, e);
      this.lookTarget.lerpVectors(this.shot.fromLook, this.shot.toLook, e);
      this.camera.lookAt(this.lookTarget);
      if (t >= 1) this.shot = null;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
