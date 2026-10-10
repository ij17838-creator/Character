// Gesture timer badge; calls onExpire when the countdown hits zero.
import { $ } from './utils.js';

let timerEnd = 0, timerRunning = false;

export function startTimer(sec) {
  timerRunning = sec > 0;
  $('timerBadge').classList.toggle('hidden', !timerRunning);
  if (timerRunning) timerEnd = performance.now() + sec * 1000;
}

export function updateTimer(now, onExpire) {
  if (!timerRunning) return;
  const left = Math.max(0, timerEnd - now);
  const s = Math.ceil(left / 1000);
  $('timerBadge').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('timerBadge').classList.toggle('text-rose-400', s <= 5);
  if (left <= 0) {
    timerRunning = false;
    onExpire();
  }
}
