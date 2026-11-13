import { describe, expect, it } from "vitest";
import { FALL_Y, G, GRAB_RADIUS, RELEASE_BOOST, RELEASE_UP } from "./constants";
import type { Vine } from "./course";
import { centerX } from "./course";
import { dragToAxes, keysToAxes } from "./input";
import { closestOnVine, createWorld, forwardOf, rightOf, sim, startRun, step, type Input, type World } from "./world";

const HOLD: Input = { hold: true, steer: 0, lean: 0 };
const LET_GO: Input = { hold: false, steer: 0, lean: 0 };

function ropeLen(w: World) {
  const v = w.vine!;
  return Math.hypot(w.p.x - v.x, w.p.y - v.y, w.p.z - v.z);
}

/** Would letting go now carry the hands within reach of the target vine? */
function releaseReaches(w: World, target: Vine): boolean {
  const f = forwardOf(w.yaw);
  let x = w.p.x, y = w.p.y, z = w.p.z;
  let vx = w.v.x, vy = w.v.y + RELEASE_UP, vz = w.v.z;
  if (vx * f.x + vz * f.z > 0) { vx += f.x * RELEASE_BOOST; vz += f.z * RELEASE_BOOST; }
  for (let t = 0; t < 3 && y > FALL_Y; t += 0.02) {
    vy -= G * 0.02;
    x += vx * 0.02; y += vy * 0.02; z += vz * 0.02;
    if (closestOnVine(target, { x, y, z }).dist < GRAB_RADIUS * 0.8) return true;
  }
  return false;
}

/** A plain player: pump while hanging, let go when the jump lands on the highlighted vine, reach in the air. */
export function bot(w: World): Input {
  const ahead = w.target?.vine;
  const r = rightOf(w.yaw);
  const lateral = ahead ? (ahead.x - w.p.x) * r.x + (ahead.z - w.p.z) * r.z : 0;
  const vLat = w.v.x * r.x + w.v.z * r.z;
  const steer = Math.max(-1, Math.min(1, (lateral - vLat * 0.8) / 3));
  const speed = Math.hypot(w.v.x, w.v.y, w.v.z);
  if (w.mode === "swing" && w.vine) {
    const f = forwardOf(w.yaw);
    const fwd = (w.p.x - w.vine.x) * f.x + (w.p.z - w.vine.z) * f.z;
    const vf = w.v.x * f.x + w.v.z * f.z;
    const rising = w.v.y > 0 && vf > 1 && fwd > 0;
    const letGo = rising && !!ahead && releaseReaches(w, ahead);
    return { hold: !letGo, steer, lean: speed < 7 ? 1 : 0 };
  }
  return { hold: true, steer, lean: 0 };
}

