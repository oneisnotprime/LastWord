import { tileAt, walkable, WALK_COST, type Costs, type Point, type WorldMap } from "./world.js";

/** Most tiles a search may open before it gives up; keeps one search to a millisecond or so. */
const MAX_OPEN = 6_000;

/** Search buffers, reused between searches on maps of the same size. */
let buffers: { size: number; cost: Float64Array; score: Float64Array; came: Int32Array; stamp: Uint32Array; gen: number } | null = null;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

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
    if (a.length) {
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        const pick = (j: number) => j < a.length && s[a[j]!]! < s[m === k ? last : a[m]!]!;
        if (pick(l)) m = l;
        if (pick(r)) m = r;
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
  const dx = b.x - a.x, dy = b.y - a.y;
  let x = Math.floor(a.x), y = Math.floor(a.y);
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx > 0 ? (x + 1 - a.x) * tdx : dx < 0 ? (a.x - x) * tdx : Infinity;
  let ty = dy > 0 ? (y + 1 - a.y) * tdy : dy < 0 ? (a.y - y) * tdy : Infinity;
  while (Math.min(tx, ty) < 1) {
    if (Math.abs(tx - ty) < 1e-9) {
      if (!walkable(map, x + sx + 0.5, y + 0.5, costs) || !walkable(map, x + 0.5, y + sy + 0.5, costs)) return false;
      x += sx; y += sy; tx += tdx; ty += tdy;
    } else if (tx < ty) { x += sx; tx += tdx; }
    else { y += sy; ty += tdy; }
    if (!walkable(map, x + 0.5, y + 0.5, costs)) return false;
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
    buffers = { size: n, cost: new Float64Array(n * n), score: new Float64Array(n * n), came: new Int32Array(n * n), stamp: new Uint32Array(n * n), gen: 0 };
  }
  // A tile's entries count only if stamped in this search, so nothing has to be cleared.
  const b = buffers, gen = ++b.gen, { cost, score, came, stamp } = b;
  const seen = (i: number) => stamp[i] === gen;
  const touch = (i: number) => { if (!seen(i)) { stamp[i] = gen; cost[i] = Infinity; score[i] = Infinity; came[i] = -1; } };
  touch(start);
  const h = (x: number, y: number) => Math.hypot(x - tx, y - ty) * 0.5; // roads cost 0.5 a tile
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
    for (const [dx, dy] of DIRS) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const step = costs[tileAt(map, x, y)];
      if (step === Infinity) continue;
      // No cutting corners past a blocked tile.
      if (dx && dy && (!walkable(map, cx + dx, cy, costs) || !walkable(map, cx, cy + dy, costs))) continue;
      const next = idx(x, y), c = cost[cur]! + step * (dx && dy ? Math.SQRT2 : 1);
      touch(next);
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
