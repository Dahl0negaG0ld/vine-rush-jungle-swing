import {
  AIR_DRAG_QUAD,
  AIR_STEER,
  TARGET_STICKY,
  ASSIST_ACCEL,
  ASSIST_RADIUS,
  DRAG,
  DT,
  FALL_Y,
  G,
  GRAB_RADIUS,
  HEADING_FOLLOW,
  MAX_FRAME,
  MIN_ROPE,
  ROPE_FLOOR,
  PUMP_ACCEL,
  REGRAB_COOLDOWN,
  RELEASE_BOOST,
  RELEASE_UP,
  SWING_DAMP,
  SWING_STEER,
  TARGET_LOOK,
  HEADING_MAX_OFF,
  STEER_LOOK,
  VERTICAL_REACH,
} from "./constants";
import { corridorYaw, createCourse, updateCourse, type Course, type Vine } from "./course";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Mode = "ready" | "swing" | "air" | "fallen";

export interface Input {
  hold: boolean;
  steer: number; // -1 left .. +1 right (screen)
  lean: number; // -1 back .. +1 forward (pump)
}

export interface Target {
  vine: Vine;
  point: Vec3; // closest grabbable point on the vine
  dist: number;
  inReach: boolean;
}

export interface World {
  course: Course;
  p: Vec3; // hand position (the swinging particle)
  v: Vec3;
  yaw: number;
  mode: Mode;
  vine: Vine | null; // vine currently held
  rope: number;
  time: number;
  distance: number;
  vinesGrabbed: number;
  lastVineId: number;
  releaseTime: number;
  target: Target | null;
  grabCount: number; // increments on every grab (camera feedback)
  acc: number; // leftover frame time
}

export const START_ROPE = 11;
const START_ANGLE = Math.PI / 4;

export function createWorld(seed = 1): World {
  const course = createCourse(seed);
  updateCourse(course, 0);
  const v0 = course.vines[0];
  return {
    course,
    p: {
      x: v0.x,
      y: v0.y - START_ROPE * Math.cos(START_ANGLE),
      z: v0.z - START_ROPE * Math.sin(START_ANGLE),
    },
    v: { x: 0, y: 0, z: 0 },
    yaw: 0,
    mode: "ready",
    vine: v0,
    rope: START_ROPE,
    time: 0,
    distance: 0,
    vinesGrabbed: 0,
    lastVineId: -1,
    releaseTime: -10,
    target: null,
    grabCount: 0,
    acc: 0,
  };
}

export function forwardOf(yaw: number): Vec3 {
  return { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
}
export function rightOf(yaw: number): Vec3 {
  return { x: -Math.cos(yaw), y: 0, z: Math.sin(yaw) };
}

/** Closest point on a (vertical) vine to p, limited to the grabbable span. */
export function closestOnVine(v: Vine, p: Vec3): { point: Vec3; dist: number } {
  const y = Math.min(v.y - MIN_ROPE, Math.max(v.y - v.length, p.y));
  const dx = p.x - v.x;
  const dy = p.y < y ? (p.y - y) * VERTICAL_REACH : p.y - y; // stretching up reaches further
  const dz = p.z - v.z;
  return { point: { x: v.x, y, z: v.z }, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) };
}

