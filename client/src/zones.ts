/**
 * Areas and fields in paper: a torn disc of tinted tissue with cut-outs standing in it (flames
 * in a FIRE, hearts circling LOVE, crossed swords in a WAR, bubbles in a DISEASE, clouds under
 * HEAVEN). Fields over the whole map are left to the sky.
 */
import Phaser from "phaser";
import type { Dictionary } from "@lastword/shared";
import { icon } from "./art/build.js";
import { mix, num } from "./art/palette.js";
import { hash } from "./art/util.js";
import { PX, useMade, type Made, type Painter } from "./paint.js";

type Decor = "flame" | "heart" | "swords" | "bubble" | "cloud" | "crack" | "wheat" | "star" | "skull" | "word";

export interface ZoneStyle { colour: string; ink: string; decor: Decor; warm?: boolean }

const BY_WORD: Record<string, ZoneStyle> = {
  fire: { colour: "#ec783c", ink: "#b8442a", decor: "flame", warm: true },
  inferno: { colour: "#e0502a", ink: "#a8321a", decor: "flame", warm: true },
  love: { colour: "#f08caa", ink: "#b04a6a", decor: "heart" },
  war: { colour: "#c9453f", ink: "#8a2a2a", decor: "swords" },
  battle: { colour: "#c9453f", ink: "#8a2a2a", decor: "swords" },
  disease: { colour: "#8ac46a", ink: "#3f6a2a", decor: "bubble" },
  plague: { colour: "#7aa85a", ink: "#3a5a2a", decor: "skull" },
  heaven: { colour: "#f4d35e", ink: "#9a7a1a", decor: "cloud", warm: true },
  hell: { colour: "#a8323a", ink: "#6a1a1a", decor: "flame", warm: true },
  earthquake: { colour: "#a8865a", ink: "#6b4a2e", decor: "crack" },
  famine: { colour: "#d9b45a", ink: "#8a6a1a", decor: "wheat" },
  fear: { colour: "#6a4a8a", ink: "#4a2a6a", decor: "word" },
  hope: { colour: "#9cc6d2", ink: "#2f5a7a", decor: "star" },
  luck: { colour: "#7fbf6a", ink: "#2f6a3a", decor: "star" },
};

const BY_ARCHETYPE: Record<string, ZoneStyle> = {
  conflict: BY_WORD.war!, attack: BY_WORD.war!, affliction: BY_WORD.disease!, disaster: BY_WORD.earthquake!, feeling: { colour: "#e0a0c0", ink: "#8a3a6a", decor: "heart" },
  attribute: { colour: "#e9c24a", ink: "#8a6a1a", decor: "star" }, killing: { colour: "#6a4a4a", ink: "#3a2a2a", decor: "skull" },
  celestial: { colour: "#9cb6e0", ink: "#2f4a8a", decor: "star" }, phenomenon: { colour: "#a88ad9", ink: "#4a2a8a", decor: "word" },
};

export function zoneStyle(dict: Dictionary, word: string): ZoneStyle {
  const def = dict.word(word);
  return BY_WORD[word] ?? (def && BY_ARCHETYPE[def.archetype]) ?? { colour: "#a88ad9", ink: "#4a3a7a", decor: "word" };
}

interface ZoneView {
  disc: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Image;
  decor: { img: Phaser.GameObjects.Image; a: number; d: number; base: number; i: number }[];
  word: string; style: ZoneStyle; x: number; y: number; r: number; laidFor: number;
}

export class Zones {
  private views = new Map<string, ZoneView>();
  private k: number;

  constructor(private readonly scene: Phaser.Scene, private readonly paint: Painter, private readonly dict: Dictionary) {
    this.k = paint.k;
  }

  private decorMade(style: ZoneStyle, word: string, i: number): Made {
    switch (style.decor) {
      case "flame": return this.paint.flame(18 + (i % 3) * 6, i % 3);
      case "heart": return this.paint.heart(6 + (i % 2) * 2, i % 2 ? "#e0708f" : "#f2a0b4");
      case "swords": return i % 3 === 2 ? this.paint.decal("smoke", icon.cloud("#8a8580"), 1) : this.paint.decal("swords", icon.swords(), 1.1);
      case "bubble": return i % 4 === 3 ? this.paint.decal("skull", icon.skull(), 0.9) : this.paint.decal("bubble", icon.bubble(), 0.9);
      case "skull": return i % 2 ? this.paint.decal("skull", icon.skull(), 0.9) : this.paint.decal("bubble2", icon.bubble("#9ab86a"), 0.9);
      case "cloud": return i % 3 === 2 ? this.paint.decal("star", icon.star("#f4d35e"), 0.8) : this.paint.decal("cloud", icon.cloud("#fbf7ec"), 1.4);
      case "crack": return this.paint.decal("crack", [{ pts: [[-10, -2], [-3, -4], [0, 2], [6, -1], [11, 3], [6, 1], [0, 5], [-4, 0]], ink: "#3d2a1e" }], 1.2);
      case "wheat": return this.paint.decal("wheat", icon.wheat(), 1);
      case "star": return this.paint.decal(`star${style.colour}`, icon.star(style.colour), 0.8);
      default: return this.paint.wordDecal(word, 0.6);
    }
  }

