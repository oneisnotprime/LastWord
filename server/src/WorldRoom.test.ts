import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { generateMap, Tile, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import type { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const visible = (client: any) => [...client.state.players.keys()].sort();

it("spawns players on walkable ground and tells the client the map seed", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  await (room as any).waitForNextPatch();
  expect(a.state.seed).toBe(room.map.seed);
  expect(generateMap(a.state.seed).tiles).toEqual(room.map.tiles);
  const me = a.state.players.get(a.sessionId);
  expect(walkable(room.map, me.x, me.y)).toBe(true);
  expect(tileAt(room.map, me.x, me.y)).toBeDefined();
});

it("sends a client only the players inside its sight range", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const pa = room.state.players.get(a.sessionId)!, pb = room.state.players.get(b.sessionId)!;

  // Sight is 60 m, which is 15 tiles. Put them 100 tiles apart.
  pa.x = 50; pa.y = 50; pb.x = 150; pb.y = 50;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId]);
  expect(visible(b)).toEqual([b.sessionId]);

  pb.x = 60;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId, b.sessionId].sort());
  expect(a.state.players.get(b.sessionId).x).toBeCloseTo(60);

  pb.x = 150;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId]);
});

it("walks a player toward the point it asks for", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const p = room.state.players.get(a.sessionId)!;
  const city = room.map.cities[0]!;
  p.x = city.x + 0.5; p.y = city.y + 0.5;
  a.send("move", { x: p.x + 2, y: p.y });
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 20; i++) room.update(0.1);
  expect(p.x).toBeCloseTo(city.x + 2.5, 1);
  a.send("move", { x: "nonsense" });
  a.send("move", null);
  await new Promise((r) => setTimeout(r, 100));
  expect(room.clients.length).toBe(1);
});

it("spells a word into an object, spends the letters, and refuses what it cannot make", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox = { letters: [] as unknown[], spelled: [] as unknown[], refused: [] as unknown[] };
  for (const type of ["letters", "spelled", "refused"] as const) a.onMessage(type, (m: unknown) => inbox[type].push(m));
  for (const type of Object.keys(inbox)) b.onMessage(type, () => {});
  const pa = room.state.players.get(a.sessionId)!, pb = room.state.players.get(b.sessionId)!;
  // Stand in a city: equipping moves anyone standing on water to the shore.
  const [here, far] = [room.map.cities[0]!, room.map.cities[1]!];
  pa.x = here.x + 0.5; pa.y = here.y + 0.5; pb.x = far.x + 0.5; pb.y = far.y + 0.5;
  await new Promise((r) => setTimeout(r, 100));
  // The first hand is sent on join, before this test could listen; read it from the room.
  const before = { ...(room as any).walkers.get(a.sessionId).letters } as Record<string, number>;
  expect(before.s).toBeGreaterThanOrEqual(1);

  a.send("spell", "sword");
  a.send("spell", "zzz");
  a.send("spell", "quetzal sword");
  a.send("spell", 42);
  await new Promise((r) => setTimeout(r, 300));
  await (room as any).waitForNextPatch();

  expect(inbox.spelled).toEqual(["SWORD equipped"]);
  expect(inbox.refused).toHaveLength(3);
  expect(inbox.refused[0]).toBe("ZZZ is not in the dictionary yet");
  const after = inbox.letters.at(-1) as Record<string, number>;
  expect(after.s).toBe(before.s! - 1);
  expect(after.w).toBe(before.w! - 1);

  // A sword is held, so it goes into the hand, not onto the ground.
  expect(a.state.players.get(a.sessionId).gear).toBe("sword");
  expect(a.state.things.size).toBe(0);

  // Dropping it puts it on the ground where others in sight can see it; taking picks it up.
  a.send("drop");
  await new Promise((r) => setTimeout(r, 200));
  await (room as any).waitForNextPatch();
  const things = [...a.state.things.values()];
  expect(things).toHaveLength(1);
  expect(things[0]).toMatchObject({ phrase: "sword", owner: a.sessionId });
  expect(things[0].x).toBeCloseTo(here.x + 0.5);
  expect(b.state.things.size).toBe(0); // out of sight
  a.send("take");
  await new Promise((r) => setTimeout(r, 200));
  await (room as any).waitForNextPatch();
  expect(a.state.players.get(a.sessionId).gear).toBe("sword");
  expect(a.state.things.size).toBe(0);

  for (let i = 0; i < 6; i++) a.send("spell", "sword");
  await new Promise((r) => setTimeout(r, 300));
  expect(inbox.refused.at(-1)).toMatch(/^You need /);
});

