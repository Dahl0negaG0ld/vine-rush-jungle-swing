import { it } from "vitest";
import { createWorld, sim, startRun } from "./world";
import { bot } from "./world.test";
it("dbg2", () => {
  for (const seed of [2]) {
  const w = createWorld(seed);
  startRun(w);
  let last = "";
  for (let i = 0; i < 2400 && w.mode !== "fallen"; i++) {
    sim(w, 0.05, bot); if (w.time > 20 && w.time < 24 && Math.round(w.time*20)%4==0) console.log("S2 T", w.time.toFixed(2), w.mode, "p", w.p.x.toFixed(1), w.p.y.toFixed(1), w.p.z.toFixed(1), "v", w.v.x.toFixed(1), w.v.y.toFixed(1), w.v.z.toFixed(1), "tgt", w.target?.vine.id, w.target?.dist.toFixed(1), "yaw", w.yaw.toFixed(2));
    const s = w.mode + (w.vine?.id ?? "");
    if (s !== last) { last = s;
    const t = w.target;
    console.log("S" + seed, w.time.toFixed(2), w.mode, w.vine?.id ?? "-", "rope", w.rope.toFixed(1), "p", w.p.x.toFixed(1), w.p.y.toFixed(1), w.p.z.toFixed(1), "v", w.v.x.toFixed(1), w.v.y.toFixed(1), w.v.z.toFixed(1), "tgt", t?.vine.id, t && `(${t.vine.x.toFixed(1)},${t.vine.y.toFixed(1)},${t.vine.z.toFixed(1)} L${t.vine.length.toFixed(1)}) d${t.dist.toFixed(1)}`); }
  }
  }
});