/** Picks the vine the player is reaching for. Steer biases the aim left/right. */
export function findTarget(w: World, steer: number): Target | null {
  const aimYaw = w.yaw - steer * 0.5;
  const f = forwardOf(aimYaw);
  const r = rightOf(aimYaw);
  let best: Target | null = null;
  let bestScore = Infinity;
  for (const vine of w.course.vines) {
    if (w.vine && vine.id === w.vine.id) continue;
    if (vine.id === w.lastVineId && w.time - w.releaseTime < REGRAB_COOLDOWN) continue;
    const dx = vine.x - w.p.x;
    const dz = vine.z - w.p.z;
    const ahead = dx * f.x + dz * f.z;
    if (ahead > TARGET_LOOK) continue;
    const c = closestOnVine(vine, w.p);
    const inReach = c.dist <= GRAB_RADIUS;
    if (!inReach && ahead < 1) continue; // already passed it
    const lateral = Math.abs(dx * r.x + dz * r.z);
    let score = c.dist + lateral * 1.5;
    if (inReach) score -= 1000;
    if (w.target && w.target.vine.id === vine.id) score -= TARGET_STICKY; // no flicker
    if (score < bestScore) {
      bestScore = score;
      best = { vine, point: c.point, dist: c.dist, inReach };
    }
  }
  return best;
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function startRun(w: World): void {
  if (w.mode === "ready") w.mode = "swing";
}

function grab(w: World, t: Target): void {
  const vine = t.vine;
  const dx = w.p.x - vine.x;
  const dy = w.p.y - vine.y;
  const dz = w.p.z - vine.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  w.rope = Math.max(ROPE_FLOOR, Math.min(vine.length, len)); // taut at once: no slack jerk
  // Inelastic catch: the rope removes any outward radial velocity.
  const nx = dx / len,
    ny = dy / len,
    nz = dz / len;
  const radial = w.v.x * nx + w.v.y * ny + w.v.z * nz;
  if (radial > 0) {
    w.v.x -= radial * nx;
    w.v.y -= radial * ny;
    w.v.z -= radial * nz;
  }
  w.vine = vine;
  w.mode = "swing";
  w.vinesGrabbed++;
  w.grabCount++;
}

function release(w: World): void {
  if (!w.vine) return;
  const f = forwardOf(w.yaw);
  const vf = w.v.x * f.x + w.v.z * f.z;
  if (vf > 0) {
    w.v.x += f.x * RELEASE_BOOST;
    w.v.z += f.z * RELEASE_BOOST;
  }
  w.v.y += RELEASE_UP;
  w.lastVineId = w.vine.id;
  w.releaseTime = w.time;
  w.vine = null;
  w.mode = "air";
}

/** One fixed step. Pure rules: no React, no three.js. */
export function step(w: World, input: Input, dt = DT): void {
  if (w.mode === "ready" || w.mode === "fallen") return;
  w.time += dt;

  // Heading: the view follows the jungle corridor, nudged toward the travel
  // direction. Keeps the horizon stable and "forward" readable on a phone.
  const base = corridorYaw(w.p.z);
  let off = 0;
  const hs = Math.hypot(w.v.x, w.v.z);
  if (hs > 2) {
    const travel = Math.atan2(w.v.x, w.v.z);
    const rel = wrapAngle(travel - base);
    if (Math.abs(rel) < Math.PI / 2) off = Math.max(-HEADING_MAX_OFF, Math.min(HEADING_MAX_OFF, rel * 0.6));
  }
  off -= input.steer * STEER_LOOK;
  w.yaw += wrapAngle(base + off - w.yaw) * (1 - Math.exp(-HEADING_FOLLOW * dt));
  const f = forwardOf(w.yaw);
  const rt = rightOf(w.yaw);

  if (w.mode === "swing" && !input.hold) release(w);

  w.target = findTarget(w, input.steer);
  if (w.mode === "air" && input.hold && w.target?.inReach) grab(w, w.target);

  let ax = 0,
    ay = -G,
    az = 0;
  const steerA = (w.mode === "swing" ? SWING_STEER : AIR_STEER) * input.steer;
  ax += rt.x * steerA;
  az += rt.z * steerA;

  if (w.mode === "swing") {
    const vf = w.v.x * f.x + w.v.z * f.z;
    const pump = PUMP_ACCEL * input.lean * Math.tanh(vf);
    ax += f.x * pump;
    az += f.z * pump;
  } else if (input.hold && w.target && !w.target.inReach && w.target.dist < ASSIST_RADIUS) {
    const tx = w.target.point.x - w.p.x;
    const tz = w.target.point.z - w.p.z;
    const tl = Math.hypot(tx, tz) || 1;
    ax += (tx / tl) * ASSIST_ACCEL;
    az += (tz / tl) * ASSIST_ACCEL;
  }

  w.v.x += ax * dt;
  w.v.y += ay * dt;
  w.v.z += az * dt;
  const speed = Math.sqrt(w.v.x * w.v.x + w.v.y * w.v.y + w.v.z * w.v.z);
  const damp = Math.exp(-((w.mode === "swing" ? SWING_DAMP : DRAG) + AIR_DRAG_QUAD * speed) * dt);
  w.v.x *= damp;
  w.v.y *= damp;
  w.v.z *= damp;

  w.p.x += w.v.x * dt;
  w.p.y += w.v.y * dt;
  w.p.z += w.v.z * dt;

  if (w.mode === "swing" && w.vine) {
    const dx = w.p.x - w.vine.x;
    const dy = w.p.y - w.vine.y;
    const dz = w.p.z - w.vine.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > w.rope) {
      const nx = dx / len,
        ny = dy / len,
        nz = dz / len;
      w.p.x = w.vine.x + nx * w.rope;
      w.p.y = w.vine.y + ny * w.rope;
      w.p.z = w.vine.z + nz * w.rope;
      const radial = w.v.x * nx + w.v.y * ny + w.v.z * nz;
      if (radial > 0) {
        w.v.x -= radial * nx;
        w.v.y -= radial * ny;
        w.v.z -= radial * nz;
      }
    }
  }

  if (w.p.y < FALL_Y) {
    w.p.y = FALL_Y;
    w.mode = "fallen";
    w.vine = null;
  }

  w.distance = Math.max(w.distance, w.p.z);
  updateCourse(w.course, w.p.z);
}

/** Advance by a rendered frame's delta using fixed sub-steps. */
export function advance(w: World, input: Input, frameDelta: number): void {
  w.acc += Math.min(frameDelta, MAX_FRAME);
  while (w.acc >= DT) {
    step(w, input, DT);
    w.acc -= DT;
  }
}

/** Run the simulation for `seconds` with a fixed input (tests / debug). */
export function sim(w: World, seconds: number, input: Input | ((w: World) => Input)): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(w, typeof input === "function" ? input(w) : input, DT);
}
