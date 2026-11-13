import { generateMap, stampTerrain, Tile, tileAt } from "@lastword/shared";

/** The one fixed scene every style draws: a crop of map seed 14 with a pond stamped in. */
export const SEED = 14, X0 = 156, Y0 = 199, COLS = 31, ROWS = 24, S = 32;
export const W = COLS * S, H = ROWS * S;

export type Kind = "player" | "wolf" | "dragon" | "swarm" | "chest" | "wall" | "sword";

/** Something on the map. x, y are scene pixels at its feet (or centre, for flat things). */
export interface Thing {
  kind: Kind;
  word: string;
  label: string;
  x: number;
  y: number;
  /** 1 faces right, -1 left. */
  facing: 1 | -1;
  scale: number;
  /** Adjective overlays, as a word would add them. */
  burning?: boolean;
  /** What a player holds. */
  held?: string;
  /** Which of the two players: 0 is you. */
  who?: number;
  /** Length in tiles, for a wall; radius in tiles, for a swarm. */
  size?: number;
}

export interface Area { word: "FIRE" | "LOVE"; x: number; y: number; r: number }

const map = generateMap(SEED);
stampTerrain(map, { x: X0 + 27.5, y: Y0 + 2.5, radius: 1.6, tile: Tile.Water }); // the pond

/** The tile at crop coordinates; outside the crop it is the real map, so edges join up. */
export const tile = (tx: number, ty: number): Tile => tileAt(map, X0 + tx, Y0 + ty);

const at = (tx: number, ty: number) => ({ x: tx * S, y: ty * S });

export const things: Thing[] = [
  { kind: "dragon", word: "dragon", label: "DRAGON", ...at(6, 7.6), facing: 1, scale: 1.5 },
  { kind: "wall", word: "wall", label: "WALL", ...at(25.9, 17.5), facing: 1, scale: 1, size: 3 },
  { kind: "chest", word: "chest", label: "CHEST", ...at(27.5, 8.6), facing: 1, scale: 1.4 },
  { kind: "swarm", word: "ant", label: "ANT ×1,000", ...at(20.5, 18.2), facing: 1, scale: 1, size: 1.8 },
  { kind: "wolf", word: "wolf", label: "WOLF", ...at(17.4, 13.4), facing: 1, scale: 1.6 },
  { kind: "player", word: "mira", label: "MIRA", ...at(27.2, 14.6), facing: -1, scale: 1.5, who: 1 },
  { kind: "player", word: "you", label: "YOU", ...at(22.6, 12.9), facing: -1, scale: 1.5, who: 0, held: "sword" },
];

export const areas: Area[] = [
  { word: "FIRE", ...at(9.2, 13.6), r: 2.7 * S },
  { word: "LOVE", ...at(22.6, 12.4), r: 2.3 * S },
];

/** Where light comes from at night. */
export const lights = [
  { x: areas[0]!.x, y: areas[0]!.y, r: 6 * S, warm: true },
  { x: areas[1]!.x, y: areas[1]!.y, r: 3.6 * S, warm: false },
  { x: 27.2 * S, y: 14.3 * S, r: 2.4 * S, warm: false },
  { x: 6 * S, y: 7.2 * S, r: 2.5 * S, warm: true },
];

/** Inset: the adjectives. */
export const inset = {
  w: 280, h: 170,
  sword: { kind: "sword", word: "sword", label: "BURNING SWORD", x: 70, y: 112, facing: 1, scale: 1.4, burning: true } as Thing,
  wolf: { kind: "wolf", word: "wolf", label: "GIANT WOLF", x: 190, y: 120, facing: -1, scale: 2.2 } as Thing,
};

/** What the HUD shows: letters held, with counts, and a spelling in progress. */
export const hud = {
  letters: [["A", 3], ["B", 1], ["D", 1], ["E", 4], ["F", 1], ["G", 2], ["I", 2], ["L", 1], ["N", 3], ["O", 2], ["R", 2], ["S", 2], ["T", 2], ["U", 1], ["W", 1]] as [string, number][],
  typed: "BURNING",
};

export { Tile };
