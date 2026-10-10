// Random pose generation (anatomical ROM, expressed in the body frame) and pose transitions.
import * as THREE from 'three';
import { rig, footMinY } from './model.js';
import { pivot } from './scene.js';
import { deg, rand, randC } from './utils.js';

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const qAxis = (axis, rad) => new THREE.Quaternion().setFromAxisAngle(axis, rad);
// Euler-ish composition in body frame: flex (about X / left axis), twist (about Y), side bend (about Z)
const qBody = (flexDeg, twistDeg, sideDeg) =>
  qAxis(AY, deg(twistDeg)).multiply(qAxis(AX, deg(flexDeg))).multiply(qAxis(AZ, deg(sideDeg)));

// Rest direction of a bone (toward its child joint) in body frame.
function restDirBody(bone, child) {
  return rig.restPos.get(child).clone().sub(rig.restPos.get(bone)).normalize().applyQuaternion(rig.bodyQInv);
}

// Direction for a limb hanging down, abducted sideways then flexed forward.
// side: +1 for the character's left, -1 for the right.
function limbDir(side, abductDeg, flexDeg) {
  return new THREE.Vector3(0, -1, 0)
    .applyAxisAngle(AZ, side * deg(abductDeg))
    .applyAxisAngle(AX, -deg(flexDeg));
}

// Swing a bone from its rest direction to `target`, then twist around it.
function swing(bone, child, target, twistDeg) {
  const from = restDirBody(bone, child);
  const q = new THREE.Quaternion().setFromUnitVectors(from, target.clone().normalize());
  return qAxis(target.clone().normalize(), deg(twistDeg)).multiply(q);
}

// Hinge rotation that bends `bone` (toward `child`) in the given body direction.
function hinge(bone, child, towardDir, angleDeg) {
  const d = restDirBody(bone, child);
  const axis = new THREE.Vector3().crossVectors(d, towardDir);
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
  return qAxis(axis.normalize(), deg(angleDeg));
}

function generateDeltas(k) {
  const { bones } = rig;
  const D = new Map();
  const set = (name, q) => { if (bones[name]) D.set(bones[name], q); };
  const s = (v) => v * k; // intensity scale

  // Pelvis & spine — distribute bending across the spine segments
  set('Hips', qBody(s(randC(-8, 12)), s(randC(-15, 15)), s(randC(-8, 8))));
  const flex = s(randC(-25, 45)), twist = s(randC(-35, 35)), side = s(randC(-25, 25));
  set('Spine', qBody(flex * 0.35, twist * 0.3, side * 0.35));
  set('Spine1', qBody(flex * 0.35, twist * 0.35, side * 0.35));
  set('Spine2', qBody(flex * 0.3, twist * 0.35, side * 0.3));
  set('Neck', qBody(s(randC(-15, 25)), s(randC(-30, 30)), s(randC(-12, 12))));
  set('Head', qBody(s(randC(-20, 25)), s(randC(-35, 35)), s(randC(-15, 15))));

  for (const [side, L] of [[1, 'Left'], [-1, 'Right']]) {
    // Clavicle: elevation (about forward axis) + protraction (about up axis)
    set(L + 'Shoulder', qAxis(AZ, side * deg(s(randC(-5, 22)))).multiply(qAxis(AY, -side * deg(s(randC(-10, 18))))));

    // Upper arm: abduction 10–170°, flexion -45–150° (limit flexion when arm is high)
    const abd = 10 + s(randC(0, 160));
    const flexMax = abd > 120 ? 60 : 150;
    const aFlex = s(randC(-45, flexMax));
    set(L + 'Arm', swing(bones[L + 'Arm'], bones[L + 'ForeArm'], limbDir(side, abd, aFlex), s(randC(-40, 40))));

    // Elbow: hinge 0–145°, bending toward the front of the body
    set(L + 'ForeArm', hinge(bones[L + 'ForeArm'], bones[L + 'Hand'], AZ, s(rand(0, 145))));

    // Wrist: small flexion / deviation
    set(L + 'Hand', qBody(s(randC(-35, 35)), s(randC(-20, 20)), s(randC(-20, 20))));

    // Thigh: flexion -25–110°, abduction -8–45°
    const lFlex = s(randC(-25, 110));
    const lAbd = s(randC(-8, 45));
    set(L + 'UpLeg', swing(bones[L + 'UpLeg'], bones[L + 'Leg'], limbDir(side, lAbd, lFlex), s(randC(-25, 30)) * side));

    // Knee: hinge 0–135°, bending backward; deeper when the thigh is raised
    const kneeMin = Math.max(0, lFlex * 0.5);
    set(L + 'Leg', hinge(bones[L + 'Leg'], bones[L + 'Foot'], AZ.clone().negate(), Math.min(135, rand(kneeMin, kneeMin + s(90)))));

    // Ankle: dorsi/plantar flexion
    set(L + 'Foot', qBody(s(randC(-20, 30)), s(randC(-10, 10)), s(randC(-10, 10))));
  }
  return D;
}

