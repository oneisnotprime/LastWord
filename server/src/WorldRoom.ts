import { Room, type Client } from "colyseus";
import { StateView } from "@colyseus/schema";
import {
  addLetters, GATHER_SECONDS, gatherLetter, generateMap, GIVE_RANGE, missing, parsePhrase, production, nearestWalkable, randomWalkable, resolve, seeded, spawn, spend, stampTerrain, stepToward, strike, strikeUnit, TILE_METERS, TILE_TYPES, Unit,
  type Dictionary, type Entity, type Letters, type Op, type Phrase, type Point, type Spelled, type Value, type WorldMap,
} from "@lastword/shared";
import { loadDictionary } from "./data.js";
import { Edit, Player, Thing, WorldState } from "./state.js";

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
  /** Part of the land (a lake, a mountain): cannot be picked up or attacked. */
  terrain?: boolean;
}

/** A passing effect on bodies: a verb someone cast, or weather over everyone. */
interface Effect { word: string; set: Record<string, Value>; ops: Op[]; until: number }

/** Sight is multiplied by this at night for anyone without night vision. */
const NIGHT_SIGHT = 0.5;

/** How close, in tiles, a thing on the ground must be to pick it up. */
const TAKE_RANGE = 2;

interface Walker {
  player: Player;
  unit: Unit;
  gear: Gear[];
  /** Body integrity. */
  hp: number;
  /** Who this player is attacking, by session id. */
  foe: string | null;
  /** Seconds until the next strike. */
  cooldown: number;
  /** Verbs in force on this player. */
  buffs: Effect[];
  /** In the air: ground does not block or slow. */
  flying: boolean;
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
  // LETTERS=9 is for trying things out: that many of every letter.
  const plenty = Number(process.env.LETTERS);
  if (plenty > 0) return Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, plenty]));
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
  /** What each thing on the ground is, so it can be picked up again. */
  private grounded = new Map<string, Gear>();
  private everJoined = 0;
  /** Things on the ground that have been attacked, with the damage they carry. */
  private thingEntities = new Map<string, Entity>();
  /** Seconds this room has run. */
  private elapsed = 0;
  /** The weather in force over the whole map, if any. */
  private weather: Effect | null = null;

  messages = {
    /** Walk toward a point on the map. */
    move: (client: Client, to: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      const p = to as Partial<Point> | null;
      if (!walker || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const clamp = (v: number) => Math.min(this.map.size, Math.max(0, v));
      walker.target = { x: clamp(p.x!), y: clamp(p.y!) };
      walker.gathering = 0;
      walker.foe = null; // walking away breaks off an attack
    },
    /** Stand still and gather a letter from the ground. */
    gather: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker || walker.gathering > 0) return;
      walker.target = null;
      walker.gathering = GATHER_SECONDS;
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
      if (!best) return void client.send("refused", "Nothing of yours to pick up here");
      const gear = this.grounded.get(best)!;
      const wearable = gear.vehicle || this.slotOf(gear) !== "none";
      const problem = wearable ? this.equip(walker, gear) : `${gear.phrase.toUpperCase()} cannot be carried`;
      if (problem) return void client.send("refused", problem);
      this.removeThing(best);
      client.send("notice", `${gear.phrase.toUpperCase()} equipped`);
      this.refreshViews();
    },
    /** Put down the last thing you equipped. */
    drop: (client: Client) => {
      const walker = this.walkers.get(client.sessionId);
      const gear = walker?.gear.pop();
      if (!walker || !gear) return;
      this.rebuild(walker);
      this.addThing(gear, client.sessionId, walker.player.x, walker.player.y);
      client.send("notice", `${gear.phrase.toUpperCase()} dropped`);
      this.refreshViews();
    },
    /** Attack another player; the unit strikes whenever the target is in reach. Anything else stops. */
    attack: (client: Client, target: unknown) => {
      const walker = this.walkers.get(client.sessionId);
      if (!walker) return;
      const ok = typeof target === "string" && target !== client.sessionId &&
        (this.walkers.has(target) || (this.grounded.has(target) && !this.grounded.get(target)!.terrain));
      walker.foe = ok ? (target as string) : null;
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
        const name = [...phrase.adjectives, phrase.noun].join(" ");
        if (phrase.kind !== "object") {
          // These throw if they cannot happen, before any letters are spent.
          const done =
            phrase.kind === "verb" ? this.cast(walker, phrase)
            : phrase.kind === "event" ? this.happen(client.sessionId, walker, phrase)
            : this.sky(client.sessionId, phrase, name);
          spend(walker.letters, phrase.letters);
          client.send("letters", walker.letters);
          client.send("spelled", done);
          return;
        }
        spend(walker.letters, phrase.letters);
        const gear: Gear = {
          spelled: { noun: phrase.noun, adjectives: phrase.adjectives },
          phrase: name,
          vehicle: phrase.stats.flag("mountable"),
          integrity: null,
        };
        const wearable = gear.vehicle || phrase.stats.get("equip_slot") !== "none";
        // Things you can hold, wear or ride go straight onto you if there is room; the rest sit on the ground.
        const here = { x: walker.player.x, y: walker.player.y }; // laying terrain may move the speller
        const worn = wearable && this.equip(walker, gear) === null;
        const tile = TILE_TYPES[String(phrase.stats.get("tile_type"))];
        if (tile !== undefined) {
          gear.terrain = true;
          this.reshape(walker.player.x, walker.player.y, phrase.stats.num("radius"), tile);
        }
        if (!worn) {
          const id = this.addThing(gear, client.sessionId, here.x, here.y);
          const rates = production(phrase.stats);
          if (Object.keys(rates).length) this.producers.set(id, { owner: client.sessionId, rates, built: {} });
        }
        client.send("letters", walker.letters);
        client.send("spelled", `${name.toUpperCase()} ${worn ? "equipped" : "made"}`);
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
    this.state.daylight = "day";
    this.state.weather = "";
    this.state.size = this.map.size;
    this.setTimestep((ms) => this.update(ms / 1000), 1000 / TICK_HZ);
    liveRooms.add(this);
  }

  onDispose() {
    liveRooms.delete(this);
  }

  onJoin(client: Client) {
    this.everJoined++;
    const unit = new Unit(this.dict, { body: { noun: "human" } });
    const body = unit.body.stats;
    // CROWD=1 is for load tests: everyone starts in the first city, in sight of each other.
    const city = this.map.cities[0];
    const spot = process.env.CROWD && city
      ? { x: city.x + (this.rng() - 0.5) * 6, y: city.y + (this.rng() - 0.5) * 6 }
      : randomWalkable(this.map, this.rng);
    const player = new Player();
    player.name = `player${this.clients.length}`;
    player.x = spot.x;
    player.y = spot.y;
    player.hp = 100;
    player.gear = "";
    this.state.players.set(client.sessionId, player);
    this.walkers.set(client.sessionId, {
      player,
      unit,
      gear: [],
      hp: unit.body.integrity,
      foe: null,
      cooldown: 0,
      buffs: [],
      flying: false,
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
    for (const w of this.walkers.values()) if (w.foe === client.sessionId) w.foe = null;
    this.walkers.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private slotOf(g: Gear): string {
    return g.vehicle ? "ride" : String(this.dict.base(g.spelled.noun, "equip_slot"));
  }

  /**
   * Puts gear on a walker and rebuilds its unit. Returns null on success, or why it cannot be
   * equipped (no free hand, slot taken, already riding).
   */
  equip(walker: Walker, gear: Gear): string | null {
    const slot = this.slotOf(gear);
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
      body: { noun: "human" },
      items: walker.gear.filter((g) => !g.vehicle).map((g) => g.spelled),
      riding: walker.gear.find((g) => g.vehicle)?.spelled,
      effects: [...(this.weather ? [this.weather] : []), ...walker.buffs],
    });
    unit.body.integrity = walker.hp;
    for (const g of walker.gear) {
      const layer = unit.entityFor(g.spelled);
      if (!layer) continue;
      if (g.integrity === null) g.integrity = layer.integrity;
      else layer.integrity = g.integrity;
    }
    walker.unit = unit;
    const air = unit.movement.num("speed_air");
    walker.flying = air > 0;
    walker.speed = Math.max(unit.movement.num("speed_land"), air);
    const dark = this.state.daylight === "night" && !unit.body.stats.flag("night_vision");
    walker.sight = (unit.body.stats.num("sight_range") * (dark ? NIGHT_SIGHT : 1)) / TILE_METERS;
    walker.player.gear = [...walker.gear.map((g) => g.phrase), ...walker.buffs.map((b) => b.word.toUpperCase())].join(", ");
    if (!walker.flying) {
      const ground = nearestWalkable(this.map, walker.player); // coming down over water puts you ashore
      if (ground !== walker.player) { walker.player.x = ground.x; walker.player.y = ground.y; walker.target = null; }
    }
  }

  /** A verb: a passing effect on the speller's own body. */
  private cast(walker: Walker, phrase: Phrase): string {
    const def = this.dict.word(phrase.noun)!;
    const heal = phrase.stats.num("restores");
    if (heal > 0) walker.hp = Math.min(walker.unit.body.stats.num("integrity"), walker.hp + heal);
    const seconds = phrase.stats.num("duration");
    if (seconds > 0) {
      const { duration, restores, cast_time, effect_status, ...set } = def.set;
      walker.buffs = walker.buffs.filter((b) => b.word !== phrase.noun); // casting again restarts it
      walker.buffs.push({ word: phrase.noun, set, ops: def.ops, until: this.elapsed + seconds });
    }
    this.rebuild(walker);
    walker.player.hp = Math.ceil((walker.hp / walker.unit.body.stats.num("integrity")) * 100);
    return seconds > 0 && seconds < Infinity ? `${phrase.noun.toUpperCase()} for ${seconds} seconds` : phrase.noun.toUpperCase();
  }

  /** An event dropped on the thing the speller has selected. Only ownership changes exist so far. */
  private happen(id: string, walker: Walker, phrase: Phrase): string {
    const word = phrase.noun.toUpperCase();
    if (!phrase.stats.flag("transfers_ownership")) throw new Error(`${word} does nothing yet`);
    const targetId = walker.foe ?? "";
    const thing = this.state.things.get(targetId), gear = this.grounded.get(targetId);
    if (!thing || !gear || gear.terrain) throw new Error(`Select a thing for ${word} first: click it`);
    if (thing.owner === id) throw new Error("That is already yours");
    const reach = Math.max(1.5, phrase.stats.num("placement_range") / TILE_METERS);
    if (Math.hypot(thing.x - walker.player.x, thing.y - walker.player.y) > reach) throw new Error(`Too far away for ${word}`);
    // The speller's own stat against the thing's: stealth against security for a theft.
    const mine = walker.unit.body.stats.num(String(phrase.stats.get("contest_with")));
    const theirs = resolve(this.dict, gear.spelled.noun, gear.spelled.adjectives).num(String(phrase.stats.get("contested_by")));
    if (mine < theirs) throw new Error(`${gear.phrase.toUpperCase()} is too well guarded (${theirs} against your ${mine})`);
    this.clients.find((c) => c.sessionId === thing.owner)?.send("notice", `Your ${gear.phrase.toUpperCase()} was stolen`);
    thing.owner = id;
    const producer = this.producers.get(targetId);
    if (producer) producer.owner = id;
    walker.foe = null;
    return `${gear.phrase.toUpperCase()} is yours`;
  }

  /** A word that acts on the sky or the weather over the whole map. */
  private sky(id: string, phrase: Phrase, name: string): string {
    const s = phrase.stats, def = this.dict.word(phrase.noun)!;
    const daylight = String(s.get("sets_daylight"));
    const clears = s.tags("clears_weather");
    const weather = String(s.get("sets_weather"));
    const minutes = s.num("field_duration") || s.num("persistence");
    let did = "";
    if (daylight !== "none") { this.state.daylight = daylight; did = `It is ${daylight}`; }
    if (this.weather && clears.includes(this.weather.word)) { this.weather = null; this.state.weather = ""; did ||= "The sky clears"; }
    if (weather) {
      this.weather = { word: weather, set: {}, ops: def.ops, until: this.elapsed + (minutes > 0 ? minutes * 60 : Infinity) };
      this.state.weather = weather;
      did = `${name.toUpperCase()} for ${minutes} minutes`;
    }
    if (!did) throw new Error(`${name.toUpperCase()} does nothing yet`);
    const rates = production(s);
    if (Object.keys(rates).length) this.producers.set(`sky:${phrase.noun}:${id}`, { owner: id, rates, built: {} });
    for (const w of this.walkers.values()) this.rebuild(w);
    this.refreshViews();
    return did;
  }

  /** Writes a struck unit's damage back to its walker; destroyed gear is gone for good. */
  private settle(id: string, walker: Walker) {
    const client = this.clients.find((c) => c.sessionId === id);
    walker.hp = walker.unit.body.integrity;
    const max = walker.unit.body.stats.num("integrity");
    walker.player.hp = Math.max(0, Math.ceil((walker.hp / max) * 100));
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
  }

  /** Knocks a player out of the round. Their letters go to the killer; their gear falls. */
  private kill(id: string, killerId: string) {
    const dead = this.walkers.get(id), killer = this.walkers.get(killerId);
    if (!dead) return;
    const client = this.clients.find((c) => c.sessionId === id);
    if (killer) {
      for (const [ch, n] of Object.entries(dead.letters)) if (n > 0) addLetters(killer.letters, ch.repeat(n));
      const kc = this.clients.find((c) => c.sessionId === killerId);
      addLetters(killer.letters, "k"); // K comes from kills
      kc?.send("letters", killer.letters);
      kc?.send("notice", `You killed ${dead.player.name} and took their letters`);
    }
    for (const g of dead.gear) this.addThing(g, "", dead.player.x, dead.player.y);
    client?.send("letters", {});
    client?.send("dead", killer?.player.name ?? "something");
    this.walkers.delete(id);
    this.state.players.delete(id);
    for (const w of this.walkers.values()) if (w.foe === id) w.foe = null;
    if (this.walkers.size === 1 && this.everJoined > 1) {
      const [winnerId] = this.walkers.keys();
      this.clients.find((c) => c.sessionId === winnerId)?.send("won", "You are the last one alive");
    }
    this.refreshViews();
  }

  /** One strike on a thing lying on the ground. Destroying things is where D comes from. */
  private strikeThing(attackerId: string, w: Walker, id: string, thing: Thing) {
    const gear = this.grounded.get(id)!;
    let entity = this.thingEntities.get(id);
    if (!entity) {
      entity = spawn(gear.phrase, resolve(this.dict, gear.spelled.noun, gear.spelled.adjectives));
      if (gear.integrity !== null) entity.integrity = gear.integrity;
      this.thingEntities.set(id, entity);
    }
    strike(w.unit.attack, entity, this.rng);
    gear.integrity = entity.integrity;
    thing.hp = Math.max(0, Math.ceil((entity.integrity / entity.stats.num("integrity")) * 100));
    if (entity.integrity > 0) return;
    const client = this.clients.find((c) => c.sessionId === attackerId);
    const theirs = thing.owner !== "" && thing.owner !== attackerId;
    addLetters(w.letters, theirs ? "dv" : "d"); // V comes from beating another player's things
    client?.send("letters", w.letters);
    client?.send("notice", `${gear.phrase.toUpperCase()} destroyed`);
    if (theirs) this.clients.find((c) => c.sessionId === thing.owner)?.send("notice", `Your ${gear.phrase.toUpperCase()} was destroyed`);
    this.removeThing(id);
    w.foe = null;
    this.refreshViews();
  }

  /** Lays terrain and moves anyone now standing where they cannot onto the nearest ground. */
  reshape(x: number, y: number, radius: number, tile: number) {
    const stamp = { x, y, radius, tile };
    stampTerrain(this.map, stamp);
    this.state.edits.push(Object.assign(new Edit(), stamp));
    for (const w of this.walkers.values()) {
      const safe = nearestWalkable(this.map, w.player);
      if (safe !== w.player) { w.player.x = safe.x; w.player.y = safe.y; w.target = null; }
    }
  }

  removeThing(id: string) {
    const t = this.state.things.get(id);
    if (!t) return;
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
    thing.hp = 100;
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
    this.elapsed += seconds;
    if (this.weather && this.elapsed >= this.weather.until) {
      this.weather = null;
      this.state.weather = "";
      for (const w of this.walkers.values()) this.rebuild(w);
    }
    for (const [id, w] of this.walkers) {
      if (w.buffs.some((b) => this.elapsed >= b.until)) {
        const over = w.buffs.filter((b) => this.elapsed >= b.until);
        w.buffs = w.buffs.filter((b) => this.elapsed < b.until);
        this.rebuild(w);
        this.clients.find((c) => c.sessionId === id)?.send("notice", `${over.map((b) => b.word.toUpperCase()).join(", ")} wore off`);
      }
      if (w.target && stepToward(this.map, w.player, w.target, w.speed, seconds, w.flying)) w.target = null;
    }
    // Combat: each attacker strikes its foe whenever the foe is in reach.
    for (const [id, w] of [...this.walkers]) {
      w.cooldown = Math.max(0, w.cooldown - seconds);
      const foeId = w.foe;
      if (!foeId || !this.walkers.has(id)) continue;
      const foe = this.walkers.get(foeId);
      const thing = foe ? undefined : this.state.things.get(foeId);
      const at = foe?.player ?? thing;
      if (!at) { w.foe = null; continue; }
      const attack = w.unit.attack;
      const reach = Math.max(1, attack.num("attack_range") / TILE_METERS);
      if (Math.hypot(at.x - w.player.x, at.y - w.player.y) > reach) {
        w.target = { x: at.x, y: at.y }; // close the distance
        continue;
      }
      w.target = null;
      if (w.cooldown > 0) continue;
      if (thing) this.strikeThing(id, w, foeId, thing);
      else strikeUnit(w.unit, foe!.unit, this.rng);
      const rate = attack.num("attack_rate");
      w.cooldown = rate > 0 ? 1 / rate : 1;
      if (attack.flag("single_use") && w.unit.weapon) {
        const spent = w.unit.weapon; // a grenade is gone once thrown
        w.gear = w.gear.filter((g) => g.spelled !== spent);
        this.rebuild(w);
      }
      if (!foe) continue;
      this.settle(foeId, foe);
      if (foe.unit.dead) this.kill(foeId, id);
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
