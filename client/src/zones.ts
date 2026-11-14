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
  drought: { colour: "#e0b060", ink: "#8a5a1a", decor: "crack" },
  dearth: { colour: "#d9b45a", ink: "#8a6a1a", decor: "wheat" },
  harvest: { colour: "#e9c24a", ink: "#7a5a12", decor: "wheat" },
  plenty: { colour: "#b8d86a", ink: "#4a6a1a", decor: "wheat" },
  blight: { colour: "#7a6a4a", ink: "#3a2a1a", decor: "skull" },
  festival: { colour: "#f0a0d0", ink: "#8a2a6a", decor: "star" },
  carnival: { colour: "#f0a0d0", ink: "#8a2a6a", decor: "star" },
  truce: { colour: "#dff0f4", ink: "#2f5a7a", decor: "word" },
  sanctuary: { colour: "#dff0f4", ink: "#2f5a7a", decor: "cloud" },
  curfew: { colour: "#5a6a8a", ink: "#2a3a5a", decor: "word" },
  tax: { colour: "#c8b070", ink: "#6a5a1a", decor: "word" },
  tithe: { colour: "#c8b070", ink: "#6a5a1a", decor: "word" },
  bonanza: { colour: "#f4d35e", ink: "#8a6a10", decor: "star" },
  meteor: { colour: "#e0702a", ink: "#7a2a10", decor: "flame", warm: true },
  asteroid: { colour: "#e0702a", ink: "#7a2a10", decor: "flame", warm: true },
  eruption: { colour: "#e0502a", ink: "#a8321a", decor: "flame", warm: true },
  riot: { colour: "#c9453f", ink: "#8a2a2a", decor: "crack" },
  siege: { colour: "#9a5a4a", ink: "#5a2a1a", decor: "swords" },
};

const BY_ARCHETYPE: Record<string, ZoneStyle> = {
  conflict: BY_WORD.war!, attack: BY_WORD.war!, affliction: BY_WORD.disease!, disaster: BY_WORD.earthquake!, feeling: { colour: "#e0a0c0", ink: "#8a3a6a", decor: "heart" },
  attribute: { colour: "#e9c24a", ink: "#8a6a1a", decor: "star" }, killing: { colour: "#6a4a4a", ink: "#3a2a2a", decor: "skull" },
  celestial: { colour: "#9cb6e0", ink: "#2f4a8a", decor: "star" }, ceremony: { colour: "#f0a0d0", ink: "#8a2a6a", decor: "star" },
  possession: { colour: "#c8b070", ink: "#6a5a1a", decor: "word" }, act: { colour: "#d8a070", ink: "#7a4a1a", decor: "word" }, phenomenon: { colour: "#a88ad9", ink: "#4a2a8a", decor: "word" },
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
  /** What its card says: who made it, until when, and for claimed ground whose it is and how much it shelters. */
  info: { by: string; until: number; owner: string; shelter: number; mine: boolean };
  /** Claimed ground (HOME, CASTLE): a fence of stakes around its edge, redrawn as it changes size. */
  fence?: Phaser.GameObjects.Graphics; fencedFor?: number;
}

