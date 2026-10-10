// Entry point: wires the modules to the UI, keyboard shortcuts and the render loop.
import * as THREE from 'three';
import { renderer, scene, camera, controls, glCanvas, resetCamera, resizeRenderer } from './scene.js';
import { rig } from './model.js';
import { loadDefault, loadFile } from './loader.js';
import { randomPose, restPose, updatePoseAnim } from './pose.js';
import { drawCanvas, cursorEl, brush, redraw, hasDrawing, isStroking, undo, redo, clearAll } from './drawing.js';
import { initToolbar, setTool, setSize } from './toolbar.js';
import { answer, setAnswer, applyModelOpacity, drawGroundTruth, resizeOverlay } from './overlay.js';
import { startTimer, updateTimer } from './timer.js';
import { $, viewport } from './utils.js';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function resize() {
  viewport.w = window.innerWidth; viewport.h = window.innerHeight;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);
  resizeRenderer(viewport.w, viewport.h);
  drawCanvas.width = Math.round(viewport.w * viewport.dpr);
  drawCanvas.height = Math.round(viewport.h * viewport.dpr);
  resizeOverlay();
  redraw();
  drawGroundTruth();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Camera lock / orbit
// ---------------------------------------------------------------------------
let cameraLocked = true;
let spaceHeld = false;
function applyInteractionMode() {
  const drawing = cameraLocked && !spaceHeld;
  controls.enabled = !drawing;
  drawCanvas.style.pointerEvents = drawing ? 'auto' : 'none';
  drawCanvas.style.cursor = drawing ? 'none' : '';
  glCanvas.style.cursor = drawing ? '' : 'grab';
  if (!drawing) cursorEl.style.display = 'none';
  $('btnLock').setAttribute('aria-pressed', String(cameraLocked));
  $('btnLock').textContent = cameraLocked ? '🔒 카메라 고정' : '🔓 카메라 회전';
  $('hint').textContent = drawing
    ? '드로잉 모드 · Space를 누른 채 드래그하면 카메라 회전'
    : '카메라 모드 · 드래그: 회전 · 우클릭/두 손가락: 이동 · 휠/핀치: 줌';
}
function toggleCameraLock() { cameraLocked = !cameraLocked; applyInteractionMode(); }

// ---------------------------------------------------------------------------
// Pose actions & new pose flow (ask / clear / keep)
// ---------------------------------------------------------------------------
const animate = () => $('animInput').checked;

function doNewPose(clear) {
  if (clear) clearAll();
  setAnswer(false);
  randomPose({
    intensity: Number($('intensityInput').value) / 100,
    randomYaw: $('yawInput').checked,
    animate: animate(),
  });
  startTimer(Number($('timerInput').value));
}
function requestNewPose() {
  if (!rig.model || !$('modal').classList.contains('hidden')) return;
  const mode = $('clearModeInput').value;
  if (!hasDrawing() || mode === 'keep') return doNewPose(false);
  if (mode === 'clear') return doNewPose(true);
  $('modalRemember').checked = false;
  $('modal').classList.remove('hidden');
}
$('modal').addEventListener('click', (e) => {
  const choice = e.target.closest('[data-choice]')?.dataset.choice;
  if (!choice && e.target !== $('modal')) return;
  $('modal').classList.add('hidden');
  if (!choice || choice === 'cancel') return;
  if ($('modalRemember').checked) $('clearModeInput').value = choice;
  doNewPose(choice === 'clear');
});

function onTimerExpire() {
  setAnswer(true);
  const b = $('btnAnswer'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
}

// ---------------------------------------------------------------------------
// Model files
// ---------------------------------------------------------------------------
async function openModelFile(file) {
  if (await loadFile(file)) setAnswer(false);
}
$('fileInput').addEventListener('change', (e) => openModelFile(e.target.files[0]));
$('fileInput2').addEventListener('change', (e) => openModelFile(e.target.files[0]));
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); openModelFile(e.dataTransfer.files[0]); });

// ---------------------------------------------------------------------------
// Top bar & settings
// ---------------------------------------------------------------------------
$('btnNewPose').addEventListener('click', requestNewPose);
$('btnRestPose').addEventListener('click', () => { setAnswer(false); restPose({ animate: animate() }); });
$('btnAnswer').addEventListener('click', () => setAnswer(!answer.on));
$('btnLock').addEventListener('click', toggleCameraLock);
$('btnResetCam').addEventListener('click', resetCamera);
$('btnSettings').addEventListener('click', () => $('settings').classList.toggle('hidden'));
$('btnCloseSettings').addEventListener('click', () => $('settings').classList.add('hidden'));

// Range input → percentage label, plus an optional handler for the 0–1 value.
function bindPercent(input, label, onValue) {
  const upd = () => {
    $(label).textContent = $(input).value + '%';
    onValue?.(Number($(input).value) / 100);
  };
  $(input).addEventListener('input', upd); upd();
}
bindPercent('intensityInput', 'intensityLabel');
bindPercent('ghostInput', 'ghostLabel', (v) => { answer.ghost = v; if (answer.on) applyModelOpacity(); });
bindPercent('stabInput', 'stabLabel', (v) => (brush.stabilize = v));
$('labelsInput').addEventListener('change', (e) => { answer.showLabels = e.target.checked; drawGroundTruth(); });
answer.showLabels = $('labelsInput').checked;
$('timerInput').addEventListener('change', (e) => startTimer(Number(e.target.value)));

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod) return;
  switch (e.key) {
    case ' ': e.preventDefault(); if (!spaceHeld && !isStroking()) { spaceHeld = true; applyInteractionMode(); } break;
    case 'n': case 'N': requestNewPose(); break;
    case 'a': case 'A': setAnswer(!answer.on); break;
    case 'l': case 'L': toggleCameraLock(); break;
    case 'p': case 'P': setTool('pen'); break;
    case 'e': case 'E': setTool('eraser'); break;
    case '[': setSize(brush.size - 1); break;
    case ']': setSize(brush.size + 1); break;
    case 'Escape': $('settings').classList.add('hidden'); break;
  }
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceHeld = false; applyInteractionMode(); } });
window.addEventListener('blur', () => { if (spaceHeld) { spaceHeld = false; applyInteractionMode(); } });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame(now) {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePoseAnim(dt);
  controls.update();
  renderer.render(scene, camera);
  if (answer.on) drawGroundTruth();
  updateTimer(now, onTimerExpire);
  requestAnimationFrame(frame);
}

initToolbar();
applyInteractionMode();
resize();
resetCamera();
requestAnimationFrame(frame);
loadDefault();

// Exposed for debugging in the console
window.__app = {
  scene, camera, bones: rig.bones, setAnswer,
  randomPose: () => randomPose({ intensity: 0.7, randomYaw: true, animate: false }),
  restPose: () => restPose({ animate: false }),
};
