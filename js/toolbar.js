// Drawing toolbar: tools, colour swatches, brush size and history buttons.
import { COLORS } from './config.js';
import { brush, undo, redo, clearAll, canUndo, canRedo, drawingEvents } from './drawing.js';
import { $ } from './utils.js';

const swatches = $('swatches');

export function setTool(t) {
  brush.tool = t;
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
}

export function setColor(c) {
  brush.color = c;
  $('colorInput').value = c;
  for (const el of swatches.children) el.setAttribute('aria-pressed', String(el.dataset.color === c));
  setTool('pen');
}

export function setSize(v) {
  brush.size = Math.max(1, Math.min(40, v));
  $('sizeInput').value = brush.size;
  $('sizeLabel').textContent = brush.size;
}

function updateHistoryButtons() {
  $('btnUndo').disabled = !canUndo(); $('btnUndo').classList.toggle('opacity-40', !canUndo());
  $('btnRedo').disabled = !canRedo(); $('btnRedo').classList.toggle('opacity-40', !canRedo());
}

export function initToolbar() {
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch h-6 w-6 rounded-full border border-white/20';
    b.style.background = c;
    b.dataset.color = c;
    b.title = c;
    b.addEventListener('click', () => setColor(c));
    swatches.appendChild(b);
  });
  $('colorInput').addEventListener('input', (e) => setColor(e.target.value));
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('sizeInput').addEventListener('input', (e) => setSize(Number(e.target.value)));

  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnClear').addEventListener('click', clearAll);
  drawingEvents.addEventListener('history', updateHistoryButtons);

  setColor(COLORS[0]);
  setSize(4);
  updateHistoryButtons();
}
