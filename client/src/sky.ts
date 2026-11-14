/**
 * Night, weather and fields over the whole map. Night is a sheet of blue tissue with holes torn
 * where there is light; rain is strips of paper, snow is paper dots, fog is drifting tissue;
 * a field over the map (HEAVEN, LOVE, WAR...) tints the sheet and drifts its own cut-outs.
 */
import Phaser from "phaser";
import type { Dictionary } from "@lastword/shared";
import { icon } from "./art/build.js";
import { hash } from "./art/util.js";
import { useMade, type Made, type Painter } from "./paint.js";
import { zoneStyle } from "./zones.js";

/** The overlay is drawn this many times smaller than the screen; it is all soft gradients. */
const SHRINK = 6;

interface Drift { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; spin: number; i: number; base: number }

export class Sky {
  private tex: Phaser.Textures.CanvasTexture;
  private img: Phaser.GameObjects.Image;
  private drifts: Drift[] = [];
  private driftKind = "";
  private fog: Phaser.GameObjects.Image[] = [];
  private flash = 0;
  private drawnBlank = false;

  constructor(private readonly scene: Phaser.Scene, private readonly paint: Painter, private readonly dict: Dictionary) {
    this.tex = scene.textures.createCanvas("sky", 64, 64)!;
    this.img = scene.add.image(0, 0, "sky").setDepth(9000).setOrigin(0);
  }

  private made(kind: string, i: number): Made {
    switch (kind) {
      case "rain": case "storm": return this.paint.streak();
      case "snow": return this.paint.speck("#fbfbf8", 2 + (i % 3) * 0.6);
      case "fire": case "hell": return i % 3 ? this.paint.speck("#f4b942", 1.4) : this.paint.flame(9, i % 3);
      case "love": return this.paint.heart(4 + (i % 2), i % 2 ? "#e0708f" : "#f2a0b4");
      case "heaven": return i % 4 === 0 ? this.paint.decal("star", icon.star("#f4d35e"), 0.5) : this.paint.decal("cloud", icon.cloud("#fbf7ec"), 1.2);
      case "war": return i % 2 ? this.paint.speck("#6a6460", 1.6) : this.paint.decal("smoke", icon.cloud("#8a8580"), 1);
      default: {
        const style = zoneStyle(this.dict, kind);
        if (style.decor === "bubble" || style.decor === "skull") return this.paint.speck("#9ac46a", 1.8);
        if (style.decor === "heart") return this.paint.heart(4, "#e0a0c0");
        return this.paint.speck(style.colour, 1.8);
      }
    }
  }

  /** Swaps the drifting cut-outs to a new kind (or none). */
  private setDrift(kind: string, n: number) {
    if (kind === this.driftKind) return;
    this.driftKind = kind;
    this.drifts.forEach((d) => d.img.destroy());
    this.drifts = [];
    const cam = this.scene.cameras.main.worldView;
    for (let i = 0; i < (kind ? n : 0); i++) {
      const img = this.scene.add.image(0, 0, "__WHITE").setDepth(9500);
      useMade(img, this.made(kind, i), this.paint.k);
      const fall = kind === "rain" || kind === "storm" ? 260 : kind === "snow" ? 26 : -10;
      this.drifts.push({
        img, x: cam.x + hash(i, 1, 9) * cam.width, y: cam.y + hash(i, 2, 9) * cam.height,
        vx: kind === "rain" || kind === "storm" ? -50 : (hash(i, 3, 9) - 0.5) * 14, vy: fall * (0.8 + hash(i, 4, 9) * 0.4), spin: (hash(i, 5, 9) - 0.5) * 2, i, base: img.scaleX,
      });
    }
  }

