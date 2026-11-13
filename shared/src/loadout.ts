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
  /** Everything carried, in the order it was put on. `index` is what to send to drop it. */
  gear: { index: number; phrase: string; slot: string; integrity: number | null; max: number | null }[];
  /** Verbs in force, with seconds left. */
  effects: { word: string; left: number }[];
  creatures: { name: string; health: number }[];
}