  /** Lays the cut-outs out for the zone's current size. */
  private lay(z: ZoneView) {
    z.decor.forEach((d) => d.img.destroy());
    z.decor = [];
    const rt = z.r / PX;
    const orbit = z.style.decor === "heart";
    const n = orbit ? Math.max(6, Math.min(26, Math.round(rt * 3.2))) : Math.max(4, Math.min(34, Math.round(rt * rt * 1.1)));
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(0, 0, "__WHITE");
      useMade(img, this.decorMade(z.style, z.word, i), this.k);
      const a = orbit ? (i / n) * Math.PI * 2 : (i * 2.399963) % (Math.PI * 2);
      const d = orbit ? 1 : Math.sqrt((i + 0.5) / n) * 0.82;
      z.decor.push({ img, a, d, base: img.scaleX, i });
    }
    z.laidFor = z.r;
  }

  /** Draws the zones in `zones`; returns the words over the whole map. */
  update(zones: any, time: number): string[] {
    const t = time / 1000;
    const live = new Set<string>(), overMap: string[] = [];
    zones.forEach((zone: any, id: string) => {
      if (zone.radius === 0) { overMap.push(zone.word); return; }
      live.add(id);
      let z = this.views.get(id);
      if (!z) {
        const style = zoneStyle(this.dict, zone.word);
        const seed = Math.floor(hash(id.length, zone.word.charCodeAt(0), 3) * 100);
        const disc = this.scene.add.image(0, 0, "__WHITE").setDepth(50).setAlpha(0.4).setTint(num(style.colour)).setBlendMode(Phaser.BlendModes.SCREEN);
        useMade(disc, this.paint.tissue(seed % 7), this.k);
        disc.setData("s", disc.scaleX);
        const tag = this.scene.add.image(0, 0, "__WHITE").setDepth(10000);
        useMade(tag, this.paint.tag([zone.word.toUpperCase()], style.ink, 13), this.k);
        z = { disc, tag, decor: [], word: zone.word, style, x: 0, y: 0, r: 0, laidFor: 0 };
        this.views.set(id, z);
      }
      z.x = zone.x * PX; z.y = zone.y * PX; z.r = zone.radius * PX;
      if (Math.abs(z.r - z.laidFor) > z.laidFor * 0.12 + 1) this.lay(z);
      // The tissue's radius is 124 units, 62 world pixels, at its base scale.
      const s = (z.disc.getData("s") as number) * (z.r / 62);
      z.disc.setPosition(z.x, z.y).setScale(s * (1 + Math.sin(t * 1.3) * 0.01), s * 0.9 * (1 + Math.cos(t * 1.1) * 0.01));
      z.tag.setPosition(z.x, z.y - z.r * 0.85 - 8);
      for (const d of z.decor) {
        let x = z.x + Math.cos(d.a) * d.d * z.r, y = z.y + Math.sin(d.a) * d.d * z.r * 0.85;
        switch (z.style.decor) {
          case "flame": {
            const f = 1 + Math.sin(t * 9 + d.i * 1.9) * 0.14;
            d.img.setScale(d.base * (0.94 + Math.sin(t * 5 + d.i) * 0.06), d.base * f).setRotation(Math.sin(t * 3 + d.i) * 0.08);
            y += 8;
            break;
          }
          case "heart": {
            const a = d.a + t * 0.25;
            x = z.x + Math.cos(a) * z.r * 0.95; y = z.y + Math.sin(a) * z.r * 0.85;
            d.img.setRotation(Math.sin(t * 2 + d.i) * 0.2).setScale(d.base * (1 + Math.sin(t * 4 + d.i) * 0.08));
            break;
          }
          case "cloud": x += Math.sin(t * 0.4 + d.i) * 4; y += Math.cos(t * 0.6 + d.i) * 2; break;
          case "bubble": case "skull": y -= ((t * 6 + d.i * 7) % 12) - 6; break;
          case "swords": case "star": d.img.setRotation(Math.sin(t * 1.5 + d.i) * 0.15); break;
        }
        d.img.setPosition(x, y).setDepth(100 + y);
      }
    });
    for (const [id, z] of this.views) {
      if (live.has(id)) continue;
      z.disc.destroy(); z.tag.destroy(); z.decor.forEach((d) => d.img.destroy());
      this.views.delete(id);
    }
    return overMap;
  }

  /** Light the zones give off at night. */
  lights(): { x: number; y: number; r: number; warm: boolean }[] {
    return [...this.views.values()].filter((z) => z.style.warm || z.style.decor === "heart").map((z) => ({ x: z.x, y: z.y, r: z.r * (z.style.warm ? 1.7 : 1.1), warm: !!z.style.warm }));
  }
}
