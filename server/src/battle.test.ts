import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { PLAN_FIRST, PLAN_SECONDS, RESOLVE_SECONDS, ROUND_CAP } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "refused", "spelled", "battle", "battleEvents", "hits"];
const all = (n = 99) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));
const count = (letters: Record<string, number>) => Object.values(letters).reduce((a, n) => a + n, 0);

/** Two people side by side with every letter, in a room that fights in turns, and A's DUEL on B. */
async function duel(options: Record<string, unknown> = { combat: "turns" }, seed = 77) {
  WorldRoom.testSeed = seed;
  const room = (await colyseus.createRoom("world", options)) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, any][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const seconds = (n: number) => { for (let i = 0; i < Math.round(n * 10); i++) room.update(0.1); };
  a.send("pick", { id: b.sessionId }); a.send("spell", "duel"); a.send("pick", null); await wait();
  /** Both choose; the round resolves at the next tick, and its showing passes. */
  const round = async (ma: unknown, mb: unknown) => {
    if (ma) a.send("battleAct", ma);
    if (mb) b.send("battleAct", mb);
    await wait();
    room.update(0.1); await wait(60);
    return said("a", "battleEvents").at(-1) as { round: number; events: any[]; lines: string[] };
  };
  const next = async () => { seconds(RESOLVE_SECONDS + 0.2); await wait(60); };
  return { room, a, b, wa, wb, said, seconds, round, next, battles: (room as any).battles as Map<string, any> };
}

it("turns: a DUEL opens a battle; both are pinned; a round resolves once both have chosen", async () => {
  const { room, a, b, wa, wb, said, seconds, round, next, battles } = await duel();
  expect(room.combat).toBe("turns");
  expect(room.state.combat).toBe("turns");
  expect(said("a", "spelled").at(-1)).toMatch(/DUEL with .*a battle in rounds/);
  expect(battles.size).toBe(1);
  expect(wa.battle).toBeTruthy();
  expect(wb.battle).toBe(wa.battle);
  const sheet = said("b", "battle").at(-1);
  expect(sheet).toMatchObject({ word: "DUEL", round: 1, cap: ROUND_CAP, phase: "plan", you: b.sessionId, pot: 20 });
  expect(sheet.left).toBeCloseTo(PLAN_FIRST, 0);
  expect(sheet.moves.map((m: any) => m.id)).toEqual(["attack", "defend", "spell", "flee"]);
  expect(sheet.fighters).toHaveLength(2);
  expect(sheet.fighters[0].bars.at(-1)).toMatchObject({ body: true, max: 100 });
  // Pinned: no walking, no gathering, no blows in real time.
  const at = { x: wa.player.x, y: wa.player.y };
  a.send("move", { x: at.x + 5, y: at.y }); a.send("attack", b.sessionId); a.send("gather"); await wait();
  seconds(2);
  expect(wa.player.x).toBeCloseTo(at.x); expect(wa.player.y).toBeCloseTo(at.y);
  expect(wb.hp).toBe(100);
  expect(said("a", "refused").at(-1)).toBe("You are in a battle");
  // A chooses; nothing happens until B has too. The other's choice is never shown.
  a.send("battleAct", { move: "attack" }); await wait(); seconds(1);
  expect(said("a", "battleEvents")).toHaveLength(0);
  expect(said("b", "battle").at(-1).fighters.find((f: any) => f.id === a.sessionId).ready).toBe(true);
  expect(said("b", "battle").at(-1).chosen).toBe("");
  expect(JSON.stringify(said("b", "battle").at(-1))).not.toMatch(/"attack","target"|kind/);
  const r1 = await round(null, { move: "defend" });
  expect(r1.round).toBe(1);
  expect(r1.events.map((e) => e.kind)).toContain("defend");
  const blow = r1.events.find((e) => e.kind === "strike" && e.by === a.sessionId);
  expect(blow).toBeTruthy();
  if (blow.hit) { expect(blow.defended).toBe(true); expect(wb.hp).toBeCloseTo(100 - blow.damage); expect(blow.damage).toBeLessThanOrEqual(3); }
  expect(said("a", "battle").at(-1).phase).toBe("show");
  await next();
  expect(said("a", "battle").at(-1)).toMatchObject({ phase: "plan", round: 2 });
  expect(said("a", "battle").at(-1).left).toBeCloseTo(PLAN_SECONDS, 0);
});

