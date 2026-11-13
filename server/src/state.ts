import { schema, t, type SchemaType } from "@colyseus/schema";

/** A player as other clients see it. Sent only to clients whose view holds it. */
export const Player = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    /** Body integrity as a percentage, for the health bar. */
    hp: t.uint8(),
    /** What the player carries, as text: "sword, armor, tank". */
    gear: t.string(),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** An object someone spelled into the world. */
export const Thing = schema(
  { phrase: t.string(), owner: t.string(), x: t.float32(), y: t.float32() },
  "Thing",
);
export type Thing = SchemaType<typeof Thing>;

export const WorldState = schema(
  {
    /** Clients rebuild the map from the seed; tiles are never sent. */
    seed: t.uint32(),
    size: t.uint16(),
    players: t.map(Player).view(),
    things: t.map(Thing).view(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