it("gathers letters from the ground, pays out production, and passes letters between players", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "gathered", "notice"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 1.5; wb.player.y = city.y + 0.5;
  const count = (w: any) => Object.values(w.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  const wait = () => new Promise((r) => setTimeout(r, 150));

  // Gathering takes two seconds of standing still and yields a city letter.
  const start = count(wa);
  a.send("gather");
  await wait();
  room.update(1);
  expect(count(wa)).toBe(start);
  room.update(1.1);
  await wait();
  expect(count(wa)).toBe(start + 1);
  expect(got.a.find(([t]) => t === "gathered")![1]).toMatch(/^[lnst]$/);

  // Moving cancels a gathering.
  a.send("gather");
  await wait();
  a.send("move", { x: wa.player.x, y: wa.player.y });
  await wait();
  room.update(3);
  expect(count(wa)).toBe(start + 1);

  // A farm pays its owner two A a minute.
  wa.letters = { f: 1, a: 1, r: 1, m: 1 };
  a.send("spell", "farm");
  await wait();
  expect(wa.letters.a).toBe(0);
  room.update(60);
  expect(wa.letters.a).toBe(2);

  // Letters pass between players who stand close, and only then.
  a.send("give", { to: wb.player.name, letters: "aa" });
  await wait();
  expect(wa.letters.a).toBe(0);
  expect(wb.letters.a).toBeGreaterThanOrEqual(2);
  expect(got.b.some(([t, m]) => t === "notice" && /gave you AA/.test(String(m)))).toBe(true);
  a.send("give", { to: wb.player.name, letters: "zz" });
  await wait();
  wb.player.x += 50;
  a.send("give", { to: wb.player.name, letters: "f" });
  a.send("give", { to: "nobody", letters: "f" });
  a.send("give", "nonsense");
  await wait();
  expect(got.a.filter(([t]) => t === "refused").map(([, m]) => m)).toEqual([
    "You need Z Z", `${wb.player.name} is too far away`, "nobody is not here", "Give whom what? Try: give player2 abc",
  ]);
});

it("fights: armor breaks before the body, the dead are knocked out and the last one alive wins", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 3.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));

  wa.letters = { g: 1, u: 1, n: 1, h: 1, a: 1, t: 1 };
  wb.letters = { a: 1, r: 2, m: 1, o: 1, z: 3 };
  a.send("spell", "gun");
  b.send("spell", "armor");
  await wait();
  expect(wa.player.gear).toBe("gun");
  expect(wb.player.gear).toBe("armor");
  a.send("spell", "hat"); // a second thing for the head would be refused; one is fine
  await wait();
  expect(wa.player.gear).toBe("gun, hat");

  // Out of reach the attacker walks toward its target and does not fire: a gun reaches 50 m, 12.5 tiles.
  wb.player.x = city.x + 30.5;
  a.send("attack", b.sessionId);
  await wait();
  const startX = wa.player.x;
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect(wb.hp).toBe(100);
  expect(wb.gear[0].integrity).toBe(400);
  expect(wa.player.x).toBeGreaterThan(startX);

  // In reach the armor takes every hit until it breaks; only then is the body hurt.
  wb.player.x = wa.player.x + 3;
  let armorBrokeAt = -1;
  for (let i = 0; i < 2000 && walkers.has(b.sessionId); i++) {
    room.update(0.1);
    if (armorBrokeAt < 0 && wb.gear.length === 0) {
      armorBrokeAt = i;
      expect(wb.hp).toBe(100);
    }
  }
  await wait();
  expect(armorBrokeAt).toBeGreaterThan(0);
  expect(walkers.has(b.sessionId)).toBe(false);
  expect(room.state.players.has(b.sessionId)).toBe(false);
  expect(got.b.some(([t, m]) => t === "notice" && m === "Your ARMOR was destroyed")).toBe(true);
  expect(got.b.find(([t]) => t === "dead")![1]).toBe(wa.player.name);
  expect(wa.letters.z).toBe(3); // the dead player's letters go to the killer
  expect(got.a.some(([t]) => t === "won")).toBe(true);
});