// Turn body-frame deltas into target local quaternions for every bone.
// For each bone: newWorld = P · D · restWorld, where P = parentNew · parentRest⁻¹
function solveLocals(deltas) {
  const { restWorld, bodyQ, bodyQInv } = rig;
  const newWorld = new Map();
  const out = new Map();
  for (const b of rig.boneList) {
    const parent = b.parent;
    const pRest = restWorld.get(parent);
    const pNew = newWorld.get(parent) || pRest;
    const P = pNew.clone().multiply(pRest.clone().invert());
    const d = deltas.get(b);
    const Dw = d ? bodyQ.clone().multiply(d).multiply(bodyQInv) : new THREE.Quaternion();
    const nw = P.multiply(Dw).multiply(restWorld.get(b));
    newWorld.set(b, nw);
    out.set(b, pNew.clone().invert().multiply(nw));
  }
  return out;
}

function currentLocals() {
  const m = new Map();
  for (const b of rig.boneList) m.set(b, b.quaternion.clone());
  return m;
}
function applyLocals(m) { for (const [b, q] of m) b.quaternion.copy(q); }

let poseAnim = null; // { model, from: Map, to: Map, t, dur, yaw0, yaw1, y0, y1 }

function goToPose(targetLocals, yaw, animate) {
  if (!rig.model) return;
  const from = currentLocals();
  const yaw0 = pivot.rotation.y, y0 = pivot.position.y;

  // Measure the ground offset for the target pose
  applyLocals(targetLocals);
  const y1 = rig.restFootMinY - footMinY();
  applyLocals(from);

  // Shortest yaw path
  let yaw1 = yaw;
  while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
  while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;

  if (animate) {
    poseAnim = { model: rig.model, from, to: targetLocals, t: 0, dur: 0.55, yaw0, yaw1, y0, y1 };
  } else {
    applyLocals(targetLocals);
    pivot.rotation.y = yaw1; pivot.position.y = y1;
    poseAnim = null;
  }
}

export function updatePoseAnim(dt) {
  if (!poseAnim) return;
  const a = poseAnim;
  if (a.model !== rig.model) { poseAnim = null; return; } // model was replaced mid-transition
  a.t = Math.min(1, a.t + dt / a.dur);
  const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2; // easeInOutCubic
  for (const [b, q] of a.to) b.quaternion.slerpQuaternions(a.from.get(b), q, e);
  pivot.rotation.y = THREE.MathUtils.lerp(a.yaw0, a.yaw1, e);
  pivot.position.y = THREE.MathUtils.lerp(a.y0, a.y1, e);
  if (a.t >= 1) poseAnim = null;
}

// intensity: 0–1 scale on the range of motion; randomYaw: also spin the whole body.
export function randomPose({ intensity, randomYaw, animate }) {
  if (!rig.model) return;
  const yaw = randomYaw ? rand(-Math.PI, Math.PI) : 0;
  goToPose(solveLocals(generateDeltas(intensity)), yaw, animate);
}
export function restPose({ animate }) { goToPose(new Map(rig.restLocal), 0, animate); }