describe("swing physics", () => {
  it("waits in the ready pose until the run starts", () => {
    const w = createWorld(1);
    const y = w.p.y;
    sim(w, 1, HOLD);
    expect(w.mode).toBe("ready");
    expect(w.p.y).toBe(y);
  });

  it("keeps the hands on the rope while holding (rope never stretches)", () => {
    const w = createWorld(1);
    startRun(w);
    for (let i = 0; i < 600; i++) {
      step(w, HOLD);
      expect(ropeLen(w)).toBeLessThanOrEqual(w.rope + 1e-6);
    }
  });

  it("swings like a pendulum: from 45deg back it rises to roughly 45deg forward", () => {
    const w = createWorld(1);
    startRun(w);
    let maxZ = -Infinity;
    sim(w, 3.6, (s) => {
      maxZ = Math.max(maxZ, s.p.z);
      return HOLD;
    });
    const expected = w.rope * Math.sin(Math.PI / 4);
    expect(maxZ).toBeGreaterThan(expected * 0.85); // air drag takes a little
    expect(maxZ).toBeLessThan(expected * 1.05);
  });

  it("keeps momentum after letting go", () => {
    const w = createWorld(1);
    startRun(w);
    sim(w, 1.6, HOLD); // near the bottom, moving forward fast
    const vz = w.v.z;
    expect(vz).toBeGreaterThan(5);
    step(w, LET_GO);
    expect(w.mode).toBe("air");
    expect(w.v.z).toBeGreaterThanOrEqual(vz);
  });

  it("falls to the jungle floor and ends the run when nothing is grabbed", () => {
    const w = createWorld(1);
    startRun(w);
    sim(w, 6, LET_GO);
    expect(w.mode).toBe("fallen");
    expect(w.p.y).toBe(FALL_Y);
  });

  it("only grabs vines inside the reach radius", () => {
    const w = createWorld(1);
    startRun(w);
    w.mode = "air";
    w.vine = null;
    const v = { id: 99, x: 0, y: 22, z: 12, length: 14, phase: 0 };
    w.course.vines = [v];
    w.course.genZ = 1e9;
    w.p = { x: v.x + GRAB_RADIUS + 0.5, y: v.y - 6, z: v.z };
    w.v = { x: 0, y: 0, z: 0 };
    step(w, { hold: true, steer: 0, lean: 0 });
    expect(w.mode).toBe("air");
    w.p = { x: v.x + GRAB_RADIUS - 0.5, y: v.y - 6, z: v.z };
    w.v = { x: 0, y: 0, z: 0 };
    step(w, { hold: true, steer: 0, lean: 0 });
    expect(w.mode).toBe("swing");
    expect(w.vine?.id).toBe(v.id);
  });

  it("does not grab when not holding", () => {
    const w = createWorld(1);
    startRun(w);
    w.mode = "air";
    w.vine = null;
    const v = w.course.vines[1];
    w.p = { x: v.x + 0.5, y: v.y - 6, z: v.z };
    step(w, LET_GO);
    expect(w.mode).toBe("air");
  });

  it("steering right moves the player toward screen-right", () => {
    const a = createWorld(1);
    const b = createWorld(1);
    for (const w of [a, b]) {
      startRun(w);
      w.mode = "air";
      w.vine = null;
      w.p = { x: 0, y: 200, z: 0 };
      w.v = { x: 0, y: 0, z: 6 };
    }
    sim(a, 1, { hold: false, steer: 1, lean: 0 });
    sim(b, 1, { hold: false, steer: 0, lean: 0 });
    const r = rightOf(0);
    const offset = (a.p.x - b.p.x) * r.x + (a.p.z - b.p.z) * r.z;
    expect(offset).toBeGreaterThan(0.5);
  });
});

describe("playability", () => {
  it.each([1, 7, 42, 1234])("a simple player chains vines for 300 m (seed %i)", (seed) => {
    const w = createWorld(seed);
    startRun(w);
    let t = 0;
    while (w.mode !== "fallen" && w.distance < 300 && t < 200) {
      sim(w, 0.5, bot);
      t += 0.5;
    }
    expect(w.mode).not.toBe("fallen");
    expect(w.distance).toBeGreaterThanOrEqual(300);
  });

  it("the course keeps generating vines ahead and drops old ones", () => {
    const w = createWorld(3);
    startRun(w);
    sim(w, 60, bot);
    const zs = w.course.vines.map((v) => v.z);
    expect(Math.max(...zs)).toBeGreaterThan(w.p.z + 100);
    expect(Math.min(...zs)).toBeGreaterThan(w.p.z - 40);
  });

  it("vines stay near the corridor centre line", () => {
    const w = createWorld(9);
    for (const v of w.course.vines) expect(Math.abs(v.x - centerX(v.z))).toBeLessThan(10);
  });
});

describe("controls mapping", () => {
  it("drag right steers right, drag up leans forward", () => {
    expect(dragToAxes(70, 0).steer).toBe(1);
    expect(dragToAxes(-70, 0).steer).toBe(-1);
    expect(dragToAxes(0, -70).lean).toBe(1);
    expect(dragToAxes(4, 4)).toEqual({ steer: 0, lean: 0 });
  });
  it("keyboard D/Right steers right, Space holds", () => {
    expect(keysToAxes(new Set(["KeyD"])).steer).toBe(1);
    expect(keysToAxes(new Set(["ArrowLeft"])).steer).toBe(-1);
    expect(keysToAxes(new Set(["Space"])).hold).toBe(true);
  });
});
