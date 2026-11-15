import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { nearestWalkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Frequency batch 2: the last two bots, each sat in a machine that has run out of fuel far from the
// other, get off and go on foot; before, they rode nowhere until the time cap.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

it("the last two bots leave dead rides late in a round and close in on each other", async () => {
  WorldRoom.testSeed = 4242;
  const room = (await colyseus.createRoom("world", { bots: 2, difficulty: "normal" })) as unknown as WorldRoom;
  const R = room as any;
  R.elapsed = 1600;
  const bots = [...(R.bots as Map<string, any>).keys()].map((id) => ({ id, w: R.walkers.get(id), mind: R.bots.get(id) }));
  const c = room.map.cities[0]!;
  const spots = [nearestWalkable(room.map, { x: c.x - 60, y: c.y }), nearestWalkable(room.map, { x: c.x + 60, y: c.y })];
  bots.forEach((b, i) => {
    Object.assign(b.mind, { peaceUntil: 0, nextSpell: 1e9 });
    b.w.letters = {}; b.w.hp = 1e6; b.w.player.x = spots[i]!.x; b.w.player.y = spots[i]!.y;
    b.w.gear.push({ spelled: { noun: "cab" }, phrase: "cab", vehicle: true, integrity: null, stalled: true });
    b.w.stores.fuel = 0;
    room.rebuild(b.w);
    expect(b.w.unit.riding, "riding").toBeTruthy();
  });
  const gap = () => Math.hypot(bots[0]!.w.player.x - bots[1]!.w.player.x, bots[0]!.w.player.y - bots[1]!.w.player.y);
  const start = gap();
  for (let i = 0; i < 600; i++) { room.update(0.1); for (const b of bots) b.w.stores.fuel = 0; }
  for (const b of bots) expect(b.w.unit.riding, "got off").toBeFalsy();
  expect(gap()).toBeLessThan(start * 0.7);
}, 60_000);
