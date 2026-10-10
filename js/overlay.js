// "정답 보기": projects key joints to 2D and draws a neon skeleton over the drawing.
import * as THREE from 'three';
import { rig } from './model.js';
import { scene, camera } from './scene.js';
import { $, mid, viewport } from './utils.js';

const gtCanvas = $('gtCanvas');
const gctx = gtCanvas.getContext('2d');

const NEON = { center: '#39ff14', left: '#00f0ff', right: '#ff2bd6', joint: '#fffb00' };
const GT_JOINTS = [
  ['Hips', '골반'], ['Spine', '척추'], ['Spine2', '가슴'], ['Neck', '목'], ['Head', '머리'],
  ['LeftArm', 'L 어깨'], ['RightArm', 'R 어깨'], ['LeftForeArm', 'L 팔꿈치'], ['RightForeArm', 'R 팔꿈치'],
  ['LeftHand', 'L 손목'], ['RightHand', 'R 손목'], ['LeftUpLeg', 'L 고관절'], ['RightUpLeg', 'R 고관절'],
  ['LeftLeg', 'L 무릎'], ['RightLeg', 'R 무릎'], ['LeftFoot', 'L 발목'], ['RightFoot', 'R 발목'],
];
const GT_BONES = [
  ['Hips', 'Spine', 'center'], ['Spine', 'Spine2', 'center'], ['Spine2', 'Neck', 'center'], ['Neck', 'Head', 'center'],
  ['Neck', 'LeftArm', 'left'], ['LeftArm', 'LeftForeArm', 'left'], ['LeftForeArm', 'LeftHand', 'left'],
  ['Neck', 'RightArm', 'right'], ['RightArm', 'RightForeArm', 'right'], ['RightForeArm', 'RightHand', 'right'],
  ['Hips', 'LeftUpLeg', 'left'], ['LeftUpLeg', 'LeftLeg', 'left'], ['LeftLeg', 'LeftFoot', 'left'], ['LeftFoot', 'LeftToeBase', 'left'],
  ['Hips', 'RightUpLeg', 'right'], ['RightUpLeg', 'RightLeg', 'right'], ['RightLeg', 'RightFoot', 'right'], ['RightFoot', 'RightToeBase', 'right'],
];
// Gesture-drawing guide lines: shoulder & hip tilt
const GT_GUIDES = [['LeftArm', 'RightArm'], ['LeftUpLeg', 'RightUpLeg']];

// ghost: model opacity (0–1) while the answer is shown.
export const answer = { on: false, ghost: 0.25, showLabels: false };

export function resizeOverlay() {
  gtCanvas.width = Math.round(viewport.w * viewport.dpr);
  gtCanvas.height = Math.round(viewport.h * viewport.dpr);
}

const _p = new THREE.Vector3();
function project(name) {
  const b = rig.bones[name];
  if (!b) return null;
  b.getWorldPosition(_p).project(camera);
  if (_p.z > 1 || _p.z < -1) return null;
  return { x: (_p.x + 1) / 2 * viewport.w, y: (1 - _p.y) / 2 * viewport.h };
}

export function drawGroundTruth() {
  const { w, h, dpr } = viewport;
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.clearRect(0, 0, w, h);
  if (!answer.on || !rig.model) return;
  scene.updateMatrixWorld(true);

  const P = {};
  for (const k of [...GT_JOINTS.map((j) => j[0]), 'Spine1', 'HeadTop_End', 'LeftToeBase', 'RightToeBase']) P[k] = project(k);

  gctx.lineCap = 'round'; gctx.lineJoin = 'round';

  // Guides (dashed)
  gctx.save();
  gctx.setLineDash([6, 6]);
  gctx.lineWidth = 1.5;
  gctx.strokeStyle = 'rgba(255,251,0,.75)';
  for (const [a, b] of GT_GUIDES) if (P[a] && P[b]) {
    const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y;
    gctx.beginPath(); gctx.moveTo(P[a].x - dx * 0.25, P[a].y - dy * 0.25); gctx.lineTo(P[b].x + dx * 0.25, P[b].y + dy * 0.25); gctx.stroke();
  }
  gctx.restore();

  // Bone lines with glow
  for (const pass of [0, 1]) {
    for (const [a, b, side] of GT_BONES) {
      if (!P[a] || !P[b]) continue;
      gctx.strokeStyle = NEON[side];
      gctx.shadowColor = NEON[side];
      gctx.shadowBlur = pass === 0 ? 14 : 0;
      gctx.lineWidth = pass === 0 ? 6 : 3;
      gctx.globalAlpha = pass === 0 ? 0.35 : 1;
      gctx.beginPath(); gctx.moveTo(P[a].x, P[a].y); gctx.lineTo(P[b].x, P[b].y); gctx.stroke();
    }
  }
  gctx.globalAlpha = 1; gctx.shadowBlur = 0;

  // Head oval (Head joint → head top)
  if (P.Head && P.HeadTop_End) {
    const c = mid(P.Head, P.HeadTop_End);
    const dx = P.HeadTop_End.x - P.Head.x, dy = P.HeadTop_End.y - P.Head.y;
    const len = Math.hypot(dx, dy);
    gctx.save();
    gctx.translate(c.x, c.y);
    gctx.rotate(Math.atan2(dy, dx));
    gctx.strokeStyle = NEON.center; gctx.lineWidth = 2.5;
    gctx.shadowColor = NEON.center; gctx.shadowBlur = 10;
    gctx.beginPath(); gctx.ellipse(0, 0, Math.max(len * 0.62, 6), Math.max(len * 0.5, 5), 0, 0, Math.PI * 2); gctx.stroke();
    gctx.restore();
  }

  // Joints
  gctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  for (const [k, label] of GT_JOINTS) {
    const p = P[k]; if (!p) continue;
    gctx.beginPath(); gctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
    gctx.fillStyle = 'rgba(0,0,0,.65)'; gctx.fill();
    gctx.beginPath(); gctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    gctx.fillStyle = NEON.joint; gctx.shadowColor = NEON.joint; gctx.shadowBlur = 12; gctx.fill();
    gctx.shadowBlur = 0;
    if (answer.showLabels) {
      gctx.lineWidth = 3; gctx.strokeStyle = 'rgba(0,0,0,.8)'; gctx.strokeText(label, p.x + 9, p.y - 8);
      gctx.fillStyle = '#fff'; gctx.fillText(label, p.x + 9, p.y - 8);
    }
  }
}

export function applyModelOpacity() {
  for (const m of rig.meshMaterials) {
    if (answer.on) {
      m.transparent = true;
      m.opacity = answer.ghost * m.userData.baseOpacity;
    } else {
      m.transparent = m.userData.baseTransparent;
      m.opacity = m.userData.baseOpacity;
    }
    m.needsUpdate = true;
  }
  if (rig.model) rig.model.visible = !(answer.on && answer.ghost === 0);
}

export function setAnswer(on) {
  answer.on = on;
  $('btnAnswer').setAttribute('aria-pressed', String(on));
  $('btnAnswer').textContent = on ? '🦴 정답 숨기기' : '🦴 정답 보기';
  applyModelOpacity();
  drawGroundTruth();
}
