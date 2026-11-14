// Prints the words that have a hand-made shape (WORDS in client/src/art/shapes.ts), one per line.
// Run from the repo root: npx tsx tools/art/shape_keys.ts
import { WORDS } from "../../client/src/art/shapes.js";
console.log(Object.keys(WORDS).join("\n"));
