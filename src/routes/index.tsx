import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { advance, createWorld, startRun, type Input, type World } from "../game/sim/world";
import { centerX } from "../game/sim/course";
import { useGame } from "../game/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "VINE RUSH — Jungle Swing" }, { name: "description", content: "First-person jungle vine swinging game" }] }),
  component: JungleGame,
});

const input: Input = { hold: false, steer: 0, lean: 0 };
const palette = ["#275b31", "#36763d", "#448446", "#1d4c2e", "#57934a"];

function Tree({ x, z, seed }: { x: number; z: number; seed: number }) {
  const height = 13 + (seed % 7);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.65, 1.25, height, 7]} />
        <meshStandardMaterial color="#66442e" roughness={1} />
      </mesh>
      <mesh position={[0, height + 1.4, 0]} castShadow>
        <icosahedronGeometry args={[5.5 + seed % 3, 1]} />
        <meshStandardMaterial color={palette[seed % palette.length]} roughness={1} flatShading />
      </mesh>
      <mesh position={[2.5, height - 1, -1]} castShadow>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color={palette[(seed + 2) % palette.length]} flatShading />
      </mesh>
    </group>
  );
}

function Vine({ x, y, z, length, active, target }: { x: number; y: number; z: number; length: number; active: boolean; target: boolean }) {
  return (
    <group position={[x, y - length / 2, z]}>
      <mesh>
        <cylinderGeometry args={[active ? 0.12 : 0.08, 0.1, length, 7]} />
        <meshStandardMaterial color={target ? "#f4e969" : active ? "#b2df55" : "#749a40"} emissive={target ? "#70631a" : "#000000"} emissiveIntensity={target ? 0.5 : 0} />
      </mesh>
      {target && <mesh position={[0, -length / 2 + 1.2, 0]}>
        <torusGeometry args={[0.9, 0.09, 6, 20]} />
        <meshBasicMaterial color="#ffed7c" />
      </mesh>}
    </group>
  );
}

function Hands({ grabbing }: { grabbing: boolean }) {
  return (
    <group position={[0, -0.8, -1.4]}>
      {[-1, 1].map(side => (
        <group key={side} position={[side * 0.42, 0, 0]} rotation={[grabbing ? -0.7 : 0.22, 0, side * 0.22]}>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.13, 0.45, 4, 8]} />
            <meshStandardMaterial color="#66794a" />
          </mesh>
          <mesh position={[0, 0.23, -0.08]}>
            <sphereGeometry args={[0.16, 9, 8]} />
            <meshStandardMaterial color="#cf986f" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function WorldScene({ worldRef, inputRef, onTick }: { worldRef: React.MutableRefObject<World>; inputRef: React.MutableRefObject<Input>; onTick: (w: World) => void }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const lastMode = useRef("");
  const lastDistance = useRef(-1);
  const trees = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const z = Math.floor(i / 2) * 14 - 32;
    const side = i % 2 ? 1 : -1;
    const noise = Math.sin(i * 23.17) * 3;
    return { x: centerX(z) + side * (14 + (i % 5) * 2.5) + noise, z, seed: i * 7 + 3 };
  }), []);

  useFrame((_, delta) => {
    const w = worldRef.current;
    advance(w, inputRef.current, delta);
    const bob = w.mode === "swing" ? Math.sin(w.time * 8) * 0.045 : 0;
    camera.position.set(w.p.x, w.p.y + 0.15 + bob, w.p.z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(Math.max(-0.16, Math.min(0.2, -w.v.y * 0.012)), w.yaw, Math.max(-0.1, Math.min(0.1, -w.v.x * 0.008)), "YXZ");
    elapsed.current += delta;
    const distance = Math.floor(w.distance);
    if (elapsed.current > 0.12 || lastMode.current !== w.mode || lastDistance.current !== distance) {
      elapsed.current = 0;
      lastMode.current = w.mode;
      lastDistance.current = distance;
      onTick(w);
    }
  });

  const w = worldRef.current;
  return (
    <>
      <color attach="background" args={["#9cc9ad"]} />
      <fog attach="fog" args={["#8caf8a", 24, 105]} />
      <ambientLight intensity={1.8} color="#d4f2cb" />
      <directionalLight position={[20, 35, 15]} intensity={2.4} color="#ffe2a2" />
      <mesh position={[0, -4, 160]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 1000]} />
        <meshStandardMaterial color="#2a5832" />
      </mesh>
      {trees.map(t => <Tree key={t.seed} {...t} />)}
      {w.course.vines.map(v => <Vine key={v.id} {...v} active={w.vine?.id === v.id} target={w.target?.vine.id === v.id} />)}
      <group position={camera.position} rotation={camera.rotation}><Hands grabbing={w.mode === "swing"} /></group>
    </>
  );
}

