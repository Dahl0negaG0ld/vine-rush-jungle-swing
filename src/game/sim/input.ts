/** Maps a touch/mouse drag offset (px, screen coords) to steer/lean axes. */
export const DRAG_FULL_PX = 70;
export const DEADZONE = 0.12;

function shape(v: number): number {
  const c = Math.max(-1, Math.min(1, v));
  const a = Math.abs(c);
  if (a < DEADZONE) return 0;
  return Math.sign(c) * ((a - DEADZONE) / (1 - DEADZONE));
}

export function dragToAxes(dx: number, dy: number, full = DRAG_FULL_PX): { steer: number; lean: number } {
  // Drag right = steer right (+). Drag up (negative dy) = lean forward / pump (+).
  return { steer: shape(dx / full), lean: shape(-dy / full) };
}

export function keysToAxes(keys: Set<string>): { steer: number; lean: number; hold: boolean } {
  const right = keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0;
  const left = keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0;
  const fwd = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  const back = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
  return { steer: right - left, lean: fwd - back, hold: keys.has("Space") };
}
