import type { Dictionary } from "@lastword/shared";

/** One line describing a word, for the placeholder screen. */
export function describe(dict: Dictionary, word: string): string {
  const def = dict.word(word);
  if (!def) return `${word.toUpperCase()}: not a word yet`;
  return `${word.toUpperCase()}: ${def.role}, ${def.archetype}, ${Object.keys(def.set).length + def.ops.length} properties`;
}
