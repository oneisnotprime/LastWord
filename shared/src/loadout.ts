/** What a player is told about their own character; sent only to them. */
export interface LoadoutDetail {
  health: { now: number; max: number };
  /** Metres a second. */
  speed: number;
  /** Metres. */
  sight: number;
  flying: boolean;
  attack: {
    /** What the strike comes from: a held weapon, a vehicle, or "bare hands". */
    with: string;
    /** Damage per strike by type, after strength and training. */
    damage: Record<string, number>;
    /** Strikes a second. */
    rate: number;
    /** Metres. */
    reach: number;
  };
  /** Everything carried, in the order it was put on. `index` is what to send to drop or use it. */
  gear: { index: number; phrase: string; slot: string; integrity: number | null; max: number | null; usable: boolean }[];
  /** Things on the ground in reach that you may use (eat, drink, take), by thing id. */
  nearby: { id: string; phrase: string }[];
  /** Verbs in force, with seconds left; fields you stand in, with -1. */
  effects: { word: string; left: number }[];
  /** Statuses on you (stun, poison...), with seconds left. */
  statuses: { status: string; left: number }[];
  /** Morale, 0 to 10 and beyond: shaken below 3, fleeing at 0. */
  morale: number;
  /** Food, fuel and power in store, and what everything you own draws (need) and supplies (makes) a minute. */
  stores: Record<"food" | "fuel" | "power", { have: number; need: number; make: number }>;
  /** Things of yours that went short at the last count, by name: hungry creatures, stalled machines. */
  short: string[];
  /** Creatures you can command at once, and how many you have. */
  command: { limit: number; have: number };
  creatures: { name: string; health: number; hungry?: boolean; fleeing?: boolean }[];
  /** Words that are part of your screen (shared `senseOf`): a MAP's minimap. Empty: no minimap. */
  senses: { word: string; reveal: number; letters: number; life: number }[];
  /** What each of your producers is making a minute, or why it is not (shared `producingLine`). */
  producing?: string[];
  /**
   * Letters coming in a minute from what you own, by letter, with what makes them ("HOE, FARM";
   * Y: "age of 5 things"). Whatever belongs to you produces: on the ground, as a creature, or
   * carried, worn and ridden.
   */
  income?: { letter: string; rate: number; from: string }[];
}

/** What a player's senses pick up, sent about once a second while they have any: map positions in tiles. */
export interface Sensed {
  /** Living things in `life` range: people and creatures, and whether each is yours. */
  life: { x: number; y: number; mine: boolean; person: boolean }[];
  /** Letter sources in `letters` range: things that make letters, with the letters they make. */
  letters: { x: number; y: number; letters: string }[];
}
