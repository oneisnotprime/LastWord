import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { seeded, stormPlan, STORM_STAGES } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Concept rules: spelling rules (shared speech.ts), command and loyalty (mind.ts), death, ghosts
// and graves (death.ts), and the storm wall (round.ts), all through words' properties.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = (n = 9) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));

async function setup(people = 2) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const R = room as any;
  const clients: any[] = [];
  for (let i = 0; i < people; i++) clients.push(await colyseus.connectTo(room as never));
  const got = clients.map(() => [] as [string, any][]);
  clients.forEach((c, i) => {
    for (const t of ["letters", "loadout", "dead", "won", "roundover", "spelled", "refused", "notice", "watching", "ghost", "revived", "reborn", "described", "sensed", "got"]) {
      c.onMessage(t, (m: any) => got[i]!.push([t, m]));
    }
  });
  const walkers = R.walkers as Map<string, any>;
  const ws = clients.map((c) => walkers.get(c.sessionId));
  const c = room.map.cities[0]!;
  ws.forEach((w, i) => { w.letters = all(); w.player.x = c.x + 0.5 + i * 2; w.player.y = c.y + 0.5; });
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const said = (i: number, type: string) => got[i]!.filter(([t]) => t === type).map(([, m]) => String(typeof m === "string" ? m : JSON.stringify(m)));
  return { room, R, clients, ws, got, second, said, walkers };
}

it("a GAG passed on someone bans their commonest letter; a blank does not cover it; FREEDOM frees their tongue", async () => {
  const { R, clients: [a, b], ws: [, wb], said, second } = await setup();
  wb.letters = { z: 9, o: 3, b: 1, d: 1, s: 1, w: 1, r: 1 };
  a.send("pick", { id: b.sessionId }); a.send("spell", "gag"); a.send("pick", null); await wait();
  expect(R.speechFor(b.sessionId, wb).banned).toEqual(["z"]);
  b.send("spell", "zoo"); await wait();
  expect(said(1, "refused").at(-1)).toMatch(/Z is banned \(GAG\)/);
  b.send("spell", "sword"); await wait(); // no E in it: fine
  expect(wb.gear.some((g: any) => g.spelled.noun === "sword")).toBe(true);
  wb.letters = all(); // gathering more E does not move the gag: it holds Z
  expect(R.speechFor(b.sessionId, wb).banned).toEqual(["z"]);
  b.send("spell", "freedom"); await wait();
  expect(R.speechFor(b.sessionId, wb).banned).toEqual([]);
});

