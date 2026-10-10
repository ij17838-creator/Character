// Rigged model state: bone lookup, rest pose capture and body frame.
import * as THREE from 'three';
import { MODEL_HEIGHT, BONE_PREFIX } from './config.js';
import { pivot, resetCamera } from './scene.js';
import { $ } from './utils.js';

export const rig = {
  model: null,
  bones: {},                      // short name ('LeftArm') -> THREE.Bone
  boneList: [],                   // all bones in traversal (parent-first) order
  meshMaterials: [],
  restLocal: new Map(),           // bone -> rest local quaternion
  restWorld: new Map(),           // object -> rest quaternion in pivot space
  restPos: new Map(),             // bone -> rest position in pivot space
  bodyQ: new THREE.Quaternion(),  // body frame (X=character left, Y=up, Z=forward) -> pivot space
  bodyQInv: new THREE.Quaternion(),
  restFootMinY: 0,
};

const REQUIRED_BONES = ['Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
  'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];

function disposeModel() {
  const { model } = rig;
  if (!model) return;
  pivot.remove(model);
  model.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
      m.dispose();
    });
  });
  rig.model = null;
}

export function setupModel(gltf) {
  disposeModel();
  const { bones, restLocal, restWorld, restPos } = rig;
  for (const k in bones) delete bones[k];
  rig.boneList = []; rig.meshMaterials = [];
  restLocal.clear(); restWorld.clear(); restPos.clear();
  pivot.position.set(0, 0, 0); pivot.rotation.set(0, 0, 0);

  const model = rig.model = gltf.scene;
  pivot.add(model);

  model.traverse((o) => {
    // End nodes (HeadTop_End, Toe_End) are often plain Object3Ds, so match by name too.
    if (o.isBone || BONE_PREFIX.test(o.name)) {
      const key = o.name.replace(BONE_PREFIX, '');
      if (!bones[key]) bones[key] = o;
    }
    if (o.isBone) rig.boneList.push(o);
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow the pose
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
        rig.meshMaterials.push(m);
      });
    }
  });

  const missing = REQUIRED_BONES.filter((k) => !bones[k]);
  if (missing.length) throw new Error('Mixamo 본을 찾을 수 없습니다: ' + missing.join(', '));

  // Normalize size & place feet on the ground.
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const height = box.max.y - box.min.y || 1;
  model.scale.multiplyScalar(MODEL_HEIGHT / height);
  model.updateMatrixWorld(true);
  box.setFromObject(model, true);
  const c = box.getCenter(new THREE.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;
  model.updateMatrixWorld(true);

  // Capture rest pose (pivot is identity here, so world == pivot space).
  model.traverse((o) => restWorld.set(o, o.getWorldQuaternion(new THREE.Quaternion())));
  restWorld.set(pivot, new THREE.Quaternion());
  for (const b of rig.boneList) restLocal.set(b, b.quaternion.clone());
  for (const k in bones) restPos.set(bones[k], bones[k].getWorldPosition(new THREE.Vector3()));

  // Body frame from the shoulders: X = character's left, Y = up, Z = forward.
  const left = restPos.get(bones.LeftArm).clone().sub(restPos.get(bones.RightArm));
  left.y = 0; left.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  rig.bodyQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
  rig.bodyQInv.copy(rig.bodyQ).invert();
  rig.restFootMinY = footMinY();

  resetCamera();
  $('statusText').textContent = `본 ${rig.boneList.length}개 · 드로잉 모드`;
}

// Lowest foot/toe joint height in pivot space (used to keep the feet on the floor).
const _v = new THREE.Vector3();
export function footMinY() {
  rig.model.updateMatrixWorld(true);
  let min = Infinity;
  for (const k of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftToe_End', 'RightToe_End']) {
    const b = rig.bones[k];
    if (!b) continue;
    b.getWorldPosition(_v);
    pivot.worldToLocal(_v);
    min = Math.min(min, _v.y);
  }
  return min;
}