/** Claimed ground: green for yours, red for someone else's. */
const CLAIM_MINE: ZoneStyle = { colour: "#8ccf7a", ink: "#2f6a3a", decor: "word" };
const CLAIM_THEIRS: ZoneStyle = { colour: "#e08a7a", ink: "#8a2a2a", decor: "word" };

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

  /**
   * Draws the zones in `zones`; returns the words over the whole map. `focus` (world pixels, you)
   * puts each name tag on the edge nearest you, so a big circle's tag is on screen; `nameOf`
   * names an owner for claimed ground's tag.
   */
  update(zones: any, time: number, mine = "", focus?: { x: number; y: number }, nameOf: (id: string) => string = () => ""): string[] {
    const t = time / 1000;
    const live = new Set<string>(), overMap: string[] = [];
    zones.forEach((zone: any, id: string) => {
      if (zone.radius === 0) { overMap.push(zone.word); return; }
      live.add(id);
      let z = this.views.get(id);
      if (!z) {
        const claim = zone.shelter > 0;
        const style = claim ? (zone.owner === mine ? CLAIM_MINE : CLAIM_THEIRS) : zoneStyle(this.dict, zone.word);
        const seed = Math.floor(hash(id.length, zone.word.charCodeAt(0), 3) * 100);
        const disc = this.scene.add.image(0, 0, "__WHITE").setDepth(50).setAlpha(0.32).setTint(num(mix(style.colour, "#ffffff", 0.15)));
        useMade(disc, this.paint.tissue(seed % 7), this.k);
        disc.setData("s", disc.scaleX);
        const tag = this.scene.add.image(0, 0, "__WHITE").setDepth(10000);
        // Owner and kind on the tag: "BOT3's HOME · claimed ground", "FIRE · by BOT2".
        const owner = zone.owner === mine ? "YOUR" : `${(nameOf(zone.owner) || zone.by || "SOMEONE").toUpperCase()}'S`;
        const title = claim ? `${owner} ${zone.word.toUpperCase()} · claimed −${zone.shelter}%`
          : `${zone.word.toUpperCase()}${zone.by ? ` · by ${String(zone.by).toUpperCase()}` : ""}`;
        useMade(tag, this.paint.tag([title], style.ink, 13), this.k);
        z = { disc, tag, decor: [], word: zone.word, style, x: 0, y: 0, r: 0, laidFor: 0,
          info: { by: String(zone.by ?? ""), until: Number(zone.until ?? 0), owner: String(zone.owner ?? ""), shelter: Number(zone.shelter ?? 0), mine: zone.owner === mine } };
        if (claim) { z.fence = this.scene.add.graphics().setDepth(51).setScale(1, 0.9); disc.setAlpha(0.2); }
        this.views.set(id, z);
      }
      z.x = zone.x * PX; z.y = zone.y * PX; z.r = zone.radius * PX;
      if (z.fence) {
        // Stakes and a dashed rope around claimed ground, instead of cut-outs inside it.
        if (z.fencedFor !== z.r) this.fenceOut(z);
        z.fence.setPosition(z.x, z.y);
      } else if (Math.abs(z.r - z.laidFor) > z.laidFor * 0.12 + 1) this.lay(z);
      // The tissue's radius is 124 units, 62 world pixels, at its base scale.
      const s = (z.disc.getData("s") as number) * (z.r / 62);
      z.disc.setPosition(z.x, z.y).setScale(s * (1 + Math.sin(t * 1.3) * 0.01), s * 0.9 * (1 + Math.cos(t * 1.1) * 0.01));
      // The tag sits on the edge nearest you, or, standing well inside a big one, a few tiles
      // from you toward that edge, so it is on screen; the top when you are at its middle.
      const fx = focus ? focus.x - z.x : 0, fy = focus ? focus.y - z.y : -1, fd = Math.hypot(fx, fy);
      const ux = fd > z.r * 0.25 ? fx / fd : 0, uy = fd > z.r * 0.25 ? fy / fd : -1;
      const along = fd < z.r ? Math.min(z.r * 0.92, fd + 6 * PX) : z.r * 0.92;
      z.tag.setPosition(z.x + ux * along, z.y + uy * along * 0.9 - 8);
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
      z.disc.destroy(); z.tag.destroy(); z.decor.forEach((d) => d.img.destroy()); z.fence?.destroy();
      this.views.delete(id);
    }
    return overMap;
  }

  private fenceOut(z: ZoneView) {
    const g = z.fence!, ink = num(z.style.ink), r = z.r;
    g.clear();
    const n = Math.max(12, Math.round(r / 7));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.55) / n) * Math.PI * 2;
      g.lineStyle(2, ink, 0.75).beginPath();
      g.arc(0, 0, r, a0, a1).strokePath();
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      g.fillStyle(0x6b4a2e, 1).fillRect(x - 1.2, y - 6, 2.4, 7);
      g.fillStyle(ink, 1).fillCircle(x, y - 6, 1.8);
    }
    z.fencedFor = r;
  }

  /** The zone whose name tag is at a world point, as an event card wants it, or null. With `inside`, the smallest zone covering the point. */
  tagAt(x: number, y: number, inside = false): { word: string; until: number; by: string; kind: "zone"; extra: string[] } | null {
    const hits = [...this.views.values()].filter((z) => inside ? Math.hypot(x - z.x, (y - z.y) / 0.9) <= z.r : z.tag.getBounds().contains(x, y));
    for (const z of hits.sort((a, b) => a.r - b.r)) {
      const extra = z.info.shelter > 0 ? [
        `claimed ground: ${z.info.mine ? "yours" : "someone else's"}`,
        `${z.info.mine ? "your" : "their"} things inside take ${z.info.shelter}% less damage and are harder to steal`,
        z.info.mine ? "you are sheltered inside" : "their side is sheltered inside",
      ] : [];
      return { word: z.word, until: z.info.until, by: z.info.by, kind: "zone", extra };
    }
    return null;
  }

  /** The zones' name tags, to keep clear of other tags. */
  tags(): Phaser.GameObjects.Image[] {
    return [...this.views.values()].map((z) => z.tag);
  }

  /** Light the zones give off at night. */
  lights(): { x: number; y: number; r: number; warm: boolean }[] {
    return [...this.views.values()].filter((z) => z.style.warm || z.style.decor === "heart").map((z) => ({ x: z.x, y: z.y, r: z.r * (z.style.warm ? 1.7 : 1.1), warm: !!z.style.warm }));
  }
}