it("lays terrain, pushes players out of it, and lets things on the ground be destroyed for letters", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 1.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));

  // A pond is water two tiles across; both players end up on its shore, and clients are told.
  wa.letters = { p: 1, o: 1, n: 1, d: 1 };
  a.send("spell", "pond");
  await wait();
  await (room as any).waitForNextPatch();
  expect(tileAt(room.map, city.x + 0.5, city.y + 0.5)).toBe(Tile.Water);
  for (const w of [wa, wb]) expect(walkable(room.map, w.player.x, w.player.y)).toBe(true);
  expect(b.state.edits.length).toBe(1);
  expect(b.state.edits[0].tile).toBe(Tile.Water);
  const pond = [...room.state.things.entries()].find(([, t]) => t.phrase === "pond")![0];
  a.send("take");
  a.send("attack", pond); // part of the land: neither carried nor attacked
  await wait();
  expect(wa.gear).toHaveLength(0);
  expect(wa.foe).toBeNull();

  // B builds a chair; A smashes it and earns D for destroying and V for beating another's thing.
  wb.letters = { c: 1, h: 1, a: 1, i: 1, r: 1 };
  b.send("spell", "chair");
  await wait();
  const chair = [...room.state.things.entries()].find(([, t]) => t.phrase === "chair")![0];
  wa.letters = {};
  wa.player.x = wb.player.x; wa.player.y = wb.player.y; // there is no path-finding around the pond yet
  a.send("attack", chair);
  await wait();
  for (let i = 0; i < 300 && room.state.things.has(chair); i++) room.update(0.1);
  await wait();
  expect(room.state.things.has(chair)).toBe(false);
  expect(wa.letters).toEqual({ d: 1, v: 1 });
  expect(got.b.some(([t, m]) => t === "notice" && m === "Your CHAIR was destroyed")).toBe(true);
});

