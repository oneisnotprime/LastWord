import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";

/**
 * The round itself (concept "the round"): a storm wall closes over the map so the last people
 * meet. It keeps its own clock, the storm clock, which words bend (shared properties, read by the
 * server whatever kind of word carries them):
 *
 * - `storm_pause`: the storm clock stands still this many seconds (TRUCE, CEASEFIRE, ARMISTICE;
 *   OVERTIME longer). A word that counters the pausing word ends the hold.
 * - `storm_shift`: the storm clock jumps on this many seconds (DOOMSDAY, APOCALYPSE).
 * - `sudden_death`: the storm clock jumps to the last circle's closing.
 *
 * Bosses rise on the storm clock (territory.ts BOSS_TIMES), and the round's own weather comes
 * with the late circles (STORM_WEATHER_STAGE), so both bend with it.
 */

/** One step of the wall: it waits, then closes over `shrink` seconds to `radius` (a share of the first). */
export interface StormStage { wait: number; shrink: number; radius: number; dps: number }

/**
 * The schedule, tuned for rounds of 8 to 12 minutes with eight people: calm for the first three
 * minutes, then five closings, the last to nothing at 12 minutes of storm clock.
 * `dps` is the share of full health a second the wall takes from whoever is outside it while
 * that stage stands (or closes toward its circle).
 */
export const STORM_STAGES: readonly StormStage[] = [
  { wait: 180, shrink: 90, radius: 0.65, dps: 0.008 },
  { wait: 75, shrink: 70, radius: 0.42, dps: 0.015 },
  { wait: 60, shrink: 60, radius: 0.24, dps: 0.03 },
  { wait: 50, shrink: 50, radius: 0.1, dps: 0.06 },
  { wait: 40, shrink: 45, radius: 0, dps: 0.12 },
];

/** Storm-clock seconds until the wall has closed to nothing. */
export const STORM_END = STORM_STAGES.reduce((n, s) => n + s.wait + s.shrink, 0);
/** The stage from which the round brings its own weather (the sky goes dark over the last circles). */
export const STORM_WEATHER_STAGE = 3;
/** Share of the map's size the first circle's radius is: past every corner from the middle. */
export const STORM_START = 0.75;

export interface StormPlan {
  /** Circle centres and radii in tiles, the first (the whole map) then one per stage. */
  circles: { x: number; y: number; r: number }[];
}

/**
 * A round's circles: each next one lies wholly inside the one before, its centre drawn at random
 * (seeded) on walkable ground if `walkable` says so. The first is centred on the map.
 */
export function stormPlan(size: number, rng: Rng, walkable: (x: number, y: number) => boolean = () => true): StormPlan {
  const r0 = size * STORM_START;
  const circles = [{ x: size / 2, y: size / 2, r: r0 }];
  for (const stage of STORM_STAGES) {
    const prev = circles[circles.length - 1]!;
    const r = r0 * stage.radius;
    // The first closing keeps well inside the map; later ones anywhere inside the circle before.
    const room = Math.max(0, Math.min(prev.r - r, circles.length === 1 ? size * 0.18 : prev.r - r));
    let best = { x: prev.x, y: prev.y };
    for (let i = 0; i < 12; i++) {
      const t = rng() * Math.PI * 2, d = Math.sqrt(rng()) * room;
      const p = { x: Math.min(size - 2, Math.max(1, prev.x + Math.cos(t) * d)), y: Math.min(size - 2, Math.max(1, prev.y + Math.sin(t) * d)) };
      if (Math.hypot(p.x - prev.x, p.y - prev.y) <= room && walkable(Math.floor(p.x), Math.floor(p.y))) { best = p; break; }
    }
    circles.push({ x: best.x, y: best.y, r });
  }
  return { circles };
}

/** The wall at a storm-clock time: where it stands now, where it closes to next, and what happens when. */
export interface Storm {
  x: number; y: number; r: number;
  /** The circle it closes to (or stands at): the safe ground. */
  nextX: number; nextY: number; nextR: number;
  /** 0 before the first closing; the stage it is in, 1 to STORM_STAGES.length; past the end, the last. */
  stage: number;
  shrinking: boolean;
  /** Storm-clock seconds until the next change (closing starts or stops); 0 once closed. */
  left: number;
  /** Share of full health a second it takes outside. */
  dps: number;
  closed: boolean;
}