function JungleGame() {
  const worldRef = useRef(createWorld(7));
  const inputRef = useRef<Input>({ ...input });
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [hud, setHud] = useState({ distance: 0, mode: "ready", vines: 0, target: false });
  const [run, setRun] = useState(0);
  const [best, setBest] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    try { setBest(Number(localStorage.getItem("vine-rush-best") || 0)); } catch { /* private browsing */ }
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); if (worldRef.current.mode === "ready") startRun(worldRef.current); inputRef.current.hold = true; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") inputRef.current.steer = -1;
      if (e.code === "ArrowRight" || e.code === "KeyD") inputRef.current.steer = 1;
      if (e.code === "ArrowUp" || e.code === "KeyW") inputRef.current.lean = 1;
      if (e.code === "ArrowDown" || e.code === "KeyS") inputRef.current.lean = -1;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") inputRef.current.hold = false;
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) inputRef.current.steer = 0;
      if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(e.code)) inputRef.current.lean = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const tick = (w: World) => {
    setHud({ distance: Math.floor(w.distance), mode: w.mode, vines: w.vinesGrabbed, target: !!w.target?.inReach });
    if (w.mode === "fallen" && !finished.current) {
      finished.current = true;
      setBest(old => {
        const next = Math.max(old, Math.floor(w.distance));
        try { localStorage.setItem("vine-rush-best", String(next)); } catch { /* ignore */ }
        return next;
      });
    }
  };
  const reset = () => {
    worldRef.current = createWorld(Math.floor(Math.random() * 100000) + 1);
    inputRef.current = { ...input };
    pointerRef.current = null;
    finished.current = false;
    setHud({ distance: 0, mode: "ready", vines: 0, target: false });
    setRun(n => n + 1);
  };
  return (
    <main style={{ position: "fixed", inset: 0, background: "#142a1b", color: "#fff", fontFamily: "system-ui, sans-serif", overflow: "hidden", touchAction: "none", userSelect: "none" }}
      onPointerDown={e => {
        if (hud.mode === "fallen") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        inputRef.current.hold = true;
        if (worldRef.current.mode === "ready") startRun(worldRef.current);
      }}
      onPointerMove={e => {
        const p = pointerRef.current;
        if (!p || p.id !== e.pointerId) return;
        inputRef.current.steer = Math.max(-1, Math.min(1, (p.x - e.clientX) / 85));
        inputRef.current.lean = Math.max(-1, Math.min(1, (p.y - e.clientY) / 100));
      }}
      onPointerUp={e => {
        if (pointerRef.current?.id !== e.pointerId) return;
        pointerRef.current = null;
        inputRef.current.hold = false;
        inputRef.current.steer = 0;
        inputRef.current.lean = 0;
      }}
      onPointerCancel={() => { pointerRef.current = null; inputRef.current = { ...input }; }}
    >
      <Canvas key={run} camera={{ fov: 78, near: 0.06, far: 145 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ position: "absolute", inset: 0 }}>
        <WorldScene worldRef={worldRef} inputRef={inputRef} onTick={tick} />
      </Canvas>
      <div style={{ position: "absolute", top: "max(18px, env(safe-area-inset-top))", left: 18, pointerEvents: "none", textShadow: "0 2px 8px #122" }}>
        <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 19 }}>VINE RUSH</div>
        <div style={{ fontSize: 30, fontWeight: 800 }}>{hud.distance} <span style={{ fontSize: 14 }}>m</span></div>
        <div style={{ fontSize: 12 }}>BEST {best} m · VINES {hud.vines}</div>
      </div>
      <div style={{ position: "absolute", top: "46%", left: "50%", transform: "translate(-50%, -50%)", width: 12, height: 12, border: "2px solid #f6f2c5", borderRadius: "50%", boxShadow: hud.target ? "0 0 18px 7px #effb6b" : "0 0 6px #173", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "max(32px, env(safe-area-inset-bottom))", left: 16, right: 16, textAlign: "center", pointerEvents: "none", fontWeight: 700, textShadow: "0 2px 7px #142" }}>
        {hud.mode === "ready" ? "TOUCH & HOLD TO SWING · RELEASE TO FLY" : hud.mode === "swing" ? "RELEASE TO LAUNCH · DRAG TO STEER" : hud.mode === "air" ? hud.target ? "HOLD! CATCH THAT VINE!" : "HOLD TO GRAB THE NEXT VINE" : "JUNGLE RUN COMPLETE"}
        <div style={{ fontWeight: 400, fontSize: 12, marginTop: 6, opacity: 0.85 }}>Desktop: Space to grab/release · WASD or arrows to steer</div>
      </div>
      {hud.mode === "fallen" && <div style={{ position: "absolute", inset: 0, background: "#0a2118c9", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 38, margin: "0 0 8px" }}>WHAT A RIDE!</h1>
          <p>{hud.distance} meters · {hud.vines} vines grabbed</p>
          <button onPointerDown={e => e.stopPropagation()} onClick={reset} style={{ background: "#dcf66b", color: "#19331c", border: 0, borderRadius: 18, padding: "16px 32px", fontSize: 19, fontWeight: 800, cursor: "pointer" }}>SWING AGAIN ↗</button>
        </div>
      </div>}
    </main>
  );
}