it("turns: spelling is a move, cast when the round resolves, through the same spelling; Defend makes the next word cheaper", async () => {
  const { a, wa, wb, said, round, next, room } = await duel();
  const before = count(wa.letters);
  a.send("spell", "sword"); await wait();
  expect(wa.gear).toHaveLength(0); // not cast yet
  expect(said("a", "battle").at(-1).chosen).toBe("spell SWORD");
  const r1 = await round(null, { move: "defend" });
  expect(r1.events).toContainEqual(expect.objectContaining({ kind: "spell", text: "SWORD", ok: true }));
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["sword"]);
  expect(count(wa.letters)).toBe(before - 5);
  await next();
  expect(said("a", "battle").at(-1).moves[0].name).toBe("Slash · SWORD");
  // B defended: B's rules now carry the discount, for one round.
  expect(room.speechFor(wb.id, wb).cost).toBeCloseTo(0.8);
  const letters = count(wb.letters);
  const r2 = await round({ move: "attack" }, { move: "spell", text: "shield" });
  expect(r2.events).toContainEqual(expect.objectContaining({ kind: "spell", text: "SHIELD", ok: true }));
  expect(count(wb.letters)).toBe(letters - 5); // six letters, the rarest free
  expect(room.speechFor(wb.id, wb).cost).toBe(1);
  // A word that is no word costs the action and is told.
  await next();
  const r3 = await round({ move: "spell", text: "qqqq" }, { move: "defend" });
  expect(r3.events.find((e) => e.kind === "spell")).toMatchObject({ ok: false });
  expect(r3.lines.join("\n")).toMatch(/A|qqqq/i);
});

it("turns: the timer chooses Defend; twice in a row and the bot mind plays for you", async () => {
  const { a, said, seconds, battles } = await duel();
  seconds(PLAN_FIRST + 0.2); await wait();
  const r1 = said("a", "battleEvents").at(-1);
  expect(r1.round).toBe(1);
  expect(r1.events.filter((e: any) => e.kind === "defend")).toHaveLength(2);
  seconds(RESOLVE_SECONDS + PLAN_SECONDS + 0.3); await wait();
  expect(said("a", "battleEvents").at(-1).round).toBe(2);
  seconds(RESOLVE_SECONDS + 0.2); await wait();
  // Round 3: both are away, so the bot mind plays for them after a short wait.
  const run = [...battles.values()][0];
  expect(run.record.timeouts).toBe(4);
  seconds(3.2); await wait();
  expect(said("a", "battleEvents").at(-1).round).toBe(3);
  expect(said("a", "battleEvents").at(-1).events.some((e: any) => e.kind === "strike" || e.kind === "spell")).toBe(true);
  // Acting again takes the wheel back.
  seconds(RESOLVE_SECONDS + 0.2); await wait();
  a.send("battleAct", { move: "defend" }); await wait();
  expect(run.idle.get(a.sessionId)).toBe(0);
});

it("turns: a knock-down cannot kill and takes the pot; the ring opens and both walk again", async () => {
  const { room, a, b, wa, wb, said, round, next, battles } = await duel();
  wb.hp = 15; room.rebuild(wb);
  wa.unit.body.stats.set("accuracy", "ABS");
  const before = count(wa.letters);
  await round({ move: "spell", text: "sword" }, { move: "defend" }); await next();
  wa.unit.body.stats.set("accuracy", "ABS"); room.rebuild(wa);
  let last = await round({ move: "attack" }, { move: "attack" });
  for (let i = 0; i < 6 && battles.size; i++) { await next(); last = await round({ move: "attack" }, { move: "attack" }); }
  expect(last.events.map((e) => e.kind)).toContain("down");
  expect(battles.size).toBe(0);
  expect((room as any).walkers.has(b.sessionId)).toBe(true); // not dead
  expect(wb.hp).toBeCloseTo(10);
  expect(wa.battle).toBeUndefined();
  expect(said("a", "battle").at(-1).over).toMatchObject({ won: true, text: "you won" });
  expect(said("b", "battle").at(-1).over).toMatchObject({ won: false, text: "you lost" });
  expect(count(wa.letters)).toBeGreaterThanOrEqual(before - 5 + 20);
  expect(room.battleLog).toHaveLength(1);
  expect(room.battleLog[0]).toMatchObject({ word: "duel", why: "down", winner: a.sessionId, people: 2 });
  // Walking works again.
  const x = wa.player.x;
  a.send("move", { x: x + 3, y: wa.player.y }); await wait();
  for (let i = 0; i < 20; i++) room.update(0.1);
  expect(wa.player.x).toBeGreaterThan(x + 0.5);
});

