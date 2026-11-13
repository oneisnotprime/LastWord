/**
 * English plurals for nouns: CAT -> CATS, BOX -> BOXES, CITY -> CITIES, WOLF -> WOLVES, and a
 * short list of irregulars (MEN, MICE, TEETH...). A plural spells several of its noun.
 */

/** Singular -> plural for words the rules below get wrong. */
const IRREGULAR: Record<string, string> = {
  man: "men", woman: "women", child: "children", mouse: "mice", louse: "lice", goose: "geese",
  foot: "feet", tooth: "teeth", person: "people", ox: "oxen", die: "dice",
  wolf: "wolves", knife: "knives", life: "lives", leaf: "leaves", wife: "wives", half: "halves",
  elf: "elves", self: "selves", shelf: "shelves", calf: "calves", loaf: "loaves", thief: "thieves",
  sheaf: "sheaves", hoof: "hooves", scarf: "scarves", dwarf: "dwarves", wharf: "wharves",
  potato: "potatoes", tomato: "tomatoes", hero: "heroes", echo: "echoes", torpedo: "torpedoes",
  volcano: "volcanoes", mosquito: "mosquitoes",
};
const SINGULAR: Record<string, string> = Object.fromEntries(Object.entries(IRREGULAR).map(([s, p]) => [p, s]));

/** The plural of a lower-case singular noun. */
export function pluralize(word: string): string {
  const irregular = IRREGULAR[word];
  if (irregular) return irregular;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * Singulars that `text` could be the plural of, most likely first: MICE -> mouse, BOXES -> box
 * (and boxe), CITIES -> city. Each candidate pluralizes back to `text`; whether it is a word is
 * for the caller to decide.
 */
export function singulars(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (s && !out.includes(s) && pluralize(s) === text) out.push(s); };
  if (SINGULAR[text]) add(SINGULAR[text]!);
  if (text.endsWith("ies")) add(`${text.slice(0, -3)}y`);
  if (text.endsWith("es")) add(text.slice(0, -2));
  if (text.endsWith("s")) add(text.slice(0, -1));
  return out;
}
