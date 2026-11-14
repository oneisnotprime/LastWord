import { Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import {
  addLetters, afflict, placeRules, harvest, growthOf, tradeRateOf, marketRatio, type PlaceRules, aggressive, clearLine, courageOf, pluralize, auras, authorityOf, chooseTarget, commandLimit, draw, groundFood, hasAny, ignoresOrder, moraleAim, moraleGoal, needs, nextMorale, noStores, outputs, recruitRate, rerouteSeconds, startingSupply, becomes, retreats, routed, supply, theftResistance, HUNGER_LOYALTY, NORMAL, STARTING_STORES, STARVING, SUPPLIES, bodyFlags, cure, useObject, findPath, hampered, inflicts, statusDamage, statusEffects, tickStatuses, wake, GATHER_SECONDS, GATHER_REASONS, cachePrize, carcassFood, Deposits, destroyLetters, killLetters, mainland, MARKET, pickAnimal, placeSources, readTrade, regionOf, RUIN_INTEGRITY, CACHE_X, SITE_RADIUS, spawnPoint, starterHand, TEMPLE_Q, tradeProblem, generateMap, GIVE_RANGE, missing, parsePhrase, applyAdjectives, cannotCarry, improvisable, readDescription, production, resolveSpelled, SEPARATE_UP_TO, nearestWalkable, openGround, randomWalkable, resolve, Tile, tileAt, seeded, spawn, spend, stampTerrain, stepToward, strike, strikeUnit, TILE_METERS, TILE_TYPES, Unit, cannotRide, claimOf, senseOf, combineSenses, type Sense, type Sensed,
  type Affliction, type Candidate, type Dictionary, type Stores, type Supply, type Entity, type Hampered, type Status, type Stats, type Letters, type LoadoutDetail, type Op, type Phrase, type Point, type Spelled, type Value, type WordDef, type WorldMap,
} from "@lastword/shared";
import { affords, botSettings, chooseWord, held, wordBook, type BotWord, type Difficulty, type Use } from "./bots.js";
import { loadDictionary } from "./data.js";
import { Edit, Player, Thing, WorldState, Zone } from "./state.js";

/** Simulation steps per second. */
export const TICK_HZ = 10;
/** How often each client's view is recomputed, in ticks. */
const VIEW_EVERY = 5;

/** Something a player carries: held, worn, grafted on, or ridden. */
interface Gear {
  spelled: Spelled;
  phrase: string;
  vehicle: boolean;
  /** Remaining integrity of protection and vehicles; null until first built into a unit. */
  integrity: number | null;
  /** Part of the land (a lake, a mountain, a market, the temple): cannot be picked up or attacked. */
  terrain?: boolean;
  /** One of the map's own letter sources, placed when the round starts. */
  fixture?: "market" | "temple" | "cache" | "ruin";
  /** A machine whose fuel, power or food ran short at the last count: it makes nothing and cannot strike. */
  stalled?: boolean;
  /** A living thing (a ridden DRAGON, a HORSE) that went hungry at the last count. */
  hungry?: boolean;
  /** Loyalty it has lost to hunger. */
  hungerLost?: number;
}

/** A passing effect on bodies: a verb someone cast, or weather over everyone. */
interface Effect { word: string; set: Record<string, Value>; ops: Op[]; until: number }

/** Seconds between a win and everyone being sent on to a new round. ROUND_END_SECONDS overrides. */
const ROUND_END_SECONDS = Number(process.env.ROUND_END_SECONDS ?? 15);

/** An event going on over an area, with what it does to everything inside. */
interface Area {
  word: string;
  owner: string;
  x: number;
  y: number;
  /** Tiles. */
  radius: number;
  /** Room time at which it ends. */
  until: number;
  /** What it strikes with; null if it does no damage. */
  attack: Stats | null;
  /** Seconds until the next strike. */
  cooldown: number;
  /** Hurts its own maker and their creatures too. */
  friendlyFire: boolean;
  /** What it does to letters earned and acts done inside it (shared `placeRules`), or null. */
  rules: PlaceRules | null;
  /** Lode letters it has left to give (Infinity: endless while it lasts). */
  lodeLeft: number;
  /** Tiles a minute it grows over ground that burns. */
  spread: number;
  /** What it does to bodies inside it (an aura or condition), or null. */
  effect: Effect | null;
  /** Who the effect reaches: self, owned, allies, enemies, living or all. */
  targets: string;
  /** A walker the area moves with (an aura around its maker), or null if it stays put. */
  follows: string | null;
  /** Statuses it gives whoever it strikes, or, if it does no damage, whoever it covers each second. */
  inflicts: [Status, number][];
  /** Creatures inside fight the nearest walker not on its maker's side, whatever their master says. */
  hostile: boolean;
  /** Chance a minute that a damaging area spreads to a living walker it covers. */
  contagion: number;
  /** Statuses it takes away from whoever it reaches each second (RELIEF ends fear). */
  cures: string[];
  /** Room time of its last once-a-second pulse. */
  pulsed: number;
  /** Its radius and length when made, for copies of it that spread. */
  baseRadius: number;
  lasts: number;
  /** Integrity a second it restores to its owner's side among whoever it reaches. */
  heals: number;
  /**
   * Claimed ground (shared `claimOf`): the owner's things inside take `shelter` less damage and
   * are `security` harder to steal; `source` is the thing on the ground that claims it, which is
   * not sheltered itself (its walls take the blows), or "" for a claim someone carries.
   */
  claim?: { shelter: number; security: number; source: string };
}

/** What areas start with before a word's own properties say otherwise. */
const AREA_DEFAULTS = { inflicts: [] as [Status, number][], hostile: false, contagion: 0, cures: [] as string[], pulsed: -Infinity, heals: 0, rules: null as PlaceRules | null, lodeLeft: 0 };

/** True if an area would act on anything: damage, effects, statuses, hostility, cures or healing. */
function acts(a: Area): boolean {
  return !!(a.attack || a.effect || a.inflicts.length || a.hostile || a.cures.length || a.heals > 0 || a.rules);
}

/** Where something that radiates is: carried by a walker, or lying on the ground as a thing. */
interface Radiating { holder: string; keys: string[] }

/** How a status reads in "you cannot spell while you are ...". */
const STATE_WORDS: Partial<Record<Status, string>> = { stun: "stunned", freeze: "frozen", sleep: "asleep", silence: "silenced" };

/** Tiles a frightened walker runs ahead of itself each tick. */
const FLEE_TILES = 6;
/** Cell width, in tiles, of the grid `beat` buckets walkers into to find enemies near each. */
const NEAR_CELL = 8;
/** Tiles around itself a confused walker wanders or lashes out. */
const CONFUSED_TILES = 4;

/** How readily fire spreads over each kind of ground; anything missing does not burn. */
const BURNS: Partial<Record<Tile, number>> = { [Tile.Forest]: 3, [Tile.Grass]: 1, [Tile.Swamp]: 0.2 };

function hasDamage(s: Stats): boolean {
  return s.entries().some(([k, v]) => k.startsWith("dmg_") && typeof v === "number" && v > 0);
}

/** An event's strike: it cannot miss or be blocked. */
function alwaysHits(s: Stats): Stats {
  const c = s.clone();
  c.set("accuracy", "ABS");
  return c;
}

/** Route searches allowed in one tick; walkers over the limit wait a tick for theirs. */
const ROUTES_PER_TICK = 12;

/** Sight is multiplied by this at night for anyone without night vision. */
const NIGHT_SIGHT = 0.5;

/** How close, in tiles, a thing on the ground must be to pick it up. */
const TAKE_RANGE = 2;
/** A wandering wild creature's pace, as a fraction of its speed. */
const AMBLE_PACE = 0.4;
/** Reach, in tiles, past which a blow is shown as a shot rather than a swing. */
const RANGED_TILES = 2.5;
/** Most blows one client is told about in a tick. */
const HITS_PER_MESSAGE = 24;
/** Seconds a dropped connection keeps its place in the room. */
const RECONNECT_SECONDS = 20;
/** A tick slower than this is logged: ten a second leaves 100 ms. */
const SLOW_TICK_MS = 80;
/** DEBUG=1 (local development only): spelling DEBUG fills every letter to DEBUG_LETTERS. On the live server DEBUG is just a word. */
const debugging = () => !!process.env.DEBUG && process.env.DEBUG !== "0";
const DEBUG_LETTERS = 999;
/** Playtest shortcut on every server for now: spelling this fills every letter (no letters needed). */
export const CHEAT = "xxx";
/** Tiles around the speller in which a word kills the creatures it counters, unless its event_radius reaches further. */
const COUNTER_TILES = 12;

interface Walker {
  /** Session id for a person, creature id for a creature. */
  id: string;
  player: Player;
  /** What the body is: a human for a person, the spelled creature for a pet. */
  body: Spelled;
  /** For a creature: who it follows and fights for. Null for a person. */
  master: string | null;
  unit: Unit;
  gear: Gear[];
  /** Body integrity. */
  hp: number;
  /** Who this player is attacking, by session id. */
  foe: string | null;
  /** What this player has picked out for events without attacking it: a player, creature or thing. */
  picked: string | null;
  /** A spot on the map picked out for events. */
  aim: Point | null;
  /** Seconds until the next strike. */
  cooldown: number;
  /** Verbs in force on this player. */
  buffs: Effect[];
  /** In the air: ground does not block or slow. */
  flying: boolean;
  /** Effects of the fields this walker stands in, and a key to tell when they change. */
  fields?: Effect[];
  fieldKey?: string;
  target: Point | null;
  /** Waypoints toward `target`, worked out for `routeTo`; recomputed when the target moves. */
  route: Point[];
  routeTo: Point | null;
  routeAge: number;
  /** Searches in a row whose route it could not walk; it gives up its target after a few. */
  blocked?: number;
  speed: number;
  /** Sight range in tiles. */
  sight: number;
  seen: Set<string>;
  seenThings: Set<string>;
  /** Held letters. Private: sent to their owner by message, never put in shared state. */
  letters: Letters;
  /** For a person: the exploration regions (shared `regionOf`) they have been to; each new one gives a J. */
  explored?: Set<number>;
  /** Seconds left on a gathering action, or 0. Moving cancels it. */
  gathering: number;
  /** Statuses on it: stunned, poisoned, afraid... */
  statuses: Affliction[];
  /** What its statuses stop it doing; worked out again whenever they change. */
  hamper: Hampered;
  /** Seconds of damage over time built up and not yet dealt. */
  dot: number;
  /** Morale now, its own when nothing acts on it, and where it is heading (shared `moraleGoal`). */
  morale: number;
  moraleBase: number;
  moraleGoal: number;
  /** Its body's intelligence, for how it chooses and paths. */
  intelligence: number;
  /** Broken (morale 0) or, for a cunning creature, badly hurt: it runs from `fleeFrom` and does not strike. */
  fleeing: boolean;
  fleeFrom: string | null;
  /** For a creature: the last order (its master's target) it was given, and whether it is ignoring it. */
  order: string | null;
  defiant: boolean;
  /** For a creature: hungry at the last count, and loyalty lost to hunger. A person: starving. */
  hungry: boolean;
  hungerLost: number;
  /** The statuses it was last rebuilt with. */
  statusKey: string;
  /** For a person: food, fuel and power in store, and what is drawn and supplied a minute. */
  stores: Stores;
  upkeep: { need: Stores; make: Stores; short: string[]; limit: number; have: number };
  /** For a person: the best authority among what they are and own, and recruits built up toward the next. */
  authority: number;
  recruiting: number;
  /** For a wild creature: prey it found it cannot reach, which it leaves alone. */
  shunned?: string;
  /** What the loadout last showed of morale, stores and command, to tell only when it changes. */
  shown: string;
  /** For a person: words that became part of their screen (shared `senseOf`): a MAP's minimap. */
  senses?: Sense[];
}

/** What a new walker's mind and stores start as. */
function freshMind(moraleBase: number, person: boolean) {
  return {
    morale: moraleBase, moraleBase, moraleGoal: moraleBase, intelligence: 0, fleeing: false, fleeFrom: null, order: null, defiant: false,
    hungry: false, hungerLost: 0, statusKey: "", stores: person ? { ...STARTING_STORES } : noStores(),
    upkeep: { need: noStores(), make: noStores(), short: [], limit: 0, have: 0 }, authority: 0, recruiting: 0, shown: "",
  };
}

/** What a person owns besides what they carry. */
interface Holdings { creatures: [string, Walker][]; things: [string, Gear][] }

/** An object's letter output: rate per minute and the fraction built up so far. */
interface Producer { owner: string; rates: Letters; built: Letters }

/**
 * A starting hand: eight letters around one word that produces something (shared `starterHand`).
 * LETTERS=9 is for trying things out: that many of every letter.
 */
function starterLetters(dict: Dictionary, rng: () => number): Letters {
  const plenty = Number(process.env.LETTERS);
  if (plenty > 0) return Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, plenty]));
  return starterHand(dict, rng);
}

/** Cell width, in tiles, of the grid that things are bucketed into. */
const THING_CELL = 16;
const thingKey = (x: number, y: number) => Math.floor(x / THING_CELL) * 4096 + Math.floor(y / THING_CELL);

/** What a bot remembers between thoughts. */
interface BotMind {
  difficulty: Difficulty;
  /** Spreads bots' thinking over the ticks. */
  phase: number;
  /** Gathers left before it moves on. */
  stay: number;
  /** Words it was refused, so it does not try them again. */
  tried: Set<string>;
  /** Where it stood at its last thought, and how many thoughts it has not moved while walking. */
  at: Point;
  stuck: number;
  /** For tests and metrics: gathers started and words spelled. */
  gathered: number;
  spelled: number;
  /** Room time until which it only gathers, hunts and builds (it still defends itself). */
  peaceUntil: number;
  /** Room time before which it spells nothing more. */
  nextSpell: number;
  /** Producers it has spelled. */
  producers: number;
}

/** Seconds a bot keeps the peace at the start: between these two. */
const BOT_PEACE: [number, number] = [60, 90];
/** Seconds between a bot's spellings: between these two. */
const BOT_SPELL_GAP: [number, number] = [5, 10];

/** Every live room in this process, for metrics. */
export const liveRooms = new Set<WorldRoom>();

/**
 * One blow, as clients are told it (`hits`): attacker and target ids (an area's key strikes as
 * itself, with its middle in x, y), damage done, the layer that took it ("" the body; else the
 * armor, shield or vehicle), how it landed, and whether it was struck from range.
 */
export interface Hit { by: string; on: string; amount: number; layer: string; kind: "hit" | "crit" | "miss" | "blocked"; ranged: boolean; x?: number; y?: number }

export interface RoomMetrics { ticks: number; tickMsTotal: number; tickMsMax: number }

/** Counts for the load test's metrics line. */
export interface RoomCounts { people: number; creatures: number; things: number }

/** One map instance. The room owns all state; clients only send intents. */
export class WorldRoom extends Room {
  state = new WorldState();
  maxClients = 100;
  patchRate = 1000 / TICK_HZ;

  map!: WorldMap;
  /** For tests: rooms created while this is set use it as their random seed. */
  static testSeed: number | null = null;
  /** For tests of other systems: rooms created while this is set get no markets, temple, caches, ruins, animals or exploring. */
  static testBare = false;
  private bare = false;
  /** Bot players by id, and how many have been made. */
  private bots = new Map<string, BotMind>();
  private botCount = 0;
  metrics: RoomMetrics = { ticks: 0, tickMsTotal: 0, tickMsMax: 0 };
  /** Blows struck this tick, sent to those who can see them at its end (`flushHits`). */
  private hits: Hit[] = [];
  private tickErrors = 0;
  private dict!: Dictionary;
  private rng = seeded(Date.now());
  private walkers = new Map<string, Walker>();
  private tickCount = 0;
  private thingGrid = new Map<number, string[]>();
  private nextThing = 1;
  private producers = new Map<string, Producer>();
  /** What gathering finds where, and how much is left (shared `Deposits`); caches and the temple are its sites. */
  deposits!: Deposits;
  /** The tiles everyone can reach each other on, for placing people and sources. */
  private land!: Uint8Array;
  /** Each market's trades in hand and when that was last counted. */
  private markets = new Map<string, { stock: number; at: number }>();
  /** What each thing on the ground is, so it can be picked up again. */
  private grounded = new Map<string, Gear>();
  private everJoined = 0;
  /** Things on the ground that have been attacked, with the damage they carry. */
  private thingEntities = new Map<string, Entity>();
  /** Seconds this room has run. */
  private elapsed = 0;
  private routesLeft = ROUTES_PER_TICK;
  private areas = new Map<string, Area>();
  /** The weather in force over the whole map, if any. */
  private weather: Effect | null = null;
  /** What the weather does to letters and acts everywhere (MONSOON: O ×3), or null. */
  private weatherRules: PlaceRules | null = null;
  /** Room time the daylight a sky word set runs out and what it was before, or null if it lasts. */
  private daylightEnds: { at: number; back: string } | null = null;
  /** People whose letters changed this tick and are told at its end. */
  private lettersChanged = new Set<string>();
  /** Areas each radiating thing gives off, by what radiates: a Gear, or a walker's body. */
  private radiating = new Map<object, Radiating>();
  /** What radiates from each walker or thing, by its id. */
  private radiators = new Map<string, Set<object>>();
  /** When a radiating thing's field runs out (its field_duration), fixed when it first radiates. */
  private radiantUntil = new WeakMap<object, number>();
  /** Fields were made or ended: work out again who stands in which on the next tick. */
  private fieldsDirty = false;
  /** People whose loadout changed through a rebuild, told once at the end of the tick. */
  private toTell = new Set<string>();
  /** Creatures whose nerve changed this tick, by owner: "name|how" -> how many. */
  private moods = new Map<string, Map<string, number>>();
  /** Room time of the last `beat`. */
  private lastBeat = 0;
  /** What each carried or grounded thing is, resolved once, for upkeep and command. */
  private resolved = new WeakMap<Gear, { count: number; stats: Stats }>();
  /** People knocked out, by session id: whom they watch (their killer, then their killer's killer) and what of it they were sent. */
  private watchers = new Map<string, { watch: string; seen: Set<string>; seenThings: Set<string> }>();
  /** The shortest words that make each supply, for "out of fuel" hints. */
  private suppliers = new Map<Supply, string[]>();

