import type { Stats } from "./stats.js";
import type { Status } from "./status.js";

/**
 * The screen (concept: screen and HUD access). What a player sees of their own interface is a
 * shared quantity words touch, like sight or morale: statuses grey, blank or scramble panels, and
 * things, fields and verbs that `restores_panels` give them back.
 *
 * - Statuses (`SCREEN_RULES`): BLIND greys the minimap with static and hides others' bars and
 *   names; AMNESIA hides the spell preview, the best-words strip and the inventory; ILLITERATE
 *   scrambles every word card, the letter rack, the trade screen and the chips; CENSOR blanks the
 *   event chips and the feed (calls, pings, kills); SLEEP hides nearly everything; CONFUSE and
 *   CHAOS scramble a little. A field that `jams` (signal.ts) puts static on the minimap and feed.
 * - Restoring: `restores_panels` (tags, panel names) on something carried or worn, a field you
 *   stand in, a verb in force or a sense gives those panels back whatever greys them: GLASSES the
 *   minimap and bars, LITERACY the cards and rack, a MAP the minimap, a DIARY the preview, NEWS the
 *   chips. `immune_<status>` keeps the status off, `effect_status` cures it.
 *
 * The server works out a player's `Screen` and sends it in the loadout; the client draws it.
 */

/** Every panel words can take away or give back. */
export const PANELS = ["minimap", "bars", "preview", "best", "inventory", "trade", "rack", "chips", "feed", "cards", "intel"] as const;
export type Panel = (typeof PANELS)[number];

/** What happens to a panel: hidden (blank, labelled), static (greyed noise) or scrambled (letters shuffled). */
export type Blot = "hide" | "static" | "scramble";
/** Worst first: a panel both hidden and scrambled is hidden. */
const WORST: readonly Blot[] = ["hide", "static", "scramble"];

/** What each status does to the screen. Statuses left out touch nothing. */
export const SCREEN_RULES: Partial<Record<Status, Partial<Record<Panel, Blot>>>> = {
  blind: { minimap: "static", bars: "hide", intel: "hide" },
  sleep: { minimap: "hide", bars: "hide", preview: "hide", best: "hide", chips: "hide", feed: "hide", intel: "hide" },
  confuse: { best: "scramble", cards: "scramble" },
  chaos: { rack: "scramble", best: "scramble", cards: "scramble" },
  amnesia: { preview: "hide", best: "hide", inventory: "hide", intel: "hide" },
  illiterate: { cards: "scramble", rack: "scramble", trade: "scramble", preview: "scramble", best: "scramble", chips: "scramble", intel: "scramble" },
  censor: { chips: "hide", feed: "hide" },
};
/** A jamming field (signal.ts) on the screen. */
export const JAMMED_SCREEN: Partial<Record<Panel, Blot>> = { minimap: "static", feed: "static" };

/** A player's screen: what is greyed, blanked or scrambled, and by what (the label shown over it). */
export interface Screen {
  blots: Partial<Record<Panel, Blot>>;
  /** The status (or "jammed") behind each blot, for its label: "BLIND". */
  by: Partial<Record<Panel, string>>;
  /** Panels given back by something you have, whatever would grey them. */
  restored: Panel[];
}

/** True for a panel name. */
export const isPanel = (p: string): p is Panel => (PANELS as readonly string[]).includes(p);

/** Panels a thing, field or verb gives back (`restores_panels`), all of them for "all". */
export function restoresOf(s: Stats): Panel[] {
  const tags = s.tags("restores_panels");
  return tags.includes("all") ? [...PANELS] : tags.filter(isPanel);
}

/**
 * A screen from the statuses on someone, the panels their things give back and whether a jamming
 * field reaches them.
 */
export function screenOf(statuses: readonly { status: string }[], restored: readonly Panel[] = [], jammed = false): Screen {
  const out: Screen = { blots: {}, by: {}, restored: [...new Set(restored)].sort() };
  const put = (rules: Partial<Record<Panel, Blot>>, by: string) => {
    for (const [panel, blot] of Object.entries(rules) as [Panel, Blot][]) {
      if (out.restored.includes(panel)) continue;
      const had = out.blots[panel];
      if (had && WORST.indexOf(had) <= WORST.indexOf(blot)) continue;
      out.blots[panel] = blot;
      out.by[panel] = by;
    }
  };
  for (const a of statuses) {
    const rules = SCREEN_RULES[a.status as Status];
    if (rules) put(rules, a.status);
  }
  if (jammed) put(JAMMED_SCREEN, "jammed");
  return out;
}

/** True if nothing is greyed, blanked or scrambled. */
export const clearScreen = (s: Screen): boolean => Object.keys(s.blots).length === 0;

/** Plain names for panels, for cards. */
const PANEL_NAMES: Record<Panel, string> = {
  minimap: "minimap", bars: "others' bars and names", preview: "spell preview", best: "best words", inventory: "inventory",
  trade: "trade screen", rack: "letter rack", chips: "event chips", feed: "calls and kill feed", cards: "word cards", intel: "intel",
};
const BLOT_VERBS: Record<Blot, string> = { hide: "hides", static: "greys", scramble: "scrambles" };

/** What a status does to the screen, in a line: "hides spell preview, best words; scrambles ...". */
export function screenLine(status: Status): string {
  const rules = SCREEN_RULES[status];
  if (!rules) return "";
  const by = new Map<Blot, string[]>();
  for (const [p, b] of Object.entries(rules) as [Panel, Blot][]) by.set(b, [...(by.get(b) ?? []), PANEL_NAMES[p]]);
  return [...by].map(([b, ps]) => `${BLOT_VERBS[b]} ${ps.join(", ")}`).join("; ");
}

/** Screen lines for a card: what it greys on whoever it lands on, and what it gives back. */
export function screenText(s: Stats): string[] {
  const out: string[] = [];
  for (const status of Object.keys(SCREEN_RULES) as Status[]) {
    if (s.num(`inflict_${status}`) > 0) out.push(`${status} on the struck screen: ${screenLine(status)}`);
  }
  const back = restoresOf(s);
  if (back.length) out.push(`restores ${back.length === PANELS.length ? "every panel" : back.map((p) => PANEL_NAMES[p]).join(", ")}`);
  return out;
}
