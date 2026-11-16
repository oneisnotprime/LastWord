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
    /** Statuses on it, space separated: "stun poison". "" when there are none. */
    status: t.string(),
    /** How many it is: a swarm of a thousand ants is one walker with count 1000. 1 for a person. */
    count: t.float64(),
    /** For a person: adjectives someone put on their body, space separated: "worst". "" when none. */
    traits: t.string(),
    /** A roaming boss: slay it for Z. */
    boss: t.boolean(),
    /** A knocked-out person haunting the map (shared death.ts): never alive, never struck. */
    ghost: t.boolean(),
    /** Size against its word (shared scale.ts): the standee is drawn this much bigger. 0 is read as 1. */
    size: t.float32(),
    /** Whom it is leashed to (shared control.ts): a tether line is drawn to them. "" when none. */
    tether: t.string(),
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
    /** How many it is: a stack of a hundred arrows is one thing with count 100. */
    count: t.float64(),
    /** One of the map's own letter sources ("market", "temple", "chest", "ruin"), else "". */
    fixture: t.string(),
    /** A walk-in building (shared interior.ts): its room's radius in tiles, 0 for anything else. */
    room: t.float32(),
    /** A walk-in building's door, as a percentage of its integrity: 0 once broken (anyone may enter). */
    door: t.uint8(),
  },
  "Thing",
);
export type Thing = SchemaType<typeof Thing>;

/** An event going on over an area: a fire, a war, an earthquake. */
export const Zone = schema({
  word: t.string(), x: t.float32(), y: t.float32(), radius: t.float32(),
  /** For claimed ground (HOME, CASTLE): whose it is, and the percentage of damage it takes away. 0 for anything else. */
  owner: t.string(), shelter: t.uint8(),
  /** Round clock second it ends at (`WorldState.clock`), 0 if it lasts. */
  until: t.uint32(),
  /** Name of whoever made it ("" for the map's own). */
  by: t.string(),
  /** Seconds from when it appeared until it strikes: it is shown first (shared hazard.ts); 0 once it has, or for an area that never warns. */
  warn: t.float32(),
}, "Zone");
export type Zone = SchemaType<typeof Zone>;

/** A city: where it is, who rules it (name, "" for nobody) and how many citizens it has left. */
export const City = schema({ x: t.float32(), y: t.float32(), radius: t.float32(), ruler: t.string(), citizens: t.uint8() }, "City");
export type City = SchemaType<typeof City>;

/** A disc of terrain a word laid down. Everyone gets these, in order, to keep maps in step. */
/** `x2`, `y2`: the far end of a run (a ROAD), 0 for a disc. `soil`: only soil is changed (tilling never turns water, roads, cities or rock to crop land). */
export const Edit = schema({ x: t.float32(), y: t.float32(), radius: t.float32(), tile: t.uint8(), soil: t.boolean(), x2: t.float32(), y2: t.float32(), only: t.uint32() }, "Edit");
export type Edit = SchemaType<typeof Edit>;

export const WorldState = schema(
  {
    /** Clients rebuild the map from the seed; tiles are never sent. */
    seed: t.uint32(),
    size: t.uint16(),
    players: t.map(Player).view(),
    things: t.map(Thing).view(),
    edits: t.array(Edit),
    cities: t.array(City),
    zones: t.map(Zone),
    /** "day" or "night". */
    daylight: t.string(),
    /** The weather word in force, or "". */
    weather: t.string(),
    /** The word that brought the weather (MONSOON brings rain), who spelled it, and the clock second it ends (0: lasts). */
    weatherWord: t.string(),
    weatherBy: t.string(),
    weatherUntil: t.uint32(),
    /** The word that set the daylight (ECLIPSE), who spelled it, and the clock second it ends (0: lasts). */
    daylightWord: t.string(),
    daylightBy: t.string(),
    daylightUntil: t.uint32(),
    /** "playing", or "over" once someone has won. */
    phase: t.string(),
    /** Name of the winner once the round is over. */
    winner: t.string(),
    /** People still alive in the round, bots included. */
    alive: t.uint16(),
    /** Whole seconds since the round began. */
    clock: t.uint32(),
    /** The wind over the map as a percentage (shared `windAt`): windmills turn with it. */
    wind: t.uint8(),
    /** The storm wall (shared round.ts): where it stands, the circle it closes to, seconds to its next change. */
    stormX: t.float32(), stormY: t.float32(), stormR: t.float32(),
    stormNextX: t.float32(), stormNextY: t.float32(), stormNextR: t.float32(),
    stormLeft: t.uint16(), stormStage: t.uint8(),
    /** "calm" before it first closes, "waiting", "closing", "held" (a word holds it) or "closed". */
    stormMode: t.string(),
    /** Percent of full health a second it takes from whoever is outside, and the word holding it. */
    stormDps: t.float32(), stormHeld: t.string(),
    /** Ghosts haunting the map: the knocked out, never counted alive. */
    ghosts: t.uint16(),
    /** How fights between people are resolved: "realtime" or "turns" (shared battle.ts). */
    combat: t.string(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
