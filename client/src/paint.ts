/**
 * Paper art as Phaser textures: standees, tags, badges, flames and decals, each drawn once on a
 * canvas and cached by what it shows.
 */
import Phaser from "phaser";
import type { Dictionary } from "@lastword/shared";
import { type Piece, type Silhouette } from "./art/build.js";
import { lookKey, lookOf, shapeOf, type Look } from "./art/look.js";
import { badge, cutout, drawSilhouette, heartPts, inks, paperFlame, tag } from "./art/paper.js";
import { renderStandee, type Standee } from "./art/standee.js";
import { PAPER } from "./art/palette.js";

/** Screen pixels per map tile before camera zoom, and the camera zoom. A unit is half a world pixel. */
export const PX = 16;
export const ZOOM = 2;
export const UNIT = 0.5;

export interface Made { key: string; w: number; h: number; ox: number; oy: number }

export class Painter {
  private standees = new Map<string, Standee & { key: string }>();
  private made = new Map<string, Made>();
  private serial = 0;

  /** `k`: device pixels per unit. */
  constructor(private readonly scene: Phaser.Scene, readonly dict: Dictionary, readonly k: number) {}

  private add(canvas: HTMLCanvasElement): string {
    const key = `paper${this.serial++}`;
    this.scene.textures.addCanvas(key, canvas);
    return key;
  }

  /** The standee for a look, with what a person holds. */
  standee(look: Look, held?: string, ride?: string): Standee & { key: string } {
    const id = lookKey(look, `${held ?? ""}|${ride ?? ""}`);
    let st = this.standees.get(id);
    if (!st) {
      let heldArt: { sil: Silhouette; colour: string } | undefined;
      if (held) {
        const h = lookOf(this.dict, held);
        heldArt = { sil: h.shape, colour: h.colour };
      }
      let rideArt: { sil: Silhouette; colour: string } | undefined;
      if (ride) {
        const r = lookOf(this.dict, ride);
        rideArt = { sil: r.shape, colour: r.colour };
      }
      const s = renderStandee(look, { k: this.k, held: heldArt, ride: rideArt });
      st = { ...s, key: this.add(s.canvas) };
      this.standees.set(id, st);
    }
    return st;
  }