it("turns: fleeing a duel gives up the pot and puts you outside the ring", async () => {
  const { room, a, b, wa, wb, said, round, next, battles } = await duel();
  wb.speed = 40; // B outruns A: 95%
  const stake = count(wb.letters), at = { x: wb.player.x, y: wb.player.y };
  expect(said("b", "battle").at(-1).moves.find((m: any) => m.id === "flee").text).toMatch(/\d+% to get away/);
  let r = await round({ move: "defend" }, { move: "flee" });
  for (let i = 0; i < 5 && battles.size; i++) { await next(); wb.speed = 40; r = await round({ move: "defend" }, { move: "flee" }); }
  expect(r.events).toContainEqual(expect.objectContaining({ kind: "flee", by: b.sessionId, ok: true }));
  expect(battles.size).toBe(0);
  expect(said("b", "battle").at(-1).over.text).toBe("you ran");
  expect(said("a", "battle").at(-1).over.text).toBe("you won");
  expect(count(wb.letters)).toBe(stake); // the stake is gone: nothing comes back
  expect(Math.hypot(wb.player.x - at.x, wb.player.y - at.y)).toBeGreaterThan(2);
  expect(room.battleLog[0]).toMatchObject({ why: "fled", fleeOk: 1 });
  expect(a.sessionId).toBeTruthy();
});

it("turns: a bot fights the same battle, choosing at once; two bots take two seconds a round", async () => {
  WorldRoom.testSeed = 91;
  const room = (await colyseus.createRoom("world", { combat: "turns", bots: 2, difficulty: "normal" })) as unknown as WorldRoom;
  const any = room as any;
  const [x, y] = [...any.bots.keys()] as string[];
  const wx = any.walkers.get(x), wy = any.walkers.get(y);
  const c = room.map.cities[0]!;
  wx.letters = all(); wy.letters = all();
  wx.player.x = c.x + 0.5; wx.player.y = c.y + 0.5; wy.player.x = c.x + 1.5; wy.player.y = c.y + 0.5;
  for (const m of any.bots.values()) m.peaceUntil = 1e9; // they would otherwise wander off first
  wx.picked = y;
  any.spellWord(x, wx, "duel");
  expect(any.battles.size).toBe(1);
  const run = [...any.battles.values()][0];
  expect(run.choices.size).toBe(2); // both chose at once
  let ticks = 0;
  while (any.battles.size && ticks < 600) { room.update(0.1); ticks++; }
  expect(any.battles.size).toBe(0);
  const rec = room.battleLog[0]!;
  expect(rec.people).toBe(0);
  expect(rec.rounds).toBeGreaterThan(1);
  expect(rec.seconds).toBeGreaterThanOrEqual(rec.rounds * 2 - 0.1);
  expect(rec.seconds).toBeLessThanOrEqual(rec.rounds * 2.2);
  expect(rec.timeouts).toBe(0);
  expect(Object.values(rec.actions).reduce((n, v) => n + v, 0)).toBe(rec.rounds * 2);
  expect(any.walkers.has(x) && any.walkers.has(y)).toBe(true);
});

it("realtime: the same room option keeps the old duel, with no battle", async () => {
  const { room, wa, said, battles } = await duel({ combat: "realtime" });
  expect(room.combat).toBe("realtime");
  expect(battles.size).toBe(0);
  expect(wa.battle).toBeUndefined();
  expect(said("a", "spelled").at(-1)).toMatch(/fight in the ring: blows here cannot kill/);
  expect(said("a", "battle")).toHaveLength(0);
});

