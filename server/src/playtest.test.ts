import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { nearestWalkable, type LoadoutDetail, type Sensed } from "@lastword/shared";
import appConfig from "./app.config.js";
import type { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
/** Waits until the server has acted on what was sent (a slow machine takes longer than `wait`), up to two seconds. */
const until = async (done: () => boolean) => { for (let i = 0; i < 40 && !done(); i++) await wait(50); };
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };

async function players(n = 2) {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const clients: any[] = [];
  for (let i = 0; i < n; i++) clients.push(await colyseus.connectTo(room as never));
  const said = clients.map(() => [] as string[]);
  const got = clients.map(() => [] as [string, any][]);
  clients.forEach((c, i) => {
    for (const t of ["letters", "loadout", "dead", "won", "roundover", "gathered", "spelled", "refused", "notice", "sensed", "watching", "described"]) {
      c.onMessage(t, (m: any) => {
        got[i]!.push([t, m]);
        if (t === "spelled" || t === "refused" || t === "notice") said[i]!.push(m);
      });
    }
  });
  const walkers = (room as any).walkers as Map<string, any>;
  const ws = clients.map((c) => walkers.get(c.sessionId));
  const city = room.map.cities[0]!;
  ws.forEach((w, i) => { w.player.x = city.x + 0.5 + i * 2; w.player.y = city.y + 0.5; w.letters = all(); room.rebuild(w); });
  const last = (i: number, t: string) => got[i]!.filter(([k]) => k === t).at(-1)?.[1];
  // Things players made (the map's own letter sources, markets and ruins belong to nobody).
  const things = () => [...room.state.things.entries()].map(([id, t]) => ({ id, ...t.toJSON() })).filter((t) => t.owner !== "");
  return { room, clients, said, got, walkers, ws, city, last, things };
}

it("MAP goes on your screen as a minimap, not on the ground; the senses show letter sources and the living in range", async () => {
  const { room, clients: [a], ws: [wa], said, last, things } = await players();
  a.send("spell", "map"); await wait();
  expect(said[0]!.at(-1)).toBe("MAP is on your screen: a minimap");
  expect(things()).toEqual([]);
  expect(wa.gear).toEqual([]);
  const d = last(0, "loadout") as LoadoutDetail;
  expect(d.senses).toEqual([{ word: "map", reveal: 200, letters: 125, life: 0 }]);
  a.send("spell", "farm"); await wait(); // a farm makes letters: a letter source
  ticks(room, 12); await wait();
  const sensed = last(0, "sensed") as Sensed;
  const farm = sensed.letters.find((l) => Math.hypot(l.x - wa.player.x, l.y - wa.player.y) < 1)!;
  expect(farm.letters.length).toBeGreaterThan(0);
  for (const l of sensed.letters) expect(Math.hypot(l.x - wa.player.x, l.y - wa.player.y)).toBeLessThanOrEqual(125);
  expect(sensed.life).toEqual([]); // a MAP shows no one: it has no detect_life
});

it("HOME claims the ground around it: your things there take part of a blow, are harder to steal, and you are sheltered", async () => {
  const { room, clients: [a, b], ws: [wa, wb], said, things } = await players();
  const res = wa.unit.body.stats.num("res_slash");
  a.send("spell", "home"); await wait();
  const zone = [...room.state.zones.values()].find((z) => z.word === "home")!;
  expect(zone).toBeDefined();
  expect(zone.radius).toBe(10);
  expect(zone.owner).toBe(a.sessionId);
  expect(zone.shelter).toBe(60);
  ticks(room, 11);
  expect(wa.unit.body.stats.num("res_slash")).toBeCloseTo(res + 0.6); // HOME's cover, 0.6, on you inside it
  expect(wb.unit.body.stats.num("res_slash")).toBeCloseTo(res); // not on anyone else
  // A chest of A's at home against one out in the open: the same blows take 40% as much at home.
  a.send("spell", "chest"); await wait();
  await until(() => things().filter((t) => t.owner === a.sessionId).length >= 2);
  const [home, chest] = things().filter((t) => t.owner === a.sessionId);
  expect(home!.phrase).toBe("home");
  wa.player.x += wa.player.x > 128 ? -25 : 25; wa.player.x = nearestWalkable(room.map, wa.player).x;
  a.send("spell", "chest"); await wait();
  await until(() => things().filter((t) => t.phrase === "chest").length >= 2);
  const away = things().find((t) => t.phrase === "chest" && t.id !== chest!.id)!;
  const r = room as any, sword = r.dict ? (await import("@lastword/shared")).resolve(r.dict, "sword") : null;
  sword!.set("accuracy", "ABS"); sword!.set("critical", 0); // every blow lands the same
  for (let i = 0; i < 3; i++) { r.strikeThing(b.sessionId, sword, chest!.id, room.state.things.get(chest!.id)); r.strikeThing(b.sessionId, sword, away.id, room.state.things.get(away.id)); }
  const hp = (id: string) => r.grounded.get(id).integrity;
  const max = r.statsOf(r.grounded.get(chest!.id)).num("integrity");
  expect(max - hp(chest!.id)).toBeCloseTo((max - hp(away.id)) * 0.4);
  // The HOME itself has no shelter: its walls take the blows.
  expect(r.claimAt(a.sessionId, room.state.things.get(home!.id), home!.id).shelter).toBe(0);
  // Theft against a thing at home meets HOME's security on top of the thing's own.
  expect(r.claimAt(a.sessionId, room.state.things.get(chest!.id), chest!.id).security).toBe(6);
  void said; void wb;
});

