import '@fontsource/alfa-slab-one/400.css';
import '@fontsource-variable/figtree/wght.css';
import './ui/styles.css';
import './ui/wolves-demo.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DIREWOLVES } from './animals/direwolves';
import { createDirewolfMesh } from './render/direwolf-mesh';
import { formatTrait, traitsFor } from './animals/traits';
import { pineTexture, woolTexture } from './render/textures';

/**
 * Model picker: the five direwolf candidates on turntables, side by side.
 * `?focus=N` (1-5) starts close on one wolf; `?still=1` stops the turntables.
 */
const params = new URLSearchParams(location.search);
const still = params.get('still') === '1';
const SPACING = 2.15;

const app = document.querySelector<HTMLDivElement>('#app')!;
const canvas = document.createElement('canvas');
canvas.className = 'scene';
canvas.setAttribute('aria-label', 'Five direwolf models on turntables. Drag to orbit, scroll to zoom.');
const header = document.createElement('header');
header.className = 'picker__head';
header.innerHTML = '<h1 class="wordmark">Meet the <span>Pack</span></h1><p>Drag to orbit, scroll to zoom. Pick a card to walk up to that wolf. Numbers compare each wolf with the pack average.</p>';
const cards = document.createElement('ol');
cards.className = 'picker__cards';
app.append(canvas, header, cards);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14100d');
scene.fog = new THREE.Fog('#14100d', 14, 30);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 1.4;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight('#f4ece2', '#2a1610', 0.75));
const key = new THREE.DirectionalLight('#fff2e0', 2.7);
key.position.set(-4, 9, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5 });
scene.add(key);
const rim = new THREE.DirectionalLight('#9fc0ff', 1.1);
rim.position.set(5, 4, -6);
scene.add(rim);

const wool = woolTexture();
wool.repeat.set(11, 6.5);
const blanket = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), new THREE.MeshStandardMaterial({ map: wool, roughness: 0.98 }));
blanket.rotation.x = -Math.PI / 2;
blanket.receiveShadow = true;
scene.add(blanket);

const turntables: THREE.Group[] = [];
const pine = pineTexture(5);
DIREWOLVES.forEach((design, i) => {
  const x = (i - 2) * SPACING;
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.02, 0.14, 48),
    new THREE.MeshStandardMaterial({ map: pine, color: '#d9a466', roughness: 0.55 }),
  );
  plinth.position.set(x, 0.07, 0);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  scene.add(plinth);

  const turntable = new THREE.Group();
  turntable.position.set(x, 0.14, 0);
  const wolf = createDirewolfMesh(design);
  wolf.position.set(-0.05, 0, 0);
  turntable.add(wolf);
  turntable.rotation.y = -0.6; // start in a three-quarter view
  scene.add(turntable);
  turntables.push(turntable);

  const card = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pick';
  const num = document.createElement('span');
  num.className = 'pick__num';
  num.textContent = String(i + 1);
  const name = document.createElement('span');
  name.className = 'pick__name';
  name.textContent = design.name;
  const pitch = document.createElement('span');
  pitch.className = 'pick__pitch';
  pitch.textContent = design.pitch;
  const traits = document.createElement('span');
  traits.className = 'pick__traits';
  traits.textContent = traitsFor(design.id).map(formatTrait).join(' · ');
  button.append(num, name, pitch, traits);
  button.addEventListener('click', () => focusOn(i));
  card.append(button);
  cards.append(card);
});

const overview = { pos: new THREE.Vector3(0, 6.2, 11.8), target: new THREE.Vector3(0, -0.2, 0.9) };
const goal = { pos: overview.pos.clone(), target: overview.target.clone() };
let focused = -1;

function focusOn(i: number): void {
  if (i === focused) {
    focused = -1;
    goal.pos.copy(overview.pos);
    goal.target.copy(overview.target);
  } else {
    focused = i;
    const x = (i - 2) * SPACING;
    goal.pos.set(x + 0.4, 1.0, 2.6);
    goal.target.set(x, 0.55, 0);
  }
  cards.querySelectorAll('.pick').forEach((b, j) => b.setAttribute('aria-pressed', String(j === focused)));
}

const startFocus = Number(params.get('focus'));
if (startFocus >= 1 && startFocus <= 5) focusOn(startFocus - 1);
camera.position.copy(goal.pos);
controls.target.copy(goal.target);

let moving = 0;
controls.addEventListener('start', () => (moving = -1));
controls.addEventListener('end', () => (moving = 0));
cards.addEventListener('click', () => (moving = 1));

function resize(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (!still) for (const t of turntables) t.rotation.y += dt * 0.35;
  if (moving === 1) {
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(goal.pos, k);
    controls.target.lerp(goal.target, k);
    if (camera.position.distanceTo(goal.pos) < 0.01) moving = 0;
  }
  controls.update();
  renderer.render(scene, camera);
});
document.documentElement.dataset.ready = 'true';