  update(daylight: string, weather: string, overMap: string[], lights: { x: number; y: number; r: number; warm: boolean }[], time: number, delta: number) {
    const cam = this.scene.cameras.main, view = cam.worldView, t = time / 1000, dt = delta / 1000;
    const night = daylight === "night";
    // The sheet: night blue, weather grey, a field's colour.
    const layers: string[] = [];
    if (night) layers.push("rgba(18,28,64,0.6)");
    if (weather === "storm") layers.push("rgba(30,34,52,0.4)");
    if (weather === "rain") layers.push("rgba(70,90,120,0.2)");
    if (weather === "fog") layers.push("rgba(232,234,236,0.35)");
    if (weather === "snow") layers.push("rgba(240,245,250,0.18)");
    for (const w of overMap) {
      const c = zoneStyle(this.dict, w).colour;
      layers.push(`rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},0.16)`);
    }
    if (weather === "storm" && Math.random() < dt * 0.15) this.flash = 1;
    this.flash = Math.max(0, this.flash - dt * 3);
    const w = Math.max(1, Math.ceil(cam.width / SHRINK)), h = Math.max(1, Math.ceil(cam.height / SHRINK));
    const blank = !layers.length && this.flash === 0;
    if (!blank || !this.drawnBlank) {
      if (this.tex.width !== w || this.tex.height !== h) { this.tex.setSize(w, h); this.img.setTexture("sky"); }
      const ctx = this.tex.context;
      ctx.clearRect(0, 0, w, h);
      for (const l of layers) { ctx.fillStyle = l; ctx.fillRect(0, 0, w, h); }
      if (night || weather === "storm") {
        // Holes torn where there is light, then a warm glow in them.
        const z = cam.zoom / SHRINK;
        const sx = (x: number) => (x - view.x) * z, sy = (y: number) => (y - view.y) * z;
        ctx.globalCompositeOperation = "destination-out";
        for (const l of lights) {
          const g = ctx.createRadialGradient(sx(l.x), sy(l.y), 0, sx(l.x), sy(l.y), l.r * z);
          const flick = l.warm ? 0.9 + Math.sin(t * 7 + l.x) * 0.05 : 1;
          g.addColorStop(0, `rgba(0,0,0,${0.95 * flick})`); g.addColorStop(0.55, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g; ctx.fillRect(sx(l.x) - l.r * z, sy(l.y) - l.r * z, l.r * z * 2, l.r * z * 2);
        }
        ctx.globalCompositeOperation = "source-over";
        for (const l of lights) {
          if (!l.warm) continue;
          const g = ctx.createRadialGradient(sx(l.x), sy(l.y), 0, sx(l.x), sy(l.y), l.r * z * 0.8);
          g.addColorStop(0, "rgba(255,170,80,0.22)"); g.addColorStop(1, "rgba(255,170,80,0)");
          ctx.fillStyle = g; ctx.fillRect(sx(l.x) - l.r * z, sy(l.y) - l.r * z, l.r * z * 2, l.r * z * 2);
        }
      }
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,250,${this.flash * 0.55})`; ctx.fillRect(0, 0, w, h); }
      this.tex.refresh();
      this.drawnBlank = blank;
    }
    // Laid over the part of the world in view.
    this.img.setVisible(!blank).setPosition(view.x, view.y).setDisplaySize(view.width, view.height);

    // Drifting cut-outs: weather first, else the first field over the map.
    const kind = weather === "rain" || weather === "storm" || weather === "snow" ? weather : overMap[0] ?? "";
    const n = kind === "rain" || kind === "storm" ? 110 : kind === "snow" ? 90 : 34;
    this.setDrift(kind, n);
    for (const d of this.drifts) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (kind !== "rain" && kind !== "storm") d.x += Math.sin(t * 0.8 + d.i) * 6 * dt;
      // Wrap around the view so they always fill it.
      if (d.y > view.bottom + 10) d.y -= view.height + 20; else if (d.y < view.y - 10) d.y += view.height + 20;
      if (d.x > view.right + 10) d.x -= view.width + 20; else if (d.x < view.x - 10) d.x += view.width + 20;
      d.img.setPosition(d.x, d.y).setRotation(kind === "rain" || kind === "storm" ? 0 : Math.sin(t * d.spin + d.i) * 0.5);
    }

    // Fog: big tissue sheets drifting across.
    const fogOn = weather === "fog";
    if (fogOn && !this.fog.length) {
      for (let i = 0; i < 7; i++) {
        const img = this.scene.add.image(0, 0, "__WHITE").setDepth(9400).setAlpha(0.32).setTint(0xf2f2ee);
        useMade(img, this.paint.tissue(i), this.paint.k);
        img.setData("s", img.scaleX);
        this.fog.push(img);
      }
    } else if (!fogOn && this.fog.length) { this.fog.forEach((f) => f.destroy()); this.fog = []; }
    this.fog.forEach((f, i) => {
      const x = view.x + ((hash(i, 1, 4) * view.width + t * (6 + i)) % (view.width + 200)) - 100;
      f.setPosition(x, view.y + hash(i, 2, 4) * view.height).setScale((f.getData("s") as number) * (2.2 + hash(i, 3, 4)), (f.getData("s") as number) * (0.9 + hash(i, 5, 4) * 0.5));
    });
  }
}
