/**
 * Walk-in buildings in paper (shared interior.ts): a building with a room (`Thing.room`, its radius
 * in tiles) stands on a cut-out floor plan with its door on the south wall. From outside it is a
 * closed building: the standee as usual, the walls' foot and a shut door. Inside it or beside it,
 * the roof (the standee) goes see-through and the floor shows: paper planks, the walls cut away to
 * their footing, and the door, hanging open and splintered once broken.
 */
import Phaser from "phaser";
import { BESIDE_TILES, doorAt } from "@lastword/shared";
import { mix, num, shade } from "./art/palette.js";
import { PX } from "./paint.js";

/** How see-through a roof is for whoever is inside or beside it. */
export const ROOF_CUT = 0.22;

interface Drawn { g: Phaser.GameObjects.Graphics; key: string }

/** An octagon's corners round (x, y): close to the server's round room, and reads as a floor plan. */
function octagon(x: number, y: number, r: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r);
  });
}

export class RoomView {
  private drawn = new Map<string, Drawn>();

  constructor(private scene: Phaser.Scene) {}

  /**
   * Draws one building's room. `open`: you are inside or beside it (the roof is cut away).
   * Returns the alpha for its standee.
   */
  draw(id: string, t: { x: number; y: number; room: number; door: number }, colour: string, open: boolean): number {
    const r = Number(t.room), broken = Number(t.door) <= 0;
    const key = `${t.x},${t.y},${r},${broken ? "x" : Math.ceil(Number(t.door) / 25)},${open},${colour}`;
    let d = this.drawn.get(id);
    if (!d) { d = { g: this.scene.add.graphics().setDepth(53), key: "" }; this.drawn.set(id, d); }
    if (d.key !== key) { d.key = key; this.paint(d.g, t.x * PX, t.y * PX, r * PX, colour, open, broken, Number(t.door)); }
    return open ? ROOF_CUT : 1;
  }

  /** Whether a point (tiles) is inside or beside a room. */
  static near(p: { x: number; y: number }, t: { x: number; y: number; room: number }): boolean {
    return Math.hypot(p.x - t.x, p.y - t.y) <= Number(t.room) + BESIDE_TILES;
  }

  /** Forgets rooms no longer in view. */
  keep(live: Set<string>) {
    for (const [id, d] of this.drawn) if (!live.has(id)) { d.g.destroy(); this.drawn.delete(id); }
  }

  private paint(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, colour: string, open: boolean, broken: boolean, door: number) {
    g.clear();
    const wall = shade(colour, -0.35), footing = shade(colour, -0.15);
    const corners = octagon(x, y, r);
    // Shadow under the paper floor, offset as every cut-out's is.
    g.fillStyle(0x2a2018, 0.18).fillPoints(octagon(x + 1.5, y + 2, r), true);
    if (open) {
      // The floor: cream paper with planks running east-west.
      g.fillStyle(num(mix("#efe2c4", colour, 0.12)), 1).fillPoints(corners, true);
      g.lineStyle(0.6, num(shade("#c9a97a", -0.1)), 0.55);
      for (let py = y - r + 3; py < y + r - 1; py += 3) {
        const half = Math.sqrt(Math.max(0, r * r - (py - y) ** 2)) * 0.92;
        g.lineBetween(x - half, py, x + half, py);
      }
    } else {
      // From outside: the walls' footing, a closed building.
      g.fillStyle(num(footing), 0.55).fillPoints(corners, true);
    }
    // The walls round the room (cut to their footing when open), with a gap for the door.
    const dw = Math.min(r * 0.9, 0.9 * PX) / 2, d = doorAt(x, y, r);
    g.lineStyle(open ? 2 : 2.6, num(wall), 1);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = corners[i]!, b = corners[(i + 1) % 8]!;
      // The south edge (between the corners either side of straight down) has the doorway.
      if (i === 1) { g.moveTo(a.x, a.y); g.lineTo(Math.min(a.x, d.x + dw), a.y); g.moveTo(Math.max(b.x, d.x - dw), b.y); g.lineTo(b.x, b.y); continue; }
      g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
    }
    g.strokePath();
    // The door: a shut panel with its knob, its strength shown as how dark it is; broken, it hangs
    // askew from one hinge with splinters, and the doorway is open.
    const top = corners[1]!.y, h = Math.max(2.5, PX * 0.22);
    if (broken) {
      g.fillStyle(0x8a5a2a, 1).fillTriangle(d.x - dw, top, d.x - dw + 2.5, top + h * 1.6, d.x - dw - 1, top + h * 1.3);
      g.lineStyle(0.8, 0xc9453f, 1);
      for (const k of [-0.5, 0, 0.5]) g.lineBetween(d.x + k * dw, top - 1.5, d.x + k * dw + 1.2, top + 1.5);
    } else {
      const strength = Math.max(0, Math.min(1, door / 100));
      g.fillStyle(num(mix("#c98a4a", "#6b3f1a", strength)), 1).fillRect(d.x - dw, top - h / 2, dw * 2, h);
      g.lineStyle(0.8, num(shade(wall, -0.2)), 1).strokeRect(d.x - dw, top - h / 2, dw * 2, h);
      g.fillStyle(0xe9c24a, 1).fillCircle(d.x + dw * 0.55, top, 0.8);
      if (strength < 1) { g.lineStyle(0.7, 0xc9453f, 0.9); g.lineBetween(d.x - dw * 0.4, top - h / 2, d.x + dw * 0.1, top + h / 2); }
    }
  }
}
