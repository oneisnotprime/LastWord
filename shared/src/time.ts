import type { Stats } from "./stats.js";
import { STATUS_RULES, type Affliction } from "./status.js";

/**
 * Time (dictionary theme 21). Time can run fast or slow for a body: `time_scale` on it (a field's
 * or a buff's operation, ACCELERATION ×2, DELAY ×0.5) and its statuses (HASTE ×2, STASIS ×0)
 * multiply how fast it moves and strikes and how fast its other statuses wear off. Inside an
 * area, `time_scale` also runs letters made, crops growing and things ageing into Y faster or
 * slower (the area's place rules). `ages` ages a thing at once; `rewinds` undoes recent damage.
 */

/** The fastest time can run for anything: four times. */
export const TIME_MAX = 4;

/** How fast time runs for a body: its `time_scale` times its statuses' (0 in stasis), 0 to TIME_MAX. */
export function timeOf(body: Stats, list: readonly Affliction[] = []): number {
  let t = body.num("time_scale");
  if (!Number.isFinite(t)) t = t > 0 ? TIME_MAX : 0;
  for (const a of list) t *= STATUS_RULES[a.status].time ?? 1;
  return Math.min(TIME_MAX, Math.max(0, t));
}

/** How fast time runs in an area from the `time_scale` it gives (its own value and its operations), 0 to TIME_MAX. */
export function areaTime(own: number, ops: readonly [string, string, number][]): number {
  let t = Number.isFinite(own) ? own : 1;
  for (const [id, op, n] of ops) if (id === "time_scale") t = op === "mul" ? t * n : t + n;
  return Math.min(TIME_MAX, Math.max(0, t));
}

/** Seconds of health kept for `rewinds`: no word undoes more than this. */
export const REWIND_WINDOW = 60;

/**
 * Health after rewinding `seconds`: the best it was over that many of the last seconds
 * (`history`, one entry a second, newest last), never less than it is now, never above `max`.
 */
export function rewound(history: readonly number[], now: number, seconds: number, max: number): number {
  const n = Math.min(history.length, Math.max(0, Math.round(Math.min(seconds, REWIND_WINDOW))));
  let best = now;
  for (let i = history.length - n; i < history.length; i++) best = Math.max(best, history[i]!);
  return Math.min(max, best);
}

/**
 * Room time a thing counts as made at once `ages` minutes have passed over it: older (born
 * earlier) yields more Y and rots sooner; negative makes it young again, never younger than new.
 */
export function agedBorn(born: number, now: number, minutes: number): number {
  return Math.min(now, born - minutes * 60);
}

/** What a word does to time, in short lines for its card. */
export function timeText(s: Stats): string[] {
  const out: string[] = [];
  const t = s.num("time_scale");
  if (t !== 1 && Number.isFinite(t)) out.push(`time runs ×${+t.toFixed(2)}`);
  if (s.num("inflict_haste") > 0) out.push("hastes: twice the time");
  if (s.num("inflict_stasis") > 0) out.push("stops time: no acting, no harm");
  if (s.num("ages") > 0) out.push(`ages its target ${Math.round(s.num("ages"))} min: more Y`);
  if (s.num("ages") < 0) out.push(`makes its target ${Math.round(-s.num("ages"))} min younger`);
  if (s.num("rewinds") > 0) out.push(`undoes the last ${Math.round(Math.min(REWIND_WINDOW, s.num("rewinds")))} s of damage`);
  return out;
}