export function stormAt(plan: StormPlan, clock: number): Storm {
  let t = Math.max(0, clock);
  for (let i = 0; i < STORM_STAGES.length; i++) {
    const s = STORM_STAGES[i]!, from = plan.circles[i]!, to = plan.circles[i + 1]!;
    const dps = i === 0 ? 0 : STORM_STAGES[i - 1]!.dps;
    if (t < s.wait) return { ...pos(from), nextX: to.x, nextY: to.y, nextR: to.r, stage: i, shrinking: false, left: s.wait - t, dps, closed: false };
    t -= s.wait;
    if (t < s.shrink) {
      const k = t / s.shrink;
      return {
        x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, r: from.r + (to.r - from.r) * k,
        nextX: to.x, nextY: to.y, nextR: to.r, stage: i + 1, shrinking: true, left: s.shrink - t, dps: s.dps, closed: false,
      };
    }
    t -= s.shrink;
  }
  const last = plan.circles[plan.circles.length - 1]!;
  return { ...pos(last), nextX: last.x, nextY: last.y, nextR: last.r, stage: STORM_STAGES.length, shrinking: false, left: 0, dps: STORM_STAGES.at(-1)!.dps, closed: true };
}

const pos = (c: { x: number; y: number; r: number }) => ({ x: c.x, y: c.y, r: c.r });

/** Tiles a point lies outside the wall (0 or less: inside). */
export function outsideBy(storm: Pick<Storm, "x" | "y" | "r">, x: number, y: number): number {
  return Math.hypot(x - storm.x, y - storm.y) - storm.r;
}

/** Damage a second the wall does to a body of `max` full health outside it. */
export const stormDamage = (storm: Pick<Storm, "dps">, max: number): number => storm.dps * max;

/** Storm-clock seconds at which the last closing begins (`sudden_death` jumps here). */
export const SUDDEN_DEATH_AT = STORM_END - STORM_STAGES.at(-1)!.shrink;

/** How a word bends the round, or null if it does not. */
export interface StormBend { pause: number; shift: number; sudden: boolean }

export function stormBendOf(s: Stats): StormBend | null {
  const n = (p: string) => { const v = s.num(p); return Number.isFinite(v) ? v : p === "storm_pause" && v === Infinity ? 600 : 0; };
  const b = { pause: Math.max(0, n("storm_pause")), shift: n("storm_shift"), sudden: s.flag("sudden_death") };
  return b.pause > 0 || b.shift !== 0 || b.sudden ? b : null;
}

/** The storm clock after a word bends it at `clock`: shifted on, or at the last closing. */
export function bentClock(clock: number, bend: StormBend): number {
  if (bend.sudden) return Math.max(clock, SUDDEN_DEATH_AT);
  return Math.max(0, clock + Math.max(0, bend.shift));
}

/** How a word bends the round, in short lines for its card. */
export function stormText(s: Stats): string[] {
  const b = stormBendOf(s);
  if (!b) return [];
  const out: string[] = [];
  if (b.pause > 0) out.push(`holds the storm wall ${Math.round(b.pause)} s`);
  if (b.shift > 0) out.push(`the storm wall closes ${Math.round(b.shift)} s sooner`);
  if (b.sudden) out.push("sudden death: the storm wall jumps to its last circle");
  return out;
}

/** The chip: "STORM 1:20" with what it does next. */
export function stormChip(storm: Storm, paused: boolean): string {
  const m = Math.floor(storm.left / 60), s = Math.floor(storm.left % 60);
  const t = `${m}:${String(s).padStart(2, "0")}`;
  if (storm.closed) return "STORM closed";
  if (paused) return `STORM held · ${t}`;
  return storm.shrinking ? `STORM closing · ${t}` : storm.stage === 0 ? `STORM in ${t}` : `STORM closes in ${t}`;
}
