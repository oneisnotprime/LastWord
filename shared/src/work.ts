import type { Stats } from "./stats.js";

/**
 * Professions (dictionary theme 1): what a working creature of yours (a FARMER, a SCOUT, a
 * MASON, a PRIEST) does is read from its properties, never its name. A body can hold several
 * jobs. Most act through systems that already exist (labour on producers, healing and recruiting
 * auras, fighting); three are the workers' own:
 *
 * - scout (`map_reveal`, or sight of SCOUT_SIGHT m and more): ranges ahead of its master, and each
 *   new region it reaches pays its master a J as if they had been there.
 * - trade (`trade_bonus`): markets its master trades at with it in reach ask `trade_bonus` less.
 * - build (`build_speed` over 1): structures its master makes within WORK_RANGE are that many
 *   times sturdier.
 */
export type Job = "farm" | "craft" | "labour" | "guard" | "heal" | "scout" | "trade" | "build" | "preach" | "lead" | "fight";

/** Tiles from a worker within which it haggles at a market or builds. */
export const WORK_RANGE = 8;
/** Sight, in metres, from which a creature counts as a scout. */
export const SCOUT_SIGHT = 300;
/** Tiles a scout ranges from its master. */
export const SCOUT_RANGE = 40;
/** The least a market can be talked down to, as a share of its price. */
export const HAGGLE_FLOOR = 0.34;

const harvests = (s: Stats, what: string[]) => s.tags("harvest_sources").some((t) => what.includes(t));

/** The jobs a body does, from its properties. Only sentient bodies work. */
export function jobsOf(s: Stats): Job[] {
  if (!s.flag("sentient")) return [];
  const jobs: Job[] = [];
  const labour = s.num("labor") > 0;
  if (labour && (harvests(s, ["field", "crop", "orchard", "fishing"]) || s.num("produce_A") > 0)) jobs.push("farm");
  if (labour && (s.num("craft_slots") > 0 || s.num("produce_C") > 0)) jobs.push("craft");
  if (labour && !jobs.length) jobs.push("labour");
  if (s.num("build_speed") > 1) jobs.push("build");
  if (s.num("heals") > 0) jobs.push("heal");
  if (s.num("map_reveal") > 0 || s.num("sight_range") >= SCOUT_SIGHT) jobs.push("scout");
  if (s.num("trade_bonus") > 0) jobs.push("trade");
  if (s.num("recruit_rate") > 0) jobs.push("preach");
  if (s.num("command_limit") > 0 || s.num("authority") >= 5) jobs.push("lead");
  if (s.flag("alarm") || s.num("detect_stealth") >= 5) jobs.push("guard");
  return jobs;
}

/** A market's price after haggling: `trade_bonus` off, never below HAGGLE_FLOOR of it. */
export function haggled(ratio: number, bonus: number): number {
  return ratio * Math.max(HAGGLE_FLOOR, 1 - Math.max(0, bonus));
}

/** How much sturdier a structure is for the builders about: the best `build_speed` among them, at least 1. */
export function builtBy(speeds: readonly number[]): number {
  return Math.max(1, ...speeds.filter((n) => Number.isFinite(n)));
}

const JOB_TEXT: Record<Job, (s: Stats) => string> = {
  farm: () => "works your fields: labour raises their yield",
  craft: () => "works your stations: labour raises what they make",
  labour: (s) => `works your producers (labour ${+s.num("labor").toFixed(2)})`,
  guard: () => "keeps watch: spots the hidden and raises the alarm",
  heal: (s) => `heals your side ${+s.num("heals").toFixed(1)} a second`,
  scout: () => `scouts up to ${SCOUT_RANGE} tiles ahead: each new region it reaches pays you J`,
  trade: (s) => `haggles: markets you trade at with it near ask ${Math.round(Math.min(1 - HAGGLE_FLOOR, s.num("trade_bonus")) * 100)}% less`,
  build: (s) => `builds: what you raise within ${WORK_RANGE} tiles of it is ×${+s.num("build_speed").toFixed(2)} sturdier`,
  preach: () => "preaches: draws wild creatures to your side",
  lead: () => "leads: more creatures follow your orders",
  fight: () => "fights for you",
};

/** A worker's jobs in plain words, for its card. */
export function jobText(s: Stats): string[] {
  return jobsOf(s).map((j) => JOB_TEXT[j](s));
}