/** Two people a few tiles apart with every letter, in a room that fights in turns. */
async function pair(gap = 3, seed = 78) {
  WorldRoom.testSeed = seed;
  const room = (await colyseus.createRoom("world", { combat: "turns" })) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, any][]> = { a: [], b: [] };
  for (const t of [...MESSAGES, "windups", "dead"]) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const any = room as any;
  const wa = any.walkers.get(a.sessionId), wb = any.walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 0.5 + gap; wb.player.y = c.y + 0.5;
  any.refreshViews();
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const seconds = (n: number) => { for (let i = 0; i < Math.round(n * 10); i++) room.update(0.1); };
  const round = async (ma: unknown, mb: unknown) => {
    if (ma) a.send("battleAct", ma);
    if (mb) b.send("battleAct", mb);
    await wait(); room.update(0.1); await wait(60);
    return said("a", "battleEvents").at(-1) as { round: number; events: any[]; lines: string[] };
  };
  const next = async () => { seconds(RESOLVE_SECONDS + 0.2); await wait(60); };
  return { room, any, a, b, wa, wb, said, seconds, round, next, battles: any.battles as Map<string, any> };
}

it("turns: going for a person winds up for two seconds, then pins both in a ring: a battle to the death", async () => {
  const { room, any, a, b, wa, wb, said, seconds, round, next, battles } = await pair(1);
  a.send("attack", b.sessionId); await wait();
  seconds(1); await wait();
  // No blow in real time: the wind-up is shown to the target, who is told.
  expect(wb.hp).toBe(100);
  expect(battles.size).toBe(0);
  expect(said("b", "windups").flat().some((w: any) => w.on === b.sessionId && w.seconds === 2)).toBe(true);
  expect(said("b", "notice").join("|")).toMatch(/is closing in: run or fight/);
  seconds(1.3); await wait();
  expect(battles.size).toBe(1);
  const run = [...battles.values()][0];
  expect(run.duel).toBe(false);
  expect(any.areas.get(run.key)).toMatchObject({ word: "battle", radius: 4 });
  expect(room.state.zones.has(run.key)).toBe(true); // everyone in sight sees the ring
  expect(said("b", "battle").at(-1)).toMatchObject({ word: "BATTLE", round: 1, lethal: true, pot: 0 });
  // To the death: the loser is out of the round, the winner gets a second wind and the letters.
  wb.hp = 12; room.rebuild(wb);
  wa.hp = 40; room.rebuild(wa);
  await round({ move: "spell", text: "sword" }, { move: "defend" }); await next();
  let last: any;
  for (let i = 0; i < 12 && battles.size; i++) { wa.unit.body.stats.set("accuracy", "ABS"); last = await round({ move: "attack" }, { move: "attack" }); if (battles.size) await next(); }
  expect(battles.size).toBe(0);
  expect(last.events.map((e: any) => e.kind)).toContain("down");
  expect(any.walkers.has(b.sessionId)).toBe(false);
  expect(said("b", "dead")).toHaveLength(1);
  expect(wa.hp).toBeGreaterThanOrEqual(40 + 25 - 12); // a quarter of the body back, less what B landed
  expect(wa.battle).toBeUndefined();
  expect(room.state.zones.has(run.key)).toBe(false);
  expect(room.battleLog[0]).toMatchObject({ word: "battle", duel: false, why: "down", winner: a.sessionId });
  expect(said("a", "battle").at(-1).over.text).toBe("you won");
});

it("turns: the target can run from the wind-up; then the attacker must wait to try again", async () => {
  const { any, a, b, wa, wb, said, seconds, battles } = await pair(1);
  a.send("attack", b.sessionId); await wait();
  seconds(0.5);
  expect(wa.engage).toMatchObject({ on: b.sessionId });
  wb.player.x += 9; // away, faster than A can follow
  wa.speed = 0.01;
  seconds(2); await wait();
  expect(battles.size).toBe(0);
  expect(wa.foe).toBeNull();
  expect(said("a", "refused").at(-1)).toMatch(/got away/);
  expect(said("b", "notice").join("|")).toMatch(/You got away/);
  wb.player.x = wa.player.x + 1; wa.speed = 8;
  a.send("attack", b.sessionId); await wait(); seconds(0.3); await wait();
  expect(said("a", "refused").at(-1)).toMatch(/cannot be engaged for \d+ s/);
  expect(battles.size).toBe(0);
  seconds(10.5);
  a.send("attack", b.sessionId); await wait(); seconds(2.5);
  expect(battles.size).toBe(1);
  expect(any.walkers.get(b.sessionId).battle).toBeTruthy();
});

