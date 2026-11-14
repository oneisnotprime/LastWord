import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { Tile, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import { held } from "./bots.js";
import { WorldRoom } from "./WorldRoom.js";

// Polish batch 2: a word that counters weather ends it; a riding bot gets off to board its boat.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const letters = (word: string) => { const l: Record<string, number> = {}; for (const ch of word) l[ch] = (l[ch] ?? 0) + 1; return l; };

it("a word whose counters name the weather ends it (SUN ends CIRRUS's clouds; WINTER ends THAWING, and THAWING WINTER)", async () => {
  WorldRoom.testSeed = 202;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  for (const t of ["letters", "spelled", "refused", "notice", "loadout"]) a.onMessage(t, () => {});
  const wa = (room as any).walkers.get(a.sessionId);
  wa.letters = all(); wa.hp = 1e9; room.rebuild(wa);
  a.send("spell", "fog"); await wait();
  expect(room.state.weatherWord).toBe("fog");
  // TROPOSPHERE's clouds, ended by SUN through `counters` (it clears rain, fog, snow and storm by clears_weather too).
  a.send("spell", "troposphere"); await wait();
  expect(room.state.weatherWord).toBe("troposphere");
  a.send("spell", "sun"); await wait();
  expect(room.state.weatherWord).not.toBe("troposphere");
  // A field countered over the whole map: WINTER ends THAWING, and THAWING ends WINTER.
  a.send("spell", "thawing"); await wait();
  expect([...(room as any).areas.values()].some((x: any) => x.word === "thawing")).toBe(true);
  a.send("spell", "winter"); await wait();
  expect([...(room as any).areas.values()].some((x: any) => x.word === "thawing")).toBe(false);
  expect(room.state.weatherWord).toBe("winter");
  a.send("spell", "thawing"); await wait();
  expect(room.state.weatherWord).not.toBe("winter");
});

it("a bot on horseback gets off to board the boat it launched, rather than back onto its horse", async () => {
  WorldRoom.testSeed = 4242;
  WorldRoom.testBare = false;
  try {
    const r = (await colyseus.createRoom("world", { bots: 1, difficulty: "hard" })) as unknown as WorldRoom;
    const R = r as any;
    const walkers = R.walkers as Map<string, any>;
    for (const [wid, w] of [...walkers]) if (w.master === "-" && w.citizenOf === undefined) R.removeWalker(wid);
    const [id, mind] = [...(R.bots as Map<string, any>)][0]!;
    const w = walkers.get(id);
    Object.assign(mind, { peaceUntil: 0, nextSpell: 0 });
    w.hp = 1e6;
    const m = r.map;
    let land: { x: number; y: number } | null = null;
    for (let y = 3; y < m.size - 3 && !land; y++) for (let x = 3; x < m.size - 3 && !land; x++) {
      if (!walkable(m, x + 0.5, y + 0.5)) continue;
      const t = tileAt(m, x + 1, y), t2 = tileAt(m, x + 4, y);
      if ((t === Tile.Water || t === Tile.DeepWater) && (t2 === Tile.Water || t2 === Tile.DeepWater)) land = { x: x + 0.5, y: y + 0.5 };
    }
    w.player.x = land!.x; w.player.y = land!.y;
    w.letters = letters("horse");
    R.spellWord(id, w, "horse");
    expect(w.gear.some((g: any) => g.vehicle)).toBe(true); // riding
    w.letters = letters("boat");
    for (let i = 0; i < 40 && !mind.boat; i++) mind.themedAt = undefined, R.botThemes(id, w, mind, held(w.letters), [], [], 0, false);
    expect(mind.boat).toBeTruthy();
    mind.nextSpell = Infinity;
    for (let i = 0; i < 600 && !w.sailing; i++) { if (i % 5 === 0) R.thinkBot(id, w, mind); r.update(0.1); }
    expect(w.sailing).toBe(true);
    expect(mind.used.sail).toBe(1);
    expect([...walkers.values()].some((c) => c.master === id && c.player.name.toLowerCase().includes("horse"))).toBe(true); // the horse waits ashore
  } finally { WorldRoom.testBare = true; }
});
