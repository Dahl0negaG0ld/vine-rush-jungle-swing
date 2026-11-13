import {
  ANCHOR_Y_MAX,
  ANCHOR_Y_MIN,
  GEN_AHEAD,
  LATERAL_JITTER,
  PRUNE_BEHIND,
  RAMP_DIST,
  SIDE_VINE_CHANCE,
  SPACING_MAX,
  SPACING_MIN,
  SPACING_RAMP,
  VINE_LEN_MAX,
  VINE_LEN_MIN,
} from "./constants";
import { rand } from "./rng";

export interface Vine {
  id: number;
  x: number; // anchor
  y: number;
  z: number;
  length: number;
  phase: number; // sway phase (visual only)
}

/** Centre line of the jungle corridor: gentle meander in x as z grows. */
export function centerX(z: number): number {
  return 16 * Math.sin(z / 150) + 5 * Math.sin(z / 57 + 1.3);
}

/** Heading (yaw) of the corridor at z. */
export function corridorYaw(z: number): number {
  const slope = (16 / 150) * Math.cos(z / 150) + (5 / 57) * Math.cos(z / 57 + 1.3);
  return Math.atan(slope);
}

export interface Course {
  vines: Vine[];
  rng: number;
  nextId: number;
  genZ: number; // z of last main-line vine
}

export function createCourse(seed: number): Course {
  const first: Vine = { id: 0, x: centerX(0), y: 22, z: 0, length: 14, phase: 0 };
  return { vines: [first], rng: seed | 0, nextId: 1, genZ: 0 };
}

function r(c: Course, min: number, max: number): number {
  const [v, s] = rand(c.rng);
  c.rng = s;
  return min + v * (max - min);
}

/** 0 at the start, 1 once the difficulty ramp is complete. */
export function rampAt(z: number): number {
  return Math.min(1, Math.max(0, z) / RAMP_DIST);
}

export function spacingMaxAt(z: number): number {
  return SPACING_MAX + SPACING_RAMP * rampAt(z);
}

/** Generates vines up to playerZ + GEN_AHEAD and prunes ones far behind. Mutates. */
export function updateCourse(c: Course, playerZ: number): void {
  while (c.genZ < playerZ + GEN_AHEAD) {
    const z = c.genZ + r(c, SPACING_MIN, spacingMaxAt(c.genZ));
    const ease = rampAt(z); // early jungle is gentler
    const jitter = LATERAL_JITTER * (0.4 + 0.6 * ease);
    const x = centerX(z) + r(c, -jitter, jitter);
    const y = r(c, ANCHOR_Y_MIN, ANCHOR_Y_MAX);
    c.vines.push({ id: c.nextId++, x, y, z, length: r(c, VINE_LEN_MIN, VINE_LEN_MAX), phase: r(c, 0, 6.28) });
    if (r(c, 0, 1) < SIDE_VINE_CHANCE && z > 60) {
      const side = r(c, 0, 1) < 0.5 ? -1 : 1;
      const sz = z + r(c, -2.5, 2.5);
      c.vines.push({
        id: c.nextId++,
        x: x + side * r(c, 4.5, 6.5),
        y: r(c, ANCHOR_Y_MIN, ANCHOR_Y_MAX),
        z: sz,
        length: r(c, VINE_LEN_MIN, VINE_LEN_MAX),
        phase: r(c, 0, 6.28),
      });
    }
    c.genZ = z;
  }
  const cutoff = playerZ - PRUNE_BEHIND;
  if ((c.vines[0]?.z ?? cutoff) < cutoff) {
    c.vines = c.vines.filter((v) => v.z >= cutoff);
  }
}
