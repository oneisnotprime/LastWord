/**
 * The minimap a sense gives you (a MAP, a COMPASS, a CHART: shared `senseOf`). There is none by
 * default. It shows the land within the farthest `map_reveal` you have, letter sources within
 * `detect_letters` and living things within `detect_life`, with you in the middle.
 */
import { combineSenses, Tile, tileAt, type LoadoutDetail, type Sensed, type WorldMap } from "@lastword/shared";

const COLOURS: Record<Tile, [number, number, number]> = {
  [Tile.DeepWater]: [61, 103, 120], [Tile.Water]: [109, 158, 170], [Tile.Sand]: [230, 211, 163], [Tile.Grass]: [163, 184, 111],
  [Tile.Forest]: [111, 139, 80], [Tile.Hill]: [185, 176, 119], [Tile.Mountain]: [163, 155, 140], [Tile.Road]: [201, 167, 122],
  [Tile.City]: [221, 208, 182], [Tile.Pit]: [59, 47, 38], [Tile.Snow]: [244, 241, 234], [Tile.Swamp]: [127, 138, 85],
  [Tile.Lava]: [236, 122, 58], [Tile.Wall]: [179, 166, 143],
  [Tile.Jungle]: [79, 138, 62], [Tile.Desert]: [232, 204, 138], [Tile.Tundra]: [211, 216, 200], [Tile.Savanna]: [210, 189, 108],
  [Tile.Badlands]: [196, 138, 92], [Tile.Ash]: [106, 97, 91], [Tile.Meadow]: [185, 201, 111], [Tile.Taiga]: [92, 122, 88],
  [Tile.Marsh]: [140, 156, 102],
};
/** The fog beyond what you can see. */
const FOG: [number, number, number] = [42, 63, 72];

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private sensed: Sensed = { life: [], letters: [] };
  private range = { reveal: 0, letters: 0, life: 0 };
  private drawnAt = 0;
  private land: { key: string; img: HTMLCanvasElement } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly dpr: number) {
    this.ctx = canvas.getContext("2d")!;
  }

  /** What your senses reach, from the loadout. No senses: no minimap. */
  senses(d: LoadoutDetail) {
    this.range = combineSenses(d.senses ?? []);
    const on = (d.senses ?? []).length > 0;
    this.canvas.classList.toggle("show", on);
    if (on) this.canvas.title = `MINIMAP: ${(d.senses ?? []).map((s) => s.word.toUpperCase()).join(", ")}`;
  }

  picked(s: Sensed) {
    this.sensed = s;
  }

  get shown(): boolean {
    return this.canvas.classList.contains("show");
  }

  /** Redraws a few times a second around `me`; `edits` is how many terrain edits the map has had. */
  draw(map: WorldMap, me: { x: number; y: number }, edits: number, now: number) {
    if (!this.shown || now - this.drawnAt < 250) return;
    this.drawnAt = now;
    const css = this.canvas.clientWidth || 190, px = Math.round(css * this.dpr);
    if (this.canvas.width !== px) { this.canvas.width = px; this.canvas.height = px; }
    const { reveal, letters, life } = this.range;
    // The window: wide enough for the farthest reading, at most the map.
    const R = Math.max(8, Math.min(map.size / 2, Math.max(reveal, letters, life)));
    // Centred on you, but kept on the map near its edges.
    const side = Math.min(map.size, Math.ceil(R * 2));
    const cx = Math.max(side / 2, Math.min(map.size - side / 2, Math.round(me.x))), cy = Math.max(side / 2, Math.min(map.size - side / 2, Math.round(me.y)));
    const key = `${cx},${cy},${side},${reveal},${edits}`;
    if (this.land?.key !== key) {
      const img = this.land?.img ?? document.createElement("canvas");
      img.width = side; img.height = side;
      const g = img.getContext("2d")!, data = g.createImageData(side, side);
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          const tx = cx - side / 2 + x + 0.5, ty = cy - side / 2 + y + 0.5;
          const inside = tx >= 0 && ty >= 0 && tx < map.size && ty < map.size && Math.hypot(tx - me.x, ty - me.y) <= reveal;
          const [r, gg, b] = inside ? COLOURS[tileAt(map, tx, ty)] : FOG;
          const i = (y * side + x) * 4;
          data.data[i] = r; data.data[i + 1] = gg; data.data[i + 2] = b; data.data[i + 3] = 255;
        }
      }
      g.putImageData(data, 0, 0);
      this.land = { key, img };
    }
    const c = this.ctx, k = px / side;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.land.img, 0, 0, px, px);
    const at = (x: number, y: number): [number, number] => [(x - (cx - side / 2)) * k, (y - (cy - side / 2)) * k];
    const dot = (x: number, y: number, r: number, fill: string, stroke = "#fbf6ea") => {
      const [sx, sy] = at(x, y);
      c.beginPath(); c.arc(sx, sy, r * this.dpr, 0, Math.PI * 2);
      c.fillStyle = fill; c.fill(); c.lineWidth = 1.2 * this.dpr; c.strokeStyle = stroke; c.stroke();
    };
    // Rings for how far letters and life are sensed.
    for (const [r, colour] of [[letters, "rgba(233,185,73,.7)"], [life, "rgba(201,69,63,.6)"]] as const) {
      if (!(r > 0) || r >= map.size) continue;
      const [sx, sy] = at(me.x, me.y);
      c.beginPath(); c.arc(sx, sy, r * k, 0, Math.PI * 2); c.setLineDash([4 * this.dpr, 3 * this.dpr]);
      c.lineWidth = 1 * this.dpr; c.strokeStyle = colour; c.stroke(); c.setLineDash([]);
    }
    for (const s of this.sensed.letters) {
      const [sx, sy] = at(s.x, s.y);
      c.fillStyle = "#e9b949"; c.strokeStyle = "#4a3510"; c.lineWidth = this.dpr;
      c.fillRect(sx - 3 * this.dpr, sy - 3 * this.dpr, 6 * this.dpr, 6 * this.dpr); c.strokeRect(sx - 3 * this.dpr, sy - 3 * this.dpr, 6 * this.dpr, 6 * this.dpr);
    }
    for (const l of this.sensed.life) dot(l.x, l.y, l.person ? 3.2 : 2.2, l.mine ? "#4f8a3a" : l.person ? "#c9453f" : "#8a6a4a");
    dot(me.x, me.y, 3.6, "#2f5a8e");
  }
}