  /** Something drawn once by `draw` into a canvas of w by h units, origin (ox, oy) in units. */
  private once(id: string, w: number, h: number, ox: number, oy: number, draw: (ctx: CanvasRenderingContext2D) => void): Made {
    let m = this.made.get(id);
    if (!m) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(w * this.k); c.height = Math.ceil(h * this.k);
      const ctx = c.getContext("2d")!;
      ctx.scale(this.k, this.k);
      ctx.translate(ox, oy);
      draw(ctx);
      m = { key: this.add(c), w, h, ox, oy };
      this.made.set(id, m);
    }
    return m;
  }

  /** A paper tag with its lines; origin at its centre. */
  tag(lines: string[], ink: string, size = 12): Made {
    const id = `tag|${ink}|${size}|${lines.join("\n")}`;
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.font = `700 ${size}px 'Kalam', cursive`;
    const w = Math.max(...lines.map((l) => probe.measureText(l).width)) + 34;
    const h = size + 18 + (lines.length - 1) * (size * 0.78 + 1);
    return this.once(id, w, h, w / 2 - 2, h / 2 - 2, (ctx) => tag(ctx, lines, 0, 0, 0, ink, size));
  }

  badge(status: string): Made {
    return this.once(`badge|${status}`, 90, 22, 45, 10, (ctx) => badge(ctx, status, 0, 0));
  }

  /** One paper flame, base at the origin, `h` units tall. */
  flame(h = 16, seed = 0): Made {
    return this.once(`flame|${h}|${seed}`, h + 8, h + 8, h / 2 + 4, h + 3, (ctx) => paperFlame(ctx, 0, 0, h, 0, seed));
  }

  heart(size = 7, colour = "#e0708f"): Made {
    return this.once(`heart|${size}|${colour}`, size * 2.6 + 6, size * 2.6 + 6, size * 1.3 + 2, size * 1.3 + 2, (ctx) => cutout(ctx, heartPts(0, 0, size), colour, 2, 1));
  }

  /** Icon pieces as one glued-on cut-out decal, centred. */
  decal(id: string, pieces: Piece[], scale = 1, colour = "#c9b99a"): Made {
    const sil: Silhouette = { pieces: pieces.map((p) => ({ ...p, detail: false, glued: false })) };
    const r = 14 * scale;
    return this.once(`decal|${id}|${scale}`, r * 2 + 8, r * 2 + 8, r + 3, r + 3, (ctx) => drawSilhouette(ctx, sil, { x: 0, y: 0, s: scale, flip: false }, inks(colour), { depth: 2 }));
  }

  /** A word's own silhouette as a flat decal, for areas and fields. */
  wordDecal(word: string, scale = 0.8): Made {
    const sil = shapeOf(this.dict, word);
    return this.once(`word|${word}|${scale}`, 90 * scale, 90 * scale, 45 * scale, 70 * scale, (ctx) => drawSilhouette(ctx, sil, { x: 0, y: 0, s: scale, flip: false }, inks(sil.colour ?? "#c9b99a"), { depth: 2 }));
  }

  /** A dashed paper ring for whoever is picked or attacked. White; tint it. */
  ring(w: number): Made {
    const rw = Math.round(w / 4) * 4;
    return this.once(`ring|${rw}`, rw * 2 + 10, rw * 0.8 + 10, rw + 5, rw * 0.4 + 5, (ctx) => {
      ctx.setLineDash([5, 3.5]);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = "rgba(60,45,30,0.45)";
      ctx.beginPath(); ctx.ellipse(0.8, 1.4, rw, rw * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(0, 0, rw, rw * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
    });
  }

  /** A soft white dot of paper: snow, spores, sparks. */
  speck(colour: string, r = 2.2): Made {
    return this.once(`speck|${colour}|${r}`, r * 2 + 6, r * 2 + 6, r + 2, r + 2, (ctx) => {
      ctx.fillStyle = "rgba(40,30,20,0.25)"; ctx.beginPath(); ctx.arc(0.8, 1.2, r, 0, 7); ctx.fill();
      ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    });
  }

  /** A strip of paper falling at an angle: rain. */
  streak(): Made {
    return this.once("streak", 8, 20, 4, 10, (ctx) => {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(40,50,70,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1.6, -6); ctx.lineTo(-1.4, 8); ctx.stroke();
      ctx.strokeStyle = "rgba(225,238,245,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(-2, 7); ctx.stroke();
    });
  }

  /** A torn tissue-paper disc, white, 256 units across; tint and scale it. */
  tissue(seed: number): Made {
    return this.once(`tissue|${seed}`, 268, 268, 134, 134, (ctx) => {
      const n = 64, edge = new Path2D();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 124 * (0.95 + 0.05 * Math.sin(a * 5 + seed) + 0.025 * Math.sin(a * 13 + seed * 2));
        if (i) edge.lineTo(Math.cos(a) * r, Math.sin(a) * r); else edge.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      edge.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(50,35,20,0.35)"; ctx.shadowBlur = 6 * this.k; ctx.shadowOffsetY = 2 * this.k;
      ctx.fill(edge);
      ctx.shadowColor = "transparent";
      // Where the tissue folds over itself it is darker.
      ctx.save();
      ctx.clip(edge);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      for (let i = 0; i < 3; i++) {
        const a = seed + i * 2.1;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 70, Math.sin(a) * 60, 70, 30, a, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.stroke(edge);
    });
  }

  /** A paper banner strip, for the map-wide fields. */
  paperColour = PAPER;
}

/** Puts a made texture on an image at the right scale and origin. */
export function useMade(img: Phaser.GameObjects.Image, m: Made, k: number) {
  img.setTexture(m.key).setOrigin(m.ox / m.w, m.oy / m.h).setScale(UNIT / k * (m.w * k / Math.ceil(m.w * k)));
}

/** The same for a standee. */
export function useStandee(img: Phaser.GameObjects.Image, st: Standee & { key: string }) {
  img.setTexture(st.key).setOrigin(st.ox / st.canvas.width, st.oy / st.canvas.height).setScale(UNIT / st.k);
}