  messages = {
    /** Walk toward a point on the map. */
    move: (client: Client, to: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      const p = to as Partial<Point> | null;
      if (!walker || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const clamp = (v: number) => Math.min(this.map.size - 1e-3, Math.max(0, v));
      walker.target = { x: clamp(p.x!), y: clamp(p.y!) };
      // A person's new destination replaces the old route at once. Kept, it would walk on to where
      // the last key press aimed and then turn back (the route is otherwise only searched again
      // once the target has drifted two tiles, which suits chasing, not steering).
      // Open ground (the usual case for steering) needs no search.
      const open = walker.flying || clearLine(this.map, walker.player, walker.target);
      walker.route = open ? [walker.target] : [];
      walker.routeTo = open ? { ...walker.target } : null;
      walker.routeAge = 0;
      walker.gathering = 0;
      walker.foe = null; // walking away breaks off an attack
    },
    /** Stop where you stand now (arrow keys released). The server's position, not the client's older copy. */
    stop: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      walker.target = null;
      walker.route = [];
      walker.routeTo = null;
    },
    /** Stand still and gather a letter from the ground. */
    gather: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker || walker.gathering > 0) return;
      // Nothing to find here: say so at once rather than after the wait.
      const problem = this.deposits.problem(walker.player.x, walker.player.y, this.elapsed);
      if (problem) return void client.send("refused", problem);
      walker.target = null;
      walker.route = [];
      walker.gathering = GATHER_SECONDS;
      client.send("gathering", GATHER_SECONDS);
    },
    /** Pick up the nearest thing of your own, or nobody's, from the ground. */
    take: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      let best: string | null = null, bestDistance = TAKE_RANGE;
      this.state.things.forEach((t, id) => {
        const d = Math.hypot(t.x - walker.player.x, t.y - walker.player.y);
        const free = t.owner === client.sessionId || t.owner === "";
        if (free && d <= bestDistance && this.grounded.has(id) && !this.grounded.get(id)!.terrain) { best = id; bestDistance = d; }
      });
      // A mount of your own walking with you: get back on it.
      const mount = [...this.walkers].find(([, c]) => c.master === client.sessionId && c.unit.body.stats.flag("mountable") &&
        Math.hypot(c.player.x - walker.player.x, c.player.y - walker.player.y) <= TAKE_RANGE);
      if (mount && !walker.gear.some((g) => g.vehicle)) {
        const [cid, c] = mount;
        const ride: Gear = { spelled: { ...c.body, ...(c.player.count > 1 ? { count: c.player.count } : {}) }, phrase: c.player.name, vehicle: true, integrity: c.hp };
        const problem = this.equip(walker, ride);
        if (problem) return void client.send("refused", problem);
        this.unradiateAll(cid);
        this.walkers.delete(cid);
        this.state.players.delete(cid);
        for (const o of this.walkers.values()) { if (o.foe === cid) o.foe = null; if (o.picked === cid) o.picked = null; }
        this.tell(walker);
        return void this.refreshViews();
      }
      if (!best) return void client.send("refused", "Nothing of yours to pick up here");
      const gear = this.grounded.get(best)!;
      // Anything light enough is carried in a free hand as an improvised weapon (shared `improvised`).
      const stats = this.statsOf(gear);
      const loose = !gear.vehicle && improvisable(stats);
      const fixed = !stats.flag("portable") || (!gear.vehicle && stats.get("equip_slot") === "none" && (!loose || !!cannotCarry(stats, walker.unit.body.stats, gear.phrase)));
      // Nobody's and too big to carry (a RUIN, an abandoned HOUSE): standing by it and taking it makes it yours.
      if (fixed && this.state.things.get(best)!.owner === "") return void this.claim(client.sessionId, walker, best, gear);
      const problem = (loose && cannotCarry(stats, walker.unit.body.stats, gear.phrase)) || this.equip(walker, gear);
      if (problem) return void client.send("refused", problem);
      this.removeThing(best);
      this.tell(walker);
      client.send("notice", `${gear.phrase.toUpperCase()} ${loose ? "in hand" : "equipped"}`);
      this.refreshViews();
    },
    /**
     * Get off what you ride. It stays yours: a machine (a CAR, a TRAIN) stays on the ground where
     * you got off, a living mount (a HORSE, an ASS) walks with you as a creature. E gets back on.
     */
    dismount: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      const at = walker.gear.findIndex((g) => g.vehicle);
      if (at < 0) return void client.send("refused", "You are not riding anything");
      const [ride] = walker.gear.splice(at, 1);
      this.rebuild(walker);
      const { x, y } = walker.player;
      if (this.statsOf(ride!).flag("alive")) {
        this.addCreature(ride!, client.sessionId, x + 0.6, y, ride!.spelled.count ?? 1, ride!.integrity ?? undefined);
        this.command(client.sessionId);
      } else this.addThing(ride!, client.sessionId, x + 0.6, y);
      this.tell(walker);
      client.send("notice", `Off ${ride!.phrase.toUpperCase()} (E: back on)`);
      this.refreshViews();
    },
    /** Put down something you carry: the one at `index`, or the last thing equipped. */
    drop: (client: Client, index: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      const at = Number.isInteger(index) && walker.gear[index as number] ? (index as number) : walker.gear.length - 1;
      const [gear] = walker.gear.splice(at, 1);
      if (!gear) return;
      this.rebuild(walker);
      this.addThing(gear, client.sessionId, walker.player.x, walker.player.y);
      this.tell(walker);
      client.send("notice", `${gear.phrase.toUpperCase()} dropped`);
      this.refreshViews();
    },
    /**
     * Use something: eat, drink or take it. `which` is the index of something carried, the id of
     * a thing on the ground in reach, or nothing for the last usable thing carried, else the
     * nearest one on the ground.
     */
    use: (client: Client, which: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      try {
        client.send("spelled", this.use(walker, which));
        this.refreshViews();
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
    /** Attack another player; the unit strikes whenever the target is in reach. Anything else stops. */
    attack: (client: Client, target: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      const ok = typeof target === "string" && target !== client.sessionId && this.walkers.get(target)?.master !== client.sessionId &&
        (this.walkers.has(target) || (this.grounded.has(target) && !this.grounded.get(target)!.terrain));
      walker.foe = ok ? (target as string) : null;
    },
    /**
     * Pick out a target for events without attacking it: { id } for a player, creature or thing,
     * { x, y } for a spot on the map, or null to clear.
     */
    pick: (client: Client, what: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      const w = what as { id?: unknown; x?: unknown; y?: unknown } | null;
      walker.picked = null;
      walker.aim = null;
      if (w && typeof w.id === "string" && (this.walkers.has(w.id) || this.state.things.has(w.id))) walker.picked = w.id;
      else if (w && Number.isFinite(w.x) && Number.isFinite(w.y)) {
        const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
        walker.aim = { x: clamp(w.x as number), y: clamp(w.y as number) };
      }
    },
    /** Hand letters to a player standing close by. */
    give: (client: Client, offer: unknown) => {
      const from = this.walkers.get(client.sessionId);
      const o = offer as { to?: unknown; letters?: unknown } | null;
      if (!from) return;
      try {
        if (!o || typeof o.to !== "string" || typeof o.letters !== "string" || !/^[a-z]{1,40}$/.test(o.letters)) {
          throw new Error("Give whom what? Try: give player2 abc");
        }
        const entry = [...this.walkers].find(([id, w]) => id !== client.sessionId && w.player.name === o.to);
        if (!entry) throw new Error(`${o.to} is not here`);
        const [toId, to] = entry;
        if (Math.hypot(to.player.x - from.player.x, to.player.y - from.player.y) > GIVE_RANGE) {
          throw new Error(`${o.to} is too far away`);
        }
        const lacking = missing(from.letters, o.letters);
        if (lacking) throw new Error(`You need ${lacking.toUpperCase().split("").join(" ")}`);
        spend(from.letters, o.letters);
        this.award(toId, to, o.letters, `from ${from.player.name}`, from.player);
        client.send("letters", from.letters);
        client.send("notice", `Gave ${o.letters.toUpperCase()} to ${o.to}`);
        const receiver = this.clients.find((c) => c.sessionId === toId);
        receiver?.send("letters", to.letters);
        receiver?.send("notice", `${from.player.name} gave you ${o.letters.toUpperCase()}`);
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
    /**
     * Adjectives spelled on their own, put on something in sight: { text, target } names a player,
     * creature or thing by id (your own id for yourself), and `gear` an index into your own gear.
     */
    describe: (client: Client, what: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      const w = what as { text?: unknown; target?: unknown; gear?: unknown } | null;
      if (!walker || !w) return;
      try {
        this.describeWord(client.sessionId, walker, w.text, w.target, w.gear);
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
    /** Spend letters to make an object where the player stands. */
    spell: (client: Client, text: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      try {
        this.spellWord(client.sessionId, walker, text);
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
  };

  /** Sends a message to a person if they have a client; bots and creatures have none. */
  private sendTo(id: string, type: string, message: unknown) {
    this.clients.find((c) => c.sessionId === id)?.send(type, message);
  }

  /**
   * Gives letters and tells their new holder why, for the letter popup ("E · forage",
   * "H · hunted COW (+12 food)"), with where they came from. The caller sends `letters`.
   */
  private award(id: string, w: Walker, letters: string, why: string, at: Point = w.player) {
    if (!letters) return;
    addLetters(w.letters, letters);
    this.sendTo(id, "got", { letters, why, x: at.x, y: at.y });
  }

  /**
   * Spends letters on a spelling for a person (a client or a bot): makes the object, casts the
   * verb, sets off the event or field, or changes the sky. Returns what happened; throws why not.
   */
  private spellWord(id: string, walker: Walker, text: unknown): string {
    if (typeof text !== "string" || text.length > 80) throw new Error("Spell something");
    if (!walker.hamper.spells) throw new Error(`You cannot spell while you are ${STATE_WORDS[walker.hamper.muteBy!] ?? walker.hamper.muteBy}`);
    // Playtest shortcut, live for now (TODO.md: replace with a real debug server): "xxx" fills
    // every letter, whatever you hold. A server started with DEBUG=1 does the same for "debug".
    const typed = text.trim().toLowerCase();
    if (typed === CHEAT || (debugging() && typed === "debug")) {
      for (const ch of "abcdefghijklmnopqrstuvwxyz") walker.letters[ch] = DEBUG_LETTERS;
      this.sendTo(id, "letters", walker.letters);
      this.sendTo(id, "spelled", `DEBUG: ${DEBUG_LETTERS} of every letter`);
      return typed;
    }
    const deal = readTrade(text);
    if (deal) return this.trade(id, walker, deal.give, deal.get);
    const hushed = this.lawAgainst("spell", id, walker);
    if (hushed) throw new Error(`${hushed}: no spelling here`);
    const phrase = parsePhrase(this.dict, text);
    const lacking = missing(walker.letters, phrase.letters);
    if (lacking) throw new Error(`You need ${lacking.toUpperCase().split("").join(" ")}`);
    const name = [...phrase.adverbs, ...phrase.adjectives, phrase.noun].join(" ");
    const spelledAs = text.toLowerCase().trim().split(/\s+/).join(" ").toUpperCase();
    if (phrase.kind !== "object") {
      // These throw if they cannot happen, before any letters are spent.
      let done =
        phrase.kind === "verb" ? this.cast(id, walker, phrase)
        : phrase.kind === "event" ? this.happen(id, walker, phrase)
        : phrase.kind === "field" ? this.field(id, walker, phrase)
        : this.sky(id, phrase, name);
      if (phrase.kind !== "sky") done = this.withCounters(phrase.noun, done, id, walker);
      spend(walker.letters, phrase.letters);
      this.sendTo(id, "letters", walker.letters);
      this.sendTo(id, "spelled", done);
      return done;
    }
    if (phrase.count < 1) throw new Error(`${spelledAs} is none at all`);
    spend(walker.letters, phrase.letters);
    const countered = this.counter(phrase.noun);
    if (countered) this.sendTo(id, "notice", `${phrase.noun.toUpperCase()} ended ${countered} area${countered === 1 ? "" : "s"}`);
    const culled = this.exterminate(phrase.noun, id, walker);
    if (culled) this.sendTo(id, "notice", `${phrase.noun.toUpperCase()} wiped out ${culled}`);
    const done = this.make(id, walker, phrase);
    this.sendTo(id, "letters", walker.letters);
    const many = phrase.count > 1 || phrase.plural;
    const said = many ? `${spelledAs} (${phrase.count}) ${done.replace(/^is /, "are ").replace(/^runs /, "run ")}`
      : `${[...phrase.adjectives.filter((a) => !this.onlyCounts(a)), phrase.noun].join(" ").toUpperCase()} ${done}`;
    this.sendTo(id, "spelled", said);
    this.tell(walker); // what is now in reach to use
    this.refreshViews();
    return said;
  }

  /**
   * Adjectives spelled alone and put on something in the speller's sight, exactly as if it had
   * been spelled with them (shared `applyAdjectives`): a thing on the ground, a creature, a
   * person's body (yours too), or a piece of your own gear. Anyone's, not only yours: WEAK on an
   * enemy's wolf. Checks letters, sight and free adjective slots before spending anything; then
   * everyone who can see the target is sent `described` to show what changed.
   */
  describeWord(id: string, walker: Walker, text: unknown, target: unknown, gearIndex?: unknown): string {
    if (typeof text !== "string" || text.length > 80) throw new Error("Spell something");
    if (!walker.hamper.spells) throw new Error(`You cannot spell while you are ${STATE_WORDS[walker.hamper.muteBy!] ?? walker.hamper.muteBy}`);
    const read = readDescription(this.dict, text);
    if (!read) return this.spellWord(id, walker, text);
    const lacking = missing(walker.letters, read.letters);
    if (lacking) throw new Error(`You need ${lacking.toUpperCase().split("").join(" ")}`);
    const words = read.adjectives.join(" ").toUpperCase();
    if (typeof target !== "string") throw new Error(`Click something for ${words}`);
    const shown = (adjectives: readonly string[], noun: string) => [...adjectives.filter((a) => !this.onlyCounts(a)), noun].join(" ");
    const other = this.walkers.get(target), thing = this.state.things.get(target), gear = this.grounded.get(target);
    const at = other?.player ?? thing;
    if (!at) throw new Error(`Nothing there for ${words}`);
    if (Math.hypot(at.x - walker.player.x, at.y - walker.player.y) > Math.max(1.5, walker.sight)) throw new Error(`Too far away for ${words}: it must be in sight`);
    const ownGear = target === id && Number.isInteger(gearIndex) ? walker.gear[gearIndex as number] : undefined;
    if (ownGear) {
      // A piece of your own gear: rebuilt with its damage kept in proportion.
      const before = this.statsOf(ownGear).num("integrity");
      const done = applyAdjectives(this.dict, ownGear.spelled, read.adjectives);
      const kept = ownGear.integrity === null ? null : ownGear.integrity / before;
      const old = { spelled: ownGear.spelled, phrase: ownGear.phrase };
      ownGear.spelled = done.spelled;
      this.resolved.delete(ownGear);
      ownGear.phrase = shown(done.spelled.adjectives!, done.spelled.noun);
      ownGear.integrity = null;
      try { this.rebuild(walker); } catch (e) { Object.assign(ownGear, old); this.resolved.delete(ownGear); this.rebuild(walker); throw e; }
      const layer = walker.unit.entityFor(ownGear.spelled);
      if (layer && kept !== null) { layer.integrity = kept * layer.stats.num("integrity"); ownGear.integrity = layer.integrity; }
      return this.described(id, walker, read, target, at, old.phrase, done.changes, id);
    } else if (other) {
      if (other.unit.body.stats.flag("untargetable")) throw new Error(`${other.player.name.toUpperCase()} cannot be targeted`);
      const max = other.unit.body.stats.num("integrity");
      const done = applyAdjectives(this.dict, other.body, read.adjectives);
      const old = other.body;
      other.body = done.spelled;
      try { this.rebuild(other); } catch (e) { other.body = old; this.rebuild(other); throw e; }
      other.hp = (other.hp / max) * other.unit.body.stats.num("integrity");
      other.unit.body.integrity = other.hp;
      const what = other.player.name;
      if (other.master === null) other.player.traits = done.spelled.adjectives!.join(" ");
      else other.player.name = shown(done.spelled.adjectives!, done.spelled.noun);
      return this.described(id, walker, read, target, at, what, done.changes, other.master ?? target, other.master === null ? other.player.name : undefined);
    } else if (thing && gear && !gear.terrain) {
      const before = this.statsOf(gear).num("integrity");
      const done = applyAdjectives(this.dict, gear.spelled, read.adjectives);
      const kept = gear.integrity === null ? null : gear.integrity / before;
      const what = gear.phrase;
      this.unradiateAll(target);
      gear.spelled = done.spelled;
      this.resolved.delete(gear);
      gear.phrase = shown(done.spelled.adjectives!, done.spelled.noun);
      const stats = this.statsOf(gear);
      gear.vehicle = stats.flag("mountable");
      if (kept !== null) gear.integrity = kept * stats.num("integrity");
      this.thingEntities.delete(target);
      thing.phrase = gear.phrase;
      if (this.producers.has(target)) {
        const rates = production(stats);
        for (const k of Object.keys(rates)) rates[k]! *= gear.spelled.count ?? 1;
        this.producers.set(target, { owner: thing.owner, rates, built: {} });
      }
      this.radiate(gear, gear.spelled, target, thing.owner, { x: thing.x, y: thing.y }, null, Number(this.dict.base(gear.spelled.noun, "sight_range")));
      return this.described(id, walker, read, target, at, what, done.changes, thing.owner);
    }
    throw new Error(`${words} cannot be put on that`);
  }

  /** Spends the letters for adjectives put on something, tells the speller and the owner, and shows everyone in sight what changed. */
  private described(id: string, walker: Walker, read: { adjectives: string[]; letters: string }, target: string, at: Point,
    what: string, changes: string[], owner: string, person?: string): string {
    spend(walker.letters, read.letters);
    this.sendTo(id, "letters", walker.letters);
    const words = read.adjectives.join(" ").toUpperCase();
    const said = `${words} on ${person ? (target === id ? "yourself" : person) : what.toUpperCase()}${changes.length ? `: ${changes.join(", ")}` : ""}`;
    this.sendTo(id, "spelled", said);
    const victim = person ? target : owner;
    if (victim && victim !== id && victim !== "-") this.sendTo(victim, "notice", `${walker.player.name} put ${words} on ${person ? "you" : `your ${what.toUpperCase()}`}`);
    const effect = { target, x: at.x, y: at.y, words, what: what.toUpperCase(), changes };
    for (const c of this.clients) {
      const w = this.walkers.get(c.sessionId);
      if (w && (c.sessionId === id || Math.hypot(w.player.x - at.x, w.player.y - at.y) <= w.sight)) c.send("described", effect);
    }
    this.tell(walker);
    this.refreshViews();
    return said;
  }

  onCreate(options?: unknown) {
    // The room decides its own seed; only the first client's bots and difficulty are heard.
    if (WorldRoom.testSeed !== null) this.rng = seeded(WorldRoom.testSeed);
    const seed = Math.floor(this.rng() * 2 ** 32);
    this.dict = loadDictionary();
    this.map = generateMap(seed);
    this.placeSources();
    this.state.seed = seed;
    this.state.daylight = "day";
    this.state.phase = "playing";
    this.state.winner = "";
    this.state.weather = "";
    this.state.size = this.map.size;
    this.setTimestep((ms) => this.safeUpdate(ms / 1000), 1000 / TICK_HZ);
    liveRooms.add(this);
    // SEED_THINGS=5000 is for load tests: scatter that many ownerless objects over the map.
    const scatter = Number(process.env.SEED_THINGS);
    const words = ["wall", "chair", "tree", "chest", "table", "barrel", "fence", "lamp"];
    for (let i = 0; i < scatter; i++) {
      const noun = words[i % words.length]!, at = randomWalkable(this.map, this.rng);
      this.addThing({ spelled: { noun }, phrase: noun, vehicle: false, integrity: null }, "", at.x, at.y);
    }
    // Bots fill their places at once; each one takes a seat, so humans still fit the room.
    const { bots, difficulty } = botSettings(options, this.maxClients - 1);
    this.addBots(bots, difficulty);
  }

  /**
   * The map's own letter sources (shared `placeSources`): a market in every city (T, and letters
   * at MARKET.ratio to one), the temple (Q), buried caches (X), broken ruins (D and X) and wild
   * animals to hunt (H). Ground deposits (E, O, G, U) are counted by `deposits`.
   */
  private placeSources() {
    this.deposits = new Deposits(this.map);
    this.land = mainland(this.map);
    this.bare = WorldRoom.testBare;
    if (this.bare) return;
    const places = placeSources(this.map, this.rng, this.land);
    const fixture = (noun: string, kind: NonNullable<Gear["fixture"]>, p: Point, integrity: number | null = null) =>
      this.addThing({ spelled: { noun }, phrase: noun, vehicle: false, integrity, terrain: kind !== "ruin", fixture: kind }, "", p.x, p.y);
    for (const p of places.markets) this.markets.set(fixture("market", "market", p), { stock: MARKET.stock, at: 0 });
    const temple = fixture("temple", "temple", places.temple);
    this.deposits.addSite({ id: temple, x: places.temple.x, y: places.temple.y, letter: "q", stock: TEMPLE_Q.stock, regen: TEMPLE_Q.regen, radius: SITE_RADIUS + 1 });
    for (const p of places.caches) {
      const id = fixture("chest", "cache", p);
      this.deposits.addSite({ id, x: p.x, y: p.y, letter: "x", stock: CACHE_X, regen: 0, radius: SITE_RADIUS });
    }
    for (const p of places.ruins) {
      const id = fixture("ruin", "ruin", p, RUIN_INTEGRITY);
      this.state.things.get(id)!.hp = Math.ceil((RUIN_INTEGRITY / Number(this.dict.base("ruin", "integrity"))) * 100);
    }
    for (const p of places.animals) {
      const noun = pickAnimal(this.rng);
      this.addCreature({ spelled: { noun }, phrase: noun, vehicle: false, integrity: null }, "-", p.x, p.y);
    }
  }

  /** Where a person starts: far from everyone else (shared `spawnPoint`), on ground that reaches them. */
  private spawnSpot(): Point {
    const taken = [...this.walkers.values()].filter((w) => w.master === null).map((w) => w.player);
    return spawnPoint(this.map, this.land, taken, this.rng);
  }

  /** Adds bot players: people with no client, playing at the given difficulty. */
  addBots(n: number, difficulty: Difficulty) {
    if (n <= 0) return;
    wordBook(this.dict); // worked out once, before the first tick that needs it
    for (let i = 0; i < n; i++) {
      const id = `bot${++this.botCount}`;
      this.addPerson(id, id, this.spawnSpot());
      this.bots.set(id, {
        difficulty, phase: this.botCount, stay: 3 + Math.floor(this.rng() * 6), tried: new Set(), gathered: 0, spelled: 0, at: { x: 0, y: 0 }, stuck: 0,
        peaceUntil: this.elapsed + BOT_PEACE[0] + this.rng() * (BOT_PEACE[1] - BOT_PEACE[0]), nextSpell: this.elapsed + this.rng() * BOT_SPELL_GAP[1], producers: 0,
      });
    }
    this.maxClients = Math.max(1, this.maxClients - n);
  }

  onDispose() {
    liveRooms.delete(this);
  }

  onJoin(client: Client) {
    const walker = this.addPerson(client.sessionId, `player${this.clients.length}`);
    client.send("letters", walker.letters);
    this.tell(walker);
    client.view = new StateView();
    client.view.add(walker.player);
  }

  /** Puts a person in the world: a human body at a random spot with a starting hand of letters. */
  private addPerson(id: string, name: string, at?: Point): Walker {
    this.everJoined++;
    const unit = new Unit(this.dict, { body: { noun: "human" } });
    const body = unit.body.stats;
    // CROWD=1 is for load tests: everyone starts in the first city, in sight of each other.
    const city = this.map.cities[0];
    const spot = at ?? (process.env.CROWD && city
      ? { x: city.x + (this.rng() - 0.5) * 6, y: city.y + (this.rng() - 0.5) * 6 }
      : this.spawnSpot());
    const player = new Player();
    player.name = name;
    player.x = spot.x;
    player.y = spot.y;
    player.hp = 100;
    player.gear = "";
    player.owner = "";
    player.status = "";
    player.count = 1;
    player.traits = "";
    this.state.players.set(id, player);
    this.walkers.set(id, {
      id: id,
      player,
      body: { noun: "human" },
      master: null,
      unit,
      gear: [],
      hp: unit.body.integrity,
      foe: null,
      picked: null,
      aim: null,
      cooldown: 0,
      buffs: [],
      flying: false,
      target: null,
      route: [],
      routeTo: null,
      routeAge: 0,
      speed: body.num("speed_land"),
      sight: body.num("sight_range") / TILE_METERS,
      seen: new Set([id]),
      seenThings: new Set(),
      letters: starterLetters(this.dict, this.rng),
      ...(this.bare ? {} : { explored: new Set([regionOf(spot.x, spot.y)]) }),
      gathering: 0,
      statuses: [],
      hamper: hampered([]),
      dot: 0,
      ...freshMind(body.num("morale"), true),
    });
    return this.walkers.get(id)!;
  }

  /**
   * A connection that drops (a network blip, a laptop lid) keeps its place for RECONNECT_SECONDS:
   * the client reconnects on its own and plays on. Only then does it leave.
   */
  onDrop(client: Client) {
    if (this.walkers.has(client.sessionId) || this.watchers.has(client.sessionId)) this.allowReconnection(client, RECONNECT_SECONDS);
  }

  /** Back after a drop: what it sees is sent afresh, with its letters and loadout. */
  onReconnect(client: Client) {
    const walker = this.walkers.get(client.sessionId);
    if (!client.view) client.view = new StateView();
    const record = walker ?? this.watchers.get(client.sessionId);
    if (record) { record.seen = new Set(); record.seenThings = new Set(); }
    if (walker) {
      client.view.add(walker.player);
      walker.seen = new Set([client.sessionId]);
      client.send("letters", walker.letters);
      this.tell(walker);
    }
    this.refreshViews();
  }

  onLeave(client: Client) {
    for (const w of this.walkers.values()) {
      if (w.foe === client.sessionId) w.foe = null;
      if (w.master === client.sessionId) { w.master = "-"; w.player.owner = "-"; this.showStatus(w); }
    }
    this.walkers.delete(client.sessionId);
    this.watchers.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.unradiateAll(client.sessionId);
  }

  /** Where a carried thing goes: its own `equip_slot`, "ride" for a vehicle, "held" for a thing with no slot (a STONE in the hand). */
  private slotOf(g: Gear): string {
    if (g.vehicle) return "ride";
    const slot = String(this.dict.base(g.spelled.noun, "equip_slot"));
    return slot === "none" ? "held" : slot;
  }

  /**
   * Puts gear on a walker and rebuilds its unit. Returns null on success, or why it cannot be
   * equipped (no free hand, slot taken, already riding).
   */
  equip(walker: Walker, gear: Gear): string | null {
    const slot = this.slotOf(gear);
    if (gear.vehicle) {
      const why = cannotRide(this.statsOf(gear), gear.phrase);
      if (why) return why;
    }
    if (slot !== "held" && slot !== "graft" && walker.gear.some((g) => this.slotOf(g) === slot)) {
      return slot === "ride" ? "You are already riding something" : `You already wear something on your ${slot}`;
    }
    walker.gear.push(gear);
    try {
      this.rebuild(walker);
      return null;
    } catch (e) {
      walker.gear.pop();
      this.rebuild(walker);
      return (e as Error).message;
    }
  }

  /** Rebuilds a walker's unit from its gear, keeping the damage each piece has taken. */
  rebuild(walker: Walker) {
    const unit = new Unit(this.dict, {
      body: walker.body,
      items: walker.gear.filter((g) => !g.vehicle).map((g) => g.spelled),
      riding: walker.gear.find((g) => g.vehicle)?.spelled,
      effects: [...(this.weather ? [this.weather] : []), ...(walker.fields ?? []), ...walker.buffs, ...statusEffects(walker.statuses)],
    });
    unit.body.integrity = walker.hp;
    for (const g of walker.gear) {
      const layer = unit.entityFor(g.spelled);
      if (!layer) continue;
      if (g.integrity === null) g.integrity = layer.integrity;
      else layer.integrity = g.integrity;
    }
    walker.unit = unit;
    const body = unit.body.stats;
    walker.intelligence = body.num("intelligence");
    // Morale only means something to the living; it falls at once (FEAR, a dragon's aura) and climbs back in `beat`.
    walker.moraleGoal = body.flag("alive") ? moraleGoal(walker.moraleBase, body.num("morale"), courageOf(body)) : NORMAL;
    if (walker.moraleGoal < walker.morale) { walker.morale = walker.moraleGoal; this.nerve(walker); }
    const air = unit.movement.num("speed_air");
    walker.flying = air > 0;
    walker.speed = Math.max(unit.movement.num("speed_land"), air);
    // A ridden machine out of fuel or power goes nowhere (and comes down) until it is fed again.
    if (unit.riding && walker.gear.find((g) => g.vehicle)?.stalled) { walker.flying = false; walker.speed = 0; }
    const dark = this.state.daylight === "night" && !unit.body.stats.flag("night_vision");
    walker.sight = (unit.body.stats.num("sight_range") * (dark ? NIGHT_SIGHT : 1)) / TILE_METERS;
    walker.player.gear = [...walker.gear.map((g) => g.phrase), ...walker.buffs.map((b) => b.word.toUpperCase())].join(", ");
    if (!walker.flying) {
      const ground = openGround(this.map, walker.player); // coming down over water puts you ashore, with room to walk
      if (ground !== walker.player) { walker.player.x = ground.x; walker.player.y = ground.y; walker.target = null; }
    }
    this.syncRadiation(walker);
    // Told at the end of the tick, once, however many times it was rebuilt (fields, a fleeing pack).
    this.toTell.add(walker.master ?? walker.id);
    if (walker.master === null) this.toTell.add(walker.id);
  }

  /** The carried thing a walker strikes with: what it rides, if that has weapons, else what it holds. */
  private strikesWith(w: Walker): Gear | undefined {
    const unit = w.unit;
    if (unit.riding && unit.attack === unit.riding.stats) return w.gear.find((g) => g.vehicle);
    return unit.weapon ? w.gear.find((g) => g.spelled === unit.weapon) : undefined;
  }

  /** Sends a person the private detail of their own character. */
  private tell(walker: Walker) {
    if (walker.master !== null) return;
    const client = this.clients.find((c) => c.sessionId === walker.id);
    if (!client) return;
    const unit = walker.unit, attack = unit.attack, riding = walker.gear.find((g) => g.vehicle && unit.riding);
    const held = walker.gear.find((g) => g.spelled === unit.weapon);
    const detail: LoadoutDetail = {
      health: { now: Math.max(0, Math.round(walker.hp)), max: unit.body.stats.num("integrity") },
      speed: walker.speed,
      sight: Math.round(walker.sight * TILE_METERS),
      flying: walker.flying,
      attack: {
        with: riding && attack === unit.riding?.stats ? riding.phrase : held?.phrase ?? "bare hands",
        damage: Object.fromEntries(
          attack.entries().filter(([k, v]) => k.startsWith("dmg_") && typeof v === "number" && v > 0).map(([k, v]) => [k.slice(4), Math.round(v as number)]),
        ),
        rate: attack.num("attack_rate"),
        reach: attack.num("attack_range"),
      },
      gear: walker.gear.map((g, index) => {
        const layer = unit.entityFor(g.spelled);
        return {
          index, phrase: g.phrase, slot: this.slotOf(g),
          integrity: layer ? Math.max(0, Math.round(layer.integrity)) : null,
          max: layer ? layer.stats.num("integrity") : null,
          usable: this.usable(g),
        };
      }),
      nearby: this.usableNear(walker).map(([id, g]) => ({ id, phrase: g.phrase })),
      effects: [
        ...walker.buffs.map((b) => ({ word: b.word, left: Math.round(b.until - this.elapsed) })),
        ...(walker.fields ?? []).map((f) => ({ word: f.word, left: -1 })), // -1: while you stand in it
      ],
      statuses: walker.statuses.map((a) => ({ status: a.status, left: Math.ceil(a.left) })),
      morale: Math.round(walker.morale * 10) / 10,
      stores: Object.fromEntries(SUPPLIES.map((k) => [k, {
        have: Math.round(walker.stores[k] * 100) / 100, need: Math.round(walker.upkeep.need[k] * 100) / 100, make: Math.round(walker.upkeep.make[k] * 100) / 100,
      }])) as LoadoutDetail["stores"],
      short: walker.upkeep.short,
      command: { limit: walker.upkeep.limit, have: walker.upkeep.have },
      creatures: [...this.walkers.values()].filter((w) => w.master === walker.id).map((w) => ({
        name: w.player.name, health: w.player.hp, ...(w.hungry ? { hungry: true } : {}), ...(w.fleeing ? { fleeing: true } : {}),
      })),
      senses: (walker.senses ?? []).map((x) => ({ ...x })),
    };
    client.send("loadout", detail);
  }

  /** Puts a creature in the world as a walker with no client, following its master. */
  addCreature(gear: Gear, master: string, x: number, y: number, count = 1, hp?: number): string {
    const id = `c${this.nextThing++}`;
    const unit = new Unit(this.dict, { body: gear.spelled });
    const player = new Player();
    player.name = gear.phrase;
    player.count = count;
    player.x = x + (this.rng() - 0.5);
    player.y = y + (this.rng() - 0.5);
    player.hp = 100;
    player.gear = "";
    player.owner = master;
    player.status = "";
    this.state.players.set(id, player);
    const walker: Walker = {
      id, player, body: gear.spelled, master, unit, gear: [], hp: unit.body.integrity, foe: null, picked: null, aim: null, cooldown: 0,
      buffs: [], flying: false, target: null, route: [], routeTo: null, routeAge: 0, speed: 0, sight: 0, seen: new Set(), seenThings: new Set(),
      letters: {}, gathering: 0, statuses: [], hamper: hampered([]), dot: 0,
      ...freshMind(resolveSpelled(this.dict, gear.spelled).num("morale"), false),
    };
    if (hp !== undefined) { walker.hp = hp; walker.unit.body.integrity = hp; }
    this.walkers.set(id, walker);
    this.rebuild(walker);
    if (hp !== undefined) walker.player.hp = Math.min(100, Math.ceil((hp / walker.unit.body.stats.num("integrity")) * 100));
    return id;
  }

  /**
   * What creatures do each tick. An owned one fights what its master fights if it is sentient
   * and heeds the order (shared `ignoresOrder`: obedience plus its master's authority), else
   * whoever is attacking its master (the weakest of them if it is cunning, the nearest if not),
   * and otherwise stays close. A wild one keeps to what `beat` chose for it.
   */
  private think() {
    // Who is attacking whom, worked out once: target id -> those attacking it who are not its own.
    const attackers = new Map<string, string[]>();
    for (const [id, w] of this.walkers) {
      if (w.foe && w.master !== w.foe) (attackers.get(w.foe) ?? attackers.set(w.foe, []).get(w.foe)!).push(id);
    }
    for (const [id, w] of this.walkers) {
      if (w.master === null) continue;
      if (w.master === "-") {
        if (w.foe && !this.walkers.has(w.foe)) w.foe = null;
        continue;
      }
      const master = this.walkers.get(w.master);
      if (!master) { w.foe = null; w.target = null; continue; }
      // Only a sentient creature can follow an order; any creature defends its master.
      let order = w.unit.body.stats.flag("sentient") && master.foe && master.foe !== id ? master.foe : null;
      if (order !== w.order) {
        w.order = order;
        w.defiant = order !== null && ignoresOrder(w.unit.body.stats.num("obedience"), master.authority, this.rng);
        if (w.defiant) this.clients.find((c) => c.sessionId === w.master)?.send("notice", `Your ${w.player.name.toUpperCase()} ignores your order`);
      }
      if (w.defiant) order = null;
      const threats = (attackers.get(w.master) ?? []).filter((a) => a !== id && this.walkers.get(a)?.master !== w.master);
      const foe = order ?? this.choose(w, threats);
      w.foe = foe && (this.walkers.has(foe) || this.grounded.has(foe)) ? foe : null;
      if (w.foe) continue;
      const apart = Math.hypot(master.player.x - w.player.x, master.player.y - w.player.y);
      w.target = apart > 2 ? { x: master.player.x, y: master.player.y } : null;
    }
  }

  /** Bots think at most twice a second (easy ones once), spread over the ticks by their number. */
  private thinkBots() {
    for (const [id, mind] of this.bots) {
      const w = this.walkers.get(id);
      if (!w) { this.bots.delete(id); continue; }
      const every = mind.difficulty === "easy" ? TICK_HZ : TICK_HZ / 2;
      if ((this.tickCount + mind.phase) % every === 0) this.thinkBot(id, w, mind);
    }
  }

  /**
   * One bot's thought. It eats if hungry and always defends itself. For its first minute or so
   * (`peaceUntil`) it only builds: gathers, hunts wild animals, breaks ruins, digs caches and
   * trades at markets. After that it also goes for a person in sight, or within twice its sight
   * (easy bots only when armed and close). It spells at most one word every 5 to 10 seconds,
   * producers first while at peace. Fleeing and statuses are left to minds.
   */
  private thinkBot(id: string, w: Walker, mind: BotMind) {
    if (this.state.phase === "over" || w.fleeing || w.hamper.flees.length || w.hamper.random) return;
    const hard = mind.difficulty === "hard", easy = mind.difficulty === "easy";
    const have = held(w.letters);
    const canSpell = this.elapsed >= mind.nextSpell;
    const spelled = () => { mind.spelled++; mind.nextSpell = this.elapsed + BOT_SPELL_GAP[0] + this.rng() * (BOT_SPELL_GAP[1] - BOT_SPELL_GAP[0]); };
    if (canSpell && (w.hungry || w.stores.food < 0.5) && this.botEat(id, w, mind, have)) spelled();
    const peaceful = this.elapsed < mind.peaceUntil;

    // Who is about: people (and their creatures) who attack it, people to hunt down, wild game.
    type Seen = { id: string; d: number; hp: number; person: boolean };
    const people: Seen[] = [], attackers: Seen[] = [], game: Seen[] = [];
    let mine = 0;
    for (const [oid, o] of this.walkers) {
      if (oid === id) continue;
      if (o.master === id) { mine++; continue; }
      const d = Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y);
      if (d > w.sight * 2 || (o.flying && !w.flying)) continue;
      const e = { id: oid, d, hp: o.hp, person: o.master === null };
      if (o.foe === id) attackers.push(e);
      else if (o.master === null) people.push(e);
      else if (o.master === "-" && d <= w.sight && !aggressive(o.unit.body.stats)) game.push(e);
    }
    const pick = (list: Seen[]) => list.reduce<Seen | null>((best, e) => !best ? e
      : hard ? (e.person !== best.person ? (e.person ? e : best) : e.hp < best.hp ? e : best)
      : e.d < best.d ? e : best, null)?.id ?? null;
    const armed = !!w.unit.weapon || (!!w.unit.riding && w.unit.attack === w.unit.riding.stats);
    const current = w.foe ? this.walkers.get(w.foe) ?? this.state.things.get(w.foe) : undefined;
    const at = current ? ("player" in current ? current.player : current) : undefined;
    const keep = !hard && at && Math.hypot(at.x - w.player.x, at.y - w.player.y) <= w.sight * 2;
    let foe = keep ? w.foe : null;
    if (!foe && attackers.length) foe = pick(attackers);
    else if (!foe && !peaceful && (!easy || armed)) foe = pick(people.filter((e) => e.d <= (easy ? 5 : w.sight * 2)));
    // Hunting (H) and breaking ruins (D, X) when nobody needs fighting.
    if (!foe && game.length && (armed || w.unit.attack.num("dmg_blunt") > 0)) foe = pick(game.filter((e) => e.hp <= 100 || armed));
    if (!foe) foe = this.nearFixture(w, "ruin", w.sight);
    if (foe !== w.foe) { w.foe = foe; if (foe) w.gathering = 0; }

    // One word every few seconds, the most useful it can afford; or a trade at a market.
    if (canSpell && this.elapsed >= mind.nextSpell) {
      const word = this.botWord(id, w, mind, have, armed, mine, peaceful);
      if (word) {
        if (word.use === "event") w.picked = foe;
        try { this.spellWord(id, w, word.word); spelled(); if (word.use === "producer") mind.producers++; }
        catch { if (word.use !== "event") mind.tried.add(word.word); }
        if (word.use === "event") w.picked = null;
      } else if (this.botTrade(id, w, mind, have)) spelled();
    }

    // Not getting anywhere for two seconds (a speed of nothing, a crowd): choose somewhere else.
    const moved = Math.hypot(w.player.x - mind.at.x, w.player.y - mind.at.y);
    mind.at = { x: w.player.x, y: w.player.y };
    if (w.target && !w.foe && moved < 0.05 && w.hamper.moves) {
      if (++mind.stuck >= 4) { w.target = null; w.route = []; w.routeTo = null; mind.stuck = 0; }
    } else mind.stuck = 0;

    if (w.foe || w.gathering > 0 || w.target) return;
    // A cache in sight is worth the walk; otherwise gather here while there is something to find.
    const cache = this.nearFixture(w, "cache", w.sight);
    if (cache) {
      const t = this.state.things.get(cache)!;
      if (Math.hypot(t.x - w.player.x, t.y - w.player.y) > SITE_RADIUS - 0.5) { w.target = { x: t.x, y: t.y }; return; }
    }
    const here = this.deposits.available(w.player.x, w.player.y, this.elapsed);
    if (mind.stay > 0 && Object.keys(here).length) {
      mind.stay--;
      mind.gathered++;
      w.gathering = GATHER_SECONDS;
      return;
    }
    mind.stay = 4 + Math.floor(this.rng() * 8);
    // Move on: sometimes to a city's market with letters to trade, else somewhere new (exploring gives J).
    const clamp = (v: number) => Math.min(this.map.size - 1, Math.max(0, v));
    const c = this.map.cities[Math.floor(this.rng() * this.map.cities.length)];
    if (c && (w.letters.e ?? 0) >= MARKET.ratio * 2 && this.rng() < 0.4) {
      w.target = { x: c.x + 0.5 + (this.rng() - 0.5) * 2, y: c.y + 0.5 + (this.rng() - 0.5) * 2 };
      return;
    }
    const angle = this.rng() * Math.PI * 2, far = 10 + this.rng() * 20;
    w.target = nearestWalkable(this.map, { x: clamp(w.player.x + Math.cos(angle) * far), y: clamp(w.player.y + Math.sin(angle) * far) });
  }

  /** The nearest of the map's fixtures of a kind within `tiles` of a walker, by thing id. */
  private nearFixture(w: Walker, kind: NonNullable<Gear["fixture"]>, tiles: number): string | null {
    let best: string | null = null, bestD = tiles;
    for (const [tid, g] of this.grounded) {
      if (g.fixture !== kind) continue;
      const t = this.state.things.get(tid);
      const d = t ? Math.hypot(t.x - w.player.x, t.y - w.player.y) : Infinity;
      if (d <= bestD) { best = tid; bestD = d; }
    }
    return best;
  }

  /**
   * At a market, a bot trades its commonest letters for one it lacks for the best word it wants
   * (a producer, a weapon, a creature) that it is one letter short of. Returns true if it traded.
   */
  private botTrade(id: string, w: Walker, mind: BotMind, have: Uint8Array): boolean {
    if (!this.nearFixture(w, "market", MARKET.range)) return false;
    const book = wordBook(this.dict);
    const spare = Object.entries(w.letters).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
    if (!spare || spare[1] < MARKET.ratio + 1) return false;
    for (const use of ["producer", "weapon", "armor", "creature"] as Use[]) {
      for (const word of book.byUse.get(use) ?? []) {
        if (mind.tried.has(word.word)) continue;
        let short = -1, count = 0;
        for (let i = 0; i < 26; i++) if (word.cost[i]! > have[i]!) { count += word.cost[i]! - have[i]!; short = i; }
        const ch = String.fromCharCode(97 + short);
        if (count !== 1 || MARKET.refuses.includes(ch) || ch === spare[0]) continue;
        try { this.spellWord(id, w, `trade ${spare[0].repeat(MARKET.ratio)} for ${ch}`); return true; } catch { return false; }
      }
    }
    return false;
  }

  /**
   * The word a bot most wants and can afford, in this order: a counter to an enemy area it
   * stands near (hard); at peace, producers first; then a weapon, armour for a free slot, a
   * mount, creatures, producers, healing when hurt, and in a fight (not easy) a verb that helps,
   * a field against its enemies, or an event at its foe when in reach.
   */
  private botWord(id: string, w: Walker, mind: BotMind, have: Uint8Array, armed: boolean, mine: number, peaceful: boolean): BotWord | null {
    const book = wordBook(this.dict);
    const ok = (x: BotWord) => !mind.tried.has(x.word);
    const choose = (use: Use, also: (x: BotWord) => boolean = () => true) =>
      chooseWord(book.byUse.get(use), have, mind.difficulty, this.rng, (x) => ok(x) && also(x));
    if (mind.difficulty === "hard") {
      for (const a of this.areas.values()) {
        if (a.owner === id || Math.hypot(a.x - w.player.x, a.y - w.player.y) > a.radius + 3) continue;
        const c = book.counters.get(a.word)?.find((x) => ok(x) && affords(have, x));
        if (c) return c;
      }
    }
    const slots = new Set(w.gear.map((g) => this.slotOf(g)));
    const foe = w.foe ? this.walkers.get(w.foe) : undefined;
    const fighting = mind.difficulty !== "easy" && !!foe;
    const owns = (x: BotWord) => { for (const a of this.areas.values()) if (a.owner === id && a.word === x.word) return true; return false; };
    const build = mind.producers < (peaceful ? 6 : 3) ? () => choose("producer") : () => null;
    return (peaceful ? build() : null)
      ?? (!armed ? choose("weapon") : null)
      ?? choose("armor", (x) => !slots.has(x.slot))
      ?? (!slots.has("ride") ? choose("mount") : null)
      ?? (mine < (mind.difficulty === "hard" ? 6 : 3) ? choose("creature") : null)
      ?? build()
      ?? (w.hp < w.unit.body.stats.num("integrity") * 0.6 ? choose("heal") : null)
      ?? (fighting ? choose("boost", (x) => !w.buffs.some((b) => b.word === x.word)) : null)
      ?? (fighting ? choose("field", (x) => !owns(x)) : null)
      ?? (fighting && foe ? choose("event", (x) => Math.hypot(foe.player.x - w.player.x, foe.player.y - w.player.y) <= x.reach) : null);
  }

  /** A hungry bot eats what it carries or what lies at its feet, else spells something to eat. True if it spelled. */
  private botEat(id: string, w: Walker, mind: BotMind, have: Uint8Array): boolean {
    const food = (g: Gear) => !g.terrain && this.statsOf(g).num("nutrition") > 0;
    try {
      const carried = w.gear.findIndex(food);
      if (carried >= 0) return void this.use(w, carried), false;
      const near = this.usableNear(w).find(([, g]) => food(g));
      if (near) return void this.use(w, near[0]), false;
    } catch { /* cannot eat it after all: spell something else */ }
    const word = chooseWord(wordBook(this.dict).byUse.get("food"), have, mind.difficulty, this.rng, (x) => !mind.tried.has(x.word));
    if (!word) return false;
    try { this.spellWord(id, w, word.word); return true; } catch { mind.tried.add(word.word); return false; }
  }

  /** Whom a creature goes for among walkers by id: shared `chooseTarget` by its intelligence. */
  private choose(w: Walker, ids: readonly string[]): string | null {
    const candidates: Candidate[] = [];
    for (const oid of ids) {
      const o = this.walkers.get(oid);
      if (o) candidates.push({ id: oid, distance: Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y), health: o.hp });
    }
    return chooseTarget(w.intelligence, candidates);
  }

  /** The side a walker is on: a person's own id, a creature's master, "-" for the wild. */
  private side(id: string, w: Walker): string {
    return w.master ?? id;
  }

  /** Walkers bucketed into cells NEAR_CELL tiles wide, built once a beat for `enemiesNear`. */
  private nearGrid: Map<number, { id: string; x: number; y: number; side: string }[]> | null = null;

  /** Walkers on another side within `tiles` of a walker; uses the beat's grid while there is one. */
  private enemiesNear(id: string, w: Walker, tiles: number): string[] {
    const mine = this.side(id, w), out: string[] = [];
    const grid = this.nearGrid;
    if (!grid || tiles === Infinity) {
      for (const [oid, o] of this.walkers) {
        if (oid !== id && this.side(oid, o) !== mine && Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y) <= tiles) out.push(oid);
      }
      return out;
    }
    const { x, y } = w.player, t2 = tiles * tiles;
    const reach = Math.ceil(tiles / NEAR_CELL), cx = Math.floor(x / NEAR_CELL), cy = Math.floor(y / NEAR_CELL);
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        const cell = grid.get((cx + dx) * 4096 + cy + dy);
        if (cell) for (const e of cell) if (e.side !== mine && e.id !== id && (e.x - x) ** 2 + (e.y - y) ** 2 <= t2) out.push(e.id);
      }
    }
    return out;
  }

  /** Morale or wounds changed: a walker breaks and runs, or steadies. Says so to whoever cares. */
  private nerve(w: Walker) {
    const max = w.unit.body.stats.num("integrity");
    const fleeing = routed(w.morale) || (w.master !== null && retreats(w.intelligence, w.hp, max));
    if (fleeing === w.fleeing) return;
    w.fleeing = fleeing;
    if (fleeing) { w.foe = null; w.gathering = 0; }
    this.showStatus(w);
    if (w.master === null) {
      this.clients.find((c) => c.sessionId === w.id)?.send("notice", fleeing ? "You lose your nerve and run" : "You steady yourself");
      return;
    }
    // A pack breaking is told once: gathered here and sent at the end of the tick.
    const how = !fleeing ? "steadies" : routed(w.morale) ? "breaks and runs" : "pulls back, badly hurt";
    const byOwner = this.moods.get(w.master) ?? this.moods.set(w.master, new Map()).get(w.master)!;
    const key = `${w.player.name}|${how}`;
    byOwner.set(key, (byOwner.get(key) ?? 0) + 1);
  }

  /** Tells each owner, once, which of their creatures broke, pulled back or steadied this tick. */
  private tellMoods() {
    if (!this.moods.size) return;
    for (const [owner, byWhat] of this.moods) {
      const client = this.clients.find((c) => c.sessionId === owner);
      for (const [key, n] of byWhat) {
        const [name, how] = key.split("|") as [string, string];
        const plural = how.replace(/^steadies/, "steady").replace(/^breaks and runs/, "break and run").replace(/^pulls/, "pull");
        client?.send("notice", n === 1 ? `Your ${name.toUpperCase()} ${how}` : `${n} of your ${pluralize(name).toUpperCase()} ${plural}`);
      }
    }
    this.moods.clear();
  }

  /** What shows under a walker's name: its statuses, and whether it is fleeing, hungry or wild. */
  private showStatus(w: Walker) {
    const words: string[] = [...new Set(w.statuses.map((a) => a.status))];
    if (w.fleeing && !words.includes("fear")) words.push("fleeing");
    if (w.hungry) words.push(w.master === null ? "starving" : "hungry");
    if (w.master === "-") words.push("wild");
    const text = words.join(" ");
    if (text !== w.player.status) w.player.status = text;
  }

  /** Puts a creature under someone else, or nobody ("-": wild). What it radiates changes side with it. */
  private setMaster(id: string, w: Walker, master: string) {
    const before = w.master;
    w.master = master; w.player.owner = master;
    w.foe = null; w.target = null; w.order = null; w.defiant = false; w.hungerLost = 0; w.hungry = false;
    this.unradiateAll(id);
    this.syncRadiation(w);
    this.showStatus(w);
    for (const m of [before, master]) { const p = m ? this.walkers.get(m) : undefined; if (p) this.tell(p); }
  }

  /** A carried or grounded thing's resolved properties, worked out once until its count changes. */
  private statsOf(g: Gear): Stats {
    const count = g.spelled.count ?? 1;
    const had = this.resolved.get(g);
    if (had && had.count === count) return had.stats;
    const stats = resolveSpelled(this.dict, g.spelled);
    this.resolved.set(g, { count, stats });
    return stats;
  }

  /** What each person owns besides what they carry: creatures (oldest first) and things on the ground. */
  private holdings(only?: string): Map<string, Holdings> {
    const out = new Map<string, Holdings>();
    for (const [id, w] of this.walkers) if (w.master === null && (!only || id === only)) out.set(id, { creatures: [], things: [] });
    for (const [id, w] of this.walkers) if (w.master !== null) out.get(w.master)?.creatures.push([id, w]);
    this.state.things.forEach((t, tid) => {
      const h = t.owner ? out.get(t.owner) : undefined, g = this.grounded.get(tid);
      if (h && g) h.things.push([tid, g]);
    });
    for (const h of out.values()) h.creatures.sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)));
    return out;
  }

  /** Everything that is someone's, as properties: their body, what they carry, their creatures and things. */
  private sources(w: Walker, h: Holdings): Stats[] {
    return [w.unit.body.stats, ...w.gear.map((g) => this.statsOf(g)), ...h.creatures.map(([, c]) => c.unit.body.stats), ...h.things.map(([, g]) => this.statsOf(g))];
  }

  /**
   * Command: a person keeps as many creatures as their command limit (shared `commandLimit`:
   * a handful, plus the `command_limit` of everything theirs, a KING's fifty, a CROWN's ten).
   * The newest beyond it have nobody to command them and run wild. Returns how many did.
   */
  private command(id: string, held?: Holdings): number {
    const w = this.walkers.get(id);
    const h = held ?? this.holdings(id).get(id);
    if (!w || w.master !== null || !h) return 0;
    let released = 0, limit = 0;
    for (;;) {
      const sources = this.sources(w, h);
      limit = commandLimit(sources);
      w.authority = authorityOf(sources);
      if (h.creatures.length <= limit) break;
      const [cid, c] = h.creatures.pop()!;
      this.setMaster(cid, c, "-");
      released++;
    }
    w.upkeep.limit = limit;
    w.upkeep.have = h.creatures.length;
    if (released) {
      this.clients.find((c) => c.sessionId === id)?.send("notice",
        `You can command ${limit} creature${limit === 1 ? "" : "s"}: ${released} ran wild`);
    }
    return released;
  }

  /**
   * Upkeep, for one person over `since` seconds: what they own supplies food, fuel and power
   * into their stores, then everything with a need draws on them (shared `draw`): their own body
   * first, then creatures, carried things and things on the ground. What goes short:
   * - a person starves, losing STARVING of their integrity a minute;
   * - a living thing goes hungry and loses HUNGER_LOYALTY a minute; at no loyalty left it turns
   *   wild (a ridden DRAGON throws its rider and is a creature of its own);
   * - a machine stalls: it makes nothing (no letters, food, fuel or power) and cannot strike.
   */
  private upkeep(id: string, w: Walker, h: Holdings, since: number) {
    const make = noStores(), need = noStores(), short: string[] = [];
    const client = this.clients.find((c) => c.sessionId === id);
    const tellOwner = (text: string) => client?.send("notice", text);
    const add = (to: Stores, from: Stores) => { for (const k of SUPPLIES) to[k] += from[k]; };
    const missingText = (s: Supply[]) => `no ${s.join(" or ")}`;

    // Supplies: whatever is working.
    const supplying: Stores[] = [outputs(w.unit.body.stats), ...h.creatures.map(([, c]) => outputs(c.unit.body.stats, c.player.count))];
    for (const g of [...w.gear, ...h.things.map(([, g]) => g)]) if (!g.stalled) supplying.push(outputs(this.statsOf(g), g.spelled.count ?? 1));
    for (const out of supplying) { add(make, out); supply(w.stores, out, since); }

    // A living thing's hunger: loyalty drains while it goes short and comes back while it is fed.
    const hunger = (name: string, lacking: Supply[], loyalty: number, state: { hungry: boolean; hungerLost: number }): boolean => {
      const hungry = lacking.length > 0;
      if (hungry && !state.hungry) tellOwner(`Your ${name.toUpperCase()} is hungry`);
      state.hungry = hungry;
      state.hungerLost = Math.max(0, state.hungerLost + (hungry ? 1 : -1) * HUNGER_LOYALTY * (since / 60));
      if (hungry) short.push(`${name} is hungry (${missingText(lacking)})`);
      return hungry && state.hungerLost >= loyalty;
    };

    // The person's own body.
    const own = needs(w.unit.body.stats);
    add(need, own);
    const starving = draw(w.stores, own, since).includes("food");
    if (starving !== w.hungry) {
      w.hungry = starving;
      this.showStatus(w);
      if (starving) tellOwner("You are starving: eat something, or gather where things grow");
    }
    if (starving) {
      short.push("you are starving (no food)");
      w.unit.body.integrity -= w.unit.body.stats.num("integrity") * STARVING * (since / 60);
      this.settle(id, w);
      if (w.unit.dead) { tellOwner("You starved"); this.kill(id, ""); return; }
    }

    for (const [cid, c] of h.creatures) {
      const n = needs(c.unit.body.stats, c.player.count);
      if (!hasAny(n)) continue;
      add(need, n);
      const was = c.hungry;
      if (hunger(c.player.name, draw(w.stores, n, since), c.unit.body.stats.num("loyalty"), c)) {
        tellOwner(`Your ${c.player.name.toUpperCase()} went wild with hunger`);
        this.setMaster(cid, c, "-");
      } else if (was !== c.hungry) this.showStatus(c);
    }

    const things: [Gear, string | null][] = [...w.gear.map((g): [Gear, null] => [g, null]), ...h.things.map(([tid, g]): [Gear, string] => [g, tid])];
    for (const [g, tid] of things) {
      const stats = this.statsOf(g), n = needs(stats, g.spelled.count ?? 1);
      if (!hasAny(n)) continue;
      add(need, n);
      const lacking = draw(w.stores, n, since);
      const name = g.phrase;
      if (stats.flag("alive")) {
        const state = { hungry: !!g.hungry, hungerLost: g.hungerLost ?? 0 };
        const wild = hunger(name, lacking, stats.num("loyalty"), state);
        g.hungry = state.hungry; g.hungerLost = state.hungerLost;
        if (!wild) continue;
        tellOwner(`Your ${name.toUpperCase()} went wild with hunger`);
        g.hungry = false; g.hungerLost = 0;
        if (tid === null) {
          // It throws its rider (or slips its leash) and is a creature of its own.
          w.gear.splice(w.gear.indexOf(g), 1);
          this.rebuild(w);
          this.addCreature(g, "-", w.player.x, w.player.y, g.spelled.count ?? 1, g.integrity ?? undefined);
          this.refreshViews();
        } else {
          const t = this.state.things.get(tid);
          if (t) t.owner = "";
          this.producers.delete(tid);
        }
        continue;
      }
      const stalled = lacking.length > 0;
      const until = lacking.map((k) => ({ fuel: "refuelled", power: "powered again", food: "fed" })[k]).join(" and ");
      if (stalled && !g.stalled) {
        tellOwner(`${name.toUpperCase()} out of ${lacking.join(" and ")}: stopped until ${until}.${this.supplierHint(lacking)}`);
      } else if (!stalled && g.stalled) tellOwner(`Your ${name.toUpperCase()} is working again`);
      const changed = g.stalled !== stalled;
      g.stalled = stalled;
      if (changed && tid === null) this.rebuild(w); // a ridden machine stops (or goes again)
      if (stalled) short.push(`${name} out of ${lacking.join(" and ")}: stopped`);
    }
    w.upkeep.need = need;
    w.upkeep.make = make;
    w.upkeep.short = short;
  }

  /** " Spell COAL or OIL for fuel." The shortest words that supply what ran short, from the dictionary. */
  private supplierHint(lacking: Supply[]): string {
    const hints = lacking.map((k) => {
      let words = this.suppliers.get(k);
      if (!words) {
        words = [...this.dict.words].filter(([, d]) => d.role === "noun" && Number(d.set[`${k}_output`] ?? 0) > 0).map(([w]) => w)
          .sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 2);
        this.suppliers.set(k, words);
      }
      return words.length ? ` ${words.map((w) => w.toUpperCase()).join(" or ")} makes ${k}.` : "";
    });
    return hints.join("");
  }

  /**
   * Recruiting: what a person owns draws `recruit_rate` wild creatures a minute to them, the
   * nearest in their sight first, while they have command to spare.
   */
  private recruit(id: string, w: Walker, h: Holdings, since: number) {
    const rate = recruitRate(this.sources(w, h));
    if (!(rate > 0)) { w.recruiting = 0; return; }
    w.recruiting += (rate * since) / 60;
    while (w.recruiting >= 1) {
      const wild = [...this.walkers].filter(([, c]) => c.master === "-" && Math.hypot(c.player.x - w.player.x, c.player.y - w.player.y) <= w.sight);
      const pick = chooseTarget(0, wild.map(([cid, c]) => ({ id: cid, distance: Math.hypot(c.player.x - w.player.x, c.player.y - w.player.y), health: c.hp })));
      if (!pick || w.upkeep.have >= w.upkeep.limit) { w.recruiting = Math.min(w.recruiting, 1); return; }
      const c = this.walkers.get(pick)!;
      this.setMaster(pick, c, id);
      h.creatures.push([pick, c]);
      w.upkeep.have++;
      w.recruiting -= 1;
      this.clients.find((cl) => cl.sessionId === id)?.send("notice", `A wild ${c.player.name.toUpperCase()} joins you`);
    }
  }

  /** A wild creature: an aggressive one goes for whoever it sees (shared `chooseTarget`); the rest wander. */
  private roam(id: string, w: Walker) {
    if (w.fleeing) return;
    if (aggressive(w.unit.body.stats)) {
      // Prey it can get at: not what it gave up on, and nothing in the air unless it flies too.
      const prey = this.enemiesNear(id, w, Math.max(1, w.sight)).filter((oid) => oid !== w.shunned && (w.flying || !this.walkers.get(oid)!.flying));
      w.foe = this.choose(w, prey);
      if (w.foe) return;
    } else w.foe = null;
    if (!w.target && w.hamper.moves && this.rng() < 0.3) {
      const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
      const to = { x: clamp(w.player.x + (this.rng() * 2 - 1) * CONFUSED_TILES), y: clamp(w.player.y + (this.rng() * 2 - 1) * CONFUSED_TILES) };
      if (w.flying || clearLine(this.map, w.player, to)) w.target = to; // ambling in plain view: no route to search
    }
  }

  /**
   * Once a second: morale climbs back toward where it is heading, the broken and the badly hurt
   * run from their nearest enemy, every person's command, upkeep and recruiting is counted, and
   * wild creatures choose what to do.
   */
  private beat(since: number) {
    this.state.alive = this.people.length;
    this.state.clock = Math.floor(this.elapsed);
    this.nearGrid = new Map();
    for (const [id, w] of this.walkers) {
      const k = Math.floor(w.player.x / NEAR_CELL) * 4096 + Math.floor(w.player.y / NEAR_CELL);
      (this.nearGrid.get(k) ?? this.nearGrid.set(k, []).get(k)!).push({ id, x: w.player.x, y: w.player.y, side: this.side(id, w) });
    }
    for (const [id, w] of this.walkers) {
      if (w.morale < w.moraleGoal) w.morale = nextMorale(w.morale, w.moraleGoal, since);
      this.nerve(w);
      // Keep running from the same enemy while it is still near; else find the nearest.
      const from = w.fleeing && w.fleeFrom ? this.walkers.get(w.fleeFrom) : undefined;
      if (from && Math.hypot(from.player.x - w.player.x, from.player.y - w.player.y) <= Math.max(w.sight, FLEE_TILES)) continue;
      if (w.fleeing) w.fleeFrom = chooseTarget(0, this.enemiesNear(id, w, Math.max(w.sight, FLEE_TILES)).map((oid) => {
        const o = this.walkers.get(oid)!;
        return { id: oid, distance: Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y), health: o.hp };
      }));
    }
    for (const [id, h] of this.holdings()) {
      const w = this.walkers.get(id);
      if (!w) continue;
      this.command(id, h);
      this.upkeep(id, w, h, since);
      if (!this.walkers.has(id)) continue;
      this.recruit(id, w, h, since);
      const round = (n: number) => Math.round(n * 10) / 10;
      const shown = JSON.stringify([round(w.morale), SUPPLIES.map((k) => round(w.stores[k])), w.upkeep.short, w.upkeep.limit, w.upkeep.have,
        h.creatures.map(([, c]) => `${c.hungry}${c.fleeing}`)]);
      if (shown !== w.shown) { w.shown = shown; this.tell(w); }
    }
    for (const [id, w] of [...this.walkers]) if (w.master === "-") this.roam(id, w);
    for (const [id, w] of this.walkers) if (w.senses?.length) this.sendSensed(id, w);
    this.nearGrid = null; // walkers move between beats
  }

  /**
   * What a person's senses (a MAP, a COMPASS) pick up around them, for their minimap: living things
   * within `detect_life`, and things that make letters within `detect_letters`.
   */
  private sendSensed(id: string, w: Walker) {
    const client = this.clients.find((c) => c.sessionId === id);
    if (!client || !w.senses?.length) return;
    const { letters, life } = combineSenses(w.senses);
    const near = (p: Point, r: number) => Math.hypot(p.x - w.player.x, p.y - w.player.y) <= r;
    const at = (v: number) => Math.round(v * 10) / 10;
    const out: Sensed = { life: [], letters: [] };
    if (life > 0) {
      for (const [oid, o] of this.walkers) {
        if (oid !== id && o.unit.body.stats.flag("alive") && near(o.player, life)) {
          out.life.push({ x: at(o.player.x), y: at(o.player.y), mine: o.master === id, person: o.master === null });
        }
      }
    }
    if (letters > 0) {
      for (const [pid, p] of this.producers) {
        const t = this.state.things.get(pid);
        if (t && near(t, letters)) out.letters.push({ x: at(t.x), y: at(t.y), letters: Object.keys(p.rates).join("") });
      }
    }
    client.send("sensed", out);
  }

  get counts(): RoomCounts {
    const people = this.people.length;
    return { people, creatures: this.walkers.size - people, things: this.state.things.size };
  }

  /**
   * Ends the round: nobody new may join, everyone is told who won, and after a pause the room
   * closes. Clients then join a fresh room with a new map.
   */
  private endRound(winner: string) {
    if (this.state.phase === "over") return;
    this.state.phase = "over";
    this.state.winner = winner;
    void this.lock();
    this.broadcast("roundover", { winner, seconds: ROUND_END_SECONDS });
    this.clock.setTimeout(() => void this.disconnect(), ROUND_END_SECONDS * 1000);
  }

  /**
   * True for a person steered by a client. Their route searches never wait on the per-tick budget:
   * with many bots and creatures searching first, a person's search could wait tick after tick,
   * and steering (which asks for a new route ten times a second) went nowhere.
   */
  private steered(w: Walker): boolean {
    return w.master === null && !this.bots.has(w.id);
  }

  /** Moves a walker along a route to its target, going around anything it cannot cross. */
  private walk(w: Walker, seconds: number) {
    const target = w.target!;
    // A wild creature that is only wandering ambles; it runs only to chase or to flee. At full
    // speed a grazing PIG, as fast as a person, could never be caught.
    const speed = w.master === "-" && !w.foe && !w.fleeing && !w.hamper.flees.length ? w.speed * AMBLE_PACE : w.speed;
    if (w.flying) {
      if (stepToward(this.map, w.player, target, speed, seconds, true)) w.target = null;
      return;
    }
    w.routeAge += seconds;
    // A chased target moves: work the route out again once it has moved two tiles, at most once a second.
    const drift = w.routeTo ? Math.hypot(w.routeTo.x - target.x, w.routeTo.y - target.y) : Infinity;
    // A dim creature (shared `rerouteSeconds`) is slow to see that its quarry has moved.
    const every = w.master === null ? 1 : rerouteSeconds(w.intelligence);
    if ((drift === Infinity || (drift > 2 && w.routeAge > every)) && (this.routesLeft > 0 || this.steered(w))) {
      this.routesLeft--;
      // Aim for ground: asking for the sea should walk you to the shore, not search the whole map.
      w.route = findPath(this.map, w.player, nearestWalkable(this.map, target));
      // A wild creature that cannot reach its prey gives it up rather than search again every tick.
      const end = w.route.at(-1) ?? w.player;
      if (w.master === "-" && w.foe && Math.hypot(end.x - target.x, end.y - target.y) > 2) {
        w.shunned = w.foe; w.foe = null; w.target = null; w.route = []; w.routeTo = null;
        return;
      }
      w.routeTo = { ...target };
      w.routeAge = 0;
    }
    let left = seconds;
    while (left > 0 && w.route.length) {
      const before = { x: w.player.x, y: w.player.y };
      const leg = w.route[0]!;
      const arrived = stepToward(this.map, w.player, leg, speed, left);
      if (!arrived) return;
      if (Math.hypot(w.player.x - leg.x, w.player.y - leg.y) > 1e-3) {
        // Blocked short of the waypoint (a corner it cannot cut): first to the middle of its own
        // tile, from where the route's legs are clear. Already there: search again, and give up
        // after a few searches that lead nowhere rather than search every tick.
        const centre = { x: Math.floor(w.player.x) + 0.5, y: Math.floor(w.player.y) + 0.5 };
        if (Math.hypot(w.player.x - centre.x, w.player.y - centre.y) > 1e-3) w.route.unshift(centre);
        else {
          w.routeTo = null;
          if ((w.blocked = (w.blocked ?? 0) + 1) >= 3) { w.target = null; w.route = []; w.blocked = 0; }
        }
        return;
      }
      w.blocked = 0;
      w.route.shift();
      // Spend what is left of the tick on the next leg.
      const used = Math.hypot(w.player.x - before.x, w.player.y - before.y);
      const perSecond = speed / TILE_METERS;
      left = perSecond > 0 ? left - used / perSecond : 0;
    }
    if (!w.route.length) { w.target = null; w.routeTo = null; }
  }

  /** People still in the round. */
  private get people(): string[] {
    return [...this.walkers].filter(([, w]) => w.master === null).map(([id]) => id);
  }

  /**
   * Makes an object someone spelled, as many as its count: up to SEPARATE_UP_TO creatures or
   * things each on their own, more as one body with a count whose integrity, mass and damage are
   * all of theirs together (a swarm). Terrain is laid once, its radius grown so its area is
   * count times as large. Returns what happened: "is with you", "equipped", "made".
   */
  private make(owner: string, walker: Walker, phrase: Phrase): string {
    const n = phrase.count;
    const separate = n <= SEPARATE_UP_TO && TILE_TYPES[String(phrase.stats.get("tile_type"))] === undefined;
    const copies = separate ? n : 1, each = separate ? 1 : n;
    // Number words (TEN, THOUSAND) say how many, not what each one is called.
    const shown = phrase.adjectives.filter((a) => !this.onlyCounts(a));
    const at = (i: number) => {
      if (copies === 1) return { x: walker.player.x, y: walker.player.y };
      const t = (i / copies) * Math.PI * 2;
      return { x: walker.player.x + Math.cos(t) * 0.8, y: walker.player.y + Math.sin(t) * 0.8 };
    };
    const one = (): Gear => ({
      spelled: { noun: phrase.noun, adjectives: phrase.adjectives, ...(each > 1 ? { count: each } : {}) },
      phrase: [...shown, phrase.noun].join(" "),
      vehicle: phrase.stats.flag("mountable"),
      integrity: null,
    });
    // A word that only shows things (a MAP) becomes part of its owner's screen, not an object.
    const sense = walker.master === null ? senseOf(this.dict, phrase.noun, phrase.stats) : null;
    if (sense) {
      (walker.senses ??= []).push(sense);
      this.sendSensed(owner, walker);
      return "is on your screen: a minimap";
    }
    // A machine arrives ready to run: its owner's stores get half an hour of what it draws.
    supply(walker.stores, startingSupply(phrase.stats, n), 60);
    // Things that move of themselves act on their own; ones you can ride are gear instead.
    if (becomes(phrase.stats) === "creature") {
      for (let i = 0; i < copies; i++) { const p = at(i); this.addCreature(one(), owner, p.x, p.y, each); }
      const wild = this.command(owner);
      if (wild >= copies) return "runs wild: you cannot command more";
      return wild ? `is with you; ${wild} ran wild` : "is with you";
    }
    const here = { x: walker.player.x, y: walker.player.y }; // laying terrain may move the speller
    const tile = TILE_TYPES[String(phrase.stats.get("tile_type"))];
    if (tile !== undefined) this.reshape(walker.player.x, walker.player.y, phrase.stats.num("radius") * Math.sqrt(n), tile);
    let worn = 0;
    for (let i = 0; i < copies; i++) {
      const gear = one();
      if (tile !== undefined) gear.terrain = true;
      // Things you can hold, wear or ride go straight onto you if there is room; the rest sit on the ground.
      const wearable = gear.vehicle || phrase.stats.get("equip_slot") !== "none";
      const problem = wearable ? this.equip(walker, gear) : "";
      if (problem === null) { worn++; continue; }
      if (problem && gear.vehicle) this.sendTo(owner, "notice", problem);
      const p = i === 0 ? here : at(i);
      const id = this.addThing(gear, owner, p.x, p.y);
      const rates = production(phrase.stats);
      for (const k of Object.keys(rates)) rates[k]! *= each; // a stack of a thousand makes a thousand's worth
      if (Object.keys(rates).length) this.producers.set(id, { owner, rates, built: {} });
    }
    return worn === copies ? "equipped" : worn ? `made; ${worn} equipped` : "made";
  }

  /** True for a modifier that only says how many: TEN, THOUSAND, DOZEN. */
  private onlyCounts(word: string): boolean {
    const def = this.dict.lookup(word)?.def;
    if (!def) return false;
    const ids = [...Object.keys(def.set), ...def.ops.map((o) => o[0])];
    return ids.length > 0 && ids.every((id) => id === "plural_count" || id === "pack_size" || id === "duplicates");
  }

  /**
   * A verb: a passing effect on the speller's own body, with its adverbs (see shared
   * `castVerb`). A verb whose `effect_target` is `touched` and that carries an event's
   * properties (destroys_target, transfers_ownership, moves_target) also acts on what the
   * speller picked, through the same code as events: DELETE destroys, STEAL takes, PULL drags.
   * Throws if it would do nothing, before any letters are spent.
   */
  private cast(id: string, walker: Walker, phrase: Phrase): string {
    const s = phrase.stats, effect = phrase.effect ?? { set: {}, ops: [] };
    const name = [...phrase.adverbs, phrase.noun].join(" ");
    const said: string[] = [];
    const eventful = s.flag("destroys_target") || s.flag("transfers_ownership") || s.num("moves_target") > 0;
    if (s.get("effect_target") === "touched" && eventful) said.push(this.happen(id, walker, phrase));
    const done = this.affect(walker, name, s, effect);
    const counters = this.dict.word(phrase.noun)?.set.counters;
    if (!said.length && !done && !(Array.isArray(counters) && counters.length)) throw new Error(`${name.toUpperCase()} does nothing yet`);
    said.push(done ?? name.toUpperCase());
    return said.join("; ");
  }

  /**
   * What a verb, or an object used, does to one body: restores its `restores` integrity, ends
   * the statuses in its `effect_status`, and for its `duration` puts its effect on the body
   * (using or casting it again restarts it). Returns how it reads, or null if it does nothing.
   */
  private affect(walker: Walker, name: string, s: Stats, effect: { set: Record<string, Value>; ops: Op[] }): string | null {
    const heal = s.num("restores");
    const cures = s.tags("effect_status");
    const seconds = s.num("duration");
    const lasting = seconds > 0 && (effect.ops.length > 0 || Object.keys(effect.set).length > 0);
    if (!(heal > 0) && !cures.length && !lasting) return null;
    if (heal > 0) walker.hp = Math.min(walker.unit.body.stats.num("integrity"), walker.hp + heal);
    // effect_status lists what it ends: HEAL and MEDICINE end poison, bleeding and burns.
    const ended = cure(walker.statuses, cures);
    if (ended.length) this.statusChanged(walker);
    if (lasting) {
      const noun = name.split(" ").at(-1);
      walker.buffs = walker.buffs.filter((b) => b.word.split(" ").at(-1) !== noun);
      walker.buffs.push({ word: name, set: effect.set, ops: effect.ops, until: this.elapsed + seconds });
    }
    this.rebuild(walker);
    walker.player.hp = Math.min(100, Math.ceil((walker.hp / walker.unit.body.stats.num("integrity")) * 100));
    const upper = name.toUpperCase();
    const said = [!lasting ? upper : seconds === Infinity ? `${upper} forever` : `${upper} for ${+seconds.toFixed(1)} seconds`];
    if (ended.length) said.push(`no longer ${ended.join(", ")}`);
    return said.join("; ");
  }

  /** Heals a walker by `amount`, up to its full integrity. */
  private restore(w: Walker, amount: number) {
    const max = w.unit.body.stats.num("integrity");
    if (w.hp >= max) return;
    w.hp = Math.min(max, w.hp + amount);
    w.unit.body.integrity = w.hp;
    w.player.hp = Math.min(100, Math.ceil((w.hp / max) * 100));
    this.tell(w);
  }

  /** True if using this would do something (see shared `useObject`). */
  private usable(g: Gear): boolean {
    return !g.terrain && useObject(this.dict, g.spelled.noun, g.spelled.adjectives) !== null;
  }

  /** Things on the ground in reach that a walker may use (or, if `only` is false, try to): its own or nobody's, nearest first. */
  private usableNear(w: Walker, only = true): [string, Gear][] {
    const out: [string, Gear, number][] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const id of this.thingGrid.get(thingKey(w.player.x + dx * THING_CELL, w.player.y + dy * THING_CELL)) ?? []) {
          const t = this.state.things.get(id), g = this.grounded.get(id);
          if (!t || !g || (t.owner !== w.id && t.owner !== "")) continue;
          const d = Math.hypot(t.x - w.player.x, t.y - w.player.y);
          if (d <= TAKE_RANGE && !g.terrain && (!only || this.usable(g))) out.push([id, g, d]);
        }
      }
    }
    return out.sort((a, b) => a[2] - b[2]).map(([id, g]) => [id, g]);
  }

  /**
   * Uses something: eats it, drinks it, takes it. `which` is the index of something carried, the
   * id of a thing on the ground in reach, or nothing for the last usable thing carried, else
   * the nearest usable thing in reach. It acts as a verb cast on yourself (`affect`); a
   * `single_use` one is gone after, one of a stack at a time. Throws if there is nothing to use.
   */
  private use(walker: Walker, which: unknown): string {
    let gear: Gear | undefined, thingId: string | undefined;
    if (Number.isInteger(which)) {
      gear = walker.gear[which as number];
      if (!gear) throw new Error("You carry nothing there");
    } else if (typeof which === "string") {
      const t = this.state.things.get(which);
      gear = this.grounded.get(which);
      if (!t || !gear) throw new Error("That is not here any more");
      if (t.owner !== walker.id && t.owner !== "") throw new Error(`${gear.phrase.toUpperCase()} is not yours`);
      if (Math.hypot(t.x - walker.player.x, t.y - walker.player.y) > TAKE_RANGE) throw new Error(`${gear.phrase.toUpperCase()} is too far away`);
      thingId = which;
    } else {
      gear = [...walker.gear].reverse().find((g) => this.usable(g));
      if (!gear) [thingId, gear] = this.usableNear(walker)[0] ?? this.usableNear(walker, false)[0] ?? [];
      // Nothing usable: say why the last thing carried cannot be used.
      gear ??= walker.gear.at(-1);
      if (!gear) throw new Error("Nothing here to use: spell something to eat, drink or take, and stand by it");
    }
    const effect = useObject(this.dict, gear.spelled.noun, gear.spelled.adjectives);
    if (!effect || gear.terrain) throw new Error(`${gear.phrase.toUpperCase()} cannot be used: ${useObject(this.dict, gear.spelled.noun, []) === null && this.dict.base(gear.spelled.noun, "edible") === true ? "eating it does nothing yet" : "it heals, cures and changes nothing"}`);
    const food = effect.stats.num("nutrition");
    let done = this.affect(walker, gear.phrase, effect.stats, effect) ?? gear.phrase.toUpperCase();
    if (food > 0) {
      walker.stores.food += food; // one of it eaten: its nutrition goes into your food store
      done += `; +${+food.toFixed(2)} food`;
      this.tell(walker);
    }
    if (effect.stats.flag("single_use") || food > 0) {
      const left = (gear.spelled.count ?? 1) - 1;
      if (left > 0) {
        gear.spelled.count = left; // one of a stack at a time
        const t = thingId ? this.state.things.get(thingId) : undefined;
        if (t) t.count = left;
        else this.rebuild(walker);
      } else if (thingId) this.removeThing(thingId);
      else {
        walker.gear.splice(walker.gear.indexOf(gear), 1);
        this.rebuild(walker);
      }
    }
    return `Used ${done}`;
  }

  /**
   * An event. What it does comes from its properties, in this order: taking ownership (THEFT),
   * destroying a creature (MURDER), stealing letters (RAID), moving a creature to you (RESCUE),
   * restoring a thing (REPAIR), exchange (TRADE), freeing what others own (REVOLT), a surprise
   * strike (AMBUSH), and any damage or hostility over an area (FIRE, WAR, EARTHQUAKE, FAMINE).
   * Targeted events act on whatever the speller last clicked.
   */
  private happen(id: string, walker: Walker, phrase: Phrase): string {
    const s = phrase.stats, word = phrase.noun.toUpperCase();
    if (s.flag("transfers_ownership")) return this.steal(id, walker, phrase);
    const reach = Math.max(1.5, s.num("placement_range") / TILE_METERS);
    // A target clicked after spelling the event wins over what you are attacking.
    const selected = walker.picked ?? walker.foe ?? "";
    const other = this.walkers.get(selected);
    const thing = this.state.things.get(selected), gear = this.grounded.get(selected);
    const near = (p: { x: number; y: number }) => Math.hypot(p.x - walker.player.x, p.y - walker.player.y) <= reach;
    const contest = (theirs: Stats, what: string, living = false) => {
      if (!s.get("contest_with") || !s.get("contested_by")) return; // nothing resists it
      const mine = walker.unit.body.stats.num(String(s.get("contest_with")));
      const against = theirs.num(String(s.get("contested_by")));
      const by = `${s.get("contested_by")} ${against} against your ${s.get("contest_with")} ${mine}`.replaceAll("_", " ");
      if (mine < against) throw new Error(living ? `${what} sees you coming (${by})` : `${what} is too well guarded (${by})`);
    };
    const needCreature = () => {
      if (!other) throw new Error(`Select someone for ${word} first: click them`);
      if (!near(other.player)) throw new Error(`Too far away for ${word}`);
      return other;
    };
    const needThing = () => {
      if (!thing || !gear || gear.terrain) throw new Error(`Select a thing for ${word} first: click it`);
      if (!near(thing)) throw new Error(`Too far away for ${word}`);
      return { thing, gear, stats: resolveSpelled(this.dict, gear.spelled) };
    };

    if (s.flag("destroys_target")) {
      const victim = needCreature();
      contest(victim.unit.body.stats, victim.player.name, true);
      walker.foe = null;
      this.kill(selected, id);
      return `${victim.player.name} is dead`;
    }
    if (s.num("letter_steal") > 0) {
      const t = needThing();
      if (t.thing.owner === id || t.thing.owner === "") throw new Error(`${word} needs a thing someone else owns`);
      contest(t.stats, t.gear.phrase.toUpperCase());
      const owner = this.walkers.get(t.thing.owner);
      const pool = owner ? Object.entries(owner.letters).flatMap(([ch, n]) => ch.repeat(Math.max(0, n)).split("")) : [];
      let taken = "";
      for (let i = 0; i < s.num("letter_steal") && pool.length; i++) taken += pool.splice(Math.floor(this.rng() * pool.length), 1)[0]!;
      if (owner) {
        spend(owner.letters, taken);
        this.clients.find((c) => c.sessionId === t.thing.owner)?.send("letters", owner.letters);
        this.clients.find((c) => c.sessionId === t.thing.owner)?.send("notice", `${walker.player.name} raided your ${t.gear.phrase.toUpperCase()} and took ${taken.length} letters`);
      }
      this.award(id, walker, taken, `raided ${t.gear.phrase.toUpperCase()}`, t.thing);
      if (hasDamage(s)) this.strikeThing(id, alwaysHits(s), selected, t.thing);
      return `Took ${taken.length} letters`;
    }
    if (s.num("moves_target") > 0) {
      const saved = needCreature();
      saved.player.x = walker.player.x; saved.player.y = walker.player.y; saved.target = null;
      saved.hp = Math.min(saved.unit.body.stats.num("integrity"), saved.hp + s.num("restores"));
      cure(saved.statuses, s.tags("effect_status"));
      this.statusChanged(saved);
      this.rebuild(saved);
      walker.foe = null;
      return `${saved.player.name} is beside you`;
    }
    if (s.num("restores") > 0) {
      const t = needThing();
      t.gear.integrity = null;
      this.thingEntities.delete(selected);
      t.thing.hp = 100;
      return `${t.gear.phrase.toUpperCase()} repaired`;
    }
    if (s.num("produce_T") > 0) {
      const partner = needCreature();
      const t = "t".repeat(Math.round(s.num("produce_T")));
      this.award(id, walker, t, "trade");
      this.award(selected, partner, t, "trade");
      this.clients.find((c) => c.sessionId === selected)?.send("letters", partner.letters);
      walker.foe = null;
      return `Traded with ${partner.player.name}: both gain ${t.toUpperCase()}`;
    }
    if (s.flag("frees_target")) {
      const radius = Math.max(1, s.num("event_radius") / TILE_METERS);
      let freed = 0;
      this.state.things.forEach((t) => {
        if (t.owner && t.owner !== id && Math.hypot(t.x - walker.player.x, t.y - walker.player.y) <= radius) { t.owner = ""; freed++; }
      });
      for (const w of this.walkers.values()) {
        if (w.master && w.master !== id && w.master !== "-" && Math.hypot(w.player.x - walker.player.x, w.player.y - walker.player.y) <= radius) {
          w.master = "-"; w.player.owner = "-"; w.foe = null; freed++;
        }
      }
      for (const [pid, p] of this.producers) if (!this.state.things.get(pid)?.owner && !pid.startsWith("sky:")) this.producers.delete(pid);
      return `${freed} thing${freed === 1 ? "" : "s"} freed from their owners`;
    }
    if (s.num("inflict_stun") > 0 && s.get("event_target") === "character") {
      const victim = needCreature();
      contest(victim.unit.body.stats, victim.player.name, true);
      const blow = walker.unit.attack.clone();
      blow.set("critical", "ABS");
      blow.set("accuracy", "ABS");
      const r = strike(blow, victim.unit.outer, this.rng);
      this.settle(selected, victim);
      if (victim.unit.dead) this.kill(selected, id);
      else if (r.hit) this.hurtWith(victim, inflicts(s, blow), id, id, true);
      return `Ambushed ${victim.player.name}`;
    }
    const minutes = s.num("event_duration");
    const def = this.dict.word(phrase.noun)!;
    const given = inflicts(s), cures = s.tags("effect_status");
    const rules = placeRules(def, s);
    // What it does to bodies inside while it lasts: the word's own operations and flags.
    const bodyOps = def.ops.filter(([p]) => !/^produce_[A-Z]$/.test(p) && p !== "harvest_bonus");
    const flags = bodyFlags(def.set);
    const effect = bodyOps.length || Object.keys(flags).length ? { word: phrase.noun, set: flags, ops: bodyOps, until: Infinity } : null;
    const summons = this.summonsOf(s), tile = TILE_TYPES[String(s.get("tile_type"))];
    if (!hasDamage(s) && !rules && !effect && !given.length && !s.flag("sets_hostile") && !summons && tile === undefined) throw new Error(`${word} does nothing yet`);
    // A region event covers the speller's surroundings. Anything else lands where it was aimed:
    // a picked spot, else the picked or attacked target. It must be in reach.
    const regional = s.get("placement") === "region" || s.get("placement") === "map";
    const aimed = walker.aim ?? (other ? other.player : thing ?? null);
    if (!regional && !aimed) throw new Error(`Aim ${word}: spell it, then click where it should go`);
    if (!regional && !near(aimed!)) throw new Error(`Too far away for ${word}`);
    const at = regional ? walker.player : aimed!;
    const whole = s.get("placement") === "map" || s.num("event_radius") === Infinity;
    const radius = whole ? this.map.size * 2 : Math.max(1, s.num("event_radius") / TILE_METERS);
    const lasts = Math.max(1, minutes * 60);
    const area: Area = {
      word: phrase.noun, owner: id, x: at.x, y: at.y,
      radius,
      until: this.elapsed + lasts,
      attack: hasDamage(s) ? alwaysHits(s) : null,
      cooldown: 0,
      friendlyFire: s.flag("friendly_fire"),
      spread: s.num("spread_rate"),
      effect,
      targets: String(s.get("field_targets")),
      follows: null,
      ...AREA_DEFAULTS,
      inflicts: given,
      hostile: s.flag("sets_hostile"),
      contagion: s.num("contagion"),
      cures,
      rules,
      lodeLeft: rules ? this.lodeStock(rules) : 0,
      baseRadius: radius,
      lasts,
    };
    if (this.weather && this.countered(this.weather.word, area.word)) {
      throw new Error(`${word} cannot take hold: the ${this.weather.word} puts it out`);
    }
    const key = this.addArea(area, true);
    const began = this.begin(area, s);
    this.burn(key, area, 0);
    const span = minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "a moment";
    return `${word} for ${span}${began ? `: ${began}` : ""}`;
  }

  /** What a word summons as its area begins (shared `summons`, `summon_count`), if the creature exists. */
  private summonsOf(s: Stats): { word: string; count: number; owned: boolean } | null {
    const word = String(s.get("summons")).toLowerCase(), count = Math.round(s.num("summon_count"));
    const def = word ? this.dict.word(word) : undefined;
    if (!def || def.role !== "noun" || !(count > 0) || !Number.isFinite(count)) return null;
    return { word, count, owned: s.flag("summon_owned") };
  }

  private lodeStock(r: PlaceRules): number {
    return r.lodeStock > 0 ? r.lodeStock : Infinity;
  }

  /**
   * What happens once as an area begins, from its word's properties: deposits inside are
   * multiplied (`deposit_factor`), creatures are summoned (`summons`), an event lays terrain
   * (`tile_type` over `radius` tiles), and everyone else inside is told who brought it.
   * Returns a short note of what it did.
   */
  private begin(a: Area, s: Stats): string {
    const notes: string[] = [];
    if (a.rules && a.rules.deposits !== 1) {
      this.deposits.scale(a.x, a.y, Math.min(a.radius, this.map.size * 2), this.elapsed, a.rules.deposits);
      notes.push(a.rules.deposits === 0 ? "the ground is stripped" : `the ground holds ×${+a.rules.deposits.toFixed(2)}`);
    }
    const summons = this.summonsOf(s);
    if (summons) {
      const spot = (i: number) => {
        const t = (i / summons.count) * Math.PI * 2 + this.rng(), d = Math.min(a.radius * 0.6, 3 + this.rng() * 6);
        return nearestWalkable(this.map, { x: a.x + Math.cos(t) * d, y: a.y + Math.sin(t) * d });
      };
      const separate = Math.min(summons.count, SEPARATE_UP_TO);
      const each = summons.count > SEPARATE_UP_TO ? summons.count : 1;
      const phrase = summons.word;
      for (let i = 0; i < (each > 1 ? 1 : separate); i++) {
        const p = spot(i);
        const gear: Gear = { spelled: { noun: phrase, adjectives: [], ...(each > 1 ? { count: each } : {}) }, phrase, vehicle: false, integrity: null };
        if (becomes(resolve(this.dict, phrase, [])) !== "creature") { this.addThing(gear, summons.owned ? a.owner : "", p.x, p.y); continue; }
        this.addCreature(gear, summons.owned ? a.owner : "-", p.x, p.y, each);
      }
      if (summons.owned) this.command(a.owner);
      notes.push(`${summons.count} ${(summons.count > 1 ? pluralize(phrase) : phrase).toUpperCase()} ${summons.owned ? "rally to you" : "appear"}`);
    }
    const tile = TILE_TYPES[String(s.get("tile_type"))];
    if (tile !== undefined && s.num("radius") > 0 && this.dict.word(a.word)?.class === "event") {
      this.reshape(a.x, a.y, s.num("radius"), tile);
      notes.push(`the land turns to ${String(s.get("tile_type")).replaceAll("_", " ")}`);
    }
    // Everyone else it covers learns who brought it.
    const maker = this.walkers.get(a.owner)?.player.name ?? "someone";
    for (const [wid, w] of this.walkers) {
      if (wid === a.owner || w.master !== null || Math.hypot(w.player.x - a.x, w.player.y - a.y) > a.radius) continue;
      this.sendTo(wid, "notice", `${maker} brought ${a.word.toUpperCase()} here`);
    }
    this.refreshViews();
    return notes.join(", ");
  }

  /** Adds what a word ended by countering to the message for it. */
  private withCounters(word: string, done: string, id: string, walker: Walker): string {
    const n = this.counter(word);
    const culled = this.exterminate(word, id, walker);
    return `${done}${n ? `; ${n} ${n === 1 ? "area" : "areas"} ended` : ""}${culled ? `; wiped out ${culled}` : ""}`;
  }

  /**
   * Creatures a word counters, by their noun or archetype (DEBUG counters insects, so it ends
   * a LOCUST swarm), within its `event_radius` (at least COUNTER_TILES) of the speller: struck
   * dead, paid for as any kill. People are never countered this way. Returns what died, as text.
   */
  private exterminate(word: string, id: string, walker: Walker): string {
    const tags = this.dict.word(word)?.set.counters;
    if (!Array.isArray(tags) || !tags.length) return "";
    const reach = Math.max(COUNTER_TILES, Number(this.dict.base(word, "event_radius")) / TILE_METERS || 0);
    const dead: string[] = [];
    for (const [cid, c] of [...this.walkers]) {
      if (c.master === null || cid === id) continue;
      const def = this.dict.word(c.body.noun);
      if (!tags.includes(c.body.noun) && !(def && tags.includes(def.archetype))) continue;
      if (Math.hypot(c.player.x - walker.player.x, c.player.y - walker.player.y) > reach) continue;
      dead.push(c.player.count > 1 ? `${c.player.count} ${c.player.name.toUpperCase()}` : c.player.name.toUpperCase());
      this.kill(cid, id);
    }
    return dead.join(", ");
  }

  /**
   * A field: an aura or condition. It moves with its maker (placement self), sits where it was
   * aimed (target), covers the speller's surroundings (region) or the whole map (sky, map, or an
   * absolute radius). Everyone it reaches gets the word's effects while inside; damage, if any,
   * strikes as an area does.
   */
  private field(id: string, walker: Walker, phrase: Phrase): string {
    const s = phrase.stats, def = this.dict.word(phrase.noun)!, word = phrase.noun.toUpperCase();
    const placement = String(s.get("placement"));
    let at: Point = walker.player;
    if (placement === "target") {
      const reach = Math.max(1.5, s.num("placement_range") / TILE_METERS);
      const picked = walker.picked ?? walker.foe;
      const target = walker.aim ?? (picked ? this.walkers.get(picked)?.player ?? this.state.things.get(picked) : undefined);
      if (!target) throw new Error(`Aim ${word}: spell it, then click where it should go`);
      if (Math.hypot(target.x - walker.player.x, target.y - walker.player.y) > reach) throw new Error(`Too far away for ${word}`);
      at = { x: target.x, y: target.y };
    }
    const area = this.fieldArea(phrase.noun, s, def, id, at, placement === "self" ? id : null);
    if (area.rules) area.lodeLeft = this.lodeStock(area.rules);
    const rates = production(s);
    if (!acts(area) && !Object.keys(rates).length && !this.summonsOf(s)) throw new Error(`${word} does nothing yet`);
    // Casting it again replaces your earlier one.
    for (const [k, a] of this.areas) if (a.owner === id && a.word === phrase.noun) { this.areas.delete(k); this.state.zones.delete(k); }
    const key = this.addArea(area, true);
    if (Object.keys(rates).length) this.producers.set(`field:${key}`, { owner: id, rates, built: {} });
    this.applyFields();
    const began = this.begin(area, s);
    const minutes = s.num("field_duration") || s.num("persistence");
    const where = area.radius >= this.map.size * 2 ? "over the whole map" : area.follows ? "around you" : "where it fell";
    return `${word} ${where}${area.lasts < Infinity ? ` for ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}${began ? `: ${began}` : ""}`;
  }

  /**
   * The area a field gives off, from its properties: a field word, or an object with a
   * `field_radius` of its own. It covers `field_radius` around `at`, or the whole map (placement
   * sky or map, or an absolute radius), and moves with `follows` if that is set and it is not
   * map-wide. Everyone it reaches (`field_targets`) gets the word's operations, a named
   * property change and the flags it grants; damage, if any, strikes as an area does.
   */
  private fieldArea(word: string, s: Stats, def: WordDef, owner: string, at: Point, follows: string | null): Area {
    const placement = String(s.get("placement"));
    const radiusM = s.num("field_radius");
    const whole = placement === "sky" || placement === "map" || radiusM === Infinity;
    // What it does to bodies: the word's operations, a named property change, and any flags it grants.
    const ops: Op[] = [...def.ops];
    const prop = String(s.get("field_property"));
    if (prop && this.dict.properties.has(prop)) {
      if (s.num("field_delta")) ops.push([prop, "add", s.num("field_delta")]);
      if (s.num("field_multiplier") !== 1) ops.push([prop, "mul", s.num("field_multiplier")]);
    }
    const flags = bodyFlags(def.set);
    const minutes = s.num("field_duration") || s.num("persistence");
    const lasts = minutes > 0 && minutes < Infinity ? minutes * 60 : Infinity;
    const radius = whole ? this.map.size * 2 : Math.max(1, radiusM / TILE_METERS);
    return {
      word, owner, x: at.x, y: at.y, radius,
      until: this.elapsed + lasts,
      attack: hasDamage(s) ? alwaysHits(s) : null,
      cooldown: 0,
      friendlyFire: s.flag("friendly_fire"),
            spread: 0,
      effect: ops.length || Object.keys(flags).length ? { word, set: flags, ops, until: Infinity } : null,
      targets: String(s.get("field_targets")),
      follows: whole ? null : follows,
      ...AREA_DEFAULTS,
      // A silence field keeps everyone inside it silenced, a second at a time.
      inflicts: [...inflicts(s), ...(s.num("silences") > 0 && !s.num("inflict_silence") ? [["silence", 1.5] as [Status, number]] : [])],
      hostile: s.flag("sets_hostile"),
      contagion: s.num("contagion"),
      cures: s.tags("effect_status"),
      heals: s.num("heals"),
      rules: placeRules(def, s),
      lodeLeft: 0,
      baseRadius: radius,
      lasts,
    };
  }

  /** When a zone ends on the round clock (0 if it lasts) and who made it, for the event chips. */
  private zoneTime(a: Area): { until: number; by: string } {
    return { until: Number.isFinite(a.until) ? Math.ceil(a.until) : 0, by: this.walkers.get(a.owner)?.player.name ?? "" };
  }

  /** Puts an area in the world; `shown` also sends it to clients as a zone. Returns its key. */
  private addArea(area: Area, shown: boolean): string {
    const key = `z${this.nextThing++}`;
    this.areas.set(key, area);
    if (shown) {
      this.state.zones.set(key, Object.assign(new Zone(), {
        word: area.word, x: area.x, y: area.y, radius: area.radius >= this.map.size * 2 ? 0 : area.radius,
        owner: area.claim ? area.owner : "", shelter: area.claim ? Math.round(area.claim.shelter * 100) : 0,
        ...this.zoneTime(area),
      }));
    }
    this.fieldsDirty = true;
    return key;
  }

  /**
   * Makes something radiate: an object with a `field_radius` gives off its field exactly as a
   * field word does, and anything with light, fear or healing (shared `auras`) gives those off
   * too. `holder` is the walker carrying it (the areas move with them) or the thing it lies as
   * (the areas stay put). What it radiated before, wherever it was, ends first.
   */
  private radiate(source: object, spelled: Spelled, holder: string, owner: string, at: Point, follows: string | null, sightM: number) {
    this.unradiate(source);
    const def = this.dict.word(spelled.noun);
    if (!def || def.role !== "noun") return;
    const s = resolveSpelled(this.dict, spelled);
    const made: [Area, boolean][] = [];
    if (s.num("field_radius") > 0) {
      const area = this.fieldArea(spelled.noun, s, def, owner, at, follows);
      if (area.rules) area.lodeLeft = this.lodeStock(area.rules);
      if (acts(area)) made.push([area, true]);
    }
    const claim = claimOf(s);
    if (claim) {
      // Claimed ground: everything of the owner's inside is sheltered (shared `claimOf`).
      const radius = Math.max(1, claim.radius);
      const ops: Op[] = [...this.dict.properties.keys()].filter((k) => k.startsWith("res_")).map((k) => [k, "add", claim.shelter]);
      made.push([{
        word: spelled.noun, owner, x: at.x, y: at.y, radius, until: Infinity, attack: null, cooldown: 0, friendlyFire: false,         spread: 0, effect: { word: spelled.noun, set: {}, ops, until: Infinity }, targets: "owned", follows, ...AREA_DEFAULTS,
        baseRadius: radius, lasts: Infinity, claim: { shelter: claim.shelter, security: claim.security, source: follows ? "" : holder },
      }, true]);
    }
    for (const aura of auras(s, sightM)) {
      const radius = Math.max(1, aura.radius / TILE_METERS);
      made.push([{
        word: spelled.noun, owner, x: at.x, y: at.y, radius, until: Infinity, attack: null, cooldown: 0, friendlyFire: false,         spread: 0, effect: aura.set.night_vision || aura.ops.length ? { word: spelled.noun, set: aura.set, ops: aura.ops, until: Infinity } : null,
        targets: aura.targets, follows, ...AREA_DEFAULTS, heals: aura.heals, baseRadius: radius, lasts: Infinity,
      }, false]);
    }
    const keys: string[] = [];
    // A field that runs out (STEAM's three minutes) does so once, wherever the thing goes after.
    const until = this.radiantUntil.get(source);
    for (const [area, shown] of made) {
      if (area.lasts < Infinity) {
        if (until === undefined) this.radiantUntil.set(source, area.until);
        else area.until = until;
        if (area.until <= this.elapsed) continue;
      }
      keys.push(this.addArea(area, shown));
    }
    this.radiating.set(source, { holder, keys });
    (this.radiators.get(holder) ?? this.radiators.set(holder, new Set()).get(holder)!).add(source);
  }

  /** Ends what something radiates. */
  private unradiate(source: object) {
    const r = this.radiating.get(source);
    if (!r) return;
    for (const k of r.keys) {
      if (this.areas.delete(k)) this.fieldsDirty = true;
      this.state.zones.delete(k);
    }
    this.radiating.delete(source);
    const held = this.radiators.get(r.holder);
    held?.delete(source);
    if (held && !held.size) this.radiators.delete(r.holder);
  }

  /** Ends everything a walker or thing radiates. */
  private unradiateAll(holder: string) {
    for (const source of [...(this.radiators.get(holder) ?? [])]) this.unradiate(source);
  }

  /**
   * A walker's body and gear radiate around it: what it took up starts, what it no longer
   * carries stops. A creature's areas are on its master's side.
   */
  private syncRadiation(w: Walker) {
    if (this.walkers.get(w.id) !== w) return;
    const sources: [object, Spelled][] = [[w.body, w.body], ...w.gear.map((g): [object, Spelled] => [g, g.spelled])];
    const live = new Set(sources.map(([o]) => o));
    for (const source of [...(this.radiators.get(w.id) ?? [])]) if (!live.has(source)) this.unradiate(source);
    const sight = w.unit.body.stats.num("sight_range");
    for (const [source, spelled] of sources) {
      if (this.radiating.get(source)?.holder !== w.id) this.radiate(source, spelled, w.id, w.master ?? w.id, w.player, w.id, sight);
    }
  }

  /** True if a field reaches a walker, by its targets and its position. */
  private reaches(a: Area, wid: string, w: Walker): boolean {
    if (Math.hypot(w.player.x - a.x, w.player.y - a.y) > a.radius) return false;
    return this.aims(a, wid, w);
  }

  /** True if a field is meant for a walker (its `field_targets`), wherever they stand. */
  private aims(a: Area, wid: string, w: Walker): boolean {
    if (a.claim?.source === wid) return false; // a claim's own walls take the blows
    const mine = wid === a.owner || w.master === a.owner;
    switch (a.targets) {
      case "self": return wid === a.owner;
      case "owned": case "allies": return mine;
      case "enemies": return !mine;
      case "living": return w.unit.body.stats.flag("alive");
      default: return true;
    }
  }

  /** The best claim of `owner`'s covering a point, not counting the one `source` makes: its shelter and security. */
  private claimAt(owner: string, p: Point, source: string): { shelter: number; security: number } {
    let best = { shelter: 0, security: 0 };
    if (!owner || owner === "-") return best;
    for (const a of this.areas.values()) {
      if (!a.claim || a.owner !== owner || a.claim.source === source || Math.hypot(p.x - a.x, p.y - a.y) > a.radius) continue;
      if (a.claim.shelter > best.shelter) best = { shelter: a.claim.shelter, security: Math.max(best.security, a.claim.security) };
      else best.security = Math.max(best.security, a.claim.security);
    }
    return best;
  }

  /** Gives every walker the effects of the fields it stands in; rebuilds only those that changed. */
  private applyFields() {
    this.fieldsDirty = false;
    for (const [wid, w] of this.walkers) {
      const now: Effect[] = [];
      for (const a of this.areas.values()) if (a.effect && this.reaches(a, wid, w)) now.push(a.effect);
      const key = now.map((e) => e.word).sort().join(",");
      if (key === (w.fieldKey ?? "")) continue;
      w.fieldKey = key;
      w.fields = now;
      this.rebuild(w);
    }
  }

  /** True if `word` lists `other` among the things it counters (RAIN counters FIRE). */
  private countered(word: string, other: string): boolean {
    const tags = this.dict.word(word)?.set.counters;
    return Array.isArray(tags) && tags.includes(other);
  }

  /** Ends every area that `word` counters; returns how many. */
  private counter(word: string): number {
    let n = 0;
    for (const [key, a] of [...this.areas]) {
      if (this.countered(word, a.word)) { this.areas.delete(key); this.state.zones.delete(key); this.producers.delete(`field:${key}`); this.fieldsDirty = true; n++; }
    }
    return n;
  }

  /**
   * Strikes everything inside an area whose cooldown has run out; grows areas that spread over
   * ground that burns; ends areas whose time is up.
   */
  private burn(key: string, a: Area, seconds: number) {
    const leader = a.follows ? this.walkers.get(a.follows) : undefined;
    if (this.elapsed >= a.until || (a.follows && !leader)) {
      this.areas.delete(key);
      if (a.effect) this.fieldsDirty = true;
      this.state.zones.delete(key);
      this.producers.delete(`field:${key}`);
      return;
    }
    if (leader) {
      a.x = leader.player.x; a.y = leader.player.y;
      const zone = this.state.zones.get(key);
      if (zone) { zone.x = a.x; zone.y = a.y; }
    }
    if (a.spread > 0 && seconds > 0) {
      // Sample the ground around the edge: forest feeds it, grass less, stone and water not at all.
      let fuel = 0;
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2;
        fuel += BURNS[tileAt(this.map, a.x + Math.cos(t) * (a.radius + 0.5), a.y + Math.sin(t) * (a.radius + 0.5))] ?? 0;
      }
      a.radius += (a.spread / 60) * seconds * (fuel / 8);
      const zone = this.state.zones.get(key);
      if (zone && Math.abs(zone.radius - a.radius) > 0.1) zone.radius = a.radius;
    }
    if (this.elapsed - a.pulsed >= 1) {
      const since = a.pulsed === -Infinity ? 0 : this.elapsed - a.pulsed;
      a.pulsed = this.elapsed;
      this.pulse(key, a, since);
      if (!this.areas.has(key)) return;
    }
    a.cooldown -= seconds;
    if (!a.attack || a.cooldown > 0) return;
    const rate = a.attack.num("attack_rate");
    a.cooldown = rate > 0 ? 1 / rate : Infinity; // no rate: it strikes once
    const inside = (p: { x: number; y: number }) => Math.hypot(p.x - a.x, p.y - a.y) <= a.radius;
    for (const [wid, w] of [...this.walkers]) {
      if (!this.walkers.has(wid) || !this.harms(a, wid, w)) continue;
      const outer = w.unit.outer, r = strike(a.attack, outer, this.rng);
      this.blow(key, wid, r, outer === w.unit.body ? "" : outer.name, false, a);
      this.settle(wid, w);
      if (w.unit.dead) this.kill(wid, a.owner);
      else if (r.hit) this.hurtWith(w, a.inflicts, a.owner, key, true);
    }
    this.state.things.forEach((t, tid) => {
      const g = this.grounded.get(tid);
      if (!g || g.terrain || !inside(t) || (!a.friendlyFire && t.owner === a.owner)) return;
      this.strikeThing(a.owner, a.attack!, tid, t);
    });
  }

  /** True if an area's harm (damage, statuses) lands on a walker: inside it, and among whom it targets. */
  private harms(a: Area, wid: string, w: Walker): boolean {
    if (Math.hypot(w.player.x - a.x, w.player.y - a.y) > a.radius) return false;
    if (!a.friendlyFire && (wid === a.owner || w.master === a.owner)) return false;
    return !a.effect || this.reaches(a, wid, w); // a field strikes only whom it targets
  }

  /**
   * Once a second: an area that does no damage gives its statuses to whoever it covers, one
   * that cures ends statuses on whoever it reaches, and a contagious one may spread.
   */
  private pulse(key: string, a: Area, since: number) {
    for (const [wid, w] of [...this.walkers]) {
      if (!a.attack && a.inflicts.length && this.harms(a, wid, w)) this.hurtWith(w, a.inflicts, a.owner, key, false);
      const reached = a.effect ? this.reaches(a, wid, w) : Math.hypot(w.player.x - a.x, w.player.y - a.y) <= a.radius;
      if (a.cures.length && reached && cure(w.statuses, a.cures).length) this.statusChanged(w);
      if (a.heals > 0 && since > 0 && reached && (wid === a.owner || w.master === a.owner)) this.restore(w, a.heals * since);
    }
    if (a.attack && a.contagion > 0 && since > 0 && this.rng() < 1 - (1 - Math.min(1, a.contagion)) ** (since / 60)) this.spread(a);
  }

  /**
   * A disease passes on: a copy of it, at its first size and for its full length, settles on a
   * living walker it covers and goes wherever they go. Nobody carries two of the same.
   */
  private spread(a: Area) {
    const carriers = new Set([...this.areas.values()].filter((o) => o.word === a.word && o.follows).map((o) => o.follows));
    const hosts = [...this.walkers].filter(([wid, w]) =>
      !carriers.has(wid) && w.unit.body.stats.flag("alive") && this.harms(a, wid, w));
    if (!hosts.length) return;
    const [hid, host] = hosts[Math.floor(this.rng() * hosts.length)]!;
    const copy: Area = {
      ...a, x: host.player.x, y: host.player.y, radius: a.baseRadius, until: this.elapsed + a.lasts,
      cooldown: 0, pulsed: this.elapsed, follows: hid,
    };
    const key = `z${this.nextThing++}`;
    this.areas.set(key, copy);
    this.state.zones.set(key, Object.assign(new Zone(), { word: copy.word, x: copy.x, y: copy.y, radius: copy.radius, owner: "", shelter: 0, ...this.zoneTime(copy) }));
    this.clients.find((c) => c.sessionId === hid)?.send("notice", `You caught ${a.word.toUpperCase()}`);
  }

  /**
   * Statuses reach a walker: from a blow that landed (which also wakes a sleeper) or from an
   * area it stands in. `from` is to blame; `origin` is what a frightened walker runs from.
   */
  private hurtWith(w: Walker, given: [Status, number][], from: string, origin: string, blow: boolean) {
    const woke = blow ? wake(w.statuses).length : 0;
    const done = given.length ? afflict(w.statuses, given, w.unit.body.stats, from, origin).length : 0;
    if (woke || done) this.statusChanged(w);
  }

  /** Statuses came or went: work out again what the walker may do, and rebuild it if the set changed. */
  private statusChanged(w: Walker) {
    w.hamper = hampered(w.statuses);
    const key = [...new Set(w.statuses.map((a) => a.status))].join(" ");
    if (key !== w.statusKey) {
      w.statusKey = key;
      this.rebuild(w);
    }
    this.showStatus(w);
    if (!w.hamper.moves) { w.target = null; w.route = []; w.routeTo = null; }
  }

  /** Burn, poison and bleeding hurt once a second, and statuses run down. */
  private sufferStatuses(id: string, w: Walker, seconds: number) {
    const hurt = statusDamage(this.dict, w.statuses);
    if (hurt) {
      w.dot += seconds;
      const longest = Math.max(...w.statuses.map((a) => a.left));
      for (let n = Math.min(Math.floor(w.dot), Math.ceil(longest)); n > 0 && !w.unit.dead; n--) strike(hurt.attack, w.unit.body, this.rng);
      w.dot -= Math.floor(w.dot);
      if (w.unit.body.integrity !== w.hp) {
        this.settle(id, w);
        if (w.unit.dead) return void this.kill(id, hurt.from);
      }
    } else w.dot = 0;
    const over = tickStatuses(w.statuses, seconds);
    if (over.length) {
      this.statusChanged(w);
      this.clients.find((c) => c.sessionId === id)?.send("notice", `No longer ${over.join(", ")}`);
    }
  }

  /**
   * What statuses and hostility make walkers do, over what they or their master want: the
   * frightened run, the confused wander and lash out, and creatures in a hostile area attack
   * the nearest walker not on its maker's side.
   */
  private compel() {
    const hostile = [...this.areas.values()].filter((a) => a.hostile);
    const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
    const second = this.tickCount % TICK_HZ === 0;
    for (const [id, w] of this.walkers) {
      const h = w.hamper;
      if (h.flees.length) {
        w.foe = null;
        w.gathering = 0;
        const o = h.flees.map((k) => (k === id ? undefined : this.walkers.get(k)?.player ?? this.areas.get(k))).find(Boolean);
        if (o && h.moves) this.runFrom(w, o);
        continue;
      }
      if (w.fleeing) {
        // Broken or badly hurt: away from the nearest enemy, striking nobody.
        w.foe = null;
        w.gathering = 0;
        const o = w.fleeFrom ? this.walkers.get(w.fleeFrom)?.player : undefined;
        if (o && h.moves) this.runFrom(w, o);
        continue;
      }
      if (h.random) {
        if (!second) continue;
        const near = [...this.walkers].filter(([oid, o]) => oid !== id && Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y) <= CONFUSED_TILES);
        if (near.length && this.rng() < 0.5) {
          w.foe = near[Math.floor(this.rng() * near.length)]![0];
        } else {
          w.foe = null;
          if (h.moves) w.target = { x: clamp(w.player.x + (this.rng() * 2 - 1) * CONFUSED_TILES), y: clamp(w.player.y + (this.rng() * 2 - 1) * CONFUSED_TILES) };
        }
        continue;
      }
      if (w.master === null) continue;
      const rage = hostile.find((a) => Math.hypot(w.player.x - a.x, w.player.y - a.y) <= a.radius && (!a.effect || this.reaches(a, id, w)));
      if (!rage) continue;
      let best: string | null = null, bestDistance = w.sight || Infinity;
      for (const [oid, o] of this.walkers) {
        if (oid === id || oid === rage.owner || o.master === rage.owner) continue;
        const d = Math.hypot(o.player.x - w.player.x, o.player.y - w.player.y);
        if (d <= bestDistance) { best = oid; bestDistance = d; }
      }
      if (best) w.foe = best;
    }
  }

  /** Sets a walker running FLEE_TILES straight away from a point. */
  private runFrom(w: Walker, o: Point) {
    const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
    let dx = w.player.x - o.x, dy = w.player.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) { const t = this.rng() * Math.PI * 2; dx = Math.cos(t); dy = Math.sin(t); } else { dx /= d; dy /= d; }
    w.target = { x: clamp(w.player.x + dx * FLEE_TILES), y: clamp(w.player.y + dy * FLEE_TILES) };
  }

  /** THEFT: the selected thing becomes yours if your stealth meets its security. */
  private steal(id: string, walker: Walker, phrase: Phrase): string {
    const word = phrase.noun.toUpperCase();
    const guarded = this.lawAgainst("theft", id, walker);
    if (guarded) throw new Error(`${guarded}: no stealing here`);
    const targetId = walker.picked ?? walker.foe ?? "";
    const creature = this.walkers.get(targetId);
    if (creature && creature.master !== null) return this.stealCreature(id, walker, phrase, targetId, creature);
    const thing = this.state.things.get(targetId), gear = this.grounded.get(targetId);
    if (!thing || !gear || gear.terrain) throw new Error(`Select a thing for ${word} first: click it`);
    if (thing.owner === id) throw new Error("That is already yours");
    const reach = Math.max(1.5, phrase.stats.num("placement_range") / TILE_METERS);
    if (Math.hypot(thing.x - walker.player.x, thing.y - walker.player.y) > reach) throw new Error(`Too far away for ${word}`);
    // The speller's own stat against the thing's: stealth against security for a theft.
    const mine = walker.unit.body.stats.num(String(phrase.stats.get("contest_with")));
    // Claimed ground (HOME, CASTLE) adds its security to what lies on it.
    const theirs = resolveSpelled(this.dict, gear.spelled).num(String(phrase.stats.get("contested_by"))) + this.claimAt(thing.owner, thing, targetId).security;
    const [by, against] = [phrase.stats.get("contested_by"), phrase.stats.get("contest_with")].map((p) => String(p).replaceAll("_", " "));
    if (mine < theirs) throw new Error(`${gear.phrase.toUpperCase()} is too well guarded (${by} ${theirs} against your ${against} ${mine})`);
    this.clients.find((c) => c.sessionId === thing.owner)?.send("notice", `Your ${gear.phrase.toUpperCase()} was stolen`);
    thing.owner = id;
    for (const k of this.radiating.get(gear)?.keys ?? []) { const a = this.areas.get(k); if (a) a.owner = id; }
    const producer = this.producers.get(targetId);
    if (producer) producer.owner = id;
    walker.foe = null;
    return `${gear.phrase.toUpperCase()} is yours`;
  }

  /**
   * THEFT on a creature, owned or wild: it becomes yours if your stealth meets the better of its
   * security and its loyalty (shared `theftResistance`). It then counts against your command.
   */
  private stealCreature(id: string, walker: Walker, phrase: Phrase, targetId: string, creature: Walker): string {
    const word = phrase.noun.toUpperCase(), name = creature.player.name.toUpperCase();
    if (creature.master === id) throw new Error("That is already yours");
    const reach = Math.max(1.5, phrase.stats.num("placement_range") / TILE_METERS);
    if (Math.hypot(creature.player.x - walker.player.x, creature.player.y - walker.player.y) > reach) throw new Error(`Too far away for ${word}`);
    const by = String(phrase.stats.get("contested_by")), wit = String(phrase.stats.get("contest_with"));
    const mine = walker.unit.body.stats.num(wit);
    const theirs = theftResistance(creature.unit.body.stats, by) + this.claimAt(creature.master ?? "", creature.player, targetId).security;
    if (mine < theirs) throw new Error(`${name} will not leave its master (loyalty or ${by} ${theirs} against your ${wit} ${mine})`.replaceAll("_", " "));
    const before = creature.master;
    this.clients.find((c) => c.sessionId === before)?.send("notice", `Your ${name} was stolen`);
    this.setMaster(targetId, creature, id);
    walker.foe = null;
    this.command(id);
    return `${name} is yours`;
  }

  /** A word that acts on the sky or the weather over the whole map. */
  private sky(id: string, phrase: Phrase, name: string): string {
    const s = phrase.stats, def = this.dict.word(phrase.noun)!;
    const daylight = String(s.get("sets_daylight"));
    const clears = s.tags("clears_weather");
    const weather = String(s.get("sets_weather"));
    const minutes = s.num("field_duration") || s.num("persistence");
    const by = this.walkers.get(id)?.player.name ?? "";
    const ends = minutes > 0 && Number.isFinite(minutes) ? this.elapsed + minutes * 60 : Infinity;
    const word = phrase.noun.toUpperCase();
    let did = "";
    if (daylight !== "none") {
      // A sky word with a length (ECLIPSE, three minutes) gives the old daylight back after.
      const back = this.daylightEnds?.back ?? this.state.daylight;
      this.daylightEnds = ends < Infinity && daylight !== back ? { at: ends, back } : null;
      this.state.daylight = daylight;
      Object.assign(this.state, { daylightWord: phrase.noun, daylightBy: by, daylightUntil: this.daylightEnds ? Math.ceil(ends) : 0 });
      did = `It is ${daylight}${this.daylightEnds ? ` for ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}`;
    }
    if (this.weather && clears.includes(this.weather.word)) { this.clearWeather(); did ||= "The sky clears"; }
    const rules = placeRules(def, s);
    if (weather) {
      this.weather = { word: weather, set: {}, ops: def.ops, until: ends };
      this.weatherRules = rules;
      Object.assign(this.state, { weather, weatherWord: phrase.noun, weatherBy: by, weatherUntil: ends < Infinity ? Math.ceil(ends) : 0 });
      did = `${word} for ${minutes} minutes`;
      if (rules && rules.deposits !== 1) this.deposits.scale(this.map.size / 2, this.map.size / 2, this.map.size * 2, this.elapsed, rules.deposits);
      // Weather that strikes (a STORM's lightning, HAIL) does so everywhere while it lasts.
      if (hasDamage(s) || inflicts(s).length) {
        const area = this.fieldArea(phrase.noun, s, def, id, this.walkers.get(id)?.player ?? { x: 0, y: 0 }, null);
        Object.assign(area, { effect: null, rules: null, until: ends, x: this.map.size / 2, y: this.map.size / 2, radius: this.map.size * 2 });
        this.addArea(area, false);
      }
    } else if (s.num("field_radius") > 0) {
      // A sky word that also lays a field (DROUGHT over a region, an ECLIPSE's dread over the map).
      const area = this.fieldArea(phrase.noun, s, def, id, this.walkers.get(id)?.player ?? { x: 0, y: 0 }, null);
      if (area.rules) area.lodeLeft = this.lodeStock(area.rules);
      area.attack = null; // a body in the sky (the SUN) does not strike the map
      if (acts(area)) {
        for (const [k, a] of this.areas) if (a.owner === id && a.word === phrase.noun) { this.areas.delete(k); this.state.zones.delete(k); }
        this.addArea(area, true);
        const began = this.begin(area, s);
        if (!daylight || daylight === "none") did = `${did ? `${did}; ` : ""}${word} ${area.radius >= this.map.size * 2 ? "over the whole map" : "around you"}${began ? `: ${began}` : ""}`;
        else if (began) did += `: ${began}`;
      }
    }
    const out = this.counter(phrase.noun);
    if (out) did = did ? `${did}; ${out} area${out === 1 ? "" : "s"} ended` : `${out} area${out === 1 ? "" : "s"} ended`;
    if (!did) throw new Error(`${word} does nothing yet`);
    const rates = production(s);
    if (Object.keys(rates).length) this.producers.set(`sky:${phrase.noun}:${id}`, { owner: id, rates, built: {} });
    for (const [wid, w] of this.walkers) if (wid !== id && w.master === null) this.sendTo(wid, "notice", `${by || "Someone"} brought ${word}`);
    for (const w of this.walkers.values()) this.rebuild(w);
    this.refreshViews();
    return did;
  }

  private clearWeather() {
    const was = this.state.weatherWord;
    for (const [k, a] of this.areas) if (a.word === was && !this.state.zones.has(k)) this.areas.delete(k); // its strikes end with it
    this.weather = null;
    this.weatherRules = null;
    Object.assign(this.state, { weather: "", weatherWord: "", weatherBy: "", weatherUntil: 0 });
  }

  /** Writes a struck unit's damage back to its walker; destroyed gear is gone for good. */
  private settle(id: string, walker: Walker) {
    const client = this.clients.find((c) => c.sessionId === id);
    walker.hp = walker.unit.body.integrity;
    const max = walker.unit.body.stats.num("integrity");
    walker.player.hp = Math.min(100, Math.max(0, Math.ceil((walker.hp / max) * 100)));
    let lost = false;
    for (const g of [...walker.gear]) {
      const layer = walker.unit.entityFor(g.spelled);
      if (!layer) continue;
      g.integrity = layer.integrity;
      if (layer.integrity <= 0) {
        walker.gear.splice(walker.gear.indexOf(g), 1);
        client?.send("notice", `Your ${g.phrase.toUpperCase()} was destroyed`);
        lost = true;
      }
    }
    if (lost) this.rebuild(walker);
    else this.tell(walker);
    if (walker.master) { const m = this.walkers.get(walker.master); if (m) this.tell(m); }
  }

  /** Knocks a player out of the round. Their letters go to the killer; their gear falls. */
  private kill(id: string, killerId: string) {
    const dead = this.walkers.get(id);
    if (!dead) return;
    // A creature's kill is its master's.
    const [payId, killer] = this.payee(killerId) ?? ["", undefined];
    const client = this.clients.find((c) => c.sessionId === id);
    if (killer && payId !== id) {
      const loot = Object.entries(dead.letters).map(([ch, n]) => (n > 0 ? ch.repeat(n) : "")).join("");
      this.award(payId, killer, loot, `${dead.player.name.toUpperCase()}'s letters`, dead.player);
      const kc = this.clients.find((c) => c.sessionId === payId);
      // K comes from kills of people, V from beating someone's creature, H from hunting the wild;
      // the place's rules multiply them (a WAR over it: K ×3, a SAFARI: H ×3).
      const kind = dead.master === null ? "person" : dead.master === "-" ? "wild" : "owned";
      const base = killLetters(kind, dead.unit.body.stats.flag("sentient"));
      let spoils = "";
      const name = dead.player.name.toUpperCase(), at = { x: dead.player.x, y: dead.player.y };
      // A hunted body feeds the hunter by its mass (shared `carcassFood`): a COW far more than a CHICKEN.
      const meat = dead.master !== null && !dead.unit.body.stats.flag("sentient") ? carcassFood(dead.unit.body.stats, dead.player.count) : 0;
      killer.stores.food += meat;
      const owner = kind === "owned" ? this.walkers.get(dead.master!)?.player.name : undefined;
      for (const ch of new Set(base)) {
        const why = ch === "h" ? `hunted ${name}${meat ? ` (+${meat} food)` : ""}`
          : ch === "v" ? `beat ${owner ? `${owner}'s ` : ""}${name}`
          : `kill ${name}`;
        spoils += this.earn(payId, base.split("").filter((c) => c === ch).join(""), at, why);
      }
      if (kind === "wild") kc?.send("letters", killer.letters);
      if (meat) this.toTell.add(payId); // the food store on the HUD
      for (const k of SUPPLIES) killer.stores[k] += dead.stores[k]; // and their stores
      if (kind !== "wild") {
        kc?.send("letters", killer.letters);
        kc?.send("notice", `You killed ${dead.player.name} and took their letters`);
      }
    }
    this.unradiateAll(id); // what it carried radiates where it falls instead
    for (const g of dead.gear) this.addThing(g, "", dead.player.x, dead.player.y);
    client?.send("letters", {});
    client?.send("dead", killer?.player.name ?? "something");
    this.walkers.delete(id);
    this.state.players.delete(id);
    // The knocked out watch whoever knocked them out (a creature's master), and when that one falls, their killer.
    const next = this.blame(killerId);
    if (client) this.watchers.set(id, { watch: id, seen: dead.seen, seenThings: dead.seenThings });
    for (const [cid, v] of this.watchers) {
      if (v.watch !== id || !next) continue;
      v.watch = next;
      this.sendTo(cid, "watching", { id: next, name: this.walkers.get(next)!.player.name });
    }
    const owner = dead.master ? this.walkers.get(dead.master) : undefined;
    if (owner) this.tell(owner);
    for (const w of this.walkers.values()) {
      if (w.foe === id) w.foe = null;
      if (w.picked === id) w.picked = null;
      if (w.master === id) { w.master = "-"; w.player.owner = "-"; this.showStatus(w); } // creatures outlive their master, ownerless
    }
    if (dead.master === null && this.people.length === 1 && this.everJoined > 1) {
      const [winnerId] = this.people;
      this.clients.find((c) => c.sessionId === winnerId)?.send("won", "You are the last one alive");
      this.endRound(this.walkers.get(winnerId!)!.player.name);
    }
    this.refreshViews();
  }

  /**
   * Whom to watch after `killerId` knocks someone out: its master if it is someone's creature, else
   * itself; if it is gone (an area whose maker left), whoever is still in the round.
   */
  private blame(killerId: string): string | null {
    const k = this.walkers.get(killerId);
    if (k?.master && k.master !== "-" && this.walkers.has(k.master)) return k.master;
    if (k) return killerId;
    return this.people[0] ?? null;
  }

  /** One strike on a thing lying on the ground. Destroying things is where D comes from. */
  private strikeThing(attackerId: string, attack: Stats, id: string, thing: Thing, ranged = false) {
    const gear = this.grounded.get(id)!;
    let entity = this.thingEntities.get(id);
    if (!entity) {
      entity = spawn(gear.phrase, resolveSpelled(this.dict, gear.spelled));
      if (gear.integrity !== null) entity.integrity = gear.integrity;
      this.thingEntities.set(id, entity);
    }
    const before = entity.integrity;
    const r = strike(attack, entity, this.rng);
    this.blow(attackerId, id, { ...r, damage: before - Math.max(0, entity.integrity) }, "", ranged);
    // On its owner's claimed ground a thing takes only part of the blow.
    const { shelter } = this.claimAt(thing.owner, thing, id);
    if (shelter > 0 && entity.integrity < before) entity.integrity = before - (before - entity.integrity) * (1 - Math.min(1, shelter));
    gear.integrity = entity.integrity;
    thing.hp = Math.max(0, Math.ceil((entity.integrity / entity.stats.num("integrity")) * 100));
    if (entity.integrity > 0) return;
    // Pays whoever struck it, or the master of the creature that did.
    const [payId, w] = this.payee(attackerId) ?? ["", undefined];
    const client = this.clients.find((c) => c.sessionId === payId);
    const theirs = thing.owner !== "" && thing.owner !== payId;
    if (w) {
      // D for destroying; V for another player's thing; F if it burnt; X from a ruin.
      const base = destroyLetters(theirs, attack.num("dmg_fire") > 0, gear.fixture === "ruin");
      let spoils = "";
      const name = gear.phrase.toUpperCase(), owner = theirs ? this.walkers.get(thing.owner)?.player.name : undefined;
      const reasons: Record<string, string> = { d: `broke ${name}`, v: `beat ${owner ? `${owner}'s ` : ""}${name}`, f: `burned ${name}`, x: `broke ${name}` };
      for (const ch of new Set(base)) spoils += this.earn(payId, base.split("").filter((c) => c === ch).join(""), thing, reasons[ch] ?? name);
      client?.send("letters", w.letters);
      client?.send("notice", `${gear.phrase.toUpperCase()} destroyed: + ${spoils.toUpperCase()}`);
    }
    if (theirs) this.clients.find((c) => c.sessionId === thing.owner)?.send("notice", `Your ${gear.phrase.toUpperCase()} was destroyed`);
    this.removeThing(id);
    for (const other of this.walkers.values()) {
      if (other.foe === id) other.foe = null;
      if (other.picked === id) other.picked = null;
    }
    this.refreshViews();
  }

  /**
   * The rules in force at a point for one walker (shared `placeRules`): the weather's, and every
   * area covering the point that reaches them (a field reaches only whom it targets).
   */
  private rulesAt(p: Point, wid?: string, w?: Walker): { rules: PlaceRules[]; areas: Area[] } {
    const rules: PlaceRules[] = this.weatherRules ? [this.weatherRules] : [];
    const areas: Area[] = [];
    for (const a of this.areas.values()) {
      if (!a.rules || Math.hypot(p.x - a.x, p.y - a.y) > a.radius) continue;
      if (a.effect && wid && w && !this.aims(a, wid, w)) continue;
      rules.push(a.rules);
      areas.push(a);
    }
    return { rules, areas };
  }

  /** The first area whose law forbids an act to a walker where it stands, if any. */
  private lawAgainst(act: string, wid: string, w: Walker, at: Point = w.player): string | null {
    for (const a of this.rulesAt(at, wid, w).areas) if (a.rules!.law.includes(act)) return a.word.toUpperCase();
    return null;
  }

  /**
   * Letters a person earns at a place: the place's rules multiply them (DROUGHT: no A; WAR: K
   * ×3; `bonus` is the earner's own `harvest_bonus` for gathering), then any area that taxes
   * others there (`tax_rate`) takes its share for its maker. Returns what they kept.
   */
  private earn(id: string, letters: string, at: Point, why: string, bonus = 1): string {
    const w = this.walkers.get(id);
    if (!w || !letters) return "";
    const { rules, areas } = this.rulesAt(at, id, w);
    let got = harvest(letters, rules, this.rng, bonus);
    for (const a of areas) {
      if (!(a.rules!.tax > 0) || a.owner === id || w.master === a.owner) continue;
      const taxer = this.walkers.get(a.owner);
      if (!taxer) continue;
      let kept = "", taken = "";
      for (const ch of got) (this.rng() < a.rules!.tax ? (taken += ch) : (kept += ch));
      if (!taken) continue;
      got = kept;
      this.award(a.owner, taxer, taken, `${a.word.toUpperCase()} on ${w.player.name}`, at);
      this.lettersChanged.add(a.owner);
      this.sendTo(id, "notice", `${a.word.toUpperCase()}: ${taken.toUpperCase()} went to ${taxer.player.name}`);
    }
    this.award(id, w, got, why, at);
    this.lettersChanged.add(id);
    return got;
  }

  /**
   * Makes a thing nobody owns yours where it stands: a ruin, something abandoned, the things of
   * someone who fell. It then works for you like anything you spelled: it radiates for your side
   * (a claim, shelter), makes its letters for you, and destroying it is no longer a win over anyone.
   */
  claim(id: string, walker: Walker, thingId: string, gear: Gear) {
    const thing = this.state.things.get(thingId)!;
    thing.owner = id;
    const stats = this.statsOf(gear);
    const rates = production(stats);
    if (Object.keys(rates).length) this.producers.set(thingId, { owner: id, rates, built: {} });
    this.radiate(gear, gear.spelled, thingId, id, { x: thing.x, y: thing.y }, null, Number(this.dict.base(gear.spelled.noun, "sight_range")));
    const makes = Object.keys(rates).map((l) => l.toUpperCase()).join(" ");
    this.sendTo(id, "spelled", `${gear.phrase.toUpperCase()} is yours${makes ? `: it makes ${makes}` : ""}`);
    this.tell(walker);
    this.refreshViews();
  }

  /**
   * Notes one blow for the clients that can see it (`flushHits`, once a tick): who struck, who
   * was struck, how much, which layer took it ("" for the body itself), and how it landed.
   * `from` is an area's key when an area struck; its position stands in for an attacker.
   */
  private blow(by: string, on: string, r: { hit: boolean; critical: boolean; damage: number }, layer: string, ranged: boolean, area?: Area) {
    const kind: Hit["kind"] = !r.hit ? "miss" : r.damage <= 0 ? "blocked" : r.critical ? "crit" : "hit";
    this.hits.push({ by, on, amount: Math.round(r.damage), layer, kind, ranged, ...(area ? { x: area.x, y: area.y } : {}) });
  }

  /**
   * Sends each client the blows it can see, merged per attacker and target (a swarm's hundred
   * stings in a tick are one number), at most HITS_PER_MESSAGE of them. Everyone sees blows on
   * themselves and their own creatures and things, and any blow between two things in their view.
   */
  private flushHits() {
    if (!this.hits.length) return;
    const merged = new Map<string, Hit>();
    for (const h of this.hits) {
      const key = `${h.by}>${h.on}`, m = merged.get(key);
      if (!m) { merged.set(key, { ...h }); continue; }
      m.amount += h.amount;
      if (h.kind === "crit" || (m.kind !== "crit" && h.kind === "hit")) m.kind = h.kind;
    }
    this.hits = [];
    const all = [...merged.values()];
    for (const client of this.clients) {
      const own = this.walkers.get(client.sessionId), watching = own ? undefined : this.watchers.get(client.sessionId);
      const seen = (own ?? watching)?.seen, seenThings = (own ?? watching)?.seenThings;
      const sees = (id: string) => id === client.sessionId || !!seen?.has(id) || !!seenThings?.has(id);
      const mine = all.filter((h) => sees(h.on) || sees(h.by)).slice(0, HITS_PER_MESSAGE);
      if (mine.length) client.send("hits", mine);
    }
  }

  /** Who is paid for what a walker does: a person themself, a creature's master; nobody for the wild. */
  private payee(id: string): [string, Walker] | null {
    const w = this.walkers.get(id);
    if (!w || w.master === "-") return null;
    if (w.master === null) return [id, w];
    const m = this.walkers.get(w.master);
    return m ? [w.master, m] : null;
  }

  /**
   * "trade eee for o" at a market within MARKET.range: MARKET.ratio letters for each one asked
   * for (not the rare ones), and a T for every trade. A market has MARKET.stock trades in hand
   * and takes on one more every MARKET.regen seconds.
   */
  private trade(id: string, walker: Walker, give: string, get: string): string {
    let best: string | null = null, bestD = MARKET.range;
    for (const mid of this.markets.keys()) {
      const t = this.state.things.get(mid);
      const d = t ? Math.hypot(t.x - walker.player.x, t.y - walker.player.y) : Infinity;
      if (d <= bestD) { best = mid; bestD = d; }
    }
    if (!best) throw new Error("Trade at a MARKET: there is one in the middle of every city");
    // The market's place sets its price (INFLATION doubles it) and may shut it (an EMBARGO).
    const market = this.state.things.get(best)!;
    const closed = this.lawAgainst("trade", id, walker, market);
    if (closed) throw new Error(`${closed}: this market is closed`);
    const problem = tradeProblem(give, get, marketRatio(tradeRateOf(this.rulesAt(market, id, walker).rules)));
    if (problem) throw new Error(problem);
    const m = this.markets.get(best)!;
    m.stock = Math.min(MARKET.stock, m.stock + (this.elapsed - m.at) / MARKET.regen);
    m.at = this.elapsed;
    if (m.stock < get.length) throw new Error(`This market has traded all it can for now: ${Math.ceil((get.length - m.stock) * MARKET.regen)} s`);
    const lacking = missing(walker.letters, give);
    if (lacking) throw new Error(`You need ${lacking.toUpperCase().split("").join(" ")}`);
    m.stock -= get.length;
    spend(walker.letters, give);
    this.award(id, walker, get, "trade");
    const t = this.earn(id, "t".repeat(get.length), market, "trade");
    this.sendTo(id, "letters", walker.letters);
    const done = `Traded ${give.toUpperCase()} for ${get.toUpperCase()}${t ? `, and ${t.toUpperCase()} for the trade` : ""}`;
    this.sendTo(id, "spelled", done);
    return done;
  }

  /** Lays terrain and moves anyone now standing where they cannot onto the nearest ground. */
  reshape(x: number, y: number, radius: number, tile: number) {
    const stamp = { x, y, radius, tile };
    stampTerrain(this.map, stamp);
    this.state.edits.push(Object.assign(new Edit(), stamp));
    for (const w of this.walkers.values()) {
      // Ashore, and never boxed into a pocket of a tile or two by the new land: they could not take a step.
      const safe = w.flying ? w.player : openGround(this.map, w.player);
      if (safe !== w.player) { w.player.x = safe.x; w.player.y = safe.y; w.target = null; }
      w.routeTo = null; // the land changed: routes must be worked out again
    }
  }

  removeThing(id: string) {
    const t = this.state.things.get(id);
    if (!t) return;
    this.unradiateAll(id);
    const cell = this.thingGrid.get(thingKey(t.x, t.y));
    if (cell) cell.splice(cell.indexOf(id), 1);
    this.state.things.delete(id);
    this.grounded.delete(id);
    this.producers.delete(id);
    this.thingEntities.delete(id);
  }

  addThing(gear: Gear, owner: string, x: number, y: number): string {
    const id = `t${this.nextThing++}`;
    this.grounded.set(id, gear);
    const phrase = gear.phrase;
    const thing = new Thing();
    thing.phrase = phrase;
    thing.count = gear.spelled.count ?? 1;
    thing.hp = 100;
    thing.owner = owner;
    thing.fixture = gear.fixture ?? "";
    thing.x = x;
    thing.y = y;
    this.state.things.set(id, thing);
    const k = thingKey(x, y);
    (this.thingGrid.get(k) ?? this.thingGrid.set(k, []).get(k)!).push(id);
    // A thing on the ground radiates around itself, by its own sight, while it lies there.
    const sight = Number(this.dict.base(gear.spelled.noun, "sight_range"));
    this.radiate(gear, gear.spelled, id, owner, { x, y }, null, sight);
    return id;
  }

  /**
   * One tick, guarded: a rule that throws is logged and the world goes on (a throw used to stop
   * the room's clock for good), and a slow tick is logged with what the room held.
   */
  safeUpdate(seconds: number) {
    const started = performance.now();
    try {
      this.update(seconds);
    } catch (e) {
      if (this.tickErrors++ < 20) console.error(`[room ${this.roomId}] tick failed:`, e);
    }
    const ms = performance.now() - started;
    if (ms > SLOW_TICK_MS) {
      console.warn(`[room ${this.roomId}] slow tick ${ms.toFixed(0)} ms: ${this.walkers.size} walkers, ${this.state.things.size} things, ${this.areas.size} areas, ${this.clients.length} clients`);
    }
  }

  update(seconds: number) {
    const started = performance.now();
    this.elapsed += seconds;
    this.routesLeft = ROUTES_PER_TICK;
    if (this.weather && this.elapsed >= this.weather.until) {
      this.clearWeather();
      for (const w of this.walkers.values()) this.rebuild(w);
    }
    if (this.daylightEnds && this.elapsed >= this.daylightEnds.at) {
      this.state.daylight = this.daylightEnds.back;
      this.daylightEnds = null;
      Object.assign(this.state, { daylightWord: "", daylightBy: "", daylightUntil: 0 });
      for (const w of this.walkers.values()) this.rebuild(w);
    }
    for (const [id, w] of this.walkers) {
      if (w.buffs.some((b) => this.elapsed >= b.until)) {
        const over = w.buffs.filter((b) => this.elapsed >= b.until);
        w.buffs = w.buffs.filter((b) => this.elapsed < b.until);
        this.rebuild(w);
        this.clients.find((c) => c.sessionId === id)?.send("notice", `${over.map((b) => b.word.toUpperCase()).join(", ")} wore off`);
      }
      if (w.target && w.hamper.moves && (w.route.length || w.flying || this.routesLeft > 0 || this.steered(w))) this.walk(w, seconds);
    }
    for (const [id, w] of [...this.walkers]) if (w.statuses.length && this.walkers.has(id)) this.sufferStatuses(id, w, seconds);
    for (const [key, a] of [...this.areas]) this.burn(key, a, seconds);
    // Once a second (or for however long a tick ran): morale, command, upkeep and the wild.
    if (this.elapsed - this.lastBeat >= 1) {
      const since = this.elapsed - this.lastBeat;
      this.lastBeat = this.elapsed;
      this.beat(since);
    }
    this.think();
    this.thinkBots();
    this.compel();
    // Combat: each attacker strikes its foe whenever the foe is in reach.
    for (const [id, w] of [...this.walkers]) {
      w.cooldown = Math.max(0, w.cooldown - seconds);
      const foeId = w.foe;
      if (!foeId || !this.walkers.has(id)) continue;
      const foe = this.walkers.get(foeId);
      const thing = foe ? undefined : this.state.things.get(foeId);
      const at = foe?.player ?? thing;
      if (!at) { w.foe = null; continue; }
      if (!w.hamper.acts || w.fleeing) continue; // stunned, frozen, asleep, afraid or broken
      if (w.hamper.spares.includes(foeId)) { w.foe = null; continue; } // charmed: will not hurt the charmer
      // A SANCTUARY, a TRUCE: nobody it reaches strikes, or is struck, inside it.
      const truce = this.lawAgainst("attack", id, w) ?? (foe ? this.lawAgainst("attack", foeId, foe) : null);
      if (truce) { if (w.master === null) this.sendTo(id, "refused", `${truce}: no fighting here`); w.foe = null; continue; }
      const attack = w.unit.attack;
      const reach = Math.max(1, attack.num("attack_range") / TILE_METERS);
      if (Math.hypot(at.x - w.player.x, at.y - w.player.y) > reach) {
        w.target = { x: at.x, y: at.y }; // close the distance
        continue;
      }
      w.target = null;
      if (w.cooldown > 0) continue;
      // A machine with no fuel or power cannot fire.
      if (this.strikesWith(w)?.stalled) { w.cooldown = 1; continue; }
      const given = inflicts(attack, w.unit.body.stats);
      let landed = false;
      const ranged = reach > RANGED_TILES;
      if (thing) this.strikeThing(id, w.unit.attack, foeId, thing, ranged);
      else {
        const r = strikeUnit(w.unit, foe!.unit, this.rng, moraleAim(w.morale));
        landed = r.hit;
        this.blow(id, foeId, r, r.on === foe!.unit.body.name ? "" : r.on, ranged);
      }
      const rate = attack.num("attack_rate") * w.hamper.tempo;
      w.cooldown = rate > 0 ? 1 / rate : 1 / w.hamper.tempo;
      if (attack.flag("single_use") && w.unit.weapon) {
        const spent = w.unit.weapon; // a grenade is gone once thrown
        w.gear = w.gear.filter((g) => g.spelled !== spent);
        this.rebuild(w);
      }
      if (!foe) continue;
      this.settle(foeId, foe);
      if (foe.unit.dead) this.kill(foeId, id);
      else if (landed) this.hurtWith(foe, given, id, id, true);
    }
    const changed = new Set<string>();
    for (const [id, w] of this.walkers) {
      if (w.gathering <= 0) continue;
      w.gathering -= seconds;
      if (w.gathering > 0) continue;
      w.gathering = 0;
      const client = this.clients.find((c) => c.sessionId === id);
      const banned = this.lawAgainst("gather", id, w);
      if (banned) { client?.send("refused", `${banned}: no gathering here`); continue; }
      // A lode in force here (a BONANZA, a METEOR's crater) turns up its letters first.
      const place = this.rulesAt(w.player, id, w);
      const lode = place.areas.find((a) => a.rules!.lode.length && a.rules!.lodeShare > 0 && a.lodeLeft >= 1);
      const got = lode && this.rng() < lode.rules!.lodeShare
        ? { letter: lode.rules!.lode[Math.floor(this.rng() * lode.rules!.lode.length)]!, from: lode.word }
        : this.deposits.gather(w.player.x, w.player.y, this.elapsed, this.rng, growthOf(place.rules));
      if (lode && "from" in got && got.from === lode.word) lode.lodeLeft--;
      w.stores.food += groundFood(tileAt(this.map, w.player.x, w.player.y)); // a little forage where things grow
      if (got.letter) {
        const from = "from" in got ? got.from : "", site = this.state.things.get(from);
        const why = lode && from === lode.word ? lode.word.toUpperCase()
          : site ? (got.letter === "q" ? "temple" : "cache") : GATHER_REASONS[from as keyof typeof GATHER_REASONS] ?? "gathered";
        const kept = this.earn(id, got.letter, site ?? w.player, why, w.unit.body.stats.num("harvest_bonus"));
        changed.add(id);
        if (kept) client?.send("gathered", kept);
        else client?.send("refused", `Nothing grows here: ${place.areas.find((a) => harvest(got.letter, [a.rules!], () => 0.999) === "")?.word.toUpperCase() ?? "the weather"} took it`);
        if ("emptied" in got && got.emptied) {
          // The bottom of a cache: a prize of everyday letters besides its X.
          this.award(id, w, cachePrize(this.rng), "cache prize", site ?? w.player);
          this.removeThing(got.emptied);
          this.refreshViews();
        }
      } else if ("why" in got) {
        client?.send("refused", got.why);
      }
    }
    // The first visit to each region gives a person one J.
    for (const [id, w] of this.walkers) {
      if (!w.explored) continue;
      const region = regionOf(w.player.x, w.player.y);
      if (w.explored.has(region)) continue;
      w.explored.add(region);
      const j = this.earn(id, "j", w.player, "new ground");
      changed.add(id);
      if (j) this.sendTo(id, "gathered", j);
    }
    // Objects that produce letters pay their owner as each whole letter builds up.
    for (const [pid, p] of this.producers) {
      const owner = this.walkers.get(p.owner);
      if (!owner || this.grounded.get(pid)?.stalled) continue; // a stalled machine makes nothing
      for (const [letter, perMinute] of Object.entries(p.rates)) {
        const built = (p.built[letter] ?? 0) + (perMinute * seconds) / 60;
        const whole = Math.floor(built);
        p.built[letter] = built - whole;
        // What it makes is earned where it stands (a thing) or where its owner is (a field, the sky).
        if (whole > 0) {
          const t = this.state.things.get(pid);
          this.earn(p.owner, letter.repeat(whole), t ?? owner.player, (this.grounded.get(pid)?.phrase ?? t?.phrase ?? pid.replace(/^field:.*/, "field")).toUpperCase());
          changed.add(p.owner);
        }
      }
    }
    for (const id of this.lettersChanged) changed.add(id);
    this.lettersChanged.clear();
    for (const id of changed) {
      const w = this.walkers.get(id);
      if (w) this.clients.find((c) => c.sessionId === id)?.send("letters", w.letters);
    }
    this.tellMoods();
    this.flushHits();
    for (const id of this.toTell) { const w = this.walkers.get(id); if (w) this.tell(w); }
    this.toTell.clear();
    // Once a second: fields follow people about, so work out again who stands in which.
    if ((this.tickCount % TICK_HZ === 0 && this.areas.size) || this.fieldsDirty) this.applyFields();
    // Once a second, anyone with a verb in force is told how long it has left.
    if (this.tickCount % TICK_HZ === 0) for (const w of this.walkers.values()) if (w.buffs.length || w.statuses.length) this.tell(w);
    if (this.tickCount++ % VIEW_EVERY === 0) this.refreshViews();
    const ms = performance.now() - started;
    this.metrics.ticks++;
    this.metrics.tickMsTotal += ms;
    this.metrics.tickMsMax = Math.max(this.metrics.tickMsMax, ms);
  }

  /** Puts in each client's view exactly the players and things within its sight range. */
  refreshViews() {
    // Bucket players into cells one sight range wide, so each client checks nine cells.
    // Only people have views, so only their sight sets the cell size; a far-sighted creature must not.
    const cell = Math.max(1, ...this.clients.map((c) => this.walkers.get(c.sessionId)?.sight ?? 0));
    const grid = new Map<number, string[]>();
    const key = (x: number, y: number) => Math.floor(x / cell) * 4096 + Math.floor(y / cell);
    for (const [id, w] of this.walkers) {
      const k = key(w.player.x, w.player.y);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(id);
    }
    for (const client of this.clients) {
      // The knocked out see what their killer sees (`watchers`), with their own record of what is in view.
      const own = this.walkers.get(client.sessionId), watching = own ? undefined : this.watchers.get(client.sessionId);
      const me = own ?? (watching && this.walkers.get(watching.watch));
      if (!me || !client.view) continue;
      const seenBy = own ?? watching!;
      const now = new Set([own ? client.sessionId : watching!.watch]);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const id of grid.get(key(me.player.x + dx * cell, me.player.y + dy * cell)) ?? []) {
            const other = this.walkers.get(id)!.player;
            if (Math.hypot(other.x - me.player.x, other.y - me.player.y) <= me.sight) now.add(id);
          }
        }
      }
      for (const id of now) if (!seenBy.seen.has(id)) client.view.add(this.walkers.get(id)!.player);
      for (const id of seenBy.seen) {
        if (!now.has(id)) {
          const gone = this.walkers.get(id)?.player;
          if (gone) client.view.remove(gone);
        }
      }
      seenBy.seen = now;

      const things = new Set<string>();
      const reach = Math.ceil(me.sight / THING_CELL);
      for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
          for (const id of this.thingGrid.get(thingKey(me.player.x + dx * THING_CELL, me.player.y + dy * THING_CELL)) ?? []) {
            const t = this.state.things.get(id);
            if (t && Math.hypot(t.x - me.player.x, t.y - me.player.y) <= me.sight) things.add(id);
          }
        }
      }
      for (const id of things) if (!seenBy.seenThings.has(id)) client.view.add(this.state.things.get(id)!);
      for (const id of seenBy.seenThings) {
        const gone = this.state.things.get(id);
        if (!things.has(id) && gone) client.view.remove(gone);
      }
      seenBy.seenThings = things;
    }
  }
}