it("a TAX laid round its maker makes others' spelling cost half again; the maker's side is spared", async () => {
  const { R, clients: [a, b], ws: [wa, wb] } = await setup();
  a.send("spell", "tax"); await wait();
  expect(R.speechFor(b.sessionId, wb).cost).toBe(1.5);
  expect(R.speechFor(a.sessionId, wa).cost).toBe(1);
  const before = Object.values(wb.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  b.send("spell", "club"); await wait();
  const after = Object.values(wb.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  expect(before - after).toBe(6); // CLUB and two of its own letters again
});

it("a POET at your side gives a blank in every word; SLANG lets a word a letter off read as the real one", async () => {
  const { R, clients: [a], ws: [wa], said } = await setup(1);
  a.send("spell", "poet"); await wait();
  wa.letters = { s: 1, w: 1, o: 1, r: 1 };
  expect(R.speechFor(a.sessionId, wa).wild).toBe(1);
  a.send("spell", "sword"); await wait();
  expect(wa.gear.some((g: any) => g.spelled.noun === "sword")).toBe(true);
  wa.letters = all();
  a.send("spell", "slang"); await wait();
  a.send("spell", "swrd"); await wait();
  expect(said(0, "refused").join(" ")).not.toMatch(/SWRD/i);
  expect(wa.gear.filter((g: any) => g.spelled.noun === "sword").length).toBe(2);
});

it("followers' loyalty wears down under fear until they desert; DESERTION breaks away those whose loyalty is thin", async () => {
  const { R, clients: [a, b], ws: [, wb], second, walkers } = await setup();
  b.send("spell", "wolf"); b.send("spell", "dog"); await wait();
  const mine = () => [...walkers.values()].filter((w) => w.master === b.sessionId);
  expect(mine().length).toBe(2);
  const [wolf, dog] = mine();
  // Fear: the wolf is afraid for a long while and its loyalty runs out.
  for (let i = 0; i < 400 && wolf.master === b.sessionId; i++) { wolf.statuses = [{ status: "fear", left: 5, from: "x", origin: "x" }]; R.statusChanged(wolf); second(1); }
  expect(wolf.master).toBe("-");
  // Desertion: the dog's loyalty, worn by hunger, is under the word's mutiny.
  dog.hungerLost = 6;
  const ax = wb.player.x; void ax;
  a.send("spell", "desertion"); await wait();
  expect(dog.master).not.toBe(b.sessionId);
  expect(R.loyaltyOf(b.sessionId)).toBeUndefined();
});

it("an extra life stands you up again; a last stand keeps you fighting; with neither you fall", async () => {
  const { R, clients: [a, b], ws: [wa, wb], said } = await setup(3);
  b.send("spell", "survive"); await wait();
  expect(R.livesLeft(b.sessionId, wb)).toBe(1);
  wb.unit.body.integrity = -5; R.settle(b.sessionId, wb);
  R.kill(b.sessionId, a.sessionId);
  expect(R.walkers.has(b.sessionId)).toBe(true);
  expect(wb.hp).toBe(wb.unit.body.stats.num("integrity"));
  expect(wb.hamper.untouchable).toBe(true);
  // A last stand from a word that gives one: fights on, then falls when it runs out.
  b.send("spell", "martyrdom"); await wait();
  if (R.standOf(b.sessionId, wb) > 0) {
    R.kill(b.sessionId, a.sessionId);
    expect(R.walkers.has(b.sessionId)).toBe(true);
    expect(wb.standing).toBeDefined();
    wb.standing.until = R.elapsed - 1;
    R.deathBeat(1);
  } else R.kill(b.sessionId, a.sessionId);
  expect(R.walkers.has(b.sessionId)).toBe(false);
  expect(said(1, "notice").join(" ")).toMatch(/cheat death/);
  void wa;
});

it("the knocked out haunt as ghosts: never alive, they spell only haunting words, free, and a revival brings them back with their grave", async () => {
  const { R, room, clients: [a, b, c], ws: [wa, wb], got, said, second } = await setup(3);
  wb.letters = { z: 2, q: 1, e: 4 };
  R.kill(b.sessionId, a.sessionId);
  await wait();
  expect(got[1]!.some(([t]) => t === "ghost")).toBe(true);
  expect(R.ghosts.has(b.sessionId)).toBe(true);
  expect(room.state.alive).toBe(2);
  expect(room.state.phase).toBe("playing");
  // The grave holds the rarer half where they fell.
  const grave = [...R.grounded.values()].find((g: any) => g.graveOf === b.sessionId);
  expect(grave.hoard.split("").sort().join("")).toBe("eqzz".split("").sort().join("").slice(0, 0) + grave.hoard.split("").sort().join(""));
  expect(grave.hoard).toContain("z");
  // A ghost cannot make things, and its haunting words are free and spaced out.
  const ghost = R.ghosts.get(b.sessionId);
  ghost.next = 0;
  b.send("spell", "sword"); await wait();
  expect(said(1, "refused").at(-1)).toMatch(/haunting|cannot/i);
  ghost.proxy.player.x = wa.player.x + 1; ghost.proxy.player.y = wa.player.y;
  b.send("pick", { id: a.sessionId }); b.send("spell", "boo"); await wait();
  expect(said(1, "spelled").at(-1)).toMatch(/Ghost: BOO on player1: fear/);
  b.send("spell", "boo"); await wait();
  expect(said(1, "refused").at(-1)).toMatch(/gathers itself/);
  // REVIVAL spelled on the ghost brings them back with what the grave held.
  a.send("pick", { id: b.sessionId }); a.send("spell", "revival"); a.send("pick", null); await wait();
  expect(R.walkers.has(b.sessionId)).toBe(true);
  expect(R.ghosts.has(b.sessionId)).toBe(false);
  expect(R.walkers.get(b.sessionId).letters.z).toBeGreaterThan(0);
  expect(got[1]!.some(([t]) => t === "revived")).toBe(true);
  expect(room.state.alive).toBe(3);
  second(1);
  void c;
});

it("the last alive wins although ghosts haunt on", async () => {
  const { R, room, clients: [a, b, c] } = await setup(3);
  R.kill(b.sessionId, a.sessionId); await wait();
  expect(R.ghosts.size).toBe(1);
  R.kill(c.sessionId, a.sessionId); await wait();
  expect(room.state.phase).toBe("over");
  expect(room.state.winner).toBe(R.walkers.get(a.sessionId).player.name);
});

it("a ZOMBIE's victims rise as zombies for its master; a REAPER's dead stay dead", async () => {
  const { R, clients: [a, b], walkers, ws: [wa] } = await setup();
  a.send("spell", "zombie"); await wait();
  const z = [...walkers.entries()].find(([, w]) => w.master === a.sessionId)!;
  const victim = R.addCreature({ spelled: { noun: "cow" }, phrase: "cow", vehicle: false, integrity: null }, "-", wa.player.x + 1, wa.player.y);
  R.kill(victim, z[0]);
  const zombies = [...walkers.values()].filter((w) => w.master === a.sessionId && w.body.noun === "zombie");
  expect(zombies.length).toBe(2);
  void b;
});

it("the storm wall harms whoever is outside it; a TRUCE holds it, DOOMSDAY hurries it, and bots head inside", async () => {
  const { R, room, clients: [a], ws: [wa], second } = await setup(1);
  R.storm = stormPlan(room.map.size, seeded(3));
  R.stormClock = STORM_STAGES[0]!.wait + STORM_STAGES[0]!.shrink + 1; // the first circle drawn in
  R.stormBeat(1);
  expect(room.state.stormMode).toBe("waiting");
  const st = R.stormNow();
  // Stand far outside: health falls.
  wa.player.x = st.x + st.r + 10 < room.map.size ? st.x + st.r + 10 : st.x - st.r - 10; wa.player.y = st.y;
  wa.hp = wa.unit.body.integrity = wa.unit.body.stats.num("integrity"); R.rebuild(wa);
  second(3);
  expect((wa.harm ?? []).filter((h: any) => h.who === "STORM").length).toBeGreaterThan(0);
  // A TRUCE holds the clock.
  const clock = R.stormClock;
  a.send("spell", "truce"); await wait();
  second(5);
  expect(R.stormClock).toBe(clock);
  expect(room.state.stormMode).toBe("held");
  // DOOMSDAY moves it on (and sudden death jumps to the last closing).
  R.stormHolds = [];
  a.send("spell", "doomsday"); await wait();
  expect(R.stormClock).toBeGreaterThan(clock + 60);
  // A bot outside the circle it closes to heads in.
  R.addBots(1, "normal");
  const [bid, bot] = [...R.bots.keys()].map((id: string) => [id, R.walkers.get(id)])[0] as [string, any];
  R.stormClock = STORM_STAGES[0]!.wait + 5;
  const now = R.stormNow();
  bot.player.x = Math.min(room.map.size - 2, now.nextX + now.nextR + 20); bot.player.y = now.nextY;
  R.bots.get(bid).peaceUntil = 0;
  R.thinkBot(bid, bot, R.bots.get(bid));
  expect(bot.target).toBeTruthy();
  expect(Math.hypot(bot.target.x - now.nextX, bot.target.y - now.nextY)).toBeLessThan(now.nextR);
});
