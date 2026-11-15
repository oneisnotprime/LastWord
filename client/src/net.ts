import type { Threat } from "./threats.js";
import { Client } from "@colyseus/sdk";
import type { Letters, LoadoutDetail, Offer, Sensed } from "@lastword/shared";
import { chooseGame } from "./start.js";
import type { KitOffer, KitState } from "./kits.js";

export interface Connection {
  sessionId: string;
  /** Live server state: seed, size, players, things. Read it each frame. */
  state: any;
  move(x: number, y: number): void;
  /** Stop walking where the server has you now. */
  stop(): void;
  spell(text: string): void;
  gather(): void;
  give(to: string, letters: string): void;
  /** E: pick up or claim what is nearest, or the thing named (a click on something nobody owns). */
  take(id?: string): void;
  /** Get off what you ride; it stays yours. */
  dismount(): void;
  /** Drop the item at `index` in the loadout, or the last thing equipped. */
  drop(index?: number): void;
  /** Use (eat, drink, take) something carried, by index, or on the ground, by thing id; nothing for the last usable thing carried, else the nearest. */
  use(which?: number | string): void;
  /** Attack a player by session id; null stops. */
  attack(target: string | null): void;
  /** Put adjectives spelled alone on a player, creature or thing (by id), or on your own gear (your id and its index). */
  describe(text: string, target: string, gear?: number): void;
  /** Pick a target or spot for events without attacking it; null clears. */
  pick(what: { id: string } | { x: number; y: number } | null): void;
  /** Leaves the room for good (a new round elsewhere). */
  leave(): void;
  /** Trading and the like: "market" { give, get }, "sell" { index, get }, "hire" {}, "swap" {}, "transmute" { give }, "offer" { to, give, get }, "answer" { id, accept }. */
  /** Pick a starting kit by its index among those offered. */
  pickKit(step: number, index: number): void;
  act(type: "market" | "sell" | "hire" | "swap" | "transmute" | "offer" | "answer", payload: unknown): void;
}

/** Letters gained and why ("forage", "hunted COW (+12 food)"), and where they came from. */
/** Letters gained: what, why ("forage"), where, and the small print under the popup ("JUNGLE 35% · +10% SHOVEL"). */
export interface Got { letters: string; why: string; x: number; y: number; detail?: string }

/** A grand spelling somewhere on the map (shared `grand`): who, what, what kind, where. */
export interface Entrance { name: string; word: string; kind: string; x: number; y: number; grandeur: number }

/** Adjectives put on something, as everyone in sight of it is told. */
export interface Described { target: string; x: number; y: number; words: string; what: string; changes: string[] }

export interface Handlers {
  letters(held: Letters): void;
  spelled(phrase: string): void;
  refused(reason: string): void;
  gathered(letter: string): void;
  /** A gathering action began: it takes this many seconds unless you move. */
  gathering(seconds: number): void;
  got(what: Got): void;
  /** A gathering try found nothing: where, and the odds it had ("nothing · DESERT 12%"). */
  missed(what: { x: number; y: number; text: string }): void;
  /** Exploring widened your sight (no J: someone was there first). */
  sight(where: { x: number; y: number }): void;
  notice(text: string): void;
  /** Knocked out: who killed you, with what, and the biggest sources of harm in the last seconds. */
  dead(recap: Recap): void;
  loadout(detail: LoadoutDetail): void;
  won(text: string): void;
  roundover(info: RoundRecap): void;
  /** A person died near you, or by someone you can see: the kill feed. */
  killed(line: { killer: string; what: string; victim: string }): void;
  /** Heavy blows shown coming (wind-ups), where they will land. */
  windups(list: Windup[]): void;
  /** Adjectives were put on something in sight: show what changed. */
  described(effect: Described): void;
  /** Knocked out: whom the camera follows now (your killer, then theirs). */
  watching(who: { id: string; name: string }): void;
  /** What your senses (a MAP) pick up, for the minimap. */
  sensed(what: Sensed): void;
  /** The room ended for us: `consented` if we left it ourselves. */
  closed(): void;
  /** The connection dropped; the client is trying to get back in. */
  dropped(): void;
  reconnected(): void;
  /** Blows struck where we can see them. */
  hits(list: Hit[]): void;
  /** Trade offers you have made and been made. */
  offers(list: Offer[]): void;
  /** What is coming for us, seen or not (incoming-threat arrows). */
  threats(list: Threat[]): void;
  /** Starting kits to pick from, and your kit as it stands. */
  kits(offer: KitOffer): void;
  kit(state: KitState): void;
  /** A grand spelling somewhere on the map (a DRAGON, a METEOR): it makes an entrance. */
  entrance(e: Entrance): void;
}