it("R gets off what you ride: a CAR stays on the ground as yours, an ASS walks with you as a creature; E gets back on", async () => {
  const { room, clients: [a], ws: [wa], said, walkers, things, last } = await players();
  a.send("spell", "car"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["car"]);
  a.send("dismount"); await wait();
  expect(wa.gear).toEqual([]);
  expect(things().map((t) => [t.phrase, t.owner])).toEqual([["car", a.sessionId]]);
  expect(said[0]!.at(-1)).toBe("Off CAR (E: back on)");
  a.send("take"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["car"]);
  a.send("dismount"); await wait();
  wa.player.x += 6; wa.player.x = nearestWalkable(room.map, wa.player).x;
  // An ASS is ridden, and shown as ridden; off it, it is one of your creatures.
  a.send("spell", "ass"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["ass"]);
  a.send("dismount"); await wait();
  const ass = [...walkers.values()].find((w) => w.master === a.sessionId);
  expect(ass?.player.name).toBe("ass");
  await wait();
  expect((last(0, "loadout") as LoadoutDetail).creatures.map((c) => c.name)).toEqual(["ass"]);
  a.send("take"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["ass"]);
  expect([...walkers.values()].some((w) => w.master === a.sessionId)).toBe(false);
  a.send("dismount"); a.send("dismount"); await wait();
  expect(said[0]!.at(-1)).toBe("You are not riding anything");
  ticks(room, 2);
});

it("a BOAT cannot move on land, so it is not ridden: it stays on the ground and says why", async () => {
  const { clients: [a], ws: [wa], said, things } = await players();
  a.send("spell", "boat"); await wait();
  expect(wa.gear).toEqual([]);
  expect(things().map((t) => t.phrase)).toEqual(["boat"]);
  expect(said[0]).toContain("BOAT cannot move on land: it stays on the ground");
});

it("a person's route search never waits on the per-tick budget the bots and creatures share", async () => {
  const { room, clients: [a], ws: [wa] } = await players();
  // A spot behind water or rock, so the move needs a search.
  const start = { x: wa.player.x, y: wa.player.y };
  (room as any).routesLeft = 0;
  const update = room.update.bind(room);
  room.update = (s: number) => { update(s); (room as any).routesLeft = 0; }; // every tick's budget already spent
  a.send("move", { x: start.x + 10, y: start.y + 10 }); await wait();
  wa.route = []; wa.routeTo = null; // as if the line were not clear
  ticks(room, 10);
  expect(Math.hypot(wa.player.x - start.x, wa.player.y - start.y)).toBeGreaterThan(1);
});

it("the knocked out watch their killer, and when the killer falls, the killer's killer", async () => {
  const { room, clients: [a, b, c], ws: [wa, wb, wc], got } = await players(3);
  (room as any).kill(a.sessionId, b.sessionId);
  await wait();
  expect(got[0]!.find(([t]) => t === "watching")?.[1]).toEqual({ id: b.sessionId, name: wb.player.name });
  room.refreshViews(); await wait();
  expect(a.state.players.has(b.sessionId)).toBe(true); // A is sent what B sees
  (room as any).kill(b.sessionId, c.sessionId);
  await wait();
  expect(got[0]!.filter(([t]) => t === "watching").at(-1)?.[1]).toEqual({ id: c.sessionId, name: wc.player.name });
  expect(got[1]!.find(([t]) => t === "watching")?.[1]).toEqual({ id: c.sessionId, name: wc.player.name });
  void wa;
});
