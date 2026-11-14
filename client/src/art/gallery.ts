/** gallery.html: every per-word and archetype silhouette, for checking shapes as they are added. */
import "@fontsource/kalam/700.css";
import "@fontsource/fredoka/600.css";
import { dictionary } from "../data.js";
import { lookOf, type Look } from "./look.js";
import { tag } from "./paper.js";
import { ARCHETYPES, WORDS } from "./shapes.js";
import { renderStandee } from "./standee.js";

const params = new URLSearchParams(location.search);
const zoom = Number(params.get("zoom") ?? 1);
const k = Math.min(2, devicePixelRatio || 1) * zoom;
const out = document.getElementById("out")!;

function cell(title: string, look: Look) {
  const st = renderStandee(look, { k });
  const W = 150, H = 140;
  const c = document.createElement("canvas");
  c.width = W * k; c.height = H * k; c.style.width = `${W * zoom}px`; c.style.height = `${H * zoom}px`;
  const ctx = c.getContext("2d")!;
  ctx.scale(k, k);
  const fit = Math.min(1, (W - 10) / (st.canvas.width / k), (H - 30) / (st.canvas.height / k));
  ctx.drawImage(st.canvas, W / 2 - (st.ox / k) * fit, H - 30 - (st.oy / k) * fit + 4, (st.canvas.width / k) * fit, (st.canvas.height / k) * fit);
  tag(ctx, [title.toUpperCase()], W / 2, H - 14, 0, "#4a3f33", 11);
  return c;
}

function section(name: string, items: [string, Look][]) {
  const h = document.createElement("h2");
  h.textContent = `${name} (${items.length})`;
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const [t, l] of items) grid.append(cell(t, l));
  out.append(h, grid);
}

await Promise.all([document.fonts.load("700 13px Kalam"), document.fonts.load("600 9px Fredoka")]);
const extra = params.get("phrases");
if (extra) section("Phrases", extra.split(",").map((p) => { const [text, n] = p.split("*"); return [`${text}${n ? ` ×${n}` : ""}`, lookOf(dictionary, text!, Number(n ?? 1))]; }));
section("Words", Object.keys(WORDS).map((w) => [w, lookOf(dictionary, w)]));
section("Archetypes", Object.entries(ARCHETYPES).map(([a, sil]) => [a, { ...lookOf(dictionary, "box"), noun: a, shape: sil, colour: sil.colour ?? "#c9b99a" }]));
