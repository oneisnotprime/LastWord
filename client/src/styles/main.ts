/**
 * Art style prototypes: one fixed scene drawn five ways, to choose the look before the art pass.
 * Keys 1-5 switch style, N toggles night. Nothing here is used by the game page.
 */
import { H, W, hud, inset, lights } from "./scene.js";
import type { Style } from "./style.js";
import { lettersStyle } from "./letters.js";
import { inkStyle } from "./ink.js";
import { neonStyle } from "./neon.js";
import { paperStyle } from "./paper.js";
import { pixelStyle } from "./pixel.js";

const styles: Style[] = [lettersStyle, inkStyle, neonStyle, paperStyle, pixelStyle];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("map");
const ctx = canvas.getContext("2d")!;
const insetCanvas = $<HTMLCanvasElement>("inset");
const ictx = insetCanvas.getContext("2d")!;
const params = new URLSearchParams(location.search);

let current = Math.max(0, Math.min(styles.length - 1, Number(params.get("style") ?? 1) - 1));
let night = params.get("night") === "1";
let loading = true;
const loaded = new Set<number>();
const shade = document.createElement("canvas");

function buttons() {
  $("styles").innerHTML = styles.map((s, i) => `<button data-i="${i}" class="${i === current ? "on" : ""}"><b>${i + 1}</b> ${s.name}</button>`).join("") +
    `<button id="nightBtn" class="${night ? "on" : ""}"><b>N</b> Night</button>`;
}

async function select(i: number) {
  current = i;
  const s = styles[i]!;
  document.body.dataset.style = s.id;
  buttons();
  $("name").textContent = `${i + 1}. ${s.name}`;
  $("tagline").textContent = s.tagline;
  $("adjectives").textContent = s.adjectives;
  $("scaling").textContent = s.scaling;
  if (!loaded.has(i)) {
    loading = true;
    await Promise.all(s.fonts.map((f) => document.fonts.load(f).catch(() => [])));
    loaded.add(i);
    loading = false;
  }
}

function hudTiles() {
  const typed = hud.typed.split("");
  $("letters").innerHTML = hud.letters.map(([ch, n]) => {
    const used = typed.filter((c) => c === ch).length;
    const cls = used > n ? "short" : used ? "used" : "";
    return `<div class="tile ${cls}">${ch}<small>${n}</small></div>`;
  }).join("");
  $<HTMLInputElement>("spell").value = hud.typed;
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  insetCanvas.width = inset.w * dpr;
  insetCanvas.height = inset.h * dpr;
  insetCanvas.style.width = `${inset.w}px`;
  insetCanvas.style.height = `${inset.h}px`;
}

/** Darkness with holes where light falls. */
function drawNight(s: Style, t: number) {
  shade.width = W; shade.height = H;
  const g = shade.getContext("2d")!;
  g.fillStyle = s.night;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-out";
  for (const l of lights) {
    const flick = l.warm ? 1 + Math.sin(t * 9 + l.x) * 0.04 + Math.sin(t * 23) * 0.02 : 1;
    const rad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * flick);
    rad.addColorStop(0, "rgba(0,0,0,1)");
    rad.addColorStop(0.45, "rgba(0,0,0,0.75)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rad;
    g.beginPath(); g.arc(l.x, l.y, l.r * flick, 0, Math.PI * 2); g.fill();
  }
  ctx.drawImage(shade, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  for (const l of lights.filter((l) => l.warm)) {
    const rad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
    rad.addColorStop(0, "rgba(255,150,40,0.55)");
    rad.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.restore();
}

function frame(ms: number) {
  const t = params.has("t") ? Number(params.get("t")) : ms / 1000;
  const s = styles[current]!;
  if (!loading) {
    const dpr = window.devicePixelRatio || 1;
    // Cover the canvas with the scene, centred.
    const k = Math.max(canvas.width / W, canvas.height / H);
    ctx.setTransform(k, 0, 0, k, (canvas.width - W * k) / 2, (canvas.height - H * k) / 2);
    ctx.clearRect(0, 0, W, H);
    s.world(ctx, t);
    if (night) drawNight(s, t);
    s.labels(ctx, t);
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.clearRect(0, 0, inset.w, inset.h);
    s.inset(ictx, t);
    document.body.dataset.ready = "1";
  }
  requestAnimationFrame(frame);
}

$("styles").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  if (b.id === "nightBtn") { night = !night; buttons(); } else void select(Number(b.dataset.i));
});
window.addEventListener("keydown", (e) => {
  if (document.activeElement?.id === "spell") return;
  const n = Number(e.key);
  if (n >= 1 && n <= styles.length) void select(n - 1);
  if (e.key.toLowerCase() === "n") { night = !night; buttons(); }
});
window.addEventListener("resize", resize);

/** For browser checks: switch style and night from a script. */
(window as unknown as { __styles: object }).__styles = {
  select: (n: number) => select(n - 1),
  night: (on: boolean) => { night = on; buttons(); },
  ready: () => !loading,
};

resize();
hudTiles();
void select(current);
requestAnimationFrame(frame);
