import { createFileRoute } from "@tanstack/react-router";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3, Quaternion, MathUtils, type Group, type Mesh } from "three";
import { advance, createWorld, startRun, type Input, type World } from "../game/sim/world";
import { centerX } from "../game/sim/course";
import { dragToAxes } from "../game/sim/input";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "VINE RUSH — Jungle Swing" }, { name: "description", content: "Third-person jungle vine swinging game" }] }),
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
        <meshStandardMaterial color={palette[seed % palette.length] ?? "#275b31"} roughness={1} flatShading />
      </mesh>
      <mesh position={[2.5, height - 1, -1]} castShadow>
        <icosahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial color={palette[(seed + 2) % palette.length] ?? "#36763d"} flatShading />
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

function Swinger({ avatarRef, ropeRef }: { avatarRef: React.RefObject<Group | null>; ropeRef: React.RefObject<Mesh | null> }) {
  return <>
    <group ref={avatarRef}>
      <mesh position={[0, -0.8, 0]} castShadow><capsuleGeometry args={[0.35, 0.9, 6, 10]} /><meshStandardMaterial color="#e5a82f" /></mesh>
      <mesh position={[0, -0.12, 0]} castShadow><sphereGeometry args={[0.3, 12, 10]} /><meshStandardMaterial color="#dba27c" /></mesh>
      <mesh position={[0, -1.65, -0.17]} rotation={[0.22, 0, -0.16]}><capsuleGeometry args={[0.13, 0.7, 5, 8]} /><meshStandardMaterial color="#243d38" /></mesh>
      <mesh position={[0, -1.65, 0.17]} rotation={[-0.22, 0, 0.16]}><capsuleGeometry args={[0.13, 0.7, 5, 8]} /><meshStandardMaterial color="#243d38" /></mesh>
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.22, -0.38, 0]} rotation={[0, 0, side * 0.3]}><capsuleGeometry args={[0.1, 0.6, 5, 8]} /><meshStandardMaterial color="#dba27c" /></mesh>)}
    </group>
    <mesh ref={ropeRef}><cylinderGeometry args={[0.045, 0.045, 1, 7]} /><meshStandardMaterial color="#b8d47c" /></mesh>
  </>;
}

function WorldScene({ worldRef, inputRef, lookRef, cameraModeRef, onTick }: { worldRef: React.MutableRefObject<World>; inputRef: React.MutableRefObject<Input>; lookRef: React.MutableRefObject<{ yaw: number; pitch: number }>; cameraModeRef: React.MutableRefObject<"chase" | "first">; onTick: (w: World) => void }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const avatarRef = useRef<Group>(null);
  const ropeRef = useRef<Mesh>(null);
  const camGoal = useRef(new Vector3());
  const aimGoal = useRef(new Vector3());
  const lastGrab = useRef(0);
  const cinematicUntil = useRef(0);
  const ropeAxis = useMemo(() => new Vector3(0, 1, 0), []);
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
    // Smooth chase camera stays behind the character; brief close-up after a great catch.
    if (w.grabCount !== lastGrab.current) {
      if (lastGrab.current > 0 || w.grabCount > 1) cinematicUntil.current = w.time + 0.8;
      lastGrab.current = w.grabCount;
    }
    const yaw = w.yaw + lookRef.current.yaw;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const isFirst = cameraModeRef.current === "first" || (w.mode !== "ready" && w.time < cinematicUntil.current);
    const bob = w.mode === "swing" ? Math.sin(w.time * 5) * 0.025 : 0;
    const head = new Vector3(w.p.x, w.p.y - 0.3, w.p.z);
    const distance = isFirst ? 0.08 : 6.8;
    const height = isFirst ? 0.1 : 2.6;
    camGoal.current.copy(head).addScaledVector(forward, -distance).add(new Vector3(0, height + bob, 0));
    const smooth = 1 - Math.exp(-5.5 * Math.min(delta, 0.05));
    camera.position.lerp(camGoal.current, smooth);
    aimGoal.current.copy(head).addScaledVector(forward, 11).add(new Vector3(0, 0.9 + lookRef.current.pitch * 8, 0));
    camera.lookAt(aimGoal.current);
    if (avatarRef.current) {
      avatarRef.current.position.set(w.p.x, w.p.y, w.p.z);
      avatarRef.current.rotation.set(MathUtils.clamp(w.v.z * 0.012, -0.3, 0.3), w.yaw, MathUtils.clamp(-w.v.x * 0.025, -0.35, 0.35));
      avatarRef.current.visible = !isFirst;
    }
    if (ropeRef.current) {
      ropeRef.current.visible = !!w.vine;
      if (w.vine) {
        const top = new Vector3(w.vine.x, w.vine.y, w.vine.z);
        const bottom = new Vector3(w.p.x, w.p.y, w.p.z);
        const dir = top.clone().sub(bottom);
        ropeRef.current.position.copy(top).add(bottom).multiplyScalar(0.5);
        ropeRef.current.scale.set(1, dir.length(), 1);
        ropeRef.current.quaternion.copy(new Quaternion().setFromUnitVectors(ropeAxis, dir.normalize()));
      }
    }
    elapsed.current += delta;
    const progress = Math.floor(w.distance);
    if (elapsed.current > 0.12 || lastMode.current !== w.mode || lastDistance.current !== progress) {
      elapsed.current = 0;
      lastMode.current = w.mode;
      lastDistance.current = progress;
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
      <Swinger avatarRef={avatarRef} ropeRef={ropeRef} />
    </>
  );
}