it("turns: fleeing a battle leaves two letters behind and both rest; nothing outside the ring strikes a fighter; TRUCE calls a battle off", async () => {
  const { room, any, a, b, wa, wb, said, seconds, round, next, battles } = await pair(1);
  a.send("attack", b.sessionId); await wait(); seconds(2.4); await wait();
  expect(battles.size).toBe(1);
  // A creature of nobody's fighters, set on B: its blows do not land.
  any.spellWord(a.sessionId, Object.assign(wa, {}), "debug");
  const wolf = any.addCreature({ spelled: { noun: "wolf" }, phrase: "wolf", vehicle: false, integrity: null }, "-", wb.player.x + 0.5, wb.player.y);
  const beast = any.walkers.get(wolf) ?? [...any.walkers.values()].find((w: any) => w.body?.noun === "wolf");
  beast.foe = b.sessionId;
  const hp = wb.hp;
  seconds(3);
  expect(wb.hp).toBe(hp);
  expect(beast.foe).toBeNull();
  for (const [id, w] of [...any.walkers]) if (w.master !== null) any.walkers.delete(id), room.state.players.delete(id); // the beast goes: the rest is about the two
  // B runs.
  wb.speed = 40;
  const before = count(wb.letters), mine = count(wa.letters);
  let r = await round({ move: "defend" }, { move: "flee" });
  for (let i = 0; i < 5 && battles.size; i++) { await next(); wb.speed = 40; r = await round({ move: "defend" }, { move: "flee" }); }
  expect(r.events).toContainEqual(expect.objectContaining({ kind: "flee", ok: true }));
  expect(battles.size).toBe(0);
  expect(count(wb.letters)).toBe(before - 2);
  expect(count(wa.letters)).toBeGreaterThanOrEqual(mine + 2);
  expect(wb.rested).toBeGreaterThan(any.elapsed + 15);
  expect(room.battleLog[0]).toMatchObject({ why: "fled", duel: false });
  // Resting: A cannot engage B again yet.
  wb.player.x = wa.player.x + 1; wb.player.y = wa.player.y;
  a.send("attack", b.sessionId); await wait(); seconds(0.3); await wait();
  expect(said("a", "refused").at(-1)).toMatch(/cannot be engaged/);
  // After the rematch time a new battle; a TRUCE spelled as a move counters BATTLE: the ring goes, nobody won.
  seconds(61);
  wb.player.x = wa.player.x + 1; wb.player.y = wa.player.y;
  a.send("attack", b.sessionId); await wait(); seconds(2.5); await wait();
  expect(battles.size).toBe(1);
  await round({ move: "defend" }, { move: "spell", text: "truce" });
  seconds(0.2); await wait();
  expect(battles.size).toBe(0);
  expect(room.battleLog.at(-1)).toMatchObject({ why: "called off", winner: "" });
  expect(any.walkers.has(a.sessionId) && any.walkers.has(b.sessionId)).toBe(true);
});

it("turns: bots engage each other and fight battles to the death through the same code", async () => {
  WorldRoom.testSeed = 92;
  const room = (await colyseus.createRoom("world", { combat: "turns", bots: 2, difficulty: "normal" })) as unknown as WorldRoom;
  const any = room as any;
  const [x, y] = [...any.bots.keys()] as string[];
  const wx = any.walkers.get(x), wy = any.walkers.get(y);
  const c = room.map.cities[0]!;
  wx.letters = all(); wy.letters = all();
  wx.player.x = c.x + 0.5; wx.player.y = c.y + 0.5; wy.player.x = c.x + 2.5; wy.player.y = c.y + 0.5;
  any.spellWord(x, wx, "sword"); any.spellWord(y, wy, "club");
  for (const m of any.bots.values()) m.peaceUntil = 0;
  wx.foe = y;
  let ticks = 0;
  while (!room.battleLog.length && ticks < 1500) { room.update(0.1); ticks++; if (!any.battles.size && any.walkers.has(x) && any.walkers.has(y) && !wx.foe) wx.foe = y; }
  expect(room.battleLog.length).toBeGreaterThan(0);
  const rec = room.battleLog[0]!;
  expect(rec).toMatchObject({ word: "battle", duel: false, people: 0 });
  expect(["down", "fled", "cap"]).toContain(rec.why);
  if (rec.why === "down") expect(any.walkers.has(x) && any.walkers.has(y)).toBe(false);
});
