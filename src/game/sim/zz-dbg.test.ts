import { it } from "vitest";
import { createWorld, sim, startRun } from "./world";
import { bot } from "./world.test";
it("dbg", () => {
  const out: string[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const w = createWorld(seed);
    startRun(w);
    let t = 0;
    while (w.mode !== "fallen" && t < 120) { sim(w, 0.5, bot); t += 0.5; }
    out.push(`${seed}:${w.distance.toFixed(0)}m/${w.vinesGrabbed}v${w.mode === "fallen" ? "F" : ""}`);
  }
  console.log(out.join(" "));
});
