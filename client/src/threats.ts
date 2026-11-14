/**
 * Incoming threats: anything coming for you that you cannot see on screen (a PLANE, a rider, a
 * long reach) gets an arrow at the screen's edge pointing at it, with what it is, a plane or a
 * sword for air or ground, and how far. The server sends them (`threats`) twice a second.
 */
export interface Threat { id: string; x: number; y: number; name: string; air: boolean; targeting: boolean; reach: number }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export class Threats {
  private list: Threat[] = [];
  private readonly layer: HTMLElement;
  private readonly arrows = new Map<string, { label: HTMLElement; tip: HTMLElement }>();

  constructor() {
    this.layer = document.createElement("div");
    this.layer.id = "threats";
    document.body.append(this.layer);
  }

  set(list: Threat[]) {
    this.list = list;
  }

  get all(): readonly Threat[] {
    return this.list;
  }

  /**
   * Each frame: an arrow on the screen's edge toward each threat off screen (or one that is
   * shown but not drawn yet). `toScreen` turns map tiles into CSS pixels; `me` is where you are.
   */
  frame(toScreen: (x: number, y: number) => { x: number; y: number }, me: { x: number; y: number } | null, metresPerTile: number) {
    const keep = new Set<string>();
    // The edge they are pinned to: clear of the HUD card (top left) and the letter bar (bottom).
    const W = innerWidth, H = innerHeight, top = 18, bottom = 96, side = 18;
    for (const t of me ? this.list : []) {
      const p = toScreen(t.x, t.y);
      const on = p.x > side && p.y > top && p.x < W - side && p.y < H - bottom;
      if (on) continue;
      keep.add(t.id);
      let a = this.arrows.get(t.id);
      if (!a) {
        a = { label: document.createElement("div"), tip: document.createElement("i") };
        a.label.className = "threat";
        a.tip.className = "tip";
        this.layer.append(a.label, a.tip);
        this.arrows.set(t.id, a);
      }
      // Where the line from the middle of the screen to it leaves the screen.
      const cx = W / 2, cy = (H - bottom + top) / 2, dx = p.x - cx, dy = p.y - cy;
      const k = Math.min((W / 2 - side) / Math.max(1e-6, Math.abs(dx)), ((H - bottom - top) / 2) / Math.max(1e-6, Math.abs(dy)));
      const ex = cx + dx * k, ey = cy + dy * k, angle = Math.atan2(dy, dx);
      const metres = Math.round(Math.hypot(t.x - me!.x, t.y - me!.y) * metresPerTile);
      const html = `<b>${t.air ? "✈" : "⚔"}</b><span>${esc(t.name.toUpperCase())}<small>${metres} m${t.targeting ? " · on you" : ""}</small></span>`;
      if (a.label.dataset.html !== html) { a.label.dataset.html = html; a.label.innerHTML = html; }
      a.label.className = `threat${t.targeting ? " aimed" : ""}${t.air ? " air" : ""}`;
      a.tip.className = `tip${t.air ? " air" : ""}`;
      // The arrow on the edge pointing out at it; the label just inside, kept wholly on screen.
      a.tip.style.left = `${ex}px`; a.tip.style.top = `${ey}px`; a.tip.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      const w = a.label.offsetWidth || 120, h = a.label.offsetHeight || 30;
      const lx = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, ex - Math.cos(angle) * (w / 2 + 14)));
      const ly = Math.max(top + h / 2, Math.min(H - bottom - h / 2, ey - Math.sin(angle) * (h / 2 + 14)));
      a.label.style.left = `${lx}px`; a.label.style.top = `${ly}px`;
    }
    for (const [id, a] of this.arrows) if (!keep.has(id)) { a.label.remove(); a.tip.remove(); this.arrows.delete(id); }
  }
}
