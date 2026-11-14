import { Client } from "@colyseus/sdk";
import type { Letters, LoadoutDetail } from "@lastword/shared";
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
}

/** Adjectives put on something, as everyone in sight of it is told. */
export interface Described { target: string; x: number; y: number; words: string; what: string; changes: string[] }

export interface Handlers {
  letters(held: Letters): void;
  spelled(phrase: string): void;
  refused(reason: string): void;
  gathered(letter: string): void;
  notice(text: string): void;
  dead(killer: string): void;
  loadout(detail: LoadoutDetail): void;
  won(text: string): void;
  roundover(info: { winner: string; seconds: number }): void;
  /** Adjectives were put on something in sight: show what changed. */
  described(effect: Described): void;
  closed(): void;
}

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
  room.onMessage("notice", on.notice);
  room.onMessage("dead", on.dead);
  room.onMessage("loadout", on.loadout);
  room.onMessage("won", on.won);
  room.onMessage("roundover", on.roundover);
  room.onMessage("described", on.described);
  room.onLeave(on.closed);
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
    drop: (index) => room.send("drop", index),
    use: (which) => room.send("use", which),
    attack: (target) => room.send("attack", target),
    pick: (what) => room.send("pick", what),
    describe: (text, target, gear) => room.send("describe", { text, target, ...(gear !== undefined ? { gear } : {}) }),
  };
}