it("casts verbs, steals with THEFT once stealthy enough, and changes the sky", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const last = (who: "a" | "b", type: string) => got[who].filter(([t]) => t === type).at(-1)?.[1];
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 1.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));
  const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 9]));
  wa.letters = all(); wb.letters = all();

  // RUN doubles speed for thirty seconds, then wears off.
  a.send("spell", "run");
  await wait();
  expect(last("a", "spelled")).toBe("RUN for 30 seconds");
  expect(wa.speed).toBe(10);
  expect(wa.player.gear).toBe("RUN");
  room.update(31);
  await wait();
  expect(wa.speed).toBe(5);
  expect(last("a", "notice")).toBe("RUN wore off");

  // FLY crosses water; landing on water puts you ashore.
  a.send("spell", "fly");
  await wait();
  expect(wa.flying).toBe(true);
  wa.player.x = 2.5; wa.player.y = 2.5; // out over the sea
  a.send("move", { x: 6.5, y: 2.5 });
  await wait();
  room.update(0.5);
  expect(wa.player.x).toBeGreaterThan(2.5);
  room.update(61);
  expect(wa.flying).toBe(false);
  expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(true);

  // HEAL restores integrity.
  wa.hp = 20;
  a.send("spell", "heal");
  await wait();
  expect(wa.hp).toBe(100);
  expect(wa.player.hp).toBe(100);

  // THEFT: B's chest is guarded (security 3). A has stealth 0, so it fails and costs nothing.
  wa.player.x = wb.player.x; wa.player.y = wb.player.y;
  b.send("spell", "chest");
  await wait();
  const chest = [...room.state.things.entries()].find(([, t]) => t.phrase === "chest")![0];
  a.send("spell", "theft");
  await wait();
  expect(last("a", "refused")).toBe("Select a thing for THEFT first: click it");
  a.send("attack", chest);
  await wait();
  const held = wa.letters.t;
  a.send("spell", "theft");
  await wait();
  expect(last("a", "refused")).toBe("CHEST is too well guarded (3 against your 0)");
  expect(wa.letters.t).toBe(held);
  // SNEAK adds five stealth; now the theft works.
  a.send("spell", "sneak");
  await wait();
  a.send("spell", "theft");
  await wait();
  expect(last("a", "spelled")).toBe("CHEST is yours");
  expect(room.state.things.get(chest)!.owner).toBe(a.sessionId);
  expect(last("b", "notice")).toBe("Your CHEST was stolen");
  a.send("spell", "war");
  await wait();
  expect(last("a", "refused")).toBe("WAR does nothing yet");

  // Sky: MOON brings night and halves sight; RAIN cuts it further; SUN brings day and clears the rain.
  room.update(200); // let SNEAK wear off
  expect(wb.sight).toBe(15);
  b.send("spell", "moon");
  await wait();
  expect(room.state.daylight).toBe("night");
  expect(wb.sight).toBe(7.5);
  b.send("spell", "rain");
  await wait();
  expect(room.state.weather).toBe("rain");
  expect(wb.sight).toBeCloseTo(7.5 * 0.7);
  expect(wa.sight).toBeCloseTo(7.5 * 0.7);
  a.send("spell", "sun");
  await wait();
  expect(room.state.daylight).toBe("day");
  expect(room.state.weather).toBe("");
  expect(wb.sight).toBe(15);
  // Weather ends by itself too.
  b.send("spell", "fog");
  await wait();
  expect(wb.sight).toBeCloseTo(1.5);
  room.update(15 * 60 + 1);
  expect(room.state.weather).toBe("");
  expect(wb.sight).toBe(15);
});

it("creatures follow their master, defend them, join their fights and outlive them", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 2.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));
  const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 9]));
  wa.letters = all(); wb.letters = all();
  const run = (seconds: number) => { for (let i = 0; i < seconds * 10; i++) room.update(0.1); };

  a.send("spell", "wolf");
  a.send("spell", "horse"); // a horse is ridden, not a follower
  await wait();
  expect(got.a.filter(([t]) => t === "spelled").map(([, m]) => m)).toEqual(["WOLF is with you", "HORSE equipped"]);
  const [wolfId, wolf] = [...walkers].find(([, w]) => w.master === a.sessionId)!;
  expect(room.state.players.get(wolfId)).toMatchObject({ name: "wolf", owner: a.sessionId });
  expect(wa.speed).toBe(18);
  a.send("attack", wolfId); // you cannot attack your own
  await wait();
  expect(wa.foe).toBeNull();

  // It follows its master.
  a.send("move", { x: wa.player.x, y: wa.player.y + 3 });
  await wait();
  run(3);
  expect(Math.hypot(wolf.player.x - wa.player.x, wolf.player.y - wa.player.y)).toBeLessThanOrEqual(2.1);

  // It defends its master: B attacks A, the wolf goes for B.
  wb.player.x = wa.player.x + 1; wb.player.y = wa.player.y;
  wb.hp = 1e6; room.rebuild(wb); // three wolf bites would kill an ordinary person
  b.send("attack", a.sessionId);
  await wait();
  room.update(0.1);
  expect(wolf.foe).toBe(b.sessionId);
  run(2);
  expect(wb.hp).toBeLessThan(1e6);

  // B kills the wolf for a K; with no attacker left it has no foe.
  b.send("attack", wolfId);
  await wait();
  wb.letters = {};
  wolf.hp = 1; room.rebuild(wolf);
  wb.cooldown = 0;
  run(3);
  expect(walkers.has(wolfId)).toBe(false);
  expect(wb.letters.k).toBe(1);
  expect(got.a.some(([t]) => t === "won")).toBe(false); // a creature dying ends nothing

  // A creature whose master dies stays in the world with no owner.
  wa.letters = all();
  a.send("spell", "bear");
  await wait();
  const [bearId] = [...walkers].find(([, w]) => w.master === a.sessionId)!;
  wa.gear = []; wa.hp = 1; room.rebuild(wa);
  b.send("attack", a.sessionId);
  await wait();
  for (let i = 0; i < 100 && walkers.has(a.sessionId); i++) room.update(0.1);
  expect(walkers.has(a.sessionId)).toBe(false);
  expect(room.state.players.get(bearId)!.owner).toBe("-");
  await wait(); // the win message has to arrive
  expect(got.b.some(([t]) => t === "won")).toBe(true);
});

