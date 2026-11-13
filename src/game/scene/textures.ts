import * as THREE from "three";

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

// Small seeded rng so textures look the same every load.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Mossy jungle floor with leaf litter. Tiles seamlessly. */
export function makeGroundTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  const r = rng(7);
  g.fillStyle = "#3b4a25";
  g.fillRect(0, 0, 256, 256);
  const blob = (x: number, y: number, rad: number, col: string) => {
    for (const ox of [-256, 0, 256])
      for (const oy of [-256, 0, 256]) {
        g.beginPath();
        g.fillStyle = col;
        g.ellipse(x + ox, y + oy, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2);
        g.fill();
      }
  };
  for (let i = 0; i < 60; i++) blob(r() * 256, r() * 256, 10 + r() * 30, r() < 0.5 ? "#33421f" : "#465a2b");
  for (let i = 0; i < 260; i++) blob(r() * 256, r() * 256, 2 + r() * 4, ["#6b5a2e", "#7d6a34", "#57692d", "#2a3519"][(r() * 4) | 0]);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Vertical bark streaks for trunks and branches. */
export function makeBarkTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  const r = rng(3);
  g.fillStyle = "#6a4a33";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(40,26,16,0.45)" : "rgba(150,120,80,0.25)";
    const x = r() * 128;
    g.fillRect(x, 0, 1 + r() * 4, 128);
  }
  for (let i = 0; i < 25; i++) {
    g.fillStyle = "rgba(90,130,60,0.35)"; // moss
    g.beginPath();
    g.ellipse(r() * 128, r() * 128, 4 + r() * 10, 3 + r() * 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft vertical light shaft (alpha gradient) for additive god-rays. */
export function makeRayTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64);
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const v = g.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.25, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
