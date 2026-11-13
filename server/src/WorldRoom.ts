import { Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import {
  addLetters, GATHER_SECONDS, gatherLetter, generateMap, GIVE_RANGE, missing, parsePhrase, production, randomWalkable, resolve, seeded, spend, stepToward, TILE_METERS,
  type Dictionary, type Letters, type Point, type WorldMap,
} from "@lastword/shared";
import { loadDictionary } from "./data.js";
import { Player, Thing, WorldState } from "./state.js";

/** Simulation steps per second. */
export const TICK_HZ = 10;
/** How often each client's view is recomputed, in ticks. */
const VIEW_EVERY = 5;

interface Walker {
  player: Player;
  target: Point | null;
  speed: number;
  /** Sight range in tiles. */
  sight: number;
  seen: Set<string>;
  seenThings: Set<string>;
  /** Held letters. Private: sent to their owner by message, never put in shared state. */
  letters: Letters;
  /** Seconds left on a gathering action, or 0. Moving cancels it. */
  gathering: number;
}

/** An object's letter output: rate per minute and the fraction built up so far. */
interface Producer { owner: string; rates: Letters; built: Letters }

/** Placeholder until letter sources exist (M4): enough to spell SWORD plus a random handful. */
function starterLetters(rng: () => number): Letters {
  const common = "eeeeeeeeeeeiiiiiiiiaaaaaaaarrrrrrrnnnnnnnttttttoooooosssssslllllccccuuuudddpppmmmhhggyybb";
  const hand: Letters = {};
  for (const ch of "sword") hand[ch] = (hand[ch] ?? 0) + 1;
  for (let i = 0; i < 20; i++) {
    const ch = common[Math.floor(rng() * common.length)]!;
    hand[ch] = (hand[ch] ?? 0) + 1;
  }
  return hand;
}

/** Cell width, in tiles, of the grid that things are bucketed into. */
const THING_CELL = 16;
const thingKey = (x: number, y: number) => Math.floor(x / THING_CELL) * 4096 + Math.floor(y / THING_CELL);

/** Every live room in this process, for metrics. */
export const liveRooms = new Set<WorldRoom>();

export interface RoomMetrics { ticks: number; tickMsTotal: number; tickMsMax: number }

/** One map instance. The room owns all state; clients only send intents. */
export class WorldRoom extends Room {
  state = new WorldState();
  maxClients = 100;
  patchRate = 1000 / TICK_HZ;

  map!: WorldMap;
  metrics: RoomMetrics = { ticks: 0, tickMsTotal: 0, tickMsMax: 0 };
  private dict!: Dictionary;
  private rng = seeded(Date.now());
  private walkers = new Map<string, Walker>();
  private tickCount = 0;
  private thingGrid = new Map<number, string[]>();
  private nextThing = 1;
  private producers = new Map<string, Producer>();

  messages = {
    /** Walk toward a point on the map. */
    move: (client: Client, to: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      const p = to as Partial<Point> | null;
      if (!walker || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
      walker.target = { x: clamp(p.x!), y: clamp(p.y!) };
      walker.gathering = 0;
    },
    /** Stand still and gather a letter from the ground. */
    gather: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker || walker.gathering > 0) return;
      walker.target = null;
      walker.gathering = GATHER_SECONDS;
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
        addLetters(to.letters, o.letters);
        client.send("letters", from.letters);
        client.send("notice", `Gave ${o.letters.toUpperCase()} to ${o.to}`);
        const receiver = this.clients.find((c) => c.sessionId === toId);
        receiver?.send("letters", to.letters);
        receiver?.send("notice", `${from.player.name} gave you ${o.letters.toUpperCase()}`);
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
    /** Spend letters to make an object where the player stands. */
    spell: (client: Client, text: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      try {
        if (typeof text !== "string" || text.length > 80) throw new Error("Spell something");
        const phrase = parsePhrase(this.dict, text);
        const lacking = missing(walker.letters, phrase.letters);
        if (lacking) throw new Error(`You need ${lacking.toUpperCase().split("").join(" ")}`);
        spend(walker.letters, phrase.letters);
        const name = [...phrase.adjectives, phrase.noun].join(" ");
        const id = this.addThing(name, client.sessionId, walker.player.x, walker.player.y);
        const rates = production(phrase.stats);
        if (Object.keys(rates).length) this.producers.set(id, { owner: client.sessionId, rates, built: {} });
        client.send("letters", walker.letters);
        client.send("spelled", name);
        this.refreshViews();
      } catch (e) {
        client.send("refused", (e as Error).message);
      }
    },
  };

  onCreate() {
    // Options sent by a client are ignored: the room decides its own seed.
    const seed = Math.floor(this.rng() * 2 ** 32);
    this.dict = loadDictionary();
    this.map = generateMap(seed);
    this.state.seed = seed;
    this.state.size = this.map.size;
    this.setTimestep((ms) => this.update(ms / 1000), 1000 / TICK_HZ);
    liveRooms.add(this);
  }

  onDispose() {
    liveRooms.delete(this);
  }

  onJoin(client: Client) {
    const body = resolve(this.dict, "human");
    // CROWD=1 is for load tests: everyone starts in the first city, in sight of each other.
    const city = this.map.cities[0];
    const spot = process.env.CROWD && city
      ? { x: city.x + (this.rng() - 0.5) * 6, y: city.y + (this.rng() - 0.5) * 6 }
      : randomWalkable(this.map, this.rng);
    const player = new Player();
    player.name = `player${this.clients.length}`;
    player.x = spot.x;
    player.y = spot.y;
    this.state.players.set(client.sessionId, player);
    this.walkers.set(client.sessionId, {
      player,
      target: null,
      speed: body.num("speed_land"),
      sight: body.num("sight_range") / TILE_METERS,
      seen: new Set([client.sessionId]),
      seenThings: new Set(),
      letters: starterLetters(this.rng),
      gathering: 0,
    });
    client.send("letters", this.walkers.get(client.sessionId)!.letters);
    client.view = new StateView();
    client.view.add(player);
  }

  onLeave(client: Client) {
    this.walkers.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  addThing(phrase: string, owner: string, x: number, y: number): string {
    const id = `t${this.nextThing++}`;
    const thing = new Thing();
    thing.phrase = phrase;
    thing.owner = owner;
    thing.x = x;
    thing.y = y;
    this.state.things.set(id, thing);
    const k = thingKey(x, y);
    (this.thingGrid.get(k) ?? this.thingGrid.set(k, []).get(k)!).push(id);
    return id;
  }

  update(seconds: number) {
    const started = performance.now();
    for (const w of this.walkers.values()) {
      if (w.target && stepToward(this.map, w.player, w.target, w.speed, seconds)) w.target = null;
    }
    const changed = new Set<string>();
    for (const [id, w] of this.walkers) {
      if (w.gathering <= 0) continue;
      w.gathering -= seconds;
      if (w.gathering > 0) continue;
      w.gathering = 0;
      const letter = gatherLetter(this.map, w.player.x, w.player.y, this.rng);
      const client = this.clients.find((c) => c.sessionId === id);
      if (letter) {
        addLetters(w.letters, letter);
        changed.add(id);
        client?.send("gathered", letter);
      } else {
        client?.send("refused", "Nothing to gather here");
      }
    }
    // Objects that produce letters pay their owner as each whole letter builds up.
    for (const p of this.producers.values()) {
      const owner = this.walkers.get(p.owner);
      if (!owner) continue;
      for (const [letter, perMinute] of Object.entries(p.rates)) {
        const built = (p.built[letter] ?? 0) + (perMinute * seconds) / 60;
        const whole = Math.floor(built);
        p.built[letter] = built - whole;
        if (whole > 0) {
          addLetters(owner.letters, letter.repeat(whole));
          changed.add(p.owner);
        }
      }
    }
    for (const id of changed) {
      this.clients.find((c) => c.sessionId === id)?.send("letters", this.walkers.get(id)!.letters);
    }
    if (this.tickCount++ % VIEW_EVERY === 0) this.refreshViews();
    const ms = performance.now() - started;
    this.metrics.ticks++;
    this.metrics.tickMsTotal += ms;
    this.metrics.tickMsMax = Math.max(this.metrics.tickMsMax, ms);
  }

  /** Puts in each client's view exactly the players and things within its sight range. */
  refreshViews() {
    // Bucket players into cells one sight range wide, so each client checks nine cells.
    const cell = Math.max(1, ...[...this.walkers.values()].map((w) => w.sight));
    const grid = new Map<number, string[]>();
    const key = (x: number, y: number) => Math.floor(x / cell) * 4096 + Math.floor(y / cell);
    for (const [id, w] of this.walkers) {
      const k = key(w.player.x, w.player.y);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(id);
    }
    for (const client of this.clients) {
      const me = this.walkers.get(client.sessionId);
      if (!me || !client.view) continue;
      const now = new Set([client.sessionId]);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const id of grid.get(key(me.player.x + dx * cell, me.player.y + dy * cell)) ?? []) {
            const other = this.walkers.get(id)!.player;
            if (Math.hypot(other.x - me.player.x, other.y - me.player.y) <= me.sight) now.add(id);
          }
        }
      }
      for (const id of now) if (!me.seen.has(id)) client.view.add(this.walkers.get(id)!.player);
      for (const id of me.seen) {
        if (!now.has(id)) {
          const gone = this.walkers.get(id)?.player;
          if (gone) client.view.remove(gone);
        }
      }
      me.seen = now;

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
      for (const id of things) if (!me.seenThings.has(id)) client.view.add(this.state.things.get(id)!);
      for (const id of me.seenThings) {
        const gone = this.state.things.get(id);
        if (!things.has(id) && gone) client.view.remove(gone);
      }
      me.seenThings = things;
    }
  }
}
