// Three.js renderer, camera, lights, ground and the model pivot.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODEL_HEIGHT } from './config.js';
import { $ } from './utils.js';

export const glCanvas = $('glCanvas');
export const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7e5e4);
scene.fog = new THREE.Fog(0xe7e5e4, 8, 20);

export const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
export const controls = new OrbitControls(camera, glCanvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8378, 1.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(2.5, 5, 3.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: 0.5, far: 15 });
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xc7d2fe, 1.0);
rimLight.position.set(-3, 3, -4);
scene.add(rimLight);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(20, 40, 0xa8a29e, 0xc4c0bc);
grid.position.y = 0.001;
scene.add(grid);

// pivot: yaw + ground offset; the glTF scene lives inside it.
export const pivot = new THREE.Group();
scene.add(pivot);

export function resetCamera() {
  camera.position.set(0, MODEL_HEIGHT * 0.58, MODEL_HEIGHT * 2.1);
  controls.target.set(0, MODEL_HEIGHT * 0.52, 0);
  controls.update();
}

export function resizeRenderer(w, h) {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
