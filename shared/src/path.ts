import { Tile, walkable, WALK_COST, type Costs, type Point, type WorldMap } from "./world.js";

/** Most tiles a search may open before it gives up; keeps one search to a millisecond or so. */
const MAX_OPEN = 6_000;

/** Search buffers, reused between searches on maps of the same size. */
let buffers: { size: number; cost: Float64Array; score: Float64Array; came: Int32Array; stamp: Uint32Array; gen: number; half: Float64Array } | null = null;
/** The eight neighbours, in the order searches try them: the four sides, then the corners. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const DY = [0, 0, 1, -1, 1, -1, 1, -1] as const;

/** Binary heap of tile indices ordered by score. */
class Heap {
  private items: number[] = [];
  constructor(private readonly score: Float64Array) {}
  get size() { return this.items.length; }
  push(i: number) {
    const a = this.items, s = this.score;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (s[a[p]!]! <= s[i]!) break;
      a[k] = a[p]!; k = p;
    }
    a[k] = i;
  }
  pop(): number {
    const a = this.items, s = this.score, top = a[0]!, last = a.pop()!;
    const len = a.length;
    if (len) {
      // Sift `last` down from the root (no closure per step: this runs thousands of times a search).
      const ls = s[last]!;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k, ms = ls;
        if (l < len && s[a[l]!]! < ms) { m = l; ms = s[a[l]!]!; }
        if (r < len && s[a[r]!]! < ms) m = r;
        if (m === k) break;
        a[k] = a[m]!; k = m;
      }
      a[k] = last;
    }
    return top;
  }
}

/**
 * True if a straight walk from a to b crosses only walkable tiles: every tile the line touches
 * (sampling it, as before, could skip a corner the walker then ran into). A line through a
 * corner exactly needs both tiles beside it open, as routes do.
 */
export function clearLine(map: WorldMap, a: Point, b: Point, costs: Costs = WALK_COST): boolean {
  const n = map.size, tiles = map.tiles, off = costs[Tile.DeepWater];
  // A tile is open if crossing it costs less than Infinity (off the map it is deep water, as tileAt says).
  const open = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? off : costs[tiles[y * n + x] as Tile]) !== Infinity;
  const dx = b.x - a.x, dy = b.y - a.y;
  let x = Math.floor(a.x), y = Math.floor(a.y);
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx > 0 ? (x + 1 - a.x) * tdx : dx < 0 ? (a.x - x) * tdx : Infinity;
  let ty = dy > 0 ? (y + 1 - a.y) * tdy : dy < 0 ? (a.y - y) * tdy : Infinity;
  while (Math.min(tx, ty) < 1) {
    if (Math.abs(tx - ty) < 1e-9) {
      if (!open(x + sx, y) || !open(x, y + sy)) return false;
      x += sx; y += sy; tx += tdx; ty += tdy;
    } else if (tx < ty) { x += sx; tx += tdx; }
    else { y += sy; ty += tdy; }
    if (!open(x, y)) return false;
  }
  return true;
}

/**
 * A walking route from `from` to `to` that goes around water, mountains and walls and prefers
 * cheap ground (roads). Returns waypoints at tile centres, ending at `to` (or at the reachable
 * tile nearest it), with straight stretches merged. Empty if `from` is already there.
 */
export function findPath(map: WorldMap, from: Point, to: Point, costs: Costs = WALK_COST): Point[] {
  if (clearLine(map, from, to, costs)) return [to];
  const n = map.size, idx = (x: number, y: number) => y * n + x;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  let tx = Math.floor(to.x), ty = Math.floor(to.y);
  const start = idx(sx, sy);
  if (!buffers || buffers.size !== n) {
    const half = new Float64Array(n * n);
    for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) half[dx * n + dy] = Math.hypot(dx, dy) * 0.5;
    buffers = { size: n, cost: new Float64Array(n * n), score: new Float64Array(n * n), came: new Int32Array(n * n), stamp: new Uint32Array(n * n), gen: 0, half };
  }
  // A tile's entries count only if stamped in this search, so nothing has to be cleared.
  const b = buffers, gen = ++b.gen, { cost, score, came, stamp } = b;
  const tiles = map.tiles;
  // What a tile costs to cross, read straight from the map (Infinity off its edge, as tileAt says).
  const off = costs[Tile.DeepWater];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? off : costs[tiles[y * n + x] as Tile]);
  const seen = (i: number) => stamp[i] === gen;
  stamp[start] = gen; cost[start] = Infinity; score[start] = Infinity; came[start] = -1;
  // Straight-line distance at road cost (0.5 a tile), from a table of Math.hypot by the two offsets.
  const half = b.half;
  const h = (x: number, y: number) => { const ax = Math.abs(x - tx), ay = Math.abs(y - ty); return ax < n && ay < n ? half[ax * n + ay]! : Math.hypot(ax, ay) * 0.5; };
  cost[start] = 0;
  score[start] = h(sx, sy);
  const open = new Heap(score);
  open.push(start);
  let best = start, bestH = h(sx, sy), opened = 0;
  while (open.size && opened++ < MAX_OPEN) {
    const cur = open.pop();
    const cx = cur % n, cy = (cur - cx) / n;
    if (cx === tx && cy === ty) { best = cur; break; }
    const ch = h(cx, cy);
    if (ch < bestH) { best = cur; bestH = ch; }
    const base = cost[cur]!;
    for (let d = 0; d < 8; d++) {
      const dx = DX[d]!, dy = DY[d]!;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const step = costs[tiles[y * n + x] as Tile];
      if (step === Infinity) continue;
      // No cutting corners past a blocked tile.
      if (dx && dy && (at(cx + dx, cy) === Infinity || at(cx, cy + dy) === Infinity)) continue;
      const next = y * n + x, c = base + step * (dx && dy ? Math.SQRT2 : 1);
      if (stamp[next] !== gen) { stamp[next] = gen; cost[next] = Infinity; score[next] = Infinity; came[next] = -1; }
      if (c >= cost[next]!) continue;
      cost[next] = c;
      came[next] = cur;
      score[next] = c + h(x, y);
      open.push(next);
    }
  }
  const reached = best === idx(tx, ty);
  const cells: Point[] = [];
  for (let at = best; at !== start && at !== -1 && seen(at); at = came[at]!) cells.push({ x: (at % n) + 0.5, y: Math.floor(at / n) + 0.5 });
  cells.reverse();
  if (reached && walkable(map, to.x, to.y, costs)) cells[cells.length - 1] = to;
  if (!cells.length) return [];
  // Drop waypoints that can be skipped by walking straight.
  const out: Point[] = [];
  let anchor = from;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next && clearLine(map, anchor, next, costs)) continue;
    out.push(cells[i]!);
    anchor = cells[i]!;
  }
  return out;
}
