import { create } from "zustand";
import type { Mode } from "./sim/world";

export type Hint = "start" | "hold" | "release" | "aim" | "reach" | "grab" | "none";

interface LastRun {
  distance: number;
  vines: number;
  newBest: boolean;
}

interface GameUI {
  mode: Mode;
  hint: Hint;
  best: number;
  reducedMotion: boolean;
  tutorialDone: boolean;
  lastRun: LastRun | null;
  runId: number;
  setMode: (m: Mode) => void;
  setHint: (h: Hint) => void;
  finishRun: (distance: number, vines: number) => void;
  setReducedMotion: (v: boolean) => void;
  markTutorialDone: () => void;
  restart: () => void;
  hydrate: () => void;
}

const KEY = "vine-rush-fp";

function save(s: Pick<GameUI, "best" | "reducedMotion" | "tutorialDone">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: ignore */
  }
}

export const useGame = create<GameUI>((set, get) => ({
  mode: "ready",
  hint: "start",
  best: 0,
  reducedMotion: false,
  tutorialDone: false,
  lastRun: null,
  runId: 0,
  setMode: (mode) => set({ mode }),
  setHint: (hint) => set({ hint }),
  finishRun: (distance, vines) => {
    const d = Math.floor(distance);
    const newBest = d > get().best;
    const best = Math.max(get().best, d);
    set({ best, lastRun: { distance: d, vines, newBest } });
    save({ best, reducedMotion: get().reducedMotion, tutorialDone: get().tutorialDone });
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
    save({ best: get().best, reducedMotion, tutorialDone: get().tutorialDone });
  },
  markTutorialDone: () => {
    if (get().tutorialDone) return;
    set({ tutorialDone: true });
    save({ best: get().best, reducedMotion: get().reducedMotion, tutorialDone: true });
  },
  restart: () => set((s) => ({ runId: s.runId + 1, mode: "ready", hint: "start", lastRun: null })),
  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      if (raw) {
        const s = JSON.parse(raw);
        set({
          best: Number(s.best) || 0,
          reducedMotion: typeof s.reducedMotion === "boolean" ? s.reducedMotion : prefersReduced,
          tutorialDone: !!s.tutorialDone,
        });
      } else set({ reducedMotion: prefersReduced });
    } catch {
      /* ignore */
    }
  },
}));
