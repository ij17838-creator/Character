import * as THREE from 'three';

export const $ = (id) => document.getElementById(id);
export const deg = THREE.MathUtils.degToRad;
export const rand = (a, b) => a + Math.random() * (b - a);
// Mildly centre-weighted random, so extreme angles show up less often
export const randC = (a, b) => { const t = (Math.random() + Math.random()) / 2; return a + t * (b - a); };
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Shared CSS-pixel size of the stage, updated on resize.
export const viewport = { w: 1, h: 1, dpr: 1 };
