import { schema, t, type SchemaType } from "@colyseus/schema";

/** A player as other clients see it. Sent only to clients whose view holds it. */
export const Player = schema({ name: t.string(), x: t.float32(), y: t.float32() }, "Player");
export type Player = SchemaType<typeof Player>;

export const WorldState = schema(
  {
    /** Clients rebuild the map from the seed; tiles are never sent. */
    seed: t.uint32(),
    size: t.uint16(),
    players: t.map(Player).view(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
