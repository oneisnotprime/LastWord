import type { Stats } from "./stats.js";

/**
 * Religion and myth (dictionary theme 19). Faith is a store like food and fuel (shared upkeep.ts
 * `SUPPLIES`): shrines, temples, priests and prayer fill it (`faith_output` a minute), holy things
 * that need belief draw it (`upkeep_faith`: an ANGEL with none goes its own way), and HERESY on
 * enemies draws theirs dry. Three rules of its own:
 *
 * - miracles: a word with `faith_cost` spends that much of its speller's faith and cannot be
 *   spelled without it (`faithProblem`): a MIRACLE, a RESURRECTION, a CURSE, SMITE, a DEITY.
 * - sacrifice: whatever dies or is destroyed within ALTAR_TILES of a thing with `sacrifice` (an
 *   ALTAR, a PYRE, a SHRINE) pays the altar's owner `offering` × sacrifice in faith, and burning
 *   there pays its burner twice the F.
 * - blessings and curses are statuses (status.ts `earns`): the blessed earn half again as many
 *   letters and heal, the cursed earn half and aim worse. ATHEISM gives immunity to both;
 *   EXORCISM and a BLESSING end curses, BLASPHEMY blessings.
 */

/** Tiles from an altar within which a death or a ruin is an offering. */
export const ALTAR_TILES = 4;

/** Faith one death or ruin is worth before the altar's `sacrifice` multiplies it. */
export function offering(s: Stats): number {
  const value = Math.max(0, s.num("value"));
  const alive = s.flag("alive") ? 5 + (s.flag("sentient") ? 5 : 0) : 0;
  return 2 + Math.log10(1 + value) * 2 + alive;
}

/** Why a word with a faith cost cannot be spelled now, or "". */
export function faithProblem(s: Stats, faith: number): string {
  const cost = s.num("faith_cost");
  if (!(cost > 0) || faith + 1e-9 >= cost) return "";
  return `it takes ${Math.ceil(cost)} faith and you have ${Math.floor(faith)}: pray, or build a SHRINE or a TEMPLE`;
}

/** Faith's lines for a card. */
export function faithText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("faith_cost") > 0) out.push(`a miracle: costs ${s.num("faith_cost")} faith`);
  if (s.num("sacrifice") > 0) out.push(`an altar: whatever dies or is destroyed within ${ALTAR_TILES} tiles pays its owner faith (×${s.num("sacrifice")}); burning there pays double F`);
  if (s.num("inflict_bless") > 0) out.push("blesses: they earn half again as many letters and heal");
  if (s.num("inflict_curse") > 0) out.push("curses: they earn half the letters and aim worse");
  if (s.tags("effect_status").includes("curse")) out.push("lifts curses");
  return out;
}