it("tells a player the detail of their own character and drops what they choose", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const details: any[] = [];
  a.onMessage("loadout", (d: unknown) => details.push(d));
  for (const type of ["letters", "spelled", "refused", "notice"]) a.onMessage(type, () => {});
  const wa = (room as any).walkers.get(a.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wa.letters = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 9]));
  const wait = () => new Promise((r) => setTimeout(r, 150));

  for (const word of ["sword", "armor", "hat", "tank", "dog", "run"]) a.send("spell", word);
  await wait();
  const d = details.at(-1);
  expect(d.health).toEqual({ now: 100, max: 100 });
  expect(d.gear.map((g: any) => [g.phrase, g.slot])).toEqual([["sword", "held"], ["armor", "body"], ["hat", "head"], ["tank", "ride"]]);
  expect(d.gear[1]).toMatchObject({ integrity: 400, max: 400 });
  expect(d.gear[0].integrity).toBeNull(); // a sword is not a layer
  expect(d.attack).toMatchObject({ with: "tank", damage: { blast: 1200 }, reach: 3000 });
  expect(d.speed).toBe(18); // the tank's speed: RUN acts on the body, not on what it rides
  expect(d.effects).toEqual([{ word: "run", left: 30 }]);
  expect(d.creatures).toEqual([{ name: "dog", health: 100 }]);

  // Dropping by index takes that item, not the last one.
  a.send("drop", 3);
  await wait();
  const on = details.at(-1);
  expect(on.gear.map((g: any) => g.phrase)).toEqual(["sword", "armor", "hat"]);
  expect(on.attack).toMatchObject({ with: "sword", damage: { slash: 40 } });
  a.send("drop", 0);
  await wait();
  expect(details.at(-1).attack).toMatchObject({ with: "bare hands", damage: { blunt: 5 } });
  a.send("drop", "nonsense"); // anything else drops the last thing
  await wait();
  expect(details.at(-1).gear.map((g: any) => g.phrase)).toEqual(["armor"]);
});

it("walks around water to reach the far side", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  for (const type of ["letters", "spelled", "refused", "notice", "loadout"]) a.onMessage(type, () => {});
  const wa = (room as any).walkers.get(a.sessionId);
  const c = room.map.cities[0]!;
  room.reshape(c.x + 0.5, c.y + 0.5, 3, Tile.Water);
  wa.player.x = c.x - 4.5; wa.player.y = c.y + 0.5;
  const goal = { x: c.x + 5.5, y: c.y + 0.5 };
  a.send("move", goal);
  await new Promise((r) => setTimeout(r, 150));
  for (let i = 0; i < 300 && wa.target; i++) {
    room.update(0.1);
    expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(true);
  }
  expect(Math.hypot(wa.player.x - goal.x, wa.player.y - goal.y)).toBeLessThan(0.05);
});