function JungleGame() {
  const worldRef = useRef(createWorld(7));
  const inputRef = useRef<Input>({ ...input });
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const lookPointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const cameraModeRef = useRef<"chase" | "first">("chase");
  const [cameraMode, setCameraMode] = useState<"chase" | "first">("chase");
  const [hud, setHud] = useState({ distance: 0, mode: "ready", vines: 0, target: false });
  const [run, setRun] = useState(0);
  const [best, setBest] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    try { setBest(Number(localStorage.getItem("vine-rush-best") || 0)); } catch { /* private browsing */ }
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyC" && !e.repeat) setCameraMode(current => { const next = current === "chase" ? "first" : "chase"; cameraModeRef.current = next; return next; });
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
    lookPointerRef.current = null;
    lookRef.current = { yaw: 0, pitch: 0 };
    cameraModeRef.current = "chase";
    setCameraMode("chase");
    finished.current = false;
    setHud({ distance: 0, mode: "ready", vines: 0, target: false });
    setRun(n => n + 1);
  };
  return (
    <main style={{ position: "fixed", inset: 0, background: "#142a1b", color: "#fff", fontFamily: "system-ui, sans-serif", overflow: "hidden", touchAction: "none", userSelect: "none" }}
      onPointerDown={e => {
        if (hud.mode === "fallen") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        // Right mouse drag or a second finger looks around without changing the swing.
        if (e.button === 2 || pointerRef.current) {
          lookPointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          return;
        }
        pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        inputRef.current.hold = true;
        if (worldRef.current.mode === "ready") startRun(worldRef.current);
      }}
      onPointerMove={e => {
        const look = lookPointerRef.current;
        if (look?.id === e.pointerId) {
          lookRef.current.yaw -= (e.clientX - look.x) * 0.006;
          lookRef.current.pitch = Math.max(-1.1, Math.min(1.1, lookRef.current.pitch - (e.clientY - look.y) * 0.006));
          look.x = e.clientX;
          look.y = e.clientY;
          return;
        }
        const p = pointerRef.current;
        if (!p || p.id !== e.pointerId) return;
        const axes = dragToAxes(e.clientX - p.x, e.clientY - p.y);
        inputRef.current.steer = axes.steer;
        inputRef.current.lean = axes.lean;
      }}
      onPointerUp={e => {
        if (lookPointerRef.current?.id === e.pointerId) { lookPointerRef.current = null; return; }
        if (pointerRef.current?.id !== e.pointerId) return;
        pointerRef.current = null;
        inputRef.current.hold = false;
        inputRef.current.steer = 0;
        inputRef.current.lean = 0;
      }}
      onPointerCancel={e => {
        if (lookPointerRef.current?.id === e.pointerId) lookPointerRef.current = null;
        if (pointerRef.current?.id === e.pointerId) { pointerRef.current = null; inputRef.current = { ...input }; }
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <Canvas key={run} camera={{ fov: 78, near: 0.06, far: 145 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }} style={{ position: "absolute", inset: 0 }}>
        <WorldScene worldRef={worldRef} inputRef={inputRef} lookRef={lookRef} cameraModeRef={cameraModeRef} onTick={tick} />
      </Canvas>
      <div style={{ position: "absolute", top: "max(18px, env(safe-area-inset-top))", left: 18, pointerEvents: "none", textShadow: "0 2px 8px #122" }}>
        <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 19 }}>VINE RUSH</div>
        <div style={{ fontSize: 30, fontWeight: 800 }}>{hud.distance} <span style={{ fontSize: 14 }}>m</span></div>
        <div style={{ fontSize: 12 }}>BEST {best} m · VINES {hud.vines}</div>
      </div>
      <button onPointerDown={e => e.stopPropagation()} onClick={() => setCameraMode(current => { const next = current === "chase" ? "first" : "chase"; cameraModeRef.current = next; return next; })} style={{ position: "absolute", top: "max(18px, env(safe-area-inset-top))", right: 16, zIndex: 3, background: "#173b2acc", color: "white", border: "1px solid #b4dc92", borderRadius: 12, padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>{cameraMode === "chase" ? "CAM: BEHIND" : "CAM: FIRST"}</button>
      <div style={{ position: "absolute", top: "46%"', left: "50%", transform: "translate(-50%, -50%)", width: 12, height: 12, border: "2px solid #f6f2c5", borderRadius: "50%", boxShadow: hud.target ? "0 0 18px 7px #effb6b" : "0 0 6px #173", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "max(32px, env(safe-area-inset-bottom))", left: 16, right: 16, textAlign: "center", pointerEvents: "none", fontWeight: 700, textShadow: "0 2px 7px #142" }}>
        {hud.mode === "ready" ? "TOUCH & HOLD TO SWING · RELEASE TO FLY" : hud.mode === "swing" ? "RELEASE TO LAUNCH · DRAG TO STEER" : hud.mode === "air" ? hud.target ? "HOLD! CATCH THAT VINE!" : "HOLD TO GRAB THE NEXT VINE" : "JUNGLE RUN COMPLETE"}
        <div style={{ fontWeight: 400, fontSize: 12, marginTop: 6, opacity: 0.85 }}>Desktop: Space grab · WASD steer · C camera · right-drag look · Mobile: second finger look</div>
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
