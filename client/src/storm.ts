/**
 * The storm wall on the map (shared round.ts): the ground outside it under a violet storm, its
 * edge as a bright wall, and the circle it closes to next drawn dashed in white. Redrawn only when
 * the wall moves.
 */
import Phaser from "phaser";

/** The wall as the state carries it (server `WorldState.storm*`), in tiles. */
export interface StormState { x: number; y: number; r: number; nx: number; ny: number; nr: number; mode: string; left: number; dps: number; held: string }

/** The wall from the room state, or null with no storm. */
export function stormOf(state: any): StormState | null {
  if (!state || !state.stormMode) return null;
  return {
    x: state.stormX, y: state.stormY, r: state.stormR, nx: state.stormNextX, ny: state.stormNextY, nr: state.stormNextR,
    mode: String(state.stormMode), left: Number(state.stormLeft ?? 0), dps: Number(state.stormDps ?? 0), held: String(state.stormHeld ?? ""),
  };
}

/** Tiles a point lies outside the wall (negative inside). */
export const outside = (s: StormState, x: number, y: number) => Math.hypot(x - s.x, y - s.y) - s.r;

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The chip's text: what the wall does next and when, and your place to it. */
export function stormChip(s: StormState, me: { x: number; y: number } | null): { text: string; warn: boolean; out: string } {
  const t = clock(s.left);
  const text = s.mode === "closed" ? "STORM closed" : s.mode === "held" ? `STORM held · ${t}` : s.mode === "closing" ? `STORM closing · ${t}` : s.mode === "calm" ? `STORM in ${t}` : `STORM closes in ${t}`;
  if (!me) return { text, warn: false, out: "" };
  const now = outside(s, me.x, me.y), next = Math.hypot(me.x - s.nx, me.y - s.ny) - s.nr;
  if (now > 0) {
    const a = Math.atan2(s.y - me.y, s.x - me.x), arrows = "→↘↓↙←↖↑↗";
    return { text, warn: true, out: `OUTSIDE ${arrows[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]} ${Math.round(now * 4)} m · −${s.dps}%/s` };
  }
  if (next > 0 && s.mode !== "calm") return { text, warn: false, out: `safe circle ${Math.round(next * 4)} m` };
  return { text, warn: false, out: "" };
}

export class StormView {
  private readonly g: Phaser.GameObjects.Graphics;
  private key = "";

  constructor(scene: Phaser.Scene, private readonly px: number, private readonly size: () => number) {
    this.g = scene.add.graphics().setDepth(10500);
  }

  update(s: StormState | null, time: number) {
    if (!s) { if (this.key) { this.g.clear(); this.key = ""; } return; }
    const pulse = Math.round(time / 120) % 8;
    const key = `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.r.toFixed(2)},${s.nx.toFixed(1)},${s.ny.toFixed(1)},${s.nr.toFixed(1)},${s.mode},${pulse}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.g, px = this.px, far = this.size() * 2 * px;
    g.clear();
    const cx = s.x * px, cy = s.y * px, r = Math.max(0, s.r * px);
    // Outside: one stroke as wide as the map past the wall's edge.
    g.lineStyle(far, 0x5b3f8c, 0.3);
    g.strokeCircle(cx, cy, r + far / 2);
    // The wall itself, brighter while it closes.
    const closing = s.mode === "closing";
    g.lineStyle(closing ? 7 : 5, 0xb48cf0, closing ? 0.65 + (pulse % 2) * 0.25 : 0.75);
    if (r > 0) g.strokeCircle(cx, cy, r);
    g.lineStyle(2, 0xf4ecff, 0.8);
    if (r > 0) g.strokeCircle(cx, cy, r - 3);
    // The circle it closes to: dashed white.
    if (s.mode !== "closed" && s.nr > 0 && (Math.abs(s.nr - s.r) > 0.2 || Math.hypot(s.nx - s.x, s.ny - s.y) > 0.2)) {
      const nx = s.nx * px, ny = s.ny * px, nr = s.nr * px, steps = Math.max(24, Math.round(nr / 6));
      g.lineStyle(2.5, 0xffffff, 0.85);
      for (let i = 0; i < steps; i += 2) {
        const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
        g.beginPath(); g.arc(nx, ny, nr, a0, a1); g.strokePath();
      }
    }
  }
}
