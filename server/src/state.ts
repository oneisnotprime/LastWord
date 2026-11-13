import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * A player, or a creature acting on its own, as clients see it. Sent only to clients whose view
 * holds it.
 */
export const Player = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    /** Body integrity as a percentage, for the health bar. */
    hp: t.uint8(),
    /** What the player carries, as text: "sword, armor, tank". */
    gear: t.string(),
    /** For a creature someone spelled: its owner's session id, or "-" if it has none. "" for a person. */
    owner: t.string(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** An object someone spelled into the world. */
export const Thing = schema(
  {
    phrase: t.string(),
    owner: t.string(),
    x: t.float32(),
    y: t.float32(),
    /** Integrity as a percentage. */
    hp: t.uint8(),
  },
  "Thing",
);
export type Thing = SchemaType<typeof Thing>;

/** A disc of terrain a word laid down. Everyone gets these, in order, to keep maps in step. */
export const Edit = schema({ x: t.float32(), y: t.float32(), radius: t.float32(), tile: t.uint8() }, "Edit");
export type Edit = SchemaType<typeof Edit>;

export const WorldState = schema(
  {
    /** Clients rebuild the map from the seed; tiles are never sent. */
    seed: t.uint32(),
    size: t.uint16(),
    players: t.map(Player).view(),
    things: t.map(Thing).view(),
    edits: t.array(Edit),
    /** "day" or "night". */
    daylight: t.string(),
    /** The weather word in force, or "". */
    weather: t.string(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
