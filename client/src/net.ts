import { Client } from "@colyseus/sdk";
import type { Letters } from "@lastword/shared";

export interface Connection {
  sessionId: string;
  /** Live server state: seed, size, players, things. Read it each frame. */
  state: any;
  move(x: number, y: number): void;
  spell(text: string): void;
  gather(): void;
  give(to: string, letters: string): void;
}

export interface Handlers {
  letters(held: Letters): void;
  spelled(phrase: string): void;
  refused(reason: string): void;
  gathered(letter: string): void;
  notice(text: string): void;
  closed(): void;
}

const endpoint =
  (import.meta.env.VITE_SERVER as string | undefined) ?? `${location.protocol}//${location.hostname}:2567`;

/** Joins the world room and waits for the first state. */
export async function connect(on: Handlers): Promise<Connection> {
  const room: any = await new Client(endpoint).joinOrCreate("world", {});
  room.onMessage("letters", on.letters);
  room.onMessage("spelled", on.spelled);
  room.onMessage("refused", on.refused);
  room.onMessage("gathered", on.gathered);
  room.onMessage("notice", on.notice);
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
    spell: (text) => room.send("spell", text),
    gather: () => room.send("gather"),
    give: (to, letters) => room.send("give", { to, letters }),
  };
}
