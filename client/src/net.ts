import { Client } from "@colyseus/sdk";
import type { Letters, LoadoutDetail, Offer, Sensed } from "@lastword/shared";
import { chooseGame } from "./start.js";

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
  take(): void;
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
  /** Trading and the like: "market" { give, get }, "hire" {}, "transmute" { give }, "offer" { to, give, get }, "answer" { id, accept }. */
  act(type: "market" | "hire" | "transmute" | "offer" | "answer", payload: unknown): void;
}

/** Letters gained and why ("forage", "hunted COW (+12 food)"), and where they came from. */
export interface Got { letters: string; why: string; x: number; y: number }

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
  notice(text: string): void;
  dead(killer: string): void;
  loadout(detail: LoadoutDetail): void;
  won(text: string): void;
  roundover(info: { winner: string; seconds: number }): void;
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
}

/** One blow, as the server tells it (server `Hit`). */
export interface Hit { by: string; on: string; amount: number; layer: string; kind: "hit" | "crit" | "miss" | "blocked"; ranged: boolean; x?: number; y?: number }

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
  room.onMessage("notice", on.notice);
  room.onMessage("dead", on.dead);
  room.onMessage("loadout", on.loadout);
  room.onMessage("won", on.won);
  room.onMessage("roundover", on.roundover);
  room.onMessage("described", on.described);
  room.onMessage("watching", on.watching);
  room.onMessage("sensed", on.sensed);
  room.onMessage("hits", on.hits);
  room.onMessage("offers", on.offers);
  room.onLeave(on.closed);
  room.onDrop(on.dropped);
  room.onReconnect(on.reconnected);
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
    take: () => room.send("take"),
    dismount: () => room.send("dismount"),
    drop: (index) => room.send("drop", index),
    use: (which) => room.send("use", which),
    attack: (target) => room.send("attack", target),
    pick: (what) => room.send("pick", what),
    act: (type, payload) => room.send(type, payload),
    leave: () => { room.onLeave.clear?.(); void room.leave(true); },
    describe: (text, target, gear) => room.send("describe", { text, target, ...(gear !== undefined ? { gear } : {}) }),
  };
}
