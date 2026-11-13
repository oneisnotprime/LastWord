import type { Dictionary } from "@lastword/shared";

/** One line describing a word, for the placeholder screen. */
export function describe(dict: Dictionary, word: string): string {
  const found = dict.lookup(word);
  if (!found) return `${word.toUpperCase()}: not a word yet`;
  const { def, degree } = found;
  const form = degree === "positive" ? "" : ` (${degree} of ${found.word.toUpperCase()})`;
  return `${word.toUpperCase()}${form}: ${def.role}, ${def.archetype}, ${Object.keys(def.set).length + def.ops.length} properties`;
}