/** One blow, as the server tells it (server `Hit`). */
export interface Hit { by: string; on: string; amount: number; layer: string; kind: "hit" | "crit" | "miss" | "blocked" | "dodged"; ranged: boolean; x?: number; y?: number }
/** A heavy blow winding up (server `Windup`). */
export interface Windup { by: string; on: string; x: number; y: number; seconds: number }
/** How you died (server `recap`): who and what struck last, the top sources of harm, how long it took, how many are left. */
export interface Recap { killer: string; what: string; top: { who: string; what: string; kind: string; amount: number }[]; seconds: number; alive: number }
/** The end of a round: the winner, seconds until the next, the round's length and who killed most. */
export interface RoundRecap { winner: string; seconds: number; clock?: number; kills?: { name: string; kills: number }[]; people?: number }

/**
 * Where the game server is: VITE_SERVER if set at build time; otherwise port 2567 on this host
 * during local development (Vite serves the page on another port), else the page's own origin,
 * since a deployed server serves the page itself.
 */
const endpoint =
  (import.meta.env.VITE_SERVER as string | undefined) ??
  (location.port === "5173" || location.port === "4173" ? `${location.protocol}//${location.hostname}:2567` : location.origin);

/**
 * Asks on the start screen how to play, joins the world room and waits for the first state.
 * Playing with bots starts a fresh room of them; friends share rooms with no bots.
 */
export async function connect(on: Handlers): Promise<Connection> {
  const choice = await chooseGame();
  const client = new Client(endpoint);
  const room: any = choice.bots > 0
    ? await client.create("world", { mode: "bots", bots: choice.bots, difficulty: choice.difficulty })
    : await client.joinOrCreate("world", { mode: "friends", bots: 0 });
  room.onMessage("letters", on.letters);
  room.onMessage("spelled", on.spelled);
  room.onMessage("refused", on.refused);
  room.onMessage("gathered", on.gathered);
  room.onMessage("gathering", on.gathering);
  room.onMessage("got", on.got);
  room.onMessage("missed", on.missed);
  room.onMessage("sight", on.sight);
  room.onMessage("notice", on.notice);
  room.onMessage("dead", on.dead);
  room.onMessage("loadout", on.loadout);
  room.onMessage("won", on.won);
  room.onMessage("roundover", on.roundover);
  room.onMessage("killed", on.killed);
  room.onMessage("windups", on.windups);
  room.onMessage("described", on.described);
  room.onMessage("watching", on.watching);
  room.onMessage("sensed", on.sensed);
  room.onMessage("hits", on.hits);
  room.onMessage("offers", on.offers);
  room.onMessage("threats", on.threats);
  room.onMessage("kits", on.kits);
  room.onMessage("kit", on.kit);
  room.onMessage("entrance", on.entrance);
  room.onLeave(on.closed);
  room.onDrop(on.dropped);
  // Listening now: the server sends the kits to pick from (or your kit), here and after a reconnect.
  room.onReconnect(() => { room.send("ready"); on.reconnected(); });
  room.send("ready");
  await new Promise<void>((done) => {
    const ready = () => room.state?.seed && room.state.players?.get(room.sessionId);
    if (ready()) return done();
    room.onStateChange(() => { if (ready()) done(); });
  });
  return {
    sessionId: room.sessionId,
    get state() { return room.state; },
    move: (x, y) => room.send("move", { x, y }),
    stop: () => room.send("stop"),
    spell: (text) => room.send("spell", text),
    gather: () => room.send("gather"),
    give: (to, letters) => room.send("give", { to, letters }),
    take: (id) => room.send("take", id ? { id } : undefined),
    dismount: () => room.send("dismount"),
    drop: (index) => room.send("drop", index),
    use: (which) => room.send("use", which),
    attack: (target) => room.send("attack", target),
    pick: (what) => room.send("pick", what),
    act: (type, payload) => room.send(type, payload),
    pickKit: (step, index) => room.send("kit", { step, index }),
    leave: () => { room.onLeave.clear?.(); void room.leave(true); },
    describe: (text, target, gear) => room.send("describe", { text, target, ...(gear !== undefined ? { gear } : {}) }),
  };
}
