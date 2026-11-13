import { DRAG_FULL_PX, dragToAxes, keysToAxes } from "./sim/input";
import type { Input } from "./sim/world";

/** Raw input state written by DOM handlers, read once per frame by the stepper. */
export interface Controls {
  pointerId: number | null;
  sx: number; // drag origin (floats along if the finger goes far)
  sy: number;
  cx: number;
  cy: number;
  keys: Set<string>;
}

export function createControls(): Controls {
  return { pointerId: null, sx: 0, sy: 0, cx: 0, cy: 0, keys: new Set() };
}

/** Keeps the drag origin within reach so reversing a steer is instant. */
export function followOrigin(c: Controls): void {
  const max = DRAG_FULL_PX * 1.3;
  const dx = c.cx - c.sx;
  const dy = c.cy - c.sy;
  const d = Math.hypot(dx, dy);
  if (d > max) {
    c.sx = c.cx - (dx / d) * max;
    c.sy = c.cy - (dy / d) * max;
  }
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function readInput(c: Controls, out: Input): Input {
  const k = keysToAxes(c.keys);
  let steer = k.steer;
  let lean = k.lean;
  let hold = k.hold;
  if (c.pointerId !== null) {
    hold = true;
    const a = dragToAxes(c.cx - c.sx, c.cy - c.sy);
    steer += a.steer;
    lean += a.lean;
  }
  out.hold = hold;
  out.steer = clamp(steer);
  out.lean = clamp(lean);
  return out;
}
