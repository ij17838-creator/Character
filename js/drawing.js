// 2D drawing layer: pointer input, smoothed strokes, eraser and undo/redo history.
import { COLORS } from './config.js';
import { $, mid, viewport } from './utils.js';

export const drawCanvas = $('drawCanvas');
const dctx = drawCanvas.getContext('2d');
export const cursorEl = $('brushCursor');

// stabilize: 0–1, how strongly new points are pulled toward the previous one.
export const brush = { tool: 'pen', color: COLORS[0], size: 4, stabilize: 0.3 };

// History as a list of actions; a 'clear' action hides everything before it.
const actions = [];
const redoStack = [];
let current = null;

// Fires 'history' whenever undo/redo availability may have changed.
export const drawingEvents = new EventTarget();
const notifyHistory = () => drawingEvents.dispatchEvent(new Event('history'));
export const canUndo = () => actions.length > 0;
export const canRedo = () => redoStack.length > 0;
export const isStroking = () => current !== null;

function strokeWidth(s, p) { return s.pressureSensitive ? s.size * (0.25 + 1.5 * p) : s.size; }
function styleFor(ctx, s) {
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = s.tool === 'eraser' ? '#000' : s.color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

// Draw the curve piece ending at mid(p[i-1], p[i]) — quadratic through midpoints.
function drawSegment(ctx, s, i) {
  const p = s.points, a = p[i - 1], b = p[i];
  const start = i === 1 ? a : mid(p[i - 2], a);
  const end = mid(a, b);
  styleFor(ctx, s);
  ctx.lineWidth = strokeWidth(s, (a.p + b.p) / 2);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.quadraticCurveTo(a.x, a.y, end.x, end.y);
  ctx.stroke();
}
function drawTail(ctx, s) {
  const p = s.points, n = p.length;
  styleFor(ctx, s);
  if (n === 1) {
    ctx.beginPath();
    ctx.arc(p[0].x, p[0].y, strokeWidth(s, p[0].p) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const a = mid(p[n - 2], p[n - 1]);
  ctx.lineWidth = strokeWidth(s, p[n - 1].p);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p[n - 1].x, p[n - 1].y); ctx.stroke();
}
function drawStroke(ctx, s) {
  for (let i = 1; i < s.points.length; i++) drawSegment(ctx, s, i);
  drawTail(ctx, s);
}

function visibleStrokes() {
  const out = [];
  for (const a of actions) { if (a.type === 'clear') out.length = 0; else out.push(a); }
  return out;
}
export function redraw() {
  const { w, h, dpr } = viewport;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, w, h);
  for (const s of visibleStrokes()) drawStroke(dctx, s);
  if (current) drawStroke(dctx, current);
  dctx.globalCompositeOperation = 'source-over';
}
export function hasDrawing() { return visibleStrokes().some((s) => s.tool === 'pen'); }

function pushAction(a) { actions.push(a); redoStack.length = 0; notifyHistory(); }
export function undo() { if (current) return; if (actions.length) { redoStack.push(actions.pop()); redraw(); notifyHistory(); } }
export function redo() { if (current) return; if (redoStack.length) { actions.push(redoStack.pop()); redraw(); notifyHistory(); } }
export function clearAll() { if (visibleStrokes().length) { pushAction({ type: 'clear' }); redraw(); } }

// Pointer input
let activePointer = null;
function canvasPoint(e) {
  const r = drawCanvas.getBoundingClientRect();
  const pen = e.pointerType === 'pen';
  return { x: e.clientX - r.left, y: e.clientY - r.top, p: pen ? (e.pressure || 0.5) : 0.5 };
}
function addPoint(pt) {
  const pts = current.points;
  const last = pts[pts.length - 1];
  const k = brush.stabilize;
  if (last && k > 0) { pt.x = last.x + (pt.x - last.x) * (1 - k); pt.y = last.y + (pt.y - last.y) * (1 - k); }
  if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.6) return;
  pts.push(pt);
  if (pts.length > 1) {
    dctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    drawSegment(dctx, current, pts.length - 1);
  }
}

drawCanvas.addEventListener('pointerdown', (e) => {
  if (activePointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
  activePointer = e.pointerId;
  drawCanvas.setPointerCapture(e.pointerId);
  current = { type: 'stroke', tool: brush.tool, color: brush.color, size: brush.tool === 'eraser' ? brush.size * 3 : brush.size,
    pressureSensitive: e.pointerType === 'pen', points: [] };
  addPoint(canvasPoint(e));
  e.preventDefault();
});
drawCanvas.addEventListener('pointermove', (e) => {
  moveCursor(e);
  if (e.pointerId !== activePointer || !current) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ce of (evs.length ? evs : [e])) addPoint(canvasPoint(ce));
});
function endStroke(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (!current) return;
  const raw = canvasPoint(e);
  const last = current.points[current.points.length - 1];
  if (last && Math.hypot(raw.x - last.x, raw.y - last.y) >= 0.6) { raw.p = last.p; current.points.push(raw); drawSegment(dctx, current, current.points.length - 1); }
  dctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  drawTail(dctx, current);
  dctx.globalCompositeOperation = 'source-over';
  pushAction(current);
  current = null;
}
drawCanvas.addEventListener('pointerup', endStroke);
drawCanvas.addEventListener('pointercancel', endStroke);

// Brush-size cursor
function moveCursor(e) {
  if (e.pointerType === 'touch') { cursorEl.style.display = 'none'; return; }
  const size = brush.tool === 'eraser' ? brush.size * 3 : brush.size;
  cursorEl.style.display = 'block';
  cursorEl.style.width = cursorEl.style.height = Math.max(4, size) + 'px';
  cursorEl.style.left = e.clientX + 'px';
  cursorEl.style.top = e.clientY + 'px';
  cursorEl.style.background = brush.tool === 'eraser' ? 'rgba(255,255,255,.25)' : 'transparent';
}
drawCanvas.addEventListener('pointerleave', () => (cursorEl.style.display = 'none'));
